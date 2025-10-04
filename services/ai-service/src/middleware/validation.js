const config = require('../config/config');

// Validate DOM data middleware
const validateDOMData = (req, res, next) => {
  try {
    const { domData } = req.body;

    if (!domData) {
      return res.status(400).json({
        success: false,
        error: 'DOM data is required',
        details: 'Request body must include domData object',
        timestamp: new Date().toISOString()
      });
    }

    // Validate required DOM fields
    if (!domData.elements || !Array.isArray(domData.elements)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid DOM structure',
        details: 'domData.elements must be an array',
        timestamp: new Date().toISOString()
      });
    }

    // Check element count limits
    if (domData.elements.length > config.validation.maxElementsPerRequest) {
      return res.status(400).json({
        success: false,
        error: 'Too many elements',
        details: `Maximum ${config.validation.maxElementsPerRequest} elements allowed per request`,
        timestamp: new Date().toISOString()
      });
    }

    // Validate element structure
    const invalidElements = [];
    domData.elements.forEach((element, index) => {
      if (!element.tag) {
        invalidElements.push(`Element ${index}: missing 'tag' field`);
      }
      if (!element.xpath) {
        invalidElements.push(`Element ${index}: missing 'xpath' field`);
      }
    });

    if (invalidElements.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid element structure',
        details: invalidElements.join('; '),
        timestamp: new Date().toISOString()
      });
    }

    // Validate options if provided
    if (req.body.options) {
      const { options } = req.body;
      
      if (options.maxSuggestions && (typeof options.maxSuggestions !== 'number' || options.maxSuggestions < 1)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid maxSuggestions option',
          details: 'maxSuggestions must be a positive number',
          timestamp: new Date().toISOString()
        });
      }

      if (options.confidenceThreshold && (typeof options.confidenceThreshold !== 'number' || 
          options.confidenceThreshold < 0 || options.confidenceThreshold > 1)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid confidenceThreshold option',
          details: 'confidenceThreshold must be a number between 0 and 1',
          timestamp: new Date().toISOString()
        });
      }

      const validCategories = ['authentication', 'navigation', 'form', 'action', 'verification', 'general'];
      if (options.includeCategories && (!Array.isArray(options.includeCategories) || 
          !options.includeCategories.every(cat => validCategories.includes(cat)))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid includeCategories option',
          details: `includeCategories must be an array containing: ${validCategories.join(', ')}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Add validation metadata to request
    req.validationMeta = {
      elementCount: domData.elements.length,
      pageTitle: domData.title || 'Unknown',
      pageUrl: domData.url || 'Unknown',
      hasOptions: !!req.body.options
    };

    next();
  } catch (error) {
    console.error('Validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Security validation middleware
const validateSecurityHeaders = (req, res, next) => {
  // Check for required security headers in production
  if (config.server.env === 'production') {
    const requiredHeaders = ['user-agent'];
    const missingHeaders = requiredHeaders.filter(header => !req.headers[header]);
    
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing security headers',
        details: `Required headers: ${missingHeaders.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  next();
};

// Request size validation
const validateRequestSize = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length']) || 0;
  const maxSize = parseInt(config.validation.maxPayloadSize.replace(/\D/g, '')) * 1024 * 1024; // Convert MB to bytes
  
  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      error: 'Request too large',
      details: `Maximum payload size is ${config.validation.maxPayloadSize}`,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

module.exports = {
  validateDOMData,
  validateSecurityHeaders,
  validateRequestSize
};