-- Add organization-specific columns to core.tenants table
-- This consolidates organization data into the tenants table to avoid duplication

-- Add new columns if they don't exist (safe for existing databases)
ALTER TABLE core.tenants 
    ADD COLUMN IF NOT EXISTS industry VARCHAR(100),
    ADD COLUMN IF NOT EXISTS company_size VARCHAR(50),
    ADD COLUMN IF NOT EXISTS website VARCHAR(255),
    ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

-- Add comments explaining the consolidated design
COMMENT ON TABLE core.tenants IS 'Multi-tenancy and organization details consolidated in one table';
COMMENT ON COLUMN core.tenants.industry IS 'Industry/sector of the organization';
COMMENT ON COLUMN core.tenants.company_size IS 'Size of the company (e.g., 1-10, 11-50, 51-200, etc.)';
COMMENT ON COLUMN core.tenants.website IS 'Organization website URL';
COMMENT ON COLUMN core.tenants.logo_url IS 'URL to organization logo image';
