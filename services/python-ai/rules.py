from __future__ import annotations
from typing import List, Optional
from schema import PlanItem

EXAMPLE_URL = "https://example.com"
PRACTICE_LOGIN = "https://the-internet.herokuapp.com/login"

def tokenize(text: str) -> List[str]:
    return [t for t in text.lower().replace("/", " ").replace("-", " ").split() if t.strip()]

def extract_url(tokens: List[str]) -> Optional[str]:
    for t in tokens:
        if t.startswith("http://") or t.startswith("https://"):
            return t
    return None

def plan_for(prompt: str) -> List[PlanItem]:
    t = tokenize(prompt)
    url = extract_url(t)

    # login
    if any(k in " ".join(t) for k in ["login", "log in", "sign in"]):
        return [
            PlanItem(name="open_url", params={"url": PRACTICE_LOGIN}),
            PlanItem(name="type_css", params={"selector": "#username", "text": "tomsmith"}),
            PlanItem(name="type_css", params={"selector": "#password", "text": "SuperSecretPassword!"}),
            PlanItem(name="click_css", params={"selector": "button[type='submit']"}),
            PlanItem(name="wait_for_css", params={"selector": "#content"}),
            PlanItem(name="assert_title_contains", params={"text": "The Internet"})
        ]

    # open → verify
    if "open" in t or "visit" in t or "go" in t:
        return [
            PlanItem(name="open_url", params={"url": url or EXAMPLE_URL}),
            PlanItem(name="wait_for_css", params={"selector": "body"}),
            PlanItem(name="assert_title_contains", params={"text": "Example"})
        ]

    # verify title
    if "verify" in t and "title" in t:
        return [PlanItem(name="assert_title_contains", params={"text": "Example"})]

    # default
    return [
        PlanItem(name="open_url", params={"url": EXAMPLE_URL}),
        PlanItem(name="assert_title_contains", params={"text": "Example Domain"})
    ]
