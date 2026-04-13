"""
Team Collaboration API Endpoints
Handles organization members, project members, invitations, and team management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr
import logging
import os

from core.database import get_database, DatabaseManager
from core.auth import get_current_user, auth_manager
from models.auth_models import CurrentUser
from services.subscription_limits import enforce_team_member_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/team", tags=["team"])

async def get_db() -> DatabaseManager:
    """Get database dependency"""
    return await get_database()

# =============================================================================
# MODELS
# =============================================================================

class OrganizationMemberResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    email: str
    full_name: Optional[str]
    role: str
    status: str
    invited_at: Optional[datetime]
    joined_at: Optional[datetime]
    last_active_at: Optional[datetime]


class InviteUserRequest(BaseModel):
    email: EmailStr
    role: str = "member"  # owner, admin, member, viewer
    send_email: bool = True


class CreateInvitationTokenRequest(BaseModel):
    role: str = "member"  # owner, admin, member, viewer
    email: Optional[EmailStr] = None  # Optional: restrict to specific email
    expires_in_days: int = 7  # Token expiration in days
    max_uses: Optional[int] = 1  # 0 or None = unlimited


class UpdateMemberRoleRequest(BaseModel):
    role: str  # owner, admin, member, viewer


# =============================================================================
# ORGANIZATION MEMBER ENDPOINTS
# =============================================================================

@router.get("/organizations/{tenant_id}/members", response_model=List[OrganizationMemberResponse])
async def list_organization_members(
    tenant_id: UUID,
    status_filter: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """
    List all members of an organization.
    
    Requires: User must be a member of the organization
    """
    # Check if current user has access to this organization
    # Check both organization_members and user_tenant_roles for backwards compatibility
    access_check = await db.execute_one(
        """
        SELECT 1 FROM core.organization_members
        WHERE user_id = $1 AND tenant_id = $2 AND status = 'active'
        UNION
        SELECT 1 FROM core.user_tenant_roles utr
        WHERE utr.user_id = $1 AND utr.tenant_id = $2
        """,
        str(current_user.user.id), str(tenant_id)
    )
    
    if not access_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this organization"
        )
    
    # Build query - combine both organization_members and user_tenant_roles for backwards compatibility
    query = """
        SELECT 
            om.id, om.tenant_id, om.user_id, om.role, om.status,
            om.invited_at, om.joined_at, om.last_active_at,
            u.email, u.full_name
        FROM core.organization_members om
        JOIN core.users u ON om.user_id = u.id
        WHERE om.tenant_id = $1
        UNION
        SELECT 
            gen_random_uuid() as id,
            utr.tenant_id,
            utr.user_id,
            r.name as role,
            'active' as status,
            NULL as invited_at,
            utr.created_at as joined_at,
            NULL as last_active_at,
            u.email,
            u.full_name
        FROM core.user_tenant_roles utr
        JOIN core.users u ON utr.user_id = u.id
        JOIN core.roles r ON utr.role_id = r.id
        WHERE utr.tenant_id = $1
        AND NOT EXISTS (
            SELECT 1 FROM core.organization_members om2
            WHERE om2.user_id = utr.user_id AND om2.tenant_id = utr.tenant_id
        )
        ORDER BY joined_at ASC
    """
    
    result = await db.execute_query(query, str(tenant_id))
    members = []
    
    for row in result:
        members.append(OrganizationMemberResponse(
            id=row["id"],
            tenant_id=row["tenant_id"],
            user_id=row["user_id"],
            email=row["email"],
            full_name=row.get("full_name"),
            role=row["role"],
            status=row["status"],
            invited_at=row.get("invited_at"),
            joined_at=row.get("joined_at"),
            last_active_at=row.get("last_active_at")
        ))
    
    return members


@router.post("/organizations/{tenant_id}/invitation-tokens", status_code=status.HTTP_201_CREATED)
async def create_invitation_token(
    tenant_id: UUID,
    request: CreateInvitationTokenRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Generate an invitation token for the organization.
    
    Returns a secure token that can be shared via link (e.g., https://app.com/register?invite=TOKEN).
    Anyone with the token can register and join the organization.
    
    Requires: User must be an owner or admin of the organization
    """
    # Check if current user can create invitation tokens
    from core.database import get_database_manager
    db_manager = await get_database_manager()
    
    # Verify user has permission via user_tenant_roles
    role_check = await db_manager.execute_one(
        """
        SELECT r.name as role
        FROM core.user_tenant_roles utr
        JOIN core.roles r ON utr.role_id = r.id
        WHERE utr.tenant_id = $1 AND utr.user_id = $2 AND utr.is_active = true
        """,
        str(tenant_id), str(current_user.user.id)
    )
    
    if not role_check or role_check["role"].lower() not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can create invitation tokens"
        )

    # Enforce subscription seat limits before creating a new invite.
    await enforce_team_member_limit(db_manager, str(tenant_id))
    
    # Validate role
    valid_roles = ["owner", "admin", "member", "viewer"]
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )
    
    # Generate invitation token
    invitation = await auth_manager.create_invitation_token(
        tenant_id=str(tenant_id),
        invited_by=str(current_user.user.id),
        role=request.role,
        email=request.email,
        expires_in_days=request.expires_in_days
    )
    
    # Build invitation link using configured frontend URL
    base_url = os.getenv("FRONTEND_BASE_URL", "").rstrip("/")
    if not base_url:
        logger.warning("FRONTEND_BASE_URL not set — invitation link will be relative")
        base_url = ""
    invitation_link = f"{base_url}/register?invite={invitation['token']}"
    
    return {
        "token": invitation["token"],
        "expires_at": invitation["expires_at"],
        "organization_name": invitation["organization_name"],
        "role": invitation["role"],
        "invitation_link": invitation_link,
        "restricted_email": request.email
    }


@router.put("/organizations/{tenant_id}/members/{user_id}/role")
async def update_member_role(
    tenant_id: UUID,
    user_id: UUID,
    request: UpdateMemberRoleRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Update a team member's role.
    
    Rules:
    - Only owners can change roles
    - Only one owner allowed - transferring ownership will demote the current owner to admin
    - Cannot change your own role (except for ownership transfer)
    """
    from core.database import get_database_manager
    db_manager = await get_database_manager()
    
    # Validate role
    valid_roles = ["owner", "admin", "member", "viewer"]
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )
    
    # Check if current user is owner or admin
    current_user_role = await db_manager.execute_one(
        """
        SELECT r.name as role
        FROM core.user_tenant_roles utr
        JOIN core.roles r ON utr.role_id = r.id
        WHERE utr.tenant_id = $1 AND utr.user_id = $2 AND utr.is_active = true
        """,
        str(tenant_id), str(current_user.user.id)
    )
    
    if not current_user_role or current_user_role["role"].lower() not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners and admins can change member roles"
        )
    
    # Only owners can transfer ownership
    if request.role.lower() == "owner" and current_user_role["role"].lower() != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only owners can transfer ownership"
        )
    
    # Check if target user exists in the organization
    target_user = await db_manager.execute_one(
        """
        SELECT utr.user_id, r.name as current_role
        FROM core.user_tenant_roles utr
        JOIN core.roles r ON utr.role_id = r.id
        WHERE utr.tenant_id = $1 AND utr.user_id = $2 AND utr.is_active = true
        """,
        str(tenant_id), str(user_id)
    )
    
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in organization"
        )
    
    # Prevent users from changing their own role (except owner transferring ownership)
    if str(user_id) == str(current_user.user.id):
        if not (current_user_role["role"].lower() == "owner" and request.role.lower() == "owner"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot change your own role"
            )
    
    # Get or create the new role
    new_role = await db_manager.execute_one(
        "SELECT id FROM core.roles WHERE LOWER(name) = LOWER($1)",
        request.role
    )
    
    if not new_role:
        # Create the role if it doesn't exist
        new_role = await db_manager.execute_one(
            """
            INSERT INTO core.roles (id, name, description, is_active, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
            RETURNING id
            """,
            request.role.capitalize(),
            f"{request.role.capitalize()} role"
        )
    
    new_role_id = str(new_role["id"])
    
    # Handle ownership transfer
    if request.role.lower() == "owner":
        # Get admin role for demoting current owner
        admin_role = await db_manager.execute_one(
            "SELECT id FROM core.roles WHERE LOWER(name) = 'admin'"
        )
        
        if not admin_role:
            admin_role = await db_manager.execute_one(
                """
                INSERT INTO core.roles (id, name, description, is_active, created_at, updated_at)
                VALUES (gen_random_uuid(), 'Admin', 'Administrator with elevated privileges', true, NOW(), NOW())
                RETURNING id
                """,
            )
        
        admin_role_id = str(admin_role["id"])
        
        # Demote current owner to admin
        await db_manager.execute_command(
            """
            UPDATE core.user_tenant_roles
            SET role_id = $1, updated_at = NOW()
            WHERE tenant_id = $2 AND user_id = $3
            """,
            admin_role_id,
            str(tenant_id),
            str(current_user.user.id)
        )
    
    # Update the target user's role
    await db_manager.execute_command(
        """
        UPDATE core.user_tenant_roles
        SET role_id = $1, updated_at = NOW()
        WHERE tenant_id = $2 AND user_id = $3
        """,
        new_role_id,
        str(tenant_id),
        str(user_id)
    )
    
    return {
        "success": True,
        "message": f"Role updated to {request.role}",
        "user_id": str(user_id),
        "new_role": request.role
    }
