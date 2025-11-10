/**
 * Auth Token Capture Script
 * 
 * This content script runs on your test framework website to capture
 * authentication tokens and store them for use when testing other websites.
 */

// Only run on test framework domains
const TEST_FRAMEWORK_DOMAINS = [
  'localhost:8000',
  'localhost:3000', 
  'testframework.local',
  // Add your actual test framework domain here
];

function isTestFrameworkSite(): boolean {
  const currentDomain = window.location.host;
  return TEST_FRAMEWORK_DOMAINS.some(domain => currentDomain.includes(domain));
}

async function captureAuthToken(): Promise<void> {
  if (!isTestFrameworkSite()) {
    return; // Only capture tokens from test framework sites
  }
    // Look for auth tokens in various storage locations
    const possibleTokens = [
      localStorage.getItem('access_token'),
      localStorage.getItem('authToken'),
      localStorage.getItem('token'),
      localStorage.getItem('jwt_token'),
      sessionStorage.getItem('access_token'),
      sessionStorage.getItem('authToken'),
      sessionStorage.getItem('token'),
      sessionStorage.getItem('jwt_token'),
    ].filter(Boolean);

    if (possibleTokens.length > 0) {
      const authToken = possibleTokens[0];
      
      // Store the token in Chrome extension storage for cross-tab access
      await chrome.storage.local.set({ 
        authToken: authToken,
        tokenCapturedAt: Date.now(),
        tokenDomain: window.location.host
      });
      
      
      // Optionally show a brief notification
      showTokenCapturedNotification();
    }
}

function showTokenCapturedNotification(): void {
  // Create a small, unobtrusive notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    opacity: 0.9;
    font-family: Arial, sans-serif;
  `;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Monitor for token changes (when user logs in)
function monitorAuthChanges(): void {
  if (!isTestFrameworkSite()) {
    return;
  }

  // Monitor localStorage changes
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key: string, value: string) {
    originalSetItem.apply(this, [key, value]);
    
    // Check if an auth token was set
    if (key.includes('token') || key.includes('auth')) {
      setTimeout(captureAuthToken, 100); // Small delay to ensure it's fully set
    }
  };

  // Monitor sessionStorage changes
  const originalSessionSetItem = sessionStorage.setItem;
  sessionStorage.setItem = function(key: string, value: string) {
    originalSessionSetItem.apply(this, [key, value]);
    
    // Check if an auth token was set
    if (key.includes('token') || key.includes('auth')) {
      setTimeout(captureAuthToken, 100);
    }
  };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    captureAuthToken();
    monitorAuthChanges();
  });
} else {
  captureAuthToken();
  monitorAuthChanges();
}

// Also check periodically in case tokens are updated
setInterval(captureAuthToken, 30000); // Check every 30 seconds