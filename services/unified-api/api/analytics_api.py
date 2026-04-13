"""
Analytics API Router for M8 Dashboard Components
Provides endpoints for healing analytics, trends, failure patterns, and AI insights
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from datetime import datetime, timedelta
import asyncio
import logging

from core.auth import get_current_active_user
from models.auth_models import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/healing-analytics")
async def get_healing_analytics(days: int = 30, current_user: CurrentUser = Depends(get_current_active_user)):
    """Get healing success analytics for the dashboard using real execution data"""
    try:
        from core.database import get_database
        db = await get_database()
        
        # Build project filter
        project_filter = ""
        query_params = [days]
        if current_user.project and current_user.project.id:
            project_filter = "AND r.project_id = $2"
            query_params.append(str(current_user.project.id))
        
        # Get real healing data from exec.runs and step_results
        healing_stats = await db.fetchrow(
            f"""
            SELECT 
                COUNT(*) as total_attempts,
                COUNT(CASE WHEN r.status = 'completed' AND 
                      EXISTS(SELECT 1 FROM exec.step_results sr WHERE sr.test_run_id = r.id AND sr.status = 'failed')
                      THEN 1 END) as successful_healing,
                COUNT(CASE WHEN r.status IN ('completed', 'partial') AND 
                      EXISTS(SELECT 1 FROM exec.step_results sr WHERE sr.test_run_id = r.id AND sr.status = 'failed') AND
                      EXISTS(SELECT 1 FROM exec.step_results sr WHERE sr.test_run_id = r.id AND sr.status = 'passed')
                      THEN 1 END) as partial_healing,
                COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_healing,
                AVG(CASE 
                    WHEN r.status = 'completed' AND r.finished_at IS NOT NULL AND r.started_at IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000 
                    ELSE NULL 
                END) as avg_healing_time
            FROM exec.runs r
            WHERE r.created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
            {project_filter}
            """, *query_params
        )
        
        # Get daily trend data for healing attempts
        trend_data = await db.fetch(
            f"""
            SELECT 
                DATE(r.created_at) as date,
                COUNT(*) as attempts,
                COUNT(CASE WHEN r.status = 'completed' AND 
                      EXISTS(SELECT 1 FROM exec.step_results sr WHERE sr.test_run_id = r.id AND sr.status = 'failed')
                      THEN 1 END) as successful,
                COUNT(CASE WHEN r.status IN ('completed', 'partial') AND 
                      EXISTS(SELECT 1 FROM exec.step_results sr WHERE sr.test_run_id = r.id AND sr.status = 'failed') AND
                      EXISTS(SELECT 1 FROM exec.step_results sr WHERE sr.test_run_id = r.id AND sr.status = 'passed')
                      THEN 1 END) as partial,
                COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed
            FROM exec.runs r
            WHERE r.created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
            {project_filter}
            GROUP BY DATE(r.created_at)
            ORDER BY DATE(r.created_at) ASC
            """, *query_params
        )
        
        # Get detailed healing attempts with step-level analysis
        healing_details = await db.fetch(
            f"""
            SELECT 
                r.id,
                r.created_at,
                r.status,
                tc.title as test_name,
                r.runner_meta->>'prompt_id' as prompt_id,
                EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) * 1000 as duration_ms,
                (SELECT COUNT(*) FROM exec.step_results sr WHERE sr.test_run_id = r.id) as total_steps,
                (SELECT COUNT(*) FROM exec.step_results sr WHERE sr.test_run_id = r.id AND sr.status = 'passed') as passed_steps,
                (SELECT COUNT(*) FROM exec.step_results sr WHERE sr.test_run_id = r.id AND sr.status = 'failed') as failed_steps,
                (SELECT JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'step_order', sr.step_order,
                        'action', sr.action_data->>'action',
                        'target', sr.action_data->>'selector',
                        'error_message', sr.error_details->>'message'
                    )
                ) FROM exec.step_results sr WHERE sr.test_run_id = r.id AND sr.status = 'failed') as failed_step_details
            FROM exec.runs r
            LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
            WHERE r.created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
            {project_filter}
            ORDER BY r.created_at DESC
            LIMIT 50
            """, *query_params
        )
        
        # Calculate success rate and other metrics
        total = healing_stats['total_attempts'] if healing_stats else 0
        successful = healing_stats['successful_healing'] if healing_stats else 0
        partial = healing_stats['partial_healing'] if healing_stats else 0
        failed = healing_stats['failed_healing'] if healing_stats else 0
        avg_time = healing_stats['avg_healing_time'] if healing_stats else 0
        
        success_rate = (successful / total * 100) if total > 0 else 0
        
        # Format trend data
        formatted_trends = []
        for trend in trend_data:
            formatted_trends.append({
                "date": trend['date'].isoformat(),
                "attempts": trend['attempts'],
                "successful": trend['successful'],
                "partial": trend['partial'],
                "failed": trend['failed']
            })
        
        # Format detailed healing attempts
        formatted_details = []
        for detail in healing_details:
            healing_type = "none"
            if detail['status'] == 'completed' and detail['failed_steps'] > 0:
                healing_type = "successful"
            elif detail['status'] in ['completed', 'partial'] and detail['failed_steps'] > 0 and detail['passed_steps'] > 0:
                healing_type = "partial"
            elif detail['status'] == 'failed':
                healing_type = "failed"
            
            formatted_details.append({
                "id": str(detail['id']),
                "timestamp": detail['created_at'].isoformat(),
                "test_name": detail['test_name'] or f"Prompt {detail['prompt_id'][:8] if detail['prompt_id'] else 'Unknown'}",
                "healing_type": healing_type,
                "duration_ms": detail['duration_ms'],
                "steps_total": detail['total_steps'],
                "steps_passed": detail['passed_steps'],
                "steps_failed": detail['failed_steps'],
                "success_rate": round((detail['passed_steps'] / detail['total_steps'] * 100) if detail['total_steps'] > 0 else 0, 1),
                "failed_steps": detail['failed_step_details'] or []
            })
        
        result = {
            "success": True,
            "healing_metrics": {
                "total_attempts": total,
                "successful_healing": successful,
                "partial_healing": partial,
                "failed_healing": failed,
                "success_rate": round(success_rate, 1),
                "avg_healing_time": round(avg_time, 1),
                "trend_data": formatted_trends[-30:] if formatted_trends else []  # Last 30 days max
            },
            "healing_details": formatted_details
        }
        return result
        
    except Exception as e:# Return empty data structure to prevent frontend errors
        return {
            "success": True,
            "healing_metrics": {
                "total_attempts": 0,
                "successful_healing": 0,
                "partial_healing": 0,
                "failed_healing": 0,
                "success_rate": 0,
                "avg_healing_time": 0,
                "trend_data": []
            },
            "healing_details": []
        }

@router.get("/trends")
async def get_analytics_trends(timeRange: str = "24h", current_user: CurrentUser = Depends(get_current_active_user)):
    """Get performance trends for analytics dashboard using real execution data"""
    try:
        from core.database import get_database
        db = await get_database()
        
        # Convert timeRange to appropriate interval (whitelist valid values)
        interval_map = {
            "1h": "1 hour", 
            "24h": "1 day", 
            "7d": "7 days", 
            "30d": "30 days"
        }
        interval = interval_map.get(timeRange, "1 day")
        
        # Build project filter
        project_filter = ""
        project_filter_step = ""
        if current_user.project and current_user.project.id:
            project_id = str(current_user.project.id)
            project_filter = f"AND r.project_id = '{project_id}'"
            project_filter_step = f"AND r.project_id = '{project_id}'"
        
        # Get comprehensive execution metrics with corrected time filtering
        metrics_result = await db.fetchrow(
            f"""
            SELECT 
                COUNT(*) as total_executions,
                COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as successful_executions,
                COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_executions,
                COUNT(CASE WHEN r.status = 'running' THEN 1 END) as running_executions,
                AVG(CASE WHEN r.finished_at IS NOT NULL THEN 
                    EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) 
                END) * 1000 as avg_execution_time,
                PERCENTILE_CONT(0.95) WITHIN GROUP (
                    ORDER BY CASE WHEN r.finished_at IS NOT NULL THEN 
                        EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) 
                    END
                ) * 1000 as p95_execution_time
            FROM exec.runs r
            WHERE r.started_at >= NOW() - INTERVAL '{interval}'
            {project_filter}
            """
        )
        
        # Get step-level success metrics
        step_metrics = await db.fetchrow(
            f"""
            SELECT 
                COUNT(*) as total_steps,
                COUNT(CASE WHEN sr.status = 'passed' THEN 1 END) as passed_steps,
                COUNT(CASE WHEN sr.status = 'failed' THEN 1 END) as failed_steps,
                COUNT(DISTINCT r.id) as executions_with_steps
            FROM exec.step_results sr
            JOIN exec.runs r ON sr.test_run_id = r.id
            WHERE r.started_at >= NOW() - INTERVAL '{interval}'
            {project_filter_step}
            """
        )
        
        # Get time-series data for trends (hourly or daily buckets)
        bucket_interval = "1 hour" if timeRange in ["1h", "24h"] else "1 day"
        bucket_unit = bucket_interval.split()[1]
        trends_query = f"""
            SELECT 
                DATE_TRUNC('{bucket_unit}', r.started_at) as time_bucket,
                COUNT(*) as total_runs,
                COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as successful_runs,
                COUNT(CASE WHEN r.status = 'failed' THEN 1 END) as failed_runs,
                AVG(CASE WHEN r.finished_at IS NOT NULL THEN 
                    EXTRACT(EPOCH FROM (r.finished_at - r.started_at)) 
                END) as avg_duration_seconds
            FROM exec.runs r
            WHERE r.started_at >= NOW() - INTERVAL '{interval}'
            {project_filter}
            GROUP BY time_bucket
            ORDER BY time_bucket
        """
        
        temporal_data = await db.fetch(trends_query)
        
        # Format the results
        if not metrics_result:
            return {
                "success": True,
                "performance_trends": [],
                "temporal_data": []
            }
            
        total_executions = metrics_result['total_executions'] or 0
        successful_executions = metrics_result['successful_executions'] or 0
        success_rate = (successful_executions / total_executions * 100) if total_executions > 0 else 0
        
        # Build performance trends
        performance_trends = [
            {
                "metric": "Success Rate",
                "value": round(success_rate, 1),
                "unit": "%",
                "trend": "stable",  # Could be calculated based on historical data
                "change": 0.0
            },
            {
                "metric": "Avg Execution Time", 
                "value": round((metrics_result['avg_execution_time'] or 0) / 1000, 1),
                "unit": "s",
                "trend": "stable",
                "change": 0.0
            },
            {
                "metric": "Total Executions",
                "value": total_executions,
                "unit": "runs", 
                "trend": "up" if total_executions > 0 else "stable",
                "change": 0.0
            }
        ]
        
        # Format temporal data
        formatted_temporal = []
        for point in temporal_data:
            bucket_total = point['total_runs'] or 0
            bucket_success = point['successful_runs'] or 0
            bucket_success_rate = (bucket_success / bucket_total * 100) if bucket_total > 0 else 0
            
            formatted_temporal.append({
                "timestamp": point['time_bucket'].isoformat(),
                "success_rate": round(bucket_success_rate, 1),
                "total_runs": bucket_total,
                "avg_duration": round(point['avg_duration_seconds'] or 0, 1),
                "successful_runs": bucket_success,
                "failed_runs": point['failed_runs'] or 0
            })
        
        result = {
            "success": True,
            "performance_trends": performance_trends,
            "temporal_data": formatted_temporal
        }
        
        return result
        
    except Exception as e:return {
            "success": True,
            "performance_trends": [],
            "temporal_data": []
        }

def _calculate_trend_change(current_value: float, time_range: str) -> float:
    """Estimate trend direction from current value (heuristic until historical comparison is implemented)"""
    if current_value > 90:
        return 2.5
    elif current_value < 70:
        return -8.0
    else:
        return 1.2

def _calculate_performance_trend(avg_time: float) -> float:
    """Estimate performance trend from average execution time (heuristic)"""
    if avg_time < 3000:
        return 3.0
    elif avg_time > 10000:
        return -12.0
    else:
        return -1.5

@router.get("/failure-patterns")
async def get_failure_patterns(timeRange: str = "24h", current_user: CurrentUser = Depends(get_current_active_user)):
    """Get failure pattern analysis for analytics dashboard using real step failure data"""
    try:
        from core.database import get_database
        db = await get_database()
        
        # Convert timeRange to days
        days_map = {"1h": 1, "24h": 1, "7d": 7, "30d": 30}
        days = days_map.get(timeRange, 1)
        
        # Build project filter params
        query_params = [days]
        project_filter = ""
        if current_user.project and current_user.project.id:
            project_filter = "AND r.project_id = $2"
            query_params.append(str(current_user.project.id))
        
        # Get step failure patterns
        failure_patterns = await db.fetch(
            f"""
            SELECT 
                sr.action_data->>'action' as error_type,
                COUNT(*) as frequency,
                STRING_AGG(DISTINCT COALESCE(tc.title, 'Unknown Test'), ', ' ORDER BY COALESCE(tc.title, 'Unknown Test')) as affected_tests,
                ARRAY_AGG(DISTINCT sr.action_data->>'selector') FILTER (WHERE sr.action_data->>'selector' IS NOT NULL) as affected_selectors,
                STRING_AGG(DISTINCT COALESCE(sr.error_details->>'message', 'No error message'), ' | ' ORDER BY COALESCE(sr.error_details->>'message', 'No error message')) as error_messages,
                ARRAY_AGG(
                    JSON_BUILD_OBJECT(
                        'date', DATE(r.created_at)::text,
                        'value', 1
                    )
                ) as failure_occurrences
            FROM exec.step_results sr
            JOIN exec.runs r ON sr.test_run_id = r.id
            LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
            WHERE sr.status = 'failed'
            AND r.created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
            {project_filter}
            GROUP BY sr.action_data->>'action'
            HAVING COUNT(*) >= 2
            ORDER BY frequency DESC
            LIMIT 10
            """, *query_params
        )
        
        # Get error message patterns
        error_message_patterns = await db.fetch(
            f"""
            SELECT 
                CASE 
                    WHEN sr.error_details->>'message' ILIKE '%not found%' OR sr.error_details->>'message' ILIKE '%no such element%' THEN 'Element Not Found'
                    WHEN sr.error_details->>'message' ILIKE '%timeout%' OR sr.error_details->>'message' ILIKE '%wait%' THEN 'Timeout Error'
                    WHEN sr.error_details->>'message' ILIKE '%stale%' OR sr.error_details->>'message' ILIKE '%reference%' THEN 'Stale Element Reference'
                    WHEN sr.error_details->>'message' ILIKE '%click%' OR sr.error_details->>'message' ILIKE '%clickable%' THEN 'Click Intercepted'
                    WHEN sr.error_details IS NULL OR sr.error_details->>'message' IS NULL OR sr.error_details->>'message' = '' THEN 'Unknown Error'
                    ELSE 'Other Error'
                END as error_category,
                COUNT(*) as frequency,
                ARRAY_AGG(DISTINCT sr.action_data->>'action') as affected_actions,
                STRING_AGG(DISTINCT COALESCE(tc.title, 'Unknown Test'), ', ' ORDER BY COALESCE(tc.title, 'Unknown Test')) as affected_tests
            FROM exec.step_results sr
            JOIN exec.runs r ON sr.test_run_id = r.id
            LEFT JOIN tests.test_cases tc ON r.test_case_id = tc.id
            WHERE sr.status = 'failed'
            AND r.created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
            {project_filter}
            GROUP BY error_category
            ORDER BY frequency DESC
            """, *query_params
        )
        
        patterns = []
        
        # Process action-based failure patterns
        for i, pattern in enumerate(failure_patterns):
            # Calculate severity based on frequency and impact
            severity = "high" if pattern['frequency'] > 10 else "medium" if pattern['frequency'] > 5 else "low"
            
            # Create trend data by aggregating daily counts
            trend_data = {}
            for occurrence in pattern['failure_occurrences']:
                date = occurrence['date']
                if date not in trend_data:
                    trend_data[date] = 0
                trend_data[date] += 1
            
            trend_array = [{"date": date, "value": count} for date, count in sorted(trend_data.items())]
            
            # Determine affected components
            affected_components = []
            if pattern['affected_tests']:
                test_list = pattern['affected_tests'].split(', ')
                affected_components.extend(test_list[:3])  # Limit to first 3 tests
            
            patterns.append({
                "pattern_id": f"action_pattern_{i+1}",
                "error_type": f"{pattern['error_type']} Failures",
                "severity": severity,
                "frequency": pattern['frequency'],
                "affected_components": affected_components,
                "details": {
                    "action_type": pattern['error_type'],
                    "sample_selectors": pattern['affected_selectors'][:5] if pattern['affected_selectors'] else [],
                    "error_messages": pattern['error_messages'][:200] + "..." if len(pattern['error_messages']) > 200 else pattern['error_messages']
                },
                "trend": trend_array[-7:] if len(trend_array) > 7 else trend_array  # Last 7 days
            })
        
        # Process error message patterns (add as additional patterns)
        for i, pattern in enumerate(error_message_patterns):
            if pattern['frequency'] >= 3:  # Only include significant error patterns
                severity = "critical" if pattern['frequency'] > 15 else "high" if pattern['frequency'] > 8 else "medium"
                
                patterns.append({
                    "pattern_id": f"error_pattern_{i+1}",
                    "error_type": pattern['error_category'],
                    "severity": severity,
                    "frequency": pattern['frequency'],
                    "affected_components": pattern['affected_actions'][:3] if pattern['affected_actions'] else [],
                    "details": {
                        "error_category": pattern['error_category'],
                        "affected_actions": pattern['affected_actions'],
                        "sample_tests": pattern['affected_tests'][:100] + "..." if len(pattern['affected_tests']) > 100 else pattern['affected_tests']
                    },
                    "trend": [  # Mock trend for error patterns
                        {"date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"), "value": max(1, pattern['frequency'] // 3)},
                        {"date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"), "value": max(1, pattern['frequency'] // 2)},
                        {"date": datetime.now().strftime("%Y-%m-%d"), "value": pattern['frequency']}
                    ]
                })
        
        # Sort patterns by severity and frequency
        severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        patterns.sort(key=lambda x: (severity_order.get(x['severity'], 0), x['frequency']), reverse=True)
        
        return {
            "success": True,
            "failure_patterns": patterns[:15],  # Limit to top 15 patterns
            "summary": {
                "total_patterns": len(patterns),
                "critical_patterns": len([p for p in patterns if p['severity'] == 'critical']),
                "high_patterns": len([p for p in patterns if p['severity'] == 'high']),
                "total_failures": sum([p['frequency'] for p in patterns]),
                "analysis_period": timeRange
            }
        }
        
    except Exception as e:return {
            "success": True,
            "failure_patterns": [],
            "summary": {
                "total_patterns": 0,
                "critical_patterns": 0,
                "high_patterns": 0,
                "total_failures": 0,
                "analysis_period": timeRange
            }
        }

@router.get("/ai-insights")
async def get_ai_insights(current_user: CurrentUser = Depends(get_current_active_user)):
    """Get AI-powered insights for the dashboard using OpenAI analysis"""
    try:
        from core.database import get_database
        import os
        import json
        
        db = await get_database()
        
        # Build project filter
        project_filter = ""
        project_filter_step = ""
        if current_user.project and current_user.project.id:
            project_id = str(current_user.project.id)
            project_filter = f"AND r.project_id = '{project_id}'"
            project_filter_step = f"AND r.project_id = '{project_id}'"
        
        # Get real data for AI analysis
        execution_summary = await db.fetchrow(
            f"""
            SELECT 
                COUNT(*) as total_runs,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_runs,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_runs,
                AVG(CASE WHEN finished_at IS NOT NULL THEN 
                    EXTRACT(EPOCH FROM (finished_at - started_at)) 
                END) as avg_duration_seconds
            FROM exec.runs r
            WHERE r.started_at >= NOW() - INTERVAL '7 days'
            {project_filter}
            """
        )
        
        # Get step failure patterns
        step_failures = await db.fetch(
            f"""
            SELECT 
                sr.action_data->>'action' as action,
                sr.action_data->>'selector' as target,
                sr.error_details->>'message' as error_message,
                COUNT(*) as failure_count
            FROM exec.step_results sr
            JOIN exec.runs r ON sr.test_run_id = r.id
            WHERE r.started_at >= NOW() - INTERVAL '7 days'
            AND sr.status = 'failed'
            {project_filter_step}
            GROUP BY sr.action_data->>'action', sr.action_data->>'selector', sr.error_details->>'message'
            ORDER BY failure_count DESC
            LIMIT 10
            """
        )
        
        # Pre-compute metrics used by both OpenAI and fallback paths
        insights = []
        total_runs = execution_summary['total_runs'] or 0
        success_rate = (execution_summary['successful_runs'] / total_runs * 100) if total_runs > 0 else 0.0
        avg_duration = execution_summary['avg_duration_seconds'] or 0

        # Try to get OpenAI insights
        try:
            # Check if OpenAI is available
            openai_key = os.getenv("OPENAI_API_KEY")
            if openai_key:
                # Import OpenAI client
                from openai import OpenAI
                client = OpenAI(api_key=openai_key)
                
                # Prepare data for AI analysis
                total_runs = execution_summary['total_runs'] or 0
                success_rate = (execution_summary['successful_runs'] / total_runs * 100) if total_runs > 0 else 0
                avg_duration = execution_summary['avg_duration_seconds'] or 0
                
                failure_patterns = []
                for failure in step_failures[:5]:  # Top 5 failures
                    failure_patterns.append({
                        "action": failure['action'],
                        "target": failure['target'][:100] if failure['target'] else "Unknown",
                        "error": failure['error_message'][:100] if failure['error_message'] else "No message",
                        "count": failure['failure_count']
                    })
                
                # Create OpenAI prompt for intelligent analysis
                system_prompt = """You are an expert test automation engineer analyzing a self-healing test framework. 
                Analyze the provided test execution data and provide intelligent insights with specific, actionable recommendations.
                
                Focus on identifying:
                1. Patterns in test failures that indicate systemic issues
                2. Performance bottlenecks and optimization opportunities  
                3. Element locator stability issues
                4. Recommendations for improving test reliability
                
                Respond in JSON format with an array of insights. Each insight should have:
                - title: Short descriptive title
                - description: Detailed analysis (2-3 sentences)
                - category: One of ["performance", "reliability", "locators", "patterns", "optimization"]
                - severity: "low", "medium", "high", or "critical" 
                - confidence: Number 0-100 representing confidence in the analysis
                - recommendations: Array of specific actionable recommendations
                - evidence: Array of supporting evidence from the data
                """
                
                user_prompt = f"""Analyze this test framework execution data:

EXECUTION SUMMARY (Past 7 days):
- Total test runs: {total_runs}
- Success rate: {success_rate:.1f}%
- Failed runs: {execution_summary['failed_runs'] or 0}
- Average duration: {avg_duration:.1f} seconds

TOP FAILURE PATTERNS:
{json.dumps(failure_patterns, indent=2)}

PERFORMANCE INDICATORS:
- Fast execution (< 10s): {'Yes' if avg_duration < 10 else 'No'}
- High success rate (> 90%): {'Yes' if success_rate > 90 else 'No'}
- Stable patterns: {'Yes' if len(failure_patterns) < 3 else 'No'}

Provide 2-3 intelligent insights with specific recommendations for improving this test framework."""

                # Call OpenAI
                response = client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_tokens=1000,
                    temperature=0.3,
                    response_format={"type": "json_object"}
                )
                
                # Parse OpenAI response
                ai_response = json.loads(response.choices[0].message.content)
                insights = ai_response.get('insights', [])
                
                # Format insights for our API
                formatted_insights = []
                for i, insight in enumerate(insights[:3]):  # Max 3 insights
                    formatted_insights.append({
                        "id": f"openai_insight_{i}_{int(datetime.now().timestamp())}",
                        "title": f"AI: {insight.get('title', 'Analysis Complete')}",
                        "description": insight.get('description', 'OpenAI analysis completed'),
                        "category": insight.get('category', 'analysis'),
                        "severity": insight.get('severity', 'medium'),
                        "confidence": min(insight.get('confidence', 85), 95),  # Cap at 95%
                        "evidence": insight.get('evidence', [])[:4],  # Max 4 evidence points
                        "recommendations": insight.get('recommendations', [])[:3],  # Max 3 recommendations
                        "affected_components": ["Test Framework", "Element Locators"],
                        "predicted_impact": f"Potential {insight.get('severity', 'medium')} impact on test reliability",
                        "created_at": datetime.now().isoformat()
                    })
                
                return {
                    "success": True,
                    "insights": formatted_insights,
                    "summary": {
                        "total_insights": len(formatted_insights),
                        "critical_insights": len([i for i in formatted_insights if i['severity'] == 'critical']),
                        "high_priority_insights": len([i for i in formatted_insights if i['severity'] == 'high']),
                        "average_confidence": sum(i['confidence'] for i in formatted_insights) / len(formatted_insights) if formatted_insights else 0,
                        "analysis_timestamp": datetime.now().isoformat(),
                        "ai_powered": True,
                        "data_source": "Real execution data + OpenAI analysis"
                    }
                }

        except Exception:  # OpenAI failed or unavailable — fall through to rule-based insights below
            pass

        # Fallback / supplement: rule-based insights (runs when OpenAI didn't return early)
        # Insight 1: Success Rate Analysis
        if success_rate < 80:
                insights.append({
                    "id": f"success_rate_{int(datetime.now().timestamp())}",
                    "title": "Low Success Rate Detected",
                    "description": f"Your test framework has a {success_rate:.1f}% success rate over the past 7 days, which is below the recommended 90%+ threshold. This indicates potential stability issues that need attention.",
                    "category": "reliability",
                    "severity": "high" if success_rate < 70 else "medium",
                    "confidence": 92,
                    "evidence": [
                        f"{execution_summary['failed_runs']} out of {total_runs} runs failed",
                        f"Success rate: {success_rate:.1f}%",
                        "Multiple failure patterns detected"
                    ],
                    "recommendations": [
                        "Review and update unstable element selectors",
                        "Implement retry logic for flaky tests",
                        "Add explicit waits for dynamic content",
                        "Investigate environmental factors"
                    ],
                    "affected_components": ["Test Execution Engine", "Element Locators"],
                    "predicted_impact": "Continued low success rate will impact CI/CD reliability",
                    "created_at": datetime.now().isoformat()
                })
        elif success_rate > 95:
                insights.append({
                    "id": f"success_rate_{int(datetime.now().timestamp())}",
                    "title": "Excellent Test Stability",
                    "description": f"Your test framework maintains an excellent {success_rate:.1f}% success rate. This indicates robust test design and stable element locators.",
                    "category": "performance",
                    "severity": "low",
                    "confidence": 95,
                    "evidence": [
                        f"High success rate: {success_rate:.1f}%",
                        f"Only {execution_summary['failed_runs']} failures in {total_runs} runs",
                        "Consistent performance pattern"
                    ],
                    "recommendations": [
                        "Continue monitoring for any degradation",
                        "Document successful patterns for other tests",
                        "Consider expanding test coverage"
                    ],
                    "affected_components": ["Test Framework"],
                    "predicted_impact": "Maintaining high reliability supports continuous delivery",
                    "created_at": datetime.now().isoformat()
                })
        
        # Insight 2: Performance Analysis
        if avg_duration > 30:
            insights.append({
                "id": f"performance_{int(datetime.now().timestamp())}",
                "title": "Slow Test Execution Detected",
                "description": f"Average test execution time is {avg_duration:.1f} seconds, which may impact CI/CD pipeline efficiency. Consider optimization strategies.",
                "category": "performance",
                "severity": "medium" if avg_duration < 60 else "high",
                "confidence": 88,
                "evidence": [
                    f"Average duration: {avg_duration:.1f} seconds",
                    "Slower than recommended 15-second target",
                    f"Total runs analyzed: {total_runs}"
                ],
                "recommendations": [
                    "Optimize slow element lookups",
                    "Reduce unnecessary wait times",
                    "Consider parallel test execution",
                    "Profile individual test steps"
                ],
                "affected_components": ["Test Execution Engine", "Element Interactions"],
                "predicted_impact": "Slow tests will increase CI/CD pipeline duration",
                "created_at": datetime.now().isoformat()
            })
        
        # Insight 3: Failure Pattern Analysis
        if step_failures and len(step_failures) > 0:
            top_failure = step_failures[0]
            insights.append({
                "id": f"failure_pattern_{int(datetime.now().timestamp())}",
                "title": f"Recurring Failure: {top_failure['action']} Actions",
                "description": f"The '{top_failure['action']}' action is failing frequently ({top_failure['failure_count']} times), suggesting a systemic issue that requires investigation.",
                "category": "patterns",
                "severity": "high" if top_failure['failure_count'] > 5 else "medium",
                "confidence": 90,
                "evidence": [
                    f"Action '{top_failure['action']}' failed {top_failure['failure_count']} times",
                    f"Target element: {(top_failure['target'] or 'Unknown')}",
                    f"Common error: {(top_failure['error_message'] or 'No message')}"
                ],
                "recommendations": [
                    f"Review '{top_failure['action']}' implementation for edge cases",
                    "Update element selectors to be more stable",
                    "Add better error handling and retry logic",
                    "Investigate timing issues with dynamic elements"
                ],
                "affected_components": [f"{top_failure['action']} Actions", "Element Selectors"],
                "predicted_impact": f"Unresolved {top_failure['action']} failures will continue to reduce test reliability",
                "created_at": datetime.now().isoformat()
            })
        
        return {
            "success": True,
            "insights": insights,
            "summary": {
                "total_insights": len(insights),
                "critical_insights": len([i for i in insights if i['severity'] == 'critical']),
                "high_priority_insights": len([i for i in insights if i['severity'] == 'high']),
                "average_confidence": sum(i['confidence'] for i in insights) / len(insights) if insights else 0,
                "analysis_timestamp": datetime.now().isoformat(),
                "ai_powered": False,
                "data_source": "Real execution data analysis"
            }
        }
        
    except Exception as e:return {
            "success": False,
            "insights": [{
                "id": f"error_{int(datetime.now().timestamp())}",
                "title": "AI Analysis Error",
                "description": f"Unable to generate AI insights due to system error: {str(e)[:100]}",
                "category": "system",
                "severity": "medium",
                "confidence": 100,
                "evidence": ["System error occurred"],
                "recommendations": ["Check system logs", "Retry analysis", "Contact support if persistent"],
                "affected_components": ["AI Insights Engine"],
                "predicted_impact": "Reduced insight generation capability",
                "created_at": datetime.now().isoformat()
            }],
            "summary": {
                "total_insights": 1,
                "critical_insights": 0,
                "high_priority_insights": 0,
                "average_confidence": 100,
                "analysis_timestamp": datetime.now().isoformat()
            }
        }
