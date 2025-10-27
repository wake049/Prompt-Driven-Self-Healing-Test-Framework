"""
Unified SQL Backend API Router
Migrated from Node.js Express to FastAPI
Handles database operations for test sessions, elements, and review queue
"""

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import logging

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
async def record_element(element_data: ElementData, session_info: Optional[SessionInfo] = None):
    """
    Record element data from Chrome Extension
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        logger.info(f" Recording element: {element_data.id or element_data.element_id} on page: {element_data.page}")
        
        # First, ensure the page exists in repo.pages
        page_result = await db.fetchrow(
            """
            INSERT INTO repo.pages (project_id, name, route_hint, tags)
            VALUES (
                (SELECT id FROM core.projects LIMIT 1),  -- Use first project for now
                $1, $2, $3
            )
            ON CONFLICT (project_id, name) DO UPDATE SET updated_at = NOW()
            RETURNING id
            """,
            element_data.page,
            element_data.page,  # Use page name as route hint
            []  # Empty tags array for now
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
        
        # Record the element in repo.elements
        result = await db.fetchrow(
            """
            INSERT INTO repo.elements (
                page_id, element_key, primary_selector, alt_selectors, 
                attributes, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (page_id, element_key) DO UPDATE SET
                primary_selector = EXCLUDED.primary_selector,
                alt_selectors = EXCLUDED.alt_selectors,
                attributes = EXCLUDED.attributes,
                updated_at = NOW()
            RETURNING *
            """,
            page_id,
            element_data.id or element_data.element_id or f"element_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            json.dumps(primary_selector),
            json.dumps(alt_selectors),
            json.dumps(attributes),
            True
        )
        
        logger.info(f" Element recorded successfully: {result['id']}")
        
        return {
            "success": True,
            "data": {
                "id": str(result["id"]),
                "element_key": result["element_key"],
                "page_id": str(result["page_id"]),
                "primary_selector": result["primary_selector"],
                "alt_selectors": result["alt_selectors"],
                "attributes": result["attributes"]
            },
            "action": "created"
        }
        
    except Exception as e:
        logger.error(f"Error recording element: {e}")
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
        
        logger.info(f" Execution recorded successfully: {result['id']}")
        
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
        
    except Exception as e:
        logger.error(f"Error recording execution: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to record execution: {str(e)}")

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
                    "element_key": el["element_key"],
                    "page_name": el["page_name"],
                    "primary_selector": el["primary_selector"],
                    "alt_selectors": el["alt_selectors"],
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
        
    except Exception as e:
        logger.error(f"Error fetching all data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

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
                e.element_key,
                p.name as page_name,
                e.primary_selector,
                e.alt_selectors,
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
                "current_alt_selectors": row["alt_selectors"],
                "current_attributes": row["attributes"]
            } for row in result],
            "count": len(result)
        }
        
    except Exception as e:
        logger.error(f"Error fetching review queue: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch review queue: {str(e)}")

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
                e.element_key as element_id,
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
                except:
                    suggested_locator = str(row["suggestion"])
            
            # Handle current selector
            if row["current_selectors"]:
                try:
                    current_sel = row["current_selectors"] if isinstance(row["current_selectors"], dict) else json.loads(row["current_selectors"])
                    old_locator = current_sel.get("css", "") or current_sel.get("xpath", "")
                except:
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
        
    except Exception as e:
        logger.error(f"Error fetching review items: {e}")
        return []

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
            UPDATE healing.review_items 
            SET 
                status = $1,
                updated_at = NOW()
            WHERE id = $2
            RETURNING ri.*, e.element_key, p.name as page_name
            FROM healing.review_items ri
            LEFT JOIN repo.elements e ON ri.element_id = e.id
            LEFT JOIN repo.pages p ON e.page_id = p.id
            WHERE ri.id = $2
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
        
    except Exception as e:
        logger.error(f"Error updating review status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update review: {str(e)}")

@router.post("/healing/submit")
async def submit_healing_data(submission: HealingSubmission):
    """
    Submit healing data from Java framework
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        logger.info(f"🩹 Received healing submission with {len(submission.healing_attempts)} attempts")
        
        created_reviews = 0
        
        # Process each healing attempt
        for attempt in submission.healing_attempts:
            if attempt.result == "SUCCESS" and attempt.healedLocator:
                # Look up existing element in new schema
                element_lookup = await db.fetchrow(
                    """
                    SELECT e.id, e.element_key, p.name as page_name, p.id as page_id
                    FROM repo.elements e
                    JOIN repo.pages p ON e.page_id = p.id
                    WHERE e.element_key = $1 AND p.name = $2 AND e.is_active = true 
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
                    "open",
                    json.dumps({
                        "originalSelector": attempt.originalLocator,
                        "suggestedSelector": attempt.healedLocator,
                        "attemptedAlternatives": attempt.attemptedAlternatives,
                        "actionType": "update_primary_selector",
                        "timestamp": attempt.timestamp,
                        "healingSource": "java-framework"
                    }),
                    f"Self-healing suggested new locator for element '{attempt.elementId}'. Original locator failed, but healing found a working alternative."
                )
                
                created_reviews += 1
        
        successful_healings = len([a for a in submission.healing_attempts if a.result == "SUCCESS"])
        
        return {
            "success": True,
            "message": f"Processed {len(submission.healing_attempts)} healing attempts",
            "successful_healings": successful_healings,
            "created_reviews": created_reviews
        }
        
    except Exception as e:
        logger.error(f"Error processing healing submission: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process healing submission: {str(e)}")

@router.get("/elements")
async def get_all_elements(
    limit: int = Query(100, description="Maximum number of elements to return"),
    offset: int = Query(0, description="Number of elements to skip"),
    page: Optional[str] = Query(None, description="Filter by page name")
):
    """
    Get all recorded elements
    """
    try:
        from core.database import get_database
        db = await get_database()
        
        where_clause = "WHERE e.is_active = true"
        params = []
        
        if page:
            where_clause += " AND p.name = $1"
            params.append(page)
        
        # Add pagination
        params.extend([limit, offset])
        limit_offset = f"LIMIT ${len(params)-1} OFFSET ${len(params)}"
        
        result = await db.execute(
            f"""
            SELECT 
                e.id,
                e.element_key as logical_key,
                e.page_id,
                p.name as page,
                e.primary_selector,
                e.alt_selectors,
                e.attributes,
                e.is_active,
                e.created_at as timestamp_recorded,
                e.updated_at
            FROM repo.elements e
            JOIN repo.pages p ON e.page_id = p.id
            {where_clause}
            ORDER BY e.updated_at DESC
            {limit_offset}
            """,
            *params
        )
        
        # Convert to format expected by frontend
        elements = []
        for row in result:
            # Parse selectors - handle potential JSON strings
            primary_selector = row.get("primary_selector")
            if isinstance(primary_selector, str):
                try:
                    primary_selector = json.loads(primary_selector)
                except:
                    primary_selector = {}
            elif not primary_selector:
                primary_selector = {}
            
            alt_selectors = row.get("alt_selectors")
            if isinstance(alt_selectors, str):
                try:
                    alt_selectors = json.loads(alt_selectors)
                except:
                    alt_selectors = []
            elif not alt_selectors:
                alt_selectors = []
            
            attributes = row.get("attributes")
            if isinstance(attributes, str):
                try:
                    attributes = json.loads(attributes)
                except:
                    attributes = {}
            elif not attributes:
                attributes = {}
            
            # Extract main selectors
            css_selector = primary_selector.get("css", "") if primary_selector else ""
            xpath = primary_selector.get("xpath", "") if primary_selector else ""
            
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
            
            # Handle timestamp conversion
            timestamp_recorded = row.get("timestamp_recorded")
            if timestamp_recorded:
                try:
                    timestamp_iso = timestamp_recorded.isoformat() if hasattr(timestamp_recorded, 'isoformat') else str(timestamp_recorded)
                except:
                    timestamp_iso = None
            else:
                timestamp_iso = None
            
            elements.append({
                "id": str(row["id"]),
                "logical_key": row["logical_key"],
                "tag": attributes.get("tagName", "unknown") if attributes else "unknown",
                "text_content": attributes.get("text", "") if attributes else "",
                "text": attributes.get("text", "") if attributes else "",
                "attributes": attributes if attributes else {},
                "xpath": xpath,
                "css_selector": css_selector,
                "position_x": 0,  # Not stored in new schema
                "position_y": 0,  # Not stored in new schema
                "selectors": selectors,
                "page": row["page"],
                "timestamp_recorded": timestamp_iso,
                "is_active": row["is_active"]
            })
        
        return {
            "success": True,
            "data": elements,
            "count": len(elements)
        }
        
    except Exception as e:
        logger.error(f"Error fetching elements: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch elements: {str(e)}")

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