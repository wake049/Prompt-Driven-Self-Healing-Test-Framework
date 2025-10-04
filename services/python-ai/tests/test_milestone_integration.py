"""
Integration Tests for Milestone 1 & 2 Epics
Tests the complete AI-powered test automation pipeline
"""
import pytest
import requests
import json
from typing import Dict, Any

# Test Configuration
BASE_URL = "http://localhost:8000"
TIMEOUT = 30

class TestMilestone1Integration:
    """Test all Milestone 1 functionality"""
    
    def test_health_endpoint(self):
        """Test basic service health"""
        response = requests.get(f"{BASE_URL}/health", timeout=TIMEOUT)
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
    
    def test_login_intent_classification(self):
        """Test ML model classifies login intents correctly"""
        test_prompts = [
            "login",
            "log in to the application", 
            "sign in",
            "please login to the site"
        ]
        
        for prompt in test_prompts:
            response = requests.post(
                f"{BASE_URL}/plan",
                json={"prompt": prompt},
                timeout=TIMEOUT
            )
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify structure
            assert "actions" in data
            assert "meta" in data
            assert isinstance(data["actions"], list)
            assert len(data["actions"]) > 0
            
            # Verify login-specific actions
            actions = data["actions"]
            action_names = [action["name"] for action in actions]
            
            # Should contain login flow actions
            assert "open_url" in action_names
            assert "type_css" in action_names  # Username/password fields
            assert "click_css" in action_names  # Submit button
    
    def test_open_intent_classification(self):
        """Test ML model classifies navigation intents correctly"""
        test_cases = [
            ("open example", "https://example.com"),
            ("visit https://google.com", "https://google.com"),
            ("go to the internet herokuapp login page", None),
        ]
        
        for prompt, expected_url in test_cases:
            response = requests.post(
                f"{BASE_URL}/plan",
                json={"prompt": prompt},
                timeout=TIMEOUT
            )
            
            assert response.status_code == 200
            data = response.json()
            
            actions = data["actions"]
            assert len(actions) > 0
            
            # First action should be open_url
            first_action = actions[0]
            assert first_action["name"] == "open_url"
            
            # Check URL if specified
            if expected_url:
                assert first_action["params"]["url"] == expected_url
    
    def test_verify_title_intent(self):
        """Test title verification intent"""
        response = requests.post(
            f"{BASE_URL}/plan",
            json={"prompt": "verify the page title"},
            timeout=TIMEOUT
        )
        
        assert response.status_code == 200
        data = response.json()
        
        actions = data["actions"]
        action_names = [action["name"] for action in actions]
        
        # Should contain title assertion
        assert "assert_title_contains" in action_names
    
    def test_unknown_intent_handling(self):
        """Test graceful handling of unknown intents"""
        unknown_prompts = [
            "book a flight to Paris",
            "purchase insurance", 
            "schedule a meeting",
            "order pizza"
        ]
        
        for prompt in unknown_prompts:
            response = requests.post(
                f"{BASE_URL}/plan",
                json={"prompt": prompt},
                timeout=TIMEOUT
            )
            
            # Should either return valid actions or proper error
            if response.status_code == 200:
                data = response.json()
                assert "actions" in data
            else:
                # Should be a proper HTTP error with details
                assert response.status_code in [422, 404]
                assert "detail" in response.json()


class TestMilestone2Integration:
    """Test all Milestone 2 functionality"""
    
    def test_action_catalog_endpoints(self):
        """Test new action catalog REST API endpoints"""
        
        # Test list intents
        response = requests.get(f"{BASE_URL}/catalog/intents", timeout=TIMEOUT)
        assert response.status_code == 200
        intents = response.json()
        
        # Should have M1 + M2 intents
        expected_intents = ["LOGIN", "OPEN", "VERIFY_TITLE", "FORM", "CART", "NAVIGATION"]
        for intent in expected_intents:
            assert intent in intents
        
        # Test list templates
        response = requests.get(f"{BASE_URL}/catalog/templates", timeout=TIMEOUT)
        assert response.status_code == 200
        templates = response.json()
        
        # Should have enhanced M2 templates
        expected_templates = ["LOGIN_BASIC", "LOGIN_WITH_2FA", "ADD_TO_CART", "FORM_FILL_BASIC"]
        for template in expected_templates:
            assert template in templates
        
        # Test get specific template
        response = requests.get(f"{BASE_URL}/catalog/templates/LOGIN_BASIC", timeout=TIMEOUT)
        assert response.status_code == 200
        template = response.json()
        assert isinstance(template, list)
        assert len(template) > 0
        
        # Test non-existent template
        response = requests.get(f"{BASE_URL}/catalog/templates/NON_EXISTENT", timeout=TIMEOUT)
        assert response.status_code == 404
    
    def test_direct_intent_action_generation(self):
        """Test direct intent-to-action endpoint"""
        test_cases = [
            ("LOGIN", {}),
            ("OPEN", {"url": "https://test.com", "expected_title": "Test"}),
            ("FORM", {"field_selector": "#email", "field_value": "test@example.com"}),
        ]
        
        for intent, context in test_cases:
            response = requests.post(
                f"{BASE_URL}/catalog/actions",
                params={"intent": intent},
                json=context,
                timeout=TIMEOUT
            )
            
            if response.status_code == 200:
                actions = response.json()
                assert isinstance(actions, list)
                assert len(actions) > 0
                
                # Verify action structure
                for action in actions:
                    assert "name" in action
                    assert "params" in action
            else:
                # Some intents might not have actions, should return 404
                assert response.status_code == 404
    
    def test_catalog_statistics(self):
        """Test catalog statistics endpoint"""
        response = requests.get(f"{BASE_URL}/catalog/stats", timeout=TIMEOUT)
        assert response.status_code == 200
        
        stats = response.json()
        
        # Verify statistics structure
        assert "total_intents" in stats
        assert "total_templates" in stats
        assert "supported_intents" in stats
        assert "template_ids" in stats
        assert "version" in stats
        
        # Verify M2 enhancements
        assert stats["total_intents"] >= 8  # Should have M1 + M2 intents
        assert stats["total_templates"] >= 10  # Should have enhanced templates
        assert stats["version"] == "0.2.0"  # M2 version
    
    def test_enhanced_template_functionality(self):
        """Test Milestone 2 enhanced action templates"""
        
        # Test 2FA login template
        response = requests.get(f"{BASE_URL}/catalog/templates/LOGIN_WITH_2FA", timeout=TIMEOUT)
        assert response.status_code == 200
        template = response.json()
        
        # Should have MFA-specific actions
        action_names = [action["name"] for action in template]
        assert "type_css" in action_names  # For MFA code input
        
        # Test e-commerce templates
        response = requests.get(f"{BASE_URL}/catalog/templates/ADD_TO_CART", timeout=TIMEOUT)
        assert response.status_code == 200
        template = response.json()
        
        action_names = [action["name"] for action in template]
        assert "click_css" in action_names  # For add to cart button
        
        # Test mobile templates
        response = requests.get(f"{BASE_URL}/catalog/templates/MOBILE_SWIPE_SCROLL", timeout=TIMEOUT)
        assert response.status_code == 200
        template = response.json()
        
        action_names = [action["name"] for action in template]
        assert "swipe_up" in action_names  # Mobile-specific action


class TestEndToEndWorkflow:
    """Test complete user workflow from prompt to execution plan"""
    
    def test_complete_login_workflow(self):
        """Test complete login workflow E2E"""
        # Step 1: User inputs natural language prompt
        prompt = "I need to log in to the secure demo site"
        
        # Step 2: AI processes and generates plan
        response = requests.post(
            f"{BASE_URL}/plan",
            json={"prompt": prompt},
            timeout=TIMEOUT
        )
        
        assert response.status_code == 200
        plan = response.json()
        
        # Step 3: Verify complete executable plan
        actions = plan["actions"]
        assert len(actions) >= 4  # Should have multiple steps
        
        # Step 4: Verify logical sequence
        action_names = [action["name"] for action in actions]
        
        # Should follow logical login flow
        assert action_names[0] == "open_url"  # Navigate to login page
        assert "type_css" in action_names      # Enter credentials
        assert "click_css" in action_names     # Submit form
        
        # Step 5: Verify parameters are populated
        for action in actions:
            assert "params" in action
            # Parameters should not contain template variables
            params_str = str(action["params"])
            assert "{" not in params_str or "}" not in params_str
    
    def test_url_extraction_workflow(self):
        """Test URL extraction and parameterization workflow"""
        prompt = "open https://github.com and verify it loads"
        
        response = requests.post(
            f"{BASE_URL}/plan",
            json={"prompt": prompt},
            timeout=TIMEOUT
        )
        
        assert response.status_code == 200
        plan = response.json()
        
        actions = plan["actions"]
        
        # Should extract and use the specific URL
        first_action = actions[0]
        assert first_action["name"] == "open_url"
        assert first_action["params"]["url"] == "https://github.com"
    
    def test_frontend_backend_integration(self):
        """Test that frontend can successfully communicate with backend"""
        
        # Simulate frontend JavaScript requests
        
        # 1. Health check (what frontend does on page load)
        health_response = requests.get(f"{BASE_URL}/health", timeout=TIMEOUT)
        assert health_response.status_code == 200
        
        # 2. Load statistics (what frontend displays)
        stats_response = requests.get(f"{BASE_URL}/catalog/stats", timeout=TIMEOUT)
        assert stats_response.status_code == 200
        
        # 3. Generate plan (main frontend functionality)
        plan_response = requests.post(
            f"{BASE_URL}/plan",
            json={"prompt": "login"},
            headers={"Content-Type": "application/json"},
            timeout=TIMEOUT
        )
        assert plan_response.status_code == 200
        
        # Verify CORS headers are present for browser compatibility
        assert "access-control-allow-origin" in plan_response.headers


def test_milestone_completeness():
    """Verify all milestone requirements are met"""
    
    # Test that server is running
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        assert response.status_code == 200
    except requests.exceptions.RequestException:
        pytest.fail("Server is not running. Start with: python app.py")
    
    # Verify M1 requirements
    m1_endpoints = ["/health", "/plan"]
    for endpoint in m1_endpoints:
        response = requests.get(f"{BASE_URL}{endpoint}", timeout=TIMEOUT)
        assert response.status_code in [200, 405]  # GET or POST only
    
    # Verify M2 requirements  
    m2_endpoints = [
        "/catalog/intents",
        "/catalog/templates", 
        "/catalog/stats"
    ]
    for endpoint in m2_endpoints:
        response = requests.get(f"{BASE_URL}{endpoint}", timeout=TIMEOUT)
        assert response.status_code == 200


if __name__ == "__main__":
    print("🚀 Running Milestone 1 & 2 Integration Tests...")
    print("📋 Make sure the server is running: python app.py")
    print()
    
    # Run tests with verbose output
    pytest.main([__file__, "-v", "--tb=short"])