-- Migration 008: Add Invitation Tokens Table
-- Date: 2026-02-09
-- Description: Adds invitation tokens table for secure organization invitations

-- =============================================================================
-- INVITATION TOKENS TABLE
-- Purpose: Store secure invitation tokens for organization member invites
-- =============================================================================

CREATE TABLE IF NOT EXISTS core.invitation_tokens (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    tenant_id uuid NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    invited_by uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    email VARCHAR(255),  -- Optional: Can restrict invitation to specific email
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    uses_remaining INTEGER DEFAULT 1,  -- 0 or NULL = unlimited uses
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    accepted_by uuid REFERENCES core.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for invitation_tokens
CREATE INDEX idx_invitation_tokens_token ON core.invitation_tokens(token);
CREATE INDEX idx_invitation_tokens_tenant ON core.invitation_tokens(tenant_id);
CREATE INDEX idx_invitation_tokens_status ON core.invitation_tokens(status);
CREATE INDEX idx_invitation_tokens_expires ON core.invitation_tokens(expires_at);
CREATE INDEX idx_invitation_tokens_email ON core.invitation_tokens(email) WHERE email IS NOT NULL;

-- Comments
COMMENT ON TABLE core.invitation_tokens IS 'Secure invitation tokens for organization member invites with expiration and usage tracking';
COMMENT ON COLUMN core.invitation_tokens.token IS 'Secure random token used in invitation URL';
COMMENT ON COLUMN core.invitation_tokens.email IS 'Optional: Restricts invitation to specific email address';
COMMENT ON COLUMN core.invitation_tokens.uses_remaining IS 'Number of times token can be used (0 or NULL = unlimited)';
COMMENT ON COLUMN core.invitation_tokens.status IS 'Token status: pending (unused), accepted (used), expired (past expiry), revoked (canceled by admin)';
