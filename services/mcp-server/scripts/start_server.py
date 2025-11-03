#!/usr/bin/env python3
"""
MCP Server Startup Script

Provides easy commands to start the MCP server in different modes
"""

import argparse
import asyncio
import os
import sys
import logging
from pathlib import Path

# Add the parent directory to Python path for package import
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
sys.path.insert(0, str(parent_dir))

def setup_logging(level: str = "INFO"):
    """Setup logging configuration"""
    log_level = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('mcp_server.log')
        ]
    )


async def start_stdio_server():
    """Start MCP server with stdio transport"""
    from mcp_server import MCPServer
    
    print("🚀 Starting MCP server with stdio transport...")
    server = MCPServer()
    await server.run_stdio()


async def start_websocket_server(host: str = "localhost", port: int = 8765):
    """Start MCP server with WebSocket transport"""
    from mcp_server import MCPServer
    
    print(f"🚀 Starting MCP server with WebSocket transport on {host}:{port}...")
    server = MCPServer()
    await server.run_websocket(host, port)


async def start_dual_server(host: str = "localhost", port: int = 8765):
    """Start MCP server with both transports"""
    from mcp_server import MCPServer
    
    print("🚀 Starting MCP server with dual transport (stdio + WebSocket)...")
    server = MCPServer()
    
    # Start both transports concurrently
    stdio_task = asyncio.create_task(server.run_stdio())
    websocket_task = asyncio.create_task(server.run_websocket(host, port))
    
    try:
        await asyncio.gather(stdio_task, websocket_task)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down server...")
        stdio_task.cancel()
        websocket_task.cancel()


def check_dependencies():
    """Check if all dependencies are installed"""
    try:
        import mcp
        import pydantic
        import httpx
        import websockets
        print("✅ All dependencies installed")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Run: pip install -r requirements.txt")
        return False


def check_unified_api():
    """Check if unified API is running"""
    import httpx
    import asyncio
    
    async def check():
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get("http://localhost:8000/health", timeout=5.0)
                if response.status_code == 200:
                    print("✅ Unified API is running")
                    return True
        except Exception:
            pass
        
        print("⚠️  Unified API not detected at localhost:8000")
        print("   MCP server will work but may return mock data")
        return False
    
    return asyncio.run(check())


def main():
    """Main startup function"""
    parser = argparse.ArgumentParser(description="MCP Server Startup")
    parser.add_argument("--transport", choices=["stdio", "websocket", "dual"], 
                       default="stdio", help="Transport type")
    parser.add_argument("--host", default="localhost", help="WebSocket host")
    parser.add_argument("--port", type=int, default=8765, help="WebSocket port")
    parser.add_argument("--log-level", default="INFO", 
                       choices=["DEBUG", "INFO", "WARNING", "ERROR"],
                       help="Logging level")
    parser.add_argument("--check-deps", action="store_true", 
                       help="Check dependencies and exit")
    parser.add_argument("--check-api", action="store_true",
                       help="Check unified API and exit")
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging(args.log_level)
    
    # Check dependencies
    if args.check_deps:
        check_dependencies()
        return
    
    # Check API
    if args.check_api:
        check_unified_api()
        return
    
    # Verify dependencies before starting
    if not check_dependencies():
        sys.exit(1)
    
    # Check unified API (non-blocking)
    check_unified_api()
    
    # Set auth token if not provided
    if not os.getenv("MCP_AUTH_TOKEN"):
        os.environ["MCP_AUTH_TOKEN"] = "devtoken"
        print("🔑 Using default auth token: devtoken")
    
    print(f"📋 Starting with transport: {args.transport}")
    print(f"📋 Log level: {args.log_level}")
    
    try:
        if args.transport == "stdio":
            asyncio.run(start_stdio_server())
        elif args.transport == "websocket":
            asyncio.run(start_websocket_server(args.host, args.port))
        elif args.transport == "dual":
            asyncio.run(start_dual_server(args.host, args.port))
    
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"💥 Server failed to start: {e}")
        logging.exception("Server startup failed")
        sys.exit(1)


if __name__ == "__main__":
    main()