"""
Runner Agent API — register, poll, heartbeat endpoints.

Remote runner agents (standalone JARs / ZIPs running outside Docker)
use these endpoints to receive test execution work.

Flow:
  1. Agent starts → POST /register  (gets a runner_token)
  2. Agent loop   → GET  /poll      (returns queued execution or 204)
  3. Agent loop   → PUT  /heartbeat (keeps runner marked online)
  4. Agent runs Selenium, PUTs step/exec status via existing endpoints.
"""

import io
import logging
import os
import secrets
import json
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.database import DatabaseManager, get_database_manager
from services.subscription_limits import require_active_subscription

logger = logging.getLogger(__name__)

router = APIRouter()

RUNNER_API_KEY = os.getenv("RUNNER_API_KEY", "")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class RunnerRegisterRequest(BaseModel):
    organization_id: str
    runner_name: str = Field(max_length=255)
    capabilities: List[str] = ["chrome"]
    hostname: Optional[str] = None
    os_name: Optional[str] = None


class RunnerRegisterResponse(BaseModel):
    runner_id: str
    runner_token: str
    message: str


class RunnerHeartbeatResponse(BaseModel):
    status: str
    server_time: str


class LogEntry(BaseModel):
    level: str = "INFO"
    message: str
    execution_id: Optional[str] = None
    timestamp: Optional[str] = None


class LogBatch(BaseModel):
    logs: List[LogEntry]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_db() -> DatabaseManager:
    return await get_database_manager()


async def _verify_runner_token(
    authorization: str = Header(..., description="Bearer <runner_token>"),
    db: DatabaseManager = Depends(_get_db),
) -> dict:
    """Validate the Bearer token and return the runner row."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization[7:]
    row = await db.execute_one(
        "SELECT id, organization_id, status FROM exec.runners WHERE runner_token = $1",
        token,
    )
    if not row:
        raise HTTPException(status_code=401, detail="Invalid runner token")
    return dict(row)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=RunnerRegisterResponse)
async def register_runner(
    body: RunnerRegisterRequest,
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    db: DatabaseManager = Depends(_get_db),
):
    """
    Register a new runner agent.  Returns a unique runner_token that the
    agent must send as ``Authorization: Bearer <token>`` on all subsequent
    calls.  Requires ``X-Api-Key`` header when RUNNER_API_KEY is set.
    """
    if RUNNER_API_KEY and x_api_key != RUNNER_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")

    # Block runner registration when the org's subscription is inactive
    await require_active_subscription(db, body.organization_id)

    runner_token = secrets.token_urlsafe(48)

    row = await db.execute_one(
        """
        INSERT INTO exec.runners
            (organization_id, runner_name, runner_token, capabilities,
             hostname, os_name, status, last_heartbeat)
        VALUES ($1, $2, $3, $4, $5, $6, 'online', NOW())
        RETURNING id
        """,
        body.organization_id,
        body.runner_name,
        runner_token,
        json.dumps(body.capabilities),
        body.hostname,
        body.os_name,
    )

    runner_id = str(row["id"])
    logger.info(
        "Runner registered: id=%s name=%s org=%s caps=%s",
        runner_id, body.runner_name, body.organization_id, body.capabilities,
    )

    return RunnerRegisterResponse(
        runner_id=runner_id,
        runner_token=runner_token,
        message="Runner registered successfully. Use the runner_token for all subsequent requests.",
    )


@router.get("/poll")
async def poll_for_work(
    runner: dict = Depends(_verify_runner_token),
    db: DatabaseManager = Depends(_get_db),
):
    """
    Long-poll style endpoint.  Returns the oldest queued execution whose
    browser type matches the runner's capabilities, or 204 No Content.

    The execution's status is atomically flipped to ``running`` so no other
    runner picks it up.
    """
    runner_id = str(runner["id"])
    org_id = str(runner["organization_id"])

    # Block work dispatch when the org's subscription is inactive
    await require_active_subscription(db, org_id)

    # Fetch runner capabilities
    cap_row = await db.execute_one(
        "SELECT capabilities FROM exec.runners WHERE id = $1", runner_id
    )
    capabilities = json.loads(cap_row["capabilities"]) if cap_row else ["chrome"]

    # Atomically claim the oldest queued run matching this runner's capabilities
    # Uses FOR UPDATE SKIP LOCKED to avoid contention between multiple runners
    # Respects assigned_runner_id: if a run is assigned to a specific runner,
    # only that runner can claim it. Unassigned runs can be claimed by any runner.
    run = await db.execute_one(
        """
        UPDATE exec.runs
        SET status = 'running',
            assigned_runner_id = $1,
            started_at = NOW()
        WHERE id = (
            SELECT id FROM exec.runs
            WHERE status = 'queued'
              AND dispatch_mode = 'agent'
              AND browser_type = ANY($2)
              AND (assigned_runner_id IS NULL OR assigned_runner_id = $1)
            ORDER BY started_at ASC NULLS FIRST, id ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        )
        RETURNING id, test_case_id, browser_type, runner_meta, project_id
        """,
        runner_id,
        capabilities,
    )

    if not run:
        raise HTTPException(status_code=204, detail="No work available")

    execution_id = str(run["id"])
    runner_meta = json.loads(run["runner_meta"]) if isinstance(run["runner_meta"], str) else (run["runner_meta"] or {})
    prompt_id = runner_meta.get("prompt_id", "")
    browser_type = run["browser_type"] or "chrome"

    # Fetch step results for this execution
    steps = await db.fetch(
        """
        SELECT id, step_order,
               action_data->>'action'      AS action,
               action_data->>'locator'     AS locator,
               action_data->>'value'       AS value,
               action_data->>'description' AS description
        FROM exec.step_results
        WHERE test_run_id = $1
        ORDER BY step_order ASC
        """,
        execution_id,
    )

    # Action name mapping: normalize frontend/AI action names to Java runner expected names
    _ACTION_MAP = {
        "open_url": "open",
        "navigate": "open",
        "assert_visible": "verify_element",
        "assert_element": "verify_element",
        "assert_text": "verify_text",
        "enter_text": "type",
        "wait_for": "wait",
        "wait_for_page_load": "wait",
        "scroll_to": "scroll",
        "hover_over": "hover",
    }

    step_list = []
    for s in steps:
        raw_action = s["action"] or ""
        mapped_action = _ACTION_MAP.get(raw_action, raw_action)
        step_list.append({
            "id": str(s["id"]),
            "step_id": f"step_{s['step_order']}",
            "action": mapped_action,
            "locator": s["locator"] or "",
            "value": s["value"] or "",
            "description": s["description"] or "",
        })

    # Load policy config and device config from runner_meta if available
    policy_config = runner_meta.get("policy_config", {})
    device_config = runner_meta.get("device_config", None)
    appium_config = runner_meta.get("appium_config", None)

    logger.info(
        "Runner %s claimed execution %s (%s, %d steps%s%s)",
        runner_id, execution_id, browser_type, len(step_list),
        f", device: {device_config.get('device_name')}" if device_config else "",
        f", appium: {appium_config.get('config_type')}" if appium_config else "",
    )

    return {
        "executionId": execution_id,
        "promptId": prompt_id,
        "browserType": browser_type,
        "deviceConfig": device_config,
        "appiumConfig": appium_config,
        "steps": step_list,
        "policyConfig": policy_config,
        "authToken": "",
    }


@router.put("/heartbeat", response_model=RunnerHeartbeatResponse)
async def heartbeat(
    runner: dict = Depends(_verify_runner_token),
    db: DatabaseManager = Depends(_get_db),
):
    """Update runner last-seen time and mark online."""
    await db.execute_one(
        """
        UPDATE exec.runners
        SET last_heartbeat = NOW(), status = 'online', updated_at = NOW()
        WHERE id = $1
        """,
        str(runner["id"]),
    )
    return RunnerHeartbeatResponse(
        status="ok",
        server_time=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/list")
async def list_runners(
    organization_id: Optional[str] = Query(None),
    db: DatabaseManager = Depends(_get_db),
):
    """List all runners, optionally filtered by org. For admin dashboards."""
    if organization_id:
        rows = await db.fetch(
            """
            SELECT id, runner_name, capabilities, hostname, os_name,
                   status, last_heartbeat, registered_at
            FROM exec.runners
            WHERE organization_id = $1
            ORDER BY registered_at DESC
            """,
            organization_id,
        )
    else:
        rows = await db.fetch(
            """
            SELECT id, organization_id, runner_name, capabilities, hostname,
                   os_name, status, last_heartbeat, registered_at
            FROM exec.runners
            ORDER BY registered_at DESC
            """
        )

    runners = []
    for r in rows:
        runner_dict = dict(r)
        runner_dict["id"] = str(runner_dict["id"])
        if "organization_id" in runner_dict:
            runner_dict["organization_id"] = str(runner_dict["organization_id"])
        # Consider runner offline if no heartbeat for 60 seconds
        if runner_dict.get("last_heartbeat"):
            if isinstance(runner_dict["last_heartbeat"], datetime):
                age = datetime.now(timezone.utc) - runner_dict["last_heartbeat"].replace(tzinfo=timezone.utc)
                if age > timedelta(seconds=60):
                    runner_dict["status"] = "offline"
        runners.append(runner_dict)

    return {"runners": runners, "count": len(runners)}


@router.delete("/{runner_id}")
async def delete_runner(
    runner_id: str,
    db: DatabaseManager = Depends(_get_db),
):
    """Delete a runner and its logs."""
    row = await db.execute_one(
        "SELECT id FROM exec.runners WHERE id = $1",
        runner_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Runner not found")

    # Delete logs first (FK), then the runner
    await db.execute_one(
        "DELETE FROM exec.runner_logs WHERE runner_id = $1 RETURNING runner_id",
        runner_id,
    ) if await db.fetchval(
        "SELECT 1 FROM information_schema.tables WHERE table_schema='exec' AND table_name='runner_logs'"
    ) else None

    # Detach this runner from any execution runs that reference it
    await db.execute(
        "UPDATE exec.runs SET assigned_runner_id = NULL WHERE assigned_runner_id = $1",
        runner_id,
    )

    await db.execute_one(
        "DELETE FROM exec.runners WHERE id = $1 RETURNING id",
        runner_id,
    )
    return {"id": runner_id, "status": "deleted"}


@router.post("/logs")
async def push_logs(
    body: LogBatch,
    runner: dict = Depends(_verify_runner_token),
    db: DatabaseManager = Depends(_get_db),
):
    """
    Runner agent pushes log lines in batches. Stored in exec.runner_logs
    for live viewing in the dashboard.
    """
    runner_id = str(runner["id"])
    for entry in body.logs:
        # Parse timestamp string to datetime; asyncpg requires a datetime object not a str.
        # Java runner sends nanosecond precision (e.g. "2026-04-12T20:02:15.650808800Z") which
        # Python's fromisoformat can't parse directly — truncate to microseconds first.
        ts = None
        if entry.timestamp:
            try:
                from datetime import datetime as _dt
                import re as _re
                # Replace nanoseconds (>6 decimal digits) with microseconds
                ts_str = _re.sub(r'(\.\d{6})\d+', r'\1', entry.timestamp).replace('Z', '+00:00')
                ts = _dt.fromisoformat(ts_str)
            except Exception:
                ts = None

        await db.execute_one(
            """
            INSERT INTO exec.runner_logs (runner_id, execution_id, log_level, message, logged_at)
            VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()))
            RETURNING id
            """,
            runner_id,
            entry.execution_id,
            entry.level.upper()[:10],
            entry.message[:4000],  # cap length
            ts,
        )
    return {"status": "ok", "accepted": len(body.logs)}


@router.get("/logs/{runner_id}")
async def get_runner_logs(
    runner_id: str,
    execution_id: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    after_id: Optional[int] = Query(None, description="Return logs with id > after_id for live tailing"),
    db: DatabaseManager = Depends(_get_db),
):
    """
    Fetch logs for a specific runner. Supports:
    - Filtering by execution_id
    - Live tailing via after_id (returns only newer logs)
    """
    conditions = ["runner_id = $1"]
    params: list = [runner_id]
    idx = 2

    if execution_id:
        conditions.append(f"execution_id = ${idx}")
        params.append(execution_id)
        idx += 1

    if after_id is not None:
        conditions.append(f"id > ${idx}")
        params.append(after_id)
        idx += 1

    where = " AND ".join(conditions)

    rows = await db.fetch(
        f"""
        SELECT id, execution_id, log_level, message, logged_at
        FROM exec.runner_logs
        WHERE {where}
        ORDER BY logged_at ASC, id ASC
        LIMIT ${idx}
        """,
        *params,
        limit,
    )

    logs = []
    for r in rows:
        logs.append({
            "id": r["id"],
            "execution_id": str(r["execution_id"]) if r["execution_id"] else None,
            "level": r["log_level"],
            "message": r["message"],
            "timestamp": r["logged_at"].isoformat() if r["logged_at"] else None,
        })

    return {"logs": logs, "count": len(logs)}


# ---------------------------------------------------------------------------
# Runner Download
# ---------------------------------------------------------------------------

@router.get("/download")
async def download_runner():
    """Build and serve the runner agent ZIP on-the-fly from the java-runner build artifacts."""
    # Resolve java-runner directory relative to unified-api
    base = Path(__file__).resolve().parent.parent.parent / "java-runner"
    jar_path = base / "target" / "self-healing-test-framework-1.0-SNAPSHOT.jar"
    
    if not jar_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Runner JAR not found. Run build-agent.bat in services/java-runner/ first."
        )
    
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # JAR
        zf.write(jar_path, "self-healing-runner/runner.jar")
        
        # runner-config.properties
        config_content = """\
# Self-Healing Runner Agent Configuration
# Edit these values before first run.

# Your platform API URL
runner.api-url=http://localhost:8000

# Your organization ID (from the web dashboard)
runner.organization-id=

# Runner name (leave blank for auto hostname)
runner.name=

# API key (if required by your server)
runner.api-key=

# Browsers this runner supports
# (comma-separated: chrome,firefox,edge,chrome-mobile,chrome-tablet,
#  appium-android-web,appium-ios-web,appium-android-native,
#  appium-ios-native,appium-flutter,appium-windows,appium-mac)
runner.capabilities=chrome

# Run browsers in headless mode? (true/false)
HEADLESS=false

# Appium server URL (required for appium-* capabilities)
# runner.appium-server-url=http://localhost:4723

# Auto-start Appium server when runner starts (true/false)
# runner.appium-auto-start=true

# Port for health check endpoint
server.port=8080
"""
        zf.writestr("self-healing-runner/runner-config.properties", config_content)
        
        # start-runner.bat (Windows)
        bat_content = """\
@echo off
REM Self-Healing Test Runner Agent
REM Edit runner-config.properties before first run.

setlocal
set "RUNNER_DIR=%~dp0"

REM Use bundled JRE if present, otherwise system Java
if exist "%RUNNER_DIR%jre\\bin\\java.exe" (
    set "JAVA=%RUNNER_DIR%jre\\bin\\java.exe"
) else (
    set "JAVA=java"
)

echo Starting Self-Healing Test Runner Agent...

"%JAVA%" -Xms256m -Xmx512m ^
  -jar "%RUNNER_DIR%runner.jar" ^
  --spring.profiles.active=agent ^
  --spring.config.additional-location="file:%RUNNER_DIR%runner-config.properties"

if errorlevel 1 (
    echo.
    echo Runner exited with an error. Check logs/ for details.
    pause
)
"""
        zf.writestr("self-healing-runner/start-runner.bat", bat_content)
        
        # start-runner.sh (Mac/Linux)
        sh_content = """\
#!/usr/bin/env bash
# Self-Healing Test Runner Agent
# Edit runner-config.properties before first run.

RUNNER_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -x "$RUNNER_DIR/jre/bin/java" ]; then
    JAVA="$RUNNER_DIR/jre/bin/java"
else
    JAVA="java"
fi

echo "Starting Self-Healing Test Runner Agent..."

"$JAVA" -Xms256m -Xmx512m \\
  -jar "$RUNNER_DIR/runner.jar" \\
  --spring.profiles.active=agent \\
  --spring.config.additional-location="file:$RUNNER_DIR/runner-config.properties"
"""
        zf.writestr("self-healing-runner/start-runner.sh", sh_content)
        
        # README
        readme = """\
# Self-Healing Test Runner Agent

## Quick Start

1. Edit `runner-config.properties` — set your API URL and organization ID.
2. Double-click `start-runner.bat` (Windows) or run `chmod +x start-runner.sh && ./start-runner.sh` (Mac/Linux).
3. The runner registers with your platform and starts polling for work.

## Requirements

- Chrome, Firefox, or Edge installed on this machine
- Java 17+ (or place a JRE in the jre/ folder)
- Outbound access to your platform API

## Mobile & Tablet Emulation

This runner supports Chrome-based mobile and tablet emulation.
Set `runner.capabilities=chrome-mobile,chrome-tablet` in config to advertise
mobile support. Device profiles are managed via the web dashboard and passed
automatically when tests are executed with a device profile selected.

## Appium Testing

For real-device and desktop app testing, this runner supports Appium integration.
Add the desired Appium capabilities to `runner.capabilities`:

- `appium-android-web` — Android mobile browser via Appium
- `appium-ios-web` — iOS Safari via Appium
- `appium-android-native` — Android native app (UiAutomator2)
- `appium-ios-native` — iOS native app (XCUITest)
- `appium-flutter` — Flutter app testing
- `appium-windows` — Windows desktop app (WinAppDriver)
- `appium-mac` — Mac desktop app (Mac2)

Prerequisites for Appium capabilities:
- Appium server running locally or a cloud endpoint (BrowserStack, Sauce Labs)
- Configure `runner.appium-server-url` in properties
- Appium configurations are managed in the web dashboard under Appium Testing
"""
        zf.writestr("self-healing-runner/README.md", readme)
    
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=self-healing-runner.zip"}
    )
