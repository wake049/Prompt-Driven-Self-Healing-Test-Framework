#!/bin/bash

# MCP Test Framework - Start All Services
# Compatible with macOS and Linux

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

echo -e "${BLUE}========================================"
echo -e " MCP Test Framework - Starting All Services"
echo -e "========================================${NC}"
echo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    if command_exists lsof; then
        lsof -ti:"$1" >/dev/null 2>&1
    elif command_exists netstat; then
        netstat -ln | grep ":$1 " >/dev/null 2>&1
    else
        echo -e "${YELLOW}Warning: Cannot check if port $1 is in use (lsof/netstat not found)${NC}"
        return 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0
    
    echo -e "${YELLOW}Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ $service_name is ready${NC}"
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 2
        echo -ne "${YELLOW}  Attempt $attempt/$max_attempts...${NC}\r"
    done
    
    echo -e "${RED}✗ $service_name failed to start within timeout${NC}"
    return 1
}

echo -e "${BLUE}Starting MCP Test Framework Services...${NC}"
echo

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command_exists node; then
    echo -e "${RED}Error: Node.js is not installed or not in PATH${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

if ! command_exists python3; then
    echo -e "${RED}Error: Python 3 is not installed or not in PATH${NC}"
    echo "Please install Python 3 from https://python.org/"
    exit 1
fi

if ! command_exists curl; then
    echo -e "${YELLOW}Warning: curl not found - health checks will be skipped${NC}"
fi

echo -e "${GREEN}✓ Node.js detected: $(node --version)${NC}"
echo -e "${GREEN}✓ Python detected: $(python3 --version)${NC}"
echo

# Port configuration
MCP_PORT=8001
SQL_PORT=8002
REACT_PORT=3000
AI_PORT=3002

# Check if ports are in use
echo -e "${YELLOW}Checking ports...${NC}"

if port_in_use $MCP_PORT; then
    echo -e "${RED}Warning: Port $MCP_PORT (MCP Server) is already in use${NC}"
fi

if port_in_use $SQL_PORT; then
    echo -e "${RED}Warning: Port $SQL_PORT (SQL Backend) is already in use${NC}"
fi

if port_in_use $REACT_PORT; then
    echo -e "${RED}Warning: Port $REACT_PORT (React Frontend) is already in use${NC}"
fi

if port_in_use $AI_PORT; then
    echo -e "${RED}Warning: Port $AI_PORT (AI Service) is already in use${NC}"
fi

echo

# Function to start service in background
start_service() {
    local service_name=$1
    local port=$2
    local directory=$3
    local start_command=$4
    local log_file="$PROJECT_ROOT/logs/${service_name}.log"
    
    echo -e "${YELLOW}Starting $service_name (Port $port)...${NC}"
    
    # Create logs directory if it doesn't exist
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Change to service directory
    cd "$directory"
    
    # Start service in background and redirect output to log file
    nohup bash -c "$start_command" > "$log_file" 2>&1 &
    local pid=$!
    
    # Store PID for later cleanup
    echo $pid > "$PROJECT_ROOT/logs/${service_name}.pid"
    
    echo -e "${GREEN}✓ $service_name started with PID $pid${NC}"
    echo -e "${BLUE}  Log file: $log_file${NC}"
    
    # Wait a moment for service to initialize
    sleep 2
}

echo -e "${BLUE}Starting services...${NC}"
echo

# 1. Start MCP Server (Python)
start_service "mcp-server" $MCP_PORT "$PROJECT_ROOT/services/mcp-server" "
    if [ ! -d 'venv' ]; then
        echo 'Creating Python virtual environment...'
        python3 -m venv venv
    fi
    
    if [ ! -f '.env' ] && [ -f '.env.example' ]; then
        echo 'Copying .env.example to .env...'
        cp .env.example .env
    fi
    
    source venv/bin/activate
    pip install -r requirements.txt
    python main.py
"

# 2. Start SQL Backend (Node.js)
start_service "sql-backend" $SQL_PORT "$PROJECT_ROOT/services/sql-backend" "
    if [ ! -d 'node_modules' ]; then
        echo 'Installing dependencies for SQL Backend...'
        npm install
    fi
    
    # Create .env file with updated port
    if [ ! -f '.env' ]; then
        cat > .env << EOF
PORT=8002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mcp_test_framework
DB_USER=postgres
DB_PASSWORD=password
EOF
    fi
    
    npm start
"

# 3. Start AI Service (Node.js)
start_service "ai-service" $AI_PORT "$PROJECT_ROOT/services/ai-service" "
    if [ ! -d 'node_modules' ]; then
        echo 'Installing dependencies for AI Service...'
        npm install
    fi
    
    npm start
"

# 4. Start React Frontend (Node.js)
start_service "react-frontend" $REACT_PORT "$PROJECT_ROOT/services/react-frontend" "
    if [ ! -d 'node_modules' ]; then
        echo 'Installing dependencies for React Frontend...'
        npm install
    fi
    
    npm start
"

echo
echo -e "${GREEN}========================================"
echo -e " All services are starting!"
echo -e "========================================${NC}"
echo

echo -e "${BLUE}Service URLs:${NC}"
echo -e "  • MCP Server API:     http://localhost:$MCP_PORT"
echo -e "  • SQL Backend API:    http://localhost:$SQL_PORT"
echo -e "  • AI Service API:     http://localhost:$AI_PORT"
echo -e "  • React Frontend:     http://localhost:$REACT_PORT"
echo

echo -e "${YELLOW}Note:${NC}"
echo -e "  • Services are running in the background"
echo -e "  • Logs are available in the ./logs/ directory"
echo -e "  • MCP Server (Python) may take 15-30 seconds to start"
echo -e "  • React Frontend may take 30-60 seconds to compile"
echo -e "  • Use './stop-all-services.sh' to stop all services"
echo

# Wait for services to be ready (if curl is available)
if command_exists curl; then
    echo -e "${BLUE}Performing health checks...${NC}"
    
    # Wait for MCP Server
    if wait_for_service "http://localhost:$MCP_PORT/api/v1/health" "MCP Server"; then
        echo -e "${GREEN}✓ MCP Server is healthy${NC}"
    fi
    
    # Wait for SQL Backend
    if wait_for_service "http://localhost:$SQL_PORT/health" "SQL Backend"; then
        echo -e "${GREEN}✓ SQL Backend is healthy${NC}"
    fi
    
    # Wait for AI Service
    if wait_for_service "http://localhost:$AI_PORT/health" "AI Service"; then
        echo -e "${GREEN}✓ AI Service is healthy${NC}"
    fi
    
    # React Frontend check (just check if port is responding)
    if wait_for_service "http://localhost:$REACT_PORT" "React Frontend"; then
        echo -e "${GREEN}✓ React Frontend is healthy${NC}"
    fi
    
    echo
fi

echo -e "${BLUE}Health Check URLs:${NC}"
echo -e "  • MCP Server:   http://localhost:$MCP_PORT/api/v1/health"
echo -e "  • SQL Backend:  http://localhost:$SQL_PORT/health"
echo -e "  • AI Service:   http://localhost:$AI_PORT/health"
echo -e "  • React App:    http://localhost:$REACT_PORT"
echo

echo -e "${GREEN}✓ Startup complete! All services are running.${NC}"
echo -e "${PURPLE}Access the React Frontend at: http://localhost:$REACT_PORT${NC}"
echo

# Return to original directory
cd "$PROJECT_ROOT"