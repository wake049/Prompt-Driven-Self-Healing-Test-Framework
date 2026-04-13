-- Migration: Add browser_type column to execution tracking tables
-- Part of Multi-Browser Support feature (Phase 2 Enhancement)

-- Add browser_type to exec.runs table
ALTER TABLE exec.runs 
ADD COLUMN IF NOT EXISTS browser_type VARCHAR(50) DEFAULT 'chrome';

-- Add comment to document the new column
COMMENT ON COLUMN exec.runs.browser_type IS 'Browser type used for test execution: chrome, firefox, edge, safari';

-- Add index for browser_type queries
CREATE INDEX IF NOT EXISTS idx_runs_browser_type ON exec.runs(browser_type);

-- Create a view for browser usage statistics
CREATE OR REPLACE VIEW exec.browser_usage_stats AS
SELECT 
    browser_type,
    COUNT(*) as total_executions,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_executions,
    ROUND(
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric / 
        NULLIF(COUNT(*), 0) * 100, 
        2
    ) as success_rate,
    AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) as avg_duration_seconds
FROM exec.runs
WHERE browser_type IS NOT NULL
GROUP BY browser_type;

COMMENT ON VIEW exec.browser_usage_stats IS 'Statistics on test execution performance across different browsers';
