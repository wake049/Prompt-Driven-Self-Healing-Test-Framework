from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Dict, List, Any, Optional
from schema import PromptRequest, PlanResponse
from planner import LocalPlanner
from action_catalog import ActionCatalog
import uvicorn
import os

app = FastAPI(
    title="AI-Powered Test Planning Service", 
    version="0.2.0",
    description="REST API for natural language test automation with ML-powered intent classification"
)

# SCRUM-28: Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for frontend (if available)
frontend_path = "../web-frontend"
if os.path.exists(frontend_path):
    app.mount("/ui", StaticFiles(directory=frontend_path, html=True), name="frontend")

planner = LocalPlanner()
catalog = ActionCatalog()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/plan", response_model=PlanResponse)
def plan(req: PromptRequest):
    """Generate executable test plan from natural language prompt using ML intent classification"""
    try:
        actions = planner.make_plan(req.prompt)
        if not actions:
            raise HTTPException(status_code=422, detail={"code": "VALIDATION_FAILED", "error": "Empty plan"})
        return PlanResponse(actions=actions, meta={"prompt": req.prompt, "version": "0.2.0"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "INTERNAL", "error": str(e)})

# SCRUM-26: Action Catalog Service Endpoints

@app.get("/catalog/intents")
def list_supported_intents() -> Dict[str, List[str]]:
    """List all supported intents and their available action template IDs"""
    return catalog.list_available_actions()

@app.get("/catalog/templates")
def list_all_templates() -> Dict[str, List[Dict[str, Any]]]:
    """Get all available action templates with their definitions"""
    return catalog.templates

@app.get("/catalog/templates/{template_id}")
def get_template(template_id: str) -> List[Dict[str, Any]]:
    """Get specific action template by ID"""
    template = catalog.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "error": f"Template '{template_id}' not found"})
    return template

@app.post("/catalog/actions")
def get_actions_for_intent(
    intent: str, 
    context: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """Generate action sequence for a specific intent with optional context parameters"""
    try:
        actions = catalog.get_actions_for_intent(intent, context or {})
        if not actions:
            raise HTTPException(status_code=404, detail={"code": "NO_ACTIONS", "error": f"No actions found for intent '{intent}'"})
        
        # Convert PlanItem objects to dictionaries for JSON response
        return [{"name": action.name, "params": action.params} for action in actions]
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "INTERNAL", "error": str(e)})

@app.get("/catalog/stats")
def get_catalog_statistics() -> Dict[str, Any]:
    """Get statistics about the action catalog"""
    return {
        "total_intents": len(catalog.intent_mappings),
        "total_templates": len(catalog.templates),
        "supported_intents": list(catalog.intent_mappings.keys()),
        "template_ids": list(catalog.templates.keys()),
        "version": "0.2.0"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
