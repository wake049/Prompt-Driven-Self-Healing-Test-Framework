# MCP Server

Model Context Protocol (MCP) Server for the Test Automation Platform

## Overview

The MCP Server provides a standardized interface for all platform operations through the Model Context Protocol. It serves as the central orchestration point for tools, resources, and services within the test automation ecosystem.

## Features

- **Tool Registry**: Dynamic registration and discovery of MCP tools
- **Authentication**: Token-based authentication with configurable security
- **Health Monitoring**: Comprehensive health checks and metrics
- **Performance**: Optimized for high-throughput with timeout management
- **Extensibility**: Plugin architecture for custom tool development

## Quick Start

### Installation

```bash
cd services/mcp-server
pip install -r requirements.txt
```

### Configuration

Create a `.env` file or set environment variables:

```bash
# Server Configuration
MCP_HOST=0.0.0.0
MCP_PORT=8001
MCP_LOG_LEVEL=INFO

# Authentication
MCP_AUTH_REQUIRED=false
MCP_AUTH_TOKEN=your-secret-token

# Timeouts (milliseconds)
MCP_TOOL_CALL_TIMEOUT=30000
MCP_CONNECTION_TIMEOUT=5000
MCP_REQUEST_TIMEOUT=10000

# Performance
MCP_MAX_CONCURRENT_TOOLS=100
MCP_RATE_LIMIT_PER_MINUTE=1000

# Service URLs
MCP_ELEMENT_REPOSITORY_URL=http://localhost:8002
MCP_POLICY_ENGINE_URL=http://localhost:8003
MCP_EXECUTION_SERVICE_URL=http://localhost:8004
```

### Running the Server

```bash
# Development mode
python -m main

# Production mode with Uvicorn
uvicorn main:create_app --host 0.0.0.0 --port 8001
```

## API Endpoints

### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Basic health check |
| `/api/v1/health/detailed` | GET | Comprehensive status |
| `/api/v1/health/live` | GET | Kubernetes liveness probe |
| `/api/v1/health/ready` | GET | Kubernetes readiness probe |
| `/api/v1/health/metrics` | GET | Prometheus-style metrics |

### Version Information

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/version` | GET | Basic version info |
| `/api/v1/version/detailed` | GET | Complete build information |
| `/api/v1/version/compatibility` | GET | Protocol compatibility |

### Tool Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/tools` | GET | List all tools |
| `/api/v1/tools/{name}` | GET | Get tool details |
| `/api/v1/tools/search` | POST | Search tools |
| `/api/v1/tools/call` | POST | Execute a tool |
| `/api/v1/tools/categories` | GET | List categories |

## Core Tools

The server comes with built-in tools for common operations:

### Execution Tools

- **`run_action`**: Execute test actions with self-healing
- **`fetch_test_data`**: Retrieve test data from various sources

### Element Repository Tools

- **`get_element`**: Retrieve element locators
- **`save_element`**: Store new element locators
- **`bulk_generate_locators`**: AI-powered locator generation
- **`heal_element`**: Update failed locators

### Analytics Tools

- **`analytics_log`**: Record execution metrics
- **`detect_outcome`**: Classify test results

## Tool Development

### Creating Custom Tools

```python
from tool_registry import ToolRegistry, ToolMetadata, ToolCategory

async def my_custom_tool(param1: str, param2: int) -> dict:
    """Custom tool implementation"""
    return {"result": f"Processed {param1} with {param2}"}

# Register the tool
registry = ToolRegistry()
registry.register_tool(
    name="my_custom_tool",
    func=my_custom_tool,
    metadata=ToolMetadata(
        name="my_custom_tool",
        description="Example custom tool",
        category=ToolCategory.TESTING,
        timeout_ms=10000,
        tags=["custom", "example"]
    )
)
```

### Tool Metadata Schema

```python
{
    "name": "tool_name",
    "description": "Tool description",
    "category": "execution|element_repository|policy|analytics|workflow|testing",
    "version": "1.0.0",
    "timeout_ms": 30000,
    "requires_auth": true,
    "input_schema": {...},
    "output_schema": {...},
    "dependencies": ["other_tool"],
    "tags": ["tag1", "tag2"]
}
```

## Configuration Reference

### Server Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_HOST` | `0.0.0.0` | Server bind address |
| `MCP_PORT` | `8001` | Server port |
| `MCP_LOG_LEVEL` | `INFO` | Logging level |
| `MCP_DEBUG` | `false` | Debug mode |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_AUTH_REQUIRED` | `false` | Enable authentication |
| `MCP_AUTH_TOKEN` | `None` | API token |
| `MCP_TOKEN_EXPIRY_HOURS` | `24` | Token expiry time |

### Performance

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TOOL_CALL_TIMEOUT` | `30000` | Tool timeout (ms) |
| `MCP_MAX_CONCURRENT_TOOLS` | `100` | Max concurrent calls |
| `MCP_RATE_LIMIT_PER_MINUTE` | `1000` | Rate limit per client |

### Service Discovery

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_ELEMENT_REPOSITORY_URL` | `http://localhost:8002` | Element repo URL |
| `MCP_POLICY_ENGINE_URL` | `http://localhost:8003` | Policy engine URL |
| `MCP_EXECUTION_SERVICE_URL` | `http://localhost:8004` | Execution service URL |

## Monitoring & Observability

### Health Checks

The server provides multiple health check endpoints for different monitoring needs:

- **Basic Health**: Simple up/down status
- **Detailed Health**: Component status and metrics
- **Liveness Probe**: For Kubernetes liveness checks
- **Readiness Probe**: For Kubernetes readiness checks
- **Metrics**: Prometheus-compatible metrics

### Key Metrics

- `mcp_server_uptime_seconds`: Server uptime
- `mcp_server_requests_total`: Total requests handled
- `mcp_server_errors_total`: Total errors encountered
- `mcp_server_error_rate`: Current error rate
- `mcp_server_active_connections`: Active connections
- `mcp_server_tools_registered`: Number of registered tools

### Logging

The server uses structured logging with the following log levels:

- `DEBUG`: Detailed debugging information
- `INFO`: General operational messages
- `WARNING`: Warning conditions
- `ERROR`: Error conditions
- `CRITICAL`: Critical failures

## Security

### Authentication

Token-based authentication can be enabled with:

```bash
MCP_AUTH_REQUIRED=true
MCP_AUTH_TOKEN=your-secure-token
```

Include the token in requests:

```bash
curl -H "Authorization: Bearer your-secure-token" http://localhost:8001/api/v1/tools
```

### Production Deployment

For production deployment:

1. Enable authentication
2. Use HTTPS termination at load balancer
3. Set appropriate timeouts
4. Configure rate limiting
5. Enable monitoring and alerting

## Error Handling

The server returns structured error responses:

```json
{
    "status": "error",
    "error": "Error description",
    "tool_name": "failing_tool",
    "timestamp": "2025-09-29T12:00:00Z"
}
```

Common HTTP status codes:

- `200`: Success
- `400`: Bad request (tool call error)
- `404`: Tool not found
- `429`: Rate limited
- `500`: Internal server error
- `503`: Service unavailable

## Development

### Running Tests

```bash
pytest tests/ -v
```

### Code Quality

```bash
# Format code
black .
isort .

# Type checking
mypy .

# Run all checks
make lint
```

### Docker Development

```bash
# Build image
docker build -t mcp-server .

# Run container
docker run -p 8001:8001 mcp-server
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is part of the Test Automation Platform and follows the same licensing terms.