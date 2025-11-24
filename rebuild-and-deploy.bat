@echo off
echo 🔄 Rebuilding and deploying unified-api with AI provider switching
echo ==================================================================

cd /d "c:\Users\Wakeb\capstone-self-healing\services\unified-api"

echo 📦 Building Docker image with AI provider support...
docker build -t 905418315067.dkr.ecr.us-east-2.amazonaws.com/unified-api:latest .

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker build failed
    pause
    exit /b 1
)

echo 🔐 Logging into ECR...
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 905418315067.dkr.ecr.us-east-2.amazonaws.com

echo 🚀 Pushing to ECR...
docker push 905418315067.dkr.ecr.us-east-2.amazonaws.com/unified-api:latest

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker push failed
    pause
    exit /b 1
)

echo ⚡ Updating ECS service...
aws ecs update-service --cluster testhelix-cluster-v2 --service unified-api-service --force-new-deployment --region us-east-2

echo ✅ Build and push completed successfully!
echo 📋 New features deployed:
echo    AI Configuration API (/api/v1/ai-config/*)
echo   🔄 Dynamic AI provider switching
echo    OpenAI + Anthropic support
echo   ⚙️  Enhanced Policy Dashboard with AI settings
echo.
echo 🔗 Next steps:
echo   1. Wait 2-3 minutes for ECS deployment
echo   2. Run: verify-ai-deployment.bat
echo   3. Visit: https://testhelix.com → Policy Dashboard → AI Configuration
echo   4. Test AI provider switching functionality

pause