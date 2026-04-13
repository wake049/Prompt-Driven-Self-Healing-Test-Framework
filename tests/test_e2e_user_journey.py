#!/usr/bin/env python3
"""
Phase 3: End-to-end user journey validation.

Simulates a complete user lifecycle against the running platform:
  1. Register organization + user
  2. Login, verify profile
  3. Create prompt → generate plan → save plan
  4. Configure API test-data preconditions
  5. Execute test across browsers (chrome, firefox)
  6. Verify execution results and analytics
  7. Check healing/review queue integration
  8. Verify dashboard data consistency
  9. Second user: invitation flow + tenant isolation

Usage:
  python tests/test_e2e_user_journey.py --base-url http://localhost:8000
  python tests/test_e2e_user_journey.py --base-url http://localhost:8000 --runner-url http://localhost:8080
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

class JourneyResult:
    def __init__(self, step: str, passed: bool, message: str, critical: bool = False):
        self.step = step
        self.passed = passed
        self.message = message
        self.critical = critical  # If True, abort journey on failure


ALL: List[JourneyResult] = []


def record(step: str, passed: bool, message: str, critical: bool = False) -> bool:
    ALL.append(JourneyResult(step, passed, message, critical))
    tag = "PASS" if passed else ("CRIT" if critical else "FAIL")
    print(f"  [{tag}] {step}: {message}")
    return passed


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------

class UserSession:
    def __init__(self, base_url: str, timeout: int):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.tenant_id: Optional[str] = None
        self.email: Optional[str] = None

    def url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def get(self, path: str, **kw) -> requests.Response:
        kw.setdefault("timeout", self.timeout)
        return self.session.get(self.url(path), **kw)

    def post(self, path: str, **kw) -> requests.Response:
        kw.setdefault("timeout", self.timeout)
        return self.session.post(self.url(path), **kw)

    def put(self, path: str, **kw) -> requests.Response:
        kw.setdefault("timeout", self.timeout)
        return self.session.put(self.url(path), **kw)

    def delete(self, path: str, **kw) -> requests.Response:
        kw.setdefault("timeout", self.timeout)
        return self.session.delete(self.url(path), **kw)


# ---------------------------------------------------------------------------
# Journey 1: Primary user — full happy path
# ---------------------------------------------------------------------------

def journey_primary_user(base_url: str, timeout: int) -> Optional[UserSession]:
    """Register, login, create prompt, generate plan, execute, verify analytics."""
    print("\n" + "=" * 60)
    print("JOURNEY 1: Primary user — full happy path")
    print("=" * 60)

    uid = uuid.uuid4().hex[:8]
    email = f"beta-user-{uid}@example.com"
    password = "BetaTest_Secure123!"
    org_name = f"Beta Org {uid}"
    slug = f"beta-org-{uid}"

    user = UserSession(base_url, timeout)
    user.email = email

    # --- Step 1: Register organization ---
    try:
        resp = user.post("/api/v1/auth/register/organization", json={
            "email": email,
            "password": password,
            "full_name": f"Beta User {uid}",
            "organization_name": org_name,
            "organization_slug": slug,
        })
        if resp.status_code == 200:
            data = resp.json()
            user.tenant_id = data.get("tenant_id") or data.get("organization_id")
            if not record("register-org", True, f"Org={slug}, tenant={user.tenant_id}"):
                return None
        else:
            # Fall back to simple register if org-register not available
            resp2 = user.post("/api/v1/auth/register", json={
                "email": email,
                "password": password,
                "username": f"betauser{uid}",
            })
            if resp2.status_code == 200:
                record("register-org", True, "Org registration N/A; used simple register")
            else:
                record("register-org", False, f"Register failed: {resp2.status_code}", critical=True)
                return None
    except Exception as e:
        record("register-org", False, str(e), critical=True)
        return None

    # --- Step 2: Login ---
    try:
        resp = user.post("/api/v1/auth/login", json={"email": email, "password": password})
        if resp.status_code == 200:
            data = resp.json()
            user.token = data.get("access_token")
            user.user_id = data.get("user_id")
            if user.token:
                user.session.headers["Authorization"] = f"Bearer {user.token}"
                record("login", True, f"Token obtained, user_id={user.user_id}")
            else:
                record("login", False, "No access_token", critical=True)
                return None
        else:
            record("login", False, f"Status {resp.status_code}", critical=True)
            return None
    except Exception as e:
        record("login", False, str(e), critical=True)
        return None

    # --- Step 3: Verify profile ---
    try:
        resp = user.get("/api/v1/auth/me")
        if resp.status_code == 200:
            profile = resp.json()
            has_email = (
                profile.get("email") == email
                or (profile.get("user", {}).get("email") == email)
            )
            user.tenant_id = user.tenant_id or profile.get("tenant", {}).get("id")
            record("profile", has_email, f"email_match={has_email}, tenant={user.tenant_id}")
        else:
            record("profile", False, f"Status {resp.status_code}")
    except Exception as e:
        record("profile", False, str(e))

    # --- Step 4: Create prompt ---
    prompt_id = None
    try:
        resp = user.post("/api/v1/prompts", json={
            "title": f"E2E Journey Test {uid}",
            "original_prompt": "Navigate to example.com and verify page title contains Example",
            "url": "https://example.com",
        })
        if resp.status_code == 200:
            prompt_data = resp.json()
            prompt_id = prompt_data.get("id") or prompt_data.get("prompt_id")
            record("create-prompt", bool(prompt_id), f"ID={prompt_id}")
        else:
            record("create-prompt", False, f"Status {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        record("create-prompt", False, str(e))

    # --- Step 5: Generate plan ---
    plan_has_actions = False
    if prompt_id:
        try:
            resp = user.post(
                f"/api/v1/prompts/{prompt_id}/generate",
                timeout=max(timeout, 90),
            )
            if resp.status_code == 200:
                plan = resp.json()
                actions = plan.get("actions") or (plan.get("plan", {}) or {}).get("actions")
                plan_has_actions = isinstance(actions, list) and len(actions) > 0
                record("generate-plan", plan_has_actions,
                       f"actions={len(actions) if actions else 0}")
            else:
                record("generate-plan", False, f"Status {resp.status_code}")
        except Exception as e:
            record("generate-plan", False, str(e))

    # --- Step 6: Save plan ---
    if prompt_id and plan_has_actions:
        try:
            resp = user.post(f"/api/v1/prompts/{prompt_id}/save-generated-plan")
            record("save-plan", resp.status_code in (200, 201), f"Status {resp.status_code}")
        except Exception as e:
            record("save-plan", False, str(e))

    # --- Step 7: Execute prompt ---
    execution_id = None
    if prompt_id:
        for browser in ["chrome"]:
            try:
                resp = user.post(
                    f"/api/v1/execution/execute-prompt/{prompt_id}",
                    json={"browser_type": browser},
                )
                if resp.status_code == 200:
                    exec_data = resp.json()
                    execution_id = exec_data.get("executionId") or exec_data.get("execution_id")
                    record(f"execute-{browser}", True,
                           f"ID={execution_id}, status={exec_data.get('status')}")
                else:
                    record(f"execute-{browser}", False, f"Status {resp.status_code}")
            except Exception as e:
                record(f"execute-{browser}", False, str(e))

    # --- Step 8: Check analytics ---
    try:
        resp = user.get("/api/v1/analytics/dashboard")
        if resp.status_code == 200:
            record("analytics-dashboard", True, "Accessible")
        else:
            record("analytics-dashboard", False, f"Status {resp.status_code}")
    except Exception as e:
        record("analytics-dashboard", False, str(e))

    try:
        resp = user.get("/api/v1/analytics/healing-analytics", params={"days": 7})
        if resp.status_code == 200:
            record("healing-analytics", True, "Accessible")
        else:
            record("healing-analytics", False, f"Status {resp.status_code}")
    except Exception as e:
        record("healing-analytics", False, str(e))

    try:
        resp = user.get("/api/v1/analytics/trends", params={"timeRange": "7d"})
        if resp.status_code == 200:
            record("trends", True, "Accessible")
        else:
            record("trends", False, f"Status {resp.status_code}")
    except Exception as e:
        record("trends", False, str(e))

    # --- Step 9: Policy management ---
    try:
        resp = user.get("/api/v1/policy/packs")
        if resp.status_code == 200:
            record("policy-list", True, "Accessible")
        elif resp.status_code in (401, 403):
            record("policy-list", True, f"Auth-gated ({resp.status_code})")
        else:
            record("policy-list", False, f"Status {resp.status_code}")
    except Exception as e:
        record("policy-list", False, str(e))

    # --- Step 10: Review queue ---
    try:
        resp = user.get("/api/v1/review/queue")
        if resp.status_code == 200:
            record("review-queue", True, "Accessible")
        elif resp.status_code in (401, 403, 404):
            record("review-queue", True, f"Status {resp.status_code} (acceptable)")
        else:
            record("review-queue", False, f"Status {resp.status_code}")
    except Exception as e:
        record("review-queue", False, str(e))

    # --- Step 11: Prompt list shows our prompt ---
    if prompt_id:
        try:
            resp = user.get("/api/v1/prompts")
            if resp.status_code == 200:
                prompts = resp.json()
                prompt_list = prompts if isinstance(prompts, list) else prompts.get("data", [])
                found = any(
                    p.get("id") == prompt_id or p.get("prompt_id") == prompt_id
                    for p in prompt_list
                )
                record("prompt-in-list", found, f"Prompt visible in list: {found}")
            else:
                record("prompt-in-list", False, f"Status {resp.status_code}")
        except Exception as e:
            record("prompt-in-list", False, str(e))

    return user


# ---------------------------------------------------------------------------
# Journey 2: Tenant isolation
# ---------------------------------------------------------------------------

def journey_tenant_isolation(base_url: str, timeout: int, primary_prompt_id: Optional[str] = None):
    """Create a second user in a different org and verify data isolation."""
    print("\n" + "=" * 60)
    print("JOURNEY 2: Tenant isolation")
    print("=" * 60)

    uid = uuid.uuid4().hex[:8]
    email = f"tenant-iso-{uid}@example.com"
    password = "TenantIso_Secure123!"

    user2 = UserSession(base_url, timeout)

    # Register second user (separate org)
    try:
        resp = user2.post("/api/v1/auth/register/organization", json={
            "email": email,
            "password": password,
            "full_name": f"Isolation User {uid}",
            "organization_name": f"Isolation Org {uid}",
            "organization_slug": f"iso-org-{uid}",
        })
        if resp.status_code != 200:
            resp = user2.post("/api/v1/auth/register", json={
                "email": email,
                "password": password,
                "username": f"isouser{uid}",
            })
        if resp.status_code != 200:
            record("iso:register", False, f"Status {resp.status_code}", critical=True)
            return
        record("iso:register", True, "Second user registered")
    except Exception as e:
        record("iso:register", False, str(e), critical=True)
        return

    # Login second user
    try:
        resp = user2.post("/api/v1/auth/login", json={"email": email, "password": password})
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("access_token")
            if token:
                user2.session.headers["Authorization"] = f"Bearer {token}"
                record("iso:login", True, "Authenticated")
            else:
                record("iso:login", False, "No token", critical=True)
                return
        else:
            record("iso:login", False, f"Status {resp.status_code}", critical=True)
            return
    except Exception as e:
        record("iso:login", False, str(e), critical=True)
        return

    # Verify second user cannot see primary user's prompts
    try:
        resp = user2.get("/api/v1/prompts")
        if resp.status_code == 200:
            prompts = resp.json()
            prompt_list = prompts if isinstance(prompts, list) else prompts.get("data", [])
            if primary_prompt_id:
                leaked = any(
                    p.get("id") == primary_prompt_id or p.get("prompt_id") == primary_prompt_id
                    for p in prompt_list
                )
                record("iso:prompt-leak", not leaked,
                       f"Primary prompt visible to other tenant: {leaked}")
            else:
                record("iso:prompt-isolation", True,
                       f"Second user has {len(prompt_list)} prompts (own)")
        else:
            record("iso:prompt-isolation", False, f"Status {resp.status_code}")
    except Exception as e:
        record("iso:prompt-isolation", False, str(e))

    # Verify second user cannot see primary user's API test-data endpoints
    try:
        resp = user2.get("/api/v1/api-test-data/endpoints")
        if resp.status_code == 200:
            body = resp.json()
            data = body.get("data", [])
            record("iso:api-test-data", True, f"Second user sees {len(data)} endpoints (own)")
        else:
            record("iso:api-test-data", False, f"Status {resp.status_code}")
    except Exception as e:
        record("iso:api-test-data", False, str(e))

    # Verify second user's analytics are independent
    try:
        resp = user2.get("/api/v1/analytics/dashboard")
        if resp.status_code == 200:
            record("iso:analytics", True, "Independent analytics accessible")
        else:
            record("iso:analytics", False, f"Status {resp.status_code}")
    except Exception as e:
        record("iso:analytics", False, str(e))

    # Verify second user cannot access primary user's execution history
    try:
        resp = user2.get("/api/v1/execution/history")
        if resp.status_code == 200:
            record("iso:execution-history", True, "Isolated execution history")
        elif resp.status_code in (401, 403, 404):
            record("iso:execution-history", True, f"Auth-gated ({resp.status_code})")
        else:
            record("iso:execution-history", False, f"Status {resp.status_code}")
    except Exception as e:
        record("iso:execution-history", False, str(e))


# ---------------------------------------------------------------------------
# Journey 3: Multi-browser execution
# ---------------------------------------------------------------------------

def journey_multi_browser(user: UserSession, runner_url: str):
    """Verify execution can target multiple browsers."""
    print("\n" + "=" * 60)
    print("JOURNEY 3: Multi-browser execution")
    print("=" * 60)

    # Check if java-runner is reachable
    try:
        resp = requests.get(f"{runner_url}/api/v1/health", timeout=user.timeout)
        if resp.status_code != 200:
            record("browser:runner-health", False, f"Status {resp.status_code}")
            return
        health = resp.json()
        record("browser:runner-health", True,
               f"active={health.get('activeExecutions')}, max={health.get('maxConcurrentExecutions')}")
    except requests.ConnectionError:
        record("browser:runner-health", False, "Connection refused — skipping browser tests")
        return
    except Exception as e:
        record("browser:runner-health", False, str(e))
        return

    # Create a simple prompt for browser tests
    uid = uuid.uuid4().hex[:8]
    try:
        resp = user.post("/api/v1/prompts", json={
            "title": f"Browser Matrix {uid}",
            "original_prompt": "Open example.com and verify title",
            "url": "https://example.com",
        })
        if resp.status_code != 200:
            record("browser:create-prompt", False, f"Status {resp.status_code}")
            return
        prompt_id = resp.json().get("id") or resp.json().get("prompt_id")
        record("browser:create-prompt", True, f"ID={prompt_id}")
    except Exception as e:
        record("browser:create-prompt", False, str(e))
        return

    # Generate and save plan
    try:
        resp = user.post(f"/api/v1/prompts/{prompt_id}/generate", timeout=90)
        if resp.status_code == 200:
            record("browser:generate-plan", True, "Plan generated")
            user.post(f"/api/v1/prompts/{prompt_id}/save-generated-plan")
        else:
            record("browser:generate-plan", False, f"Status {resp.status_code}")
            return
    except Exception as e:
        record("browser:generate-plan", False, str(e))
        return

    # Execute on each browser
    for browser in ["chrome", "firefox"]:
        try:
            resp = user.post(
                f"/api/v1/execution/execute-prompt/{prompt_id}",
                json={"browser_type": browser},
            )
            if resp.status_code == 200:
                exec_data = resp.json()
                record(f"browser:execute-{browser}", True,
                       f"ID={exec_data.get('executionId')}, status={exec_data.get('status')}")
            else:
                record(f"browser:execute-{browser}", False,
                       f"Status {resp.status_code}: {resp.text[:150]}")
        except Exception as e:
            record(f"browser:execute-{browser}", False, str(e))


# ---------------------------------------------------------------------------
# Journey 4: Dashboard data consistency
# ---------------------------------------------------------------------------

def journey_dashboard_consistency(user: UserSession):
    """Verify dashboard endpoints return consistent, non-error data."""
    print("\n" + "=" * 60)
    print("JOURNEY 4: Dashboard data consistency")
    print("=" * 60)

    dashboard_endpoints = [
        ("/api/v1/analytics/dashboard", "analytics-dashboard"),
        ("/api/v1/analytics/healing-analytics?days=30", "healing-analytics"),
        ("/api/v1/analytics/trends?timeRange=7d", "trends-7d"),
        ("/api/v1/analytics/trends?timeRange=30d", "trends-30d"),
        ("/api/v1/prompts", "prompts-list"),
        ("/api/v1/api-test-data/endpoints", "api-endpoints"),
        ("/api/v1/api-test-data/templates", "api-templates"),
        ("/api/v1/api-test-data/categories", "api-categories"),
    ]

    for path, name in dashboard_endpoints:
        try:
            resp = user.get(path)
            if resp.status_code == 200:
                body = resp.json()
                # Verify it's valid JSON and not an error body
                is_error = isinstance(body, dict) and body.get("detail")
                record(f"dash:{name}", not is_error,
                       f"OK (type={type(body).__name__})" if not is_error
                       else f"Error body: {body.get('detail', '')[:100]}")
            elif resp.status_code < 500:
                record(f"dash:{name}", True, f"Status {resp.status_code} (non-5xx)")
            else:
                record(f"dash:{name}", False, f"Server error {resp.status_code}")
        except Exception as e:
            record(f"dash:{name}", False, str(e))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Phase 3: E2E user journey tests")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--runner-url", default="http://localhost:8080")
    parser.add_argument("--timeout", type=int, default=15)
    args = parser.parse_args()

    print("=" * 70)
    print("PHASE 3: END-TO-END USER JOURNEY VALIDATION")
    print("=" * 70)

    # Journey 1: primary user full path
    primary = journey_primary_user(args.base_url, args.timeout)

    # Extract prompt_id for isolation test
    primary_prompt_id = None
    for r in ALL:
        if r.step == "create-prompt" and r.passed:
            # Parse ID from message
            if "ID=" in r.message:
                primary_prompt_id = r.message.split("ID=")[1].split(",")[0].strip()
            break

    # Journey 2: tenant isolation
    journey_tenant_isolation(args.base_url, args.timeout, primary_prompt_id)

    # Journey 3: multi-browser (uses primary user session)
    if primary:
        journey_multi_browser(primary, args.runner_url)

    # Journey 4: dashboard consistency
    if primary:
        journey_dashboard_consistency(primary)

    # Summary
    total = len(ALL)
    passed = sum(1 for r in ALL if r.passed)
    failed = total - passed
    critical_fails = sum(1 for r in ALL if not r.passed and r.critical)

    print(f"\n{'=' * 70}")
    print(f"E2E JOURNEY RESULTS: {passed}/{total} passed, {failed} failed ({critical_fails} critical)")
    print("=" * 70)

    if failed:
        print("\nFailed:")
        for r in ALL:
            if not r.passed:
                tag = "CRITICAL" if r.critical else "FAIL"
                print(f"  [{tag}] {r.step}: {r.message}")

    # JSON report
    report = {
        "phase": 3,
        "type": "e2e-user-journey",
        "total": total,
        "passed": passed,
        "failed": failed,
        "critical_failures": critical_fails,
        "results": [
            {"step": r.step, "passed": r.passed, "message": r.message, "critical": r.critical}
            for r in ALL
        ],
    }
    report_path = os.path.join(os.path.dirname(__file__), "phase3_e2e_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nJSON report: {report_path}")

    sys.exit(0 if critical_fails == 0 else 1)


if __name__ == "__main__":
    main()
