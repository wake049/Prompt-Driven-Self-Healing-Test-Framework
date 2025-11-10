#!/usr/bin/env python3
"""
MCP-Compliant Orchestration Layer for Self-Healing Test Framework

This implements a proper MCP server that bridges to existing FastAPI services
without duplicating business logic.
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Add only the MCP server directory to path for imports
# DO NOT add project root to avoid importing unrelated apps (like budgeting app)
mcp_server_root = Path(__file__).parent
sys.path.insert(0, str(mcp_server_root))

async def main():
    """Main entry point for the MCP server"""
    parser = argparse.ArgumentParser(description="MCP Server for Self-Healing Test Framework")
    parser.add_argument("--ws", action="store_true", help="Use WebSocket transport instead of stdio")
    parser.add_argument("--token", help="Override auth token")
    args = parser.parse_args()
    
    # Import here to avoid circular imports
    from mcp_server.server import MCPServer
    
    # Set auth token
    if args.token:
        os.environ["MCP_AUTH_TOKEN"] = args.token
    
    # Create and start server
    server = MCPServer()
    
    if args.ws:
        await server.run_websocket()
    else:
        await server.run_stdio()

if __name__ == "__main__":
    asyncio.run(main())