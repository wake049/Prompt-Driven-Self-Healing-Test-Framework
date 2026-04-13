"""
LLM v3 Natural Language Summaries API
SCRUM-17: Integrate LLM v3 for NL summaries of test runs
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional

from datetime import datetime
import json
import asyncio
import logging
from core.database import get_database_manager, DatabaseManager
from core.auth import get_current_active_user
from models.auth_models import CurrentUser
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

class ExecutionSummaryRequest(BaseModel):
    execution_id: str
    include_steps: bool = True
    include_failures: bool = True
    include_performance: bool = True
    summary_style: str = "detailed"  # "brief", "detailed", "technical"

class ExecutionSummaryResponse(BaseModel):
    execution_id: str
    summary: str
    key_insights: List[str]
    execution_overview: Dict[str, Any]
    generated_at: datetime

@router.post("/execution/{execution_id}/summary", response_model=ExecutionSummaryResponse)
async def generate_execution_summary(
    execution_id: str,
    request: ExecutionSummaryRequest,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Generate a natural language summary of a test execution using LLM v3.
    
    This endpoint creates human-readable summaries that explain:
    - What the test was trying to accomplish
    - How it performed (success/failure rates)
    - Key issues encountered and their impact
    - Performance characteristics
    - Recommendations for improvement
    """
    try:# Get execution details
        execution_data = await get_execution_details(db, execution_id, current_user)
        if not execution_data:
            raise HTTPException(status_code=404, detail="Execution not found")
        
        # Generate LLM summary
        summary_result = await generate_llm_summary(
            execution_data, 
            request.include_steps, 
            request.include_failures,
            request.include_performance,
            request.summary_style
        )
        
        return ExecutionSummaryResponse(
            execution_id=execution_id,
            summary=summary_result["summary"],
            key_insights=summary_result["insights"],
            execution_overview=execution_data["overview"],
            generated_at=datetime.now()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")

@router.get("/execution/{execution_id}/summary")
async def get_cached_execution_summary(
    execution_id: str,
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Get a previously generated summary for an execution.
    If no summary exists, returns 404 to prompt generation.
    """
    try:
        # Check if we have a cached summary
        summary_query = """
        SELECT 
            summary_text,
            key_insights,
            execution_overview,
            generated_at
        FROM exec.execution_summaries 
        WHERE execution_id = $1 
        ORDER BY generated_at DESC 
        LIMIT 1
        """
        
        summary_record = await db.execute_one(summary_query, execution_id)
        
        if not summary_record:
            raise HTTPException(status_code=404, detail="No summary found for this execution")
        
        return {
            "execution_id": execution_id,
            "summary": summary_record["summary_text"],
            "key_insights": json.loads(summary_record["key_insights"]) if summary_record["key_insights"] else [],
            "execution_overview": json.loads(summary_record["execution_overview"]) if summary_record["execution_overview"] else {},
            "generated_at": summary_record["generated_at"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve summary: {str(e)}")

@router.post("/batch-summaries")
async def generate_batch_summaries(
    execution_ids: List[str],
    summary_style: str = "brief",
    db: DatabaseManager = Depends(get_database_manager),
    current_user: CurrentUser = Depends(get_current_active_user)
):
    """
    Generate summaries for multiple executions in batch.
    Useful for dashboard overview pages.
    """
    try:
        summaries = []
        
        for execution_id in execution_ids[:10]:  # Limit to 10 for performance
            try:
                execution_data = await get_execution_details(db, execution_id, current_user)
                if execution_data:
                    summary_result = await generate_llm_summary(
                        execution_data, 
                        include_steps=False,  # Brief for batch
                        include_failures=True,
                        include_performance=True,
                        summary_style=summary_style
                    )
                    
                    summaries.append({
                        "execution_id": execution_id,
                        "summary": summary_result["summary"],
                        "key_insights": summary_result["insights"][:3],  # Top 3 for batch
                        "status": execution_data["overview"]["status"]
                    })
            except Exception as e:
                continue
        
        return {
            "summaries": summaries,
            "generated_count": len(summaries),
            "requested_count": len(execution_ids),
            "generated_at": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate batch summaries: {str(e)}")

async def get_execution_details(db: DatabaseManager, execution_id: str, current_user: CurrentUser) -> Optional[Dict[str, Any]]:
    """Get comprehensive execution details for LLM processing"""
    try:
        # Get execution overview
        execution_query = """
        SELECT 
            r.id,
            r.test_case_id,
            r.status,
            r.started_at,
            r.finished_at,
            EXTRACT(EPOCH FROM (r.finished_at - r.started_at))::INTEGER as duration_seconds,
            r.runner_meta,
            tc.source_ref_id as prompt_id,
            p.text as prompt_text,
            p.title as prompt_title
        FROM exec.runs r
        LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
        LEFT JOIN planner.prompts p ON tc.source_ref_id = p.id
        WHERE r.id = $1
        """
        
        # Add tenant filtering
        query_params = [execution_id]
        if current_user.tenant and current_user.tenant.id:
            execution_query += " AND EXISTS (SELECT 1 FROM core.projects proj WHERE proj.id = r.project_id AND proj.tenant_id = $2)"
            query_params.append(str(current_user.tenant.id))
        
        execution = await db.execute_one(execution_query, *query_params)
        if not execution:
            return None
        
        # Get step details
        steps_query = """
        SELECT 
            step_order,
            action,
            target,
            status,
            error_message,
            created_at,
            EXTRACT(EPOCH FROM (
                CASE 
                    WHEN created_at IS NOT NULL 
                    THEN created_at - LAG(created_at, 1, $2) OVER (ORDER BY step_order)
                    ELSE INTERVAL '0 seconds'
                END
            )) * 1000 as duration_ms
        FROM exec.step_results
        WHERE test_run_id = $1
        ORDER BY step_order
        """
        
        steps = await db.execute(steps_query, execution_id, execution['started_at'])
        
        # Calculate statistics
        total_steps = len(steps)
        passed_steps = len([s for s in steps if s['status'] == 'passed'])
        failed_steps = len([s for s in steps if s['status'] == 'failed'])
        success_rate = (passed_steps / total_steps * 100) if total_steps > 0 else 0
        
        # Identify failure patterns
        failure_patterns = []
        if failed_steps > 0:
            failed_step_data = [s for s in steps if s['status'] == 'failed']
            # Group by error type
            error_groups = {}
            for step in failed_step_data:
                error_msg = step.get('error_message', 'Unknown error')
                if error_msg not in error_groups:
                    error_groups[error_msg] = []
                error_groups[error_msg].append(step)
            
            for error, step_list in error_groups.items():
                failure_patterns.append({
                    "error_type": error,
                    "affected_steps": len(step_list),
                    "step_actions": [s['action'] for s in step_list]
                })
        
        # Check for data binding usage
        bindings_used = []
        try:
            bindings_query = """
            SELECT DISTINCT rule_name, target
            FROM datahub.data_bindings 
            WHERE scope = $1 AND is_active = true
            """
            prompt_scope = f"prompt_{execution.get('prompt_id', '')}"
            bindings = await db.execute(bindings_query, prompt_scope)
            if bindings:
                bindings_used = [{"name": b['rule_name'], "target": b['target']} for b in bindings]
        except Exception as e:
            return {
                "overview": {
                    "execution_id": execution_id,
                    "prompt_text": execution.get('prompt_text', 'Unknown test'),
                    "prompt_title": execution.get('prompt_title', 'Untitled Test'),
                    "status": execution['status'],
                    "duration_seconds": execution.get('duration_seconds', 0),
                    "started_at": execution['started_at'].isoformat() if execution['started_at'] else None,
                    "finished_at": execution['finished_at'].isoformat() if execution['finished_at'] else None,
                    "total_steps": total_steps,
                    "passed_steps": passed_steps,
                    "failed_steps": failed_steps,
                    "success_rate": round(success_rate, 1)
                },
            "steps": steps,
            "failure_patterns": failure_patterns,
            "bindings_used": bindings_used
        }
        
    except Exception as e:
        return None

async def generate_llm_summary(
    execution_data: Dict[str, Any], 
    include_steps: bool = True,
    include_failures: bool = True,
    include_performance: bool = True,
    summary_style: str = "detailed"
) -> Dict[str, Any]:
    """Generate natural language summary using LLM v3"""
    
    try:
        # Import LLM service (assuming it exists from earlier implementation)
        from api.ai_service import EnterpriseAIService
        ai_service = EnterpriseAIService()
        
        overview = execution_data["overview"]
        steps = execution_data["steps"]
        failure_patterns = execution_data["failure_patterns"]
        bindings_used = execution_data["bindings_used"]
        
        # Build context for LLM
        context_parts = []
        
        # Basic execution info
        context_parts.append(f"""
EXECUTION OVERVIEW:
- Test Purpose: {overview['prompt_text']}
- Execution Status: {overview['status']}
- Duration: {overview['duration_seconds']} seconds
- Success Rate: {overview['success_rate']}% ({overview['passed_steps']}/{overview['total_steps']} steps passed)
""")
        
        # Step details (if requested)
        if include_steps and len(steps) > 0:
            context_parts.append("\nSTEP EXECUTION DETAILS:")
            for i, step in enumerate(steps[:10]):  # Limit to first 10 steps
                status_emoji = "✅" if step['status'] == 'passed' else "❌" if step['status'] == 'failed' else "⏸️"
                duration_ms = step.get('duration_ms', 0)
                context_parts.append(f"  {i+1}. {status_emoji} {step['action']} on {step.get('target', 'unknown')} ({duration_ms:.0f}ms)")
                if step['status'] == 'failed' and step.get('error_message'):
                    context_parts.append(f"     Error: {step['error_message']}")
        
        # Failure analysis (if requested)
        if include_failures and failure_patterns:
            context_parts.append("\nFAILURE ANALYSIS:")
            for pattern in failure_patterns:
                context_parts.append(f"  - {pattern['error_type']}: {pattern['affected_steps']} steps affected")
                context_parts.append(f"    Actions: {', '.join(pattern['step_actions'])}")
        
        # Data binding usage
        if bindings_used:
            context_parts.append(f"\nDATA BINDINGS USED: {len(bindings_used)} bindings")
            for binding in bindings_used[:5]:  # Show first 5
                context_parts.append(f"  - {binding['name']}")
        
        # Performance context (if requested)
        if include_performance:
            avg_step_time = overview['duration_seconds'] / max(overview['total_steps'], 1)
            context_parts.append(f"\nPERFORMANCE METRICS:")
            context_parts.append(f"  - Average step time: {avg_step_time:.2f} seconds")
            context_parts.append(f"  - Total execution time: {overview['duration_seconds']} seconds")
        
        execution_context = "\n".join(context_parts)
        
        # Create LLM prompt based on style
        if summary_style == "brief":
            system_prompt = """You are an expert test automation analyst. Create a brief, executive-level summary of this test execution. Focus on the key outcome, main issues, and actionable insights. Keep it under 100 words."""
            user_prompt = f"""Analyze this test execution and provide a brief summary:

{execution_context}

Provide a concise summary with:
1. What the test accomplished
2. Key issues (if any)
3. One actionable recommendation
"""
        elif summary_style == "technical":
            system_prompt = """You are a technical test automation engineer. Provide a detailed technical analysis of this test execution for other engineers. Include specific failure modes, performance characteristics, and technical recommendations."""
            user_prompt = f"""Analyze this test execution and provide a technical summary:

{execution_context}

Provide a technical analysis with:
1. Technical execution summary
2. Failure mode analysis (if applicable)
3. Performance assessment
4. Technical recommendations for improvement
5. Potential root causes of issues
"""
        else:  # detailed
            system_prompt = """You are an experienced QA engineer providing a comprehensive test execution report. Create a detailed but readable summary that explains what happened, why it matters, and what should be done next."""
            user_prompt = f"""Analyze this test execution and provide a comprehensive summary:

{execution_context}

Provide a detailed summary covering:
1. Test purpose and execution overview
2. Success/failure analysis with specific details
3. Performance and efficiency assessment
4. Impact of any data binding usage
5. Key insights and patterns observed
6. Specific recommendations for improvement
7. Risk assessment for similar future tests
"""
        
        # Generate summary using LLM
        try:
            # Use the AI service's chat completion method
            summary_response = await ai_service._chat_completion(
                model="gpt-4",  # Use GPT-4 for better analysis
                system=system_prompt,
                user=user_prompt,
                max_tokens=800 if summary_style == "brief" else 1500,
                temperature=0.3  # Lower temperature for more factual summaries
            )
            
            summary_text = summary_response.strip()
            
        except Exception as llm_error:
            # Fallback to rule-based summary
            summary_text = generate_fallback_summary(overview, failure_patterns, summary_style)
        
        # Generate key insights
        insights = extract_key_insights(overview, failure_patterns, bindings_used, summary_style)
        
        # Store summary in database for caching
        await store_summary_cache(execution_data["overview"]["execution_id"], summary_text, insights, overview)
        
        return {
            "summary": summary_text,
            "insights": insights
        }
        
    except Exception as e:
        # Return fallback summary
        return {
            "summary": generate_fallback_summary(execution_data["overview"], execution_data["failure_patterns"], summary_style),
            "insights": extract_key_insights(execution_data["overview"], execution_data["failure_patterns"], execution_data["bindings_used"], summary_style)
        }

def generate_fallback_summary(overview: Dict[str, Any], failure_patterns: List[Dict], style: str) -> str:
    """Generate a rule-based summary when LLM is unavailable"""
    
    status = overview['status']
    success_rate = overview['success_rate']
    duration = overview['duration_seconds']
    total_steps = overview['total_steps']
    
    if style == "brief":
        if success_rate >= 90:
            return f"✅ Test completed successfully with {success_rate}% success rate ({total_steps} steps in {duration}s). Minimal issues detected."
        elif success_rate >= 70:
            return f"⚠️ Test completed with {success_rate}% success rate. {len(failure_patterns)} issue types identified. Review recommended."
        else:
            return f"❌ Test had significant issues with {success_rate}% success rate. {len(failure_patterns)} failure types need attention."
    
    # Detailed fallback
    summary_parts = []
    summary_parts.append(f"Test Execution Summary for: {overview.get('prompt_title', 'Unknown Test')}")
    summary_parts.append(f"Status: {status.upper()}")
    summary_parts.append(f"Success Rate: {success_rate}% ({overview['passed_steps']}/{total_steps} steps passed)")
    summary_parts.append(f"Duration: {duration} seconds")
    
    if failure_patterns:
        summary_parts.append(f"\nIssues Detected ({len(failure_patterns)} types):")
        for pattern in failure_patterns:
            summary_parts.append(f"  - {pattern['error_type']}: {pattern['affected_steps']} steps")
    
    if success_rate >= 90:
        summary_parts.append("\nOverall Assessment: Excellent execution with minimal issues.")
    elif success_rate >= 70:
        summary_parts.append("\nOverall Assessment: Good execution with some areas for improvement.")
    else:
        summary_parts.append("\nOverall Assessment: Significant issues detected, investigation recommended.")
    
    return "\n".join(summary_parts)

def extract_key_insights(overview: Dict[str, Any], failure_patterns: List[Dict], bindings_used: List[Dict], style: str) -> List[str]:
    """Extract key insights from execution data"""
    insights = []
    
    success_rate = overview['success_rate']
    duration = overview['duration_seconds']
    total_steps = overview['total_steps']
    
    # Performance insights
    avg_step_time = duration / max(total_steps, 1)
    if avg_step_time > 5:
        insights.append(f"⏱️ Steps are taking longer than expected ({avg_step_time:.1f}s average) - consider optimization")
    elif avg_step_time < 1:
        insights.append(f"🚀 Excellent performance with fast step execution ({avg_step_time:.1f}s average)")
    
    # Success rate insights
    if success_rate == 100:
        insights.append("🎯 Perfect execution - all steps completed successfully")
    elif success_rate >= 95:
        insights.append("✅ Excellent reliability with minimal failures")
    elif success_rate >= 80:
        insights.append("📊 Good execution with room for improvement")
    elif success_rate >= 60:
        insights.append("⚠️ Moderate issues detected - investigation recommended")
    else:
        insights.append("🚨 Significant issues requiring immediate attention")
    
    # Failure pattern insights
    if failure_patterns:
        most_common_error = max(failure_patterns, key=lambda x: x['affected_steps'])
        insights.append(f"🔍 Most common issue: {most_common_error['error_type']} ({most_common_error['affected_steps']} steps)")
        
        if len(failure_patterns) > 3:
            insights.append(f"⚡ Multiple failure types ({len(failure_patterns)}) suggest systemic issues")
    
    # Data binding insights
    if bindings_used:
        insights.append(f"🔗 Data bindings active ({len(bindings_used)} bindings) - dynamic test data in use")
    
    # Duration insights
    if duration > 300:  # 5 minutes
        insights.append("⏳ Long execution time - consider breaking into smaller test chunks")
    elif duration < 30:  # 30 seconds
        insights.append("⚡ Fast execution - good for frequent testing")
    
    return insights[:7]  # Limit to 7 key insights

async def store_summary_cache(execution_id: str, summary_text: str, insights: List[str], overview: Dict[str, Any]):
    """Store generated summary in database for caching"""
    try:
        from core.database import get_database_manager
        db = await get_database_manager()
        
        # First, create the table if it doesn't exist
        create_table_query = """
        CREATE TABLE IF NOT EXISTS exec.execution_summaries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            execution_id UUID NOT NULL,
            summary_text TEXT NOT NULL,
            key_insights JSONB,
            execution_overview JSONB,
            generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            llm_model VARCHAR(100) DEFAULT 'gpt-4'
        );
        """
        await db.execute(create_table_query)
        
        # Store the summary
        insert_query = """
        INSERT INTO exec.execution_summaries 
        (execution_id, summary_text, key_insights, execution_overview)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (execution_id) DO UPDATE SET
            summary_text = EXCLUDED.summary_text,
            key_insights = EXCLUDED.key_insights,
            execution_overview = EXCLUDED.execution_overview,
            generated_at = NOW()
        """
        
        await db.execute(
            insert_query,
            execution_id,
            summary_text,
            json.dumps(insights),
            json.dumps(overview)
        )
    except Exception as e:
        logger.warning("Failed to persist execution summary for execution_id=%s: %s", execution_id, e)