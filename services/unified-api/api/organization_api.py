"""Organization and subscription onboarding API endpoints.

These endpoints support the React onboarding flow:
- POST /api/v1/organizations
- GET  /api/v1/organizations/check-slug/{slug}
- POST /api/v1/subscriptions

They create tenant records and basic subscription rows using the existing
core.tenants and core.subscriptions tables.
"""

from datetime import datetime, timedelta, timezone
import logging
import os
from typing import Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from core.database import get_database, DatabaseManager
from core.auth import get_current_user
from models.auth_models import CurrentUser
from services.subscription_limits import (
    count_active_team_members,
    count_monthly_test_runs,
    get_effective_limits,
)
from services.self_host_licensing import enforce_self_host_license_state


logger = logging.getLogger(__name__)


def _is_paid_plan(plan_tier: str) -> bool:
    return plan_tier not in {"community", "free", "enterprise", "custom"}


def _get_stripe_client():
    stripe_secret_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured. Set STRIPE_SECRET_KEY.",
        )

    try:
        import stripe
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe SDK not installed on API server.",
        ) from exc

    stripe.api_key = stripe_secret_key
    return stripe


def _get_paid_checkout_session(checkout_session_id: str):
    stripe = _get_stripe_client()

    try:
        session = stripe.checkout.Session.retrieve(checkout_session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid checkout session ID.",
        ) from exc

    payment_status = getattr(session, "payment_status", "unpaid")
    if payment_status not in {"paid", "no_payment_required"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Checkout session is not paid yet.",
        )

    return session

router = APIRouter(prefix="/api/v1", tags=["Organizations"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class OrganizationCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=3, max_length=255)
    industry: Optional[str] = Field(None, max_length=255)
    size: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=500)


class OrganizationResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    industry: Optional[str] = None
    company_size: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None


class SlugAvailabilityResponse(BaseModel):
    available: bool


class SubscriptionCreateRequest(BaseModel):
    plan_id: str
    billing_period: str
    payment_method_id: Optional[str] = None
    custom_limits: Optional["SubscriptionCustomLimits"] = None


class SubscriptionCustomLimits(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    monthly_test_runs_limit: Optional[int] = Field(None, ge=0)
    max_projects: Optional[int] = Field(None, ge=1)
    max_team_members: Optional[int] = Field(None, ge=1)
    monthly_ai_requests_limit: Optional[int] = Field(None, ge=0)


class SubscriptionResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    plan_tier: str
    billing_interval: Optional[str]
    status: str
    trial_ends_at: Optional[datetime] = None
    trial_expired: bool = False
    trial_days_remaining: Optional[int] = None
    monthly_test_runs_limit: Optional[int] = None
    max_projects: Optional[int] = None
    max_team_members: Optional[int] = None
    monthly_ai_requests_limit: Optional[int] = None


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------


RESERVED_SLUGS = {"admin", "api", "www", "test"}


async def _ensure_owner_role(db: DatabaseManager) -> str:
    """Get or create the default owner role and return its ID."""
    role = await db.execute_one(
        "SELECT id FROM core.roles WHERE LOWER(name) = LOWER($1)",
        "Owner",
    )
    if role:
        return str(role["id"])

    role = await db.execute_one(
        """
        INSERT INTO core.roles (id, name, description, is_active, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
        RETURNING id
        """,
        "Owner",
        "Organization owner with full access",
    )
    return str(role["id"])


async def _link_user_to_tenant_as_owner(
    db: DatabaseManager,
    user_id: str,
    tenant_id: str,
) -> None:
    """Create a user_tenant_roles link marking the user as owner of the tenant."""
    role_id = await _ensure_owner_role(db)

    # Avoid duplicate relationships using ON CONFLICT on unique constraint
    await db.execute_command(
        """
        INSERT INTO core.user_tenant_roles (
            id, user_id, tenant_id, role_id, is_active, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), $1, $2, $3, true, NOW(), NOW()
        )
        ON CONFLICT (user_id, tenant_id, role_id) DO NOTHING
        """,
        user_id,
        tenant_id,
        role_id,
    )


def _normalize_slug(raw_slug: str) -> str:
    slug = raw_slug.strip().lower()
    # Keep only lowercase letters, digits and hyphens
    import re

    slug = re.sub(r"[^a-z0-9-]", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def _map_plan_id_to_tier(plan_id: str) -> str:
    """Map frontend plan identifiers to subscription plan_tier values."""
    plan_id = (plan_id or "").lower()
    if plan_id == "community":
        return "community"
    if plan_id == "starter":
        return "starter"
    if plan_id == "professional":
        return "professional"
    if plan_id == "enterprise":
        return "enterprise"
    # Fallback for any custom/unknown plans
    return "custom"


def _map_billing_period_to_interval(period: str) -> Optional[str]:
    period = (period or "").lower()
    if period == "month":
        return "monthly"
    if period == "year":
        return "yearly"
    return None


def _get_trial_days_for_plan(plan_tier: str) -> int:
    tier = (plan_tier or "").lower()
    if tier in {"community", "free"}:
        return 0
    if tier == "enterprise":
        return 30
    return 14


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _extract_trial_details(subscription: Dict[str, Any]) -> Dict[str, Any]:
    trial_end = subscription.get("trial_ends_at")
    if isinstance(trial_end, datetime):
        trial_end_dt = trial_end if trial_end.tzinfo else trial_end.replace(tzinfo=timezone.utc)
    else:
        metadata = subscription.get("metadata") if isinstance(subscription.get("metadata"), dict) else {}
        trial_end_dt = _parse_iso_datetime(metadata.get("trial_ends_at"))
        if trial_end_dt is None:
            created_at = subscription.get("created_at")
            if isinstance(created_at, datetime):
                created_at_dt = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
            else:
                created_at_dt = None

            trial_days = metadata.get("trial_days")
            if created_at_dt and isinstance(trial_days, int) and trial_days > 0:
                trial_end_dt = created_at_dt + timedelta(days=trial_days)

    status_value = (subscription.get("status") or "").lower()
    trial_expired = False
    trial_days_remaining: Optional[int] = None

    if status_value == "trial" and trial_end_dt:
        now = datetime.now(timezone.utc)
        trial_expired = now >= trial_end_dt
        if not trial_expired:
            trial_days_remaining = max((trial_end_dt.date() - now.date()).days, 0)

    return {
        "trial_ends_at": trial_end_dt,
        "trial_expired": trial_expired,
        "trial_days_remaining": trial_days_remaining,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/organizations", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_database),
):
    """Create a new organization (tenant) for the current user.

    This backs the onboarding step that posts to /api/v1/organizations.
    """

    slug = _normalize_slug(payload.slug)

    if slug in RESERVED_SLUGS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This slug is reserved. Please choose another.",
        )

    # Ensure slug is unique across tenants
    existing = await db.execute_one(
        "SELECT id FROM core.tenants WHERE slug = $1",
        slug,
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization slug is already in use.",
        )

    description_parts = []
    if payload.industry:
        description_parts.append(payload.industry)
    if payload.size:
        description_parts.append(payload.size)
    if payload.website:
        description_parts.append(payload.website)
    # Create tenant with all organization details in one table
    tenant = await db.execute_one(
        """
        INSERT INTO core.tenants (
            id, name, slug, description, 
            industry, company_size, website,
            is_active, created_at, updated_at
        )
        VALUES (
            gen_random_uuid(), $1, $2, $3,
            $4, $5, $6,
            true, NOW(), NOW()
        )
        RETURNING id, name, slug, is_active, industry, company_size, website, logo_url
        """,
        payload.name,
        slug,
        payload.industry if payload.industry else " | ".join(description_parts) if description_parts else None,
        payload.industry,
        payload.size,
        payload.website,
    )

    tenant_id = str(tenant["id"])

    # Link current user as owner of this organization
    await _link_user_to_tenant_as_owner(db, str(current_user.user.id), tenant_id)

    # Create default community subscription for this organization
    try:
        await db.execute_one(
            """
            INSERT INTO core.subscriptions (id, tenant_id, plan_tier, billing_interval, status, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, 'community', NULL, 'active', NOW(), NOW())
            ON CONFLICT (tenant_id) DO NOTHING
            """,
            tenant_id,
        )
    except Exception as e:
        # If subscriptions table doesn't exist, that's ok
        logger.info(f"Could not create subscription: {e}")

    # Optionally create a default project for this org (non-critical)
    project_name = f"{payload.name} Project"
    import re as _re

    base_slug = _re.sub(r"[^a-z0-9-]", "-", payload.name.lower())
    base_slug = _re.sub(r"-+", "-", base_slug).strip("-") or "default-project"

    try:
        await db.execute_one(
            """
            INSERT INTO core.projects (id, tenant_id, name, slug, description, is_active, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
            RETURNING id
            """,
            tenant_id,
            project_name,
            base_slug,
            f"Default project for {payload.name}",
        )
    except Exception:
        # Project creation is best-effort; don't fail org creation.
        pass

    return OrganizationResponse(
        id=tenant["id"],
        name=tenant["name"],
        slug=tenant["slug"],
        is_active=tenant["is_active"],
        industry=tenant.get("industry"),
        company_size=tenant.get("company_size"),
        website=tenant.get("website"),
        logo_url=tenant.get("logo_url"),
    )


@router.get("/organizations/check-slug/{slug}", response_model=SlugAvailabilityResponse)
async def check_organization_slug(
    slug: str,
    db: DatabaseManager = Depends(get_database),
):
    """Check if an organization slug is available.

    Used by the onboarding UI for live slug validation.
    """

    normalized = _normalize_slug(slug)

    if not normalized or len(normalized) < 3:
        return SlugAvailabilityResponse(available=False)

    if normalized in RESERVED_SLUGS:
        return SlugAvailabilityResponse(available=False)

    existing = await db.execute_one(
        "SELECT 1 FROM core.tenants WHERE slug = $1",
        normalized,
    )

    return SlugAvailabilityResponse(available=existing is None)


@router.post("/subscriptions", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    payload: SubscriptionCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_database),
):
    """Create a simple subscription record for the current user's tenant.

    This is a lightweight implementation that records the selected plan and
    billing period without integrating with Stripe. It is enough to satisfy
    the onboarding flow and can be extended later with real billing logic.
    """

    if not current_user.tenant or not current_user.tenant.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current user does not have an active organization.",
        )

    plan_tier = _map_plan_id_to_tier(payload.plan_id)
    billing_interval = _map_billing_period_to_interval(payload.billing_period)
    checkout_session = None

    if _is_paid_plan(plan_tier):
        if not payload.payment_method_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Paid plans require a completed checkout session.",
            )
        if payload.payment_method_id.startswith("cs_"):
            checkout_session = _get_paid_checkout_session(payload.payment_method_id)

    # Basic validation
    if billing_interval is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid billing period. Use 'month' or 'year'.",
        )

    custom_limits = payload.custom_limits.model_dump(exclude_none=True) if payload.custom_limits else {}
    if plan_tier == "custom" and not custom_limits:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Custom subscriptions must include at least one custom limit.",
        )

    metadata = {"source": "onboarding"}
    trial_days = _get_trial_days_for_plan(plan_tier)
    trial_started_at = datetime.now(timezone.utc)
    trial_ends_at = trial_started_at + timedelta(days=trial_days) if trial_days > 0 else None

    metadata["trial_days"] = trial_days
    metadata["trial_started_at"] = trial_started_at.isoformat()
    if trial_ends_at:
        metadata["trial_ends_at"] = trial_ends_at.isoformat()

    if payload.payment_method_id:
        metadata["payment_method_id"] = payload.payment_method_id
    if custom_limits:
        metadata["custom_limits"] = custom_limits

    stripe_customer_id = None
    stripe_subscription_id = None
    stripe_currency = "USD"
    stripe_amount_cents = None
    period_start = None
    period_end = None
    cancel_at_period_end = False

    if checkout_session is not None:
        stripe_customer_id = getattr(checkout_session, "customer", None)
        stripe_subscription_id = getattr(checkout_session, "subscription", None)
        stripe_currency = (getattr(checkout_session, "currency", "usd") or "usd").upper()
        amount_total = getattr(checkout_session, "amount_total", None)
        stripe_amount_cents = int(amount_total) if isinstance(amount_total, int) else None
        metadata["checkout_session_id"] = getattr(checkout_session, "id", payload.payment_method_id)

        if stripe_subscription_id:
            try:
                stripe = _get_stripe_client()
                stripe_sub = stripe.Subscription.retrieve(stripe_subscription_id)
                current_period_start = getattr(stripe_sub, "current_period_start", None)
                current_period_end = getattr(stripe_sub, "current_period_end", None)
                if isinstance(current_period_start, int):
                    period_start = datetime.fromtimestamp(current_period_start, tz=timezone.utc)
                if isinstance(current_period_end, int):
                    period_end = datetime.fromtimestamp(current_period_end, tz=timezone.utc)
                cancel_at_period_end = bool(getattr(stripe_sub, "cancel_at_period_end", False))
                metadata["stripe_subscription_status"] = getattr(stripe_sub, "status", None)
            except Exception:
                # Best effort enrichment only
                pass

    status_value = "active" if checkout_session is not None and _is_paid_plan(plan_tier) else "trial"
    if plan_tier == "community":
        status_value = "active"

    tenant_id = str(current_user.tenant.id)

    query_attempts = [
        (
            """
            INSERT INTO core.subscriptions (
                id,
                tenant_id,
                plan_tier,
                billing_interval,
                status,
                stripe_customer_id,
                stripe_subscription_id,
                current_period_start,
                current_period_end,
                cancel_at_period_end,
                amount_cents,
                currency,
                monthly_test_runs_limit,
                max_projects,
                max_team_members,
                monthly_ai_requests_limit,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13,
                $14,
                $15,
                $16::jsonb,
                NOW(),
                NOW()
            )
            ON CONFLICT (tenant_id) DO UPDATE SET
                plan_tier = EXCLUDED.plan_tier,
                billing_interval = EXCLUDED.billing_interval,
                status = EXCLUDED.status,
                stripe_customer_id = EXCLUDED.stripe_customer_id,
                stripe_subscription_id = EXCLUDED.stripe_subscription_id,
                current_period_start = EXCLUDED.current_period_start,
                current_period_end = EXCLUDED.current_period_end,
                cancel_at_period_end = EXCLUDED.cancel_at_period_end,
                amount_cents = EXCLUDED.amount_cents,
                currency = EXCLUDED.currency,
                monthly_test_runs_limit = EXCLUDED.monthly_test_runs_limit,
                max_projects = EXCLUDED.max_projects,
                max_team_members = EXCLUDED.max_team_members,
                monthly_ai_requests_limit = EXCLUDED.monthly_ai_requests_limit,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
            RETURNING id, tenant_id, plan_tier, billing_interval, status,
                      monthly_test_runs_limit, max_projects, max_team_members, monthly_ai_requests_limit
            """,
            (
                tenant_id,
                plan_tier,
                billing_interval,
                status_value,
                stripe_customer_id,
                stripe_subscription_id,
                period_start,
                period_end,
                cancel_at_period_end,
                stripe_amount_cents,
                stripe_currency,
                custom_limits.get("monthly_test_runs_limit"),
                custom_limits.get("max_projects"),
                custom_limits.get("max_team_members"),
                custom_limits.get("monthly_ai_requests_limit"),
                metadata,
            ),
        ),
        (
            """
            INSERT INTO core.subscriptions (
                id,
                tenant_id,
                plan_tier,
                billing_interval,
                status,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                $4,
                $5::jsonb,
                NOW(),
                NOW()
            )
            ON CONFLICT (tenant_id) DO UPDATE SET
                plan_tier = EXCLUDED.plan_tier,
                billing_interval = EXCLUDED.billing_interval,
                status = EXCLUDED.status,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
            RETURNING id, tenant_id, plan_tier, billing_interval, status
            """,
            (
                tenant_id,
                plan_tier,
                billing_interval,
                status_value,
                metadata,
            ),
        ),
        (
            """
            INSERT INTO core.subscriptions (
                id,
                tenant_id,
                plan_tier,
                billing_interval,
                status,
                monthly_test_runs_limit,
                max_projects,
                max_team_members,
                monthly_ai_requests_limit,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9::jsonb,
                NOW(),
                NOW()
            )
            RETURNING id, tenant_id, plan_tier, billing_interval, status,
                      monthly_test_runs_limit, max_projects, max_team_members, monthly_ai_requests_limit
            """,
            (
                tenant_id,
                plan_tier,
                billing_interval,
                status_value,
                custom_limits.get("monthly_test_runs_limit"),
                custom_limits.get("max_projects"),
                custom_limits.get("max_team_members"),
                custom_limits.get("monthly_ai_requests_limit"),
                metadata,
            ),
        ),
        (
            """
            INSERT INTO core.subscriptions (
                id,
                tenant_id,
                plan_tier,
                billing_interval,
                status,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                $4,
                $5::jsonb,
                NOW(),
                NOW()
            )
            RETURNING id, tenant_id, plan_tier, billing_interval, status
            """,
            (
                tenant_id,
                plan_tier,
                billing_interval,
                status_value,
                metadata,
            ),
        ),
    ]

    subscription = None
    last_error = None
    for query, params in query_attempts:
        try:
            subscription = await db.execute_one(query, *params)
            if subscription:
                break
        except Exception as e:
            last_error = e

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create subscription: {last_error}",
        )

    try:
        await enforce_self_host_license_state(db, tenant_id)
    except Exception as exc:
        logger.warning("Failed to sync self-host license state for tenant %s: %s", tenant_id, exc)

    return SubscriptionResponse(
        id=subscription["id"],
        tenant_id=subscription["tenant_id"],
        plan_tier=subscription["plan_tier"],
        billing_interval=subscription["billing_interval"],
        status=subscription["status"],
        trial_ends_at=trial_ends_at,
        trial_expired=False,
        trial_days_remaining=trial_days if trial_days > 0 else None,
        monthly_test_runs_limit=subscription.get("monthly_test_runs_limit", custom_limits.get("monthly_test_runs_limit")),
        max_projects=subscription.get("max_projects", custom_limits.get("max_projects")),
        max_team_members=subscription.get("max_team_members", custom_limits.get("max_team_members")),
        monthly_ai_requests_limit=subscription.get("monthly_ai_requests_limit", custom_limits.get("monthly_ai_requests_limit")),
    )


@router.get("/subscriptions/current", response_model=SubscriptionResponse)
async def get_current_subscription(
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_database),
):
    """Get the current subscription for the user's tenant/organization."""
    
    if not current_user.tenant or not current_user.tenant.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current user does not have an active organization.",
        )
    
    tenant_id = str(current_user.tenant.id)

    query_attempts = [
        """
        SELECT
            id,
            tenant_id,
            plan_tier,
            billing_interval,
            status,
            monthly_test_runs_limit,
            max_projects,
            max_team_members,
            monthly_ai_requests_limit,
            metadata,
            created_at,
            updated_at
        FROM core.subscriptions
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        """,
        """
        SELECT
            id,
            tenant_id,
            plan_tier,
            billing_interval,
            status,
            NULL::INTEGER as monthly_test_runs_limit,
            NULL::INTEGER as max_projects,
            NULL::INTEGER as max_team_members,
            NULL::INTEGER as monthly_ai_requests_limit,
            metadata,
            created_at,
            updated_at
        FROM core.subscriptions
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        """,
        """
        SELECT
            id,
            tenant_id,
            plan_tier,
            NULL::TEXT as billing_interval,
            status,
            NULL::INTEGER as monthly_test_runs_limit,
            NULL::INTEGER as max_projects,
            NULL::INTEGER as max_team_members,
            NULL::INTEGER as monthly_ai_requests_limit,
            metadata,
            created_at,
            updated_at
        FROM core.subscriptions
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        """,
    ]

    subscription = None
    last_error = None
    for query in query_attempts:
        try:
            subscription = await db.execute_one(query, tenant_id)
            break
        except Exception as e:
            last_error = e
            continue

    if subscription is None and last_error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load subscription: {last_error}",
        )

    limits = await get_effective_limits(db, tenant_id)
    
    if not subscription:
        # Return a default free plan if no subscription exists
        return SubscriptionResponse(
            id="00000000-0000-0000-0000-000000000000",
            tenant_id=current_user.tenant.id,
            plan_tier="community",
            billing_interval=None,
            status="active",
            trial_ends_at=None,
            trial_expired=False,
            trial_days_remaining=None,
            monthly_test_runs_limit=limits["monthly_test_runs_limit"],
            max_projects=limits["max_projects"],
            max_team_members=limits["max_team_members"],
        )

    trial_details = _extract_trial_details(subscription)
    effective_plan_tier = limits.get("plan_tier", subscription["plan_tier"])
    
    return SubscriptionResponse(
        id=subscription["id"],
        tenant_id=subscription["tenant_id"],
        plan_tier=effective_plan_tier,
        billing_interval=subscription["billing_interval"],
        status=subscription["status"],
        trial_ends_at=trial_details["trial_ends_at"],
        trial_expired=trial_details["trial_expired"],
        trial_days_remaining=trial_details["trial_days_remaining"],
        monthly_test_runs_limit=limits["monthly_test_runs_limit"],
        max_projects=limits["max_projects"],
        max_team_members=limits["max_team_members"],
        monthly_ai_requests_limit=subscription.get("monthly_ai_requests_limit"),
    )


class UsageStats(BaseModel):
    test_executions: int
    team_members: int
    team_member_limit: int
    ai_requests: int


class OrganizationDeleteRequest(BaseModel):
    confirm_slug: str = Field(..., min_length=3, max_length=255)
    hard_delete: bool = False


class OrganizationDeleteResponse(BaseModel):
    status: str
    tenant_id: UUID
    message: str


@router.get("/usage/stats", response_model=UsageStats)
async def get_usage_stats(
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_database),
):
    """Get usage statistics for the current tenant/organization."""
    
    if not current_user.tenant or not current_user.tenant.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current user does not have an active organization.",
        )
    
    tenant_id = str(current_user.tenant.id)
    
    # Get test execution and member usage using the same logic as enforcement.
    test_executions = await count_monthly_test_runs(db, tenant_id)
    team_members = await count_active_team_members(db, tenant_id)
    
    # Get AI request count (from healing actions)
    # Healing actions might not have tenant_id, so we'll use a similar join
    # If table doesn't exist, return 0
    try:
        ai_requests = await db.execute_one(
            """
            SELECT COUNT(*) as count
            FROM healing.healing_actions ha
            INNER JOIN exec.step_results sr ON ha.step_result_id = sr.id
            INNER JOIN exec.runs r ON sr.test_run_id = r.id
            INNER JOIN tests.test_cases tc ON r.test_case_id = tc.id
            INNER JOIN core.projects p ON tc.project_id = p.id
            WHERE p.tenant_id = $1
            AND ha.created_at >= DATE_TRUNC('month', CURRENT_DATE)
            """,
            tenant_id,
        )
        ai_count = ai_requests["count"] if ai_requests else 0
    except Exception:
        # Table might not exist yet
        ai_count = 0
    
    limits = await get_effective_limits(db, tenant_id)
    team_member_limit = limits["max_team_members"] if limits["max_team_members"] is not None else 9999
    
    return UsageStats(
        test_executions=test_executions,
        team_members=team_members,
        team_member_limit=team_member_limit,
        ai_requests=ai_count,
    )


async def _assert_owner_for_tenant(db: DatabaseManager, tenant_id: str, user_id: str) -> None:
    owner_record = await db.execute_one(
        """
        SELECT 1
        FROM core.organization_members
        WHERE tenant_id = $1 AND user_id = $2 AND status = 'active' AND LOWER(role) = 'owner'
        LIMIT 1
        """,
        tenant_id,
        user_id,
    )

    if owner_record:
        return

    fallback_record = await db.execute_one(
        """
        SELECT 1
        FROM core.user_tenant_roles utr
        JOIN core.roles r ON r.id = utr.role_id
        WHERE utr.tenant_id = $1
          AND utr.user_id = $2
          AND utr.is_active = true
          AND LOWER(r.name) = 'owner'
        LIMIT 1
        """,
        tenant_id,
        user_id,
    )

    if not fallback_record:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization owners can delete an organization.",
        )


@router.delete("/organizations/current", response_model=OrganizationDeleteResponse)
async def delete_current_organization(
    payload: OrganizationDeleteRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_database),
):
    if not current_user.tenant or not current_user.tenant.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current user does not have an active organization.",
        )

    tenant_id = str(current_user.tenant.id)
    user_id = str(current_user.user.id)

    tenant = await db.execute_one(
        "SELECT id, slug, name FROM core.tenants WHERE id = $1",
        tenant_id,
    )

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found.",
        )

    normalized_confirm_slug = _normalize_slug(payload.confirm_slug)
    if normalized_confirm_slug != tenant["slug"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation slug does not match the current organization.",
        )

    await _assert_owner_for_tenant(db, tenant_id, user_id)

    if payload.hard_delete:
        try:
            async with db.get_connection() as conn:
                async with conn.transaction():
                    await conn.execute("DELETE FROM core.organization_members WHERE tenant_id = $1", tenant_id)
                    await conn.execute("DELETE FROM core.user_tenant_roles WHERE tenant_id = $1", tenant_id)
                    await conn.execute("DELETE FROM core.subscriptions WHERE tenant_id = $1", tenant_id)
                    await conn.execute("DELETE FROM core.projects WHERE tenant_id = $1", tenant_id)
                    await conn.execute("DELETE FROM core.organizations WHERE tenant_id = $1", tenant_id)
                    await conn.execute("DELETE FROM core.tenants WHERE id = $1", tenant_id)

            return OrganizationDeleteResponse(
                status="deleted",
                tenant_id=current_user.tenant.id,
                message="Organization and core tenant records permanently deleted.",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Hard delete failed due to dependent data constraints. "
                    "Use soft delete first or remove dependent records before hard delete."
                ),
            ) from exc

    try:
        await db.execute_command(
            """
            UPDATE core.subscriptions
            SET status = 'canceled', cancel_at_period_end = true, canceled_at = NOW(), updated_at = NOW()
            WHERE tenant_id = $1
            """,
            tenant_id,
        )
    except Exception:
        await db.execute_command(
            """
            UPDATE core.subscriptions
            SET status = 'canceled', updated_at = NOW()
            WHERE tenant_id = $1
            """,
            tenant_id,
        )

    await db.execute_command(
        "UPDATE core.projects SET is_active = false, updated_at = NOW() WHERE tenant_id = $1",
        tenant_id,
    )

    await db.execute_command(
        "UPDATE core.organization_members SET status = 'inactive' WHERE tenant_id = $1",
        tenant_id,
    )

    await db.execute_command(
        "UPDATE core.user_tenant_roles SET is_active = false, updated_at = NOW() WHERE tenant_id = $1",
        tenant_id,
    )

    await db.execute_command(
        "UPDATE core.tenants SET is_active = false, updated_at = NOW() WHERE id = $1",
        tenant_id,
    )

    return OrganizationDeleteResponse(
        status="deactivated",
        tenant_id=current_user.tenant.id,
        message="Organization deactivated and subscription canceled. Use hard_delete=true for irreversible deletion.",
    )

