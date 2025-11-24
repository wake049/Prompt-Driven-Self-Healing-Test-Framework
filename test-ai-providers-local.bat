@echo off
echo 🧪 Testing AI Provider Switching Feature Locally
echo =================================================

cd /d "c:\Users\Wakeb\capstone-self-healing"

echo 📍 Testing AI configuration endpoints...

echo.
echo 🔍 Step 1: Building and starting containers locally...
docker-compose -f docker-compose.yml up -d --build

timeout /t 10 /nobreak > nul

echo.
echo 🧪 Step 2: Testing AI config endpoints...
echo.

echo 📡 Testing GET /api/v1/ai-config/config
curl -s http://localhost:8000/api/v1/ai-config/config | jq .

echo.
echo 📡 Testing GET /api/v1/ai-config/status  
curl -s http://localhost:8000/api/v1/ai-config/status | jq .

echo.
echo 📡 Testing GET /api/v1/ai-config/available-models
curl -s http://localhost:8000/api/v1/ai-config/available-models | jq .

echo.
echo 🌐 Step 3: Testing frontend AI settings...
echo   Frontend should be available at: http://localhost:3000
echo   Navigate to Policy Dashboard and check the "AI Configuration" tab

echo.
echo 📋 Test checklist:
echo   □ API endpoints respond correctly
echo   □ Frontend loads AI settings tab  
echo   □ Can view current AI configuration
echo   □ Can test AI provider connections
echo   □ Can switch between providers
echo   □ Configuration persists between restarts

echo.
echo 🔧 If everything works locally, run: deploy-ai-providers.bat
echo.
pause

echo.
echo 🛑 Stopping local containers...
docker-compose -f docker-compose.yml down