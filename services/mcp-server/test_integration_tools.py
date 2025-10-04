"""
Integration Test for Schema-Validated Tools
Test that tools work with integrated schema validation
"""

import asyncio
import json
from datetime import datetime

from tool_registry import ToolRegistry


async def test_integrated_schema_validation():
    """Test that tools work with integrated schema validation"""
    print("Testing Integrated Schema Validation...")
    print("=" * 50)
    
    # Initialize tool registry
    registry = ToolRegistry()
    await registry.initialize()
    
    try:
        # Test 1: run_action with valid input
        print("🧪 Testing run_action with valid input...")
        result = await registry.call_tool(
            "run_action",
            action_type="click_css",
            element_name="login_button",
            parameters={
                "timeout": 5000,
                "heal_mode": "auto"
            },
            context={
                "run_id": "123e4567-e89b-12d3-a456-426614174000",
                "step_index": 1
            }
        )
        print(f"✓ run_action completed: {result['status']}")
        
        # Test 2: get_element with valid input
        print("\n🧪 Testing get_element with valid input...")
        result = await registry.call_tool(
            "get_element",
            element_name="login_button",
            context={
                "page_url": "https://example.com/login"
            },
            options={
                "include_history": True,
                "validate_presence": True
            }
        )
        print(f"✓ get_element completed: found {result['element_name']} with confidence {result['confidence']}")
        
        # Test 3: bulk_generate_locators with valid input
        print("\n🧪 Testing bulk_generate_locators with valid input...")
        result = await registry.call_tool(
            "bulk_generate_locators",
            element_names=["login_button", "username_field", "password_field"],
            page_context={
                "url": "https://example.com/login",
                "title": "Login Page",
                "application_type": "web",
                "framework": "react"
            },
            generation_options={
                "confidence_threshold": 0.8,
                "include_alternatives": True,
                "max_alternatives": 2
            }
        )
        print(f"✓ bulk_generate_locators completed: generated {len(result['locators'])} locators")
        
        # Test 4: analytics_log with valid input
        print("\n🧪 Testing analytics_log with valid input...")
        result = await registry.call_tool(
            "analytics_log",
            event_type="action_executed",
            metrics={
                "execution_time_ms": 1250,
                "success_rate": 1.0,
                "retry_count": 0,
                "confidence_scores": [0.95]
            },
            context={
                "run_id": "123e4567-e89b-12d3-a456-426614174000",
                "environment": "development",
                "session_id": "sess_123",
                "application": "test_framework",
                "component": "action_executor"
            }
        )
        print(f"✓ analytics_log completed: logged event {result['event_id']}")
        
        # Test 5: Invalid input should fail validation
        print("\n🧪 Testing invalid input (should fail)...")
        try:
            await registry.call_tool(
                "run_action",
                action_type="invalid_action",  # Invalid enum value
                element_name="login_button"
            )
            print("❌ Should have failed validation!")
        except ValueError as e:
            print(f"✓ Correctly failed validation: {str(e)[:60]}...")
        
        # Test 6: Missing required field should fail validation
        print("\n🧪 Testing missing required field (should fail)...")
        try:
            await registry.call_tool(
                "run_action",
                action_type="click_css"
                # Missing required element_name
            )
            print("❌ Should have failed validation!")
        except ValueError as e:
            print(f"✓ Correctly failed validation: {str(e)[:60]}...")
        
        print("\n" + "=" * 50)
        print("✅ All integration tests passed!")
        
        # Print registry stats
        stats = registry.get_registry_stats()
        print(f"\n📊 Registry Stats:")
        print(f"   Total tools: {stats['total_tools']}")
        print(f"   Categories: {stats['categories']}")
        
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        return False
    finally:
        await registry.cleanup()
    
    return True


async def test_tool_metadata_with_schemas():
    """Test that tool metadata includes schema information"""
    print("\n" + "=" * 50)
    print("Testing Tool Metadata with Schemas...")
    print("=" * 50)
    
    registry = ToolRegistry()
    await registry.initialize()
    
    try:
        tools = registry.list_tools()
        
        for tool_name in tools:
            info = registry.get_tool_info(tool_name)
            print(f"\n🔧 Tool: {tool_name}")
            print(f"   Description: {info['description']}")
            print(f"   Category: {info['category']}")
            print(f"   Timeout: {info['timeout_ms']}ms")
            print(f"   Requires Auth: {info['requires_auth']}")
            print(f"   Parameters: {len(info['parameters'])} params")
            print(f"   Tags: {', '.join(info['tags'])}")
        
        print(f"\n✅ All {len(tools)} tools have complete metadata")
        
    except Exception as e:
        print(f"❌ Metadata test failed: {e}")
        return False
    finally:
        await registry.cleanup()
    
    return True


if __name__ == "__main__":
    async def main():
        success1 = await test_integrated_schema_validation()
        success2 = await test_tool_metadata_with_schemas()
        
        if success1 and success2:
            print("\n🎉 All tests completed successfully!")
            exit(0)
        else:
            print("\n💥 Some tests failed!")
            exit(1)
    
    asyncio.run(main())