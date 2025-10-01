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
from datetime import datetime, timezone

from schema_validator import validate_tool_request, validate_tool_response
from error_model import ErrorFactory, ErrorCode, MCPError

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
        """Call a registered tool with schema validation"""
        if name not in self._tools:
            error = ErrorFactory.not_found_error(
                code=ErrorCode.TOOL_NOT_FOUND,
                message=f"Tool '{name}' is not registered",
                resource_type="tool",
                resource_id=name
            )
            raise ValueError(error.message)
        
        func = self._tools[name]
        metadata = self._metadata[name]
        
        # Validate input parameters against schema
        if kwargs:  # Only validate if we have keyword arguments
            validation_error = validate_tool_request(name, kwargs)
            if validation_error:
                logger.error(f"Input validation failed for tool '{name}': {validation_error.message}")
                raise ValueError(f"Input validation failed: {validation_error.message}")
        
        try:
            # Handle async and sync functions
            if inspect.iscoroutinefunction(func):
                # Async function with timeout
                result = await asyncio.wait_for(
                    func(*args, **kwargs),
                    timeout=metadata.timeout_ms / 1000
                )
            else:
                # Sync function - run in executor with timeout
                result = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(None, func, *args, **kwargs),
                    timeout=metadata.timeout_ms / 1000
                )
            
            # Validate output against schema
            if result and isinstance(result, dict):
                validation_error = validate_tool_response(name, result)
                if validation_error:
                    logger.warning(f"Output validation failed for tool '{name}': {validation_error.message}")
                    # Don't fail the request for output validation errors, just log them
                    # In production, you might want to handle this differently
            
            return result
            
        except asyncio.TimeoutError:
            error = ErrorFactory.timeout_error(
                code=ErrorCode.TOOL_EXECUTION_TIMEOUT,
                message=f"Tool '{name}' timed out after {metadata.timeout_ms}ms",
                timeout_ms=metadata.timeout_ms,
                operation=f"tool_execution_{name}"
            )
            raise TimeoutError(error.message)
        except ValueError:
            # Re-raise validation errors as-is
            raise
        except Exception as e:
            logger.error(f"Error calling tool '{name}': {e}")
            error = ErrorFactory.tool_execution_error(
                code=ErrorCode.UNEXPECTED_ERROR,
                message=f"Unexpected error during tool execution: {str(e)}",
                tool_name=name
            )
            raise Exception(error.message)
    
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
        
        # Element Repository management tools
        self.register_tool(
            "create_element",
            self._create_element_tool,
            ToolMetadata(
                name="create_element",
                description="Create new element with initial locator version",
                category=ToolCategory.ELEMENT_REPOSITORY,
                timeout_ms=5000,
                tags=["element", "creation", "repository"]
            )
        )
        
        self.register_tool(
            "add_element_version",
            self._add_element_version_tool,
            ToolMetadata(
                name="add_element_version",
                description="Add new version to existing element",
                category=ToolCategory.ELEMENT_REPOSITORY,
                timeout_ms=5000,
                tags=["element", "versioning", "repository"]
            )
        )
        
        self.register_tool(
            "approve_element_version",
            self._approve_element_version_tool,
            ToolMetadata(
                name="approve_element_version",
                description="Approve pending element version",
                category=ToolCategory.ELEMENT_REPOSITORY,
                timeout_ms=5000,
                tags=["element", "approval", "workflow"]
            )
        )
        
        self.register_tool(
            "search_elements",
            self._search_elements_tool,
            ToolMetadata(
                name="search_elements",
                description="Search elements by name or selector",
                category=ToolCategory.ELEMENT_REPOSITORY,
                timeout_ms=5000,
                tags=["element", "search", "repository"]
            )
        )
        
        self.register_tool(
            "get_repository_stats",
            self._get_repository_stats_tool,
            ToolMetadata(
                name="get_repository_stats",
                description="Get element repository statistics and health",
                category=ToolCategory.ELEMENT_REPOSITORY,
                timeout_ms=2000,
                tags=["repository", "stats", "monitoring"]
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
    async def _run_action_tool(self, action_type: str, element_name: str, parameters: dict = None, context: dict = None) -> dict:
        """Run action tool implementation"""
        # Simulate execution time
        await asyncio.sleep(0.5)
        
        return {
            "status": "success",
            "execution_time_ms": 1250,
            "selector_used": f"#{element_name}",
            "healing_applied": {
                "original_selector": f"#{element_name}",
                "new_selector": f"#{element_name}",
                "confidence": 1.0,
                "healing_strategy": "attribute_match",
                "review_required": False
            },
            "screenshots": {},
            "element_info": {
                "tag_name": "button",
                "attributes": {"id": element_name, "class": "btn btn-primary"},
                "text_content": "Login",
                "position": {"x": 100, "y": 200, "width": 80, "height": 32}
            }
        }
    
    async def _get_element_tool(self, element_name: str, context: dict = None, options: dict = None) -> dict:
        """Get element tool implementation using Element Repository"""
        from element_repository import get_repository
        
        # Get repository instance
        repo = await get_repository()
        
        # Check options
        include_alternatives = options.get("include_alternatives", False) if options else False
        validate_presence = options.get("validate_presence", False) if options else False
        include_stats = options.get("include_stats", False) if options else False
        
        # Get element from repository
        element_record = await repo.get_element(element_name)
        
        if not element_record:
            # Element not found - return mock for compatibility (or could raise error)
            return {
                "element_name": element_name,
                "found": False,
                "error": f"Element '{element_name}' not found in repository",
                "selector": None,
                "confidence": 0.0,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        # Get active version
        active_version = element_record.get_active_version()
        if not active_version:
            return {
                "element_name": element_name,
                "found": False,
                "error": f"Element '{element_name}' has no active version",
                "selector": None,
                "confidence": 0.0,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        # Build response
        result = {
            "element_name": element_name,
            "found": True,
            "selector": active_version.css_selector,
            "selector_type": "css",
            "confidence": active_version.confidence_score,
            "version": active_version.version,
            "status": active_version.status.value,
            "last_updated": element_record.updated_at or element_record.created_at,
            "last_used": active_version.last_used,
            "created_at": element_record.created_at,
            "created_by": active_version.created_by,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Add xpath if available
        if active_version.xpath_selector:
            result["xpath_selector"] = active_version.xpath_selector
        
        # Add alternatives if requested
        if include_alternatives and active_version.alternatives:
            result["alternatives"] = [
                {
                    "selector": alt,
                    "selector_type": "css",
                    "confidence": active_version.confidence_score * 0.9,  # Slightly lower confidence
                    "description": f"Alternative selector for {element_name}"
                }
                for alt in active_version.alternatives
            ]
        
        # Add usage statistics if requested
        if include_stats:
            result["stats"] = {
                "usage_count": active_version.usage_count,
                "success_rate": active_version.success_rate,
                "total_versions": len(element_record.versions),
                "approval_status": active_version.approval_status.value
            }
        
        # Add AI reasoning if available
        if active_version.ai_reasoning:
            result["ai_reasoning"] = active_version.ai_reasoning
        
        # Add validation results if present validation was requested
        if validate_presence and active_version.validation_results:
            result["validation"] = active_version.validation_results
        
        # Add page context if available
        if element_record.page_context:
            result["page_context"] = element_record.page_context
        
        # Add tags if available
        if element_record.tags:
            result["tags"] = element_record.tags
        
        return result
    
    async def _bulk_generate_locators_tool(self, element_names: List[str], page_context: dict, generation_options: dict = None) -> dict:
        """Bulk generate locators tool implementation"""
        # Simulate AI processing time
        await asyncio.sleep(2.0)
        
        # Generate mock locators for the provided element names
        locators = []
        
        for i, name in enumerate(element_names):
            locators.append({
                "element_name": name,
                "selector": f"#{name}",
                "selector_type": "css",
                "confidence": 0.87 + (i * 0.02),  # Vary confidence slightly
                "ai_reasoning": f"Identified based on ID attribute matching {name}",
                "alternatives": [
                    {
                        "selector": f"button[data-testid='{name}']",
                        "selector_type": "css",
                        "confidence": 0.82,
                        "reasoning": "Alternative using data-testid attribute"
                    }
                ],
                "element_attributes": {
                    "id": name,
                    "class": "btn btn-primary"
                },
                "semantic_info": {
                    "element_type": "button" if "button" in name else "input",
                    "purpose": "Primary action element",
                    "form_association": "login_form" if "login" in name else "general_form",
                    "accessibility_labels": [name.replace('_', ' ').title()]
                }
            })
        
        return {
            "locators": locators,
            "batch_confidence": 0.89,
            "review_required": False,
            "estimated_review_time_minutes": 5,
            "generation_metadata": {
                "model_version": "v1.0.0",
                "processing_time_ms": 2000.0,
                "html_size_bytes": 150000,
                "elements_analyzed": 45,
                "success_count": len(locators),
                "failure_count": 0
            },
            "quality_metrics": {
                "uniqueness_score": 0.95,
                "stability_score": 0.88,
                "maintainability_score": 0.92
            }
        }
    
    async def _analytics_log_tool(self, event_type: str, metrics: dict, context: dict, tags: list = None, custom_data: dict = None) -> dict:
        """Analytics log tool implementation"""
        # Simulate logging time
        await asyncio.sleep(0.05)
        
        event_id = f"evt_{int(datetime.now().timestamp() * 1000)}"
        
        return {
            "logged": True,
            "event_id": event_id,
            "timestamp": datetime.now().isoformat(),
            "partition_key": f"{context.get('environment', 'dev')}_{context.get('application', 'test')}",
            "retention_policy": {
                "retention_days": 90,
                "archival_policy": "compress_and_archive",
                "anonymization_after_days": 365
            },
            "aggregation_status": {
                "real_time_updated": True,
                "hourly_batch_queued": True,
                "daily_batch_queued": True
            },
            "compliance": {
                "gdpr_compliant": True,
                "ccpa_compliant": True,
                "pii_detected": False,
                "anonymization_applied": False
            }
        }
    
    # Element Repository Management Tools
    
    async def _create_element_tool(self, element_name: str, css_selector: str, 
                                 xpath_selector: str = None, alternatives: List[str] = None,
                                 created_by: str = "system", ai_reasoning: str = None) -> dict:
        """Create new element with initial locator version"""
        from element_repository import get_repository
        
        try:
            repo = await get_repository()
            
            # Create new element
            record = await repo.create_element(
                element_name=element_name,
                css_selector=css_selector,
                xpath_selector=xpath_selector,
                alternatives=alternatives or [],
                created_by=created_by,
                ai_reasoning=ai_reasoning
            )
            
            active_version = record.get_active_version() or record.get_latest_version()
            
            return {
                "success": True,
                "element_name": element_name,
                "version": active_version.version if active_version else 1,
                "status": active_version.status.value if active_version else "draft",
                "approval_status": active_version.approval_status.value if active_version else "pending",
                "created_at": record.created_at,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "element_name": element_name,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def _add_element_version_tool(self, element_name: str, css_selector: str,
                                      xpath_selector: str = None, alternatives: List[str] = None,
                                      created_by: str = "system", ai_reasoning: str = None,
                                      confidence_score: float = 0.0) -> dict:
        """Add new version to existing element"""
        from element_repository import get_repository
        
        try:
            repo = await get_repository()
            
            # Add new version
            version = await repo.add_version(
                element_name=element_name,
                css_selector=css_selector,
                xpath_selector=xpath_selector,
                alternatives=alternatives or [],
                created_by=created_by,
                ai_reasoning=ai_reasoning,
                confidence_score=confidence_score
            )
            
            return {
                "success": True,
                "element_name": element_name,
                "version": version.version,
                "status": version.status.value,
                "approval_status": version.approval_status.value,
                "confidence_score": version.confidence_score,
                "created_at": version.created_at,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "element_name": element_name,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def _approve_element_version_tool(self, element_name: str, version: int, 
                                          approver: str = "system") -> dict:
        """Approve pending element version"""
        from element_repository import get_repository
        
        try:
            repo = await get_repository()
            
            # Approve version
            success = await repo.approve_version(
                element_name=element_name,
                version=version,
                approver=approver
            )
            
            if success:
                return {
                    "success": True,
                    "element_name": element_name,
                    "version": version,
                    "approved_by": approver,
                    "approved_at": datetime.now(timezone.utc).isoformat(),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            else:
                return {
                    "success": False,
                    "error": "Approval failed - version not found or not pending",
                    "element_name": element_name,
                    "version": version,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "element_name": element_name,
                "version": version,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def _search_elements_tool(self, query: str, limit: int = 50) -> dict:
        """Search elements by name or selector"""
        from element_repository import get_repository
        
        try:
            repo = await get_repository()
            
            # Search elements
            results = await repo.search_elements(query=query, limit=limit)
            
            # Format results
            elements = []
            for record in results:
                active_version = record.get_active_version()
                elements.append({
                    "element_name": record.element_name,
                    "selector": active_version.css_selector if active_version else None,
                    "version": active_version.version if active_version else 0,
                    "status": active_version.status.value if active_version else "no_active",
                    "confidence": active_version.confidence_score if active_version else 0.0,
                    "usage_count": active_version.usage_count if active_version else 0,
                    "success_rate": active_version.success_rate if active_version else 0.0,
                    "last_used": active_version.last_used if active_version else None,
                    "tags": record.tags,
                    "created_at": record.created_at
                })
            
            return {
                "success": True,
                "query": query,
                "total_results": len(elements),
                "limit": limit,
                "elements": elements,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "query": query,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
    
    async def _get_repository_stats_tool(self) -> dict:
        """Get element repository statistics and health"""
        from element_repository import get_repository
        
        try:
            repo = await get_repository()
            
            # Get comprehensive stats
            stats = await repo.get_stats()
            pending_approvals = await repo.get_pending_approvals()
            
            # Add additional computed metrics
            stats["pending_approvals_count"] = len(pending_approvals)
            stats["pending_approvals"] = [
                {
                    "element_name": name,
                    "version": version.version,
                    "created_at": version.created_at,
                    "created_by": version.created_by,
                    "confidence_score": version.confidence_score
                }
                for name, version in pending_approvals[:10]  # Limit to first 10
            ]
            
            return {
                "success": True,
                "stats": stats,
                "health": {
                    "status": "healthy" if stats["total_elements"] > 0 else "empty",
                    "cache_hit_ratio": stats["cache_stats"]["hit_ratio"],
                    "pending_approval_ratio": stats["pending_approvals_count"] / max(stats["total_versions"], 1)
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }