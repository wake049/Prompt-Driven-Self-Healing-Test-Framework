#!/bin/bash

# MCP Test Framework - Stop All Services
# Compatible with macOS and Linux

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

echo -e "${BLUE}========================================"
echo -e " MCP Test Framework - Stopping All Services"
echo -e "========================================${NC}"
echo

# Function to stop service by PID file
stop_service() {
    local service_name=$1
    local pid_file="$PROJECT_ROOT/logs/${service_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${YELLOW}Stopping $service_name (PID: $pid)...${NC}"
            
            # Try graceful shutdown first
            if kill -TERM "$pid" 2>/dev/null; then
                # Wait up to 10 seconds for graceful shutdown
                local count=0
                while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
                    sleep 1
                    count=$((count + 1))
                done
                
                # Force kill if still running
                if kill -0 "$pid" 2>/dev/null; then
                    echo -e "${YELLOW}  Force killing $service_name...${NC}"
                    kill -KILL "$pid" 2>/dev/null || true
                fi
            fi
            
            echo -e "${GREEN}✓ $service_name stopped${NC}"
        else
            echo -e "${YELLOW}$service_name was not running${NC}"
        fi
        
        # Remove PID file
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}No PID file found for $service_name${NC}"
    fi
}

# Function to kill processes by port
kill_by_port() {
    local port=$1
    local service_name=$2
    
    if command -v lsof >/dev/null 2>&1; then
        local pids=$(lsof -ti:"$port" 2>/dev/null || true)
        
        if [ -n "$pids" ]; then
            echo -e "${YELLOW}Killing processes on port $port ($service_name)...${NC}"
            for pid in $pids; do
                kill -TERM "$pid" 2>/dev/null || true
                sleep 1
                kill -KILL "$pid" 2>/dev/null || true
            done
            echo -e "${GREEN}✓ Processes on port $port killed${NC}"
        fi
    fi
}

echo -e "${BLUE}Stopping services...${NC}"
echo

# Stop services by PID files first
stop_service "mcp-server"
stop_service "sql-backend"
stop_service "ai-service"
stop_service "react-frontend"

echo
echo -e "${BLUE}Killing any remaining processes by port...${NC}"

# Kill any remaining processes by port as backup
kill_by_port 8001 "MCP Server"
kill_by_port 8002 "SQL Backend"
kill_by_port 3002 "AI Service"
kill_by_port 3000 "React Frontend"

echo
echo -e "${BLUE}Cleaning up...${NC}"

# Clean up logs directory
if [ -d "$PROJECT_ROOT/logs" ]; then
    echo -e "${YELLOW}Archiving logs...${NC}"
    
    # Create timestamp for log archive
    timestamp=$(date +"%Y%m%d_%H%M%S")
    archive_dir="$PROJECT_ROOT/logs/archive"
    mkdir -p "$archive_dir"
    
    # Move current logs to archive
    if ls "$PROJECT_ROOT/logs"/*.log >/dev/null 2>&1; then
        for log_file in "$PROJECT_ROOT/logs"/*.log; do
            if [ -f "$log_file" ]; then
                base_name=$(basename "$log_file" .log)
                mv "$log_file" "$archive_dir/${base_name}_${timestamp}.log"
            fi
        done
        echo -e "${GREEN}✓ Logs archived to logs/archive/${NC}"
    fi
    
    # Remove any remaining PID files
    rm -f "$PROJECT_ROOT/logs"/*.pid
fi

echo
echo -e "${GREEN}========================================"
echo -e " All services stopped successfully!"
echo -e "========================================${NC}"
echo

echo -e "${BLUE}Service Status:${NC}"
echo -e "  • MCP Server (8001):     ${GREEN}Stopped${NC}"
echo -e "  • SQL Backend (8002):    ${GREEN}Stopped${NC}"
echo -e "  • AI Service (3002):     ${GREEN}Stopped${NC}"
echo -e "  • React Frontend (3000): ${GREEN}Stopped${NC}"
echo

echo -e "${YELLOW}Note:${NC}"
echo -e "  • All background processes have been terminated"
echo -e "  • Log files have been archived in logs/archive/"
echo -e "  • You can restart services with './start-all-services.sh'"
echo