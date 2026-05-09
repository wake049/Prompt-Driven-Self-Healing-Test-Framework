-- Migration 023: Add platform support to elements and plans
-- Enables cross-platform (Android/iOS) test step variants within a single prompt.

-- 1. Add platform column to repo.elements
--    'android' | 'ios' | 'web' | 'universal'
--    Existing elements default to 'web' for backwards compatibility.
ALTER TABLE repo.elements
ADD COLUMN IF NOT EXISTS platform VARCHAR(20) NOT NULL DEFAULT 'web'
    CHECK (platform IN ('android', 'ios', 'web', 'universal'));

COMMENT ON COLUMN repo.elements.platform IS 'Target platform: android, ios, web, or universal (shared across platforms)';

-- 2. Update the unique constraint to be per-platform
--    The same logical element name can exist for both android and ios on the same page.
--    Drop existing constraint first (if it exists), then recreate.
DO $$
BEGIN
    -- Drop old unique index that doesn't include platform
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_elements_page_name') THEN
        DROP INDEX repo.uq_elements_page_name;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_elements_page_name_platform
    ON repo.elements (page_id, name, platform);

-- 3. Add platform_variants column to planner.plans
--    Stores per-platform step overrides alongside the shared "steps" array.
--    Structure: { "android": [ ...steps ], "ios": [ ...steps ] }
ALTER TABLE planner.plans
ADD COLUMN IF NOT EXISTS platform_variants JSONB DEFAULT NULL;

COMMENT ON COLUMN planner.plans.platform_variants IS 'Per-platform step overrides: { "android": [...steps], "ios": [...steps] }';
