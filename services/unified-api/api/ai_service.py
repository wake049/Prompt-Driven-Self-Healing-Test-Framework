"""
 Enterprise AI Service - Prompt-Driven Self-Healing Test Framework
Implements the Prompt/Actions/Elements contract with cost-effective enterprise features.

Enhanced Features:
- Enterprise-grade request handling with tenant separation
- ETag-based caching for ActionCatalog with 304 Not Modified support
- Intelligent element ranking with top-K selection strategies  
- Cost tracking and budget management
- Minimal payload serialization with gzip compression
- Consistent ID management (runId, tenantId, catalogId, pageId, elementId)
"""

from __future__ import annotations

import json
import os
import re
import time
import logging
from typing import Any, Dict, List, Optional, Tuple
import asyncio
from pathlib import Path
import asyncio
from fastapi import Depends, Request, HTTPException

# Configure logging for AI service
logger = logging.getLogger("ai_service")
logger.setLevel(logging.DEBUG)

try:
    from openai import OpenAI
except Exception:
    OpenAI = None

# Import enterprise components
from schemas.enterprise import (
    PromptEnvelope, PlanResponse, ActionCatalog, PageSlice, 
    ElementRankingConfig, ElementRankingStrategy, PlanStep, 
    CostSummary, Clarification, PageContext
)
from services.page_context_service import page_context_service
from core.element_ranking import ElementRankingService
from core.caching import CacheService  
from core.cost_management import CostManagementService
from core.database import get_database, DatabaseManager, get_database_manager

# Import authentication dependencies
try:
    from core.auth import get_current_active_user
    from models.auth_models import CurrentUser
except ImportError:
    # Define fallback types for when auth is not available
    from typing import Any
    CurrentUser = Any
    def get_current_active_user():
        return {"user_id": "anonymous", "is_admin": False}

class VariableValidationService:
    """Service to validate and correct AI-generated variable names against active data bindings"""
    
    def __init__(self):
        self.allowed_variables = set()
        self.variable_mappings = {}
        
    def load_allowed_variables(self, bindings: List[Dict[str, Any]]) -> None:
        """Load allowed variable names from active data bindings"""
        self.allowed_variables.clear()
        self.variable_mappings.clear()
        
        for binding in bindings:
            # Extract variable name from binding
            target = binding.get('target', {})
            if isinstance(target, str):
                try:
                    target = json.loads(target)
                except json.JSONDecodeError:
                    target = {}
            
            var_name = target.get('variable_name') or target.get('name') or binding.get('rule_name', '')
            if var_name:
                self.allowed_variables.add(var_name)# Create mapping for common invented variable names to real ones
        self._create_variable_mappings()
    
    def _create_variable_mappings(self) -> None:
        """Create mappings from common invented names to actual binding variables"""
        price_vars = [v for v in self.allowed_variables if 'price' in v.lower()]
        total_vars = [v for v in self.allowed_variables if 'total' in v.lower() or 'subtotal' in v.lower()]
        
        # Map common AI inventions to actual variables
        if price_vars:
            self.variable_mappings.update({
                'value1': price_vars[0],
                'value2': price_vars[1] if len(price_vars) > 1 else price_vars[0],
                'price1': price_vars[0],
                'price2': price_vars[1] if len(price_vars) > 1 else price_vars[0],
                'itemPrice': price_vars[0],
                'productPrice': price_vars[0]
            })
        
        if total_vars:
            self.variable_mappings.update({
                'calculatedTotal': total_vars[0],
                'calculatedResult': total_vars[0],
                'totalValue': total_vars[0],
                'computedTotal': total_vars[0],
                'sumTotal': total_vars[0],
                'finalTotal': total_vars[0]
            })
    def validate_and_correct_variable(self, variable_name: str) -> str:
        """Validate variable name and return corrected version if needed"""
        if not variable_name:
            return variable_name
            
        # If it's already allowed, return as-is
        if variable_name in self.allowed_variables:
            return variable_name
        
        # Check if we have a mapping for this invented name
        if variable_name in self.variable_mappings:
            corrected = self.variable_mappings[variable_name]
            return corrected
        
        # Try to find the closest allowed variable using fuzzy matching
        closest = self._find_closest_variable(variable_name)
        if closest:return closest
        
        # Last resort: reject the variable}")
        return None
    
    def _find_closest_variable(self, variable_name: str) -> Optional[str]:
        """Find the closest allowed variable using simple string similarity"""
        if not self.allowed_variables:
            return None
            
        variable_lower = variable_name.lower()
        
        # First pass: exact substring matches
        for allowed in self.allowed_variables:
            if variable_lower in allowed.lower() or allowed.lower() in variable_lower:
                return allowed
        
        # Second pass: common word matches
        common_words = ['price', 'total', 'subtotal', 'cost', 'value', 'amount']
        for word in common_words:
            if word in variable_lower:
                for allowed in self.allowed_variables:
                    if word in allowed.lower():
                        return allowed
        
        return None
    
    def validate_step_variables(self, step: 'PlanStep') -> 'PlanStep':
        """Validate and correct all variables in a plan step"""
        if not self.allowed_variables:
            return step  # No validation if no bindings loaded
        
        # Check extract_data steps
        if step.action == 'extract_data':
            if 'variable' in step.args:
                corrected = self.validate_and_correct_variable(step.args['variable'])
                if corrected:
                    step.args['variable'] = corrected
                else:
                    return None
        
        # Check calculate steps
        elif step.action == 'calculate':
            if 'result_variable' in step.args:
                corrected = self.validate_and_correct_variable(step.args['result_variable'])
                if corrected:
                    step.args['result_variable'] = corrected
                else:
                    return None
            
            # Also check variables within formulas
            if 'formula' in step.args:
                step.args['formula'] = self._correct_formula_variables(step.args['formula'])
        
        # Check variables in text assertions
        elif step.action == 'assert_text' and 'text' in step.args:
            step.args['text'] = self._correct_text_variables(step.args['text'])
        
        return step
    
    def _correct_formula_variables(self, formula: str) -> str:
        """Correct variable names within formulas"""
        import re
        
        # Find all variable references in the formula
        variables = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', formula)
        
        corrected_formula = formula
        for var in variables:
            # Skip operators and numbers
            if var in ['and', 'or', 'not', 'in', 'is', 'def', 'class', 'import', 'from']:
                continue
            
            corrected = self.validate_and_correct_variable(var)
            if corrected and corrected != var:
                corrected_formula = corrected_formula.replace(var, corrected)
        
        return corrected_formula
    
    def _correct_text_variables(self, text: str) -> str:
        """Correct variable references in text assertions (${variable} format)"""
        import re
        
        def replace_var(match):
            var_name = match.group(1)
            corrected = self.validate_and_correct_variable(var_name)
            if corrected:
                return f"${{{corrected}}}"
            else:return "[INVALID_VARIABLE]"
        
        return re.sub(r'\$\{([^}]+)\}', replace_var, text)

def _bool_env(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.lower() in ("1", "true", "yes", "on")

class EnterpriseAIService:
    """
    Enterprise AI Service implementing the Prompt/Actions/Elements contract.
    
    Public methods:
      - plan_test_steps(prompt_envelope) -> PlanResponse
      - get_action_catalog(catalog_id, version, if_none_match) -> ActionCatalog | 304
      - rank_page_elements(elements, config) -> PageSlice
    """

    def __init__(self) -> None:
        # Initialize enterprise components
        self.element_ranking = ElementRankingService()
        self.cache_service = CacheService()
        self.cost_management = CostManagementService()
        self.variable_validator = VariableValidationService()
        
        # Store constant bindings (for login credentials, etc.)
        self.constant_bindings = {}  # {variable_name: value}
        
        # Store API test data context for step generation
        self.api_test_data_setups = []  # Available API test data setups
        
        # Initialize AI clients
        self.client = None
        self.anthropic_client = None
        self.config = self._load_config()
        self._initialize_openai()  # This now initializes all providers
        
        # Rate limiting
        self.last_openai_call = 0
        self.min_call_interval = 2.0  # Minimum 2 seconds between AI calls

    async def _load_provider_config_from_db(self, tenant_id: Optional[str] = None, project_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Load provider configuration from database for a specific tenant/project.
        
        This enables BYOK (Bring Your Own Key) functionality where tenants can
        configure their own AI provider preferences.
        """
        if not tenant_id:
            return None
            
        try:
            from core.database import get_database_manager
            from services.ai_provider_service import AIProviderService

            db = await get_database_manager()
            if not db or not db.pool:
                return None

            async with db.pool.acquire() as conn:
                provider_config = await AIProviderService.get_active_provider(conn, tenant_id, project_id)
                
                if provider_config:
                    logger.info(f"✅ Loaded provider '{provider_config['provider']}' from database for tenant {tenant_id}")
                    return provider_config
                    
        except Exception as e:
            logger.debug(f"Could not load provider from database: {e}")
            
        return None
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration for AI services - supports dynamic configuration"""
        try:
            # Try to load from AI config API first
            from .ai_config_api import load_ai_configuration
            ai_config = load_ai_configuration()
            
            if ai_config and ai_config.get("providers"):
                active_provider = ai_config.get("active_provider", "openai")
                active_config = None
                
                # Find the active provider configuration
                for provider in ai_config.get("providers", []):
                    if provider.get("provider") == active_provider and provider.get("enabled"):
                        active_config = provider
                        break
                
                if active_config:
                    logger.info(f"🔄 Loading dynamic AI config - Active provider: {active_provider}")

                    # If config file has an empty key, fallback to environment variable for that provider.
                    provider_env_map = {
                        "openai": "OPENAI_API_KEY",
                        "anthropic": "ANTHROPIC_API_KEY",
                        "google": "GOOGLE_API_KEY",
                    }
                    provider_env_var = provider_env_map.get(active_provider)
                    env_api_key = os.getenv(provider_env_var, "") if provider_env_var else ""
                    if not active_config.get("api_key") and env_api_key:
                        logger.info(
                            "Using %s from environment because dynamic config has no key",
                            provider_env_var,
                        )
                        active_config["api_key"] = env_api_key
                    
                    # Map provider config to expected format
                    config = {
                        "current_provider": active_provider,
                        "openai": {
                            "apiKey": "",
                            "enabled": False,
                            "timeout": 20000,
                            "maxRetries": 1,
                            "model": "gpt-4o",
                        },
                        "anthropic": {
                            "apiKey": "",
                            "enabled": False,
                            "timeout": 20000,
                            "maxRetries": 1,
                            "model": "claude-3-5-sonnet-20241022",
                        }
                    }
                    
                    # Set configuration for active provider
                    if active_provider in config:
                        config[active_provider] = {
                            "apiKey": active_config.get("api_key", ""),
                            "enabled": active_config.get("enabled", False),
                            "timeout": active_config.get("timeout_ms", 20000),
                            "maxRetries": active_config.get("max_retries", 1),
                            "model": active_config.get("model", ""),
                            "temperature": active_config.get("temperature", 0.1),
                            "maxTokens": active_config.get("max_tokens", 4000),
                        }

                    # If key is still missing for key-based providers, fallback to env-based config block.
                    if active_provider in ("openai", "anthropic", "google") and not config[active_provider].get("apiKey"):
                        logger.warning(
                            "Active provider '%s' has no API key in dynamic config or environment; falling back to env-based provider selection",
                            active_provider,
                        )
                    else:
                        return config
        
        except Exception as e:
            logger.warning(f"⚠️  Failed to load dynamic AI config: {e} - falling back to environment variables")
        
        # Fallback to environment variables (backward compatibility)
        # Determine default provider based on what's configured
        if os.getenv("OLLAMA_ENABLED", "").lower() == "true":
            default_provider = "ollama"
        elif os.getenv("ANTHROPIC_API_KEY"):
            default_provider = "anthropic"
        else:
            default_provider = "openai"
        
        return {
            "current_provider": os.getenv("AI_PROVIDER", default_provider),
            "openai": {
                "apiKey": os.getenv("OPENAI_API_KEY", ""),
                "enabled": _bool_env("OPENAI_ENABLED", True),
                "timeout": int(os.getenv("OPENAI_TIMEOUT_MS", "20000")),
                "maxRetries": int(os.getenv("OPENAI_MAX_RETRIES", "1")),
                "model": os.getenv("OPENAI_MODEL", "gpt-4o"),
                "temperature": float(os.getenv("OPENAI_TEMPERATURE", "0.1")),
                "maxTokens": int(os.getenv("OPENAI_MAX_TOKENS", "4000")),
            },
            "anthropic": {
                "apiKey": os.getenv("ANTHROPIC_API_KEY", ""),
                "enabled": _bool_env("ANTHROPIC_ENABLED", False),
                "timeout": int(os.getenv("ANTHROPIC_TIMEOUT_MS", "20000")),
                "maxRetries": int(os.getenv("ANTHROPIC_MAX_RETRIES", "1")),
                "model": os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"),
                "temperature": float(os.getenv("ANTHROPIC_TEMPERATURE", "0.1")),
                "maxTokens": int(os.getenv("ANTHROPIC_MAX_TOKENS", "4000")),
            },
            "ollama": {
                "baseUrl": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
                "enabled": _bool_env("OLLAMA_ENABLED", False),
                "timeout": int(os.getenv("OLLAMA_TIMEOUT_MS", "60000")),  # Longer timeout for local inference
                "maxRetries": int(os.getenv("OLLAMA_MAX_RETRIES", "2")),
                "model": os.getenv("OLLAMA_MODEL", "llama3.1:8b"),
                "temperature": float(os.getenv("OLLAMA_TEMPERATURE", "0.1")),
                "maxTokens": int(os.getenv("OLLAMA_MAX_TOKENS", "4000")),
            }
        }

    def _initialize_openai(self) -> None:
        """Initialize AI clients based on configuration (OpenAI, Anthropic, Ollama)"""
        current_provider = self.config.get("current_provider", "openai")
        logger.info(f" Initializing AI service - Current provider: {current_provider}")
        
        # Initialize clients
        self.client = None
        self.anthropic_client = None
        self.ollama_client = None
        
        try:
            # Initialize OpenAI if configured
            openai_config = self.config.get("openai", {})
            if openai_config.get("enabled") and openai_config.get("apiKey"):
                if OpenAI is None:
                    logger.warning("⚠️  OpenAI library not available")
                else:
                    api_key = openai_config["apiKey"]
                    if api_key.startswith('sk-'):
                        # Disable internal retries to let our retry logic handle failures
                        self.client = OpenAI(
                            api_key=api_key,
                            max_retries=0  # Disable OpenAI SDK's internal retry mechanism
                        )
                        logger.info("✅ OpenAI client initialized successfully (internal retries disabled)")
                    else:
                        logger.error("❌ Invalid OpenAI API key format (should start with 'sk-')")
            
            # Initialize Anthropic if configured
            anthropic_config = self.config.get("anthropic", {})
            if anthropic_config.get("enabled") and anthropic_config.get("apiKey"):
                try:
                    import anthropic
                    api_key = anthropic_config["apiKey"]
                    if api_key.startswith('sk-ant-'):
                        self.anthropic_client = anthropic.Anthropic(api_key=api_key)
                        logger.info("✅ Anthropic client initialized successfully")
                    else:
                        logger.error("❌ Invalid Anthropic API key format (should start with 'sk-ant-')")
                except ImportError:
                    logger.warning("⚠️  Anthropic library not available")
            
            # Initialize Ollama if configured (uses OpenAI-compatible API)
            ollama_config = self.config.get("ollama", {})
            if ollama_config.get("enabled"):
                if OpenAI is None:
                    logger.warning("⚠️  OpenAI library not available (required for Ollama client)")
                else:
                    try:
                        base_url = ollama_config.get("baseUrl", "http://localhost:11434")
                        # Ollama uses OpenAI-compatible API at /v1 endpoint
                        # Note: Client creation doesn't connect - connection happens on first request
                        self.ollama_client = OpenAI(
                            base_url=f"{base_url}/v1",
                            api_key="ollama",  # Ollama doesn't require a real API key
                            max_retries=0,
                            timeout=5.0  # Short timeout for client creation
                        )
                        logger.info(f"✅ Ollama client initialized (base_url: {base_url}) - connection will be tested on first request")
                    except Exception as ollama_err:
                        logger.warning(f"⚠️ Could not initialize Ollama client: {ollama_err}")
                        self.ollama_client = None
            
            # Set active client based on current provider
            if current_provider == "ollama" and self.ollama_client:
                logger.info(" Using Ollama as active provider")
            elif current_provider == "anthropic" and self.anthropic_client:
                logger.info(" Using Anthropic as active provider")
            elif current_provider == "openai" and self.client:
                logger.info(" Using OpenAI as active provider")
            else:
                logger.warning(f"⚠️  Configured provider '{current_provider}' not available, falling back to heuristic mode")
                self.client = None
                self.anthropic_client = None
                
        except Exception as e:
            logger.error(f"❌ Error initializing AI clients: {e}")
            self.client = None
            self.anthropic_client = None
            self.ollama_client = None

    def _get_current_provider_config(self) -> Dict[str, Any]:
        """Get configuration for the currently active provider"""
        current_provider = self.config.get("current_provider", "openai")
        return self.config.get(current_provider, self.config.get("openai", {}))

    def _get_current_model(self) -> str:
        """Get model for the currently active provider"""
        provider_config = self._get_current_provider_config()
        return provider_config.get("model", "gpt-4o")

    def load_constant_bindings(self, bindings: List[Dict[str, Any]]) -> None:
        """Load constant bindings from database bindings data"""
        self.constant_bindings.clear()
        logger.info(f"🔑 Loading constant bindings from {len(bindings)} total bindings...")
        
        for binding in bindings:
            binding_type = binding.get('binding_type', '').lower()
            source_config = binding.get('source_config', {})
            
            # Parse source_config if it's a string
            if isinstance(source_config, str):
                try:
                    import json
                    source_config = json.loads(source_config)
                    logger.debug(f"   Parsed source_config string for {binding.get('name')}")
                except json.JSONDecodeError:
                    source_config = {}
                    logger.warning(f"   Failed to parse source_config string for {binding.get('name')}")
            
            # Look for constant/fixed value bindings
            if binding_type == 'constant' and isinstance(source_config, dict):
                var_name = binding.get('name', '')
                constant_value = source_config.get('value', '')
                
                if var_name and constant_value:
                    self.constant_bindings[var_name] = constant_value
                    logger.info(f"🔑 Loaded constant binding: {var_name} = {constant_value}")
                else:
                    logger.warning(f"   Skipped constant binding with missing name/value: name='{var_name}', value='{constant_value}'")
            else:
                logger.debug(f"   Skipped binding: {binding.get('name')} (type='{binding_type}', source_config type: {type(source_config)})")
        
        logger.info(f"🔑 Final constant bindings loaded: {dict(self.constant_bindings)}")
    
    def get_constant_value(self, variable_name: str, default: str = None) -> str:
        """Get constant value for a variable name"""
        value = self.constant_bindings.get(variable_name, default)
        logger.debug(f"🔑 get_constant_value('{variable_name}') -> '{value}' (available: {list(self.constant_bindings.keys())})")
        return value

    def _extract_prompt_credentials(self, prompt_text: str) -> Dict[str, str]:
        """Extract explicit credentials from prompt text."""
        if not prompt_text:
            return {}

        credentials: Dict[str, str] = {}
        patterns = {
            "username": [
                r"(?:username|user\s*name|email)\s*(?:is|=|:)?\s*['\"]?([^\s,'\"\n]+)",
            ],
            "password": [
                r"(?:password|pass(?:word)?)\s*(?:is|=|:)?\s*['\"]?([^\s,'\"\n]+)",
            ],
        }

        for field, field_patterns in patterns.items():
            for pattern in field_patterns:
                match = re.search(pattern, prompt_text, re.IGNORECASE)
                if match and match.group(1):
                    credentials[field] = match.group(1).strip()
                    break

        return credentials

    def _resolve_credential_value(self, field: str, prompt_text: str) -> Optional[str]:
        """Resolve credential value from prompt first, then data bindings (constant or variable)."""
        aliases = {
            "username": ["username", "userName", "user_name", "email", "login"],
            "password": ["password", "pass", "pwd"],
        }

        field_aliases = aliases.get(field, [field])

        # Check explicit constant bindings first — they are authoritative
        for alias in field_aliases:
            if alias in self.constant_bindings and self.constant_bindings.get(alias):
                return str(self.constant_bindings.get(alias)).strip()

        # Fall back to heuristic extraction from prompt text
        prompt_credentials = self._extract_prompt_credentials(prompt_text)

        if field in prompt_credentials and prompt_credentials[field]:
            return prompt_credentials[field]

        allowed_variables = getattr(self.variable_validator, "allowed_variables", set())
        normalized_aliases = {alias.lower().replace("_", "") for alias in field_aliases}
        for var_name in allowed_variables:
            normalized_var = str(var_name).lower().replace("_", "")
            if any(alias in normalized_var for alias in normalized_aliases):
                return f"${{{var_name}}}"

        return None

    def _get_credential_field_for_step(self, step: PlanStep) -> Optional[str]:
        """Classify a type step as username/password credential input when possible."""
        if step.action != "type":
            return None

        selector = str(step.args.get("selector", "") or "").lower()
        target = str(step.target or "").lower()
        description = str(step.description or "").lower()
        element_type = str(step.args.get("element_type", "") or "").lower()
        combined = f"{selector} {target} {description} {element_type}"

        if any(token in combined for token in ["password", "pwd", "pass"]):
            return "password"
        if any(token in combined for token in ["username", "user-name", "user_name", "email", "login", "userid"]):
            return "username"

        return None

    def _is_allowed_binding_placeholder(self, text_value: str) -> bool:
        """Check if value is a ${variable} placeholder mapped to allowed data binding variables."""
        if not text_value:
            return False

        match = re.match(r"^\$\{([^}]+)\}$", text_value.strip())
        if not match:
            return False

        variable_name = match.group(1)
        allowed_variables = getattr(self.variable_validator, "allowed_variables", set())
        return variable_name in allowed_variables

    def _apply_credential_source_guardrail(
        self,
        prompt_envelope: PromptEnvelope,
        ranked_elements: List[Any],
        steps: List[PlanStep],
    ) -> Tuple[List[PlanStep], List[str]]:
        """Ensure credential inputs come only from prompt text or data bindings."""
        if not steps:
            return steps, []

        prompt_text = getattr(prompt_envelope, "prompt", "") or ""
        allowed_username = self._resolve_credential_value("username", prompt_text)
        allowed_password = self._resolve_credential_value("password", prompt_text)

        sanitized_steps: List[PlanStep] = []
        removed_count = 0
        missing_credential_fields: List[str] = []

        for step in steps:
            field = self._get_credential_field_for_step(step)
            if not field:
                sanitized_steps.append(step)
                continue

            allowed_value = allowed_username if field == "username" else allowed_password
            current_text = str(step.args.get("text", "") or "").strip()
            is_allowed_placeholder = self._is_allowed_binding_placeholder(current_text)
            normalized_text = current_text.lower()

            if allowed_value:
                if current_text != allowed_value:
                    logger.warning(
                        f"🔒 Credential guardrail replaced {field} value '{current_text}' with approved source"
                    )
                    step.args["text"] = allowed_value
                sanitized_steps.append(step)
                continue

            if is_allowed_placeholder:
                sanitized_steps.append(step)
                continue

            if current_text:
                removed_count += 1
                if field not in missing_credential_fields:
                    missing_credential_fields.append(field)
                logger.warning(
                    f"🔒 Credential guardrail removed {field} step with unsupported value '{current_text}'"
                )
                continue

            sanitized_steps.append(step)

        if removed_count:
            logger.warning(
                f"🔒 Credential guardrail removed {removed_count} credential step(s); provide credentials via prompt or data bindings"
            )

        return sanitized_steps, missing_credential_fields

    def _enforce_rate_limit(self) -> None:
        """Enforce rate limiting between OpenAI API calls"""
        current_time = time.time()
        time_since_last_call = current_time - self.last_openai_call
        
        if time_since_last_call < self.min_call_interval:
            sleep_time = self.min_call_interval - time_since_last_call
            time.sleep(sleep_time)
        
        self.last_openai_call = time.time()

    def _extract_predefined_variables(self, prompt: str) -> Dict[str, Dict[str, str]]:
        """Extract predefined variables from prompt text"""
        variables = {}
        
        # Look for common variable patterns in the prompt text
        import re
        
        # Pattern 1: Variable definitions like "backpackPrice", "onesiePrice", "itemSubTotal"
        var_patterns = [
            r'(\w*[Pp]rice\w*)',  # Any variable containing "price"
            r'(\w*[Tt]otal\w*)',  # Any variable containing "total"  
            r'(\w*[Ss]ubtotal\w*)',  # Any variable containing "subtotal"
            r'(backpackPrice|onesiePrice|itemSubTotal)',  # Specific variables
        ]
        
        for pattern in var_patterns:
            matches = re.findall(pattern, prompt, re.IGNORECASE)
            for match in matches:
                var_name = match.strip()
                if var_name and len(var_name) > 2:  # Valid variable name
                    # Determine variable type based on name
                    if 'price' in var_name.lower():
                        variables[var_name] = {
                            'type': 'extract',
                            'category': 'price',
                            'description': f'Extract {var_name} from page elements'
                        }
                    elif 'total' in var_name.lower() or 'subtotal' in var_name.lower():
                        variables[var_name] = {
                            'type': 'calculate',
                            'category': 'total',
                            'description': f'Calculate {var_name} using formula'
                        }
                    else:
                        variables[var_name] = {
                            'type': 'extract',
                            'category': 'data',
                            'description': f'Extract {var_name} from page elements'
                        }
        
        # Pattern 2: Look for formula expressions
        formula_pattern = r'(\w+)\s*=\s*([^,\n]+)'
        formula_matches = re.findall(formula_pattern, prompt)
        for var_name, formula in formula_matches:
            if var_name.strip():
                variables[var_name.strip()] = {
                    'type': 'calculate',
                    'category': 'calculated',
                    'formula': formula.strip(),
                    'description': f'Calculate {var_name} using formula: {formula.strip()}'
                }
        
        return variables

    # =========================
    # API TEST DATA INTEGRATION
    # =========================
    
    async def load_api_test_data_for_prompt(self, prompt_id: str = None, project_id: str = None) -> list:
        """
        Load available API test data setups that can be used to create precondition data.
        
        This allows the AI to suggest API calls to create test data before UI tests.
        For example: Creating a booking via API before testing "change booking" flow.
        
        Returns list of available setups with their details.
        """
        try:
            from core.database import get_database_manager
            db = await get_database_manager()
            
            setups = []

            prompt_setup_table_exists = await db.fetchval(
                "SELECT to_regclass('api_tests.prompt_data_setups') IS NOT NULL"
            )
            
            if prompt_id and prompt_setup_table_exists:
                # Load setups linked to this specific prompt
                query = """
                    SELECT 
                        tds.id,
                        tds.name,
                        tds.description,
                        tds.execution_order,
                        dt.name as template_name,
                        dt.category,
                        dt.http_method,
                        dt.path,
                        dt.response_extractors,
                        ae.name as endpoint_name,
                        ae.base_url
                    FROM api_tests.prompt_data_setups pds
                    JOIN api_tests.test_data_setups tds ON pds.setup_id = tds.id
                    JOIN api_tests.data_templates dt ON tds.template_id = dt.id
                    JOIN api_tests.api_endpoints ae ON dt.endpoint_id = ae.id
                    WHERE pds.prompt_id = $1 AND pds.is_active = true AND tds.is_active = true
                    ORDER BY pds.execution_order ASC
                """
                result = await db.fetch(query, prompt_id)
                if result:
                    setups.extend([dict(r) for r in result])
            elif prompt_id and not prompt_setup_table_exists:
                logger.info("API setup link table api_tests.prompt_data_setups not found; skipping prompt-specific setup lookup")
            
            if project_id and not setups:
                # Fallback: Load all available setups for the project 
                query = """
                    SELECT 
                        tds.id,
                        tds.name,
                        tds.description,
                        tds.execution_order,
                        dt.name as template_name,
                        dt.category,
                        dt.http_method,
                        dt.path,
                        dt.response_extractors,
                        ae.name as endpoint_name,
                        ae.base_url
                    FROM api_tests.test_data_setups tds
                    JOIN api_tests.data_templates dt ON tds.template_id = dt.id
                    JOIN api_tests.api_endpoints ae ON dt.endpoint_id = ae.id
                    WHERE tds.project_id = $1 AND tds.is_active = true AND dt.is_active = true
                    ORDER BY dt.category, tds.name
                """
                result = await db.fetch(query, project_id)
                if result:
                    setups.extend([dict(r) for r in result])
            
            self.api_test_data_setups = setups
            logger.info(f"📦 Loaded {len(setups)} API test data setups")
            return setups
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to load API test data setups: {e}")
            self.api_test_data_setups = []
            return []

    # =========================
    # ENTERPRISE API METHODS
    # =========================
    
    async def plan_test_steps(self, prompt_envelope: PromptEnvelope) -> PlanResponse:
        """
        Enterprise /v1/plan endpoint implementation.
        
        Example Input:
        {
          "prompt": "Login as a loyalty member and book a one-way flight to DAL next Friday.",
          "tenantId": "acme-co",
          "catalogRefs": [{"catalogId": "actions.v3", "version": "3.4.2"}],
          "pageSlice": {"sliceStrategy": "topK", "k": 100, "elements": [...]}
        }
        
        Example Output:
        {
          "steps": [
            {"action": "type", "target": "el_1132", "args": {"text": "{credential.username}"}},
            {"action": "click", "target": "el_1140"}
          ],
          "clarifications": [],
          "used": {"elementsConsidered": 38},
          "costSummary": {"inputTokens": 2100, "outputTokens": 250}
        }
        """
        start_time = time.time()
        logger.info(f"🚀 Starting plan generation for prompt: '{prompt_envelope.prompt[:100]}...'")
        logger.debug(f"📊 Request details - Tenant: {prompt_envelope.tenant_id}, Elements: {len(prompt_envelope.page_slice.elements) if prompt_envelope.page_slice else 0}")
        
        # DATABASE PROVIDER: Check if tenant has a database-configured AI provider
        # NOTE: tenant_id is OPTIONAL. If not provided, system uses environment variables (OPENAI_API_KEY, etc.)
        # This ensures backward compatibility with existing deployments.
        tenant_id = getattr(prompt_envelope, 'tenant_id', None)
        project_id = getattr(prompt_envelope, 'project_id', None)
        
        if tenant_id:
            logger.info(f"🔍 Checking database for active AI provider (tenant: {tenant_id})")
            db_provider_config = await self._load_provider_config_from_db(tenant_id, project_id)
            
            if db_provider_config:
                logger.info(f"✅ Using database-configured provider: {db_provider_config['provider']} ({db_provider_config.get('source')})")

                config_options = db_provider_config.get('config_options') or {}
                if isinstance(config_options, str):
                    try:
                        config_options = json.loads(config_options)
                    except Exception:
                        logger.warning("Invalid config_options for provider %s; using defaults", db_provider_config['provider'])
                        config_options = {}
                
                # Temporarily override config with database provider
                provider_name = db_provider_config['provider']
                self.config["current_provider"] = provider_name
                runtime_provider_config = {
                    "apiKey": db_provider_config['api_key'],
                    "enabled": True,
                    "model": db_provider_config['model'],
                    "timeout": int(config_options.get('timeout_ms', 20000)),
                    "maxRetries": int(config_options.get('max_retries', 1)),
                    "temperature": db_provider_config['temperature'],
                    "maxTokens": db_provider_config['max_tokens'],
                }

                if provider_name == "ollama":
                    runtime_provider_config["timeout"] = int(
                        config_options.get("timeout_ms", os.getenv("OLLAMA_TIMEOUT_MS", "180000"))
                    )
                    runtime_provider_config["maxRetries"] = int(
                        config_options.get("max_retries", os.getenv("OLLAMA_MAX_RETRIES", "3"))
                    )
                    runtime_provider_config["maxTokens"] = int(
                        min(
                            int(db_provider_config.get("max_tokens") or os.getenv("OLLAMA_MAX_TOKENS", "1200")),
                            int(os.getenv("OLLAMA_MAX_TOKENS", "1200"))
                        )
                    )
                    runtime_provider_config["baseUrl"] = (
                        db_provider_config.get("endpoint_url")
                        or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
                    )
                    # Guard against stale model values from old rows.
                    if not runtime_provider_config.get("model"):
                        runtime_provider_config["model"] = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

                self.config[provider_name] = runtime_provider_config
                
                # Re-initialize client with new config
                self._initialize_openai()
                
                logger.debug(f"📝 Provider config: {db_provider_config['provider']} / {db_provider_config['model']}")
            else:
                logger.info(f"ℹ️ No database provider configured for tenant {tenant_id}, using environment variables")
        else:
            logger.info("ℹ️ No tenant_id provided, using environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)")
        
        # Load API test data setups for AI context
        prompt_id = getattr(prompt_envelope, 'prompt_id', None)
        await self.load_api_test_data_for_prompt(prompt_id, project_id)
        
        # Load element repository for name mapping (always, regardless of bindings)
        try:
            from core.database import get_database_manager
            db = await get_database_manager()

            has_element_key = await db.fetchval(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_schema = 'repo'
                      AND table_name = 'elements'
                      AND column_name = 'element_key'
                )
                """
            )

            if has_element_key:
                elements_query = """
                    SELECT element_key, primary_selector
                    FROM repo.elements
                    ORDER BY created_at DESC
                """
            else:
                elements_query = """
                    SELECT name AS element_key, primary_selector
                    FROM repo.elements
                    ORDER BY created_at DESC
                """

            repository_elements = await db.fetch(elements_query)
            logger.info(f"📦 Loaded {len(repository_elements) if repository_elements else 0} elements from repository for name mapping")
            
            # Create selector -> name mapping
            element_selectors_reverse = {}
            for element in repository_elements:
                try:
                    # Access as dict
                    element_key = element.get('element_key')
                    primary_selector = element.get('primary_selector')
                    
                    if not element_key or not primary_selector:
                        continue
                    
                    if isinstance(primary_selector, dict):
                        css_selector = primary_selector.get('css_selector', '') or primary_selector.get('css', '')
                        if css_selector:
                            element_selectors_reverse[css_selector.lower().strip()] = element_key
                    elif isinstance(primary_selector, str):
                        # Try to parse as JSON if it's a string
                        import json
                        try:
                            selector_data = json.loads(primary_selector)
                            if isinstance(selector_data, dict):
                                css_selector = selector_data.get('css_selector', '') or selector_data.get('css', '')
                                if css_selector:
                                    element_selectors_reverse[css_selector.lower().strip()] = element_key
                        except (json.JSONDecodeError, TypeError):
                            pass
                except Exception as elem_err:
                    logger.debug(f"Skipping element due to error: {elem_err}")
                    continue
            
            # Store for use in response mapping
            self.element_selectors_reverse = element_selectors_reverse
            logger.info(f"🗺️  Created name mapping for {len(element_selectors_reverse)} elements")
            
        except Exception as e:
            logger.warning(f"⚠️  Failed to load element repository for name mapping: {e}")
            import traceback
            logger.debug(f"Traceback: {traceback.format_exc()}")
            self.element_selectors_reverse = {}
        
        # Initialize element_selectors dict (from repository, keyed by element name)
        element_selectors = {v: k for k, v in self.element_selectors_reverse.items()} if self.element_selectors_reverse else {}

        try:
            # Load existing bindings for this prompt if available
            existing_bindings = None
            prompt_id = getattr(prompt_envelope, 'prompt_id', None)
            
            if prompt_id:
                try:
                    from core.database import get_database_manager
                    db = await get_database_manager()
                    
                    # Load existing bindings from datahub.data_bindings table for this specific prompt
                    bindings_query = """
                        SELECT name, binding_type, source_config, schema_definition 
                        FROM datahub.data_bindings 
                        WHERE is_active = true
                        ORDER BY created_at DESC
                    """
                    existing_bindings = await db.fetch(bindings_query)
                    
                    # Debug: Log what bindings we retrieved
                    logger.info(f"🔍 Retrieved {len(existing_bindings) if existing_bindings else 0} bindings from database")
                    for i, binding in enumerate(existing_bindings or []):
                        logger.info(f"   Binding {i+1}: name='{binding.get('name')}', type='{binding.get('binding_type')}', source_config keys: {list(binding.get('source_config', {}).keys()) if isinstance(binding.get('source_config'), dict) else 'string' if binding.get('source_config') else 'none'}")
                    
                    # If no bindings found, that's OK - we'll generate new ones
                    if not existing_bindings:
                        existing_bindings = []
                    
                    # Debug: Log first binding structure
                    if existing_bindings and len(existing_bindings) > 0:
                        first_binding = existing_bindings[0]
                    
                    # Cache policy preference for synchronous selector methods
                    try:
                        policy_query = """
                        SELECT context FROM policy.policy_decisions 
                        WHERE context->>'config_type' = 'dashboard_config'
                        ORDER BY created_at DESC
                        LIMIT 1
                        """
                        policy_result = await db.execute_one(policy_query)
                        
                        prefer_css = True  # Default
                        if policy_result and policy_result.get("context"):
                            import json
                            config_data = json.loads(policy_result["context"])
                            locator_healing = config_data.get("configurations", {}).get("locatorHealing", {})
                            prefer_css = locator_healing.get("preferCssOverXpath", True)
                        
                        # Cache the preference for sync methods
                        self._cache_policy_preference(prefer_css)
                        
                    except Exception as e:
                        logger.warning(f"Failed to load policy preference: {e}")
                        self._cache_policy_preference(True)
                    
                except Exception as e:
                    logger.warning(f"Failed to load bindings: {e}")
                    existing_bindings = None
                
                # Process bindings if they were loaded successfully
                if existing_bindings:
                    logger.info(f"🔑 Processing {len(existing_bindings)} bindings for constant loading...")
                    
                    # Load allowed variables into the validator
                    self.variable_validator.load_allowed_variables(existing_bindings)
                    
                    # Load constant bindings for login credentials, etc.
                    logger.info(f"🔑 About to call load_constant_bindings...")
                    self.load_constant_bindings(existing_bindings)
                    logger.info(f"🔑 Finished loading constant bindings")
                    
                    # Analyze bindings to understand relationships
                    binding_names = []
                    price_bindings = []
                    total_bindings = []
                    
                    for binding in existing_bindings:
                        rule_name = binding.get('rule_name', '')
                        target = binding.get('target', {})
                        
                        # Parse target JSON if it's a string
                        if isinstance(target, str):
                            try:
                                target = json.loads(target)
                            except json.JSONDecodeError:
                                target = {}
                        
                        # Extract variable name from target
                        if isinstance(target, dict):
                            var_name = target.get('variable_name') or target.get('name') or rule_name
                        else:
                            var_name = rule_name
                        
                        binding_names.append(var_name)
                        
                        # Always add to extraction bindings - we extract ALL defined variables
                        price_bindings.append(binding)
                        # Also classify by type for additional context
                        if 'total' in var_name.lower() or 'sum' in var_name.lower():
                            total_bindings.append(binding)
                    
                    # Build intelligent context based on variable analysis
                    binding_context = f"\n\nIMPORTANT: This test has predefined data bindings: {', '.join(binding_names)}."
                    
                    # Add explicit list of allowed variables
                    if self.variable_validator.allowed_variables:
                        allowed_list = sorted(self.variable_validator.allowed_variables)
                        binding_context += f"\n\nALLOWED VARIABLES (use ONLY these exact names):"
                        for var_name in allowed_list:
                            binding_context += f"\n- {var_name}"
                        binding_context += f"\n\nCRITICAL: Do NOT invent variable names. Use ONLY the {len(allowed_list)} variables listed above."
                        binding_context += f"\nAny step using unlisted variable names will be rejected."
                    
                    if price_bindings:
                        price_names = []
                        for binding in price_bindings:
                            target = binding.get('target', {})
                            # Parse target JSON if it's a string
                            if isinstance(target, str):
                                try:
                                    target = json.loads(target)
                                except json.JSONDecodeError:
                                    target = {}
                            var_name = target.get('variable_name') or target.get('name') or binding.get('rule_name', '')
                            price_names.append(var_name)
                        
                        total_names = []
                        for binding in total_bindings:
                            target = binding.get('target', {})
                            # Parse target JSON if it's a string
                            if isinstance(target, str):
                                try:
                                    target = json.loads(target)
                                except json.JSONDecodeError:
                                    target = {}
                            var_name = target.get('variable_name') or target.get('name') or binding.get('rule_name', '')
                            total_names.append(var_name)
                        
                        binding_context += f"\n\nDATA EXTRACTION LOGIC:"
                        binding_context += f"\n- Extract individual values: {', '.join(price_names)}"
                        if total_bindings:
                            binding_context += f"\n- Extract displayed values for comparison: {', '.join(total_names)}"
                        else:
                            binding_context += f"\n- Calculate computed values as needed"
                        binding_context += f"\n- When testing websites with dynamic content, extract actual displayed values for verification"
                        binding_context += f"\n- Use calculated values when testing mathematical relationships between extracted data"
                        
                        binding_context += f"\n\nSTEP GENERATION RULES:"
                        binding_context += f"\n- For individual data extraction: extract_data action with variable assignment"
                        binding_context += f"\n- Format: action='extract_data', locator='[appropriate selector]', data='[variable_name]'"
                        binding_context += f"\n- Use these specific variable names: {', '.join(price_names)}"
                        binding_context += f"\n- CRITICAL: Use the EXACT variable names provided: {', '.join(price_names)}"
                        binding_context += f"\n- For data that requires calculation: use calculate action before assertions"
                        binding_context += f"\n- IMPORTANT: Use different variable names for calculated vs displayed values"
                        binding_context += f"\n- When asserting calculated values, use the calculated variable: ${{{total_names[0] if total_names else 'calculatedValue'}}}"
                        binding_context += f"\n- AVOID: extract_data followed immediately by assert_text on same element"
                        binding_context += f"\n- CORRECT: calculate → assert_text using calculated variable"
                        binding_context += f"\n- INCORRECT: extract_data → assert_text (creates redundant extraction)"
                        binding_context += f"\n- Example: verify text containing calculated result, not page-extracted duplicates"
                        
                        # Add repository selector information
                        if element_selectors:
                            binding_context += f"\n\nAVAILABLE SELECTORS FROM ELEMENT REPOSITORY:"
                            for element_key, selector in element_selectors.items():
                                binding_context += f"\n- {element_key}: {selector}"
                            binding_context += f"\n- Use these repository selectors for extraction steps instead of guessing selectors"
                            binding_context += f"\n- For price extraction, use: {element_selectors.get('inventoryItemPrice', '.inventory_item_price')}"
                            if 'subtotalLabel' in element_selectors:
                                binding_context += f"\n- For total verification, use: {element_selectors['subtotalLabel']}"
                        
                        binding_context += f"\n- Add calculation steps to compute derived values: action='calculate', data='[result_variable]', locator='[formula]'"
                        binding_context += f"\n- Formula format: use variable names directly or with ${{}}, e.g., '{' + '.join(price_names)} = var1 + var2'"
                        binding_context += f"\n- Calculate {total_names[0] if total_names else 'DEFINED_TOTAL_VARIABLE'} using formula: {' + '.join([f'${{{name}}}' for name in price_names])}"
                        binding_context += f"\n- EXACT calculation example: {total_names[0] if total_names else 'DEFINED_TOTAL_VARIABLE'} = {' + '.join(price_names)}"
                        binding_context += f"\n- When asserting calculated values, use calculated variable: ${{{total_names[0] if total_names else 'DEFINED_TOTAL_VARIABLE'}}}"
                        binding_context += f"\n- Example: verify text containing '${{{total_names[0] if total_names else 'DEFINED_TOTAL_VARIABLE'}}}' instead of hardcoded values"
                    
                    elif binding_names:
                        binding_context += f"\n\nDATA BINDING INSTRUCTIONS:"
                        binding_context += f"\n- When generating steps that verify or assert dynamic values, use variable syntax like ${{variableName}} instead of hardcoded values"
                        binding_context += f"\n- Available variables: {', '.join(binding_names)}"
                        binding_context += f"\n- Extract data first, then use variables in assertions"
                        binding_context += f"\n- Example: use '${{total}}' instead of specific amounts like '$58.29'"
                        
                    binding_context += f"\n\nGENERAL RULES:"
                    binding_context += f"\n- Generate extraction steps before calculation steps to populate variables from actual page content"
                    binding_context += f"\n- Use extract_data action to capture dynamic values like prices, totals, counts, or any changing data"
                    binding_context += f"\n- Use calculate action to perform mathematical operations on extracted variables"
                    binding_context += f"\n- Calculate step format: action='calculate', data='result_variable_name', text='formula_expression'"
                    binding_context += f"\n- Formulas can use +, -, *, / operators and reference variables by name or ${{name}} syntax"
                    binding_context += f"\n- Always use variable syntax in verification steps when dynamic data is involved"
                    # Modify the prompt to include intelligent binding context
                    original_prompt = prompt_envelope.prompt
                    prompt_envelope.prompt = original_prompt + binding_context
                        
                
                # Check budget before processing
                estimated_tokens, estimated_cost = self.cost_management.estimate_cost(
                    prompt_envelope, 
                    self.config["openai"]["model"]
                )
            
            can_proceed, budget_info = self.cost_management.check_budget(
                prompt_envelope.tenant_id, 
                estimated_tokens
            )
            
            if not can_proceed:
                return self._create_budget_exceeded_response(budget_info, start_time)
            
            # Use smart page context system if not provided
            if not prompt_envelope.page_context and prompt_envelope.page_slice:# Phase 1: Analyze prompt intent
                intent_analysis = await self.analyze_prompt_intent(
                    prompt_envelope.prompt, 
                    prompt_envelope.page_slice.elements
                )
                
                # Phase 2: Fetch smart page context
                smart_context = await self.fetch_smart_page_context(
                    intent_analysis, 
                    prompt_envelope.prompt
                )
                
                if smart_context:
                    # Convert smart context to PageContext format
                    from schemas.enterprise import PageContext
                    prompt_envelope.page_context = PageContext(
                        page_type=smart_context.get('page_type', ''),
                        page_title=smart_context.get('page_title', ''),
                        page_description=smart_context.get('page_description', ''),
                        primary_actions=smart_context.get('primary_actions', []),
                        testing_focus=smart_context.get('testing_focus', ''),
                        user_notes=smart_context.get('user_notes', ''),
                        domain_name=smart_context.get('domain_name', ''),
                        screenshot_url=smart_context.get('screenshot_url')
                    )
                else:
                    # Fallback to auto-detection# Use async method to get policy-based selectors
                    element_selectors = []
                    for el in prompt_envelope.page_slice.elements:
                        selector = await self._get_policy_based_element_selector(el)
                        element_selectors.append(selector)
                    
                    prompt_envelope.page_context = page_context_service.detect_page_context(
                        page_url=prompt_envelope.page_url,
                        element_selectors=element_selectors
                    )
            if prompt_envelope.page_slice and prompt_envelope.page_slice.elements:
                
                # Analyze element types for debugging
                element_types = {}
                login_elements = []
                inventory_elements = []
                form_elements = []
                interactive_elements = []
                navigation_elements = []
                
                for i, el in enumerate(prompt_envelope.page_slice.elements[:10]):  # Log first 10 elements
                    tag = self._get_element_tag(el)
                    text = self._get_element_text(el)[:50] + "..." if len(self._get_element_text(el)) > 50 else self._get_element_text(el)
                    selector = self._get_element_selector(el)
                    
                    # Categorize elements
                    element_types[tag] = element_types.get(tag, 0) + 1
                    if 'password' in selector.lower() or 'user-name' in selector.lower() or 'login' in selector.lower():
                        login_elements.append(selector)
                    if 'remove-' in selector.lower() or 'inventory' in selector.lower() or 'item' in selector.lower():
                        inventory_elements.append(selector)
                
                if len(prompt_envelope.page_slice.elements) > 10:
                    logger.debug(f"📝 Showing first 10 elements out of {len(prompt_envelope.page_slice.elements)} total")
                
                # Log page state analysis
                logger.debug(f"🏷️ Element types found: {element_types}")
                if login_elements:
                    logger.debug(f"🔐 Login elements detected: {login_elements}")
                if inventory_elements:
                    logger.debug(f"📦 Inventory elements detected: {inventory_elements}")
                    
            # Rank elements if provided
            ranked_elements = []
            cache_hits = 0
            
            if prompt_envelope.page_slice and prompt_envelope.page_slice.elements:
                if len(prompt_envelope.page_slice.elements) > 50:
                    # Re-rank for optimization
                    ranking_config = ElementRankingConfig(
                        strategy=ElementRankingStrategy.HYBRID,
                        k=min(50, len(prompt_envelope.page_slice.elements)),
                        interactivity_weight=0.3,
                        visibility_weight=0.2,
                        text_content_weight=0.2,
                        selector_quality_weight=0.3
                    )
                    
                    element_dicts = self._convert_page_elements_to_dicts(prompt_envelope.page_slice.elements)
                    page_slice = self.element_ranking.rank_elements(
                        element_dicts,
                        ranking_config,
                        prompt_envelope.prompt
                    )
                    ranked_elements = page_slice.elements
                    cache_hits += 1 if page_slice.cache_hit else 0
                else:
                    ranked_elements = prompt_envelope.page_slice.elements
            
            # Log ranked/filtered elements
            if ranked_elements:
                logger.debug(f"🎯 Using {len(ranked_elements)} ranked/filtered elements for plan generation")
                for i, el in enumerate(ranked_elements[:10]):  # Log first 10 ranked elements
                    tag = self._get_element_tag(el)
                    text = self._get_element_text(el)[:50] + "..." if len(self._get_element_text(el)) > 50 else self._get_element_text(el)
                    selector = self._get_element_selector(el)
                    logger.debug(f"  🔗 [{i+1}] {tag}: '{text}' -> {selector}")
                
                if len(ranked_elements) > 10:
                    logger.debug(f"📝 Showing first 10 ranked elements out of {len(ranked_elements)} total")

            # Initialize variables
            steps = []
            actual_tokens = {"input": 0, "output": 0}
            method = "unknown"
            model = "unknown"
            clarifications: List[Clarification] = []

            # Generate test steps using AI when available, fallback to heuristic
            logger.info(f" Checking AI availability - Client: {bool(self.client)}, Enabled: {self.config['openai']['enabled']}")
            
            if self.client and self.config["openai"]["enabled"]:
                logger.info("✅ Using AI-powered plan generation")
                try:
                    logger.info("🚀 CALLING AI GENERATION - This should generate steps from AI")
                    steps, actual_tokens = await self._generate_ai_plan(prompt_envelope, ranked_elements)
                    method = "ai-powered"
                    model = self.config["openai"]["model"]
                    logger.info(f"🎯 AI plan generated - Steps: {len(steps)}, Tokens: {actual_tokens}")
                    logger.info("🔍 AI-GENERATED STEPS:")
                    for i, step in enumerate(steps, 1):
                        logger.info(f"  AI Step {i}: {step.action} -> {step.target} ({step.args.get('selector', 'no-selector')})")
                except Exception as ai_error:
                    logger.error(f"❌ AI plan generation failed: {str(ai_error)}")
                    logger.info("🔄 Falling back to heuristic plan generation")
                    steps, actual_tokens = await self._generate_heuristic_plan(prompt_envelope, ranked_elements)
                    method = "heuristic-fallback-after-ai-error"
                    model = "rule-based"
                    cache_hits += 1
                    logger.info("🔍 HEURISTIC FALLBACK STEPS:")
                    for i, step in enumerate(steps, 1):
                        logger.info(f"  Heuristic Step {i}: {step.action} -> {step.target} ({step.args.get('selector', 'no-selector')})")
            else:
                logger.info("🛠️  Using heuristic plan generation (AI not available)")
                steps, actual_tokens = await self._generate_heuristic_plan(prompt_envelope, ranked_elements)
                method = "heuristic-fallback"
                model = "rule-based"
                cache_hits += 1  # Heuristic is essentially cached
                logger.info("🔍 PURE HEURISTIC STEPS:")
                for i, step in enumerate(steps, 1):
                    logger.info(f"  Pure Heuristic Step {i}: {step.action} -> {step.target} ({step.args.get('selector', 'no-selector')})")

            # Guardrail: credentials must come only from prompt or data bindings
            steps, missing_credential_fields = self._apply_credential_source_guardrail(prompt_envelope, ranked_elements, steps)
            if missing_credential_fields:
                field_list = ", ".join(missing_credential_fields)
                clarifications.append(
                    Clarification(
                        type="missing_credentials",
                        message=f"Login steps require credential values for: {field_list}. Add credentials via data binding variables or include them in the prompt.",
                        suggestions=[
                            "Add credential variables in Data Bindings (e.g., username/password constants or variables)",
                            "Update your prompt to explicitly include the login credentials to use"
                        ],
                        required=True
                    )
                )
            
            # POLICY ENGINE: Evaluate test plan against configured policies
            logger.debug(f"🎯 Evaluating {len(steps)} generated steps with policy engine")
            try:
                from services.policy_engine_enhanced import create_policy_engine
                
                # Get project and environment IDs from the request
                project_id = getattr(prompt_envelope, 'project_id', None)
                environment_id = getattr(prompt_envelope, 'environment_id', None)
                
                if project_id and environment_id:
                    logger.info(f"🎯 Applying policy engine evaluation for project {project_id}")
                    
                    # Initialize policy engine
                    db_manager = await get_database_manager()
                    policy_engine = await create_policy_engine(db_manager, project_id, environment_id)
                    
                    # Evaluate test plan against policies
                    test_plan_dict = {
                        "steps": [
                            {
                                "step_index": i,
                                "action": step.action,
                                "target": step.target,
                                "element": {
                                    "confidence": int(step.confidence * 100)  # Convert to 0-100 scale
                                },
                                "args": step.args
                            }
                            for i, step in enumerate(steps)
                        ]
                    }
                    
                    evaluation = await policy_engine.evaluate_test_plan(test_plan_dict)
                    
                    # Handle blocked steps
                    if not evaluation["approved"]:
                        logger.warning(f"⚠️ Policy engine blocked {len(evaluation['blocked_steps'])} steps")
                        
                        # Filter out blocked steps
                        blocked_indices = {s["step_index"] for s in evaluation["blocked_steps"]}
                        steps = [step for i, step in enumerate(steps) if i not in blocked_indices]
                        
                        # Add warnings to clarifications
                        for blocked in evaluation["blocked_steps"]:
                            clarifications.append(
                                Clarification(
                                    type="policy_blocked",
                                    message=f"Step {blocked['step_index']} ({blocked['action']}) was blocked by policy: {blocked['reason']}",
                                    suggestions=["Review policy settings or modify test approach"],
                                    required=False
                                )
                            )
                    
                    # Handle flagged steps (low confidence)
                    if evaluation["flagged_steps"]:
                        logger.info(f"🔍 Policy engine flagged {len(evaluation['flagged_steps'])} steps for review")
                        
                        for flagged in evaluation["flagged_steps"]:
                            step_index = flagged["step_index"]
                            if step_index < len(steps):
                                # Add clarification for flagged step
                                clarifications.append(
                                    Clarification(
                                        type="low_confidence",
                                        message=f"Step {step_index} has low confidence ({flagged['confidence']}%) and may require review",
                                        suggestions=["Verify element selector before execution"],
                                        required=False
                                    )
                                )
                    
                    logger.info(f"✅ Policy evaluation complete - {len(steps)} steps approved, {len(evaluation['blocked_steps'])} blocked, {len(evaluation['flagged_steps'])} flagged")
                    
                else:
                    logger.debug("ℹ️ No project/environment ID provided, skipping policy evaluation")
                    
            except ImportError:
                logger.debug("ℹ️ Policy engine not available, skipping policy evaluation")
            except Exception as e:
                logger.error(f"❌ Policy engine evaluation failed: {e}")
                # Don't fail the entire request, just log the error
            
            # SAFETY POLICY: Validate generated steps for destructive operations (if available)
            logger.debug(f"🛡️  Validating {len(steps)} generated steps for safety policy")
            try:
                from core.safety_policy import safety_policy
                validated_steps = []
                for step in steps:
                    try:
                        await safety_policy.validate_step_action(
                            None,  # No current_user available in this context
                            step.action, 
                            step.args
                        )
                        validated_steps.append(step)
                    except Exception as e:
                        logger.warning(f"⚠️  Step rejected by safety policy: {step.action} - {str(e)}")
                        # Skip this step instead of failing the entire request
                        continue
                steps = validated_steps
                logger.info(f"✅ Safety validation complete - {len(steps)} steps approved")
            except ImportError:
                logger.debug("ℹ️  Safety policy not available, skipping validation")
                # Safety policy not available, skip validation
                pass
            
            # Track actual usage
            cost_summary = self.cost_management.track_usage(
                prompt_envelope.tenant_id,
                actual_tokens.get("input", 0),
                actual_tokens.get("output", 0),
                model,
                int((time.time() - start_time) * 1000),
                cache_hits
            )
            
            cost_summary.elements_processed = len(ranked_elements)
            
            # Detailed step logging before returning
            logger.info(f"📋 Final step details before response:")
            for i, step in enumerate(steps, 1):
                logger.info(f"  Step {i}: {step.action} -> {step.target}")
                logger.info(f"    Selector: {step.args.get('selector', 'N/A')}")
                logger.info(f"    Description: {step.description}")
                logger.info(f"    Confidence: {step.confidence}")
                if step.args.get('text'):
                    logger.info(f"    Text: '{step.args.get('text')}'")
            
            # Create successful response
            response = PlanResponse(
                steps=steps,
                clarifications=clarifications,
                used={
                    "elementsConsidered": len(ranked_elements),
                    "catalogsLoaded": len(prompt_envelope.catalog_refs),
                    "cacheHits": cache_hits
                },
                cost_summary=cost_summary,
                processing_time_ms=int((time.time() - start_time) * 1000),
                method=method,
                model=model,
                cache_used=cache_hits > 0
            )

            # Replace selectors with friendly element names in response
            # Keep original selector in args for execution, but show name in target for display
            if hasattr(self, 'element_selectors_reverse') and self.element_selectors_reverse:
                logger.info(f"🏷️  Mapping selectors to element names ({len(self.element_selectors_reverse)} names available)")
                for step in response.steps:
                    original_target = step.target
                    if step.target:
                        # Normalize and lookup
                        target_normalized = step.target.lower().strip()
                        element_name = None
                        
                        # Try direct match first
                        if target_normalized in self.element_selectors_reverse:
                            element_name = self.element_selectors_reverse[target_normalized]
                        # Try removing :nth-of-type(1) at end
                        elif target_normalized.endswith(':nth-of-type(1)'):
                            target_alt = target_normalized[:-15]  # Remove :nth-of-type(1)
                            if target_alt in self.element_selectors_reverse:
                                element_name = self.element_selectors_reverse[target_alt]
                        # Try removing leading "a " tag prefix
                        elif target_normalized.startswith('a '):
                            target_alt = target_normalized[2:]  # Remove "a "
                            if target_alt in self.element_selectors_reverse:
                                element_name = self.element_selectors_reverse[target_alt]
                        
                        if element_name:
                            logger.debug(f"   ✓ Mapped '{original_target}' → '{element_name}'")
                            # Keep original selector in args for execution
                            step.args['_original_selector'] = original_target
                            # Show friendly name in target for display
                            step.target = element_name
                            # Update description
                            if step.description and original_target in step.description:
                                step.description = step.description.replace(original_target, f"'{element_name}'")

            # Log final response steps for debugging
            logger.info(f"🎉 Plan generation successful - Method: {method}, Steps: {len(response.steps)}, Time: {response.processing_time_ms}ms")
            for i, step in enumerate(response.steps):
                logger.debug(f"  Step {i+1}: {step.action} -> {step.target}")
                cached_pref = getattr(self, '_cached_policy_preference', 'unknown')
                if step.target and '#' in step.target:
                    pass
                elif step.target and '//*[@' in step.target:
                    pass
            return response

        except Exception as e:
            logger.error(f"💥 Plan generation failed with exception: {str(e)}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return self._create_error_response(str(e), start_time)
    
    async def get_action_catalog(
        self,
        catalog_id: str,
        version: str,
        if_none_match: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Tuple[Optional[ActionCatalog], bool, Optional[str]]:
        """
        Get action catalog with ETag caching support.
        Returns (catalog, is_304_not_modified, etag)
        """
        return self.cache_service.get_action_catalog(
            catalog_id, version, if_none_match, tenant_id
        )
    
    def rank_page_elements(
        self,
        elements: List[Dict[str, Any]],
        strategy: ElementRankingStrategy = ElementRankingStrategy.HYBRID,
        k: int = 50,
        prompt_context: Optional[str] = None
    ) -> PageSlice:
        """Rank and select top-K page elements"""
        config = ElementRankingConfig(
            strategy=strategy, 
            k=k,
            interactivity_weight=0.3,
            visibility_weight=0.2,
            text_content_weight=0.2,
            selector_quality_weight=0.3
        )
        return self.element_ranking.rank_elements(elements, config, prompt_context)

    # =========================
    # PLAN GENERATION METHODS
    # =========================
    
    async def _generate_ai_plan(
        self,
        prompt_envelope: PromptEnvelope,
        ranked_elements: List[Any]
    ) -> Tuple[List[PlanStep], Dict[str, int]]:
        """Generate plan using AI with intelligent element analysis"""
        
        logger.info(f" Starting AI plan generation with {len(ranked_elements)} elements")
        
        # Build optimized prompts with full context
        system_prompt = self._build_enhanced_system_prompt(test_type=getattr(prompt_envelope, 'test_type', 'web'))
        user_prompt = self._build_enhanced_user_prompt(prompt_envelope, ranked_elements)
        
        logger.debug(f"📝 System prompt length: {len(system_prompt)} chars")
        logger.debug(f"📝 User prompt length: {len(user_prompt)} chars")
        
        # Estimate input tokens
        input_tokens = len(system_prompt + user_prompt) // 4
        logger.info(f"💰 Estimated input tokens: {input_tokens}")
        
        try:
            current_provider = self.config.get("current_provider", "openai")
            current_model = self._get_current_model()
            provider_config = self._get_current_provider_config()
            
            logger.info(f"🔗 Calling {current_provider.upper()} API - Model: {current_model}")

            effective_max_tokens = min(provider_config.get("maxTokens", 4000), prompt_envelope.max_steps * 150)
            effective_timeout_ms = provider_config.get("timeout", prompt_envelope.timeout_ms)

            if current_provider == "ollama":
                # Ollama inference is direct HTTP from unified-api to Ollama; runner WS is not in this path.
                logger.info("🧭 Ollama inference path: direct HTTP (unified-api -> Ollama), not via runner websocket")
                ollama_cap = int(os.getenv("OLLAMA_MAX_TOKENS", "1200"))
                effective_max_tokens = min(effective_max_tokens, ollama_cap)
                effective_timeout_ms = max(int(effective_timeout_ms or 0), int(os.getenv("OLLAMA_TIMEOUT_MS", "180000")))
            
            response = await self._chat_json(
                model=current_model,
                system=system_prompt,
                user=user_prompt,
                max_tokens=effective_max_tokens,
                temperature=provider_config.get("temperature", 0.1),
                retries=provider_config.get("maxRetries", 2),
                timeout_ms=effective_timeout_ms
            )
            
            logger.info(f"✅ {current_provider.upper()} API response received, length: {len(response)} chars")
            logger.debug(f"📝 Raw AI response: {response[:200]}...")
            
            # Try to parse JSON with better error handling
            try:
                parsed = json.loads(response)
                logger.info("✅ JSON parsing successful")
            except json.JSONDecodeError as e:
                logger.warning(f"⚠️  JSON parsing failed: {str(e)}, attempting reconstruction")
                # Try to extract and reconstruct JSON from response
                try:
                    # Look for JSON array in the response (new format)
                    import re
                    json_match = re.search(r'\[.*', response, re.DOTALL)
                    if json_match:
                        json_part = json_match.group()
                        
                        # Try to find the last complete step object
                        step_pattern = r'  }\s*(?:,\s*{|\s*])'
                        matches = list(re.finditer(step_pattern, json_part))
                        
                        if matches:
                            # Take up to the last complete step
                            last_match = matches[-1]
                            reconstructed = json_part[:last_match.start() + 3]  # Include the }
                            
                            # Close the array
                            reconstructed += '\n]'
                            parsed = json.loads(reconstructed)
                            logger.info("✅ JSON reconstruction successful")
                        else:
                            # Fallback: just try to find a complete JSON array
                            json_match = re.search(r'\[.*\]', response, re.DOTALL)
                            if json_match:
                                parsed = json.loads(json_match.group())
                                logger.info("✅ JSON array fallback successful")
                            else:
                                # Try legacy object format as final fallback
                                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                                if json_match:
                                    parsed = json.loads(json_match.group())
                                    logger.info("✅ JSON object fallback successful")
                                else:
                                    logger.error("❌ All JSON reconstruction attempts failed")
                                    raise e
                    else:
                        # Try legacy object format as fallback
                        json_match = re.search(r'\{.*\}', response, re.DOTALL)
                        if json_match:
                            parsed = json.loads(json_match.group())
                            logger.info("✅ JSON object fallback successful")
                        else:
                            logger.error("❌ JSON reconstruction completely failed")
                            raise e
                except Exception as reconstruction_error:
                    logger.error(f"❌ JSON reconstruction error: {reconstruction_error}")
                    raise e
            
            # Handle both array format (new) and object format (legacy)
            if isinstance(parsed, list):
                raw_steps = parsed  # Direct array format
            else:
                # Try top-level "steps" first, then nested "workflow.steps"
                raw_steps = (
                    parsed.get("steps", None)
                    or (parsed.get("workflow") or {}).get("steps", None)
                    or []
                )
                if not raw_steps and parsed.get("workflow"):
                    logger.debug(f"📦 Workflow shape detected, keys: {list((parsed.get('workflow') or {}).keys())}")

            if not raw_steps:
                logger.warning("⚠️ AI response did not include any executable 'steps'; falling back to heuristic plan generation")
                if isinstance(parsed, dict) and isinstance(parsed.get("elements"), list):
                    logger.warning("⚠️ AI returned 'elements' shape instead of 'steps' shape")
                return await self._generate_heuristic_plan(prompt_envelope, ranked_elements)
            
            logger.info(f"✅ Extracted {len(raw_steps)} steps from AI response")
            
            # Helper functions for element validation (defined before loop to avoid scope issues)
            def get_all_element_selectors(el):
                """Extract all selector variants from stored element"""
                selectors = set()
                
                # Add primary selector
                primary = self._get_element_selector(el)
                if primary:
                    selectors.add(primary.lower())
                
                # Add element ID
                el_id = self._get_element_id(el)
                if el_id:
                    selectors.add(el_id.lower())
                    selectors.add(f"#{el_id}".lower())
                
                # Check if element has a dict structure with multiple selectors
                if isinstance(el, dict):
                    # Add css_selector variants
                    if 'css_selector' in el or 'selector_css' in el:
                        css = el.get('css_selector') or el.get('selector_css')
                        if css:
                            selectors.add(str(css).lower())
                    
                    # Add xpath
                    if 'xpath' in el or 'selector_xpath' in el:
                        xpath = el.get('xpath') or el.get('selector_xpath')
                        if xpath:
                            selectors.add(str(xpath).lower())
                    
                    # Add name attribute selector
                    if 'attributes' in el and isinstance(el['attributes'], dict):
                        if 'name' in el['attributes']:
                            name = el['attributes']['name']
                            selectors.add(f"[name='{name}']".lower())
                            selectors.add(f'[name="{name}"]'.lower())
                    
                    # Add selectors dict if present
                    if 'selectors' in el and isinstance(el['selectors'], dict):
                        for key, val in el['selectors'].items():
                            if val:
                                selectors.add(str(val).lower())
                
                return selectors
            
            def normalize_selector(sel):
                """Normalize a selector for comparison - handles common AI variations"""
                if not sel:
                    return ""
                import re as regex_module
                sel = str(sel).strip().lower()
                
                # Remove leading tag prefix before combinators: "a div > ul" -> "div > ul"
                sel = regex_module.sub(r'^[a-z0-9]+\s+(?=[a-z#\[\.])', '', sel)
                
                # Remove redundant :nth-of-type(1) at the end
                sel = regex_module.sub(r':nth-of-type\(1\)$', '', sel)
                
                # Remove tag prefix before id/class/attribute: "input#id" -> "#id"
                sel = regex_module.sub(r'^[a-z0-9]+(?=[#\[\.])', '', sel)
                
                # Standardize quotes
                sel = sel.replace("'", '"')
                
                # Remove trailing spaces
                sel = sel.strip()
                
                return sel
            
            # Detect multi-page workflow by checking if open_url is in the steps
            has_navigation = any(step.get('action') == 'open_url' for step in raw_steps)
            
            # Detect native app test — skip strict selector validation since native
            # selectors (resource-id:, content-desc:, xpath:) won't match CSS selectors
            is_native_app = getattr(prompt_envelope, 'test_type', 'web') == 'app'
            
            if has_navigation:
                logger.info("🌐 Multi-page workflow detected (contains open_url) - relaxing element validation")
                logger.info("   Elements from future pages may not be in current page_slice")
            
            if is_native_app:
                logger.info("📱 Native app test detected - skipping strict selector validation")
            
            # Convert to PlanStep objects with smart element validation
            steps = []
            for i, raw_step in enumerate(raw_steps[:prompt_envelope.max_steps]):
                # Apply policy-based selector transformation to AI-generated target
                original_target = raw_step.get("target")
                action = raw_step.get("action", "")
                
                # Skip validation for actions that don't need specific elements
                if action in ["open_url", "wait", "screenshot", "navigate_back", "navigate_forward", "refresh",
                              "back", "scroll", "swipe", "wait_for_page_load"]:
                    logger.debug(f"✅ Step {i+1} accepted (no element needed) - {action}")
                    step = PlanStep(
                        action=action,
                        target=original_target,
                        args=raw_step.get("args", {}),
                        confidence=raw_step.get("confidence", 0.8),
                        description=raw_step.get("description")
                    )
                    steps.append(step)
                    continue
                
                # For multi-page workflows, skip strict validation since elements may be on future pages
                if has_navigation:
                    logger.debug(f"✅ Step {i+1} accepted (multi-page workflow) - {action} -> {original_target}")
                    step = PlanStep(
                        action=raw_step.get("action", ""),
                        target=original_target,
                        args=raw_step.get("args", {}),
                        confidence=raw_step.get("confidence", 0.7),  # Lower confidence for unvalidated elements
                        description=raw_step.get("description")
                    )
                    # Validate and correct variables in the step
                    validated_step = self.variable_validator.validate_step_variables(step)
                    if validated_step:
                        steps.append(validated_step)
                    continue
                
                # For native app tests, accept all steps — native selectors (resource-id:, content-desc:, xpath:)
                # use a different format than web CSS selectors and can't be validated against the element repo
                if is_native_app:
                    logger.debug(f"✅ Step {i+1} accepted (native app) - {action} -> {original_target}")
                    step = PlanStep(
                        action=raw_step.get("action", ""),
                        target=original_target,
                        args=raw_step.get("args", {}),
                        confidence=raw_step.get("confidence", 0.8),
                        description=raw_step.get("description")
                    )
                    steps.append(step)
                    continue
                
                # For element-based actions, validate against available elements
                step_selector = raw_step.get("args", {}).get('selector', original_target)
                element_found = False
                
                step_selector_norm = normalize_selector(step_selector)
                target_norm = normalize_selector(original_target)
                
                # Check against all available elements
                for el in ranked_elements:
                    el_selectors = get_all_element_selectors(el)
                    
                    # Check exact matches (case-insensitive)
                    if (step_selector and step_selector.lower() in el_selectors) or \
                       (original_target and original_target.lower() in el_selectors):
                        element_found = True
                        logger.debug(f"✅ Step {i+1} validated (exact match) - {action} -> {original_target}")
                        break
                    
                    # Check normalized matches (without tag prefixes)
                    for el_sel in el_selectors:
                        el_sel_norm = normalize_selector(el_sel)
                        if (step_selector_norm and el_sel_norm and 
                            (el_sel_norm == step_selector_norm or el_sel_norm == target_norm)):
                            element_found = True
                            logger.debug(f"✅ Step {i+1} validated (normalized match) - {action} -> {original_target}")
                            break
                    
                    if element_found:
                        break
                
                if not element_found:
                    logger.warning(f"❌ Step {i+1} REJECTED - selector not in stored elements: {original_target or step_selector}")
                    logger.warning(f"   📋 Try one of: {[self._get_element_selector(el) for el in ranked_elements[:5]]}")
                    continue  # Skip this invented step
                
                # Element exists, create the step
                if original_target and original_target.startswith('#'):
                    # AI generated CSS selector, apply policy
                    if getattr(self, '_cached_policy_preference', 'css') == 'xpath':
                        # Convert CSS ID selector to XPath
                        element_id = original_target[1:]  # Remove #
                        policy_target = f"//*[@id='{element_id}']"
                    else:
                        policy_target = original_target
                else:
                    policy_target = original_target
                
                # Apply same policy to args selector if present
                args = raw_step.get("args", {}).copy()
                if 'selector' in args and args['selector'].startswith('#'):
                    if getattr(self, '_cached_policy_preference', 'css') == 'xpath':
                        element_id = args['selector'][1:]  # Remove #
                        args['selector'] = f"//*[@id='{element_id}']"
                
                step = PlanStep(
                    action=raw_step.get("action", ""),
                    target=raw_step.get("target"),
                    args=raw_step.get("args", {}),
                    confidence=raw_step.get("confidence", 0.8),
                    description=raw_step.get("description")
                )
                # Validate and correct variables in the step
                validated_step = self.variable_validator.validate_step_variables(step)
                if validated_step:  # Only add if validation passed
                    steps.append(validated_step)
                else:
                    # Log skipped step due to validation failure
                    pass

            if not steps:
                logger.warning("⚠️ AI response produced 0 valid executable steps after validation; falling back to heuristic plan generation")
                return await self._generate_heuristic_plan(prompt_envelope, ranked_elements)

            output_tokens = len(response) // 4
            return steps, {"input": input_tokens, "output": output_tokens}
            
        except Exception as e:
            logger.error(f"❌ AI plan generation failed: {str(e)}")
            raise Exception(f"AI service unavailable: {str(e)}")

    async def _generate_heuristic_plan(
        self,
        prompt_envelope: PromptEnvelope,
        ranked_elements: List[Any]
    ) -> Tuple[List[PlanStep], Dict[str, int]]:
        """Generate plan using heuristic rules when AI is unavailable"""
        
        logger.info(f"🛠️  Starting heuristic plan generation for prompt: '{prompt_envelope.prompt[:50]}...'")
        
        prompt = prompt_envelope.prompt.lower()
        steps = []
        
        # Analyze prompt for intent
        logger.debug(f"🔍 Analyzing prompt intent from: '{prompt}'")
        
        if "login" in prompt or "sign in" in prompt:
            logger.info("🔑 Detected login intent, generating login steps")
            steps.extend(await self._generate_login_steps(ranked_elements, prompt_envelope.prompt))
        elif "search" in prompt:
            search_term = self._extract_search_term(prompt_envelope.prompt)
            logger.info(f"🔍 Detected search intent, term: '{search_term}'")
            if search_term:
                steps.extend(self._generate_search_steps(ranked_elements, search_term))
        elif "click" in prompt or "navigate" in prompt:
            link_text = self._extract_link_text(prompt_envelope.prompt)
            logger.info(f"👆 Detected navigation intent, link: '{link_text}'")
            if link_text:
                steps.extend(self._generate_navigation_steps(ranked_elements, link_text))
        elif "extract" in prompt or "price" in prompt or "total" in prompt or "calculate" in prompt:
            logger.info("💰 Detected data extraction/calculation intent")
            # Handle data extraction and calculation scenarios
            steps.extend(self._generate_data_extraction_steps(ranked_elements, prompt_envelope.prompt))
        
        # Add generic steps if no specific pattern matched
        if not steps:
            logger.info("❓ No specific pattern matched, generating generic steps")
            steps.extend(self._generate_generic_steps(ranked_elements, prompt_envelope.prompt))
        
        # Validate all generated steps to ensure they have valid targets
        logger.debug(f"✅ Validating heuristic step variables")
        validated_steps = []
        for i, step in enumerate(steps, 1):
            # Check if the step has a valid target that exists in our elements
            step_target = step.target
            step_selector = step.args.get('selector', '')
            
            # Verify the target element actually exists in our ranked_elements
            element_found = False
            for el in ranked_elements:
                element_id = self._get_element_id(el)
                element_selector = self._get_element_selector(el)
                if element_id == step_target or element_selector == step_selector:
                    element_found = True
                    break
            
            if element_found:
                logger.debug(f"  ✓ Step {i} validated: {step.action}")
                validated_steps.append(step)
            else:
                logger.warning(f"  ❌ Step {i} SKIPPED - target element not found: {step_target} ({step_selector})")
                
        steps = validated_steps
        
        logger.info(f"📝 Generated {len(steps)} raw steps from heuristics")
        
        # Validate variables in heuristic steps too
        logger.debug("✅ Validating heuristic step variables")
        validated_steps = []
        for i, step in enumerate(steps):
            validated_step = self.variable_validator.validate_step_variables(step)
            if validated_step:
                validated_steps.append(validated_step)
                logger.debug(f"  ✓ Step {i+1} validated: {step.action}")
            else:
                logger.warning(f"  ✗ Step {i+1} validation failed: {step.action}")
        
        logger.info(f"🎯 Heuristic plan complete - {len(validated_steps)} validated steps")
        return validated_steps, {"input": 0, "output": 0}

    # =========================
    # STEP GENERATION HELPERS
    # =========================
    
    async def _generate_login_steps(self, elements: List[Any], prompt_text: str = "") -> List[PlanStep]:
        """Generate login-specific steps with policy-based selectors"""
        steps = [] 
        
        # Debug: Log available elements
        logger.debug(f"🔍 Available elements for login step generation:")
        for i, el in enumerate(elements):
            el_id = self._get_element_id(el)
            el_selector = self._get_element_selector(el)
            el_tag = self._get_element_tag(el)
            logger.debug(f"  [{i+1}] {el_tag} -> {el_selector} (ID: {el_id})")
        
        # Find username/email field
        username_el = self._find_element_by_keywords(elements, ["email", "username", "user", "user-name"])
        
        # --- Repository fallback: if no login elements in page slice, use repo selectors ---
        if not username_el:
            repo_login_els = self._build_repo_login_elements()
            if repo_login_els:
                logger.info("🔄 Page slice has no login fields; falling back to repository login elements")
                # Prepend navigation step to login page before credential steps
                login_url = "https://www.saucedemo.com"
                steps.append(PlanStep(
                    action="open_url",
                    target="browser",
                    args={"url": login_url},
                    description=f"Navigate to login page: {login_url}",
                    confidence=0.95
                ))
                return steps + await self._generate_login_steps(repo_login_els, prompt_text)
        
        # already searched; reuse result below
        if username_el:
            logger.debug(f"✅ Found username element: {self._get_element_selector(username_el)}")
            username_selector = await self._get_policy_based_element_selector(username_el)
            
            username_value = self._resolve_credential_value("username", prompt_text)

            if username_value:
                steps.append(PlanStep(
                    action="type",
                    target=self._get_element_id(username_el),
                    args={
                        "selector": self._get_element_selector(username_el), 
                        "text": username_value,
                        "element_type": "username_field"
                    },
                    description="Enter username/email",
                    confidence=0.9
                ))
                logger.debug(f"🔑 Using username value from approved source: {username_value}")
            else:
                logger.warning("🔒 No approved username source found (prompt/data bindings); skipping username type step")
        else:
            logger.debug("❌ No username field found")

        # Find password field
        password_el = self._find_element_by_keywords(elements, ["password"])
        if password_el:
            logger.debug(f"✅ Found password element: {self._get_element_selector(password_el)}")
            password_selector = await self._get_policy_based_element_selector(password_el)
            
            password_value = self._resolve_credential_value("password", prompt_text)

            if password_value:
                steps.append(PlanStep(
                    action="type", 
                    target=self._get_element_id(password_el),
                    args={
                        "selector": self._get_element_selector(password_el), 
                        "text": password_value,
                        "element_type": "password_field"
                    },
                    description="Enter password",
                    confidence=0.9
                ))
                logger.debug("Using password value from approved source (value redacted)")
            else:
                logger.warning("🔒 No approved password source found (prompt/data bindings); skipping password type step")
        else:
            logger.debug("❌ No password field found - SKIPPING password step")

        # Find submit button
        submit_el = self._find_element_by_keywords(elements, ["submit", "login", "signin"])
        if submit_el:
            logger.debug(f"✅ Found submit element: {self._get_element_selector(submit_el)}")
            submit_selector = await self._get_policy_based_element_selector(submit_el)
            steps.append(PlanStep(
                action="click",
                target=self._get_element_id(submit_el),
                args={
                    "selector": self._get_element_selector(submit_el),
                    "element_type": "submit_button"
                },
                description="Click login button",
                confidence=0.95
            ))
        else:
            logger.debug("❌ No submit button found - SKIPPING submit step")
            
        logger.debug(f"🎯 Generated {len(steps)} login steps from {len(elements)} available elements")
        return steps
    
    def _generate_search_steps(self, elements: List[Any], search_term: str) -> List[PlanStep]:
        """Generate search-specific steps"""
        steps = []
        
        # Find search input
        search_el = self._find_element_by_keywords(elements, ["search", "query", "find"])
        if search_el:
            steps.append(PlanStep(
                action="type",
                target=self._get_element_id(search_el),
                args={
                    "selector": self._get_element_selector(search_el), 
                    "text": search_term,
                    "element_type": "search_field"
                },
                description=f"Enter search term: {search_term}",
                confidence=0.9
            ))
        
        # Find search button
        button_el = self._find_element_by_keywords(elements, ["search", "go", "submit"], tag_filter="button")
        if button_el:
            steps.append(PlanStep(
                action="click",
                target=self._get_element_id(button_el),
                args={
                    "selector": self._get_element_selector(button_el),
                    "element_type": "search_button"
                },
                description="Click search button",
                confidence=0.9
            ))
        
        return steps
    
    def _generate_navigation_steps(self, elements: List[Any], link_text: str) -> List[PlanStep]:
        """Generate navigation-specific steps"""
        steps = []
        
        # Find matching link
        link_el = self._find_element_by_text(elements, link_text)
        if link_el:
            steps.append(PlanStep(
                action="click",
                target=self._get_element_id(link_el),
                args={
                    "selector": self._get_element_selector(link_el),
                    "element_type": "link"
                },
                description=f"Click link: {link_text}",
                confidence=0.85
            ))
        
        return steps

    def _generate_generic_steps(self, elements: List[Any], prompt: str) -> List[PlanStep]:
        """Generate generic steps when no specific pattern matches"""
        steps = []
        
        # Find first interactive element
        interactive_el = None
        for el in elements[:10]:  # Check first 10 elements
            if self._get_element_tag(el).lower() in ['button', 'input', 'a', 'select']:
                interactive_el = el
                break
        
        if interactive_el:
            tag = self._get_element_tag(interactive_el).lower()
            text = self._get_element_text(interactive_el)
            
            if tag == 'input':
                steps.append(PlanStep(
                    action="type",
                    target=self._get_element_id(interactive_el),
                    args={
                        "selector": self._get_element_selector(interactive_el),
                        "text": "test input",
                        "element_type": "input_field"
                    },
                    description=f"Enter text in {text or 'input field'}",
                    confidence=0.7
                ))
            elif tag in ['button', 'a']:
                steps.append(PlanStep(
                    action="click",
                    target=self._get_element_id(interactive_el),
                    args={
                        "selector": self._get_element_selector(interactive_el),
                        "element_type": tag
                    },
                    description=f"Click {text or tag}",
                    confidence=0.7
                ))
        
        return steps

    def _generate_data_extraction_steps(self, elements: List[Any], prompt: str) -> List[PlanStep]:
        """Generate data extraction and calculation steps"""
        steps = []
        
        # Find elements that look like prices or values
        price_elements = []
        total_elements = []
        
        for el in elements:
            text = self._get_element_text(el).lower()
            selector = self._get_element_selector(el).lower()
            
            # Look for price elements
            if '$' in text or 'price' in selector or 'cost' in selector:
                price_elements.append(el)
            # Look for total elements  
            elif 'total' in text or 'subtotal' in text or 'total' in selector:
                total_elements.append(el)
        
        # Generate extraction steps for available variables
        if hasattr(self, 'variable_validator') and self.variable_validator.allowed_variables:
            price_vars = [v for v in self.variable_validator.allowed_variables if 'price' in v.lower()]
            total_vars = [v for v in self.variable_validator.allowed_variables if 'total' in v.lower()]
            
            # Extract price variables with improved selector specificity
            for i, var_name in enumerate(price_vars):
                if i < len(price_elements):
                    el = price_elements[i]
                    base_selector = self._get_element_selector(el)
                    
                    # Create more specific selector for multiple similar elements
                    if i > 0 and base_selector == self._get_element_selector(price_elements[0]):
                        # Use nth-child or nth-of-type to distinguish
                        if ':nth-child(' not in base_selector and ':nth-of-type(' not in base_selector:
                            # Add nth-child to make selector unique
                            specific_selector = f"{base_selector}:nth-of-type({i + 1})"
                        else:
                            specific_selector = base_selector
                    else:
                        specific_selector = base_selector
                    
                    # Try to make selector more specific by looking at parent context
                    if i > 0 and specific_selector == base_selector:
                        # Alternative approach: use element position or add index
                        specific_selector = f"({base_selector})[{i + 1}]"  # XPath-style indexing
                    
                    steps.append(PlanStep(
                        action="extract_data",
                        target=self._get_element_id(el),
                        args={
                            "selector": specific_selector,
                            "variable": var_name,
                            "timeout": 5000,
                            "element_index": i  # Add index for runtime disambiguation
                        },
                        description=f"Extract {var_name} from element {i + 1}",
                        confidence=0.8
                    ))# Add calculation step if we have multiple price variables
            if len(price_vars) > 1 and total_vars:
                formula = f"{total_vars[0]} = {' + '.join(price_vars)}"
                steps.append(PlanStep(
                    action="calculate",
                    target="",
                    args={
                        "formula": formula,
                        "result_variable": total_vars[0]
                    },
                    description=f"Calculate {total_vars[0]} from price components",
                    confidence=0.8
                ))
            
            # Add verification step if we have a total element
            if total_vars and total_elements:
                el = total_elements[0]
                steps.append(PlanStep(
                    action="assert_text",
                    target=self._get_element_id(el),
                    args={
                        "selector": self._get_element_selector(el),
                        "text": f"${{{total_vars[0]}}}",
                        "timeout": 5000
                    },
                    description=f"Verify displayed total matches calculated {total_vars[0]}",
                    confidence=0.7
                ))
        return steps

    def _analyze_page_context(self, elements: List[Any]) -> str:
        """Analyze page elements to provide context to AI"""
        if not elements:
            return "- No elements detected"
        
        analysis = []
        
        # Count element types
        element_counts = {}
        interactive_elements = []
        form_elements = []
        navigation_elements = []
        
        for el in elements:
            tag = self._get_element_tag(el).lower()
            selector = self._get_element_selector(el).lower()
            text = self._get_element_text(el)
            
            # Count element types
            element_counts[tag] = element_counts.get(tag, 0) + 1
            
            # Categorize functional elements
            if tag in ['button', 'a'] or 'click' in selector:
                interactive_elements.append((tag, text, selector))
            
            if tag in ['input', 'select', 'textarea'] or 'form' in selector:
                form_elements.append((tag, text, selector))
                
            if 'nav' in selector or 'menu' in selector or (tag == 'a' and any(word in text.lower() for word in ['home', 'about', 'contact', 'products', 'login', 'cart'])):
                navigation_elements.append((tag, text, selector))
        
        # Generate analysis
        analysis.append(f"- Total elements: {len(elements)}")
        analysis.append(f"- Element distribution: {', '.join([f'{count} {tag}s' for tag, count in sorted(element_counts.items())])}")
        
        if form_elements:
            analysis.append(f"- Form elements detected: {len(form_elements)} (likely form/input page)")
        
        if navigation_elements:
            analysis.append(f"- Navigation elements: {len(navigation_elements)} (main site navigation)")
            
        if interactive_elements:
            analysis.append(f"- Interactive elements: {len(interactive_elements)} (buttons, links, clickable items)")
        
        # Detect page type patterns
        selectors_text = ' '.join([self._get_element_selector(el).lower() for el in elements])
        if 'login' in selectors_text or 'password' in selectors_text:
            analysis.append("- PAGE TYPE: Login/Authentication page")
        elif 'inventory' in selectors_text or 'product' in selectors_text or 'cart' in selectors_text:
            analysis.append("- PAGE TYPE: E-commerce/Inventory page")
        elif 'remove-' in selectors_text and 'add-to-cart' in selectors_text:
            analysis.append("- PAGE TYPE: Shopping cart management page")
        else:
            analysis.append("- PAGE TYPE: General content page")
        
        return '\n'.join(analysis)

    def _parse_user_intent(self, prompt: str) -> str:
        """Parse user intent to guide AI generation"""
        prompt_lower = prompt.lower()
        intent_analysis = []
        
        # Test scope analysis
        if "all elements" in prompt_lower or "comprehensive" in prompt_lower:
            intent_analysis.append("- SCOPE: Test ALL available elements systematically")
        elif "specific" in prompt_lower or "particular" in prompt_lower:
            intent_analysis.append("- SCOPE: Test specific elements mentioned")
        else:
            intent_analysis.append("- SCOPE: Test elements related to the main request")
        
        # State analysis
        if "default state" in prompt_lower or "initial state" in prompt_lower:
            intent_analysis.append("- STATE: Test elements in their current/default state")
            intent_analysis.append("- WARNING: Do NOT navigate away or change state first")
        elif "after login" in prompt_lower or "logged in" in prompt_lower:
            intent_analysis.append("- STATE: Test elements assuming user is logged in")
        
        # Testing approach
        if "verify" in prompt_lower or "assert" in prompt_lower or "check" in prompt_lower:
            intent_analysis.append("- APPROACH: Include verification/assertion steps")
        if "click" in prompt_lower or "interact" in prompt_lower:
            intent_analysis.append("- APPROACH: Include interaction steps (clicking, typing)")
        if "comprehensive" in prompt_lower:
            intent_analysis.append("- APPROACH: Be thorough and systematic")
        
        # Page context
        if "inventory" in prompt_lower:
            intent_analysis.append("- CONTEXT: Focus on inventory/product page functionality")
        if "login" in prompt_lower:
            intent_analysis.append("- CONTEXT: Focus on authentication functionality")
        
        return '\n'.join(intent_analysis) if intent_analysis else "- INTENT: General testing request"

    # =========================
    # UTILITY METHODS
    # =========================
    
    def _build_native_app_system_prompt(self, current_date: str, current_year: int) -> str:
        """Build system prompt specifically for native mobile app testing via Appium"""
        return f"""You are a QA automation engineer specializing in NATIVE MOBILE APP testing via Appium.
Generate test steps in valid JSON format for a native mobile application.

**CRITICAL: This is a NATIVE MOBILE APP test, NOT a web test.**
- Do NOT use open_url, click_css, type_css, or any web/CSS selectors
- Do NOT generate CSS selectors like .class, #id, input[type='text']
- Use ONLY native app actions: tap, type_text, scroll, swipe, long_press, assert_visible, assert_text, back, screenshot
- Use ONLY native app selectors provided in the elements list

**CURRENT CONTEXT:**
- Today's date: {current_date}
- Current year: {current_year}
- Test type: Native Mobile App (Appium)

ABSOLUTE RULE — SELECTOR INTEGRITY:
- You will be given a list of REAL elements gathered from the device
- You MUST copy selectors EXACTLY as provided — character for character
- Do NOT fabricate, guess, or invent selectors
- Do NOT modify package names, resource IDs, or accessibility labels
- If you need an element that isn't in the provided list, use "scroll" to reveal more content

**AVAILABLE ACTIONS FOR NATIVE APP:**

=== TAP & INTERACTION ===
- tap: Tap on an element
  * Example: {{"action": "tap", "target": "accessibility-id:Search YouTube", "args": {{"selector": "accessibility-id:Search YouTube"}}, "description": "Tap search button"}}
- long_press: Long press on an element
  * Example: {{"action": "long_press", "target": "accessibility-id:Video thumbnail", "args": {{"selector": "accessibility-id:Video thumbnail", "duration": 2000}}, "description": "Long press video"}}

=== TEXT INPUT ===
- type_text: Enter text into a focused field
  * MUST tap the field first, then use type_text
  * Example: {{"action": "type_text", "target": "accessibility-id:Search YouTube", "args": {{"selector": "accessibility-id:Search YouTube", "text": "search query"}}, "description": "Type search query"}}
- clear_text: Clear text from a field

=== SCROLLING & NAVIGATION ===
- scroll: Scroll in a direction to find content
  * Example: {{"action": "scroll", "target": "", "args": {{"direction": "down"}}, "description": "Scroll down"}}
- swipe: Swipe gesture (for carousels, dismiss, etc.)
  * Args: direction (up, down, left, right)
- back: Press the device back button
  * Example: {{"action": "back", "target": "", "args": {{}}, "description": "Press back"}}

=== VERIFICATION ===
- assert_visible: Verify an element is visible on screen
  * Example: {{"action": "assert_visible", "target": "accessibility-id:Home", "args": {{"selector": "accessibility-id:Home", "timeout": 5000}}, "description": "Verify Home tab is visible"}}
- assert_text: Verify text content of an element
  * Example: {{"action": "assert_text", "target": "accessibility-id:Home", "args": {{"selector": "accessibility-id:Home", "text": "Home"}}, "description": "Verify Home text"}}

=== DATA & SCREENSHOTS ===
- extract_data: Extract text from a native element
  * Example: {{"action": "extract_data", "target": "accessibility-id:Home", "args": {{"selector": "accessibility-id:Home", "variable": "tabName"}}, "description": "Extract tab name"}}
- screenshot: Capture current app screen

**NATIVE SELECTOR FORMAT (as provided in elements list):**
- accessibility-id:Label  (preferred — human-readable, stable across environments)
- resource-id:com.package:id/element_id  (Android resource ID — may vary across app builds)
- xpath://*[@content-desc='...']  (XPath — use only when provided)

**SELECTOR PRIORITY (prefer in this order):**
1. accessibility-id / content-desc — Most stable across environments and app builds
2. resource-id — Stable within an app version but package name may differ across environments
3. xpath — Use only when directly provided in the elements list

**RESPONSE FORMAT:**
Return valid JSON with this structure:
{{
  "steps": [
    {{
      "action": "tap",
      "target": "accessibility-id:Search",
      "args": {{
        "selector": "accessibility-id:Search"
      }},
      "description": "Tap search button",
      "confidence": 0.9
    }}
  ],
  "clarifications": []
}}

CRITICAL CONSTRAINTS:
- The app is already launched - start testing from the CURRENT SCREEN
- Use ONLY elements from the PROVIDED ELEMENTS list
- Copy selectors EXACTLY as provided - do not modify, guess, or fabricate
- Prefer accessibility-id selectors over resource-id when both are available
- Generate a logical mobile app workflow that matches the user's test request
- End with a screenshot for documentation"""
    
    def _build_enhanced_system_prompt(self, test_type: str = "web") -> str:
        """Build enhanced system prompt for intelligent test generation"""
        
        # Add current date context
        from datetime import datetime
        current_date = datetime.now().strftime("%Y-%m-%d")
        current_year = datetime.now().year
        
        # =====================================================
        # NATIVE APP TEST MODE
        # =====================================================
        if test_type == 'app':
            return self._build_native_app_system_prompt(current_date, current_year)
        
        base_prompt = f"""You are a QA automation engineer. Generate test steps in valid JSON format.

**CURRENT CONTEXT:**
- Today's date: {current_date}
- Current year: {current_year}
- When generating dates for travel, bookings, or future events, use dates from {current_year} or later
- Example: For flight search, use departure dates like {current_year}-12-25 or later

IMPORTANT RULES:
1. Analyze the user's request AND page context to understand the SPECIFIC scope - adapt to ANY website type
2. Use PAGE CONTEXT information to understand website type, primary actions, and testing focus
3. Focus on LOGICAL WORKFLOW that matches the website's purpose and user intent
4. ONLY verify and test elements that are RELEVANT to the user's specific request and page type
5. Generate VALID JSON only - no extra text or comments

**CORE TESTING PRINCIPLES:**
1. Follow user's testing request and page context description
2. Use assert_text to verify button labels, product names, prices, and content
3. Use assert_visible to confirm elements are displayed
4. Add wait_for steps after clicks that trigger dynamic content (menus, dropdowns)
5. For comprehensive testing: verify ALL items when testing product listings, forms, or multiple similar elements
6. When data bindings are provided, ALWAYS use extract_data to capture dynamic values and calculate to perform math
7. AVOID redundant extractions: if you calculate a value, use it directly in assertions
8. Generate valid JSON only - no extra text

**DATA EXTRACTION RULES:**
- Use extract_data action to capture dynamic values from page elements (prices, text, counts, etc.)
- Use calculate action to perform mathematical operations (addition, subtraction, multiplication, division)
- Extract BEFORE calculating, calculate BEFORE asserting
- CRITICAL: When data bindings are provided, use the EXACT variable names specified - do not create new ones
- IMPORTANT: Use different variable names for calculated vs displayed values to avoid conflicts

**VARIABLE NAMING STRATEGY:**
- CRITICAL: ONLY use variable names that are explicitly provided in the PREDEFINED VARIABLES section
- NEVER invent new variable names like "calculatedTotal", "value1", "value2", etc.
- If predefined variables are provided, use ONLY those exact names
- If no predefined variables are provided, do not use variable references at all
- Variable names are case-sensitive and must match exactly

**VARIABLE USAGE IN ASSERTIONS:**
- When using variables in assert_text, include the variable name in the "text" field as "${{variableName}}"
- Only use variables that are explicitly defined in the data bindings
- Example: {{"action": "extract_data", "target": ".price-display", "args": {{"selector": ".price-display", "variable": "backpackPrice"}}}}
- Example: {{"action": "calculate", "target": "", "args": {{"formula": "itemSubTotal = backpackPrice + onesiePrice", "result_variable": "itemSubTotal"}}}}
- Example: {{"action": "assert_text", "target": ".total-label", "args": {{"selector": ".total-label", "text": "Total: ${{itemSubTotal}}"}}}}
- Variables will be dynamically replaced with their extracted values during test execution

**PREDEFINED VARIABLES (when provided):**
- Use ONLY the variable names that are explicitly defined in the data bindings context
- Do NOT create new variable names beyond what is provided
- Match variable names exactly as specified in the bindings configuration
- Respect the distinction between extract-type and calculate-type variables"""

        # Add constant binding information if available
        if hasattr(self, 'constant_bindings') and self.constant_bindings:
            constant_info = "\n\n**PREDEFINED CONSTANT VALUES:**"
            constant_info += "\n- CRITICAL: Use these exact values for login credentials, DO NOT use values from page content"
            for var_name, value in self.constant_bindings.items():
                constant_info += f"\n- {var_name}: '{value}'"
            constant_info += "\n- These values override any credentials shown on the page"
            base_prompt += constant_info

        base_prompt += """

**SELECTOR QUALITY RULES (CRITICAL):**
- AVOID auto-generated IDs that contain random numbers, timestamps, or UUIDs (e.g., #tabs-06804563505102382-tab-0)
- PREFER stable selectors in this priority order:
  1. Semantic HTML5 elements (nav, main, article, section)
  2. Stable data attributes (data-testid, data-cy, data-test)
  3. ARIA attributes (aria-label, role)
  4. Semantic class names (btn-primary, nav-link, search-input)
  5. Stable IDs (user-name, password, login-button)
- INDICATORS OF BAD SELECTORS:
  - IDs with numbers: #element-123456789, #tabs-068045635
  - React/Vue generated IDs: #__next, #app-root-12345
  - Random hashes: #x7f3d9a2b
- LOOK FOR PATTERNS:
  - Forms: Look for <form> tags, input[type="..."], labeled inputs
  - Buttons: <button>, input[type="submit"], [role="button"]
  - Navigation: <nav>, .nav-link, [aria-label="navigation"]
  - Interactive elements: Elements with event listeners, tabindex, or aria roles

**AVAILABLE ACTIONS:**

=== BASIC ACTIONS ===
- open_url: Navigate to start page
- type: Enter text into form fields  
- click: Click buttons, links, and interactive elements
- assert_text: Verify text content of elements (partial match)
- assert_visible: Verify elements are visible
- wait_for: Wait for page transitions or elements to load
- extract_data: Extract text/value from a SINGLE element (NOT arrays/multiple elements)
  * MUST include "selector" in args
  * MUST include "variable" name in args
  * Extracts text from ONE element only
  * Example: Extract price from one element into variable "backpackPrice"
- calculate: Simple arithmetic ONLY (+, -, *, /)
  * NO JavaScript code, NO array methods, NO .sort(), NO arrow functions
  * Only supports: variableName = value1 + value2 - value3
  * Use extracted variable names in formula
  * Example: "totalPrice = backpackPrice + onesiePrice"
- api_setup: Execute predefined API calls to create test data BEFORE UI test runs
  * Use when test requires precondition data (e.g., create booking before testing change booking)
  * MUST specify "setup_id" in args - use IDs from AVAILABLE API TEST DATA SETUPS section
  * Variables extracted from API response become available for use in subsequent steps
  * Place api_setup steps at the BEGINNING of the test, before any UI interactions
  * Example: Create a booking via API, then use ${booking_id} in UI test steps
- screenshot: Capture page state

=== NAVIGATION & PAGE CONTROL ===
- scroll_to_element: Scroll to bring an element into view (critical for lazy-loaded pages)
  * Use when elements are below the fold or in scrollable containers
- scroll_to_position: Scroll to specific position on page
  * args.position: "top", "bottom", "50%" (percentage), or "500" (pixels)
- wait_for_page_load: Smart wait that checks document.readyState and network idle
  * Better than fixed waits, ensures page is actually ready
  * args.timeout: optional timeout in seconds (default 30)
- switch_to_frame: Switch context to an iframe
  * args.frame: frame index (0, 1, 2), name/id, or CSS selector
- switch_to_parent_frame: Switch back from iframe to parent context
- switch_to_window: Switch to different browser tab/window
  * args.window: "new" (newest tab), "main" (original), index, or handle
- close_window: Close current window and switch to remaining
- navigate_back: Click browser back button
- navigate_forward: Click browser forward button  
- refresh_page: Refresh/reload current page

=== FORM & INPUT ===
- clear_and_type: Clear existing text then type new text (avoids appending issues)
  * Preferred over "type" when field may have existing content
- type_slowly: Type character by character with delay
  * Use for autocomplete dropdowns or fields with debounced validation
  * args.delay: milliseconds between characters (default 100)
- upload_file: Upload file to file input element
  * args.file_path: absolute path to file to upload
- select_by_index: Select dropdown option by index (0-based)
  * args.index: option index to select
- select_by_value: Select dropdown option by value attribute
  * args.value: the value attribute of the option
- select_by_text: Select dropdown option by visible text
  * args.text: the visible text of the option
- check_checkbox: Check a checkbox (idempotent - no-op if already checked)
- uncheck_checkbox: Uncheck a checkbox (idempotent - no-op if already unchecked)
- set_slider: Set a range slider/input to specific value
  * args.value: numeric value to set
- set_date_picker: Set a date picker field
  * args.date: date value in appropriate format (yyyy-MM-dd for HTML5 inputs)

=== VERIFICATION & ASSERTION ===
- assert_text_exact: Verify element text matches exactly
- assert_text_contains: Verify element text contains substring
- assert_element_count: Verify number of elements matching selector
  * args.count: expected number of elements
- assert_attribute: Verify element attribute has expected value
  * args.attribute: attribute name (href, placeholder, disabled, etc.)
  * args.value: expected attribute value
- assert_page_title: Verify page title matches expected value
  * args.title: expected page title
- assert_url: Verify current URL matches exactly
  * args.url: expected URL
- assert_url_contains: Verify current URL contains substring
  * args.substring: expected URL substring
- assert_element_enabled: Verify element is enabled/interactable
- assert_element_disabled: Verify element is disabled
- assert_checkbox_checked: Verify checkbox is checked
- assert_checkbox_unchecked: Verify checkbox is unchecked
- assert_toast_message: Verify toast/snackbar notification appears with text
  * Auto-detects common toast selectors (.toast, .snackbar, [role="alert"])
  * args.text: expected toast message text

=== KEYBOARD & MOUSE ===
- hover: Hover over element to reveal hidden menus/tooltips
- right_click: Right-click (context click) on element
- double_click: Double-click on element
- drag_and_drop: Drag element to another element
  * target: source element selector
  * args.drop_target: destination element selector
- press_key: Press keyboard key (Enter, Tab, Escape, arrow keys, F1-F12)
  * args.key: key name (ENTER, TAB, ESCAPE, UP, DOWN, LEFT, RIGHT, etc.)
- keyboard_shortcut: Execute keyboard shortcut (Ctrl+S, Ctrl+Z, etc.)
  * args.keys: shortcut combination (e.g., "CTRL+S", "CTRL+SHIFT+N")

=== TABLES & DYNAMIC CONTENT ===
- get_table_cell_value: Extract value from table cell and store in variable
  * args.row: row index (1-based)
  * args.col: column index (1-based) or column header name
  * args.variable: variable name to store value
- assert_table_row_count: Verify number of rows in table
  * args.count: expected row count
- click_table_row_by_value: Find row containing value and click it
  * args.value: text to search for
  * args.col: optional column to search in
- wait_for_table_to_load: Wait for table to have rows loaded
  * Use for dynamically loaded table data

=== LISTS & ITERATION ===
- extract_list: Extract text from ALL elements matching selector into a list variable
  * Creates: varName, varName_0, varName_1, varName_count
  * Use for checking all product names, prices, etc.
- verify_all: Verify ALL elements matching selector satisfy a condition
  * args.condition: "not_empty", "contains:text", "equals:text", "matches:regex"
  * Example: Verify all product descriptions contain certain text
- count_elements: Count elements matching selector and store in variable
- for_each: Iterate through extracted list, storing each item for subsequent steps

=== DATE VERIFICATION ===
- verify_date_format: Verify element text matches expected date format
  * args.format: date format pattern (MM/dd/yyyy, yyyy-MM-dd, MMM dd, yyyy, etc.)
  * Auto-detects common formats if not specified

=== ALERTS & MODALS ===
- accept_alert: Accept (click OK) JavaScript alert/confirm dialog
- dismiss_alert: Dismiss (click Cancel) JavaScript alert/confirm dialog
- get_alert_text: Extract alert text into variable
  * args.variable: variable name to store alert text
- wait_for_modal_visible: Wait for modal dialog to appear
  * Auto-detects common modal selectors
- wait_for_modal_dismissed: Wait for modal to close/disappear

=== API / NETWORK ===
- wait_for_api_response: Wait for specific API request to complete
  * Use to ensure page data is ready before verifying
  * args.url_pattern: optional URL substring to wait for
  * args.timeout: timeout in seconds (default 30)

**CRITICAL extract_data LIMITATIONS:**
🚫 CANNOT extract from multiple elements into arrays
🚫 CANNOT use .inventory_item_price without a specific element
✅ CAN extract from ONE specific element: .inventory_item:nth-child(1) .inventory_item_price
✅ Each extract_data creates ONE variable with ONE value
✅ For multiple elements, use extract_list action instead

**CRITICAL calculate LIMITATIONS:**
🚫 NO JavaScript: NO .sort(), NO .filter(), NO arrow functions, NO array methods
🚫 NO complex expressions: NO itemPrices.sort((a, b) => a - b)
✅ ONLY simple math: totalPrice = price1 + price2
✅ ONLY operators: + - * /
✅ Use variables created by extract_data steps

JSON FORMAT (respond with ONLY this JSON, no other text):
{
  "steps": [
    {
      "action": "open_url",
      "target": "",
      "args": {
        "url": "https://website.com",
        "timeout": 5000
      },
      "description": "Navigate to target page",
      "confidence": 0.9
    },
    {
      "action": "click",
      "target": "#burger-menu-btn",
      "args": {
        "selector": "#burger-menu-btn",
        "timeout": 5000
      },
      "description": "Click hamburger menu",
      "confidence": 0.9
    },
    {
      "action": "wait_for",
      "target": ".menu-container",
      "args": {
        "selector": ".menu-container",
        "timeout": 5000
      },
      "description": "Wait for menu to open",
      "confidence": 0.9
    },
    {
      "action": "assert_visible",
      "target": "#menu-item",
      "args": {
        "selector": "#menu-item",
        "timeout": 5000
      },
      "description": "Verify menu item is visible",
      "confidence": 0.9
    },
    {
      "action": "extract_data",
      "target": ".inventory_item:nth-child(1) .inventory_item_price",
      "args": {
        "selector": ".inventory_item:nth-child(1) .inventory_item_price",
        "variable": "firstItemPrice"
      },
      "description": "Extract first item price",
      "confidence": 0.9
    },
    {
      "action": "extract_data",
      "target": ".inventory_item:nth-child(2) .inventory_item_price",
      "args": {
        "selector": ".inventory_item:nth-child(2) .inventory_item_price",
        "variable": "secondItemPrice"
      },
      "description": "Extract second item price",
      "confidence": 0.9
    },
    {
      "action": "calculate",
      "target": "",
      "args": {
        "formula": "totalPrice = firstItemPrice + secondItemPrice",
        "result_variable": "totalPrice"
      },
      "description": "Calculate total of two prices",
      "confidence": 0.9
    },
    {
      "action": "type",
      "target": "#username",
      "args": {
        "selector": "#username",
        "text": "testuser"
      },
      "description": "Enter username",
      "confidence": 0.9
    }
  ]
}

CRITICAL CONSTRAINTS:
- extract_data extracts from ONE element at a time, creates ONE variable
- calculate uses simple arithmetic ONLY (no JavaScript, no array operations)
- To work with multiple items, create separate extract_data steps for each item
- Use :nth-child(N) or specific selectors to target individual elements
- NO dynamic selector generation with variables (no ${variable} interpolation in selectors)
- Keep it simple: the test runner is Java-based, not JavaScript

CRITICAL: When generating login steps, use the predefined constant values above, not values visible on the page."""

        # Add constant binding information if available
        if hasattr(self, 'constant_bindings') and self.constant_bindings:
            constant_info = "\n\n**PREDEFINED CONSTANT VALUES:**"
            constant_info += "\n- CRITICAL: Use these exact values for login credentials, DO NOT use values from page content"
            for var_name, value in self.constant_bindings.items():
                constant_info += f"\n- {var_name}: '{value}'"
            constant_info += "\n- These values override any credentials shown on the page"
            base_prompt += constant_info

        # Add API test data setup context if available
        if hasattr(self, 'api_test_data_setups') and self.api_test_data_setups:
            api_context = "\n\n**AVAILABLE API TEST DATA SETUPS:**"
            api_context += "\n- Use api_setup action to create precondition data via API before UI test steps"
            api_context += "\n- Place api_setup steps at the BEGINNING of your test plan"
            api_context += "\n- Variables extracted from API responses can be used in subsequent steps with ${variable_name}"
            api_context += "\n\nAvailable setups:"
            
            for setup in self.api_test_data_setups:
                api_context += f"\n\n  Setup ID: {setup.get('id')}"
                api_context += f"\n  Name: {setup.get('name')}"
                api_context += f"\n  Category: {setup.get('category', 'general')}"
                api_context += f"\n  Description: {setup.get('description', 'No description')}"
                api_context += f"\n  API: {setup.get('http_method', 'POST')} {setup.get('endpoint_name', '')}{setup.get('path', '')}"
                
                # Show available output variables
                extractors = setup.get('response_extractors', [])
                if extractors:
                    var_names = [e.get('name') for e in extractors if e.get('name')]
                    if var_names:
                        api_context += f"\n  Output Variables: {', '.join(var_names)}"
                        api_context += f"\n  Use as: {', '.join([f'${{{v}}}' for v in var_names])}"
            
            api_context += "\n\n**API SETUP USAGE EXAMPLE:**"
            api_context += """
{
  "action": "api_setup",
  "target": "",
  "args": {
    "setup_id": "<UUID from available setups above>",
    "variables": {}
  },
  "description": "Create test data via API",
  "confidence": 0.95
}"""
            api_context += "\n\n**WHEN TO USE api_setup:**"
            api_context += "\n- User mentions testing a flow that requires existing data (change booking, edit profile, cancel order)"
            api_context += "\n- The prompt implies preconditions that need to be set up first"
            api_context += "\n- Use the setup whose category/description best matches the precondition needed"
            
            base_prompt += api_context

        return base_prompt
    
    def _extract_native_selector(self, el: Any) -> tuple:
        """Extract the best native selector from an element.
        
        Returns (selector_string, accessibility_id, resource_id) tuple.
        Priority: accessibility_id/content-desc (stable across envs) > resource-id > xpath
        """
        import re
        
        el_attrs = {}
        if hasattr(el, 'attributes') and el.attributes:
            el_attrs = el.attributes if isinstance(el.attributes, dict) else {}
        elif isinstance(el, dict):
            el_attrs = el.get('attributes', {})
            if isinstance(el_attrs, str):
                try:
                    import json
                    el_attrs = json.loads(el_attrs)
                except:
                    el_attrs = {}
        
        # Check attributes for native selectors (enriched by API)
        accessibility_id = (el_attrs.get('accessibility_id', '') or 
                           el_attrs.get('content-desc', '') or 
                           el_attrs.get('contentDescription', '') or '')
        resource_id = (el_attrs.get('resource_id', '') or 
                      el_attrs.get('resource-id', '') or 
                      el_attrs.get('resourceId', '') or '')
        
        # Get xpath from the element
        xpath_sel = ''
        if hasattr(el, 'selector_xpath'):
            xpath_sel = el.selector_xpath or ''
        elif isinstance(el, dict):
            xpath_sel = el.get('selector_xpath', '') or el.get('xpath', '')
        
        # Parse xpath to extract content-desc or resource-id if not found in attributes
        if xpath_sel and not accessibility_id:
            m = re.search(r"@content-desc=['\"]([^'\"]+)['\"]", xpath_sel)
            if m:
                accessibility_id = m.group(1)
        if xpath_sel and not resource_id:
            m = re.search(r"@resource-id=['\"]([^'\"]+)['\"]", xpath_sel)
            if m:
                resource_id = m.group(1)
        
        # Build selector string — prefer content-desc (stable across environments)
        # over resource-id (may contain package names that differ in dev/prod)
        selector = ""
        if accessibility_id and accessibility_id != 'null':
            selector = f"accessibility-id:{accessibility_id}"
        elif resource_id and resource_id != 'null':
            selector = f"resource-id:{resource_id}"
        elif xpath_sel:
            selector = f"xpath:{xpath_sel}"
        
        return selector, accessibility_id, resource_id

    def _build_native_app_user_prompt(self, prompt_envelope: PromptEnvelope, ranked_elements: List[Any]) -> str:
        """Build user prompt for native mobile app testing with native selectors"""
        
        # Categorize elements by native app functionality
        interactive_elements = []
        text_elements = []
        layout_elements = []
        
        for el in ranked_elements:
            tag = self._get_element_tag(el)
            text = self._get_element_text(el)
            
            selector, accessibility_id, resource_id = self._extract_native_selector(el)
            
            if not selector:
                continue
            
            # Build element description
            element_desc = f"{tag} [{selector}]"
            if text and text.strip():
                element_desc += f' "{text[:50]}"'
            
            # Categorize by native element type
            tag_lower = tag.lower() if tag else ''
            if tag_lower in ['edittext', 'input', 'android.widget.edittext', 'textfield']:
                interactive_elements.append(element_desc)
            elif tag_lower in ['button', 'imagebutton', 'android.widget.button', 'android.widget.imagebutton',
                              'android.widget.imageview'] or 'button' in tag_lower:
                interactive_elements.append(element_desc)
            elif tag_lower in ['textview', 'android.widget.textview', 'android.view.view']:
                if accessibility_id or (text and len(text.strip()) > 0):
                    text_elements.append(element_desc)
                else:
                    layout_elements.append(element_desc)
            else:
                if text and text.strip():
                    text_elements.append(element_desc)
                else:
                    layout_elements.append(element_desc)
        
        # Build categorized element lists for native app
        elements_context = ""
        if interactive_elements:
            elements_context += f"\nINTERACTIVE ELEMENTS (tappable, input fields, buttons):\n"
            elements_context += "\n".join([f"- {elem}" for elem in interactive_elements])
        if text_elements:
            elements_context += f"\nTEXT/CONTENT ELEMENTS (labels, titles, descriptions):\n"
            elements_context += "\n".join([f"- {elem}" for elem in text_elements[:30]])
        if layout_elements and len(layout_elements) <= 10:
            elements_context += f"\nLAYOUT ELEMENTS:\n"
            elements_context += "\n".join([f"- {elem}" for elem in layout_elements[:10]])
        
        platform = getattr(prompt_envelope, 'platform', 'android') or 'android'
        
        return f"""Request: {prompt_envelope.prompt}

**TEST TYPE: NATIVE MOBILE APP ({platform.upper()})**
The app is already open on the device. Do NOT use open_url or any web actions.

{elements_context}

CRITICAL REQUIREMENTS FOR NATIVE APP:
1. The app is ALREADY RUNNING - start interacting with the current screen
2. Use ONLY the selectors from the PROVIDED ELEMENTS list above — do NOT invent selectors
3. Copy selectors EXACTLY as shown (accessibility-id:..., resource-id:..., xpath:...)
4. Do NOT guess or fabricate resource IDs or content descriptions
5. Use native actions only: tap, type_text, scroll, swipe, back, assert_visible, assert_text, extract_data, screenshot
6. For text input: first TAP the input field, then use type_text
7. For scrolling: use scroll with direction (up/down/left/right)
8. End with a screenshot for documentation
9. If no element matches what you need, use scroll to reveal more elements rather than guessing selectors

Generate a logical mobile app workflow based on the user's request and the available elements."""
    
    def _build_enhanced_user_prompt(self, prompt_envelope: PromptEnvelope, ranked_elements: List[Any]) -> str:
        """Build enhanced user prompt with rich context for AI"""
        
        # Check if this is a native app test
        test_type = getattr(prompt_envelope, 'test_type', 'web')
        if test_type == 'app':
            return self._build_native_app_user_prompt(prompt_envelope, ranked_elements)
        
        # Categorize elements by general functionality (website-agnostic)
        input_elements = []
        button_elements = []
        link_elements = []
        content_elements = []
        
        for el in ranked_elements:
            tag = self._get_element_tag(el)
            selector = self._get_element_selector(el)
            text = self._get_element_text(el)
            
            # Try to find a friendly name from element repository
            element_name = None
            if hasattr(self, 'element_selectors_reverse'):
                # Look up by selector
                selector_normalized = selector.lower().strip()
                element_name = self.element_selectors_reverse.get(selector_normalized)
            
            if tag.lower() in ['button', 'a', 'input', 'select', 'textarea'] and selector:
                # Show element name if available, otherwise show selector
                if element_name:
                    element_desc = f"{tag} '{element_name}' ({selector})"
                else:
                    element_desc = f"{tag} {selector}"
                    
                if text and text.strip():
                    element_desc += f' "{text[:30]}"'
                
                # Categorize by element type (generic for any website)
                if tag.lower() in ['input', 'select', 'textarea']:
                    input_elements.append(element_desc)
                elif tag.lower() == 'button' or 'btn' in selector.lower():
                    button_elements.append(element_desc)
                elif tag.lower() == 'a' or 'link' in selector.lower():
                    link_elements.append(element_desc)
                else:
                    content_elements.append(element_desc)
        
        # Build categorized element lists (generic categories)
        elements_context = ""
        if input_elements:
            elements_context += f"\nINPUT ELEMENTS:\n" + "\n".join([f"- {elem}" for elem in input_elements])
        if button_elements:
            elements_context += f"\nBUTTON ELEMENTS:\n" + "\n".join([f"- {elem}" for elem in button_elements])
            # Add guidance for comprehensive testing of multiple similar elements
            if len(button_elements) > 3:
                elements_context += f"\n  NOTE: {len(button_elements)} buttons found - consider testing ALL when verifying functionality"
        if link_elements:
            elements_context += f"\nLINK ELEMENTS:\n" + "\n".join([f"- {elem}" for elem in link_elements])
            if len(link_elements) > 3:
                elements_context += f"\n  NOTE: {len(link_elements)} links found - consider testing ALL when verifying content"
        if content_elements:
            elements_context += f"\nOTHER ELEMENTS:\n" + "\n".join([f"- {elem}" for elem in content_elements[:15]])  # Limit other elements
        
        # Include URL and page context if available
        url_context = ""
        if prompt_envelope.page_url:
            url_context = f"\nSTART URL: {prompt_envelope.page_url}"
        
        page_context = ""
        if prompt_envelope.page_context:
            ctx = prompt_envelope.page_context
            page_context = f"\nPAGE CONTEXT (Follow this guidance for testing strategy):"
            if ctx.page_type:
                page_context += f"\n- Page Type: {ctx.page_type}"
            if ctx.page_title:
                page_context += f"\n- Page Title: {ctx.page_title}"
            if ctx.page_description:
                page_context += f"\n- Testing Strategy: {ctx.page_description}"
            if ctx.primary_actions:
                page_context += f"\n- Primary Actions: {', '.join(ctx.primary_actions)}"
            if ctx.key_elements:
                page_context += f"\n- Key Elements: {', '.join(ctx.key_elements)}"
            if ctx.testing_focus:
                page_context += f"\n- Testing Focus: {ctx.testing_focus}"
            if ctx.user_notes:
                page_context += f"\n- Notes: {ctx.user_notes}"
            if ctx.screenshot_url:
                page_context += f"\n- Screenshot Available: Use visual context at {ctx.screenshot_url}"
                
        return f"""Request: {prompt_envelope.prompt}
{url_context}
{page_context}
{elements_context}

CRITICAL REQUIREMENTS:
🌐 MULTI-PAGE WORKFLOWS: If your plan includes 'open_url' to navigate to different pages:
   ✅ You can reference elements that will exist on FUTURE pages (after navigation)
   ✅ Use standard, semantic selectors (e.g., #username, #password, .product-item)
   ✅ The provided elements are from the CURRENT page only
   
📄 SINGLE-PAGE WORKFLOWS: If your plan works on the CURRENT page only:
   🚫 ONLY use selectors from the PROVIDED ELEMENTS list above
   🚫 DO NOT invent or guess selectors - use EXACT selectors from the element list
   ✅ Copy selectors EXACTLY as shown - including quotes, brackets, and special characters
   
✅ Always prefer semantic, stable selectors over auto-generated IDs
✅ If required elements are missing from current page, note this in clarifications

Generate an ADAPTIVE workflow based on the website type and user request:

0. ELEMENT VALIDATION:
   - For SINGLE-PAGE workflows: Verify each target element exists in the PROVIDED ELEMENTS list
   - For MULTI-PAGE workflows: Use semantic selectors for elements on future pages
   - If critical elements are missing from current page, note this in clarifications

1. ANALYZE WEBSITE TYPE from URL and available elements:
   - E-commerce: Look for product, cart, checkout elements
   - Airlines: Look for flight search, booking, date picker elements  
   - Banking: Look for account, transfer, balance elements
   - News/Content: Look for articles, categories, search elements
   - General: Identify primary functionality from available elements

2. FOCUS ON USER'S SPECIFIC REQUEST:
   - If "search" mentioned → Find search input, TYPE search term, click search button, verify results
   - If "test booking flow" → Focus on date pickers, forms, booking buttons
   - If "test navigation" → Focus on menus, links, page transitions
   - If "comprehensive testing" → Test all major functionality for that site type

3. COMPLETE ACTION SEQUENCES (DO NOT SKIP STEPS):
   - Search workflow: MUST include type action → "type" into search input → click search → wait for results → verify
   - Login workflow: MUST include type actions → "type" username → "type" password → click login
   - Form workflow: MUST include type actions for EACH input field → fill all fields → submit
   - Navigation workflow: Click links → wait for page load → verify new page
   
4. LOGICAL WORKFLOW for the identified website type:
   - Airlines: Search flights → Select dates → Choose flights → Enter passenger info
   - E-commerce: Browse products → Add to cart → View cart → Checkout
   - Banking: Login → Select account → Perform transactions
   - News: Navigate categories → Read articles → Use search
   - Forms: Fill fields → Validate → Submit → Verify results

5. VERIFY elements appropriate to the website and request:
   - Don't test shopping cart elements on airline sites
   - Don't test flight booking elements on news sites
   - Focus on elements that match the website's actual purpose

6. ADAPTIVE STATE MANAGEMENT:
   - Understand element states specific to this website type
   - Follow logical interaction sequences for this domain
   - Verify results appropriate to the website's functionality

7. CRITICAL FOR SEARCH REQUESTS:
   When the user asks to "search for X" or "test search", you MUST generate these steps:
   - Navigate to the website
   - Find the search input element (input[type="text"], textarea, or similar)
   - Use "type" action to enter the search term into the input
   - Click the search button or submit
   - Wait for results to load
   - Verify results are visible
   DO NOT skip the "type" action - it is REQUIRED for search functionality!

8. End with a screenshot for documentation

CRITICAL: Adapt completely to the website type. Don't use e-commerce patterns for airlines, banking, or other domains."""
    
    def _filter_initial_state_elements(self, elements: List[Any]) -> List[Any]:
        """Prioritize primary interactive elements for initial page state"""
        
        # Categorize elements by importance for initial interactions
        primary_elements = []      # Login forms, main navigation, primary buttons
        secondary_elements = []    # Secondary actions, links, form inputs
        tertiary_elements = []     # Assert targets, less important elements
        
        for el in elements:
            selector = self._get_element_selector(el)
            text = self._get_element_text(el).lower()
            tag = self._get_element_tag(el).lower()
            element_id = getattr(el, 'element_id', '') or selector
            
            # Primary: Login forms, main navigation, essential buttons
            if (
                ('login' in text or 'sign' in text or 'submit' in text) or
                ('username' in element_id.lower() or 'email' in element_id.lower()) or
                ('password' in element_id.lower()) or
                (tag in ['input', 'button'] and any(keyword in (text + element_id.lower()) 
                    for keyword in ['login', 'submit', 'username', 'password', 'email'])) or
                ('nav' in element_id.lower() or 'menu' in element_id.lower()) or
                (tag == 'a' and any(keyword in text for keyword in ['home', 'about', 'contact', 'products']))
            ):
                primary_elements.append(el)
            
            # Secondary: Form inputs, action buttons, main page links
            elif (
                tag in ['input', 'select', 'textarea'] or
                (tag == 'button' and 'add' not in text and 'remove' not in text) or
                (tag == 'a' and len(text) > 3)
            ):
                secondary_elements.append(el)
            
            # Everything else as tertiary
            else:
                tertiary_elements.append(el)
        
        # Return prioritized subset: focus on primary and some secondary elements
        result = primary_elements + secondary_elements[:10]  # Limit secondary elements
        
        # If we don't have enough primary/secondary, add some tertiary
        if len(result) < 15:
            result.extend(tertiary_elements[:15 - len(result)])
        
        return result[:20]  # Cap at 20 total elements
    
    def _convert_page_elements_to_dicts(self, page_elements: List[Any]) -> List[Dict[str, Any]]:
        """Convert PageElement objects to dict format for processing"""
        element_dicts = []
        for el in page_elements:
            if hasattr(el, 'tag'):  # PageElement object
                element_dicts.append({
                    "tag": el.tag,
                    "css_selector": el.selector_css,
                    "xpath": el.selector_xpath,
                    "text": el.text or "",  # Handle None values
                    "attributes": el.attributes,
                    "isInteractive": el.is_interactive,
                    "isVisible": el.is_visible
                })
            else:  # Already a dict
                element_dicts.append(el)
        
        return element_dicts

    def _build_repo_login_elements(self) -> List[Dict[str, Any]]:
        """Build minimal element dicts for login fields from repository name mapping.
        Used as a fallback when the current page slice doesn't contain login fields
        (e.g. user is already logged in and the page shows inventory)."""
        # Known saucedemo login selectors present in the element repository
        login_field_map = [
            {"tag": "input",  "css_selector": "#user-name",    "id": "repo-user-name",    "text": "username user-name email"},
            {"tag": "input",  "css_selector": "#password",     "id": "repo-password",     "text": "password"},
            {"tag": "input",  "css_selector": "#login-button", "id": "repo-login-button", "text": "login submit signin"},
        ]
        # Verify at least one is in our reverse-selector map (repo was loaded)
        reverse = getattr(self, "element_selectors_reverse", {})
        # Build elements regardless – the selectors are canonical saucedemo IDs
        els = []
        for m in login_field_map:
            els.append(m)
        if els:
            logger.debug(f"\ud83d\uddc3\ufe0f  Built {len(els)} repo login elements for heuristic fallback")
        return els

    def _find_element_by_keywords(self, elements: List[Any], keywords: List[str], tag_filter: Optional[str] = None) -> Any:
        """Find element by keywords in text/attributes/selector"""
        
        for i, el in enumerate(elements):
            text = self._get_element_text(el).lower()
            attrs = str(self._get_element_attributes(el)).lower()
            tag = self._get_element_tag(el).lower()
            selector = self._get_element_selector(el).lower()  # Also search in selector
            
            if tag_filter and tag != tag_filter:
                continue
                
            for keyword in keywords:
                # Search in text, attributes, AND selector
                if keyword in text or keyword in attrs or keyword in selector:return el
            
            # Log elements being checked (first 5 only to avoid spam)
            if i < 5:return None
    
    def _find_element_by_text(self, elements: List[Any], target_text: str) -> Any:
        """Find element containing specific text"""
        target_lower = target_text.lower()
        
        for el in elements:
            text = self._get_element_text(el).lower()
            if target_lower in text:
                return el
        
        return None
    
    def _get_element_id(self, element: Any) -> str:
        """Get element ID for targeting"""
        if hasattr(element, 'element_id'):
            return element.element_id
        return element.get("id", f"el_{int(time.time()*1000)}")
    
    def _get_element_selector(self, element: Any) -> str:
        """Get element selector based on current policy preference - uses repository selectors"""
        
        try:
            # Get both selectors from element repository
            css_selector = None
            xpath_selector = None
            
            # Extract CSS selector
            if hasattr(element, 'selector_css') and element.selector_css:
                css_selector = element.selector_css
            elif hasattr(element, 'css_selector') and element.css_selector:
                css_selector = element.css_selector
            elif isinstance(element, dict):
                css_selector = element.get('css_selector') or element.get('selector')
            
            # Extract XPath selector  
            if hasattr(element, 'selector_xpath') and element.selector_xpath:
                xpath_selector = element.selector_xpath
            elif hasattr(element, 'xpath_selector') and element.xpath_selector:
                xpath_selector = element.xpath_selector
            elif isinstance(element, dict):
                xpath_selector = element.get('xpath_selector') or element.get('xpath')
            
            # Apply policy preference
            cached_preference = getattr(self, '_cached_policy_preference', 'css')
            prefer_css = (cached_preference == 'css')
            
            # Choose selector based on policy and availability
            if prefer_css and css_selector: 
                {css_selector}
                return css_selector
            elif not prefer_css and xpath_selector: 
                {xpath_selector}
                return xpath_selector
            elif css_selector:  # Fallback to available CSS
                return css_selector
            elif xpath_selector:  # Fallback to available XPath
                return xpath_selector
            else:
                # Last resort fallback
                element_id = getattr(element, 'element_id', 'unknown')
                fallback_selector = f"#{element_id}" if prefer_css else f"//*[@id='{element_id}']"
                return fallback_selector
                
        except Exception as e:return f"[data-testid='unknown']"
    
    def _css_to_xpath_simple(self, css_selector: str) -> str:
        """Simple CSS to XPath conversion for policy compliance"""
        try:
            if css_selector.startswith('#'):
                # ID selector: #id -> //*[@id='id']
                element_id = css_selector[1:]
                return f"//*[@id='{element_id}']"
            elif css_selector.startswith('.'):
                # Class selector: .class -> //*[contains(@class,'class')]
                class_name = css_selector[1:]
                return f"//*[contains(@class,'{class_name}')]"
            elif css_selector.startswith('[data-testid='):
                # Data testid: [data-testid='value'] -> //*[@data-testid='value']
                testid = css_selector.split("'")[1]
                return f"//*[@data-testid='{testid}']"
            else:
                # For other selectors, wrap in generic XPath
                return f"//*[@data-testid='{css_selector}']"
        except Exception:
            return f"//*[@data-testid='{css_selector}']"
    
    def _cache_policy_preference(self, prefer_css: bool):
        """Cache the policy preference for sync selector generation"""
        self._cached_policy_preference = "css" if prefer_css else "xpath"
    
    async def _get_policy_based_element_selector(self, element: Any) -> str:
        """Get element selector respecting CSS vs XPath policy preference"""
        try:
            # Get current policy configuration
            from core.database import get_database
            db = await get_database()
            
            policy_query = """
            SELECT context FROM policy.policy_decisions 
            WHERE context->>'config_type' = 'dashboard_config'
            ORDER BY created_at DESC
            LIMIT 1
            """
            policy_result = await db.execute_one(policy_query)
            
            # Default to CSS preference
            prefer_css = True
            
            if policy_result and policy_result.get("context"):
                import json
                config_data = json.loads(policy_result["context"])
                locator_healing = config_data.get("configurations", {}).get("locatorHealing", {})
                prefer_css = locator_healing.get("preferCssOverXpath", True)
            
            # Get both selectors if available
            css_selector = ""
            xpath_selector = ""
            
            if hasattr(element, 'selector_css'):
                css_selector = element.selector_css or ""
            else:
                css_selector = element.get("css_selector", "") or element.get("selector", "")
            
            if hasattr(element, 'selector_xpath'):
                xpath_selector = element.selector_xpath or ""
            else:
                xpath_selector = element.get("xpath_selector", "") or element.get("xpath", "")
            
            # Apply policy preference
            if prefer_css and css_selector:
                return css_selector
            elif not prefer_css and xpath_selector:
                return xpath_selector
            elif css_selector:
                return css_selector
            elif not prefer_css and xpath_selector:
                return xpath_selector
            elif css_selector:
                return css_selector
            elif xpath_selector:
                return xpath_selector
            elif css_selector:
                return css_selector
            elif xpath_selector:
                return xpath_selector
            else:
                # Generate basic selectors if none exist
                if prefer_css:
                    element_id = self._get_element_id(element)
                    if element_id:
                        return f"#{element_id}"
                    else:
                        tag = self._get_element_tag(element)
                        return f"{tag}"
                else:
                    element_id = self._get_element_id(element)
                    if element_id:
                        return f"//*[@id='{element_id}']"
                    else:
                        tag = self._get_element_tag(element)
                        return f"//{tag}"
                        
        except Exception as e:# Fallback to original logic
            if hasattr(element, 'selector_css'):
                return element.selector_css or ""
            return element.get("css_selector", "") or element.get("selector", "")
    
    def _get_element_tag(self, element: Any) -> str:
        """Get element tag name"""
        if hasattr(element, 'tag'):
            return element.tag
        return element.get("tag", "div")
    
    def _get_element_text(self, element: Any) -> str:
        """Get element text content"""
        if hasattr(element, 'text'):
            return element.text or ""
        return element.get("text", "") or ""
    
    def _get_element_attributes(self, element: Any) -> Dict[str, Any]:
        """Get element attributes"""
        if hasattr(element, 'attributes'):
            return element.attributes
        return element.get("attributes", {})
    
    def _extract_search_term(self, prompt: str) -> Optional[str]:
        """Extract search term from prompt"""
        patterns = [
            r'search for "([^"]+)"',
            r'search "([^"]+)"',
            r'find "([^"]+)"',
            r'look for "([^"]+)"'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, prompt, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_link_text(self, prompt: str) -> Optional[str]:
        """Extract link text from prompt"""
        patterns = [
            r'click "([^"]+)"',
            r'click on "([^"]+)"',
            r'navigate to "([^"]+)"',
            r'go to "([^"]+)"'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, prompt, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_url_from_prompt(self, prompt: str) -> Optional[str]:
        """Extract URL from prompt"""
        import re
        
        # Look for common URL patterns in prompts
        patterns = [
            r'go to (https?://[^\s]+)',
            r'navigate to (https?://[^\s]+)', 
            r'visit (https?://[^\s]+)',
            r'open (https?://[^\s]+)',
            r'at (https?://[^\s]+)',
            r'on (https?://[^\s]+)',
            r'(https?://[^\s]+)',  # Any URL in the prompt
        ]
        
        for pattern in patterns:
            match = re.search(pattern, prompt, re.IGNORECASE)
            if match:
                url = match.group(1)
                # Basic URL validation
                if url.startswith(('http://', 'https://')):
                    return url
        
        return None
    
    def _create_budget_exceeded_response(self, budget_info: Dict[str, Any], start_time: float) -> PlanResponse:
        """Create response for budget exceeded scenario"""
        return PlanResponse(
            steps=[],
            clarifications=[
                Clarification(
                    type="budget_exceeded",
                    message=f"Daily token budget exceeded. Used: {budget_info['daily_used']}, Limit: {budget_info['daily_limit']}",
                    required=True
                )
            ],
            cost_summary=CostSummary(
                daily_tokens_used=budget_info['daily_used'],
                daily_budget_remaining=budget_info['daily_remaining']
            ),
            processing_time_ms=int((time.time() - start_time) * 1000),
            method="budget_check_failed"
        )
    
    async def generate_minimal_reproduction_steps(
        self,
        execution_id: str,
        execution_context: Dict[str, Any],
        all_steps: List[Any],
        failed_steps: List[Any],
        optimization_level: str = "moderate",
        preserve_context: bool = True
    ) -> Dict[str, Any]:
        """
        Generate minimal reproduction steps using AI analysis.
        Analyzes the execution flow and identifies the minimum steps needed to reproduce the failure.
        """
        try:
            # Build context for AI analysis
            context_prompt = f"""
Analyze this failed test execution and identify which ORIGINAL steps are essential for reproducing the failure:

EXECUTION CONTEXT:
- Test Purpose: {execution_context.get('prompt_text', 'Unknown')}
- Total Steps: {execution_context.get('total_steps', 0)}
- Failed Steps: {execution_context.get('failed_steps_count', 0)}

OPTIMIZATION LEVEL: {optimization_level}
PRESERVE CONTEXT: {preserve_context}

ALL STEPS EXECUTED (WITH ORIGINAL SELECTORS):
"""
            
            for i, step in enumerate(all_steps):
                status_indicator = "❌" if step.get("status") == "failed" else "✅" if step.get("status") == "passed" else "⏸️"
                context_prompt += f"\n{i+1}. {status_indicator} [{step.get('step_order')}] {step.get('action', 'unknown')} on '{step.get('target', 'unknown')}'"
                if step.get("error_message") and step.get("status") == "failed":
                    context_prompt += f" - ERROR: {step.get('error_message')}"
            
            context_prompt += f"""

CRITICAL REQUIREMENT: You must return the EXACT ORIGINAL STEPS (step_order numbers) that are essential for reproducing the failure.
DO NOT generate new steps or modify the action/target values - only identify which existing steps are needed.

ANALYSIS TASK:
1. Identify the critical path that leads to the failure
2. Remove unnecessary steps (redundant navigation, non-essential assertions)
3. Keep only steps that are essential for reproducing the failure state
4. Maintain logical flow and necessary setup steps
5. Optimization level "{optimization_level}": 
   - conservative: Keep more context steps (70-80% reduction)
   - moderate: Balance between context and efficiency (50-70% reduction) 
   - aggressive: Minimal steps only (30-50% reduction)

Generate a JSON response with:
{{
  "essentialStepOrders": [1, 3, 5, 7],
  "analysisReport": {{
    "criticalPath": ["step types that are essential"],
    "removedSteps": ["step types that were removed"],
    "reasoning": "explanation of why these specific steps reproduce the failure"
  }}
}}

IMPORTANT: Return only the step_order numbers of the original steps that are essential. The original step data will be preserved exactly as-is.
"""
            
            # Use AI to analyze and generate minimal steps
            if not self.client:
                # Fallback to heuristic approach if AI is not available
                return self._generate_heuristic_minimal_repro(all_steps, failed_steps, optimization_level)
            
            response = await self._chat_json(
                model=self.config["openai"]["model"],
                system="You are an expert test automation engineer specializing in failure analysis and test optimization. You select which original test steps are essential for reproducing failures.",
                user=context_prompt,
                max_tokens=2000,
                temperature=0.1,
                retries=3,
                timeout_ms=90000
            )
            
            analysis_result = json.loads(response)
            essential_step_orders = analysis_result.get("essentialStepOrders", [])
            analysis_report = analysis_result.get("analysisReport", {})
            
            # Extract the original steps that were identified as essential
            essential_steps = []
            step_order_to_step = {step.get("step_order"): step for step in all_steps}
            
            for step_order in essential_step_orders:
                if step_order in step_order_to_step:
                    original_step = step_order_to_step[step_order]
                    
                    # Create the essential step with all necessary data preserved
                    essential_step = {
                        "step_order": original_step.get("step_order"),
                        "action": original_step.get("action"),
                        "target": original_step.get("target"),
                        "text_value": original_step.get("text_value", ""),  # Include text values for typing
                        "status": original_step.get("status"),
                        "originalStepId": str(original_step.get("id", ""))
                    }
                    
                    essential_steps.append(essential_step)
            
            # Calculate metrics
            original_count = len(all_steps)
            reduced_count = len(essential_steps)
            reduction_percentage = (1 - reduced_count / original_count) if original_count > 0 else 0
            
            # Estimate reproduction guarantee based on steps included
            confidence = min(0.95, 0.6 + (reduced_count / original_count) * 0.35)
            
            return {
                "success": True,
                "minimalSteps": essential_steps,
                "originalStepsCount": original_count,
                "reducedStepsCount": reduced_count,
                "reproductionGuarantee": confidence,
                "analysisReport": analysis_report
            }
            
        except Exception as e:
            return self._generate_heuristic_minimal_repro(all_steps, failed_steps, optimization_level)
    
    def _generate_heuristic_minimal_repro(
        self,
        all_steps: List[Any],
        failed_steps: List[Any],
        optimization_level: str
    ) -> Dict[str, Any]:
        """
        Fallback heuristic approach for minimal reproduction when AI is unavailable.
        Returns original steps based on heuristic rules.
        """
        failed_step_numbers = set()
        for step in failed_steps:
            if not isinstance(step, dict):
                continue
            step_order = step.get("step_order", step.get("step_index", 0))
            try:
                failed_step_numbers.add(int(step_order or 0))
            except (TypeError, ValueError):
                continue
        
        # Heuristic rules based on optimization level
        essential_actions = {"open_url", "click", "type", "select"}
        setup_actions = {"wait", "navigate", "wait_for"}
        verification_actions = {"assert", "verify", "check"}
        
        essential_steps = []
        
        for step in all_steps:
            if not isinstance(step, dict):
                continue

            step_number_raw = step.get("step_order", 0)
            try:
                step_number = int(step_number_raw or 0)
            except (TypeError, ValueError):
                step_number = 0

            action = str(step.get("action", "")).lower()
            
            include_step = False
            
            # Always include failed steps and preceding setup
            if step_number in failed_step_numbers:
                include_step = True
            
            # Include essential actions (navigation, input)
            elif any(essential_action in action for essential_action in essential_actions):
                include_step = True
            
            # Include setup steps based on optimization level
            elif any(setup_action in action for setup_action in setup_actions):
                if optimization_level == "conservative":
                    include_step = True
                elif optimization_level == "moderate" and failed_step_numbers and step_number <= max(failed_step_numbers):
                    include_step = True
            
            # Skip most verification steps unless conservative
            elif any(verify_action in action for verify_action in verification_actions):
                if optimization_level == "conservative":
                    include_step = True
            
            if include_step:
                essential_steps.append({
                    "step_order": step.get("step_order"),
                    "action": step.get("action"),
                    "target": step.get("target"),
                    "text_value": step.get("text_value", ""),  # Include text values for typing
                    "status": step.get("status"),
                    "originalStepId": str(step.get("id", ""))
                })
        
        return {
            "success": True,
            "minimalSteps": essential_steps,
            "originalStepsCount": len(all_steps),
            "reducedStepsCount": len(essential_steps),
            "reproductionGuarantee": 0.75,
            "analysisReport": {
                "criticalPath": ["heuristic analysis"],
                "removedSteps": ["verification steps", "redundant navigation"],
                "reasoning": f"Heuristic approach using {optimization_level} optimization level"
            }
        }
    
    async def generate_element_failure_recommendations(
        self,
        element_id: str,
        failure_data: Dict[str, Any]
    ) -> List[str]:
        """
        Generate AI-powered recommendations for element failure patterns.
        """
        try:
            if not self.client:
                return self._generate_heuristic_failure_recommendations(failure_data)
            
            context_prompt = f"""
Analyze failure patterns for UI element "{element_id}" and provide specific recommendations:

FAILURE ANALYSIS DATA:
- Total Failures: {failure_data.get('total_failures', 0)} over {failure_data.get('time_period_days', 30)} days
- Error Patterns: {list(failure_data.get('error_patterns', {}).keys())[:5]}
- Action Patterns: {list(failure_data.get('action_patterns', {}).keys())}

TOP ERRORS:
"""
            
            for error, count in list(failure_data.get('error_patterns', {}).items())[:3]:
                context_prompt += f"\n- {error} (occurred {count} times)"
            
            context_prompt += """

Generate 3-6 specific, actionable recommendations to improve element stability and reduce failures.
Focus on practical solutions like:
- Selector improvements (if selectors are weak)
- Wait strategies (if timing issues)
- Error handling (if environmental issues)
- Test design changes (if test logic issues)
- Element identification improvements

Return a JSON array of recommendation strings.
"""
            
            response = await self._chat_json(
                model=self.config["openai"]["model"],
                system="You are a senior QA automation engineer providing specific technical recommendations to fix test failures.",
                user=context_prompt,
                max_tokens=800,
                temperature=0.2
            )
            
            recommendations = json.loads(response)
            if isinstance(recommendations, list):
                return recommendations[:6]  # Limit to 6 recommendations
            else:
                return ["AI analysis completed but returned unexpected format"]
                
        except Exception as e:
            return self._generate_heuristic_failure_recommendations(failure_data)
    
    def _generate_heuristic_failure_recommendations(self, failure_data: Dict[str, Any]) -> List[str]:
        """Fallback heuristic recommendations when AI is unavailable."""
        recommendations = []
        total_failures = failure_data.get('total_failures', 0)
        
        if total_failures > 10:
            recommendations.append("🔧 High failure rate detected - consider reviewing element selector stability")
        
        error_patterns = failure_data.get('error_patterns', {})
        if any("timeout" in error.lower() for error in error_patterns.keys()):
            recommendations.append("⏱️ Timeout errors detected - add explicit wait conditions before interacting with this element")
        
        if any("not found" in error.lower() or "no such element" in error.lower() for error in error_patterns.keys()):
            recommendations.append("🎯 Element not found errors - verify selector stability and consider alternative locator strategies")
        
        action_patterns = failure_data.get('action_patterns', {})
        if "click" in action_patterns and action_patterns["click"]["count"] > 5:
            recommendations.append("🖱️ Click action failures detected - ensure element is visible and clickable before interaction")
        
        if len(recommendations) == 0:
            recommendations.append("📊 Monitor element stability and consider adding additional error handling")
        
        return recommendations

    def _create_error_response(self, error_message: str, start_time: float) -> PlanResponse:
        """Create response for error scenarios"""
        logger.error(f"🚨 Creating error response: {error_message}")
        return PlanResponse(
            steps=[],
            clarifications=[
                Clarification(
                    type="generation_error",
                    message=f"Failed to generate test plan: {error_message}",
                    required=True
                )
            ],
            cost_summary=CostSummary(),
            processing_time_ms=int((time.time() - start_time) * 1000),
            method="error"
        )
    
    async def _chat_json(
        self,
        model: str,
        system: str,
        user: str,
        max_tokens: int,
        temperature: float,
        retries: int,
        timeout_ms: int,
    ) -> str:
        """Call AI provider with JSON response format - supports OpenAI, Anthropic, and Ollama"""
        current_provider = self.config.get("current_provider", "openai")
        logger.debug(f" Starting AI completion: provider={current_provider}, model={model}, max_tokens={max_tokens}")
        
        # Route to appropriate provider
        if current_provider == "ollama" and self.ollama_client:
            ollama_config = self.config.get("ollama", {})
            return await self._chat_json_ollama(
                ollama_config.get("model", model), 
                system,
                user,
                max_tokens,
                temperature,
                max(retries, int(ollama_config.get("maxRetries", retries))),
                ollama_config.get("timeout", timeout_ms)
            )
        elif current_provider == "anthropic" and self.anthropic_client:
            return await self._chat_json_anthropic(model, system, user, max_tokens, temperature, retries, timeout_ms)
        elif current_provider == "openai" and self.client:
            return await self._chat_json_openai(model, system, user, max_tokens, temperature, retries, timeout_ms)
        else:
            logger.error(f"❌ No available AI client for provider: {current_provider}")
            raise RuntimeError(f"AI provider '{current_provider}' not available")

    async def _chat_json_openai(
        self,
        model: str,
        system: str,
        user: str,
        max_tokens: int,
        temperature: float,
        retries: int,
        timeout_ms: int,
    ) -> str:
        """Call OpenAI Chat Completions with JSON response format"""
        logger.debug(f" Starting OpenAI chat completion: model={model}, max_tokens={max_tokens}")
        
        if not self.client:
            logger.error("❌ OpenAI client not initialized")
            raise RuntimeError("OpenAI client not initialized")

        def _call():
            # Enforce rate limiting before making the call
            self._enforce_rate_limit()
            return self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                response_format={"type": "json_object"},
                timeout=timeout_ms / 1000.0 if timeout_ms else None,
            )

        attempt = 0
        last_err: Optional[Exception] = None
        
        while attempt <= retries:
            try:
                attempt += 1
                logger.debug(f"🔄 OpenAI API attempt {attempt}/{retries+1}")
                
                resp = await asyncio.to_thread(_call)
                content = resp.choices[0].message.content if resp and resp.choices else ""
                
                logger.info(f"✅ OpenAI API call successful on attempt {attempt}")
                return content or ""
                
            except Exception as e:
                last_err = e
                error_msg = str(e).lower()
                
                # Enhanced error logging with specific handling for common issues
                if "401" in error_msg or "unauthorized" in error_msg:
                    logger.error(f"🔐 OpenAI API authentication failed (401): {str(e)}")
                    logger.error("💡 Check OpenAI API key configuration and billing status")
                elif "429" in error_msg or "rate limit" in error_msg:
                    logger.warning(f"⚠️ OpenAI API rate limit hit: {str(e)}")
                elif "timeout" in error_msg or "timed out" in error_msg:
                    logger.warning(f"⏱️ OpenAI API timeout: {str(e)}")
                    logger.warning(f"💡 Request took longer than {timeout_ms}ms. Consider increasing timeout_ms or reducing prompt size.")
                elif "connection" in error_msg or "network" in error_msg:
                    logger.error(f"🌐 Network connectivity issue: {str(e)}")
                    logger.error("💡 Check internet connection and firewall settings")
                else:
                    logger.error(f"❌ OpenAI API error: {str(e)}")
                
                if attempt > retries:
                    logger.error(f"💥 All {retries+1} OpenAI API attempts exhausted")
                    break
                    
                # Exponential backoff with jitter
                sleep_time = min(2.0 * attempt, 5.0)
                logger.debug(f"😴 Retrying in {sleep_time}s...")
                await asyncio.sleep(sleep_time)
        
        # Final error handling with specific auth guidance        
        if last_err and ("401" in str(last_err).lower() or "unauthorized" in str(last_err).lower()):
            raise RuntimeError(f"OpenAI API authentication failed: {last_err}. Check API key and billing status.")
        else:
            raise RuntimeError(f"OpenAI call failed after {retries+1} attempts: {last_err}")

    async def _chat_json_anthropic(
        self,
        model: str,
        system: str,
        user: str,
        max_tokens: int,
        temperature: float,
        retries: int,
        timeout_ms: int,
    ) -> str:
        """Call Anthropic Claude with structured response"""
        logger.debug(f" Starting Anthropic completion: model={model}, max_tokens={max_tokens}")
        
        if not self.anthropic_client:
            logger.error("❌ Anthropic client not initialized")
            raise RuntimeError("Anthropic client not initialized")

        # Add JSON formatting instruction to the user prompt
        json_instruction = "\\n\\nPlease respond with valid JSON only. Do not include any text outside the JSON structure."
        user_with_json = user + json_instruction

        def _call():
            # Enforce rate limiting before making the call
            self._enforce_rate_limit()
            return self.anthropic_client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system,
                messages=[
                    {"role": "user", "content": user_with_json}
                ],
                timeout=timeout_ms / 1000.0 if timeout_ms else None,
            )

        attempt = 0
        last_err: Optional[Exception] = None
        
        while attempt <= retries:
            try:
                attempt += 1
                logger.debug(f"🔄 Anthropic API attempt {attempt}/{retries+1}")
                
                resp = await asyncio.to_thread(_call)
                content = resp.content[0].text if resp and resp.content else ""
                
                # Clean up the response to extract JSON
                if content:
                    # Try to extract JSON from the response
                    import re
                    json_match = re.search(r'\\{.*\\}', content, re.DOTALL)
                    if json_match:
                        content = json_match.group(0)
                
                logger.info(f"✅ Anthropic API call successful on attempt {attempt}")
                return content or ""
                
            except Exception as e:
                last_err = e
                error_msg = str(e).lower()
                
                # Enhanced error logging with specific handling for common issues
                if "401" in error_msg or "unauthorized" in error_msg:
                    logger.error(f"🔐 Anthropic API authentication failed (401): {str(e)}")
                    logger.error("💡 Check Anthropic API key configuration")
                elif "429" in error_msg or "rate limit" in error_msg:
                    logger.warning(f"⚠️ Anthropic API rate limit hit: {str(e)}")
                elif "timeout" in error_msg:
                    logger.warning(f"⏱️ Anthropic API timeout: {str(e)}")
                else:
                    logger.error(f"❌ Anthropic API error: {str(e)}")
                
                if attempt > retries:
                    logger.error(f"💥 All {retries+1} Anthropic API attempts exhausted")
                    break
                    
                # Exponential backoff with jitter
                sleep_time = min(2.0 * attempt, 5.0)
                logger.debug(f"😴 Retrying in {sleep_time}s...")
                await asyncio.sleep(sleep_time)
        
        # Final error handling with specific auth guidance        
        if last_err and ("401" in str(last_err).lower() or "unauthorized" in str(last_err).lower()):
            raise RuntimeError(f"Anthropic API authentication failed: {last_err}. Check API key configuration.")
        else:
            raise RuntimeError(f"Anthropic call failed after {retries+1} attempts: {last_err}")

    async def _chat_json_ollama(
        self,
        model: str,
        system: str,
        user: str,
        max_tokens: int,
        temperature: float,
        retries: int,
        timeout_ms: int,
    ) -> str:
        """Call Ollama with JSON response format using OpenAI-compatible API"""
        logger.debug(f" Starting Ollama chat completion: model={model}, max_tokens={max_tokens}")

        ollama_config = self.config.get("ollama", {})
        configured_base = ollama_config.get("baseUrl")
        env_base = os.getenv("OLLAMA_BASE_URL")

        # Try configured endpoint first, then common host/container fallbacks.
        base_url_candidates = []
        for candidate in [
            configured_base,
            env_base,
            "http://host.docker.internal:11434",
            "http://localhost:11434",
        ]:
            if not candidate:
                continue
            normalized = str(candidate).rstrip("/")
            if normalized not in base_url_candidates:
                base_url_candidates.append(normalized)

        if not base_url_candidates:
            logger.error("❌ No Ollama base URL configured")
            raise RuntimeError("No Ollama base URL configured. Set endpoint_url in provider settings or OLLAMA_BASE_URL.")

        # Add JSON formatting instruction to the user prompt for better compliance
        json_instruction = "\n\nIMPORTANT: You must respond with valid JSON only. Do not include any text, explanation, or markdown code blocks outside the JSON structure. Start directly with { and end with }."
        user_with_json = user + json_instruction

        def _call(client):
            # Enforce rate limiting before making the call
            self._enforce_rate_limit()
            return client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system + "\nYou must respond with valid JSON only."},
                    {"role": "user", "content": user_with_json},
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                # Note: Ollama may not support response_format, so we rely on prompt instructions
            )

        attempt = 0
        last_err: Optional[Exception] = None
        total_attempts = max(retries + 1, len(base_url_candidates))
        candidate_index = 0
        
        while attempt < total_attempts:
            try:
                attempt += 1
                base_url = base_url_candidates[candidate_index]
                logger.debug(f"🔄 Ollama API attempt {attempt}/{total_attempts} (base_url={base_url})")

                client = OpenAI(
                    base_url=f"{base_url}/v1",
                    api_key="ollama",
                    max_retries=0,
                    timeout=max(timeout_ms / 1000.0 if timeout_ms else 60.0, 5.0),
                )
                
                resp = await asyncio.to_thread(_call, client)
                content = resp.choices[0].message.content if resp and resp.choices else ""
                
                # Clean up the response to extract JSON (Ollama models may include extra text)
                if content:
                    content = content.strip()
                    # Remove markdown code blocks if present
                    if content.startswith("```json"):
                        content = content[7:]
                    elif content.startswith("```"):
                        content = content[3:]
                    if content.endswith("```"):
                        content = content[:-3]
                    content = content.strip()
                    
                    # Try to extract JSON from the response
                    json_match = re.search(r'\{.*\}', content, re.DOTALL)
                    if json_match:
                        content = json_match.group(0)
                
                logger.info(f"✅ Ollama API call successful on attempt {attempt}")
                return content or ""
                
            except Exception as e:
                last_err = e
                error_msg = str(e).lower()
                
                # Enhanced error logging with specific handling for common issues
                if "connection" in error_msg or "refused" in error_msg:
                    logger.error(f"🔌 Ollama connection failed: {str(e)}")
                    logger.error("💡 Ensure Ollama is running: 'ollama serve' or check OLLAMA_BASE_URL")
                    # Try the next candidate host when connection fails.
                    if candidate_index < len(base_url_candidates) - 1:
                        candidate_index += 1
                elif "timeout" in error_msg or "timed out" in error_msg:
                    logger.warning(f"⏱️ Ollama timeout: {str(e)}")
                    logger.warning(f"💡 Local inference can be slow. Consider increasing OLLAMA_TIMEOUT_MS or using a smaller model.")
                elif "model" in error_msg and ("not found" in error_msg or "does not exist" in error_msg):
                    logger.error(f"📦 Ollama model not found: {str(e)}")
                    logger.error(f"💡 Pull the model first: 'ollama pull {model}'")
                else:
                    logger.error(f"❌ Ollama API error: {str(e)}")
                
                if attempt >= total_attempts:
                    logger.error(f"💥 All {total_attempts} Ollama API attempts exhausted")
                    break
                    
                # Exponential backoff with jitter
                sleep_time = min(2.0 * attempt, 5.0)
                logger.debug(f"😴 Retrying in {sleep_time}s...")
                await asyncio.sleep(sleep_time)
        
        # Final error handling
        raise RuntimeError(f"Ollama call failed after {total_attempts} attempts: {last_err}")

    async def analyze_prompt_intent(self, prompt: str, available_elements: List[Any]) -> Dict[str, Any]:
        """Phase 1: Analyze prompt to identify required pages and elements"""
        
        # Extract unique page names from elements
        element_pages = set()
        element_summaries = []
        
        for el in available_elements[:20]:  # Limit for analysis
            # Handle both dict and PageElement objects
            page = 'unknown'
            if hasattr(el, 'attributes') and el.attributes and el.attributes.get('page'):
                page = el.attributes.get('page', 'unknown')
            elif hasattr(el, 'get') and el.get('page'):
                page = el.get('page', 'unknown')
            element_pages.add(page)
            
            # Build element summary for AI analysis
            if hasattr(el, 'tag'):
                tag = getattr(el, 'tag', 'div')
                selector = getattr(el, 'selector_css', '') or getattr(el, 'selector_xpath', '')
                text = getattr(el, 'text', '')
            else:
                tag = el.get('tag', 'div') if hasattr(el, 'get') else 'div'
                selector = el.get('selector_css', '') or el.get('selector_xpath', '') if hasattr(el, 'get') else ''
                text = el.get('text', '') if hasattr(el, 'get') else ''
            element_summaries.append(f"{page}: {tag} {selector} {text[:30] if text else ''}")
        
        # Build AI prompt for intent analysis
        analysis_prompt = f'''
Analyze this test request and identify which pages/contexts are needed:

REQUEST: {prompt}

AVAILABLE PAGES: {', '.join(element_pages)}

SAMPLE ELEMENTS:
{chr(10).join(element_summaries[:15])}

Return JSON with:
{{
  "target_pages": ["list", "of", "required", "pages"],
  "primary_page": "main page for this test",
  "workflow": "brief description of user flow",
  "key_elements": ["element", "types", "needed"]
}}
'''

        try:
            response = await self._chat_json(
                model=self.config["openai"]["model"],
                system="You are a test analysis expert. Analyze test requests to identify required pages and elements.",
                user=analysis_prompt,
                max_tokens=500,
                temperature=0.1,
                retries=2,
                timeout_ms=10000
            )

            intent = json.loads(response)

            return intent
            
        except Exception as e:return {
                "target_pages": list(element_pages),
                "primary_page": list(element_pages)[0] if element_pages else "unknown",
                "workflow": "Standard test workflow",
                "key_elements": ["buttons", "links", "forms"]
            }
        
    async def fetch_smart_page_context(self, intent_analysis: Dict[str, Any], prompt: str) -> Optional[Dict[str, Any]]:
        """Phase 2: Intelligently fetch matching page context based on intent analysis"""
        
        try:
            # Get page contexts from database
            db = await get_database()
            
            # Fetch all page contexts to find best matches
            contexts_query = """
            SELECT id, website_url, category, description, 
                   primary_actions, created_at, screenshot_url
            FROM repo.page_contexts 
            ORDER BY created_at DESC
            LIMIT 50
            """
            
            contexts = await db.execute(contexts_query)
            
            if not contexts:
                return None
            
            # Smart matching logic
            target_pages = intent_analysis.get('target_pages', [])
            primary_page = intent_analysis.get('primary_page', '')
            
            best_match = None
            best_score = 0
            
            for ctx in contexts:
                score = 0
                page_url = ctx.get('website_url', '')
                page_desc = ctx.get('description', '')
                
                # URL matching (highest priority)
                if page_url and primary_page:
                    if primary_page.lower() in page_url.lower() or page_url.lower() in primary_page.lower():
                        score += 10
                
                # Description keyword matching
                if page_desc:
                    prompt_words = set(prompt.lower().split())
                    desc_words = set(page_desc.lower().split())
                    overlap = len(prompt_words.intersection(desc_words))
                    score += min(overlap * 0.5, 3)
                
                # SauceDemo specific matching
                if 'saucedemo' in prompt.lower() and 'saucedemo' in page_url.lower():
                    score += 8
                
                if 'inventory' in prompt.lower() and 'inventory' in (page_url + page_desc).lower():
                    score += 6
                
                if score > best_score:
                    best_score = score
                    best_match = ctx
            
            if best_match and best_score > 3:  # Minimum threshold}' (score: {best_score})")
                
                # Convert to PageContext format
                return {
                    'page_type': best_match.get('category'),
                    'page_title': best_match.get('category', ''),
                    'page_description': best_match.get('description'),
                    'primary_actions': best_match.get('primary_actions', []),
                    'testing_focus': '',
                    'user_notes': '',
                    'domain_name': best_match.get('website_url', '').split('/')[-1] if best_match.get('website_url') else None,
                    'screenshot_url': best_match.get('screenshot_url').replace('\\', '/') if best_match.get('screenshot_url') else None
                }
            else:
                return None
                
        except Exception as e:
            return None

# =========================
# FASTAPI ROUTER INTEGRATION
# =========================

from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import JSONResponse
import gzip

router = APIRouter(tags=["ai"])

# Global service instance
enterprise_ai_service = EnterpriseAIService()

# =========================
# LEGACY AI SERVICE FOR BACKWARD COMPATIBILITY  
# =========================

class AIService:
    """Legacy AI Service for backward compatibility"""
    
    def __init__(self) -> None:
        self.enterprise_service = EnterpriseAIService()
    
    async def analyze_prompt_intent(self, prompt: str, available_elements: List[Any]) -> Dict[str, Any]:
        """Phase 1: Analyze prompt to identify required pages and elements"""
        
        # Extract unique page names from elements
        element_pages = set()
        element_summaries = []
        
        for el in available_elements[:20]:  # Limit for analysis
            page = getattr(el, 'page', None) or el.get('page', 'unknown')
            element_pages.add(page)
            
            # Build element summary for AI analysis
            tag = self._get_element_tag(el)
            selector = self._get_element_selector(el)
            text = self._get_element_text(el)
            element_summaries.append(f"{page}: {tag} {selector} {text[:30] if text else ''}")
        
        # Build AI prompt for intent analysis
        analysis_prompt = f'''
Analyze this test request and identify which pages/contexts are needed:

REQUEST: {prompt}

AVAILABLE PAGES: {', '.join(element_pages)}

SAMPLE ELEMENTS:
{chr(10).join(element_summaries[:15])}

Return JSON with:
{{
  "target_pages": ["list", "of", "required", "pages"],
  "primary_page": "main page for this test",
  "workflow": "brief description of user flow",
  "key_elements": ["element", "types", "needed"]
}}
'''
        
        try:
            response = await self._chat_json(
                model=self.config["openai"]["model"],
                system="You are a test analysis expert. Analyze test requests to identify required pages and elements.",
                user=analysis_prompt,
                max_tokens=500,
                temperature=0.1,
                retries=2,
                timeout_ms=10000
            )
            
            intent = json.loads(response)
            
            return intent
            
        except Exception as e:return {
                "target_pages": list(element_pages),
                "primary_page": list(element_pages)[0] if element_pages else "unknown",
                "workflow": "Standard test workflow",
                "key_elements": ["buttons", "links", "forms"]
            }
        
    async def fetch_smart_page_context(self, intent_analysis: Dict[str, Any], prompt: str) -> Optional[Dict[str, Any]]:
        """Phase 2: Intelligently fetch matching page context based on intent analysis"""
        
        try:
            # Get page contexts from database
            db = await get_database()
            
            # Fetch all page contexts to find best matches
            contexts_query = """
            SELECT id, page_url, page_title, page_type, page_description, 
                   primary_actions, testing_focus, additional_notes, created_at
            FROM repo.page_contexts 
            ORDER BY created_at DESC
            LIMIT 50
            """
            
            contexts = await db.execute(contexts_query)
            
            if not contexts:
                return None  # No saved page contexts")
            
            # Smart matching logic
            target_pages = intent_analysis.get('target_pages', [])
            primary_page = intent_analysis.get('primary_page', '')
            
            best_match = None
            best_score = 0
            
            for ctx in contexts:
                score = 0
                page_url = ctx.get('page_url', '')
                page_title = ctx.get('page_title', '')
                page_desc = ctx.get('page_description', '')
                
                # URL matching (highest priority)
                if page_url and primary_page:
                    if primary_page.lower() in page_url.lower() or page_url.lower() in primary_page.lower():
                        score += 10
                
                # Page title/name matching
                if page_title:
                    for target_page in target_pages:
                        if target_page.lower() in page_title.lower() or page_title.lower() in target_page.lower():
                            score += 5
                
                # Description keyword matching
                if page_desc:
                    prompt_words = set(prompt.lower().split())
                    desc_words = set(page_desc.lower().split())
                    overlap = len(prompt_words.intersection(desc_words))
                    score += min(overlap * 0.5, 3)
                
                # SauceDemo specific matching
                if 'saucedemo' in prompt.lower() and 'saucedemo' in page_url.lower():
                    score += 8
                
                if 'inventory' in prompt.lower() and 'inventory' in (page_url + page_title + page_desc).lower():
                    score += 6
                
                if score > best_score:
                    best_score = score
                    best_match = ctx
            
            if best_match and best_score > 3:  # Minimum threshold}' (score: {best_score})")
                
                # Convert to PageContext format
                return {
                    'page_type': best_match.get('page_type'),
                    'page_title': best_match.get('page_title'),
                    'page_description': best_match.get('page_description'),
                    'primary_actions': best_match.get('primary_actions', []),
                    'testing_focus': best_match.get('testing_focus'),
                    'user_notes': best_match.get('additional_notes'),
                    'domain_name': best_match.get('page_url', '').split('/')[-1] if best_match.get('page_url') else None
                }
            else:
                return None
                
        except Exception as e:
            return None
        
    async def generate_test_steps(self, prompt: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Legacy method - converts to enterprise format"""
        options = options or {}
        
        # Convert legacy format to enterprise format
        prompt_envelope = PromptEnvelope(
            prompt=prompt,
            tenant_id=options.get("tenantId", "default"),
            max_steps=options.get("maxSteps", 20),
            include_screenshots=options.get("includeScreenshots", False),
            include_assertions=options.get("includeAssertions", True)
        )
        
        # Add elements if provided
        if options.get("availableElements"):
            from ..schemas.enterprise import PageElement, PageSlice, ElementRankingStrategy
            
            elements = []
            for i, el in enumerate(options["availableElements"]):
                # Use actual CSS selector as element_id if available
                css_selector = el.get("css_selector") or el.get("selector")
                xpath_selector = el.get("xpath_selector") or el.get("xpath")
                element_id = css_selector if css_selector else f"el_{i}"
                page_element = PageElement(
                    element_id=f"el_{i}",
                    tag=el.get("tag", "div"),
                    selector_css=el.get("css_selector") or el.get("selector"),
                    selector_xpath=el.get("xpath"),
                    text=el.get("text"),
                    attributes=el.get("attributes", {}),
                    is_interactive=el.get("isInteractive", False),
                    is_visible=el.get("isVisible", True)
                )
                elements.append(page_element)
            
            prompt_envelope.page_slice = PageSlice(
                slice_strategy=ElementRankingStrategy.TOP_K,
                k=len(elements),
                total_elements=len(elements),
                elements=elements
            )
        
        # Call enterprise service
        response = await self.enterprise_service.plan_test_steps(prompt_envelope)
        
        # Convert response to legacy format
        actions = []
        for step in response.steps:
            action = {
                "name": step.action,
                "params": step.args.copy()
            }
            if step.target:
                action["params"]["elementId"] = step.target
                
            actions.append(action)
        
        return {
            "plan": {
                "actions": actions,
                "meta": {
                    "prompt": prompt,
                    "version": "1.0.0",
                    "generatedAt": response.generated_at.isoformat(),
                    "method": response.method,
                    "processingTimeMs": response.processing_time_ms
                }
            }
        }
    
    async def generate_element_suggestions(self, dom_data: Dict[str, Any], options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Legacy method - simplified for compatibility"""
        elements = dom_data.get("elements", [])
        
        # Use enterprise ranking
        page_slice = self.enterprise_service.rank_page_elements(
            elements,
            ElementRankingStrategy.HEURISTIC_FILTER,
            options.get("maxSuggestions", 50) if options else 50
        )
        
        # Convert to legacy format
        suggestions = []
        for el in page_slice.elements:
            suggestion = {
                "elementId": el.element_id,
                "name": f"{el.tag.upper()} Element",
                "description": f"Interactive {el.tag} element",
                "xpath": el.selector_xpath or "",
                "locator": {
                    "css": el.selector_css or "",
                    "xpath": el.selector_xpath or ""
                },
                "category": "general",
                "confidence": el.relevance_score or 0.8,
                "attributes": el.attributes
            }
            suggestions.append(suggestion)
        
        return {
            "suggestions": suggestions,
            "reasoning": "Enterprise heuristic element analysis"
        }

@router.post("/analyze-intent")
async def analyze_intent_endpoint(request: Dict[str, Any]):
    """Phase 1: Analyze prompt intent to identify required pages"""
    try:
        prompt = request.get('prompt', '')
        available_elements = request.get('available_elements', [])
        
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")
        
        intent_analysis = await enterprise_ai_service.analyze_prompt_intent(prompt, available_elements)
        
        return {
            "success": True,
            "intent_analysis": intent_analysis
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Intent analysis failed: {str(e)}")

@router.post("/smart-page-context")
async def smart_page_context_endpoint(request: Dict[str, Any]):
    """Phase 2: Fetch intelligent page context based on intent analysis"""
    try:
        intent_analysis = request.get('intent_analysis', {})
        prompt = request.get('prompt', '')
        
        if not intent_analysis:
            raise HTTPException(status_code=400, detail="Intent analysis is required")
        
        page_context = await enterprise_ai_service.fetch_smart_page_context(intent_analysis, prompt)
        
        return {
            "success": True,
            "page_context": page_context
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Smart page context failed: {str(e)}")

@router.post("/v1/plan")
async def plan_endpoint(
    request: Dict[str, Any],
    if_none_match: Optional[str] = Header(None, alias="If-None-Match"),
    accept_encoding: Optional[str] = Header(None, alias="Accept-Encoding")
):
    """
    Enterprise /v1/plan endpoint implementing the Prompt/Actions/Elements contract.
    
    Accepts PromptEnvelope and returns PlanResponse with cost tracking.
    Supports ETag caching and gzip compression.
    """
    try:
        logger.info("📥 Received plan generation request")
        logger.debug(f"📋 Request payload keys: {list(request.keys())}")
        logger.debug(f"📦 Request size: {len(str(request))} characters")
        
        # Validate and parse request
        prompt_envelope = PromptEnvelope(**request)
        logger.info(f"✅ Request validation successful - Prompt: '{prompt_envelope.prompt[:50]}...', Tenant: {prompt_envelope.tenant_id}")
        
        # Generate plan
        response = await enterprise_ai_service.plan_test_steps(prompt_envelope)
        
        # Convert to dict for JSON response (with proper datetime serialization)
        response_dict = response.model_dump(mode='json')
        logger.info(f"📤 Sending response - Method: {response_dict.get('method')}, Steps: {len(response_dict.get('steps', []))}")
        
        # Add compression if requested and beneficial
        should_compress = (
            accept_encoding and "gzip" in accept_encoding.lower() and
            len(json.dumps(response_dict)) > 1024
        )
        
        if should_compress:
            response_dict["compressed"] = True
            logger.debug("🗜️  Response will be compressed")
            
        # Create JSON response with ETag
        json_response = JSONResponse(content=response_dict)
        
        # Add ETag header (based on response content hash)
        import hashlib
        content_str = json.dumps(response_dict, sort_keys=True)
        etag = hashlib.md5(content_str.encode()).hexdigest()[:16]
        json_response.headers["ETag"] = f'"{etag}"'
        json_response.headers["Cache-Control"] = "private, max-age=3600"
        
        logger.info("✅ Plan generation endpoint completed successfully")
        return json_response
        
    except Exception as e:
        logger.error(f"💥 Plan endpoint failed: {str(e)}")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Plan generation failed: {str(e)}")

@router.get("/v1/safety-policy")
async def get_safety_policy(
    current_user: Any = Depends(get_current_active_user)
):
    """
    Get the current safety policy configuration.
    Shows what destructive operations are blocked for non-admin users.
    """
    try:
        from core.safety_policy import safety_policy
        
        policy_summary = safety_policy.get_policy_summary()
        
        # Add user-specific information
        is_admin = await safety_policy.check_user_admin_status(current_user)
        
        return {
            "policy": policy_summary,
            "user_status": {
                "email": current_user.user.email,
                "is_admin": is_admin,
                "can_perform_destructive_operations": is_admin
            },
            "examples": {
                "blocked_for_non_admin": [
                    "delete all test data",
                    "remove all elements from page",
                    "cleanup database records", 
                    "purge old test results"
                ],
                "allowed_for_all": [
                    "click login button",
                    "type username in field",
                    "verify page title",
                    "extract price values"
                ]
            }
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Safety policy retrieval failed: {str(e)}")

@router.post("/v1/test-safety-policy")
async def test_safety_policy(
    request: Dict[str, Any],
    current_user = Depends(get_current_active_user)
):
    """
    Test endpoint to validate prompts against the safety policy.
    Use this to check if a prompt would be blocked before submitting to /v1/plan.
    """
    try:
        from core.safety_policy import safety_policy
        
        prompt_text = request.get("prompt", "")
        if not prompt_text:
            raise HTTPException(status_code=400, detail="Missing 'prompt' field in request")
        
        # Test the prompt
        try:
            await safety_policy.validate_prompt_content(current_user, prompt_text)
            
            return {
                "prompt": prompt_text,
                "safety_check": "PASSED",
                "message": "Prompt is allowed and will be processed normally",
                "user_is_admin": await safety_policy.check_user_admin_status(current_user)
            }
            
        except HTTPException as safety_error:
            return {
                "prompt": prompt_text,
                "safety_check": "BLOCKED",
                "message": safety_error.detail,
                "user_is_admin": await safety_policy.check_user_admin_status(current_user),
                "status_code": safety_error.status_code
            }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Safety policy test failed: {str(e)}")

@router.get("/v1/catalog/{catalog_id}/v/{version}")
async def get_catalog_endpoint(
    catalog_id: str,
    version: str,
    if_none_match: Optional[str] = Header(None, alias="If-None-Match"),
    tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")
):
    """
    Get action catalog with ETag caching support.
    Returns 304 Not Modified if ETag matches.
    """
    try:
        catalog, is_304, etag = await enterprise_ai_service.get_action_catalog(
            catalog_id, version, if_none_match, tenant_id
        )
        
        if is_304:
            response = JSONResponse(content={}, status_code=304)
            if etag:
                response.headers["ETag"] = etag
            return response
        
        if not catalog:
            raise HTTPException(status_code=404, detail=f"Catalog {catalog_id}:v{version} not found")
        
        response = JSONResponse(content=catalog.dict())
        if etag:
            response.headers["ETag"] = etag
            response.headers["Cache-Control"] = "public, max-age=86400"  # 24 hours
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to get catalog: {str(e)}")

@router.post("/generate-minimal-repro")
async def generate_minimal_reproduction_steps(
    request: Dict[str, Any],
    db: DatabaseManager = Depends(get_database_manager)
):
    """
    Generate minimal reproduction steps for a failed test execution using AI analysis.
    Analyzes failed steps and creates an optimized test path that reproduces the failure
    with the minimum number of steps necessary.
    """
    try:
        execution_id = request.get("execution_id")
        failed_steps = request.get("failed_steps", [])
        optimization_level = request.get("optimization_level", "moderate")
        preserve_context = request.get("preserve_context", True)
        
        if not execution_id or not failed_steps:
            raise HTTPException(status_code=400, detail="execution_id and failed_steps are required")
        
         # Get execution details and original plan data
         # Follow the relationship: exec.runs -> tests.test_cases -> planner.plans -> planner.prompts
        execution_query = """
        SELECT r.*, 
               p.text as prompt_text, 
               p.intent as prompt_title, 
               pl.plan_json
        FROM exec.runs r
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
         LEFT JOIN planner.plans pl ON tc.plan_id = pl.id
         LEFT JOIN planner.prompts p ON pl.prompt_id = p.id
        WHERE r.id = $1
        """
        execution = await db.execute_one(execution_query, execution_id)
        
        if not execution:
            raise HTTPException(status_code=404, detail=f"Execution {execution_id} not found")
        
        # Parse the original plan to get step data with text values
        original_plan_steps = []
        plan_json = execution.get('plan_json')
        if plan_json:
            if isinstance(plan_json, dict):
                plan_data = plan_json
            elif isinstance(plan_json, str):
                try:
                    plan_data = json.loads(plan_json)
                except Exception:
                    plan_data = {}
            else:
                plan_data = {}
            original_plan_steps = plan_data.get('steps', []) if isinstance(plan_data, dict) else []

        # Get all steps for this execution with current schema fields.
        steps_query = """
            SELECT id, step_order, action_data, status, error_details, created_at
            FROM exec.step_results
            WHERE test_run_id = $1
            ORDER BY step_order ASC
            """
        all_steps_raw = await db.fetch(steps_query, execution_id) or []

        all_steps = []
        for raw_step in all_steps_raw:
            if not hasattr(raw_step, 'get'):
                # Some adapters can return serialized rows; skip malformed entries.
                continue

            action_data = raw_step.get('action_data') or {}
            if isinstance(action_data, str):
                try:
                    action_data = json.loads(action_data)
                except Exception:
                    action_data = {}
            if not isinstance(action_data, dict):
                action_data = {}

            error_details = raw_step.get('error_details')
            if isinstance(error_details, dict):
                error_message = error_details.get('message') or str(error_details)
            else:
                error_message = str(error_details) if error_details else ''

            all_steps.append({
                'id': raw_step.get('id'),
                'step_order': raw_step.get('step_order'),
                'action': action_data.get('action', 'unknown'),
                'target': action_data.get('locator') or action_data.get('selector') or '',
                'status': raw_step.get('status'),
                'error_message': error_message,
                'created_at': raw_step.get('created_at')
            })
        
        # Enrich step data with original plan information (including text values)
        enriched_steps = []
        for step in all_steps:
            if not isinstance(step, dict):
                continue

            step_order_raw = step.get('step_order', 0)
            try:
                step_order = int(step_order_raw or 0)
            except (TypeError, ValueError):
                step_order = 0

            enriched_step = dict(step)
            
            # Try to find the corresponding plan step (plan steps are 1-indexed)
            if step_order > 0 and step_order <= len(original_plan_steps):
                plan_step = original_plan_steps[step_order - 1]
                params = plan_step.get('params', {}) if isinstance(plan_step, dict) else {}
                if not isinstance(params, dict):
                    params = {}
                
                # Add the text value from the original plan
                text_value = params.get('text', '')
                enriched_step['text_value'] = text_value
                enriched_step['selector'] = params.get('selector', step.get('target', ''))
                enriched_step['description'] = params.get('description', '')
                
            else:
                enriched_step['text_value'] = ''
                enriched_step['selector'] = step.get('target', '')
                enriched_step['description'] = ''
            
            enriched_steps.append(enriched_step)
        
        all_steps = enriched_steps
        
        # Use AI to analyze and generate minimal reproduction steps
        response = await enterprise_ai_service.generate_minimal_reproduction_steps(
            execution_id=execution_id,
            execution_context={
                "prompt_text": execution.get("prompt_text", ""),
                "prompt_title": execution.get("prompt_title", ""),
                "total_steps": len(all_steps),
                "failed_steps_count": len(failed_steps)
            },
            all_steps=all_steps,
            failed_steps=failed_steps,
            optimization_level=optimization_level,
            preserve_context=preserve_context
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate minimal reproduction: {str(e)}")

@router.get("/recent-failed-executions/{prompt_id}")
async def get_recent_failed_executions_for_analysis(
    prompt_id: str,
    limit: int = 10,
    db: DatabaseManager = Depends(get_database_manager)
):
    """
    Get recent failed executions for a specific prompt that can be used for AI failure analysis.
    This is specifically for generating minimal reproduction steps.
    """
    try:
        # Query for recent failed executions with comprehensive step information
        failed_executions_query = """
        SELECT DISTINCT
            r.id as execution_id,
            r.test_case_id,
            r.status,
            r.started_at,
            r.finished_at,
            r.error_message,
            r.runner_meta,
            tc.title as test_name,
            tc.prompt_text,
            tc.plan_id,
            -- Get step counts with explicit casting
            COALESCE((SELECT COUNT(*)::integer FROM exec.step_results sr2 WHERE sr2.test_run_id = r.id AND sr2.status = 'failed'), 0) as failed_steps_count,
            COALESCE((SELECT COUNT(*)::integer FROM exec.step_results sr3 WHERE sr3.test_run_id = r.id AND sr3.status = 'passed'), 0) as passed_steps_count,
            COALESCE((SELECT COUNT(*)::integer FROM exec.step_results sr4 WHERE sr4.test_run_id = r.id), 0) as total_steps_count,
            -- Get ALL steps with details (both failed and passed)
            COALESCE((SELECT json_agg(
                json_build_object(
                    'step_order', sr5.step_order,
                    'action', COALESCE(sr5.action_data->>'action', 'unknown'),
                    'selector', COALESCE(sr5.action_data->>'locator', sr5.action_data->>'selector', ''),
                    'locator', COALESCE(sr5.action_data->>'locator', ''),
                    'value', COALESCE(sr5.action_data->>'value', ''),
                    'error_message', COALESCE(sr5.error_message, ''),
                    'status', COALESCE(sr5.status, 'unknown'),
                    'execution_time_ms', sr5.execution_time_ms,
                    'screenshot_path', sr5.screenshot_path,
                    'created_at', sr5.created_at::text
                ) ORDER BY sr5.step_order
            ) FROM exec.step_results sr5 WHERE sr5.test_run_id = r.id), '[]'::json) as steps,
            -- Get only failed steps for AI analysis
            COALESCE((SELECT json_agg(
                json_build_object(
                    'step_order', sr6.step_order,
                    'action', COALESCE(sr6.action_data->>'action', 'unknown'),
                    'selector', COALESCE(sr6.action_data->>'locator', sr6.action_data->>'selector', ''),
                    'error_message', COALESCE(sr6.error_message, ''),
                    'status', sr6.status
                ) ORDER BY sr6.step_order
            ) FROM exec.step_results sr6 WHERE sr6.test_run_id = r.id AND sr6.status = 'failed'), '[]'::json) as failed_steps
        FROM exec.runs r
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        WHERE (
            r.status IN ('failed', 'completed_with_failures', 'error') 
            OR (r.status = 'completed' AND EXISTS (
                SELECT 1 FROM exec.step_results sr7 WHERE sr7.test_run_id = r.id AND sr7.status = 'failed'
            ))
        )
        AND (tc.plan_id = $1 OR tc.title LIKE $2 OR r.test_case_id LIKE $1)
        ORDER BY r.started_at DESC
        LIMIT $3
        """
        
        prompt_pattern = f"%{prompt_id[:8]}%"  # Use first 8 chars for matching
        
        executions = await db.fetch(failed_executions_query, prompt_id, prompt_pattern, limit)
        
        # Format for frontend/AI analysis
        formatted_executions = []
        for execution in executions:
            # Calculate duration if available
            duration = None
            if execution["started_at"] and execution["finished_at"]:
                duration = (execution["finished_at"] - execution["started_at"]).total_seconds()
            
            # Parse runner_meta if available
            runner_meta = execution.get("runner_meta")
            if isinstance(runner_meta, str):
                try:
                    import json
                    runner_meta = json.loads(runner_meta)
                except Exception:
                    runner_meta = {}
            
            execution_data = {
                "execution_id": str(execution["execution_id"]),
                "test_name": execution["test_name"] or f"Test Run {str(execution['execution_id'])[:8]}",
                "status": execution["status"], 
                "started_at": execution["started_at"].isoformat() if execution["started_at"] else None,
                "finished_at": execution["finished_at"].isoformat() if execution["finished_at"] else None,
                "duration_seconds": duration,
                "error_message": execution["error_message"],
                "plan_id": execution.get("plan_id"),
                "failed_steps_count": execution["failed_steps_count"] or 0,
                "passed_steps_count": execution["passed_steps_count"] or 0,
                "total_steps_count": execution["total_steps_count"] or 0,
                "steps": execution["steps"] or [],  # All steps for detailed analysis
                "failed_steps": execution["failed_steps"] or [],  # Failed steps for AI
                "prompt_text": execution["prompt_text"],
                "runner_meta": runner_meta,
                # Calculate success rate
                "success_rate": round((execution["passed_steps_count"] or 0) / max(execution["total_steps_count"] or 1, 1) * 100, 1)
            }
            formatted_executions.append(execution_data)
        
        return {
            "executions": formatted_executions,
            "total": len(formatted_executions),
            "prompt_id": prompt_id
        }
        
    except Exception as e:
        logger.error("Error getting recent failed executions: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get recent failed executions: {str(e)}")

@router.get("/analyze-element-failures/{element_id}")
async def analyze_element_failure_patterns(
    element_id: str,
    days: int = 30,
    db: DatabaseManager = Depends(get_database_manager)
):
    """
    Analyze failure patterns for a specific element over the specified time period.
    Provides insights into common errors, failure trends, and AI-generated recommendations.
    """
    try:# Get failures involving this element
        failure_query = """
        SELECT 
            sr.error_details->>'message' as error_message,
            sr.action_data->>'action' as action,
            sr.step_order,
            sr.created_at,
            r.id as execution_id,
            tc.prompt_text,
            tc.prompt_title
        FROM exec.step_results sr
        JOIN exec.runs r ON sr.test_run_id = r.id
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        WHERE sr.status = 'failed' 
        AND sr.action_data->>'selector' LIKE $1
        AND sr.created_at >= CURRENT_TIMESTAMP - INTERVAL '{} days'
        ORDER BY sr.created_at DESC
        """.format(days)
        
        # Search for element in target field (could be CSS selector, XPath, or element ID)
        search_pattern = f"%{element_id}%"
        failures = await db.execute(failure_query, search_pattern)
        
        if not failures:
            return {
                "elementId": element_id,
                "failureAnalysis": {
                    "totalFailures": 0,
                    "commonErrors": [],
                    "failureTrends": [],
                    "affectedActions": []
                },
                "recommendations": [
                    "No recent failures detected for this element",
                    "Element appears to be stable and reliable",
                    "Continue monitoring for any future issues"
                ]
            }
        
        # Analyze failure patterns
        error_counts = {}
        action_failures = {}
        daily_failures = {}
        
        for failure in failures:
            error_msg = failure.get("error_message", "Unknown error")
            action = failure.get("action", "unknown")
            date_key = failure.get("created_at").strftime("%Y-%m-%d")
            step_order = failure.get("step_order", 0)
            
            # Count errors
            error_counts[error_msg] = error_counts.get(error_msg, 0) + 1
            
            # Count action failures
            if action not in action_failures:
                action_failures[action] = {"count": 0, "total_steps": 0, "positions": []}
            action_failures[action]["count"] += 1
            action_failures[action]["positions"].append(step_order)
            
            # Daily trends
            daily_failures[date_key] = daily_failures.get(date_key, 0) + 1
        
        # Generate AI-powered recommendations
        recommendations = await enterprise_ai_service.generate_element_failure_recommendations(
            element_id=element_id,
            failure_data={
                "total_failures": len(failures),
                "error_patterns": error_counts,
                "action_patterns": action_failures,
                "time_period_days": days
            }
        )
        
        # Format response
        common_errors = [
            {
                "error": error,
                "count": count,
                "firstSeen": min([f.get("created_at") for f in failures if f.get("error_message") == error]).isoformat(),
                "lastSeen": max([f.get("created_at") for f in failures if f.get("error_message") == error]).isoformat()
            }
            for error, count in sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        ]
        
        affected_actions = [
            {
                "action": action,
                "failureRate": round(data["count"] / max(data["total_steps"], data["count"]) * 100, 2),
                "avgStepPosition": round(sum(data["positions"]) / len(data["positions"]), 1)
            }
            for action, data in action_failures.items()
        ]
        
        failure_trends = [
            {"date": date, "failures": count}
            for date, count in sorted(daily_failures.items())
        ]
        
        result = {
            "elementId": element_id,
            "failureAnalysis": {
                "totalFailures": len(failures),
                "commonErrors": common_errors,
                "failureTrends": failure_trends,
                "affectedActions": affected_actions
            },
            "recommendations": recommendations
        }
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze element failures: {str(e)}")


# ---------------------------------------------------------------------------
# AI Element Enrichment — called by MCP after runner gathers raw elements
# ---------------------------------------------------------------------------

async def enrich_elements_core(raw_elements: list, page_info: dict) -> dict:
    """
    Core enrichment logic — callable directly (no HTTP).
    Pipeline:
      1. Raw capture                          (all elements)
      2. Drop non-interactive with no text    (~60% cut)
      3. Drop dynamic content patterns        (~60% cut)
      4. AI processing pass on survivors      (~20-30 elements)
      5. Apply heuristics to everything else
    """
    try:
        if not raw_elements:
            return {"success": True, "elements": [], "ai_processed": False}

        total_raw = len(raw_elements)

        # ----- Stage 1: Classify each element -----
        ai_candidates = []       # indices that survive filtering → sent to AI
        pre_skipped = set()      # indices dropped in stage 2
        pre_dynamic = set()      # indices dropped in stage 3

        for i, elem in enumerate(raw_elements):
            tag = (elem.get("tag") or "").lower()
            text = (elem.get("text") or "").strip()
            interactive = elem.get("interactive", False)
            sel = elem.get("selectors", {})
            attrs = elem.get("attributes", {})
            content_desc = sel.get("accessibility_id", "")

            # Stage 2: Drop non-interactive elements with no text/content-desc
            if not interactive and not text and not content_desc:
                pre_skipped.add(i)
                continue

            # Stage 2b: Drop known layout containers
            if _heuristic_should_skip(elem):
                pre_skipped.add(i)
                continue

            # Stage 3: Drop elements with dynamic content patterns
            if _heuristic_is_dynamic(elem):
                pre_dynamic.add(i)
                continue

            # Survivor → send to AI
            ai_candidates.append(i)

        logger.info(
            "Pre-filter pipeline: %d raw → %d dropped (non-interactive/layout) "
            "→ %d dropped (dynamic) → %d candidates for AI",
            total_raw, len(pre_skipped), len(pre_dynamic), len(ai_candidates),
        )

        # ----- Stage 4: AI pass on survivors only -----
        ai_processed = False
        ai_enrichments = {}  # original_index → AI result

        if ai_candidates:
            # Build compact summaries only for AI candidates
            element_summaries = []
            for idx in ai_candidates:
                elem = raw_elements[idx]
                sel = elem.get("selectors", {})
                attrs = elem.get("attributes", {})
                s = {"i": idx, "tag": elem.get("tag", "")}
                text = (elem.get("text", "") or "")[:60]
                if text: s["txt"] = text
                cd = sel.get("accessibility_id", "")
                if cd: s["cd"] = cd[:60]
                rid = sel.get("id", "")
                if rid: s["rid"] = rid
                if elem.get("interactive"): s["click"] = True
                if elem.get("sticky"): s["sticky"] = True
                element_summaries.append(s)

            system_prompt = """You are a mobile test automation engineer. Classify UI elements as STABLE or DYNAMIC for test automation.

Input format: {"i":index,"tag":"class","txt":"text","cd":"content-desc","rid":"resource-id","click":true,"sticky":true}

STABLE elements have selectors that will be identical every time the app is opened, regardless of user, time, or content. Examples: generic labels like "Home", "Search", "Back", "Settings", "Play".

DYNAMIC elements have selectors containing content that could change between sessions — any proper noun, specific name, title, description, user-generated text, or content fetched from a server. If a different user opened the app and saw different content, the selector would break.

Ask yourself: "If I opened this app on a different device, logged in as a different user, would this exact selector still work?" If no → DYNAMIC.

SKIP elements that are generic layout containers with no meaningful identity (only positional xpath) or system chrome.

For each element return:
- index: the "i" value
- logical_name: short camelCase name (max 40 chars) based on the element's PURPOSE, never its content
- is_dynamic: true if the selector would break on a different session/user/device
- skip: true if the element has no test value
- selector_confidence_scores: object with confidence 0.0-1.0 for selector families when available
    Keys may include: accessibility_id, id, name, xpath, class_name
    Score guidance:
    - stable generic accessibility_id/id/name: 0.85-0.99
    - class_name selectors: 0.35-0.65
    - improved/stable xpath: 0.6-0.85
    - dynamic/content-based xpath: 0.1-0.45

Return JSON only: {"elements":[{"index":0,"logical_name":"homeTab","is_dynamic":false,"skip":false}]}"""

            BATCH_SIZE = 50
            ai_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

            try:
                for batch_start in range(0, len(element_summaries), BATCH_SIZE):
                    batch = element_summaries[batch_start:batch_start + BATCH_SIZE]
                    user_prompt = f"""Platform: {page_info.get('platform', 'Android')}
{len(batch)} elements:
{json.dumps(batch, ensure_ascii=False)}"""

                    response_text = await enterprise_ai_service._chat_json(
                        model=ai_model,
                        system=system_prompt,
                        user=user_prompt,
                        max_tokens=2000,
                        temperature=0.1,
                        retries=3,
                        timeout_ms=120000,
                    )
                    ai_result = json.loads(response_text)
                    for ae in ai_result.get("elements", []):
                        ai_enrichments[ae.get("index", -1)] = ae

                ai_processed = True
                logger.info(
                    "AI enriched %d/%d candidates in %d batch(es) using %s",
                    len(ai_enrichments), len(ai_candidates),
                    (len(element_summaries) + BATCH_SIZE - 1) // BATCH_SIZE,
                    ai_model,
                )
            except Exception as e:
                logger.warning(f"AI enrichment failed, using heuristic fallback: {e}")

        # ----- Stage 5: Merge results for ALL elements -----
        enriched_elements = []
        for i, elem in enumerate(raw_elements):
            enriched = dict(elem)

            if i in pre_skipped:
                # Non-interactive/layout → skip, assign heuristic name
                enriched["skip"] = True
                enriched["is_dynamic"] = False
                enriched["logical_name"] = _heuristic_logical_name(elem, i)
                enriched["element_type"] = ""
                enriched["selector_strategy"] = ""
            elif i in pre_dynamic:
                # Dynamic content → skip, don't store in element repo
                enriched["skip"] = True
                enriched["is_dynamic"] = True
                enriched["logical_name"] = _heuristic_logical_name(elem, i)
                enriched["element_type"] = "dynamic_content"
                enriched["selector_strategy"] = "class_index"
            elif ai_processed and i in ai_enrichments:
                # AI processed
                ai = ai_enrichments[i]
                enriched["logical_name"] = ai.get("logical_name", "")
                enriched["is_dynamic"] = ai.get("is_dynamic", False)
                enriched["skip"] = ai.get("skip", False)
                enriched["element_type"] = ai.get("element_type", "")
                enriched["selector_strategy"] = ai.get("selector_strategy", "")
                if ai.get("improved_xpath"):
                    enriched.setdefault("selectors", {})["improved_xpath"] = ai["improved_xpath"]
                enriched["selector_confidence_scores"] = _build_selector_confidence_scores(
                    enriched,
                    ai_selector_scores=ai.get("selector_confidence_scores")
                )
            else:
                # AI candidate but AI failed → heuristic fallback
                enriched["is_dynamic"] = False
                enriched["skip"] = False
                enriched["logical_name"] = _heuristic_logical_name(elem, i)
                enriched["element_type"] = ""
                enriched["selector_strategy"] = ""
                enriched["selector_confidence_scores"] = _build_selector_confidence_scores(enriched)

            if "selector_confidence_scores" not in enriched:
                enriched["selector_confidence_scores"] = _build_selector_confidence_scores(enriched)

            enriched_elements.append(enriched)

        return {
            "success": True,
            "ai_processed": ai_processed,
            "total": len(enriched_elements),
            "pre_filtered": len(pre_skipped),
            "dynamic_filtered": len(pre_dynamic),
            "ai_candidates": len(ai_candidates),
            "skipped": sum(1 for e in enriched_elements if e.get("skip")),
            "dynamic": sum(1 for e in enriched_elements if e.get("is_dynamic")),
            "elements": enriched_elements,
        }

    except Exception as e:
        logger.error(f"Element enrichment failed: {e}")
        raise


@router.post("/enrich-elements")
async def enrich_elements_endpoint(request: Request):
    """HTTP wrapper around enrich_elements_core."""
    try:
        body = await request.json()
        raw_elements = body.get("elements", [])
        page_info = body.get("page_info", {})
        return await enrich_elements_core(raw_elements, page_info)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Element enrichment failed: {str(e)}")


def _heuristic_is_dynamic(elem: dict) -> bool:
    """Detect dynamic elements by content-desc length and common live-data patterns."""
    sel = elem.get("selectors", {})
    cd = sel.get("accessibility_id", "")
    text = elem.get("text", "") or ""
    combined = cd + " " + text

    # Long content-desc usually means server-fetched/dynamic content
    if len(cd) > 60:
        return True
    import re

    # Temporal patterns (durations, relative time, dates)
    if re.search(r'\d+\s*(minute|second|hour|day|week|month|year|ago|hr|min|sec)s?\b', combined, re.I):
        return True
    # Large numbers with units (views, likes, followers, downloads, ratings, reviews)
    if re.search(r'\d[\d,\.]*\s*(thousand|million|billion|K|M|B)?\s*(view|like|follower|download|rating|review|subscriber|comment|share|retweet|reaction|upvote|point)s?\b', combined, re.I):
        return True
    # Currency / prices
    if re.search(r'[\$\€\£\¥]\s*\d', combined) or re.search(r'\d+\.\d{2}\b', combined):
        return True
    # Percentage patterns
    if re.search(r'\d+\.?\d*\s*%', combined):
        return True
    # Star ratings (e.g. "4.5 stars", "★")
    if re.search(r'\d\.\d\s*star|★|⭐', combined, re.I):
        return True
    return False


def _heuristic_should_skip(elem: dict) -> bool:
    """Skip layout containers and system UI."""
    tag = (elem.get("tag") or "").lower()
    attrs = elem.get("attributes", {})
    cls = (attrs.get("class") or "").lower()

    skip_tags = {"android.view.view", "android.widget.framelayout",
                 "android.widget.linearlayout", "android.widget.relativelayout"}
    if tag in skip_tags and not elem.get("text") and not elem.get("interactive"):
        return True
    if "statusbar" in cls or "navigationbar" in cls:
        return True
    return False


def _heuristic_logical_name(elem: dict, index: int) -> str:
    """Generate a fallback logical name without AI."""
    sel = elem.get("selectors", {})
    cd = sel.get("accessibility_id", "")
    rid = sel.get("id", "")
    text = (elem.get("text") or "")[:30]
    tag = elem.get("tag", "element")

    # Short accessibility_id → use it directly
    if cd and len(cd) <= 40 and not _heuristic_is_dynamic(elem):
        # camelCase it
        words = cd.split()
        if len(words) <= 4:
            name = words[0].lower() + "".join(w.capitalize() for w in words[1:])
            return name[:40]

    # Resource-id → extract meaningful part
    if rid:
        part = rid.split("/")[-1] if "/" in rid else rid
        part = part.split(":")[-1] if ":" in part else part
        return part[:40]

    # Short text
    if text and len(text) <= 30:
        words = text.split()[:3]
        name = words[0].lower() + "".join(w.capitalize() for w in words[1:])
        clean = "".join(c for c in name if c.isalnum())
        if clean:
            return clean[:40]

    return f"element_{index}"


def _build_selector_confidence_scores(elem: dict, ai_selector_scores: dict = None) -> dict:
    """
    Build per-attribute selector confidence scores (0.0-1.0).
    AI scores, when available, are blended with heuristic scores for stability.
    """
    selectors = elem.get("selectors", {}) or {}
    attrs = elem.get("attributes", {}) or {}

    text = (elem.get("text") or "").strip()
    is_dynamic = bool(elem.get("is_dynamic", False))

    def _clip(v: float) -> float:
        return max(0.0, min(1.0, round(float(v), 3)))

    scores = {}

    acc_id = selectors.get("accessibility_id")
    if acc_id:
        base = 0.92
        if is_dynamic:
            base -= 0.28
        if len(str(acc_id)) > 60:
            base -= 0.22
        if text and str(acc_id).strip().lower() == text.lower():
            base -= 0.10
        scores["accessibility_id"] = _clip(base)

    resource_id = selectors.get("id")
    if resource_id:
        rid = str(resource_id).lower()
        base = 0.88
        if is_dynamic:
            base -= 0.20
        if any(t in rid for t in ["tmp", "temp", "dynamic", "random", "generated"]):
            base -= 0.18
        scores["id"] = _clip(base)

    name = selectors.get("name") or attrs.get("name")
    if name:
        base = 0.76
        if is_dynamic:
            base -= 0.18
        scores["name"] = _clip(base)

    improved_xpath = selectors.get("improved_xpath")
    xpath = improved_xpath or selectors.get("xpath")
    if xpath:
        xp = str(xpath)
        base = 0.62 if improved_xpath else 0.52
        if "contains(" in xp or "starts-with(" in xp:
            base -= 0.12
        if "@text=" in xp or "contains(@text" in xp:
            base -= 0.18
        if is_dynamic:
            base -= 0.12
        scores["xpath"] = _clip(base)

    class_name = selectors.get("class_name") or attrs.get("class")
    if class_name:
        base = 0.46
        if is_dynamic:
            base -= 0.08
        scores["class_name"] = _clip(base)

    if isinstance(ai_selector_scores, dict):
        for key, ai_val in ai_selector_scores.items():
            if ai_val is None:
                continue
            try:
                ai_score = _clip(float(ai_val))
            except Exception:
                continue

            if key in scores:
                # Blend AI + heuristic so AI can steer but not dominate unstable patterns.
                scores[key] = _clip((scores[key] * 0.55) + (ai_score * 0.45))
            else:
                scores[key] = ai_score

    return scores


@router.post("/store-enriched-elements")
async def store_enriched_elements_endpoint(request: Request):
    """
    Store pre-enriched elements into repo.elements.
    Called by the MCP server after AI enrichment is complete.

    Expects JSON body:
    {
        "page_id": "uuid",
        "elements": [
            {
                "name": "homeTab",
                "primary_selector": {"accessibility_id": "Home", "xpath": "..."},
                "fallback_selectors": [...],
                "attributes": {...}
            }
        ]
    }
    """
    try:
        body = await request.json()
        page_id = body.get("page_id")
        elements = body.get("elements", [])

        if not page_id:
            raise HTTPException(400, "page_id is required")

        from core.database import get_database
        db = await get_database()

        stored_count = 0
        for elem in elements:
            try:
                await db.execute(
                    """
                    INSERT INTO repo.elements (page_id, name, primary_selector,
                                               fallback_selectors, attributes, is_active)
                    VALUES ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::jsonb, true)
                    ON CONFLICT (page_id, name) DO UPDATE
                        SET primary_selector = EXCLUDED.primary_selector,
                            fallback_selectors = EXCLUDED.fallback_selectors,
                            attributes = EXCLUDED.attributes,
                            updated_at = NOW()
                    """,
                    str(page_id),
                    elem["name"],
                    json.dumps(elem.get("primary_selector", {})),
                    json.dumps(elem.get("fallback_selectors", [])),
                    json.dumps(elem.get("attributes", {})),
                )
                stored_count += 1
            except Exception as e:
                logger.warning(f"Failed to store element '{elem.get('name')}': {e}")

        return {"success": True, "stored_count": stored_count, "page_id": page_id}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to store enriched elements: {str(e)}")


@router.post("/analyze-page-elements")
async def analyze_page_elements(request: Request):
    """
    Analyze page elements from Chrome extension and store in repository
    """
    try:
        # Parse JSON body
        request_data = await request.json()
        
        page_data = request_data.get("pageData", {})
        extraction_mode = request_data.get("extractionMode", "full_analysis")
        include_healing = request_data.get("includeHealing", True)
        
        if not page_data:
            raise HTTPException(status_code=400, detail="pageData is required")
        
        # Extract page info and elements
        page_info = page_data.get("pageInfo", {})
        elements = page_data.get("elements", [])
        page_url = page_info.get("url", "")
        page_title = page_info.get("title", "")
        
        # Store elements in database
        stored_count = await store_elements_in_repository(page_info, elements)
        
        # Simple analysis for testing
        total_elements = len(elements)
        interactive_elements = sum(1 for el in elements if el.get("isInteractive", False))
        
        result = {
            "summary": {
                "pageUrl": page_url,
                "pageTitle": page_title,
                "totalElements": total_elements,
                "interactiveElements": interactive_elements,
                "storedElements": stored_count,
                "pageType": "test_page",
                "suggestions": ["Chrome extension is working correctly!", f"Stored {stored_count} elements in repository"]
            },
            "processingTime": 50,
            "status": "success"
        }
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze page elements: {str(e)}")

async def store_elements_in_repository(page_info: dict, elements: list) -> int:
    """Store page elements in the repository database"""
    try:
        from core.database import get_database_manager
        import uuid
        from datetime import datetime
        
        db = await get_database_manager()
        
        # Extract page information
        page_url = page_info.get("url", "")
        page_title = page_info.get("title", "")
        hostname = page_info.get("hostname", "")
        pathname = page_info.get("pathname", "")
        
        # Create or find page record
        page_query = """
            INSERT INTO repo.pages (project_id, name, route_hint, tags)
            VALUES (
                (SELECT id FROM core.projects LIMIT 1),  -- Use first project for now
                $1, $2, $3
            )
            ON CONFLICT (project_id, name) 
            DO UPDATE SET 
                route_hint = EXCLUDED.route_hint,
                updated_at = NOW()
            RETURNING id
        """
        
        # Function to get page name from extension data or generate a simple one
        def get_page_name(page_info: dict) -> str:
            """Get page name from Chrome extension data or generate a simple one"""
            
            # Check if Chrome extension provided a page name
            current_page = page_info.get("currentPage", "")
            if current_page and current_page.strip():
                # Clean up the page name to be a valid identifier
                clean_name = current_page.strip().lower()
                clean_name = clean_name.replace(' ', '_').replace('-', '_')
                clean_name = ''.join(c for c in clean_name if c.isalnum() or c == '_')
                if clean_name:
                    return clean_name
            
            # Fallback: extract from pathname
            pathname = page_info.get("pathname", "").strip('/')
            if pathname:
                # Clean up the path
                clean_path = pathname.replace('.html', '').replace('.php', '').replace('.jsp', '')
                clean_path = clean_path.replace('-', '_').replace('/', '_')
                clean_path = ''.join(c for c in clean_path if c.isalnum() or c == '_')
                return clean_path if clean_path else "home"
            
            # Final fallback
            return "home"
        
        page_name = get_page_name(page_info)
        route_hint = pathname or page_url
        tags = []  # Empty tags array for now
        
        page_result = await db.execute_one(page_query, 
            page_name, route_hint, tags
        )
        
        if page_result:
            page_id = page_result["id"]
        else:
            # Fallback if page creation failed
            page_id = str(uuid.uuid4())
        # Store elements
        stored_count = 0
        now = datetime.utcnow()
        element_query = """
            INSERT INTO repo.elements (
                page_id, element_key, primary_selector, alt_selectors, 
                attributes, is_active
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (page_id, element_key) DO UPDATE SET
                primary_selector = EXCLUDED.primary_selector,
                alt_selectors = EXCLUDED.alt_selectors,
                attributes = EXCLUDED.attributes,
                updated_at = NOW()
        """
        
        # Helper function to generate semantic element key with AI enhancement
        def generate_semantic_element_key(element: dict, index: int) -> str:
            """Generate a semantic element key based on element properties"""
            tag = element.get("tag", "").lower()
            text = element.get("text", "").strip()
            attributes = element.get("attributes", {})
            
            # Get useful attributes
            element_id = attributes.get("id", "")
            element_class = attributes.get("class", "")
            name = attributes.get("name", "")
            placeholder = attributes.get("placeholder", "")
            type_attr = attributes.get("type", "")
            title = attributes.get("title", "")
            aria_label = attributes.get("aria-label", "")
            role = attributes.get("role", "")
            data_testid = attributes.get("data-testid", "")
            
            # Skip meta tags, style tags, and other non-interactive elements
            if tag in ["meta", "style", "script", "link", "title", "head"]:
                return None  # Skip these elements
            
            # Skip MCP extension elements and Chrome extension artifacts
            mcp_indicators = [
                "mcp", "recording", "notification", "extension", "chrome-extension",
                "popup", "overlay", "modal" if "mcp" in element_class.lower() or "mcp" in element_id.lower() else ""
            ]
            
            # Check if this is an MCP/extension element
            element_text = f"{element_id} {element_class} {text}".lower()
            if any(indicator in element_text for indicator in mcp_indicators if indicator):
                return None  # Skip MCP/extension elements
            
            # Skip elements with Chrome extension specific attributes
            if ("chrome-extension" in element_id.lower() or 
                "chrome-extension" in element_class.lower() or
                "mcp-" in element_id.lower() or
                "mcp-" in element_class.lower()):
                return None
            
            # Function to clean and format text for key names
            def clean_text_for_key(text_input: str, max_length: int = 25) -> str:
                if not text_input:
                    return ""
                # Remove special characters, keep only alphanumeric and spaces
                clean = "".join(c for c in text_input if c.isalnum() or c.isspace())
                # Convert to camelCase
                words = clean.split()
                if not words:
                    return ""
                result = words[0].lower()
                for word in words[1:]:
                    result += word.capitalize()
                return result[:max_length]
            
            # PRIORITY 1: Check for stable semantic attributes first (best for reliability)
            if data_testid:
                clean_testid = clean_text_for_key(data_testid)
                return clean_testid if clean_testid else None
            
            # PRIORITY 2: Check for meaningful aria-labels
            if aria_label and len(aria_label) > 2:
                clean_aria = clean_text_for_key(aria_label)
                if clean_aria and len(clean_aria) > 3:
                    return clean_aria
            
            # PRIORITY 3: Check for semantic element IDs (but reject auto-generated ones)
            if element_id:
                # Reject IDs with random numbers, UUIDs, or timestamps
                has_many_numbers = sum(c.isdigit() for c in element_id) > 4
                has_uuid_pattern = len(element_id) > 20 and '-' in element_id
                has_timestamp = any(pattern in element_id for pattern in ['tabs-', 'panel-', 'accordion-', 'id-'])
                
                if not (has_many_numbers or has_uuid_pattern or has_timestamp):
                    # This looks like a human-created, stable ID
                    clean_id = clean_text_for_key(element_id)
                    if clean_id and len(clean_id) > 3:
                        return clean_id
            
            # PRIORITY 4: Use meaningful text content (but be smart about it)
            if text and len(text) > 2:
                # For buttons/links with text, generate semantic keys
                if tag in ["button", "a"]:
                    clean_text = clean_text_for_key(text)
                    if clean_text and len(clean_text) > 2:
                        suffix = "Button" if tag == "button" else "Link"
                        return f"{clean_text}{suffix}"
            
            # PRIORITY 5: Use role attribute for semantic understanding
            if role:
                role_lower = role.lower()
                if role_lower == "tab":
                    # For tabs, try to use aria-label or text
                    if aria_label:
                        clean_aria = clean_text_for_key(aria_label)
                        return f"{clean_aria}Tab" if clean_aria else "tabOption"
                    elif text:
                        clean_text = clean_text_for_key(text, 15)
                        return f"{clean_text}Tab" if clean_text else "tabOption"
                    else:
                        return f"tab{index}" if index < 10 else "tabOption"
                elif role_lower == "button" and text:
                    clean_text = clean_text_for_key(text)
                    return f"{clean_text}Button" if clean_text else "actionButton"
            
            # Determine element purpose and generate key based on tag
            if tag == "input":
                if type_attr == "password" or "password" in name.lower() or "password" in placeholder.lower():
                    return "passwordField"
                elif type_attr == "email" or "email" in name.lower() or "email" in placeholder.lower():
                    return "emailField"
                elif ("user" in name.lower() or "login" in name.lower() or 
                      "username" in placeholder.lower() or "user" in placeholder.lower()):
                    return "usernameField"
                elif "search" in name.lower() or "search" in placeholder.lower():
                    return "searchField"
                elif type_attr == "submit":
                    return "submitButton"
                elif type_attr == "button":
                    if text:
                        clean_text = clean_text_for_key(text)
                        return f"{clean_text}Button" if clean_text else "actionButton"
                    return "actionButton"
                elif type_attr == "checkbox":
                    if name:
                        clean_name = clean_text_for_key(name)
                        return f"{clean_name}Checkbox" if clean_name else "checkbox"
                    return "checkbox"
                elif type_attr == "radio":
                    if name:
                        clean_name = clean_text_for_key(name)
                        return f"{clean_name}Radio" if clean_name else "radioButton"
                    return "radioButton"
                elif name:
                    clean_name = clean_text_for_key(name)
                    return f"{clean_name}Field" if clean_name else "inputField"
                elif placeholder:
                    clean_placeholder = clean_text_for_key(placeholder)
                    return f"{clean_placeholder}Field" if clean_placeholder else "inputField"
                else:
                    return "inputField"
            
            elif tag == "button":
                # Look for common button patterns
                button_text = text or aria_label or title
                if not button_text:
                    # Look in child elements or class names for clues
                    if "login" in element_class.lower() or "sign-in" in element_class.lower():
                        return "loginButton"
                    elif "submit" in element_class.lower():
                        return "submitButton"
                    elif "cancel" in element_class.lower():
                        return "cancelButton"
                    else:
                        return "actionButton"
                
                button_text_lower = button_text.lower()
                if "login" in button_text_lower or "sign in" in button_text_lower:
                    return "loginButton"
                elif "logout" in button_text_lower or "sign out" in button_text_lower:
                    return "logoutButton"
                elif "submit" in button_text_lower:
                    return "submitButton"
                elif "cancel" in button_text_lower:
                    return "cancelButton"
                elif "save" in button_text_lower:
                    return "saveButton"
                elif "delete" in button_text_lower or "remove" in button_text_lower:
                    return "deleteButton"
                elif "add" in button_text_lower or "create" in button_text_lower or "new" in button_text_lower:
                    return "addButton"
                elif "edit" in button_text_lower or "modify" in button_text_lower:
                    return "editButton"
                elif "close" in button_text_lower:
                    return "closeButton"
                elif "next" in button_text_lower:
                    return "nextButton"
                elif "previous" in button_text_lower or "prev" in button_text_lower:
                    return "previousButton"
                else:
                    clean_text = clean_text_for_key(button_text)
                    return f"{clean_text}Button" if clean_text else "actionButton"
            
            elif tag == "a":
                link_text = text or aria_label or title
                if not link_text:
                    # Check href for clues
                    href = attributes.get("href", "")
                    if "home" in href.lower():
                        return "homeLink"
                    elif "about" in href.lower():
                        return "aboutLink"
                    elif "contact" in href.lower():
                        return "contactLink"
                    else:
                        return "navLink"
                
                link_text_lower = link_text.lower()
                if "home" in link_text_lower:
                    return "homeLink"
                elif "about" in link_text_lower:
                    return "aboutLink"
                elif "contact" in link_text_lower:
                    return "contactLink"
                elif "logout" in link_text_lower or "sign out" in link_text_lower:
                    return "logoutLink"
                elif "login" in link_text_lower or "sign in" in link_text_lower:
                    return "loginLink"
                else:
                    clean_text = clean_text_for_key(link_text)
                    return f"{clean_text}Link" if clean_text else "navLink"
            
            elif tag == "select":
                select_name = name or aria_label or title
                if not select_name:
                    return "dropdown"
                
                select_name_lower = select_name.lower()
                if "country" in select_name_lower:
                    return "countrySelect"
                elif "state" in select_name_lower or "province" in select_name_lower:
                    return "stateSelect"
                elif "category" in select_name_lower:
                    return "categorySelect"
                elif "status" in select_name_lower:
                    return "statusSelect"
                else:
                    clean_name = clean_text_for_key(select_name)
                    return f"{clean_name}Select" if clean_name else "dropdown"
            
            elif tag in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                if text:
                    clean_text = clean_text_for_key(text, 15)
                    return f"{clean_text}Heading" if clean_text else "pageHeading"
                else:
                    return "pageHeading"
            
            elif tag == "img":
                alt_text = attributes.get("alt", "") or title or aria_label
                if "logo" in alt_text.lower():
                    return "companyLogo"
                elif "avatar" in alt_text.lower() or "profile" in alt_text.lower():
                    return "profileImage"
                elif "icon" in alt_text.lower():
                    return "iconImage"
                elif alt_text:
                    clean_alt = clean_text_for_key(alt_text, 15)
                    return f"{clean_alt}Image" if clean_alt else "contentImage"
                else:
                    return "contentImage"
            
            elif tag == "div":
                # Look for semantic clues in class names, IDs, or roles
                semantic_hints = f"{element_class} {element_id}".lower()
                role = attributes.get("role", "").lower()
                
                if "header" in semantic_hints or role == "banner":
                    return "pageHeader"
                elif "footer" in semantic_hints or role == "contentinfo":
                    return "pageFooter"
                elif "nav" in semantic_hints or role == "navigation":
                    return "navigationMenu"
                elif "menu" in semantic_hints or role == "menu":
                    return "menuContainer"
                elif "content" in semantic_hints or "main" in semantic_hints or role == "main":
                    return "mainContent"
                elif "sidebar" in semantic_hints or role == "complementary":
                    return "sidebar"
                elif "modal" in semantic_hints or "dialog" in semantic_hints or role == "dialog":
                    return "modalDialog"
                elif "alert" in semantic_hints or role == "alert":
                    return "alertMessage"
                elif "form" in semantic_hints:
                    return "formContainer"
                elif "button" in semantic_hints and ("login" in semantic_hints or "signin" in semantic_hints):
                    return "loginContainer"
                elif element_id:
                    clean_id = clean_text_for_key(element_id, 15)
                    return f"{clean_id}Container" if clean_id else "contentContainer"
                else:
                    return "contentContainer"
            
            elif tag == "span":
                span_text = text or aria_label or title
                if span_text:
                    clean_text = clean_text_for_key(span_text, 15)
                    return f"{clean_text}Text" if clean_text else "displayText"
                else:
                    return "displayText"
            
            elif tag == "label":
                label_text = text or attributes.get("for", "")
                if label_text:
                    clean_text = clean_text_for_key(label_text, 15)
                    return f"{clean_text}Label" if clean_text else "fieldLabel"
                else:
                    return "fieldLabel"
            
            elif tag == "textarea":
                textarea_name = name or placeholder or aria_label
                if textarea_name:
                    clean_name = clean_text_for_key(textarea_name, 15)
                    return f"{clean_name}TextArea" if clean_name else "textArea"
                else:
                    return "textArea"
            
            elif tag == "table":
                return "dataTable"
            elif tag == "form":
                form_name = name or element_id
                if form_name:
                    clean_name = clean_text_for_key(form_name, 15)
                    return f"{clean_name}Form" if clean_name else "inputForm"
                else:
                    return "inputForm"
            
            # Skip non-interactive elements entirely
            elif tag in ["p", "br", "hr", "noscript"]:
                return None
            
            # Fallback for other elements - try to make it meaningful
            if element_id:
                clean_id = clean_text_for_key(element_id, 15)
                return clean_id if clean_id else f"{tag}Element"
            elif text and tag not in ["div", "span"]:  # Avoid generic text-based names for containers
                clean_text = clean_text_for_key(text, 15)
                return f"{clean_text}{tag.capitalize()}" if clean_text else f"{tag}Element"
            else:
                return f"{tag}Element"
        
        # Track used keys to avoid duplicates
        used_keys = set()
        
        for i, element in enumerate(elements):
            try:
                # Generate semantic element key
                base_key = generate_semantic_element_key(element, i)
                
                # Skip elements that shouldn't be stored (meta, style, etc.)
                if base_key is None:
                    continue
                    
                element_key = base_key
                
                # Ensure uniqueness by adding suffix if needed
                counter = 1
                while element_key in used_keys:
                    element_key = f"{base_key}{counter}"
                    counter += 1
                used_keys.add(element_key)
                
                # Generate HIGH-QUALITY selectors instead of using Chrome extension's raw data
                tag = element.get("tag", "").lower()
                attributes = element.get("attributes", {})
                text = element.get("text", "").strip()
                
                # Helper to check if an ID is auto-generated/unstable
                def is_stable_id(id_value: str) -> bool:
                    if not id_value or len(id_value) < 3:
                        return False
                    # Reject IDs with many numbers (like APjFqb, tabs-068045)
                    if sum(c.isdigit() for c in id_value) > len(id_value) * 0.4:
                        return False
                    # Reject single-letter or very short IDs
                    if len(id_value) <= 2:
                        return False
                    # Reject common React/Vue patterns
                    if id_value.startswith('__') or '-' in id_value and any(c.isdigit() for c in id_value):
                        return False
                    return True
                
                # Generate CSS selector based on priority (most stable first)
                css_selector = ""
                
                # Priority 1: Stable data attributes
                if attributes.get("data-testid"):
                    css_selector = f"[data-testid='{attributes['data-testid']}']"
                elif attributes.get("data-test"):
                    css_selector = f"[data-test='{attributes['data-test']}']"
                elif attributes.get("data-cy"):
                    css_selector = f"[data-cy='{attributes['data-cy']}']"
                
                # Priority 2: Semantic attributes (title, aria-label, name)
                elif attributes.get("title") and len(attributes["title"]) > 2:
                    title = attributes["title"].replace("'", "\\'")
                    css_selector = f"{tag}[title='{title}']"
                elif attributes.get("aria-label") and len(attributes["aria-label"]) > 2:
                    aria_label = attributes["aria-label"].replace("'", "\\'")
                    css_selector = f"{tag}[aria-label='{aria_label}']"
                elif attributes.get("name") and len(attributes["name"]) > 2:
                    css_selector = f"{tag}[name='{attributes['name']}']"
                elif attributes.get("placeholder") and len(attributes["placeholder"]) > 2:
                    placeholder = attributes["placeholder"].replace("'", "\\'")
                    css_selector = f"{tag}[placeholder='{placeholder}']"
                
                # Priority 3: Stable ID (only if it passes quality check)
                elif attributes.get("id") and is_stable_id(attributes["id"]):
                    css_selector = f"#{attributes['id']}"
                
                # Priority 4: Role + aria attributes
                elif attributes.get("role"):
                    if attributes.get("aria-label"):
                        aria_label = attributes["aria-label"].replace("'", "\\'")
                        css_selector = f"{tag}[role='{attributes['role']}'][aria-label='{aria_label}']"
                    else:
                        css_selector = f"{tag}[role='{attributes['role']}']"
                
                # Priority 5: Type attribute for inputs
                elif tag == "input" and attributes.get("type"):
                    if attributes.get("id") and is_stable_id(attributes["id"]):
                        css_selector = f"input[type='{attributes['type']}']#{attributes['id']}"
                    else:
                        css_selector = f"input[type='{attributes['type']}']"
                
                # Priority 6: Semantic class names (avoid minified ones)
                elif attributes.get("class"):
                    classes = attributes["class"].split()
                    # Find meaningful classes (longer names, semantic prefixes)
                    semantic_classes = [c for c in classes if len(c) > 4 and not c.startswith('_')]
                    if semantic_classes:
                        css_selector = f"{tag}.{semantic_classes[0]}"
                
                # Last resort: Use Chrome extension's cssPath but log warning
                if not css_selector:
                    selectors = element.get("selectors", {})
                    css_selector = selectors.get("cssPath", "")
                    if css_selector and attributes.get("id") and not is_stable_id(attributes["id"]):
                        logger.warning(f"⚠️ Using potentially unstable selector for {element_key}: {css_selector}")
                
                # Generate XPath equivalent
                xpath_selector = ""
                if css_selector.startswith("#"):
                    # ID selector
                    id_val = css_selector[1:]
                    xpath_selector = f"//*[@id='{id_val}']"
                elif "[title=" in css_selector:
                    # Title attribute
                    parts = css_selector.split("[title='")
                    if len(parts) == 2:
                        tag_part = parts[0]
                        title_part = parts[1].rstrip("']")
                        xpath_selector = f"//{tag_part}[@title='{title_part}']"
                elif "[aria-label=" in css_selector:
                    # Aria-label attribute
                    parts = css_selector.split("[aria-label='")
                    if len(parts) == 2:
                        tag_part = parts[0]
                        label_part = parts[1].rstrip("']")
                        xpath_selector = f"//{tag_part}[@aria-label='{label_part}']"
                elif "[name=" in css_selector:
                    # Name attribute
                    parts = css_selector.split("[name='")
                    if len(parts) == 2:
                        tag_part = parts[0]
                        name_part = parts[1].rstrip("']")
                        xpath_selector = f"//{tag_part}[@name='{name_part}']"
                else:
                    # Fallback to extension's xpath
                    selectors = element.get("selectors", {})
                    xpath_selector = selectors.get("xpath", "")
                
                # Create primary selector from element data
                primary_selector = {
                    "tag": tag,
                    "css_selector": css_selector,
                    "xpath_selector": xpath_selector,
                    "selector_quality": "high" if any(attr in css_selector for attr in ["data-testid", "aria-label", "title"]) else "medium"
                }
                
                # Alternative selectors with all element metadata
                alt_selectors = {
                    "tag": element.get("tag", ""),
                    "text": element.get("text", "")[:200],  # Limit text length
                    "id": element.get("attributes", {}).get("id", ""),
                    "class": element.get("attributes", {}).get("class", ""),
                    "data-testid": element.get("attributes", {}).get("data-testid", ""),
                    "position": element.get("position", {}),
                    "isVisible": element.get("visible", False),
                    "isInteractive": element.get("isInteractive", False)
                }
                
                # All attributes
                attributes = element.get("attributes", {})
                
                # Import json and serialize the data
                import json
                
                await db.execute_one(element_query,
                    page_id, element_key, 
                    json.dumps(primary_selector), 
                    json.dumps(alt_selectors), 
                    json.dumps(attributes),
                    True
                )
                
                stored_count += 1
                
            except Exception as e:
                continue
        
        return stored_count
        
    except Exception as e:
        return 0

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "enterprise-ai-service",
        "features": {
            "openai_configured": bool(enterprise_ai_service.client),
            "caching_enabled": True,
            "cost_tracking_enabled": True,
            "element_ranking_enabled": True
        },
        "timestamp": time.time()
    }