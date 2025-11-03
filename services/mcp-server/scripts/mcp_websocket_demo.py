#!/usr/bin/env python3
"""
MCP WebSocket Client Demo

Alternative client using WebSocket transport instead of stdio
"""

import asyncio
import json
import websockets
import argparse
from typing import Dict, Any, Optional


class MCPWebSocketClient:
    """MCP client using WebSocket transport"""
    
    def __init__(self, host: str = "localhost", port: int = 8765, auth_token: Optional[str] = None):
        self.host = host
        self.port = port
        self.auth_token = auth_token
        self.request_id = 0
        self.websocket = None
    
    def _next_id(self) -> int:
        """Get next request ID"""
        self.request_id += 1
        return self.request_id
    
    async def connect(self):
        """Connect to MCP server via WebSocket"""
        uri = f"ws://{self.host}:{self.port}"
        headers = {}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        self.websocket = await websockets.connect(uri, extra_headers=headers)
        print(f"🚀 Connected to MCP server at {uri}")
    
    async def send_request(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Send MCP request and get response"""
        request = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": method,
            "params": params or {}
        }
        
        request_json = json.dumps(request)
        print(f"📤 Sending: {request_json}")
        
        # Send request
        await self.websocket.send(request_json)
        
        # Read response
        response_json = await self.websocket.recv()
        print(f"📥 Received: {response_json}")
        
        try:
            response = json.loads(response_json)
            if "error" in response:
                print(f"❌ Error: {response['error']}")
                return response
            return response
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON response: {response_json}")
            return {"error": {"code": -1, "message": "Invalid JSON response"}}
    
    async def close(self):
        """Close WebSocket connection"""
        if self.websocket:
            await self.websocket.close()
            print("🔚 Closed WebSocket connection")


async def demo_websocket_flow(host: str, port: int, auth_token: str):
    """Demonstrate WebSocket MCP flow"""
    print("🌐 Starting MCP WebSocket Client Demo")
    print("=" * 50)
    
    client = MCPWebSocketClient(host, port, auth_token)
    
    try:
        # Connect
        await client.connect()
        
        print("\n1️⃣ Testing ping...")
        response = await client.send_request("ping")
        if "error" not in response:
            print("✅ Ping successful!")
        else:
            print("❌ Ping failed!")
            return
        
        print("\n2️⃣ Testing context.get...")
        response = await client.send_request("tools/call", {
            "name": "context.get",
            "arguments": {"run_id": "ws-demo-run"}
        })
        if "error" not in response:
            result = response.get("result", {})
            if result.get("ok"):
                print("✅ Context retrieved successfully!")
                data = result.get("data", {})
                print(f"   Context entries: {len(data.get('context', []))}")
            else:
                print(f"❌ Context retrieval failed: {result.get('error')}")
        else:
            print("❌ context.get failed!")
        
        print("\n3️⃣ Testing context.set...")
        response = await client.send_request("tools/call", {
            "name": "context.set",
            "arguments": {
                "context": {
                    "run_id": "ws-demo-run",
                    "user_id": "websocket-user",
                    "session_data": {"transport": "websocket", "demo": True}
                }
            }
        })
        if "error" not in response:
            result = response.get("result", {})
            if result.get("ok"):
                print("✅ Context set successfully!")
            else:
                print(f"❌ Context set failed: {result.get('error')}")
        else:
            print("❌ context.set failed!")
        
        print("\n4️⃣ Testing adaptive actions...")
        response = await client.send_request("tools/call", {
            "name": "actions.adaptive",
            "arguments": {
                "intent": "Login to application",
                "context": {
                    "current_url": "https://app.example.com/login",
                    "available_elements": ["username-field", "password-field", "login-button"]
                }
            }
        })
        if "error" not in response:
            result = response.get("result", {})
            if result.get("ok"):
                print("✅ Adaptive actions generated!")
                data = result.get("data", {})
                actions = data.get("recommended_actions", [])
                print(f"   Generated {len(actions)} actions")
                for i, action in enumerate(actions[:3]):  # Show first 3
                    print(f"   {i+1}. {action.get('type')}: {action.get('description')}")
            else:
                print(f"❌ Adaptive actions failed: {result.get('error')}")
        else:
            print("❌ actions.adaptive failed!")
        
    except websockets.exceptions.ConnectionClosed:
        print("❌ WebSocket connection closed unexpectedly")
    except Exception as e:
        print(f"💥 Demo failed with exception: {e}")
    finally:
        await client.close()
    
    print("\n" + "=" * 50)
    print("🎉 WebSocket Demo Complete!")


async def test_concurrent_requests(host: str, port: int, auth_token: str):
    """Test concurrent request handling"""
    print("🔄 Testing Concurrent Requests")
    print("=" * 50)
    
    async def make_request(client_id: int):
        """Make a request from a specific client"""
        client = MCPWebSocketClient(host, port, auth_token)
        try:
            await client.connect()
            
            # Each client makes multiple requests
            for i in range(3):
                response = await client.send_request("tools/call", {
                    "name": "context.get",
                    "arguments": {"run_id": f"concurrent-test-{client_id}-{i}"}
                })
                if "error" not in response:
                    print(f"✅ Client {client_id} request {i+1} succeeded")
                else:
                    print(f"❌ Client {client_id} request {i+1} failed")
        
        except Exception as e:
            print(f"💥 Client {client_id} failed: {e}")
        finally:
            await client.close()
    
    # Run 5 concurrent clients
    tasks = [make_request(i) for i in range(5)]
    await asyncio.gather(*tasks)
    
    print("🎉 Concurrent test complete!")


def main():
    """Main WebSocket demo function"""
    parser = argparse.ArgumentParser(description="MCP WebSocket Client Demo")
    parser.add_argument("--host", default="localhost", help="Server host")
    parser.add_argument("--port", type=int, default=8765, help="Server port")
    parser.add_argument("--token", default="devtoken", help="Auth token")
    parser.add_argument("--concurrent", action="store_true", help="Test concurrent requests")
    args = parser.parse_args()
    
    if args.concurrent:
        asyncio.run(test_concurrent_requests(args.host, args.port, args.token))
    else:
        asyncio.run(demo_websocket_flow(args.host, args.port, args.token))


if __name__ == "__main__":
    main()