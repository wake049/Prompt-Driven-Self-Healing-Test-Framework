"""
AI Provider API - Endpoints for managing and querying AI provider configurations

Provides endpoints for:
- Getting active AI provider for a tenant/project
- Listing available providers
- Setting default provider
- Creating new provider configurations (BYOK)
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi import Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import logging
import io
import zipfile
from pathlib import Path

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

class SaveProviderSettingsRequest(BaseModel):
    """Request to save provider enable/disable settings"""
    providers: Dict[str, bool] = Field(..., description="Map of provider names to enabled status")
    default_provider: Optional[str] = Field(None, description="Provider to set as default")

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
        db = await get_database_manager()
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
        db = await get_database_manager()
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
        db = await get_database_manager()
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
        db = await get_database_manager()
        success = await AIProviderService.set_default_provider(db, tenant_id, request.provider_id)

        if not success:
            raise HTTPException(status_code=404, detail="Provider not found or update failed")

        return {"message": "Default provider updated successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting default provider: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to set default provider: {str(e)}")


@router.post("/save-settings")
async def save_provider_settings(
    request: SaveProviderSettingsRequest,
    x_tenant_id: str = Header(..., alias="X-Tenant-Id")
):
    """
    Save provider enable/disable settings for a tenant.
    
    IMPORTANT: Only ONE provider can be active at a time. Enabling a provider
    automatically disables all others. This endpoint enforces that exactly one
    provider is marked as is_active and is_default.
    
    This endpoint creates provider records if they don't exist and updates
    their enabled/disabled status.
    
    Args:
        request: Dictionary of provider names to enabled status, and optional default provider
        x_tenant_id: Tenant UUID from X-Tenant-Id header
        
    Returns:
        Success confirmation with list of updated providers and the active provider
        
    Example:
        POST /api/ai-providers/save-settings
        Header: X-Tenant-Id: 123e4567-e89b-12d3-a456-426614174000
        
        Body:
        {
          "providers": {
            "openai": false,
            "ollama": true,
            "anthropic": false
          }
        }
        
        Response:
        {
          "message": "Provider settings saved successfully",
          "updated_providers": ["openai", "ollama", "anthropic"],
          "active_provider": "ollama"
        }
    """
    try:
        db = await get_database_manager()
        updated = await AIProviderService.save_provider_settings(
            db, x_tenant_id, request.providers, request.default_provider
        )

        # Find which provider is now active
        enabled = [p for p, is_enabled in request.providers.items() if is_enabled]
        active_provider = enabled[0] if enabled else (request.default_provider or "openai")

        return {
            "message": "Provider settings saved successfully",
            "updated_providers": updated,
            "active_provider": active_provider
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving provider settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save provider settings: {str(e)}")


@router.get("/available")
async def get_available_providers():
    """
    Get list of available AI providers and which ones have system-configured keys.
    
    Returns which providers have API keys configured via environment variables.
    
    Example:
        GET /api/v1/ai-providers/available
        
        Response:
        {
          "available_providers": ["openai", "anthropic", "google", "ollama", "azure"],
          "system_configured": ["openai", "anthropic"],
          "status": "Ready"
        }
    """
    try:
        import os
        
        # Check which providers have system keys configured
        system_configured = []
        
        if os.getenv("OPENAI_API_KEY", ""):
            system_configured.append("openai")
        if os.getenv("ANTHROPIC_API_KEY", ""):
            system_configured.append("anthropic")
        if os.getenv("GOOGLE_API_KEY", ""):
            system_configured.append("google")
        if os.getenv("OLLAMA_ENABLED", "").lower() == "true":
            system_configured.append("ollama")
        if os.getenv("AZURE_OPENAI_API_KEY", ""):
            system_configured.append("azure")
        
        return {
            "available_providers": ["openai", "anthropic", "google", "ollama", "azure"],
            "system_configured": system_configured,
            "status": "Ready"
        }
        
    except Exception as e:
        logger.error(f"Error getting available providers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get available providers: {str(e)}")


@router.get("/ollama/download")
async def download_ollama_connector(
    organization_id: str = Query(..., description="Tenant/organization ID to bind this connector to"),
    api_url: Optional[str] = Query(None, description="Optional API base URL override"),
):
    """Build and serve a tenant-scoped Ollama connector ZIP.

    The connector registers as a runner for the provided organization_id,
    then establishes a persistent WebSocket connection to /ws/runner.
    """
    try:
        resolved_api_url = (api_url or "http://localhost:8000").rstrip("/")
        ws_url = resolved_api_url.replace("https://", "wss://").replace("http://", "ws://")

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            config = f"""{{
  \"api_url\": \"{resolved_api_url}\",
  \"ws_url\": \"{ws_url}/ws/runner\",
  \"organization_id\": \"{organization_id}\",
  \"runner_name\": \"ollama-connector\",
  \"capabilities\": [\"ollama-local\"],
  \"ollama_base_url\": \"http://localhost:11434\",
  \"ollama_model\": \"llama3.1:8b\"
}}"""
            zf.writestr("ollama-connector/config.json", config)

            requirements = """websockets>=12.0\nurllib3>=2.0\n"""
            zf.writestr("ollama-connector/requirements.txt", requirements)

            connector_py = """import asyncio
import json
import socket
from urllib import request
import websockets

RETRY_BASE_SECONDS = 2
RETRY_MAX_SECONDS = 60


def load_config():
    with open(\"config.json\", \"r\", encoding=\"utf-8\") as f:
        return json.load(f)


def register_runner(cfg):
    payload = {
        \"organization_id\": cfg[\"organization_id\"],
        \"runner_name\": f\"{cfg.get('runner_name', 'ollama-connector')}-{socket.gethostname()}\",
        \"capabilities\": cfg.get(\"capabilities\", [\"ollama-local\"]),
        \"hostname\": socket.gethostname(),
        \"os_name\": \"local\",
    }
    data = json.dumps(payload).encode(\"utf-8\")
    req = request.Request(
        f\"{cfg['api_url']}/api/v1/runners/register\",
        data=data,
        headers={\"Content-Type\": \"application/json\"},
        method=\"POST\",
    )
    with request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode(\"utf-8\"))


async def connect_and_listen(ws_url):
    async with websockets.connect(ws_url, ping_interval=20, ping_timeout=20) as ws:
        print(\"Ollama connector online\")
        while True:
            raw = await ws.recv()
            msg = json.loads(raw)
            msg_type = msg.get(\"type\")
            request_id = msg.get(\"request_id\")

            if msg_type == \"ping\":
                await ws.send(json.dumps({\"type\": \"pong\"}))
                continue

            if msg_type == \"ollama-infer\":
                # Placeholder for future tenant-scoped local inference routing.
                await ws.send(json.dumps({
                    \"type\": \"result\",
                    \"request_id\": request_id,
                    \"payload\": {
                        \"status\": \"not_implemented\",
                        \"message\": \"ollama-infer routing hook is ready; inference handler can be added here\"
                    }
                }))
                continue

            await ws.send(json.dumps({
                \"type\": \"error\",
                \"request_id\": request_id,
                \"error\": f\"Unsupported message type: {msg_type}\"
            }))


async def main():
    cfg = load_config()
    print(f\"Connected tenant: {cfg['organization_id']}\")

    retry_seconds = RETRY_BASE_SECONDS
    while True:
        try:
            registration = register_runner(cfg)
            token = registration[\"runner_token\"]
            ws_url = f\"{cfg['ws_url']}?token={token}\"
            print(f\"WebSocket: {ws_url}\")

            await connect_and_listen(ws_url)

            # If connect_and_listen returns without exception, reset retry delay.
            retry_seconds = RETRY_BASE_SECONDS
        except Exception as exc:
            print(f\"Connection lost or failed: {exc}. Retrying in {retry_seconds}s...\")
            await asyncio.sleep(retry_seconds)
            retry_seconds = min(retry_seconds * 2, RETRY_MAX_SECONDS)


if __name__ == \"__main__\":
    asyncio.run(main())
"""
            zf.writestr("ollama-connector/ollama_connector.py", connector_py)

            start_bat = """@echo off
setlocal
cd /d %~dp0

python -m pip install -r requirements.txt
python ollama_connector.py

pause
"""
            zf.writestr("ollama-connector/start-ollama-connector.bat", start_bat)

            start_sh = """#!/usr/bin/env bash
set -e
cd \"$(dirname \"$0\")\"

python3 -m pip install -r requirements.txt
python3 ollama_connector.py
"""
            zf.writestr("ollama-connector/start-ollama-connector.sh", start_sh)

            readme = """# Ollama Local Connector (Tenant-Scoped)

This package is generated for a specific tenant/organization.

## What it does
- Registers to your platform as a runner using the embedded organization_id
- Opens a persistent WebSocket connection to the runner hub
- Keeps the connector online for future local Ollama inference dispatch

## Quick Start
1. Ensure Ollama is installed and running locally (`ollama serve`)
2. Open this folder
3. Run `start-ollama-connector.bat` (Windows) or `./start-ollama-connector.sh` (Mac/Linux)

## Important
- `config.json` already contains your tenant `organization_id`
- This connector is WebSocket-based and bound to that tenant at registration time
"""
            zf.writestr("ollama-connector/README.md", readme)

        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=ollama-connector.zip"},
        )
    except Exception as e:
        logger.error(f"Error building Ollama connector package: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to build Ollama connector package: {str(e)}")
