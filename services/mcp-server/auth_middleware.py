"""
Authentication Middleware
Enforces bearer token authentication on protected routes
"""

import logging
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security.utils import get_authorization_scheme_param
from typing import Optional
import uuid
from datetime import datetime

from error_model import ErrorFactory, ErrorCode

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


class AuthMiddleware:
    """Authentication middleware for MCP server"""
    
    def __init__(self, config):
        self.config = config
        self.protected_paths = ["/api/v1/tools"]
        self.unprotected_paths = [
            "/api/v1/health", 
            "/api/v1/version",
            "/docs",
            "/openapi.json",
            "/redoc"
        ]
    
    async def __call__(self, request: Request, call_next):
        """Process request through authentication middleware"""
        
        # Generate trace_id for request tracking
        trace_id = str(uuid.uuid4())
        request.state.trace_id = trace_id
        request.state.request_id = request.headers.get("X-Request-ID", trace_id)
        
        # Authenticate request if path is protected
        if self.is_protected_path(request.url.path):
            await self.authenticate_request(request)
        
        # Process request
        response = await call_next(request)
        
        # Add trace_id to response headers
        response.headers["X-Trace-ID"] = trace_id
        response.headers["X-Request-ID"] = request.state.request_id
        
        return response
    
    def is_protected_path(self, path: str) -> bool:
        """Check if path requires authentication"""
        if not self.config.auth_required:
            return False
            
        # Check if path is explicitly unprotected
        for unprotected in self.unprotected_paths:
            if path.startswith(unprotected):
                return False
        
        # Check if path is explicitly protected  
        for protected in self.protected_paths:
            if path.startswith(protected):
                return True
                
        return False
    
    def extract_token(self, request: Request) -> Optional[str]:
        """Extract bearer token from request"""
        authorization = request.headers.get("Authorization")
        if not authorization:
            return None
            
        scheme, token = get_authorization_scheme_param(authorization)
        if scheme.lower() != "bearer":
            return None
            
        return token
    
    def validate_token(self, token: str) -> bool:
        """Validate bearer token"""
        if not self.config.auth_token:
            # If no auth token configured, accept any non-empty token in development
            return bool(token) and not self.config.is_production
            
        return token == self.config.auth_token
    
    async def authenticate_request(self, request: Request) -> Optional[dict]:
        """Authenticate request and return auth context"""
        if not self.is_protected_path(request.url.path):
            return None
            
        # Extract token
        token = self.extract_token(request)
        if not token:
            error = ErrorFactory.validation_error(
                code=ErrorCode.MISSING_AUTH_TOKEN,
                message="Authorization header with Bearer token is required"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error.to_dict(),
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Validate token
        if not self.validate_token(token):
            error = ErrorFactory.validation_error(
                code=ErrorCode.INVALID_AUTH_TOKEN,
                message="Invalid or expired authentication token"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error.to_dict(),
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Return auth context
        return {
            "authenticated": True,
            "token": token,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }


async def get_current_auth(request: Request) -> Optional[dict]:
    """Dependency to get current authentication context"""
    auth_middleware = request.app.state.auth_middleware
    return await auth_middleware.authenticate_request(request)


def get_request_context(request: Request) -> dict:
    """Get request context with tracing information"""
    return {
        "trace_id": getattr(request.state, "trace_id", None),
        "request_id": getattr(request.state, "request_id", None),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "path": request.url.path,
        "method": request.method
    }