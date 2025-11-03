# MCP-Only React Frontend

This React frontend has been completely converted to use MCP (Model Context Protocol) instead of REST APIs. **No fallback modes are available** - the frontend requires an active MCP server connection to function.

## ⚠️ Requirements

**MCP Server Required**: This frontend cannot function without an active MCP server connection. All functionality is provided through proper MCP protocol communication via WebSocket.

## Architecture Changes

### Before (v0.2.0)
- REST API clients (axios-based)
- Direct HTTP calls to unified API server
- Fallback error handling
- Multiple API service files

### After (v2.0.0)
- Single MCP WebSocket client
- JSON-RPC 2.0 protocol communication
- No fallback modes - MCP required
- Unified MCP service layer

## Key Components

### MCP Infrastructure
- **MCPFrontendClient**: WebSocket-based MCP client
- **MCPProvider**: React context for MCP connection management
- **useMCP hooks**: React hooks for MCP operations
- **MCPStatus**: Connection status indicators

### Replaced Services
- ✅ `executionApiService` → MCP-based execution operations
- ✅ `sqlApiClient` → MCP-based data operations  
- 🔄 `unifiedApiClient` → In progress
- 🔄 `promptsApiService` → In progress

## Quick Start

### 1. Start MCP Server (Required)
```bash
cd services/mcp-server
python main.py --ws  # Start MCP server with WebSocket transport on port 8765
```

### 2. Start Frontend
```bash
cd services/react-frontend
npm install
npm run dev  # Starts on port 3000
```

### 3. Verify MCP Connection
- Frontend will show connection status on startup
- Look for "🔌 Connecting to MCP Server" loading screen
- Green "✅ MCP Connected" status indicates success
- Red "❌ MCP Server Connection Required" means MCP server is not running

## MCP Protocol Usage

### Tools Available via MCP
- `run_action` - Execute UI actions
- `verify.section` - Run verification checks  
- `context.put/get/expectEqual` - Context management
- `elements.add/get` - Element repository operations
- `fetch_test_data` - Data retrieval operations
- `bulk_generate_locators` - AI-powered locator generation

### Resources Available via MCP
- `elements://repository/list` - Element repository
- `executions://test/list` - Execution history
- `stats://repository/summary` - Repository statistics
- `stats://healing/summary` - Healing analytics
- `summaries://execution/{id}` - LLM summaries

### Example Usage

```typescript
import { useMCPQuery, useMCPTool } from '../hooks/useMCP';

// Fetch data via MCP resources
const { data: elements, loading } = useMCPQuery(
  (client) => client.readResource('elements://repository/list?limit=100')
);

// Call MCP tools
const { mutate: runAction } = useMCPTool('run_action');
await runAction({
  action_type: 'click',
  element_name: 'login-button',
  context: { page: 'login' }
});
```

## Connection Management

The frontend automatically:
- Connects to MCP server on startup
- Shows loading screen during connection
- Displays error screen if connection fails
- Attempts automatic reconnection on disconnect
- Disables all functionality without MCP connection

## Development

### Adding New MCP Operations
1. Add method to `MCPFrontendClient`
2. Use `useMCPQuery` or `useMCPTool` hooks in components
3. Handle loading/error states appropriately

### Error Handling
All MCP operations should handle:
- Connection failures (no fallback)
- MCP tool errors
- Network timeouts
- Invalid responses

### Testing MCP Integration
1. Start MCP server: `cd services/mcp-server && python main.py --ws`
2. Verify WebSocket connection on ws://localhost:8765
3. Test tool calls and resource access
4. Verify frontend behavior when MCP server is stopped

## Troubleshooting

### Frontend Won't Start
- Ensure MCP server is running on ws://localhost:8765
- Check browser console for WebSocket connection errors
- Verify no firewall blocking WebSocket connections

### "MCP Server Connection Required" Error
- Start MCP server: `cd services/mcp-server && python main.py --ws`
- Check MCP server logs for errors
- Ensure port 8765 is not in use by other services

### Component Not Loading Data
- Check MCP connection status indicator
- Verify tool/resource names match MCP server implementation
- Check browser network tab for WebSocket messages

## Migration Notes

### For Developers
- Replace all REST API calls with MCP equivalents
- Update error handling (no fallback modes)
- Use MCP hooks instead of direct API calls
- Add MCP connection requirements to component documentation

### Breaking Changes from v0.2.0
- No REST API support
- Requires active MCP server
- Different error handling patterns
- New hook-based architecture