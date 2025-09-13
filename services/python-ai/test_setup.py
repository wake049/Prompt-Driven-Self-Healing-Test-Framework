#!/usr/bin/env python3
"""Test script to verify the environment setup"""

try:
    from rules import plan_for
    from schema import PlanItem
    print("✅ All imports successful!")
    
    # Test basic functionality
    plan = plan_for("login")
    print(f"✅ Login plan generated with {len(plan)} steps")
    
    plan2 = plan_for("open example")
    print(f"✅ Open example plan generated with {len(plan2)} steps")
    
    print("\nAll tests passed! Environment is set up correctly.")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
except Exception as e:
    print(f"❌ Error: {e}")
