/**
 * MCP-compliant Chrome Extension Popup
 * 
 * This popup communicates directly with the MCP server via WebSocket,
 * providing a proper MCP client interface for the Chrome extension.
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
      // Initialize MCP client connection - required for extension functionality
      this.mcpClient = await MCPClientManager.getInstance();
      console.log("✅ MCP client connected");
      
      this.setupEventListeners();
      await this.updatePageContext();
      await this.loadAvailableTools();
    } catch (error) {
      console.error("❌ MCP server connection required:", error);
      this.showFatalError("MCP server connection required. Please ensure the MCP server is running.");
      return;
    }
  }

  private setupEventListeners() {
    // Recording controls
    const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    const stopRecordBtn = document.getElementById('stop-record-btn') as HTMLButtonElement;
    
    recordBtn?.addEventListener('click', () => this.startRecording());
    stopRecordBtn?.addEventListener('click', () => this.stopRecording());

    // MCP tool testing
    const testElementsBtn = document.getElementById('test-elements-btn') as HTMLButtonElement;
    const testActionBtn = document.getElementById('test-action-btn') as HTMLButtonElement;
    const testVerifyBtn = document.getElementById('test-verify-btn') as HTMLButtonElement;
    
    testElementsBtn?.addEventListener('click', () => this.testElementsGet());
    testActionBtn?.addEventListener('click', () => this.testRunAction());
    testVerifyBtn?.addEventListener('click', () => this.testVerifySection());

    // Resource access
    const viewRepoBtn = document.getElementById('view-repo-btn') as HTMLButtonElement;
    const viewStatsBtn = document.getElementById('view-stats-btn') as HTMLButtonElement;
    
    viewRepoBtn?.addEventListener('click', () => this.viewElementRepository());
    viewStatsBtn?.addEventListener('click', () => this.viewStatistics());

    // Page context
    const declarePageBtn = document.getElementById('declare-page-btn') as HTMLButtonElement;
    declarePageBtn?.addEventListener('click', () => this.declarePage());
  }

  private async updatePageContext() {
    try {
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
    } catch (e) {
      console.warn('Failed to update page context:', e);
    }
  }

  private async loadAvailableTools() {
    try {
      if (!this.mcpClient) {
        throw new Error('MCP client not connected');
      }

      const tools = await this.mcpClient.listTools();
      const toolsList = document.getElementById('tools-list');
      
      if (toolsList) {
        toolsList.innerHTML = '';
        tools.forEach((tool: any) => {
          const toolElement = document.createElement('div');
          toolElement.className = 'tool-item';
          toolElement.innerHTML = `
            <strong>${tool.name}</strong>
            <p>${tool.description}</p>
          `;
          toolsList.appendChild(toolElement);
        });
      }

      this.updateStatus(`✅ ${tools.length} MCP tools available`);
    } catch (error) {
      console.error('Failed to load tools:', error);
      this.updateStatus('❌ Failed to load tools - MCP required');
      throw error; // Propagate error to caller
    }
  }

  private async startRecording() {
    try {
      const tab = await this.getActiveTab();
      await this.ensureContentScript(tab.id!);
      await chrome.tabs.sendMessage(tab.id!, { type: 'START_RECORDING' });
      
      this.isRecording = true;
      this.updateRecordingUI();
      this.updateStatus('🔴 Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
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
      console.error('Failed to stop recording:', error);
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
      console.error('Failed to declare page:', error);
      this.showError('Failed to declare page - MCP required');
    }
  }

  // ===== MCP Tool Testing Methods =====

  private async testElementsGet() {
    try {
      if (!this.mcpClient) {
        throw new Error('MCP client not connected');
      }

      const result = await this.mcpClient.getElement('login-button');
      
      if (result.ok) {
        this.updateStatus('✅ elements.get test successful');
        console.log('Element data:', result.data);
      } else {
        this.updateStatus('❌ elements.get test failed');
        console.error('Error:', result.error);
      }
    } catch (error) {
      this.updateStatus('❌ elements.get test error - MCP required');
      console.error('Test error:', error);
    }
  }

  private async testRunAction() {
    try {
      if (!this.mcpClient) {
        throw new Error('MCP client not connected');
      }

      const result = await this.mcpClient.runAction(
        'click_css',
        'test-button',
        {
          run_id: 'popup-test-001',
          step_index: 1,
          page_url: window.location.href
        }
      );

      if (result.ok) {
        this.updateStatus('✅ run_action test successful');
        console.log('Action result:', result.data);
      } else {
        this.updateStatus('❌ run_action test failed');
        console.error('Error:', result.error);
      }
    } catch (error) {
      this.updateStatus('❌ run_action test error - MCP required');
      console.error('Test error:', error);
    }
  }

  private async testVerifySection() {
    try {
      if (!this.mcpClient) {
        throw new Error('MCP client not connected');
      }

      const preset = {
        name: 'Popup Test Verification',
        description: 'Test verification from popup',
        checks: [
          {
            type: 'exists',
            elementId: 'test-element',
            description: 'Test element exists'
          }
        ]
      };

      const result = await this.mcpClient.verifySection(preset);

      if (result.ok) {
        this.updateStatus('✅ verify.section test successful');
        console.log('Verification result:', result.data);
      } else {
        this.updateStatus('❌ verify.section test failed');
        console.error('Error:', result.error);
      }
    } catch (error) {
      this.updateStatus('❌ verify.section test error - MCP required');
      console.error('Test error:', error);
    }
  }

  // ===== Resource Access Methods =====

  private async viewElementRepository() {
    try {
      if (!this.mcpClient) {
        throw new Error('MCP client not connected');
      }

      const result = await this.mcpClient.getElementRepository(10, 0);
      console.log('Element repository:', result);
      
      if (result.elements) {
        this.updateStatus(`✅ Repository: ${result.elements.length} elements`);
        
        // Show elements in a simple display
        const repoDisplay = document.getElementById('repo-display');
        if (repoDisplay) {
          repoDisplay.innerHTML = result.elements.map((element: any) => 
            `<div class="element-item">
              <strong>${element.logical_key || element.id}</strong>
              <small>${element.page || 'Unknown page'}</small>
            </div>`
          ).join('');
        }
      } else {
        this.updateStatus('❌ Failed to access repository');
      }
    } catch (error) {
      this.updateStatus('❌ Repository access error - MCP required');
      console.error('Repository error:', error);
    }
  }

  private async viewStatistics() {
    try {
      if (!this.mcpClient) {
        throw new Error('MCP client not connected');
      }

      const [repoStats, healingStats] = await Promise.all([
        this.mcpClient.getRepositoryStats(),
        this.mcpClient.getHealingStats()
      ]);

      console.log('Repository stats:', repoStats);
      console.log('Healing stats:', healingStats);

      this.updateStatus('✅ Statistics loaded');
    } catch (error) {
      this.updateStatus('❌ Statistics error - MCP required');
      console.error('Statistics error:', error);
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
    console.error(message);
    this.updateStatus(`❌ ${message}`);
  }

  private showFatalError(message: string) {
    console.error("FATAL:", message);
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