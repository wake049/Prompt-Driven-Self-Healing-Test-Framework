"""
Version API Endpoints
Provides version and build information for the MCP server
"""

from fastapi import APIRouter, Request
from typing import Dict, Any
import os
import platform
import sys
from datetime import datetime

router = APIRouter(tags=["version"])


@router.get("/version")
async def get_version() -> Dict[str, Any]:
    """
    Get basic version information
    """
    return {
        "version": "0.1.0",
        "schema_version": "1.0.0",
        "git_sha": os.getenv("GIT_SHA", "development"),
        "build_time": os.getenv("BUILD_TIME", datetime.now().isoformat() + "Z"),
        "name": "MCP Server",
        "description": "Model Context Protocol Server for Test Automation Platform",
        "api_version": "v1"
    }


@router.get("/version/detailed")
async def get_detailed_version(request: Request) -> Dict[str, Any]:
    """
    Get comprehensive version and build information
    """
    config = request.app.state.config
    
    # Get system information
    system_info = {
        "platform": platform.platform(),
        "architecture": platform.architecture()[0],
        "machine": platform.machine(),
        "processor": platform.processor(),
        "python_version": platform.python_version(),
        "python_implementation": platform.python_implementation()
    }
    
    # Get environment information
    env_info = {
        "environment": "production" if config.is_production else "development",
        "debug_mode": config.debug,
        "auth_enabled": config.auth_required,
        "host": config.host,
        "port": config.port
    }
    
    # Get build information (would be populated by CI/CD in real deployment)
    build_info = {
        "build_time": os.getenv("BUILD_TIME", "unknown"),
        "build_number": os.getenv("BUILD_NUMBER", "unknown"),
        "git_commit": os.getenv("GIT_COMMIT", "unknown"),
        "git_branch": os.getenv("GIT_BRANCH", "unknown"),
        "built_by": os.getenv("BUILT_BY", "unknown")
    }
    
    # Get dependency versions (key dependencies)
    try:
        import fastapi
        import pydantic
        import uvicorn
        
        dependencies = {
            "fastapi": fastapi.__version__,
            "pydantic": pydantic.__version__,
            "uvicorn": uvicorn.__version__,
            "python": sys.version.split()[0]
        }
    except ImportError as e:
        dependencies = {"error": f"Could not determine versions: {e}"}
    
    return {
        "version": "0.1.0",
        "name": "MCP Server",
        "description": "Model Context Protocol Server for Test Automation Platform",
        "api_version": "v1",
        "build": build_info,
        "system": system_info,
        "environment": env_info,
        "dependencies": dependencies,
        "timestamp": datetime.now().isoformat()
    }


@router.get("/version/health-check-version")
async def get_health_check_version() -> Dict[str, str]:
    """
    Lightweight version check for health monitoring
    """
    return {
        "version": "0.1.0",
        "status": "ok"
    }


@router.get("/version/api-info")
async def get_api_info() -> Dict[str, Any]:
    """
    Get API-specific information
    """
    return {
        "api_version": "v1",
        "supported_formats": ["json"],
        "supported_methods": ["GET", "POST"],
        "authentication": "token-based (optional)",
        "rate_limiting": "1000 requests/minute",
        "max_request_size": "10MB",
        "timeout_seconds": 30,
        "endpoints": {
            "health": "/api/v1/health",
            "version": "/api/v1/version",
            "tools": "/api/v1/tools"
        }
    }


@router.get("/version/compatibility")
async def get_compatibility_info() -> Dict[str, Any]:
    """
    Get compatibility information
    """
    return {
        "mcp_protocol_version": "1.0",
        "minimum_client_version": "0.1.0",
        "supported_transports": ["http", "websocket"],
        "supported_auth_methods": ["token", "none"],
        "backward_compatible_with": ["0.1.0"],
        "breaking_changes": [],
        "deprecated_features": []
    }