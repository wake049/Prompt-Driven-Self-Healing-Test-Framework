"""
Execution Dashboard API
Provides real-time execution statistics and recent test run data
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timedelta
from core.database import get_database_manager, DatabaseManager
from core.auth import get_current_active_user
from models.auth_models import CurrentUser

router = APIRouter()
logger = logging.getLogger(__name__)

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
    """Get execution statistics using proper exec.runs and exec.step_results tables with tenant filtering"""
    try:
        logger.info(f" Getting execution stats from exec.runs table for user {current_user.user.email}")
        
        # Build WHERE clause for filtering including tenant/project isolation
        where_conditions = ["r.started_at >= NOW() - INTERVAL '30 days'"]
        query_params = []
        
        # Add tenant/project filtering for multi-tenancy
        if current_user.tenant and current_user.tenant.id:
            # Filter by tenant - runs should belong to projects in this tenant
            where_conditions.append("EXISTS (SELECT 1 FROM core.projects p WHERE p.id = r.project_id AND p.tenant_id = $" + str(len(query_params) + 1) + ")")
            query_params.append(str(current_user.tenant.id))
        elif current_user.project and current_user.project.id:
            # Filter by specific project if no tenant but has project
            where_conditions.append("r.project_id = $" + str(len(query_params) + 1))
            query_params.append(str(current_user.project.id))
        
        if test_case_id:
            where_conditions.append("r.test_case_id = $" + str(len(query_params) + 1))
            query_params.append(test_case_id)
        
        if prompt_id:
            # Join with tests.test_cases to filter by source_ref_id (prompt_id)
            where_conditions.append("EXISTS (SELECT 1 FROM tests.test_cases tc WHERE tc.id = r.test_case_id AND tc.source_ref_id = $" + str(len(query_params) + 1) + ")")
            query_params.append(prompt_id)
        
        where_clause = " AND ".join(where_conditions)
        
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
        
        stats_result = await db.execute_one(stats_query, *query_params)
        
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
        
        logger.info(f" Found {total} executions, {total_steps} steps, {success_rate_percentage:.1f}% success rate")
        
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
        logger.error(f"✗ Error getting execution stats: {str(e)}")
        # Fallback to basic data if needed
        return {
            'total_executions': 0,
            'successful_executions': 0,
            'failed_executions': 0,
            'success_rate': 0.0,
            'recent_executions_24h': 0,
            'avg_execution_time': 60
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
    elementId: Optional[str] = None,
    status: Optional[str] = None,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get recent test executions using proper exec.runs table with tenant filtering and optional element filtering"""
    try:
        logger.info(f" Getting {limit} recent executions from exec.runs for user {current_user.user.email}")
        
        # Build WHERE clause for filtering including tenant/project isolation
        where_conditions = ["1=1"]  # Base condition
        query_params = []
        
        # Add tenant/project filtering for multi-tenancy
        if current_user.tenant and current_user.tenant.id:
            # Filter by tenant - runs should belong to projects in this tenant
            where_conditions.append("EXISTS (SELECT 1 FROM core.projects p WHERE p.id = r.project_id AND p.tenant_id = $" + str(len(query_params) + 1) + ")")
            query_params.append(str(current_user.tenant.id))
        elif current_user.project and current_user.project.id:
            # Filter by specific project if no tenant but has project
            where_conditions.append("r.project_id = $" + str(len(query_params) + 1))
            query_params.append(str(current_user.project.id))
        
        if test_case_id:
            where_conditions.append("r.test_case_id = $" + str(len(query_params) + 1))
            query_params.append(test_case_id)
        
        if prompt_id:
            # Join with tests.test_cases to filter by source_ref_id (prompt_id)
            where_conditions.append("EXISTS (SELECT 1 FROM tests.test_cases tc WHERE tc.id = r.test_case_id AND tc.source_ref_id = $" + str(len(query_params) + 1) + ")")
            query_params.append(prompt_id)
        
        if elementId:
            # Filter executions that have steps involving this element (by target field)
            where_conditions.append("EXISTS (SELECT 1 FROM exec.step_results sr WHERE sr.test_run_id = r.id AND sr.target LIKE $" + str(len(query_params) + 1) + ")")
            query_params.append(f"%{elementId}%")
        
        if status:
            # Filter by execution status (run-level filtering)
            if status == "failed":
                where_conditions.append("(r.status = 'failed' OR EXISTS (SELECT 1 FROM exec.step_results sr WHERE sr.test_run_id = r.id AND sr.status = 'failed'))")
            else:
                where_conditions.append("r.status = $" + str(len(query_params) + 1))
                query_params.append(status)
        
        where_clause = " AND ".join(where_conditions)
        
        # Add limit parameter
        query_params.append(limit)
        limit_param = "$" + str(len(query_params))
        
        # Get recent executions with step statistics from proper tables
        query = f"""
        SELECT 
            r.id,
            r.test_case_id,
            COALESCE(r.project_id::text, 'self-healing-framework') as project_id,
            COALESCE(r.environment_id::text, 'development') as environment_id,
            r.status as run_status,
            r.started_at,
            r.finished_at,
            r.runner_meta,
            tc.source_ref_id as prompt_id,
            p.title as prompt_title,
            p.text as prompt_description,
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
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        LEFT JOIN planner.prompts p ON tc.source_ref_id = p.id
        WHERE {where_clause}
        GROUP BY r.id, r.test_case_id, r.project_id, r.environment_id, r.status, 
                 r.started_at, r.finished_at, r.runner_meta, tc.source_ref_id, p.title, p.text
        ORDER BY r.started_at DESC
        LIMIT {limit_param}
        """
        
        results = await db.execute(query, *query_params)
        
        executions = []
        for row in results:
            total_steps = row.get('total_steps', 0)
            passed_steps = row.get('passed_steps', 0)
            failed_steps = row.get('failed_steps', 0)
            execution_id = str(row.get('id'))
            
            # Calculate step-level success rate (as percentage)
            step_success_rate_percentage = (passed_steps / total_steps * 100) if total_steps > 0 else 0
            
            execution_data = {
                'execution_id': execution_id,
                'id': execution_id,
                'prompt_id': str(row.get('prompt_id', '')),
                'test_name': row.get('prompt_title', f"Test Run {execution_id[:8]}"),
                'prompt_text': row.get('prompt_description', 'No description available'),
                'prompt_description': row.get('prompt_description', 'No description available'),
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
            
            # If this is for failure analysis (elementId or status=failed), include step details
            if elementId or status == "failed":
                try:
                    # Get step details for this execution
                    steps_query = """
                    SELECT step_order, action, target, status, error_message, created_at
                    FROM exec.step_results 
                    WHERE test_run_id = $1 
                    ORDER BY step_order ASC
                    """
                    step_results = await db.execute(steps_query, execution_id)
                    
                    execution_data['steps'] = [
                        {
                            'step_order': step.get('step_order'),
                            'action': step.get('action', 'unknown'),
                            'target': step.get('target', ''),
                            'status': step.get('status'),
                            'error_message': step.get('error_message'),
                            'created_at': step.get('created_at').isoformat() if step.get('created_at') else None
                        }
                        for step in step_results
                    ]
                    
                    # Extract failed steps specifically for AI analysis
                    failed_steps = [
                        {
                            'action': step.get('action', 'unknown'),
                            'element_type': 'css' if step.get('target', '').startswith('css=') else 'xpath' if step.get('target', '').startswith('xpath=') else 'selector',
                            'selector': step.get('target', ''),
                            'error_message': step.get('error_message', ''),
                            'step_index': step.get('step_order', 1) - 1  # Convert to 0-based index
                        }
                        for step in step_results
                        if step.get('status') == 'failed'
                    ]
                    execution_data['failed_steps'] = failed_steps
                    
                except Exception as e:
                    logger.warning(f"Failed to fetch steps for execution {execution_id}: {e}")
                    execution_data['steps'] = []
                    execution_data['failed_steps'] = []
            
            executions.append(execution_data)
        
        logger.info(f"✓ Retrieved {len(executions)} recent executions from exec.runs")
        return executions
        
    except Exception as e:
        logger.error(f"✗ Error getting recent executions: {str(e)}")
        # Return empty list rather than error for dashboard resilience
        return []

@router.get("/execution/{execution_id}/details")
async def get_execution_details_for_ui(
    execution_id: str,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get detailed execution information for the Run Details UI"""
    try:
        logger.info(f" Getting execution details for {execution_id} for user {current_user.user.email}")
        
        # Get execution details with prompt information
        execution_query = """
        SELECT 
            r.id,
            r.test_case_id,
            r.status,
            r.started_at,
            r.finished_at,
            tc.source_ref_id as prompt_id,
            p.title as prompt_title,
            p.text as prompt_description,
            CASE 
                WHEN r.finished_at IS NOT NULL AND r.started_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000
                ELSE EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - r.started_at)) * 1000
            END as duration_ms
        FROM exec.runs r
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        LEFT JOIN planner.prompts p ON tc.source_ref_id = p.id
        WHERE r.id = $1
        """
        
        query_params = [execution_id]
        
        # Add tenant/project filtering for security
        if current_user.tenant and current_user.tenant.id:
            execution_query += " AND EXISTS (SELECT 1 FROM core.projects proj WHERE proj.id = r.project_id AND proj.tenant_id = $2)"
            query_params.append(str(current_user.tenant.id))
        elif current_user.project and current_user.project.id:
            execution_query += " AND r.project_id = $2"
            query_params.append(str(current_user.project.id))
        
        execution = await db.execute_one(execution_query, *query_params)
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Get step results for this execution
        steps_query = """
        SELECT 
            step_order,
            action,
            target,
            status,
            error_message,
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
        
        steps_result = await db.execute(steps_query, execution_id, execution['started_at'])
        
        # Format steps for UI
        steps = []
        for step in steps_result:
            steps.append({
                'step_number': step['step_order'],
                'step_description': step['action'],
                'result': 'PASS' if step['status'] == 'passed' else 'FAIL',
                'details': step['error_message'] if step['error_message'] else None,
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
        
        logger.info(f"✓ Retrieved execution details for {execution_id} with {len(steps)} steps")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"✗ Error getting execution details: {str(e)}")
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
        
        logger.info(f"✓ Retrieved execution details for {execution_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"✗ Error getting execution details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get execution details: {str(e)}")

@router.get("/execution/{execution_id}/steps")
async def get_execution_steps(
    execution_id: str,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get detailed step results for a specific execution with tenant filtering"""
    try:
        logger.info(f" Getting step details for execution {execution_id} for user {current_user.user.email}")
        
        # Get execution details with tenant filtering
        execution_query = """
        SELECT 
            r.id,
            r.test_case_id,
            r.status,
            r.started_at,
            r.finished_at,
            EXTRACT(EPOCH FROM (r.finished_at - r.started_at))::INTEGER as duration_seconds
        FROM exec.runs r
        WHERE r.id = $1
        """
        
        query_params = [execution_id]
        
        # Add tenant/project filtering for security
        if current_user.tenant and current_user.tenant.id:
            execution_query += " AND EXISTS (SELECT 1 FROM core.projects p WHERE p.id = r.project_id AND p.tenant_id = $2)"
            query_params.append(str(current_user.tenant.id))
        elif current_user.project and current_user.project.id:
            execution_query += " AND r.project_id = $2"
            query_params.append(str(current_user.project.id))
        
        execution = await db.execute_one(execution_query, *query_params)
        
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Get detailed step results
        steps_query = """
        SELECT 
            step_order,
            action,
            target,
            status,
            error_message,
            created_at
        FROM exec.step_results
        WHERE test_run_id = $1
        ORDER BY step_order
        """
        
        steps = await db.execute(steps_query, execution_id)
        
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
                    'action': step['action'],
                    'target': step['target'],
                    'status': step['status'],
                    'error_message': step['error_message'],
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
        
        logger.info(f"✓ Retrieved {total_steps} steps for execution {execution_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"✗ Error getting execution steps: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get execution steps: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "execution_dashboard_api", 
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
        
        trends_data = await db.execute(trends_query)
        
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
        logger.error(f"❌ Failed to get execution trends: {str(e)}")
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
        
        failure_data = await db.execute(failure_query)
        
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
        
        action_failure_data = await db.execute(action_failure_query)
        
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
        logger.error(f"❌ Failed to get failure analysis: {str(e)}")
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
        
        performance_data = await db.execute(performance_query)
        
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
        logger.error(f"❌ Failed to get performance metrics: {str(e)}")
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
        SELECT r.id FROM exec.runs r WHERE r.id = $1
        """
        
        query_params = [execution_id]
        
        # Add tenant filtering
        if current_user.tenant and current_user.tenant.id:
            execution_check_query += " AND EXISTS (SELECT 1 FROM core.projects p WHERE p.id = r.project_id AND p.tenant_id = $2)"
            query_params.append(str(current_user.tenant.id))
        
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
        
        logger.info(f"🗑️ Deleted execution {execution_id} and all related data")
        
        return {
            "success": True,
            "execution_id": execution_id,
            "message": "Execution deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to delete execution: {str(e)}")
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
        
        if current_user.tenant and current_user.tenant.id:
            count_query += f" AND EXISTS (SELECT 1 FROM core.projects p WHERE p.id = r.project_id AND p.tenant_id = '{current_user.tenant.id}')"
        
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
        if current_user.tenant and current_user.tenant.id:
            where_clause += f" AND EXISTS (SELECT 1 FROM core.projects p WHERE p.id = project_id AND p.tenant_id = '{current_user.tenant.id}')"
        where_clause += ")"
        
        # Delete in correct order
        await db.execute(f"DELETE FROM exec.binding_usage WHERE {where_clause}")
        await db.execute(f"DELETE FROM exec.execution_summaries WHERE {where_clause}")
        await db.execute(f"DELETE FROM exec.step_results WHERE test_run_id IN (SELECT id FROM exec.runs WHERE started_at < {cutoff_date})")
        
        final_delete_query = f"DELETE FROM exec.runs WHERE started_at < {cutoff_date}"
        if current_user.tenant and current_user.tenant.id:
            final_delete_query += f" AND EXISTS (SELECT 1 FROM core.projects p WHERE p.id = project_id AND p.tenant_id = '{current_user.tenant.id}')"
        
        await db.execute(final_delete_query)
        
        logger.info(f"🧹 Cleaned up executions older than {days_to_keep} days")
        
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
        logger.error(f"❌ Failed to cleanup executions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to cleanup executions: {str(e)}")