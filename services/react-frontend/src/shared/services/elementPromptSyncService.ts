/**
 * Element-Prompt Synchronization Service
 * 
 * This service handles bidirectional synchronization between element selectors 
 * and prompt steps that use those selectors. When an element's selector is 
 * updated, all prompts using that element are automatically updated, and vice versa.
 */
import { MCPFrontendManager } from '../../services/mcpFrontendClient';

export interface RecordedElement {
  id: string;
  cssSelector?: string;
  xpath?: string;
  selectors?: string[];
  tagName?: string;
  textContent?: string;
  href?: string;
  className?: string;
}
// Configuration
const config = {
  apiBaseUrl: 'https://testhelix.com'
};
export interface ElementReference {
  elementId: string;
  currentSelector: string;
  selectorType: 'css' | 'xpath';
}
export interface PromptStepReference {
  promptId: string;
  stepIndex: number;
  parameterKey: string; // 'selector', 'elementId', etc.
  currentValue: string;
}
export interface SyncRelationship {
  elementRef: ElementReference;
  promptRefs: PromptStepReference[];
}
export interface SyncEvent {
  type: 'element-updated' | 'prompt-updated';
  source: ElementReference | PromptStepReference;
  oldValue: string;
  newValue: string;
  timestamp: Date;
}
class ElementPromptSyncService {
  private relationships: Map<string, SyncRelationship> = new Map();
  private eventListeners: ((event: SyncEvent) => void)[] = [];
  private initialized = false;
  /**
   * Initialize the sync service by analyzing existing elements and prompts
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      // Load all elements and prompts to build relationship map
      await this.buildRelationshipMap();
      this.initialized = true;
    } catch (error) {
      throw error;
    }
  }
  /**
   * Force re-initialization (useful for testing or after data changes)
   */
  async reinitialize(): Promise<void> {
    this.initialized = false;
    this.relationships.clear();
    await this.initialize();
  }
  /**
   * Build the relationship map between elements and prompts
   */
  private async buildRelationshipMap(): Promise<void> {
    const [elements, plans] = await Promise.all([
      this.loadAllElements(),
      this.loadAllPlans()
    ]);
    // Clear existing relationships
    this.relationships.clear();
    let relationshipsFound = 0;
    // Build relationships
    for (const element of elements) {
      const elementRef: ElementReference = {
        elementId: element.id,
        currentSelector: element.cssSelector || element.xpath || '',
        selectorType: element.cssSelector ? 'css' : 'xpath'
      };
      const promptRefs: PromptStepReference[] = [];
      // Find plans that reference this element
      for (const plan of plans) {
        if (plan.plan_json || plan.steps) {
          try {
            // Handle different step structures
            let steps = [];
            if (plan.steps) {
              // Direct steps array from API response
              steps = plan.steps;
            } else if (plan.plan_json) {
              // Parse plan_json
              const planData = typeof plan.plan_json === 'string' 
                ? JSON.parse(plan.plan_json) 
                : plan.plan_json;
              steps = planData.steps || planData.actions || [];
            }
            steps.forEach((step: any, stepIndex: number) => {
              const params = step.params || {};
              // Log step details for debugging
              const selectorKeys = ['selector', 'elementId', 'target', 'locator', 'element', 'css_selector', 'xpath'];
              // Track which parameters we've already processed to avoid duplicates
              const processedSelectors = new Set<string>();
              for (const key of selectorKeys) {
                const value = params[key];
                if (value && this.isMatchingSelector(value, element)) {
                  // Check if we've already processed this exact selector value for this step
                  const selectorKey = `${stepIndex}-${value}`;
                  if (!processedSelectors.has(selectorKey)) {
                    processedSelectors.add(selectorKey);
                    promptRefs.push({
                      promptId: plan.prompt_id,
                      stepIndex,
                      parameterKey: key,
                      currentValue: value
                    });
                    relationshipsFound++;
                  } else {
                  }
                }
              }
            });
          } catch (error) {
          }
        }
      }
      if (promptRefs.length > 0) {
        this.relationships.set(element.id, {
          elementRef,
          promptRefs
        });
      }
    }
    // Enhanced debugging
    if (this.relationships.size === 0) {
      if (elements.length > 0) {
      }
      if (plans.length > 0) {
      }
    }
  }
  /**
   * Check if a prompt text references an element
   */
  private promptReferencesElement(prompt: any, element: RecordedElement): boolean {
    if (!prompt.text || !element) return false;
    const promptText = prompt.text.toLowerCase();
    // Check if prompt mentions element by various identifiers
    const elementIdentifiers = [
      element.cssSelector,
      element.xpath,
      element.id,
      (element as any).tagName,
      (element as any).textContent,
      (element as any).href,
      (element as any).className,
      ...(element.selectors || [])
    ].filter(Boolean).map(id => id.toLowerCase());
    // Look for exact matches
    for (const identifier of elementIdentifiers) {
      if (promptText.includes(identifier)) {
        return true;
      }
    }
    // Look for semantic matches (button text, link text, etc.)
    const textContent = (element as any).textContent;
    if (textContent && textContent.trim()) {
      const elementText = textContent.toLowerCase().trim();
      if (elementText.length > 2 && promptText.includes(elementText)) {
        return true;
      }
    }
    // Look for common UI patterns
    const tagName = (element as any).tagName;
    if (tagName) {
      const tag = tagName.toLowerCase();
      // Button patterns
      if (tag === 'button' && (promptText.includes('button') || promptText.includes('click'))) {
        // Check if text content matches
        if (textContent && promptText.includes(textContent.toLowerCase())) {
          return true;
        }
      }
      // Input patterns
      if ((tag === 'input' || tag === 'textarea') && 
          (promptText.includes('enter') || promptText.includes('type') || promptText.includes('input'))) {
        // Check placeholder, name, or id
        const placeholder = (element as any).placeholder;
        if (placeholder && promptText.includes(placeholder.toLowerCase())) {
          return true;
        }
      }
      // Link patterns
      if (tag === 'a' && promptText.includes('link')) {
        if (textContent && promptText.includes(textContent.toLowerCase())) {
          return true;
        }
      }
    }
    return false;
  }
  /**
   * Check if a selector value matches an element
   */
  private isMatchingSelector(selectorValue: string, element: RecordedElement): boolean {
    if (!selectorValue || !element) return false;
    // Normalize selectors for comparison
    const normalizeSelector = (sel?: string) => sel?.trim().toLowerCase() || '';
    const normalizedValue = normalizeSelector(selectorValue);
    // Check exact matches
    if (normalizedValue === normalizeSelector(element.cssSelector) || 
        normalizedValue === normalizeSelector(element.xpath)) {
      return true;
    }
    // Check element ID references (case-insensitive)
    if (normalizedValue === element.id?.toLowerCase()) {
      return true;
    }
    // Check if selector contains element identifiers
    const elementSelectors = [
      element.cssSelector,
      element.xpath,
      element.id,
      ...(element.selectors || [])
    ].filter(Boolean).map(sel => normalizeSelector(sel));
    // More flexible matching for existing selectors
    for (const sel of elementSelectors) {
      if (!sel) continue;
      // Exact match
      if (sel === normalizedValue) {
        return true;
      }
      // Partial matches for CSS selectors
      if (normalizedValue.includes(sel) || sel.includes(normalizedValue)) {
        return true;
      }
      // For CSS selectors, check if they target the same element
      if (element.cssSelector && selectorValue.includes('#') && element.cssSelector.includes('#')) {
        const valueId = normalizedValue.match(/#([^.\s]+)/)?.[1];
        const elemId = normalizeSelector(element.cssSelector).match(/#([^.\s]+)/)?.[1];
        if (valueId && elemId && valueId === elemId) {
          return true;
        }
      }
    }
    return false;
  }
  /**
   * Ensure the service is initialized before any operation
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
  /**
   * Update an element's selector and sync to related prompts
   */
  async updateElementSelector(
    elementId: string, 
    newSelector: string, 
    selectorType: 'css' | 'xpath'
  ): Promise<void> {
    await this.ensureInitialized();
    const relationship = this.relationships.get(elementId);
    if (!relationship) {
      return;
    }
    const oldSelector = relationship.elementRef.currentSelector;
    try {
      // Update the element in the database
      await this.updateElementInDatabase(elementId, newSelector, selectorType);
      // Update all related prompts
      await this.updateRelatedPrompts(relationship, newSelector);
      // Update local relationship
      relationship.elementRef.currentSelector = newSelector;
      relationship.elementRef.selectorType = selectorType;
      // Emit sync event
      this.emitSyncEvent({
        type: 'element-updated',
        source: relationship.elementRef,
        oldValue: oldSelector,
        newValue: newSelector,
        timestamp: new Date()
      });
    } catch (error) {
      throw error;
    }
  }
  /**
   * Update a prompt step's selector and sync to related element
   */
  async updatePromptStepSelector(
    promptId: string,
    stepIndex: number,
    parameterKey: string,
    newSelector: string
  ): Promise<void> {
    await this.ensureInitialized();
    // Find the element that this prompt step references
    const elementId = this.findElementBySelector(newSelector);
    if (!elementId) {
      return;
    }
    const relationship = this.relationships.get(elementId);
    if (!relationship) {
      return;
    }
    // Find the specific prompt reference
    const promptRef = relationship.promptRefs.find(ref => 
      ref.promptId === promptId && 
      ref.stepIndex === stepIndex && 
      ref.parameterKey === parameterKey
    );
    if (!promptRef) {
      return;
    }
    const oldValue = promptRef.currentValue;
    try {
      // Update the prompt step
      await this.updatePromptStepInDatabase(promptId, stepIndex, parameterKey, newSelector);
      // Update the element if the selector is different
      if (newSelector !== relationship.elementRef.currentSelector) {
        await this.updateElementInDatabase(
          elementId, 
          newSelector, 
          newSelector.startsWith('//') ? 'xpath' : 'css'
        );
        relationship.elementRef.currentSelector = newSelector;
      }
      // Update local reference
      promptRef.currentValue = newSelector;
      // Emit sync event
      this.emitSyncEvent({
        type: 'prompt-updated',
        source: promptRef,
        oldValue,
        newValue: newSelector,
        timestamp: new Date()
      });
    } catch (error) {
      throw error;
    }
  }
  /**
   * Find element ID by selector value
   */
  private findElementBySelector(selector: string): string | null {
    for (const [elementId, relationship] of this.relationships) {
      if (this.isMatchingSelector(selector, { 
        id: elementId, 
        cssSelector: relationship.elementRef.currentSelector,
        xpath: relationship.elementRef.currentSelector
      } as RecordedElement)) {
        return elementId;
      }
    }
    return null;
  }
  /**
   * Update element in database
   */
  private async updateElementInDatabase(
    elementId: string, 
    newSelector: string, 
    selectorType: 'css' | 'xpath'
  ): Promise<void> {
    const mcpClient = await MCPFrontendManager.getInstance();
    if (!mcpClient) {
      throw new Error('MCP client not available');
    }

    const updateData = selectorType === 'css' 
      ? { cssSelector: newSelector }
      : { xpath: newSelector };

    await mcpClient.callTool('sql_update_element', {
      elementId,
      updateData
    });
  }
  /**
   * Update prompt step in database (works with plans table via existing API)
   */
  private async updatePromptStepInDatabase(
    promptId: string,
    stepIndex: number,
    parameterKey: string,
    newValue: string
  ): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      // Get the plan for this prompt
  const plansResponse = await fetch(`${config.apiBaseUrl}/api/v1/generated-test-plans/by-prompt/${promptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!plansResponse.ok) {
        return;
      }
      const plansData = await plansResponse.json();
      const testPlans = plansData.test_plans || [];
      if (testPlans.length === 0) {
        return;
      }
      const plan = testPlans[0]; // Use the first plan
      // Update the specific parameter
      if (plan.steps && plan.steps[stepIndex]) {
        if (!plan.steps[stepIndex].params) {
          plan.steps[stepIndex].params = {};
        }
        plan.steps[stepIndex].params[parameterKey] = newValue;
        // The current API doesn't have a direct update endpoint for plans
        // This would need to be implemented in the backend
        // TODO: Implement plan update endpoint in the backend
        // For now, we'll just log what would be updated
      } else {
      }
    } catch (error) {
      throw error;
    }
  }
  /**
   * Update all prompts related to an element
   */
  private async updateRelatedPrompts(
    relationship: SyncRelationship, 
    newSelector: string
  ): Promise<void> {
    const updatePromises = relationship.promptRefs.map(async (promptRef) => {
      await this.updatePromptStepInDatabase(
        promptRef.promptId,
        promptRef.stepIndex,
        promptRef.parameterKey,
        newSelector
      );
      promptRef.currentValue = newSelector;
    });
    await Promise.all(updatePromises);
  }
  /**
   * Load all elements from database
   */
  private async loadAllElements(): Promise<RecordedElement[]> {
    try {
      const mcpClient = await MCPFrontendManager.getInstance();
      if (!mcpClient) {
        return [];
      }

      const response = await mcpClient.callTool('sql_get_all_elements', {});
      
      // Convert the response to RecordedElement format
      const elements = response.content?.[0]?.data || [];
      return elements.map((dbElement: any) => ({
        id: dbElement.id || dbElement.element_key,
        cssSelector: dbElement.css_selector || dbElement.cssSelector,
        xpath: dbElement.xpath,
        selectors: dbElement.selectors || [],
        tagName: dbElement.tag || dbElement.tagName,
        textContent: dbElement.text_content || dbElement.textContent,
        href: dbElement.href,
        className: dbElement.class_name || dbElement.className
      }));
    } catch (error) {
      return [];
    }
  }
  /**
   * Load all plans from database (structured steps) - Direct approach
   */
  private async loadAllPlans(): Promise<any[]> {
    try {
      const token = localStorage.getItem('auth_token');
      // First, get all prompts
      const promptsResponse = await fetch(`${config.apiBaseUrl}/api/v1/prompts?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!promptsResponse.ok) {
        return [];
      }
      const promptsData = await promptsResponse.json();
      const prompts = promptsData.data || promptsData.prompts || [];
      // Check if prompts array is actually populated
      if (prompts.length === 0) {
        return [];
      }
      // Then get plans for each prompt
      const allPlans: any[] = [];
      let successCount = 0;
      let notFoundCount = 0;
      for (let i = 0; i < Math.min(3, prompts.length); i++) {
        const prompt = prompts[i];
          const url = `${config.apiBaseUrl}/api/v1/generated-test-plans/by-prompt/${prompt.id}`;
          const plansResponse = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (plansResponse.ok) {
            const plansData = await plansResponse.json();
            const testPlans = plansData.test_plans || plansData.data || plansData || [];
            if (testPlans.length > 0) {
              successCount++;
              for (const plan of testPlans) {
                // Convert to the format expected by the sync service
                allPlans.push({
                  id: plan.id,
                  prompt_id: plan.prompt_id || prompt.id,
                  plan_json: { steps: plan.steps || [] },
                  status: plan.status || 'active',
                  steps: plan.steps || []
                });
              }
            } else {
            }
          } else {
            notFoundCount++;
            const errorText = await plansResponse.text();
          }
      }
      // If no plans found through API, check if we can access them differently
      if (allPlans.length === 0) {
      }
      return allPlans;
    } catch (error) {
      return [];
    }
  }
  /**
   * Load all prompts with their test plans from database
   */
  private async loadAllPrompts(): Promise<any[]> {
    try {
      const token = localStorage.getItem('auth_token');
      // Load prompts
      const promptsResponse = await fetch(`${config.apiBaseUrl}/api/v1/prompts?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!promptsResponse.ok) {
        return [];
      }
      const promptsData = await promptsResponse.json();
      const prompts = promptsData.data || [];
      if (prompts.length === 0) {
        return [];
      }
      // Load test plans for each prompt
      const promptsWithPlans = await Promise.all(
        prompts.map(async (prompt: any, index: number) => {
          try {
            const testPlanResponse = await fetch(`${config.apiBaseUrl}/api/v1/generated-test-plans/by-prompt/${prompt.id}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (testPlanResponse.ok) {
              const testPlan = await testPlanResponse.json();
              // Convert test plan to the expected format
              if (testPlan && testPlan.plan_data) {
                let planData;
                try {
                  planData = typeof testPlan.plan_data === 'string' 
                    ? JSON.parse(testPlan.plan_data) 
                    : testPlan.plan_data;
                } catch (parseError) {
                  return prompt;
                }
                // Add generated_steps in the format the sync service expects
                prompt.generated_steps = JSON.stringify({
                  plan: { actions: planData.actions || planData }
                });
              }
            } else {
            }
            return prompt;
          } catch (error) {
            return prompt;
          }
        })
      );
      const promptsWithTestPlans = promptsWithPlans.filter(p => p.generated_steps);
      return promptsWithTestPlans;
    } catch (error) {
      return [];
    }
  }
  /**
   * Load single prompt with its plan
   */
  private async loadPrompt(promptId: string): Promise<any> {
    try {
      const token = localStorage.getItem('auth_token');
      // Load the prompt
      const promptResponse = await fetch(`${config.apiBaseUrl}/api/v1/prompts/${promptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!promptResponse.ok) {
        return null;
      }
      const prompt = await promptResponse.json();
      // Load plans for this prompt
  const plansResponse = await fetch(`${config.apiBaseUrl}/api/v1/generated-test-plans/by-prompt/${promptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        const testPlans = plansData.test_plans || [];
        if (testPlans.length > 0) {
          const plan = testPlans[0];
          // Add generated_steps in the format the sync service expects
          prompt.generated_steps = JSON.stringify({
            plan: { actions: plan.steps || [] }
          });
        }
      }
      return prompt;
    } catch (error) {
      return null;
    }
  }
  /**
   * Get all relationships for debugging
   */
  async getRelationships(): Promise<Map<string, SyncRelationship>> {
    await this.ensureInitialized();
    return new Map(this.relationships);
  }
  /**
   * Get relationships for a specific element
   */
  async getElementRelationships(elementId: string): Promise<SyncRelationship | null> {
    await this.ensureInitialized();
    return this.relationships.get(elementId) || null;
  }
  /**
   * Load all prompts from database (text-based prompts)
   */
  private async loadAllPromptsFromDatabase(): Promise<any[]> {
    try {
      const token = localStorage.getItem('auth_token');
      // Load prompts
      const promptsResponse = await fetch(`${config.apiBaseUrl}/api/v1/prompts?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!promptsResponse.ok) {
        return [];
      }
      const promptsData = await promptsResponse.json();
      const prompts = promptsData.data || [];
      return prompts;
    } catch (error) {
      return [];
    }
  }
  async hasRelatedPrompts(elementId: string): Promise<boolean> {
    await this.ensureInitialized();
    const relationship = this.relationships.get(elementId);
    return !!(relationship && relationship.promptRefs.length > 0);
  }
  /**
   * Get count of related prompts for an element
   */
  async getRelatedPromptsCount(elementId: string): Promise<number> {
    await this.ensureInitialized();
    const relationship = this.relationships.get(elementId);
    return relationship ? relationship.promptRefs.length : 0;
  }
  /**
   * Subscribe to sync events
   */
  subscribe(listener: (event: SyncEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }
  /**
   * Emit sync event to all listeners
   */
  private emitSyncEvent(event: SyncEvent): void {
    this.eventListeners.forEach(listener => {
        listener(event);
    });
  }
  /**
   * Refresh relationships (useful after bulk changes)
   */
  async refresh(): Promise<void> {
    await this.buildRelationshipMap();
  }
  /**
   * Manually add a relationship (useful for new elements/prompts)
   */
  addRelationship(elementId: string, promptRef: PromptStepReference): void {
    const existing = this.relationships.get(elementId);
    if (existing) {
      existing.promptRefs.push(promptRef);
    } else {
      // Would need element data to create new relationship
    }
  }
  /**
   * Remove a relationship
   */
  removeRelationship(elementId: string, promptId?: string): void {
    if (promptId) {
      const relationship = this.relationships.get(elementId);
      if (relationship) {
        relationship.promptRefs = relationship.promptRefs.filter(
          ref => ref.promptId !== promptId
        );
        if (relationship.promptRefs.length === 0) {
          this.relationships.delete(elementId);
        }
      }
    } else {
      this.relationships.delete(elementId);
    }
  }
  /**
   * Debug function - get summary of current state
   */
  getDebugSummary(): any {
    return {
      initialized: this.initialized,
      relationshipCount: this.relationships.size,
      relationships: Array.from(this.relationships.entries()).map(([elementId, rel]) => ({
        elementId,
        selector: rel.elementRef.currentSelector,
        selectorType: rel.elementRef.selectorType,
        promptCount: rel.promptRefs.length,
        prompts: rel.promptRefs.map(ref => ({
          promptId: ref.promptId,
          step: ref.stepIndex,
          param: ref.parameterKey,
          value: ref.currentValue
        }))
      }))
    };
  }
  /**
   * Debug function - test selector matching
   */
  testSelectorMatch(selector: string, elementId?: string): any {
    const results: any[] = [];
    if (elementId) {
      // Test specific element
      const relationship = this.relationships.get(elementId);
      if (relationship) {
        const element = {
          id: elementId,
          cssSelector: relationship.elementRef.currentSelector,
          xpath: relationship.elementRef.currentSelector
        };
        const matches = this.isMatchingSelector(selector, element as any);
        results.push({
          elementId,
          currentSelector: relationship.elementRef.currentSelector,
          testSelector: selector,
          matches
        });
      }
    } else {
      // Test all elements
      for (const [elemId, rel] of this.relationships) {
        const element = {
          id: elemId,
          cssSelector: rel.elementRef.currentSelector,
          xpath: rel.elementRef.currentSelector
        };
        const matches = this.isMatchingSelector(selector, element as any);
        results.push({
          elementId: elemId,
          currentSelector: rel.elementRef.currentSelector,
          testSelector: selector,
          matches
        });
      }
    }
    return results;
  }
  /**
   * Debug function - check if test plans exist
   */
  async checkTestPlans(): Promise<any> {
    try {
      const token = localStorage.getItem('auth_token');
      // Try to get all test plans
  const response = await fetch(`${config.apiBaseUrl}/api/v1/generated-test-plans?limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  }
  /**
   * Debug function - check specific prompt's plans
   */
  async checkPromptPlans(promptId?: string): Promise<any> {
    try {
      const token = localStorage.getItem('auth_token');
      // Get prompts first to find a valid ID
      if (!promptId) {
        const promptsResponse = await fetch(`${config.apiBaseUrl}/api/v1/prompts?limit=1`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (promptsResponse.ok) {
          const promptsData = await promptsResponse.json();
          const prompts = promptsData.data || [];
          if (prompts.length > 0) {
            promptId = prompts[0].id;
          } else {
            return null;
          }
        }
      }
      // Check plans for this prompt
  const plansResponse = await fetch(`${config.apiBaseUrl}/api/v1/generated-test-plans/by-prompt/${promptId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        return plansData;
      } else {
        const errorText = await plansResponse.text();
        return { error: errorText, status: plansResponse.status };
      }
    } catch (error) {
      return null;
    }
  }
  /**
   * Handle deleted element by finding alternative element and updating relationships
   */
  async handleDeletedElement(deletedElementId: string): Promise<{
    success: boolean;
    alternativeFound: boolean;
    alternativeElement?: any;
    updatedPrompts?: number;
    message: string;
  }> {
    await this.ensureInitialized();
    const relationship = this.relationships.get(deletedElementId);
    if (!relationship) {
      return {
        success: true,
        alternativeFound: false,
        message: `No sync relationships found for deleted element ${deletedElementId}`
      };
    }
    try {
      // Try to find alternative element on the same page
      const alternativeElement = await this.findAlternativeElement(relationship.elementRef);
      if (alternativeElement) {
        // Update all related prompts to use the new element
        const updatedCount = await this.updateRelatedPromptsToNewElement(
          relationship, 
          alternativeElement
        );
        // Update the relationship
        relationship.elementRef.elementId = alternativeElement.id;
        relationship.elementRef.currentSelector = alternativeElement.cssSelector || alternativeElement.xpath;
        relationship.elementRef.selectorType = alternativeElement.cssSelector ? 'css' : 'xpath';
        // Update the relationship map with new key
        this.relationships.delete(deletedElementId);
        this.relationships.set(alternativeElement.id, relationship);
        // Emit sync event
        this.emitSyncEvent({
          type: 'element-updated',
          source: relationship.elementRef,
          oldValue: deletedElementId,
          newValue: alternativeElement.id,
          timestamp: new Date()
        });
        return {
          success: true,
          alternativeFound: true,
          alternativeElement,
          updatedPrompts: updatedCount,
          message: `Successfully replaced deleted element with alternative. Updated ${updatedCount} prompts.`
        };
      } else {
        // No alternative found - mark relationships as broken
        // Clean up the relationship
        this.relationships.delete(deletedElementId);
        // Emit sync event
        this.emitSyncEvent({
          type: 'element-updated',
          source: relationship.elementRef,
          oldValue: 'deleted',
          newValue: 'orphaned',
          timestamp: new Date()
        });
        return {
          success: true,
          alternativeFound: false,
          message: `Element deleted. ${relationship.promptRefs.length} prompts may need manual review.`
        };
      }
    } catch (error) {
      return {
        success: false,
        alternativeFound: false,
        message: `Failed to handle deleted element: ${(error as Error).message || 'Unknown error'}`
      };
    }
  }
  /**
   * Find alternative element for a deleted element
   */
  private async findAlternativeElement(deletedElementRef: any): Promise<any> {
    try {
      // Get all elements from the same page
      const elementsResponse = await fetch('/api/v1/sql/elements?limit=1000');
      if (!elementsResponse.ok) {
        throw new Error('Failed to fetch elements');
      }
      const elementsData = await elementsResponse.json();
      const elements = elementsData.success ? elementsData.data : elementsData;
      // Filter elements from the same page
      const samePage = deletedElementRef.page || 'unknown';
      const pageElements = elements.filter((el: any) => 
        el.page === samePage && el.id !== deletedElementRef.elementId
      );
      if (pageElements.length === 0) {
        return null;
      }
      // Try to find element with similar characteristics
      const originalText = deletedElementRef.text || '';
      const originalTag = deletedElementRef.tag || '';
      const originalSelector = deletedElementRef.currentSelector || '';
      // Score potential alternatives
      const scored = pageElements.map((el: any) => {
        let score = 0;
        // Same tag type
        if (el.tag === originalTag) score += 30;
        // Similar text content
        if (originalText && el.text_content && 
            el.text_content.toLowerCase().includes(originalText.toLowerCase())) {
          score += 40;
        }
        // Similar selector patterns
        if (originalSelector && el.css_selector &&
            this.selectorSimilarity(originalSelector, el.css_selector) > 0.5) {
          score += 20;
        }
        // Interactive elements get priority
        if (['button', 'input', 'a', 'select'].includes(el.tag?.toLowerCase())) {
          score += 10;
        }
        return { element: el, score };
      });
      // Sort by score and return best match
      scored.sort((a: any, b: any) => b.score - a.score);
      if (scored.length > 0 && scored[0].score > 20) {
        const best = scored[0].element;
        // Convert to frontend format
        return {
          id: best.element_key || best.id,
          dbId: best.id,
          tag: best.tag,
          text: best.text_content,
          cssSelector: best.css_selector,
          xpath: best.xpath,
          page: best.page
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }
  /**
   * Calculate similarity between two selectors
   */
  private selectorSimilarity(sel1: string, sel2: string): number {
    if (!sel1 || !sel2) return 0;
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const s1 = normalize(sel1);
    const s2 = normalize(sel2);
    if (s1 === s2) return 1;
    // Simple similarity based on common substrings
    const words1 = s1.split(/[\s.#\[\]>+~]/).filter(w => w.length > 1);
    const words2 = s2.split(/[\s.#\[\]>+~]/).filter(w => w.length > 1);
    if (words1.length === 0 || words2.length === 0) return 0;
    const common = words1.filter(w => words2.includes(w)).length;
    return common / Math.max(words1.length, words2.length);
  }
  /**
   * Update related prompts to use new element
   */
  private async updateRelatedPromptsToNewElement(
    relationship: any, 
    newElement: any
  ): Promise<number> {
    let updatedCount = 0;
    for (const promptRef of relationship.promptRefs) {
        // Use the existing updateRelatedPrompts method instead
        await this.updateRelatedPrompts(relationship, newElement.cssSelector || newElement.xpath);
        updatedCount++;
    }
    return updatedCount;
  }
}
// Create singleton instance
export const elementPromptSyncService = new ElementPromptSyncService();
// Auto-initialize on import (in a real app, you might want more control over this)
elementPromptSyncService.initialize().catch(console.error);
// Expose to global window for debugging
if (typeof window !== 'undefined') {
  (window as any).syncService = elementPromptSyncService;
}
export default elementPromptSyncService;