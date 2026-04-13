"""
Bindings API - Manage data bindings for test plans
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import logging

import json
import uuid
from core.database import get_database, DatabaseManager
from core.auth import get_current_active_user, get_optional_user
from models.auth_models import CurrentUser
from core.binding_processor import BindingProcessor, create_cart_verification_bindings, create_price_verification_bindings
from schemas.enterprise import DataBinding, TestBindings, BindingContext

router = APIRouter()
logger = logging.getLogger(__name__)

async def get_db() -> DatabaseManager:
    """Get database dependency"""
    return await get_database()


async def _get_binding_columns(db: DatabaseManager) -> set[str]:
    rows = await db.fetch(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'datahub' AND table_name = 'data_bindings'
        """
    )
    return {row["column_name"] for row in rows}


def _parse_json_value(value: Any, fallback: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return fallback
    if value is None:
        return fallback
    return value


async def _resolve_project_id(db: DatabaseManager, current_user: Optional[CurrentUser]) -> str:
    tenant_id = None
    if current_user and current_user.tenant and current_user.tenant.id:
        tenant_id = str(current_user.tenant.id)

    if tenant_id:
        project = await db.execute_one(
            """
            SELECT id
            FROM core.projects
            WHERE tenant_id = $1
            ORDER BY created_at ASC
            LIMIT 1
            """,
            tenant_id,
        )
        if project:
            return str(project["id"])

        project_id = str(uuid.uuid4())
        slug = f"default-{project_id[:8]}"
        await db.execute_command(
            """
            INSERT INTO core.projects (id, tenant_id, name, slug, description, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
            """,
            project_id,
            tenant_id,
            "Default Frontend Project",
            slug,
            "Auto-created project for frontend bindings",
        )
        return project_id

    project = await db.execute_one("SELECT id FROM core.projects ORDER BY created_at ASC LIMIT 1")
    if project:
        return str(project["id"])

    raise HTTPException(
        status_code=400,
        detail="No project is available for bindings. Create an organization/project first.",
    )

@router.get("/prompts/{prompt_id}/bindings")
async def get_prompt_bindings(
    prompt_id: str,
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_optional_user)
):
    """Get bindings from datahub.data_bindings table"""
    try:
        columns = await _get_binding_columns(db)
        use_modern_schema = {"rule_name", "source_ref", "target"}.issubset(columns)

        if use_modern_schema:
            bindings_query = """
                SELECT rule_name, source_ref, target, matcher, scope, priority
                FROM datahub.data_bindings
                WHERE is_active = true
                ORDER BY created_at DESC
            """
        else:
            bindings_query = """
                SELECT name, binding_type, source_config, schema_definition
                FROM datahub.data_bindings
                WHERE is_active = true
                ORDER BY created_at DESC
            """

        db_bindings = await db.fetch(bindings_query)
        
        # Convert to frontend format
        bindings = []
        for row in db_bindings:
            binding = dict(row)

            if use_modern_schema:
                source_ref = _parse_json_value(binding.get("source_ref"), {})
                target = _parse_json_value(binding.get("target"), {})
                var_name = target.get("variable_name", binding.get("rule_name", "unknown"))
                binding_type = target.get("category", target.get("type", "extract"))
            else:
                source_ref = _parse_json_value(binding.get("source_config"), {})
                target = _parse_json_value(binding.get("schema_definition"), {})
                var_name = binding.get("name", "unknown")
                binding_type = binding.get("binding_type", "extract")
            
            if binding_type == 'constant':
                frontend_binding = {
                    "name": var_name,
                    "description": f"Variable: {var_name}",
                    "type": "constant",
                    "value": source_ref.get('value', ''),
                    "selector": "",
                    "extract_type": "value",
                    "fallback_value": source_ref.get('fallback_value', '')
                }
            elif binding_type == 'formula':
                frontend_binding = {
                    "name": var_name,
                    "description": f"Calculate value using formula",
                    "type": "formula",
                    "formula": source_ref.get('formula', ''),
                    "selector": "",
                    "extract_type": "formula",
                    "fallback_value": source_ref.get('fallback_value', '')
                }
            elif binding_type == 'extract':
                frontend_binding = {
                    "name": var_name,
                    "description": f"Extract data from page elements",
                    "type": "extract",
                    "selector": source_ref.get('selector', ''),
                    "extract_type": source_ref.get('extract_type', 'text'),
                    "fallback_value": source_ref.get('fallback_value', '')
                }
            else:
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
        logger.exception("Failed to get prompt bindings")
        raise HTTPException(status_code=500, detail=f"Failed to get bindings: {str(e)}")

@router.post("/prompts/{prompt_id}/bindings")
async def update_prompt_bindings(
    prompt_id: str,
    bindings_data: Dict[str, Any],
    db: DatabaseManager = Depends(get_db),
    current_user: Optional[CurrentUser] = Depends(get_optional_user)
):
    """Update bindings in datahub.data_bindings table"""
    try:
        # Validate bindings data
        try:
            bindings = TestBindings(**bindings_data)
        except Exception as validation_error:
            raise HTTPException(status_code=400, detail=f"Invalid bindings data: {str(validation_error)}")

        project_id = await _resolve_project_id(db, current_user)
        columns = await _get_binding_columns(db)
        use_modern_schema = {"rule_name", "source_ref", "target"}.issubset(columns)

        # Deactivate existing bindings that will be replaced
        binding_names = [binding.name for binding in bindings.bindings]
        if binding_names and use_modern_schema:
            placeholders = ', '.join(['$' + str(i + 2) for i in range(len(binding_names))])
            deactivate_query = f"""
                UPDATE datahub.data_bindings
                SET is_active = false
                WHERE project_id::text = $1 AND rule_name IN ({placeholders})
            """
            await db.execute_command(deactivate_query, str(project_id), *binding_names)
        elif binding_names:
            placeholders = ', '.join(['$' + str(i + 2) for i in range(len(binding_names))])
            deactivate_query = f"""
                UPDATE datahub.data_bindings
                SET is_active = false
                WHERE project_id::text = $1 AND name IN ({placeholders})
            """
            await db.execute_command(deactivate_query, str(project_id), *binding_names)
        
        for binding in bindings.bindings:
            binding_id = str(uuid.uuid4())
            rule_name = binding.name
            
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

            if use_modern_schema:
                await db.execute_command(
                    """
                    INSERT INTO datahub.data_bindings
                    (id, project_id, rule_name, scope, matcher, source_ref, target, priority, is_active, created_at)
                    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, NOW())
                    """,
                    binding_id,
                    project_id,
                    rule_name,
                    json.dumps({"type": "global"}),
                    json.dumps({"type": "exact"}),
                    json.dumps(source_ref),
                    json.dumps(target),
                    100,
                    True,
                )
            else:
                await db.execute_command(
                    """
                    INSERT INTO datahub.data_bindings
                    (id, project_id, name, binding_type, source_config, schema_definition, is_active, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, true, NOW(), NOW())
                    ON CONFLICT (project_id, name)
                    DO UPDATE SET
                        binding_type = EXCLUDED.binding_type,
                        source_config = EXCLUDED.source_config,
                        schema_definition = EXCLUDED.schema_definition,
                        is_active = true,
                        updated_at = NOW()
                    """,
                    binding_id,
                    project_id,
                    binding.name,
                    binding.type,
                    json.dumps(source_ref),
                    json.dumps(target),
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
        logger.exception("Failed to update prompt bindings")
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
