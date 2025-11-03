"""
MCP resource management for read-only access to elements and executions

Provides list/get operations with proper caching and pagination.
"""

import logging
from typing import Any, Dict, List
import httpx
from .cache import get_resource_cache, cache_key, async_cached_call

logger = logging.getLogger(__name__)


class ResourceManager:
    """Manages MCP resources with caching and pagination"""
    
    def __init__(self, unified_api_client: httpx.AsyncClient):
        self.unified_api_client = unified_api_client
    
    async def list_resources(self) -> List[Dict[str, Any]]:
        """List all available resources"""
        return [
            {
                "uri": "elements://repository/list",
                "name": "Element Repository List",
                "description": "Paginated list of all elements in the repository",
                "mimeType": "application/json"
            },
            {
                "uri": "elements://repository/get",
                "name": "Element Repository Get",
                "description": "Get specific element by ID",
                "mimeType": "application/json"
            },
            {
                "uri": "executions://test/list",
                "name": "Test Executions List",
                "description": "Paginated list of test executions",
                "mimeType": "application/json"
            },
            {
                "uri": "executions://test/get",
                "name": "Test Execution Get",
                "description": "Get specific test execution by ID",
                "mimeType": "application/json"
            },
            {
                "uri": "stats://repository/summary",
                "name": "Repository Statistics",
                "description": "Summary statistics for the element repository",
                "mimeType": "application/json"
            },
            {
                "uri": "stats://healing/summary",
                "name": "Healing Statistics",
                "description": "Summary statistics for self-healing operations",
                "mimeType": "application/json"
            }
        ]
    
    async def read_resource(self, uri: str, tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Read a resource by URI
        
        Args:
            uri: Resource URI (e.g., "elements://repository/list?limit=10")
            tenant_context: Authenticated tenant context
            
        Returns:
            Resource data
        """
        # Parse URI
        if "://" not in uri:
            raise Exception(f"Invalid resource URI format: {uri}")
        
        scheme, path_and_params = uri.split("://", 1)
        
        if "?" in path_and_params:
            path, query_string = path_and_params.split("?", 1)
            params = self._parse_query_string(query_string)
        else:
            path = path_and_params
            params = {}
        
        # Route to appropriate handler
        if scheme == "elements":
            return await self._handle_elements_resource(path, params, tenant_context)
        elif scheme == "executions":
            return await self._handle_executions_resource(path, params, tenant_context)
        elif scheme == "stats":
            return await self._handle_stats_resource(path, params, tenant_context)
        else:
            raise Exception(f"Unknown resource scheme: {scheme}")
    
    async def _handle_elements_resource(self, path: str, params: Dict[str, str], tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """Handle elements:// resources"""
        if path == "repository/list":
            return await self._list_elements(params, tenant_context)
        elif path == "repository/get":
            return await self._get_element(params, tenant_context)
        else:
            raise Exception(f"Unknown elements resource path: {path}")
    
    async def _handle_executions_resource(self, path: str, params: Dict[str, str], tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """Handle executions:// resources"""
        if path == "test/list":
            return await self._list_executions(params, tenant_context)
        elif path == "test/get":
            return await self._get_execution(params, tenant_context)
        else:
            raise Exception(f"Unknown executions resource path: {path}")
    
    async def _handle_stats_resource(self, path: str, params: Dict[str, str], tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """Handle stats:// resources"""
        if path == "repository/summary":
            return await self._get_repository_stats(params, tenant_context)
        elif path == "healing/summary":
            return await self._get_healing_stats(params, tenant_context)
        else:
            raise Exception(f"Unknown stats resource path: {path}")
    
    async def _list_elements(self, params: Dict[str, str], tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """List elements with pagination"""
        limit = int(params.get("limit", "50"))
        offset = int(params.get("offset", "0"))
        page_filter = params.get("page")
        tag_filter = params.get("tag")
        
        # Build API query
        api_params = {"limit": limit, "offset": offset}
        if page_filter:
            api_params["page"] = page_filter
        if tag_filter:
            api_params["tag"] = tag_filter
        
        query_string = "&".join([f"{k}={v}" for k, v in api_params.items()])
        endpoint = f"/sql/elements?{query_string}"
        
        # Use caching for list requests
        cache = get_resource_cache()
        cache_key_str = cache_key("elements_list", str(api_params), tenant_context["tenant_id"])
        
        async def fetch_elements():
            try:
                response = await self.unified_api_client.get(endpoint)
                response.raise_for_status()
                result = response.json()
                
                elements = result.get("data", [])
                
                # Calculate pagination info
                has_more = len(elements) == limit
                next_cursor = offset + limit if has_more else None
                
                return {
                    "elements": elements,
                    "pagination": {
                        "limit": limit,
                        "offset": offset,
                        "count": len(elements),
                        "has_more": has_more,
                        "next_cursor": next_cursor
                    },
                    "filters": {
                        "page": page_filter,
                        "tag": tag_filter
                    }
                }
            except httpx.HTTPError as e:
                logger.warning(f"Failed to fetch elements: {e}")
                # Return mock data if service unavailable
                mock_elements = [
                    {
                        "logical_key": f"mock_element_{i}",
                        "css_selector": f"#mock-{i}",
                        "tag": "div",
                        "text_content": f"Mock element {i}",
                        "page": "mock_page"
                    }
                    for i in range(min(limit, 5))
                ]
                
                return {
                    "elements": mock_elements,
                    "pagination": {
                        "limit": limit,
                        "offset": offset,
                        "count": len(mock_elements),
                        "has_more": False,
                        "next_cursor": None
                    },
                    "filters": {
                        "page": page_filter,
                        "tag": tag_filter
                    },
                    "mock": True
                }
        
        return await async_cached_call(cache, cache_key_str, fetch_elements)
    
    async def _get_element(self, params: Dict[str, str], tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """Get specific element by ID"""
        element_id = params.get("id")
        if not element_id:
            raise Exception("Element ID is required")
        
        # Use caching for individual element requests
        cache = get_resource_cache()
        cache_key_str = cache_key("element", element_id, tenant_context["tenant_id"])
        
        async def fetch_element():
            try:
                response = await self.unified_api_client.get(f"/sql/elements?logical_key={element_id}")
                response.raise_for_status()
                result = response.json()
                
                elements = result.get("data", [])
                if not elements:
                    raise Exception(f"Element not found: {element_id}")
                
                return {
                    "element": elements[0],
                    "found": True
                }
            except httpx.HTTPError as e:
                if e.response and e.response.status_code == 404:
                    return {"element": None, "found": False}
                
                # Return mock element if service unavailable
                return {
                    "element": {
                        "logical_key": element_id,
                        "css_selector": f"#{element_id}",
                        "xpath": f"//*[@id='{element_id}']",
                        "tag": "div",
                        "text_content": f"Mock element: {element_id}",
                        "page": "mock_page",
                        "mock": True
                    },
                    "found": True
                }
        
        return await async_cached_call(cache, cache_key_str, fetch_element)
    
    async def _list_executions(self, params: Dict[str, str], tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """List test executions with pagination"""
        limit = int(params.get("limit", "50"))
        offset = int(params.get("offset", "0"))
        session_filter = params.get("session_id")
        
        # Build API query
        api_params = {"limit": limit, "offset": offset}
        if session_filter:
            api_params["session_id"] = session_filter
        
        query_string = "&".join([f"{k}={v}" for k, v in api_params.items()])
        endpoint = f"/sql/executions?{query_string}"
        
        try:
            response = await self.unified_api_client.get(endpoint)
            response.raise_for_status()
            result = response.json()
            
            executions = result.get("data", [])
            has_more = len(executions) == limit
            
            return {
                "executions": executions,
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "count": len(executions),
                    "has_more": has_more,
                    "next_cursor": offset + limit if has_more else None
                },
                "filters": {
                    "session_id": session_filter
                }
            }
        except httpx.HTTPError:
            # Return mock executions if service unavailable
            mock_executions = [
                {
                    "id": f"mock_exec_{i}",
                    "tool_name": "run_action",
                    "status": "success",
                    "execution_time_ms": 150,
                    "timestamp": "2025-11-02T12:00:00Z"
                }
                for i in range(min(limit, 3))
            ]
            
            return {
                "executions": mock_executions,
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "count": len(mock_executions),
                    "has_more": False,
                    "next_cursor": None
                },
                "filters": {
                    "session_id": session_filter
                },
                "mock": True
            }
    
    async def _get_execution(self, params: Dict[str, str], tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """Get specific execution by ID"""
        execution_id = params.get("id")
        if not execution_id:
            raise Exception("Execution ID is required")
        
        try:
            response = await self.unified_api_client.get(f"/sql/executions/{execution_id}")
            response.raise_for_status()
            result = response.json()
            
            return {
                "execution": result,
                "found": True
            }
        except httpx.HTTPError as e:
            if e.response and e.response.status_code == 404:
                return {"execution": None, "found": False}
            
            # Return mock execution if service unavailable
            return {
                "execution": {
                    "id": execution_id,
                    "tool_name": "run_action",
                    "status": "success",
                    "execution_time_ms": 200,
                    "result": {"action": "click", "element": "button"},
                    "timestamp": "2025-11-02T12:00:00Z",
                    "mock": True
                },
                "found": True
            }
    
    async def _get_repository_stats(self, params: Dict[str, str], tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """Get repository statistics"""
        try:
            response = await self.unified_api_client.get("/sql/stats")
            response.raise_for_status()
            result = response.json()
            
            return {
                "statistics": result,
                "generated_at": "2025-11-02T12:00:00Z"
            }
        except httpx.HTTPError:
            # Return mock stats if service unavailable
            return {
                "statistics": {
                    "total_elements": 156,
                    "active_elements": 142,
                    "total_sessions": 23,
                    "total_executions": 1247,
                    "success_rate": 0.89,
                    "avg_execution_time_ms": 185
                },
                "generated_at": "2025-11-02T12:00:00Z",
                "mock": True
            }
    
    async def _get_healing_stats(self, params: Dict[str, str], tenant_context: Dict[str, Any]) -> Dict[str, Any]:
        """Get healing statistics"""
        try:
            response = await self.unified_api_client.get("/healing/stats")
            response.raise_for_status()
            result = response.json()
            
            return {
                "healing_statistics": result,
                "generated_at": "2025-11-02T12:00:00Z"
            }
        except httpx.HTTPError:
            # Return mock healing stats if service unavailable
            return {
                "healing_statistics": {
                    "total_healing_attempts": 47,
                    "successful_healings": 32,
                    "healing_success_rate": 0.68,
                    "avg_healing_time_ms": 750,
                    "common_healing_patterns": [
                        {"pattern": "id_changed", "count": 15},
                        {"pattern": "class_changed", "count": 12},
                        {"pattern": "dom_restructure", "count": 8}
                    ]
                },
                "generated_at": "2025-11-02T12:00:00Z",
                "mock": True
            }
    
    def _parse_query_string(self, query_string: str) -> Dict[str, str]:
        """Parse query string into dictionary"""
        params = {}
        for param in query_string.split("&"):
            if "=" in param:
                key, value = param.split("=", 1)
                params[key] = value
            else:
                params[param] = ""
        return params