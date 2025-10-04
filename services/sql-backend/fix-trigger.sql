-- Fix the trigger issue for recorded_elements table
-- Run this to fix the "updated_at" field error

-- Drop the incorrect trigger
DROP TRIGGER IF EXISTS update_recorded_elements_updated_at ON recorded_elements;

-- Create the correct trigger function for last_updated
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the correct trigger
CREATE TRIGGER update_recorded_elements_last_updated 
    BEFORE UPDATE ON recorded_elements 
    FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

-- Test that the fix works
SELECT 'Trigger fix applied successfully' as status;