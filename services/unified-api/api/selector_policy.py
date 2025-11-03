"""
Selector Policy API
Handles runtime application of CSS vs XPath selector policies
"""

from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, Optional, List
from datetime import datetime
import uuid
import json

from core.database import get_database

router = APIRouter()

class SelectorPolicyRequest:
    css_selector: Optional[str] = None
    xpath_selector: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class SelectorPolicyResponse:
    selected_selector: str
    selector_type: str  # 'css' | 'xpath'
    reasoning: str
    fallback_available: bool

@router.post("/apply-policy", response_model=Dict[str, Any])
async def apply_selector_policy(
    css_selector: Optional[str] = None,
    xpath_selector: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None
):
    """
    Apply current selector policy to choose between CSS and XPath selectors
    """
    try:
        db = await get_database()
        
        # Get current policy configuration
        policy_query = """
        SELECT context FROM policy.policy_decisions 
        WHERE context->>'config_type' = 'dashboard_config'
        ORDER BY created_at DESC
        LIMIT 1
        """
        policy_result = await db.execute_one(policy_query)
        
        # Default policy if none found
        prefer_css = True
        allow_fallback = True
        
        if policy_result and policy_result["context"]:
            config_data = json.loads(policy_result["context"])
            locator_healing = config_data.get("configurations", {}).get("locatorHealing", {})
            prefer_css = locator_healing.get("preferCssOverXpath", True)
            allow_fallback = locator_healing.get("useRepositoryFallback", True)
        
        # Apply policy logic
        selected_selector = None
        selector_type = None
        reasoning = ""
        fallback_available = False
        
        if prefer_css:
            if css_selector:
                selected_selector = css_selector
                selector_type = "css"
                reasoning = "CSS selector preferred by policy"
                fallback_available = bool(xpath_selector and allow_fallback)
            elif xpath_selector:
                selected_selector = xpath_selector
                selector_type = "xpath"
                reasoning = "XPath used as CSS not available"
                fallback_available = False
            else:
                raise HTTPException(status_code=400, detail="No selectors provided")
        else:
            # Prefer XPath
            if xpath_selector:
                selected_selector = xpath_selector
                selector_type = "xpath"
                reasoning = "XPath selector preferred by policy"
                fallback_available = bool(css_selector and allow_fallback)
            elif css_selector:
                selected_selector = css_selector
                selector_type = "css"
                reasoning = "CSS used as XPath not available"
                fallback_available = False
            else:
                raise HTTPException(status_code=400, detail="No selectors provided")
        
        # Log the decision if context provided
        if context and context.get("log_decision", False):
            await log_selector_decision(
                context.get("prompt_id"),
                context.get("step_index"),
                css_selector,
                xpath_selector,
                selected_selector,
                selector_type,
                "css" if prefer_css else "xpath",
                context
            )
        
        return {
            "success": True,
            "data": {
                "selected_selector": selected_selector,
                "selector_type": selector_type,
                "reasoning": reasoning,
                "fallback_available": fallback_available,
                "policy_applied": {
                    "prefer_css": prefer_css,
                    "allow_fallback": allow_fallback
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply selector policy: {str(e)}")

@router.put("/prompts/{prompt_id}/steps/{step_index}/selectors")
async def update_step_selectors(
    prompt_id: str,
    step_index: int,
    css_selector: Optional[str] = None,
    xpath_selector: Optional[str] = None,
    migration_source: Optional[str] = None
):
    """
    Update a prompt step to use dual selector format
    """
    try:
        db = await get_database()
        
        # First, find the test case and step
        find_step_query = """
        SELECT ts.id, ts.parameters, tc.id as test_case_id
        FROM tests.test_cases tc
        JOIN tests.test_steps ts ON tc.id = ts.test_case_id
        WHERE tc.source_ref_id = $1::uuid
        ORDER BY ts.step_order
        LIMIT 1 OFFSET $2
        """
        
        step_result = await db.execute_one(find_step_query, prompt_id, step_index)
        
        if not step_result:
            raise HTTPException(status_code=404, detail="Step not found")
        
        # Update the step with dual selectors
        update_query = """
        UPDATE tests.test_steps
        SET 
            css_selector = $1,
            xpath_selector = $2,
            selector_metadata = jsonb_build_object(
                'migration_date', NOW(),
                'migration_source', $3,
                'migration_type', 'api_upgrade'
            ),
            updated_at = NOW()
        WHERE id = $4
        """
        
        await db.execute_command(
            update_query,
            css_selector,
            xpath_selector,
            migration_source,
            step_result["id"]
        )
        
        return {
            "success": True,
            "message": "Step selectors updated successfully",
            "step_id": step_result["id"],
            "updated_selectors": {
                "css_selector": css_selector,
                "xpath_selector": xpath_selector
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update step selectors: {str(e)}")

@router.get("/analytics/selector-success-rates/{element_id}")
async def get_selector_success_rates(element_id: str, days: int = 30):
    """
    Get success rates for CSS vs XPath selectors for a specific element
    """
    try:
        db = await get_database()
        
        # Query selector usage and success rates
        query = """
        SELECT 
            e.element_key,
            COUNT(CASE WHEN spd.selector_type = 'css' THEN 1 END) as css_usage,
            COUNT(CASE WHEN spd.selector_type = 'xpath' THEN 1 END) as xpath_usage,
            -- Success rates would be calculated from execution results
            -- For now, return usage-based metrics
            CASE 
                WHEN COUNT(CASE WHEN spd.selector_type = 'css' THEN 1 END) > 
                     COUNT(CASE WHEN spd.selector_type = 'xpath' THEN 1 END) 
                THEN 'css'
                WHEN COUNT(CASE WHEN spd.selector_type = 'xpath' THEN 1 END) > 
                     COUNT(CASE WHEN spd.selector_type = 'css' THEN 1 END) 
                THEN 'xpath'
                ELSE 'no_preference'
            END as recommendation
        FROM repo.elements e
        LEFT JOIN analytics.selector_policy_decisions spd ON spd.css_selector LIKE '%' || e.element_key || '%'
                                                            OR spd.xpath_selector LIKE '%' || e.element_key || '%'
        WHERE e.element_key = $1
          AND spd.created_at >= NOW() - INTERVAL '%s days'
        GROUP BY e.element_key
        """ % days
        
        result = await db.execute_one(query, element_id)
        
        if not result:
            # No data available, return neutral metrics
            return {
                "success": True,
                "data": {
                    "css_success_rate": 0.5,
                    "xpath_success_rate": 0.5,
                    "recommendation": "no_preference",
                    "usage_data": {
                        "css_usage": 0,
                        "xpath_usage": 0,
                        "total_usage": 0
                    }
                }
            }
        
        css_usage = result["css_usage"] or 0
        xpath_usage = result["xpath_usage"] or 0
        total_usage = css_usage + xpath_usage
        
        # Calculate relative success rates (simplified)
        css_rate = css_usage / max(total_usage, 1)
        xpath_rate = xpath_usage / max(total_usage, 1)
        
        return {
            "success": True,
            "data": {
                "css_success_rate": css_rate,
                "xpath_success_rate": xpath_rate,
                "recommendation": result["recommendation"],
                "usage_data": {
                    "css_usage": css_usage,
                    "xpath_usage": xpath_usage,
                    "total_usage": total_usage
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get selector success rates: {str(e)}")

@router.post("/audit/selector-decision")
async def audit_selector_decision(decision_data: Dict[str, Any] = Body(...)):
    """
    Log a selector policy decision for audit purposes
    """
    try:
        context = decision_data.get("context", {})
        selection = decision_data.get("selection", {})
        available_selectors = decision_data.get("availableSelectors", {})
        
        await log_selector_decision(
            context.get("promptId"),
            context.get("stepIndex"),
            available_selectors.get("css_selector"),
            available_selectors.get("xpath_selector"),
            selection.get("selectedSelector"),
            selection.get("selectorType"),
            decision_data.get("policySnapshot", {}).get("preferCssOverXpath", True) and "css" or "xpath",
            decision_data
        )
        
        return {
            "success": True,
            "message": "Selector decision logged successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to log selector decision: {str(e)}")

async def log_selector_decision(
    prompt_id: Optional[str],
    step_index: Optional[int],
    css_selector: Optional[str],
    xpath_selector: Optional[str],
    selected_selector: str,
    selector_type: str,
    policy_preference: str,
    context: Dict[str, Any]
):
    """
    Helper function to log selector decisions to the analytics table
    """
    try:
        db = await get_database()
        
        insert_query = """
        INSERT INTO analytics.selector_policy_decisions (
            prompt_id, step_index, css_selector, xpath_selector,
            selected_selector, selector_type, policy_preference,
            has_fallback, context
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """
        
        has_fallback = bool(css_selector and xpath_selector)
        prompt_uuid = uuid.UUID(prompt_id) if prompt_id else None
        
        await db.execute_command(
            insert_query,
            prompt_uuid,
            step_index,
            css_selector,
            xpath_selector,
            selected_selector,
            selector_type,
            policy_preference,
            has_fallback,
            json.dumps(context)
        )
        
    except Exception as e:
        # Don't fail the main operation if logging fails
        pass  # Removed debug print for production