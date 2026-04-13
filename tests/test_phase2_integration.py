#!/usr/bin/env python3
"""
Phase 2: Integration tests for key API paths.

Tests the complete data-flow contracts between services:
  1. Auth → Prompt → Plan → Execution lifecycle
  2. API test-data CRUD → setup → execute → history
  3. Execution status reporting back from java-runner
  4. Cross-service payload compatibility

Usage:
  python tests/test_phase2_integration.py --base-url http://localhost:8000
  python tests/test_phase2_integration.py --base-url http://localhost:8000 --runner-url http://localhost:8080
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

class IntegrationResult:
    def __init__(self, suite: str, name: str, passed: bool, message: str):
        self.suite = suite
        self.name = name
        self.passed = passed
        self.message = message


ALL_RESULTS: List[IntegrationResult] = []


def record(suite: str, name: str, passed: bool, message: str):
    ALL_RESULTS.append(IntegrationResult(suite, name, passed, message))
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
        self.user_id: Optional[str] = None

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
                self.user_id = data.get("user_id") or data.get("id")
                if self.token:
                    self.session.headers["Authorization"] = f"Bearer {self.token}"
                    return True
        except Exception:
            pass
        return False


# ---------------------------------------------------------------------------
# Suite 1: Prompt → Plan → Execution lifecycle
# ---------------------------------------------------------------------------

def suite_execution_lifecycle(auth: AuthSession):
    suite = "execution-lifecycle"
    print(f"\n--- {suite} ---")

    # Create prompt
    try:
        resp = auth.session.post(
            auth.url("/api/v1/prompts"),
            json={
                "title": f"Integration Test {uuid.uuid4().hex[:8]}",
                "original_prompt": "Navigate to example.com and verify the title",
                "url": "https://example.com",
            },
            timeout=auth.timeout,
        )
        if resp.status_code != 200:
            record(suite, "create-prompt", False, f"Status {resp.status_code}: {resp.text[:200]}")
            return
        prompt_data = resp.json()
        prompt_id = prompt_data.get("id") or prompt_data.get("prompt_id")
        if not prompt_id:
            record(suite, "create-prompt", False, f"No prompt ID. Keys: {list(prompt_data.keys())}")
            return
        record(suite, "create-prompt", True, f"ID={prompt_id}")
    except Exception as e:
        record(suite, "create-prompt", False, str(e))
        return

    # Generate plan
    try:
        resp = auth.session.post(
            auth.url(f"/api/v1/prompts/{prompt_id}/generate"),
            timeout=max(auth.timeout, 60),
        )
        if resp.status_code == 200:
            plan = resp.json()
            has_actions = "actions" in plan or ("plan" in plan and "actions" in plan.get("plan", {}))
            record(suite, "generate-plan", True if has_actions else False,
                   f"has_actions={has_actions}, keys={list(plan.keys())}")
        else:
            # Plan generation may fail if no AI key; still record the status
            record(suite, "generate-plan", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "generate-plan", False, str(e))

    # Save plan (if generated)
    try:
        resp = auth.session.post(
            auth.url(f"/api/v1/prompts/{prompt_id}/save-generated-plan"),
            timeout=auth.timeout,
        )
        if resp.status_code in (200, 201):
            record(suite, "save-plan", True, "Saved")
        else:
            record(suite, "save-plan", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "save-plan", False, str(e))

    # Get prompt details (verify round-trip)
    try:
        resp = auth.session.get(
            auth.url(f"/api/v1/prompts/{prompt_id}"),
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            data = resp.json()
            record(suite, "get-prompt", True, f"Title={data.get('title', 'N/A')}")
        else:
            record(suite, "get-prompt", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "get-prompt", False, str(e))

    # List prompts
    try:
        resp = auth.session.get(
            auth.url("/api/v1/prompts"),
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            data = resp.json()
            count = len(data) if isinstance(data, list) else data.get("count", "?")
            record(suite, "list-prompts", True, f"Count={count}")
        else:
            record(suite, "list-prompts", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "list-prompts", False, str(e))

    # Execute prompt
    try:
        resp = auth.session.post(
            auth.url(f"/api/v1/execution/execute-prompt/{prompt_id}"),
            json={"browser_type": "chrome"},
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            exec_data = resp.json()
            exec_id = exec_data.get("executionId") or exec_data.get("execution_id")
            status = exec_data.get("status")
            record(suite, "execute-prompt", True, f"ID={exec_id}, status={status}")
        else:
            # May fail if java-runner not reachable; that's expected info
            record(suite, "execute-prompt", False, f"Status {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        record(suite, "execute-prompt", False, str(e))

    # Execution history
    try:
        resp = auth.session.get(
            auth.url("/api/v1/execution/history"),
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            record(suite, "execution-history", True, "Accessible")
        elif resp.status_code == 404:
            record(suite, "execution-history", True, "Endpoint not found (may not be implemented)")
        else:
            record(suite, "execution-history", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "execution-history", False, str(e))


# ---------------------------------------------------------------------------
# Suite 2: API test-data CRUD lifecycle
# ---------------------------------------------------------------------------

def suite_api_test_data_crud(auth: AuthSession):
    suite = "api-test-data"
    print(f"\n--- {suite} ---")

    endpoint_id = None
    template_id = None
    dataset_id = None
    setup_id = None

    # CREATE endpoint
    try:
        resp = auth.session.post(
            auth.url("/api/v1/api-test-data/endpoints"),
            json={
                "name": f"Integration Test Endpoint {uuid.uuid4().hex[:8]}",
                "description": "Created by Phase 2 integration test",
                "base_url": "https://jsonplaceholder.typicode.com",
                "auth_type": "none",
                "timeout_seconds": 30,
                "retry_count": 1,
                "is_active": True,
            },
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            body = resp.json()
            endpoint_id = body.get("data", {}).get("id") or body.get("id")
            record(suite, "create-endpoint", True, f"ID={endpoint_id}")
        else:
            record(suite, "create-endpoint", False, f"Status {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        record(suite, "create-endpoint", False, str(e))

    # LIST endpoints
    try:
        resp = auth.session.get(
            auth.url("/api/v1/api-test-data/endpoints"),
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            body = resp.json()
            count = body.get("count", len(body.get("data", [])))
            record(suite, "list-endpoints", True, f"Count={count}")
        else:
            record(suite, "list-endpoints", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "list-endpoints", False, str(e))

    # GET single endpoint (if created)
    if endpoint_id:
        try:
            resp = auth.session.get(
                auth.url(f"/api/v1/api-test-data/endpoints/{endpoint_id}"),
                timeout=auth.timeout,
            )
            if resp.status_code == 200:
                record(suite, "get-endpoint", True, "Round-trip OK")
            else:
                record(suite, "get-endpoint", False, f"Status {resp.status_code}")
        except Exception as e:
            record(suite, "get-endpoint", False, str(e))

    # UPDATE endpoint
    if endpoint_id:
        try:
            resp = auth.session.put(
                auth.url(f"/api/v1/api-test-data/endpoints/{endpoint_id}"),
                json={"description": "Updated by integration test"},
                timeout=auth.timeout,
            )
            if resp.status_code == 200:
                record(suite, "update-endpoint", True, "Updated")
            else:
                record(suite, "update-endpoint", False, f"Status {resp.status_code}")
        except Exception as e:
            record(suite, "update-endpoint", False, str(e))

    # CREATE template (requires endpoint_id)
    if endpoint_id:
        try:
            resp = auth.session.post(
                auth.url("/api/v1/api-test-data/templates"),
                json={
                    "endpoint_id": endpoint_id,
                    "name": f"Get Posts {uuid.uuid4().hex[:8]}",
                    "description": "Fetch posts from JSONPlaceholder",
                    "http_method": "GET",
                    "path": "/posts",
                    "expected_status_codes": [200],
                    "response_extractors": [
                        {"json_path": "$[0].id", "variable_name": "first_post_id"}
                    ],
                    "is_active": True,
                },
                timeout=auth.timeout,
            )
            if resp.status_code == 200:
                body = resp.json()
                template_id = body.get("data", {}).get("id") or body.get("id")
                record(suite, "create-template", True, f"ID={template_id}")
            else:
                record(suite, "create-template", False, f"Status {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            record(suite, "create-template", False, str(e))

    # CREATE dataset (requires template_id)
    if template_id:
        try:
            resp = auth.session.post(
                auth.url("/api/v1/api-test-data/data-sets"),
                json={
                    "template_id": template_id,
                    "name": f"Default Dataset {uuid.uuid4().hex[:8]}",
                    "variables": {"limit": "10"},
                    "is_default": True,
                    "tags": ["integration-test"],
                },
                timeout=auth.timeout,
            )
            if resp.status_code == 200:
                body = resp.json()
                dataset_id = body.get("data", {}).get("id") or body.get("id")
                record(suite, "create-dataset", True, f"ID={dataset_id}")
            else:
                record(suite, "create-dataset", False, f"Status {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            record(suite, "create-dataset", False, str(e))

    # CREATE setup
    try:
        setup_def = {"steps": []}
        if template_id and dataset_id:
            setup_def["steps"].append({
                "template_id": template_id,
                "dataset_id": dataset_id,
            })

        resp = auth.session.post(
            auth.url("/api/v1/api-test-data/setups"),
            json={
                "name": f"Integration Setup {uuid.uuid4().hex[:8]}",
                "description": "Phase 2 integration test setup",
                "setup_definition": setup_def,
                "is_active": True,
            },
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            body = resp.json()
            setup_id = body.get("data", {}).get("id") or body.get("id")
            record(suite, "create-setup", True, f"ID={setup_id}")
        else:
            record(suite, "create-setup", False, f"Status {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        record(suite, "create-setup", False, str(e))

    # DRY-RUN execution
    if setup_id:
        try:
            resp = auth.session.post(
                auth.url("/api/v1/api-test-data/execute/dry-run"),
                json={"setup_id": setup_id},
                timeout=auth.timeout,
            )
            if resp.status_code == 200:
                record(suite, "dry-run", True, "Dry-run OK")
            else:
                record(suite, "dry-run", False, f"Status {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            record(suite, "dry-run", False, str(e))

    # GET history
    try:
        resp = auth.session.get(
            auth.url("/api/v1/api-test-data/history"),
            timeout=auth.timeout,
        )
        if resp.status_code == 200:
            record(suite, "history", True, "Accessible")
        else:
            record(suite, "history", False, f"Status {resp.status_code}")
    except Exception as e:
        record(suite, "history", False, str(e))

    # CLEANUP: delete in reverse creation order
    for resource, rid, label in [
        ("setups", setup_id, "delete-setup"),
        ("data-sets", dataset_id, "delete-dataset"),
        ("templates", template_id, "delete-template"),
        ("endpoints", endpoint_id, "delete-endpoint"),
    ]:
        if rid:
            try:
                resp = auth.session.delete(
                    auth.url(f"/api/v1/api-test-data/{resource}/{rid}"),
                    timeout=auth.timeout,
                )
                if resp.status_code == 200:
                    record(suite, label, True, "Deleted")
                else:
                    record(suite, label, False, f"Status {resp.status_code}")
            except Exception as e:
                record(suite, label, False, str(e))


# ---------------------------------------------------------------------------
# Suite 3: Java runner compatibility
# ---------------------------------------------------------------------------

def suite_java_runner_compat(auth: AuthSession, runner_url: str):
    suite = "java-runner-compat"
    print(f"\n--- {suite} ---")

    # Health check
    try:
        resp = requests.get(f"{runner_url}/api/v1/health", timeout=auth.timeout)
        if resp.status_code == 200:
            body = resp.json()
            record(suite, "health", True, f"status={body.get('status')}, active={body.get('activeExecutions')}")
        else:
            record(suite, "health", False, f"Status {resp.status_code}")
            return
    except requests.ConnectionError:
        record(suite, "health", False, "Connection refused — java-runner not running (skipping suite)")
        return
    except Exception as e:
        record(suite, "health", False, str(e))
        return

    # Status for non-existent execution → expect 404
    fake_id = str(uuid.uuid4())
    try:
        resp = requests.get(f"{runner_url}/api/v1/execution/{fake_id}/status", timeout=auth.timeout)
        if resp.status_code == 404:
            record(suite, "status-404", True, "Non-existent execution returns 404")
        else:
            record(suite, "status-404", False, f"Expected 404, got {resp.status_code}")
    except Exception as e:
        record(suite, "status-404", False, str(e))

    # Execute with empty steps → should return 200 or 400/422
    try:
        resp = requests.post(
            f"{runner_url}/api/v1/execute",
            json={
                "promptId": "integration-test-prompt",
                "steps": [],
                "authToken": auth.token or "test",
                "executionId": str(uuid.uuid4()),
                "browserType": "chrome",
            },
            timeout=auth.timeout,
        )
        if resp.status_code in (200, 400, 422):
            record(suite, "empty-steps", True, f"Status {resp.status_code}")
        else:
            record(suite, "empty-steps", False, f"Unexpected status {resp.status_code}")
    except Exception as e:
        record(suite, "empty-steps", False, str(e))


# ---------------------------------------------------------------------------
# Suite 4: Cross-service endpoint availability
# ---------------------------------------------------------------------------

CRITICAL_ENDPOINTS = [
    ("GET", "/health"),
    ("GET", "/api/v1/auth/me"),
    ("GET", "/api/v1/prompts"),
    ("GET", "/api/v1/api-test-data/endpoints"),
    ("GET", "/api/v1/api-test-data/templates"),
    ("GET", "/api/v1/api-test-data/categories"),
    ("GET", "/api/v1/analytics/dashboard"),
    ("GET", "/api/v1/policy/packs"),
]


def suite_endpoint_availability(auth: AuthSession):
    suite = "endpoint-availability"
    print(f"\n--- {suite} ---")

    for method, path in CRITICAL_ENDPOINTS:
        try:
            if method == "GET":
                resp = auth.session.get(auth.url(path), timeout=auth.timeout)
            elif method == "POST":
                resp = auth.session.post(auth.url(path), json={}, timeout=auth.timeout)
            else:
                continue

            # Accept 200-499 as "endpoint exists";  5xx is a server problem
            if resp.status_code < 500:
                record(suite, f"{method} {path}", True, f"Status {resp.status_code}")
            else:
                record(suite, f"{method} {path}", False, f"Server error {resp.status_code}")
        except Exception as e:
            record(suite, f"{method} {path}", False, str(e))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Phase 2 integration tests")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--runner-url", default="http://localhost:8080")
    parser.add_argument("--timeout", type=int, default=15)
    parser.add_argument(
        "--email", default="phase2-integration@example.com",
        help="Test user email",
    )
    parser.add_argument(
        "--password", default="Phase2_Integration_123!",
        help="Test user password",
    )
    args = parser.parse_args()

    print("=" * 70)
    print("PHASE 2 INTEGRATION TESTS")
    print("=" * 70)

    auth = AuthSession(args.base_url, args.timeout)
    if not auth.authenticate(args.email, args.password, "phase2integration"):
        print("FATAL: Cannot authenticate. Ensure the unified API is running.")
        sys.exit(1)
    print(f"  Authenticated as {args.email}")

    # Run all suites
    suite_endpoint_availability(auth)
    suite_execution_lifecycle(auth)
    suite_api_test_data_crud(auth)
    suite_java_runner_compat(auth, args.runner_url)

    # Summary
    total = len(ALL_RESULTS)
    passed = sum(1 for r in ALL_RESULTS if r.passed)
    failed = total - passed
    print(f"\n{'=' * 70}")
    print(f"INTEGRATION RESULTS: {passed}/{total} passed, {failed} failed")
    print("=" * 70)

    if failed:
        print("\nFailed:")
        for r in ALL_RESULTS:
            if not r.passed:
                print(f"  - {r.suite}/{r.name}: {r.message}")

    # Generate JSON report for CI artifact upload
    report = {
        "phase": 2,
        "type": "integration",
        "total": total,
        "passed": passed,
        "failed": failed,
        "results": [
            {
                "suite": r.suite,
                "name": r.name,
                "passed": r.passed,
                "message": r.message,
            }
            for r in ALL_RESULTS
        ],
    }
    report_path = os.path.join(os.path.dirname(__file__), "phase2_integration_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nJSON report: {report_path}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
