/**
 * Selector Policy Service
 * 
 * Manages runtime application of CSS vs XPath selector policies
 * Handles dual-selector storage and policy-based selection
 */
import { http } from '../api';
interface SelectorPolicy {
  preferCssOverXpath: boolean;
  allowFallback: boolean;
  logSelectionDecisions: boolean;
}
interface DualSelector {
  css_selector?: string;
  xpath_selector?: string;
  preferred_selector?: string;
  fallback_selector?: string;
}
interface PolicyBasedSelection {
  selectedSelector: string;
  selectorType: 'css' | 'xpath';
  reasoning: string;
  fallbackAvailable: boolean;
}
class SelectorPolicyService {
  private currentPolicy: SelectorPolicy | null = null;
  /**
   * Load the current selector policy from the backend
   */
  async loadPolicy(): Promise<SelectorPolicy> {
    try {
      const response = await http<any>('/api/v1/policy/dashboard/config');
      if (response?.success && response?.data?.locatorHealing) {
        this.currentPolicy = {
          preferCssOverXpath: response.data.locatorHealing.preferCssOverXpath ?? true,
          allowFallback: response.data.locatorHealing.useRepositoryFallback ?? true,
          logSelectionDecisions: response.data.auditReview?.logAllDecisions ?? false
        };
      } else {
        // Default policy
        this.currentPolicy = {
          preferCssOverXpath: true,
          allowFallback: true,
          logSelectionDecisions: false
        };
      }
      return this.currentPolicy;
    } catch (error) {
      this.currentPolicy = {
        preferCssOverXpath: true,
        allowFallback: true,
        logSelectionDecisions: false
      };
      return this.currentPolicy;
    }
  }
  /**
   * Apply policy to select the best selector from available options
   */
  async selectSelector(selectors: DualSelector, context?: {
    promptId?: string;
    stepIndex?: number;
    action?: string;
  }): Promise<PolicyBasedSelection> {
    // Ensure policy is loaded
    if (!this.currentPolicy) {
      await this.loadPolicy();
    }
    const policy = this.currentPolicy!;
    const cssSelector = selectors.css_selector;
    const xpathSelector = selectors.xpath_selector;
    // Determine preferred and fallback selectors
    let selectedSelector: string;
    let selectorType: 'css' | 'xpath';
    let reasoning: string;
    let fallbackAvailable = false;
    if (policy.preferCssOverXpath) {
      // Prefer CSS selector
      if (cssSelector) {
        selectedSelector = cssSelector;
        selectorType = 'css';
        reasoning = 'CSS selector preferred by policy';
        fallbackAvailable = !!xpathSelector;
      } else if (xpathSelector) {
        selectedSelector = xpathSelector;
        selectorType = 'xpath';
        reasoning = 'XPath used as CSS not available';
        fallbackAvailable = false;
      } else {
        throw new Error('No selectors available for element');
      }
    } else {
      // Prefer XPath selector
      if (xpathSelector) {
        selectedSelector = xpathSelector;
        selectorType = 'xpath';
        reasoning = 'XPath selector preferred by policy';
        fallbackAvailable = !!cssSelector;
      } else if (cssSelector) {
        selectedSelector = cssSelector;
        selectorType = 'css';
        reasoning = 'CSS used as XPath not available';
        fallbackAvailable = false;
      } else {
        throw new Error('No selectors available for element');
      }
    }
    const result: PolicyBasedSelection = {
      selectedSelector,
      selectorType,
      reasoning,
      fallbackAvailable
    };
    // Log decision if policy requires it
    if (policy.logSelectionDecisions && context) {
      // Could also send to backend for audit logging
      this.logSelectionDecision(context, result, selectors).catch(console.error);
    }
    return result;
  }
  /**
   * Get fallback selector if primary fails
   */
  getFallbackSelector(selectors: DualSelector, primaryType: 'css' | 'xpath'): string | null {
    if (!this.currentPolicy?.allowFallback) {
      return null;
    }
    if (primaryType === 'css') {
      return selectors.xpath_selector || null;
    } else {
      return selectors.css_selector || null;
    }
  }
  /**
   * Convert single selector to dual selector format
   */
  convertToDualSelector(singleSelector: string): DualSelector {
    // Simple heuristic to determine selector type
    if (singleSelector.startsWith('//') || singleSelector.includes('[@')) {
      // Likely XPath
      return {
        xpath_selector: singleSelector,
        css_selector: undefined
      };
    } else {
      // Likely CSS
      return {
        css_selector: singleSelector,
        xpath_selector: undefined
      };
    }
  }
  /**
   * Update a prompt step to use dual selector format
   */
  async upgradePromptStepToDualSelector(
    promptId: string, 
    stepIndex: number, 
    currentSelector: string,
    newDualSelector: DualSelector
  ): Promise<void> {
    try {
      // Call backend API to update the step
      await http(`/api/v1/prompts/${promptId}/steps/${stepIndex}/selectors`, {
        method: 'PUT',
        body: JSON.stringify({
          css_selector: newDualSelector.css_selector,
          xpath_selector: newDualSelector.xpath_selector,
          migration_source: currentSelector
        })
      });
    } catch (error) {
      
      throw error;
    }
  }
  /**
   * Log selector selection decision for audit purposes
   */
  private async logSelectionDecision(
    context: any,
    selection: PolicyBasedSelection,
    availableSelectors: DualSelector
  ): Promise<void> {
    try {
      await http('/api/v1/policy/audit/selector-decision', {
        method: 'POST',
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          context,
          selection,
          availableSelectors,
          policySnapshot: this.currentPolicy
        })
      });
    } catch (error) {
      // Don't throw - logging failures shouldn't break execution
    }
  }
  /**
   * Analyze which selector type performs better for analytics
   */
  async analyzeSuccessRates(elementId: string, days: number = 30): Promise<{
    css_success_rate: number;
    xpath_success_rate: number;
    recommendation: 'css' | 'xpath' | 'no_preference';
  }> {
    try {
      const response = await http<any>(`/api/v1/analytics/selector-success-rates/${elementId}?days=${days}`);
      return response.data;
    } catch (error) {
      return {
        css_success_rate: 0.5,
        xpath_success_rate: 0.5,
        recommendation: 'no_preference'
      };
    }
  }
}
// Singleton instance
export const selectorPolicyService = new SelectorPolicyService();
export type {
  SelectorPolicy,
  DualSelector,
  PolicyBasedSelection
};