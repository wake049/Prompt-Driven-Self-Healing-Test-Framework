from fastapi import FastAPI, HTTPException
from schema import PromptRequest, PlanResponse
from planner import LocalPlanner
import uvicorn

app = FastAPI(title="Local Prompt Planner", version="0.1.0")
planner = LocalPlanner()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/plan", response_model=PlanResponse)
def plan(req: PromptRequest):
    try:
        actions = planner.make_plan(req.prompt)
        if not actions:
            raise HTTPException(status_code=422, detail={"code": "VALIDATION_FAILED", "error": "Empty plan"})
        return PlanResponse(actions=actions, meta={"prompt": req.prompt, "version": "0.1.0"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": "INTERNAL", "error": str(e)})

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
