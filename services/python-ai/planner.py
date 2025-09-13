from typing import List
from schema import PlanItem
from rules import plan_for

class LocalPlanner:
    def make_plan(self, prompt: str) -> List[PlanItem]:
        return plan_for(prompt)