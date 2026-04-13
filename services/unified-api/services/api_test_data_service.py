"""
API Test Data Service
Handles execution of API calls to create test data for UI tests
Supports variable substitution, response extraction, and chaining
"""

import asyncio
import json
import logging
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import httpx

# JSONPath for extracting values from API responses
try:
    from jsonpath_ng import parse as jsonpath_parse
    JSONPATH_AVAILABLE = True
except ImportError:
    JSONPATH_AVAILABLE = False
    jsonpath_parse = None
    logging.warning("jsonpath-ng not installed. Install with: pip install jsonpath-ng")

from core.database import DatabaseManager
from schemas.api_test_data import (
    AuthType,
    ExecutionResult,
    ResponseExtractor,
)

logger = logging.getLogger(__name__)


class ApiTestDataService:
    """Service for executing API calls to create test data"""

    def __init__(self, db: DatabaseManager):
        self.db = db
        self._variable_pattern = re.compile(r'\{\{(\w+)\}\}')

    async def execute_setup(
        self,
        setup_id: str,
        variable_overrides: Optional[Dict[str, Any]] = None,
        executed_by: Optional[str] = None,
        dry_run: bool = False
    ) -> ExecutionResult:
        """
        Execute a single test data setup.
        
        Args:
            setup_id: ID of the test data setup to execute
            variable_overrides: Override variables for this execution
            executed_by: User ID who triggered the execution
            dry_run: If True, validate without executing
            
        Returns:
            ExecutionResult with success status and extracted variables
        """
        start_time = time.time()
        
        # Fetch setup with template and endpoint details
        setup_query = """
            SELECT 
                s.id, s.name, s.custom_variables, s.output_variables,
                t.id as template_id, t.name as template_name, t.http_method, t.path,
                t.request_headers as template_headers, t.request_body_template,
                t.expected_status_codes, t.response_extractors,
                e.id as endpoint_id, e.base_url, e.auth_type, e.auth_config,
                e.default_headers as endpoint_headers, e.timeout_seconds, e.retry_count,
                ds.variables as data_set_variables
            FROM api_tests.test_data_setups s
            JOIN api_tests.data_templates t ON t.id = s.template_id
            JOIN api_tests.api_endpoints e ON e.id = t.endpoint_id
            LEFT JOIN api_tests.data_sets ds ON ds.id = s.data_set_id
            WHERE s.id = $1
        """
        
        setup = await self.db.execute_one(setup_query, setup_id)
        if not setup:
            return ExecutionResult(
                setup_id=setup_id,
                setup_name="Unknown",
                success=False,
                request_url="",
                request_method="",
                duration_ms=int((time.time() - start_time) * 1000),
                error_message=f"Setup {setup_id} not found",
                executed_at=datetime.utcnow()
            )

        # Build final variables (priority: overrides > custom > data_set)
        variables = {}
        if setup.get('data_set_variables'):
            data_set_vars = setup['data_set_variables']
            if isinstance(data_set_vars, str):
                data_set_vars = json.loads(data_set_vars)
            variables.update(data_set_vars)
        
        if setup.get('custom_variables'):
            custom_vars = setup['custom_variables']
            if isinstance(custom_vars, str):
                custom_vars = json.loads(custom_vars)
            variables.update(custom_vars)
        
        if variable_overrides:
            variables.update(variable_overrides)

        # Build request URL
        base_url = setup['base_url'].rstrip('/')
        path = self._substitute_variables(setup['path'], variables)
        request_url = f"{base_url}{path}"

        # Build headers
        headers = {}
        
        # Add endpoint default headers
        if setup.get('endpoint_headers'):
            endpoint_headers = setup['endpoint_headers']
            if isinstance(endpoint_headers, str):
                endpoint_headers = json.loads(endpoint_headers)
            headers.update(endpoint_headers)
        
        # Add template headers
        if setup.get('template_headers'):
            template_headers = setup['template_headers']
            if isinstance(template_headers, str):
                template_headers = json.loads(template_headers)
            headers.update(template_headers)
        
        # Add authentication
        headers = self._add_authentication(headers, setup['auth_type'], setup.get('auth_config', {}))
        
        # Substitute variables in headers
        headers = {k: self._substitute_variables(str(v), variables) for k, v in headers.items()}

        # Build request body
        request_body = None
        if setup.get('request_body_template'):
            body_template = setup['request_body_template']
            if isinstance(body_template, str):
                body_template = json.loads(body_template)
            request_body = self._substitute_variables_in_dict(body_template, variables)

        http_method = setup['http_method'].upper()

        # Dry run - return without executing
        if dry_run:
            return ExecutionResult(
                setup_id=setup_id,
                setup_name=setup['name'],
                success=True,
                request_url=request_url,
                request_method=http_method,
                duration_ms=int((time.time() - start_time) * 1000),
                extracted_variables={},
                error_message="Dry run - not executed",
                executed_at=datetime.utcnow()
            )

        # Execute the request
        try:
            response_status, response_body, error_message = await self._execute_request(
                method=http_method,
                url=request_url,
                headers=headers,
                body=request_body,
                timeout=setup.get('timeout_seconds', 30),
                retry_count=setup.get('retry_count', 3)
            )
        except Exception as e:
            logger.error(f"Request execution error: {e}")
            duration_ms = int((time.time() - start_time) * 1000)
            await self._log_execution(
                setup_id=setup_id,
                template_id=str(setup['template_id']),
                request_url=request_url,
                request_method=http_method,
                request_headers=headers,
                request_body=request_body,
                response_status=None,
                response_body=None,
                extracted_variables={},
                duration_ms=duration_ms,
                success=False,
                error_message=str(e),
                executed_by=executed_by
            )
            return ExecutionResult(
                setup_id=setup_id,
                setup_name=setup['name'],
                success=False,
                request_url=request_url,
                request_method=http_method,
                duration_ms=duration_ms,
                error_message=str(e),
                executed_at=datetime.utcnow()
            )

        # Check if status code is expected
        expected_codes = setup.get('expected_status_codes', [200, 201])
        if isinstance(expected_codes, str):
            expected_codes = json.loads(expected_codes)
        
        success = response_status in expected_codes and not error_message

        # Extract variables from response
        extracted_variables = {}
        if success and response_body:
            extractors = setup.get('response_extractors', [])
            if isinstance(extractors, str):
                extractors = json.loads(extractors)
            extracted_variables = self._extract_variables(response_body, extractors)

        duration_ms = int((time.time() - start_time) * 1000)

        # Log execution to history
        await self._log_execution(
            setup_id=setup_id,
            template_id=str(setup['template_id']),
            request_url=request_url,
            request_method=http_method,
            request_headers=headers,
            request_body=request_body,
            response_status=response_status,
            response_body=response_body,
            extracted_variables=extracted_variables,
            duration_ms=duration_ms,
            success=success,
            error_message=error_message,
            executed_by=executed_by
        )

        return ExecutionResult(
            setup_id=setup_id,
            setup_name=setup['name'],
            success=success,
            request_url=request_url,
            request_method=http_method,
            response_status=response_status,
            duration_ms=duration_ms,
            extracted_variables=extracted_variables,
            error_message=error_message,
            executed_at=datetime.utcnow()
        )

    async def execute_setups_for_prompt(
        self,
        prompt_id: str,
        variable_overrides: Optional[Dict[str, Any]] = None,
        executed_by: Optional[str] = None,
        test_execution_id: Optional[str] = None
    ) -> Tuple[bool, Dict[str, Any], List[ExecutionResult]]:
        """
        Execute all data setups linked to a prompt in order.
        Variables from earlier setups are passed to later ones.
        
        Args:
            prompt_id: ID of the prompt/UI test
            variable_overrides: Override variables
            executed_by: User ID
            test_execution_id: Link to the UI test execution
            
        Returns:
            Tuple of (overall_success, combined_variables, list_of_results)
        """
        # Get all linked setups ordered by execution_order
        # Guard: table may not exist if migration 016 hasn't been applied yet
        table_exists = await self.db.fetchval(
            "SELECT to_regclass('api_tests.prompt_data_setups') IS NOT NULL"
        )
        if not table_exists:
            return True, {}, []

        query = """
            SELECT pds.setup_id, s.name
            FROM api_tests.prompt_data_setups pds
            JOIN api_tests.test_data_setups s ON s.id = pds.setup_id
            WHERE pds.prompt_id = $1 AND pds.is_active = true
            ORDER BY pds.execution_order ASC, s.name ASC
        """
        
        setups = await self.db.fetch(query, prompt_id)
        if not setups:
            return True, {}, []

        combined_variables = dict(variable_overrides or {})
        results = []
        all_success = True

        for setup in setups:
            setup_id = str(setup['setup_id'])
            
            # Execute with accumulated variables
            result = await self.execute_setup(
                setup_id=setup_id,
                variable_overrides=combined_variables,
                executed_by=executed_by
            )
            results.append(result)

            if result.success:
                # Add extracted variables to accumulated variables for next setup
                combined_variables.update(result.extracted_variables)
            else:
                all_success = False
                # Optionally stop on failure
                # break

        return all_success, combined_variables, results

    async def execute_multiple_setups(
        self,
        setup_ids: List[str],
        variable_overrides: Optional[Dict[str, Any]] = None,
        executed_by: Optional[str] = None
    ) -> Tuple[bool, Dict[str, Any], List[ExecutionResult]]:
        """
        Execute multiple setups in order, passing variables between them.
        """
        combined_variables = dict(variable_overrides or {})
        results = []
        all_success = True

        for setup_id in setup_ids:
            result = await self.execute_setup(
                setup_id=setup_id,
                variable_overrides=combined_variables,
                executed_by=executed_by
            )
            results.append(result)

            if result.success:
                combined_variables.update(result.extracted_variables)
            else:
                all_success = False

        return all_success, combined_variables, results

    def _substitute_variables(self, template: str, variables: Dict[str, Any]) -> str:
        """Replace {{variable}} placeholders with actual values"""
        def replacer(match):
            var_name = match.group(1)
            value = variables.get(var_name, match.group(0))  # Keep original if not found
            return str(value)
        
        return self._variable_pattern.sub(replacer, template)

    def _substitute_variables_in_dict(self, obj: Any, variables: Dict[str, Any]) -> Any:
        """Recursively substitute variables in a dictionary/list structure"""
        if isinstance(obj, str):
            return self._substitute_variables(obj, variables)
        elif isinstance(obj, dict):
            return {k: self._substitute_variables_in_dict(v, variables) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._substitute_variables_in_dict(item, variables) for item in obj]
        else:
            return obj

    def _add_authentication(
        self, 
        headers: Dict[str, str], 
        auth_type: str, 
        auth_config: Dict[str, Any]
    ) -> Dict[str, str]:
        """Add authentication headers based on auth type"""
        if isinstance(auth_config, str):
            auth_config = json.loads(auth_config)
            
        if auth_type == AuthType.BEARER or auth_type == "bearer":
            token = auth_config.get('token', '')
            if token:
                headers['Authorization'] = f"Bearer {token}"
        
        elif auth_type == AuthType.API_KEY or auth_type == "api_key":
            header_name = auth_config.get('header_name', 'X-API-Key')
            api_key = auth_config.get('api_key', '')
            if api_key:
                headers[header_name] = api_key
        
        elif auth_type == AuthType.BASIC or auth_type == "basic":
            import base64
            username = auth_config.get('username', '')
            password = auth_config.get('password', '')
            if username:
                credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
                headers['Authorization'] = f"Basic {credentials}"
        
        return headers

    async def _execute_request(
        self,
        method: str,
        url: str,
        headers: Dict[str, str],
        body: Optional[Dict[str, Any]],
        timeout: int,
        retry_count: int
    ) -> Tuple[Optional[int], Optional[Dict[str, Any]], Optional[str]]:
        """
        Execute HTTP request with retries.
        
        Returns:
            Tuple of (status_code, response_body, error_message)
        """
        last_error = None
        
        for attempt in range(retry_count + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    # Ensure content-type for JSON body
                    if body and 'Content-Type' not in headers:
                        headers['Content-Type'] = 'application/json'
                    
                    response = await client.request(
                        method=method,
                        url=url,
                        headers=headers,
                        json=body if body else None
                    )
                    
                    # Parse response body
                    response_body = None
                    try:
                        response_body = response.json()
                    except json.JSONDecodeError:
                        response_body = {"_raw_text": response.text[:1000]}
                    
                    return response.status_code, response_body, None
                    
            except httpx.TimeoutException as e:
                last_error = f"Timeout after {timeout}s (attempt {attempt + 1})"
                logger.warning(f"Request timeout (attempt {attempt + 1}): {url}")
            except httpx.RequestError as e:
                last_error = f"Request error: {str(e)} (attempt {attempt + 1})"
                logger.warning(f"Request error (attempt {attempt + 1}): {e}")
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"
                logger.error(f"Unexpected error executing request: {e}")
                break  # Don't retry on unexpected errors
            
            # Wait before retry (exponential backoff)
            if attempt < retry_count:
                await asyncio.sleep(2 ** attempt)
        
        return None, None, last_error

    def _extract_variables(
        self, 
        response_body: Dict[str, Any], 
        extractors: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract variables from response using JSON path expressions"""
        extracted = {}
        
        for extractor in extractors:
            name = extractor.get('name')
            json_path = extractor.get('json_path')
            default_value = extractor.get('default_value')
            required = extractor.get('required', False)
            
            if not name or not json_path:
                continue
            
            try:
                if JSONPATH_AVAILABLE and jsonpath_parse:
                    # Use jsonpath-ng for full JSONPath support
                    jsonpath_expr = jsonpath_parse(json_path)
                    matches = jsonpath_expr.find(response_body)
                    
                    if matches:
                        extracted[name] = matches[0].value
                    elif default_value is not None:
                        extracted[name] = default_value
                    elif required:
                        logger.warning(f"Required extraction '{name}' not found at path '{json_path}'")
                else:
                    # Fallback: simple dot-notation path extraction (e.g., $.data.id -> data.id)
                    value = self._simple_path_extract(response_body, json_path)
                    if value is not None:
                        extracted[name] = value
                    elif default_value is not None:
                        extracted[name] = default_value
                    elif required:
                        logger.warning(f"Required extraction '{name}' not found at path '{json_path}'")
                    
            except Exception as e:
                logger.error(f"Error extracting '{name}' with path '{json_path}': {e}")
                if default_value is not None:
                    extracted[name] = default_value
        
        return extracted

    def _simple_path_extract(self, obj: Any, path: str) -> Any:
        """Simple fallback path extraction without jsonpath-ng"""
        # Remove leading $. if present
        if path.startswith('$.'):
            path = path[2:]
        elif path.startswith('$'):
            path = path[1:]
        
        parts = path.split('.')
        current = obj
        
        for part in parts:
            if not part:
                continue
            if isinstance(current, dict) and part in current:
                current = current[part]
            elif isinstance(current, list) and part.isdigit():
                idx = int(part)
                if 0 <= idx < len(current):
                    current = current[idx]
                else:
                    return None
            else:
                return None
        
        return current

    async def _log_execution(
        self,
        setup_id: str,
        template_id: str,
        request_url: str,
        request_method: str,
        request_headers: Dict[str, str],
        request_body: Optional[Dict[str, Any]],
        response_status: Optional[int],
        response_body: Optional[Dict[str, Any]],
        extracted_variables: Dict[str, Any],
        duration_ms: int,
        success: bool,
        error_message: Optional[str],
        executed_by: Optional[str]
    ):
        """Log execution to history table"""
        try:
            # Redact sensitive headers
            safe_headers = {k: ('***' if 'auth' in k.lower() or 'key' in k.lower() else v) 
                           for k, v in request_headers.items()}
            
            query = """
                INSERT INTO api_tests.execution_history (
                    setup_id, template_id, request_url, request_method,
                    request_headers, request_body, response_status, response_body,
                    extracted_variables, duration_ms, success, error_message, executed_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            """
            await self.db.execute(
                query,
                setup_id,
                template_id,
                request_url,
                request_method,
                json.dumps(safe_headers),
                json.dumps(request_body) if request_body else None,
                response_status,
                json.dumps(response_body) if response_body else None,
                json.dumps(extracted_variables),
                duration_ms,
                success,
                error_message,
                executed_by
            )
        except Exception as e:
            logger.error(f"Failed to log execution history: {e}")


class TestDataTemplateLibrary:
    """
    Pre-built templates for common test data scenarios.
    These can be used as starting points for creating custom templates.
    """
    
    BOOKING_TEMPLATE = {
        "name": "Create Booking",
        "category": "booking",
        "http_method": "POST",
        "path": "/api/v1/bookings",
        "request_body_template": {
            "customer_name": "{{customer_name}}",
            "customer_email": "{{customer_email}}",
            "flight_number": "{{flight_number}}",
            "departure_date": "{{departure_date}}",
            "passengers": "{{passengers}}"
        },
        "expected_status_codes": [200, 201],
        "response_extractors": [
            {"name": "booking_id", "json_path": "$.data.id", "required": True},
            {"name": "booking_reference", "json_path": "$.data.reference", "required": True},
            {"name": "booking_status", "json_path": "$.data.status", "default_value": "confirmed"}
        ]
    }
    
    USER_TEMPLATE = {
        "name": "Create User",
        "category": "user",
        "http_method": "POST",
        "path": "/api/v1/users",
        "request_body_template": {
            "email": "{{user_email}}",
            "password": "{{user_password}}",
            "first_name": "{{first_name}}",
            "last_name": "{{last_name}}"
        },
        "expected_status_codes": [200, 201],
        "response_extractors": [
            {"name": "user_id", "json_path": "$.data.id", "required": True},
            {"name": "auth_token", "json_path": "$.data.token"}
        ]
    }
    
    ORDER_TEMPLATE = {
        "name": "Create Order",
        "category": "order",
        "http_method": "POST",
        "path": "/api/v1/orders",
        "request_body_template": {
            "customer_id": "{{customer_id}}",
            "items": "{{order_items}}",
            "shipping_address": "{{shipping_address}}"
        },
        "expected_status_codes": [200, 201],
        "response_extractors": [
            {"name": "order_id", "json_path": "$.data.id", "required": True},
            {"name": "order_number", "json_path": "$.data.order_number"},
            {"name": "order_total", "json_path": "$.data.total"}
        ]
    }
    
    PAYMENT_TEMPLATE = {
        "name": "Create Payment",
        "category": "payment",
        "http_method": "POST",
        "path": "/api/v1/payments",
        "request_body_template": {
            "order_id": "{{order_id}}",
            "amount": "{{payment_amount}}",
            "payment_method": "{{payment_method}}",
            "card_number": "{{card_number}}"
        },
        "expected_status_codes": [200, 201],
        "response_extractors": [
            {"name": "payment_id", "json_path": "$.data.id", "required": True},
            {"name": "transaction_id", "json_path": "$.data.transaction_id"},
            {"name": "payment_status", "json_path": "$.data.status"}
        ]
    }

    @classmethod
    def get_template(cls, template_type: str) -> Optional[Dict[str, Any]]:
        """Get a pre-built template by type"""
        templates = {
            "booking": cls.BOOKING_TEMPLATE,
            "user": cls.USER_TEMPLATE,
            "order": cls.ORDER_TEMPLATE,
            "payment": cls.PAYMENT_TEMPLATE
        }
        return templates.get(template_type.lower())
    
    @classmethod
    def list_templates(cls) -> List[str]:
        """List available template types"""
        return ["booking", "user", "order", "payment"]
