@echo off
echo ========================================
echo  MCP Test Framework - Quick Start
echo ========================================
echo.

REM Check prerequisites
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed  
    echo Please install Python from https://python.org/
    pause
    exit /b 1
)

echo Starting all services in separate windows...
echo.

REM Start each service in its own window
start "MCP Server" cmd /c start-mcp-server.bat
timeout /t 2 /nobreak >nul

start "SQL Backend" cmd /c start-sql-backend.bat  
timeout /t 2 /nobreak >nul

start "AI Service" cmd /c start-ai-service.bat
timeout /t 2 /nobreak >nul

start "React Frontend" cmd /c start-react-frontend.bat

echo All services are starting in separate windows!
echo.
echo Service URLs will be:
echo  - MCP Server:     http://localhost:8001
echo  - SQL Backend:    http://localhost:8002  
echo  - AI Service:     http://localhost:3002
echo  - React Frontend: http://localhost:3000
echo.
echo Wait for all services to start, then visit:
echo http://localhost:3000
echo.

pause