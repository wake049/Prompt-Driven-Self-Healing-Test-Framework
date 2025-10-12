// background/suggestSelector.ts
// Parallel AI selector suggestion with shard prep, concurrency & early stop

import { ElementIdentity, ElementPayload } from '../types/element';
import { askShard, AISuggestionResult, AICandidate } from './openaiClient';

/** Pair an identity with its payload (index-aligned). */
type Scanned = { identity: ElementIdentity; payload: ElementPayload };

/** Split array into chunks of specified size */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Rank element by usefulness for test automation */
function rank(identity: ElementIdentity, payload?: ElementPayload): number {
  let score = 0;
  const tag = identity.tag?.toUpperCase();
  const attrs = payload?.attributes || {};

  if (identity['data-testid'] || identity['data-test']) score += 5;
  if (identity.id) score += 4;
  if (tag === 'BUTTON') score += 3;
  if (tag === 'A') score += 2;
  if (identity.name) score += 2;
  if (attrs['role']) score += 1;
  if (attrs['type']) score += 1;

  return score;
}

/** Prepare elements into ranked shards for parallel processing */
export function prepareShards(
  identities: ElementIdentity[],
  payloads: ElementPayload[],
  maxPerShard = 80
): Scanned[][] {
  const zipped: Scanned[] = identities.map((id, i) => ({ identity: id, payload: payloads[i] }));

  const interactive = zipped.filter(({ identity, payload }) => {
    const tag = identity.tag?.toLowerCase();
    const role = payload?.attributes?.['role']?.toLowerCase();
    const type = payload?.attributes?.['type']?.toLowerCase();

    return (
      ['button', 'input', 'a', 'select', 'textarea', 'form'].includes(tag || '') ||
      (role && ['button', 'link', 'textbox', 'checkbox', 'radio', 'searchbox'].includes(role)) ||
      (type && ['submit', 'button', 'text', 'email', 'password', 'search', 'tel', 'url'].includes(type)) ||
      identity['data-testid'] ||
      identity['data-test'] ||
      identity.id ||
      (identity.name && identity.name.length < 50)
    );
  });

  const top = interactive
    .sort((a, b) => rank(b.identity, b.payload) - rank(a.identity, a.payload))
    .slice(0, 320);

  return chunk(top, maxPerShard);
}

/** Deduplicate and merge results from multiple shards */
function dedupeMerge(results: AISuggestionResult[]): AISuggestionResult {
  const all: AICandidate[] = results.flatMap((r) => (r?.candidates?.length ? r.candidates : r.best ? [r.best] : []));
  const seen = new Set<string>();

  const merged = all
    .filter((c) => {
      const key = c.css || JSON.stringify(c);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return {
    best: merged[0],
    candidates: merged.slice(0, 10),
  };
}

type Outcome = 'early_stop' | 'continue';

/** Process shards with concurrency limit and early stopping */
async function processShardsConcurrently(
  shards: Scanned[][],
  intent: string,
  url: string,
  maxConcurrency = 4
): Promise<AISuggestionResult[]> {
  const results: AISuggestionResult[] = [];
  const executing: Array<Promise<Outcome>> = [];
  let shardIndex = 0;
  let earlyStop = false;

  while (shardIndex < shards.length || executing.length > 0) {
    if (earlyStop) break;

    while (executing.length < maxConcurrency && shardIndex < shards.length && !earlyStop) {
      const current = shards[shardIndex++];
      const ids = current.map((s) => s.identity);
      const pls = current.map((s) => s.payload);

      const p: Promise<Outcome> = askShard(intent, url, ids, pls)
        .then((res) => {
          results.push(res);
          const hi = res.candidates?.find((c) => (c.score ?? 0) >= 0.9) || res.best;
          if (hi && (hi.score ?? 0) >= 0.9) return 'early_stop' as const;
          return 'continue' as const;
        })
        .catch(() => {
          results.push({ candidates: [] });
          return 'continue' as const;
        })
        .finally(() => {
          const idx = executing.indexOf(p);
          if (idx > -1) executing.splice(idx, 1);
        });

      executing.push(p);
    }

    if (executing.length > 0) {
      const outcome: Outcome = await Promise.race(executing);
      if (outcome === 'early_stop') earlyStop = true;
    }
  }

  await Promise.all(executing);
  return results;
}


/** Local fallback: build a stable CSS from identity/payload (no heuristicMatcher dependency) */
function localFallback(
  intent: string,
  identities: ElementIdentity[],
  payloads: ElementPayload[]
): AISuggestionResult {
  // Rank and pick the best candidate we can confidently build a selector for
  const scored = identities.map((id, i) => ({ id, p: payloads[i], score: rank(id, payloads[i]) }));
  scored.sort((a, b) => b.score - a.score);

  // Build CSS with priority: data-testid -> data-test -> id -> payload.selectors.css -> tag
  const toCss = (id?: ElementIdentity, p?: ElementPayload): string | undefined => {
    if (!id) return undefined;
    if (id['data-testid']) return `[data-testid="${cssEsc(id['data-testid']!)}"]`;
    if (id['data-test']) return `[data-test="${cssEsc(id['data-test']!)}"]`;
    if (id.id) return `#${cssEsc(id.id)}`;
    if (p?.selectors?.css) return p.selectors.css;
    if (id.tag) return id.tag.toLowerCase();
    return undefined;
  };

  // collect top few with dedupe
  const seen = new Set<string>();
  const candidates: AICandidate[] = [];
  for (const s of scored) {
    const css = toCss(s.id, s.p);
    if (!css) continue;
    if (seen.has(css)) continue;
    seen.add(css);
    candidates.push({
      css,
      score: s.score / 10, // normalize rough rank to ~0..1
      why: 'local-fallback',
    });
    if (candidates.length >= 10) break;
  }

  return { best: candidates[0], candidates };
}

function cssEsc(s: string): string {
  // simple CSS ident/attr escaper (enough for ids/testids)
  return s.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/** Main selector suggestion function with optimized parallel processing */
export async function suggestSelector(
  intent: string,
  url: string,
  identities: ElementIdentity[],
  payloads: ElementPayload[]
): Promise<AISuggestionResult> {
  const shards = prepareShards(identities, payloads, 80);

  try {
    const results = await processShardsConcurrently(shards, intent, url, 4);
    const merged = dedupeMerge(results);

    // If AI returned nothing usable, fall back locally
    if (!merged.best && (!merged.candidates || merged.candidates.length === 0)) {
      return localFallback(intent, identities, payloads);
    }

    return merged;
  } catch {
    // Hard fallback on any failure
    return localFallback(intent, identities, payloads);
  }
}
