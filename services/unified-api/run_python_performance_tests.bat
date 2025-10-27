@echo off
echo ===============================================
echo PYTHON PERFORMANCE TESTING - UNIFIED API
echo ===============================================
echo.

echo [1/4] Installing required dependencies...
pip install psutil aiohttp --quiet

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo [2/4] Starting Unified API server...
cd /d "c:\Users\Wakeb\capstone-self-healing\services\unified-api"

echo Starting API server in background...
start /B python main.py > api_server.log 2>&1

echo Waiting for server to start...
timeout /t 5 /nobreak > nul

echo [3/4] Running performance tests...
echo.
echo This will test:
echo - Memory usage patterns
echo - CPU performance under load
echo - Database query performance  
echo - API endpoint response times
echo - Concurrent request handling
echo - Memory leak detection
echo.

python run_performance_tests.py

echo.
echo [4/4] Performance tests completed!
echo.
echo Check the following for detailed results:
echo - Console output above
echo - performance_report_*.json file
echo - API server logs in api_server.log
echo.

echo Stopping API server...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq python main.py*" 2>nul

pause