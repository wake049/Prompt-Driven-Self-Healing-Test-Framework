"""
Authentication Middleware
Enforces bearer token authentication on protected routes (with sane dev defaults)
"""

import logging
from datetime import datetime
from typing import Optional
from fastapi import HTTPException, Request, status
from fastapi.security.utils import get_authorization_scheme_param
import uuid

from .error_model import ErrorFactory, ErrorCode

logger = logging.getLogger(__name__)


class AuthMiddleware:
    """Authentication middleware for MCP server"""

    def __init__(self, config):
        self.config = config

        # Endpoints that DO NOT require auth (prefix match)
        # Keep review unprotected while integrating. Move it to protected later.
        self.unprotected_prefixes = (
            "/api/v1/health",
            "/api/v1/version",
            "/api/v1/review",   # <— TEMP: open for frontend integration
            "/docs",
            "/openapi.json",
            "/redoc",
        )

        # Endpoints that DO require auth (prefix match)
        self.protected_prefixes = (
            "/api/v1/tools",
            # add "/api/v1/review" here later once the FE sends tokens
        )

    async def __call__(self, request: Request, call_next):
        # Give every request a trace/request id
        trace_id = str(uuid.uuid4())
        request.state.trace_id = trace_id
        request.state.request_id = request.headers.get("X-Request-ID", trace_id)

        # Bypass OPTIONS (preflight) always
        if request.method == "OPTIONS":
            response = await call_next(request)
            response.headers["X-Trace-ID"] = trace_id
            response.headers["X-Request-ID"] = request.state.request_id
            return response

        # Authenticate only when needed
        if self._is_protected(request.url.path):
            await self._authenticate_request(request)

        response = await call_next(request)
        response.headers["X-Trace-ID"] = trace_id
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    def _is_unprotected(self, path: str) -> bool:
        return path.startswith(self.unprotected_prefixes)

    def _is_protected(self, path: str) -> bool:
        if not getattr(self.config, "auth_required", False):
            return False
        if self._is_unprotected(path):
            return False
        return path.startswith(self.protected_prefixes)

    def _extract_token(self, request: Request) -> Optional[str]:
        authz = request.headers.get("Authorization")
        if not authz:
            return None
        scheme, token = get_authorization_scheme_param(authz)
        if scheme.lower() != "bearer":
            return None
        return token

    def _validate_token(self, token: str) -> bool:
        # If no configured token: allow any non-empty token in dev, require exact match in prod
        configured = getattr(self.config, "auth_token", None)
        if not configured:
            return bool(token) and not getattr(self.config, "is_production", True)
        return token == configured

    async def _authenticate_request(self, request: Request) -> Optional[dict]:
        token = self._extract_token(request)

        # Dev-friendly: allow localhost without token if not production and no token set
        if not token and not getattr(self.config, "is_production", True) and not getattr(self.config, "auth_token", None):
            logger.debug("Dev mode: allowing request without token")
            return {
                "authenticated": False,
                "token": None,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }

        if not token:
            error = ErrorFactory.validation_error(
                code=ErrorCode.MISSING_AUTH_TOKEN,
                message="Authorization header with Bearer token is required",
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error.to_dict(),
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not self._validate_token(token):
            error = ErrorFactory.validation_error(
                code=ErrorCode.INVALID_AUTH_TOKEN,
                message="Invalid or expired authentication token",
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=error.to_dict(),
                headers={"WWW-Authenticate": "Bearer"},
            )

        return {
            "authenticated": True,
            "token": token,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }


async def get_current_auth(request: Request) -> Optional[dict]:
    auth_middleware = request.app.state.auth_middleware
    return await auth_middleware._authenticate_request(request)


def get_request_context(request: Request) -> dict:
    return {
        "trace_id": getattr(request.state, "trace_id", None),
        "request_id": getattr(request.state, "request_id", None),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "path": request.url.path,
        "method": request.method,
    }


async def verify_bearer_token(request: Request) -> dict:
    """
    FastAPI dependency that ENFORCES auth on the route that uses it,
    regardless of global protected/unprotected path lists.
    """
    auth_middleware = request.app.state.auth_middleware
    # call the internal authenticate method to force-check this request
    return await auth_middleware._authenticate_request(request)