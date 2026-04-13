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
            # === BASIC NAVIGATION ===
            {
                "action_id": "open_url",
                "name": "open_url",
                "description": "Navigate to a specific URL",
                "parameters": {"url": {"type": "string", "required": True}},
                "category": "navigation",
                "cost_weight": 1.0
            },
            # === INTERACTION ===
            {
                "action_id": "click",
                "name": "click",
                "description": "Click an element using CSS/XPath selector",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "elementName": {"type": "string", "required": False}
                },
                "category": "interaction",
                "cost_weight": 1.2
            },
            {
                "action_id": "type",
                "name": "type", 
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
                "action_id": "clear_and_type",
                "name": "clear_and_type",
                "description": "Clear existing text then type new text",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "text": {"type": "string", "required": True}
                },
                "category": "interaction",
                "cost_weight": 1.2
            },
            {
                "action_id": "type_slowly",
                "name": "type_slowly",
                "description": "Type text character by character with delay (for autocomplete)",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "text": {"type": "string", "required": True},
                    "delay": {"type": "number", "required": False, "default": 100}
                },
                "category": "interaction",
                "cost_weight": 1.5
            },
            # === VERIFICATION ===
            {
                "action_id": "assert_text",
                "name": "assert_text",
                "description": "Assert that an element contains specific text",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "text": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.8
            },
            {
                "action_id": "assert_text_exact",
                "name": "assert_text_exact",
                "description": "Assert exact text match on element",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "text": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.8
            },
            {
                "action_id": "assert_text_contains",
                "name": "assert_text_contains",
                "description": "Assert element text contains substring",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "text": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.8
            },
            {
                "action_id": "assert_visible",
                "name": "assert_visible",
                "description": "Assert that an element is visible",
                "parameters": {
                    "selector": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.7
            },
            {
                "action_id": "assert_element_count",
                "name": "assert_element_count",
                "description": "Assert number of elements matching selector",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "count": {"type": "number", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.8
            },
            {
                "action_id": "assert_attribute",
                "name": "assert_attribute",
                "description": "Assert element attribute value",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "attribute": {"type": "string", "required": True},
                    "value": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.8
            },
            {
                "action_id": "assert_page_title",
                "name": "assert_page_title",
                "description": "Assert page title matches expected value",
                "parameters": {
                    "title": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.5
            },
            {
                "action_id": "assert_url",
                "name": "assert_url",
                "description": "Assert current URL matches exactly",
                "parameters": {
                    "url": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.5
            },
            {
                "action_id": "assert_url_contains",
                "name": "assert_url_contains",
                "description": "Assert current URL contains substring",
                "parameters": {
                    "substring": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.5
            },
            {
                "action_id": "assert_element_enabled",
                "name": "assert_element_enabled",
                "description": "Assert element is enabled",
                "parameters": {
                    "selector": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.7
            },
            {
                "action_id": "assert_element_disabled",
                "name": "assert_element_disabled",
                "description": "Assert element is disabled",
                "parameters": {
                    "selector": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.7
            },
            {
                "action_id": "assert_checkbox_checked",
                "name": "assert_checkbox_checked",
                "description": "Assert checkbox is checked",
                "parameters": {
                    "selector": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.7
            },
            {
                "action_id": "assert_checkbox_unchecked",
                "name": "assert_checkbox_unchecked",
                "description": "Assert checkbox is unchecked",
                "parameters": {
                    "selector": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 0.7
            },
            {
                "action_id": "assert_toast_message",
                "name": "assert_toast_message",
                "description": "Assert toast/notification message appears",
                "parameters": {
                    "text": {"type": "string", "required": True},
                    "selector": {"type": "string", "required": False}
                },
                "category": "verification",
                "cost_weight": 0.9
            },
            # === SYNCHRONIZATION ===
            {
                "action_id": "wait_for",
                "name": "wait_for",
                "description": "Wait for an element to be present/visible",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "timeout": {"type": "number", "required": False, "default": 10000}
                },
                "category": "synchronization",
                "cost_weight": 0.5
            },
            {
                "action_id": "wait_for_page_load",
                "name": "wait_for_page_load",
                "description": "Wait for page to fully load (network idle)",
                "parameters": {
                    "timeout": {"type": "number", "required": False, "default": 30}
                },
                "category": "synchronization",
                "cost_weight": 0.6
            },
            {
                "action_id": "wait_for_api_response",
                "name": "wait_for_api_response",
                "description": "Wait for specific API request to complete",
                "parameters": {
                    "url_pattern": {"type": "string", "required": False},
                    "timeout": {"type": "number", "required": False, "default": 30}
                },
                "category": "synchronization",
                "cost_weight": 0.7
            },
            {
                "action_id": "wait_for_modal_visible",
                "name": "wait_for_modal_visible",
                "description": "Wait for modal dialog to appear",
                "parameters": {
                    "selector": {"type": "string", "required": False},
                    "timeout": {"type": "number", "required": False, "default": 10}
                },
                "category": "synchronization",
                "cost_weight": 0.6
            },
            {
                "action_id": "wait_for_modal_dismissed",
                "name": "wait_for_modal_dismissed",
                "description": "Wait for modal dialog to close",
                "parameters": {
                    "selector": {"type": "string", "required": False},
                    "timeout": {"type": "number", "required": False, "default": 10}
                },
                "category": "synchronization",
                "cost_weight": 0.6
            },
            {
                "action_id": "wait_for_table_to_load",
                "name": "wait_for_table_to_load",
                "description": "Wait for table to load with data",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "timeout": {"type": "number", "required": False, "default": 30}
                },
                "category": "synchronization",
                "cost_weight": 0.6
            },
            # === DATA EXTRACTION ===
            {
                "action_id": "extract_data",
                "name": "extract_data",
                "description": "Extract text from single element into variable",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "variable": {"type": "string", "required": True}
                },
                "category": "data",
                "cost_weight": 0.9
            },
            {
                "action_id": "extract_list",
                "name": "extract_list",
                "description": "Extract text from all matching elements into list variable",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "variable": {"type": "string", "required": True}
                },
                "category": "data",
                "cost_weight": 1.1
            },
            {
                "action_id": "count_elements",
                "name": "count_elements",
                "description": "Count elements matching selector and store in variable",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "variable": {"type": "string", "required": True}
                },
                "category": "data",
                "cost_weight": 0.7
            },
            {
                "action_id": "calculate",
                "name": "calculate",
                "description": "Perform simple arithmetic calculation",
                "parameters": {
                    "formula": {"type": "string", "required": True},
                    "variable": {"type": "string", "required": True}
                },
                "category": "data",
                "cost_weight": 0.8
            },
            {
                "action_id": "get_table_cell_value",
                "name": "get_table_cell_value",
                "description": "Extract table cell value by row/column",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "row": {"type": "number", "required": True},
                    "col": {"type": "string", "required": True},
                    "variable": {"type": "string", "required": True}
                },
                "category": "data",
                "cost_weight": 1.0
            },
            # === NAVIGATION & PAGE CONTROL ===
            {
                "action_id": "scroll_to_element",
                "name": "scroll_to_element",
                "description": "Scroll to bring element into view",
                "parameters": {
                    "selector": {"type": "string", "required": True}
                },
                "category": "navigation",
                "cost_weight": 0.6
            },
            {
                "action_id": "scroll_to_position",
                "name": "scroll_to_position",
                "description": "Scroll to specific position (top, bottom, percentage, pixels)",
                "parameters": {
                    "position": {"type": "string", "required": True}
                },
                "category": "navigation",
                "cost_weight": 0.5
            },
            {
                "action_id": "switch_to_frame",
                "name": "switch_to_frame",
                "description": "Switch context to iframe",
                "parameters": {
                    "frame": {"type": "string", "required": True}
                },
                "category": "navigation",
                "cost_weight": 0.7
            },
            {
                "action_id": "switch_to_parent_frame",
                "name": "switch_to_parent_frame",
                "description": "Switch back to parent frame",
                "parameters": {},
                "category": "navigation",
                "cost_weight": 0.5
            },
            {
                "action_id": "switch_to_window",
                "name": "switch_to_window",
                "description": "Switch to browser window/tab",
                "parameters": {
                    "window": {"type": "string", "required": False, "default": "new"}
                },
                "category": "navigation",
                "cost_weight": 0.7
            },
            {
                "action_id": "close_window",
                "name": "close_window",
                "description": "Close current window",
                "parameters": {},
                "category": "navigation",
                "cost_weight": 0.5
            },
            {
                "action_id": "navigate_back",
                "name": "navigate_back",
                "description": "Navigate browser back",
                "parameters": {},
                "category": "navigation",
                "cost_weight": 0.5
            },
            {
                "action_id": "navigate_forward",
                "name": "navigate_forward",
                "description": "Navigate browser forward",
                "parameters": {},
                "category": "navigation",
                "cost_weight": 0.5
            },
            {
                "action_id": "refresh_page",
                "name": "refresh_page",
                "description": "Refresh current page",
                "parameters": {},
                "category": "navigation",
                "cost_weight": 0.5
            },
            # === FORM CONTROLS ===
            {
                "action_id": "upload_file",
                "name": "upload_file",
                "description": "Upload file to file input",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "file_path": {"type": "string", "required": True}
                },
                "category": "form",
                "cost_weight": 1.2
            },
            {
                "action_id": "select_by_index",
                "name": "select_by_index",
                "description": "Select dropdown option by index",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "index": {"type": "number", "required": True}
                },
                "category": "form",
                "cost_weight": 0.9
            },
            {
                "action_id": "select_by_value",
                "name": "select_by_value",
                "description": "Select dropdown option by value attribute",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "value": {"type": "string", "required": True}
                },
                "category": "form",
                "cost_weight": 0.9
            },
            {
                "action_id": "select_by_text",
                "name": "select_by_text",
                "description": "Select dropdown option by visible text",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "text": {"type": "string", "required": True}
                },
                "category": "form",
                "cost_weight": 0.9
            },
            {
                "action_id": "check_checkbox",
                "name": "check_checkbox",
                "description": "Check a checkbox (idempotent)",
                "parameters": {
                    "selector": {"type": "string", "required": True}
                },
                "category": "form",
                "cost_weight": 0.8
            },
            {
                "action_id": "uncheck_checkbox",
                "name": "uncheck_checkbox",
                "description": "Uncheck a checkbox (idempotent)",
                "parameters": {
                    "selector": {"type": "string", "required": True}
                },
                "category": "form",
                "cost_weight": 0.8
            },
            {
                "action_id": "set_slider",
                "name": "set_slider",
                "description": "Set range slider value",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "value": {"type": "number", "required": True}
                },
                "category": "form",
                "cost_weight": 0.9
            },
            {
                "action_id": "set_date_picker",
                "name": "set_date_picker",
                "description": "Set date picker field value",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "date": {"type": "string", "required": True}
                },
                "category": "form",
                "cost_weight": 1.0
            },
            # === KEYBOARD & MOUSE ===
            {
                "action_id": "hover",
                "name": "hover",
                "description": "Hover over element",
                "parameters": {
                    "selector": {"type": "string", "required": True}
                },
                "category": "mouse",
                "cost_weight": 0.8
            },
            {
                "action_id": "right_click",
                "name": "right_click",
                "description": "Right-click (context click) on element",
                "parameters": {
                    "selector": {"type": "string", "required": True}
                },
                "category": "mouse",
                "cost_weight": 0.9
            },
            {
                "action_id": "double_click",
                "name": "double_click",
                "description": "Double-click on element",
                "parameters": {
                    "selector": {"type": "string", "required": True}
                },
                "category": "mouse",
                "cost_weight": 0.9
            },
            {
                "action_id": "drag_and_drop",
                "name": "drag_and_drop",
                "description": "Drag element to another element",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "drop_target": {"type": "string", "required": True}
                },
                "category": "mouse",
                "cost_weight": 1.2
            },
            {
                "action_id": "press_key",
                "name": "press_key",
                "description": "Press keyboard key (Enter, Tab, Escape, etc.)",
                "parameters": {
                    "key": {"type": "string", "required": True},
                    "selector": {"type": "string", "required": False}
                },
                "category": "keyboard",
                "cost_weight": 0.7
            },
            {
                "action_id": "keyboard_shortcut",
                "name": "keyboard_shortcut",
                "description": "Execute keyboard shortcut (Ctrl+S, etc.)",
                "parameters": {
                    "keys": {"type": "string", "required": True}
                },
                "category": "keyboard",
                "cost_weight": 0.8
            },
            # === TABLES ===
            {
                "action_id": "assert_table_row_count",
                "name": "assert_table_row_count",
                "description": "Assert number of rows in table",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "count": {"type": "number", "required": True}
                },
                "category": "table",
                "cost_weight": 0.8
            },
            {
                "action_id": "click_table_row_by_value",
                "name": "click_table_row_by_value",
                "description": "Find and click table row containing value",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "value": {"type": "string", "required": True},
                    "col": {"type": "string", "required": False}
                },
                "category": "table",
                "cost_weight": 1.1
            },
            # === LIST & ITERATION ===
            {
                "action_id": "verify_all",
                "name": "verify_all",
                "description": "Verify all elements match condition",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "condition": {"type": "string", "required": True}
                },
                "category": "verification",
                "cost_weight": 1.0
            },
            {
                "action_id": "for_each",
                "name": "for_each",
                "description": "Iterate through list storing each item",
                "parameters": {
                    "source": {"type": "string", "required": True},
                    "variable_prefix": {"type": "string", "required": False}
                },
                "category": "iteration",
                "cost_weight": 1.0
            },
            # === DATE VERIFICATION ===
            {
                "action_id": "verify_date_format",
                "name": "verify_date_format",
                "description": "Verify element text matches date format",
                "parameters": {
                    "selector": {"type": "string", "required": True},
                    "format": {"type": "string", "required": False}
                },
                "category": "verification",
                "cost_weight": 0.9
            },
            # === ALERTS ===
            {
                "action_id": "accept_alert",
                "name": "accept_alert",
                "description": "Accept JavaScript alert dialog",
                "parameters": {
                    "timeout": {"type": "number", "required": False, "default": 5}
                },
                "category": "alert",
                "cost_weight": 0.7
            },
            {
                "action_id": "dismiss_alert",
                "name": "dismiss_alert",
                "description": "Dismiss JavaScript alert dialog",
                "parameters": {
                    "timeout": {"type": "number", "required": False, "default": 5}
                },
                "category": "alert",
                "cost_weight": 0.7
            },
            {
                "action_id": "get_alert_text",
                "name": "get_alert_text",
                "description": "Extract alert text into variable",
                "parameters": {
                    "variable": {"type": "string", "required": True}
                },
                "category": "alert",
                "cost_weight": 0.8
            },
            # === DOCUMENTATION ===
            {
                "action_id": "screenshot",
                "name": "screenshot",
                "description": "Take a screenshot",
                "parameters": {
                    "filename": {"type": "string", "required": False}
                },
                "category": "documentation",
                "cost_weight": 0.3
            },
            # === API ===
            {
                "action_id": "api_setup",
                "name": "api_setup",
                "description": "Execute API call to setup test data",
                "parameters": {
                    "setup_id": {"type": "string", "required": True}
                },
                "category": "api",
                "cost_weight": 1.5
            }
        ]
        
        # Create catalog with current timestamp and generate ETag
        catalog_data = {
            "catalog_id": catalog_id,
            "version": version,
            "name": f"Standard Actions v{version}",
            "description": "Comprehensive set of test automation actions",
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