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

// Signal extension presence to web pages
// This helps the React frontend detect if the extension is installed
(function signalExtensionPresence() {
  // Method 1: Set a global variable
  (window as any).mcpExtensionInstalled = true;
  (window as any).mcpExtensionVersion = '0.6.0';
  
  // Method 2: Add a data attribute to document
  document.documentElement.setAttribute('data-mcp-extension', 'installed');
  document.documentElement.setAttribute('data-mcp-extension-version', '0.6.0');
  
  // Method 3: Dispatch a custom event
  const extensionEvent = new CustomEvent('mcp-extension-loaded', {
    detail: { 
      version: '0.6.0',
      timestamp: Date.now(),
      extensionId: chrome.runtime?.id || 'unknown'
    }
  });
  document.dispatchEvent(extensionEvent);
  
  // Method 4: Listen for detection requests from the web page
  window.addEventListener('mcp-extension-check', (event) => {
    const responseEvent = new CustomEvent('mcp-extension-response', {
      detail: {
        installed: true,
        version: '0.6.0',
        timestamp: Date.now(),
        originalRequest: (event as CustomEvent).detail
      }
    });
    window.dispatchEvent(responseEvent);
  });
  
  // Method 5: Add to localStorage as a backup
  try {
    localStorage.setItem('mcp-extension-status', JSON.stringify({
      installed: true,
      version: '0.6.0',
      timestamp: Date.now(),
      extensionId: chrome.runtime?.id || 'unknown'
    }));
  } catch (e) {
    // localStorage might not be available
  }
  
  console.log('[MCP Extension] Content script loaded and presence signaled');
})();


// Stable identity + fingerprint helpers (M4)
// ------------------------------
type ElementIdentity = {
  id?: string;
  name?: string;
  'data-test'?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  role?: string;
  href?: string;
  tag?: string;
  text?: string;        // short snippet
  class_hint?: string;  // first class name
};

const IDENTITY_KEYS = ['id','name','data-test','data-testid','aria-label','role','href'];

function extractIdentity(el: Element): ElementIdentity {
  const ident: ElementIdentity = {};
  let node: Element | null = el;
  
  // Get basic tag from the original element
  ident.tag = el.tagName?.toLowerCase?.();
  


  // Walk up the DOM tree to find a stable identifier
  while (node && node !== document.body) {
    // Priority 1: ID attribute (should be unique)
    const id = node.getAttribute('id') || (node as HTMLElement).id;
    if (id && id.trim()) {
      ident.id = id.trim();
      break;
    }
    
    // Priority 2: data-test attribute
    const dataTest = node.getAttribute('data-test');
    if (dataTest && dataTest.trim()) {
      ident['data-test'] = dataTest.trim();
      break;
    }
    
    // Priority 3: data-testid attribute  
    const dataTestId = node.getAttribute('data-testid');
    if (dataTestId && dataTestId.trim()) {
      ident['data-testid'] = dataTestId.trim();
      break;
    }
    
    // Priority 4: name attribute
    const name = node.getAttribute('name');
    if (name && name.trim()) {
      ident.name = name.trim();
      break;
    }
    
    // Priority 5: aria-label
    const ariaLabel = node.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
      ident['aria-label'] = ariaLabel.trim();
      break;
    }
    
    // Move to parent
    node = node.parentElement;
  }
  
  // Priority 6: role (check original element only)
  const role = el.getAttribute('role');
  if (role && role.trim()) {
    ident.role = role.trim();
  }
  
  // Priority 7: href for links (check original element only)
  const href = el.getAttribute('href');
  if (href && href !== '#' && href.trim()) {
    ident.href = href.trim();
  }
  
  // Only use text content if we don't have a unique identifier
  if (!ident.id && !ident['data-test'] && !ident['data-testid'] && !ident.name) {
    const text = el.textContent?.trim().split(/\s+/).slice(0,3).join(' ').toLowerCase();
    if (text) {
      ident.text = text;
    }
    
    // Class hint as fallback
    const cls = (el as HTMLElement).classList?.[0];
    if (cls) {
      ident.class_hint = cls.toLowerCase();
    }
  }
  
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
  const logicalKey = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,'0')).join('');
  
  return logicalKey;
}

// Improved CSS selector that ensures uniqueness
function simpleCssSelector(el: Element): string {
  const h = el as HTMLElement;
  
  // Always check for ID first - this should be most specific
  if (h.id) {
    const escapedId = CSS.escape(h.id);
    // Verify this ID is actually unique before using it
    const elementsWithId = document.querySelectorAll(`#${escapedId}`);
    if (elementsWithId.length === 1) {
      return `#${escapedId}`;
    }
  }
  
  // Check for unique data-testid
  const testId = h.getAttribute('data-testid');
  if (testId) {
    const escapedTestId = CSS.escape(testId);
    const elementsWithTestId = document.querySelectorAll(`[data-testid="${escapedTestId}"]`);
    if (elementsWithTestId.length === 1) {
      return `[data-testid="${escapedTestId}"]`;
    }
  }
  
  // Check for unique name attribute
  const name = h.getAttribute('name');
  if (name) {
    const escapedName = CSS.escape(name);
    const elementsWithName = document.querySelectorAll(`[name="${escapedName}"]`);
    if (elementsWithName.length === 1) {
      return `[name="${escapedName}"]`;
    }
  }
  
  // Build a more specific selector by combining attributes
  const segs: string[] = [];
  let node: HTMLElement | null = h;
  
  for (let depth = 0; node && depth < 5; depth++, node = node.parentElement) {
    let sel = node.tagName.toLowerCase();
    
    // Add ID if available
    if (node.id) {
      sel += `#${CSS.escape(node.id)}`;
      segs.unshift(sel);
      break; // Stop here since we have a unique identifier
    }
    
    // Add classes, but be more selective
    if (node.classList.length) {
      const meaningfulClasses = [...node.classList]
        .filter(cls => cls.length > 2 && !cls.match(/^[a-z0-9_-]{8,}$/)) // Filter out generated classes
        .slice(0, 2)
        .map(CSS.escape);
      if (meaningfulClasses.length > 0) {
        sel += '.' + meaningfulClasses.join('.');
      }
    }
    
    // Add nth-of-type only if needed for uniqueness
    const sibs = node.parentElement ? 
      [...node.parentElement.children].filter(c => (c as HTMLElement).tagName === node!.tagName) : [];
    if (sibs.length > 1) {
      sel += `:nth-of-type(${sibs.indexOf(node) + 1})`;
    }
    
    segs.unshift(sel);
    
    // If we have a parent with an ID, include it and stop here
    if (node.parentElement?.id) {
      const parentSeg = `${node.parentElement.tagName.toLowerCase()}#${CSS.escape(node.parentElement.id)}`;
      segs.unshift(`${parentSeg} > ${sel}`);
      break;
    }
  }
  
  const selector = segs.join(' > ');
  
  // Validate that our selector is unique
  try {
    const matches = document.querySelectorAll(selector);
    if (matches.length === 1) {
      return selector;
    } else {
      // If not unique, add more specificity
      return `${selector}:nth-of-type(${Array.from(h.parentElement?.children || [])
        .filter(c => c.tagName === h.tagName)
        .indexOf(h) + 1})`;
    }
  } catch (e) {
    // If selector is invalid, fall back to a basic one
    return `${h.tagName.toLowerCase()}:nth-of-type(${Array.from(h.parentElement?.children || [])
      .filter(c => c.tagName === h.tagName)
      .indexOf(h) + 1})`;
  }
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
  element: Element; // Add reference to actual DOM element
}

// Generate semantic names based on element attributes and content
function generateSemanticName(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = (element as HTMLElement).id;
  const classes = (element as HTMLElement).className?.split(/\s+/).filter(c => c) || [];
  const textContent = element.textContent?.trim() || '';
  const dataTest = element.getAttribute('data-test');
  const dataTestId = element.getAttribute('data-testid');
  const ariaLabel = element.getAttribute('aria-label');
  const name = element.getAttribute('name');
  const type = element.getAttribute('type');
  const href = element.getAttribute('href');
  
  // Priority 1: Use data-test or data-testid if available (convert to camelCase)
  if (dataTest) {
    return toCamelCase(dataTest);
  }
  if (dataTestId) {
    return toCamelCase(dataTestId);
  }
  
  // Priority 2: Use ID if meaningful (convert to camelCase)
  if (id && id.length > 1 && !id.match(/^[0-9]+$/)) {
    return toCamelCase(id);
  }
  
  // Priority 3: Combine meaningful class names with tag context
  const meaningfulClasses = classes.filter(cls => 
    cls.length > 2 && 
    !cls.match(/^[a-z0-9_-]{8,}$/) && // Filter out generated classes
    !cls.match(/^(col|row|d-|p-|m-|text-|bg-|btn-|container|wrapper|item|element)/) // Filter out utility classes
  );
  
  if (meaningfulClasses.length > 0) {
    // For price elements, prioritize price-related terms
    if (meaningfulClasses.some(cls => cls.includes('price') || cls.includes('cost') || cls.includes('amount'))) {
      const priceClass = meaningfulClasses.find(cls => cls.includes('price') || cls.includes('cost') || cls.includes('amount'));
      const productContext = extractProductContext(element, textContent);
      return productContext ? `${productContext}Price` : toCamelCase(priceClass!);
    }
    
    // For buttons, combine action with context
    if (tag === 'button' || meaningfulClasses.some(cls => cls.includes('btn') || cls.includes('button'))) {
      const actionContext = extractActionContext(element, textContent, meaningfulClasses);
      return actionContext || toCamelCase(meaningfulClasses[0]);
    }
    
    // For links, use href context or class
    if (tag === 'a' && href) {
      const linkContext = extractLinkContext(href, textContent);
      return linkContext || toCamelCase(meaningfulClasses[0]);
    }
    
    return toCamelCase(meaningfulClasses[0]);
  }
  
  // Priority 4: Use name attribute
  if (name) {
    return toCamelCase(name);
  }
  
  // Priority 5: Use aria-label
  if (ariaLabel) {
    return toCamelCase(ariaLabel);
  }
  
  // Priority 6: Generate name from text content
  if (textContent && textContent.length > 0 && textContent.length <= 50) {
    const cleanText = textContent.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    if (cleanText) {
      // For buttons, extract action
      if (tag === 'button' || element.getAttribute('role') === 'button') {
        return toCamelCase(cleanText) + 'Button';
      }
      // For links
      if (tag === 'a') {
        return toCamelCase(cleanText) + 'Link';
      }
      // For price-like content
      if (cleanText.match(/^\$?\d+\.?\d*$/)) {
        const productContext = extractProductContext(element, textContent);
        return productContext ? `${productContext}Price` : 'priceElement';
      }
      return toCamelCase(cleanText);
    }
  }
  
  // Priority 6.5: Use position-based naming for similar elements
  const siblingElements = Array.from(document.querySelectorAll(`.${element.className.split(' ')[0]}`));
  if (siblingElements.length > 1 && siblingElements.includes(element)) {
    const index = siblingElements.indexOf(element) + 1;
    const baseClass = element.className.split(' ')[0];
    if (baseClass && baseClass.length > 2) {
      return `${toCamelCase(baseClass)}${index}`;
    }
  }
  
  // Priority 7: Use type for inputs
  if (tag === 'input' && type) {
    return `${type}Input`;
  }
  
  // Fallback: Generate based on tag and position
  const siblings = Array.from(element.parentElement?.children || []).filter(s => s.tagName === element.tagName);
  const index = siblings.indexOf(element) + 1;
  return `${tag}Element${index}`;
}

// Helper function to convert strings to camelCase
function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^[^a-zA-Z]/, '') // Remove leading non-letters
    .replace(/[^a-zA-Z0-9]/g, ''); // Remove any remaining special chars
}

// Extract product context from surrounding elements
function extractProductContext(element: Element, textContent: string): string | null {
  // Look for product names in nearby elements
  const parent = element.parentElement;
  if (!parent) return null;
  
  // Look for product-related text in siblings or parent
  const searchElements = [
    ...Array.from(parent.children),
    parent,
    parent.parentElement
  ].filter(Boolean) as Element[];
  
  for (const searchEl of searchElements) {
    const text = searchEl.textContent?.toLowerCase() || '';
    
    // Look for specific product names (SauceDemo context)
    if (text.includes('backpack')) return 'backpack';
    if (text.includes('bike light')) return 'bikeLight';
    if (text.includes('bolt') && text.includes('shirt')) return 'boltShirt';
    if (text.includes('fleece') && text.includes('jacket')) return 'fleeceJacket';
    if (text.includes('onesie')) return 'onesie';
    if (text.includes('test.allthethings') || text.includes('red')) return 'redShirt';
    
    // Generic product patterns
    if (text.match(/\b(shirt|jacket|bag|light|gear|item)\b/)) {
      const match = text.match(/\b(shirt|jacket|bag|light|gear|item)\b/);
      return match ? match[1] : null;
    }
  }
  
  return null;
}

// Extract action context for buttons
function extractActionContext(element: Element, textContent: string, classes: string[]): string | null {
  const text = textContent.toLowerCase();
  
  // Common button actions
  if (text.includes('add') && text.includes('cart')) return 'addToCart';
  if (text.includes('login') || text.includes('sign in')) return 'login';
  if (text.includes('logout') || text.includes('sign out')) return 'logout';
  if (text.includes('submit')) return 'submit';
  if (text.includes('cancel')) return 'cancel';
  if (text.includes('close')) return 'close';
  if (text.includes('save')) return 'save';
  if (text.includes('delete') || text.includes('remove')) return 'delete';
  if (text.includes('edit')) return 'edit';
  if (text.includes('menu')) return 'menu';
  if (text.includes('burger')) return 'burgerMenu';
  
  // Check classes for action context
  for (const cls of classes) {
    if (cls.includes('add')) return 'add';
    if (cls.includes('cart')) return 'cart';
    if (cls.includes('login')) return 'login';
    if (cls.includes('submit')) return 'submit';
    if (cls.includes('menu')) return 'menu';
  }
  
  return null;
}

// Extract link context
function extractLinkContext(href: string, textContent: string): string | null {
  const text = textContent.toLowerCase();
  
  // Social media links
  if (href.includes('linkedin') || text.includes('linkedin')) return 'linkedinLink';
  if (href.includes('facebook') || text.includes('facebook')) return 'facebookLink';
  if (href.includes('twitter') || text.includes('twitter')) return 'twitterLink';
  if (href.includes('instagram') || text.includes('instagram')) return 'instagramLink';
  
  // Navigation links
  if (href.includes('about') || text.includes('about')) return 'aboutLink';
  if (href.includes('contact') || text.includes('contact')) return 'contactLink';
  if (href.includes('inventory') || text.includes('inventory')) return 'inventoryLink';
  if (href.includes('cart') || text.includes('cart')) return 'cartLink';
  if (href.includes('home') || text.includes('home')) return 'homeLink';
  
  return null;
}

function discoverElements(max = 500): Candidate[] {
  // Include both interactive AND content/verification elements
  const interactiveElements = Array.from(document.querySelectorAll('button, input, a[href], [role="button"], [onclick], select, textarea'));
  const contentElements = Array.from(document.querySelectorAll('[data-test], [data-testid], .price, .inventory_item_price, [class*="price"], [class*="cost"], [class*="amount"], .title, [class*="title"], .name, [class*="name"], .description, [class*="description"], .product, [class*="product"], .item, [class*="item"]'));
  
  // Combine both sets and remove duplicates
  const allElements = new Set([...interactiveElements, ...contentElements]);
  
  // Filter out meaningless container elements
  const filteredElements = Array.from(allElements).filter(el => {
    // Always keep interactive elements
    if (interactiveElements.includes(el)) return true;
    
    // For content elements, check if they're meaningful containers
    const tag = el.tagName.toLowerCase();
    const hasId = !!(el as HTMLElement).id;
    const hasDataAttrs = el.hasAttribute('data-test') || el.hasAttribute('data-testid');
    const hasClasses = !!(el as HTMLElement).className && typeof (el as HTMLElement).className === 'string' && (el as HTMLElement).className.trim().length > 0;
    const hasText = !!(el.textContent?.trim());
    const hasDirectText = el.childNodes && Array.from(el.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
    
    // Skip generic divs/spans that are just containers
    if ((tag === 'div' || tag === 'span') && !hasId && !hasDataAttrs && !hasClasses) {
      // If it has no identifying attributes, check if it has direct text content
      // or if it's just a wrapper around other elements
      if (!hasDirectText) {
        const childElements = Array.from(el.children);
        // Skip if it's just a wrapper with one child that has the meaningful content
        if (childElements.length === 1) {
          const child = childElements[0];
          const childHasId = !!(child as HTMLElement).id;
          const childHasClasses = !!(child as HTMLElement).className && typeof (child as HTMLElement).className === 'string' && (child as HTMLElement).className.trim().length > 0;
          const childHasDataAttrs = child.hasAttribute('data-test') || child.hasAttribute('data-testid');
          
          // If the child has meaningful attributes, skip the parent container
          if (childHasId || childHasClasses || childHasDataAttrs) {
            return false;
          }
        }
        
        // Also skip if it's a container with multiple children but no direct text
        if (childElements.length > 1 && !hasDirectText) {
          return false;
        }
      }
    }
    
    // Keep elements with meaningful attributes or direct text content
    return hasId || hasDataAttrs || hasClasses || hasDirectText;
  });
  
  const elements = filteredElements;
  
  const candidates: Candidate[] = [];
  elements.slice(0, max).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    
    // Generate semantic name based on selectors and content
    const semanticName = generateSemanticName(el);
    
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
    if (semanticName && semanticName.length < 50 && semanticName.length > 0) {
      selectors.push({ type: 'css', value: `${tag}:contains("${semanticName}")`, stability: 'low' });
    }
    selectors.push({
      type: 'css',
      value: `${tag}:nth-of-type(${Array.from(el.parentElement?.children || []).filter(child => child.tagName === el.tagName).indexOf(el) + 1})`,
      stability: 'low'
    });
    selectors.push({ type: 'xpath', value: generateXPath(el), stability: id ? 'high' : testid ? 'high' : 'low' });

    let score = 0.8;
    const why = [];
    let group = {label: 'interactive'};
    
    // Score interactive elements higher
    if (tag === 'button' || el.getAttribute('role') === 'button') { 
      score = 0.9; 
      why.push('button element'); 
      group = {label: 'buttons'}; 
    }
    else if (tag === 'input') { 
      score = 0.85; 
      why.push('input element'); 
      group = {label: 'inputs'}; 
    }
    else if (tag === 'a') { 
      score = 0.8; 
      why.push('link element'); 
      group = {label: 'links'}; 
    }
    // Score content/verification elements appropriately
    else if (el.classList.contains('price') || el.classList.contains('inventory_item_price') || 
             el.className.includes('price') || el.className.includes('cost') || el.className.includes('amount')) {
      score = 0.75;
      why.push('price element');
      group = {label: 'prices'};
    }
    else if (el.className.includes('title') || el.className.includes('name')) {
      score = 0.7;
      why.push('title/name element');
      group = {label: 'content'};
    }
    else if (el.className.includes('description') || el.className.includes('product') || el.className.includes('item')) {
      score = 0.65;
      why.push('content element');
      group = {label: 'content'};
    }
    else {
      score = 0.6;
      why.push('other element');
      group = {label: 'other'};
    }

    if (id) { score += 0.1; why.push('has ID'); }
    if (testid) { score += 0.1; why.push('has test ID'); }

    candidates.push({ tag, name: semanticName, testid, selectors, score, why, group, element: el });
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
  // Priority 1: ID-based XPath (most reliable)
  if (element.id) {
    const idXPath = `//*[@id="${element.id}"]`;
    // Verify this XPath is unique
    const result = document.evaluate(idXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    if (result.snapshotLength === 1) {
      return idXPath;
    }
  }
  
  // Priority 2: data-testid
  const testid = (element as HTMLElement).getAttribute('data-testid');
  if (testid) {
    const testIdXPath = `//*[@data-testid="${testid}"]`;
    const result = document.evaluate(testIdXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    if (result.snapshotLength === 1) {
      return testIdXPath;
    }
  }
  
  // Priority 3: name attribute
  const name = (element as HTMLElement).getAttribute('name');
  if (name) {
    const nameXPath = `//*[@name="${name}"]`;
    const result = document.evaluate(nameXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    if (result.snapshotLength === 1) {
      return nameXPath;
    }
  }
  
  // Priority 4: Text-based for buttons/links
  const text = element.textContent?.trim();
  const tag = element.tagName.toLowerCase();
  if (text && text.length > 0 && text.length <= 30) {
    if (tag === 'button' || tag === 'a' || (element as HTMLElement).getAttribute('role') === 'button') {
      const textXPath = `//${tag}[normalize-space(text())="${text}"]`;
      const result = document.evaluate(textXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      if (result.snapshotLength === 1) {
        return textXPath;
      }
      
      // Try contains if exact match doesn't work
      if (text.length <= 15) {
        const containsXPath = `//${tag}[contains(normalize-space(text()),"${text}")]`;
        const containsResult = document.evaluate(containsXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        if (containsResult.snapshotLength === 1) {
          return containsXPath;
        }
      }
    }
  }
  
  // Priority 5: aria-label
  const ariaLabel = (element as HTMLElement).getAttribute('aria-label');
  if (ariaLabel) {
    const ariaXPath = `//${tag}[@aria-label="${ariaLabel}"]`;
    const result = document.evaluate(ariaXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    if (result.snapshotLength === 1) {
      return ariaXPath;
    }
  }
  
  // Priority 6: title attribute
  const title = (element as HTMLElement).getAttribute('title');
  if (title) {
    const titleXPath = `//${tag}[@title="${title}"]`;
    const result = document.evaluate(titleXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    if (result.snapshotLength === 1) {
      return titleXPath;
    }
  }
  
  // Priority 7: Class-based (for stable classes)
  const className = (element as HTMLElement).className;
  if (className && typeof className === 'string' && className.trim()) {
    const classes = className.trim().split(/\s+/);
    const stableClass = classes.find(c => 
      c.length > 3 && 
      c.length < 25 && 
      !c.match(/^[a-z0-9_-]{8,}$/i) && 
      !c.match(/^\w+\d+$/)
    );
    if (stableClass) {
      const classXPath = `//${tag}[contains(@class,"${stableClass}")]`;
      const result = document.evaluate(classXPath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      if (result.snapshotLength === 1) {
        return classXPath;
      }
    }
  }
  
  // Priority 8: Look for parent with ID/testid and use relative path
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    if (parent.id) {
      const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName);
      if (siblings.length === 1) {
        return `//*[@id="${parent.id}"]//${tag}`;
      } else {
        const index = siblings.indexOf(element) + 1;
        return `//*[@id="${parent.id}"]//${tag}[${index}]`;
      }
    }
    
    const parentTestId = parent.getAttribute('data-testid');
    if (parentTestId) {
      const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName);
      if (siblings.length === 1) {
        return `//*[@data-testid="${parentTestId}"]//${tag}`;
      } else {
        const index = siblings.indexOf(element) + 1;
        return `//*[@data-testid="${parentTestId}"]//${tag}[${index}]`;
      }
    }
    
    parent = parent.parentElement;
  }
  
  // Priority 9: Position-based (last resort)
  const siblings = Array.from(element.parentElement?.children || []).filter(s => s.tagName === element.tagName);
  if (siblings.length > 1) {
    const index = siblings.indexOf(element) + 1;
    return `//${tag}[${index}]`;
  }
  
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
  showTemporaryNotification(' Extension Disconnected','Chrome extension context lost. Element recording will continue but may not sync immediately.','#ff9800',5000);
}
function showContextRecoveryNotification() {
  showTemporaryNotification(' Extension Reconnected','Chrome extension context recovered. Syncing any pending recordings...','#4caf50',3000);
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
        showTemporaryNotification(' Element Saved Locally','Element recorded and stored locally. Will sync when extension reconnects.','#2196f3',3000);
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
        showTemporaryNotification(' Sync Failed','Could not sync to extension. Data saved locally for manual sync.','#f44336',4000);
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
    const response = await safeSendMessage({ type: 'GET_ELEMENT_REPO' });
      if (response?.success) 
        this.elementRepo = response.data;
  }
  public async findElement(elementId: string): Promise<Element | null> {
    const elementData = this.elementRepo[elementId];
    if (!elementData) return null;
    for (const selector of elementData.selectors) {
        const element = document.querySelector(selector); 
        if (element) 
          return element as Element; 
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
    const h = element as HTMLElement;
    
    // Prioritize ID selector - check if it's unique
    if (h.id) {
      const escapedId = CSS.escape(h.id);
      const idSelector = `#${escapedId}`;
      const idMatches = document.querySelectorAll(idSelector);
      if (idMatches.length === 1) {
        selectors.push(idSelector);
      } else {
        selectors.push(idSelector);
      }
    }
    
    // Check for data-testid
    const testId = h.getAttribute('data-testid');
    if (testId) {
      const testIdSelector = `[data-testid="${CSS.escape(testId)}"]`;
      const testIdMatches = document.querySelectorAll(testIdSelector);
      if (testIdMatches.length === 1) {
        selectors.push(testIdSelector);
      }
    }
    
    // Check for name attribute
    const name = h.getAttribute('name');
    if (name) {
      const nameSelector = `[name="${CSS.escape(name)}"]`;
      const nameMatches = document.querySelectorAll(nameSelector);
      if (nameMatches.length === 1) {
        selectors.push(nameSelector);
      }
      selectors.push(`${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`);
    }
    
    // Class-based selectors
    if (h.className && typeof h.className === 'string') {
      const classes = h.className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        // Full class combination
        const fullClassSelector = `.${classes.map(CSS.escape).join('.')}`;
        const fullClassMatches = document.querySelectorAll(fullClassSelector);
        if (fullClassMatches.length === 1) {
          selectors.push(fullClassSelector);
        }
        
        // Individual meaningful classes
        classes.forEach(cls => {
          if (cls.length > 2 && !cls.match(/^[a-z0-9_-]{8,}$/)) { // Skip auto-generated classes
            const classSelector = `.${CSS.escape(cls)}`;
            const classMatches = document.querySelectorAll(classSelector);
            if (classMatches.length === 1) {
              selectors.push(classSelector);
            }
          }
        });
      }
    }
    
    // Data attributes (other than testid)
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-') && attr.name !== 'data-testid') {
        const dataSelector = `[${attr.name}="${CSS.escape(attr.value)}"]`;
        const dataMatches = document.querySelectorAll(dataSelector);
        if (dataMatches.length === 1) {
          selectors.push(dataSelector);
        }
      }
    }
    
    // Other meaningful attributes
    for (const attr of ['href', 'src', 'alt', 'title', 'placeholder', 'role', 'type']) {
      const value = h.getAttribute(attr);
      if (value) {
        const attrSelector = `[${attr}="${CSS.escape(value)}"]`;
        const attrMatches = document.querySelectorAll(attrSelector);
        if (attrMatches.length === 1) {
          selectors.push(attrSelector);
        }
      }
    }
    
    // Text-based selector (for buttons, links, etc.)
    const text = element.textContent?.trim();
    if (text && text.length < 50 && text.length > 0) {
      const tag = element.tagName.toLowerCase();
      if (['button', 'a', 'span', 'div'].includes(tag)) {
        const textSelector = `${tag}:contains("${text.replace(/"/g, '\\"')}")`;
        selectors.push(textSelector);
      }
    }
    
    // XPath
    selectors.push(this.getXPath(element));
    
    // CSS path as fallback
    selectors.push(this.getCSSPath(element));
    
    // Add the improved simple CSS selector
    selectors.push(simpleCssSelector(element));
    
    // Remove duplicates while preserving order
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

      let element = event.target as Element;
      if (!element) return;

      // Ensure we're working with the actual clicked element, not a child
      // This helps prevent issues with nested elements
      const actualTarget = document.elementFromPoint(
        (event as MouseEvent).clientX, 
        (event as MouseEvent).clientY
      );
      if (actualTarget && actualTarget !== element) {
        // Use the element that's actually at the click coordinates
        element = actualTarget;
      }

      // Prefer a clickable/identified ancestor (link, button, anything with id/data-test/testid)
      const promoted = (element as HTMLElement).closest(
        'a[id],button[id],[data-test],[data-testid],[role="button"],[name],[aria-label],label,input,select,textarea'
      );
      if (promoted) {
        element = promoted;
      }

      this.highlightElement(element);

      // Generate selectors and verify their uniqueness
      const selectorsAll = this.elementFinder.generateSelectors(element);
      
      // Get the primary CSS selector and validate it
      let primaryCssSelector = simpleCssSelector(element);
      
      // Validate that our primary selector actually selects this element
      try {
        const testElement = document.querySelector(primaryCssSelector);
        if (testElement !== element) {
          // Fall back to a more specific selector
          primaryCssSelector = this.generateUniqueSelector(element);
        }
      } catch (e) {
        primaryCssSelector = this.generateUniqueSelector(element);
      }

      // Get primary XPath and validate it
      let primaryXPath = selectorsAll.find(s => s.startsWith('//')) || generateXPath(element);
      
      // Validate XPath
      try {
        const result = document.evaluate(primaryXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (result.singleNodeValue !== element) {
          primaryXPath = this.generateUniqueXPath(element);
        }
      } catch (e) {
        primaryXPath = this.generateUniqueXPath(element);
      }

      const recordedElement: RecordedElement = {
        id: this.generateSuggestedIds(element)[0] || `element-${Date.now()}`,
        tag: element.tagName.toLowerCase(),
        text: element.textContent?.trim() || undefined,
        attributes: this.getElementAttributes(element),
        xpath: primaryXPath,
        cssSelector: primaryCssSelector,
        position: { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY },
        suggestedIds: this.generateSuggestedIds(element),
        selectors: selectorsAll,
        page: this.currentPageName || 'Current Page'
      };

      //  NEW: Also send to backend with logical_key (M4)
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
        // Continue with local recording if backend fails
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

  // Helper method to generate a unique CSS selector
  private generateUniqueSelector(element: Element): string {
    const h = element as HTMLElement;
    
    // Start with the element itself
    let selector = h.tagName.toLowerCase();
    
    // Add ID if available
    if (h.id) {
      return `#${CSS.escape(h.id)}`;
    }
    
    // Add attributes in order of specificity
    const testId = h.getAttribute('data-testid');
    if (testId) {
      return `[data-testid="${CSS.escape(testId)}"]`;
    }
    
    const name = h.getAttribute('name');
    if (name) {
      const nameSelector = `${selector}[name="${CSS.escape(name)}"]`;
      if (document.querySelectorAll(nameSelector).length === 1) {
        return nameSelector;
      }
    }
    
    // Build path to make it unique
    const path: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.documentElement) {
      let seg = current.tagName.toLowerCase();
      
      if ((current as HTMLElement).id) {
        seg += `#${CSS.escape((current as HTMLElement).id)}`;
        path.unshift(seg);
        break;
      }
      
      // Add position if needed
      const siblings = Array.from(current.parentElement?.children || [])
        .filter(s => s.tagName === current!.tagName);
      if (siblings.length > 1) {
        seg += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      
      path.unshift(seg);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }

  // Helper method to generate a unique XPath
  private generateUniqueXPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;
    
    while (current && current !== document.documentElement) {
      const tag = current.tagName.toLowerCase();
      
      if ((current as HTMLElement).id) {
        path.unshift(`*[@id="${(current as HTMLElement).id}"]`);
        break;
      }
      
      const siblings = Array.from(current.parentElement?.children || [])
        .filter(s => s.tagName === current!.tagName);
      
      if (siblings.length === 1) {
        path.unshift(tag);
      } else {
        const index = siblings.indexOf(current) + 1;
        path.unshift(`${tag}[${index}]`);
      }
      
      current = current.parentElement;
    }
    
    return '//' + path.join('/');
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
      showTemporaryNotification(' Page Context Set', `Recording on: ${pageName}`, '#2196f3', 2000);
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
        // If no intent provided, just do local discovery without AI service
        if (!intent || intent.trim() === '') {
          const allCandidates = discoverElements(500);
          const removeOverlay = showOverlay(allCandidates);
          setTimeout(() => { try { removeOverlay(); } catch {} }, 5000);        if (allCandidates.length === 0) {
          showTemporaryNotification(' No Elements Found','No interactive elements discovered on this page','#f44336',3000);
          return;
        }

        // Process and store all discovered elements
        let storedCount = 0;
        for (const candidate of allCandidates.slice(0, 100)) { // Limit to 100 elements
          try {
            if (!this.currentPageName) await this.declareCurrentPage();
            
            const bestSelector = candidate.selectors.find(s => s.stability === 'high') || 
                               candidate.selectors.find(s => s.stability === 'med') || 
                               candidate.selectors[0];
            
            // Generate semantic name for this element
            const semanticName = generateSemanticName(candidate.element);
            const semanticId = semanticName || `element${storedCount}`;
            
            const recordedElement: RecordedElement = {
              tag: candidate.tag.toLowerCase(),
              text: candidate.name || '',
              attributes: candidate.testid ? { 'data-testid': candidate.testid } as any : {},
              xpath: candidate.selectors.find(s => s.type === 'xpath')?.value || '',
              cssSelector: bestSelector?.value || candidate.tag.toLowerCase(),
              position: { x: 0, y: 0 },
              suggestedIds: [semanticId],
              selectors: candidate.selectors.map(s => s.value),
              page: this.currentPageName || document.title || window.location.pathname || 'Current Page',
              id: semanticId as any
            };

            // Record to backend using the same format as click recording
            try {
              const sessionId = await ensureSessionId();
              const pageKey = location.hostname + location.pathname;
              
              // Use extractIdentity on the actual DOM element for proper identity extraction
              const identity = extractIdentity(candidate.element as Element);
              
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
                selectors: recordedElement.selectors,
                logical_key,
                identity,
                recorder: 'ai-discovery'
              };

              await apiClient.recordElement(backendPayload, sessionId);
            } catch (e) {
              // Continue with local storage if backend fails
            }

            // Also send to background script for local storage
            await safeSendMessage({ type: 'RECORDING_DATA', payload: recordedElement });
            storedCount++;
          } catch (err) {
            // Skip elements that fail to process
          }
        }

        showTemporaryNotification(' Elements Discovered', 
          `Found and stored ${storedCount} interactive elements on the page`, '#4caf50', 4000);
        return;
      }

      // Original AI-powered logic for when intent is provided
      const allCandidates = discoverElements(500);
      const removeOverlay = showOverlay(allCandidates);
      setTimeout(() => { try { removeOverlay(); } catch {} }, 5000);
      if (allCandidates.length === 0) {
        showTemporaryNotification(' No Elements Found','No interactive elements discovered on this page','#f44336',3000);
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
            
            // Generate semantic name for this element  
            const semanticName = generateSemanticName(candidate.element);
            const semanticId = semanticName || `element${storedCount}`;
            
            const recordedElement: RecordedElement = {
              tag: candidate.tag.toLowerCase(),
              text: candidate.name || '',
              attributes: candidate.testid ? { 'data-testid': candidate.testid } as any : {},
              xpath: candidate.selectors.find(s => s.type === 'xpath')?.value || '',
              cssSelector: bestSelector?.value || candidate.tag.toLowerCase(),
              position: { x: 0, y: 0 },
              suggestedIds: [semanticId],
              selectors: candidate.selectors.map(s => s.value),
              page: this.currentPageName || document.title || window.location.pathname || 'Current Page',
              id: semanticId as any
            };

            await safeSendMessage({ type: 'RECORDING_DATA', payload: recordedElement });
            storedCount++;
          } catch (err) { 
            // Skip elements that fail to process
          }
        }
        if (batchIndex < totalBatches - 1) await new Promise(r => setTimeout(r, 200));
      }
      showTemporaryNotification(' Elements Discovered',
        totalBatches > 1 ? `Found and stored ${storedCount} interactive elements across ${totalBatches} batches`
                         : `Found and stored ${storedCount} interactive elements on the page`,
        '#4caf50', 5000);
    } catch (error) {
      showTemporaryNotification(' Discovery Failed', `Error during element discovery: ${error instanceof Error ? error.message : String(error)}`, '#f44336', 5000);
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
              
              // Generate semantic name for AI suggestions too
              const semanticName = generateSemanticName(element);
              const semanticId = semanticName || suggestion.elementId || suggestion.id || `aiElement${ok}`;
              
              const recordedElement: RecordedElement = {
                id: semanticId as any,
                tag: (element as HTMLElement).tagName.toLowerCase(),
                text: element.textContent?.trim() || undefined,
                attributes: this.getElementAttributes(element as Element),
                xpath: suggestion.xpath || suggestion.locator?.xpath || selectorsAll.find(s => s.startsWith('//')) || '',
                cssSelector: selector,
                position: { x: 0, y: 0 },
                suggestedIds: [semanticId],
                selectors: selectorsAll,
                page: this.currentPageName || 'Current Page',
                aiSuggested: true as any
              };
              this.showRecordingFeedback(element as Element, recordedElement.id || 'unknown' as any);

              await safeSendMessage({ type: 'RECORDING_DATA', payload: recordedElement });
              ok++;
            }
          } catch (err) { 
            // Skip failed suggestions
          }
        }
        showTemporaryNotification(' AI Elements Stored', `${ok} AI-suggested elements saved to database`, '#2196f3', 3000);
      } else {
        throw new Error(response?.error || 'Failed to get suggestions');
      }
    } catch (error) {
      showTemporaryNotification(' AI Suggestion Failed','Could not analyze page structure','#f44336',3000);
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
        await safeSendMessage({ type: 'RECORDING_DATA', payload: recordedElement });
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
    // NEW: Extract all elements for AI analysis
    if (request.type === 'EXTRACT_ALL_ELEMENTS') {
      try {
        const allElements = extractAllElementsForAI();
        sendResponse({ 
          success: true, 
          data: allElements,
          message: `Extracted ${allElements.elementCount} elements for AI analysis`
        });
      } catch (e) {
        sendResponse({ 
          success: false, 
          error: e instanceof Error ? e.message : 'Failed to extract elements'
        });
      }
      return true;
    }
    if (request.type === 'SUGGEST_ELEMENTS') {
      domActionExecutor.suggestElements().then(() => sendResponse({ success:true, message:'Element suggestions processed successfully'}))
        .catch(e => sendResponse({ success:false, error: e?.message || String(e)})); 
      return true;
    }
    if (request.type === 'SUGGEST_OPTIMIZED_SELECTOR') {
      const intent = request.payload?.intent || '';
      domActionExecutor.suggestOptimizedSelector(intent).then(() => sendResponse({ success:true, message:`Optimized selector suggestion${intent ? ` for "${intent}"` : ''} completed successfully`}))
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

/**
 * NEW: Extract all elements for AI analysis
 * This is the core function that gets all page elements and formats them for AI processing
 */
function extractAllElementsForAI(): any {
  
  // Get all potentially interesting elements
  const selectors = [
    // Interactive elements
    'button', 'input', 'select', 'textarea', 'a[href]', '[role="button"]', '[onclick]',
    // Content elements
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div',
    // Form elements
    'form', 'label', 'fieldset', 'legend',
    // Lists and tables
    'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
    // Media and embedded content
    'img', 'video', 'audio', 'iframe', 'embed',
    // Semantic elements
    'nav', 'header', 'footer', 'main', 'section', 'article', 'aside',
    // Special attributes
    '[data-test]', '[data-testid]', '[id]', '[name]', '[class*="btn"]', '[class*="button"]',
    '[class*="menu"]', '[class*="nav"]', '[class*="price"]', '[class*="cost"]', '[class*="amount"]'
  ];
  
  const foundElements = document.querySelectorAll(selectors.join(', '));
  const elements: any[] = [];
  const elementStats = {
    total: foundElements.length,
    interactive: 0,
    withId: 0,
    withTestId: 0,
    withText: 0,
    forms: 0,
    buttons: 0,
    links: 0,
    inputs: 0
  };

  // Process each element
  foundElements.forEach((element, index) => {
      const elementData = extractElementData(element, index);
      
      // Update stats
      if (elementData.isInteractive) elementStats.interactive++;
      if (elementData.attributes?.id) elementStats.withId++;
      if (elementData.attributes?.['data-testid'] || elementData.attributes?.['data-test']) elementStats.withTestId++;
      if (elementData.text && elementData.text.trim()) elementStats.withText++;
      if (elementData.tag === 'form') elementStats.forms++;
      if (elementData.tag === 'button' || elementData.attributes?.role === 'button') elementStats.buttons++;
      if (elementData.tag === 'a') elementStats.links++;
      if (elementData.tag === 'input') elementStats.inputs++;
      
      elements.push(elementData);
  });

  const pageInfo = {
    url: window.location.href,
    title: document.title,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    documentSize: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight
    }
  };

  const result = {
    pageInfo,
    elements,
    elementStats,
    elementCount: elements.length,
    extractedAt: new Date().toISOString(),
    extractionType: 'full_page_ai_analysis'
  };

  return result;
}

/**
 * Extract detailed data for a single element
 */
function extractElementData(element: Element, index: number): any {
  const tag = element.tagName.toLowerCase();
  const rect = (element as HTMLElement).getBoundingClientRect();
  
  // Basic element info
  const elementData: any = {
    index,
    tag,
    visible: isElementVisible(element),
    position: {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }
  };

  // Attributes
  const attributes: Record<string, string> = {};
  const meaningfulAttrs = ['id', 'class', 'name', 'type', 'role', 'data-test', 'data-testid', 
                          'href', 'src', 'alt', 'title', 'placeholder', 'value', 'for', 
                          'aria-label', 'aria-labelledby', 'aria-describedby'];
  
  meaningfulAttrs.forEach(attr => {
    const value = element.getAttribute(attr);
    if (value !== null && value.trim() !== '') {
      attributes[attr] = value.trim();
    }
  });
  
  if (Object.keys(attributes).length > 0) {
    elementData.attributes = attributes;
  }

  // Text content
  const text = element.textContent?.trim();
  if (text && text.length > 0) {
    elementData.text = text.length > 200 ? text.substring(0, 200) + '...' : text;
    elementData.textLength = text.length;
  }

  // Direct text (not from children)
  const directText = Array.from(element.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent?.trim())
    .filter(text => text && text.length > 0)
    .join(' ')
    .trim();
  
  if (directText) {
    elementData.directText = directText.length > 100 ? directText.substring(0, 100) + '...' : directText;
  }

  // Interactive classification
  const interactiveElements = ['button', 'input', 'select', 'textarea', 'a'];
  const hasInteractiveRole = element.getAttribute('role') === 'button' || 
                           element.hasAttribute('onclick') ||
                           element.getAttribute('tabindex') !== null;
  
  elementData.isInteractive = interactiveElements.includes(tag) || hasInteractiveRole;

  // Special element type classifications
  if (tag === 'input') {
    elementData.inputType = element.getAttribute('type') || 'text';
    elementData.required = element.hasAttribute('required');
  }

  if (tag === 'form') {
    elementData.method = element.getAttribute('method') || 'get';
    elementData.action = element.getAttribute('action') || '';
  }

  if (tag === 'a') {
    const href = element.getAttribute('href');
    elementData.isExternalLink = href && (href.startsWith('http') || href.startsWith('//'));
    elementData.isInternalLink = href && href.startsWith('/');
    elementData.isAnchorLink = href && href.startsWith('#');
  }

  // Generate potential selectors
  elementData.selectors = generateElementSelectors(element);

  // Semantic analysis
  elementData.semanticInfo = analyzeElementSemantics(element, text || '', attributes);

  return elementData;
}

/**
 * Generate multiple selector options for an element
 */
function generateElementSelectors(element: Element): any {
  const selectors: any = {};
  
  // ID selector (highest priority)
  const id = (element as HTMLElement).id;
  if (id) {
    selectors.id = `#${CSS.escape(id)}`;
  }

  // Test ID selectors
  const testId = element.getAttribute('data-testid');
  if (testId) {
    selectors.testId = `[data-testid="${CSS.escape(testId)}"]`;
  }

  const dataTest = element.getAttribute('data-test');
  if (dataTest) {
    selectors.dataTest = `[data-test="${CSS.escape(dataTest)}"]`;
  }

  // Name selector
  const name = element.getAttribute('name');
  if (name) {
    selectors.name = `[name="${CSS.escape(name)}"]`;
  }

  // Class selector
  const className = (element as HTMLElement).className;
  if (className && typeof className === 'string' && className.trim()) {
    const classes = className.trim().split(/\s+/);
    selectors.class = `.${classes.map(CSS.escape).join('.')}`;
    
    // Individual meaningful classes
    const meaningfulClasses = classes.filter(cls => 
      cls.length > 2 && 
      !cls.match(/^[a-z0-9_-]{8,}$/i) && // Avoid generated classes
      !cls.match(/^\w+\d+$/) // Avoid numbered classes
    );
    
    if (meaningfulClasses.length > 0) {
      selectors.meaningfulClass = `.${CSS.escape(meaningfulClasses[0])}`;
    }
  }

  // XPath
  selectors.xpath = generateXPath(element);

  // CSS Path
  selectors.cssPath = generateCSSPath(element);

  return selectors;
}

/**
 * Analyze semantic meaning of element
 */
function analyzeElementSemantics(element: Element, text: string, attributes: Record<string, string>): any {
  const semantics: any = {};
  const tag = element.tagName.toLowerCase();
  
  // Purpose classification
  if (tag === 'button' || attributes.role === 'button') {
    semantics.purpose = 'action';
    semantics.actionType = classifyButtonAction(text, attributes);
  } else if (tag === 'input') {
    semantics.purpose = 'input';
    semantics.inputCategory = classifyInputType(attributes);
  } else if (tag === 'a') {
    semantics.purpose = 'navigation';
    semantics.linkType = classifyLinkType(attributes, text);
  } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    semantics.purpose = 'heading';
    semantics.level = parseInt(tag.substring(1));
  } else if (text && text.length > 0) {
    semantics.purpose = 'content';
    semantics.contentType = classifyContentType(text, attributes, element);
  }

  // Context analysis
  semantics.context = analyzeElementContext(element);

  return semantics;
}

/**
 * Classify button action types
 */
function classifyButtonAction(text: string, attributes: Record<string, string>): string {
  const textLower = text.toLowerCase();
  
  if (textLower.includes('submit') || attributes.type === 'submit') return 'submit';
  if (textLower.includes('save')) return 'save';
  if (textLower.includes('delete') || textLower.includes('remove')) return 'delete';
  if (textLower.includes('edit')) return 'edit';
  if (textLower.includes('cancel')) return 'cancel';
  if (textLower.includes('close')) return 'close';
  if (textLower.includes('login') || textLower.includes('sign in')) return 'login';
  if (textLower.includes('logout') || textLower.includes('sign out')) return 'logout';
  if (textLower.includes('add') && textLower.includes('cart')) return 'addToCart';
  if (textLower.includes('buy') || textLower.includes('purchase')) return 'purchase';
  if (textLower.includes('search')) return 'search';
  if (textLower.includes('filter')) return 'filter';
  if (textLower.includes('sort')) return 'sort';
  if (textLower.includes('menu')) return 'menu';
  
  return 'generic';
}

/**
 * Classify input types
 */
function classifyInputType(attributes: Record<string, string>): string {
  const type = attributes.type || 'text';
  const name = attributes.name || '';
  const placeholder = attributes.placeholder || '';
  
  if (type === 'email' || name.includes('email') || placeholder.includes('email')) return 'email';
  if (type === 'password' || name.includes('password')) return 'password';
  if (type === 'search' || name.includes('search') || placeholder.includes('search')) return 'search';
  if (type === 'tel' || name.includes('phone') || name.includes('tel')) return 'phone';
  if (type === 'url' || name.includes('url') || name.includes('website')) return 'url';
  if (type === 'number' || name.includes('age') || name.includes('quantity')) return 'number';
  if (type === 'date' || name.includes('date')) return 'date';
  if (name.includes('name') && name.includes('first')) return 'firstName';
  if (name.includes('name') && name.includes('last')) return 'lastName';
  if (name.includes('address')) return 'address';
  if (name.includes('city')) return 'city';
  if (name.includes('state')) return 'state';
  if (name.includes('zip') || name.includes('postal')) return 'postalCode';
  
  return type;
}

/**
 * Classify link types
 */
function classifyLinkType(attributes: Record<string, string>, text: string): string {
  const href = attributes.href || '';
  const textLower = text.toLowerCase();
  
  if (href.startsWith('mailto:')) return 'email';
  if (href.startsWith('tel:')) return 'phone';
  if (href.includes('facebook') || textLower.includes('facebook')) return 'social_facebook';
  if (href.includes('twitter') || textLower.includes('twitter')) return 'social_twitter';
  if (href.includes('linkedin') || textLower.includes('linkedin')) return 'social_linkedin';
  if (href.includes('instagram') || textLower.includes('instagram')) return 'social_instagram';
  if (href.startsWith('http') || href.startsWith('//')) return 'external';
  if (href.startsWith('#')) return 'anchor';
  if (href.startsWith('/')) return 'internal';
  
  return 'generic';
}

/**
 * Classify content types
 */
function classifyContentType(text: string, attributes: Record<string, string>, element: Element): string {
  const textLower = text.toLowerCase();
  const className = attributes.class || '';
  
  // Price patterns
  if (text.match(/^\$?\d+\.?\d*$/) || className.includes('price') || className.includes('cost')) {
    return 'price';
  }
  
  // Error/success messages
  if (className.includes('error') || className.includes('alert') || 
      textLower.includes('error') || textLower.includes('invalid')) {
    return 'error';
  }
  
  if (className.includes('success') || textLower.includes('success') || textLower.includes('complete')) {
    return 'success';
  }
  
  // Product/item info
  if (className.includes('title') || className.includes('name') || 
      element.closest('.product, .item, [class*="product"], [class*="item"]')) {
    return 'productInfo';
  }
  
  // Navigation
  if (element.closest('nav, .nav, [class*="nav"], .menu, [class*="menu"]')) {
    return 'navigation';
  }
  
  return 'generic';
}

/**
 * Analyze element context (parent/sibling elements)
 */
function analyzeElementContext(element: Element): any {
  const context: any = {};
  
  // Parent context
  const parent = element.parentElement;
  if (parent) {
    context.parentTag = parent.tagName.toLowerCase();
    context.parentId = parent.id || null;
    context.parentClass = parent.className || null;
    
    // Check for form context
    const form = element.closest('form');
    if (form) {
      context.inForm = true;
      context.formId = form.id || null;
      context.formAction = form.getAttribute('action') || null;
    }
    
    // Check for list context
    const list = element.closest('ul, ol, dl');
    if (list) {
      context.inList = true;
      context.listType = list.tagName.toLowerCase();
    }
    
    // Check for table context
    const table = element.closest('table');
    if (table) {
      context.inTable = true;
      const cell = element.closest('td, th');
      if (cell) {
        context.tableCell = {
          type: cell.tagName.toLowerCase(),
          rowIndex: (cell.parentElement as HTMLTableRowElement)?.rowIndex,
          cellIndex: (cell as HTMLTableCellElement).cellIndex
        };
      }
    }
  }
  
  // Sibling context
  const siblings = Array.from(element.parentElement?.children || []);
  context.siblingCount = siblings.length;
  context.siblingIndex = siblings.indexOf(element);
  
  return context;
}

/**
 * Helper function to check if element is visible
 */
function isElementVisible(element: Element): boolean {
  const rect = (element as HTMLElement).getBoundingClientRect();
  const style = window.getComputedStyle(element as HTMLElement);
  
  return rect.width > 0 && 
         rect.height > 0 && 
         style.visibility !== 'hidden' && 
         style.display !== 'none' && 
         style.opacity !== '0';
}

/**
 * Generate CSS path for element
 */
function generateCSSPath(element: Element): string {
  const path: string[] = [];
  let current: Element | null = element;
  
  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    
    if ((current as HTMLElement).id) {
      selector += `#${CSS.escape((current as HTMLElement).id)}`;
      path.unshift(selector);
      break;
    }
    
    if ((current as HTMLElement).className && typeof (current as HTMLElement).className === 'string') {
      const classes = (current as HTMLElement).className.trim().split(/\s+/).filter(c => c);
      if (classes.length > 0) {
        selector += `.${classes.map(CSS.escape).join('.')}`;
      }
    }
    
    const siblings = Array.from(current.parentElement?.children || [])
      .filter(s => s.tagName === current!.tagName);
    if (siblings.length > 1) {
      selector += `:nth-child(${siblings.indexOf(current) + 1})`;
    }
    
    path.unshift(selector);
    current = current.parentElement;
  }
  
  return path.join(' > ');
}

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
