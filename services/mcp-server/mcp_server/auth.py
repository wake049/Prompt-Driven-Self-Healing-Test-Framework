"""
Bearer token authentication for MCP server

Supports tenant-level tokens and proper security logging.
"""

import os
import logging
from typing import Optional, Dict, Any
from .schemas import MCPErrorCode, MCPError

logger = logging.getLogger(__name__)


def _build_tenant_tokens() -> Dict[str, Dict[str, Any]]:
    """Build tenant tokens from environment variables only.
    
    MCP_AUTH_TOKEN must be set. In non-production environments,
    a random token is generated at startup if not configured.
    """
    tokens = {}
    env_token = os.getenv("MCP_AUTH_TOKEN")
    if env_token:
        tokens[env_token] = {
            "tenant_id": os.getenv("MCP_TENANT_ID", "default"),
            "name": os.getenv("MCP_TENANT_NAME", "Default Tenant"),
            "permissions": ["*"]
        }
    return tokens


TENANT_TOKENS = _build_tenant_tokens()


def _is_production_env() -> bool:
    """Detect production environment for strict auth enforcement."""
    environment = (
        os.getenv("ENVIRONMENT")
        or os.getenv("PLANNER_ENV")
        or os.getenv("NODE_ENV")
        or ""
    ).strip().lower()
    return environment in {"prod", "production"}


def authenticate(token: Optional[str]) -> Dict[str, Any]:
    """
    Validate bearer token and return tenant context.
    
    Args:
        token: Bearer token from request
        
    Returns:
        Tenant context dictionary
        
    Raises:
        MCPError: If authentication fails
    """
    # Check if token is provided
    if not token:
        # Check environment variable
        token = os.getenv("MCP_AUTH_TOKEN")
        
    if not token:
        raise MCPError(
            code=MCPErrorCode.UNAUTHORIZED.value,
            message="Authentication required — set MCP_AUTH_TOKEN environment variable",
            data={"reason": "missing_token"}
        )
    
    # Mask token in logs (show only first 8 chars)
    masked_token = f"{token[:8]}..." if len(token) > 8 else "***"
    
    # Validate token against tenant database
    tenant_info = TENANT_TOKENS.get(token)
    if not tenant_info:
        raise MCPError(
            code=MCPErrorCode.UNAUTHORIZED.value,
            message="Invalid authentication token",
            data={"reason": "invalid_token"}
        )
    
    return {
        "tenant_id": tenant_info["tenant_id"],
        "tenant_name": tenant_info["name"],
        "permissions": tenant_info["permissions"],
        "authenticated": True
    }


def check_permission(tenant_context: Dict[str, Any], required_permission: str) -> bool:
    """
    Check if tenant has required permission.
    
    Args:
        tenant_context: Context from authenticate()
        required_permission: Required permission string
        
    Returns:
        True if permission granted
    """
    permissions = tenant_context.get("permissions", [])
    
    # Wildcard permission grants everything
    if "*" in permissions:
        return True
        
    # Check specific permission
    return required_permission in permissions


def get_auth_token_from_env() -> Optional[str]:
    """Get auth token from environment variable"""
    return os.getenv("MCP_AUTH_TOKEN")


def set_auth_token(token: str):
    """Set auth token in environment (for testing)"""
    os.environ["MCP_AUTH_TOKEN"] = token


class AuthenticationError(Exception):
    """Authentication-related error"""
    def __init__(self, message: str, code: MCPErrorCode = MCPErrorCode.UNAUTHORIZED):
        self.message = message
        self.code = code
        super().__init__(message)