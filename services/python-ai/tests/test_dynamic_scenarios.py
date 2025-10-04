"""
Test Dynamic User Scenarios
Verifies the three user examples work correctly with enhanced AI system
"""
import pytest
from planner import LocalPlanner
from action_catalog import ActionCatalog

def test_scenario_1_google_navigation():
    """Test: Open Google and verify that the page title contains Google."""
    planner = LocalPlanner()
    
    prompt = "Open Google and verify that the page title contains Google."
    plan = planner.make_plan(prompt)
    
    # Verify we get actions
    assert len(plan) > 0
    
    # Convert to action names and params for easier testing
    actions = [(action.name, action.params) for action in plan]
    action_names = [action[0] for action in actions]
    
    print("Generated actions for Google scenario:")
    for i, (name, params) in enumerate(actions):
        print(f"  {i+1}. {name} -> {params}")
    
    # Verify expected sequence
    assert "open_url" in action_names
    assert "assert_title_contains" in action_names
    
    # Verify correct URL
    open_action = next((params for name, params in actions if name == "open_url"), {})
    assert "google.com" in open_action.get("url", "").lower()
    
    # Verify title check
    title_action = next((params for name, params in actions if name == "assert_title_contains"), {})
    assert "google" in title_action.get("text", "").lower()

def test_scenario_2_amazon_search():
    """Test: Search for laptops on Amazon and verify results are shown."""
    planner = LocalPlanner()
    
    prompt = "Search for laptops on Amazon and verify results are shown."
    plan = planner.make_plan(prompt)
    
    assert len(plan) > 0
    
    actions = [(action.name, action.params) for action in plan]
    action_names = [action[0] for action in actions]
    
    print("Generated actions for Amazon search scenario:")
    for i, (name, params) in enumerate(actions):
        print(f"  {i+1}. {name} -> {params}")
    
    # Verify expected sequence
    assert "open_url" in action_names
    assert "type_css" in action_names  # Search input
    assert "click_css" in action_names  # Search button
    assert "wait_for_css" in action_names  # Wait for results
    
    # Verify Amazon URL
    open_action = next((params for name, params in actions if name == "open_url"), {})
    assert "amazon.com" in open_action.get("url", "").lower()
    
    # Verify search term
    type_actions = [params for name, params in actions if name == "type_css"]
    search_action = next((params for params in type_actions if "laptops" in str(params.get("text", ""))), None)
    assert search_action is not None
    assert "laptops" in search_action.get("text", "")

def test_scenario_3_contact_form():
    """Test: Fill out the contact form with name John Doe and email john@example.com."""
    planner = LocalPlanner()
    
    prompt = "Fill out the contact form with name John Doe and email john@example.com"
    plan = planner.make_plan(prompt)
    
    assert len(plan) > 0
    
    actions = [(action.name, action.params) for action in plan]
    action_names = [action[0] for action in actions]
    
    print("Generated actions for contact form scenario:")
    for i, (name, params) in enumerate(actions):
        print(f"  {i+1}. {name} -> {params}")
    
    # Verify expected sequence
    assert "open_url" in action_names
    assert "type_css" in action_names  # Should have multiple type actions
    assert "click_css" in action_names  # Submit button
    
    # Count type_css actions (should have name and email)
    type_actions = [params for name, params in actions if name == "type_css"]
    assert len(type_actions) >= 2  # At least name and email
    
    # Verify name is filled
    name_found = any("John Doe" in str(params.get("text", "")) for params in type_actions)
    assert name_found, "Name 'John Doe' should be filled in form"
    
    # Verify email is filled
    email_found = any("john@example.com" in str(params.get("text", "")) for params in type_actions)
    assert email_found, "Email 'john@example.com' should be filled in form"

def test_action_catalog_has_new_templates():
    """Verify new action templates are available"""
    catalog = ActionCatalog()
    
    # Check new templates exist
    templates = catalog.templates
    assert "GOOGLE_SEARCH_VERIFY" in templates
    assert "AMAZON_SEARCH_FLOW" in templates
    assert "CONTACT_FORM_FILL" in templates
    
    # Check new intent mappings
    mappings = catalog.list_available_actions()
    assert "GOOGLE_SEARCH" in mappings
    assert "AMAZON_SEARCH" in mappings
    assert "CONTACT_FORM" in mappings

def test_parameter_extraction():
    """Test that parameters are correctly extracted from prompts"""
    planner = LocalPlanner()
    
    # Test search term extraction
    context1 = planner._extract_dynamic_context("Search for laptops on Amazon")
    assert context1.get("search_term") == "laptops"
    
    # Test name extraction
    context2 = planner._extract_dynamic_context("Fill form with name John Doe")
    assert context2.get("customer_name") == "John Doe"
    
    # Test email extraction
    context3 = planner._extract_dynamic_context("Email is john@example.com")
    assert context3.get("customer_email") == "john@example.com"
    
    # Test site detection
    context4 = planner._extract_dynamic_context("Open Google website")
    assert "google.com" in context4.get("site_url", "")

if __name__ == "__main__":
    print("🚀 Testing Dynamic User Scenarios...")
    print("=" * 50)
    
    # Run individual tests with output
    test_scenario_1_google_navigation()
    print("✅ Scenario 1: Google navigation - PASSED")
    
    test_scenario_2_amazon_search() 
    print("✅ Scenario 2: Amazon search - PASSED")
    
    test_scenario_3_contact_form()
    print("✅ Scenario 3: Contact form - PASSED")
    
    test_action_catalog_has_new_templates()
    print("✅ Action catalog templates - PASSED")
    
    test_parameter_extraction()
    print("✅ Parameter extraction - PASSED")
    
    print("\n🎉 All dynamic scenarios working correctly!")
    print("📋 The AI system can now handle:")
    print("   • Google navigation with title verification")
    print("   • Amazon product search workflows") 
    print("   • Contact form filling with extracted parameters")