"""
Contract Tests for Schema Validation
Tests that validate schema compliance for all MCP tools
"""

import pytest
import json
import os
from typing import Dict, Any, List
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from schema_validator import SchemaValidator, ToolSchemaValidator
from error_model import ErrorCode, ErrorCategory


class TestSchemaValidation:
    """Test schema validation functionality"""
    
    @pytest.fixture
    def schema_validator(self):
        """Create schema validator instance"""
        return SchemaValidator()
    
    @pytest.fixture
    def tool_validator(self):
        """Create tool schema validator instance"""
        return ToolSchemaValidator()
    
    def test_schema_loading(self, schema_validator):
        """Test that all schemas are loaded correctly"""
        schemas = schema_validator.list_schemas()
        
        # Should have all 4 core tool schemas
        expected_schemas = ["run_action", "get_element", "bulk_generate_locators", "analytics_log"]
        
        for schema_name in expected_schemas:
            assert schema_name in schemas, f"Schema {schema_name} not loaded"
            
            # Verify schema structure
            schema = schema_validator.get_schema(schema_name)
            assert schema is not None, f"Schema {schema_name} is None"
            assert "title" in schema, f"Schema {schema_name} missing title"
            assert "description" in schema, f"Schema {schema_name} missing description"
            assert "properties" in schema, f"Schema {schema_name} missing properties"
            assert "request" in schema["properties"], f"Schema {schema_name} missing request"
            assert "response" in schema["properties"], f"Schema {schema_name} missing response"
    
    def test_valid_requests(self, tool_validator):
        """Test validation of valid requests"""
        
        # Valid run_action request
        run_action_request = {
            "element_name": "login_button",
            "action_type": "click",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "timeout_ms": 5000,
            "healing_enabled": True
        }
        
        is_valid, error = tool_validator.validate_tool_call("run_action", run_action_request)
        assert is_valid, f"Valid run_action request failed validation: {error}"
        assert error is None
        
        # Valid get_element request
        get_element_request = {
            "element_name": "login_button",
            "session_id": "123e4567-e89b-12d3-a456-426614174000"
        }
        
        is_valid, error = tool_validator.validate_tool_call("get_element", get_element_request)
        assert is_valid, f"Valid get_element request failed validation: {error}"
        assert error is None
        
        # Valid bulk_generate_locators request
        bulk_request = {
            "page_url": "https://example.com/login",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "max_elements": 25,
            "include_invisible": False
        }
        
        is_valid, error = tool_validator.validate_tool_call("bulk_generate_locators", bulk_request)
        assert is_valid, f"Valid bulk_generate_locators request failed validation: {error}"
        assert error is None
        
        # Valid analytics_log request
        analytics_request = {
            "event_type": "action_executed",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "metadata": {
                "element_name": "login_button",
                "action_type": "click",
                "success": True
            }
        }
        
        is_valid, error = tool_validator.validate_tool_call("analytics_log", analytics_request)
        assert is_valid, f"Valid analytics_log request failed validation: {error}"
        assert error is None
    
    def test_missing_required_fields(self, tool_validator):
        """Test validation fails for missing required fields"""
        
        # Missing element_name in run_action
        invalid_request = {
            "action_type": "click",
            "session_id": "123e4567-e89b-12d3-a456-426614174000"
        }
        
        is_valid, error = tool_validator.validate_tool_call("run_action", invalid_request)
        assert not is_valid, "Should fail validation for missing required field"
        assert error is not None
        assert error.code == ErrorCode.MISSING_REQUIRED_FIELD
        assert error.category == ErrorCategory.VALIDATION
        assert "element_name" in error.message
    
    def test_invalid_field_types(self, tool_validator):
        """Test validation fails for invalid field types"""
        
        # Invalid timeout_ms type (should be integer)
        invalid_request = {
            "element_name": "login_button",
            "action_type": "click",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "timeout_ms": "5000"  # String instead of integer
        }
        
        is_valid, error = tool_validator.validate_tool_call("run_action", invalid_request)
        assert not is_valid, "Should fail validation for invalid field type"
        assert error is not None
        assert error.code == ErrorCode.INVALID_FIELD_TYPE
        assert "timeout_ms" in error.message
    
    def test_invalid_enum_values(self, tool_validator):
        """Test validation fails for invalid enum values"""
        
        # Invalid action_type
        invalid_request = {
            "element_name": "login_button",
            "action_type": "invalid_action",  # Not in enum
            "session_id": "123e4567-e89b-12d3-a456-426614174000"
        }
        
        is_valid, error = tool_validator.validate_tool_call("run_action", invalid_request)
        assert not is_valid, "Should fail validation for invalid enum value"
        assert error is not None
        assert error.code == ErrorCode.INVALID_ENUM_VALUE
        assert "action_type" in error.message
    
    def test_parameter_ranges(self, tool_validator):
        """Test validation of parameter ranges"""
        
        # Invalid max_elements (exceeds maximum)
        invalid_request = {
            "page_url": "https://example.com/login",
            "session_id": "123e4567-e89b-12d3-a456-426614174000",
            "max_elements": 100  # Exceeds maximum of 50
        }
        
        is_valid, error = tool_validator.validate_tool_call("bulk_generate_locators", invalid_request)
        assert not is_valid, "Should fail validation for parameter out of range"
        assert error is not None
        assert error.code == ErrorCode.PARAMETER_OUT_OF_RANGE
        assert "max_elements" in error.message
    
    def test_invalid_uuid_format(self, tool_validator):
        """Test validation fails for invalid UUID format"""
        
        invalid_request = {
            "element_name": "login_button",
            "action_type": "click",
            "session_id": "invalid-uuid-format"  # Invalid UUID
        }
        
        is_valid, error = tool_validator.validate_tool_call("run_action", invalid_request)
        assert not is_valid, "Should fail validation for invalid UUID format"
        assert error is not None
        assert error.code == ErrorCode.INVALID_UUID_FORMAT
        assert "session_id" in error.message
    
    def test_invalid_url_format(self, tool_validator):
        """Test validation fails for invalid URL format"""
        
        invalid_request = {
            "page_url": "not-a-valid-url",  # Invalid URL
            "session_id": "123e4567-e89b-12d3-a456-426614174000"
        }
        
        is_valid, error = tool_validator.validate_tool_call("bulk_generate_locators", invalid_request)
        assert not is_valid, "Should fail validation for invalid URL format"
        assert error is not None
        assert error.code == ErrorCode.INVALID_URL_FORMAT
        assert "page_url" in error.message
    
    def test_valid_responses(self, tool_validator):
        """Test validation of valid responses"""
        
        # Valid run_action response
        run_action_response = {
            "success": True,
            "element_found": True,
            "action_executed": True,
            "screenshot_taken": True,
            "healing_applied": False,
            "execution_time_ms": 1250,
            "screenshot_path": "/screenshots/action_123.png"
        }
        
        is_valid, error = tool_validator.validate_tool_result("run_action", run_action_response)
        assert is_valid, f"Valid run_action response failed validation: {error}"
        assert error is None
        
        # Valid get_element response
        get_element_response = {
            "found": True,
            "element": {
                "name": "login_button",
                "selector": "button[id='login']",
                "selector_type": "css",
                "confidence_score": 0.95,
                "is_visible": True,
                "is_enabled": True,
                "element_type": "button"
            }
        }
        
        is_valid, error = tool_validator.validate_tool_result("get_element", get_element_response)
        assert is_valid, f"Valid get_element response failed validation: {error}"
        assert error is None
    
    def test_response_validation_failures(self, tool_validator):
        """Test response validation failures"""
        
        # Missing required field in response
        invalid_response = {
            "element_found": True,
            "action_executed": True
            # Missing required "success" field
        }
        
        is_valid, error = tool_validator.validate_tool_result("run_action", invalid_response)
        assert not is_valid, "Should fail validation for missing required response field"
        assert error is not None
        assert error.code == ErrorCode.MISSING_REQUIRED_FIELD
        assert "success" in error.message
    
    def test_tool_schema_info(self, tool_validator):
        """Test getting tool schema information"""
        
        info = tool_validator.get_tool_schema_info("run_action")
        assert info is not None, "Should return schema info for valid tool"
        assert "tool_name" in info
        assert "title" in info
        assert "description" in info
        assert "request" in info
        assert "response" in info
        
        # Check required fields
        assert "required_fields" in info["request"]
        assert "element_name" in info["request"]["required_fields"]
        assert "action_type" in info["request"]["required_fields"]
        assert "session_id" in info["request"]["required_fields"]
    
    def test_nonexistent_tool_schema(self, tool_validator):
        """Test handling of nonexistent tool schemas"""
        
        is_valid, error = tool_validator.validate_tool_call("nonexistent_tool", {})
        assert not is_valid, "Should fail validation for nonexistent tool"
        assert error is not None
        assert error.code == ErrorCode.SCHEMA_VALIDATION_FAILED
        assert "nonexistent_tool" in error.message
        
        info = tool_validator.get_tool_schema_info("nonexistent_tool")
        assert info is None, "Should return None for nonexistent tool"


class TestSchemaCompliance:
    """Test that all schemas comply with JSON Schema Draft 7"""
    
    @pytest.fixture
    def schemas_dir(self):
        """Get schemas directory path"""
        return Path(__file__).parent.parent / "schemas"
    
    def test_schema_files_exist(self, schemas_dir):
        """Test that all expected schema files exist"""
        expected_files = [
            "run_action.json",
            "get_element.json", 
            "bulk_generate_locators.json",
            "analytics_log.json"
        ]
        
        for filename in expected_files:
            schema_path = schemas_dir / filename
            assert schema_path.exists(), f"Schema file {filename} does not exist"
    
    def test_schemas_are_valid_json(self, schemas_dir):
        """Test that all schema files contain valid JSON"""
        for schema_file in schemas_dir.glob("*.json"):
            with open(schema_file, 'r', encoding='utf-8') as f:
                try:
                    json.load(f)
                except json.JSONDecodeError as e:
                    pytest.fail(f"Invalid JSON in {schema_file}: {e}")
    
    def test_schemas_comply_with_draft7(self, schemas_dir):
        """Test that all schemas comply with JSON Schema Draft 7"""
        from jsonschema import Draft7Validator, SchemaError
        
        for schema_file in schemas_dir.glob("*.json"):
            with open(schema_file, 'r', encoding='utf-8') as f:
                schema_data = json.load(f)
            
            try:
                Draft7Validator.check_schema(schema_data)
            except SchemaError as e:
                pytest.fail(f"Schema {schema_file} violates Draft 7: {e}")
    
    def test_schemas_have_required_structure(self, schemas_dir):
        """Test that all schemas have the required structure"""
        required_top_level = ["$schema", "title", "description", "type", "properties"]
        required_properties = ["request", "response"]
        
        for schema_file in schemas_dir.glob("*.json"):
            with open(schema_file, 'r', encoding='utf-8') as f:
                schema_data = json.load(f)
            
            # Check top-level structure
            for field in required_top_level:
                assert field in schema_data, f"Schema {schema_file} missing {field}"
            
            # Check properties structure
            properties = schema_data.get("properties", {})
            for prop in required_properties:
                assert prop in properties, f"Schema {schema_file} missing property {prop}"
            
            # Check that request and response are objects
            assert properties["request"]["type"] == "object", f"Schema {schema_file} request must be object"
            assert properties["response"]["type"] == "object", f"Schema {schema_file} response must be object"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])