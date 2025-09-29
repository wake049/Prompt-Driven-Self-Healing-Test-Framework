"""
Health Check API Endpoints
Provides health and status monitoring for the MCP server
"""

from fastapi import APIRouter, Request, HTTPException
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(request: Request) -> Dict[str, Any]:
    """
    Simple health check endpoint
    Returns basic server health status
    """
    try:
        mcp_server = request.app.state.mcp_server
        return mcp_server.get_health_status()
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")


@router.get("/health/detailed")
async def detailed_health_check(request: Request) -> Dict[str, Any]:
    """
    Detailed health check with comprehensive server status
    Includes performance metrics, configuration, and component status
    """
    try:
        mcp_server = request.app.state.mcp_server
        config = request.app.state.config
        tool_registry = request.app.state.tool_registry
        
        # Get comprehensive status
        server_status = mcp_server.get_server_status()
        
        # Add additional health metrics
        health_details = {
            **server_status,
            "health_check_time": server_status["timestamp"],
            "components": {
                "mcp_server": {
                    "status": "healthy" if mcp_server.is_running else "unhealthy",
                    "uptime_seconds": mcp_server.uptime_seconds
                },
                "tool_registry": {
                    "status": "healthy" if tool_registry._initialized else "unhealthy",
                    "total_tools": len(tool_registry._tools)
                },
                "configuration": {
                    "status": "healthy",
                    "auth_enabled": config.auth_required,
                    "debug_mode": config.debug
                }
            },
            "performance": {
                "request_count": server_status.get("request_count", 0),
                "error_count": server_status.get("error_count", 0),
                "error_rate": server_status.get("error_rate", 0.0),
                "active_connections": server_status.get("active_connections", 0)
            }
        }
        
        return health_details
        
    except Exception as e:
        logger.error(f"Detailed health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Health check failed: {str(e)}")


@router.get("/health/live")
async def liveness_probe(request: Request) -> Dict[str, str]:
    """
    Kubernetes liveness probe endpoint
    Returns simple OK if server is running
    """
    try:
        mcp_server = request.app.state.mcp_server
        if mcp_server.is_running:
            return {"status": "ok"}
        else:
            raise HTTPException(status_code=503, detail="Server not running")
    except Exception as e:
        logger.error(f"Liveness probe failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")


@router.get("/health/ready")
async def readiness_probe(request: Request) -> Dict[str, str]:
    """
    Kubernetes readiness probe endpoint
    Returns OK if server is ready to handle requests
    """
    try:
        mcp_server = request.app.state.mcp_server
        tool_registry = request.app.state.tool_registry
        
        # Check if all components are ready
        if (mcp_server.is_running and 
            tool_registry._initialized and 
            len(tool_registry._tools) > 0):
            return {"status": "ready"}
        else:
            raise HTTPException(status_code=503, detail="Server not ready")
            
    except Exception as e:
        logger.error(f"Readiness probe failed: {e}")
        raise HTTPException(status_code=503, detail="Service not ready")


@router.get("/health/metrics")
async def health_metrics(request: Request) -> Dict[str, Any]:
    """
    Prometheus-style metrics endpoint
    Returns key performance metrics for monitoring
    """
    try:
        mcp_server = request.app.state.mcp_server
        tool_registry = request.app.state.tool_registry
        
        # Get server status
        status = mcp_server.get_server_status()
        
        # Format metrics in a structure suitable for monitoring
        metrics = {
            "mcp_server_uptime_seconds": status.get("uptime_seconds", 0),
            "mcp_server_requests_total": status.get("request_count", 0),
            "mcp_server_errors_total": status.get("error_count", 0),
            "mcp_server_error_rate": status.get("error_rate", 0.0),
            "mcp_server_active_connections": status.get("active_connections", 0),
            "mcp_server_tools_registered": len(tool_registry._tools),
            "mcp_server_status": 1 if mcp_server.is_running else 0,
            "mcp_server_registry_initialized": 1 if tool_registry._initialized else 0
        }
        
        return {
            "metrics": metrics,
            "timestamp": status["timestamp"]
        }
        
    except Exception as e:
        logger.error(f"Metrics endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=f"Metrics collection failed: {str(e)}")