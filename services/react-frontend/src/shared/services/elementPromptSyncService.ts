/**
 * Element-Prompt Synchronization Service
 * 
 * This service handles bidirectional synchronization between element selectors 
 * and prompt steps that use those selectors. When an element's selector is 
 * updated, all prompts using that element are automatically updated, and vice versa.
 */

export interface RecordedElement {
  id: string;
  dbId?: string;
  logicalKey?: string;
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
  apiBaseUrl: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')
};
export interface ElementReference {
  elementId: string;
  dbId?: string;
  logicalKey?: string;
  currentSelector: string;
  selectorType: 'css' | 'xpath';
}
export interface PromptStepReference {
  promptId: string;
  promptTitle?: string;
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
  private initPromise: Promise<void> | null = null;
  private buildMapPromise: Promise<void> | null = null;
  private lastRelationshipRefresh = 0;
  private readonly relationshipRefreshIntervalMs = 30000;

  private getPlanSteps(plan: any): any[] {
    if (!plan) return [];

    // If direct steps are already present and non-empty, trust them.
    if (Array.isArray(plan.steps) && plan.steps.length > 0) {
      return plan.steps;
    }

    let planData: any = plan.plan_json;
    if (typeof planData === 'string') {
      try {
        planData = JSON.parse(planData);
      } catch {
        planData = {};
      }
    }

    if (planData && Array.isArray(planData.steps)) {
      return planData.steps;
    }
    if (planData && Array.isArray(planData.actions)) {
      return planData.actions;
    }

    return [];
  }

  /**
   * Initialize the sync service by analyzing existing elements and prompts
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        return;
      }
      try {
        // Load all elements and prompts to build relationship map
        await this.buildRelationshipMap();
        this.initialized = true;
        this.lastRelationshipRefresh = Date.now();
      } catch (error) {
        throw error;
      }
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
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
    if (this.buildMapPromise) {
      await this.buildMapPromise;
      return;
    }

    this.buildMapPromise = (async () => {
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
        dbId: (element as any).dbId,
        logicalKey: (element as any).logicalKey,
        currentSelector: element.cssSelector || element.xpath || '',
        selectorType: element.cssSelector ? 'css' : 'xpath'
      };
      const promptRefs: PromptStepReference[] = [];
      const seenPromptRefs = new Set<string>();
      // Find plans that reference this element
      for (const plan of plans) {
        if (plan.plan_json || plan.steps) {
          try {
            // Handle different step structures
            const steps = this.getPlanSteps(plan);
            steps.forEach((step: any, stepIndex: number) => {
              // Support all step formats: {params}, {args}, and flat top-level fields
              const params = step.params || {};
              const args = step.args || {};
              const selectorKeys = [
                'selector', 'elementId', 'target', 'locator', 'element',
                'css_selector', 'xpath', 'dual_selectors', 'original_selector',
                'value', 'target_selector'
              ];
              // Track which parameters we've already processed to avoid duplicates
              const processedSelectors = new Set<string>();
              // Collect candidate (source, key, value) triples across all formats
              const candidates: Array<{source: any, key: string}> = [
                // step.params.* (legacy format)
                ...selectorKeys.map(k => ({ source: params, key: k })),
                // step.args.* (AI-generated format)
                ...selectorKeys.map(k => ({ source: args, key: `args.${k}` })),
                // step.* top-level (flat format)
                ...selectorKeys.map(k => ({ source: step, key: `step.${k}` })),
              ];
              for (const { source, key } of candidates) {
                const rawKey = key.includes('.') ? key.split('.').pop()! : key;
                const value = source[rawKey];
                const selectorCandidates = this.extractSelectorStrings(value);
                for (const selectorValue of selectorCandidates) {
                  if (this.isMatchingSelector(selectorValue, element)) {
                    const selectorKey = `${stepIndex}-${selectorValue}`;
                    if (!processedSelectors.has(selectorKey)) {
                      const refKey = `${plan.prompt_id}|${stepIndex}|${selectorValue.trim().toLowerCase()}`;
                      if (seenPromptRefs.has(refKey)) {
                        continue;
                      }
                      processedSelectors.add(selectorKey);
                      seenPromptRefs.add(refKey);
                      promptRefs.push({
                        promptId: plan.prompt_id,
                        promptTitle: plan.prompt_title,
                        stepIndex,
                        parameterKey: key,
                        currentValue: selectorValue
                      });
                      relationshipsFound++;
                    }
                  }
                }
              }
            });
          } catch (error) {
            // Ignore invalid plan payloads and continue scanning other plans.
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
    void relationshipsFound;
    })();

    try {
      await this.buildMapPromise;
    } finally {
      this.buildMapPromise = null;
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
    if (!selectorValue || !element || typeof selectorValue !== 'string') return false;
    // Normalize selectors for comparison
    const normalizeSelector = (sel?: string) => sel?.trim().toLowerCase() || '';
    let normalizedValue = normalizeSelector(selectorValue);
    normalizedValue = normalizedValue
      .replace(/^css\s*[:=]\s*/, '')
      .replace(/^xpath\s*[:=]\s*/, '');
    // Check exact matches
    if (normalizedValue === normalizeSelector(element.cssSelector) || 
        normalizedValue === normalizeSelector(element.xpath)) {
      return true;
    }
    // Check element ID references (case-insensitive)
    if (normalizedValue === element.id?.toLowerCase()) {
      return true;
    }

    if (normalizedValue === (element.dbId || '').toLowerCase()) {
      return true;
    }

    // Check logical key references when plan steps store element names instead of selectors
    if (normalizedValue === (element.logicalKey || '').toLowerCase()) {
      return true;
    }
    // Check candidate selectors tied to this element
    const elementSelectors = [
      element.cssSelector,
      element.xpath,
      element.id,
      ...(element.selectors || [])
    ].filter(Boolean).map(sel => normalizeSelector(sel));

    for (const sel of elementSelectors) {
      if (!sel) continue;
      // Exact match
      if (sel === normalizedValue) {
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

  private extractSelectorStrings(value: any): string[] {
    const selectors = new Set<string>();

    const collect = (v: any): void => {
      if (!v) return;
      if (typeof v === 'string') {
        const s = v.trim();
        if (s) selectors.add(s);
        return;
      }
      if (Array.isArray(v)) {
        for (const item of v) collect(item);
        return;
      }
      if (typeof v === 'object') {
        const keys = [
          'selector', 'target', 'locator', 'element', 'elementId',
          'css', 'css_selector', 'xpath', 'original_selector',
          'value', 'target_selector'
        ];
        for (const k of keys) {
          if (k in v) collect(v[k]);
        }
        if (v.dual_selectors && typeof v.dual_selectors === 'object') {
          collect(v.dual_selectors.css_selector);
          collect(v.dual_selectors.xpath_selector);
        }
      }
    };

    collect(value);
    return Array.from(selectors);
  }
  /**
   * Ensure the service is initialized before any operation
   */
  private async ensureInitialized(): Promise<void> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      this.initialized = false;
      return;
    }
    if (!this.initialized) {
      await this.initialize();
      return;
    }

    // Keep relationships fresh as prompts/elements are edited.
    const now = Date.now();
    const shouldRefresh = this.relationships.size === 0;

    if (shouldRefresh) {
      await this.buildRelationshipMap();
      this.lastRelationshipRefresh = now;
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
    
    // Always update the element even if no related prompts exist
    const oldSelector = relationship?.elementRef.currentSelector || '';
    try {
      // Update the element in the database (use dbId if available)
      const updateId = relationship?.elementRef.dbId || elementId;
      await this.updateElementInDatabase(updateId, newSelector, selectorType);
      
      // Update all related prompts only if relationship exists
      if (relationship) {
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
      } else {
        // Element exists but has no related prompts - still emit a sync event
        this.emitSyncEvent({
          type: 'element-updated',
          source: {
            elementId,
            currentSelector: newSelector,
            selectorType
          } as ElementReference,
          oldValue: oldSelector,
          newValue: newSelector,
          timestamp: new Date()
        });
      }
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
        const updateId = relationship.elementRef.dbId || elementId;
        await this.updateElementInDatabase(
          updateId, 
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
    const updateData = selectorType === 'css'
      ? { css_selector: newSelector }
      : { xpath: newSelector };

    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${config.apiBaseUrl}/api/v1/sql/elements/${elementId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updateData),
    });
    if (!response.ok) {
      throw new Error(`Failed to update element ${elementId}`);
    }
  }

  private setStepParameterValue(step: any, parameterKey: string, newValue: string): boolean {
    if (!step) {
      return false;
    }

    if (parameterKey.startsWith('args.')) {
      const key = parameterKey.split('.').pop()!;
      step.args = step.args || {};
      step.args[key] = newValue;
      return true;
    }

    if (parameterKey.startsWith('step.')) {
      const key = parameterKey.split('.').pop()!;
      step[key] = newValue;
      return true;
    }

    step.params = step.params || {};
    step.params[parameterKey] = newValue;
    return true;
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
      const testPlans = plansData.plans || plansData.test_plans || [];
      if (testPlans.length === 0) {
        return;
      }
      let updatedAny = false;

      for (const plan of testPlans) {
        let planJson: any = plan.plan_json;
        if (typeof planJson === 'string') {
          try {
            planJson = JSON.parse(planJson);
          } catch {
            planJson = {};
          }
        }
        if (!planJson || typeof planJson !== 'object') {
          planJson = {};
        }

        const fallbackSteps = Array.isArray(plan.steps) ? plan.steps : [];
        const steps = Array.isArray(planJson.steps) ? planJson.steps : fallbackSteps;
        if (!steps[stepIndex]) {
          continue;
        }

        this.setStepParameterValue(steps[stepIndex], parameterKey, newValue);

        const saveResponse = await fetch(`${config.apiBaseUrl}/api/v1/generated-test-plans`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: plan.id,
            prompt_id: plan.prompt_id || promptId,
            plan_json: {
              ...planJson,
              steps,
            },
            confidence_score: plan.confidence_score,
            model_used: plan.model_used,
            generation_time_ms: plan.generation_time_ms,
            status: plan.status || 'draft',
          }),
        });

        if (!saveResponse.ok) {
          throw new Error(`Failed to persist synced step for prompt ${promptId}`);
        }

        updatedAny = true;
      }

      if (!updatedAny) {
        throw new Error(`No editable step found at index ${stepIndex} for prompt ${promptId}`);
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
    const mapElement = (dbElement: any): RecordedElement => ({
      id: dbElement.dbId || dbElement.id || dbElement.element_key,
      dbId: dbElement.dbId,
      logicalKey: dbElement.logical_key || dbElement.element_key || dbElement.id,
      cssSelector: dbElement.css_selector || dbElement.cssSelector,
      xpath: dbElement.xpath,
      selectors: [
        ...(dbElement.selectors || []),
        dbElement.logical_key,
        dbElement.element_key,
      ].filter(Boolean),
      tagName: dbElement.tag || dbElement.tagName,
      textContent: dbElement.text_content || dbElement.textContent,
      href: dbElement.href,
      className: dbElement.class_name || dbElement.className
    });

    const dedupeElements = (elements: RecordedElement[]): RecordedElement[] => {
      // API already returns newest-first, so keep first occurrence.
      const seen = new Set<string>();
      const deduped: RecordedElement[] = [];

      for (const el of elements) {
        const key = [
          (el.logicalKey || '').toLowerCase(),
          (el.cssSelector || '').toLowerCase(),
          (el.xpath || '').toLowerCase(),
        ].join('|');

        // Fallback key when selectors/logical key are missing.
        const fallbackKey = (el.dbId || el.id || '').toLowerCase();
        const dedupeKey = key === '||' ? fallbackKey : key;

        if (!dedupeKey || seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);
        deduped.push(el);
      }

      return deduped;
    };

    // Use REST API directly for fast/consistent frontend behavior.
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiBaseUrl}/api/v1/sql/elements?limit=1000`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const mapped = (data.data || []).map(mapElement);
        const deduped = dedupeElements(mapped);
        return deduped;
      }
    } catch (error) {
      // silent fail
    }

    return [];
  }
  /**
   * Load all plans from database (structured steps) - Direct approach
   */
  private async loadAllPlans(): Promise<any[]> {
    try {
      const token = localStorage.getItem('auth_token');

      // Fast path: single bulk request for latest plans in current project.
      try {
        const bulkResponse = await fetch(
          `${config.apiBaseUrl}/api/v1/generated-test-plans?latest_per_prompt=true&limit=1000`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (bulkResponse.ok) {
          const bulkData = await bulkResponse.json();
          const bulkPlans = bulkData.plans || [];
          const mappedPlans: any[] = [];

          for (const plan of bulkPlans) {
            const steps = this.getPlanSteps(plan);
            if (!Array.isArray(steps) || steps.length === 0) {
              continue;
            }

            mappedPlans.push({
              id: plan.id,
              prompt_id: plan.prompt_id,
              prompt_title: (plan.prompt_title || '').toString().trim(),
              plan_json: plan.plan_json || { steps: [] },
              status: plan.status || 'active',
              steps,
            });
          }

          if (mappedPlans.length > 0) {
            return mappedPlans;
          }
        }
      } catch {
        // Fallback to legacy per-prompt loading below.
      }

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
      for (let i = 0; i < prompts.length; i++) {
        const prompt = prompts[i];
          const url = `${config.apiBaseUrl}/api/v1/generated-test-plans/by-prompt/${prompt.id}`;
          const plansResponse = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (plansResponse.ok) {
            const plansData = await plansResponse.json();
            const testPlans = plansData.plans || plansData.test_plans || plansData.data || (Array.isArray(plansData) ? plansData : []);
            if (testPlans.length > 0) {
              successCount++;
              // Use only the latest plan per prompt to avoid duplicate references
              const latestPlan = testPlans[0];
              for (const plan of [latestPlan]) {
                const steps = this.getPlanSteps(plan);
                if (!Array.isArray(steps) || steps.length === 0) {
                  continue;
                }
                const promptTitle = (prompt.title || prompt.name || prompt.content || prompt.text || '').toString().split('\n')[0].trim();
                // Convert to the format expected by the sync service
                allPlans.push({
                  id: plan.id,
                  prompt_id: plan.prompt_id || prompt.id,
                  prompt_title: promptTitle,
                  plan_json: plan.plan_json || { steps: [] },
                  status: plan.status || 'active',
                  steps
                });
              }
            } else {
            }
          } else {
            notFoundCount++;
            await plansResponse.text();
          }
      }
      // If no plans found through API, check if we can access them differently
      void successCount;
      void notFoundCount;
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
        const testPlans = plansData.plans || plansData.test_plans || [];
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
   * Get all relationships
   */
  async getRelationships(): Promise<Map<string, SyncRelationship>> {
    await this.ensureInitialized();
    return new Map(this.relationships);
  }

  private resolveRelationship(elementId: string): SyncRelationship | null {
    const direct = this.relationships.get(elementId);
    if (direct) {
      return direct;
    }

    const normalized = (elementId || '').toLowerCase();
    for (const relationship of this.relationships.values()) {
      const logicalKey = (relationship.elementRef.logicalKey || '').toLowerCase();
      const dbId = (relationship.elementRef.dbId || '').toLowerCase();
      const keyId = (relationship.elementRef.elementId || '').toLowerCase();

      if (normalized && (normalized === logicalKey || normalized === dbId || normalized === keyId)) {
        return relationship;
      }
    }

    return null;
  }

  /**
   * Get relationships for a specific element
   */
  async getElementRelationships(elementId: string): Promise<SyncRelationship | null> {
    await this.ensureInitialized();
    return this.resolveRelationship(elementId);
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
    const relationship = this.resolveRelationship(elementId);
    return !!(relationship && relationship.promptRefs.length > 0);
  }
  /**
   * Get count of related prompts for an element
   */
  async getRelatedPromptsCount(elementId: string): Promise<number> {
    await this.ensureInitialized();
    const relationship = this.resolveRelationship(elementId);
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
      const elementsResponse = await fetch(`${config.apiBaseUrl}/api/v1/sql/elements?limit=1000`);
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
export default elementPromptSyncService;