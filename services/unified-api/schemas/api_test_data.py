"""
API Test Data Schemas
Pydantic models for API testing and test data creation
Allows testers to create data via APIs before running UI tests
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, validator


class AuthType(str, Enum):
    """Authentication types for API endpoints"""
    NONE = "none"
    API_KEY = "api_key"
    BEARER = "bearer"
    BASIC = "basic"
    OAUTH2 = "oauth2"


class HttpMethod(str, Enum):
    """HTTP methods for API requests"""
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    PATCH = "PATCH"
    DELETE = "DELETE"


# ============ API Endpoint Models ============

class ApiEndpointBase(BaseModel):
    """Base model for API endpoint configuration"""
    name: str = Field(..., min_length=1, max_length=255, description="Unique name for this endpoint")
    description: Optional[str] = Field(None, description="Description of the API endpoint")
    base_url: str = Field(..., description="Base URL for the API (e.g., https://api.example.com)")
    auth_type: AuthType = Field(default=AuthType.NONE, description="Authentication type")
    auth_config: Dict[str, Any] = Field(
        default_factory=dict, 
        description="Authentication configuration (api_key, credentials, etc.)"
    )
    default_headers: Dict[str, str] = Field(
        default_factory=dict,
        description="Default headers to include with all requests"
    )
    timeout_seconds: int = Field(default=30, ge=1, le=300, description="Request timeout in seconds")
    retry_count: int = Field(default=3, ge=0, le=10, description="Number of retries on failure")
    is_active: bool = Field(default=True, description="Whether the endpoint is active")


class ApiEndpointCreate(ApiEndpointBase):
    """Model for creating a new API endpoint"""
    project_id: Optional[str] = Field(None, description="Project ID (auto-detected if not provided)")


class ApiEndpointUpdate(BaseModel):
    """Model for updating an API endpoint"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    base_url: Optional[str] = None
    auth_type: Optional[AuthType] = None
    auth_config: Optional[Dict[str, Any]] = None
    default_headers: Optional[Dict[str, str]] = None
    timeout_seconds: Optional[int] = Field(None, ge=1, le=300)
    retry_count: Optional[int] = Field(None, ge=0, le=10)
    is_active: Optional[bool] = None


class ApiEndpointResponse(ApiEndpointBase):
    """Response model for API endpoint"""
    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Data Template Models ============

class ResponseExtractor(BaseModel):
    """Configuration for extracting values from API response"""
    name: str = Field(..., description="Variable name to store the extracted value")
    json_path: str = Field(..., description="JSON path expression (e.g., $.data.booking_id)")
    default_value: Optional[Any] = Field(None, description="Default value if extraction fails")
    required: bool = Field(default=False, description="Whether extraction is required for success")


class DataTemplateBase(BaseModel):
    """Base model for API data template"""
    name: str = Field(..., min_length=1, max_length=255, description="Template name")
    description: Optional[str] = Field(None, description="Description of what this template creates")
    category: Optional[str] = Field(
        None, 
        max_length=100,
        description="Category (e.g., booking, user, payment, inventory)"
    )
    http_method: HttpMethod = Field(default=HttpMethod.POST, description="HTTP method")
    path: str = Field(..., description="API path (e.g., /api/v1/bookings)")
    request_headers: Dict[str, str] = Field(
        default_factory=dict,
        description="Additional headers for this request"
    )
    request_body_template: Optional[Dict[str, Any]] = Field(
        None,
        description="Request body template with {{variable}} placeholders"
    )
    expected_status_codes: List[int] = Field(
        default=[200, 201],
        description="Expected HTTP status codes for success"
    )
    response_extractors: List[ResponseExtractor] = Field(
        default_factory=list,
        description="Extract values from response for use in tests"
    )
    is_active: bool = Field(default=True, description="Whether template is active")


class DataTemplateCreate(DataTemplateBase):
    """Model for creating a new data template"""
    endpoint_id: str = Field(..., description="ID of the API endpoint to use")


class DataTemplateUpdate(BaseModel):
    """Model for updating a data template"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    http_method: Optional[HttpMethod] = None
    path: Optional[str] = None
    request_headers: Optional[Dict[str, str]] = None
    request_body_template: Optional[Dict[str, Any]] = None
    expected_status_codes: Optional[List[int]] = None
    response_extractors: Optional[List[ResponseExtractor]] = None
    is_active: Optional[bool] = None


class DataTemplateResponse(DataTemplateBase):
    """Response model for data template"""
    id: str
    endpoint_id: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Data Set Models ============

class DataSetBase(BaseModel):
    """Base model for data set (variable values for a template)"""
    name: str = Field(..., min_length=1, max_length=255, description="Data set name")
    description: Optional[str] = Field(None, description="Description of this data set")
    variables: Dict[str, Any] = Field(
        default_factory=dict,
        description="Variable values to substitute in the template"
    )
    is_default: bool = Field(default=False, description="Make this the default data set")
    tags: List[str] = Field(default_factory=list, description="Tags for filtering (e.g., smoke, regression)")


class DataSetCreate(DataSetBase):
    """Model for creating a new data set"""
    template_id: str = Field(..., description="ID of the data template this set belongs to")


class DataSetUpdate(BaseModel):
    """Model for updating a data set"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None
    is_default: Optional[bool] = None
    tags: Optional[List[str]] = None


class DataSetResponse(DataSetBase):
    """Response model for data set"""
    id: str
    template_id: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Test Data Setup Models ============

class OutputVariable(BaseModel):
    """Variable to extract from API response and pass to UI test"""
    name: str = Field(..., description="Variable name for use in UI test")
    source: str = Field(..., description="JSON path or extractor name from template")
    transform: Optional[str] = Field(None, description="Optional transformation (e.g., 'uppercase', 'trim')")


class TestDataSetupBase(BaseModel):
    """Base model for test data setup configuration"""
    name: str = Field(..., min_length=1, max_length=255, description="Setup name")
    description: Optional[str] = Field(None, description="Description of this setup")
    execution_order: int = Field(default=0, description="Order of execution (lower = first)")
    custom_variables: Dict[str, Any] = Field(
        default_factory=dict,
        description="Custom variables to override data set values"
    )
    output_variables: List[OutputVariable] = Field(
        default_factory=list,
        description="Variables to pass to the UI test"
    )
    is_active: bool = Field(default=True, description="Whether setup is active")


class TestDataSetupCreate(TestDataSetupBase):
    """Model for creating test data setup"""
    project_id: Optional[str] = Field(None, description="Project ID")
    template_id: str = Field(..., description="ID of the data template to use")
    data_set_id: Optional[str] = Field(None, description="Optional data set ID")


class TestDataSetupUpdate(BaseModel):
    """Model for updating test data setup"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    execution_order: Optional[int] = None
    template_id: Optional[str] = None
    data_set_id: Optional[str] = None
    custom_variables: Optional[Dict[str, Any]] = None
    output_variables: Optional[List[OutputVariable]] = None
    is_active: Optional[bool] = None


class TestDataSetupResponse(TestDataSetupBase):
    """Response model for test data setup"""
    id: str
    project_id: str
    template_id: str
    data_set_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    
    # Expanded data for convenience
    template_name: Optional[str] = None
    data_set_name: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Execution Models ============

class ExecuteSetupRequest(BaseModel):
    """Request to execute a test data setup"""
    setup_id: Optional[str] = Field(None, description="Specific setup ID to execute")
    setup_ids: Optional[List[str]] = Field(None, description="Multiple setup IDs to execute in order")
    prompt_id: Optional[str] = Field(None, description="Execute all setups linked to this prompt")
    variable_overrides: Dict[str, Any] = Field(
        default_factory=dict,
        description="Override variable values for this execution"
    )
    dry_run: bool = Field(default=False, description="Validate without executing")

    @validator('setup_ids', 'setup_id', 'prompt_id', pre=True, always=True)
    def check_at_least_one(cls, v, values):
        return v


class ExecutionResult(BaseModel):
    """Result of a single API execution"""
    setup_id: str
    setup_name: str
    success: bool
    request_url: str
    request_method: str
    response_status: Optional[int] = None
    duration_ms: int
    extracted_variables: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    executed_at: datetime


class ExecuteSetupResponse(BaseModel):
    """Response from executing test data setups"""
    success: bool
    total_setups: int
    successful_setups: int
    failed_setups: int
    results: List[ExecutionResult]
    combined_variables: Dict[str, Any] = Field(
        default_factory=dict,
        description="All extracted variables combined for use in UI test"
    )
    execution_time_ms: int


# ============ Execution History Models ============

class ExecutionHistoryResponse(BaseModel):
    """Response model for execution history"""
    id: str
    setup_id: Optional[str] = None
    test_execution_id: Optional[str] = None
    template_id: Optional[str] = None
    request_url: str
    request_method: str
    request_headers: Optional[Dict[str, str]] = None
    request_body: Optional[Dict[str, Any]] = None
    response_status: Optional[int] = None
    response_body: Optional[Dict[str, Any]] = None
    extracted_variables: Dict[str, Any] = Field(default_factory=dict)
    duration_ms: int
    success: bool
    error_message: Optional[str] = None
    executed_at: datetime
    executed_by: Optional[str] = None

    class Config:
        from_attributes = True


# ============ Prompt Link Models ============

class LinkSetupToPromptRequest(BaseModel):
    """Request to link a data setup to a prompt (UI test)"""
    prompt_id: str = Field(..., description="ID of the prompt/UI test")
    setup_id: str = Field(..., description="ID of the data setup")
    execution_order: int = Field(default=0, description="Execution order")
    is_active: bool = Field(default=True)


class PromptSetupLinkResponse(BaseModel):
    """Response for prompt-setup link"""
    id: str
    prompt_id: str
    setup_id: str
    setup_name: str
    execution_order: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Bulk/Template Operations ============

class QuickSetupRequest(BaseModel):
    """Quick setup for common test data creation scenarios"""
    scenario_type: str = Field(
        ..., 
        description="Type: 'create_booking', 'create_user', 'create_order', 'custom'"
    )
    endpoint_id: str = Field(..., description="API endpoint to use")
    variables: Dict[str, Any] = Field(
        default_factory=dict,
        description="Variables for the template"
    )
    link_to_prompt: Optional[str] = Field(
        None,
        description="Optionally link to a prompt/UI test"
    )


class BulkExecuteRequest(BaseModel):
    """Execute multiple data setups for a test run"""
    prompt_id: str = Field(..., description="Prompt/UI test ID")
    execution_id: Optional[str] = Field(None, description="Link to test execution")
    variable_overrides: Dict[str, Any] = Field(
        default_factory=dict,
        description="Override variables across all setups"
    )


# ============ List/Filter Models ============

class TemplateFilter(BaseModel):
    """Filter options for listing templates"""
    endpoint_id: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    search: Optional[str] = Field(None, description="Search in name and description")


class SetupFilter(BaseModel):
    """Filter options for listing setups"""
    project_id: Optional[str] = None
    template_id: Optional[str] = None
    is_active: Optional[bool] = None
    search: Optional[str] = None
