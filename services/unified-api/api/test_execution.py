"""
Test Execution API - Clean version with proper database integration
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Header, Query
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

import json
import subprocess
import asyncio
import os
import shlex
import contextlib
import tempfile
import time
import uuid
import random
from collections import deque

# Authentication imports
from core.auth import get_current_active_user, get_optional_current_user
from models.auth_models import CurrentUser
import psycopg2
import uuid
from pathlib import Path
import boto3
from botocore.exceptions import ClientError
from core.database import get_database, DatabaseManager
from core.binding_processor import BindingProcessor
from schemas.enterprise import TestBindings, DataBinding
from services.selector_conversion import convert_steps_to_dual_selector_format, SelectorConverter
from services.subscription_limits import enforce_monthly_test_runs_limit, require_active_subscription

# Setup logger
logger = logging.getLogger(__name__)


def _normalize_screenshot_path(raw_path):
    """Convert runner-local screenshot paths to portable web paths when possible."""
    if not raw_path or not isinstance(raw_path, str):
        return raw_path

    normalized = raw_path.replace("\\", "/").strip()
    if not normalized:
        return normalized

    if normalized.startswith("http://") or normalized.startswith("https://"):
        return normalized

    if normalized.startswith("/screenshots/"):
        return normalized

    if normalized.startswith("screenshots/"):
        return f"/{normalized}"

    marker = "/screenshots/"
    marker_index = normalized.lower().rfind(marker)
    if marker_index >= 0:
        filename = normalized[marker_index + len(marker):].lstrip("/")
        if filename:
            return f"/screenshots/{filename}"

    filename = normalized.split("/")[-1]
    if "." in filename:
        return f"/screenshots/{filename}"

    return normalized

router = APIRouter()

# Initialize ECS client
try:
    ecs_client = boto3.client('ecs', region_name=os.getenv('AWS_REGION', 'us-east-2'))
except Exception as e:
    logger.warning(f"Could not initialize ECS client: {e}")
    ecs_client = None

# ECS task rate limiting
_ecs_task_window_seconds = 60
_ecs_max_tasks_per_minute = int(os.getenv("ECS_MAX_TASKS_PER_MINUTE", "10"))
_ecs_task_timestamps: deque = deque()

async def launch_ecs_task_for_test_execution(prompt_id: str, test_steps: List[Dict], execution_id: str, auth_token: str) -> str:
    """
    Launch an ECS task to execute the test steps
    Returns the ECS task ARN
    """
    if not ecs_client:
        raise HTTPException(status_code=500, detail="ECS client not available")
    
    # Rate limit ECS task launches
    now = time.time()
    while _ecs_task_timestamps and now - _ecs_task_timestamps[0] > _ecs_task_window_seconds:
        _ecs_task_timestamps.popleft()
    if len(_ecs_task_timestamps) >= _ecs_max_tasks_per_minute:
        raise HTTPException(status_code=429, detail="Too many test executions. Please wait before launching more.")
    _ecs_task_timestamps.append(now)
    
    try:
        # Create the task definition overrides with environment variables
        task_overrides = {
            'containerOverrides': [
                {
                    'name': 'java-runner',
                    'environment': [
                        {
                            'name': 'UNIFIED_API_URL',
                            'value': os.getenv('UNIFIED_API_URL', 'http://localhost:8000')
                        },
                        {
                            'name': 'API_AUTH_TOKEN',
                            'value': auth_token
                        },
                        {
                            'name': 'EXECUTION_ID',
                            'value': execution_id
                        },
                        {
                            'name': 'PROMPT_ID',
                            'value': prompt_id
                        }
                    ]
                }
            ]
        }
        
        # Create a temporary file with test steps for the Java runner
        import json
        steps_json = json.dumps(test_steps)
        
        # Store steps in environment variable (for small payloads) or upload to S3 (for large payloads)
        if len(steps_json) < 4000:  # Environment variable size limit
            task_overrides['containerOverrides'][0]['environment'].append({
                'name': 'TEST_STEPS_JSON',
                'value': steps_json
            })
        else:
            # Upload to S3 for large payloads and pass the S3 key to the runner
            s3_bucket = os.getenv("TEST_STEPS_S3_BUCKET")
            if not s3_bucket:
                raise HTTPException(
                    status_code=413,
                    detail="Test steps too large for inline transfer. Set TEST_STEPS_S3_BUCKET to enable S3 upload.",
                )
            s3_key = f"test-steps/{execution_id}.json"
            try:
                s3_client = boto3.client("s3", region_name=os.getenv("AWS_REGION", "us-east-2"))
                s3_client.put_object(Bucket=s3_bucket, Key=s3_key, Body=steps_json, ContentType="application/json")
            except ClientError as s3_err:
                logger.error("Failed to upload test steps to S3: %s", s3_err)
                raise HTTPException(status_code=500, detail="Failed to upload test steps to S3") from s3_err
            task_overrides['containerOverrides'][0]['environment'].append({
                'name': 'TEST_STEPS_S3_BUCKET',
                'value': s3_bucket
            })
            task_overrides['containerOverrides'][0]['environment'].append({
                'name': 'TEST_STEPS_S3_KEY',
                'value': s3_key
            })
        
        # Launch the ECS task
        ecs_cluster = os.getenv("ECS_CLUSTER_NAME")
        ecs_task_def = os.getenv("ECS_TASK_DEFINITION", "java-runner-task")
        ecs_subnets = os.getenv("ECS_SUBNETS", "").split(",")
        ecs_security_groups = [sg for sg in os.getenv("ECS_SECURITY_GROUPS", "").split(",") if sg]

        if not ecs_cluster or not ecs_subnets[0]:
            raise HTTPException(
                status_code=500,
                detail="ECS_CLUSTER_NAME and ECS_SUBNETS environment variables must be configured"
            )

        response = ecs_client.run_task(
            cluster=ecs_cluster,
            taskDefinition=ecs_task_def,
            launchType='FARGATE',
            networkConfiguration={
                'awsvpcConfiguration': {
                    'subnets': [s.strip() for s in ecs_subnets if s.strip()],
                    'assignPublicIp': 'ENABLED',
                    'securityGroups': ecs_security_groups
                }
            },
            overrides=task_overrides
        )
        
        task_arn = response['tasks'][0]['taskArn']
        logger.info(f"Launched ECS task for execution {execution_id}: {task_arn}")
        
        return task_arn
        
    except ClientError as e:
        logger.error(f"Failed to launch ECS task: {e}")
        raise HTTPException(status_code=500, detail="Failed to launch test execution")
    except Exception as e:
        logger.error(f"Unexpected error launching ECS task: {e}")
        raise HTTPException(status_code=500, detail="Unexpected error launching test execution")

def determine_test_execution_status(results: Dict, return_code: int) -> str:
    """
    Determine the final test execution status based on the new status system:
    - "pass": All steps passed without any healing needed
    - "failed": Any steps actually failed  
    - "pending_review": No failures, but some elements needed healing
    """
    if return_code != 0:
        return "failed"
    
    if not results or "results" not in results:
        return "failed" if return_code != 0 else "completed"
    
    step_results = results["results"]
    has_failures = False
    has_healing = False
    
    for step_result in step_results:
        status = step_result.get("status", "UNKNOWN")
        healed = step_result.get("healed", False)
        
        # Check for healing attempts regardless of pass/fail
        if healed:
            has_healing = True
        
        # Check if step ultimately failed (even after healing attempt)
        if status == "FAIL":
            has_failures = True
    
    # If healing was attempted, always mark for review (even if execution failed)
    if has_healing:
        return "pending_review"  # Healing occurred - needs review
    elif has_failures:
        return "failed"  # Failed without healing
    else:
        return "pass"  # All steps passed without healing

def determine_step_status(step_result: Dict) -> str:
    """
    Determine individual step status:
    - "passed": Step passed without healing
    - "failed": Step failed without healing attempt
    - "pending_review": Healing was attempted (whether step passed or failed)
    """
    status = step_result.get("status", "UNKNOWN")
    healed = step_result.get("healed", False)
    
    # If healing was attempted, always mark as pending_review for human verification
    if healed:
        return "pending_review"
    elif status == "FAIL":
        return "failed"
    elif status == "PASS":
        return "passed"
    else:
        return "failed"  # Unknown status treated as failure

async def store_steps_with_dual_selectors(
    db: DatabaseManager, 
    test_case_id: str, 
    steps_data: List[Dict[str, Any]], 
    prompt_id: str
):
    """
    Store test steps in tests.test_steps table with dual selector format
    """
    try:
        # Convert steps to dual selector format
        converted_steps = convert_steps_to_dual_selector_format(steps_data)
        
        # Clear existing steps for this test case
        delete_query = "DELETE FROM tests.test_steps WHERE test_case_id = $1"
        await db.execute_command(delete_query, test_case_id)
        
        # Insert new steps with dual selectors
        for i, step in enumerate(converted_steps):
            # Extract dual selectors
            dual_selectors = step.get('dual_selectors', {})
            css_selector = dual_selectors.get('css_selector', '')
            xpath_selector = dual_selectors.get('xpath_selector', '')
            
            # Build step parameters
            step_params = {
                'action': step.get('action', step.get('name', '')),
                'original_step': step,
                'dual_selectors': dual_selectors
            }
            
            # If no dual selectors were created, try to extract selector directly
            if not css_selector and not xpath_selector:
                original_selector = (
                    step.get('target') or 
                    step.get('selector') or 
                    step.get('locator') or
                    (step.get('args', {}) if isinstance(step.get('args'), dict) else {}).get('selector', '') or
                    (step.get('params', {}) if isinstance(step.get('params'), dict) else {}).get('selector', '')
                )
                if original_selector:
                    dual_selectors = SelectorConverter.create_dual_selectors(original_selector)
                    css_selector = dual_selectors.get('css_selector', '')
                    xpath_selector = dual_selectors.get('xpath_selector', '')
            
            insert_query = """
            INSERT INTO tests.test_steps (
                test_case_id,
                step_order,
                action_type,
                css_selector,
                xpath_selector,
                selector_metadata,
                parameters,
                description,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """
            
            await db.execute_command(
                insert_query,
                test_case_id,
                i + 1,  # step_order
                step.get('action', step.get('name', 'unknown')),
                css_selector,
                xpath_selector,
                json.dumps({
                    'original_selector': step.get('original_selector'),
                    'conversion_method': 'ai_generated',
                    'selector_source': 'plan_json'
                }),
                json.dumps(step_params),
                step.get('description', f"Step {i + 1}: {step.get('action', 'unknown')}"),
                'active'
            )
        
    except Exception as e:
        # Don't fail the execution if storage fails
        pass

# Selector Policy Integration Functions
async def get_policy_based_selector(
    prompt_id: str,
    step_index: int,
    step_data: Dict[str, Any],
    db: DatabaseManager
) -> str:
    """Apply selector policy to choose between CSS and XPath selectors for a step.

    Always returns a non-None string (may be empty), falling back to the
    selector/locator present on the step when no DB-mapped selectors exist.
    """
    # Default policy
    prefer_css = True

    try:
        # Get current policy configuration
        policy_query = """
        SELECT context FROM policy.policy_decisions 
        WHERE context->>'config_type' = 'dashboard_config'
        ORDER BY created_at DESC
        LIMIT 1
        """
        policy_result = await db.execute_one(policy_query)

        if policy_result and policy_result.get("context"):
            config_data = json.loads(policy_result["context"])
            locator_healing = config_data.get("configurations", {}).get("locatorHealing", {})
            prefer_css = locator_healing.get("preferCssOverXpath", True)
    except Exception:
        # If policy lookup fails, keep default prefer_css=True
        pass

    css_selector: Optional[str] = None
    xpath_selector: Optional[str] = None
    fallback_selector: Optional[str] = None

    # First try to get dual selectors from tests.test_steps
    try:
        step_query = """
        SELECT ts.css_selector, ts.xpath_selector, ts.parameters
        FROM tests.test_cases tc
        JOIN tests.test_steps ts ON tc.id = ts.test_case_id
        WHERE tc.source_ref_id = $1::uuid
        ORDER BY ts.step_order
        LIMIT 1 OFFSET $2
        """
        step_result = await db.execute_one(step_query, prompt_id, step_index)

        if step_result:
            css_selector = step_result.get("css_selector")
            xpath_selector = step_result.get("xpath_selector")

            if not css_selector and not xpath_selector:
                params = step_result.get("parameters", {})
                if isinstance(params, str):
                    params = json.loads(params)
                if isinstance(params, dict):
                    fallback_selector = params.get("selector")
    except Exception:
        # Ignore DB lookup issues; we'll fall back to step data below
        pass

    # If DB did not provide selectors, fall back to dual_selectors or single selector on the step
    if not css_selector and not xpath_selector and not fallback_selector:
        dual_selectors = step_data.get("dual_selectors") or {}
        if isinstance(dual_selectors, dict):
            css_selector = dual_selectors.get("css_selector") or css_selector
            xpath_selector = dual_selectors.get("xpath_selector") or xpath_selector

    if not css_selector and not xpath_selector and not fallback_selector:
        fallback_selector = (
            step_data.get("selector")
            or step_data.get("locator")
            or step_data.get("target", "")
        )

    # Apply policy to choose selector
    selected_selector: Optional[str] = None
    selector_type: Optional[str] = None

    try:
        if prefer_css:
            if css_selector:
                selected_selector = css_selector
                selector_type = "css"
            elif xpath_selector:
                selected_selector = xpath_selector
                selector_type = "xpath"
            elif fallback_selector:
                if (
                    fallback_selector.startswith("//")
                    or "[@" in fallback_selector
                    or "/html" in fallback_selector
                ):
                    selected_selector = fallback_selector
                    selector_type = "xpath"
                else:
                    selected_selector = fallback_selector
                    selector_type = "css"
        else:
            if xpath_selector:
                selected_selector = xpath_selector
                selector_type = "xpath"
            elif css_selector:
                selected_selector = css_selector
                selector_type = "css"
            elif fallback_selector:
                if (
                    fallback_selector.startswith("//")
                    or "[@" in fallback_selector
                    or "/html" in fallback_selector
                ):
                    selected_selector = fallback_selector
                    selector_type = "xpath"
                else:
                    selected_selector = fallback_selector
                    selector_type = "css"

        if selected_selector:
            try:
                await log_selector_policy_decision(
                    prompt_id,
                    step_index,
                    css_selector,
                    xpath_selector,
                    selected_selector,
                    selector_type or ("css" if prefer_css else "xpath"),
                    prefer_css,
                    db,
                )
            except Exception:
                # Logging should not break execution
                pass
    except Exception:
        # If anything goes wrong in policy application, fall back to raw step selector
        selected_selector = None

    if selected_selector:
        return selected_selector

    # Final fallback: original selector/locator/target on the step
    return (
        step_data.get("selector")
        or step_data.get("locator")
        or step_data.get("target", "")
    )

async def log_selector_policy_decision(
    prompt_id: str,
    step_index: int,
    css_selector: Optional[str],
    xpath_selector: Optional[str],
    selected_selector: str,
    selector_type: str,
    prefer_css: bool,
    db: DatabaseManager
):
        insert_query = """
        INSERT INTO analytics.selector_policy_decisions (
            prompt_id, step_index, css_selector, xpath_selector,
            selected_selector, selector_type, policy_preference,
            has_fallback, context
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """
        
        has_fallback = bool(css_selector and xpath_selector)
        policy_preference = 'css' if prefer_css else 'xpath'
        context_data = {
            'timestamp': datetime.now().isoformat(),
            'execution_context': 'test_execution_api',
            'policy_applied': True
        }
        
        await db.execute_command(
            insert_query,
            uuid.UUID(prompt_id) if prompt_id else None,
            step_index,
            css_selector,
            xpath_selector,
            selected_selector,
            selector_type,
            policy_preference,
            has_fallback,
            json.dumps(context_data)
        )

async def get_db() -> DatabaseManager:
    """Get database dependency"""
    return await get_database()

@router.post("/rerun-execution/{execution_id}")
async def rerun_execution(
    execution_id: str,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
    browser: Optional[str] = Query(default=None, description="Specific browser to rerun: chrome, firefox, edge, safari, chrome-mobile, chrome-tablet, appium-*"),
    device_profile_id: Optional[str] = Query(default=None, description="Device profile UUID for mobile/tablet emulation"),
    appium_config_id: Optional[str] = Query(default=None, description="Appium config UUID for Appium-based testing"),
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Rerun a specific execution on a specific browser"""
    logger.info(f"=== RERUN EXECUTION REQUEST ===")
    logger.info(f"Execution ID: {execution_id}")
    logger.info(f"Browser: {browser}")
    
    try:
        # Get the original execution details
        exec_query = """
        SELECT r.id, r.test_case_id, r.device_config, tc.plan_id, p.prompt_id
        FROM exec.runs r
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        LEFT JOIN planner.plans p ON tc.plan_id = p.id
        WHERE r.id = $1
        """
        exec_result = await db.execute_one(exec_query, execution_id)
        
        if not exec_result:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        prompt_id = exec_result['prompt_id']
        if not prompt_id:
            raise HTTPException(status_code=400, detail="Cannot rerun: original prompt not found")
        
        # Use the same execute logic but with browser override
        logger.info(f"Rerunning prompt {prompt_id} on browser {browser}")
        
        # Call the main execute_prompt function with browser parameter
        return await execute_prompt(
            prompt_id=prompt_id,
            background_tasks=background_tasks,
            authorization=authorization,
            browser=browser,
            device_profile_id=device_profile_id,
            appium_config_id=appium_config_id,
            db=db,
            current_user=current_user
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rerunning execution: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute-prompt/{prompt_id}")
async def execute_prompt(
    prompt_id: str,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
    browser: Optional[str] = Query(default=None, description="Browser type: chrome, firefox, edge, safari, chrome-mobile, chrome-tablet, appium-*"),
    runner_id: Optional[str] = Query(default=None, description="Target runner agent ID. When set, forces agent dispatch mode and assigns work to this specific runner."),
    device_profile_id: Optional[str] = Query(default=None, description="Device profile UUID for mobile/tablet emulation"),
    appium_config_id: Optional[str] = Query(default=None, description="Appium config UUID for Appium-based testing"),
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Execute a test based on a prompt"""
    logger.info(f"=== EXECUTE PROMPT REQUEST ===")
    logger.info(f"Prompt ID: {prompt_id}")
    logger.info(f"Authorization header present: {bool(authorization)}")
    logger.info(f"Current user: {current_user.user.email}")
    
    try:
        # Get the plan details from database (using existing planner.plans table)
        logger.info("Querying database for plan details...")
        
        # First, let's see what plans exist in the database
        debug_query = """
        SELECT prompt_id, status, created_at 
        FROM planner.plans 
        ORDER BY created_at DESC 
        LIMIT 5
        """
        try:
            debug_results = await db.fetch(debug_query)  # Use fetch() to get rows, not execute()
            logger.info(f"Recent plans in database: {len(debug_results) if debug_results else 0} records found")
            logger.info(f"Debug results type: {type(debug_results)}")
            if debug_results and len(debug_results) > 0:
                logger.info(f"First result type: {type(debug_results[0])}")
                logger.info(f"First result: {dict(debug_results[0])}")
                for i, result in enumerate(debug_results):
                    row_dict = dict(result)
                    logger.info(f"Plan {i+1}: prompt_id={row_dict.get('prompt_id', 'N/A')}, status={row_dict.get('status', 'N/A')}")
            else:
                logger.info("No plans found in database - this confirms the save endpoint issue")
        except Exception as e:
            logger.error(f"Debug query failed: {e}")
            logger.info("Continuing with execution despite debug query failure")
        
        plan_query = """
        SELECT 
            p.id,
            p.prompt_id,
            p.status,
            p.plan_json,
            p.platform_variants,
            p.created_at
        FROM planner.plans p
        WHERE p.prompt_id = $1
        ORDER BY p.created_at DESC
        LIMIT 1
        """
        
        plan_result = await db.execute_one(plan_query, prompt_id)
        logger.info(f"Plan query result: {bool(plan_result)}")
        
        if not plan_result:
            logger.error(f"No plan found for prompt ID: {prompt_id}")
            raise HTTPException(status_code=404, detail="Plan not found for this prompt")
        
        # Extract steps from plan_json
        logger.info("Parsing plan JSON...")
        import json
        try:
            plan_data = json.loads(plan_result['plan_json'])
            steps_data = plan_data.get('steps', [])
            logger.info(f"Found {len(steps_data)} shared steps in plan")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse plan JSON: {e}")
            raise HTTPException(status_code=500, detail="Invalid plan data format")

        # Resolve platform-specific steps when running with an Appium config
        if appium_config_id and plan_result.get('platform_variants'):
            try:
                variants = plan_result['platform_variants']
                if isinstance(variants, str):
                    variants = json.loads(variants)
                # Determine platform from the Appium config
                config_row = await db.execute_one(
                    "SELECT config_type FROM exec.appium_configs WHERE id = $1::uuid",
                    appium_config_id,
                )
                if config_row:
                    cfg_type = config_row['config_type'] or ''
                    if 'android' in cfg_type and variants.get('android'):
                        platform_steps = variants['android']
                        logger.info(f"Appending {len(platform_steps)} Android-specific steps")
                        steps_data = steps_data + platform_steps
                    elif 'ios' in cfg_type and variants.get('ios'):
                        platform_steps = variants['ios']
                        logger.info(f"Appending {len(platform_steps)} iOS-specific steps")
                        steps_data = steps_data + platform_steps
            except Exception as e:
                logger.warning(f"Failed to resolve platform variants: {e}")
        
        # Fix corrupted XPath selectors in existing plan data
        logger.info("Processing and fixing selectors...")
        for step in steps_data:
            if 'dual_selectors' in step and step['dual_selectors']:
                xpath_selector = step['dual_selectors'].get('xpath_selector', '')
                if xpath_selector and '@@' in xpath_selector:
                    # Fix double @@ to single @
                    corrected_xpath = xpath_selector.replace('@@', '@')
                    step['dual_selectors']['xpath_selector'] = corrected_xpath
                    logger.debug(f"Fixed XPath: {xpath_selector} -> {corrected_xpath}")
                    step['dual_selectors']['xpath_selector'] = corrected_xpath
        
        # Load active data bindings from datahub.data_bindings table for this specific prompt
        logger.info("Loading active data bindings...")
        active_bindings = []
        try:
            bindings_query = """
                SELECT name, binding_type, source_config, schema_definition 
                FROM datahub.data_bindings 
                WHERE is_active = true 
                ORDER BY created_at DESC
            """
            db_bindings = await db.fetch(bindings_query)
            logger.info(f"Found {len(db_bindings) if db_bindings else 0} active bindings")
            
            if db_bindings:
                for binding in db_bindings:
                    binding_dict = dict(binding)  # Convert asyncpg.Record to dict
                    source_config = binding_dict.get('source_config', {})
                    schema_definition = binding_dict.get('schema_definition', {})
                    
                    # Extract binding information
                    var_name = binding_dict.get('name', 'unknown')
                    var_type = schema_definition.get('type', 'text') if isinstance(schema_definition, dict) else 'text'
                    category = schema_definition.get('category', 'data') if isinstance(schema_definition, dict) else 'data'
                    
                    # Create binding data structure
                    binding_data = {
                        "name": var_name,
                        "type": var_type,
                        "category": category,
                        "selector": source_config.get('selector', '') if isinstance(source_config, dict) else '',
                        "extract_type": source_config.get('extract_type', 'text') if isinstance(source_config, dict) else 'text',
                        "formula": source_config.get('formula', '') if isinstance(source_config, dict) else ''
                    }
                    active_bindings.append(binding_data)
        except Exception as e:
            active_bindings = []
        
        # Debug logging to see what we're actually loading} steps in database"))}")} bindings")
        
        if not steps_data:
            raise HTTPException(status_code=400, detail="No steps found in the plan. Please generate steps first.")

        # Initialize test_steps array for processing
        test_steps = []
        
        # Initialize variable mapping for binding names
        variable_mapping = {}
        
        # Build variable mapping from bindings
        for binding in active_bindings:
            if binding.get('category') == 'price' or binding.get('extract_type') != 'calculated':
                variable_mapping[binding['name']] = binding['name']
            elif binding.get('type') == "extract":
                variable_mapping[binding['name']] = binding['name']
        
        # Process each step and convert to test_steps format
        for i, step in enumerate(steps_data):
            processed_step = step.copy()
            
            def process_variable_step(step_data):
                """Convert variable assertion steps to extraction/validation steps"""
                
                # Check if this is an assert_text step with variables
                action = step_data.get('action', step_data.get('name', ''))
                text_value = None
                
                # Get text value from different step formats
                if 'args' in step_data:
                    text_value = step_data['args'].get('text', '')
                elif 'params' in step_data:
                    text_value = step_data['params'].get('text', '')
                else:
                    text_value = step_data.get('text', '')
                
                # Check for any ${variableName} pattern
                import re
                variable_pattern = r'\$\{([^}]+)\}'
                variables_found = re.findall(variable_pattern, str(text_value)) if text_value else []
                
                # If this is an assert_text step with any variable pattern
                if action == 'assert_text' and isinstance(text_value, str) and variables_found:
                    modified_step = step_data.copy()
                    new_text = text_value
                    
                    # Process each variable found
                    for variable_name in variables_found:
                        # Variable replacement is now handled by Java runner during execution
                        if active_bindings:
                            # Check if this variable is defined in our bindings
                            for binding in active_bindings:
                                if binding['name'] == variable_name:
                                    break
                    
                    # Keep the original text with variables for Java runner to process
                    
                    # Update the text value in the appropriate format (keep original with variables)
                    if 'args' in modified_step:
                        modified_step['args']['text'] = text_value  # Keep original text with variables
                    elif 'params' in modified_step:
                        modified_step['params']['text'] = text_value  # Keep original text with variables
                    else:
                        modified_step['text'] = text_value  # Keep original text with variables
                    
                    return modified_step
                else:
                    # Return the original step if no processing needed
                    return step_data
            
            # Apply variable processing
            processed_step = process_variable_step(processed_step)
            action = processed_step.get('action', processed_step.get('name', ''))
            
            # Map actions to Java runner expected format
            if action in ("open_url", "navigate"):
                action = "open"
            elif action in ("assert_visible", "assert_element"):
                action = "verify_element"
            elif action == "assert_text":
                action = "verify_text"
            elif action in ("enter_text",):
                action = "type"
            elif action in ("wait_for", "wait_for_page_load"):
                action = "wait"
            elif action in ("scroll_to",):
                action = "scroll"
            elif action in ("hover_over",):
                action = "hover"
            # screenshot, extract_data, calculate kept as-is
            
            # Special handling for extract_data steps
            if action == 'extract_data':
                if 'args' in processed_step:
                    step_args = processed_step.get('args', {})
                    variable_name = step_args.get('variable', step_args.get('data', ''))
                    # Apply selector policy - pass full step to access dual_selectors
                    locator = await get_policy_based_selector(prompt_id, i, processed_step, db)
                    element_index = step_args.get('element_index') or step_args.get('index')  # Get element_index or index if present
                elif 'params' in processed_step:
                    step_params = processed_step.get('params', {})
                    variable_name = step_params.get('variable', step_params.get('data', ''))
                    # Apply selector policy - pass full step to access dual_selectors
                    locator = await get_policy_based_selector(prompt_id, i, processed_step, db)
                    element_index = step_params.get('element_index') or step_params.get('index')  # Get element_index or index if present
                else:
                    variable_name = processed_step.get('variable', processed_step.get('data', ''))
                    locator = processed_step.get('selector', processed_step.get('locator', ''))
                    element_index = processed_step.get('element_index') or processed_step.get('index')
                
                # Build the data field with element_index if present
                data_field = variable_name
                if element_index is not None:
                    # Include element_index in the data field as JSON for Java parsing
                    import json
                    data_field = json.dumps({"variable": variable_name, "index": element_index})
                test_steps.append({
                    "step_id": f"step_{i+1}",
                    "action": action,
                    "locator": locator,
                    "value": data_field,  # For extract_data, put variable name and index in value field
                    "description": f"Extract data into variable: {variable_name}" + (f" (index {element_index})" if element_index is not None else "")
                })
                
            # Special handling for calculate steps
            elif action == 'calculate':
                if 'args' in processed_step:
                    step_args = processed_step.get('args', {})
                    formula = step_args.get('formula', step_args.get('text', ''))
                    result_var = step_args.get('result_variable', step_args.get('data', ''))
                elif 'params' in processed_step:
                    step_params = processed_step.get('params', {})
                    formula = step_params.get('formula', step_params.get('text', ''))
                    result_var = step_params.get('result_variable', step_params.get('data', ''))
                else:
                    formula = processed_step.get('formula', processed_step.get('text', ''))
                    result_var = processed_step.get('result_variable', processed_step.get('data', ''))
                
                # If no explicit result variable, try to extract from formula
                if not result_var and formula and '=' in formula:
                    result_var = formula.split('=')[0].strip()
                
                test_steps.append({
                    "step_id": f"step_{i+1}",
                    "action": action,
                    "locator": formula,  # Put formula in locator field for Java runner
                    "value": result_var,  # Put result variable name in value field
                    "description": f"Calculate: {formula}"
                })# Handle other step formats normally
            elif 'args' in processed_step:
                # New AI format with 'args'
                step_args = processed_step.get('args', {})
                # Apply selector policy - pass full step to access dual_selectors
                policy_locator = await get_policy_based_selector(prompt_id, i, processed_step, db)
                test_steps.append({
                    "step_id": f"step_{i+1}",
                    "action": action,
                    "locator": step_args.get('selector', step_args.get('locator', '')),
                    "value": step_args.get('text', '') or step_args.get('url', '') or step_args.get('value', ''),
                    "description": step_args.get('description', '')
                })
            elif 'params' in processed_step:
                # Another format with 'params'
                step_params = processed_step.get('params', {})
                # Apply selector policy - pass full step to access dual_selectors
                policy_locator = await get_policy_based_selector(prompt_id, i, processed_step, db)
                test_steps.append({
                    "step_id": f"step_{i+1}",
                    "action": processed_step.get('name', action),
                    "locator": step_params.get('selector', step_params.get('locator', '')),
                    "value": step_params.get('text', '') or step_params.get('url', '') or step_params.get('value', ''),
                    "description": step_params.get('description', '')
                })
            else:
                # Direct format
                test_steps.append({
                    "step_id": f"step_{i+1}",
                    "action": action,
                    "locator": processed_step.get('selector', processed_step.get('locator', '')),
                    "value": processed_step.get('text', '') or processed_step.get('url', '') or processed_step.get('value', ''),
                    "description": processed_step.get('description', '')
                })
        
        # Extract auth token from Authorization header
        auth_token = None
        if authorization and authorization.startswith("Bearer "):
            auth_token = authorization[7:]  # Remove "Bearer " prefix
        
        logger.info(f"Starting test execution for prompt {prompt_id} with {len(test_steps)} steps")

        # Fetch policy configuration before mapping steps so selector policy is always defined
        policy_config: Dict[str, Any] = {}
        preferred_browsers: List[str] = []
        try:
            policy_query = """
            SELECT context FROM policy.policy_decisions 
            WHERE context->>'config_type' = 'dashboard_config'
            ORDER BY created_at DESC
            LIMIT 1
            """
            policy_result = await db.execute_one(policy_query)

            if policy_result and policy_result.get("context"):
                config_data = json.loads(policy_result["context"])
                configurations = config_data.get("configurations", {})
                locator_healing = configurations.get("locatorHealing", {})
                execution_safety = configurations.get("executionSafety", {})
                multi_outcome = configurations.get("multiOutcomeHandling", {})

                # Convert confidence threshold from 0-1 to 0-100 if needed
                confidence_raw = locator_healing.get("confidenceThreshold", 0.85)
                confidence_value = int(confidence_raw * 100) if confidence_raw <= 1.0 else int(confidence_raw)

                # Get preferred browsers from policy
                preferred_browsers = execution_safety.get("preferredBrowsers", ["chrome"])
                if not preferred_browsers:
                    preferred_browsers = ["chrome"]

                policy_config = {
                    "confidenceThreshold": confidence_value,
                    "maxRetries": int(locator_healing.get("maxRetries", 2)),
                    "maxCandidates": int(multi_outcome.get("maxCandidates", 5)),
                    "useRepositoryFallback": bool(locator_healing.get("useRepositoryFallback", True)),
                    "preferCssOverXpath": bool(locator_healing.get("preferCssOverXpath", True)),
                    "blockDestructiveActions": bool(execution_safety.get("blockDestructiveActions", True)),
                    "allowTestModeOverride": bool(execution_safety.get("allowTestModeOverride", True)),
                    "destructiveKeywords": execution_safety.get("requireConfirmationKeywords", ["delete", "remove", "submit payment"])
                }
                logger.info(f"Loaded policy config: {policy_config}")
                logger.info(f"Preferred browsers from policy: {preferred_browsers}")
            else:
                # Use default policy config
                preferred_browsers = ["chrome"]
                policy_config = {
                    "confidenceThreshold": 85,
                    "maxRetries": 2,
                    "maxCandidates": 5,
                    "useRepositoryFallback": True,
                    "preferCssOverXpath": True,
                    "blockDestructiveActions": True,
                    "allowTestModeOverride": True,
                    "destructiveKeywords": ["delete", "remove", "submit payment"]
                }
                logger.info("Using default policy config (no dashboard_config found)")
        except Exception as e:
            logger.error(f"Failed to load policy config, using safe defaults: {e}")
            preferred_browsers = ["chrome"]
            policy_config = {
                "confidenceThreshold": 85,
                "maxRetries": 2,
                "maxCandidates": 5,
                "useRepositoryFallback": True,
                "preferCssOverXpath": True,
                "blockDestructiveActions": True,
                "allowTestModeOverride": True,
                "destructiveKeywords": ["delete", "remove", "submit payment"]
            }
        
        # Determine which browsers to run (priority: query param > test case config > suite config > policy config)
        if browser:
            # Query parameter override (for reruns or manual selection)
            browsers_to_run = [browser]
            logger.info(f"Using query param browser override: {browser}")
        else:
            # Check if this prompt has an associated test case with browser config
            test_case_browser_config = None
            suite_browser_config = None
            
            try:
                # Look up test case and suite browser configurations
                tc_query = """
                SELECT 
                    tc.browser_config as test_case_config,
                    ts.browser_config as suite_config
                FROM planner.plans p
                LEFT JOIN tests.test_cases tc ON tc.plan_id = p.id
                LEFT JOIN tests.test_suites ts ON tc.suite_id = ts.id
                WHERE p.prompt_id = $1
                ORDER BY tc.created_at DESC
                LIMIT 1
                """
                tc_result = await db.execute_one(tc_query, prompt_id)
                
                if tc_result:
                    if tc_result.get('test_case_config'):
                        test_case_browser_config = json.loads(tc_result['test_case_config']) if isinstance(tc_result['test_case_config'], str) else tc_result['test_case_config']
                    if tc_result.get('suite_config'):
                        suite_browser_config = json.loads(tc_result['suite_config']) if isinstance(tc_result['suite_config'], str) else tc_result['suite_config']
            except Exception as e:
                logger.warning(f"Could not fetch test case/suite browser config: {e}")
            
            # Apply priority order
            if test_case_browser_config and test_case_browser_config.get('browsers'):
                browsers_to_run = test_case_browser_config['browsers']
                logger.info(f"Using test case browser config: {browsers_to_run}")
            elif suite_browser_config and suite_browser_config.get('browsers'):
                browsers_to_run = suite_browser_config['browsers']
                logger.info(f"Using suite browser config: {browsers_to_run}")
            else:
                browsers_to_run = preferred_browsers
                logger.info(f"Using policy-configured browsers: {browsers_to_run}")

        # Enforce monthly execution quota before starting browser runs.
        if current_user and current_user.tenant and current_user.tenant.id:
            tenant_id_str = str(current_user.tenant.id)
            # Hard-block if subscription is canceled/expired
            await require_active_subscription(db, tenant_id_str)
            await enforce_monthly_test_runs_limit(
                db,
                tenant_id_str,
                additional_runs=len(browsers_to_run),
            )

        # Resolve device profile for mobile/tablet emulation
        device_config = None
        if device_profile_id:
            org_id = str(current_user.tenant.id) if current_user.tenant else "00000000-0000-0000-0000-000000000000"
            dp_row = await db.execute_one(
                """SELECT device_name, device_type, width, height, device_scale_factor,
                          user_agent, is_mobile, has_touch, is_landscape
                   FROM exec.device_profiles
                   WHERE id = $1 AND organization_id IN ($2, '00000000-0000-0000-0000-000000000000')""",
                device_profile_id, org_id,
            )
            if dp_row:
                device_config = {
                    "device_name": dp_row["device_name"],
                    "device_type": dp_row["device_type"],
                    "width": dp_row["width"],
                    "height": dp_row["height"],
                    "device_scale_factor": float(dp_row["device_scale_factor"]),
                    "user_agent": dp_row["user_agent"],
                    "is_mobile": dp_row["is_mobile"],
                    "has_touch": dp_row["has_touch"],
                    "is_landscape": dp_row["is_landscape"],
                }
                # Auto-set browser to chrome-mobile/chrome-tablet if not explicitly specified
                if not browser:
                    auto_browser = "chrome-tablet" if dp_row["device_type"] == "tablet" else "chrome-mobile"
                    browsers_to_run = [auto_browser]
                    logger.info(f"Auto-selected browser {auto_browser} for device profile {dp_row['device_name']}")
                logger.info(f"Device profile resolved: {dp_row['device_name']} ({dp_row['width']}x{dp_row['height']})")
            else:
                logger.warning(f"Device profile {device_profile_id} not found, proceeding without mobile emulation")

        # Resolve Appium configuration
        appium_config = None
        if appium_config_id:
            org_id = str(current_user.tenant.id) if current_user.tenant else "00000000-0000-0000-0000-000000000000"
            ac_row = await db.execute_one(
                """SELECT config_type, appium_server_url, platform_name, platform_version,
                          device_name, automation_name, app_path, app_package,
                          app_activity, bundle_id, browser_name,
                          cloud_provider, cloud_username, cloud_access_key,
                          extra_capabilities
                   FROM exec.appium_configs
                   WHERE id = $1 AND organization_id IN ($2, '00000000-0000-0000-0000-000000000000')""",
                appium_config_id, org_id,
            )
            if ac_row:
                appium_config = {k: v for k, v in dict(ac_row).items() if v is not None}
                # Ensure extra_capabilities is a proper dict, not a JSON string
                if 'extra_capabilities' in appium_config:
                    ec = appium_config['extra_capabilities']
                    if isinstance(ec, str):
                        try:
                            appium_config['extra_capabilities'] = json.loads(ec)
                        except (json.JSONDecodeError, TypeError):
                            appium_config['extra_capabilities'] = {}
                # Auto-select the matching browser type from config_type
                type_to_browser = {
                    "android-web": "appium-android-web",
                    "ios-web": "appium-ios-web",
                    "android-native": "appium-android-native",
                    "ios-native": "appium-ios-native",
                    "flutter": "appium-flutter",
                    "windows": "appium-windows",
                    "mac": "appium-mac",
                }
                if not browser:
                    auto_browser = type_to_browser.get(ac_row["config_type"], "appium-android-web")
                    browsers_to_run = [auto_browser]
                    logger.info(f"Auto-selected browser {auto_browser} for Appium config type {ac_row['config_type']}")
                logger.info(f"Appium config resolved: {ac_row['config_type']} → {ac_row['appium_server_url']}")
            else:
                logger.warning(f"Appium config {appium_config_id} not found, proceeding without Appium")

        # Call Java runner service directly (much faster than ECS tasks)
        dispatch_mode = os.getenv("DISPATCH_MODE", "push")  # "push" or "agent"

        # If a specific runner_id is provided, force agent mode
        if runner_id:
            dispatch_mode = "agent"
            # Validate runner exists and belongs to this org
            runner_row = await db.execute_one(
                "SELECT id, status FROM exec.runners WHERE id = $1 AND organization_id = $2",
                runner_id, str(current_user.tenant.id),
            )
            if not runner_row:
                raise HTTPException(status_code=404, detail=f"Runner {runner_id} not found in your organization")
            logger.info(f"Targeting specific runner: {runner_id}")

        # Agent mode: queue executions for remote runner agents to pick up via polling
        if dispatch_mode == "agent":
            logger.info("Dispatch mode: agent — queueing executions for runner poll")
            all_executions = []

            for browser_type in browsers_to_run:
                browser_execution_id, browser_step_ids = await create_execution_record(
                    db, prompt_id, test_steps, current_user, browser_type=browser_type
                )

                # Store mapped steps into step_results so the runner can fetch them
                for i, step in enumerate(test_steps):
                    if i < len(browser_step_ids):
                        await db.execute_one(
                            """
                            UPDATE exec.step_results
                            SET action_data = $2
                            WHERE id = $1
                            """,
                            browser_step_ids[i],
                            json.dumps({
                                "action": step.get("action", ""),
                                "locator": step.get("locator", ""),
                                "value": step.get("value", ""),
                                "description": step.get("description", ""),
                            }),
                        )

                # Mark the run as queued for agent pickup
                await db.execute_one(
                    """
                    UPDATE exec.runs
                    SET status = 'queued',
                        dispatch_mode = 'agent',
                        assigned_runner_id = $3,
                        device_config = $4,
                        runner_meta = $2
                    WHERE id = $1
                    """,
                    browser_execution_id,
                    json.dumps({
                        "prompt_id": prompt_id,
                        "policy_config": policy_config,
                        "steps_count": len(test_steps),
                        "execution_type": "agent_queued",
                        "browser": browser_type,
                        "device_config": device_config,
                        "appium_config": appium_config,
                        "target_runner_id": runner_id,
                    }),
                    runner_id,  # NULL if not targeting a specific runner
                    json.dumps(device_config) if device_config else None,
                )

                all_executions.append({
                    "browser": browser_type,
                    "execution_id": browser_execution_id,
                    "status": "queued",
                    "dispatch_mode": "agent",
                    "success": True,
                })
                logger.info(f"Queued execution {browser_execution_id} for {browser_type} (agent pickup)")

            return {
                "success": True,
                "message": f"Test execution queued on {len(all_executions)}/{len(browsers_to_run)} browsers (agent mode)",
                "executions": all_executions,
                "successful_count": len(all_executions),
                "failed_count": 0,
                "steps_count": len(test_steps),
                "prompt_text": f"Plan execution for prompt {prompt_id}",
                "dispatch_mode": "agent",
            }

        # Push mode (default): call Java runner directly via HTTP
        try:
            import httpx

            # Use local Java runner for development
            java_runner_url = os.getenv("JAVA_RUNNER_URL", "http://localhost:8080")
            target_url = f"{java_runner_url}/api/v1/execute"
            logger.info(f"Using Java runner at: {java_runner_url}")

            # Apply action mapping to steps before sending to Java runner
            mapped_steps = []
            action_mapping = {
                # Navigation actions
                "open_url": "open",
                "navigate": "open",
                
                # Element interaction actions
                "click": "click",
                "type": "type",
                "enter_text": "type",
                "select": "select",
                
                # Verification/assertion actions
                "assert_visible": "verify_element",
                "assert_element": "verify_element",
                "verify_element": "verify_element",
                "assert_text": "verify_text",
                "verify_text": "verify_text",
                
                # Wait actions
                "wait_for": "wait",
                "wait": "wait",
                
                # Data extraction and calculation
                "extract_data": "extract_data",
                "calculate": "calculate",
                
                # Screenshot
                "screenshot": "screenshot"
            }
            
            logger.info(f"Starting step mapping. test_steps count: {len(test_steps)}")

            # Determine selector policy from configuration
            selector_policy_value = "css" if policy_config.get("preferCssOverXpath", True) else "xpath"
            logger.info(f"Applying selector policy: {selector_policy_value} (preferCssOverXpath={policy_config.get('preferCssOverXpath')})")
            
            for i, step in enumerate(test_steps):
                mapped_step = step.copy()  # Create a copy to avoid modifying original
                original_action = step["action"]
                if original_action in action_mapping:
                    mapped_step["action"] = action_mapping[original_action]
                    logger.info(f"Step {i+1}: Mapped action '{original_action}' -> '{mapped_step['action']}'")
                else:
                    logger.info(f"Step {i+1}: Action '{original_action}' passed through unchanged")
                
                # Apply selector policy to each step
                mapped_step["selectorPolicy"] = selector_policy_value
                
                mapped_steps.append(mapped_step)
                
            logger.info(f"Final mapped_steps count: {len(mapped_steps)}")

            # Execute test on each selected browser
            all_executions = []
            
            for browser_type in browsers_to_run:
                # Create a separate execution record for each browser
                browser_execution_id, browser_step_ids = await create_execution_record(
                    db, prompt_id, test_steps, current_user, browser_type=browser_type
                )
                
                # Remap steps with the new step IDs for this execution
                browser_mapped_steps = []
                for i, step in enumerate(mapped_steps):
                    browser_step = step.copy()
                    if i < len(browser_step_ids):
                        browser_step["id"] = browser_step_ids[i]
                    browser_mapped_steps.append(browser_step)
                
                execution_request = {
                    "promptId": prompt_id,
                    "executionId": browser_execution_id,
                    "steps": browser_mapped_steps,
                    "authToken": auth_token or "",
                    "policyConfig": policy_config,
                    "browserType": browser_type,
                    "deviceConfig": device_config,
                    "appiumConfig": appium_config
                }
                
                logger.info(f"Calling Java runner for browser: {browser_type} at: {target_url}")
                logger.info(f"Request payload - promptId: {prompt_id}, browser: {browser_type}, steps count: {len(test_steps)}")
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    try:
                        response = await client.post(
                            target_url,
                            json=execution_request,
                            timeout=60.0
                        )
                        
                        logger.info(f"Java runner response for {browser_type} - Status: {response.status_code}")
                        
                        if response.status_code == 200:
                            result = response.json()
                            all_executions.append({
                                "browser": browser_type,
                                "execution_id": browser_execution_id,
                                "java_runner_execution_id": result.get("executionId"),
                                "status": result.get("status"),
                                "success": True
                            })
                            logger.info(f"Successfully started execution on {browser_type}: {browser_execution_id}")
                        else:
                            response_text = response.text if hasattr(response, 'text') else str(response.content)
                            logger.error(f"Java runner failed for {browser_type} - Status: {response.status_code}, Response: {response_text}")
                            all_executions.append({
                                "browser": browser_type,
                                "execution_id": browser_execution_id,
                                "status": "failed",
                                "error": response_text,
                                "success": False
                            })
                    except Exception as e:
                        logger.error(f"Error executing on {browser_type}: {e}")
                        all_executions.append({
                            "browser": browser_type,
                            "execution_id": browser_execution_id,
                            "status": "error",
                            "error": str(e),
                            "success": False
                        })
            
            # Return results for all browsers
            successful_executions = [e for e in all_executions if e["success"]]
            failed_executions = [e for e in all_executions if not e["success"]]
            
            return {
                "success": len(successful_executions) > 0,
                "message": f"Test execution started on {len(successful_executions)}/{len(browsers_to_run)} browsers",
                "executions": all_executions,
                "successful_count": len(successful_executions),
                "failed_count": len(failed_executions),
                "steps_count": len(test_steps),
                "prompt_text": f"Plan execution for prompt {prompt_id}"
            }
            
        except httpx.TimeoutException as e:
            logger.error(f"Timeout calling Java runner service: {e}")
            logger.error(f"Target URL was: {target_url}")
        except httpx.ConnectError as e:
            logger.error(f"Connection error calling Java runner service: {e}")
            logger.error(f"Target URL was: {target_url}")
        except Exception as e:
            logger.error(f"Unexpected error calling Java runner service: {type(e).__name__}: {e}")
            logger.error(f"Target URL was: {target_url}")
            
            # Re-raise so the outer handler returns a proper error
            raise HTTPException(status_code=500, detail=f"Java runner service unavailable: {e}")
        
        # Return success response from Java runner
        return {
            "success": True,
            "message": f"Test execution started on {len([e for e in all_executions if e['success']])}/{len(browsers_to_run)} browsers",
            "executions": all_executions,
            "successful_count": len([e for e in all_executions if e['success']]),
            "failed_count": len([e for e in all_executions if not e['success']]),
            "steps_count": len(test_steps),
            "prompt_text": f"Plan execution for prompt {prompt_id}"
        }
        
    except HTTPException as he:
        logger.error(f"HTTP Exception in execute_prompt: {he.status_code} - {he.detail}")
        raise he
    except Exception as e:
        logger.error(f"Unexpected error in execute_prompt: {type(e).__name__}: {str(e)}")
        logger.error(f"Error details: {repr(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to execute prompt: {str(e)}")

async def create_execution_record(db: DatabaseManager, prompt_id: str, steps: List[Dict], current_user: Optional['CurrentUser'], browser_type: str = "chrome") -> tuple[str, List[str]]:
    """Create a new execution record using proper exec.runs table and return execution_id and step_ids"""
    try:
        # Get project and user - handle dev mode where current_user might be None
        if current_user and current_user.project and current_user.project.id:
            # Use current user's project
            project_uuid = current_user.project.id
            created_by_uuid = current_user.user.id
            tenant_id_for_limits = str(current_user.tenant.id) if current_user.tenant and current_user.tenant.id else None
        else:
            # Dev mode or no user - get default project and user
            logger.info("Dev mode: Fetching default project and user")
            project_query = "SELECT id FROM core.projects WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
            project_result = await db.execute_one(project_query)
            if not project_result:
                raise Exception("No active project found")
            project_uuid = project_result['id']
            
            user_query = "SELECT id FROM core.users WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
            user_result = await db.execute_one(user_query)
            created_by_uuid = user_result['id'] if user_result else None
            tenant_id_for_limits = None

        # Resolve tenant for quota checks when not available via auth context.
        if not tenant_id_for_limits:
            tenant_lookup = await db.execute_one(
                "SELECT tenant_id FROM core.projects WHERE id = $1",
                project_uuid,
            )
            tenant_id_for_limits = str(tenant_lookup['tenant_id']) if tenant_lookup and tenant_lookup.get('tenant_id') else None

        # Enforce monthly run limits at record-creation boundary (safety net for all callers).
        if tenant_id_for_limits:
            await require_active_subscription(db, tenant_id_for_limits)
            await enforce_monthly_test_runs_limit(db, tenant_id_for_limits, additional_runs=1)
        
        # Create or get a test case record in the tests.test_cases table
        test_case_uuid = uuid.uuid5(uuid.NAMESPACE_URL, f"prompt:{prompt_id}")
        
        # Look up the actual plan ID from planner.plans table using prompt_id
        plan_lookup_query = """
        SELECT id FROM planner.plans 
        WHERE prompt_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        """
        plan_lookup_result = await db.execute_one(plan_lookup_query, prompt_id)
        
        # Use the plan's ID if found, otherwise NULL
        actual_plan_id = plan_lookup_result['id'] if plan_lookup_result else None
        
        if not actual_plan_id:
            logger.warning(f"No plan found in planner.plans for prompt_id={prompt_id}, creating test_case without plan_id")
        else:
            logger.info(f"Found plan ID {actual_plan_id} for prompt_id={prompt_id}")
        
        # Create test case - try with plan_id first, fall back without it if column doesn't exist
        try:
            test_case_query = """
            INSERT INTO tests.test_cases (
                id, 
                project_id, 
                plan_id,
                title, 
                description
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO NOTHING
            """
            
            await db.execute_one(
                test_case_query,
                test_case_uuid,
                project_uuid,
                actual_plan_id,
                f"Prompt-driven test: {prompt_id[:8]}",
                f"Automated test execution for prompt {prompt_id}"
            )
        except Exception as e:
            # If plan_id column doesn't exist, try without it
            logger.warning(f"Falling back to test case creation without plan_id: {str(e)}")
            test_case_query = """
            INSERT INTO tests.test_cases (
                id, 
                project_id, 
                title, 
                description
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO NOTHING
            """
            
            await db.execute_one(
                test_case_query,
                test_case_uuid,
                project_uuid,
                f"Prompt-driven test: {prompt_id[:8]}",
                f"Automated test execution for prompt {prompt_id}"
            )
        
        # Now insert into exec.runs table - add project_id if required
        execution_query = """
        INSERT INTO exec.runs (
            test_case_id,
            project_id,
            browser_type,
            status,
            started_at,
            runner_meta
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        """
        
        execution_result = await db.execute_one(
            execution_query,
            test_case_uuid,
            project_uuid,
            browser_type,
            "running",
            datetime.now(),
            json.dumps({
                "total_steps": len(steps),
                "steps_preview": steps[:3] if len(steps) > 3 else steps,
                "execution_type": "api_triggered",
                "framework_version": "1.0",
                "prompt_id": prompt_id,
                "triggered_by": "api-execution",
                "project_name": "self-healing-framework",
                "browser": browser_type
            })
        )
        
        execution_id = str(execution_result["id"])
        
        # Also create step_results records for each step and collect their IDs
        step_ids = []
        for i, step in enumerate(steps):
            # Try with action_data column first, fall back to simpler schema if it doesn't exist
            try:
                step_query = """
                INSERT INTO exec.step_results (
                    test_run_id,
                    step_order,
                    action_data,
                    status
                )
                VALUES ($1, $2, $3, $4)
                RETURNING id
                """
                
                step_result = await db.execute_one(
                    step_query,
                    execution_id,
                    i + 1,
                    json.dumps({
                        "action": step.get("action", "unknown"),
                        "locator": step.get("locator", step.get("selector", "")),
                        "value": step.get("value", ""),
                        "description": step.get("description", "")
                    }),
                    "pending"
                )
            except Exception as e:
                # If action_data doesn't exist, try minimal schema
                logger.warning(f"Falling back to minimal step_results schema: {str(e)}")
                step_query = """
                INSERT INTO exec.step_results (
                    test_run_id,
                    step_order,
                    status
                )
                VALUES ($1, $2, $3)
                RETURNING id
                """
                
                step_result = await db.execute_one(
                    step_query,
                    execution_id,
                    i + 1,
                    "pending"
                )
            
            step_ids.append(str(step_result['id']))
            
        return execution_id, step_ids
        
    except Exception as e:
        logger.error(f"Failed to create execution record: {e}")
        raise

def update_db_status_sync(status: str, execution_id: str, prompt_id: str = None, message: str = None, results: Dict = None, bindings: List[Dict] = None):
    """Helper to update database status synchronously using direct connection"""
    try:
        import psycopg2
        import os
        
        # Get database connection parameters from environment or defaults
        db_config = {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME', 'capstone_db'),
            'user': os.getenv('DB_USER', 'postgres'),
            'password': os.getenv('DB_PASSWORD', 'password')
        }
        
        # Create direct connection
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        if results:
            # Update with results
            cur.execute("""
                UPDATE exec.runs 
                SET status = %s, runner_meta = %s
                WHERE id = %s
            """, (status, json.dumps(results), execution_id))
            
            if bindings:
                # Record binding usage for analytics - create tables if needed
                create_tables_query = """
                    CREATE TABLE IF NOT EXISTS exec.binding_usage (
                        id SERIAL PRIMARY KEY,
                        execution_id TEXT NOT NULL,
                        binding_name TEXT NOT NULL,
                        binding_scope TEXT NOT NULL,
                        usage_context JSONB NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    
                    CREATE INDEX IF NOT EXISTS idx_binding_usage_execution 
                    ON exec.binding_usage(execution_id);
                    
                    CREATE INDEX IF NOT EXISTS idx_binding_usage_binding_name 
                    ON exec.binding_usage(binding_name);
                """
                conn.execute(create_tables_query)
                
                logger.info(f"Recording {len(bindings)} binding usages for execution {execution_id}")
                for i, binding in enumerate(bindings):
                    binding_name = binding.get('name', f'binding_{i}')
                    binding_scope = f"prompt_{prompt_id}"
                    
                    # Prepare binding value and context
                    binding_value = {
                        'type': binding.get('type', 'unknown'),
                        'category': binding.get('category', 'data'),
                        'selector': binding.get('selector', ''),
                        'extract_type': binding.get('extract_type', 'text'),
                        'formula': binding.get('formula', '')
                    }
                    
                    usage_context = {
                        'binding_value': binding_value,
                        'prompt_id': prompt_id,
                        'execution_id': execution_id,
                        'step_context': f'execution_step_{i}'
                    }
                    
                    cur.execute("""
                        INSERT INTO exec.binding_usage (execution_id, binding_name, binding_scope, usage_context)
                        VALUES (%s, %s, %s, %s)
                    """, (
                        execution_id,
                        binding_name,
                        binding_scope,
                        json.dumps(usage_context)
                    ))
                
                logger.info(f"Recorded {len(bindings)} bindings")
            
            # Update individual step results if available
            step_results = None
            if 'results' in results:
                step_results = results['results']
            elif 'steps' in results:
                step_results = results['steps']
                
            if step_results:
                logger.info(f"Updating {len(step_results)} step statuses using new status system...")
                for i, step_result in enumerate(step_results):
                    # Use new status determination logic
                    db_status = determine_step_status(step_result)
                    error_msg = step_result.get('error', '')
                    
                    cur.execute("""
                        UPDATE exec.step_results 
                        SET status = %s, error_message = %s
                        WHERE test_run_id = %s AND step_order = %s
                    """, (db_status, error_msg, execution_id, i + 1))
                    
                    # Log the status determination for debugging
                    java_status = step_result.get('status', 'UNKNOWN')
                    healed = step_result.get('healed', False)
                    logger.debug(f"Step {i+1}: Java={java_status}, DB={db_status}, Healed={healed}")
                
                logger.info(f"Updated {len(step_results)} step statuses using new system")
            else:
                logger.warning("No step results available for status update")
        else:
            # Simple status update
            cur.execute("""
                UPDATE exec.runs 
                SET status = %s
                WHERE id = %s
            """, (status, execution_id))
        
        conn.commit()
        cur.close()
        conn.close()
        return True
        
    except Exception as e:
        logger.error(f"Database update failed: {e}")
        return False

async def execute_java_test_background(prompt_id: str, test_steps: List[Dict], execution_id: str, bindings: Optional[List[Dict]] = None):
    """Background execution with ENFORCED database mode.

    This path is used when the HTTP Java runner service is unavailable.
    It converts steps to the local Java CLI format and launches demo.Main directly.
    """

    # Get current selector policy for passing to Java runner
    current_selector_policy = "css"  # Default
    try:
        # Get current policy configuration - same logic as get_policy_based_selector
        from core.database import get_database
        db = await get_database()
        policy_query = """
        SELECT context FROM policy.policy_decisions 
        WHERE context->>'config_type' = 'dashboard_config'
        ORDER BY created_at DESC
        LIMIT 1
        """
        policy_result = await db.execute_one(policy_query)

        if policy_result and policy_result.get("context"):
            config_data = json.loads(policy_result["context"])
            locator_healing = config_data.get("configurations", {}).get("locatorHealing", {})
            prefer_css = locator_healing.get("preferCssOverXpath", True)
            current_selector_policy = "css" if prefer_css else "xpath"
    except Exception as e:
        logger.warning(f"Could not get selector policy: {e}")

    # Initialize variables for compatibility
    status = "running"
    results = None

    # Update status to running
    update_db_status_sync(status, execution_id, prompt_id, "Test execution in progress", results, bindings)

    logger.info("Starting Java test execution")

    # Convert to Java runner format (single pass)
    java_steps: List[Dict[str, Any]] = []
    for step in test_steps:
        # Check if steps are already in Java format (from AI debug execution)
        if "elementId" in step and "page" in step:
            # Steps are already in Java format, ensure selectorPolicy is set
            if "selectorPolicy" not in step:
                step["selectorPolicy"] = current_selector_policy
            java_steps.append(step)
            continue

        # Steps need conversion from old format
        action = step.get("action", "")
        if action == "open_url":
            action = "open"
        elif action == "assert_visible":
            action = "verify_element"
        elif action == "assert_text":
            action = "verify_text"
        # Keep extract_data and calculate as-is since Java runner supports them

        # Format locator properly
        locator = step.get("locator", step.get("selector", ""))
        if locator and not locator.startswith("css=") and not locator.startswith("xpath="):
            # Check if it's an XPath selector (starts with / or contains xpath-specific syntax)
            if locator.startswith("/") or "//*[" in locator or "[@" in locator:
                locator = f"xpath={locator}"
            elif locator.startswith("#") or locator.startswith(".") or "[" in locator:
                locator = f"css={locator}"

        # For open_url, put URL in locator field as well
        if step.get("action") == "open_url":
            locator = step.get("value", "")

        # Special handling for extract_data and calculate actions
        data_value = step.get("value", "")
        if step.get("action") == "extract_data":
            # For extract_data, the Java runner expects the variable name in the 'data' field
            data_value = step.get("value", "")  # Variable name
        elif step.get("action") == "calculate":
            # For calculate, the Java runner expects the result variable in 'data' field
            # and the formula in 'locator' field (which is already set above)
            data_value = step.get("value", "")  # Result variable name

        java_steps.append({
            "page": "saucedemo",
            "action": action,
            "locator": locator,
            "elementId": f"element_{len(java_steps) + 1}",
            "data": data_value,
            "selectorPolicy": current_selector_policy,
        })
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(java_steps, f, indent=2)  # Write steps array directly, not wrapped in object
            temp_file = f.name

        java_runner_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../java-runner"))

        # On Windows, we need to be careful with classpath and path separators.
        # Maven is configured to copy dependencies into a top-level 'lib' directory,
        # so we include that on the classpath instead of the non-existent target/dependency.
        if os.name == 'nt':
            classpath = "target\\classes;lib\\*"
            temp_file_java = temp_file.replace('\\', '/')
        else:
            classpath = "target/classes:lib/*"
            temp_file_java = temp_file
        
        cmd_parts = ["java", "-Djava.awt.headless=false", "-Dtest.visible=true", "-cp", classpath, "demo.Main", temp_file_java]
        
        import subprocess
        import threading
        
        def run_java():
            try:
                process = subprocess.Popen(
                    cmd_parts,
                    cwd=java_runner_dir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    universal_newlines=True
                )
                
                # Read output line by line
                while True:
                    line = process.stdout.readline()
                    if not line:
                        break
                    line = line.strip()
                    if line:
                        logger.debug(f"Java output: {line}")
                
                return_code = process.wait()
                
                # Parse results and update database
                try:
                    results_file = os.path.join(java_runner_dir, "run_summary.json")
                    if os.path.exists(results_file):
                        with open(results_file, 'r') as f:
                            results = json.load(f)
                        
                        # Determine final status based on the new status system
                        final_status = determine_test_execution_status(results, return_code)
                        
                        # Update database with final results
                        update_db_status_sync(
                            final_status,
                            execution_id,
                            prompt_id,
                            f"Test execution finished with return code {return_code}",
                            results,
                            bindings
                        )
                    else:
                        # No results file, mark as failed
                        update_db_status_sync(
                            "failed",
                            execution_id,
                            prompt_id,
                            f"Test execution failed - no results file generated (return code: {return_code})"
                        )
                except Exception as e:
                    # Still try to mark as completed/failed
                    try:
                        final_status = "completed" if return_code == 0 else "failed"
                        update_db_status_sync(final_status, execution_id, prompt_id, f"Execution finished (parse error: {str(e)})")
                    except Exception as status_err:
                        logger.warning("Failed to update execution status after parse error: %s", status_err)
                
                # Clean up temp file
                try:
                    os.unlink(temp_file)
                except Exception as e:
                    logger.warning("Failed to cleanup temp file %s: %s", temp_file, e)
                    
            except Exception as e:
                # Mark execution as failed in database
                try:
                    update_db_status_sync("failed", execution_id, prompt_id, f"Java execution failed: {str(e)}")
                except Exception as status_err:
                    logger.warning("Failed to update execution status after Java failure: %s", status_err)
                    try:
                        update_db_status_sync("failed", execution_id, prompt_id, f"Java execution error: {str(e)}")
                    except Exception as status_err_2:
                        logger.warning("Fallback status update also failed: %s", status_err_2)
                try:
                    os.unlink(temp_file)
                except Exception as cleanup_err:
                    logger.warning("Failed to cleanup temp file after Java failure: %s", cleanup_err)
        
        # Start daemon thread
        thread = threading.Thread(target=run_java, daemon=True)
        thread.start()
        
        # Background execution started successfully
        logger.info(f"Background execution started for {len(test_steps)} steps")

def execute_java_test_background_wrapper(prompt_id: str, test_steps: List[Dict], execution_id: str, bindings: Optional[List[Dict]] = None):
    """Wrapper to run async execute_java_test_background in a new event loop"""
    try:
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(execute_java_test_background(prompt_id, test_steps, execution_id, bindings))
    except Exception as e:
        logger.exception("Background Java execution wrapper failed")
    finally:
        try:
            loop.close()
        except Exception as close_err:
            logger.warning("Failed to close event loop in background wrapper: %s", close_err)

async def update_execution_status(db: DatabaseManager, execution_id: str, status: str, message: str = None, results: Dict = None):
    """Update execution status using proper exec.runs table"""
    try:
        # Update main execution status in exec.runs
        update_query = """
        UPDATE exec.runs 
        SET 
            status = $1::VARCHAR,
            finished_at = CASE WHEN $1::VARCHAR IN ('completed', 'failed', 'completed_with_failures') THEN $2 ELSE finished_at END,
            runner_meta = $3
        WHERE id = $4::UUID
        """
        
        # Get current runner_meta and update it
        current_query = "SELECT runner_meta FROM exec.runs WHERE id = $1::UUID"
        current_result = await db.execute_one(current_query, execution_id)
        
        current_meta = {}
        if current_result and current_result["runner_meta"]:
            current_meta = json.loads(current_result["runner_meta"])
        
        # Update metadata
        if message:
            current_meta["last_message"] = message
        if results:
            current_meta["execution_results"] = results
            # Extract step results if available
            if "steps" in results:
                current_meta["total_steps"] = len(results["steps"])
                # Use new status system for counting
                step_statuses = [determine_step_status(s) for s in results["steps"]]
                current_meta["passed_steps"] = len([s for s in step_statuses if s == "passed"])
                current_meta["failed_steps"] = len([s for s in step_statuses if s == "failed"])
                current_meta["pending_review_steps"] = len([s for s in step_statuses if s == "pending_review"])
            elif "results" in results:
                current_meta["total_steps"] = len(results["results"])
                # Use new status system for counting
                step_statuses = [determine_step_status(s) for s in results["results"]]
                current_meta["passed_steps"] = len([s for s in step_statuses if s == "passed"])
                current_meta["failed_steps"] = len([s for s in step_statuses if s == "failed"])
                current_meta["pending_review_steps"] = len([s for s in step_statuses if s == "pending_review"])
        
        current_meta["last_updated"] = datetime.now().isoformat()
        
        await db.execute_one(
            update_query,
            status,
            datetime.now(),
            json.dumps(current_meta),
            execution_id
        )
        
        # If we have detailed results, update individual step_results
        step_results = None
        
        if results and "results" in results:
            step_results = results["results"]
        elif results and "steps" in results:
            step_results = results["steps"]
            
        if step_results:
            for i, step_result in enumerate(step_results):
                step_update_query = """
                UPDATE exec.step_results 
                SET 
                    status = $1,
                    error_message = $2
                WHERE test_run_id = $3 AND step_order = $4
                """
                
                # Use new status determination logic
                db_status = determine_step_status(step_result)
                error_msg = step_result.get("error", step_result.get("message", None))
                step_index = step_result.get("stepIndex", step_result.get("index", 0))
                
                # Log the status determination for debugging
                java_status = step_result.get('status', 'UNKNOWN')
                healed = step_result.get('healed', False)
                await db.execute_one(
                    step_update_query,
                    db_status,
                    error_msg,
                    execution_id,
                    step_index + 1  # Convert 0-based to 1-based indexing
                )
    except Exception as e:
        logger.error(f"Failed to update execution status: {e}")
        raise

@router.post("/execute-debug-steps")
async def execute_debug_steps(
    request_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: DatabaseManager = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """Execute AI-generated debug steps through the Java runner"""
    try:
        prompt_id = request_data.get('prompt_id')
        steps = request_data.get('steps', [])
        test_name = request_data.get('test_name', f'AI Debug Run - {datetime.now().isoformat()}')
        
        if not prompt_id or not steps:
            raise HTTPException(status_code=400, detail="prompt_id and steps are required")
        
        # Ensure user has a project
        if not current_user.project or not current_user.project.id:
            raise HTTPException(status_code=400, detail="User must be assigned to a project to execute debug steps")
        
        # Use current user's project
        project_uuid = current_user.project.id
        
        # Create a test case for the debug execution (required by foreign key constraint)
        test_case_uuid = uuid.uuid4()
        
        # Look up the actual plan ID from planner.plans table using prompt_id
        plan_lookup_query = """
        SELECT id FROM planner.plans 
        WHERE prompt_id = $1
        ORDER BY created_at DESC
        LIMIT 1
        """
        plan_lookup_result = await db.execute_one(plan_lookup_query, prompt_id)
        
        # Use the plan's ID if found, otherwise NULL
        actual_plan_id = plan_lookup_result['id'] if plan_lookup_result else None
        
        if not actual_plan_id:
            logger.warning(f"No plan found in planner.plans for prompt_id={prompt_id} (debug execution), creating test_case with plan_id=NULL")
        else:
            logger.info(f"Found plan ID {actual_plan_id} for prompt_id={prompt_id} (debug execution)")
        
        # Create test case for AI debug execution
        test_case_query = """
        INSERT INTO tests.test_cases (
            id, 
            project_id, 
            plan_id,
            title, 
            description, 
            source, 
            source_ref_id, 
            status, 
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
        """
        
        # Use current user ID
        default_user_id = current_user.user.id
        
        await db.execute_one(
            test_case_query,
            test_case_uuid,
            project_uuid,
            actual_plan_id,  # Use actual plan ID from planner.plans, not prompt_id
            f"AI Debug Run: {test_name[:50]}",  # Truncate title if too long
            f"AI-generated minimal reproduction steps for prompt {prompt_id}",
            "ai_debug",
            prompt_id,  # Reference back to original prompt
            "active",
            default_user_id
        )# Create a test run record
        run_id = str(uuid.uuid4())
        
        run_insert_query = """
        INSERT INTO exec.runs (id, test_case_id, project_id, status, started_at, runner_meta)
        VALUES ($1, $2, $3, 'running', $4, $5)
        """
        
        runner_meta = {
            "type": "ai_debug",
            "test_name": test_name,
            "original_prompt_id": prompt_id,
            "steps_count": len(steps)
        }
        
        await db.execute(
            run_insert_query,
            run_id,
            str(test_case_uuid),  # Use the created test case ID
            str(project_uuid),
            datetime.utcnow(),
            json.dumps(runner_meta)
        )
        
        # Convert AI steps to the format expected by Java runner (preserving original selectors)
        formatted_steps = []
        for i, step in enumerate(steps):
            # Handle both old format (action/target) and new format (name/params)
            if 'name' in step and 'params' in step:
                # New format from JSON: {"name": "type", "params": {"selector": "#user-name", "text": "...", ...}}
                action = step['name']
                params = step['params']
                target = params.get('selector', '')
                text_value = params.get('text', '')
                url_value = params.get('url', '')
                step_order = i + 1
                original_step_id = f'ai_debug_step_{i + 1}'
            else:
                # Old format: {"action": "type", "target": "#user-name", ...}
                action = step.get('action', 'unknown')
                target = step.get('target', '')
                text_value = step.get('text_value', '')
                url_value = step.get('url', '')
                step_order = step.get('step_order', i + 1)
                original_step_id = step.get('originalStepId', f'ai_debug_step_{i + 1}')
            
            # Map action names to Java runner format if needed
            if action == "open_url":
                action = "open"
            elif action == "assert_visible":
                action = "verify_element"
            elif action == "assert_text":
                action = "verify_text"
            elif action == "verify_text":
                action = "verify_text"  # Keep verify_text as-is
            elif action == "screenshot":
                action = "screenshot"
            
            # Use the original target (CSS selector) from the step
            locator = target
            
            # Format locator properly (add css= prefix if needed)
            if locator and not locator.startswith("css=") and not locator.startswith("xpath="):
                # Check if it's an XPath selector
                if (locator.startswith("/") or "//*[" in locator or "[@" in locator or 
                    locator.startswith("//") or "contains(" in locator):
                    locator = f"xpath={locator}"
                elif locator.startswith(".") or locator.startswith("#") or locator.startswith("["):
                    locator = f"css={locator}"
                else:
                    locator = f"css={locator}"
            
            # Special handling for different actions and their data values
            data_value = ""
            if action == "open":
                # For open action, URL goes in locator field and also in data field
                if not locator or locator in ["css=", "xpath="]:
                    # Use URL from params if available, otherwise default
                    locator = url_value if url_value else "https://www.saucedemo.com/"
                data_value = locator
            elif action == "type":
                # For type action, use the text_value from params or original plan
                data_value = text_value if text_value else step.get('text_value', '')
                if not data_value:
                    data_value = ""
            elif action in ["verify_text", "assert_text"]:
                # For text verification, use the expected text value from params or original
                data_value = text_value if text_value else step.get('text_value', '')
                if not data_value:
                    data_value = ""
            else:
                # For other actions, use any provided data value
                data_value = step.get('value', step.get('data', ''))
            
            # Create step in exact Java runner format using original step ID where possible
            formatted_step = {
                "page": "saucedemo",  # Default page name
                "action": action,
                "locator": locator,
                "elementId": f"original_step_{step_order}_{original_step_id[:8]}",  # Use part of original ID
                "data": data_value
            }
            
            formatted_steps.append(formatted_step)
        
        # Log the first step to debug format issues
        if formatted_steps:
            
            # Log ALL steps to debug format issues} debug step formats:")
            for i, step in enumerate(formatted_steps):
                
                # Check for variable references that might cause Java runner issues
                data_field = step.get('data', '')
                locator_field = step.get('locator', '')
                
                if '${' in str(data_field):
                    if '${' in str(locator_field):# Check for any None values that might cause issues
                        for field_name, field_value in step.items():
                            if field_value is None:# Execute the steps using the same Java runner as normal execution
                                background_tasks.add_task(
                                execute_java_test_background,
                                prompt_id,
                                formatted_steps,
                                run_id,
                                []  # No data bindings for debug runs
                            )
                                return {
                                "success": True,
                                "execution_id": run_id,
                                "steps_count": len(steps),
                                "message": f"AI debug steps execution started successfully"
                            }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute debug steps: {str(e)}")

@router.put("/execution/{execution_id}/status")
async def update_execution_status_endpoint(
    execution_id: str,
    request: dict,
    db: DatabaseManager = Depends(get_database),
    authorization: str = Header(None)
):
    """
    Endpoint for Java runner to report execution completion status
    """
    try:
        status = request.get("status")
        message = request.get("message", "")
        results = request.get("results", {})
        
        if not status:
            raise HTTPException(status_code=400, detail="Status is required")
            
        if status not in ["completed", "failed", "completed_with_failures"]:
            raise HTTPException(status_code=400, detail="Invalid status")
            
        # Update the execution status
        await update_execution_status(db, execution_id, status, message, results)
        
        return {
            "success": True, 
            "message": f"Execution {execution_id} status updated to {status}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating execution status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update execution status: {str(e)}")

@router.put("/execution/{execution_id}/step-result")
async def report_step_result_endpoint(
    execution_id: str,
    request: dict,
    db: DatabaseManager = Depends(get_database),
    authorization: str = Header(None)
):
    """
    Endpoint for Java runner to report individual step results
    """
    try:
        step_order = request.get("step_order")
        status = request.get("status") 
        step_data = request.get("step_data", {})
        
        if step_order is None:
            raise HTTPException(status_code=400, detail="step_order is required")
        if not status:
            raise HTTPException(status_code=400, detail="status is required")
            
        # Update the step result
        update_query = """
        UPDATE exec.step_results 
        SET 
            status = $1,
            action_data = $2,
            finished_at = $3
        WHERE test_run_id = $4 AND step_order = $5
        """
        
        await db.execute_one(
            update_query,
            status,
            json.dumps(step_data),
            datetime.now(),
            execution_id,
            step_order
        )
        
        return {
            "success": True,
            "message": f"Step {step_order} result updated for execution {execution_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating step result: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update step result: {str(e)}")


@router.put("/step/{step_id}/status")
async def update_step_status(
    step_id: str,
    request: dict,
    db: DatabaseManager = Depends(get_database),
    authorization: str = Header(None)
):
    """
    Endpoint for Java runner to update individual step status by step ID
    Also captures healing attempt data if provided
    """
    try:
        status = request.get("status")
        error_details = request.get("error_details")
        screenshot_path = _normalize_screenshot_path(request.get("screenshot_path"))
        finished_at = request.get("finished_at")
        healed = request.get("healed", False)
        healing_attempts = request.get("healing_attempts", [])  # NEW: capture healing data
        
        if not status:
            raise HTTPException(status_code=400, detail="status is required")
        
        # If healing was attempted, convert status to pending_review
        # This marks any step where healing was tried (success or fail) for human review
        if healed:
            status = "pending_review"
            logger.info(f"Step {step_id}: Healing attempted, converting status to pending_review (original: {request.get('status')})")
        
        # Convert error_details to JSON if it's a string
        import json as json_lib
        if error_details and isinstance(error_details, str):
            try:
                # Wrap plain string error messages in a JSON object
                error_details_json = json_lib.dumps({"message": error_details})
            except Exception as e:
                logger.warning(f"Failed to JSON encode error_details, storing as-is: {e}")
                error_details_json = json_lib.dumps({"message": str(error_details)})
        elif error_details:
            # Already a dict/object, just ensure it's JSON
            error_details_json = json_lib.dumps(error_details)
        else:
            error_details_json = None
            
        # Update the step result by step ID
        update_query = """
        UPDATE exec.step_results 
        SET 
            status = $1,
            error_details = $2,
            screenshot_path = $3,
            finished_at = $4,
            updated_at = $5
        WHERE id = $6
        """
        
        # Parse finished_at if provided as string
        from datetime import datetime
        
        finished_timestamp = None
        if finished_at:
            if isinstance(finished_at, str):
                try:
                    finished_timestamp = datetime.fromisoformat(finished_at.replace('Z', '+00:00'))
                except ValueError:
                    finished_timestamp = datetime.now()
            else:
                finished_timestamp = datetime.now()
        else:
            finished_timestamp = datetime.now()
        
        await db.execute_command(
            update_query,
            status,
            error_details_json,
            screenshot_path,
            finished_timestamp,
            datetime.now(),
            step_id
        )
        
        # NEW: Store healing attempt data if healing was attempted
        if healed:
            try:
                if healing_attempts:
                    # Detailed attempts provided by Java runner
                    for attempt in healing_attempts:
                        # Create locator event
                        event_query = """
                        INSERT INTO healing.locator_events (
                            run_step_id, event_type, original_selector, 
                            failure_reason, created_at
                        ) VALUES ($1, $2, $3, $4, $5)
                        RETURNING id
                        """

                        original_selector = attempt.get('originalLocator', {})
                        if isinstance(original_selector, str):
                            original_selector = {'css': original_selector}

                        event_id = await db.execute_one(
                            event_query,
                            step_id,
                            'element_not_found',
                            json_lib.dumps(original_selector),
                            error_details or 'Element not found',
                            datetime.now()
                        )

                        # Create candidates and decision for each attempted alternative
                        attempted_alternatives = attempt.get('attemptedAlternatives', [])
                        healed_locator = attempt.get('healedLocator')
                        result = attempt.get('result', 'failed')

                        if attempted_alternatives and event_id:
                            for idx, alt_locator in enumerate(attempted_alternatives):
                                # Insert candidate
                                candidate_query = """
                                INSERT INTO healing.candidates (
                                    locator_event_id, selector, selector_type,
                                    score, rationale, created_at
                                ) VALUES ($1, $2, $3, $4, $5, $6)
                                RETURNING id
                                """

                                selector_data = {'css': alt_locator} if isinstance(alt_locator, str) else alt_locator

                                candidate_id = await db.execute_one(
                                    candidate_query,
                                    event_id['id'],
                                    json_lib.dumps(selector_data),
                                    'css',
                                    0.5 - (idx * 0.1),  # Decreasing score for each attempt
                                    f'Alternative locator attempt {idx + 1}',
                                    datetime.now()
                                )

                                # If this was the healed locator, create a decision
                                if healed_locator and alt_locator == healed_locator and candidate_id:
                                    decision_query = """
                                    INSERT INTO healing.decisions (
                                        locator_event_id, chosen_candidate_id,
                                        decision_type, rationale, success, automated, decided_at
                                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                                    """

                                    await db.execute_command(
                                        decision_query,
                                        event_id['id'],
                                        candidate_id['id'],
                                        'automated',
                                        f'Healing {result}',
                                        result == 'success',
                                        True,
                                        datetime.now()
                                    )

                    logger.info(f"Stored {len(healing_attempts)} healing attempts for step {step_id}")
                else:
                    # No structured attempts were provided, but healing was attempted.
                    # Record a generic failed healing event so the UI can display it.
                    generic_failure_reason = None
                    if error_details:
                        if isinstance(error_details, str):
                            generic_failure_reason = error_details
                        elif isinstance(error_details, dict):
                            generic_failure_reason = error_details.get("message") or json_lib.dumps(error_details)
                    if not generic_failure_reason:
                        generic_failure_reason = "Healing attempted but no alternative locators were found"

                    # Try to recover the original selector from the step's action_data
                    original_selector_payload = {}
                    try:
                        selector_row = await db.execute_one(
                            "SELECT action_data FROM exec.step_results WHERE id = $1",
                            step_id
                        )

                        if selector_row and selector_row.get("action_data"):
                            try:
                                action_data = json_lib.loads(selector_row["action_data"])
                            except Exception:
                                action_data = {}

                            locator_value = None
                            if isinstance(action_data, dict):
                                locator_value = (
                                    action_data.get("locator")
                                    or action_data.get("selector")
                                    or action_data.get("target")
                                    or action_data.get("value")
                                )

                            if locator_value:
                                original_selector_payload = {"raw": locator_value}
                    except Exception as e:
                        logger.warning(f"Failed to load original selector for healing event: {e}")

                    event_query = """
                    INSERT INTO healing.locator_events (
                        run_step_id, event_type, original_selector,
                        failure_reason, created_at
                    ) VALUES ($1, $2, $3, $4, $5)
                    """

                    await db.execute_command(
                        event_query,
                        step_id,
                        'healing_failed_no_candidates',
                        json_lib.dumps(original_selector_payload or {}),
                        generic_failure_reason,
                        datetime.now()
                    )
            except Exception as e:
                logger.error(f"Failed to store healing attempts: {e}")
                # Don't fail the whole request if healing storage fails
        
        return {
            "success": True,
            "message": f"Step {step_id} status updated to {status}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating step status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update step status: {str(e)}")

