from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid
import logging

from services.review_service import ReviewService
from core.auth_middleware import verify_bearer_token
from schemas.review_item import ReviewStatus, ActionType

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/healing", tags=["healing"])

class HealingAttempt(BaseModel):
    """Healing attempt data from Java framework"""
    timestamp: str
    elementId: str
    page: str
    originalLocator: str
    attemptedAlternatives: List[str]
    healedLocator: Optional[str] = None
    result: str  # SUCCESS, FAILED
    error: Optional[str] = None

class HealingSubmission(BaseModel):
    """Batch submission of healing attempts"""
    session_id: Optional[str] = None
    test_run_id: Optional[str] = None
    healing_attempts: List[HealingAttempt]

class HealingStats(BaseModel):
    """Healing statistics response"""
    total_attempts: int
    successful_healings: int
    failed_healings: int
    unique_elements: int
    healing_success_rate: float
    most_common_healings: List[dict]

@router.post("/submit")
async def submit_healing_data(
    submission: HealingSubmission,
    review_service: ReviewService = Depends()
):
    """
    Submit healing data from Java framework for review
    """
    try:
        logger.info(f"Received healing submission with {len(submission.healing_attempts)} attempts")
        
        created_reviews = []
        
        for attempt in submission.healing_attempts:
            # Only create review items for successful healings that might need approval
            if attempt.result == "SUCCESS" and attempt.healedLocator:
                
                # Determine confidence based on healing success and alternative position
                confidence_score = 0.8  # Base confidence for successful healing
                if attempt.healedLocator == attempt.attemptedAlternatives[0]:
                    confidence_score = 0.9  # Higher confidence if first alternative worked
                elif len(attempt.attemptedAlternatives) > 2:
                    confidence_score = 0.6  # Lower confidence if required fallback
                
                # Create AI reasoning based on healing pattern
                ai_reasoning = f"Self-healing succeeded using alternative locator '{attempt.healedLocator}'. "
                ai_reasoning += f"Original locator '{attempt.originalLocator}' failed. "
                ai_reasoning += f"Tried {len(attempt.attemptedAlternatives)} alternatives. "
                ai_reasoning += f"Healing completed in {attempt.result} status."
                
                # Determine action type from locator patterns
                action_type = "click"  # Default
                if "input" in attempt.elementId.lower() or "text" in attempt.elementId.lower():
                    action_type = "type"
                elif "verify" in attempt.originalLocator or "assert" in attempt.originalLocator:
                    action_type = "assert_visible"
                
                review_item = {
                    "page": attempt.page if attempt.page != "unknown" else "saucedemo",
                    "element_id": attempt.elementId,
                    "suggested_locator": attempt.healedLocator,
                    "old_locator": attempt.originalLocator,
                    "suggested_by": "java_self_healing_engine",
                    "confidence_score": confidence_score,
                    "ai_reasoning": ai_reasoning,
                    "intended_action": action_type,
                    "action_payload": {
                        "healing_timestamp": attempt.timestamp,
                        "attempted_alternatives": attempt.attemptedAlternatives,
                        "healing_result": attempt.result,
                        "session_id": submission.session_id,
                        "test_run_id": submission.test_run_id
                    }
                }
                
                # Create review item
                created_review = await review_service.create_review(review_item)
                created_reviews.append(created_review)
                logger.info(f"Created review item {created_review['id']} for healing of {attempt.elementId}")
        
        return {
            "success": True,
            "message": f"Processed {len(submission.healing_attempts)} healing attempts",
            "created_reviews": len(created_reviews),
            "review_ids": [r["id"] for r in created_reviews]
        }
        
    except Exception as e:
        logger.error(f"Error processing healing submission: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process healing data: {str(e)}")

@router.get("/stats")
async def get_healing_stats(
    review_service: ReviewService = Depends()
) -> HealingStats:
    """
    Get statistics about healing attempts and success rates
    """
    try:
        # Get all review items created by self-healing engine
        all_reviews = await review_service.list_reviews(
            page=1, 
            limit=1000,
            suggested_by="java_self_healing_engine"
        )
        
        if not all_reviews:
            return HealingStats(
                total_attempts=0,
                successful_healings=0,
                failed_healings=0,
                unique_elements=0,
                healing_success_rate=0.0,
                most_common_healings=[]
            )
        
        # Calculate stats
        total_attempts = len(all_reviews)
        successful_healings = len([r for r in all_reviews if r.get("status") != "verified_fail"])
        failed_healings = total_attempts - successful_healings
        unique_elements = len(set(r.get("element_id") for r in all_reviews))
        healing_success_rate = (successful_healings / total_attempts) * 100 if total_attempts > 0 else 0
        
        # Find most common healing patterns
        healing_patterns = {}
        for review in all_reviews:
            pattern = f"{review.get('element_id')} : {review.get('old_locator')} → {review.get('suggested_locator')}"
            healing_patterns[pattern] = healing_patterns.get(pattern, 0) + 1
        
        most_common_healings = [
            {"pattern": pattern, "count": count}
            for pattern, count in sorted(healing_patterns.items(), key=lambda x: x[1], reverse=True)[:5]
        ]
        
        return HealingStats(
            total_attempts=total_attempts,
            successful_healings=successful_healings,
            failed_healings=failed_healings,
            unique_elements=unique_elements,
            healing_success_rate=round(healing_success_rate, 2),
            most_common_healings=most_common_healings
        )
        
    except Exception as e:
        logger.error(f"Error calculating healing stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get healing stats: {str(e)}")

@router.post("/batch-approve")
async def batch_approve_healings(
    element_ids: List[str],
    review_service: ReviewService = Depends()
):
    """
    Batch approve healing attempts for specific elements
    """
    try:
        updated_count = 0
        
        for element_id in element_ids:
            # Find pending reviews for this element from self-healing
            reviews = await review_service.list_reviews(
                page=1,
                limit=100,
                suggested_by="java_self_healing_engine"
            )
            
            element_reviews = [
                r for r in reviews 
                if r.get("element_id") == element_id and r.get("status") == "pending"
            ]
            
            for review in element_reviews:
                await review_service.update_status(
                    review["id"], 
                    {"status": "approved", "reviewer_notes": "Batch approved via healing API"}
                )
                updated_count += 1
        
        return {
            "success": True,
            "message": f"Approved {updated_count} healing attempts",
            "updated_count": updated_count
        }
        
    except Exception as e:
        logger.error(f"Error batch approving healings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to batch approve: {str(e)}")