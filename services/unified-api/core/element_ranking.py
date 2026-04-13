"""
 Enterprise Element Ranking Service
Implements intelligent element ranking with multiple strategies for cost-effective AI processing.

Features:
- Top-K element selection with relevance scoring
- Heuristic-based filtering for stable selectors
- Preparation for vector similarity search
- Caching and performance optimization
- Minimal payload generation
"""

from __future__ import annotations

import hashlib

import time
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timedelta

from schemas.enterprise import (
    PageElement, PageSlice, ElementRankingStrategy, 
    ElementRankingConfig, CacheEntry
)

class ElementRankingService:
    """Service for ranking and selecting relevant page elements"""
    
    def __init__(self):
        self.cache: Dict[str, CacheEntry] = {}
        self.cache_ttl = 3600  # 1 hour default
        
    def rank_elements(
        self,
        elements: List[Dict[str, Any]],
        config: ElementRankingConfig,
        prompt_context: Optional[str] = None
    ) -> PageSlice:
        """
        Rank and select top-K elements based on strategy and prompt context.
        
        Args:
            elements: Raw element data from DOM
            config: Ranking configuration
            prompt_context: Optional prompt for context-aware ranking
            
        Returns:
            PageSlice with ranked and filtered elements
        """
        start_time = time.time()
        total_elements = len(elements)# Check cache first
        cache_key = self._generate_cache_key(elements, config, prompt_context)
        cached_result = self._get_cached_ranking(cache_key)
        if cached_result:
            cached_result.cache_hit = True
            return cached_result
        
        # Convert raw elements to PageElement objects
        page_elements = [self._convert_to_page_element(el, idx) for idx, el in enumerate(elements)]
        
        # Apply ranking strategy
        if config.strategy == ElementRankingStrategy.TOP_K:
            ranked_elements = self._rank_top_k(page_elements, config, prompt_context)
        elif config.strategy == ElementRankingStrategy.RELEVANCE_SCORE:
            ranked_elements = self._rank_by_relevance(page_elements, config, prompt_context)
        elif config.strategy == ElementRankingStrategy.HEURISTIC_FILTER:
            ranked_elements = self._rank_heuristic_filter(page_elements, config, prompt_context)
        elif config.strategy == ElementRankingStrategy.HYBRID:
            ranked_elements = self._rank_hybrid(page_elements, config, prompt_context)
        else:
            # Default to top-K
            ranked_elements = self._rank_top_k(page_elements, config, prompt_context)
        
        # Select top K elements
        selected_elements = ranked_elements[:config.k]
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Create result
        result = PageSlice(
            slice_strategy=config.strategy,
            k=config.k,
            total_elements=total_elements,
            elements=selected_elements,
            ranking_time_ms=processing_time,
            cache_hit=False
        )
        
        # Cache the result
        self._cache_ranking(cache_key, result)
        return result
    
    def _convert_to_page_element(self, raw_element: Dict[str, Any], index: int) -> PageElement:
        """Convert raw element data to PageElement model"""
        import logging
        logger = logging.getLogger(__name__)
        
        attributes = raw_element.get("attributes", {})
        
        # Handle both snake_case (Python) and camelCase (JavaScript) field names
        css_selector = (
            raw_element.get("css_selector") or 
            raw_element.get("cssSelector") or  # JavaScript extension format
            raw_element.get("selector")
        )
        
        xpath_selector = (
            raw_element.get("xpath") or
            raw_element.get("xpathSelector")  # Alternative format
        )
        
        text_content = (
            raw_element.get("text") or 
            raw_element.get("textContent") or  # JavaScript extension format
            raw_element.get("innerText")
        )
        
        is_interactive = bool(
            raw_element.get("isInteractive", False) or
            raw_element.get("is_interactive", False)
        )
        
        is_visible = bool(
            raw_element.get("isVisible", True) or
            raw_element.get("is_visible", True) or
            raw_element.get("visible", True)
        )
        
        tag = raw_element.get("tag", "div")
        
        # Log first few conversions to debug selector extraction
        if index < 5:
            logger.debug(f"🔄 Converting element {index}: tag={tag}, css={css_selector}, xpath={xpath_selector}, visible={is_visible}, interactive={is_interactive}, text='{(text_content or '')[:30]}'")
        
        return PageElement(
            element_id=f"el_{index}_{int(time.time()*1000)}",
            tag=tag,
            selector_css=css_selector,
            selector_xpath=xpath_selector,
            text=text_content,
            attributes=attributes,
            is_interactive=is_interactive,
            is_visible=is_visible,
            page_location=raw_element.get("position") or raw_element.get("bounds")
        )
    
    def _rank_top_k(
        self, 
        elements: List[PageElement], 
        config: ElementRankingConfig,
        prompt_context: Optional[str] = None
    ) -> List[PageElement]:
        """Simple top-K ranking based on element quality score"""
        
        # Calculate quality scores
        scored_elements = []
        for element in elements:
            score = self._calculate_quality_score(element, config)
            element.relevance_score = score
            scored_elements.append((element, score))
        
        # Sort by score descending
        scored_elements.sort(key=lambda x: x[1], reverse=True)
        
        return [element for element, _ in scored_elements]
    
    def _rank_by_relevance(
        self,
        elements: List[PageElement],
        config: ElementRankingConfig,
        prompt_context: Optional[str] = None
    ) -> List[PageElement]:
        """Rank elements by relevance to prompt context"""
        
        if not prompt_context:
            return self._rank_top_k(elements, config, prompt_context)
        
        prompt_lower = prompt_context.lower()
        scored_elements = []
        
        for element in elements:
            base_score = self._calculate_quality_score(element, config)
            context_score = self._calculate_context_relevance(element, prompt_lower)
            
            # Combine scores with 70% base quality, 30% context relevance
            final_score = (base_score * 0.7) + (context_score * 0.3)
            element.relevance_score = final_score
            
            scored_elements.append((element, final_score))
        
        # Sort by combined score
        scored_elements.sort(key=lambda x: x[1], reverse=True)
        
        return [element for element, _ in scored_elements]
    
    def _rank_heuristic_filter(
        self,
        elements: List[PageElement],
        config: ElementRankingConfig,
        prompt_context: Optional[str] = None
    ) -> List[PageElement]:
        """Apply heuristic filtering for stable, high-quality elements"""
        
        high_quality_elements = []
        
        for element in elements:
            if self._is_high_quality_element(element):
                score = self._calculate_quality_score(element, config)
                element.relevance_score = score
                high_quality_elements.append(element)
        
        # Sort by quality score
        high_quality_elements.sort(key=lambda x: x.relevance_score or 0, reverse=True)
        
        return high_quality_elements
    
    def _rank_hybrid(
        self,
        elements: List[PageElement], 
        config: ElementRankingConfig,
        prompt_context: Optional[str] = None
    ) -> List[PageElement]:
        """Hybrid ranking combining multiple strategies"""
        
        import logging
        logger = logging.getLogger(__name__)
        
        # First apply heuristic filtering
        high_quality = []
        filtered_out = []
        for element in elements:
            if self._is_high_quality_element(element):
                high_quality.append(element)
            else:
                filtered_out.append(element)
        
        logger.debug(f"🔍 Hybrid ranking: {len(high_quality)}/{len(elements)} elements passed quality filter")
        
        if filtered_out and len(filtered_out) <= 10:
            logger.debug(f"❌ Filtered out elements:")
            for el in filtered_out[:10]:
                logger.debug(f"   - {el.tag} | css={el.selector_css} | xpath={el.selector_xpath} | visible={el.is_visible} | text='{(el.text or '')[:30]}'")
        
        # IMPROVED: More adaptive fallback logic
        min_acceptable = max(config.k, 10)  # Need at least K elements or 10, whichever is higher
        
        if len(high_quality) >= min_acceptable:
            # Enough high-quality elements, use relevance ranking
            return self._rank_by_relevance(high_quality, config, prompt_context)
        elif len(high_quality) > 0:
            # Some high-quality elements but not enough - augment with best filtered elements
            logger.info(f"⚠️ Only {len(high_quality)} high-quality elements, augmenting with best filtered elements")
            # Score all filtered elements and add the best ones
            for el in filtered_out:
                el.relevance_score = self._calculate_quality_score(el, config)
            filtered_out.sort(key=lambda x: x.relevance_score or 0, reverse=True)
            
            # Add top filtered elements to reach minimum
            needed = min_acceptable - len(high_quality)
            high_quality.extend(filtered_out[:needed])
            logger.info(f"✅ Augmented to {len(high_quality)} elements total")
            
            return self._rank_by_relevance(high_quality, config, prompt_context)
        else:
            # No high-quality elements found - fallback to top-K on all elements
            logger.warning(f"⚠️ No high-quality elements found, falling back to top-K on all elements")
            return self._rank_top_k(elements, config, prompt_context)
    
    def _calculate_quality_score(self, element: PageElement, config: ElementRankingConfig) -> float:
        """Calculate element quality score based on multiple factors"""
        
        score = 0.0
        
        # Interactivity score
        if element.is_interactive:
            score += config.interactivity_weight
        
        # Visibility score
        if element.is_visible:
            score += config.visibility_weight
        
        # Text content score - but don't penalize form inputs without text
        if element.text and len(element.text.strip()) > 2:
            text_quality = min(len(element.text.strip()) / 50.0, 1.0)  # Normalize to 0-1
            score += config.text_content_weight * text_quality
        elif element.tag in ["input", "select", "textarea"]:
            # Form inputs often don't have text content, so give them baseline score
            score += config.text_content_weight * 0.3
        
        # Selector quality score
        selector_quality = self._calculate_selector_quality(element)
        score += config.selector_quality_weight * selector_quality
        
        return min(score, 1.0)  # Cap at 1.0
    
    def _calculate_context_relevance(self, element: PageElement, prompt_lower: str) -> float:
        """Calculate how relevant an element is to the prompt context"""
        
        relevance = 0.0
        
        # Check element text content
        if element.text:
            text_lower = element.text.lower()
            # Look for prompt keywords in element text
            prompt_words = set(prompt_lower.split())
            element_words = set(text_lower.split())
            overlap = len(prompt_words.intersection(element_words))
            if overlap > 0:
                relevance += min(overlap / len(prompt_words), 0.5)
        
        # Check element attributes
        attributes = element.attributes
        for attr_value in attributes.values():
            if isinstance(attr_value, str) and any(word in attr_value.lower() for word in prompt_lower.split()):
                relevance += 0.2
                break
        
        # Check selectors
        for selector in [element.selector_css, element.selector_xpath]:
            if selector and any(word in selector.lower() for word in prompt_lower.split()):
                relevance += 0.1
                break
        
        # Context-specific scoring
        if "login" in prompt_lower:
            if any(keyword in (element.text or "").lower() + str(attributes) for keyword in ["login", "signin", "email", "password", "username"]):
                relevance += 0.3
        
        if "search" in prompt_lower:
            if any(keyword in (element.text or "").lower() + str(attributes) for keyword in ["search", "find", "query"]):
                relevance += 0.3
        
        if "form" in prompt_lower or "submit" in prompt_lower:
            if element.tag in ["input", "textarea", "select", "button"] or "form" in str(attributes):
                relevance += 0.3
        
        # Flight booking context
        if any(keyword in prompt_lower for keyword in ["flight", "book", "booking", "reservation", "travel", "airport"]):
            element_context = (element.text or "").lower() + str(attributes).lower() + (element.selector_css or "").lower()
            
            # Boost flight search form inputs
            if any(keyword in element_context for keyword in [
                "origin", "departure", "depart", "from", "leaving",
                "destination", "arrival", "arrive", "to", "going",
                "date", "calendar", "when",
                "passenger", "traveler", "adult", "child", "senior",
                "class", "cabin", "fare",
                "oneway", "roundtrip", "one-way", "round-trip",
                "search", "find", "flights"
            ]):
                relevance += 0.4
            
            # Boost flight selection and purchase buttons
            if any(keyword in element_context for keyword in [
                "select", "choose", "book", "continue", "checkout",
                "purchase", "buy", "payment", "pay",
                "main", "basic", "premium", "first",  # Fare classes
                "card", "credit", "visa", "mastercard",
                "insurance", "coverage", "protection"
            ]):
                relevance += 0.3
        
        return min(relevance, 1.0)
    
    def _calculate_selector_quality(self, element: PageElement) -> float:
        """Calculate quality score for element selectors"""
        
        score = 0.0
        
        # Prefer elements with IDs (but not dynamic ones)
        element_id = element.attributes.get("id", "")
        if element_id and not self._is_dynamic_id(element_id):
            score += 0.4
            
            # Extra boost for semantic IDs commonly used in forms
            semantic_patterns = [
                "origin", "departure", "depart", "from", "leaving",
                "destination", "arrival", "arrive", "to", "going",
                "date", "calendar", "passenger", "traveler", "adult",
                "email", "username", "password", "firstname", "lastname",
                "phone", "address", "city", "state", "zip", "postal"
            ]
            if any(pattern in element_id.lower() for pattern in semantic_patterns):
                score += 0.2
        
        # Prefer elements with data-testid
        if element.attributes.get("data-testid"):
            score += 0.5
        
        # Prefer elements with stable names
        element_name = element.attributes.get("name", "")
        if element_name and not self._is_dynamic_id(element_name):
            score += 0.3
            
            # Extra boost for semantic names
            if any(pattern in element_name.lower() for pattern in [
                "origin", "destination", "departure", "arrival", "date",
                "passenger", "email", "username", "phone", "card"
            ]):
                score += 0.2
        
        # Check CSS selector quality
        if element.selector_css:
            if "#" in element.selector_css:  # Has ID
                score += 0.3
            elif "[data-testid" in element.selector_css:  # Has test ID
                score += 0.4
            elif "[name=" in element.selector_css:  # Has name
                score += 0.2
            else:
                score += 0.1  # Generic selector
        
        # Check for stable class names
        classes = element.attributes.get("class", "")
        if classes and not self._has_dynamic_classes(classes):
            score += 0.2
        
        return min(score, 1.0)
    
    def _is_high_quality_element(self, element: PageElement) -> bool:
        """Determine if element meets high-quality criteria"""
        
        # Must be visible
        if not element.is_visible:
            return False
        
        # Must have a reasonable selector
        if not element.selector_css and not element.selector_xpath:
            return False
        
        # Avoid problematic elements
        if self._is_problematic_element(element):
            return False
        
        # Check for stable identifiers
        element_id = element.attributes.get("id", "")
        has_stable_id = (
            element_id and not self._is_dynamic_id(element_id) or
            element.attributes.get("data-testid") or
            (element.attributes.get("name") and not self._is_dynamic_id(element.attributes["name"]))
        )
        
        # RELAXED: Accept interactive elements even without stable IDs
        # Modern web apps often use event handlers without semantic IDs
        if element.is_interactive:
            return True
        
        # RELAXED: Accept form elements (critical for workflows)
        if element.tag in ["input", "textarea", "select", "button"]:
            return True
        
        # RELAXED: Accept elements with meaningful text (lowered threshold from 10 to 2 chars)
        if element.text and len(element.text.strip()) > 2:
            return True
            
        # Navigation and link elements are important for testing
        if element.tag in ["a", "nav"]:
            return True
            
        # Headers and important containers
        if element.tag in ["h1", "h2", "h3", "h4", "h5", "h6"] and element.text:
            return True
            
        # Divs and spans with stable IDs or aria roles (common in modern frameworks)
        if element.tag in ["div", "span"]:
            has_aria = any(attr.startswith("aria-") for attr in element.attributes.keys())
            has_role = "role" in element.attributes
            if has_stable_id or has_aria or has_role:
                return True
        
        return False
    
    def _is_problematic_element(self, element: PageElement) -> bool:
        """Check if element should be avoided"""
        
        # Skip hidden accessibility elements
        classes = element.attributes.get("class", "")
        if any(hidden_class in classes.lower() for hidden_class in ["sr-only", "screen-reader", "visually-hidden"]):
            return True
        
        # Skip script/style elements
        if element.tag in ["script", "style", "meta", "link"]:
            return True
        
        # Skip elements with only dynamic IDs and no other identifiers
        element_id = element.attributes.get("id", "")
        if element_id and self._is_dynamic_id(element_id) and not element.text and not element.attributes.get("name"):
            return True
        
        return False
    
    def _is_dynamic_id(self, identifier: str) -> bool:
        """Check if an identifier appears to be dynamically generated"""
        
        if not identifier:
            return False
        
        # IMPROVED: More nuanced detection of truly dynamic IDs
        # Allow IDs with some numbers, only flag truly random ones
        
        # Extremely long alphanumeric strings (likely UUIDs or hashes)
        if len(identifier) > 30 and identifier.replace("-", "").replace("_", "").isalnum():
            return True
        
        # UUID pattern: 8-4-4-4-12 format
        import re
        if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', identifier.lower()):
            return True
        
        # Many dashes or underscores suggests generated ID
        if identifier.count("-") > 7 or identifier.count("_") > 7:
            return True
        
        # Mostly numbers (> 80% digits) but allow some numbers (like #user-123)
        digit_ratio = len([c for c in identifier if c.isdigit()]) / len(identifier) if len(identifier) > 0 else 0
        if digit_ratio > 0.8 and len(identifier) > 5:
            return True
        
        # Framework-specific patterns that are truly dynamic
        if any(pattern in identifier.lower() for pattern in [
            "react-", "mui-", "radix-", "headlessui-",  # Common framework prefixes
            "-auto-", "-generated-", "-random-"  # Explicit generated markers
        ]):
            return True
        
        return False
    
    def _has_dynamic_classes(self, class_string: str) -> bool:
        """Check if class string contains dynamic class names"""
        
        classes = class_string.split()
        dynamic_count = 0
        
        for cls in classes:
            if self._is_dynamic_id(cls):
                dynamic_count += 1
        
        # If more than half the classes are dynamic, consider it problematic
        return dynamic_count > len(classes) // 2
    
    def _generate_cache_key(
        self, 
        elements: List[Dict[str, Any]], 
        config: ElementRankingConfig,
        prompt_context: Optional[str] = None
    ) -> str:
        """Generate cache key for ranking results"""
        
        # Create a hash based on element signatures and config
        element_signatures = []
        for el in elements[:50]:  # Only use first 50 for cache key to avoid huge keys
            text_content = el.get('text', '') or ''  # Handle None values
            signature = f"{el.get('tag', '')}:{el.get('css_selector', '')}:{text_content[:20]}"
            element_signatures.append(signature)
        
        content = f"{config.strategy}:{config.k}:{''.join(element_signatures)}:{prompt_context or ''}"
        return hashlib.md5(content.encode()).hexdigest()[:16]
    
    def _get_cached_ranking(self, cache_key: str) -> Optional[PageSlice]:
        """Retrieve cached ranking result"""
        
        cache_entry = self.cache.get(cache_key)
        if cache_entry and not cache_entry.is_expired:
            cache_entry.hit_count += 1
            return cache_entry.value
        
        # Remove expired entry
        if cache_entry:
            del self.cache[cache_key]
        
        return None
    
    def _cache_ranking(self, cache_key: str, result: PageSlice):
        """Cache ranking result"""
        
        cache_entry = CacheEntry(
            key=cache_key,
            value=result,
            ttl_seconds=self.cache_ttl
        )
        
        self.cache[cache_key] = cache_entry
        
        # Simple cache cleanup - remove old entries if cache gets too large
        if len(self.cache) > 1000:
            self._cleanup_cache()
    
    def _cleanup_cache(self):
        """Remove expired cache entries"""
        
        expired_keys = [
            key for key, entry in self.cache.items() 
            if entry.is_expired
        ]
        
        for key in expired_keys:
            del self.cache[key]
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        
        total_entries = len(self.cache)
        total_hits = sum(entry.hit_count for entry in self.cache.values())
        
        return {
            "total_entries": total_entries,
            "total_hits": total_hits,
            "cache_size_bytes": sum(len(str(entry.value)) for entry in self.cache.values()),
            "oldest_entry": min((entry.created_at for entry in self.cache.values()), default=None),
            "avg_hits_per_entry": total_hits / total_entries if total_entries > 0 else 0
        }