"""
AI Configuration API
Provides endpoints for managing AI provider settings and switching between providers
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import os
import json
import logging

logger = logging.getLogger("ai_config_api")

router = APIRouter()

# =========================
# Data Models
# =========================

class AIProviderConfig(BaseModel):
    """Configuration for an AI provider"""
    provider: str = Field(..., description="Provider name (openai, anthropic, azure)")
    model: str = Field(..., description="Model identifier")
    api_key: str = Field("", description="API key for the provider")
    api_base: Optional[str] = Field(None, description="Custom API base URL")
    enabled: bool = Field(True, description="Whether this provider is enabled")
    timeout_ms: int = Field(30000, description="Request timeout in milliseconds")
    max_retries: int = Field(2, description="Maximum number of retries")
    temperature: float = Field(0.1, description="Model temperature")
    max_tokens: int = Field(4000, description="Maximum tokens per request")

class AIConfigurationRequest(BaseModel):
    """Request to update AI configuration"""
    active_provider: str = Field(..., description="Currently active provider")
    providers: List[AIProviderConfig] = Field(..., description="List of provider configurations")

class AIConfigurationResponse(BaseModel):
    """Response with current AI configuration"""
    active_provider: str
    providers: List[AIProviderConfig]
    available_models: Dict[str, List[str]]
    status: Dict[str, Any]

class ProviderTestRequest(BaseModel):
    """Request to test a provider configuration"""
    provider_config: AIProviderConfig
    test_prompt: str = Field(default="Hello, please respond with 'OK' to confirm connectivity.")

class ProviderTestResponse(BaseModel):
    """Response from provider test"""
    success: bool
    response_text: Optional[str] = None
    latency_ms: Optional[int] = None
    error_message: Optional[str] = None
    token_usage: Optional[Dict[str, int]] = None

# =========================
# Available Models by Provider
# =========================

AVAILABLE_MODELS = {
    "openai": [
        "gpt-4o",
        "gpt-4o-mini", 
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo"
    ],
    "anthropic": [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307"
    ],
    "azure": [
        "gpt-4o",
        "gpt-4-turbo", 
        "gpt-4",
        "gpt-35-turbo"
    ],
    "local": [
        "llama-3.1-8b",
        "llama-3.1-70b",
        "mixtral-8x7b"
    ]
}

# =========================
# Configuration Storage
# =========================

def get_config_file_path() -> str:
    """Get the path to the AI configuration file"""
    return os.path.join(os.path.dirname(__file__), "..", "config", "ai_providers.json")

def load_ai_configuration() -> Dict[str, Any]:
    """Load AI configuration from file"""
    config_file = get_config_file_path()
    
    # Default configuration if file doesn't exist
    default_config = {
        "active_provider": "openai",
        "providers": [
            {
                "provider": "openai",
                "model": "gpt-4o",
                "api_key": os.getenv("OPENAI_API_KEY", ""),
                "enabled": True,
                "timeout_ms": 30000,
                "max_retries": 2,
                "temperature": 0.1,
                "max_tokens": 4000
            },
            {
                "provider": "anthropic", 
                "model": "claude-3-5-sonnet-20241022",
                "api_key": os.getenv("ANTHROPIC_API_KEY", ""),
                "enabled": False,
                "timeout_ms": 30000,
                "max_retries": 2,
                "temperature": 0.1,
                "max_tokens": 4000
            }
        ]
    }
    
    try:
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config = json.load(f)
                return config
        else:
            # Create default config file
            save_ai_configuration(default_config)
            return default_config
    except Exception as e:
        logger.error(f"Error loading AI configuration: {e}")
        return default_config

def save_ai_configuration(config: Dict[str, Any]) -> None:
    """Save AI configuration to file"""
    config_file = get_config_file_path()
    
    try:
        # Ensure config directory exists
        os.makedirs(os.path.dirname(config_file), exist_ok=True)
        
        with open(config_file, 'w') as f:
            json.dump(config, f, indent=2)
        logger.info(f"AI configuration saved to {config_file}")
    except Exception as e:
        logger.error(f"Error saving AI configuration: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save configuration: {e}")

# =========================
# Provider Testing
# =========================

async def test_openai_provider(config: AIProviderConfig, test_prompt: str) -> ProviderTestResponse:
    """Test OpenAI provider connectivity"""
    import time
    
    try:
        from openai import OpenAI
        
        if not config.api_key:
            return ProviderTestResponse(
                success=False,
                error_message="API key is required for OpenAI"
            )
        
        client = OpenAI(api_key=config.api_key)
        start_time = time.time()
        
        response = client.chat.completions.create(
            model=config.model,
            messages=[{"role": "user", "content": test_prompt}],
            max_tokens=50,
            temperature=0.1,
            timeout=config.timeout_ms / 1000
        )
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        return ProviderTestResponse(
            success=True,
            response_text=response.choices[0].message.content,
            latency_ms=latency_ms,
            token_usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        )
        
    except Exception as e:
        return ProviderTestResponse(
            success=False,
            error_message=str(e)
        )

async def test_anthropic_provider(config: AIProviderConfig, test_prompt: str) -> ProviderTestResponse:
    """Test Anthropic provider connectivity"""
    import time
    
    try:
        import anthropic
        
        if not config.api_key:
            return ProviderTestResponse(
                success=False,
                error_message="API key is required for Anthropic"
            )
        
        client = anthropic.Anthropic(api_key=config.api_key)
        start_time = time.time()
        
        message = client.messages.create(
            model=config.model,
            max_tokens=50,
            temperature=0.1,
            messages=[{"role": "user", "content": test_prompt}],
            timeout=config.timeout_ms / 1000
        )
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        return ProviderTestResponse(
            success=True,
            response_text=message.content[0].text,
            latency_ms=latency_ms,
            token_usage={
                "prompt_tokens": message.usage.input_tokens,
                "completion_tokens": message.usage.output_tokens,
                "total_tokens": message.usage.input_tokens + message.usage.output_tokens
            }
        )
        
    except Exception as e:
        return ProviderTestResponse(
            success=False,
            error_message=str(e)
        )

# =========================
# API Endpoints
# =========================

@router.get("/config", response_model=AIConfigurationResponse)
async def get_ai_configuration():
    """Get current AI configuration"""
    try:
        config = load_ai_configuration()
        
        # Get provider status
        status = {}
        for provider_config in config.get("providers", []):
            provider = provider_config.get("provider")
            api_key = provider_config.get("api_key", "")
            status[provider] = {
                "configured": bool(api_key),
                "enabled": provider_config.get("enabled", False),
                "model": provider_config.get("model", ""),
                "api_key_present": bool(api_key),
                "api_key_length": len(api_key) if api_key else 0
            }
        
        return AIConfigurationResponse(
            active_provider=config.get("active_provider", "openai"),
            providers=[AIProviderConfig(**p) for p in config.get("providers", [])],
            available_models=AVAILABLE_MODELS,
            status=status
        )
        
    except Exception as e:
        logger.error(f"Error getting AI configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/config", response_model=Dict[str, str])
async def update_ai_configuration(request: AIConfigurationRequest):
    """Update AI configuration"""
    try:
        # Validate active provider exists in providers list
        provider_names = [p.provider for p in request.providers]
        if request.active_provider not in provider_names:
            raise HTTPException(
                status_code=400, 
                detail=f"Active provider '{request.active_provider}' not found in providers list"
            )
        
        # Convert to dict format for storage
        config_data = {
            "active_provider": request.active_provider,
            "providers": [p.model_dump() for p in request.providers]
        }
        
        save_ai_configuration(config_data)
        
        # Update environment variables for backward compatibility
        active_config = next((p for p in request.providers if p.provider == request.active_provider), None)
        if active_config:
            if active_config.provider == "openai":
                os.environ["OPENAI_API_KEY"] = active_config.api_key
                os.environ["OPENAI_MODEL"] = active_config.model
            elif active_config.provider == "anthropic":
                os.environ["ANTHROPIC_API_KEY"] = active_config.api_key
        
        logger.info(f"AI configuration updated - active provider: {request.active_provider}")
        
        return {"status": "success", "message": "AI configuration updated successfully"}
        
    except Exception as e:
        logger.error(f"Error updating AI configuration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test-provider", response_model=ProviderTestResponse)
async def test_ai_provider(request: ProviderTestRequest):
    """Test connectivity and functionality of an AI provider"""
    try:
        if request.provider_config.provider == "openai":
            return await test_openai_provider(request.provider_config, request.test_prompt)
        elif request.provider_config.provider == "anthropic":
            return await test_anthropic_provider(request.provider_config, request.test_prompt)
        else:
            return ProviderTestResponse(
                success=False,
                error_message=f"Provider '{request.provider_config.provider}' testing not yet implemented"
            )
            
    except Exception as e:
        logger.error(f"Error testing AI provider: {e}")
        return ProviderTestResponse(
            success=False,
            error_message=str(e)
        )

@router.get("/available-models")
async def get_available_models():
    """Get available models for all providers"""
    return {"available_models": AVAILABLE_MODELS}

@router.post("/switch-provider")
async def switch_active_provider(provider: str):
    """Switch the active AI provider"""
    try:
        config = load_ai_configuration()
        
        # Validate provider exists
        provider_names = [p.get("provider") for p in config.get("providers", [])]
        if provider not in provider_names:
            raise HTTPException(
                status_code=400,
                detail=f"Provider '{provider}' not found in configuration"
            )
        
        config["active_provider"] = provider
        save_ai_configuration(config)
        
        logger.info(f"Active AI provider switched to: {provider}")
        
        return {"status": "success", "message": f"Active provider switched to {provider}"}
        
    except Exception as e:
        logger.error(f"Error switching AI provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_ai_status():
    """Get current AI service status"""
    try:
        config = load_ai_configuration()
        active_provider = config.get("active_provider", "openai")
        
        # Find active provider config
        active_config = None
        for provider_config in config.get("providers", []):
            if provider_config.get("provider") == active_provider:
                active_config = provider_config
                break
        
        status = {
            "active_provider": active_provider,
            "configured": bool(active_config and active_config.get("api_key")),
            "enabled": bool(active_config and active_config.get("enabled")),
            "model": active_config.get("model") if active_config else "",
            "total_providers": len(config.get("providers", [])),
            "enabled_providers": len([p for p in config.get("providers", []) if p.get("enabled")])
        }
        
        return status
        
    except Exception as e:
        logger.error(f"Error getting AI status: {e}")
        raise HTTPException(status_code=500, detail=str(e))