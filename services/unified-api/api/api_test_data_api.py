"""
API Test Data API
Endpoints for managing API-based test data creation
Allows testers to quickly create precondition data via APIs before running UI tests
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import get_current_active_user, get_optional_current_user
from core.database import get_database, DatabaseManager
from models.auth_models import CurrentUser
from schemas.api_test_data import (
    ApiEndpointCreate,
    ApiEndpointResponse,
    ApiEndpointUpdate,
    DataSetCreate,
    DataSetResponse,
    DataSetUpdate,
    DataTemplateCreate,
    DataTemplateResponse,
    DataTemplateUpdate,
    ExecuteSetupRequest,
    ExecuteSetupResponse,
    ExecutionHistoryResponse,
    ExecutionResult,
    LinkSetupToPromptRequest,
    PromptSetupLinkResponse,
    TestDataSetupCreate,
    TestDataSetupResponse,
    TestDataSetupUpdate,
)
from services.api_test_data_service import ApiTestDataService, TestDataTemplateLibrary

logger = logging.getLogger(__name__)
router = APIRouter()


# ============ Helper Functions ============

def _is_missing_api_test_data_schema_error(error: Exception) -> bool:
    """Detect missing api_tests schema/table errors and degrade gracefully."""
    message = str(error).lower()
    return (
        'schema "api_tests" does not exist' in message
        or 'relation "api_tests.api_endpoints" does not exist' in message
        or 'relation "api_tests' in message and 'does not exist' in message
    )

async def get_project_id(
    project_id: Optional[str],
    current_user: Optional[CurrentUser],
    db: DatabaseManager
) -> str:
    """Get project ID from user context or find default"""
    if project_id:
        return project_id
    
    if current_user and current_user.project:
        return str(current_user.project.id)
    
    try:
        result = await db.execute_one(
            "SELECT id FROM core.projects WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
        )
    except Exception:
        result = await db.execute_one(
            "SELECT id FROM core.projects ORDER BY created_at DESC LIMIT 1"
        )

    if not result:
        raise HTTPException(status_code=400, detail="No active project found")
    return str(result['id'])


async def get_user_id(current_user: Optional[CurrentUser], db: DatabaseManager) -> Optional[str]:
    """Get user ID from context or find default"""
    if current_user and current_user.user:
        return str(current_user.user.id)
    
    result = await db.execute_one(
        "SELECT id FROM core.users WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
    )
    return str(result['id']) if result else None


# ============ API Endpoints Management ============

@router.get("/endpoints", response_model=Dict[str, Any])
async def list_api_endpoints(
    project_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """List all API endpoint configurations for a project"""
    try:
        project_id = await get_project_id(project_id, current_user, db)
        
        query = """
            SELECT id, project_id, name, description, base_url, auth_type,
                   default_headers, timeout_seconds, retry_count, is_active,
                   created_at, updated_at, created_by
            FROM api_tests.api_endpoints
            WHERE project_id = $1
        """
        params = [project_id]
        
        if is_active is not None:
            query += " AND is_active = $2"
            params.append(is_active)
        
        query += " ORDER BY name ASC"
        
        results = await db.fetch(query, *params)
        
        endpoints = []
        for row in results:
            endpoint = dict(row)
            endpoint['id'] = str(endpoint['id'])
            endpoint['project_id'] = str(endpoint['project_id'])
            if endpoint.get('created_by'):
                endpoint['created_by'] = str(endpoint['created_by'])
            # Don't expose auth_config in list view for security
            endpoints.append(endpoint)
        
        return {"success": True, "data": endpoints, "count": len(endpoints)}
        
    except HTTPException:
        raise
    except Exception as e:
        if _is_missing_api_test_data_schema_error(e):
            logger.warning("API test-data schema not available; returning empty endpoint list")
            return {
                "success": True,
                "data": [],
                "count": 0,
                "message": "API test-data schema not initialized yet"
            }
        logger.error(f"Error listing API endpoints: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/endpoints", response_model=Dict[str, Any])
async def create_api_endpoint(
    endpoint_data: ApiEndpointCreate,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Create a new API endpoint configuration"""
    try:
        project_id = await get_project_id(endpoint_data.project_id, current_user, db)
        user_id = await get_user_id(current_user, db)
        
        query = """
            INSERT INTO api_tests.api_endpoints (
                project_id, name, description, base_url, auth_type, auth_config,
                default_headers, timeout_seconds, retry_count, is_active, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, project_id, name, description, base_url, auth_type,
                      default_headers, timeout_seconds, retry_count, is_active,
                      created_at, updated_at, created_by
        """
        
        result = await db.execute_one(
            query,
            project_id,
            endpoint_data.name,
            endpoint_data.description,
            endpoint_data.base_url,
            endpoint_data.auth_type.value,
            json.dumps(endpoint_data.auth_config),
            json.dumps(endpoint_data.default_headers),
            endpoint_data.timeout_seconds,
            endpoint_data.retry_count,
            endpoint_data.is_active,
            user_id
        )
        
        endpoint = dict(result)
        endpoint['id'] = str(endpoint['id'])
        endpoint['project_id'] = str(endpoint['project_id'])
        
        return {"success": True, "data": endpoint, "message": "API endpoint created successfully"}
        
    except Exception as e:
        logger.error(f"Error creating API endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/endpoints/{endpoint_id}", response_model=Dict[str, Any])
async def get_api_endpoint(
    endpoint_id: str,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Get a specific API endpoint configuration"""
    try:
        query = """
            SELECT id, project_id, name, description, base_url, auth_type, auth_config,
                   default_headers, timeout_seconds, retry_count, is_active,
                   created_at, updated_at, created_by
            FROM api_tests.api_endpoints
            WHERE id = $1
        """
        
        result = await db.execute_one(query, endpoint_id)
        if not result:
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        endpoint = dict(result)
        endpoint['id'] = str(endpoint['id'])
        endpoint['project_id'] = str(endpoint['project_id'])
        
        return {"success": True, "data": endpoint}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting API endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/endpoints/{endpoint_id}", response_model=Dict[str, Any])
async def update_api_endpoint(
    endpoint_id: str,
    update_data: ApiEndpointUpdate,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Update an API endpoint configuration"""
    try:
        # Build dynamic update query
        updates = []
        params = []
        param_idx = 1
        
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if value is not None:
                if field == 'auth_type':
                    value = value.value if hasattr(value, 'value') else value
                elif field in ['auth_config', 'default_headers']:
                    value = json.dumps(value)
                updates.append(f"{field} = ${param_idx}")
                params.append(value)
                param_idx += 1
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append(f"updated_at = ${param_idx}")
        params.append(datetime.utcnow())
        param_idx += 1
        
        params.append(endpoint_id)
        
        query = f"""
            UPDATE api_tests.api_endpoints
            SET {', '.join(updates)}
            WHERE id = ${param_idx}
            RETURNING id, name, description, base_url, auth_type, is_active, updated_at
        """
        
        result = await db.execute_one(query, *params)
        if not result:
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        endpoint = dict(result)
        endpoint['id'] = str(endpoint['id'])
        
        return {"success": True, "data": endpoint, "message": "API endpoint updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating API endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/endpoints/{endpoint_id}", response_model=Dict[str, Any])
async def delete_api_endpoint(
    endpoint_id: str,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Delete an API endpoint configuration"""
    try:
        query = "DELETE FROM api_tests.api_endpoints WHERE id = $1 RETURNING id"
        result = await db.execute_one(query, endpoint_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        return {"success": True, "message": "API endpoint deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting API endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Data Templates Management ============

@router.get("/templates", response_model=Dict[str, Any])
async def list_data_templates(
    endpoint_id: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """List data templates with optional filtering"""
    try:
        query = """
            SELECT t.id, t.endpoint_id, t.name, t.description, t.category,
                   t.http_method, t.path, t.expected_status_codes, t.is_active,
                   t.created_at, t.updated_at, e.name as endpoint_name
            FROM api_tests.data_templates t
            JOIN api_tests.api_endpoints e ON e.id = t.endpoint_id
            WHERE 1=1
        """
        params = []
        param_idx = 1
        
        if endpoint_id:
            query += f" AND t.endpoint_id = ${param_idx}"
            params.append(endpoint_id)
            param_idx += 1
        
        if category:
            query += f" AND t.category = ${param_idx}"
            params.append(category)
            param_idx += 1
        
        if is_active is not None:
            query += f" AND t.is_active = ${param_idx}"
            params.append(is_active)
            param_idx += 1
        
        if search:
            query += f" AND (t.name ILIKE ${param_idx} OR t.description ILIKE ${param_idx})"
            params.append(f"%{search}%")
            param_idx += 1
        
        query += " ORDER BY t.category, t.name ASC"
        
        results = await db.fetch(query, *params)
        
        templates = []
        for row in results:
            template = dict(row)
            template['id'] = str(template['id'])
            template['endpoint_id'] = str(template['endpoint_id'])
            templates.append(template)
        
        return {"success": True, "data": templates, "count": len(templates)}
        
    except Exception as e:
        logger.error(f"Error listing data templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates", response_model=Dict[str, Any])
async def create_data_template(
    template_data: DataTemplateCreate,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Create a new data template"""
    try:
        user_id = await get_user_id(current_user, db)
        
        # Convert response extractors to JSON
        extractors = [e.dict() for e in template_data.response_extractors]
        
        query = """
            INSERT INTO api_tests.data_templates (
                endpoint_id, name, description, category, http_method, path,
                request_headers, request_body_template, expected_status_codes,
                response_extractors, is_active, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, endpoint_id, name, description, category, http_method, path,
                      request_headers, request_body_template, expected_status_codes,
                      response_extractors, is_active, created_at, updated_at
        """
        
        result = await db.execute_one(
            query,
            template_data.endpoint_id,
            template_data.name,
            template_data.description,
            template_data.category,
            template_data.http_method.value,
            template_data.path,
            json.dumps(template_data.request_headers),
            json.dumps(template_data.request_body_template) if template_data.request_body_template else None,
            template_data.expected_status_codes,
            json.dumps(extractors),
            template_data.is_active,
            user_id
        )
        
        template = dict(result)
        template['id'] = str(template['id'])
        template['endpoint_id'] = str(template['endpoint_id'])
        
        return {"success": True, "data": template, "message": "Data template created successfully"}
        
    except Exception as e:
        logger.error(f"Error creating data template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/{template_id}", response_model=Dict[str, Any])
async def get_data_template(
    template_id: str,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Get a specific data template"""
    try:
        query = """
            SELECT t.*, e.name as endpoint_name, e.base_url
            FROM api_tests.data_templates t
            JOIN api_tests.api_endpoints e ON e.id = t.endpoint_id
            WHERE t.id = $1
        """
        
        result = await db.execute_one(query, template_id)
        if not result:
            raise HTTPException(status_code=404, detail="Data template not found")
        
        template = dict(result)
        template['id'] = str(template['id'])
        template['endpoint_id'] = str(template['endpoint_id'])
        
        return {"success": True, "data": template}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting data template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/templates/{template_id}", response_model=Dict[str, Any])
async def update_data_template(
    template_id: str,
    update_data: DataTemplateUpdate,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Update a data template"""
    try:
        updates = []
        params = []
        param_idx = 1
        
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if value is not None:
                if field == 'http_method':
                    value = value.value if hasattr(value, 'value') else value
                elif field in ['request_headers', 'request_body_template']:
                    value = json.dumps(value)
                elif field == 'response_extractors':
                    value = json.dumps([e.dict() if hasattr(e, 'dict') else e for e in value])
                updates.append(f"{field} = ${param_idx}")
                params.append(value)
                param_idx += 1
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append(f"updated_at = ${param_idx}")
        params.append(datetime.utcnow())
        param_idx += 1
        
        params.append(template_id)
        
        query = f"""
            UPDATE api_tests.data_templates
            SET {', '.join(updates)}
            WHERE id = ${param_idx}
            RETURNING id, name, description, category, http_method, path, is_active, updated_at
        """
        
        result = await db.execute_one(query, *params)
        if not result:
            raise HTTPException(status_code=404, detail="Data template not found")
        
        template = dict(result)
        template['id'] = str(template['id'])
        
        return {"success": True, "data": template, "message": "Data template updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating data template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/templates/{template_id}", response_model=Dict[str, Any])
async def delete_data_template(
    template_id: str,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Delete a data template"""
    try:
        query = "DELETE FROM api_tests.data_templates WHERE id = $1 RETURNING id"
        result = await db.execute_one(query, template_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="Data template not found")
        
        return {"success": True, "message": "Data template deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting data template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/library/list", response_model=Dict[str, Any])
async def list_template_library():
    """List pre-built templates available in the library"""
    templates = TestDataTemplateLibrary.list_templates()
    library = {}
    for t in templates:
        library[t] = TestDataTemplateLibrary.get_template(t)
    
    return {"success": True, "data": library, "available_types": templates}


# ============ Data Sets Management ============

@router.get("/data-sets", response_model=Dict[str, Any])
async def list_data_sets(
    template_id: Optional[str] = None,
    tags: Optional[str] = None,  # Comma-separated tags
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """List data sets with optional filtering"""
    try:
        query = """
            SELECT ds.id, ds.template_id, ds.name, ds.description, ds.variables,
                   ds.is_default, ds.tags, ds.created_at, ds.updated_at,
                   t.name as template_name, t.category as template_category
            FROM api_tests.data_sets ds
            JOIN api_tests.data_templates t ON t.id = ds.template_id
            WHERE 1=1
        """
        params = []
        param_idx = 1
        
        if template_id:
            query += f" AND ds.template_id = ${param_idx}"
            params.append(template_id)
            param_idx += 1
        
        if tags:
            tag_list = [t.strip() for t in tags.split(',')]
            query += f" AND ds.tags && ${param_idx}::varchar[]"
            params.append(tag_list)
            param_idx += 1
        
        query += " ORDER BY ds.is_default DESC, ds.name ASC"
        
        results = await db.fetch(query, *params)
        
        data_sets = []
        for row in results:
            ds = dict(row)
            ds['id'] = str(ds['id'])
            ds['template_id'] = str(ds['template_id'])
            data_sets.append(ds)
        
        return {"success": True, "data": data_sets, "count": len(data_sets)}
        
    except Exception as e:
        logger.error(f"Error listing data sets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-sets", response_model=Dict[str, Any])
async def create_data_set(
    data_set: DataSetCreate,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Create a new data set"""
    try:
        user_id = await get_user_id(current_user, db)
        
        query = """
            INSERT INTO api_tests.data_sets (
                template_id, name, description, variables, is_default, tags, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, template_id, name, description, variables, is_default, tags,
                      created_at, updated_at
        """
        
        result = await db.execute_one(
            query,
            data_set.template_id,
            data_set.name,
            data_set.description,
            json.dumps(data_set.variables),
            data_set.is_default,
            data_set.tags,
            user_id
        )
        
        ds = dict(result)
        ds['id'] = str(ds['id'])
        ds['template_id'] = str(ds['template_id'])
        
        return {"success": True, "data": ds, "message": "Data set created successfully"}
        
    except Exception as e:
        logger.error(f"Error creating data set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-sets/{data_set_id}", response_model=Dict[str, Any])
async def get_data_set(
    data_set_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """Get a specific data set"""
    try:
        query = """
            SELECT ds.*, t.name as template_name
            FROM api_tests.data_sets ds
            JOIN api_tests.data_templates t ON t.id = ds.template_id
            WHERE ds.id = $1
        """
        
        result = await db.execute_one(query, data_set_id)
        if not result:
            raise HTTPException(status_code=404, detail="Data set not found")
        
        ds = dict(result)
        ds['id'] = str(ds['id'])
        ds['template_id'] = str(ds['template_id'])
        
        return {"success": True, "data": ds}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting data set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/data-sets/{data_set_id}", response_model=Dict[str, Any])
async def update_data_set(
    data_set_id: str,
    update_data: DataSetUpdate,
    db: DatabaseManager = Depends(get_database)
):
    """Update a data set"""
    try:
        updates = []
        params = []
        param_idx = 1
        
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if value is not None:
                if field == 'variables':
                    value = json.dumps(value)
                updates.append(f"{field} = ${param_idx}")
                params.append(value)
                param_idx += 1
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append(f"updated_at = ${param_idx}")
        params.append(datetime.utcnow())
        param_idx += 1
        
        params.append(data_set_id)
        
        query = f"""
            UPDATE api_tests.data_sets
            SET {', '.join(updates)}
            WHERE id = ${param_idx}
            RETURNING id, name, variables, is_default, tags, updated_at
        """
        
        result = await db.execute_one(query, *params)
        if not result:
            raise HTTPException(status_code=404, detail="Data set not found")
        
        ds = dict(result)
        ds['id'] = str(ds['id'])
        
        return {"success": True, "data": ds, "message": "Data set updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating data set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/data-sets/{data_set_id}", response_model=Dict[str, Any])
async def delete_data_set(
    data_set_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """Delete a data set"""
    try:
        query = "DELETE FROM api_tests.data_sets WHERE id = $1 RETURNING id"
        result = await db.execute_one(query, data_set_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="Data set not found")
        
        return {"success": True, "message": "Data set deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting data set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Test Data Setups Management ============

@router.get("/setups", response_model=Dict[str, Any])
async def list_test_data_setups(
    project_id: Optional[str] = None,
    template_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """List test data setups"""
    try:
        project_id = await get_project_id(project_id, current_user, db)
        
        query = """
            SELECT s.id, s.project_id, s.name, s.description, s.execution_order,
                   s.template_id, s.data_set_id, s.custom_variables, s.output_variables,
                   s.is_active, s.created_at, s.updated_at,
                   t.name as template_name, t.category as template_category,
                   ds.name as data_set_name
            FROM api_tests.test_data_setups s
            JOIN api_tests.data_templates t ON t.id = s.template_id
            LEFT JOIN api_tests.data_sets ds ON ds.id = s.data_set_id
            WHERE s.project_id = $1
        """
        params = [project_id]
        param_idx = 2
        
        if template_id:
            query += f" AND s.template_id = ${param_idx}"
            params.append(template_id)
            param_idx += 1
        
        if is_active is not None:
            query += f" AND s.is_active = ${param_idx}"
            params.append(is_active)
            param_idx += 1
        
        query += " ORDER BY s.execution_order ASC, s.name ASC"
        
        results = await db.fetch(query, *params)
        
        setups = []
        for row in results:
            setup = dict(row)
            setup['id'] = str(setup['id'])
            setup['project_id'] = str(setup['project_id'])
            setup['template_id'] = str(setup['template_id'])
            if setup.get('data_set_id'):
                setup['data_set_id'] = str(setup['data_set_id'])
            setups.append(setup)
        
        return {"success": True, "data": setups, "count": len(setups)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing test data setups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/setups", response_model=Dict[str, Any])
async def create_test_data_setup(
    setup_data: TestDataSetupCreate,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """Create a new test data setup"""
    try:
        project_id = await get_project_id(setup_data.project_id, current_user, db)
        user_id = await get_user_id(current_user, db)
        
        # Convert output variables to JSON
        output_vars = [v.dict() for v in setup_data.output_variables]
        
        query = """
            INSERT INTO api_tests.test_data_setups (
                project_id, name, description, execution_order, template_id,
                data_set_id, custom_variables, output_variables, is_active, created_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, project_id, name, description, execution_order, template_id,
                      data_set_id, custom_variables, output_variables, is_active,
                      created_at, updated_at
        """
        
        result = await db.execute_one(
            query,
            project_id,
            setup_data.name,
            setup_data.description,
            setup_data.execution_order,
            setup_data.template_id,
            setup_data.data_set_id,
            json.dumps(setup_data.custom_variables),
            json.dumps(output_vars),
            setup_data.is_active,
            user_id
        )
        
        setup = dict(result)
        setup['id'] = str(setup['id'])
        setup['project_id'] = str(setup['project_id'])
        setup['template_id'] = str(setup['template_id'])
        
        return {"success": True, "data": setup, "message": "Test data setup created successfully"}
        
    except Exception as e:
        logger.error(f"Error creating test data setup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/setups/{setup_id}", response_model=Dict[str, Any])
async def get_test_data_setup(
    setup_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """Get a specific test data setup with full details"""
    try:
        query = """
            SELECT s.*, t.name as template_name, t.category as template_category,
                   t.http_method, t.path, ds.name as data_set_name,
                   e.name as endpoint_name, e.base_url
            FROM api_tests.test_data_setups s
            JOIN api_tests.data_templates t ON t.id = s.template_id
            JOIN api_tests.api_endpoints e ON e.id = t.endpoint_id
            LEFT JOIN api_tests.data_sets ds ON ds.id = s.data_set_id
            WHERE s.id = $1
        """
        
        result = await db.execute_one(query, setup_id)
        if not result:
            raise HTTPException(status_code=404, detail="Test data setup not found")
        
        setup = dict(result)
        setup['id'] = str(setup['id'])
        setup['project_id'] = str(setup['project_id'])
        setup['template_id'] = str(setup['template_id'])
        if setup.get('data_set_id'):
            setup['data_set_id'] = str(setup['data_set_id'])
        
        return {"success": True, "data": setup}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting test data setup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/setups/{setup_id}", response_model=Dict[str, Any])
async def update_test_data_setup(
    setup_id: str,
    update_data: TestDataSetupUpdate,
    db: DatabaseManager = Depends(get_database)
):
    """Update a test data setup"""
    try:
        updates = []
        params = []
        param_idx = 1
        
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            if value is not None:
                if field in ['custom_variables']:
                    value = json.dumps(value)
                elif field == 'output_variables':
                    value = json.dumps([v.dict() if hasattr(v, 'dict') else v for v in value])
                updates.append(f"{field} = ${param_idx}")
                params.append(value)
                param_idx += 1
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updates.append(f"updated_at = ${param_idx}")
        params.append(datetime.utcnow())
        param_idx += 1
        
        params.append(setup_id)
        
        query = f"""
            UPDATE api_tests.test_data_setups
            SET {', '.join(updates)}
            WHERE id = ${param_idx}
            RETURNING id, name, execution_order, is_active, updated_at
        """
        
        result = await db.execute_one(query, *params)
        if not result:
            raise HTTPException(status_code=404, detail="Test data setup not found")
        
        setup = dict(result)
        setup['id'] = str(setup['id'])
        
        return {"success": True, "data": setup, "message": "Test data setup updated"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating test data setup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/setups/{setup_id}", response_model=Dict[str, Any])
async def delete_test_data_setup(
    setup_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """Delete a test data setup"""
    try:
        query = "DELETE FROM api_tests.test_data_setups WHERE id = $1 RETURNING id"
        result = await db.execute_one(query, setup_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="Test data setup not found")
        
        return {"success": True, "message": "Test data setup deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting test data setup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Execution Endpoints ============

@router.post("/execute", response_model=Dict[str, Any])
async def execute_test_data_setup(
    request: ExecuteSetupRequest,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """
    Execute test data setup(s) to create precondition data.
    
    Can execute:
    - A single setup by setup_id
    - Multiple setups by setup_ids
    - All setups linked to a prompt by prompt_id
    """
    import time
    start_time = time.time()
    
    try:
        user_id = await get_user_id(current_user, db)
        service = ApiTestDataService(db)
        
        results = []
        combined_variables = dict(request.variable_overrides)
        
        if request.prompt_id:
            # Execute all setups for a prompt
            success, combined_variables, results = await service.execute_setups_for_prompt(
                prompt_id=request.prompt_id,
                variable_overrides=request.variable_overrides,
                executed_by=user_id
            )
        elif request.setup_ids:
            # Execute multiple specific setups
            success, combined_variables, results = await service.execute_multiple_setups(
                setup_ids=request.setup_ids,
                variable_overrides=request.variable_overrides,
                executed_by=user_id
            )
        elif request.setup_id:
            # Execute single setup
            result = await service.execute_setup(
                setup_id=request.setup_id,
                variable_overrides=request.variable_overrides,
                executed_by=user_id,
                dry_run=request.dry_run
            )
            results = [result]
            combined_variables.update(result.extracted_variables)
            success = result.success
        else:
            raise HTTPException(
                status_code=400, 
                detail="Must provide setup_id, setup_ids, or prompt_id"
            )
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful
        
        response = ExecuteSetupResponse(
            success=success if len(results) == 0 else successful > 0,
            total_setups=len(results),
            successful_setups=successful,
            failed_setups=failed,
            results=results,
            combined_variables=combined_variables,
            execution_time_ms=execution_time_ms
        )
        
        return {"success": True, "data": response.dict()}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing test data setup: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute/dry-run", response_model=Dict[str, Any])
async def dry_run_setup(
    request: ExecuteSetupRequest,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """
    Validate a setup without executing.
    Shows what would be sent to the API.
    """
    request.dry_run = True
    return await execute_test_data_setup(request, current_user, db)


# ============ Prompt Linking ============

@router.get("/prompts/{prompt_id}/setups", response_model=Dict[str, Any])
async def get_prompt_data_setups(
    prompt_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """Get all data setups linked to a prompt"""
    try:
        query = """
            SELECT pds.id, pds.prompt_id, pds.setup_id, pds.execution_order,
                   pds.is_active, pds.created_at, s.name as setup_name,
                   t.name as template_name, t.category
            FROM api_tests.prompt_data_setups pds
            JOIN api_tests.test_data_setups s ON s.id = pds.setup_id
            JOIN api_tests.data_templates t ON t.id = s.template_id
            WHERE pds.prompt_id = $1
            ORDER BY pds.execution_order ASC, s.name ASC
        """
        
        results = await db.fetch(query, prompt_id)
        
        links = []
        for row in results:
            link = dict(row)
            link['id'] = str(link['id'])
            link['setup_id'] = str(link['setup_id'])
            links.append(link)
        
        return {"success": True, "data": links, "count": len(links)}
        
    except Exception as e:
        logger.error(f"Error getting prompt data setups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/prompts/{prompt_id}/setups", response_model=Dict[str, Any])
async def link_setup_to_prompt(
    prompt_id: str,
    link_data: LinkSetupToPromptRequest,
    db: DatabaseManager = Depends(get_database)
):
    """Link a data setup to a prompt for automatic execution before UI test"""
    try:
        query = """
            INSERT INTO api_tests.prompt_data_setups (
                prompt_id, setup_id, execution_order, is_active
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (prompt_id, setup_id) 
            DO UPDATE SET execution_order = $3, is_active = $4
            RETURNING id, prompt_id, setup_id, execution_order, is_active, created_at
        """
        
        result = await db.execute_one(
            query,
            prompt_id,
            link_data.setup_id,
            link_data.execution_order,
            link_data.is_active
        )
        
        link = dict(result)
        link['id'] = str(link['id'])
        link['setup_id'] = str(link['setup_id'])
        
        return {"success": True, "data": link, "message": "Setup linked to prompt"}
        
    except Exception as e:
        logger.error(f"Error linking setup to prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/prompts/{prompt_id}/setups/{setup_id}", response_model=Dict[str, Any])
async def unlink_setup_from_prompt(
    prompt_id: str,
    setup_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """Remove a data setup link from a prompt"""
    try:
        query = """
            DELETE FROM api_tests.prompt_data_setups
            WHERE prompt_id = $1 AND setup_id = $2
            RETURNING id
        """
        
        result = await db.execute_one(query, prompt_id, setup_id)
        if not result:
            raise HTTPException(status_code=404, detail="Link not found")
        
        return {"success": True, "message": "Setup unlinked from prompt"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unlinking setup from prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Execution History ============

@router.get("/history", response_model=Dict[str, Any])
async def get_execution_history(
    setup_id: Optional[str] = None,
    template_id: Optional[str] = None,
    success: Optional[bool] = None,
    limit: int = Query(default=50, le=500),
    offset: int = Query(default=0, ge=0),
    db: DatabaseManager = Depends(get_database)
):
    """Get execution history with optional filtering"""
    try:
        query = """
            SELECT h.id, h.setup_id, h.template_id, h.request_url, h.request_method,
                   h.response_status, h.extracted_variables, h.duration_ms, h.success,
                   h.error_message, h.executed_at, h.executed_by,
                   s.name as setup_name, t.name as template_name
            FROM api_tests.execution_history h
            LEFT JOIN api_tests.test_data_setups s ON s.id = h.setup_id
            LEFT JOIN api_tests.data_templates t ON t.id = h.template_id
            WHERE 1=1
        """
        params = []
        param_idx = 1
        
        if setup_id:
            query += f" AND h.setup_id = ${param_idx}"
            params.append(setup_id)
            param_idx += 1
        
        if template_id:
            query += f" AND h.template_id = ${param_idx}"
            params.append(template_id)
            param_idx += 1
        
        if success is not None:
            query += f" AND h.success = ${param_idx}"
            params.append(success)
            param_idx += 1
        
        query += f" ORDER BY h.executed_at DESC LIMIT ${param_idx} OFFSET ${param_idx + 1}"
        params.extend([limit, offset])
        
        results = await db.fetch(query, *params)
        
        history = []
        for row in results:
            h = dict(row)
            h['id'] = str(h['id'])
            if h.get('setup_id'):
                h['setup_id'] = str(h['setup_id'])
            if h.get('template_id'):
                h['template_id'] = str(h['template_id'])
            if h.get('executed_by'):
                h['executed_by'] = str(h['executed_by'])
            history.append(h)
        
        return {"success": True, "data": history, "count": len(history)}
        
    except Exception as e:
        logger.error(f"Error getting execution history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{history_id}", response_model=Dict[str, Any])
async def get_execution_history_detail(
    history_id: str,
    db: DatabaseManager = Depends(get_database)
):
    """Get detailed execution history record"""
    try:
        query = """
            SELECT h.*, s.name as setup_name, t.name as template_name
            FROM api_tests.execution_history h
            LEFT JOIN api_tests.test_data_setups s ON s.id = h.setup_id
            LEFT JOIN api_tests.data_templates t ON t.id = h.template_id
            WHERE h.id = $1
        """
        
        result = await db.execute_one(query, history_id)
        if not result:
            raise HTTPException(status_code=404, detail="History record not found")
        
        h = dict(result)
        h['id'] = str(h['id'])
        
        return {"success": True, "data": h}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting execution history detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ Categories ============

@router.get("/categories", response_model=Dict[str, Any])
async def get_template_categories(
    db: DatabaseManager = Depends(get_database)
):
    """Get list of all template categories in use"""
    try:
        query = """
            SELECT DISTINCT category
            FROM api_tests.data_templates
            WHERE category IS NOT NULL
            ORDER BY category
        """
        
        results = await db.fetch(query)
        categories = [row['category'] for row in results]
        
        return {"success": True, "data": categories}
        
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        raise HTTPException(status_code=500, detail=str(e))
