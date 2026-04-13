-- Add revocable self-host license records tied to subscription state

CREATE TABLE IF NOT EXISTS core.self_host_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
    license_key_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    issued_by_user_id UUID,
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP,
    revoked_reason TEXT,
    last_validated_at TIMESTAMP,
    last_validation_node_id TEXT,
    last_validation_ip TEXT,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_self_host_license_per_tenant UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_self_host_licenses_tenant ON core.self_host_licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_self_host_licenses_active ON core.self_host_licenses(is_active);

COMMENT ON TABLE core.self_host_licenses IS 'Revocable self-host license keys for enterprise/custom customers';
COMMENT ON COLUMN core.self_host_licenses.license_key_hash IS 'SHA-256 hash of one-way self-host license key';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'core'
          AND table_name = 'self_host_licenses'
          AND column_name = 'updated_at'
    ) THEN
        BEGIN
            CREATE TRIGGER update_self_host_licenses_updated_at
            BEFORE UPDATE ON core.self_host_licenses
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN undefined_function THEN NULL;
        END;
    END IF;
END $$;
