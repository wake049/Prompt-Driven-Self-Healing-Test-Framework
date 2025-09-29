"""
MCP Server Implementation
Core server class implementing the Model Context Protocol
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import json

from config import MCPConfig
from tool_registry import ToolRegistry

logger = logging.getLogger(__name__)


class MCPServerError(Exception):
    """Base exception for MCP server errors"""
    pass


class MCPServer:
    """Model Context Protocol Server"""
    
    def __init__(self, config: MCPConfig, tool_registry: ToolRegistry):
        self.config = config
        self.tool_registry = tool_registry
        self._running = False
        self._start_time: Optional[datetime] = None
        self._connections: Dict[str, dict] = {}
        self._request_count = 0
        self._error_count = 0
    
    async def start(self):
        """Start the MCP server"""
        if self._running:
            logger.warning("MCP Server is already running")
            return
        
        logger.info("Starting MCP Server...")
        
        # Validate configuration
        config_warnings = self.config.validate_config()
        if config_warnings:
            for warning in config_warnings:
                logger.warning(f"Config warning: {warning}")
        
        # Initialize server state
        self._running = True
        self._start_time = datetime.now()
        self._request_count = 0
        self._error_count = 0
        
        logger.info("MCP Server started successfully")
    
    async def stop(self):
        """Stop the MCP server"""
        if not self._running:
            logger.warning("MCP Server is not running")
            return
        
        logger.info("Stopping MCP Server...")
        
        # Close all connections
        for connection_id in list(self._connections.keys()):
            await self._close_connection(connection_id)
        
        self._running = False
        logger.info("MCP Server stopped")
    
    @property
    def is_running(self) -> bool:
        """Check if server is running"""
        return self._running
    
    @property
    def uptime_seconds(self) -> float:
        """Get server uptime in seconds"""
        if not self._start_time:
            return 0.0
        return (datetime.now() - self._start_time).total_seconds()
    
    async def handle_tool_call(self, tool_name: str, parameters: dict, context: dict = None) -> dict:
        """Handle a tool call request"""
        try:
            self._request_count += 1
            
            # Validate tool exists
            if not self.tool_registry.get_tool(tool_name):
                raise MCPServerError(f"Tool '{tool_name}' not found")
            
            # Get tool metadata for validation
            metadata = self.tool_registry.get_metadata(tool_name)
            if not metadata:
                raise MCPServerError(f"Tool '{tool_name}' metadata not found")
            
            # Check authentication if required
            if metadata.requires_auth and self.config.auth_required:
                if not self._validate_auth(context):
                    raise MCPServerError("Authentication required")
            
            # Execute tool
            start_time = datetime.now()
            result = await self.tool_registry.call_tool(tool_name, **parameters)
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            
            # Return successful response
            return {
                "status": "success",
                "result": result,
                "execution_time_ms": execution_time,
                "tool_name": tool_name,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            self._error_count += 1
            logger.error(f"Tool call error for '{tool_name}': {e}")
            
            return {
                "status": "error",
                "error": str(e),
                "tool_name": tool_name,
                "timestamp": datetime.now().isoformat()
            }
    
    async def list_tools(self, category: str = None) -> dict:
        """List available tools"""
        try:
            from tool_registry import ToolCategory
            
            # Convert string category to enum if provided
            tool_category = None
            if category:
                try:
                    tool_category = ToolCategory(category.lower())
                except ValueError:
                    raise MCPServerError(f"Invalid category: {category}")
            
            # Get tools list
            tools = self.tool_registry.list_tools(tool_category)
            
            # Get detailed info for each tool
            tools_info = []
            for tool_name in tools:
                tool_info = self.tool_registry.get_tool_info(tool_name)
                if tool_info:
                    tools_info.append(tool_info)
            
            return {
                "status": "success",
                "tools": tools_info,
                "total_count": len(tools_info),
                "category": category,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error listing tools: {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def get_tool_info(self, tool_name: str) -> dict:
        """Get detailed information about a specific tool"""
        try:
            tool_info = self.tool_registry.get_tool_info(tool_name)
            
            if not tool_info:
                return {
                    "status": "error",
                    "error": f"Tool '{tool_name}' not found",
                    "timestamp": datetime.now().isoformat()
                }
            
            return {
                "status": "success",
                "tool": tool_info,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting tool info for '{tool_name}': {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def search_tools(self, query: str) -> dict:
        """Search tools by query"""
        try:
            matches = self.tool_registry.search_tools(query)
            
            # Get detailed info for matched tools
            tools_info = []
            for tool_name in matches:
                tool_info = self.tool_registry.get_tool_info(tool_name)
                if tool_info:
                    tools_info.append(tool_info)
            
            return {
                "status": "success",
                "query": query,
                "matches": tools_info,
                "match_count": len(tools_info),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error searching tools with query '{query}': {e}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def get_server_status(self) -> dict:
        """Get comprehensive server status"""
        registry_stats = self.tool_registry.get_registry_stats()
        
        return {
            "status": "running" if self._running else "stopped",
            "version": "0.1.0",
            "uptime_seconds": self.uptime_seconds,
            "start_time": self._start_time.isoformat() if self._start_time else None,
            "request_count": self._request_count,
            "error_count": self._error_count,
            "error_rate": self._error_count / max(self._request_count, 1),
            "active_connections": len(self._connections),
            "config": self.config.server_info,
            "tools": registry_stats,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_health_status(self) -> dict:
        """Get simple health status for health checks"""
        return {
            "status": "healthy" if self._running else "unhealthy",
            "timestamp": datetime.now().isoformat()
        }
    
    def _validate_auth(self, context: dict = None) -> bool:
        """Validate authentication context"""
        if not self.config.auth_required:
            return True
        
        if not context:
            return False
        
        # Simple token validation (in production, use proper JWT or similar)
        token = context.get("auth_token")
        return token == self.config.auth_token
    
    async def _close_connection(self, connection_id: str):
        """Close a connection"""
        if connection_id in self._connections:
            del self._connections[connection_id]
            logger.info(f"Closed connection: {connection_id}")
    
    async def register_connection(self, connection_id: str, connection_info: dict):
        """Register a new connection"""
        self._connections[connection_id] = {
            "info": connection_info,
            "connected_at": datetime.now(),
            "last_activity": datetime.now()
        }
        logger.info(f"Registered connection: {connection_id}")
    
    async def update_connection_activity(self, connection_id: str):
        """Update connection last activity time"""
        if connection_id in self._connections:
            self._connections[connection_id]["last_activity"] = datetime.now()