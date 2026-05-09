-- Migration 022: Add test_type column to planner.prompts
-- Allows prompts to indicate whether they target web or native app / desktop testing.
-- When test_type is 'app', the starting_url field is not applicable.

ALTER TABLE planner.prompts
ADD COLUMN IF NOT EXISTS test_type VARCHAR(20) NOT NULL DEFAULT 'web'
    CHECK (test_type IN ('web', 'app'));

COMMENT ON COLUMN planner.prompts.test_type IS 'Testing target: web (browser with starting URL) or app (native app / desktop via Appium)';
