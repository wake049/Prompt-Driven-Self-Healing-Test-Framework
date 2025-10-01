"""
Schema Validation Framework
Validates tool requests and responses against JSON schemas
"""

import json
import os
from typing import Dict, Any, Optional, Tuple, List
from pathlib import Path
import jsonschema
from jsonschema import Draft7Validator, ValidationError
import logging

from error_model import ErrorFactory, ErrorCode, MCPError

logger = logging.getLogger(__name__)


class SchemaValidator:
    """Validates JSON data against JSON schemas"""
    
    def __init__(self, schemas_dir: str = None):
        """Initialize validator with schemas directory"""
        self.schemas_dir = schemas_dir or os.path.join(os.path.dirname(__file__), "schemas")
        self.schemas: Dict[str, Dict[str, Any]] = {}
        self.validators: Dict[str, Draft7Validator] = {}
        self._load_schemas()
    
    def _load_schemas(self):
        """Load all JSON schemas from schemas directory"""
        schemas_path = Path(self.schemas_dir)
        
        if not schemas_path.exists():
            logger.warning(f"Schemas directory not found: {self.schemas_dir}")
            return
        
        for schema_file in schemas_path.glob("*.json"):
            try:
                with open(schema_file, 'r', encoding='utf-8') as f:
                    schema_data = json.load(f)
                
                schema_name = schema_file.stem
                self.schemas[schema_name] = schema_data
                
                # Create validator
                try:
                    validator = Draft7Validator(schema_data)
                    validator.check_schema(schema_data)  # Validate the schema itself
                    self.validators[schema_name] = validator
                    logger.info(f"Loaded schema: {schema_name}")
                except jsonschema.SchemaError as e:
                    logger.error(f"Invalid schema {schema_name}: {e}")
                    
            except Exception as e:
                logger.error(f"Failed to load schema {schema_file}: {e}")
    
    def validate_request(self, tool_name: str, request_data: Dict[str, Any]) -> Optional[MCPError]:
        """Validate tool request data against schema"""
        schema_name = f"{tool_name}"
        
        if schema_name not in self.validators:
            return ErrorFactory.validation_error(
                code=ErrorCode.SCHEMA_VALIDATION_FAILED,
                message=f"No schema found for tool: {tool_name}",
                field_name="tool_name",
                field_value=tool_name
            )
        
        validator = self.validators[schema_name]
        
        # Get request schema
        schema = self.schemas[schema_name]
        request_schema = schema.get("properties", {}).get("request", {})
        
        if not request_schema:
            return ErrorFactory.validation_error(
                code=ErrorCode.SCHEMA_VALIDATION_FAILED,
                message=f"No request schema found for tool: {tool_name}",
                field_name="request_schema"
            )
        
        return self._validate_data(request_data, request_schema, "request")
    
    def validate_response(self, tool_name: str, response_data: Dict[str, Any]) -> Optional[MCPError]:
        """Validate tool response data against schema"""
        schema_name = f"{tool_name}"
        
        if schema_name not in self.validators:
            return ErrorFactory.validation_error(
                code=ErrorCode.SCHEMA_VALIDATION_FAILED,
                message=f"No schema found for tool: {tool_name}",
                field_name="tool_name",
                field_value=tool_name
            )
        
        # Get response schema
        schema = self.schemas[schema_name]
        response_schema = schema.get("properties", {}).get("response", {})
        
        if not response_schema:
            return ErrorFactory.validation_error(
                code=ErrorCode.SCHEMA_VALIDATION_FAILED,
                message=f"No response schema found for tool: {tool_name}",
                field_name="response_schema"
            )
        
        return self._validate_data(response_data, response_schema, "response")
    
    def _validate_data(self, data: Dict[str, Any], schema: Dict[str, Any], data_type: str) -> Optional[MCPError]:
        """Validate data against schema"""
        try:
            validator = Draft7Validator(schema)
            validator.validate(data)
            return None  # No errors
            
        except ValidationError as e:
            # Convert validation error to MCPError
            return self._convert_validation_error(e, data_type)
        except Exception as e:
            return ErrorFactory.validation_error(
                code=ErrorCode.SCHEMA_VALIDATION_FAILED,
                message=f"Schema validation failed: {str(e)}",
                field_name=data_type
            )
    
    def _convert_validation_error(self, error: ValidationError, data_type: str) -> MCPError:
        """Convert jsonschema ValidationError to MCPError"""
        field_path = ".".join(str(p) for p in error.absolute_path)
        field_name = field_path if field_path else data_type
        
        # Map validation errors to specific error codes
        error_code = self._get_error_code_from_validation_error(error)
        
        details = {
            "field_path": field_path,
            "validation_message": error.message,
            "invalid_value": error.instance,
            "schema_path": ".".join(str(p) for p in error.schema_path)
        }
        
        if error.validator:
            details["validator"] = error.validator
        if error.validator_value:
            details["validator_value"] = error.validator_value
        
        return ErrorFactory.validation_error(
            code=error_code,
            message=f"Validation failed for {field_name}: {error.message}",
            field_name=field_name,
            field_value=error.instance
        )
    
    def _get_error_code_from_validation_error(self, error: ValidationError) -> ErrorCode:
        """Map validation error to specific error code"""
        validator_type = error.validator
        
        if validator_type == "required":
            return ErrorCode.MISSING_REQUIRED_FIELD
        elif validator_type == "type":
            return ErrorCode.INVALID_FIELD_TYPE
        elif validator_type == "enum":
            return ErrorCode.INVALID_ENUM_VALUE
        elif validator_type == "pattern":
            return ErrorCode.INVALID_REGEX_PATTERN
        elif validator_type == "format":
            if error.validator_value == "uri":
                return ErrorCode.INVALID_URL_FORMAT
            elif error.validator_value == "uuid":
                return ErrorCode.INVALID_UUID_FORMAT
            elif error.validator_value == "date-time":
                return ErrorCode.INVALID_DATE_FORMAT
            else:
                return ErrorCode.INVALID_FIELD_VALUE
        elif validator_type in ["minimum", "maximum", "minLength", "maxLength"]:
            return ErrorCode.PARAMETER_OUT_OF_RANGE
        elif validator_type in ["minItems", "maxItems"]:
            return ErrorCode.INVALID_ARRAY_SIZE
        else:
            return ErrorCode.INVALID_FIELD_VALUE
    
    def get_schema(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """Get schema for a tool"""
        return self.schemas.get(tool_name)
    
    def list_schemas(self) -> List[str]:
        """List all available schemas"""
        return list(self.schemas.keys())
    
    def reload_schemas(self):
        """Reload all schemas from disk"""
        self.schemas.clear()
        self.validators.clear()
        self._load_schemas()


class ToolSchemaValidator:
    """Specific validator for MCP tools"""
    
    def __init__(self, schemas_dir: str = None):
        self.validator = SchemaValidator(schemas_dir)
    
    def validate_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> Tuple[bool, Optional[MCPError]]:
        """Validate a tool call with arguments"""
        error = self.validator.validate_request(tool_name, arguments)
        return error is None, error
    
    def validate_tool_result(self, tool_name: str, result: Dict[str, Any]) -> Tuple[bool, Optional[MCPError]]:
        """Validate a tool result"""
        error = self.validator.validate_response(tool_name, result)
        return error is None, error
    
    def get_tool_schema_info(self, tool_name: str) -> Optional[Dict[str, Any]]:
        """Get schema information for a tool"""
        schema = self.validator.get_schema(tool_name)
        if not schema:
            return None
        
        info = {
            "tool_name": tool_name,
            "title": schema.get("title", ""),
            "description": schema.get("description", ""),
            "version": schema.get("version", "1.0.0")
        }
        
        # Add request info
        request_schema = schema.get("properties", {}).get("request", {})
        if request_schema:
            info["request"] = {
                "required_fields": request_schema.get("required", []),
                "properties": list(request_schema.get("properties", {}).keys())
            }
        
        # Add response info
        response_schema = schema.get("properties", {}).get("response", {})
        if response_schema:
            info["response"] = {
                "properties": list(response_schema.get("properties", {}).keys())
            }
        
        return info


# Global schema validator instance
_schema_validator: Optional[ToolSchemaValidator] = None


def get_schema_validator() -> ToolSchemaValidator:
    """Get global schema validator instance"""
    global _schema_validator
    if _schema_validator is None:
        _schema_validator = ToolSchemaValidator()
    return _schema_validator


def validate_tool_request(tool_name: str, request_data: Dict[str, Any]) -> Optional[MCPError]:
    """Convenience function to validate tool request"""
    validator = get_schema_validator()
    is_valid, error = validator.validate_tool_call(tool_name, request_data)
    return error


def validate_tool_response(tool_name: str, response_data: Dict[str, Any]) -> Optional[MCPError]:
    """Convenience function to validate tool response"""
    validator = get_schema_validator()
    is_valid, error = validator.validate_tool_result(tool_name, response_data)
    return error