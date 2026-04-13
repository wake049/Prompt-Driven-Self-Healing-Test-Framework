"""
AI Provider API - Endpoints for managing and querying AI provider configurations

Provides endpoints for:
- Getting active AI provider for a tenant/project
- Listing available providers
- Setting default provider
- Creating new provider configurations (BYOK)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import logging

from core.database import get_database_manager
from services.ai_provider_service import AIProviderService

logger = logging.getLogger("ai_provider_api")

router = APIRouter()

# =========================
# Data Models
# =========================

class ActiveProviderResponse(BaseModel):
    """Response with active provider configuration"""
    provider: str = Field(..., description="Provider name (openai, anthropic, google, etc.)")
    model: str = Field(..., description="Model identifier")
    endpoint_url: Optional[str] = Field(None, description="Custom endpoint URL if configured")
    source: str = Field(..., description="Configuration source (database or environment)")
    temperature: float = Field(0.7, description="Model temperature")
    max_tokens: int = Field(4000, description="Max tokens per request")

class ProviderListItem(BaseModel):
    """Provider configuration in list response"""
    id: str
    provider: str
    provider_name: str
    model: str
    api_key_last_4: str
    is_active: bool
    is_default: bool
    is_verified: bool
    total_requests: int
    last_used_at: Optional[str]
    created_at: str

class CreateProviderRequest(BaseModel):
    """Request to create a new provider configuration"""
    provider: str = Field(..., description="Provider name (openai, anthropic, google, etc.)")
    api_key: str = Field(..., description="API key for the provider")
    model: Optional[str] = Field(None, description="Model identifier (uses default if not specified)")
    provider_name: Optional[str] = Field(None, description="Friendly name for this configuration")
    endpoint_url: Optional[str] = Field(None, description="Custom endpoint URL")
    temperature: float = Field(0.7, description="Model temperature")
    max_tokens: int = Field(4000, description="Max tokens per request")
    is_default: bool = Field(False, description="Set as default provider")

class SetDefaultProviderRequest(BaseModel):
    """Request to set a provider as default"""
    provider_id: str = Field(..., description="UUID of the provider to set as default")

# =========================
# Endpoints
# =========================

@router.get("/active", response_model=ActiveProviderResponse)
async def get_active_provider(tenant_id: str, project_id: Optional[str] = None):
    """
    Get the active AI provider configuration for a tenant/project.
    
    This endpoint is used by clients (including the chrome extension)
    to determine which AI provider and model to use for test generation
    and other AI operations.
    
    Args:
        tenant_id: Tenant UUID
        project_id: Optional project UUID for project-specific overrides
        
    Returns:
        Active provider configuration
        
    Example:
        GET /api/ai-providers/active?tenant_id=123e4567-e89b-12d3-a456-426614174000
        
        Response:
        {
          "provider": "openai",
          "model": "gpt-4o",
          "endpoint_url": null,
          "source": "database",
          "temperature": 0.1,
          "max_tokens": 4000
        }
    """
    try:
        async with get_database_manager() as db:
            provider_config = await AIProviderService.get_active_provider(db, tenant_id, project_id)
            
            if not provider_config:
                raise HTTPException(
                    status_code=404,
                    detail="No active AI provider configured for this tenant"
                )
            
            return ActiveProviderResponse(
                provider=provider_config['provider'],
                model=provider_config['model'],
                endpoint_url=provider_config.get('endpoint_url'),
                source=provider_config.get('source', 'database'),
                temperature=provider_config.get('temperature', 0.7),
                max_tokens=provider_config.get('max_tokens', 4000)
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting active provider: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get active provider: {str(e)}")


@router.get("/list", response_model=List[ProviderListItem])
async def list_providers(tenant_id: str):
    """
    List all AI provider configurations for a tenant.
    
    Args:
        tenant_id: Tenant UUID
        
    Returns:
        List of provider configurations (API keys are masked)
        
    Example:
        GET /api/ai-providers/list?tenant_id=123e4567-e89b-12d3-a456-426614174000
    """
    try:
        async with get_database_manager() as db:
            providers = await AIProviderService.list_providers(db, tenant_id)
            
            return [
                ProviderListItem(
                    id=str(p['id']),
                    provider=p['provider'],
                    provider_name=p['provider_name'],
                    model=p['model'],
                    api_key_last_4=p['api_key_last_4'],
                    is_active=p['is_active'],
                    is_default=p['is_default'],
                    is_verified=p['is_verified'],
                    total_requests=p['total_requests'],
                    last_used_at=str(p['last_used_at']) if p['last_used_at'] else None,
                    created_at=str(p['created_at'])
                )
                for p in providers
            ]
            
    except Exception as e:
        logger.error(f"Error listing providers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list providers: {str(e)}")


@router.post("/create")
async def create_provider(tenant_id: str, request: CreateProviderRequest):
    """
    Create a new AI provider configuration (BYOK - Bring Your Own Key).
    
    Args:
        tenant_id: Tenant UUID
        request: Provider configuration details
        
    Returns:
        UUID of created provider configuration
        
    Example:
        POST /api/ai-providers/create?tenant_id=123e4567-e89b-12d3-a456-426614174000
        
        Body:
        {
          "provider": "openai",
          "api_key": "sk-proj-...",
          "model": "gpt-4o",
          "temperature": 0.1,
          "max_tokens": 4000,
          "is_default": true
        }
    """
    try:
        async with get_database_manager() as db:
            provider_id = await AIProviderService.create_provider_config(
                db=db,
                tenant_id=tenant_id,
                provider=request.provider,
                api_key=request.api_key,
                model=request.model,
                provider_name=request.provider_name,
                endpoint_url=request.endpoint_url,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                is_default=request.is_default
            )
            
            if not provider_id:
                raise HTTPException(status_code=500, detail="Failed to create provider configuration")
            
            return {"provider_id": provider_id, "message": "Provider configuration created successfully"}
            
    except Exception as e:
        logger.error(f"Error creating provider: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create provider: {str(e)}")


@router.post("/set-default")
async def set_default_provider(tenant_id: str, request: SetDefaultProviderRequest):
    """
    Set a provider as the default for a tenant.
    
    Args:
        tenant_id: Tenant UUID
        request: Provider ID to set as default
        
    Returns:
        Success confirmation
        
    Example:
        POST /api/ai-providers/set-default?tenant_id=123e4567-e89b-12d3-a456-426614174000
        
        Body:
        {
          "provider_id": "456e7890-e12b-34d5-a678-426614174111"
        }
    """
    try:
        async with get_database_manager() as db:
            success = await AIProviderService.set_default_provider(db, tenant_id, request.provider_id)
            
            if not success:
                raise HTTPException(status_code=404, detail="Provider not found or update failed")
            
            return {"message": "Default provider updated successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting default provider: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to set default provider: {str(e)}")
