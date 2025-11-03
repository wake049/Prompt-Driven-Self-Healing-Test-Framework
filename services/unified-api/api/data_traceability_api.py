"""
Data Resolver Traceability API
SCRUM-16: Connect Data Resolver with stored runs for traceability
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
import json
from core.database import get_database_manager, DatabaseManager
from core.auth import get_current_active_user
from models.auth_models import CurrentUser
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

class BindingUsageRecord(BaseModel):
    execution_id: str
    binding_id: str
    binding_name: str
    binding_value: Any
    usage_context: Dict[str, Any]
    step_order: Optional[int] = None
    action_type: Optional[str] = None

class BindingTraceabilityRequest(BaseModel):
    execution_id: str
    bindings_used: List[Dict[str, Any]]

class BindingUsageResponse(BaseModel):
    execution_id: str
    bindings_count: int
    bindings_used: List[Dict[str, Any]]
    recorded_at: datetime

@router.post("/execution/{execution_id}/record-binding-usage")
async def record_binding_usage(
    execution_id: str,
    request: BindingTraceabilityRequest,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Record which data bindings were used during a test execution.
    This creates a traceability link between data resolver bindings and test runs.
    """
    try:
        logger.info(f"🔗 Recording binding usage for execution {execution_id}")
        
        # Verify execution exists and user has access
        execution_check_query = """
        SELECT r.id, r.status 
        FROM exec.runs r
        WHERE r.id = $1
        """
        
        query_params = [execution_id]
        
        # Add tenant filtering for security
        if current_user.tenant and current_user.tenant.id:
            execution_check_query += " AND EXISTS (SELECT 1 FROM core.projects p WHERE p.id = r.project_id AND p.tenant_id = $2)"
            query_params.append(str(current_user.tenant.id))
        
        execution = await db.execute_one(execution_check_query, *query_params)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Create the binding usage tracking table if it doesn't exist
        create_table_query = """
        CREATE TABLE IF NOT EXISTS exec.binding_usage (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            execution_id UUID NOT NULL REFERENCES exec.runs(id) ON DELETE CASCADE,
            binding_name VARCHAR(255) NOT NULL,
            binding_scope VARCHAR(255),
            binding_value JSONB,
            usage_context JSONB,
            step_order INTEGER,
            action_type VARCHAR(100),
            recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by UUID REFERENCES core.users(id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_binding_usage_execution 
        ON exec.binding_usage(execution_id);
        
        CREATE INDEX IF NOT EXISTS idx_binding_usage_binding_name 
        ON exec.binding_usage(binding_name);
        """
        await db.execute(create_table_query)
        
        # Record each binding usage
        recorded_count = 0
        for binding_info in request.bindings_used:
            binding_usage_query = """
            INSERT INTO exec.binding_usage 
            (execution_id, binding_name, binding_scope, binding_value, usage_context, step_order, action_type, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """
            
            await db.execute(
                binding_usage_query,
                execution_id,
                binding_info.get('name', 'unknown'),
                binding_info.get('scope', f"prompt_{execution_id}"),
                json.dumps(binding_info.get('value')),
                json.dumps(binding_info.get('context', {})),
                binding_info.get('step_order'),
                binding_info.get('action_type'),
                str(current_user.user.id)
            )
            recorded_count += 1
        
        logger.info(f"✅ Recorded {recorded_count} binding usages for execution {execution_id}")
        
        return {
            "success": True,
            "execution_id": execution_id,
            "bindings_recorded": recorded_count,
            "message": f"Successfully recorded {recorded_count} binding usages"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to record binding usage: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to record binding usage: {str(e)}")

@router.get("/execution/{execution_id}/binding-usage")
async def get_execution_binding_usage(
    execution_id: str,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Get all data bindings that were used during a specific execution.
    This provides traceability of which data was consumed by the test.
    """
    try:
        # Verify execution exists and user has access
        execution_check_query = """
        SELECT r.id, r.status, r.started_at, r.finished_at
        FROM exec.runs r
        WHERE r.id = $1
        """
        
        query_params = [execution_id]
        
        # Add tenant filtering
        if current_user.tenant and current_user.tenant.id:
            execution_check_query += " AND EXISTS (SELECT 1 FROM core.projects p WHERE p.id = r.project_id AND p.tenant_id = $2)"
            query_params.append(str(current_user.tenant.id))
        
        execution = await db.execute_one(execution_check_query, *query_params)
        if not execution:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Get binding usage records
        binding_usage_query = """
        SELECT 
            bu.binding_name,
            bu.binding_scope,
            bu.binding_value,
            bu.usage_context,
            bu.step_order,
            bu.action_type,
            bu.recorded_at,
            u.email as recorded_by_email
        FROM exec.binding_usage bu
        LEFT JOIN core.users u ON bu.created_by = u.id
        WHERE bu.execution_id = $1
        ORDER BY bu.step_order ASC, bu.recorded_at ASC
        """
        
        binding_usages = await db.execute(binding_usage_query, execution_id)
        
        # Process binding data
        bindings_data = []
        for usage in binding_usages:
            binding_value = usage['binding_value']
            if isinstance(binding_value, str):
                try:
                    binding_value = json.loads(binding_value)
                except (json.JSONDecodeError, TypeError):
                    pass
            
            usage_context = usage['usage_context']
            if isinstance(usage_context, str):
                try:
                    usage_context = json.loads(usage_context)
                except (json.JSONDecodeError, TypeError):
                    usage_context = {}
            
            bindings_data.append({
                "binding_name": usage['binding_name'],
                "binding_scope": usage['binding_scope'],
                "binding_value": binding_value,
                "usage_context": usage_context,
                "step_order": usage['step_order'],
                "action_type": usage['action_type'],
                "recorded_at": usage['recorded_at'].isoformat() if usage['recorded_at'] else None,
                "recorded_by": usage['recorded_by_email']
            })
        
        return {
            "execution_id": execution_id,
            "execution_status": execution['status'],
            "bindings_count": len(bindings_data),
            "bindings_used": bindings_data,
            "execution_period": {
                "started_at": execution['started_at'].isoformat() if execution['started_at'] else None,
                "finished_at": execution['finished_at'].isoformat() if execution['finished_at'] else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get binding usage: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get binding usage: {str(e)}")

@router.get("/binding/{binding_name}/executions")
async def get_binding_execution_history(
    binding_name: str,
    limit: int = 50,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Get execution history for a specific data binding.
    This shows which test runs have used a particular data binding.
    """
    try:
        # Build query with tenant filtering
        history_query = """
        SELECT 
            bu.execution_id,
            bu.binding_value,
            bu.usage_context,
            bu.step_order,
            bu.action_type,
            bu.recorded_at,
            r.status as execution_status,
            r.started_at,
            r.finished_at,
            tc.source_ref_id as prompt_id,
            p.text as prompt_text
        FROM exec.binding_usage bu
        JOIN exec.runs r ON bu.execution_id = r.id
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        LEFT JOIN planner.prompts p ON tc.source_ref_id = p.id
        WHERE bu.binding_name = $1
        """
        
        query_params = [binding_name]
        
        # Add tenant filtering
        if current_user.tenant and current_user.tenant.id:
            history_query += " AND EXISTS (SELECT 1 FROM core.projects proj WHERE proj.id = r.project_id AND proj.tenant_id = $2)"
            query_params.append(str(current_user.tenant.id))
        
        history_query += " ORDER BY bu.recorded_at DESC LIMIT $" + str(len(query_params) + 1)
        query_params.append(limit)
        
        execution_history = await db.execute(history_query, *query_params)
        
        # Process results
        executions = []
        for record in execution_history:
            binding_value = record['binding_value']
            if isinstance(binding_value, str):
                try:
                    binding_value = json.loads(binding_value)
                except (json.JSONDecodeError, TypeError):
                    pass
            
            usage_context = record['usage_context']
            if isinstance(usage_context, str):
                try:
                    usage_context = json.loads(usage_context)
                except (json.JSONDecodeError, TypeError):
                    usage_context = {}
            
            executions.append({
                "execution_id": record['execution_id'],
                "execution_status": record['execution_status'],
                "prompt_id": record['prompt_id'],
                "prompt_text": record['prompt_text'],
                "binding_value": binding_value,
                "usage_context": usage_context,
                "step_order": record['step_order'],
                "action_type": record['action_type'],
                "used_at": record['recorded_at'].isoformat() if record['recorded_at'] else None,
                "execution_period": {
                    "started_at": record['started_at'].isoformat() if record['started_at'] else None,
                    "finished_at": record['finished_at'].isoformat() if record['finished_at'] else None
                }
            })
        
        return {
            "binding_name": binding_name,
            "executions_count": len(executions),
            "executions": executions,
            "total_found": len(executions)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get binding execution history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get binding execution history: {str(e)}")

@router.get("/traceability/summary")
async def get_traceability_summary(
    days: int = 30,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Get a summary of data binding usage across all executions.
    Provides insights into which bindings are most/least used.
    """
    try:
        # Base summary query
        summary_query = """
        SELECT 
            bu.binding_name,
            COUNT(DISTINCT bu.execution_id) as executions_count,
            COUNT(*) as total_usages,
            MIN(bu.recorded_at) as first_used,
            MAX(bu.recorded_at) as last_used,
            COUNT(DISTINCT bu.action_type) as action_types_count
        FROM exec.binding_usage bu
        JOIN exec.runs r ON bu.execution_id = r.id
        WHERE bu.recorded_at >= NOW() - INTERVAL $1
        """
        
        query_params = [f"{days} days"]
        
        # Add tenant filtering
        if current_user.tenant and current_user.tenant.id:
            summary_query += " AND EXISTS (SELECT 1 FROM core.projects p WHERE p.id = r.project_id AND p.tenant_id = $2)"
            query_params.append(str(current_user.tenant.id))
        
        summary_query += """
        GROUP BY bu.binding_name
        ORDER BY executions_count DESC, total_usages DESC
        """
        
        binding_summary = await db.execute(summary_query, *query_params)
        
        # Get execution summary
        exec_summary_query = """
        SELECT 
            COUNT(DISTINCT r.id) as total_executions,
            COUNT(DISTINCT bu.execution_id) as executions_with_bindings,
            COUNT(DISTINCT bu.binding_name) as unique_bindings_used
        FROM exec.runs r
        LEFT JOIN exec.binding_usage bu ON r.id = bu.execution_id
        WHERE r.started_at >= NOW() - INTERVAL $1
        """
        
        if current_user.tenant and current_user.tenant.id:
            exec_summary_query += " AND EXISTS (SELECT 1 FROM core.projects p WHERE p.id = r.project_id AND p.tenant_id = $2)"
        
        exec_summary = await db.execute_one(exec_summary_query, *query_params)
        
        # Process binding summary
        bindings_data = []
        for binding in binding_summary:
            bindings_data.append({
                "binding_name": binding['binding_name'],
                "executions_count": binding['executions_count'],
                "total_usages": binding['total_usages'],
                "action_types_count": binding['action_types_count'],
                "first_used": binding['first_used'].isoformat() if binding['first_used'] else None,
                "last_used": binding['last_used'].isoformat() if binding['last_used'] else None,
                "usage_frequency": binding['executions_count'] / max(exec_summary['total_executions'], 1) * 100
            })
        
        return {
            "summary_period_days": days,
            "execution_stats": {
                "total_executions": exec_summary['total_executions'],
                "executions_with_bindings": exec_summary['executions_with_bindings'],
                "unique_bindings_used": exec_summary['unique_bindings_used'],
                "binding_adoption_rate": (exec_summary['executions_with_bindings'] / max(exec_summary['total_executions'], 1)) * 100
            },
            "binding_usage": bindings_data,
            "top_bindings": bindings_data[:10],  # Top 10 most used
            "generated_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get traceability summary: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get traceability summary: {str(e)}")

@router.delete("/execution/{execution_id}/binding-usage")
async def clear_execution_binding_usage(
    execution_id: str,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Clear all binding usage records for a specific execution.
    Useful for cleanup or re-recording.
    """
    try:
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
        
        # Delete binding usage records
        delete_query = "DELETE FROM exec.binding_usage WHERE execution_id = $1"
        result = await db.execute(delete_query, execution_id)
        
        logger.info(f"🗑️ Cleared binding usage records for execution {execution_id}")
        
        return {
            "success": True,
            "execution_id": execution_id,
            "message": "Binding usage records cleared successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to clear binding usage: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear binding usage: {str(e)}")