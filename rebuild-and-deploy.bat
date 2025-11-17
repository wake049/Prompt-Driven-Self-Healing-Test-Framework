@echo off
echo 🔄 Rebuilding and deploying unified-api with enhanced logging
echo =================================================================

cd /d "c:\Users\Wakeb\capstone-self-healing\services\unified-api"

echo 📦 Building Docker image...
docker build -t 905418315067.dkr.ecr.us-east-2.amazonaws.com/unified-api:latest .

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker build failed
    pause
    exit /b 1
)

echo 🚀 Pushing to ECR...
docker push 905418315067.dkr.ecr.us-east-2.amazonaws.com/unified-api:latest

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker push failed
    pause
    exit /b 1
)

echo ✅ Build and push completed successfully!
echo 📋 Next steps:
echo   1. Update your ECS service to use the new image
echo   2. Check the logs for enhanced debugging information
echo   3. Test the plan generation endpoint

pause