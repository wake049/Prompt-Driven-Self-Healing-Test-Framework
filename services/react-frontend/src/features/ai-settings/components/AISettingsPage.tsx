import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { 
  Settings,
  Zap, 
  Check, 
  X, 
  RefreshCw, 
  AlertCircle,
  Eye,
  EyeOff,
  TestTube,
  Cpu,
  Clock,
  DollarSign,
  ChevronDown,
  Save,
  Play
} from 'lucide-react';

// ================================
// Types
// ================================

interface AIProviderConfig {
  provider: string;
  model: string;
  api_key: string;
  api_base?: string;
  enabled: boolean;
  timeout_ms: number;
  max_retries: number;
  temperature: number;
  max_tokens: number;
}

interface AIConfigurationResponse {
  active_provider: string;
  providers: AIProviderConfig[];
  available_models: Record<string, string[]>;
  status: Record<string, any>;
}

interface ProviderTestResult {
  success: boolean;
  response_text?: string;
  latency_ms?: number;
  error_message?: string;
  token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ================================
// Animations
// ================================

const pulse = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
`;

const slideIn = keyframes`
  from { transform: translateX(-20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

// ================================
// Styled Components
// ================================

const Container = styled.div`
  min-height: 100vh;
  background: #f8f9fa;
  padding: 0;
`;

const Header = styled.div`
  background: white;
  border-bottom: 1px solid #e9ecef;
  padding: 30px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PageTitle = styled.h1`
  margin: 0;
  color: #212529;
  font-size: 2rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StatusIndicator = styled.div<{ status: 'success' | 'warning' | 'error' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  
  ${props => {
    switch (props.status) {
      case 'success':
        return `
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        `;
      case 'warning':
        return `
          background: #fff3cd;
          color: #856404;
          border: 1px solid #ffeaa7;
        `;
      case 'error':
        return `
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        `;
      default:
        return '';
    }
  }}
`;

const ContentArea = styled.div`
  padding: 30px 40px;
  max-width: 1200px;
  margin: 0 auto;
`;

const OverviewCard = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 24px;
  color: white;
  margin-bottom: 30px;
  animation: ${slideIn} 0.5s ease;
`;

const OverviewHeader = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 16px;
`;

const OverviewTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
`;

const OverviewStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-top: 16px;
`;

const StatItem = styled.div`
  background: rgba(255, 255, 255, 0.1);
  padding: 12px;
  border-radius: 8px;
  backdrop-filter: blur(10px);
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  opacity: 0.8;
  margin-bottom: 4px;
`;

const StatValue = styled.div`
  font-weight: 600;
  font-size: 1.1rem;
`;

const ProviderGrid = styled.div`
  display: grid;
  gap: 24px;
  grid-template-columns: 1fr;
`;

const ProviderCard = styled.div<{ active: boolean; enabled: boolean }>`
  background: white;
  border-radius: 12px;
  border: 2px solid ${props => props.active ? '#007bff' : '#e9ecef'};
  box-shadow: ${props => props.active ? '0 4px 16px rgba(0, 123, 255, 0.1)' : '0 2px 8px rgba(0,0,0,0.1)'};
  overflow: hidden;
  transition: all 0.2s ease;
  opacity: ${props => props.enabled ? 1 : 0.7};
  animation: ${slideIn} 0.5s ease;
  
  &:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
`;

const ProviderHeader = styled.div<{ active: boolean }>`
  padding: 20px 24px;
  background: ${props => props.active ? 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)' : '#f8f9fa'};
  color: ${props => props.active ? 'white' : '#495057'};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ProviderName = styled.h3`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ProviderStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 600;
`;

const ProviderContent = styled.div`
  padding: 24px;
`;

const ConfigGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: #495057;
  font-size: 0.9rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: #007bff;
  }
  
  &:disabled {
    background: #f8f9fa;
    color: #6c757d;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  transition: border-color 0.2s;
  
  &:focus {
    outline: none;
    border-color: #007bff;
  }
`;

const PasswordInput = styled.div`
  position: relative;
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 4px;
  
  &:hover {
    color: #495057;
  }
`;

const ActionsRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #e9ecef;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' }>`
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 2px solid;
  
  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: #007bff;
          color: white;
          border-color: #007bff;
          &:hover { background: #0056b3; border-color: #0056b3; }
        `;
      case 'success':
        return `
          background: #28a745;
          color: white;
          border-color: #28a745;
          &:hover { background: #1e7e34; border-color: #1e7e34; }
        `;
      case 'danger':
        return `
          background: #dc3545;
          color: white;
          border-color: #dc3545;
          &:hover { background: #c82333; border-color: #c82333; }
        `;
      case 'warning':
        return `
          background: #ffc107;
          color: #212529;
          border-color: #ffc107;
          &:hover { background: #e0a800; border-color: #e0a800; }
        `;
      default:
        return `
          background: white;
          color: #495057;
          border-color: #e9ecef;
          &:hover { background: #f8f9fa; border-color: #dee2e6; }
        `;
    }
  }}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

const TestResults = styled.div<{ show: boolean }>`
  max-height: ${props => props.show ? '300px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
  margin-top: ${props => props.show ? '16px' : '0'};
`;

const TestResultCard = styled.div<{ success: boolean }>`
  padding: 16px;
  border-radius: 8px;
  border: 1px solid ${props => props.success ? '#c3e6cb' : '#f5c6cb'};
  background: ${props => props.success ? '#d4edda' : '#f8d7da'};
  color: ${props => props.success ? '#155724' : '#721c24'};
`;

const TestMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  margin-top: 12px;
`;

const MetricItem = styled.div`
  text-align: center;
`;

const MetricLabel = styled.div`
  font-size: 0.7rem;
  opacity: 0.8;
  margin-bottom: 2px;
`;

const MetricValue = styled.div`
  font-weight: 600;
  font-size: 0.9rem;
`;

const LoadingSpinner = styled.div`
  animation: ${pulse} 1.5s ease-in-out infinite;
`;

const ErrorMessage = styled.div`
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
  padding: 16px;
  border-radius: 8px;
  margin: 20px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SuccessMessage = styled.div`
  background: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
  padding: 16px;
  border-radius: 8px;
  margin: 20px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

// ================================
// Component
// ================================

const AISettingsPage: React.FC = () => {
  const [config, setConfig] = useState<AIConfigurationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/v1/ai-config/config');
      if (!response.ok) {
        throw new Error(`Failed to load configuration: ${response.statusText}`);
      }
      
      const data = await response.json();
      setConfig(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch('/api/v1/ai-config/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          active_provider: config.active_provider,
          providers: config.providers,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save configuration: ${response.statusText}`);
      }

      const result = await response.json();
      setSuccess('Configuration saved successfully!');
      
      // Reload to get updated status
      setTimeout(() => {
        loadConfiguration();
        setSuccess(null);
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const testProvider = async (provider: AIProviderConfig) => {
    try {
      setTestingProvider(provider.provider);
      setError(null);

      const response = await fetch('/api/v1/ai-config/test-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider_config: provider,
          test_prompt: 'Hello! Please respond with "AI connection successful" to confirm connectivity.',
        }),
      });

      if (!response.ok) {
        throw new Error(`Test request failed: ${response.statusText}`);
      }

      const result = await response.json();
      setTestResults(prev => ({
        ...prev,
        [provider.provider]: result,
      }));

    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [provider.provider]: {
          success: false,
          error_message: err.message,
        },
      }));
    } finally {
      setTestingProvider(null);
    }
  };

  const updateProviderConfig = (providerName: string, field: keyof AIProviderConfig, value: any) => {
    if (!config) return;

    setConfig({
      ...config,
      providers: config.providers.map(p =>
        p.provider === providerName ? { ...p, [field]: value } : p
      ),
    });
  };

  const setActiveProvider = async (providerName: string) => {
    try {
      const response = await fetch('/api/v1/ai-config/switch-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider: providerName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to switch provider: ${response.statusText}`);
      }

      setConfig(prev => prev ? { ...prev, active_provider: providerName } : null);
      setSuccess(`Switched to ${providerName} successfully!`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      setError(err.message);
    }
  };

  const togglePasswordVisibility = (provider: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return '';
      case 'anthropic':
        return '';
      case 'azure':
        return '☁️';
      case 'local':
        return '🖥️';
      default:
        return '⚡';
    }
  };

  const getProviderStatusInfo = () => {
    if (!config) return { status: 'error', text: 'Configuration not loaded' };
    
    const activeProvider = config.providers.find(p => p.provider === config.active_provider);
    if (!activeProvider) {
      return { status: 'error', text: 'No active provider configured' };
    }
    
    if (!activeProvider.enabled) {
      return { status: 'warning', text: 'Active provider is disabled' };
    }
    
    if (!activeProvider.api_key) {
      return { status: 'warning', text: 'Active provider missing API key' };
    }
    
    return { status: 'success', text: `${config.active_provider} is active and configured` };
  };

  if (loading) {
    return (
      <Container>
        <Header>
          <PageTitle>
            <LoadingSpinner><Settings size={24} /></LoadingSpinner>
            AI Provider Settings
          </PageTitle>
        </Header>
        <ContentArea>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <LoadingSpinner>Loading configuration...</LoadingSpinner>
          </div>
        </ContentArea>
      </Container>
    );
  }

  const statusInfo = getProviderStatusInfo();

  return (
    <Container>
      <Header>
        <PageTitle>
          <Settings size={24} />
          AI Provider Settings
        </PageTitle>
        <StatusIndicator status={statusInfo.status as any}>
          {statusInfo.status === 'success' && <Check size={16} />}
          {statusInfo.status === 'warning' && <AlertCircle size={16} />}
          {statusInfo.status === 'error' && <X size={16} />}
          {statusInfo.text}
        </StatusIndicator>
      </Header>

      <ContentArea>
        {error && (
          <ErrorMessage>
            <AlertCircle size={16} />
            {error}
          </ErrorMessage>
        )}

        {success && (
          <SuccessMessage>
            <Check size={16} />
            {success}
          </SuccessMessage>
        )}

        {config && (
          <>
            <OverviewCard>
              <OverviewHeader>
                <OverviewTitle>AI Provider Overview</OverviewTitle>
                <Button variant="secondary" onClick={loadConfiguration}>
                  <RefreshCw size={14} />
                  Refresh
                </Button>
              </OverviewHeader>
              
              <OverviewStats>
                <StatItem>
                  <StatLabel>Active Provider</StatLabel>
                  <StatValue>{config.active_provider.toUpperCase()}</StatValue>
                </StatItem>
                <StatItem>
                  <StatLabel>Configured Providers</StatLabel>
                  <StatValue>{config.providers.length}</StatValue>
                </StatItem>
                <StatItem>
                  <StatLabel>Enabled Providers</StatLabel>
                  <StatValue>{config.providers.filter(p => p.enabled).length}</StatValue>
                </StatItem>
                <StatItem>
                  <StatLabel>Status</StatLabel>
                  <StatValue>{statusInfo.status === 'success' ? 'Ready' : 'Needs Setup'}</StatValue>
                </StatItem>
              </OverviewStats>
            </OverviewCard>

            <ProviderGrid>
              {config.providers.map((provider) => (
                <ProviderCard
                  key={provider.provider}
                  active={provider.provider === config.active_provider}
                  enabled={provider.enabled}
                >
                  <ProviderHeader active={provider.provider === config.active_provider}>
                    <ProviderName>
                      <span>{getProviderIcon(provider.provider)}</span>
                      {provider.provider.toUpperCase()}
                      {provider.provider === config.active_provider && (
                        <span style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>• Active</span>
                      )}
                    </ProviderName>
                    <ProviderStatus>
                      {provider.enabled ? (
                        <><Check size={14} /> Enabled</>
                      ) : (
                        <><X size={14} /> Disabled</>
                      )}
                    </ProviderStatus>
                  </ProviderHeader>

                  <ProviderContent>
                    <ConfigGrid>
                      <FormGroup>
                        <Label>Model</Label>
                        <Select
                          value={provider.model}
                          onChange={(e) => updateProviderConfig(provider.provider, 'model', e.target.value)}
                        >
                          {config.available_models[provider.provider]?.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </Select>
                      </FormGroup>

                      <FormGroup>
                        <Label>API Key</Label>
                        <PasswordInput>
                          <Input
                            type={showPasswords[provider.provider] ? "text" : "password"}
                            value={provider.api_key}
                            onChange={(e) => updateProviderConfig(provider.provider, 'api_key', e.target.value)}
                            placeholder="Enter API key..."
                          />
                          <PasswordToggle
                            type="button"
                            onClick={() => togglePasswordVisibility(provider.provider)}
                          >
                            {showPasswords[provider.provider] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </PasswordToggle>
                        </PasswordInput>
                      </FormGroup>

                      <FormGroup>
                        <Label>Temperature</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={provider.temperature}
                          onChange={(e) => updateProviderConfig(provider.provider, 'temperature', parseFloat(e.target.value))}
                        />
                      </FormGroup>

                      <FormGroup>
                        <Label>Max Tokens</Label>
                        <Input
                          type="number"
                          step="100"
                          min="100"
                          max="8000"
                          value={provider.max_tokens}
                          onChange={(e) => updateProviderConfig(provider.provider, 'max_tokens', parseInt(e.target.value))}
                        />
                      </FormGroup>

                      <FormGroup>
                        <Label>Timeout (ms)</Label>
                        <Input
                          type="number"
                          step="1000"
                          min="5000"
                          max="60000"
                          value={provider.timeout_ms}
                          onChange={(e) => updateProviderConfig(provider.provider, 'timeout_ms', parseInt(e.target.value))}
                        />
                      </FormGroup>

                      <FormGroup>
                        <Label>Max Retries</Label>
                        <Input
                          type="number"
                          min="0"
                          max="5"
                          value={provider.max_retries}
                          onChange={(e) => updateProviderConfig(provider.provider, 'max_retries', parseInt(e.target.value))}
                        />
                      </FormGroup>
                    </ConfigGrid>

                    <ActionsRow>
                      <Button
                        variant={provider.enabled ? "warning" : "success"}
                        onClick={() => updateProviderConfig(provider.provider, 'enabled', !provider.enabled)}
                      >
                        {provider.enabled ? (
                          <>
                            <X size={14} />
                            Disable
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            Enable
                          </>
                        )}
                      </Button>

                      <Button
                        variant="primary"
                        onClick={() => testProvider(provider)}
                        disabled={!provider.enabled || !provider.api_key || testingProvider === provider.provider}
                      >
                        {testingProvider === provider.provider ? (
                          <>
                            <LoadingSpinner><RefreshCw size={14} /></LoadingSpinner>
                            Testing...
                          </>
                        ) : (
                          <>
                            <TestTube size={14} />
                            Test Connection
                          </>
                        )}
                      </Button>

                      {provider.provider !== config.active_provider && provider.enabled && (
                        <Button
                          variant="success"
                          onClick={() => setActiveProvider(provider.provider)}
                        >
                          <Play size={14} />
                          Set Active
                        </Button>
                      )}
                    </ActionsRow>

                    <TestResults show={Boolean(testResults[provider.provider])}>
                      {testResults[provider.provider] && (
                        <TestResultCard success={testResults[provider.provider].success}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            {testResults[provider.provider].success ? (
                              <Check size={16} />
                            ) : (
                              <X size={16} />
                            )}
                            <strong>
                              {testResults[provider.provider].success ? 'Test Passed' : 'Test Failed'}
                            </strong>
                          </div>
                          
                          {testResults[provider.provider].success ? (
                            <>
                              <div style={{ marginBottom: '8px', fontSize: '0.9rem' }}>
                                Response: "{testResults[provider.provider].response_text}"
                              </div>
                              
                              <TestMetrics>
                                <MetricItem>
                                  <MetricLabel>Latency</MetricLabel>
                                  <MetricValue>{testResults[provider.provider].latency_ms}ms</MetricValue>
                                </MetricItem>
                                {testResults[provider.provider].token_usage && (
                                  <>
                                    <MetricItem>
                                      <MetricLabel>Prompt Tokens</MetricLabel>
                                      <MetricValue>{testResults[provider.provider].token_usage!.prompt_tokens}</MetricValue>
                                    </MetricItem>
                                    <MetricItem>
                                      <MetricLabel>Response Tokens</MetricLabel>
                                      <MetricValue>{testResults[provider.provider].token_usage!.completion_tokens}</MetricValue>
                                    </MetricItem>
                                    <MetricItem>
                                      <MetricLabel>Total Tokens</MetricLabel>
                                      <MetricValue>{testResults[provider.provider].token_usage!.total_tokens}</MetricValue>
                                    </MetricItem>
                                  </>
                                )}
                              </TestMetrics>
                            </>
                          ) : (
                            <div style={{ fontSize: '0.9rem' }}>
                              Error: {testResults[provider.provider].error_message}
                            </div>
                          )}
                        </TestResultCard>
                      )}
                    </TestResults>
                  </ProviderContent>
                </ProviderCard>
              ))}
            </ProviderGrid>

            <div style={{ marginTop: '30px', textAlign: 'center' }}>
              <Button
                variant="primary"
                onClick={saveConfiguration}
                disabled={saving}
                style={{ padding: '12px 24px', fontSize: '1rem' }}
              >
                {saving ? (
                  <>
                    <LoadingSpinner><RefreshCw size={16} /></LoadingSpinner>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </ContentArea>
    </Container>
  );
};

export default AISettingsPage;