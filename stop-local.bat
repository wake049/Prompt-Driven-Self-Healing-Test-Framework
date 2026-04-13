@echo off
REM Stop the local development environment

echo ========================================
echo Stopping Local Development Environment
echo ========================================
echo.

docker-compose -f docker-compose.local.yml down

echo.
echo Local environment stopped.
echo.
echo To remove volumes (will delete local database):
echo   docker-compose -f docker-compose.local.yml down -v
echo.

pause
