"""
AI Provider Service - Database-backed provider configuration management

This service manages AI provider configurations stored in the database,
enabling tenants to bring their own keys (BYOK) and select which AI
provider to use for test generation, healing, and other AI operations.
"""

import asyncpg
import logging
import json
from typing import Optional, Dict, Any, List
from datetime import datetime
import os
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger("ai_provider_service")


def _get_fernet() -> Fernet:
    """Derive a Fernet key from the application SECRET_KEY."""
    secret = os.getenv("SECRET_KEY", "change-me-in-production")
    # Fernet requires a 32-byte url-safe base64 key. Derive one deterministically.
    key_bytes = hashlib.sha256(secret.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key_bytes))


def _encrypt_api_key(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def _decrypt_api_key(token: str) -> str:
    """Decrypt an API key. Falls back to plaintext for legacy rows."""
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except (InvalidToken, Exception):
        # Legacy row stored in plaintext — return as-is
        return token


class AIProviderService:
    """Service for managing AI provider configurations from the database"""
    
    @staticmethod
    async def get_active_provider(db: asyncpg.Connection, tenant_id: str, project_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get the active AI provider configuration for a tenant/project.
        
        **DEPLOYMENT NOTE:** Environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.) 
        remain the primary configuration method for deployments. Database configurations are 
        optional and used only when explicitly configured by tenants (BYOK).
        
        Priority:
        1. Database: Project-specific default provider (if project_id provided)
        2. Database: Tenant default provider (if tenant_id provided)
        3. Environment: System default (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
        
        If no database provider is found OR if database lookup fails, the system automatically
        falls back to environment variables, ensuring zero-downtime and backward compatibility.
        
        Args:
            db: Database connection
            tenant_id: Tenant UUID
            project_id: Optional project UUID for project-specific overrides
            
        Returns:
            Provider configuration dict with keys:
            - provider: Provider name (openai, anthropic, google, etc.)
            - api_key: Decrypted API key
            - model: Model identifier
            - endpoint_url: Optional custom endpoint
            - temperature: Model temperature
            - max_tokens: Max tokens per request
            - config_options: Additional JSONB options
            - source: "database" or "environment" (indicates config source)
        """
        try:
            # Try to get tenant's active provider from database
            provider_config = await db.fetchrow(
                """
                SELECT 
                    provider,
                    api_key_encrypted as api_key,
                    model,
                    endpoint_url,
                    temperature,
                    max_tokens,
                    config_options,
                    last_used_at
                FROM core.ai_provider_configs
                WHERE tenant_id = $1 
                    AND is_active = true 
                    AND is_default = true
                    AND is_verified = true
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                tenant_id
            )
            
            if provider_config:
                logger.info(f"✅ Found active provider '{provider_config['provider']}' for tenant {tenant_id}")
                
                # Update last_used_at timestamp
                await db.execute(
                    """
                    UPDATE core.ai_provider_configs
                    SET last_used_at = NOW(),
                        total_requests = total_requests + 1
                    WHERE tenant_id = $1 AND provider = $2 AND is_default = true
                    """,
                    tenant_id,
                    provider_config['provider']
                )
                
                # Handle API key - may be NULL for providers like Ollama that don't need one
                api_key = None
                if provider_config.get('api_key'):
                    api_key = _decrypt_api_key(provider_config['api_key'])

                # asyncpg may return JSONB as a string in some environments; normalize to dict.
                raw_config_options = provider_config.get('config_options')
                if isinstance(raw_config_options, str):
                    try:
                        parsed_config_options = json.loads(raw_config_options)
                    except Exception:
                        logger.warning("Invalid config_options JSON for tenant %s, provider %s; using empty object", tenant_id, provider_config['provider'])
                        parsed_config_options = {}
                elif isinstance(raw_config_options, dict):
                    parsed_config_options = raw_config_options
                else:
                    parsed_config_options = {}
                
                return {
                    "provider": provider_config['provider'],
                    "api_key": api_key,
                    "model": provider_config['model'] or AIProviderService._get_default_model(provider_config['provider']),
                    "endpoint_url": provider_config['endpoint_url'],
                    "temperature": float(provider_config['temperature']) if provider_config['temperature'] else 0.1,
                    "max_tokens": provider_config['max_tokens'] or 4000,
                    "config_options": parsed_config_options,
                    "source": "database"
                }
            
            # Fallback to environment variables (system default)
            logger.info(f"ℹ️ No database provider found for tenant {tenant_id}, using environment variables")
            return AIProviderService._get_system_default_provider()
            
        except Exception as e:
            logger.warning(f"⚠️ Database provider lookup failed: {e} - falling back to environment variables")
            # Fallback to system defaults on error (ensures deployment compatibility)
            return AIProviderService._get_system_default_provider()
    
    @staticmethod
    def _get_system_default_provider() -> Dict[str, Any]:
        """
        Get system default provider from environment variables.
        
        This is the PRIMARY configuration method for deployments (docker-compose, ECS, etc.).
        Environment variables ensure the system works out-of-the-box without database setup.
        
        Checks environment in priority order: Ollama (if enabled) -> OpenAI -> Anthropic -> Google
        """
        # Check which provider is configured via environment
        ollama_enabled = os.getenv("OLLAMA_ENABLED", "").lower() == "true"
        openai_key = os.getenv("OPENAI_API_KEY", "")
        anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        google_key = os.getenv("GOOGLE_API_KEY", "")
        
        # Ollama takes priority if explicitly enabled (local inference, no API key required)
        if ollama_enabled:
            return {
                "provider": "ollama",
                "api_key": None,  # Ollama doesn't require an API key
                "model": os.getenv("OLLAMA_MODEL", "llama3.1:8b"),
                "endpoint_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
                "temperature": float(os.getenv("OLLAMA_TEMPERATURE", "0.1")),
                "max_tokens": int(os.getenv("OLLAMA_MAX_TOKENS", "4000")),
                "config_options": {
                    "timeout_ms": int(os.getenv("OLLAMA_TIMEOUT_MS", "60000"))
                },
                "source": "environment"
            }
        elif openai_key:
            return {
                "provider": "openai",
                "api_key": openai_key,
                "model": os.getenv("OPENAI_MODEL", "gpt-4o"),
                "endpoint_url": None,
                "temperature": float(os.getenv("OPENAI_TEMPERATURE", "0.1")),
                "max_tokens": int(os.getenv("OPENAI_MAX_TOKENS", "4000")),
                "config_options": {},
                "source": "environment"
            }
        elif anthropic_key:
            return {
                "provider": "anthropic",
                "api_key": anthropic_key,
                "model": os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"),
                "endpoint_url": None,
                "temperature": float(os.getenv("ANTHROPIC_TEMPERATURE", "0.1")),
                "max_tokens": int(os.getenv("ANTHROPIC_MAX_TOKENS", "4000")),
                "config_options": {},
                "source": "environment"
            }
        elif google_key:
            return {
                "provider": "google",
                "api_key": google_key,
                "model": os.getenv("GOOGLE_MODEL", "gemini-2.0-flash-exp"),
                "endpoint_url": None,
                "temperature": float(os.getenv("GOOGLE_TEMPERATURE", "0.1")),
                "max_tokens": int(os.getenv("GOOGLE_MAX_TOKENS", "4000")),
                "config_options": {},
                "source": "environment"
            }
        
        # No provider configured
        logger.warning("⚠️ No AI provider configured in database or environment")
        return None
    
    @staticmethod
    def _get_default_model(provider: str) -> str:
        """Get default model for a given provider"""
        defaults = {
            "openai": "gpt-4o",
            "anthropic": "claude-3-5-sonnet-20241022",
            "google": "gemini-2.0-flash-exp",
            "azure": "gpt-4o",
            "ollama": "llama3.1:8b"
        }
        return defaults.get(provider, "gpt-4o")
    
    @staticmethod
    async def list_providers(db: asyncpg.Connection, tenant_id: str) -> List[Dict[str, Any]]:
        """
        List all AI provider configurations for a tenant.
        
        Args:
            db: Database connection
            tenant_id: Tenant UUID
            
        Returns:
            List of provider configurations (without full API keys)
        """
        providers = await db.fetch(
            """
            SELECT 
                id,
                provider,
                provider_name,
                api_key_last_4,
                model,
                endpoint_url,
                temperature,
                max_tokens,
                is_active,
                is_default,
                is_verified,
                last_verified_at,
                total_requests,
                total_tokens_used,
                last_used_at,
                created_at,
                updated_at
            FROM core.ai_provider_configs
            WHERE tenant_id = $1
            ORDER BY is_default DESC, is_active DESC, created_at DESC
            """,
            tenant_id
        )
        
        return [dict(p) for p in providers]
    
    @staticmethod
    async def set_default_provider(db: asyncpg.Connection, tenant_id: str, provider_id: str) -> bool:
        """
        Set a provider as the default for a tenant.
        
        Args:
            db: Database connection
            tenant_id: Tenant UUID
            provider_id: Provider config UUID to set as default
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # First, unset all other defaults for this tenant
            await db.execute(
                """
                UPDATE core.ai_provider_configs
                SET is_default = false
                WHERE tenant_id = $1 AND is_default = true
                """,
                tenant_id
            )
            
            # Set the new default
            result = await db.execute(
                """
                UPDATE core.ai_provider_configs
                SET is_default = true, updated_at = NOW()
                WHERE id = $1 AND tenant_id = $2
                """,
                provider_id,
                tenant_id
            )
            
            logger.info(f"✅ Set provider {provider_id} as default for tenant {tenant_id}")
            return "UPDATE" in result
            
        except Exception as e:
            logger.error(f"❌ Error setting default provider: {e}")
            return False
    
    @staticmethod
    async def create_provider_config(
        db: asyncpg.Connection,
        tenant_id: str,
        provider: str,
        api_key: str,
        model: Optional[str] = None,
        provider_name: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4000,
        config_options: Optional[Dict[str, Any]] = None,
        created_by: Optional[str] = None,
        is_default: bool = False
    ) -> Optional[str]:
        """
        Create a new AI provider configuration.
        
        Note: In production, api_key should be encrypted before storage.
        
        Args:
            db: Database connection
            tenant_id: Tenant UUID
            provider: Provider name (openai, anthropic, etc.)
            api_key: API key (will be encrypted in production)
            model: Model identifier
            provider_name: Optional friendly name
            endpoint_url: Optional custom endpoint
            temperature: Model temperature (0-1)
            max_tokens: Max tokens per request
            config_options: Additional configuration options
            created_by: User UUID who created this config
            is_default: Whether to set as default provider
            
        Returns:
            UUID of created provider config, or None on error
        """
        try:
            # Extract last 4 characters of API key for display
            api_key_last_4 = api_key[-4:] if len(api_key) >= 4 else "****"
            
            # If setting as default, unset other defaults first
            if is_default:
                await db.execute(
                    "UPDATE core.ai_provider_configs SET is_default = false WHERE tenant_id = $1",
                    tenant_id
                )
            
            # Insert new provider config
            provider_id = await db.fetchval(
                """
                INSERT INTO core.ai_provider_configs (
                    tenant_id,
                    provider,
                    provider_name,
                    api_key_encrypted,
                    api_key_last_4,
                    model,
                    endpoint_url,
                    temperature,
                    max_tokens,
                    is_default,
                    config_options,
                    created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
                """,
                tenant_id,
                provider,
                provider_name or f"{provider.capitalize()} Configuration",
                _encrypt_api_key(api_key),
                api_key_last_4,
                model or AIProviderService._get_default_model(provider),
                endpoint_url,
                temperature,
                max_tokens,
                is_default,
                config_options or {},
                created_by
            )
            
            logger.info(f"✅ Created provider config {provider_id} for tenant {tenant_id}")
            return str(provider_id)
            
        except Exception as e:
            logger.error(f"❌ Error creating provider config: {e}")
            return None
    
    @staticmethod
    async def update_provider_usage(
        db: asyncpg.Connection,
        tenant_id: str,
        provider: str,
        tokens_used: int
    ) -> None:
        """
        Update usage statistics for a provider.
        
        Args:
            db: Database connection
            tenant_id: Tenant UUID
            provider: Provider name
            tokens_used: Number of tokens used in this request
        """
        try:
            await db.execute(
                """
                UPDATE core.ai_provider_configs
                SET total_tokens_used = total_tokens_used + $3,
                    last_used_at = NOW()
                WHERE tenant_id = $1 AND provider = $2 AND is_default = true
                """,
                tenant_id,
                provider,
                tokens_used
            )
        except Exception as e:
            logger.debug(f"Failed to update provider usage: {e}")
    
    @staticmethod
    async def save_provider_settings(
        db: asyncpg.Connection,
        tenant_id: str,
        providers: Dict[str, bool],
        default_provider: Optional[str] = None
    ) -> List[str]:
        """
        Save provider enable/disable settings for a tenant.
        
        Only ONE provider can be enabled at a time. Enabling a provider
        automatically disables all others.
        
        Creates provider records if they don't exist, updates enable/disable status,
        and optionally sets a default provider.
        
        Args:
            db: Database connection
            tenant_id: Tenant UUID
            providers: Dictionary mapping provider names to enabled status
            default_provider: Optional provider name to set as default (or auto-detect from enabled providers)
            
        Returns:
            List of provider names that were updated
        """
        try:
            updated = []
            
            # First, ensure the tenant exists
            tenant_check = await db.fetchval(
                "SELECT id FROM core.tenants WHERE id = $1",
                tenant_id
            )
            if not tenant_check:
                logger.warning(f"Tenant {tenant_id} not found, skipping provider settings save")
                return []
            
            # Find which provider should be enabled (the one marked True)
            enabled_providers = [p for p, is_enabled in providers.items() if is_enabled]
            if len(enabled_providers) > 1:
                # If multiple enabled, use only the first one (or default_provider if specified)
                if default_provider and default_provider in enabled_providers:
                    active_provider = default_provider
                else:
                    active_provider = enabled_providers[0]
                logger.info(f"Multiple providers marked enabled; activating only {active_provider}")
            elif len(enabled_providers) == 1:
                active_provider = enabled_providers[0]
            else:
                # No providers enabled - keep current default or fall back to openai
                logger.warning(f"No providers enabled for tenant {tenant_id}")
                active_provider = default_provider or "openai"
            
            # For each provider, create or update its record
            for provider_name in providers.keys():
                try:
                    is_now_enabled = provider_name == active_provider
                    is_now_default = provider_name == active_provider
                    default_model = AIProviderService._get_default_model(provider_name)
                    default_endpoint = None
                    if provider_name == "ollama":
                        default_endpoint = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
                    
                    # Check if provider config exists for this tenant
                    existing = await db.fetchrow(
                        """
                        SELECT id FROM core.ai_provider_configs
                        WHERE tenant_id = $1 AND provider = $2
                        """,
                        tenant_id,
                        provider_name
                    )
                    
                    if existing:
                        # Update existing provider
                        await db.execute(
                            """
                            UPDATE core.ai_provider_configs
                            SET is_active = $2,
                                is_default = $3,
                                is_verified = $4,
                                model = COALESCE(model, $5),
                                endpoint_url = COALESCE(endpoint_url, $6),
                                updated_at = NOW()
                            WHERE id = $1
                            """,
                            existing['id'],
                            is_now_enabled,
                            is_now_default,
                            is_now_default,  # Mark as verified if it's now the default
                            default_model,
                            default_endpoint,
                        )
                    else:
                        # Create new provider record

                        await db.execute(
                            """
                            INSERT INTO core.ai_provider_configs 
                            (tenant_id, provider, provider_name, model, endpoint_url, is_active, is_default, is_verified)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                            """,
                            tenant_id,
                            provider_name,
                            provider_name.capitalize(),
                            default_model,
                            default_endpoint,
                            is_now_enabled,
                            is_now_default,
                            is_now_default  # Mark as verified if it's the default
                        )
                    
                    updated.append(provider_name)
                    logger.info(f"✅ Saved provider {provider_name} (enabled={is_now_enabled}, default={is_now_default}) for tenant {tenant_id}")
                    
                except Exception as e:
                    logger.error(f"❌ Error saving provider {provider_name}: {e}")
                    continue
            
            logger.info(f"✅ Set {active_provider} as active provider for tenant {tenant_id}")
            return updated
            
        except Exception as e:
            logger.error(f"Error saving provider settings: {e}")
            raise
