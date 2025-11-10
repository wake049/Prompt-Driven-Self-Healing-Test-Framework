"""
 Page Context Service
Automatically detects and provides page context to help AI understand website types and testing strategies.
"""

import re
from typing import Dict, List, Optional
from urllib.parse import urlparse
from schemas.enterprise import PageContext

class PageContextService:
    """Service to automatically detect and provide page context information"""
    
    # Domain-based page type detection
    DOMAIN_PATTERNS = {
        'ecommerce': [
            'amazon.com', 'ebay.com', 'shopify.com', 'etsy.com', 'walmart.com',
            'target.com', 'bestbuy.com', 'alibaba.com', 'saucedemo.com'
        ],
        'airline': [
            'southwest.com', 'united.com', 'delta.com', 'americanairlines.com',
            'lufthansa.com', 'emirates.com', 'ryanair.com', 'jetblue.com'
        ],
        'banking': [
            'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citibank.com',
            'paypal.com', 'stripe.com', 'square.com'
        ],
        'news': [
            'cnn.com', 'bbc.com', 'reuters.com', 'nytimes.com', 'washingtonpost.com',
            'npr.org', 'bloomberg.com', 'techcrunch.com'
        ],
        'social': [
            'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com',
            'tiktok.com', 'reddit.com', 'pinterest.com'
        ],
        'search': [
            'google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com'
        ],
        'streaming': [
            'netflix.com', 'youtube.com', 'hulu.com', 'disney.com', 'prime.amazon.com'
        ]
    }
    
    # Element selector patterns for page type detection
    ELEMENT_PATTERNS = {
        'ecommerce': [
            'add-to-cart', 'shopping-cart', 'product', 'price', 'buy-now',
            'checkout', 'cart', 'wishlist', 'inventory'
        ],
        'airline': [
            'flight', 'departure', 'arrival', 'booking', 'passenger',
            'seat', 'baggage', 'checkin', 'itinerary'
        ],
        'banking': [
            'account', 'balance', 'transfer', 'payment', 'transaction',
            'login', 'secure', 'routing', 'deposit'
        ],
        'form': [
            'form', 'input', 'submit', 'field', 'validation',
            'required', 'register', 'signup', 'contact'
        ],
        'news': [
            'article', 'headline', 'author', 'publish', 'comment',
            'category', 'section', 'breaking', 'story'
        ]
    }
    
    # Primary actions by page type
    PRIMARY_ACTIONS = {
        'ecommerce': ['browse products', 'add to cart', 'checkout', 'search products', 'view details'],
        'airline': ['search flights', 'book flights', 'check-in', 'manage booking', 'select seats'],
        'banking': ['check balance', 'transfer funds', 'pay bills', 'view statements', 'secure login'],
        'form': ['fill fields', 'validate input', 'submit form', 'reset form', 'upload files'],
        'news': ['read articles', 'browse categories', 'search news', 'comment', 'share'],
        'social': ['post content', 'view feed', 'connect with users', 'message', 'like/react'],
        'search': ['enter query', 'view results', 'refine search', 'navigate results'],
        'streaming': ['search content', 'play video', 'manage playlist', 'browse catalog']
    }
    
    def detect_page_context(self, 
                           page_url: Optional[str] = None,
                           page_title: Optional[str] = None,
                           element_selectors: List[str] = None,
                           user_context: Optional[Dict] = None) -> PageContext:
        """
        Automatically detect page context from available information
        
        Args:
            page_url: URL of the page
            page_title: Title of the page
            element_selectors: List of element selectors found on page
            user_context: User-provided context hints
            
        Returns:
            PageContext with detected information
        """
        context = PageContext()
        
        # Extract domain from URL
        domain = None
        if page_url:
            try:
                parsed = urlparse(page_url)
                domain = parsed.netloc.lower()
                context.domain_name = domain
            except:
                pass
        
        # Detect page type from domain
        page_type = self._detect_page_type_from_domain(domain)
        if not page_type and element_selectors:
            page_type = self._detect_page_type_from_elements(element_selectors)
        
        context.page_type = page_type
        context.page_title = page_title
        
        # Set primary actions based on detected type
        if page_type and page_type in self.PRIMARY_ACTIONS:
            context.primary_actions = self.PRIMARY_ACTIONS[page_type]
        
        # Auto-generate description
        context.page_description = self._generate_page_description(page_type, domain, page_title)
        
        # Detect key elements
        if element_selectors:
            context.key_elements = self._detect_key_elements(page_type, element_selectors)
        
        # Apply user-provided context
        if user_context:
            self._apply_user_context(context, user_context)
            
        return context
    
    def _detect_page_type_from_domain(self, domain: Optional[str]) -> Optional[str]:
        """Detect page type based on domain name"""
        if not domain:
            return None
            
        for page_type, domains in self.DOMAIN_PATTERNS.items():
            for domain_pattern in domains:
                if domain_pattern in domain:
                    return page_type
        return None
    
    def _detect_page_type_from_elements(self, selectors: List[str]) -> Optional[str]:
        """Detect page type based on element selectors"""
        if not selectors:
            return None
            
        # Count pattern matches for each page type
        type_scores = {}
        all_selectors_text = ' '.join(selectors).lower()
        
        for page_type, patterns in self.ELEMENT_PATTERNS.items():
            score = 0
            for pattern in patterns:
                if pattern in all_selectors_text:
                    score += 1
            if score > 0:
                type_scores[page_type] = score
        
        # Return type with highest score
        if type_scores:
            return max(type_scores.items(), key=lambda x: x[1])[0]
        return None
    
    def _generate_page_description(self, 
                                  page_type: Optional[str], 
                                  domain: Optional[str], 
                                  page_title: Optional[str]) -> Optional[str]:
        """Generate a helpful page description"""
        descriptions = {
            'ecommerce': 'E-commerce website for browsing and purchasing products',
            'airline': 'Airline website for booking flights and managing travel',
            'banking': 'Banking website for financial transactions and account management',
            'form': 'Form-based page for data collection and submission',
            'news': 'News website for reading articles and staying informed',
            'social': 'Social media platform for connecting and sharing content',
            'search': 'Search engine for finding information and resources',
            'streaming': 'Streaming platform for watching videos and entertainment'
        }
        
        if page_type and page_type in descriptions:
            base_desc = descriptions[page_type]
            if domain:
                return f"{base_desc} ({domain})"
            return base_desc
        
        if domain:
            return f"Website: {domain}"
        
        return None
    
    def _detect_key_elements(self, page_type: Optional[str], selectors: List[str]) -> List[str]:
        """Detect key element types present on the page"""
        key_elements = []
        all_selectors = ' '.join(selectors).lower()
        
        # Common element patterns
        patterns = {
            'search-form': ['search', 'query', 'find'],
            'navigation-menu': ['nav', 'menu', 'header'],
            'product-grid': ['product', 'item', 'catalog'],
            'shopping-cart': ['cart', 'basket', 'checkout'],
            'user-form': ['form', 'input', 'field', 'submit'],
            'content-list': ['list', 'article', 'post'],
            'media-player': ['video', 'audio', 'player', 'play'],
            'modal-dialog': ['modal', 'popup', 'dialog'],
            'dropdown-menu': ['dropdown', 'select', 'option'],
            'pagination': ['page', 'next', 'prev', 'pagination']
        }
        
        for element_type, keywords in patterns.items():
            if any(keyword in all_selectors for keyword in keywords):
                key_elements.append(element_type)
        
        return key_elements
    
    def _apply_user_context(self, context: PageContext, user_context: Dict):
        """Apply user-provided context overrides"""
        if 'page_type' in user_context:
            context.page_type = user_context['page_type']
        if 'description' in user_context:
            context.page_description = user_context['description']
        if 'testing_focus' in user_context:
            context.testing_focus = user_context['testing_focus']
        if 'notes' in user_context:
            context.user_notes = user_context['notes']
        if 'primary_actions' in user_context:
            context.primary_actions = user_context['primary_actions']
    
    def create_context_from_url(self, url: str, **kwargs) -> PageContext:
        """Create page context from just a URL (convenience method)"""
        return self.detect_page_context(page_url=url, **kwargs)
    
    def create_manual_context(self, 
                             page_type: str,
                             description: str,
                             primary_actions: List[str],
                             testing_focus: Optional[str] = None,
                             **kwargs) -> PageContext:
        """Create manually specified page context"""
        return PageContext(
            page_type=page_type,
            page_description=description,
            primary_actions=primary_actions,
            testing_focus=testing_focus,
            **kwargs
        )

# Global instance for easy import
page_context_service = PageContextService()