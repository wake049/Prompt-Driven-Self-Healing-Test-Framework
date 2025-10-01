# MCP Tool Schemas Documentation

This directory contains JSON Schema definitions for all Model Context Protocol (MCP) tools in the self-healing test framework. Each schema validates the request and response formats for tool interactions.

## Overview

The schema validation system ensures:
- ✅ **Type Safety**: All parameters have correct data types
- ✅ **Required Fields**: Essential parameters are always provided
- ✅ **Format Validation**: Enums, patterns, and constraints are enforced
- ✅ **Error Prevention**: Invalid requests are caught before execution
- ✅ **API Consistency**: Standardized request/response formats

## Tool Schemas

### 1. `run_action.json` - Action Execution Tool

Executes test actions with self-healing capabilities.

**Schema**: `run_action.json`
**Category**: Execution
**Timeout**: 45 seconds

#### Request Format
```json
{
  "action_type": "click_css",
  "element_name": "login_button",
  "parameters": {
    "timeout_ms": 5000,
    "retry_count": 3
  },
  "context": {
    "session_id": "sess_123",
    "test_run_id": "run_456"
  }
}
```

#### Response Format
```json
{
  "status": "success",
  "execution_time_ms": 1250,
  "selector_used": "#login_button",
  "healing_applied": {
    "original_selector": "#login_button",
    "new_selector": "#login_button",
    "confidence": 1.0,
    "healing_strategy": "attribute_match",
    "review_required": false
  },
  "screenshots": {},
  "element_info": {
    "tag_name": "button",
    "attributes": {"id": "login_button", "class": "btn btn-primary"},
    "text_content": "Login",
    "position": {"x": 100, "y": 200, "width": 80, "height": 32}
  }
}
```

#### Supported Action Types
- `click_css`, `click_xpath` - Click elements
- `type_css`, `type_xpath` - Type text into elements
- `assert_element_visible`, `assert_element_not_visible` - Visibility assertions
- `assert_text_contains`, `assert_title_contains` - Text assertions
- `select_option` - Select dropdown options
- `wait_for_css`, `wait_for_xpath` - Wait for elements
- `scroll_to_element`, `hover_element` - Mouse interactions
- `double_click`, `right_click` - Advanced clicks
- `press_key`, `clear_field` - Keyboard actions
- `get_text`, `get_attribute` - Data extraction
- `switch_to_frame`, `switch_to_window` - Context switching

---

### 2. `get_element.json` - Element Repository Tool

Retrieves element locators from the repository.

**Schema**: `get_element.json`
**Category**: Element Repository
**Timeout**: 5 seconds

#### Request Format
```json
{
  "element_name": "login_button",
  "context": {
    "page_url": "https://example.com/login",
    "viewport": "desktop"
  },
  "options": {
    "include_alternatives": true,
    "include_history": false,
    "validate_presence": true
  }
}
```

#### Response Format
```json
{
  "element_name": "login_button",
  "selector": "#login_button",
  "selector_type": "css",
  "confidence": 0.95,
  "last_updated": "2025-09-29T10:30:00Z",
  "last_validated": "2025-09-29T10:30:00Z",
  "alternatives": [
    {
      "selector": "button[id='login_button']",
      "selector_type": "css",
      "confidence": 0.90,
      "description": "Alternative CSS selector by tag and ID"
    }
  ],
  "validation_result": {
    "is_present": true,
    "is_visible": true,
    "is_clickable": true,
    "element_count": 1,
    "validation_time": "2025-09-29T10:30:00Z"
  }
}
```

#### Options
- `include_alternatives`: Include alternative selectors
- `include_history`: Include creation/update metadata
- `validate_presence`: Validate element exists on page

---

### 3. `bulk_generate_locators.json` - AI Locator Generation Tool

Generates multiple element locators using AI analysis.

**Schema**: `bulk_generate_locators.json`
**Category**: Element Repository
**Timeout**: 60 seconds

#### Request Format
```json
{
  "element_names": ["login_button", "username_field", "password_field"],
  "page_context": {
    "url": "https://example.com/login",
    "html_content": "<html>...</html>",
    "viewport_size": {"width": 1920, "height": 1080},
    "page_title": "Login Page"
  },
  "generation_options": {
    "confidence_threshold": 0.8,
    "include_alternatives": true,
    "max_alternatives": 3,
    "prefer_stable_selectors": true,
    "semantic_analysis": true
  }
}
```

#### Response Format
```json
{
  "locators": [
    {
      "element_name": "login_button",
      "selector": "#login_button",
      "selector_type": "css",
      "confidence": 0.87,
      "ai_reasoning": "Identified based on ID attribute matching login_button",
      "alternatives": [
        {
          "selector": "button[data-testid='login_button']",
          "selector_type": "css",
          "confidence": 0.82,
          "reasoning": "Alternative using data-testid attribute"
        }
      ],
      "element_attributes": {
        "id": "login_button",
        "class": "btn btn-primary"
      },
      "semantic_info": {
        "element_type": "button",
        "purpose": "Primary action element",
        "form_association": "login_form",
        "accessibility_labels": ["Login Button"]
      }
    }
  ],
  "batch_confidence": 0.89,
  "review_required": false,
  "estimated_review_time_minutes": 5,
  "generation_metadata": {
    "model_version": "v1.0.0",
    "processing_time_ms": 2000.0,
    "html_size_bytes": 150000,
    "elements_analyzed": 45,
    "success_count": 3,
    "failure_count": 0
  },
  "quality_metrics": {
    "uniqueness_score": 0.95,
    "stability_score": 0.88,
    "maintainability_score": 0.92
  }
}
```

---

### 4. `analytics_log.json` - Analytics Logging Tool

Records execution metrics and performance data.

**Schema**: `analytics_log.json`
**Category**: Analytics
**Timeout**: 2 seconds

#### Request Format
```json
{
  "event_type": "action_executed",
  "metrics": {
    "execution_time_ms": 1250,
    "success_rate": 0.95,
    "retry_count": 1,
    "confidence_scores": {
      "selector_confidence": 0.95,
      "action_confidence": 0.98
    }
  },
  "context": {
    "run_id": "550e8400-e29b-41d4-a716-446655440000",
    "environment": "development",
    "session_id": "sess_123",
    "application": "web_app",
    "component": "login_form"
  },
  "tags": ["execution", "self-healing"],
  "custom_data": {
    "browser": "chrome",
    "version": "v2.1.0"
  }
}
```

#### Response Format
```json
{
  "logged": true,
  "event_id": "evt_1759161575025",
  "timestamp": "2025-09-29T10:30:00Z",
  "partition_key": "development_web_app",
  "retention_policy": {
    "retention_days": 90,
    "archival_policy": "compress_and_archive",
    "anonymization_after_days": 365
  },
  "aggregation_status": {
    "real_time_updated": true,
    "hourly_batch_queued": true,
    "daily_batch_queued": true
  },
  "compliance": {
    "gdpr_compliant": true,
    "ccpa_compliant": true,
    "pii_detected": false,
    "anonymization_applied": false
  }
}
```

#### Supported Event Types
- `action_executed` - Test action completion
- `healing_applied` - Self-healing event
- `element_discovered` - New element found
- `validation_completed` - Validation results
- `error_occurred` - Error events
- `performance_metric` - Performance data
- `user_interaction` - User actions

## Error Handling

All tools use standardized error codes from `error_model.py`:

### Validation Errors
- `INVALID_PARAMETER_TYPE` - Parameter has wrong data type
- `MISSING_REQUIRED_PARAMETER` - Required parameter not provided
- `INVALID_PARAMETER_VALUE` - Parameter value outside allowed range
- `INVALID_ENUM_VALUE` - Enum parameter has invalid value

### Execution Errors
- `TOOL_NOT_FOUND` - Tool name not registered
- `TOOL_EXECUTION_TIMEOUT` - Tool exceeded timeout limit
- `UNEXPECTED_ERROR` - Unhandled execution error

### Example Error Response
```json
{
  "error": {
    "code": "INVALID_ENUM_VALUE",
    "message": "Validation failed for action_type: 'invalid_action' is not one of [...]",
    "timestamp": "2025-09-29T10:30:00Z",
    "details": {
      "field": "action_type",
      "provided_value": "invalid_action",
      "allowed_values": ["click_css", "type_css", ...]
    }
  }
}
```

## Schema Validation Process

1. **Request Validation**: All tool inputs validated against JSON Schema
2. **Type Checking**: Parameter types verified (string, number, boolean, object, array)
3. **Required Fields**: Missing required parameters trigger validation errors
4. **Enum Validation**: Enumerated values checked against allowed options
5. **Pattern Matching**: String patterns validated (UUIDs, URLs, etc.)
6. **Response Validation**: Tool outputs validated for consistency (warnings only)

## Testing

Run contract tests to verify schema compliance:

```bash
# Run all schema validation tests
python -m pytest tests/test_schema_validation.py -v

# Run integration tests
python test_integration_tools.py

# Test specific tool schema
python -c "
from schema_validator import validate_tool_request
error = validate_tool_request('run_action', {
    'action_type': 'click_css',
    'element_name': 'test_button'
})
print('Valid!' if not error else f'Error: {error.message}')
"
```

## Schema Files

- `run_action.json` - Action execution validation
- `get_element.json` - Element repository validation  
- `bulk_generate_locators.json` - AI generation validation
- `analytics_log.json` - Analytics logging validation
- `error.schema.json` - Error response validation

All schemas follow JSON Schema Draft-7 specification and include comprehensive validation rules, examples, and documentation.