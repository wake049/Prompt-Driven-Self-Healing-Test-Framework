"""
Performance Testing Suite for Python Self-Healing Test Framework
Tests Memory, CPU, Database, and API performance under various loads
"""

import asyncio
import aiohttp
import time
import json
from typing import Dict, List, Any
import logging
from performance_profiler import PythonPerformanceProfiler, get_global_profiler
import psutil
import os
import sys

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PerformanceTestSuite:
    """Comprehensive performance testing for the unified API"""
    
    def __init__(self, base_url: str = "https://testhelix.com"):
        self.base_url = base_url
        self.profiler = get_global_profiler()
        self.test_results: Dict[str, Any] = {}
        
    async def run_all_tests(self):
        """Run comprehensive performance test suite"""
        
        # Start profiling
        self.profiler.capture_snapshot("Test_Suite_Start")
        self.profiler.start_continuous_monitoring(interval_seconds=1.0)
        
        try:
            # Test 1: API Endpoint Performance
            await self.test_api_endpoint_performance()
            
            # Test 2: Memory Usage Under Load
            await self.test_memory_usage_under_load()
            
            # Test 3: Database Performance
            await self.test_database_performance()
            
            # Test 4: Concurrent Request Handling
            await self.test_concurrent_requests()
            
            # Test 5: Memory Leak Detection
            await self.test_memory_leak_detection()
            
            # Test 6: CPU Performance Under Load
            await self.test_cpu_performance()
            
        finally:
            self.profiler.stop_continuous_monitoring()
            self.profiler.capture_snapshot("Test_Suite_End")
        
        # Generate comprehensive report
        await self.generate_performance_report()
    
    async def test_api_endpoint_performance(self):
        """Test API endpoint response times and throughput"""
        
        endpoints_to_test = [
            "/health",
            "/api/v1/policy/stats",
            "/api/v1/healing/alternatives",
            "/api/v1/ai/suggest-elements",
            "/api/v1/sql/elements"
        ]
        
        results = {}
        
        async with aiohttp.ClientSession() as session:
            for endpoint in endpoints_to_test:
                
                # Warm up
                await self._make_request(session, endpoint)
                
                # Performance test
                times = []
                for i in range(10):
                    start_time = time.time()
                    success = await self._make_request(session, endpoint)
                    end_time = time.time()
                    
                    if success:
                        times.append((end_time - start_time) * 1000)  # Convert to ms
                
                if times:
                    results[endpoint] = {
                        'avg_response_time_ms': sum(times) / len(times),
                        'min_response_time_ms': min(times),
                        'max_response_time_ms': max(times),
                        'successful_requests': len(times),
                        'total_requests': 10
                    }
                
                # Small delay between tests
                await asyncio.sleep(0.1)
        
        self.test_results['api_performance'] = results
    
    async def test_memory_usage_under_load(self):
        """Test memory usage patterns under sustained load"""
        
        initial_memory = psutil.Process().memory_info().rss
        self.profiler.capture_snapshot("Memory_Test_Start")
        
        # Generate sustained load
        async with aiohttp.ClientSession() as session:
            tasks = []
            
            # Create 50 concurrent requests
            for i in range(50):
                task = self._sustained_load_worker(session, f"worker_{i}")
                tasks.append(task)
            
            # Run for 30 seconds
            await asyncio.gather(*tasks)
        
        final_memory = psutil.Process().memory_info().rss
        self.profiler.capture_snapshot("Memory_Test_End")
        
        memory_increase = (final_memory - initial_memory) / (1024 * 1024)  # MB
        
        self.test_results['memory_load_test'] = {
            'initial_memory_mb': initial_memory / (1024 * 1024),
            'final_memory_mb': final_memory / (1024 * 1024),
            'memory_increase_mb': memory_increase,
            'test_duration_seconds': 30
        }
    
    async def test_database_performance(self):
        """Test database connection and query performance"""
        
        # Test database-heavy endpoints
        db_endpoints = [
            "/api/v1/sql/elements",
            "/api/v1/policy/policies",
            "/api/v1/execution/recent"
        ]
        
        db_results = {}
        
        async with aiohttp.ClientSession() as session:
            for endpoint in db_endpoints:
                start_time = time.time()
                
                # Make multiple requests to test connection pooling
                tasks = []
                for i in range(20):
                    task = self._make_request(session, endpoint)
                    tasks.append(task)
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                end_time = time.time()
                successful_requests = sum(1 for r in results if r is True)
                
                db_results[endpoint] = {
                    'total_time_seconds': end_time - start_time,
                    'successful_requests': successful_requests,
                    'total_requests': 20,
                    'avg_time_per_request_ms': ((end_time - start_time) / 20) * 1000
                }
        
        self.test_results['database_performance'] = db_results
    
    async def test_concurrent_requests(self):
        """Test system performance under high concurrency"""
        
        # Test different concurrency levels
        concurrency_levels = [10, 25, 50, 100]
        results = {}
        
        for concurrency in concurrency_levels:
            
            start_time = time.time()
            
            async with aiohttp.ClientSession() as session:
                tasks = []
                for i in range(concurrency):
                    task = self._make_request(session, "/health")
                    tasks.append(task)
                
                successful_results = await asyncio.gather(*tasks, return_exceptions=True)
                successful_count = sum(1 for r in successful_results if r is True)
            
            end_time = time.time()
            total_time = end_time - start_time
            
            results[f"concurrency_{concurrency}"] = {
                'successful_requests': successful_count,
                'total_requests': concurrency,
                'total_time_seconds': total_time,
                'requests_per_second': concurrency / total_time if total_time > 0 else 0,
                'success_rate': successful_count / concurrency
            }
            
            # Brief pause between tests
            await asyncio.sleep(1)
        
        self.test_results['concurrency_test'] = results
    
    async def test_memory_leak_detection(self):
        """Test for potential memory leaks during extended operation"""
        
        initial_memory = psutil.Process().memory_info().rss
        memory_samples = []
        
        # Run for 60 seconds, sampling memory every 5 seconds
        for i in range(12):
            self.profiler.capture_snapshot(f"Leak_Test_{i}")
            
            # Generate some load
            async with aiohttp.ClientSession() as session:
                tasks = []
                for j in range(10):
                    task = self._make_request(session, "/api/v1/policy/stats")
                    tasks.append(task)
                await asyncio.gather(*tasks, return_exceptions=True)
            
            current_memory = psutil.Process().memory_info().rss
            memory_samples.append(current_memory)
            
            await asyncio.sleep(5)
        
        # Analyze memory growth pattern
        if len(memory_samples) >= 2:
            # Calculate linear regression to detect memory growth trend
            x_values = list(range(len(memory_samples)))
            y_values = memory_samples
            
            n = len(memory_samples)
            sum_x = sum(x_values)
            sum_y = sum(y_values)
            sum_xy = sum(x * y for x, y in zip(x_values, y_values))
            sum_x2 = sum(x * x for x in x_values)
            
            # Linear regression slope (memory growth rate)
            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
            
            memory_growth_rate = slope / (1024 * 1024)  # MB per sample interval
            
            self.test_results['memory_leak_test'] = {
                'initial_memory_mb': initial_memory / (1024 * 1024),
                'final_memory_mb': memory_samples[-1] / (1024 * 1024),
                'memory_growth_rate_mb_per_interval': memory_growth_rate,
                'total_samples': len(memory_samples),
                'test_duration_minutes': 1,
                'potential_leak': memory_growth_rate > 1.0  # More than 1MB growth per interval
            }
    
    async def test_cpu_performance(self):
        """Test CPU performance under computational load"""
        
        # Start CPU profiling
        self.profiler.start_cpu_profiling()
        
        # Generate CPU-intensive requests
        async with aiohttp.ClientSession() as session:
            cpu_intensive_endpoints = [
                "/api/v1/ai/suggest-elements",
                "/api/v1/healing/alternatives",
                "/api/v1/selectors/generate"
            ]
            
            cpu_results = {}
            
            for endpoint in cpu_intensive_endpoints:
                start_time = time.time()
                cpu_start = psutil.Process().cpu_percent()
                
                # Make requests that require computation
                tasks = []
                for i in range(15):
                    task = self._make_request(session, endpoint, {
                        "selector": f"css=.test-element-{i}",
                        "page": "test-page"
                    })
                    tasks.append(task)
                
                await asyncio.gather(*tasks, return_exceptions=True)
                
                end_time = time.time()
                cpu_end = psutil.Process().cpu_percent()
                
                cpu_results[endpoint] = {
                    'execution_time_seconds': end_time - start_time,
                    'cpu_usage_start': cpu_start,
                    'cpu_usage_end': cpu_end,
                    'requests_processed': 15
                }
        
        # Stop CPU profiling
        cpu_profile_results = self.profiler.stop_cpu_profiling()
        
        self.test_results['cpu_performance'] = {
            'endpoint_results': cpu_results,
            'cpu_profiling': cpu_profile_results
        }
    
    async def _sustained_load_worker(self, session: aiohttp.ClientSession, worker_id: str):
        """Worker function for sustained load testing"""
        endpoints = ["/health", "/api/v1/policy/stats", "/api/v1/sql/elements"]
        
        end_time = time.time() + 30  # Run for 30 seconds
        
        while time.time() < end_time:
            for endpoint in endpoints:
                await self._make_request(session, endpoint)
                await asyncio.sleep(0.1)  # Small delay
    
    async def _make_request(self, session: aiohttp.ClientSession, endpoint: str, 
                          data: Dict = None) -> bool:
        """Make an HTTP request and return success status"""
        try:
            url = f"{self.base_url}{endpoint}"
            
            if data:
                async with session.post(url, json=data, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    return response.status < 400
            else:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    return response.status < 400
                    
        except Exception as e:
            return False
    
    async def generate_performance_report(self):
        """Generate comprehensive performance report"""
        
        # Get profiler report
        profiler_report = self.profiler.generate_comprehensive_report()
        
        # Force garbage collection for final analysis
        gc_analysis = self.profiler.force_garbage_collection()
        
        # Combine all results
        final_report = {
            'test_timestamp': time.time(),
            'test_results': self.test_results,
            'profiler_analysis': profiler_report,
            'garbage_collection': gc_analysis,
            'system_info': {
                'python_version': sys.version,
                'platform': sys.platform,
                'cpu_count': psutil.cpu_count(),
                'total_memory_gb': psutil.virtual_memory().total / (1024**3),
                'available_memory_gb': psutil.virtual_memory().available / (1024**3)
            }
        }
        
        # Save report to file
        report_filename = f"performance_report_{int(time.time())}.json"
        with open(report_filename, 'w') as f:
            json.dump(final_report, f, indent=2, default=str)
        
        # Print summary to console
        self.print_performance_summary(final_report)
        
        return final_report
    
    def print_performance_summary(self, report: Dict[str, Any]):
        """Print performance test summary to console"""
        print("\n" + "="*80)
        print("PYTHON PERFORMANCE TEST RESULTS")
        print("="*80)
        
        # System Info
        system_info = report['system_info']
        print(f"System: {system_info['platform']} | Python {system_info['python_version']}")
        print(f"Memory: {system_info['total_memory_gb']:.1f}GB total, {system_info['available_memory_gb']:.1f}GB available")
        print(f"CPU: {system_info['cpu_count']} cores")
        print()
        
        # API Performance Results
        if 'api_performance' in self.test_results:
            print("API ENDPOINT PERFORMANCE")
            print("-"*50)
            for endpoint, stats in self.test_results['api_performance'].items():
                print(f"{endpoint}:")
                print(f"  Average: {stats['avg_response_time_ms']:.1f}ms")
                print(f"  Min/Max: {stats['min_response_time_ms']:.1f}ms / {stats['max_response_time_ms']:.1f}ms")
                print(f"  Success Rate: {(stats['successful_requests']/stats['total_requests']*100):.1f}%")
            print()
        
        # Memory Performance
        if 'memory_load_test' in self.test_results:
            print("MEMORY PERFORMANCE")
            print("-"*50)
            mem_test = self.test_results['memory_load_test']
            print(f"Initial Memory: {mem_test['initial_memory_mb']:.1f}MB")
            print(f"Final Memory: {mem_test['final_memory_mb']:.1f}MB")
            print(f"Memory Increase: {mem_test['memory_increase_mb']:.1f}MB")
            print(f"Test Duration: {mem_test['test_duration_seconds']}s")
            print()
        
        # Concurrency Results
        if 'concurrency_test' in self.test_results:
            print("CONCURRENCY PERFORMANCE")
            print("-"*50)
            for level, stats in self.test_results['concurrency_test'].items():
                concurrency = level.split('_')[1]
                print(f"Concurrency {concurrency}:")
                print(f"  Requests/sec: {stats['requests_per_second']:.1f}")
                print(f"  Success Rate: {stats['success_rate']*100:.1f}%")
                print(f"  Total Time: {stats['total_time_seconds']:.2f}s")
            print()
        
        # Memory Leak Detection
        if 'memory_leak_test' in self.test_results:
            print("MEMORY LEAK ANALYSIS")
            print("-"*50)
            leak_test = self.test_results['memory_leak_test']
            print(f"Growth Rate: {leak_test['memory_growth_rate_mb_per_interval']:.2f}MB per interval")
            print(f"Potential Leak: {'WARNING YES' if leak_test['potential_leak'] else 'OK NO'}")
            print()
        
        # Profiler Analysis Summary
        profiler_analysis = report.get('profiler_analysis', {})
        if profiler_analysis.get('memory_analysis'):
            print("PROFILER ANALYSIS")
            print("-"*50)
            mem_analysis = profiler_analysis['memory_analysis']
            print(f"Peak Memory: {mem_analysis['peak_memory_mb']:.1f}MB")
            print(f"Memory Growth Rate: {mem_analysis['growth_rate_kb_per_sec']:.2f}KB/sec")
            
            if mem_analysis.get('issues'):
                print("Issues Detected:")
                for issue in mem_analysis['issues'][:3]:
                    print(f"  {issue}")
            print()
        
        # Recommendations
        if profiler_analysis.get('recommendations'):
            print("PERFORMANCE RECOMMENDATIONS")
            print("-"*50)
            for i, rec in enumerate(profiler_analysis['recommendations'][:5], 1):
                print(f"{i}. {rec}")
            print()
        
        print("="*80)

async def main():
    """Main function to run performance tests"""
    print("Starting Python Performance Testing Suite")
    print("This will test Memory, CPU, Database, and API performance")
    print()
    
    # Check if unified API is running
    test_suite = PerformanceTestSuite()
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{test_suite.base_url}/health") as response:
                if response.status != 200:
                    raise Exception("Health check failed")
    except Exception as e:
        print(f"Cannot connect to unified API at {test_suite.base_url}")
        print("Please ensure the unified API server is running:")
        print("  cd services/unified-api")
        print("  python main.py")
        return
    
    print("Connected to unified API server")
    print()
    
    # Run all performance tests
    await test_suite.run_all_tests()
    
    print("Performance testing completed!")

if __name__ == "__main__":
    asyncio.run(main())