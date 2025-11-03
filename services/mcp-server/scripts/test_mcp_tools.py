#!/usr/bin/env python3
"""
MCP Tool Registry Test

Tests all 9 MCP tools with realistic scenarios
"""

import asyncio
import json
import sys
from typing import Dict, Any
from pathlib import Path

# Add the parent directory to Python path for package import
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
sys.path.insert(0, str(parent_dir))

from scripts.mcp_client_demo import MCPClient


async def test_all_tools():
    """Test all 9 MCP tools systematically"""
    print("🔧 Testing All MCP Tools")
    print("=" * 50)
    
    client = MCPClient("devtoken")
    
    try:
        await client.start_stdio_client()
        await asyncio.sleep(1)
        
        # Get tool list first
        print("\n📋 Getting tool registry...")
        response = await client.send_request("tools/list")
        if "error" in response:
            print("❌ Failed to get tools list!")
            return
        
        tools = response.get("result", [])
        print(f"✅ Found {len(tools)} tools in registry")
        
        # Test 1: elements.get
        print("\n1️⃣ Testing elements.get...")
        response = await client.send_request("tools/call", {
            "name": "elements.get",
            "arguments": {
                "elementId": "submit-btn",
                "context": {"page_url": "https://example.com/form"}
            }
        })
        await validate_tool_response("elements.get", response)
        
        # Test 2: elements.find
        print("\n2️⃣ Testing elements.find...")
        response = await client.send_request("tools/call", {
            "name": "elements.find",
            "arguments": {
                "query": {"text": "Login", "role": "button"},
                "context": {"page_url": "https://example.com/login"}
            }
        })
        await validate_tool_response("elements.find", response)
        
        # Test 3: run_action
        print("\n3️⃣ Testing run_action...")
        response = await client.send_request("tools/call", {
            "name": "run_action",
            "arguments": {
                "action_type": "click_element",
                "element_name": "login-button",
                "context": {
                    "run_id": "test-run-001",
                    "step_index": 1,
                    "page_url": "https://example.com/login"
                }
            }
        })
        await validate_tool_response("run_action", response)
        
        # Test 4: verify.section
        print("\n4️⃣ Testing verify.section...")
        response = await client.send_request("tools/call", {
            "name": "verify.section",
            "arguments": {
                "preset": {
                    "name": "Form Validation",
                    "description": "Verify form elements are present",
                    "checks": [
                        {
                            "type": "exists",
                            "elementId": "username-field",
                            "description": "Username field exists"
                        },
                        {
                            "type": "visible",
                            "elementId": "submit-button",
                            "description": "Submit button is visible"
                        }
                    ]
                }
            }
        })
        await validate_tool_response("verify.section", response)
        
        # Test 5: verify.outcome
        print("\n5️⃣ Testing verify.outcome...")
        response = await client.send_request("tools/call", {
            "name": "verify.outcome",
            "arguments": {
                "assertion": {
                    "type": "page_loaded",
                    "expected_url": "https://example.com/dashboard",
                    "timeout_ms": 5000
                },
                "context": {"run_id": "test-run-001", "step_index": 2}
            }
        })
        await validate_tool_response("verify.outcome", response)
        
        # Test 6: context.get
        print("\n6️⃣ Testing context.get...")
        response = await client.send_request("tools/call", {
            "name": "context.get",
            "arguments": {
                "run_id": "test-run-001"
            }
        })
        await validate_tool_response("context.get", response)
        
        # Test 7: context.set
        print("\n7️⃣ Testing context.set...")
        response = await client.send_request("tools/call", {
            "name": "context.set",
            "arguments": {
                "context": {
                    "run_id": "test-run-001",
                    "user_id": "test-user",
                    "session_data": {
                        "login_attempts": 1,
                        "current_page": "dashboard",
                        "test_mode": True
                    }
                }
            }
        })
        await validate_tool_response("context.set", response)
        
        # Test 8: context.update
        print("\n8️⃣ Testing context.update...")
        response = await client.send_request("tools/call", {
            "name": "context.update",
            "arguments": {
                "run_id": "test-run-001",
                "updates": {
                    "session_data.login_attempts": 2,
                    "session_data.last_action": "password_reset"
                }
            }
        })
        await validate_tool_response("context.update", response)
        
        # Test 9: actions.adaptive
        print("\n9️⃣ Testing actions.adaptive...")
        response = await client.send_request("tools/call", {
            "name": "actions.adaptive",
            "arguments": {
                "intent": "Complete user registration form",
                "context": {
                    "current_url": "https://example.com/register",
                    "available_elements": [
                        "first-name-field", "last-name-field", 
                        "email-field", "password-field", "submit-button"
                    ],
                    "form_data": {
                        "first_name": "John",
                        "last_name": "Doe",
                        "email": "john.doe@example.com"
                    }
                }
            }
        })
        await validate_tool_response("actions.adaptive", response)
        
        print("\n" + "=" * 50)
        print("🎉 All tools tested!")
        
    except Exception as e:
        print(f"💥 Tool testing failed: {e}")
    finally:
        await client.close()


async def validate_tool_response(tool_name: str, response: Dict[str, Any]):
    """Validate tool response format"""
    if "error" in response:
        print(f"❌ {tool_name} returned error: {response['error']['message']}")
        return
    
    result = response.get("result", {})
    
    # Check MCP envelope format
    if "ok" not in result:
        print(f"❌ {tool_name} missing 'ok' field in response")
        return
    
    if result.get("ok"):
        print(f"✅ {tool_name} succeeded")
        data = result.get("data", {})
        
        # Tool-specific validations
        if tool_name == "elements.get":
            if "element_data" in data:
                print(f"   Retrieved element: {data['element_data'].get('logical_key', 'unknown')}")
        
        elif tool_name == "elements.find":
            if "elements" in data:
                print(f"   Found {len(data['elements'])} elements")
        
        elif tool_name == "run_action":
            if "status" in data:
                print(f"   Action status: {data['status']}")
                if "execution_time_ms" in data:
                    print(f"   Execution time: {data['execution_time_ms']}ms")
        
        elif tool_name == "verify.section":
            if "overall_result" in data:
                print(f"   Verification: {data['overall_result']}")
                print(f"   Checks: {data.get('passed_checks', 0)}/{data.get('total_checks', 0)}")
        
        elif tool_name == "verify.outcome":
            if "result" in data:
                print(f"   Assertion result: {data['result']}")
        
        elif tool_name in ["context.get", "context.set", "context.update"]:
            if "context" in data:
                print(f"   Context operations completed")
        
        elif tool_name == "actions.adaptive":
            if "recommended_actions" in data:
                actions = data['recommended_actions']
                print(f"   Generated {len(actions)} adaptive actions")
    
    else:
        error_msg = result.get("error", "Unknown error")
        print(f"❌ {tool_name} failed: {error_msg}")


async def test_edge_cases():
    """Test edge cases and error conditions"""
    print("🧪 Testing Edge Cases")
    print("=" * 50)
    
    client = MCPClient("devtoken")
    
    try:
        await client.start_stdio_client()
        await asyncio.sleep(1)
        
        # Test 1: Missing required parameters
        print("\n1️⃣ Testing missing required parameters...")
        response = await client.send_request("tools/call", {
            "name": "elements.get",
            "arguments": {}  # Missing elementId
        })
        if "error" in response or not response.get("result", {}).get("ok"):
            print("✅ Correctly rejected missing parameters")
        else:
            print("❌ Should have rejected missing parameters")
        
        # Test 2: Invalid parameter types
        print("\n2️⃣ Testing invalid parameter types...")
        response = await client.send_request("tools/call", {
            "name": "run_action",
            "arguments": {
                "action_type": 123,  # Should be string
                "element_name": "test",
                "context": "invalid"  # Should be object
            }
        })
        if "error" in response or not response.get("result", {}).get("ok"):
            print("✅ Correctly rejected invalid parameter types")
        else:
            print("❌ Should have rejected invalid parameter types")
        
        # Test 3: Non-existent elements
        print("\n3️⃣ Testing non-existent elements...")
        response = await client.send_request("tools/call", {
            "name": "elements.get",
            "arguments": {
                "elementId": "definitely-does-not-exist-12345"
            }
        })
        result = response.get("result", {})
        if not result.get("ok"):
            print("✅ Correctly handled non-existent element")
        else:
            print("❌ Should have failed for non-existent element")
        
        # Test 4: Empty context updates
        print("\n4️⃣ Testing empty context updates...")
        response = await client.send_request("tools/call", {
            "name": "context.update",
            "arguments": {
                "run_id": "test-run",
                "updates": {}  # Empty updates
            }
        })
        result = response.get("result", {})
        if result.get("ok"):
            print("✅ Handled empty updates gracefully")
        else:
            print("❌ Failed to handle empty updates")
        
    except Exception as e:
        print(f"💥 Edge case testing failed: {e}")
    finally:
        await client.close()


def main():
    """Main test function"""
    import argparse
    parser = argparse.ArgumentParser(description="Test MCP Tools")
    parser.add_argument("--edge-cases", action="store_true", help="Test edge cases")
    args = parser.parse_args()
    
    if args.edge_cases:
        asyncio.run(test_edge_cases())
    else:
        asyncio.run(test_all_tools())


if __name__ == "__main__":
    main()