"""
📄 Document Processing Service for Test Scenario Generation
Processes business design documents and generates test scenarios via AI.
All AI processing goes through MCP server to keep sensitive business data secure.
"""

import os
import io
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

logger = logging.getLogger("document_processing")

# Document type handlers
SUPPORTED_EXTENSIONS = {'.txt', '.md', '.pdf', '.docx', '.doc', '.pptx', '.ppt'}
MAX_DOCUMENT_SIZE = 50 * 1024 * 1024  # 50MB max


class DocumentProcessor:
    """Extracts text content from various document formats"""
    
    @staticmethod
    async def extract_text(file_content: bytes, filename: str) -> Tuple[str, str]:
        """
        Extract text content from uploaded document.
        
        Args:
            file_content: Raw bytes of the uploaded file
            filename: Original filename with extension
            
        Returns:
            Tuple of (extracted_text, document_type)
        """
        ext = Path(filename).suffix.lower()
        
        if ext not in SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file type: {ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}")
        
        if ext == '.txt':
            return DocumentProcessor._extract_txt(file_content), "text"
        elif ext == '.md':
            return DocumentProcessor._extract_markdown(file_content), "markdown"
        elif ext == '.pdf':
            return await DocumentProcessor._extract_pdf(file_content), "pdf"
        elif ext in ['.docx', '.doc']:
            return await DocumentProcessor._extract_docx(file_content), "docx"
        elif ext in ['.pptx', '.ppt']:
            return await DocumentProcessor._extract_pptx(file_content), "pptx"
        else:
            raise ValueError(f"No handler for extension: {ext}")
    
    @staticmethod
    def _extract_txt(content: bytes) -> str:
        """Extract text from plain text file"""
        try:
            return content.decode('utf-8')
        except UnicodeDecodeError:
            return content.decode('latin-1')
    
    @staticmethod
    def _extract_markdown(content: bytes) -> str:
        """Extract text from markdown file (keep as-is, it's already text)"""
        try:
            return content.decode('utf-8')
        except UnicodeDecodeError:
            return content.decode('latin-1')
    
    @staticmethod
    async def _extract_pdf(content: bytes) -> str:
        """Extract text from PDF file"""
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            text_parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            return '\n\n'.join(text_parts)
        except ImportError:
            logger.warning("pypdf not installed, trying pdfplumber")
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(content)) as pdf:
                    text_parts = []
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            text_parts.append(text)
                    return '\n\n'.join(text_parts)
            except ImportError:
                raise ValueError("PDF processing requires 'pypdf' or 'pdfplumber'. Install with: pip install pypdf")
    
    @staticmethod
    async def _extract_docx(content: bytes) -> str:
        """Extract text from DOCX file"""
        try:
            from docx import Document
            doc = Document(io.BytesIO(content))
            text_parts = []
            for para in doc.paragraphs:
                if para.text.strip():
                    text_parts.append(para.text)
            # Also extract text from tables
            for table in doc.tables:
                for row in table.rows:
                    row_text = ' | '.join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_text:
                        text_parts.append(row_text)
            return '\n\n'.join(text_parts)
        except ImportError:
            raise ValueError("DOCX processing requires 'python-docx'. Install with: pip install python-docx")
    
    @staticmethod
    async def _extract_pptx(content: bytes) -> str:
        """Extract text from PowerPoint file"""
        try:
            from pptx import Presentation
            prs = Presentation(io.BytesIO(content))
            text_parts = []
            for slide_num, slide in enumerate(prs.slides, 1):
                slide_texts = [f"--- Slide {slide_num} ---"]
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        slide_texts.append(shape.text.strip())
                    # Extract text from tables
                    if shape.has_table:
                        for row in shape.table.rows:
                            row_text = ' | '.join(cell.text.strip() for cell in row.cells if cell.text.strip())
                            if row_text:
                                slide_texts.append(row_text)
                if len(slide_texts) > 1:  # More than just the slide header
                    text_parts.append('\n'.join(slide_texts))
            return '\n\n'.join(text_parts)
        except ImportError:
            raise ValueError("PowerPoint processing requires 'python-pptx'. Install with: pip install python-pptx")


# Test type configuration for shift-left testing
TEST_TYPE_UI = "ui"
TEST_TYPE_API = "api"
DEFAULT_TEST_TYPES = [TEST_TYPE_UI]  # UI-only by default since this is a UI testing framework

# Guidance for different test types
TEST_TYPE_GUIDANCE = {
    "ui": """**UI TESTING SCENARIOS (Browser-based)**
Generate scenarios that can be executed in a web browser using Selenium/Playwright:
- Navigate to URLs and verify page loads
- Click buttons, links, and interactive elements
- Fill in forms with text inputs, dropdowns, checkboxes, radio buttons
- Verify element visibility, text content, and CSS properties
- Handle alerts, modals, and popups
- Verify success/error messages on screen
- Check navigation flows and redirects
- Test responsive behavior and browser compatibility
- Verify file uploads and downloads via UI
- Test keyboard navigation and accessibility

Each step should describe a USER ACTION in the browser or a VISUAL VERIFICATION.
Example steps:
- "Navigate to https://example.com/login"
- "Enter 'testuser@email.com' in the email field"
- "Click the 'Sign In' button"
- "Verify the dashboard page loads with welcome message"
""",
    "api": """**API TESTING SCENARIOS (Backend services)**
Generate scenarios for testing REST APIs and backend services:
- Send HTTP requests (GET, POST, PUT, PATCH, DELETE)
- Verify response status codes (200, 201, 400, 401, 404, 500, etc.)
- Validate JSON/XML response schemas and data
- Test request headers and authentication (Bearer tokens, API keys)
- Verify error response formats and messages
- Test rate limiting and throttling
- Validate pagination and filtering endpoints
- Test file upload/download via API
- Verify webhook calls and async operations
- Test API versioning and backwards compatibility

Each step should describe an API REQUEST and EXPECTED RESPONSE.
Example steps:
- "[API] POST /api/v1/users with body: {email, password}"
- "[API] Verify response status is 201 Created"
- "[API] Verify response contains user ID and auth token"
- "[API] GET /api/v1/users/{id} with Authorization header"

Mark ALL API test scenarios with [API] prefix in the title.
"""
}


class TestScenarioGenerator:
    """Generates test scenarios from document content using AI via MCP"""
    
    # System prompt for generating test scenarios
    SYSTEM_PROMPT = """You are an expert QA engineer who specializes in creating comprehensive test scenarios from business requirements documents.

Your task is to analyze the provided document and generate detailed, actionable test scenarios that can be automated.

**CRITICAL: ACCEPTANCE CRITERIA COVERAGE - MANDATORY RULES**

RULE 1: Every AC MUST have a Happy Path
Before generating scenarios, you MUST:
1. First identify EVERY acceptance criterion (AC) in the document - look for numbered ACs, bullet points describing expected behavior, "Given/When/Then" statements, "should" statements, success criteria, and validation rules
2. List each AC you found in the "acceptance_criteria" field of your response
3. **MANDATORY: For EACH AC, you MUST generate AT LEAST ONE Happy Path scenario that validates the AC is met when everything works correctly**
4. Additionally, generate Edge Case and Negative Path scenarios for ACs involving validation, limits, or error conditions
5. Track which AC(s) each scenario covers in the "covers_ac" field

RULE 2: Happy Path means SUCCESS
- A Happy Path scenario shows the feature WORKING AS INTENDED
- Even if an AC describes a validation rule or restriction, create a Happy Path showing the system correctly enforcing that rule
- Example: If AC says "users cannot exceed daily limit", the Happy Path is: "System correctly prevents transaction when limit reached" (system working correctly)
- Example: If AC says "invalid format rejected", the Happy Path is: "System correctly displays format error message" (validation working)

RULE 3: ENUMERATE ALL OPTIONS - APPLY TO EVERY AC WITH LISTS
Scan EVERY AC for enumerated values. When found, create SEPARATE scenarios:
- "X and Y reminders" → One scenario for X, one scenario for Y
- "via SMS, email, or push" → One scenario each for SMS, email, push
- "supports PDF, CSV, Excel" → One scenario each for PDF, CSV, Excel
- "admin, manager, user roles" → One scenario each for admin, manager, user
**YOU MUST CHECK EVERY AC** - Do not skip any AC when looking for enumerations.

RULE 4: BOUNDARY VALUE ANALYSIS - APPLY TO EVERY AC WITH NUMBERS
Scan EVERY AC for numeric values. When found, create boundary scenarios:
- "< 1.5 Mbps" → Test: 0.5 Mbps, 1.4 Mbps, 1.5 Mbps, 1.6 Mbps, 5 Mbps
- "8AM-9PM window" → Test: 7:59 AM, 8:00 AM, 12:00 PM, 9:00 PM, 9:01 PM
- "expires after 30 minutes" → Test: 25 min, 29 min, 30 min, 31 min, 35 min
- "72-hour and 24-hour" → Test both 72-hour AND 24-hour separately
- "max 3 attempts" → Test: 1st, 2nd, 3rd, 4th attempt
**YOU MUST CHECK EVERY AC** - Do not skip any AC when looking for numbers.

RULE 5: PROGRESSIVE STATE SCENARIOS - APPLY TO EVERY AC WITH "Nth" THRESHOLDS
Scan EVERY AC for progressive thresholds. When found, create state scenarios:
- "3rd cancellation triggers X" → Create: 1st (no trigger), 2nd (no trigger), 3rd (triggered)
- "4th attempt rejected" → Create: 1st (ok), 2nd (ok), 3rd (ok), 4th (rejected)
- "after 5 failures" → Create: 1st, 2nd, 3rd, 4th, 5th failure
**YOU MUST CHECK EVERY AC** - Do not skip any AC when looking for progressive thresholds.

RULE 6: PERMISSION/ACCESS VARIANTS - APPLY TO EVERY AC WITH ACCESS CONTROL
Scan EVERY AC for access control. When found, create variant scenarios:
- Consent requirements → Test: with consent, without consent, expired, revoked
- Role restrictions → Test: each role type separately
- Feature toggles → Test: enabled and disabled states
**YOU MUST CHECK EVERY AC** - Do not skip any AC when looking for access control.

RULE 7: PARAMETERIZED SCENARIO TRACEABILITY
When you create multiple scenarios from one AC (due to Rules 3-6), link them:
- First scenario: derived_from = null, data_variant = null
- Variant scenarios: derived_from = base scenario ID, data_variant = specific variant tested

**CRITICAL VERIFICATION STEP - DO THIS BEFORE RESPONDING:**
Go through EACH AC one by one and ask:
1. Does this AC have enumerated options (AND, OR, comma-separated)? → If yes, create separate scenarios for EACH
2. Does this AC have numeric values (times, speeds, counts, durations)? → If yes, create boundary scenarios
3. Does this AC have "Nth" thresholds (3rd, 4th, after N)? → If yes, create progressive state scenarios
4. Does this AC have access control? → If yes, create permission variants
If you answered YES to any question but didn't create the required scenarios, ADD THEM NOW.

For each test scenario, provide:
1. A clear, descriptive title indicating the test type: [Happy Path], [Edge Case], or [Negative]
2. The business intent/purpose of the test
3. Step-by-step test instructions
4. Expected outcomes (success or expected error)
5. Which acceptance criteria it covers
6. Traceability fields (derived_from, data_variant) for parameterized scenarios

COVERAGE REQUIREMENTS - Generate scenarios for these categories:

HAPPY PATHS (REQUIRED for every AC):
- **MINIMUM: One Happy Path per AC showing the feature works correctly**
- **SEPARATE Happy Paths for each enumerated option (channels, formats, etc.)**
- Standard user journeys and workflows described in the document
- Form submissions with valid data

EDGE CASES (boundary value analysis - MUST BE PRACTICALLY EXECUTABLE):
- Exact boundary values (8:00 AM, 1.5 Mbps, min/max limits)
- Just-below and just-above boundary values
- Progressive states before threshold

**CRITICAL: All scenarios MUST be executable within a normal test cycle (minutes to hours, NOT days/months/years).**
For time-based boundaries that span long periods:
- "7-year retention" → Test with backdated test data or database records, NOT by waiting 7 years
- "90-day expiration" → Use time manipulation, mock dates, or pre-created aged test data
- "After 30 days" → Insert records with past timestamps, then verify behavior

Write steps that describe HOW to set up the test data to simulate the condition:
- BAD: "Wait 7 years and check the audit log"
- GOOD: "Insert a stock adjustment record with a timestamp 7 years ago, then verify it appears in audit history"

NEGATIVE PATHS (realistic failure scenarios - NOT simple inversions of happy paths):
Create scenarios that reflect REAL-WORLD failure modes users actually encounter:

DATA QUALITY ISSUES:
- Malformed input (wrong format, truncated data, corrupted files)
- Missing required fields that users commonly forget
- Data type mismatches (text in numeric fields, special characters)
- Encoding issues (unicode, emoji, non-ASCII characters)
- Copy-paste errors (leading/trailing spaces, hidden characters)

TIMING AND STATE ISSUES:
- Session timeout during multi-step workflow
- Concurrent edits by multiple users
- Stale data (user acts on outdated information)
- Network interruption mid-transaction
- Double-click/double-submit by impatient user

SYSTEM AND ENVIRONMENT:
- Service temporarily unavailable (database, external API)
- Rate limiting triggered by legitimate heavy usage
- Disk/storage quota exceeded
- Browser compatibility issues (if applicable)

USER BEHAVIOR PATTERNS:
- User navigates away then returns (back button, refresh)
- User opens same workflow in multiple tabs
- User attempts action without required prerequisites
- User's subscription/trial expired mid-session
- User account disabled/suspended during active session

DO NOT just invert happy paths. Each negative scenario should represent a REALISTIC situation that actual users encounter in production.

Generate test scenarios in the following JSON format:
{
    "acceptance_criteria": [
        {
            "id": "AC-1",
            "description": "Copy the exact AC text or summarize concisely"
        }
    ],
    "scenarios": [
        {
            "id": "unique-id",
            "title": "[Type] Clear descriptive title for the test",
            "description": "What this test validates",
            "covers_ac": ["AC-1"],
            "derived_from": null,
            "data_variant": null,
            "steps": ["Step 1", "Step 2", "Step 3"],
            "preconditions": ["Any required setup"],
            "expected_result": "What should happen (success or expected error)",
            "type": "happy_path|edge_case|negative",
            "category": "Functional|Integration|UI|Performance",
            "priority": "high|medium|low",
            "tags": ["relevant", "tags"]
        },
        {
            "id": "unique-id-variant",
            "title": "[Happy Path] Feature works with option B",
            "description": "Tests feature with the second enumerated option",
            "covers_ac": ["AC-1"],
            "derived_from": "unique-id",
            "data_variant": "option B",
            "steps": ["..."],
            "preconditions": ["Option B is enabled"],
            "expected_result": "Feature works correctly with option B",
            "type": "happy_path",
            "category": "Functional",
            "priority": "high",
            "tags": ["feature", "variant"]
        }
    ],
    "summary": "Brief summary of the document and test coverage",
    "total_scenarios": <number>,
    "coverage_breakdown": {
        "happy_paths": <number>,
        "edge_cases": <number>,
        "negative_paths": <number>
    },
    "ac_coverage_matrix": {
        "AC-1": ["list", "of", "scenario", "ids"],
        "AC-2": ["scenario-ids"]
    },
    "happy_paths_per_ac": {
        "AC-1": ["scenario-id-1", "scenario-id-2"],
        "AC-2": ["scenario-id"]
    }
}

IMPORTANT: 
- The "happy_paths_per_ac" field MUST contain an entry for EVERY AC, mapping it to its happy path scenario IDs.
- ACs with multiple distinct values (e.g., "72-hour AND 24-hour") should have multiple happy path scenarios listed.
- Use derived_from and data_variant to trace parameterized scenarios back to their base case.
- If you cannot fill this field completely, you are missing happy paths and must add them.

TOKEN MANAGEMENT:
If the document has many ACs and you risk running out of output space:
1. PRIORITIZE: Happy Paths for ALL ACs first (one per AC minimum)
2. THEN: Add enumeration variants for ACs that list multiple options
3. THEN: Add boundary value scenarios for ACs with numeric thresholds
4. THEN: Add progressive state scenarios for ACs with "Nth" thresholds
5. THEN: Add negative/edge cases for validation-related ACs
Always generate complete, valid JSON even if you must limit total scenarios.

Be thorough - for each feature/workflow, ensure you have at least 1 happy path, 1-2 edge cases, and 1-2 negative paths."""

    USER_PROMPT_TEMPLATE = """Please analyze the following business document and generate comprehensive test scenarios:

---DOCUMENT START---
{document_content}
---DOCUMENT END---

Document type: {document_type}
Document name: {document_name}

**REQUIRED STEPS:**

1. **IDENTIFY ALL ACCEPTANCE CRITERIA**: Carefully scan the document for:
   - Numbered acceptance criteria (AC-1, AC-2, etc.)
   - Bulleted requirements starting with "The system shall...", "User should be able to...", etc.
   - Given/When/Then statements
   - Success criteria or validation rules
   - Any statement defining expected behavior
   List EVERY AC you find in the "acceptance_criteria" array.

2. **MANDATORY: CREATE HAPPY PATH FOR EVERY AC**:
   For EACH acceptance criterion, you MUST create at least one Happy Path scenario. This is non-negotiable.
   - If AC describes a validation, the Happy Path shows the validation WORKING CORRECTLY
   - If AC describes a limit or restriction, the Happy Path shows the system correctly enforcing it
   - If AC describes an error condition, the Happy Path shows the system correctly handling that condition

3. **ENUMERATE ALL OPTIONS** - Create separate scenarios for EACH listed option:
   - If document lists multiple channels, formats, methods, roles, or languages → Create one Happy Path per option
   - If document mentions fallback behavior → Create a scenario for the fallback case too
   - Each option gets its own scenario with data_variant set to the option name

4. **BOUNDARY VALUE ANALYSIS** - Test all critical boundaries:
   - If AC specifies a numeric threshold → Create scenarios for: well below, just below, exactly at, just above, well above
   - If AC specifies a time window → Create scenarios for: just before start, exact start, middle, exact end, just after end
   - Set data_variant to describe the boundary being tested (e.g., "just below threshold", "exactly at limit")

5. **PROGRESSIVE STATE SCENARIOS** - Test accumulation before and at threshold:
   - If AC says "after N occurrences, trigger action" → Create:
     * 1st occurrence (behavior before threshold)
     * 2nd through (N-1)th occurrence (behavior approaching threshold)
     * Nth occurrence (threshold reached, action triggered)
   - Set data_variant to describe which occurrence ("1st occurrence", "2nd occurrence", etc.)

6. **PERMISSION/ACCESS VARIANTS** - Test all access control states:
   - If document mentions consent, permissions, or roles → Test each state (granted, denied, expired, revoked)
   - Set data_variant to describe the access state

7. **TRACEABILITY** - Link parameterized scenarios:
   - First scenario for an AC: derived_from = null, data_variant = null
   - Subsequent variants: derived_from = first scenario's ID, data_variant = what this tests
   
8. **ADD EDGE CASES AND NEGATIVE PATHS**:
   - Boundary values are Edge Cases
   - Violations and failures are Negative Paths
   Include the AC ID(s) in each scenario's "covers_ac" field.

9. **VERIFICATION - CHECK BEFORE RESPONDING**:
   - Confirm every AC has AT LEAST one Happy Path scenario
   - Confirm all enumerated options (channels, formats, etc.) have separate scenarios
   - Confirm numeric thresholds have boundary value scenarios
   - Confirm progressive thresholds have state-by-state scenarios
   - **Confirm ALL scenarios are executable within minutes/hours - NO steps like "wait 7 years"**
   - For long time periods, use backdated test data or time simulation in steps
   - Fill "happy_paths_per_ac" to prove complete coverage

10. **Mark each scenario** with its type: [Happy Path], [Edge Case], or [Negative] in the title.

Return your response as valid JSON matching the specified format with acceptance_criteria, scenarios, ac_coverage_matrix, and proper derived_from/data_variant fields."""

    # Prompt template for refining scenarios based on user feedback
    REFINEMENT_SYSTEM_PROMPT = """You are an expert QA engineer helping to refine test scenarios.

The user has reviewed AI-generated test scenarios and wants to make changes.
Based on their feedback, you should:
1. Add new scenarios they requested (ensure proper type categorization)
2. Remove scenarios they don't want
3. Modify existing scenarios as requested
4. Suggest additional edge cases or negative paths if the user asks for more coverage

Remember to maintain balanced coverage:
- Happy Paths (~45%): Normal expected user flows
- Edge Cases (~30%): Boundary conditions, unusual inputs
- Negative Paths (~25%): REALISTIC failure scenarios (see below)

NEGATIVE SCENARIOS MUST BE REALISTIC - NOT simple inversions of happy paths:
- Data quality: malformed input, missing fields, encoding issues, copy-paste errors
- Timing/state: session timeout, concurrent edits, stale data, network interruption
- System: service unavailable, rate limiting, quota exceeded
- User behavior: back button, multiple tabs, expired session, missing prerequisites

IMPORTANT RULES:
- Every AC must have at least one Happy Path scenario
- ACs with multiple enumerated options need separate scenarios for EACH option
- Numeric thresholds need boundary value scenarios (exact boundary, just below, just above)
- Progressive thresholds (e.g., "after N occurrences") need scenarios for each state (1st, 2nd, ..., Nth)
- Use derived_from and data_variant to link parameterized scenarios to their base
- Maintain the covers_ac field on each scenario

Always return the complete updated list of scenarios in JSON format:
{
    "acceptance_criteria": [
        {
            "id": "AC-1",
            "description": "Preserve from original or add new if requested"
        }
    ],
    "scenarios": [
        {
            "id": "unique-id",
            "title": "[Type] Clear descriptive title for the test",
            "description": "What this test validates",
            "covers_ac": ["AC-1"],
            "derived_from": null,
            "data_variant": null,
            "steps": ["Step 1", "Step 2", "Step 3"],
            "preconditions": ["Any required setup"],
            "expected_result": "What should happen",
            "type": "happy_path|edge_case|negative",
            "category": "Functional|Integration|UI|Performance",
            "priority": "high|medium|low",
            "tags": ["relevant", "tags"]
        }
    ],
    "summary": "Updated summary of changes made",
    "total_scenarios": <number>,
    "changes_made": ["Description of each change made"],
    "coverage_breakdown": {
        "happy_paths": <number>,
        "edge_cases": <number>,
        "negative_paths": <number>
    },
    "ac_coverage_matrix": {
        "AC-1": ["scenario-ids"]
    },
    "happy_paths_per_ac": {
        "AC-1": ["scenario-id-1", "scenario-id-2"]
    }
}"""

    REFINEMENT_USER_TEMPLATE = """Here are the current test scenarios:

{current_scenarios}

Original document context:
{document_summary}

User's feedback/request:
{user_feedback}

Please update the scenarios based on the user's feedback and return the complete updated list."""

    @staticmethod
    def build_ai_prompt(
        document_content: str, 
        document_type: str, 
        document_name: str,
        test_types: List[str] = None
    ) -> Dict[str, str]:
        """
        Build the prompts for AI processing.
        
        Args:
            document_content: Extracted text from the document
            document_type: Type of document (pdf, docx, etc.)
            document_name: Original filename
            test_types: List of test types to generate - ["ui"], ["api"], or ["ui", "api"]
        
        Returns:
            Dict with 'system' and 'user' prompts
        """
        # Default to UI-only testing (this is a UI testing framework)
        if not test_types:
            test_types = DEFAULT_TEST_TYPES
        
        # Truncate very long documents to fit within token limits
        max_chars = 100000  # ~25k tokens for content
        if len(document_content) > max_chars:
            document_content = document_content[:max_chars] + "\n\n[Document truncated due to length...]"
        
        # Build test type guidance section
        test_type_guidance_parts = []
        for tt in test_types:
            if tt in TEST_TYPE_GUIDANCE:
                test_type_guidance_parts.append(TEST_TYPE_GUIDANCE[tt])
        
        test_type_guidance = "\n\n".join(test_type_guidance_parts)
        
        # Add test type context to user prompt
        test_type_context = ""
        if "ui" in test_types and "api" in test_types:
            test_type_context = """\n\n**TEST TYPES REQUESTED: UI and API**
Generate both UI (browser-based) and API (backend service) test scenarios.
- Mark UI scenarios with steps describing browser actions
- Mark API scenarios with [API] prefix in title and API request/response steps
- For features that have both UI and API aspects, create separate scenarios for each

""" + test_type_guidance
        elif "api" in test_types:
            test_type_context = """\n\n**TEST TYPE REQUESTED: API ONLY**
Generate API test scenarios only. Mark ALL scenarios with [API] prefix in the title.
Do NOT generate browser/UI-based scenarios.

""" + test_type_guidance
        else:  # UI only (default)
            test_type_context = """\n\n**TEST TYPE REQUESTED: UI ONLY**
Generate browser-based UI test scenarios only.
All scenarios should be executable via browser automation (Selenium/Playwright).
Do NOT generate API-specific test scenarios.

""" + test_type_guidance
        
        user_prompt = TestScenarioGenerator.USER_PROMPT_TEMPLATE.format(
            document_content=document_content,
            document_type=document_type,
            document_name=document_name
        ) + test_type_context
        
        return {
            "system": TestScenarioGenerator.SYSTEM_PROMPT,
            "user": user_prompt
        }
    
    @staticmethod
    def build_refinement_prompt(
        current_scenarios: List[Dict[str, Any]],
        document_summary: str,
        user_feedback: str
    ) -> Dict[str, str]:
        """
        Build prompts for refining scenarios based on user feedback.
        
        Args:
            current_scenarios: Current list of scenarios
            document_summary: Summary of original document
            user_feedback: User's refinement request
            
        Returns:
            Dict with 'system' and 'user' prompts for refinement
        """
        import json
        
        scenarios_json = json.dumps(current_scenarios, indent=2)
        
        user_prompt = TestScenarioGenerator.REFINEMENT_USER_TEMPLATE.format(
            current_scenarios=scenarios_json,
            document_summary=document_summary,
            user_feedback=user_feedback
        )
        
        return {
            "system": TestScenarioGenerator.REFINEMENT_SYSTEM_PROMPT,
            "user": user_prompt
        }
    
    @staticmethod
    def parse_ai_response(response: str) -> Dict[str, Any]:
        """
        Parse AI response into structured test scenarios.
        
        Args:
            response: Raw JSON string from AI
            
        Returns:
            Parsed scenarios dict
        """
        import json
        
        try:
            # Try to parse as JSON directly
            result = json.loads(response)
            return result
        except json.JSONDecodeError:
            # Try to extract JSON from the response
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    result = json.loads(json_match.group())
                    return result
                except json.JSONDecodeError:
                    pass
        
        # Fallback: return error structure
        return {
            "scenarios": [],
            "summary": "Failed to parse AI response",
            "total_scenarios": 0,
            "error": "Could not parse AI response as JSON"
        }
    
    @staticmethod
    def scenarios_to_prompts(scenarios: List[Dict[str, Any]], document_name: str) -> List[Dict[str, Any]]:
        """
        Convert generated scenarios to prompt format for saving.
        
        Args:
            scenarios: List of scenario dicts from AI
            document_name: Source document name for reference
            
        Returns:
            List of prompt dicts ready for database insertion
        """
        prompts = []
        
        for i, scenario in enumerate(scenarios):
            title = scenario.get('title', f'Test Scenario {i+1}')
            # Support both 'intent' (old format) and 'description' (new format)
            description = scenario.get('description') or scenario.get('intent', '')
            
            # Handle steps as either string or list
            steps = scenario.get('steps', '')
            if isinstance(steps, list):
                steps = '\n'.join(f"{j+1}. {step}" for j, step in enumerate(steps))
            
            # Get new fields
            scenario_type = scenario.get('type', 'happy_path')
            preconditions = scenario.get('preconditions', [])
            expected_result = scenario.get('expected_result', '')
            
            category = scenario.get('category', 'Functional')
            priority = scenario.get('priority', 'medium')
            tags = scenario.get('tags', [])
            
            # Add scenario type as a tag
            if scenario_type and scenario_type not in tags:
                tags.append(scenario_type.replace('_', '-'))
            
            # Build the prompt text
            text_parts = [title, '', description]
            
            if preconditions:
                text_parts.extend(['', 'Preconditions:'])
                for pre in preconditions:
                    text_parts.append(f'- {pre}')
            
            text_parts.extend(['', 'Steps:', steps])
            
            if expected_result:
                text_parts.extend(['', f'Expected Result: {expected_result}'])
            
            text = '\n'.join(text_parts)
            
            # Add source document as a tag
            if document_name and f"doc:{document_name[:30]}" not in tags:
                tags.append(f"doc:{document_name[:30]}")
            
            prompt = {
                "title": title,
                "text": text,
                "content": text,
                "intent": description,
                "description": description,
                "category": category,
                "priority": priority,
                "tags": tags,
                "status": "draft",
                "source": "document_generation",
                "source_document": document_name,
                "scenario_type": scenario_type
            }
            prompts.append(prompt)
        
        return prompts


# Singleton instances
document_processor = DocumentProcessor()
scenario_generator = TestScenarioGenerator()
