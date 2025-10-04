#!/usr/bin/env python3
"""
Test duplicate verification fix
"""

import sys
import os
sys.path.append('.')
os.chdir('c:/Users/Wakeb/capstone-self-healing/services/python-ai')

from action_catalog import ActionCatalog

def test_no_duplicates():
    catalog = ActionCatalog()
    
    # Test the prompt that was causing duplicates
    prompt = "Open Google and verify that the page title contains Google"
    context = {
        'url': 'https://www.google.com',
        'expected_title': 'Google'
    }
    
    print(f"Testing: {prompt}")
    print(f"Context: {context}")
    
    actions = catalog.generate_actions_from_verbs(prompt, context)
    
    print(f"\nGenerated {len(actions)} actions:")
    for i, action in enumerate(actions, 1):
        print(f"  {i}. {action['name']}: {action['params']}")
    
    # Count occurrences of assert_title_contains
    verify_count = sum(1 for action in actions if action['name'] == 'assert_title_contains')
    print(f"\nTitle verification actions: {verify_count} (should be 1)")
    
    if verify_count == 1:
        print("✓ SUCCESS: No duplicate verifications!")
    else:
        print("✗ FAIL: Still has duplicates")

if __name__ == "__main__":
    test_no_duplicates()