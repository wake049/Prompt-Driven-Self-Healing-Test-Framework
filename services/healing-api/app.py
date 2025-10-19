"""
Simple standalone healing API server for receiving healing data from Java framework
Run this independently from the MCP server on port 3002
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging
import json
import os
from datetime import datetime
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Healing Data API",
    description="Simple API for receiving self-healing data from Java framework",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.post("/api/v1/healing/submit")
async def submit_healing_data(submission: HealingSubmission):
    """
    Submit healing data from Java framework
    """
    try:
        logger.info(f"✓ Received healing submission with {len(submission.healing_attempts)} attempts")
        
        # Create healing data directory if it doesn't exist
        healing_dir = "healing_data"
        if not os.path.exists(healing_dir):
            os.makedirs(healing_dir)
        
        # Save healing data to file
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
        
        logger.info(f"✓ Saved healing data to {filename}")
        logger.info(f"✓ {successful_healings} successful healings out of {len(submission.healing_attempts)} attempts")
        
        return {
            "success": True,
            "message": f"Processed {len(submission.healing_attempts)} healing attempts",
            "successful_healings": successful_healings,
            "saved_to": filename
        }
        
    except Exception as e:
        logger.error(f"✗ Error processing healing submission: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process healing data: {str(e)}")

@app.get("/api/v1/healing/stats")
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

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "service": "healing_api",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Healing Data API is running",
        "endpoints": {
            "submit": "/api/v1/healing/submit",
            "stats": "/api/v1/healing/stats",
            "health": "/health"
        }
    }

if __name__ == "__main__":
    logger.info("🚀 Starting Healing Data API server on port 3002...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=3002,
        log_level="info"
    )