"""
 Enterprise AI Service - Usage Examples and Integration Guide

This module demonstrates how to use the new Enterprise AI Service that implements
the Prompt/Actions/Elements contract with cost-effective and enterprise-ready features.

Example Usage:
- Request processing with tenant separation
- Cost tracking and budget management  
- Element ranking and optimization
- ETag caching for catalogs
- Response compression
"""

import asyncio
import json
from datetime import datetime
from typing import Dict, Any, List

# Example usage of the Enterprise AI Service
async def example_basic_plan_request():
    """
    Example of a basic /v1/plan request following the contract specification.
    
    This shows the minimal request structure and expected response format.
    """
    
    # Example input matching the specification
    request_example = {
        "prompt": "Login as a loyalty member and book a one-way flight to DAL next Friday.",
        "tenantId": "acme-co",
        "catalogRefs": [{"catalogId": "actions.v3", "version": "3.4.2"}],
        "pageSlice": {
            "sliceStrategy": "topK", 
            "k": 100, 
            "totalElements": 150,
            "elements": [
                {
                    "element_id": "el_1132",
                    "tag": "input",
                    "selector_css": "input[name='username']",
                    "text": "",
                    "attributes": {"name": "username", "type": "email"},
                    "is_interactive": True,
                    "is_visible": True
                },
                {
                    "element_id": "el_1140", 
                    "tag": "button",
                    "selector_css": "button[type='submit']",
                    "text": "Sign In",
                    "attributes": {"type": "submit", "class": "btn btn-primary"},
                    "is_interactive": True,
                    "is_visible": True
                }
            ]
        }
    }
    
    # Expected output matching the specification
    expected_response = {
        "steps": [
            {"action": "type", "target": "el_1132", "args": {"text": "{credential.username}"}},
            {"action": "click", "target": "el_1140"}
        ],
        "clarifications": [],
        "used": {"elementsConsidered": 38},
        "costSummary": {"inputTokens": 2100, "outputTokens": 250}
    }
    
    print(" Basic Plan Request Example:")
    print("Request:", json.dumps(request_example, indent=2))
    print("\nExpected Response:", json.dumps(expected_response, indent=2))


async def example_enterprise_features():
    """
    Example showcasing enterprise features like cost tracking, caching, and optimization.
    """
    
    print("\n🏢 Enterprise Features Examples:")
    
    # 1. Cost-optimized request with element ranking
    cost_optimized_request = {
        "prompt": "Verify all products are displayed correctly on the inventory page",
        "tenantId": "enterprise-client",
        "runId": "test-run-12345",
        "catalogRefs": [{"catalogId": "actions.v3", "version": "3.4.2"}],
        "pageSlice": {
            "sliceStrategy": "hybrid",  # Uses intelligent ranking
            "k": 50,  # Limit to top 50 elements for cost efficiency
            "totalElements": 500,  # Original page had 500 elements
            "elements": []  # Would contain ranked elements
        },
        "maxSteps": 15,  # Reasonable limit
        "includeScreenshots": False,  # Disabled to save tokens
        "priority": "normal",
        "timeout_ms": 30000
    }
    
    # 2. ETag caching example for action catalogs
    catalog_request_headers = {
        "If-None-Match": '"a1b2c3d4-1234567890"',  # Previous ETag
        "X-Tenant-ID": "enterprise-client"
    }
    
    # Expected 304 Not Modified response
    cache_response = {
        "status_code": 304,
        "headers": {
            "ETag": '"a1b2c3d4-1234567890"',
            "Cache-Control": "public, max-age=86400"
        }
    }
    
    # 3. Budget management example
    budget_exceeded_response = {
        "steps": [],
        "clarifications": [
            {
                "type": "budget_exceeded",
                "message": "Daily token budget exceeded. Used: 95000, Limit: 100000",
                "required": True
            }
        ],
        "costSummary": {
            "daily_tokens_used": 95000,
            "daily_budget_remaining": 5000
        },
        "method": "budget_check_failed"
    }
    
    print("Cost-Optimized Request:", json.dumps(cost_optimized_request, indent=2))
    print("\nETag Headers:", json.dumps(catalog_request_headers, indent=2))
    print("\nBudget Response:", json.dumps(budget_exceeded_response, indent=2))


async def example_element_ranking_strategies():
    """
    Example of different element ranking strategies for payload optimization.
    """
    
    print("\n Element Ranking Strategy Examples:")
    
    # Raw elements from a complex page
    raw_elements = [
        {"tag": "input", "text": "", "attributes": {"name": "username", "type": "email"}, "isInteractive": True},
        {"tag": "input", "text": "", "attributes": {"name": "password", "type": "password"}, "isInteractive": True},
        {"tag": "button", "text": "Sign In", "attributes": {"type": "submit"}, "isInteractive": True},
        {"tag": "div", "text": "Welcome to our site", "attributes": {"class": "banner"}, "isInteractive": False},
        {"tag": "img", "text": "", "attributes": {"src": "logo.png", "alt": "Company Logo"}, "isInteractive": False},
        # ... many more elements (in real scenario, 100s-1000s)
    ]
    
    # Strategy 1: Top-K selection (simple ranking by quality score)
    topk_config = {
        "strategy": "topK",
        "k": 20,
        "interactivity_weight": 0.4,
        "visibility_weight": 0.3,
        "text_content_weight": 0.2,
        "selector_quality_weight": 0.1
    }
    
    # Strategy 2: Relevance-based ranking (context-aware)
    relevance_config = {
        "strategy": "relevanceScore", 
        "k": 25,
        "prompt_context": "login as user",
        "context_weight": 0.3
    }
    
    # Strategy 3: Heuristic filtering (stable selectors only)
    heuristic_config = {
        "strategy": "heuristicFilter",
        "k": 15,
        "require_stable_selectors": True,
        "exclude_dynamic_ids": True
    }
    
    # Strategy 4: Hybrid approach (combines multiple strategies)
    hybrid_config = {
        "strategy": "hybrid",
        "k": 30,
        "heuristic_weight": 0.6,
        "relevance_weight": 0.4
    }
    
    strategies = {
        "Top-K Selection": topk_config,
        "Relevance-Based": relevance_config, 
        "Heuristic Filter": heuristic_config,
        "Hybrid Approach": hybrid_config
    }
    
    for name, config in strategies.items():
        print(f"\n{name}:")
        print(json.dumps(config, indent=2))


async def example_cost_optimization():
    """
    Example of cost optimization techniques and payload minimization.
    """
    
    print("\n💰 Cost Optimization Examples:")
    
    # Before optimization - verbose request
    verbose_request = {
        "prompt": "Test the login functionality thoroughly and verify all elements work correctly and take screenshots of every step and check all possible edge cases and error conditions",
        "tenantId": "demo-client",
        "pageSlice": {
            "sliceStrategy": "topK",
            "k": 200,  # Too many elements
            "elements": []  # Would contain 200 elements with full metadata
        },
        "maxSteps": 50,  # Too many steps
        "includeScreenshots": True,  # Expensive
        "includeAssertions": True
    }
    
    # After optimization - minimal request
    optimized_request = {
        "prompt": "Login with test credentials",  # Concise and clear
        "tenantId": "demo-client", 
        "pageSlice": {
            "sliceStrategy": "hybrid",
            "k": 20,  # Reduced to essentials
            "elements": []  # Top 20 most relevant elements only
        },
        "maxSteps": 10,  # Reasonable limit
        "includeScreenshots": False,  # Disabled to save tokens
        "includeAssertions": True  # Keep for quality
    }
    
    # Cost analysis
    cost_analysis = {
        "verbose_request": {
            "estimated_input_tokens": 3500,
            "estimated_output_tokens": 800,
            "estimated_cost_usd": 0.042,
            "processing_time_estimate_ms": 8000
        },
        "optimized_request": {
            "estimated_input_tokens": 800,
            "estimated_output_tokens": 200,
            "estimated_cost_usd": 0.009,
            "processing_time_estimate_ms": 2000,
            "savings_percent": 78.6
        }
    }
    
    print("Verbose Request:", json.dumps(verbose_request, indent=2))
    print("\nOptimized Request:", json.dumps(optimized_request, indent=2))
    print("\nCost Analysis:", json.dumps(cost_analysis, indent=2))


async def example_integration_patterns():
    """
    Example integration patterns for different use cases.
    """
    
    print("\n Integration Patterns:")
    
    # Pattern 1: High-volume testing (batch processing)
    batch_config = {
        "use_case": "CI/CD Pipeline Testing",
        "request_pattern": {
            "enable_caching": True,
            "compress_responses": True,
            "batch_size": 10,
            "priority": "low",  # Background processing
            "timeout_ms": 15000  # Shorter timeout for batch
        },
        "optimization": {
            "reuse_element_rankings": True,
            "cache_catalog_responses": True,
            "limit_elements_per_request": 30
        }
    }
    
    # Pattern 2: Interactive development (fast feedback)
    interactive_config = {
        "use_case": "Developer Testing",
        "request_pattern": {
            "enable_caching": True,
            "compress_responses": False,  # Faster decompression
            "priority": "high",
            "timeout_ms": 10000  # Fast response needed
        },
        "optimization": {
            "prefer_heuristic_fallback": True,  # Faster than AI
            "limit_max_steps": 15,
            "include_debug_info": True
        }
    }
    
    # Pattern 3: Enterprise production (reliability focus)
    production_config = {
        "use_case": "Production Test Automation",
        "request_pattern": {
            "enable_caching": True,
            "compress_responses": True,
            "priority": "normal",
            "timeout_ms": 45000,  # Allow more time for quality
            "retry_policy": {"max_retries": 3, "backoff_ms": 1000}
        },
        "optimization": {
            "prefer_ai_generation": True,  # Higher quality
            "include_cost_tracking": True,
            "enable_budget_controls": True
        }
    }
    
    patterns = {
        "Batch Processing": batch_config,
        "Interactive Development": interactive_config,
        "Production Automation": production_config
    }
    
    for name, config in patterns.items():
        print(f"\n{name}:")
        print(json.dumps(config, indent=2))


async def example_error_handling():
    """
    Example error handling and response patterns.
    """
    
    print("\n🚨 Error Handling Examples:")
    
    # Budget exceeded error
    budget_error = {
        "steps": [],
        "clarifications": [
            {
                "clarification_id": "budget_001",
                "type": "budget_exceeded",
                "message": "Daily token budget of 100,000 tokens exceeded (used: 102,450)",
                "suggestions": [
                    "Upgrade to higher tier",
                    "Wait until tomorrow",
                    "Optimize request to use fewer tokens"
                ],
                "required": True
            }
        ],
        "cost_summary": {
            "daily_tokens_used": 102450,
            "daily_budget_remaining": 0,
            "daily_budget_exceeded_by": 2450
        },
        "method": "budget_check_failed"
    }
    
    # Missing elements clarification
    elements_clarification = {
        "steps": [
            {"action": "open_url", "args": {"url": "https://example.com"}},
        ],
        "clarifications": [
            {
                "clarification_id": "elements_001",
                "type": "insufficient_elements",
                "message": "No login elements found on page. Please provide page elements or specify the login URL.",
                "suggestions": [
                    "Navigate to login page first",
                    "Provide page elements in pageSlice",
                    "Update prompt to be more specific"
                ],
                "required": False
            }
        ],
        "used": {"elementsConsidered": 0},
        "method": "heuristic-fallback"
    }
    
    # Generation error with fallback
    generation_error = {
        "steps": [],
        "clarifications": [
            {
                "clarification_id": "gen_001", 
                "type": "generation_error",
                "message": "AI service temporarily unavailable. Falling back to heuristic generation.",
                "required": False
            }
        ],
        "cost_summary": {
            "input_tokens": 0,
            "output_tokens": 0,
            "fallback_used": True
        },
        "method": "error_with_fallback"
    }
    
    errors = {
        "Budget Exceeded": budget_error,
        "Missing Elements": elements_clarification,
        "Service Error": generation_error
    }
    
    for name, error in errors.items():
        print(f"\n{name}:")
        print(json.dumps(error, indent=2))


# Main demonstration function
async def run_all_examples():
    """Run all examples to demonstrate the enterprise AI service capabilities."""
    
    print(" Enterprise AI Service - Usage Examples")
    print("=" * 60)
    
    await example_basic_plan_request()
    await example_enterprise_features() 
    await example_element_ranking_strategies()
    await example_cost_optimization()
    await example_integration_patterns()
    await example_error_handling()
    
    print("\n" + "=" * 60)
    print(" All examples completed!")
    print("\nKey Benefits:")
    print("• 🏢 Enterprise-ready with tenant separation and budget controls")
    print("• 💰 Cost-effective with intelligent element ranking and token optimization")
    print("•  Scalable with ETag caching and compression support")
    print("•  Developer-friendly with clear contracts and error handling")
    print("• 🔄 Backward compatible with existing integrations")


if __name__ == "__main__":
    asyncio.run(run_all_examples())