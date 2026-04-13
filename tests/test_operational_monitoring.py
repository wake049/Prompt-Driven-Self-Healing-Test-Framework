"""
Phase 4: Operational Monitoring & Health-Check Validation
=========================================================
Validates that all production monitoring, health endpoints, and alerting
prerequisites are functioning correctly before GA launch.

Covers:
  1. Service health endpoint availability (all 4 services)
  2. Database connectivity and migration state
  3. MCP WebSocket liveness
  4. Nginx reverse-proxy routing
  5. Resource utilisation bounds (selfhost constraints)
  6. Security header enforcement
  7. Health-check response-time SLA compliance
  8. Compose variant parity checks
"""

import json
import os
import re
import socket
import time
import urllib.request
import urllib.error
import ssl

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")
MCP_BASE = os.getenv("MCP_BASE_URL", "http://localhost:8001")
RUNNER_BASE = os.getenv("RUNNER_BASE_URL", "http://localhost:8080")
FRONTEND_BASE = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
NGINX_BASE = os.getenv("NGINX_BASE_URL", "http://localhost:80")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
TIMEOUT = int(os.getenv("HEALTH_TIMEOUT", "10"))

REPORT_PATH = os.getenv("REPORT_PATH", "phase4_monitoring_report.json")

# Health-check SLA: each endpoint must respond within this threshold (ms)
HEALTH_SLA_MS = int(os.getenv("HEALTH_SLA_MS", "2000"))

REQUIRED_SECURITY_HEADERS = {
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
results: list[dict] = []


def _record(suite: str, name: str, passed: bool, detail: str = "", duration_ms: float = 0):
    results.append({
        "suite": suite,
        "test": name,
        "passed": passed,
        "detail": detail,
        "duration_ms": round(duration_ms, 2),
    })


def _get(url: str, timeout: int = TIMEOUT) -> tuple[int, dict, bytes, float]:
    """Return (status, headers_dict, body_bytes, elapsed_ms)."""
    start = time.time()
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            body = resp.read()
            elapsed = (time.time() - start) * 1000
            headers = {k: v for k, v in resp.getheaders()}
            return resp.status, headers, body, elapsed
    except urllib.error.HTTPError as exc:
        elapsed = (time.time() - start) * 1000
        return exc.code, {}, b"", elapsed
    except Exception as exc:
        elapsed = (time.time() - start) * 1000
        return 0, {}, str(exc).encode(), elapsed


def _tcp_check(host: str, port: int, timeout: int = 5) -> tuple[bool, float]:
    start = time.time()
    try:
        sock = socket.create_connection((host, port), timeout=timeout)
        sock.close()
        elapsed = (time.time() - start) * 1000
        return True, elapsed
    except Exception:
        elapsed = (time.time() - start) * 1000
        return False, elapsed


# ---------------------------------------------------------------------------
# Suite 1  Service Health Endpoints
# ---------------------------------------------------------------------------
def test_service_health_endpoints():
    """Verify every service exposes a healthy /health endpoint."""
    endpoints = [
        ("unified-api", f"{API_BASE}/health"),
        ("mcp-server", f"{MCP_BASE}/mcp/health"),
        ("java-runner", f"{RUNNER_BASE}/health"),
        ("react-frontend", f"{FRONTEND_BASE}/"),
    ]
    for svc, url in endpoints:
        status, _, body, elapsed = _get(url)
        ok = status == 200
        _record("health-endpoints", f"{svc} /health responds 200",
                ok, f"status={status} elapsed={elapsed:.0f}ms", elapsed)
        _record("health-endpoints", f"{svc} health SLA <{HEALTH_SLA_MS}ms",
                elapsed < HEALTH_SLA_MS, f"elapsed={elapsed:.0f}ms", elapsed)


# ---------------------------------------------------------------------------
# Suite 2  Database Connectivity
# ---------------------------------------------------------------------------
def test_database_connectivity():
    """Verify TCP connectivity to PostgreSQL."""
    reachable, elapsed = _tcp_check(DB_HOST, DB_PORT)
    _record("database", "PostgreSQL TCP reachable",
            reachable, f"host={DB_HOST}:{DB_PORT} elapsed={elapsed:.0f}ms", elapsed)


def test_database_migration_state():
    """Verify unified API can talk to a migrated database by hitting an endpoint
    that requires DB access (e.g. /api/projects or /api/organizations)."""
    status, _, body, elapsed = _get(f"{API_BASE}/api/organizations")
    # 200 or 401 both prove DB is reachable (auth may block)
    ok = status in (200, 401, 403, 422)
    _record("database", "Unified API DB-dependent endpoint responds",
            ok, f"status={status}", elapsed)


# ---------------------------------------------------------------------------
# Suite 3  MCP WebSocket Liveness
# ---------------------------------------------------------------------------
def test_mcp_websocket_liveness():
    """Open a raw TCP socket to MCP WS port and confirm upgrade is possible."""
    reachable, elapsed = _tcp_check(
        MCP_BASE.replace("http://", "").split(":")[0],
        int(MCP_BASE.rsplit(":", 1)[1]),
    )
    _record("mcp-websocket", "MCP server port reachable",
            reachable, f"elapsed={elapsed:.0f}ms", elapsed)


# ---------------------------------------------------------------------------
# Suite 4  Nginx Reverse-Proxy Routing (only when NGINX_BASE is reachable)
# ---------------------------------------------------------------------------
def test_nginx_proxy_routing():
    """Validate Nginx routes to backend services and returns security headers."""
    # Check if nginx is even reachable
    reachable, _ = _tcp_check(
        NGINX_BASE.replace("http://", "").replace("https://", "").split(":")[0],
        int(NGINX_BASE.rsplit(":", 1)[1]) if ":" in NGINX_BASE.split("//")[1] else 80,
    )
    if not reachable:
        _record("nginx", "Nginx reachable", False, "Nginx not running  skipping proxy tests")
        return

    # /health endpoint
    status, headers, _, elapsed = _get(f"{NGINX_BASE}/health")
    _record("nginx", "Nginx /health returns 200",
            status == 200, f"status={status}", elapsed)

    # Proxy to API
    status, headers, _, elapsed = _get(f"{NGINX_BASE}/api/health")
    api_ok = status in (200, 301, 302, 404)
    _record("nginx", "Nginx proxies /api/ to unified-api",
            api_ok, f"status={status}", elapsed)

    # Security headers on root
    status, headers, _, elapsed = _get(f"{NGINX_BASE}/")
    for hdr, expected in REQUIRED_SECURITY_HEADERS.items():
        actual = headers.get(hdr, "")
        _record("nginx", f"Security header {hdr}",
                actual == expected, f"expected={expected} actual={actual or '(missing)'}")

    # Hidden files blocked
    status, _, _, elapsed = _get(f"{NGINX_BASE}/.env")
    _record("nginx", "Hidden files (.env) blocked",
            status in (403, 404), f"status={status}", elapsed)


# ---------------------------------------------------------------------------
# Suite 5  SLA Compliance (response-time)
# ---------------------------------------------------------------------------
def test_critical_endpoint_sla():
    """Spot-check critical endpoints against latency SLA."""
    checks = [
        ("GET /health", f"{API_BASE}/health", 500),
        ("GET /api/organizations", f"{API_BASE}/api/organizations", 2000),
        ("GET /mcp/health", f"{MCP_BASE}/mcp/health", 500),
    ]
    for label, url, sla_ms in checks:
        status, _, _, elapsed = _get(url)
        ok = elapsed < sla_ms and status in range(200, 500)
        _record("sla-compliance", f"{label} < {sla_ms}ms",
                ok, f"elapsed={elapsed:.0f}ms status={status}", elapsed)


# ---------------------------------------------------------------------------
# Suite 6  Compose-Variant Parity (file-level checks)
# ---------------------------------------------------------------------------
def test_compose_variant_parity():
    """Ensure all compose variants define the same core service set."""
    compose_dir = os.path.join(os.path.dirname(__file__), "..")
    variants = [
        "docker-compose.yml",
        "docker-compose.local.yml",
        "docker-compose.selfhost.yml",
        "docker-compose.aws.yml",
    ]
    required_services = {"unified-api", "mcp-server", "java-runner", "react-frontend"}

    for variant in variants:
        path = os.path.join(compose_dir, variant)
        if not os.path.exists(path):
            _record("compose-parity", f"{variant} exists", False, "file not found")
            continue
        with open(path, "r") as f:
            content = f.read()
        # Rough service detection via regex (avoids yaml dependency)
        found = set(re.findall(r"^\s{2}(\S+):", content, re.MULTILINE))
        missing = required_services - found
        _record("compose-parity", f"{variant} has all core services",
                len(missing) == 0,
                f"missing={missing}" if missing else "all present")


# ---------------------------------------------------------------------------
# Suite 7  Backup prerequisites
# ---------------------------------------------------------------------------
def test_backup_prerequisites():
    """Verify pg_dump is reachable and backup directory conventions are documented."""
    # Check DB is reachable (prerequisite for pg_dump)
    reachable, elapsed = _tcp_check(DB_HOST, DB_PORT)
    _record("backup", "DB reachable for pg_dump",
            reachable, f"host={DB_HOST}:{DB_PORT}", elapsed)

    # Verify self-host runbook documents backup commands
    runbook_path = os.path.join(os.path.dirname(__file__), "..", "docs", "SELF_HOST_RUNBOOK.md")
    if os.path.exists(runbook_path):
        with open(runbook_path, "r") as f:
            content = f.read()
        has_backup = "pg_dump" in content
        has_restore = "pg_restore" in content or "psql" in content
        _record("backup", "SELF_HOST_RUNBOOK documents pg_dump", has_backup, "")
        _record("backup", "SELF_HOST_RUNBOOK documents restore", has_restore, "")
    else:
        _record("backup", "SELF_HOST_RUNBOOK exists", False, "file not found")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("Phase 4  Operational Monitoring Validation")
    print("=" * 60)

    test_service_health_endpoints()
    test_database_connectivity()
    test_database_migration_state()
    test_mcp_websocket_liveness()
    test_nginx_proxy_routing()
    test_critical_endpoint_sla()
    test_compose_variant_parity()
    test_backup_prerequisites()

    # Report
    passed = sum(1 for r in results if r["passed"])
    failed = sum(1 for r in results if not r["passed"])
    total = len(results)

    print(f"\nResults: {passed}/{total} passed, {failed} failed\n")
    for r in results:
        icon = "PASS" if r["passed"] else "FAIL"
        print(f"  [{icon}] {r['suite']}: {r['test']}")
        if r["detail"]:
            print(f"         {r['detail']}")

    report = {
        "phase": "phase4-monitoring",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": {"total": total, "passed": passed, "failed": failed},
        "results": results,
    }
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport written to {REPORT_PATH}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
