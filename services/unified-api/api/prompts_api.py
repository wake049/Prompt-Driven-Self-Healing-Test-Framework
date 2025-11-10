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
    try:# Build tenant-aware query
        where_conditions = ["1=1"]
        query_params = []
        
        # Add tenant filtering
        if current_user.tenant and current_user.tenant.id:
            where_conditions.append("p.tenant_id = $" + str(len(query_params) + 1))
            query_params.append(str(current_user.tenant.id))
        elif current_user.project and current_user.project.id:
            where_conditions.append("p.project_id = $" + str(len(query_params) + 1))  
            query_params.append(str(current_user.project.id))
        
        where_clause = " AND ".join(where_conditions)
        
        # Query prompts from the planner.prompts table with tenant filtering
        query = f"""
        SELECT 
            p.id,
            p.text,
            p.intent,
            p.created_at,
            p.author_id,
            p.title,
            p.category,
            p.tags,
            p.starting_url,
            p.status,
            p.updated_at,
            p.version,
            p.usage_count,
            p.priority,
            p.estimated_duration
        FROM planner.prompts p
        WHERE {where_clause}
        ORDER BY p.created_at DESC
        """
        
        results = await db.execute(query, *query_params)
        
        # Format the results for the frontend
        prompts = []
        for row in results:
            # Use the dedicated title column, fallback to extracting from text if empty
            title = row["title"]
            if not title and row["text"]:
                text_lines = row["text"].split('\n')
                title = text_lines[0].strip() if text_lines else f"Prompt {row['id']}"
            elif not title:
                title = f"Prompt {row['id']}"
                
            prompt = {
                "id": row["id"],
                "title": title,
                "description": row["intent"] or "",
                "content": row["text"] or "",
                "category": row["category"] or "Functional",
                "starting_url": row["starting_url"] or "",
                "tags": row["tags"] or [],
                "status": row["status"] or "draft",
                "priority": row["priority"] or "medium",
                "version": row["version"] or 1,
                "usage_count": row["usage_count"] or 0,
                "estimated_duration": str(row["estimated_duration"]) if row["estimated_duration"] else None,
                "dateModified": (row["updated_at"] or row["created_at"]).isoformat() + "Z" if (row["updated_at"] or row["created_at"]) else None,
            }
            prompts.append(prompt)
        
        return {"prompts": prompts, "total": len(prompts)}
        
    except Exception as e:raise HTTPException(status_code=500, detail="Failed to fetch prompts")

@router.get("/prompts/{prompt_id}")
async def get_prompt(prompt_id: str, db: DatabaseManager = Depends(get_db)):
    """Get a specific prompt by ID"""
    try:
        query = """
        SELECT 
            p.id,
            p.text,
            p.intent,
            p.created_at,
            p.author_id,
            p.title,
            p.category,
            p.tags,
            p.starting_url,
            p.status,
            p.updated_at,
            p.version,
            p.usage_count,
            p.priority,
            p.estimated_duration
        FROM planner.prompts p
        WHERE p.id = $1
        """
        
        result = await db.execute_one(query, prompt_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="Prompt not found")
        
        # Use the dedicated title column, fallback to extracting from text if empty
        title = result["title"]
        if not title and result["text"]:
            text_lines = result["text"].split('\n')
            title = text_lines[0].strip() if text_lines else f"Prompt {result['id']}"
        elif not title:
            title = f"Prompt {result['id']}"
            
        prompt = {
            "id": result["id"],
            "title": title,
            "description": result["intent"] or "",
            "content": result["text"] or "",
            "category": result["category"] or "Functional",
            "starting_url": result["starting_url"] or "",
            "tags": result["tags"] or [],
            "status": result["status"] or "draft",
            "priority": result["priority"] or "medium",
            "version": result["version"] or 1,
            "usage_count": result["usage_count"] or 0,
            "estimated_duration": str(result["estimated_duration"]) if result["estimated_duration"] else None,
            "dateModified": result["created_at"].isoformat() + "Z" if result["created_at"] else None,
        }
        return prompt
        
    except HTTPException:
        raise
    except Exception as e:raise HTTPException(status_code=500, detail="Failed to fetch prompt")

@router.post("/prompts")
async def create_prompt(prompt_data: Dict[str, Any], db: DatabaseManager = Depends(get_db)):
    """Create a new prompt"""
    try:# Insert the new prompt into the correct schema
        # Use the actual planner.prompts table structure with explicit IDs
        insert_query = """
        INSERT INTO planner.prompts (
            tenant_id, project_id, author_id, text, intent, title, category, 
            tags, starting_url, status, priority, version, usage_count, estimated_duration
        )
        VALUES (
            'c315b3f7-ab14-4e65-a87f-447092d11171'::uuid, 
            '7b83ebdf-911f-464e-916a-abe229d5bdf4'::uuid, 
            '25616325-6f9d-4dad-8e4d-16affd24e7cf'::uuid, 
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        RETURNING id, text, intent, title, category, tags, starting_url, status, 
                  priority, version, usage_count, estimated_duration, created_at
        """
        
        # Map frontend fields to database columns
        title = prompt_data.get("title", "Untitled")
        # Handle both 'content' and 'text' field names for backward compatibility
        content = prompt_data.get("content", "") or prompt_data.get("text", "")
        # Handle both 'description' and 'intent' field names for backward compatibility
        intent_field = prompt_data.get("description", "") or prompt_data.get("intent", "")
        category = prompt_data.get("category", "Functional")
        tags = prompt_data.get("tags", [])
        starting_url = prompt_data.get("starting_url", "")
        status = prompt_data.get("status", "draft")
        priority = prompt_data.get("priority", "medium")
        version = prompt_data.get("version", 1)
        usage_count = prompt_data.get("usage_count", 0)
        
        # Parse estimated_duration if provided
        estimated_duration = None
        if prompt_data.get("estimated_duration"):
            try:
                # Assume duration is provided in minutes, convert to interval
                minutes = int(prompt_data["estimated_duration"])
                estimated_duration = f"{minutes} minutes"
            except (ValueError, TypeError):
                estimated_duration = None# Execute the insert with all the new fields
        result = await db.execute_one(
            insert_query,
            content,  # text field ($1)
            intent_field,  # intent field ($2)
            title,  # title field ($3)
            category,  # category field ($4)
            tags,  # tags field ($5)
            starting_url,  # starting_url field ($6)
            status,  # status field ($7)
            priority,  # priority field ($8)
            version,  # version field ($9)
            usage_count,  # usage_count field ($10)
            estimated_duration  # estimated_duration field ($11)
        )
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to create prompt")# Handle tags if provided (simplified since we don't have tags table in schema)
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
        
    except Exception as e:# Return the actual error for debugging
        raise HTTPException(status_code=500, detail=f"Failed to create prompt: {str(e)}")

@router.put("/prompts/{prompt_id}")
async def update_prompt(prompt_id: str, prompt_data: Dict[str, Any], db: DatabaseManager = Depends(get_db)):
    """Update an existing prompt"""
    try:# Update the prompt in the correct schema
        update_query = """
        UPDATE planner.prompts 
        SET text = $2, intent = $3, title = $4, category = $5, tags = $6, 
            starting_url = $7, status = $8, priority = $9, version = $10, 
            usage_count = $11, estimated_duration = $12, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, text, intent, title, category, tags, starting_url, status, 
                  priority, version, usage_count, estimated_duration, created_at, updated_at
        """
        
        # Parse estimated_duration if provided
        estimated_duration = None
        if prompt_data.get("estimated_duration"):
            try:
                # Assume duration is provided in minutes, convert to interval
                minutes = int(prompt_data["estimated_duration"])
                estimated_duration = f"{minutes} minutes"
            except (ValueError, TypeError):
                estimated_duration = None
        
        # Extract and log the actual values being used
        content_value = prompt_data.get("content", "")
        description_value = prompt_data.get("description", "")
        result = await db.execute_one(
            update_query,
            prompt_id,
            content_value,  # text
            description_value,  # intent
            prompt_data.get("title", "Untitled"),  # title
            prompt_data.get("category", "Functional"),  # category
            prompt_data.get("tags", []),  # tags
            prompt_data.get("starting_url", ""),  # starting_url
            prompt_data.get("status", "draft"),  # status
            prompt_data.get("priority", "medium"),  # priority
            prompt_data.get("version", 1),  # version
            prompt_data.get("usage_count", 0),  # usage_count
            estimated_duration  # estimated_duration
        )
        
        if not result:raise HTTPException(status_code=404, detail="Prompt not found")# Get the updated prompt with tags
        updated_prompt = await get_prompt(prompt_id, db)
        return updated_prompt
        
    except HTTPException:
        raise
    except Exception as e:raise HTTPException(status_code=500, detail="Failed to update prompt")

@router.get("/generated-test-plans/by-prompt/{prompt_id}")
async def get_test_plans_by_prompt(prompt_id: str, db: DatabaseManager = Depends(get_db)):
    """Get test plans for a specific prompt"""
    try:
        # Use the plans table from the correct schema
        query = """
        SELECT 
            pl.id, pl.prompt_id, pr.text as prompt_text, 
            pl.plan_json, pl.status, pl.created_at
        FROM planner.plans pl
        JOIN planner.prompts pr ON pl.prompt_id = pr.id
        WHERE pl.prompt_id = $1
        ORDER BY pl.created_at DESC
        """
        
        results = await db.execute(query, prompt_id)
        
        # Format the results
        plans = []
        for row in results:
            plan_json = row["plan_json"] if isinstance(row["plan_json"], dict) else json.loads(row["plan_json"]) if row["plan_json"] else {}
            steps = plan_json.get("steps", []) if plan_json else []
            
            plan = {
                "id": row["id"],
                "prompt_id": row["prompt_id"],
                "title": f"Test Plan for Prompt {row['prompt_id']}",
                "steps": steps,
                "status": row["status"] or "active",
                "created_at": row["created_at"].isoformat() + "Z" if row["created_at"] else None,
                "generation_success": True,
                "created_by": "system",
                "prompt_text": row["prompt_text"],
                "starting_url": "",
                "step_count": len(steps),
                "generation_method": "ai-powered",
                "ai_model": "gpt-4o",
                "enterprise_mode": True,
                "chunks_processed": 1,
                "processing_time_ms": 1000
            }
            plans.append(plan)
        
        return {"test_plans": plans, "total": len(plans)}
        
    except Exception as e:raise HTTPException(status_code=500, detail="Failed to fetch test plans")

@router.post("/generated-test-plans")
async def create_or_update_test_plan(test_plan_data: Dict[str, Any], db: DatabaseManager = Depends(get_db)):
    """Create or update a test plan"""
    try:
        prompt_id = test_plan_data.get("prompt_id")
        if not prompt_id:
            raise HTTPException(status_code=400, detail="prompt_id is required")
        
        steps = test_plan_data.get("generated_steps", test_plan_data.get("steps", []))
<<<<<<< Updated upstream
=======
        
        # Convert steps to dual selector format for better policy support
        try:
            steps_with_dual_selectors = convert_steps_to_dual_selector_format(steps)
        except Exception as e:
            steps_with_dual_selectors = steps  # Use original steps if conversion fails
        
>>>>>>> Stashed changes
        plan_json = {
            "steps": steps,
            "metadata": {
                "generation_method": test_plan_data.get("generation_method", "ai-powered"),
                "ai_model": test_plan_data.get("ai_model"),
                "enterprise_mode": test_plan_data.get("enterprise_mode", False),
                "processing_time_ms": test_plan_data.get("processing_time_ms"),
                "generation_success": test_plan_data.get("generation_success", True)
            }
        }
        
<<<<<<< Updated upstream
        logger.info(f" Saving test plan with {len(steps)} steps for prompt {prompt_id}")
        
=======
>>>>>>> Stashed changes
        # Check if a plan already exists for this prompt_id
        check_query = "SELECT id FROM planner.plans WHERE prompt_id = $1 ORDER BY created_at DESC LIMIT 1"
        existing_plan = await db.execute_one(check_query, prompt_id)
        
        if existing_plan:
            # Update existing plan
            update_query = """
            UPDATE planner.plans 
            SET plan_json = $1, updated_at = CURRENT_TIMESTAMP, status = $2
            WHERE id = $3
            RETURNING id, prompt_id, created_at, status
            """
            result = await db.execute_one(
                update_query,
                json.dumps(plan_json),
                "draft",
                existing_plan["id"]
            )
            # Insert new plan
            insert_query = """
            INSERT INTO planner.plans (prompt_id, status, plan_json)
            VALUES ($1, $2, $3)
            RETURNING id, prompt_id, created_at, status
            """
            result = await db.execute_one(
                insert_query,
                prompt_id,
                "draft",
                json.dumps(plan_json)
            )
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to create test plan")
        
        # Return the created plan
        new_plan = {
            "id": result["id"],
            "prompt_id": result["prompt_id"],
            "title": test_plan_data.get("title", f"Test Plan for Prompt {result['prompt_id']}"),
            "steps": plan_json.get("steps", []),
            "status": result["status"],
            "created_at": result["created_at"].isoformat() + "Z" if result["created_at"] else None,
            "generation_success": plan_json.get("metadata", {}).get("generation_success", True),
            "created_by": test_plan_data.get("created_by", "user")
        }
        
        return new_plan
    except Exception as e:raise HTTPException(status_code=500, detail="Failed to create test plan")

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
        
        results = await db.execute(query, limit)
        
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
        except Exception as table_error:# Try alternative table
            try:
                simple_query = "SELECT COUNT(*) FROM recorded_elements"
                count = await db.execute_scalar(simple_query)
            except Exception as alt_error:# Fallback to mock data if database fails
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