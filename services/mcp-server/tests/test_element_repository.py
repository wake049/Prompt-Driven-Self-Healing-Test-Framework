"""
Test Element Repository Core functionality
"""

import pytest
import asyncio
import tempfile
import os
from pathlib import Path

from element_repository import ElementRepository, LocatorStatus, ApprovalStatus


@pytest.fixture
async def temp_repository():
    """Create temporary repository for testing"""
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tf:
        temp_path = tf.name
    
    try:
        repo = ElementRepository(storage_path=temp_path)
        await repo.initialize()
        yield repo
    finally:
        await repo.cleanup()
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@pytest.mark.asyncio
class TestElementRepository:
    """Test suite for Element Repository Core"""
    
    async def test_create_element_auto_approved(self, temp_repository):
        """Test creating element with auto-approval"""
        repo = temp_repository
        
        # Create element with high confidence (should auto-approve)
        record = await repo.create_element(
            element_name="login_button",
            css_selector="#login-btn",
            xpath_selector="//button[@id='login-btn']",
            alternatives=["button[id='login-btn']"],
            created_by="system"
        )
        
        assert record.element_name == "login_button"
        assert len(record.versions) == 1
        assert record.active_version == 1
        
        active_version = record.get_active_version()
        assert active_version.css_selector == "#login-btn"
        assert active_version.status == LocatorStatus.ACTIVE
        assert active_version.approval_status == ApprovalStatus.AUTO_APPROVED
    
    async def test_get_element_performance(self, temp_repository):
        """Test sub-100ms performance requirement"""
        repo = temp_repository
        
        # Create test element
        await repo.create_element(
            element_name="test_element",
            css_selector="#test",
            created_by="system"
        )
        
        # Test retrieval performance
        import time
        
        # First call (cache miss)
        start_time = time.time()
        result = await repo.get_element("test_element")
        first_call_ms = (time.time() - start_time) * 1000
        
        assert result is not None
        assert result.element_name == "test_element"
        
        # Second call (cache hit)
        start_time = time.time()
        result = await repo.get_element("test_element")
        second_call_ms = (time.time() - start_time) * 1000
        
        assert result is not None
        
        # Performance assertions (sub-100ms target)
        print(f"First call: {first_call_ms:.2f}ms, Second call: {second_call_ms:.2f}ms")
        assert second_call_ms < 100, f"Cache hit took {second_call_ms:.2f}ms (should be <100ms)"
    
    async def test_versioning_workflow(self, temp_repository):
        """Test element versioning and approval workflow"""
        repo = temp_repository
        
        # Create initial element
        record = await repo.create_element(
            element_name="submit_btn",
            css_selector="#submit",
            created_by="developer"
        )
        
        initial_version = record.get_active_version()
        assert initial_version.version == 1
        
        # Add new version with low confidence (should need approval)
        new_version = await repo.add_version(
            element_name="submit_btn",
            css_selector=".submit-button",
            created_by="developer",
            confidence_score=0.6
        )
        
        assert new_version.version == 2
        assert new_version.approval_status == ApprovalStatus.PENDING
        assert new_version.status == LocatorStatus.DRAFT
        
        # Original should still be active
        updated_record = await repo.get_element("submit_btn")
        assert updated_record.active_version == 1
        
        # Approve new version
        success = await repo.approve_version("submit_btn", 2, "admin")
        assert success
        
        # New version should now be active
        final_record = await repo.get_element("submit_btn")
        assert final_record.active_version == 2
        
        new_active = final_record.get_active_version()
        assert new_active.css_selector == ".submit-button"
        assert new_active.status == LocatorStatus.ACTIVE
        assert new_active.approval_status == ApprovalStatus.APPROVED
    
    async def test_usage_statistics(self, temp_repository):
        """Test usage statistics tracking"""
        repo = temp_repository
        
        # Create element
        await repo.create_element(
            element_name="nav_link",
            css_selector="#nav a",
            created_by="system"
        )
        
        # Update usage stats
        await repo.update_usage_stats("nav_link", success=True)
        await repo.update_usage_stats("nav_link", success=True)
        await repo.update_usage_stats("nav_link", success=False)
        
        # Check stats
        record = await repo.get_element("nav_link")
        active_version = record.get_active_version()
        
        assert active_version.usage_count == 3
        assert abs(active_version.success_rate - 0.666667) < 0.001  # 2/3 success
        assert active_version.last_used is not None
    
    async def test_search_functionality(self, temp_repository):
        """Test element search functionality"""
        repo = temp_repository
        
        # Create multiple elements
        await repo.create_element("login_form", "#login-form", created_by="system")
        await repo.create_element("logout_btn", "#logout", created_by="system")
        await repo.create_element("user_profile", ".profile", created_by="system")
        
        # Search by name
        results = await repo.search_elements("login")
        assert len(results) == 1
        assert results[0].element_name == "login_form"
        
        # Search by selector
        results = await repo.search_elements("#logout")
        assert len(results) == 1
        assert results[0].element_name == "logout_btn"
        
        # Search with no matches
        results = await repo.search_elements("nonexistent")
        assert len(results) == 0
    
    async def test_cache_eviction(self, temp_repository):
        """Test cache LRU eviction"""
        repo = temp_repository
        
        # Set small cache size for testing
        repo.cache.max_size = 2
        
        # Create and access elements
        await repo.create_element("elem1", "#elem1", created_by="system")
        await repo.create_element("elem2", "#elem2", created_by="system")
        await repo.create_element("elem3", "#elem3", created_by="system")
        
        # Access elem1 and elem2 (should be in cache)
        await repo.get_element("elem1")
        await repo.get_element("elem2")
        
        # Cache should be at capacity
        assert len(repo.cache._cache) == 2
        
        # Access elem3 (should evict least recently used)
        await repo.get_element("elem3")
        
        # Check cache state
        assert len(repo.cache._cache) <= 2
        assert "elem3" in repo.cache._cache
    
    async def test_repository_stats(self, temp_repository):
        """Test repository statistics"""
        repo = temp_repository
        
        # Create elements with different statuses
        await repo.create_element("approved_elem", "#approved", created_by="system")
        record = await repo.create_element("pending_elem", "#pending", created_by="user")
        
        # Add pending version
        await repo.add_version("approved_elem", "#approved-v2", created_by="user", confidence_score=0.5)
        
        # Get stats
        stats = await repo.get_stats()
        
        assert stats["total_elements"] == 2
        assert stats["total_versions"] >= 3  # At least 3 versions
        assert stats["pending_approvals"] >= 1  # At least 1 pending
        assert "cache_stats" in stats
    
    async def test_error_handling(self, temp_repository):
        """Test error handling scenarios"""
        repo = temp_repository
        
        # Test getting non-existent element
        result = await repo.get_element("non_existent")
        assert result is None
        
        # Test creating duplicate element
        await repo.create_element("duplicate", "#dup", created_by="system")
        
        with pytest.raises(ValueError, match="already exists"):
            await repo.create_element("duplicate", "#dup2", created_by="system")
        
        # Test adding version to non-existent element
        with pytest.raises(ValueError, match="does not exist"):
            await repo.add_version("non_existent", "#new", created_by="system")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])