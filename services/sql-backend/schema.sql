-- MCP Test Framework Database Schema
-- PostgreSQL Schema for storing recorded elements and test sessions

-- Drop tables if they exist (for clean recreation)
DROP TABLE IF EXISTS test_executions CASCADE;
DROP TABLE IF EXISTS recorded_elements CASCADE;
DROP TABLE IF EXISTS test_sessions CASCADE;

-- Test Sessions Table
CREATE TABLE test_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    page VARCHAR(500),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system'
);

-- Recorded Elements Table
CREATE TABLE recorded_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES test_sessions(id) ON DELETE CASCADE,
    element_id VARCHAR(255) NOT NULL, -- The suggested ID from the recorder
    tag VARCHAR(50) NOT NULL,
    text_content TEXT,
    attributes JSONB DEFAULT '{}',
    xpath TEXT,
    css_selector TEXT,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    selectors JSONB DEFAULT '[]', -- Array of alternative selectors
    page VARCHAR(500),
    timestamp_recorded TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Test Executions Table
CREATE TABLE test_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES test_sessions(id) ON DELETE CASCADE,
    element_id UUID REFERENCES recorded_elements(id) ON DELETE SET NULL,
    tool_name VARCHAR(100) NOT NULL,
    parameters JSONB DEFAULT '{}',
    result_success BOOLEAN,
    result_data JSONB,
    result_error TEXT,
    result_logs JSONB DEFAULT '[]',
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    page VARCHAR(500)
);

-- Indexes for better performance
CREATE INDEX idx_recorded_elements_session_id ON recorded_elements(session_id);
CREATE INDEX idx_recorded_elements_element_id ON recorded_elements(element_id);
CREATE INDEX idx_recorded_elements_page ON recorded_elements(page);
CREATE INDEX idx_recorded_elements_timestamp ON recorded_elements(timestamp_recorded);
CREATE INDEX idx_test_executions_session_id ON test_executions(session_id);
CREATE INDEX idx_test_executions_element_id ON test_executions(element_id);
CREATE INDEX idx_test_executions_executed_at ON test_executions(executed_at);
CREATE INDEX idx_test_sessions_created_at ON test_sessions(created_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update last_updated timestamp for recorded_elements
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_test_sessions_updated_at 
    BEFORE UPDATE ON test_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recorded_elements_last_updated 
    BEFORE UPDATE ON recorded_elements 
    FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

-- Insert some sample data
INSERT INTO test_sessions (name, page, description) VALUES 
('Sample Login Test', 'https://example.com/login', 'Testing login functionality'),
('Sample Form Test', 'https://example.com/contact', 'Testing contact form');

COMMENT ON TABLE test_sessions IS 'Test sessions containing recorded elements and executions';
COMMENT ON TABLE recorded_elements IS 'UI elements recorded by the Chrome extension';
COMMENT ON TABLE test_executions IS 'Results of test tool executions on recorded elements';