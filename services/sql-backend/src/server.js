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

// CORS configuration - Allow all origins for testing
app.use(cors({
  origin: true,
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
    const { query } = require('./database');
    
    // Debug logging with stack trace
    console.log('🔍 DEBUG: Received element data:', {
      id: elementData.id || elementData.element_id,
      logical_key: elementData.logical_key,
      page: elementData.page,
      css_selector: elementData.cssSelector || elementData.css_selector,
      xpath: elementData.xpath,
      timestamp: new Date().toISOString()
    });
    
    // Log request headers to identify source
    console.log('📡 Request headers:', {
      'user-agent': req.headers['user-agent'],
      'origin': req.headers['origin'],
      'referer': req.headers['referer']
    });
    
    // Create session if needed
    let sessionId = sessionInfo?.session_id;
    if (!sessionId && sessionInfo) {
      const sessionResult = await query(`
        INSERT INTO test_sessions (name, page, description)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [
        sessionInfo.name || `Session for ${elementData.page}`,
        elementData.page,
        'Created from Chrome Extension'
      ]);
      sessionId = sessionResult.rows[0].id;
    } else if (sessionId) {
      // Check if session exists, create if not
      const sessionCheck = await query(`
        SELECT id FROM test_sessions WHERE id = $1
      `, [sessionId]);
      
      if (sessionCheck.rows.length === 0) {
        console.log(`⚠️ Session ${sessionId} not found, creating new session`);
        const sessionResult = await query(`
          INSERT INTO test_sessions (id, name, page, description)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `, [
          sessionId,
          `Session for ${elementData.page}`,
          elementData.page,
          'Created from Chrome Extension (recovered)'
        ]);
        sessionId = sessionResult.rows[0].id;
      }
    }
    
    // Extract logical_key and identity_data if provided
    const logicalKey = elementData.logical_key;
    const identityData = elementData.identity_data || elementData.identity || {};
    
    // Check if an element with the same logical_key already exists
    let action = 'created';
    let reviewItem = null;
    
    if (logicalKey) {
      const existingResult = await query(`
        SELECT * FROM recorded_elements 
        WHERE logical_key = $1 AND page = $2 AND is_active = true
        ORDER BY timestamp_recorded DESC
        LIMIT 1
      `, [logicalKey, elementData.page]);
      
      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        
        // Compare selectors to see if they're different
        const existingSelectors = existing.selectors || [];
        const newSelectors = (elementData.selectors || []).map(sel => cleanExtensionArtifacts(sel));
        const newCssSelector = cleanExtensionArtifacts(elementData.cssSelector || elementData.css_selector);
        const newXpath = elementData.xpath;
        
        // Check if main selectors are different
        const selectorsChanged = (
          existing.css_selector !== newCssSelector ||
          existing.xpath !== newXpath
        );
        
        if (selectorsChanged) {
          // Create a review item for the locator change
          const reviewResult = await query(`
            INSERT INTO review_queue (
              element_identifier, page, issue_type, description,
              current_element_id, current_selectors, suggested_selectors,
              identity_data, logical_key, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
          `, [
            elementData.id || elementData.element_id,
            elementData.page,
            'locator_change',
            `Element locators changed. Previous: CSS="${existing.css_selector}", XPath="${existing.xpath?.replace(/"/g, '\\"')}". New: CSS="${newCssSelector}", XPath="${newXpath?.replace(/"/g, '\\"')}"`,
            existing.id,
            JSON.stringify([existing.css_selector, existing.xpath]),
            JSON.stringify([newCssSelector, newXpath]),
            JSON.stringify(identityData),
            logicalKey,
            'pending'
          ]);
          
          action = 'review_enqueued';
          reviewItem = reviewResult.rows[0];
          
          console.log(`📝 Review item created for element ${logicalKey} - selectors changed`);
          
          // When review is created, don't create a new element - wait for review resolution
          return res.json({
            success: true,
            action,
            element: existing, // Return the existing element
            reviewItem
          });
        } else {
          // Same selectors, just update timestamp
          await query(`
            UPDATE recorded_elements 
            SET last_updated = CURRENT_TIMESTAMP 
            WHERE id = $1
          `, [existing.id]);
          
          action = 'updated_existing';
          console.log(`🔄 Updated existing element ${logicalKey} - no selector changes`);
          
          // Return the updated existing element
          return res.json({
            success: true,
            action,
            element: existing,
            reviewItem: null
          });
        }
      }
    }
    
    // Record the new element regardless (for history/audit trail)
    const result = await query(`
      INSERT INTO recorded_elements (
        session_id, element_id, tag, text_content, attributes, 
        xpath, css_selector, position_x, position_y, selectors, page,
        logical_key, identity_data, recorder
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      sessionId,
      elementData.id || elementData.element_id,
      elementData.tag,
      elementData.text_content || elementData.text,
      JSON.stringify(elementData.attributes || {}),
      elementData.xpath,
      cleanExtensionArtifacts(elementData.cssSelector || elementData.css_selector),
      elementData.position_x || elementData.position?.x || 0,
      elementData.position_y || elementData.position?.y || 0,
      JSON.stringify((elementData.selectors || []).map(sel => cleanExtensionArtifacts(sel))),
      elementData.page,
      logicalKey,
      JSON.stringify(identityData),
      elementData.recorder || 'extension'
    ]);
    
    console.log('✅ Element recorded successfully:', result.rows[0].id);
    console.log('📝 Action:', action);
    console.log('🔍 Review item:', reviewItem ? 'Created' : 'None');
    
    const responseData = { 
      success: true, 
      data: result.rows[0],
      action: action,
      review_item: reviewItem,
      session_id: sessionId
    };
    
    console.log('📤 Sending response...');
    res.status(201).json(responseData);
    console.log('✅ Response sent successfully');
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

// Get review queue items
app.get('/api/review-queue', async (req, res) => {
  try {
    const { query } = require('./database');
    const { status = 'pending', page } = req.query;
    
    let whereClause = 'WHERE rq.status = $1';
    let params = [status];
    
    if (page) {
      whereClause += ' AND rq.page = $2';
      params.push(page);
    }
    
    const result = await query(`
      SELECT 
        rq.*,
        re_current.element_id as current_element_identifier,
        re_current.css_selector as current_css_selector,
        re_current.xpath as current_xpath,
        re_current.tag as current_tag,
        re_current.text_content as current_text
      FROM review_queue rq
      LEFT JOIN recorded_elements re_current ON rq.current_element_id = re_current.id
      ${whereClause}
      ORDER BY rq.created_at DESC
    `, params);
    
    res.json({ 
      success: true, 
      data: result.rows,
      count: result.rows.length 
    });
  } catch (error) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bridge endpoint to serve review queue data in the format expected by the ReviewQueuePage
app.get('/api/v1/review/pending', async (req, res) => {
  try {
    const { query } = require('./database');
    const result = await query(`
      SELECT 
        rq.id,
        rq.logical_key as element_id,
        rq.page,
        rq.suggested_selectors,
        rq.current_selectors,
        0.8 as confidence_score,
        rq.description as ai_reasoning,
        'click' as intended_action,
        rq.status,
        rq.created_at,
        rq.updated_at
      FROM review_queue rq
      WHERE rq.status = 'pending'
      ORDER BY rq.created_at DESC
    `);
    
    // Convert to the format expected by the frontend
    const reviewItems = result.rows.map(row => {
      let suggestedLocator = '';
      let oldLocator = '';
      
      // Safely handle selector arrays (already parsed by PostgreSQL JSONB)
      if (Array.isArray(row.suggested_selectors)) {
        suggestedLocator = row.suggested_selectors[0] || '';
      } else if (typeof row.suggested_selectors === 'string') {
        try {
          const suggested = JSON.parse(row.suggested_selectors);
          suggestedLocator = suggested[0] || '';
        } catch (e) {
          suggestedLocator = row.suggested_selectors || '';
        }
      }
      
      if (Array.isArray(row.current_selectors)) {
        oldLocator = row.current_selectors[0] || '';
      } else if (typeof row.current_selectors === 'string') {
        try {
          const current = JSON.parse(row.current_selectors);
          oldLocator = current[0] || '';
        } catch (e) {
          oldLocator = row.current_selectors || '';
        }
      }
      
      return {
        id: row.id.toString(),
        page: row.page,
        element_id: row.element_id,
        suggested_locator: suggestedLocator,
        old_locator: oldLocator,
        confidence_score: parseFloat(row.confidence_score),
        ai_reasoning: row.ai_reasoning,
        intended_action: row.intended_action,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });
    
    res.json(reviewItems);
  } catch (error) {
    console.error('Error fetching review items for ReviewQueuePage:', error);
    res.status(500).json([]);
  }
});

// Update review status endpoint for ReviewQueuePage compatibility
app.patch('/api/v1/review/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewer_notes } = req.body;
    const { query } = require('./database');
    
    const result = await query(`
      UPDATE review_queue 
      SET 
        status = $1,
        resolution_notes = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [status, reviewer_notes || null, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Review item not found' });
    }
    
    // Return in expected format
    const row = result.rows[0];
    const reviewItem = {
      id: row.id.toString(),
      page: row.page,
      element_id: row.logical_key,
      suggested_locator: row.suggested_selectors?.[0] || '',
      old_locator: row.current_selectors?.[0] || '',
      confidence_score: 0.8,
      ai_reasoning: row.description,
      intended_action: 'click',
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
    
    res.json(reviewItem);
  } catch (error) {
    console.error('Error updating review status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify endpoint (placeholder for ReviewQueuePage compatibility)
app.post('/api/v1/review/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    
    // For now, just return a mock verification result
    res.json({
      review_id: id,
      heuristic_pass: true,
      functional_pass: true,
      details: {
        message: 'Verification not implemented yet - returning mock data'
      }
    });
  } catch (error) {
    console.error('Error verifying review item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Suggest alternatives endpoint (placeholder for ReviewQueuePage compatibility)
app.post('/api/v1/review/suggest', async (req, res) => {
  try {
    // For now, just return mock suggestions
    res.json({
      alternatives: [
        {
          selector: 'Alternative selector 1',
          confidence: 0.9,
          ai_reasoning: 'This is a mock alternative suggestion'
        },
        {
          selector: 'Alternative selector 2', 
          confidence: 0.7,
          ai_reasoning: 'This is another mock alternative'
        }
      ]
    });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resolve review queue item
app.post('/api/review-queue/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body; // action: 'approve', 'reject', 'merge'
    const { query } = require('./database');
    
    console.log(`🔍 Resolving review ${id} with action: ${action}`);
    
    // Get the review item first
    const reviewResult = await query(`
      SELECT * FROM review_queue WHERE id = $1
    `, [id]);
    
    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Review item not found' });
    }
    
    const reviewItem = reviewResult.rows[0];
    console.log(`📋 Review item:`, reviewItem);
    
    // If approving, update the element with new selectors
    if (action === 'approve') {
      let suggestedSelectors = [];
      
      console.log('🔍 Debug suggested_selectors:', {
        value: reviewItem.suggested_selectors,
        type: typeof reviewItem.suggested_selectors,
        isArray: Array.isArray(reviewItem.suggested_selectors),
        stringified: JSON.stringify(reviewItem.suggested_selectors)
      });
      
      // Handle the suggested selectors - they might already be an array or a JSON string
      if (Array.isArray(reviewItem.suggested_selectors)) {
        suggestedSelectors = reviewItem.suggested_selectors;
      } else {
        // Safely parse the suggested selectors JSON
        try {
          suggestedSelectors = JSON.parse(reviewItem.suggested_selectors || '[]');
        } catch (e) {
          console.warn('Failed to parse suggested_selectors, using fallback:', reviewItem.suggested_selectors);
          // If JSON parsing fails, treat it as a single selector string
          suggestedSelectors = [reviewItem.suggested_selectors || ''];
        }
      }
      
      console.log(`✅ Approving review: updating element ${reviewItem.current_element_id} with selectors:`, suggestedSelectors);
      console.log('🔍 suggestedSelectors analysis:', suggestedSelectors.map((sel, i) => ({ 
        index: i, 
        value: sel, 
        type: typeof sel, 
        isString: typeof sel === 'string',
        hasStartsWith: sel && typeof sel.startsWith === 'function'
      })));
      
      // Separate CSS and XPath selectors
      let cssSelector = '';
      let xpathSelector = '';
      
      suggestedSelectors.forEach((selector, index) => {
        console.log(`🔍 Processing selector ${index}:`, { selector, type: typeof selector });
        if (typeof selector === 'string') {
          if (selector.startsWith('//') || selector.startsWith('//*')) {
            xpathSelector = selector;
            console.log(`📍 Set XPath: ${selector}`);
          } else {
            cssSelector = selector;
            console.log(`📍 Set CSS: ${selector}`);
          }
        } else {
          console.warn(`⚠️ Selector at index ${index} is not a string:`, selector, typeof selector);
        }
      });
      
      // Fallback: if we don't have both types, use the first selector as CSS
      if (!cssSelector && suggestedSelectors.length > 0) {
        cssSelector = suggestedSelectors[0];
      }
      if (!xpathSelector && suggestedSelectors.length > 1) {
        xpathSelector = suggestedSelectors[1];
      }
      
      console.log(`📝 Updating with CSS: "${cssSelector}", XPath: "${xpathSelector}"`);
      
      if (reviewItem.current_element_id) {
        // Update existing element - only update fields that have new values
        if (cssSelector && xpathSelector) {
          // Update both CSS and XPath
          await query(`
            UPDATE recorded_elements 
            SET 
              css_selector = $1,
              xpath = $2,
              last_updated = CURRENT_TIMESTAMP
            WHERE id = $3
          `, [cssSelector, xpathSelector, reviewItem.current_element_id]);
          console.log(`✅ Updated element ${reviewItem.current_element_id} with CSS and XPath selectors`);
        } else if (cssSelector) {
          // Only update CSS selector, preserve existing XPath
          await query(`
            UPDATE recorded_elements 
            SET 
              css_selector = $1,
              last_updated = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [cssSelector, reviewItem.current_element_id]);
          console.log(`✅ Updated element ${reviewItem.current_element_id} with CSS selector (preserved existing XPath)`);
        } else if (xpathSelector) {
          // Only update XPath selector, preserve existing CSS
          await query(`
            UPDATE recorded_elements 
            SET 
              xpath = $1,
              last_updated = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [xpathSelector, reviewItem.current_element_id]);
          console.log(`✅ Updated element ${reviewItem.current_element_id} with XPath selector (preserved existing CSS)`);
        } else {
          console.log(`⚠️ No valid selectors to update for element ${reviewItem.current_element_id}`);
        }
      } else {
        // Try to find the actual element to update using element_identifier
        console.log(`🔍 Looking for existing element to update: ${reviewItem.element_identifier} on page ${reviewItem.page}`);
        
        let elementToUpdate = await query(`
          SELECT id FROM recorded_elements 
          WHERE element_id = $1 AND page = $2 AND is_active = true 
          ORDER BY last_updated DESC 
          LIMIT 1
        `, [reviewItem.element_identifier, reviewItem.page]);
        
        // Try case-insensitive if exact match fails
        if (elementToUpdate.rows.length === 0) {
          elementToUpdate = await query(`
            SELECT id FROM recorded_elements 
            WHERE LOWER(element_id) = LOWER($1) AND LOWER(page) LIKE LOWER($2) AND is_active = true 
            ORDER BY last_updated DESC 
            LIMIT 1
          `, [reviewItem.element_identifier, `%${reviewItem.page}%`]);
        }
        
        if (elementToUpdate.rows.length > 0) {
          const elementId = elementToUpdate.rows[0].id;
          console.log(`✅ Found existing element to update: ${elementId}`);
          
          // Update only fields that have new values
          if (cssSelector && xpathSelector) {
            await query(`
              UPDATE recorded_elements 
              SET 
                css_selector = $1,
                xpath = $2,
                last_updated = CURRENT_TIMESTAMP
              WHERE id = $3
            `, [cssSelector, xpathSelector, elementId]);
            console.log(`✅ Updated existing element ${elementId} with CSS and XPath selectors`);
          } else if (cssSelector) {
            await query(`
              UPDATE recorded_elements 
              SET 
                css_selector = $1,
                last_updated = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [cssSelector, elementId]);
            console.log(`✅ Updated existing element ${elementId} with CSS selector (preserved existing XPath)`);
          } else if (xpathSelector) {
            await query(`
              UPDATE recorded_elements 
              SET 
                xpath = $1,
                last_updated = CURRENT_TIMESTAMP
              WHERE id = $2
            `, [xpathSelector, elementId]);
            console.log(`✅ Updated existing element ${elementId} with XPath selector (preserved existing CSS)`);
          }
        } else {
          console.log(`⚠️ Still no element found to update, creating new record as last resort`);
          
          const newElementResult = await query(`
            INSERT INTO recorded_elements (
              element_id,
              tag,
              css_selector,
              xpath,
              page,
              logical_key,
              recorder
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `, [
            reviewItem.element_identifier,
            'unknown',
            cssSelector,
            xpathSelector,
            reviewItem.page,
            reviewItem.logical_key,
            'healing-approved'
          ]);
          
          console.log(`✅ Created new element ${newElementResult.rows[0].id} with healing selectors`);
        }
      }
    }
    
    // Mark the review as resolved
    const result = await query(`
      UPDATE review_queue 
      SET 
        status = $1,
        resolved_by = $2,
        resolved_at = CURRENT_TIMESTAMP,
        resolution_notes = $3
      WHERE id = $4
      RETURNING *
    `, [action, 'system', notes || '', id]);

    res.json({ 
      success: true, 
      data: result.rows[0],
      message: `Review item ${action}d successfully`
    });
  } catch (error) {
    console.error('Error resolving review item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Submit healing data from Java framework
// Helper function to clean Chrome extension artifact classes
function cleanExtensionArtifacts(selector) {
  if (!selector || typeof selector !== 'string') return selector;
  
  // Remove MCP Chrome extension classes
  selector = selector
    .replace(/\.mcp-hover-highlight/g, '')
    .replace(/\.mcp-recorded-highlight/g, '')
    .replace(/\.mcp-[a-zA-Z0-9-]+/g, '') // Remove any other mcp- classes
    .replace(/\.\.+/g, '.') // Replace multiple dots with single dot
    .replace(/\.$/, '') // Remove trailing dot
    .replace(/^\s+|\s+$/g, ''); // Trim whitespace
  
  console.log(`🧹 Cleaned selector artifacts: "${arguments[0]}" → "${selector}"`);
  return selector;
}

// Helper function to normalize selector format
function normalizeSelector(selector) {
  if (!selector || typeof selector !== 'string') return selector;
  
  // Remove common prefixes to get plain selectors
  if (selector.startsWith('css=')) {
    return selector.substring(4);
  } else if (selector.startsWith('xpath=')) {
    return selector.substring(6);
  } else if (selector.startsWith('id=')) {
    return '#' + selector.substring(3);
  } else if (selector.startsWith('name=')) {
    return `[name="${selector.substring(5)}"]`;
  } else if (selector.startsWith('class=')) {
    return '.' + selector.substring(6);
  } else if (selector.startsWith('tag=')) {
    return selector.substring(4);
  }
  
  return selector; // Return as-is if no prefix found
}

app.post('/api/v1/healing/submit', async (req, res) => {
  try {
    const { healing_attempts, session_id, test_run_id } = req.body;
    const { query } = require('./database');
    
    console.log(`🩹 Received healing submission with ${healing_attempts?.length || 0} attempts`);
    console.log(`📋 Session: ${session_id}, Test Run: ${test_run_id}`);
    
    if (!healing_attempts || !Array.isArray(healing_attempts)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid healing_attempts data' 
      });
    }
    
    // Debug: Log first few attempts to understand the data structure
    console.log(`🔍 Sample healing attempts:`, healing_attempts.slice(0, 3).map(attempt => ({
      elementId: attempt.elementId,
      page: attempt.page,
      result: attempt.result,
      originalLocator: attempt.originalLocator,
      healedLocator: attempt.healedLocator
    })));

    let createdReviews = 0;
    
    // Process each healing attempt and create review items
    for (const attempt of healing_attempts) {
      if (attempt.result === 'SUCCESS' && attempt.healedLocator) {
        // Look up existing element by element_identifier with flexible matching
        console.log(`🔍 Looking up element: "${attempt.elementId}" on page: "${attempt.page}"`);
        
        // First, let's see what elements actually exist in the database
        const allElementsQuery = await query(`
          SELECT id, element_id, page, css_selector, is_active 
          FROM recorded_elements 
          WHERE is_active = true 
          ORDER BY element_id, page
          LIMIT 20
        `);
        console.log(`📊 Available elements in database:`, allElementsQuery.rows.map(r => 
          `${r.element_id}@${r.page} (id: ${r.id.substring(0,8)}...)`
        ).join(', '));
        
        // Try multiple lookup strategies
        let elementLookup = await query(`
          SELECT id, element_id, page FROM recorded_elements 
          WHERE element_id = $1 AND page = $2 AND is_active = true 
          ORDER BY last_updated DESC 
          LIMIT 1
        `, [attempt.elementId || 'unknown', attempt.page || 'unknown']);
        
        console.log(`🔍 Exact match query result: ${elementLookup.rows.length} rows`);
        
        // If not found, try with case-insensitive matching
        if (elementLookup.rows.length === 0) {
          console.log(`🔍 Trying case-insensitive match for: "${attempt.elementId}" on "${attempt.page}"`);
          elementLookup = await query(`
            SELECT id, element_id, page FROM recorded_elements 
            WHERE LOWER(element_id) = LOWER($1) AND LOWER(page) = LOWER($2) AND is_active = true 
            ORDER BY last_updated DESC 
            LIMIT 1
          `, [attempt.elementId || 'unknown', attempt.page || 'unknown']);
          console.log(`🔍 Case-insensitive query result: ${elementLookup.rows.length} rows`);
        }
        
        // If still not found, try without page constraint (element_id only)
        if (elementLookup.rows.length === 0) {
          elementLookup = await query(`
            SELECT id, element_id, page FROM recorded_elements 
            WHERE LOWER(element_id) = LOWER($1) AND is_active = true 
            ORDER BY last_updated DESC 
            LIMIT 1
          `, [attempt.elementId || 'unknown']);
        }
        
        // If still not found, try partial matching on element_id (for cases like inventory_item_desc vs inventory_item_description)
        if (elementLookup.rows.length === 0) {
          const baseElementId = (attempt.elementId || '').replace(/_desc$/, '_description').replace(/_description$/, '_desc');
          if (baseElementId !== attempt.elementId) {
            elementLookup = await query(`
              SELECT id, element_id, page FROM recorded_elements 
              WHERE LOWER(element_id) = LOWER($1) AND is_active = true 
              ORDER BY last_updated DESC 
              LIMIT 1
            `, [baseElementId]);
          }
        }
        
        let currentElementId = elementLookup.rows.length > 0 ? elementLookup.rows[0].id : null;
        
        if (currentElementId) {
          const foundElement = elementLookup.rows[0];
          console.log(`✅ Found existing element: ${foundElement.element_id} (${foundElement.id}) on page: ${foundElement.page}`);
        } else {
          console.log(`⚠️ No existing element found for ${attempt.elementId} on page ${attempt.page} - will create review without element link`);
          // Don't create placeholder elements - let the review approval handle element updates
        }
        
        // Create a review item for the successful healing
        const reviewResult = await query(`
          INSERT INTO review_queue (
            element_identifier,
            page,
            issue_type,
            description,
            current_element_id,
            current_selectors,
            suggested_selectors,
            identity_data,
            logical_key,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          attempt.elementId || 'unknown',
          attempt.page || 'unknown',
          'healing_suggestion',
          `Self-healing suggested new locator for element "${attempt.elementId}". Original locator failed, but healing found a working alternative.`,
          currentElementId,
          JSON.stringify([normalizeSelector(attempt.originalLocator)]),
          JSON.stringify([normalizeSelector(attempt.healedLocator)]),
          JSON.stringify({
            timestamp: attempt.timestamp,
            attemptedAlternatives: attempt.attemptedAlternatives || [],
            healingSource: 'java-framework'
          }),
          attempt.elementId || 'unknown',
          'pending'
        ]);
        
        createdReviews++;
        console.log(`📝 Created review item for healed element: ${attempt.elementId}`);
      }
    }
    
    const successfulHealings = healing_attempts.filter(attempt => attempt.result === 'SUCCESS').length;
    
    console.log(`✅ Processed healing submission: ${createdReviews} review items created`);
    
    res.json({
      success: true,
      message: `Processed ${healing_attempts.length} healing attempts`,
      successful_healings: successfulHealings,
      created_reviews: createdReviews
    });
    
  } catch (error) {
    console.error('Error processing healing submission:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process healing submission',
      details: error.message 
    });
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