#!/usr/bin/env python3
"""
Quick test for contact form parameter extraction
"""

import sys
sys.path.append('.')

from planner import LocalPlanner

def test_contact_form():
    planner = LocalPlanner()
    prompt = "Fill out the contact form with name John Doe and email john@example.com"
    
    print(f"Testing prompt: {prompt}")
    
    # Test parameter extraction
    context = planner._extract_dynamic_context(prompt)
    print(f"Extracted context: {context}")
    
    # Test full planning
    plan = planner.make_plan(prompt)
    print(f"Generated {len(plan)} actions:")
    
    for i, action in enumerate(plan, 1):
        if hasattr(action, 'name') and hasattr(action, 'params'):
            print(f"  {i}. {action.name}: {action.params}")
        else:
            print(f"  {i}. {action}")

if __name__ == "__main__":
    test_contact_form()