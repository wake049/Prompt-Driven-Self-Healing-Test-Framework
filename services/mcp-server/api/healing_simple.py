from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import logging
import json
import os
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/healing", tags=["healing"])

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

@router.post("/submit")
async def submit_healing_data(submission: HealingSubmission):
    """
    Submit healing data from Java framework for review
    """
    try:
        logger.info(f"Received healing submission with {len(submission.healing_attempts)} attempts")
        
        # Create healing data directory if it doesn't exist
        healing_dir = "healing_data"
        if not os.path.exists(healing_dir):
            os.makedirs(healing_dir)
        
        # Save healing data to file for now
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{healing_dir}/healing_submission_{timestamp}.json"
        
        # Convert to dict for JSON serialization
        data = {
            "session_id": submission.session_id,
            "test_run_id": submission.test_run_id,
            "healing_attempts": [attempt.dict() for attempt in submission.healing_attempts],
            "received_at": datetime.now().isoformat()
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        # Count successful healings
        successful_healings = len([
            attempt for attempt in submission.healing_attempts 
            if attempt.result == "SUCCESS"
        ])
        
        logger.info(f"Saved healing data to {filename}")
        
        return {
            "success": True,
            "message": f"Processed {len(submission.healing_attempts)} healing attempts",
            "successful_healings": successful_healings,
            "saved_to": filename
        }
        
    except Exception as e:
        logger.error(f"Error processing healing submission: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process healing data: {str(e)}")

@router.get("/stats")
async def get_healing_stats():
    """
    Get basic statistics about saved healing data
    """
    try:
        healing_dir = "healing_data"
        if not os.path.exists(healing_dir):
            return {
                "total_files": 0,
                "message": "No healing data found"
            }
        
        files = [f for f in os.listdir(healing_dir) if f.endswith('.json')]
        
        return {
            "total_files": len(files),
            "files": files,
            "data_directory": healing_dir
        }
        
    except Exception as e:
        logger.error(f"Error getting healing stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get healing stats: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "healing_api"}