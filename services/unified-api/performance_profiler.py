"""
Comprehensive Performance Profiler for Python Self-Healing Test Framework
Monitors Memory, CPU, Database, and API performance metrics
"""

import asyncio
import time
import psutil
import gc
import sys
import tracemalloc
import cProfile
import pstats
import io
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict
import json
import logging
from contextlib import asynccontextmanager
import threading
import functools

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class PerformanceSnapshot:
    """Snapshot of system performance at a specific moment"""
    timestamp: float
    label: str
    cpu_percent: float
    memory_usage: Dict[str, int]
    memory_info: Dict[str, int]
    thread_count: int
    gc_stats: Dict[str, Any]
    db_connections: int = 0
    request_count: int = 0
    cache_stats: Dict[str, Any] = field(default_factory=dict)

@dataclass
class EndpointPerformance:
    """Performance metrics for a specific API endpoint"""
    endpoint: str
    total_requests: int = 0
    total_time: float = 0.0
    min_time: float = float('inf')
    max_time: float = 0.0
    error_count: int = 0
    memory_peak: int = 0
    
    @property
    def avg_time(self) -> float:
        return self.total_time / self.total_requests if self.total_requests > 0 else 0.0

@dataclass
class DatabasePerformance:
    """Database-specific performance metrics"""
    query_count: int = 0
    total_query_time: float = 0.0
    connection_pool_size: int = 0
    active_connections: int = 0
    slow_queries: List[Dict[str, Any]] = field(default_factory=list)
    
    @property
    def avg_query_time(self) -> float:
        return self.total_query_time / self.query_count if self.query_count > 0 else 0.0

class PythonPerformanceProfiler:
    """
    Comprehensive performance profiler for Python applications
    Focuses on Memory usage, CPU, Database, and API performance
    """
    
    def __init__(self, enable_tracemalloc: bool = True):
        self.start_time = time.time()
        self.snapshots: List[PerformanceSnapshot] = []
        self.endpoint_stats: Dict[str, EndpointPerformance] = defaultdict(EndpointPerformance)
        self.db_stats = DatabasePerformance()
        self.enable_tracemalloc = enable_tracemalloc
        self.monitoring_active = False
        self.monitor_thread: Optional[threading.Thread] = None
        self.profiler: Optional[cProfile.Profile] = None
        
        # Initialize tracemalloc if enabled
        if self.enable_tracemalloc and not tracemalloc.is_tracing():
            tracemalloc.start()
            logger.info(" Started tracemalloc for detailed memory tracking")
        
        # Get process for monitoring
        self.process = psutil.Process()
        
        logger.info(" Python Performance Profiler initialized")
        logger.info(f"Python Version: {sys.version}")
        logger.info(f"CPU Count: {psutil.cpu_count()}")
        logger.info(f"Total Memory: {psutil.virtual_memory().total / (1024**3):.2f} GB")
    
    def capture_snapshot(self, label: str = "") -> PerformanceSnapshot:
        """Capture a performance snapshot at the current moment"""
        try:
            # CPU usage
            cpu_percent = self.process.cpu_percent()
            
            # Memory usage
            memory_info = self.process.memory_info()
            memory_usage = {
                'rss': memory_info.rss,  # Resident Set Size
                'vms': memory_info.vms,  # Virtual Memory Size
            }
            
            # System memory
            sys_memory = psutil.virtual_memory()
            memory_details = {
                'total': sys_memory.total,
                'available': sys_memory.available,
                'percent': sys_memory.percent,
                'used': sys_memory.used
            }
            
            # Thread count
            thread_count = self.process.num_threads()
            
            # Garbage collection stats
            gc_stats = {
                'generation_0': gc.get_count()[0],
                'generation_1': gc.get_count()[1],
                'generation_2': gc.get_count()[2],
                'total_collections': sum(gc.get_stats()[i]['collections'] for i in range(3)),
                'total_collected': sum(gc.get_stats()[i]['collected'] for i in range(3)),
                'total_uncollectable': sum(gc.get_stats()[i]['uncollectable'] for i in range(3))
            }
            
            snapshot = PerformanceSnapshot(
                timestamp=time.time(),
                label=label,
                cpu_percent=cpu_percent,
                memory_usage=memory_usage,
                memory_info=memory_details,
                thread_count=thread_count,
                gc_stats=gc_stats
            )
            
            self.snapshots.append(snapshot)
            
            # Log key metrics
            memory_mb = memory_info.rss / (1024 * 1024)
            logger.info(f" [{label}] Memory: {memory_mb:.1f}MB, CPU: {cpu_percent:.1f}%, Threads: {thread_count}")
            
            return snapshot
            
        except Exception as e:
            logger.error(f"Error capturing performance snapshot: {e}")
            return None
    
    def start_continuous_monitoring(self, interval_seconds: float = 5.0):
        """Start continuous performance monitoring in background thread"""
        if self.monitoring_active:
            logger.warning("Monitoring already active")
            return
        
        self.monitoring_active = True
        
        def monitor_loop():
            counter = 0
            while self.monitoring_active:
                try:
                    counter += 1
                    self.capture_snapshot(f"Auto_Monitor_{counter}")
                    time.sleep(interval_seconds)
                except Exception as e:
                    logger.error(f"Error in monitoring loop: {e}")
        
        self.monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self.monitor_thread.start()
        logger.info(f"🔄 Started continuous monitoring (interval: {interval_seconds}s)")
    
    def stop_continuous_monitoring(self):
        """Stop continuous performance monitoring"""
        self.monitoring_active = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1.0)
        logger.info("⏹️ Stopped continuous monitoring")
    
    def track_endpoint_performance(self, endpoint: str, execution_time: float, 
                                 error_occurred: bool = False, memory_used: int = 0):
        """Track performance metrics for an API endpoint"""
        if endpoint not in self.endpoint_stats:
            self.endpoint_stats[endpoint] = EndpointPerformance(endpoint=endpoint)
        
        stats = self.endpoint_stats[endpoint]
        stats.total_requests += 1
        stats.total_time += execution_time
        stats.min_time = min(stats.min_time, execution_time)
        stats.max_time = max(stats.max_time, execution_time)
        
        if error_occurred:
            stats.error_count += 1
        
        if memory_used > stats.memory_peak:
            stats.memory_peak = memory_used
    
    def track_database_query(self, query_time: float, query: str = "", slow_threshold: float = 1.0):
        """Track database query performance"""
        self.db_stats.query_count += 1
        self.db_stats.total_query_time += query_time
        
        # Track slow queries
        if query_time > slow_threshold:
            self.db_stats.slow_queries.append({
                'query': query[:200],  # Truncate long queries
                'execution_time': query_time,
                'timestamp': datetime.now().isoformat()
            })
    
    def analyze_memory_usage(self) -> Dict[str, Any]:
        """Analyze memory usage patterns and detect potential issues"""
        if not self.snapshots:
            return {"error": "No snapshots available"}
        
        # Memory growth analysis
        first_snapshot = self.snapshots[0]
        last_snapshot = self.snapshots[-1]
        
        memory_growth = last_snapshot.memory_usage['rss'] - first_snapshot.memory_usage['rss']
        time_elapsed = last_snapshot.timestamp - first_snapshot.timestamp
        
        growth_rate = memory_growth / time_elapsed if time_elapsed > 0 else 0  # bytes per second
        
        # Peak memory usage
        peak_memory = max(s.memory_usage['rss'] for s in self.snapshots)
        avg_memory = sum(s.memory_usage['rss'] for s in self.snapshots) / len(self.snapshots)
        
        # Memory efficiency analysis
        analysis = {
            'total_snapshots': len(self.snapshots),
            'peak_memory_mb': peak_memory / (1024 * 1024),
            'avg_memory_mb': avg_memory / (1024 * 1024),
            'memory_growth_mb': memory_growth / (1024 * 1024),
            'growth_rate_kb_per_sec': growth_rate / 1024,
            'time_elapsed_seconds': time_elapsed,
        }
        
        # Detect potential memory issues
        issues = []
        
        # Memory leak detection
        if growth_rate > 100 * 1024:  # More than 100KB/sec growth
            issues.append(f"🚨 POTENTIAL MEMORY LEAK: Growing at {growth_rate/1024:.2f} KB/sec")
        
        # High memory usage
        if peak_memory > 500 * 1024 * 1024:  # More than 500MB
            issues.append(f" HIGH MEMORY USAGE: Peak {peak_memory/(1024*1024):.1f} MB")
        
        # Excessive GC activity
        if self.snapshots:
            gc_collections = last_snapshot.gc_stats['total_collections'] - first_snapshot.gc_stats['total_collections']
            if gc_collections > len(self.snapshots) * 2:  # More than 2 GC per snapshot
                issues.append(f" HIGH GC ACTIVITY: {gc_collections} collections")
        
        analysis['issues'] = issues
        
        return analysis
    
    def get_top_memory_allocations(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top memory allocations using tracemalloc"""
        if not tracemalloc.is_tracing():
            return [{"error": "tracemalloc not enabled"}]
        
        try:
            snapshot = tracemalloc.take_snapshot()
            top_stats = snapshot.statistics('lineno')
            
            allocations = []
            for index, stat in enumerate(top_stats[:limit], 1):
                allocations.append({
                    'rank': index,
                    'size_mb': stat.size / (1024 * 1024),
                    'count': stat.count,
                    'filename': stat.traceback.format()[0] if stat.traceback.format() else 'Unknown',
                    'line': str(stat.traceback) if stat.traceback else 'Unknown'
                })
            
            return allocations
        except Exception as e:
            return [{"error": f"Failed to get memory allocations: {e}"}]
    
    def start_cpu_profiling(self):
        """Start CPU profiling"""
        if self.profiler is not None:
            logger.warning("CPU profiling already active")
            return
        
        self.profiler = cProfile.Profile()
        self.profiler.enable()
        logger.info("🔄 Started CPU profiling")
    
    def stop_cpu_profiling(self) -> Dict[str, Any]:
        """Stop CPU profiling and return results"""
        if self.profiler is None:
            return {"error": "CPU profiling not active"}
        
        self.profiler.disable()
        
        # Capture profiling results
        s = io.StringIO()
        stats = pstats.Stats(self.profiler, stream=s)
        stats.sort_stats('cumulative')
        stats.print_stats(20)  # Top 20 functions
        
        profiling_output = s.getvalue()
        self.profiler = None
        
        logger.info("⏹️ Stopped CPU profiling")
        
        return {
            "profiling_output": profiling_output,
            "summary": "CPU profiling completed - check profiling_output for detailed results"
        }
    
    def force_garbage_collection(self) -> Dict[str, Any]:
        """Force garbage collection and measure impact"""
        logger.info("🗑️ Forcing garbage collection...")
        
        # Capture before GC
        before_snapshot = self.capture_snapshot("Before_GC")
        gc_start = time.time()
        
        # Force all generations of GC
        collected_objects = []
        for generation in range(3):
            collected = gc.collect(generation)
            collected_objects.append(collected)
        
        gc_duration = time.time() - gc_start
        after_snapshot = self.capture_snapshot("After_GC")
        
        if before_snapshot and after_snapshot:
            memory_freed = before_snapshot.memory_usage['rss'] - after_snapshot.memory_usage['rss']
            memory_freed_mb = memory_freed / (1024 * 1024)
            
            result = {
                'gc_duration_ms': gc_duration * 1000,
                'memory_freed_mb': memory_freed_mb,
                'objects_collected': {
                    'generation_0': collected_objects[0],
                    'generation_1': collected_objects[1],
                    'generation_2': collected_objects[2],
                    'total': sum(collected_objects)
                },
                'memory_before_mb': before_snapshot.memory_usage['rss'] / (1024 * 1024),
                'memory_after_mb': after_snapshot.memory_usage['rss'] / (1024 * 1024)
            }
            
            logger.info(f"🗑️ GC freed {memory_freed_mb:.2f} MB in {gc_duration*1000:.1f} ms")
            return result
        
        return {"error": "Failed to capture GC snapshots"}
    
    def generate_comprehensive_report(self) -> Dict[str, Any]:
        """Generate a comprehensive performance report"""
        total_runtime = time.time() - self.start_time
        
        report = {
            'report_generated': datetime.now().isoformat(),
            'total_runtime_seconds': total_runtime,
            'python_version': sys.version,
            'system_info': {
                'platform': sys.platform,
                'cpu_count': psutil.cpu_count(),
                'total_memory_gb': psutil.virtual_memory().total / (1024**3)
            },
            'performance_summary': {},
            'memory_analysis': {},
            'endpoint_performance': {},
            'database_performance': {},
            'recommendations': []
        }
        
        # Memory analysis
        if self.snapshots:
            report['memory_analysis'] = self.analyze_memory_usage()
            report['memory_allocations'] = self.get_top_memory_allocations()
        
        # Performance summary
        if self.snapshots:
            avg_cpu = sum(s.cpu_percent for s in self.snapshots) / len(self.snapshots)
            peak_cpu = max(s.cpu_percent for s in self.snapshots)
            avg_threads = sum(s.thread_count for s in self.snapshots) / len(self.snapshots)
            
            report['performance_summary'] = {
                'avg_cpu_percent': avg_cpu,
                'peak_cpu_percent': peak_cpu,
                'avg_thread_count': avg_threads,
                'total_snapshots': len(self.snapshots)
            }
        
        # Endpoint performance
        if self.endpoint_stats:
            endpoint_summary = {}
            for endpoint, stats in self.endpoint_stats.items():
                endpoint_summary[endpoint] = {
                    'total_requests': stats.total_requests,
                    'avg_response_time_ms': stats.avg_time * 1000,
                    'min_response_time_ms': stats.min_time * 1000,
                    'max_response_time_ms': stats.max_time * 1000,
                    'error_rate': stats.error_count / stats.total_requests if stats.total_requests > 0 else 0,
                    'peak_memory_mb': stats.memory_peak / (1024 * 1024)
                }
            report['endpoint_performance'] = endpoint_summary
        
        # Database performance
        if self.db_stats.query_count > 0:
            report['database_performance'] = {
                'total_queries': self.db_stats.query_count,
                'avg_query_time_ms': self.db_stats.avg_query_time * 1000,
                'slow_queries_count': len(self.db_stats.slow_queries),
                'slow_queries': self.db_stats.slow_queries[:5]  # Top 5 slow queries
            }
        
        # Generate recommendations
        recommendations = self._generate_recommendations(report)
        report['recommendations'] = recommendations
        
        return report
    
    def _generate_recommendations(self, report: Dict[str, Any]) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []
        
        # Memory recommendations
        memory_analysis = report.get('memory_analysis', {})
        if memory_analysis.get('peak_memory_mb', 0) > 500:
            recommendations.append("Consider memory optimization - peak usage exceeds 500MB")
        
        if memory_analysis.get('growth_rate_kb_per_sec', 0) > 50:
            recommendations.append("Monitor for memory leaks - high memory growth rate detected")
        
        # CPU recommendations
        performance_summary = report.get('performance_summary', {})
        if performance_summary.get('peak_cpu_percent', 0) > 80:
            recommendations.append("High CPU usage detected - consider code optimization or scaling")
        
        # Database recommendations
        db_performance = report.get('database_performance', {})
        if db_performance.get('avg_query_time_ms', 0) > 100:
            recommendations.append("Database queries are slow - consider indexing or query optimization")
        
        if db_performance.get('slow_queries_count', 0) > 0:
            recommendations.append("Slow queries detected - review and optimize database operations")
        
        # Endpoint recommendations
        endpoint_performance = report.get('endpoint_performance', {})
        for endpoint, stats in endpoint_performance.items():
            if stats.get('avg_response_time_ms', 0) > 1000:
                recommendations.append(f"Endpoint {endpoint} has high response time - consider optimization")
            
            if stats.get('error_rate', 0) > 0.05:  # More than 5% error rate
                recommendations.append(f"Endpoint {endpoint} has high error rate - investigate failures")
        
        # General recommendations
        recommendations.extend([
            "Enable response caching for frequently accessed endpoints",
            "Use connection pooling for database operations",
            "Consider implementing request rate limiting",
            "Monitor garbage collection frequency and optimize if needed",
            "Use async/await patterns for I/O operations"
        ])
        
        return recommendations
    
    def print_detailed_report(self):
        """Print a detailed performance report to console"""
        report = self.generate_comprehensive_report()
        
        print("\n" + "="*80)
        print(" PYTHON PERFORMANCE PROFILER REPORT")
        print("="*80)
        print(f"Generated: {report['report_generated']}")
        print(f"Total Runtime: {report['total_runtime_seconds']:.2f} seconds")
        print()
        
        # System Info
        print("SYSTEM INFORMATION")
        print("-"*40)
        system_info = report['system_info']
        print(f"Platform: {system_info['platform']}")
        print(f"Python Version: {report['python_version']}")
        print(f"CPU Cores: {system_info['cpu_count']}")
        print(f"Total Memory: {system_info['total_memory_gb']:.2f} GB")
        print()
        
        # Performance Summary
        if report['performance_summary']:
            print(" PERFORMANCE SUMMARY")
            print("-"*40)
            perf = report['performance_summary']
            print(f"Average CPU Usage: {perf['avg_cpu_percent']:.1f}%")
            print(f"Peak CPU Usage: {perf['peak_cpu_percent']:.1f}%")
            print(f"Average Threads: {perf['avg_thread_count']:.1f}")
            print(f"Performance Snapshots: {perf['total_snapshots']}")
            print()
        
        # Memory Analysis
        if report['memory_analysis']:
            print(" MEMORY ANALYSIS")
            print("-"*40)
            mem = report['memory_analysis']
            print(f"Peak Memory Usage: {mem['peak_memory_mb']:.1f} MB")
            print(f"Average Memory Usage: {mem['avg_memory_mb']:.1f} MB")
            print(f"Memory Growth: {mem['memory_growth_mb']:.1f} MB")
            print(f"Growth Rate: {mem['growth_rate_kb_per_sec']:.2f} KB/sec")
            
            if mem.get('issues'):
                print("\n Memory Issues Detected:")
                for issue in mem['issues']:
                    print(f"  {issue}")
            print()
        
        # Top Memory Allocations
        if report.get('memory_allocations') and not report['memory_allocations'][0].get('error'):
            print(" TOP MEMORY ALLOCATIONS")
            print("-"*40)
            for alloc in report['memory_allocations'][:5]:
                print(f"{alloc['rank']}. {alloc['size_mb']:.2f} MB - {alloc['filename']}")
            print()
        
        # Database Performance
        if report['database_performance']:
            print(" DATABASE PERFORMANCE")
            print("-"*40)
            db = report['database_performance']
            print(f"Total Queries: {db['total_queries']}")
            print(f"Average Query Time: {db['avg_query_time_ms']:.2f} ms")
            print(f"Slow Queries: {db['slow_queries_count']}")
            print()
        
        # Endpoint Performance
        if report['endpoint_performance']:
            print(" API ENDPOINT PERFORMANCE")
            print("-"*40)
            for endpoint, stats in report['endpoint_performance'].items():
                print(f"{endpoint}:")
                print(f"  Requests: {stats['total_requests']}")
                print(f"  Avg Response: {stats['avg_response_time_ms']:.2f} ms")
                print(f"  Error Rate: {stats['error_rate']*100:.1f}%")
            print()
        
        # Recommendations
        if report['recommendations']:
            print(" PERFORMANCE RECOMMENDATIONS")
            print("-"*40)
            for i, rec in enumerate(report['recommendations'][:10], 1):
                print(f"{i}. {rec}")
            print()
        
        print("="*80)

# Decorator for automatic endpoint performance tracking
def track_performance(profiler: PythonPerformanceProfiler):
    """Decorator to automatically track endpoint performance"""
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss
            error_occurred = False
            
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                error_occurred = True
                raise
            finally:
                end_time = time.time()
                end_memory = psutil.Process().memory_info().rss
                execution_time = end_time - start_time
                memory_used = end_memory - start_memory
                
                endpoint_name = func.__name__
                profiler.track_endpoint_performance(
                    endpoint_name, execution_time, error_occurred, memory_used
                )
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            start_memory = psutil.Process().memory_info().rss
            error_occurred = False
            
            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                error_occurred = True
                raise
            finally:
                end_time = time.time()
                end_memory = psutil.Process().memory_info().rss
                execution_time = end_time - start_time
                memory_used = end_memory - start_memory
                
                endpoint_name = func.__name__
                profiler.track_endpoint_performance(
                    endpoint_name, execution_time, error_occurred, memory_used
                )
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator

# Global profiler instance
global_profiler = None

def get_global_profiler() -> PythonPerformanceProfiler:
    """Get or create the global profiler instance"""
    global global_profiler
    if global_profiler is None:
        global_profiler = PythonPerformanceProfiler()
    return global_profiler

if __name__ == "__main__":
    # Example usage
    profiler = PythonPerformanceProfiler()
    
    # Capture initial snapshot
    profiler.capture_snapshot("Application_Start")
    
    # Start continuous monitoring
    profiler.start_continuous_monitoring(interval_seconds=2.0)
    
    # Simulate some work
    time.sleep(5)
    
    # Capture snapshot after work
    profiler.capture_snapshot("After_Work")
    
    # Stop monitoring
    profiler.stop_continuous_monitoring()
    
    # Generate and print report
    profiler.print_detailed_report()