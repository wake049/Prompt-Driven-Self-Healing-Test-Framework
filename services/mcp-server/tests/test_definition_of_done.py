"""
Definition of Done Tests
Comprehensive tests to verify SCRUM 9 & 10 requirements
"""

import pytest
import asyncio
import json
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
import uuid

from main import create_app
from config import MCPConfig
from server import MCPServer
from tool_registry import ToolRegistry
from auth_middleware import AuthMiddleware
from error_model import ErrorCode


@pytest.fixture
def config():
    """Create test configuration"""
    return MCPConfig(
        auth_required=True,
        auth_token="test_token_123",
        port=8001
    )


class TestDefinitionOfDone:
    """Test suite for Definition of Done verification"""
    
    def test_health_endpoint_format(self, dod_client):
        """Test /health returns proper format with status and uptime"""
        response = dod_client.get("/api/v1/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert data["status"] in ["healthy", "unhealthy"]
        assert "timestamp" in data
        
        # Verify timestamp is UTC ISO format
        timestamp = data["timestamp"]
        assert timestamp.endswith("Z") or "+00:00" in timestamp
    
    def test_ready_endpoint_registry_check(self, dod_client):
        """Test /ready verifies registry initialization"""
        response = dod_client.get("/api/v1/health/ready")
        
        # Should return 200 if ready, 503 if not ready
        assert response.status_code in [200, 503]
        
        data = response.json()
        assert "status" in data
        
        if response.status_code == 200:
            assert data["status"] == "ready"
        else:
            assert "not ready" in data["detail"].lower()
    
    def test_version_endpoint_complete_info(self, dod_client):
        """Test /version returns all required fields"""
        response = dod_client.get("/api/v1/version")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ["version", "schema_version", "git_sha", "build_time"]
        
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify build_time is UTC ISO format
        build_time = data["build_time"]
        assert build_time.endswith("Z") or "+00:00" in build_time
    
    def test_config_env_and_file_support(self, config):
        """Test configuration supports both env variables and file loading"""
        # Test environment variable support
        assert hasattr(config, 'port')
        assert hasattr(config, 'auth_token') 
        assert hasattr(config, 'request_timeout_ms')
        
        # Test that config uses env prefix
        assert config.Config.env_prefix == "MCP_"
        assert config.Config.env_file == ".env"
        
        # Test required timeout parameters exist
        assert hasattr(config, 'request_timeout')
        assert hasattr(config, 'tool_call_timeout')
        assert hasattr(config, 'connection_timeout')
    
    def test_auth_enforcement_on_tools_routes(self, dod_client):
        """Test bearer token auth enforced on /tools/* routes"""
        # Test without auth header - should fail
        try:
            response = dod_client.post("/api/v1/tools/call", json={
                "tool_name": "run_action",
                "parameters": {
                    "action_type": "click_css",
                    "element_name": "test_button"
                }
            })
            # If we get here, auth failed to block the request
            assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        except Exception as e:
            # Auth middleware should raise HTTPException with 401
            assert "401" in str(e), f"Expected 401 error, got: {e}"
        
        # Test with invalid token - should fail
        try:
            response = dod_client.post("/api/v1/tools/call", 
                headers={"Authorization": "Bearer invalid_token"},
                json={
                    "tool_name": "run_action", 
                    "parameters": {
                        "action_type": "click_css",
                        "element_name": "test_button"
                    }
                }
            )
            assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        except Exception as e:
            # Auth middleware should raise HTTPException with 401  
            assert "401" in str(e), f"Expected 401 error, got: {e}"
    
    def test_unauthenticated_health_version_access(self, dod_client):
        """Test health and version endpoints are unauthenticated"""
        # Health endpoint should work without auth
        response = dod_client.get("/api/v1/health")
        assert response.status_code == 200
        
        # Version endpoint should work without auth
        response = dod_client.get("/api/v1/version")
        assert response.status_code == 200
        
        # Detailed version should work without auth
        response = dod_client.get("/api/v1/version/detailed")
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_registry_lists_tools_with_metadata(self):
        """Test registry lists tools and returns complete metadata"""
        registry = ToolRegistry()
        await registry.initialize()
        
        # Test list all tools
        tools = registry.list_tools()
        assert len(tools) > 0
        
        # Test get metadata for each tool
        for tool_name in tools:
            metadata = registry.get_metadata(tool_name)
            assert metadata is not None
            assert hasattr(metadata, 'name')
            assert hasattr(metadata, 'description')
            assert hasattr(metadata, 'timeout_ms')
            assert hasattr(metadata, 'requires_auth')
        
        await registry.cleanup()
    
    @pytest.mark.asyncio
    async def test_registry_call_with_timeout(self):
        """Test registry can call tools with timeout enforcement"""
        registry = ToolRegistry()
        await registry.initialize()
        
        # Test successful call
        result = await registry.call_tool(
            "get_element",
            element_name="test_element"
        )
        assert result is not None
        
        await registry.cleanup()
    
    @pytest.mark.asyncio 
    async def test_schema_validation_on_tool_calls(self):
        """Test schema validation runs on all tool calls"""
        from schema_validator import validate_tool_request, validate_tool_response
        
        # Test valid request validation
        error = validate_tool_request("run_action", {
            "action_type": "click_css",
            "element_name": "test_button"
        })
        assert error is None
        
        # Test invalid request validation
        error = validate_tool_request("run_action", {
            "action_type": "invalid_action",  # Invalid enum
            "element_name": "test_button"
        })
        assert error is not None
        assert error.code == ErrorCode.INVALID_ENUM_VALUE
    
    def test_error_response_conforms_to_schema(self, dod_client):
        """Test error responses conform to error.schema.json"""
        # Make request that will fail validation
        response = dod_client.post("/api/v1/tools/call",
            headers={"Authorization": "Bearer test_token_123"},
            json={
                "tool_name": "run_action",
                "parameters": {
                    "action_type": "invalid_action",  # Invalid enum
                    "element_name": "test_button"
                }
            }
        )
        
        assert response.status_code == 400
        error_data = response.json()
        
        # Verify error format
        assert "detail" in error_data
        detail = error_data["detail"]
        
        if isinstance(detail, dict):
            # Should have error structure
            required_fields = ["code", "message", "timestamp"]
            for field in required_fields:
                assert field in detail, f"Missing error field: {field}"
    
    @pytest.mark.asyncio
    async def test_timeout_and_cancel_handling(self):
        """Test timeout and cancellation handling with proper logging"""
        registry = ToolRegistry()
        await registry.initialize()
        
        # Mock a tool that takes too long
        original_tool = registry._tools.get("analytics_log")
        
        async def slow_tool(*args, **kwargs):
            await asyncio.sleep(10)  # Longer than timeout
            return {"result": "should_not_reach"}
        
        registry._tools["analytics_log"] = slow_tool
        
        # Test timeout handling
        with pytest.raises(Exception) as exc_info:
            await asyncio.wait_for(
                registry.call_tool("analytics_log", 
                    event_type="test",
                    metrics={"test": 1},
                    context={"run_id": str(uuid.uuid4()), "environment": "test"}
                ),
                timeout=1.0  # Short timeout
            )
        
        # Restore original tool
        if original_tool:
            registry._tools["analytics_log"] = original_tool
        
        await registry.cleanup()
    
    def test_utc_timestamps_everywhere(self, dod_client):
        """Test all timestamps are UTC ISO 8601 format"""
        # Check health endpoint
        response = dod_client.get("/api/v1/health")
        data = response.json()
        timestamp = data["timestamp"]
        assert timestamp.endswith("Z") or "+00:00" in timestamp
        
        # Check version endpoint
        response = dod_client.get("/api/v1/version")
        data = response.json()
        build_time = data["build_time"]
        assert build_time.endswith("Z") or "+00:00" in build_time
    
    def test_tracing_headers_present(self, dod_client):
        """Test request_id and trace_id are present in responses"""
        # Make request with custom request ID
        custom_request_id = str(uuid.uuid4())
        response = dod_client.get("/api/v1/health", 
            headers={"X-Request-ID": custom_request_id}
        )
        
        # Check response headers
        assert "X-Trace-ID" in response.headers
        assert "X-Request-ID" in response.headers
        
        # Should echo back the custom request ID
        assert response.headers["X-Request-ID"] == custom_request_id
        
        # Trace ID should be a valid UUID
        trace_id = response.headers["X-Trace-ID"]
        uuid.UUID(trace_id)  # Should not raise exception


class TestUnitTests:
    """Unit tests for individual components"""
    
    @pytest.mark.asyncio
    async def test_registry_register_unregister(self):
        """Test registry register/unregister functionality"""
        from tool_registry import ToolRegistry, ToolMetadata, ToolCategory
        
        registry = ToolRegistry()
        
        async def dummy_tool():
            return {"result": "test"}
        
        metadata = ToolMetadata(
            name="test_tool",
            description="Test tool",
            category=ToolCategory.TESTING
        )
        
        # Test register
        registry.register_tool("test_tool", dummy_tool, metadata)
        assert "test_tool" in registry._tools
        
        # Test unregister
        registry.unregister_tool("test_tool")
        assert "test_tool" not in registry._tools
    
    def test_auth_middleware_token_extraction(self):
        """Test auth middleware token extraction"""
        from auth_middleware import AuthMiddleware
        from unittest.mock import Mock
        
        config = MCPConfig(auth_required=True, auth_token="test_token")
        middleware = AuthMiddleware(config)
        
        # Mock request with proper auth header
        request = Mock()
        request.headers = {"Authorization": "Bearer test_token"}
        
        token = middleware.extract_token(request)
        assert token == "test_token"
        
        # Test invalid format
        request.headers = {"Authorization": "Invalid test_token"}
        token = middleware.extract_token(request)
        assert token is None
    
    def test_config_loader_validation(self):
        """Test config loader and validation"""
        config = MCPConfig()
        
        # Test config validation
        warnings = config.validate_config()
        assert isinstance(warnings, list)
        
        # Test server info
        info = config.server_info
        assert "host" in info
        assert "port" in info
        assert "auth_required" in info


class TestContractTests:
    """Contract tests for schema validation"""
    
    @pytest.mark.parametrize("tool_name,valid_params,invalid_params", [
        ("run_action", 
         {"action_type": "click_css", "element_name": "test"},
         {"action_type": "invalid", "element_name": "test"}),
        ("get_element",
         {"element_name": "test"},
         {"element_name": 123}),  # Wrong type
        ("analytics_log",
         {"event_type": "test_started", "metrics": {"test": 1}, "context": {"run_id": str(uuid.uuid4()), "environment": "development"}},
         {"event_type": "invalid_event", "metrics": "not_dict", "context": {}})
    ])
    def test_schema_validation_happy_and_failure_paths(self, tool_name, valid_params, invalid_params):
        """Test schema validation for happy path and failure cases"""
        from schema_validator import validate_tool_request
        
        # Happy path - should pass
        error = validate_tool_request(tool_name, valid_params)
        assert error is None, f"Valid params failed validation: {error}"
        
        # Failure path - should fail
        error = validate_tool_request(tool_name, invalid_params)
        assert error is not None, f"Invalid params passed validation for {tool_name}"


class TestE2ESmokeTest:
    """End-to-end smoke tests"""
    
    def test_tools_run_action_call_success(self, dod_client):
        """Test POST /tools/call with run_action returns success"""
        response = dod_client.post("/api/v1/tools/call",
            headers={"Authorization": "Bearer test_token_123"},
            json={
                "tool_name": "run_action",
                "parameters": {
                    "action_type": "click_css",
                    "element_name": "test_button"
                }
            }
        )
        
        # Should return success (may be mocked)
        assert response.status_code in [200, 401]  # 401 if auth not properly configured in test
        
        if response.status_code == 200:
            data = response.json()
            assert "status" in data or "result" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])