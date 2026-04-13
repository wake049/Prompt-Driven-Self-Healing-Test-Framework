// Example: How to use the database-backed AI provider in chrome extension

import { askShard } from './background/openaiClient';
import { ElementIdentity, ElementPayload } from './types/element';

/**
 * Example 1: Using askShard with tenant/project IDs
 * 
 * The chrome extension should pass tenant_id and project_id to askShard()
 * so it can fetch the active AI provider from the database.
 */
async function findLoginButton() {
  // Get current tenant and project from extension storage or user context
  const tenantId = await chrome.storage.local.get('tenantId');
  const projectId = await chrome.storage.local.get('projectId');

  // Gather elements from the page
  const elements: ElementIdentity[] = [
    { tag: 'button', id: 'login-btn', name: 'Sign In', role: 'button' },
    { tag: 'input', id: 'username', name: 'Username', type: 'text' },
  ];

  const payloads: ElementPayload[] = [
    { xpath: '//*[@id="login-btn"]', attributes: { type: 'submit' } },
    { xpath: '//*[@id="username"]', attributes: { type: 'text' } },
  ];

  // Call askShard with tenant and project IDs
  // This will automatically use the database-configured provider
  const result = await askShard(
    'find the login button',
    window.location.href,
    elements,
    payloads,
    tenantId.tenantId,  // Pass tenant ID
    projectId.projectId // Pass project ID
  );

  console.log('AI selected:', result.best?.css);
  console.log('Confidence:', result.best?.score);
  console.log('Reasoning:', result.best?.why);

  return result;
}

/**
 * Example 2: Check which provider is active
 * 
 * You can also directly query the active provider endpoint
 * to show users which AI provider is being used.
 */
async function checkActiveProvider() {
  const tenantId = await chrome.storage.local.get('tenantId');
  const projectId = await chrome.storage.local.get('projectId');

  const params = new URLSearchParams();
  params.append('tenant_id', tenantId.tenantId);
  if (projectId.projectId) {
    params.append('project_id', projectId.projectId);
  }

  const response = await fetch(
    `http://localhost:3002/api/ai-providers/active?${params.toString()}`
  );

  if (response.ok) {
    const config = await response.json();
    console.log('Active provider:', config.provider);
    console.log('Model:', config.model);
    console.log('Source:', config.source); // "database" or "environment"
    console.log('Temperature:', config.temperature);
    return config;
  } else {
    console.error('Failed to get provider config');
    return null;
  }
}

/**
 * Example 3: Display provider info in extension popup
 * 
 * Show users which AI provider is being used for their tenant.
 */
async function displayProviderInfo() {
  const config = await checkActiveProvider();

  if (config) {
    const providerDiv = document.getElementById('provider-info');
    if (providerDiv) {
      providerDiv.innerHTML = `
        <div class="provider-status">
          <span class="provider-icon">🤖</span>
          <div class="provider-details">
            <strong>${config.provider}</strong>
            <small>${config.model}</small>
            <span class="source-badge">${config.source}</span>
          </div>
        </div>
      `;
    }
  }
}

/**
 * Example 4: Fallback when tenant ID not available
 * 
 * If tenant/project IDs aren't available yet, askShard will
 * automatically fall back to environment-configured providers.
 */
async function findElementWithoutTenant() {
  const elements: ElementIdentity[] = [
    { tag: 'button', id: 'submit-btn', name: 'Submit' },
  ];

  const payloads: ElementPayload[] = [
    { xpath: '//*[@id="submit-btn"]', attributes: {} },
  ];

  // Call without tenant/project IDs
  // System will use environment variables (OPENAI_API_KEY, etc.)
  const result = await askShard(
    'find the submit button',
    window.location.href,
    elements,
    payloads
    // No tenant_id or project_id - uses environment fallback
  );

  return result;
}

/**
 * Example 5: Error handling
 * 
 * Handle cases where provider config is unavailable
 */
async function robustElementSearch() {
  try {
    const tenantId = await chrome.storage.local.get('tenantId');
    const result = await askShard(
      'find search box',
      window.location.href,
      elements,
      payloads,
      tenantId.tenantId
    );

    if (result.candidates.length > 0) {
      console.log('✅ AI found elements:', result.candidates.length);
      return result;
    } else {
      console.log('⚠️ No AI suggestions, falling back to heuristics');
      // Fall back to heuristic matching
      return fallbackToHeuristics();
    }
  } catch (error) {
    console.error('❌ AI provider error:', error);
    // Fall back to heuristic matching
    return fallbackToHeuristics();
  }
}

function fallbackToHeuristics() {
  // Simple heuristic matching as fallback
  return {
    candidates: [
      {
        css: 'input[type="search"]',
        score: 0.7,
        why: 'Heuristic match: search input',
      },
    ],
  };
}

/**
 * Example 6: Initialize extension with provider check
 * 
 * On extension startup, verify provider availability
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('🚀 Extension installed, checking AI provider...');

  try {
    const tenantId = await chrome.storage.local.get('tenantId');
    
    if (tenantId.tenantId) {
      const config = await checkActiveProvider();
      
      if (config) {
        console.log(`✅ AI provider ready: ${config.provider} / ${config.model}`);
        
        // Store provider info for display in popup
        await chrome.storage.local.set({ providerConfig: config });
      } else {
        console.warn('⚠️ No AI provider configured');
      }
    } else {
      console.log('ℹ️ No tenant ID set, using system defaults');
    }
  } catch (error) {
    console.error('❌ Failed to check AI provider:', error);
  }
});

/**
 * Example 7: Provider switching notification
 * 
 * Notify user when provider changes (e.g., admin switched providers)
 */
async function watchProviderChanges() {
  let lastProvider = '';

  setInterval(async () => {
    const config = await checkActiveProvider();
    
    if (config && config.provider !== lastProvider) {
      console.log(`🔄 Provider changed: ${lastProvider} -> ${config.provider}`);
      
      // Notify user via chrome notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'AI Provider Updated',
        message: `Now using ${config.provider} / ${config.model}`,
      });
      
      lastProvider = config.provider;
    }
  }, 60000); // Check every minute
}

/**
 * Example 8: Background service worker integration
 * 
 * Use in background script to handle AI requests
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'suggestElement') {
    (async () => {
      try {
        const result = await askShard(
          request.intent,
          request.url,
          request.elements,
          request.payloads,
          request.tenantId,
          request.projectId
        );
        
        sendResponse({ success: true, result });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep message channel open for async response
  }
});

// Export for use in other modules
export {
  findLoginButton,
  checkActiveProvider,
  displayProviderInfo,
  findElementWithoutTenant,
  robustElementSearch,
  watchProviderChanges,
};
