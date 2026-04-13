-- Migration 006: Add project_id to policy_decisions table
-- Adds project_id column to policy_decisions for better tracking and filtering

-- Add project_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'policy' 
        AND table_name = 'policy_decisions' 
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE policy.policy_decisions 
        ADD COLUMN project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE;
        
        -- Add index for better query performance
        CREATE INDEX idx_policy_decisions_project_id ON policy.policy_decisions(project_id);
    END IF;
END $$;
