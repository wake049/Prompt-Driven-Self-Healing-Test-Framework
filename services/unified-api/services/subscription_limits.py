from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, status

from core.database import DatabaseManager


PLAN_DEFAULT_LIMITS: Dict[str, Dict[str, Optional[int]]] = {
    "community": {
        "max_team_members": 1,
        "monthly_test_runs_limit": 10,
        "max_projects": 1,
    },
    "free": {
        "max_team_members": 1,
        "monthly_test_runs_limit": 10,
        "max_projects": 1,
    },
    "starter": {
        "max_team_members": 5,
        "monthly_test_runs_limit": 1000,
        "max_projects": 5,
    },
    "professional": {
        "max_team_members": 10,
        "monthly_test_runs_limit": None,
        "max_projects": 20,
    },
    "enterprise": {
        "max_team_members": None,
        "monthly_test_runs_limit": None,
        "max_projects": None,
    },
    "custom": {
        "max_team_members": None,
        "monthly_test_runs_limit": None,
        "max_projects": None,
    },
}

PLAN_TRIAL_DAYS: Dict[str, int] = {
    "community": 0,
    "free": 0,
    "starter": 14,
    "professional": 14,
    "enterprise": 30,
    "custom": 14,
}


def _parse_limit_value(raw: Any) -> Optional[int]:
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _extract_limits_from_metadata(metadata: Any) -> Dict[str, Optional[int]]:
    if not isinstance(metadata, dict):
        return {
            "max_team_members": None,
            "monthly_test_runs_limit": None,
            "max_projects": None,
            "monthly_ai_requests_limit": None,
        }

    custom_limits = metadata.get("custom_limits")
    source = custom_limits if isinstance(custom_limits, dict) else metadata.get("limits")
    if not isinstance(source, dict):
        source = metadata

    return {
        "max_team_members": _parse_limit_value(source.get("max_team_members")),
        "monthly_test_runs_limit": _parse_limit_value(source.get("monthly_test_runs_limit")),
        "max_projects": _parse_limit_value(source.get("max_projects")),
        "monthly_ai_requests_limit": _parse_limit_value(source.get("monthly_ai_requests_limit")),
    }


def _normalize_plan_tier(plan_tier: Optional[str]) -> str:
    tier = (plan_tier or "community").lower()
    if tier not in PLAN_DEFAULT_LIMITS:
        return "community"
    return tier


def _parse_datetime_value(raw: Any) -> Optional[datetime]:
    if raw is None:
        return None
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    if isinstance(raw, str):
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _resolve_trial_end(subscription: Dict[str, Any]) -> Optional[datetime]:
    direct_trial_end = _parse_datetime_value(subscription.get("trial_ends_at"))
    if direct_trial_end:
        return direct_trial_end

    metadata = subscription.get("metadata") if isinstance(subscription.get("metadata"), dict) else {}
    metadata_trial_end = _parse_datetime_value(metadata.get("trial_ends_at"))
    if metadata_trial_end:
        return metadata_trial_end

    created_at = _parse_datetime_value(subscription.get("created_at"))
    if not created_at:
        return None

    plan_tier = _normalize_plan_tier(subscription.get("plan_tier"))
    trial_days = _parse_limit_value(metadata.get("trial_days"))
    if trial_days is None:
        trial_days = PLAN_TRIAL_DAYS.get(plan_tier, 14)

    if trial_days <= 0:
        return None

    return created_at + timedelta(days=trial_days)


def _is_trial_expired(subscription: Dict[str, Any]) -> bool:
    status = (subscription.get("status") or "").lower()
    if status != "trial":
        return False

    trial_end = _resolve_trial_end(subscription)
    if trial_end is None:
        return False

    return datetime.now(timezone.utc) >= trial_end


async def get_current_subscription(db: DatabaseManager, tenant_id: str) -> Optional[Dict[str, Any]]:
    try:
        subscription = await db.execute_one(
            """
            SELECT
                plan_tier,
                status,
                trial_ends_at,
                created_at,
                max_team_members,
                monthly_test_runs_limit,
                max_projects,
                monthly_ai_requests_limit,
                metadata
            FROM core.subscriptions
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            tenant_id,
        )
        if not subscription:
            return None

        metadata_limits = _extract_limits_from_metadata(subscription.get("metadata"))
        for key in ("max_team_members", "monthly_test_runs_limit", "max_projects", "monthly_ai_requests_limit"):
            if subscription.get(key) is None and metadata_limits.get(key) is not None:
                subscription[key] = metadata_limits[key]

        trial_ends_at = _resolve_trial_end(subscription)
        subscription["trial_ends_at"] = trial_ends_at
        subscription["trial_expired"] = _is_trial_expired(subscription)
        return subscription
    except Exception:
        subscription = await db.execute_one(
            """
            SELECT plan_tier, status, created_at, metadata
            FROM core.subscriptions
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            tenant_id,
        )
        if not subscription:
            return None

        metadata_limits = _extract_limits_from_metadata(subscription.get("metadata"))
        return {
            "plan_tier": subscription.get("plan_tier"),
            "status": subscription.get("status"),
            "max_team_members": metadata_limits.get("max_team_members"),
            "monthly_test_runs_limit": metadata_limits.get("monthly_test_runs_limit"),
            "max_projects": metadata_limits.get("max_projects"),
            "monthly_ai_requests_limit": metadata_limits.get("monthly_ai_requests_limit"),
            "created_at": subscription.get("created_at"),
            "metadata": subscription.get("metadata"),
            "trial_ends_at": _resolve_trial_end(subscription),
            "trial_expired": _is_trial_expired(subscription),
        }


async def get_effective_limits(db: DatabaseManager, tenant_id: str) -> Dict[str, Any]:
    subscription = await get_current_subscription(db, tenant_id)
    original_tier = _normalize_plan_tier(subscription["plan_tier"] if subscription else "community")
    is_trial_expired = bool(subscription and subscription.get("trial_expired"))
    subscription_status = (subscription.get("status") if subscription else "active") or "active"
    normalized_status = str(subscription_status).lower()
    is_billing_inactive = normalized_status in {"canceled", "unpaid", "incomplete"}
    is_payment_issue = normalized_status == "past_due"

    should_fallback_to_community = is_trial_expired or is_billing_inactive or is_payment_issue
    plan_tier = "community" if should_fallback_to_community else original_tier
    defaults = PLAN_DEFAULT_LIMITS[plan_tier]

    def _resolve_limit(column_name: str) -> Optional[int]:
        if subscription and not should_fallback_to_community and subscription.get(column_name) is not None:
            return int(subscription[column_name])
        return defaults[column_name]

    return {
        "plan_tier": plan_tier,
        "source_plan_tier": original_tier,
        "subscription_status": normalized_status,
        "trial_expired": is_trial_expired,
        "billing_inactive": is_billing_inactive,
        "payment_issue": is_payment_issue,
        "trial_ends_at": subscription.get("trial_ends_at") if subscription else None,
        "max_team_members": _resolve_limit("max_team_members"),
        "monthly_test_runs_limit": _resolve_limit("monthly_test_runs_limit"),
        "max_projects": _resolve_limit("max_projects"),
    }


async def count_active_team_members(db: DatabaseManager, tenant_id: str) -> int:
    # Preferred source of truth: organization_members (tenant-scoped membership table)
    try:
        org_result = await db.execute_one(
            """
            SELECT COUNT(DISTINCT om.user_id) AS count
            FROM core.organization_members om
            WHERE om.tenant_id = $1
              AND om.status = 'active'
            """,
            tenant_id,
        )

        org_count = int(org_result["count"]) if org_result else 0
        if org_count > 0:
            return org_count
    except Exception:
        # Table may not exist in legacy environments; fallback below.
        pass

    # Legacy fallback: user_tenant_roles
    try:
        legacy_result = await db.execute_one(
            """
            SELECT COUNT(DISTINCT utr.user_id) AS count
            FROM core.user_tenant_roles utr
            WHERE utr.tenant_id = $1
              AND utr.is_active = true
            """,
            tenant_id,
        )
        return int(legacy_result["count"]) if legacy_result else 0
    except Exception:
        return 0


async def count_monthly_test_runs(db: DatabaseManager, tenant_id: str) -> int:
    result = await db.execute_one(
        """
        SELECT COUNT(*) AS count
        FROM exec.runs r
        JOIN tests.test_cases tc ON r.test_case_id = tc.id
        JOIN core.projects p ON tc.project_id = p.id
        WHERE p.tenant_id = $1
          AND r.started_at >= DATE_TRUNC('month', CURRENT_DATE)
        """,
        tenant_id,
    )
    return int(result["count"]) if result else 0


async def enforce_team_member_limit(db: DatabaseManager, tenant_id: str) -> None:
    limits = await get_effective_limits(db, tenant_id)
    max_members = limits["max_team_members"]

    if max_members is None:
        return

    current_members = await count_active_team_members(db, tenant_id)
    if current_members >= max_members:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Team member limit reached for {limits['plan_tier']} plan "
                f"({current_members}/{max_members}). Upgrade your subscription to add more members."
            ),
        )


async def enforce_monthly_test_runs_limit(
    db: DatabaseManager,
    tenant_id: str,
    additional_runs: int = 1,
) -> None:
    limits = await get_effective_limits(db, tenant_id)
    monthly_limit = limits["monthly_test_runs_limit"]

    if monthly_limit is None:
        return

    current_runs = await count_monthly_test_runs(db, tenant_id)
    if current_runs + additional_runs > monthly_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Monthly test run limit reached for {limits['plan_tier']} plan "
                f"({current_runs}/{monthly_limit}). Upgrade your subscription for more runs."
            ),
        )


async def require_active_subscription(db: DatabaseManager, tenant_id: str) -> None:
    """
    Hard-gate: raises HTTP 403 if the tenant's subscription is canceled,
    unpaid, incomplete, or trial-expired.  Endpoints that must be blocked
    for non-paying users should call this *before* any business logic.

    Allowed statuses: active, trial (not expired), past_due (grace period).
    """
    limits = await get_effective_limits(db, tenant_id)

    if limits["billing_inactive"] or limits["trial_expired"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your subscription is inactive. "
                "Please renew or upgrade your subscription to continue using this feature."
            ),
        )
