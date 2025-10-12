# services/review_service.py
from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from schemas.review_item import (
    ReviewCreate,
    ReviewItem,
    ReviewUpdateStatus,
    ReviewStatus,
)
# ✅ import the singleton, not the class
from services.review_storage import review_storage


def _now() -> datetime:
    # ✅ timezone-aware
    return datetime.now(timezone.utc)


def _new_id(base: str) -> str:
    base = base.strip()
    if not review_storage.get(base):
        return base
    return f"{base}-{uuid4().hex[:8]}"


def create_review(payload: ReviewCreate, created_by: str = "system") -> ReviewItem:
    rid = _new_id(payload.element_id)
    item = ReviewItem(
        id=rid,
        page=payload.page,
        element_id=payload.element_id,
        suggested_locator=payload.suggested_locator,
        old_locator=payload.old_locator,
        ai_reasoning=payload.ai_reasoning,
        confidence_score=payload.confidence_score or 0.0,
        status=ReviewStatus.pending,
        created_at=_now(),           # ✅ datetime, not string
        updated_at=None,
        created_by=created_by,
    )
    return review_storage.add(item)  # ✅ return what storage persisted


def get(review_id: str) -> Optional[ReviewItem]:
    return review_storage.get(review_id)


def set_status(review_id: str, update: ReviewUpdateStatus) -> Optional[ReviewItem]:
    item = review_storage.get(review_id)
    if not item:
        return None

    status_value = (
        update.status.value if isinstance(update.status, ReviewStatus) else str(update.status)
    )

    # ✅ pass datetime; storage will normalize to ISO Z
    return review_storage.update(
        review_id,
        {
            "status": status_value,
            "updated_at": _now(),
        },
    )


def list_pending(limit: int = 50, page: int = 1) -> List[ReviewItem]:
    return review_storage.list_pending(limit=limit, page=page)
