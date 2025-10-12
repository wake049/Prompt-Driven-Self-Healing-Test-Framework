"""
Simple Enhanced API for Testing
Minimal implementation to test route registration
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import time
import re

# Create router
simple_router = APIRouter(prefix="/api/v1", tags=["Simple Enhanced API"])

class Page(BaseModel):
    page_id: str
    page_key: str
    title: str
    url_pattern: str
    description: str = ""

class CreatePageRequest(BaseModel):
    page_key: str
    title: str
    url_pattern: str
    description: str = ""

class EnhancedElement(BaseModel):
    element_id: str
    page_id: str
    role: str
    description: str = ""
    current_version: int = 1
    status: str = "pending"
    created_at: str
    created_by: str = "system"
    versions: List[Dict[str, Any]] = []

class CreateEnhancedElementRequest(BaseModel):
    page_id: str
    element_id: str
    role: str
    primary_selector: str
    alt_selectors: List[str] = []
    confidence_score: float = 0.9
    description: str = ""
    ai_reasoning: str = ""

class SuggestIDRequest(BaseModel):
    page_id: str
    role: str
    node_data: Dict[str, Any]

class SuggestedID(BaseModel):
    element_id: str
    confidence: float
    reasoning: str

class TestSelectorRequest(BaseModel):
    selector: str
    url: str
    selector_type: str = "css"
    timeout_ms: int = 5000

class TestSelectorResult(BaseModel):
    found: bool
    sample_html: Optional[str] = None
    error: Optional[str] = None
    execution_time_ms: int

# Simple in-memory storage for testing
pages_storage: List[Page] = []
elements_storage: List[EnhancedElement] = []

@simple_router.post("/pages", response_model=Page)
async def create_page_simple(request: CreatePageRequest):
    """Create a new page - simple version"""
    
    # Generate page ID
    page_id = f"page_{len(pages_storage) + 1}"
    
    # Create page
    page = Page(
        page_id=page_id,
        page_key=request.page_key,
        title=request.title,
        url_pattern=request.url_pattern,
        description=request.description or ""
    )
    
    # Store page
    pages_storage.append(page)
    
    # Return just the page object (frontend expects Page)
    return page

@simple_router.get("/pages")
async def get_pages_simple():
    """Get all pages - simple version"""
    # Return just the list of pages (frontend expects Page[])
    return pages_storage

@simple_router.get("/pages/{page_id}")
async def get_page_simple(page_id: str):
    """Get a specific page - simple version"""
    for page in pages_storage:
        if page.page_id == page_id:
            return page
    
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Page not found")

# ================================
# Element Management Endpoints
# ================================

@simple_router.post("/elements", response_model=EnhancedElement)
async def create_element_simple(request: CreateEnhancedElementRequest):
    """Create a new element - simple version"""
    
    # Verify page exists
    page = None
    for p in pages_storage:
        if p.page_id == request.page_id:
            page = p
            break
    
    if not page:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Create element
    element = EnhancedElement(
        element_id=request.element_id,
        page_id=request.page_id,
        role=request.role,
        description=request.description,
        current_version=1,
        status="pending",
        created_at=str(int(time.time() * 1000)),
        created_by="system",
        versions=[{
            "version": 1,
            "primary_selector": request.primary_selector,
            "alt_selectors": request.alt_selectors,
            "confidence_score": request.confidence_score,
            "created_at": str(int(time.time() * 1000)),
            "created_by": "system",
            "ai_reasoning": request.ai_reasoning,
            "status": "current"
        }]
    )
    
    # Store element
    elements_storage.append(element)
    
    return element

@simple_router.get("/pages/{page_id}/elements")
async def get_page_elements_simple(page_id: str):
    """Get all elements for a page - simple version"""
    elements = [elem for elem in elements_storage if elem.page_id == page_id]
    return elements

@simple_router.get("/elements/search")
async def search_elements_simple(
    query: Optional[str] = None,
    page_id: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20
):
    """Search elements - simple version"""
    filtered = elements_storage.copy()
    
    if page_id:
        filtered = [e for e in filtered if e.page_id == page_id]
    if role:
        filtered = [e for e in filtered if e.role == role]
    if status:
        filtered = [e for e in filtered if e.status == status]
    if query:
        filtered = [e for e in filtered if query.lower() in e.element_id.lower() or query.lower() in e.description.lower()]
    
    # Apply limit
    filtered = filtered[:limit]
    
    return {
        "elements": filtered,
        "total_found": len(filtered),
        "returned": len(filtered)
    }

# ================================
# AI ID Suggestion Endpoint
# ================================

@simple_router.post("/elements/suggest-id")
async def suggest_element_ids_simple(request: SuggestIDRequest):
    """Generate AI suggestions for element IDs - simple version"""
    
    # Get page info
    page = None
    for p in pages_storage:
        if p.page_id == request.page_id:
            page = p
            break
    
    if not page:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Simple AI suggestions based on role and node data
    page_key = page.page_key
    role = request.role
    node_data = request.node_data
    
    suggestions = []
    
    # Generate base suggestions
    text_hint = re.sub(r'[^a-zA-Z0-9]', '_', node_data.get('text', ''))[:10].lower().strip('_')
    tag_hint = node_data.get('tag', 'element').lower()
    
    if text_hint:
        suggestions.append(SuggestedID(
            element_id=f"{page_key}__{role}__{text_hint}",
            confidence=0.9,
            reasoning=f"Based on element text: '{node_data.get('text', '')}'"
        ))
    
    suggestions.append(SuggestedID(
        element_id=f"{page_key}__{role}__{tag_hint}",
        confidence=0.8,
        reasoning=f"Based on tag type: {node_data.get('tag', 'unknown')}"
    ))
    
    # Add role-based suggestion
    suggestions.append(SuggestedID(
        element_id=f"{page_key}__{role}__main",
        confidence=0.7,
        reasoning=f"Generic {role} identifier for {page.title}"
    ))
    
    # Add attributes-based suggestion if available
    attrs = node_data.get('attributes', {})
    if 'id' in attrs:
        attr_hint = re.sub(r'[^a-zA-Z0-9]', '_', attrs['id'])[:10].lower().strip('_')
        suggestions.append(SuggestedID(
            element_id=f"{page_key}__{role}__{attr_hint}",
            confidence=0.85,
            reasoning=f"Based on element ID attribute: {attrs['id']}"
        ))
    
    return {"suggestions": suggestions[:5]}  # Return up to 5 suggestions

# ================================
# Selector Testing Endpoint
# ================================

@simple_router.post("/selectors/test")
async def test_selector_simple(request: TestSelectorRequest):
    """Test a selector - simple version (mocked)"""
    
    # Simple mock implementation
    # In real implementation, this would use Java/Selenium service
    start_time = time.time()
    
    # Mock logic: assume most selectors work
    found = True
    sample_html = f"<{request.selector.split('[')[0].split('#')[0].split('.')[0] or 'div'}>Sample Element</{request.selector.split('[')[0].split('#')[0].split('.')[0] or 'div'}>"
    error = None
    
    # Simulate some failures for invalid selectors
    if not request.selector or len(request.selector) < 3:
        found = False
        error = "Invalid selector format"
        sample_html = None
    
    execution_time = int((time.time() - start_time) * 1000)
    
    return TestSelectorResult(
        found=found,
        sample_html=sample_html,
        error=error,
        execution_time_ms=execution_time
    )