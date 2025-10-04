@echo off
echo Starting SQL Backend on port 8002...
echo.

cd /d "%~dp0services\sql-backend"

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing Node.js dependencies...
    npm install
    if errorlevel 1 (
        echo Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo Creating .env file...
    echo PORT=8002 > .env
    echo DB_HOST=localhost >> .env
    echo DB_PORT=5432 >> .env
    echo DB_NAME=mcp_test_framework >> .env
    echo DB_USER=postgres >> .env
    echo DB_PASSWORD=password >> .env
)

echo.
echo Starting SQL Backend...
echo Press Ctrl+C to stop the server
echo.
npm start

pause