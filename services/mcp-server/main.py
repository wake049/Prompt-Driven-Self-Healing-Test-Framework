#!/usr/bin/env python3
"""
MCP Server Bootstrap
Main entry point for the Model Context Protocol server
"""

import asyncio
import logging
import signal
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import MCPConfig
from server import MCPServer
from tool_registry import ToolRegistry
from auth_middleware import AuthMiddleware


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager"""
    logger.info("Starting MCP Server...")
    
    # Initialize configuration
    config = MCPConfig()
    
    # Initialize tool registry
    tool_registry = ToolRegistry()
    await tool_registry.initialize()
    
    # Initialize MCP server
    mcp_server = MCPServer(config, tool_registry)
    await mcp_server.start()
    
    # Initialize auth middleware
    auth_middleware = AuthMiddleware(config)
    
    # Store in app state for access in endpoints
    app.state.config = config
    app.state.mcp_server = mcp_server
    app.state.tool_registry = tool_registry
    app.state.auth_middleware = auth_middleware
    
    logger.info(f"MCP Server started on port {config.port}")
    yield
    
    # Cleanup
    logger.info("Shutting down MCP Server...")
    await mcp_server.stop()
    await tool_registry.cleanup()
    logger.info("MCP Server stopped")


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    app = FastAPI(
        title="MCP Server",
        description="Model Context Protocol Server for Test Automation Platform",
        version="0.1.0",
        lifespan=lifespan
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure properly for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Add authentication middleware
    from auth_middleware import AuthMiddleware
    
    @app.middleware("http")
    async def auth_middleware_handler(request, call_next):
        """Apply authentication middleware to all requests"""
        # Get auth middleware from app state (will be set during startup)
        if hasattr(app.state, 'auth_middleware'):
            auth_middleware = app.state.auth_middleware
            return await auth_middleware(request, call_next)
        else:
            # During startup, auth middleware not yet available
            return await call_next(request)
    
    # Include API routes
    from api import health, version, tools
    app.include_router(health.router, prefix="/api/v1")
    app.include_router(version.router, prefix="/api/v1")
    app.include_router(tools.router, prefix="/api/v1")
    
    return app


def handle_shutdown(signum, frame):
    """Handle shutdown signals gracefully"""
    logger.info(f"Received signal {signum}, shutting down...")
    sys.exit(0)


def main():
    """Main entry point"""
    # Register signal handlers
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    try:
        # Create app
        app = create_app()
        
        # Get configuration
        config = MCPConfig()
        
        # Start server
        import uvicorn
        uvicorn.run(
            app,
            host=config.host,
            port=config.port,
            log_level=config.log_level.lower()
        )
        
    except Exception as e:
        logger.error(f"Failed to start MCP Server: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()