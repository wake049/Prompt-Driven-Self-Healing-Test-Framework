"""
 Enterprise Caching Service
Implements ETag-based caching for ActionCatalog with If-None-Match header support.

Features:
- ETag generation and validation
- 304 Not Modified responses
- Versioned catalog caching
- Tenant-aware cache separation
- Compression support
- Cache statistics and monitoring
"""

from __future__ import annotations

import gzip
import hashlib
import json

import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from schemas.enterprise import ActionCatalog, CacheEntry, TenantConfig

class CacheService:
    """Enterprise caching service with ETag support and compression"""
    
    def __init__(self):
        self.catalog_cache: Dict[str, CacheEntry] = {}
        self.response_cache: Dict[str, CacheEntry] = {}
        self.etag_index: Dict[str, str] = {}  # etag -> cache_key mapping
        self.default_ttl = 3600  # 1 hour
        self.compression_threshold = 1024  # Compress responses > 1KB
        
    def get_action_catalog(
        self, 
        catalog_id: str, 
        version: str,
        if_none_match: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Tuple[Optional[ActionCatalog], bool, Optional[str]]:
        """
        Get action catalog with ETag caching support.
        
        Args:
            catalog_id: Catalog identifier
            version: Catalog version
            if_none_match: If-None-Match header value
            tenant_id: Tenant ID for cache separation
            
        Returns:
            Tuple of (catalog, is_304_not_modified, etag)
        """
        cache_key = self._build_catalog_cache_key(catalog_id, version, tenant_id)
        
        # Check if catalog exists in cache
        cache_entry = self.catalog_cache.get(cache_key)
        
        if cache_entry and not cache_entry.is_expired:
            catalog = cache_entry.value
            current_etag = catalog.etag
            
            # Check If-None-Match header
            if if_none_match and if_none_match == current_etag:
                cache_entry.hit_count += 1
                return None, True, current_etag
            return catalog, False, current_etag
        
        # Cache miss - would typically load from databasecatalog = self._load_catalog_from_storage(catalog_id, version, tenant_id)
        
        if catalog:
            # Cache the catalog
            self._cache_action_catalog(cache_key, catalog)
            return catalog, False, catalog.etag
        
        return None, False, None
    
    def cache_response(
        self,
        cache_key: str,
        response_data: Any,
        ttl_seconds: Optional[int] = None,
        compress: bool = True
    ) -> str:
        """
        Cache a response with optional compression.
        
        Args:
            cache_key: Unique cache key
            response_data: Data to cache
            ttl_seconds: Time to live (default: 1 hour)
            compress: Whether to compress the data
            
        Returns:
            ETag for the cached response
        """
        ttl = ttl_seconds or self.default_ttl
        
        # Serialize the data
        serialized = json.dumps(response_data, default=str, separators=(',', ':'))
        
        # Compress if above threshold
        compressed_data = serialized
        is_compressed = False
        
        if compress and len(serialized) > self.compression_threshold:
            compressed_data = gzip.compress(serialized.encode()).decode('latin1')
            is_compressed = True
        
        # Generate ETag
        etag = self._generate_etag(serialized)
        
        # Create cache entry
        cache_entry = CacheEntry(
            key=cache_key,
            value={
                'data': compressed_data,
                'compressed': is_compressed,
                'original_size': len(serialized),
                'etag': etag
            },
            ttl_seconds=ttl
        )
        
        # Store in cache
        self.response_cache[cache_key] = cache_entry
        self.etag_index[etag] = cache_key
        return etag
    
    def get_cached_response(
        self,
        cache_key: str,
        if_none_match: Optional[str] = None
    ) -> Tuple[Optional[Any], bool, Optional[str]]:
        """
        Get cached response with ETag validation.
        
        Args:
            cache_key: Cache key to lookup
            if_none_match: If-None-Match header value
            
        Returns:
            Tuple of (data, is_304_not_modified, etag)
        """
        cache_entry = self.response_cache.get(cache_key)
        
        if not cache_entry or cache_entry.is_expired:
            if cache_entry:
                # Remove expired entry
                old_etag = cache_entry.value.get('etag')
                if old_etag and old_etag in self.etag_index:
                    del self.etag_index[old_etag]
                del self.response_cache[cache_key]
            return None, False, None
        
        cached_value = cache_entry.value
        etag = cached_value['etag']
        
        # Check If-None-Match
        if if_none_match and if_none_match == etag:
            cache_entry.hit_count += 1
            return None, True, etag
        
        # Decompress if needed
        data = cached_value['data']
        if cached_value.get('compressed', False):
            data = gzip.decompress(data.encode('latin1')).decode()
        
        # Deserialize
        response_data = json.loads(data)
        
        cache_entry.hit_count += 1
        
        return response_data, False, etag
    
    def invalidate_catalog(self, catalog_id: str, version: Optional[str] = None, tenant_id: Optional[str] = None):
        """Invalidate cached catalog(s)"""
        
        if version:
            # Invalidate specific version
            cache_key = self._build_catalog_cache_key(catalog_id, version, tenant_id)
            if cache_key in self.catalog_cache:
                del self.catalog_cache[cache_key]
            # Invalidate all versions of the catalog
            keys_to_remove = [
                key for key in self.catalog_cache.keys()
                if key.startswith(f"catalog:{catalog_id}:")
            ]
            for key in keys_to_remove:
                del self.catalog_cache[key]
    def invalidate_response_cache(self, pattern: Optional[str] = None):
        """Invalidate response cache entries matching pattern"""
        
        if pattern:
            keys_to_remove = [
                key for key in self.response_cache.keys()
                if pattern in key
            ]
        else:
            keys_to_remove = list(self.response_cache.keys())
        
        # Remove from both caches
        for key in keys_to_remove:
            cache_entry = self.response_cache.get(key)
            if cache_entry:
                etag = cache_entry.value.get('etag')
                if etag and etag in self.etag_index:
                    del self.etag_index[etag]
                del self.response_cache[key]
    
    def cleanup_expired_entries(self):
        """Remove expired cache entries"""
        
        # Cleanup catalog cache
        expired_catalog_keys = [
            key for key, entry in self.catalog_cache.items()
            if entry.is_expired
        ]
        
        for key in expired_catalog_keys:
            del self.catalog_cache[key]
        
        # Cleanup response cache
        expired_response_keys = [
            key for key, entry in self.response_cache.items()
            if entry.is_expired
        ]
        
        for key in expired_response_keys:
            cache_entry = self.response_cache[key]
            etag = cache_entry.value.get('etag')
            if etag and etag in self.etag_index:
                del self.etag_index[etag]
            del self.response_cache[key]
        
        total_expired = len(expired_catalog_keys) + len(expired_response_keys)
    def get_cache_statistics(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics"""
        
        catalog_stats = self._get_cache_stats(self.catalog_cache, "catalogs")
        response_stats = self._get_cache_stats(self.response_cache, "responses")
        
        # Calculate compression statistics
        compressed_entries = 0
        total_original_size = 0
        total_compressed_size = 0
        
        for entry in self.response_cache.values():
            if entry.value.get('compressed'):
                compressed_entries += 1
                total_original_size += entry.value.get('original_size', 0)
                total_compressed_size += len(entry.value.get('data', ''))
        
        compression_ratio = (
            (total_original_size - total_compressed_size) / total_original_size * 100
            if total_original_size > 0 else 0
        )
        
        return {
            'catalog_cache': catalog_stats,
            'response_cache': response_stats,
            'compression': {
                'compressed_entries': compressed_entries,
                'compression_ratio_percent': round(compression_ratio, 2),
                'bytes_saved': total_original_size - total_compressed_size
            },
            'etag_index_size': len(self.etag_index),
            'cache_efficiency': {
                'total_entries': len(self.catalog_cache) + len(self.response_cache),
                'total_hits': catalog_stats['total_hits'] + response_stats['total_hits']
            }
        }
    
    def _build_catalog_cache_key(self, catalog_id: str, version: str, tenant_id: Optional[str] = None) -> str:
        """Build cache key for action catalog"""
        tenant_part = f":{tenant_id}" if tenant_id else ""
        return f"catalog:{catalog_id}:v{version}{tenant_part}"
    
    def _cache_action_catalog(self, cache_key: str, catalog: ActionCatalog):
        """Cache an action catalog"""
        
        cache_entry = CacheEntry(
            key=cache_key,
            value=catalog,
            ttl_seconds=self.default_ttl * 24  # Catalogs cached longer (24 hours)
        )
        
        self.catalog_cache[cache_key] = cache_entry
    def _load_catalog_from_storage(
        self, 
        catalog_id: str, 
        version: str, 
        tenant_id: Optional[str] = None
    ) -> Optional[ActionCatalog]:
        """
        Load catalog from storage (database/file system).
        This would typically query a database or file system.
        For now, returns a default catalog.
        """
        
        # Default actions for demo purposes
        default_actions = [
            {
                "action_id": "open_url",
                "name": "open_url",
                "description": "Navigate to a specific URL",
                "parameters": {"url": {"type": "string", "required": True}},
                "category": "navigation",
                "cost_weight": 1.0
            },
            {
                "action_id": "click_css",
                "name": "click_css",
                "description": "Click an element using CSS selector",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "elementName": {"type": "string", "required": False}
                },
                "category": "interaction",
                "cost_weight": 1.2
            },
            {
                "action_id": "type_css",
                "name": "type_css", 
                "description": "Type text into an element using CSS selector",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "text": {"type": "string", "required": True},
                    "elementName": {"type": "string", "required": False}
                },
                "category": "interaction",
                "cost_weight": 1.1
            },
            {
                "action_id": "assert_text_css",
                "name": "assert_text_css",
                "description": "Assert that an element contains specific text",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "text": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.8
            },
            {
                "action_id": "wait_for_css",
                "name": "wait_for_css",
                "description": "Wait for an element to be present/visible",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "timeout": {"type": "number", "required": False, "default": 10000}
                },
                "category": "synchronization",
                "cost_weight": 0.5
            },
            {
                "action_id": "screenshot",
                "name": "screenshot",
                "description": "Take a screenshot",
                "parameters": {
                    "filename": {"type": "string", "required": False}
                },
                "category": "documentation",
                "cost_weight": 0.3
            }
        ]
        
        # Create catalog with current timestamp and generate ETag
        catalog_data = {
            "catalog_id": catalog_id,
            "version": version,
            "name": f"Standard Actions v{version}",
            "description": "Standard set of test automation actions",
            "actions": default_actions
        }
        
        try:
            from schemas.enterprise import ActionDefinition
            actions = [ActionDefinition(**action) for action in default_actions]
            
            catalog = ActionCatalog(
                catalog_id=catalog_id,
                version=version,
                name=catalog_data["name"],
                description=catalog_data["description"],
                actions=actions
            )
            return catalog
            
        except Exception as e:return None
    
    def _generate_etag(self, content: str) -> str:
        """Generate ETag for content"""
        content_hash = hashlib.md5(content.encode()).hexdigest()
        timestamp = int(time.time())
        return f'"{content_hash[:16]}-{timestamp}"'
    
    def _get_cache_stats(self, cache: Dict[str, CacheEntry], cache_type: str) -> Dict[str, Any]:
        """Get statistics for a specific cache"""
        
        if not cache:
            return {
                'total_entries': 0,
                'total_hits': 0,
                'cache_size_bytes': 0,
                'oldest_entry': None,
                'avg_hits_per_entry': 0
            }
        
        total_entries = len(cache)
        total_hits = sum(entry.hit_count for entry in cache.values())
        cache_size = sum(len(str(entry.value)) for entry in cache.values())
        oldest_entry = min((entry.created_at for entry in cache.values()), default=None)
        
        return {
            'total_entries': total_entries,
            'total_hits': total_hits,
            'cache_size_bytes': cache_size,
            'oldest_entry': oldest_entry,
            'avg_hits_per_entry': round(total_hits / total_entries, 2) if total_entries > 0 else 0
        }