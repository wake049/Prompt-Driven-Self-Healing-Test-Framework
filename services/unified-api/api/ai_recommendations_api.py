"""
AI Recommendations API
Provides AI-powered recommendations for test step failures
"""

import logging
import base64
import os
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from pathlib import Path

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    OpenAI = None

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/recommendations", tags=["AI Recommendations"])

class RecommendationRequest(BaseModel):
    step_id: Optional[str] = None
    action: str
    locator: Optional[str] = None
    error_message: Optional[str] = None
    screenshot_path: Optional[str] = None
    healing_attempts: Optional[List[Dict[str, Any]]] = None

class Recommendation(BaseModel):
    icon: str
    title: str
    description: str
    confidence: float

class RecommendationsResponse(BaseModel):
    recommendations: List[Recommendation]
    analysis: str

def get_openai_client():
    """Get OpenAI client instance"""
    if not OPENAI_AVAILABLE:
        raise HTTPException(status_code=503, detail="OpenAI client not available")
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")
    
    return OpenAI(api_key=api_key)

def encode_screenshot(screenshot_path: str) -> Optional[str]:
    """Encode screenshot to base64 for vision API"""
    try:
        # Handle URLs - extract filename
        if screenshot_path.startswith('http://') or screenshot_path.startswith('https://'):
            # Extract filename from URL (e.g., "http://localhost:8000/screenshots/file.png" -> "file.png")
            screenshot_path = screenshot_path.split('/screenshots/')[-1]
            logger.info(f"Extracted filename from URL: {screenshot_path}")
        
        # Handle both absolute and relative paths
        if not os.path.isabs(screenshot_path):
            # Try relative to java-runner screenshots directory
            java_runner_path = Path(__file__).parent.parent.parent / "java-runner" / "screenshots" / screenshot_path
            if java_runner_path.exists():
                screenshot_path = str(java_runner_path)
                logger.info(f"Found screenshot at: {screenshot_path}")
            else:
                logger.warning(f"Screenshot not found at: {java_runner_path}")
                return None
        
        if not os.path.exists(screenshot_path):
            logger.warning(f"Screenshot file does not exist: {screenshot_path}")
            return None
        
        with open(screenshot_path, "rb") as image_file:
            encoded = base64.b64encode(image_file.read()).decode('utf-8')
            logger.info(f"Successfully encoded screenshot ({len(encoded)} bytes)")
            return encoded
    except Exception as e:
        logger.error(f"Error encoding screenshot: {e}")
        return None

@router.post("", response_model=RecommendationsResponse)
async def get_ai_recommendations(
    request: RecommendationRequest,
    authorization: str = Header(None)
):
    """
    Get AI-powered recommendations for a failed test step.
    Analyzes the error, healing attempts, and screenshot (if available).
    """
    try:
        client = get_openai_client()
        
        # Build context for AI analysis
        context_parts = [
            f"Test step failed with action: {request.action}",
        ]
        
        if request.locator:
            context_parts.append(f"Element locator: {request.locator}")
        
        if request.error_message:
            context_parts.append(f"Error message: {request.error_message}")
        
        if request.healing_attempts:
            context_parts.append(f"\nSelf-healing attempted {len(request.healing_attempts)} alternatives:")
            for i, attempt in enumerate(request.healing_attempts, 1):
                attempted = attempt.get('attemptedAlternatives', [])
                healed = attempt.get('healedLocator')
                result = attempt.get('result', 'failed')
                context_parts.append(f"  {i}. Tried {len(attempted)} alternatives - {result}")
                if healed:
                    context_parts.append(f"     Healed locator: {healed}")
        
        context = "\n".join(context_parts)
        
        # Prepare messages for AI
        messages = [
            {
                "role": "system",
                "content": """You are an expert test automation engineer analyzing test failures. 
Provide 3 specific, actionable recommendations to fix the test step failure.
For each recommendation, provide:
1. A concise title (5-8 words)
2. A detailed description (20-40 words) with specific technical advice
3. An appropriate emoji icon
4. A confidence score (0.0-1.0)

Format your response as JSON:
{
  "analysis": "Brief analysis of the root cause (30-50 words)",
  "recommendations": [
    {
      "icon": "💡",
      "title": "Recommendation title",
      "description": "Detailed actionable advice",
      "confidence": 0.85
    }
  ]
}"""
            },
            {
                "role": "user",
                "content": context
            }
        ]
        
        # Add screenshot if available (vision API)
        screenshot_base64 = None
        if request.screenshot_path:
            screenshot_base64 = encode_screenshot(request.screenshot_path)
            if screenshot_base64:
                messages.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Here is a screenshot of the failure:"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{screenshot_base64}",
                                "detail": "high"
                            }
                        }
                    ]
                })
        
        # Call OpenAI API
        model = "gpt-4o" if screenshot_base64 else "gpt-4o-mini"
        
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=800,
            response_format={"type": "json_object"}
        )
        
        # Parse response
        result = response.choices[0].message.content
        data = json.loads(result)
        
        return RecommendationsResponse(
            recommendations=[
                Recommendation(**rec) for rec in data.get("recommendations", [])
            ],
            analysis=data.get("analysis", "Analysis not available")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating AI recommendations: {e}")
        # Fallback to generic recommendations
        return RecommendationsResponse(
            recommendations=[
                Recommendation(
                    icon="💡",
                    title="Verify Element Selector",
                    description="The selector may have changed. Try using a more stable selector like data-testid or aria-label attributes.",
                    confidence=0.7
                ),
                Recommendation(
                    icon="⏱️",
                    title="Add Wait Condition",
                    description="Element might not be ready when accessed. Consider adding an explicit wait for the element to be visible or clickable.",
                    confidence=0.65
                ),
                Recommendation(
                    icon="🔄",
                    title="Check Page State",
                    description="Ensure the page is fully loaded and any animations or transitions have completed before interacting with elements.",
                    confidence=0.6
                )
            ],
            analysis="Unable to perform AI analysis. Showing generic recommendations."
        )

import json
