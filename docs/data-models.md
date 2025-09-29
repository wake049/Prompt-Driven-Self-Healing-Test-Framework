# Data Models & Entity Relationships

## Entity Relationship Diagram

```mermaid
erDiagram
    TestPlan ||--o{ TestStep : contains
    TestStep ||--o{ Action : executes
    TestStep ||--o{ PolicyBranch : "branches on"
    Action }o--|| Element : references
    Action ||--o{ ActionOutcome : "can result in"
    
    Element ||--o{ LocatorProposal : "has proposals"
    Element ||--o{ ElementVersion : "has versions"
    LocatorProposal }o--|| ReviewItem : "requires review"
    
    TestRun ||--o{ StepExecution : "tracks execution"
    StepExecution }o--|| TestStep : executes
    StepExecution ||--o{ HealingEvent : "may trigger"
    HealingEvent }o--|| Element : "targets element"
    
    Policy ||--o{ PolicyRule : contains
    PolicyRule ||--o{ PolicyBranch : "defines branches"
    
    User ||--o{ ReviewItem : "assigned to"
    User ||--o{ TestRun : initiates
    
    TestPlan {
        string id PK
        string name
        string description
        json step_graph
        string created_by FK
        timestamp created_at
        string version
        enum status "draft|active|deprecated"
        json metadata
    }
    
    TestStep {
        string id PK
        string plan_id FK
        string name
        string description
        int sequence_order
        json branch_conditions
        enum step_type "action|decision|parallel|loop"
        json parameters
        string parent_step_id FK
    }
    
    Action {
        string id PK
        string step_id FK
        enum action_type "click_css|type_css|assert_element_visible|select_option|navigate_url|wait_for_element"
        string element_name FK
        json parameters
        int timeout_ms
        enum retry_policy "none|linear|exponential"
        int max_retries
        json success_criteria
    }
    
    ActionOutcome {
        string id PK
        string action_id FK
        string outcome_name
        json detection_criteria
        string next_action_id FK
        enum outcome_type "success|error|branch|terminal"
        json metadata
    }
    
    Element {
        string id PK
        string name UK
        string description
        string page_context
        string current_locator
        string element_type
        timestamp last_validated
        float success_rate
        string approved_by FK
        json validation_rules
        enum status "active|deprecated|under_review"
    }
    
    ElementVersion {
        string id PK
        string element_id FK
        string locator_css
        string locator_xpath
        string change_reason
        string changed_by FK
        timestamp created_at
        enum version_type "major|minor|patch"
        json performance_metrics
    }
    
    LocatorProposal {
        string id PK
        string element_name
        json locator_candidates
        float batch_confidence
        string generated_by
        timestamp created_at
        enum status "pending|approved|rejected"
        string page_url
        json generation_metadata
    }
    
    ReviewItem {
        string id PK
        enum item_type "locator_proposal|healing_suggestion|policy_exception"
        string item_id
        string assigned_to FK
        enum priority "high|medium|low"
        enum status "pending|in_progress|approved|rejected"
        timestamp created_at
        timestamp due_date
        json review_context
        string resolution_notes
    }
    
    TestRun {
        string id PK
        string plan_id FK
        string initiated_by FK
        timestamp started_at
        timestamp completed_at
        enum status "running|completed|failed|cancelled"
        json input_parameters
        string environment
        json execution_metadata
        int total_steps
        int completed_steps
        int failed_steps
        int healed_steps
    }
    
    StepExecution {
        string id PK
        string run_id FK
        string step_id FK
        timestamp started_at
        timestamp completed_at
        enum status "pending|running|completed|failed|skipped"
        json execution_result
        string screenshot_url
        int execution_time_ms
        int retry_count
        string error_message
    }
    
    HealingEvent {
        string id PK
        string step_execution_id FK
        string element_id FK
        string original_locator
        string healed_locator
        float confidence_score
        enum healing_strategy "semantic_match|visual_similarity|dom_traversal|fallback_chain"
        enum status "proposed|applied|rejected"
        string applied_by FK
        timestamp created_at
        json healing_metadata
    }
    
    Policy {
        string id PK
        string name
        string description
        enum policy_type "branching|security|performance|business_rule"
        json scope_conditions
        enum status "active|inactive|draft"
        string created_by FK
        timestamp created_at
        int priority_order
    }
    
    PolicyRule {
        string id PK
        string policy_id FK
        string rule_name
        json condition_expression
        json action_mapping
        enum evaluation_mode "all|any|weighted"
        float confidence_threshold
        json metadata
    }
    
    PolicyBranch {
        string id PK
        string step_id FK
        string policy_rule_id FK
        string condition_key
        json condition_values
        string target_step_id FK
        enum branch_type "conditional|parallel|loop|exception"
        json branch_metadata
    }
    
    User {
        string id PK
        string username UK
        string email UK
        string full_name
        json roles
        json permissions
        enum status "active|inactive|suspended"
        timestamp last_login
        json preferences
    }
```

## Key Data Model Patterns

### Step Graph Structure
TestPlans use a directed acyclic graph (DAG) representation where:
- Each TestStep can have multiple child steps (parallel execution)
- PolicyBranch entries define conditional routing between steps
- Loop constructs supported via step references with iteration limits

### Element Versioning Strategy  
- **Semantic Versioning**: Major (breaking selector changes), Minor (new fallbacks), Patch (performance optimizations)
- **Approval Workflow**: LocatorProposal → ReviewItem → ElementVersion → Element update
- **Rollback Support**: Previous versions retained with performance metrics for intelligent fallback

### Healing Event Chain
1. Action fails → HealingEvent created with proposed locator
2. Confidence score determines auto-apply threshold (>0.9) vs. human review
3. Applied healings create new ElementVersion with healing metadata
4. Success/failure feedback updates healing algorithm confidence

### Multi-Outcome Actions
Actions support multiple defined outcomes via ActionOutcome entities:
- Each outcome has detection criteria (DOM changes, URL patterns, error messages)
- Outcomes can chain to different next actions, enabling complex branching logic
- Terminal outcomes end execution branch, success outcomes continue main flow