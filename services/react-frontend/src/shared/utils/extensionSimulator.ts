// Development utility to simulate Chrome extension presence
// This file helps test the Chrome extension detection logic

declare global {
  interface Window {
    mcpExtension?: {
      version: string;
      status: 'connected' | 'installed';
      simulateConnection: () => void;
      simulateDisconnection: () => void;
    };
    simulateChromeExtension?: {
      connect: () => void;
      disconnect: () => void;
      addDomMarker: () => void;
      removeDomMarker: () => void;
    };
  }
}

// Development-only Chrome extension simulator
export const createExtensionSimulator = () => {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const addDomMarker = () => {
    const marker = document.createElement('div');
    marker.setAttribute('data-mcp-extension', 'true');
    marker.style.display = 'none';
    document.body.appendChild(marker);
    console.log('🔧 [Dev] Added MCP extension DOM marker');
  };

  const removeDomMarker = () => {
    const markers = document.querySelectorAll('[data-mcp-extension]');
    markers.forEach(marker => marker.remove());
    console.log('🔧 [Dev] Removed MCP extension DOM markers');
  };

  const simulateConnection = () => {
    // Add DOM marker
    addDomMarker();
    
    // Add global variable
    window.mcpExtension = {
      version: '1.0.0-dev',
      status: 'connected',
      simulateConnection,
      simulateDisconnection
    };
    
    console.log('✅ [Dev] Simulated MCP Chrome extension connection');
  };

  const simulateDisconnection = () => {
    // Remove DOM marker
    removeDomMarker();
    
    // Remove global variable
    delete window.mcpExtension;
    
    console.log('❌ [Dev] Simulated MCP Chrome extension disconnection');
  };

  // Expose simulator functions globally for easy testing
  window.simulateChromeExtension = {
    connect: simulateConnection,
    disconnect: simulateDisconnection,
    addDomMarker,
    removeDomMarker
  };

  console.log('🚀 [Dev] Chrome Extension Simulator loaded');
  console.log('💡 [Dev] Use window.simulateChromeExtension.connect() to test extension detection');
  console.log('💡 [Dev] Use window.simulateChromeExtension.disconnect() to test extension absence');
};

// Auto-initialize in development
if (process.env.NODE_ENV === 'development') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createExtensionSimulator);
  } else {
    createExtensionSimulator();
  }
}