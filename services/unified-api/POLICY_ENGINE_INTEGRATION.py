"""
Policy Engine Integration Guide

This file documents where and how to integrate the enhanced policy engine 
into the test generation and healing workflows.
"""

# =============================================================================
# INTEGRATION POINT 1: Test Plan Generation (ai_service.py)
# =============================================================================

# Location: services/unified-api/api/ai_service.py
# Function: EnterpriseAIService.plan_test_steps()
# Line: ~950 (after step generation, before validation)

# INTEGRATION CODE:
"""
# After AI/heuristic step generation completes (around line 945)
# Before the safety policy validation (around line 950)

# Policy Engine Integration - Evaluate generated test plan
try:
    from services.policy_engine_enhanced import create_policy_engine
    
    # Get project and environment IDs from the request
    project_id = prompt_envelope.project_id if hasattr(prompt_envelope, 'project_id') else None
    environment_id = prompt_envelope.environment_id if hasattr(prompt_envelope, 'environment_id') else None
    
    if project_id and environment_id:
        logger.info(f"🎯 Applying policy engine evaluation for project {project_id}")
        
        # Initialize policy engine
        db = await get_database()
        policy_engine = await create_policy_engine(db, project_id, environment_id)
        
        # Evaluate test plan against policies
        test_plan_dict = {
            "steps": [
                {
                    "step_index": i,
                    "action": step.action,
                    "target": step.target,
                    "element": {
                        "confidence": step.confidence * 100  # Convert to 0-100 scale
                    },
                    "args": step.args
                }
                for i, step in enumerate(steps)
            ]
        }
        
        evaluation = await policy_engine.evaluate_test_plan(test_plan_dict)
        
        # Handle blocked steps
        if not evaluation["approved"]:
            logger.warning(f"⚠️ Policy engine blocked {len(evaluation['blocked_steps'])} steps")
            
            # Filter out blocked steps
            blocked_indices = {s["step_index"] for s in evaluation["blocked_steps"]}
            steps = [step for i, step in enumerate(steps) if i not in blocked_indices]
            
            # Add warnings to clarifications
            for blocked in evaluation["blocked_steps"]:
                clarifications.append(
                    Clarification(
                        reason="policy_blocked",
                        message=f"Step {blocked['step_index']} ({blocked['action']}) was blocked by policy: {blocked['reason']}",
                        suggested_action="Review policy settings or modify test approach"
                    )
                )
        
        # Handle flagged steps (low confidence)
        if evaluation["flagged_steps"]:
            logger.info(f"🔍 Policy engine flagged {len(evaluation['flagged_steps'])} steps for review")
            
            for flagged in evaluation["flagged_steps"]:
                step_index = flagged["step_index"]
                if step_index < len(steps):
                    # Mark step for review
                    steps[step_index].requires_review = True
                    steps[step_index].review_reason = flagged["reason"]
                    
                    # Add clarification
                    clarifications.append(
                        Clarification(
                            reason="low_confidence",
                            message=f"Step {step_index} has low confidence ({flagged['confidence']}%) and requires review",
                            suggested_action="Verify element selector before execution"
                        )
                    )
        
        logger.info(f"✅ Policy evaluation complete - {len(steps)} steps approved")
        
        # Log policy stats
        policy_stats = await policy_engine.get_policy_stats()
        logger.debug(f"📊 Policy Stats: {policy_stats}")
        
except ImportError:
    logger.debug("ℹ️ Policy engine not available, skipping policy evaluation")
except Exception as e:
    logger.error(f"❌ Policy engine evaluation failed: {e}")
    # Don't fail the entire request, just log the error
"""

# =============================================================================
# INTEGRATION POINT 2: Healing Submission (sql_backend.py)
# =============================================================================

# Location: services/unified-api/api/sql_backend.py
# Function: submit_healing_data()
# Line: ~583 (when processing successful healing attempts)

# INTEGRATION CODE:
"""
# Inside the loop processing healing attempts (around line 584)
# After checking if attempt.result == "SUCCESS"

# Policy Engine Integration - Check if healing should be auto-applied
try:
    from services.policy_engine_enhanced import create_policy_engine
    
    # Calculate confidence score for healing suggestion
    confidence = attempt.confidence if hasattr(attempt, 'confidence') else 85
    
    # Get project/environment from element lookup
    if element_lookup and project_id:
        # Get environment ID (get default environment for project)
        env_result = await db.fetchrow(
            '''
            SELECT id FROM core.environments 
            WHERE project_id = $1 AND is_default = true
            LIMIT 1
            ''',
            project_id
        )
        
        environment_id = env_result["id"] if env_result else None
        
        if environment_id:
            logger.info(f"🎯 Evaluating healing suggestion with policy engine")
            
            # Initialize policy engine
            policy_engine = await create_policy_engine(db, project_id, environment_id)
            
            # Check if healing can be auto-applied
            can_auto_apply = policy_engine.can_auto_heal(confidence)
            requires_review = policy_engine.requires_review(confidence)
            
            # Determine initial status based on policy
            if can_auto_apply:
                initial_status = "approved"
                logger.info(f"✅ Healing auto-approved (confidence: {confidence}% >= threshold)")
                
                # Log the auto-approval decision
                await policy_engine.log_decision(
                    "auto_heal",
                    {
                        "element_id": element_id,
                        "original_selector": attempt.originalLocator,
                        "healed_selector": attempt.healedLocator,
                        "confidence": confidence
                    },
                    outcome="approved"
                )
                
            elif requires_review:
                initial_status = "open"
                logger.info(f"🔍 Healing requires review (confidence: {confidence}% < threshold)")
                
                # Log the review requirement
                await policy_engine.log_decision(
                    "review_required",
                    {
                        "element_id": element_id,
                        "original_selector": attempt.originalLocator,
                        "healed_selector": attempt.healedLocator,
                        "confidence": confidence
                    },
                    outcome="pending_review"
                )
            else:
                initial_status = "open"
                logger.info(f"⚠️ Healing status: {initial_status} (confidence: {confidence}%)")
            
            # Get policy stats for logging
            policy_stats = await policy_engine.get_policy_stats()
            logger.debug(f"📊 Healing Policy Stats: {policy_stats}")
        else:
            # No environment found, use default status
            initial_status = "open"
            logger.debug("ℹ️ No environment found for policy evaluation, using default status")
    else:
        initial_status = "open"
        
except ImportError:
    logger.debug("ℹ️ Policy engine not available, using default healing status")
    initial_status = "open"
except Exception as e:
    logger.error(f"❌ Policy engine evaluation failed for healing: {e}")
    initial_status = "open"

# Use the determined status when creating review item
await db.execute(
    '''
    INSERT INTO healing.review_items (
        project_id,
        element_id,
        status,  # Use initial_status instead of hardcoded "open"
        suggestion,
        rationale
    ) VALUES ($1, $2, $3, $4, $5)
    ''',
    project_id,
    element_id,
    initial_status,  # <-- Changed from hardcoded "open"
    json.dumps({
        "originalSelector": attempt.originalLocator,
        "suggestedSelector": attempt.healedLocator,
        "attemptedAlternatives": attempt.attemptedAlternatives,
        "actionType": "update_primary_selector",
        "timestamp": attempt.timestamp,
        "healingSource": "java-framework",
        "confidence": confidence,
        "autoApproved": initial_status == "approved"
    }),
    f"Self-healing suggested new locator for element '{attempt.elementId}'. "
    f"Original locator failed, but healing found a working alternative. "
    f"Confidence: {confidence}%"
)
"""

# =============================================================================
# INTEGRATION POINT 3: Element Detection (During Test Execution)
# =============================================================================

# Location: services/unified-api/api/ai_service.py
# Function: generate_element_suggestions() or element ranking
# When: During test execution when elements are being detected

# INTEGRATION CODE:
"""
# When ranking/filtering elements (around line 870)
# After element ranking, before returning to test executor

try:
    from services.policy_engine_enhanced import create_policy_engine
    
    # Get project and environment from context
    if project_id and environment_id:
        logger.info(f"🎯 Applying policy-based element filtering")
        
        # Initialize policy engine
        db = await get_database()
        policy_engine = await create_policy_engine(db, project_id, environment_id)
        
        # Get screenshot policy
        should_capture_on_error = policy_engine.should_capture_screenshot("error")
        should_capture_on_success = policy_engine.should_capture_screenshot("success")
        
        # Get timeout configuration
        timeout_config = policy_engine.get_timeout_config()
        element_wait_timeout = timeout_config["element_wait_timeout_ms"]
        
        # Apply confidence thresholds to element suggestions
        filtered_elements = []
        for element in ranked_elements:
            confidence = getattr(element, 'relevance_score', 80) * 100
            
            # Check if element meets confidence threshold
            if not policy_engine.requires_review(int(confidence)):
                filtered_elements.append(element)
            else:
                logger.debug(
                    f"⚠️ Element filtered out due to low confidence: "
                    f"{element.element_id} (confidence: {confidence}%)"
                )
        
        ranked_elements = filtered_elements
        logger.info(f"✅ Policy-based filtering: {len(ranked_elements)} elements passed confidence threshold")
        
        # Add policy configuration to response metadata
        response_metadata = {
            "policy": {
                "screenshot_on_error": should_capture_on_error,
                "screenshot_on_success": should_capture_on_success,
                "element_wait_timeout_ms": element_wait_timeout,
                "confidence_threshold": policy_engine.get_rule_value("healing.review_threshold", 75)
            }
        }
        
except ImportError:
    logger.debug("ℹ️ Policy engine not available")
except Exception as e:
    logger.error(f"❌ Policy-based element filtering failed: {e}")
"""

# =============================================================================
# INTEGRATION POINT 4: Add Policy Engine to Startup
# =============================================================================

# Location: services/unified-api/main.py
# When: Application startup

# INTEGRATION CODE:
"""
# Add to startup event handler (around line 150)

@app.on_event("startup")
async def startup_event():
    '''Application startup tasks'''
    logger.info("🚀 Starting Unified API Server...")
    
    # ... existing startup code ...
    
    # Initialize Policy Engine
    try:
        from services.policy_engine_enhanced import PolicyEngine
        logger.info("✅ Policy Engine available for runtime evaluation")
    except ImportError:
        logger.warning("⚠️ Policy Engine not available - policy evaluation will be skipped")
"""

# =============================================================================
# REQUIRED SCHEMA ADDITIONS
# =============================================================================

# Add these fields to PlanStep schema if not already present:
"""
class PlanStep(BaseModel):
    # ... existing fields ...
    requires_review: bool = False
    review_reason: Optional[str] = None
"""

# Add these fields to PromptEnvelope schema:
"""
class PromptEnvelope(BaseModel):
    # ... existing fields ...
    project_id: Optional[UUID] = None
    environment_id: Optional[UUID] = None
"""

# =============================================================================
# TESTING THE INTEGRATION
# =============================================================================

"""
# Test 1: Verify policy engine loads for a project
curl -X POST http://localhost:8000/api/v1/ai/v1/plan \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "login with valid credentials",
    "tenant_id": "test-tenant",
    "project_id": "your-project-uuid",
    "environment_id": "your-env-uuid"
  }'

# Test 2: Submit healing data and verify policy evaluation
curl -X POST http://localhost:8000/api/v1/sql-backend/healing/submit \
  -H "Content-Type: application/json" \
  -d '{
    "runId": "test-run-123",
    "healing_attempts": [{
      "elementId": "login-button",
      "page": "LoginPage",
      "originalLocator": "//button[@id='old']",
      "healedLocator": "//button[@id='new']",
      "result": "SUCCESS",
      "confidence": 95
    }]
  }'

# Expected: Should auto-approve if confidence >= threshold
# Check healing.review_items table for status='approved'

# Test 3: Check policy decisions log
SELECT * FROM policy.policy_decisions 
WHERE environment_id = 'your-env-uuid'
ORDER BY decided_at DESC 
LIMIT 10;
"""

# =============================================================================
# SUMMARY
# =============================================================================

"""
Integration Points Summary:

1. ✅ Test Plan Generation (ai_service.py)
   - Evaluates generated steps against policies
   - Blocks dangerous actions
   - Flags low-confidence steps for review

2. ✅ Healing Submission (sql_backend.py)
   - Auto-approves high-confidence healing
   - Requires review for low-confidence healing
   - Logs all policy decisions

3. ✅ Element Detection (ai_service.py)
   - Filters elements by confidence threshold
   - Applies timeout policies
   - Configures screenshot policies

4. ✅ Application Startup (main.py)
   - Validates policy engine availability
   - Logs initialization status

Benefits:
- Automated quality gates
- Consistent policy enforcement
- Audit trail of all decisions
- Reduced manual review burden
- Configurable per environment
"""
