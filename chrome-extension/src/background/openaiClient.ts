// background/openaiClient.ts - AI service client wrapper for Chrome extension background script
import { ElementIdentity, ElementPayload } from '../types/element';

/** Local result type for AI selector suggestions (no SelectorResult dependency). */
export type AICandidate = {
  css?: string;
  score: number;
  why: string;
};

export type AISuggestionResult = {
  best?: AICandidate;
  candidates: AICandidate[];
};

/** Active provider configuration from the backend */
type ProviderConfig = {
  provider: string;
  model: string;
  endpoint_url?: string;
  source: string;
  temperature: number;
  max_tokens: number;
};

/** Cached provider configuration */
let cachedProviderConfig: ProviderConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the active AI provider configuration from the backend.
 * Uses database-configured provider if available, falls back to environment defaults.
 */
async function getActiveProvider(tenantId?: string, projectId?: string): Promise<ProviderConfig | null> {
  // Return cached config if valid
  if (cachedProviderConfig && Date.now() < cacheExpiry) {
    return cachedProviderConfig;
  }

  try {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenant_id', tenantId);
    if (projectId) params.append('project_id', projectId);

    const response = await fetch(`http://localhost:3002/api/ai-providers/active?${params.toString()}`);

    if (response.ok) {
      const config = await response.json();
      cachedProviderConfig = config;
      cacheExpiry = Date.now() + CACHE_TTL;
      console.log(`✅ Using provider: ${config.provider} / ${config.model} (${config.source})`);
      return config;
    } else {
      console.warn('⚠️ Failed to fetch provider config, using default');
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching provider config:', error);
    return null;
  }
}

/**
 * Process a single shard of elements with the AI service.
 * Optimized for speed with compact payloads and fast timeouts.
 * 
 * Uses the active AI provider configured in the database.
 */
export async function askShard(
  intent: string,
  url: string,
  els: ElementIdentity[],
  elp: ElementPayload[],
  tenantId?: string,
  projectId?: string
): Promise<AISuggestionResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    // Fetch active provider configuration
    const providerConfig = await getActiveProvider(tenantId, projectId);
    
    if (providerConfig) {
      console.log(`🔧 Using ${providerConfig.provider} provider for element suggestion`);
    }

    // Build compact, index-aligned payload (guard against length mismatch)
    const elements = els.map((el, index) => {
      const p = elp[index]; // may be undefined if arrays differ; guard below
      const attrs = p?.attributes || {};
      return {
        tag: el.tag,
        xpath: p?.xpath, // keep original xpath for fallback if present
        id: el.id,
        name: el.name && el.name.length <= 60 ? el.name : undefined,
        // prefer attributes from payload; identities only include role-like hints via attributes map
        attrs: {
          role: attrs['role'],
          type: attrs['type'],
          value:
            attrs['value'] && typeof attrs['value'] === 'string' && attrs['value'].length <= 20
              ? attrs['value']
              : undefined,
          // include common testing hooks if present
          'data-testid': el['data-testid'],
          'data-test': el['data-test'],
          'aria-label': el['aria-label'],
        },
      };
    });

    const requestPayload = {
      domData: {
        title: `Intent: ${intent}`,
        url,
        elements,
      },
      options: {
        maxSuggestions: 20,
        confidenceThreshold: 0.7,
        useHeuristicFallback: true,
        includeCategories: ['authentication', 'navigation', 'form', 'action', 'general'],
      },
    };

    const response = await fetch('http://localhost:3002/api/ai/suggest-elements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI service responded with ${response.status}`);
    }

    const data = await response.json();

    // Normalize suggestions from service to local type
    const candidates: AICandidate[] =
      data.suggestions?.map((s: any) => ({
        css: s.selector || s.css,
        score: s.confidence ?? s.score ?? 0.5,
        why: s.reasoning || 'AI suggested',
      })) ?? [];

    return {
      best: candidates[0],
      candidates,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    // Retry logic for timeouts or server errors
    if (error?.name === 'AbortError' || (typeof error?.message === 'string' && /^(5\d\d|.*500)/.test(error.message))) {

      // Jittered backoff: 250–750ms
      const delay = 250 + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));

      try {
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 5000);

        // Smaller request on retry
        const retryElements = els.map((el, index) => {
          const p = elp[index];
          const attrs = p?.attributes || {};
          return {
            tag: el.tag,
            xpath: p?.xpath, // fallback
            id: el.id,
            name: el.name && el.name.length <= 60 ? el.name : undefined,
            attrs: {
              role: attrs['role'],
              type: attrs['type'],
              value:
                attrs['value'] && typeof attrs['value'] === 'string' && attrs['value'].length <= 20
                  ? attrs['value']
                  : undefined,
              'data-testid': el['data-testid'],
              'data-test': el['data-test'],
              'aria-label': el['aria-label'],
            },
          };
        });

        const retryResponse = await fetch('http://localhost:3002/api/ai/suggest-elements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domData: {
              title: `Intent: ${intent}`,
              url,
              elements: retryElements,
            },
            options: {
              maxSuggestions: 10,
              confidenceThreshold: 0.5,
              useHeuristicFallback: true,
              includeCategories: ['authentication', 'navigation', 'form', 'action', 'verification', 'general'],
            },
          }),
          signal: retryController.signal,
        });

        clearTimeout(retryTimeoutId);

        if (!retryResponse.ok) {
          throw new Error(`AI service retry responded with ${retryResponse.status}`);
        }

        const retryData = await retryResponse.json();
        const retryCandidates: AICandidate[] =
          retryData.suggestions?.map((s: any) => ({
            css: s.selector || s.css,
            score: s.confidence ?? s.score ?? 0.5,
            why: s.reasoning || 'AI suggested',
          })) ?? [];

        return {
          best: retryCandidates[0],
          candidates: retryCandidates,
        };
      } catch (retryError) {
        return { candidates: [] };
      }
    }
    return { candidates: [] };
  }
}
