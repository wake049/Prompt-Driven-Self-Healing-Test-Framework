"""
Mobile Device Profile API — manage mobile/tablet device profiles
for responsive test execution via Chrome DevTools mobile emulation.

Endpoints:
  GET    /api/v1/device-profiles           — list available profiles (built-in + org custom)
  GET    /api/v1/device-profiles/:id        — get single profile
  POST   /api/v1/device-profiles           — create a custom device profile
  PUT    /api/v1/device-profiles/:id        — update a custom profile
  DELETE /api/v1/device-profiles/:id        — delete a custom profile
"""

import json
import logging
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from core.database import DatabaseManager, get_database_manager
from core.auth import get_current_active_user, CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()

BUILTIN_ORG_ID = "00000000-0000-0000-0000-000000000000"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class DeviceProfileCreate(BaseModel):
    profile_name: str = Field(max_length=100)
    device_type: str = Field(default="mobile", pattern="^(mobile|tablet|desktop)$")
    device_name: str = Field(max_length=100)
    width: int = Field(ge=200, le=3840)
    height: int = Field(ge=200, le=3840)
    device_scale_factor: float = Field(default=2.0, ge=1.0, le=4.0)
    user_agent: str
    is_mobile: bool = True
    has_touch: bool = True
    is_landscape: bool = False


class DeviceProfileUpdate(BaseModel):
    profile_name: Optional[str] = Field(default=None, max_length=100)
    device_type: Optional[str] = Field(default=None, pattern="^(mobile|tablet|desktop)$")
    device_name: Optional[str] = Field(default=None, max_length=100)
    width: Optional[int] = Field(default=None, ge=200, le=3840)
    height: Optional[int] = Field(default=None, ge=200, le=3840)
    device_scale_factor: Optional[float] = Field(default=None, ge=1.0, le=4.0)
    user_agent: Optional[str] = None
    is_mobile: Optional[bool] = None
    has_touch: Optional[bool] = None
    is_landscape: Optional[bool] = None


class DeviceProfileResponse(BaseModel):
    id: str
    organization_id: str
    profile_name: str
    device_type: str
    device_name: str
    width: int
    height: int
    device_scale_factor: float
    user_agent: str
    is_mobile: bool
    has_touch: bool
    is_landscape: bool
    is_builtin: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_db() -> DatabaseManager:
    return await get_database_manager()


def _row_to_response(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "organization_id": str(row["organization_id"]),
        "profile_name": row["profile_name"],
        "device_type": row["device_type"],
        "device_name": row["device_name"],
        "width": row["width"],
        "height": row["height"],
        "device_scale_factor": float(row["device_scale_factor"]),
        "user_agent": row["user_agent"],
        "is_mobile": row["is_mobile"],
        "has_touch": row["has_touch"],
        "is_landscape": row["is_landscape"],
        "is_builtin": row["is_builtin"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_device_profiles(
    device_type: Optional[str] = Query(default=None, description="Filter by device_type: mobile, tablet, desktop"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: DatabaseManager = Depends(_get_db),
):
    """Return all device profiles visible to the user's organization (built-ins + custom)."""
    org_id = str(current_user.tenant.id) if current_user.tenant else BUILTIN_ORG_ID

    query = """
    SELECT * FROM exec.device_profiles
    WHERE organization_id IN ($1, $2)
    """
    params = [org_id, BUILTIN_ORG_ID]

    if device_type:
        query += " AND device_type = $3"
        params.append(device_type)

    query += " ORDER BY is_builtin DESC, profile_name ASC"

    rows = await db.execute_query(query, *params)
    return [_row_to_response(dict(r)) for r in (rows or [])]


@router.get("/{profile_id}")
async def get_device_profile(
    profile_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: DatabaseManager = Depends(_get_db),
):
    """Get a single device profile by ID."""
    org_id = str(current_user.tenant.id) if current_user.tenant else BUILTIN_ORG_ID

    row = await db.execute_one(
        "SELECT * FROM exec.device_profiles WHERE id = $1 AND organization_id IN ($2, $3)",
        profile_id, org_id, BUILTIN_ORG_ID,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Device profile not found")
    return _row_to_response(dict(row))


@router.post("", status_code=201)
async def create_device_profile(
    body: DeviceProfileCreate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: DatabaseManager = Depends(_get_db),
):
    """Create a custom device profile for the user's organization."""
    org_id = str(current_user.tenant.id) if current_user.tenant else None
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization required")

    row = await db.execute_one(
        """
        INSERT INTO exec.device_profiles
            (organization_id, profile_name, device_type, device_name,
             width, height, device_scale_factor, user_agent,
             is_mobile, has_touch, is_landscape, is_builtin)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, false)
        RETURNING *
        """,
        org_id,
        body.profile_name,
        body.device_type,
        body.device_name,
        body.width,
        body.height,
        body.device_scale_factor,
        body.user_agent,
        body.is_mobile,
        body.has_touch,
        body.is_landscape,
    )
    return _row_to_response(dict(row))


@router.put("/{profile_id}")
async def update_device_profile(
    profile_id: str,
    body: DeviceProfileUpdate,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: DatabaseManager = Depends(_get_db),
):
    """Update a custom device profile. Built-in profiles cannot be modified."""
    org_id = str(current_user.tenant.id) if current_user.tenant else None
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization required")

    # Verify ownership and not built-in
    existing = await db.execute_one(
        "SELECT is_builtin FROM exec.device_profiles WHERE id = $1 AND organization_id = $2",
        profile_id, org_id,
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Device profile not found")
    if existing["is_builtin"]:
        raise HTTPException(status_code=403, detail="Built-in profiles cannot be modified")

    # Build dynamic update
    updates = body.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = []
    params = []
    idx = 1
    for key, value in updates.items():
        set_clauses.append(f"{key} = ${idx}")
        params.append(value)
        idx += 1

    set_clauses.append(f"updated_at = NOW()")
    params.append(profile_id)
    params.append(org_id)

    query = f"""
    UPDATE exec.device_profiles
    SET {', '.join(set_clauses)}
    WHERE id = ${idx} AND organization_id = ${idx + 1}
    RETURNING *
    """

    row = await db.execute_one(query, *params)
    return _row_to_response(dict(row))


@router.delete("/{profile_id}", status_code=204)
async def delete_device_profile(
    profile_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
    db: DatabaseManager = Depends(_get_db),
):
    """Delete a custom device profile. Built-in profiles cannot be deleted."""
    org_id = str(current_user.tenant.id) if current_user.tenant else None
    if not org_id:
        raise HTTPException(status_code=400, detail="Organization required")

    existing = await db.execute_one(
        "SELECT is_builtin FROM exec.device_profiles WHERE id = $1 AND organization_id = $2",
        profile_id, org_id,
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Device profile not found")
    if existing["is_builtin"]:
        raise HTTPException(status_code=403, detail="Built-in profiles cannot be deleted")

    await db.execute_one(
        "DELETE FROM exec.device_profiles WHERE id = $1 AND organization_id = $2",
        profile_id, org_id,
    )
    return None
