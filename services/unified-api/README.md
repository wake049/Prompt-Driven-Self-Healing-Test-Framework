# Unified MCP API Server

A consolidated FastAPI application that combines all MCP self-healing test framework services into a single deployment.

## Overview

This unified API server consolidates the following previously separate services:
- **Policy Engine** (formerly mcp-server): Governance and decision layer for prompt-driven self-healing
- **AI Service** (formerly ai-service): Element suggestions and test step generation using OpenAI
- **Healing API** (formerly healing-api): Collection of healing data from Java framework
- **SQL Backend** (formerly sql-backend): Database operations for test sessions, elements, and review queue

## Architecture

```
unified-api/
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Python dependencies
├── start.bat/.sh          # Startup scripts
├── api/                   # API route modules
│   ├── policy_engine.py   # Policy management endpoints
│   ├── ai_service.py      # AI-powered suggestions
│   ├── healing_api.py     # Healing data collection
│   ├── sql_backend.py     # Database operations
│   └── health.py          # Health check endpoints
├── core/                  # Core utilities
│   ├── database.py        # Unified database manager
│   └── __init__.py
├── models/                # Data models
│   ├── policy.py          # Policy engine models
│   └── __init__.py
├── services/              # Business logic services
│   └── __init__.py
└── schemas/               # API schemas
    └── __init__.py
```

## Quick Start

### Prerequisites
- Python 3.8+
- PostgreSQL database
- OpenAI API key (optional, for AI features)

### Environment Variables

Create a `.env` file or set these environment variables:

```bash
# Server Configuration
HOST=0.0.0.0
PORT=8000
RELOAD=true

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mcp_test_framework
DB_USER=postgres
DB_PASSWORD=password

# AI Service Configuration (optional)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=1500
```

### Installation & Startup

#### Windows
```cmd
# Navigate to unified-api directory
cd services\unified-api

# Install dependencies and start server
start.bat
```

#### Linux/macOS
```bash
# Navigate to unified-api directory
cd services/unified-api

# Make script executable and start server
chmod +x start.sh
./start.sh
```

#### Manual Installation
```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### Health Check
- `GET /health` - Overall service health
- `GET /health/detailed` - Detailed health with system info
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe

### Policy Engine (`/api/v1/policy`)
- `GET /policies` - List all policies
- `POST /policies` - Create new policy
- `GET /policies/{id}` - Get specific policy
- `PUT /policies/{id}` - Update policy
- `DELETE /policies/{id}` - Delete policy
- `POST /evaluate` - Evaluate policies for context
- `GET /stats` - Policy engine statistics
- `GET /dashboard/stats` - Dashboard statistics (no auth)
- `GET /dashboard/policies` - Dashboard policies (no auth)

### AI Service (`/api/v1/ai`)
- `POST /suggest-elements` - Generate element suggestions from DOM
- `POST /generate-steps` - Generate test steps from natural language
- `POST /validate-structure` - Validate DOM structure
- `GET /models` - Get available AI models

### Healing API (`/api/v1/healing`)
- `POST /submit` - Submit healing data from Java framework
- `GET /stats` - Healing data statistics
- `GET /data` - Retrieve healing data with filtering

### SQL Backend (`/api/v1/sql`)
- `POST /record-element` - Record element from Chrome extension
- `POST /record-execution` - Record test execution
- `GET /all-data` - Get all sessions with elements/executions
- `GET /review-queue` - Get review queue items
- `GET /review/pending` - Get pending reviews (frontend compatible)
- `PATCH /review/{id}` - Update review status
- `POST /healing/submit` - Submit healing data

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Database Integration

The unified API uses a centralized database manager with connection pooling:

```python
from core.database import get_database

async def my_endpoint():
    db = await get_database()
    result = await db.execute("SELECT * FROM policies")
    return result
```

### Connection Pool Configuration
- Default min connections: 5
- Default max connections: 20
- Command timeout: 60 seconds
- Configurable via environment variables

## Frontend Integration

The React frontend can use the new unified API client:

```typescript
import unifiedApiClient from '../shared/utils/unifiedApiClient';

// Policy operations
const policies = await unifiedApiClient.getPolicies();
const stats = await unifiedApiClient.getPolicyStats();

// AI operations
const suggestions = await unifiedApiClient.suggestElements(domData);
const testPlan = await unifiedApiClient.generateTestSteps(prompt);

// Healing operations
await unifiedApiClient.submitHealingData(healingAttempts);

// SQL operations
await unifiedApiClient.recordElement(elementData);
const reviews = await unifiedApiClient.getPendingReviews();
```

### Migration from Multiple APIs

The frontend includes backward compatibility. Update your environment variables:

```bash
# Old (multiple services)
VITE_MCP_API_URL=http://localhost:8001/api/v1/policy
VITE_AI_API_URL=http://localhost:3000/api/ai
VITE_SQL_API_URL=http://localhost:3001/api

# New (unified API)
VITE_UNIFIED_API_URL=http://localhost:8000/api/v1
```

## Service Dependencies

### Required Services
- PostgreSQL database for data persistence
- Network access for frontend communication

### Optional Services
- OpenAI API for enhanced AI features (fallback to heuristic methods)
- External monitoring tools (health endpoints available)

## Deployment

### Docker Support (Future)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Production Configuration
- Set `RELOAD=false` for production
- Configure proper database connection pooling
- Use environment-specific configuration files
- Set up proper logging and monitoring

## Benefits of Unified API

### Simplified Deployment
- Single service to deploy instead of 4 separate services
- Unified configuration and environment management
- Centralized logging and monitoring

### Performance Improvements
- Shared database connection pool
- Reduced network overhead between services
- Optimized resource usage

### Development Experience
- Single codebase for all API functionality
- Consistent error handling and middleware
- Unified API documentation

### Operational Benefits
- Simplified service discovery
- Reduced infrastructure complexity
- Easier health monitoring and alerting

## Migration Guide

### From Separate Services

1. **Stop individual services**:
   ```bash
   # Stop all separate API services
   pkill -f "mcp-server"
   pkill -f "ai-service"
   pkill -f "healing-api"
   pkill -f "sql-backend"
   ```

2. **Update frontend configuration**:
   ```bash
   # Update .env file
   VITE_UNIFIED_API_URL=http://localhost:8000/api/v1
   ```

3. **Start unified API**:
   ```bash
   cd services/unified-api
   ./start.sh  # or start.bat on Windows
   ```

4. **Verify health**:
   ```bash
   curl http://localhost:8000/health
   ```

### Database Migration
No database changes required - the unified API uses the same database schema as the individual services.

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify database credentials in environment variables
   - Ensure database `mcp_test_framework` exists

2. **Import Errors**
   - Ensure all dependencies installed: `pip install -r requirements.txt`
   - Check Python version compatibility (3.8+)

3. **Frontend API Errors**
   - Verify `VITE_UNIFIED_API_URL` environment variable
   - Check CORS configuration if accessing from different domain
   - Confirm unified API is running: `curl http://localhost:8000/health`

4. **AI Service Errors**
   - OpenAI API key may be invalid or missing
   - Service will fall back to heuristic methods automatically
   - Check AI model availability: `GET /api/v1/ai/models`

### Health Monitoring

```bash
# Basic health check
curl http://localhost:8000/health

# Detailed health with system info
curl http://localhost:8000/health/detailed

# Service-specific health
curl http://localhost:8000/api/v1/policy/health
curl http://localhost:8000/api/v1/ai/health
curl http://localhost:8000/api/v1/healing/health
curl http://localhost:8000/api/v1/sql/health
```

### Logs

The unified API provides structured logging:
- Request/response logging for all endpoints
- Database connection status
- Service health checks
- Error tracking with stack traces

## Support

For issues and questions:
1. Check the API documentation at `/docs`
2. Review health endpoint status
3. Check application logs for specific error messages
4. Verify environment configuration