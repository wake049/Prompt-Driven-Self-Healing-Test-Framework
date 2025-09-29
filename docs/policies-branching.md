# Policies & Branching

## Policy Engine Architecture

The Policy Engine enables dynamic test execution paths based on runtime page conditions, user context, and business rules. It provides declarative configuration for complex branching logic without hardcoding conditional flows.

## Seating Selection Policy Example

### Policy Definition
```json
{
  "policy_id": "airline_seating_selection",
  "policy_type": "branching",
  "description": "Dynamic seating workflow based on ticket type and availability",
  "scope_conditions": {
    "page_url_pattern": "*/booking/seats/*",
    "required_elements": ["seat_map", "continue_button"]
  },
  "rules": [
    {
      "rule_name": "detect_seating_mode",
      "condition_expression": {
        "any": [
          {"element_exists": ".seat-assignment-required"},
          {"page_text_contains": "assigned seat"},
          {"url_parameter": "seat_required=true"}
        ]
      },
      "action_mapping": {
        "set_context": {"seating_mode": "assigned"},
        "insert_action": "select_assigned_seat"
      }
    },
    {
      "rule_name": "open_seating_available", 
      "condition_expression": {
        "all": [
          {"element_exists": ".seat-selector-grid"},
          {"not": {"element_exists": ".seat-assignment-required"}}
        ]
      },
      "action_mapping": {
        "set_context": {"seating_mode": "open"},
        "branch_to": "optional_seat_selection"
      }
    }
  ]
}
```

### Runtime Evaluation Flow
1. **Page Load Detection**: Policy engine monitors for scope conditions
2. **Signal Evaluation**: Check DOM for seating mode indicators  
3. **Context Update**: Set `seating_mode` variable based on detected signals
4. **Action Insertion**: Dynamically inject seat selection actions into test flow
5. **Fallback Handling**: If seat selection fails, continue with original checkout flow

## Page Signal Detection Patterns

### DOM-Based Signals
```json
{
  "signal_type": "element_presence",
  "selectors": [
    ".seat-assignment-required",
    "[data-seat-selection='mandatory']", 
    "#assigned-seat-notice"
  ],
  "detection_mode": "any_present"
}
```

### Text Content Signals  
```json
{
  "signal_type": "page_text",
  "patterns": [
    "You must select an assigned seat",
    "Seat assignment required",
    "Choose your seat"
  ],
  "match_mode": "contains_any"
}
```

### URL Parameter Signals
```json
{
  "signal_type": "url_analysis", 
  "parameters": {
    "seat_required": "true",
    "cabin_class": "premium",
    "booking_type": "business"
  },
  "evaluation": "parameter_exists_and_matches"
}
```

## Multi-Outcome Actions Pattern

### click_continue Contract Definition
```json
{
  "action_name": "click_continue",
  "element_name": "continue_button",
  "expected_outcomes": [
    {
      "outcome_name": "success_navigate",
      "detection_criteria": {
        "url_change": {"pattern": "*/checkout/payment/*"},
        "page_load_complete": true,
        "required_elements": [".payment-form", ".billing-address"]
      },
      "next_action": "continue_payment_flow"
    },
    {
      "outcome_name": "validation_error", 
      "detection_criteria": {
        "element_appears": ".error-message, .field-error",
        "url_unchanged": true,
        "error_text_patterns": [
          "Please select a seat",
          "Required field missing", 
          "Invalid selection"
        ]
      },
      "next_action": "handle_validation_error"
    },
    {
      "outcome_name": "seat_selection_required",
      "detection_criteria": {
        "url_change": {"pattern": "*/booking/seats/*"},
        "element_appears": ".seat-map, .seat-grid",
        "page_title_contains": "Select Seat"
      },
      "next_action": "select_seat_workflow"
    }
  ],
  "timeout_ms": 10000,
  "outcome_detection_delay": 1000
}
```

### Outcome Detection Implementation
```python
def detect_outcome(action_result, expected_outcomes, page_state):
    """
    Multi-modal outcome detection using page state analysis
    """
    for outcome in expected_outcomes:
        criteria = outcome["detection_criteria"]
        confidence = 0.0
        
        # URL pattern matching
        if "url_change" in criteria:
            if matches_pattern(page_state.url, criteria["url_change"]["pattern"]):
                confidence += 0.3
                
        # Element presence/absence  
        if "element_appears" in criteria:
            if any(element_visible(sel) for sel in criteria["element_appears"].split(", ")):
                confidence += 0.4
                
        # Text content analysis
        if "error_text_patterns" in criteria:
            page_text = get_page_text()
            if any(pattern in page_text for pattern in criteria["error_text_patterns"]):
                confidence += 0.3
                
        # Threshold for outcome detection (configurable)
        if confidence >= 0.7:
            return outcome["outcome_name"], confidence
            
    return "unknown_outcome", 0.0
```

## Advanced Policy Patterns

### User Context-Based Branching
```json
{
  "rule_name": "premium_user_flow",
  "condition_expression": {
    "all": [
      {"user_attribute": "membership_tier", "equals": "premium"},
      {"element_exists": ".premium-options"}
    ]
  },
  "action_mapping": {
    "insert_actions": [
      {"action": "click_css", "element": "premium_seat_tab"},
      {"action": "select_option", "element": "premium_seat_type"}
    ]
  }
}
```

### Time-Based Policy Activation
```json
{
  "rule_name": "business_hours_validation",
  "condition_expression": {
    "time_range": {"start": "09:00", "end": "17:00", "timezone": "EST"},
    "weekdays_only": true
  },
  "action_mapping": {
    "enable_actions": ["submit_business_request"],
    "disable_actions": ["emergency_override"]
  }
}
```

### A/B Test Integration
```json
{
  "rule_name": "checkout_flow_variant",
  "condition_expression": {
    "user_bucket": {"experiment": "checkout_redesign", "variant": "treatment"}
  },
  "action_mapping": {
    "replace_element_mapping": {
      "checkout_button": "new_checkout_button_v2",
      "payment_form": "streamlined_payment_form"
    }
  }
}
```

## Policy Validation & Testing

### Policy Simulation Mode
- **Dry Run**: Evaluate policies without executing actions
- **Impact Analysis**: Predict which test steps would be affected
- **Coverage Report**: Ensure all policy branches are testable

### Policy Conflict Resolution
- **Priority Ordering**: Numeric priority determines rule precedence
- **Scope Specificity**: More specific scope conditions override general rules
- **Explicit Overrides**: Manual policy disable/enable flags

### Performance Optimization
- **Rule Caching**: Cache policy evaluation results for identical page states
- **Lazy Loading**: Load policies only when scope conditions match
- **Batch Evaluation**: Evaluate multiple rules simultaneously for efficiency