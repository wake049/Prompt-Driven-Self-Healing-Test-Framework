"""
MCP Server Configuration
Handles all configuration for ports, auth tokens, timeouts, etc.
"""

import os
from typing import Optional
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


class MCPConfig(BaseSettings):
    """MCP Server configuration settings"""
    
    # Server settings
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8001, description="Server port")
    log_level: str = Field(default="INFO", description="Log level")
    
    # Authentication settings
    auth_token: Optional[str] = Field(default=None, description="API authentication token")
    auth_required: bool = Field(default=False, description="Whether authentication is required")
    token_expiry_hours: int = Field(default=24, description="Token expiry in hours")
    
    # Timeout settings
    tool_call_timeout: int = Field(default=30000, description="Tool call timeout in milliseconds")
    connection_timeout: int = Field(default=5000, description="Connection timeout in milliseconds")
    request_timeout: int = Field(default=10000, description="Request timeout in milliseconds")
    
    # Performance settings
    max_concurrent_tools: int = Field(default=100, description="Maximum concurrent tool calls")
    rate_limit_per_minute: int = Field(default=1000, description="Rate limit per minute per client")
    
    # Database settings
    database_url: Optional[str] = Field(default=None, description="Database connection URL")
    redis_url: Optional[str] = Field(default="redis://localhost:6379", description="Redis connection URL")
    
    # Service discovery
    element_repository_url: str = Field(default="http://localhost:8002", description="Element Repository service URL")
    policy_engine_url: str = Field(default="http://localhost:8003", description="Policy Engine service URL")
    execution_service_url: str = Field(default="http://localhost:8004", description="Execution Service URL")
    
    # Feature flags
    enable_analytics: bool = Field(default=True, description="Enable analytics logging")
    enable_metrics: bool = Field(default=True, description="Enable metrics collection")
    enable_tracing: bool = Field(default=False, description="Enable distributed tracing")
    
    # Development settings
    debug: bool = Field(default=False, description="Enable debug mode")
    auto_reload: bool = Field(default=False, description="Enable auto-reload for development")
    
    class Config:
        env_prefix = "MCP_"
        env_file = ".env"
        case_sensitive = False
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment"""
        return os.getenv("ENVIRONMENT", "development").lower() == "production"
    
    @property
    def server_info(self) -> dict:
        """Get server information for health checks"""
        return {
            "host": self.host,
            "port": self.port,
            "debug": self.debug,
            "auth_required": self.auth_required,
            "environment": "production" if self.is_production else "development"
        }
    
    def validate_config(self) -> list[str]:
        """Validate configuration and return any warnings"""
        warnings = []
        
        if self.is_production and self.debug:
            warnings.append("Debug mode is enabled in production")
        
        if self.is_production and not self.auth_required:
            warnings.append("Authentication is disabled in production")
        
        if self.is_production and not self.auth_token:
            warnings.append("No auth token configured in production")
        
        if self.tool_call_timeout > 60000:
            warnings.append("Tool call timeout is very high (>60s)")
        
        return warnings