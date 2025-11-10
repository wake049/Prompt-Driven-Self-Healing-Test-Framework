"""
Analytics Performance Cache
Enhanced caching layer for analytics APIs with TTL and intelligent invalidation
"""
import time
import json
import hashlib
from typing import Any, Dict, Optional, List
from datetime import datetime, timedelta
from fastapi import HTTPException
import asyncio
from dataclasses import dataclass, asdict

@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    key: str
    value: Any
    timestamp: float
    ttl: int  # Time to live in seconds
    hit_count: int = 0
    last_access: float = 0.0
    size_bytes: int = 0

    def __post_init__(self):
        self.last_access = self.timestamp
        if isinstance(self.value, (dict, list)):
            self.size_bytes = len(json.dumps(self.value, default=str))
        else:
            self.size_bytes = len(str(self.value))

    def is_expired(self) -> bool:
        """Check if cache entry is expired"""
        return time.time() - self.timestamp > self.ttl

    def access(self):
        """Record cache access"""
        self.hit_count += 1
        self.last_access = time.time()

class AnalyticsCache:
    """
    High-performance analytics cache with intelligent eviction and optimization
    """
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'total_requests': 0,
            'cache_size': 0,
            'memory_usage_bytes': 0
        }
        
        # Performance-based TTL configurations
        self.ttl_config = {
            'performance_metrics': 180,      # 3 minutes - changes frequently
            'failure_analysis': 300,        # 5 minutes - moderately dynamic
            'execution_trends': 600,        # 10 minutes - less dynamic
            'review_queue': 60,             # 1 minute - very dynamic
            'analytics_summary': 900,       # 15 minutes - stable aggregates
            'dashboard_stats': 120          # 2 minutes - frequently accessed
        }

    def _generate_cache_key(self, endpoint: str, params: Dict[str, Any]) -> str:
        """Generate deterministic cache key from endpoint and parameters"""
        # Sort parameters for consistent key generation
        sorted_params = sorted(params.items())
        param_string = json.dumps(sorted_params, default=str, sort_keys=True)
        
        # Create hash to handle long parameter strings
        param_hash = hashlib.md5(param_string.encode()).hexdigest()
        return f"{endpoint}:{param_hash}"

    def _get_ttl(self, endpoint: str) -> int:
        """Get appropriate TTL based on endpoint type"""
        for key, ttl in self.ttl_config.items():
            if key in endpoint:
                return ttl
        return self.default_ttl

    def _evict_expired(self):
        """Remove expired entries"""
        current_time = time.time()
        expired_keys = [
            key for key, entry in self.cache.items() 
            if current_time - entry.timestamp > entry.ttl
        ]
        
        for key in expired_keys:
            del self.cache[key]
            self.stats['evictions'] += 1

    def _evict_lru(self):
        """Evict least recently used entries when cache is full"""
        if len(self.cache) >= self.max_size:
            # Sort by last access time (oldest first)
            lru_entries = sorted(
                self.cache.items(), 
                key=lambda x: x[1].last_access
            )
            
            # Remove oldest 20% of entries
            num_to_remove = max(1, len(lru_entries) // 5)
            for i in range(num_to_remove):
                key = lru_entries[i][0]
                del self.cache[key]
                self.stats['evictions'] += 1

    def _update_stats(self):
        """Update cache statistics"""
        self.stats['cache_size'] = len(self.cache)
        self.stats['memory_usage_bytes'] = sum(
            entry.size_bytes for entry in self.cache.values()
        )

    async def get(self, endpoint: str, params: Dict[str, Any]) -> Optional[Any]:
        """Get cached value for endpoint with parameters"""
        self.stats['total_requests'] += 1
        
        cache_key = self._generate_cache_key(endpoint, params)
        
        # Clean expired entries periodically
        if self.stats['total_requests'] % 100 == 0:
            self._evict_expired()
        
        entry = self.cache.get(cache_key)
        
        if entry is None:
            self.stats['misses'] += 1
            return None
        
        if entry.is_expired():
            del self.cache[cache_key]
            self.stats['misses'] += 1
            self.stats['evictions'] += 1
            return None
        
        # Cache hit
        entry.access()
        self.stats['hits'] += 1
        return entry.value

    async def set(self, endpoint: str, params: Dict[str, Any], value: Any) -> None:
        """Cache value for endpoint with parameters"""
        cache_key = self._generate_cache_key(endpoint, params)
        ttl = self._get_ttl(endpoint)
        
        # Evict LRU entries if cache is full
        self._evict_lru()
        
        # Create cache entry
        entry = CacheEntry(
            key=cache_key,
            value=value,
            timestamp=time.time(),
            ttl=ttl
        )
        
        self.cache[cache_key] = entry
        self._update_stats()

    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern"""
        invalidated = 0
        keys_to_delete = [
            key for key in self.cache.keys() 
            if pattern in key
        ]
        
        for key in keys_to_delete:
            del self.cache[key]
            invalidated += 1
            self.stats['evictions'] += 1
        
        self._update_stats()
        return invalidated

    async def clear(self) -> None:
        """Clear all cache entries"""
        cleared_count = len(self.cache)
        self.cache.clear()
        self.stats['evictions'] += cleared_count
        self._update_stats()
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics"""
        self._update_stats()
        
        hit_rate = (
            self.stats['hits'] / self.stats['total_requests'] 
            if self.stats['total_requests'] > 0 else 0
        )
        
        # Top accessed entries
        top_entries = sorted(
            [(key, entry.hit_count, entry.size_bytes) for key, entry in self.cache.items()],
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        return {
            'cache_size': self.stats['cache_size'],
            'max_size': self.max_size,
            'memory_usage_bytes': self.stats['memory_usage_bytes'],
            'memory_usage_mb': round(self.stats['memory_usage_bytes'] / 1024 / 1024, 2),
            'hit_rate': round(hit_rate * 100, 2),
            'total_hits': self.stats['hits'],
            'total_misses': self.stats['misses'],
            'total_requests': self.stats['total_requests'],
            'total_evictions': self.stats['evictions'],
            'ttl_configurations': self.ttl_config,
            'top_accessed_entries': [
                {
                    'key_prefix': key[:32] + '...' if len(key) > 32 else key,
                    'hit_count': hits,
                    'size_bytes': size
                }
                for key, hits, size in top_entries
            ]
        }

# Global cache instance
analytics_cache = AnalyticsCache(max_size=2000, default_ttl=300)

def cache_analytics_response(endpoint_name: str):
    """Decorator for caching analytics API responses"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Extract parameters for cache key
            import inspect
            sig = inspect.signature(func)
            bound_args = sig.bind(*args, **kwargs)
            bound_args.apply_defaults()
            
            # Convert to dictionary for cache key
            params = dict(bound_args.arguments)
            
            # Try to get from cache
            cached_result = await analytics_cache.get(endpoint_name, params)
            if cached_result is not None:
                return cached_result
            
            # Cache miss - execute function
            start_time = time.time()
            result = await func(*args, **kwargs)
            execution_time = time.time() - start_time
            
            # Cache the result
            await analytics_cache.set(endpoint_name, params, result)
            
            return result
        return wrapper
    return decorator

async def warm_analytics_cache():
    """Pre-warm cache with common analytics queries"""
    common_queries = [
        ('performance_metrics', {'days': 7}),
        ('performance_metrics', {'days': 30}),
        ('failure_analysis', {'days': 7, 'limit': 10}),
        ('failure_analysis', {'days': 30, 'limit': 10}),
        ('execution_trends', {'days': 7}),
        ('review_queue', {'status': 'open', 'limit': 50})
    ]
    
async def get_cache_performance_report() -> Dict[str, Any]:
    """Generate comprehensive cache performance report"""
    stats = analytics_cache.get_cache_stats()
    
    # Calculate performance insights
    insights = []
    
    if stats['hit_rate'] > 80:
        insights.append("🟢 Excellent cache hit rate - optimal performance")
    elif stats['hit_rate'] > 60:
        insights.append("🟡 Good cache hit rate - consider optimizing TTL")
    else:
        insights.append("🔴 Low cache hit rate - review caching strategy")
    
    if stats['memory_usage_mb'] > 100:
        insights.append("⚠️ High memory usage - consider reducing cache size")
    
    if stats['cache_size'] / stats['max_size'] > 0.8:
        insights.append("⚠️ Cache near capacity - consider increasing max size")
    
    return {
        'cache_statistics': stats,
        'performance_insights': insights,
        'recommendations': [
            "Monitor cache hit rates regularly",
            "Adjust TTL based on data volatility",
            "Consider cache warming for common queries",
            "Implement cache invalidation on data updates"
        ],
        'generated_at': datetime.now().isoformat()
    }