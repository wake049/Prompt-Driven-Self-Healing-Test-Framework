import type { 
  UIAction, 
  UIClickAction, 
  UITypeAction, 
  ToolResult, 
  ElementData, 
  VerificationPreset,
  VerificationCheck,
  RecordedElement
} from './types.js';
import { El } from './types/element.js';

// Robust discovery functions (inline to avoid import issues)
interface Candidate {
  tag: string;
  name?: string;
  testid?: string;
  selectors: Array<{type: string; value: string; stability: string}>;
  score: number;
  why: string[];
  group?: {label: string};
}

function discoverElements(max = 500): Candidate[] {
  // Enhanced implementation - finds interactive elements with proper selectors
  const elements = document.querySelectorAll('button, input, a[href], [role="button"], [onclick], select, textarea');
  const candidates: Candidate[] = [];
  
  Array.from(elements).slice(0, max).forEach((el, index) => {
    const tag = el.tagName.toLowerCase();
    const name = el.textContent?.trim() || el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    const testid = el.getAttribute('data-testid') || '';
    const id = el.id || '';
    const className = el.className || '';
    
    // Build selectors in order of stability (most stable first)
    const selectors = [];
    
    // 1. ID selector (highest stability)
    if (id) {
      selectors.push({
        type: 'css',
        value: `#${id}`,
        stability: 'high'
      });
      selectors.push({
        type: 'xpath',
        value: `//*[@id="${id}"]`,
        stability: 'high'
      });
    }
    
    // 2. Data-testid selector (high stability)
    if (testid) {
      selectors.push({
        type: 'css',
        value: `[data-testid="${testid}"]`,
        stability: 'high'
      });
      selectors.push({
        type: 'xpath',
        value: `//*[@data-testid="${testid}"]`,
        stability: 'high'
      });
    }
    
    // 3. Class-based selectors (medium stability)
    if (className && typeof className === 'string') {
      const classes = className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selectors.push({
          type: 'css',
          value: `.${classes.join('.')}`,
          stability: 'med'
        });
      }
    }
    
    // 4. Tag + attribute selectors (medium stability)
    const nameAttr = el.getAttribute('name');
    if (nameAttr) {
      selectors.push({
        type: 'css',
        value: `${tag}[name="${nameAttr}"]`,
        stability: 'med'
      });
    }
    
    // 5. Text-based selector (if short enough)
    if (name && name.length < 50 && name.length > 0) {
      selectors.push({
        type: 'css',
        value: `${tag}:contains("${name}")`,
        stability: 'low'
      });
    }
    
    // 6. Fallback positional selectors (lowest stability)
    selectors.push({
      type: 'css',
      value: `${tag}:nth-of-type(${Array.from(el.parentElement?.children || []).filter(child => child.tagName === el.tagName).indexOf(el) + 1})`,
      stability: 'low'
    });
    
    // Generate proper XPath
    selectors.push({
      type: 'xpath',
      value: generateXPath(el),
      stability: id ? 'high' : testid ? 'high' : 'low'
    });
    
    // Determine element category and score
    let score = 0.8;
    const why = ['interactive element'];
    let group = {label: 'interactive'};
    
    if (tag === 'button' || el.getAttribute('role') === 'button') {
      score = 0.9;
      why.push('button element');
      group = {label: 'buttons'};
    } else if (tag === 'input') {
      score = 0.85;
      why.push('input element');
      group = {label: 'inputs'};
    } else if (tag === 'a') {
      score = 0.8;
      why.push('link element');
      group = {label: 'links'};
    }
    
    // Boost score if element has ID or data-testid
    if (id) {
      score += 0.1;
      why.push('has ID');
    }
    if (testid) {
      score += 0.1;
      why.push('has test ID');
    }
    
    candidates.push({
      tag,
      name,
      testid,
      selectors,
      score,
      why,
      group
    });
  });
  
  // Sort by score (highest first)
  return candidates.sort((a, b) => b.score - a.score);
}

function showOverlay(candidates: Candidate[]): () => void {
  // Simple overlay implementation
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.8); 
    color: white; padding: 10px; border-radius: 5px; z-index: 999999;
  `;
  overlay.textContent = `Found ${candidates.length} interactive elements`;
  document.body.appendChild(overlay);
  
  return () => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };
}

function generateXPath(element: Element): string {
  // Generate proper XPath with ID priority
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  // Use data-testid if available
  const testid = element.getAttribute('data-testid');
  if (testid) {
    return `//*[@data-testid="${testid}"]`;
  }

  // Check if element contains dynamic content that should be avoided
  const text = element.textContent?.trim();
  const isDynamicContent = text && (
    // Price patterns
    /[\$£€¥₹]\s*\d+(?:\.\d{2})?/.test(text) ||  // $19.99, £20.00, €15.50
    /\d+(?:\.\d{2})?\s*[\$£€¥₹]/.test(text) ||  // 19.99$, 20€
    // Date patterns
    /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) ||    // 10/3/2025, 3/10/25
    /\d{4}-\d{2}-\d{2}/.test(text) ||            // 2025-10-03
    // Time patterns
    /\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?/i.test(text) || // 3:45 PM, 15:30
    // Counters/quantities
    /^\d+$/.test(text) ||                        // Pure numbers like "42"
    // Percentages
    /\d+(?:\.\d+)?%/.test(text) ||              // 15%, 99.9%
    // Dynamic IDs/timestamps in text
    /\d{10,}/.test(text) ||                     // Timestamps like 1696348800
    // Stock levels
    /\d+\s*(?:in stock|available|left|remaining)/i.test(text)
  );

  // Use text-based XPath for elements with short, stable (non-dynamic) text
  if (text && text.length > 0 && text.length <= 30 && !isDynamicContent) {
    const tag = element.tagName.toLowerCase();
    // For buttons and links with short, stable text
    if (tag === 'button' || tag === 'a' || element.getAttribute('role') === 'button') {
      return `//${tag}[text()="${text}"]`;
    }
    // For other elements with very short stable text
    if (text.length <= 15) {
      return `//${tag}[contains(text(),"${text}")]`;
    }
  }

  // For dynamic content, use structural/attribute-based selectors instead
  const tag = element.tagName.toLowerCase();
  
  // Check for semantic attributes that indicate purpose
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && !isDynamicContent) {
    return `//${tag}[@aria-label="${ariaLabel}"]`;
  }

  const title = element.getAttribute('title');
  if (title && !isDynamicContent) {
    return `//${tag}[@title="${title}"]`;
  }

  // Use class-based selection for dynamic content
  const className = element.className;
  if (className && typeof className === 'string' && className.trim()) {
    const classes = className.trim().split(/\s+/);
    
    // Look for semantic classes that indicate purpose (not dynamic values)
    const semanticClasses = classes.filter(c => 
      c.includes('price') || c.includes('cost') || c.includes('amount') ||
      c.includes('date') || c.includes('time') || c.includes('count') ||
      c.includes('btn') || c.includes('button') || c.includes('link') ||
      c.includes('nav') || c.includes('menu') || c.includes('content') ||
      c.includes('item') || c.includes('product') || c.includes('card')
    );
    
    if (semanticClasses.length > 0) {
      return `//${tag}[contains(@class,"${semanticClasses[0]}")]`;
    }
    
    // Use stable-looking classes (avoid generated/hash-like classes)
    const stableClass = classes.find(c => 
      c.length > 3 && 
      c.length < 25 && 
      !c.match(/^[a-z0-9_-]{8,}$/i) && // Avoid hash-like classes
      !c.match(/^\w+\d+$/) // Avoid classes ending in numbers
    );
    
    if (stableClass) {
      return `//${tag}[contains(@class,"${stableClass}")]`;
    }
  }

  // Use name attribute for form elements
  const name = element.getAttribute('name');
  if (name) {
    return `//${tag}[@name="${name}"]`;
  }

  // For dynamic content, try to find parent with stable identifier
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    if (parent.id) {
      const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName);
      const index = siblings.indexOf(element) + 1;
      return `//*[@id="${parent.id}"]//${tag}[${index}]`;
    }
    
    const parentTestId = parent.getAttribute('data-testid');
    if (parentTestId) {
      const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName);
      const index = siblings.indexOf(element) + 1;
      return `//*[@data-testid="${parentTestId}"]//${tag}[${index}]`;
    }
    
    parent = parent.parentElement;
  }

  // Simple position-based XPath as last resort
  const siblings = Array.from(element.parentElement?.children || [])
    .filter(sibling => sibling.tagName === element.tagName);
  
  if (siblings.length > 1) {
    const index = siblings.indexOf(element) + 1;
    return `//${tag}[${index}]`;
  }

  return `//${tag}`;
}

// Enhanced extension context management with recovery
let extensionContextValid = true;
let contextCheckInterval: number | null = null;
let lastContextCheck = 0;
const CONTEXT_CHECK_DEBOUNCE = 1000; // 1 second

function checkExtensionContext(): boolean {
  const now = Date.now();
  
  // Debounce context checks to avoid excessive calls
  if (now - lastContextCheck < CONTEXT_CHECK_DEBOUNCE && extensionContextValid) {
    return extensionContextValid;
  }
  
  lastContextCheck = now;
  
  try {
    // Try to access chrome.runtime.id - this will throw if context is invalid
    const id = chrome.runtime?.id;
    if (id) {
      if (!extensionContextValid) {
        showContextRecoveryNotification();
      }
      extensionContextValid = true;
      return true;
    } else {
      if (extensionContextValid) {
        showContextLostNotification();
      }
      extensionContextValid = false;
      return false;
    }
  } catch (error) {
    if (extensionContextValid) {
      showContextLostNotification();
    }
    extensionContextValid = false;
    return false;
  }
}

// Show user-friendly notifications about context status
function showContextLostNotification() {
  showTemporaryNotification(
    '⚠️ Extension Disconnected',
    'Chrome extension context lost. Element recording will continue but may not sync immediately.',
    '#ff9800',
    5000
  );
}

function showContextRecoveryNotification() {
  showTemporaryNotification(
    '✅ Extension Reconnected',
    'Chrome extension context recovered. Syncing any pending recordings...',
    '#4caf50',
    3000
  );
}

function showTemporaryNotification(title: string, message: string, color: string, duration: number) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 70px;
    right: 20px;
    background: white;
    color: #333;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    z-index: 999998;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border-left: 4px solid ${color};
    max-width: 300px;
    animation: slideInRight 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
    <div style="font-size: 12px; opacity: 0.8;">${message}</div>
  `;
  
  // Add animation styles
  if (!document.getElementById('mcp-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'mcp-notification-styles';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes fadeOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Remove after duration
  setTimeout(() => {
    notification.style.animation = 'fadeOutRight 0.3s ease-in forwards';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
}

// Periodically check extension context
function startContextMonitoring() {
  if (contextCheckInterval) {
    clearInterval(contextCheckInterval);
  }
  
  contextCheckInterval = window.setInterval(() => {
    checkExtensionContext();
  }, 5000); // Check every 5 seconds
}

// Initialize context monitoring
checkExtensionContext();
startContextMonitoring();

// Enhanced safe message sending with improved retry logic and notifications
async function safeSendMessage(message: any, retries = 3): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const isContextValid = checkExtensionContext();
    
    if (!isContextValid) {
      
      // Store the message data locally as immediate fallback
      const stored = JSON.parse(localStorage.getItem('mcp-pending-messages') || '[]');
      const messageWithMeta = { 
        ...message, 
        timestamp: Date.now(), 
        attempt,
        contextInvalid: true 
      };
      stored.push(messageWithMeta);
      localStorage.setItem('mcp-pending-messages', JSON.stringify(stored.slice(-50))); // Keep last 50
      
      // Also store recording data in a more accessible format
      if (message.type === 'RECORDING_DATA' && message.payload) {
        const recordedElements = JSON.parse(localStorage.getItem('mcp-recorded-elements') || '[]');
        const elementWithMeta = {
          ...message.payload,
          timestamp: Date.now(),
          storedDueToContextLoss: true,
          page: window.location.href
        };
        recordedElements.push(elementWithMeta);
        localStorage.setItem('mcp-recorded-elements', JSON.stringify(recordedElements.slice(-100)));
        showTemporaryNotification(
          '💾 Element Saved Locally',
          'Element recorded and stored locally. Will sync when extension reconnects.',
          '#2196f3',
          3000
        );
      }
      
      if (attempt < retries) {
        // Wait progressively longer between retries
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return { 
        success: false, 
        error: 'Extension context unavailable after retries',
        storedLocally: true 
      };
    }

    try {
      const response = await chrome.runtime.sendMessage(message);
      if (attempt > 0) {
        showTemporaryNotification(
          '🔄 Sync Successful',
          'Reconnected and synced recording data.',
          '#4caf50',
          2000
        );
      }
      return response;
    } catch (error: any) {
      
      // Check if this is a context invalidation error
      if (error.message?.includes('Extension context invalidated') || 
          error.message?.includes('message channel closed') ||
          error.message?.includes('receiving end does not exist')) {
        extensionContextValid = false;
        
        // Store recording data locally immediately on context loss
        if (message.type === 'RECORDING_DATA' && message.payload) {
          const recordedElements = JSON.parse(localStorage.getItem('mcp-recorded-elements') || '[]');
          const elementWithError = {
            ...message.payload,
            timestamp: Date.now(),
            error: error.message,
            page: window.location.href
          };
          recordedElements.push(elementWithError);
          localStorage.setItem('mcp-recorded-elements', JSON.stringify(recordedElements.slice(-100)));
        }
      }
      
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Final fallback - store locally with error info
        const stored = JSON.parse(localStorage.getItem('mcp-pending-messages') || '[]');
        const failedMessage = { 
          ...message, 
          timestamp: Date.now(), 
          finalError: error.message,
          allAttemptsFailed: true
        };
        stored.push(failedMessage);
        localStorage.setItem('mcp-pending-messages', JSON.stringify(stored.slice(-50)));
        
        showTemporaryNotification(
          '❌ Sync Failed',
          'Could not sync to extension. Data saved locally for manual sync.',
          '#f44336',
          4000
        );
        
        throw error;
      }
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}

class ElementFinder {
  private elementRepo: Record<string, ElementData> = {};

  constructor() {
    this.loadElementRepo();
  }

  private async loadElementRepo() {
    try {
      const response = await safeSendMessage({ type: 'GET_ELEMENT_REPO' });
      if (response?.success) {
        this.elementRepo = response.data;
      }
    } catch (error) {
      console.warn('Failed to load element repository:', error);
    }
  }

  public async findElement(elementId: string): Promise<Element | null> {
    const elementData = this.elementRepo[elementId];
    if (!elementData) {
      return null;
    }

    // Try selectors in priority order (self-healing v1)
    for (const selector of elementData.selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          return element;
        }
      } catch (error) {
        console.warn(`Invalid selector for '${elementId}': ${selector}`, error);
      }
    }

    // If no selectors work, try fallback methods
    return this.findElementWithFallback(elementData);
  }

  private findElementWithFallback(elementData: ElementData): Element | null {
    // Fallback 1: Try to find by text content
    if (elementData.text) {
      const elements = Array.from(document.querySelectorAll(elementData.tag));
      for (const element of elements) {
        if (element.textContent?.trim().includes(elementData.text.trim())) {
          return element;
        }
      }
    }

    // Fallback 2: Try to find by specific attributes
    if (elementData.attributes) {
      for (const [attr, value] of Object.entries(elementData.attributes)) {
        if (attr === 'id' || attr === 'class' || attr === 'name') {
          const selector = `${elementData.tag}[${attr}="${value}"]`;
          try {
            const element = document.querySelector(selector);
            if (element) {
              return element;
            }
          } catch (error) {
            // Continue to next attribute
          }
        }
      }
    }
    return null;
  }

  public generateSelectors(element: Element): string[] {
    const selectors: string[] = [];

    // 1. ID selector (highest priority)
    if (element.id) {
      selectors.push(`#${element.id}`);
    }

    // 2. Class selector
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selectors.push(`.${classes.join('.')}`);
        // Also add individual class selectors
        classes.forEach(cls => selectors.push(`.${cls}`));
      }
    }

    // 3. Name attribute
    const name = element.getAttribute('name');
    if (name) {
      selectors.push(`[name="${name}"]`);
      selectors.push(`${element.tagName.toLowerCase()}[name="${name}"]`);
    }

    // 4. Data attributes
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-')) {
        selectors.push(`[${attr.name}="${attr.value}"]`);
      }
    }

    // 5. Other unique attributes
    const uniqueAttrs = ['href', 'src', 'alt', 'title', 'placeholder'];
    for (const attr of uniqueAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        selectors.push(`[${attr}="${value}"]`);
      }
    }

    // 6. Text-based selector
    const text = element.textContent?.trim();
    if (text && text.length < 50) {
      selectors.push(`${element.tagName.toLowerCase()}:contains("${text}")`);
    }

    // 7. XPath
    selectors.push(this.getXPath(element));

    // 8. CSS selector path
    selectors.push(this.getCSSPath(element));

    return [...new Set(selectors)]; // Remove duplicates
  }

  public getXPath(element: Element): string {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id) {
        selector += `[@id="${current.id}"]`;
        path.unshift(selector);
        break;
      } else {
        const siblings = Array.from(current.parentElement?.children || [])
          .filter(sibling => sibling.tagName === current!.tagName);
        
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `[${index}]`;
        }
        path.unshift(selector);
      }

      current = current.parentElement;
    }

    return '//' + path.join('/');
  }

  private getCSSPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }

      const siblings = Array.from(current.parentElement?.children || [])
        .filter(sibling => sibling.tagName === current!.tagName);
      
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }
}

class DOMActionExecutor {
  private elementFinder: ElementFinder;
  private isRecording = false;
  private recordingCallback: ((element: RecordedElement) => void) | null = null;
  private currentPageName: string | null = null; // Cache the page name

  constructor() {
    this.elementFinder = new ElementFinder();
    this.setupRecording();
  }

  // Public getter for recording state
  public get recording(): boolean {
    return this.isRecording;
  }

  // Public getter for current page name
  public get pageName(): string | null {
    return this.currentPageName;
  }

  public async executeAction(action: UIAction): Promise<ToolResult> {
    try {
      switch (action.type) {
        case 'ui.click':
          return await this.executeClick(action);
        case 'ui.type':
          return await this.executeType(action);
        default:
          return { success: false, error: `Unknown action type: ${(action as any).type}` };
      }
    } catch (error) {
      return {
        success: false,
        error: `Action execution failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async executeClick(action: UIClickAction): Promise<ToolResult> {
    const element = await this.elementFinder.findElement(action.elementId);
    if (!element) {
      return { success: false, error: `Element '${action.elementId}' not found` };
    }

    // Scroll element into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Wait a bit for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create and dispatch click event
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: action.options?.button === 'right' ? 2 : action.options?.button === 'middle' ? 1 : 0,
      ctrlKey: action.options?.modifiers?.includes('ctrl') || false,
      shiftKey: action.options?.modifiers?.includes('shift') || false,
      altKey: action.options?.modifiers?.includes('alt') || false,
      metaKey: action.options?.modifiers?.includes('meta') || false
    });

    element.dispatchEvent(clickEvent);

    // Also trigger HTMLElement click if it's a clickable element
    if (element instanceof HTMLElement) {
      element.click();
    }

    return { 
      success: true, 
      data: { 
        elementId: action.elementId, 
        action: 'click',
        element: element.tagName.toLowerCase()
      } 
    };
  }

  private async executeType(action: UITypeAction): Promise<ToolResult> {
    const element = await this.elementFinder.findElement(action.elementId);
    if (!element) {
      return { success: false, error: `Element '${action.elementId}' not found` };
    }

    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
      return { success: false, error: `Element '${action.elementId}' is not a text input` };
    }

    // Focus the element
    element.focus();

    // Clear if requested
    if (action.options?.clear) {
      element.value = '';
    }

    // Type the text
    const text = action.text;
    const delay = action.options?.delay || 0;

    if (delay > 0) {
      // Type character by character with delay
      for (const char of text) {
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } else {
      // Type all at once
      element.value = action.options?.clear ? text : element.value + text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Trigger change event
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return { 
      success: true, 
      data: { 
        elementId: action.elementId, 
        action: 'type',
        text: text,
        element: element.tagName.toLowerCase()
      } 
    };
  }

  public async executeVerification(preset: VerificationPreset): Promise<ToolResult> {
    const results: any[] = [];
    let allPassed = true;

    for (const check of preset.checks) {
      try {
        const result = await this.executeVerificationCheck(check);
        results.push(result);
        if (!result.passed) {
          allPassed = false;
        }
      } catch (error) {
        const errorResult = {
          check: check.description,
          passed: false,
          error: error instanceof Error ? error.message : String(error)
        };
        results.push(errorResult);
        allPassed = false;
      }
    }

    return {
      success: allPassed,
      data: {
        preset: preset.name,
        totalChecks: preset.checks.length,
        passed: results.filter(r => r.passed).length,
        results
      }
    };
  }

  private async executeVerificationCheck(check: VerificationCheck): Promise<any> {
    let element: Element | null = null;

    // Find element if elementId or selector is provided
    if (check.elementId) {
      element = await this.elementFinder.findElement(check.elementId);
    } else if (check.selector) {
      element = document.querySelector(check.selector);
    }

    switch (check.type) {
      case 'exists':
        return {
          check: check.description,
          passed: element !== null,
          actual: element !== null,
          expected: true
        };

      case 'visible':
        const isVisible = element ? this.isElementVisible(element) : false;
        return {
          check: check.description,
          passed: isVisible,
          actual: isVisible,
          expected: true
        };

      case 'text':
        const actualText = element?.textContent?.trim() || '';
        const expectedText = check.expected;
        const textMatches = actualText.includes(expectedText);
        return {
          check: check.description,
          passed: textMatches,
          actual: actualText,
          expected: expectedText
        };

      case 'attribute':
        const attrValue = element?.getAttribute(check.expected.attribute) || null;
        const expectedAttrValue = check.expected.value;
        const attrMatches = attrValue === expectedAttrValue;
        return {
          check: check.description,
          passed: attrMatches,
          actual: attrValue,
          expected: expectedAttrValue
        };

      case 'count':
        const elements = check.selector ? document.querySelectorAll(check.selector) : [];
        const actualCount = elements.length;
        const expectedCount = check.expected;
        const countMatches = actualCount === expectedCount;
        return {
          check: check.description,
          passed: countMatches,
          actual: actualCount,
          expected: expectedCount
        };

      default:
        throw new Error(`Unknown verification type: ${check.type}`);
    }
  }

  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
  }

  public async startRecording(callback: (element: RecordedElement) => void) {
    this.isRecording = true;
    this.recordingCallback = callback;
    this.showRecordingIndicator();
    
    // Only declare page if we haven't already done so for this page
    if (!this.currentPageName) {
      await this.declareCurrentPage();
    }
  }

  public stopRecording() {
    this.isRecording = false;
    this.recordingCallback = null;
    this.hideRecordingIndicator();
    
    // Clean up highlights
    document.querySelectorAll('.mcp-recorded-highlight, .mcp-hover-highlight').forEach(el => {
      el.classList.remove('mcp-recorded-highlight', 'mcp-hover-highlight');
    });
  }

  private setupRecording() {
    // Create recording indicator
    this.createRecordingIndicator();
    
    document.addEventListener('click', (event) => {
      if (!this.isRecording || !this.recordingCallback) return;

      event.preventDefault();
      event.stopPropagation();

      const element = event.target as Element;
      if (!element) return;

      // Highlight the clicked element
      this.highlightElement(element);

      const recordedElement: RecordedElement = {
        tag: element.tagName.toLowerCase(),
        text: element.textContent?.trim() || undefined,
        attributes: this.getElementAttributes(element),
        xpath: this.elementFinder.generateSelectors(element).find(s => s.startsWith('//')) || '',
        cssSelector: this.elementFinder.generateSelectors(element).find(s => !s.startsWith('//')) || '',
        position: { x: event.clientX, y: event.clientY },
        suggestedIds: this.generateSuggestedIds(element),
        selectors: this.elementFinder.generateSelectors(element),
        page: this.currentPageName || 'Current Page'
      };

      // Show feedback
      this.showRecordingFeedback(element, recordedElement.suggestedIds[0] || 'element');
      
      this.recordingCallback(recordedElement);
    }, true);

    // Add hover effects during recording
    document.addEventListener('mouseover', (event) => {
      if (!this.isRecording) return;
      const element = event.target as Element;
      if (element && element !== document.body && element !== document.documentElement) {
        this.addHoverHighlight(element);
      }
    }, true);

    document.addEventListener('mouseout', (event) => {
      if (!this.isRecording) return;
      const element = event.target as Element;
      if (element) {
        this.removeHoverHighlight(element);
      }
    }, true);
  }

  private getElementAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  private generateSuggestedIds(element: Element): string[] {
    const suggestions: string[] = [];
    
    // Use existing ID if available, but make it unique if needed
    if (element.id) {
      suggestions.push(element.id);
      
      // If ID is likely reused (common pattern), add text-based uniqueness
      const text = element.textContent?.trim();
      if (text && text.length < 30) {
        const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        if (cleanText) {
          suggestions.push(`${element.id}-${cleanText}`);
        }
      }
      
      // Add position-based uniqueness for repeated IDs
      const sameIdElements = document.querySelectorAll(`#${element.id}`);
      if (sameIdElements.length > 1) {
        const index = Array.from(sameIdElements).indexOf(element);
        suggestions.push(`${element.id}-${index + 1}`);
      }
    }

    // Use name attribute with potential uniqueness
    const name = element.getAttribute('name');
    if (name) {
      suggestions.push(name);
      suggestions.push(`${element.tagName.toLowerCase()}-${name}`);
    }

    // Use class-based suggestions with text differentiation
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.trim().split(/\s+/).filter(c => c);
      const text = element.textContent?.trim();
      
      classes.forEach(cls => {
        suggestions.push(cls);
        suggestions.push(`${element.tagName.toLowerCase()}-${cls}`);
        
        // Add text-based uniqueness to class names
        if (text && text.length < 30) {
          const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
          if (cleanText) {
            suggestions.push(`${cls}-${cleanText}`);
          }
        }
      });
    }

    // Use text-based suggestions (primary uniqueness strategy)
    const text = element.textContent?.trim();
    if (text && text.length < 50) {
      const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (cleanText) {
        suggestions.push(cleanText);
        suggestions.push(`${element.tagName.toLowerCase()}-${cleanText}`);
        
        // Add parent context for better uniqueness
        const parentText = element.parentElement?.textContent?.trim();
        if (parentText && parentText !== text && parentText.length < 50) {
          const parentClean = parentText.substring(0, 20).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
          if (parentClean) {
            suggestions.push(`${parentClean}-${cleanText}`);
          }
        }
      }
    }

    // Use data attributes for uniqueness
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-')) {
        const attrValue = attr.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        if (attrValue) {
          suggestions.push(attrValue);
          suggestions.push(`${element.tagName.toLowerCase()}-${attrValue}`);
        }
      }
    }

    // Use role or type with text combination
    const role = element.getAttribute('role');
    const type = element.getAttribute('type');
    if (role) {
      suggestions.push(`${element.tagName.toLowerCase()}-${role}`);
      if (text) {
        const cleanText = text.substring(0, 15).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        suggestions.push(`${role}-${cleanText}`);
      }
    }
    if (type) {
      suggestions.push(`${element.tagName.toLowerCase()}-${type}`);
      if (text) {
        const cleanText = text.substring(0, 15).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        suggestions.push(`${type}-${cleanText}`);
      }
    }

    // Generate position-based fallback only if nothing else works
    if (suggestions.length === 0) {
      const siblings = Array.from(element.parentElement?.children || [])
        .filter(sibling => sibling.tagName === element.tagName);
      const index = siblings.indexOf(element) + 1;
      suggestions.push(`${element.tagName.toLowerCase()}-${index}`);
    }

    // Remove duplicates and return top suggestions
    const uniqueSuggestions = [...new Set(suggestions)].filter(s => s && s.length > 0);
    return uniqueSuggestions.slice(0, 8); // Return top 8 unique suggestions
  }

  private createRecordingIndicator() {
    // Remove existing indicator if present
    const existing = document.getElementById('mcp-recording-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'mcp-recording-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      font-weight: bold;
      z-index: 999999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      display: none;
      animation: pulse 1.5s infinite;
    `;
    indicator.innerHTML = '🔴 Recording - Click elements to capture';
    
    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(indicator);
  }

  private showRecordingIndicator() {
    const indicator = document.getElementById('mcp-recording-indicator');
    if (indicator) {
      indicator.style.display = 'block';
    }
  }

  private hideRecordingIndicator() {
    const indicator = document.getElementById('mcp-recording-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }
  }

  private highlightElement(element: Element) {
    // Remove previous highlights
    document.querySelectorAll('.mcp-recorded-highlight').forEach(el => {
      el.classList.remove('mcp-recorded-highlight');
    });

    // Add highlight to recorded element
    element.classList.add('mcp-recorded-highlight');
    
    // Add highlight styles if not already present
    if (!document.getElementById('mcp-highlight-styles')) {
      const style = document.createElement('style');
      style.id = 'mcp-highlight-styles';
      style.textContent = `
        .mcp-recorded-highlight {
          outline: 3px solid #28a745 !important;
          outline-offset: 2px !important;
          background-color: rgba(40, 167, 69, 0.1) !important;
        }
        .mcp-hover-highlight {
          outline: 2px dashed #007bff !important;
          outline-offset: 1px !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Remove highlight after 3 seconds
    setTimeout(() => {
      element.classList.remove('mcp-recorded-highlight');
    }, 3000);
  }

  private addHoverHighlight(element: Element) {
    element.classList.add('mcp-hover-highlight');
  }

  private removeHoverHighlight(element: Element) {
    element.classList.remove('mcp-hover-highlight');
  }

  private showRecordingFeedback(element: Element, suggestedId: string) {
    // Create temporary feedback bubble
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: absolute;
      background: #28a745;
      color: white;
      padding: 6px 12px;
      border-radius: 15px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      font-weight: bold;
      z-index: 999999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      pointer-events: none;
      animation: fadeInOut 2s forwards;
    `;
    feedback.textContent = `✓ Recorded: ${suggestedId}`;
    
    // Position near the element
    const rect = element.getBoundingClientRect();
    feedback.style.left = `${rect.left + window.scrollX}px`;
    feedback.style.top = `${rect.top + window.scrollY - 40}px`;
    
    // Add fade animation if not exists
    if (!document.getElementById('mcp-feedback-styles')) {
      const style = document.createElement('style');
      style.id = 'mcp-feedback-styles';
      style.textContent = `
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateY(10px); }
          20% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(feedback);
    
    // Remove after animation
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 2000);
  }

  private async declareCurrentPage() {
    try {
      // Get page title and URL
      const pageTitle = document.title || 'Untitled Page';
      const currentUrl = window.location.href;
      const pathname = window.location.pathname;      
      // Create a clean page name - prefer URL path over generic titles
      let pageName = pageTitle;
      
      // If title is too generic or company name, use URL path instead
      const genericTitles = ['swag labs', 'sauce labs', 'demo', 'test', 'home', 'welcome'];
      const isGenericTitle = genericTitles.some(generic => 
        pageTitle.toLowerCase().includes(generic.toLowerCase())
      );      
      if (isGenericTitle || pageTitle.length > 50) {
        // Extract meaningful name from URL path
        const pathParts = pathname.split('/').filter(part => part && part !== 'index.html');
        
        if (pathParts.length > 0) {
          // Use the last meaningful part of the path
          const lastPart = pathParts[pathParts.length - 1];
          // Remove file extensions and clean up
          const cleanPart = lastPart.replace(/\.(html|htm|php|asp|jsp)$/i, '');
          pageName = cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1).replace(/[-_]/g, ' ');
        } else {
          // Check if we're on root/home page - use "Home" instead of domain
          if (pathname === '/' || pathname === '' || pathname === '/index.html') {
            pageName = 'Home';
          } else {
            // Use domain name if no meaningful path
            const domain = window.location.hostname.replace('www.', '');
            pageName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
          }
        }
      }
      
      // Final fallback - ensure we never have an empty page name
      if (!pageName || pageName.trim() === '') {
        pageName = 'Unknown Page';
      }
      
      // Ensure page name is reasonable length
      if (pageName.length > 50) {
        pageName = pageName.substring(0, 50).trim() + '...';
      }

      // Cache the page name to prevent redeclaration
      this.currentPageName = pageName;
      // Send page declaration to background script
      await safeSendMessage({
        type: 'PAGE_DECLARE',
        payload: {
          page: pageName,
          url: currentUrl,
          timestamp: Date.now()
        }
      });
      
      // Show a brief notification
      showTemporaryNotification(
        '📄 Page Context Set',
        `Recording on: ${pageName}`,
        '#2196f3',
        2000
      );
      
    } catch (error) {
      console.warn('Failed to declare current page:', error);
    }
  }

  // Extract clean DOM structure for LLM analysis (MCP-compliant - no private data)
  extractDOMForAnalysis(): any {
    const elements: any[] = [];
    
    // Find all interactive elements for AI analysis
    const interactiveSelectors = [
      'button',
      'input',
      'select', 
      'textarea',
      'a[href]',
      '[role="button"]',
      '[onclick]',
      '.btn',
      '.button',
      'form'
    ];
    
    // Add text verification elements
    const textVerificationSelectors = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', // Headings
      'label', // Form labels
      'p', // Paragraphs
      'span', // Spans (often used for messages)
      'div', // Divs with text content
      '[role="alert"]', '[role="status"]', // ARIA alerts
      '.error', '.success', '.warning', '.message', '.alert', '.notification' // Common message classes
    ];
    
    // Combine all selectors
    const allSelectors = [...interactiveSelectors, ...textVerificationSelectors];
    const foundElements = document.querySelectorAll(allSelectors.join(','));
    
    foundElements.forEach((element) => {
      const tag = element.tagName.toLowerCase();
      
      // Generate xpath for the element
      const xpath = this.elementFinder.getXPath(element);
      
      // Determine if element is interactive
      const isInteractive = interactiveSelectors.some(selector => {
        // Simple check - could be more sophisticated
        return element.matches(selector);
      });
      
      const elementData: any = {
        tag,
        xpath,
        isVisible: this.isElementVisible(element),
        isInteractive
      };

      // Include only non-sensitive structural attributes (NO VALUES OR CONTENT)
      const structuralAttrs = ['id', 'class', 'name', 'type', 'role', 'data-testid'];
      const attrs: Record<string, string> = {};
      
      for (const attr of structuralAttrs) {
        const value = element.getAttribute(attr);
        if (value && attr !== 'value') { // Never include actual values
          attrs[attr] = value;
        }
      }
      
      if (Object.keys(attrs).length > 0) {
        elementData.attributes = attrs;
      }

      // Add text content for verification elements (but limit length for privacy/size)
      const textContent = element.textContent?.trim() || '';
      if (textContent && textContent.length > 2 && textContent.length < 200) {
        elementData.text = textContent;
        elementData.hasText = true;
        elementData.textLength = textContent.length;
      } else {
        elementData.hasText = !!textContent;
        elementData.textLength = textContent.length;
      }

      // Add input type metadata without values
      if (tag === 'input') {
        elementData.inputType = element.getAttribute('type') || 'text';
        elementData.hasPlaceholder = !!(element.getAttribute('placeholder'));
        elementData.isRequired = element.hasAttribute('required');
      }

      // Add form context without content
      if (tag === 'form') {
        elementData.method = element.getAttribute('method') || 'get';
        elementData.hasAction = !!(element.getAttribute('action'));
      }

      // Add text presence info (not actual content)
      elementData.hasText = !!(element.textContent?.trim());
      elementData.textLength = element.textContent?.trim().length || 0;

      elements.push(elementData);
    });
    
    return {
      url: window.location.href,
      title: document.title,
      page: this.currentPageName || 'Current Page', // Add the smart page name
      elements: elements, // This is what the AI service expects
      timestamp: Date.now(),
      // Metadata only - no sensitive content
      elementCounts: {
        interactive: elements.length,
        forms: document.querySelectorAll('form').length,
        inputs: document.querySelectorAll('input').length,
        buttons: document.querySelectorAll('button').length
      }
    };
  }

  private countInteractiveElements(): number {
    const interactiveSelectors = 'button, input, select, textarea, a[href], [role="button"], [onclick]';
    return document.querySelectorAll(interactiveSelectors).length;
  }

  // Optimized AI selector suggestion using compacted DOM data
  async suggestOptimizedSelector(intent: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Use the robust discovery system to find all interactive elements
      const allCandidates = discoverElements(500);
      
      // Show overlay to visualize what was found
      const removeOverlay = showOverlay(allCandidates);
      
      // Auto-remove overlay after 5 seconds
      setTimeout(() => {
        try {
          removeOverlay();
        } catch (e) {
          console.warn('Could not remove overlay:', e);
        }
      }, 5000);
      
      if (allCandidates.length === 0) {
        showTemporaryNotification(
          '❌ No Elements Found',
          'No interactive elements discovered on this page',
          '#f44336',
          3000
        );
        return;
      }
      
      // Store all discovered elements in batches if there are more than 100
      let storedCount = 0;
      const batchSize = 100;
      const totalBatches = Math.ceil(allCandidates.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * batchSize;
        const endIndex = Math.min(startIndex + batchSize, allCandidates.length);
        const batch = allCandidates.slice(startIndex, endIndex);
        
        // Show progress for multiple batches
        if (totalBatches > 1) {
          showTemporaryNotification(
            '📦 Processing Batch',
            `Storing batch ${batchIndex + 1}/${totalBatches} (${batch.length} elements)`,
            '#2196f3',
            2000
          );
        }
        
        let batchStoredCount = 0;
        for (const candidate of batch) {
          try {
            // Ensure we have a proper page name
            if (!this.currentPageName) {
              await this.declareCurrentPage();
            }
            
            // Get the best selector
            const bestSelector = candidate.selectors.find((s: any) => s.stability === 'high') || 
                                candidate.selectors.find((s: any) => s.stability === 'med') || 
                                candidate.selectors[0];
            
            const recordedElement = {
              tag: candidate.tag.toLowerCase(),
              text: candidate.name || '',
              attributes: candidate.testid ? { 'data-testid': candidate.testid } : {},
              xpath: candidate.selectors.find((s: any) => s.type === 'xpath')?.value || '',
              cssSelector: bestSelector?.value || candidate.tag.toLowerCase(),
              position: { x: 0, y: 0 },
              suggestedIds: [`robust-${Date.now()}-${storedCount}`],
              selectors: candidate.selectors.map((s: any) => s.value),
              page: this.currentPageName || document.title || window.location.pathname || 'Current Page',
              // Additional metadata
              id: `robust-${Date.now()}-${storedCount}`,
              type: 'discovery',
              timestamp: new Date().toISOString(),
              url: window.location.href,
              discoveryMethod: 'robust-discovery',
              elementScore: candidate.score,
              elementReasons: candidate.why.join(', '),
              context: candidate.group?.label || null,
              stability: bestSelector?.stability || 'low',
              // Batch information
              batchNumber: batchIndex + 1,
              totalBatches: totalBatches,
              elementIndex: storedCount + 1
            };
            
            // Send to background script for database storage
            await safeSendMessage({
              type: 'RECORDING_DATA',
              payload: recordedElement
            });
            
            storedCount++;
            batchStoredCount++;
          } catch (error) {
            console.warn(`Failed to store candidate:`, candidate, error);
          }
        }        
        // Small delay between batches to avoid overwhelming the system
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Increased to 200ms
        }
      }
      
      const totalTime = Date.now() - startTime;
      
      // Show comprehensive success notification
      showTemporaryNotification(
        '🎯 Elements Discovered',
        totalBatches > 1 
          ? `Found and stored ${storedCount} interactive elements across ${totalBatches} batches`
          : `Found and stored ${storedCount} interactive elements on the page`,
        '#4caf50',
        5000
      );
      
    } catch (error) {
      console.error('❌ Robust discovery failed:', error);
      showTemporaryNotification(
        '❌ Discovery Failed',
        `Error during element discovery: ${error instanceof Error ? error.message : String(error)}`,
        '#f44336',
        5000
      );
    }
  }

  // Legacy AI element suggestion using original approach
  async suggestElements(): Promise<void> {
    try {
      
      // Ensure we have current page name set before extracting DOM data
      if (!this.currentPageName) {
        await this.declareCurrentPage();
      }
      const testResponse = await safeSendMessage({
        type: 'TEST_CONNECTION',
        payload: { test: true }
      });
      
      // Extract DOM structure
      const domData = this.extractDOMForAnalysis();
      
      // Send to background script for LLM processing
      const payload = {
        domData: domData,
        includeCategories: ['authentication', 'navigation', 'form', 'action', 'verification', 'general'],
        maxSuggestions: 100
      };
      
      const response = await safeSendMessage({
        type: 'SUGGEST_ELEMENTS',
        payload: payload
      });
      
      if (response?.success && response?.suggestions) {
        
        // Show notification with results
        showTemporaryNotification(
          '🤖 AI Suggestions Ready',
          `Found ${response.suggestions.length} recommended test elements`,
          '#4caf50',
          3000
        );
        
        // Process and record suggested elements
        let successfullyRecorded = 0;
        
        for (const suggestion of response.suggestions) {
          try {
            
            // Try to find the suggested element in the DOM
            const selector = suggestion.selector || suggestion.locator?.css || suggestion.css;
            
            if (!selector) {
              continue;
            }
            
            const element = document.querySelector(selector);
            
            if (element) {
              try {
                // Record the suggested element
                const recordedElement: RecordedElement = {
                  id: suggestion.elementId || suggestion.id || `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  tag: element.tagName.toLowerCase(),
                  text: element.textContent?.trim() || undefined,
                  attributes: this.getElementAttributes(element),
                  xpath: suggestion.xpath || suggestion.locator?.xpath || this.elementFinder.generateSelectors(element).find(s => s.startsWith('//')) || '',
                  cssSelector: selector,
                  position: { x: 0, y: 0 },
                  suggestedIds: [suggestion.elementId || suggestion.id || 'unknown'],
                  selectors: this.elementFinder.generateSelectors(element),
                  page: this.currentPageName || 'Current Page',
                  aiSuggested: true
                };
                
                // Highlight the suggested element briefly
                this.showRecordingFeedback(element, recordedElement.id || 'unknown');
                
                // Always record AI suggestions directly to background script
                const recordResult = await safeSendMessage({
                  type: 'RECORDING_DATA',
                  payload: recordedElement
                });
                successfullyRecorded++;
              } catch (recordError) {
                console.error('Error creating/recording element:', recordError);
              }
            } else {
              console.warn(`❌ Element not found for selector: ${selector}`);
            }
          } catch (err) {
            console.error('Failed to process suggestion:', suggestion, err);
          }
        }
        
        // Show final summary
        showTemporaryNotification(
          '💾 AI Elements Stored',
          `${successfullyRecorded} AI-suggested elements saved to database`,
          '#2196f3',
          3000
        );
      } else {
        throw new Error(response?.error || 'Failed to get suggestions');
      }
      
    } catch (error) {
      console.error('Failed to suggest elements:', error);
      showTemporaryNotification(
        '❌ AI Suggestion Failed',
        'Could not analyze page structure',
        '#f44336',
        3000
      );
    }
  }
}

// Initialize the DOM action executor
const domActionExecutor = new DOMActionExecutor();

// Reset page name cache when navigating to a new page
let lastUrl = window.location.href;
const checkForPageChange = () => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    // Reset the page name cache in the executor
    (domActionExecutor as any).currentPageName = null;
  }
};

// Check for page changes periodically
setInterval(checkForPageChange, 1000);

// Enhanced message listener with error handling and context recovery
chrome.runtime.onMessage.addListener(async (request, _sender, sendResponse) => {
  
  // Check extension context before processing any message
  const isContextValid = checkExtensionContext();
  
  try {
    if (request.type === 'EXECUTE_ACTION') {
      domActionExecutor.executeAction(request.payload)
        .then(result => {
          sendResponse(result);
        })
        .catch(error => sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        }));
      return true; // Will respond asynchronously
    }

    if (request.type === 'VERIFY_SECTION') {
      domActionExecutor.executeVerification(request.payload)
        .then(result => {
          sendResponse(result);
        })
        .catch(error => sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        }));
      return true; // Will respond asynchronously
    }

    if (request.type === 'START_RECORDING') {
      await domActionExecutor.startRecording(async (recordedElement) => {
        // Send recording data using safe message method
        try {
          await safeSendMessage({
            type: 'RECORDING_DATA',
            payload: recordedElement
          });
        } catch (error) {
          console.error('Failed to send recording data:', error);
          // Data is already stored locally by safeSendMessage
        }
      });
      sendResponse({ success: true, message: 'Recording started' });
      return true;
    }

    if (request.type === 'STOP_RECORDING') {
      domActionExecutor.stopRecording();
      
      // Show confirmation notification
      showTemporaryNotification(
        '⏹️ Recording Stopped',
        'Element recording has been stopped.',
        '#ff9800',
        2000
      );
      
      sendResponse({ success: true, message: 'Recording stopped' });
      return true;
    }

    if (request.type === 'SUGGEST_ELEMENTS') {
      domActionExecutor.suggestElements()
        .then(() => {
          sendResponse({ 
            success: true,
            message: 'Element suggestions processed successfully'
          });
        })
        .catch(error => {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        });
      return true; // Will respond asynchronously
    }

    if (request.type === 'SUGGEST_OPTIMIZED_SELECTOR') {
      const intent = request.payload?.intent;
      if (!intent) {
        sendResponse({ success: false, error: 'Intent is required for optimized suggestion' });
        return false;
      }
      
      domActionExecutor.suggestOptimizedSelector(intent)
        .then(() => {
          sendResponse({ 
            success: true,
            message: `Optimized selector suggestion for "${intent}" completed successfully`
          });
        })
        .catch(error => {
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        });
      return true; // Will respond asynchronously
    }
    sendResponse({ success: false, error: 'Unknown message type' });
    return false;
    
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (contextCheckInterval) {
    clearInterval(contextCheckInterval);
  }
  
  // Stop recording if still active
  domActionExecutor.stopRecording();
});

// Add keyboard shortcut to stop recording (Escape key)
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && domActionExecutor.recording) {
    domActionExecutor.stopRecording();
    
    showTemporaryNotification(
      '⌨️ Recording Stopped',
      'Recording stopped via Escape key.',
      '#ff9800',
      2000
    );
  }
});