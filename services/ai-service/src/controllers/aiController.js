const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const { validateDOMData } = require('../middleware/validation');

// Analyze MCP-compliant DOM structure and return element suggestions
router.post('/suggest-elements', validateDOMData, async (req, res) => {
  try {
    const { domData, options = {} } = req.body;
    
    console.log(`🤖 AI analysis request for page: ${domData.title} (${domData.url})`);
    console.log('📊 AI Service received request body:', JSON.stringify({
      domData: {
        title: domData.title,
        url: domData.url,
        elementsCount: domData.elements?.length || 0,
        elements: domData.elements?.slice(0, 3).map(el => ({
          tag: el.tag,
          xpath: el.xpath,
          attributes: el.attributes
        })) // Show first 3 elements as sample
      },
      options: options // Show the actual options received
    }, null, 2));
    
    // Extract options with defaults
    const {
      maxSuggestions = 50, // Increased default to get more results
      includeCategories = ['authentication', 'navigation', 'form', 'action', 'general'],
      confidenceThreshold = 0.6,
      useHeuristicFallback = true
    } = options;

    // Call AI service for element suggestions
    const result = await aiService.generateElementSuggestions(domData, {
      maxSuggestions,
      includeCategories,
      confidenceThreshold,
      useHeuristicFallback
    });

    // Log success
    console.log(`✨ Generated ${result.suggestions.length} element suggestions (method: ${result.method})`);
    
    // Check if response has already been sent (e.g., by timeout handler)
    if (res.headersSent) {
      console.warn('⚠️ Response already sent, skipping success response');
      return;
    }
    
    res.json({
      success: true,
      suggestions: result.suggestions,
      metadata: {
        pageTitle: domData.title,
        pageUrl: domData.url,
        analysisTimestamp: new Date().toISOString(),
        totalSuggestions: result.suggestions.length,
        method: result.method,
        model: result.model,
        confidenceThreshold,
        processingTimeMs: result.processingTimeMs
      }
    });
    
  } catch (error) {
    console.error('AI suggestion analysis error:', error);
    
    // Check if response has already been sent (e.g., by timeout handler)
    if (res.headersSent) {
      console.warn('⚠️ Response already sent, skipping error response');
      return;
    }
    
    // Determine error type and status code
    let statusCode = 500;
    let errorMessage = 'Failed to analyze DOM structure';
    
    if (error.name === 'ValidationError') {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes('API key')) {
      statusCode = 401;
      errorMessage = 'AI service authentication failed';
    } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
      statusCode = 429;
      errorMessage = 'AI service rate limit exceeded';
    } else if (error.message.includes('timeout')) {
      statusCode = 408;
      errorMessage = 'Request timeout - analysis took too long';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/ai/validate-structure:
 *   post:
 *     summary: Validate DOM structure
 *     description: Validate DOM structure without generating suggestions (useful for testing)
 *     tags: [AI Analysis]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - domData
 *             properties:
 *               domData:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   url:
 *                     type: string
 *                   elements:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/DOMElement'
 *     responses:
 *       200:
 *         description: DOM structure validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 validation:
 *                   type: object
 *                   properties:
 *                     isValid:
 *                       type: boolean
 *                     elementCount:
 *                       type: integer
 *                     interactiveElements:
 *                       type: integer
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid DOM structure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// POST /api/ai/validate-structure
// Validate DOM structure without generating suggestions (for testing)
router.post('/validate-structure', validateDOMData, async (req, res) => {
  try {
    const { domData } = req.body;
    
    const validation = aiService.validateDOMStructure(domData);
    
    // Check if response has already been sent
    if (res.headersSent) {
      console.warn('⚠️ Response already sent, skipping validation response');
      return;
    }
    
    res.json({
      success: true,
      validation,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('DOM validation error:', error);
    
    // Check if response has already been sent
    if (res.headersSent) {
      console.warn('⚠️ Response already sent, skipping error response');
      return;
    }
    
    res.status(400).json({
      success: false,
      error: 'Invalid DOM structure',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/ai/models:
 *   get:
 *     summary: Get available AI models
 *     description: Get information about available AI models and their status
 *     tags: [Models]
 *     responses:
 *       200:
 *         description: Available AI models information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 models:
 *                   type: object
 *                   properties:
 *                     primary:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: gpt-4o
 *                         provider:
 *                           type: string
 *                           example: OpenAI
 *                         status:
 *                           type: string
 *                           example: available
 *                         maxTokens:
 *                           type: integer
 *                           example: 1500
 *                     fallback:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: heuristic-based
 *                         provider:
 *                           type: string
 *                           example: local
 *                         status:
 *                           type: string
 *                           example: available
 *                         description:
 *                           type: string
 *                           example: Rule-based element detection
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
// GET /api/ai/models
// Get available AI models and their status
router.get('/models', (req, res) => {
  res.json({
    success: true,
    models: {
      primary: {
        name: process.env.OPENAI_MODEL || 'gpt-4o',
        provider: 'OpenAI',
        status: 'available',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1500
      },
      fallback: {
        name: 'heuristic-based',
        provider: 'local',
        status: 'available',
        description: 'Rule-based element detection'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// GET /api/ai/health
// Health check for AI service
router.get('/health', (req, res) => {
  res.json({
    service: 'ai-controller',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;