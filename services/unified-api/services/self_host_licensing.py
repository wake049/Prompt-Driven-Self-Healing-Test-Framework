import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

from core.database import DatabaseManager

SELF_HOST_ELIGIBLE_TIERS = {"enterprise", "custom"}
ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trial"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _hash_license_key(license_key: str) -> str:
    return hashlib.sha256(license_key.encode("utf-8")).hexdigest()


def _normalize_subscription_value(value: Optional[str], fallback: str) -> str:
    normalized = (value or "").strip().lower()
    return normalized or fallback


async def get_latest_subscription_for_tenant(db: DatabaseManager, tenant_id: str) -> Optional[dict[str, Any]]:
    return await db.execute_one(
        """
        SELECT tenant_id, plan_tier, status, cancel_at_period_end, current_period_end, updated_at
        FROM core.subscriptions
        WHERE tenant_id = $1
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
        """,
        tenant_id,
    )


async def get_self_host_entitlement(db: DatabaseManager, tenant_id: str) -> dict[str, Any]:
    subscription = await get_latest_subscription_for_tenant(db, tenant_id)
    if not subscription:
        return {
            "entitled": False,
            "reason": "no_subscription",
            "plan_tier": "community",
            "status": "inactive",
        }

    plan_tier = _normalize_subscription_value(subscription.get("plan_tier"), "community")
    subscription_status = _normalize_subscription_value(subscription.get("status"), "inactive")

    has_eligible_plan = plan_tier in SELF_HOST_ELIGIBLE_TIERS
    has_active_status = subscription_status in ACTIVE_SUBSCRIPTION_STATUSES

    if not has_eligible_plan:
        reason = "plan_not_eligible"
    elif not has_active_status:
        reason = "subscription_inactive"
    else:
        reason = "ok"

    return {
        "entitled": has_eligible_plan and has_active_status,
        "reason": reason,
        "plan_tier": plan_tier,
        "status": subscription_status,
        "cancel_at_period_end": bool(subscription.get("cancel_at_period_end", False)),
        "current_period_end": subscription.get("current_period_end"),
    }


async def enforce_self_host_license_state(db: DatabaseManager, tenant_id: str) -> None:
    entitlement = await get_self_host_entitlement(db, tenant_id)
    if entitlement["entitled"]:
        return

    revoke_reason = f"subscription:{entitlement['reason']}"
    await db.execute_command(
        """
        UPDATE core.self_host_licenses
        SET
            is_active = false,
            revoked_at = COALESCE(revoked_at, NOW()),
            revoked_reason = COALESCE(revoked_reason, $2),
            updated_at = NOW()
        WHERE tenant_id = $1 AND is_active = true
        """,
        tenant_id,
        revoke_reason,
    )


async def issue_self_host_license(
    db: DatabaseManager,
    *,
    tenant_id: str,
    issued_by_user_id: str,
    notes: Optional[str] = None,
) -> tuple[str, dict[str, Any]]:
    entitlement = await get_self_host_entitlement(db, tenant_id)
    if not entitlement["entitled"]:
        raise ValueError(entitlement["reason"])

    raw_license_key = f"shl_{secrets.token_urlsafe(36)}"
    license_hash = _hash_license_key(raw_license_key)

    await db.execute_command(
        """
        INSERT INTO core.self_host_licenses (
            id,
            tenant_id,
            license_key_hash,
            is_active,
            issued_by_user_id,
            issued_at,
            revoked_at,
            revoked_reason,
            notes,
            metadata,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            $1,
            $2,
            true,
            $3,
            NOW(),
            NULL,
            NULL,
            $4,
            '{}'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (tenant_id) DO UPDATE
        SET
            license_key_hash = EXCLUDED.license_key_hash,
            is_active = true,
            issued_by_user_id = EXCLUDED.issued_by_user_id,
            issued_at = NOW(),
            revoked_at = NULL,
            revoked_reason = NULL,
            notes = EXCLUDED.notes,
            updated_at = NOW()
        """,
        tenant_id,
        license_hash,
        issued_by_user_id,
        notes,
    )

    return raw_license_key, entitlement


async def revoke_self_host_license(
    db: DatabaseManager,
    *,
    tenant_id: str,
    reason: str,
) -> bool:
    result = await db.execute_command(
        """
        UPDATE core.self_host_licenses
        SET
            is_active = false,
            revoked_at = NOW(),
            revoked_reason = $2,
            updated_at = NOW()
        WHERE tenant_id = $1 AND is_active = true
        """,
        tenant_id,
        reason,
    )
    return not result.endswith(" 0")


async def get_license_status(db: DatabaseManager, tenant_id: str) -> dict[str, Any]:
    entitlement = await get_self_host_entitlement(db, tenant_id)
    license_row = await db.execute_one(
        """
        SELECT
            tenant_id,
            is_active,
            issued_at,
            revoked_at,
            revoked_reason,
            last_validated_at,
            last_validation_node_id,
            notes
        FROM core.self_host_licenses
        WHERE tenant_id = $1
        """,
        tenant_id,
    )

    return {
        "entitlement": entitlement,
        "license_present": bool(license_row),
        "license_active": bool(license_row and license_row.get("is_active")),
        "issued_at": license_row.get("issued_at") if license_row else None,
        "revoked_at": license_row.get("revoked_at") if license_row else None,
        "revoked_reason": license_row.get("revoked_reason") if license_row else None,
        "last_validated_at": license_row.get("last_validated_at") if license_row else None,
        "last_validation_node_id": license_row.get("last_validation_node_id") if license_row else None,
        "notes": license_row.get("notes") if license_row else None,
    }


async def validate_self_host_license(
    db: DatabaseManager,
    *,
    tenant_slug: str,
    license_key: str,
    node_id: Optional[str] = None,
    source_ip: Optional[str] = None,
) -> dict[str, Any]:
    tenant = await db.execute_one(
        """
        SELECT id, slug
        FROM core.tenants
        WHERE slug = $1
        LIMIT 1
        """,
        tenant_slug.strip().lower(),
    )
    if not tenant:
        return {
            "valid": False,
            "reason": "invalid_tenant_or_license",
            "next_check_in_seconds": 300,
        }

    tenant_id = str(tenant["id"])
    entitlement = await get_self_host_entitlement(db, tenant_id)
    if not entitlement["entitled"]:
        await enforce_self_host_license_state(db, tenant_id)
        return {
            "valid": False,
            "reason": entitlement["reason"],
            "plan_tier": entitlement["plan_tier"],
            "subscription_status": entitlement["status"],
            "next_check_in_seconds": 300,
        }

    license_row = await db.execute_one(
        """
        SELECT id, license_key_hash, is_active
        FROM core.self_host_licenses
        WHERE tenant_id = $1
        LIMIT 1
        """,
        tenant_id,
    )

    if not license_row or not license_row.get("is_active"):
        return {
            "valid": False,
            "reason": "license_missing_or_revoked",
            "next_check_in_seconds": 300,
        }

    provided_hash = _hash_license_key(license_key.strip())
    stored_hash = str(license_row.get("license_key_hash") or "")

    if not secrets.compare_digest(provided_hash, stored_hash):
        return {
            "valid": False,
            "reason": "invalid_tenant_or_license",
            "next_check_in_seconds": 300,
        }

    await db.execute_command(
        """
        UPDATE core.self_host_licenses
        SET
            last_validated_at = NOW(),
            last_validation_node_id = $2,
            last_validation_ip = $3,
            updated_at = NOW()
        WHERE tenant_id = $1
        """,
        tenant_id,
        node_id,
        source_ip,
    )

    return {
        "valid": True,
        "reason": "ok",
        "plan_tier": entitlement["plan_tier"],
        "subscription_status": entitlement["status"],
        "next_check_in_seconds": 300,
        "checked_at": _utcnow().isoformat(),
    }
