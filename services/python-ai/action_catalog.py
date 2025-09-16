"""
Action ID Catalog - Maps intents to reusable action templates
This completes SCRUM-4 by tying ML intent predictions to action IDs
"""
from typing import Dict, List, Any
from schema import PlanItem

class ActionCatalog:
    """Maps intent classifications to reusable action template IDs"""
    
    def __init__(self):
        # Action templates with unique IDs
        self.templates = {
            # LOGIN action sequences
            "LOGIN_BASIC": [
                {"name": "open_url", "params": {"url": "https://the-internet.herokuapp.com/login"}},
                {"name": "type_css", "params": {"selector": "#username", "text": "tomsmith"}},
                {"name": "type_css", "params": {"selector": "#password", "text": "SuperSecretPassword!"}},
                {"name": "click_css", "params": {"selector": "button[type='submit']"}},
                {"name": "wait_for_css", "params": {"selector": "#content"}},
                {"name": "assert_title_contains", "params": {"text": "The Internet"}},
            ],
            
            # OPEN action sequences
            "OPEN_EXAMPLE": [
                {"name": "open_url", "params": {"url": "https://example.com"}},
                {"name": "wait_for_css", "params": {"selector": "body"}},
                {"name": "assert_title_contains", "params": {"text": "Example"}},
            ],
            
            "OPEN_CUSTOM_URL": [
                {"name": "open_url", "params": {"url": "{url}"}},  # Parameterized
                {"name": "wait_for_css", "params": {"selector": "body"}},
                {"name": "assert_title_contains", "params": {"text": "{expected_title}"}},
            ],
            
            # VERIFY action sequences  
            "VERIFY_TITLE": [
                {"name": "assert_title_contains", "params": {"text": "{title_text}"}},
            ],
            
            # Homepage actions (SCRUM-3 requirement)
            "HOMEPAGE_NAVIGATION": [
                {"name": "open_url", "params": {"url": "{base_url}"}},
                {"name": "wait_for_css", "params": {"selector": "nav, .navigation, .header"}},
                {"name": "assert_title_contains", "params": {"text": "{site_name}"}},
            ],
            
            # Search actions (SCRUM-3 requirement)
            "SEARCH_BASIC": [
                {"name": "type_css", "params": {"selector": "#search, .search-input, [name='search']", "text": "{search_term}"}},
                {"name": "click_css", "params": {"selector": ".search-button, [type='submit']"}},
                {"name": "wait_for_css", "params": {"selector": ".search-results, .results"}},
            ],
            
            # Seats/Checkout actions (SCRUM-3 requirement) 
            "SELECT_SEATS": [
                {"name": "click_css", "params": {"selector": ".seat-selection, .seat"}},
                {"name": "wait_for_css", "params": {"selector": ".seat-selected, .selected"}},
            ],
            
            "CHECKOUT_FLOW": [
                {"name": "click_css", "params": {"selector": ".checkout-button, .proceed"}},
                {"name": "wait_for_css", "params": {"selector": ".checkout-form, .payment"}},
                {"name": "assert_title_contains", "params": {"text": "Checkout"}},
            ],
        }
        
        # Intent to Action ID mapping
        self.intent_mappings = {
            "LOGIN": ["LOGIN_BASIC"],
            "OPEN": ["OPEN_EXAMPLE", "OPEN_CUSTOM_URL"], 
            "VERIFY_TITLE": ["VERIFY_TITLE"],
            "SEARCH": ["SEARCH_BASIC"],
            "SEATS": ["SELECT_SEATS"], 
            "CHECKOUT": ["CHECKOUT_FLOW"],
            "HOMEPAGE": ["HOMEPAGE_NAVIGATION"],
        }
    
    def get_actions_for_intent(self, intent: str, context: Dict[str, Any] = None) -> List[PlanItem]:
        """
        Convert ML intent prediction to action sequence using action IDs
        
        Args:
            intent: Predicted intent from ML model
            context: Parameters for template substitution
            
        Returns:
            List of PlanItem objects for execution
        """
        context = context or {}
        
        # Get action template IDs for this intent
        template_ids = self.intent_mappings.get(intent, [])
        if not template_ids:
            return []
        
        # For OPEN intent, prefer parameterized template if URL provided
        template_id = template_ids[0]
        if intent == "OPEN" and context.get("url") and context["url"] != "https://example.com":
            template_id = "OPEN_CUSTOM_URL"  # Use parameterized version
        
        template = self.templates.get(template_id, [])
        
        # Convert template to PlanItems with parameter substitution
        actions = []
        for action_def in template:
            params = self._substitute_parameters(action_def["params"], context)
            actions.append(PlanItem(
                name=action_def["name"],
                params=params
            ))
        
        return actions
    
    def _substitute_parameters(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """Replace template variables with actual values"""
        result = {}
        for key, value in params.items():
            if isinstance(value, str) and value.startswith("{") and value.endswith("}"):
                # Template variable
                var_name = value[1:-1]  # Remove { }
                result[key] = context.get(var_name, value)  # Use context or keep template
            else:
                result[key] = value
        return result
    
    def list_available_actions(self) -> Dict[str, List[str]]:
        """Return mapping of intents to available action template IDs"""
        return self.intent_mappings.copy()
    
    def get_template(self, template_id: str) -> List[Dict[str, Any]]:
        """Get raw template by ID"""
        return self.templates.get(template_id, [])