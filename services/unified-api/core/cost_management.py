"""
 Enterprise Cost Management Service
Implements token counting, budget tracking, and cost optimization features.

Features:
- Token counting for input/output
- Daily budget tracking per tenant
- Cost estimation for different models
- Payload optimization recommendations
- Usage analytics and reporting
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict

from schemas.enterprise import CostSummary, TenantConfig, PromptEnvelope

class CostManagementService:
    """Service for tracking costs and managing AI usage budgets"""
    
    def __init__(self):
        self.usage_tracker: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            'daily_tokens': 0,
            'daily_requests': 0,
            'total_cost_usd': 0.0,
            'last_reset': datetime.utcnow().date(),
            'monthly_tokens': 0,
            'request_history': []
        })
        
        # Model pricing (tokens per $1 USD)
        self.model_pricing = {
            'gpt-4o': {'input': 2.50, 'output': 10.0},  # per 1K tokens (prices in USD/1K)
            'gpt-4o-mini': {'input': 0.15, 'output': 0.60},
            'gpt-4': {'input': 30.0, 'output': 60.0},
            'gpt-3.5-turbo': {'input': 0.50, 'output': 1.50}
        }
    
    def estimate_cost(
        self,
        prompt_envelope: PromptEnvelope,
        model: str = "gpt-4o"
    ) -> Tuple[int, float]:
        """
        Estimate token usage and cost for a request.
        
        Args:
            prompt_envelope: The request envelope
            model: AI model to use
            
        Returns:
            Tuple of (estimated_tokens, estimated_cost_usd)
        """
        
        # Estimate input tokens
        input_tokens = self._estimate_input_tokens(prompt_envelope)
        
        # Estimate output tokens (typically 10-20% of input for planning tasks)
        output_tokens = max(50, int(input_tokens * 0.15))
        
        total_tokens = input_tokens + output_tokens
        
        # Calculate cost
        cost_usd = self._calculate_cost(input_tokens, output_tokens, model)
        return total_tokens, cost_usd
    
    def track_usage(
        self,
        tenant_id: str,
        input_tokens: int,
        output_tokens: int,
        model: str,
        processing_time_ms: int,
        cache_hits: int = 0
    ) -> CostSummary:
        """
        Track actual usage and update budgets.
        
        Args:
            tenant_id: Tenant identifier
            input_tokens: Actual input tokens used
            output_tokens: Actual output tokens used
            model: Model used
            processing_time_ms: Processing time
            cache_hits: Number of cache hits
            
        Returns:
            CostSummary with usage details
        """
        
        tenant_usage = self.usage_tracker[tenant_id]
        
        # Reset daily counters if needed
        self._reset_daily_counters_if_needed(tenant_id)
        
        # Calculate cost
        cost_usd = self._calculate_cost(input_tokens, output_tokens, model)
        total_tokens = input_tokens + output_tokens
        
        # Update usage tracking
        tenant_usage['daily_tokens'] += total_tokens
        tenant_usage['daily_requests'] += 1
        tenant_usage['total_cost_usd'] += cost_usd
        tenant_usage['monthly_tokens'] += total_tokens
        
        # Add to request history (keep last 100)
        request_record = {
            'timestamp': datetime.utcnow(),
            'tokens': total_tokens,
            'cost_usd': cost_usd,
            'model': model,
            'processing_time_ms': processing_time_ms,
            'cache_hits': cache_hits
        }
        
        tenant_usage['request_history'].append(request_record)
        if len(tenant_usage['request_history']) > 100:
            tenant_usage['request_history'] = tenant_usage['request_history'][-100:]
        
        # Get remaining budget
        daily_budget_remaining = self._get_remaining_daily_budget(tenant_id)
        
        # Create cost summary
        cost_summary = CostSummary(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            cost_usd=cost_usd,
            elements_processed=0,  # Will be set by caller
            cache_hits=cache_hits,
            daily_tokens_used=tenant_usage['daily_tokens'],
            daily_budget_remaining=daily_budget_remaining
        )
        return cost_summary
    
    def check_budget(self, tenant_id: str, estimated_tokens: int) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if tenant has sufficient budget for estimated usage.
        
        Args:
            tenant_id: Tenant identifier
            estimated_tokens: Estimated tokens for the request
            
        Returns:
            Tuple of (can_proceed, budget_info)
        """
        
        tenant_usage = self.usage_tracker[tenant_id]
        self._reset_daily_counters_if_needed(tenant_id)
        
        # Get tenant config (would typically come from database)
        tenant_config = self._get_tenant_config(tenant_id)
        
        daily_used = tenant_usage['daily_tokens']
        daily_limit = tenant_config.max_tokens_per_day
        remaining = daily_limit - daily_used
        
        can_proceed = remaining >= estimated_tokens
        
        budget_info = {
            'daily_used': daily_used,
            'daily_limit': daily_limit,
            'daily_remaining': remaining,
            'estimated_tokens': estimated_tokens,
            'will_exceed': not can_proceed,
            'usage_percentage': (daily_used / daily_limit) * 100 if daily_limit > 0 else 0
        }
        
        if not can_proceed:return can_proceed, budget_info
    
    def optimize_payload(self, prompt_envelope: PromptEnvelope) -> Dict[str, Any]:
        """
        Analyze payload and suggest optimizations to reduce token usage.
        
        Args:
            prompt_envelope: Request to analyze
            
        Returns:
            Dictionary with optimization suggestions
        """
        
        suggestions = []
        potential_savings = 0
        
        # Check prompt length
        prompt_tokens = self._estimate_prompt_tokens(prompt_envelope.prompt)
        if prompt_tokens > 500:
            suggestions.append({
                'type': 'prompt_length',
                'message': f'Prompt is {prompt_tokens} tokens. Consider shortening for cost efficiency.',
                'potential_savings': max(0, prompt_tokens - 300)
            })
            potential_savings += max(0, prompt_tokens - 300)
        
        # Check element count
        if prompt_envelope.page_slice and len(prompt_envelope.page_slice.elements) > 50:
            element_count = len(prompt_envelope.page_slice.elements)
            element_tokens = element_count * 20  # Estimate 20 tokens per element
            optimized_tokens = 50 * 20
            
            suggestions.append({
                'type': 'element_count',
                'message': f'{element_count} elements provided. Consider reducing to top 50 most relevant.',
                'potential_savings': element_tokens - optimized_tokens
            })
            potential_savings += element_tokens - optimized_tokens
        
        # Check max_steps setting
        if prompt_envelope.max_steps > 20:
            suggestions.append({
                'type': 'max_steps',
                'message': f'max_steps is {prompt_envelope.max_steps}. Consider reducing to 20 or fewer.',
                'potential_savings': (prompt_envelope.max_steps - 20) * 5
            })
            potential_savings += (prompt_envelope.max_steps - 20) * 5
        
        # Check for unnecessary features
        if prompt_envelope.include_screenshots:
            suggestions.append({
                'type': 'screenshots',
                'message': 'Screenshots enabled. Disable if not needed to save tokens.',
                'potential_savings': 50
            })
            potential_savings += 50
        
        return {
            'suggestions': suggestions,
            'potential_token_savings': potential_savings,
            'current_estimated_tokens': self._estimate_input_tokens(prompt_envelope),
            'optimized_estimated_tokens': max(100, self._estimate_input_tokens(prompt_envelope) - potential_savings)
        }
    
    def get_usage_analytics(self, tenant_id: str) -> Dict[str, Any]:
        """Get usage analytics for a tenant"""
        
        tenant_usage = self.usage_tracker[tenant_id]
        self._reset_daily_counters_if_needed(tenant_id)
        
        # Calculate recent request statistics
        recent_requests = [
            req for req in tenant_usage['request_history']
            if (datetime.utcnow() - req['timestamp']).days < 7
        ]
        
        avg_tokens_per_request = (
            sum(req['tokens'] for req in recent_requests) / len(recent_requests)
            if recent_requests else 0
        )
        
        avg_cost_per_request = (
            sum(req['cost_usd'] for req in recent_requests) / len(recent_requests)
            if recent_requests else 0
        )
        
        avg_processing_time = (
            sum(req['processing_time_ms'] for req in recent_requests) / len(recent_requests)
            if recent_requests else 0
        )
        
        # Model usage distribution
        model_usage = defaultdict(int)
        for req in recent_requests:
            model_usage[req['model']] += 1
        
        return {
            'daily_usage': {
                'tokens_used': tenant_usage['daily_tokens'],
                'requests_made': tenant_usage['daily_requests'],
                'total_cost_usd': tenant_usage['total_cost_usd']
            },
            'monthly_usage': {
                'tokens_used': tenant_usage['monthly_tokens']
            },
            'recent_averages': {
                'tokens_per_request': round(avg_tokens_per_request, 1),
                'cost_per_request_usd': round(avg_cost_per_request, 4),
                'processing_time_ms': round(avg_processing_time, 1)
            },
            'model_distribution': dict(model_usage),
            'request_count_last_7_days': len(recent_requests),
            'efficiency_metrics': {
                'cache_hit_rate': self._calculate_cache_hit_rate(recent_requests),
                'cost_per_token': tenant_usage['total_cost_usd'] / max(1, tenant_usage['monthly_tokens'])
            }
        }
    
    def _estimate_input_tokens(self, prompt_envelope: PromptEnvelope) -> int:
        """Estimate input tokens for a prompt envelope"""
        
        # Base prompt tokens
        prompt_tokens = self._estimate_prompt_tokens(prompt_envelope.prompt)
        
        # System prompt overhead
        system_tokens = 200
        
        # Element tokens
        element_tokens = 0
        if prompt_envelope.page_slice:
            # Estimate ~20 tokens per element (tag, selector, text)
            element_tokens = len(prompt_envelope.page_slice.elements) * 20
        
        # Action catalog tokens
        catalog_tokens = 0
        for catalog_ref in prompt_envelope.catalog_refs:
            # Estimate ~50 tokens per action in catalog
            catalog_tokens += 300  # Assume ~6 actions per catalog
        
        # Additional context tokens
        context_tokens = 100  # For instructions, formatting, etc.
        
        total_tokens = prompt_tokens + system_tokens + element_tokens + catalog_tokens + context_tokens
        
        return total_tokens
    
    def _estimate_prompt_tokens(self, prompt: str) -> int:
        """Estimate tokens in a text prompt (rough approximation)"""
        # Rough approximation: 4 characters per token on average
        return max(10, len(prompt) // 4)
    
    def _calculate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float:
        """Calculate cost based on token usage and model pricing"""
        
        pricing = self.model_pricing.get(model, self.model_pricing['gpt-4o'])
        
        input_cost = (input_tokens / 1000) * (pricing['input'] / 1000)
        output_cost = (output_tokens / 1000) * (pricing['output'] / 1000)
        
        return input_cost + output_cost
    
    def _get_tenant_config(self, tenant_id: str) -> TenantConfig:
        """Get tenant configuration (would typically come from database)"""
        
        # Default configuration for demo
        return TenantConfig(
            tenant_id=tenant_id,
            max_tokens_per_day=100000,
            preferred_model="gpt-4o",
            enable_caching=True,
            enable_compression=True
        )
    
    def _get_remaining_daily_budget(self, tenant_id: str) -> int:
        """Get remaining daily token budget for tenant"""
        
        tenant_usage = self.usage_tracker[tenant_id]
        tenant_config = self._get_tenant_config(tenant_id)
        
        return max(0, tenant_config.max_tokens_per_day - tenant_usage['daily_tokens'])
    
    def _reset_daily_counters_if_needed(self, tenant_id: str):
        """Reset daily counters if it's a new day"""
        
        tenant_usage = self.usage_tracker[tenant_id]
        today = datetime.utcnow().date()
        
        if tenant_usage['last_reset'] < today:
            tenant_usage['daily_tokens'] = 0
            tenant_usage['daily_requests'] = 0
            tenant_usage['last_reset'] = today
    def _calculate_cache_hit_rate(self, requests: List[Dict[str, Any]]) -> float:
        """Calculate cache hit rate from recent requests"""
        
        if not requests:
            return 0.0
        
        total_cache_hits = sum(req.get('cache_hits', 0) for req in requests)
        total_requests = len(requests)
        
        return (total_cache_hits / total_requests) * 100 if total_requests > 0 else 0.0