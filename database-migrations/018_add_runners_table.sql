-- Migration 018: Runner Agent Registration
-- Supports remote runner agents that poll for work instead of direct HTTP push

BEGIN;

-- Runner agents table
CREATE TABLE IF NOT EXISTS exec.runners (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    runner_name     VARCHAR(255) NOT NULL,
    runner_token    VARCHAR(512) NOT NULL UNIQUE,
    capabilities    JSONB NOT NULL DEFAULT '["chrome"]',
    hostname        VARCHAR(255),
    os_name         VARCHAR(100),
    status          VARCHAR(50) NOT NULL DEFAULT 'offline',
    last_heartbeat  TIMESTAMPTZ,
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_runner_org FOREIGN KEY (organization_id)
        REFERENCES core.tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_runners_org ON exec.runners(organization_id);
CREATE INDEX IF NOT EXISTS idx_runners_status ON exec.runners(status);
CREATE INDEX IF NOT EXISTS idx_runners_token ON exec.runners(runner_token);

-- Add dispatch_mode to exec.runs so API knows whether to push or queue
ALTER TABLE exec.runs
    ADD COLUMN IF NOT EXISTS dispatch_mode VARCHAR(20) NOT NULL DEFAULT 'push',
    ADD COLUMN IF NOT EXISTS assigned_runner_id UUID REFERENCES exec.runners(id);

-- Index for runner polling: find queued runs for a given org + browser
CREATE INDEX IF NOT EXISTS idx_runs_queued_poll
    ON exec.runs(status, dispatch_mode, browser_type)
    WHERE status = 'queued' AND dispatch_mode = 'agent';

COMMIT;
