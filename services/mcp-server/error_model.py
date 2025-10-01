"""
Error Model and Error Codes
Comprehensive error handling with specific error codes for different failure scenarios
"""

from enum import Enum
from typing import Dict, Any, Optional
from dataclasses import dataclass
import json


class ErrorCategory(Enum):
    """Error categories for classification"""
    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    TIMEOUT = "timeout"
    EXTERNAL_SERVICE = "external_service"
    INTERNAL_ERROR = "internal_error"
    RATE_LIMIT = "rate_limit"
    CONFIGURATION = "configuration"


class ErrorCode(Enum):
    """Specific error codes with categories"""
    
    # Validation Errors (400-499 range)
    INVALID_REQUEST_FORMAT = "E001"
    MISSING_REQUIRED_FIELD = "E002"
    INVALID_FIELD_VALUE = "E003"
    INVALID_FIELD_TYPE = "E004"
    FIELD_LENGTH_EXCEEDED = "E005"
    INVALID_ENUM_VALUE = "E006"
    INVALID_REGEX_PATTERN = "E007"
    SCHEMA_VALIDATION_FAILED = "E008"
    INVALID_JSON_FORMAT = "E009"
    INVALID_URL_FORMAT = "E010"
    INVALID_UUID_FORMAT = "E011"
    INVALID_DATE_FORMAT = "E012"
    PARAMETER_OUT_OF_RANGE = "E013"
    CONFLICTING_PARAMETERS = "E014"
    INVALID_ARRAY_SIZE = "E015"
    
    # Authentication/Authorization Errors (401-403 range)
    MISSING_AUTH_TOKEN = "E101"
    INVALID_AUTH_TOKEN = "E102"
    EXPIRED_AUTH_TOKEN = "E103"
    INSUFFICIENT_PERMISSIONS = "E104"
    ACCOUNT_SUSPENDED = "E105"
    INVALID_API_KEY = "E106"
    
    # Not Found Errors (404 range)
    TOOL_NOT_FOUND = "E201"
    ELEMENT_NOT_FOUND = "E202"
    RESOURCE_NOT_FOUND = "E203"
    ENDPOINT_NOT_FOUND = "E204"
    PAGE_NOT_FOUND = "E205"
    SESSION_NOT_FOUND = "E206"
    
    # Conflict Errors (409 range)
    ELEMENT_ALREADY_EXISTS = "E301"
    RESOURCE_CONFLICT = "E302"
    CONCURRENT_MODIFICATION = "E303"
    DUPLICATE_REQUEST = "E304"
    
    # Timeout Errors (408 range)
    TOOL_EXECUTION_TIMEOUT = "E401"
    ELEMENT_WAIT_TIMEOUT = "E402"
    PAGE_LOAD_TIMEOUT = "E403"
    NETWORK_TIMEOUT = "E404"
    DATABASE_TIMEOUT = "E405"
    
    # External Service Errors (502-503 range)
    ELEMENT_REPOSITORY_UNAVAILABLE = "E501"
    POLICY_ENGINE_UNAVAILABLE = "E502"
    EXECUTION_SERVICE_UNAVAILABLE = "E503"
    DATABASE_UNAVAILABLE = "E504"
    CACHE_UNAVAILABLE = "E505"
    AI_SERVICE_UNAVAILABLE = "E506"
    BROWSER_SERVICE_UNAVAILABLE = "E507"
    
    # Rate Limiting Errors (429 range)
    RATE_LIMIT_EXCEEDED = "E601"
    QUOTA_EXCEEDED = "E602"
    CONCURRENT_LIMIT_EXCEEDED = "E603"
    
    # Configuration Errors (500 range)
    INVALID_CONFIGURATION = "E701"
    MISSING_CONFIGURATION = "E702"
    CONFIGURATION_CONFLICT = "E703"
    
    # Internal Errors (500 range)
    UNEXPECTED_ERROR = "E801"
    DATABASE_ERROR = "E802"
    FILE_SYSTEM_ERROR = "E803"
    MEMORY_ERROR = "E804"
    NETWORK_ERROR = "E805"
    SERIALIZATION_ERROR = "E806"
    DESERIALIZATION_ERROR = "E807"
    
    # Tool-Specific Errors (900+ range)
    ELEMENT_NOT_VISIBLE = "E901"
    ELEMENT_NOT_CLICKABLE = "E902"
    ELEMENT_NOT_INTERACTABLE = "E903"
    MULTIPLE_ELEMENTS_FOUND = "E904"
    SELECTOR_INVALID = "E905"
    HEALING_FAILED = "E906"
    SCREENSHOT_FAILED = "E907"
    BROWSER_CRASHED = "E908"
    PAGE_NAVIGATION_FAILED = "E909"
    JAVASCRIPT_ERROR = "E910"
    LOCATOR_GENERATION_FAILED = "E911"
    AI_ANALYSIS_FAILED = "E912"
    CONFIDENCE_TOO_LOW = "E913"
    ELEMENT_CHANGED = "E914"
    FORM_SUBMISSION_FAILED = "E915"


@dataclass
class MCPError:
    """MCP Error with structured information"""
    code: ErrorCode
    message: str
    category: ErrorCategory
    details: Optional[Dict[str, Any]] = None
    context: Optional[Dict[str, Any]] = None
    retry_after: Optional[int] = None  # seconds
    help_url: Optional[str] = None
    timestamp: Optional[str] = None  # UTC ISO format
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary"""
        from datetime import datetime
        
        result = {
            "code": self.code.value,
            "message": self.message,
            "category": self.category.value,
            "timestamp": self.timestamp or datetime.now().isoformat() + "Z"
        }
        
        if self.details:
            result["details"] = self.details
        if self.context:
            result["context"] = self.context
        if self.retry_after:
            result["retry_after"] = self.retry_after
        if self.help_url:
            result["help_url"] = self.help_url
            
        return result
    
    def to_json(self) -> str:
        """Convert error to JSON string"""
        return json.dumps(self.to_dict(), indent=2)


class ErrorFactory:
    """Factory for creating standardized errors"""
    
    @staticmethod
    def validation_error(
        code: ErrorCode,
        message: str,
        field_name: str = None,
        field_value: Any = None,
        expected_format: str = None
    ) -> MCPError:
        """Create validation error"""
        details = {}
        if field_name:
            details["field_name"] = field_name
        if field_value is not None:
            details["field_value"] = str(field_value)
        if expected_format:
            details["expected_format"] = expected_format
            
        return MCPError(
            code=code,
            message=message,
            category=ErrorCategory.VALIDATION,
            details=details if details else None
        )
    
    @staticmethod
    def not_found_error(
        code: ErrorCode,
        message: str,
        resource_type: str = None,
        resource_id: str = None
    ) -> MCPError:
        """Create not found error"""
        details = {}
        if resource_type:
            details["resource_type"] = resource_type
        if resource_id:
            details["resource_id"] = resource_id
            
        return MCPError(
            code=code,
            message=message,
            category=ErrorCategory.NOT_FOUND,
            details=details if details else None
        )
    
    @staticmethod
    def timeout_error(
        code: ErrorCode,
        message: str,
        timeout_ms: int = None,
        operation: str = None
    ) -> MCPError:
        """Create timeout error"""
        details = {}
        if timeout_ms:
            details["timeout_ms"] = timeout_ms
        if operation:
            details["operation"] = operation
            
        return MCPError(
            code=code,
            message=message,
            category=ErrorCategory.TIMEOUT,
            details=details if details else None,
            retry_after=5  # Default retry after 5 seconds
        )
    
    @staticmethod
    def external_service_error(
        code: ErrorCode,
        message: str,
        service_name: str = None,
        service_url: str = None,
        status_code: int = None
    ) -> MCPError:
        """Create external service error"""
        details = {}
        if service_name:
            details["service_name"] = service_name
        if service_url:
            details["service_url"] = service_url
        if status_code:
            details["status_code"] = status_code
            
        return MCPError(
            code=code,
            message=message,
            category=ErrorCategory.EXTERNAL_SERVICE,
            details=details if details else None,
            retry_after=10  # Default retry after 10 seconds
        )
    
    @staticmethod
    def tool_execution_error(
        code: ErrorCode,
        message: str,
        tool_name: str = None,
        element_name: str = None,
        selector: str = None,
        action_type: str = None
    ) -> MCPError:
        """Create tool execution error"""
        details = {}
        if tool_name:
            details["tool_name"] = tool_name
        if element_name:
            details["element_name"] = element_name
        if selector:
            details["selector"] = selector
        if action_type:
            details["action_type"] = action_type
            
        return MCPError(
            code=code,
            message=message,
            category=ErrorCategory.INTERNAL_ERROR,
            details=details if details else None
        )
    
    @staticmethod
    def rate_limit_error(
        code: ErrorCode,
        message: str,
        limit: int = None,
        window_seconds: int = None,
        retry_after: int = None
    ) -> MCPError:
        """Create rate limit error"""
        details = {}
        if limit:
            details["limit"] = limit
        if window_seconds:
            details["window_seconds"] = window_seconds
            
        return MCPError(
            code=code,
            message=message,
            category=ErrorCategory.RATE_LIMIT,
            details=details if details else None,
            retry_after=retry_after or 60
        )


# HTTP Status Code Mapping
ERROR_HTTP_STATUS_MAP = {
    # Validation errors -> 400 Bad Request
    ErrorCode.INVALID_REQUEST_FORMAT: 400,
    ErrorCode.MISSING_REQUIRED_FIELD: 400,
    ErrorCode.INVALID_FIELD_VALUE: 400,
    ErrorCode.INVALID_FIELD_TYPE: 400,
    ErrorCode.FIELD_LENGTH_EXCEEDED: 400,
    ErrorCode.INVALID_ENUM_VALUE: 400,
    ErrorCode.INVALID_REGEX_PATTERN: 400,
    ErrorCode.SCHEMA_VALIDATION_FAILED: 400,
    ErrorCode.INVALID_JSON_FORMAT: 400,
    ErrorCode.INVALID_URL_FORMAT: 400,
    ErrorCode.INVALID_UUID_FORMAT: 400,
    ErrorCode.INVALID_DATE_FORMAT: 400,
    ErrorCode.PARAMETER_OUT_OF_RANGE: 400,
    ErrorCode.CONFLICTING_PARAMETERS: 400,
    ErrorCode.INVALID_ARRAY_SIZE: 400,
    
    # Authentication errors -> 401 Unauthorized
    ErrorCode.MISSING_AUTH_TOKEN: 401,
    ErrorCode.INVALID_AUTH_TOKEN: 401,
    ErrorCode.EXPIRED_AUTH_TOKEN: 401,
    ErrorCode.INVALID_API_KEY: 401,
    
    # Authorization errors -> 403 Forbidden
    ErrorCode.INSUFFICIENT_PERMISSIONS: 403,
    ErrorCode.ACCOUNT_SUSPENDED: 403,
    
    # Not found errors -> 404 Not Found
    ErrorCode.TOOL_NOT_FOUND: 404,
    ErrorCode.ELEMENT_NOT_FOUND: 404,
    ErrorCode.RESOURCE_NOT_FOUND: 404,
    ErrorCode.ENDPOINT_NOT_FOUND: 404,
    ErrorCode.PAGE_NOT_FOUND: 404,
    ErrorCode.SESSION_NOT_FOUND: 404,
    
    # Timeout errors -> 408 Request Timeout
    ErrorCode.TOOL_EXECUTION_TIMEOUT: 408,
    ErrorCode.ELEMENT_WAIT_TIMEOUT: 408,
    ErrorCode.PAGE_LOAD_TIMEOUT: 408,
    ErrorCode.NETWORK_TIMEOUT: 408,
    ErrorCode.DATABASE_TIMEOUT: 408,
    
    # Conflict errors -> 409 Conflict
    ErrorCode.ELEMENT_ALREADY_EXISTS: 409,
    ErrorCode.RESOURCE_CONFLICT: 409,
    ErrorCode.CONCURRENT_MODIFICATION: 409,
    ErrorCode.DUPLICATE_REQUEST: 409,
    
    # Rate limit errors -> 429 Too Many Requests
    ErrorCode.RATE_LIMIT_EXCEEDED: 429,
    ErrorCode.QUOTA_EXCEEDED: 429,
    ErrorCode.CONCURRENT_LIMIT_EXCEEDED: 429,
    
    # External service errors -> 502 Bad Gateway / 503 Service Unavailable
    ErrorCode.ELEMENT_REPOSITORY_UNAVAILABLE: 502,
    ErrorCode.POLICY_ENGINE_UNAVAILABLE: 502,
    ErrorCode.EXECUTION_SERVICE_UNAVAILABLE: 502,
    ErrorCode.DATABASE_UNAVAILABLE: 503,
    ErrorCode.CACHE_UNAVAILABLE: 503,
    ErrorCode.AI_SERVICE_UNAVAILABLE: 502,
    ErrorCode.BROWSER_SERVICE_UNAVAILABLE: 502,
    
    # Configuration and internal errors -> 500 Internal Server Error
    ErrorCode.INVALID_CONFIGURATION: 500,
    ErrorCode.MISSING_CONFIGURATION: 500,
    ErrorCode.CONFIGURATION_CONFLICT: 500,
    ErrorCode.UNEXPECTED_ERROR: 500,
    ErrorCode.DATABASE_ERROR: 500,
    ErrorCode.FILE_SYSTEM_ERROR: 500,
    ErrorCode.MEMORY_ERROR: 500,
    ErrorCode.NETWORK_ERROR: 500,
    ErrorCode.SERIALIZATION_ERROR: 500,
    ErrorCode.DESERIALIZATION_ERROR: 500,
    
    # Tool-specific errors -> 422 Unprocessable Entity or 500 Internal Server Error
    ErrorCode.ELEMENT_NOT_VISIBLE: 422,
    ErrorCode.ELEMENT_NOT_CLICKABLE: 422,
    ErrorCode.ELEMENT_NOT_INTERACTABLE: 422,
    ErrorCode.MULTIPLE_ELEMENTS_FOUND: 422,
    ErrorCode.SELECTOR_INVALID: 422,
    ErrorCode.HEALING_FAILED: 500,
    ErrorCode.SCREENSHOT_FAILED: 500,
    ErrorCode.BROWSER_CRASHED: 500,
    ErrorCode.PAGE_NAVIGATION_FAILED: 422,
    ErrorCode.JAVASCRIPT_ERROR: 422,
    ErrorCode.LOCATOR_GENERATION_FAILED: 500,
    ErrorCode.AI_ANALYSIS_FAILED: 500,
    ErrorCode.CONFIDENCE_TOO_LOW: 422,
    ErrorCode.ELEMENT_CHANGED: 422,
    ErrorCode.FORM_SUBMISSION_FAILED: 422,
}


def get_http_status_code(error_code: ErrorCode) -> int:
    """Get HTTP status code for error code"""
    return ERROR_HTTP_STATUS_MAP.get(error_code, 500)