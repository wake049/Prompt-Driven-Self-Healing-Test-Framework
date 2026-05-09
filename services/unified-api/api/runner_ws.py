"""
Runner WebSocket Hub — persistent connections from runner agents.

Flow:
  1. Runner connects: ws://<host>/ws/runner?token=<runner_token>
  2. Backend authenticates via the runner_token
  3. Runner stays connected — receives commands, sends results
  4. Backend routes gather-elements / execute requests to connected runners
  5. Runner heartbeat is implicit (WebSocket ping/pong)

Message protocol (JSON):
  → Backend-to-Runner (commands):
    { "type": "gather-elements", "request_id": "<uuid>", "payload": {...} }
    { "type": "execute",         "request_id": "<uuid>", "payload": {...} }
    { "type": "ping" }

  ← Runner-to-Backend (responses):
    { "type": "result",    "request_id": "<uuid>", "payload": {...} }
    { "type": "error",     "request_id": "<uuid>", "error": "..." }
    { "type": "pong" }
    { "type": "log",       "entries": [...] }
    { "type": "status",    "execution_id": "...", "status": "...", ... }
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect, APIRouter, Query
from starlette.websockets import WebSocketState

from core.database import get_database_manager

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Connected runner registry
# ---------------------------------------------------------------------------

class ConnectedRunner:
    """Represents a single WebSocket-connected runner."""

    __slots__ = (
        "runner_id", "organization_id", "capabilities",
        "ws", "connected_at", "_pending",
    )

    def __init__(self, runner_id: str, organization_id: str,
                 capabilities: list, ws: WebSocket):
        self.runner_id = runner_id
        self.organization_id = organization_id
        self.capabilities = capabilities
        self.ws = ws
        self.connected_at = datetime.now(timezone.utc)
        # request_id → Future  (awaiting result from runner)
        self._pending: Dict[str, asyncio.Future] = {}

    async def send_command(self, cmd_type: str, payload: dict,
                           timeout: float = 600) -> dict:
        """Send a command and wait for the runner's response."""
        request_id = str(uuid.uuid4())
        loop = asyncio.get_event_loop()
        future: asyncio.Future = loop.create_future()
        self._pending[request_id] = future

        message = {
            "type": cmd_type,
            "request_id": request_id,
            "payload": payload,
        }
        try:
            await self.ws.send_json(message)
            result = await asyncio.wait_for(future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            raise TimeoutError(
                f"Runner {self.runner_id} did not respond within {timeout}s"
            )
        finally:
            self._pending.pop(request_id, None)

    def resolve(self, request_id: str, payload: dict):
        """Resolve a pending future with the runner's response."""
        fut = self._pending.get(request_id)
        if fut and not fut.done():
            fut.set_result(payload)

    def reject(self, request_id: str, error: str):
        """Reject a pending future with an error."""
        fut = self._pending.get(request_id)
        if fut and not fut.done():
            fut.set_exception(RuntimeError(error))

    @property
    def is_connected(self) -> bool:
        return self.ws.client_state == WebSocketState.CONNECTED


class RunnerRegistry:
    """In-process registry of connected WebSocket runners."""

    def __init__(self):
        # runner_id → ConnectedRunner
        self._runners: Dict[str, ConnectedRunner] = {}

    def add(self, runner: ConnectedRunner):
        self._runners[runner.runner_id] = runner
        logger.info("Runner connected: id=%s org=%s caps=%s",
                     runner.runner_id, runner.organization_id,
                     runner.capabilities)

    def remove(self, runner_id: str):
        r = self._runners.pop(runner_id, None)
        if r:
            logger.info("Runner disconnected: id=%s", runner_id)

    def get(self, runner_id: str) -> Optional[ConnectedRunner]:
        return self._runners.get(runner_id)

    def find_by_org(self, organization_id: str,
                    capability: Optional[str] = None) -> Optional[ConnectedRunner]:
        """Find any connected runner for the given org (+ optional capability)."""
        for r in self._runners.values():
            if r.organization_id != organization_id:
                continue
            if not r.is_connected:
                continue
            if capability and capability not in r.capabilities:
                continue
            return r
        return None

    def list_all(self) -> list:
        return [
            {
                "runner_id": r.runner_id,
                "organization_id": r.organization_id,
                "capabilities": r.capabilities,
                "connected_at": r.connected_at.isoformat(),
                "is_connected": r.is_connected,
            }
            for r in self._runners.values()
        ]


# Singleton registry — imported by other modules
runner_registry = RunnerRegistry()


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

async def _authenticate_runner(token: str) -> Optional[dict]:
    """Look up a runner by its token. Returns the runner row or None."""
    db = await get_database_manager()
    row = await db.execute_one(
        "SELECT id, organization_id, capabilities, status "
        "FROM exec.runners WHERE runner_token = $1",
        token,
    )
    if not row:
        return None
    return dict(row)


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/runner")
async def runner_websocket(ws: WebSocket, token: str = Query(...)):
    """
    Persistent WebSocket connection for a runner agent.
    Connect: ws://host/ws/runner?token=<runner_token>
    """
    # 1. Authenticate
    runner_row = await _authenticate_runner(token)
    if not runner_row:
        await ws.close(code=4001, reason="Invalid runner token")
        return

    await ws.accept()

    runner_id = str(runner_row["id"])
    org_id = str(runner_row["organization_id"])
    caps_raw = runner_row.get("capabilities", "[]")
    capabilities = json.loads(caps_raw) if isinstance(caps_raw, str) else (caps_raw or [])

    runner = ConnectedRunner(runner_id, org_id, capabilities, ws)
    runner_registry.add(runner)

    # Mark runner online in DB
    try:
        db = await get_database_manager()
        await db.execute_one(
            "UPDATE exec.runners SET status = 'online', last_heartbeat = NOW() WHERE id = $1",
            runner_id,
        )
    except Exception as e:
        logger.warning("Failed to update runner status: %s", e)

    # 2. Message loop
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "pong":
                # Heartbeat response — update DB
                try:
                    await db.execute_one(
                        "UPDATE exec.runners SET last_heartbeat = NOW() WHERE id = $1",
                        runner_id,
                    )
                except Exception:
                    pass

            elif msg_type == "result":
                request_id = data.get("request_id", "")
                payload = data.get("payload", {})
                runner.resolve(request_id, payload)

            elif msg_type == "error":
                request_id = data.get("request_id", "")
                error_msg = data.get("error", "Unknown runner error")
                runner.reject(request_id, error_msg)

            elif msg_type == "log":
                entries = data.get("entries", [])
                if entries:
                    try:
                        for entry in entries:
                            await db.execute_one(
                                """INSERT INTO exec.runner_logs
                                   (runner_id, level, message, execution_id, logged_at)
                                   VALUES ($1, $2, $3, $4, NOW())""",
                                runner_id,
                                entry.get("level", "INFO"),
                                entry.get("message", ""),
                                entry.get("execution_id"),
                            )
                    except Exception as e:
                        logger.warning("Failed to store runner logs: %s", e)

            elif msg_type == "status":
                # Forward execution status update
                execution_id = data.get("execution_id")
                status = data.get("status")
                if execution_id and status:
                    try:
                        await db.execute_one(
                            "UPDATE exec.runs SET status = $2, updated_at = NOW() WHERE id = $1",
                            execution_id, status,
                        )
                    except Exception as e:
                        logger.warning("Failed to update execution status: %s", e)

            else:
                logger.debug("Unknown message type from runner %s: %s",
                             runner_id, msg_type)

    except WebSocketDisconnect:
        logger.info("Runner %s disconnected normally", runner_id)
    except Exception as e:
        logger.warning("Runner %s WebSocket error: %s", runner_id, e)
    finally:
        runner_registry.remove(runner_id)
        # Mark runner offline in DB
        try:
            await db.execute_one(
                "UPDATE exec.runners SET status = 'offline', updated_at = NOW() WHERE id = $1",
                runner_id,
            )
        except Exception:
            pass


# ---------------------------------------------------------------------------
# REST helper — list connected runners (for admin/debug)
# ---------------------------------------------------------------------------

@router.get("/runners/connected")
async def list_connected_runners():
    """Return list of currently WebSocket-connected runners."""
    return {"runners": runner_registry.list_all()}
