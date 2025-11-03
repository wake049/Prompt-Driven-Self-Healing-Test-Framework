@echo off
echo Testing MCP Server startup...
cd /d "c:\Users\Wakeb\capstone-self-healing\services\mcp-server"

echo.
echo 1. Checking Python version:
python --version

echo.
echo 2. Testing imports:
python -c "
import asyncio
print('✅ asyncio available')

try:
    import mcp
    print('✅ mcp package available')
except ImportError as e:
    print('❌ mcp package missing:', e)

try:
    import websockets
    print('✅ websockets package available')
except ImportError as e:
    print('❌ websockets package missing:', e)

try:
    from mcp_server.server import MCPServer
    print('✅ MCPServer class available')
except ImportError as e:
    print('❌ MCPServer import failed:', e)
except Exception as e:
    print('❌ MCPServer error:', e)
"

echo.
echo 3. Testing server startup (will timeout after 10 seconds):
timeout /t 10 python main.py --ws

echo.
echo Test complete!
pause