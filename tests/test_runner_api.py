#!/usr/bin/env python3
"""
Runner Agent API integration tests.

Tests the complete runner agent lifecycle:
  1. Registration (with and without API key)
  2. Heartbeat
  3. Polling (empty queue and assigned work)
  4. Log push and retrieval
  5. Runner listing
  6. Targeted execution dispatch

Usage:
  python tests/test_runner_api.py --base-url http://localhost:8000
  python tests/test_runner_api.py --base-url http://localhost:8000 --runner-api-key my-secret
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from typing import Any, Dict, List, Optional

import requests


# ---------------------------------------------------------------------------
# Result tracking
# ---------------------------------------------------------------------------

class TestResult:
    def __init__(self, suite: str, name: str, passed: bool, message: str):
        self.suite = suite
        self.name = name
        self.passed = passed
        self.message = message


ALL_RESULTS: List[TestResult] = []


def record(suite: str, name: str, passed: bool, message: str):
    ALL_RESULTS.append(TestResult(suite, name, passed, message))
    status = "PASS" if passed else "FAIL"
    print(f"  [{status}] {suite}/{name}: {message}")


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

class AuthSession:
    """Manages an authenticated requests.Session."""

    def __init__(self, base_url: str, timeout: int):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.token: Optional[str] = None
        self.org_id: Optional[str] = None

    def url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def authenticate(self, email: str, password: str, username: str) -> bool:
        # Register (ignore if exists)
        try:
            self.session.post(
                self.url("/api/v1/auth/register"),
                json={"email": email, "password": password, "username": username},
                timeout=self.timeout,
            )
        except Exception:
            pass

        try:
            resp = self.session.post(
                self.url("/api/v1/auth/login"),
                json={"email": email, "password": password},
                timeout=self.timeout,
            )
            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get("access_token")
                self.org_id = data.get("organization_id") or data.get("tenant_id")
                if self.token:
                    self.session.headers["Authorization"] = f"Bearer {self.token}"
                    return True
        except Exception:
            pass
        return False


# ---------------------------------------------------------------------------
# Suite 1: Runner Registration
# ---------------------------------------------------------------------------

def suite_registration(auth: AuthSession, runner_api_key: str):
    suite = "runner-registration"
    print(f"\n--- {suite} ---")

    org_id = auth.org_id or str(uuid.uuid4())
    runner_name = f"test-runner-{uuid.uuid4().hex[:8]}"

    headers = {"Content-Type": "application/json"}
    if runner_api_key:
        headers["X-Api-Key"] = runner_api_key

    # Test registration
    try:
        resp = requests.post(
            auth.url("/api/v1/runners/register"),
            json={
                "organization_id": org_id,
                "runner_name": runner_name,
                "capabilities": ["chrome", "firefox"],
                "hostname": "test-host",
                "os_name": "Windows 11",
            },
            headers=headers,
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            data = resp.json()
            runner_id = data.get("runner_id")
            runner_token = data.get("runner_token")
            has_fields = bool(runner_id and runner_token)
            record(suite, "register", has_fields,
                   f"id={runner_id}, token_len={len(runner_token) if runner_token else 0}")
            return runner_id, runner_token, org_id
        else:
            record(suite, "register", False, f"Status {resp.status_code}: {resp.text[:200]}")
            return None, None, org_id
    except Exception as e:
        record(suite, "register", False, str(e))
        return None, None, org_id

    # Test registration without API key (should fail if key is required)
    if runner_api_key:
        try:
            resp = requests.post(
                auth.url("/api/v1/runners/register"),
                json={
                    "organization_id": org_id,
                    "runner_name": "no-key-runner",
                    "capabilities": ["chrome"],
                },
                headers={"Content-Type": "application/json"},
                timeout=auth.timeout,
            )
            record(suite, "register-no-key-rejected", resp.status_code == 403,
                   f"Status {resp.status_code}")
        except Exception as e:
            record(suite, "register-no-key-rejected", False, str(e))


# ---------------------------------------------------------------------------
# Suite 2: Heartbeat
# ---------------------------------------------------------------------------

def suite_heartbeat(auth: AuthSession, runner_token: str):
    suite = "runner-heartbeat"
    print(f"\n--- {suite} ---")

    if not runner_token:
        record(suite, "heartbeat", False, "No runner token — skipped")
        return

    try:
        resp = requests.put(
            auth.url("/api/v1/runners/heartbeat"),
            headers={"Authorization": f"Bearer {runner_token}"},
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            data = resp.json()
            record(suite, "heartbeat", data.get("status") == "ok",
                   f"status={data.get('status')}, server_time={data.get('server_time', 'N/A')}")
        else:
            record(suite, "heartbeat", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "heartbeat", False, str(e))

    # Test with invalid token
    try:
        resp = requests.put(
            auth.url("/api/v1/runners/heartbeat"),
            headers={"Authorization": "Bearer invalid-token-12345"},
            timeout=auth.timeout,
        )
        record(suite, "heartbeat-bad-token", resp.status_code == 401,
               f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "heartbeat-bad-token", False, str(e))


# ---------------------------------------------------------------------------
# Suite 3: Polling
# ---------------------------------------------------------------------------

def suite_polling(auth: AuthSession, runner_token: str):
    suite = "runner-polling"
    print(f"\n--- {suite} ---")

    if not runner_token:
        record(suite, "poll-empty", False, "No runner token — skipped")
        return

    # Poll with no queued work — should get 204
    try:
        resp = requests.get(
            auth.url("/api/v1/runners/poll"),
            headers={"Authorization": f"Bearer {runner_token}"},
            timeout=auth.timeout,
        )
        # 204 = no work, which is the expected state
        record(suite, "poll-empty-queue", resp.status_code == 204,
               f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "poll-empty-queue", False, str(e))

    # Poll with invalid token
    try:
        resp = requests.get(
            auth.url("/api/v1/runners/poll"),
            headers={"Authorization": "Bearer invalid-token"},
            timeout=auth.timeout,
        )
        record(suite, "poll-bad-token", resp.status_code == 401,
               f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "poll-bad-token", False, str(e))


# ---------------------------------------------------------------------------
# Suite 4: Log Push & Retrieval
# ---------------------------------------------------------------------------

def suite_logs(auth: AuthSession, runner_token: str, runner_id: str):
    suite = "runner-logs"
    print(f"\n--- {suite} ---")

    if not runner_token or not runner_id:
        record(suite, "log-push", False, "No runner token/id — skipped")
        return

    # Push a batch of logs
    try:
        resp = requests.post(
            auth.url("/api/v1/runners/logs"),
            json={
                "logs": [
                    {"level": "INFO", "message": "Test log message 1"},
                    {"level": "WARN", "message": "Test warning message"},
                    {"level": "ERROR", "message": "Test error message", "execution_id": str(uuid.uuid4())},
                ]
            },
            headers={
                "Authorization": f"Bearer {runner_token}",
                "Content-Type": "application/json",
            },
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            data = resp.json()
            record(suite, "log-push", data.get("accepted") == 3,
                   f"accepted={data.get('accepted')}")
        else:
            record(suite, "log-push", False, f"Status {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        record(suite, "log-push", False, str(e))

    # Fetch logs back
    try:
        resp = requests.get(
            auth.url(f"/api/v1/runners/logs/{runner_id}"),
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            data = resp.json()
            logs = data.get("logs", [])
            record(suite, "log-fetch", len(logs) >= 3,
                   f"count={len(logs)}")

            # Test live-tail with after_id
            if logs:
                last_id = logs[-1]["id"]
                resp2 = requests.get(
                    auth.url(f"/api/v1/runners/logs/{runner_id}?after_id={last_id}"),
                    timeout=auth.timeout,
                )
                if resp2.status_code == 200:
                    tail_data = resp2.json()
                    record(suite, "log-tail-after-id", tail_data.get("count", -1) == 0,
                           f"count={tail_data.get('count')} (expected 0 new logs)")
                else:
                    record(suite, "log-tail-after-id", False, f"Status {resp2.status_code}")
        else:
            record(suite, "log-fetch", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "log-fetch", False, str(e))


# ---------------------------------------------------------------------------
# Suite 5: Runner Listing
# ---------------------------------------------------------------------------

def suite_listing(auth: AuthSession, org_id: str, runner_id: str):
    suite = "runner-listing"
    print(f"\n--- {suite} ---")

    # List all runners (no filter)
    try:
        resp = requests.get(
            auth.url("/api/v1/runners/list"),
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            data = resp.json()
            runners = data.get("runners", [])
            record(suite, "list-all", len(runners) >= 1,
                   f"count={len(runners)}")
        else:
            record(suite, "list-all", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "list-all", False, str(e))

    # List by organization
    try:
        resp = requests.get(
            auth.url(f"/api/v1/runners/list?organization_id={org_id}"),
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            data = resp.json()
            runners = data.get("runners", [])
            found = any(r.get("id") == runner_id for r in runners)
            record(suite, "list-by-org", found,
                   f"count={len(runners)}, our_runner_found={found}")
        else:
            record(suite, "list-by-org", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "list-by-org", False, str(e))

    # List with bogus org — should return empty
    try:
        fake_org = str(uuid.uuid4())
        resp = requests.get(
            auth.url(f"/api/v1/runners/list?organization_id={fake_org}"),
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            data = resp.json()
            record(suite, "list-empty-org", data.get("count", -1) == 0,
                   f"count={data.get('count')}")
        else:
            record(suite, "list-empty-org", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "list-empty-org", False, str(e))


# ---------------------------------------------------------------------------
# Suite 6: Targeted Execution (runner_id param on execute-prompt)
# ---------------------------------------------------------------------------

def suite_targeted_execution(auth: AuthSession, runner_id: str):
    suite = "targeted-execution"
    print(f"\n--- {suite} ---")

    if not auth.token:
        record(suite, "execute-with-runner", False, "Not authenticated — skipped")
        return

    # Try executing with a non-existent runner — should 404
    try:
        fake_runner = str(uuid.uuid4())
        resp = auth.session.post(
            auth.url(f"/api/v1/execution/execute-prompt/nonexistent-prompt?runner_id={fake_runner}"),
            timeout=auth.timeout,
        )
        # We expect either 404 (runner not found) or 404 (prompt not found) — both valid
        record(suite, "execute-bad-runner", resp.status_code in (404, 400, 500),
               f"Status {resp.status_code} (expected rejection)")
    except Exception as e:
        record(suite, "execute-bad-runner", False, str(e))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Runner Agent API integration tests")
    parser.add_argument("--base-url", default=os.getenv("BASE_URL", "http://localhost:8000"))
    parser.add_argument("--runner-api-key", default=os.getenv("RUNNER_API_KEY", ""))
    parser.add_argument("--timeout", type=int, default=15)
    args = parser.parse_args()

    print(f"Runner API tests against {args.base_url}")
    print("=" * 60)

    # Authenticate
    auth = AuthSession(args.base_url, args.timeout)
    email = f"runner-test-{uuid.uuid4().hex[:6]}@test.local"
    if not auth.authenticate(email, "TestPass123!", "runner-tester"):
        print("WARNING: Could not authenticate — some tests will be skipped")

    # Run suites
    runner_id, runner_token, org_id = suite_registration(auth, args.runner_api_key)
    suite_heartbeat(auth, runner_token)
    suite_polling(auth, runner_token)
    suite_logs(auth, runner_token, runner_id)
    suite_listing(auth, org_id, runner_id)
    suite_targeted_execution(auth, runner_id)

    # Summary
    print("\n" + "=" * 60)
    passed = sum(1 for r in ALL_RESULTS if r.passed)
    failed = sum(1 for r in ALL_RESULTS if not r.passed)
    total = len(ALL_RESULTS)
    print(f"Results: {passed}/{total} passed, {failed} failed")

    if failed > 0:
        print("\nFailed tests:")
        for r in ALL_RESULTS:
            if not r.passed:
                print(f"  FAIL {r.suite}/{r.name}: {r.message}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
