# MCP Test Framework - Service Startup Scripts

This directory contains scripts to easily start and stop all services in the MCP Test Framework.

## Services Overview

The framework consists of 4 main services:

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| **MCP Server** | 8001 | Python/FastAPI | Model Context Protocol server, main API endpoint |
| **SQL Backend** | 8002 | Node.js/Express | Database operations and element storage |
| **AI Service** | 3002 | Node.js/Express | OpenAI-powered element suggestions |
| **React Frontend** | 3000 | React/TypeScript | User interface for test management |

## Quick Start

### Windows

```batch
# Start all services
start-all-services.bat

# Stop all services  
stop-all-services.bat
```

### macOS/Linux

```bash
# Make scripts executable (first time only)
chmod +x start-all-services.sh stop-all-services.sh

# Start all services
./start-all-services.sh

# Stop all services
./stop-all-services.sh
```

## Prerequisites

### Required Software

- **Node.js 18+** - For JavaScript services
- **Python 3.8+** - For MCP server
- **PostgreSQL** (optional) - For database features

### Installation

1. **Node.js**: Download from [nodejs.org](https://nodejs.org/)
2. **Python**: Download from [python.org](https://python.org/)
3. **Git**: Download from [git-scm.com](https://git-scm.com/)

## Script Features

### Start Scripts

- ✅ **Prerequisite Checking**: Verifies Node.js and Python are installed
- ✅ **Port Conflict Detection**: Warns if ports are already in use
- ✅ **Dependency Installation**: Automatically installs npm packages and Python dependencies
- ✅ **Environment Setup**: Creates virtual environments and .env files
- ✅ **Health Monitoring**: Checks service health after startup (Unix only)
- ✅ **Logging**: Comprehensive logging for troubleshooting

### Stop Scripts

- ✅ **Graceful Shutdown**: Attempts graceful termination before force killing
- ✅ **Port Cleanup**: Ensures all ports are freed
- ✅ **Process Cleanup**: Terminates all related processes
- ✅ **Log Archiving**: Archives logs with timestamps (Unix only)

## Service Configuration

### Ports

The startup scripts automatically configure the following ports:

- **MCP Server**: 8001 (Python FastAPI)
- **SQL Backend**: 8002 (Node.js Express) 
- **AI Service**: 3002 (Node.js Express)
- **React Frontend**: 3000 (React Dev Server)

### Environment Files

Scripts automatically create `.env` files with default configurations:

#### SQL Backend (.env)
```
PORT=8002
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mcp_test_framework
DB_USER=postgres
DB_PASSWORD=password
```

#### AI Service (.env)
Copy from `.env.example` and add your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o
PORT=3002
```

#### MCP Server (.env)
Copy from `.env.example` in the mcp-server directory.

## Platform-Specific Features

### Windows (BAT files)

- **Colored output** for better readability
- **New terminal windows** for each service
- **Automatic dependency installation**
- **Port conflict warnings**
- **Service URL display**

Example output:
```
========================================
 MCP Test Framework - Starting All Services
========================================

✓ Node.js detected
✓ Python detected

Starting services in new terminal windows...

1. Starting MCP Server (Port 8001)...
2. Starting SQL Backend (Port 8002)...  
3. Starting AI Service (Port 3002)...
4. Starting React Frontend (Port 3000)...

Service URLs:
  • MCP Server API:     http://localhost:8001
  • SQL Backend API:    http://localhost:8002
  • AI Service API:     http://localhost:3002
  • React Frontend:     http://localhost:3000
```

### Unix (Shell scripts)

- **Background processes** with PID tracking
- **Health checks** with curl verification
- **Log file management** in `./logs/` directory
- **Graceful shutdown** with fallback force termination
- **Log archiving** with timestamps

Example directory structure after startup:
```
logs/
├── mcp-server.log
├── mcp-server.pid
├── sql-backend.log
├── sql-backend.pid
├── ai-service.log
├── ai-service.pid
├── react-frontend.log
├── react-frontend.pid
└── archive/
    ├── mcp-server_20241002_143022.log
    └── sql-backend_20241002_143022.log
```

## Health Check URLs

After startup, verify services are running:

- **MCP Server**: http://localhost:8001/api/v1/health
- **SQL Backend**: http://localhost:8002/health  
- **AI Service**: http://localhost:3002/health
- **React Frontend**: http://localhost:3000

Example health check response:
```json
{
  "service": "mcp-server",
  "status": "healthy",
  "timestamp": "2024-10-02T14:30:22.000Z",
  "version": "0.1.0"
}
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```
Warning: Port 8001 (MCP Server) is already in use
```
**Solution**: Stop the existing service or change the port in the service configuration.

#### Node.js Not Found
```
Error: Node.js is not installed or not in PATH
```
**Solution**: Install Node.js from [nodejs.org](https://nodejs.org/) and restart your terminal.

#### Python Not Found  
```
Error: Python 3 is not installed or not in PATH
```
**Solution**: Install Python from [python.org](https://python.org/) and ensure it's in your PATH.

#### Service Won't Start
**Check logs**:
- Windows: Look at the terminal window for the specific service
- Unix: Check `logs/[service-name].log`

**Common fixes**:
1. Delete `node_modules` and re-run startup script
2. Check if `.env` files have correct configuration
3. Ensure no other services are using the same ports
4. Restart your terminal/command prompt

#### Permission Denied (Unix)
```
./start-all-services.sh: Permission denied
```
**Solution**: Make scripts executable:
```bash
chmod +x start-all-services.sh stop-all-services.sh
```

### Manual Service Management

If you need to start services individually:

#### MCP Server (Python)
```bash
cd services/mcp-server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

#### SQL Backend (Node.js)
```bash
cd services/sql-backend
npm install
npm start
```

#### AI Service (Node.js)
```bash
cd services/ai-service
npm install
npm start
```

#### React Frontend (React)
```bash
cd services/react-frontend
npm install
npm start
```

### Log Analysis

#### Windows
Each service runs in its own terminal window. Check the terminal output for errors.

#### Unix
```bash
# View real-time logs
tail -f logs/mcp-server.log
tail -f logs/sql-backend.log
tail -f logs/ai-service.log
tail -f logs/react-frontend.log

# View all logs
cat logs/*.log

# Check archived logs
ls logs/archive/
```

## Development Mode

For development, you may want to start services individually with hot-reload:

```bash
# MCP Server (Python with auto-reload)
cd services/mcp-server
python main.py --reload

# SQL Backend (Node.js with nodemon)
cd services/sql-backend  
npm run dev

# AI Service (Node.js with nodemon)
cd services/ai-service
npm run dev

# React Frontend (already has hot-reload)
cd services/react-frontend
npm start
```

## Production Deployment

For production deployment, consider:

1. **Process Managers**: Use PM2 (Node.js) or systemd (Linux) instead of these scripts
2. **Environment Variables**: Configure production-specific .env files
3. **Database**: Set up proper PostgreSQL instance
4. **Reverse Proxy**: Use nginx or Apache for routing
5. **SSL Certificates**: Enable HTTPS for all services
6. **Monitoring**: Add application monitoring and logging

## Integration with Chrome Extension

Once all services are running, the Chrome extension can connect to:
- **MCP Server** for tool execution
- **SQL Backend** for element storage  
- **AI Service** for element suggestions

The React frontend provides a web interface to view and manage recorded elements and test data.

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify all prerequisites are installed
3. Check service logs for error messages
4. Ensure no firewall is blocking the ports
5. Try stopping all services and restarting