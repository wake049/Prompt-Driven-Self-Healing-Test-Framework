const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3002,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development'
  },

  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1500,
    timeout: parseInt(process.env.OPENAI_TIMEOUT) || 15000, // Reduced to 15 seconds
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES) || 3,
    enabled: process.env.OPENAI_ENABLED !== 'false'
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // CORS configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'chrome-extension://*',
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },

  // Security settings
  security: {
    trustProxy: process.env.TRUST_PROXY === 'true',
    helmetOptions: {
      contentSecurityPolicy: process.env.NODE_ENV === 'development' ? false : undefined
    }
  },

  // Validation settings
  validation: {
    maxElementsPerRequest: parseInt(process.env.MAX_ELEMENTS_PER_REQUEST) || 1000,
    maxPayloadSize: process.env.MAX_PAYLOAD_SIZE || '10mb'
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false'
  }
};

// Validate critical configuration
function validateConfig() {
  const errors = [];

  if (!config.openai.apiKey && config.openai.enabled) {
    console.warn('⚠️ OpenAI API key not configured - AI features will use heuristic fallback');
  }

  if (config.server.port < 1024 || config.server.port > 65535) {
    errors.push('Invalid port number');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
  }
}

// Initialize configuration
try {
  validateConfig();
  console.log(`🔧 Configuration loaded for ${config.server.env} environment`);
  
  if (config.openai.enabled && config.openai.apiKey) {
    console.log(`🤖 OpenAI integration enabled (model: ${config.openai.model})`);
  } else {
    console.log('🎯 Running in heuristic-only mode');
  }
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
}

module.exports = config;