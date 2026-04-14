"""
📄 Document-to-Test Scenarios API
Upload business documents and generate test scenarios using AI via MCP server.

🔒 PRIVACY PROTECTION:
- Client-side anonymization: Sensitive data is redacted BEFORE leaving the browser
- Placeholder mapping: [COMPANY_A], [PERSON_B], etc. replace real values
- Optional de-anonymization: Restore original values in generated scenarios
- Sensitive business data never reaches external AI providers
"""

import json
import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel

from core.database import get_database, DatabaseManager
from core.auth import get_current_active_user, get_optional_current_user
from models.auth_models import CurrentUser
from services.document_processing_service import (
    DocumentProcessor,
    TestScenarioGenerator,
    SUPPORTED_EXTENSIONS,
    MAX_DOCUMENT_SIZE,
    TEST_TYPE_UI,
    TEST_TYPE_API,
    DEFAULT_TEST_TYPES
)
from services.anonymization_service import (
    anonymization_service,
    deanonymize_scenarios,
    validate_anonymization
)

logger = logging.getLogger("document_to_tests_api")
router = APIRouter()


def _build_ac_description_map(acceptance_criteria: List[Dict[str, Any]]) -> Dict[str, str]:
    """Build AC id -> description map for traceability enrichment."""
    ac_map: Dict[str, str] = {}
    for ac in acceptance_criteria or []:
        ac_id = str(ac.get("id") or "").strip()
        ac_desc = str(ac.get("description") or "").strip()
        if ac_id and ac_desc:
            ac_map[ac_id] = ac_desc
    return ac_map


def _format_source_section(ac_id: str, ac_desc: str) -> str:
    """Format a human-readable source section label."""
    short_desc = ac_desc.strip()
    if len(short_desc) > 160:
        short_desc = short_desc[:157].rstrip() + "..."
    return f"{ac_id} - {short_desc}" if short_desc else ac_id


def _enrich_scenarios_with_traceability(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ensure each scenario has a `source_section` value.
    Preference order:
    1) existing scenario.source_section
    2) map first covers_ac entry to AC description
    """
    scenarios = result.get("scenarios") or []
    if not isinstance(scenarios, list):
        return result

    ac_map = _build_ac_description_map(result.get("acceptance_criteria") or [])
    for scenario in scenarios:
        if not isinstance(scenario, dict):
            continue

        existing = str(scenario.get("source_section") or "").strip()
        if existing:
            continue

        covers_ac = scenario.get("covers_ac") or []
        if isinstance(covers_ac, list) and covers_ac:
            primary_ac = str(covers_ac[0]).strip()
            if primary_ac:
                scenario["source_section"] = _format_source_section(primary_ac, ac_map.get(primary_ac, ""))

    result["scenarios"] = scenarios
    return result


class PlaceholderMappingModel(BaseModel):
    """Placeholder mapping from client-side anonymization"""
    placeholder: str
    original: str
    type: str
    count: Optional[int] = 1


class GenerateScenariosRequest(BaseModel):
    """Request model for generating scenarios from text content"""
    content: str  # Should be anonymized content from client
    document_name: Optional[str] = "inline_content"
    document_type: Optional[str] = "text"
    save_as_prompts: Optional[bool] = False
    starting_url: Optional[str] = ""
    # Test type selection - UI only by default (this is a UI testing framework)
    test_types: Optional[List[str]] = None  # ["ui"], ["api"], or ["ui", "api"]
    # Anonymization support
    anonymization_mappings: Optional[List[PlaceholderMappingModel]] = None
    deanonymize_response: Optional[bool] = False  # If True, restore originals in response
    validate_anonymization: Optional[bool] = True  # Check for unredacted sensitive data


class RefineScenaringRequest(BaseModel):
    """Request model for refining scenarios based on user feedback"""
    scenarios: List[Dict[str, Any]]
    feedback: str
    document_summary: Optional[str] = ""
    document_name: Optional[str] = ""
    # Anonymization support
    anonymization_mappings: Optional[List[PlaceholderMappingModel]] = None
    deanonymize_response: Optional[bool] = False


class ConfirmScenariosRequest(BaseModel):
    """Request model for confirming and saving scenarios as prompts"""
    scenarios: List[Dict[str, Any]]
    document_name: Optional[str] = ""
    starting_url: Optional[str] = ""
    # Anonymization support - restore originals before saving
    anonymization_mappings: Optional[List[PlaceholderMappingModel]] = None
    deanonymize_before_save: Optional[bool] = True  # Usually want originals saved


class GenerateScenariosResponse(BaseModel):
    """Response model for generated scenarios"""
    success: bool
    scenarios: List[Dict[str, Any]]
    summary: str
    total_scenarios: int
    saved_prompt_ids: Optional[List[str]] = None
    message: Optional[str] = None


@router.post("/upload", response_model=Dict[str, Any])
async def upload_document_generate_tests(
    file: UploadFile = File(...),
    save_as_prompts: bool = Form(default=False),
    starting_url: str = Form(default=""),
    test_types: str = Form(default="ui"),  # Comma-separated: "ui", "api", or "ui,api"
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """
    Upload a business document and generate test scenarios.
    
    Supported formats: .txt, .md, .pdf, .docx
    Max file size: 50MB
    
    The document is processed locally, and only the extracted text is sent
    to the AI via the MCP server for test scenario generation.
    
    Args:
        file: The uploaded document file
        save_as_prompts: If True, save generated scenarios as prompts in the database
        starting_url: Optional starting URL for all generated test scenarios
        test_types: Comma-separated test types to generate ("ui", "api", or "ui,api")
        
    Returns:
        Generated test scenarios with option to save as prompts
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        # Check file extension
        from pathlib import Path
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
            )
        
        # Read file content
        content = await file.read()
        
        # Check file size
        if len(content) > MAX_DOCUMENT_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_DOCUMENT_SIZE // (1024*1024)}MB"
            )
        
        logger.info(f"📄 Processing document: {file.filename} ({len(content)} bytes)")
        
        # Extract text from document
        extracted_text, doc_type = await DocumentProcessor.extract_text(content, file.filename)
        
        if not extracted_text or len(extracted_text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Document appears to be empty or contains too little text to generate test scenarios"
            )
        
        logger.info(f"📝 Extracted {len(extracted_text)} characters from {doc_type} document")
        
        # Parse test types from comma-separated string
        test_types_list = [t.strip().lower() for t in test_types.split(',') if t.strip()]
        if not test_types_list:
            test_types_list = DEFAULT_TEST_TYPES
        # Validate test types
        valid_types = {TEST_TYPE_UI, TEST_TYPE_API}
        test_types_list = [t for t in test_types_list if t in valid_types] or DEFAULT_TEST_TYPES
        
        logger.info(f"🎯 Generating test types: {test_types_list}")
        
        # Generate test scenarios via AI
        result = await _generate_scenarios_via_ai(
            document_content=extracted_text,
            document_type=doc_type,
            document_name=file.filename,
            db=db,
            test_types=test_types_list
        )
        
        # Optionally save as prompts
        saved_prompt_ids = []
        if save_as_prompts and result.get("scenarios"):
            saved_prompt_ids = await _save_scenarios_as_prompts(
                scenarios=result["scenarios"],
                document_name=file.filename,
                starting_url=starting_url,
                current_user=current_user,
                db=db
            )
        
        return {
            "success": True,
            "document_name": file.filename,
            "document_type": doc_type,
            "extracted_length": len(extracted_text),
            "scenarios": result.get("scenarios", []),
            "acceptance_criteria": result.get("acceptance_criteria", []),
            "ac_coverage_matrix": result.get("ac_coverage_matrix", {}),
            "happy_paths_per_ac": result.get("happy_paths_per_ac", result.get("happy_path_per_ac", {})),
            "summary": result.get("summary", ""),
            "total_scenarios": result.get("total_scenarios", len(result.get("scenarios", []))),
            "saved_prompt_ids": saved_prompt_ids if save_as_prompts else None,
            "test_types": test_types_list,
            "message": f"Generated {len(result.get('scenarios', []))} test scenarios from document"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error processing document: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")


@router.post("/generate-from-text", response_model=Dict[str, Any])
async def generate_tests_from_text(
    request: GenerateScenariosRequest,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """
    Generate test scenarios from raw text content.
    
    🔒 ANONYMIZATION SUPPORT:
    - Content should be pre-anonymized by the client with placeholders
    - Pass anonymization_mappings to enable de-anonymization of results
    - Set validate_anonymization=True to check for unredacted sensitive data
    - Set deanonymize_response=True to restore originals in returned scenarios
    
    Args:
        request: Request containing text content and anonymization options
        
    Returns:
        Generated test scenarios (optionally de-anonymized)
    """
    try:
        if not request.content or len(request.content.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Content too short. Please provide more context for test generation."
            )
        
        # Validate anonymization if requested
        anonymization_warning = None
        if request.validate_anonymization:
            validation = validate_anonymization(request.content, strict=False)
            if validation["issues"]:
                anonymization_warning = {
                    "message": "Potential sensitive data detected in content",
                    "issues": validation["issues"],
                    "placeholder_count": validation["placeholder_count"]
                }
                logger.warning(f"⚠️ Anonymization validation: {validation['issues']}")
        
        # Parse and validate test types
        test_types_list = request.test_types or DEFAULT_TEST_TYPES
        valid_types = {TEST_TYPE_UI, TEST_TYPE_API}
        test_types_list = [t for t in test_types_list if t in valid_types] or DEFAULT_TEST_TYPES
        
        logger.info(f"📝 Generating {test_types_list} scenarios from {'anonymized ' if request.anonymization_mappings else ''}text content ({len(request.content)} chars)")
        
        # Generate test scenarios via AI (using anonymized content)
        result = await _generate_scenarios_via_ai(
            document_content=request.content,
            document_type=request.document_type,
            document_name=request.document_name,
            db=db,
            test_types=test_types_list
        )
        
        scenarios = result.get("scenarios", [])
        
        # Optionally de-anonymize the response
        if request.deanonymize_response and request.anonymization_mappings and scenarios:
            mappings = [m.model_dump() for m in request.anonymization_mappings]
            scenarios = deanonymize_scenarios(scenarios, mappings)
            logger.info(f"🔓 De-anonymized {len(scenarios)} scenarios")
        
        # Optionally save as prompts
        saved_prompt_ids = []
        if request.save_as_prompts and scenarios:
            # De-anonymize before saving if we have mappings (usually want originals)
            save_scenarios = scenarios
            if request.anonymization_mappings and not request.deanonymize_response:
                mappings = [m.model_dump() for m in request.anonymization_mappings]
                save_scenarios = deanonymize_scenarios(scenarios, mappings)
            
            saved_prompt_ids = await _save_scenarios_as_prompts(
                scenarios=save_scenarios,
                document_name=request.document_name,
                starting_url=request.starting_url,
                current_user=current_user,
                db=db
            )
        
        response = {
            "success": True,
            "document_name": request.document_name,
            "document_type": request.document_type,
            "scenarios": scenarios,  # Use the (possibly de-anonymized) scenarios
            "acceptance_criteria": result.get("acceptance_criteria", []),
            "ac_coverage_matrix": result.get("ac_coverage_matrix", {}),
            "happy_paths_per_ac": result.get("happy_paths_per_ac", result.get("happy_path_per_ac", {})),
            "summary": result.get("summary", ""),
            "total_scenarios": len(scenarios),
            "saved_prompt_ids": saved_prompt_ids if request.save_as_prompts else None,
            "test_types": test_types_list,
            "message": f"Generated {len(scenarios)} test scenarios",
            "anonymization": {
                "was_anonymized": bool(request.anonymization_mappings),
                "was_deanonymized": request.deanonymize_response and bool(request.anonymization_mappings),
                "mapping_count": len(request.anonymization_mappings) if request.anonymization_mappings else 0
            }
        }
        
        # Include warning if sensitive data was detected
        if anonymization_warning:
            response["anonymization_warning"] = anonymization_warning
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error generating scenarios: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate scenarios: {str(e)}")


@router.get("/supported-formats")
async def get_supported_formats():
    """Get list of supported document formats and test types"""
    return {
        "formats": list(SUPPORTED_EXTENSIONS),
        "max_size_mb": MAX_DOCUMENT_SIZE // (1024 * 1024),
        "description": "Upload business documents to automatically generate test scenarios",
        "test_types": [
            {
                "id": TEST_TYPE_UI,
                "name": "UI Testing",
                "description": "Browser-based testing with Selenium/Playwright. Generate scenarios for web UI interactions.",
                "default": True
            },
            {
                "id": TEST_TYPE_API,
                "name": "API Testing",
                "description": "Backend service testing. Generate scenarios for REST API endpoints and responses.",
                "default": False
            }
        ],
        "default_test_types": list(DEFAULT_TEST_TYPES)
    }


@router.get("/test-types")
async def get_test_types():
    """Get available test types for scenario generation"""
    return {
        "success": True,
        "test_types": [
            {
                "id": TEST_TYPE_UI,
                "name": "UI Testing",
                "description": "Browser-based testing with Selenium/Playwright. Generate scenarios for clicking buttons, filling forms, verifying page content, and navigating through the application.",
                "icon": "monitor",
                "default": True,
                "examples": [
                    "Click the 'Submit' button",
                    "Verify the success message appears",
                    "Navigate to the dashboard page"
                ]
            },
            {
                "id": TEST_TYPE_API,
                "name": "API Testing",
                "description": "Backend REST API testing. Generate scenarios for HTTP requests, response validation, authentication, and data integrity checks.",
                "icon": "code",
                "default": False,
                "examples": [
                    "[API] POST /api/v1/users with valid payload",
                    "[API] Verify response status 200 OK",
                    "[API] Validate JSON schema of response"
                ]
            }
        ],
        "default_selection": list(DEFAULT_TEST_TYPES),
        "note": "This framework is primarily a UI testing framework. API scenarios are marked with [API] prefix."
    }


class ValidateAnonymizationRequest(BaseModel):
    """Request to validate anonymization of content"""
    content: str
    strict: Optional[bool] = False


@router.post("/validate-anonymization", response_model=Dict[str, Any])
async def validate_content_anonymization(request: ValidateAnonymizationRequest):
    """
    Validate that content has been properly anonymized.
    
    🔒 Use this before sending content to AI to ensure sensitive data
    has been properly redacted.
    
    Args:
        request: Content to validate and strictness level
        
    Returns:
        Validation result with any detected issues
    """
    try:
        result = validate_anonymization(request.content, strict=request.strict)
        
        return {
            "success": True,
            "is_valid": result["is_valid"],
            "placeholder_count": result["placeholder_count"],
            "issues": result["issues"],
            "message": result["message"]
        }
        
    except Exception as e:
        logger.error(f"❌ Error validating anonymization: {e}")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@router.post("/refine", response_model=Dict[str, Any])
async def refine_scenarios(
    request: RefineScenaringRequest,
    db: DatabaseManager = Depends(get_database)
):
    """
    Refine test scenarios based on user feedback using AI.
    
    This allows users to:
    - Add more scenarios by describing what's missing
    - Remove scenarios by specifying which ones to remove
    - Modify existing scenarios with specific instructions
    - Ask for suggestions on improving coverage
    
    Example feedback:
    - "Add a scenario for testing invalid email format"
    - "Remove scenario 3, it's out of scope"
    - "Combine scenarios 1 and 2 into one workflow test"
    - "Add more edge cases for the payment flow"
    - "Suggest additional security-related test scenarios"
    
    Args:
        request: Current scenarios and user feedback
        
    Returns:
        Updated scenarios with changes applied
    """
    try:
        if not request.scenarios:
            raise HTTPException(
                status_code=400,
                detail="No scenarios provided for refinement"
            )
        
        if not request.feedback or len(request.feedback.strip()) < 5:
            raise HTTPException(
                status_code=400,
                detail="Please provide feedback for refining scenarios"
            )
        
        logger.info(f"🔄 Refining {len(request.scenarios)} scenarios based on user feedback")
        
        # Refine scenarios via AI
        result = await _refine_scenarios_via_ai(
            current_scenarios=request.scenarios,
            document_summary=request.document_summary or "No document summary available",
            user_feedback=request.feedback,
            db=db
        )
        
        return {
            "success": True,
            "scenarios": result.get("scenarios", request.scenarios),
            "acceptance_criteria": result.get("acceptance_criteria", []),
            "ac_coverage_matrix": result.get("ac_coverage_matrix", {}),
            "happy_paths_per_ac": result.get("happy_paths_per_ac", result.get("happy_path_per_ac", {})),
            "summary": result.get("summary", ""),
            "total_scenarios": result.get("total_scenarios", len(result.get("scenarios", []))),
            "changes_made": result.get("changes_made", []),
            "message": f"Refined scenarios: {len(result.get('scenarios', []))} total"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error refining scenarios: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refine scenarios: {str(e)}")


@router.post("/confirm", response_model=Dict[str, Any])
async def confirm_and_save_scenarios(
    request: ConfirmScenariosRequest,
    current_user: Optional[CurrentUser] = Depends(get_optional_current_user),
    db: DatabaseManager = Depends(get_database)
):
    """
    Confirm and save finalized scenarios as prompts.
    
    🔒 ANONYMIZATION: If anonymization_mappings are provided and
    deanonymize_before_save=True (default), the original values will
    be restored before saving to the database.
    
    Args:
        request: Finalized scenarios to save (with optional anonymization mappings)
        
    Returns:
        List of created prompt IDs
    """
    try:
        if not request.scenarios:
            raise HTTPException(
                status_code=400,
                detail="No scenarios provided to save"
            )
        
        # De-anonymize scenarios before saving if mappings provided
        scenarios_to_save = request.scenarios
        was_deanonymized = False
        
        if request.deanonymize_before_save and request.anonymization_mappings:
            mappings = [m.model_dump() for m in request.anonymization_mappings]
            scenarios_to_save = deanonymize_scenarios(request.scenarios, mappings)
            was_deanonymized = True
            logger.info(f"🔓 De-anonymized {len(scenarios_to_save)} scenarios before saving")
        
        logger.info(f"✅ Confirming and saving {len(scenarios_to_save)} scenarios as prompts")
        
        # Save scenarios as prompts
        saved_prompt_ids = await _save_scenarios_as_prompts(
            scenarios=scenarios_to_save,
            document_name=request.document_name,
            starting_url=request.starting_url,
            current_user=current_user,
            db=db
        )
        
        return {
            "success": True,
            "saved_count": len(saved_prompt_ids),
            "saved_prompt_ids": saved_prompt_ids,
            "message": f"Successfully saved {len(saved_prompt_ids)} test scenarios as prompts",
            "anonymization": {
                "was_deanonymized": was_deanonymized,
                "mapping_count": len(request.anonymization_mappings) if request.anonymization_mappings else 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error saving scenarios: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save scenarios: {str(e)}")


@router.post("/suggest-more", response_model=Dict[str, Any])
async def suggest_additional_scenarios(
    request: RefineScenaringRequest,
    db: DatabaseManager = Depends(get_database)
):
    """
    Ask AI to suggest additional scenarios for better coverage.
    
    This is a convenience endpoint that asks AI to analyze current scenarios
    and suggest additional ones for improved test coverage.
    
    Args:
        request: Current scenarios (feedback field is optional, will use default prompt)
        
    Returns:
        Updated scenarios with AI-suggested additions
    """
    try:
        if not request.scenarios:
            raise HTTPException(
                status_code=400,
                detail="No scenarios provided for analysis"
            )
        
        # Use a default suggestion prompt if no feedback provided
        feedback = request.feedback or """Please analyze the current test scenarios and suggest 
additional scenarios that would improve test coverage. Consider:
- Edge cases that might be missing
- Error handling scenarios
- Security-related tests
- Performance considerations
- User experience edge cases

Add the suggested scenarios to the list."""
        
        logger.info(f"💡 Asking AI to suggest additional scenarios")
        
        # Refine scenarios with suggestion prompt
        result = await _refine_scenarios_via_ai(
            current_scenarios=request.scenarios,
            document_summary=request.document_summary or "No document summary available",
            user_feedback=feedback,
            db=db
        )
        
        # Calculate how many were added
        original_count = len(request.scenarios)
        new_count = len(result.get("scenarios", []))
        added_count = max(0, new_count - original_count)
        
        return {
            "success": True,
            "scenarios": result.get("scenarios", request.scenarios),
            "summary": result.get("summary", ""),
            "total_scenarios": new_count,
            "added_count": added_count,
            "changes_made": result.get("changes_made", []),
            "message": f"AI suggested {added_count} additional scenario(s)"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error suggesting scenarios: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to suggest scenarios: {str(e)}")


async def _generate_scenarios_via_ai(
    document_content: str,
    document_type: str,
    document_name: str,
    db: DatabaseManager,
    test_types: List[str] = None
) -> Dict[str, Any]:
    """
    Generate test scenarios using AI via MCP server pipeline.
    
    This ensures sensitive business data stays within the secure MCP infrastructure.
    
    Args:
        document_content: Extracted text from the document
        document_type: Type of document (pdf, docx, etc.)
        document_name: Original filename
        db: Database manager
        test_types: List of test types to generate - ["ui"], ["api"], or ["ui", "api"]
    """
    try:
        # Import the AI service for making AI calls
        from api.ai_service import EnterpriseAIService
        
        # Build prompts for AI with test type guidance
        prompts = TestScenarioGenerator.build_ai_prompt(
            document_content=document_content,
            document_type=document_type,
            document_name=document_name,
            test_types=test_types or DEFAULT_TEST_TYPES
        )
        
        # Initialize AI service
        ai_service = EnterpriseAIService()
        
        # Call AI with the document analysis prompt
        # Using JSON response format for structured output
        response = await ai_service._chat_json(
            model="gpt-4o-mini",
            system=prompts["system"],
            user=prompts["user"],
            max_tokens=16000,  # Increased for comprehensive scenario coverage
            temperature=0.3,  # Lower temperature for more consistent output
            retries=2,
            timeout_ms=180000  # 3 minute timeout for comprehensive generation
        )
        
        # Parse the AI response
        result = TestScenarioGenerator.parse_ai_response(response)
        result = _enrich_scenarios_with_traceability(result)
        
        logger.info(f"✅ AI generated {len(result.get('scenarios', []))} test scenarios")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ AI generation failed: {e}")
        # Return empty result on failure
        return {
            "scenarios": [],
            "summary": f"AI generation failed: {str(e)}",
            "total_scenarios": 0,
            "error": str(e)
        }


async def _refine_scenarios_via_ai(
    current_scenarios: List[Dict[str, Any]],
    document_summary: str,
    user_feedback: str,
    db: DatabaseManager
) -> Dict[str, Any]:
    """
    Refine test scenarios using AI based on user feedback.
    
    This allows iterative improvement of generated scenarios before saving.
    """
    try:
        # Import the AI service for making AI calls
        from api.ai_service import EnterpriseAIService
        
        # Build refinement prompts
        prompts = TestScenarioGenerator.build_refinement_prompt(
            current_scenarios=current_scenarios,
            document_summary=document_summary,
            user_feedback=user_feedback
        )
        
        # Initialize AI service
        ai_service = EnterpriseAIService()
        
        # Call AI with the refinement prompt
        response = await ai_service._chat_json(
            model="gpt-4o-mini",
            system=prompts["system"],
            user=prompts["user"],
            max_tokens=16000,  # Increased for comprehensive scenario coverage
            temperature=0.3,
            retries=2,
            timeout_ms=180000  # 3 minute timeout
        )
        
        # Parse the AI response
        result = TestScenarioGenerator.parse_ai_response(response)
        result = _enrich_scenarios_with_traceability(result)
        
        logger.info(f"✅ AI refined scenarios: {len(result.get('scenarios', []))} total")
        
        return result
        
    except Exception as e:
        logger.error(f"❌ AI refinement failed: {e}")
        # Return original scenarios on failure
        return {
            "scenarios": current_scenarios,
            "summary": f"AI refinement failed: {str(e)}",
            "total_scenarios": len(current_scenarios),
            "changes_made": [],
            "error": str(e)
        }


async def _save_scenarios_as_prompts(
    scenarios: List[Dict[str, Any]],
    document_name: str,
    starting_url: str,
    current_user: Optional[CurrentUser],
    db: DatabaseManager
) -> List[str]:
    """
    Save generated scenarios as prompts in the database.
    
    Returns list of created prompt IDs.
    """
    saved_ids = []
    
    try:
        # Convert scenarios to prompt format
        prompts = TestScenarioGenerator.scenarios_to_prompts(scenarios, document_name)
        
        # Get project and user IDs
        if current_user and current_user.project:
            project_id = str(current_user.project.id)
            user_id = str(current_user.user.id)
        else:
            # Fallback to first active project
            project_result = await db.execute_one(
                "SELECT id FROM core.projects WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
            )
            if not project_result:
                logger.warning("No project found, cannot save prompts")
                return []
            project_id = str(project_result['id'])
            
            user_result = await db.execute_one(
                "SELECT id FROM core.users WHERE is_active = true ORDER BY created_at DESC LIMIT 1"
            )
            user_id = str(user_result['id']) if user_result else None
        
        # Insert each prompt
        for prompt in prompts:
            try:
                result = await db.execute_one(
                    """
                    INSERT INTO planner.prompts (
                        project_id, user_id, text, intent, status, starting_url, category, tags
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING id
                    """,
                    project_id,
                    user_id,
                    prompt["text"],
                    prompt["intent"],
                    "draft",
                    starting_url or "",
                    prompt.get("category", "Functional"),
                    json.dumps(prompt.get("tags", []))
                )
                
                if result:
                    saved_ids.append(str(result["id"]))
                    logger.info(f"✅ Saved prompt: {prompt['title'][:50]}...")
                    
            except Exception as e:
                logger.error(f"❌ Failed to save prompt '{prompt.get('title', 'unknown')}': {e}")
                continue
        
        logger.info(f"✅ Saved {len(saved_ids)} prompts from document")
        return saved_ids
        
    except Exception as e:
        logger.error(f"❌ Error saving prompts: {e}")
        return saved_ids
