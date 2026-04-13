-- Migration to add missing columns to page_contexts table
-- This fixes the issue where page_contexts was created without all necessary columns

-- Add context_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'repo' 
        AND table_name = 'page_contexts' 
        AND column_name = 'context_type'
    ) THEN
        ALTER TABLE repo.page_contexts 
        ADD COLUMN context_type VARCHAR(100) NOT NULL DEFAULT 'user_uploaded';
        
        RAISE NOTICE 'Added context_type column to page_contexts table';
    END IF;
END $$;

-- Add screenshot_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'repo' 
        AND table_name = 'page_contexts' 
        AND column_name = 'screenshot_url'
    ) THEN
        ALTER TABLE repo.page_contexts 
        ADD COLUMN screenshot_url TEXT;
        
        RAISE NOTICE 'Added screenshot_url column to page_contexts table';
    END IF;
END $$;

-- Add description column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'repo' 
        AND table_name = 'page_contexts' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE repo.page_contexts 
        ADD COLUMN description TEXT;
        
        RAISE NOTICE 'Added description column to page_contexts table';
    END IF;
END $$;

-- Add category column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'repo' 
        AND table_name = 'page_contexts' 
        AND column_name = 'category'
    ) THEN
        ALTER TABLE repo.page_contexts 
        ADD COLUMN category VARCHAR(100);
        
        RAISE NOTICE 'Added category column to page_contexts table';
    END IF;
END $$;

-- Add website_url column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'repo' 
        AND table_name = 'page_contexts' 
        AND column_name = 'website_url'
    ) THEN
        ALTER TABLE repo.page_contexts 
        ADD COLUMN website_url TEXT;
        
        RAISE NOTICE 'Added website_url column to page_contexts table';
    END IF;
END $$;

-- Add primary_actions column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'repo' 
        AND table_name = 'page_contexts' 
        AND column_name = 'primary_actions'
    ) THEN
        ALTER TABLE repo.page_contexts 
        ADD COLUMN primary_actions JSONB DEFAULT '[]';
        
        RAISE NOTICE 'Added primary_actions column to page_contexts table';
    END IF;
END $$;

-- Add usage_count column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'repo' 
        AND table_name = 'page_contexts' 
        AND column_name = 'usage_count'
    ) THEN
        ALTER TABLE repo.page_contexts 
        ADD COLUMN usage_count INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added usage_count column to page_contexts table';
    END IF;
END $$;

-- Add last_used_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'repo' 
        AND table_name = 'page_contexts' 
        AND column_name = 'last_used_at'
    ) THEN
        ALTER TABLE repo.page_contexts 
        ADD COLUMN last_used_at TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE 'Added last_used_at column to page_contexts table';
    END IF;
END $$;

-- Verify the migration
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns 
    WHERE table_schema = 'repo' 
    AND table_name = 'page_contexts'
    AND column_name IN ('context_type', 'screenshot_url', 'description', 'category', 
                        'website_url', 'primary_actions', 'usage_count', 'last_used_at');
    
    RAISE NOTICE 'page_contexts table now has % of 8 expected new columns', col_count;
END $$;
