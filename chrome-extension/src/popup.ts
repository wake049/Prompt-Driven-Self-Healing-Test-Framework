class MCPClient {
  private isRecording = false;
  
  constructor() {
    this.initializeUI();
  }

  private async initializeUI() {
    this.setupEventListeners();
    
    // Auto-populate page context
    await this.updatePageContext();
    
    // Check for any stored recording data
    await this.checkForRecordingData();
  }

  private setupEventListeners() {
    // Recording controls
    const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    const stopRecordBtn = document.getElementById('stop-record-btn') as HTMLButtonElement;
    const suggestBtn = document.getElementById('suggest-btn') as HTMLButtonElement;
    const suggestLegacyBtn = document.getElementById('suggest-legacy-btn') as HTMLButtonElement;

    recordBtn?.addEventListener('click', () => this.startRecording());
    stopRecordBtn?.addEventListener('click', () => this.stopRecording());
    suggestBtn?.addEventListener('click', () => this.suggestOptimizedElements());
    suggestLegacyBtn?.addEventListener('click', () => this.suggestElements());

    // Quick action buttons
    const viewElementsBtn = document.getElementById('view-elements-btn') as HTMLButtonElement;
    const clearElementsBtn = document.getElementById('clear-elements-btn') as HTMLButtonElement;
    
    viewElementsBtn?.addEventListener('click', () => this.openElementsViewer());
    clearElementsBtn?.addEventListener('click', () => this.clearAllElements());

    // Page declaration
    const declarePageBtn = document.getElementById('declare-page-btn') as HTMLButtonElement;
    declarePageBtn?.addEventListener('click', () => this.declarePage());

    // Listen for recording data
    chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
      if (request.type === 'RECORDING_DATA') {
        console.log('Popup received recording data:', request.payload);
        this.handleRecordedElement(request.payload);
      }
    });

    // Also set up periodic checking for recording data from storage
    this.setupRecordingDataPolling();
  }

  private async updatePageContext() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        const pageContextInput = document.getElementById('page-context') as HTMLInputElement;
        if (pageContextInput) {
          const url = new URL(tabs[0].url || '');
          const pageTitle = tabs[0].title || 'Untitled Page';
          const pathname = url.pathname;
          
          // Create a clean page name - prefer URL path over generic titles
          let pageName = pageTitle;
          
          // If title is too generic or company name, use URL path instead
          const genericTitles = ['swag labs', 'sauce labs', 'demo', 'test', 'home', 'welcome'];
          const isGenericTitle = genericTitles.some(generic => 
            pageTitle.toLowerCase().includes(generic.toLowerCase())
          );
          
          
          if (isGenericTitle || pageTitle.length > 50) {
            // Extract meaningful name from URL path
            const pathParts = pathname.split('/').filter(part => part && part !== 'index.html');
            
            if (pathParts.length > 0) {
              // Use the last meaningful part of the path
              const lastPart = pathParts[pathParts.length - 1];
              // Remove file extensions and clean up
              const cleanPart = lastPart.replace(/\.(html|htm|php|asp|jsp)$/i, '');
              pageName = cleanPart.charAt(0).toUpperCase() + cleanPart.slice(1).replace(/[-_]/g, ' ');
            } else {
              // Check if we're on root/home page - use "Home" instead of domain
              if (pathname === '/' || pathname === '' || pathname === '/index.html') {
                pageName = 'Home';
              } else {
                // Use domain name if no meaningful path
                const domain = url.hostname.replace('www.', '');
                pageName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
              }
            }
          }
          
          // Final fallback - ensure we never have an empty page name
          if (!pageName || pageName.trim() === '') {
            pageName = 'Unknown Page';
          }
          
          // Ensure page name is reasonable length
          if (pageName.length > 50) {
            pageName = pageName.substring(0, 50).trim() + '...';
          }
          pageContextInput.value = pageName;
        }
      }
    } catch (error) {
      console.warn('Failed to update page context:', error);
    }
  }

  private async checkForRecordingData() {
    try {
      const storedData = localStorage.getItem('mcp-recorded-elements');
      if (storedData) {
        const elements = JSON.parse(storedData);
      }
    } catch (error) {
      console.warn('Failed to check for recording data:', error);
    }
  }

  private setupRecordingDataPolling() {
    // Poll every second for new recording data when recording is active
    setInterval(() => {
      if (this.isRecording) {
        this.checkForNewRecordingData();
      }
    }, 1000);
  }

  private async checkForNewRecordingData() {
    try {
      const storedData = localStorage.getItem('mcp-recorded-elements');
      if (storedData) {
        const elements = JSON.parse(storedData);
        // Process any new elements here if needed
      }
    } catch (error) {
      console.warn('Failed to check for new recording data:', error);
    }
  }

  private async startRecording() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        this.showError('No active tab found');
        return;
      }

      await chrome.tabs.sendMessage(tabs[0].id!, { type: 'START_RECORDING' });
      
      this.isRecording = true;
      this.updateRecordingUI();
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.showError('Failed to start recording');
    }
  }

  private async stopRecording() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.tabs.sendMessage(tabs[0].id!, { type: 'STOP_RECORDING' });
      }
      
      this.isRecording = false;
      this.updateRecordingUI();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.showError('Failed to stop recording');
    }
  }

  private updateRecordingUI() {
    const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    const stopRecordBtn = document.getElementById('stop-record-btn') as HTMLButtonElement;
    const instructionsPanel = document.getElementById('recording-instructions');

    if (recordBtn && stopRecordBtn) {
      if (this.isRecording) {
        recordBtn.disabled = true;
        recordBtn.classList.add('recording');
        stopRecordBtn.disabled = false;
        if (instructionsPanel) instructionsPanel.style.display = 'block';
      } else {
        recordBtn.disabled = false;
        recordBtn.classList.remove('recording');
        stopRecordBtn.disabled = true;
        if (instructionsPanel) instructionsPanel.style.display = 'none';
      }
    }
  }

  private async declarePage() {
    try {
      const pageContextInput = document.getElementById('page-context') as HTMLInputElement;
      const pageName = pageContextInput?.value || 'Unknown Page';
      
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        this.showError('No active tab found');
        return;
      }

      const response = await chrome.runtime.sendMessage({
        method: 'tools/call',
        params: {
          name: 'page.declare',
          arguments: {
            page: pageName,
            url: tabs[0].url,
            timestamp: Date.now()
          }
        }
      });

      if (response.success) {
        console.log('Page declared successfully:', pageName);
      } else {
        this.showError('Failed to declare page');
      }
    } catch (error) {
      console.error('Failed to declare page:', error);
      this.showError('Failed to declare page');
    }
  }

  private handleRecordedElement(element: any) {
    this.showRecordingFeedback(element);
  }

  private showRecordingFeedback(element: any) {
    const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    if (recordBtn && this.isRecording) {
      const originalText = recordBtn.textContent;
      recordBtn.textContent = '✓ Captured!';
      recordBtn.style.background = '#28a745';
      
      setTimeout(() => {
        recordBtn.textContent = originalText;
        recordBtn.style.background = '';
      }, 1500);
    }
  }

  private async suggestOptimizedElements(): Promise<void> {
    try {
      const suggestBtn = document.getElementById('suggest-btn') as HTMLButtonElement;
      const intentInput = document.getElementById('intent-input') as HTMLInputElement;
      const statusPanel = document.getElementById('suggestion-status');
      const messageElement = document.getElementById('suggestion-message');
      
      const intent = intentInput?.value?.trim() || '';
      
      // Show status panel and disable button
      if (statusPanel) statusPanel.style.display = 'block';
      if (suggestBtn) {
        suggestBtn.disabled = true;
        suggestBtn.textContent = intent ? '🎯 Analyzing...' : '🔍 Discovering...';
      }
      if (messageElement) {
        messageElement.textContent = intent 
          ? `Searching for elements related to: "${intent}"...`
          : 'Discovering all interactive elements on the page...';
      }

      // Get the current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        throw new Error('No active tab found');
      }

      // Send message to content script to suggest elements
      const response = await chrome.tabs.sendMessage(tabs[0].id!, {
        type: intent ? 'SUGGEST_OPTIMIZED_SELECTOR' : 'SUGGEST_ELEMENTS',
        payload: intent ? { intent } : {}
      });

      if (response?.success) {
        if (messageElement) {
          messageElement.textContent = intent 
            ? `Found elements for "${intent}"! Check the elements page for results.`
            : 'Element discovery completed! Check the elements page for results.';
        }
        
        setTimeout(() => {
          if (statusPanel) statusPanel.style.display = 'none';
        }, 3000);
      } else {
        throw new Error(response?.error || 'Failed to get suggestions');
      }
      
    } catch (error) {
      console.error('Element suggestion failed:', error);
      const messageElement = document.getElementById('suggestion-message');
      if (messageElement) {
        messageElement.textContent = `AI suggestion failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      
      setTimeout(() => {
        const statusPanel = document.getElementById('suggestion-status');
        if (statusPanel) statusPanel.style.display = 'none';
      }, 5000);
    } finally {
      const suggestBtn = document.getElementById('suggest-btn') as HTMLButtonElement;
      if (suggestBtn) {
        suggestBtn.disabled = false;
        suggestBtn.textContent = '🔍 Discover Elements';
      }
    }
  }

  private async suggestElements(): Promise<void> {
    try {
      const suggestBtn = document.getElementById('suggest-legacy-btn') as HTMLButtonElement;
      const statusPanel = document.getElementById('suggestion-status');
      const messageElement = document.getElementById('suggestion-message');
      
      // Show status panel and disable button
      if (statusPanel) statusPanel.style.display = 'block';
      if (suggestBtn) {
        suggestBtn.disabled = true;
        suggestBtn.textContent = '🤖 Analyzing...';
      }
      if (messageElement) {
        messageElement.textContent = 'Analyzing page structure and suggesting test elements...';
      }

      // Get the current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        throw new Error('No active tab found');
      }

      // Send message to content script to suggest elements
      const response = await chrome.tabs.sendMessage(tabs[0].id!, {
        type: 'SUGGEST_ELEMENTS',
        payload: {}
      });

      if (response?.success) {
        if (messageElement) {
          messageElement.textContent = 'AI suggestions completed! Check the elements page for results.';
        }
        
        setTimeout(() => {
          if (statusPanel) statusPanel.style.display = 'none';
        }, 3000);
      } else {
        throw new Error(response?.error || 'Failed to get suggestions');
      }
      
    } catch (error) {
      console.error('Element suggestion failed:', error);
      const messageElement = document.getElementById('suggestion-message');
      if (messageElement) {
        messageElement.textContent = `AI suggestion failed: ${error instanceof Error ? error.message : String(error)}`;
      }
      
      setTimeout(() => {
        const statusPanel = document.getElementById('suggestion-status');
        if (statusPanel) statusPanel.style.display = 'none';
      }, 5000);
    } finally {
      const suggestBtn = document.getElementById('suggest-legacy-btn') as HTMLButtonElement;
      if (suggestBtn) {
        suggestBtn.disabled = false;
        suggestBtn.textContent = '🤖 AI Suggest (Legacy)';
      }
    }
  }

  private openElementsViewer(): void {
    // Open the React frontend in a new tab
    chrome.tabs.create({ url: 'http://localhost:3000' });
  }

  private async clearAllElements(): Promise<void> {
    try {
      const confirmed = confirm('Are you sure you want to clear all recorded elements? This action cannot be undone.');
      if (!confirmed) return;

      // Call the backend to clear all elements
      const response = await fetch('http://localhost:3001/api/elements', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        alert('All elements cleared successfully!');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to clear elements:', error);
      alert(`Failed to clear elements: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private showError(message: string) {
    console.error(message);
    // Could add visual error display here
  }
}

// Initialize the MCP client when the popup is loaded
document.addEventListener('DOMContentLoaded', () => {
  new MCPClient();
});