// background/heuristicMatcher.ts - Robust element discovery and click-to-get-locators
import { El, SelectorResult } from '../types/element';

export type Candidate = {
  tag: string;
  id?: string;
  testid?: string;
  name?: string | null;       // aria-label/title/placeholder or short innerText
  role?: string | null;
  type?: string | null;
  visible: boolean;
  // context for repeated elements (e.g., product cards)
  group?: { label?: string; key?: string };
  selectors: Array<{ type: 'css'|'xpath'; value: string; stability: 'high'|'med'|'low' }>;
  score: number;
  why: string[];
};

const INTERACTIVE = new Set(['A','BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY','OPTION']);

function visibleFast(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function accessibleName(el: HTMLElement): string | null {
  return el.getAttribute('aria-label')
      || el.getAttribute('title')
      || (el instanceof HTMLInputElement ? el.placeholder || null : null)
      || (el.innerText || '').trim().replace(/\s+/g,' ').slice(0, 80) || null;
}

// get a card/region label to disambiguate repeated controls
function cardContext(el: HTMLElement): {label?: string, key?: string} | undefined {
  const card = el.closest('[data-testid],[role="article"],[role="group"],[role="region"],article,section,.inventory_item,.card,.tile');
  if (!card) return;
  const nameNode = card.querySelector('h1,h2,h3,[class*="title"],[class*="name"]') as HTMLElement | null;
  const label = nameNode ? (nameNode.innerText || '').trim().replace(/\s+/g,' ').slice(0,80) : undefined;
  const key = (card.getAttribute('data-testid') || label || card.className || '').toLowerCase().replace(/\s+/g,'-').slice(0,80);
  return { label, key };
}

// prefer stable CSS; only use XPath for text fallback
function synthSelectors(el: HTMLElement, name: string | null) {
  const out: Candidate['selectors'] = [];
  const testid = el.getAttribute('data-testid') || el.getAttribute('data-test');
  if (testid) out.push({ type:'css', value:`[data-testid="${cssEsc(testid)}"],[data-test="${cssEsc(testid)}"]`, stability:'high' });
  if (el.id)  out.push({ type:'css', value:`[id="${cssEsc(el.id)}"]`, stability:'high' });

  // targeted attribute forms to avoid brittle nth-child
  const type = (el as HTMLInputElement).type || el.getAttribute('type');
  if (el.tagName === 'BUTTON' && type) out.push({ type:'css', value:`button[type="${cssEsc(type)}"]`, stability:'med' });

  // last resort: text-based XPath (CSS has no :contains)
  if (!out.length && name) {
    out.push({ type:'xpath', value:`//${el.tagName.toLowerCase()}[contains(normalize-space(.),"${xpEsc(name)}")]`, stability:'low' });
  }
  // bare tag as true last resort
  if (!out.length) out.push({ type:'css', value: el.tagName.toLowerCase(), stability:'low' });

  return out;
}

function cssEsc(s: string){ return s.replace(/(["\\])/g,'\\$1'); }
function xpEsc(s: string){ return s.replace(/(["\\])/g,'\\$1'); }

function isCandidate(el: Element) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (INTERACTIVE.has(tag)) return true;
  if (el.hasAttribute('role')) return true;
  if (el.getAttribute('tabindex')) return true;
  if (el.id || el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('name')) return true;
  return false;
}

function rankBase(el: HTMLElement, name: string | null) {
  let s = 0;
  if (el.getAttribute('data-testid') || el.getAttribute('data-test')) s += 3;
  if (el.id) s += 2;
  if (el.tagName === 'BUTTON') s += 2;
  if (el.tagName === 'A' || el.tagName === 'INPUT' || el.tagName === 'SELECT') s += 1;
  if (name) s += 1;
  if (visibleFast(el)) s += 1;
  return s;
}

// Main: discover everything useful on the page (viewport-first)
export function discoverElements(max = 500): Candidate[] {
  const tw = document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n: Node) => isCandidate(n as Element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
  });
  const out: Candidate[] = [];
  let node = tw.currentNode as HTMLElement | null;

  while (node) {
    const vis = visibleFast(node);
    const name = accessibleName(node);
    const ctx = cardContext(node);
    const c: Candidate = {
      tag: node.tagName as any,
      id: node.id || undefined,
      testid: node.getAttribute('data-testid') || node.getAttribute('data-test') || undefined,
      name: name,
      role: node.getAttribute('role'),
      type: (node as HTMLInputElement).type || node.getAttribute('type'),
      visible: vis,
      group: ctx,
      selectors: synthSelectors(node, name),
      score: 0,
      why: []
    };
    c.score = rankBase(node, name);
    if (ctx?.label) { c.score += 0.5; c.why.push(`group:${ctx.label}`); }
    if (c.testid) c.why.push('data-testid');
    if (c.id) c.why.push('id');
    if (c.role) c.why.push(`role:${c.role}`);
    if (c.type) c.why.push(`type:${c.type}`);
    out.push(c);
    node = tw.nextNode() as HTMLElement | null;
  }

  // keep the most promising first and cap total
  out.sort((a,b)=> b.score - a.score);
  return out.slice(0, max);
}

// (optional) simple overlay to visualize picks
export function showOverlay(cands: Candidate[]) {
  const overlay = document.createElement('div');
  overlay.style.position='fixed'; overlay.style.inset='0'; overlay.style.pointerEvents='none';
  overlay.style.zIndex='2147483647';
  document.body.appendChild(overlay);
  cands.forEach(c=>{
    const el = c.id ? document.querySelector(`[id="${cssEsc(c.id)}"]`) :
              c.testid ? document.querySelector(`[data-testid="${cssEsc(c.testid)}"],[data-test="${cssEsc(c.testid)}"]`) : null;
    if (!(el instanceof Element)) return;
    const r = (el as HTMLElement).getBoundingClientRect();
    const box = document.createElement('div');
    box.style.position='absolute'; box.style.left=r.left+'px'; box.style.top=r.top+'px';
    box.style.width=r.width+'px'; box.style.height=r.height+'px';
    box.style.border='2px solid #4f46e5'; box.style.borderRadius='8px';
    box.style.background='rgba(79,70,229,0.08)';
    box.style.pointerEvents='none';
    const label = document.createElement('div');
    label.textContent = (c.group?.label ? `${c.group.label} • ` : '') + (c.name || c.tag);
    label.style.position='absolute'; label.style.top='-20px'; label.style.left='0';
    label.style.background='#4f46e5'; label.style.color='white'; label.style.font='12px/1.2 system-ui';
    label.style.padding='2px 6px'; label.style.borderRadius='6px';
    box.appendChild(label);
    overlay.appendChild(box);
  });
  return () => overlay.remove();
}

// Legacy heuristic matcher for backward compatibility
export function heuristicMatch(intent: string, elements: El[]): SelectorResult {
  
  // Simple fallback for existing code
  return {
    best: {
      css: 'button',
      score: 1,
      why: 'legacy fallback'
    },
    candidates: []
  };
}