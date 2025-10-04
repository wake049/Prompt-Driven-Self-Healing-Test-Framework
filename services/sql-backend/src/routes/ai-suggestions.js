const express = require('express');
const router = express.Router();

// Mock LLM function - works with MCP-compliant structural data only (no private content)
async function generateElementSuggestions(domData) {
  // Simulate AI processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const suggestions = [];
  
  // Privacy-safe heuristic suggestions based on structure, not content
  const extractSuggestions = (element, path = '') => {
    if (!element || !element.tag) return;
    
    const tag = element.tag;
    const attrs = element.attributes || {};
    
    // Generate suggestions for interactive elements using only structural data
    if (element.interactive || 
        ['button', 'input', 'select', 'textarea', 'a'].includes(tag)) {
      
      let suggestedId = '';
      let description = '';
      
      // Generate meaningful IDs from structural attributes only
      if (attrs.id && attrs.id !== '[present]') {
        suggestedId = attrs.id;
      } else if (attrs.name && attrs.name !== '[present]') {
        suggestedId = attrs.name;
      } else if (attrs.class) {
        // Use class names to infer purpose
        const classes = attrs.class.split(' ').filter(c => c.length > 0);
        if (classes.length > 0) {
          suggestedId = classes[0].replace(/[-_]/g, '') + '-element';
        }
      } else {
        suggestedId = `${tag}-${Date.now()}`;
      }
      
      // Generate description based on element structure, not content
      if (tag === 'button') {
        description = `Button element`;
        if (attrs.class && attrs.class.includes('submit')) {
          description = 'Submit button';
        } else if (attrs.class && attrs.class.includes('cancel')) {
          description = 'Cancel button';
        }
      } else if (tag === 'input') {
        const inputType = element.inputType || attrs.type || 'text';
        description = `${inputType.charAt(0).toUpperCase() + inputType.slice(1)} input field`;
        
        if (element.isRequired) {
          description += ' (required)';
        }
        if (element.hasPlaceholder) {
          description += ' with placeholder';
        }
      } else if (tag === 'select') {
        description = 'Dropdown selection';
      } else if (tag === 'textarea') {
        description = 'Multi-line text input';
      } else if (tag === 'a') {
        description = 'Link element';
      } else {
        description = `${tag} interactive element`;
      }
      
      // Generate selector using structural attributes only
      let selector = tag;
      if (attrs.id && attrs.id !== '[present]') {
        selector = `#${attrs.id}`;
      } else if (attrs.class) {
        const classes = attrs.class.split(' ').filter(c => c.length > 0);
        if (classes.length > 0) {
          selector = `${tag}.${classes[0]}`;
        }
      } else if (attrs.name && attrs.name !== '[present]') {
        selector = `${tag}[name="${attrs.name}"]`;
      } else if (attrs.type) {
        selector = `${tag}[type="${attrs.type}"]`;
      }
      
      // Generate XPath using structural data only
      let xpath = `//${tag}`;
      if (attrs.id && attrs.id !== '[present]') {
        xpath = `//${tag}[@id="${attrs.id}"]`;
      } else if (attrs.name && attrs.name !== '[present]') {
        xpath = `//${tag}[@name="${attrs.name}"]`;
      } else if (attrs.type) {
        xpath = `//${tag}[@type="${attrs.type}"]`;
      }
      
      suggestions.push({
        id: suggestedId,
        description,
        selector,
        xpath,
        tag,
        attributes: attrs,
        confidence: 0.8 + Math.random() * 0.2, // Mock confidence score
        category: getElementCategory(tag, attrs, element),
        privacyCompliant: true // Flag indicating no private data was used
      });
    }
    
    // Recursively process children
    if (element.children && Array.isArray(element.children)) {
      element.children.forEach((child, index) => {
        extractSuggestions(child, `${path}[${index}]`);
      });
    }
  };
  
  // Extract suggestions from DOM structure
  if (domData.structure) {
    extractSuggestions(domData.structure);
  }
  
  // Sort by confidence and limit results
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10); // Limit to top 10 suggestions
}

function getElementCategory(tag, attrs, element) {
  const type = attrs.type || '';
  const className = attrs.class || '';
  
  // Authentication elements (based on structure, not content)
  if (type === 'password') {
    return 'authentication';
  }
  if (type === 'email' || className.includes('email') || className.includes('username')) {
    return 'authentication';
  }
  if (className.includes('login') || className.includes('signin') || className.includes('submit')) {
    return 'authentication';
  }
  
  // Navigation elements
  if (tag === 'a' || className.includes('menu') || className.includes('nav')) {
    return 'navigation';
  }
  
  // Form elements
  if (['input', 'select', 'textarea'].includes(tag)) {
    return 'form';
  }
  
  // Actions
  if (tag === 'button' || className.includes('btn')) {
    return 'action';
  }
  
  return 'general';
}

// POST /api/ai-suggestions/analyze
// Analyze DOM structure and return element suggestions
router.post('/analyze', async (req, res) => {
  try {
    const { domData } = req.body;
    
    if (!domData) {
      return res.status(400).json({
        success: false,
        error: 'DOM data is required'
      });
    }
    
    console.log(`🤖 Analyzing page: ${domData.title} (${domData.url})`);
    
    // Generate suggestions using AI/heuristics
    const suggestions = await generateElementSuggestions(domData);
    
    console.log(`✨ Generated ${suggestions.length} element suggestions`);
    
    res.json({
      success: true,
      suggestions,
      metadata: {
        pageTitle: domData.title,
        pageUrl: domData.url,
        analysisTimestamp: new Date().toISOString(),
        totalSuggestions: suggestions.length
      }
    });
    
  } catch (error) {
    console.error('AI suggestion analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze DOM structure',
      details: error.message
    });
  }
});

// GET /api/ai-suggestions/health
// Health check for AI suggestion service
router.get('/health', (req, res) => {
  res.json({
    service: 'ai-suggestions',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;