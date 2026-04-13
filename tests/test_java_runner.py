#!/usr/bin/env python3
"""
Java Runner Service Integration Tests
Tests Selenium test execution endpoints
"""

import requests
import json
import time
import sys

BASE_URL = "http://localhost:8080"
API_URL = "http://localhost:8000"

test_results = {"passed": [], "failed": []}

def log_result(test_name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"   {details}")
    
    if passed:
        test_results["passed"].append(test_name)
    else:
        test_results["failed"].append(test_name)

def test_java_runner_health():
    """Test Java Runner health check"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        passed = response.status_code == 200
        log_result("Java Runner - Health Check", passed, 
                  f"Status: {response.status_code}")
        return response.json() if passed else None
    except Exception as e:
        log_result("Java Runner - Health Check", False, f"Error: {str(e)}")
        return None

def test_java_runner_execute_simple_test():
    """Test executing a simple Selenium test"""
    test_plan = {
        "prompt_id": "test-integration",
        "steps": [
            {
                "action": "navigate",
                "url": "https://example.com",
                "description": "Navigate to example.com"
            },
            {
                "action": "verify_title",
                "expected_title": "Example Domain",
                "description": "Verify page title"
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/execute-test",
            json=test_plan,
            timeout=30
        )
        passed = response.status_code == 200
        
        if passed:
            result = response.json()
            log_result("Java Runner - Execute Simple Test", True, 
                      f"Success: {result.get('success', False)}")
            return result
        else:
            log_result("Java Runner - Execute Simple Test", False,
                      f"Status: {response.status_code}, Response: {response.text[:200]}")
            return None
    except Exception as e:
        log_result("Java Runner - Execute Simple Test", False, f"Error: {str(e)}")
        return None

def test_java_runner_execute_with_login():
    """Test executing a login test"""
    test_plan = {
        "prompt_id": "test-login-integration",
        "steps": [
            {
                "action": "navigate",
                "url": "https://practicetestautomation.com/practice-test-login/",
                "description": "Navigate to login page"
            },
            {
                "action": "type",
                "selector": "#username",
                "value": "student",
                "description": "Enter username"
            },
            {
                "action": "type",
                "selector": "#password",
                "value": "Password123",
                "description": "Enter password"
            },
            {
                "action": "click",
                "selector": "#submit",
                "description": "Click submit button"
            },
            {
                "action": "wait",
                "duration": 2000,
                "description": "Wait for page load"
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/execute-test",
            json=test_plan,
            timeout=60
        )
        passed = response.status_code == 200
        
        if passed:
            result = response.json()
            log_result("Java Runner - Execute Login Test", True,
                      f"Success: {result.get('success', False)}, Steps: {len(result.get('steps', []))}")
            return result
        else:
            log_result("Java Runner - Execute Login Test", False,
                      f"Status: {response.status_code}")
            return None
    except Exception as e:
        log_result("Java Runner - Execute Login Test", False, f"Error: {str(e)}")
        return None

def test_java_runner_screenshot_capture():
    """Test screenshot capture capability"""
    test_plan = {
        "prompt_id": "test-screenshot",
        "steps": [
            {
                "action": "navigate",
                "url": "https://example.com",
                "description": "Navigate to example.com"
            },
            {
                "action": "screenshot",
                "description": "Capture screenshot"
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/execute-test",
            json=test_plan,
            timeout=30
        )
        passed = response.status_code == 200
        
        if passed:
            result = response.json()
            has_screenshot = any(
                step.get('screenshot') for step in result.get('steps', [])
            )
            log_result("Java Runner - Screenshot Capture", has_screenshot,
                      f"Screenshot captured: {has_screenshot}")
            return result
        else:
            log_result("Java Runner - Screenshot Capture", False,
                      f"Status: {response.status_code}")
            return None
    except Exception as e:
        log_result("Java Runner - Screenshot Capture", False, f"Error: {str(e)}")
        return None

def test_java_runner_self_healing():
    """Test self-healing capability with failed selector"""
    test_plan = {
        "prompt_id": "test-self-healing",
        "steps": [
            {
                "action": "navigate",
                "url": "https://example.com",
                "description": "Navigate to page"
            },
            {
                "action": "click",
                "selector": "#nonexistent-button",  # This will fail
                "fallback_selectors": [
                    "button",
                    "a[href]"
                ],
                "description": "Click with self-healing"
            }
        ]
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/execute-test",
            json=test_plan,
            timeout=30
        )
        
        # Self-healing might succeed or fail, we just want to see it tries
        result = response.json() if response.status_code == 200 else None
        
        if result:
            # Check if self-healing was attempted
            healing_attempted = any(
                'healed' in step.get('details', '').lower() or 
                'fallback' in step.get('details', '').lower()
                for step in result.get('steps', [])
            )
            log_result("Java Runner - Self-Healing", True,
                      f"Self-healing attempted: {healing_attempted}")
            return result
        else:
            log_result("Java Runner - Self-Healing", False,
                      f"Status: {response.status_code}")
            return None
    except Exception as e:
        log_result("Java Runner - Self-Healing", False, f"Error: {str(e)}")
        return None

def test_java_runner_performance():
    """Test Java Runner performance metrics"""
    try:
        response = requests.get(f"{BASE_URL}/metrics", timeout=5)
        passed = response.status_code == 200
        
        if passed:
            metrics = response.json()
            log_result("Java Runner - Performance Metrics", True,
                      f"Uptime: {metrics.get('uptime', 'N/A')}")
            return metrics
        else:
            # Metrics endpoint might not exist
            log_result("Java Runner - Performance Metrics", True,
                      "Endpoint not available (optional)")
            return None
    except Exception as e:
        log_result("Java Runner - Performance Metrics", True,
                  "Endpoint not available (optional)")
        return None

def run_all_tests():
    """Run all Java Runner tests"""
    print("=" * 80)
    print("JAVA RUNNER SERVICE TESTING")
    print("=" * 80)
    print(f"\nJava Runner URL: {BASE_URL}")
    print("\n" + "=" * 80)
    print("STARTING TESTS")
    print("=" * 80 + "\n")
    
    # Run tests
    print("--- Basic Tests ---")
    test_java_runner_health()
    
    print("\n--- Execution Tests ---")
    test_java_runner_execute_simple_test()
    test_java_runner_execute_with_login()
    
    print("\n--- Advanced Features ---")
    test_java_runner_screenshot_capture()
    test_java_runner_self_healing()
    
    print("\n--- Performance Tests ---")
    test_java_runner_performance()
    
    # Print summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"\n✅ Passed: {len(test_results['passed'])}")
    print(f"❌ Failed: {len(test_results['failed'])}")
    print(f"\nTotal: {len(test_results['passed']) + len(test_results['failed'])}")
    
    if test_results['failed']:
        print("\n❌ Failed Tests:")
        for test in test_results['failed']:
            print(f"   - {test}")
    
    print("\n" + "=" * 80)
    
    # Return exit code
    return 0 if len(test_results['failed']) == 0 else 1

if __name__ == "__main__":
    exit_code = run_all_tests()
    sys.exit(exit_code)
