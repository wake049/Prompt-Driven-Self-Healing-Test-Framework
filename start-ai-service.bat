@echo off
echo Starting AI Service on port 3002...
echo.

cd /d "%~dp0services\ai-service"

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
    if exist ".env.example" (
        echo Copying .env.example to .env...
        copy ".env.example" ".env"
        echo.
        echo Please edit .env file to add your OpenAI API key
        echo OPENAI_API_KEY=your_api_key_here
        echo.
    )
)

echo.
echo Starting AI Service...
echo Press Ctrl+C to stop the server
echo.
npm start

pause