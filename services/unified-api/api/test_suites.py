"""
Test Suites API - Organize tests with browser configurations
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import json
import uuid

from core.database import get_database, DatabaseManager
from core.auth import get_current_active_user, get_optional_current_user
from models.auth_models import CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/suites", response_model=Dict[str, Any])
async def get_test_suites(
    project_id: Optional[str] = None,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Get all test suites for a project"""
    try:
        # Get project ID from user or use default
        if not project_id:
            if current_user and current_user.project:
                project_id = str(current_user.project.id)
            else:
                # Get first active project
                project_result = await db.execute_one(
                    "SELECT id FROM core.projects WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
                )
                if not project_result:
                    return {"success": True, "data": [], "message": "No projects found"}
                project_id = str(project_result['id'])
        
        query = """
        SELECT 
            s.id,
            s.project_id,
            s.name,
            s.description,
            s.browser_config,
            s.is_active,
            s.created_at,
            s.updated_at,
            COUNT(tc.id) as test_count
        FROM tests.test_suites s
        LEFT JOIN tests.test_cases tc ON tc.suite_id = s.id
        WHERE s.project_id = $1
        GROUP BY s.id, s.project_id, s.name, s.description, s.browser_config, s.is_active, s.created_at, s.updated_at
        ORDER BY s.created_at DESC
        """
        
        results = await db.fetch(query, project_id)
        
        suites = []
        for row in results:
            suite_dict = dict(row)
            suite_dict['id'] = str(suite_dict['id'])
            suite_dict['project_id'] = str(suite_dict['project_id'])
            suites.append(suite_dict)
        
        return {
            "success": True,
            "data": suites,
            "count": len(suites)
        }
        
    except Exception as e:
        logger.error(f"Error fetching test suites: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suites", response_model=Dict[str, Any])
async def create_test_suite(
    suite_data: Dict[str, Any],
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Create a new test suite"""
    try:
        # Get project ID
        project_id = suite_data.get('project_id')
        if not project_id:
            if current_user and current_user.project:
                project_id = str(current_user.project.id)
            else:
                project_result = await db.execute_one(
                    "SELECT id FROM core.projects WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
                )
                if not project_result:
                    raise HTTPException(status_code=400, detail="No project found")
                project_id = str(project_result['id'])
        
        # Get user ID
        created_by = None
        if current_user:
            created_by = str(current_user.user.id)
        else:
            user_result = await db.execute_one(
                "SELECT id FROM core.users WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
            )
            if user_result:
                created_by = str(user_result['id'])
        
        # Default browser config if not provided
        browser_config = suite_data.get('browser_config', {"browsers": ["chrome"]})
        
        query = """
        INSERT INTO tests.test_suites (
            project_id,
            name,
            description,
            browser_config,
            is_active,
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, description, browser_config, is_active, created_at
        """
        
        result = await db.execute_one(
            query,
            project_id,
            suite_data.get('name'),
            suite_data.get('description', ''),
            json.dumps(browser_config),
            suite_data.get('is_active', True),
            created_by
        )
        
        suite = dict(result)
        suite['id'] = str(suite['id'])
        
        return {
            "success": True,
            "data": suite,
            "message": "Test suite created successfully"
        }
        
    except Exception as e:
        logger.error(f"Error creating test suite: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/suites/{suite_id}", response_model=Dict[str, Any])
async def update_test_suite(
    suite_id: str,
    suite_data: Dict[str, Any],
    db: DatabaseManager = Depends(get_database)
):
    """Update a test suite"""
    try:
        # Build update query dynamically based on provided fields
        update_fields = []
        params = []
        param_count = 1
        
        if 'name' in suite_data:
            update_fields.append(f"name = ${param_count}")
            params.append(suite_data['name'])
            param_count += 1
        
        if 'description' in suite_data:
            update_fields.append(f"description = ${param_count}")
            params.append(suite_data['description'])
            param_count += 1
        
        if 'browser_config' in suite_data:
            update_fields.append(f"browser_config = ${param_count}")
            params.append(json.dumps(suite_data['browser_config']))
            param_count += 1
        
        if 'is_active' in suite_data:
            update_fields.append(f"is_active = ${param_count}")
            params.append(suite_data['is_active'])
            param_count += 1
        
        update_fields.append("updated_at = NOW()")
        params.append(suite_id)
        
        query = f"""
        UPDATE tests.test_suites
        SET {', '.join(update_fields)}
        WHERE id = ${param_count}
        RETURNING id, name, description, browser_config, is_active, updated_at
        """
        
        result = await db.execute_one(query, *params)
        
        if not result:
            raise HTTPException(status_code=404, detail="Test suite not found")
        
        suite = dict(result)
        suite['id'] = str(suite['id'])
        
        return {
            "success": True,
            "data": suite,
            "message": "Test suite updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating test suite: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/suites/{suite_id}", response_model=Dict[str, Any])
async def delete_test_suite(
    suite_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """Delete a test suite"""
    try:
        query = "DELETE FROM tests.test_suites WHERE id = $1"
        await db.execute_command(query, suite_id)
        
        return {
            "success": True,
            "message": "Test suite deleted successfully"
        }
        
    except Exception as e:
        logger.error(f"Error deleting test suite: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suites/{suite_id}/add-test/{test_id}", response_model=Dict[str, Any])
async def add_test_to_suite(
    suite_id: str,
    test_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """Add a test/prompt to a suite.

    The incoming ``test_id`` may be either:
    - a real tests.test_cases.id, or
    - a prompt_id from planner.prompts

    If no test_case exists for the prompt, we create one to link it to the suite.
    """
    try:
        # 1) First, try direct match on tests.test_cases.id
        direct_update_query = """
        UPDATE tests.test_cases
        SET suite_id = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, title, suite_id
        """

        result = await db.execute_one(direct_update_query, suite_id, test_id)

        if result:
            return {
                "success": True,
                "message": "Test added to suite successfully"
            }

        # 2) If no direct match, treat test_id as a prompt_id
        # First verify the prompt exists
        prompt_query = """
        SELECT id, text, project_id FROM planner.prompts WHERE id = $1
        """
        prompt_result = await db.execute_one(prompt_query, test_id)
        
        if not prompt_result:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        # 3) Check if a test_case already exists for this prompt (via plan)
        lookup_query = """
        SELECT tc.id
        FROM tests.test_cases tc
        JOIN planner.plans pl ON tc.plan_id = pl.id
        WHERE pl.prompt_id = $1
        ORDER BY tc.created_at DESC
        LIMIT 1
        """
        
        lookup_result = await db.execute_one(lookup_query, test_id)
        
        if lookup_result:
            # Found existing test_case, attach it to suite
            update_result = await db.execute_one(
                direct_update_query, suite_id, lookup_result['id']
            )
            if update_result:
                return {
                    "success": True,
                    "message": "Test added to suite successfully"
                }

        # 4) Also check by derived UUID
        derived_uuid = uuid.uuid5(uuid.NAMESPACE_URL, f"prompt:{test_id}")
        
        existing_derived = await db.execute_one(
            "SELECT id FROM tests.test_cases WHERE id = $1", derived_uuid
        )
        
        if existing_derived:
            await db.execute_one(direct_update_query, suite_id, derived_uuid)
            return {
                "success": True,
                "message": "Test added to suite successfully"
            }

        # 5) No test_case exists - create one for this prompt
        # Get project_id from the prompt or the suite
        project_id = prompt_result.get('project_id')
        if not project_id:
            # Get project from suite
            suite_query = "SELECT project_id FROM tests.test_suites WHERE id = $1"
            suite_result = await db.execute_one(suite_query, suite_id)
            if suite_result:
                project_id = suite_result['project_id']
            else:
                # Fallback to first active project
                project_query = "SELECT id FROM core.projects WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
                project_result = await db.execute_one(project_query)
                if project_result:
                    project_id = project_result['id']
                else:
                    raise HTTPException(status_code=400, detail="No project found")

        # Get plan_id if one exists for this prompt
        plan_query = "SELECT id FROM planner.plans WHERE prompt_id = $1 ORDER BY created_at DESC LIMIT 1"
        plan_result = await db.execute_one(plan_query, test_id)
        plan_id = plan_result['id'] if plan_result else None

        # Extract title from prompt text (first line)
        prompt_text = prompt_result.get('text', '')
        title = prompt_text.split('\n')[0][:100] if prompt_text else f"Test: {test_id[:8]}"

        # Create the test_case record
        insert_query = """
        INSERT INTO tests.test_cases (id, project_id, plan_id, title, description, suite_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, title, suite_id
        """
        
        new_test_case = await db.execute_one(
            insert_query,
            derived_uuid,
            project_id,
            plan_id,
            title,
            f"Test case for prompt {test_id}",
            suite_id
        )
        
        if new_test_case:
            return {
                "success": True,
                "message": "Test added to suite successfully"
            }
        
        raise HTTPException(status_code=500, detail="Failed to create test case")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding test to suite: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/suites/{suite_id}/remove-test/{test_id}", response_model=Dict[str, Any])
@router.post("/suites/{suite_id}/remove-test/{test_id}", response_model=Dict[str, Any])
async def remove_test_from_suite(
    suite_id: str,
    test_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """Remove a test case from a suite. Accepts test_case_id or prompt_id."""
    try:
        query = """
        UPDATE tests.test_cases
        SET suite_id = NULL, updated_at = NOW()
        WHERE id = $1 AND suite_id = $2
        RETURNING id, title
        """
        
        # Try direct match first
        result = await db.execute_one(query, test_id, suite_id)
        
        if result:
            return {
                "success": True,
                "message": "Test removed from suite successfully"
            }
        
        # Try derived UUID from prompt_id
        derived_uuid = uuid.uuid5(uuid.NAMESPACE_URL, f"prompt:{test_id}")
        result = await db.execute_one(query, derived_uuid, suite_id)
        
        if result:
            return {
                "success": True,
                "message": "Test removed from suite successfully"
            }
        
        raise HTTPException(status_code=404, detail="Test not found in this suite")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing test from suite: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suites/{suite_id}/tests", response_model=Dict[str, Any])
async def get_suite_tests(
    suite_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """Get all test cases in a suite with step counts and average durations"""
    try:
        # Join with plans to get step count from plan_json, and with exec.runs for avg duration
        # Also join with prompts to get external_id if available
        query = """
        SELECT 
            tc.id, 
            tc.title, 
            tc.description, 
            tc.plan_id,
            tc.browser_config,
            tc.is_active,
            tc.created_at,
            tc.updated_at,
            COALESCE(tc.external_id, p.external_id) as external_id,
            COALESCE(jsonb_array_length(pl.plan_json->'actions'), 0) as step_count,
            pl.plan_json->'meta'->>'prompt' as prompt_text,
            COALESCE(
                AVG(EXTRACT(EPOCH FROM (r.finished_at - r.started_at))) 
                FILTER (WHERE r.finished_at IS NOT NULL AND r.started_at IS NOT NULL),
                0
            ) as avg_duration_seconds,
            COUNT(r.id) FILTER (WHERE r.finished_at IS NOT NULL) as completed_runs
        FROM tests.test_cases tc
        LEFT JOIN planner.plans pl ON tc.plan_id = pl.id
        LEFT JOIN planner.prompts p ON pl.prompt_id = p.id
        LEFT JOIN exec.runs r ON r.test_case_id = tc.id
        WHERE tc.suite_id = $1
        GROUP BY tc.id, tc.title, tc.description, tc.plan_id, tc.browser_config, 
                 tc.is_active, tc.created_at, tc.updated_at, tc.external_id, p.external_id, pl.plan_json
        ORDER BY tc.created_at DESC
        """
        
        results = await db.fetch(query, suite_id)
        
        tests = []
        total_estimated_seconds = 0
        
        for row in results:
            test_dict = dict(row)
            test_dict['id'] = str(test_dict['id'])
            if test_dict.get('plan_id'):
                test_dict['plan_id'] = str(test_dict['plan_id'])
            # Ensure step_count is an int
            test_dict['step_count'] = int(test_dict.get('step_count') or 0)
            # Round avg duration to 1 decimal
            avg_duration = float(test_dict.get('avg_duration_seconds') or 0)
            test_dict['avg_duration_seconds'] = round(avg_duration, 1)
            test_dict['completed_runs'] = int(test_dict.get('completed_runs') or 0)
            
            # Add to total estimate
            total_estimated_seconds += avg_duration
            
            tests.append(test_dict)
        
        return {
            "success": True,
            "data": tests,
            "count": len(tests),
            "total_estimated_seconds": round(total_estimated_seconds, 1)
        }
        
    except Exception as e:
        logger.error(f"Error fetching suite tests: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suites/{suite_id}/executions", response_model=Dict[str, Any])
async def get_suite_executions(
    suite_id: str,
    limit: int = 50,
    db: DatabaseManager = Depends(get_database)
):
    """Get execution history for all tests in a suite"""
    try:
        query = """
        SELECT 
            r.id as run_id,
            r.test_case_id,
            tc.title as test_name,
            r.status,
            COALESCE(r.browser_type, 'chrome') as browser_type,
            COALESCE(r.total_steps, 0) as total_steps,
            COALESCE(r.passed_steps, 0) as passed_steps,
            COALESCE(r.failed_steps, 0) as failed_steps,
            COALESCE(r.pending_review_steps, 0) as pending_review_steps,
            r.screenshot_url,
            r.started_at,
            r.completed_at,
            r.error_message
        FROM exec.runs r
        JOIN tests.test_cases tc ON r.test_case_id = tc.id
        WHERE tc.suite_id::text = $1
        ORDER BY r.started_at DESC
        LIMIT $2
        """
        
        results = await db.fetch(query, suite_id, limit)
        
        executions = []
        for row in results:
            exec_dict = dict(row)
            exec_dict['run_id'] = str(exec_dict['run_id'])
            exec_dict['test_case_id'] = str(exec_dict['test_case_id'])
            executions.append(exec_dict)
        
        return {
            "success": True,
            "data": executions,
            "count": len(executions)
        }
        
    except Exception as e:
        logger.error(f"Error fetching suite executions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suites/{suite_id}/execute", response_model=Dict[str, Any])
async def execute_test_suite(
    suite_id: str,
    override_browsers: Optional[List[str]] = None,
    db: DatabaseManager = Depends(get_database)
):
    """Execute all tests in a suite with the suite's browser configuration"""
    try:
        # Get suite details
        suite_query = """
        SELECT id, name, browser_config
        FROM tests.test_suites
        WHERE id = $1 AND is_active = true
        """
        suite = await db.execute_one(suite_query, suite_id)
        
        if not suite:
            raise HTTPException(status_code=404, detail="Test suite not found or inactive")
        
        # Get browsers to run (override or from suite config)
        browser_config = json.loads(suite['browser_config']) if isinstance(suite['browser_config'], str) else suite['browser_config']
        browsers = override_browsers if override_browsers else browser_config.get('browsers', ['chrome'])
        
        # Get all test cases in the suite
        tests_query = """
        SELECT id, title FROM tests.test_cases
        WHERE suite_id = $1 AND is_active = true
        """
        test_cases = await db.fetch(tests_query, suite_id)
        
        if not test_cases:
            return {
                "success": False,
                "message": "No active test cases found in suite"
            }
        
        return {
            "success": True,
            "message": f"Suite execution would start {len(test_cases)} tests on {len(browsers)} browsers",
            "suite_id": str(suite['id']),
            "suite_name": suite['name'],
            "browsers": browsers,
            "test_count": len(test_cases),
            "note": "Full suite execution to be implemented"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing test suite: {e}")
        raise HTTPException(status_code=500, detail=str(e))
