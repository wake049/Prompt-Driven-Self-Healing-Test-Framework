# api/review.py
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from typing import Optional

from core.auth_middleware import verify_bearer_token
from core.config import RUNNER_BASE_URL, SUGGESTION_MAX_ALTS
from schemas.review_item import (
    ReviewCreate,
    ReviewItem as ReviewItemSchema,
    ReviewUpdateStatus,
    VerifyResponse,
    SuggestRequest,
    SuggestResponse,
)
from services import review_service, review_storage
from services.verification_service import VerificationEngine
from services.suggestion_service import LocatorSuggestor  # if you've added suggestor

router = APIRouter()

def _engine() -> VerificationEngine:
    return VerificationEngine()

@router.post("/add", response_model=ReviewItemSchema, status_code=status.HTTP_201_CREATED)
def add_review_item(payload: ReviewCreate, _auth=Depends(verify_bearer_token)):
    return review_service.create_review(payload)

@router.get("/pending", response_model=list[ReviewItemSchema])
def list_pending(limit: int = Query(50, ge=1, le=200), page: int = Query(1, ge=1), _auth=Depends(verify_bearer_token)):
    return review_service.list_pending(limit=limit, page=page)

@router.get("/{review_id}", response_model=ReviewItemSchema)
def get_review(review_id: str, _auth=Depends(verify_bearer_token)):
    item = review_storage.get(review_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"ReviewItem {review_id} not found")
    return item

@router.patch("/{review_id}", response_model=ReviewItemSchema)
async def update_status(review_id: str, update: ReviewUpdateStatus, _auth=Depends(verify_bearer_token)):
    item = review_service.set_status(review_id, update)
    if not item:
        raise HTTPException(status_code=404, detail=f"ReviewItem {review_id} not found")
    return item

@router.post("/{review_id}/verify", response_model=VerifyResponse)
def verify_review_item(review_id: str, context: dict = Body(default_factory=dict), _auth=Depends(verify_bearer_token)):
    item = review_storage.get(review_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"ReviewItem {review_id} not found")

    engine = _engine()
    heuristic_ok, h_details = engine.heuristic_check(item)
    functional_ok, f_details = engine.functional_check(item, context=context)

    return VerifyResponse(
        review_id=review_id,
        heuristic_pass=heuristic_ok,
        functional_pass=functional_ok,
        details={"heuristic": h_details, "functional": f_details},
    )
@router.post("/suggest", response_model=SuggestResponse)
def suggest_locators(req: SuggestRequest, max_alternatives: Optional[int] = Query(None, ge=1, le=10), _auth=Depends(verify_bearer_token)):
    return LocatorSuggestor().suggest(req, max_alts=max_alternatives)
