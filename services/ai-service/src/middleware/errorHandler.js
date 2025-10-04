const config = require('../config/config');

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('🚨 Error occurred:', {
    message: err.message,
    stack: config.server.env === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // OpenAI specific errors
  if (err.name === 'OpenAIError' || err.message.includes('OpenAI')) {
    return res.status(503).json({
      success: false,
      error: 'AI service temporarily unavailable',
      details: config.server.env === 'development' ? err.message : 'Please try again later',
      fallback: 'Heuristic analysis available',
      timestamp: new Date().toISOString()
    });
  }

  // Rate limit errors
  if (err.message.includes('rate limit') || err.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      details: 'Too many requests, please slow down',
      retryAfter: Math.ceil((err.resetTime - Date.now()) / 1000) || 60,
      timestamp: new Date().toISOString()
    });
  }

  // Validation errors
  if (err.name === 'ValidationError' || err.status === 400) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }

  // Authentication errors
  if (err.status === 401 || err.message.includes('API key')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      details: 'Invalid or missing API credentials',
      timestamp: new Date().toISOString()
    });
  }

  // Default server error
  res.status(err.status || 500).json({
    success: false,
    error: 'Internal server error',
    details: config.server.env === 'development' ? err.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown'
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    details: `${req.method} ${req.url} is not available`,
    availableEndpoints: [
      'POST /api/ai/suggest-elements',
      'POST /api/ai/validate-structure',
      'GET /api/ai/models',
      'GET /api/ai/health',
      'GET /health'
    ],
    timestamp: new Date().toISOString()
  });
};

// Request timeout handler
const timeoutHandler = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: 'Request timeout',
          details: `Request took longer than ${timeout}ms to complete`,
          timestamp: new Date().toISOString()
        });
      }
    }, timeout);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  if (!config.logging.enableRequestLogging) {
    return next();
  }

  const start = Date.now();
  const originalSend = res.json;

  // Override res.json to capture response
  res.json = function(data) {
    const duration = Date.now() - start;
    
    console.log(`📊 ${req.method} ${req.url}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
      contentLength: req.headers['content-length'] || '0',
      timestamp: new Date().toISOString()
    });

    return originalSend.call(this, data);
  };

  next();
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CORS headers for Chrome extension
  if (req.headers.origin && req.headers.origin.startsWith('chrome-extension://')) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  next();
};

module.exports = {
  errorHandler,
  notFoundHandler,
  timeoutHandler,
  requestLogger,
  securityHeaders
};