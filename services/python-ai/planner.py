from typing import List, Dict, Any
from schema import PlanItem
from rules import plan_for as fallback_rules  # keep as backup
from intent.model import IntentModel
from action_catalog import ActionCatalog

class LocalPlanner:
    def __init__(self) -> None:
        self.im = IntentModel()
        self.catalog = ActionCatalog()  # Action ID mapping system

    def make_plan(self, prompt: str) -> List[PlanItem]:
        # Step 1: Get ML intent prediction
        intent = self.im.predict_intent(prompt)
        
        # Step 2: Extract context from prompt with enhanced parameter extraction
        context = self._extract_dynamic_context(prompt)
        
        # Step 3: Map specific scenarios to more precise intents
        refined_intent = self._refine_intent_from_context(intent, prompt, context)
        
        # Step 4: Use Action Catalog to map intent to action IDs
        # Get actions from catalog using refined intent and original prompt for verb analysis
        actions = self.catalog.get_actions_for_intent(refined_intent, context, prompt)
        
        if actions:
            # Convert dictionary actions to PlanItem objects for API compatibility
            plan_items = []
            for action in actions:
                if isinstance(action, dict):
                    plan_items.append(PlanItem(name=action['name'], params=action['params']))
                else:
                    plan_items.append(action)  # Already a PlanItem
            return plan_items
        
        # Step 5: Fall back to deterministic rules for UNKNOWN intents
        return fallback_rules(prompt)
    
    def _extract_dynamic_context(self, prompt: str) -> Dict[str, Any]:
        """
        Enhanced parameter extraction - dynamically extracts ALL relevant data from prompts
        Handles URLs, site names, search terms, names, emails, and verification text
        """
        import re
        context = {}
        
        # Extract URLs (http/https)
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
        urls = re.findall(url_pattern, prompt)
        if urls:
            context['url'] = urls[0]
            context['target_url'] = urls[0]
            # Extract domain name for expected title
            domain = urls[0].split('//')[1].split('/')[0]
            if 'google' in domain.lower():
                context['expected_title'] = 'Google'
            elif 'amazon' in domain.lower():
                context['expected_title'] = 'Amazon'
            elif 'example' in domain.lower():
                context['expected_title'] = 'Example'
            else:
                context['expected_title'] = domain.replace('www.', '').split('.')[0].title()
        
        # Extract site names without full URLs ("Open Google", "Visit Amazon")
        site_patterns = [
            r'(?:open|visit|go to|navigate to)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s|$|\.)',
            r'on\s+([A-Za-z]+)(?:\s|$|\.)',
        ]
        for pattern in site_patterns:
            matches = re.findall(pattern, prompt, re.IGNORECASE)
            if matches:
                site_name = matches[0].strip().lower()
                if site_name in ['google', 'google.com']:
                    context['url'] = 'https://www.google.com'
                    context['expected_title'] = 'Google'
                elif site_name in ['amazon', 'amazon.com']:
                    context['url'] = 'https://www.amazon.com'
                    context['expected_title'] = 'Amazon'
                elif site_name in ['youtube', 'youtube.com']:
                    context['url'] = 'https://www.youtube.com'
                    context['expected_title'] = 'YouTube'
                elif site_name in ['facebook', 'facebook.com']:
                    context['url'] = 'https://www.facebook.com'
                    context['expected_title'] = 'Facebook'
                elif site_name in ['github', 'github.com']:
                    context['url'] = 'https://www.github.com'
                    context['expected_title'] = 'GitHub'
                else:
                    # Generic site handling
                    context['url'] = f'https://www.{site_name.replace(" ", "")}.com'
                    context['expected_title'] = site_name.title()
                break
        
        # Extract search terms (comprehensive patterns)
        search_patterns = [
            r'search for ([^\n\.!?]+?)(?:\s+on\s|\s+in\s|\s+and\s|$)',
            r'find ([^\n\.!?]+?)(?:\s+on\s|\s+in\s|\s+and\s|$)',
            r'look for ([^\n\.!?]+?)(?:\s+on\s|\s+in\s|\s+and\s|$)',
            r'searching ([^\n\.!?]+?)(?:\s+on\s|\s+in\s|\s+and\s|$)'
        ]
        for pattern in search_patterns:
            matches = re.findall(pattern, prompt, re.IGNORECASE)
            if matches:
                context['search_term'] = matches[0].strip()
                context['text'] = matches[0].strip()  # Also set as general text
                break
        
        # Extract names (comprehensive name patterns)
        name_patterns = [
            r'(?:name|called)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)',
            r'with\s+name\s+([A-Z][a-z]+\s+[A-Z][a-z]+)',
            r'([A-Z][a-z]+\s+[A-Z][a-z]+)\s+and\s+email',
            r'form\s+with\s+([A-Z][a-z]+\s+[A-Z][a-z]+)'
        ]
        for pattern in name_patterns:
            matches = re.findall(pattern, prompt)
            if matches:
                context['customer_name'] = matches[0]
                context['name'] = matches[0]
                break
        
        # Extract emails
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, prompt)
        if emails:
            context['customer_email'] = emails[0]
            context['email'] = emails[0]
        
        # Extract verification text
        verify_patterns = [
            r'verify(?:\s+that)?\s+(?:the\s+)?(?:page\s+)?title\s+contains\s+([^\n\.!?]+)',
            r'check\s+(?:that\s+)?(?:the\s+)?title\s+(?:has|contains)\s+([^\n\.!?]+)',
            r'title\s+(?:should\s+)?(?:contain|have)\s+([^\n\.!?]+)'
        ]
        for pattern in verify_patterns:
            matches = re.findall(pattern, prompt, re.IGNORECASE)
            if matches:
                context['expected_title'] = matches[0].strip()
                break
        
        return context
    
    def _refine_intent_from_context(self, base_intent: str, prompt: str, context: Dict[str, Any]) -> str:
        """Refine intent based on extracted context and prompt analysis"""
        prompt_lower = prompt.lower()
        
        # Map to more specific intents based on context
        if "google" in prompt_lower and ("open" in prompt_lower or "verify" in prompt_lower):
            return "GOOGLE_SEARCH"
        elif "amazon" in prompt_lower and "search" in prompt_lower:
            return "AMAZON_SEARCH"
        elif any(word in prompt_lower for word in ["form", "fill", "contact"]) and context.get("customer_name"):
            return "CONTACT_FORM"
        elif "search" in prompt_lower and context.get("site_url"):
            return "GENERIC_SEARCH"
        elif base_intent == "OPEN" and context.get("target_url"):
            return "SITE_NAVIGATION"
        
        return base_intent
