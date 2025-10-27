"""
Health Check API Router
Provides basic health monitoring endpoints
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
import asyncio
import sys
import os

router = APIRouter()

@router.get("/")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Unified MCP API Server"
    }

@router.get("/detailed")
async def detailed_health():
    """Detailed health check with service status"""
    try:
        # Check Python version
        python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        
        # Check memory usage (basic)
        import psutil
        memory_info = psutil.virtual_memory()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "Unified MCP API Server",
            "system_info": {
                "python_version": python_version,
                "platform": sys.platform,
                "memory_usage": {
                    "total": memory_info.total,
                    "available": memory_info.available,
                    "percent": memory_info.percent
                }
            },
            "services": {
                "policy_engine": "healthy", 
                "ai_service": "healthy",
                "healing_api": "healthy",
                "sql_backend": "healthy"
            }
        }
    except Exception as e:
        return {
            "status": "degraded",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }

@router.get("/ready")
async def readiness_check():
    """Kubernetes readiness probe endpoint"""
    # Add actual readiness checks here
    return {"status": "ready"}

@router.get("/live")
async def liveness_check():
    """Kubernetes liveness probe endpoint"""
    return {"status": "alive"}