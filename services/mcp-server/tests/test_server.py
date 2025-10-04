"""
Test MCP Server core functionality
"""

import pytest
from datetime import datetime


class TestMCPServer:
    """Test MCPServer class"""
    
    @pytest.mark.asyncio
    async def test_server_start_stop(self, mcp_server):
        """Test server start and stop"""
        assert mcp_server.is_running
        assert mcp_server.uptime_seconds > 0
        assert mcp_server._start_time is not None
    
    @pytest.mark.asyncio
    async def test_server_status(self, mcp_server):
        """Test server status reporting"""
        status = mcp_server.get_server_status()
        
        assert status["status"] == "running"
        assert status["version"] == "0.1.0"
        assert status["uptime_seconds"] > 0
        assert "request_count" in status
        assert "error_count" in status
        assert "tools" in status
    
    @pytest.mark.asyncio
    async def test_health_status(self, mcp_server):
        """Test health status"""
        health = mcp_server.get_health_status()
        
        assert health["status"] == "healthy"
        assert "timestamp" in health
    
    @pytest.mark.asyncio
    async def test_tool_call_success(self, mcp_server):
        """Test successful tool call"""
        result = await mcp_server.handle_tool_call(
            "run_action",
            {
                "action_type": "click",
                "element_name": "test_button",
                "parameters": {}
            }
        )
        
        assert result["status"] == "success"
        assert "result" in result
        assert "execution_time_ms" in result
        assert result["tool_name"] == "run_action"
    
    @pytest.mark.asyncio
    async def test_tool_call_invalid_tool(self, mcp_server):
        """Test tool call with invalid tool name"""
        result = await mcp_server.handle_tool_call(
            "nonexistent_tool",
            {}
        )
        
        assert result["status"] == "error"
        assert "not found" in result["error"].lower()
    
    @pytest.mark.asyncio
    async def test_list_tools(self, mcp_server):
        """Test listing tools"""
        result = await mcp_server.list_tools()
        
        assert result["status"] == "success"
        assert isinstance(result["tools"], list)
        assert result["total_count"] > 0
        
        # Check that core tools are present
        tool_names = [tool["name"] for tool in result["tools"]]
        assert "run_action" in tool_names
        assert "get_element" in tool_names
    
    @pytest.mark.asyncio
    async def test_get_tool_info(self, mcp_server):
        """Test getting tool information"""
        result = await mcp_server.get_tool_info("run_action")
        
        assert result["status"] == "success"
        assert result["tool"]["name"] == "run_action"
        assert "description" in result["tool"]
        assert "category" in result["tool"]
        assert "timeout_ms" in result["tool"]
    
    @pytest.mark.asyncio
    async def test_search_tools(self, mcp_server):
        """Test tool search"""
        result = await mcp_server.search_tools("action")
        
        assert result["status"] == "success"
        assert "matches" in result
        assert result["match_count"] > 0
        
        # Should find run_action
        tool_names = [tool["name"] for tool in result["matches"]]
        assert "run_action" in tool_names