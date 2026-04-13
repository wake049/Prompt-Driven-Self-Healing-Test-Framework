"""
AI Configuration API
Provides endpoints for managing AI provider settings and switching between providers
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import os
import logging
import httpx

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
    timeout_ms: int = Field(90000, description="Request timeout in milliseconds")
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
        "claude-3-opus-20240229",
        "claude-3-haiku-20240307"
    ],
    "azure": [
        "gpt-4o",
        "gpt-4-turbo", 
        "gpt-4",
        "gpt-35-turbo"
    ],
    "google": [
        "gemini-1.5-flash",
        "gemini-1.5-flash-001",
        "gemini-1.5-pro",
        "gemini-1.5-pro-001",
        "gemini-2.0-flash-exp"
    ],
    "ollama": [
        "llama3.1:8b",
        "llama3.1:70b",
        "llama3.2:3b",
        "mistral:7b",
        "mixtral:8x7b",
        "codellama:13b",
        "qwen2.5:7b",
        "deepseek-coder:6.7b"
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

def load_ai_configuration() -> Dict[str, Any]:
    """Load AI configuration from environment variables only."""
    return {
        "active_provider": "openai",
        "providers": [
            {
                "provider": "openai",
                "model": "gpt-4o",
                "api_key": os.getenv("OPENAI_API_KEY", ""),
                "enabled": True,
                "timeout_ms": 90000,
                "max_retries": 2,
                "temperature": 0.1,
                "max_tokens": 4000
            },
            {
                "provider": "anthropic", 
                "model": "claude-sonnet-4-5",
                "api_key": os.getenv("ANTHROPIC_API_KEY", ""),
                "enabled": bool(os.getenv("ANTHROPIC_API_KEY", "")),
                "timeout_ms": 90000,
                "max_retries": 2,
                "temperature": 0.1,
                "max_tokens": 4000
            },
            {
                "provider": "google",
                "model": "gemini-2.5-pro",
                "api_key": os.getenv("GOOGLE_API_KEY", ""),
                "enabled": bool(os.getenv("GOOGLE_API_KEY", "")),
                "timeout_ms": 90000,
                "max_retries": 2,
                "temperature": 0.1,
                "max_tokens": 4000
            },
            {
                "provider": "ollama",
                "model": os.getenv("OLLAMA_MODEL", "llama3.1:8b"),
                "api_key": "",  # Ollama doesn't require an API key
                "api_base": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
                "enabled": os.getenv("OLLAMA_ENABLED", "").lower() == "true",
                "timeout_ms": int(os.getenv("OLLAMA_TIMEOUT_MS", "60000")),  # Longer timeout for local inference
                "max_retries": 2,
                "temperature": 0.1,
                "max_tokens": 4000
            }
        ]
    }

def save_ai_configuration(config: Dict[str, Any]) -> None:
    """Configuration persistence is disabled in env-only mode."""
    raise HTTPException(
        status_code=400,
        detail="AI configuration is env-only. Update environment variables and restart the service."
    )

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
        try:
            import anthropic
        except ImportError:
            return ProviderTestResponse(
                success=False,
                error_message="Anthropic library not installed. Run: pip install anthropic"
            )
        
        if not config.api_key:
            return ProviderTestResponse(
                success=False,
                error_message="API key is required for Anthropic"
            )
        
        client = anthropic.Anthropic(api_key=config.api_key)
        start_time = time.time()
        
        # Try different API approaches for compatibility
        try:
            # Try the new messages API first
            message = client.messages.create(
                model=config.model,
                max_tokens=50,
                messages=[{"role": "user", "content": test_prompt}]
            )
            response_text = message.content[0].text
            token_usage = {
                "prompt_tokens": message.usage.input_tokens if hasattr(message, 'usage') else 0,
                "completion_tokens": message.usage.output_tokens if hasattr(message, 'usage') else 0,
                "total_tokens": (message.usage.input_tokens + message.usage.output_tokens) if hasattr(message, 'usage') else 0
            }
        except Exception as api_error:
            # Fallback to legacy completions API
            try:
                response = client.completions.create(
                    model=config.model,
                    prompt=f"Human: {test_prompt}\n\nAssistant:",
                    max_tokens_to_sample=50
                )
                response_text = response.completion
                token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            except Exception:
                # If both fail, return the original error
                raise api_error
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        return ProviderTestResponse(
            success=True,
            response_text=response_text,
            latency_ms=latency_ms,
            token_usage=token_usage
        )
        
    except Exception as e:
        return ProviderTestResponse(
            success=False,
            error_message=str(e)
        )

async def test_google_provider(config: AIProviderConfig, test_prompt: str) -> ProviderTestResponse:
    """Test Google provider connectivity"""
    import time
    
    try:
        try:
            import google.generativeai as genai
        except ImportError:
            return ProviderTestResponse(
                success=False,
                error_message="Google Generative AI library not installed. Run: pip install google-generativeai"
            )
        
        if not config.api_key:
            return ProviderTestResponse(
                success=False,
                error_message="API key is required for Google"
            )
        
        # Configure the API key
        genai.configure(api_key=config.api_key)
        
        # Create the model - use model name without prefix
        model = genai.GenerativeModel(config.model)
        
        start_time = time.time()
        
        # Generate content with simpler configuration
        response = model.generate_content(test_prompt)
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        return ProviderTestResponse(
            success=True,
            response_text=response.text,
            latency_ms=latency_ms,
            token_usage={
                "prompt_tokens": 0,  # Google API doesn't always provide token counts
                "completion_tokens": 0,
                "total_tokens": 0
            }
        )
        
    except Exception as e:
        return ProviderTestResponse(
            success=False,
            error_message=str(e)
        )

async def test_ollama_provider(config: AIProviderConfig, test_prompt: str) -> ProviderTestResponse:
    """Test Ollama provider connectivity (local LLM)"""
    import time
    import httpx
    
    try:
        # First, do a quick health check to see if Ollama is running
        base_url = config.api_base or "http://localhost:11434"
        
        try:
            # Quick ping to Ollama API (should respond in <1 second if running)
            health_response = httpx.get(f"{base_url}/api/tags", timeout=3.0)
            if health_response.status_code != 200:
                return ProviderTestResponse(
                    success=False,
                    error_message=f"Ollama is not responding correctly at {base_url}. Status: {health_response.status_code}"
                )
        except httpx.ConnectError:
            return ProviderTestResponse(
                success=False,
                error_message=f"Cannot connect to Ollama at {base_url}. Make sure Ollama is running: 'ollama serve'"
            )
        except httpx.TimeoutException:
            return ProviderTestResponse(
                success=False,
                error_message=f"Ollama at {base_url} is not responding. Is it running?"
            )
        
        try:
            from openai import OpenAI
        except ImportError:
            return ProviderTestResponse(
                success=False,
                error_message="OpenAI library not installed (required for Ollama API compatibility). Run: pip install openai"
            )
        
        # Create OpenAI-compatible client for Ollama with short timeout for test
        client = OpenAI(
            base_url=f"{base_url}/v1",
            api_key="ollama",  # Ollama doesn't need a real API key
            timeout=10.0  # Short timeout for test
        )
        
        start_time = time.time()
        
        # Make the API call
        response = client.chat.completions.create(
            model=config.model,
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Respond briefly."},
                {"role": "user", "content": test_prompt}
            ],
            max_tokens=100,
            temperature=config.temperature
        )
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        response_text = response.choices[0].message.content if response.choices else ""
        
        # Extract token usage if available
        token_usage = None
        if hasattr(response, 'usage') and response.usage:
            token_usage = {
                "prompt_tokens": response.usage.prompt_tokens or 0,
                "completion_tokens": response.usage.completion_tokens or 0,
                "total_tokens": response.usage.total_tokens or 0
            }
        
        return ProviderTestResponse(
            success=True,
            response_text=response_text,
            latency_ms=latency_ms,
            token_usage=token_usage
        )
        
    except Exception as e:
        error_msg = str(e)
        # Provide helpful error messages for common Ollama issues
        if "connection" in error_msg.lower() or "refused" in error_msg.lower():
            error_msg = f"Cannot connect to Ollama at {config.api_base or 'http://localhost:11434'}. Make sure Ollama is running: 'ollama serve'"
        elif "model" in error_msg.lower() and "not found" in error_msg.lower():
            error_msg = f"Model '{config.model}' not found. Pull it first: 'ollama pull {config.model}'"
        
        return ProviderTestResponse(
            success=False,
            error_message=error_msg
        )

async def test_openai_compatible_provider(config: AIProviderConfig, test_prompt: str) -> ProviderTestResponse:
    """Test a custom provider using OpenAI-compatible API format"""
    import time

    try:
        from openai import OpenAI
    except ImportError:
        return ProviderTestResponse(
            success=False,
            error_message="OpenAI library not installed (required for compatible API testing). Run: pip install openai"
        )

    try:
        base_url = config.api_base.rstrip('/')
        if not base_url.endswith('/v1'):
            base_url = f"{base_url}/v1"

        client = OpenAI(
            base_url=base_url,
            api_key=config.api_key,
            timeout=config.timeout_ms / 1000
        )

        start_time = time.time()

        response = client.chat.completions.create(
            model=config.model,
            messages=[{"role": "user", "content": test_prompt}],
            max_tokens=50,
            temperature=0.1
        )

        latency_ms = int((time.time() - start_time) * 1000)

        token_usage = None
        if hasattr(response, 'usage') and response.usage:
            token_usage = {
                "prompt_tokens": response.usage.prompt_tokens or 0,
                "completion_tokens": response.usage.completion_tokens or 0,
                "total_tokens": response.usage.total_tokens or 0
            }

        return ProviderTestResponse(
            success=True,
            response_text=response.choices[0].message.content if response.choices else "",
            latency_ms=latency_ms,
            token_usage=token_usage
        )

    except Exception as e:
        return ProviderTestResponse(
            success=False,
            error_message=f"Custom provider test failed: {str(e)}"
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
            
            # For Ollama, "configured" means it's enabled (no API key needed)
            if provider == "ollama":
                status[provider] = {
                    "configured": provider_config.get("enabled", False),
                    "enabled": provider_config.get("enabled", False),
                    "model": provider_config.get("model", ""),
                    "api_key_present": True,  # Ollama doesn't need API key
                    "api_key_length": 0,
                    "api_base": provider_config.get("api_base", "http://localhost:11434"),
                    "local": True  # Flag to indicate this is a local provider
                }
            else:
                status[provider] = {
                    "configured": bool(api_key),
                    "enabled": provider_config.get("enabled", False),
                    "model": provider_config.get("model", ""),
                    "api_key_present": bool(api_key),
                    "api_key_length": len(api_key) if api_key else 0
                }
        
        # Mask API keys before returning to frontend
        masked_providers = []
        for p in config.get("providers", []):
            p_copy = dict(p)
            key = p_copy.get("api_key", "")
            if key and len(key) > 8:
                p_copy["api_key"] = key[:4] + "****" + key[-4:]
            elif key:
                p_copy["api_key"] = "****"
            masked_providers.append(AIProviderConfig(**p_copy))

        return AIConfigurationResponse(
            active_provider=config.get("active_provider", "openai"),
            providers=masked_providers,
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
                os.environ["ANTHROPIC_MODEL"] = active_config.model
            elif active_config.provider == "ollama":
                os.environ["OLLAMA_ENABLED"] = "true"
                os.environ["OLLAMA_MODEL"] = active_config.model
                if active_config.api_base:
                    os.environ["OLLAMA_BASE_URL"] = active_config.api_base
        
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
        elif request.provider_config.provider == "google":
            return await test_google_provider(request.provider_config, request.test_prompt)
        elif request.provider_config.provider == "ollama":
            return await test_ollama_provider(request.provider_config, request.test_prompt)
        else:
            # Attempt OpenAI-compatible test for custom/unknown providers
            if config.api_base and config.api_key:
                return await test_openai_compatible_provider(request.provider_config, request.test_prompt)
            return ProviderTestResponse(
                success=False,
                error_message=f"Provider '{request.provider_config.provider}' requires both api_base and api_key for testing"
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