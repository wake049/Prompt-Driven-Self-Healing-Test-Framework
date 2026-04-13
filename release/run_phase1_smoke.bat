@echo off
setlocal

echo [phase1-smoke] Starting local stack...
docker compose -f docker-compose.local.yml up -d --build
if errorlevel 1 (
  echo [phase1-smoke] Failed to start docker stack.
  exit /b 1
)

echo [phase1-smoke] Waiting for unified API health...
set RETRIES=60
:wait_loop
curl -fsS http://localhost:8000/health >nul 2>&1
if %errorlevel%==0 goto run_smoke
set /a RETRIES-=1
if %RETRIES% LEQ 0 (
  echo [phase1-smoke] Unified API did not become healthy in time.
  docker compose -f docker-compose.local.yml logs --tail=200
  exit /b 1
)
timeout /t 5 /nobreak >nul
goto wait_loop

:run_smoke
echo [phase1-smoke] Running smoke test...
python tests/smoke_release_phase1.py --base-url http://localhost:8000
set SMOKE_EXIT=%errorlevel%

if NOT "%SMOKE_EXIT%"=="0" (
  echo [phase1-smoke] Smoke failed. Showing logs...
  docker compose -f docker-compose.local.yml logs --tail=300
  exit /b %SMOKE_EXIT%
)

echo [phase1-smoke] Smoke completed successfully.
exit /b 0
