"""
Action ID Catalog - Maps intents to reusable action templates
This completes SCRUM-4 by tying ML intent predictions to action IDs
"""
from typing import Dict, List, Any
from schema import PlanItem

class ActionCatalog:
    """Maps intent classifications to reusable action template IDs"""
    
    def __init__(self):
        # Verb-to-Action mapping for dynamic action generation
        self.verb_actions = {
            # Navigation verbs
            "open": self._create_open_action,
            "visit": self._create_open_action,
            "navigate": self._create_open_action,
            "go": self._create_open_action,
            
            # Input/Form verbs
            "type": self._create_input_action,
            "enter": self._create_input_action,
            "fill": self._create_input_action,
            "input": self._create_input_action,
            "write": self._create_input_action,
            
            # Click verbs
            "click": self._create_click_action,
            "press": self._create_click_action,
            "tap": self._create_click_action,
            "select": self._create_click_action,
            
            # Verification verbs
            "verify": self._create_verify_action,
            "check": self._create_verify_action,
            "assert": self._create_verify_action,
            "confirm": self._create_verify_action,
            "ensure": self._create_verify_action,
            
            # Wait verbs
            "wait": self._create_wait_action,
            "pause": self._create_wait_action,
            
            # Search verbs
            "search": self._create_search_action,
            "find": self._create_search_action,
            "look": self._create_search_action,
            
            # Login/Authentication verbs
            "login": self._create_login_action,
            "signin": self._create_login_action,
            "authenticate": self._create_login_action,
            "logon": self._create_login_action,
        }
        
        # Legacy templates for backwards compatibility
        self.templates = {
            # Basic workflow templates (kept for complex scenarios)
            "LOGIN_BASIC": [
                {"name": "open_url", "params": {"url": "https://the-internet.herokuapp.com/login"}},
                {"name": "type_css", "params": {"selector": "#username", "text": "tomsmith"}},
                {"name": "type_css", "params": {"selector": "#password", "text": "SuperSecretPassword!"}},
                {"name": "click_css", "params": {"selector": "button[type='submit']"}},
                {"name": "wait_for_css", "params": {"selector": "#content"}},
                {"name": "assert_title_contains", "params": {"text": "The Internet"}},
            ],

        }
        
        # Simplified intent mappings - most actions are now verb-driven
        self.intent_mappings = {
            "LOGIN": ["LOGIN_BASIC"],  # Keep for complex workflows
        }
    
    def _create_open_action(self, context):
        """Create dynamic open/navigation action"""
        url = context.get('url', 'https://example.com')
        
        return [
            {"name": "open_url", "params": {"url": url}},
            {"name": "wait_for_css", "params": {"selector": "body"}},
        ]
    
    def _create_input_action(self, context):
        """Create dynamic input/type action with intelligent field detection"""
        actions = []
        
        # If we have both name and email, create separate actions for each
        if context.get('customer_name') and context.get('customer_email'):
            # Name field
            name_selector = context.get('name_selector', 'input[name*="name"], input[id*="name"], .name-input, #name')
            actions.append({
                "name": "type_css", 
                "params": {"selector": name_selector, "text": context['customer_name']}
            })
            
            # Email field  
            email_selector = context.get('email_selector', 'input[name*="email"], input[id*="email"], input[type="email"], .email-input, #email')
            actions.append({
                "name": "type_css",
                "params": {"selector": email_selector, "text": context['customer_email']}
            })
        else:
            # Single input action
            text = context.get('text', context.get('search_term', context.get('customer_name', context.get('customer_email', 'test'))))
            
            # Smart selector based on context
            if context.get('search_term'):
                selector = context.get('selector', 'input[name="q"], input[type="search"], .search-input, #search, [placeholder*="search"]')
            elif context.get('customer_name'):
                selector = context.get('selector', 'input[name*="name"], input[id*="name"], .name-input, #name')
            elif context.get('customer_email'):
                selector = context.get('selector', 'input[name*="email"], input[id*="email"], input[type="email"], .email-input, #email')
            else:
                selector = context.get('selector', 'input[type="text"], input[type="search"], textarea, .form-input')
            
            actions.append({"name": "type_css", "params": {"selector": selector, "text": text}})
        
        return actions
    
    def _create_click_action(self, context):
        """Create dynamic click action"""
        selector = context.get('selector', 'button, .btn, input[type="submit"]')
        wait_selector = context.get('wait_selector', 'body')
        
        actions = [
            {"name": "click_css", "params": {"selector": selector}},
        ]
        
        if wait_selector != 'body':
            actions.append({"name": "wait_for_css", "params": {"selector": wait_selector}})
            
        return actions
    
    def _create_verify_action(self, context, prompt=""):
        """Create dynamic verification action based on what needs to be verified"""
        import re
        
        # Check what should be verified from the prompt
        if 'results' in prompt.lower() or 'shown' in prompt.lower() or 'displayed' in prompt.lower():
            # Verify results are visible/present - only element visibility check
            return [
                {"name": "assert_element_visible", "params": {"selector": ".search-results, .results, [data-component-type='s-search-result'], .s-result-item"}},
            ]
        elif 'title' in prompt.lower() and ('verify title' in prompt.lower() or 'check title' in prompt.lower()):
            # Only verify title if explicitly mentioned with "verify title" or "check title"
            text = context.get('expected_title', context.get('text', 'Page'))
            return [
                {"name": "assert_title_contains", "params": {"text": text}},
            ]
        else:
            # Default to element visibility verification - NO title assertion
            selector = context.get('selector', '.search-results, .results, [data-component-type="s-search-result"], .s-result-item')
            return [
                {"name": "assert_element_visible", "params": {"selector": selector}},
            ]
    
    def _create_login_workflow(self, context):
        """Create a complete login workflow for single-word 'login' prompts"""
        url = context.get('url', 'https://the-internet.herokuapp.com/login')
        username = context.get('username', context.get('customer_name', 'tomsmith'))
        password = context.get('password', 'SuperSecretPassword!')
        
        return [
            {"name": "open_url", "params": {"url": url}},
            {"name": "wait_for_css", "params": {"selector": "body"}},
            {"name": "type_css", "params": {"selector": "#username, input[name='username'], input[type='text']", "text": username}},
            {"name": "type_css", "params": {"selector": "#password, input[name='password'], input[type='password']", "text": password}},
            {"name": "click_css", "params": {"selector": "button[type='submit'], input[type='submit'], .login-button, #login-button"}},
            {"name": "wait_for_css", "params": {"selector": ".flash, .alert, .success, #content, .dashboard"}},
        ]
    
    def _create_wait_action(self, context):
        """Create dynamic wait action"""
        selector = context.get('selector', 'body')
        duration = context.get('duration', 2000)
        
        if selector:
            return [{"name": "wait_for_css", "params": {"selector": selector}}]
        else:
            return [{"name": "wait", "params": {"duration": duration}}]
    
    def _create_search_action(self, context):
        """Create dynamic search action with site-specific optimization"""
        search_term = context.get('search_term', context.get('text', 'test'))
        
        # Site-specific selectors based on URL or site context
        if 'amazon' in context.get('url', '').lower() or 'amazon' in context.get('expected_title', '').lower():
            search_selector = '#twotabsearchtextbox'
            submit_selector = '#nav-search-submit-button, .nav-search-submit'
            results_selector = '[data-component-type="s-search-result"], .s-result-item'
        elif 'google' in context.get('url', '').lower() or 'google' in context.get('expected_title', '').lower():
            search_selector = 'input[name="q"], .gLFyf'
            submit_selector = 'button[name="btnK"], .gNO89b'
            results_selector = '#search .g, .g'
        else:
            # Generic selectors
            search_selector = context.get('search_selector', 'input[name="q"], input[type="search"], #search, .search-input')
            submit_selector = context.get('submit_selector', 'button[type="submit"], .search-button, input[type="submit"]')
            results_selector = context.get('results_selector', '.search-results, .results, .search-result')
        
        return [
            {"name": "type_css", "params": {"selector": search_selector, "text": search_term}},
            {"name": "click_css", "params": {"selector": submit_selector}},
            {"name": "wait_for_css", "params": {"selector": results_selector}},
        ]
    
    def _create_login_action(self, context):
        """Create dynamic login workflow"""
        # Get login details from context or use defaults
        username = context.get('username', context.get('customer_name', 'tomsmith'))
        password = context.get('password', 'SuperSecretPassword!')
        login_url = context.get('url', context.get('login_url', 'https://the-internet.herokuapp.com/login'))
        
        return [
            {"name": "open_url", "params": {"url": login_url}},
            {"name": "type_css", "params": {"selector": "#username, input[name='username'], input[name='email'], input[type='email']", "text": username}},
            {"name": "type_css", "params": {"selector": "#password, input[name='password'], input[type='password']", "text": password}},
            {"name": "click_css", "params": {"selector": "button[type='submit'], input[type='submit'], .login-button, .btn-login"}},
            {"name": "wait_for_css", "params": {"selector": "body"}},
        ]
    
    def generate_actions_from_verbs(self, prompt, context):
        """
        Generate test actions dynamically based on verbs found in the prompt
        This is the new primary method that replaces hardcoded templates
        """
        import re
        
        # Extract verbs from the prompt in order of appearance
        verbs = []
        words = re.findall(r'\b\w+\b', prompt.lower())
        
        for word in words:
            if word in self.verb_actions and word not in verbs:  # Avoid duplicate verbs
                verbs.append(word)
        
        # If no verbs found, try to infer from context or single-word prompts
        if not verbs:
            # Check for single-word intent patterns
            prompt_lower = prompt.lower().strip()
            if prompt_lower in ['login', 'signin', 'sign in', 'log in', 'authenticate']:
                verbs.append('login')
            elif prompt_lower in ['search', 'find', 'look']:
                verbs.append('search')
            elif context.get('url'):
                verbs.append('open')
            elif context.get('search_term'):
                verbs.append('search')
            elif context.get('text') and not context.get('search_term'):
                verbs.append('type')
        
        # Generate actions based on verbs, avoiding duplicates
        actions = []
        seen_actions = set()  # Track action signatures to avoid duplicates
        
        for verb in verbs:
            if verb in self.verb_actions:
                # Pass prompt to verify action for better context
                if verb == 'verify' or verb == 'check' or verb == 'assert' or verb == 'confirm' or verb == 'ensure':
                    verb_actions = self.verb_actions[verb](context, prompt)
                else:
                    verb_actions = self.verb_actions[verb](context)
                
                for action in verb_actions:
                    # Create a signature for the action to detect duplicates
                    action_signature = f"{action['name']}:{action['params'].get('selector', '')}:{action['params'].get('text', '')}"
                    
                    if action_signature not in seen_actions:
                        seen_actions.add(action_signature)
                        actions.append(action)
        
        # If no actions generated, create a basic open action
        if not actions:
            actions = self._create_open_action(context)
        
        return actions

    def get_actions_for_intent(self, intent, context=None, prompt=""):
        """
        Convert ML intent prediction to action sequence using verb-based generation
        
        Args:
            intent: Predicted intent from ML model  
            context: Parameters for action generation
            prompt: Original user prompt for verb analysis
            
        Returns:
            List of action dictionaries for execution
        """
        context = context or {}
        
        print(f"[ActionCatalog] Getting actions for intent: {intent}")
        print(f"[ActionCatalog] Context: {context}")
        print(f"[ActionCatalog] Using verb-based generation")
        
        # Primary approach: Generate actions from verbs in the prompt
        if prompt:
            verb_actions = self.generate_actions_from_verbs(prompt, context)
            if verb_actions:
                print(f"[ActionCatalog] Generated {len(verb_actions)} actions from verbs")
                return verb_actions
        
        # Enhanced intent-specific handling for single-word prompts
        if intent == "LOGIN" or (prompt and prompt.lower().strip() in ['login', 'log in', 'sign in', 'signin']):
            print(f"[ActionCatalog] Using LOGIN workflow for prompt: {prompt}")
            return self._create_login_workflow(context)
        
        # Fallback: Use template-based approach for complex intents
        template_ids = self.intent_mappings.get(intent, [])
        if template_ids:
            template_id = template_ids[0]  # Use first template as fallback
            template = self.templates.get(template_id, [])
            if template:
                print(f"[ActionCatalog] Using template fallback: {template_id}")
                return self._substitute_parameters(template, context)
        
        # Final fallback: Create basic action based on context
        print(f"[ActionCatalog] Using context-based fallback for intent: {intent}")
        return self._create_open_action(context)
    
    def _substitute_parameters(self, template: list, context: Dict[str, Any]) -> list:
        """Replace template variables with actual values for legacy templates"""
        # Default values for common scenarios
        defaults = {
            "search_term": "laptops",
            "customer_name": "John Doe", 
            "customer_email": "john@example.com",
            "url": "https://example.com",
            "expected_title": "Example"
        }
        
        result = []
        for action_def in template:
            new_action = {"name": action_def["name"], "params": {}}
            
            for key, value in action_def["params"].items():
                if isinstance(value, str) and value.startswith("{") and value.endswith("}"):
                    # Template variable
                    var_name = value[1:-1]  # Remove { }
                    new_action["params"][key] = context.get(var_name) or defaults.get(var_name, value)
                else:
                    new_action["params"][key] = value
            
            result.append(new_action)
        return result
    
    def list_available_actions(self) -> Dict[str, List[str]]:
        """Return mapping of intents to available action template IDs"""
        return self.intent_mappings.copy()
    
    def get_template(self, template_id: str) -> List[Dict[str, Any]]:
        """Get raw template by ID"""
        return self.templates.get(template_id, [])