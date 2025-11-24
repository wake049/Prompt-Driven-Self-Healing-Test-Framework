@echo off
echo 🔍 Verifying AI Provider Deployment on AWS
echo ==========================================

echo.
echo 📡 Testing production AI configuration endpoints...
echo.

echo 🧪 Testing GET /api/v1/ai-config/status
curl -s https://testhelix.com/api/v1/ai-config/status | jq .

echo.
echo 🧪 Testing GET /api/v1/ai-config/config (without sensitive data)
curl -s https://testhelix.com/api/v1/ai-config/config | jq 'del(.providers[].api_key)'

echo.
echo 🧪 Testing GET /api/v1/ai-config/available-models
curl -s https://testhelix.com/api/v1/ai-config/available-models | jq .

echo.
echo 🌐 Frontend verification:
echo   Visit: https://testhelix.com
echo   Go to: Policy Dashboard → AI Configuration tab
echo.

echo 📋 Deployment verification checklist:
echo   □ AI config API endpoints are responding
echo   □ Available models are listed correctly
echo   □ Frontend shows AI Configuration tab
echo   □ Can view current provider status
echo   □ Can test provider connections
echo   □ Can switch between configured providers

echo.
echo ✅ If all tests pass, your AI provider switching feature is live!
echo.
pause