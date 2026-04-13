-- Migration 004: Add Team Collaboration and Billing Tables
-- Date: 2026-02-02
-- Description: Adds missing tables for organization members, project members, 
--              subscriptions, AI provider configs, and usage tracking

-- =============================================================================
-- 1. ORGANIZATION MEMBERS TABLE
-- Purpose: Track organization membership, invitations, and member status
-- =============================================================================

CREATE TABLE core.organization_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    status VARCHAR(50) NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended', 'deactivated')),
    invited_by uuid REFERENCES core.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMP NOT NULL DEFAULT NOW(),
    joined_at TIMESTAMP,
    last_active_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- Indexes for organization_members
CREATE INDEX idx_org_members_tenant ON core.organization_members(tenant_id);
CREATE INDEX idx_org_members_user ON core.organization_members(user_id);
CREATE INDEX idx_org_members_status ON core.organization_members(status);
CREATE INDEX idx_org_members_role ON core.organization_members(role);

-- Comments for organization_members
COMMENT ON TABLE core.organization_members IS 'Tracks organization membership with invitation flow and status management';
COMMENT ON COLUMN core.organization_members.role IS 'Member role: owner (full control), admin (manage members), member (regular access), viewer (read-only)';
COMMENT ON COLUMN core.organization_members.status IS 'Member status: invited (pending), active (accepted), suspended (temporarily disabled), deactivated (removed)';

-- =============================================================================
-- 2. PROJECT MEMBERS TABLE
-- Purpose: Control project-level access and roles
-- =============================================================================

CREATE TABLE core.project_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'developer', 'tester', 'viewer')),
    permissions JSONB DEFAULT '{}',
    added_at TIMESTAMP NOT NULL DEFAULT NOW(),
    added_by uuid REFERENCES core.users(id) ON DELETE SET NULL,
    last_access_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

-- Indexes for project_members
CREATE INDEX idx_project_members_project ON core.project_members(project_id);
CREATE INDEX idx_project_members_user ON core.project_members(user_id);
CREATE INDEX idx_project_members_role ON core.project_members(role);

-- Comments for project_members
COMMENT ON TABLE core.project_members IS 'Manages project-level access control and member roles';
COMMENT ON COLUMN core.project_members.role IS 'Project role: admin (full project control), developer (create/edit tests), tester (execute tests), viewer (read-only)';
COMMENT ON COLUMN core.project_members.permissions IS 'Custom permissions JSON for fine-grained access control';

-- =============================================================================
-- 3. SUBSCRIPTIONS TABLE
-- Purpose: Track billing plans and subscription status
-- =============================================================================

CREATE TABLE core.subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    plan_tier VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('free', 'starter', 'professional', 'enterprise', 'custom')),
    billing_interval VARCHAR(50) CHECK (billing_interval IN ('monthly', 'yearly')),
    stripe_subscription_id VARCHAR(100) UNIQUE,
    stripe_customer_id VARCHAR(100),
    stripe_price_id VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete')),
    trial_ends_at TIMESTAMP,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    
    -- Quotas and limits
    monthly_test_runs_limit INTEGER,
    monthly_ai_requests_limit INTEGER,
    max_projects INTEGER,
    max_team_members INTEGER,
    
    -- Pricing
    amount_cents INTEGER,
    currency VARCHAR(3) DEFAULT 'USD',
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for subscriptions
CREATE INDEX idx_subscriptions_tenant ON core.subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_stripe_sub ON core.subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_stripe_customer ON core.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON core.subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON core.subscriptions(current_period_end);

-- Comments for subscriptions
COMMENT ON TABLE core.subscriptions IS 'Tracks subscription plans, billing status, and usage quotas';
COMMENT ON COLUMN core.subscriptions.plan_tier IS 'Subscription tier: free, starter, professional, enterprise, custom';
COMMENT ON COLUMN core.subscriptions.status IS 'Stripe subscription status: trial, active, past_due, canceled, unpaid, incomplete';
COMMENT ON COLUMN core.subscriptions.cancel_at_period_end IS 'If true, subscription will cancel at end of current period';

-- =============================================================================
-- 4. AI PROVIDER CONFIGS TABLE
-- Purpose: Store BYOK (Bring Your Own Key) AI provider configurations
-- =============================================================================

CREATE TABLE core.ai_provider_configs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'ollama', 'custom')),
    provider_name VARCHAR(100),
    
    -- Encrypted credentials
    api_key_encrypted TEXT,
    api_key_last_4 VARCHAR(4),
    
    -- Configuration
    endpoint_url TEXT,
    model VARCHAR(100),
    model_version VARCHAR(50),
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    last_verified_at TIMESTAMP,
    
    -- Usage tracking
    total_requests INTEGER DEFAULT 0,
    total_tokens_used BIGINT DEFAULT 0,
    last_used_at TIMESTAMP,
    
    config_options JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by uuid REFERENCES core.users(id) ON DELETE SET NULL,
    
    UNIQUE(tenant_id, provider, provider_name)
);

-- Indexes for ai_provider_configs
CREATE INDEX idx_ai_configs_tenant ON core.ai_provider_configs(tenant_id);
CREATE INDEX idx_ai_configs_provider ON core.ai_provider_configs(provider);
CREATE INDEX idx_ai_configs_active ON core.ai_provider_configs(is_active);
CREATE INDEX idx_ai_configs_default ON core.ai_provider_configs(tenant_id, is_default) WHERE is_default = true;

-- Comments for ai_provider_configs
COMMENT ON TABLE core.ai_provider_configs IS 'Stores tenant-specific AI provider configurations for BYOK (Bring Your Own Key)';
COMMENT ON COLUMN core.ai_provider_configs.api_key_encrypted IS 'Encrypted API key using application-level encryption';
COMMENT ON COLUMN core.ai_provider_configs.is_default IS 'If true, this is the default provider for the tenant';

-- =============================================================================
-- 5. USAGE LOGS TABLE
-- Purpose: Track AI usage for metered billing and cost optimization
-- =============================================================================

CREATE TABLE core.usage_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    project_id uuid REFERENCES core.projects(id) ON DELETE SET NULL,
    user_id uuid REFERENCES core.users(id) ON DELETE SET NULL,
    subscription_id uuid REFERENCES core.subscriptions(id) ON DELETE SET NULL,
    
    -- Event details
    event_type VARCHAR(100) NOT NULL CHECK (event_type IN (
        'test_generation', 'test_healing', 'element_detection', 
        'page_analysis', 'code_generation', 'validation',
        'chat_completion', 'embedding', 'other'
    )),
    event_subtype VARCHAR(100),
    
    -- AI provider details
    ai_provider VARCHAR(50),
    ai_model VARCHAR(100),
    provider_config_id uuid REFERENCES core.ai_provider_configs(id) ON DELETE SET NULL,
    
    -- Usage metrics
    tokens_used INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    
    -- Cost tracking
    estimated_cost_cents INTEGER,
    estimated_cost_currency VARCHAR(3) DEFAULT 'USD',
    
    -- Performance metrics
    latency_ms INTEGER,
    response_status VARCHAR(50),
    
    -- Context
    resource_type VARCHAR(50), -- 'test_plan', 'test_case', 'healing_suggestion', etc.
    resource_id uuid,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Partition usage_logs by month for better performance
-- Note: This is a comment for future implementation if needed
-- ALTER TABLE core.usage_logs PARTITION BY RANGE (created_at);

-- Indexes for usage_logs
CREATE INDEX idx_usage_tenant ON core.usage_logs(tenant_id);
CREATE INDEX idx_usage_project ON core.usage_logs(project_id);
CREATE INDEX idx_usage_user ON core.usage_logs(user_id);
CREATE INDEX idx_usage_subscription ON core.usage_logs(subscription_id);
CREATE INDEX idx_usage_created ON core.usage_logs(created_at DESC);
CREATE INDEX idx_usage_event_type ON core.usage_logs(event_type);
CREATE INDEX idx_usage_provider ON core.usage_logs(ai_provider);
CREATE INDEX idx_usage_tenant_month ON core.usage_logs(tenant_id, created_at DESC);

-- Comments for usage_logs
COMMENT ON TABLE core.usage_logs IS 'Tracks AI usage events for billing, analytics, and cost optimization';
COMMENT ON COLUMN core.usage_logs.event_type IS 'Type of AI operation: test_generation, test_healing, element_detection, etc.';
COMMENT ON COLUMN core.usage_logs.estimated_cost_cents IS 'Estimated cost in cents based on provider pricing';

-- =============================================================================
-- 6. VIEWS FOR EASIER QUERYING
-- =============================================================================

-- View: Active organization members
CREATE OR REPLACE VIEW core.v_active_org_members AS
SELECT 
    om.*,
    u.email,
    u.full_name,
    u.avatar_url,
    t.name as tenant_name,
    t.slug as tenant_slug
FROM core.organization_members om
JOIN core.users u ON om.user_id = u.id
JOIN core.tenants t ON om.tenant_id = t.id
WHERE om.status = 'active';

-- View: Active project members with details
CREATE OR REPLACE VIEW core.v_active_project_members AS
SELECT 
    pm.*,
    u.email,
    u.full_name,
    u.avatar_url,
    p.name as project_name,
    p.slug as project_slug,
    p.tenant_id
FROM core.project_members pm
JOIN core.users u ON pm.user_id = u.id
JOIN core.projects p ON pm.project_id = p.id;

-- View: Current subscriptions with tenant details
CREATE OR REPLACE VIEW core.v_current_subscriptions AS
SELECT 
    s.*,
    t.name as tenant_name,
    t.slug as tenant_slug,
    CASE 
        WHEN s.status = 'trial' THEN s.trial_ends_at
        ELSE s.current_period_end
    END as expires_at,
    CASE 
        WHEN s.status = 'trial' AND s.trial_ends_at < NOW() THEN true
        WHEN s.current_period_end < NOW() THEN true
        ELSE false
    END as is_expired
FROM core.subscriptions s
JOIN core.tenants t ON s.tenant_id = t.id;

-- View: Monthly usage summary per tenant
CREATE OR REPLACE VIEW analytics.v_monthly_usage_summary AS
SELECT 
    tenant_id,
    DATE_TRUNC('month', created_at) as month,
    event_type,
    ai_provider,
    COUNT(*) as event_count,
    SUM(tokens_used) as total_tokens,
    SUM(estimated_cost_cents) as total_cost_cents,
    AVG(latency_ms) as avg_latency_ms
FROM core.usage_logs
GROUP BY tenant_id, DATE_TRUNC('month', created_at), event_type, ai_provider;

-- =============================================================================
-- 7. TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =============================================================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION core.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON core.organization_members
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at_column();

CREATE TRIGGER update_project_members_updated_at BEFORE UPDATE ON core.project_members
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON core.subscriptions
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at_column();

CREATE TRIGGER update_ai_provider_configs_updated_at BEFORE UPDATE ON core.ai_provider_configs
    FOR EACH ROW EXECUTE FUNCTION core.update_updated_at_column();

-- =============================================================================
-- 8. HELPER FUNCTIONS
-- =============================================================================

-- Function: Check if user has organization access
CREATE OR REPLACE FUNCTION core.user_has_org_access(
    p_user_id uuid,
    p_tenant_id uuid
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM core.organization_members
        WHERE user_id = p_user_id 
        AND tenant_id = p_tenant_id
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Check if user has project access
CREATE OR REPLACE FUNCTION core.user_has_project_access(
    p_user_id uuid,
    p_project_id uuid
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM core.project_members
        WHERE user_id = p_user_id 
        AND project_id = p_project_id
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Get user's role in organization
CREATE OR REPLACE FUNCTION core.get_user_org_role(
    p_user_id uuid,
    p_tenant_id uuid
) RETURNS VARCHAR AS $$
DECLARE
    v_role VARCHAR(50);
BEGIN
    SELECT role INTO v_role
    FROM core.organization_members
    WHERE user_id = p_user_id 
    AND tenant_id = p_tenant_id
    AND status = 'active';
    
    RETURN v_role;
END;
$$ LANGUAGE plpgsql;

-- Function: Get active subscription for tenant
CREATE OR REPLACE FUNCTION core.get_active_subscription(
    p_tenant_id uuid
) RETURNS core.subscriptions AS $$
DECLARE
    v_subscription core.subscriptions;
BEGIN
    SELECT * INTO v_subscription
    FROM core.subscriptions
    WHERE tenant_id = p_tenant_id
    AND status IN ('trial', 'active')
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN v_subscription;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if tenant has reached usage limit
CREATE OR REPLACE FUNCTION core.has_exceeded_usage_limit(
    p_tenant_id uuid,
    p_limit_type VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_subscription core.subscriptions;
    v_current_usage INTEGER;
BEGIN
    -- Get active subscription
    SELECT * INTO v_subscription
    FROM core.subscriptions
    WHERE tenant_id = p_tenant_id
    AND status IN ('trial', 'active')
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_subscription IS NULL THEN
        RETURN true; -- No subscription = exceeded
    END IF;
    
    -- Check specific limit type
    IF p_limit_type = 'test_runs' THEN
        SELECT COUNT(*) INTO v_current_usage
        FROM exec.test_runs
        WHERE tenant_id = p_tenant_id
        AND created_at >= DATE_TRUNC('month', NOW());
        
        RETURN v_current_usage >= COALESCE(v_subscription.monthly_test_runs_limit, 999999);
        
    ELSIF p_limit_type = 'ai_requests' THEN
        SELECT COUNT(*) INTO v_current_usage
        FROM core.usage_logs
        WHERE tenant_id = p_tenant_id
        AND created_at >= DATE_TRUNC('month', NOW());
        
        RETURN v_current_usage >= COALESCE(v_subscription.monthly_ai_requests_limit, 999999);
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. SAMPLE DATA FUNCTIONS (for testing)
-- =============================================================================

-- Function: Create default subscription for tenant
CREATE OR REPLACE FUNCTION core.create_default_subscription(
    p_tenant_id uuid,
    p_plan_tier VARCHAR DEFAULT 'starter'
) RETURNS uuid AS $$
DECLARE
    v_subscription_id uuid;
BEGIN
    INSERT INTO core.subscriptions (
        tenant_id,
        plan_tier,
        status,
        trial_ends_at,
        monthly_test_runs_limit,
        monthly_ai_requests_limit,
        max_projects,
        max_team_members
    ) VALUES (
        p_tenant_id,
        p_plan_tier,
        'trial',
        NOW() + INTERVAL '14 days',
        CASE p_plan_tier
            WHEN 'free' THEN 100
            WHEN 'starter' THEN 1000
            WHEN 'professional' THEN 10000
            WHEN 'enterprise' THEN NULL
            ELSE 1000
        END,
        CASE p_plan_tier
            WHEN 'free' THEN 500
            WHEN 'starter' THEN 5000
            WHEN 'professional' THEN 50000
            WHEN 'enterprise' THEN NULL
            ELSE 5000
        END,
        CASE p_plan_tier
            WHEN 'free' THEN 1
            WHEN 'starter' THEN 5
            WHEN 'professional' THEN 25
            WHEN 'enterprise' THEN NULL
            ELSE 5
        END,
        CASE p_plan_tier
            WHEN 'free' THEN 1
            WHEN 'starter' THEN 5
            WHEN 'professional' THEN 25
            WHEN 'enterprise' THEN NULL
            ELSE 5
        END
    ) RETURNING id INTO v_subscription_id;
    
    RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Add migration tracking
INSERT INTO core.schema_migrations (version, description, applied_at)
VALUES ('004', 'Add collaboration and billing tables', NOW())
ON CONFLICT DO NOTHING;

COMMENT ON SCHEMA core IS 'Core schema updated with organization_members, project_members, subscriptions, ai_provider_configs, and usage_logs tables';
