import type { 
  UIAction, 
  UIClickAction, 
  UITypeAction, 
  ToolResult, 
  ElementData, 
  VerificationPreset,
  VerificationCheck,
  RecordedElement
} from './types';
import apiClient from './api/api-client';


// Stable identity + fingerprint helpers (M4)
// ------------------------------
type ElementIdentity = {
  id?: string;
  name?: string;
  ['data-test']?: string;
  ['data-testid']?: string;
  ['aria-label']?: string;
  role?: string;
  tag?: string;
  text?: string;        // short snippet
  class_hint?: string;  // first class name
};

const IDENTITY_KEYS = ['id','name','data-test','data-testid','aria-label','role'];

function extractIdentity(el: Element): ElementIdentity {
  const ident: ElementIdentity = {};
  for (const k of IDENTITY_KEYS) {
    const v = (el as HTMLElement).getAttribute?.(k) || undefined;
    if (v) (ident as any)[k] = v;
  }
  ident.tag = el.tagName?.toLowerCase?.();
  const text = el.textContent?.trim().split(/\s+/).slice(0,3).join(' ').toLowerCase();
  if (text) ident.text = text;
  const cls = (el as HTMLElement).classList?.[0];
  if (cls) ident.class_hint = cls.toLowerCase();
  return ident;
}

function attributesToObject(el: Element): Record<string,string> {
  const out: Record<string,string> = {};
  for (const a of Array.from(el.attributes ?? [])) out[a.name] = a.value;
  return out;
}

async function makeLogicalKey(page: string, ident: ElementIdentity): Promise<string> {
  const parts = [page, ...Object.keys(ident).sort().map(k => `${k}=${(ident as any)[k]}`)];
  const raw = parts.join('|');
  const enc = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-1', enc);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
}

// Minimal CSS selector (use your ElementFinder if you prefer)
function simpleCssSelector(el: Element): string {
  const h = el as HTMLElement;
  if (h.id) return `#${CSS.escape(h.id)}`;
  const segs: string[] = [];
  let node: HTMLElement | null = h;
  for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
    let sel = node.tagName.toLowerCase();
    if (node.classList.length) sel += '.' + [...node.classList].map(CSS.escape).slice(0,2).join('.');
    const sibs = node.parentElement ? [...node.parentElement.children].filter(c => (c as HTMLElement).tagName === node!.tagName) : [];
    if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(node)+1})`;
    segs.unshift(sel);
  }
  return segs.join(' > ');
}

// ------------------------------
// Your existing robust discovery helpers (unchanged except where noted)
// ------------------------------
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
  const elements = document.querySelectorAll('button, input, a[href], [role="button"], [onclick], select, textarea');
  const candidates: Candidate[] = [];
  Array.from(elements).slice(0, max).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const name = el.textContent?.trim() || el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    const testid = el.getAttribute('data-testid') || '';
    const id = el.id || '';
    const className = el.className || '';
    const selectors: any[] = [];

    if (id) {
      selectors.push({ type: 'css', value: `#${id}`, stability: 'high' });
      selectors.push({ type: 'xpath', value: `//*[@id="${id}"]`, stability: 'high' });
    }
    if (testid) {
      selectors.push({ type: 'css', value: `[data-testid="${testid}"]`, stability: 'high' });
      selectors.push({ type: 'xpath', value: `//*[@data-testid="${testid}"]`, stability: 'high' });
    }
    if (className && typeof className === 'string') {
      const classes = className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selectors.push({ type: 'css', value: `.${classes.join('.')}`, stability: 'med' });
      }
    }
    const nameAttr = el.getAttribute('name');
    if (nameAttr) {
      selectors.push({ type: 'css', value: `${tag}[name="${nameAttr}"]`, stability: 'med' });
    }
    if (name && name.length < 50 && name.length > 0) {
      selectors.push({ type: 'css', value: `${tag}:contains("${name}")`, stability: 'low' });
    }
    selectors.push({
      type: 'css',
      value: `${tag}:nth-of-type(${Array.from(el.parentElement?.children || []).filter(child => child.tagName === el.tagName).indexOf(el) + 1})`,
      stability: 'low'
    });
    selectors.push({ type: 'xpath', value: generateXPath(el), stability: id ? 'high' : testid ? 'high' : 'low' });

    let score = 0.8;
    const why = ['interactive element'];
    let group = {label: 'interactive'};
    if (tag === 'button' || el.getAttribute('role') === 'button') { score = 0.9; why.push('button element'); group = {label: 'buttons'}; }
    else if (tag === 'input') { score = 0.85; why.push('input element'); group = {label: 'inputs'}; }
    else if (tag === 'a') { score = 0.8; why.push('link element'); group = {label: 'links'}; }

    if (id) { score += 0.1; why.push('has ID'); }
    if (testid) { score += 0.1; why.push('has test ID'); }

    candidates.push({ tag, name, testid, selectors, score, why, group });
  });
  return candidates.sort((a, b) => b.score - a.score);
}

function showOverlay(candidates: Candidate[]): () => void {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.8); 
    color: white; padding: 10px; border-radius: 5px; z-index: 999999;
  `;
  overlay.textContent = `Found ${candidates.length} interactive elements`;
  document.body.appendChild(overlay);
  return () => { overlay.parentNode?.removeChild(overlay); };
}

// (generateXPath: unchanged; omitted for brevity — keep your existing implementation)
function generateXPath(element: Element): string {
  if (element.id) return `//*[@id="${element.id}"]`;
  const testid = (element as HTMLElement).getAttribute('data-testid');
  if (testid) return `//*[@data-testid="${testid}"]`;
  const text = element.textContent?.trim();
  const tag = element.tagName.toLowerCase();
  if (text && text.length > 0 && text.length <= 30) {
    if (tag === 'button' || tag === 'a' || (element as HTMLElement).getAttribute('role') === 'button') {
      return `//${tag}[text()="${text}"]`;
    }
    if (text.length <= 15) return `//${tag}[contains(text(),"${text}")]`;
  }
  const ariaLabel = (element as HTMLElement).getAttribute('aria-label');
  if (ariaLabel) return `//${tag}[@aria-label="${ariaLabel}"]`;
  const title = (element as HTMLElement).getAttribute('title');
  if (title) return `//${tag}[@title="${title}"]`;
  const className = (element as HTMLElement).className;
  if (className && typeof className === 'string' && className.trim()) {
    const classes = className.trim().split(/\s+/);
    const stableClass = classes.find(c => c.length > 3 && c.length < 25 && !c.match(/^[a-z0-9_-]{8,}$/i) && !c.match(/^\w+\d+$/));
    if (stableClass) return `//${tag}[contains(@class,"${stableClass}")]`;
  }
  const name = (element as HTMLElement).getAttribute('name');
  if (name) return `//${tag}[@name="${name}"]`;
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
  const siblings = Array.from(element.parentElement?.children || []).filter(s => s.tagName === element.tagName);
  if (siblings.length > 1) return `//${tag}[${siblings.indexOf(element)+1}]`;
  return `//${tag}`;
}

// ------------------------------
// Extension context / notifications (unchanged)
// ------------------------------
let extensionContextValid = true;
let contextCheckInterval: number | null = null;
let lastContextCheck = 0;
const CONTEXT_CHECK_DEBOUNCE = 1000;

function checkExtensionContext(): boolean {
  const now = Date.now();
  if (now - lastContextCheck < CONTEXT_CHECK_DEBOUNCE && extensionContextValid) return extensionContextValid;
  lastContextCheck = now;
  try {
    const id = chrome.runtime?.id;
    if (id) {
      if (!extensionContextValid) showContextRecoveryNotification();
      extensionContextValid = true;
      return true;
    } else {
      if (extensionContextValid) showContextLostNotification();
      extensionContextValid = false;
      return false;
    }
  } catch {
    if (extensionContextValid) showContextLostNotification();
    extensionContextValid = false;
    return false;
  }
}

function showContextLostNotification() {
  showTemporaryNotification('⚠️ Extension Disconnected','Chrome extension context lost. Element recording will continue but may not sync immediately.','#ff9800',5000);
}
function showContextRecoveryNotification() {
  showTemporaryNotification('✅ Extension Reconnected','Chrome extension context recovered. Syncing any pending recordings...','#4caf50',3000);
}
function showTemporaryNotification(title: string, message: string, color: string, duration: number) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed; top: 70px; right: 20px; background: white; color: #333; padding: 12px 16px;
    border-radius: 8px; font-family: Arial, sans-serif; font-size: 14px; z-index: 999998;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3); border-left: 4px solid ${color}; max-width: 300px;
    animation: slideInRight 0.3s ease-out;
  `;
  notification.innerHTML = `<div style="font-weight:bold;margin-bottom:4px;">${title}</div><div style="font-size:12px;opacity:.8;">${message}</div>`;
  if (!document.getElementById('mcp-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'mcp-notification-styles';
    style.textContent = `
      @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes fadeOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    `;
    document.head.appendChild(style);
  }
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'fadeOutRight 0.3s ease-in forwards';
    setTimeout(() => notification.parentNode?.removeChild(notification), 300);
  }, duration);
}

function startContextMonitoring() {
  if (contextCheckInterval) clearInterval(contextCheckInterval);
  contextCheckInterval = window.setInterval(() => { checkExtensionContext(); }, 5000);
}
checkExtensionContext();
startContextMonitoring();

// ------------------------------
// Safe messaging (unchanged logic)
// ------------------------------
async function safeSendMessage(message: any, retries = 3): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const isContextValid = checkExtensionContext();
    if (!isContextValid) {
      const stored = JSON.parse(localStorage.getItem('mcp-pending-messages') || '[]');
      stored.push({ ...message, timestamp: Date.now(), attempt, contextInvalid: true });
      localStorage.setItem('mcp-pending-messages', JSON.stringify(stored.slice(-50)));
      if (message.type === 'RECORDING_DATA' && message.payload) {
        const recordedElements = JSON.parse(localStorage.getItem('mcp-recorded-elements') || '[]');
        recordedElements.push({ ...message.payload, timestamp: Date.now(), storedDueToContextLoss: true, page: window.location.href });
        localStorage.setItem('mcp-recorded-elements', JSON.stringify(recordedElements.slice(-100)));
        showTemporaryNotification('💾 Element Saved Locally','Element recorded and stored locally. Will sync when extension reconnects.','#2196f3',3000);
      }
      if (attempt < retries) { await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 5000))); continue; }
      return { success: false, error: 'Extension context unavailable after retries', storedLocally: true };
    }
    try {
      const response = await chrome.runtime.sendMessage(message);
      if (attempt > 0) showTemporaryNotification('🔄 Sync Successful','Reconnected and synced recording data.','#4caf50',2000);
      return response;
    } catch (error: any) {
      if (error.message?.includes('Extension context invalidated') || 
          error.message?.includes('message channel closed') ||
          error.message?.includes('receiving end does not exist')) {
        extensionContextValid = false;
        if (message.type === 'RECORDING_DATA' && message.payload) {
          const recordedElements = JSON.parse(localStorage.getItem('mcp-recorded-elements') || '[]');
          recordedElements.push({ ...message.payload, timestamp: Date.now(), error: error.message, page: window.location.href });
          localStorage.setItem('mcp-recorded-elements', JSON.stringify(recordedElements.slice(-100)));
        }
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 5000)));
      } else {
        const stored = JSON.parse(localStorage.getItem('mcp-pending-messages') || '[]');
        stored.push({ ...message, timestamp: Date.now(), finalError: error.message, allAttemptsFailed: true });
        localStorage.setItem('mcp-pending-messages', JSON.stringify(stored.slice(-50)));
        showTemporaryNotification('❌ Sync Failed','Could not sync to extension. Data saved locally for manual sync.','#f44336',4000);
        throw error;
      }
    }
  }
  return { success: false, error: 'Max retries exceeded' };
}

chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req?.type === "PING_CONTENT") {
    sendResponse({ ok: true });
    return true;
  }
});

// ------------------------------
// Element finder / executor (kept; unchanged except helper reuse)
// ------------------------------
class ElementFinder {
  private elementRepo: Record<string, ElementData> = {};
  constructor() { this.loadElementRepo(); }
  private async loadElementRepo() {
    try { const response = await safeSendMessage({ type: 'GET_ELEMENT_REPO' });
      if (response?.success) this.elementRepo = response.data;
    } catch (e) { console.warn('Failed to load element repository:', e); }
  }
  public async findElement(elementId: string): Promise<Element | null> {
    const elementData = this.elementRepo[elementId];
    if (!elementData) return null;
    for (const selector of elementData.selectors) {
      try { const element = document.querySelector(selector); if (element) return element as Element; }
      catch (e) { console.warn(`Invalid selector for '${elementId}': ${selector}`, e); }
    }
    return this.findElementWithFallback(elementData);
  }
  private findElementWithFallback(elementData: ElementData): Element | null {
    if (elementData.text) {
      const elements = Array.from(document.querySelectorAll(elementData.tag));
      for (const element of elements) {
        if (element.textContent?.trim().includes(elementData.text.trim())) return element as Element;
      }
    }
    if (elementData.attributes) {
      for (const [attr, value] of Object.entries(elementData.attributes)) {
        if (attr === 'id' || attr === 'class' || attr === 'name') {
          const selector = `${elementData.tag}[${attr}="${value}"]`;
          try { const element = document.querySelector(selector); if (element) return element as Element; } catch {}
        }
      }
    }
    return null;
  }
  public generateSelectors(element: Element): string[] {
    const selectors: string[] = [];
    if ((element as HTMLElement).id) selectors.push(`#${(element as HTMLElement).id}`);
    if ((element as HTMLElement).className && typeof (element as HTMLElement).className === 'string') {
      const classes = (element as HTMLElement).className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) { selectors.push(`.${classes.join('.')}`); classes.forEach(cls => selectors.push(`.${cls}`)); }
    }
    const name = (element as HTMLElement).getAttribute('name');
    if (name) { selectors.push(`[name="${name}"]`); selectors.push(`${element.tagName.toLowerCase()}[name="${name}"]`); }
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-')) selectors.push(`[${attr.name}="${attr.value}"]`);
    }
    for (const attr of ['href','src','alt','title','placeholder']) {
      const v = (element as HTMLElement).getAttribute(attr);
      if (v) selectors.push(`[${attr}="${v}"]`);
    }
    const text = element.textContent?.trim();
    if (text && text.length < 50) selectors.push(`${element.tagName.toLowerCase()}:contains("${text}")`);
    selectors.push(this.getXPath(element));
    selectors.push(this.getCSSPath(element));
    return [...new Set(selectors)];
  }
  public getXPath(element: Element): string { return generateXPath(element); }
  private getCSSPath(element: Element): string {
    const path: string[] = []; let current: Element | null = element;
    while (current && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      if ((current as HTMLElement).id) { selector += `#${(current as HTMLElement).id}`; path.unshift(selector); break; }
      else if ((current as HTMLElement).className && typeof (current as HTMLElement).className === 'string') {
        const classes = (current as HTMLElement).className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) selector += `.${classes.join('.')}`;
      }
      const siblings = Array.from(current.parentElement?.children || []).filter(s => s.tagName === current!.tagName);
      if (siblings.length > 1) selector += `:nth-child(${siblings.indexOf(current)+1})`;
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(' > ');
  }
}

// ------------------------------
// DOM Action Executor (major changes only where noted)
// ------------------------------
class DOMActionExecutor {
  private elementFinder: ElementFinder;
  private isRecording = false;
  private recordingCallback: ((element: RecordedElement) => void) | null = null;
  private currentPageName: string | null = null;

  constructor() {
    this.elementFinder = new ElementFinder();
    this.setupRecording();
  }

  public get recording(): boolean { return this.isRecording; }
  public get pageName(): string | null { return this.currentPageName; }

  public async executeAction(action: UIAction): Promise<ToolResult> {
    try {
      switch (action.type) {
        case 'ui.click': return await this.executeClick(action);
        case 'ui.type': return await this.executeType(action);
        default: return { success: false, error: `Unknown action type: ${(action as any).type}` };
      }
    } catch (error) {
      return { success: false, error: `Action execution failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private async executeClick(action: UIClickAction): Promise<ToolResult> {
    const element = await this.elementFinder.findElement(action.elementId);
    if (!element) return { success: false, error: `Element '${action.elementId}' not found` };
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(r => setTimeout(r, 100));
    const clickEvent = new MouseEvent('click', {
      bubbles: true, cancelable: true,
      button: action.options?.button === 'right' ? 2 : action.options?.button === 'middle' ? 1 : 0,
      ctrlKey: !!action.options?.modifiers?.includes('ctrl'),
      shiftKey: !!action.options?.modifiers?.includes('shift'),
      altKey: !!action.options?.modifiers?.includes('alt'),
      metaKey: !!action.options?.modifiers?.includes('meta')
    });
    element.dispatchEvent(clickEvent);
    if (element instanceof HTMLElement) element.click();
    return { success: true, data: { elementId: action.elementId, action: 'click', element: element.tagName.toLowerCase() } };
  }

  private async executeType(action: UITypeAction): Promise<ToolResult> {
    const element = await this.elementFinder.findElement(action.elementId);
    if (!element) return { success: false, error: `Element '${action.elementId}' not found` };
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
      return { success: false, error: `Element '${action.elementId}' is not a text input` };
    }
    element.focus();
    if (action.options?.clear) element.value = '';
    const text = action.text; const delay = action.options?.delay || 0;
    if (delay > 0) {
      for (const ch of text) { element.value += ch; element.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, delay)); }
    } else {
      element.value = action.options?.clear ? text : element.value + text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true, data: { elementId: action.elementId, action: 'type', text, element: element.tagName.toLowerCase() } };
  }

  public async executeVerification(preset: VerificationPreset): Promise<ToolResult> {
    const results: any[] = []; let allPassed = true;
    for (const check of preset.checks) {
      try {
        const result = await this.executeVerificationCheck(check);
        results.push(result); if (!result.passed) allPassed = false;
      } catch (error) {
        results.push({ check: check.description, passed: false, error: error instanceof Error ? error.message : String(error) });
        allPassed = false;
      }
    }
    return { success: allPassed, data: { preset: preset.name, totalChecks: preset.checks.length, passed: results.filter(r => r.passed).length, results } };
  }

  private async executeVerificationCheck(check: VerificationCheck): Promise<any> {
    let element: Element | null = null;
    if (check.elementId) element = await this.elementFinder.findElement(check.elementId);
    else if (check.selector) element = document.querySelector(check.selector) as Element | null;

    switch (check.type) {
      case 'exists': return { check: check.description, passed: element !== null, actual: element !== null, expected: true };
      case 'visible': {
        const isVisible = element ? this.isElementVisible(element) : false;
        return { check: check.description, passed: isVisible, actual: isVisible, expected: true };
      }
      case 'text': {
        const actualText = element?.textContent?.trim() || '';
        const expectedText = check.expected;
        const textMatches = actualText.includes(expectedText);
        return { check: check.description, passed: textMatches, actual: actualText, expected: expectedText };
      }
      case 'attribute': {
        const attrValue = element?.getAttribute(check.expected.attribute) || null;
        const expectedAttrValue = check.expected.value;
        const attrMatches = attrValue === expectedAttrValue;
        return { check: check.description, passed: attrMatches, actual: attrValue, expected: expectedAttrValue };
      }
      case 'count': {
        const elements = check.selector ? document.querySelectorAll(check.selector) : [];
        const actualCount = elements.length;
        const expectedCount = check.expected;
        return { check: check.description, passed: actualCount === expectedCount, actual: actualCount, expected: expectedCount };
      }
      default: throw new Error(`Unknown verification type: ${check.type}`);
    }
  }

  private isElementVisible(element: Element): boolean {
    const rect = (element as HTMLElement).getBoundingClientRect();
    const style = window.getComputedStyle(element as HTMLElement);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
  }

  public async startRecording(callback: (element: RecordedElement) => void) {
    this.isRecording = true;
    this.recordingCallback = callback;
    this.showRecordingIndicator();
    if (!this.currentPageName) await this.declareCurrentPage();
  }

  public stopRecording() {
    this.isRecording = false;
    this.recordingCallback = null;
    this.hideRecordingIndicator();
    document.querySelectorAll('.mcp-recorded-highlight, .mcp-hover-highlight').forEach(el => {
      el.classList.remove('mcp-recorded-highlight', 'mcp-hover-highlight');
    });
  }

  private setupRecording() {
    this.createRecordingIndicator();
    document.addEventListener('click', async (event) => {
      if (!this.isRecording || !this.recordingCallback) return;
      event.preventDefault();
      event.stopPropagation();

      const element = event.target as Element;
      if (!element) return;

      this.highlightElement(element);

      // Build the existing payload you already send to background:
      const selectorsAll = this.elementFinder.generateSelectors(element);
      const recordedElement: RecordedElement = {
        id: this.generateSuggestedIds(element)[0] || `element-${Date.now()}`,
        tag: element.tagName.toLowerCase(),
        text: element.textContent?.trim() || undefined,
        attributes: this.getElementAttributes(element),
        xpath: selectorsAll.find(s => s.startsWith('//')) || '',
        cssSelector: selectorsAll.find(s => !s.startsWith('//')) || simpleCssSelector(element),
        position: { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY },
        suggestedIds: this.generateSuggestedIds(element),
        selectors: selectorsAll,
        page: this.currentPageName || 'Current Page'
      };

      // ✅ NEW: Also send to backend with logical_key (M4)
      try {
        const sessionId = await ensureSessionId();
        const pageKey = location.hostname + location.pathname;
        const identity = extractIdentity(element);
        const logical_key = await makeLogicalKey(pageKey, identity);

        const backendPayload = {
          id: recordedElement.id,
          session_id: sessionId,
          page: this.currentPageName || pageKey,
          tag: recordedElement.tag,
          text_content: recordedElement.text || '',
          attributes: recordedElement.attributes,
          css_selector: recordedElement.cssSelector,
          xpath: recordedElement.xpath,
          position_x: recordedElement.position.x,
          position_y: recordedElement.position.y,
          selectors: recordedElement.selectors, // This is already an array
          logical_key,
          identity,
          recorder: 'extension'
        };

        // This call should cause the server to enqueue a locator-change review
        // if another active element with the same logical_key has a different selector.
        const apiRes = await apiClient.recordElement(backendPayload, sessionId);
        const data = (apiRes?.data as any) || apiRes;
        const action = data?.action || (data?.success ? 'created' : 'noop_seen_bumped');

        // small visual confirmation matching action
        this.showRecordingFeedback(element, recordedElement.suggestedIds?.[0] || 'element');
        if (action === 'review_enqueued') {
          showTemporaryNotification('📝 Locator Change Queued','Review item created for locator update.','#ff9800',2500);
        }

      } catch (e) {
        console.warn('Backend record failed; will still send to background:', e);
      }

      // Keep your original extension flow & local persistence
      this.recordingCallback(recordedElement);
      await safeSendMessage({ type: 'RECORDING_DATA', payload: recordedElement });
    }, true);

    // Hover highlights during recording
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
      if (element) this.removeHoverHighlight(element);
    }, true);
  }

  private getElementAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) attrs[attr.name] = attr.value;
    return attrs;
  }

  private generateSuggestedIds(element: Element): string[] {
    const suggestions: string[] = [];
    if ((element as HTMLElement).id) {
      suggestions.push((element as HTMLElement).id);
      const text = element.textContent?.trim();
      if (text && text.length < 30) {
        const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g,'-').replace(/^-|-$/g,'');
        if (cleanText) suggestions.push(`${(element as HTMLElement).id}-${cleanText}`);
      }
      const sameIdElements = document.querySelectorAll(`#${(element as HTMLElement).id}`);
      if (sameIdElements.length > 1) suggestions.push(`${(element as HTMLElement).id}-${Array.from(sameIdElements).indexOf(element)+1}`);
    }
    const name = (element as HTMLElement).getAttribute('name');
    if (name) { suggestions.push(name); suggestions.push(`${element.tagName.toLowerCase()}-${name}`); }
    if ((element as HTMLElement).className && typeof (element as HTMLElement).className === 'string') {
      const classes = (element as HTMLElement).className.trim().split(/\s+/).filter(c => c);
      const text = element.textContent?.trim();
      classes.forEach(cls => {
        suggestions.push(cls); suggestions.push(`${element.tagName.toLowerCase()}-${cls}`);
        if (text && text.length < 30) {
          const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
          if (cleanText) suggestions.push(`${cls}-${cleanText}`);
        }
      });
    }
    const text = element.textContent?.trim();
    if (text && text.length < 50) {
      const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
      if (cleanText) {
        suggestions.push(cleanText);
        suggestions.push(`${element.tagName.toLowerCase()}-${cleanText}`);
        const parentText = element.parentElement?.textContent?.trim();
        if (parentText && parentText !== text && parentText.length < 50) {
          const parentClean = parentText.substring(0,20).toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
          if (parentClean) suggestions.push(`${parentClean}-${cleanText}`);
        }
      }
    }
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-')) {
        const v = attr.value.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
        if (v) { suggestions.push(v); suggestions.push(`${element.tagName.toLowerCase()}-${v}`); }
      }
    }
    const role = (element as HTMLElement).getAttribute('role');
    const type = (element as HTMLElement).getAttribute('type');
    if (role) {
      suggestions.push(`${element.tagName.toLowerCase()}-${role}`);
      if (text) suggestions.push(`${role}-${text.substring(0,15).toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')}`);
    }
    if (type) {
      suggestions.push(`${element.tagName.toLowerCase()}-${type}`);
      if (text) suggestions.push(`${type}-${text.substring(0,15).toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')}`);
    }
    if (suggestions.length === 0) {
      const siblings = Array.from(element.parentElement?.children || []).filter(s => s.tagName === element.tagName);
      suggestions.push(`${element.tagName.toLowerCase()}-${siblings.indexOf(element)+1}`);
    }
    return [...new Set(suggestions)].slice(0,8);
  }

  private createRecordingIndicator() {
    const existing = document.getElementById('mcp-recording-indicator'); if (existing) existing.remove();
    const indicator = document.createElement('div');
    indicator.id = 'mcp-recording-indicator';
    indicator.style.cssText = `
      position: fixed; top: 20px; right: 20px; background: #dc3545; color: white; padding: 8px 16px;
      border-radius: 20px; font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; z-index: 999999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3); display: none; animation: pulse 1.5s infinite;
    `;
    indicator.innerHTML = '🔴 Recording - Click elements to capture';
    const style = document.createElement('style');
    style.textContent = `@keyframes pulse { 0% {opacity:1;} 50% {opacity:.7;} 100% {opacity:1;} }`;
    document.head.appendChild(style);
    document.body.appendChild(indicator);
  }
  private showRecordingIndicator() { const el = document.getElementById('mcp-recording-indicator'); if (el) el.style.display = 'block'; }
  private hideRecordingIndicator() { const el = document.getElementById('mcp-recording-indicator'); if (el) el.style.display = 'none'; }

  private highlightElement(element: Element) {
    document.querySelectorAll('.mcp-recorded-highlight').forEach(el => el.classList.remove('mcp-recorded-highlight'));
    element.classList.add('mcp-recorded-highlight');
    if (!document.getElementById('mcp-highlight-styles')) {
      const style = document.createElement('style');
      style.id = 'mcp-highlight-styles';
      style.textContent = `
        .mcp-recorded-highlight { outline: 3px solid #28a745 !important; outline-offset: 2px !important; background-color: rgba(40,167,69,.1) !important; }
        .mcp-hover-highlight { outline: 2px dashed #007bff !important; outline-offset: 1px !important; }
      `;
      document.head.appendChild(style);
    }
    setTimeout(() => element.classList.remove('mcp-recorded-highlight'), 3000);
  }
  private addHoverHighlight(element: Element) { element.classList.add('mcp-hover-highlight'); }
  private removeHoverHighlight(element: Element) { element.classList.remove('mcp-hover-highlight'); }

  private showRecordingFeedback(element: Element, suggestedId: string) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: absolute; background: #28a745; color: white; padding: 6px 12px; border-radius: 15px;
      font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; z-index: 999999; pointer-events: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3); animation: fadeInOut 2s forwards;
    `;
    feedback.textContent = `✓ Recorded: ${suggestedId}`;
    const rect = (element as HTMLElement).getBoundingClientRect();
    feedback.style.left = `${rect.left + window.scrollX}px`;
    feedback.style.top = `${rect.top + window.scrollY - 40}px`;
    if (!document.getElementById('mcp-feedback-styles')) {
      const style = document.createElement('style');
      style.id = 'mcp-feedback-styles';
      style.textContent = `
        @keyframes fadeInOut { 0% {opacity:0; transform: translateY(10px);} 20% {opacity:1; transform: translateY(0);} 80% {opacity:1;} 100% {opacity:0; transform: translateY(-10px);} }
      `;
      document.head.appendChild(style);
    }
    document.body.appendChild(feedback);
    setTimeout(() => feedback.parentNode?.removeChild(feedback), 2000);
  }

  private async declareCurrentPage() {
    try {
      const pageTitle = document.title || 'Untitled Page';
      const currentUrl = window.location.href;
      const pathname = window.location.pathname;
      let pageName = pageTitle;
      const genericTitles = ['swag labs','sauce labs','demo','test','home','welcome'];
      const isGenericTitle = genericTitles.some(g => pageTitle.toLowerCase().includes(g.toLowerCase()));
      if (isGenericTitle || pageTitle.length > 50) {
        const parts = pathname.split('/').filter(p => p && p !== 'index.html');
        if (parts.length > 0) {
          const last = parts[parts.length - 1].replace(/\.(html|htm|php|asp|jsp)$/i, '');
          pageName = last.charAt(0).toUpperCase() + last.slice(1).replace(/[-_]/g, ' ');
        } else if (pathname === '/' || pathname === '' || pathname === '/index.html') {
          pageName = 'Home';
        } else {
          const domain = window.location.hostname.replace('www.','');
          pageName = domain.split('.')[0].replace(/-/g,' ');
          pageName = pageName.charAt(0).toUpperCase() + pageName.slice(1);
        }
      }
      if (!pageName || pageName.trim() === '') pageName = 'Unknown Page';
      if (pageName.length > 50) pageName = pageName.substring(0,50).trim() + '...';

      this.currentPageName = pageName;
      await safeSendMessage({ type: 'PAGE_DECLARE', payload: { page: pageName, url: currentUrl, timestamp: Date.now() } });
      showTemporaryNotification('📄 Page Context Set', `Recording on: ${pageName}`, '#2196f3', 2000);
    } catch (e) {
      console.warn('Failed to declare current page:', e);
    }
  }

  // DOM extraction + AI suggestion helpers (unchanged except tiny comments)
  extractDOMForAnalysis(): any {
    const elements: any[] = [];
    const interactiveSelectors = ['button','input','select','textarea','a[href]','[role="button"]','[onclick]','.btn','.button','form'];
    const textVerificationSelectors = ['h1','h2','h3','h4','h5','h6','label','p','span','div','[role="alert"]','[role="status"]','.error','.success','.warning','.message','.alert','.notification'];
    const allSelectors = [...interactiveSelectors, ...textVerificationSelectors];
    const foundElements = document.querySelectorAll(allSelectors.join(','));
    foundElements.forEach((element) => {
      const tag = element.tagName.toLowerCase();
      const xpath = this.elementFinder.getXPath(element as Element);
      const isInteractive = interactiveSelectors.some(selector => element.matches(selector));
      const elementData: any = { tag, xpath, isVisible: this.isElementVisible(element as Element), isInteractive };
      const structuralAttrs = ['id','class','name','type','role','data-testid'];
      const attrs: Record<string,string> = {};
      for (const attr of structuralAttrs) {
        const value = (element as HTMLElement).getAttribute(attr);
        if (value && attr !== 'value') attrs[attr] = value;
      }
      if (Object.keys(attrs).length > 0) elementData.attributes = attrs;
      const textContent = element.textContent?.trim() || '';
      if (textContent && textContent.length > 2 && textContent.length < 200) {
        elementData.text = textContent; elementData.hasText = true; elementData.textLength = textContent.length;
      } else { elementData.hasText = !!textContent; elementData.textLength = textContent.length; }
      if (tag === 'input') {
        elementData.inputType = (element as HTMLElement).getAttribute('type') || 'text';
        elementData.hasPlaceholder = !!((element as HTMLElement).getAttribute('placeholder'));
        elementData.isRequired = (element as HTMLElement).hasAttribute('required');
      }
      if (tag === 'form') {
        elementData.method = (element as HTMLElement).getAttribute('method') || 'get';
        elementData.hasAction = !!((element as HTMLElement).getAttribute('action'));
      }
      elementData.hasText = !!(element.textContent?.trim());
      elementData.textLength = element.textContent?.trim().length || 0;
      elements.push(elementData);
    });
    return { url: window.location.href, title: document.title, page: this.currentPageName || 'Current Page', elements, timestamp: Date.now(),
      elementCounts: { interactive: elements.length, forms: document.querySelectorAll('form').length, inputs: document.querySelectorAll('input').length, buttons: document.querySelectorAll('button').length } };
  }

  private countInteractiveElements(): number {
    return document.querySelectorAll('button, input, select, textarea, a[href], [role="button"], [onclick]').length;
  }

  async suggestOptimizedSelector(intent: string): Promise<void> {
    const startTime = Date.now();
    try {
      const allCandidates = discoverElements(500);
      const removeOverlay = showOverlay(allCandidates);
      setTimeout(() => { try { removeOverlay(); } catch {} }, 5000);
      if (allCandidates.length === 0) {
        showTemporaryNotification('❌ No Elements Found','No interactive elements discovered on this page','#f44336',3000);
        return;
      }
      let storedCount = 0; const batchSize = 100; const totalBatches = Math.ceil(allCandidates.length / batchSize);
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = allCandidates.slice(batchIndex * batchSize, Math.min((batchIndex+1)*batchSize, allCandidates.length));
        if (totalBatches > 1) showTemporaryNotification('📦 Processing Batch', `Storing batch ${batchIndex+1}/${totalBatches} (${batch.length} elements)`, '#2196f3', 2000);
        for (const candidate of batch) {
          try {
            if (!this.currentPageName) await this.declareCurrentPage();
            const bestSelector = candidate.selectors.find(s => s.stability === 'high') || candidate.selectors.find(s => s.stability === 'med') || candidate.selectors[0];
            const recordedElement: RecordedElement = {
              tag: candidate.tag.toLowerCase(),
              text: candidate.name || '',
              attributes: candidate.testid ? { 'data-testid': candidate.testid } as any : {},
              xpath: candidate.selectors.find(s => s.type === 'xpath')?.value || '',
              cssSelector: bestSelector?.value || candidate.tag.toLowerCase(),
              position: { x: 0, y: 0 },
              suggestedIds: [`robust-${Date.now()}-${storedCount}`],
              selectors: candidate.selectors.map(s => s.value),
              page: this.currentPageName || document.title || window.location.pathname || 'Current Page',
              id: `robust-${Date.now()}-${storedCount}` as any
            };

            await safeSendMessage({ type: 'RECORDING_DATA', payload: recordedElement });
            storedCount++;
          } catch (err) { console.warn('Failed to store candidate:', candidate, err); }
        }
        if (batchIndex < totalBatches - 1) await new Promise(r => setTimeout(r, 200));
      }
      showTemporaryNotification('🎯 Elements Discovered',
        totalBatches > 1 ? `Found and stored ${storedCount} interactive elements across ${totalBatches} batches`
                         : `Found and stored ${storedCount} interactive elements on the page`,
        '#4caf50', 5000);
    } catch (error) {
      console.error('❌ Robust discovery failed:', error);
      showTemporaryNotification('❌ Discovery Failed', `Error during element discovery: ${error instanceof Error ? error.message : String(error)}`, '#f44336', 5000);
    }
  }

  async suggestElements(): Promise<void> {
    try {
      if (!this.currentPageName) await this.declareCurrentPage();
      await safeSendMessage({ type: 'TEST_CONNECTION', payload: { test: true } });
      const domData = this.extractDOMForAnalysis();
      const payload = { domData, includeCategories: ['authentication','navigation','form','action','verification','general'], maxSuggestions: 100 };
      const response = await safeSendMessage({ type: 'SUGGEST_ELEMENTS', payload });
      if (response?.success && response?.suggestions) {
        showTemporaryNotification('🤖 AI Suggestions Ready', `Found ${response.suggestions.length} recommended test elements`, '#4caf50', 3000);
        let ok = 0;
        for (const suggestion of response.suggestions) {
          try {
            const selector = suggestion.selector || suggestion.locator?.css || suggestion.css;
            if (!selector) continue;
            const element = document.querySelector(selector);
            if (element) {
              const selectorsAll = this.elementFinder.generateSelectors(element as Element);
              const recordedElement: RecordedElement = {
                id: suggestion.elementId || suggestion.id || `ai-${Date.now()}-${Math.random().toString(36).substr(2,9)}` as any,
                tag: (element as HTMLElement).tagName.toLowerCase(),
                text: element.textContent?.trim() || undefined,
                attributes: this.getElementAttributes(element as Element),
                xpath: suggestion.xpath || suggestion.locator?.xpath || selectorsAll.find(s => s.startsWith('//')) || '',
                cssSelector: selector,
                position: { x: 0, y: 0 },
                suggestedIds: [suggestion.elementId || suggestion.id || 'unknown'],
                selectors: selectorsAll,
                page: this.currentPageName || 'Current Page',
                aiSuggested: true as any
              };
              this.showRecordingFeedback(element as Element, recordedElement.id || 'unknown' as any);

              await safeSendMessage({ type: 'RECORDING_DATA', payload: recordedElement });
              ok++;
            }
          } catch (err) { console.error('Failed to process suggestion:', suggestion, err); }
        }
        showTemporaryNotification('💾 AI Elements Stored', `${ok} AI-suggested elements saved to database`, '#2196f3', 3000);
      } else {
        throw new Error(response?.error || 'Failed to get suggestions');
      }
    } catch (error) {
      console.error('Failed to suggest elements:', error);
      showTemporaryNotification('❌ AI Suggestion Failed','Could not analyze page structure','#f44336',3000);
    }
  }
}

// ------------------------------
// Session helper for backend calls
// ------------------------------
const RECORDER_SESSION_KEY = 'pdta_session_id';
async function ensureSessionId(): Promise<string> {
  const stored = await chrome.storage?.local.get?.(RECORDER_SESSION_KEY);
  if (stored && stored[RECORDER_SESSION_KEY]) return stored[RECORDER_SESSION_KEY];
  const sid = crypto.randomUUID();
  await chrome.storage?.local.set?.({ [RECORDER_SESSION_KEY]: sid });
  return sid;
}

// ------------------------------
// Init + listeners (kept)
// ------------------------------
const domActionExecutor = new DOMActionExecutor();
let lastUrl = window.location.href;
const checkForPageChange = () => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    (domActionExecutor as any).currentPageName = null;
  }
};
setInterval(checkForPageChange, 1000);

chrome.runtime.onMessage.addListener(async (request, _sender, sendResponse) => {
  const isContextValid = checkExtensionContext();
  try {
    if (request.type === 'EXECUTE_ACTION') {
      domActionExecutor.executeAction(request.payload).then(sendResponse).catch(e => sendResponse({ success:false, error: e?.message || String(e) })); 
      return true;
    }
    if (request.type === 'VERIFY_SECTION') {
      domActionExecutor.executeVerification(request.payload).then(sendResponse).catch(e => sendResponse({ success:false, error: e?.message || String(e) })); 
      return true;
    }
    if (request.type === 'START_RECORDING') {
      await domActionExecutor.startRecording(async (recordedElement) => {
        try { await safeSendMessage({ type: 'RECORDING_DATA', payload: recordedElement }); } 
        catch (e) { console.error('Failed to send recording data:', e); }
      });
      sendResponse({ success: true, message: 'Recording started' }); 
      return true;
    }
    if (request.type === 'STOP_RECORDING') {
      domActionExecutor.stopRecording();
      showTemporaryNotification('⏹️ Recording Stopped','Element recording has been stopped.','#ff9800',2000);
      sendResponse({ success: true, message: 'Recording stopped' }); 
      return true;
    }
    if (request.type === 'SUGGEST_ELEMENTS') {
      domActionExecutor.suggestElements().then(() => sendResponse({ success:true, message:'Element suggestions processed successfully'}))
        .catch(e => sendResponse({ success:false, error: e?.message || String(e)})); 
      return true;
    }
    if (request.type === 'SUGGEST_OPTIMIZED_SELECTOR') {
      const intent = request.payload?.intent;
      if (!intent) { sendResponse({ success:false, error:'Intent is required for optimized suggestion' }); return false; }
      domActionExecutor.suggestOptimizedSelector(intent).then(() => sendResponse({ success:true, message:`Optimized selector suggestion for "${intent}" completed successfully`}))
        .catch(e => sendResponse({ success:false, error: e?.message || String(e)})); 
      return true;
    }
    sendResponse({ success: false, error: 'Unknown message type' });
    return false;
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
});

window.addEventListener('beforeunload', () => {
  if (contextCheckInterval) clearInterval(contextCheckInterval);
  domActionExecutor.stopRecording();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && domActionExecutor.recording) {
    domActionExecutor.stopRecording();
    showTemporaryNotification('⌨️ Recording Stopped','Recording stopped via Escape key.','#ff9800',2000);
  }
});
