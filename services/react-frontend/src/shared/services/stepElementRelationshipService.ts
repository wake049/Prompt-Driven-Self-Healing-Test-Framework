/**
 * Element-Step Relationship Management Service
 * 
 * Handles creating and managing relationships between prompt steps and elements
 * for runtime selector resolution by the policy engine.
 */
import { MCPFrontendManager } from '../../services/mcpFrontendClient';

const config = {
  apiBaseUrl: 'https://testhelix.com'
};

export interface StepElementReference {
  stepIndex: number;
  parameterKey: string;
  selectorValue: string;
  elementId?: string;
  selectorType?: 'css' | 'xpath' | 'auto';
}

export interface ElementLookupResult {
  elementId: string;
  elementKey: string;
  confidence: number;
  matchType: 'exact' | 'partial' | 'fuzzy';
}

class StepElementRelationshipService {
  
  /**
   * Extract element references from test steps
   */
  extractElementReferences(steps: any[]): StepElementReference[] {
    const references: StepElementReference[] = [];
    const selectorKeys = ['selector', 'elementId', 'target', 'locator', 'element', 'css_selector', 'xpath'];
    
    steps.forEach((step, stepIndex) => {
      const params = step.params || {};
      
      for (const key of selectorKeys) {
        const value = params[key];
        if (value && typeof value === 'string' && value.trim()) {
          const selectorType = this.detectSelectorType(value);
          references.push({
            stepIndex,
            parameterKey: key,
            selectorValue: value.trim(),
            selectorType
          });
        }
      }
    });
    
    return references;
  }
  
  /**
   * Detect selector type from value
   */
  private detectSelectorType(selector: string): 'css' | 'xpath' | 'auto' {
    if (selector.startsWith('//') || selector.startsWith('(//')) {
      return 'xpath';
    }
    if (selector.startsWith('#') || selector.startsWith('.') || selector.includes('[') || selector.includes(':')) {
      return 'css';
    }
    return 'auto';
  }
  
  /**
   * Find matching elements for a selector
   */
  async findMatchingElements(selector: string): Promise<ElementLookupResult[]> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiBaseUrl}/api/v1/elements/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          selector: selector,
          maxResults: 10
        }),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.matches || [];
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Save step-element relationships to database
   */
  async saveStepElementRelationships(
    promptId: string,
    planId: string,
    references: StepElementReference[]
  ): Promise<void> {
      // First, try to resolve element IDs for selectors
      const enrichedReferences = await Promise.all(
        references.map(async (ref) => {
          if (!ref.elementId) {
            const matches = await this.findMatchingElements(ref.selectorValue);
            if (matches.length > 0) {
              // Use the best match (highest confidence)
              const bestMatch = matches.reduce((best, current) => 
                current.confidence > best.confidence ? current : best
              );
              ref.elementId = bestMatch.elementId;
            }
          }
          return ref;
        })
      );
      
      // Save relationships to database
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiBaseUrl}/api/v1/prompt-step-elements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          promptId,
          planId,
          relationships: enrichedReferences.filter(ref => ref.elementId) // Only save those with resolved element IDs
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save step-element relationships: ${response.statusText}`);
      }
      
      
      // Log unresolved selectors for debugging
      const unresolved = enrichedReferences.filter(ref => !ref.elementId);
  }
  
  /**
   * Get step-element relationships for a prompt
   */
  async getStepElementRelationships(promptId: string): Promise<any[]> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiBaseUrl}/api/v1/prompt-step-elements/${promptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.relationships || [];
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Delete existing relationships for a prompt (for cleanup before saving new ones)
   */
  async deleteStepElementRelationships(promptId: string): Promise<void> {
      const token = localStorage.getItem('auth_token');
      await fetch(`${config.apiBaseUrl}/api/v1/prompt-step-elements/${promptId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
  }
}

// Create singleton instance
export const stepElementRelationshipService = new StepElementRelationshipService();

// Expose to global window for debugging
if (typeof window !== 'undefined') {
  (window as any).stepElementRelationshipService = stepElementRelationshipService;
}