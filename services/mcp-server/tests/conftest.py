"""
Test configuration and fixtures
"""

import pytest
import asyncio
from typing import AsyncGenerator
from fastapi.testclient import TestClient
from contextlib import asynccontextmanager

from main import create_app
from config import MCPConfig
from tool_registry import ToolRegistry
from server import MCPServer
from auth_middleware import AuthMiddleware


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
def dod_config():
    """DoD test configuration with auth enabled"""
    return MCPConfig(
        host="127.0.0.1",
        port=8001,
        auth_required=True,
        auth_token="test_token_123",
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
def client(test_config):
    """Test client with properly initialized app state"""
    
    # Create simple app without lifespan for testing
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    
    app = FastAPI(
        title="MCP Server Test",
        description="Test version of MCP Server",
        version="0.1.0-test"
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include API routes
    from api import health, version, tools
    app.include_router(health.router, prefix="/api/v1")
    app.include_router(version.router, prefix="/api/v1")
    app.include_router(tools.router, prefix="/api/v1")
    
    # Manually initialize app state synchronously
    import asyncio
    
    async def init_state():
        """Initialize app state components"""
        # Initialize components
        config = test_config
        tool_registry = ToolRegistry()
        await tool_registry.initialize()
        
        mcp_server = MCPServer(config, tool_registry)
        await mcp_server.start()
        
        auth_middleware = AuthMiddleware(config)
        
        # Store in app state
        app.state.config = config
        app.state.mcp_server = mcp_server
        app.state.tool_registry = tool_registry
        app.state.auth_middleware = auth_middleware
        
        return mcp_server, tool_registry
    
    # Run initialization synchronously
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        mcp_server, tool_registry = loop.run_until_complete(init_state())
        
        # Create test client
        client = TestClient(app)
        
        yield client
        
        # Cleanup
        loop.run_until_complete(mcp_server.stop())
        loop.run_until_complete(tool_registry.cleanup())
    finally:
        loop.close()


@pytest.fixture
def dod_client(dod_config):
    """DoD test client with auth enabled"""
    
    # Create simple app without lifespan for testing
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    
    app = FastAPI(
        title="MCP Server DoD Test",
        description="DoD Test version of MCP Server",
        version="0.1.0-test"
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Add authentication middleware
    @app.middleware("http")
    async def auth_middleware_handler(request, call_next):
        """Apply authentication middleware to all requests"""
        if hasattr(app.state, 'auth_middleware'):
            auth_middleware = app.state.auth_middleware
            return await auth_middleware(request, call_next)
        else:
            return await call_next(request)
    
    # Include API routes
    from api import health, version, tools
    app.include_router(health.router, prefix="/api/v1")
    app.include_router(version.router, prefix="/api/v1")
    app.include_router(tools.router, prefix="/api/v1")
    
    # Manually initialize app state synchronously
    import asyncio
    
    async def init_state():
        """Initialize app state components"""
        # Initialize components
        config = dod_config
        tool_registry = ToolRegistry()
        await tool_registry.initialize()
        
        mcp_server = MCPServer(config, tool_registry)
        await mcp_server.start()
        
        auth_middleware = AuthMiddleware(config)
        
        # Store in app state
        app.state.config = config
        app.state.mcp_server = mcp_server
        app.state.tool_registry = tool_registry
        app.state.auth_middleware = auth_middleware
        
        return mcp_server, tool_registry
    
    # Run initialization synchronously
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        mcp_server, tool_registry = loop.run_until_complete(init_state())
        
        # Create test client
        client = TestClient(app)
        
        yield client
        
        # Cleanup
        loop.run_until_complete(mcp_server.stop())
        loop.run_until_complete(tool_registry.cleanup())
    finally:
        loop.close()


@pytest.fixture
def test_client():
    """Legacy test client fixture for backwards compatibility"""
    app = create_app()
    return TestClient(app)


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()