"""
Authentication API Endpoints
FastAPI routes for user authentication, registration, and profile management
"""

from datetime import timedelta
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer

from models.auth_models import (
    UserLogin, UserRegister, PasswordChange, Token, 
    UserResponse, CurrentUser, AuthError
)
from core.auth import auth_manager, get_current_active_user, get_current_user

# Create router
auth_router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

@auth_router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin):
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
    
    # Create access token with tenant/project information (no expiration)
    access_token = auth_manager.create_access_token(
        data={
            "sub": user["email"],
            "user_id": str(user["id"]),
            "tenant_id": str(user["tenant_id"]) if user.get("tenant_id") else None,
            "project_id": str(user["project_id"]) if user.get("project_id") else None,
        }
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
        # No expires_in field since tokens don't expire
    }

@auth_router.post("/register", response_model=UserResponse)
async def register(user_data: UserRegister):
    """
    Register a new user account
    
    **Example:**
    ```json
    {
        "email": "newuser@example.com",
        "password": "password123",
        "confirm_password": "password123",
        "full_name": "New User"
    }
    ```
    """
    try:
        # Create user
        user = await auth_manager.create_user(
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name
        )
        
        return UserResponse(**user)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

@auth_router.get("/me", response_model=CurrentUser)
async def get_current_user_profile(current_user: CurrentUser = Depends(get_current_active_user)):
    """
    Get current user profile with tenant and project context
    
    Requires: Bearer token in Authorization header
    """
    return current_user

@auth_router.post("/refresh", response_model=Token)
async def refresh_token(current_user: CurrentUser = Depends(get_current_active_user)):
    """
    Refresh access token for authenticated user
    
    Requires: Bearer token in Authorization header
    """
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
    
    # Update password
    new_password_hash = auth_manager.get_password_hash(password_data.new_password)
    
    db = await get_database_manager()
    await db.execute_command(
        "UPDATE core.users SET password_hash = $1, updated_at = now() WHERE id = $2",
        new_password_hash, str(current_user.user.id)
    )
    
    return {"message": "Password updated successfully"}

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