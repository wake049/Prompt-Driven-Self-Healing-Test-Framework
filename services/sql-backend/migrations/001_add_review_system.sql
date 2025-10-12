-- Review System Migration
-- Adds tables and logic for handling element locator changes and reviews

-- Create review_queue table for elements that need manual review
CREATE TABLE IF NOT EXISTS review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_identifier VARCHAR(255) NOT NULL, -- logical_key or element_id
    page VARCHAR(500) NOT NULL,
    issue_type VARCHAR(50) NOT NULL, -- 'locator_change', 'duplicate', 'validation_failed'
    description TEXT,
    current_element_id UUID REFERENCES recorded_elements(id),
    conflicting_element_id UUID REFERENCES recorded_elements(id),
    current_selectors JSONB DEFAULT '[]',
    suggested_selectors JSONB DEFAULT '[]',
    identity_data JSONB DEFAULT '{}',
    logical_key VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'merged'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT
);

-- Add indexes for performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(status);
CREATE INDEX IF NOT EXISTS idx_review_queue_page ON review_queue(page);
CREATE INDEX IF NOT EXISTS idx_review_queue_logical_key ON review_queue(logical_key);
CREATE INDEX IF NOT EXISTS idx_review_queue_created_at ON review_queue(created_at);

-- Add logical_key and identity columns to recorded_elements if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recorded_elements' AND column_name='logical_key') THEN
        ALTER TABLE recorded_elements ADD COLUMN logical_key VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recorded_elements' AND column_name='identity_data') THEN
        ALTER TABLE recorded_elements ADD COLUMN identity_data JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='recorded_elements' AND column_name='recorder') THEN
        ALTER TABLE recorded_elements ADD COLUMN recorder VARCHAR(50) DEFAULT 'extension';
    END IF;
END $$;

-- Add index for logical_key
CREATE INDEX IF NOT EXISTS idx_recorded_elements_logical_key ON recorded_elements(logical_key);

-- Create trigger for review_queue (drop first if exists)
DROP TRIGGER IF EXISTS update_review_queue_updated_at ON review_queue;
CREATE TRIGGER update_review_queue_updated_at 
    BEFORE UPDATE ON review_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE review_queue IS 'Queue for reviewing element locator changes and conflicts';
COMMENT ON COLUMN review_queue.logical_key IS 'Unique identifier for element based on its semantic identity';
COMMENT ON COLUMN review_queue.issue_type IS 'Type of issue: locator_change, duplicate, validation_failed';