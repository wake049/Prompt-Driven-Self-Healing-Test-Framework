# Test Execution Setup

This document explains how to set up and use the test execution functionality.

## Database Setup

1. **Run the execution schema setup:**
   ```bash
   # From the unified-api directory
   cd services/unified-api
   
   # Connect to your PostgreSQL database and run:
   psql -d your_database -f execution_schema.sql
   ```

2. **Verify tables were created:**
   ```sql
   -- Check that the exec schema and tables exist
   \dt exec.*
   ```

## API Endpoints

### Execute a Prompt
```http
POST /api/v1/execution/execute-prompt/{prompt_id}
```

**Response:**
```json
{
  "success": true,
  "execution_id": "uuid",
  "message": "Test execution started",
  "steps_count": 5,
  "prompt_text": "Navigate to login page and sign in"
}
```

### Get Execution Status
```http
GET /api/v1/execution/execution/{execution_id}
```

**Response:**
```json
{
  "execution_id": "uuid",
  "prompt_id": "uuid", 
  "status": "running",
  "started_at": "2025-10-23T15:30:00Z",
  "total_steps": 5,
  "results": {
    "summary": {
      "successRate": 100.0,
      "totalSteps": 5,
      "passedSteps": 5,
      "failedSteps": 0
    }
  }
}
```

### Get Recent Executions
```http
GET /api/v1/execution/executions?limit=10
```

## Frontend Integration

The test execution is integrated into the PromptDetailView component:

1. **Run Button**: Click the "Run" button on any prompt with generated steps
2. **Status Updates**: The button shows execution status (Running..., Executing...)
3. **Notifications**: Alerts show execution results and errors

## Java Runner Integration

The system automatically:

1. **Creates temporary step files** for each execution
2. **Calls the Java runner** with custom steps file
3. **Parses execution results** from Java output files
4. **Updates database** with execution status and results
5. **Cleans up** temporary files

## Requirements

- **PostgreSQL database** with planner and exec schemas
- **Java 11+** and Maven for the Java runner
- **Chrome browser** for Selenium execution
- **Unified API** running on port 8000

## Troubleshooting

### Common Issues:

1. **"No steps found for this prompt"**
   - Generate steps first using the "Generate Steps" button

2. **"Java execution failed"**
   - Check that Java and Maven are installed
   - Verify Chrome browser is available
   - Check Java runner logs in console

3. **Database connection errors**
   - Verify PostgreSQL is running
   - Check database connection in unified API
   - Ensure execution tables are created

4. **Execution timeout**
   - Default timeout is 10 minutes
   - Check if Java process is hanging
   - Verify test steps are not stuck on modal dialogs

### Debug Steps:

1. **Check API logs:**
   ```bash
   # In unified-api directory
   python main.py
   ```

2. **Test Java runner manually:**
   ```bash
   # In java-runner directory
   mvn exec:java -Dexec.mainClass=demo.Main
   ```

3. **Check database:**
   ```sql
   -- View recent executions
   SELECT * FROM exec.test_runs ORDER BY started_at DESC LIMIT 10;
   
   -- View step results
   SELECT * FROM exec.step_results WHERE test_run_id = 'your-execution-id';
   ```

## Next Steps

- [ ] Add real-time WebSocket updates for execution progress
- [ ] Implement execution cancellation
- [ ] Add detailed step-by-step execution logs in UI
- [ ] Support for parallel test execution
- [ ] Integration with CI/CD pipelines