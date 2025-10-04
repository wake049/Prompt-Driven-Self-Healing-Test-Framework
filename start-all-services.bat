@echo off
echo ========================================
echo  MCP Test Framework - Starting All Services
echo ========================================
echo.

echo Starting MCP Test Framework Services...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✓ Node.js detected

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python from https://python.org/
    pause
    exit /b 1
)

echo ✓ Python detected
echo.

REM Get the script directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%"

REM Port configuration
set "MCP_PORT=8001"
set "SQL_PORT=8002" 
set "REACT_PORT=3000"
set "AI_PORT=3002"

echo Checking ports...
netstat -an | find ":8001" >nul 2>&1 && echo Warning: Port 8001 (MCP Server) is already in use
netstat -an | find ":8002" >nul 2>&1 && echo Warning: Port 8002 (SQL Backend) is already in use
netstat -an | find ":3000" >nul 2>&1 && echo Warning: Port 3000 (React Frontend) is already in use
netstat -an | find ":3002" >nul 2>&1 && echo Warning: Port 3002 (AI Service) is already in use

echo.
echo Starting services in new terminal windows...
echo.

REM Start MCP Server
echo 1. Starting MCP Server (Port 8001)...
cd /d "%PROJECT_ROOT%services\mcp-server"
if not exist "venv" (
    echo   Creating Python virtual environment...
    python -m venv venv
)
if not exist ".env" (
    if exist ".env.example" (
        echo   Copying .env.example to .env...
        copy ".env.example" ".env"
    )
)
start "MCP Server" cmd /k "echo MCP Server starting on port 8001 && venv\Scripts\activate && pip install -r requirements.txt && python main.py"

REM Wait a moment before starting next service
timeout /t 3 /nobreak >nul

REM Start SQL Backend
echo 2. Starting SQL Backend (Port 8002)...
cd /d "%PROJECT_ROOT%services\sql-backend"
if not exist "node_modules" (
    echo   Installing dependencies for SQL Backend...
    call npm install
)
REM Create .env file with updated port
if not exist ".env" (
    echo PORT=8002 > .env
    echo DB_HOST=localhost >> .env
    echo DB_PORT=5432 >> .env
    echo DB_NAME=mcp_test_framework >> .env
    echo DB_USER=postgres >> .env
    echo DB_PASSWORD=password >> .env
)
start "MCP SQL Backend" cmd /k "echo SQL Backend starting on port 8002 && npm start"

REM Wait a moment before starting next service
timeout /t 2 /nobreak >nul

REM Start AI Service
echo 3. Starting AI Service (Port 3002)...
cd /d "%PROJECT_ROOT%services\ai-service"
if not exist "node_modules" (
    echo   Installing dependencies for AI Service...
    call npm install
)
start "MCP AI Service" cmd /k "echo AI Service starting on port 3002 && npm start"

REM Wait a moment before starting next service
timeout /t 2 /nobreak >nul

REM Start React Frontend
echo 4. Starting React Frontend (Port 3000)...
cd /d "%PROJECT_ROOT%services\react-frontend"
if not exist "node_modules" (
    echo   Installing dependencies for React Frontend...
    call npm install
)
start "MCP React Frontend" cmd /k "echo React Frontend starting on port 3000 && npm start"

echo.
echo ========================================
echo  All services are starting!
echo ========================================
echo.
echo Service URLs:
echo   • MCP Server API:     http://localhost:8001
echo   • SQL Backend API:    http://localhost:8002
echo   • AI Service API:     http://localhost:3002  
echo   • React Frontend:     http://localhost:3000
echo.
echo Note:
echo   • Each service will open in its own terminal window
echo   • Wait for all services to fully start before testing
echo   • MCP Server (Python) may take 15-30 seconds to start
echo   • React Frontend may take 30-60 seconds to compile
echo   • Press Ctrl+C in any terminal to stop that service
echo.
echo Health Check URLs:
echo   • MCP Server:   http://localhost:8001/api/v1/health
echo   • SQL Backend:  http://localhost:8002/health
echo   • AI Service:   http://localhost:3002/health
echo   • React App:    http://localhost:3000
echo.
echo ✓ Startup complete! Services are running in separate windows.
echo.
pause