"""
Unified API Server for MCP Self-Healing Test Framework
Consolidates all services into a single FastAPI application:
- Policy Engine (from mcp-server)
- AI Service (element suggestions)
- Healing API (healing data collection)
- SQL Backend (database operations)
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from pathlib import Path
from dotenv import load_dotenv
import time

# Performance monitoring
from performance_profiler import get_global_profiler, track_performance

# Load environment variables from .env file
load_dotenv()

# Import all API modules
from api.policy_engine import router as policy_router
from api.page_context import router as page_context_router
from api.ai_service import router as ai_router  # Enterprise AI service (consolidated)
from api.healing_api import router as healing_router
from api.selector_generation_api import router as selector_router
from api.execution_dashboard_api import router as execution_dashboard_router
from api.prompts_api import router as prompts_router
from api.sql_backend import router as sql_router
from api.test_execution import router as test_execution_router
from api.bindings_api import router as bindings_router
from api.auth_api import auth_router
from api.health import router as health_router
from core.database import get_database_manager, close_database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize global profiler
profiler = get_global_profiler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    logger.info(" Starting Unified MCP API Server")
    
    # Start performance monitoring
    profiler.capture_snapshot("Server_Startup")
    profiler.start_continuous_monitoring(interval_seconds=10.0)
    
    # Initialize database connection
    try:
        logger.info("🔌 Initializing database connection...")
        await get_database_manager()
        logger.info(" Database connection initialized")
    except Exception as e:
        logger.warning(f" Database initialization failed: {e}")
        logger.info("📝 Continuing with mock data fallback")
    
    profiler.capture_snapshot("Server_Ready")
    logger.info(" Unified API Server ready")
    
    yield
    
    # Cleanup
    logger.info("🛑 Shutting down Unified MCP API Server")
    
    # Stop performance monitoring and generate report
    profiler.stop_continuous_monitoring()
    profiler.capture_snapshot("Server_Shutdown")
    
    # Generate final performance report
    logger.info(" Generating final performance report...")
    profiler.print_detailed_report()
    
    try:
        await close_database()
        logger.info("🔌 Database connection closed")
    except Exception as e:
        logger.warning(f" Database cleanup warning: {e}")
    logger.info(" Cleanup completed")

# Create FastAPI application
app = FastAPI(
    title="Unified MCP API Server",
    description="Consolidated API for MCP Self-Healing Test Framework",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add performance monitoring middleware
@app.middleware("http")
async def performance_monitoring_middleware(request: Request, call_next):
    """Middleware to track performance metrics for each request"""
    start_time = time.time()
    
    # Track memory before request
    import psutil
    memory_before = psutil.Process().memory_info().rss
    
    try:
        # Process request
        response = await call_next(request)
        
        # Calculate metrics
        process_time = time.time() - start_time
        memory_after = psutil.Process().memory_info().rss
        memory_used = memory_after - memory_before
        
        # Track endpoint performance
        endpoint = f"{request.method} {request.url.path}"
        profiler.track_endpoint_performance(
            endpoint=endpoint,
            execution_time=process_time,
            error_occurred=response.status_code >= 400,
            memory_used=memory_used
        )
        
        # Add performance headers
        response.headers["X-Process-Time"] = str(process_time)
        response.headers["X-Memory-Used"] = str(memory_used)
        
        # Log slow requests
        if process_time > 1.0:  # Log requests taking more than 1 second
            logger.warning(f"🐌 Slow request: {endpoint} took {process_time:.2f}s")
        
        return response
        
    except Exception as e:
        # Track failed requests
        process_time = time.time() - start_time
        endpoint = f"{request.method} {request.url.path}"
        profiler.track_endpoint_performance(
            endpoint=endpoint,
            execution_time=process_time,
            error_occurred=True,
            memory_used=0
        )
        raise

# Add debugging middleware
@app.middleware("http")
async def debug_auth_middleware(request, call_next):
    """Debug middleware to log authentication details"""
    if request.url.path.startswith("/api/v1/prompts") and request.method == "POST":
        print(f" POST Request to: {request.url.path}")
        print(f" Headers: {dict(request.headers)}")
        auth_header = request.headers.get("authorization")
        print(f"🔑 Auth header present: {bool(auth_header)}")
        if auth_header:
            print(f"🔑 Auth header preview: {auth_header[:30]}...")
    
    response = await call_next(request)
    
    if request.url.path.startswith("/api/v1/prompts") and request.method == "POST":
        print(f"📤 Response status: {response.status_code}")
    
    return response

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

# Mount static files for serving uploaded screenshots
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include API routers
app.include_router(
    health_router,
    prefix="/health",
    tags=["Health Check"]
)

app.include_router(
    auth_router,
    tags=["Authentication"]
)

app.include_router(
    policy_router,
    prefix="/api/v1/policy",
    tags=["Policy Engine"]
)

app.include_router(
    page_context_router,
    prefix="/api/v1/page-context",
    tags=["Page Context"]
)

app.include_router(
    ai_router,
    prefix="/api/v1/ai",
    tags=["AI Service"]
)

app.include_router(
    healing_router,
    prefix="/api/v1/healing",
    tags=["Healing API"]
)

app.include_router(
    selector_router,
    prefix="/api/v1/selectors",
    tags=["Selector Generation API"]
)

app.include_router(
    execution_dashboard_router,
    prefix="/api/v1/dashboard/execution",
    tags=["Execution Dashboard API"]
)

app.include_router(
    prompts_router,
    prefix="/api/v1",
    tags=["Prompts API"]
)

app.include_router(
    sql_router,
    prefix="/api/v1/sql",
    tags=["SQL Backend"]
)

app.include_router(
    test_execution_router,
    prefix="/api/v1/execution",
    tags=["Test Execution"]
)

app.include_router(
    bindings_router,
    prefix="/api/v1",
    tags=["Data Bindings"]
)

# Performance monitoring endpoints
@app.get("/api/v1/performance/metrics")
async def get_performance_metrics():
    """Get current performance metrics"""
    try:
        report = profiler.generate_comprehensive_report()
        return {
            "status": "success",
            "data": report
        }
    except Exception as e:
        logger.error(f"Error generating performance metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/performance/memory")
async def get_memory_metrics():
    """Get detailed memory usage metrics"""
    try:
        memory_analysis = profiler.analyze_memory_usage()
        memory_allocations = profiler.get_top_memory_allocations()
        
        return {
            "status": "success",
            "data": {
                "memory_analysis": memory_analysis,
                "top_allocations": memory_allocations
            }
        }
    except Exception as e:
        logger.error(f"Error getting memory metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/performance/gc")
async def force_garbage_collection():
    """Force garbage collection and return impact analysis"""
    try:
        gc_result = profiler.force_garbage_collection()
        return {
            "status": "success",
            "data": gc_result
        }
    except Exception as e:
        logger.error(f"Error forcing garbage collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/performance/snapshot")
async def capture_performance_snapshot(label: str = "API_Request"):
    """Capture a performance snapshot"""
    try:
        snapshot = profiler.capture_snapshot(label)
        if snapshot:
            return {
                "status": "success",
                "data": {
                    "timestamp": snapshot.timestamp,
                    "label": snapshot.label,
                    "memory_mb": snapshot.memory_usage['rss'] / (1024 * 1024),
                    "cpu_percent": snapshot.cpu_percent,
                    "thread_count": snapshot.thread_count
                }
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to capture snapshot")
    except Exception as e:
        logger.error(f"Error capturing performance snapshot: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Add generated test plans endpoints at root for frontend compatibility
from api.prompts_api import get_test_plans_by_prompt, create_or_update_test_plan, get_db
from core.database import DatabaseManager
from typing import Dict, Any

@app.get("/generated-test-plans/by-prompt/{prompt_id}")
async def get_test_plans_by_prompt_root(prompt_id: str, db: DatabaseManager = Depends(get_db)):
    """Get test plans for a specific prompt - root level endpoint for frontend"""
    return await get_test_plans_by_prompt(prompt_id, db)

@app.post("/generated-test-plans")
async def create_test_plan_root(test_plan_data: Dict[str, Any], db: DatabaseManager = Depends(get_db)):
    """Create a test plan - root level endpoint for frontend"""
    return await create_or_update_test_plan(test_plan_data, db)

# Add the enterprise plan endpoint at the expected path
from api.ai_service import plan_endpoint
from fastapi import Header
from typing import Optional

@app.post("/api/v1/plan")
async def plan_endpoint_root(
    request: Dict[str, Any],
    if_none_match: Optional[str] = Header(None, alias="If-None-Match"),
    accept_encoding: Optional[str] = Header(None, alias="Accept-Encoding")
):
    """Enterprise plan endpoint - root level for frontend compatibility"""
    return await plan_endpoint(request, if_none_match, accept_encoding)

@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Unified MCP API Server",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "authentication": "/api/v1/auth",
            "policy_engine": "/api/v1/policy",
            "page_context": "/api/v1/page-context",
            "ai_service": "/api/v1/ai",
            "healing_api": "/api/v1/healing",
            "selector_generation": "/api/v1/selectors",
            "prompts_api": "/api/v1/prompts",
            "sql_backend": "/api/v1/sql",
            "test_execution": "/api/v1/execution"
        }
    }

@app.get("/api")
async def api_info():
    """API information endpoint"""
    return {
        "api_version": "v1",
        "services": [
            "Policy Engine - Governance and decision layer",
            "Page Context - AI assistance for understanding website types",
            "AI Service - Enterprise contract-based planning with cost optimization", 
            "Healing API - Test healing data collection",
            "Selector Generation API - AI-powered alternative selector generation",
            "SQL Backend - Database operations and queries"
        ],
        "documentation": "/docs"
    }

if __name__ == "__main__":
    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "true").lower() == "true"
    
    logger.info(f" Starting server on {host}:{port}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )