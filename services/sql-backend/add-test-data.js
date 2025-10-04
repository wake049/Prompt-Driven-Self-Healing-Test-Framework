/**
 * Script to add test data to the SQL backend for testing the React frontend
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'testframework',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'testframework_db',
  password: process.env.DB_PASSWORD || 'securepassword',
  port: process.env.DB_PORT || 5432,
});

async function addTestData() {
  try {
    console.log('🔄 Adding test data to SQL backend...');

    // Create a test session first
    const sessionResult = await pool.query(`
      INSERT INTO test_sessions (name, page, description)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [
      'Demo Test Session',
      'https://example.com/demo',
      'Test session with sample UI elements for Chrome Extension demo'
    ]);

    const sessionId = sessionResult.rows[0].id;
    console.log('✅ Created test session:', sessionId);

    // Add sample recorded elements
    const testElements = [
      {
        element_id: 'login-button',
        tag: 'button',
        text_content: 'Sign In',
        attributes: { id: 'login-btn', class: 'btn btn-primary', type: 'submit' },
        xpath: '//button[@id="login-btn"]',
        css_selector: '#login-btn',
        position_x: 150,
        position_y: 200,
        selectors: ['#login-btn', '.btn.btn-primary', '//button[@id="login-btn"]'],
        page: 'https://example.com/login'
      },
      {
        element_id: 'username-input',
        tag: 'input',
        text_content: null,
        attributes: { id: 'username', name: 'username', type: 'text', placeholder: 'Enter username' },
        xpath: '//input[@id="username"]',
        css_selector: '#username',
        position_x: 150,
        position_y: 120,
        selectors: ['#username', 'input[name="username"]', '//input[@id="username"]'],
        page: 'https://example.com/login'
      },
      {
        element_id: 'password-input',
        tag: 'input',
        text_content: null,
        attributes: { id: 'password', name: 'password', type: 'password', placeholder: 'Enter password' },
        xpath: '//input[@id="password"]',
        css_selector: '#password',
        position_x: 150,
        position_y: 160,
        selectors: ['#password', 'input[name="password"]', '//input[@id="password"]'],
        page: 'https://example.com/login'
      },
      {
        element_id: 'search-button',
        tag: 'button',
        text_content: 'Search',
        attributes: { class: 'search-btn btn', 'data-action': 'search' },
        xpath: '//button[@data-action="search"]',
        css_selector: '.search-btn',
        position_x: 300,
        position_y: 80,
        selectors: ['.search-btn', 'button[data-action="search"]', '//button[@data-action="search"]'],
        page: 'https://example.com/dashboard'
      },
      {
        element_id: 'navigation-menu',
        tag: 'nav',
        text_content: 'Home Products About Contact',
        attributes: { class: 'main-nav navbar', role: 'navigation' },
        xpath: '//nav[@role="navigation"]',
        css_selector: '.main-nav',
        position_x: 0,
        position_y: 0,
        selectors: ['.main-nav', 'nav[role="navigation"]', '//nav[@role="navigation"]'],
        page: 'https://example.com/home'
      },
      {
        element_id: 'submit-form-btn',
        tag: 'button',
        text_content: 'Submit Form',
        attributes: { type: 'submit', class: 'submit-btn btn-success', form: 'contact-form' },
        xpath: '//button[@type="submit"]',
        css_selector: '.submit-btn',
        position_x: 200,
        position_y: 400,
        selectors: ['.submit-btn', 'button[type="submit"]', '//button[@type="submit"]'],
        page: 'https://example.com/contact'
      }
    ];

    let addedCount = 0;
    for (const element of testElements) {
      await pool.query(`
        INSERT INTO recorded_elements (
          session_id, element_id, tag, text_content, attributes, 
          xpath, css_selector, position_x, position_y, selectors, page
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        sessionId,
        element.element_id,
        element.tag,
        element.text_content,
        JSON.stringify(element.attributes),
        element.xpath,
        element.css_selector,
        element.position_x,
        element.position_y,
        JSON.stringify(element.selectors),
        element.page
      ]);
      addedCount++;
    }

    console.log(`✅ Added ${addedCount} test elements to the database`);

    // Add some test executions
    const testExecutions = [
      {
        tool_name: 'run_action',
        parameters: { action: { type: 'ui.click', elementId: 'login-button' } },
        result_success: true,
        result_data: { elementId: 'login-button', action: 'click' },
        execution_time_ms: 150,
        page: 'https://example.com/login'
      },
      {
        tool_name: 'run_action',
        parameters: { action: { type: 'ui.type', elementId: 'username-input', text: 'testuser' } },
        result_success: true,
        result_data: { elementId: 'username-input', action: 'type', text: 'testuser' },
        execution_time_ms: 300,
        page: 'https://example.com/login'
      }
    ];

    let executionCount = 0;
    for (const execution of testExecutions) {
      await pool.query(`
        INSERT INTO test_executions (
          session_id, tool_name, parameters, result_success, 
          result_data, execution_time_ms, page
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        sessionId,
        execution.tool_name,
        JSON.stringify(execution.parameters),
        execution.result_success,
        JSON.stringify(execution.result_data),
        execution.execution_time_ms,
        execution.page
      ]);
      executionCount++;
    }

    console.log(`✅ Added ${executionCount} test executions to the database`);

    // Verify the data
    const countResult = await pool.query('SELECT COUNT(*) as count FROM recorded_elements');
    const totalElements = countResult.rows[0].count;

    console.log(`🎉 Test data added successfully!`);
    console.log(`📊 Total elements in database: ${totalElements}`);
    console.log(`🔗 Visit React frontend at: http://localhost:3000`);
    console.log(`📡 SQL backend health: http://localhost:3001/health`);

  } catch (error) {
    console.error('❌ Error adding test data:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the script
addTestData();