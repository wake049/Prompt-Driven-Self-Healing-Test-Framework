/**
 * Simplified MCP Chrome Extension Popup
 * 
 * Core functionality:
 * 1. Get All Elements - sends DOM to AI via MCP for parsing/fixes
 * 2. Individual recording controls for manual element capture
 */

import { MCPClientManager } from './mcp-client';

class MCPExtensionPopup {
  private mcpClient: any = null;
  private isRecording = false;

  constructor() {
    this.initializePopup();
  }

  private async initializePopup() {
    try {
      // Extract auth token from the current website session
      const authToken = await this.extractAuthToken();
      
      // Initialize MCP client connection with auth token
      this.mcpClient = await MCPClientManager.getInstance();
      if (authToken) {
        // Store auth token for use in API calls
        (window as any).authToken = authToken;
      }
      
      
      this.setupEventListeners();
      await this.updatePageContext();
      this.updateStatus("✅ Ready - MCP server connected");
    } catch (error) {
      this.showFatalError("MCP server connection required. Please ensure the MCP server is running.");
      return;
    }
  }

  private async extractAuthToken(): Promise<string | null> {
    try {
      // Get current tab to extract auth token from your website
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (!currentTab.id) {
        return null;
      }

      // Extract token from localStorage, sessionStorage, or cookies
      const results = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: () => {
          // Check for JWT token in localStorage
          const localStorageToken = localStorage.getItem('access_token') || 
                                   localStorage.getItem('authToken') ||
                                   localStorage.getItem('token') ||
                                   localStorage.getItem('jwt_token');
          
          // Check for token in sessionStorage
          const sessionStorageToken = sessionStorage.getItem('access_token') || 
                                     sessionStorage.getItem('authToken') ||
                                     sessionStorage.getItem('token') ||
                                     sessionStorage.getItem('jwt_token');
          
          // Return the first token found
          return localStorageToken || sessionStorageToken;
        }
      });

      const token = results[0]?.result;
      if (token) {
        return token;
      }

      // If no token in storage, try to extract from cookies
      const cookies = await chrome.cookies.getAll({ url: currentTab.url || '' });
      const authCookie = cookies.find(cookie => 
        cookie.name.includes('token') || 
        cookie.name.includes('auth') || 
        cookie.name.includes('session')
      );

      if (authCookie) {
        return authCookie.value;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private setupEventListeners() {
    // Core functionality: Get All Elements
    const getAllElementsBtn = document.getElementById('get-all-elements-btn') as HTMLButtonElement;
    getAllElementsBtn?.addEventListener('click', () => this.getAllElements());

    // Recording controls for individual elements
    const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    const stopRecordBtn = document.getElementById('stop-record-btn') as HTMLButtonElement;
    
    recordBtn?.addEventListener('click', () => this.startRecording());
    stopRecordBtn?.addEventListener('click', () => this.stopRecording());

    // Page context
    const declarePageBtn = document.getElementById('declare-page-btn') as HTMLButtonElement;
    declarePageBtn?.addEventListener('click', () => this.declarePage());
  }

  private async updatePageContext() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      const input = document.getElementById('page-context') as HTMLInputElement;
      if (!input) return;

      const url = tab.url ? new URL(tab.url) : null;
      const pageTitle = tab.title || 'Untitled Page';
      const pathname = url?.pathname || '';

      let pageName = pageTitle;
      const generic = ['swag labs', 'sauce labs', 'demo', 'test', 'home', 'welcome'];
      if (generic.some(g => pageTitle.toLowerCase().includes(g)) || pageTitle.length > 50) {
        const parts = pathname.split('/').filter(p => p && p !== 'index.html');
        if (parts.length) {
          const last = parts.at(-1)!.replace(/\.(html|htm|php|asp|jsp)$/i, '');
          pageName = last.charAt(0).toUpperCase() + last.slice(1).replace(/[-_]/g, ' ');
        } else if (pathname === '/' || pathname === '' || pathname === '/index.html') {
          pageName = 'Home';
        } else if (url) {
          const domain = url.hostname.replace('www.', '');
          pageName = domain.split('.')[0].replace(/-/g, ' ');
          pageName = pageName.charAt(0).toUpperCase() + pageName.slice(1);
        }
      }
      if (!pageName.trim()) pageName = 'Unknown Page';
      if (pageName.length > 50) pageName = pageName.slice(0, 50).trim() + '...';
      input.value = pageName;
  }

  /**
   * Core Function: Get all elements on page and send to AI via MCP
   */
  private async getAllElements() {
    try {
      if (!this.mcpClient) {
        throw new Error('MCP client not connected');
      }

      this.updateStatus('🔍 Extracting page elements...');
      
      // Get DOM data from content script
      const tab = await this.getActiveTab();
      await this.ensureContentScript(tab.id!);
      
      const response = await chrome.tabs.sendMessage(tab.id!, { 
        type: 'EXTRACT_ALL_ELEMENTS' 
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to extract elements');
      }

      this.updateStatus('📤 Sending to AI via MCP...');

      // Get stored auth token 
      const authTokenResult = await chrome.storage.local.get(['authToken']);
      const authToken = authTokenResult.authToken;
      

      // Send to AI via MCP server
      const aiResult = await this.mcpClient.callTool('analyze_page_elements', {
        pageData: response.data,
        extractionMode: 'full_analysis',
        includeHealing: true,
        authToken: authToken // Include auth token in the request
      });

      if (aiResult.ok) {
        this.updateStatus(`✅ AI processed ${response.data.elementCount || 0} elements`);
        
        // Show summary to user
        this.showElementSummary(aiResult.data);
        
        // NEW: Record elements to database
        await this.recordElementsToDatabase(response.data);
      } else {
        throw new Error(aiResult.error || 'AI analysis failed');
      }

    } catch (error) {
      this.updateStatus(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Record extracted elements to the database
   */
  private async recordElementsToDatabase(pageData: any) {
    try {
      this.updateStatus('💾 Recording elements to database...');
      
      // Import API client
      const { default: apiClient } = await import('./api/api-client');
      
      // Get page context for session info
      const input = document.getElementById('page-context') as HTMLInputElement;
      const pageName = input?.value || 'Unknown Page';
      
      // Extract elements from page data - they should already be in RecordedElement format
      const elements = pageData.elements || [];
      
      if (elements.length === 0) {
        this.updateStatus('⚠️ No elements to record');
        return;
      }
      
      // Create session info
      const sessionId = `session_${Date.now()}`;
      
      // Record elements in batches to avoid overwhelming the API
      const batchSize = 10;
      let recordedCount = 0;
      
      for (let i = 0; i < elements.length; i += batchSize) {
        const batch = elements.slice(i, i + batchSize);
        
        for (const element of batch) {
          try {
            // Elements are already in the correct format from extractAllElementsForAI
            console.log('Recording element:', element);
            
            const result = await apiClient.recordElement(element, sessionId);
            
            console.log('Record result:', result);
            
            if (result.success) {
              recordedCount++;
            } else {
              console.error('Failed to record element:', element.id, result.error);
            }
          } catch (error) {
            console.error('Error recording element:', element.id, error);
          }
        }
        
        // Update progress
        this.updateStatus(`💾 Recording elements... ${Math.min(i + batchSize, elements.length)}/${elements.length}`);
      }
      
      this.updateStatus(`✅ Recorded ${recordedCount}/${elements.length} elements to database`);
      
    } catch (error) {
      console.error('Failed to record elements to database:', error);
      this.updateStatus(`⚠️ Elements analyzed but database recording failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private showElementSummary(aiData: any) {
    const summaryEl = document.getElementById('element-summary');
    if (!summaryEl) return;

    // Show the summary section
    summaryEl.style.display = 'block';

    const summary = aiData.summary || aiData || {};
    summaryEl.innerHTML = `
      <div class="summary-item">
        <strong>Total Elements:</strong> ${summary.totalElements || summary.elementCount || 0}
      </div>
      <div class="summary-item">
        <strong>Interactive:</strong> ${summary.interactiveElements || summary.interactive || 0}
      </div>
      <div class="summary-item">
        <strong>Issues Found:</strong> ${summary.issuesFound || summary.issues?.length || 0}
      </div>
      <div class="summary-item">
        <strong>Suggestions:</strong> ${summary.suggestions?.length || summary.recommendationsCount || 0}
      </div>
      ${summary.processingTime ? `<div class="summary-item"><strong>Processing Time:</strong> ${summary.processingTime}ms</div>` : ''}
    `;
  }

  private async startRecording() {
    try {
      const tab = await this.getActiveTab();
      await this.ensureContentScript(tab.id!);
      await chrome.tabs.sendMessage(tab.id!, { type: 'START_RECORDING' });
      
      this.isRecording = true;
      this.updateRecordingUI();
      this.updateStatus('🔴 Recording individual elements...');
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Failed to start recording');
    }
  }

  private async stopRecording() {
    try {
      const tab = await this.getActiveTab();
      await chrome.tabs.sendMessage(tab.id!, { type: 'STOP_RECORDING' });
      
      this.isRecording = false;
      this.updateRecordingUI();
      this.updateStatus('⏹️ Recording stopped');
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Failed to stop recording');
    }
  }

  private async declarePage() {
    try {
      if (!this.mcpClient) {
        throw new Error('MCP client not connected');
      }

      const input = document.getElementById('page-context') as HTMLInputElement;
      const page = input?.value || 'Unknown Page';
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const result = await this.mcpClient.callTool('page.declare', {
        page,
        url: tab?.url,
        timestamp: Date.now()
      });

      if (result && result.ok) {
        this.updateStatus(`✅ Page '${page}' declared`);
      } else {
        this.showError('Failed to declare page');
      }
    } catch (error) {
      this.showError('Failed to declare page - MCP required');
    }
  }

  // ===== Utility Methods =====

  private async getActiveTab(): Promise<chrome.tabs.Tab> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url) throw new Error("No active tab");
    if (!/^https?:/i.test(tab.url)) {
      throw new Error("This page type doesn't allow content scripts. Open a normal http(s) page.");
    }
    return tab;
  }

  private async ensureContentScript(tabId: number): Promise<void> {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "PING_CONTENT" });
      return; // content script already there
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
        world: "ISOLATED"
      });
      await new Promise(r => setTimeout(r, 50));
      await chrome.tabs.sendMessage(tabId, { type: "PING_CONTENT" });
    }
  }

  private updateRecordingUI() {
    const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    const stopRecordBtn = document.getElementById('stop-record-btn') as HTMLButtonElement;
    const panel = document.getElementById('recording-instructions');

    if (!recordBtn || !stopRecordBtn) return;
    
    if (this.isRecording) {
      recordBtn.disabled = true;
      recordBtn.classList.add('recording');
      stopRecordBtn.disabled = false;
      if (panel) panel.style.display = 'block';
    } else {
      recordBtn.disabled = false;
      recordBtn.classList.remove('recording');
      stopRecordBtn.disabled = true;
      if (panel) panel.style.display = 'none';
    }
  }

  private updateStatus(message: string) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = message.includes('✅') ? 'status success' :
                          message.includes('⚠️') ? 'status warning' :
                          message.includes('❌') ? 'status error' : 'status';
    }
  }

  private showError(message: string) {
    this.updateStatus(`❌ ${message}`);
  }

  private showFatalError(message: string) {
    this.updateStatus(`💥 ${message}`);
    
    // Disable all functionality
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);
    
    // Show fatal error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fatal-error';
    errorDiv.innerHTML = `
      <h3>⚠️ Extension Disabled</h3>
      <p>${message}</p>
      <p>This extension requires an active MCP server connection to function.</p>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
      container.insertBefore(errorDiv, container.firstChild);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new MCPExtensionPopup();
});