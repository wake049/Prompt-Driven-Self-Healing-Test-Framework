# services/verification_service.py
from __future__ import annotations
from typing import Tuple, Dict, Any
import httpx

from core.config import RUNNER_BASE_URL
from schemas.review_item import ReviewItem as ReviewItemSchema

class VerificationEngine:

    def heuristic_check(self, item: ReviewItemSchema) -> Tuple[bool, Dict[str, Any]]:
        sel = (item.suggested_locator or "").strip()
        ok = bool(sel) and ("css=" in sel or "xpath=" in sel or sel.startswith("#") or sel.startswith("."))
        return ok, {
            "selector_present": bool(sel),
            "has_prefix": ("css=" in sel) or ("xpath=" in sel),
            "note": "Basic selector sanity check only.",
        }

    def functional_check(self, item: ReviewItemSchema, *, context: Dict[str, Any] | None = None) -> Tuple[bool, Dict[str, Any]]:
        if not RUNNER_BASE_URL:
            return False, {"skipped": True, "reason": "RUNNER_BASE_URL not set"}

        try:
            payload = {
                "page": item.page,
                "selector": item.suggested_locator,
                "intended_action": item.intended_action,
                "action_payload": item.action_payload or {},
                "context": context or {},
            }
            with httpx.Client(timeout=20.0) as client:
                resp = client.post(f"{RUNNER_BASE_URL.rstrip('/')}/verify", json=payload)
                if resp.status_code >= 400:
                    return False, {"error": f"Runner HTTP {resp.status_code}", "body": resp.text}
                data = resp.json()
                return bool(data.get("ok", False)), data
        except Exception as e:
            return False, {"exception": repr(e)}
