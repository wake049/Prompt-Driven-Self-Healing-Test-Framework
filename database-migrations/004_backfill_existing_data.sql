-- Backfill Script for Migration 004
-- Purpose: Populate new tables with data from existing tables
-- Run this AFTER running 004_add_collaboration_and_billing_tables.sql

-- =============================================================================
-- 1. BACKFILL ORGANIZATION_MEMBERS
-- Create organization member records for all existing users based on user_tenant_roles
-- =============================================================================

INSERT INTO core.organization_members (
    tenant_id,
    user_id,
    role,
    status,
    invited_by,
    invited_at,
    joined_at,
    last_active_at
)
SELECT DISTINCT
    utr.tenant_id,
    utr.user_id,
    CASE 
        WHEN utr.role IN ('owner', 'admin') THEN 'admin'
        WHEN utr.role = 'member' THEN 'member'
        ELSE 'member'
    END as role,
    'active' as status,
    NULL as invited_by, -- Unknown for existing users
    utr.created_at as invited_at,
    utr.created_at as joined_at, -- Assume immediately joined
    u.last_login_at as last_active_at
FROM core.user_tenant_roles utr
JOIN core.users u ON utr.user_id = u.id
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Mark first user per tenant as owner
WITH first_users AS (
    SELECT DISTINCT ON (tenant_id) 
        tenant_id,
        user_id
    FROM core.organization_members
    ORDER BY tenant_id, invited_at ASC
)
UPDATE core.organization_members om
SET role = 'owner'
FROM first_users fu
WHERE om.tenant_id = fu.tenant_id 
AND om.user_id = fu.user_id;

-- Log backfill results
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM core.organization_members;
    RAISE NOTICE 'Backfilled % organization members', v_count;
END $$;

-- =============================================================================
-- 2. BACKFILL PROJECT_MEMBERS
-- Add all organization members to their organization's projects
-- =============================================================================

INSERT INTO core.project_members (
    project_id,
    user_id,
    role,
    added_at,
    added_by,
    last_access_at
)
SELECT DISTINCT
    p.id as project_id,
    om.user_id,
    CASE 
        WHEN om.role = 'owner' THEN 'admin'
        WHEN om.role = 'admin' THEN 'admin'
        WHEN om.role = 'member' THEN 'developer'
        ELSE 'viewer'
    END as role,
    om.joined_at as added_at,
    NULL as added_by,
    om.last_active_at
FROM core.projects p
JOIN core.organization_members om ON p.tenant_id = om.tenant_id
WHERE om.status = 'active'
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Log backfill results
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM core.project_members;
    RAISE NOTICE 'Backfilled % project members', v_count;
END $$;

-- =============================================================================
-- 3. BACKFILL SUBSCRIPTIONS
-- Create default trial subscriptions for all existing tenants
-- =============================================================================

INSERT INTO core.subscriptions (
    tenant_id,
    plan_tier,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end,
    monthly_test_runs_limit,
    monthly_ai_requests_limit,
    max_projects,
    max_team_members,
    created_at
)
SELECT 
    t.id as tenant_id,
    'professional' as plan_tier, -- Give existing tenants professional tier
    'active' as status, -- Mark as active since they're already using the system
    NOW() + INTERVAL '90 days' as trial_ends_at, -- Extended trial
    NOW() as current_period_start,
    NOW() + INTERVAL '30 days' as current_period_end,
    10000 as monthly_test_runs_limit,
    50000 as monthly_ai_requests_limit,
    25 as max_projects,
    25 as max_team_members,
    t.created_at
FROM core.tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM core.subscriptions s 
    WHERE s.tenant_id = t.id
);

-- Log backfill results
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM core.subscriptions;
    RAISE NOTICE 'Created % subscriptions', v_count;
END $$;

-- =============================================================================
-- 4. BACKFILL USAGE_LOGS (OPTIONAL)
-- Create usage log entries from existing test runs
-- This is optional and can generate a lot of data
-- Uncomment if you want historical usage tracking
-- =============================================================================

/*
INSERT INTO core.usage_logs (
    tenant_id,
    project_id,
    user_id,
    subscription_id,
    event_type,
    ai_provider,
    ai_model,
    tokens_used,
    estimated_cost_cents,
    resource_type,
    resource_id,
    created_at
)
SELECT 
    tr.tenant_id,
    tr.project_id,
    tr.user_id,
    s.id as subscription_id,
    'test_generation' as event_type,
    'openai' as ai_provider, -- Default to openai
    'gpt-4' as ai_model,
    1000 as tokens_used, -- Estimated average
    10 as estimated_cost_cents, -- Rough estimate
    'test_run' as resource_type,
    tr.id as resource_id,
    tr.created_at
FROM exec.test_runs tr
LEFT JOIN core.subscriptions s ON tr.tenant_id = s.tenant_id
WHERE tr.created_at >= NOW() - INTERVAL '90 days' -- Only last 90 days
LIMIT 10000; -- Limit to avoid overwhelming the table

RAISE NOTICE 'Backfilled usage logs from recent test runs';
*/

-- =============================================================================
-- 5. VALIDATION QUERIES
-- Run these to verify the backfill worked correctly
-- =============================================================================

-- Check organization members
DO $$
DECLARE
    v_tenants INTEGER;
    v_members INTEGER;
    v_active INTEGER;
BEGIN
    SELECT COUNT(DISTINCT tenant_id) INTO v_tenants FROM core.organization_members;
    SELECT COUNT(*) INTO v_members FROM core.organization_members;
    SELECT COUNT(*) INTO v_active FROM core.organization_members WHERE status = 'active';
    
    RAISE NOTICE '✓ Organization Members: % tenants, % total members, % active', 
        v_tenants, v_members, v_active;
END $$;

-- Check project members
DO $$
DECLARE
    v_projects INTEGER;
    v_members INTEGER;
BEGIN
    SELECT COUNT(DISTINCT project_id) INTO v_projects FROM core.project_members;
    SELECT COUNT(*) INTO v_members FROM core.project_members;
    
    RAISE NOTICE '✓ Project Members: % projects, % total members', v_projects, v_members;
END $$;

-- Check subscriptions
DO $$
DECLARE
    v_subs INTEGER;
    v_active INTEGER;
    v_trial INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_subs FROM core.subscriptions;
    SELECT COUNT(*) INTO v_active FROM core.subscriptions WHERE status = 'active';
    SELECT COUNT(*) INTO v_trial FROM core.subscriptions WHERE status = 'trial';
    
    RAISE NOTICE '✓ Subscriptions: % total, % active, % trial', v_subs, v_active, v_trial;
END $$;

-- Check for orphaned records
DO $$
DECLARE
    v_orphans INTEGER;
BEGIN
    -- Check for tenants without subscriptions
    SELECT COUNT(*) INTO v_orphans 
    FROM core.tenants t 
    WHERE NOT EXISTS (SELECT 1 FROM core.subscriptions s WHERE s.tenant_id = t.id);
    
    IF v_orphans > 0 THEN
        RAISE WARNING '⚠ Found % tenants without subscriptions', v_orphans;
    ELSE
        RAISE NOTICE '✓ All tenants have subscriptions';
    END IF;
    
    -- Check for projects without members
    SELECT COUNT(*) INTO v_orphans 
    FROM core.projects p 
    WHERE NOT EXISTS (SELECT 1 FROM core.project_members pm WHERE pm.project_id = p.id);
    
    IF v_orphans > 0 THEN
        RAISE WARNING '⚠ Found % projects without members', v_orphans;
    ELSE
        RAISE NOTICE '✓ All projects have members';
    END IF;
END $$;

-- Display summary statistics
SELECT 
    'Organization Members' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT tenant_id) as unique_tenants,
    COUNT(DISTINCT user_id) as unique_users
FROM core.organization_members
UNION ALL
SELECT 
    'Project Members' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT project_id) as unique_projects,
    COUNT(DISTINCT user_id) as unique_users
FROM core.project_members
UNION ALL
SELECT 
    'Subscriptions' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT tenant_id) as unique_tenants,
    NULL as unique_users
FROM core.subscriptions
UNION ALL
SELECT 
    'Usage Logs' as table_name,
    COUNT(*) as total_rows,
    COUNT(DISTINCT tenant_id) as unique_tenants,
    COUNT(DISTINCT user_id) as unique_users
FROM core.usage_logs;

-- =============================================================================
-- BACKFILL COMPLETE
-- =============================================================================

RAISE NOTICE '========================================';
RAISE NOTICE 'Backfill completed successfully!';
RAISE NOTICE '========================================';
