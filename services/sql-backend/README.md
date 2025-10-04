# MCP SQL Backend

A PostgreSQL-based backend service for the MCP Test Framework that stores recorded UI elements, test sessions, and execution results.

## Features

- **PostgreSQL Database**: Robust relational database storage
- **RESTful API**: Complete CRUD operations for all entities
- **Chrome Extension Integration**: Specialized endpoints for Chrome extension data sync
- **React Frontend Support**: Optimized endpoints for frontend data consumption
- **Transaction Support**: Reliable data consistency
- **Bulk Operations**: Efficient batch data processing

## Database Schema

### Tables

1. **test_sessions**: Test session metadata
2. **recorded_elements**: UI elements recorded by Chrome extension
3. **test_executions**: Results of test tool executions

### Key Features
- UUID primary keys for better security
- JSONB fields for flexible attribute storage
- Automatic timestamp tracking
- Soft deletes for recorded elements
- Foreign key relationships with cascade deletes

## Setup Instructions

### 1. Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Database created with user privileges

### 2. Environment Configuration

Copy `.env` file and update with your PostgreSQL credentials:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=testframework_db
DB_USER=testframework
DB_PASSWORD=securepassword
PORT=3001
```

### 3. Install Dependencies

```bash
cd services/sql-backend
npm install
```

### 4. Initialize Database

```bash
npm run init-db
```

This will:
- Create all required tables
- Set up indexes for performance
- Insert sample data
- Verify the setup

### 5. Start the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Test Sessions
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/:id` - Get session with elements and executions
- `POST /api/sessions` - Create new session
- `PUT /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session

### Recorded Elements
- `GET /api/elements` - List elements (with filtering)
- `GET /api/elements/:id` - Get single element
- `POST /api/elements` - Create new element
- `POST /api/elements/bulk` - Bulk create elements
- `PUT /api/elements/:id` - Update element
- `DELETE /api/elements/:id` - Soft delete element

### Test Executions
- `GET /api/executions` - List executions (with filtering)
- `GET /api/executions/:id` - Get single execution
- `POST /api/executions` - Create new execution
- `PUT /api/executions/:id` - Update execution
- `DELETE /api/executions/:id` - Delete execution
- `GET /api/executions/stats/summary` - Execution statistics

### Chrome Extension Endpoints
- `POST /api/chrome/record-element` - Record element from extension
- `POST /api/chrome/record-execution` - Record execution from extension
- `GET /api/chrome/all-data` - Get all data for extension sync

## Usage Examples

### Recording an Element
```javascript
POST /api/chrome/record-element
{
  "elementData": {
    "id": "login-button",
    "tag": "button",
    "text": "Login",
    "attributes": {"class": "btn btn-primary"},
    "xpath": "//button[@id='login-btn']",
    "cssSelector": "#login-btn",
    "position": {"x": 100, "y": 200},
    "selectors": ["#login-btn", ".btn.btn-primary"],
    "page": "https://example.com/login"
  },
  "sessionInfo": {
    "name": "Login Test Session",
    "page": "https://example.com/login"
  }
}
```

### Recording a Test Execution
```javascript
POST /api/chrome/record-execution
{
  "executionData": {
    "toolName": "run_action",
    "parameters": {"action": "click", "target": "#login-btn"},
    "result": {
      "success": true,
      "data": {"clicked": true},
      "logs": ["Element found", "Click executed"]
    },
    "executionTime": 250,
    "page": "https://example.com/login"
  },
  "sessionId": "uuid-session-id"
}
```

## Integration Points

### Chrome Extension
The Chrome extension uses these endpoints:
- Record elements as they're captured
- Sync recorded data to database
- Store execution results

### React Frontend
The React frontend uses these endpoints:
- Load test sessions and elements
- Display execution history
- Manage test data

## Development

### Database Migrations
Future schema changes should be handled through migration scripts in the `/migrations` directory.

### Monitoring
- Check `/health` endpoint for server status
- Monitor PostgreSQL connection pool
- Review execution statistics at `/api/executions/stats/summary`

### Security
- Rate limiting enabled (1000 req/15min per IP)
- CORS configured for frontend origin
- Helmet security headers
- SQL injection protection via parameterized queries