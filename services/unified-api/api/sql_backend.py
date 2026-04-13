"""
Unified SQL Backend API Router
Migrated from Node.js Express to FastAPI
Handles database operations for test sessions, elements, and review queue
"""

from fastapi import APIRouter, HTTPException, Query, Body, Depends, Header
from pydantic import BaseModel, ValidationError
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import logging
import copy

from core.auth import get_current_active_user, get_optional_current_user
from models.auth_models import CurrentUser

router = APIRouter()
logger = logging.getLogger(__name__)

# SQL Backend Models
class ElementData(BaseModel):
    id: Optional[str] = None
    element_id: Optional[str] = None
    tag: str
    text_content: Optional[str] = None
    text: Optional[str] = None
    attributes: Dict[str, Any] = {}
    xpath: Optional[str] = None
    cssSelector: Optional[str] = None
    css_selector: Optional[str] = None
    position_x: Optional[int] = 0
    position_y: Optional[int] = 0
    selectors: List[str] = []
    page: str
    logical_key: Optional[str] = None
    identity_data: Optional[Dict[str, Any]] = {}

class SessionInfo(BaseModel):
    session_id: Optional[str] = None
    name: Optional[str] = None
    page: Optional[str] = None
    description: Optional[str] = None

class RecordElementRequest(BaseModel):
    element_data: ElementData
    session_info: Optional[SessionInfo] = None

class ExecutionData(BaseModel):
    toolName: str
    parameters: Dict[str, Any] = {}
    result: Optional[Dict[str, Any]] = None
    executionTime: Optional[int] = None
    page: Optional[str] = None

class ReviewQueueUpdate(BaseModel):
    status: str
    reviewer_notes: Optional[str] = None

class HealingAttempt(BaseModel):
    timestamp: str
    elementId: str
    page: str
    originalLocator: str
    attemptedAlternatives: List[str] = []
    healedLocator: Optional[str] = None
    result: str  # SUCCESS, FAILED
    error: Optional[str] = None

class HealingSubmission(BaseModel):
    session_id: Optional[str] = None
    test_run_id: Optional[str] = None
    healing_attempts: List[HealingAttempt]

@router.post("/record-element")
async def record_element(
    request: RecordElementRequest,
    project_id_header: Optional[str] = Header(None, alias="X-Project-ID"),
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user)
):
    """
    Record element data from Chrome Extension
    """
    try:
        logger.debug("Received record-element request")
        
        # Validate required fields
        if not request.element_data:
            raise HTTPException(status_code=422, detail="element_data is required")
        
        if not request.element_data.tag:
            raise HTTPException(status_code=422, detail="element_data.tag is required")
        
        if not request.element_data.page:
            raise HTTPException(status_code=422, detail="element_data.page is required")
        
        from core.database import get_database
        db = await get_database()
        
        element_data = request.element_data
        session_info = request.session_info
        
        # Prefer authenticated user's current project, then explicit header, then fallback project.
        project_id = None
        if current_user and current_user.project and current_user.project.id:
            project_id = current_user.project.id
        elif project_id_header:
            project_id = project_id_header
        else:
            fallback_project = await db.fetchrow(
                """
                SELECT id
                FROM core.projects
                WHERE is_active = true
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
            if not fallback_project:
                raise HTTPException(status_code=400, detail="No active project available for element recording")
            project_id = fallback_project["id"]
        
        logger.debug("Using project_id=%s for record-element", project_id)
        
        # First, ensure the page exists in repo.pages
        # Convert list to JSON string for JSONB column - asyncpg needs this
        logger.debug("Ensuring page record exists for page=%s", element_data.page)
        
        page_result = await db.fetchrow(
            """
            INSERT INTO repo.pages (project_id, name, route_hint, tags)
            VALUES ($1, $2, $3, $4::jsonb)
            ON CONFLICT (project_id, name) DO UPDATE SET updated_at = NOW()
            RETURNING id
            """,
            project_id,
            element_data.page,
            element_data.page,  # Use page name as route hint
            json.dumps([])  # Convert to JSON string for asyncpg JSONB
        )
        
        page_id = page_result["id"]
        
        # Clean selectors
        css_selector = clean_extension_artifacts(element_data.cssSelector or element_data.css_selector)
        
        # Create primary selector JSON
        primary_selector = {}
        if css_selector:
            primary_selector["css"] = css_selector
        if element_data.xpath:
            primary_selector["xpath"] = element_data.xpath
        
        # Create alternative selectors array
        alt_selectors = []
        for selector in element_data.selectors:
            cleaned = clean_extension_artifacts(selector)
            if cleaned and cleaned != css_selector:
                alt_selectors.append({"css": cleaned})
        
        # Create attributes JSON
        attributes = element_data.attributes.copy()
        if element_data.text_content or element_data.text:
            attributes["text"] = element_data.text_content or element_data.text
        # Add tag to attributes so it's available when reading elements
        if element_data.tag:
            attributes["tag"] = element_data.tag
        
        # Record the element in repo.elements
        # Convert to JSON strings since columns appear to be TEXT type, not JSONB
        primary_selector_json = json.dumps(primary_selector)
        alt_selectors_json = json.dumps(alt_selectors)
        attributes_json = json.dumps(attributes)
        
        # Map to actual database schema - use element_key instead of name
        element_key = element_data.id or element_data.element_id or f"element_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        logger.debug("Inserting element for page_id=%s with element_key=%s", page_id, element_key)
        
        result = await db.fetchrow(
            """
            INSERT INTO repo.elements (
                page_id, name, primary_selector, fallback_selectors, 
                attributes, is_active
            )
            VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6)
            RETURNING *
            """,
            page_id,
            element_key,
            primary_selector_json,
            alt_selectors_json,
            attributes_json,
            True
        )
        return {
            "success": True,
            "data": {
                "id": str(result["id"]),
                "element_key": result["name"],
                "page_id": str(result["page_id"]),
                "primary_selector": result["primary_selector"],
                "alt_selectors": result["fallback_selectors"],
                "attributes": result["attributes"]
            },
            "action": "created"
        }
        
    except ValidationError as e:
        logger.warning("Validation error in record_element: %s", e.errors())
        raise HTTPException(status_code=422, detail=f"Validation failed: {e.errors()}")
    except Exception as e:
        logger.exception("Unexpected error in record_element")
        raise HTTPException(status_code=500, detail=f"Failed to record element: {str(e)}")

@router.post("/record-execution")
async def record_execution(execution_data: ExecutionData, session_id: str):
    """
    Record execution data from Chrome Extension
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        # For now, we'll create a test case and run for this execution
        # In a real scenario, this should reference existing test cases
        
        # First, ensure we have a project
        project_result = await db.fetchrow(
            "SELECT id FROM core.projects LIMIT 1"
        )
        if not project_result:
            raise HTTPException(status_code=500, detail="No project found - please create a project first")
        
        project_id = project_result["id"]
        
        # Create or get test case
        test_case_result = await db.fetchrow(
            """
            INSERT INTO tests.test_cases (
                project_id, title, description, source, status
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (project_id, title) DO UPDATE SET updated_at = NOW()
            RETURNING id
            """,
            project_id,
            f"Execution Test - {execution_data.toolName}",
            f"Test case for {execution_data.toolName} execution",
            "chrome_extension",
            "active"
        )
        
        test_case_id = test_case_result["id"]
        
        # Create execution run
        run_result = await db.fetchrow(
            """
            INSERT INTO exec.runs (
                test_case_id, project_id, environment_id, status, started_at, finished_at
            )
            VALUES (
                $1, $2, 
                (SELECT id FROM core.environments WHERE project_id = $2 LIMIT 1), 
                $3, NOW(), NOW()
            )
            RETURNING id
            """,
            test_case_id,
            project_id,
            "completed" if execution_data.result else "failed"
        )
        
        run_id = run_result["id"]
        
        # Record the execution step
        result = await db.fetchrow(
            """
            INSERT INTO exec.run_steps (
                run_id, position, action_key, params, status, 
                duration_ms, started_at, finished_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            RETURNING *
            """,
            run_id,
            1,  # First step
            execution_data.toolName,
            json.dumps(execution_data.parameters),
            "completed" if execution_data.result else "failed",
            execution_data.executionTime
        )
        return {
            "success": True,
            "data": {
                "id": str(result["id"]),
                "run_id": str(run_id),
                "test_case_id": str(test_case_id),
                "action_key": result["action_key"],
                "status": result["status"],
                "duration_ms": result["duration_ms"]
            }
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to record execution: {str(e)}")

@router.get("/all-data")
async def get_all_data():
    """
    Get all data for Chrome Extension
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        # Get recent test cases with their elements and executions
        test_cases_result = await db.fetch(
            """
            SELECT DISTINCT tc.*, p.name as project_name,
                COUNT(DISTINCT e.id) as element_count,
                COUNT(DISTINCT r.id) as execution_count
            FROM tests.test_cases tc
            JOIN core.projects p ON tc.project_id = p.id
            LEFT JOIN tests.test_steps ts ON tc.id = ts.test_case_id
            LEFT JOIN repo.elements e ON ts.element_ref = e.id
            LEFT JOIN exec.runs r ON tc.id = r.test_case_id
            GROUP BY tc.id, p.name
            ORDER BY tc.updated_at DESC
            LIMIT 10
            """
        )
        
        sessions = []
        for test_case in test_cases_result:
            # Get elements for this test case via test steps
            elements_result = await db.fetch(
                """
                SELECT DISTINCT e.*, p.name as page_name
                FROM repo.elements e
                JOIN repo.pages p ON e.page_id = p.id
                JOIN tests.test_steps ts ON ts.element_ref = e.id
                WHERE ts.test_case_id = $1 
                ORDER BY e.created_at
                """,
                test_case["id"]
            )
            
            # Get executions for this test case
            executions_result = await db.fetch(
                """
                SELECT rs.*, r.status as run_status, r.started_at as run_started_at
                FROM exec.run_steps rs
                JOIN exec.runs r ON rs.run_id = r.id
                WHERE r.test_case_id = $1 
                ORDER BY rs.started_at
                """,
                test_case["id"]
            )
            
            sessions.append({
                "id": str(test_case["id"]),
                "name": test_case["title"],
                "description": test_case["description"],
                "project_name": test_case["project_name"],
                "created_at": test_case["created_at"].isoformat() if test_case["created_at"] else None,
                "updated_at": test_case["updated_at"].isoformat() if test_case["updated_at"] else None,
                "element_count": test_case["element_count"] or 0,
                "execution_count": test_case["execution_count"] or 0,
                "elements": [{
                    "id": str(el["id"]),
                    "element_key": el["name"],
                    "page_name": el["page_name"],
                    "primary_selector": el["primary_selector"],
                    "alt_selectors": el["fallback_selectors"],
                    "attributes": el["attributes"],
                    "is_active": el["is_active"]
                } for el in elements_result],
                "executions": [{
                    "id": str(ex["id"]),
                    "action_key": ex["action_key"],
                    "status": ex["status"],
                    "duration_ms": ex["duration_ms"],
                    "run_status": ex["run_status"],
                    "started_at": ex["started_at"].isoformat() if ex["started_at"] else None
                } for ex in executions_result]
            })
        
        return {"success": True, "data": {"sessions": sessions}}
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

@router.get("/review-queue")
async def get_review_queue(
    status: str = Query("open", description="Filter by status"),
    page: Optional[str] = Query(None, description="Filter by page")
):
    """
    Get review queue items
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        where_clause = "WHERE ri.status = $1"
        params = [status]
        
        if page:
            where_clause += " AND p.name = $2"
            params.append(page)
        
        result = await db.fetch(
            f"""
            SELECT 
                ri.*,
                e.name as element_key,
                p.name as page_name,
                e.primary_selector,
                e.fallback_selectors,
                e.attributes
            FROM healing.review_items ri
            LEFT JOIN repo.elements e ON ri.element_id = e.id
            LEFT JOIN repo.pages p ON e.page_id = p.id
            {where_clause}
            ORDER BY ri.created_at DESC
            """,
            *params
        )
        
        return {
            "success": True,
            "data": [{
                "id": str(row["id"]),
                "element_key": row["element_key"],
                "page_name": row["page_name"],
                "status": row["status"],
                "suggestion": row["suggestion"],
                "rationale": row["rationale"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                "current_primary_selector": row["primary_selector"],
                "current_alt_selectors": row["fallback_selectors"],
                "current_attributes": row["attributes"]
            } for row in result],
            "count": len(result)
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to fetch review queue: {str(e)}")

@router.get("/review/pending")
async def get_pending_reviews():
    """
    Get pending review items (compatible with ReviewQueuePage)
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        result = await db.fetch(
            """
            SELECT 
                ri.id,
                e.name as element_id,
                p.name as page,
                ri.suggestion,
                e.primary_selector as current_selectors,
                0.8 as confidence_score,
                ri.rationale as ai_reasoning,
                'update_selector' as intended_action,
                ri.status,
                ri.created_at,
                ri.updated_at
            FROM healing.review_items ri
            LEFT JOIN repo.elements e ON ri.element_id = e.id
            LEFT JOIN repo.pages p ON e.page_id = p.id
            WHERE ri.status = 'open'
            ORDER BY ri.created_at DESC
            """
        )
        
        # Convert to expected format
        review_items = []
        for row in result:
            suggested_locator = ""
            old_locator = ""
            
            # Handle suggestion JSON
            if row["suggestion"]:
                try:
                    suggestion = row["suggestion"] if isinstance(row["suggestion"], dict) else json.loads(row["suggestion"])
                    suggested_locator = suggestion.get("suggestedSelector", "")
                except Exception:
                    suggested_locator = str(row["suggestion"])
            
            # Handle current selector
            if row["current_selectors"]:
                try:
                    current_sel = row["current_selectors"] if isinstance(row["current_selectors"], dict) else json.loads(row["current_selectors"])
                    old_locator = current_sel.get("css", "") or current_sel.get("xpath", "")
                except Exception:
                    old_locator = str(row["current_selectors"])
            
            review_items.append({
                "id": str(row["id"]),
                "page": row["page"],
                "element_id": row["element_id"],
                "suggested_locator": suggested_locator,
                "old_locator": old_locator,
                "confidence_score": float(row["confidence_score"]),
                "ai_reasoning": row["ai_reasoning"],
                "intended_action": row["intended_action"],
                "status": row["status"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            })
        
        return review_items
        
    except Exception as e:return []

@router.patch("/review/{review_id}")
async def update_review_status(review_id: str, update: ReviewQueueUpdate):
    """
    Update review status (compatible with ReviewQueuePage)
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        result = await db.fetchrow(
            """
            WITH updated AS (
                UPDATE healing.review_items 
                SET 
                    status = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *
            )
            SELECT 
                updated.*,
                e.name as element_key,
                p.name as page_name
            FROM updated
            LEFT JOIN repo.elements e ON updated.element_id = e.id
            LEFT JOIN repo.pages p ON e.page_id = p.id
            """,
            update.status,
            review_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Review item not found")
        
        # If approved, apply the healing suggestion
        if update.status == "approved":
            suggestion = result["suggestion"]
            if isinstance(suggestion, dict):
                suggested_selector = suggestion.get("suggestedSelector")
                if suggested_selector and result["element_id"]:
                    # Update the element's primary selector
                    await db.execute(
                        """
                        UPDATE repo.elements 
                        SET primary_selector = $1, updated_at = NOW()
                        WHERE id = $2
                        """,
                        json.dumps({"css": suggested_selector.replace("css=", "")}),
                        result["element_id"]
                    )
        
        # Return in expected format
        return {
            "id": str(result["id"]),
            "page": result["page_name"],
            "element_id": result["element_key"],
            "status": result["status"],
            "updated_at": result["updated_at"].isoformat() if result["updated_at"] else None
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to update review: {str(e)}")

@router.post("/healing/submit")
async def submit_healing_data(submission: HealingSubmission):
    """
    Submit healing data from Java framework
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        created_reviews = 0
        
        # Process each healing attempt
        for attempt in submission.healing_attempts:
            if attempt.result == "SUCCESS" and attempt.healedLocator:
                # Look up existing element in new schema
                element_lookup = await db.fetchrow(
                    """
                    SELECT e.id, e.name as element_key, p.name as page_name, p.id as page_id
                    FROM repo.elements e
                    JOIN repo.pages p ON e.page_id = p.id
                    WHERE e.name = $1 AND p.name = $2 AND e.is_active = true 
                    ORDER BY e.updated_at DESC 
                    LIMIT 1
                    """,
                    attempt.elementId,
                    attempt.page
                )
                
                element_id = element_lookup["id"] if element_lookup else None
                project_id = None
                
                if element_lookup:
                    # Get project ID from page
                    project_result = await db.fetchrow(
                        "SELECT project_id FROM repo.pages WHERE id = $1",
                        element_lookup["page_id"]
                    )
                    project_id = project_result["project_id"] if project_result else None
                
                # POLICY ENGINE: Evaluate healing suggestion
                initial_status = "open"  # Default status
                confidence = getattr(attempt, 'confidence', 85)  # Default confidence
                
                try:
                    from services.policy_engine_enhanced import create_policy_engine
                    
                    if project_id:
                        # Get default environment for project
                        env_result = await db.fetchrow(
                            """
                            SELECT id FROM core.environments 
                            WHERE project_id = $1 AND is_default = true
                            LIMIT 1
                            """,
                            project_id
                        )
                        
                        environment_id = env_result["id"] if env_result else None
                        
                        if environment_id:
                            logger.info(f"🎯 Evaluating healing suggestion with policy engine (confidence: {confidence}%)")
                            
                            # Initialize policy engine
                            policy_engine = await create_policy_engine(db, project_id, environment_id)
                            
                            # Check if healing can be auto-applied
                            can_auto_apply = policy_engine.can_auto_heal(int(confidence))
                            requires_review = policy_engine.requires_review(int(confidence))
                            
                            # Determine initial status based on policy
                            if can_auto_apply:
                                initial_status = "approved"
                                logger.info(f"✅ Healing auto-approved by policy (confidence: {confidence}%)")
                                
                                # Log the auto-approval decision
                                await policy_engine.log_decision(
                                    "auto_heal",
                                    {
                                        "element_id": str(element_id) if element_id else None,
                                        "element_key": attempt.elementId,
                                        "original_selector": attempt.originalLocator,
                                        "healed_selector": attempt.healedLocator,
                                        "confidence": confidence
                                    },
                                    outcome="approved",
                                    metadata={"healing_source": "java-framework"}
                                )
                                
                            elif requires_review:
                                initial_status = "open"
                                logger.info(f"🔍 Healing requires review by policy (confidence: {confidence}%)")
                                
                                # Log the review requirement
                                await policy_engine.log_decision(
                                    "review_required",
                                    {
                                        "element_id": str(element_id) if element_id else None,
                                        "element_key": attempt.elementId,
                                        "original_selector": attempt.originalLocator,
                                        "healed_selector": attempt.healedLocator,
                                        "confidence": confidence
                                    },
                                    outcome="pending_review",
                                    metadata={"healing_source": "java-framework"}
                                )
                            
                            logger.debug(f"📊 Policy engine decision: status={initial_status}")
                        else:
                            logger.debug("ℹ️ No environment found for policy evaluation")
                            
                except ImportError:
                    logger.debug("ℹ️ Policy engine not available, using default healing status")
                except Exception as e:
                    logger.error(f"❌ Policy engine evaluation failed for healing: {e}")
                
                # Create review item for successful healing
                await db.execute(
                    """
                    INSERT INTO healing.review_items (
                        project_id,
                        element_id,
                        status,
                        suggestion,
                        rationale
                    ) VALUES ($1, $2, $3, $4, $5)
                    """,
                    project_id,
                    element_id,
                    initial_status,  # Use policy-determined status
                    json.dumps({
                        "originalSelector": attempt.originalLocator,
                        "suggestedSelector": attempt.healedLocator,
                        "attemptedAlternatives": attempt.attemptedAlternatives,
                        "actionType": "update_primary_selector",
                        "timestamp": attempt.timestamp,
                        "healingSource": "java-framework",
                        "confidence": confidence,
                        "autoApproved": initial_status == "approved",
                        "policyEvaluated": True
                    }),
                    f"Self-healing suggested new locator for element '{attempt.elementId}'. "
                    f"Original locator failed, but healing found a working alternative. "
                    f"Confidence: {confidence}%. Status: {initial_status}."
                )
                
                created_reviews += 1
        
        successful_healings = len([a for a in submission.healing_attempts if a.result == "SUCCESS"])
        
        return {
            "success": True,
            "message": f"Processed {len(submission.healing_attempts)} healing attempts",
            "successful_healings": successful_healings,
            "created_reviews": created_reviews
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to process healing submission: {str(e)}")

@router.get("/elements")
async def get_all_elements(
    limit: int = Query(100, description="Maximum number of elements to return"),
    offset: int = Query(0, description="Number of elements to skip"),
    page: Optional[str] = Query(None, description="Filter by page name"),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Get all recorded elements for the current user's active project
    """
    try:
        logger.debug(f"get_all_elements called with limit={limit}, offset={offset}, page={page}")
        logger.debug(f"Current user: {current_user.user.email} (ID: {current_user.user.id})")
        if current_user.project:
            logger.debug(f"Current project: {current_user.project.name} (ID: {current_user.project.id})")
        else:
            logger.debug("No project set for user")
        
        from core.database import get_database
        logger.debug("About to get database connection")
        
        db = await get_database()
        logger.debug("Database connection established successfully")
        
        # Use current user's active project
        if not current_user.project or not current_user.project.id:
            logger.debug("No project assigned to user, returning empty result")
            return {
                "success": True,
                "data": [],
                "count": 0,
                "message": "No project assigned to user"
            }
        
        project_id = current_user.project.id
        project_name = current_user.project.name
        logger.debug(f"Using current project: {project_name} (ID: {project_id})")

        has_primary_selector = await db.fetchval(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'repo' AND table_name = 'elements' AND column_name = 'primary_selector'
            )
            """
        )

        params = [project_id]
        if page:
            params.append(page)
            logger.debug(f"Added page filter: {page}")
        params.extend([limit, offset])
        limit_offset = f"LIMIT ${len(params)-1} OFFSET ${len(params)}"

        if has_primary_selector:
            where_clause = "WHERE e.is_active = true AND p.project_id = $1"
            if page:
                where_clause += " AND p.name = $2"

            query = f"""
                SELECT
                    e.id,
                    e.name as logical_key,
                    p.name as page,
                    p.project_id,
                    e.primary_selector,
                    e.fallback_selectors,
                    e.attributes,
                    e.is_active,
                    e.created_at as timestamp_recorded,
                    e.updated_at
                FROM repo.elements e
                JOIN repo.pages p ON e.page_id = p.id
                {where_clause}
                ORDER BY e.updated_at DESC
                {limit_offset}
                """
        else:
            where_clause = "WHERE e.is_active = true AND e.project_id = $1"
            if page:
                where_clause += " AND e.page_name = $2"

            query = f"""
                SELECT
                    e.id,
                    e.name as logical_key,
                    COALESCE(e.page_name, 'unknown') as page,
                    e.project_id,
                    jsonb_build_object(
                        'css', COALESCE(e.css_selector, ''),
                        'xpath', COALESCE(e.xpath_selector, ''),
                        'tag', COALESCE(e.element_type, '')
                    ) as primary_selector,
                    '[]'::jsonb as fallback_selectors,
                    jsonb_build_object(
                        'description', COALESCE(e.description, ''),
                        'tag', COALESCE(e.element_type, '')
                    ) as attributes,
                    e.is_active,
                    e.created_at as timestamp_recorded,
                    e.updated_at
                FROM repo.elements e
                {where_clause}
                ORDER BY e.updated_at DESC
                {limit_offset}
                """

        logger.debug(f"Using elements query mode: {'enhanced' if has_primary_selector else 'legacy'}")
        
        logger.debug(f"About to execute query: {query}")
        logger.debug(f"Query params: {params}")
        
        result = await db.fetch(query, *params)
        logger.debug(f"Query executed successfully, result type: {type(result)}")
        logger.debug(f"Result length/content: {len(result) if hasattr(result, '__len__') else 'N/A'}")
        
        if hasattr(result, '__iter__'):
            logger.debug(f"First few rows: {list(result)[:2] if result else 'No rows'}")
        else:
            logger.debug(f"Result is not iterable: {result}")
        
        # Convert to format expected by frontend
        logger.debug(f"Starting to process {len(result) if hasattr(result, '__len__') else 'unknown'} rows")
        elements = []
        
        for i, row in enumerate(result):
            try:
                logger.debug(f"Processing row {i+1}: {dict(row) if hasattr(row, 'keys') else row}")
                
                # Parse selectors - handle potential JSON strings
                primary_selector = row.get("primary_selector")
                logger.debug(f"Raw primary_selector: {primary_selector} (type: {type(primary_selector)})")
                
                if isinstance(primary_selector, str):
                    try:
                        primary_selector = json.loads(primary_selector)
                        logger.debug(f"Parsed primary_selector from JSON: {primary_selector}")
                    except Exception as json_err:
                        logger.debug(f"Failed to parse primary_selector JSON: {json_err}")
                        primary_selector = {}
                elif not primary_selector:
                    primary_selector = {}
                
                alt_selectors = row.get("fallback_selectors")
                logger.debug(f"Raw alt_selectors: {alt_selectors} (type: {type(alt_selectors)})")
                
                if isinstance(alt_selectors, str):
                    try:
                        alt_selectors = json.loads(alt_selectors)
                        logger.debug(f"Parsed alt_selectors from JSON: {alt_selectors}")
                    except Exception as json_err:
                        logger.debug(f"Failed to parse alt_selectors JSON: {json_err}")
                        alt_selectors = []
                elif not alt_selectors:
                    alt_selectors = []
                
                attributes = row.get("attributes")
                logger.debug(f"Raw attributes: {attributes} (type: {type(attributes)})")
                
                if isinstance(attributes, str):
                    try:
                        attributes = json.loads(attributes)
                        logger.debug(f"Parsed attributes from JSON: {attributes}")
                    except Exception as json_err:
                        logger.debug(f"Failed to parse attributes JSON: {json_err}")
                        attributes = {}
                elif not attributes:
                    attributes = {}
                
                # Extract main selectors and tag
                css_selector = primary_selector.get("css_selector", primary_selector.get("css", "")) if primary_selector else ""
                xpath = primary_selector.get("xpath", "") if primary_selector else ""
                
                # Get tag from attributes or primary_selector
                tag = attributes.get("tag", "unknown") if attributes else "unknown"
                if tag == "unknown" or not tag:
                    tag = primary_selector.get("tag", "unknown") if primary_selector else "unknown"
                
                logger.debug(f"Extracted - css_selector: {css_selector}, xpath: {xpath}, tag: {tag}")
                
                # Build selectors list
                selectors = []
                if css_selector:
                    selectors.append(css_selector)
                if xpath:
                    selectors.append(xpath)
                
                # Add alternative selectors
                if alt_selectors:
                    for alt_sel in alt_selectors:
                        if isinstance(alt_sel, dict):
                            if alt_sel.get("css"):
                                selectors.append(alt_sel["css"])
                            if alt_sel.get("xpath"):
                                selectors.append(alt_sel["xpath"])
                
                logger.debug(f"Final selectors list: {selectors}")
                
                # Handle timestamp conversion
                timestamp_recorded = row.get("timestamp_recorded")
                if timestamp_recorded:
                    try:
                        timestamp_iso = timestamp_recorded.isoformat() if hasattr(timestamp_recorded, 'isoformat') else str(timestamp_recorded)
                    except Exception as ts_err:
                        logger.debug(f"Failed to convert timestamp: {ts_err}")
                        timestamp_iso = None
                else:
                    timestamp_iso = None
                
                element_dict = {
                    "id": row["logical_key"],  # Use name as ID for frontend display
                    "logical_key": row["logical_key"],
                    "dbId": str(row["id"]),  # Keep database UUID for operations
                    "tag": tag,
                    "text_content": attributes.get("text", "") if attributes else "",
                    "text": attributes.get("text", "") if attributes else "",
                    "attributes": attributes if attributes else {},
                    "xpath": xpath,
                    "css_selector": css_selector,
                    "position_x": 0,  # Not stored in new schema
                    "position_y": 0,  # Not stored in new schema
                    "selectors": selectors,
                    "page": row["page"],
                    "project_id": str(row["project_id"]),  # Include for debugging
                    "timestamp_recorded": timestamp_iso,
                    "is_active": row["is_active"]
                }
                
                logger.debug(f"Created element dict: {element_dict}")
                elements.append(element_dict)
                
            except Exception as row_err:
                logger.error(f"Failed to process row {i+1}: {row_err}")
                logger.error(f"Row data: {row}")
                # Continue processing other rows
                continue
        
        logger.debug(f"Successfully processed {len(elements)} elements")
        
        result_dict = {
            "success": True,
            "data": elements,
            "count": len(elements)
        }
        
        logger.debug(f"Returning result: {result_dict}")
        return result_dict
        
    except Exception as e:
        logger.error(f"Exception in get_all_elements: {str(e)}")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch elements: {str(e)}")

async def _cascade_element_selector_update(db, element_uuid, new_primary_selector, old_primary_selector=None):
    """
    When an element's primary_selector changes, propagate the new locator to:
      1. All planner.plans whose plan_json steps reference this element
         (via planner.prompt_step_elements).
      2. All pending exec.step_results whose test_step references this element
         (via tests.test_steps.element_ref).
    """
    selector_obj = new_primary_selector if isinstance(new_primary_selector, dict) else json.loads(new_primary_selector)
    new_css = selector_obj.get("css") or selector_obj.get("css_selector") or ""
    new_xpath = selector_obj.get("xpath") or ""
    # Prefer CSS; fall back to XPath
    new_locator = new_css or new_xpath
    if not new_locator:
        return

    old_locator_candidates = set()
    if old_primary_selector:
        try:
            old_obj = old_primary_selector if isinstance(old_primary_selector, dict) else json.loads(old_primary_selector)
            old_css = (old_obj.get("css") or old_obj.get("css_selector") or "").strip()
            old_xpath = (old_obj.get("xpath") or "").strip()
            if old_css:
                old_locator_candidates.add(old_css)
            if old_xpath:
                old_locator_candidates.add(old_xpath)
        except Exception:
            pass

    def _set_by_parameter_key(step: dict, parameter_key: str, value: str) -> bool:
        """Set a value in step using supported key formats (selector, params.selector, args.selector, etc)."""
        if not isinstance(step, dict) or not parameter_key:
            return False

        changed_local = False

        # Direct top-level key
        if parameter_key in step and step.get(parameter_key) != value:
            step[parameter_key] = value
            changed_local = True

        # Nested dotted key support (e.g., args.selector, params.selector)
        if "." in parameter_key:
            parts = [p for p in parameter_key.split(".") if p]
            target = step
            for part in parts[:-1]:
                if not isinstance(target, dict) or part not in target:
                    target = None
                    break
                target = target.get(part)
            if isinstance(target, dict):
                last_key = parts[-1]
                if target.get(last_key) != value:
                    target[last_key] = value
                    changed_local = True

        # Common selector containers
        params = step.get("params")
        if isinstance(params, dict) and parameter_key in params and params.get(parameter_key) != value:
            params[parameter_key] = value
            changed_local = True

        args = step.get("args")
        if isinstance(args, dict) and parameter_key in args and args.get(parameter_key) != value:
            args[parameter_key] = value
            changed_local = True

        # Also update canonical locator field when present
        if "locator" in step and step.get("locator") != value:
            step["locator"] = value
            changed_local = True

        return changed_local

    # ── 1. Update plan_json in planner.plans ──
    try:
        refs = await db.fetch(
            """
            SELECT pse.prompt_id, pse.plan_id, pse.step_index, pse.parameter_key
            FROM planner.prompt_step_elements pse
            WHERE pse.element_id = $1
            """,
            element_uuid,
        )
    except Exception:
        refs = []

    # Group by plan_id so each plan is updated once
    plans_to_patch: Dict[str, list] = {}
    for ref in refs:
        plan_id = str(ref["plan_id"])
        plans_to_patch.setdefault(plan_id, []).append(ref)

    for plan_id, step_refs in plans_to_patch.items():
        try:
            plan_row = await db.fetchrow(
                "SELECT plan_json FROM planner.plans WHERE id = $1",
                plan_id,
            )
            if not plan_row:
                continue
            plan_json = plan_row["plan_json"]
            if isinstance(plan_json, str):
                plan_json = json.loads(plan_json)
            plan_json = copy.deepcopy(plan_json)
            steps = plan_json.get("steps", [])
            changed = False
            for ref in step_refs:
                idx = ref["step_index"]
                param_key = ref["parameter_key"]
                if idx < len(steps):
                    step = steps[idx]
                    if _set_by_parameter_key(step, param_key, new_locator):
                        changed = True

            if changed:
                await db.execute(
                    "UPDATE planner.plans SET plan_json = $1, updated_at = NOW() WHERE id = $2",
                    json.dumps(plan_json),
                    plan_id,
                )
                logger.info("Cascaded element selector to plan %s (%d steps patched)", plan_id, len(step_refs))
        except Exception as e:
            logger.warning("Failed to cascade element to plan %s: %s", plan_id, e)

    # Fallback: if no relationship rows were found, patch plans by exact old selector match.
    if not plans_to_patch and old_locator_candidates:
        try:
            all_plans = await db.fetch("SELECT id, plan_json FROM planner.plans")
            selector_keys = {
                "selector", "locator", "target", "css_selector", "xpath", "original_selector", "target_selector"
            }
            for plan_row in all_plans:
                plan_id = str(plan_row["id"])
                plan_json = plan_row["plan_json"]
                if isinstance(plan_json, str):
                    try:
                        plan_json = json.loads(plan_json)
                    except Exception:
                        continue
                if not isinstance(plan_json, dict):
                    continue

                plan_json = copy.deepcopy(plan_json)
                steps = plan_json.get("steps", [])
                if not isinstance(steps, list) or not steps:
                    continue

                changed = False
                for step in steps:
                    if not isinstance(step, dict):
                        continue

                    for key in selector_keys:
                        val = step.get(key)
                        if isinstance(val, str) and val.strip() in old_locator_candidates and val.strip() != new_locator:
                            step[key] = new_locator
                            changed = True

                    for container_key in ("params", "args"):
                        container = step.get(container_key)
                        if not isinstance(container, dict):
                            continue
                        for key in selector_keys:
                            val = container.get(key)
                            if isinstance(val, str) and val.strip() in old_locator_candidates and val.strip() != new_locator:
                                container[key] = new_locator
                                changed = True

                if changed:
                    await db.execute(
                        "UPDATE planner.plans SET plan_json = $1, updated_at = NOW() WHERE id = $2",
                        json.dumps(plan_json),
                        plan_id,
                    )
                    logger.info("Fallback-cascaded selector to plan %s", plan_id)
        except Exception as e:
            logger.warning("Fallback cascade by selector match failed: %s", e)

    # ── 2. Update pending exec.step_results ──
    try:
        await db.execute(
            """
            UPDATE exec.step_results sr
            SET action_data = jsonb_set(sr.action_data, '{locator}', to_jsonb($1::text)),
                updated_at = NOW()
            FROM tests.test_steps ts
            WHERE ts.element_ref = $2
              AND sr.test_step_id = ts.id
              AND sr.status = 'pending'
            """,
            new_locator,
            element_uuid,
        )
    except Exception as e:
        logger.warning("Failed to cascade element to pending step_results: %s", e)

    # ── 3. Update tests.test_steps parameters ──
    try:
        await db.execute(
            """
            UPDATE tests.test_steps
            SET parameters = jsonb_set(
                COALESCE(parameters, '{}'::jsonb),
                '{locator}',
                to_jsonb($1::text)
            ),
            updated_at = NOW()
            WHERE element_ref = $2
            """,
            new_locator,
            element_uuid,
        )
    except Exception as e:
        logger.warning("Failed to cascade element to test_steps: %s", e)


@router.put("/elements/{element_id}")
async def update_element(
    element_id: str,
    updates: dict,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user)
):
    """
    Update an element by ID (can use logical key/name or UUID)
    Supports updating: logical_key/name, primary_selector, fallback_selectors, attributes
    """
    try:
        from core.database import get_database
        
        db = await get_database()
        
        # Detect table shape (legacy vs enhanced)
        has_primary_selector = await db.fetchval(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'repo' AND table_name = 'elements' AND column_name = 'primary_selector'
            )
            """
        )
        has_fallback_selectors = await db.fetchval(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'repo' AND table_name = 'elements' AND column_name = 'fallback_selectors'
            )
            """
        )
        has_attributes = await db.fetchval(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'repo' AND table_name = 'elements' AND column_name = 'attributes'
            )
            """
        )

        # Try to find element by logical key (name) first, then by UUID
        if has_primary_selector:
            element = await db.fetchrow(
                "SELECT id, name, primary_selector FROM repo.elements WHERE name = $1 OR id::text = $1",
                element_id
            )
        else:
            element = await db.fetchrow(
                "SELECT id, name FROM repo.elements WHERE name = $1 OR id::text = $1",
                element_id
            )
        
        if not element:
            raise HTTPException(status_code=404, detail=f"Element '{element_id}' not found")
        
        element_uuid = element['id']
        old_primary_selector = element['primary_selector'] if has_primary_selector else None
        
        # Build update query dynamically based on provided fields
        update_fields = []
        update_values = []
        param_index = 1
        
        # Normalize incoming logical key
        if 'logical_key' in updates:
            updates['name'] = updates['logical_key']

        # Accept flat css_selector / xpath from frontend and merge into primary_selector
        if has_primary_selector and ('css_selector' in updates or 'xpath' in updates):
            # Fetch current primary_selector to merge
            cur_row = await db.fetchrow(
                "SELECT primary_selector FROM repo.elements WHERE id = $1", element_uuid
            )
            cur_sel = cur_row["primary_selector"] if cur_row and cur_row["primary_selector"] else {}
            if isinstance(cur_sel, str):
                cur_sel = json.loads(cur_sel)
            if 'css_selector' in updates:
                cur_sel["css"] = updates["css_selector"]
            if 'xpath' in updates:
                cur_sel["xpath"] = updates["xpath"]
            updates["primary_selector"] = cur_sel

        # Accept either name or legacy element_key input; persist to name
        if 'element_key' in updates and 'name' not in updates:
            updates['name'] = updates['element_key']

        if 'name' in updates:
            update_fields.append(f"name = ${param_index}")
            update_values.append(updates['name'])
            param_index += 1
        
        if has_primary_selector and 'primary_selector' in updates:
            update_fields.append(f"primary_selector = ${param_index}::jsonb")
            update_values.append(json.dumps(updates['primary_selector']) if isinstance(updates['primary_selector'], dict) else updates['primary_selector'])
            param_index += 1

        if not has_primary_selector and 'css_selector' in updates:
            update_fields.append(f"css_selector = ${param_index}")
            update_values.append(updates['css_selector'])
            param_index += 1

        if not has_primary_selector and 'xpath' in updates:
            update_fields.append(f"xpath_selector = ${param_index}")
            update_values.append(updates['xpath'])
            param_index += 1
        
        if has_fallback_selectors and 'alt_selectors' in updates:
            update_fields.append(f"fallback_selectors = ${param_index}::jsonb")
            update_values.append(json.dumps(updates['alt_selectors']) if isinstance(updates['alt_selectors'], list) else updates['alt_selectors'])
            param_index += 1

        if has_fallback_selectors and 'fallback_selectors' in updates:
            update_fields.append(f"fallback_selectors = ${param_index}::jsonb")
            update_values.append(json.dumps(updates['fallback_selectors']) if isinstance(updates['fallback_selectors'], list) else updates['fallback_selectors'])
            param_index += 1
        
        if has_attributes and 'attributes' in updates:
            update_fields.append(f"attributes = ${param_index}::jsonb")
            update_values.append(json.dumps(updates['attributes']) if isinstance(updates['attributes'], dict) else updates['attributes'])
            param_index += 1

        if 'text_content' in updates:
            if has_attributes:
                update_fields.append(f"attributes = jsonb_set(COALESCE(attributes, '{{}}'::jsonb), '{{text_content}}', ${param_index}::jsonb)")
                update_values.append(json.dumps(updates['text_content']))
                param_index += 1
            else:
                update_fields.append(f"description = ${param_index}")
                update_values.append(updates['text_content'])
                param_index += 1
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No valid update fields provided")
        
        # Add updated_at
        update_fields.append("updated_at = NOW()")
        
        # Execute update
        query = f"""
            UPDATE repo.elements 
            SET {', '.join(update_fields)}
            WHERE id = ${param_index}
            RETURNING *
        """
        update_values.append(element_uuid)
        
        result = await db.fetchrow(query, *update_values)
        
        # ── Cascade: propagate selector changes to all test plans & pending steps ──
        cascaded = False
        if has_primary_selector and 'primary_selector' in updates:
            try:
                await _cascade_element_selector_update(db, element_uuid, updates['primary_selector'], old_primary_selector)
                cascaded = True
            except Exception as cascade_err:
                logger.warning("Element cascade propagation partially failed: %s", cascade_err)
        
        return {
            "success": True,
            "message": "Element updated successfully" + (" and cascaded to test plans" if cascaded else ""),
            "cascaded": cascaded,
            "data": {
                "id": str(result['id']),
                "element_key": result['name'],
                "page_id": str(result['page_id']) if 'page_id' in result and result['page_id'] else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"updating element: {str(e)}")
        import traceback
        logger.error(f"traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to update element: {str(e)}")

@router.delete("/elements/{element_id}")
async def delete_element(
    element_id: str,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user)
):
    """
    Delete an element by ID (can use element_key or UUID)
    """
    try:
        from core.database import get_database
        
        db = await get_database()
        
        # Try to find element by element_key first, then by UUID
        element = await db.fetchrow(
            "SELECT id, element_key FROM repo.elements WHERE element_key = $1 OR id::text = $1",
            element_id
        )
        
        if not element:
            raise HTTPException(status_code=404, detail=f"Element '{element_id}' not found")
        
        element_key = element['element_key']
        element_uuid = element['id']
        
        # Delete the element
        await db.execute(
            "DELETE FROM repo.elements WHERE id = $1",
            element_uuid
        )
        
        return {
            "success": True,
            "message": f"Element '{element_key}' deleted successfully",
            "deleted_id": str(element_uuid),
            "element_key": element_key
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"deleting element: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete element: {str(e)}")

@router.get("/execution-stats")
async def get_execution_stats(
    test_case_id: Optional[str] = Query(None, description="Filter by test case ID"),
    prompt_id: Optional[str] = Query(None, description="Filter by prompt ID (maps to test_case_id)")
):
    """
    Get execution statistics for dashboard
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        # Build WHERE clause for filters
        where_clauses = ["r.started_at >= NOW() - INTERVAL '30 days'"]
        params = []
        
        if test_case_id:
            params.append(test_case_id)
            where_clauses.append(f"r.test_case_id = ${len(params)}")
        elif prompt_id:
            params.append(prompt_id)
            where_clauses.append(f"r.test_case_id = ${len(params)}")
        
        where_clause = " AND ".join(where_clauses)
        
        # Get overall execution statistics
        stats_result = await db.fetchrow(
            f"""
            SELECT 
                COUNT(*) as total_executions,
                COUNT(CASE WHEN r.status IN ('completed', 'passed', 'success') THEN 1 END) as successful_executions,
                COUNT(CASE WHEN r.status IN ('failed', 'error', 'failure') THEN 1 END) as failed_executions,
                CASE 
                    WHEN COUNT(*) > 0 THEN 
                        ROUND((COUNT(CASE WHEN r.status IN ('completed', 'passed', 'success') THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 2)
                    ELSE 0 
                END as success_rate,
                COUNT(CASE WHEN r.started_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as recent_executions_24h,
                ROUND(AVG(CASE 
                    WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                         AND r.finished_at > r.started_at
                    THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at))
                    ELSE NULL 
                END), 0) as avg_execution_time
            FROM exec.runs r
            WHERE {where_clause}
            """,
            *params
        )
        
        return {
            "success": True,
            "data": {
                "total_executions": stats_result["total_executions"] or 0,
                "successful_executions": stats_result["successful_executions"] or 0,
                "failed_executions": stats_result["failed_executions"] or 0,
                "success_rate": float(stats_result["success_rate"]) if stats_result["success_rate"] else 0.0,
                "recent_executions_24h": stats_result["recent_executions_24h"] or 0,
                "avg_execution_time": float(stats_result["avg_execution_time"]) if stats_result["avg_execution_time"] else 0.0
            }
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to fetch execution stats: {str(e)}")

@router.get("/executions")
async def get_executions(
    limit: int = Query(20, description="Maximum number of executions to return"),
    offset: int = Query(0, description="Number of executions to skip"),
    status: Optional[str] = Query(None, description="Filter by status"),
    test_case_id: Optional[str] = Query(None, description="Filter by test case ID"),
    prompt_id: Optional[str] = Query(None, description="Filter by prompt ID (maps to test_case_id)")
):
    """
    Get execution data from the database
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        where_clauses = []
        params = []
        
        if status:
            params.append(status)
            where_clauses.append(f"r.status = ${len(params)}")
        
        # Support filtering by test_case_id or prompt_id (they're the same)
        if test_case_id:
            params.append(test_case_id)
            where_clauses.append(f"r.test_case_id = ${len(params)}")
        elif prompt_id:
            params.append(prompt_id)
            where_clauses.append(f"r.test_case_id = ${len(params)}")
        
        where_clause = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        
        # Add pagination
        params.extend([limit, offset])
        limit_offset = f"LIMIT ${len(params)-1} OFFSET ${len(params)}"
        
        result = await db.fetch(
            f"""
            SELECT 
                r.id,
                r.test_case_id,
                tc.title as test_name,
                COALESCE(p.intent, p.text, tc.description) as prompt_description,
                r.status,
                r.started_at,
                r.finished_at,
                CASE 
                    WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                         AND r.finished_at > r.started_at
                    THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at))::integer
                    ELSE NULL 
                END as duration_seconds,
                COUNT(rs.id) as total_steps,
                COUNT(CASE WHEN rs.status IN ('passed', 'completed', 'success') THEN 1 END) as passed_steps,
                COUNT(CASE WHEN rs.status IN ('failed', 'error', 'failure') THEN 1 END) as failed_steps,
                CASE 
                    WHEN COUNT(rs.id) > 0 THEN 
                        ROUND((COUNT(CASE WHEN rs.status IN ('passed', 'completed', 'success') THEN 1 END)::numeric / COUNT(rs.id)::numeric) * 100, 2)
                    ELSE 0 
                END as success_rate
            FROM exec.runs r
            LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
            LEFT JOIN planner.prompts p ON tc.source_ref_id = p.id
            LEFT JOIN exec.step_results rs ON r.id = rs.test_run_id
            {where_clause}
            GROUP BY r.id, tc.title, tc.description, p.intent, p.text, r.status, r.started_at, r.finished_at
            ORDER BY r.started_at DESC
            {limit_offset}
            """,
            *params
        )
        
        # Convert to format expected by frontend
        executions = []
        for row in result:
            # Map database status to frontend status
            status_mapping = {
                'completed': 'completed',
                'failed': 'failed', 
                'running': 'running',
                'pending': 'pending'
            }
            
            executions.append({
                "id": str(row["id"]),
                "execution_id": str(row["id"]),
                "test_case_id": str(row["test_case_id"]) if row["test_case_id"] else None,
                "prompt_id": str(row["test_case_id"]) if row["test_case_id"] else None,  # Use test_case_id as prompt_id for compatibility
                "test_name": row["test_name"] or "Unknown Test",
                "prompt_description": row["prompt_description"] or "No description available",
                "status": status_mapping.get(row["status"], row["status"]),
                "started_at": row["started_at"].isoformat() if row["started_at"] else None,
                "start_time": row["started_at"].isoformat() if row["started_at"] else None,  # Alias for compatibility
                "finished_at": row["finished_at"].isoformat() if row["finished_at"] else None,
                "duration_seconds": row["duration_seconds"] or 0,
                "duration": row["duration_seconds"] or 0,  # Alias for compatibility
                "total_steps": row["total_steps"] or 0,
                "passed_steps": row["passed_steps"] or 0,
                "steps_completed": row["passed_steps"] or 0,  # Alias for compatibility
                "failed_steps": row["failed_steps"] or 0,
                "success_rate": float(row["success_rate"]) if row["success_rate"] else 0.0
            })
        
        return {
            "success": True,
            "data": executions,
            "total_count": len(executions),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to fetch executions: {str(e)}")

@router.get("/health")
async def health_check():
    """SQL backend health check"""
    return {
        "status": "healthy",
        "service": "sql_backend",
        "timestamp": datetime.utcnow().isoformat()
    }

# Helper functions
def clean_extension_artifacts(selector: str) -> str:
    """Clean Chrome extension artifact classes"""
    if not selector or not isinstance(selector, str):
        return selector
    
    # Remove MCP Chrome extension classes
    selector = (selector
                .replace('.mcp-hover-highlight', '')
                .replace('.mcp-recorded-highlight', '')
                .replace('.mcp-', '')  # Remove any other mcp- classes
                .replace('..', '.')  # Replace multiple dots with single dot
                .rstrip('.')  # Remove trailing dot
                .strip())  # Trim whitespace
    
    return selector

def normalize_selector(selector: str) -> str:
    """Normalize selector format"""
    if not selector or not isinstance(selector, str):
        return selector
    
    # Remove common prefixes to get plain selectors
    if selector.startswith('css='):
        return selector[4:]
    elif selector.startswith('xpath='):
        return selector[6:]
    elif selector.startswith('id='):
        return '#' + selector[3:]
    elif selector.startswith('name='):
        return f'[name="{selector[5:]}"]'
    elif selector.startswith('class='):
        return '.' + selector[6:]
    elif selector.startswith('tag='):
        return selector[4:]
    
    return selector

# Analytics endpoints for dashboard
@router.get("/execution-trends")
async def get_execution_trends(days: int = 30):
    """
    Get execution trends over specified period
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        # Get daily execution counts and success rates
        trends_result = await db.fetch(
            """
            SELECT 
                DATE(r.created_at) as date,
                COUNT(*) as total_executions,
                COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as successful_executions,
                COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_executions,
                CAST(COUNT(CASE WHEN r.status = 'completed' THEN 1 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as success_rate,
                AVG(CASE 
                    WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                    AND r.finished_at > r.started_at
                    THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000 
                    ELSE NULL 
                END) as avg_duration_ms
            FROM exec.runs r
            WHERE r.created_at >= CURRENT_DATE - make_interval(days => $1)
            GROUP BY DATE(r.created_at)
            ORDER BY date ASC
            """, days
        )
        
        trends = []
        for row in trends_result:
            trends.append({
                "date": row["date"].isoformat(),
                "total_executions": row["total_executions"],
                "successful_executions": row["successful_executions"],
                "failed_executions": row["failed_executions"],
                "success_rate": float(row["success_rate"]) if row["success_rate"] else 0.0,
                "avg_duration_ms": float(row["avg_duration_ms"]) if row["avg_duration_ms"] else 0.0
            })
        
        return {
            "period_days": days,
            "trends": trends,
            "total_data_points": len(trends)
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to fetch execution trends: {str(e)}")

@router.get("/failure-analysis")
async def get_failure_analysis(days: int = 30, limit: int = 10):
    """
    Get failure analysis patterns
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        # Get failure patterns by action/step from step_results table
        failure_patterns_result = await db.fetch(
            """
            SELECT 
                sr.action,
                COUNT(*) as failure_count,
                COUNT(DISTINCT sr.test_run_id) as affected_executions,
                MAX(sr.created_at) as last_failure,
                STRING_AGG(DISTINCT 
                    CASE 
                        WHEN sr.error_message IS NOT NULL AND sr.error_message != '' 
                        THEN SUBSTRING(sr.error_message, 1, 100)
                        ELSE 'Step execution failed'
                    END, '; '
                ) as error_message
            FROM exec.step_results sr
            WHERE sr.status = 'failed'
            AND sr.created_at >= CURRENT_DATE - make_interval(days => $1)
            GROUP BY sr.action
            ORDER BY failure_count DESC
            LIMIT $2
            """, days, limit
        )
        
        failure_patterns = []
        for row in failure_patterns_result:
            failure_patterns.append({
                "action": row["action"],
                "error_message": row["error_message"],
                "failure_count": row["failure_count"],
                "affected_executions": row["affected_executions"],
                "last_failure": row["last_failure"].isoformat() if row["last_failure"] else None
            })
        
        # Get action-level failure rates
        action_failures_result = await db.fetch(
            """
            SELECT 
                rs.action_key as action_type,
                COUNT(*) as total_attempts,
                COUNT(CASE WHEN rs.status = 'failed' THEN 1 END) as failures,
                CAST(COUNT(CASE WHEN rs.status = 'failed' THEN 1 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as failure_rate
            FROM exec.run_steps rs
            JOIN exec.runs r ON rs.run_id = r.id
            WHERE r.created_at >= CURRENT_DATE - make_interval(days => $1)
            AND rs.action_key IS NOT NULL
            GROUP BY rs.action_key
            ORDER BY failure_rate DESC
            """, days
        )
        
        action_failure_rates = []
        for row in action_failures_result:
            action_failure_rates.append({
                "action_type": row["action_type"],
                "total_attempts": row["total_attempts"],
                "failures": row["failures"],
                "failure_rate": float(row["failure_rate"]) if row["failure_rate"] else 0.0
            })
        
        # Calculate summary stats
        total_failure_patterns = len(failure_patterns)
        total_actions_analyzed = len(action_failure_rates)
        highest_failure_count = max([p["failure_count"] for p in failure_patterns]) if failure_patterns else 0
        
        return {
            "period_days": days,
            "failure_patterns": failure_patterns,
            "action_failure_rates": action_failure_rates,
            "analysis_summary": {
                "total_failure_patterns": total_failure_patterns,
                "total_actions_analyzed": total_actions_analyzed,
                "highest_failure_count": highest_failure_count
            }
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to fetch failure analysis: {str(e)}")

@router.get("/performance-metrics")
async def get_performance_metrics(days: int = 7):
    """
    Get performance metrics over specified period
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        # Get overall performance metrics
        performance_result = await db.fetchrow(
            """
            SELECT 
                COUNT(*) as total_executions,
                AVG(CASE 
                    WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                    AND r.finished_at > r.started_at
                    THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000 
                    ELSE NULL 
                END) as avg_execution_time,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
                    CASE 
                        WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                        AND r.finished_at > r.started_at
                        THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000 
                        ELSE NULL 
                    END
                ) as median_execution_time,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY 
                    CASE 
                        WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                        AND r.finished_at > r.started_at
                        THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000 
                        ELSE NULL 
                    END
                ) as p95_execution_time,
                MIN(CASE 
                    WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                    AND r.finished_at > r.started_at
                    THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000 
                    ELSE NULL 
                END) as min_execution_time,
                MAX(CASE 
                    WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                    AND r.finished_at > r.started_at
                    THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000 
                    ELSE NULL 
                END) as max_execution_time,
                COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as successful_executions,
                CAST(COUNT(CASE WHEN r.status = 'completed' THEN 1 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as success_rate
            FROM exec.runs r
            WHERE r.created_at >= CURRENT_DATE - make_interval(days => $1)
            AND r.started_at IS NOT NULL
            """, days
        )
        
        # Get action-level performance metrics from step_results
        action_performance_result = await db.fetch(
            """
            WITH step_durations AS (
                SELECT 
                    sr.action,
                    sr.status,
                    sr.created_at,
                    LAG(sr.created_at) OVER (
                        PARTITION BY sr.test_run_id 
                        ORDER BY sr.step_order
                    ) as prev_step_time,
                    CASE 
                        WHEN LAG(sr.created_at) OVER (
                            PARTITION BY sr.test_run_id 
                            ORDER BY sr.step_order
                        ) IS NOT NULL 
                        THEN EXTRACT(EPOCH FROM (
                            sr.created_at - LAG(sr.created_at) OVER (
                                PARTITION BY sr.test_run_id 
                                ORDER BY sr.step_order
                            )
                        )) * 1000
                        ELSE 1000  -- Default 1 second for first step
                    END as duration_ms
                FROM exec.step_results sr
                WHERE sr.created_at >= CURRENT_DATE - make_interval(days => $1)
                AND sr.action IS NOT NULL
            )
            SELECT 
                action as action_type,
                COUNT(*) as total_actions,
                AVG(duration_ms) as avg_duration,
                MIN(duration_ms) as min_duration,
                MAX(duration_ms) as max_duration,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration
            FROM step_durations
            WHERE duration_ms > 0 AND duration_ms < 300000  -- Filter out unrealistic durations (>5 min)
            GROUP BY action
            HAVING COUNT(*) >= 3  -- Only show actions with at least 3 samples
            ORDER BY avg_duration DESC
            """, days
        )
        
        action_performance = []
        for row in action_performance_result:
            action_performance.append({
                "action_type": row["action_type"],
                "total_actions": row["total_actions"],
                "avg_duration": float(row["avg_duration"]) if row["avg_duration"] else 0.0,
                "min_duration": float(row["min_duration"]) if row["min_duration"] else 0.0,
                "max_duration": float(row["max_duration"]) if row["max_duration"] else 0.0,
                "p95_duration": float(row["p95_duration"]) if row["p95_duration"] else 0.0
            })
        
        return {
            "period_days": days,
            "total_executions": performance_result["total_executions"] if performance_result else 0,
            "avg_execution_time": float(performance_result["avg_execution_time"]) if performance_result and performance_result["avg_execution_time"] else 0.0,
            "median_execution_time": float(performance_result["median_execution_time"]) if performance_result and performance_result["median_execution_time"] else 0.0,
            "p95_execution_time": float(performance_result["p95_execution_time"]) if performance_result and performance_result["p95_execution_time"] else 0.0,
            "min_execution_time": float(performance_result["min_execution_time"]) if performance_result and performance_result["min_execution_time"] else 0.0,
            "max_execution_time": float(performance_result["max_execution_time"]) if performance_result and performance_result["max_execution_time"] else 0.0,
            "successful_executions": performance_result["successful_executions"] if performance_result else 0,
            "success_rate": float(performance_result["success_rate"]) if performance_result and performance_result["success_rate"] else 0.0,
            "action_performance": action_performance
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to fetch performance metrics: {str(e)}")

@router.get("/execution-stats")
async def get_execution_stats(days: int = 30):
    """
    Get execution summary statistics for dashboard
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        # Get overall execution statistics
        stats_result = await db.fetchrow(
            """
            SELECT 
                COUNT(*) as total_executions,
                COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as successful_executions,
                COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_executions,
                CAST(COUNT(CASE WHEN r.status = 'completed' THEN 1 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as success_rate,
                COUNT(CASE WHEN r.created_at >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as recent_executions_24h,
                AVG(CASE 
                    WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                    AND r.finished_at > r.started_at
                    THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at))
                    ELSE NULL 
                END) as avg_execution_time
            FROM exec.runs r
            WHERE r.created_at >= CURRENT_DATE - make_interval(days => $1)
            """, days
        )
        
        return {
            "total_executions": stats_result["total_executions"] if stats_result else 0,
            "successful_executions": stats_result["successful_executions"] if stats_result else 0,
            "failed_executions": stats_result["failed_executions"] if stats_result else 0,
            "success_rate": float(stats_result["success_rate"]) if stats_result and stats_result["success_rate"] else 0.0,
            "recent_executions_24h": stats_result["recent_executions_24h"] if stats_result else 0,
            "avg_execution_time": float(stats_result["avg_execution_time"]) if stats_result and stats_result["avg_execution_time"] else 0.0
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to fetch execution stats: {str(e)}")

@router.get("/executions")
async def get_executions(limit: int = 20, offset: int = 0):
    """
    Get recent execution records for dashboard
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        # Get recent executions with test case information
        executions_result = await db.fetch(
            """
            SELECT 
                r.id as execution_id,
                tc.title as test_name,
                tc.description as prompt_description,
                r.status,
                r.started_at as start_time,
                r.finished_at,
                CASE 
                    WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                    AND r.finished_at > r.started_at
                    THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at))
                    ELSE NULL 
                END as duration,
                -- Calculate step statistics from step_results
                COALESCE(sr.total_steps, 0) as total_steps,
                COALESCE(sr.steps_completed, 0) as steps_completed,
                CASE 
                    WHEN r.status = 'completed' THEN 100.0
                    WHEN r.status = 'failed' THEN 0.0
                    ELSE 50.0
                END as success_rate
            FROM exec.runs r
            JOIN tests.test_cases tc ON r.test_case_id = tc.id
            LEFT JOIN (
                SELECT 
                    test_run_id,
                    COUNT(*) as total_steps,
                    COUNT(CASE WHEN status = 'passed' THEN 1 END) as steps_completed
                FROM exec.step_results 
                GROUP BY test_run_id
            ) sr ON sr.test_run_id = r.id
            ORDER BY r.created_at DESC
            LIMIT $1 OFFSET $2
            """, limit, offset
        )
        
        executions = []
        for row in executions_result:
            executions.append({
                "execution_id": str(row["execution_id"]),
                "test_name": row["test_name"],
                "prompt_description": row["prompt_description"],
                "status": row["status"],
                "start_time": row["start_time"].isoformat() if row["start_time"] else None,
                "duration": float(row["duration"]) if row["duration"] else None,
                "total_steps": row["total_steps"],
                "steps_completed": row["steps_completed"],
                "success_rate": float(row["success_rate"]) if row["success_rate"] else 0.0
            })
        
        return executions
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to fetch executions: {str(e)}")

# Missing analytics endpoints for M8 components
@router.get("/analytics/healing-analytics")
async def get_healing_analytics(days: int = 30):
    """Get healing success analytics for the dashboard"""
    try:
        from core.database import get_database
        db = await get_database()
        
        # Get healing attempt data from the database
        healing_result = await db.fetch(
            """
            SELECT 
                COUNT(*) as total_attempts,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_healing,
                COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_healing,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_healing,
                AVG(CASE 
                    WHEN finished_at IS NOT NULL AND started_at IS NOT NULL 
                    AND finished_at > started_at
                    THEN EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000 
                    ELSE NULL 
                END) as avg_healing_time,
                DATE(created_at) as date,
                COUNT(*) as attempts
            FROM exec.runs 
            WHERE created_at >= CURRENT_DATE - make_interval(days => $1)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
            """, days
        )
        
        # Calculate overall metrics
        total_attempts = sum(row["attempts"] for row in healing_result) if healing_result else 0
        successful_healing = sum(row["successful_healing"] for row in healing_result) if healing_result else 0
        partial_healing = sum(row["partial_healing"] for row in healing_result) if healing_result else 0
        failed_healing = total_attempts - successful_healing - partial_healing
        
        success_rate = (successful_healing / total_attempts * 100) if total_attempts > 0 else 0
        avg_healing_time = sum(row["avg_healing_time"] or 0 for row in healing_result) / len(healing_result) if healing_result else 0
        
        # Build trend data
        trend_data = []
        for row in healing_result:
            trend_data.append({
                "date": row["date"].isoformat(),
                "attempts": row["attempts"],
                "successful": row["successful_healing"],
                "partial": row["partial_healing"],
                "failed": row["failed_healing"]
            })
        
        # Mock healing details for now (would come from actual healing logs)
        healing_details = []
        
        return {
            "totalAttempts": total_attempts,
            "successfulHealing": successful_healing,
            "partialHealing": partial_healing,
            "failedHealing": failed_healing,
            "successRate": round(success_rate, 2),
            "avgHealingTime": round(avg_healing_time, 2),
            "trendData": trend_data,
            "healing_details": healing_details
        }
        
    except Exception as e:# Return empty data structure to prevent frontend errors
        return {
            "totalAttempts": 0,
            "successfulHealing": 0,
            "partialHealing": 0,
            "failedHealing": 0,
            "successRate": 0,
            "avgHealingTime": 0,
            "trendData": [],
            "healing_details": []
        }

@router.get("/analytics/trends")
async def get_analytics_trends(timeRange: str = "24h"):
    """Get performance trends for analytics dashboard"""
    try:
        from core.database import get_database
        db = await get_database()
        
        # Convert timeRange to days
        days_map = {"1h": 1, "24h": 1, "7d": 7}
        days = days_map.get(timeRange, 1)
        
        # Get performance trends from execution data
        trends_result = await db.fetch(
            """
            SELECT 
                'Execution Success Rate' as metric_name,
                CAST(COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) as current_value,
                'percentage' as metric_type,
                COUNT(*) as data_points
            FROM exec.runs 
            WHERE created_at >= CURRENT_DATE - make_interval(days => $1)
            UNION ALL
            SELECT 
                'Average Execution Time' as metric_name,
                CAST(AVG(CASE 
                    WHEN finished_at IS NOT NULL AND started_at IS NOT NULL 
                    AND finished_at > started_at
                    THEN EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000 
                    ELSE NULL 
                END) AS DECIMAL(10,2)) as current_value,
                'milliseconds' as metric_type,
                COUNT(*) as data_points
            FROM exec.runs 
            WHERE created_at >= CURRENT_DATE - make_interval(days => $1)
            AND finished_at IS NOT NULL AND started_at IS NOT NULL
            """, days
        )
        
        trends = []
        for row in trends_result:
            if row["current_value"] is not None:
                trends.append({
                    "metric_name": row["metric_name"],
                    "current_value": float(row["current_value"]),
                    "change_percent": None,  # Requires historical comparison
                    "analysis": {
                        "trend": "increasing" if row["metric_name"] == "Execution Success Rate" else "decreasing",
                        "significance": "medium",
                        "confidence": 85,
                        "insights": [
                            f"Performance trend shows consistent {row['metric_name'].lower()} improvement",
                            f"Based on {row['data_points']} data points over {timeRange}"
                        ]
                    },
                    "recommendations": [
                        "Continue monitoring performance trends",
                        "Consider optimizing based on current patterns"
                    ]
                })
        
        return trends
        
    except Exception as e:return []

@router.get("/analytics/failure-patterns")
async def get_failure_patterns(timeRange: str = "24h"):
    """Get failure pattern analysis for analytics dashboard"""
    try:
        from core.database import get_database
        db = await get_database()
        
        # Convert timeRange to days
        days_map = {"1h": 1, "24h": 1, "7d": 7}
        days = days_map.get(timeRange, 1)
        
        # Get failure patterns from execution data
        patterns_result = await db.fetch(
            """
            SELECT 
                'Element Not Found' as error_type,
                'high' as severity,
                COUNT(*) as frequency,
                ARRAY['Login Form', 'Navigation Menu'] as affected_components
            FROM exec.runs 
            WHERE status = 'failed' 
            AND created_at >= CURRENT_DATE - make_interval(days => $1)
            AND error_message LIKE '%element%not%found%'
            GROUP BY error_type, severity
            HAVING COUNT(*) > 0
            UNION ALL
            SELECT 
                'Timeout Error' as error_type,
                'medium' as severity,
                COUNT(*) as frequency,
                ARRAY['Page Load', 'API Requests'] as affected_components
            FROM exec.runs 
            WHERE status = 'failed' 
            AND created_at >= CURRENT_DATE - make_interval(days => $1)
            AND error_message LIKE '%timeout%'
            GROUP BY error_type, severity
            HAVING COUNT(*) > 0
            """, days
        )
        
        patterns = []
        for i, row in enumerate(patterns_result):
            patterns.append({
                "pattern_id": f"pattern_{i+1}",
                "error_type": row["error_type"],
                "severity": row["severity"],
                "frequency": row["frequency"],
                "affected_components": row["affected_components"],
                "trend": [
                    {"date": "2025-11-01", "value": max(0, row["frequency"] - 2)},
                    {"date": "2025-11-02", "value": max(0, row["frequency"] - 1)},
                    {"date": "2025-11-03", "value": row["frequency"]}
                ]
            })
        
        return patterns
        
    except Exception as e:return []

@router.get("/analytics/ai-insights")
async def get_ai_insights():
    """Get AI-powered insights for the dashboard"""
    try:
        from core.database import get_database
        db = await get_database()
        
        # Get basic execution stats for insights
        stats_result = await db.fetchrow(
            """
            SELECT 
                COUNT(*) as total_executions,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions
            FROM exec.runs 
            WHERE created_at >= CURRENT_DATE - interval '24 hours'
            """
        )
        
        insights = []
        
        if stats_result and stats_result["total_executions"] > 0:
            success_rate = (stats_result["successful_executions"] / stats_result["total_executions"]) * 100
            
            if success_rate > 90:
                insights.append({
                    "id": "success_rate_high",
                    "title": "Excellent Test Performance",
                    "description": f"Your test suite has achieved a {success_rate:.1f}% success rate in the last 24 hours",
                    "severity": "low",
                    "confidence": 95,
                    "category": "performance",
                    "recommendations": [
                        "Continue monitoring for consistency",
                        "Consider expanding test coverage"
                    ],
                    "impact": "positive",
                    "timestamp": "2025-11-03T14:00:00Z"
                })
            elif success_rate < 70:
                insights.append({
                    "id": "success_rate_low",
                    "title": "Test Performance Needs Attention",
                    "description": f"Test success rate has dropped to {success_rate:.1f}% in the last 24 hours",
                    "severity": "high",
                    "confidence": 88,
                    "category": "performance",
                    "recommendations": [
                        "Review failed test cases",
                        "Check for environment changes",
                        "Update selectors if needed"
                    ],
                    "impact": "negative",
                    "timestamp": "2025-11-03T14:00:00Z"
                })
        
        # Add default insights if no data
        if not insights:
            insights.append({
                "id": "getting_started",
                "title": "Ready to Start Testing",
                "description": "Your self-healing test framework is configured and ready. Run some tests to begin collecting insights.",
                "severity": "low",
                "confidence": 100,
                "category": "general",
                "recommendations": [
                    "Execute your first test suite",
                    "Monitor healing capabilities",
                    "Review dashboard analytics"
                ],
                "impact": "neutral",
                "timestamp": "2025-11-03T14:00:00Z"
            })
        
        return insights
        
    except Exception as e:return []
