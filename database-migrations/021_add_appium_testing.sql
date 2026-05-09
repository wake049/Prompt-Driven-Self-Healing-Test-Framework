-- ============================================================================
-- Migration 021: Appium Testing Support
-- Adds configuration storage for Appium-based testing across all platforms:
--   Android Web, iOS Web, Android Native, iOS Native, Flutter, Windows, Mac
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Appium configurations table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exec.appium_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name            VARCHAR(200) NOT NULL,
    -- android-web | ios-web | android-native | ios-native | flutter | windows | mac
    config_type     VARCHAR(50)  NOT NULL,

    -- Appium server connection
    appium_server_url VARCHAR(500) NOT NULL DEFAULT 'http://localhost:4723',

    -- Platform capabilities
    platform_name   VARCHAR(50),    -- Android, iOS, Windows, Mac
    platform_version VARCHAR(50),   -- e.g. "14", "17.0"
    device_name     VARCHAR(200),   -- e.g. "Pixel 7", "iPhone 14 Simulator"
    automation_name VARCHAR(100),   -- UiAutomator2, XCUITest, Flutter, Windows, Mac2

    -- App configuration (native / hybrid / flutter)
    app_path        VARCHAR(1000), -- Local path or URL to APK/IPA/EXE
    app_package     VARCHAR(500),  -- Android package name
    app_activity    VARCHAR(500),  -- Android launch activity
    bundle_id       VARCHAR(500),  -- iOS bundle identifier

    -- Browser configuration (mobile web)
    browser_name    VARCHAR(50),   -- Chrome, Safari

    -- Cloud provider (optional)
    cloud_provider  VARCHAR(50),   -- browserstack, saucelabs, local
    cloud_username  VARCHAR(200),
    cloud_access_key VARCHAR(500),

    -- Catch-all for extra desired capabilities
    extra_capabilities JSONB DEFAULT '{}',

    is_default      BOOLEAN     DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_appium_config_type CHECK (config_type IN (
        'android-web', 'ios-web', 'android-native', 'ios-native',
        'flutter', 'windows', 'mac'
    ))
);

CREATE INDEX IF NOT EXISTS idx_appium_configs_org
    ON exec.appium_configs (organization_id);
CREATE INDEX IF NOT EXISTS idx_appium_configs_type
    ON exec.appium_configs (config_type);

-- ---------------------------------------------------------------------------
-- 2. Add appium_config_id to execution runs
-- ---------------------------------------------------------------------------
ALTER TABLE exec.runs
    ADD COLUMN IF NOT EXISTS appium_config_id UUID REFERENCES exec.appium_configs(id);

-- ---------------------------------------------------------------------------
-- 3. Seed built-in starter configurations (org = all-zeros sentinel)
-- ---------------------------------------------------------------------------
INSERT INTO exec.appium_configs (
    organization_id, name, config_type, appium_server_url,
    platform_name, automation_name, device_name, platform_version,
    browser_name, app_path, app_package, app_activity, bundle_id,
    is_default
) VALUES
-- Android Web
('00000000-0000-0000-0000-000000000000', 'Android Chrome (Default)',
 'android-web', 'http://localhost:4723',
 'Android', 'UiAutomator2', 'Android Emulator', '14',
 'Chrome', NULL, NULL, NULL, NULL, true),

-- iOS Web
('00000000-0000-0000-0000-000000000000', 'iOS Safari (Default)',
 'ios-web', 'http://localhost:4723',
 'iOS', 'XCUITest', 'iPhone 15 Simulator', '17.0',
 'Safari', NULL, NULL, NULL, NULL, true),

-- Android Native
('00000000-0000-0000-0000-000000000000', 'Android Native App (Template)',
 'android-native', 'http://localhost:4723',
 'Android', 'UiAutomator2', 'Android Emulator', '14',
 NULL, '/path/to/app.apk', 'com.example.app', '.MainActivity', NULL, false),

-- iOS Native
('00000000-0000-0000-0000-000000000000', 'iOS Native App (Template)',
 'ios-native', 'http://localhost:4723',
 'iOS', 'XCUITest', 'iPhone 15 Simulator', '17.0',
 NULL, '/path/to/app.ipa', NULL, NULL, 'com.example.app', false),

-- Flutter
('00000000-0000-0000-0000-000000000000', 'Flutter App (Template)',
 'flutter', 'http://localhost:4723',
 'Android', 'Flutter', 'Android Emulator', '14',
 NULL, '/path/to/app.apk', 'com.example.flutter', '.MainActivity', NULL, false),

-- Windows Desktop
('00000000-0000-0000-0000-000000000000', 'Windows Desktop (Template)',
 'windows', 'http://localhost:4723',
 'Windows', 'Windows', 'WindowsPC', '10',
 NULL, 'C:\\path\\to\\app.exe', NULL, NULL, NULL, false),

-- Mac Desktop
('00000000-0000-0000-0000-000000000000', 'Mac Desktop (Template)',
 'mac', 'http://localhost:4723',
 'Mac', 'Mac2', 'Mac', '14',
 NULL, '/path/to/app', NULL, NULL, NULL, false)

ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Update browser_usage_stats view to include Appium types
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS exec.browser_usage_stats;
CREATE VIEW exec.browser_usage_stats AS
SELECT
    browser_type,
    CASE
        WHEN browser_type IN ('chrome-mobile', 'chrome-tablet') THEN 'emulation'
        WHEN browser_type LIKE 'appium-%' THEN 'appium'
        ELSE 'desktop'
    END AS execution_category,
    COUNT(*)                                  AS total_runs,
    COUNT(*) FILTER (WHERE status = 'completed') AS passed,
    COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
    MIN(created_at)                           AS first_run,
    MAX(created_at)                           AS last_run
FROM exec.runs
GROUP BY browser_type;

COMMIT;
