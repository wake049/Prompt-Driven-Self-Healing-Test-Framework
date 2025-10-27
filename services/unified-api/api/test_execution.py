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

logger = logging.getLogger(__name__)
router = APIRouter()

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
        
        # Load active data bindings from datahub.data_bindings table
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
                logger.info(f"🔗 Found {len(db_bindings)} active data bindings from datahub")
                
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
                    locator = step_args.get('selector', step_args.get('locator', ''))
                    element_index = step_args.get('element_index') or step_args.get('index')  # Get element_index or index if present
                elif 'params' in processed_step:
                    step_params = processed_step.get('params', {})
                    variable_name = step_params.get('variable', step_params.get('data', ''))
                    locator = step_params.get('selector', step_params.get('locator', ''))
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
                    data_field = json.dumps({"variable": variable_name, "element_index": element_index})
                
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
            
            await db.execute_one(
                step_query,
                execution_id,  # This should reference our exec.runs record
                i + 1,
                step.get("action", "unknown"),
                step.get("locator", step.get("selector", "")),
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