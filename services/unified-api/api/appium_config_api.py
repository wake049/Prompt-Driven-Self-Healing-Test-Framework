"""
Appium Configuration API — CRUD for Appium server & capability profiles.

Each configuration defines how the Java runner connects to an Appium server
and which capabilities to pass (platform, device, app, automation engine, etc.).
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import uuid
import os
import json as _json

from core.auth import get_current_active_user
from models.auth_models import CurrentUser
from core.database import get_database

logger = logging.getLogger(__name__)
router = APIRouter()

BUILTIN_ORG_ID = "00000000-0000-0000-0000-000000000000"
VALID_CONFIG_TYPES = {
    "android-web", "ios-web", "android-native", "ios-native",
    "flutter", "windows", "mac",
}

# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------
@router.get("")
async def list_appium_configs(
    config_type: Optional[str] = Query(None, description="Filter by config type"),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    """Return all Appium configs for the user's org plus built-in templates."""
    db = await get_database()
    org_id = str(current_user.tenant.id) if current_user.tenant else BUILTIN_ORG_ID

    sql = """
        SELECT * FROM exec.appium_configs
        WHERE organization_id IN ($1::uuid, $2::uuid)
    """
    args: list = [org_id, BUILTIN_ORG_ID]

    if config_type:
        sql += " AND config_type = $3"
        args.append(config_type)

    sql += " ORDER BY is_default DESC, name ASC"

    rows = await db.fetch(sql, *args)
    return [_row_to_dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Get
# ---------------------------------------------------------------------------
@router.get("/{config_id}")
async def get_appium_config(
    config_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
):
    row = await _get_config_row(config_id, current_user)
    return _row_to_dict(row)


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------
@router.post("", status_code=201)
async def create_appium_config(
    body: Dict[str, Any],
    current_user: CurrentUser = Depends(get_current_active_user),
):
    config_type = body.get("config_type", "")
    if config_type not in VALID_CONFIG_TYPES:
        raise HTTPException(400, f"Invalid config_type. Must be one of: {VALID_CONFIG_TYPES}")

    config_id = str(uuid.uuid4())
    if not current_user.tenant:
        raise HTTPException(403, "No tenant context available")
    org_id = str(current_user.tenant.id)

    db = await get_database()
    await db.execute("""
        INSERT INTO exec.appium_configs (
            id, organization_id, name, config_type,
            appium_server_url, platform_name, platform_version,
            device_name, automation_name,
            app_path, app_package, app_activity, bundle_id,
            browser_name, cloud_provider, cloud_username, cloud_access_key,
            extra_capabilities, is_default
        ) VALUES (
            $1::uuid, $2::uuid, $3, $4,
            $5, $6, $7,
            $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17,
            $18::jsonb, $19
        )
    """,
        config_id, org_id,
        body.get("name", "Untitled Config"), config_type,
        body.get("appium_server_url", "http://localhost:4723"),
        body.get("platform_name"), body.get("platform_version"),
        body.get("device_name"), body.get("automation_name"),
        body.get("app_path"), body.get("app_package"),
        body.get("app_activity"), body.get("bundle_id"),
        body.get("browser_name"),
        body.get("cloud_provider"), body.get("cloud_username"),
        body.get("cloud_access_key"),
        _json_or_empty(body.get("extra_capabilities")),
        body.get("is_default", False),
    )

    return {"id": config_id, "status": "created"}


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------
@router.put("/{config_id}")
async def update_appium_config(
    config_id: str,
    body: Dict[str, Any],
    current_user: CurrentUser = Depends(get_current_active_user),
):
    row = await _get_config_row(config_id, current_user)
    if str(row["organization_id"]) == BUILTIN_ORG_ID:
        raise HTTPException(403, "Built-in template configs cannot be modified")

    allowed = [
        "name", "config_type", "appium_server_url",
        "platform_name", "platform_version", "device_name", "automation_name",
        "app_path", "app_package", "app_activity", "bundle_id",
        "browser_name", "cloud_provider", "cloud_username", "cloud_access_key",
        "extra_capabilities", "is_default",
    ]

    sets = []
    vals = []
    param_idx = 1
    for key in allowed:
        if key in body:
            if key == "extra_capabilities":
                sets.append(f"{key} = ${param_idx}::jsonb")
                vals.append(_json_or_empty(body[key]))
            else:
                sets.append(f"{key} = ${param_idx}")
                vals.append(body[key])
            param_idx += 1

    if not sets:
        raise HTTPException(400, "No valid fields to update")

    sets.append("updated_at = NOW()")
    vals.append(config_id)

    db = await get_database()
    await db.execute(
        f"UPDATE exec.appium_configs SET {', '.join(sets)} WHERE id = ${param_idx}::uuid",
        *vals,
    )
    return {"id": config_id, "status": "updated"}


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------
@router.delete("/{config_id}")
async def delete_appium_config(
    config_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
):
    row = await _get_config_row(config_id, current_user)
    if str(row["organization_id"]) == BUILTIN_ORG_ID:
        raise HTTPException(403, "Built-in template configs cannot be deleted")

    db = await get_database()
    await db.execute("DELETE FROM exec.appium_configs WHERE id = $1::uuid", config_id)
    return {"id": config_id, "status": "deleted"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _get_config_row(config_id: str, user: CurrentUser):
    db = await get_database()
    row = await db.fetchrow(
        "SELECT * FROM exec.appium_configs WHERE id = $1::uuid", config_id
    )
    if not row:
        raise HTTPException(404, "Appium config not found")
    d = dict(row)
    org = str(d["organization_id"])
    user_org = str(user.tenant.id) if user.tenant else None
    if org != BUILTIN_ORG_ID and org != user_org:
        raise HTTPException(403, "Access denied")
    return d


def _row_to_dict(row) -> dict:
    if row is None:
        return {}
    d = dict(row)
    for k in ("id", "organization_id"):
        if k in d:
            d[k] = str(d[k])
    for k in ("created_at", "updated_at"):
        if k in d and d[k]:
            d[k] = d[k].isoformat()
    return d


def _json_or_empty(val) -> str:
    import json
    if val is None:
        return "{}"
    if isinstance(val, str):
        return val
    return json.dumps(val)


# Type → browser type mapping for the Java runner
_CONFIG_TO_BROWSER = {
    "android-web":    "appium-android-web",
    "ios-web":        "appium-ios-web",
    "android-native": "appium-android-native",
    "ios-native":     "appium-ios-native",
    "flutter":        "appium-flutter",
    "windows":        "appium-windows",
    "mac":            "appium-mac",
}


# ---------------------------------------------------------------------------
# Test Connection — check Appium server + device connectivity
# ---------------------------------------------------------------------------
@router.post("/{config_id}/test-connection")
async def test_connection(
    config_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
):
    """Check whether the Appium server is reachable and devices are connected."""
    import httpx

    row = await _get_config_row(config_id, current_user)
    appium_server_url = row.get("appium_server_url") or "http://localhost:4723"

    java_runner_url = os.getenv("JAVA_RUNNER_URL", "http://localhost:8080")
    target = f"{java_runner_url}/api/v1/check-appium-connection"

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.post(target, json={"appiumServerUrl": appium_server_url})
            if not resp.text:
                return {
                    "success": False, "connected": False, "server_reachable": False,
                    "server_error": f"Runner returned empty response (status {resp.status_code})",
                    "android_devices": [], "has_devices": False, "appium_server_url": appium_server_url,
                }
            return resp.json()
    except httpx.ConnectError:
        return {
            "success": False,
            "connected": False,
            "server_reachable": False,
            "server_error": "Cannot reach the Java runner. Is it running?",
            "android_devices": [],
            "has_devices": False,
            "appium_server_url": appium_server_url,
        }
    except Exception as e:
        logger.error("test_connection exception: %s", e)
        return {
            "success": False,
            "connected": False,
            "server_reachable": False,
            "server_error": f"{type(e).__name__}: {e}",
            "android_devices": [],
            "has_devices": False,
            "appium_server_url": appium_server_url,
        }


# ---------------------------------------------------------------------------
# Gather Elements — one-click screen scan via Appium
# ---------------------------------------------------------------------------
@router.post("/{config_id}/gather-elements")
async def gather_elements(
    config_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
):
    """
    Spin up a short-lived Appium session using the given config, scan every
    visible element on the current screen, store them in repo.elements, and
    return the results.  The session is torn down automatically afterwards.
    """
    import httpx

    # 1. Resolve the Appium config
    row = await _get_config_row(config_id, current_user)
    config_type = row["config_type"]
    browser_type = _CONFIG_TO_BROWSER.get(config_type)
    if not browser_type:
        raise HTTPException(400, f"Unsupported config_type: {config_type}")

    # Build the config dict the runner expects
    appium_config: Dict[str, Any] = {
        "appium_server_url": row.get("appium_server_url") or "http://localhost:4723",
        "platform_name":     row.get("platform_name") or "",
        "platform_version":  row.get("platform_version") or "",
        "device_name":       row.get("device_name") or "",
        "automation_name":   row.get("automation_name") or "",
        "app_path":          row.get("app_path") or "",
        "app_package":       row.get("app_package") or "",
        "app_activity":      row.get("app_activity") or "",
        "bundle_id":         row.get("bundle_id") or "",
        "browser_name":      row.get("browser_name") or "",
        "no_reset":          True,  # keep existing app state
    }
    # Merge extra capabilities
    extras = row.get("extra_capabilities")
    if extras:
        if isinstance(extras, str):
            extras = _json.loads(extras)
        if isinstance(extras, dict):
            appium_config["extra_capabilities"] = extras

    # Cloud provider
    if row.get("cloud_provider"):
        appium_config["cloud_provider"]  = row["cloud_provider"]
        appium_config["cloud_username"]  = row.get("cloud_username") or ""
        appium_config["cloud_access_key"]= row.get("cloud_access_key") or ""

    # 2. Forward to the Java runner
    java_runner_url = os.getenv("JAVA_RUNNER_URL", "http://localhost:8080")
    runner_timeout = float(os.getenv("RUNNER_TIMEOUT", "600"))
    target = f"{java_runner_url}/api/v1/gather-elements"
    payload = {
        "browserType": browser_type,
        "appiumConfig": appium_config,
    }

    logger.info("Gather-elements → %s  config=%s type=%s  timeout=%ss", target, config_id, config_type, runner_timeout)

    try:
        async with httpx.AsyncClient(timeout=runner_timeout) as client:
            resp = await client.post(target, json=payload)
            runner_result = resp.json()
    except httpx.ConnectError:
        raise HTTPException(502, "Cannot reach the Java runner. Is it running?")
    except httpx.ReadTimeout:
        raise HTTPException(504, f"Runner timed out while gathering elements ({runner_timeout}s limit)")
    except Exception as e:
        raise HTTPException(502, f"Runner communication error: {str(e)}")

    if not runner_result.get("success"):
        raise HTTPException(502, runner_result.get("error", "Unknown runner error"))

    # 3. Store gathered elements in repo.elements
    elements = runner_result.get("elements", [])
    page_info = runner_result.get("pageInfo", {})
    page_name = (
        page_info.get("page_title")
        or page_info.get("url")
        or f"appium-{config_type}-screen"
    )

    stored_count = 0
    db = await get_database()
    project_id = str(current_user.project.id) if current_user.project else None
    if project_id:
        try:
            # Ensure page record exists
            page_row = await db.fetchrow(
                """
                INSERT INTO repo.pages (project_id, name, route_hint, tags)
                VALUES ($1::uuid, $2, $3, $4::jsonb)
                ON CONFLICT (project_id, name) DO UPDATE SET updated_at = NOW()
                RETURNING id
                """,
                project_id, page_name, page_name, "[]",
            )
            page_id = page_row["id"]

            for elem in elements:
                selectors = elem.get("selectors", {})
                attrs = elem.get("attributes", {})
                attrs["tag"] = elem.get("tag", "")
                if elem.get("text"):
                    attrs["text"] = elem["text"]
                attrs["interactive"] = str(elem.get("interactive", False))

                primary = {}
                if "accessibility_id" in selectors:
                    primary["accessibility_id"] = selectors["accessibility_id"]
                elif "id" in selectors:
                    primary["id"] = selectors["id"]
                elif "xpath" in selectors:
                    primary["xpath"] = selectors["xpath"]

                fallbacks = []
                for k, v in selectors.items():
                    if {k: v} != primary:
                        fallbacks.append({k: v})

                element_key = (
                    selectors.get("accessibility_id")
                    or selectors.get("id")
                    or selectors.get("name")
                    or f"element_{elem.get('index', stored_count)}"
                )

                await db.execute(
                    """
                    INSERT INTO repo.elements (page_id, name, primary_selector,
                                               fallback_selectors, attributes, is_active)
                    VALUES ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::jsonb, true)
                    ON CONFLICT (page_id, name) DO UPDATE
                        SET primary_selector = EXCLUDED.primary_selector,
                            fallback_selectors = EXCLUDED.fallback_selectors,
                            attributes = EXCLUDED.attributes,
                            updated_at = NOW()
                    """,
                    str(page_id),
                    element_key,
                    _json.dumps(primary),
                    _json.dumps(fallbacks),
                    _json.dumps(attrs),
                )
                stored_count += 1
        except Exception as e:
            logger.warning("Failed to store some elements: %s", e)

    stats = runner_result.get("stats", {})
    return {
        "success": True,
        "config_id": config_id,
        "config_type": config_type,
        "page_name": page_name,
        "page_info": page_info,
        "stats": {
            **stats,
            "stored_count": stored_count,
        },
        "elements": elements,
    }
