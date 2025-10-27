// src/utils/fingerprint.ts
// Build a stable logical key using identity fields + page (MV3-safe; uses Web Crypto).

import type { ElementIdentity } from "../types/element";

export function extractIdentity(el: HTMLElement): ElementIdentity {
  const identity: ElementIdentity = {};
  let node: Element | null = el;
  
  // Get basic tag from the original element
  identity.tag = el.tagName?.toLowerCase?.();
  
  // Debug: Let's see what we're actually working with
  console.log(` DEBUG: Starting identity extraction from element:`, {
    element: el,
    tagName: el.tagName,
    id_property: el.id,
    id_getAttribute: el.getAttribute('id'),
    dataTest_getAttribute: el.getAttribute('data-test'),
    dataTestId_getAttribute: el.getAttribute('data-testid'),
    allAttributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`),
    textContent: el.textContent?.trim()
  });

  // Walk up the DOM tree to find a stable identifier
  while (node && node !== document.body) {
    console.log(` Checking node: ${node.tagName.toLowerCase()} with id="${node.id || 'none'}"`);
    
    // Priority 1: ID attribute (should be unique)
    const id = node.getAttribute('id') || (node as HTMLElement).id;
    if (id && id.trim()) {
      identity.id = id.trim();
      console.log(` Found ID in ancestor: ${id} (${node.tagName.toLowerCase()})`);
      break;
    }
    
    // Priority 2: data-test attribute
    const dataTest = node.getAttribute('data-test');
    if (dataTest && dataTest.trim()) {
      identity['data-test'] = dataTest.trim();
      console.log(` Found data-test in ancestor: ${dataTest} (${node.tagName.toLowerCase()})`);
      break;
    }
    
    // Priority 3: data-testid attribute  
    const dataTestId = node.getAttribute('data-testid');
    if (dataTestId && dataTestId.trim()) {
      identity['data-testid'] = dataTestId.trim();
      console.log(` Found data-testid in ancestor: ${dataTestId} (${node.tagName.toLowerCase()})`);
      break;
    }
    
    // Priority 4: name attribute
    const name = node.getAttribute('name');
    if (name && name.trim()) {
      identity.name = name.trim();
      console.log(` Found name in ancestor: ${name} (${node.tagName.toLowerCase()})`);
      break;
    }
    
    // Priority 5: aria-label
    const ariaLabel = node.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
      identity['aria-label'] = ariaLabel.trim();
      console.log(` Found aria-label in ancestor: ${ariaLabel} (${node.tagName.toLowerCase()})`);
      break;
    }
    
    // Move to parent
    node = node.parentElement;
  }
  
  // Priority 6: role (check original element only)
  const role = el.getAttribute('role');
  if (role && role.trim()) {
    identity.role = role.trim();
    console.log(` Captured role: ${role}`);
  }
  
  // Only use text content if we don't have a unique identifier
  if (!identity.id && !identity['data-test'] && !identity['data-testid'] && !identity.name) {
    const text = el.innerText?.trim().split(/\s+/).slice(0, 3).join(" ").toLowerCase();
    if (text) {
      identity.text = text;
      console.log(` Captured text: ${text}`);
    }
    
    // Class hint as fallback
    const cls = el.classList?.[0];
    if (cls) {
      identity.class_hint = cls.toLowerCase();
      console.log(` Captured class_hint: ${cls}`);
    }
  } else {
    console.log(`⏭️ Skipping text content - have unique identifier`);
  }
  
  console.log(` Final identity object:`, identity);
  
  return identity;
}

export function attributesToObject(el: HTMLElement): Record<string, string> {
  return Object.fromEntries([...el.attributes].map(a => [a.name, a.value]));
}

export async function makeLogicalKey(page: string, ident: ElementIdentity): Promise<string> {
  const parts = [page];
  for (const k of Object.keys(ident).sort()) {
    parts.push(`${k}=${(ident as any)[k]}`);
  }
  const raw = parts.join("|");
  const enc = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-1", enc);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Minimal selector (use your own generator if you have one)
export function simpleCssSelector(el: HTMLElement): string {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const bits: string[] = [];
  let node: HTMLElement | null = el;
  for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
    let sel = node.tagName.toLowerCase();
    if (node.classList.length) sel += "." + [...node.classList].map(CSS.escape).slice(0, 2).join(".");
    const sibs = node.parentElement?.children
      ? [...node.parentElement.children].filter(c => (c as HTMLElement).tagName === node!.tagName)
      : [];
    if (sibs.length > 1) {
      const idx = sibs.indexOf(node);
      sel += `:nth-of-type(${idx + 1})`;
    }
    bits.unshift(sel);
  }
  return bits.join(" > ");
}
