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
import uuid
from pathlib import Path
from core.database import get_database, DatabaseManager
from core.binding_processor import BindingProcessor
from schemas.enterprise import TestBindings, DataBinding
from services.selector_conversion import convert_steps_to_dual_selector_format, SelectorConverter

logger = logging.getLogger(__name__)
router = APIRouter()

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
        
        logger.info(f"✅ Stored {len(converted_steps)} steps with dual selectors for test case {test_case_id}")
        
    except Exception as e:
        logger.error(f"❌ Failed to store steps with dual selectors: {e}")
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
            logger.warning(f"Could not fetch step selectors from database: {e}")
        
        # Fallback to step data if database lookup failed
        if not css_selector and not xpath_selector and not fallback_selector:
            fallback_selector = (
                step_data.get('selector') or 
                step_data.get('locator') or 
                step_data.get('target', '')
            )
        
        # Apply policy to select the best selector
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
            except Exception as e:
                logger.warning(f"Failed to log selector decision: {e}")
            
            logger.info(f"🎯 Policy applied: {selector_type} selector chosen for step {step_index}")
        
        return selected_selector or ''
        
    except Exception as e:
        logger.error(f"Failed to apply selector policy: {e}")
        # Fallback to original behavior
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
    """Log selector policy decision for analytics"""
    try:
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
        
    except Exception as e:
        logger.warning(f"Failed to log selector decision: {e}")
        # Don't fail the execution if logging fails

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
        
        # Load active data bindings from datahub.data_bindings table for this specific prompt
        active_bindings = []
        try:
            scope_name = f"prompt_{prompt_id}"
            bindings_query = """
                SELECT rule_name, scope, source_ref, target 
                FROM datahub.data_bindings 
                WHERE is_active = true AND scope = $1
                ORDER BY priority DESC, created_at DESC
            """
            db_bindings = await db.execute(bindings_query, scope_name)
            
            if db_bindings:
                logger.info(f"🔗 Found {len(db_bindings)} active data bindings from datahub for prompt {prompt_id} (scope: {scope_name})")
                
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
                
                logger.info(f"🔗 Processed {len(active_bindings)} data bindings")
            else:
                logger.info("📝 No active data bindings found in datahub")
                
        except Exception as e:
            logger.warning(f" Failed to load data bindings: {str(e)}")
            active_bindings = []
        
        # Debug logging to see what we're actually loading
        logger.info(f" Loading steps for prompt {prompt_id}")
        logger.info(f" Found {len(steps_data)} steps in database")
        logger.info(f" Plan data keys: {list(plan_data.keys())}")
        logger.info(f"🔗 Active bindings found: {len(active_bindings)} bindings")
        
        if not steps_data:
            raise HTTPException(status_code=400, detail="No steps found in the plan. Please generate steps first.")

        # Convert steps to format expected by Java runner
        test_steps = []
        logger.info(f" Converting {len(steps_data)} steps to Java runner format")
        
        # Create variable name mapping from bindings
        variable_mapping = {}
        if active_bindings:
            for binding in active_bindings:
                if binding.get('category') == 'price' or binding.get('extract_type') != 'calculated':
                    variable_mapping[binding['name']] = binding['name']
            logger.info(f"🔗 Created variable mapping: {variable_mapping}")
            if binding.type == "extract":
                    variable_mapping[binding.name] = binding.name
            logger.info(f"🔗 Created variable mapping: {variable_mapping}")
        
        for i, step in enumerate(steps_data):
            logger.info(f" Step {i+1}: {step}")
            
            # Process step with binding resolution
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
                    mapped_name = variable_mapping[variable_name]
                    logger.info(f"🔗 Mapping extract_data variable: {variable_name} -> {mapped_name}")
                    # Set the data field to the mapped variable name for Java runner
                    processed_step['data'] = mapped_name
                elif variable_name:
                    logger.info(f"🔗 Using extract_data variable: {variable_name}")
                    processed_step['data'] = variable_name
                else:
                    logger.warning(f" extract_data step missing variable name")
            
            # Special handling for variable patterns in assertion steps
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
                
                logger.info(f" Checking step for variables: action='{action}', text='{text_value}'")
                
                # Check for any ${variableName} pattern
                import re
                variable_pattern = r'\$\{([^}]+)\}'
                variables_found = re.findall(variable_pattern, str(text_value)) if text_value else []
                
                logger.info(f" Variables found in text: {variables_found}")
                
                # If this is an assert_text step with any variable pattern
                if action == 'assert_text' and isinstance(text_value, str) and variables_found:
                    logger.info(f"🔗 Processing variable assertion step with variables: {variables_found}")
                    
                    modified_step = step_data.copy()
                    new_text = text_value
                    
                    # Process each variable found
                    for variable_name in variables_found:
                        logger.info(f"🔗 Processing variable: {variable_name}")
                        
                        # Calculate variable value based on bindings
                        # Variable replacement is now handled by Java runner during execution
                        if active_bindings:
                            # Check if this variable is defined in our bindings
                            for binding in active_bindings:
                                if binding['name'] == variable_name:
                                    logger.info(f"🔗 Found binding for {variable_name}: {binding.get('category', 'unknown')} type")
                                    break
                            else:
                                logger.info(f"🔗 Variable {variable_name} not found in active bindings - will be processed at runtime")
                        
                        # Variable replacement will be handled by Java runner at execution time
                        # Just log that we found variables for now
                        logger.info(f"🔗 Variable {variable_name} will be processed during execution")
                    
                    logger.info(f"🔗 Text with variables: '{new_text}' (variables will be resolved at runtime)")
                    
                    # Keep the original text with variables for Java runner to process
                    
                    # Update the text value in the appropriate format (keep original with variables)
                    if 'args' in modified_step:
                        modified_step['args']['text'] = text_value  # Keep original text with variables
                    elif 'params' in modified_step:
                        modified_step['params']['text'] = text_value  # Keep original text with variables
                    else:
                        modified_step['text'] = text_value  # Keep original text with variables
                    
                    logger.info(f"🔗 Kept original text with variables: '{text_value}'")
                    return modified_step
                
                logger.info(f" No variable processing needed for step")
                return step_data
            
            # Apply variable processing
            processed_step = process_variable_step(processed_step)
            
            logger.info(f" Step {i+1} after processing: action={processed_step.get('action', processed_step.get('name', ''))}")
            if 'args' in processed_step:
                logger.info(f" Step {i+1} args.text: '{processed_step.get('args', {}).get('text', '')}'")
            if 'params' in processed_step:
                logger.info(f" Step {i+1} params.text: '{processed_step.get('params', {}).get('text', '')}'")
            
            logger.debug(f"🔗 Processed step {i+1} with variable resolution")
            
            # Handle different step formats with special logic for extract_data and calculate actions
            action = processed_step.get('action', processed_step.get('name', ''))
            
            # Special handling for extract_data steps
            if action == 'extract_data':
                if 'args' in processed_step:
                    step_args = processed_step.get('args', {})
                    variable_name = step_args.get('variable', step_args.get('data', ''))
                    # Apply selector policy instead of direct assignment
                    locator = await get_policy_based_selector(prompt_id, i, step_args, db)
                    element_index = step_args.get('element_index') or step_args.get('index')  # Get element_index or index if present
                elif 'params' in processed_step:
                    step_params = processed_step.get('params', {})
                    variable_name = step_params.get('variable', step_params.get('data', ''))
                    # Apply selector policy instead of direct assignment
                    locator = await get_policy_based_selector(prompt_id, i, step_params, db)
                    element_index = step_params.get('element_index') or step_params.get('index')  # Get element_index or index if present
                else:
                    variable_name = processed_step.get('variable', processed_step.get('data', ''))
                    # Apply selector policy instead of direct assignment
                    locator = await get_policy_based_selector(prompt_id, i, processed_step, db)
                    element_index = processed_step.get('element_index') or processed_step.get('index')
                
                # Build the data field with element_index if present
                data_field = variable_name
                if element_index is not None:
                    # Include element_index in the data field as JSON for Java parsing
                    import json
                    data_field = json.dumps({"variable": variable_name, "index": element_index})
                    logger.info(f"🔢 Including element index {element_index} for variable {variable_name}")
                
                test_steps.append({
                    "step_id": f"step_{i+1}",
                    "action": action,
                    "locator": locator,
                    "value": data_field,  # For extract_data, put variable name and index in value field
                    "description": f"Extract data into variable: {variable_name}" + (f" (index {element_index})" if element_index is not None else "")
                })
                logger.info(f" Extract_data step: variable='{variable_name}', locator='{locator}'" + (f", element_index={element_index}" if element_index is not None else ""))
                
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
                })
                logger.info(f" Calculate step: formula='{formula}', result_var='{result_var}'")
                
            # Handle other step formats normally
            elif 'args' in processed_step:
                # New AI format with 'args'
                step_args = processed_step.get('args', {})
                # Apply selector policy
                policy_locator = await get_policy_based_selector(prompt_id, i, step_args, db)
                test_steps.append({
                    "step_id": f"step_{i+1}",
                    "action": action,
                    "locator": policy_locator,
                    "value": step_args.get('text', '') or step_args.get('url', '') or step_args.get('value', ''),
                    "description": step_args.get('description', '')
                })
            elif 'params' in processed_step:
                # Another format with 'params'
                step_params = processed_step.get('params', {})
                # Apply selector policy
                policy_locator = await get_policy_based_selector(prompt_id, i, step_params, db)
                test_steps.append({
                    "step_id": f"step_{i+1}",
                    "action": processed_step.get('name', action),
                    "locator": policy_locator,
                    "value": step_params.get('text', '') or step_params.get('url', '') or step_params.get('value', ''),
                    "description": step_params.get('description', '')
                })
            else:
                # Direct format
                # Apply selector policy
                policy_locator = await get_policy_based_selector(prompt_id, i, processed_step, db)
                test_steps.append({
                    "step_id": f"step_{i+1}",
                    "action": action,
                    "locator": policy_locator,
                    "value": processed_step.get('text', '') or processed_step.get('url', '') or processed_step.get('value', ''),
                    "description": processed_step.get('description', '')
                })
        
        logger.info(f" Converted {len(test_steps)} steps for Java runner")
        
        # ENFORCE DATABASE MODE: Create execution record FIRST
        execution_id = await create_execution_record(db, prompt_id, test_steps)
        logger.info(f" Created execution record in database: {execution_id}")
        
        # Start execution WITH database tracking enforced
        background_tasks.add_task(
            execute_java_test_background,
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
        logger.error(f"Error executing prompt {prompt_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to execute prompt: {str(e)}")

async def create_execution_record(db: DatabaseManager, prompt_id: str, steps: List[Dict]) -> str:
    """Create a new execution record using proper exec.runs table"""
    try:
        # First, find any existing test case to see what project_id is actually used
        try:
            existing_test_case = await db.execute("SELECT project_id FROM tests.test_cases LIMIT 1")
            if existing_test_case and existing_test_case[0]['project_id']:
                project_uuid = existing_test_case[0]['project_id']
                logger.info(f" Using project_id from existing test case: {project_uuid}")
            else:
                # If no test cases exist, we have a chicken-and-egg problem
                # Let's see what project_id values exist in the exec.runs table
                existing_run = await db.execute("SELECT project_id FROM exec.runs WHERE project_id IS NOT NULL LIMIT 1")
                if existing_run and existing_run[0]['project_id']:
                    project_uuid = existing_run[0]['project_id'] 
                    logger.info(f" Using project_id from existing run: {project_uuid}")
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
                                logger.info(f" Found project in {schema_name}.projects: {project_uuid}")
                            else:
                                raise Exception("Projects table found but empty")
                        else:
                            raise Exception("No projects table found in any schema")
                    except Exception as e:
                        logger.error(f"Could not find valid project reference: {e}")
                        raise
        except Exception as e:
            logger.error(f"Error finding valid project_id: {e}")
            raise
        
        # Use confirmed existing environment UUID
        environment_uuid = uuid.UUID('7be51048-fe28-4aa8-987f-5c0faba285c0')
        logger.info(f" Using confirmed environment: {environment_uuid}")
        
        # Use confirmed existing user UUID
        created_by_uuid = uuid.UUID('25616325-6f9d-4dad-8e4d-16affd24e7cf')
        logger.info(f" Using confirmed user: {created_by_uuid}")
        
        # Create or get a test case record in the tests.test_cases table
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
        )
        
        logger.info(f" Created/ensured test case in tests.test_cases: {test_case_uuid}")
        
        # Now insert into exec.runs table with the test case reference
        execution_query = """
        INSERT INTO exec.runs (
            test_case_id,
            project_id,
            environment_id,
            runner_meta,
            status,
            started_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        """
        
        execution_result = await db.execute_one(
            execution_query,
            test_case_uuid,  # Reference to test case in tests schema
            project_uuid,  # Use discovered valid project UUID
            environment_uuid,  # Fixed environment UUID
            json.dumps({
                "total_steps": len(steps),
                "steps_preview": steps[:3] if len(steps) > 3 else steps,
                "execution_type": "api_triggered",
                "framework_version": "1.0",
                "prompt_id": prompt_id,
                "test_case_name": f"Prompt-driven test: {prompt_id[:8]}",
                "triggered_by": "api-execution",
                "project_name": "self-healing-framework",
                "environment_name": "development"
            }),
            "running",
            datetime.now()
        )
        
        execution_id = str(execution_result["id"])
        logger.info(f" Created execution record in exec.runs: {execution_id}")
        
        # Also create step_results records for each step
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
            # Prefer explicit elementId if present (from Java-formatted steps), fall back to locator/selector
            target_value = None
            if isinstance(step, dict):
                target_value = step.get('elementId') or step.get('element_id') or step.get('locator') or step.get('selector') or ''
            else:
                target_value = step

            await db.execute_one(
                step_query,
                execution_id,  # This should reference our exec.runs record
                i + 1,
                step.get("action", "unknown"),
                target_value,
                "pending"
            )
        
        logger.info(f" Created {len(steps)} step records in exec.step_results")
        return execution_id
        
    except Exception as e:
        logger.error(f"Error creating execution record: {str(e)}")
        raise

def execute_java_test_background(prompt_id: str, test_steps: List[Dict], execution_id: str, bindings: Optional[List[Dict]] = None):
    """Background execution with ENFORCED database mode"""
    try:
        logger.info(f" Starting DATABASE-TRACKED execution for prompt {prompt_id}, execution_id: {execution_id}")
        logger.info(f"🔍 Received {len(test_steps)} test steps for background execution")
        
        # Log the first step to debug format issues
        if test_steps:
            logger.info(f"📋 First received step format: {json.dumps(test_steps[0], indent=2)}")

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
                    
                    # M7 SCRUM-16: Record binding usage for traceability
                    if bindings:
                        # Ensure binding usage table exists
                        cur.execute("""
                            CREATE TABLE IF NOT EXISTS exec.binding_usage (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                execution_id UUID NOT NULL REFERENCES exec.runs(id) ON DELETE CASCADE,
                                binding_name VARCHAR(255) NOT NULL,
                                binding_scope VARCHAR(255),
                                binding_value JSONB,
                                usage_context JSONB,
                                step_order INTEGER,
                                action_type VARCHAR(100),
                                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                                created_by UUID
                            );
                            
                            CREATE INDEX IF NOT EXISTS idx_binding_usage_execution 
                            ON exec.binding_usage(execution_id);
                            
                            CREATE INDEX IF NOT EXISTS idx_binding_usage_binding_name 
                            ON exec.binding_usage(binding_name);
                        """)
                        
                        logger.info(f"🔗 Recording {len(bindings)} binding usages for execution {execution_id}")
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
                                'prompt_id': prompt_id,
                                'execution_id': execution_id,
                                'execution_status': status,
                                'binding_source': 'data_resolver',
                                'recorded_during': 'execution_completion'
                            }
                            
                            # Insert binding usage record
                            cur.execute("""
                                INSERT INTO exec.binding_usage 
                                (execution_id, binding_name, binding_scope, binding_value, usage_context, recorded_at)
                                VALUES (%s, %s, %s, %s, %s, NOW())
                                ON CONFLICT DO NOTHING
                            """, (
                                execution_id,
                                binding_name,
                                binding_scope,
                                json.dumps(binding_value),
                                json.dumps(usage_context)
                            ))
                        
                        logger.info(f"✅ Recorded binding usage for {len(bindings)} bindings")
                    
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
                    cur.execute("""
                        UPDATE exec.runs 
                        SET status = %s
                        WHERE id = %s
                    """, (status, execution_id))
                
                conn.commit()
                cur.close()
                conn.close()
                
                logger.info(f" Updated execution {execution_id} status to: {status}")
                return True
                
            except Exception as e:
                logger.error(f"Error updating database status: {str(e)}")
                return False

        # Update status to running
        update_db_status_sync("running", "Test execution in progress")

        # Convert to Java runner format
        java_steps = []
        for step in test_steps:
            # Check if steps are already in Java format (from AI debug execution)
            if "elementId" in step and "page" in step:
                # Steps are already in Java format, use as-is
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
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(java_steps, f, indent=2)  # Write steps array directly, not wrapped in object
            temp_file = f.name

        java_runner_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../java-runner"))
        
        # On Windows, we need to be careful with classpath and path separators
        if os.name == 'nt':
            classpath = "target\\classes;lib\\*"
            temp_file_java = temp_file.replace('\\', '/')
        else:
            classpath = "target/classes:lib/*"
            temp_file_java = temp_file
        
        cmd_parts = ["java", "-Djava.awt.headless=false", "-Dtest.visible=true", "-cp", classpath, "demo.Main", temp_file_java]
        logger.info(f" Background execution: {' '.join(cmd_parts)}")

        # Use regular subprocess in a daemon thread
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
                
                logger.info(f" Background Java process started with PID: {process.pid}")
                
                # Read output line by line
                while True:
                    line = process.stdout.readline()
                    if not line:
                        break
                    line = line.strip()
                    if line:
                        logger.info(f"[JAVA BG]: {line}")
                
                return_code = process.wait()
                logger.info(f" Background Java process completed with return code: {return_code}")
                
                # Parse results and update database
                try:
                    results_file = os.path.join(java_runner_dir, "run_summary.json")
                    if os.path.exists(results_file):
                        with open(results_file, 'r') as f:
                            results = json.load(f)
                        
                        # Determine final status
                        final_status = "completed" if return_code == 0 else "failed"
                        
                        # Update database with final results
                        update_db_status_sync(
                            final_status,
                            f"Test execution finished with return code {return_code}",
                            results
                        )
                        logger.info(f" Database updated with final status: {final_status}")
                    else:
                        # No results file, mark as failed
                        update_db_status_sync(
                            "failed",
                            f"Test execution failed - no results file generated (return code: {return_code})"
                        )
                        logger.warning(f" No results file found at: {results_file}")
                        
                except Exception as e:
                    logger.error(f" Error updating final database status: {str(e)}")
                    # Still try to mark as completed/failed
                    try:
                        final_status = "completed" if return_code == 0 else "failed"
                        update_db_status_sync(final_status, f"Execution finished (parse error: {str(e)})")
                    except:
                        pass
                
                # Clean up temp file
                try:
                    os.unlink(temp_file)
                    logger.info(f" Cleaned up temp file: {temp_file}")
                except Exception as e:
                    logger.warning(f" Failed to cleanup temp file: {e}")
                    
            except Exception as e:
                logger.error(f" Error in background Java execution: {str(e)}")
                # Mark execution as failed in database
                try:
                    update_db_status_sync("failed", f"Java execution error: {str(e)}")
                except:
                    pass
                try:
                    os.unlink(temp_file)
                except:
                    pass
        
        # Start daemon thread
        thread = threading.Thread(target=run_java, daemon=True)
        thread.start()
        
        logger.info(f" Background Java execution thread started")
        
    except Exception as e:
        logger.error(f" Error starting background execution: {str(e)}")
        # Mark execution as failed in database
        try:
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            async def mark_failed():
                try:
                    db = await get_database()
                    await update_execution_status(db, execution_id, "failed", f"Failed to start execution: {str(e)}")
                except:
                    pass
            
            loop.run_until_complete(mark_failed())
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
                current_meta["passed_steps"] = len([s for s in results["steps"] if s.get("status") == "passed"])
                current_meta["failed_steps"] = len([s for s in results["steps"] if s.get("status") == "failed"])
        
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
        logger.info(f" Checking results for step updates: {type(results)} - {bool(results)}")
        
        if results and "results" in results:
            step_results = results["results"]
            logger.info(f" Found {len(step_results)} step results in results['results']")
        elif results and "steps" in results:
            step_results = results["steps"]
            logger.info(f" Found {len(step_results)} step results in results['steps']")
        else:
            logger.warning(f" No step results found. Results keys: {list(results.keys()) if results else 'None'}")
            
        if step_results:
            logger.info(f" Updating {len(step_results)} step statuses...")
            for i, step_result in enumerate(step_results):
                step_update_query = """
                UPDATE exec.step_results 
                SET 
                    status = $1,
                    error_message = $2
                WHERE test_run_id = $3 AND step_order = $4
                """
                
                # Java uses "PASS"/"FAIL", convert to database format
                java_status = step_result.get("status", "unknown")
                logger.info(f" Step {i+1}: Java status = {java_status}")
                if java_status == "PASS":
                    db_status = "passed"
                elif java_status == "FAIL":
                    db_status = "failed"
                else:
                    db_status = java_status.lower()
                
                error_msg = step_result.get("error", step_result.get("message", None))
                step_index = step_result.get("stepIndex", step_result.get("index", 0))
                
                await db.execute_one(
                    step_update_query,
                    db_status,
                    error_msg,
                    execution_id,
                    step_index + 1  # Convert 0-based to 1-based indexing
                )
            
            logger.info(f" Updated {len(step_results)} step statuses in exec.step_results")
        
        logger.info(f" Updated execution {execution_id} status to: {status}")
        
    except Exception as e:
        logger.error(f"Error updating execution status: {str(e)}")


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
        
        logger.info(f"🚀 Executing {len(steps)} AI debug steps for prompt {prompt_id}")
        
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
                    logger.info(f"📁 Using project: {project_uuid}")
                else:
                    raise Exception("Projects table found but empty")
            else:
                raise Exception("No projects table found in any schema")
        except Exception as e:
            logger.error(f"Could not find valid project reference: {e}")
            raise
        
        # Use confirmed existing environment UUID
        environment_uuid = uuid.UUID('7be51048-fe28-4aa8-987f-5c0faba285c0')
        
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
        )
        
        logger.info(f"📋 Created test case for debug execution: {test_case_uuid}")
        
        # Create a test run record
        run_id = str(uuid.uuid4())
        
        run_insert_query = """
        INSERT INTO exec.runs (id, test_case_id, project_id, environment_id, status, started_at, runner_meta)
        VALUES ($1, $2, $3, $4, 'running', $5, $6)
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
            str(environment_uuid),
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
                    logger.warning(f"Type step {step_order} missing text value - using empty string")
            elif action in ["verify_text", "assert_text"]:
                # For text verification, use the expected text value from params or original
                data_value = text_value if text_value else step.get('text_value', '')
                if not data_value:
                    logger.warning(f"Verify text step {step_order} missing expected text value")
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
        
        logger.info(f"🔧 Converted {len(formatted_steps)} AI debug steps to Java runner format using original selectors")
        
        # Log the first step to debug format issues
        if formatted_steps:
            logger.info(f"📋 First debug step format: {json.dumps(formatted_steps[0], indent=2)}")
            
            # Log ALL steps to debug format issues
            logger.info(f"📋 All {len(formatted_steps)} debug step formats:")
            for i, step in enumerate(formatted_steps):
                logger.info(f"  Step {i+1}: {json.dumps(step, indent=2)}")
                
                # Check for variable references that might cause Java runner issues
                data_field = step.get('data', '')
                locator_field = step.get('locator', '')
                
                if '${' in str(data_field):
                    logger.warning(f"⚠️ Step {i+1} has variable reference in data: '{data_field}'")
                if '${' in str(locator_field):
                    logger.warning(f"⚠️ Step {i+1} has variable reference in locator: '{locator_field}'")
                    
                # Check for any None values that might cause issues
                for field_name, field_value in step.items():
                    if field_value is None:
                        logger.warning(f"⚠️ Step {i+1} has None value for field '{field_name}'")
        
        # Execute the steps using the same Java runner as normal execution
        background_tasks.add_task(
            execute_java_test_background,
            prompt_id,
            formatted_steps,
            run_id,
            []  # No data bindings for debug runs
        )
        
        logger.info(f"✅ Debug steps execution started in background: {run_id}")
        
        return {
            "success": True,
            "execution_id": run_id,
            "steps_count": len(steps),
            "message": f"AI debug steps execution started successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to execute debug steps: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to execute debug steps: {str(e)}")