"""Self-host license validator — runs inside deployed self-hosted instances.

On startup, reads SELF_HOST_LICENSE_KEY, SELF_HOST_TENANT_SLUG, and
SELF_HOST_VALIDATION_URL from the environment.  If all three are set the
validator runs a background loop that periodically calls the central
FluxTest licensing endpoint to confirm the license is still valid.

When validation fails, the result is cached so health-check endpoints
can expose the status.
"""

import asyncio
import logging
import os
import platform
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_license_state: dict = {
    "valid": None,  # None = not yet checked, True/False after
    "reason": "pending",
    "last_checked_at": None,
    "next_check_in_seconds": 300,
    "plan_tier": None,
    "subscription_status": None,
    "error": None,
}

_TASK: Optional[asyncio.Task] = None


def get_license_state() -> dict:
    """Return the current cached license validation state."""
    return dict(_license_state)


def is_license_valid() -> bool:
    """Return True if the license has been validated successfully."""
    return _license_state.get("valid") is True


def _node_id() -> str:
    return f"{platform.node()}-{os.getpid()}"


async def _validate_once(
    validation_url: str,
    tenant_slug: str,
    license_key: str,
    validation_token: Optional[str],
) -> dict:
    headers = {"Content-Type": "application/json"}
    if validation_token:
        headers["X-License-Validation-Token"] = validation_token

    payload = {
        "tenant_slug": tenant_slug,
        "license_key": license_key,
        "node_id": _node_id(),
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(validation_url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def _validation_loop(
    validation_url: str,
    tenant_slug: str,
    license_key: str,
    validation_token: Optional[str],
) -> None:
    interval = 300  # default 5 minutes
    while True:
        try:
            result = await _validate_once(
                validation_url, tenant_slug, license_key, validation_token
            )
            _license_state["valid"] = result.get("valid", False)
            _license_state["reason"] = result.get("reason", "unknown")
            _license_state["plan_tier"] = result.get("plan_tier")
            _license_state["subscription_status"] = result.get("subscription_status")
            _license_state["error"] = None
            interval = result.get("next_check_in_seconds", 300)
            _license_state["next_check_in_seconds"] = interval
            _license_state["last_checked_at"] = time.time()

            if result.get("valid"):
                logger.info("Self-host license validated successfully.")
            else:
                logger.warning(
                    "Self-host license validation failed: %s", result.get("reason")
                )
        except Exception as exc:
            _license_state["error"] = str(exc)
            _license_state["last_checked_at"] = time.time()
            logger.error("Self-host license validation error: %s", exc)

        await asyncio.sleep(max(interval, 60))


def start_license_validator() -> None:
    """Start the background license validation loop if env vars are set."""
    global _TASK

    license_key = os.getenv("SELF_HOST_LICENSE_KEY", "").strip()
    tenant_slug = os.getenv("SELF_HOST_TENANT_SLUG", "").strip()
    validation_url = os.getenv("SELF_HOST_VALIDATION_URL", "").strip()

    if not all([license_key, tenant_slug, validation_url]):
        logger.debug(
            "Self-host license validation disabled (missing env vars)."
        )
        return

    validation_token = os.getenv("SELF_HOST_LICENSE_VALIDATION_TOKEN", "").strip() or None

    logger.info(
        "Starting self-host license validator (tenant=%s, url=%s)",
        tenant_slug,
        validation_url,
    )

    _TASK = asyncio.ensure_future(
        _validation_loop(validation_url, tenant_slug, license_key, validation_token)
    )


def stop_license_validator() -> None:
    """Cancel the background validation loop."""
    global _TASK
    if _TASK and not _TASK.done():
        _TASK.cancel()
        _TASK = None
