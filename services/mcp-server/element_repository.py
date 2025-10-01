"""
Element Repository Core
High-performance element locator management with versioning and approval workflow
"""

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class LocatorStatus(Enum):
    """Status of a locator in the approval workflow"""
    ACTIVE = "active"
    PENDING = "pending"
    DEPRECATED = "deprecated"
    REJECTED = "rejected"
    DRAFT = "draft"


class ApprovalStatus(Enum):
    """Approval workflow status"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    AUTO_APPROVED = "auto_approved"


@dataclass
class LocatorVersion:
    """A specific version of an element locator"""
    version: int
    css_selector: str
    xpath_selector: Optional[str] = None
    alternatives: List[str] = None
    confidence_score: float = 0.0
    created_at: str = None
    created_by: str = "system"
    status: LocatorStatus = LocatorStatus.DRAFT
    approval_status: ApprovalStatus = ApprovalStatus.PENDING
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None
    usage_count: int = 0
    success_rate: float = 0.0
    last_used: Optional[str] = None
    ai_reasoning: Optional[str] = None
    validation_results: Optional[Dict] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc).isoformat()
        if self.alternatives is None:
            self.alternatives = []
        if self.validation_results is None:
            self.validation_results = {}


@dataclass
class ElementRecord:
    """Complete element record with all versions"""
    element_name: str
    versions: List[LocatorVersion]
    active_version: int
    description: Optional[str] = None
    tags: List[str] = None
    page_context: Optional[Dict] = None
    created_at: str = None
    updated_at: str = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc).isoformat()
        if self.tags is None:
            self.tags = []
        if self.versions is None:
            self.versions = []
            
    def get_active_version(self) -> Optional[LocatorVersion]:
        """Get the currently active version"""
        if self.active_version > 0 and self.active_version <= len(self.versions):
            return self.versions[self.active_version - 1]
        return None
    
    def get_latest_version(self) -> Optional[LocatorVersion]:
        """Get the most recent version (may not be active)"""
        return self.versions[-1] if self.versions else None


class ElementRepositoryCache:
    """High-performance in-memory cache for sub-100ms lookups"""
    
    def __init__(self, max_size: int = 10000, ttl_seconds: int = 300):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Tuple[ElementRecord, float]] = {}
        self._access_times: Dict[str, float] = {}
        
    def get(self, element_name: str) -> Optional[ElementRecord]:
        """Get element from cache with LRU eviction"""
        current_time = time.time()
        
        if element_name in self._cache:
            record, cache_time = self._cache[element_name]
            
            # Check TTL
            if current_time - cache_time > self.ttl_seconds:
                self._evict(element_name)
                return None
                
            # Update access time for LRU
            self._access_times[element_name] = current_time
            return record
            
        return None
    
    def put(self, element_name: str, record: ElementRecord) -> None:
        """Store element in cache with LRU management"""
        current_time = time.time()
        
        # Evict if at capacity
        if len(self._cache) >= self.max_size and element_name not in self._cache:
            self._evict_lru()
            
        self._cache[element_name] = (record, current_time)
        self._access_times[element_name] = current_time
    
    def invalidate(self, element_name: str) -> None:
        """Remove element from cache"""
        self._evict(element_name)
    
    def clear(self) -> None:
        """Clear all cache entries"""
        self._cache.clear()
        self._access_times.clear()
    
    def _evict(self, element_name: str) -> None:
        """Remove specific element from cache"""
        self._cache.pop(element_name, None)
        self._access_times.pop(element_name, None)
    
    def _evict_lru(self) -> None:
        """Evict least recently used element"""
        if not self._access_times:
            return
            
        lru_element = min(self._access_times.items(), key=lambda x: x[1])[0]
        self._evict(lru_element)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "hit_ratio": getattr(self, '_hits', 0) / max(getattr(self, '_requests', 1), 1),
            "ttl_seconds": self.ttl_seconds
        }


class ApprovalWorkflow:
    """Manages approval workflow for locator changes"""
    
    def __init__(self):
        self.auto_approval_rules = {
            "confidence_threshold": 0.9,
            "trusted_creators": ["system", "admin"],
            "minor_change_threshold": 0.1
        }
    
    async def submit_for_approval(self, element_name: str, version: LocatorVersion) -> ApprovalStatus:
        """Submit a new locator version for approval"""
        
        # Check auto-approval rules
        if await self._should_auto_approve(element_name, version):
            version.approval_status = ApprovalStatus.AUTO_APPROVED
            version.approved_at = datetime.now(timezone.utc).isoformat()
            version.approved_by = "system"
            logger.info(f"Auto-approved locator {element_name} v{version.version}")
            return ApprovalStatus.AUTO_APPROVED
        
        # Otherwise, mark as pending
        version.approval_status = ApprovalStatus.PENDING
        logger.info(f"Submitted locator {element_name} v{version.version} for manual approval")
        return ApprovalStatus.PENDING
    
    async def approve_version(self, element_name: str, version: int, approver: str) -> bool:
        """Approve a pending locator version"""
        # This would integrate with actual approval system
        logger.info(f"Approved locator {element_name} v{version} by {approver}")
        return True
    
    async def reject_version(self, element_name: str, version: int, approver: str, reason: str) -> bool:
        """Reject a pending locator version"""
        logger.info(f"Rejected locator {element_name} v{version} by {approver}: {reason}")
        return True
    
    async def _should_auto_approve(self, element_name: str, version: LocatorVersion) -> bool:
        """Determine if version should be auto-approved"""
        
        # High confidence score
        if version.confidence_score >= self.auto_approval_rules["confidence_threshold"]:
            return True
            
        # Trusted creator
        if version.created_by in self.auto_approval_rules["trusted_creators"]:
            return True
        
        # Minor changes (if we have previous version to compare)
        # This would compare selector similarity
        
        return False


class ElementRepository:
    """Core element repository with versioning, caching, and approval workflow"""
    
    def __init__(self, storage_path: str = "element_storage.json"):
        self.storage_path = Path(storage_path)
        self.cache = ElementRepositoryCache()
        self.workflow = ApprovalWorkflow()
        self._elements: Dict[str, ElementRecord] = {}
        self._lock = asyncio.Lock()
        
    async def initialize(self) -> None:
        """Initialize repository and load existing data"""
        await self._load_from_storage()
        logger.info(f"Element Repository initialized with {len(self._elements)} elements")
    
    async def get_element(self, element_name: str, include_inactive: bool = False) -> Optional[ElementRecord]:
        """
        Get element with sub-100ms performance target
        """
        start_time = time.time()
        
        # Try cache first
        cached = self.cache.get(element_name)
        if cached:
            elapsed_ms = (time.time() - start_time) * 1000
            logger.debug(f"Cache hit for {element_name} in {elapsed_ms:.2f}ms")
            return cached
        
        # Load from storage
        async with self._lock:
            if element_name in self._elements:
                record = self._elements[element_name]
                
                # Filter out inactive versions if requested
                if not include_inactive:
                    active_version = record.get_active_version()
                    if active_version and active_version.status != LocatorStatus.ACTIVE:
                        return None
                
                # Cache for future requests
                self.cache.put(element_name, record)
                
                elapsed_ms = (time.time() - start_time) * 1000
                logger.debug(f"Retrieved {element_name} in {elapsed_ms:.2f}ms")
                return record
        
        return None
    
    async def create_element(self, element_name: str, css_selector: str, 
                           xpath_selector: Optional[str] = None,
                           alternatives: List[str] = None,
                           created_by: str = "system",
                           ai_reasoning: Optional[str] = None) -> ElementRecord:
        """Create new element with initial version"""
        
        async with self._lock:
            if element_name in self._elements:
                raise ValueError(f"Element {element_name} already exists")
            
            # Create initial version
            version = LocatorVersion(
                version=1,
                css_selector=css_selector,
                xpath_selector=xpath_selector,
                alternatives=alternatives or [],
                created_by=created_by,
                ai_reasoning=ai_reasoning,
                status=LocatorStatus.DRAFT
            )
            
            # Submit for approval
            approval_status = await self.workflow.submit_for_approval(element_name, version)
            
            # If auto-approved, make it active
            if approval_status == ApprovalStatus.AUTO_APPROVED:
                version.status = LocatorStatus.ACTIVE
            
            # Create element record
            record = ElementRecord(
                element_name=element_name,
                versions=[version],
                active_version=1 if version.status == LocatorStatus.ACTIVE else 0
            )
            
            self._elements[element_name] = record
            self.cache.put(element_name, record)
            await self._save_to_storage()
            
            logger.info(f"Created element {element_name} with status {version.status}")
            return record
    
    async def add_version(self, element_name: str, css_selector: str,
                         xpath_selector: Optional[str] = None,
                         alternatives: List[str] = None,
                         created_by: str = "system",
                         ai_reasoning: Optional[str] = None,
                         confidence_score: float = 0.0) -> LocatorVersion:
        """Add new version to existing element"""
        
        async with self._lock:
            if element_name not in self._elements:
                raise ValueError(f"Element {element_name} does not exist")
            
            record = self._elements[element_name]
            next_version = len(record.versions) + 1
            
            # Create new version
            version = LocatorVersion(
                version=next_version,
                css_selector=css_selector,
                xpath_selector=xpath_selector,
                alternatives=alternatives or [],
                created_by=created_by,
                ai_reasoning=ai_reasoning,
                confidence_score=confidence_score,
                status=LocatorStatus.DRAFT
            )
            
            # Submit for approval
            approval_status = await self.workflow.submit_for_approval(element_name, version)
            
            # If auto-approved, deprecate old version and activate new one
            if approval_status == ApprovalStatus.AUTO_APPROVED:
                await self._activate_version(element_name, next_version)
            
            record.versions.append(version)
            record.updated_at = datetime.now(timezone.utc).isoformat()
            
            self.cache.invalidate(element_name)  # Clear cache
            await self._save_to_storage()
            
            logger.info(f"Added version {next_version} to element {element_name}")
            return version
    
    async def approve_version(self, element_name: str, version: int, approver: str) -> bool:
        """Approve a pending version and activate it"""
        
        async with self._lock:
            if element_name not in self._elements:
                return False
            
            record = self._elements[element_name]
            if version > len(record.versions):
                return False
            
            version_obj = record.versions[version - 1]
            if version_obj.approval_status != ApprovalStatus.PENDING:
                return False
            
            # Approve version
            version_obj.approval_status = ApprovalStatus.APPROVED
            version_obj.approved_by = approver
            version_obj.approved_at = datetime.now(timezone.utc).isoformat()
            
            # Activate the approved version
            await self._activate_version(element_name, version)
            
            self.cache.invalidate(element_name)
            await self._save_to_storage()
            
            logger.info(f"Approved and activated version {version} of {element_name}")
            return True
    
    async def _activate_version(self, element_name: str, version: int) -> None:
        """Activate a specific version and deprecate the current active version"""
        record = self._elements[element_name]
        
        # Deprecate current active version
        if record.active_version > 0:
            current_active = record.versions[record.active_version - 1]
            current_active.status = LocatorStatus.DEPRECATED
        
        # Activate new version
        new_active = record.versions[version - 1]
        new_active.status = LocatorStatus.ACTIVE
        record.active_version = version
        record.updated_at = datetime.now(timezone.utc).isoformat()
    
    async def update_usage_stats(self, element_name: str, success: bool) -> None:
        """Update usage statistics for performance tracking"""
        async with self._lock:
            if element_name not in self._elements:
                return
            
            record = self._elements[element_name]
            active_version = record.get_active_version()
            
            if active_version:
                active_version.usage_count += 1
                active_version.last_used = datetime.now(timezone.utc).isoformat()
                
                # Update success rate
                if active_version.usage_count == 1:
                    active_version.success_rate = 1.0 if success else 0.0
                else:
                    current_successes = active_version.success_rate * (active_version.usage_count - 1)
                    if success:
                        current_successes += 1
                    active_version.success_rate = current_successes / active_version.usage_count
                
                self.cache.invalidate(element_name)  # Update cache
                
                # Async save (don't block)
                asyncio.create_task(self._save_to_storage())
    
    async def search_elements(self, query: str, limit: int = 50) -> List[ElementRecord]:
        """Search elements by name or selector"""
        results = []
        
        for element_name, record in self._elements.items():
            if query.lower() in element_name.lower():
                results.append(record)
                continue
                
            # Search in selectors
            active_version = record.get_active_version()
            if active_version:
                if (query.lower() in active_version.css_selector.lower() or 
                    (active_version.xpath_selector and query.lower() in active_version.xpath_selector.lower())):
                    results.append(record)
                    continue
                
                # Search in alternatives
                if any(query.lower() in alt.lower() for alt in active_version.alternatives):
                    results.append(record)
            
            if len(results) >= limit:
                break
        
        return results
    
    async def get_pending_approvals(self) -> List[Tuple[str, LocatorVersion]]:
        """Get all versions pending approval"""
        pending = []
        
        for element_name, record in self._elements.items():
            for version in record.versions:
                if version.approval_status == ApprovalStatus.PENDING:
                    pending.append((element_name, version))
        
        return pending
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get repository statistics"""
        total_elements = len(self._elements)
        total_versions = sum(len(record.versions) for record in self._elements.values())
        pending_approvals = len(await self.get_pending_approvals())
        
        cache_stats = self.cache.get_stats()
        
        return {
            "total_elements": total_elements,
            "total_versions": total_versions,
            "pending_approvals": pending_approvals,
            "cache_stats": cache_stats,
            "storage_path": str(self.storage_path)
        }
    
    async def _load_from_storage(self) -> None:
        """Load elements from persistent storage"""
        if not self.storage_path.exists():
            logger.info("No existing storage found, starting with empty repository")
            return
        
        try:
            with open(self.storage_path, 'r') as f:
                data = json.load(f)
                
            for element_name, element_data in data.items():
                # Reconstruct versions
                versions = []
                for version_data in element_data['versions']:
                    version = LocatorVersion(**version_data)
                    versions.append(version)
                
                # Reconstruct element record
                record = ElementRecord(
                    element_name=element_name,
                    versions=versions,
                    active_version=element_data['active_version'],
                    description=element_data.get('description'),
                    tags=element_data.get('tags', []),
                    page_context=element_data.get('page_context'),
                    created_at=element_data.get('created_at'),
                    updated_at=element_data.get('updated_at')
                )
                
                self._elements[element_name] = record
                
        except Exception as e:
            logger.error(f"Failed to load storage: {e}")
    
    async def _save_to_storage(self) -> None:
        """Save elements to persistent storage"""
        try:
            # Convert to serializable format
            data = {}
            for element_name, record in self._elements.items():
                element_data = asdict(record)
                data[element_name] = element_data
            
            # Write to file
            with open(self.storage_path, 'w') as f:
                json.dump(data, f, indent=2, default=str)
                
        except Exception as e:
            logger.error(f"Failed to save storage: {e}")
    
    async def cleanup(self) -> None:
        """Cleanup resources"""
        await self._save_to_storage()
        self.cache.clear()
        logger.info("Element Repository cleaned up")


# Global repository instance
_repository: Optional[ElementRepository] = None

async def get_repository() -> ElementRepository:
    """Get the global repository instance"""
    global _repository
    if _repository is None:
        _repository = ElementRepository()
        await _repository.initialize()
    return _repository