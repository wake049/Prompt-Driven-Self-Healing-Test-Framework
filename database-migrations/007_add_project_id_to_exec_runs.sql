-- Migration: Add project_id to exec.runs and backfill from test_cases
-- This ensures exec.runs can be filtered by project without requiring joins

-- Step 1: Add project_id column to exec.runs
ALTER TABLE exec.runs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES core.projects(id);

-- Step 2: Backfill project_id from test_cases
UPDATE exec.runs r
SET project_id = tc.project_id
FROM tests.test_cases tc
WHERE r.test_case_id = tc.id
  AND r.project_id IS NULL;

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_exec_runs_project_id ON exec.runs(project_id);
CREATE INDEX IF NOT EXISTS idx_exec_runs_started_at ON exec.runs(started_at);
CREATE INDEX IF NOT EXISTS idx_exec_runs_project_status ON exec.runs(project_id, status);

-- Step 4: Add comment for documentation
COMMENT ON COLUMN exec.runs.project_id IS 'Denormalized project_id for efficient filtering. Backfilled from test_cases.project_id';

-- Verification query (commented out)
-- SELECT 
--     COUNT(*) as total_runs,
--     COUNT(project_id) as runs_with_project,
--     COUNT(*) - COUNT(project_id) as runs_without_project
-- FROM exec.runs;
