"""
 Enterprise Data Models for Prompt-Driven Self-Healing Test Framework
Implements the Prompt/Actions/Elements contract with cost-effective enterprise features.

Models:
- PromptEnvelope: Complete request structure with tenant separation
- ActionCatalog: Versioned action definitions with ETag caching
- PageElement: Optimized element representation for minimal payload
- PageSlice: Top-K element selection with ranking strategies
- PlanResponse: Structured response with cost tracking and clarifications
"""

from __future__ import annotations

import hashlib
import time
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, validator, model_validator, ConfigDict

class BaseEnterpriseModel(BaseModel):
    """Base model with enterprise configuration for JSON serialization"""
    model_config = ConfigDict(
        # Enable JSON encoding of datetime objects
        json_encoders={
            datetime: lambda v: v.isoformat()
        },
        # Validate on assignment
        validate_assignment=True
    )

class TenantConfig(BaseEnterpriseModel):
    """Tenant-specific configuration and limits"""
    tenant_id: str = Field(..., description="Unique tenant identifier")
    max_elements_per_request: int = Field(default=1000, description="Maximum elements allowed per request")
    max_tokens_per_day: int = Field(default=100000, description="Daily token budget")
    preferred_model: str = Field(default="gpt-4o", description="Preferred AI model")
    enable_caching: bool = Field(default=True, description="Enable response caching")
    enable_compression: bool = Field(default=True, description="Enable gzip compression")

class ElementRankingStrategy(str, Enum):
    """Strategy for ranking and selecting page elements"""
    TOP_K = "topK"
    RELEVANCE_SCORE = "relevanceScore"
    HEURISTIC_FILTER = "heuristicFilter"
    VECTOR_SIMILARITY = "vectorSimilarity"  # Future implementation
    HYBRID = "hybrid"

class ActionCatalogRef(BaseEnterpriseModel):
    """Reference to a versioned action catalog with caching support"""
    catalog_id: str = Field(..., description="Unique catalog identifier")
    version: str = Field(..., description="Semantic version (e.g., '3.4.2')")
    etag: Optional[str] = Field(None, description="ETag for cache validation")
    last_modified: Optional[datetime] = Field(None, description="Last modification timestamp")
    
    @property
    def cache_key(self) -> str:
        """Generate cache key for this catalog reference"""
        return f"catalog:{self.catalog_id}:v{self.version}"

class PageElement(BaseModel):
    """Optimized page element representation for minimal payload size"""
    element_id: str = Field(..., description="Unique element identifier within page")
    tag: str = Field(..., description="HTML tag name")
    selector_css: Optional[str] = Field(None, description="CSS selector")
    selector_xpath: Optional[str] = Field(None, description="XPath selector")
    
    # Core attributes for ranking and selection
    text: Optional[str] = Field(None, description="Visible text content (auto-truncated to 200 chars)")
    attributes: Dict[str, Any] = Field(default_factory=dict, description="Key HTML attributes")
    is_interactive: bool = Field(default=False, description="Whether element accepts user interaction")
    is_visible: bool = Field(default=True, description="Whether element is visible")
    
    # Ranking metadata
    relevance_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Computed relevance score")
    page_location: Optional[Dict[str, int]] = Field(None, description="Element position (x, y, width, height)")
    
    @validator('text', pre=True)
    def truncate_text(cls, v):
        """Truncate text to save payload size (runs before field validation)"""
        if v and len(v) > 200:
            return v[:197] + "..."
        return v
    
    @property
    def display_name(self) -> str:
        """Human-readable element name for debugging"""
        if self.text:
            return f"{self.tag}[{self.text[:30]}...]"
        elif self.attributes.get('id'):
            return f"{self.tag}#{self.attributes['id']}"
        elif self.selector_css:
            return f"{self.tag}[{self.selector_css[:30]}...]"
        return f"{self.tag}[{self.element_id[:8]}]"

class PageSlice(BaseModel):
    """Top-K relevant elements with ranking strategy"""
    slice_strategy: ElementRankingStrategy = Field(..., description="Strategy used for element selection")
    k: int = Field(..., ge=1, le=1000, description="Number of elements selected")
    total_elements: int = Field(..., description="Total elements available before filtering")
    elements: List[PageElement] = Field(..., description="Selected elements")
    
    # Metadata for optimization
    ranking_time_ms: Optional[int] = Field(None, description="Time spent ranking elements")
    cache_hit: bool = Field(default=False, description="Whether ranking was cached")
    
    @validator('elements')
    def validate_k_elements(cls, v, values):
        """Ensure elements count matches k parameter"""
        k = values.get('k', 0)
        if len(v) > k:
            raise ValueError(f"Elements list ({len(v)}) exceeds k parameter ({k})")
        return v
    
    @property
    def compression_ratio(self) -> float:
        """Calculate how much the page was compressed"""
        if self.total_elements == 0:
            return 0.0
        return len(self.elements) / self.total_elements

class PageContext(BaseModel):
    """Page context information to help AI understand the page type and purpose"""
    page_type: Optional[str] = Field(None, description="Type of page: ecommerce, airline, banking, news, form, etc.")
    page_title: Optional[str] = Field(None, max_length=200, description="Page title or heading")
    page_description: Optional[str] = Field(None, max_length=500, description="Brief description of page functionality")
    
    # Screenshot and visual context
    screenshot_url: Optional[str] = Field(None, description="URL to uploaded page screenshot")
    screenshot_filename: Optional[str] = Field(None, description="Original filename of uploaded screenshot")
    screenshot_analysis: Optional[str] = Field(None, description="AI analysis of the screenshot content")
    
    # Domain-specific metadata
    domain_name: Optional[str] = Field(None, description="Website domain (e.g., southwest.com, amazon.com)")
    primary_actions: List[str] = Field(default_factory=list, description="Main actions users perform on this page")
    key_elements: List[str] = Field(default_factory=list, description="Key element types present (search-form, product-grid, etc.)")
    
    # Auto-detected hints
    detected_frameworks: List[str] = Field(default_factory=list, description="Detected UI frameworks (React, Angular, etc.)")
    detected_patterns: List[str] = Field(default_factory=list, description="Detected UI patterns (modal, dropdown, carousel, etc.)")
    
    # User annotations and guidance
    user_notes: Optional[str] = Field(None, max_length=1000, description="User-provided context about the page")
    testing_focus: Optional[str] = Field(None, description="What aspects of the page should be prioritized for testing")
    user_uploaded: bool = Field(default=False, description="Whether this context was uploaded by a user")
    
    # Metadata
    created_at: Optional[str] = Field(None, description="When this context was created")
    updated_at: Optional[str] = Field(None, description="When this context was last updated")
    created_by: Optional[str] = Field(None, description="User who created this context")

class PromptEnvelope(BaseEnterpriseModel):
    """Complete request envelope with enterprise features"""
    # Core request data
    prompt: str = Field(..., min_length=10, max_length=20000, description="Natural language test description")
    prompt_id: Optional[str] = Field(None, description="Prompt ID to load existing bindings")
    tenant_id: str = Field(..., description="Tenant identifier for separation and billing")
    run_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique run identifier")
    
    # Action catalog references
    catalog_refs: List[ActionCatalogRef] = Field(default_factory=list, description="Action catalog references")
    
    # Page element data
    page_slice: Optional[PageSlice] = Field(None, description="Selected page elements")
    page_context: Optional[PageContext] = Field(None, description="Page context and metadata for AI understanding")
    page_id: Optional[str] = Field(None, description="Unique page identifier")
    page_url: Optional[str] = Field(None, description="Page URL for context")
    
    # Test type
    test_type: Optional[str] = Field(default="web", description="Test type: 'web' for browser tests, 'app' for native mobile app tests")
    platform: Optional[str] = Field(default=None, description="Target platform for app tests: 'android', 'ios'")
    
    # Request options
    max_steps: int = Field(default=20, ge=1, le=100, description="Maximum steps to generate")
    include_screenshots: bool = Field(default=False, description="Include screenshot steps")
    include_assertions: bool = Field(default=True, description="Include verification steps")
    
    # Enterprise features
    priority: str = Field(default="normal", description="Request priority (low/normal/high)")
    timeout_ms: int = Field(default=90000, ge=1000, le=120000, description="Request timeout")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    request_source: Optional[str] = Field(None, description="Source system or user")
    
    @validator('prompt')
    def validate_prompt_content(cls, v):
        """Ensure prompt has meaningful content"""
        if not v.strip():
            raise ValueError("Prompt cannot be empty")
        # Basic content validation
        if len(v.split()) < 3:
            raise ValueError("Prompt must contain at least 3 words")
        return v.strip()
    
    @property
    def cache_key(self) -> str:
        """Generate cache key for request caching"""
        content = f"{self.prompt}:{self.tenant_id}:{len(self.page_slice.elements) if self.page_slice else 0}"
        return hashlib.md5(content.encode()).hexdigest()[:16]

class ActionDefinition(BaseModel):
    """Definition of an available action with parameters"""
    action_id: str = Field(..., description="Unique action identifier")
    name: str = Field(..., description="Action name")
    description: str = Field(..., description="Action description")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Action parameters schema")
    category: str = Field(default="general", description="Action category")
    cost_weight: float = Field(default=1.0, description="Relative cost weight for token estimation")
    
    @property
    def signature(self) -> str:
        """Generate action signature for caching"""
        return f"{self.name}({','.join(self.parameters.keys())})"

class ActionCatalog(BaseEnterpriseModel):
    """Versioned catalog of available actions with caching metadata"""
    catalog_id: str = Field(..., description="Unique catalog identifier")
    version: str = Field(..., description="Semantic version")
    name: str = Field(..., description="Catalog name")
    description: str = Field(..., description="Catalog description")
    
    actions: List[ActionDefinition] = Field(..., description="Available actions")
    
    # Caching and versioning
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    etag: str = Field(default_factory=lambda: hashlib.md5(str(time.time()).encode()).hexdigest()[:16])
    
    # Metadata
    total_actions: int = Field(default=0, description="Total number of actions")
    categories: List[str] = Field(default_factory=list, description="Available action categories")
    
    @model_validator(mode='before')
    @classmethod
    def set_computed_fields(cls, values):
        """Set computed fields based on actions"""
        if isinstance(values, dict):
            actions = values.get('actions', [])
            values['total_actions'] = len(actions)
            values['categories'] = list(set(action.category for action in actions if hasattr(action, 'category')))
        return values
    
    @property
    def action_signatures(self) -> List[str]:
        """Get all action signatures for quick reference"""
        return [action.signature for action in self.actions]

class PlanStep(BaseModel):
    """Individual step in the generated plan"""
    step_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique step identifier")
    action: str = Field(..., description="Action name")
    target: Optional[str] = Field(None, description="Target element ID")
    args: Dict[str, Any] = Field(default_factory=dict, description="Action arguments")
    
    # Metadata
    confidence: float = Field(default=0.8, ge=0.0, le=1.0, description="Confidence in this step")
    estimated_duration_ms: Optional[int] = Field(None, description="Estimated execution time")
    description: Optional[str] = Field(None, description="Human-readable step description")

class Clarification(BaseModel):
    """Request for clarification or additional information"""
    clarification_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique clarification ID")
    type: str = Field(..., description="Type of clarification needed")
    message: str = Field(..., description="Clarification message")
    suggestions: List[str] = Field(default_factory=list, description="Suggested responses")
    required: bool = Field(default=False, description="Whether clarification is required to proceed")

class CostSummary(BaseModel):
    """Cost tracking and budget information"""
    input_tokens: int = Field(default=0, description="Tokens used for input")
    output_tokens: int = Field(default=0, description="Tokens used for output")
    total_tokens: int = Field(default=0, description="Total tokens used")
    
    # Cost breakdown
    cost_usd: Optional[float] = Field(None, description="Estimated cost in USD")
    elements_processed: int = Field(default=0, description="Number of elements processed")
    cache_hits: int = Field(default=0, description="Number of cache hits")
    
    # Budget tracking
    daily_tokens_used: Optional[int] = Field(None, description="Total tokens used today")
    daily_budget_remaining: Optional[int] = Field(None, description="Remaining daily budget")
    
    @model_validator(mode='before')
    @classmethod
    def calculate_total_tokens(cls, values):
        """Calculate total tokens from input + output"""
        if isinstance(values, dict):
            input_tokens = values.get('input_tokens', 0)
            output_tokens = values.get('output_tokens', 0)
            values['total_tokens'] = input_tokens + output_tokens
        return values

class PlanResponse(BaseEnterpriseModel):
    """Complete response from the /v1/plan endpoint"""
    # Core response data
    plan_id: str = Field(default_factory=lambda: str(uuid4()), description="Unique plan identifier")
    steps: List[PlanStep] = Field(..., description="Generated test steps")
    clarifications: List[Clarification] = Field(default_factory=list, description="Requested clarifications")
    
    # Usage and cost information
    used: Dict[str, Any] = Field(default_factory=dict, description="Usage statistics")
    cost_summary: CostSummary = Field(default_factory=CostSummary, description="Cost and token usage")
    
    # Response metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow, description="Response generation time")
    processing_time_ms: int = Field(default=0, description="Total processing time")
    method: str = Field(default="ai-powered", description="Generation method used")
    model: Optional[str] = Field(None, description="AI model used")
    
    # Caching and optimization
    cache_used: bool = Field(default=False, description="Whether cached data was used")
    compressed: bool = Field(default=False, description="Whether response is compressed")
    
    @property
    def success(self) -> bool:
        """Whether the plan was successfully generated"""
        return len(self.steps) > 0
    
    @property
    def quality_score(self) -> float:
        """Computed quality score based on step confidence"""
        if not self.steps:
            return 0.0
        return sum(step.confidence for step in self.steps) / len(self.steps)

# Cache and optimization models
class CacheEntry(BaseEnterpriseModel):
    """Generic cache entry with TTL and metadata"""
    key: str = Field(..., description="Cache key")
    value: Any = Field(..., description="Cached value")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    ttl_seconds: int = Field(default=3600, description="Time to live in seconds")
    hit_count: int = Field(default=0, description="Number of cache hits")
    
    @property
    def is_expired(self) -> bool:
        """Check if cache entry has expired"""
        age = (datetime.utcnow() - self.created_at).total_seconds()
        return age > self.ttl_seconds

class ElementRankingConfig(BaseModel):
    """Configuration for element ranking algorithms"""
    strategy: ElementRankingStrategy = Field(default=ElementRankingStrategy.TOP_K)
    k: int = Field(default=100, ge=1, le=1000)
    
    # Heuristic weights
    interactivity_weight: float = Field(default=0.3, ge=0.0, le=1.0)
    visibility_weight: float = Field(default=0.2, ge=0.0, le=1.0)
    text_content_weight: float = Field(default=0.2, ge=0.0, le=1.0)
    selector_quality_weight: float = Field(default=0.3, ge=0.0, le=1.0)
    
    # Future: vector similarity thresholds
    similarity_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    
    @model_validator(mode='before')
    @classmethod
    def validate_weights(cls, values):
        """Ensure weights sum to 1.0"""
        if isinstance(values, dict):
            weights = [
                values.get('interactivity_weight', 0),
                values.get('visibility_weight', 0),
                values.get('text_content_weight', 0),
                values.get('selector_quality_weight', 0)
            ]
            total = sum(weights)
            if abs(total - 1.0) > 0.01:  # Allow small floating point differences
                raise ValueError(f"Ranking weights must sum to 1.0, got {total}")
        return values

class DataBinding(BaseEnterpriseModel):
    """Data binding for dynamic value extraction and calculation"""
    name: str = Field(..., description="Variable name for the binding")
    type: str = Field(default="extract", description="Binding type: extract, formula, or constant")
    
    # For extract type
    selector: Optional[str] = Field(None, description="CSS/XPath selector to extract from")
    extract_type: str = Field(default="text", description="What to extract: text, price, number, attribute")
    attribute: Optional[str] = Field(None, description="Attribute name if extract_type is 'attribute'")
    
    # For formula type  
    formula: Optional[str] = Field(None, description="Mathematical formula using ${variable} syntax")
    
    # For constant type
    value: Optional[Union[str, int, float]] = Field(None, description="Constant value")
    
    # Processing options
    regex_pattern: Optional[str] = Field(None, description="Regex pattern to apply to extracted text")
    fallback_value: Optional[str] = Field(None, description="Fallback if extraction fails")

class TestBindings(BaseEnterpriseModel):
    """Collection of data bindings for a test"""
    bindings: List[DataBinding] = Field(default_factory=list, description="List of data bindings")
    
    def get_binding(self, name: str) -> Optional[DataBinding]:
        """Get a binding by name"""
        for binding in self.bindings:
            if binding.name == name:
                return binding
        return None
    
    def add_binding(self, binding: DataBinding) -> None:
        """Add or update a binding"""
        # Remove existing binding with same name
        self.bindings = [b for b in self.bindings if b.name != binding.name]
        self.bindings.append(binding)

class BindingContext(BaseEnterpriseModel):
    """Runtime context for binding evaluation"""
    variables: Dict[str, Any] = Field(default_factory=dict, description="Resolved variable values")
    
    def set_variable(self, name: str, value: Any) -> None:
        """Set a variable value"""
        self.variables[name] = value
    
    def get_variable(self, name: str) -> Any:
        """Get a variable value"""
        return self.variables.get(name)
    
    def resolve_template(self, template: str) -> str:
        """Resolve ${variable} placeholders in a template string"""
        import re
        
        def replace_var(match):
            var_name = match.group(1)
            value = self.get_variable(var_name)
            if value is None:
                raise ValueError(f"Variable '${var_name}' not found in binding context")
            return str(value)
        
        return re.sub(r'\$\{([^}]+)\}', replace_var, template)

# Export all models for easy importing
__all__ = [
    'TenantConfig',
    'ElementRankingStrategy', 
    'ActionCatalogRef',
    'PageElement',
    'PageSlice',
    'PageContext',
    'PromptEnvelope',
    'ActionDefinition',
    'ActionCatalog',
    'PlanStep',
    'Clarification',
    'CostSummary',
    'PlanResponse',
    'CacheEntry',
    'ElementRankingConfig',
    'DataBinding',
    'TestBindings',
    'BindingContext'
]