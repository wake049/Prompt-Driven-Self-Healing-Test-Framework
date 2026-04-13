-- Migration 019: Runner Agent Logs
-- Stores log lines sent by remote runner agents for live viewing in the dashboard.

BEGIN;

CREATE TABLE IF NOT EXISTS exec.runner_logs (
    id              BIGSERIAL PRIMARY KEY,
    runner_id       UUID NOT NULL REFERENCES exec.runners(id) ON DELETE CASCADE,
    execution_id    UUID,                          -- NULL for agent lifecycle logs
    log_level       VARCHAR(10) NOT NULL DEFAULT 'INFO',
    message         TEXT NOT NULL,
    logged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runner_logs_runner   ON exec.runner_logs(runner_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_runner_logs_exec     ON exec.runner_logs(execution_id, logged_at ASC)
    WHERE execution_id IS NOT NULL;

-- Auto-purge: keep only the last 7 days of logs per runner
-- (can be called from a cron or scheduled task)
CREATE OR REPLACE FUNCTION exec.purge_old_runner_logs() RETURNS void AS $$
BEGIN
    DELETE FROM exec.runner_logs WHERE logged_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMIT;
