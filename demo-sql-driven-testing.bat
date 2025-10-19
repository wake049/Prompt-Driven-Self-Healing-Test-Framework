@echo off
echo ================================================================
echo   DEMO: SQL-Driven Self-Healing Test Framework
echo   Complete workflow from element capture to test execution
echo ================================================================
echo.

:: Set environment variables
set "JAVA_HOME=C:\Program Files\Java\jdk-17"
set "MAVEN_HOME=C:\maven\apache-maven-3.9.5"
set "PATH=%JAVA_HOME%\bin;%MAVEN_HOME\bin;%PATH%"

echo [STEP 1] Starting SQL Backend...
echo This simulates the chrome extension recording elements to the database
echo.

start "SQL Backend" cmd /c "cd services\sql-backend && npm start"
echo Waiting for SQL backend to start...
timeout /t 5 /nobreak >nul

echo.
echo [STEP 2] Populating SQL Backend with captured elements...
echo This simulates elements captured by the chrome extension
cd services\java-runner
call mvn compile -q
call mvn exec:java -Dexec.mainClass=demo.SqlBackendSeeder -q

echo.
echo [STEP 3] Generating and executing test steps from SQL backend...
echo The framework will:
echo   1. Query the SQL backend for recorded elements
echo   2. Generate appropriate test actions based on element types
echo   3. Execute the generated test steps with Selenium
echo   4. Use SQL backend alternatives for self-healing when needed
echo.

pause
echo.
echo Starting test execution...
call mvn exec:java -Dexec.mainClass=demo.Main

echo.
echo ================================================================
echo   DEMO COMPLETE
echo ================================================================
echo.
echo What just happened:
echo 1. SQL Backend was populated with element data (simulating chrome extension)
echo 2. Test framework generated actions from the recorded elements
echo 3. Framework executed the generated test steps
echo 4. Self-healing used SQL backend alternatives when locators failed
echo.
echo Generated files:
if exist "run_summary.json" echo   ✓ run_summary.json
if exist "healing_log.json" echo   ✓ healing_log.json
echo.
pause