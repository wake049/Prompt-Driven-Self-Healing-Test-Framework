-- Migration 005: Add Policy Schema and Tables
-- This migration adds the policy management system for test approval workflows

-- Create policy schema
CREATE SCHEMA IF NOT EXISTS policy;

-- Create policy packs table
CREATE TABLE IF NOT EXISTS policy.policy_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES core.environments(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    UNIQUE(project_id, environment_id, name)
);

-- Create index on project_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_policy_packs_project_id ON policy.policy_packs(project_id);
CREATE INDEX IF NOT EXISTS idx_policy_packs_environment_id ON policy.policy_packs(environment_id);
CREATE INDEX IF NOT EXISTS idx_policy_packs_default ON policy.policy_packs(project_id, environment_id, is_default) WHERE is_default = true;

-- Create policy rules table
CREATE TABLE IF NOT EXISTS policy.policy_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pack_id UUID NOT NULL REFERENCES policy.policy_packs(id) ON DELETE CASCADE,
    rule_type VARCHAR(100) NOT NULL,  -- 'test_generation', 'auto_healing', 'approval_threshold'
    rule_name VARCHAR(255) NOT NULL,
    description TEXT,
    condition_logic JSONB NOT NULL,   -- Stores the conditions (e.g., {"min_confidence": 0.8})
    action VARCHAR(100) NOT NULL,     -- 'block', 'flag', 'require_review', 'allow'
    priority INTEGER DEFAULT 100,     -- Lower priority executes first
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster rule lookups
CREATE INDEX IF NOT EXISTS idx_policy_rules_pack_id ON policy.policy_rules(pack_id);
CREATE INDEX IF NOT EXISTS idx_policy_rules_type ON policy.policy_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_policy_rules_priority ON policy.policy_rules(priority);

-- Create policy decisions log table
CREATE TABLE IF NOT EXISTS policy.policy_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pack_id UUID NOT NULL REFERENCES policy.policy_packs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES core.environments(id) ON DELETE CASCADE,
    decision_type VARCHAR(100) NOT NULL,  -- 'test_generation', 'auto_healing', 'approval'
    context JSONB NOT NULL,               -- Details about what was evaluated
    outcome VARCHAR(100) NOT NULL,        -- 'blocked', 'flagged', 'approved', 'requires_review'
    metadata JSONB DEFAULT '{}',          -- Additional decision metadata
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for policy decisions
CREATE INDEX IF NOT EXISTS idx_policy_decisions_pack_id ON policy.policy_decisions(pack_id);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_project_id ON policy.policy_decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_environment_id ON policy.policy_decisions(environment_id);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_type ON policy.policy_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_policy_decisions_decided_at ON policy.policy_decisions(decided_at DESC);

-- Create approval workflows table
CREATE TABLE IF NOT EXISTS policy.approval_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pack_id UUID NOT NULL REFERENCES policy.policy_packs(id) ON DELETE CASCADE,
    workflow_name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_conditions JSONB NOT NULL,    -- When this workflow is triggered
    approval_steps JSONB NOT NULL,        -- Array of approval steps with roles
    timeout_hours INTEGER DEFAULT 24,     -- Hours before auto-rejection
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create approval requests table (tracks individual approval requests)
CREATE TABLE IF NOT EXISTS policy.approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES policy.approval_workflows(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES core.projects(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    request_type VARCHAR(100) NOT NULL,   -- 'test_generation', 'auto_healing', 'manual_change'
    request_data JSONB NOT NULL,          -- What is being requested
    current_step INTEGER DEFAULT 1,
    status VARCHAR(100) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
    final_decision VARCHAR(100),          -- 'approved', 'rejected'
    decided_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    decided_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create approval history table (tracks all approval actions)
CREATE TABLE IF NOT EXISTS policy.approval_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES policy.approval_requests(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,         -- 'approved', 'rejected', 'delegated'
    actor_id UUID NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    comments TEXT,
    acted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for approval system
CREATE INDEX IF NOT EXISTS idx_approval_requests_workflow_id ON policy.approval_requests(workflow_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_project_id ON policy.approval_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON policy.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_expires_at ON policy.approval_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_approval_history_request_id ON policy.approval_history(request_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION policy.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_policy_packs_updated_at BEFORE UPDATE ON policy.policy_packs
    FOR EACH ROW EXECUTE FUNCTION policy.update_updated_at_column();

CREATE TRIGGER update_policy_rules_updated_at BEFORE UPDATE ON policy.policy_rules
    FOR EACH ROW EXECUTE FUNCTION policy.update_updated_at_column();

CREATE TRIGGER update_approval_workflows_updated_at BEFORE UPDATE ON policy.approval_workflows
    FOR EACH ROW EXECUTE FUNCTION policy.update_updated_at_column();

CREATE TRIGGER update_approval_requests_updated_at BEFORE UPDATE ON policy.approval_requests
    FOR EACH ROW EXECUTE FUNCTION policy.update_updated_at_column();

-- Create default policy pack template (optional - for reference)
COMMENT ON TABLE policy.policy_packs IS 'Policy packs define governance rules for test generation and auto-healing';
COMMENT ON TABLE policy.policy_rules IS 'Individual rules within a policy pack, evaluated in priority order';
COMMENT ON TABLE policy.policy_decisions IS 'Audit log of all policy evaluations and decisions';
COMMENT ON TABLE policy.approval_workflows IS 'Multi-step approval workflows for policy enforcement';
COMMENT ON TABLE policy.approval_requests IS 'Tracks individual approval requests through workflows';
COMMENT ON TABLE policy.approval_history IS 'Complete history of approval actions for auditing';
