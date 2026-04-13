"""
Phase 5: Production Week Stability Tracker
============================================
Runs a comprehensive stability check designed to be executed daily for 7 days
after GA launch. Tracks metrics over time and flags regressions.

Collects:
  - Service uptime (health checks)
  - Auth success/failure rate
  - Execution success rate + volume trend
  - Healing success rate
  - P95 latency for critical endpoints
  - Error rate by endpoint family
  - Alert count per day

Appends to a rolling JSON log so trends can be analyzed over the 7-day window.

Environment variables:
  API_BASE_URL, MCP_BASE_URL, RUNNER_BASE_URL, FRONTEND_BASE_URL
  GA_AUTH_EMAIL, GA_AUTH_PASSWORD
  STABILITY_LOG_PATH  (default: phase5_stability_log.json)
  REPORT_PATH         (default: phase5_stability_report.json)
"""

import json
import os
import time
import urllib.request
import urllib.error
import ssl
import statistics

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")
MCP_BASE = os.getenv("MCP_BASE_URL", "http://localhost:8001")
RUNNER_BASE = os.getenv("RUNNER_BASE_URL", "http://localhost:8080")
FRONTEND_BASE = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")

AUTH_EMAIL = os.getenv("GA_AUTH_EMAIL", "demo@example.com")
AUTH_PASSWORD = os.getenv("GA_AUTH_PASSWORD", "demodemo")

STABILITY_LOG = os.getenv("STABILITY_LOG_PATH", "phase5_stability_log.json")
REPORT_PATH = os.getenv("REPORT_PATH", "phase5_stability_report.json")
TIMEOUT = 15

# Stability thresholds
UPTIME_FLOOR = 100.0       # all health probes must pass
EXEC_SUCCESS_FLOOR = 80.0
HEALING_SUCCESS_FLOOR = 85.0
P95_LATENCY_CEIL_MS = 2000
ERROR_RATE_CEIL = 5.0       # percent

metrics: dict = {}
alerts: list[str] = []


def _get(url, headers=None):
    start = time.time()
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url)
        if headers:
            for k, v in headers.items():
                req.add_header(k, v)
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
            body = resp.read()
            elapsed = (time.time() - start) * 1000
            try:
                return resp.status, json.loads(body), elapsed
            except (json.JSONDecodeError, ValueError):
                return resp.status, None, elapsed
    except urllib.error.HTTPError as exc:
        return exc.code, None, (time.time() - start) * 1000
    except Exception:
        return 0, None, (time.time() - start) * 1000


def _post(url, payload, headers=None):
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
        with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
            body = resp.read()
            elapsed = (time.time() - start) * 1000
            try:
                return resp.status, json.loads(body), elapsed
            except (json.JSONDecodeError, ValueError):
                return resp.status, None, elapsed
    except urllib.error.HTTPError as exc:
        return exc.code, None, (time.time() - start) * 1000
    except Exception:
        return 0, None, (time.time() - start) * 1000


# ---------------------------------------------------------------------------
# Metric Collection
# ---------------------------------------------------------------------------
def collect_uptime():
    """Check all health endpoints and compute uptime percentage."""
    probes = [
        ("unified-api", f"{API_BASE}/health"),
        ("mcp-server", f"{MCP_BASE}/mcp/health"),
        ("java-runner", f"{RUNNER_BASE}/health"),
        ("frontend", f"{FRONTEND_BASE}/"),
    ]
    up = 0
    latencies = []
    service_status = {}
    for svc, url in probes:
        status, _, elapsed = _get(url)
        service_status[svc] = {"status": status, "latency_ms": round(elapsed, 1)}
        latencies.append(elapsed)
        if status == 200:
            up += 1

    uptime_pct = (up / len(probes)) * 100
    metrics["uptime"] = {
        "percentage": uptime_pct,
        "services_up": up,
        "services_total": len(probes),
        "service_detail": service_status,
    }
    if uptime_pct < UPTIME_FLOOR:
        alerts.append(f"Uptime {uptime_pct:.0f}% — services down")
    print(f"  Uptime: {uptime_pct:.0f}% ({up}/{len(probes)} services)")


def collect_auth_metrics():
    """Test auth login and measure success."""
    status, data, elapsed = _post(f"{API_BASE}/api/v1/auth/login",
                                  {"email": AUTH_EMAIL, "password": AUTH_PASSWORD})
    login_ok = status == 200 and data and "access_token" in data
    metrics["auth"] = {
        "login_status": status,
        "login_success": login_ok,
        "login_latency_ms": round(elapsed, 1),
    }
    token = data.get("access_token") if login_ok else None

    if not login_ok:
        alerts.append(f"Auth login failed: status={status}")
    print(f"  Auth login: {'ok' if login_ok else 'FAIL'} (latency={elapsed:.0f}ms)")
    return token


def collect_execution_metrics(token):
    """Collect execution success rate and volume from dashboard."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    status, data, elapsed = _get(f"{API_BASE}/api/v1/dashboard/execution/stats",
                                 headers=headers)
    if status == 200 and data:
        success_rate = data.get("success_rate")
        total = data.get("total_executions", data.get("total", 0))
        metrics["execution"] = {
            "success_rate": success_rate,
            "total_executions": total,
            "latency_ms": round(elapsed, 1),
        }
        if success_rate is not None:
            pct = float(success_rate) * 100 if success_rate <= 1 else float(success_rate)
            if pct < EXEC_SUCCESS_FLOOR:
                alerts.append(f"Execution success rate {pct:.1f}% below {EXEC_SUCCESS_FLOOR}%")
        print(f"  Execution: total={total} success_rate={success_rate}")
    else:
        metrics["execution"] = {"available": False, "status": status}
        print(f"  Execution stats: status={status}")


def collect_healing_metrics(token):
    """Collect healing success rate."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    status, data, elapsed = _get(f"{API_BASE}/api/v1/healing/stats", headers=headers)
    if status == 200 and data:
        rate = data.get("healing_success_rate")
        total = data.get("total_events", 0)
        metrics["healing"] = {
            "success_rate": rate,
            "total_events": total,
            "latency_ms": round(elapsed, 1),
        }
        if rate is not None and total > 0:
            pct = float(rate) * 100 if rate <= 1 else float(rate)
            if pct < HEALING_SUCCESS_FLOOR:
                alerts.append(f"Healing success rate {pct:.1f}% below {HEALING_SUCCESS_FLOOR}%")
        print(f"  Healing: total_events={total} success_rate={rate}")
    else:
        metrics["healing"] = {"available": False, "status": status}
        print(f"  Healing stats: status={status}")


def collect_latency_metrics():
    """P95 latency sampling across critical endpoints."""
    endpoints = [
        ("health", f"{API_BASE}/health"),
        ("auth-health", f"{API_BASE}/api/v1/auth/health"),
        ("mcp-health", f"{MCP_BASE}/mcp/health"),
        ("runner-health", f"{RUNNER_BASE}/health"),
    ]
    latency_data = {}
    for label, url in endpoints:
        samples = []
        for _ in range(5):
            _, _, elapsed = _get(url)
            samples.append(elapsed)
        p50 = statistics.median(samples)
        p95 = sorted(samples)[int(len(samples) * 0.95)]
        latency_data[label] = {"p50_ms": round(p50, 1), "p95_ms": round(p95, 1),
                               "samples": len(samples)}
        if p95 > P95_LATENCY_CEIL_MS:
            alerts.append(f"{label} p95 latency {p95:.0f}ms exceeds {P95_LATENCY_CEIL_MS}ms")

    metrics["latency"] = latency_data
    for label, d in latency_data.items():
        print(f"  {label}: p50={d['p50_ms']:.0f}ms p95={d['p95_ms']:.0f}ms")


def collect_error_analysis(token):
    """Check failure patterns for error rate."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    status, data, elapsed = _get(
        f"{API_BASE}/api/analytics/failure-patterns?timeRange=24h", headers=headers)
    if status == 200 and data:
        patterns = data if isinstance(data, list) else data.get("patterns", [])
        total_errors = sum(p.get("count", p.get("occurrences", 0)) for p in patterns)
        metrics["errors"] = {
            "pattern_count": len(patterns),
            "total_error_events": total_errors,
        }
        print(f"  Errors: {len(patterns)} patterns, {total_errors} events")
    else:
        metrics["errors"] = {"available": False, "status": status}
        print(f"  Error analysis: status={status}")


# ---------------------------------------------------------------------------
# Rolling Log
# ---------------------------------------------------------------------------
def append_to_stability_log(entry: dict):
    """Append today's metrics to the rolling stability log."""
    log = []
    if os.path.exists(STABILITY_LOG):
        with open(STABILITY_LOG, "r") as f:
            try:
                log = json.load(f)
            except json.JSONDecodeError:
                log = []
    log.append(entry)
    with open(STABILITY_LOG, "w") as f:
        json.dump(log, f, indent=2)
    return log


def analyze_trend(log: list):
    """Analyze 7-day trend from the rolling log."""
    print(f"\n--- 7-Day Trend ({len(log)} data points) ---")

    if len(log) < 2:
        print("  Not enough data points for trend analysis yet.")
        return

    # Uptime trend
    uptimes = [e["metrics"].get("uptime", {}).get("percentage", 0) for e in log]
    print(f"  Uptime: {' -> '.join(f'{u:.0f}%' for u in uptimes[-7:])}")

    # Alert count trend
    alert_counts = [len(e.get("alerts", [])) for e in log]
    print(f"  Alerts: {' -> '.join(str(a) for a in alert_counts[-7:])}")

    # Stability verdict
    recent = log[-7:]
    recent_uptimes = [e["metrics"].get("uptime", {}).get("percentage", 0) for e in recent]
    recent_alerts = sum(len(e.get("alerts", [])) for e in recent)

    if all(u == 100 for u in recent_uptimes) and recent_alerts == 0:
        print("\n  VERDICT: STABLE — Ready for full GA rollout")
    elif all(u >= 75 for u in recent_uptimes):
        print(f"\n  VERDICT: MOSTLY STABLE — {recent_alerts} alerts in last {len(recent)} days")
    else:
        print(f"\n  VERDICT: UNSTABLE — Address issues before expanding rollout")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    print("=" * 60)
    print("Phase 5 — Production Week Stability Tracker")
    print(f"Timestamp: {timestamp}")
    print("=" * 60)

    print("\n--- Collecting Metrics ---")
    collect_uptime()
    token = collect_auth_metrics()
    collect_execution_metrics(token)
    collect_healing_metrics(token)
    collect_latency_metrics()
    collect_error_analysis(token)

    # Build entry
    entry = {
        "timestamp": timestamp,
        "day": time.strftime("%Y-%m-%d"),
        "metrics": metrics,
        "alerts": alerts,
        "alert_count": len(alerts),
    }

    # Append to rolling log
    log = append_to_stability_log(entry)

    # Analyze trend
    analyze_trend(log)

    # Summary
    print(f"\n{'=' * 60}")
    if alerts:
        print(f"ALERTS: {len(alerts)}")
        for a in alerts:
            print(f"  - {a}")
    else:
        print("No alerts — all metrics within thresholds.")

    # Write single-run report
    report = {
        "phase": "phase5-stability-tracker",
        "timestamp": timestamp,
        "day_number": len(log),
        "metrics": metrics,
        "alerts": alerts,
        "alert_count": len(alerts),
        "trend_days": len(log),
    }
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport: {REPORT_PATH}")
    print(f"Rolling log: {STABILITY_LOG} ({len(log)} entries)")

    critical = len(alerts) > 0
    return 1 if critical else 0


if __name__ == "__main__":
    raise SystemExit(main())
