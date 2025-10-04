# AI Service

A dedicated OpenAI-powered service for MCP-compliant element suggestions in the Self-Healing Test Framework.

## Features

- **OpenAI GPT-4o Integration**: Primary AI analysis using OpenAI's latest model
- **Heuristic Fallback**: Rule-based element detection when AI is unavailable
- **MCP Privacy Compliance**: Only processes structural DOM metadata, no private content
- **Security Hardened**: Rate limiting, CORS, security headers, input validation
- **Error Resilience**: Graceful degradation and comprehensive error handling

## Quick Start

### Prerequisites

- Node.js 18+ 
- OpenAI API key (optional - heuristic fallback available)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
copy .env.example .env

# Edit .env with your OpenAI API key (optional)
# OPENAI_API_KEY=your_api_key_here
```

### Running the Service

```bash
# Start in production mode
npm start

# Start in development mode with auto-reload
npm run dev
```

The service will start on `http://localhost:3002`

## API Endpoints

### `POST /api/ai/suggest-elements`

Analyze MCP-compliant DOM structure and return element suggestions.

**Request:**
```json
{
  "domData": {
    "title": "Login Page",
    "url": "https://example.com/login",
    "elements": [
      {
        "tag": "input",
        "id": "username",
        "classes": ["form-control"],
        "attributes": { "type": "text", "name": "username" },
        "xpath": "//*[@id='username']",
        "isVisible": true,
        "isInteractive": true
      }
    ]
  },
  "options": {
    "maxSuggestions": 10,
    "includeCategories": ["authentication", "form", "action"],
    "confidenceThreshold": 0.7,
    "useHeuristicFallback": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "suggestions": [
    {
      "elementId": "auth_username_123",
      "name": "Username Input",
      "description": "Input field for username authentication",
      "xpath": "//*[@id='username']",
      "locator": {
        "id": "username",
        "css": "#username",
        "xpath": "//*[@id='username']"
      },
      "category": "authentication",
      "priority": "high",
      "confidence": 0.9,
      "attributes": {
        "tag": "input",
        "isVisible": true,
        "isInteractive": true
      },
      "usageExamples": ["Enter username", "Type email address"]
    }
  ],
  "metadata": {
    "pageTitle": "Login Page",
    "pageUrl": "https://example.com/login",
    "analysisTimestamp": "2024-01-01T12:00:00.000Z",
    "totalSuggestions": 1,
    "method": "ai",
    "model": "gpt-4o",
    "processingTimeMs": 1234
  }
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "service": "ai-service",
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "development",
  "features": {
    "openai": true,
    "heuristic": true
  }
}
```

### `GET /api/ai/models`

Get available AI models and their status.

### `POST /api/ai/validate-structure`

Validate DOM structure without generating suggestions.

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Server Configuration
PORT=3002
HOST=localhost
NODE_ENV=development

# OpenAI Configuration
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=1500
OPENAI_TIMEOUT=30000
OPENAI_MAX_RETRIES=3
OPENAI_ENABLED=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Security
CORS_ORIGIN=chrome-extension://*
CORS_CREDENTIALS=true
TRUST_PROXY=false

# Validation
MAX_ELEMENTS_PER_REQUEST=1000
MAX_PAYLOAD_SIZE=10mb

# Logging
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
```

## MCP Privacy Compliance

This service is designed for Model Context Protocol (MCP) compliance:

- **No Private Data**: Only processes structural DOM metadata (tags, IDs, classes, XPaths)
- **No Content Extraction**: Never sends text content, values, or business logic to LLMs
- **Metadata Only**: Analysis based purely on element structure and attributes
- **Privacy by Design**: Architected to prevent accidental data leakage

### What Gets Sent to AI:
✅ Element tags (`input`, `button`, `div`)  
✅ Element IDs and classes  
✅ Attributes like `type`, `name`  
✅ XPath selectors  
✅ Visibility and interaction state  

### What Never Gets Sent:
❌ Text content or values  
❌ Form data or user input  
❌ Business logic or sensitive information  
❌ Personal or company data  

## Analysis Methods

### OpenAI Analysis (Primary)

- Uses GPT-4o for intelligent element categorization
- Considers user interaction patterns and common automation needs
- Provides confidence scores and detailed descriptions
- Returns structured suggestions with multiple locator strategies

### Heuristic Analysis (Fallback)

- Rule-based pattern matching for common element types
- Authentication form detection (login, password, submit buttons)
- Form field identification
- Navigation and action element recognition
- Always available, no external dependencies

## Integration

### Chrome Extension

The service integrates with the Chrome extension through the background script:

```typescript
// Background script calls AI service
const response = await fetch('http://localhost:3002/api/ai/suggest-elements', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ domData, options })
});
```

### Content Script

The content script extracts MCP-compliant DOM structure:

```typescript
// Extract only structural metadata
const domData = {
  title: document.title,
  url: window.location.href,
  elements: elements.map(el => ({
    tag: el.tagName.toLowerCase(),
    id: el.id,
    classes: Array.from(el.classList),
    attributes: getStructuralAttributes(el), // No values
    xpath: getXPath(el),
    isVisible: isVisible(el),
    isInteractive: isInteractive(el)
  }))
};
```

## Error Handling

The service includes comprehensive error handling:

- **OpenAI Errors**: Automatic fallback to heuristic analysis
- **Rate Limiting**: HTTP 429 with retry information
- **Validation Errors**: Detailed field-level error messages
- **Network Issues**: Graceful degradation and timeout handling
- **Authentication**: Clear API key validation errors

## Development

### Project Structure

```
services/ai-service/
├── server.js              # Main server entry point
├── package.json           # Dependencies and scripts  
├── .env.example           # Environment template
├── src/
│   ├── config/
│   │   └── config.js      # Configuration management
│   ├── controllers/
│   │   └── aiController.js # API endpoints
│   ├── services/
│   │   └── aiService.js   # Core AI logic
│   └── middleware/
│       ├── errorHandler.js # Error handling
│       └── validation.js  # Input validation
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

### Development Mode

```bash
# Start with auto-reload
npm run dev

# Enable debug logging
LOG_LEVEL=debug npm run dev
```

## Monitoring

The service provides comprehensive logging:

- Request/response logging with timing
- OpenAI API call monitoring
- Error tracking with stack traces
- Health check metrics
- Rate limiting statistics

Check logs for:
- `🤖 AI analysis request for page: ...`
- `✨ Generated N element suggestions (method: ai/heuristic)`
- `⚠️ AI analysis failed, falling back to heuristics`
- `🛡️ Security features enabled`

## Performance

- **Response Time**: Typically 1-3 seconds with OpenAI, <100ms with heuristics
- **Rate Limits**: 100 requests per 15 minutes per IP
- **Payload Limits**: 10MB maximum request size, 1000 elements max
- **Memory**: Stateless design, minimal memory footprint
- **Scalability**: Horizontally scalable, no shared state

## Troubleshooting

### Common Issues

**AI service not responding:**
- Check if service is running on port 3002
- Verify CORS configuration for Chrome extension
- Check OpenAI API key configuration

**Low-quality suggestions:**
- Reduce `confidenceThreshold` in options
- Include more categories in `includeCategories`
- Check if page has sufficient interactive elements

**Rate limiting:**
- Reduce request frequency
- Check `RATE_LIMIT_MAX_REQUESTS` configuration
- Monitor rate limit headers in responses

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug NODE_ENV=development npm start
```

This will show:
- Detailed request/response data
- OpenAI API interaction logs
- Heuristic analysis decision points
- Security validation steps