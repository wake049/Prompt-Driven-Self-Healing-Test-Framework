"""
Unified Policy Engine API Router
Migrated from MCP server with database integration
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import asyncio
import json
from core.database import get_database

from models.policy import (
    Policy, PolicyEvaluationResult, ExecutionContext, 
    OutcomeClassification, PolicyExecutionLog, RetryPolicy
)

router = APIRouter()

# Removed old dependency injection - now using direct database access

@router.post("/policies", response_model=Dict[str, Any])
async def create_policy(policy: Policy):
    """Create a new policy"""
    try:
        db = await get_database()
        
        # Ensure unique ID
        if not policy.id:
            policy.id = str(uuid.uuid4())
        
        # Get first project (in real app, this would be project-specific)
        project_result = await db.fetchrow("SELECT id FROM core.projects LIMIT 1")
        if not project_result:
            raise HTTPException(status_code=500, detail="No project found - please create a project first")
        
        project_id = project_result["id"]
        
        # Create or get a policy pack for this policy
        pack_result = await db.fetchrow(
            """
            INSERT INTO policy.policy_packs (project_id, name, description, is_active)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (project_id, name) 
            DO UPDATE SET updated_at = NOW()
            RETURNING id
            """,
            project_id,
            f"Custom Pack - {policy.name}",
            f"Policy pack containing {policy.name}",
            True
        )
        
        pack_id = pack_result["id"]
        
        # Create a policy group for this policy
        group_result = await db.fetchrow(
            """
            INSERT INTO policy.policy_groups (pack_id, name, key, description)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (pack_id, key)
            DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = NOW()
            RETURNING id
            """,
            pack_id,
            policy.name,
            policy.name.lower().replace(' ', '_').replace('-', '_'),
            policy.description
        )
        
        group_id = group_result["id"]
        
        # Create policy rules from the policy object
        for rule in policy.rules:
            await db.execute(
                """
                INSERT INTO policy.policy_rules (group_id, name, key, type, value, description)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (group_id, key)
                DO UPDATE SET 
                    name = EXCLUDED.name,
                    type = EXCLUDED.type,
                    value = EXCLUDED.value,
                    description = EXCLUDED.description,
                    updated_at = NOW()
                """,
                group_id,
                rule.rule_name,
                rule.id,
                "object",  # Store complex policy rules as objects
                json.dumps({
                    "condition_expression": rule.condition_expression,
                    "action_mapping": rule.action_mapping,
                    "evaluation_mode": rule.evaluation_mode.value,
                    "confidence_threshold": rule.confidence_threshold,
                    "retry_policy": rule.retry_policy.dict() if rule.retry_policy else None,
                    "expected_outcomes": [outcome.dict() for outcome in rule.expected_outcomes],
                    "metadata": rule.metadata
                }),
                rule.rule_name
            )
        
        return {
            "success": True,
            "policy_id": policy.id,
            "pack_id": str(pack_id),
            "group_id": str(group_id),
            "message": f"Policy '{policy.name}' created successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating policy: {str(e)}")

@router.get("/policies", response_model=List[Policy])
async def list_policies(
    policy_type: Optional[str] = Query(None, description="Filter by policy type"),
    status: Optional[str] = Query(None, description="Filter by status")
):
    """List all policies with optional filtering"""
    try:
        db = await get_database()
        
        # Query policies from the new policy schema
        # We'll reconstruct Policy objects from the policy packs/groups/rules structure
        result = await db.fetch(
            """
            SELECT 
                pp.id as pack_id,
                pp.name as pack_name,
                pp.description as pack_description,
                pg.id as group_id,
                pg.name as group_name,
                pg.key as group_key,
                pg.description as group_description,
                json_agg(
                    json_build_object(
                        'id', pr.id,
                        'rule_name', pr.name,
                        'key', pr.key,
                        'type', pr.type,
                        'value', pr.value,
                        'description', pr.description
                    )
                ) as rules
            FROM policy.policy_packs pp
            JOIN policy.policy_groups pg ON pg.pack_id = pp.id
            JOIN policy.policy_rules pr ON pr.group_id = pg.id
            GROUP BY pp.id, pp.name, pp.description, pg.id, pg.name, pg.key, pg.description
            ORDER BY pp.name, pg.name
            """
        )
        
        # Convert to Policy objects (this is a simplified conversion)
        policies = []
        for row in result:
            try:
                # Create a simplified Policy object from the database structure
                policy_data = {
                    "id": str(row["pack_id"]),
                    "name": row["pack_name"],
                    "description": row["pack_description"] or "",
                    "policy_type": "business_rule",  # Default type
                    "scope_conditions": {"custom_conditions": {}},
                    "status": "active",
                    "priority_order": 100,
                    "rules": [],
                    "created_at": datetime.now(),
                    "updated_at": datetime.now(),
                    "version": "1.0.0"
                }
                
                # Add rules (simplified - would need more complex mapping for full Policy compatibility)
                for rule_data in row["rules"]:
                    if rule_data and rule_data.get("value"):
                        policy_data["rules"].append({
                            "id": rule_data["key"],
                            "rule_name": rule_data["rule_name"],
                            "condition_expression": rule_data.get("value", {}),
                            "action_mapping": {},
                            "evaluation_mode": "all",
                            "confidence_threshold": 0.8,
                            "expected_outcomes": [],
                            "metadata": {"original_policy_rule_id": str(rule_data["id"])}
                        })
                
                # Apply filters
                if not policy_type or policy_data["policy_type"] == policy_type:
                    if not status or policy_data["status"] == status:
                        # Note: This is a simplified Policy creation - in production you'd want
                        # a more robust mapping between the policy schema and Policy model
                        policies.append(policy_data)
                        
            except Exception as e:
                continue  # Skip invalid policy data
        
        return policies
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing policies: {str(e)}")

@router.get("/policies/{policy_id}", response_model=Policy)
async def get_policy(policy_id: str):
    """Get a specific policy by ID"""
    try:
        db = await get_database()
        
        # Query policy pack details
        result = await db.fetchrow(
            """
            SELECT 
                pp.id as pack_id,
                pp.name as pack_name,
                pp.description as pack_description,
                pp.is_active,
                pp.created_at,
                pp.updated_at
            FROM policy.policy_packs pp
            WHERE pp.id = $1
            """,
            policy_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Policy {policy_id} not found")
        
        # Get groups and rules for this pack
        groups_result = await db.fetch(
            """
            SELECT 
                pg.id as group_id,
                pg.name as group_name,
                pg.key as group_key,
                pg.description as group_description,
                json_agg(
                    json_build_object(
                        'id', pr.id,
                        'rule_name', pr.name,
                        'key', pr.key,
                        'type', pr.type,
                        'value', pr.value,
                        'description', pr.description
                    )
                ) as rules
            FROM policy.policy_groups pg
            JOIN policy.policy_rules pr ON pr.group_id = pg.id
            WHERE pg.pack_id = $1
            GROUP BY pg.id, pg.name, pg.key, pg.description
            """,
            policy_id
        )
        
        # Reconstruct Policy object
        rules = []
        for group in groups_result:
            for rule_data in group["rules"]:
                if rule_data and rule_data.get("value"):
                    rules.append({
                        "id": rule_data["key"],
                        "rule_name": rule_data["rule_name"],
                        "condition_expression": rule_data.get("value", {}),
                        "action_mapping": {},
                        "evaluation_mode": "all",
                        "confidence_threshold": 0.8,
                        "expected_outcomes": [],
                        "metadata": {"original_policy_rule_id": str(rule_data["id"])}
                    })
        
        policy_data = {
            "id": str(result["pack_id"]),
            "name": result["pack_name"],
            "description": result["pack_description"] or "",
            "policy_type": "business_rule",  # Default type
            "scope_conditions": {"custom_conditions": {}},
            "status": "active" if result["is_active"] else "inactive",
            "priority_order": 100,
            "rules": rules,
            "created_at": result["created_at"],
            "updated_at": result["updated_at"],
            "version": "1.0.0"
        }
        
        return policy_data
    
    except Exception as e:
        if "not found" in str(e):
            raise e
        raise HTTPException(status_code=500, detail=f"Error fetching policy: {str(e)}")

@router.put("/policies/{policy_id}", response_model=Dict[str, Any])
async def update_policy(
    policy_id: str,
    policy: Policy
):
    """Update an existing policy"""
    try:
        db = await get_database()
        
        # Check if policy exists
        existing = await db.fetchrow(
            """
            SELECT id FROM datahub.data_bindings 
            WHERE scope = 'policy_engine' AND source_ref->>'policy_id' = $1
            """,
            policy_id
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail=f"Policy {policy_id} not found")
        
        # Update policy
        policy.id = policy_id
        policy.updated_at = datetime.now()
        
        await db.execute(
            """
            UPDATE datahub.data_bindings 
            SET target = $1, created_at = NOW()
            WHERE scope = 'policy_engine' AND source_ref->>'policy_id' = $2
            """,
            json.dumps(policy.dict()),
            policy_id
        )
        
        return {
            "success": True,
            "policy_id": policy_id,
            "message": f"Policy '{policy.name}' updated successfully"
        }
    
    except Exception as e:
        if "not found" in str(e):
            raise e
        raise HTTPException(status_code=500, detail=f"Error updating policy: {str(e)}")

@router.delete("/policies/{policy_id}", response_model=Dict[str, Any])
async def delete_policy(policy_id: str):
    """Delete a policy"""
    try:
        db = await get_database()
        
        result = await db.execute(
            """
            DELETE FROM policy.policy_packs 
            WHERE id = $1
            """,
            policy_id
        )
        
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail=f"Policy {policy_id} not found")
        
        return {
            "success": True,
            "policy_id": policy_id,
            "message": "Policy deleted successfully"
        }
    
    except Exception as e:
        if "not found" in str(e):
            raise e
        raise HTTPException(status_code=500, detail=f"Error deleting policy: {str(e)}")

# New endpoints for the dedicated policy schema

@router.get("/policy-packs", response_model=List[Dict[str, Any]])
async def list_policy_packs(project_id: Optional[str] = Query(None)):
    """List all policy packs with their groups and rules"""
    try:
        db = await get_database()
        
        where_clause = ""
        params = []
        if project_id:
            where_clause = "WHERE pp.project_id = $1"
            params.append(project_id)
        
        query = f"""
        SELECT 
            pp.id,
            pp.project_id,
            pp.name,
            pp.description,
            pp.is_active,
            pp.created_at,
            pp.updated_at,
            (
                SELECT json_agg(
                    json_build_object(
                        'id', pg.id,
                        'name', pg.name,
                        'key', pg.key,
                        'description', pg.description,
                        'rules', (
                            SELECT json_agg(
                                json_build_object(
                                    'id', pr.id,
                                    'name', pr.name,
                                    'key', pr.key,
                                    'type', pr.type,
                                    'value', pr.value,
                                    'description', pr.description
                                )
                            )
                            FROM policy.policy_rules pr
                            WHERE pr.group_id = pg.id
                        )
                    )
                )
                FROM policy.policy_groups pg
                WHERE pg.pack_id = pp.id
            ) as groups
        FROM policy.policy_packs pp
        {where_clause}
        ORDER BY pp.name
        """
        
        result = await db.fetch(query, *params)
        
        return [{
            "id": str(row["id"]),
            "project_id": str(row["project_id"]),
            "name": row["name"],
            "description": row["description"],
            "is_active": row["is_active"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            "groups": row["groups"] or []
        } for row in result]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing policy packs: {str(e)}")

@router.get("/policy-packs/{pack_id}/active-rules", response_model=Dict[str, Any])
async def get_active_pack_rules(pack_id: str):
    """Get active rules for a policy pack in a flattened format for easy consumption"""
    try:
        db = await get_database()
        
        result = await db.fetchrow(
            """
            SELECT groups FROM policy.v_pack_rules WHERE pack_id = $1
            """,
            pack_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail=f"Policy pack {pack_id} not found")
        
        return {
            "pack_id": pack_id,
            "groups": result["groups"]
        }
    
    except Exception as e:
        if "not found" in str(e):
            raise e
        raise HTTPException(status_code=500, detail=f"Error fetching pack rules: {str(e)}")

@router.get("/environments/{environment_id}/active-policies", response_model=Dict[str, Any])
async def get_environment_active_policies(environment_id: str):
    """Get the active policy pack and rules for a specific environment"""
    try:
        db = await get_database()
        
        result = await db.fetchrow(
            """
            SELECT 
                environment_id,
                pack_id,
                pack_name,
                groups
            FROM policy.v_active_pack_rules 
            WHERE environment_id = $1
            """,
            environment_id
        )
        
        if not result:
            return {
                "environment_id": environment_id,
                "pack_id": None,
                "pack_name": None,
                "groups": [],
                "message": "No active policy pack assigned to this environment"
            }
        
        return {
            "environment_id": str(result["environment_id"]),
            "pack_id": str(result["pack_id"]),
            "pack_name": result["pack_name"],
            "groups": result["groups"]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching environment policies: {str(e)}")

@router.post("/policy-decisions", response_model=Dict[str, Any])
async def log_policy_decision(
    project_id: str = Body(...),
    environment_id: Optional[str] = Body(None),
    pack_id: Optional[str] = Body(None),
    policy_rule_id: Optional[str] = Body(None),
    decision: str = Body(...),
    confidence: Optional[float] = Body(None),
    context: Dict[str, Any] = Body(default_factory=dict),
    decided_by: Optional[str] = Body(None)
):
    """Log a policy decision for audit purposes"""
    try:
        db = await get_database()
        
        result = await db.fetchrow(
            """
            INSERT INTO policy.policy_decisions (
                project_id, environment_id, pack_id, policy_rule_id,
                decision, confidence, context, decided_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
            """,
            project_id,
            environment_id,
            pack_id,
            policy_rule_id,
            decision,
            confidence,
            json.dumps(context),
            decided_by
        )
        
        return {
            "success": True,
            "decision_id": str(result["id"]),
            "message": "Policy decision logged successfully"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error logging policy decision: {str(e)}")

# Simplified policy evaluation function for dashboard compatibility
@router.post("/evaluate", response_model=List[Dict[str, Any]])
async def evaluate_policies(
    context: Dict[str, Any] = Body(...),
    action_type: Optional[str] = Body(None),
    error_info: Optional[Dict[str, Any]] = Body(None)
):
    """Evaluate policies for a given execution context (simplified)"""
    try:
        # Simplified policy evaluation - returns mock results for now
        return [{
            "policy_id": "balanced-pack",
            "matched": True,
            "confidence_score": 0.85,
            "actions_to_execute": [],
            "evaluation_details": {
                "context": context,
                "action_type": action_type,
                "timestamp": datetime.now().isoformat()
            }
        }]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error evaluating policies: {str(e)}")

@router.post("/classify-outcome", response_model=Dict[str, Any])
async def classify_outcome(
    context: Dict[str, Any] = Body(...),
    action_result: Dict[str, Any] = Body(...),
    detection_timeout_ms: Optional[int] = Body(5000)
):
    """Classify the outcome of an action execution (simplified)"""
    try:
        # Simplified outcome classification - returns mock classification
        return {
            "outcome_type": "success_navigate",
            "confidence_score": 0.9,
            "detected_criteria": ["page_load_complete"],
            "next_actions": [],
            "retry_recommended": False,
            "context": context,
            "action_result": action_result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error classifying outcome: {str(e)}")

# This stats endpoint has been replaced by the dashboard stats endpoint below

# This execution-logs endpoint has been replaced by the dashboard execution-logs endpoint below

# Dashboard endpoints (no auth required for frontend integration)
@router.get("/dashboard/stats", response_model=Dict[str, Any])
async def get_dashboard_stats():
    """Get policy engine statistics for dashboard"""
    try:
        db = await get_database()
        
        # Get policy pack statistics
        pack_stats = await db.execute_one(
            """
            SELECT 
                COUNT(*) as total_packs,
                COUNT(CASE WHEN is_active THEN 1 END) as active_packs
            FROM policy.policy_packs
            """
        )
        
        # Get rule statistics
        rule_stats = await db.execute_one(
            """
            SELECT 
                COUNT(*) as total_rules,
                COUNT(CASE WHEN type = 'toggle' THEN 1 END) as toggle_rules,
                COUNT(CASE WHEN type = 'slider' THEN 1 END) as slider_rules,
                COUNT(CASE WHEN type = 'enum' THEN 1 END) as enum_rules
            FROM policy.policy_rules
            """
        )
        
        # Get recent decision statistics
        decision_stats = await db.execute_one(
            """
            SELECT 
                COUNT(*) as total_decisions,
                COUNT(CASE WHEN decision = 'allowed' THEN 1 END) as allowed_decisions,
                COUNT(CASE WHEN decision = 'blocked' THEN 1 END) as blocked_decisions,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as decisions_last_24h
            FROM policy.policy_decisions
            WHERE created_at > NOW() - INTERVAL '7 days'
            """
        )
        
        # Get environment assignments
        env_stats = await db.execute_one(
            """
            SELECT COUNT(*) as environments_with_policies
            FROM policy.pack_assignments
            WHERE is_active = TRUE
            """
        )
        
        # Return real statistics - all should be 0 if no data exists
        total_packs = pack_stats["total_packs"] or 0
        active_packs = pack_stats["active_packs"] or 0
        total_rules = rule_stats["total_rules"] or 0
        total_decisions = decision_stats["total_decisions"] or 0
        
        return {
            "total_policies": total_packs,
            "active_policies": active_packs, 
            "total_executions": total_decisions,
            "recent_executions_24h": decision_stats["decisions_last_24h"] or 0,
            "avg_evaluation_time_ms": 0,  # Always return 0 when no real data
            "success_rate": 0,  # Always return 0 when no real data
            "total_policy_packs": total_packs,
            "active_policy_packs": active_packs,
            "total_rules": total_rules,
            "rule_types": {
                "toggle": rule_stats["toggle_rules"] or 0,
                "slider": rule_stats["slider_rules"] or 0,
                "enum": rule_stats["enum_rules"] or 0,
                "other": total_rules - (rule_stats["toggle_rules"] or 0) - (rule_stats["slider_rules"] or 0) - (rule_stats["enum_rules"] or 0)
            },
            "total_decisions": total_decisions,
            "decision_breakdown": {
                "allowed": decision_stats["allowed_decisions"] or 0,
                "blocked": decision_stats["blocked_decisions"] or 0,
                "other": total_decisions - (decision_stats["allowed_decisions"] or 0) - (decision_stats["blocked_decisions"] or 0)
            },
            "decisions_last_24h": decision_stats["decisions_last_24h"] or 0,
            "environments_with_policies": env_stats["environments_with_policies"] or 0,
            "last_updated": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving policy stats: {str(e)}")

@router.get("/dashboard/execution-logs", response_model=List[Dict[str, Any]])
async def get_dashboard_execution_logs(limit: int = Query(10, ge=1, le=100)):
    """Get recent policy execution/decision logs for dashboard"""
    try:
        db = await get_database()
        
        result = await db.execute(
            """
            SELECT 
                pd.id,
                pd.decision,
                pd.confidence,
                pd.context,
                pd.created_at,
                pd.decided_by,
                pp.name as pack_name,
                pr.name as rule_name,
                pr.key as rule_key,
                env.name as environment_name,
                proj.name as project_name
            FROM policy.policy_decisions pd
            LEFT JOIN policy.policy_packs pp ON pd.pack_id = pp.id
            LEFT JOIN policy.policy_rules pr ON pd.policy_rule_id = pr.id
            LEFT JOIN core.environments env ON pd.environment_id = env.id
            LEFT JOIN core.projects proj ON pd.project_id = proj.id
            ORDER BY pd.created_at DESC
            LIMIT $1
            """,
            limit
        )
        
        return [{
            "id": str(row["id"]),
            "decision": row["decision"],
            "confidence": float(row["confidence"]) if row["confidence"] else None,
            "context": row["context"] or {},
            "timestamp": row["created_at"].isoformat() if row["created_at"] else None,
            "decided_by": row["decided_by"],
            "pack_name": row["pack_name"],
            "rule_name": row["rule_name"],
            "rule_key": row["rule_key"],
            "environment_name": row["environment_name"],
            "project_name": row["project_name"]
        } for row in result]
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving execution logs: {str(e)}")

@router.get("/dashboard/policies", response_model=List[Dict[str, Any]])
async def get_dashboard_policies():
    """Get policies for dashboard"""
    try:
        db = await get_database()
        
        result = await db.execute(
            """
            SELECT 
                pp.id,
                pp.name,
                pp.description,
                pp.is_active,
                pp.created_at,
                pp.updated_at,
                proj.name as project_name,
                COUNT(DISTINCT pg.id) as group_count,
                COUNT(DISTINCT pr.id) as rule_count,
                COUNT(DISTINCT pa.environment_id) as assigned_environments
            FROM policy.policy_packs pp
            JOIN core.projects proj ON pp.project_id = proj.id
            LEFT JOIN policy.policy_groups pg ON pg.pack_id = pp.id
            LEFT JOIN policy.policy_rules pr ON pr.group_id = pg.id
            LEFT JOIN policy.pack_assignments pa ON pa.pack_id = pp.id AND pa.is_active = TRUE
            GROUP BY pp.id, pp.name, pp.description, pp.is_active, pp.created_at, pp.updated_at, proj.name
            ORDER BY pp.name
            """
        )
        
        return [{
            "id": str(row["id"]),
            "name": row["name"],
            "description": row["description"],
            "is_active": row["is_active"],
            "project_name": row["project_name"],
            "group_count": row["group_count"] or 0,
            "rule_count": row["rule_count"] or 0,
            "assigned_environments": row["assigned_environments"] or 0,
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None
        } for row in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing policies: {str(e)}")

@router.post("/validate-policy", response_model=Dict[str, Any])
async def validate_policy(
    policy_data: Dict[str, Any] = Body(...)
):
    """Validate a policy configuration (simplified)"""
    try:
        errors = []
        warnings = []
        
        # Basic validation
        if not policy_data.get("name", "").strip():
            errors.append("Policy name is required")
        
        rules = policy_data.get("rules", [])
        if not rules:
            warnings.append("Policy has no rules defined")
        
        # Validate rules
        for i, rule in enumerate(rules):
            if not rule.get("condition_expression"):
                errors.append(f"Rule {i+1} has no conditions")
            
            if not rule.get("action_mapping"):
                errors.append(f"Rule {i+1} has no actions")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "recommendations": [
                "Consider adding descriptive names to all rules",
                "Test policies in a safe environment before production use"
            ]
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error validating policy: {str(e)}")

@router.get("/health", response_model=Dict[str, Any])
async def health_check():
    """Policy engine health check"""
    try:
        return {
            "status": "healthy",
            "service": "policy_engine",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@router.put("/dashboard/config", response_model=Dict[str, Any])
async def update_policy_configurations(configurations: Dict[str, Any] = Body(...)):
    """Update policy configurations from the dashboard"""
    try:
        db = await get_database()
        
        # Since this is dashboard configuration, let's use a simpler approach
        # We'll create a policy pack specifically for dashboard configuration
        config_id = "dashboard_config"
        
        # First, try to get or create a default project for dashboard configs
        project_query = """
        SELECT id FROM core.projects LIMIT 1
        """
        project_result = await db.execute_one(project_query)
        
        if not project_result:
            # Create a default project for dashboard configurations
            default_project_id = str(uuid.uuid4())
            create_project_query = """
            INSERT INTO core.projects (id, tenant_id, name, description, created_at, updated_at, is_active)
            VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)
            """
            # We'll need a tenant too - let's create one if needed
            tenant_query = """SELECT id FROM core.tenants LIMIT 1"""
            tenant_result = await db.execute_one(tenant_query)
            
            if not tenant_result:
                # Create default tenant
                default_tenant_id = str(uuid.uuid4())
                create_tenant_query = """
                INSERT INTO core.tenants (id, name, slug, created_at, updated_at, is_active)
                VALUES ($1, $2, $3, NOW(), NOW(), $4)
                """
                await db.execute_command(create_tenant_query, default_tenant_id, "Default Tenant", "default", True)
            else:
                default_tenant_id = tenant_result["id"]
            
            await db.execute_command(create_project_query, default_project_id, default_tenant_id, "Dashboard Configuration", "Default project for dashboard policy configurations", True)
            project_id = default_project_id
        else:
            project_id = project_result["id"]
        
        # Check if config already exists in policy_decisions table
        check_query = """
        SELECT id FROM policy.policy_decisions WHERE context->>'config_type' = $1
        """
        result = await db.execute_one(check_query, config_id)
        
        if result:
            # Update existing config in policy_decisions
            update_query = """
            UPDATE policy.policy_decisions 
            SET context = $1, created_at = NOW()
            WHERE context->>'config_type' = $2
            """
            context_data = {"config_type": config_id, "configurations": configurations}
            await db.execute_command(update_query, json.dumps(context_data), config_id)
        else:
            # Insert new config into policy_decisions
            insert_query = """
            INSERT INTO policy.policy_decisions (id, project_id, environment_id, pack_id, policy_rule_id, decision, confidence, context, decided_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            """
            context_data = {"config_type": config_id, "configurations": configurations}
        # Check for existing system user or create one
        user_query = """
        SELECT id FROM core.users WHERE email = $1 LIMIT 1
        """
        user_result = await db.execute_one(user_query, "system@dashboard.local")
        
        if not user_result:
            # Create a system user for dashboard operations
            system_user_id = str(uuid.uuid4())
            create_user_query = """
            INSERT INTO core.users (id, email, full_name, created_at, updated_at, is_active)
            VALUES ($1, $2, $3, NOW(), NOW(), $4)
            """
            await db.execute_command(create_user_query, system_user_id, "system@dashboard.local", "Dashboard System", True)
        else:
            system_user_id = user_result["id"]
            await db.execute_command(insert_query, 
                                   str(uuid.uuid4()),  # id
                                   project_id,  # project_id (now required)
                                   None,  # environment_id (nullable) 
                                   None,  # pack_id (nullable)
                                   None,  # policy_rule_id (nullable)
                                   "APPROVED",  # decision
                                   100,  # confidence
                                   json.dumps(context_data),  # context
                                   system_user_id  # decided_by (UUID)
                                   )
        
        return {
            "success": True,
            "message": "Policy configurations updated successfully",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update policy configurations: {str(e)}")

@router.get("/dashboard/config", response_model=Dict[str, Any])
async def get_policy_configurations():
    """Get current policy configurations for the dashboard"""
    try:
        db = await get_database()
        
        # Retrieve the policy configurations from the database
        config_id = "dashboard_config"
        
        query = """
        SELECT context FROM policy.policy_decisions 
        WHERE context->>'config_type' = $1
        ORDER BY created_at DESC
        LIMIT 1
        """
        result = await db.execute_one(query, config_id)
        
        if result and result["context"]:
            context_data = json.loads(result["context"])
            configurations = context_data.get("configurations", {})
            return {
                "success": True,
                "data": configurations,
                "timestamp": datetime.now().isoformat()
            }
        else:
            # Return default configurations if none exist
            default_config = {
                "locatorHealing": {
                    "confidenceThreshold": 85,
                    "maxRetries": 2,
                    "useRepositoryFallback": True,
                    "preferCssOverXpath": True,
                    "active": True
                },
                "executionSafety": {
                    "blockDestructiveActions": True,
                    "requireConfirmationKeywords": ["delete", "remove", "submit", "payment"],
                    "allowTestModeOverride": True,
                    "active": True
                },
                "multiOutcomeHandling": {
                    "confidenceThreshold": 75,
                    "maxCandidates": 5,
                    "preferVisibleElements": True,
                    "active": True
                },
                "auditReview": {
                    "logAllDecisions": True,
                    "escalateUnknownElements": True,
                    "retentionDays": 60,
                    "active": True
                }
            }
            return {
                "success": True,
                "data": default_config,
                "timestamp": datetime.now().isoformat()
            }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get policy configurations: {str(e)}")

@router.get("/dashboard/outcome-statistics", response_model=Dict[str, Any])
async def get_dashboard_outcome_statistics():
    """Get outcome statistics for dashboard from real policy decisions"""
    try:
        db = await get_database()
        
        # Get outcome statistics from policy_decisions table
        stats_query = """
        SELECT 
            decision,
            COUNT(*) as count,
            AVG(confidence) as avg_confidence
        FROM policy.policy_decisions 
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY decision
        ORDER BY count DESC
        """
        
        results = await db.execute(stats_query)
        
        # Initialize default statistics
        outcome_stats = {
            "auto_approved": 0,
            "sent_to_review": 0, 
            "failed_validation": 0,
            "manual_override": 0,
            "total_decisions": 0
        }
        
        # Process results and map to outcome categories
        for row in results:
            decision = row["decision"].lower() if row["decision"] else ""
            count = row["count"] or 0
            
            if decision in ["approved", "auto_approved", "accepted"]:
                outcome_stats["auto_approved"] += count
            elif decision in ["review", "pending", "sent_to_review"]:
                outcome_stats["sent_to_review"] += count
            elif decision in ["rejected", "failed", "failed_validation"]:
                outcome_stats["failed_validation"] += count
            elif decision in ["manual", "override", "manual_override"]:
                outcome_stats["manual_override"] += count
                
            outcome_stats["total_decisions"] += count
        
        # Calculate percentages
        total = outcome_stats["total_decisions"]
        if total > 0:
            outcome_stats["auto_approved_percentage"] = round((outcome_stats["auto_approved"] / total) * 100, 1)
            outcome_stats["sent_to_review_percentage"] = round((outcome_stats["sent_to_review"] / total) * 100, 1)
            outcome_stats["failed_validation_percentage"] = round((outcome_stats["failed_validation"] / total) * 100, 1)
            outcome_stats["manual_override_percentage"] = round((outcome_stats["manual_override"] / total) * 100, 1)
        else:
            # No real data - return zeros for all percentages
            outcome_stats.update({
                "auto_approved_percentage": 0.0,
                "sent_to_review_percentage": 0.0,
                "failed_validation_percentage": 0.0,
                "manual_override_percentage": 0.0
            })
        
        return {
            "success": True,
            "data": outcome_stats,
            "combined_metrics": outcome_stats,  # For compatibility
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get outcome statistics: {str(e)}")