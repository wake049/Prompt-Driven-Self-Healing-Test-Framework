"""
Step-Element Relationship API

Provides endpoints for managing relationships between prompt steps and elements
to enable runtime selector resolution by the policy engine.
"""
import json

from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.database import DatabaseManager, get_database_manager

router = APIRouter()

# Request/Response Models
class StepElementReference(BaseModel):
    stepIndex: int
    parameterKey: str
    selectorValue: str
    elementId: Optional[str] = None
    selectorType: Optional[str] = 'auto'

class SaveRelationshipsRequest(BaseModel):
    promptId: str
    planId: str
    relationships: List[StepElementReference]

class ElementSearchRequest(BaseModel):
    selector: str
    maxResults: Optional[int] = 10

class ElementLookupResult(BaseModel):
    elementId: str
    elementKey: str
    confidence: float
    matchType: str  # 'exact', 'partial', 'fuzzy'

@router.post("/prompt-step-elements")
async def save_step_element_relationships(
    request: SaveRelationshipsRequest,
    db: DatabaseManager = Depends(get_database_manager)
):
    """Save relationships between prompt steps and elements"""
    try:
        # First, delete existing relationships for this prompt
        delete_query = """
        DELETE FROM planner.prompt_step_elements 
        WHERE prompt_id = $1
        """
        await db.execute(delete_query, request.promptId)
        
        # Insert new relationships
        if request.relationships:
            insert_query = """
            INSERT INTO planner.prompt_step_elements 
            (prompt_id, plan_id, step_index, parameter_key, element_id, selector_preference)
            VALUES ($1, $2, $3, $4, $5, $6)
            """
            
            for rel in request.relationships:
                if rel.elementId:  # Only save relationships with resolved element IDs
                    await db.execute(
                        insert_query,
                        request.promptId,
                        request.planId,
                        rel.stepIndex,
                        rel.parameterKey,
                        rel.elementId,
                        rel.selectorType or 'auto'
                    )
        
        return {"success": True, "saved_count": len([r for r in request.relationships if r.elementId])}
        
    except Exception as e:raise HTTPException(status_code=500, detail=str(e))

@router.get("/prompt-step-elements/{prompt_id}")
async def get_step_element_relationships(
    prompt_id: str,
    db: DatabaseManager = Depends(get_database_manager)
):
    """Get step-element relationships for a prompt"""
    try:
        query = """
        SELECT * FROM planner.v_step_element_relationships
        WHERE prompt_id = $1
        ORDER BY step_index, parameter_key
        """
        
        results = await db.execute(query, prompt_id)
        
        relationships = []
        for row in results:
            relationships.append({
                "id": str(row["id"]),
                "promptId": str(row["prompt_id"]),
                "planId": str(row["plan_id"]),
                "stepIndex": row["step_index"],
                "parameterKey": row["parameter_key"],
                "elementId": str(row["element_id"]),
                "selectorPreference": row["selector_preference"],
                "elementKey": row["element_key"],
                "primarySelector": row["primary_selector"],
                "altSelectors": row["alt_selectors"],
                "pageName": row["page_name"],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"]
            })
        
        return {"relationships": relationships}
        
    except Exception as e:raise HTTPException(status_code=500, detail=str(e))

@router.delete("/prompt-step-elements/{prompt_id}")
async def delete_step_element_relationships(
    prompt_id: str,
    db: DatabaseManager = Depends(get_database_manager)
):
    """Delete all step-element relationships for a prompt"""
    try:
        query = """
        DELETE FROM planner.prompt_step_elements 
        WHERE prompt_id = $1
        """
        
        await db.execute(query, prompt_id)
        
        return {"success": True}
        
    except Exception as e:raise HTTPException(status_code=500, detail=str(e))

@router.post("/elements/search")
async def search_elements_by_selector(
    request: ElementSearchRequest,
    db: DatabaseManager = Depends(get_database_manager)
):
    """Search for elements that match a given selector"""
    try:
        # Search strategy:
        # 1. Exact match in primary_selector
        # 2. Partial match in primary_selector 
        # 3. Match in alt_selectors
        # 4. Fuzzy match on element_key
        
        selector = request.selector.strip()
        results = []
        
        # 1. Exact match in primary_selector
        exact_query = """
        SELECT e.id, e.element_key, e.primary_selector, e.alt_selectors, p.name as page_name
        FROM repo.elements e
        JOIN repo.pages p ON e.page_id = p.id
        WHERE e.is_active = true 
        AND (
            (e.primary_selector->>'css' = $1) OR
            (e.primary_selector->>'xpath' = $1)
        )
        LIMIT $2
        """
        
        exact_results = await db.execute(exact_query, selector, request.maxResults)
        for row in exact_results:
            results.append(ElementLookupResult(
                elementId=str(row["id"]),
                elementKey=row["element_key"],
                confidence=1.0,
                matchType="exact"
            ))
        
        # 2. Partial match if we don't have enough exact matches
        if len(results) < request.maxResults:
            remaining = request.maxResults - len(results)
            partial_query = """
            SELECT e.id, e.element_key, e.primary_selector, e.alt_selectors, p.name as page_name
            FROM repo.elements e
            JOIN repo.pages p ON e.page_id = p.id
            WHERE e.is_active = true 
            AND e.id NOT IN (SELECT unnest($3::uuid[]))
            AND (
                (e.primary_selector->>'css' ILIKE '%' || $1 || '%') OR
                (e.primary_selector->>'xpath' ILIKE '%' || $1 || '%') OR
                (e.alt_selectors::text ILIKE '%' || $1 || '%')
            )
            LIMIT $2
            """
            
            excluded_ids = [r.elementId for r in results] or ['00000000-0000-0000-0000-000000000000']
            partial_results = await db.execute(partial_query, selector, remaining, excluded_ids)
            for row in partial_results:
                results.append(ElementLookupResult(
                    elementId=str(row["id"]),
                    elementKey=row["element_key"],
                    confidence=0.7,
                    matchType="partial"
                ))
        
        # 3. Fuzzy match on element_key if still need more
        if len(results) < request.maxResults:
            remaining = request.maxResults - len(results)
            fuzzy_query = """
            SELECT e.id, e.element_key, e.primary_selector, e.alt_selectors, p.name as page_name
            FROM repo.elements e
            JOIN repo.pages p ON e.page_id = p.id
            WHERE e.is_active = true 
            AND e.id NOT IN (SELECT unnest($3::uuid[]))
            AND e.element_key ILIKE '%' || $1 || '%'
            LIMIT $2
            """
            
            excluded_ids = [r.elementId for r in results] or ['00000000-0000-0000-0000-000000000000']
            fuzzy_results = await db.execute(fuzzy_query, selector, remaining, excluded_ids)
            for row in fuzzy_results:
                results.append(ElementLookupResult(
                    elementId=str(row["id"]),
                    elementKey=row["element_key"],
                    confidence=0.4,
                    matchType="fuzzy"
                ))
        
        # Sort by confidence (highest first)
        results.sort(key=lambda x: x.confidence, reverse=True)
        
        return {"matches": [r.dict() for r in results]}
        
    except Exception as e:raise HTTPException(status_code=500, detail=str(e))

@router.get("/elements/{element_id}/runtime-selector")
async def get_runtime_selector(
    element_id: str,
    selector_type: Optional[str] = Query('auto', description="Preferred selector type: css, xpath, or auto"),
    db: DatabaseManager = Depends(get_database_manager)
):
    """Get the best selector for an element at runtime based on policy engine rules"""
    try:
        query = """
        SELECT e.id, e.element_key, e.primary_selector, e.alt_selectors, 
               e.attributes, p.name as page_name
        FROM repo.elements e
        JOIN repo.pages p ON e.page_id = p.id
        WHERE e.id = $1 AND e.is_active = true
        """
        
        results = await db.execute(query, element_id)
        if not results:
            raise HTTPException(status_code=404, detail="Element not found")
        
        element = results[0]
        primary_selector = element["primary_selector"] or {}
        alt_selectors = element["alt_selectors"] or []
        
        # Policy engine logic for selector selection
        # Priority: css > xpath > alternatives
        # In a real implementation, this could be much more sophisticated
        
        best_selector = None
        selector_source = "primary"
        
        if selector_type == "css" or selector_type == "auto":
            if primary_selector.get("css"):
                best_selector = primary_selector["css"]
            elif selector_type == "auto" and primary_selector.get("xpath"):
                best_selector = primary_selector["xpath"]
        elif selector_type == "xpath":
            if primary_selector.get("xpath"):
                best_selector = primary_selector["xpath"]
            elif primary_selector.get("css"):
                best_selector = primary_selector["css"]
        
        # Fall back to alternatives if primary doesn't have what we need
        if not best_selector and alt_selectors:
            for alt in alt_selectors:
                if isinstance(alt, str):
                    best_selector = alt
                    selector_source = "alternative"
                    break
                elif isinstance(alt, dict) and alt.get("selector"):
                    best_selector = alt["selector"]
                    selector_source = "alternative"
                    break
        
        if not best_selector:
            raise HTTPException(status_code=404, detail="No suitable selector found for element")
        
        return {
            "elementId": element_id,
            "elementKey": element["element_key"],
            "selector": best_selector,
            "selectorType": "css" if best_selector.startswith("#") or best_selector.startswith(".") else "xpath" if best_selector.startswith("//") else "auto",
            "source": selector_source,
            "pageName": element["page_name"]
        }
        
    except HTTPException:
        raise
    except Exception as e:raise HTTPException(status_code=500, detail=str(e))