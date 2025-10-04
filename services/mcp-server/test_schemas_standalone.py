"""
Standalone Schema Validation Test
Test that runs independently without complex imports
"""

import json
import os
from pathlib import Path
import jsonschema
from jsonschema import Draft7Validator, ValidationError


def test_schema_files_exist():
    """Test that all expected schema files exist"""
    schemas_dir = Path(__file__).parent / "schemas"
    expected_files = [
        "run_action.json",
        "get_element.json", 
        "bulk_generate_locators.json",
        "analytics_log.json"
    ]
    
    print(f"Looking for schemas in: {schemas_dir}")
    
    for filename in expected_files:
        schema_path = schemas_dir / filename
        assert schema_path.exists(), f"Schema file {filename} does not exist at {schema_path}"
        print(f"✓ Schema file exists: {filename}")


def test_schemas_are_valid_json():
    """Test that all schema files contain valid JSON"""
    schemas_dir = Path(__file__).parent / "schemas"
    
    for schema_file in schemas_dir.glob("*.json"):
        with open(schema_file, 'r', encoding='utf-8') as f:
            try:
                json.load(f)
                print(f"✓ Valid JSON: {schema_file.name}")
            except json.JSONDecodeError as e:
                raise AssertionError(f"Invalid JSON in {schema_file}: {e}")


def test_schemas_comply_with_draft7():
    """Test that all schemas comply with JSON Schema Draft 7"""
    schemas_dir = Path(__file__).parent / "schemas"
    
    for schema_file in schemas_dir.glob("*.json"):
        with open(schema_file, 'r', encoding='utf-8') as f:
            schema_data = json.load(f)
        
        try:
            Draft7Validator.check_schema(schema_data)
            print(f"✓ Valid Draft 7 schema: {schema_file.name}")
        except jsonschema.SchemaError as e:
            raise AssertionError(f"Schema {schema_file} violates Draft 7: {e}")


def test_schemas_have_required_structure():
    """Test that all schemas have the required structure"""
    schemas_dir = Path(__file__).parent / "schemas"
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
        
        print(f"✓ Valid structure: {schema_file.name}")


def test_run_action_schema_validation():
    """Test run_action schema with sample data"""
    schemas_dir = Path(__file__).parent / "schemas"
    
    with open(schemas_dir / "run_action.json", 'r', encoding='utf-8') as f:
        schema_data = json.load(f)
    
    # Get request schema
    request_schema = schema_data["properties"]["request"]
    validator = Draft7Validator(request_schema)
    
    # Valid request
    valid_request = {
        "action_type": "click_css",
        "element_name": "login_button",
        "parameters": {
            "timeout": 5000,
            "heal_mode": "auto"
        },
        "context": {
            "run_id": "123e4567-e89b-12d3-a456-426614174000",
            "step_index": 1
        }
    }
    
    try:
        validator.validate(valid_request)
        print("✓ Valid run_action request passes validation")
    except ValidationError as e:
        raise AssertionError(f"Valid request failed validation: {e}")
    
    # Invalid request - missing required field
    invalid_request = {
        "action_type": "click_css"
        # Missing required element_name
    }
    
    try:
        validator.validate(invalid_request)
        raise AssertionError("Invalid request should have failed validation")
    except ValidationError:
        print("✓ Invalid run_action request correctly fails validation")


def test_get_element_schema_validation():
    """Test get_element schema with sample data"""
    schemas_dir = Path(__file__).parent / "schemas"
    
    with open(schemas_dir / "get_element.json", 'r', encoding='utf-8') as f:
        schema_data = json.load(f)
    
    # Get request schema
    request_schema = schema_data["properties"]["request"]
    validator = Draft7Validator(request_schema)
    
    # Valid request
    valid_request = {
        "element_name": "login_button",
        "context": {
            "page_url": "https://example.com/login",
            "session_id": "123e4567-e89b-12d3-a456-426614174000"  # session_id goes in context
        },
        "options": {
            "include_history": False,
            "validate_presence": True
        }
    }
    
    try:
        validator.validate(valid_request)
        print("✓ Valid get_element request passes validation")
    except ValidationError as e:
        raise AssertionError(f"Valid request failed validation: {e}")


if __name__ == "__main__":
    print("Running Schema Validation Tests...")
    print("=" * 50)
    
    try:
        test_schema_files_exist()
        test_schemas_are_valid_json()
        test_schemas_comply_with_draft7()
        test_schemas_have_required_structure()
        test_run_action_schema_validation()
        test_get_element_schema_validation()
        
        print("=" * 50)
        print("✅ All schema validation tests passed!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        exit(1)