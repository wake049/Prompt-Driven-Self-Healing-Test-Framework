-- Backfill organization_members from existing user_tenant_roles
-- This ensures users created before organization_members table show up in the new system

INSERT INTO core.organization_members (
    tenant_id,
    user_id,
    role,
    status,
    invited_at,
    joined_at,
    invited_by
)
SELECT 
    utr.tenant_id,
    utr.user_id,
    r.name as role,
    'active' as status,
    NULL as invited_at,
    utr.created_at as joined_at,
    NULL as invited_by
FROM core.user_tenant_roles utr
JOIN core.roles r ON utr.role_id = r.id
WHERE NOT EXISTS (
    SELECT 1 FROM core.organization_members om
    WHERE om.user_id = utr.user_id AND om.tenant_id = utr.tenant_id
)
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Log the backfill
DO $$
DECLARE
    inserted_count INTEGER;
BEGIN
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RAISE NOTICE 'Backfilled % organization members from user_tenant_roles', inserted_count;
END $$;
