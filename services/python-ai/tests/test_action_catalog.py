"""
Test Action Catalog and Intent-to-Action ID mapping
Verifies SCRUM-4 completion: ML intent parser tied to action IDs
"""
import pytest
from action_catalog import ActionCatalog
from intent.model import IntentModel
from planner import LocalPlanner

def test_action_catalog_intent_mapping():
    """Test that intents map to correct action template IDs"""
    catalog = ActionCatalog()
    
    # Test LOGIN intent mapping
    login_actions = catalog.get_actions_for_intent("LOGIN")
    assert len(login_actions) > 0
    assert login_actions[0].name == "open_url"
    assert "login" in login_actions[0].params["url"]
    
    # Test OPEN intent mapping
    open_actions = catalog.get_actions_for_intent("OPEN")
    assert len(open_actions) > 0
    assert open_actions[0].name == "open_url"
    
    # Test new SCRUM-3 actions (Homepage, Search, Seats, Checkout)
    homepage_actions = catalog.get_actions_for_intent("HOMEPAGE")
    assert len(homepage_actions) > 0
    
    search_actions = catalog.get_actions_for_intent("SEARCH") 
    assert len(search_actions) > 0
    assert search_actions[0].name == "type_css"

def test_action_id_templates():
    """Test that action templates are properly defined"""
    catalog = ActionCatalog()
    
    # Verify all SCRUM-3 required actions exist
    required_templates = [
        "HOMEPAGE_NAVIGATION", 
        "LOGIN_BASIC",
        "SEARCH_BASIC", 
        "SELECT_SEATS",
        "CHECKOUT_FLOW"
    ]
    
    for template_id in required_templates:
        template = catalog.get_template(template_id)
        assert len(template) > 0, f"Template {template_id} should not be empty"

def test_ml_intent_to_action_id_integration():
    """Test full ML pipeline: Prompt → Intent → Action IDs → Plan"""
    planner = LocalPlanner()
    
    # Test login flow
    login_plan = planner.make_plan("login to the system")
    assert len(login_plan) > 0
    assert any("login" in str(action.params.get("url", "")).lower() for action in login_plan)
    
    # Test open flow  
    open_plan = planner.make_plan("open example website")
    assert len(open_plan) > 0
    assert open_plan[0].name == "open_url"

def test_parameter_substitution():
    """Test that template parameters are properly substituted"""
    catalog = ActionCatalog()
    
    context = {
        "url": "https://custom-site.com",
        "expected_title": "Custom Site"
    }
    
    actions = catalog.get_actions_for_intent("OPEN", context)
    assert len(actions) > 0
    assert actions[0].params["url"] == "https://custom-site.com"

def test_action_catalog_coverage():
    """Verify all SCRUM-3 required action types are covered"""
    catalog = ActionCatalog()
    mappings = catalog.list_available_actions()
    
    required_intents = ["LOGIN", "OPEN", "HOMEPAGE", "SEARCH", "SEATS", "CHECKOUT"]
    
    for intent in required_intents:
        assert intent in mappings, f"Missing action mapping for {intent} intent"
        assert len(mappings[intent]) > 0, f"No action templates for {intent}"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])