@echo off
echo Starting SQL Backend for Self-Healing Test Framework...
echo.

cd /d "%~dp0"
cd services\sql-backend

echo Checking if Node.js is installed...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found: 
node --version

echo.
echo Installing dependencies...
call npm install

echo.
echo Starting SQL Backend on port 3001...
echo Backend will be available at http://localhost:3001
echo.
echo Press Ctrl+C to stop the backend
echo.
call npm start