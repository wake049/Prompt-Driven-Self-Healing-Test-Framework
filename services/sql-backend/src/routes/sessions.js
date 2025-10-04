const express = require('express');
const { query, transaction } = require('../database');
const router = express.Router();

// Get all test sessions
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ts.*,
        COUNT(DISTINCT re.id) as element_count,
        COUNT(DISTINCT te.id) as execution_count
      FROM test_sessions ts
      LEFT JOIN recorded_elements re ON ts.id = re.session_id
      LEFT JOIN test_executions te ON ts.id = te.session_id
      GROUP BY ts.id
      ORDER BY ts.created_at DESC
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching test sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single test session with elements and executions
router.get('/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    // Get session details
    const sessionResult = await query(
      'SELECT * FROM test_sessions WHERE id = $1',
      [sessionId]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    // Get elements
    const elementsResult = await query(
      'SELECT * FROM recorded_elements WHERE session_id = $1 ORDER BY timestamp_recorded',
      [sessionId]
    );
    
    // Get executions
    const executionsResult = await query(
      'SELECT * FROM test_executions WHERE session_id = $1 ORDER BY executed_at',
      [sessionId]
    );
    
    const session = sessionResult.rows[0];
    session.elements = elementsResult.rows;
    session.executions = executionsResult.rows;
    
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error fetching test session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new test session
router.post('/', async (req, res) => {
  try {
    const { name, page, description, created_by = 'system' } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Session name is required' });
    }
    
    const result = await query(`
      INSERT INTO test_sessions (name, page, description, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, page, description, created_by]);
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating test session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update test session
router.put('/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { name, page, description } = req.body;
    
    const result = await query(`
      UPDATE test_sessions 
      SET name = COALESCE($1, name), 
          page = COALESCE($2, page), 
          description = COALESCE($3, description)
      WHERE id = $4
      RETURNING *
    `, [name, page, description, sessionId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating test session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete test session
router.delete('/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    
    const result = await query(
      'DELETE FROM test_sessions WHERE id = $1 RETURNING *',
      [sessionId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting test session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;