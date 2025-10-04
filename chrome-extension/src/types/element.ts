// Minimal element schema for optimized OpenAI requests
export type El = {
  tag: string;              // "BUTTON", "A", "SELECT"
  xpath: string;            // XPath selector (required by AI service)
  id?: string;
  testid?: string;
  name?: string | null;     // aria-label/title/placeholder or short innerText (≤60)
  attrs?: { role?: string; type?: string; value?: string };
  visible?: boolean;
};

export type SelectorAsk = { 
  intent: string; 
  url: string; 
  elements: El[] 
};

export type SelectorCand = { 
  css?: string; 
  xpath?: string; 
  score?: number; 
  why?: string 
};

export type SelectorResult = { 
  best?: SelectorCand; 
  candidates?: SelectorCand[] 
};