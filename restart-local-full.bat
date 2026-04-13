@echo off
echo ========================================
echo Restarting ALL Local Services
echo ========================================

echo.
echo 1. Stopping existing services...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM java.exe 2>nul
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo 2. Starting Unified API (Port 8000)...
cd services\unified-api
start "Unified API" cmd /k "python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
cd ..\..

echo.
echo 3. Waiting for Unified API to start...
timeout /t 5 /nobreak >nul

echo.
echo 4. Starting Java Runner (Port 8080)...
cd services\java-runner
start "Java Runner" cmd /k "mvn spring-boot:run"
cd ..\..

echo.
echo 5. Waiting for Java Runner to start...
timeout /t 10 /nobreak >nul

echo.
echo 6. Starting React Frontend (Port 3000)...
cd services\react-frontend
start "React Frontend" cmd /k "npm run dev"
cd ..\..

echo.
echo ========================================
echo All services starting!
echo ========================================
echo.
echo Unified API:      http://localhost:8000
echo Java Runner:      http://localhost:8080
echo React Frontend:   http://localhost:3000
echo API Docs:         http://localhost:8000/docs
echo.
echo Press any key to exit...
pause >nul
