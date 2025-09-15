from typing import List
from schema import PlanItem
from rules import plan_for as fallback_rules  # keep as backup
from intent.model import IntentModel

EXAMPLE_URL = "https://example.com"
PRACTICE_LOGIN = "https://the-internet.herokuapp.com/login"

class LocalPlanner:
    def __init__(self) -> None:
        self.im = IntentModel()

    def make_plan(self, prompt: str) -> List[PlanItem]:
        intent = self.im.predict_intent(prompt)
        url = self.im.extract_url(prompt)

        if intent == "LOGIN":
            return [
                PlanItem(name="open_url", params={"url": PRACTICE_LOGIN}),
                PlanItem(name="type_css", params={"selector": "#username", "text": "tomsmith"}),
                PlanItem(name="type_css", params={"selector": "#password", "text": "SuperSecretPassword!"}),
                PlanItem(name="click_css", params={"selector": "button[type='submit']"}),
                PlanItem(name="wait_for_css", params={"selector": "#content"}),
                PlanItem(name="assert_title_contains", params={"text": "The Internet"}),
            ]

        if intent == "OPEN":
            return [
                PlanItem(name="open_url", params={"url": url or EXAMPLE_URL}),
                PlanItem(name="wait_for_css", params={"selector": "body"}),
                PlanItem(name="assert_title_contains", params={"text": "Example"}),
            ]

        if intent == "VERIFY_TITLE":
            return [PlanItem(name="assert_title_contains", params={"text": "Example"})]

        # UNKNOWN → fall back to deterministic rules
        return fallback_rules(prompt)
