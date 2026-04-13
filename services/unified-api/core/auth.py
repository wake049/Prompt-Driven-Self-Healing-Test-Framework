"""
Authentication Utilities
Password hashing, JWT token management, and user verification functions
"""

import os
import secrets
import json
import re
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.database import get_database_manager
import asyncpg
from models.auth_models import TokenData, UserResponse, CurrentUser, TenantInfo, ProjectInfo
from services.subscription_limits import enforce_team_member_limit

logger = logging.getLogger(__name__)

# Security Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable must be set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Bearer token scheme
security = HTTPBearer()

class AuthenticationManager:
    """Handles all authentication operations"""
    
    def __init__(self):
        self.secret_key = SECRET_KEY
        self.algorithm = ALGORITHM
        self.token_expire_minutes = ACCESS_TOKEN_EXPIRE_MINUTES
    
    # Password Management
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)

    def normalize_email(self, email: str) -> str:
        return email.strip().lower()

    def normalize_full_name(self, full_name: str) -> str:
        cleaned = full_name.strip()
        if len(cleaned) < 2 or len(cleaned) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid full name"
            )
        if re.search(r"\s{2,}", cleaned):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid full name"
            )
        return cleaned

    def validate_password_policy(self, password: str) -> str:
        trimmed = password.strip()

        if len(trimmed) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 10 characters"
            )
        if re.search(r"\s", trimmed):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password cannot contain spaces"
            )
        if not re.search(r"[A-Z]", trimmed):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must include at least one uppercase letter"
            )
        if not re.search(r"[a-z]", trimmed):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must include at least one lowercase letter"
            )
        if not re.search(r"\d", trimmed):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must include at least one number"
            )
        if not re.search(r"[^A-Za-z0-9]", trimmed):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must include at least one special character"
            )

        return trimmed
    
    # JWT Token Management
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token with expiration"""
        to_encode = data.copy()

        expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=self.token_expire_minutes))
        to_encode.update({"exp": expire, "iat": datetime.utcnow()})
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[TokenData]:
        """Verify and decode a JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            email: str = payload.get("sub")
            user_id: str = payload.get("user_id")
            tenant_id: str = payload.get("tenant_id")
            project_id: str = payload.get("project_id")
            
            if email is None:
                return None
            
            token_data = TokenData(
                email=email,
                user_id=user_id,
                tenant_id=tenant_id,
                project_id=project_id
            )
            return token_data
        except JWTError as e:
            return None
        except Exception as e:
            return None
    
    # User Authentication
    
    async def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate a user with email and password and return with tenant/project info"""
        db = await get_database_manager()
        normalized_email = self.normalize_email(email)
        
        # Get user from database with tenant/project information
        user = await db.execute_one(
            """
            SELECT u.id, u.email, u.full_name, u.password_hash, u.is_active,
                   u.created_at, u.updated_at,
                   t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
                   p.id as project_id, p.name as project_name, p.slug as project_slug
            FROM core.users u
            LEFT JOIN core.user_tenant_roles utr ON u.id = utr.user_id
            LEFT JOIN core.tenants t ON utr.tenant_id = t.id AND t.is_active = true
            LEFT JOIN core.projects p ON t.id = p.tenant_id AND p.is_active = true
            WHERE u.email = $1 AND u.is_active = true
            ORDER BY p.created_at DESC
            LIMIT 1
            """,
            normalized_email
        )
        
        if not user:
            return None
        
        # Verify password
        if not self.verify_password(password, user["password_hash"]):
            return None
        
        return user
    
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        db = await get_database_manager()
        normalized_email = self.normalize_email(email)
        
        user = await db.execute_one(
            """
            SELECT u.id, u.email, u.full_name, u.is_active, u.password_hash,
                   u.created_at, u.updated_at
            FROM core.users u
            WHERE u.email = $1 AND u.is_active = true
            """,
            normalized_email
        )
        
        return user
    
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        db = await get_database_manager()
        
        user = await db.execute_one(
            """
            SELECT u.id, u.email, u.full_name, u.is_active, u.password_hash,
                   u.created_at, u.updated_at
            FROM core.users u
            WHERE u.id::text = $1 AND u.is_active = true
            """,
            user_id
        )
        
        return user
    
    async def create_user(self, email: str, password: str, full_name: str, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """Create a new user and assign to tenant"""
        db = await get_database_manager()

        normalized_email = self.normalize_email(email)
        normalized_full_name = self.normalize_full_name(full_name)
        validated_password = self.validate_password_policy(password)
        
        # Check if user already exists
        existing_user = await self.get_user_by_email(normalized_email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Hash password
        password_hash = self.get_password_hash(validated_password)
        
        # Create user (in core.users table) — use INSERT with conflict handling
        # to prevent race condition between check and insert
        try:
            user = await db.execute_one(
                """
                INSERT INTO core.users (email, full_name, password_hash, is_active)
                VALUES ($1, $2, $3, true)
                RETURNING id, email, full_name, is_active, created_at, updated_at
                """,
                normalized_email, normalized_full_name, password_hash
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # NOTE: We no longer auto-create a default tenant/project here
        # The onboarding flow will create the organization and project via POST /api/v1/organizations
        # This prevents duplicate projects from being created
        
        logger.info("Created user account for %s", normalized_email)
        
        return user
    
    async def create_organization_user(self, email: str, password: str, full_name: str, 
                                      organization_name: str, organization_slug: Optional[str] = None) -> Dict[str, Any]:
        """Create a new user and organization (tenant) - for organization registration"""
        db = await get_database_manager()

        normalized_email = self.normalize_email(email)
        normalized_full_name = self.normalize_full_name(full_name)
        validated_password = self.validate_password_policy(password)
        normalized_org_name = organization_name.strip()
        
        # Check if user already exists
        existing_user = await self.get_user_by_email(normalized_email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Hash password
        password_hash = self.get_password_hash(validated_password)
        
        # Create user — catch duplicate email from race condition
        try:
            user = await db.execute_one(
                """
                INSERT INTO core.users (email, full_name, password_hash, is_active)
                VALUES ($1, $2, $3, true)
                RETURNING id, email, full_name, is_active, created_at, updated_at
                """,
                normalized_email, normalized_full_name, password_hash
            )
        except asyncpg.UniqueViolationError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Generate organization slug if not provided
        if not organization_slug:
            organization_slug = normalized_org_name.lower().replace(' ', '-').replace("'", "")
        
        # Create tenant (organization)
        try:
            tenant = await db.execute_one(
                """
                INSERT INTO core.tenants (id, name, slug, description, is_active, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
                RETURNING id, name, slug
                """,
                normalized_org_name,
                organization_slug,
                f"Organization: {normalized_org_name}"
            )
        except asyncpg.UniqueViolationError:
            # If slug exists, try with suffix
            organization_slug = f"{organization_slug}-{str(user['id'])[:8]}"
            tenant = await db.execute_one(
                """
                INSERT INTO core.tenants (id, name, slug, description, is_active, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
                RETURNING id, name, slug
                """,
                normalized_org_name,
                organization_slug,
                f"Organization: {normalized_org_name}"
            )
        
        tenant_id = str(tenant["id"])
        
        # Create organization record with details
        await db.execute_one(
            """
            INSERT INTO core.organizations (tenant_id, name, slug, description, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (tenant_id, slug) DO NOTHING
            """,
            tenant_id,
            normalized_org_name,
            organization_slug,
            f"Organization: {normalized_org_name}"
        )
        
        # Get or create Owner role
        try:
            role = await db.execute_one(
                """
                INSERT INTO core.roles (id, name, description, is_active, created_at, updated_at)
                VALUES (gen_random_uuid(), 'Owner', 'Organization owner with full access', true, NOW(), NOW())
                RETURNING id
                """
            )
        except Exception:
            role = await db.execute_one("SELECT id FROM core.roles WHERE name = 'Owner'")
        
        role_id = str(role["id"])
        
        # Link user to tenant as owner
        await db.execute_one(
            """
            INSERT INTO core.user_tenant_roles (id, user_id, tenant_id, role_id, is_active, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, true, NOW(), NOW())
            """,
            str(user["id"]), tenant_id, role_id
        )
        
        # Add to organization_members table with active status
        await db.execute_one(
            """
            INSERT INTO core.organization_members (tenant_id, user_id, role, status, invited_at, joined_at)
            VALUES ($1, $2, 'owner', 'active', NOW(), NOW())
            ON CONFLICT (tenant_id, user_id) DO NOTHING
            """,
            tenant_id, str(user["id"])
        )
        
        # Create default project
        project_name = f"{normalized_org_name} - Main Project"
        project_slug = f"{organization_slug}-main"
        project = await db.execute_one(
            """
            INSERT INTO core.projects (id, tenant_id, name, slug, description, is_active, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
            RETURNING id, name
            """,
            tenant_id,
            project_name,
            project_slug,
            f"Main project for {normalized_org_name}"
        )
        
        logger.info("Created organization '%s' with owner %s", normalized_org_name, normalized_email)
        
        return {
            "user": user,
            "tenant": tenant,
            "project": project
        }
    
    async def create_invitation_token(self, tenant_id: str, invited_by: str, 
                                     role: str = "member", email: Optional[str] = None,
                                     expires_in_days: int = 7) -> Dict[str, Any]:
        """Generate a secure invitation token for organization"""
        db = await get_database_manager()
        
        # Generate secure random token
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
        
        # Store token in database
        invitation = await db.execute_one(
            """
            INSERT INTO core.invitation_tokens 
                (token, tenant_id, invited_by, email, role, status, expires_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', $6)
            RETURNING id, token, expires_at
            """,
            token, tenant_id, invited_by, email, role, expires_at
        )
        
        # Get organization name
        tenant = await db.execute_one(
            "SELECT name FROM core.tenants WHERE id = $1",
            tenant_id
        )
        
        return {
            "token": invitation["token"],
            "expires_at": invitation["expires_at"],
            "organization_name": tenant["name"] if tenant else "Unknown",
            "role": role
        }
    
    async def validate_invitation_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate an invitation token and return invitation details"""
        db = await get_database_manager()
        
        invitation = await db.execute_one(
            """
            SELECT it.*, t.name as organization_name, t.slug as organization_slug
            FROM core.invitation_tokens it
            JOIN core.tenants t ON it.tenant_id = t.id
            WHERE it.token = $1 
              AND it.status = 'pending'
              AND it.expires_at > NOW()
            """,
            token
        )
        
        if not invitation:
            return None
        
        return {
            "id": str(invitation["id"]),
            "tenant_id": str(invitation["tenant_id"]),
            "organization_name": invitation["organization_name"],
            "organization_slug": invitation["organization_slug"],
            "role": invitation["role"],
            "email": invitation["email"],
            "expires_at": invitation["expires_at"]
        }
    
    async def accept_invitation(self, token: str, user_id: str) -> Dict[str, Any]:
        """Accept an invitation and add user to organization"""
        db = await get_database_manager()
        
        # Validate token
        invitation = await self.validate_invitation_token(token)
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired invitation token"
            )
        
        tenant_id = invitation["tenant_id"]
        role = invitation["role"]

        # Enforce subscription seat limits before adding the user.
        await enforce_team_member_limit(db, tenant_id)
        
        # Check if restricted to specific email
        if invitation["email"]:
            user = await self.get_user_by_id(user_id)
            if user and user["email"] != invitation["email"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This invitation is for a different email address"
                )
        
        # Check if user is already a member
        existing = await db.execute_one(
            """
            SELECT id FROM core.organization_members
            WHERE tenant_id = $1 AND user_id = $2
            """,
            tenant_id, user_id
        )
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this organization"
            )
        
        # Get role ID
        role_record = await db.execute_one(
            "SELECT id FROM core.roles WHERE name = $1",
            role.capitalize()
        )
        if not role_record:
            # Create role if it doesn't exist
            role_record = await db.execute_one(
                """
                INSERT INTO core.roles (name, description, is_active)
                VALUES ($1, $2, true)
                RETURNING id
                """,
                role.capitalize(),
                f"{role.capitalize()} role"
            )
        
        # Add user to tenant
        await db.execute_one(
            """
            INSERT INTO core.user_tenant_roles (user_id, tenant_id, role_id, is_active)
            VALUES ($1, $2, $3, true)
            ON CONFLICT DO NOTHING
            """,
            user_id, tenant_id, str(role_record["id"])
        )
        
        # Add to organization_members
        await db.execute_one(
            """
            INSERT INTO core.organization_members 
                (tenant_id, user_id, role, status, invited_at, joined_at)
            VALUES ($1, $2, $3, 'active', NOW(), NOW())
            ON CONFLICT (tenant_id, user_id) DO UPDATE
            SET status = 'active', joined_at = NOW()
            """,
            tenant_id, user_id, role
        )
        
        # Mark invitation as accepted
        await db.execute_one(
            """
            UPDATE core.invitation_tokens
            SET status = 'accepted', accepted_at = NOW(), accepted_by = $1
            WHERE token = $2
            """,
            user_id, token
        )
        
        logger.info("User %s accepted invitation to %s", user_id, invitation['organization_name'])
        
        return {
            "tenant_id": tenant_id,
            "organization_name": invitation["organization_name"],
            "role": role
        }
    
    async def get_user_with_context(self, user_id: str, token_project_id: Optional[str] = None) -> Optional[CurrentUser]:
        """Get user with tenant and project context
        
        Args:
            user_id: The user's ID
            token_project_id: Optional project_id from JWT token (takes precedence over database)
        """
        db = await get_database_manager()
        
        logger.debug("Looking up user context for user_id=%s", user_id)
        
        # Get user first - cast string to UUID for comparison
        user_result = await db.execute_one(
            """
            SELECT id, email, full_name, is_active, created_at, updated_at
            FROM core.users 
            WHERE id::text = $1 AND is_active = true
            """,
            user_id
        )
        
        if not user_result:
            logger.warning("User not found while building context for user_id=%s", user_id)
            return None
        
        # Get user's tenants - prioritize organization memberships first
        tenant_result = await db.execute_one(
            """
            SELECT t.id, t.name, t.slug
            FROM core.tenants t
            INNER JOIN core.user_tenant_roles utr ON utr.tenant_id = t.id
            WHERE utr.user_id::text = $1
            AND t.is_active = true
            AND utr.is_active = true
            ORDER BY utr.created_at DESC
            LIMIT 1
            """,
            user_id
        )
        
        # Fallback: if no explicit tenant relationship, use organization_members table
        if not tenant_result:
            tenant_result = await db.execute_one(
                """
                SELECT t.id, t.name, t.slug
                FROM core.tenants t
                INNER JOIN core.organization_members om ON om.tenant_id = t.id
                WHERE om.user_id::text = $1
                AND t.is_active = true
                AND om.status = 'active'
                ORDER BY om.joined_at DESC
                LIMIT 1
                """,
                user_id
            )
        
        # Get user's role - check both organization_members and user_tenant_roles
        user_role = None
        if tenant_result:
            # First try organization_members
            role_result = await db.execute_one(
                """
                SELECT role FROM core.organization_members
                WHERE user_id::text = $1 AND tenant_id = $2 AND status = 'active'
                """,
                user_id, str(tenant_result["id"])
            )
            if role_result:
                user_role = role_result["role"]
            else:
                # Fallback to user_tenant_roles if organization_members doesn't have the role
                role_result = await db.execute_one(
                    """
                    SELECT r.name as role FROM core.user_tenant_roles utr
                    JOIN core.roles r ON utr.role_id = r.id
                    WHERE utr.user_id::text = $1 AND utr.tenant_id = $2 AND utr.is_active = true
                    """,
                    user_id, str(tenant_result["id"])
                )
                if role_result:
                    user_role = role_result["role"].lower()
        
        # Get user's project
        project_result = None
        if tenant_result:
            project_result = await db.execute_one(
                """
                SELECT p.id, p.tenant_id, p.name, p.slug, p.description
                FROM core.projects p
                WHERE p.tenant_id = $1 AND p.is_active = true
                LIMIT 1
                """,
                str(tenant_result["id"])
            )
        
        # Build response
        user = UserResponse(
            id=user_result["id"],
            email=user_result["email"],
            full_name=user_result["full_name"],
            is_active=user_result["is_active"],
            role=user_role,
            created_at=user_result["created_at"],
            updated_at=user_result["updated_at"]
        )
        
        tenant = None
        if tenant_result:
            tenant = TenantInfo(
                id=tenant_result["id"],
                name=tenant_result["name"],
                slug=tenant_result["slug"],
                is_active=True
            )
        
        project = None
        # Use project_id from JWT token if provided (takes precedence)
        project_id_to_use = token_project_id if token_project_id else (str(project_result["id"]) if project_result else None)
        if project_id_to_use and project_result:
            project = ProjectInfo(
                id=project_id_to_use,
                tenant_id=project_result["tenant_id"],
                name=project_result["name"],
                slug=project_result["slug"],
                description=project_result.get("description", ""),
                is_active=True
            )
        elif token_project_id and tenant_result:
            # If we have token_project_id but no project_result from DB, create project info from token
            project = ProjectInfo(
                id=token_project_id,
                tenant_id=str(tenant_result["id"]),
                name="Default Project",
                slug="default-project",
                description="Project from token",
                is_active=True
            )
        
        return CurrentUser(
            user=user,
            tenant=tenant,
            project=project,
            permissions=[]
        )


# Global authentication manager instance
auth_manager = AuthenticationManager()

# Dependency Functions for FastAPI

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> CurrentUser:
    """FastAPI dependency to get current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        token_data = auth_manager.verify_token(token)
        
        if token_data is None or token_data.user_id is None:
            logger.warning("Token verification failed: missing token payload fields")
            raise credentials_exception

        # Get user with full context, passing JWT token's project_id
        current_user = await auth_manager.get_user_with_context(token_data.user_id, token_data.project_id)
        
        if current_user is None:
            logger.warning("Token valid but user context not found")
            raise credentials_exception

        logger.debug("Successfully authenticated user_id=%s", current_user.user.id)
        return current_user
    
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error during authentication")
        raise credentials_exception

async def get_current_active_user(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """FastAPI dependency to ensure user is active"""
    
    if not current_user.user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[CurrentUser]:
    """Optional auth — returns authenticated user if valid token present, None otherwise"""
    if not credentials:
        return None

    try:
        token = credentials.credentials
        token_data = auth_manager.verify_token(token)

        if token_data is None or token_data.user_id is None:
            return None

        current_user = await auth_manager.get_user_with_context(token_data.user_id, token_data.project_id)
        return current_user
    except Exception:
        return None

# Alias for backward compatibility
get_optional_user = get_optional_current_user