"""
Test API endpoints
"""

import pytest
from fastapi.testclient import TestClient


class TestHealthAPI:
    """Test health endpoints"""
    
    def test_basic_health_check(self, test_client):
        """Test basic health endpoint"""
        response = test_client.get("/api/v1/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    def test_liveness_probe(self, test_client):
        """Test liveness probe"""
        response = test_client.get("/api/v1/health/live")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"
    
    def test_readiness_probe(self, test_client):
        """Test readiness probe"""
        response = test_client.get("/api/v1/health/ready")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ready"


class TestVersionAPI:
    """Test version endpoints"""
    
    def test_basic_version(self, test_client):
        """Test basic version endpoint"""
        response = test_client.get("/api/v1/version")
        assert response.status_code == 200
        
        data = response.json()
        assert data["version"] == "0.1.0"
        assert data["name"] == "MCP Server"
        assert data["api_version"] == "v1"
    
    def test_detailed_version(self, test_client):
        """Test detailed version endpoint"""
        response = test_client.get("/api/v1/version/detailed")
        assert response.status_code == 200
        
        data = response.json()
        assert data["version"] == "0.1.0"
        assert "build" in data
        assert "system" in data
        assert "environment" in data
        assert "dependencies" in data
    
    def test_api_info(self, test_client):
        """Test API info endpoint"""
        response = test_client.get("/api/v1/version/api-info")
        assert response.status_code == 200
        
        data = response.json()
        assert data["api_version"] == "v1"
        assert "endpoints" in data
        assert "supported_formats" in data


class TestToolsAPI:
    """Test tools endpoints"""
    
    def test_list_tools(self, test_client):
        """Test listing tools"""
        response = test_client.get("/api/v1/tools")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert isinstance(data["tools"], list)
        assert data["total_count"] > 0
    
    def test_get_tool_info(self, test_client):
        """Test getting tool info"""
        response = test_client.get("/api/v1/tools/run_action")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert data["tool"]["name"] == "run_action"
    
    def test_get_nonexistent_tool(self, test_client):
        """Test getting info for nonexistent tool"""
        response = test_client.get("/api/v1/tools/nonexistent")
        assert response.status_code == 404
    
    def test_search_tools(self, test_client):
        """Test tool search"""
        response = test_client.post(
            "/api/v1/tools/search",
            json={"query": "action"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert "matches" in data
    
    def test_call_tool(self, test_client):
        """Test tool execution"""
        response = test_client.post(
            "/api/v1/tools/call",
            json={
                "tool_name": "run_action",
                "parameters": {
                    "action_type": "click",
                    "element_name": "test_button",
                    "parameters": {}
                }
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert "result" in data
    
    def test_list_categories(self, test_client):
        """Test listing tool categories"""
        response = test_client.get("/api/v1/tools/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "success"
        assert isinstance(data["categories"], list)
        assert data["total_categories"] > 0