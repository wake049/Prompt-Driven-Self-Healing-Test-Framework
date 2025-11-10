"""
Bindings API - Manage data bindings for test plans
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional

import json
import uuid
from core.database import get_database, DatabaseManager
from core.binding_processor import BindingProcessor, create_cart_verification_bindings, create_price_verification_bindings
from schemas.enterprise import DataBinding, TestBindings, BindingContext
from core.auth import get_current_active_user
from models.auth_models import CurrentUser

router = APIRouter()

async def get_db() -> DatabaseManager:
    """Get database dependency"""
    return await get_database()

@router.get("/prompts/{prompt_id}/bindings")
async def get_prompt_bindings(
    prompt_id: str,
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Get bindings from datahub.data_bindings table"""
    try:
        print(f" GET /prompts/{prompt_id}/bindings endpoint reached!")
        print(f"👤 Current user: {current_user.user.email}")
        
        # Load active data bindings from datahub.data_bindings table
        bindings_query = """
            SELECT rule_name, scope, source_ref, target 
            FROM datahub.data_bindings 
            WHERE is_active = true 
            ORDER BY priority DESC, created_at DESC
        """
        
        db_bindings = await db.execute(bindings_query)
        
        # Convert to frontend format
        bindings = []
        for binding in db_bindings:
            # Parse JSON fields if they're strings
            import json
            
            source_ref = binding.get('source_ref', {})
            if isinstance(source_ref, str):
                try:
                    source_ref = json.loads(source_ref)
                except (json.JSONDecodeError, TypeError):
                    source_ref = {}
            
            target = binding.get('target', {})
            if isinstance(target, str):
                try:
                    target = json.loads(target)
                except (json.JSONDecodeError, TypeError):
                    target = {}
            
            # Extract binding information
            var_name = target.get('variable_name', binding.get('rule_name', 'unknown'))
            var_type = target.get('type', 'text')
            category = target.get('category', 'data')
            
            # Convert to frontend format
            if 'selector' in source_ref:
                # Data extraction binding
                frontend_binding = {
                    "name": var_name,
                    "description": f"Extract {category} from page elements",
                    "type": "extract",
                    "selector": source_ref.get('selector', ''),
                    "extract_type": source_ref.get('extract_type', 'text'),
                    "fallback_value": ""
                }
            elif 'formula' in source_ref:
                # Calculation binding
                frontend_binding = {
                    "name": var_name,
                    "description": f"Calculate {category} using formula",
                    "type": "formula",
                    "formula": source_ref.get('formula', ''),
                    "fallback_value": ""
                }
            else:
                # Default binding
                frontend_binding = {
                    "name": var_name,
                    "description": f"Variable: {var_name}",
                    "type": "extract",
                    "selector": "",
                    "extract_type": "text",
                    "fallback_value": ""
                }
            
            bindings.append(frontend_binding)

        return {"bindings": bindings}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get bindings")

@router.post("/prompts/{prompt_id}/bindings")
async def update_prompt_bindings(
    prompt_id: str,
    bindings_data: Dict[str, Any],
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Update bindings in datahub.data_bindings table"""
    try:
        print(f"🔄 POST /prompts/{prompt_id}/bindings endpoint reached!")
        print(f"👤 Current user: {current_user.user.email}")
        print(f" Bindings data: {bindings_data}")
        
        # Validate bindings data
        bindings = TestBindings(**bindings_data)
        print(f" Bindings validation successful: {len(bindings.bindings)} bindings")
        
        # Get or create a project ID for this user
        project_query = """
        SELECT id FROM core.projects LIMIT 1
        """
        project_result = await db.execute_one(project_query)
        
        if not project_result:
            # Create a default project
            project_id = str(uuid.uuid4())
            await db.execute_command("""
                INSERT INTO core.projects (id, name, description, created_at)
                VALUES ($1, $2, $3, NOW())
            """, project_id, 'Default Frontend Project', 'Auto-created project for frontend bindings')
            print(f" Created project: {project_id}")
        else:
            project_id = project_result['id']
        # Clear existing bindings for this project and prompt scope
        scope_name = f"prompt_{prompt_id}"
        await db.execute_command("""
            UPDATE datahub.data_bindings 
            SET is_active = false 
            WHERE project_id = $1 AND (scope = $2 OR scope LIKE 'prompt_%' OR scope = 'shopping_cart')
        """, project_id, scope_name)
        # Insert new bindings
        import time
        timestamp = int(time.time())
        
        for i, binding in enumerate(bindings.bindings):
            binding_id = str(uuid.uuid4())
            rule_name = f"{binding.name}_{timestamp}_{i}"  # Add timestamp for uniqueness
            
            # Prepare source_ref and target based on binding type
            if binding.type == "extract":
                source_ref = {
                    "selector": getattr(binding, 'selector', ''),
                    "extract_type": getattr(binding, 'extract_type', 'text'),
                    "attribute": getattr(binding, 'attribute', None) if hasattr(binding, 'attribute') else None
                }
                # Remove None values
                source_ref = {k: v for k, v in source_ref.items() if v is not None}
                
                target = {
                    "variable_name": binding.name,
                    "type": "text",  # Default type
                    "category": "extract"
                }
            elif binding.type == "formula":
                source_ref = {
                    "formula": getattr(binding, 'formula', '')
                }
                target = {
                    "variable_name": binding.name,
                    "type": "calculated",
                    "category": "formula"
                }
            else:  # constant or other
                source_ref = {
                    "value": getattr(binding, 'value', '')
                }
                target = {
                    "variable_name": binding.name,
                    "type": "constant",
                    "category": "constant"
                }
            
            # Insert the binding
            await db.execute_command("""
                INSERT INTO datahub.data_bindings 
                (id, project_id, rule_name, scope, matcher, source_ref, target, priority, is_active, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            """, 
            binding_id,
            project_id,
            rule_name,
            scope_name,
            json.dumps({"binding_type": binding.type}),  # Simple matcher
            json.dumps(source_ref),
            json.dumps(target),
            100 - i,  # Higher priority for earlier bindings
            True
            )
        # Verify the save by counting active bindings
        verify_query = """
        SELECT COUNT(*) as count
        FROM datahub.data_bindings 
        WHERE scope = $1 AND is_active = true
        """
        
        verify_result = await db.execute_one(verify_query, scope_name)
        saved_count = verify_result['count'] if verify_result else 0
        return {
            "success": True,
            "message": f"Successfully saved {len(bindings.bindings)} bindings",
            "bindings_count": len(bindings.bindings),
            "scope": scope_name
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to update bindings")
        
        return {
            "success": True,
            "message": f"Updated {len(bindings.bindings)} bindings",
            "bindings": bindings.dict()
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update bindings: {str(e)}")

@router.post("/prompts/{prompt_id}/bindings/generate-cart-verification")
async def generate_cart_verification_bindings(
    prompt_id: str,
    config: Dict[str, Any] = None,
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Generate pre-configured cart verification bindings"""
    try:
        config = config or {}
        
        # Generate bindings based on configuration
        if config.get("type") == "custom":
            item_selectors = config.get("item_selectors", [])
            total_selector = config.get("total_selector", "")
            
            if not item_selectors or not total_selector:
                raise HTTPException(status_code=400, detail="Custom bindings require item_selectors and total_selector")
            
            bindings = create_price_verification_bindings(item_selectors, total_selector)
        else:
            # Default SauceDemo cart verification
            bindings = create_cart_verification_bindings()
        
        # Update the prompt with generated bindings
        bindings_data = bindings.dict()
        
        # Get existing plan
        query = """
        SELECT plan_json 
        FROM planner.plans 
        WHERE prompt_id = $1
        """
        
        result = await db.execute_one(query, prompt_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="Plan not found for this prompt")
        
        # Update plan_json with new bindings
        plan_data = json.loads(result['plan_json'])
        plan_data['bindings'] = bindings_data
        
        # Save back to database
        update_query = """
        UPDATE planner.plans 
        SET plan_json = $1, updated_at = NOW()
        WHERE prompt_id = $2
        """
        
        await db.execute(update_query, json.dumps(plan_data), prompt_id)
        
        return {
            "success": True,
            "message": f"Generated {len(bindings.bindings)} cart verification bindings",
            "bindings": bindings_data,
            "description": "Auto-generated bindings for cart total verification"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate bindings: {str(e)}")

@router.post("/bindings/test")
async def test_bindings(
    bindings_data: Dict[str, Any],
    dom_data: Dict[str, Any] = None
):
    """Test bindings with mock DOM data"""
    try:
        # Validate bindings
        bindings = TestBindings(**bindings_data)
        
        # Create processor and test bindings
        processor = BindingProcessor()
        
        # Use mock DOM data if not provided
        if not dom_data:
            dom_data = {
                ".cart_item:nth-child(1) .inventory_item_price": {
                    "text": "$29.99",
                    "attributes": {}
                },
                ".cart_item:nth-child(2) .inventory_item_price": {
                    "text": "$7.99", 
                    "attributes": {}
                },
                ".summary_subtotal_label": {
                    "text": "Item total: $37.98",
                    "attributes": {}
                },
                ".summary_tax_label": {
                    "text": "Tax: $3.04",
                    "attributes": {}
                },
                ".summary_total_label": {
                    "text": "Total: $41.02",
                    "attributes": {}
                }
            }
        
        # Process bindings
        context = processor.process_bindings(bindings, dom_data)
        
        return {
            "success": True,
            "resolved_variables": context.variables,
            "binding_count": len(bindings.bindings),
            "test_data_used": dom_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to test bindings: {str(e)}")

@router.get("/bindings/templates")
async def get_binding_templates():
    """Get predefined binding templates"""
    try:
        templates = {
            "cart_verification": {
                "name": "Shopping Cart Verification",
                "description": "Verify that individual item prices sum correctly to cart total",
                "bindings": create_cart_verification_bindings().dict()
            },
            "price_range": {
                "name": "Price Range Verification",
                "description": "Verify that prices fall within expected ranges",
                "bindings": {
                    "bindings": [
                        {
                            "name": "product_price",
                            "type": "extract",
                            "selector": ".product-price",
                            "extract_type": "price"
                        },
                        {
                            "name": "min_price",
                            "type": "constant",
                            "value": 10.0
                        },
                        {
                            "name": "max_price", 
                            "type": "constant",
                            "value": 100.0
                        }
                    ]
                }
            },
            "form_validation": {
                "name": "Form Field Validation",
                "description": "Extract and validate form field values",
                "bindings": {
                    "bindings": [
                        {
                            "name": "username",
                            "type": "extract",
                            "selector": "#username",
                            "extract_type": "attribute",
                            "attribute": "value"
                        },
                        {
                            "name": "email",
                            "type": "extract", 
                            "selector": "#email",
                            "extract_type": "attribute",
                            "attribute": "value"
                        }
                    ]
                }
            }
        }
        
        return {
            "success": True,
            "templates": templates
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to get binding templates")
