"""
Test Execution API - Clean version with proper database integration
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
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
import psycopg2
import uuid
from pathlib import Path
from core.database import get_database, DatabaseManager
from core.binding_processor import BindingProcessor
from schemas.enterprise import TestBindings, DataBinding

# Setup logger
logger = logging.getLogger(__name__)

router = APIRouter()

<<<<<<< Updated upstream
=======
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
        
        if status == "FAIL":
            has_failures = True
            break  # Any failure means the test failed
        elif healed:
            has_healing = True
    
    if has_failures:
        return "failed"
    elif has_healing:
        return "pending_review"  # No failures but healing occurred
    else:
        return "pass"  # All steps passed without healing

def determine_step_status(step_result: Dict) -> str:
    """
    Determine individual step status:
    - "passed": Step passed without healing
    - "failed": Step failed
    - "pending_review": Step passed but required healing
    """
    status = step_result.get("status", "UNKNOWN")
    healed = step_result.get("healed", False)
    
    if status == "FAIL":
        return "failed"
    elif status == "PASS" and healed:
        return "pending_review"
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
    """
    Apply selector policy to choose between CSS and XPath selectors for a step
    """
    try:
        # Get current policy configuration
        policy_query = """
        SELECT context FROM policy.policy_decisions 
        WHERE context->>'config_type' = 'dashboard_config'
        ORDER BY created_at DESC
        LIMIT 1
        """
        policy_result = await db.execute_one(policy_query)
        
        # Default policy
        prefer_css = True
        
        if policy_result and policy_result.get("context"):
            config_data = json.loads(policy_result["context"])
            locator_healing = config_data.get("configurations", {}).get("locatorHealing", {})
            prefer_css = locator_healing.get("preferCssOverXpath", True)
        
        # Get selectors from step data
        css_selector = None
        xpath_selector = None
        fallback_selector = None
        
        # Try to get dual selectors from database
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
                
                # If dual selectors not available, try to extract from parameters
                if not css_selector and not xpath_selector:
                    params = step_result.get("parameters", {})
                    if isinstance(params, str):
                        params = json.loads(params)
                    fallback_selector = params.get("selector")
        except Exception as e:
            # Fallback to step data if database lookup failed
            if not css_selector and not xpath_selector and not fallback_selector:
                dual_selectors = step_data.get('dual_selectors', {})
            if dual_selectors:
                css_selector = dual_selectors.get('css_selector', '')
                xpath_selector = dual_selectors.get('xpath_selector', '')# If no dual selectors, fall back to single selector
            if not css_selector and not xpath_selector:
                fallback_selector = (
                    step_data.get('selector') or 
                    step_data.get('locator') or 
                    step_data.get('target', '')
                )# Debug logging# Apply policy to select the best selector
        selected_selector = None
        selector_type = None
        
        if prefer_css:
            if css_selector:
                selected_selector = css_selector
                selector_type = 'css'
            elif xpath_selector:
                selected_selector = xpath_selector
                selector_type = 'xpath'
            elif fallback_selector:
                # Determine type based on heuristics
                if (fallback_selector.startswith('//') or 
                    '[@' in fallback_selector or 
                    '/html' in fallback_selector):
                    selected_selector = fallback_selector
                    selector_type = 'xpath'
                else:
                    selected_selector = fallback_selector
                    selector_type = 'css'
        else:
            # Prefer XPath
            if xpath_selector:
                selected_selector = xpath_selector
                selector_type = 'xpath'
            elif css_selector:
                selected_selector = css_selector
                selector_type = 'css'
            elif fallback_selector:
                # Use fallback as determined above
                if (fallback_selector.startswith('//') or 
                    '[@' in fallback_selector or 
                    '/html' in fallback_selector):
                    selected_selector = fallback_selector
                    selector_type = 'xpath'
                else:
                    selected_selector = fallback_selector
                    selector_type = 'css'
        
        # Log the policy decision
        if selected_selector:
            try:
                await log_selector_policy_decision(
                    prompt_id, step_index, css_selector, xpath_selector,
                    selected_selector, selector_type, prefer_css, db
                )
            except Exception as e:return selected_selector or ''
        
    except Exception as e:# Fallback to original behavior
        return (
            step_data.get('selector') or 
            step_data.get('locator') or 
            step_data.get('target', '')
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

>>>>>>> Stashed changes
async def get_db() -> DatabaseManager:
    """Get database dependency"""
    return await get_database()

@router.post("/execute-prompt/{prompt_id}")
async def execute_prompt(
    prompt_id: str,
    background_tasks: BackgroundTasks,
    db: DatabaseManager = Depends(get_db)
):
    """Execute a test based on a prompt"""
    try:
        # Get the plan details from database (using existing planner.plans table)
        plan_query = """
        SELECT 
            p.id,
            p.prompt_id,
            p.status,
            p.plan_json,
            p.created_at
        FROM planner.plans p
        WHERE p.prompt_id = $1
        """
        
        plan_result = await db.execute_one(plan_query, prompt_id)
        
        if not plan_result:
            raise HTTPException(status_code=404, detail="Plan not found for this prompt")
        
        # Extract steps from plan_json
        import json
        plan_data = json.loads(plan_result['plan_json'])
        steps_data = plan_data.get('steps', [])
        
<<<<<<< Updated upstream
        # Load active data bindings from datahub.data_bindings table
=======
        # Fix corrupted XPath selectors in existing plan data
        for step in steps_data:
            if 'dual_selectors' in step and step['dual_selectors']:
                xpath_selector = step['dual_selectors'].get('xpath_selector', '')
                if xpath_selector and '@@' in xpath_selector:
                    # Fix double @@ to single @
                    corrected_xpath = xpath_selector.replace('@@', '@')
                    step['dual_selectors']['xpath_selector'] = corrected_xpath
        
        # Load active data bindings from datahub.data_bindings table for this specific prompt
>>>>>>> Stashed changes
        active_bindings = []
        try:
            bindings_query = """
                SELECT rule_name, scope, source_ref, target 
                FROM datahub.data_bindings 
                WHERE is_active = true 
                ORDER BY priority DESC, created_at DESC
            """
            db_bindings = await db.execute(bindings_query)
            
            if db_bindings:
<<<<<<< Updated upstream
                logger.info(f"🔗 Found {len(db_bindings)} active data bindings from datahub")
=======
>>>>>>> Stashed changes
                
                for binding in db_bindings:
                    source_ref = binding.get('source_ref', {})
                    target = binding.get('target', {})
                    
                    # Extract binding information
                    var_name = target.get('variable_name', binding.get('rule_name', 'unknown'))
                    var_type = target.get('type', 'text')
                    category = target.get('category', 'data')
                    
                    # Create binding data structure
                    binding_data = {
                        "name": var_name,
                        "type": var_type,
                        "category": category,
                        "selector": source_ref.get('selector', ''),
                        "extract_type": source_ref.get('extract_type', 'text'),
                        "formula": source_ref.get('formula', '')
                    }
                    active_bindings.append(binding_data)
        except Exception as e:
            active_bindings = []
        
        # Debug logging to see what we're actually loading} steps in database"))}")} bindings")
        
        if not steps_data:
            raise HTTPException(status_code=400, detail="No steps found in the plan. Please generate steps first.")
<<<<<<< Updated upstream
        
        # Convert steps to format expected by Java runner
=======

        # Initialize test_steps array for processing
>>>>>>> Stashed changes
        test_steps = []
        
        # Initialize variable mapping for binding names
        variable_mapping = {}
        
        # Build variable mapping from bindings
        for binding in active_bindings:
            if binding.get('category') == 'price' or binding.get('extract_type') != 'calculated':
            # Special handling for extract_data steps to use correct variable names
                action = step.get('action', step.get('name', ''))
            if action == 'extract_data':
                # Get the variable name from the step
                variable_name = None
                for i, step in enumerate(steps_data):# Process step with binding resolution
                    processed_step = step.copy()
            action = step.get('action', step.get('name', ''))
            if action == 'extract_data':
                # Get the variable name from the step
                variable_name = None
                if binding.get('category') == 'price' or binding.get('extract_type') != 'calculated':
                    variable_mapping[binding['name']] = binding['name']
                elif binding.get('type') == "extract":
                    variable_mapping[binding['name']] = binding['name']
                for i, step in enumerate(steps_data):# Process step with binding resolution
                    processed_step = step.copy()
            
            # Special handling for extract_data steps to use correct variable names
            action = step.get('action', step.get('name', ''))
            if action == 'extract_data':
                # Get the variable name from the step
                variable_name = None
                if 'params' in step and 'variable' in step['params']:
                    variable_name = step['params']['variable']
                elif 'variable' in step:
                    variable_name = step['variable']
                
                # Map to actual binding variable name if it exists
                if variable_name and variable_name in variable_mapping:
                    mapped_name = variable_mapping[variable_name]# Set the data field to the mapped variable name for Java runner
                    processed_step['data'] = mapped_name
                elif variable_name:
                    processed_step['data'] = variable_name
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
                    text_value = step_data.get('text', '')# Check for any ${variableName} pattern
                import re
                variable_pattern = r'\$\{([^}]+)\}'
                variables_found = re.findall(variable_pattern, str(text_value)) if text_value else []# If this is an assert_text step with any variable pattern
                if action == 'assert_text' and isinstance(text_value, str) and variables_found:
                    modified_step = step_data.copy()
                    new_text = text_value
                    
                    # Process each variable found
                    for variable_name in variables_found:# Calculate variable value based on bindings
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
            
            # Apply variable processing
            processed_step = process_variable_step(processed_step)
            action = processed_step.get('action', processed_step.get('name', ''))
            
            # Special handling for extract_data steps
            if action == 'extract_data':
                if 'args' in processed_step:
                    step_args = processed_step.get('args', {})
                    variable_name = step_args.get('variable', step_args.get('data', ''))
<<<<<<< Updated upstream
                    locator = step_args.get('selector', step_args.get('locator', ''))
=======
                    # Apply selector policy - pass full step to access dual_selectors
                    locator = await get_policy_based_selector(prompt_id, i, processed_step, db)
>>>>>>> Stashed changes
                    element_index = step_args.get('element_index') or step_args.get('index')  # Get element_index or index if present
                elif 'params' in processed_step:
                    step_params = processed_step.get('params', {})
                    variable_name = step_params.get('variable', step_params.get('data', ''))
<<<<<<< Updated upstream
                    locator = step_params.get('selector', step_params.get('locator', ''))
=======
                    # Apply selector policy - pass full step to access dual_selectors
                    locator = await get_policy_based_selector(prompt_id, i, processed_step, db)
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
                    data_field = json.dumps({"variable": variable_name, "element_index": element_index})
                
=======
                    data_field = json.dumps({"variable": variable_name, "index": element_index})
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
                # Apply selector policy - pass full step to access dual_selectors
                policy_locator = await get_policy_based_selector(prompt_id, i, processed_step, db)
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
=======
                # Apply selector policy - pass full step to access dual_selectors
                policy_locator = await get_policy_based_selector(prompt_id, i, processed_step, db)
>>>>>>> Stashed changes
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
        
        # ENFORCE DATABASE MODE: Create execution record FIRST
        execution_id = await create_execution_record(db, prompt_id, test_steps)
        
        # Start execution WITH database tracking enforced
        background_tasks.add_task(
            execute_java_test_background_wrapper,
            prompt_id,
            test_steps,
            execution_id,
            active_bindings  # Pass the loaded bindings instead of processed_bindings
        )
        
        return {
            "success": True,
            "message": "Test execution started with database tracking",
            "execution_id": execution_id,
            "steps_count": len(test_steps),
            "prompt_text": f"Plan execution for prompt {prompt_id}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute prompt: {str(e)}")

async def create_execution_record(db: DatabaseManager, prompt_id: str, steps: List[Dict]) -> str:
    """Create a new execution record using proper exec.runs table"""
    try:
        # First, find any existing test case to see what project_id is actually used
        try:
            existing_test_case = await db.execute("SELECT project_id FROM tests.test_cases LIMIT 1")
            if existing_test_case and existing_test_case[0]['project_id']:
                project_uuid = existing_test_case[0]['project_id']
            else:
                # If no test cases exist, we have a chicken-and-egg problem
                # Let's see what project_id values exist in the exec.runs table
                existing_run = await db.execute("SELECT project_id FROM exec.runs WHERE project_id IS NOT NULL LIMIT 1")
                if existing_run and existing_run[0]['project_id']:
                    project_uuid = existing_run[0]['project_id']
                else:
                    # Last resort: try to find any valid project reference in the database
                    # Check if there's a projects table in a different schema
                    try:
                        projects_query = """
                        SELECT table_schema, table_name 
                        FROM information_schema.tables 
                        WHERE table_name = 'projects'
                        """
                        project_tables = await db.execute(projects_query)
                        if project_tables:
                            schema_name = project_tables[0]['table_schema']
                            projects_in_schema = await db.execute(f"SELECT id FROM {schema_name}.projects LIMIT 1")
                            if projects_in_schema:
                                project_uuid = projects_in_schema[0]['id']
                            else:
                                raise Exception("Projects table found but empty")
                        else:
                            raise Exception("No projects table found in any schema")
                    except Exception as e:
                        raise
        except Exception as e:
            raise
        
        # Environment setup not needed - using single environment mode")
        
        # Use confirmed existing user UUID
        created_by_uuid = uuid.UUID('25616325-6f9d-4dad-8e4d-16affd24e7cf')# Create or get a test case record in the tests.test_cases table
        test_case_uuid = uuid.uuid5(uuid.NAMESPACE_URL, f"prompt:{prompt_id}")
        
        # Create test case with confirmed user
        test_case_query = """
        INSERT INTO tests.test_cases (
            id, 
            project_id, 
            title, 
            description, 
            source, 
            source_ref_id, 
            status, 
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
        """
        
        await db.execute_one(
            test_case_query,
            test_case_uuid,
            project_uuid,  # Use discovered valid project UUID
            f"Prompt-driven test: {prompt_id[:8]}",
            f"Automated test execution for prompt {prompt_id}",
            "prompt_api",  # source
            prompt_id,  # source_ref_id (the original prompt ID)
            "active",  # status
            created_by_uuid  # Use confirmed user UUID
        )# Now insert into exec.runs table without environment_id
        execution_query = """
        INSERT INTO exec.runs (
            test_case_id,
            project_id,
            runner_meta,
            status,
            started_at
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        """
        
        execution_result = await db.execute_one(
            execution_query,
            test_case_uuid,  # Reference to test case in tests schema
            project_uuid,  # Use discovered valid project UUID
            json.dumps({
                "total_steps": len(steps),
                "steps_preview": steps[:3] if len(steps) > 3 else steps,
                "execution_type": "api_triggered",
                "framework_version": "1.0",
                "prompt_id": prompt_id,
                "test_case_name": f"Prompt-driven test: {prompt_id[:8]}",
                "triggered_by": "api-execution",
                "project_name": "self-healing-framework"
            }),
            "running",
            datetime.now()
        )
        
        execution_id = str(execution_result["id"])# Also create step_results records for each step
        # Note: Using test_run_id column name as per actual table schema
        for i, step in enumerate(steps):
            step_query = """
            INSERT INTO exec.step_results (
                test_run_id,
                step_order,
                action,
                target,
                status
            )
            VALUES ($1, $2, $3, $4, $5)
            """
            
            await db.execute_one(
                step_query,
                execution_id,  # This should reference our exec.runs record
                i + 1,
                step.get("action", "unknown"),
                step.get("locator", step.get("selector", "")),
                "pending"
            )
        return execution_id
        
    except Exception as e:
        raise

def update_db_status_sync(status: str, execution_id: str, prompt_id: str = None, message: str = None, results: Dict = None, bindings: List[Dict] = None):
    """Helper to update database status synchronously using direct connection"""
    try:
<<<<<<< Updated upstream
        logger.info(f" Starting DATABASE-TRACKED execution for prompt {prompt_id}, execution_id: {execution_id}")

        # Synchronous database update function that uses direct psycopg2 connection
        def update_db_status_sync(status: str, message: str = None, results: Dict = None):
            """Helper to update database status synchronously using direct connection"""
            try:
                import psycopg2
                import os
                
                # Get database connection parameters from environment or defaults
                db_config = {
                    'host': os.getenv('DB_HOST', 'localhost'),
                    'port': int(os.getenv('DB_PORT', 5432)),
                    'database': os.getenv('DB_NAME', 'self_healing_tests'),
                    'user': os.getenv('DB_USER', 'postgres'),
                    'password': os.getenv('DB_PASSWORD', 'password')
                }
                
                # Create direct synchronous connection
                conn = psycopg2.connect(**db_config)
                cur = conn.cursor()
                
                if status == 'completed' and results:
                    # Final update with results
                    cur.execute("""
                        UPDATE exec.runs 
                        SET status = %s, finished_at = NOW(), runner_meta = %s
                        WHERE id = %s
                    """, (status, json.dumps(results), execution_id))
                    
                    # Update individual step results if available
                    step_results = None
                    if 'results' in results:
                        step_results = results['results']
                    elif 'steps' in results:
                        step_results = results['steps']
                        
                    if step_results:
                        logger.info(f" Updating {len(step_results)} step statuses synchronously...")
                        for i, step_result in enumerate(step_results):
                            java_status = step_result.get('status', 'unknown')
                            step_status = 'passed' if java_status == 'PASS' else 'failed'
                            error_msg = step_result.get('error', '')
                            
                            cur.execute("""
                                UPDATE exec.step_results 
                                SET status = %s, error_message = %s
                                WHERE test_run_id = %s AND step_order = %s
                            """, (step_status, error_msg, execution_id, i + 1))
                            
                        logger.info(f" Updated {len(step_results)} step statuses")
                    else:
                        logger.warning(f" No step results found for update. Keys: {list(results.keys())}")
                else:
                    # Simple status update
=======
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
                    
>>>>>>> Stashed changes
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
    """Background execution with ENFORCED database mode"""

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
    
    # Continue with Java test execution
    logger.info("Starting Java test execution")
    
    # Convert to Java runner format
    java_steps = []
    
    # Convert to Java runner format
    for step in test_steps:
        
        # Continue with Java test execution
        logger.info("Starting Java test execution")
        
        # Convert to Java runner format
        java_steps = []
        for step in test_steps:
<<<<<<< Updated upstream
            # Map action names to Java runner format
            action = step["action"]
            if action == "open_url":
                action = "open"
            elif action == "assert_visible":
                action = "verify_element"
            elif action == "assert_text":
                action = "verify_text"
            elif action == "screenshot":
                action = "screenshot"
            # Keep extract_data and calculate as-is since Java runner supports them
            
            # Format locator properly
            locator = step["locator"]
            if locator and not locator.startswith("css=") and not locator.startswith("xpath="):
                if locator.startswith("#") or locator.startswith(".") or "[" in locator:
                    locator = f"css={locator}"
            
            # For open_url, put URL in locator field as well
            if step["action"] == "open_url":
                locator = step["value"]
            
            # Special handling for extract_data and calculate actions
            data_value = step["value"]
            if step["action"] == "extract_data":
                # For extract_data, the Java runner expects the variable name in the 'data' field
                data_value = step["value"]  # Variable name
            elif step["action"] == "calculate":
                # For calculate, the Java runner expects the result variable in 'data' field
                # and the formula in 'locator' field (which is already set above)
                data_value = step["value"]  # Result variable name
                
            java_steps.append({
                "page": "saucedemo",
                "action": action,
                "locator": locator,
                "elementId": f"element_{len(java_steps) + 1}",
                "data": data_value
            })

        logger.info(f" Converted {len(java_steps)} steps to Java format")

        # Java runner expects a direct JSON array of steps, not an object with "steps" property
        # Log bindings information but don't include in the JSON file
        if bindings:
            logger.info(f"🔗 Found {len(bindings)} bindings for this execution")
        else:
            logger.info("📝 No bindings provided to execution")

        # Create temporary execution file with JUST the steps array (Java format)
=======
            # Check if steps are already in Java format (from AI debug execution)
            if "elementId" in step and "page" in step:
                # Steps are already in Java format, ensure selectorPolicy is set
                if "selectorPolicy" not in step:
                    step["selectorPolicy"] = current_selector_policy
                java_steps.append(step)
            else:
                # Steps need conversion from old format
                action = step["action"]
                if action == "open_url":
                    action = "open"
                elif action == "assert_visible":
                    action = "verify_element"
                elif action == "assert_text":
                    action = "verify_text"
                elif action == "screenshot":
                    action = "screenshot"
                # Keep extract_data and calculate as-is since Java runner supports them
                
                # Format locator properly
                locator = step["locator"]
                if locator and not locator.startswith("css=") and not locator.startswith("xpath="):
                    # Check if it's an XPath selector (starts with / or contains xpath-specific syntax)
                    if locator.startswith("/") or "//*[" in locator or "[@" in locator:
                        locator = f"xpath={locator}"
                    elif locator.startswith("#") or locator.startswith(".") or "[" in locator:
                        locator = f"css={locator}"
                
                # For open_url, put URL in locator field as well
                if step["action"] == "open_url":
                    locator = step["value"]
                
                # Special handling for extract_data and calculate actions
                data_value = step["value"]
                if step["action"] == "extract_data":
                    # For extract_data, the Java runner expects the variable name in the 'data' field
                    data_value = step["value"]  # Variable name
                elif step["action"] == "calculate":
                    # For calculate, the Java runner expects the result variable in 'data' field
                    # and the formula in 'locator' field (which is already set above)
                    data_value = step["value"]  # Result variable name
                    
                java_steps.append({
                    "page": "saucedemo",
                    "action": action,
                    "locator": locator,
                    "elementId": f"element_{len(java_steps) + 1}",
                    "data": data_value,
                    "selectorPolicy": current_selector_policy  # KEY FIX: Pass policy to Java runner
                })
>>>>>>> Stashed changes
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(java_steps, f, indent=2)  # Write steps array directly, not wrapped in object
            temp_file = f.name

        java_runner_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../java-runner"))
        
        # On Windows, we need to be careful with classpath and path separators
        if os.name == 'nt':
            classpath = "target\\classes;target\\dependency\\*"
            temp_file_java = temp_file.replace('\\', '/')
        else:
            classpath = "target/classes:target/dependency/*"
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
                        print(f"Java output: {line}")
                
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
                    except:
                        pass
                
                # Clean up temp file
                try:
                    os.unlink(temp_file)
                except Exception as e:
                    pass
                    
            except Exception as e:
                # Mark execution as failed in database
                try:
                    update_db_status_sync("failed", execution_id, prompt_id, f"Java execution failed: {str(e)}")
                except:
                    pass
                    try:
                        update_db_status_sync("failed", execution_id, prompt_id, f"Java execution error: {str(e)}")
                    except:
                        pass
                try:
                    os.unlink(temp_file)
                except:
                    pass
        
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
        pass
    finally:
        try:
            loop.close()
        except:
            pass

async def update_execution_status(db: DatabaseManager, execution_id: str, status: str, message: str = None, results: Dict = None):
    """Update execution status using proper exec.runs table"""
    try:
        # Update main execution status in exec.runs
        update_query = """
        UPDATE exec.runs 
        SET 
            status = $1,
            finished_at = CASE WHEN $1 IN ('completed', 'failed', 'completed_with_failures') THEN $2 ELSE finished_at END,
            runner_meta = $3
        WHERE id = $4
        """
        
        # Get current runner_meta and update it
        current_query = "SELECT runner_meta FROM exec.runs WHERE id = $1"
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
<<<<<<< Updated upstream
        logger.error(f"Error updating execution status: {str(e)}")
=======
        logger.error(f"Failed to update execution status: {e}")
        raise

@router.post("/execute-debug-steps")
async def execute_debug_steps(
    request_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: DatabaseManager = Depends(get_db)
):
    """Execute AI-generated debug steps through the Java runner"""
    try:
        prompt_id = request_data.get('prompt_id')
        steps = request_data.get('steps', [])
        test_name = request_data.get('test_name', f'AI Debug Run - {datetime.now().isoformat()}')
        
        if not prompt_id or not steps:
            raise HTTPException(status_code=400, detail="prompt_id and steps are required")
        
        # Get project and environment IDs (same logic as regular execution)
        try:
            # Use the first available project (simplified for debug execution)
            projects_query = """
            SELECT table_schema 
            FROM information_schema.tables 
            WHERE table_name = 'projects' AND table_type = 'BASE TABLE'
            """
            project_tables = await db.execute(projects_query)
            if project_tables:
                schema_name = project_tables[0]['table_schema']
                projects_in_schema = await db.execute(f"SELECT id FROM {schema_name}.projects LIMIT 1")
                if projects_in_schema:
                    project_uuid = projects_in_schema[0]['id']
                else:
                    raise Exception("Projects table found but empty")
            else:
                raise Exception("No projects table found in any schema")
        except Exception as e:
            raise
        # Since environments are not set up yet, use NULL for environment_id
        # Environment setup not needed - using single environment mode")
        
        # Create a test case for the debug execution (required by foreign key constraint)
        test_case_uuid = uuid.uuid4()
        
        # Create test case for AI debug execution
        test_case_query = """
        INSERT INTO tests.test_cases (
            id, 
            project_id, 
            title, 
            description, 
            source, 
            source_ref_id, 
            status, 
            created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
        """
        
        # Use a default user ID (you might want to get this from the current user)
        default_user_id = uuid.UUID('25616325-6f9d-4dad-8e4d-16affd24e7cf')  # Use same confirmed user as regular execution
        
        await db.execute_one(
            test_case_query,
            test_case_uuid,
            project_uuid,
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
>>>>>>> Stashed changes
