"""
Authentication Utilities
Password hashing, JWT token management, and user verification functions
"""

import os
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.database import get_database_manager
from models.auth_models import TokenData, UserResponse, CurrentUser, TenantInfo, ProjectInfo

# Security Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
# Removed token expiration - tokens never expire for 8+ hour work sessions
# ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Bearer token scheme
security = HTTPBearer()

class AuthenticationManager:
    """Handles all authentication operations"""
    
    def __init__(self):
        self.secret_key = SECRET_KEY
        self.algorithm = ALGORITHM
        # No token expiration - sessions last indefinitely for long work periods
    
    # Password Management
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash"""
        return pwd_context.verify(plain_password, hashed_password)
    
    def get_password_hash(self, password: str) -> str:
        """Hash a password"""
        return pwd_context.hash(password)
    
    # JWT Token Management
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create a JWT access token without expiration for long work sessions"""
        to_encode = data.copy()
        
        # No expiration - tokens are valid indefinitely for 8+ hour work sessions
        # This eliminates the need for users to re-authenticate during long work periods
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str) -> Optional[TokenData]:
        """Verify and decode a JWT token"""
        try:
            print(f" Verifying token: {token[:20]}...")
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            print(f" Token decoded successfully. Payload: {payload}")
            
            email: str = payload.get("sub")
            user_id: str = payload.get("user_id")
            tenant_id: str = payload.get("tenant_id")
            project_id: str = payload.get("project_id")
            
            if email is None:
                print(" No email found in token payload")
                return None
            
            token_data = TokenData(
                email=email,
                user_id=user_id,
                tenant_id=tenant_id,
                project_id=project_id
            )
            print(f" Token validation successful for user: {email}")
            return token_data
        except JWTError as e:
            print(f" JWT Error during token verification: {str(e)}")
            return None
        except Exception as e:
            print(f" Unexpected error during token verification: {str(e)}")
            return None
    
    # User Authentication
    
    async def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        """Authenticate a user with email and password and return with tenant/project info"""
        db = await get_database_manager()
        
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
            email
        )
        
        if not user:
            return None
        
        # Verify password
        if not self.verify_password(password, user["password_hash"]):
            return None
        
        return user
    
    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID with tenant/project information"""
        db = await get_database_manager()
        
        user = await db.execute_one(
            """
            SELECT u.id, u.email, u.full_name, u.is_active,
                   u.created_at, u.updated_at,
                   t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
                   p.id as project_id, p.name as project_name, p.slug as project_slug
            FROM core.users u
            LEFT JOIN core.user_tenant_roles utr ON u.id = utr.user_id
            LEFT JOIN core.tenants t ON utr.tenant_id = t.id AND t.is_active = true
            LEFT JOIN core.projects p ON t.id = p.tenant_id AND p.is_active = true
            WHERE u.id = $1 AND u.is_active = true
            ORDER BY p.created_at DESC
            LIMIT 1
            """,
            user_id
        )
        
        return user
    
    async def get_user_with_context(self, user_id: str) -> Optional[CurrentUser]:
        """Get user with full tenant/project context for authentication"""
        db = await get_database_manager()
        
        # Get user with tenant and project information
        user_data = await db.execute_one(
            """
            SELECT u.id, u.email, u.full_name, u.is_active,
                   u.created_at, u.updated_at,
                   t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
                   p.id as project_id, p.name as project_name, p.slug as project_slug
            FROM core.users u
            LEFT JOIN core.user_tenant_roles utr ON u.id = utr.user_id
            LEFT JOIN core.tenants t ON utr.tenant_id = t.id AND t.is_active = true
            LEFT JOIN core.projects p ON t.id = p.tenant_id AND p.is_active = true
            WHERE u.id = $1 AND u.is_active = true
            ORDER BY p.created_at DESC
            LIMIT 1
            """,
            user_id
        )
        
        if not user_data:
            return None
        
        # Build the CurrentUser object with tenant/project context
        user = UserResponse(
            id=user_data["id"],
            email=user_data["email"],
            full_name=user_data["full_name"],
            is_active=user_data["is_active"],
            created_at=user_data["created_at"],
            updated_at=user_data["updated_at"]
        )
        
        tenant = None
        if user_data["tenant_id"]:
            tenant = TenantInfo(
                id=user_data["tenant_id"],
                name=user_data["tenant_name"],
                slug=user_data["tenant_slug"],
                is_active=True
            )
        
        project = None
        if user_data["project_id"]:
            project = ProjectInfo(
                id=user_data["project_id"],
                tenant_id=user_data["tenant_id"],
                name=user_data["project_name"],
                slug=user_data["project_slug"],
                description=None,  # Could add this to the query if needed
                is_active=True
            )
        
        return CurrentUser(
            user=user,
            tenant=tenant,
            project=project,
            permissions=[]  # TODO: Implement role-based permissions
        )
    
    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        db = await get_database_manager()
        
        user = await db.execute_one(
            """
            SELECT u.id, u.email, u.full_name, u.is_active,
                   u.created_at, u.updated_at
            FROM core.users u
            WHERE u.email = $1 AND u.is_active = true
            """,
            email
        )
        
        return user
    
    async def create_user(self, email: str, password: str, full_name: str, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """Create a new user and assign to tenant"""
        db = await get_database_manager()
        
        # Check if user already exists
        existing_user = await self.get_user_by_email(email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Hash password
        password_hash = self.get_password_hash(password)
        
        # Ensure we have a tenant to assign the user to
        assigned_tenant_id = tenant_id
        if not assigned_tenant_id:
            # Get or create default tenant
            default_tenant = await db.execute_one(
                """
                SELECT id FROM core.tenants 
                WHERE slug = 'default-org' AND is_active = true
                """
            )
            
            if not default_tenant:
                # Create default tenant
                default_tenant = await db.execute_one(
                    """
                    INSERT INTO core.tenants (id, name, slug, is_active, created_at, updated_at)
                    VALUES (gen_random_uuid(), 'Default Organization', 'default-org', true, NOW(), NOW())
                    RETURNING id
                    """
                )
            
            assigned_tenant_id = str(default_tenant["id"])
        
        # Create user
        user = await db.execute_one(
            """
            INSERT INTO core.users (email, full_name, password_hash, is_active)
            VALUES ($1, $2, $3, true)
            RETURNING id, email, full_name, is_active, created_at, updated_at
            """,
            email, full_name, password_hash
        )
        
        # Get or create default role
        default_role = await db.execute_one(
            """
            SELECT id FROM core.roles WHERE name = 'User' LIMIT 1
            """
        )
        
        if not default_role:
            default_role = await db.execute_one(
                """
                INSERT INTO core.roles (id, name)
                VALUES (gen_random_uuid(), 'User')
                RETURNING id
                """
            )
        
        # Assign user to tenant with default role
        await db.execute_one(
            """
            INSERT INTO core.user_tenant_roles (id, user_id, tenant_id, role_id)
            VALUES (gen_random_uuid(), $1, $2, $3)
            """,
            str(user["id"]), assigned_tenant_id, str(default_role["id"])
        )
        
        return user
    
    async def get_user_with_context(self, user_id: str) -> Optional[CurrentUser]:
        """Get user with tenant and project context"""
        db = await get_database_manager()
        
        # Get user with tenant and project info
        result = await db.execute_one(
            """
            SELECT 
                u.id as user_id, u.email, u.full_name, u.is_active,
                u.created_at, u.updated_at,
                t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
                p.id as project_id, p.name as project_name, p.slug as project_slug,
                p.description as project_description,
                CASE WHEN admin_roles.admin_count > 0 THEN true ELSE false END as is_admin
            FROM core.users u
            LEFT JOIN core.tenants t ON t.is_active = true
            LEFT JOIN core.projects p ON p.tenant_id = t.id AND p.is_active = true
            LEFT JOIN (
                SELECT utr.user_id, COUNT(*) as admin_count
                FROM core.user_tenant_roles utr
                JOIN core.roles r ON utr.role_id = r.id
                WHERE r.name = 'Admin'
                GROUP BY utr.user_id
            ) admin_roles ON u.id = admin_roles.user_id
            WHERE u.id = $1 AND u.is_active = true
            LIMIT 1
            """,
            user_id
        )
        
        if not result:
            return None
        
        # Build response
        user = UserResponse(
            id=result["user_id"],
            email=result["email"],
            full_name=result["full_name"],
            is_active=result["is_active"],
            is_admin=result.get("is_admin", False),
            created_at=result["created_at"],
            updated_at=result["updated_at"]
        )
        
        tenant = None
        if result["tenant_id"]:
            tenant = TenantInfo(
                id=result["tenant_id"],
                name=result["tenant_name"],
                slug=result["tenant_slug"],
                is_active=True
            )
        
        project = None
        if result["project_id"]:
            project = ProjectInfo(
                id=result["project_id"],
                tenant_id=result["tenant_id"],
                name=result["project_name"],
                slug=result["project_slug"],
                description=result["project_description"],
                is_active=True
            )
        
        return CurrentUser(
            user=user,
            tenant=tenant,
            project=project,
            permissions=[]  # TODO: Implement role-based permissions
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
        print(f"🔐 Received credentials: {credentials.credentials[:20] if credentials.credentials else 'None'}...")
        token = credentials.credentials
        token_data = auth_manager.verify_token(token)
        
        if token_data is None or token_data.user_id is None:
            print(" Token verification failed or no user_id")
            raise credentials_exception
        
        print(f" Token verified for user_id: {token_data.user_id}")
        
        # Get user with full context
        current_user = await auth_manager.get_user_with_context(token_data.user_id)
        
        if current_user is None:
            print(f" User not found in database for user_id: {token_data.user_id}")
            raise credentials_exception
        
        print(f" User authenticated successfully: {current_user.user.email}")
        return current_user
    
    except HTTPException:
        print(" HTTPException raised during authentication")
        raise
    except Exception as e:
        print(f" Unexpected error during authentication: {str(e)}")
        raise credentials_exception

async def get_current_active_user(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """FastAPI dependency to ensure user is active"""
    print(f" Checking if user is active: {current_user.user.email}, is_active: {current_user.user.is_active}")
    
    if not current_user.user.is_active:
        print(f" User {current_user.user.email} is not active")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    print(f" User {current_user.user.email} is active")
    return current_user

# Optional auth dependency (doesn't fail if no token)
async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional[CurrentUser]:
    """FastAPI dependency for optional authentication"""
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        token_data = auth_manager.verify_token(token)
        
        if token_data is None or token_data.user_id is None:
            return None
        
        current_user = await auth_manager.get_user_with_context(token_data.user_id)
        return current_user
    
    except Exception:
        return None