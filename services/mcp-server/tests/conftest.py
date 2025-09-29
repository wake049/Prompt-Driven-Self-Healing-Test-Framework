"""
Test configuration and fixtures
"""

import pytest
import asyncio
from typing import AsyncGenerator
from fastapi.testclient import TestClient

from main import create_app
from config import MCPConfig
from tool_registry import ToolRegistry
from server import MCPServer


@pytest.fixture
def test_config():
    """Test configuration"""
    return MCPConfig(
        host="127.0.0.1",
        port=8001,
        auth_required=False,
        debug=True,
        tool_call_timeout=5000
    )


@pytest.fixture
async def tool_registry():
    """Test tool registry"""
    registry = ToolRegistry()
    await registry.initialize()
    yield registry
    await registry.cleanup()


@pytest.fixture
async def mcp_server(test_config, tool_registry):
    """Test MCP server"""
    server = MCPServer(test_config, tool_registry)
    await server.start()
    yield server
    await server.stop()


@pytest.fixture
def test_client():
    """Test client for API testing"""
    app = create_app()
    return TestClient(app)


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()