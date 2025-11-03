# MCP Server Scripts

This directory contains demo clients and testing scripts for the MCP server.

## Scripts Overview

### 🚀 Server Startup
- **`start_server.py`** - Easy server startup with different transport options
  ```bash
  python scripts/start_server.py --transport stdio
  python scripts/start_server.py --transport websocket --port 8765
  python scripts/start_server.py --transport dual  # Both transports
  ```

### 🧪 Demo Clients
- **`mcp_client_demo.py`** - Full stdio client demo showing complete flow
- **`mcp_websocket_demo.py`** - WebSocket client with concurrent testing
- **`test_mcp_tools.py`** - Comprehensive tool testing suite

## Quick Start

1. **Start the server:**
   ```bash
   python scripts/start_server.py
   ```

2. **Run the stdio demo (in another terminal):**
   ```bash
   python scripts/mcp_client_demo.py
   ```

3. **Test all tools:**
   ```bash
   python scripts/test_mcp_tools.py
   ```

## Demo Flows

### Stdio Client Demo
Shows the complete MCP flow:
1. `elements.get` → Retrieve element data
2. `run_action` → Execute action on element  
3. `verify.section` → Verify page state
4. Resource operations
5. Error scenarios
6. Performance testing

### WebSocket Client Demo
Demonstrates:
- WebSocket transport connection
- Concurrent request handling
- Context operations
- Adaptive actions

### Tool Testing Suite
Tests all 9 MCP tools:
- `elements.get` / `elements.find`
- `run_action`  
- `verify.section` / `verify.outcome`
- `context.get` / `context.set` / `context.update`
- `actions.adaptive`

## Authentication

All demos use the default token `devtoken`. For production:
```bash
export MCP_AUTH_TOKEN=your-production-token
python scripts/mcp_client_demo.py --token your-production-token
```

## Server Configuration

The server automatically detects if the unified API is running at `localhost:8000`. 
If not detected, it will return mock data for demonstration purposes.

To start the unified API:
```bash
cd services/unified-api
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## Error Testing

Test error scenarios:
```bash
python scripts/mcp_client_demo.py --test-errors
python scripts/test_mcp_tools.py --edge-cases
```

## Performance Testing

Test caching and performance:
```bash
python scripts/mcp_client_demo.py --test-performance
```

## WebSocket Concurrent Testing

Test concurrent request handling:
```bash
python scripts/mcp_websocket_demo.py --concurrent
```