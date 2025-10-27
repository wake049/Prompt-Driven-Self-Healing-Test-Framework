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
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get recent test executions using proper exec.runs table with tenant filtering"""
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
        GROUP BY r.id, r.test_case_id, r.project_id, r.environment_id, r.status, 
                 r.started_at, r.finished_at, r.runner_meta
        ORDER BY r.started_at DESC
        LIMIT {limit_param}
        """
        
        results = await db.execute(query, *query_params)
        
        executions = []
        for row in results:
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
            executions.append(execution_data)
        
        logger.info(f"✓ Retrieved {len(executions)} recent executions from exec.runs")
        return executions
        
    except Exception as e:
        logger.error(f"✗ Error getting recent executions: {str(e)}")
        # Return empty list rather than error for dashboard resilience
        return []

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