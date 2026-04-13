@echo off
REM Unified API Startup Script for Windows
echo  Starting Unified MCP API Server...

REM Set environment variables
if "%HOST%"=="" set HOST=0.0.0.0
if "%PORT%"=="" set PORT=8000
if "%RELOAD%"=="" set RELOAD=true

REM Database configuration
if "%DB_HOST%"=="" set DB_HOST=localhost
if "%DB_PORT%"=="" set DB_PORT=5432
if "%DB_NAME%"=="" set DB_NAME=testframework_db
if "%DB_USER%"=="" set DB_USER=testframework
if "%DB_PASSWORD%"=="" set DB_PASSWORD=securepassword

REM AI service configuration
if "%OPENAI_MODEL%"=="" set OPENAI_MODEL=gpt-4o
if "%OPENAI_MAX_TOKENS%"=="" set OPENAI_MAX_TOKENS=1500

echo  Configuration:
echo   Host: %HOST%
echo   Port: %PORT%
echo   Database: %DB_HOST%:%DB_PORT%/%DB_NAME%
echo   OpenAI Model: %OPENAI_MODEL%

REM Install dependencies
echo 📦 Installing dependencies...
pip install -r requirements.txt

REM Start the server
echo  Starting FastAPI server...
python -m uvicorn main:app --host %HOST% --port %PORT% --reload