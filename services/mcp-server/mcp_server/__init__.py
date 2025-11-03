"""
MCP Server package for Self-Healing Test Framework

This package provides a Model Context Protocol compliant server that bridges
to existing FastAPI services without duplicating business logic.
"""

from .server import MCPServer
from .tools import register_tools
from .auth import authenticate

__version__ = "1.0.0"

__all__ = ["MCPServer", "register_tools", "authenticate"]

def run_stdio():
    """Run MCP server with stdio transport"""
    import asyncio
    server = MCPServer()
    asyncio.run(server.run_stdio())

def run_websocket(host="localhost", port=8765):
    """Run MCP server with WebSocket transport"""
    import asyncio
    server = MCPServer()
    asyncio.run(server.run_websocket(host, port))