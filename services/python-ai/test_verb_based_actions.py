#!/usr/bin/env python3
"""
Test the new verb-based action generation system
"""

import sys
sys.path.append('.')

from planner import LocalPlanner
from action_catalog import ActionCatalog

def test_verb_based_system():
    """Test that the verb-based system generates appropriate actions"""
    
    catalog = ActionCatalog()
    planner = LocalPlanner()
    
    test_cases = [
        # User's original three examples
        {
            "prompt": "Open Google and verify the page loads",
            "expected_verbs": ["open", "verify"],
            "expected_actions": ["open_url", "assert_title_contains"]
        },
        {
            "prompt": "Search for laptops on Amazon",
            "expected_verbs": ["search"],
            "expected_actions": ["type_css", "click_css", "wait_for_css"]
        },
        {
            "prompt": "Fill out the contact form with name John Doe and email john@example.com",
            "expected_verbs": ["fill"],
            "expected_actions": ["type_css"]
        },
        # Additional verb-based scenarios
        {
            "prompt": "Click the submit button",
            "expected_verbs": ["click"],
            "expected_actions": ["click_css"]
        },
        {
            "prompt": "Type hello world in the text box",
            "expected_verbs": ["type"],
            "expected_actions": ["type_css"]
        },
        {
            "prompt": "Navigate to example.com and wait for page load",
            "expected_verbs": ["navigate", "wait"],
            "expected_actions": ["open_url", "wait_for_css"]
        },
        {
            "prompt": "Verify the title contains Welcome",
            "expected_verbs": ["verify"],
            "expected_actions": ["assert_title_contains"]
        }
    ]
    
    print("Testing Verb-Based Action Generation System")
    print("=" * 50)
    
    for i, test_case in enumerate(test_cases, 1):
        prompt = test_case["prompt"]
        print(f"\nTest {i}: {prompt}")
        
        try:
            # Generate test plan using verb-based system
            plan_items = planner.make_plan(prompt)
            
            if plan_items:
                print(f"✓ Generated {len(plan_items)} actions:")
                for j, action in enumerate(plan_items, 1):
                    if hasattr(action, 'name') and hasattr(action, 'params'):
                        print(f"  {j}. {action.name}: {action.params}")
                    else:
                        print(f"  {j}. {action}")
                
                # Check if expected actions are present
                if hasattr(plan_items[0], 'name'):
                    action_names = [action.name for action in plan_items]
                else:
                    action_names = [action.get('name', 'unknown') for action in plan_items]
                expected_actions = test_case["expected_actions"]
                
                matching_actions = [action for action in expected_actions if action in action_names]
                if matching_actions:
                    print(f"✓ Found expected actions: {matching_actions}")
                else:
                    print(f"⚠ Expected actions not found: {expected_actions}")
                    print(f"  Got actions: {action_names}")
            else:
                print("✗ No actions generated")
                
        except Exception as e:
            print(f"✗ Error: {e}")
    
    print("\n" + "=" * 50)
    print("Verb-Action Mapping Test")
    print("=" * 50)
    
    # Test direct verb-to-action mapping
    verb_tests = [
        ("open https://google.com", {"url": "https://google.com"}),
        ("search for python tutorials", {"search_term": "python tutorials"}),
        ("type John Doe", {"text": "John Doe"}),
        ("click submit button", {"selector": "button[type='submit']"}),
        ("verify title contains Google", {"text": "Google"}),
        ("wait for results", {"selector": ".results"}),
    ]
    
    for prompt, context in verb_tests:
        print(f"\nDirect verb test: {prompt}")
        try:
            actions = catalog.generate_actions_from_verbs(prompt, context)
            if actions:
                print(f"✓ Generated actions:")
                for action in actions:
                    print(f"  - {action['name']}: {action['params']}")
            else:
                print("✗ No actions generated")
        except Exception as e:
            print(f"✗ Error: {e}")

def test_verb_detection():
    """Test verb detection from prompts"""
    
    catalog = ActionCatalog()
    
    test_prompts = [
        "open google.com",
        "click the login button", 
        "type my username",
        "verify the page title",
        "search for products",
        "fill out the form",
        "navigate to homepage",
        "wait for loading to complete"
    ]
    
    print("\n" + "=" * 50)
    print("Verb Detection Test")
    print("=" * 50)
    
    for prompt in test_prompts:
        print(f"\nPrompt: {prompt}")
        
        # Extract verbs manually for testing
        import re
        words = re.findall(r'\b\w+\b', prompt.lower())
        detected_verbs = [word for word in words if word in catalog.verb_actions]
        
        print(f"Detected verbs: {detected_verbs}")
        if detected_verbs:
            print(f"Action methods: {[catalog.verb_actions[verb].__name__ for verb in detected_verbs]}")

if __name__ == "__main__":
    test_verb_based_system()
    test_verb_detection()