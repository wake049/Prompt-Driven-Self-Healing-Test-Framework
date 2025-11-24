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
            SELECT name, binding_type, source_config, schema_definition 
            FROM datahub.data_bindings 
            WHERE is_active = true 
            ORDER BY created_at DESC
        """
        
        db_bindings = await db.fetch(bindings_query)
        print(f"🔍 Found {len(db_bindings) if db_bindings else 0} bindings in database")
        
        # Convert to frontend format
        bindings = []
        for binding in db_bindings:
            # Parse JSON fields if they're strings
            import json
            
            source_config = binding.get('source_config', {})
            if isinstance(source_config, str):
                try:
                    source_config = json.loads(source_config)
                except (json.JSONDecodeError, TypeError):
                    source_config = {}
            
            schema_definition = binding.get('schema_definition', {})
            if isinstance(schema_definition, str):
                try:
                    schema_definition = json.loads(schema_definition)
                except (json.JSONDecodeError, TypeError):
                    schema_definition = {}
            
            # Extract binding information
            var_name = binding.get('name', 'unknown')
            binding_type = binding.get('binding_type', 'extract')
            
            # Convert to frontend format based on binding type
            print(f"🔍 Processing binding for GET: name='{var_name}', binding_type='{binding_type}', source_config keys: {list(source_config.keys())}")
            
            if binding_type == 'constant':
                # Constant value binding
                frontend_binding = {
                    "name": var_name,
                    "description": f"Variable: {var_name}",
                    "type": "constant",
                    "value": source_config.get('value', ''),
                    "fallback_value": source_config.get('fallback_value', '')
                }
                print(f"   → Returned as CONSTANT with value: '{source_config.get('value', '')}'")
            elif binding_type == 'formula':
                # Calculation binding
                frontend_binding = {
                    "name": var_name,
                    "description": f"Calculate value using formula",
                    "type": "formula",
                    "formula": source_config.get('formula', ''),
                    "fallback_value": source_config.get('fallback_value', '')
                }
                print(f"   → Returned as FORMULA")
            elif binding_type == 'extract':
                # Data extraction binding
                frontend_binding = {
                    "name": var_name,
                    "description": f"Extract data from page elements",
                    "type": "extract",
                    "selector": source_config.get('selector', ''),
                    "extract_type": source_config.get('extract_type', 'text'),
                    "fallback_value": source_config.get('fallback_value', '')
                }
                print(f"   → Returned as EXTRACT")
            else:
                # Default to extract binding
                print(f"   → WARNING: Unknown binding type '{binding_type}', defaulting to extract")
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
        print(f"❌ Error in get_prompt_bindings: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get bindings: {str(e)}")

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
        try:
            bindings = TestBindings(**bindings_data)
            print(f" Bindings validation successful: {len(bindings.bindings)} bindings")
        except Exception as validation_error:
            print(f" Bindings validation failed: {validation_error}")
            print(f" Validation error details: {type(validation_error).__name__}: {str(validation_error)}")
            raise HTTPException(status_code=400, detail=f"Invalid bindings data: {str(validation_error)}")
        
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
        # Deactivate existing bindings that will be replaced (only those with matching names)
        binding_names = [binding.name for binding in bindings.bindings]
        if binding_names:
            placeholders = ', '.join(['$' + str(i+2) for i in range(len(binding_names))])
            deactivate_query = f"""
                UPDATE datahub.data_bindings 
                SET is_active = false 
                WHERE project_id = $1 AND name IN ({placeholders})
            """
            await db.execute_command(deactivate_query, project_id, *binding_names)
            print(f"🗑️ Deactivated existing bindings for names: {binding_names}")
        else:
            print("🗑️ No bindings to deactivate")
        # Insert new bindings
        import time
        timestamp = int(time.time())
        
        for i, binding in enumerate(bindings.bindings):
            binding_id = str(uuid.uuid4())
            rule_name = f"{binding.name}_{timestamp}_{i}"  # Add timestamp for uniqueness
            
            print(f"🔍 Processing binding {i+1}: name='{binding.name}', type='{binding.type}', value='{getattr(binding, 'value', 'N/A')}'")
            
            # Prepare source_ref and target based on binding type
            if binding.type == "extract":
                print(f"   → Processing as EXTRACT binding")
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
                print(f"   → Processing as FORMULA binding")
                source_ref = {
                    "formula": getattr(binding, 'formula', '')
                }
                target = {
                    "variable_name": binding.name,
                    "type": "calculated",
                    "category": "formula"
                }
            else:  # constant or other
                print(f"   → Processing as CONSTANT binding with value: '{getattr(binding, 'value', '')}'")
                source_ref = {
                    "value": getattr(binding, 'value', '')
                }
                target = {
                    "variable_name": binding.name,
                    "type": "constant",
                    "category": "constant"
                }
            
            print(f"   → source_ref: {source_ref}")
            print(f"   → target: {target}")
            
            # Insert the binding using the correct table schema
            print(f"   → Inserting to database: binding_type='{binding.type}', source_config={json.dumps(source_ref)}")
            await db.execute_command("""
                INSERT INTO datahub.data_bindings 
                (id, project_id, name, binding_type, source_config, schema_definition, is_active, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            """, 
            binding_id,
            project_id,
            binding.name,  # Use binding.name for the name column
            binding.type,  # Use binding.type for binding_type
            json.dumps(source_ref),  # source_config contains the source configuration
            json.dumps(target),  # schema_definition contains the target schema
            True
            )
        # Verify the save by counting active bindings
        verify_query = """
        SELECT COUNT(*) as count
        FROM datahub.data_bindings 
        WHERE project_id = $1 AND is_active = true
        """
        
        verify_result = await db.execute_one(verify_query, project_id)
        saved_count = verify_result['count'] if verify_result else 0
        return {
            "success": True,
            "message": f"Successfully saved {len(bindings.bindings)} bindings",
            "bindings_count": len(bindings.bindings),
            "project_id": str(project_id)
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to update bindings: {str(e)}")

@router.put("/prompts/{prompt_id}/bindings")
async def update_prompt_bindings_put(
    prompt_id: str,
    bindings_data: Dict[str, Any],
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Update bindings in datahub.data_bindings table (PUT endpoint)"""
    # Delegate to the POST handler to avoid code duplication
    return await update_prompt_bindings(prompt_id, bindings_data, db, current_user)

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
