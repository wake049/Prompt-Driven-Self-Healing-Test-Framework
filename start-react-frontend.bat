@echo off
echo Starting React Frontend on port 3000...
echo.

cd /d "%~dp0services\react-frontend"

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

echo.
echo Starting React Frontend...
echo This may take 30-60 seconds to compile...
echo Press Ctrl+C to stop the server
echo.
npm start

pause