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
from fastapi.responses import JSONResponse
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
from api.ai_config_api import router as ai_config_router  # AI Configuration API
from api.ai_provider_api import router as ai_provider_router  # AI Provider Management API
from api.healing_api import router as healing_router
from api.selector_generation_api import router as selector_router
from api.execution_dashboard_api import router as execution_dashboard_router
from api.prompts_api import router as prompts_router
from api.sql_backend import router as sql_router
from api.test_execution import router as test_execution_router
from api.bindings_api import router as bindings_router
from api.auth_api import auth_router
from api.health import router as health_router
from api.analytics_api import router as analytics_router  # M8: Analytics API
from api.step_element_relationships_api import router as step_element_relationships_router  # Element-step relationships
from api.ai_recommendations_api import router as ai_recommendations_router  # AI-powered test failure recommendations
from api.organization_api import router as organization_router  # Onboarding: orgs & subscriptions
from api.team_api import router as team_router  # Team collaboration and member management
from api.billing_api import router as billing_router  # Stripe checkout and billing session endpoints
from api.licensing_api import router as licensing_router  # Self-host license issuance and validation
from api.collaborative_review_api import router as collaborative_review_router  # Collaborative review and versioning
from api.document_to_tests_api import router as document_to_tests_router  # Document-to-Test Scenario Generation
from api.api_test_data_api import router as api_test_data_router  # API Testing for Test Data Creation
from api.runner_api import router as runner_router  # Remote runner agent registration and polling
from core.database import get_database_manager, close_database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _env_list(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


DEBUG_HTTP_LOGS = os.getenv("DEBUG_HTTP_LOGS", "false").lower() == "true"

_is_prod = os.getenv("ENVIRONMENT", "").lower() in ("prod", "production")
if os.getenv("CORS_ALLOWED_ORIGINS"):
    CORS_ALLOWED_ORIGINS = _env_list("CORS_ALLOWED_ORIGINS", "")
elif _is_prod:
    # In production with no CORS config, allow same-origin only
    CORS_ALLOWED_ORIGINS = []
    logger.warning("CORS_ALLOWED_ORIGINS not set in production — defaulting to same-origin only")
else:
    CORS_ALLOWED_ORIGINS = [
        "http://localhost:3000", "http://localhost:5173",
        "http://127.0.0.1:3000", "http://127.0.0.1:5173",
    ]
CORS_ALLOW_CREDENTIALS = "*" not in CORS_ALLOWED_ORIGINS
TRUSTED_HOSTS = _env_list("TRUSTED_HOSTS", "localhost,127.0.0.1")

# Debug: Log router information
logger.info(f"Policy router routes: {len(policy_router.routes)}")
logger.info(f"Page context router routes: {len(page_context_router.routes)}")
for route in policy_router.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        logger.info(f"Policy route: {route.methods} {route.path}")
for route in page_context_router.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        logger.info(f"Page context route: {route.methods} {route.path}")

# Initialize global profiler
profiler = get_global_profiler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    
    # Debug: Log environment variables (non-sensitive only)
    logger.info("=== Environment Variables Debug ===")
    logger.info(f"DB_HOST: {os.getenv('DB_HOST', 'NOT SET')}")
    logger.info(f"DB_PORT: {os.getenv('DB_PORT', 'NOT SET')}")
    logger.info(f"DB_NAME: {os.getenv('DB_NAME', 'NOT SET')}")
    logger.info(f"DB_USER: {os.getenv('DB_USER', 'NOT SET')}")
    logger.info(f"DB_PASSWORD: {'SET' if os.getenv('DB_PASSWORD') else 'NOT SET'}")
    logger.info(f"OPENAI_API_KEY: {'SET' if os.getenv('OPENAI_API_KEY') else 'NOT SET'}")
    logger.info(f"OPENAI_MODEL: {os.getenv('OPENAI_MODEL', 'NOT SET')}")
    logger.info("===================================")
    
    # Start performance monitoring
    profiler.capture_snapshot("Server_Startup")
    profiler.start_continuous_monitoring(interval_seconds=10.0)
    await get_database_manager()
    
    # Start self-host license validator if configured
    from services.self_host_license_validator import start_license_validator
    start_license_validator()
    
    profiler.capture_snapshot("Server_Ready")
    
    yield
    
    # Stop self-host license validator
    from services.self_host_license_validator import stop_license_validator
    stop_license_validator()
    
    # Stop performance monitoring and generate report
    profiler.stop_continuous_monitoring()
    profiler.capture_snapshot("Server_Shutdown")
    
    profiler.print_detailed_report()
    await close_database()

# Create FastAPI application
app = FastAPI(
    title="Unified MCP API Server",
    description="Consolidated API for MCP Self-Healing Test Framework",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Add CORS middleware with explicit configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
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
async def debug_cors_middleware(request, call_next):
    """Debug middleware to log CORS details"""
    if not DEBUG_HTTP_LOGS:
        return await call_next(request)

    origin = request.headers.get("origin")
    method = request.method
    path = request.url.path
    
    if origin:
        logger.info(f"🌐 CORS Request: {method} {path} from origin: {origin}")
    
    if method == "OPTIONS":
        logger.info(f"✈️  Preflight request for {path}")
    
    response = await call_next(request)
    
    # Log CORS headers in response
    if origin:
        cors_headers = {k: v for k, v in response.headers.items() if 'access-control' in k.lower()}
        logger.info(f"📤 CORS Response headers: {cors_headers}")
    
    return response

@app.middleware("http")
async def debug_auth_middleware(request, call_next):
    """Debug middleware to log authentication details"""
    if not DEBUG_HTTP_LOGS:
        return await call_next(request)

    if request.url.path.startswith("/api/v1/prompts") and request.method == "POST":
        logger.info(f"POST Request to: {request.url.path}")
        auth_header = request.headers.get("authorization")
        logger.info(f"Auth header present: {bool(auth_header)}")
        if auth_header:
            logger.info(f"Auth header preview: {auth_header[:30]}...")
    
    response = await call_next(request)
    
    if request.url.path.startswith("/api/v1/prompts") and request.method == "POST":
        logger.info(f"Response status: {response.status_code}")
    
    return response

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=TRUSTED_HOSTS)

# Mount static files for serving uploaded screenshots
uploads_dir = Path("uploads")
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Mount screenshots directory - point to Java runner's screenshots directory
# This allows the API to serve screenshots created by the Java test runner
java_screenshots_dir = Path("../java-runner/screenshots")
if not java_screenshots_dir.exists():
    # Fallback to local directory if Java runner not found
    java_screenshots_dir = Path("screenshots")
    java_screenshots_dir.mkdir(exist_ok=True)
app.mount("/screenshots", StaticFiles(directory=str(java_screenshots_dir)), name="screenshots")

# Global exception handler — returns structured JSON instead of raw 500s
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again later."},
    )

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
    organization_router,
    tags=["Organizations"]
)

app.include_router(
    billing_router,
    tags=["Billing"]
)

app.include_router(
    licensing_router,
    tags=["Licensing"]
)

app.include_router(
    team_router,
    tags=["Team Collaboration"]
)

app.include_router(
    collaborative_review_router,
    tags=["Collaborative Review"]
)

app.include_router(
    ai_router,
    prefix="/api/v1/ai",
    tags=["AI Service"]
)

app.include_router(
    ai_config_router,
    prefix="/api/v1/ai-config",
    tags=["AI Configuration"]
)

app.include_router(
    ai_provider_router,
    prefix="/api/ai-providers",
    tags=["AI Provider Management"]
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

# Add execution dashboard router at the expected frontend path
app.include_router(
    execution_dashboard_router,
    prefix="/api/execution-dashboard",
    tags=["Execution Dashboard API - Frontend Compatible"]
)

# Add AI service route for recent failed executions at the expected path
from api.ai_service import get_recent_failed_executions_for_analysis
from api.prompts_api import get_db  # Import get_db function
from core.database import DatabaseManager  # Import DatabaseManager

@app.get("/api/execution-dashboard/recent")
async def execution_dashboard_recent_failed(
    prompt_id: str,
    limit: int = 10,
    status: str = "failed",
    db: DatabaseManager = Depends(get_db)
):
    """Get recent failed executions for AI analysis - delegated to AI service"""
    return await get_recent_failed_executions_for_analysis(prompt_id, limit, db)

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

# M8: Analytics API for dashboard components
app.include_router(
    analytics_router,
    prefix="/api/analytics",
    tags=["Analytics Dashboard"]
)

# Step-Element Relationships API for runtime selector resolution
app.include_router(
    step_element_relationships_router,
    prefix="/api/v1",
    tags=["Step-Element Relationships"]
)

# AI Recommendations API for test failure analysis
app.include_router(
    ai_recommendations_router,
    tags=["AI Recommendations"]
)

# Test Suites API
from api import test_suites as test_suites_router
app.include_router(
    test_suites_router.router,
    prefix="/api/v1/test-suites",
    tags=["test-suites"]
)

# Document-to-Test Scenario Generation API
app.include_router(
    document_to_tests_router,
    prefix="/api/v1/document-to-tests",
    tags=["Document to Tests"]
)

# API Test Data API - Create precondition data via APIs for UI tests
app.include_router(
    api_test_data_router,
    prefix="/api/v1/test-data",
    tags=["API Test Data"]
)

# Runner Agent API - Remote runner registration, polling, and heartbeat
app.include_router(
    runner_router,
    prefix="/api/v1/runners",
    tags=["Runner Agents"]
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
        raise HTTPException(status_code=500, detail=str(e))

# Add generated test plans endpoints at root for frontend compatibility
from api.prompts_api import get_test_plans_by_prompt, create_or_update_test_plan, get_db
from core.database import DatabaseManager
from typing import Dict, Any
from core.auth import get_current_active_user
from models.auth_models import CurrentUser

@app.get("/generated-test-plans/by-prompt/{prompt_id}")
@app.get("/api/v1/generated-test-plans/by-prompt/{prompt_id}")
async def get_test_plans_by_prompt_root(prompt_id: str, db: DatabaseManager = Depends(get_db)):
    """Get test plans for a specific prompt - root level endpoint for frontend"""
    return await get_test_plans_by_prompt(prompt_id, db)

@app.get("/generated-test-plans")
@app.get("/api/v1/generated-test-plans")
async def get_test_plans_root(
    limit: int = 1000,
    latest_per_prompt: bool = True,
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user),
):
    """Get generated test plans for current project in a single request."""
    try:
        if not current_user.project or not current_user.project.id:
            return {"plans": [], "total": 0}

        project_id = current_user.project.id

        if latest_per_prompt:
            rows = await db.fetch(
                """
                SELECT DISTINCT ON (pl.prompt_id)
                    pl.id,
                    pl.prompt_id,
                    pl.plan_json,
                    pl.confidence_score,
                    pl.model_used,
                    pl.generation_time_ms,
                    pl.status,
                    pl.approved_by,
                    pl.approved_at,
                    pl.created_at,
                    pl.updated_at,
                    split_part(COALESCE(p.text, ''), E'\\n', 1) AS prompt_title
                FROM planner.plans pl
                JOIN planner.prompts p ON p.id = pl.prompt_id
                WHERE p.project_id = $1
                ORDER BY pl.prompt_id, pl.created_at DESC
                LIMIT $2
                """,
                project_id,
                limit,
            )
        else:
            rows = await db.fetch(
                """
                SELECT
                    pl.id,
                    pl.prompt_id,
                    pl.plan_json,
                    pl.confidence_score,
                    pl.model_used,
                    pl.generation_time_ms,
                    pl.status,
                    pl.approved_by,
                    pl.approved_at,
                    pl.created_at,
                    pl.updated_at,
                    split_part(COALESCE(p.text, ''), E'\\n', 1) AS prompt_title
                FROM planner.plans pl
                JOIN planner.prompts p ON p.id = pl.prompt_id
                WHERE p.project_id = $1
                ORDER BY pl.created_at DESC
                LIMIT $2
                """,
                project_id,
                limit,
            )

        plans = []
        for row in rows:
            plans.append(
                {
                    "id": str(row["id"]),
                    "prompt_id": str(row["prompt_id"]),
                    "prompt_title": row.get("prompt_title") or "",
                    "plan_json": row.get("plan_json"),
                    "confidence_score": float(row["confidence_score"]) if row.get("confidence_score") is not None else None,
                    "model_used": row.get("model_used"),
                    "generation_time_ms": row.get("generation_time_ms"),
                    "status": row.get("status") or "draft",
                    "approved_by": str(row["approved_by"]) if row.get("approved_by") else None,
                    "approved_at": row["approved_at"].isoformat().replace('+00:00', 'Z') if row.get("approved_at") else None,
                    "created_at": row["created_at"].isoformat().replace('+00:00', 'Z') if row.get("created_at") else None,
                    "updated_at": row["updated_at"].isoformat().replace('+00:00', 'Z') if row.get("updated_at") else None,
                }
            )

        return {"plans": plans, "total": len(plans)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching test plans: {str(e)}")

@app.post("/generated-test-plans")
@app.post("/api/v1/generated-test-plans")
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
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )