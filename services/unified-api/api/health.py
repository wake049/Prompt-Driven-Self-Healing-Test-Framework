"""
Health Check API Router
Provides basic health monitoring endpoints
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
import asyncio
import sys
import os
import logging

from core.database import get_database_manager
from services.self_host_license_validator import get_license_state

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_license_health() -> dict:
    """Return self-host license status for health endpoints."""
    state = get_license_state()
    if state.get("valid") is None:
        return {"status": "not_configured"}
    return {
        "status": "valid" if state["valid"] else "invalid",
        "reason": state.get("reason"),
        "last_checked_at": state.get("last_checked_at"),
    }

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
        
        # Check database connectivity
        db_status = "unknown"
        try:
            async with get_database_manager() as db:
                await db.pool.fetchval("SELECT 1")
                db_status = "healthy"
        except Exception as db_err:
            logger.warning("Health check: database unreachable: %s", db_err)
            db_status = "unhealthy"

        overall_status = "healthy" if db_status == "healthy" else "degraded"

        return {
            "status": overall_status,
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
                "database": db_status
            },
            "self_host_license": _get_license_health()
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