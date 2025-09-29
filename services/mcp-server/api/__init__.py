"""
API package initialization
"""

from .health import router as health_router
from .version import router as version_router
from .tools import router as tools_router

__all__ = ["health_router", "version_router", "tools_router"]