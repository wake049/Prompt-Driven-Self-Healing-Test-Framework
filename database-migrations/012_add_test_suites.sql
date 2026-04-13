-- Create test suites table for organizing tests with browser configurations
CREATE TABLE IF NOT EXISTS tests.test_suites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    browser_config JSONB DEFAULT '{"browsers": ["chrome"]}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES core.users(id),
    CONSTRAINT unique_suite_name_per_project UNIQUE(project_id, name)
);

-- Add suite_id column to test_cases table
ALTER TABLE tests.test_cases 
ADD COLUMN IF NOT EXISTS suite_id UUID REFERENCES tests.test_suites(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_test_cases_suite_id ON tests.test_cases(suite_id);
CREATE INDEX IF NOT EXISTS idx_test_suites_project_id ON tests.test_suites(project_id);

-- Add browser_config to test_cases for individual test overrides
ALTER TABLE tests.test_cases 
ADD COLUMN IF NOT EXISTS browser_config JSONB;

COMMENT ON TABLE tests.test_suites IS 'Test suites for organizing test cases with shared browser configurations';
COMMENT ON COLUMN tests.test_suites.browser_config IS 'Browser configuration: {"browsers": ["chrome", "firefox", "edge"]}';
COMMENT ON COLUMN tests.test_cases.browser_config IS 'Optional browser override for individual test cases';
