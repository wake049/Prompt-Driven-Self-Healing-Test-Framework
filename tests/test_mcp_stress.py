#!/usr/bin/env python3
"""
Phase 3: MCP WebSocket stress and reconnection tests.

Validates MCP server reliability under:
  1. Concurrent WebSocket connections (thundering herd)
  2. Rapid connect/disconnect cycles
  3. Large message payloads
  4. Connection recovery after server-side close
  5. Concurrent tool calls from multiple clients

Usage:
  python tests/test_mcp_stress.py --mcp-url ws://localhost:8001/mcp/ws
  python tests/test_mcp_stress.py --mcp-url ws://localhost:8001/mcp/ws --concurrency 20
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import uuid
from typing import Any, Dict, List, Optional

try:
    import websockets
except ImportError:
    print("FATAL: websockets not installed. Run: pip install websockets")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Result tracking
# ---------------------------------------------------------------------------

class StressResult:
    def __init__(self, test: str, passed: bool, message: str):
        self.test = test
        self.passed = passed
        self.message = message


ALL: List[StressResult] = []


def record(test: str, passed: bool, message: str):
    ALL.append(StressResult(test, passed, message))
    status = "PASS" if passed else "FAIL"
    print(f"  [{status}] {test}: {message}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

AUTH_HEADERS = {"Authorization": "Bearer devtoken"}


async def send_rpc(ws, method: str, params: Optional[Dict] = None, timeout: float = 15) -> Dict:
    """Send a JSON-RPC 2.0 request and return the parsed response."""
    req_id = str(uuid.uuid4())[:8]
    msg = {
        "jsonrpc": "2.0",
        "id": req_id,
        "method": method,
        "params": params or {},
    }
    await ws.send(json.dumps(msg))
    raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
    return json.loads(raw)


async def connect(mcp_url: str, timeout: float = 10):
    """Open a WebSocket connection to the MCP server."""
    return await websockets.connect(
        mcp_url,
        additional_headers=AUTH_HEADERS,
        open_timeout=timeout,
    )


# ---------------------------------------------------------------------------
# Test 1: Concurrent connections
# ---------------------------------------------------------------------------

async def test_concurrent_connections(mcp_url: str, concurrency: int):
    """Open N WebSocket connections simultaneously and send tools/list on each."""
    print(f"\n--- Concurrent connections (n={concurrency}) ---")

    async def _worker(i: int) -> Optional[float]:
        try:
            t0 = time.monotonic()
            ws = await connect(mcp_url, timeout=15)
            resp = await send_rpc(ws, "tools/list", timeout=15)
            elapsed = time.monotonic() - t0
            await ws.close()
            if "result" in resp:
                return elapsed
            return None
        except Exception:
            return None

    tasks = [_worker(i) for i in range(concurrency)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    successes = [r for r in results if isinstance(r, float)]
    failures = concurrency - len(successes)

    if successes:
        avg_ms = (sum(successes) / len(successes)) * 1000
        max_ms = max(successes) * 1000
        record(
            f"concurrent-{concurrency}",
            failures <= concurrency * 0.1,  # Allow up to 10% failure
            f"{len(successes)}/{concurrency} succeeded, avg={avg_ms:.0f}ms, max={max_ms:.0f}ms",
        )
    else:
        record(f"concurrent-{concurrency}", False, "All connections failed")


# ---------------------------------------------------------------------------
# Test 2: Rapid connect/disconnect
# ---------------------------------------------------------------------------

async def test_rapid_reconnect(mcp_url: str, cycles: int = 20):
    """Open and close connections rapidly to test server stability."""
    print(f"\n--- Rapid connect/disconnect ({cycles} cycles) ---")

    successes = 0
    failures = 0
    total_time = 0.0

    for i in range(cycles):
        try:
            t0 = time.monotonic()
            ws = await connect(mcp_url, timeout=5)
            resp = await send_rpc(ws, "tools/list", timeout=5)
            await ws.close()
            elapsed = time.monotonic() - t0
            total_time += elapsed
            if "result" in resp:
                successes += 1
            else:
                failures += 1
        except Exception:
            failures += 1

    avg_ms = (total_time / max(successes, 1)) * 1000
    record(
        "rapid-reconnect",
        failures <= cycles * 0.1,
        f"{successes}/{cycles} succeeded, avg={avg_ms:.0f}ms per cycle",
    )


# ---------------------------------------------------------------------------
# Test 3: Large message payload
# ---------------------------------------------------------------------------

async def test_large_payload(mcp_url: str):
    """Send a tool call with a large argument payload."""
    print("\n--- Large payload ---")

    try:
        ws = await connect(mcp_url)

        # Build a large context object (~50KB)
        large_context = {f"key_{i}": f"value_{'x' * 200}_{i}" for i in range(200)}

        resp = await send_rpc(ws, "tools/call", {
            "name": "context.put",
            "arguments": {
                "key": "stress_test_large",
                "value": json.dumps(large_context),
            },
        }, timeout=15)

        await ws.close()

        payload_kb = len(json.dumps(large_context)) / 1024
        if "result" in resp or "error" in resp:
            record("large-payload", True, f"Server handled ~{payload_kb:.0f}KB payload")
        else:
            record("large-payload", False, f"Unexpected response: {list(resp.keys())}")
    except Exception as e:
        record("large-payload", False, str(e))


# ---------------------------------------------------------------------------
# Test 4: Connection recovery
# ---------------------------------------------------------------------------

async def test_connection_recovery(mcp_url: str):
    """Verify a new connection works after an abrupt close."""
    print("\n--- Connection recovery ---")

    # Abrupt close (no close handshake)
    try:
        ws1 = await connect(mcp_url)
        ws1.transport.close()  # Force-close without handshake
        await asyncio.sleep(0.5)
    except Exception:
        pass

    # Open new connection — should work
    try:
        ws2 = await connect(mcp_url)
        resp = await send_rpc(ws2, "tools/list", timeout=10)
        await ws2.close()

        if "result" in resp:
            record("connection-recovery", True, "New connection works after abrupt close")
        else:
            record("connection-recovery", False, f"Response missing 'result': {list(resp.keys())}")
    except Exception as e:
        record("connection-recovery", False, f"Recovery failed: {e}")


# ---------------------------------------------------------------------------
# Test 5: Concurrent tool calls on a single connection
# ---------------------------------------------------------------------------

async def test_concurrent_tool_calls(mcp_url: str, num_calls: int = 10):
    """Send multiple tool calls on a single connection concurrently."""
    print(f"\n--- Concurrent tool calls (n={num_calls}) ---")

    try:
        ws = await connect(mcp_url)

        pending = {}
        for i in range(num_calls):
            req_id = f"stress-{i}"
            msg = {
                "jsonrpc": "2.0",
                "id": req_id,
                "method": "tools/call",
                "params": {
                    "name": "context.put",
                    "arguments": {"key": f"stress_{i}", "value": f"val_{i}"},
                },
            }
            await ws.send(json.dumps(msg))
            pending[req_id] = time.monotonic()

        # Collect responses
        received = 0
        errors = 0
        t_start = time.monotonic()

        while received < num_calls and (time.monotonic() - t_start) < 30:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=10)
                resp = json.loads(raw)
                received += 1
                if "error" in resp:
                    errors += 1
            except asyncio.TimeoutError:
                break

        await ws.close()

        record(
            "concurrent-calls",
            received == num_calls and errors <= num_calls * 0.1,
            f"{received}/{num_calls} responses, {errors} errors",
        )
    except Exception as e:
        record("concurrent-calls", False, str(e))


# ---------------------------------------------------------------------------
# Test 6: Sustained throughput
# ---------------------------------------------------------------------------

async def test_sustained_throughput(mcp_url: str, duration_s: int = 10):
    """Measure sustained request throughput over a time window."""
    print(f"\n--- Sustained throughput ({duration_s}s) ---")

    try:
        ws = await connect(mcp_url)

        count = 0
        errors = 0
        deadline = time.monotonic() + duration_s

        while time.monotonic() < deadline:
            try:
                resp = await send_rpc(ws, "tools/list", timeout=5)
                count += 1
                if "error" in resp:
                    errors += 1
            except asyncio.TimeoutError:
                errors += 1
            except Exception:
                errors += 1
                break

        await ws.close()

        rps = count / duration_s
        record(
            "sustained-throughput",
            count > 0 and errors <= count * 0.05,
            f"{count} requests in {duration_s}s = {rps:.1f} req/s, {errors} errors",
        )
    except Exception as e:
        record("sustained-throughput", False, str(e))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Phase 3: MCP stress tests")
    parser.add_argument("--mcp-url", default="ws://localhost:8001/mcp/ws")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent connections")
    parser.add_argument("--duration", type=int, default=10, help="Sustained throughput duration (s)")
    args = parser.parse_args()

    print("=" * 70)
    print("PHASE 3: MCP WEBSOCKET STRESS TESTS")
    print("=" * 70)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(test_concurrent_connections(args.mcp_url, args.concurrency))
        loop.run_until_complete(test_rapid_reconnect(args.mcp_url))
        loop.run_until_complete(test_large_payload(args.mcp_url))
        loop.run_until_complete(test_connection_recovery(args.mcp_url))
        loop.run_until_complete(test_concurrent_tool_calls(args.mcp_url))
        loop.run_until_complete(test_sustained_throughput(args.mcp_url, args.duration))
    finally:
        loop.close()

    # Summary
    total = len(ALL)
    passed = sum(1 for r in ALL if r.passed)
    failed = total - passed

    print(f"\n{'=' * 70}")
    print(f"MCP STRESS RESULTS: {passed}/{total} passed, {failed} failed")
    print("=" * 70)

    if failed:
        print("\nFailed:")
        for r in ALL:
            if not r.passed:
                print(f"  - {r.test}: {r.message}")

    # JSON report
    report = {
        "phase": 3,
        "type": "mcp-stress",
        "total": total,
        "passed": passed,
        "failed": failed,
        "results": [
            {"test": r.test, "passed": r.passed, "message": r.message}
            for r in ALL
        ],
    }
    report_path = os.path.join(os.path.dirname(__file__), "phase3_mcp_stress_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nJSON report: {report_path}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
