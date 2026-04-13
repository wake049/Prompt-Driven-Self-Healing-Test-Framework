-- Migration 014: Add Collaborative Review and Version Management
-- Date: 2026-02-11
-- Description: Adds tables for prompt versioning, reviews, comments, and activity tracking

-- =============================================================================
-- 1. PROMPT VERSIONS TABLE
-- Purpose: Store snapshots of prompt test plans for version control
-- =============================================================================

CREATE TABLE IF NOT EXISTS planner.prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES planner.prompts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    
    -- Snapshot of the test plan at this version
    plan_snapshot JSONB NOT NULL,
    
    -- Version metadata
    title VARCHAR(255),
    description TEXT,
    change_summary TEXT,
    
    -- Status: draft, pending_review, approved, rejected, archived
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    is_active BOOLEAN DEFAULT false,  -- Only one version can be active per prompt
    
    -- Authorship
    created_by UUID NOT NULL REFERENCES core.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Approval tracking
    approved_by UUID REFERENCES core.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES core.users(id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    UNIQUE(prompt_id, version_number)
);

-- Indexes for prompt_versions
CREATE INDEX idx_prompt_versions_prompt ON planner.prompt_versions(prompt_id);
CREATE INDEX idx_prompt_versions_status ON planner.prompt_versions(status);
CREATE INDEX idx_prompt_versions_active ON planner.prompt_versions(prompt_id, is_active) WHERE is_active = true;
CREATE INDEX idx_prompt_versions_created_by ON planner.prompt_versions(created_by);

COMMENT ON TABLE planner.prompt_versions IS 'Stores versioned snapshots of prompt test plans for version control and review workflows';
COMMENT ON COLUMN planner.prompt_versions.is_active IS 'Indicates which version is currently in use for test execution';
COMMENT ON COLUMN planner.prompt_versions.status IS 'Version status: draft (editing), pending_review (awaiting approval), approved, rejected, archived';

-- =============================================================================
-- 2. REVIEW REQUESTS TABLE
-- Purpose: Track review requests for prompt versions
-- =============================================================================

CREATE TABLE IF NOT EXISTS planner.review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES planner.prompt_versions(id) ON DELETE CASCADE,
    
    -- Who requested and who should review
    requested_by UUID NOT NULL REFERENCES core.users(id),
    reviewer_id UUID NOT NULL REFERENCES core.users(id),
    
    -- Status: pending, approved, changes_requested, dismissed
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    
    -- Review details
    review_comment TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(version_id, reviewer_id)
);

-- Indexes for review_requests
CREATE INDEX idx_review_requests_version ON planner.review_requests(version_id);
CREATE INDEX idx_review_requests_reviewer ON planner.review_requests(reviewer_id);
CREATE INDEX idx_review_requests_status ON planner.review_requests(status);
CREATE INDEX idx_review_requests_requested_by ON planner.review_requests(requested_by);

COMMENT ON TABLE planner.review_requests IS 'Tracks review requests assigned to team members for prompt versions';

-- =============================================================================
-- 3. PROMPT COMMENTS TABLE
-- Purpose: Threaded comments on prompt versions
-- =============================================================================

CREATE TABLE IF NOT EXISTS planner.prompt_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES planner.prompts(id) ON DELETE CASCADE,
    version_id UUID REFERENCES planner.prompt_versions(id) ON DELETE SET NULL,
    
    -- For threaded replies
    parent_comment_id UUID REFERENCES planner.prompt_comments(id) ON DELETE CASCADE,
    
    -- Comment content
    content TEXT NOT NULL,
    
    -- Optional: reference to specific step
    step_index INTEGER,
    
    -- Authorship
    author_id UUID NOT NULL REFERENCES core.users(id),
    
    -- Status: active, edited, deleted
    status VARCHAR(50) DEFAULT 'active',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for prompt_comments
CREATE INDEX idx_prompt_comments_prompt ON planner.prompt_comments(prompt_id);
CREATE INDEX idx_prompt_comments_version ON planner.prompt_comments(version_id);
CREATE INDEX idx_prompt_comments_author ON planner.prompt_comments(author_id);
CREATE INDEX idx_prompt_comments_parent ON planner.prompt_comments(parent_comment_id);

COMMENT ON TABLE planner.prompt_comments IS 'Stores threaded comments on prompts and their versions for collaboration';
COMMENT ON COLUMN planner.prompt_comments.step_index IS 'Optional reference to a specific step number for inline comments';

-- =============================================================================
-- 4. PROMPT ACTIVITY LOG TABLE
-- Purpose: Audit trail for all prompt-related activities
-- =============================================================================

CREATE TABLE IF NOT EXISTS planner.prompt_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES planner.prompts(id) ON DELETE CASCADE,
    version_id UUID REFERENCES planner.prompt_versions(id) ON DELETE SET NULL,
    
    -- Activity type: created, edited, version_created, review_requested, 
    -- approved, rejected, commented, activated, archived
    activity_type VARCHAR(50) NOT NULL,
    
    -- Who performed the action
    actor_id UUID NOT NULL REFERENCES core.users(id),
    
    -- Activity details (flexible JSON for different activity types)
    details JSONB DEFAULT '{}',
    
    -- Human-readable summary
    summary TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for prompt_activity
CREATE INDEX idx_prompt_activity_prompt ON planner.prompt_activity(prompt_id);
CREATE INDEX idx_prompt_activity_actor ON planner.prompt_activity(actor_id);
CREATE INDEX idx_prompt_activity_type ON planner.prompt_activity(activity_type);
CREATE INDEX idx_prompt_activity_created ON planner.prompt_activity(created_at DESC);

COMMENT ON TABLE planner.prompt_activity IS 'Audit trail of all activities on prompts for the History sidebar';

-- =============================================================================
-- 5. HELPER FUNCTION: Create initial version from existing prompt
-- =============================================================================

CREATE OR REPLACE FUNCTION planner.create_initial_version_for_prompt(
    p_prompt_id UUID,
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_version_id UUID;
    v_existing_plan JSONB;
BEGIN
    -- Get the existing parsed_plan from the prompt
    SELECT parsed_plan INTO v_existing_plan
    FROM planner.prompts
    WHERE id = p_prompt_id;
    
    -- Only create if there's a plan and no versions exist
    IF v_existing_plan IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM planner.prompt_versions WHERE prompt_id = p_prompt_id
    ) THEN
        INSERT INTO planner.prompt_versions (
            prompt_id,
            version_number,
            plan_snapshot,
            title,
            status,
            is_active,
            created_by
        ) VALUES (
            p_prompt_id,
            1,
            v_existing_plan,
            'Initial Version',
            'approved',
            true,
            p_user_id
        )
        RETURNING id INTO v_version_id;
        
        -- Log the activity
        INSERT INTO planner.prompt_activity (
            prompt_id,
            version_id,
            activity_type,
            actor_id,
            summary
        ) VALUES (
            p_prompt_id,
            v_version_id,
            'version_created',
            p_user_id,
            'Initial version created from existing test plan'
        );
        
        RETURN v_version_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 6. TRIGGER: Ensure only one active version per prompt
-- =============================================================================

CREATE OR REPLACE FUNCTION planner.ensure_single_active_version()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this version as active, deactivate all others
    IF NEW.is_active = true AND (OLD IS NULL OR OLD.is_active = false) THEN
        UPDATE planner.prompt_versions
        SET is_active = false
        WHERE prompt_id = NEW.prompt_id
          AND id != NEW.id
          AND is_active = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_single_active_version ON planner.prompt_versions;
CREATE TRIGGER trigger_single_active_version
    BEFORE INSERT OR UPDATE ON planner.prompt_versions
    FOR EACH ROW
    EXECUTE FUNCTION planner.ensure_single_active_version();

-- =============================================================================
-- 7. GRANTS (adjust based on your database user)
-- =============================================================================

-- Grant permissions to the application user if needed
-- GRANT SELECT, INSERT, UPDATE, DELETE ON planner.prompt_versions TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON planner.review_requests TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON planner.prompt_comments TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON planner.prompt_activity TO app_user;
