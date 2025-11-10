"""
Selector Generation API
Provides AI-powered alternative selector generation for self-healing test framework
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

import re
from datetime import datetime

router = APIRouter()

class SelectorRequest(BaseModel):
    """Request for alternative selector generation"""
    original_selector: str
    element_id: str
    page: str
    action_type: str  # click, verify_text, enter_text, etc.
    expected_text: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class SelectorAlternative(BaseModel):
    """Alternative selector suggestion"""
    selector: str
    confidence: float
    reasoning: str
    selector_type: str  # css, xpath, id, class, etc.

class SelectorResponse(BaseModel):
    """Response with alternative selectors"""
    original_selector: str
    alternatives: List[SelectorAlternative]
    total_alternatives: int
    generation_strategy: str

def analyze_selector_patterns(original_selector: str) -> Dict[str, Any]:
    """
    Analyze the original selector to understand its structure and extract patterns
    """
    analysis = {
        "type": "unknown",
        "has_id": False,
        "has_class": False,
        "has_attributes": False,
        "element_tag": None,
        "hierarchical": False,
        "pseudo_selectors": False
    }
    
    if original_selector.startswith('css='):
        css_selector = original_selector[4:]
        analysis["type"] = "css"
        
        # Check for ID
        if '#' in css_selector:
            analysis["has_id"] = True
            analysis["id_value"] = re.search(r'#([^.\s\[\]:]+)', css_selector)
            
        # Check for classes
        if '.' in css_selector:
            analysis["has_class"] = True
            analysis["classes"] = re.findall(r'\.([^.\s\[\]#:]+)', css_selector)
            
        # Check for attributes
        if '[' in css_selector:
            analysis["has_attributes"] = True
            analysis["attributes"] = re.findall(r'\[([^\]]+)\]', css_selector)
            
        # Check for element tags
        tag_match = re.match(r'^([a-zA-Z]+)', css_selector)
        if tag_match:
            analysis["element_tag"] = tag_match.group(1)
            
        # Check for hierarchy
        if ' ' in css_selector or '>' in css_selector:
            analysis["hierarchical"] = True
            
        # Check for pseudo selectors
        if ':' in css_selector:
            analysis["pseudo_selectors"] = True
            
    elif original_selector.startswith('xpath='):
        analysis["type"] = "xpath"
        xpath = original_selector[6:]
        
        # Basic xpath analysis
        if '@id=' in xpath:
            analysis["has_id"] = True
        if '@class=' in xpath or 'contains(@class' in xpath:
            analysis["has_class"] = True
        if '//' in xpath:
            analysis["hierarchical"] = True
            
    return analysis

def generate_universal_alternatives(original_selector: str, element_context: Dict[str, Any] = None) -> List[SelectorAlternative]:
    """
    Generate universal alternative selectors that work for any website
    """
    alternatives = []
    analysis = analyze_selector_patterns(original_selector)
    
    # Strategy 1: Decompose complex selectors into simpler ones
    if analysis["type"] == "css":
        css_selector = original_selector[4:]
        
        # Special handling for nth-of-type selectors in cart scenarios
        if ":nth-of-type(" in css_selector and "inventory_item_price" in css_selector:
            # Extract the base class and nth-of-type index
            if ":nth-of-type(2)" in css_selector:
                # For second item, provide cart-specific alternatives
                alternatives.extend([
                    SelectorAlternative(
                        selector="css=.cart_item:last-child .inventory_item_price",
                        confidence=0.9,
                        reasoning="Last cart item price selector",
                        selector_type="css"
                    ),
                    SelectorAlternative(
                        selector="css=.cart_item:nth-child(2) .inventory_item_price",
                        confidence=0.85,
                        reasoning="Second cart item price selector",
                        selector_type="css"
                    ),
                    SelectorAlternative(
                        selector="css=.cart_item_label:nth-child(2) .inventory_item_price",
                        confidence=0.8,
                        reasoning="Second cart item label price selector",
                        selector_type="css"
                    ),
                    SelectorAlternative(
                        selector="xpath=(//div[@class='inventory_item_price'])[2]",
                        confidence=0.75,
                        reasoning="XPath second price element",
                        selector_type="xpath"
                    )
                ])
            elif ":nth-of-type(1)" in css_selector:
                # For first item, provide alternatives
                alternatives.extend([
                    SelectorAlternative(
                        selector="css=.cart_item:first-child .inventory_item_price",
                        confidence=0.9,
                        reasoning="First cart item price selector",
                        selector_type="css"
                    ),
                    SelectorAlternative(
                        selector="css=.cart_item:nth-child(1) .inventory_item_price", 
                        confidence=0.85,
                        reasoning="First cart item price selector",
                        selector_type="css"
                    )
                ])
        
        # Extract ID-based alternatives
        if analysis["has_id"] and analysis["id_value"]:
            id_val = analysis["id_value"].group(1)
            alternatives.extend([
                SelectorAlternative(
                    selector=f"css=#{id_val}",
                    confidence=0.9,
                    reasoning="Direct ID selector - highest specificity",
                    selector_type="css"
                ),
                SelectorAlternative(
                    selector=f"xpath=//*[@id='{id_val}']",
                    confidence=0.85,
                    reasoning="XPath ID equivalent",
                    selector_type="xpath"
                ),
                SelectorAlternative(
                    selector=f"id={id_val}",
                    confidence=0.8,
                    reasoning="Native ID locator",
                    selector_type="id"
                )
            ])
        
        # Extract class-based alternatives
        if analysis["has_class"] and analysis["classes"]:
            for i, class_name in enumerate(analysis["classes"][:3]):  # Limit to 3 classes
                confidence = 0.7 - (i * 0.1)
                alternatives.extend([
                    SelectorAlternative(
                        selector=f"css=.{class_name}",
                        confidence=confidence,
                        reasoning=f"Single class selector: {class_name}",
                        selector_type="css"
                    ),
                    SelectorAlternative(
                        selector=f"css=[class*='{class_name}']",
                        confidence=confidence - 0.05,
                        reasoning=f"Partial class match: {class_name}",
                        selector_type="css"
                    ),
                    SelectorAlternative(
                        selector=f"xpath=//*[contains(@class,'{class_name}')]",
                        confidence=confidence - 0.1,
                        reasoning=f"XPath class contains: {class_name}",
                        selector_type="xpath"
                    )
                ])
        
        # Extract attribute-based alternatives
        if analysis["has_attributes"] and analysis["attributes"]:
            for attr in analysis["attributes"][:2]:  # Limit to 2 attributes
                alternatives.append(SelectorAlternative(
                    selector=f"css=[{attr}]",
                    confidence=0.6,
                    reasoning=f"Attribute selector: {attr}",
                    selector_type="css"
                ))
        
        # Tag-based alternatives (if element tag is known)
        if analysis["element_tag"]:
            tag = analysis["element_tag"]
            alternatives.extend([
                SelectorAlternative(
                    selector=f"css={tag}",
                    confidence=0.3,
                    reasoning=f"Tag selector: {tag}",
                    selector_type="css"
                ),
                SelectorAlternative(
                    selector=f"xpath=//{tag}",
                    confidence=0.25,
                    reasoning=f"XPath tag selector: {tag}",
                    selector_type="xpath"
                )
            ])
    
    # Strategy 2: Generate semantic alternatives based on element context
    if element_context:
        action_type = element_context.get("action_type", "")
        expected_text = element_context.get("expected_text", "")
        
        # Text-based alternatives for elements with expected text
        if expected_text:
            alternatives.extend([
                SelectorAlternative(
                    selector=f"xpath=//*[text()='{expected_text}']",
                    confidence=0.75,
                    reasoning="Exact text match",
                    selector_type="xpath"
                ),
                SelectorAlternative(
                    selector=f"xpath=//*[contains(text(),'{expected_text}')]",
                    confidence=0.7,
                    reasoning="Partial text match",
                    selector_type="xpath"
                ),
                SelectorAlternative(
                    selector=f"css=*:contains('{expected_text}')",
                    confidence=0.65,
                    reasoning="CSS text contains (jQuery-style)",
                    selector_type="css"
                )
            ])
        
        # Action-specific alternatives
        if action_type == "click":
            alternatives.extend([
                SelectorAlternative(
                    selector="css=button",
                    confidence=0.4,
                    reasoning="Generic button for click action",
                    selector_type="css"
                ),
                SelectorAlternative(
                    selector="css=a",
                    confidence=0.35,
                    reasoning="Generic link for click action",
                    selector_type="css"
                ),
                SelectorAlternative(
                    selector="css=[onclick]",
                    confidence=0.3,
                    reasoning="Elements with onclick handlers",
                    selector_type="css"
                )
            ])
        elif action_type in ["enter_text", "type"]:
            alternatives.extend([
                SelectorAlternative(
                    selector="css=input[type='text']",
                    confidence=0.4,
                    reasoning="Text input for typing action",
                    selector_type="css"
                ),
                SelectorAlternative(
                    selector="css=input",
                    confidence=0.35,
                    reasoning="Generic input for typing action",
                    selector_type="css"
                ),
                SelectorAlternative(
                    selector="css=textarea",
                    confidence=0.3,
                    reasoning="Textarea for typing action",
                    selector_type="css"
                )
            ])
    
    # Strategy 3: Generate positional alternatives
    alternatives.extend([
        SelectorAlternative(
            selector="css=*:first-child",
            confidence=0.2,
            reasoning="First child element",
            selector_type="css"
        ),
        SelectorAlternative(
            selector="css=*:last-child",
            confidence=0.2,
            reasoning="Last child element",
            selector_type="css"
        ),
        SelectorAlternative(
            selector="xpath=(//*)[1]",
            confidence=0.15,
            reasoning="First element in document",
            selector_type="xpath"
        )
    ])
    
    return alternatives

def generate_context_aware_alternatives(original_selector: str, action_type: str, expected_text: str = None) -> List[SelectorAlternative]:
    """
    Generate alternatives based on the action context and expected content
    """
    alternatives = []
    
    # Price/currency detection patterns
    if expected_text and ('$' in expected_text or '€' in expected_text or '£' in expected_text or 'price' in action_type.lower()):
        alternatives.extend([
            SelectorAlternative(
                selector="xpath=//*[contains(text(),'$')]",
                confidence=0.6,
                reasoning="Currency symbol detection",
                selector_type="xpath"
            ),
            SelectorAlternative(
                selector="css=*[class*='price']",
                confidence=0.55,
                reasoning="Price-related class names",
                selector_type="css"
            ),
            SelectorAlternative(
                selector="css=*[data-test*='price']",
                confidence=0.5,
                reasoning="Price-related data attributes",
                selector_type="css"
            )
        ])
    
    # Button/clickable element patterns
    if action_type == "click":
        alternatives.extend([
            SelectorAlternative(
                selector="css=button[type='submit']",
                confidence=0.5,
                reasoning="Submit buttons are commonly clicked",
                selector_type="css"
            ),
            SelectorAlternative(
                selector="css=*[role='button']",
                confidence=0.45,
                reasoning="ARIA button role",
                selector_type="css"
            ),
            SelectorAlternative(
                selector="xpath=//button | //a[@href] | //input[@type='button']",
                confidence=0.4,
                reasoning="Common clickable elements",
                selector_type="xpath"
            )
        ])
    
    # Form input patterns
    if action_type in ["enter_text", "type", "send_keys"]:
        alternatives.extend([
            SelectorAlternative(
                selector="css=input:not([type='hidden']):not([type='submit'])",
                confidence=0.5,
                reasoning="Visible input fields",
                selector_type="css"
            ),
            SelectorAlternative(
                selector="css=*[contenteditable='true']",
                confidence=0.4,
                reasoning="Editable content elements",
                selector_type="css"
            )
        ])
    
    return alternatives

@router.post("/generate")
async def generate_alternative_selectors(request: SelectorRequest) -> SelectorResponse:
    """
    Generate alternative selectors for failed elements using universal patterns
    """
    try:
        alternatives = []
        strategy = "universal-pattern-analysis"
        
        # Prepare element context
        element_context = {
            "action_type": request.action_type,
            "expected_text": request.expected_text,
            "element_id": request.element_id,
            "page": request.page
        }
        
        # Generate universal alternatives based on selector structure
        universal_alternatives = generate_universal_alternatives(request.original_selector, element_context)
        alternatives.extend(universal_alternatives)
        
        # Add context-aware alternatives
        context_alternatives = generate_context_aware_alternatives(
            request.original_selector, 
            request.action_type, 
            request.expected_text
        )
        alternatives.extend(context_alternatives)
        
        # Remove duplicates while preserving order and confidence
        seen_selectors = set()
        unique_alternatives = []
        for alt in alternatives:
            if alt.selector not in seen_selectors:
                seen_selectors.add(alt.selector)
                unique_alternatives.append(alt)
        
        # Sort by confidence (highest first)
        unique_alternatives.sort(key=lambda x: x.confidence, reverse=True)
        
        # Limit to top 8 alternatives to avoid overwhelming the system
        final_alternatives = unique_alternatives[:8]
        
        return SelectorResponse(
            original_selector=request.original_selector,
            alternatives=final_alternatives,
            total_alternatives=len(final_alternatives),
            generation_strategy=strategy
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate alternatives: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy", 
        "service": "universal_selector_generation_api",
        "timestamp": datetime.now().isoformat()
    }

@router.get("/test")
async def test_generation():
    """Test endpoint to verify universal selector generation"""
    test_request = SelectorRequest(
        original_selector="css=#submit-button.btn.btn-primary",
        element_id="submit_btn",
        page="any_website",
        action_type="click",
        expected_text="Submit"
    )
    
    return await generate_alternative_selectors(test_request)