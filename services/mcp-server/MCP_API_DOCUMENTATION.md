# MCP Server API Documentation

## Overview

The Self-Healing Test Framework MCP (Model Context Protocol) Server provides a comprehensive API for executing automated tests with intelligent self-healing capabilities. The server includes built-in schema validation, error handling, and analytics logging.

## Server Information

- **Host**: `localhost:8000`
- **Protocol**: HTTP/JSON-RPC (MCP compliant)
- **Schema Validation**: JSON Schema Draft-7
- **Error Handling**: Standardized error codes and messages
- **Authentication**: Bearer token (configurable)

## Tool Registry

The server provides 4 core tools across multiple categories:

### 📋 Tool Categories

| Category | Tool Count | Description |
|----------|------------|-------------|
| **Execution** | 1 | Test action execution with self-healing |
| **Element Repository** | 2 | Element locator management and AI generation |
| **Analytics** | 1 | Performance metrics and logging |
| **Policy** | 0 | Compliance and governance (future) |
| **Workflow** | 0 | Test orchestration (future) |
| **Testing** | 0 | Test validation tools (future) |

## API Endpoints

### 1. Tool Execution
```
POST /tools/{tool_name}
```

Execute a registered tool with schema validation.

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "parameters": {
    // Tool-specific parameters (validated against schema)
  }
}
```

**Response:**
```json
{
  "result": {
    // Tool-specific response (validated against schema)
  },
  "execution_time_ms": 1250,
  "timestamp": "2025-09-29T10:30:00Z"
}
```

### 2. Tool Discovery
```
GET /tools
GET /tools?category=execution
```

List available tools and their metadata.

**Response:**
```json
{
  "tools": [
    {
      "name": "run_action",
      "description": "Execute a single test action with self-healing capabilities",
      "category": "execution",
      "version": "1.0.0",
      "timeout_ms": 45000,
      "requires_auth": true,
      "parameters": {
        "action_type": {
          "type": "str",
          "required": true
        },
        "element_name": {
          "type": "str", 
          "required": true
        }
      },
      "tags": ["execution", "testing", "core"]
    }
  ]
}
```

### 3. Tool Information
```
GET /tools/{tool_name}
```

Get detailed information about a specific tool.

**Response:**
```json
{
  "name": "run_action",
  "description": "Execute a single test action with self-healing capabilities",
  "category": "execution",
  "version": "1.0.0",
  "timeout_ms": 45000,
  "requires_auth": true,
  "parameters": {
    "action_type": {
      "type": "str",
      "default": null,
      "required": true
    },
    "element_name": {
      "type": "str",
      "default": null, 
      "required": true
    },
    "parameters": {
      "type": "dict",
      "default": "None",
      "required": false
    },
    "context": {
      "type": "dict",
      "default": "None",
      "required": false
    }
  },
  "input_schema": null,
  "output_schema": null,
  "dependencies": [],
  "tags": ["execution", "testing", "core"],
  "registered_at": "2025-09-29T10:30:00Z"
}
```

### 4. Registry Statistics
```
GET /registry/stats
```

Get tool registry statistics.

**Response:**
```json
{
  "total_tools": 4,
  "categories": {
    "execution": 1,
    "element_repository": 2,
    "policy": 0,
    "analytics": 1,
    "workflow": 0,
    "testing": 0
  },
  "initialized": true
}
```

### 5. Tool Search
```
GET /tools/search?q=login
```

Search tools by name, description, or tags.

**Response:**
```json
{
  "matches": ["run_action", "get_element"],
  "query": "login",
  "total_results": 2
}
```

## Core Tools

### 🎯 run_action

Execute test actions with automatic self-healing when elements change.

**Purpose**: Primary execution engine for automated tests
**Timeout**: 45 seconds
**Category**: Execution

**Key Features**:
- ✅ 21 supported action types (click, type, assert, wait, etc.)
- ✅ Intelligent selector healing with confidence scoring
- ✅ Screenshot capture on failures
- ✅ Element information extraction
- ✅ Retry logic with exponential backoff

**Example Usage**:
```bash
curl -X POST http://localhost:8000/tools/run_action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "parameters": {
      "action_type": "click_css",
      "element_name": "login_button",
      "parameters": {
        "timeout_ms": 5000,
        "retry_count": 3
      },
      "context": {
        "session_id": "sess_123",
        "test_run_id": "run_456"
      }
    }
  }'
```

### 🔍 get_element

Retrieve element locators from the repository with validation options.

**Purpose**: Element locator management and validation
**Timeout**: 5 seconds  
**Category**: Element Repository

**Key Features**:
- ✅ Primary and alternative selector retrieval
- ✅ Real-time element presence validation
- ✅ Usage statistics and success rates
- ✅ Creation and update metadata
- ✅ Confidence scoring for selector reliability

**Example Usage**:
```bash
curl -X POST http://localhost:8000/tools/get_element \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "parameters": {
      "element_name": "login_button",
      "options": {
        "include_alternatives": true,
        "validate_presence": true
      }
    }
  }'
```

### 🤖 bulk_generate_locators

AI-powered bulk generation of element locators from page analysis.

**Purpose**: Automated locator discovery using AI
**Timeout**: 60 seconds
**Category**: Element Repository

**Key Features**:
- ✅ Multi-element analysis in single request
- ✅ AI reasoning for selector confidence
- ✅ Alternative selector generation
- ✅ Semantic analysis and accessibility info
- ✅ Quality metrics and maintainability scores

**Example Usage**:
```bash
curl -X POST http://localhost:8000/tools/bulk_generate_locators \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "parameters": {
      "element_names": ["login_button", "username_field"],
      "page_context": {
        "url": "https://example.com/login",
        "html_content": "<html>...</html>",
        "page_title": "Login Page"
      },
      "generation_options": {
        "confidence_threshold": 0.8,
        "include_alternatives": true
      }
    }
  }'
```

### 📊 analytics_log

Record execution metrics, performance data, and compliance information.

**Purpose**: Analytics and performance monitoring
**Timeout**: 2 seconds
**Category**: Analytics  

**Key Features**:
- ✅ 7 event types (action_executed, healing_applied, etc.)
- ✅ Performance metrics with execution timing
- ✅ GDPR/CCPA compliance tracking
- ✅ Data retention and archival policies
- ✅ Real-time aggregation status

**Example Usage**:
```bash
curl -X POST http://localhost:8000/tools/analytics_log \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "parameters": {
      "event_type": "action_executed",
      "metrics": {
        "execution_time_ms": 1250,
        "success_rate": 0.95,
        "retry_count": 1
      },
      "context": {
        "run_id": "550e8400-e29b-41d4-a716-446655440000",
        "environment": "development"
      }
    }
  }'
```

## Schema Validation

All tool requests and responses are validated against JSON Schema Draft-7 specifications.

### Validation Process

1. **Input Validation**: Request parameters validated before execution
2. **Type Checking**: Data types verified (string, number, boolean, object, array)
3. **Required Fields**: Missing parameters trigger validation errors
4. **Enum Validation**: Enumerated values checked against allowed options
5. **Pattern Matching**: String patterns validated (UUIDs, URLs, etc.)
6. **Output Validation**: Response format validated (warnings only)

### Validation Example

**Valid Request**:
```json
{
  "parameters": {
    "action_type": "click_css",
    "element_name": "login_button"
  }
}
```

**Invalid Request**:
```json
{
  "parameters": {
    "action_type": "invalid_action",  // ❌ Not in allowed enum
    "element_name": 123               // ❌ Should be string
  }
}
```

**Error Response**:
```json
{
  "error": {
    "code": "INVALID_ENUM_VALUE",
    "message": "Validation failed for action_type: 'invalid_action' is not one of ['click_css', 'click_xpath', ...]",
    "timestamp": "2025-09-29T10:30:00Z",
    "details": {
      "field": "action_type",
      "provided_value": "invalid_action",
      "allowed_values": ["click_css", "type_css", "assert_element_visible", "..."]
    }
  }
}
```

## Error Handling

### Error Categories

| Category | Code Range | Description |
|----------|------------|-------------|
| **Validation** | 4000-4099 | Parameter validation failures |
| **Authentication** | 4100-4199 | Authentication and authorization |
| **Tool Execution** | 5000-5099 | Tool execution failures |
| **Service** | 5100-5199 | Service and infrastructure errors |
| **Timeout** | 5200-5299 | Timeout and performance issues |

### Common Error Codes

| Code | Name | Description |
|------|------|-------------|
| `4001` | `INVALID_PARAMETER_TYPE` | Parameter has wrong data type |
| `4002` | `MISSING_REQUIRED_PARAMETER` | Required parameter not provided |
| `4003` | `INVALID_PARAMETER_VALUE` | Parameter value outside allowed range |
| `4004` | `INVALID_ENUM_VALUE` | Enum parameter has invalid value |
| `4101` | `MISSING_AUTH_HEADER` | Authorization header missing |
| `4102` | `INVALID_AUTH_TOKEN` | Invalid or expired token |
| `5001` | `TOOL_NOT_FOUND` | Tool name not registered |
| `5002` | `TOOL_EXECUTION_FAILED` | Tool execution failed |
| `5201` | `TOOL_EXECUTION_TIMEOUT` | Tool exceeded timeout limit |

### Error Response Format

```json
{
  "error": {
    "code": "TOOL_EXECUTION_TIMEOUT",
    "message": "Tool 'run_action' timed out after 45000ms",
    "timestamp": "2025-09-29T10:30:00Z",
    "request_id": "req_123456789",
    "details": {
      "tool_name": "run_action",
      "timeout_ms": 45000,
      "operation": "tool_execution_run_action"
    },
    "help_url": "https://docs.example.com/errors/5201"
  }
}
```

## Authentication

The server supports Bearer token authentication:

```bash
# Set token in environment
export MCP_AUTH_TOKEN="your_secret_token"

# Use in requests
curl -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
     http://localhost:8000/tools
```

## Development

### Running the Server

```bash
# Start development server
cd services/mcp-server
python app.py

# Run with custom port
python app.py --port 8080

# Run with debug logging
python app.py --debug
```

### Testing

```bash
# Run all tests
python -m pytest tests/ -v

# Run schema validation tests
python -m pytest tests/test_schema_validation.py -v

# Run integration tests
python test_integration_tools.py

# Test specific tool
python -c "
import asyncio
from tool_registry import ToolRegistry

async def test():
    registry = ToolRegistry()
    await registry.initialize()
    result = await registry.call_tool('run_action', 
                                    action_type='click_css',
                                    element_name='test_button')
    print(result)

asyncio.run(test())
"
```

### Schema Development

```bash
# Validate all schemas
python -c "
import json
from jsonschema import Draft7Validator

for schema_file in ['run_action.json', 'get_element.json', 
                   'bulk_generate_locators.json', 'analytics_log.json']:
    with open(f'schemas/{schema_file}') as f:
        schema = json.load(f)
    Draft7Validator.check_schema(schema)
    print(f'✓ {schema_file} is valid')
"

# Test schema against sample data
python -c "
from schema_validator import validate_tool_request
error = validate_tool_request('run_action', {
    'action_type': 'click_css',
    'element_name': 'test_button'
})
print('Valid!' if not error else f'Error: {error.message}')
"
```

## Monitoring

The server provides built-in monitoring capabilities:

### Health Check
```bash
curl http://localhost:8000/health
```

### Metrics Endpoint
```bash
curl http://localhost:8000/metrics
```

### Registry Statistics
```bash
curl http://localhost:8000/registry/stats
```

## Future Enhancements

### Planned Tools

| Tool | Category | Description |
|------|----------|-------------|
| `validate_accessibility` | Policy | WCAG compliance checking |
| `execute_workflow` | Workflow | Multi-step test orchestration |
| `generate_test_data` | Testing | AI-powered test data generation |
| `visual_regression` | Testing | Screenshot comparison testing |
| `performance_audit` | Analytics | Page performance analysis |

### Planned Features

- ✨ **Plugin System**: Custom tool registration
- ✨ **Async Execution**: Long-running test workflows  
- ✨ **Event Streaming**: Real-time execution updates
- ✨ **Advanced Analytics**: ML-powered insights
- ✨ **Multi-Browser Support**: Cross-browser execution
- ✨ **Cloud Integration**: Remote execution environments

## Support

- **Documentation**: `/docs` endpoint (Swagger UI)
- **Schema Files**: `schemas/` directory
- **Test Examples**: `tests/` directory
- **Integration Guide**: `test_integration_tools.py`

---

**MCP Server Version**: 1.0.0  
**Last Updated**: September 29, 2025  
**Schema Validation**: ✅ Complete  
**Error Handling**: ✅ Comprehensive  
**Documentation**: ✅ Current