-- API Test Data Setup Tables
-- Allows testers to define API configurations for creating test data before UI tests
-- Example: Create a booking via API before testing "change booking" flow

-- Create schema for API test data if not exists
CREATE SCHEMA IF NOT EXISTS api_tests;

-- API Endpoint Configurations - Define target APIs
CREATE TABLE IF NOT EXISTS api_tests.api_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_url VARCHAR(1000) NOT NULL,
    auth_type VARCHAR(50) DEFAULT 'none', -- none, api_key, bearer, basic, oauth2
    auth_config JSONB DEFAULT '{}'::jsonb, -- Stores auth credentials/configuration
    default_headers JSONB DEFAULT '{}'::jsonb,
    timeout_seconds INTEGER DEFAULT 30,
    retry_count INTEGER DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES core.users(id),
    CONSTRAINT unique_endpoint_name_per_project UNIQUE(project_id, name)
);

-- API Data Templates - Reusable request templates for creating test data
CREATE TABLE IF NOT EXISTS api_tests.data_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID NOT NULL REFERENCES api_tests.api_endpoints(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- e.g., 'booking', 'user', 'payment', 'inventory'
    http_method VARCHAR(10) NOT NULL DEFAULT 'POST', -- GET, POST, PUT, PATCH, DELETE
    path VARCHAR(1000) NOT NULL, -- API path (e.g., /api/v1/bookings)
    request_headers JSONB DEFAULT '{}'::jsonb,
    request_body_template JSONB, -- Template with placeholders like {{customer_name}}
    expected_status_codes INTEGER[] DEFAULT ARRAY[200, 201],
    response_extractors JSONB DEFAULT '[]'::jsonb, -- Extract values from response for use in tests
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES core.users(id),
    CONSTRAINT unique_template_name_per_endpoint UNIQUE(endpoint_id, name)
);

-- Data sets - Specific data instances created from templates
CREATE TABLE IF NOT EXISTS api_tests.data_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES api_tests.data_templates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    variables JSONB DEFAULT '{}'::jsonb, -- Variable values to replace in template
    is_default BOOLEAN DEFAULT false, -- Default data set for quick selection
    tags VARCHAR(100)[] DEFAULT '{}', -- Tags for filtering (e.g., ['smoke', 'regression'])
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES core.users(id)
);

-- Test data setup configurations - Combine templates and data sets for a test
CREATE TABLE IF NOT EXISTS api_tests.test_data_setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    execution_order INTEGER DEFAULT 0, -- Order in which to execute API calls
    template_id UUID NOT NULL REFERENCES api_tests.data_templates(id) ON DELETE CASCADE,
    data_set_id UUID REFERENCES api_tests.data_sets(id) ON DELETE SET NULL,
    custom_variables JSONB DEFAULT '{}'::jsonb, -- Override variables for this specific setup
    output_variables JSONB DEFAULT '[]'::jsonb, -- Variables to extract and pass to UI test
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES core.users(id)
);

-- Test data execution history - Track API calls made for test data
CREATE TABLE IF NOT EXISTS api_tests.execution_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setup_id UUID REFERENCES api_tests.test_data_setups(id) ON DELETE SET NULL,
    test_execution_id UUID, -- Links to tests.test_runs if available
    template_id UUID REFERENCES api_tests.data_templates(id) ON DELETE SET NULL,
    request_url VARCHAR(2000),
    request_method VARCHAR(10),
    request_headers JSONB,
    request_body JSONB,
    response_status INTEGER,
    response_headers JSONB,
    response_body JSONB,
    extracted_variables JSONB DEFAULT '{}'::jsonb, -- Values extracted from response
    duration_ms INTEGER,
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_by UUID REFERENCES core.users(id)
);

-- Link test data setups to prompts (UI tests)
CREATE TABLE IF NOT EXISTS api_tests.prompt_data_setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id VARCHAR(255) NOT NULL, -- Links to core.prompts
    setup_id UUID NOT NULL REFERENCES api_tests.test_data_setups(id) ON DELETE CASCADE,
    execution_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_prompt_setup UNIQUE(prompt_id, setup_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_endpoints_project ON api_tests.api_endpoints(project_id);
CREATE INDEX IF NOT EXISTS idx_data_templates_endpoint ON api_tests.data_templates(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_data_templates_category ON api_tests.data_templates(category);
CREATE INDEX IF NOT EXISTS idx_data_sets_template ON api_tests.data_sets(template_id);
CREATE INDEX IF NOT EXISTS idx_test_data_setups_project ON api_tests.test_data_setups(project_id);
CREATE INDEX IF NOT EXISTS idx_execution_history_setup ON api_tests.execution_history(setup_id);
CREATE INDEX IF NOT EXISTS idx_execution_history_executed_at ON api_tests.execution_history(executed_at);
CREATE INDEX IF NOT EXISTS idx_prompt_data_setups_prompt ON api_tests.prompt_data_setups(prompt_id);

-- Add comments for documentation
COMMENT ON TABLE api_tests.api_endpoints IS 'API endpoint configurations for test data creation';
COMMENT ON TABLE api_tests.data_templates IS 'Reusable templates for API requests (e.g., create booking, create user)';
COMMENT ON TABLE api_tests.data_sets IS 'Specific data instances with variable values for templates';
COMMENT ON TABLE api_tests.test_data_setups IS 'Configurations linking templates and data sets for test preparation';
COMMENT ON TABLE api_tests.execution_history IS 'History of API calls made for test data creation';
COMMENT ON TABLE api_tests.prompt_data_setups IS 'Links UI tests (prompts) to their required data setups';

COMMENT ON COLUMN api_tests.api_endpoints.auth_type IS 'Authentication type: none, api_key, bearer, basic, oauth2';
COMMENT ON COLUMN api_tests.data_templates.response_extractors IS 'JSON paths to extract values from response, e.g., [{"name": "booking_id", "path": "$.data.id"}]';
COMMENT ON COLUMN api_tests.data_templates.request_body_template IS 'Request body with placeholders like {{variable_name}}';
