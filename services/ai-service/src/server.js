const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const aiController = require('./controllers/aiController');
const { errorHandler, notFoundHandler, timeoutHandler, requestLogger, securityHeaders } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet());
app.use(securityHeaders);

// Request timeout handler (18 seconds to allow for AI processing)
app.use(timeoutHandler(18000));

// Request logging
app.use(requestLogger);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many AI requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow Chrome extension origins and localhost for development
    if (!origin || 
        origin.startsWith('chrome-extension://') || 
        origin.startsWith('http://localhost') || 
        origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      console.warn('⚠️ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'ai-service',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    models: {
      primary: process.env.OPENAI_MODEL || 'gpt-4o',
      fallback: 'heuristic-based'
    }
  });
});

// Temporary debug route to see what's being sent to /suggest-elements
app.post('/suggest-elements', (req, res) => {
  console.log('🔍 DEBUG: Direct /suggest-elements called');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Headers:', req.headers);
  
  res.status(400).json({
    success: false,
    error: 'Wrong endpoint',
    message: 'Use /api/ai/suggest-elements instead',
    receivedData: {
      bodyKeys: Object.keys(req.body || {}),
      hasBody: !!req.body,
      contentType: req.get('Content-Type')
    }
  });
});

// API routes
app.use('/api/ai', aiController);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🤖 AI Service running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🌟 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🧠 Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}`);
});

module.exports = app;