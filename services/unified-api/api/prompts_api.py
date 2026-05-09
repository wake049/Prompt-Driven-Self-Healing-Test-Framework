"""
Prompts API - Database-connected implementation for prompt management with multi-tenant support
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

import json
from core.database import get_database, DatabaseManager
from core.auth import get_current_active_user, get_optional_current_user
from models.auth_models import CurrentUser
from services.selector_conversion import convert_steps_to_dual_selector_format
from services.subscription_limits import require_active_subscription

router = APIRouter()
logger = logging.getLogger(__name__)

async def get_db() -> DatabaseManager:
    """Get database dependency"""
    return await get_database()

async def log_prompt_activity(
    db: DatabaseManager,
    prompt_id: str,
    activity_type: str,
    actor_id: str,
    summary: str,
    version_id: str = None,
    details: Dict[str, Any] = None
):
    """Log activity to the prompt_activity table for History sidebar"""
    try:
        await db.execute_command(
            """INSERT INTO planner.prompt_activity 
               (prompt_id, version_id, activity_type, actor_id, summary, details)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb)""",
            prompt_id,
            version_id,
            activity_type,
            actor_id,
            summary,
            json.dumps(details or {})
        )
    except Exception as e:
        # Don't fail the main operation if activity logging fails
        logger.warning("Failed to log prompt activity for prompt_id=%s: %s", prompt_id, e)

@router.get("/prompts")
async def get_prompts(
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get all prompts from database with project filtering"""
    try:
        # Build project-aware query - show ALL prompts in user's current project
        where_conditions = ["1=1"]
        query_params = []
        
        # Filter by user's current project ONLY (shows all team prompts in project)
        if current_user.project and current_user.project.id:
            where_conditions.append("p.project_id = $" + str(len(query_params) + 1))
            query_params.append(current_user.project.id)
        else:
            # If no project assigned, show nothing rather than everything
            where_conditions.append("1=0")
        
        # Exclude test prompts (those with "test" in description or empty text)
        where_conditions.append("(p.text IS NOT NULL AND p.text != '')")
        where_conditions.append("(p.intent NOT ILIKE '%test prompt for integration%' OR p.intent IS NULL)")
        
        where_clause = " AND ".join(where_conditions)
        
        # Detect optional columns to support mixed schema versions.
        optional_columns = [
            "starting_url",
            "category",
            "tags",
            "priority",
            "version",
            "usage_count",
            "estimated_duration",
            "external_id",
            "test_type",
        ]
        existing_optional = set(
            await db.fetchval(
                """
                SELECT array_agg(column_name)
                FROM information_schema.columns
                WHERE table_schema = 'planner'
                  AND table_name = 'prompts'
                  AND column_name = ANY($1::text[])
                """,
                optional_columns,
            )
            or []
        )

        select_optional_parts = []
        for col in optional_columns:
            if col in existing_optional:
                select_optional_parts.append(f"p.{col}")
            else:
                select_optional_parts.append(f"NULL AS {col}")

        # Query prompts from the planner.prompts table with project filtering
        query = f"""
        SELECT 
            p.id,
            p.text,
            p.intent,
            {', '.join(select_optional_parts)},
            p.created_at,
            p.updated_at,
            p.project_id,
            p.user_id,
            p.status,
            p.parsed_plan,
            p.external_id
        FROM planner.prompts p
        WHERE {where_clause}
        ORDER BY p.created_at DESC
        """
        
        results = await db.fetch(query, *query_params)
        
        # Format the results for the frontend
        prompts = []
        for row in results:
            row_data = dict(row)
            # Always extract title from text content (first line)
            title = "Untitled"
            if row_data.get("text"):
                text_lines = row_data["text"].split('\n')
                title = text_lines[0].strip() if text_lines and text_lines[0].strip() else "Untitled"
                
            # Ensure tags is properly parsed as JSON array
            tags = row_data.get("tags")
            if tags is None:
                tags = []
            elif isinstance(tags, str):
                try:
                    import json
                    tags = json.loads(tags)
                except Exception:
                    tags = []
            elif not isinstance(tags, list):
                tags = []
                
            # Format dates properly - replace timezone offset with Z for consistency
            date_modified = None
            if row_data.get("updated_at"):
                date_modified = row_data["updated_at"].isoformat().replace('+00:00', 'Z')
            elif row_data.get("created_at"):
                date_modified = row_data["created_at"].isoformat().replace('+00:00', 'Z')
            
            created_at = row_data["created_at"].isoformat().replace('+00:00', 'Z') if row_data.get("created_at") else None
            updated_at = row_data["updated_at"].isoformat().replace('+00:00', 'Z') if row_data.get("updated_at") else None
            
            prompt = {
                "id": row_data["id"],
                "title": title,
                "content": row_data.get("text") or "",
                "description": row_data.get("intent") or "",
                "category": row_data.get("category") or "",
                "tags": tags,
                "status": row_data.get("status") or "pending",
                "created_at": created_at,
                "updated_at": updated_at,
                "date_modified": date_modified,
                "usage_count": row_data.get("usage_count") or 0,
                "priority": row_data.get("priority") or 0,
                "estimated_duration": row_data.get("estimated_duration"),
                "starting_url": row_data.get("starting_url") or "",
                "test_type": row_data.get("test_type") or "web",
                "author_id": str(row_data["user_id"]) if row_data.get("user_id") else None,
                "version": row_data.get("version") or 1,
                "project_id": str(row_data["project_id"]) if row_data.get("project_id") else None,
                "external_id": row_data.get("external_id"),
                "parsed_plan": row_data.get("parsed_plan"),
            }
            prompts.append(prompt)
        
        return {"prompts": prompts, "total": len(prompts)}
        
    except Exception as e:
        logger.exception("Error fetching prompts")
        raise HTTPException(status_code=500, detail=f"Error fetching prompts: {str(e)}")


@router.get("/prompts/{prompt_id}")
async def get_prompt(
    prompt_id: str,
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get a single prompt by ID"""
    try:
        row = await db.execute_one(
            """
            SELECT 
                p.id,
                p.text,
                p.intent,
                p.starting_url,
                p.category,
                p.tags,
                p.test_type,
                p.version,
                p.usage_count,
                p.priority,
                p.estimated_duration,
                p.external_id,
                p.created_at,
                p.updated_at,
                p.project_id,
                p.user_id,
                p.status,
                p.parsed_plan
            FROM planner.prompts p
            WHERE p.id = $1
            """,
            prompt_id,
        )
        
        if not row:
            raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")
        
        title = "Untitled"
        if row["text"]:
            text_lines = row["text"].split('\n')
            title = text_lines[0].strip() if text_lines and text_lines[0].strip() else "Untitled"
        
        tags = row.get("tags")
        if tags is None:
            tags = []
        elif isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except Exception:
                tags = []
        elif not isinstance(tags, list):
            tags = []
        
        created_at = row["created_at"].isoformat().replace('+00:00', 'Z') if row["created_at"] else None
        updated_at = row["updated_at"].isoformat().replace('+00:00', 'Z') if row["updated_at"] else None
        
        return {
            "id": row["id"],
            "title": title,
            "content": row["text"] or "",
            "description": row["intent"] or "",
            "category": row.get("category") or "",
            "tags": tags,
            "status": row["status"] or "pending",
            "created_at": created_at,
            "updated_at": updated_at,
            "usage_count": row.get("usage_count") or 0,
            "priority": row.get("priority") or 0,
            "estimated_duration": row.get("estimated_duration"),
            "starting_url": row.get("starting_url") or "",
            "test_type": row.get("test_type") or "web",
            "author_id": str(row["user_id"]) if row.get("user_id") else None,
            "version": row.get("version") or 1,
            "project_id": str(row["project_id"]) if row.get("project_id") else None,
            "external_id": row.get("external_id"),
            "parsed_plan": row.get("parsed_plan"),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error fetching prompt %s: %s", prompt_id, str(e))
        raise HTTPException(status_code=500, detail=f"Error fetching prompt: {str(e)}")


@router.post("/prompts")
async def create_prompt(
    prompt_data: Dict[str, Any],
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Create a new prompt"""
    try:
        await require_active_subscription(db, str(current_user.tenant.id))
        
        title = prompt_data.get("title", "Untitled")
        content = prompt_data.get("content", "")
        description = prompt_data.get("description", "")
        category = prompt_data.get("category", "")
        tags = prompt_data.get("tags", [])
        starting_url = prompt_data.get("starting_url", "")
        test_type = prompt_data.get("test_type", "web")
        if test_type not in ("web", "app"):
            test_type = "web"
        
        # Build text from title + content
        text = f"{title}\n{content}" if content else title
        
        project_id = str(current_user.project.id) if current_user.project and current_user.project.id else None
        user_id = str(current_user.user.id) if current_user.user and current_user.user.id else None
        
        if not project_id:
            raise HTTPException(status_code=400, detail="No active project found")
        
        tags_json = json.dumps(tags) if isinstance(tags, list) else json.dumps([])
        
        row = await db.execute_one(
            """
            INSERT INTO planner.prompts (project_id, user_id, text, intent, starting_url, category, tags, status, test_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending', $8)
            RETURNING id, text, intent, starting_url, category, tags, status, created_at, updated_at,
                      project_id, user_id, version, usage_count, estimated_duration, priority, external_id, parsed_plan, test_type
            """,
            project_id,
            user_id,
            text,
            description,
            starting_url,
            category,
            tags_json,
            test_type,
        )
        
        created_at = row["created_at"].isoformat().replace('+00:00', 'Z') if row["created_at"] else None
        updated_at = row["updated_at"].isoformat().replace('+00:00', 'Z') if row["updated_at"] else None
        
        prompt_id = str(row["id"])
        
        # Log activity
        await log_prompt_activity(
            db, prompt_id, "created", user_id,
            f"Prompt created: {title}",
            details={"title": title, "category": category}
        )
        
        return {
            "id": prompt_id,
            "title": title,
            "content": content,
            "description": description,
            "category": category,
            "tags": tags,
            "status": row["status"] or "pending",
            "created_at": created_at,
            "updated_at": updated_at,
            "usage_count": row.get("usage_count") or 0,
            "priority": row.get("priority") or 0,
            "estimated_duration": row.get("estimated_duration"),
            "starting_url": starting_url,
            "test_type": test_type,
            "author_id": user_id,
            "version": row.get("version") or 1,
            "project_id": project_id,
            "external_id": row.get("external_id"),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating prompt: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Error creating prompt: {str(e)}")


@router.put("/prompts/{prompt_id}")
async def update_prompt(
    prompt_id: str,
    prompt_data: Dict[str, Any],
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Update an existing prompt"""
    try:
        # Verify prompt exists
        existing = await db.execute_one(
            "SELECT id, text, user_id, project_id FROM planner.prompts WHERE id = $1",
            prompt_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")
        
        # Build update fields dynamically
        set_clauses = []
        params = []
        param_idx = 1
        
        if "title" in prompt_data or "content" in prompt_data:
            title = prompt_data.get("title", "")
            content = prompt_data.get("content", "")
            text = f"{title}\n{content}" if content else title
            set_clauses.append(f"text = ${param_idx}")
            params.append(text)
            param_idx += 1
        
        if "description" in prompt_data:
            set_clauses.append(f"intent = ${param_idx}")
            params.append(prompt_data["description"])
            param_idx += 1
        
        if "category" in prompt_data:
            set_clauses.append(f"category = ${param_idx}")
            params.append(prompt_data["category"])
            param_idx += 1
        
        if "tags" in prompt_data:
            set_clauses.append(f"tags = ${param_idx}::jsonb")
            params.append(json.dumps(prompt_data["tags"] if isinstance(prompt_data["tags"], list) else []))
            param_idx += 1
        
        if "starting_url" in prompt_data:
            set_clauses.append(f"starting_url = ${param_idx}")
            params.append(prompt_data["starting_url"])
            param_idx += 1
        
        if "test_type" in prompt_data:
            val = prompt_data["test_type"]
            if val in ("web", "app"):
                set_clauses.append(f"test_type = ${param_idx}")
                params.append(val)
                param_idx += 1
        
        if "status" in prompt_data:
            set_clauses.append(f"status = ${param_idx}")
            params.append(prompt_data["status"])
            param_idx += 1
        
        if "external_id" in prompt_data:
            set_clauses.append(f"external_id = ${param_idx}")
            params.append(prompt_data["external_id"])
            param_idx += 1
        
        if not set_clauses:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        set_clauses.append("updated_at = NOW()")
        
        params.append(prompt_id)
        
        query = f"""
            UPDATE planner.prompts
            SET {', '.join(set_clauses)}
            WHERE id = ${param_idx}
            RETURNING id, text, intent, starting_url, category, tags, status, created_at, updated_at,
                      project_id, user_id, version, usage_count, estimated_duration, priority, external_id, parsed_plan, test_type
        """
        
        row = await db.execute_one(query, *params)
        
        if not row:
            raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found after update")
        
        title = "Untitled"
        if row["text"]:
            text_lines = row["text"].split('\n')
            title = text_lines[0].strip() if text_lines and text_lines[0].strip() else "Untitled"
        
        tags = row.get("tags")
        if tags is None:
            tags = []
        elif isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except Exception:
                tags = []
        elif not isinstance(tags, list):
            tags = []
        
        created_at = row["created_at"].isoformat().replace('+00:00', 'Z') if row["created_at"] else None
        updated_at = row["updated_at"].isoformat().replace('+00:00', 'Z') if row["updated_at"] else None
        
        user_id = str(current_user.user.id) if current_user.user and current_user.user.id else None
        
        # Log activity
        await log_prompt_activity(
            db, prompt_id, "edited", user_id,
            f"Prompt updated: {title}",
            details={"fields_updated": list(prompt_data.keys())}
        )
        
        return {
            "id": row["id"],
            "title": title,
            "content": row["text"] or "",
            "description": row["intent"] or "",
            "category": row.get("category") or "",
            "tags": tags,
            "status": row["status"] or "pending",
            "created_at": created_at,
            "updated_at": updated_at,
            "usage_count": row.get("usage_count") or 0,
            "priority": row.get("priority") or 0,
            "estimated_duration": row.get("estimated_duration"),
            "starting_url": row.get("starting_url") or "",
            "test_type": row.get("test_type") or "web",
            "author_id": str(row["user_id"]) if row.get("user_id") else None,
            "version": row.get("version") or 1,
            "project_id": str(row["project_id"]) if row.get("project_id") else None,
            "external_id": row.get("external_id"),
            "parsed_plan": row.get("parsed_plan"),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating prompt %s: %s", prompt_id, str(e))
        raise HTTPException(status_code=500, detail=f"Error updating prompt: {str(e)}")


@router.delete("/prompts/{prompt_id}")
async def delete_prompt(
    prompt_id: str,
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Delete a prompt"""
    try:
        existing = await db.execute_one(
            "SELECT id FROM planner.prompts WHERE id = $1",
            prompt_id,
        )
        if not existing:
            raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")
        
        user_id = str(current_user.user.id) if current_user.user and current_user.user.id else None
        
        await db.execute_command(
            "DELETE FROM planner.prompts WHERE id = $1",
            prompt_id,
        )
        
        logger.info("Prompt %s deleted by user %s", prompt_id, user_id)
        
        return {"detail": f"Prompt {prompt_id} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting prompt %s: %s", prompt_id, str(e))
        raise HTTPException(status_code=500, detail=f"Error deleting prompt: {str(e)}")


# ---- Test plan helpers (used by main.py root endpoints) ----

async def get_test_plans_by_prompt(prompt_id: str, db: DatabaseManager) -> Dict[str, Any]:
    """Get all test plans for a given prompt"""
    try:
        rows = await db.fetch(
            """
            SELECT id, prompt_id, plan_json, platform_variants, confidence_score, model_used,
                   generation_time_ms, status, approved_by, approved_at,
                   created_at, updated_at
            FROM planner.plans
            WHERE prompt_id = $1
            ORDER BY created_at DESC
            """,
            prompt_id,
        )
        
        plans = []
        for row in rows:
            plan = {
                "id": str(row["id"]),
                "prompt_id": str(row["prompt_id"]),
                "plan_json": row["plan_json"],
                "platform_variants": row.get("platform_variants"),
                "confidence_score": float(row["confidence_score"]) if row.get("confidence_score") else None,
                "model_used": row.get("model_used"),
                "generation_time_ms": row.get("generation_time_ms"),
                "status": row.get("status") or "draft",
                "approved_by": str(row["approved_by"]) if row.get("approved_by") else None,
                "approved_at": row["approved_at"].isoformat().replace('+00:00', 'Z') if row.get("approved_at") else None,
                "created_at": row["created_at"].isoformat().replace('+00:00', 'Z') if row.get("created_at") else None,
                "updated_at": row["updated_at"].isoformat().replace('+00:00', 'Z') if row.get("updated_at") else None,
            }
            
            # Convert steps to dual selector format if present
            if plan["plan_json"] and isinstance(plan["plan_json"], dict):
                steps = plan["plan_json"].get("steps", [])
                if steps:
                    plan["plan_json"]["steps"] = convert_steps_to_dual_selector_format(steps)
            
            plans.append(plan)
        
        return {"plans": plans, "total": len(plans)}
        
    except Exception as e:
        logger.error("Error fetching test plans for prompt %s: %s", prompt_id, str(e))
        raise HTTPException(status_code=500, detail=f"Error fetching test plans: {str(e)}")


async def create_or_update_test_plan(test_plan_data: Dict[str, Any], db: DatabaseManager) -> Dict[str, Any]:
    """Create or update a test plan"""
    try:
        prompt_id = test_plan_data.get("prompt_id")
        if not prompt_id:
            raise HTTPException(status_code=400, detail="prompt_id is required")
        
        # Support both plan_json (dict with steps key) and generated_steps (flat list from frontend)
        plan_json = test_plan_data.get("plan_json")
        if not plan_json:
            generated_steps = test_plan_data.get("generated_steps", [])
            plan_json = {"steps": generated_steps}
        confidence_score = test_plan_data.get("confidence_score")
        model_used = test_plan_data.get("model_used") or test_plan_data.get("ai_model")
        generation_time_ms = test_plan_data.get("generation_time_ms") or test_plan_data.get("processing_time_ms")
        status = test_plan_data.get("status", "draft")
        plan_id = test_plan_data.get("id")
        platform_variants = test_plan_data.get("platform_variants")
        
        # Convert steps to dual selector format
        if isinstance(plan_json, dict):
            steps = plan_json.get("steps", [])
            if steps:
                plan_json["steps"] = convert_steps_to_dual_selector_format(steps)
        
        platform_variants_json = json.dumps(platform_variants) if platform_variants else None

        if plan_id:
            # Update existing plan
            row = await db.execute_one(
                """
                UPDATE planner.plans
                SET plan_json = $1::jsonb, confidence_score = $2, model_used = $3,
                    generation_time_ms = $4, status = $5, platform_variants = $6::jsonb,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING id, prompt_id, plan_json, confidence_score, model_used,
                          generation_time_ms, status, platform_variants, created_at, updated_at
                """,
                json.dumps(plan_json),
                confidence_score,
                model_used,
                generation_time_ms,
                status,
                platform_variants_json,
                plan_id,
            )
        else:
            # Create new plan
            row = await db.execute_one(
                """
                INSERT INTO planner.plans (prompt_id, plan_json, confidence_score, model_used, generation_time_ms, status, platform_variants)
                VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7::jsonb)
                RETURNING id, prompt_id, plan_json, confidence_score, model_used,
                          generation_time_ms, status, platform_variants, created_at, updated_at
                """,
                prompt_id,
                json.dumps(plan_json),
                confidence_score,
                model_used,
                generation_time_ms,
                status,
                platform_variants_json,
            )
        
        if not row:
            raise HTTPException(status_code=500, detail="Failed to save test plan")
        
        return {
            "id": str(row["id"]),
            "prompt_id": str(row["prompt_id"]),
            "plan_json": row["plan_json"],
            "platform_variants": row.get("platform_variants"),
            "confidence_score": float(row["confidence_score"]) if row.get("confidence_score") else None,
            "model_used": row.get("model_used"),
            "generation_time_ms": row.get("generation_time_ms"),
            "status": row.get("status") or "draft",
            "created_at": row["created_at"].isoformat().replace('+00:00', 'Z') if row.get("created_at") else None,
            "updated_at": row["updated_at"].isoformat().replace('+00:00', 'Z') if row.get("updated_at") else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error saving test plan: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Error saving test plan: {str(e)}")