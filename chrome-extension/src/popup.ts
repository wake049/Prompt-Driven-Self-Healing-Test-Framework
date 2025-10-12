class MCPClient {
  private isRecording = false;

  constructor() {
    this.initializeUI();
  }

  // ---------- helpers added ----------
  private async getActiveTab(): Promise<chrome.tabs.Tab> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !tab.url) throw new Error("No active tab");
    if (!/^https?:/i.test(tab.url)) {
      throw new Error("This page type doesn’t allow content scripts. Open a normal http(s) page.");
    }
    return tab;
  }

  private async ensureContentScript(tabId: number): Promise<void> {
    // try a quick ping first
    try {
      await chrome.tabs.sendMessage(tabId, { type: "PING_CONTENT" });
      return; // content script already there
    } catch {
      // inject and ping again
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
        world: "ISOLATED"
      });
      // small delay then ping
      await new Promise(r => setTimeout(r, 50));
      await chrome.tabs.sendMessage(tabId, { type: "PING_CONTENT" });
    }
  }
  // -----------------------------------

  private async initializeUI() {
    this.setupEventListeners();
    await this.updatePageContext();
    await this.checkForRecordingData();
  }

  private setupEventListeners() {
    const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    const stopRecordBtn = document.getElementById('stop-record-btn') as HTMLButtonElement;
    const suggestBtn = document.getElementById('suggest-btn') as HTMLButtonElement;
    const suggestLegacyBtn = document.getElementById('suggest-legacy-btn') as HTMLButtonElement;

    recordBtn?.addEventListener('click', () => this.startRecording());
    stopRecordBtn?.addEventListener('click', () => this.stopRecording());
    suggestBtn?.addEventListener('click', () => this.suggestOptimizedElements());
    suggestLegacyBtn?.addEventListener('click', () => this.suggestElements());

    const viewElementsBtn = document.getElementById('view-elements-btn') as HTMLButtonElement;
    const viewReviewBtn = document.getElementById('view-review-btn') as HTMLButtonElement;
    const clearElementsBtn = document.getElementById('clear-elements-btn') as HTMLButtonElement;
    viewElementsBtn?.addEventListener('click', () => this.openElementsViewer());
    viewReviewBtn?.addEventListener('click', () => this.openReviewViewer());
    clearElementsBtn?.addEventListener('click', () => this.clearAllElements());

    const declarePageBtn = document.getElementById('declare-page-btn') as HTMLButtonElement;
    declarePageBtn?.addEventListener('click', () => this.declarePage());

    chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
      if (request.type === 'RECORDING_DATA') {
        this.handleRecordedElement(request.payload);
      }
    });

    this.setupRecordingDataPolling();
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
      const generic = ['swag labs','sauce labs','demo','test','home','welcome'];
      if (generic.some(g => pageTitle.toLowerCase().includes(g)) || pageTitle.length > 50) {
        const parts = pathname.split('/').filter(p => p && p !== 'index.html');
        if (parts.length) {
          const last = parts.at(-1)!.replace(/\.(html|htm|php|asp|jsp)$/i, '');
          pageName = last.charAt(0).toUpperCase() + last.slice(1).replace(/[-_]/g, ' ');
        } else if (pathname === '/' || pathname === '' || pathname === '/index.html') {
          pageName = 'Home';
        } else if (url) {
          const domain = url.hostname.replace('www.','');
          pageName = domain.split('.')[0].replace(/-/g,' ');
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

  private async checkForRecordingData() {
    try {
      const stored = localStorage.getItem('mcp-recorded-elements');
      if (stored) JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to check for recording data:', e);
    }
  }

  private setupRecordingDataPolling() {
    setInterval(() => { if (this.isRecording) this.checkForNewRecordingData(); }, 1000);
  }

  private async checkForNewRecordingData() {
    try {
      const stored = localStorage.getItem('mcp-recorded-elements');
      if (stored) JSON.parse(stored);
    } catch (e) {
      console.warn('Failed to check for new recording data:', e);
    }
  }

  private async startRecording() {
    try {
      const tab = await this.getActiveTab();
      await this.ensureContentScript(tab.id!);
      await chrome.tabs.sendMessage(tab.id!, { type: 'START_RECORDING' });
      this.isRecording = true;
      this.updateRecordingUI();
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.showError(error instanceof Error ? error.message : 'Failed to start recording');
    }
  }

  private async stopRecording() {
    try {
      const tab = await this.getActiveTab();
      await this.ensureContentScript(tab.id!);                 // optional, keeps symmetry
      await chrome.tabs.sendMessage(tab.id!, { type: 'STOP_RECORDING' });
      this.isRecording = false;
      this.updateRecordingUI();
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.showError(error instanceof Error ? error.message : 'Failed to stop recording');
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

  private async declarePage() {
    try {
      const input = document.getElementById('page-context') as HTMLInputElement;
      const page = input?.value || 'Unknown Page';
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.runtime.sendMessage({
        method: 'tools/call',
        params: { name: 'page.declare', arguments: { page, url: tab?.url, timestamp: Date.now() } }
      });
      if (!response?.success) throw new Error('Failed to declare page');
    } catch (error) {
      console.error('Failed to declare page:', error);
      this.showError('Failed to declare page');
    }
  }

  private handleRecordedElement(element: any) {
    this.showRecordingFeedback(element);
  }

  private showRecordingFeedback(element: any) {
    const btn = document.getElementById('record-btn') as HTMLButtonElement;
    if (!btn || !this.isRecording) return;
    const orig = btn.textContent;
    btn.textContent = '✓ Captured!';
    btn.style.background = '#28a745';
    setTimeout(() => { btn.textContent = orig || 'Record'; btn.style.background = ''; }, 1500);
  }

  private async suggestOptimizedElements(): Promise<void> {
    const btn = document.getElementById('suggest-btn') as HTMLButtonElement;
    const intentInput = document.getElementById('intent-input') as HTMLInputElement;
    const status = document.getElementById('suggestion-status');
    const msg = document.getElementById('suggestion-message');
    try {
      const intent = intentInput?.value?.trim() || '';
      if (status) status.style.display = 'block';
      if (btn) { btn.disabled = true; btn.textContent = intent ? '🎯 Analyzing...' : '🔍 Discovering...'; }
      if (msg) msg.textContent = intent ? `Searching for elements related to: "${intent}"...`
                                        : 'Discovering all interactive elements on the page...';

      const tab = await this.getActiveTab();
      await this.ensureContentScript(tab.id!);                 // ✅ ensure content.js

      const response = await chrome.tabs.sendMessage(tab.id!, {
        type: intent ? 'SUGGEST_OPTIMIZED_SELECTOR' : 'SUGGEST_ELEMENTS',
        payload: intent ? { intent } : {}
      });

      if (!response?.success) throw new Error(response?.error || 'Failed to get suggestions');
      if (msg) msg.textContent = intent
        ? `Found elements for "${intent}"! Check the elements page for results.`
        : 'Element discovery completed! Check the elements page for results.';
      setTimeout(() => { if (status) status.style.display = 'none'; }, 3000);
    } catch (error) {
      console.error('Element suggestion failed:', error);
      const text = error instanceof Error ? error.message : String(error);
      if (msg) msg.textContent = `AI suggestion failed: ${text}`;
      setTimeout(() => { if (status) status.style.display = 'none'; }, 5000);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔍 Discover Elements'; }
    }
  }

  private async suggestElements(): Promise<void> {
    const btn = document.getElementById('suggest-legacy-btn') as HTMLButtonElement;
    const status = document.getElementById('suggestion-status');
    const msg = document.getElementById('suggestion-message');
    try {
      if (status) status.style.display = 'block';
      if (btn) { btn.disabled = true; btn.textContent = '🤖 Analyzing...'; }
      if (msg) msg.textContent = 'Analyzing page structure and suggesting test elements...';

      const tab = await this.getActiveTab();
      await this.ensureContentScript(tab.id!);                 // ✅ ensure content.js

      const response = await chrome.tabs.sendMessage(tab.id!, { type: 'SUGGEST_ELEMENTS', payload: {} });
      if (!response?.success) throw new Error(response?.error || 'Failed to get suggestions');

      if (msg) msg.textContent = 'AI suggestions completed! Check the elements page for results.';
      setTimeout(() => { if (status) status.style.display = 'none'; }, 3000);
    } catch (error) {
      console.error('Element suggestion failed:', error);
      if (msg) msg.textContent = `AI suggestion failed: ${error instanceof Error ? error.message : String(error)}`;
      setTimeout(() => { if (status) status.style.display = 'none'; }, 5000);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🤖 AI Suggest (Legacy)'; }
    }
  }

  private openElementsViewer(): void {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  }

  private openReviewViewer(): void {
    chrome.tabs.create({ url: 'http://localhost:3000/review' });
  }

  private async clearAllElements(): Promise<void> {
    try {
      const confirmed = confirm('Are you sure you want to clear all recorded elements? This action cannot be undone.');
      if (!confirmed) return;
      const response = await fetch('http://localhost:3001/api/elements', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      alert('All elements cleared successfully!');
    } catch (error) {
      console.error('Failed to clear elements:', error);
      alert(`Failed to clear elements: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private showError(message: string) {
    console.error(message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new MCPClient();
});
