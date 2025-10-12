"""
MCP Server Configuration
Handles all configuration for ports, auth tokens, timeouts, etc.
"""

import os
from typing import Optional, List
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class MCPConfig(BaseSettings):
    """MCP Server configuration settings (Pydantic v2 compatible)"""

    # --- AI / Suggestion ---
    AI_PROVIDER: str = Field(default=os.getenv("AI_PROVIDER", "openai").strip().lower())
    OPENAI_API_KEY: str = Field(default=os.getenv("OPENAI_API_KEY", "").strip())
    OPENAI_MODEL: str = Field(default=os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip())
    SUGGESTION_MAX_ALTS: int = Field(default=int(os.getenv("SUGGESTION_MAX_ALTS", "3")))
    SUGGESTION_TEMPERATURE: float = Field(default=float(os.getenv("SUGGESTION_TEMPERATURE", "0.2")))
    REVIEW_STORAGE_PATH: str = Field(default=os.getenv("REVIEW_STORAGE_PATH", "storage/review_queue.json").strip())

    # --- External services ---
    RUNNER_BASE_URL: str = Field(default=os.getenv("RUNNER_BASE_URL", "").strip())
    REVIEW_STORAGE_PATH: str = Field(default=os.getenv("REVIEW_STORAGE_PATH", "storage/review_queue.json").strip())

    # --- Server settings ---
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8001, description="Server port")
    log_level: str = Field(default="INFO", description="Log level")

    # --- Authentication ---
    auth_token: Optional[str] = Field(default=None, description="API authentication token")
    auth_required: bool = Field(default=False, description="Whether authentication is required")
    token_expiry_hours: int = Field(default=24, description="Token expiry in hours")

    # --- Timeouts ---
    tool_call_timeout: int = Field(default=30000, description="Tool call timeout (ms)")
    connection_timeout: int = Field(default=5000, description="Connection timeout (ms)")
    request_timeout: int = Field(default=10000, description="Request timeout (ms)")
    request_timeout_ms: int = Field(default=10000, description="Request timeout (ms, alias)")

    # --- Performance ---
    max_concurrent_tools: int = Field(default=100, description="Maximum concurrent tool calls")
    rate_limit_per_minute: int = Field(default=1000, description="Rate limit per minute per client")

    # --- Data stores ---
    database_url: Optional[str] = Field(default=None, description="Database connection URL")
    redis_url: Optional[str] = Field(default="redis://localhost:6379", description="Redis connection URL")

    # --- Service discovery ---
    element_repository_url: str = Field(default="http://localhost:8002", description="Element Repository service URL")
    policy_engine_url: str = Field(default="http://localhost:8003", description="Policy Engine service URL")
    execution_service_url: str = Field(default="http://localhost:8004", description="Execution Service URL")

    # --- Feature flags ---
    enable_analytics: bool = Field(default=True, description="Enable analytics logging")
    enable_metrics: bool = Field(default=True, description="Enable metrics collection")
    enable_tracing: bool = Field(default=False, description="Enable distributed tracing")

    # --- Development ---
    debug: bool = Field(default=False, description="Enable debug mode")
    auto_reload: bool = Field(default=False, description="Enable auto-reload for development")
    environment: str = Field(default="development", description="Environment (development/production)")

    # Pydantic v2 settings config
    model_config = SettingsConfigDict(
        env_prefix="MCP_",            # Also allows MCP_* env vars
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    def model_post_init(self, __context) -> None:
        """Sync timeout aliases after init (v2 equivalent of __post_init__)."""
        if getattr(self, "request_timeout_ms", None) is not None and self.request_timeout_ms != self.request_timeout:
            self.request_timeout = self.request_timeout_ms

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def server_info(self) -> dict:
        return {
            "host": self.host,
            "port": self.port,
            "debug": self.debug,
            "auth_required": self.auth_required,
            "environment": self.environment,
        }

    def validate_config(self) -> List[str]:
        warnings: List[str] = []

        if self.is_production and self.debug:
            warnings.append("Debug mode is enabled in production")

        if self.is_production and not self.auth_required:
            warnings.append("Authentication is disabled in production")

        if self.is_production and not self.auth_token:
            warnings.append("No auth token configured in production")

        if self.tool_call_timeout > 60000:
            warnings.append("Tool call timeout is very high (>60s)")

        return warnings


# Create a singleton settings object for the app to import
settings = MCPConfig()

# Convenience re-exports so existing imports keep working:
# from core.config import RUNNER_BASE_URL, SUGGESTION_MAX_ALTS
RUNNER_BASE_URL: str = settings.RUNNER_BASE_URL
SUGGESTION_MAX_ALTS: int = settings.SUGGESTION_MAX_ALTS
REVIEW_STORAGE_PATH: str = settings.REVIEW_STORAGE_PATH
AI_PROVIDER: str = settings.AI_PROVIDER
OPENAI_API_KEY: str = settings.OPENAI_API_KEY
OPENAI_MODEL: str = settings.OPENAI_MODEL
SUGGESTION_TEMPERATURE: float = settings.SUGGESTION_TEMPERATURE