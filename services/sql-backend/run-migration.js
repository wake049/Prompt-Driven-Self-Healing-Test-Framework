const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration - use the same config as the main app
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'testframework_db',
  user: process.env.DB_USER || 'testframework',
  password: process.env.DB_PASSWORD || 'securepassword',
});

async function runMigration() {
  try {
    console.log('🔄 Running review system migration...');
    console.log(`📊 Connecting to database: ${process.env.DB_NAME} as ${process.env.DB_USER}`);
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_add_review_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Review system migration completed successfully!');
    console.log('📝 Added tables: review_queue');
    console.log('🔧 Added columns: logical_key, identity_data, recorder to recorded_elements');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

runMigration();