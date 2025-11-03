-- Migration: Add Dual Selector Support to Test Steps
-- This migration adds CSS and XPath selector columns while maintaining backward compatibility

BEGIN;

-- 1. Add new columns to tests.test_steps for dual selectors
ALTER TABLE tests.test_steps 
ADD COLUMN IF NOT EXISTS css_selector TEXT,
ADD COLUMN IF NOT EXISTS xpath_selector TEXT,
ADD COLUMN IF NOT EXISTS selector_metadata JSONB DEFAULT '{}';

-- 2. Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_test_steps_css_selector ON tests.test_steps (css_selector);
CREATE INDEX IF NOT EXISTS idx_test_steps_xpath_selector ON tests.test_steps (xpath_selector);
CREATE INDEX IF NOT EXISTS idx_test_steps_selector_metadata ON tests.test_steps USING GIN (selector_metadata);

-- 3. Create a function to extract selectors from existing parameters
CREATE OR REPLACE FUNCTION extract_selector_from_parameters(params JSONB) 
RETURNS TABLE(css_sel TEXT, xpath_sel TEXT) AS $$
BEGIN
    -- Extract selector from parameters JSONB
    RETURN QUERY SELECT 
        CASE 
            WHEN params->>'selector' LIKE '//%' OR params->>'selector' LIKE '%[@%' THEN NULL
            ELSE params->>'selector'
        END as css_sel,
        CASE 
            WHEN params->>'selector' LIKE '//%' OR params->>'selector' LIKE '%[@%' THEN params->>'selector'
            ELSE NULL
        END as xpath_sel;
END;
$$ LANGUAGE plpgsql;

-- 4. Migrate existing selector data from parameters to new columns
UPDATE tests.test_steps 
SET 
    css_selector = (SELECT css_sel FROM extract_selector_from_parameters(parameters)),
    xpath_selector = (SELECT xpath_sel FROM extract_selector_from_parameters(parameters)),
    selector_metadata = jsonb_build_object(
        'migration_date', NOW(),
        'original_selector', parameters->>'selector',
        'migration_source', 'automatic'
    )
WHERE parameters->>'selector' IS NOT NULL 
  AND (css_selector IS NULL AND xpath_selector IS NULL);

-- 5. Create a view for backward compatibility
CREATE OR REPLACE VIEW tests.v_test_steps_with_selectors AS
SELECT 
    ts.*,
    COALESCE(
        ts.css_selector,
        ts.xpath_selector,
        ts.parameters->>'selector'
    ) as effective_selector,
    CASE 
        WHEN ts.css_selector IS NOT NULL AND ts.xpath_selector IS NOT NULL THEN 'dual'
        WHEN ts.css_selector IS NOT NULL THEN 'css'
        WHEN ts.xpath_selector IS NOT NULL THEN 'xpath'
        WHEN ts.parameters->>'selector' IS NOT NULL THEN 'legacy'
        ELSE 'none'
    END as selector_type,
    CASE 
        WHEN ts.css_selector IS NOT NULL AND ts.xpath_selector IS NOT NULL THEN true
        ELSE false
    END as has_fallback_selector
FROM tests.test_steps ts;

-- 6. Create a function to apply selector policy at runtime
CREATE OR REPLACE FUNCTION apply_selector_policy(
    css_sel TEXT,
    xpath_sel TEXT,
    prefer_css BOOLEAN DEFAULT true
) RETURNS TABLE(selected_selector TEXT, selector_type TEXT, has_fallback BOOLEAN) AS $$
BEGIN
    IF prefer_css THEN
        -- Prefer CSS over XPath
        IF css_sel IS NOT NULL THEN
            RETURN QUERY SELECT css_sel, 'css'::TEXT, (xpath_sel IS NOT NULL);
        ELSIF xpath_sel IS NOT NULL THEN
            RETURN QUERY SELECT xpath_sel, 'xpath'::TEXT, false;
        ELSE
            RETURN QUERY SELECT NULL::TEXT, 'none'::TEXT, false;
        END IF;
    ELSE
        -- Prefer XPath over CSS
        IF xpath_sel IS NOT NULL THEN
            RETURN QUERY SELECT xpath_sel, 'xpath'::TEXT, (css_sel IS NOT NULL);
        ELSIF css_sel IS NOT NULL THEN
            RETURN QUERY SELECT css_sel, 'css'::TEXT, false;
        ELSE
            RETURN QUERY SELECT NULL::TEXT, 'none'::TEXT, false;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Create audit table for selector policy decisions
CREATE TABLE IF NOT EXISTS analytics.selector_policy_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID REFERENCES planner.prompts(id),
    step_index INTEGER,
    css_selector TEXT,
    xpath_selector TEXT,
    selected_selector TEXT,
    selector_type TEXT CHECK (selector_type IN ('css', 'xpath')),
    policy_preference TEXT CHECK (policy_preference IN ('css', 'xpath')),
    has_fallback BOOLEAN,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_selector_decisions_prompt ON analytics.selector_policy_decisions (prompt_id);
CREATE INDEX IF NOT EXISTS idx_selector_decisions_created ON analytics.selector_policy_decisions (created_at);
CREATE INDEX IF NOT EXISTS idx_selector_decisions_type ON analytics.selector_policy_decisions (selector_type);

-- 8. Create function to log selector policy decisions
CREATE OR REPLACE FUNCTION log_selector_decision(
    p_prompt_id UUID,
    p_step_index INTEGER,
    p_css_selector TEXT,
    p_xpath_selector TEXT,
    p_selected_selector TEXT,
    p_selector_type TEXT,
    p_policy_preference TEXT,
    p_context JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    decision_id UUID;
BEGIN
    INSERT INTO analytics.selector_policy_decisions (
        prompt_id, step_index, css_selector, xpath_selector,
        selected_selector, selector_type, policy_preference,
        has_fallback, context
    ) VALUES (
        p_prompt_id, p_step_index, p_css_selector, p_xpath_selector,
        p_selected_selector, p_selector_type, p_policy_preference,
        (p_css_selector IS NOT NULL AND p_xpath_selector IS NOT NULL),
        p_context
    ) RETURNING id INTO decision_id;
    
    RETURN decision_id;
END;
$$ LANGUAGE plpgsql;

-- 9. Create analytics view for selector success rates
CREATE OR REPLACE VIEW analytics.v_selector_success_rates AS
SELECT 
    e.element_key,
    e.page_id,
    COUNT(CASE WHEN spd.selector_type = 'css' THEN 1 END) as css_usage_count,
    COUNT(CASE WHEN spd.selector_type = 'xpath' THEN 1 END) as xpath_usage_count,
    -- Success rates would come from execution results - simplified for now
    COALESCE(
        COUNT(CASE WHEN spd.selector_type = 'css' THEN 1 END)::FLOAT / 
        NULLIF(COUNT(CASE WHEN spd.selector_type = 'css' THEN 1 END), 0), 
        0
    ) as css_relative_usage,
    COALESCE(
        COUNT(CASE WHEN spd.selector_type = 'xpath' THEN 1 END)::FLOAT / 
        NULLIF(COUNT(CASE WHEN spd.selector_type = 'xpath' THEN 1 END), 0), 
        0
    ) as xpath_relative_usage
FROM repo.elements e
LEFT JOIN tests.test_steps ts ON ts.element_ref = e.id
LEFT JOIN analytics.selector_policy_decisions spd ON spd.prompt_id = ts.test_case_id
WHERE spd.created_at >= NOW() - INTERVAL '30 days'
GROUP BY e.element_key, e.page_id;

-- 10. Grant permissions
GRANT SELECT ON tests.v_test_steps_with_selectors TO public;
GRANT SELECT ON analytics.v_selector_success_rates TO public;
GRANT INSERT ON analytics.selector_policy_decisions TO public;

COMMIT;

-- Verification queries
/*
-- Check migration results
SELECT 
    COUNT(*) as total_steps,
    COUNT(css_selector) as css_count,
    COUNT(xpath_selector) as xpath_count,
    COUNT(CASE WHEN css_selector IS NOT NULL AND xpath_selector IS NOT NULL THEN 1 END) as dual_count
FROM tests.test_steps;

-- Test the policy function
SELECT * FROM apply_selector_policy('#button', '//button[@id="button"]', true);
SELECT * FROM apply_selector_policy('#button', '//button[@id="button"]', false);
*/