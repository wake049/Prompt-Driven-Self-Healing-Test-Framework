"""
Authentication Models and Schemas
Pydantic models for user authentication, registration, and JWT tokens
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
import uuid

# User Authentication Schemas

class UserLogin(BaseModel):
    """Login request schema"""
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")

class UserRegister(BaseModel):
    """User registration schema"""
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    full_name: str = Field(..., min_length=2, max_length=100, description="Full name of the user")
    confirm_password: str = Field(..., description="Password confirmation")
    
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v

class PasswordChange(BaseModel):
    """Password change schema"""
    current_password: str
    new_password: str = Field(..., min_length=6)
    confirm_password: str
    
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'new_password' in values and v != values['new_password']:
            raise ValueError('Passwords do not match')
        return v

# JWT Token Schemas

class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = None  # Optional - not used when tokens don't expire

class TokenData(BaseModel):
    """JWT token payload data"""
    email: Optional[str] = None
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    project_id: Optional[str] = None

# User Response Schemas

class UserBase(BaseModel):
    """Base user information"""
    id: uuid.UUID
    email: str
    full_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

class UserProfile(UserBase):
    """Extended user profile with tenant/project info"""
    tenant_id: Optional[uuid.UUID] = None
    tenant_name: Optional[str] = None
    project_id: Optional[uuid.UUID] = None
    project_name: Optional[str] = None

class UserResponse(UserBase):
    """User response for API calls"""
    class Config:
        from_attributes = True

# Tenant and Project Schemas (for user context)

class TenantInfo(BaseModel):
    """Tenant information"""
    id: uuid.UUID
    name: str
    slug: str
    is_active: bool

class ProjectInfo(BaseModel):
    """Project information"""
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    is_active: bool

# Current User Context Schema

class CurrentUser(BaseModel):
    """Current authenticated user with full context"""
    user: UserResponse
    tenant: Optional[TenantInfo] = None
    project: Optional[ProjectInfo] = None
    permissions: List[str] = []

# Error Response Schemas

class AuthError(BaseModel):
    """Authentication error response"""
    detail: str
    error_code: Optional[str] = None

class ValidationError(BaseModel):
    """Validation error response"""
    detail: str
    field_errors: Optional[dict] = None

# User Management Schemas (for admin functions)

class UserCreate(BaseModel):
    """Schema for creating users (admin only)"""
    email: EmailStr
    full_name: str
    password: str = Field(..., min_length=6)
    is_active: bool = True
    tenant_id: Optional[uuid.UUID] = None

class UserUpdate(BaseModel):
    """Schema for updating user information"""
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    tenant_id: Optional[uuid.UUID] = None

class UserList(BaseModel):
    """Paginated user list response"""
    users: List[UserResponse]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool