"""
Tools API Endpoints
Provides access to MCP tool registry and tool execution
"""

from fastapi import APIRouter, Request, HTTPException, Depends
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from error_model import MCPError, get_http_status_code, ErrorCode
from auth_middleware import get_current_auth, get_request_context

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tools"])


class ToolCallRequest(BaseModel):
    """Request model for tool calls"""
    tool_name: str
    parameters: Dict[str, Any]
    context: Optional[Dict[str, Any]] = None


class ToolSearchRequest(BaseModel):
    """Request model for tool search"""
    query: str


@router.get("/tools")
async def list_tools(
    request: Request, 
    category: Optional[str] = None
) -> Dict[str, Any]:
    """
    List all available tools or tools in a specific category
    """
    try:
        mcp_server = request.app.state.mcp_server
        return await mcp_server.list_tools(category)
    except Exception as e:
        logger.error(f"Error listing tools: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools/categories")
async def list_tool_categories(request: Request) -> Dict[str, Any]:
    """
    List all available tool categories
    """
    try:
        tool_registry = request.app.state.tool_registry
        categories = tool_registry.list_categories()
        
        category_info = []
        for category in categories:
            tools_in_category = tool_registry.list_tools(category)
            category_info.append({
                "name": category.value,
                "tool_count": len(tools_in_category),
                "tools": tools_in_category
            })
        
        return {
            "status": "success",
            "categories": category_info,
            "total_categories": len(categories)
        }
    except Exception as e:
        logger.error(f"Error listing tool categories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools/registry/stats")
async def get_registry_stats(request: Request) -> Dict[str, Any]:
    """
    Get tool registry statistics
    """
    try:
        tool_registry = request.app.state.tool_registry
        return {
            "status": "success",
            "stats": tool_registry.get_registry_stats()
        }
    except Exception as e:
        logger.error(f"Error getting registry stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools/{tool_name}")
async def get_tool_info(request: Request, tool_name: str) -> Dict[str, Any]:
    """
    Get detailed information about a specific tool
    """
    try:
        mcp_server = request.app.state.mcp_server
        result = await mcp_server.get_tool_info(tool_name)
        
        if result.get("status") == "error":
            raise HTTPException(status_code=404, detail=result.get("error"))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tool info for '{tool_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tools/search")
async def search_tools(request: Request, search_request: ToolSearchRequest) -> Dict[str, Any]:
    """
    Search tools by name, description, or tags
    """
    try:
        mcp_server = request.app.state.mcp_server
        return await mcp_server.search_tools(search_request.query)
    except Exception as e:
        logger.error(f"Error searching tools: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tools/call")
async def call_tool(
    request: Request, 
    tool_request: ToolCallRequest,
    auth: Optional[dict] = Depends(get_current_auth)
) -> Dict[str, Any]:
    """
    Execute a tool with given parameters
    """
    try:
        mcp_server = request.app.state.mcp_server
        
        # Add request context and auth to tool context
        context = tool_request.context or {}
        context.update(get_request_context(request))
        if auth:
            context["auth"] = auth
        
        result = await mcp_server.handle_tool_call(
            tool_request.tool_name,
            tool_request.parameters,
            context
        )
        
        if result.get("status") == "error":
            error_data = result.get("error")
            
            # If error_data is an MCPError dict, use its HTTP status code
            if isinstance(error_data, dict) and "code" in error_data:
                try:
                    error_code = ErrorCode(error_data["code"])
                    status_code = get_http_status_code(error_code)
                    raise HTTPException(status_code=status_code, detail=error_data)
                except ValueError:
                    # Unknown error code, default to 500
                    raise HTTPException(status_code=500, detail=error_data)
            else:
                # Legacy error format
                raise HTTPException(status_code=400, detail=error_data)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calling tool '{tool_request.tool_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Legacy/convenience endpoints for specific tool types

@router.post("/tools/execute")
async def execute_action_tool(
    request: Request,
    action_type: str,
    element_name: str,
    parameters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Convenience endpoint for executing run_action tool
    """
    try:
        mcp_server = request.app.state.mcp_server
        
        tool_params = {
            "action_type": action_type,
            "element_name": element_name,
            "parameters": parameters or {}
        }
        
        return await mcp_server.handle_tool_call("run_action", tool_params)
    except Exception as e:
        logger.error(f"Error executing action tool: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools/elements/{element_name}")
async def get_element(request: Request, element_name: str) -> Dict[str, Any]:
    """
    Convenience endpoint for getting element from repository
    """
    try:
        mcp_server = request.app.state.mcp_server
        
        tool_params = {"element_name": element_name}
        
        return await mcp_server.handle_tool_call("get_element", tool_params)
    except Exception as e:
        logger.error(f"Error getting element '{element_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tools/analytics/log")
async def log_analytics(
    request: Request,
    event_type: str,
    metrics: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Convenience endpoint for analytics logging
    """
    try:
        mcp_server = request.app.state.mcp_server
        
        tool_params = {
            "event_type": event_type,
            "metrics": metrics,
            "context": context or {}
        }
        
        return await mcp_server.handle_tool_call("analytics_log", tool_params)
    except Exception as e:
        logger.error(f"Error logging analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))