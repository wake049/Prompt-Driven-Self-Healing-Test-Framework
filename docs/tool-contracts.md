# MCP Tool Contracts

## Core Execution Tools

### run_action
Execute a single test action with self-healing capabilities.

**Input:**
```json
{
  "action_type": "click_css|type_css|assert_element_visible|select_option",
  "element_name": "login_button|username_field|product_title",
  "parameters": {
    "text": "optional_input_text",
    "selector_override": "optional_css_selector",
    "timeout": 30000,
    "heal_mode": "auto|manual|disabled"
  },
  "context": {
    "run_id": "uuid",
    "step_index": 0,
    "page_url": "current_page_url",
    "session_data": {}
  }
}
```

**Output:**
```json
{
  "status": "success|failure|healed",
  "execution_time_ms": 1250,
  "selector_used": "final_css_selector",
  "healing_applied": {
    "original_selector": "old_selector",
    "new_selector": "healed_selector", 
    "confidence": 0.85,
    "review_required": true
  },
  "screenshot_url": "s3://bucket/screenshot.png",
  "error_details": "failure_reason_if_applicable"
}
```

**Failure Modes:**
- `element_not_found`: Trigger healing workflow or fail fast
- `timeout_exceeded`: Retry with extended timeout or alternative selector
- `stale_element`: Re-locate element and retry action
- `permission_denied`: Security policy violation, halt execution

### fetch_test_data
Retrieve test data for parameterized test execution.

**Input:**
```json
{
  "data_source": "csv|database|api|static",
  "query": {
    "table": "users",
    "filters": {"role": "admin", "active": true},
    "limit": 10
  },
  "run_context": {
    "test_plan_id": "uuid",
    "environment": "staging|production"
  }
}
```

**Output:**
```json
{
  "data_rows": [
    {"username": "admin1", "password": "encrypted_value"},
    {"username": "admin2", "password": "encrypted_value"}
  ],
  "row_count": 2,
  "cache_ttl": 300,
  "sensitive_fields": ["password", "api_key"]
}
```

## Element Repository Tools

### bulk_generate_locators
Generate AI-proposed locators for multiple element names.

**Input:**
```json
{
  "element_names": ["login_button", "username_field", "submit_form"],
  "page_context": {
    "url": "https://app.example.com/login",
    "page_title": "Login - Example App",
    "framework_hints": ["react", "bootstrap"]
  },
  "generation_mode": "conservative|aggressive|balanced"
}
```

**Output:**
```json
{
  "proposals": [
    {
      "element_name": "login_button",
      "locator_candidates": [
        {"css": "button[type='submit']", "confidence": 0.95, "priority": 1},
        {"css": ".login-btn", "confidence": 0.82, "priority": 2},
        {"xpath": "//button[contains(text(),'Login')]", "confidence": 0.78, "priority": 3}
      ],
      "ai_reasoning": "Primary button with submit type, high semantic confidence"
    }
  ],
  "batch_confidence": 0.87,
  "review_required": false,
  "estimated_review_time_minutes": 5
}
```

### get_element
Retrieve approved element locator with fallback chain.

**Input:**
```json
{
  "element_name": "checkout_button",
  "page_context": {
    "url_pattern": "*/checkout/*",
    "user_agent": "chrome_desktop"
  },
  "fallback_strategy": "cascade|strict|disabled"
}
```

**Output:**
```json
{
  "locator": {
    "primary_css": "#checkout-btn",
    "fallback_selectors": [".btn-checkout", "button[data-testid='checkout']"],
    "last_validated": "2025-09-24T10:30:00Z",
    "success_rate": 0.98
  },
  "metadata": {
    "approved_by": "user_id",
    "version": "1.2.0",
    "context_rules": ["requires_cart_items", "mobile_layout_differs"]
  }
}
```

### save_element
Persist new or updated element locator after human approval.

**Input:**
```json
{
  "element_name": "product_rating",
  "locator_data": {
    "css": ".rating-stars span",
    "description": "Product rating display (1-5 stars)",
    "validation_rules": ["must_be_visible", "contains_numeric"]
  },
  "approval_metadata": {
    "approved_by": "qa_lead_user_id",
    "approval_notes": "Tested across 3 product types",
    "risk_assessment": "low"
  }
}
```

### heal_element
Propose healing for failed element locator.

**Input:**
```json
{
  "failed_locator": "#old-button-id",
  "element_name": "submit_button", 
  "page_snapshot": {
    "dom_hash": "abc123",
    "screenshot_url": "s3://bucket/failure.png"
  },
  "context": {
    "failure_count": 3,
    "last_success": "2025-09-20T15:00:00Z"
  }
}
```

**Output:**
```json
{
  "healing_proposal": {
    "new_locator": "button[type='submit'].primary",
    "confidence": 0.89,
    "healing_strategy": "semantic_match|visual_similarity|dom_traversal",
    "requires_review": true
  },
  "fallback_actions": [
    "retry_with_wait",
    "use_alternative_selector", 
    "escalate_to_manual"
  ]
}
```

## Workflow & Analytics Tools

### detect_outcome
Classify test step outcome using multi-modal detection.

**Input:**
```json
{
  "action_executed": {
    "type": "click_continue",
    "target_element": "continue_button"
  },
  "page_state": {
    "url_before": "checkout/step1",
    "url_after": "checkout/step2", 
    "dom_changes": ["#step-indicator updated", ".error-message appeared"]
  },
  "expected_outcomes": ["success_navigate", "validation_error", "timeout"]
}
```

**Output:**
```json
{
  "detected_outcome": "validation_error",
  "confidence": 0.94,
  "evidence": {
    "error_message": "Please select a shipping method",
    "url_unchanged": true,
    "error_element_visible": ".field-error"
  },
  "next_actions": ["handle_validation_error", "retry_with_correction"]
}
```

### queue_review
Submit items for human review with priority and context.

**Input:**
```json
{
  "review_type": "locator_approval|test_failure|policy_exception",
  "item_data": {
    "element_name": "dynamic_content_area",
    "proposed_locator": ".content[data-loaded='true']",
    "failure_context": "Works in staging, fails in prod"
  },
  "priority": "high|medium|low",
  "assignment": {
    "suggested_reviewer": "domain_expert_id",
    "skills_required": ["css_selectors", "dynamic_content"]
  }
}
```

### analytics_log
Record execution metrics and performance data.

**Input:**
```json
{
  "event_type": "action_executed|healing_applied|review_completed",
  "metrics": {
    "execution_time_ms": 1250,
    "tokens_consumed": 450,
    "confidence_scores": [0.95, 0.87, 0.92]
  },
  "context": {
    "run_id": "uuid",
    "user_id": "uuid", 
    "environment": "production"
  }
}
```