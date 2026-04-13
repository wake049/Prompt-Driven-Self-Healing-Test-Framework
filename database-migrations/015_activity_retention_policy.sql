-- Migration: Activity Retention Policy
-- Purpose: Manage storage for activity logs at scale
-- 
-- Strategy Options:
-- 1. Time-based cleanup (default: 60 days for basic, 180 days for pro, unlimited for enterprise)
-- 2. Aggregation: Compress old detailed records into daily summaries
-- 3. Export before delete for compliance

-- =============================================================================
-- RETENTION SETTINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS planner.activity_retention_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id),
    retention_days INTEGER NOT NULL DEFAULT 60,  -- How long to keep detailed activity
    aggregate_after_days INTEGER DEFAULT 30,     -- When to aggregate into summaries
    export_before_delete BOOLEAN DEFAULT false,  -- Export to S3/blob before cleanup
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Default retention tiers based on subscription
COMMENT ON TABLE planner.activity_retention_settings IS 
'Per-tenant activity retention settings. Defaults: Basic=60 days, Pro=180 days, Enterprise=unlimited';

-- =============================================================================
-- AGGREGATED ACTIVITY TABLE (for compressed historical data)
-- =============================================================================

CREATE TABLE IF NOT EXISTS planner.prompt_activity_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES planner.prompts(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    edit_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    approval_count INTEGER DEFAULT 0,
    execution_count INTEGER DEFAULT 0,
    unique_actors UUID[] DEFAULT '{}',
    summary JSONB DEFAULT '{}',  -- Compressed summary of the day's activity
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(prompt_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_activity_daily_prompt ON planner.prompt_activity_daily(prompt_id);
CREATE INDEX IF NOT EXISTS idx_activity_daily_date ON planner.prompt_activity_daily(activity_date);

-- =============================================================================
-- CLEANUP FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION planner.cleanup_old_activity(
    p_tenant_id UUID DEFAULT NULL,
    p_dry_run BOOLEAN DEFAULT true
) RETURNS TABLE(
    tenant_id UUID,
    records_to_delete BIGINT,
    oldest_record TIMESTAMPTZ,
    retention_days INTEGER
) AS $$
DECLARE
    v_tenant RECORD;
    v_count BIGINT;
    v_oldest TIMESTAMPTZ;
    v_retention INTEGER;
    v_cutoff TIMESTAMPTZ;
BEGIN
    -- Loop through tenants (or specific tenant if provided)
    FOR v_tenant IN 
        SELECT t.id, 
               COALESCE(ars.retention_days, 
                   CASE 
                       WHEN s.plan_id = 'enterprise' THEN 9999  -- Effectively unlimited
                       WHEN s.plan_id = 'pro' THEN 180
                       ELSE 60
                   END
               ) as retention_days
        FROM core.tenants t
        LEFT JOIN planner.activity_retention_settings ars ON t.id = ars.tenant_id
        LEFT JOIN core.subscriptions s ON t.id = s.tenant_id AND s.status = 'active'
        WHERE (p_tenant_id IS NULL OR t.id = p_tenant_id)
    LOOP
        v_retention := v_tenant.retention_days;
        v_cutoff := NOW() - (v_retention || ' days')::INTERVAL;
        
        -- Count records to delete
        SELECT COUNT(*), MIN(pa.created_at) INTO v_count, v_oldest
        FROM planner.prompt_activity pa
        JOIN planner.prompts p ON pa.prompt_id = p.id
        WHERE p.tenant_id = v_tenant.id
          AND pa.created_at < v_cutoff;
        
        -- Return info
        tenant_id := v_tenant.id;
        records_to_delete := v_count;
        oldest_record := v_oldest;
        retention_days := v_retention;
        RETURN NEXT;
        
        -- Actually delete if not dry run
        IF NOT p_dry_run AND v_count > 0 THEN
            DELETE FROM planner.prompt_activity pa
            USING planner.prompts p
            WHERE pa.prompt_id = p.id
              AND p.tenant_id = v_tenant.id
              AND pa.created_at < v_cutoff;
              
            RAISE NOTICE 'Deleted % activity records for tenant %', v_count, v_tenant.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- AGGREGATION FUNCTION (compress before delete)
-- =============================================================================

CREATE OR REPLACE FUNCTION planner.aggregate_daily_activity(
    p_tenant_id UUID DEFAULT NULL,
    p_before_date DATE DEFAULT CURRENT_DATE - 30
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Aggregate activity into daily summaries
    INSERT INTO planner.prompt_activity_daily (
        prompt_id, activity_date, edit_count, comment_count, 
        review_count, approval_count, execution_count, unique_actors, summary
    )
    SELECT 
        pa.prompt_id,
        pa.created_at::DATE as activity_date,
        COUNT(*) FILTER (WHERE pa.activity_type IN ('created', 'edited')) as edit_count,
        COUNT(*) FILTER (WHERE pa.activity_type = 'commented') as comment_count,
        COUNT(*) FILTER (WHERE pa.activity_type = 'review_requested') as review_count,
        COUNT(*) FILTER (WHERE pa.activity_type = 'approved') as approval_count,
        COUNT(*) FILTER (WHERE pa.activity_type = 'executed') as execution_count,
        ARRAY_AGG(DISTINCT pa.actor_id) FILTER (WHERE pa.actor_id IS NOT NULL) as unique_actors,
        jsonb_build_object(
            'total_activities', COUNT(*),
            'activity_types', jsonb_agg(DISTINCT pa.activity_type)
        ) as summary
    FROM planner.prompt_activity pa
    JOIN planner.prompts p ON pa.prompt_id = p.id
    WHERE pa.created_at::DATE < p_before_date
      AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
    GROUP BY pa.prompt_id, pa.created_at::DATE
    ON CONFLICT (prompt_id, activity_date) 
    DO UPDATE SET
        edit_count = EXCLUDED.edit_count,
        comment_count = EXCLUDED.comment_count,
        review_count = EXCLUDED.review_count,
        approval_count = EXCLUDED.approval_count,
        execution_count = EXCLUDED.execution_count,
        unique_actors = EXCLUDED.unique_actors,
        summary = EXCLUDED.summary;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SCHEDULED CLEANUP (to be called by cron job or pg_cron)
-- =============================================================================

CREATE OR REPLACE FUNCTION planner.scheduled_activity_cleanup() RETURNS void AS $$
BEGIN
    -- First aggregate old activity
    PERFORM planner.aggregate_daily_activity(NULL, CURRENT_DATE - 30);
    
    -- Then cleanup based on retention policy (not a dry run)
    PERFORM * FROM planner.cleanup_old_activity(NULL, false);
    
    RAISE NOTICE 'Activity cleanup completed at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- USAGE EXAMPLES
-- =============================================================================

COMMENT ON FUNCTION planner.cleanup_old_activity IS '
Usage examples:

-- Dry run to see what would be deleted (all tenants):
SELECT * FROM planner.cleanup_old_activity(NULL, true);

-- Dry run for specific tenant:
SELECT * FROM planner.cleanup_old_activity(''tenant-uuid-here'', true);

-- Actually perform cleanup for all tenants:
SELECT * FROM planner.cleanup_old_activity(NULL, false);

-- Set custom retention for a tenant:
INSERT INTO planner.activity_retention_settings (tenant_id, retention_days)
VALUES (''tenant-uuid'', 365)
ON CONFLICT (tenant_id) DO UPDATE SET retention_days = 365;
';

-- =============================================================================
-- STORAGE MONITORING VIEW
-- =============================================================================

CREATE OR REPLACE VIEW planner.activity_storage_stats AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    COUNT(pa.id) as total_activity_records,
    MIN(pa.created_at) as oldest_activity,
    MAX(pa.created_at) as newest_activity,
    COUNT(DISTINCT pa.prompt_id) as prompts_with_activity,
    COALESCE(ars.retention_days, 60) as retention_days,
    pg_size_pretty(
        COUNT(pa.id) * 500  -- Rough estimate: ~500 bytes per activity record
    ) as estimated_size
FROM core.tenants t
LEFT JOIN planner.prompts p ON p.tenant_id = t.id
LEFT JOIN planner.prompt_activity pa ON pa.prompt_id = p.id
LEFT JOIN planner.activity_retention_settings ars ON ars.tenant_id = t.id
GROUP BY t.id, t.name, ars.retention_days;

COMMENT ON VIEW planner.activity_storage_stats IS 
'Monitor activity storage per tenant. Use to identify tenants consuming excessive storage.';
