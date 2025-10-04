# MCP Test Framework - Start All Services (PowerShell)
# Run with: .\start-all-services.ps1

Write-Host "========================================" -ForegroundColor Blue
Write-Host " MCP Test Framework - Starting All Services" -ForegroundColor Blue  
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

Write-Host "Starting MCP Test Framework Services..." -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    Write-Host "✓ Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/"
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Python is installed
try {
    $pythonVersion = python --version 2>$null
    Write-Host "✓ Python detected: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python from https://python.org/"
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Get script directory
$PROJECT_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# Port configuration
$MCP_PORT = 8001
$SQL_PORT = 8002
$REACT_PORT = 3000
$AI_PORT = 3002

Write-Host "Checking ports..." -ForegroundColor Yellow

# Check if ports are in use
$portCheck = @(
    @{Port=$MCP_PORT; Name="MCP Server"},
    @{Port=$SQL_PORT; Name="SQL Backend"},
    @{Port=$REACT_PORT; Name="React Frontend"},
    @{Port=$AI_PORT; Name="AI Service"}
)

foreach ($check in $portCheck) {
    $connections = netstat -an | Select-String ":$($check.Port)"
    if ($connections) {
        Write-Host "Warning: Port $($check.Port) ($($check.Name)) is already in use" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Starting services in new terminal windows..." -ForegroundColor Cyan
Write-Host ""

# Function to start service in new window
function Start-Service {
    param(
        [string]$ServiceName,
        [int]$Port,
        [string]$Directory,
        [string]$Command,
        [string]$Title
    )
    
    Write-Host "$ServiceName. Starting $Title (Port $Port)..." -ForegroundColor Yellow
    
    $fullPath = Join-Path $PROJECT_ROOT $Directory
    
    # Start in new command prompt window
    Start-Process cmd -ArgumentList "/k", "cd /d `"$fullPath`" && $Command" -WindowStyle Normal -WorkingDirectory $fullPath
    
    # Wait a moment before starting next service
    Start-Sleep -Seconds 2
}

# Start MCP Server
Start-Service "1" $MCP_PORT "services\mcp-server" "echo MCP Server starting on port $MCP_PORT && (if not exist venv python -m venv venv) && (if not exist .env if exist .env.example copy .env.example .env) && venv\Scripts\activate && pip install -r requirements.txt && python main.py" "MCP Server"

# Start SQL Backend  
Start-Service "2" $SQL_PORT "services\sql-backend" "echo SQL Backend starting on port $SQL_PORT && (if not exist node_modules npm install) && (if not exist .env (echo PORT=$SQL_PORT > .env && echo DB_HOST=localhost >> .env && echo DB_PORT=5432 >> .env && echo DB_NAME=mcp_test_framework >> .env && echo DB_USER=postgres >> .env && echo DB_PASSWORD=password >> .env)) && npm start" "MCP SQL Backend"

# Start AI Service
Start-Service "3" $AI_PORT "services\ai-service" "echo AI Service starting on port $AI_PORT && (if not exist node_modules npm install) && npm start" "MCP AI Service"

# Start React Frontend
Start-Service "4" $REACT_PORT "services\react-frontend" "echo React Frontend starting on port $REACT_PORT && (if not exist node_modules npm install) && npm start" "MCP React Frontend"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " All services are starting!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Service URLs:" -ForegroundColor Cyan
Write-Host "  • MCP Server API:     http://localhost:$MCP_PORT" -ForegroundColor White
Write-Host "  • SQL Backend API:    http://localhost:$SQL_PORT" -ForegroundColor White
Write-Host "  • AI Service API:     http://localhost:$AI_PORT" -ForegroundColor White
Write-Host "  • React Frontend:     http://localhost:$REACT_PORT" -ForegroundColor White
Write-Host ""

Write-Host "Note:" -ForegroundColor Yellow
Write-Host "  • Each service will open in its own terminal window" -ForegroundColor Gray
Write-Host "  • Wait for all services to fully start before testing" -ForegroundColor Gray
Write-Host "  • MCP Server (Python) may take 15-30 seconds to start" -ForegroundColor Gray
Write-Host "  • React Frontend may take 30-60 seconds to compile" -ForegroundColor Gray
Write-Host "  • Press Ctrl+C in any terminal to stop that service" -ForegroundColor Gray
Write-Host ""

Write-Host "Health Check URLs:" -ForegroundColor Cyan
Write-Host "  • MCP Server:   http://localhost:$MCP_PORT/api/v1/health" -ForegroundColor White
Write-Host "  • SQL Backend:  http://localhost:$SQL_PORT/health" -ForegroundColor White
Write-Host "  • AI Service:   http://localhost:$AI_PORT/health" -ForegroundColor White
Write-Host "  • React App:    http://localhost:$REACT_PORT" -ForegroundColor White
Write-Host ""

Write-Host "✓ Startup complete! Services are running in separate windows." -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"