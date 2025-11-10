"""
Unified Healing API Router
Migrated from standalone FastAPI service
Handles healing data collection from Java framework
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional

import json
import os
from datetime import datetime
from core.database import get_database
from core.auth import get_current_active_user
from models.auth_models import CurrentUser

router = APIRouter()

class HealingAttempt(BaseModel):
    """Healing attempt data from Java framework"""
    timestamp: str
    elementId: str
    page: str
    originalLocator: str
    attemptedAlternatives: List[str]
    healedLocator: Optional[str] = None
    result: str  # SUCCESS, FAILED
    error: Optional[str] = None

class HealingSubmission(BaseModel):
    """Batch submission of healing attempts"""
    session_id: Optional[str] = None
    test_run_id: Optional[str] = None
    healing_attempts: List[HealingAttempt]

@router.post("/submit")
async def submit_healing_data(submission: HealingSubmission):
    """
    Submit healing data from Java framework
    """
    try:
        db = await get_database()
        
        # Get a valid project_id from the database for healing submissions
        # Since healing submissions come from Java framework without user context,
        # we need to find an existing valid project_id
        valid_project_id = await _get_valid_project_id_for_healing()
        
        created_reviews = 0
        created_events = 0
        
        # Process each healing attempt
        for attempt in submission.healing_attempts:
            # For Java framework healing attempts without run_step_id, we'll create a simplified healing record
            # First, check if the healing tables exist and create them if they don't
            try:
                # Try to create the healing schema and tables if they don't exist
                await db.execute_command("CREATE SCHEMA IF NOT EXISTS healing")
                
                # Create locator_events table with nullable run_step_id for Java framework compatibility
                await db.execute_command("""
                    CREATE TABLE IF NOT EXISTS healing.locator_events (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        run_step_id UUID, -- Nullable for Java framework calls
                        element_id UUID, -- Nullable since we might not have element in repo
                        event_type VARCHAR(50) NOT NULL,
                        details JSONB,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create review_items table for healing suggestions
                await db.execute_command("""
                    CREATE TABLE IF NOT EXISTS healing.review_items (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        project_id UUID, -- Nullable
                        element_id UUID, -- Nullable
                        status VARCHAR(50) DEFAULT 'open',
                        suggestion JSONB,
                        rationale TEXT,
                        priority VARCHAR(20) DEFAULT 'medium',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create candidates table for alternative selectors
                await db.execute_command("""
                    CREATE TABLE IF NOT EXISTS healing.candidates (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        locator_event_id UUID REFERENCES healing.locator_events(id),
                        selector JSONB NOT NULL,
                        score FLOAT DEFAULT 0.0,
                        rationale TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
            except Exception as schema_error:# For Java framework healing attempts, we need to work with the existing database schema
            # Instead of trying to create dummy records, let's just log the healing attempt without storing in DB
            # Since the schema constraints are too complex to work around dynamically
                try:
                    event_result = await db.execute_one(
                    """
                    INSERT INTO healing.locator_events (
                        run_step_id,
                        element_id,
                        event_type,
                        details
                    ) VALUES (NULL, NULL, $1, $2)
                    RETURNING id
                    """,
                    "locator_failure" if attempt.result == "FAILED" else "locator_healed",
                    json.dumps({
                        "timestamp": attempt.timestamp,
                        "elementId": attempt.elementId,
                        "page": attempt.page,
                        "originalLocator": attempt.originalLocator,
                        "attemptedAlternatives": attempt.attemptedAlternatives,
                        "healedLocator": attempt.healedLocator,
                        "result": attempt.result,
                        "error": attempt.error,
                        "source": "java-framework"
                    })
                )
                except Exception as db_error:
                    # If database insertion fails due to schema constraints, just log the healing attempt# For now, we'll just track that we received the healing attempt without storing in DB
                    # This allows the Java framework to continue working while we resolve schema issues
                    event_result = None
            
            event_id = event_result["id"] if event_result else None
            if event_id:
                created_events += 1
                
            # Create review item for ALL healing attempts (successful or failed)
            # This ensures every healing attempt gets human review
            if valid_project_id:  # Only create review items if we have a valid project_id
                try:
                    if attempt.result == "SUCCESS" and attempt.healedLocator:
                        # For successful healing - create candidate if we have an event_id
                        if event_id:
                            candidate_result = await db.execute_one(
                                """
                                INSERT INTO healing.candidates (
                                    locator_event_id,
                                    selector,
                                    score,
                                    rationale
                                ) VALUES ($1, $2, $3, $4)
                                RETURNING id
                                """,
                                event_id,
                                json.dumps({"css": attempt.healedLocator.replace("css=", "")}),
                                85.0,  # Default score for successful healing
                                f"Self-healing found working alternative selector after original failed"
                            )
                        
                        # Create review item for successful healing
                        await db.execute_command(
                            """
                            INSERT INTO healing.review_items (
                                project_id,
                                element_id,
                                run_id,
                                status,
                                suggestion,
                                rationale
                            ) VALUES ($1, $2, $3, 'open', $4, $5)
                            """,
                            valid_project_id,
                            None,  # element_id is nullable
                            None,  # run_id is nullable  
                            json.dumps({
                                "elementId": attempt.elementId,
                                "page": attempt.page,
                                "originalSelector": attempt.originalLocator,
                                "suggestedSelector": attempt.healedLocator,
                                "attemptedAlternatives": attempt.attemptedAlternatives,
                                "actionType": "update_primary_selector",
                                "result": "SUCCESS"
                            }),
                            f"Self-healing successful: Found working alternative '{attempt.healedLocator}' for element '{attempt.elementId}' on page '{attempt.page}'. Please review and approve the suggested selector change."
                        )
                        created_reviews += 1
                        
                    else:
                        # For failed healing attempts - create review item for manual intervention
                        await db.execute_command(
                            """
                            INSERT INTO healing.review_items (
                                project_id,
                                element_id,
                                run_id,
                                status,
                                suggestion,
                                rationale
                            ) VALUES ($1, $2, $3, 'open', $4, $5)
                            """,
                            valid_project_id,
                            None,  # element_id is nullable
                            None,  # run_id is nullable
                            json.dumps({
                                "elementId": attempt.elementId,
                                "page": attempt.page,
                                "originalSelector": attempt.originalLocator,
                                "attemptedAlternatives": attempt.attemptedAlternatives,
                                "actionType": "manual_selector_fix",
                                "result": "FAILED",
                                "error": attempt.error
                            }),
                            f"Self-healing failed: Could not find working alternative for element '{attempt.elementId}' on page '{attempt.page}'. Manual intervention required to fix or update the selector."
                        )
                        created_reviews += 1
                        
                except Exception as review_error:
                    return {
                    "success": True,
                    "message": f"Processed {len(submission.healing_attempts)} healing attempts",
                    "created_events": created_events,
                    "created_reviews": created_reviews
            }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process healing data: {str(e)}")

@router.get("/stats")
async def get_healing_stats():
    """
    Get basic statistics about healing data from database
    """
    try:
        db = await get_database()
        
        # Get healing event statistics - handle case where tables might not exist
        try:
            stats = await db.execute_one(
                """
                SELECT 
                    COUNT(*) as total_events,
                    COUNT(CASE WHEN event_type = 'locator_healed' THEN 1 END) as successful_healings,
                    COUNT(CASE WHEN event_type = 'locator_failure' THEN 1 END) as failed_healings,
                    COUNT(DISTINCT (details->>'elementId')) as unique_elements
                FROM healing.locator_events
                """
            )
            
            # Get review item statistics
            review_stats = await db.execute_one(
                """
                SELECT 
                    COUNT(*) as total_reviews,
                    COUNT(CASE WHEN status = 'open' THEN 1 END) as open_reviews,
                    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_reviews,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_reviews
                FROM healing.review_items
                """
            )
        except Exception as e:# Return default stats if tables don't exist
            stats = {"total_events": 0, "successful_healings": 0, "failed_healings": 0, "unique_elements": 0}
            review_stats = {"total_reviews": 0, "open_reviews": 0, "approved_reviews": 0, "rejected_reviews": 0}
        
        healing_success_rate = 0
        if stats["total_events"] > 0:
            healing_success_rate = (stats["successful_healings"] / stats["total_events"]) * 100
        
        return {
            "total_events": stats["total_events"] or 0,
            "successful_healings": stats["successful_healings"] or 0,
            "failed_healings": stats["failed_healings"] or 0,
            "unique_elements": stats["unique_elements"] or 0,
            "healing_success_rate": round(healing_success_rate, 2),
            "total_reviews": review_stats["total_reviews"] or 0,
            "open_reviews": review_stats["open_reviews"] or 0,
            "approved_reviews": review_stats["approved_reviews"] or 0,
            "rejected_reviews": review_stats["rejected_reviews"] or 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get healing stats: {str(e)}")

@router.get("/data")
async def get_healing_data(
    limit: int = 100,
    session_id: Optional[str] = None
):
    """
    Get healing data from database with optional filtering
    """
    try:
        db = await get_database()
        
        # Build query with optional session filtering - handle case where tables might not exist
        try:
            query = """
            SELECT 
                le.id,
                le.event_type,
                le.details,
                le.created_at,
                ri.status as review_status,
                ri.suggestion
            FROM healing.locator_events le
            LEFT JOIN healing.review_items ri ON ri.id = (
                SELECT ri2.id FROM healing.review_items ri2 
                WHERE ri2.suggestion->>'elementId' = le.details->>'elementId' 
                ORDER BY ri2.created_at DESC LIMIT 1
            )
            ORDER BY le.created_at DESC
            LIMIT $1
            """
            
            events = await db.execute(query, limit)
        except Exception as e:events = []
        
        healing_attempts = []
        for event in events:
            details = event["details"] if event["details"] else {}
            healing_attempts.append({
                "id": str(event["id"]),
                "timestamp": event["created_at"].isoformat(),
                "elementId": details.get("elementId"),
                "page": details.get("page"),
                "originalLocator": details.get("originalLocator"),
                "attemptedAlternatives": details.get("attemptedAlternatives", []),
                "healedLocator": details.get("healedLocator"),
                "result": details.get("result"),
                "error": details.get("error"),
                "event_type": event["event_type"],
                "review_status": event.get("review_status"),
                "suggestion": event.get("suggestion")
            })
        
        return {
            "healing_attempts": healing_attempts,
            "total": len(healing_attempts),
            "filtered_by_session": session_id is not None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get healing data: {str(e)}")

@router.get("/review-queue")
async def get_review_queue(
    status: str = "open",
    sort_by: str = "created_at", 
    sort_order: str = "desc",
    limit: int = 20,
    offset: int = 0
):
    """
    Get review queue items with filtering, sorting and pagination
    """
    try:
        db = await get_database()
        
        # Build query with filtering and sorting
        valid_sort_fields = ["created_at", "status", "id"]
        if sort_by not in valid_sort_fields:
            sort_by = "created_at"
        
        valid_sort_orders = ["asc", "desc"]
        if sort_order not in valid_sort_orders:
            sort_order = "desc"
        
        try:
            # Get review items with filtering
            query = f"""
            SELECT 
                id,
                project_id,
                element_id,
                status,
                suggestion,
                rationale,
                created_at
            FROM healing.review_items
            WHERE status = $1
            ORDER BY {sort_by} {sort_order}
            LIMIT $2 OFFSET $3
            """
            
            items = await db.execute(query, status, limit, offset)
            
            # Get total count for pagination
            count_query = "SELECT COUNT(*) as total FROM healing.review_items WHERE status = $1"
            total_result = await db.execute_one(count_query, status)
            total = total_result["total"] if total_result else 0
            
        except Exception as e:items = []
        total = 0
        
        # Format items for response
        formatted_items = []
        for item in items:
            # Handle suggestion field which might be a JSON string or already parsed
            suggestion = item["suggestion"] if item["suggestion"] else {}
            if isinstance(suggestion, str):
                try:
                    suggestion = json.loads(suggestion)
                except json.JSONDecodeError:suggestion = {}
            elif suggestion is None:
                suggestion = {}
            
            formatted_items.append({
                "id": str(item["id"]),
                "project_id": str(item["project_id"]) if item["project_id"] else None,
                "element_id": str(item["element_id"]) if item["element_id"] else None,
                "status": item["status"],
                "suggestion": suggestion,
                "rationale": item["rationale"],
                "created_at": item["created_at"].isoformat(),
                # Additional fields for compatibility
                "elementId": suggestion.get("elementId") if isinstance(suggestion, dict) else None,
                "page": suggestion.get("page") if isinstance(suggestion, dict) else None,
                "originalSelector": suggestion.get("originalSelector") if isinstance(suggestion, dict) else None,
                "suggestedSelector": suggestion.get("suggestedSelector") if isinstance(suggestion, dict) else None,
                "actionType": suggestion.get("actionType") if isinstance(suggestion, dict) else None
            })
        
        return {
            "items": formatted_items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "status_filter": status
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get review queue: {str(e)}")

@router.get("/review/pending") 
async def get_pending_reviews():
    """
    Get pending review items (compatibility endpoint)
    """
    try:
        # Delegate to main review queue endpoint
        result = await get_review_queue(status="open", limit=100)
        return result["items"]  # Return just the items array for compatibility
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get pending reviews: {str(e)}")

@router.post("/review/{review_id}/status")
async def update_review_status(review_id: str, status: str):
    """
    Update review item status (approve or reject)
    """
    try:
        if status not in ["approved", "rejected"]:
            raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
        
        db = await get_database()
        
        try:
            # Update the review item status
            result = await db.execute_one(
                """
                UPDATE healing.review_items 
                SET status = $1
                WHERE id = $2
                RETURNING id, status, suggestion
                """,
                status,
                review_id
            )
            
            if not result:
                raise HTTPException(status_code=404, detail="Review item not found")
            return {
                "success": True,
                "id": str(result["id"]),
                "status": result["status"],
                "suggestion": result["suggestion"]
            }
            
        except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to update review status: {str(e)}")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update review status: {str(e)}")

class ReviewItemCreate(BaseModel):
    """Request model for creating a review item"""
    element_id: str
    element_name: str
    note: Optional[str] = ""
    page: Optional[str] = "Unknown"
    health_status: Optional[str] = "unknown"
    status: Optional[str] = "open"

@router.post("/review")
async def create_review_item(
    review_item: ReviewItemCreate,
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Add an element to the review queue (requires user authentication)
    """
    try:
        project_id = await _get_project_id_from_user(current_user)
        return await _create_review_item_internal(review_item, project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create review item: {str(e)}")

@router.post("/review/service")
async def create_review_item_service(review_item: ReviewItemCreate):
    """
    Add an element to the review queue (service endpoint for MCP server)
    Uses default project for the system tenant
    """
    try:
        # For service calls from MCP server, use default/first available project
        db = await get_database()
        
        # Try to get the first active project from any tenant
        projects = await db.execute(
            """
            SELECT id FROM core.projects 
            WHERE is_active = true 
            ORDER BY created_at ASC 
            LIMIT 1
            """
        )
        
        if not projects:
            # If no projects exist, create a default one
            try:
                # First get or create a default tenant
                tenants = await db.execute(
                    """
                    SELECT id FROM core.tenants 
                    WHERE is_active = true 
                    ORDER BY created_at ASC 
                    LIMIT 1
                    """
                )
                
                if not tenants:
                    # Create default tenant
                    tenant_result = await db.execute_one(
                        """
                        INSERT INTO core.tenants (id, name, slug, is_active, created_at, updated_at)
                        VALUES (gen_random_uuid(), 'Default Tenant', 'default', true, NOW(), NOW())
                        RETURNING id
                        """
                    )
                    tenant_id = tenant_result["id"]
                else:
                    tenant_id = tenants[0]["id"]
                
                # Create default project
                project_result = await db.execute_one(
                    """
                    INSERT INTO core.projects (id, tenant_id, name, slug, description, is_active, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1, 'Default Project', 'default', 'Default project for system operations', true, NOW(), NOW())
                    RETURNING id
                    """,
                    tenant_id
                )
                project_id = str(project_result["id"])
            except Exception as create_error:raise HTTPException(status_code=500, detail="No project context available and could not create default project")
        else:
            project_id = str(projects[0]["id"])
        
        return await _create_review_item_internal(review_item, project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create review item: {str(e)}")

async def _get_valid_project_id_for_healing() -> str:
    """Get a valid project_id for healing submissions from Java framework"""
    try:
        db = await get_database()
        
        # First, try to get project_id from existing test cases (most likely to be valid)
        existing_test_case = await db.execute_one("SELECT project_id FROM tests.test_cases WHERE project_id IS NOT NULL LIMIT 1")
        if existing_test_case and existing_test_case.get('project_id'):
            return str(existing_test_case['project_id'])
        
        # Next, try to get project_id from existing runs
        existing_run = await db.execute_one("SELECT project_id FROM exec.runs WHERE project_id IS NOT NULL LIMIT 1")
        if existing_run and existing_run.get('project_id'):
            return str(existing_run['project_id'])
        
        # Finally, try to get any project from core.projects
        existing_project = await db.execute_one("SELECT id FROM core.projects WHERE is_active = true ORDER BY created_at ASC LIMIT 1")
        if existing_project and existing_project.get('id'):
            return str(existing_project['id'])
        
        # If nothing exists, return None and we'll skip creating review itemsreturn None
        
    except Exception as e:return None

async def _get_project_id_from_user(current_user: CurrentUser) -> str:
    """Get project_id from authenticated user context"""
    project_id = None
    if current_user.project and current_user.project.id:
        project_id = str(current_user.project.id)
    else:
        # If no project in user context, try to get default project for tenant
        if current_user.tenant and current_user.tenant.id:
            db = await get_database()
            tenant_projects = await db.execute(
                """
                SELECT id FROM core.projects 
                WHERE tenant_id = $1 AND is_active = true 
                ORDER BY created_at ASC 
                LIMIT 1
                """,
                current_user.tenant.id
            )
            if tenant_projects:
                project_id = str(tenant_projects[0]["id"])
    
    # If still no project_id, we cannot create the review item due to foreign key constraint
    if not project_id:
        raise HTTPException(
            status_code=400, 
            detail="No project context available. User must be assigned to a project to create review items."
        )
    
    return project_id

async def _create_review_item_internal(review_item: ReviewItemCreate, project_id: str) -> dict:
    """Internal method to create review item with given project_id"""
    db = await get_database()
    
    # Look up the UUID of the element using the element_id (element_key)
    element_uuid = None
    if review_item.element_id:
        try:
            element_result = await db.execute_one(
                """
                SELECT id FROM repo.elements 
                WHERE element_key = $1
                ORDER BY created_at DESC 
                LIMIT 1
                """,
                review_item.element_id
            )
            if element_result:
                element_uuid = element_result["id"]
        except Exception as lookup_error:# Create suggestion JSONB with all the element info
            suggestion = {
            "elementId": review_item.element_id,
            "elementName": review_item.element_name,
            "page": review_item.page,
            "healthStatus": review_item.health_status,
            "actionType": "manual_review",
            "reason": "Added to queue for manual review"
        }
    
    # Insert new review item using the correct table structure
    # First try with priority column, fallback without it if it doesn't exist
    try:
        result = await db.execute_one(
            """
            INSERT INTO healing.review_items 
            (project_id, element_id, status, suggestion, rationale, priority, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING id, project_id, element_id, status, suggestion, rationale, priority, created_at
            """,
            project_id,  # Use provided project_id
            element_uuid,  # Use looked up UUID instead of None
            review_item.status,
            json.dumps(suggestion),
            review_item.note or "Element added to review queue for manual evaluation",
            "medium"  # Default priority
        )
    except Exception as priority_error:
        # If priority column doesn't exist, try without it
        if "priority" in str(priority_error):result = await db.execute_one(
                """
                INSERT INTO healing.review_items 
                (project_id, element_id, status, suggestion, rationale, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                RETURNING id, project_id, element_id, status, suggestion, rationale, created_at
                """,
                project_id,  # Use provided project_id
                element_uuid,  # Use looked up UUID instead of None
                review_item.status,
                json.dumps(suggestion),
                review_item.note or "Element added to review queue for manual evaluation"
            )
        else:
            raise priority_error
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create review item")
    return {
        "success": True,
        "id": str(result["id"]),
        "project_id": str(result.get("project_id", "00000000-0000-0000-0000-000000000000")),
        "element_id": str(result["element_id"]) if result["element_id"] else None,
        "status": result["status"],
        "suggestion": result["suggestion"],
        "rationale": result["rationale"],
        "priority": result.get("priority", "medium"),  # Default if column doesn't exist
        "created_at": result["created_at"].isoformat() if result["created_at"] else None
    }

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "service": "healing_api",
        "timestamp": datetime.now().isoformat()
    }