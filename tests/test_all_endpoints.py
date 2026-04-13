#!/usr/bin/env python3
"""
Comprehensive Integration Tests for All API Endpoints
Tests all endpoints with real data and actual authentication
"""

import requests
import json
import time
from typing import Dict, Any, Optional
import sys

# Test Configuration
BASE_URL = "http://localhost:8000"
TEST_USERNAME = "integration-test@example.com"
TEST_PASSWORD = "ChangeMe_TestPassword123!"

# Test Results Tracking
test_results = {
    "passed": [],
    "failed": [],
    "skipped": []
}

class TestRunner:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.test_data = {}
        
    def log_result(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"   {details}")
        
        if passed:
            test_results["passed"].append(test_name)
        else:
            test_results["failed"].append(test_name)
    
    def test_endpoint(self, name: str, method: str, endpoint: str, 
                     expected_status: int = 200, data: Optional[Dict] = None,
                     json_data: Optional[Dict] = None, params: Optional[Dict] = None,
                     headers: Optional[Dict] = None) -> Optional[Dict]:
        """Generic endpoint test"""
        url = f"{BASE_URL}{endpoint}"
        try:
            if method == "GET":
                response = self.session.get(url, params=params, headers=headers, timeout=10)
            elif method == "POST":
                response = self.session.post(url, data=data, json=json_data, headers=headers, timeout=10)
            elif method == "PUT":
                response = self.session.put(url, json=json_data, headers=headers, timeout=10)
            elif method == "DELETE":
                response = self.session.delete(url, headers=headers, timeout=10)
            elif method == "PATCH":
                response = self.session.patch(url, json=json_data, headers=headers, timeout=10)
            else:
                self.log_result(name, False, f"Unknown method: {method}")
                return None
            
            passed = response.status_code == expected_status
            
            if passed:
                try:
                    result = response.json()
                    self.log_result(name, True, f"Status: {response.status_code}")
                    return result
                except:
                    self.log_result(name, True, f"Status: {response.status_code} (non-JSON response)")
                    return {"status": response.status_code, "text": response.text[:100]}
            else:
                self.log_result(name, False, 
                              f"Expected {expected_status}, got {response.status_code}. Response: {response.text[:200]}")
                return None
                
        except Exception as e:
            self.log_result(name, False, f"Error: {str(e)}")
            return None

    # ============= Authentication Tests =============
    
    def test_auth_register(self):
        """Test user registration"""
        result = self.test_endpoint(
            "Auth - Register User",
            "POST",
            "/api/v1/auth/register",
            expected_status=200,
            json_data={
                "email": TEST_USERNAME,
                "password": TEST_PASSWORD,
                "username": TEST_USERNAME.split("@")[0]
            }
        )
        return result
    
    def test_auth_login(self):
        """Test user login"""
        result = self.test_endpoint(
            "Auth - Login",
            "POST",
            "/api/v1/auth/login",
            expected_status=200,
            json_data={
                "email": TEST_USERNAME,
                "password": TEST_PASSWORD
            }
        )
        if result and "access_token" in result:
            self.auth_token = result["access_token"]
            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
        return result
    
    def test_auth_me(self):
        """Test get current user"""
        return self.test_endpoint(
            "Auth - Get Current User",
            "GET",
            "/api/v1/auth/me",
            expected_status=200
        )
    
    # ============= Health Check Tests =============
    
    def test_health_basic(self):
        """Test basic health check"""
        return self.test_endpoint(
            "Health - Basic Check",
            "GET",
            "/health",
            expected_status=200
        )
    
    def test_health_detailed(self):
        """Test detailed health check"""
        return self.test_endpoint(
            "Health - Detailed Check",
            "GET",
            "/health/status",
            expected_status=200
        )
    
    # ============= AI Configuration Tests =============
    
    def test_ai_config_get(self):
        """Test get AI configuration"""
        result = self.test_endpoint(
            "AI Config - Get Configuration",
            "GET",
            "/api/v1/ai-config/config",
            expected_status=200
        )
        return result
    
    def test_ai_config_status(self):
        """Test AI configuration status"""
        return self.test_endpoint(
            "AI Config - Get Status",
            "GET",
            "/api/v1/ai-config/status",
            expected_status=200
        )
    
    def test_ai_config_available_models(self):
        """Test get available AI models"""
        return self.test_endpoint(
            "AI Config - Get Available Models",
            "GET",
            "/api/v1/ai-config/available-models",
            expected_status=200
        )
    
    def test_ai_config_switch_provider(self):
        """Test switch AI provider"""
        return self.test_endpoint(
            "AI Config - Switch Provider",
            "POST",
            "/api/v1/ai-config/switch-provider",
            expected_status=200,
            json_data={
                "provider": "openai",
                "model": "gpt-4"
            }
        )
    
    def test_ai_config_test_provider(self):
        """Test AI provider connection"""
        return self.test_endpoint(
            "AI Config - Test Provider",
            "POST",
            "/api/v1/ai-config/test-provider",
            expected_status=200,
            json_data={
                "provider": "openai"
            }
        )
    
    # ============= Policy Engine Tests =============
    
    def test_policy_create(self):
        """Test create policy"""
        policy_data = {
            "name": "Test Policy",
            "description": "Integration test policy",
            "rules": [
                {
                    "condition": "element_type == 'button'",
                    "action": "highlight",
                    "priority": 1
                }
            ],
            "enabled": True
        }
        result = self.test_endpoint(
            "Policy - Create Policy",
            "POST",
            "/api/v1/policy/policies",
            expected_status=200,
            json_data=policy_data
        )
        if result and "id" in result:
            self.test_data["policy_id"] = result["id"]
        return result
    
    def test_policy_list(self):
        """Test list policies"""
        return self.test_endpoint(
            "Policy - List Policies",
            "GET",
            "/api/v1/policy/policies",
            expected_status=200
        )
    
    def test_policy_get_by_id(self):
        """Test get policy by ID"""
        if "policy_id" not in self.test_data:
            test_results["skipped"].append("Policy - Get By ID (no policy created)")
            print("⊘ SKIP - Policy - Get By ID (no policy created)")
            return None
        
        return self.test_endpoint(
            "Policy - Get By ID",
            "GET",
            f"/api/v1/policy/policies/{self.test_data['policy_id']}",
            expected_status=200
        )
    
    def test_policy_update(self):
        """Test update policy"""
        if "policy_id" not in self.test_data:
            test_results["skipped"].append("Policy - Update (no policy created)")
            print("⊘ SKIP - Policy - Update (no policy created)")
            return None
        
        return self.test_endpoint(
            "Policy - Update Policy",
            "PUT",
            f"/api/v1/policy/policies/{self.test_data['policy_id']}",
            expected_status=200,
            json_data={
                "name": "Updated Test Policy",
                "description": "Updated description"
            }
        )
    
    def test_policy_evaluate(self):
        """Test policy evaluation"""
        return self.test_endpoint(
            "Policy - Evaluate",
            "POST",
            "/api/v1/policy/evaluate",
            expected_status=200,
            json_data={
                "element_type": "button",
                "element_text": "Submit",
                "page_url": "https://example.com"
            }
        )
    
    # ============= Test Execution Tests =============
    
    def test_prompts_create(self):
        """Test create prompt"""
        result = self.test_endpoint(
            "Prompts - Create Prompt",
            "POST",
            "/api/v1/prompts",
            expected_status=200,
            json_data={
                "prompt_text": "Login to example.com with username 'testuser' and password 'testpass'",
                "description": "Integration test prompt"
            }
        )
        if result and "id" in result:
            self.test_data["prompt_id"] = result["id"]
        return result
    
    def test_prompts_list(self):
        """Test list prompts"""
        return self.test_endpoint(
            "Prompts - List All",
            "GET",
            "/api/v1/prompts",
            expected_status=200
        )
    
    def test_generate_plan(self):
        """Test generate test plan from prompt"""
        if "prompt_id" not in self.test_data:
            test_results["skipped"].append("Generate Plan (no prompt created)")
            print("⊘ SKIP - Generate Plan (no prompt created)")
            return None
        
        result = self.test_endpoint(
            "Test Execution - Generate Plan",
            "POST",
            "/api/v1/generate-plan",
            expected_status=200,
            json_data={
                "prompt_id": self.test_data["prompt_id"],
                "prompt_text": "Login to example.com with username admin"
            }
        )
        if result and "plan_id" in result:
            self.test_data["plan_id"] = result["plan_id"]
        return result
    
    def test_execute_plan(self):
        """Test execute test plan"""
        if "plan_id" not in self.test_data:
            test_results["skipped"].append("Execute Plan (no plan generated)")
            print("⊘ SKIP - Execute Plan (no plan generated)")
            return None
        
        return self.test_endpoint(
            "Test Execution - Execute Plan",
            "POST",
            "/api/v1/execute-plan",
            expected_status=200,
            json_data={
                "plan_id": self.test_data["plan_id"]
            }
        )
    
    # ============= Dashboard Tests =============
    
    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        return self.test_endpoint(
            "Dashboard - Get Stats",
            "GET",
            "/api/v1/dashboard/execution/stats",
            expected_status=200
        )
    
    def test_dashboard_recent(self):
        """Test recent executions"""
        return self.test_endpoint(
            "Dashboard - Recent Executions",
            "GET",
            "/api/v1/dashboard/execution/recent",
            expected_status=200
        )
    
    def test_dashboard_trends(self):
        """Test execution trends"""
        return self.test_endpoint(
            "Dashboard - Trends",
            "GET",
            "/api/v1/dashboard/execution/trends",
            expected_status=200
        )
    
    def test_dashboard_failure_analysis(self):
        """Test failure analysis"""
        return self.test_endpoint(
            "Dashboard - Failure Analysis",
            "GET",
            "/api/v1/dashboard/execution/failure-analysis",
            expected_status=200
        )
    
    def test_dashboard_performance_metrics(self):
        """Test performance metrics"""
        return self.test_endpoint(
            "Dashboard - Performance Metrics",
            "GET",
            "/api/v1/dashboard/execution/performance-metrics",
            expected_status=200
        )
    
    # ============= SQL Backend Tests =============
    
    def test_sql_record_element(self):
        """Test record element"""
        result = self.test_endpoint(
            "SQL - Record Element",
            "POST",
            "/api/v1/sql/record-element",
            expected_status=200,
            json_data={
                "page_url": "https://example.com",
                "element_type": "button",
                "selector": "#submit-btn",
                "action": "click",
                "success": True
            }
        )
        if result and "element_id" in result:
            self.test_data["element_id"] = result["element_id"]
        return result
    
    def test_sql_get_elements(self):
        """Test get elements"""
        return self.test_endpoint(
            "SQL - Get Elements",
            "GET",
            "/api/v1/sql/elements",
            expected_status=200
        )
    
    def test_sql_execution_stats(self):
        """Test execution statistics"""
        return self.test_endpoint(
            "SQL - Execution Stats",
            "GET",
            "/api/v1/sql/execution-stats",
            expected_status=200
        )
    
    def test_sql_executions(self):
        """Test get executions"""
        return self.test_endpoint(
            "SQL - Get Executions",
            "GET",
            "/api/v1/sql/executions",
            expected_status=200
        )
    
    def test_sql_health(self):
        """Test SQL backend health"""
        return self.test_endpoint(
            "SQL - Health Check",
            "GET",
            "/api/v1/sql/health",
            expected_status=200
        )
    
    # ============= Healing API Tests =============
    
    def test_healing_submit(self):
        """Test submit healing data"""
        result = self.test_endpoint(
            "Healing - Submit Data",
            "POST",
            "/api/v1/healing/submit",
            expected_status=200,
            json_data={
                "page_url": "https://example.com",
                "failed_selector": "#old-button",
                "suggested_selector": "#new-button",
                "element_type": "button",
                "success": True
            }
        )
        if result and "review_id" in result:
            self.test_data["review_id"] = result["review_id"]
        return result
    
    def test_healing_review_queue(self):
        """Test get review queue"""
        return self.test_endpoint(
            "Healing - Review Queue",
            "GET",
            "/api/v1/sql/review-queue",
            expected_status=200
        )
    
    def test_healing_pending_reviews(self):
        """Test pending reviews"""
        return self.test_endpoint(
            "Healing - Pending Reviews",
            "GET",
            "/api/v1/sql/review/pending",
            expected_status=200
        )
    
    # ============= Selector Generation Tests =============
    
    def test_selector_generate(self):
        """Test selector generation"""
        return self.test_endpoint(
            "Selectors - Generate",
            "POST",
            "/api/v1/selectors/generate",
            expected_status=200,
            json_data={
                "element_description": "Submit button",
                "page_context": {
                    "url": "https://example.com",
                    "title": "Example Page"
                }
            }
        )
    
    # ============= Analytics Tests =============
    
    def test_analytics_overview(self):
        """Test analytics overview"""
        return self.test_endpoint(
            "Analytics - Overview",
            "GET",
            "/api/analytics/overview",
            expected_status=200
        )
    
    def test_analytics_healing_analytics(self):
        """Test healing analytics"""
        return self.test_endpoint(
            "Analytics - Healing Analytics",
            "GET",
            "/api/v1/sql/analytics/healing-analytics",
            expected_status=200
        )
    
    def test_analytics_trends(self):
        """Test analytics trends"""
        return self.test_endpoint(
            "Analytics - Trends",
            "GET",
            "/api/v1/sql/analytics/trends",
            expected_status=200
        )
    
    def test_analytics_failure_patterns(self):
        """Test failure patterns"""
        return self.test_endpoint(
            "Analytics - Failure Patterns",
            "GET",
            "/api/v1/sql/analytics/failure-patterns",
            expected_status=200
        )
    
    # ============= Performance Tests =============
    
    def test_performance_metrics(self):
        """Test performance metrics"""
        return self.test_endpoint(
            "Performance - Metrics",
            "GET",
            "/api/v1/performance/metrics",
            expected_status=200
        )
    
    def test_performance_memory(self):
        """Test memory usage"""
        return self.test_endpoint(
            "Performance - Memory",
            "GET",
            "/api/v1/performance/memory",
            expected_status=200
        )
    
    def test_performance_snapshot(self):
        """Test performance snapshot"""
        return self.test_endpoint(
            "Performance - Snapshot",
            "GET",
            "/api/v1/performance/snapshot",
            expected_status=200
        )
    
    # ============= Cleanup Tests =============
    
    def test_policy_delete(self):
        """Test delete policy"""
        if "policy_id" not in self.test_data:
            test_results["skipped"].append("Policy - Delete (no policy created)")
            print("⊘ SKIP - Policy - Delete (no policy created)")
            return None
        
        return self.test_endpoint(
            "Policy - Delete",
            "DELETE",
            f"/api/v1/policy/policies/{self.test_data['policy_id']}",
            expected_status=200
        )
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("=" * 80)
        print("COMPREHENSIVE API ENDPOINT TESTING")
        print("=" * 80)
        print(f"\nBase URL: {BASE_URL}")
        print(f"Test User: {TEST_USERNAME}")
        print("\n" + "=" * 80)
        print("STARTING TESTS")
        print("=" * 80 + "\n")
        
        # Run tests in logical order
        print("\n--- Authentication Tests ---")
        self.test_auth_register()
        self.test_auth_login()
        self.test_auth_me()
        
        print("\n--- Health Check Tests ---")
        self.test_health_basic()
        self.test_health_detailed()
        
        print("\n--- AI Configuration Tests ---")
        self.test_ai_config_get()
        self.test_ai_config_status()
        self.test_ai_config_available_models()
        self.test_ai_config_switch_provider()
        self.test_ai_config_test_provider()
        
        print("\n--- Policy Engine Tests ---")
        self.test_policy_create()
        self.test_policy_list()
        self.test_policy_get_by_id()
        self.test_policy_update()
        self.test_policy_evaluate()
        
        print("\n--- Test Execution Tests ---")
        self.test_prompts_create()
        self.test_prompts_list()
        self.test_generate_plan()
        self.test_execute_plan()
        
        print("\n--- Dashboard Tests ---")
        self.test_dashboard_stats()
        self.test_dashboard_recent()
        self.test_dashboard_trends()
        self.test_dashboard_failure_analysis()
        self.test_dashboard_performance_metrics()
        
        print("\n--- SQL Backend Tests ---")
        self.test_sql_record_element()
        self.test_sql_get_elements()
        self.test_sql_execution_stats()
        self.test_sql_executions()
        self.test_sql_health()
        
        print("\n--- Healing API Tests ---")
        self.test_healing_submit()
        self.test_healing_review_queue()
        self.test_healing_pending_reviews()
        
        print("\n--- Selector Generation Tests ---")
        self.test_selector_generate()
        
        print("\n--- Analytics Tests ---")
        self.test_analytics_overview()
        self.test_analytics_healing_analytics()
        self.test_analytics_trends()
        self.test_analytics_failure_patterns()
        
        print("\n--- Performance Tests ---")
        self.test_performance_metrics()
        self.test_performance_memory()
        self.test_performance_snapshot()
        
        print("\n--- Cleanup Tests ---")
        self.test_policy_delete()
        
        # Print summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"\n✅ Passed: {len(test_results['passed'])}")
        print(f"❌ Failed: {len(test_results['failed'])}")
        print(f"⊘ Skipped: {len(test_results['skipped'])}")
        print(f"\nTotal: {len(test_results['passed']) + len(test_results['failed']) + len(test_results['skipped'])}")
        
        if test_results['failed']:
            print("\n❌ Failed Tests:")
            for test in test_results['failed']:
                print(f"   - {test}")
        
        if test_results['skipped']:
            print("\n⊘ Skipped Tests:")
            for test in test_results['skipped']:
                print(f"   - {test}")
        
        print("\n" + "=" * 80)
        
        # Return exit code
        return 0 if len(test_results['failed']) == 0 else 1


if __name__ == "__main__":
    runner = TestRunner()
    exit_code = runner.run_all_tests()
    sys.exit(exit_code)
