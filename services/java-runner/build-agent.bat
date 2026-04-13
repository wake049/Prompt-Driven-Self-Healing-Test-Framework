@echo off
REM ============================================================
REM Build a portable runner agent ZIP for distribution.
REM Produces: dist/self-healing-runner.zip
REM Contents: fat JAR + bundled JRE + start scripts + config
REM
REM Prerequisites: JDK 17+, Maven 3.8+
REM ============================================================

setlocal enabledelayedexpansion
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "DIST_DIR=dist"
set "STAGE_DIR=%DIST_DIR%\self-healing-runner"
set "JAR_NAME=self-healing-test-framework-1.0-SNAPSHOT.jar"

echo ==============================
echo  Building Runner Agent
echo ==============================

REM 1. Maven build (fat JAR via spring-boot-maven-plugin)
echo [1/4] Building JAR...
call mvn clean package -DskipTests -q
if errorlevel 1 (
    echo ERROR: Maven build failed
    exit /b 1
)

REM 2. Prepare staging directory
echo [2/4] Staging distribution...
if exist "%STAGE_DIR%" rmdir /s /q "%STAGE_DIR%"
mkdir "%STAGE_DIR%"
mkdir "%STAGE_DIR%\logs"

copy "target\%JAR_NAME%" "%STAGE_DIR%\runner.jar" >nul

REM 3. Copy config templates
echo [3/4] Copying configuration...
copy "src\main\resources\application-agent.properties" "%STAGE_DIR%\application-agent.properties.example" >nul

REM Create the launch script
(
echo @echo off
echo REM Self-Healing Test Runner Agent
echo REM Edit runner-config.properties before first run.
echo.
echo setlocal
echo set "RUNNER_DIR=%%~dp0"
echo.
echo REM Use bundled JRE if present, otherwise system Java
echo if exist "%%RUNNER_DIR%%jre\bin\java.exe" ^(
echo     set "JAVA=%%RUNNER_DIR%%jre\bin\java.exe"
echo ^) else ^(
echo     set "JAVA=java"
echo ^)
echo.
echo echo Starting Self-Healing Test Runner Agent...
echo echo API URL: %%RUNNER_API_URL%%
echo echo.
echo.
echo "%%JAVA%%" -Xms256m -Xmx512m ^
echo   -jar "%%RUNNER_DIR%%runner.jar" ^
echo   --spring.profiles.active=agent ^
echo   --spring.config.additional-location=file:%%RUNNER_DIR%%runner-config.properties
echo.
echo if errorlevel 1 ^(
echo     echo.
echo     echo Runner exited with an error. Check logs/ for details.
echo     pause
echo ^)
) > "%STAGE_DIR%\start-runner.bat"

REM Create default config file
(
echo # Self-Healing Runner Agent Configuration
echo # Edit these values before first run.
echo.
echo # Your platform API URL
echo runner.api-url=http://localhost:8000
echo.
echo # Your organization ID ^(from the web dashboard^)
echo runner.organization-id=
echo.
echo # Runner name ^(leave blank for auto hostname^)
echo runner.name=
echo.
echo # API key ^(if required by your server^)
echo runner.api-key=
echo.
echo # Browsers this runner supports ^(comma-separated: chrome,firefox,edge^)
echo runner.capabilities=chrome
echo.
echo # Run browsers in headless mode? ^(true/false^)
echo HEADLESS=false
echo.
echo # Port for health check endpoint
echo server.port=8080
) > "%STAGE_DIR%\runner-config.properties"

REM Create README
(
echo # Self-Healing Test Runner Agent
echo.
echo ## Quick Start
echo.
echo 1. Edit `runner-config.properties` — set your API URL and organization ID.
echo 2. Double-click `start-runner.bat` ^(Windows^) or run `./start-runner.sh` ^(Mac/Linux^).
echo 3. The runner registers with your platform and starts polling for work.
echo.
echo ## Requirements
echo.
echo - Chrome, Firefox, or Edge installed on this machine
echo - No Java installation needed ^(bundled JRE, if included^)
echo - Outbound HTTPS access to your platform API
echo.
echo ## Files
echo.
echo - `runner.jar` — The runner application
echo - `runner-config.properties` — Your configuration ^(edit this^)
echo - `start-runner.bat` — Windows launch script
echo - `start-runner.sh` — Mac/Linux launch script
echo - `logs/` — Log files
echo - `runner-credentials.properties` — Auto-generated after first registration
echo.
echo ## Bundling a JRE ^(optional^)
echo.
echo To make the runner fully self-contained ^(no system Java needed^):
echo.
echo 1. Download a JRE 17 from https://adoptium.net/
echo 2. Extract it into a `jre/` folder next to `runner.jar`
echo 3. The start script automatically detects and uses it
) > "%STAGE_DIR%\README.md"

REM 4. Create ZIP
echo [4/4] Creating ZIP...
where tar >nul 2>&1
if %errorlevel% equ 0 (
    cd "%DIST_DIR%"
    tar -cf "self-healing-runner.zip" -a "self-healing-runner"
    cd ..
) else (
    echo WARNING: tar not found. Please manually zip %STAGE_DIR%
)

echo.
echo ==============================
echo  Build complete!
echo  Output: %DIST_DIR%\self-healing-runner.zip
echo ==============================
