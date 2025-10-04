import type { 
  MCPTool, 
  MCPToolCallRequest, 
  MCPToolListRequest, 
  MCPResponse, 
  ToolResult,
  UIAction,
  ElementRepository,
  VerificationPreset,
  ContextStore
} from './types.js';
import { El, SelectorResult } from './types/element.js';
import { suggestSelector } from './background/suggester.js';
import apiClient from './api-client.js';

class MCPToolRegistry {
  private tools: Map<string, MCPTool> = new Map();
  private elementRepo: ElementRepository = {};
  private contextStore: ContextStore = {};
  private verificationPresets: VerificationPreset[] = [];
  private recordingDataStore: any[] = [];
  private currentPageInfo: { page: string; url: string; timestamp: number } | null = null;

  constructor() {
    this.initializeTools();
    this.loadStoredData();
  }

  private initializeTools() {
    // Register run_action tool
    this.tools.set('run_action', {
      name: 'run_action',
      description: 'Execute UI actions like click and type on web page elements',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['ui.click', 'ui.type'] },
              elementId: { type: 'string' },
              text: { type: 'string' },
              options: { type: 'object' }
            },
            required: ['type', 'elementId']
          }
        },
        required: ['action']
      }
    });

    // Register verify.section tool
    this.tools.set('verify.section', {
      name: 'verify.section',
      description: 'Run multiple verification checks from a stored preset',
      inputSchema: {
        type: 'object',
        properties: {
          presetName: { type: 'string' },
          preset: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              checks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['exists', 'visible', 'text', 'attribute', 'count'] },
                    elementId: { type: 'string' },
                    selector: { type: 'string' },
                    expected: {},
                    description: { type: 'string' }
                  },
                  required: ['type', 'description']
                }
              }
            },
            required: ['name', 'checks']
          }
        }
      }
    });

    // Register context tools
    this.tools.set('context.put', {
      name: 'context.put',
      description: 'Store a value in the context for later use',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: {},
          type: { type: 'string' }
        },
        required: ['key', 'value']
      }
    });

    this.tools.set('context.get', {
      name: 'context.get',
      description: 'Retrieve a value from the context',
      inputSchema: {
        type: 'object',
        properties: {
          key: { type: 'string' }
        },
        required: ['key']
      }
    });

    this.tools.set('context.expectEqual', {
      name: 'context.expectEqual',
      description: 'Compare two values and assert they are equal',
      inputSchema: {
        type: 'object',
        properties: {
          actual: {},
          expected: {},
          description: { type: 'string' }
        },
        required: ['actual', 'expected']
      }
    });

    // Register element repository tools
    this.tools.set('elements.add', {
      name: 'elements.add',
      description: 'Add an element to the repository with selector candidates',
      inputSchema: {
        type: 'object',
        properties: {
          elementId: { type: 'string' },
          elementData: {
            type: 'object',
            properties: {
              tag: { type: 'string' },
              text: { type: 'string' },
              attributes: { type: 'object' },
              selectors: { type: 'array', items: { type: 'string' } }
            },
            required: ['tag', 'selectors']
          }
        },
        required: ['elementId', 'elementData']
      }
    });

    this.tools.set('elements.get', {
      name: 'elements.get',
      description: 'Retrieve element data from the repository',
      inputSchema: {
        type: 'object',
        properties: {
          elementId: { type: 'string' }
        },
        required: ['elementId']
      }
    });

    // Add new page-aware tools
    this.tools.set('elements.listByPage', {
      name: 'elements.listByPage',
      description: 'List all elements for a specific page',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'string' }
        },
        required: ['page']
      }
    });

    this.tools.set('elements.listPages', {
      name: 'elements.listPages',
      description: 'List all pages that have recorded elements',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    });

    // Add page declaration tool for MCP API compatibility
    this.tools.set('page.declare', {
      name: 'page.declare',
      description: 'Declare the current page context to the MCP API',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          url: { type: 'string' },
          timestamp: { type: 'number' }
        },
        required: ['page']
      }
    });

    // Add AI-powered element suggestion tool
    this.tools.set('suggest_elements', {
      name: 'suggest_elements',
      description: 'Use AI to analyze the current page and suggest test elements',
      inputSchema: {
        type: 'object',
        properties: {
          includeCategories: {
            type: 'array',
            items: { 
              type: 'string',
              enum: ['authentication', 'navigation', 'form', 'action', 'general']
            },
            description: 'Filter suggestions by element categories'
          },
          maxSuggestions: {
            type: 'number',
            minimum: 1,
            maximum: 20,
            default: 10,
            description: 'Maximum number of suggestions to return'
          }
        }
      }
    });
  }

  public listTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  public async callTool(name: string, args: Record<string, any>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`
      };
    }

    try {
      switch (name) {
        case 'run_action':
          return await this.executeRunAction(args.action);
        
        case 'verify.section':
          return await this.executeVerifySection(args.presetName, args.preset);
        
        case 'context.put':
          return this.executeContextPut(args.key, args.value, args.type);
        
        case 'context.get':
          return this.executeContextGet(args.key);
        
        case 'context.expectEqual':
          return this.executeContextExpectEqual(args.actual, args.expected, args.description);
        
        case 'elements.add':
          return this.executeElementsAdd(args.elementId, args.elementData);
        
        case 'elements.get':
          return this.executeElementsGet(args.elementId);
        
        case 'elements.listByPage':
          return this.executeElementsListByPage(args.page);
        
        case 'elements.listPages':
          return this.executeElementsListPages();
        
        case 'page.declare':
          return this.executePageDeclare(args.page, args.url, args.timestamp);
        
        case 'suggest_elements':
          return this.executeSuggestElements(args.includeCategories, args.maxSuggestions);
        
        default:
          return {
            success: false,
            error: `Tool '${name}' is not implemented`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async executeRunAction(action: UIAction): Promise<ToolResult> {
    try {
      // Get the current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        return { success: false, error: 'No active tab found' };
      }

      // Send message to content script to execute the action
      const response = await chrome.tabs.sendMessage(tabs[0].id!, {
        type: 'EXECUTE_ACTION',
        payload: action
      });

      return response || { success: false, error: 'No response from content script' };
    } catch (error) {
      return {
        success: false,
        error: `Failed to execute action: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async executeVerifySection(presetName?: string, preset?: VerificationPreset): Promise<ToolResult> {
    let verificationPreset: VerificationPreset;
    
    if (preset) {
      verificationPreset = preset;
    } else if (presetName) {
      const found = this.verificationPresets.find(p => p.name === presetName);
      if (!found) {
        return { success: false, error: `Verification preset '${presetName}' not found` };
      }
      verificationPreset = found;
    } else {
      return { success: false, error: 'Either presetName or preset must be provided' };
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        return { success: false, error: 'No active tab found' };
      }

      const response = await chrome.tabs.sendMessage(tabs[0].id!, {
        type: 'VERIFY_SECTION',
        payload: verificationPreset
      });

      return response || { success: false, error: 'No response from content script' };
    } catch (error) {
      return {
        success: false,
        error: `Verification failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private executeContextPut(key: string, value: any, type?: string): ToolResult {
    this.contextStore[key] = {
      value,
      timestamp: Date.now(),
      type
    };
    this.saveContextStore();
    return { success: true, data: { key, stored: true } };
  }

  private executeContextGet(key: string): ToolResult {
    const contextValue = this.contextStore[key];
    if (!contextValue) {
      return { success: false, error: `Context key '${key}' not found` };
    }
    return { success: true, data: contextValue };
  }

  private executeContextExpectEqual(actual: any, expected: any, description?: string): ToolResult {
    const isEqual = JSON.stringify(actual) === JSON.stringify(expected);
    return {
      success: isEqual,
      data: {
        actual,
        expected,
        equal: isEqual,
        description: description || 'Equality check'
      },
      error: isEqual ? undefined : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    };
  }

  private executeElementsAdd(elementId: string, elementData: any): ToolResult {
    this.elementRepo[elementId] = {
      ...elementData,
      lastUpdated: Date.now()
    };
    this.saveElementRepo();
    return { success: true, data: { elementId, added: true } };
  }

  private executeElementsGet(elementId: string): ToolResult {
    const elementData = this.elementRepo[elementId];
    if (!elementData) {
      return { success: false, error: `Element '${elementId}' not found in repository` };
    }
    return { success: true, data: elementData };
  }

  private executeElementsListByPage(page: string): ToolResult {
    const elementsForPage = Object.entries(this.elementRepo)
      .filter(([_, elementData]) => elementData.page === page)
      .map(([elementId, elementData]) => ({
        elementId,
        ...elementData
      }));

    return {
      success: true,
      data: {
        page,
        elements: elementsForPage,
        count: elementsForPage.length
      }
    };
  }

  private executeElementsListPages(): ToolResult {
    const pages = [...new Set(
      Object.values(this.elementRepo)
        .map(element => element.page)
        .filter(page => page)
    )];

    const pageStats = pages.map(page => {
      const elementCount = Object.values(this.elementRepo)
        .filter(element => element.page === page).length;
      return { page, elementCount };
    });

    return {
      success: true,
      data: {
        pages: pageStats,
        totalPages: pages.length,
        totalElements: Object.keys(this.elementRepo).length
      }
    };
  }

  private async loadStoredData() {
    try {
      const result = await chrome.storage.local.get(['elementRepo', 'contextStore', 'verificationPresets']);
      if (result.elementRepo) this.elementRepo = result.elementRepo;
      if (result.contextStore) this.contextStore = result.contextStore;
      if (result.verificationPresets) this.verificationPresets = result.verificationPresets;
    } catch (error) {
      console.warn('Failed to load stored data:', error);
    }
  }

  private async saveElementRepo() {
    try {
      await chrome.storage.local.set({ elementRepo: this.elementRepo });
    } catch (error) {
      console.warn('Failed to save element repository:', error);
    }
  }

  private async saveContextStore() {
    try {
      await chrome.storage.local.set({ contextStore: this.contextStore });
    } catch (error) {
      console.warn('Failed to save context store:', error);
    }
  }

  public async saveVerificationPresets() {
    try {
      await chrome.storage.local.set({ verificationPresets: this.verificationPresets });
    } catch (error) {
      console.warn('Failed to save verification presets:', error);
    }
  }

  public addVerificationPreset(preset: VerificationPreset) {
    const existingIndex = this.verificationPresets.findIndex(p => p.name === preset.name);
    if (existingIndex >= 0) {
      this.verificationPresets[existingIndex] = preset;
    } else {
      this.verificationPresets.push(preset);
    }
    this.saveVerificationPresets();
  }

  public getElementRepository(): ElementRepository {
    return { ...this.elementRepo };
  }

  public addRecordingData(recordingData: any) {
    this.recordingDataStore.push({
      ...recordingData,
      timestamp: Date.now()
    });
    // Keep only last 10 recordings to avoid memory issues
    if (this.recordingDataStore.length > 10) {
      this.recordingDataStore = this.recordingDataStore.slice(-10);
    }
  }

  public getStoredRecordingData(): any[] {
    const data = [...this.recordingDataStore];
    this.recordingDataStore = []; // Clear after retrieving
    return data;
  }

  private executePageDeclare(page: string, url?: string, timestamp?: number): ToolResult {
    this.currentPageInfo = {
      page,
      url: url || 'unknown',
      timestamp: timestamp || Date.now()
    };

    return {
      success: true,
      data: {
        message: `Page '${page}' declared successfully`,
        pageInfo: this.currentPageInfo
      }
    };
  }

  private async executeSuggestElements(includeCategories?: string[], maxSuggestions?: number): Promise<ToolResult> {
    try {
      // Get the current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        return { success: false, error: 'No active tab found' };
      }

      // Send message to content script to extract DOM and get suggestions
      const response = await chrome.tabs.sendMessage(tabs[0].id!, {
        type: 'SUGGEST_ELEMENTS',
        payload: {
          includeCategories,
          maxSuggestions: maxSuggestions || 100
        }
      });

      if (response?.success) {
        return {
          success: true,
          data: {
            suggestions: response.suggestions,
            metadata: response.metadata
          }
        };
      } else {
        return {
          success: false,
          error: response?.error || 'Failed to get element suggestions'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to suggest elements: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  public getCurrentPageInfo() {
    return this.currentPageInfo;
  }

  public getAllTestData() {
    return {
      pageInfo: this.currentPageInfo,
      elements: this.elementRepo,
      context: this.contextStore,
      recordingData: this.recordingDataStore,
      exportedAt: Date.now()
    };
  }

  public async exportToWebsite(websiteUrl?: string) {
    const testData = this.getAllTestData();
    const targetUrl = websiteUrl || 'http://localhost:3000';
    
    try {
      const response = await fetch(`${targetUrl}/api/v1/mcp/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      });
      
      if (response.ok) {
        return { success: true, message: 'Data exported successfully' };
      } else {
        return { success: false, error: `Export failed: ${response.statusText}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Export failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }
}

// Enhanced SQL backend integration with persistent connection monitoring
let sqlBackendHealthy = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

async function checkSQLBackendHealth(): Promise<boolean> {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL && sqlBackendHealthy) {
    return sqlBackendHealthy;
  }

  try {
    sqlBackendHealthy = await apiClient.healthCheck();
    lastHealthCheck = now;
    return sqlBackendHealthy;
  } catch (error) {
    console.error('SQL backend health check failed:', error);
    sqlBackendHealthy = false;
    lastHealthCheck = now;
    return false;
  }
}

// Enhanced function to record element with better error handling
async function recordElementToSQL(elementData: any): Promise<{success: boolean, error?: string}> {
  try {
    // Check backend health first
    const isHealthy = await checkSQLBackendHealth();
    if (!isHealthy) {
      console.warn('SQL backend not healthy, storing element locally');
      return { success: false, error: 'SQL backend unavailable' };
    }

    const response = await apiClient.recordElement(elementData);
    if (response.success) {
      return { success: true };
    } else {
      console.error('SQL backend returned error:', response.error);
      return { success: false, error: response.error };
    }
  } catch (error: any) {
    console.error('Error recording element to SQL backend:', error);
    return { success: false, error: error.message };
  }
}

// Function to sync all local data to SQL backend
async function syncAllDataToSQL(): Promise<{success: boolean, message?: string, error?: string}> {
  try {
    
    // Check if SQL backend is available
    const isHealthy = await checkSQLBackendHealth();
    if (!isHealthy) {
      throw new Error('SQL backend is not available');
    }

    const allData = toolRegistry.getAllTestData();
    let syncedElements = 0;

    // Sync recorded elements
    if (allData.elements && Object.keys(allData.elements).length > 0) {
      const elements = Object.entries(allData.elements).map(([id, data]: [string, any]) => ({
        element_id: id,
        tag: data.tag,
        text_content: data.text,
        attributes: data.attributes || {},
        xpath: data.selectors?.[1] || '',
        css_selector: data.selectors?.[0] || '',
        selectors: data.selectors || [],
        page: data.page || 'unknown'
      }));

      const response = await apiClient.bulkRecordElements(elements);
      if (response.success && response.data) {
        syncedElements = response.data.length;
      }
    }

    // Sync recording data (if any pending)
    if (allData.recordingData && allData.recordingData.length > 0) {
      for (const recording of allData.recordingData) {
        await apiClient.recordElement({
          id: recording.suggestedIds?.[0] || `recorded-${Date.now()}`,
          tag: recording.tag,
          text: recording.text,
          attributes: recording.attributes,
          xpath: recording.xpath,
          cssSelector: recording.cssSelector,
          position: recording.position,
          selectors: recording.selectors,
          page: recording.page || 'unknown'
        });
        syncedElements++;
      }
    }
    return {
      success: true,
      message: `Successfully synced ${syncedElements} elements to SQL backend`
    };

  } catch (error: any) {
    console.error('Failed to sync to SQL backend:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during sync'
    };
  }
}

// Periodic health check for SQL backend
setInterval(async () => {
  await checkSQLBackendHealth();
}, HEALTH_CHECK_INTERVAL);

// Initialize the MCP tool registry
const toolRegistry = new MCPToolRegistry();

// Handle MCP requests from popup and other sources
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.method === 'tools/list') {
    const tools = toolRegistry.listTools();
    sendResponse({ success: true, result: tools });
    return true;
  }

  if (request.method === 'tools/call') {
    toolRegistry.callTool(request.params.name, request.params.arguments)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }));
    return true; // Will respond asynchronously
  }

  if (request.type === 'GET_ELEMENT_REPO') {
    sendResponse({ success: true, data: toolRegistry.getElementRepository() });
    return true;
  }

  // Handle page declaration from content script
  if (request.type === 'PAGE_DECLARE') {
    
    try {
      const result = toolRegistry.callTool('page.declare', {
        page: request.payload.page,
        url: request.payload.url,
        timestamp: request.payload.timestamp
      });
      
      sendResponse({ success: true, data: result });
    } catch (error: any) {
      console.error('Failed to declare page:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  // Test connection handler
  if (request.type === 'TEST_CONNECTION') {
    sendResponse({ success: true, message: 'Background script is responding' });
    return true;
  }

  // Handle optimized AI selector suggestions
  if (request.type === 'SUGGEST_SELECTOR') {  
    (async () => {
      try {
        const { intent, url, elements } = request.payload;
        
        if (!intent || !url || !elements || !Array.isArray(elements)) {
          throw new Error('Invalid request: missing intent, url, or elements');
        }
        const result = await suggestSelector(intent, url, elements);        
        sendResponse({
          success: true,
          ...result
        });
      } catch (error: any) {
        console.error('Optimized selector suggestion failed:', error);
        sendResponse({
          success: false,
          error: `Selector suggestion failed: ${error.message}`
        });
      }
    })();
    
    return true; // Will respond asynchronously
  }

  // Handle legacy AI element suggestions from content script
  if (request.type === 'SUGGEST_ELEMENTS') {
    
    (async () => {
      try {
        
        const aiServicePayload = {
          domData: request.payload.domData,
          options: {
            includeCategories: request.payload.includeCategories || ['authentication', 'navigation', 'form', 'action', 'verification', 'general'],
            maxSuggestions: request.payload.maxSuggestions || 100,
            confidenceThreshold: request.payload.confidenceThreshold || 0.6,
            useHeuristicFallback: true
          }
        };        
        const response = await fetch('http://localhost:3002/api/ai/suggest-elements', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(aiServicePayload)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        sendResponse(result);
      } catch (error: any) {
        console.error('AI suggestion failed:', error);
        
        // Provide specific error messages for different failure types
        let errorMessage = `AI suggestion failed: ${error.message}`;
        if (error.message.includes('timeout')) {
          errorMessage = 'AI analysis timed out. The AI service should have fallen back to heuristic analysis automatically.';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Could not connect to AI service. Please ensure the AI service is running on port 3002.';
        }
        
        sendResponse({
          success: false,
          error: errorMessage
        });
      }
    })();
    
    return true; // Will respond asynchronously
  }

  // Forward recording data from content script to popup
  if (request.type === 'RECORDING_DATA') {
    
    // Store the data temporarily
    toolRegistry.addRecordingData(request.payload);
    
      // Automatically add recorded element to repository and SQL backend
    if (request.payload && request.payload.suggestedIds && request.payload.suggestedIds.length > 0) {
      const elementId = request.payload.suggestedIds[0];
      const currentPageInfo = toolRegistry.getCurrentPageInfo();
      const elementPage = currentPageInfo?.page || request.payload.page || window.location?.href || 'unknown';
      
      const elementData = {
        tag: request.payload.tag,
        text: request.payload.text,
        attributes: request.payload.attributes,
        selectors: [
          request.payload.cssSelector,
          request.payload.xpath,
          ...(request.payload.selectors || [])
        ].filter(Boolean),
        page: elementPage
      };      // Add to local repository first
      toolRegistry.callTool('elements.add', { elementId, elementData }).then(() => {
        console.log(`Added element '${elementId}' to local repository`);
      }).catch(error => {
        console.error('Failed to add element to local repository:', error);
      });

      // Enhanced SQL backend recording
      const sqlElementData = {
        id: elementId,
        tag: request.payload.tag,
        text: request.payload.text,
        attributes: request.payload.attributes,
        xpath: request.payload.xpath,
        cssSelector: request.payload.cssSelector,
        position: request.payload.position,
        selectors: [
          request.payload.cssSelector,
          request.payload.xpath,
          ...(request.payload.selectors || [])
        ].filter(Boolean),
        page: elementPage
      };

      // Record to SQL backend with enhanced error handling
      recordElementToSQL(sqlElementData).then(result => {
        if (result.success) {
          console.log('Element successfully saved to SQL backend');
        } else {
          console.warn('⚠️ Failed to save to SQL backend, stored locally:', result.error);
          // Store as fallback data for later sync
          chrome.storage.local.get(['sql_fallback_elements'], (result) => {
            const fallbackElements = result.sql_fallback_elements || [];
            fallbackElements.push({
              elementData: sqlElementData,
              timestamp: Date.now(),
              error: result.error
            });
            chrome.storage.local.set({ sql_fallback_elements: fallbackElements.slice(-50) }); // Keep last 50
          });
        }
      }).catch(error => {
        console.error('❌ Critical error recording to SQL backend:', error);
      });
    }
    
    // Try to send to popup immediately (may fail if popup is closed)
    try {
      chrome.runtime.sendMessage({
        type: 'RECORDING_DATA',
        payload: request.payload
      });
    } catch (error) {
      console.log('No popup open to receive recording data immediately, stored for later retrieval');
    }
    
    sendResponse({ success: true });
    return true;
  }

  // Get stored recording data when popup opens
  if (request.type === 'GET_RECORDING_DATA') {
    const recordingData = toolRegistry.getStoredRecordingData();
    sendResponse({ success: true, data: recordingData });
    return true;
  }

  // Export all test data for frontend integration
  if (request.type === 'GET_ALL_TEST_DATA') {
    const allData = toolRegistry.getAllTestData();
    sendResponse({ success: true, data: allData });
    return true;
  }

  // Sync all data to SQL backend with fallback retry
  if (request.type === 'SYNC_TO_SQL') {
    const performSync = async () => {
      try {
        const result = await syncAllDataToSQL();
        
        // Also sync any fallback elements that failed previously
        const fallbackResult = await chrome.storage.local.get(['sql_fallback_elements']);
        const fallbackElements = fallbackResult.sql_fallback_elements || [];
        
        if (fallbackElements.length > 0) {
          let syncedFallback = 0;
          
          for (const fallbackItem of fallbackElements) {
            const retryResult = await recordElementToSQL(fallbackItem.elementData);
            if (retryResult.success) {
              syncedFallback++;
            }
          }
          
          if (syncedFallback > 0) {
            // Remove successfully synced items
            const remaining = fallbackElements.slice(syncedFallback);
            await chrome.storage.local.set({ sql_fallback_elements: remaining });
          }
          
          return {
            ...result,
            message: `${result.message || ''} + ${syncedFallback} fallback elements synced`
          };
        }
        
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    };
    
    performSync().then(result => {
      sendResponse(result);
    });
    return true; // Async response
  }

  // Export data to website
  if (request.type === 'EXPORT_TO_WEBSITE') {
    toolRegistry.exportToWebsite(request.websiteUrl).then(result => {
      sendResponse(result);
    });
    return true; // Async response
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('MCP Test Runner extension started');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('MCP Test Runner extension installed');
});