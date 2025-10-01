"""
MCP Server Package
Model Context Protocol Server for Test Automation Platform
"""

from main import create_app, main
from server import MCPServer
from config import MCPConfig
from tool_registry import ToolRegistry, ToolCategory, ToolMetadata

__version__ = "0.1.0"
__author__ = "Wake049"
__description__ = "Model Context Protocol Server for Test Automation Platform"

__all__ = [
    "create_app",
    "main", 
    "MCPServer",
    "MCPConfig",
    "ToolRegistry",
    "ToolCategory",
    "ToolMetadata"
]