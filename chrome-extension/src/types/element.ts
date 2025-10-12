// src/types/element.ts

export type SelectorStrategy = "css" | "xpath" | "role" | "aria";

export interface ElementIdentity {
  id?: string;
  name?: string;
  ["data-test"]?: string;
  ["data-testid"]?: string;
  ["aria-label"]?: string;
  role?: string;
  tag?: string;
  text?: string;       // short, trimmed snippet
  class_hint?: string; // first class name
}

export interface ElementSelectors {
  css?: string;
  xpath?: string;
  role?: string;
  aria?: string;
}

export interface ElementPayload {
  session_id: string;
  page: string;
  tag?: string;
  text_content?: string;
  attributes?: Record<string, string>;
  css_selector?: string;
  xpath?: string;
  position_x?: number;
  position_y?: number;
  selectors?: ElementSelectors;
  logical_key?: string;    // stable fingerprint
  identity?: ElementIdentity; // optional, for backend review context
  recorder?: string;
}

export interface RecordResult {
  success?: boolean;
  action: "created" | "review_enqueued" | "noop_seen_bumped";
  element?: string;
  review?: any;
  message?: string;
}
export declare function deriveSelectors(el: HTMLElement): ElementSelectors;
export declare function identityFrom(el: HTMLElement): ElementIdentity;
export declare function computeLogicalKey(identity: ElementIdentity): string;
export declare function bestSelectorForIntent(
  selectors: ElementSelectors,
  intent?: string,
  identity?: ElementIdentity
): { strategy: SelectorStrategy; value: string; score: number; why: string };