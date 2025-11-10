# MCP Server - Render Deployment

This MCP server is configured for deployment on Render.com

## Deployment URL
Your MCP server will be available at: `https://mcp-server-[random].onrender.com`

## Environment Variables
Set these in your Render dashboard:

### Required (Database)
- `DB_HOST`: Your database host
- `DB_PORT`: Database port (usually 5432 for PostgreSQL)
- `DB_NAME`: Database name
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password

### Optional (Pre-configured)
- `MCP_HOST`: 0.0.0.0 (already set)
- `MCP_PORT`: 8001 (already set)
- `MCP_AUTH_REQUIRED`: false (already set)
- `MCP_DEBUG`: false (already set)
- `ENVIRONMENT`: production (already set)
- `DATABASE_OPTIONAL`: true (already set)

## Health Check Endpoints
- `/health` - Basic health check (used by Render)
- `/mcp/health` - Detailed MCP-specific health check
- `/ready` - Readiness check

## WebSocket Endpoints
- `/mcp/ws` - Main MCP WebSocket endpoint
- `/ws` - Alternative WebSocket endpoint

## Deployment Steps
1. Push your code to GitHub
2. Connect your GitHub repo to Render
3. Render will automatically detect the `render.yaml` file
4. Set environment variables in Render dashboard
5. Deploy!

## Auto-Deploy
Auto-deploy is enabled for the `M8` branch. Any push to this branch will trigger a new deployment.