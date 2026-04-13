import os
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from core.database import DatabaseManager, get_database
from core.auth import get_current_user
from models.auth_models import CurrentUser
from services.self_host_licensing import enforce_self_host_license_state
from services.subscription_limits import get_effective_limits


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/billing", tags=["Billing"])


class CreateCheckoutSessionRequest(BaseModel):
    plan_id: str = Field(..., min_length=1)
    billing_period: str = Field(..., pattern="^(month|year)$")
    customer_email: EmailStr
    success_url: str = Field(..., min_length=1)
    cancel_url: str = Field(..., min_length=1)


class CreateCheckoutSessionResponse(BaseModel):
    session_id: str
    checkout_url: str


class CheckoutSessionStatusResponse(BaseModel):
    session_id: str
    status: str
    payment_status: str
    is_paid: bool


class StripeWebhookResponse(BaseModel):
    received: bool
    event_type: str
    updated: bool = False


class CustomerPortalRequest(BaseModel):
    return_url: str = Field(..., min_length=1)


class CustomerPortalResponse(BaseModel):
    url: str


class CancelSubscriptionRequest(BaseModel):
    cancel_at_period_end: bool = True


class SubscriptionActionResponse(BaseModel):
    status: str
    message: str
    tenant_id: str
    stripe_subscription_id: Optional[str] = None


async def _get_latest_subscription_for_tenant(db: DatabaseManager, tenant_id: str) -> Optional[dict]:
    return await db.execute_one(
        """
        SELECT id, tenant_id, status, stripe_subscription_id, stripe_customer_id
        FROM core.subscriptions
        WHERE tenant_id = $1
        ORDER BY updated_at DESC, created_at DESC
        LIMIT 1
        """,
        tenant_id,
    )


async def _assert_billing_admin(db: DatabaseManager, tenant_id: str, user_id: str) -> str:
    role_record = await db.execute_one(
        """
        SELECT om.role AS role
        FROM core.organization_members om
        WHERE om.tenant_id = $1 AND om.user_id = $2 AND om.status = 'active'
        LIMIT 1
        """,
        tenant_id,
        user_id,
    )

    if role_record and role_record.get("role"):
        role = str(role_record["role"]).lower()
    else:
        fallback_role_record = await db.execute_one(
            """
            SELECT LOWER(r.name) AS role
            FROM core.user_tenant_roles utr
            JOIN core.roles r ON r.id = utr.role_id
            WHERE utr.tenant_id = $1 AND utr.user_id = $2 AND utr.is_active = true
            LIMIT 1
            """,
            tenant_id,
            user_id,
        )
        role = str(fallback_role_record["role"]).lower() if fallback_role_record and fallback_role_record.get("role") else ""

    if role not in {"owner", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization owners or admins can manage subscription status.",
        )

    return role


def _get_plan_price_cents(plan_id: str, billing_period: str) -> int:
    normalized_plan = (plan_id or "").lower()
    normalized_period = (billing_period or "").lower()

    if normalized_plan in {"community", "free"}:
        return 0
    if normalized_plan in {"enterprise", "custom"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enterprise and custom plans require sales-assisted billing.",
        )

    if normalized_plan == "professional":
        monthly = 9900
    elif normalized_plan == "starter":
        monthly = 2900
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported plan for checkout: {plan_id}",
        )

    if normalized_period == "year":
        return int(round(monthly * 12 * 0.8))
    return monthly


def _get_stripe_client():
    try:
        import stripe
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe SDK not installed on API server.",
        ) from exc

    stripe_secret_key = os.getenv("STRIPE_SECRET_KEY")
    if not stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing is not configured. Set STRIPE_SECRET_KEY.",
        )

    stripe.api_key = stripe_secret_key
    return stripe


def _parse_stripe_timestamp(value: Any) -> Optional[datetime]:
    if not isinstance(value, int):
        return None
    return datetime.fromtimestamp(value, tz=timezone.utc)


def _map_stripe_status(stripe_status: Optional[str]) -> str:
    normalized = (stripe_status or "").lower()
    status_map = {
        "trialing": "trial",
        "active": "active",
        "past_due": "past_due",
        "canceled": "canceled",
        "unpaid": "unpaid",
        "incomplete": "incomplete",
        "incomplete_expired": "unpaid",
        "paused": "past_due",
    }
    return status_map.get(normalized, "active")


async def _update_subscription_from_event(
    db: DatabaseManager,
    *,
    stripe_subscription_id: Optional[str],
    stripe_customer_id: Optional[str],
    stripe_status: Optional[str],
    current_period_start: Optional[int],
    current_period_end: Optional[int],
    cancel_at_period_end: Optional[bool],
    canceled_at: Optional[int],
) -> bool:
    if not stripe_subscription_id and not stripe_customer_id:
        return False

    mapped_status = _map_stripe_status(stripe_status)
    period_start_dt = _parse_stripe_timestamp(current_period_start)
    period_end_dt = _parse_stripe_timestamp(current_period_end)
    canceled_at_dt = _parse_stripe_timestamp(canceled_at)
    cancel_at_period_end_value = bool(cancel_at_period_end) if cancel_at_period_end is not None else False

    query = """
        UPDATE core.subscriptions
        SET
            status = $1,
            stripe_customer_id = COALESCE($2, stripe_customer_id),
            stripe_subscription_id = COALESCE($3, stripe_subscription_id),
            current_period_start = COALESCE($4, current_period_start),
            current_period_end = COALESCE($5, current_period_end),
            cancel_at_period_end = $6,
            canceled_at = COALESCE($7, canceled_at),
            updated_at = NOW()
        WHERE stripe_subscription_id = $3 OR stripe_customer_id = $2
        RETURNING tenant_id
    """

    try:
        updated_row = await db.execute_one(
            query,
            mapped_status,
            stripe_customer_id,
            stripe_subscription_id,
            period_start_dt,
            period_end_dt,
            cancel_at_period_end_value,
            canceled_at_dt,
        )
        if not updated_row:
            return False

        await enforce_self_host_license_state(db, str(updated_row["tenant_id"]))
        return True
    except Exception:
        # Fallback for schemas missing some billing columns
        fallback = await db.execute_command(
            """
            UPDATE core.subscriptions
            SET status = $1, updated_at = NOW()
            WHERE stripe_subscription_id = $2 OR stripe_customer_id = $3
            """,
            mapped_status,
            stripe_subscription_id,
            stripe_customer_id,
        )
        updated = not fallback.endswith(" 0")
        if updated:
            tenant_row = await db.execute_one(
                """
                SELECT tenant_id
                FROM core.subscriptions
                WHERE stripe_subscription_id = $1 OR stripe_customer_id = $2
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                stripe_subscription_id,
                stripe_customer_id,
            )
            if tenant_row:
                try:
                    await enforce_self_host_license_state(db, str(tenant_row["tenant_id"]))
                except Exception as exc:
                    logger.warning("Failed to sync self-host license state for tenant %s: %s", tenant_row["tenant_id"], exc)
        return updated


@router.post("/checkout-session", response_model=CreateCheckoutSessionResponse)
async def create_checkout_session(
    payload: CreateCheckoutSessionRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    stripe = _get_stripe_client()
    amount_cents = _get_plan_price_cents(payload.plan_id, payload.billing_period)
    if amount_cents <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected plan does not require online checkout.",
        )

    recurring_interval = "year" if payload.billing_period == "year" else "month"

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer_email=payload.customer_email,
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": amount_cents,
                    "recurring": {"interval": recurring_interval},
                    "product_data": {
                        "name": f"{payload.plan_id.capitalize()} Plan",
                        "description": "FluxTest subscription",
                    },
                },
                "quantity": 1,
            }
        ],
        success_url=payload.success_url,
        cancel_url=payload.cancel_url,
        allow_promotion_codes=True,
        metadata={
            "plan_id": payload.plan_id,
            "billing_period": payload.billing_period,
        },
    )

    return CreateCheckoutSessionResponse(
        session_id=session.id,
        checkout_url=session.url,
    )


@router.get("/checkout-session/{session_id}", response_model=CheckoutSessionStatusResponse)
async def get_checkout_session_status(session_id: str):
    stripe = _get_stripe_client()

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Checkout session not found: {session_id}",
        ) from exc

    payment_status = getattr(session, "payment_status", "unpaid")
    status_value = getattr(session, "status", "open")
    is_paid = payment_status in {"paid", "no_payment_required"}

    return CheckoutSessionStatusResponse(
        session_id=session.id,
        status=status_value,
        payment_status=payment_status,
        is_paid=is_paid,
    )


@router.post("/portal-session", response_model=CustomerPortalResponse)
async def create_customer_portal_session(
    payload: CustomerPortalRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_database),
):
    if not current_user.tenant or not current_user.tenant.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current user does not have an active organization.",
        )

    subscription = await db.execute_one(
        """
        SELECT stripe_customer_id
        FROM core.subscriptions
        WHERE tenant_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        str(current_user.tenant.id),
    )

    stripe_customer_id = subscription.get("stripe_customer_id") if subscription else None
    if not stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Stripe customer found for this organization yet.",
        )

    stripe = _get_stripe_client()
    portal_session = stripe.billing_portal.Session.create(
        customer=stripe_customer_id,
        return_url=payload.return_url,
    )

    return CustomerPortalResponse(url=portal_session.url)


@router.post("/subscription/cancel", response_model=SubscriptionActionResponse)
async def cancel_subscription(
    payload: CancelSubscriptionRequest,
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
    await _assert_billing_admin(db, tenant_id, user_id)

    subscription = await _get_latest_subscription_for_tenant(db, tenant_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No subscription found for this organization.",
        )

    stripe_subscription_id = subscription.get("stripe_subscription_id")

    if stripe_subscription_id:
        stripe = _get_stripe_client()
        if payload.cancel_at_period_end:
            stripe.Subscription.modify(stripe_subscription_id, cancel_at_period_end=True)
        else:
            stripe.Subscription.delete(stripe_subscription_id)

    if payload.cancel_at_period_end:
        try:
            await db.execute_command(
                """
                UPDATE core.subscriptions
                SET cancel_at_period_end = true, updated_at = NOW()
                WHERE tenant_id = $1
                """,
                tenant_id,
            )
        except Exception:
            await db.execute_command(
                """
                UPDATE core.subscriptions
                SET status = 'active', updated_at = NOW()
                WHERE tenant_id = $1
                """,
                tenant_id,
            )

        try:
            await enforce_self_host_license_state(db, tenant_id)
        except Exception as exc:
            logger.warning("Failed to sync self-host license state for tenant %s: %s", tenant_id, exc)

        return SubscriptionActionResponse(
            status="active",
            message="Subscription will be canceled at the end of the current billing period.",
            tenant_id=tenant_id,
            stripe_subscription_id=stripe_subscription_id,
        )

    try:
        await db.execute_command(
            """
            UPDATE core.subscriptions
            SET status = 'canceled', cancel_at_period_end = false, canceled_at = NOW(), updated_at = NOW()
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

    try:
        await enforce_self_host_license_state(db, tenant_id)
    except Exception as exc:
        logger.warning("Failed to sync self-host license state for tenant %s: %s", tenant_id, exc)

    return SubscriptionActionResponse(
        status="canceled",
        message="Subscription canceled immediately.",
        tenant_id=tenant_id,
        stripe_subscription_id=stripe_subscription_id,
    )


@router.post("/subscription/pause", response_model=SubscriptionActionResponse)
async def pause_subscription(
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
    await _assert_billing_admin(db, tenant_id, user_id)

    subscription = await _get_latest_subscription_for_tenant(db, tenant_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No subscription found for this organization.",
        )

    stripe_subscription_id = subscription.get("stripe_subscription_id")
    if stripe_subscription_id:
        stripe = _get_stripe_client()
        stripe.Subscription.modify(
            stripe_subscription_id,
            pause_collection={"behavior": "mark_uncollectible"},
        )

    await db.execute_command(
        """
        UPDATE core.subscriptions
        SET status = 'paused', updated_at = NOW()
        WHERE tenant_id = $1
        """,
        tenant_id,
    )

    try:
        await enforce_self_host_license_state(db, tenant_id)
    except Exception as exc:
        logger.warning("Failed to sync self-host license state for tenant %s: %s", tenant_id, exc)

    return SubscriptionActionResponse(
        status="paused",
        message="Subscription paused.",
        tenant_id=tenant_id,
        stripe_subscription_id=stripe_subscription_id,
    )


@router.post("/subscription/resume", response_model=SubscriptionActionResponse)
async def resume_subscription(
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
    await _assert_billing_admin(db, tenant_id, user_id)

    subscription = await _get_latest_subscription_for_tenant(db, tenant_id)
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No subscription found for this organization.",
        )

    stripe_subscription_id = subscription.get("stripe_subscription_id")
    if stripe_subscription_id:
        stripe = _get_stripe_client()
        stripe.Subscription.modify(stripe_subscription_id, pause_collection="")

    await db.execute_command(
        """
        UPDATE core.subscriptions
        SET status = 'active', cancel_at_period_end = false, updated_at = NOW()
        WHERE tenant_id = $1
        """,
        tenant_id,
    )

    try:
        await enforce_self_host_license_state(db, tenant_id)
    except Exception as exc:
        logger.warning("Failed to sync self-host license state for tenant %s: %s", tenant_id, exc)

    return SubscriptionActionResponse(
        status="active",
        message="Subscription resumed.",
        tenant_id=tenant_id,
        stripe_subscription_id=stripe_subscription_id,
    )


@router.post("/webhook", response_model=StripeWebhookResponse)
async def stripe_webhook(
    request: Request,
    db: DatabaseManager = Depends(get_database),
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
):
    stripe = _get_stripe_client()
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Billing webhook is not configured. Set STRIPE_WEBHOOK_SECRET.",
        )

    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, webhook_secret)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Stripe webhook signature.",
        ) from exc

    event_type = event.get("type", "unknown")
    data_object = event.get("data", {}).get("object", {})
    updated = False

    if event_type in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        updated = await _update_subscription_from_event(
            db,
            stripe_subscription_id=data_object.get("id"),
            stripe_customer_id=data_object.get("customer"),
            stripe_status=data_object.get("status"),
            current_period_start=data_object.get("current_period_start"),
            current_period_end=data_object.get("current_period_end"),
            cancel_at_period_end=data_object.get("cancel_at_period_end"),
            canceled_at=data_object.get("canceled_at"),
        )

    elif event_type == "invoice.payment_failed":
        updated = await _update_subscription_from_event(
            db,
            stripe_subscription_id=data_object.get("subscription"),
            stripe_customer_id=data_object.get("customer"),
            stripe_status="past_due",
            current_period_start=None,
            current_period_end=None,
            cancel_at_period_end=None,
            canceled_at=None,
        )

    elif event_type == "invoice.payment_succeeded":
        updated = await _update_subscription_from_event(
            db,
            stripe_subscription_id=data_object.get("subscription"),
            stripe_customer_id=data_object.get("customer"),
            stripe_status="active",
            current_period_start=None,
            current_period_end=data_object.get("period_end"),
            cancel_at_period_end=None,
            canceled_at=None,
        )

    return StripeWebhookResponse(received=True, event_type=event_type, updated=updated)


class SubscriptionStatusResponse(BaseModel):
    is_active: bool
    plan_tier: str
    subscription_status: str
    billing_inactive: bool
    trial_expired: bool
    payment_issue: bool
    portal_url: Optional[str] = None


@router.get("/subscription-status", response_model=SubscriptionStatusResponse)
async def get_subscription_status(
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_database),
):
    """
    Returns the current subscription state for the authenticated user's
    organization.  The frontend uses this to decide whether to gate the UI.
    """
    if not current_user.tenant or not current_user.tenant.id:
        return SubscriptionStatusResponse(
            is_active=False,
            plan_tier="community",
            subscription_status="none",
            billing_inactive=True,
            trial_expired=False,
            payment_issue=False,
        )

    tenant_id = str(current_user.tenant.id)
    limits = await get_effective_limits(db, tenant_id)

    is_active = not limits["billing_inactive"] and not limits["trial_expired"]

    return SubscriptionStatusResponse(
        is_active=is_active,
        plan_tier=limits["plan_tier"],
        subscription_status=limits["subscription_status"],
        billing_inactive=limits["billing_inactive"],
        trial_expired=limits["trial_expired"],
        payment_issue=limits.get("payment_issue", False),
    )
