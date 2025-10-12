# schemas/review_item.py
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field, HttpUrl, field_validator


# ---- Enums -------------------------------------------------------------------

class ReviewStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    verified_fail = "verified_fail"  # set by FE when verify fails


# ---- Create / Update ---------------------------------------------------------

class ReviewCreate(BaseModel):
    """
    Payload to create a review queue item.
    """
    element_id: str = Field(..., description="Human-friendly element identifier (e.g. 'password_input')")
    page: str = Field(..., description="Page or route where this element exists")
    suggested_locator: str = Field(..., description="Proposed CSS/XPath selector to review")
    old_locator: Optional[str] = Field(None, description="Previous/legacy selector (if known)")
    ai_reasoning: Optional[str] = Field(None, description="Why this selector was suggested")
    confidence_score: Optional[float] = Field(0.0, ge=0.0, le=1.0, description="Model confidence in suggestion")

    model_config = {"extra": "ignore"}


class ReviewUpdateStatus(BaseModel):
    """
    PATCH body to change the status of a review item.
    """
    status: ReviewStatus


# ---- Review Item ----------------------------------------------------------------

class ReviewItem(BaseModel):
    """
    The object returned/stored for a single review queue item.
    Matches what your React page renders.
    """
    id: str
    page: str
    element_id: str
    suggested_locator: str
    old_locator: Optional[str] = None
    ai_reasoning: Optional[str] = None
    confidence_score: float = 0.0

    status: ReviewStatus = ReviewStatus.pending

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = Field(default="system")

    # optional extras you might want later
    runner_url: Optional[str] = None  # if you store a link to a replay/runner UI

    model_config = {
        "from_attributes": True,
        "extra": "ignore",
        "json_encoders": {datetime: lambda dt: dt.isoformat() + "Z"},
    }

    @field_validator("suggested_locator", "old_locator")
    @classmethod
    def strip_locators(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if isinstance(v, str) else v


# ---- Verify ---------------------------------------------------------------------

class VerifyResponse(BaseModel):
    review_id: str
    heuristic_pass: bool
    functional_pass: bool
    details: dict[str, Any] = Field(default_factory=dict)


# ---- Suggestions ---------------------------------------------------------------

class SuggestRequest(BaseModel):
    """
    Ask for alternative selectors.
    """
    page: str = Field(..., description="Page/route context to guide suggestions")
    old_locator: Optional[str] = Field(None, description="Current/previous selector to improve")
    max_alternatives: Optional[int] = Field(None, ge=1, le=10, description="Override server max if provided")

    model_config = {"extra": "ignore"}


class SuggestAlternative(BaseModel):
    selector: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    ai_reasoning: Optional[str] = None


class SuggestResponse(BaseModel):
    alternatives: List[SuggestAlternative] = Field(default_factory=list)


# ---- Optional list type (if you ever page) -------------------------------------

class ReviewList(BaseModel):
    items: List[ReviewItem]
    total: int
    page: int
    limit: int
