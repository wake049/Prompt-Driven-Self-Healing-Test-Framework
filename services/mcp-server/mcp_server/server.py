"""
MCP Server implementation with stdio and WebSocket transport

Implements the core MCP server with proper protocol compliance,
authentication, and bridging to existing FastAPI services.
"""

import json
import asyncio
import time
import sys
import os
from typing import Any, Dict, List, Optional, Union
import uuid
import httpx
import websockets
from .schemas import (
    MCPRequest, MCPResponse, MCPError, MCPErrorCode, 
    Tool, ToolResult, Resource, TOOL_SCHEMAS
)
from .auth import authenticate, check_permission, AuthenticationError
from .cache import get_element_cache, get_resource_cache, cache_key, async_cached_call
from .tools import ToolExecutor
from .resources import ResourceManager

class MCPServer:
    """
    MCP-compliant server for Self-Healing Test Framework
    
    Supports stdio and WebSocket transports with proper authentication,
    caching, and bridging to existing FastAPI services.
    """
    
    def __init__(self, unified_api_base_url: str = None):
        # Set default URL based on environment
        if unified_api_base_url is None:
            unified_api_base_url = os.getenv("UNIFIED_API_URL")
            if unified_api_base_url is None:
                if os.getenv("ENVIRONMENT") == "production":
                    unified_api_base_url = "https://testhelix.com/api"  # Production API endpoint
                else:
                    unified_api_base_url = "http://localhost:8000"  # Local development
        
        self.unified_api_base_url = unified_api_base_url
        self.unified_api_client = httpx.AsyncClient(base_url=unified_api_base_url)
        self.tool_executor = ToolExecutor(self.unified_api_client)
        self.resource_manager = ResourceManager(self.unified_api_client)
        self.request_counter = 0
        
        # Performance tracking
        self.request_stats = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "avg_latency_ms": 0.0,
            "cache_hits": 0,
            "cache_misses": 0
        }
    
    async def handle_message(self, message: str, tenant_context: Optional[Dict[str, Any]] = None) -> str:
        """
        Handle incoming MCP message
        
        Args:
            message: JSON-RPC message string
            tenant_context: Authenticated tenant context
            
        Returns:
            JSON-RPC response string
        """
        start_time = time.time()
        request_id = None
        
        try:
            # Parse request
            try:
                request_data = json.loads(message)
                request = MCPRequest(**request_data)
                request_id = request.id
            except json.JSONDecodeError:
                return self._create_error_response(
                    None, MCPErrorCode.PARSE_ERROR, "Invalid JSON"
                )
            except Exception as e:
                return self._create_error_response(
                    None, MCPErrorCode.INVALID_REQUEST, f"Invalid request format: {str(e)}"
                )
            
            # Authenticate if no tenant context provided
            if tenant_context is None:
                auth_token = request.params.get("auth_token") if request.params else None
                try:
                    tenant_context = authenticate(auth_token)
                except Exception as e:
                    if isinstance(e, AuthenticationError):
                        return self._create_error_response(
                            request_id, e.code, e.message
                        )
                    else:
                        return self._create_error_response(
                            request_id, MCPErrorCode.UNAUTHORIZED, "Authentication failed"
                        )
            
            # Handle different methods
            if request.method == "tools/list":
                result = await self._handle_list_tools(tenant_context)
            elif request.method == "tools/call":
                result = await self._handle_call_tool(request.params or {}, tenant_context)
            elif request.method == "resources/list":
                result = await self._handle_list_resources(tenant_context)
            elif request.method == "resources/read":
                result = await self._handle_read_resource(request.params or {}, tenant_context)
            elif request.method == "ping":
                result = {"status": "ok", "timestamp": time.time()}
            else:
                return self._create_error_response(
                    request_id, MCPErrorCode.METHOD_NOT_FOUND, f"Unknown method: {request.method}"
                )
            
            # Create success response
            response = MCPResponse(id=request_id, result=result)
            response_str = response.model_dump_json()
            
            # Update stats
            latency_ms = (time.time() - start_time) * 1000
            self._update_stats(True, latency_ms, tenant_context["tenant_id"])
            
            return response_str
            
        except Exception as e:
            # Handle unexpected errors
            latency_ms = (time.time() - start_time) * 1000
            self._update_stats(False, latency_ms, tenant_context["tenant_id"] if tenant_context else "unknown")
            
            return self._create_error_response(
                request_id, MCPErrorCode.INTERNAL_ERROR, f"Internal server error: {str(e)}"
            )
    
    async def _handle_list_tools(self, tenant_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """List available tools"""
        if not check_permission(tenant_context, "read"):
            raise AuthenticationError("Insufficient permissions for tools/list")
        
        tools = [
            {
                "name": "run_action",
                "description": "Execute UI actions like click and type on web page elements with self-healing capabilities",
                "inputSchema": TOOL_SCHEMAS["run_action"]
            },
            {
                "name": "verify.section", 
                "description": "Run multiple verification checks from a stored preset",
                "inputSchema": TOOL_SCHEMAS["verify.section"]
            },
            {
                "name": "context.put",
                "description": "Store a value in the context for later use",
                "inputSchema": TOOL_SCHEMAS["context.put"]
            },
            {
                "name": "context.get",
                "description": "Retrieve a value from the context",
                "inputSchema": TOOL_SCHEMAS["context.get"]
            },
            {
                "name": "context.expectEqual",
                "description": "Assert that a context value equals expected value",
                "inputSchema": TOOL_SCHEMAS["context.expectEqual"]
            },
            {
                "name": "elements.add",
                "description": "Add an element to the repository with selector candidates",
                "inputSchema": TOOL_SCHEMAS["elements.add"]
            },
            {
                "name": "elements.get",
                "description": "Retrieve element data from the repository",
                "inputSchema": TOOL_SCHEMAS["elements.get"]
            },
            {
                "name": "fetch_test_data",
                "description": "Fetch test data from the backend (sessions, elements, executions, healing data)",
                "inputSchema": TOOL_SCHEMAS["fetch_test_data"]
            },
            {
                "name": "analyze_page_elements",
                "description": "Analyze a page's extracted DOM elements using AI and return suggestions/fixes",
                "inputSchema": TOOL_SCHEMAS["analyze_page_elements"]
            },
            {
                "name": "sql_get_all_elements",
                "description": "Get all elements from the SQL database",
                "inputSchema": TOOL_SCHEMAS["sql_get_all_elements"]
            },
            {
                "name": "sql_update_element",
                "description": "Update an element in the SQL database",
                "inputSchema": TOOL_SCHEMAS["sql_update_element"]
            },
            {
                "name": "bulk_generate_locators",
                "description": "Generate improved locators for multiple elements using AI/heuristics",
                "inputSchema": TOOL_SCHEMAS["bulk_generate_locators"]
            },
            {
                "name": "analytics_healing_data",
                "description": "Get healing analytics data including success rates and performance metrics",
                "inputSchema": TOOL_SCHEMAS["analytics_healing_data"]
            },
            {
                "name": "analytics_trends",
                "description": "Get execution and performance trends over time",
                "inputSchema": TOOL_SCHEMAS["analytics_trends"]
            },
            {
                "name": "analytics_failure_patterns",
                "description": "Analyze failure patterns and common issues",
                "inputSchema": TOOL_SCHEMAS["analytics_failure_patterns"]
            },
            {
                "name": "analytics_ai_insights",
                "description": "Get AI-powered insights and recommendations for test optimization",
                "inputSchema": TOOL_SCHEMAS["analytics_ai_insights"]
            },
            {
                "name": "get_review_queue",
                "description": "Get review queue items with filtering, sorting and pagination",
                "inputSchema": TOOL_SCHEMAS["get_review_queue"]
            },
            {
                "name": "get_pending_reviews",
                "description": "Get pending review items for ReviewQueuePage compatibility",
                "inputSchema": TOOL_SCHEMAS["get_pending_reviews"]
            },
            {
                "name": "update_review_status",
                "description": "Update review item status (approve or reject)",
                "inputSchema": TOOL_SCHEMAS["update_review_status"]
            },
            {
                "name": "add_to_review_queue",
                "description": "Add an element to the review queue for manual approval",
                "inputSchema": TOOL_SCHEMAS["add_to_review_queue"]
            }
        ]
        
        return tools
    
    async def _handle_call_tool(self, params: Dict[str, Any], tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool"""
        if not check_permission(tenant_context, "write"):
            raise AuthenticationError("Insufficient permissions for tools/call")
        
        tool_name = params.get("name")
        if not tool_name:
            raise Exception("Tool name is required")
        
        tool_args = params.get("arguments", {})
        
        # Validate tool exists
        if tool_name not in TOOL_SCHEMAS:
            raise Exception(f"Tool not found: {tool_name}")
        
        # Execute tool through ToolExecutor
        result = await self.tool_executor.execute_tool(tool_name, tool_args, tenant_context)
        
        return {
            "ok": result.ok,
            "data": result.data,
            "error": result.error,
            "logs": result.logs
        }
    
    async def _handle_list_resources(self, tenant_context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """List available resources"""
        if not check_permission(tenant_context, "read"):
            raise AuthenticationError("Insufficient permissions for resources/list")
        
        return await self.resource_manager.list_resources()
    
    async def _handle_read_resource(self, params: Dict[str, Any], tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """Read a resource"""
        if not check_permission(tenant_context, "read"):
            raise AuthenticationError("Insufficient permissions for resources/read")
        
        uri = params.get("uri")
        if not uri:
            raise Exception("Resource URI is required")
        
        # Use caching for resource reads
        cache = get_resource_cache()
        cache_key_str = cache_key("resource", uri, tenant_context["tenant_id"])
        
        result = await async_cached_call(
            cache, cache_key_str, 
            self.resource_manager.read_resource,
            uri, tenant_context
        )
        
        if cache.get(cache_key_str) is not None:
            self.request_stats["cache_hits"] += 1
        else:
            self.request_stats["cache_misses"] += 1
        
        return result
    
    def _create_error_response(self, request_id: Union[str, int, None], error_code: MCPErrorCode, message: str, data: Optional[Dict[str, Any]] = None) -> str:
        """Create error response"""
        error = MCPError(code=error_code.value, message=message, data=data)
        response = MCPResponse(id=request_id, error=error)
        return response.model_dump_json()
    
    def _update_stats(self, success: bool, latency_ms: float, tenant_id: str):
        """Update request statistics"""
        self.request_stats["total_requests"] += 1
        if success:
            self.request_stats["successful_requests"] += 1
        else:
            self.request_stats["failed_requests"] += 1
        
        # Update average latency (simple moving average)
        current_avg = self.request_stats["avg_latency_ms"]
        total_requests = self.request_stats["total_requests"]
        self.request_stats["avg_latency_ms"] = (current_avg * (total_requests - 1) + latency_ms) / total_requests
    
    async def run_stdio(self):
        """Run server with stdio transport"""
        health_check = await self.unified_api_client.get("/health")
        health_data = health_check.json()
        
        # Authenticate once for stdio mode
        try:
            tenant_context = authenticate(None)  # Will check environment
        except Exception as e:
            sys.exit(1)
        
        # Read from stdin and write to stdout
        while True:
            try:
                line = sys.stdin.readline()
                if not line:
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                response = await self.handle_message(line, tenant_context)
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                error_response = self._create_error_response(
                    None, MCPErrorCode.INTERNAL_ERROR, str(e)
                )
    
    async def run_websocket(self, host: str = "localhost", port: int = 8765):
        """Run server with WebSocket transport"""
        
        async def handle_client(websocket):
            """Handle WebSocket client connection"""
            client_id = str(uuid.uuid4())[:8]
            
            tenant_context = None
            async for message in websocket:
                response = await self.handle_message(message, tenant_context)
                await websocket.send(response)
                    
                    # Set tenant context after first successful auth
                if tenant_context is None:
                    try:
                        response_data = json.loads(response)
                        if "error" not in response_data:
                            # Auth was successful, get context for next requests
                            tenant_context = authenticate(None)
                    except:
                        pass
        
        # Start WebSocket server
        start_server = websockets.serve(handle_client, host, port)
        await start_server
        
        print(f"MCP server running on ws://{host}:{port}")
        
        # Keep server running
        await asyncio.Future()  # Run forever
    
    def get_stats(self) -> Dict[str, Any]:
        """Get server statistics"""
        return {
            **self.request_stats,
            "cache_stats": {
                "element_cache_size": get_element_cache().size(),
                "resource_cache_size": get_resource_cache().size()
            }
        }