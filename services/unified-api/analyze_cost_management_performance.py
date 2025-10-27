"""
Memory and Performance Analysis for Cost Management Service
Analyzes memory usage patterns, caching efficiency, and optimization opportunities
"""

import sys
import os
import time
import tracemalloc
import json
from typing import Dict, Any, List
from datetime import datetime, timedelta

# Add the unified-api directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.cost_management import CostManagementService
from core.element_ranking import ElementRankingService
from performance_profiler import PythonPerformanceProfiler

class CostManagementAnalyzer:
    """Analyzer for Cost Management Service performance"""
    
    def __init__(self):
        self.profiler = PythonPerformanceProfiler(enable_tracemalloc=True)
        self.cost_service = CostManagementService()
        self.element_service = ElementRankingService()
        
    def analyze_memory_patterns(self) -> Dict[str, Any]:
        """Analyze memory usage patterns in cost management operations"""
        
        print(" Analyzing Cost Management Memory Patterns...")
        
        # Start memory tracking
        tracemalloc.start()
        initial_snapshot = self.profiler.capture_snapshot("Cost_Analysis_Start")
        
        results = {
            'test_scenarios': [],
            'memory_analysis': {},
            'performance_metrics': {},
            'optimization_recommendations': []
        }
        
        # Test Scenario 1: Token Estimation with Various Payload Sizes
        print(" Testing token estimation with varying payload sizes...")
        
        # Create mock prompt envelopes of different sizes
        test_payloads = self._create_test_payloads()
        
        token_estimation_results = []
        for i, (size_label, payload) in enumerate(test_payloads.items()):
            snapshot_before = self.profiler.capture_snapshot(f"Token_Estimation_{size_label}_Start")
            
            start_time = time.time()
            estimated_tokens, estimated_cost = self.cost_service.estimate_cost(payload)
            end_time = time.time()
            
            snapshot_after = self.profiler.capture_snapshot(f"Token_Estimation_{size_label}_End")
            
            memory_used = snapshot_after.memory_usage['rss'] - snapshot_before.memory_usage['rss']
            
            token_estimation_results.append({
                'payload_size': size_label,
                'estimated_tokens': estimated_tokens,
                'estimated_cost': estimated_cost,
                'processing_time_ms': (end_time - start_time) * 1000,
                'memory_used_bytes': memory_used
            })
        
        results['test_scenarios'].append({
            'name': 'Token Estimation Performance',
            'results': token_estimation_results
        })
        
        # Test Scenario 2: Usage Tracking Performance
        print(" Testing usage tracking performance...")
        
        usage_tracking_results = []
        tenant_ids = [f"tenant_{i}" for i in range(10)]
        
        for tenant_id in tenant_ids:
            snapshot_before = self.profiler.capture_snapshot(f"Usage_Tracking_{tenant_id}_Start")
            
            start_time = time.time()
            
            # Track multiple usage entries
            for j in range(20):
                self.cost_service.track_usage(
                    tenant_id=tenant_id,
                    input_tokens=500 + j * 10,
                    output_tokens=200 + j * 5,
                    model="gpt-4o",
                    processing_time_ms=150 + j * 10,
                    cache_hits=j % 3
                )
            
            # Get analytics
            analytics = self.cost_service.get_usage_analytics(tenant_id)
            end_time = time.time()
            
            snapshot_after = self.profiler.capture_snapshot(f"Usage_Tracking_{tenant_id}_End")
            
            memory_used = snapshot_after.memory_usage['rss'] - snapshot_before.memory_usage['rss']
            
            usage_tracking_results.append({
                'tenant_id': tenant_id,
                'tracking_operations': 20,
                'processing_time_ms': (end_time - start_time) * 1000,
                'memory_used_bytes': memory_used,
                'analytics_data_size': len(str(analytics))
            })
        
        results['test_scenarios'].append({
            'name': 'Usage Tracking Performance',
            'results': usage_tracking_results
        })
        
        # Test Scenario 3: Cache Performance Analysis
        print(" Testing cache performance...")
        
        cache_results = self._analyze_cache_performance()
        results['test_scenarios'].append({
            'name': 'Cache Performance Analysis',
            'results': cache_results
        })
        
        # Test Scenario 4: Memory Leak Detection
        print(" Testing for memory leaks...")
        
        leak_analysis = self._detect_memory_leaks()
        results['test_scenarios'].append({
            'name': 'Memory Leak Detection',
            'results': leak_analysis
        })
        
        # Generate final analysis
        final_snapshot = self.profiler.capture_snapshot("Cost_Analysis_Complete")
        
        # Memory analysis
        memory_analysis = self.profiler.analyze_memory_usage()
        top_allocations = self.profiler.get_top_memory_allocations()
        
        results['memory_analysis'] = {
            'overall_analysis': memory_analysis,
            'top_memory_allocations': top_allocations,
            'total_snapshots': len(self.profiler.snapshots)
        }
        
        # Performance metrics
        if initial_snapshot and final_snapshot:
            total_memory_growth = final_snapshot.memory_usage['rss'] - initial_snapshot.memory_usage['rss']
            total_time = final_snapshot.timestamp - initial_snapshot.timestamp
            
            results['performance_metrics'] = {
                'total_memory_growth_mb': total_memory_growth / (1024 * 1024),
                'total_execution_time_seconds': total_time,
                'memory_growth_rate_kb_per_sec': (total_memory_growth / 1024) / total_time if total_time > 0 else 0
            }
        
        # Generate optimization recommendations
        results['optimization_recommendations'] = self._generate_optimization_recommendations(results)
        
        return results
    
    def _create_test_payloads(self) -> Dict[str, Any]:
        """Create test payloads of various sizes for testing"""
        from api.ai_service import PromptEnvelope, PageSlice, ElementInfo
        
        # Small payload
        small_elements = [
            ElementInfo(
                id=f"elem_{i}",
                tag="div",
                text=f"Element {i}",
                attributes={"class": "test-class"},
                selector=f"css=.test-{i}"
            ) for i in range(5)
        ]
        
        # Medium payload
        medium_elements = [
            ElementInfo(
                id=f"elem_{i}",
                tag="div",
                text=f"This is a longer text for element {i} with more detailed content",
                attributes={"class": "test-class", "data-id": f"test-{i}", "role": "button"},
                selector=f"css=.test-container .element-{i}"
            ) for i in range(25)
        ]
        
        # Large payload
        large_elements = [
            ElementInfo(
                id=f"elem_{i}",
                tag="div",
                text=f"This is an extensive text description for element {i} with comprehensive details about its functionality, purpose, and context within the application interface. This element serves multiple purposes and contains rich metadata.",
                attributes={
                    "class": "complex-test-class with-multiple-classes",
                    "data-id": f"comprehensive-test-element-{i}",
                    "role": "button",
                    "aria-label": f"Detailed aria label for element {i}",
                    "data-analytics": f"track_element_{i}",
                    "style": "position: relative; margin: 10px; padding: 5px;"
                },
                selector=f"css=.main-container .sub-container .element-group .test-element-{i}"
            ) for i in range(100)
        ]
        
        return {
            'small': PromptEnvelope(
                prompt="Simple test prompt",
                page_slice=PageSlice(elements=small_elements, strategy="simple"),
                tenant_id="test-tenant"
            ),
            'medium': PromptEnvelope(
                prompt="Medium complexity test prompt with more detailed requirements and specifications",
                page_slice=PageSlice(elements=medium_elements, strategy="detailed"),
                tenant_id="test-tenant"
            ),
            'large': PromptEnvelope(
                prompt="Complex test prompt with extensive requirements, detailed specifications, comprehensive test scenarios, multiple use cases, edge case handling, error conditions, performance considerations, accessibility requirements, and comprehensive validation criteria that need to be thoroughly tested and validated",
                page_slice=PageSlice(elements=large_elements, strategy="comprehensive"),
                tenant_id="test-tenant"
            )
        }
    
    def _analyze_cache_performance(self) -> Dict[str, Any]:
        """Analyze caching performance in element ranking service"""
        
        cache_results = {
            'cache_hit_rates': [],
            'memory_efficiency': {},
            'performance_impact': {}
        }
        
        # Test cache performance with repeated queries
        test_queries = [
            "login form elements",
            "navigation menu items", 
            "product listing elements",
            "checkout form fields",
            "user profile elements"
        ]
        
        # First pass - populate cache
        for query in test_queries:
            self.element_service._score_element_relevance(query, "test-element", {})
        
        # Second pass - test cache hits
        for query in test_queries:
            start_time = time.time()
            result = self.element_service._score_element_relevance(query, "test-element", {})
            end_time = time.time()
            
            cache_results['cache_hit_rates'].append({
                'query': query,
                'processing_time_ms': (end_time - start_time) * 1000,
                'cache_hit': True  # Simplified for this analysis
            })
        
        # Get cache statistics
        cache_stats = self.element_service.get_cache_stats()
        cache_results['memory_efficiency'] = cache_stats
        
        return cache_results
    
    def _detect_memory_leaks(self) -> Dict[str, Any]:
        """Detect potential memory leaks in repeated operations"""
        
        leak_results = {
            'repeated_operations': [],
            'memory_growth_pattern': [],
            'leak_indicators': []
        }
        
        initial_memory = self.profiler.capture_snapshot("Leak_Detection_Start").memory_usage['rss']
        
        # Perform repeated operations that could cause leaks
        for iteration in range(20):
            snapshot_before = self.profiler.capture_snapshot(f"Iteration_{iteration}_Start")
            
            # Simulate typical cost management operations
            test_payload = list(self._create_test_payloads().values())[1]  # Medium payload
            
            # Multiple operations that could accumulate memory
            for i in range(10):
                estimated_tokens, cost = self.cost_service.estimate_cost(test_payload)
                self.cost_service.track_usage(
                    tenant_id=f"leak_test_tenant_{i}",
                    input_tokens=estimated_tokens,
                    output_tokens=100,
                    model="gpt-4o",
                    processing_time_ms=150
                )
            
            snapshot_after = self.profiler.capture_snapshot(f"Iteration_{iteration}_End")
            
            memory_after = snapshot_after.memory_usage['rss']
            memory_growth = memory_after - initial_memory
            
            leak_results['memory_growth_pattern'].append({
                'iteration': iteration,
                'memory_mb': memory_after / (1024 * 1024),
                'growth_from_start_mb': memory_growth / (1024 * 1024)
            })
            
            # Check for significant memory growth
            if memory_growth > 50 * 1024 * 1024:  # More than 50MB growth
                leak_results['leak_indicators'].append({
                    'iteration': iteration,
                    'memory_growth_mb': memory_growth / (1024 * 1024),
                    'description': f"Significant memory growth detected at iteration {iteration}"
                })
        
        return leak_results
    
    def _generate_optimization_recommendations(self, analysis_results: Dict[str, Any]) -> List[str]:
        """Generate optimization recommendations based on analysis"""
        
        recommendations = []
        
        # Analyze memory usage patterns
        memory_metrics = analysis_results.get('performance_metrics', {})
        memory_growth_mb = memory_metrics.get('total_memory_growth_mb', 0)
        
        if memory_growth_mb > 100:
            recommendations.append("🚨 HIGH MEMORY USAGE: Consider implementing more aggressive memory cleanup")
        
        # Analyze token estimation performance
        token_results = None
        for scenario in analysis_results.get('test_scenarios', []):
            if scenario['name'] == 'Token Estimation Performance':
                token_results = scenario['results']
                break
        
        if token_results:
            avg_processing_time = sum(r['processing_time_ms'] for r in token_results) / len(token_results)
            if avg_processing_time > 100:
                recommendations.append(" SLOW TOKEN ESTIMATION: Consider caching token estimation results")
        
        # Analyze usage tracking
        usage_results = None
        for scenario in analysis_results.get('test_scenarios', []):
            if scenario['name'] == 'Usage Tracking Performance':
                usage_results = scenario['results']
                break
        
        if usage_results:
            total_memory_used = sum(r['memory_used_bytes'] for r in usage_results)
            if total_memory_used > 10 * 1024 * 1024:  # More than 10MB
                recommendations.append(" HIGH MEMORY USAGE IN TRACKING: Implement batch processing for usage data")
        
        # Cache performance recommendations
        cache_results = None
        for scenario in analysis_results.get('test_scenarios', []):
            if scenario['name'] == 'Cache Performance Analysis':
                cache_results = scenario['results']
                break
        
        if cache_results:
            cache_stats = cache_results.get('memory_efficiency', {})
            if cache_stats.get('total_entries', 0) > 1000:
                recommendations.append(" LARGE CACHE SIZE: Implement cache eviction policies")
        
        # Memory leak recommendations
        leak_results = None
        for scenario in analysis_results.get('test_scenarios', []):
            if scenario['name'] == 'Memory Leak Detection':
                leak_results = scenario['results']
                break
        
        if leak_results and leak_results.get('leak_indicators'):
            recommendations.append(" POTENTIAL MEMORY LEAK: Review object lifecycle management")
        
        # General optimization recommendations
        recommendations.extend([
            " MONITORING: Implement real-time memory usage monitoring",
            " CLEANUP: Schedule periodic cache cleanup operations",
            " METRICS: Add detailed performance metrics collection",
            " OPTIMIZATION: Consider using memory-efficient data structures",
            "🔄 POOLING: Implement object pooling for frequently created objects"
        ])
        
        return recommendations
    
    def print_analysis_report(self, results: Dict[str, Any]):
        """Print comprehensive analysis report"""
        
        print("\n" + "="*80)
        print(" COST MANAGEMENT SERVICE - PERFORMANCE ANALYSIS REPORT")
        print("="*80)
        print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Performance Metrics Summary
        print(" PERFORMANCE METRICS SUMMARY")
        print("-"*50)
        metrics = results.get('performance_metrics', {})
        print(f"Total Memory Growth: {metrics.get('total_memory_growth_mb', 0):.2f} MB")
        print(f"Execution Time: {metrics.get('total_execution_time_seconds', 0):.2f} seconds")
        print(f"Memory Growth Rate: {metrics.get('memory_growth_rate_kb_per_sec', 0):.2f} KB/sec")
        print()
        
        # Test Scenarios Results
        for scenario in results.get('test_scenarios', []):
            print(f"🧪 {scenario['name'].upper()}")
            print("-"*50)
            
            if scenario['name'] == 'Token Estimation Performance':
                for result in scenario['results']:
                    print(f"{result['payload_size'].upper()} Payload:")
                    print(f"  Tokens: {result['estimated_tokens']}")
                    print(f"  Cost: ${result['estimated_cost']:.4f}")
                    print(f"  Processing Time: {result['processing_time_ms']:.2f}ms")
                    print(f"  Memory Used: {result['memory_used_bytes'] / 1024:.1f} KB")
            
            elif scenario['name'] == 'Usage Tracking Performance':
                total_operations = sum(r['tracking_operations'] for r in scenario['results'])
                avg_time = sum(r['processing_time_ms'] for r in scenario['results']) / len(scenario['results'])
                total_memory = sum(r['memory_used_bytes'] for r in scenario['results'])
                
                print(f"Total Operations: {total_operations}")
                print(f"Average Processing Time: {avg_time:.2f}ms")
                print(f"Total Memory Used: {total_memory / (1024*1024):.2f} MB")
            
            elif scenario['name'] == 'Memory Leak Detection':
                leak_indicators = scenario['results'].get('leak_indicators', [])
                if leak_indicators:
                    print(f" Memory Leak Indicators: {len(leak_indicators)}")
                    for indicator in leak_indicators[:3]:
                        print(f"  Iteration {indicator['iteration']}: {indicator['memory_growth_mb']:.2f}MB growth")
                else:
                    print(" No significant memory leaks detected")
            
            print()
        
        # Memory Analysis
        memory_analysis = results.get('memory_analysis', {})
        if memory_analysis.get('overall_analysis'):
            print(" MEMORY ANALYSIS")
            print("-"*50)
            overall = memory_analysis['overall_analysis']
            print(f"Peak Memory: {overall.get('peak_memory_mb', 0):.1f} MB")
            print(f"Average Memory: {overall.get('avg_memory_mb', 0):.1f} MB")
            print(f"Memory Growth: {overall.get('memory_growth_mb', 0):.1f} MB")
            
            if overall.get('issues'):
                print("\n Memory Issues:")
                for issue in overall['issues']:
                    print(f"  {issue}")
            print()
        
        # Top Memory Allocations
        if memory_analysis.get('top_memory_allocations'):
            print(" TOP MEMORY ALLOCATIONS")
            print("-"*50)
            for alloc in memory_analysis['top_memory_allocations'][:5]:
                if not alloc.get('error'):
                    print(f"{alloc.get('rank', 0)}. {alloc.get('size_mb', 0):.2f} MB - {alloc.get('filename', 'Unknown')}")
            print()
        
        # Optimization Recommendations
        recommendations = results.get('optimization_recommendations', [])
        if recommendations:
            print(" OPTIMIZATION RECOMMENDATIONS")
            print("-"*50)
            for i, rec in enumerate(recommendations[:10], 1):
                print(f"{i}. {rec}")
            print()
        
        print("="*80)

def main():
    """Run cost management performance analysis"""
    print(" Starting Cost Management Performance Analysis")
    
    analyzer = CostManagementAnalyzer()
    
    try:
        # Run comprehensive analysis
        results = analyzer.analyze_memory_patterns()
        
        # Print detailed report
        analyzer.print_analysis_report(results)
        
        # Save results to file
        timestamp = int(time.time())
        filename = f"cost_management_analysis_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f" Detailed analysis saved to: {filename}")
        
    except Exception as e:
        print(f" Analysis failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()