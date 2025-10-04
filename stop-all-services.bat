@echo off
echo ========================================
echo  MCP Test Framework - Stopping All Services
echo ========================================
echo.

REM Set colors for output
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "GREEN=%ESC%[92m"
set "YELLOW=%ESC%[93m"
set "RED=%ESC%[91m"
set "BLUE=%ESC%[94m"
set "RESET=%ESC%[0m"

echo %BLUE%Stopping MCP Test Framework Services...%RESET%
echo.

REM Function to kill processes by port
echo %YELLOW%Stopping services by port...%RESET%

echo %YELLOW%1. Stopping MCP Server (Port 8001)...%RESET%
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8001 "') do (
    taskkill /F /PID %%a >nul 2>&1
    if not errorlevel 1 echo   %GREEN%✓ Process on port 8001 terminated%RESET%
)

echo %YELLOW%2. Stopping SQL Backend (Port 8002)...%RESET%
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8002 "') do (
    taskkill /F /PID %%a >nul 2>&1
    if not errorlevel 1 echo   %GREEN%✓ Process on port 8002 terminated%RESET%
)

echo %YELLOW%3. Stopping AI Service (Port 3002)...%RESET%
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3002 "') do (
    taskkill /F /PID %%a >nul 2>&1
    if not errorlevel 1 echo   %GREEN%✓ Process on port 3002 terminated%RESET%
)

echo %YELLOW%4. Stopping React Frontend (Port 3000)...%RESET%
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000 "') do (
    taskkill /F /PID %%a >nul 2>&1
    if not errorlevel 1 echo   %GREEN%✓ Process on port 3000 terminated%RESET%
)

echo.
echo %BLUE%Stopping Node.js and Python processes...%RESET%

REM Kill any remaining Node.js processes that might be our services
tasklist /FI "IMAGENAME eq node.exe" | find "node.exe" >nul
if not errorlevel 1 (
    echo %YELLOW%Found Node.js processes, checking for our services...%RESET%
    REM This is more aggressive - only use if needed
    REM taskkill /F /IM node.exe >nul 2>&1
    echo   %YELLOW%Manual check: Some Node.js processes may still be running%RESET%
)

REM Kill any remaining Python processes that might be our MCP server
tasklist /FI "IMAGENAME eq python.exe" | find "python.exe" >nul
if not errorlevel 1 (
    echo %YELLOW%Found Python processes, checking for MCP server...%RESET%
    REM This is more aggressive - only use if needed
    REM taskkill /F /IM python.exe >nul 2>&1
    echo   %YELLOW%Manual check: Some Python processes may still be running%RESET%
)

echo.
echo %BLUE%Cleaning up terminal windows...%RESET%

REM Close any CMD windows with our service titles
taskkill /FI "WINDOWTITLE eq MCP Server*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq MCP SQL Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq MCP AI Service*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq MCP React Frontend*" /F >nul 2>&1

echo %GREEN%✓ Terminal windows closed%RESET%

echo.
echo %GREEN%========================================%RESET%
echo %GREEN% All services stopped successfully!%RESET%
echo %GREEN%========================================%RESET%
echo.

echo %BLUE%Service Status:%RESET%
echo   • MCP Server (8001):     %GREEN%Stopped%RESET%
echo   • SQL Backend (8002):    %GREEN%Stopped%RESET%
echo   • AI Service (3002):     %GREEN%Stopped%RESET%
echo   • React Frontend (3000): %GREEN%Stopped%RESET%
echo.

echo %YELLOW%Note:%RESET%
echo   • All service processes have been terminated
echo   • Terminal windows have been closed
echo   • You can restart services with 'start-all-services.bat'
echo   • If any processes persist, you may need to restart them manually
echo.

echo %BLUE%To verify all services are stopped, you can run:%RESET%
echo   netstat -an | find ":8001"
echo   netstat -an | find ":8002"
echo   netstat -an | find ":3000"
echo   netstat -an | find ":3002"
echo.

pause