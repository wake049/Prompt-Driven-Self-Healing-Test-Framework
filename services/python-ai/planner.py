from typing import List
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
        
        # Step 2: Extract context from prompt
        url = self.im.extract_url(prompt)
        context = {
            "url": url or "https://example.com",
            "expected_title": "Example",
            "title_text": "Example",
            "search_term": "test",
            "base_url": "https://example.com",
            "site_name": "Example"
        }
        
        # Step 3: Use Action Catalog to map intent to action IDs
        actions = self.catalog.get_actions_for_intent(intent, context)
        
        if actions:
            return actions
        
        # Step 4: Fall back to deterministic rules for UNKNOWN intents
        return fallback_rules(prompt)
