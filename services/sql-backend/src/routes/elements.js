const express = require('express');
const { query, transaction } = require('../database');
const router = express.Router();

// Get all recorded elements
router.get('/', async (req, res) => {
  try {
    const { session_id, page, tag, limit = 100, offset = 0 } = req.query;
    
    let whereClause = 'WHERE is_active = true';
    const params = [];
    let paramCount = 0;
    
    if (session_id) {
      paramCount++;
      whereClause += ` AND session_id = $${paramCount}`;
      params.push(session_id);
    }
    
    if (page) {
      paramCount++;
      whereClause += ` AND page ILIKE $${paramCount}`;
      params.push(`%${page}%`);
    }
    
    if (tag) {
      paramCount++;
      whereClause += ` AND tag = $${paramCount}`;
      params.push(tag);
    }
    
    paramCount++;
    const limitParam = paramCount;
    params.push(parseInt(limit));
    
    paramCount++;
    const offsetParam = paramCount;
    params.push(parseInt(offset));
    
    const result = await query(`
      SELECT re.*, ts.name as session_name 
      FROM recorded_elements re
      LEFT JOIN test_sessions ts ON re.session_id = ts.id
      ${whereClause}
      ORDER BY re.timestamp_recorded DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching recorded elements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single recorded element
router.get('/:id', async (req, res) => {
  try {
    const elementId = req.params.id;
    
    const result = await query(`
      SELECT re.*, ts.name as session_name 
      FROM recorded_elements re
      LEFT JOIN test_sessions ts ON re.session_id = ts.id
      WHERE re.id = $1
    `, [elementId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Element not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching recorded element:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new recorded element
router.post('/', async (req, res) => {
  try {
    const {
      session_id,
      element_id,
      tag,
      text_content,
      attributes = {},
      xpath,
      css_selector,
      position_x = 0,
      position_y = 0,
      selectors = [],
      page
    } = req.body;
    
    if (!element_id || !tag) {
      return res.status(400).json({ 
        success: false, 
        error: 'element_id and tag are required' 
      });
    }
    
    // If no session_id provided, create a default session
    let finalSessionId = session_id;
    if (!finalSessionId) {
      const sessionResult = await query(`
        INSERT INTO test_sessions (name, page, description)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [`Auto Session for ${page || 'unknown'}`, page, 'Automatically created session']);
      
      finalSessionId = sessionResult.rows[0].id;
    }
    
    const result = await query(`
      INSERT INTO recorded_elements (
        session_id, element_id, tag, text_content, attributes, 
        xpath, css_selector, position_x, position_y, selectors, page
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      finalSessionId, element_id, tag, text_content, JSON.stringify(attributes),
      xpath, css_selector, position_x, position_y, JSON.stringify(selectors), page
    ]);
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating recorded element:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update recorded element
router.put('/:id', async (req, res) => {
  try {
    const elementId = req.params.id;
    const {
      element_id,
      tag,
      text_content,
      attributes,
      xpath,
      css_selector,
      position_x,
      position_y,
      selectors,
      page,
      is_active
    } = req.body;
    
    const result = await query(`
      UPDATE recorded_elements 
      SET 
        element_id = COALESCE($1, element_id),
        tag = COALESCE($2, tag),
        text_content = COALESCE($3, text_content),
        attributes = COALESCE($4, attributes),
        xpath = COALESCE($5, xpath),
        css_selector = COALESCE($6, css_selector),
        position_x = COALESCE($7, position_x),
        position_y = COALESCE($8, position_y),
        selectors = COALESCE($9, selectors),
        page = COALESCE($10, page),
        is_active = COALESCE($11, is_active)
      WHERE id = $12
      RETURNING *
    `, [
      element_id, tag, text_content, 
      attributes ? JSON.stringify(attributes) : null,
      xpath, css_selector, position_x, position_y,
      selectors ? JSON.stringify(selectors) : null,
      page, is_active, elementId
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Element not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating recorded element:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete recorded element (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const elementId = req.params.id;
    
    const result = await query(
      'UPDATE recorded_elements SET is_active = false WHERE id = $1 RETURNING *',
      [elementId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Element not found' });
    }
    
    res.json({ success: true, message: 'Element deleted successfully' });
  } catch (error) {
    console.error('Error deleting recorded element:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk create elements (for Chrome extension batch uploads)
router.post('/bulk', async (req, res) => {
  try {
    const { elements, session_id } = req.body;
    
    if (!Array.isArray(elements) || elements.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'elements array is required and must not be empty' 
      });
    }
    
    const results = await transaction(async (client) => {
      const insertedElements = [];
      
      for (const element of elements) {
        const result = await client.query(`
          INSERT INTO recorded_elements (
            session_id, element_id, tag, text_content, attributes, 
            xpath, css_selector, position_x, position_y, selectors, page
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `, [
          session_id || null,
          element.element_id || element.id,
          element.tag,
          element.text_content || element.text,
          JSON.stringify(element.attributes || {}),
          element.xpath,
          element.css_selector || element.cssSelector,
          element.position_x || element.position?.x || 0,
          element.position_y || element.position?.y || 0,
          JSON.stringify(element.selectors || []),
          element.page
        ]);
        
        insertedElements.push(result.rows[0]);
      }
      
      return insertedElements;
    });
    
    res.status(201).json({ success: true, data: results });
  } catch (error) {
    console.error('Error bulk creating elements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;