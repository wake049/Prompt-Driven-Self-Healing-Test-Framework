// background/openaiClient.ts - AI service client wrapper for Chrome extension background script
import { El, SelectorResult } from '../types/element';

/**
 * Process a single shard of elements with the AI service
 * Optimized for speed with compact payloads and fast timeouts
 */
export async function askShard(intent: string, url: string, els: El[]): Promise<SelectorResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced to 5s
  
  try {
    
    // Compact payload - only essential data for speed
    const requestPayload = {
      domData: {
        title: `Intent: ${intent}`,
        url: url,
        elements: els.map(el => ({
          tag: el.tag,
          xpath: el.xpath, // Keep original xpath for fallback
          id: el.id,
          testid: el.testid,
          name: el.name && el.name.length <= 60 ? el.name : undefined,
          attrs: {
            role: el.attrs?.role,
            type: el.attrs?.type,
            value: el.attrs?.value && el.attrs.value.length <= 20 ? el.attrs.value : undefined
          },
          visible: el.visible
        }))
      },
      options: {
        maxSuggestions: 20, // Reduced for faster processing
        confidenceThreshold: 0.7, // Higher threshold for quality
        useHeuristicFallback: true,
        includeCategories: ['authentication', 'navigation', 'form', 'action', 'general']
      }
    };
    
    // Use the existing AI service endpoint
    const response = await fetch('http://localhost:3002/api/ai/suggest-elements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`AI service responded with ${response.status}`);
    }
    
    const data = await response.json();
    
    // Convert AI service response to SelectorResult format
    const best = data.suggestions?.[0];
    const candidates = data.suggestions?.map((suggestion: any) => ({
      css: suggestion.selector || suggestion.css,
      score: suggestion.confidence || suggestion.score || 0.5,
      why: suggestion.reasoning || 'AI suggested'
    })) || [];
    
    const result: SelectorResult = {
      best: best ? {
        css: best.selector || best.css,
        score: best.confidence || best.score || 0.5,
        why: best.reasoning || 'AI suggested'
      } : undefined,
      candidates
    };
    
    
    return result;
    
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Retry logic for timeouts or server errors
    if (error.name === 'AbortError' || (error.message && error.message.includes('500'))) {
      console.warn('AI service request failed, retrying with backoff...', error.message);
      
      // Jittered backoff: 250-750ms
      const delay = 250 + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Single retry with faster timeout
      try {
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 5000); // Reduced to 5s
        
        const retryResponse = await fetch('http://localhost:3002/api/ai/suggest-elements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            domData: {
              title: `Intent: ${intent}`,
              url: url,
              elements: els.map(el => ({
                tag: el.tag,
                xpath: el.xpath, // Keep original xpath for fallback
                id: el.id,
                testid: el.testid,
                name: el.name && el.name.length <= 60 ? el.name : undefined,
                attrs: {
                  role: el.attrs?.role,
                  type: el.attrs?.type,
                  value: el.attrs?.value && el.attrs.value.length <= 20 ? el.attrs.value : undefined
                },
                visible: el.visible
              }))
            },
            options: {
              maxSuggestions: 10, // Reduced for retry
              confidenceThreshold: 0.5,
              useHeuristicFallback: true,
              includeCategories: ['authentication', 'navigation', 'form', 'action', 'verification', 'general']
            }
          }),
          signal: retryController.signal
        });
        
        clearTimeout(retryTimeoutId);
        
        if (!retryResponse.ok) {
          throw new Error(`AI service retry responded with ${retryResponse.status}`);
        }
        
        const retryData = await retryResponse.json();
        const retryCandidates = retryData.suggestions?.map((suggestion: any) => ({
          css: suggestion.selector || suggestion.css,
          score: suggestion.confidence || suggestion.score || 0.5,
          why: suggestion.reasoning || 'AI suggested'
        })) || [];
        
        return {
          best: retryCandidates[0],
          candidates: retryCandidates
        };
        
      } catch (retryError) {
        console.error('AI service retry failed:', retryError);
        return { candidates: [] };
      }
    }
    
    if (error.name === 'AbortError') {
      console.warn(`⏰ AI service request timed out after 5000ms`);
    } else {
      console.error('❌ AI service request failed:', error);
    }
    return { candidates: [] };
  }
}