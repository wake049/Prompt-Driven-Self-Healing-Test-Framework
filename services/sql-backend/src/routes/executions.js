const express = require('express');
const { query } = require('../database');
const router = express.Router();

// Get all test executions
router.get('/', async (req, res) => {
  try {
    const { session_id, element_id, tool_name, limit = 100, offset = 0 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (session_id) {
      paramCount++;
      whereClause += ` AND te.session_id = $${paramCount}`;
      params.push(session_id);
    }
    
    if (element_id) {
      paramCount++;
      whereClause += ` AND te.element_id = $${paramCount}`;
      params.push(element_id);
    }
    
    if (tool_name) {
      paramCount++;
      whereClause += ` AND te.tool_name = $${paramCount}`;
      params.push(tool_name);
    }
    
    paramCount++;
    const limitParam = paramCount;
    params.push(parseInt(limit));
    
    paramCount++;
    const offsetParam = paramCount;
    params.push(parseInt(offset));
    
    const result = await query(`
      SELECT 
        te.*,
        ts.name as session_name,
        re.element_id as recorded_element_id,
        re.tag as element_tag
      FROM test_executions te
      LEFT JOIN test_sessions ts ON te.session_id = ts.id
      LEFT JOIN recorded_elements re ON te.element_id = re.id
      ${whereClause}
      ORDER BY te.executed_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching test executions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single test execution
router.get('/:id', async (req, res) => {
  try {
    const executionId = req.params.id;
    
    const result = await query(`
      SELECT 
        te.*,
        ts.name as session_name,
        re.element_id as recorded_element_id,
        re.tag as element_tag
      FROM test_executions te
      LEFT JOIN test_sessions ts ON te.session_id = ts.id
      LEFT JOIN recorded_elements re ON te.element_id = re.id
      WHERE te.id = $1
    `, [executionId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching test execution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new test execution
router.post('/', async (req, res) => {
  try {
    const {
      session_id,
      element_id,
      tool_name,
      parameters = {},
      result_success,
      result_data,
      result_error,
      result_logs = [],
      execution_time_ms,
      page
    } = req.body;
    
    if (!tool_name) {
      return res.status(400).json({ 
        success: false, 
        error: 'tool_name is required' 
      });
    }
    
    const result = await query(`
      INSERT INTO test_executions (
        session_id, element_id, tool_name, parameters,
        result_success, result_data, result_error, result_logs,
        execution_time_ms, page
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      session_id, element_id, tool_name, JSON.stringify(parameters),
      result_success, result_data ? JSON.stringify(result_data) : null,
      result_error, JSON.stringify(result_logs), execution_time_ms, page
    ]);
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating test execution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update test execution
router.put('/:id', async (req, res) => {
  try {
    const executionId = req.params.id;
    const {
      result_success,
      result_data,
      result_error,
      result_logs,
      execution_time_ms
    } = req.body;
    
    const result = await query(`
      UPDATE test_executions 
      SET 
        result_success = COALESCE($1, result_success),
        result_data = COALESCE($2, result_data),
        result_error = COALESCE($3, result_error),
        result_logs = COALESCE($4, result_logs),
        execution_time_ms = COALESCE($5, execution_time_ms)
      WHERE id = $6
      RETURNING *
    `, [
      result_success,
      result_data ? JSON.stringify(result_data) : null,
      result_error,
      result_logs ? JSON.stringify(result_logs) : null,
      execution_time_ms,
      executionId
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating test execution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete test execution
router.delete('/:id', async (req, res) => {
  try {
    const executionId = req.params.id;
    
    const result = await query(
      'DELETE FROM test_executions WHERE id = $1 RETURNING *',
      [executionId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }
    
    res.json({ success: true, message: 'Execution deleted successfully' });
  } catch (error) {
    console.error('Error deleting test execution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get execution statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_executions,
        COUNT(CASE WHEN result_success = true THEN 1 END) as successful_executions,
        COUNT(CASE WHEN result_success = false THEN 1 END) as failed_executions,
        AVG(execution_time_ms) as avg_execution_time,
        COUNT(DISTINCT tool_name) as unique_tools,
        COUNT(DISTINCT session_id) as sessions_with_executions
      FROM test_executions
    `);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching execution stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;