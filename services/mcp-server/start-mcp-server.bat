@echo off
setlocal enabledelayedexpansion

echo ========================================
echo  MCP Server Startup Script
echo ========================================
echo.

REM Change to the MCP server directory
cd /d "%~dp0"
echo Current directory: %CD%

REM Check if virtual environment exists
if not exist ".venv" (
    echo ERROR: Virtual environment not found at .venv
    echo Please create virtual environment first:
    echo   python -m venv .venv
    echo   .venv\Scripts\activate
    echo   pip install -r requirements.txt
    pause
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment
    pause
    exit /b 1
)

REM Check if required packages are installed
echo Checking MCP server dependencies...
python -c "import mcp; print('✅ MCP package found')" 2>nul
if errorlevel 1 (
    echo ❌ MCP package not found. Installing...
    pip install mcp
    if errorlevel 1 (
        echo ERROR: Failed to install MCP package
        pause
        exit /b 1
    )
)

python -c "import websockets; print('✅ websockets package found')" 2>nul
if errorlevel 1 (
    echo ❌ websockets package not found. Installing...
    pip install websockets
    if errorlevel 1 (
        echo ERROR: Failed to install websockets package
        pause
        exit /b 1
    )
)

python -c "import httpx; print('✅ httpx package found')" 2>nul
if errorlevel 1 (
    echo ❌ httpx package not found. Installing...
    pip install httpx
    if errorlevel 1 (
        echo ERROR: Failed to install httpx package
        pause
        exit /b 1
    )
)

python -c "import pydantic; print('✅ pydantic package found')" 2>nul
if errorlevel 1 (
    echo ❌ pydantic package not found. Installing...
    pip install pydantic
    if errorlevel 1 (
        echo ERROR: Failed to install pydantic package
        pause
        exit /b 1
    )
)

REM Set environment variables
echo Setting up environment...
set MCP_AUTH_TOKEN=devtoken
set PYTHONPATH=%CD%;%PYTHONPATH%

REM Check if port 8765 is available
echo Checking if port 8765 is available...
netstat -an | find "8765" >nul
if not errorlevel 1 (
    echo ⚠️  WARNING: Port 8765 appears to be in use
    echo This might cause conflicts with the MCP server
    echo.
)

REM Display startup information
echo.
echo ========================================
echo  Starting MCP Server
echo ========================================
echo Server URL: ws://localhost:8765
echo Auth Token: %MCP_AUTH_TOKEN%
echo Transport: WebSocket
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start the MCP server with WebSocket transport
echo 🚀 Starting MCP server...
python main.py --ws --token %MCP_AUTH_TOKEN%

REM Check exit code
if errorlevel 1 (
    echo.
    echo ❌ MCP server exited with error code %errorlevel%
    echo.
    echo Common solutions:
    echo 1. Check if all dependencies are installed
    echo 2. Verify port 8765 is not in use by another process
    echo 3. Check the unified API server is running on port 8000
    echo 4. Review the error messages above
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ✅ MCP server stopped normally
)

pause