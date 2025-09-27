import axios from 'axios';

// Configure axios defaults
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', error.response?.data || error.message);
    
    // Handle different error types
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Server is not running. Please start the backend service.');
    } else if (error.response?.status === 422) {
      throw new Error(error.response.data.detail?.error || 'Invalid request data');
    } else if (error.response?.status >= 500) {
      throw new Error('Server error occurred. Please try again later.');
    } else if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail.error || error.response.data.detail);
    }
    
    throw new Error(error.message || 'An unexpected error occurred');
  }
);

class ApiService {
  // Health check
  static async checkHealth() {
    const response = await apiClient.get('/health');
    return response.data;
  }

  // Generate test plan from natural language prompt
  static async generateTestPlan(prompt) {
    const response = await apiClient.post('/plan', { prompt });
    return response.data;
  }

  // Get system statistics
  static async getSystemStats() {
    const response = await apiClient.get('/catalog/stats');
    return response.data;
  }

  // Get supported intents
  static async getSupportedIntents() {
    const response = await apiClient.get('/catalog/intents');
    return response.data;
  }

  // Get all action templates
  static async getActionTemplates() {
    const response = await apiClient.get('/catalog/templates');
    return response.data;
  }

  // Get specific action template by ID
  static async getActionTemplate(templateId) {
    const response = await apiClient.get(`/catalog/templates/${templateId}`);
    return response.data;
  }

  // Generate actions for specific intent
  static async getActionsForIntent(intent, context = {}) {
    const response = await apiClient.post('/catalog/actions', context, {
      params: { intent }
    });
    return response.data;
  }

  // Batch operations for demo purposes
  static async batchDemo() {
    const [health, stats, intents] = await Promise.all([
      this.checkHealth(),
      this.getSystemStats(),
      this.getSupportedIntents()
    ]);
    
    return { health, stats, intents };
  }
}

export default ApiService;