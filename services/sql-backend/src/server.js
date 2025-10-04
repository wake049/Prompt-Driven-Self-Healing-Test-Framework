const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const sessionsRouter = require('./routes/sessions');
const elementsRouter = require('./routes/elements');
const executionsRouter = require('./routes/executions');
const aiSuggestionsRouter = require('./routes/ai-suggestions');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/elements', elementsRouter);
app.use('/api/executions', executionsRouter);
app.use('/api/ai-suggestions', aiSuggestionsRouter);

// Chrome Extension specific endpoints
app.post('/api/chrome/record-element', async (req, res) => {
  try {
    const { elementData, sessionInfo } = req.body;
    
    // Create session if needed
    let sessionId = sessionInfo?.session_id;
    if (!sessionId && sessionInfo) {
      const sessionResult = await require('./database').query(`
        INSERT INTO test_sessions (name, page, description)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [
        sessionInfo.name || `Session for ${elementData.page}`,
        elementData.page,
        'Created from Chrome Extension'
      ]);
      sessionId = sessionResult.rows[0].id;
    }
    
    // Record the element
    const result = await require('./database').query(`
      INSERT INTO recorded_elements (
        session_id, element_id, tag, text_content, attributes, 
        xpath, css_selector, position_x, position_y, selectors, page
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      sessionId,
      elementData.id,
      elementData.tag,
      elementData.text,
      JSON.stringify(elementData.attributes || {}),
      elementData.xpath,
      elementData.cssSelector,
      elementData.position?.x || 0,
      elementData.position?.y || 0,
      JSON.stringify(elementData.selectors || []),
      elementData.page
    ]);
    
    res.status(201).json({ 
      success: true, 
      data: result.rows[0],
      session_id: sessionId
    });
  } catch (error) {
    console.error('Error recording element from Chrome Extension:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/chrome/record-execution', async (req, res) => {
  try {
    const { executionData, sessionId } = req.body;
    
    const result = await require('./database').query(`
      INSERT INTO test_executions (
        session_id, tool_name, parameters, result_success, 
        result_data, result_error, result_logs, execution_time_ms, page
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      sessionId,
      executionData.toolName,
      JSON.stringify(executionData.parameters || {}),
      executionData.result?.success,
      executionData.result?.data ? JSON.stringify(executionData.result.data) : null,
      executionData.result?.error,
      JSON.stringify(executionData.result?.logs || []),
      executionData.executionTime,
      executionData.page
    ]);
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error recording execution from Chrome Extension:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all data for Chrome Extension
app.get('/api/chrome/all-data', async (req, res) => {
  try {
    const { query } = require('./database');
    
    // Get recent sessions with elements and executions
    const sessionsResult = await query(`
      SELECT DISTINCT ts.*, 
        COUNT(DISTINCT re.id) as element_count,
        COUNT(DISTINCT te.id) as execution_count
      FROM test_sessions ts
      LEFT JOIN recorded_elements re ON ts.id = re.session_id AND re.is_active = true
      LEFT JOIN test_executions te ON ts.id = te.session_id
      GROUP BY ts.id
      ORDER BY ts.updated_at DESC
      LIMIT 10
    `);
    
    const sessions = [];
    
    for (const session of sessionsResult.rows) {
      // Get elements for this session
      const elementsResult = await query(
        'SELECT * FROM recorded_elements WHERE session_id = $1 AND is_active = true ORDER BY timestamp_recorded',
        [session.id]
      );
      
      // Get executions for this session
      const executionsResult = await query(
        'SELECT * FROM test_executions WHERE session_id = $1 ORDER BY executed_at',
        [session.id]
      );
      
      sessions.push({
        ...session,
        elements: elementsResult.rows,
        executions: executionsResult.rows
      });
    }
    
    res.json({ success: true, data: { sessions } });
  } catch (error) {
    console.error('Error fetching all data for Chrome Extension:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MCP SQL Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API base URL: http://localhost:${PORT}/api`);
});

module.exports = app;