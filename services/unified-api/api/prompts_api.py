"""
Prompts API - Database-connected implementation for prompt management with multi-tenant support
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from datetime import datetime

import json
from core.database import get_database, DatabaseManager
from core.auth import get_current_active_user
from models.auth_models import CurrentUser
from services.selector_conversion import convert_steps_to_dual_selector_format

router = APIRouter()

async def get_db() -> DatabaseManager:
    """Get database dependency"""
    return await get_database()

@router.get("/prompts/debug")
async def get_prompts_debug():
    """Debug endpoint with mock data - no auth required"""
    mock_prompts = [
        {
            "id": "550e8400-e29b-41d4-a716-446655440001",  # UUID format
            "title": "Add backpack and onesie to cart and verify the total",
            "text": "Navigate to the website and add a backpack and onesie to the shopping cart, then verify the total is calculated correctly.",
            "intent": "Test e-commerce cart functionality with multiple items",
            "category": "Functional",
            "tags": ["ecommerce", "cart", "functional"],
            "created_at": "2025-01-01T10:00:00Z",
            "updated_at": "2025-01-02T15:30:00Z",
            "usage_count": 5,
            "status": "active"
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440002",  # UUID format
            "title": "Add Onesie to cart",
            "text": "Navigate to the product page and add a onesie to the shopping cart.",
            "intent": "Test adding individual items to cart",
            "category": "Functional",
            "tags": ["ecommerce", "cart"],
            "created_at": "2025-01-01T11:00:00Z",
            "updated_at": "2025-01-01T11:00:00Z",
            "usage_count": 3,
            "status": "active"
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440003",  # UUID format
            "title": "Add t shirt to chart",
            "text": "Navigate to the product page and add a t-shirt to the shopping cart.",
            "intent": "Test adding apparel items to cart",
            "category": "Functional", 
            "tags": ["ecommerce", "apparel"],
            "created_at": "2025-01-01T12:00:00Z",
            "updated_at": "2025-01-01T12:00:00Z",
            "usage_count": 2,
            "status": "active"
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440004",  # UUID format
            "title": "Add backpack to cart",
            "text": "Navigate to the product page and add a backpack to the shopping cart.",
            "intent": "Test adding accessories to cart",
            "category": "Functional",
            "tags": ["ecommerce", "accessories"],
            "created_at": "2025-01-01T09:00:00Z",
            "updated_at": "2025-01-01T09:00:00Z", 
            "usage_count": 8,
            "status": "active"
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440005",  # UUID format
            "title": "Simple Login",
            "text": "Navigate to the login page and perform a simple login with valid credentials.",
            "intent": "Test basic authentication flow",
            "category": "Authentication",
            "tags": ["auth", "login", "security"],
            "created_at": "2025-01-01T08:00:00Z",
            "updated_at": "2025-01-02T14:00:00Z",
            "usage_count": 12,
            "status": "active"
        }
    ]
    
    # Format the results for the frontend exactly like the real endpoint
    prompts = []
    for mock_prompt in mock_prompts:
        prompt = {
            "id": mock_prompt["id"],
            "title": mock_prompt["title"],
            "text": mock_prompt["text"],  # Frontend looks for 'text' field
            "intent": mock_prompt["intent"],  # Frontend looks for 'intent' field
            "content": mock_prompt["text"],
            "category": mock_prompt["category"],
            "starting_url": "",
            "tags": mock_prompt["tags"],
            "status": mock_prompt["status"],
            "priority": "medium",
            "version": 1,
            "usage_count": mock_prompt["usage_count"],
            "estimated_duration": "5 minutes",
            "updated_at": mock_prompt["updated_at"],  # Frontend looks for 'updated_at'
            "created_at": mock_prompt["created_at"],  # Frontend looks for 'created_at'
        }
        prompts.append(prompt)
    
    return {"prompts": prompts, "total": len(prompts)}

@router.get("/prompts/debug/{prompt_id}")
async def get_prompt_debug(prompt_id: str):
    """Debug endpoint for individual prompt - no auth required"""
    mock_prompts = [
        {
            "id": "550e8400-e29b-41d4-a716-446655440001",
            "title": "Add backpack and onesie to cart and verify the total",
            "text": "Navigate to the website and add a backpack and onesie to the shopping cart, then verify the total is calculated correctly.",
            "intent": "Test e-commerce cart functionality with multiple items",
            "category": "Functional",
            "tags": ["ecommerce", "cart", "functional"],
            "created_at": "2025-01-01T10:00:00Z",
            "updated_at": "2025-01-02T15:30:00Z",
            "usage_count": 5,
            "status": "active"
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "title": "Add Onesie to cart",
            "text": "Navigate to the product page and add a onesie to the shopping cart.",
            "intent": "Test adding individual items to cart",
            "category": "Functional",
            "tags": ["ecommerce", "cart"],
            "created_at": "2025-01-01T11:00:00Z",
            "updated_at": "2025-01-01T11:00:00Z",
            "usage_count": 3,
            "status": "active"
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440003",
            "title": "Add t shirt to chart",
            "text": "Navigate to the product page and add a t-shirt to the shopping cart.",
            "intent": "Test adding apparel items to cart",
            "category": "Functional", 
            "tags": ["ecommerce", "apparel"],
            "created_at": "2025-01-01T12:00:00Z",
            "updated_at": "2025-01-01T12:00:00Z",
            "usage_count": 2,
            "status": "active"
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440004",
            "title": "Add backpack to cart",
            "text": "Navigate to the product page and add a backpack to the shopping cart.",
            "intent": "Test adding accessories to cart",
            "category": "Functional",
            "tags": ["ecommerce", "accessories"],
            "created_at": "2025-01-01T09:00:00Z",
            "updated_at": "2025-01-01T09:00:00Z", 
            "usage_count": 8,
            "status": "active"
        },
        {
            "id": "550e8400-e29b-41d4-a716-446655440005",
            "title": "Simple Login",
            "text": "Navigate to the login page and perform a simple login with valid credentials.",
            "intent": "Test basic authentication flow",
            "category": "Authentication",
            "tags": ["auth", "login", "security"],
            "created_at": "2025-01-01T08:00:00Z",
            "updated_at": "2025-01-02T14:00:00Z",
            "usage_count": 12,
            "status": "active"
        }
    ]
    
    # Find the specific prompt
    mock_prompt = next((p for p in mock_prompts if p["id"] == prompt_id), None)
    
    if not mock_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    # Format for frontend
    prompt = {
        "id": mock_prompt["id"],
        "title": mock_prompt["title"],
        "text": mock_prompt["text"],
        "intent": mock_prompt["intent"],
        "content": mock_prompt["text"],
        "description": mock_prompt["intent"],
        "category": mock_prompt["category"],
        "starting_url": "",
        "tags": mock_prompt["tags"],
        "status": mock_prompt["status"],
        "priority": "medium",
        "version": 1,
        "usage_count": mock_prompt["usage_count"],
        "estimated_duration": "5 minutes",
        "updated_at": mock_prompt["updated_at"],
        "created_at": mock_prompt["created_at"],
    }
    
    return prompt

@router.get("/prompts")
async def get_prompts(
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get all prompts from database with tenant filtering"""
    try:
        # Build tenant-aware query
        where_conditions = ["1=1"]
        query_params = []
        
        # Add tenant filtering to show user's prompts + examples in same tenant
        if current_user.project and current_user.project.id and current_user.tenant and current_user.tenant.id:
            where_conditions.append("EXISTS (SELECT 1 FROM core.projects proj WHERE proj.id = p.project_id AND proj.tenant_id = $" + str(len(query_params) + 1) + ")")
            query_params.append(str(current_user.tenant.id))
        elif current_user.project and current_user.project.id:
            # Fallback to project-only if no tenant
            where_conditions.append("p.project_id = $" + str(len(query_params) + 1))  
            query_params.append(str(current_user.project.id))
        
        where_clause = " AND ".join(where_conditions)
        
        # Query prompts from the planner.prompts table with project filtering - include new columns
        query = f"""
        SELECT 
            p.id,
            p.text,
            p.intent,
            p.starting_url,
            p.category,
            p.tags,
            p.priority,
            p.version,
            p.usage_count,
            p.estimated_duration,
            p.created_at,
            p.updated_at,
            p.project_id,
            p.user_id,
            p.status,
            p.parsed_plan
        FROM planner.prompts p
        WHERE {where_clause}
        ORDER BY p.created_at DESC
        """
        
        results = await db.fetch(query, *query_params)
        
        # Format the results for the frontend
        prompts = []
        for row in results:
            # Always extract title from text content (first line)
            title = "Untitled"
            if row["text"]:
                text_lines = row["text"].split('\n')
                title = text_lines[0].strip() if text_lines and text_lines[0].strip() else "Untitled"
                
            # Ensure tags is properly parsed as JSON array
            tags = row["tags"]
            if tags is None:
                tags = []
            elif isinstance(tags, str):
                try:
                    import json
                    tags = json.loads(tags)
                except:
                    tags = []
            elif not isinstance(tags, list):
                tags = []
                
            prompt = {
                "id": row["id"],
                "title": title,
                "description": row["intent"] or "",
                "content": row["text"] or "",
                "category": row["category"] or "Functional",
                "starting_url": row["starting_url"] or "",
                "tags": tags,
                "status": row["status"] or "draft",
                "priority": row["priority"] or "medium",
                "version": row["version"] or 1,
                "usage_count": row["usage_count"] or 0,
                "estimated_duration": row["estimated_duration"],
                "dateModified": (row["updated_at"] or row["created_at"]).isoformat() + "Z" if (row["updated_at"] or row["created_at"]) else None,
                "created_at": row["created_at"].isoformat() + "Z" if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() + "Z" if row["updated_at"] else None,
            }
            prompts.append(prompt)
        
        return {"prompts": prompts, "total": len(prompts)}
        
    except Exception as e:
        print(f"❌ Exception in get_prompts: {str(e)}")
        print(f"💥 Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch prompts: {str(e)}")

@router.get("/prompts/{prompt_id}")
async def get_prompt(prompt_id: str, db: DatabaseManager = Depends(get_db)):
    """Get a specific prompt by ID"""
    try:
        query = """
        SELECT 
            p.id,
            p.text,
            p.intent,
            p.starting_url,
            p.category,
            p.tags,
            p.priority,
            p.version,
            p.usage_count,
            p.estimated_duration,
            p.created_at,
            p.updated_at,
            p.project_id,
            p.user_id,
            p.status,
            p.parsed_plan
        FROM planner.prompts p
        WHERE p.id = $1
        """
        
        result = await db.execute_one(query, prompt_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        # Always extract title from text content (first line)
        title = "Untitled"
        if result["text"]:
            text_lines = result["text"].split('\n')
            title = text_lines[0].strip() if text_lines and text_lines[0].strip() else "Untitled"
        
        # Ensure tags is properly parsed as JSON array
        tags = result["tags"]
        if tags is None:
            tags = []
        elif isinstance(tags, str):
            try:
                import json
                tags = json.loads(tags)
            except:
                tags = []
        elif not isinstance(tags, list):
            tags = []
            
        prompt = {
            "id": result["id"],
            "title": title,
            "description": result["intent"] or "",
            "content": result["text"] or "",
            "category": result["category"] or "Functional",
            "starting_url": result["starting_url"] or "",
            "tags": tags,
            "status": result["status"] or "draft",
            "priority": result["priority"] or "medium",
            "version": result["version"] or 1,
            "usage_count": result["usage_count"] or 0,
            "estimated_duration": result["estimated_duration"],
            "dateModified": result["created_at"].isoformat() + "Z" if result["created_at"] else None,
            "created_at": result["created_at"].isoformat() + "Z" if result["created_at"] else None,
            "updated_at": result["updated_at"].isoformat() + "Z" if result["updated_at"] else None,
        }
        return prompt
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Exception in get_prompt: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch prompt")

@router.post("/prompts")
async def create_prompt(
    prompt_data: Dict[str, Any], 
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Create a new prompt"""
    try:
        print(f"🔍 Received prompt data: {prompt_data}")
        print(f"🔍 Database manager: {db}")
        
        # Ensure user has a project
        if not current_user.project or not current_user.project.id:
            raise HTTPException(status_code=400, detail="User must be assigned to a project to create prompts")
        
        # Insert the new prompt into the correct schema
        # Use the actual planner.prompts table structure based on schema
        insert_query = """
        INSERT INTO planner.prompts (
            project_id, user_id, text, intent, status
        )
        VALUES (
            $1, $2, $3, $4, $5
        )
        RETURNING id, project_id, user_id, text, intent, status, created_at, updated_at
        """
        
        print("🔍 Preparing query parameters...")
        # Map frontend fields to database columns
        title = prompt_data.get("title", "Untitled")
        # Handle both 'content' and 'text' field names for backward compatibility
        content = prompt_data.get("content", "") or prompt_data.get("text", "")
        # Handle both 'description' and 'intent' field names for backward compatibility
        intent_field = prompt_data.get("description", "") or prompt_data.get("intent", "")
        category = prompt_data.get("category", "Functional")
        tags = prompt_data.get("tags", [])
        # Use current user's project and user ID
        project_id = str(current_user.project.id)
        user_id = str(current_user.user.id)
        status = prompt_data.get("status", "pending")
        
        # Execute the insert with the correct parameters for the actual schema
        print(f"🔍 Executing database query with parameters:")
        print(f"   project_id: {project_id}")
        print(f"   user_id: {user_id}")
        print(f"   text: {content}")
        print(f"   intent: {intent_field}")
        print(f"   status: {status}")
        
        result = await db.execute_one(
            insert_query,
            project_id,   # project_id ($1)
            user_id,      # user_id ($2)
            content,      # text ($3)
            intent_field, # intent ($4)
            status        # status ($5)
        )
        
        print(f"🔍 Database query result: {result}")
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to create prompt")
        
        # Handle tags if provided (simplified since we don't have tags table in schema)
        tags = []
        
        # Format response to match frontend expectations
        # Extract title from text field (first line)
        text_lines = result["text"].split('\n') if result["text"] else ["Untitled"]
        extracted_title = text_lines[0] if text_lines else "Untitled"
        extracted_content = '\n'.join(text_lines[2:]) if len(text_lines) > 2 else ""
        
        new_prompt = {
            "id": result["id"],
            "title": extracted_title,
            "description": result["intent"] or "",
            "content": extracted_content,
            "category": prompt_data.get("category", "Functional"),
            "tags": tags,
            "dateModified": result["created_at"].isoformat() + "Z" if result["created_at"] else None,
            "usage_count": 0,
            "starting_url": prompt_data.get("starting_url", ""),
            "created_by": "user"
        }
        
        return new_prompt
        
    except Exception as e:
        print(f"❌ Exception in create_prompt: {str(e)}")
        print(f"❌ Exception type: {type(e)}")
        import traceback
        traceback.print_exc()
        # Return the actual error for debugging
        raise HTTPException(status_code=500, detail=f"Failed to create prompt: {str(e)}")

@router.put("/prompts/{prompt_id}")
async def update_prompt(
    prompt_id: str, 
    prompt_data: Dict[str, Any], 
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Update an existing prompt"""
    try:
        # Debug logging
        print(f"🔧 Updating prompt {prompt_id}")
        print(f"📝 Received data: {prompt_data}")
        
        # Ensure user has a project
        if not current_user.project or not current_user.project.id:
            raise HTTPException(status_code=400, detail="User must be assigned to a project to update prompts")
        
        # Verify the prompt belongs to the user's project
        verify_query = """
        SELECT id FROM planner.prompts 
        WHERE id = $1 AND project_id = $2
        """
        prompt_check = await db.execute_one(verify_query, prompt_id, str(current_user.project.id))
        
        if not prompt_check:
            raise HTTPException(status_code=404, detail="Prompt not found or not accessible")
        
        # Extract values with fallbacks
        content_value = prompt_data.get("content") or prompt_data.get("text", "")
        description_value = prompt_data.get("description") or prompt_data.get("intent", "")
        
        print(f"📋 Using values:")
        print(f"  content: {content_value[:50]}...")
        print(f"  description: {description_value[:50]}...")
        print(f"  starting_url: {prompt_data.get('starting_url', '')}")
        
        # Update using the new columns in the schema (excluding title since we extract it from text)
        update_query = """
        UPDATE planner.prompts 
        SET text = $2, intent = $3, starting_url = $4, category = $5, 
            tags = $6, priority = $7, version = $8, usage_count = $9, 
            estimated_duration = $10, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND project_id = $11
        RETURNING id, text, intent, starting_url, category, tags, 
                  priority, version, usage_count, estimated_duration, 
                  status, created_at, updated_at
        """
        
        # Serialize tags as JSON string for database storage
        tags_value = prompt_data.get("tags", [])
        if isinstance(tags_value, list):
            import json
            tags_json = json.dumps(tags_value)
        else:
            tags_json = str(tags_value) if tags_value is not None else "[]"
        
        result = await db.execute_one(
            update_query,
            prompt_id,
            content_value,  # text
            description_value,  # intent
            prompt_data.get("starting_url", ""),  # starting_url
            prompt_data.get("category", "Functional"),  # category
            tags_json,  # tags (serialized as JSON string)
            prompt_data.get("priority", "medium"),  # priority
            prompt_data.get("version", 1),  # version
            prompt_data.get("usage_count", 0),  # usage_count
            prompt_data.get("estimated_duration"),  # estimated_duration
            str(current_user.project.id)  # project_id for WHERE clause ($11)
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        print(f"✅ Update successful")
        
        # Get the updated prompt with metadata
        updated_prompt = await get_prompt(prompt_id, db)
        return updated_prompt
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Update failed: {str(e)}")
        print(f"💥 Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update prompt: {str(e)}")

@router.get("/generated-test-plans/by-prompt/{prompt_id}/debug")
async def get_test_plans_by_prompt_debug(prompt_id: str):
    """Debug endpoint for getting test plans - no auth required"""
    try:
        # Return mock test plans for debug mode
        mock_plans = [
            {
                "id": "plan_1",
                "prompt_id": prompt_id,
                "title": f"Test Plan for Prompt {prompt_id}",
                "steps": [
                    {
                        "action": "navigate",
                        "url": "https://example.com",
                        "description": "Navigate to the website"
                    },
                    {
                        "action": "click",
                        "selector": "button.login",
                        "description": "Click the login button"
                    }
                ],
                "status": "active",
                "created_at": "2025-01-01T10:00:00Z",
                "generation_success": True,
                "created_by": "debug-system",
                "prompt_text": "Sample prompt text",
                "starting_url": "",
                "step_count": 2,
                "generation_method": "ai-powered",
                "ai_model": "gpt-4o",
                "enterprise_mode": True,
                "chunks_processed": 1,
                "processing_time_ms": 1000
            }
        ]
        
        return {"test_plans": mock_plans, "total": len(mock_plans)}
        
    except Exception as e:
        print(f"❌ Exception in get_test_plans_by_prompt_debug: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch test plans")

@router.get("/generated-test-plans/by-prompt/{prompt_id}")
async def get_test_plans_by_prompt(prompt_id: str, db: DatabaseManager = Depends(get_db)):
    """Get test plans for a specific prompt from database"""
    try:
        # Query the planner.plans table for this prompt
        plans_query = """
        SELECT 
            id,
            prompt_id,
            plan_json,
            confidence_score,
            model_used,
            generation_time_ms,
            status,
            created_at,
            updated_at
        FROM planner.plans 
        WHERE prompt_id = $1 AND status = 'active'
        ORDER BY created_at DESC
        """
        
        plans = await db.fetch(plans_query, prompt_id)
        
        if not plans:
            return {"test_plans": [], "total": 0}
        
        # Transform database results to frontend format
        test_plans = []
        for plan in plans:
            try:
                # Parse the JSON plan data
                plan_data = plan['plan_json']
                if isinstance(plan_data, str):
                    plan_data = json.loads(plan_data)
                
                # Extract steps from the plan data
                steps = plan_data.get('steps', [])
                metadata = plan_data.get('metadata', {})
                
                test_plan = {
                    "id": plan['id'],
                    "prompt_id": plan['prompt_id'], 
                    "title": f"Test Plan for Prompt {prompt_id}",
                    "steps": steps,  # This contains the actual 8 steps from your data
                    "status": plan['status'],
                    "created_at": plan['created_at'].isoformat() if plan['created_at'] else None,
                    "updated_at": plan['updated_at'].isoformat() if plan['updated_at'] else None,
                    "generation_success": True,
                    "created_by": "ai-system",
                    "prompt_text": metadata.get('prompt_text', ''),
                    "starting_url": "",
                    "step_count": len(steps),
                    "generation_method": metadata.get('generation_method', 'ai-powered'),
                    "ai_model": plan['model_used'],
                    "enterprise_mode": True,
                    "chunks_processed": 1,
                    "processing_time_ms": plan['generation_time_ms'],
                    "confidence_score": plan['confidence_score'],
                    "total_elements_count": 0,
                    "original_step_count": len(steps)
                }
                
                test_plans.append(test_plan)
                
            except Exception as parse_error:
                print(f"❌ Error parsing plan {plan['id']}: {str(parse_error)}")
                continue
        
        return {"test_plans": test_plans, "total": len(test_plans)}
        
    except Exception as e:
        print(f"❌ Exception in get_test_plans_by_prompt: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to fetch test plans")

@router.post("/generated-test-plans/debug")
async def create_or_update_test_plan_debug(test_plan_data: Dict[str, Any]):
    """Debug endpoint for creating test plans - no auth required"""
    try:
        prompt_id = test_plan_data.get("prompt_id")
        if not prompt_id:
            raise HTTPException(status_code=400, detail="prompt_id is required")
        
        steps = test_plan_data.get("generated_steps", test_plan_data.get("steps", []))
        
        # For debug mode, just return a successful response without actually saving to database
        import uuid
        new_plan_id = str(uuid.uuid4())
        
        new_plan = {
            "id": new_plan_id,
            "prompt_id": prompt_id,
            "title": test_plan_data.get("title", f"Test Plan for Prompt {prompt_id}"),
            "steps": steps,
            "status": "draft",
            "created_at": "2025-01-01T12:00:00Z",
            "generation_success": True,
            "created_by": "debug-user"
        }
        
        return new_plan
        
    except Exception as e:
        print(f"❌ Exception in create_or_update_test_plan_debug: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to create test plan")

@router.post("/generated-test-plans")
async def create_or_update_test_plan(test_plan_data: Dict[str, Any], db: DatabaseManager = Depends(get_db)):
    """Create or update a test plan"""
    try:
        prompt_id = test_plan_data.get("prompt_id")
        if not prompt_id:
            raise HTTPException(status_code=400, detail="prompt_id is required")
        
        steps = test_plan_data.get("generated_steps", test_plan_data.get("steps", []))
        
        # Check if prompt exists in planner.prompts table
        prompt_check_query = "SELECT id FROM planner.prompts WHERE id = $1::uuid"
        prompt_exists = await db.execute_one(prompt_check_query, prompt_id)
        
        if not prompt_exists:
            raise HTTPException(status_code=404, detail=f"Prompt {prompt_id} not found")
        
        # Create the plan_json structure that matches what the execution endpoint expects
        plan_json = {
            "steps": steps,
            "metadata": {
                "prompt_id": prompt_id,
                "generation_method": test_plan_data.get("generation_method", "ai-powered"),
                "ai_model": test_plan_data.get("ai_model", "gpt-4o"),
                "step_count": len(steps),
                "created_at": test_plan_data.get("created_at", "2025-01-01T12:00:00Z")
            }
        }
        
        # Insert into planner.plans table
        import uuid
        import json
        new_plan_id = str(uuid.uuid4())
        
        insert_query = """
        INSERT INTO planner.plans (
            id, prompt_id, plan_json, status, model_used, created_at
        ) VALUES ($1, $2::uuid, $3, $4, $5, NOW())
        RETURNING id, created_at
        """
        
        result = await db.execute_one(
            insert_query,
            new_plan_id,
            prompt_id,
            json.dumps(plan_json),
            "active",  # status
            test_plan_data.get("ai_model", "gpt-4o")
        )
        
        new_plan = {
            "id": result["id"] if result else new_plan_id,
            "prompt_id": prompt_id,
            "title": test_plan_data.get("title", f"Test Plan for Prompt {prompt_id}"),
            "steps": steps,
            "status": "active",
            "created_at": result["created_at"].isoformat() if result else "2025-01-01T12:00:00Z",
            "generation_success": True,
            "created_by": "user"
        }
        
        return new_plan
        
    except Exception as e:
        print(f"❌ Exception in create_or_update_test_plan: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to create test plan")

@router.get("/elements")
async def get_elements(limit: int = 100, db: DatabaseManager = Depends(get_db)):
    """Get page elements from database"""
    try:
        # Use the correct elements table from the schema
        query = """
        SELECT 
            e.id, e.element_key, e.primary_selector, e.alt_selectors,
            e.attributes, e.ai_reasoning, e.is_active, e.created_at,
            e.updated_at, p.name as page_name, p.route_hint
        FROM repo.elements e
        JOIN repo.pages p ON e.page_id = p.id
        WHERE e.is_active = true
        ORDER BY e.created_at DESC
        LIMIT $1
        """
        
        results = await db.fetch(query, limit)
        
        # Format the results for the frontend
        elements = []
        for row in results:
            # Parse selectors
            primary_selector = row["primary_selector"] if isinstance(row["primary_selector"], dict) else json.loads(row["primary_selector"]) if row["primary_selector"] else {}
            alt_selectors = row["alt_selectors"] if isinstance(row["alt_selectors"], list) else json.loads(row["alt_selectors"]) if row["alt_selectors"] else []
            
            element = {
                "id": row["id"],
                "tag": primary_selector.get("tag", "div"),
                "type": primary_selector.get("tag", "div"),
                "name": row["element_key"],
                "text": primary_selector.get("text", ""),
                "placeholder": f"Enter {row['element_key']}",
                "xpath": primary_selector.get("xpath", ""),
                "css_selector": primary_selector.get("css", ""),
                "attributes": row["attributes"] if isinstance(row["attributes"], dict) else json.loads(row["attributes"]) if row["attributes"] else {},
                "selectors": {
                    "primary": primary_selector,
                    "alternatives": alt_selectors
                },
                "page": row["page_name"],
                "url": row["route_hint"] or row["page_name"],
                "element_key": row["element_key"],
                "ai_reasoning": row["ai_reasoning"],
                "created_at": row["created_at"].isoformat() + "Z" if row["created_at"] else None,
                "last_updated": row["updated_at"].isoformat() + "Z" if row["updated_at"] else None,
                "is_active": row["is_active"]
            }
            elements.append(element)
        
        return {"elements": elements, "total": len(elements)}
        
    except Exception as e:
        
        # Try a simpler query to check if table exists
        try:
            simple_query = "SELECT COUNT(*) FROM repo.elements"
            count = await db.execute_scalar(simple_query)
        except Exception as table_error:
            # Try alternative table
            try:
                simple_query = "SELECT COUNT(*) FROM recorded_elements"
                count = await db.execute_scalar(simple_query)
            except Exception as alt_error:
                # Fallback to mock data if database fails
                mock_elements = [
                {
                    "id": "el_1",
                    "tag": "input",
                    "type": "text",
                    "name": "username",
                    "placeholder": "Enter username",
                    "xpath": "//input[@name='username']",
                    "css_selector": "input[name='username']",
                    "page": "login"
                },
                {
                    "id": "el_2",
                    "tag": "input",
                    "type": "password",
                    "name": "password",
                    "placeholder": "Enter password",
                    "xpath": "//input[@name='password']",
                    "css_selector": "input[name='password']",
                    "page": "login"
                },
                {
                    "id": "el_3",
                    "tag": "button",
                    "type": "submit",
                    "text": "Login",
                    "name": "login_button",
                    "xpath": "//button[@type='submit']",
                    "css_selector": "button[type='submit']",
                    "page": "login"
                }
        ]
        
        # Apply limit
        limited_elements = mock_elements[:limit]
        return {"elements": limited_elements, "total": len(mock_elements)}