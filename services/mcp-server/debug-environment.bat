@echo off
echo ========================================
echo  MCP Server Debug Check
echo ========================================
echo.

cd /d "%~dp0"
echo Current directory: %CD%

REM Activate virtual environment
if exist ".venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call .venv\Scripts\activate.bat
) else (
    echo WARNING: No virtual environment found, using system Python
)

echo.
echo Python version:
python --version

echo.
echo Python path:
python -c "import sys; print(sys.executable)"

echo.
echo Current working directory from Python:
python -c "import os; print(os.getcwd())"

echo.
echo Checking imports:
python -c "
try:
    import mcp
    print('✅ mcp imported successfully, version:', getattr(mcp, '__version__', 'unknown'))
except ImportError as e:
    print('❌ mcp import failed:', e)

try:
    import websockets
    print('✅ websockets imported successfully, version:', getattr(websockets, '__version__', 'unknown'))
except ImportError as e:
    print('❌ websockets import failed:', e)

try:
    import httpx
    print('✅ httpx imported successfully, version:', getattr(httpx, '__version__', 'unknown'))
except ImportError as e:
    print('❌ httpx import failed:', e)

try:
    import pydantic
    print('✅ pydantic imported successfully, version:', pydantic.VERSION)
except ImportError as e:
    print('❌ pydantic import failed:', e)
"

echo.
echo Checking if main.py exists:
if exist "main.py" (
    echo ✅ main.py found
) else (
    echo ❌ main.py not found
)

echo.
echo Checking if mcp_server module exists:
if exist "mcp_server" (
    echo ✅ mcp_server directory found
) else (
    echo ❌ mcp_server directory not found
)

if exist "mcp_server\__init__.py" (
    echo ✅ mcp_server/__init__.py found
) else (
    echo ❌ mcp_server/__init__.py not found
)

if exist "mcp_server\server.py" (
    echo ✅ mcp_server/server.py found
) else (
    echo ❌ mcp_server/server.py not found
)

echo.
echo Testing import of local module:
python -c "
try:
    from mcp_server.server import MCPServer
    print('✅ MCPServer imported successfully')
except ImportError as e:
    print('❌ MCPServer import failed:', e)
except Exception as e:
    print('❌ Other error importing MCPServer:', e)
"

echo.
echo Testing main.py syntax:
python -m py_compile main.py
if errorlevel 1 (
    echo ❌ Syntax error in main.py
) else (
    echo ✅ main.py syntax is valid
)

echo.
echo ========================================
echo  Debug check complete
echo ========================================
pause