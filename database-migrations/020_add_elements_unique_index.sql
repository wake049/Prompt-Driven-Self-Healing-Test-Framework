-- Add unique index on (page_id, name) to support ON CONFLICT upsert in gather-elements
-- This also deduplicates elements that were previously inserted without the constraint.

-- Step 1: Remove duplicates keeping the newest row per (page_id, name)
DELETE FROM repo.elements
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY page_id, name
            ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST, created_at DESC NULLS LAST
        ) AS rn
        FROM repo.elements
    ) sub
    WHERE rn > 1
);

-- Step 2: Add the unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_elements_page_name
    ON repo.elements (page_id, name);
