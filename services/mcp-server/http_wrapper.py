"""
HTTP wrapper for MCP server to make it ALB-compatible
"""
import asyncio
import json
import logging
import os
import time
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure logging FIRST - unbuffered output for Render logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

logger = logging.getLogger(__name__)

# Add the current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from mcp_server.server import MCPServer

# Global MCP server instance
mcp_server = None
startup_error = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown"""
    global mcp_server, startup_error
    # Startup
    try:
        logger.info("🚀 Initializing MCP Server...")
        mcp_server = MCPServer()
        logger.info("✅ MCP Server initialized successfully")
        startup_error = None
    except Exception as e:
        logger.error(f"❌ Failed to initialize MCP Server: {e}")
        startup_error = str(e)
        mcp_server = None
    
    yield
    
    # Shutdown
    try:
        if mcp_server and hasattr(mcp_server, 'unified_api_client'):
            await mcp_server.unified_api_client.aclose()
            logger.info("🔄 MCP Server shutdown complete")
    except Exception as e:
        logger.warning(f"⚠️ Error during shutdown: {e}")

app = FastAPI(title="MCP Server HTTP Wrapper", lifespan=lifespan)

# Add CORS middleware to handle cross-origin requests
_allowed_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/mcp/health")
async def mcp_health_check():
    """Health check endpoint specifically for MCP service"""
    try:
        health_data = {
            "status": "healthy",
            "timestamp": time.time(),
            "service": "MCP Server",
            "version": "1.0.0",
            "websocket_endpoint": "/mcp/ws"
        }
        
        # Check if MCP server is initialized
        if mcp_server is None:
            health_data.update({
                "status": "unhealthy",
                "error": "MCP server not initialized"
            })
            return JSONResponse(content=health_data, status_code=503)
        
        # Check unified API connection
        try:
            if hasattr(mcp_server, 'unified_api_client'):
                response = await mcp_server.unified_api_client.get("/health", timeout=5.0)
                if response.status_code == 200:
                    health_data["unified_api"] = "connected"
                else:
                    health_data["unified_api"] = f"error_code_{response.status_code}"
            else:
                health_data["unified_api"] = "client_not_available"
        except Exception as e:
            health_data["unified_api"] = f"connection_failed: {str(e)}"
        
        return health_data
        
    except Exception as e:
        return JSONResponse(
            content={
                "status": "unhealthy",
                "timestamp": time.time(),
                "error": str(e),
                "websocket_endpoint": "/mcp/ws"
            },
            status_code=503
        )

@app.get("/health")
async def health_check():
    """Health check endpoint for ALB - simplified to avoid external dependencies"""
    try:
        health_data = {
            "status": "healthy",
            "timestamp": time.time(),
            "service": "MCP Server",
            "version": "1.0.0"
        }
        
        # Check if MCP server is initialized
        if mcp_server is None:
            health_data.update({
                "status": "unhealthy",
                "error": "MCP server not initialized"
            })
            if startup_error:
                health_data["startup_error"] = startup_error
            return JSONResponse(content=health_data, status_code=503)
        
        # Add basic server info without external calls
        health_data["server_initialized"] = True
        health_data["endpoints"] = ["/", "/health", "/ready", "/mcp/ws", "/mcp/health"]
        
        # Only check unified API if explicitly requested via query param
        # This avoids health check failures due to external dependencies
        
        return health_data
        
    except Exception as e:
        return JSONResponse(
            content={
                "status": "unhealthy",
                "timestamp": time.time(),
                "error": str(e)
            },
            status_code=503
        )

@app.get("/ready")
async def readiness_check():
    """Readiness check endpoint for Kubernetes/ECS"""
    if mcp_server is None:
        return JSONResponse(
            content={"status": "not_ready", "reason": "MCP server not initialized"},
            status_code=503
        )
    
    return {"status": "ready", "timestamp": time.time()}

@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check with external dependencies - for monitoring"""
    try:
        health_data = {
            "status": "healthy",
            "timestamp": time.time(),
            "service": "MCP Server",
            "version": "1.0.0"
        }
        
        # Check if MCP server is initialized
        if mcp_server is None:
            health_data.update({
                "status": "unhealthy",
                "error": "MCP server not initialized"
            })
            return JSONResponse(content=health_data, status_code=503)
        
        # Check unified API connection
        try:
            if hasattr(mcp_server, 'unified_api_client'):
                response = await mcp_server.unified_api_client.get("/health", timeout=5.0)
                if response.status_code == 200:
                    health_data["unified_api"] = "connected"
                else:
                    health_data["unified_api"] = f"error_code_{response.status_code}"
            else:
                health_data["unified_api"] = "client_not_available"
        except Exception as e:
            health_data["unified_api"] = f"connection_failed: {str(e)}"
        
        # Add server stats if available
        if hasattr(mcp_server, 'get_stats'):
            try:
                stats = mcp_server.get_stats()
                health_data["stats"] = {
                    "total_requests": stats.get("total_requests", 0),
                    "successful_requests": stats.get("successful_requests", 0),
                    "avg_latency_ms": stats.get("avg_latency_ms", 0)
                }
            except Exception as stats_err:
                logger.warning("Failed to read MCP stats during health check: %s", stats_err)
        
        return health_data
        
    except Exception as e:
        return JSONResponse(
            content={
                "status": "unhealthy",
                "timestamp": time.time(),
                "error": str(e)
            },
            status_code=503
        )

@app.get("/")
async def root():
    """Root endpoint"""
    return {"service": "MCP Server", "status": "running", "transport": "websocket", "path": "/mcp/*"}

@app.get("/mcp")
async def mcp_root():
    """MCP root endpoint"""
    return {"service": "MCP Server", "status": "running", "transport": "websocket", "endpoints": ["/mcp/ws", "/mcp/health"]}

MCP_AUTH_REQUIRED = os.getenv("MCP_AUTH_REQUIRED", "false").lower() == "true"
MCP_API_KEY = os.getenv("MCP_API_KEY", "")

@app.websocket("/mcp/ws")
async def mcp_websocket_endpoint(websocket: WebSocket):
    """MCP WebSocket endpoint matching frontend URL pattern"""
    logger.info(f"New WebSocket connection attempt to /mcp/ws from {websocket.client}")
    
    # Validate auth before accepting when auth is required
    if MCP_AUTH_REQUIRED and MCP_API_KEY:
        token = websocket.query_params.get("token", "")
        auth_header = websocket.headers.get("authorization", "")
        provided_key = token or (auth_header.removeprefix("Bearer ").strip() if auth_header else "")
        if not provided_key or provided_key != MCP_API_KEY:
            logger.warning(f"WebSocket auth failed from {websocket.client}")
            await websocket.close(code=4003, reason="Authentication required")
            return
    
    try:
        await websocket.accept()
        logger.info(f"WebSocket connection accepted for /mcp/ws")
        
        while True:
            # Receive message from client
            message = await websocket.receive_text()
            logger.debug(f"Received message: {message[:100]}...")
            
            # Process through MCP server
            if mcp_server is None:
                error_response = {
                    "jsonrpc": "2.0", 
                    "id": None, 
                    "error": {"code": -32000, "message": "MCP server not initialized"}
                }
                await websocket.send_text(json.dumps(error_response))
                continue
                
            response = await mcp_server.handle_message(message)
            logger.debug(f"Sending response: {response[:100]}...")
            
            # Send response back
            await websocket.send_text(response)
    except Exception as e:
        logger.error(f"WebSocket error in /mcp/ws: {e}")
        import traceback
        traceback.print_exc()
    finally:
        logger.info(f"WebSocket connection closed for /mcp/ws")
        try:
            await websocket.close()
        except Exception:
            pass

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for MCP communication"""
    logger.info(f"WebSocket connection attempt at /ws from {websocket.client}")
    await websocket.accept()
    
    try:
        while True:
            # Receive message from client
            message = await websocket.receive_text()
            
            # Process through MCP server
            response = await mcp_server.handle_message(message)
            
            # Send response back
            await websocket.send_text(response)
    except Exception as e:
        logger.error(f"WebSocket error at /ws: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

@app.websocket("/")
async def root_websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint at root path for ALB routing"""
    logger.info(f"WebSocket connection attempt at / from {websocket.client}")
    await websocket.accept()
    
    try:
        while True:
            # Receive message from client
            message = await websocket.receive_text()
            
            # Process through MCP server
            response = await mcp_server.handle_message(message)
            
            # Send response back
            await websocket.send_text(response)
    except Exception as e:
        logger.error(f"WebSocket error at /: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

@app.post("/mcp")
async def mcp_http_endpoint(request: dict):
    """HTTP endpoint for MCP requests (alternative to WebSocket)"""
    from mcp_server.auth import authenticate
    try:
        if not isinstance(request, dict):
            raise HTTPException(status_code=400, detail="Request body must be a JSON object")

        # Extract auth token from request
        auth_token = request.pop("auth_token", None)
        authenticate(auth_token)  # Raises MCPError if invalid

        message = json.dumps(request)
        response = await mcp_server.handle_message(message)
        return JSONResponse(content=json.loads(response))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    logger.info("🚀 Starting MCP Server on 0.0.0.0:8001")
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8001,
        log_level="info",
        access_log=True
    )