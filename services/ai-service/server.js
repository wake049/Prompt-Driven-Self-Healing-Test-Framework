const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const config = require('./src/config/config');
const { errorHandler, notFoundHandler, requestLogger, securityHeaders, timeoutHandler } = require('./src/middleware/errorHandler');
const { validateSecurityHeaders, validateRequestSize } = require('./src/middleware/validation');
const aiController = require('./src/controllers/aiController');

const app = express();

// Trust proxy if configured
if (config.security.trustProxy) {
  app.set('trust proxy', 1);
}

// Request timeout
app.use(timeoutHandler(config.openai.timeout));

// Security headers
app.use(securityHeaders);
app.use(helmet(config.security.helmetOptions));

// Request logging
app.use(requestLogger);

// Request size validation
app.use(validateRequestSize);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: 'Too many requests',
    details: 'Rate limit exceeded, please try again later',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.url === '/health' // Skip rate limiting for health checks
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow Chrome extension origins and localhost for development
    if (!origin || 
        origin.startsWith('chrome-extension://') || 
        (config.server.env === 'development' && origin.includes('localhost'))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'User-Agent']
}));

// Body parsing
app.use(express.json({ limit: config.validation.maxPayloadSize }));
app.use(express.urlencoded({ extended: true, limit: config.validation.maxPayloadSize }));

// Security headers validation
app.use(validateSecurityHeaders);

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Service API',
      version: '1.0.0',
      description: 'AI-powered element suggestion service for MCP Test Framework',
      contact: {
        name: 'MCP Team',
        email: 'support@mcp-framework.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}`,
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        DOMElement: {
          type: 'object',
          properties: {
            tag: { type: 'string', example: 'input' },
            id: { type: 'string', example: 'username' },
            classes: { type: 'array', items: { type: 'string' }, example: ['form-control'] },
            attributes: { type: 'object', example: { type: 'text', name: 'username' } },
            xpath: { type: 'string', example: '//*[@id="username"]' },
            isVisible: { type: 'boolean', example: true },
            isInteractive: { type: 'boolean', example: true }
          }
        },
        ElementSuggestion: {
          type: 'object',
          properties: {
            elementId: { type: 'string', example: 'auth_username_123' },
            name: { type: 'string', example: 'Username Input' },
            description: { type: 'string', example: 'Input field for username authentication' },
            xpath: { type: 'string', example: '//*[@id="username"]' },
            locator: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                css: { type: 'string' },
                xpath: { type: 'string' }
              }
            },
            category: { type: 'string', enum: ['authentication', 'navigation', 'form', 'action', 'general'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            usageExamples: { type: 'array', items: { type: 'string' } }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            details: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  apis: ['./src/controllers/*.js', './server.js']
};

const specs = swaggerJsdoc(swaggerOptions);

// Swagger UI setup
app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customSiteTitle: 'AI Service API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true
  }
}));

// Swagger JSON endpoint
app.get('/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the current status of the AI service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   type: string
 *                   example: ai-service
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 environment:
 *                   type: string
 *                   example: development
 *                 features:
 *                   type: object
 *                   properties:
 *                     openai:
 *                       type: boolean
 *                       example: true
 *                     heuristic:
 *                       type: boolean
 *                       example: true
 */
// Basic health check (no rate limiting)
app.get('/health', (req, res) => {
  res.json({
    service: 'ai-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.server.env,
    features: {
      openai: config.openai.enabled && !!config.openai.apiKey,
      heuristic: true
    }
  });
});

// API routes
app.use('/api/ai', aiController);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ AI Service stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ AI Service stopped');
    process.exit(0);
  });
});

// Start server
const PORT = config.server.port;
const HOST = config.server.host;

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 AI Service running on http://${HOST}:${PORT}`);
  console.log(`📝 Environment: ${config.server.env}`);
  console.log(`🤖 OpenAI enabled: ${config.openai.enabled && !!config.openai.apiKey}`);
  console.log(`🛡️ Security features enabled`);
  console.log(`⚡ Heuristic fallback available`);
});