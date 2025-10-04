"""
Integration Test for MCP Server Schema Validation and Error Handling
Tests the complete flow from API endpoint to schema validation
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# Import MCP server components
from server import MCPServer
from config import MCPConfig
from tool_registry import ToolRegistry
from error_model import ErrorCode, ErrorCategory
from schema_validator import ToolSchemaValidator


class TestMCPServerIntegration:
    """Integration tests for MCP server with schema validation"""
    
    @pytest.fixture
    def mock_config(self):
        """Create mock configuration"""
        config = Mock(spec=MCPConfig)
        config.auth_required = False
        config.server_info = {"version": "0.1.0", "environment": "test"}
        config.validate_config.return_value = []
        return config
    
    @pytest.fixture
    def mock_tool_registry(self):
        """Create mock tool registry"""
        registry = Mock(spec=ToolRegistry)
        
        # Mock tool metadata
        metadata = Mock()
        metadata.requires_auth = False
        registry.get_metadata.return_value = metadata
        registry.get_tool.return_value = AsyncMock()
        registry.call_tool = AsyncMock()
        
        return registry
    
    @pytest.fixture
    async def mcp_server(self, mock_config, mock_tool_registry):
        """Create MCP server instance"""
        server = MCPServer(mock_config, mock_tool_registry)
        await server.start()
        return server
    
    @pytest.mark.asyncio
    async def test_valid_tool_call_with_schema_validation(self, mcp_server, mock_tool_registry):
        """Test valid tool call passes schema validation"""
        
        # Mock successful tool execution
        mock_tool_registry.call_tool.return_value = {
            "success": True,
            "element_found": True,
            "action_executed": True,
            "screenshot_taken": False,
            "healing_applied": False,
            "execution_time_ms": 1200,
            "screenshot_path": None
        }
        
        # Valid request parameters
        parameters = {
            "element_name": "login_button",
            "action_type": "click",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "timeout_ms": 5000,
            "healing_enabled": True
        }
        
        # Call tool
        result = await mcp_server.handle_tool_call("run_action", parameters)
        
        # Verify successful execution
        assert result["status"] == "success"
        assert "result" in result
        assert "execution_time_ms" in result
        assert result["tool_name"] == "run_action"
        
        # Verify tool was called with correct parameters
        mock_tool_registry.call_tool.assert_called_once_with("run_action", **parameters)
    
    @pytest.mark.asyncio
    async def test_invalid_request_schema_validation(self, mcp_server):
        """Test invalid request fails schema validation"""
        
        # Invalid request - missing required field
        parameters = {
            "action_type": "click",
            "session_id": "123e4567-e89b-12d3-a456-426614174000"
            # Missing required "element_name"
        }
        
        # Call tool
        result = await mcp_server.handle_tool_call("run_action", parameters)
        
        # Verify validation failure
        assert result["status"] == "error"
        assert "error" in result
        
        error = result["error"]
        assert error["code"] == ErrorCode.MISSING_REQUIRED_FIELD.value
        assert error["category"] == ErrorCategory.VALIDATION.value
        assert "element_name" in error["message"]
    
    @pytest.mark.asyncio
    async def test_invalid_field_type_validation(self, mcp_server):
        """Test invalid field type fails validation"""
        
        # Invalid request - wrong field type
        parameters = {
            "element_name": "login_button",
            "action_type": "click",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "timeout_ms": "5000"  # Should be integer, not string
        }
        
        # Call tool
        result = await mcp_server.handle_tool_call("run_action", parameters)
        
        # Verify validation failure
        assert result["status"] == "error"
        assert "error" in result
        
        error = result["error"]
        assert error["code"] == ErrorCode.INVALID_FIELD_TYPE.value
        assert "timeout_ms" in error["message"]
    
    @pytest.mark.asyncio
    async def test_invalid_enum_value_validation(self, mcp_server):
        """Test invalid enum value fails validation"""
        
        # Invalid request - invalid enum value
        parameters = {
            "element_name": "login_button",
            "action_type": "invalid_action",  # Not in enum
            "session_id": "123e4567-e89b-12d3-a456-426614174000"
        }
        
        # Call tool
        result = await mcp_server.handle_tool_call("run_action", parameters)
        
        # Verify validation failure
        assert result["status"] == "error"
        assert "error" in result
        
        error = result["error"]
        assert error["code"] == ErrorCode.INVALID_ENUM_VALUE.value
        assert "action_type" in error["message"]
    
    @pytest.mark.asyncio
    async def test_invalid_uuid_format_validation(self, mcp_server):
        """Test invalid UUID format fails validation"""
        
        # Invalid request - invalid UUID format
        parameters = {
            "element_name": "login_button",
            "action_type": "click",
            "session_id": "invalid-uuid-format"  # Invalid UUID
        }
        
        # Call tool
        result = await mcp_server.handle_tool_call("run_action", parameters)
        
        # Verify validation failure
        assert result["status"] == "error"
        assert "error" in result
        
        error = result["error"]
        assert error["code"] == ErrorCode.INVALID_UUID_FORMAT.value
        assert "session_id" in error["message"]
    
    @pytest.mark.asyncio
    async def test_parameter_out_of_range_validation(self, mcp_server):
        """Test parameter out of range fails validation"""
        
        # Invalid request - parameter out of range
        parameters = {
            "page_url": "https://example.com/login",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "max_elements": 100  # Exceeds maximum of 50
        }
        
        # Call tool
        result = await mcp_server.handle_tool_call("bulk_generate_locators", parameters)
        
        # Verify validation failure
        assert result["status"] == "error"
        assert "error" in result
        
        error = result["error"]
        assert error["code"] == ErrorCode.PARAMETER_OUT_OF_RANGE.value
        assert "max_elements" in error["message"]
    
    @pytest.mark.asyncio
    async def test_tool_not_found_error(self, mcp_server, mock_tool_registry):
        """Test tool not found error"""
        
        # Mock tool not found
        mock_tool_registry.get_tool.return_value = None
        
        # Call nonexistent tool
        result = await mcp_server.handle_tool_call("nonexistent_tool", {})
        
        # Verify error
        assert result["status"] == "error"
        assert "Tool 'nonexistent_tool' not found" in result["error"]
    
    @pytest.mark.asyncio
    async def test_tool_execution_exception(self, mcp_server, mock_tool_registry):
        """Test tool execution exception handling"""
        
        # Mock tool execution failure
        mock_tool_registry.call_tool.side_effect = Exception("Tool execution failed")
        
        # Valid request parameters
        parameters = {
            "element_name": "login_button",
            "action_type": "click",
            "session_id": "123e4567-e89b-12d3-a456-426614174000"
        }
        
        # Call tool
        result = await mcp_server.handle_tool_call("run_action", parameters)
        
        # Verify error handling
        assert result["status"] == "error"
        assert "error" in result
        
        error = result["error"]
        assert error["code"] == ErrorCode.UNEXPECTED_ERROR.value
        assert "Tool execution failed" in error["message"]


class TestSchemaValidatorDirect:
    """Direct tests for schema validator"""
    
    @pytest.fixture
    def schema_validator(self):
        """Create schema validator instance"""
        return ToolSchemaValidator()
    
    def test_validate_run_action_success(self, schema_validator):
        """Test successful run_action validation"""
        
        request_data = {
            "element_name": "login_button",
            "action_type": "click",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "timeout_ms": 5000,
            "healing_enabled": True
        }
        
        is_valid, error = schema_validator.validate_tool_call("run_action", request_data)
        assert is_valid, f"Validation failed: {error}"
        assert error is None
    
    def test_validate_get_element_success(self, schema_validator):
        """Test successful get_element validation"""
        
        request_data = {
            "element_name": "login_button",
            "session_id": "123e4567-e89b-12d3-a456-426614174000"
        }
        
        is_valid, error = schema_validator.validate_tool_call("get_element", request_data)
        assert is_valid, f"Validation failed: {error}"
        assert error is None
    
    def test_validate_bulk_generate_locators_success(self, schema_validator):
        """Test successful bulk_generate_locators validation"""
        
        request_data = {
            "page_url": "https://example.com/login",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "max_elements": 25,
            "include_invisible": False
        }
        
        is_valid, error = schema_validator.validate_tool_call("bulk_generate_locators", request_data)
        assert is_valid, f"Validation failed: {error}"
        assert error is None
    
    def test_validate_analytics_log_success(self, schema_validator):
        """Test successful analytics_log validation"""
        
        request_data = {
            "event_type": "action_executed",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "metadata": {
                "element_name": "login_button",
                "action_type": "click",
                "success": True
            }
        }
        
        is_valid, error = schema_validator.validate_tool_call("analytics_log", request_data)
        assert is_valid, f"Validation failed: {error}"
        assert error is None
    
    def test_get_tool_schema_info(self, schema_validator):
        """Test getting tool schema information"""
        
        info = schema_validator.get_tool_schema_info("run_action")
        assert info is not None
        assert info["tool_name"] == "run_action"
        assert "title" in info
        assert "description" in info
        assert "request" in info
        assert "response" in info
        
        # Check required fields
        assert "required_fields" in info["request"]
        required_fields = info["request"]["required_fields"]
        assert "element_name" in required_fields
        assert "action_type" in required_fields
        assert "session_id" in required_fields


if __name__ == "__main__":
    pytest.main([__file__, "-v"])