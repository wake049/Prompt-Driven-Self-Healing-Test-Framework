@echo off
setlocal enabledelayedexpansion

echo ================================================================
echo   Self-Healing Test Framework with SQL Backend Integration
echo   Milestone M5 - Complete End-to-End Execution
echo ================================================================
echo.

:: Set Java and Maven environment variables
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
set "MAVEN_HOME=C:\maven\apache-maven-3.9.5"
set "PATH=%JAVA_HOME%\bin;%MAVEN_HOME%\bin;%PATH%"

echo [1/6] Verifying Java installation...
java -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java 17 not found. Please ensure Java 17 is installed.
    pause
    exit /b 1
)
echo ✓ Java 17 is available

echo.
echo [2/6] Verifying Maven installation...
mvn -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Maven not found. Please ensure Maven is installed.
    pause
    exit /b 1
)
echo ✓ Maven is available

echo.
echo [3/6] Checking SQL Backend availability...
curl -s http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo ⚠ SQL Backend not running on port 3001
    echo   The framework will fall back to JSON file repository
    echo   To use SQL backend, start it with: start-sql-backend.bat
    set USE_SQL_BACKEND=false
) else (
    echo ✓ SQL Backend is running on port 3001
    set USE_SQL_BACKEND=true
)

echo.
echo [4/6] Compiling Java framework...
cd /d "%~dp0\services\java-runner"
call mvn clean compile -q
if errorlevel 1 (
    echo ERROR: Failed to compile Java framework
    pause
    exit /b 1
)
echo ✓ Java framework compiled successfully

echo.
if "%USE_SQL_BACKEND%"=="true" (
    echo [5/6] Seeding SQL Backend with sample data...
    call mvn exec:java -Dexec.mainClass=demo.SqlBackendSeeder -q
    if errorlevel 1 (
        echo WARNING: Failed to seed SQL backend, but continuing...
    ) else (
        echo ✓ SQL Backend seeded with sample element alternatives
    )
) else (
    echo [5/6] SQL Backend not available - using JSON file repository
    echo ✓ JSON element repository ready
)

echo.
echo [6/6] Starting Self-Healing Test Framework...
echo ================================================================
echo   Framework Configuration:
if "%USE_SQL_BACKEND%"=="true" (
    echo   - Element Repository: SQL Backend ^(PostgreSQL^)
    echo   - Backend URL: http://localhost:3001
    echo   - Test Steps: Generated from SQL Backend Elements
    echo   - Self-Healing: SQL Backend Alternatives
) else (
    echo   - Element Repository: JSON File ^(element_repository.json^)
    echo   - Test Steps: steps.json ^(Swag Labs login test^)
    echo   - Self-Healing: JSON File Alternatives
)
echo   - Browser: Chrome ^(headless=false^)
echo   - Screenshots: Enabled on failure
echo   - Healing Logs: healing_log.json
echo   - Run Summary: run_summary.json
echo ================================================================
echo.

call mvn exec:java -Dexec.mainClass=demo.Main

echo.
echo ================================================================
echo   Test Execution Complete
echo ================================================================
echo.
echo Generated Files:
if exist "run_summary.json" echo   ✓ run_summary.json - Complete test execution summary
if exist "healing_log.json" echo   ✓ healing_log.json - Self-healing attempt logs
if exist "screenshots" echo   ✓ screenshots\ - Failure screenshots (if any)

echo.
echo Press any key to exit...
pause >nul