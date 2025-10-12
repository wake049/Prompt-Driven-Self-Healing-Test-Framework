// src/utils/fingerprint.ts
// Build a stable logical key using identity fields + page (MV3-safe; uses Web Crypto).

import type { ElementIdentity } from "../types/element";

export function extractIdentity(el: HTMLElement): ElementIdentity {
  const important = ["id", "name", "data-test", "data-testid", "aria-label", "role"];
  const identity: ElementIdentity = {};
  for (const key of important) {
    const v = el.getAttribute(key);
    if (v) (identity as any)[key] = v;
  }
  identity.tag = el.tagName.toLowerCase();
  const text = el.innerText?.trim().split(/\s+/).slice(0, 3).join(" ").toLowerCase();
  if (text) identity.text = text;
  const cls = el.classList?.[0];
  if (cls) identity.class_hint = cls.toLowerCase();
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
