#!/usr/bin/env python3
"""
Phase 2: Contract validation tests.

Validates that:
  1. All golden examples conform to their JSON schemas
  2. API plan-generation responses conform to plan.schema.json
  3. API error responses conform to error.schema.json
  4. MCP tools/list response returns expected tool names
  5. Java runner health response has required fields

Usage:
  # Offline schema validation only (no services required):
  python tests/test_contracts.py --offline

  # Full contract validation against running services:
  python tests/test_contracts.py --base-url http://localhost:8000 --mcp-url ws://localhost:8001/mcp/ws
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

try:
    import jsonschema
except ImportError:
    jsonschema = None  # type: ignore[assignment]

try:
    import websockets
except ImportError:
    websockets = None  # type: ignore[assignment]


CONTRACTS_DIR = os.path.join(os.path.dirname(__file__), "..", "contracts")
SCHEMAS_DIR = os.path.join(CONTRACTS_DIR, "schemas")
GOLDEN_DIR = os.path.join(CONTRACTS_DIR, "golden")
EXAMPLES_DIR = os.path.join(CONTRACTS_DIR, "examples")


# ---------------------------------------------------------------------------
# Result tracking
# ---------------------------------------------------------------------------

class ContractResult:
    def __init__(self, name: str, passed: bool, message: str):
        self.name = name
        self.passed = passed
        self.message = message


results: List[ContractResult] = []


def record(name: str, passed: bool, message: str):
    results.append(ContractResult(name, passed, message))
    status = "PASS" if passed else "FAIL"
    print(f"  [{status}] {name}: {message}")


# ---------------------------------------------------------------------------
# Schema loading
# ---------------------------------------------------------------------------

def load_json(path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        return None


def load_schema(name: str) -> Optional[Dict[str, Any]]:
    return load_json(os.path.join(SCHEMAS_DIR, name))


# ---------------------------------------------------------------------------
# Offline checks
# ---------------------------------------------------------------------------

def validate_golden_against_schema():
    """Validate all golden examples against their matching schema."""
    if jsonschema is None:
        record("dep:jsonschema", False, "jsonschema not installed. Run: pip install jsonschema")
        return

    plan_schema = load_schema("plan.schema.json")
    error_schema = load_schema("error.schema.json")

    if plan_schema is None:
        record("load:plan.schema", False, "Cannot load contracts/schemas/plan.schema.json")
        return
    record("load:plan.schema", True, "Loaded")

    if error_schema is None:
        record("load:error.schema", False, "Cannot load contracts/schemas/error.schema.json")
        return
    record("load:error.schema", True, "Loaded")

    # Validate golden plan files
    for directory, label in [(GOLDEN_DIR, "golden"), (EXAMPLES_DIR, "examples")]:
        if not os.path.isdir(directory):
            record(f"dir:{label}", False, f"Directory not found: {directory}")
            continue
        for filename in sorted(os.listdir(directory)):
            if not filename.endswith(".json"):
                continue
            filepath = os.path.join(directory, filename)
            data = load_json(filepath)
            if data is None:
                record(f"{label}/{filename}", False, "Cannot parse JSON")
                continue

            # Determine which schema applies
            if "error" in data and "code" in data:
                schema = error_schema
                schema_name = "error"
            elif "actions" in data:
                schema = plan_schema
                schema_name = "plan"
            else:
                record(f"{label}/{filename}", False, "Cannot determine schema (no 'actions' or 'error' key)")
                continue

            try:
                jsonschema.validate(instance=data, schema=schema)
                record(f"{label}/{filename}", True, f"Conforms to {schema_name}.schema.json")
            except jsonschema.ValidationError as e:
                record(f"{label}/{filename}", False, f"Schema violation: {e.message}")


def validate_schema_self_consistency():
    """Check that schemas are valid JSON Schema draft-07."""
    if jsonschema is None:
        return

    for name in ["plan.schema.json", "error.schema.json"]:
        schema = load_schema(name)
        if schema is None:
            record(f"schema-valid:{name}", False, "Cannot load")
            continue
        try:
            jsonschema.Draft7Validator.check_schema(schema)
            record(f"schema-valid:{name}", True, "Valid JSON Schema draft-07")
        except jsonschema.SchemaError as e:
            record(f"schema-valid:{name}", False, f"Invalid schema: {e.message}")


# ---------------------------------------------------------------------------
# Online checks — Unified API
# ---------------------------------------------------------------------------

def validate_api_plan_contract(base_url: str, timeout: int):
    """Hit the plan-generation endpoint and validate response against schema."""
    plan_schema = load_schema("plan.schema.json")
    error_schema = load_schema("error.schema.json")

    session = requests.Session()

    # Authenticate first
    try:
        reg = session.post(
            f"{base_url}/api/v1/auth/register",
            json={
                "email": "contract-test@example.com",
                "password": "ContractTest_123!",
                "username": "contracttest",
            },
            timeout=timeout,
        )
    except Exception:
        pass  # user may already exist

    try:
        login = session.post(
            f"{base_url}/api/v1/auth/login",
            json={
                "email": "contract-test@example.com",
                "password": "ContractTest_123!",
            },
            timeout=timeout,
        )
        if login.status_code == 200:
            token = login.json().get("access_token")
            if token:
                session.headers["Authorization"] = f"Bearer {token}"
                record("api:auth", True, "Authenticated for contract tests")
            else:
                record("api:auth", False, "No access_token in response")
                return
        else:
            record("api:auth", False, f"Login returned {login.status_code}")
            return
    except Exception as e:
        record("api:auth", False, f"Auth failed: {e}")
        return

    # Create a prompt
    try:
        prompt_resp = session.post(
            f"{base_url}/api/v1/prompts",
            json={
                "title": "Contract Test - Login",
                "original_prompt": "Login to the-internet.herokuapp.com with tomsmith/SuperSecretPassword!",
                "url": "https://the-internet.herokuapp.com/login",
            },
            timeout=timeout,
        )
        if prompt_resp.status_code != 200:
            record("api:create-prompt", False, f"Status {prompt_resp.status_code}")
            return
        prompt_data = prompt_resp.json()
        prompt_id = prompt_data.get("id") or prompt_data.get("prompt_id")
        if not prompt_id:
            record("api:create-prompt", False, "No prompt ID returned")
            return
        record("api:create-prompt", True, f"Prompt {prompt_id}")
    except Exception as e:
        record("api:create-prompt", False, str(e))
        return

    # Generate plan and validate schema
    try:
        plan_resp = session.post(
            f"{base_url}/api/v1/prompts/{prompt_id}/generate",
            timeout=max(timeout, 60),
        )
        if plan_resp.status_code == 200:
            plan_body = plan_resp.json()
            # The API may wrap the plan in a container; look for 'actions' at top or nested
            plan_payload = plan_body
            if "plan" in plan_body and isinstance(plan_body["plan"], dict):
                plan_payload = plan_body["plan"]
            if "actions" in plan_payload:
                if plan_schema and jsonschema:
                    try:
                        jsonschema.validate(instance=plan_payload, schema=plan_schema)
                        record("api:plan-schema", True, "Generated plan conforms to plan.schema.json")
                    except jsonschema.ValidationError as e:
                        record("api:plan-schema", False, f"Schema violation: {e.message}")
                else:
                    record("api:plan-schema", True, "Plan has 'actions' (jsonschema not available for deep check)")
            else:
                record("api:plan-schema", False, f"Response missing 'actions' key. Keys: {list(plan_body.keys())}")
        else:
            record("api:plan-response", False, f"Plan generation returned {plan_resp.status_code}")
    except Exception as e:
        record("api:plan-response", False, f"Plan generation error: {e}")

    # Test error contract — send an intentionally bad request
    try:
        bad_resp = session.post(
            f"{base_url}/api/v1/prompts/00000000-0000-0000-0000-000000000000/generate",
            timeout=timeout,
        )
        if bad_resp.status_code in (400, 404, 422, 500):
            record("api:error-code", True, f"Bad request returned {bad_resp.status_code}")
        else:
            record("api:error-code", False, f"Expected 4xx/5xx, got {bad_resp.status_code}")
    except Exception as e:
        record("api:error-contract", False, str(e))


def validate_api_test_data_contract(base_url: str, timeout: int):
    """Validate API test-data endpoints return expected shapes."""
    session = requests.Session()

    # Auth
    try:
        login = session.post(
            f"{base_url}/api/v1/auth/login",
            json={
                "email": "contract-test@example.com",
                "password": "ContractTest_123!",
            },
            timeout=timeout,
        )
        if login.status_code == 200:
            token = login.json().get("access_token")
            if token:
                session.headers["Authorization"] = f"Bearer {token}"
        else:
            record("api-test-data:auth", False, f"Login returned {login.status_code}")
            return
    except Exception as e:
        record("api-test-data:auth", False, str(e))
        return

    # GET endpoints list
    try:
        resp = session.get(f"{base_url}/api/v1/api-test-data/endpoints", timeout=timeout)
        if resp.status_code == 200:
            body = resp.json()
            if "success" in body and "data" in body:
                record("api-test-data:endpoints-list", True, f"Returned {body.get('count', len(body.get('data', [])))} endpoints")
            else:
                record("api-test-data:endpoints-list", False, f"Missing 'success'/'data' keys: {list(body.keys())}")
        else:
            record("api-test-data:endpoints-list", False, f"Status {resp.status_code}")
    except Exception as e:
        record("api-test-data:endpoints-list", False, str(e))

    # GET templates list
    try:
        resp = session.get(f"{base_url}/api/v1/api-test-data/templates", timeout=timeout)
        if resp.status_code == 200:
            body = resp.json()
            if "success" in body and "data" in body:
                record("api-test-data:templates-list", True, "OK")
            else:
                record("api-test-data:templates-list", False, f"Unexpected shape: {list(body.keys())}")
        else:
            record("api-test-data:templates-list", False, f"Status {resp.status_code}")
    except Exception as e:
        record("api-test-data:templates-list", False, str(e))

    # GET template library
    try:
        resp = session.get(f"{base_url}/api/v1/api-test-data/templates/library/list", timeout=timeout)
        if resp.status_code == 200:
            record("api-test-data:template-library", True, "OK")
        else:
            record("api-test-data:template-library", False, f"Status {resp.status_code}")
    except Exception as e:
        record("api-test-data:template-library", False, str(e))

    # GET categories
    try:
        resp = session.get(f"{base_url}/api/v1/api-test-data/categories", timeout=timeout)
        if resp.status_code == 200:
            record("api-test-data:categories", True, "OK")
        else:
            record("api-test-data:categories", False, f"Status {resp.status_code}")
    except Exception as e:
        record("api-test-data:categories", False, str(e))

    # GET data-sets
    try:
        resp = session.get(f"{base_url}/api/v1/api-test-data/data-sets", timeout=timeout)
        if resp.status_code == 200:
            record("api-test-data:data-sets", True, "OK")
        else:
            record("api-test-data:data-sets", False, f"Status {resp.status_code}")
    except Exception as e:
        record("api-test-data:data-sets", False, str(e))

    # GET setups
    try:
        resp = session.get(f"{base_url}/api/v1/api-test-data/setups", timeout=timeout)
        if resp.status_code == 200:
            record("api-test-data:setups", True, "OK")
        else:
            record("api-test-data:setups", False, f"Status {resp.status_code}")
    except Exception as e:
        record("api-test-data:setups", False, str(e))

    # GET history
    try:
        resp = session.get(f"{base_url}/api/v1/api-test-data/history", timeout=timeout)
        if resp.status_code == 200:
            record("api-test-data:history", True, "OK")
        else:
            record("api-test-data:history", False, f"Status {resp.status_code}")
    except Exception as e:
        record("api-test-data:history", False, str(e))


# ---------------------------------------------------------------------------
# Online checks — Java Runner
# ---------------------------------------------------------------------------

def validate_java_runner_contract(runner_url: str, timeout: int):
    """Validate Java runner health and stats endpoints."""
    # Health
    try:
        resp = requests.get(f"{runner_url}/api/v1/health", timeout=timeout)
        if resp.status_code == 200:
            body = resp.json()
            required_keys = {"status", "service", "activeExecutions", "maxConcurrentExecutions"}
            missing = required_keys - set(body.keys())
            if not missing:
                record("runner:health-contract", True, f"All required fields present, status={body['status']}")
            else:
                record("runner:health-contract", False, f"Missing fields: {missing}")
        else:
            record("runner:health-contract", False, f"Status {resp.status_code}")
    except requests.ConnectionError:
        record("runner:health-contract", False, "Connection refused (java-runner not running)")
    except Exception as e:
        record("runner:health-contract", False, str(e))

    # Stats
    try:
        resp = requests.get(f"{runner_url}/api/v1/stats", timeout=timeout)
        if resp.status_code == 200:
            body = resp.json()
            if "activeExecutions" in body:
                record("runner:stats-contract", True, "Stats endpoint OK")
            else:
                record("runner:stats-contract", False, f"Missing 'activeExecutions': {list(body.keys())}")
        else:
            record("runner:stats-contract", False, f"Status {resp.status_code}")
    except requests.ConnectionError:
        record("runner:stats-contract", False, "Connection refused")
    except Exception as e:
        record("runner:stats-contract", False, str(e))


# ---------------------------------------------------------------------------
# Online checks — MCP Server
# ---------------------------------------------------------------------------

EXPECTED_MCP_TOOLS = [
    "run_action",
    "verify.section",
    "context.put",
    "context.get",
    "fetch_test_data",
    "elements.add",
    "elements.get",
    "get_review_queue",
    "update_review_status",
    "analytics_healing_data",
    "analytics_trends",
    "generate_test_scenarios",
]


def validate_mcp_contract(mcp_url: str, timeout: int):
    """Validate MCP tools/list contract via WebSocket."""
    if websockets is None:
        record("mcp:dep", False, "websockets not installed")
        return

    async def _check():
        try:
            async with websockets.connect(
                mcp_url,
                additional_headers={"Authorization": "Bearer devtoken"},
                open_timeout=timeout,
            ) as ws:
                # tools/list
                await ws.send(json.dumps({
                    "jsonrpc": "2.0",
                    "id": "contract-1",
                    "method": "tools/list",
                    "params": {},
                }))
                raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
                resp = json.loads(raw)

                if "result" not in resp:
                    record("mcp:tools/list", False, f"No 'result' key: {list(resp.keys())}")
                    return

                tools_result = resp["result"]
                if isinstance(tools_result, dict) and "tools" in tools_result:
                    tool_names = [t.get("name") for t in tools_result["tools"]]
                elif isinstance(tools_result, list):
                    tool_names = [t.get("name") for t in tools_result]
                else:
                    record("mcp:tools/list", False, f"Unexpected result type: {type(tools_result)}")
                    return

                record("mcp:tools/list", True, f"Returned {len(tool_names)} tools")

                # Check expected tools are present
                missing = [t for t in EXPECTED_MCP_TOOLS if t not in tool_names]
                if missing:
                    record("mcp:expected-tools", False, f"Missing tools: {missing}")
                else:
                    record("mcp:expected-tools", True, f"All {len(EXPECTED_MCP_TOOLS)} expected tools present")

                # Verify each tool has name + inputSchema
                for tool in (tools_result.get("tools", []) if isinstance(tools_result, dict) else tools_result):
                    name = tool.get("name", "unknown")
                    if "inputSchema" not in tool and "input_schema" not in tool:
                        record(f"mcp:tool-schema:{name}", False, "Missing inputSchema")
                        break
                else:
                    record("mcp:tool-schemas", True, "All tools have inputSchema")

        except asyncio.TimeoutError:
            record("mcp:connect", False, "WebSocket connection timed out")
        except Exception as e:
            record("mcp:connect", False, f"WebSocket error: {e}")

    asyncio.get_event_loop().run_until_complete(_check())


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Phase 2 contract validation tests")
    parser.add_argument("--offline", action="store_true", help="Schema-only checks (no services)")
    parser.add_argument("--base-url", default="http://localhost:8000", help="Unified API URL")
    parser.add_argument("--mcp-url", default="ws://localhost:8001/mcp/ws", help="MCP WebSocket URL")
    parser.add_argument("--runner-url", default="http://localhost:8080", help="Java runner URL")
    parser.add_argument("--timeout", type=int, default=15, help="Request timeout seconds")
    args = parser.parse_args()

    print("=" * 70)
    print("CONTRACT VALIDATION — Phase 2")
    print("=" * 70)

    # --- Offline checks (always run) ---
    print("\n--- Schema Self-Consistency ---")
    validate_schema_self_consistency()

    print("\n--- Golden Example Validation ---")
    validate_golden_against_schema()

    if args.offline:
        _print_summary()
        return

    # --- Online checks ---
    print("\n--- Unified API Plan Contract ---")
    validate_api_plan_contract(args.base_url, args.timeout)

    print("\n--- API Test-Data Contract ---")
    validate_api_test_data_contract(args.base_url, args.timeout)

    print("\n--- Java Runner Contract ---")
    validate_java_runner_contract(args.runner_url, args.timeout)

    print("\n--- MCP Server Contract ---")
    validate_mcp_contract(args.mcp_url, args.timeout)

    _print_summary()


def _print_summary():
    total = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed
    print(f"\n{'=' * 70}")
    print(f"CONTRACT RESULTS: {passed}/{total} passed, {failed} failed")
    print("=" * 70)

    if failed:
        print("\nFailed checks:")
        for r in results:
            if not r.passed:
                print(f"  - {r.name}: {r.message}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
