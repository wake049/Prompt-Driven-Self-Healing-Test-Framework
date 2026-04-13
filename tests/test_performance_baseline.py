#!/usr/bin/env python3
"""
Phase 3: Performance baseline tests.

Establishes quantitative performance baselines for critical API paths:
  1. Auth latency (login, /me)
  2. Prompt CRUD latency
  3. Plan generation latency
  4. API test-data endpoint latency
  5. Analytics endpoint latency
  6. Concurrent request throughput
  7. Database query latency (via endpoint response times)

Generates a JSON baseline file that can be compared across runs.

Usage:
  python tests/test_performance_baseline.py --base-url http://localhost:8000
  python tests/test_performance_baseline.py --base-url http://localhost:8000 --iterations 20
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

import requests


# ---------------------------------------------------------------------------
# Measurement
# ---------------------------------------------------------------------------

class Measurement:
    def __init__(self, name: str, latencies_ms: List[float], errors: int = 0):
        self.name = name
        self.latencies = latencies_ms
        self.errors = errors

    @property
    def count(self) -> int:
        return len(self.latencies)

    @property
    def p50(self) -> float:
        return self._percentile(50) if self.latencies else 0

    @property
    def p95(self) -> float:
        return self._percentile(95) if self.latencies else 0

    @property
    def p99(self) -> float:
        return self._percentile(99) if self.latencies else 0

    @property
    def avg(self) -> float:
        return statistics.mean(self.latencies) if self.latencies else 0

    @property
    def min_ms(self) -> float:
        return min(self.latencies) if self.latencies else 0

    @property
    def max_ms(self) -> float:
        return max(self.latencies) if self.latencies else 0

    def _percentile(self, pct: float) -> float:
        if not self.latencies:
            return 0
        sorted_l = sorted(self.latencies)
        idx = int(len(sorted_l) * pct / 100)
        idx = min(idx, len(sorted_l) - 1)
        return sorted_l[idx]

    def summary(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "count": self.count,
            "errors": self.errors,
            "p50_ms": round(self.p50, 1),
            "p95_ms": round(self.p95, 1),
            "p99_ms": round(self.p99, 1),
            "avg_ms": round(self.avg, 1),
            "min_ms": round(self.min_ms, 1),
            "max_ms": round(self.max_ms, 1),
        }


ALL_MEASUREMENTS: List[Measurement] = []

# SLA thresholds (ms) — initial baselines, tighten after first run
SLA = {
    "health": 500,
    "auth-login": 2000,
    "auth-me": 1000,
    "create-prompt": 2000,
    "list-prompts": 2000,
    "generate-plan": 120000,  # AI call, can be slow
    "api-test-data-endpoints": 2000,
    "api-test-data-templates": 2000,
    "analytics-dashboard": 3000,
    "analytics-trends": 3000,
    "healing-analytics": 3000,
}


def measure(name: str, fn, iterations: int = 10) -> Measurement:
    """Run fn() `iterations` times and collect latencies."""
    latencies = []
    errors = 0
    for _ in range(iterations):
        try:
            t0 = time.monotonic()
            fn()
            elapsed_ms = (time.monotonic() - t0) * 1000
            latencies.append(elapsed_ms)
        except Exception:
            errors += 1

    m = Measurement(name, latencies, errors)
    ALL_MEASUREMENTS.append(m)
    return m


def print_measurement(m: Measurement):
    sla = SLA.get(m.name, None)
    breach = ""
    if sla and m.p95 > sla:
        breach = f" *** SLA BREACH (p95 {m.p95:.0f}ms > {sla}ms) ***"
    print(
        f"  {m.name:30s} "
        f"p50={m.p50:7.0f}ms  p95={m.p95:7.0f}ms  p99={m.p99:7.0f}ms  "
        f"avg={m.avg:7.0f}ms  err={m.errors}{breach}"
    )


# ---------------------------------------------------------------------------
# Test suites
# ---------------------------------------------------------------------------

def setup_auth(base_url: str, timeout: int) -> Optional[requests.Session]:
    """Create an authenticated session for performance tests."""
    uid = uuid.uuid4().hex[:8]
    email = f"perf-{uid}@example.com"
    password = "PerfTest_Secure123!"

    session = requests.Session()

    # Register
    try:
        session.post(
            f"{base_url}/api/v1/auth/register",
            json={"email": email, "password": password, "username": f"perf{uid}"},
            timeout=timeout,
        )
    except Exception:
        pass

    # Login
    try:
        resp = session.post(
            f"{base_url}/api/v1/auth/login",
            json={"email": email, "password": password},
            timeout=timeout,
        )
        if resp.status_code == 200:
            token = resp.json().get("access_token")
            if token:
                session.headers["Authorization"] = f"Bearer {token}"
                return session
    except Exception:
        pass

    return None


def perf_health(base_url: str, iterations: int):
    """Benchmark health endpoint."""
    print("\n--- Health endpoint ---")
    m = measure("health", lambda: requests.get(f"{base_url}/health", timeout=5), iterations)
    print_measurement(m)


def perf_auth(base_url: str, session: requests.Session, iterations: int):
    """Benchmark auth endpoints."""
    print("\n--- Auth endpoints ---")

    uid = uuid.uuid4().hex[:8]
    email = f"perf-login-{uid}@example.com"
    password = "PerfTest_Secure123!"

    # Register test user
    try:
        session.post(
            f"{base_url}/api/v1/auth/register",
            json={"email": email, "password": password, "username": f"perflogin{uid}"},
            timeout=10,
        )
    except Exception:
        pass

    m = measure(
        "auth-login",
        lambda: requests.post(
            f"{base_url}/api/v1/auth/login",
            json={"email": email, "password": password},
            timeout=10,
        ),
        iterations,
    )
    print_measurement(m)

    m = measure(
        "auth-me",
        lambda: session.get(f"{base_url}/api/v1/auth/me", timeout=10),
        iterations,
    )
    print_measurement(m)


def perf_prompts(base_url: str, session: requests.Session, iterations: int):
    """Benchmark prompt CRUD."""
    print("\n--- Prompt endpoints ---")

    prompt_ids = []

    def create_prompt():
        resp = session.post(
            f"{base_url}/api/v1/prompts",
            json={
                "title": f"Perf Test {uuid.uuid4().hex[:8]}",
                "original_prompt": "Navigate to example.com",
                "url": "https://example.com",
            },
            timeout=10,
        )
        if resp.status_code == 200:
            pid = resp.json().get("id") or resp.json().get("prompt_id")
            if pid:
                prompt_ids.append(pid)

    m = measure("create-prompt", create_prompt, iterations)
    print_measurement(m)

    m = measure(
        "list-prompts",
        lambda: session.get(f"{base_url}/api/v1/prompts", timeout=10),
        iterations,
    )
    print_measurement(m)

    return prompt_ids


def perf_plan_generation(base_url: str, session: requests.Session, prompt_id: str):
    """Benchmark plan generation (single call, AI-dependent)."""
    print("\n--- Plan generation ---")

    def gen():
        session.post(f"{base_url}/api/v1/prompts/{prompt_id}/generate", timeout=120)

    m = measure("generate-plan", gen, iterations=1)
    print_measurement(m)


def perf_api_test_data(base_url: str, session: requests.Session, iterations: int):
    """Benchmark API test-data endpoints."""
    print("\n--- API test-data endpoints ---")

    m = measure(
        "api-test-data-endpoints",
        lambda: session.get(f"{base_url}/api/v1/api-test-data/endpoints", timeout=10),
        iterations,
    )
    print_measurement(m)

    m = measure(
        "api-test-data-templates",
        lambda: session.get(f"{base_url}/api/v1/api-test-data/templates", timeout=10),
        iterations,
    )
    print_measurement(m)


def perf_analytics(base_url: str, session: requests.Session, iterations: int):
    """Benchmark analytics endpoints."""
    print("\n--- Analytics endpoints ---")

    m = measure(
        "analytics-dashboard",
        lambda: session.get(f"{base_url}/api/v1/analytics/dashboard", timeout=10),
        iterations,
    )
    print_measurement(m)

    m = measure(
        "analytics-trends",
        lambda: session.get(f"{base_url}/api/v1/analytics/trends?timeRange=7d", timeout=10),
        iterations,
    )
    print_measurement(m)

    m = measure(
        "healing-analytics",
        lambda: session.get(f"{base_url}/api/v1/analytics/healing-analytics?days=7", timeout=10),
        iterations,
    )
    print_measurement(m)


def perf_concurrent_throughput(base_url: str, session: requests.Session, concurrency: int = 10):
    """Measure throughput under concurrent load."""
    print(f"\n--- Concurrent throughput ({concurrency} workers) ---")

    def _request(_):
        t0 = time.monotonic()
        try:
            resp = session.get(f"{base_url}/api/v1/prompts", timeout=10)
            return (time.monotonic() - t0) * 1000, resp.status_code < 500
        except Exception:
            return (time.monotonic() - t0) * 1000, False

    total_requests = concurrency * 5
    latencies = []
    errors = 0

    t_start = time.monotonic()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(_request, i) for i in range(total_requests)]
        for f in as_completed(futures):
            ms, ok = f.result()
            latencies.append(ms)
            if not ok:
                errors += 1
    total_time = time.monotonic() - t_start

    m = Measurement("concurrent-throughput", latencies, errors)
    ALL_MEASUREMENTS.append(m)

    rps = total_requests / total_time
    print(
        f"  {'concurrent-throughput':30s} "
        f"{total_requests} reqs in {total_time:.1f}s = {rps:.1f} req/s  "
        f"p50={m.p50:.0f}ms  p95={m.p95:.0f}ms  err={errors}"
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Phase 3: Performance baseline")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--iterations", type=int, default=10, help="Iterations per endpoint")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent workers")
    parser.add_argument("--timeout", type=int, default=15)
    args = parser.parse_args()

    print("=" * 70)
    print("PHASE 3: PERFORMANCE BASELINE")
    print("=" * 70)

    session = setup_auth(args.base_url, args.timeout)
    if not session:
        print("FATAL: Cannot authenticate. Ensure the unified API is running.")
        sys.exit(1)
    print("  Authenticated for performance tests")

    # Run benchmarks
    perf_health(args.base_url, args.iterations)
    perf_auth(args.base_url, session, args.iterations)
    prompt_ids = perf_prompts(args.base_url, session, args.iterations)
    if prompt_ids:
        perf_plan_generation(args.base_url, session, prompt_ids[0])
    perf_api_test_data(args.base_url, session, args.iterations)
    perf_analytics(args.base_url, session, args.iterations)
    perf_concurrent_throughput(args.base_url, session, args.concurrency)

    # SLA summary
    print(f"\n{'=' * 70}")
    print("SLA CHECK")
    print("=" * 70)
    breaches = 0
    for m in ALL_MEASUREMENTS:
        sla_limit = SLA.get(m.name)
        if sla_limit:
            if m.p95 > sla_limit:
                print(f"  BREACH: {m.name} p95={m.p95:.0f}ms > SLA {sla_limit}ms")
                breaches += 1
            else:
                print(f"  OK:     {m.name} p95={m.p95:.0f}ms <= SLA {sla_limit}ms")

    total = len(ALL_MEASUREMENTS)
    print(f"\n{'=' * 70}")
    print(f"PERFORMANCE BASELINE: {total} endpoints measured, {breaches} SLA breaches")
    print("=" * 70)

    # JSON baseline report
    report = {
        "phase": 3,
        "type": "performance-baseline",
        "total_endpoints": total,
        "sla_breaches": breaches,
        "measurements": [m.summary() for m in ALL_MEASUREMENTS],
        "sla_thresholds_ms": SLA,
    }
    report_path = os.path.join(os.path.dirname(__file__), "phase3_performance_baseline.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nBaseline report: {report_path}")

    sys.exit(0 if breaches == 0 else 1)


if __name__ == "__main__":
    main()
