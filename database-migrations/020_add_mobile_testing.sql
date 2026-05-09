-- Migration: Add mobile testing support
-- Extends execution tracking with device profiles and mobile emulation capabilities

-- Add device_config column to exec.runs for mobile device emulation settings
ALTER TABLE exec.runs
ADD COLUMN IF NOT EXISTS device_config JSONB DEFAULT NULL;

COMMENT ON COLUMN exec.runs.device_config IS 'Mobile device emulation config: {"device_name": "iPhone 14", "width": 390, "height": 844, "device_scale_factor": 3, "user_agent": "...", "is_mobile": true}';

-- Create table for reusable device profiles
CREATE TABLE IF NOT EXISTS exec.device_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    profile_name VARCHAR(100) NOT NULL,
    device_type VARCHAR(20) NOT NULL DEFAULT 'mobile',
    device_name VARCHAR(100) NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    device_scale_factor NUMERIC(3,1) NOT NULL DEFAULT 2.0,
    user_agent TEXT NOT NULL,
    is_mobile BOOLEAN NOT NULL DEFAULT true,
    has_touch BOOLEAN NOT NULL DEFAULT true,
    is_landscape BOOLEAN NOT NULL DEFAULT false,
    is_builtin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_device_type CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
    CONSTRAINT uq_device_profile_org_name UNIQUE (organization_id, profile_name)
);

COMMENT ON TABLE exec.device_profiles IS 'Reusable mobile/tablet device profiles for responsive test execution';

-- Index for org-scoped queries
CREATE INDEX IF NOT EXISTS idx_device_profiles_org ON exec.device_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_device_profiles_type ON exec.device_profiles(device_type);

-- Seed built-in device profiles (available to all orgs, org_id = all-zeros sentinel)
INSERT INTO exec.device_profiles (organization_id, profile_name, device_type, device_name, width, height, device_scale_factor, user_agent, is_mobile, has_touch, is_landscape, is_builtin)
VALUES
    -- Popular phones
    ('00000000-0000-0000-0000-000000000000', 'iPhone 14', 'mobile', 'iPhone 14', 390, 844, 3.0,
     'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
     true, true, false, true),

    ('00000000-0000-0000-0000-000000000000', 'iPhone 14 Pro Max', 'mobile', 'iPhone 14 Pro Max', 430, 932, 3.0,
     'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
     true, true, false, true),

    ('00000000-0000-0000-0000-000000000000', 'iPhone SE', 'mobile', 'iPhone SE', 375, 667, 2.0,
     'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
     true, true, false, true),

    ('00000000-0000-0000-0000-000000000000', 'Samsung Galaxy S23', 'mobile', 'Samsung Galaxy S23', 360, 780, 3.0,
     'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
     true, true, false, true),

    ('00000000-0000-0000-0000-000000000000', 'Samsung Galaxy S23 Ultra', 'mobile', 'Samsung Galaxy S23 Ultra', 384, 824, 3.0,
     'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
     true, true, false, true),

    ('00000000-0000-0000-0000-000000000000', 'Pixel 7', 'mobile', 'Google Pixel 7', 412, 915, 2.625,
     'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
     true, true, false, true),

    -- Tablets
    ('00000000-0000-0000-0000-000000000000', 'iPad Air', 'tablet', 'iPad Air', 820, 1180, 2.0,
     'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
     true, true, false, true),

    ('00000000-0000-0000-0000-000000000000', 'iPad Pro 12.9', 'tablet', 'iPad Pro 12.9', 1024, 1366, 2.0,
     'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
     true, true, false, true),

    ('00000000-0000-0000-0000-000000000000', 'Samsung Galaxy Tab S9', 'tablet', 'Samsung Galaxy Tab S9', 800, 1280, 2.0,
     'Mozilla/5.0 (Linux; Android 14; SM-X710B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
     true, true, false, true)
ON CONFLICT (organization_id, profile_name) DO NOTHING;

-- Update the browser_usage_stats view to include device info
DROP VIEW IF EXISTS exec.browser_usage_stats;
CREATE VIEW exec.browser_usage_stats AS
SELECT
    browser_type,
    device_config->>'device_name' AS device_name,
    CASE WHEN device_config IS NOT NULL THEN 'mobile' ELSE 'desktop' END AS execution_mode,
    COUNT(*) AS total_executions,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) AS successful_executions,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_executions,
    ROUND(
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric /
        NULLIF(COUNT(*), 0) * 100,
        2
    ) AS success_rate,
    AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) AS avg_duration_seconds
FROM exec.runs
WHERE browser_type IS NOT NULL
GROUP BY browser_type, device_config->>'device_name',
         CASE WHEN device_config IS NOT NULL THEN 'mobile' ELSE 'desktop' END;

COMMENT ON VIEW exec.browser_usage_stats IS 'Statistics on test execution performance across browsers and device profiles';

-- Add device_config to runner capabilities to support mobile-capable runners
-- Runner capabilities already stored as JSONB array, no schema change needed —
-- runners register with capabilities like ["chrome", "chrome-mobile", "firefox"]
