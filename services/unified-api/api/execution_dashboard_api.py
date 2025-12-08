"""
Execution Dashboard API
Provides real-time execution statistics and recent test run data
"""

import json
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional

from datetime import datetime, timedelta
from core.database import get_database_manager, DatabaseManager
from core.auth import get_current_active_user
from models.auth_models import CurrentUser

router = APIRouter()

def safe_parse_action_data(action_data_str: str) -> Dict[str, Any]:
    """Safely parse action_data JSON string"""
    if not action_data_str:
        return {}
    try:
        return json.loads(action_data_str)
    except (json.JSONDecodeError, TypeError):
        return {}

class ExecutionStats:
    """Execution statistics for dashboard"""
    def __init__(self, data: Dict[str, Any]):
        self.total_executions = data.get('total_executions', 0)
        self.successful_executions = data.get('successful_executions', 0)
        self.failed_executions = data.get('failed_executions', 0)
        self.success_rate = data.get('success_rate', 0.0)
        self.recent_executions_24h = data.get('recent_executions_24h', 0)
        self.avg_execution_time = data.get('avg_execution_time', 0)

class ExecutionRecord:
    """Individual execution record for dashboard"""
    def __init__(self, data: Dict[str, Any]):
        self.execution_id = str(data.get('id', ''))
        self.test_name = data.get('test_name', 'Unknown Test')
        self.status = data.get('status', 'unknown')
        self.success_rate = float(data.get('success_rate', 0.0)) / 100.0  # Convert to decimal
        self.start_time = data.get('started_at', datetime.now().isoformat())
        self.duration = data.get('duration_seconds', 0)
        self.steps_completed = data.get('passed_steps', 0)
        self.total_steps = data.get('total_steps', 0)

@router.get("/stats")
async def get_execution_stats(
    prompt_id: Optional[str] = None,
    test_case_id: Optional[str] = None,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get execution statistics using proper exec.runs and exec.step_results tables with project filtering + examples"""
    try:
        # DEBUG: Log the parameters being used
        print(f"DEBUG - get_execution_stats called with prompt_id={prompt_id}, test_case_id={test_case_id}")
        print(f"DEBUG - current_user.project={current_user.project.id if current_user.project else None}")

        # Build WHERE clause for filtering - show ONLY user's current project
        where_conditions = ["r.started_at >= NOW() - INTERVAL '30 days'"]
        query_params = []
        
        if current_user.project and current_user.project.id:
            # Show ONLY user's specific project data - not the entire tenant
            where_conditions.append("EXISTS (SELECT 1 FROM tests.test_cases tc WHERE tc.id = r.test_case_id AND tc.project_id = $" + str(len(query_params) + 1) + ")")
            query_params.append(str(current_user.project.id))
        else:
            # If no project assigned, show nothing rather than everything
            where_conditions.append("1=0")  # This ensures no results if no project
        
        if test_case_id:
            where_conditions.append("r.test_case_id = $" + str(len(query_params) + 1))
            query_params.append(test_case_id)
        
        if prompt_id:
            # Additional prompt filtering
            where_conditions.append("EXISTS (SELECT 1 FROM tests.test_cases tc WHERE tc.id = r.test_case_id AND (tc.title LIKE $" + str(len(query_params) + 1) + " OR tc.plan_id = $" + str(len(query_params) + 2) + "))")
            prompt_short = prompt_id[:8]  # First 8 characters: 4b41706c
            prompt_pattern = f"%{prompt_short}%"
            query_params.extend([prompt_pattern, prompt_id])
        
        where_clause = " AND ".join(where_conditions)
        
        # DEBUG: Log the query being built
        print(f"DEBUG - where_clause: {where_clause}")
        print(f"DEBUG - query_params: {query_params}")

        # Get main execution statistics from exec.runs
        stats_query = f"""
        SELECT 
            COUNT(*) as total_executions,
            COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_executions,
            COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_executions,
            COUNT(CASE WHEN r.status = 'running' THEN 1 END) as running_executions,
            COUNT(CASE WHEN r.started_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as recent_executions_24h,
            AVG(CASE 
                WHEN r.status IN ('completed', 'failed') 
                     AND r.started_at IS NOT NULL 
                     AND r.finished_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at))
                ELSE NULL 
            END) as avg_duration_seconds
        FROM exec.runs r
        WHERE {where_clause}
        """
        
        print(f"DEBUG - Final stats query: {stats_query}")
        
        # Debug: Check what test cases exist for this prompt_id
        if prompt_id:
            # Check test cases that match our criteria
            prompt_short = prompt_id[:8] if prompt_id else ""
            matching_test_cases = await db.fetch("""
                SELECT id, title, plan_id, project_id 
                FROM tests.test_cases 
                WHERE title LIKE $1 OR plan_id = $2
            """, f'%{prompt_short}%', prompt_id)
            print(f"DEBUG - Test cases matching prompt_id {prompt_id}: {[dict(row) for row in matching_test_cases]}")
            
            # Also check all test cases
            all_test_cases = await db.fetch("""
            SELECT id, plan_id, title FROM tests.test_cases LIMIT 5
            """)
            print(f"DEBUG - All test cases in database: {[dict(row) for row in all_test_cases]}")
            
            # Check what executions exist for matching test cases
            if matching_test_cases:
                test_case_ids = [str(tc['id']) for tc in matching_test_cases]
                executions = await db.fetch("""
                    SELECT id, test_case_id, status, started_at 
                    FROM exec.runs 
                    WHERE test_case_id = ANY($1::uuid[])
                    LIMIT 5
                """, test_case_ids)
                print(f"DEBUG - Executions for matching test cases: {[dict(row) for row in executions]}")
            
        # Execute the main query first
        stats_result = await db.execute_one(stats_query, *query_params)
        print(f"DEBUG - Raw stats result from DB: {dict(stats_result) if stats_result else 'None'}")
        
        # Debug: If no results, check what's in the database
        if stats_result['total_executions'] == 0:
            # Check total runs without filtering
            total_runs = await db.execute_one("SELECT COUNT(*) as count FROM exec.runs")
            print(f"DEBUG - Total runs in database (no filtering): {total_runs['count']}")
            
            # Check what test cases exist
            if prompt_id:
                test_cases = await db.fetch("""
                    SELECT id, title, plan_id FROM tests.test_cases 
                    WHERE title LIKE $1 OR plan_id = $2
                """, f'%{prompt_id}%', prompt_id)
                print(f"DEBUG - Matching test cases: {[dict(tc) for tc in test_cases]}")
                
                if test_cases:
                    tc_id = test_cases[0]['id']
                    runs_for_tc = await db.fetch("""
                        SELECT id, project_id, status FROM exec.runs 
                        WHERE test_case_id = $1
                    """, tc_id)
                    print(f"DEBUG - Runs for test case {tc_id}: {[dict(r) for r in runs_for_tc]}")
        
        total = stats_result['total_executions'] or 0
        completed = stats_result['completed_executions'] or 0
        failed = stats_result['failed_executions'] or 0
        running = stats_result['running_executions'] or 0
        recent_24h = stats_result['recent_executions_24h'] or 0
        avg_duration = stats_result['avg_duration_seconds'] or 60
        
        # Get step-level success rate from exec.step_results with same filtering
        step_stats_query = f"""
        SELECT 
            COUNT(*) as total_steps,
            COUNT(CASE WHEN sr.status = 'passed' THEN 1 END) as passed_steps,
            COUNT(CASE WHEN sr.status = 'failed' THEN 1 END) as failed_steps
        FROM exec.step_results sr
        JOIN exec.runs r ON sr.test_run_id = r.id
        WHERE {where_clause}
        """
        
        step_result = await db.execute_one(step_stats_query, *query_params)
        total_steps = step_result['total_steps'] or 0
        passed_steps = step_result['passed_steps'] or 0
        
        # Calculate realistic success rate based on actual step results (as percentage)
        success_rate_percentage = (passed_steps / total_steps * 100) if total_steps > 0 else 0
        return {
            'total_executions': total,
            'successful_executions': completed,
            'failed_executions': failed,
            'running_executions': running,
            'success_rate': round(success_rate_percentage, 1),  # Send as percentage (66.7)
            'recent_executions_24h': recent_24h,
            'avg_execution_time': round(avg_duration, 1),
            'total_steps': total_steps,
            'passed_steps': passed_steps
        }
        
    except Exception as e:
        # Log the actual error instead of hiding it
        print(f"ERROR in get_execution_stats: {str(e)}")
        print(f"ERROR type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        # Fallback to basic data if needed
        return {
            'total_executions': 0,
            'successful_executions': 0,
            'failed_executions': 0,
            'success_rate': 0.0,
            'recent_executions_24h': 0,
            'avg_execution_time': 60,
            'error': str(e)  # Include error in response for debugging
        }

def calculate_realistic_success_rate(status: str) -> float:
    """Calculate a more realistic success rate based on execution status"""
    if status == 'completed':
        # If completed, assume some failures occurred (76.7% like your earlier tests)
        return 100.0
    elif status == 'completed_with_failures':
        return 70.0  # Lower success rate for explicit failures
    elif status == 'failed':
        return 0.0
    elif status == 'running':
        return 0.0  # In progress
    else:
        return 50.0  # Unknown status, assume partial success

@router.get("/recent")
async def get_recent_executions(
    limit: int = 20,
    prompt_id: Optional[str] = None,
    test_case_id: Optional[str] = None,
    element_id: Optional[str] = None,
    status: Optional[str] = None,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get recent test executions using proper exec.runs table with project filtering + examples for onboarding"""
    print(f"EARLY DEBUG - get_recent_executions function reached!")
    try:
        # DEBUG: Log the parameters being used
        print(f"DEBUG - get_recent_executions called with limit={limit}, prompt_id={prompt_id}, test_case_id={test_case_id}")
        print(f"DEBUG - current_user.project={current_user.project.id if current_user.project else None}")

        # Build WHERE clause for filtering - show ONLY user's current project
        where_conditions = ["1=1"]  # Base condition
        query_params = []
        
        if current_user.project and current_user.project.id:
            # Show ONLY user's specific project data - not the entire tenant
            where_conditions.append("EXISTS (SELECT 1 FROM tests.test_cases tc WHERE tc.id = r.test_case_id AND tc.project_id = $" + str(len(query_params) + 1) + ")")
            query_params.append(str(current_user.project.id))
        else:
            # If no project assigned, show nothing rather than everything
            where_conditions.append("1=0")  # This ensures no results if no project
        
        if test_case_id:
            where_conditions.append("r.test_case_id = $" + str(len(query_params) + 1))
            query_params.append(test_case_id)
        
        if prompt_id:
            # Additional prompt filtering
            where_conditions.append("EXISTS (SELECT 1 FROM tests.test_cases tc WHERE tc.id = r.test_case_id AND (tc.title LIKE $" + str(len(query_params) + 1) + " OR tc.plan_id = $" + str(len(query_params) + 2) + "))")
            prompt_short = prompt_id[:8]  # First 8 characters: 4b41706c
            prompt_pattern = f"%{prompt_short}%"
            query_params.extend([prompt_pattern, prompt_id])
        
        where_clause = " AND ".join(where_conditions)
        
        # Add limit parameter
        query_params.append(limit)
        limit_param = "$" + str(len(query_params))
        
        # DEBUG: Log the query being built
        print(f"DEBUG - where_clause: {where_clause}")
        print(f"DEBUG - query_params: {query_params}")

        # Get recent executions with step statistics from proper tables
        query = f"""
        SELECT 
            r.id,
            r.test_case_id,
            'unknown' as project_id,
            COALESCE(r.environment_info::text, 'development') as environment_id,
            r.status as run_status,
            r.started_at,
            r.finished_at,
            r.runner_meta,
            CASE 
                WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at))::INTEGER
                ELSE EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - r.started_at))::INTEGER
            END as duration_seconds,
            COUNT(sr.id) as total_steps,
            COUNT(CASE WHEN sr.status = 'passed' THEN 1 END) as passed_steps,
            COUNT(CASE WHEN sr.status = 'failed' THEN 1 END) as failed_steps
        FROM exec.runs r
        LEFT JOIN exec.step_results sr ON r.id = sr.test_run_id
        WHERE {where_clause}
        GROUP BY r.id, r.test_case_id, r.environment_info, r.status, 
                 r.started_at, r.finished_at, r.runner_meta
        ORDER BY r.started_at DESC
        LIMIT {limit_param}
        """
        
        print(f"DEBUG - Final recent executions query: {query}")
        
        results = await db.fetch(query, *query_params)
        print(f"DEBUG - Recent executions result count: {len(results)}")
        print(f"DEBUG - First row type: {type(results[0]) if results else 'No results'}")
        print(f"DEBUG - First row content: {dict(results[0]) if results else 'No results'}")
        
        executions = []
        for i, row in enumerate(results):
            print(f"DEBUG - Row {i} status: {row.get('run_status')}, total_steps: {row.get('total_steps')}, failed_steps: {row.get('failed_steps')}")
            if i < 3:  # Only log first 3 rows to avoid spam
                print(f"DEBUG - Full row {i}: {dict(row)}")
            total_steps = row.get('total_steps', 0)
            passed_steps = row.get('passed_steps', 0)
            failed_steps = row.get('failed_steps', 0)
            
            # Calculate step-level success rate (as percentage)
            step_success_rate_percentage = (passed_steps / total_steps * 100) if total_steps > 0 else 0
            
            execution_data = {
                'id': str(row.get('id')),
                'test_name': row.get('test_case_id', f"Test Run {str(row.get('id', ''))[:8]}"),
                'project': row.get('project_id', 'Unknown'),
                'environment': row.get('environment_id', 'Unknown'),
                'status': row.get('run_status'),
                'success_rate': round(step_success_rate_percentage, 1),  # Send as percentage (66.7)
                'started_at': row.get('started_at').isoformat() if row.get('started_at') else None,
                'finished_at': row.get('finished_at').isoformat() if row.get('finished_at') else None,
                'duration_seconds': row.get('duration_seconds'),
                'total_steps': total_steps,
                'passed_steps': passed_steps,
                'failed_steps': failed_steps,
                'healed_steps': 0  # TODO: Add healing tracking
            }
            
            # If this is for failure analysis (element_id or status=failed), include step details
            if element_id or status == "failed":
                try:
                    # Get step details for this execution
                    steps_query = """
                    SELECT step_order, action_data, result_data, status, error_details, created_at
                    FROM exec.step_results 
                    WHERE test_run_id = $1 
                    ORDER BY step_order ASC
                    """
                    step_results = await db.fetch(steps_query, str(row.get('id')))
                    
                    execution_data['steps'] = [
                        {
                            'step_order': step.get('step_order'),
                            'action': safe_parse_action_data(step.get('action_data', '')).get('action', 'unknown'),
                            'target': safe_parse_action_data(step.get('action_data', '')).get('locator', ''),
                            'status': step.get('status'),
                            'error_message': step.get('error_details'),
                            'created_at': step.get('created_at').isoformat() if step.get('created_at') else None
                        }
                        for step in step_results
                    ]
                    
                    # Extract failed steps specifically for AI analysis
                    failed_steps = []
                    for step in step_results:
                        if step.get('status') == 'failed':
                            action_data = safe_parse_action_data(step.get('action_data', ''))
                            locator = action_data.get('locator', '')
                            failed_steps.append({
                                'action': action_data.get('action', 'unknown'),
                                'element_type': 'css' if locator.startswith('css=') else 'xpath' if locator.startswith('xpath=') else 'selector',
                                'selector': locator,
                                'error_message': step.get('error_details', ''),
                                'step_index': step.get('step_order', 1) - 1  # Convert to 0-based index
                            })
                    execution_data['failed_steps'] = failed_steps

                except Exception as e:
                    execution_data['steps'] = []
                    execution_data['failed_steps'] = []
            
            executions.append(execution_data)
        return executions
        
    except Exception as e:
        # Log the actual error instead of hiding it
        print(f"ERROR in get_recent_executions: {str(e)}")
        print(f"ERROR type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        # Return empty list rather than error for dashboard resilience
        return []

@router.get("/execution/{execution_id}/details")
async def get_execution_details_for_ui(
    execution_id: str,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get detailed execution information for the Run Details UI"""
    try:# Get execution details with prompt information
        execution_query = """
        SELECT 
            r.id,
            r.test_case_id,
            r.status,
            r.started_at,
            r.finished_at,
            tc.plan_id as prompt_id,
            p.title as prompt_title,
            p.text as prompt_description,
            CASE 
                WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000
                ELSE EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - r.started_at)) * 1000
            END as duration_ms
        FROM exec.runs r
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        LEFT JOIN planner.prompts p ON tc.plan_id = p.id
        WHERE r.id = $1
        """
        
        query_params = [execution_id]
        
        # Add project filtering to show only user's current project data
        if current_user.project and current_user.project.id:
            execution_query += " AND tc.project_id = $2"
            query_params.append(str(current_user.project.id))
        else:
            # If no project assigned, show nothing
            execution_query += " AND 1=0"
        
        execution = await db.execute_one(execution_query, *query_params)
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Get step results for this execution
        steps_query = """
        SELECT 
            step_order,
            action_data,
            result_data,
            status,
            error_details,
            created_at,
            EXTRACT(EPOCH FROM (
                CASE 
                    WHEN created_at IS NOT NULL 
                    THEN created_at - LAG(created_at, 1, $2) OVER (ORDER BY step_order)
                    ELSE INTERVAL '0 seconds'
                END
            )) * 1000 as duration_ms
        FROM exec.step_results
        WHERE test_run_id = $1
        ORDER BY step_order
        """
        
        steps_result = await db.fetch(steps_query, execution_id, execution['started_at'])
        
        # Format steps for UI
        steps = []
        for step in steps_result:
            action_data = safe_parse_action_data(step['action_data'])
            steps.append({
                'step_number': step['step_order'],
                'step_description': action_data.get('action', 'unknown'),
                'result': 'PASS' if step['status'] == 'passed' else 'FAIL',
                'details': step['error_details'] if step['error_details'] else None,
                'duration_ms': int(step['duration_ms']) if step['duration_ms'] else None
            })
        
        # Format response for UI
        result = {
            'execution_id': f"RUN-{str(execution['id']).zfill(5)}",
            'prompt_id': execution['prompt_id'] or 'Unknown',
            'prompt_description': execution['prompt_description'] or execution['prompt_title'] or 'Verify add to cart on Amazon',
            'execution_date': execution['started_at'].isoformat() if execution['started_at'] else datetime.now().isoformat(),
            'duration_ms': int(execution['duration_ms']) if execution['duration_ms'] else 0,
            'status': 'PASS' if execution['status'] == 'completed' else 'FAIL',
            'steps': steps
        }
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get execution details: {str(e)}")

@router.get("/execution/{execution_id}")
async def get_execution_details(
    execution_id: str,
    db: DatabaseManager = Depends(get_database_manager)
):
    """Get detailed information about a specific execution"""
    try:
        # Get execution details using only known columns
        execution_query = """
        SELECT 
            tr.*,
            p.title as test_name,
            p.description as test_description,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - tr.started_at))::INTEGER as duration_seconds
        FROM exec.test_runs tr
        LEFT JOIN planner.prompts p ON tr.prompt_id = p.id
        WHERE tr.id = $1
        """
        
        execution = await db.execute_one(execution_query, [execution_id])
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Get step details from metadata for now
        steps = []
        metadata = execution.get('metadata')
        if metadata and isinstance(metadata, dict):
            steps_data = metadata.get('steps', [])
            for i, step in enumerate(steps_data):
                steps.append({
                    'step_order': i + 1,
                    'action': step.get('action', ''),
                    'target': step.get('target', ''),
                    'value': step.get('value', ''),
                    'description': step.get('description', ''),
                    'status': 'unknown'  # Would need actual step results
                })
        
        result = {
            'execution': dict(execution),
            'steps': steps,
            'summary': {
                'total_steps': len(steps),
                'passed_steps': len(steps) if execution.get('status') == 'completed' else 0,
                'failed_steps': 0,
                'healed_steps': 0,
                'duration_seconds': execution.get('duration_seconds', 0)
            }
        }
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get execution details: {str(e)}")

@router.get("/execution/{execution_id}/steps")
async def get_execution_steps(
    execution_id: str,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get detailed step results for a specific execution with tenant filtering"""
    try:# Get execution details with tenant filtering
        execution_query = """
        SELECT 
            r.id,
            r.test_case_id,
            r.status,
            r.started_at,
            r.finished_at,
            EXTRACT(EPOCH FROM (r.finished_at - r.started_at))::INTEGER as duration_seconds
        FROM exec.runs r
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        WHERE r.id = $1
        """
        
        query_params = [execution_id]
        
        # Add project filtering to show only user's current project data
        if current_user.project and current_user.project.id:
            execution_query += " AND tc.project_id = $2"
            query_params.append(str(current_user.project.id))
        else:
            # If no project assigned, show nothing
            execution_query += " AND 1=0"
        
        execution = await db.execute_one(execution_query, *query_params)
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Get detailed step results
        steps_query = """
        SELECT 
            step_order,
            action_data,
            result_data,
            status,
            error_details,
            created_at
        FROM exec.step_results
        WHERE test_run_id = $1
        ORDER BY step_order
        """
        
        steps = await db.fetch(steps_query, execution_id)
        
        # Calculate summary statistics
        total_steps = len(steps)
        passed_steps = len([s for s in steps if s['status'] == 'passed'])
        failed_steps = len([s for s in steps if s['status'] == 'failed'])
        pending_steps = len([s for s in steps if s['status'] == 'pending'])
        
        success_rate_percentage = (passed_steps / total_steps * 100) if total_steps > 0 else 0
        
        result = {
            'execution': {
                'id': str(execution['id']),
                'test_case_id': str(execution['test_case_id']),
                'status': execution['status'],
                'started_at': execution['started_at'].isoformat() if execution['started_at'] else None,
                'finished_at': execution['finished_at'].isoformat() if execution['finished_at'] else None,
                'duration_seconds': execution['duration_seconds'] or 0
            },
            'steps': [
                {
                    'step_order': step['step_order'],
                    'action': safe_parse_action_data(step['action_data']).get('action', ''),
                    'target': safe_parse_action_data(step['action_data']).get('locator', ''),
                    'description': safe_parse_action_data(step['action_data']).get('description', ''),
                    'status': step['status'],
                    'error_message': step['error_details'],
                    'created_at': step['created_at'].isoformat() if step['created_at'] else None
                }
                for step in steps
            ],
            'summary': {
                'total_steps': total_steps,
                'passed_steps': passed_steps,
                'failed_steps': failed_steps,
                'pending_steps': pending_steps,
                'success_rate': round(success_rate_percentage, 1)  # Send as percentage
            }
        }
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get execution steps: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "execution_dashboard_api", 
        "timestamp": datetime.now().isoformat()
    }

@router.get("/debug/current-user")
async def debug_current_user(
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Debug endpoint to check current user's project and tenant info"""
    return {
        "user_id": str(current_user.user.id),
        "email": current_user.user.email,
        "full_name": current_user.user.full_name,
        "tenant": {
            "id": str(current_user.tenant.id) if current_user.tenant else None,
            "name": current_user.tenant.name if current_user.tenant else None,
            "slug": current_user.tenant.slug if current_user.tenant else None,
        } if current_user.tenant else None,
        "project": {
            "id": str(current_user.project.id) if current_user.project else None,
            "name": current_user.project.name if current_user.project else None,
            "slug": current_user.project.slug if current_user.project else None,
        } if current_user.project else None
    }

@router.get("/debug/database-counts")
async def debug_database_counts(
    db: DatabaseManager = Depends(get_database_manager)
):
    """Debug endpoint to check what data exists in the database"""
    try:
        # Check counts in all relevant tables
        tables_to_check = [
            "exec.runs",
            "exec.step_results", 
            "tests.test_cases",
            "planner.prompts",
            "core.projects",
            "plans"
        ]
        
        results = {}
        
        for table in tables_to_check:
            try:
                count_result = await db.execute_one(f"SELECT COUNT(*) as count FROM {table}")
                results[table] = count_result['count']
            except Exception as e:
                results[table] = f"Error: {str(e)}"
        
        # Also check for prompt relationships (using plan_id instead of source_ref_id)
        try:
            prompt_test_cases = await db.fetch("""
            SELECT 
                p.id as prompt_id,
                p.title as prompt_title,
                tc.id as test_case_id,
                tc.plan_id,
                tc.title as test_case_title
            FROM planner.prompts p
            LEFT JOIN tests.test_cases tc ON p.id = tc.plan_id
            LIMIT 5
            """)
            results['sample_prompt_test_case_relationships'] = list(prompt_test_cases)
        except Exception as e:
            results['sample_prompt_test_case_relationships'] = f"Error: {str(e)}"
        
        # Check the plans table and its relationship to prompts
        try:
            plans_data = await db.fetch("""
            SELECT 
                pl.id as plan_id,
                pl.title as plan_title,
                pr.id as prompt_id,
                pr.title as prompt_title
            FROM plans pl
            LEFT JOIN planner.prompts pr ON pl.prompt_id = pr.id
            LIMIT 5
            """)
            results['plans_to_prompts'] = list(plans_data)
        except Exception as e:
            # Maybe the relationship field is different
            try:
                plans_simple = await db.fetch("SELECT id, title FROM plans LIMIT 5")
                results['plans_simple'] = list(plans_simple)
            except Exception as e2:
                results['plans_to_prompts'] = f"Error: {str(e)} - {str(e2)}"
        
        # Check for recent runs
        try:
            recent_runs = await db.fetch("""
            SELECT 
                r.id as run_id,
                r.test_case_id,
                r.status,
                r.started_at,
                tc.plan_id as prompt_id,
                tc.title as test_case_title
            FROM exec.runs r
            LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
            ORDER BY r.started_at DESC
            LIMIT 5
            """)
            results['sample_recent_runs'] = list(recent_runs)
        except Exception as e:
            results['sample_recent_runs'] = f"Error: {str(e)}"
        
        return {
            "debug_info": results,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {
            "error": f"Failed to get debug info: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }

# M7 SCRUM-15: Enhanced Dashboard APIs
@router.get("/trends")
async def get_execution_trends(
    days: int = 30,
    db: DatabaseManager = Depends(get_database_manager)
):
    """Get execution trends over time for dashboard charts"""
    try:
        # Build query without tenant filtering for testing
        trends_query = """
        SELECT 
            DATE(r.started_at) as execution_date,
            COUNT(*) as total_executions,
            COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_executions,
            COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_executions,
            AVG(CASE 
                WHEN r.status IN ('completed', 'failed') 
                     AND r.started_at IS NOT NULL 
                     AND r.finished_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at))
                ELSE NULL 
            END) as avg_duration_seconds,
            COUNT(DISTINCT r.test_case_id) as unique_tests_run
        FROM exec.runs r
        WHERE r.started_at >= CURRENT_TIMESTAMP - INTERVAL '{} days'
        GROUP BY DATE(r.started_at)
        ORDER BY execution_date DESC
        LIMIT 30
        """.format(days)
        
        trends_data = await db.fetch(trends_query)
        
        # Process trends data
        trends = []
        for row in trends_data:
            success_rate = (row['completed_executions'] / max(row['total_executions'], 1)) * 100
            trends.append({
                "date": row['execution_date'].isoformat(),
                "total_executions": row['total_executions'],
                "completed_executions": row['completed_executions'],
                "failed_executions": row['failed_executions'],
                "success_rate": round(success_rate, 1),
                "avg_duration_seconds": round(row['avg_duration_seconds'] or 0, 1),
                "unique_tests_run": row['unique_tests_run']
            })
        
        return {
            "period_days": days,
            "trends": trends,
            "total_data_points": len(trends)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get execution trends: {str(e)}")

@router.get("/failure-analysis")
async def get_failure_analysis(
    days: int = 30,
    limit: int = 10,
    db: DatabaseManager = Depends(get_database_manager)
):
    """Get detailed failure analysis for troubleshooting"""
    try:
        # Get most common failure patterns
        failure_query = """
        SELECT 
            sr.error_message,
            sr.action,
            COUNT(*) as failure_count,
            COUNT(DISTINCT sr.test_run_id) as affected_executions,
            AVG(sr.step_order) as avg_step_order,
            MIN(sr.created_at) as first_seen,
            MAX(sr.created_at) as last_seen
        FROM exec.step_results sr
        JOIN exec.runs r ON sr.test_run_id = r.id
        WHERE sr.status = 'failed' 
        AND sr.error_message IS NOT NULL
        AND sr.created_at >= CURRENT_TIMESTAMP - INTERVAL '{} days'
        GROUP BY sr.error_message, sr.action
        ORDER BY failure_count DESC, affected_executions DESC
        LIMIT {}
        """.format(days, limit)
        
        failure_data = await db.fetch(failure_query)
        
        # Get failure trends by action type
        action_failure_query = """
        SELECT 
            sr.action,
            COUNT(*) as total_attempts,
            COUNT(CASE WHEN sr.status = 'failed' THEN 1 END) as failures,
            (COUNT(CASE WHEN sr.status = 'failed' THEN 1 END)::float / COUNT(*) * 100) as failure_rate
        FROM exec.step_results sr
        JOIN exec.runs r ON sr.test_run_id = r.id
        WHERE sr.created_at >= CURRENT_TIMESTAMP - INTERVAL '{} days'
        GROUP BY sr.action
        HAVING COUNT(*) >= 5
        ORDER BY failure_rate DESC, failures DESC
        """.format(days)
        
        action_failure_data = await db.fetch(action_failure_query)
        
        # Process results
        failure_patterns = []
        for failure in failure_data:
            failure_patterns.append({
                "error_message": failure['error_message'],
                "action": failure['action'],
                "failure_count": failure['failure_count'],
                "affected_executions": failure['affected_executions'],
                "avg_step_order": round(failure['avg_step_order'] or 0, 1),
                "first_seen": failure['first_seen'].isoformat() if failure['first_seen'] else None,
                "last_seen": failure['last_seen'].isoformat() if failure['last_seen'] else None
            })
        
        action_failure_rates = []
        for action in action_failure_data:
            action_failure_rates.append({
                "action": action['action'],
                "total_attempts": action['total_attempts'],
                "failures": action['failures'],
                "failure_rate": round(action['failure_rate'], 2)
            })
        
        return {
            "period_days": days,
            "failure_patterns": failure_patterns,
            "action_failure_rates": action_failure_rates,
            "analysis_summary": {
                "total_failure_patterns": len(failure_patterns),
                "total_actions_analyzed": len(action_failure_rates),
                "highest_failure_rate": max([a['failure_rate'] for a in action_failure_rates], default=0)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get failure analysis: {str(e)}")

@router.get("/performance-metrics")
async def get_performance_metrics(
    days: int = 7,
    db: DatabaseManager = Depends(get_database_manager)
):
    """Get detailed performance metrics for dashboard"""
    try:
        # Get performance metrics by action type (simplified without window functions in aggregates)
        performance_query = """
        WITH step_durations AS (
            SELECT 
                sr.action,
                sr.test_run_id,
                sr.step_order,
                sr.created_at,
                r.started_at as run_start,
                EXTRACT(EPOCH FROM (sr.created_at - 
                    LAG(sr.created_at, 1, r.started_at) OVER (
                        PARTITION BY sr.test_run_id ORDER BY sr.step_order
                    )
                )) as step_duration
            FROM exec.step_results sr
            JOIN exec.runs r ON sr.test_run_id = r.id
            WHERE sr.created_at >= CURRENT_TIMESTAMP - INTERVAL '{} days'
            AND sr.status IN ('passed', 'failed')
        )
        SELECT 
            action,
            COUNT(*) as total_steps,
            AVG(step_duration) as avg_step_duration,
            MIN(step_duration) as min_step_duration,
            MAX(step_duration) as max_step_duration,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY step_duration) as median_step_duration
        FROM step_durations
        WHERE step_duration IS NOT NULL
        GROUP BY action
        HAVING COUNT(*) >= 3
        ORDER BY avg_step_duration DESC
        """.format(days)
        
        performance_data = await db.fetch(performance_query)
        
        # Get overall execution performance
        exec_performance_query = """
        SELECT 
            COUNT(*) as total_executions,
            AVG(EXTRACT(EPOCH FROM (r.finished_at - r.started_at))) as avg_execution_duration,
            MIN(EXTRACT(EPOCH FROM (r.finished_at - r.started_at))) as fastest_execution,
            MAX(EXTRACT(EPOCH FROM (r.finished_at - r.started_at))) as slowest_execution,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.finished_at - r.started_at))) as median_execution_duration,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (r.finished_at - r.started_at))) as p95_execution_duration
        FROM exec.runs r
        WHERE r.finished_at IS NOT NULL
        AND r.started_at >= CURRENT_TIMESTAMP - INTERVAL '{} days'
        """.format(days)
        
        exec_performance = await db.execute_one(exec_performance_query)
        
        # Process results
        action_performance = []
        for perf in performance_data:
            action_performance.append({
                "action": perf['action'],
                "total_steps": perf['total_steps'],
                "avg_duration": round(perf['avg_step_duration'] or 0, 2),
                "min_duration": round(perf['min_step_duration'] or 0, 2),
                "max_duration": round(perf['max_step_duration'] or 0, 2),
                "median_duration": round(perf['median_step_duration'] or 0, 2)
            })
        
        execution_performance = {
            "total_executions": exec_performance['total_executions'],
            "avg_duration": round(exec_performance['avg_execution_duration'] or 0, 2),
            "fastest_execution": round(exec_performance['fastest_execution'] or 0, 2),
            "slowest_execution": round(exec_performance['slowest_execution'] or 0, 2),
            "median_duration": round(exec_performance['median_execution_duration'] or 0, 2),
            "p95_duration": round(exec_performance['p95_execution_duration'] or 0, 2)
        }
        
        return {
            "period_days": days,
            "execution_performance": execution_performance,
            "action_performance": action_performance,
            "performance_insights": {
                "slowest_action": max(action_performance, key=lambda x: x['avg_duration'], default={}).get('action'),
                "fastest_action": min(action_performance, key=lambda x: x['avg_duration'], default={}).get('action'),
                "total_actions_analyzed": len(action_performance)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get performance metrics: {str(e)}")

@router.delete("/execution/{execution_id}")
async def delete_execution(
    execution_id: str,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Delete an execution and all its related data - ADMIN ONLY"""
    try:
        # SAFETY: Validate admin permissions before deletion
        from core.delete_protection import DatabaseDeleteProtection
        await DatabaseDeleteProtection.validate_delete_permission(
            str(current_user.user.id), 
            f"delete execution {execution_id}"
        )
        
        # Verify execution exists and user has access
        execution_check_query = """
        SELECT r.id FROM exec.runs r 
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        WHERE r.id = $1
        """
        
        query_params = [execution_id]
        
        # Add project filtering to show only user's current project data
        if current_user.project and current_user.project.id:
            execution_check_query += " AND tc.project_id = $2"
            query_params.append(str(current_user.project.id))
        else:
            # If no project assigned, show nothing
            execution_check_query += " AND 1=0"
        
        execution = await db.execute_one(execution_check_query, *query_params)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Delete in correct order due to foreign key constraints
        # 1. Delete binding usage records
        await db.execute("DELETE FROM exec.binding_usage WHERE execution_id = $1", execution_id)
        
        # 2. Delete execution summaries
        await db.execute("DELETE FROM exec.execution_summaries WHERE execution_id = $1", execution_id)
        
        # 3. Delete step results
        await db.execute("DELETE FROM exec.step_results WHERE test_run_id = $1", execution_id)
        
        # 4. Delete the execution record
        await db.execute("DELETE FROM exec.runs WHERE id = $1", execution_id)
        return {
            "success": True,
            "execution_id": execution_id,
            "message": "Execution deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete execution: {str(e)}")

@router.post("/cleanup")
async def cleanup_old_executions(
    days_to_keep: int = 90,
    dry_run: bool = True,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Clean up old execution records to manage database size"""
    try:
        # Only allow cleanup for admin users
        if not current_user.user.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required for cleanup operations")
        
        cutoff_date = f"NOW() - INTERVAL '{days_to_keep} days'"
        
        # Get count of records to be deleted
        count_query = f"""
        SELECT 
            COUNT(DISTINCT r.id) as executions_to_delete,
            COUNT(sr.id) as step_results_to_delete,
            COUNT(bu.id) as binding_usages_to_delete,
            COUNT(es.id) as summaries_to_delete
        FROM exec.runs r
        LEFT JOIN exec.step_results sr ON r.id = sr.test_run_id
        LEFT JOIN exec.binding_usage bu ON r.id = bu.execution_id
        LEFT JOIN exec.execution_summaries es ON r.id = es.execution_id
        WHERE r.started_at < {cutoff_date}
        """
        
        if current_user.project and current_user.project.id:
            count_query += f" AND EXISTS (SELECT 1 FROM tests.test_cases tc WHERE tc.id = r.test_case_id AND tc.project_id = '{current_user.project.id}')"
        
        counts = await db.execute_one(count_query)
        
        if dry_run:
            return {
                "dry_run": True,
                "days_to_keep": days_to_keep,
                "records_to_delete": {
                    "executions": counts['executions_to_delete'],
                    "step_results": counts['step_results_to_delete'],
                    "binding_usages": counts['binding_usages_to_delete'],
                    "summaries": counts['summaries_to_delete']
                },
                "message": "This is a dry run. No records were deleted. Set dry_run=false to perform actual cleanup."
            }
        
        # Perform actual cleanup
        where_clause = f"execution_id IN (SELECT id FROM exec.runs WHERE started_at < {cutoff_date}"
        if current_user.project and current_user.project.id:
            where_clause += f" AND EXISTS (SELECT 1 FROM tests.test_cases tc WHERE tc.id = test_case_id AND tc.project_id = '{current_user.project.id}')"
        where_clause += ")"
        
        # Delete in correct order
        await db.execute(f"DELETE FROM exec.binding_usage WHERE {where_clause}")
        await db.execute(f"DELETE FROM exec.execution_summaries WHERE {where_clause}")
        await db.execute(f"DELETE FROM exec.step_results WHERE test_run_id IN (SELECT id FROM exec.runs WHERE started_at < {cutoff_date})")
        
        final_delete_query = f"DELETE FROM exec.runs WHERE started_at < {cutoff_date}"
        if current_user.project and current_user.project.id:
            final_delete_query += f" AND EXISTS (SELECT 1 FROM tests.test_cases tc WHERE tc.id = test_case_id AND tc.project_id = '{current_user.project.id}')"
        
        await db.execute(final_delete_query)
        return {
            "success": True,
            "dry_run": False,
            "days_to_keep": days_to_keep,
            "records_deleted": {
                "executions": counts['executions_to_delete'],
                "step_results": counts['step_results_to_delete'],
                "binding_usages": counts['binding_usages_to_delete'],
                "summaries": counts['summaries_to_delete']
            },
            "message": f"Successfully cleaned up {counts['executions_to_delete']} old executions"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup executions: {str(e)}")
