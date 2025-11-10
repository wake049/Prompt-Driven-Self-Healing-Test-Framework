"""
Pydantic models for MCP envelopes and error handling

Defines the core MCP protocol data structures and error codes.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field

class MCPErrorCode(Enum):
    """Standard MCP error codes"""
    # Standard JSON-RPC 2.0 errors
    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603
    
    # MCP-specific errors
    TOOL_NOT_FOUND = -32000
    RESOURCE_NOT_FOUND = -32001
    UNAUTHORIZED = -32002
    FORBIDDEN = -32003
    RATE_LIMITED = -32004

class MCPError(BaseModel):
    """MCP error object"""
    code: int
    message: str
    data: Optional[Dict[str, Any]] = None

class MCPRequest(BaseModel):
    """MCP request envelope"""
    jsonrpc: str = Field(default="2.0", description="JSON-RPC version")
    id: Union[str, int, None] = Field(description="Request ID")
    method: str = Field(description="Method name")
    params: Optional[Dict[str, Any]] = Field(default=None, description="Method parameters")

class MCPResponse(BaseModel):
    """MCP response envelope"""
    jsonrpc: str = Field(default="2.0", description="JSON-RPC version")
    id: Union[str, int, None] = Field(description="Request ID")
    result: Optional[Any] = Field(default=None, description="Method result")
    error: Optional[MCPError] = Field(default=None, description="Error object")

# Tool schemas
class ToolSchema(BaseModel):
    """JSON Schema for tool parameters"""
    type: str = "object"
    properties: Dict[str, Any] = Field(default_factory=dict)
    required: List[str] = Field(default_factory=list)
    additionalProperties: bool = False

class Tool(BaseModel):
    """MCP tool definition"""
    name: str = Field(description="Tool name")
    description: str = Field(description="Tool description")
    inputSchema: ToolSchema = Field(description="Input parameter schema")

class ToolResult(BaseModel):
    """Tool execution result"""
    ok: bool = Field(description="Success status")
    data: Optional[Any] = Field(default=None, description="Result data")
    error: Optional[str] = Field(default=None, description="Error message")
    logs: List[str] = Field(default_factory=list, description="Execution logs")

# Resource schemas
class ResourceUri(BaseModel):
    """Resource URI components"""
    scheme: str = Field(description="URI scheme")
    path: str = Field(description="Resource path")
    params: Dict[str, str] = Field(default_factory=dict, description="Query parameters")

class Resource(BaseModel):
    """MCP resource definition"""
    uri: str = Field(description="Resource URI")
    name: str = Field(description="Resource name")
    description: str = Field(description="Resource description")
    mimeType: str = Field(description="Content MIME type")

# Tool parameter schemas for validation
TOOL_SCHEMAS = {
    "run_action": {
        "type": "object",
        "properties": {
            "action_type": {
                "type": "string",
                "enum": ["click_css", "type_css", "assert_element_visible", "select_option"],
                "description": "Type of action to execute"
            },
            "element_name": {
                "type": "string",
                "description": "Name of the element to interact with"
            },
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text to type (for type actions)"},
                    "selector_override": {"type": "string", "description": "CSS selector override"},
                    "timeout": {"type": "integer", "default": 30000, "description": "Timeout in milliseconds"},
                    "heal_mode": {"type": "string", "enum": ["auto", "manual", "disabled"], "default": "auto"}
                }
            },
            "context": {
                "type": "object",
                "properties": {
                    "run_id": {"type": "string", "description": "Unique run identifier"},
                    "step_index": {"type": "integer", "description": "Step index in test execution"},
                    "page_url": {"type": "string", "description": "Current page URL"},
                    "session_data": {"type": "object", "description": "Session context data"}
                },
                "required": ["run_id", "step_index"]
            }
        },
        "required": ["action_type", "element_name", "context"]
    },
    
    "verify.section": {
        "type": "object",
        "properties": {
            "preset_name": {"type": "string", "description": "Verification preset name"},
            "preset": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "checks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "type": {"type": "string", "enum": ["exists", "visible", "text", "attribute", "count"]},
                                "elementId": {"type": "string"},
                                "selector": {"type": "string"},
                                "expected": {},
                                "description": {"type": "string"}
                            },
                            "required": ["type", "description"]
                        }
                    }
                },
                "required": ["name", "checks"]
            }
        }
    },
    
    "context.put": {
        "type": "object",
        "properties": {
            "key": {"type": "string", "description": "Context key"},
            "value": {"description": "Context value"},
            "type": {"type": "string", "description": "Value type hint"}
        },
        "required": ["key", "value"]
    },
    
    "context.get": {
        "type": "object",
        "properties": {
            "key": {"type": "string", "description": "Context key to retrieve"}
        },
        "required": ["key"]
    },
    
    "context.expectEqual": {
        "type": "object",
        "properties": {
            "key": {"type": "string", "description": "Context key"},
            "expected": {"description": "Expected value"},
            "message": {"type": "string", "description": "Custom assertion message"}
        },
        "required": ["key", "expected"]
    },
    
    "elements.add": {
        "type": "object",
        "properties": {
            "elementId": {"type": "string", "description": "Element identifier"},
            "elementData": {
                "type": "object",
                "properties": {
                    "tag": {"type": "string"},
                    "text": {"type": "string"},
                    "attributes": {"type": "object"},
                    "selectors": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["tag", "selectors"]
            }
        },
        "required": ["elementId", "elementData"]
    },
    
    "elements.get": {
        "type": "object",
        "properties": {
            "elementId": {"type": "string", "description": "Element identifier"}
        },
        "required": ["elementId"]
    },
    
    "fetch_test_data": {
        "type": "object",
        "properties": {
            "data_type": {"type": "string", "enum": ["sessions", "elements", "executions", "execution_stats", "healing_data", "execution_trends", "failure_analysis", "performance_metrics"]},
            "filters": {"type": "object", "description": "Filter criteria"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 1000, "default": 100}
        },
        "required": ["data_type"]
    },
    
    "sql_get_all_elements": {
        "type": "object",
        "properties": {
            "limit": {"type": "integer", "minimum": 1, "maximum": 1000, "default": 100},
            "filters": {"type": "object", "description": "Filter criteria"}
        }
    },
    
    "sql_update_element": {
        "type": "object",
        "properties": {
            "element_id": {"type": "string", "description": "Element ID to update"},
            "updates": {
                "type": "object",
                "description": "Fields to update",
                "properties": {
                    "css_selector": {"type": "string"},
                    "xpath": {"type": "string"},
                    "tag": {"type": "string"},
                    "text_content": {"type": "string"},
                    "selectors": {"type": "array", "items": {"type": "string"}},
                    "attributes": {"type": "object"}
                }
            }
        },
        "required": ["element_id", "updates"]
    },
    
    "bulk_generate_locators": {
        "type": "object",
        "properties": {
            "elements": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "current_selector": {"type": "string"},
                        "page_html": {"type": "string"},
                        "target_description": {"type": "string"}
                    },
                    "required": ["id", "current_selector", "target_description"]
                }
            },
            "strategy": {"type": "string", "enum": ["ai", "heuristic", "hybrid"], "default": "hybrid"}
        },
        "required": ["elements"]
    },

    "analytics_healing_data": {
        "type": "object",
        "properties": {
            "timeRange": {"type": "string", "enum": ["24h", "7d", "30d"], "default": "24h", "description": "Time range for analytics"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 1000, "default": 100}
        }
    },

    "analytics_trends": {
        "type": "object", 
        "properties": {
            "timeRange": {"type": "string", "enum": ["24h", "7d", "30d"], "default": "24h", "description": "Time range for trends"},
            "metricType": {"type": "string", "enum": ["execution_count", "success_rate", "healing_rate"], "description": "Type of trend metric"}
        }
    },

    "analytics_failure_patterns": {
        "type": "object",
        "properties": {
            "timeRange": {"type": "string", "enum": ["24h", "7d", "30d"], "default": "24h", "description": "Time range for failure analysis"},
            "groupBy": {"type": "string", "enum": ["action_type", "element_type", "page"], "description": "How to group failure patterns"}
        }
    },

    "analytics_ai_insights": {
        "type": "object",
        "properties": {
            "timeRange": {"type": "string", "enum": ["24h", "7d", "30d"], "default": "24h", "description": "Time range for AI insights"},
            "insightType": {"type": "string", "enum": ["healing_recommendations", "performance_optimization", "failure_prediction"], "description": "Type of AI insights"}
        }
    },

    "analyze_page_elements": {
        "type": "object",
        "properties": {
            "pageData": {"type": "object", "description": "DOM extraction payload from content script / popup"},
            "extractionMode": {"type": "string", "enum": ["full_analysis", "summary_only"], "default": "full_analysis"},
            "includeHealing": {"type": "boolean", "default": True}
        },
        "required": ["pageData"]
    },

    "get_review_queue": {
        "type": "object",
        "properties": {
            "status": {"type": "string", "enum": ["open", "approved", "rejected"], "default": "open", "description": "Filter by status"},
            "page": {"type": "string", "description": "Filter by page"},
            "search": {"type": "string", "description": "Search in element names and rationale"},
            "sort_by": {"type": "string", "enum": ["created_at", "priority", "page_name"], "default": "created_at", "description": "Sort field"},
            "sort_order": {"type": "string", "enum": ["asc", "desc"], "default": "desc", "description": "Sort order"},
            "priority": {"type": "string", "enum": ["high", "medium", "low"], "description": "Filter by priority"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 1000, "default": 50},
            "offset": {"type": "integer", "minimum": 0, "default": 0}
        }
    },

    "get_pending_reviews": {
        "type": "object",
        "properties": {}
    },

    "update_review_status": {
        "type": "object",
        "properties": {
            "review_id": {"type": "string", "description": "Review item ID"},
            "status": {"type": "string", "enum": ["approved", "rejected"], "description": "New status for the review"}
        },
        "required": ["review_id", "status"]
    },

    "add_to_review_queue": {
        "type": "object",
        "properties": {
            "element_id": {"type": "string", "description": "Element ID to add to review queue"},
            "element_name": {"type": "string", "description": "Display name for the element"},
            "note": {"type": "string", "description": "Optional note about why this element needs review"},
            "page": {"type": "string", "description": "Page where the element is located"},
            "health_status": {"type": "string", "description": "Current health status of the element"}
        },
        "required": ["element_id", "element_name"]
    }
}