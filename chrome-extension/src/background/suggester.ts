import { El, SelectorResult, SelectorCand } from '../types/element';
import { askShard } from './openaiClient';
import { heuristicMatch } from './heuristicMatcher';

/**
 * Split array into chunks of specified size
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Rank element by usefulness for test automation
 */
function rank(el: El): number {
  let score = 0;
  if (el.testid) score += 5;
  if (el.id) score += 4;
  if (el.tag === 'BUTTON') score += 3;
  if (el.tag === 'A') score += 2;
  if (el.name) score += 2;
  if (el.visible) score += 1;
  return score;
}

/**
 * Prepare elements into ranked shards for parallel processing
 */
export function prepareShards(elements: El[], maxPerShard = 80): El[][] {
  // Pre-filter to only interactive elements for better performance
  const interactiveElements = elements.filter(el => {
    // Focus on elements that are most likely to be useful for automation
    const tagName = el.tag?.toLowerCase();
    const role = el.attrs?.role?.toLowerCase();
    const type = el.attrs?.type?.toLowerCase();
    
    return (
      // Standard interactive elements
      ['button', 'input', 'a', 'select', 'textarea', 'form'].includes(tagName || '') ||
      // Elements with interactive roles
      (role && ['button', 'link', 'textbox', 'checkbox', 'radio', 'searchbox'].includes(role)) ||
      // Input types
      (type && ['submit', 'button', 'text', 'email', 'password', 'search', 'tel', 'url'].includes(type)) ||
      // Elements with good identifiers
      el.testid || el.id || (el.name && el.name.length < 50)
    );
  });
  
  // Sort by rank and take top elements
  const topElements = interactiveElements
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 320); // 4 shards × 80 elements
  
  return chunk(topElements, maxPerShard);
}

/**
 * Deduplicate and merge results from multiple shards
 */
function dedupeMerge(results: SelectorResult[]): SelectorResult {
  const allCandidates: SelectorCand[] = results.flatMap(r => 
    r.candidates || (r.best ? [r.best] : [])
  );
  
  const seen = new Set<string>();
  const merged = allCandidates
    .filter(candidate => {
      const key = candidate.css || candidate.xpath || JSON.stringify(candidate);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  
  return {
    best: merged[0],
    candidates: merged.slice(0, 10)
  };
}

/**
 * Process shards with concurrency limit and early stopping
 */
async function processShardsConcurrently(
  shards: El[][], 
  intent: string, 
  url: string,
  maxConcurrency = 4
): Promise<SelectorResult[]> {
  const results: SelectorResult[] = [];
  const executing: Promise<string>[] = [];
  let shardIndex = 0;
  let earlyStop = false;
  
  while (shardIndex < shards.length || executing.length > 0) {
    if (earlyStop) break;
    
    // Start new tasks up to concurrency limit
    while (executing.length < maxConcurrency && shardIndex < shards.length && !earlyStop) {
      const currentShard = shards[shardIndex++];
      const promise = askShard(intent, url, currentShard)
        .then(result => {
          results.push(result);
          
          // Early stopping: check if we have a high-confidence result
          const bestCandidate = result.candidates?.find(c => (c.score || 0) >= 0.90);
          if (bestCandidate) {
            earlyStop = true;
            return 'early_stop';
          }
          return 'continue';
        })
        .catch(error => {
          results.push({ candidates: [] });
          return 'continue';
        })
        .finally(() => {
          // Remove this promise from executing array
          const index = executing.indexOf(promise);
          if (index > -1) executing.splice(index, 1);
        });
      
      executing.push(promise);
    }
    
    // Wait for at least one to complete
    if (executing.length > 0) {
      await Promise.race(executing);
    }
  }
  
  // Wait for all remaining executing promises
  await Promise.all(executing);
  
  return results;
}

/**
 * Main selector suggestion function with optimized parallel processing
 */
export async function suggestSelector(
  intent: string, 
  url: string, 
  elements: El[]
): Promise<SelectorResult> {
  
  // Prepare elements into shards for processing
  const shards = prepareShards(elements, 80);
  
  try {
    // Process shards with concurrency control and early stopping
    const results = await processShardsConcurrently(shards, intent, url, 4);
    
    // Merge and deduplicate results
    const merged = dedupeMerge(results);
    
    return merged;
    
  } catch (error) {
    return heuristicMatch(intent, elements);
  }
}