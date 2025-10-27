"""
Policy Engine Data Models
Core policy engine models for retry rules and branch outcomes
"""
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime


class PolicyType(str, Enum):
    """Policy types supported by the engine"""
    BRANCHING = "branching"
    SECURITY = "security"
    PERFORMANCE = "performance"
    BUSINESS_RULE = "business_rule"
    RETRY = "retry"
    OUTCOME_CLASSIFICATION = "outcome_classification"


class PolicyStatus(str, Enum):
    """Policy activation status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    DRAFT = "draft"


class EvaluationMode(str, Enum):
    """Rule evaluation modes"""
    ALL = "all"  # All conditions must match
    ANY = "any"  # Any condition can match
    WEIGHTED = "weighted"  # Weighted scoring evaluation


class RetryStrategy(str, Enum):
    """Retry backoff strategies"""
    IMMEDIATE = "immediate"
    LINEAR = "linear"
    EXPONENTIAL = "exponential"
    FIXED = "fixed"


class OutcomeType(str, Enum):
    """Types of execution outcomes"""
    SUCCESS_NAVIGATE = "success_navigate"
    VALIDATION_ERROR = "validation_error"
    TIMEOUT = "timeout"
    ELEMENT_NOT_FOUND = "element_not_found"
    NETWORK_ERROR = "network_error"
    BUSINESS_LOGIC_ERROR = "business_logic_error"
    UNKNOWN_ERROR = "unknown_error"
    CONDITIONAL_BRANCH = "conditional_branch"


class DetectionCriteria(BaseModel):
    """Criteria for detecting specific outcomes"""
    url_change: Optional[Dict[str, str]] = None  # {"pattern": "*/checkout/payment/*"}
    url_unchanged: Optional[bool] = None
    page_load_complete: Optional[bool] = None
    required_elements: Optional[List[str]] = None
    element_appears: Optional[str] = None
    element_disappears: Optional[str] = None
    error_text_patterns: Optional[List[str]] = None
    custom_js_condition: Optional[str] = None
    timeout_ms: Optional[int] = Field(default=5000, ge=1000, le=30000)


class RetryPolicy(BaseModel):
    """Retry policy configuration"""
    max_retries: int = Field(default=3, ge=0, le=10)
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL
    base_delay_ms: int = Field(default=1000, ge=100, le=10000)
    max_delay_ms: int = Field(default=30000, ge=1000, le=60000)
    retry_on_errors: List[str] = Field(default_factory=list)
    no_retry_errors: List[str] = Field(default_factory=list)
    escalate_on_failure: Optional[str] = None  # "manual_review_queue"


class OutcomeDefinition(BaseModel):
    """Definition of a possible action outcome"""
    outcome_name: str
    outcome_type: OutcomeType
    detection_criteria: DetectionCriteria
    next_action: Optional[str] = None
    retry_policy: Optional[RetryPolicy] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ScopeCondition(BaseModel):
    """Conditions that define when a policy applies"""
    url_patterns: Optional[List[str]] = None
    user_roles: Optional[List[str]] = None
    environment: Optional[List[str]] = None
    page_types: Optional[List[str]] = None
    custom_conditions: Dict[str, Any] = Field(default_factory=dict)


class PolicyRule(BaseModel):
    """Individual rule within a policy"""
    id: str
    rule_name: str
    condition_expression: Dict[str, Any]
    action_mapping: Dict[str, Any]
    evaluation_mode: EvaluationMode = EvaluationMode.ALL
    confidence_threshold: float = Field(default=0.8, ge=0.0, le=1.0)
    retry_policy: Optional[RetryPolicy] = None
    expected_outcomes: List[OutcomeDefinition] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class Policy(BaseModel):
    """Core policy model"""
    id: str
    name: str
    description: str
    policy_type: PolicyType
    scope_conditions: ScopeCondition
    status: PolicyStatus = PolicyStatus.DRAFT
    priority_order: int = Field(default=100, ge=1, le=1000)
    rules: List[PolicyRule] = Field(default_factory=list)
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    version: str = "1.0.0"


class ExecutionContext(BaseModel):
    """Context for policy evaluation and execution"""
    run_id: str
    step_index: int
    page_url: str
    page_type: Optional[str] = None
    user_context: Dict[str, Any] = Field(default_factory=dict)
    session_data: Dict[str, Any] = Field(default_factory=dict)
    environment: str = "development"
    browser_info: Dict[str, Any] = Field(default_factory=dict)
    execution_history: List[Dict[str, Any]] = Field(default_factory=list)


class PolicyEvaluationResult(BaseModel):
    """Result of policy evaluation"""
    policy_id: str
    rule_id: Optional[str] = None
    matched: bool
    confidence_score: float = Field(ge=0.0, le=1.0)
    actions_to_execute: List[Dict[str, Any]] = Field(default_factory=list)
    branch_decisions: Dict[str, Any] = Field(default_factory=dict)
    retry_recommendations: Optional[RetryPolicy] = None
    evaluation_details: Dict[str, Any] = Field(default_factory=dict)
    evaluation_time_ms: int = 0


class OutcomeClassification(BaseModel):
    """Classification of execution outcome"""
    outcome_type: OutcomeType
    confidence_score: float = Field(ge=0.0, le=1.0)
    detected_criteria: List[str] = Field(default_factory=list)
    next_actions: List[str] = Field(default_factory=list)
    retry_recommended: bool = False
    retry_policy: Optional[RetryPolicy] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    detection_time_ms: int = 0


class PolicyExecutionLog(BaseModel):
    """Log entry for policy execution"""
    id: str
    run_id: str
    step_index: int
    policy_id: str
    rule_id: Optional[str] = None
    execution_context: ExecutionContext
    evaluation_result: PolicyEvaluationResult
    outcome_classification: Optional[OutcomeClassification] = None
    applied_actions: List[Dict[str, Any]] = Field(default_factory=list)
    execution_time_ms: int = 0
    created_at: datetime = Field(default_factory=datetime.now)
    status: str = "completed"  # "pending", "in_progress", "completed", "failed"