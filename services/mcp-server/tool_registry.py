"""
Tool Registry
Manages registration and discovery of MCP tools
"""

import asyncio
import logging
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
import inspect
from datetime import datetime

logger = logging.getLogger(__name__)


class ToolCategory(Enum):
    """Tool categories for organization"""
    EXECUTION = "execution"
    ELEMENT_REPOSITORY = "element_repository"
    POLICY = "policy"
    ANALYTICS = "analytics"
    WORKFLOW = "workflow"
    TESTING = "testing"


@dataclass
class ToolMetadata:
    """Metadata for a registered tool"""
    name: str
    description: str
    category: ToolCategory
    version: str = "1.0.0"
    timeout_ms: int = 30000
    requires_auth: bool = True
    input_schema: Optional[dict] = None
    output_schema: Optional[dict] = None
    dependencies: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    registered_at: datetime = field(default_factory=datetime.now)


class ToolRegistry:
    """Registry for managing MCP tools"""
    
    def __init__(self):
        self._tools: Dict[str, Callable] = {}
        self._metadata: Dict[str, ToolMetadata] = {}
        self._categories: Dict[ToolCategory, List[str]] = {
            category: [] for category in ToolCategory
        }
        self._initialized = False
    
    async def initialize(self):
        """Initialize the tool registry"""
        if self._initialized:
            return
        
        logger.info("Initializing Tool Registry...")
        
        # Register core tools
        await self._register_core_tools()
        
        # Register plugin tools
        await self._register_plugin_tools()
        
        self._initialized = True
        logger.info(f"Tool Registry initialized with {len(self._tools)} tools")
    
    async def cleanup(self):
        """Cleanup registry resources"""
        self._tools.clear()
        self._metadata.clear()
        for category_list in self._categories.values():
            category_list.clear()
        self._initialized = False
        logger.info("Tool Registry cleaned up")
    
    def register_tool(
        self, 
        name: str, 
        func: Callable, 
        metadata: ToolMetadata
    ):
        """Register a tool with metadata"""
        if name in self._tools:
            logger.warning(f"Tool '{name}' is already registered, overwriting")
        
        # Validate function signature
        self._validate_tool_function(func)
        
        # Register tool
        self._tools[name] = func
        self._metadata[name] = metadata
        
        # Add to category
        if name not in self._categories[metadata.category]:
            self._categories[metadata.category].append(name)
        
        logger.info(f"Registered tool: {name} ({metadata.category.value})")
    
    def unregister_tool(self, name: str):
        """Unregister a tool"""
        if name not in self._tools:
            raise ValueError(f"Tool '{name}' is not registered")
        
        metadata = self._metadata[name]
        
        # Remove from all data structures
        del self._tools[name]
        del self._metadata[name]
        self._categories[metadata.category].remove(name)
        
        logger.info(f"Unregistered tool: {name}")
    
    def get_tool(self, name: str) -> Optional[Callable]:
        """Get a registered tool by name"""
        return self._tools.get(name)
    
    def get_metadata(self, name: str) -> Optional[ToolMetadata]:
        """Get tool metadata by name"""
        return self._metadata.get(name)
    
    def list_tools(self, category: Optional[ToolCategory] = None) -> List[str]:
        """List all tools or tools in a specific category"""
        if category is None:
            return list(self._tools.keys())
        return self._categories.get(category, []).copy()
    
    def list_categories(self) -> List[ToolCategory]:
        """List all available categories"""
        return list(ToolCategory)
    
    def get_tool_info(self, name: str) -> Optional[dict]:
        """Get comprehensive tool information"""
        if name not in self._tools:
            return None
        
        metadata = self._metadata[name]
        func = self._tools[name]
        
        # Get function signature
        sig = inspect.signature(func)
        parameters = {}
        for param_name, param in sig.parameters.items():
            parameters[param_name] = {
                "type": str(param.annotation) if param.annotation != inspect.Parameter.empty else "Any",
                "default": str(param.default) if param.default != inspect.Parameter.empty else None,
                "required": param.default == inspect.Parameter.empty
            }
        
        return {
            "name": metadata.name,
            "description": metadata.description,
            "category": metadata.category.value,
            "version": metadata.version,
            "timeout_ms": metadata.timeout_ms,
            "requires_auth": metadata.requires_auth,
            "parameters": parameters,
            "input_schema": metadata.input_schema,
            "output_schema": metadata.output_schema,
            "dependencies": metadata.dependencies,
            "tags": metadata.tags,
            "registered_at": metadata.registered_at.isoformat()
        }
    
    def search_tools(self, query: str) -> List[str]:
        """Search tools by name, description, or tags"""
        query_lower = query.lower()
        matches = []
        
        for name, metadata in self._metadata.items():
            if (query_lower in name.lower() or 
                query_lower in metadata.description.lower() or 
                any(query_lower in tag.lower() for tag in metadata.tags)):
                matches.append(name)
        
        return matches
    
    async def call_tool(self, name: str, *args, **kwargs) -> Any:
        """Call a registered tool"""
        if name not in self._tools:
            raise ValueError(f"Tool '{name}' is not registered")
        
        func = self._tools[name]
        metadata = self._metadata[name]
        
        try:
            # Handle async and sync functions
            if inspect.iscoroutinefunction(func):
                # Async function with timeout
                return await asyncio.wait_for(
                    func(*args, **kwargs),
                    timeout=metadata.timeout_ms / 1000
                )
            else:
                # Sync function - run in executor with timeout
                return await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(None, func, *args, **kwargs),
                    timeout=metadata.timeout_ms / 1000
                )
        except asyncio.TimeoutError:
            raise TimeoutError(f"Tool '{name}' timed out after {metadata.timeout_ms}ms")
        except Exception as e:
            logger.error(f"Error calling tool '{name}': {e}")
            raise
    
    def get_registry_stats(self) -> dict:
        """Get registry statistics"""
        total_tools = len(self._tools)
        category_counts = {
            category.value: len(tools) 
            for category, tools in self._categories.items()
        }
        
        return {
            "total_tools": total_tools,
            "categories": category_counts,
            "initialized": self._initialized
        }
    
    def _validate_tool_function(self, func: Callable):
        """Validate that the function is suitable for registration"""
        if not callable(func):
            raise ValueError("Tool must be callable")
        
        # Check if function has proper signature
        sig = inspect.signature(func)
        if len(sig.parameters) == 0:
            logger.warning("Tool function has no parameters")
    
    async def _register_core_tools(self):
        """Register core MCP tools"""
        # Execution tools
        self.register_tool(
            "run_action",
            self._run_action_tool,
            ToolMetadata(
                name="run_action",
                description="Execute a single test action with self-healing capabilities",
                category=ToolCategory.EXECUTION,
                timeout_ms=45000,
                tags=["execution", "testing", "core"]
            )
        )
        
        # Element repository tools
        self.register_tool(
            "get_element",
            self._get_element_tool,
            ToolMetadata(
                name="get_element",
                description="Retrieve element locator from repository",
                category=ToolCategory.ELEMENT_REPOSITORY,
                timeout_ms=5000,
                tags=["element", "repository", "core"]
            )
        )
        
        self.register_tool(
            "bulk_generate_locators",
            self._bulk_generate_locators_tool,
            ToolMetadata(
                name="bulk_generate_locators",
                description="Generate multiple element locators using AI",
                category=ToolCategory.ELEMENT_REPOSITORY,
                timeout_ms=60000,
                tags=["element", "ai", "generation"]
            )
        )
        
        # Analytics tools
        self.register_tool(
            "analytics_log",
            self._analytics_log_tool,
            ToolMetadata(
                name="analytics_log",
                description="Record execution metrics and performance data",
                category=ToolCategory.ANALYTICS,
                timeout_ms=2000,
                tags=["analytics", "metrics", "logging"]
            )
        )
    
    async def _register_plugin_tools(self):
        """Register plugin tools from external modules"""
        # This would load tools from plugins directory
        # For now, we'll skip this but it's where extensibility would happen
        pass
    
    # Tool implementations (stubs for now)
    async def _run_action_tool(self, action_type: str, element_name: str, parameters: dict) -> dict:
        """Run action tool implementation"""
        return {
            "status": "success",
            "execution_time_ms": 1250,
            "selector_used": f"#{element_name}",
            "message": f"Executed {action_type} on {element_name}"
        }
    
    async def _get_element_tool(self, element_name: str, context: dict = None) -> dict:
        """Get element tool implementation"""
        return {
            "element_name": element_name,
            "selector": f"#{element_name}",
            "selector_type": "css",
            "confidence": 0.95,
            "last_updated": datetime.now().isoformat()
        }
    
    async def _bulk_generate_locators_tool(self, element_names: List[str], page_context: dict) -> dict:
        """Bulk generate locators tool implementation"""
        locators = []
        for name in element_names:
            locators.append({
                "element_name": name,
                "selector": f"#{name}",
                "confidence": 0.87,
                "ai_reasoning": f"Primary element with ID matching {name}"
            })
        
        return {
            "locators": locators,
            "batch_confidence": 0.87,
            "review_required": False,
            "estimated_review_time_minutes": 5
        }
    
    async def _analytics_log_tool(self, event_type: str, metrics: dict, context: dict) -> dict:
        """Analytics log tool implementation"""
        return {
            "logged": True,
            "event_id": f"evt_{datetime.now().timestamp()}",
            "timestamp": datetime.now().isoformat()
        }