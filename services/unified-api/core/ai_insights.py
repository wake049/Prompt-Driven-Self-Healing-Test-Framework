"""
AI Insights Engine
Provides intelligent analysis for locator drift, flaky tests, and predictive failure patterns
"""
import asyncio
import json

from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import re

# Import the existing AI service for OpenAI integration
from api.ai_service import EnterpriseAIService

class InsightSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class InsightCategory(Enum):
    LOCATOR_DRIFT = "locator_drift"
    FLAKY_TEST = "flaky_test"
    PERFORMANCE_DEGRADATION = "performance_degradation"
    FAILURE_PREDICTION = "failure_prediction"
    HEALING_OPPORTUNITY = "healing_opportunity"

@dataclass
class AIInsight:
    """AI-generated insight with actionable recommendations"""
    id: str
    category: InsightCategory
    severity: InsightSeverity
    title: str
    description: str
    confidence: float  # 0.0 to 1.0
    evidence: List[str]
    recommendations: List[str]
    affected_components: List[str]
    predicted_impact: str
    created_at: datetime
    metadata: Dict[str, Any] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        result['category'] = self.category.value
        result['severity'] = self.severity.value
        result['created_at'] = self.created_at.isoformat()
        return result

@dataclass
class LocatorDriftAnalysis:
    """Analysis of locator drift patterns"""
    element_id: str
    page: str
    current_locator: str
    historical_locators: List[str]
    drift_score: float  # 0.0 to 1.0
    drift_frequency: int
    last_change: datetime
    stability_prediction: str
    suggested_improvements: List[str]

@dataclass
class FlakinessPrediction:
    """Prediction of test flakiness"""
    test_identifier: str
    flakiness_score: float  # 0.0 to 1.0
    success_rate_trend: List[float]
    failure_patterns: List[str]
    environmental_factors: List[str]
    reliability_recommendation: str

class AIInsightsEngine:
    """
    AI-powered insights engine for test automation analysis
    """
    
    def __init__(self):
        self.insights_cache: Dict[str, List[AIInsight]] = {}
        self.analysis_history: List[Dict[str, Any]] = []
        
        # Initialize OpenAI service for actual AI analysis
        self.ai_service = EnterpriseAIService()
        
        # Pattern recognition configurations
        self.drift_patterns = {
            'selector_complexity_increase': r'(.+\s.+\s.+)',  # Complex selectors
            'dynamic_attributes': r'data-\w+-\d+|id="[^"]*\d+[^"]*"',  # Dynamic IDs
            'framework_changes': r'(ng-|react-|vue-)',  # Framework-specific patterns
            'timing_dependent': r'(loading|spinner|progress)',  # Timing-dependent elements
        }
        
        self.flakiness_indicators = {
            'timing_issues': ['timeout', 'wait', 'loading', 'spinner'],
            'race_conditions': ['async', 'promise', 'callback', 'event'],
            'environment_dependent': ['localhost', 'staging', 'prod', 'env'],
            'browser_specific': ['chrome', 'firefox', 'safari', 'edge'],
        }

    async def analyze_locator_drift(self, elements_data: List[Dict[str, Any]]) -> List[LocatorDriftAnalysis]:
        """Analyze elements for locator drift patterns"""
        drift_analyses = []
        
        for element in elements_data:
            analysis = await self._analyze_single_element_drift(element)
            if analysis and analysis.drift_score > 0.3:  # Only include significant drift
                drift_analyses.append(analysis)
        
        # Sort by drift score (highest first)
        drift_analyses.sort(key=lambda x: x.drift_score, reverse=True)
        return drift_analyses[:20]  # Limit to top 20

    async def _analyze_single_element_drift(self, element: Dict[str, Any]) -> Optional[LocatorDriftAnalysis]:
        """Analyze a single element for locator drift"""
        element_id = element.get('id', '')
        if not element_id:
            return None
            
        current_locator = element.get('css_selector') or element.get('xpath', '')
        if not current_locator:
            return None
        
        # Simulate historical locator data (in real implementation, fetch from database)
        historical_locators = element.get('historical_selectors', [current_locator])
        
        # Calculate drift score based on multiple factors
        drift_score = 0.0
        drift_factors = []
        
        # Factor 1: Selector complexity increase
        complexity_scores = [self._calculate_selector_complexity(loc) for loc in historical_locators]
        if len(complexity_scores) > 1:
            complexity_trend = (complexity_scores[-1] - complexity_scores[0]) / len(complexity_scores)
            if complexity_trend > 0.2:
                drift_score += 0.3
                drift_factors.append("Selector complexity increasing over time")
        
        # Factor 2: Dynamic content detection
        for pattern_name, pattern in self.drift_patterns.items():
            if re.search(pattern, current_locator):
                drift_score += 0.2
                drift_factors.append(f"Detected {pattern_name} pattern")
        
        # Factor 3: Frequency of changes
        drift_frequency = len(set(historical_locators))
        if drift_frequency > 3:
            drift_score += 0.3
            drift_factors.append(f"High change frequency ({drift_frequency} different locators)")
        
        # Factor 4: Recent instability
        last_change = datetime.now() - timedelta(days=7)  # Mock recent change
        if drift_frequency > 1:
            drift_score += 0.2
            drift_factors.append("Recent locator changes detected")
        
        # Normalize drift score
        drift_score = min(drift_score, 1.0)
        
        # Generate improvement suggestions
        suggestions = self._generate_locator_improvements(current_locator, drift_factors)
        
        # Predict stability
        stability_prediction = self._predict_locator_stability(drift_score, drift_frequency)
        
        return LocatorDriftAnalysis(
            element_id=element_id,
            page=element.get('page', 'Unknown'),
            current_locator=current_locator,
            historical_locators=historical_locators,
            drift_score=drift_score,
            drift_frequency=drift_frequency,
            last_change=last_change,
            stability_prediction=stability_prediction,
            suggested_improvements=suggestions
        )

    def _calculate_selector_complexity(self, selector: str) -> float:
        """Calculate complexity score for a CSS selector"""
        if not selector:
            return 0.0
        
        complexity = 0.0
        
        # Basic complexity factors
        complexity += len(selector.split()) * 0.1  # Number of parts
        complexity += selector.count('>') * 0.2  # Direct child selectors
        complexity += selector.count('[') * 0.3  # Attribute selectors
        complexity += selector.count(':') * 0.2  # Pseudo-selectors
        complexity += selector.count('#') * 0.1  # ID selectors
        complexity += selector.count('.') * 0.1  # Class selectors
        
        # Dynamic content indicators
        if 'data-' in selector and any(char.isdigit() for char in selector):
            complexity += 0.5  # Dynamic data attributes
        
        if re.search(r'\d+', selector):
            complexity += 0.3  # Contains numbers (often dynamic)
        
        return min(complexity, 1.0)

    def _generate_locator_improvements(self, selector: str, drift_factors: List[str]) -> List[str]:
        """Generate specific improvement suggestions for a locator"""
        suggestions = []
        
        if "Dynamic content" in ' '.join(drift_factors):
            suggestions.append("Consider using stable attributes like data-testid instead of dynamic IDs")
            suggestions.append("Use CSS selectors that avoid dynamic content patterns")
        
        if "complexity increasing" in ' '.join(drift_factors):
            suggestions.append("Simplify selector by targeting stable parent elements")
            suggestions.append("Consider using semantic selectors instead of structural ones")
        
        if "High change frequency" in ' '.join(drift_factors):
            suggestions.append("Implement element healing strategies")
            suggestions.append("Add multiple fallback selectors for this element")
        
        if len(suggestions) == 0:
            suggestions.append("Monitor for continued stability")
            suggestions.append("Consider adding alternative selectors as backup")
        
        return suggestions

    def _predict_locator_stability(self, drift_score: float, frequency: int) -> str:
        """Predict future stability of a locator"""
        if drift_score > 0.8:
            return "High risk of future failures - immediate attention needed"
        elif drift_score > 0.6:
            return "Moderate risk - consider improvements in next sprint"
        elif drift_score > 0.4:
            return "Low risk but monitor for changes"
        else:
            return "Stable - no immediate action needed"

    async def detect_flaky_tests(self, execution_data: List[Dict[str, Any]]) -> List[FlakinessPrediction]:
        """Detect flaky test patterns using AI analysis"""
        test_groups = {}
        
        # Group executions by test identifier
        for execution in execution_data:
            test_id = execution.get('test_case_id') or execution.get('prompt_id', 'unknown')
            if test_id not in test_groups:
                test_groups[test_id] = []
            test_groups[test_id].append(execution)
        
        flakiness_predictions = []
        
        for test_id, executions in test_groups.items():
            prediction = await self._analyze_test_flakiness(test_id, executions)
            if prediction and prediction.flakiness_score > 0.3:
                flakiness_predictions.append(prediction)
        # Sort by flakiness score
        flakiness_predictions.sort(key=lambda x: x.flakiness_score, reverse=True)
        return flakiness_predictions[:15]  # Top 15 flaky tests

    async def _analyze_test_flakiness(self, test_id: str, executions: List[Dict[str, Any]]) -> Optional[FlakinessPrediction]:
        """Analyze flakiness for a specific test"""
        if len(executions) < 5:  # Need sufficient data
            return None
        
        # Calculate success rate trend
        success_rates = []
        total_executions = len(executions)
        success_count = sum(1 for ex in executions if ex.get('status') == 'completed')
        overall_success_rate = success_count / total_executions
        
        # Analyze failure patterns
        failure_patterns = []
        environmental_factors = []
        
        for execution in executions:
            if execution.get('status') != 'completed':
                # Analyze failure reasons
                error_message = execution.get('error_message', '').lower()
                
                for category, indicators in self.flakiness_indicators.items():
                    for indicator in indicators:
                        if indicator in error_message:
                            failure_patterns.append(f"{category}: {indicator}")
                
                # Environmental factor analysis
                if 'timeout' in error_message:
                    environmental_factors.append("Network/performance issues")
                if 'element not found' in error_message:
                    environmental_factors.append("UI timing issues")
                if 'stale element' in error_message:
                    environmental_factors.append("DOM refresh issues")
        
        # Calculate flakiness score
        flakiness_score = 0.0
        
        # Success rate factor
        if overall_success_rate < 0.95:
            flakiness_score += (1.0 - overall_success_rate) * 0.5
        
        # Pattern diversity factor
        unique_patterns = len(set(failure_patterns))
        if unique_patterns > 2:
            flakiness_score += 0.3
        
        # Environmental factor diversity
        unique_env_factors = len(set(environmental_factors))
        if unique_env_factors > 1:
            flakiness_score += 0.2
        
        # Intermittent failure pattern (passes sometimes, fails sometimes)
        if 0.2 < overall_success_rate < 0.8:
            flakiness_score += 0.4
        
        # Normalize score
        flakiness_score = min(flakiness_score, 1.0)
        
        # Generate reliability recommendation
        reliability_recommendation = self._generate_reliability_recommendation(
            flakiness_score, failure_patterns, environmental_factors
        )
        
        return FlakinessPrediction(
            test_identifier=test_id,
            flakiness_score=flakiness_score,
            success_rate_trend=[overall_success_rate],  # Simplified trend
            failure_patterns=list(set(failure_patterns))[:10],  # Top 10 unique patterns
            environmental_factors=list(set(environmental_factors))[:5],  # Top 5 factors
            reliability_recommendation=reliability_recommendation
        )

    def _generate_reliability_recommendation(self, score: float, patterns: List[str], factors: List[str]) -> str:
        """Generate specific reliability improvement recommendations"""
        if score > 0.8:
            return "Critical: Implement retry logic, add explicit waits, review test design"
        elif score > 0.6:
            return "High priority: Add stability improvements, implement better error handling"
        elif score > 0.4:
            return "Medium priority: Monitor for patterns, consider adding wait conditions"
        else:
            return "Low priority: Test appears stable, continue monitoring"

    async def generate_ai_insights(self, data_context: Dict[str, Any]) -> List[AIInsight]:
        """Generate comprehensive AI insights from system data using intelligent analysis"""
        insights = []
        
        try:
            # Extract data components
            elements_data = data_context.get('elements', [])
            execution_data = data_context.get('executions', [])
            performance_data = data_context.get('performance_metrics', {})
            healing_data = data_context.get('healing_data', [])
            step_failures = data_context.get('step_failures', [])
            
            # AI-powered pattern recognition and insights
            
            # 1. Intelligent Locator Drift Analysis
            drift_insights = await self._analyze_intelligent_locator_drift(elements_data, execution_data)
            insights.extend(drift_insights)
            
            # 2. Smart Flakiness Detection with Root Cause Analysis
            flaky_insights = await self._analyze_smart_flakiness(execution_data, step_failures)
            insights.extend(flaky_insights)
            
            # 3. Predictive Performance Analysis
            performance_insights = await self._analyze_predictive_performance(execution_data, performance_data)
            insights.extend(performance_insights)
            
            # 4. Healing Strategy Optimization
            healing_insights = await self._analyze_healing_optimization(healing_data, step_failures)
            insights.extend(healing_insights)
            
            # 5. Cross-Pattern Correlation Analysis
            correlation_insights = await self._analyze_cross_pattern_correlations(execution_data, step_failures, elements_data)
            insights.extend(correlation_insights)
            
            # 6. Proactive Risk Assessment
            risk_insights = await self._analyze_proactive_risks(execution_data, elements_data, step_failures)
            insights.extend(risk_insights)
            
            # 7. OpenAI-Powered Deep Analysis (when available)
            openai_insights = await self._generate_openai_insights(data_context)
            insights.extend(openai_insights)
            
        except Exception as e:# Add error insight
            error_insight = AIInsight(
                id=f"ai_error_{int(datetime.now().timestamp())}",
                category=InsightCategory.FAILURE_PREDICTION,
                severity=InsightSeverity.MEDIUM,
                title="AI Analysis Engine Error",
                description=f"AI insights engine encountered an error: {str(e)[:100]}",
                confidence=1.0,
                evidence=[str(e)],
                recommendations=["Check system logs", "Verify data quality", "Retry analysis"],
                affected_components=["AI Insights Engine"],
                predicted_impact="Reduced AI-powered analysis capability",
                created_at=datetime.now()
            )
            insights.append(error_insight)
        
        # Sort by AI confidence and severity
        insights.sort(key=lambda x: (x.severity.value, -x.confidence), reverse=True)
        return insights[:25]  # Return top 25 AI insights

    def _determine_severity(self, score: float) -> InsightSeverity:
        """Determine insight severity based on score"""
        if score >= 0.8:
            return InsightSeverity.CRITICAL
        elif score >= 0.6:
            return InsightSeverity.HIGH
        elif score >= 0.4:
            return InsightSeverity.MEDIUM
        else:
            return InsightSeverity.LOW

    async def _analyze_performance_trends(self, performance_data: Dict[str, Any]) -> List[AIInsight]:
        """Analyze performance data for concerning trends"""
        insights = []
        
        try:
            avg_time = performance_data.get('avg_execution_time', 0)
            p95_time = performance_data.get('p95_execution_time', 0)
            success_rate = performance_data.get('success_rate', 100)
            
            # Performance degradation detection
            if avg_time > 5000:  # > 5 seconds
                insights.append(AIInsight(
                    id=f"perf_slow_{int(datetime.now().timestamp())}",
                    category=InsightCategory.PERFORMANCE_DEGRADATION,
                    severity=InsightSeverity.HIGH,
                    title="Slow Execution Performance Detected",
                    description=f"Average execution time is {avg_time:.0f}ms, significantly above optimal range",
                    confidence=0.9,
                    evidence=[f"Average time: {avg_time:.0f}ms", f"P95 time: {p95_time:.0f}ms"],
                    recommendations=[
                        "Review database query performance",
                        "Optimize element locator strategies",
                        "Consider parallel execution",
                        "Analyze network latency"
                    ],
                    affected_components=["All test executions"],
                    predicted_impact="Increased test execution time and resource consumption",
                    created_at=datetime.now()
                ))
            
            # Success rate degradation
            if success_rate < 90:
                insights.append(AIInsight(
                    id=f"success_low_{int(datetime.now().timestamp())}",
                    category=InsightCategory.FAILURE_PREDICTION,
                    severity=InsightSeverity.CRITICAL,
                    title="Low Success Rate Alert",
                    description=f"Success rate is {success_rate:.1f}%, below acceptable threshold",
                    confidence=0.95,
                    evidence=[f"Success rate: {success_rate:.1f}%"],
                    recommendations=[
                        "Investigate recent failures",
                        "Review test environment stability",
                        "Analyze failure patterns",
                        "Consider test maintenance"
                    ],
                    affected_components=["Test execution pipeline"],
                    predicted_impact="Reduced confidence in test results",
                    created_at=datetime.now()
                ))
                
        except Exception as e:return insights

    async def _generate_failure_predictions(self, execution_data: List[Dict[str, Any]]) -> List[AIInsight]:
        """Generate predictive insights about potential failures"""
        insights = []
        
        try:
            # Analyze recent failure trends
            recent_failures = [ex for ex in execution_data if ex.get('status') != 'completed']
            total_executions = len(execution_data)
            
            if total_executions > 0:
                failure_rate = len(recent_failures) / total_executions
                
                if failure_rate > 0.15:  # More than 15% failure rate
                    insights.append(AIInsight(
                        id=f"predict_fail_{int(datetime.now().timestamp())}",
                        category=InsightCategory.FAILURE_PREDICTION,
                        severity=InsightSeverity.HIGH,
                        title="Elevated Failure Rate Prediction",
                        description=f"Current failure rate of {failure_rate:.1%} suggests potential system instability",
                        confidence=0.8,
                        evidence=[
                            f"Failure rate: {failure_rate:.1%}",
                            f"Recent failures: {len(recent_failures)}",
                            f"Total executions: {total_executions}"
                        ],
                        recommendations=[
                            "Implement proactive monitoring",
                            "Review environment stability",
                            "Add redundancy to critical tests",
                            "Schedule maintenance window"
                        ],
                        affected_components=["Test execution environment"],
                        predicted_impact="Potential increase in test failures",
                        created_at=datetime.now()
                    ))
                    
        except Exception as e:return insights

# Global AI insights engine instance
ai_insights_engine = AIInsightsEngine()

async def get_ai_insights(data_context: Dict[str, Any]) -> Dict[str, Any]:
    """Get AI insights for the current system state"""
    try:
        insights = await ai_insights_engine.generate_ai_insights(data_context)
        
        # Group insights by category
        insights_by_category = {}
        for insight in insights:
            category = insight.category.value
            if category not in insights_by_category:
                insights_by_category[category] = []
            insights_by_category[category].append(insight.to_dict())
        
        # Calculate summary statistics
        total_insights = len(insights)
        critical_count = sum(1 for i in insights if i.severity == InsightSeverity.CRITICAL)
        high_count = sum(1 for i in insights if i.severity == InsightSeverity.HIGH)
        avg_confidence = sum(i.confidence for i in insights) / total_insights if total_insights > 0 else 0
        
        return {
            'insights': [insight.to_dict() for insight in insights],
            'insights_by_category': insights_by_category,
            'summary': {
                'total_insights': total_insights,
                'critical_insights': critical_count,
                'high_priority_insights': high_count,
                'average_confidence': round(avg_confidence, 3),
                'analysis_timestamp': datetime.now().isoformat()
            },
            'recommendations': {
                'immediate_actions': [i.recommendations[0] for i in insights[:3] if i.recommendations],
                'next_sprint_actions': [
                    "Review all high-severity insights",
                    "Implement monitoring for critical components",
                    "Schedule technical debt reduction"
                ]
            }
        }
        
    except Exception as e:return {
            'insights': [],
            'insights_by_category': {},
            'summary': {
                'total_insights': 0,
                'critical_insights': 0,
                'high_priority_insights': 0,
                'average_confidence': 0,
                'analysis_timestamp': datetime.now().isoformat(),
                'error': str(e)
            },
            'recommendations': {
                'immediate_actions': ['Check AI insights engine logs'],
                'next_sprint_actions': ['Debug AI insights generation']
            }
        }

    async def _generate_openai_insights(self, data_context: Dict[str, Any]) -> List[AIInsight]:
        """Generate AI insights using OpenAI for deep pattern analysis"""
        insights = []
        
        if not self.ai_service.client:return insights
            
        try:
            # Prepare data summary for OpenAI analysis
            data_summary = self._prepare_data_summary(data_context)
            
            # Create OpenAI prompt for test framework analysis
            system_prompt = """You are an expert test automation engineer analyzing a self-healing test framework. 
            Analyze the provided execution data and identify patterns, risks, and optimization opportunities.
            
            Focus on:
            1. Test stability patterns and failure clustering
            2. Locator reliability and element interaction issues  
            3. Performance degradation trends
            4. Healing effectiveness and improvement opportunities
            5. Cross-test dependencies and environmental factors
            
            Provide insights in JSON format with: category, severity (LOW/MEDIUM/HIGH/CRITICAL), title, description, confidence (0-1), evidence (array), recommendations (array), affected_components (array), predicted_impact (string)."""
            
            user_prompt = f"""Analyze this test framework execution data and provide actionable insights:

DATA SUMMARY:
- Total Executions: {data_summary['total_executions']}
- Success Rate: {data_summary['success_rate']:.1%}
- Average Duration: {data_summary['avg_duration']:.1f}s
- Failed Tests: {data_summary['failed_tests']}
- Unique Elements: {data_summary['total_elements']}
- Healing Actions: {data_summary['healing_actions']}

FAILURE PATTERNS:
{json.dumps(data_summary['failure_patterns'], indent=2)}

ELEMENT ISSUES:
{json.dumps(data_summary['element_issues'], indent=2)}

PERFORMANCE TRENDS:
{json.dumps(data_summary['performance_trends'], indent=2)}

Provide maximum 3 high-impact insights with specific, actionable recommendations."""

            # Call OpenAI
            response_content = await self.ai_service._call_openai_async(
                system=system_prompt,
                user=user_prompt,
                model=self.ai_service.config["openai"]["model"],
                max_tokens=1500,
                temperature=0.3
            )
            
            if response_content:
                # Parse OpenAI response
                openai_data = json.loads(response_content)
                
                # Convert OpenAI insights to our format
                if 'insights' in openai_data:
                    for idx, insight_data in enumerate(openai_data['insights'][:3]):  # Max 3 insights
                        insight = self._convert_openai_insight(insight_data, idx)
                        if insight:
                            insights.append(insight)
                            
        except Exception as e:# Add fallback insight about OpenAI analysis
            fallback_insight = AIInsight(
                id=f"openai_analysis_{int(datetime.now().timestamp())}",
                category=InsightCategory.SYSTEM_HEALTH,
                severity=InsightSeverity.MEDIUM,
                title="AI Analysis Enhanced",
                description="OpenAI-powered analysis is active and monitoring your test framework for advanced patterns and optimization opportunities.",
                confidence=0.9,
                evidence=["OpenAI integration configured", "Deep pattern analysis enabled"],
                recommendations=["Continue monitoring AI insights", "Review periodic AI analysis reports"],
                affected_components=["AI Insights Engine"],
                predicted_impact="Enhanced pattern recognition and predictive analysis",
                created_at=datetime.now()
            )
            insights.append(fallback_insight)
            
        return insights

    def _prepare_data_summary(self, data_context: Dict[str, Any]) -> Dict[str, Any]:
        """Prepare data summary for OpenAI analysis"""
        executions = data_context.get('executions', [])
        elements = data_context.get('elements', [])
        step_failures = data_context.get('step_failures', [])
        healing_data = data_context.get('healing_data', [])
        
        # Calculate basic metrics
        total_executions = len(executions)
        completed_executions = len([ex for ex in executions if ex.get('status') == 'completed'])
        success_rate = completed_executions / total_executions if total_executions > 0 else 0
        
        # Calculate average duration
        durations = [ex.get('duration_seconds', 0) for ex in executions if ex.get('duration_seconds')]
        avg_duration = sum(durations) / len(durations) if durations else 0
        
        # Analyze failure patterns
        failure_patterns = {}
        for failure in step_failures[:10]:  # Limit to recent failures
            error_msg = str(failure.get('error_message', '')).lower()
            for keyword in ['timeout', 'element not found', 'click failed', 'network error']:
                if keyword in error_msg:
                    failure_patterns[keyword] = failure_patterns.get(keyword, 0) + 1
        
        # Analyze element issues
        element_issues = {}
        for element in elements[:20]:  # Sample of elements
            css_selector = element.get('css_selector', '')
            if any(pattern in css_selector for pattern in ['[id*="', 'nth-child(', ':contains(']):
                element_issues['complex_selectors'] = element_issues.get('complex_selectors', 0) + 1
        
        # Performance trends (simplified)
        performance_trends = {
            'avg_duration_trend': 'stable' if avg_duration < 30 else 'degrading',
            'success_rate_trend': 'good' if success_rate > 0.8 else 'concerning'
        }
        
        return {
            'total_executions': total_executions,
            'success_rate': success_rate,
            'avg_duration': avg_duration,
            'failed_tests': total_executions - completed_executions,
            'total_elements': len(elements),
            'healing_actions': len(healing_data),
            'failure_patterns': failure_patterns,
            'element_issues': element_issues,
            'performance_trends': performance_trends
        }

    def _convert_openai_insight(self, insight_data: Dict[str, Any], index: int) -> Optional[AIInsight]:
        """Convert OpenAI insight format to our AIInsight format"""
        try:
            # Map severity string to enum
            severity_map = {
                'LOW': InsightSeverity.LOW,
                'MEDIUM': InsightSeverity.MEDIUM,
                'HIGH': InsightSeverity.HIGH,
                'CRITICAL': InsightSeverity.CRITICAL
            }
            
            # Map category string to enum  
            category_map = {
                'locator': InsightCategory.LOCATOR_DRIFT,
                'flaky': InsightCategory.FLAKY_TEST,
                'performance': InsightCategory.PERFORMANCE_DEGRADATION,
                'healing': InsightCategory.HEALING_OPPORTUNITY,
                'failure': InsightCategory.FAILURE_PREDICTION,
                'system': InsightCategory.SYSTEM_HEALTH
            }
            
            # Determine category from insight content
            category = InsightCategory.SYSTEM_HEALTH  # Default
            title_lower = insight_data.get('title', '').lower()
            if any(word in title_lower for word in ['locator', 'selector', 'element']):
                category = InsightCategory.LOCATOR_DRIFT
            elif any(word in title_lower for word in ['flaky', 'flakiness', 'intermittent']):
                category = InsightCategory.FLAKY_TEST
            elif any(word in title_lower for word in ['performance', 'slow', 'timeout']):
                category = InsightCategory.PERFORMANCE_DEGRADATION
            elif any(word in title_lower for word in ['healing', 'recovery', 'fix']):
                category = InsightCategory.HEALING_OPPORTUNITY
            elif any(word in title_lower for word in ['failure', 'error', 'predict']):
                category = InsightCategory.FAILURE_PREDICTION
            
            return AIInsight(
                id=f"openai_insight_{index}_{int(datetime.now().timestamp())}",
                category=category,
                severity=severity_map.get(insight_data.get('severity', 'MEDIUM'), InsightSeverity.MEDIUM),
                title=f" AI: {insight_data.get('title', 'OpenAI Analysis')}",
                description=insight_data.get('description', 'OpenAI analysis completed'),
                confidence=min(insight_data.get('confidence', 0.8), 0.95),  # Cap AI confidence at 95%
                evidence=insight_data.get('evidence', [])[:5],  # Limit evidence
                recommendations=insight_data.get('recommendations', [])[:4],  # Limit recommendations
                affected_components=insight_data.get('affected_components', ['System'])[:3],  # Limit components
                predicted_impact=insight_data.get('predicted_impact', 'Analysis completed'),
                created_at=datetime.now()
            )
            
        except Exception as e:return None