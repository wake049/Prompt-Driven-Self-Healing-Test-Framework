-- Migration: Add external_id (Jira/Xray ID) field to prompts and test_cases tables
-- This allows users to assign their own identifiers from Jira or Xray to test cases

-- Add external_id column to planner.prompts table
ALTER TABLE planner.prompts
ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);

-- Add external_id column to tests.test_cases table  
ALTER TABLE tests.test_cases
ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);

-- Create index for faster lookups by external_id
CREATE INDEX IF NOT EXISTS idx_prompts_external_id ON planner.prompts(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_test_cases_external_id ON tests.test_cases(external_id) WHERE external_id IS NOT NULL;

-- Add comment to document the field purpose
COMMENT ON COLUMN planner.prompts.external_id IS 'User-provided external identifier (e.g., Jira ticket ID, Xray test ID)';
COMMENT ON COLUMN tests.test_cases.external_id IS 'User-provided external identifier (e.g., Jira ticket ID, Xray test ID)';
