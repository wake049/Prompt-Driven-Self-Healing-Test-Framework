"""
Delete Protection Middleware
Protects DELETE operations by requiring admin authentication
"""

import json
import logging
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable

logger = logging.getLogger(__name__)

class DeleteProtectionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to protect DELETE operations
    Requires admin authentication for DELETE requests
    """

    def __init__(self, app, enabled: bool = True):
        super().__init__(app)
        self.enabled = enabled
        
        # Protected endpoints that require admin access for DELETE
        self.protected_paths = [
            "/api/v1/healing/data",
            "/api/v1/selectors",
            "/api/v1/policy",
            "/api/v1/analytics",
            "/api/v1/sql"
        ]

    async def dispatch(self, request: Request, call_next: Callable):
        """Process request and check DELETE permissions"""
        
        # Only process DELETE requests
        if request.method != "DELETE" or not self.enabled:
            response = await call_next(request)
            return response

        # Check if path requires protection
        path_protected = any(
            request.url.path.startswith(protected_path) 
            for protected_path in self.protected_paths
        )
        
        if path_protected:
            logger.info(f"DELETE request to protected path: {request.url.path}")
            
            # Check for admin authentication
            try:
                # Get Authorization header
                auth_header = request.headers.get("Authorization")
                if not auth_header or not auth_header.startswith("Bearer "):
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={
                            "detail": "Authentication required for delete operations",
                            "error_code": "DELETE_AUTH_REQUIRED"
                        }
                    )
                
                # Extract token
                token = auth_header.split(" ")[1]
                
                # Mock token validation (replace with actual token validation)
                # For now, we'll check for a specific admin token pattern
                if not self._is_admin_token(token):
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={
                            "detail": "Admin privileges required for delete operations",
                            "error_code": "DELETE_ADMIN_REQUIRED"
                        }
                    )
                
                # Log successful admin operation
                logger.info(f"Admin delete operation authorized")
                
            except Exception as e:
                logger.error(f"Error in delete protection middleware: {str(e)}")
                return JSONResponse(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    content={
                        "detail": "Error validating delete permissions",
                        "error_code": "DELETE_VALIDATION_ERROR"
                    }
                )
        
        # Proceed with the request
        response = await call_next(request)
        return response

    def _is_admin_token(self, token: str) -> bool:
        """
        Validate if token belongs to an admin user
        This is a simplified implementation - replace with actual token validation
        """
        try:
            # For development, accept tokens that contain 'admin'
            # In production, this should validate against your auth system
            return "admin" in token.lower() or len(token) > 50
        except Exception:
            return False