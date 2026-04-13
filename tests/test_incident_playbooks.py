"""
Phase 4: Incident Playbook Runner
===================================
Executable playbooks for the critical failure scenarios documented in
docs/runbook.md. Each playbook codifies the diagnostic and remediation
steps so on-call responders can run them directly.

Playbooks:
  1. High Queue Depth  services backlogged
  2. MCP Server Unresponsive  WebSocket bridge down
  3. Element Miss Rate Elevated  healing degradation
  4. Unified API Unhealthy  primary backend failure
  5. Database Connectivity Lost  PostgreSQL unreachable
  6. Java Runner Timeout  execution engine stalled

Environment variables:
  API_BASE_URL, MCP_BASE_URL, RUNNER_BASE_URL, FRONTEND_BASE_URL
  DB_HOST, DB_PORT
  COMPOSE_FILE, DOCKER_CMD
"""

import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")
MCP_BASE = os.getenv("MCP_BASE_URL", "http://localhost:8001")
RUNNER_BASE = os.getenv("RUNNER_BASE_URL", "http://localhost:8080")
FRONTEND_BASE = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
COMPOSE_FILE = os.getenv("COMPOSE_FILE", "docker-compose.local.yml")
DOCKER = os.getenv("DOCKER_CMD", "docker")
REPORT_PATH = os.getenv("REPORT_PATH", "phase4_incident_playbook_report.json")

REPO_ROOT = os.path.join(os.path.dirname(__file__), "..")

results: list[dict] = []


def _record(playbook: str, step: str, status: str, detail: str = ""):
    """status: ok | warn | fail | info"""
    results.append({"playbook": playbook, "step": step, "status": status, "detail": detail})
    icons = {"ok": "OK  ", "warn": "WARN", "fail": "FAIL", "info": "INFO"}
    print(f"  [{icons.get(status, '????')}] [{playbook}] {step}")
    if detail:
        print(f"         {detail}")


def _get(url: str, timeout: int = 10) -> tuple[int, float]:
    start = time.time()
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, (time.time() - start) * 1000
    except urllib.error.HTTPError as exc:
        return exc.code, (time.time() - start) * 1000
    except Exception:
        return 0, (time.time() - start) * 1000


def _tcp_check(host: str, port: int, timeout: int = 5) -> bool:
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        sock.close()
        return True
    except Exception:
        return False


def _compose(*args: str) -> tuple[int, str, str]:
    cmd = [DOCKER, "compose", "-f", COMPOSE_FILE] + list(args)
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60, cwd=REPO_ROOT)
        return r.returncode, r.stdout, r.stderr
    except Exception as exc:
        return 1, "", str(exc)


# ---------------------------------------------------------------------------
# Playbook 1: High Queue Depth
# ---------------------------------------------------------------------------
def playbook_high_queue_depth():
    """Diagnose and verify queue health via API metrics."""
    name = "high-queue-depth"

    # Step 1: Check API health (queue consumers depend on API)
    status, latency = _get(f"{API_BASE}/health")
    if status == 200:
        _record(name, "API health check", "ok", f"status={status} latency={latency:.0f}ms")
    else:
        _record(name, "API health check", "fail",
                f"status={status}  API down, queues cannot drain")
        return

    # Step 2: Check execution endpoint responsiveness (proxy for queue processing)
    status, latency = _get(f"{API_BASE}/api/executions")
    if status in (200, 401, 403):
        _record(name, "Execution endpoint responsive", "ok", f"status={status}")
    else:
        _record(name, "Execution endpoint responsive", "warn",
                f"status={status}  possible queue backlog")

    # Step 3: Check Java runner (execution consumer)
    status, latency = _get(f"{RUNNER_BASE}/health")
    if status == 200:
        _record(name, "Java runner healthy", "ok", f"latency={latency:.0f}ms")
    else:
        _record(name, "Java runner healthy", "fail",
                "Runner down  executions will queue up. Remediation: restart java-runner container")

    # Step 4: Remediation guidance
    _record(name, "Remediation", "info",
            "If queue depth >100: scale exec workers or restart java-runner. "
            "If queue depth >1000: enable load shedding (reject new jobs).")


# ---------------------------------------------------------------------------
# Playbook 2: MCP Server Unresponsive
# ---------------------------------------------------------------------------
def playbook_mcp_unresponsive():
    """Diagnose MCP server connectivity and WebSocket health."""
    name = "mcp-unresponsive"

    # Step 1: TCP connectivity
    host = MCP_BASE.replace("http://", "").split(":")[0]
    port = int(MCP_BASE.rsplit(":", 1)[1])
    reachable = _tcp_check(host, port)
    if reachable:
        _record(name, "MCP port reachable", "ok", f"{host}:{port}")
    else:
        _record(name, "MCP port reachable", "fail",
                f"{host}:{port} unreachable. Container may be crashed. "
                "Remediation: docker compose restart mcp-server")
        return

    # Step 2: HTTP health
    status, latency = _get(f"{MCP_BASE}/mcp/health")
    if status == 200:
        _record(name, "MCP /mcp/health responds", "ok", f"latency={latency:.0f}ms")
    else:
        _record(name, "MCP /mcp/health responds", "fail",
                f"status={status}. Process may be stuck. "
                "Remediation: docker compose restart mcp-server")

    # Step 3: Check MCP's upstream dependency (unified-api)
    status, _ = _get(f"{API_BASE}/health")
    if status == 200:
        _record(name, "MCP upstream (unified-api) healthy", "ok")
    else:
        _record(name, "MCP upstream (unified-api) healthy", "warn",
                "MCP depends on unified-api. Fix API first.")

    # Step 4: Remediation guidance
    _record(name, "Remediation", "info",
            "1) Restart MCP: docker compose restart mcp-server. "
            "2) If persists, check logs: docker compose logs mcp-server --tail=100. "
            "3) If upstream: fix unified-api first.")


# ---------------------------------------------------------------------------
# Playbook 3: Element Miss Rate Elevated
# ---------------------------------------------------------------------------
def playbook_element_miss_rate():
    """Diagnose elevated element miss rates (healing degradation)."""
    name = "element-miss-rate"

    # Step 1: Check healing endpoint
    status, latency = _get(f"{API_BASE}/api/healing/stats")
    if status in (200, 401, 403):
        _record(name, "Healing stats endpoint reachable", "ok", f"status={status}")
    elif status == 404:
        _record(name, "Healing stats endpoint reachable", "warn",
                "Endpoint not found. Healing metrics not exposed.")
    else:
        _record(name, "Healing stats endpoint reachable", "fail", f"status={status}")

    # Step 2: Check Java runner (produces healing data)
    status, latency = _get(f"{RUNNER_BASE}/health")
    if status == 200:
        _record(name, "Java runner operational", "ok", f"latency={latency:.0f}ms")
    else:
        _record(name, "Java runner operational", "fail",
                "Runner down  no healing data produced")

    # Step 3: Remediation
    _record(name, "Remediation", "info",
            "If miss rate >15%: 1) Check element repository for stale selectors. "
            "2) Review recent DOM changes in target application. "
            "3) Verify healing policy thresholds via /api/policies. "
            "4) If rate >30%, pause auto-healing and trigger manual review.")


# ---------------------------------------------------------------------------
# Playbook 4: Unified API Unhealthy
# ---------------------------------------------------------------------------
def playbook_api_unhealthy():
    """Full diagnostic for unified API failures."""
    name = "api-unhealthy"

    # Step 1: Health check
    status, latency = _get(f"{API_BASE}/health")
    if status == 200:
        _record(name, "API /health responds", "ok", f"latency={latency:.0f}ms")
        return  # API is fine
    _record(name, "API /health responds", "fail", f"status={status} latency={latency:.0f}ms")

    # Step 2: Check database (most common root cause)
    db_up = _tcp_check(DB_HOST, DB_PORT)
    if db_up:
        _record(name, "Database reachable", "ok")
    else:
        _record(name, "Database reachable", "fail",
                f"PostgreSQL at {DB_HOST}:{DB_PORT} unreachable. "
                "This is the most common cause of API failures.")

    # Step 3: Check container status
    rc, out, _ = _compose("ps", "unified-api")
    if "running" in out.lower() or "up" in out.lower():
        _record(name, "Container status", "warn",
                "Container running but health failing  application-level issue")
    else:
        _record(name, "Container status", "fail",
                "Container not running. Remediation: docker compose up -d unified-api")

    # Step 4: Remediation
    _record(name, "Remediation", "info",
            "1) Check DB first: verify PostgreSQL is running. "
            "2) Check logs: docker compose logs unified-api --tail=200. "
            "3) Restart: docker compose restart unified-api. "
            "4) If DB schema issue: check migration status.")


# ---------------------------------------------------------------------------
# Playbook 5: Database Connectivity Lost
# ---------------------------------------------------------------------------
def playbook_database_down():
    """Diagnose PostgreSQL connectivity failure."""
    name = "database-down"

    # Step 1: TCP check
    db_up = _tcp_check(DB_HOST, DB_PORT)
    if db_up:
        _record(name, "PostgreSQL port reachable", "ok", f"{DB_HOST}:{DB_PORT}")
    else:
        _record(name, "PostgreSQL port reachable", "fail",
                f"{DB_HOST}:{DB_PORT} unreachable")

    # Step 2: Impact assessment
    api_status, _ = _get(f"{API_BASE}/health")
    mcp_status, _ = _get(f"{MCP_BASE}/mcp/health")
    _record(name, "Impact: API status", "ok" if api_status == 200 else "fail",
            f"status={api_status}")
    _record(name, "Impact: MCP status", "ok" if mcp_status == 200 else "warn",
            f"status={mcp_status}")

    # Step 3: Remediation
    _record(name, "Remediation", "info",
            "1) Check container: docker compose ps postgres. "
            "2) Check disk space on DB host. "
            "3) Check connection count: SELECT count(*) FROM pg_stat_activity. "
            "4) Restart: docker compose restart postgres. "
            "5) If data corruption: restore from latest backup (see backup_restore_drill).")


# ---------------------------------------------------------------------------
# Playbook 6: Java Runner Timeout
# ---------------------------------------------------------------------------
def playbook_runner_timeout():
    """Diagnose Java runner execution timeouts."""
    name = "runner-timeout"

    # Step 1: Health check
    status, latency = _get(f"{RUNNER_BASE}/health")
    if status == 200:
        _record(name, "Runner /health responds", "ok", f"latency={latency:.0f}ms")
    else:
        _record(name, "Runner /health responds", "fail", f"status={status}")

    # Step 2: Check if runner can reach API (its upstream)
    status, latency = _get(f"{API_BASE}/health")
    if status == 200:
        _record(name, "Runner upstream (unified-api) healthy", "ok")
    else:
        _record(name, "Runner upstream (unified-api) healthy", "fail",
                "Runner reports back to API. Fix API first.")

    # Step 3: Check response time (slow responses suggest resource exhaustion)
    status, latency = _get(f"{RUNNER_BASE}/health")
    if latency > 5000:
        _record(name, "Runner response time", "fail",
                f"latency={latency:.0f}ms  possible resource exhaustion")
    elif latency > 2000:
        _record(name, "Runner response time", "warn",
                f"latency={latency:.0f}ms  elevated")
    else:
        _record(name, "Runner response time", "ok", f"latency={latency:.0f}ms")

    # Step 4: Remediation
    _record(name, "Remediation", "info",
            "1) Check thread pool: max 10 concurrent executions (FixedThreadPool). "
            "2) Hard timeout is 30s to API. "
            "3) If consistently timing out: docker compose restart java-runner. "
            "4) Check browser availability (Selenium needs Chrome/Firefox). "
            "5) If resource-constrained: increase memory limit (selfhost: 2g default).")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("Phase 4  Incident Playbook Runner")
    print("=" * 60)

    playbooks = [
        ("1. High Queue Depth", playbook_high_queue_depth),
        ("2. MCP Unresponsive", playbook_mcp_unresponsive),
        ("3. Element Miss Rate", playbook_element_miss_rate),
        ("4. API Unhealthy", playbook_api_unhealthy),
        ("5. Database Down", playbook_database_down),
        ("6. Runner Timeout", playbook_runner_timeout),
    ]

    for title, fn in playbooks:
        print(f"\n--- Playbook: {title} ---")
        fn()

    # Summary
    ok = sum(1 for r in results if r["status"] == "ok")
    warn = sum(1 for r in results if r["status"] == "warn")
    fail = sum(1 for r in results if r["status"] == "fail")
    info = sum(1 for r in results if r["status"] == "info")
    total = len(results)

    print(f"\n{'=' * 60}")
    print(f"Playbook Results: {ok} ok, {warn} warn, {fail} fail, {info} info / {total} total")

    report = {
        "phase": "phase4-incident-playbooks",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": {"total": total, "ok": ok, "warn": warn, "fail": fail, "info": info},
        "results": results,
    }
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Report written to {REPORT_PATH}")

    # Playbooks are diagnostic  fail only if critical services unreachable
    return 1 if fail > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
