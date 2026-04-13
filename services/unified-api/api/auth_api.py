"""
Authentication API Endpoints
FastAPI routes for user authentication, registration, and profile management
"""

from datetime import timedelta
from typing import Dict, Any
import time
import logging
from collections import defaultdict, deque
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer

from models.auth_models import (
    UserLogin, UserRegister, OrganizationRegister, PasswordChange, Token, 
    UserResponse, CurrentUser, AuthError, InvitationToken
)
from core.auth import auth_manager, get_current_active_user, get_current_user

logger = logging.getLogger(__name__)

# Create router
auth_router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

# Basic in-memory registration throttling (per-process)
REGISTRATION_WINDOW_SECONDS = 15 * 60
REGISTRATION_MAX_ATTEMPTS = 8
_registration_attempts: dict[str, deque[float]] = defaultdict(deque)

# Basic in-memory login throttling (per-process)
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_ATTEMPTS = 10
_login_attempts: dict[str, deque[float]] = defaultdict(deque)

# Basic in-memory refresh throttling (per-user)
REFRESH_WINDOW_SECONDS = 60
REFRESH_MAX_ATTEMPTS = 10
_refresh_attempts: dict[str, deque[float]] = defaultdict(deque)

# Basic in-memory invitation lookup throttling (per-IP)
INVITATION_WINDOW_SECONDS = 15 * 60
INVITATION_MAX_ATTEMPTS = 20
_invitation_attempts: dict[str, deque[float]] = defaultdict(deque)


def _enforce_registration_rate_limit(request: Request) -> None:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_ip = (forwarded_for.split(",")[0].strip() if forwarded_for else "")
    if not client_ip:
        client_ip = request.client.host if request.client and request.client.host else "unknown"

    now = time.time()
    attempt_window = _registration_attempts[client_ip]

    while attempt_window and now - attempt_window[0] > REGISTRATION_WINDOW_SECONDS:
        attempt_window.popleft()

    if len(attempt_window) >= REGISTRATION_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Please try again later."
        )

    attempt_window.append(now)

def _enforce_login_rate_limit(request: Request) -> None:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_ip = (forwarded_for.split(",")[0].strip() if forwarded_for else "")
    if not client_ip:
        client_ip = request.client.host if request.client and request.client.host else "unknown"

    now = time.time()
    attempt_window = _login_attempts[client_ip]

    while attempt_window and now - attempt_window[0] > LOGIN_WINDOW_SECONDS:
        attempt_window.popleft()

    if len(attempt_window) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later."
        )

    attempt_window.append(now)

@auth_router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, request: Request):
    """
    Authenticate user and return JWT access token
    
    **Example:**
    ```json
    {
        "email": "devadmin@example.com",
        "password": "admin123"
    }
    ```
    """
    # Authenticate user
    _enforce_login_rate_limit(request)
    user = await auth_manager.authenticate_user(
        user_credentials.email, 
        user_credentials.password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token with tenant/project information
    access_token_expires = timedelta(minutes=auth_manager.token_expire_minutes)
    access_token = auth_manager.create_access_token(
        data={
            "sub": user["email"],
            "user_id": str(user["id"]),
            "tenant_id": str(user["tenant_id"]) if user.get("tenant_id") else None,
            "project_id": str(user["project_id"]) if user.get("project_id") else None,
        },
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": auth_manager.token_expire_minutes * 60
    }

@auth_router.post("/register", response_model=UserResponse)
async def register(user_data: UserRegister, request: Request):
    """
    Register a new user account.
    
    Can optionally join an existing organization via invitation_token.
    
    **Example (Standard Registration):**
    ```json
    {
        "email": "newuser@example.com",
        "password": "password123",
        "confirm_password": "password123",
        "full_name": "New User"
    }
    ```
    
    **Example (Join Organization via Invitation):**
    ```json
    {
        "email": "newuser@example.com",
        "password": "password123",
        "confirm_password": "password123",
        "full_name": "New User",
        "invitation_token": "abc123..."
    }
    ```
    """
    try:
        _enforce_registration_rate_limit(request)

        # Create user account
        user = await auth_manager.create_user(
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name
        )
        
        # If invitation token provided, accept the invitation
        if user_data.invitation_token:
            try:
                invitation_result = await auth_manager.accept_invitation(
                    token=user_data.invitation_token,
                    user_id=str(user["id"])
                )
                logger.info(
                    "User %s joined organization %s via invitation",
                    user["email"],
                    invitation_result["organization_name"]
                )
            except HTTPException as e:
                # Log but don't fail registration if invitation acceptance fails
                logger.warning("Failed to accept invitation during registration: %s", e.detail)
        
        return UserResponse(**user)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected registration error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed. Please try again later."
        )

@auth_router.post("/register/organization", response_model=UserResponse)
async def register_organization(org_data: OrganizationRegister, request: Request):
    """
    Register a new organization and create owner account.
    
    This creates a new tenant (organization) with the user as the owner.
    
    **Example:**
    ```json
    {
        "email": "owner@company.com",
        "password": "password123",
        "confirm_password": "password123",
        "full_name": "John Doe",
        "organization_name": "Acme Corp",
        "organization_slug": "acme-corp"
    }
    ```
    """
    try:
        _enforce_registration_rate_limit(request)

        result = await auth_manager.create_organization_user(
            email=org_data.email,
            password=org_data.password,
            full_name=org_data.full_name,
            organization_name=org_data.organization_name,
            organization_slug=org_data.organization_slug
        )
        
        return UserResponse(**result["user"])
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected organization registration error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Organization registration failed. Please try again later."
        )

@auth_router.get("/me", response_model=CurrentUser)
async def get_current_user_profile(current_user: CurrentUser = Depends(get_current_active_user)):
    """
    Get current user profile with tenant and project context
    
    Requires: Bearer token in Authorization header
    """
    return current_user

@auth_router.post("/refresh", response_model=Token)
async def refresh_token(request: Request, current_user: CurrentUser = Depends(get_current_active_user)):
    """
    Refresh access token for authenticated user
    
    Requires: Bearer token in Authorization header
    """
    # Rate limit per user
    user_key = str(current_user.user.id)
    now = time.time()
    window = _refresh_attempts[user_key]
    while window and now - window[0] > REFRESH_WINDOW_SECONDS:
        window.popleft()
    if len(window) >= REFRESH_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many refresh attempts. Please try again later."
        )
    window.append(now)

    # Create new access token
    access_token_expires = timedelta(minutes=auth_manager.token_expire_minutes)
    access_token = auth_manager.create_access_token(
        data={
            "sub": current_user.user.email,
            "user_id": str(current_user.user.id),
            "tenant_id": str(current_user.tenant.id) if current_user.tenant else None,
            "project_id": str(current_user.project.id) if current_user.project else None,
        },
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": auth_manager.token_expire_minutes * 60
    }

@auth_router.post("/change-password")
async def change_password(
    password_data: PasswordChange, 
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Change user password
    
    Requires: Bearer token in Authorization header
    
    **Example:**
    ```json
    {
        "current_password": "oldpassword123",
        "new_password": "newpassword123", 
        "confirm_password": "newpassword123"
    }
    ```
    """
    from ..core.database import get_database_manager
    
    # Verify current password
    user = await auth_manager.authenticate_user(
        current_user.user.email, 
        password_data.current_password
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    new_password_hash = auth_manager.get_password_hash(password_data.new_password)

    db = await get_database_manager()
    await db.execute_command(
        "UPDATE core.users SET password_hash = $1, updated_at = now() WHERE id = $2",
        new_password_hash, str(current_user.user.id)
    )

    return {"message": "Password updated successfully"}

@auth_router.get("/invitation/{token}")
async def get_invitation_details(token: str, request: Request):
    """
    Get details about an invitation token (for display before registration).
    
    Returns organization name, role, and expiration.
    """
    # Rate limit per IP to prevent enumeration
    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_ip = (forwarded_for.split(",")[0].strip() if forwarded_for else "")
    if not client_ip:
        client_ip = request.client.host if request.client and request.client.host else "unknown"
    now = time.time()
    window = _invitation_attempts[client_ip]
    while window and now - window[0] > INVITATION_WINDOW_SECONDS:
        window.popleft()
    if len(window) >= INVITATION_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many attempts. Please try again later."
        )
    window.append(now)

    invitation = await auth_manager.validate_invitation_token(token)
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation token"
        )
    
    return {
        "organization_name": invitation["organization_name"],
        "role": invitation["role"],
        "expires_at": invitation["expires_at"],
        "email": invitation["email"]  # May be None if invitation is open
    }

@auth_router.post("/logout")
async def logout(current_user: CurrentUser = Depends(get_current_user)):
    """
    Logout user (client should delete token)
    
    Requires: Bearer token in Authorization header
    """
    # Note: With JWT tokens, we can't invalidate them server-side without a blacklist
    # The client should delete the token from storage
    return {"message": "Logged out successfully"}

@auth_router.get("/verify-token")
async def verify_token(current_user: CurrentUser = Depends(get_current_active_user)):
    """
    Verify if the current token is valid
    
    Requires: Bearer token in Authorization header
    """
    return {
        "valid": True,
        "user_id": str(current_user.user.id),
        "email": current_user.user.email,
        "tenant_id": str(current_user.tenant.id) if current_user.tenant else None,
        "project_id": str(current_user.project.id) if current_user.project else None
    }

# Health check for auth system
@auth_router.get("/health")
async def auth_health():
    """
    Check authentication system health
    """
    from ..core.database import get_database_manager
    
    try:
        # Test database connection
        db = await get_database_manager()
        user_count = await db.execute_scalar("SELECT COUNT(*) FROM core.users WHERE is_active = true")
        
        return {
            "status": "healthy",
            "active_users": user_count,
            "token_expire_minutes": auth_manager.token_expire_minutes,
            "auth_system": "ready"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "auth_system": "failed"
        }