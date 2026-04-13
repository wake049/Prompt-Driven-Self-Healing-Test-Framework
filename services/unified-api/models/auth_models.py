"""
Authentication Models and Schemas
Pydantic models for user authentication, registration, and JWT tokens
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime
import uuid
import re


COMMON_WEAK_PASSWORDS = {
    "password",
    "password123",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty123",
    "admin123",
    "letmein",
    "welcome123",
    "abc123456",
    "iloveyou1",
    "monkey1234",
    "dragon1234",
    "master1234",
    "qwerty1234",
    "login12345",
    "princess12",
    "welcome1234",
    "shadow1234",
    "sunshine12",
    "trustno123",
    "football12",
    "baseball12",
    "superman12",
    "michael123",
    "charlie123",
    "passw0rd12",
    "changeme12",
    "password1!",
    "admin12345",
    "Pa$$word12",
    "Welcome123",
    "Passw0rd12",
    "P@ssword12",
    "Password1!",
    "Qwerty1234",
    "Letmein123",
    "Changeme1!",
    "123Qwerty!",
    "Test123456",
    "Hello12345",
    "Access1234",
    "Trustno1!2",
    "Dragon1234",
    "Master1234",
    "Summer2024",
    "Winter2024",
    "Spring2024",
    "Autumn2024",
}


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _validate_password_strength(value: str) -> str:
    password = value.strip()

    if len(password) < 10:
        raise ValueError("Password must be at least 10 characters")

    if len(password) > 128:
        raise ValueError("Password must not exceed 128 characters")

    if password.lower() in COMMON_WEAK_PASSWORDS:
        raise ValueError("Password is too common")

    if re.search(r"\s", password):
        raise ValueError("Password cannot contain spaces")

    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must include at least one uppercase letter")

    if not re.search(r"[a-z]", password):
        raise ValueError("Password must include at least one lowercase letter")

    if not re.search(r"\d", password):
        raise ValueError("Password must include at least one number")

    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError("Password must include at least one special character")

    return password


def _validate_full_name(value: str) -> str:
    name = value.strip()

    if len(name) < 2 or len(name) > 100:
        raise ValueError("Full name must be between 2 and 100 characters")

    if re.search(r"\s{2,}", name):
        raise ValueError("Full name cannot contain consecutive spaces")

    return name

# User Authentication Schemas

class UserLogin(BaseModel):
    """Login request schema"""
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")

    @validator('email')
    def normalize_email(cls, v):
        return _normalize_email(v)

class UserRegister(BaseModel):
    """User registration schema"""
    email: EmailStr
    password: str = Field(..., min_length=10, description="Password must be at least 10 characters")
    full_name: str = Field(..., min_length=2, max_length=100, description="Full name of the user")
    confirm_password: str = Field(..., description="Password confirmation")
    invitation_token: Optional[str] = Field(None, description="Optional invitation token to join an organization")
    terms_accepted: bool = Field(..., description="User has accepted terms and conditions")
    terms_version: str = Field(default="1.0", description="Version of terms accepted")

    @validator('email')
    def normalize_email(cls, v):
        return _normalize_email(v)

    @validator('password')
    def validate_password_strength(cls, v):
        return _validate_password_strength(v)

    @validator('full_name')
    def validate_full_name(cls, v):
        return _validate_full_name(v)

    @validator('invitation_token')
    def validate_invitation_token(cls, v):
        if not v:
            return v
        token = v.strip()
        if len(token) < 16 or len(token) > 256:
            raise ValueError('Invalid invitation token')
        return token
    
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v

    @validator('terms_accepted')
    def validate_terms_accepted(cls, v):
        if v is not True:
            raise ValueError('You must accept the Terms of Service and Privacy Policy')
        return v

class OrganizationRegister(BaseModel):
    """Organization registration schema - creates new tenant"""
    email: EmailStr
    password: str = Field(..., min_length=10, description="Password must be at least 10 characters")
    full_name: str = Field(..., min_length=2, max_length=100, description="Full name of the user")
    confirm_password: str = Field(..., description="Password confirmation")
    organization_name: str = Field(..., min_length=2, max_length=100, description="Organization name")
    organization_slug: Optional[str] = Field(None, description="Optional organization slug (auto-generated if not provided)")
    terms_accepted: bool = Field(..., description="User has accepted terms and conditions")
    terms_version: str = Field(default="1.0", description="Version of terms accepted")

    @validator('email')
    def normalize_email(cls, v):
        return _normalize_email(v)

    @validator('password')
    def validate_password_strength(cls, v):
        return _validate_password_strength(v)

    @validator('full_name')
    def validate_full_name(cls, v):
        return _validate_full_name(v)

    @validator('organization_name')
    def validate_organization_name(cls, v):
        org_name = v.strip()
        if len(org_name) < 2 or len(org_name) > 100:
            raise ValueError('Organization name must be between 2 and 100 characters')
        return org_name

    @validator('organization_slug')
    def validate_organization_slug(cls, v):
        if not v:
            return v
        slug = v.strip().lower()
        if not re.fullmatch(r"[a-z0-9-]{2,100}", slug):
            raise ValueError('Organization slug may only contain lowercase letters, numbers, and hyphens')
        return slug
    
    @validator('confirm_password')
    def passwords_match(cls, v, values, **kwargs):
        if 'password' in values and v != values['password']:
            raise ValueError('Passwords do not match')
        return v

    @validator('terms_accepted')
    def validate_terms_accepted(cls, v):
        if v is not True:
            raise ValueError('You must accept the Terms of Service and Privacy Policy')
        return v

class PasswordChange(BaseModel):
    """Password change schema"""
    current_password: str
    new_password: str = Field(..., min_length=10)
    confirm_password: str

    @validator('new_password')
    def validate_password_strength(cls, v):
        return _validate_password_strength(v)
    
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

class InvitationToken(BaseModel):
    """Invitation token response"""
    token: str
    expires_at: datetime
    organization_name: str
    role: str

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
    role: Optional[str] = None  # User's role in the organization (owner, admin, member, viewer)
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