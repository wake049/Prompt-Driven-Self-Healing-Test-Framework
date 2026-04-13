"""
Phase 5: GA Daily Monitoring
==============================
Automated daily health and metrics collection for production GA monitoring.
Designed to run on a cron/scheduler (e.g. daily at 06:00 UTC) and produce
a JSON report that can be shipped to Slack/email/PagerDuty.

Monitors:
  1. Service health (all health probe variants)
  2. Auth subsystem (login flow, token validation, active user count)
  3. Execution success rate and trends
  4. Healing success rate and stats
  5. Performance metrics (memory, latency)
  6. Failure pattern analysis
  7. Dashboard data freshness

Environment variables:
  API_BASE_URL      (default: http://localhost:8000)
  MCP_BASE_URL      (default: http://localhost:8001)
  RUNNER_BASE_URL   (default: http://localhost:8080)
  FRONTEND_BASE_URL (default: http://localhost:3000)
  GA_AUTH_EMAIL      (demo user email for auth probe)
  GA_AUTH_PASSWORD   (demo user password for auth probe)
  REPORT_PATH       (default: phase5_daily_monitoring_report.json)
  ALERT_THRESHOLD_EXEC_SUCCESS  (default: 80  exec success % floor)
  ALERT_THRESHOLD_HEALING_SUCCESS (default: 85  healing success % floor)
"""

import json
import os
import time
import urllib.request
import urllib.error
import socket
import ssl

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")
MCP_BASE = os.getenv("MCP_BASE_URL", "http://localhost:8001")
RUNNER_BASE = os.getenv("RUNNER_BASE_URL", "http://localhost:8080")
FRONTEND_BASE = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")

AUTH_EMAIL = os.getenv("GA_AUTH_EMAIL", "demo@example.com")
AUTH_PASSWORD = os.getenv("GA_AUTH_PASSWORD", "demodemo")

REPORT_PATH = os.getenv("REPORT_PATH", "phase5_daily_monitoring_report.json")
EXEC_SUCCESS_FLOOR = float(os.getenv("ALERT_THRESHOLD_EXEC_SUCCESS", "80"))
HEALING_SUCCESS_FLOOR = float(os.getenv("ALERT_THRESHOLD_HEALING_SUCCESS", "85"))

TIMEOUT = 15

results: list[dict] = []
alerts: list[dict] = []


def _record(category: str, check: str, status: str, detail: str = "",
            metric_value=None):
    """status: ok | warn | fail | info"""
    entry = {"category": category, "check": check, "status": status, "detail": detail}
    if metric_value is not None:
        entry["metric_value"] = metric_value
    results.append(entry)
    icons = {"ok": "OK  ", "warn": "WARN", "fail": "FAIL", "info": "INFO"}
    print(f"  [{icons.get(status, '????')}] [{category}] {check}")
    if detail:
        print(f"         {detail}")


def _alert(severity: str, message: str):
    alerts.append({"severity": severity, "message": message,
                   "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    print(f"  ** ALERT [{severity.upper()}]: {message}")


def _get(url: str, headers: dict | None = None, timeout: int = TIMEOUT):
    """Return (status, body_dict_or_none, elapsed_ms)."""
    start = time.time()
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url)
        if headers:
            for k, v in headers.items():
                req.add_header(k, v)
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            body = resp.read()
            elapsed = (time.time() - start) * 1000
            try:
                data = json.loads(body)
            except (json.JSONDecodeError, ValueError):
                data = None
            return resp.status, data, elapsed
    except urllib.error.HTTPError as exc:
        elapsed = (time.time() - start) * 1000
        try:
            data = json.loads(exc.read())
        except Exception:
            data = None
        return exc.code, data, elapsed
    except Exception:
        elapsed = (time.time() - start) * 1000
        return 0, None, elapsed


def _post(url: str, payload: dict, headers: dict | None = None, timeout: int = TIMEOUT):
    start = time.time()
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        data = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        if headers:
            for k, v in headers.items():
                req.add_header(k, v)
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            body = resp.read()
            elapsed = (time.time() - start) * 1000
            try:
                return resp.status, json.loads(body), elapsed
            except (json.JSONDecodeError, ValueError):
                return resp.status, None, elapsed
    except urllib.error.HTTPError as exc:
        elapsed = (time.time() - start) * 1000
        return exc.code, None, elapsed
    except Exception:
        elapsed = (time.time() - start) * 1000
        return 0, None, elapsed


# ---------------------------------------------------------------------------
# 1. Service Health Probes
# ---------------------------------------------------------------------------
def check_service_health():
    cat = "service-health"
    probes = [
        ("unified-api /health", f"{API_BASE}/health"),
        ("unified-api /health/ready", f"{API_BASE}/health/ready"),
        ("unified-api /health/live", f"{API_BASE}/health/live"),
        ("unified-api /health/detailed", f"{API_BASE}/health/detailed"),
        ("mcp-server /mcp/health", f"{MCP_BASE}/mcp/health"),
        ("java-runner /health", f"{RUNNER_BASE}/health"),
        ("react-frontend /", f"{FRONTEND_BASE}/"),
    ]
    for label, url in probes:
        status, data, elapsed = _get(url)
        ok = status == 200
        _record(cat, label, "ok" if ok else "fail",
                f"status={status} latency={elapsed:.0f}ms", elapsed)
        if not ok:
            _alert("critical", f"{label} returned status {status}")

    # Subsystem health
    subsystems = [
        ("auth /health", f"{API_BASE}/api/v1/auth/health"),
        ("healing /health", f"{API_BASE}/api/v1/healing/health"),
        ("dashboard /health", f"{API_BASE}/api/v1/dashboard/execution/health"),
    ]
    for label, url in subsystems:
        status, data, elapsed = _get(url)
        _record(cat, label, "ok" if status == 200 else "warn",
                f"status={status} latency={elapsed:.0f}ms", elapsed)


# ---------------------------------------------------------------------------
# 2. Auth Subsystem
# ---------------------------------------------------------------------------
def check_auth_subsystem():
    cat = "auth"

    # Login probe
    status, data, elapsed = _post(f"{API_BASE}/api/v1/auth/login",
                                  {"email": AUTH_EMAIL, "password": AUTH_PASSWORD})
    if status == 200 and data and "access_token" in data:
        _record(cat, "Login succeeds", "ok", f"latency={elapsed:.0f}ms", elapsed)
        token = data["access_token"]

        # Token verification
        auth_headers = {"Authorization": f"Bearer {token}"}
        status2, data2, elapsed2 = _get(f"{API_BASE}/api/v1/auth/verify-token",
                                        headers=auth_headers)
        _record(cat, "Token verification", "ok" if status2 == 200 else "fail",
                f"status={status2}", elapsed2)

        # /me endpoint
        status3, data3, elapsed3 = _get(f"{API_BASE}/api/v1/auth/me",
                                        headers=auth_headers)
        _record(cat, "User profile (/me)", "ok" if status3 == 200 else "warn",
                f"status={status3}", elapsed3)

        return token
    else:
        _record(cat, "Login succeeds", "fail",
                f"status={status} — cannot proceed with authed checks", elapsed)
        if status == 401:
            _record(cat, "Login — auth rejection", "info",
                    "Credentials may need updating via GA_AUTH_EMAIL/GA_AUTH_PASSWORD")
        else:
            _alert("critical", f"Auth login returned {status}")
        return None


# ---------------------------------------------------------------------------
# 3. Execution Success Rate
# ---------------------------------------------------------------------------
def check_execution_metrics(token: str | None):
    cat = "execution"
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # Dashboard stats
    status, data, elapsed = _get(f"{API_BASE}/api/v1/dashboard/execution/stats",
                                 headers=headers)
    if status == 200 and data:
        success_rate = data.get("success_rate")
        total = data.get("total_executions", data.get("total", 0))
        _record(cat, "Execution stats available", "ok",
                f"total={total} success_rate={success_rate}", success_rate)

        if success_rate is not None and isinstance(success_rate, (int, float)):
            pct = float(success_rate) * 100 if success_rate <= 1 else float(success_rate)
            if pct < EXEC_SUCCESS_FLOOR:
                _alert("warning", f"Execution success rate {pct:.1f}% below floor {EXEC_SUCCESS_FLOOR}%")
                _record(cat, f"Success rate >= {EXEC_SUCCESS_FLOOR}%", "fail",
                        f"actual={pct:.1f}%", pct)
            else:
                _record(cat, f"Success rate >= {EXEC_SUCCESS_FLOOR}%", "ok",
                        f"actual={pct:.1f}%", pct)
    else:
        _record(cat, "Execution stats available", "warn",
                f"status={status} — may require auth", elapsed)

    # Trends (24h window)
    status, data, elapsed = _get(f"{API_BASE}/api/analytics/trends?timeRange=24h",
                                 headers=headers)
    if status == 200 and data:
        _record(cat, "24h trend data available", "ok",
                f"exec_success_rate={data.get('execution_success_rate', 'n/a')}", elapsed)
    else:
        _record(cat, "24h trend data available", "warn", f"status={status}", elapsed)

    # Recent executions
    status, data, elapsed = _get(
        f"{API_BASE}/api/v1/dashboard/execution/recent?limit=5", headers=headers)
    if status == 200:
        count = len(data) if isinstance(data, list) else 0
        _record(cat, "Recent executions queryable", "ok", f"count={count}", elapsed)
    else:
        _record(cat, "Recent executions queryable", "warn", f"status={status}", elapsed)


# ---------------------------------------------------------------------------
# 4. Healing Success Rate
# ---------------------------------------------------------------------------
def check_healing_metrics(token: str | None):
    cat = "healing"
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # Healing stats
    status, data, elapsed = _get(f"{API_BASE}/api/v1/healing/stats", headers=headers)
    if status == 200 and data:
        rate = data.get("healing_success_rate")
        total = data.get("total_events", 0)
        _record(cat, "Healing stats available", "ok",
                f"total_events={total} success_rate={rate}", rate)

        if rate is not None and isinstance(rate, (int, float)) and total > 0:
            pct = float(rate) * 100 if rate <= 1 else float(rate)
            if pct < HEALING_SUCCESS_FLOOR:
                _alert("warning",
                       f"Healing success rate {pct:.1f}% below floor {HEALING_SUCCESS_FLOOR}%")
                _record(cat, f"Success rate >= {HEALING_SUCCESS_FLOOR}%", "fail",
                        f"actual={pct:.1f}%", pct)
            else:
                _record(cat, f"Success rate >= {HEALING_SUCCESS_FLOOR}%", "ok",
                        f"actual={pct:.1f}%", pct)
    else:
        _record(cat, "Healing stats available", "warn", f"status={status}", elapsed)

    # Healing analytics (30-day window)
    status, data, elapsed = _get(f"{API_BASE}/api/analytics/healing-analytics?days=30",
                                 headers=headers)
    if status == 200:
        _record(cat, "30-day healing analytics available", "ok", "", elapsed)
    else:
        _record(cat, "30-day healing analytics available", "warn",
                f"status={status}", elapsed)


# ---------------------------------------------------------------------------
# 5. Performance Metrics
# ---------------------------------------------------------------------------
def check_performance(token: str | None):
    cat = "performance"
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # Detailed health (includes memory)
    status, data, elapsed = _get(f"{API_BASE}/health/detailed")
    if status == 200 and data:
        mem = data.get("memory", data.get("memory_mb", {}))
        _record(cat, "Detailed health metrics", "ok", f"memory={mem}", elapsed)
    else:
        _record(cat, "Detailed health metrics", "warn", f"status={status}", elapsed)

    # Performance metrics endpoint
    status, data, elapsed = _get(f"{API_BASE}/api/v1/performance/metrics",
                                 headers=headers)
    if status == 200:
        _record(cat, "Performance metrics endpoint", "ok", "", elapsed)
    else:
        _record(cat, "Performance metrics endpoint", "warn", f"status={status}", elapsed)

    # Spot-check latency on critical endpoints
    latency_checks = [
        ("health", f"{API_BASE}/health", 500),
        ("auth/health", f"{API_BASE}/api/v1/auth/health", 1000),
        ("mcp/health", f"{MCP_BASE}/mcp/health", 500),
        ("runner/health", f"{RUNNER_BASE}/health", 1000),
    ]
    for label, url, sla_ms in latency_checks:
        status, _, elapsed = _get(url)
        ok = status == 200 and elapsed < sla_ms
        if elapsed >= sla_ms and status == 200:
            _alert("warning", f"{label} latency {elapsed:.0f}ms exceeds SLA {sla_ms}ms")
        _record(cat, f"{label} latency < {sla_ms}ms",
                "ok" if ok else ("warn" if status == 200 else "fail"),
                f"latency={elapsed:.0f}ms status={status}", elapsed)


# ---------------------------------------------------------------------------
# 6. Failure Pattern Analysis
# ---------------------------------------------------------------------------
def check_failure_patterns(token: str | None):
    cat = "failure-analysis"
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    status, data, elapsed = _get(f"{API_BASE}/api/analytics/failure-patterns?timeRange=24h",
                                 headers=headers)
    if status == 200 and data:
        patterns = data if isinstance(data, list) else data.get("patterns", [])
        _record(cat, "Failure patterns queryable", "ok",
                f"pattern_count={len(patterns)}", elapsed)
        # Flag any high-frequency failure patterns
        for p in patterns[:3]:
            name = p.get("action_type", p.get("pattern", "unknown"))
            count = p.get("count", p.get("occurrences", 0))
            if count > 50:
                _alert("warning", f"High-frequency failure pattern: {name} ({count} occurrences)")
    else:
        _record(cat, "Failure patterns queryable", "warn", f"status={status}", elapsed)

    # Dashboard failure analysis
    status, data, elapsed = _get(
        f"{API_BASE}/api/v1/dashboard/execution/failure-analysis", headers=headers)
    if status == 200:
        _record(cat, "Dashboard failure analysis", "ok", "", elapsed)
    else:
        _record(cat, "Dashboard failure analysis", "warn", f"status={status}", elapsed)


# ---------------------------------------------------------------------------
# 7. Dashboard Data Freshness
# ---------------------------------------------------------------------------
def check_dashboard_freshness(token: str | None):
    cat = "dashboard"
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    # Dashboard health
    status, _, elapsed = _get(f"{API_BASE}/api/v1/dashboard/execution/health",
                              headers=headers)
    _record(cat, "Dashboard health", "ok" if status == 200 else "warn",
            f"status={status}", elapsed)

    # Dashboard trends (should have data points)
    status, data, elapsed = _get(f"{API_BASE}/api/v1/dashboard/execution/trends",
                                 headers=headers)
    if status == 200:
        _record(cat, "Dashboard trends populated", "ok", "", elapsed)
    else:
        _record(cat, "Dashboard trends populated", "warn", f"status={status}", elapsed)

    # Frontend reachable and serves SPA
    status, _, elapsed = _get(f"{FRONTEND_BASE}/")
    _record(cat, "Frontend serves SPA", "ok" if status == 200 else "fail",
            f"status={status}", elapsed)
    if status != 200:
        _alert("critical", f"Frontend not serving — status {status}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("Phase 5 — GA Daily Monitoring Report")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}")
    print("=" * 60)

    print("\n--- 1. Service Health Probes ---")
    check_service_health()

    print("\n--- 2. Auth Subsystem ---")
    token = check_auth_subsystem()

    print("\n--- 3. Execution Metrics ---")
    check_execution_metrics(token)

    print("\n--- 4. Healing Metrics ---")
    check_healing_metrics(token)

    print("\n--- 5. Performance ---")
    check_performance(token)

    print("\n--- 6. Failure Patterns ---")
    check_failure_patterns(token)

    print("\n--- 7. Dashboard Freshness ---")
    check_dashboard_freshness(token)

    # Summary
    ok = sum(1 for r in results if r["status"] == "ok")
    warn = sum(1 for r in results if r["status"] == "warn")
    fail = sum(1 for r in results if r["status"] == "fail")
    info = sum(1 for r in results if r["status"] == "info")
    total = len(results)

    print(f"\n{'=' * 60}")
    print(f"Daily Monitoring: {ok} ok, {warn} warn, {fail} fail, {info} info / {total} checks")
    if alerts:
        print(f"\nALERTS RAISED: {len(alerts)}")
        for a in alerts:
            print(f"  [{a['severity'].upper()}] {a['message']}")
    else:
        print("\nNo alerts raised — all clear.")

    report = {
        "phase": "phase5-daily-monitoring",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": {"total": total, "ok": ok, "warn": warn, "fail": fail, "info": info},
        "alerts": alerts,
        "results": results,
    }
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport written to {REPORT_PATH}")

    # Fail if any critical alerts
    critical = [a for a in alerts if a["severity"] == "critical"]
    return 1 if critical else 0


if __name__ == "__main__":
    raise SystemExit(main())
