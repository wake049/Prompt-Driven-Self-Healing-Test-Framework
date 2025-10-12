// background/heuristicMatcher.ts
// Delegates selector/identity logic to src/types/element.ts

import {
  SelectorStrategy,
  ElementSelectors,
  ElementIdentity,
  ElementPayload,
  deriveSelectors,
  identityFrom,
  computeLogicalKey,
  bestSelectorForIntent 
} from '../types/element';

const INTERACTIVE = new Set(['A','BUTTON','INPUT','SELECT','TEXTAREA','SUMMARY','OPTION']);

function isVisible(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
}

function isCandidate(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (INTERACTIVE.has(el.tagName)) return true;
  if (el.hasAttribute('role')) return true;
  if (el.getAttribute('tabindex')) return true;
  if (el.id || el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('name')) return true;
  return false;
}

function pageUrl(): string {
  // Prefer a stable page key if you have one, else use URL
  return location.href.split('#')[0];
}

export type MatchResult = {
  strategy: SelectorStrategy;
  value: string;              // chosen selector value
  score: number;
  why: string;
  selectors: ElementSelectors; // full set (css/xpath/role/aria)
  identity: ElementIdentity;
  payload: ElementPayload;     // ready to POST to your API/review queue
};

/**
 * Scan DOM → build ElementPayloads (via element.ts functions) → pick best selector.
 * If `intent` provided, bestSelectorForIntent() can bias selection.
 */
export function discoverAndMatch(sessionId: string, intent?: string, max = 400): MatchResult[] {
  const tw = document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n: Node) => (isCandidate(n as Element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)
  });

  const out: MatchResult[] = [];
  let node = tw.currentNode as HTMLElement | null;

  while (node) {
    if (isVisible(node)) {
      // Delegate to element.ts for identity + selectors + logical key
      const identity: ElementIdentity = identityFrom(node);
      const selectors: ElementSelectors = deriveSelectors(node);
      const logical_key = computeLogicalKey(identity);

      // Package as ElementPayload (element.ts defines the shape)
      const payload: ElementPayload = {
        session_id: sessionId,
        page: pageUrl(),
        tag: node.tagName.toLowerCase(),
        text_content: (node.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120),
        attributes: collectAttrs(node),
        css_selector: selectors.css,
        xpath: selectors.xpath,
        position_x: Math.round(node.getBoundingClientRect().left),
        position_y: Math.round(node.getBoundingClientRect().top),
        selectors,
        logical_key,
        identity,
        recorder: 'heuristic'
      };

      // Let element.ts choose the best selector (optionally intent-aware)
      const picked = bestSelectorForIntent(selectors, intent, identity);
      if (picked?.value) {
        out.push({
          strategy: picked.strategy,
          value: picked.value,
          score: picked.score ?? 0,
          why: picked.why ?? '',
          selectors,
          identity,
          payload
        });
      }
    }
    node = tw.nextNode() as HTMLElement | null;
    if (out.length >= max) break;
  }

  // Highest score first
  out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return out;
}

/** Quick overlay for debugging what we picked */
export function showOverlay(results: MatchResult[]): () => void {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '2147483647';
  document.body.appendChild(overlay);

  results.slice(0, 50).forEach(r => {
    const el = tryQuery(r);
    if (!(el instanceof HTMLElement)) return;
    const rect = el.getBoundingClientRect();
    const box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
    box.style.border = '2px solid #4f46e5';
    box.style.borderRadius = '8px';
    box.style.background = 'rgba(79,70,229,0.08)';
    box.style.pointerEvents = 'none';

    const label = document.createElement('div');
    label.textContent = `${r.identity?.name ?? r.identity?.tag ?? 'element'} • ${r.strategy}`;
    label.style.position = 'absolute';
    label.style.top = '-20px';
    label.style.left = '0';
    label.style.background = '#4f46e5';
    label.style.color = 'white';
    label.style.font = '12px/1.2 system-ui';
    label.style.padding = '2px 6px';
    label.style.borderRadius = '6px';

    box.appendChild(label);
    overlay.appendChild(box);
  });

  return () => overlay.remove();
}

// ----------------- helpers -----------------

function collectAttrs(el: HTMLElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) {
    attrs[a.name] = a.value;
  }
  return attrs;
}

function tryQuery(r: MatchResult): Element | null {
  switch (r.strategy) {
    case 'css':
      return r.value ? document.querySelector(r.value) : null;
    case 'xpath': {
      if (!r.value) return null;
      const xp = document.evaluate(r.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return xp.singleNodeValue as Element | null;
    }
    // role/aria could be resolved by your own query helpers if desired
    default:
      return null;
  }
}
