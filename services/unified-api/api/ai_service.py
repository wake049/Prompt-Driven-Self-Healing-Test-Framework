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
        
        # Initialize OpenAI
        self.client = None
        self.config = self._load_config()
        self._initialize_openai()
        
        # Rate limiting
        self.last_openai_call = 0
        self.min_call_interval = 2.0  # Minimum 2 seconds between OpenAI calls

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration for OpenAI and other services"""
        return {
            "openai": {
                "apiKey": os.getenv("OPENAI_API_KEY", ""),
                "enabled": _bool_env("OPENAI_ENABLED", True),
                "timeout": int(os.getenv("OPENAI_TIMEOUT_MS", "20000")),
                "maxRetries": int(os.getenv("OPENAI_MAX_RETRIES", "1")),
                "model": os.getenv("OPENAI_MODEL", "gpt-4o"),
            }
        }

    def _initialize_openai(self) -> None:
        """Initialize OpenAI client"""
        try:
            api_key = self.config["openai"]["apiKey"]
            logger.info(f"Initializing OpenAI client - API key present: {bool(api_key)}, length: {len(api_key) if api_key else 0}")
            
            if not api_key:
                logger.warning("⚠️  OPENAI_API_KEY not set - falling back to heuristic mode")
                self.client = None
                return
                
            if OpenAI is None:
                logger.warning("⚠️  OpenAI library not available - falling back to heuristic mode")
                self.client = None
                return
            
            # Validate API key format
            if not api_key.startswith('sk-'):
                logger.error("❌ Invalid OpenAI API key format (should start with 'sk-')")
                self.client = None
                return
                
            self.client = OpenAI(api_key=api_key)
            logger.info("✅ OpenAI client initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize OpenAI client: {str(e)}")
            self.client = None
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
        
        try:
            # Load existing bindings for this prompt if available
            existing_bindings = None
            prompt_id = getattr(prompt_envelope, 'prompt_id', None)
            
            if prompt_id:
                try:
                    from core.database import get_database_manager
                    db = await get_database_manager()
                    
                    # Load existing bindings from datahub.data_bindings table for this specific prompt
                    scope_name = f"prompt_{prompt_id}"
                    bindings_query = """
                        SELECT rule_name, scope, matcher, source_ref, target 
                        FROM datahub.data_bindings 
                        WHERE is_active = true AND scope = $1
                        ORDER BY priority DESC, created_at DESC
                    """
                    existing_bindings = await db.execute(bindings_query, scope_name)
                    
                    # If no prompt-specific bindings found, try general active bindings
                    if not existing_bindings:
                        fallback_query = """
                            SELECT rule_name, scope, matcher, source_ref, target 
                            FROM datahub.data_bindings 
                            WHERE is_active = true 
                            ORDER BY priority DESC, created_at DESC
                            LIMIT 10
                        """
                        existing_bindings = await db.execute(fallback_query)
                    
                    # Debug: Log first binding structure
                    if existing_bindings and len(existing_bindings) > 0:
                        first_binding = existing_bindings[0]
                    
                    # Also load element repository data for automatic selector population
                    elements_query = """
                        SELECT element_key, primary_selector 
                        FROM repo.elements 
                        WHERE element_key LIKE '%price%' OR element_key LIKE '%total%' OR element_key LIKE '%subtotal%'
                        ORDER BY created_at DESC
                    """
                    repository_elements = await db.execute(elements_query)
                    
                    # Create a mapping of element keys to selectors
                    element_selectors = {}
                    for element in repository_elements:
                        if isinstance(element['primary_selector'], dict):
                            css_selector = element['primary_selector'].get('css_selector', '')
                            if css_selector:
                                element_selectors[element['element_key']] = css_selector
                    
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
                        
                    except Exception as e:self._cache_policy_preference(True)
                    
                except Exception as e:existing_bindings = None
                
                # Process bindings if they were loaded successfully
                if existing_bindings:
                    
                            # Load allowed variables into the validator
                            self.variable_validator.load_allowed_variables(existing_bindings)
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
                                    except json.JSONDecodeError:target = {}
                                
                                # Extract variable name from target
                                if isinstance(target, dict):
                                    var_name = target.get('variable_name') or target.get('name') or rule_name
                                else:
                                    var_name = rule_name
                                
                                binding_names.append(var_name)
                                
                                # Always add to extraction bindings - we extract ALL defined variables
                                price_bindings.append(binding)# Also classify by type for additional context
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

            # Generate test steps using AI when available, fallback to heuristic
            logger.info(f"🤖 Checking AI availability - Client: {bool(self.client)}, Enabled: {self.config['openai']['enabled']}")
            
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
                clarifications=[],
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
        
        logger.info(f"🤖 Starting AI plan generation with {len(ranked_elements)} elements")
        
        # Build optimized prompts with full context
        system_prompt = self._build_enhanced_system_prompt()
        user_prompt = self._build_enhanced_user_prompt(prompt_envelope, ranked_elements)
        
        logger.debug(f"📝 System prompt length: {len(system_prompt)} chars")
        logger.debug(f"📝 User prompt length: {len(user_prompt)} chars")
        
        # Estimate input tokens
        input_tokens = len(system_prompt + user_prompt) // 4
        logger.info(f"💰 Estimated input tokens: {input_tokens}")
        
        try:
            logger.info(f"🔗 Calling OpenAI API - Model: {self.config['openai']['model']}")
            
            response = await self._chat_json(
                model=self.config["openai"]["model"],
                system=system_prompt,
                user=user_prompt,
                max_tokens=min(4000, prompt_envelope.max_steps * 150),  # Increased token limit for comprehensive tests
                temperature=0.1,  # Lower temperature for more consistent JSON
                retries=self.config["openai"]["maxRetries"],
                timeout_ms=prompt_envelope.timeout_ms
            )
            
            logger.info(f"✅ OpenAI API response received, length: {len(response)} chars")
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
                raw_steps = parsed.get("steps", [])  # Object format with steps property
            
            # Convert to PlanStep objects with element validation
            steps = []
            for i, raw_step in enumerate(raw_steps[:prompt_envelope.max_steps]):
                # Apply policy-based selector transformation to AI-generated target
                original_target = raw_step.get("target")
                
                # Validate that the target element actually exists in our ranked_elements
                step_selector = raw_step.get("args", {}).get('selector', original_target)
                element_found = False
                matching_element = None
                
                for el in ranked_elements:
                    el_id = self._get_element_id(el)
                    el_selector = self._get_element_selector(el)
                    el_text = self._get_element_text(el).lower()
                    
                    # Check multiple matching criteria
                    if (el_id == original_target or 
                        el_selector == step_selector or 
                        step_selector in el_selector or
                        el_selector in step_selector):
                        element_found = True
                        matching_element = el
                        logger.debug(f"✅ Step {i+1} validated - found element: {original_target} -> {el_selector}")
                        break
                
                if not element_found:
                    logger.warning(f"❌ Step {i+1} REJECTED - element not found: {original_target} ({step_selector})")
                    logger.warning(f"   Available elements: {[self._get_element_selector(el) for el in ranked_elements[:3]]}")
                    continue  # Skip this step entirely
                
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
            steps.extend(await self._generate_login_steps(ranked_elements))
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
    
    async def _generate_login_steps(self, elements: List[Any]) -> List[PlanStep]:
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
        if username_el:
            logger.debug(f"✅ Found username element: {self._get_element_selector(username_el)}")
            username_selector = await self._get_policy_based_element_selector(username_el)
            steps.append(PlanStep(
                action="type",
                target=self._get_element_id(username_el),
                args={
                    "selector": self._get_element_selector(username_el), 
                    "text": "standard_user",
                    "element_type": "username_field"
                },
                description="Enter username/email",
                confidence=0.9
            ))
        else:
            logger.debug("❌ No username field found")

        # Find password field
        password_el = self._find_element_by_keywords(elements, ["password"])
        if password_el:
            logger.debug(f"✅ Found password element: {self._get_element_selector(password_el)}")
            password_selector = await self._get_policy_based_element_selector(password_el)
            steps.append(PlanStep(
                action="type", 
                target=self._get_element_id(password_el),
                args={
                    "selector": self._get_element_selector(password_el), 
                    "text": "secret_sauce",
                    "element_type": "password_field"
                },
                description="Enter password",
                confidence=0.9
            ))
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
    
    def _build_enhanced_system_prompt(self) -> str:
        """Build enhanced system prompt for intelligent test generation"""
        return """You are a QA automation engineer. Generate test steps in valid JSON format.

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
- When using variables in assert_text, include the variable name in the "text" field as "${variableName}"
- Only use variables that are explicitly defined in the data bindings
- Example: {"action": "extract_data", "target": ".price-display", "args": {"selector": ".price-display", "variable": "backpackPrice"}}
- Example: {"action": "calculate", "target": "", "args": {"formula": "itemSubTotal = backpackPrice + onesiePrice", "result_variable": "itemSubTotal"}}
- Example: {"action": "assert_text", "target": ".total-label", "args": {"selector": ".total-label", "text": "Total: ${itemSubTotal}"}}
- Variables will be dynamically replaced with their extracted values during test execution

**PREDEFINED VARIABLES (when provided):**
- Use ONLY the variable names that are explicitly defined in the data bindings context
- Do NOT create new variable names beyond what is provided
- Match variable names exactly as specified in the bindings configuration
- Respect the distinction between extract-type and calculate-type variables

**AVAILABLE ACTIONS:**
- open_url: Navigate to start page
- type: Enter text into form fields  
- click: Click buttons, links, and interactive elements
- assert_text: Verify text content of elements
- assert_visible: Verify elements are visible
- wait_for: Wait for page transitions or elements to load
- extract_data: Extract dynamic values from page elements and store in variables
- calculate: Perform mathematical operations on extracted variables
- screenshot: Capture page state

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
      "target": ".inventory_item_price",
      "args": {
        "selector": ".inventory_item_price",
        "variable": "backpackPrice",
        "timeout": 5000
      },
      "description": "Extract backpack price from page",
      "confidence": 0.9
    },
    {
      "action": "calculate",
      "target": "",
      "args": {
        "formula": "itemSubTotal = backpackPrice + onesiePrice",
        "result_variable": "itemSubTotal"
      },
      "description": "Calculate total from individual values",
      "confidence": 0.9
    },
    {
      "action": "assert_text",
      "target": ".summary_total_label",
      "args": {
        "selector": ".summary_total_label",
        "text": "Total: ${itemSubTotal}",
        "timeout": 5000
      },
      "description": "Verify calculated total matches displayed total",
      "confidence": 0.9
    }
  ]
}

Generate comprehensive workflow with EXTENSIVE VERIFICATION of all relevant elements for any webpage."""
    
    def _build_enhanced_user_prompt(self, prompt_envelope: PromptEnvelope, ranked_elements: List[Any]) -> str:
        """Build enhanced user prompt with rich context for AI"""
        
        # Categorize elements by general functionality (website-agnostic)
        input_elements = []
        button_elements = []
        link_elements = []
        content_elements = []
        
        for el in ranked_elements:
            tag = self._get_element_tag(el)
            selector = self._get_element_selector(el)
            text = self._get_element_text(el)
            
            if tag.lower() in ['button', 'a', 'input', 'select', 'textarea'] and selector:
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
🚫 ONLY use elements from the PROVIDED ELEMENTS list above
🚫 DO NOT generate steps for elements that are NOT in the list
🚫 DO NOT assume elements exist (like #password, #login-button, etc.)
🚫 DO NOT create fictional selectors or elements

✅ ONLY reference selectors that appear in the elements list above
✅ If required elements are missing, note this in clarifications
✅ Generate steps ONLY for the elements that actually exist

Generate an ADAPTIVE workflow based on the website type and user request:

0. ELEMENT VALIDATION (MANDATORY):
   - Before creating ANY step, verify the target element exists in the PROVIDED ELEMENTS list above
   - If a step requires an element not in the list, SKIP that step entirely
   - Add clarification explaining which expected elements are missing

1. ANALYZE WEBSITE TYPE from URL and available elements:
   - E-commerce: Look for product, cart, checkout elements
   - Airlines: Look for flight search, booking, date picker elements  
   - Banking: Look for account, transfer, balance elements
   - News/Content: Look for articles, categories, search elements
   - General: Identify primary functionality from available elements

2. FOCUS ON USER'S SPECIFIC REQUEST:
   - If "test search functionality" → Focus on search boxes, filters, results
   - If "test booking flow" → Focus on date pickers, forms, booking buttons
   - If "test navigation" → Focus on menus, links, page transitions
   - If "comprehensive testing" → Test all major functionality for that site type

3. LOGICAL WORKFLOW for the identified website type:
   - Airlines: Search flights → Select dates → Choose flights → Enter passenger info
   - E-commerce: Browse products → Add to cart → View cart → Checkout
   - Banking: Login → Select account → Perform transactions
   - News: Navigate categories → Read articles → Use search
   - Forms: Fill fields → Validate → Submit → Verify results

4. VERIFY elements appropriate to the website and request:
   - Don't test shopping cart elements on airline sites
   - Don't test flight booking elements on news sites
   - Focus on elements that match the website's actual purpose

5. ADAPTIVE STATE MANAGEMENT:
   - Understand element states specific to this website type
   - Follow logical interaction sequences for this domain
   - Verify results appropriate to the website's functionality

6. End with a screenshot for documentation

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
                timeout_ms=30000
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
                    
                    # Log for debugging
                    if essential_step["action"] == "type" and essential_step["text_value"]:
                        essential_steps.append(essential_step)
                    elif essential_step["action"] == "type":
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
        failed_step_numbers = {step.get("step_order", 0) for step in failed_steps}
        
        # Heuristic rules based on optimization level
        essential_actions = {"open_url", "click", "type", "select"}
        setup_actions = {"wait", "navigate", "wait_for"}
        verification_actions = {"assert", "verify", "check"}
        
        essential_steps = []
        
        for step in all_steps:
            step_number = step.get("step_order", 0)
            action = step.get("action", "").lower()
            
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
                elif optimization_level == "moderate" and step_number <= max(failed_step_numbers):
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
        """Call OpenAI Chat Completions with JSON response format"""
        logger.debug(f"🤖 Starting OpenAI chat completion: model={model}, max_tokens={max_tokens}")
        
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
                elif "timeout" in error_msg:
                    logger.warning(f"⏱️ OpenAI API timeout: {str(e)}")
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
        # Follow the relationship: exec.runs -> tests.test_cases -> planner.prompts -> planner.plans
        execution_query = """
        SELECT r.*, 
               p.text as prompt_text, 
               p.intent as prompt_title, 
               pl.plan_json
        FROM exec.runs r
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        LEFT JOIN planner.prompts p ON tc.source_ref_id = p.id
        LEFT JOIN planner.plans pl ON p.id = pl.prompt_id
        WHERE r.id = $1
        """
        execution = await db.execute_one(execution_query, execution_id)
        
        if not execution:
            raise HTTPException(status_code=404, detail=f"Execution {execution_id} not found")
        
        # Parse the original plan to get step data with text values
        original_plan_steps = []
        if execution.get('plan_json'):
            import json
            plan_data = json.loads(execution['plan_json'])
            original_plan_steps = plan_data.get('steps', [])
        else:
            # Get all steps for this execution with full step data
            steps_query = """
                SELECT id, step_order, action, target, status, error_message, created_at
                FROM exec.step_results 
                WHERE test_run_id = $1 
                ORDER BY step_order ASC
                """
        all_steps = await db.execute(steps_query, execution_id)
        
        # Enrich step data with original plan information (including text values)
        enriched_steps = []
        for step in all_steps:
            step_order = step.get('step_order', 0)
            enriched_step = dict(step)
            
            # Try to find the corresponding plan step (plan steps are 1-indexed)
            if step_order <= len(original_plan_steps):
                plan_step = original_plan_steps[step_order - 1]
                params = plan_step.get('params', {})
                
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
            sr.error_message,
            sr.action,
            sr.step_order,
            sr.created_at,
            r.id as execution_id,
            tc.prompt_text,
            tc.prompt_title
        FROM exec.step_results sr
        JOIN exec.runs r ON sr.test_run_id = r.id
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        WHERE sr.status = 'failed' 
        AND sr.target LIKE $1
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
        
        # Helper function to generate semantic element key
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
            def clean_text_for_key(text_input: str, max_length: int = 20) -> str:
                if not text_input:
                    return ""
                # Remove special characters, keep only alphanumeric
                clean = "".join(c for c in text_input if c.isalnum() or c.isspace())
                # Convert to camelCase
                words = clean.split()
                if not words:
                    return ""
                result = words[0].lower()
                for word in words[1:]:
                    result += word.capitalize()
                return result[:max_length]
            
            # Determine element purpose and generate key
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
                
                # Create primary selector from element data
                selectors = element.get("selectors", {})
                primary_selector = {
                    "tag": element.get("tag", ""),
                    "css": selectors.get("cssPath", ""),
                    "xpath": selectors.get("xpath", ""),
                    "name": selectors.get("name", "")
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