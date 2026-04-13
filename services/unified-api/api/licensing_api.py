import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field

from core.auth import get_current_user
from core.database import DatabaseManager, get_database
from models.auth_models import CurrentUser
from services.self_host_licensing import (
    enforce_self_host_license_state,
    get_license_status,
    issue_self_host_license,
    revoke_self_host_license,
    validate_self_host_license,
)

router = APIRouter(prefix="/api/v1/licensing", tags=["Licensing"])


class IssueSelfHostLicenseRequest(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=1000)


class IssueSelfHostLicenseResponse(BaseModel):
    tenant_id: str
    license_key: str
    plan_tier: str
    subscription_status: str


class RevokeSelfHostLicenseRequest(BaseModel):
    reason: str = Field(default="manual_revoke", min_length=3, max_length=200)


class RevokeSelfHostLicenseResponse(BaseModel):
    tenant_id: str
    revoked: bool
    reason: str


class SelfHostLicenseStatusResponse(BaseModel):
    tenant_id: str
    entitlement_active: bool
    entitlement_reason: str
    plan_tier: str
    subscription_status: str
    license_present: bool
    license_active: bool
    issued_at: Optional[str] = None
    revoked_at: Optional[str] = None
    revoked_reason: Optional[str] = None
    last_validated_at: Optional[str] = None
    last_validation_node_id: Optional[str] = None


class ValidateSelfHostLicenseRequest(BaseModel):
    tenant_slug: str = Field(..., min_length=2, max_length=255)
    license_key: str = Field(..., min_length=20, max_length=512)
    node_id: Optional[str] = Field(default=None, max_length=255)


class ValidateSelfHostLicenseResponse(BaseModel):
    valid: bool
    reason: str
    plan_tier: Optional[str] = None
    subscription_status: Optional[str] = None
    next_check_in_seconds: int = 300
    checked_at: Optional[str] = None


async def _assert_owner_or_admin(db: DatabaseManager, tenant_id: str, user_id: str) -> None:
    role_record = await db.execute_one(
        """
        SELECT LOWER(role) AS role
        FROM core.organization_members
        WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
        LIMIT 1
        """,
        tenant_id,
        user_id,
    )

    role = str(role_record.get("role", "")).lower() if role_record else ""
    if role in {"owner", "admin"}:
        return

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
    fallback_role = str(fallback_role_record.get("role", "")).lower() if fallback_role_record else ""

    if fallback_role not in {"owner", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization owners or admins can manage self-host licenses.",
        )


@router.post("/self-host/issue", response_model=IssueSelfHostLicenseResponse)
async def issue_license(
    payload: IssueSelfHostLicenseRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_database),
):
    if not current_user.tenant or not current_user.tenant.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active organization found.")

    tenant_id = str(current_user.tenant.id)
    user_id = str(current_user.user.id)
    await _assert_owner_or_admin(db, tenant_id, user_id)

    try:
        license_key, entitlement = await issue_self_host_license(
            db,
            tenant_id=tenant_id,
            issued_by_user_id=user_id,
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tenant is not eligible for self-host licensing ({str(exc)}).",
        ) from exc

    return IssueSelfHostLicenseResponse(
        tenant_id=tenant_id,
        license_key=license_key,
        plan_tier=entitlement["plan_tier"],
        subscription_status=entitlement["status"],
    )


@router.post("/self-host/revoke", response_model=RevokeSelfHostLicenseResponse)
async def revoke_license(
    payload: RevokeSelfHostLicenseRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_database),
):
    if not current_user.tenant or not current_user.tenant.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active organization found.")

    tenant_id = str(current_user.tenant.id)
    user_id = str(current_user.user.id)
    await _assert_owner_or_admin(db, tenant_id, user_id)

    revoked = await revoke_self_host_license(db, tenant_id=tenant_id, reason=payload.reason)
    return RevokeSelfHostLicenseResponse(tenant_id=tenant_id, revoked=revoked, reason=payload.reason)


@router.get("/self-host/status", response_model=SelfHostLicenseStatusResponse)
async def get_status(
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_database),
):
    if not current_user.tenant or not current_user.tenant.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active organization found.")

    tenant_id = str(current_user.tenant.id)
    user_id = str(current_user.user.id)
    await _assert_owner_or_admin(db, tenant_id, user_id)

    status_data = await get_license_status(db, tenant_id)
    entitlement = status_data["entitlement"]

    return SelfHostLicenseStatusResponse(
        tenant_id=tenant_id,
        entitlement_active=bool(entitlement["entitled"]),
        entitlement_reason=str(entitlement["reason"]),
        plan_tier=str(entitlement["plan_tier"]),
        subscription_status=str(entitlement["status"]),
        license_present=bool(status_data["license_present"]),
        license_active=bool(status_data["license_active"]),
        issued_at=status_data["issued_at"].isoformat() if status_data["issued_at"] else None,
        revoked_at=status_data["revoked_at"].isoformat() if status_data["revoked_at"] else None,
        revoked_reason=status_data["revoked_reason"],
        last_validated_at=status_data["last_validated_at"].isoformat() if status_data["last_validated_at"] else None,
        last_validation_node_id=status_data["last_validation_node_id"],
    )


@router.post("/self-host/validate", response_model=ValidateSelfHostLicenseResponse)
async def validate_license(
    payload: ValidateSelfHostLicenseRequest,
    request: Request,
    db: DatabaseManager = Depends(get_database),
    validation_token: Optional[str] = Header(None, alias="X-License-Validation-Token"),
):
    expected_token = os.getenv("SELF_HOST_LICENSE_VALIDATION_TOKEN", "").strip()
    if expected_token and validation_token != expected_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid license validation token.",
        )

    source_ip = request.client.host if request.client else None

    result = await validate_self_host_license(
        db,
        tenant_slug=payload.tenant_slug,
        license_key=payload.license_key,
        node_id=payload.node_id,
        source_ip=source_ip,
    )

    if not result.get("valid") and result.get("reason") in {"plan_not_eligible", "subscription_inactive"}:
        tenant = await db.execute_one(
            "SELECT id FROM core.tenants WHERE slug = $1 LIMIT 1",
            payload.tenant_slug.strip().lower(),
        )
        if tenant:
            await enforce_self_host_license_state(db, str(tenant["id"]))

    return ValidateSelfHostLicenseResponse(
        valid=bool(result.get("valid")),
        reason=str(result.get("reason") or "invalid_tenant_or_license"),
        plan_tier=result.get("plan_tier"),
        subscription_status=result.get("subscription_status"),
        next_check_in_seconds=int(result.get("next_check_in_seconds") or 300),
        checked_at=result.get("checked_at"),
    )
