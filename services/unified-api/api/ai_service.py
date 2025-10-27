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
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple
import asyncio
from pathlib import Path
import asyncio

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
from core.database import get_database

logger = logging.getLogger(__name__)


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
                self.allowed_variables.add(var_name)
                logger.info(f"🔐 Added allowed variable: {var_name}")
        
        # Create mapping for common invented variable names to real ones
        self._create_variable_mappings()
        
        logger.info(f"🔐 Loaded {len(self.allowed_variables)} allowed variables: {sorted(self.allowed_variables)}")
    
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
        
        logger.info(f"🔄 Created variable mappings: {self.variable_mappings}")
    
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
            logger.warning(f" Corrected invented variable: {variable_name} -> {corrected}")
            return corrected
        
        # Try to find the closest allowed variable using fuzzy matching
        closest = self._find_closest_variable(variable_name)
        if closest:
            logger.warning(f" Fuzzy matched variable: {variable_name} -> {closest}")
            return closest
        
        # Last resort: reject the variable
        logger.error(f" Rejected unknown variable: {variable_name}. Allowed: {sorted(self.allowed_variables)}")
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
                    logger.error(f" Removing extract_data step with invalid variable: {step.args.get('variable')}")
                    return None
        
        # Check calculate steps
        elif step.action == 'calculate':
            if 'result_variable' in step.args:
                corrected = self.validate_and_correct_variable(step.args['result_variable'])
                if corrected:
                    step.args['result_variable'] = corrected
                else:
                    logger.error(f" Removing calculate step with invalid result variable: {step.args.get('result_variable')}")
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
            else:
                logger.warning(f"🚫 Removing invalid variable reference from text: ${{{var_name}}}")
                return "[INVALID_VARIABLE]"
        
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
            if api_key and OpenAI is not None:
                self.client = OpenAI(api_key=api_key)
                logger.info(" OpenAI client initialized successfully")
            else:
                logger.warning(" OpenAI API key not found - using heuristic fallback only")
        except Exception as e:
            logger.exception(" Failed to initialize OpenAI client: %s", e)

    def _enforce_rate_limit(self) -> None:
        """Enforce rate limiting between OpenAI API calls"""
        current_time = time.time()
        time_since_last_call = current_time - self.last_openai_call
        
        if time_since_last_call < self.min_call_interval:
            sleep_time = self.min_call_interval - time_since_last_call
            logger.info(f"⏱️ Rate limiting: waiting {sleep_time:.1f}s before OpenAI call")
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
                    logger.info(f"🔗 Raw bindings query returned {len(existing_bindings) if existing_bindings else 0} results for scope: {scope_name}")
                    
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
                        logger.info(f"🔗 Fallback: Found {len(existing_bindings) if existing_bindings else 0} general active bindings")
                    
                    # Debug: Log first binding structure
                    if existing_bindings and len(existing_bindings) > 0:
                        first_binding = existing_bindings[0]
                        logger.info(f" First binding structure: {first_binding}")
                        logger.info(f" Target field type: {type(first_binding.get('target', 'missing'))}")
                    
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
                    
                    logger.info(f"🏗️ Found {len(element_selectors)} price/total elements in repository: {list(element_selectors.keys())}")
                    
                except Exception as e:
                    logger.error(f" Failed to load data bindings: {e}")
                    existing_bindings = None
                
                # Process bindings if they were loaded successfully
                if existing_bindings:
                    
                    try:
                            # Load allowed variables into the validator
                            self.variable_validator.load_allowed_variables(existing_bindings)
                            
                            logger.info(f"🔄 Starting binding analysis for {len(existing_bindings)} bindings")
                            # Analyze bindings to understand relationships
                            binding_names = []
                            price_bindings = []
                            total_bindings = []
                            
                            for binding in existing_bindings:
                                logger.info(f" Processing binding: {binding.get('rule_name', 'unknown')}")
                                rule_name = binding.get('rule_name', '')
                                target = binding.get('target', {})
                                
                                # Parse target JSON if it's a string
                                if isinstance(target, str):
                                    try:
                                        target = json.loads(target)
                                    except json.JSONDecodeError:
                                        logger.warning(f" Failed to parse target JSON for binding {rule_name}: {target}")
                                        target = {}
                                
                                # Extract variable name from target
                                if isinstance(target, dict):
                                    var_name = target.get('variable_name') or target.get('name') or rule_name
                                else:
                                    var_name = rule_name
                                
                                binding_names.append(var_name)
                                
                                # Always add to extraction bindings - we extract ALL defined variables
                                price_bindings.append(binding)
                                logger.info(f"🏷️ Added for extraction: {var_name}")
                                
                                # Also classify by type for additional context
                                if 'total' in var_name.lower() or 'sum' in var_name.lower():
                                    total_bindings.append(binding)
                                    logger.info(f"🏷️ Also classified as total binding: {var_name}")
                            
                            logger.info(f" Binding classification: {len(price_bindings)} price, {len(total_bindings)} total, {len(binding_names)} total bindings")
                            
                            logger.info(f" About to build binding context - price_bindings: {len(price_bindings)}")
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
                                logger.info(f" ENTERING BINDING CONTEXT GENERATION with {len(price_bindings)} price bindings")
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
                                
                                logger.info(f" About to enhance prompt with binding context (length: {len(binding_context)} chars)")
                                # Modify the prompt to include intelligent binding context
                                original_prompt = prompt_envelope.prompt
                                prompt_envelope.prompt = original_prompt + binding_context
                                logger.info(f"🔗 Enhanced prompt with intelligent bindings context")
                                logger.info(f"📝 Final enhanced prompt length: {len(prompt_envelope.prompt)} chars")
                        
                    except Exception as e:
                        logger.warning(f" Failed to process existing bindings: {str(e)}")
                    
                else:
                    logger.info("ℹ️ No active data bindings found")
            
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
            if not prompt_envelope.page_context and prompt_envelope.page_slice:
                logger.info(" Using smart page context system...")
                
                # Phase 1: Analyze prompt intent
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
                    logger.info(f" Applied smart page context: {smart_context.get('page_type', 'unknown')}")
                else:
                    # Fallback to auto-detection
                    logger.info(" Smart context not found, using auto-detection...")
                    element_selectors = [self._get_element_selector(el) for el in prompt_envelope.page_slice.elements]
                    prompt_envelope.page_context = page_context_service.detect_page_context(
                        page_url=prompt_envelope.page_url,
                        element_selectors=element_selectors
                    )
                    if prompt_envelope.page_context.page_type:
                        logger.info(f"📍 Detected page type: {prompt_envelope.page_context.page_type}")
            
            # Log initial elements received
            if prompt_envelope.page_slice and prompt_envelope.page_slice.elements:
                logger.info(f" Received {len(prompt_envelope.page_slice.elements)} elements for processing")
                
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
                    logger.info(f"  [{i}] {tag}: '{text}' - {selector}")
                    
                    # Categorize elements
                    element_types[tag] = element_types.get(tag, 0) + 1
                    if 'password' in selector.lower() or 'user-name' in selector.lower() or 'login' in selector.lower():
                        login_elements.append(selector)
                    if 'remove-' in selector.lower() or 'inventory' in selector.lower() or 'item' in selector.lower():
                        inventory_elements.append(selector)
                
                if len(prompt_envelope.page_slice.elements) > 10:
                    logger.info(f"  ... and {len(prompt_envelope.page_slice.elements) - 10} more elements")
                
                # Log page state analysis
                logger.info(f" Element analysis: {element_types}")
                # form_elements check removed
                logger.info(f"� Form elements found: {form_elements}")
                if interactive_elements:
                    logger.info(f" Interactive elements found: {interactive_elements}")
                if navigation_elements:
                    logger.info(f"🧭 Navigation elements found: {navigation_elements}")
                    
            else:
                logger.info(" No elements provided in page_slice")
            
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
                logger.info(f" After ranking/filtering: {len(ranked_elements)} elements")
                for i, el in enumerate(ranked_elements[:10]):  # Log first 10 ranked elements
                    tag = self._get_element_tag(el)
                    text = self._get_element_text(el)[:50] + "..." if len(self._get_element_text(el)) > 50 else self._get_element_text(el)
                    selector = self._get_element_selector(el)
                    logger.info(f"  [ranked {i}] {tag}: '{text}' - {selector}")
                if len(ranked_elements) > 10:
                    logger.info(f"  ... and {len(ranked_elements) - 10} more ranked elements")
            else:
                logger.info(" No elements after ranking/filtering")
            
            # Generate test steps using AI when available, fallback to heuristic
            if self.client and self.config["openai"]["enabled"]:
                steps, actual_tokens = await self._generate_ai_plan(prompt_envelope, ranked_elements)
                method = "ai-powered"
                model = self.config["openai"]["model"]
            else:
                steps, actual_tokens = self._generate_heuristic_plan(prompt_envelope, ranked_elements)
                method = "heuristic-fallback"
                model = "rule-based"
                cache_hits += 1  # Heuristic is essentially cached
            
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
            
            logger.info(f" Generated {len(steps)} steps for {prompt_envelope.tenant_id} in {response.processing_time_ms}ms")
            return response
            
        except Exception as e:
            logger.exception(f" Plan generation failed: {e}")
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
        
        # Build optimized prompts with full context
        system_prompt = self._build_enhanced_system_prompt()
        user_prompt = self._build_enhanced_user_prompt(prompt_envelope, ranked_elements)
        
        # Estimate input tokens
        input_tokens = len(system_prompt + user_prompt) // 4
        
        try:
            logger.info(f"🤖 Generating AI plan for: '{prompt_envelope.prompt}' with {len(ranked_elements)} elements")
            logger.info(f"📤 System prompt length: {len(system_prompt)} chars")
            logger.info(f"📤 User prompt length: {len(user_prompt)} chars")
            
            response = await self._chat_json(
                model=self.config["openai"]["model"],
                system=system_prompt,
                user=user_prompt,
                max_tokens=min(4000, prompt_envelope.max_steps * 150),  # Increased token limit for comprehensive tests
                temperature=0.1,  # Lower temperature for more consistent JSON
                retries=self.config["openai"]["maxRetries"],
                timeout_ms=prompt_envelope.timeout_ms
            )
            
            logger.info(f"🤖 Raw AI response (first 200 chars): {response[:200]}...")
            
            # Try to parse JSON with better error handling
            try:
                parsed = json.loads(response)
            except json.JSONDecodeError as e:
                logger.error(f" JSON parsing failed: {e}")
                logger.error(f" Full response: {response}")
                
                # Try to extract and reconstruct JSON from response
                logger.info(" Attempting to extract JSON from response...")
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
                            
                            logger.info(f" Reconstructed JSON (last 200 chars): ...{reconstructed[-200:]}")
                            parsed = json.loads(reconstructed)
                            logger.info(f" Successfully parsed truncated JSON with {len(parsed) if isinstance(parsed, list) else 0} steps")
                        else:
                            # Fallback: just try to find a complete JSON array
                            json_match = re.search(r'\[.*\]', response, re.DOTALL)
                            if json_match:
                                parsed = json.loads(json_match.group())
                            else:
                                # Try legacy object format as final fallback
                                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                                if json_match:
                                    parsed = json.loads(json_match.group())
                                else:
                                    raise e
                    else:
                        # Try legacy object format as fallback
                        json_match = re.search(r'\{.*\}', response, re.DOTALL)
                        if json_match:
                            parsed = json.loads(json_match.group())
                        else:
                            raise e
                        
                except Exception as reconstruction_error:
                    logger.warning(f" JSON reconstruction failed: {reconstruction_error}")
                    raise e
            
            # Handle both array format (new) and object format (legacy)
            if isinstance(parsed, list):
                raw_steps = parsed  # Direct array format
            else:
                raw_steps = parsed.get("steps", [])  # Object format with steps property
            
            # Convert to PlanStep objects with variable validation
            steps = []
            for raw_step in raw_steps[:prompt_envelope.max_steps]:
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
                    logger.warning(f"🚫 Skipping step with invalid variables: {step.action}")
            
            logger.info(f"🤖 AI generated {len(steps)} valid steps (filtered from {len(raw_steps)} raw steps)")
            
            output_tokens = len(response) // 4
            return steps, {"input": input_tokens, "output": output_tokens}
            
        except Exception as e:
            logger.error(f" AI generation failed: {e}")
            raise Exception(f"AI service unavailable: {str(e)}")

    def _generate_heuristic_plan(
        self,
        prompt_envelope: PromptEnvelope,
        ranked_elements: List[Any]
    ) -> Tuple[List[PlanStep], Dict[str, int]]:
        """Generate plan using heuristic rules when AI is unavailable"""
        
        prompt = prompt_envelope.prompt.lower()
        steps = []
        
        # Analyze prompt for intent
        if "login" in prompt or "sign in" in prompt:
            steps.extend(self._generate_login_steps(ranked_elements))
        elif "search" in prompt:
            search_term = self._extract_search_term(prompt_envelope.prompt)
            if search_term:
                steps.extend(self._generate_search_steps(ranked_elements, search_term))
        elif "click" in prompt or "navigate" in prompt:
            link_text = self._extract_link_text(prompt_envelope.prompt)
            if link_text:
                steps.extend(self._generate_navigation_steps(ranked_elements, link_text))
        elif "extract" in prompt or "price" in prompt or "total" in prompt or "calculate" in prompt:
            # Handle data extraction and calculation scenarios
            steps.extend(self._generate_data_extraction_steps(ranked_elements, prompt_envelope.prompt))
        
        # Add generic steps if no specific pattern matched
        if not steps:
            steps.extend(self._generate_generic_steps(ranked_elements, prompt_envelope.prompt))
        
        # Validate variables in heuristic steps too
        validated_steps = []
        for step in steps:
            validated_step = self.variable_validator.validate_step_variables(step)
            if validated_step:
                validated_steps.append(validated_step)
            else:
                logger.warning(f"🚫 Skipping heuristic step with invalid variables: {step.action}")
        
        return validated_steps, {"input": 0, "output": 0}
    


    # =========================
    # STEP GENERATION HELPERS
    # =========================
    
    def _generate_login_steps(self, elements: List[Any]) -> List[PlanStep]:
        """Generate login-specific steps"""
        steps = []
        
        logger.info(f"🔑 Looking for login elements in {len(elements)} available elements")
        
        # Find username/email field
        username_el = self._find_element_by_keywords(elements, ["email", "username", "user", "user-name"])
        if username_el:
            logger.info(f" Found username field: {self._get_element_tag(username_el)} - '{self._get_element_text(username_el)}' - {self._get_element_selector(username_el)}")
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
            logger.warning(" No username/email field found")
        
        # Find password field
        password_el = self._find_element_by_keywords(elements, ["password"])
        if password_el:
            logger.info(f" Found password field: {self._get_element_tag(password_el)} - '{self._get_element_text(password_el)}' - {self._get_element_selector(password_el)}")
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
            logger.warning(" No password field found")
        
        # Find submit button
        submit_el = self._find_element_by_keywords(elements, ["submit", "login", "signin"])
        if submit_el:
            logger.info(f" Found submit button: {self._get_element_tag(submit_el)} - '{self._get_element_text(submit_el)}' - {self._get_element_selector(submit_el)}")
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
            logger.warning(" No submit/login button found")
        
        logger.info(f"🔑 Login step generation complete: {len(steps)} steps created")
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
                    ))
                    
                    logger.info(f" Generated extraction step for {var_name}: {specific_selector}")
            
            # Add calculation step if we have multiple price variables
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
        
        logger.info(f" Generated {len(steps)} data extraction steps")
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
                logger.info(f"📸 Including screenshot in AI prompt: {ctx.screenshot_url}")
            else:
                logger.info("📸 No screenshot available for this page context")
        
        return f"""Request: {prompt_envelope.prompt}
{url_context}
{page_context}
{elements_context}

Generate an ADAPTIVE workflow based on the website type and user request:

0. VISUAL CONTEXT ANALYSIS (when screenshot is available):
   - Carefully examine the provided screenshot to identify visual elements not captured in the element list
   - Pay special attention to navigation patterns like hamburger menus, dropdown menus, and collapsible sections
   - Look for interactive elements that require specific actions to become visible (e.g., hover effects, expandable menus)
   - Use visual context to understand the page layout and user interface patterns

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
        logger.info(f" Searching for keywords {keywords} in {len(elements)} elements (tag_filter: {tag_filter})")
        
        for i, el in enumerate(elements):
            text = self._get_element_text(el).lower()
            attrs = str(self._get_element_attributes(el)).lower()
            tag = self._get_element_tag(el).lower()
            selector = self._get_element_selector(el).lower()  # Also search in selector
            
            if tag_filter and tag != tag_filter:
                continue
                
            for keyword in keywords:
                # Search in text, attributes, AND selector
                if keyword in text or keyword in attrs or keyword in selector:
                    logger.info(f" Found match for '{keyword}': {tag} - text:'{text[:30]}' - selector:{selector}")
                    return el
            
            # Log elements being checked (first 5 only to avoid spam)
            if i < 5:
                logger.debug(f"  Checking [{i}] {tag}: text:'{text[:20]}' selector:'{selector[:30]}' attrs:{attrs[:30]}")
        
        logger.info(f" No match found for keywords {keywords}")
        return None
    
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
        """Get element CSS selector"""
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
    
    def _create_error_response(self, error_message: str, start_time: float) -> PlanResponse:
        """Create response for error scenarios"""
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
        if not self.client:
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
                resp = await asyncio.to_thread(_call)
                content = resp.choices[0].message.content if resp and resp.choices else ""
                return content or ""
            except Exception as e:
                last_err = e
                if attempt > retries:
                    break
                await asyncio.sleep(min(2.0 * attempt, 5.0))
                
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
            logger.info(f" Analyzing prompt intent: '{prompt[:50]}...'")
            
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
            logger.info(f" Identified pages: {intent.get('target_pages', [])} (primary: {intent.get('primary_page', 'unknown')})")
            
            return intent
            
        except Exception as e:
            logger.warning(f" Intent analysis failed: {e}, using fallback")
            return {
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
                logger.info(" No saved page contexts found")
                return None
            
            logger.info(f" Found {len(contexts)} saved page contexts")
            
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
            
            if best_match and best_score > 3:  # Minimum threshold
                logger.info(f" Found matching page context: '{best_match.get('category')}' (score: {best_score})")
                
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
                logger.info(f" No good page context match found (best score: {best_score})")
                return None
                
        except Exception as e:
            logger.error(f" Error fetching smart page context: {e}")
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
            logger.info(f" Analyzing prompt intent: '{prompt[:50]}...'")
            
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
            logger.info(f" Identified pages: {intent.get('target_pages', [])} (primary: {intent.get('primary_page', 'unknown')})")
            
            return intent
            
        except Exception as e:
            logger.warning(f" Intent analysis failed: {e}, using fallback")
            return {
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
                logger.info(" No saved page contexts found")
                return None
            
            logger.info(f" Found {len(contexts)} saved page contexts")
            
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
            
            if best_match and best_score > 3:  # Minimum threshold
                logger.info(f" Found matching page context: '{best_match.get('page_title')}' (score: {best_score})")
                
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
                logger.info(f" No good page context match found (best score: {best_score})")
                return None
                
        except Exception as e:
            logger.error(f" Error fetching smart page context: {e}")
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
        logger.error(f"Error in intent analysis: {str(e)}")
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
        logger.error(f"Error fetching smart page context: {str(e)}")
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
        # Validate and parse request
        prompt_envelope = PromptEnvelope(**request)
        
        # Generate plan
        response = await enterprise_ai_service.plan_test_steps(prompt_envelope)
        
        # Convert to dict for JSON response (with proper datetime serialization)
        response_dict = response.model_dump(mode='json')
        
        # Add compression if requested and beneficial
        should_compress = (
            accept_encoding and "gzip" in accept_encoding.lower() and
            len(json.dumps(response_dict)) > 1024
        )
        
        if should_compress:
            response_dict["compressed"] = True
            
        # Create JSON response with ETag
        json_response = JSONResponse(content=response_dict)
        
        # Add ETag header (based on response content hash)
        import hashlib
        content_str = json.dumps(response_dict, sort_keys=True)
        etag = hashlib.md5(content_str.encode()).hexdigest()[:16]
        json_response.headers["ETag"] = f'"{etag}"'
        json_response.headers["Cache-Control"] = "private, max-age=3600"
        
        return json_response
        
    except Exception as e:
        logger.error(f" /v1/plan endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Plan generation failed: {str(e)}")

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
    except Exception as e:
        logger.error(f" Catalog endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get catalog: {str(e)}")

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