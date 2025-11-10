"""
Simple LRU cache with TTL for MCP server

Provides caching utilities for performance optimization.
"""

import time
from typing import Any, Dict, Optional
from collections import OrderedDict
import threading

class LRUCacheWithTTL:
    """LRU cache with time-to-live (TTL) support"""
    
    def __init__(self, max_size: int = 1000, ttl_seconds: float = 60.0):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache = OrderedDict()
        self._timestamps = {}
        self._lock = threading.RLock()
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        with self._lock:
            if key not in self._cache:
                return None
            
            # Check if expired
            if self._is_expired(key):
                self._remove(key)
                return None
            
            # Move to end (most recently used)
            self._cache.move_to_end(key)
            return self._cache[key]
    
    def put(self, key: str, value: Any) -> None:
        """Put value in cache"""
        with self._lock:
            current_time = time.time()
            
            if key in self._cache:
                # Update existing
                self._cache[key] = value
                self._timestamps[key] = current_time
                self._cache.move_to_end(key)
            else:
                # Add new
                self._cache[key] = value
                self._timestamps[key] = current_time
                
                # Evict if over capacity
                if len(self._cache) > self.max_size:
                    oldest_key = next(iter(self._cache))
                    self._remove(oldest_key)
    
    def _is_expired(self, key: str) -> bool:
        """Check if cache entry is expired"""
        timestamp = self._timestamps.get(key)
        if timestamp is None:
            return True
        return (time.time() - timestamp) > self.ttl_seconds
    
    def _remove(self, key: str) -> None:
        """Remove key from cache"""
        self._cache.pop(key, None)
        self._timestamps.pop(key, None)
    
    def clear(self) -> None:
        """Clear all cache entries"""
        with self._lock:
            self._cache.clear()
            self._timestamps.clear()
    
    def size(self) -> int:
        """Get current cache size"""
        with self._lock:
            return len(self._cache)
    
    def cleanup_expired(self) -> int:
        """Remove expired entries and return count removed"""
        with self._lock:
            expired_keys = []
            for key in list(self._cache.keys()):
                if self._is_expired(key):
                    expired_keys.append(key)
            
            for key in expired_keys:
                self._remove(key)
            
            return len(expired_keys)

# Global cache instances
_element_cache = LRUCacheWithTTL(max_size=1000, ttl_seconds=60.0)
_resource_cache = LRUCacheWithTTL(max_size=500, ttl_seconds=60.0)
_session_cache = LRUCacheWithTTL(max_size=200, ttl_seconds=30.0)

def get_element_cache() -> LRUCacheWithTTL:
    """Get the global element cache"""
    return _element_cache

def get_resource_cache() -> LRUCacheWithTTL:
    """Get the global resource cache"""
    return _resource_cache

def get_session_cache() -> LRUCacheWithTTL:
    """Get the global session cache"""
    return _session_cache

def cache_key(prefix: str, *args: str) -> str:
    """Generate cache key from prefix and arguments"""
    return f"{prefix}:{':'.join(str(arg) for arg in args)}"

def cached_call(cache: LRUCacheWithTTL, key: str, func, *args, **kwargs):
    """
    Execute function with caching.
    
    Args:
        cache: Cache instance to use
        key: Cache key
        func: Function to call if not cached
        *args, **kwargs: Arguments for function
        
    Returns:
        Cached or fresh function result
    """
    # Try cache first
    result = cache.get(key)
    if result is not None:
        return result
    
    # Call function and cache result
    result = func(*args, **kwargs)
    cache.put(key, result)
    return result

async def async_cached_call(cache: LRUCacheWithTTL, key: str, func, *args, **kwargs):
    """
    Execute async function with caching.
    
    Args:
        cache: Cache instance to use
        key: Cache key
        func: Async function to call if not cached
        *args, **kwargs: Arguments for function
        
    Returns:
        Cached or fresh function result
    """
    # Try cache first
    result = cache.get(key)
    if result is not None:
        return result
    
    # Call async function and cache result
    result = await func(*args, **kwargs)
    cache.put(key, result)
    return result