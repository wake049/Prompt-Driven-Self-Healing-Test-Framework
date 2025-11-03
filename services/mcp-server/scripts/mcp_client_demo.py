#!/usr/bin/env python3
"""
MCP Client Demo Script

Demonstrates a full flow of MCP operations:
1. elements.get → 2. run_action → 3. verify.section
"""

import asyncio
import json
import sys
import subprocess
import time
import argparse
import os
from typing import Dict, Any, Optional
from pathlib import Path

# Add the parent directory to Python path for package import
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
sys.path.insert(0, str(parent_dir))


class MCPClient:
    """Simple MCP client for demo purposes"""
    
    def __init__(self, auth_token: Optional[str] = None):
        self.auth_token = auth_token
        self.request_id = 0
        self.process = None
    
    def _next_id(self) -> int:
        """Get next request ID"""
        self.request_id += 1
        return self.request_id
    
    async def start_stdio_client(self):
        """Start MCP server process with stdio transport"""
        import os
        
        # Get the correct path to the mcp_server package
        current_dir = Path(__file__).parent
        parent_dir = current_dir.parent
        
        cmd = [sys.executable, "-c", "import sys; sys.path.insert(0, r'{}'); from mcp_server import run_stdio; import asyncio; asyncio.run(run_stdio())".format(str(parent_dir))]
        env = dict(os.environ)
        if self.auth_token:
            env["MCP_AUTH_TOKEN"] = self.auth_token
        
        self.process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env
        )
        
        print("🚀 Started MCP server with stdio transport")
        # Give the server a moment to initialize
        await asyncio.sleep(2)
    
    async def send_request(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send MCP request and get response"""
        request = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": method,
            "params": params or {}
        }
        
        if self.auth_token and "auth_token" not in request["params"]:
            request["params"]["auth_token"] = self.auth_token
        
        request_json = json.dumps(request)
        print(f"📤 Sending: {request_json}")
        
        try:
            # Check if process is still running
            if self.process.returncode is not None:
                print(f"❌ Process has terminated with code: {self.process.returncode}")
                # Try to read stderr for error info
                stderr_data = await self.process.stderr.read()
                if stderr_data:
                    print(f"❌ Process stderr: {stderr_data.decode()}")
                return {"error": {"code": -1, "message": "Server process terminated"}}
            
            # Send request
            self.process.stdin.write(request_json.encode() + b"\n")
            await self.process.stdin.drain()
            
            # Read response with timeout
            try:
                response_line = await asyncio.wait_for(self.process.stdout.readline(), timeout=10.0)
            except asyncio.TimeoutError:
                print("❌ Timeout waiting for response")
                return {"error": {"code": -1, "message": "Response timeout"}}
            
            if not response_line:
                print("❌ Empty response received")
                return {"error": {"code": -1, "message": "Empty response"}}
            
            response_json = response_line.decode().strip()
            print(f"📥 Received: {response_json}")
            
            try:
                response = json.loads(response_json)
                if "error" in response and response["error"] is not None:
                    print(f"❌ Error: {response['error']}")
                    return response
                return response
            except json.JSONDecodeError:
                print(f"❌ Invalid JSON response: {response_json}")
                return {"error": {"code": -1, "message": "Invalid JSON response"}}
        
        except Exception as e:
            print(f"❌ Exception during send_request: {e}")
            return {"error": {"code": -1, "message": f"Communication error: {e}"}}
    
    async def close(self):
        """Close client connection"""
        if self.process:
            try:
                if self.process.stdin and not self.process.stdin.is_closing():
                    self.process.stdin.close()
                    await self.process.stdin.wait_closed()
                
                # Wait for process to terminate
                try:
                    await asyncio.wait_for(self.process.wait(), timeout=5.0)
                except asyncio.TimeoutError:
                    print("⚠️  Process didn't terminate gracefully, killing it")
                    self.process.terminate()
                    await self.process.wait()
                
                print("🔚 Closed MCP client")
            except Exception as e:
                print(f"⚠️  Error closing client: {e}")


async def demo_full_flow(auth_token: str):
    """Demonstrate full MCP flow"""
    print("🎯 Starting MCP Client Demo")
    print("=" * 50)
    
    client = MCPClient(auth_token)
    
    try:
        # Start client
        await client.start_stdio_client()
        await asyncio.sleep(1)  # Give server time to start
        
        print("\n1️⃣ Testing ping...")
        response = await client.send_request("ping")
        if "error" not in response or response.get("error") is None:
            result = response.get("result", {})
            if result.get("status") == "ok":
                print("✅ Ping successful!")
            else:
                print(f"❌ Ping failed: {result}")
                return
        else:
            print("❌ Ping failed!")
            return
        
        print("\n2️⃣ Listing available tools...")
        response = await client.send_request("tools/list")
        if "error" not in response or response.get("error") is None:
            tools = response.get("result", [])
            print(f"✅ Found {len(tools)} tools:")
            for tool in tools:
                print(f"   - {tool['name']}: {tool['description']}")
        else:
            print("❌ Failed to list tools!")
            return
        
        print("\n3️⃣ Testing elements.get...")
        response = await client.send_request("tools/call", {
            "name": "elements.get",
            "arguments": {"elementId": "login-button"}
        })
        if "error" not in response or response.get("error") is None:
            result = response.get("result", {})
            if result.get("ok"):
                print("✅ Element retrieved successfully!")
                element_data = result.get("data", {})
                print(f"   Element: {element_data.get('element_data', {}).get('logical_key', 'unknown')}")
            else:
                print(f"❌ Element retrieval failed: {result.get('error')}")
        else:
            print("❌ elements.get failed!")
        
        print("\n4️⃣ Testing run_action...")
        response = await client.send_request("tools/call", {
            "name": "run_action", 
            "arguments": {
                "action_type": "click_css",
                "element_name": "login-button",
                "context": {
                    "run_id": "demo-run-001",
                    "step_index": 1,
                    "page_url": "https://example.com/login"
                }
            }
        })
        if "error" not in response or response.get("error") is None:
            result = response.get("result", {})
            if result.get("ok"):
                print("✅ Action executed successfully!")
                data = result.get("data", {})
                print(f"   Status: {data.get('status')}")
                print(f"   Execution time: {data.get('execution_time_ms')}ms")
            else:
                print(f"❌ Action execution failed: {result.get('error')}")
        else:
            print("❌ run_action failed!")
        
        print("\n5️⃣ Testing verify.section...")
        response = await client.send_request("tools/call", {
            "name": "verify.section",
            "arguments": {
                "preset": {
                    "name": "Login Page Verification",
                    "description": "Verify login page elements",
                    "checks": [
                        {
                            "type": "exists",
                            "elementId": "login-button", 
                            "description": "Login button exists"
                        },
                        {
                            "type": "visible",
                            "elementId": "username-field",
                            "description": "Username field is visible"
                        }
                    ]
                }
            }
        })
        if "error" not in response or response.get("error") is None:
            result = response.get("result", {})
            if result.get("ok"):
                print("✅ Verification completed!")
                data = result.get("data", {})
                print(f"   Overall result: {data.get('overall_result')}")
                print(f"   Passed checks: {data.get('passed_checks')}/{data.get('total_checks')}")
            else:
                print(f"❌ Verification failed: {result.get('error')}")
        else:
            print("❌ verify.section failed!")
        
        print("\n6️⃣ Testing resource list...")
        response = await client.send_request("resources/list")
        if "error" not in response or response.get("error") is None:
            resources = response.get("result", [])
            print(f"✅ Found {len(resources)} resources:")
            for resource in resources:
                print(f"   - {resource['uri']}: {resource['name']}")
        else:
            print("❌ Failed to list resources!")
        
        print("\n7️⃣ Testing resource read...")
        response = await client.send_request("resources/read", {
            "uri": "elements://repository/list?limit=5"
        })
        if "error" not in response or response.get("error") is None:
            result = response.get("result", {})
            elements = result.get("elements", [])
            print(f"✅ Retrieved {len(elements)} elements from repository")
        else:
            print("❌ Failed to read elements resource!")
        
    except Exception as e:
        print(f"💥 Demo failed with exception: {e}")
    finally:
        await client.close()
    
    print("\n" + "=" * 50)
    print("🎉 MCP Client Demo Complete!")


async def test_errors(auth_token: str):
    """Test error scenarios"""
    print("🧪 Testing Error Scenarios")
    print("=" * 50)
    
    client = MCPClient()  # No auth token
    
    try:
        await client.start_stdio_client()
        await asyncio.sleep(1)
        
        print("\n1️⃣ Testing missing auth token...")
        response = await client.send_request("tools/list")
        if "error" in response:
            print(f"✅ Correctly rejected: {response['error']['message']}")
        else:
            print("❌ Should have been rejected!")
        
        # Test with token
        client.auth_token = auth_token
        
        print("\n2️⃣ Testing unknown tool...")
        response = await client.send_request("tools/call", {
            "name": "unknown_tool",
            "arguments": {}
        })
        if "error" in response:
            print(f"✅ Correctly rejected unknown tool: {response['error']['message']}")
        else:
            print("❌ Should have rejected unknown tool!")
        
        print("\n3️⃣ Testing invalid params...")
        response = await client.send_request("tools/call", {
            "name": "run_action",
            "arguments": {"invalid": "params"}
        })
        if "error" in response:
            print(f"✅ Correctly rejected invalid params")
        else:
            result = response.get("result", {})
            if not result.get("ok"):
                print(f"✅ Tool correctly failed validation: {result.get('error')}")
            else:
                print("❌ Should have rejected invalid params!")
    
    except Exception as e:
        print(f"💥 Error test failed: {e}")
    finally:
        await client.close()


async def test_performance(auth_token: str):
    """Test performance and caching"""
    print("⚡ Testing Performance & Caching")
    print("=" * 50)
    
    client = MCPClient(auth_token)
    
    try:
        await client.start_stdio_client()
        await asyncio.sleep(1)
        
        print("\n1️⃣ Testing cached resource access...")
        
        # First call (uncached)
        start_time = time.time()
        response1 = await client.send_request("resources/read", {
            "uri": "elements://repository/list?limit=10"
        })
        first_call_time = (time.time() - start_time) * 1000
        
        # Second call (should be cached)
        start_time = time.time()
        response2 = await client.send_request("resources/read", {
            "uri": "elements://repository/list?limit=10"
        })
        second_call_time = (time.time() - start_time) * 1000
        
        print(f"   First call:  {first_call_time:.2f}ms")
        print(f"   Second call: {second_call_time:.2f}ms")
        
        if second_call_time < 200:
            print("✅ Cached call under 200ms budget!")
        else:
            print("⚠️  Cached call exceeded 200ms budget")
        
        if second_call_time < first_call_time:
            print("✅ Caching improved performance!")
        else:
            print("⚠️  No performance improvement from caching")
    
    except Exception as e:
        print(f"💥 Performance test failed: {e}")
    finally:
        await client.close()


def main():
    """Main demo function"""
    parser = argparse.ArgumentParser(description="MCP Client Demo")
    parser.add_argument("--token", default="devtoken", help="Auth token")
    parser.add_argument("--test-errors", action="store_true", help="Test error scenarios")
    parser.add_argument("--test-performance", action="store_true", help="Test performance")
    args = parser.parse_args()
    
    if args.test_errors:
        asyncio.run(test_errors(args.token))
    elif args.test_performance:
        asyncio.run(test_performance(args.token))
    else:
        asyncio.run(demo_full_flow(args.token))


if __name__ == "__main__":
    import os
    main()