import React, { useState, useEffect } from 'react';
import styled, { ThemeProvider } from 'styled-components';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { config } from '../../../app/config';
import { http } from '../../../shared/api';
import { BrowserMultiSelect } from '../../../shared/ui/BrowserMultiSelect';

// TypeScript interfaces for styled components
interface PolicyRuleProps {
  $isActive?: boolean;
}

interface RuleTypeProps {
  $color?: string;
}

// Policy type definitions
type PolicyType = 'locatorHealing' | 'executionSafety' | 'multiOutcomeHandling' | 'auditReview';

type PolicyConfigurations = {
  locatorHealing: {
    confidenceThreshold: number;
    maxRetries: number;
    useRepositoryFallback: boolean;
    preferCssOverXpath: boolean;
    active: boolean;
  };
  executionSafety: {
    blockDestructiveActions: boolean;
    requireConfirmationKeywords: string[];
    allowTestModeOverride: boolean;
    preferredBrowsers: string[];
    active: boolean;
  };
  multiOutcomeHandling: {
    confidenceThreshold: number;
    maxCandidates: number;
    preferVisibleElements: boolean;
    active: boolean;
  };
  auditReview: {
    logAllDecisions: boolean;
    escalateUnknownElements: boolean;
    retentionDays: number;
    executionRetentionDays: number;
    active: boolean;
  };
};

type PackConfigurations = {
  strict: {
    locatorHealing?: Partial<PolicyConfigurations['locatorHealing']>;
    executionSafety?: Partial<PolicyConfigurations['executionSafety']>;
    multiOutcomeHandling?: Partial<PolicyConfigurations['multiOutcomeHandling']>;
    auditReview?: Partial<PolicyConfigurations['auditReview']>;
  };
  balanced: {
    locatorHealing?: Partial<PolicyConfigurations['locatorHealing']>;
    executionSafety?: Partial<PolicyConfigurations['executionSafety']>;
    multiOutcomeHandling?: Partial<PolicyConfigurations['multiOutcomeHandling']>;
    auditReview?: Partial<PolicyConfigurations['auditReview']>;
  };
  lenient: {
    locatorHealing?: Partial<PolicyConfigurations['locatorHealing']>;
    executionSafety?: Partial<PolicyConfigurations['executionSafety']>;
    multiOutcomeHandling?: Partial<PolicyConfigurations['multiOutcomeHandling']>;
    auditReview?: Partial<PolicyConfigurations['auditReview']>;
  };
  dev: {
    locatorHealing?: Partial<PolicyConfigurations['locatorHealing']>;
    executionSafety?: Partial<PolicyConfigurations['executionSafety']>;
    multiOutcomeHandling?: Partial<PolicyConfigurations['multiOutcomeHandling']>;
    auditReview?: Partial<PolicyConfigurations['auditReview']>;
  };
};

interface AIProviderConfig {
  id?: string;
  provider: string;
  model: string;
  api_key: string;
  api_base?: string;
  enabled: boolean;
  timeout_ms: number;
  max_retries: number;
  temperature: number;
  max_tokens: number;
  is_default?: boolean;
  is_byok?: boolean;
}

// ================================
// Styled Components
// ================================

const Container = styled.div`
  min-height: 100vh;
  background: ${props => props.theme.colors.background};
`;

const Header = styled.div`
  background: linear-gradient(135deg, ${props => props.theme.colors.primary} 0%, ${props => props.theme.colors.secondary} 100%);
  color: white;
  padding: 2rem;
  text-align: center;
`;

const Title = styled.h1`
  margin: 0 0 0.5rem 0;
  font-size: 2.5rem;
  font-weight: 700;
`;

const Subtitle = styled.p`
  margin: 0;
  font-size: 1.1rem;
  opacity: 0.9;
`;

const MainContent = styled.div`
  padding: 2rem;
`;

const PolicyGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
`;

const PolicyCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: ${props => props.theme.shadows.medium};
  border: 1px solid ${props => props.theme.colors.border};
`;

const CardTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: ${props => props.theme.colors.text};
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PolicySection = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: ${props => props.theme.shadows.medium};
  border: 1px solid ${props => props.theme.colors.border};
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  margin: 0 0 1.5rem 0;
  color: ${props => props.theme.colors.text};
  font-size: 1.5rem;
  font-weight: 600;
  border-bottom: 2px solid ${props => props.theme.colors.border};
  padding-bottom: 0.5rem;
`;

const PolicyRule = styled.div<PolicyRuleProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  margin-bottom: 0.5rem;
  background: ${props => props.$isActive ? 
    (props.theme.colors.surface === '#2d3748' ? '#2a4365' : '#f0f9ff') : 
    (props.theme.colors.surface === '#2d3748' ? '#1a202c' : '#f9fafb')
  };
`;

const RuleInfo = styled.div`
  flex: 1;
`;

const RuleType = styled.span<RuleTypeProps>`
  background: ${props => props.$color || '#6b7280'};
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
`;

const RuleDescription = styled.p`
  margin: 0.5rem 0 0 0;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 0.9rem;
`;

const RuleAction = styled.span`
  color: ${props => props.theme.colors.success};
  font-weight: 600;
  font-size: 0.9rem;
`;

const PolicyToggle = styled.div<{ $isActive: boolean }>`
  position: relative;
  width: 60px;
  height: 32px;
  background: ${props => props.$isActive ? '#1D9E75' : '#d1d5db'};
  border-radius: 16px;
  cursor: pointer;
  transition: background 0.3s;
  
  &:before {
    content: '';
    position: absolute;
    top: 2px;
    left: ${props => props.$isActive ? '30px' : '2px'};
    width: 28px;
    height: 28px;
    background: white;
    border-radius: 50%;
    transition: left 0.3s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
`;

const ThresholdControl = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0.5rem 0;
`;

const ThresholdSlider = styled.input`
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #d1d5db;
  outline: none;
  
  &::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
  }
`;

const ThresholdValue = styled.span`
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  min-width: 60px;
`;

const PolicyPackSelector = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const PolicyPackButton = styled.button<{ $isActive: boolean }>`
  padding: 0.75rem 1.5rem;
  border: 2px solid ${props => props.$isActive ? props.theme.colors.primary : props.theme.colors.border};
  background: ${props => props.$isActive ? props.theme.colors.primary : props.theme.colors.surface};
  color: ${props => props.$isActive ? 'white' : props.theme.colors.textSecondary};
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
    background: ${props => props.$isActive ? props.theme.colors.primary : 
      (props.theme.colors.surface === '#2d3748' ? '#4a5568' : '#f3f4f6')};
  }
`;

const TabContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid ${props => props.theme.colors.border};
`;

const TabButton = styled.button<{ $isActive: boolean }>`
  padding: 0.75rem 1.5rem;
  border: none;
  background: transparent;
  color: ${props => props.$isActive ? props.theme.colors.primary : props.theme.colors.textSecondary};
  font-weight: ${props => props.$isActive ? '600' : '500'};
  cursor: pointer;
  border-bottom: 3px solid ${props => props.$isActive ? props.theme.colors.primary : 'transparent'};
  transition: all 0.2s;
  font-size: 1rem;
  
  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`;

const AuditLog = styled.div`
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 1rem;
`;

const LogEntry = styled.div`
  padding: 0.5rem;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  font-size: 0.875rem;
  
  &:last-child {
    border-bottom: none;
  }
`;

const LogTimestamp = styled.span`
  color: ${props => props.theme.colors.textSecondary};
  font-weight: 600;
`;

const LogAction = styled.span`
  color: ${props => props.theme.colors.success};
  font-weight: 600;
  margin: 0 0.5rem;
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  margin-top: 12px;
  font-size: 14px;
  background-color: ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(252, 129, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(252, 129, 129, 0.3)' : 'rgba(239, 68, 68, 0.2)'};
`;

const LoadingMessage = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  margin-top: 8px;
  font-size: 14px;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const UnsavedChangesIndicator = styled.span`
  color: ${props => props.theme.colors.warning};
  font-size: 14px;
  font-weight: 500;
`;

const SaveButton = styled.button<{ $hasChanges: boolean; $isSaving: boolean }>`
  background-color: ${props => props.$hasChanges ? props.theme.colors.success : 
    (props.theme.colors.surface === '#2d3748' ? '#4a5568' : '#9ca3af')};
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: ${props => props.$hasChanges ? 'pointer' : 'not-allowed'};
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:hover {
    background-color: ${props => props.$hasChanges ? 
      (props.theme.colors.surface === '#2d3748' ? '#1D9E75' : '#0F6E56') : 
      (props.theme.colors.surface === '#2d3748' ? '#4a5568' : '#9ca3af')};
  }
`;
// ================================
// Policy Engine Component  
// ================================

const PolicyEngine: React.FC = () => {
  const { theme } = useTheme();
  const { tenant } = useAuth();
  const [activeTab, setActiveTab] = useState<'policies' | 'ai-providers'>('policies');
  const [activePolicyPack, setActivePolicyPack] = useState('balanced');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<PolicyConfigurations>({
    locatorHealing: {
      confidenceThreshold: 0.85,
      maxRetries: 2,
      useRepositoryFallback: true,
      preferCssOverXpath: true,
      active: true
    },
    executionSafety: {
      blockDestructiveActions: true,
      requireConfirmationKeywords: ['delete', 'remove', 'submit payment'],
      allowTestModeOverride: true,      preferredBrowsers: ["chrome"],      active: true
    },
    multiOutcomeHandling: {
      preferVisibleElements: true,
      confidenceThreshold: 0.75,
      maxCandidates: 5,
      active: true
    },
    auditReview: {
      logAllDecisions: true,
      escalateUnknownElements: true,
      retentionDays: 60,
      executionRetentionDays: 60,
      active: true
    }
  });
  
  const [auditLogs, setAuditLogs] = useState<Array<{timestamp: string, action: string, decision: string, element: string}>>([]);
  const [aiProviders, setAiProviders] = useState<AIProviderConfig[]>([
    { provider: 'openai', model: 'gpt-4-turbo', api_key: '', api_base: 'https://api.openai.com/v1', enabled: true, timeout_ms: 30000, max_retries: 3, temperature: 0.7, max_tokens: 2048, is_byok: false },
    { provider: 'anthropic', model: 'claude-3-sonnet', api_key: '', api_base: 'https://api.anthropic.com', enabled: false, timeout_ms: 30000, max_retries: 3, temperature: 0.7, max_tokens: 2048, is_byok: false },
    { provider: 'google', model: 'gemini-pro', api_key: '', api_base: 'https://generativelanguage.googleapis.com', enabled: false, timeout_ms: 30000, max_retries: 3, temperature: 0.7, max_tokens: 2048, is_byok: false },
    { provider: 'ollama', model: 'llama2', api_key: '', api_base: 'http://localhost:11434', enabled: false, timeout_ms: 60000, max_retries: 3, temperature: 0.7, max_tokens: 2048, is_byok: false },
    { provider: 'azure', model: 'gpt-4-turbo', api_key: '', api_base: 'https://[your-resource].openai.azure.com', enabled: false, timeout_ms: 30000, max_retries: 3, temperature: 0.7, max_tokens: 2048, is_byok: false },
  ]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasUnsavedProviderChanges, setHasUnsavedProviderChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const ollamaProviderEnabled = aiProviders.some((p) => p.provider === 'ollama' && p.enabled);
  const ollamaDownloadUrl = tenant?.id
    ? `${config.apiBaseUrl}/api/ai-providers/ollama/download?organization_id=${encodeURIComponent(tenant.id)}&api_url=${encodeURIComponent(config.apiBaseUrl)}`
    : '';

  // Save AI provider settings to backend
  const handleSaveProviderSettings = async () => {
    if (!tenant?.id) {
      alert('Tenant not found. Please refresh and try again.');
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Build provider map (name -> enabled status)
      const providerMap: Record<string, boolean> = {};
      aiProviders.forEach(p => {
        providerMap[p.provider] = p.enabled;
      });
      
      // Find the enabled provider (there should only be one)
      const enabledProviders = aiProviders.filter(p => p.enabled).map(p => p.provider);
      
      if (enabledProviders.length === 0) {
        alert('Please select at least one provider.');
        return;
      }
      
      const activeProvider = enabledProviders[0];
      
      // Call backend endpoint to save settings
      const response = await http<any>('/api/ai-providers/save-settings', {
        method: 'POST',
        headers: {
          'X-Tenant-Id': tenant.id,
        },
        body: JSON.stringify({
          providers: providerMap,
          default_provider: activeProvider,
        }),
      });
      
      if (response) {
        alert(`✓ AI Provider Saved!\n\n${activeProvider.toUpperCase()} is now the active provider.\nAll future test generation will use this provider.`);
        setHasUnsavedProviderChanges(false);
      }
    } catch (err) {
      console.error('Error saving provider settings:', err);
      alert(`Failed to save provider settings: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Mark changes when providers are toggled
  const handleToggleProvider = (provider: string) => {
    const updatedProviders = aiProviders.map(p =>
      p.provider === provider ? { ...p, enabled: true } : { ...p, enabled: false }
    );
    setAiProviders(updatedProviders);
    setHasUnsavedProviderChanges(true);
  };

  // Load policies from MCP server on component mount
  useEffect(() => {
    const loadPolicies = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch policies and configurations from unified API
        const [dashboardStats, executionLogs, policyConfig] = await Promise.all([
          http<any>('/api/v1/policy/dashboard/stats'),
          http<any[]>('/api/v1/policy/dashboard/execution-logs?limit=10'),
          http<any>('/api/v1/policy/dashboard/config')
        ]);
        
        // Load policy configurations if available
        if (policyConfig && policyConfig.success && policyConfig.data) {
          console.log('Loaded policy configurations:', policyConfig.data);
          setPolicies(policyConfig.data);
        }
        
        // Update audit logs from real data
        if (executionLogs && executionLogs.length > 0) {
          const formattedLogs = executionLogs.map((log: any) => ({
            timestamp: new Date(log.timestamp || log.created_at).toLocaleString(),
            action: log.action_type || log.policy_action || 'EXECUTED',
            decision: log.decision_reason || log.evaluation_result?.decision || 'Policy applied',
            element: log.element_selector || log.context?.selector || 'Unknown element'
          }));
          setAuditLogs(formattedLogs);
        }
        
        // You can also fetch specific policy configurations if available
        // For now, using defaults since the API structure may vary
        console.log('Loaded dashboard stats:', dashboardStats);
        console.log('Loaded execution logs:', executionLogs);

        // Load available AI providers and their system configurations
        try {
          const aiProvidersResponse = await http<{ available_providers: string[], system_configured: string[] }>('/api/ai-providers/available');
          if (aiProvidersResponse) {
            const systemConfigured = aiProvidersResponse.system_configured || [];
            // Update providers to mark which ones have system-configured keys
            setAiProviders(prev => 
              prev.map(provider => ({
                ...provider,
                is_byok: !systemConfigured.includes(provider.provider)
              }))
            );
          }
        } catch (err) {
          console.warn('Could not load AI provider availability:', err);
          // Fall back to defaults
        }
        
      } catch (err) {
        console.error('Failed to load policies from MCP server:', err);
        setError('Failed to connect to policy server. Using default settings.');
        // Keep default policies if API fails
      } finally {
        setLoading(false);
      }
    };

    loadPolicies();
  }, []);

  // Save policy changes to unified API
  const savePolicyChanges = async (updatedPolicies?: PolicyConfigurations) => {
    try {
      setIsSaving(true);
      const policiesToSave = updatedPolicies || policies;
      console.log('Saving policy changes:', policiesToSave);
      
      // Call the unified API endpoint to save policy configurations
      await http('/api/v1/policy/dashboard/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(policiesToSave)
      });
      
      console.log(' Policy configurations saved successfully');
      setHasUnsavedChanges(false);
      
    } catch (err) {
      console.error('Failed to save policy changes:', err);
      setError('Failed to save changes to server');
    } finally {
      setIsSaving(false);
    }
  };

  const policyPacks: Array<{id: keyof PackConfigurations, name: string, description: string}> = [
    { id: 'strict', name: 'Strict', description: 'High security, manual approval for most actions' },
    { id: 'balanced', name: 'Balanced', description: 'Recommended settings for most environments' },
    { id: 'lenient', name: 'Lenient', description: 'Allow more automation, faster execution' },
    { id: 'dev', name: 'Dev Mode', description: 'Development environment with relaxed constraints' }
  ];

  const togglePolicy = (policyType: PolicyType, property: string) => {
    const updatedPolicies = {
      ...policies,
      [policyType]: {
        ...policies[policyType],
        [property]: !policies[policyType][property as keyof typeof policies[typeof policyType]]
      }
    };
    setPolicies(updatedPolicies);
    setHasUnsavedChanges(true);
  };

  const updateThreshold = (policyType: PolicyType, property: string, value: number) => {
    const updatedPolicies = {
      ...policies,
      [policyType]: {
        ...policies[policyType],
        [property]: value
      }
    };
    setPolicies(updatedPolicies);
    setHasUnsavedChanges(true);
  };

  const applyPolicyPack = (packId: keyof PackConfigurations) => {
    setActivePolicyPack(packId);
    
    const packConfigs: PackConfigurations = {
      strict: {
        locatorHealing: { confidenceThreshold: 0.95, maxRetries: 1 },
        executionSafety: { blockDestructiveActions: true },
        multiOutcomeHandling: { confidenceThreshold: 0.90, maxCandidates: 5 },
        auditReview: { retentionDays: 90, executionRetentionDays: 90 }
      },
      balanced: {
        locatorHealing: { confidenceThreshold: 0.85, maxRetries: 2 },
        executionSafety: { blockDestructiveActions: true },
        multiOutcomeHandling: { confidenceThreshold: 0.75, maxCandidates: 8 },
        auditReview: { retentionDays: 60, executionRetentionDays: 60 }
      },
      lenient: {
        locatorHealing: { confidenceThreshold: 0.70, maxRetries: 3 },
        executionSafety: { blockDestructiveActions: false },
        multiOutcomeHandling: { confidenceThreshold: 0.60, maxCandidates: 10 },
        auditReview: { retentionDays: 30, executionRetentionDays: 30 }
      },
      dev: {
        locatorHealing: { confidenceThreshold: 0.50, maxRetries: 5 },
        executionSafety: { blockDestructiveActions: false },
        multiOutcomeHandling: { confidenceThreshold: 0.40, maxCandidates: 15 },
        auditReview: { retentionDays: 7, executionRetentionDays: 7 }
      }
    };

    const config = packConfigs[packId];
    const updatedPolicies = {
      locatorHealing: { ...policies.locatorHealing, ...config.locatorHealing },
      executionSafety: { ...policies.executionSafety, ...config.executionSafety },
      multiOutcomeHandling: { ...policies.multiOutcomeHandling, ...config.multiOutcomeHandling },
      auditReview: { ...policies.auditReview, ...config.auditReview }
    };
    
    setPolicies(updatedPolicies);
    savePolicyChanges(updatedPolicies);
  };

  return (
    <Container>
      <Header>
        <div>
          <Title> Policy Engine</Title>
          <Subtitle>Governance & Decision Layer for Prompt-Driven Self-Healing Framework</Subtitle>
          {error && (
            <ErrorMessage>
              ❌ {error}
            </ErrorMessage>
          )}
          {loading && <LoadingMessage>🔄 Loading policies from server...</LoadingMessage>}
        </div>
        <HeaderActions>
          {activeTab === 'policies' && hasUnsavedChanges && (
            <UnsavedChangesIndicator>
               Unsaved changes
            </UnsavedChangesIndicator>
          )}
          <SaveButton
            onClick={() => {
              savePolicyChanges();
            }}
            disabled={activeTab !== 'policies' || !hasUnsavedChanges || isSaving}
            $hasChanges={activeTab === 'policies' && hasUnsavedChanges}
            $isSaving={isSaving}
          >
            {isSaving ? '🔄 Saving...' : '💾 Save Changes'}
          </SaveButton>
        </HeaderActions>
      </Header>

      <MainContent>
        {/* Tab Navigation */}
        <TabContainer>
          <TabButton
            $isActive={activeTab === 'policies'}
            onClick={() => setActiveTab('policies')}
          >
            📋 Policies
          </TabButton>
          <TabButton
            $isActive={activeTab === 'ai-providers'}
            onClick={() => setActiveTab('ai-providers')}
          >
            🤖 AI Providers
          </TabButton>
        </TabContainer>

        {activeTab === 'policies' && (
          <>
            {/* Policy Pack Selector */}
            <PolicySection>
          <SectionTitle>Policy Packs</SectionTitle>
          <PolicyPackSelector>
            {policyPacks.map(pack => (
              <PolicyPackButton
                key={pack.id}
                $isActive={activePolicyPack === pack.id}
                onClick={() => applyPolicyPack(pack.id)}
              >
                {pack.name}
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.8 }}>
                  {pack.description}
                </div>
              </PolicyPackButton>
            ))}
          </PolicyPackSelector>
        </PolicySection>

        {/* Policy Categories Grid */}
        <PolicyGrid>
          {/* Locator Healing Policies */}
          <PolicyCard>
            <CardTitle>
               Locator Healing & Retry
            </CardTitle>
            
            <PolicyRule $isActive={policies.locatorHealing.active}>
              <RuleInfo>
                <RuleType $color="#3b82f6">HEALING</RuleType>
                <RuleDescription>Auto-heal locators when confidence score is high enough</RuleDescription>
                <ThresholdControl>
                  <span>Confidence Threshold:</span>
                  <ThresholdSlider
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={policies.locatorHealing.confidenceThreshold}
                    onChange={(e) => updateThreshold('locatorHealing', 'confidenceThreshold', parseFloat(e.target.value))}
                  />
                  <ThresholdValue>
                    {policies.locatorHealing.confidenceThreshold > 1 ? 
                      policies.locatorHealing.confidenceThreshold.toFixed(0) : 
                      (policies.locatorHealing.confidenceThreshold * 100).toFixed(0)
                    }%
                  </ThresholdValue>
                </ThresholdControl>
                <ThresholdControl>
                  <span>Max Retries:</span>
                  <ThresholdSlider
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={policies.locatorHealing.maxRetries}
                    onChange={(e) => updateThreshold('locatorHealing', 'maxRetries', parseInt(e.target.value))}
                  />
                  <ThresholdValue>{policies.locatorHealing.maxRetries}</ThresholdValue>
                </ThresholdControl>
              </RuleInfo>
              <PolicyToggle
                $isActive={policies.locatorHealing.active}
                onClick={() => togglePolicy('locatorHealing', 'active')}
              />
            </PolicyRule>

            <PolicyRule $isActive={policies.locatorHealing.preferCssOverXpath}>
              <RuleInfo>
                <RuleType $color="#1D9E75">PREFERENCE</RuleType>
                <RuleDescription>Prefer CSS selectors over XPath when both work</RuleDescription>
                <RuleAction>CSS &gt; XPath</RuleAction>
              </RuleInfo>
              <PolicyToggle
                $isActive={policies.locatorHealing.preferCssOverXpath}
                onClick={() => togglePolicy('locatorHealing', 'preferCssOverXpath')}
              />
            </PolicyRule>

            <PolicyRule $isActive={policies.locatorHealing.useRepositoryFallback}>
              <RuleInfo>
                <RuleType $color="#8b5cf6">FALLBACK</RuleType>
                <RuleDescription>Use element repository before heuristic search</RuleDescription>
                <RuleAction>Repository &rarr; Heuristic</RuleAction>
              </RuleInfo>
              <PolicyToggle
                $isActive={policies.locatorHealing.useRepositoryFallback}
                onClick={() => togglePolicy('locatorHealing', 'useRepositoryFallback')}
              />
            </PolicyRule>
          </PolicyCard>

          {/* Execution Safety Policies */}
          <PolicyCard>
            <CardTitle>
              🛡️ Execution Safety & Validation
            </CardTitle>
            
            <PolicyRule $isActive={policies.executionSafety.blockDestructiveActions}>
              <RuleInfo>
                <RuleType $color="#A32D2D">SECURITY</RuleType>
                <RuleDescription>Block destructive actions unless explicitly allowed</RuleDescription>
                <RuleAction>Block: delete, remove, submit payment</RuleAction>
              </RuleInfo>
              <PolicyToggle
                $isActive={policies.executionSafety.blockDestructiveActions}
                onClick={() => togglePolicy('executionSafety', 'blockDestructiveActions')}
              />
            </PolicyRule>

            <PolicyRule $isActive={policies.executionSafety.allowTestModeOverride}>
              <RuleInfo>
                <RuleType $color="#f59e0b">OVERRIDE</RuleType>
                <RuleDescription>Allow test mode to override safety restrictions</RuleDescription>
                <RuleAction>Test Mode Bypass Enabled</RuleAction>
              </RuleInfo>
              <PolicyToggle
                $isActive={policies.executionSafety.allowTestModeOverride}
                onClick={() => togglePolicy('executionSafety', 'allowTestModeOverride')}
              />
            </PolicyRule>

            <div style={{ padding: '16px 0' }}>
              <BrowserMultiSelect
                value={policies.executionSafety.preferredBrowsers || ['chrome']}
                onChange={(browsers) => {
                  setPolicies(prev => ({
                    ...prev,
                    executionSafety: {
                      ...prev.executionSafety,
                      preferredBrowsers: browsers
                    }
                  }));
                }}
              />
            </div>
          </PolicyCard>

          {/* Multi-Outcome Handling */}
          <PolicyCard>
            <CardTitle>
               Multi-Outcome Handling
            </CardTitle>
            
            <PolicyRule $isActive={policies.multiOutcomeHandling.preferVisibleElements}>
              <RuleInfo>
                <RuleType $color="#06b6d4">RANKING</RuleType>
                <RuleDescription>Prefer visible, interactable elements over hidden ones</RuleDescription>
                <ThresholdControl>
                  <span>Min Confidence:</span>
                  <ThresholdSlider
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={policies.multiOutcomeHandling.confidenceThreshold}
                    onChange={(e) => updateThreshold('multiOutcomeHandling', 'confidenceThreshold', parseFloat(e.target.value))}
                  />
                  <ThresholdValue>
                    {policies.multiOutcomeHandling.confidenceThreshold > 1 ? 
                      policies.multiOutcomeHandling.confidenceThreshold.toFixed(0) : 
                      (policies.multiOutcomeHandling.confidenceThreshold * 100).toFixed(0)
                    }%
                  </ThresholdValue>
                </ThresholdControl>
                <ThresholdControl>
                  <span>Max Candidates:</span>
                  <ThresholdSlider
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={policies.multiOutcomeHandling.maxCandidates}
                    onChange={(e) => updateThreshold('multiOutcomeHandling', 'maxCandidates', parseInt(e.target.value))}
                  />
                  <ThresholdValue>{policies.multiOutcomeHandling.maxCandidates}</ThresholdValue>
                </ThresholdControl>
              </RuleInfo>
              <PolicyToggle
                $isActive={policies.multiOutcomeHandling.active}
                onClick={() => togglePolicy('multiOutcomeHandling', 'active')}
              />
            </PolicyRule>
          </PolicyCard>

          {/* Audit & Review Integration */}
          <PolicyCard>
            <CardTitle>
               Audit & Review Integration
            </CardTitle>
            
            <PolicyRule $isActive={policies.auditReview.logAllDecisions}>
              <RuleInfo>
                <RuleType $color="#6b7280">AUDIT</RuleType>
                <RuleDescription>Log all policy decisions for transparency</RuleDescription>
                <ThresholdControl>
                  <span>Retention Days:</span>
                  <ThresholdSlider
                    type="range"
                    min="30"
                    max="360"
                    step="30"
                    value={policies.auditReview.retentionDays}
                    onChange={(e) => updateThreshold('auditReview', 'retentionDays', parseInt(e.target.value))}
                  />
                  <ThresholdValue>{policies.auditReview.retentionDays} days</ThresholdValue>
                </ThresholdControl>
                <ThresholdControl>
                  <span>Execution History:</span>
                  <ThresholdSlider
                    type="range"
                    min="30"
                    max="360"
                    step="30"
                    value={policies.auditReview.executionRetentionDays}
                    onChange={(e) => updateThreshold('auditReview', 'executionRetentionDays', parseInt(e.target.value))}
                  />
                  <ThresholdValue>{policies.auditReview.executionRetentionDays} days</ThresholdValue>
                </ThresholdControl>
              </RuleInfo>
              <PolicyToggle
                $isActive={policies.auditReview.active}
                onClick={() => togglePolicy('auditReview', 'active')}
              />
            </PolicyRule>

            <PolicyRule $isActive={policies.auditReview.escalateUnknownElements}>
              <RuleInfo>
                <RuleType $color="#ec4899">ESCALATION</RuleType>
                <RuleDescription>Escalate unknown elements to review queue</RuleDescription>
                <RuleAction>Unknown &rarr; Review Queue</RuleAction>
              </RuleInfo>
              <PolicyToggle
                $isActive={policies.auditReview.escalateUnknownElements}
                onClick={() => togglePolicy('auditReview', 'escalateUnknownElements')}
              />
            </PolicyRule>
          </PolicyCard>
        </PolicyGrid>

        {/* Audit Log */}
        <PolicySection>
          <SectionTitle>Recent Policy Decisions</SectionTitle>
          <AuditLog>
            {auditLogs.map((log, index) => (
              <LogEntry key={index}>
                <LogTimestamp>{log.timestamp}</LogTimestamp>
                <LogAction>{log.action}</LogAction>
                {log.decision}
                {log.element && <span style={{ color: '#6b7280' }}> &rarr; {log.element}</span>}
              </LogEntry>
            ))}
          </AuditLog>
        </PolicySection>
          </>
        )}

        {activeTab === 'ai-providers' && (
          <PolicySection>
            <SectionTitle>🤖 AI Provider Configuration</SectionTitle>
            <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e5e7eb' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#4b5563' }}>
                Choose which AI providers to use for your tests. You can use included providers at no extra cost or bring your own keys (BYOK) to reduce platform fees.
              </p>
            </div>

            {/* Provider List with Enable/Disable Toggles */}
            <div style={{ display: 'grid', gap: '12px' }}>
              {['openai', 'anthropic', 'google', 'ollama', 'azure'].map((provider) => {
                const providerConfig = aiProviders.find(p => p.provider === provider);
                const hasSystemKey = !providerConfig?.is_byok;
                return (
                  <div key={provider} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    background: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <h4 style={{ margin: '0', fontSize: '1rem', fontWeight: '600', color: '#1f2937', textTransform: 'capitalize' }}>
                          {provider.toUpperCase()}
                        </h4>
                        {provider === 'ollama' && (
                          <span style={{ fontSize: '0.75rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}>
                            LOCAL
                          </span>
                        )}
                        {hasSystemKey ? (
                          <span style={{ fontSize: '0.75rem', background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}>
                            INCLUDED
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', background: '#fce7f3', color: '#be185d', padding: '2px 8px', borderRadius: '4px', fontWeight: '500' }}>
                            BYOK
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '0', fontSize: '0.9rem', color: '#6b7280' }}>
                        {provider === 'ollama' && 'Run AI inference locally on your machine. No API key required.'}
                        {provider === 'openai' && 'Use OpenAI GPT models for element gathering and decision-making.'}
                        {provider === 'anthropic' && 'Use Anthropic Claude models for intelligent test automation.'}
                        {provider === 'google' && 'Use Google Gemini and PaLM models for AI-powered testing.'}
                        {provider === 'azure' && 'Use Azure OpenAI for enterprise AI deployments.'}
                      </p>
                      {hasSystemKey && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#059669', fontStyle: 'italic' }}>
                          ✓ Included in your plan at no extra cost.
                        </p>
                      )}
                    </div>

                    {/* Toggle Button - Radio-style selection */}
                    <div style={{ marginLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      <button
                        onClick={() => handleToggleProvider(provider)}
                        style={{
                          padding: '8px 16px',
                          border: providerConfig?.enabled ? '2px solid #0ea5e9' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          background: providerConfig?.enabled ? '#0ea5e9' : '#f3f4f6',
                          color: providerConfig?.enabled ? '#fff' : '#6b7280',
                          transition: 'all 0.2s'
                        }}
                      >
                        {providerConfig?.enabled ? '✓ Selected' : 'Select'}
                      </button>
                      {hasSystemKey && (
                        <span style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: '500' }}>Included</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Save Provider Settings Button */}
            {hasUnsavedProviderChanges && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    // Reset to last known good state by reloading from API
                    setHasUnsavedProviderChanges(false);
                    // Reload page to get fresh provider list from backend
                    window.location.reload();
                  }}
                  disabled={isSaving}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: '#f3f4f6',
                    color: '#374151',
                    fontWeight: '600',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProviderSettings}
                  disabled={isSaving}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#3b82f6',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.6 : 1
                  }}
                >
                  {isSaving ? 'Saving...' : '✓ Save Provider Settings'}
                </button>
              </div>
            )}

            {ollamaProviderEnabled && (
              <div style={{ marginTop: '20px', padding: '16px', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#1e3a8a' }}>Ollama Local Connector Required</h4>
                <p style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: '#1f2937' }}>
                  Ollama runs locally. Download the tenant-scoped connector package to register over WebSocket and bind to the correct tenant before using Ollama.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      if (!ollamaDownloadUrl) return;
                      window.open(ollamaDownloadUrl, '_blank');
                    }}
                    disabled={!tenant?.id}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: tenant?.id ? 'pointer' : 'not-allowed',
                      background: tenant?.id ? '#2563eb' : '#9ca3af',
                      color: '#fff',
                      fontWeight: 600
                    }}
                  >
                    Download Ollama Connector
                  </button>
                  <a
                    href={`${config.apiBaseUrl}/api/v1/runners/download`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      background: '#1d4ed8',
                      color: '#fff',
                      textDecoration: 'none',
                      fontWeight: 600
                    }}
                  >
                    Download Java Runner
                  </a>
                </div>
                {!tenant?.id && (
                  <p style={{ margin: '10px 0 0 0', color: '#b91c1c', fontSize: '0.85rem' }}>
                    Tenant not detected in session. Re-authenticate to generate a tenant-bound connector package.
                  </p>
                )}
              </div>
            )}

            {/* Editable Configuration for BYOK Providers */}
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1f2937', fontWeight: '600' }}>
                ⚙️ Advanced Configuration (BYOK Only)
              </h3>
              
              {aiProviders.filter(p => p.is_byok && p.enabled).length > 0 ? (
                <div style={{ display: 'grid', gap: '20px' }}>
                  {aiProviders.filter(p => p.is_byok && p.enabled).map((provider) => (
                    <div key={provider.provider} style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '20px',
                      background: '#fafbfc'
                    }}>
                      <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '600', color: '#1f2937', textTransform: 'capitalize' }}>
                        {provider.provider === 'custom' ? 'Custom Endpoint' : provider.provider.toUpperCase()} Configuration
                      </h4>

                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                            {provider.provider === 'ollama' ? 'Model (e.g., llama2)' : 'API Base URL'}
                          </label>
                          <input
                            type="text"
                            value={provider.api_base || ''}
                            placeholder={provider.provider === 'ollama' ? 'llama2' : 'https://api.example.com'}
                            onChange={(e) => {
                              const updated = aiProviders.map(p =>
                                p.provider === provider.provider ? { ...p, api_base: e.target.value } : p
                              );
                              setAiProviders(updated);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '0.95rem',
                              fontFamily: 'monospace',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        {provider.provider !== 'ollama' && (
                          <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                              API Key (encrypted at rest)
                            </label>
                            <input
                              type="password"
                              value={provider.api_key}
                              placeholder="your-api-key-here"
                              onChange={(e) => {
                                const updated = aiProviders.map(p =>
                                  p.provider === provider.provider ? { ...p, api_key: e.target.value } : p
                                );
                                setAiProviders(updated);
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '0.95rem',
                                fontFamily: 'monospace',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        )}

                        {provider.provider === 'ollama' && (
                          <div style={{ padding: '12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', color: '#92400e', fontSize: '0.9rem' }}>
                            ℹ️ Ollama runs locally on your machine. No API key required.
                          </div>
                        )}

                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                            Model Name
                          </label>
                          <input
                            type="text"
                            value={provider.model}
                            placeholder={provider.provider === 'openai' ? 'gpt-4-turbo' : 'claude-3-sonnet'}
                            onChange={(e) => {
                              const updated = aiProviders.map(p =>
                                p.provider === provider.provider ? { ...p, model: e.target.value } : p
                              );
                              setAiProviders(updated);
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '0.95rem',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                              Temperature (0.0 - 1.0)
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={provider.temperature}
                              onChange={(e) => {
                                const updated = aiProviders.map(p =>
                                  p.provider === provider.provider ? { ...p, temperature: parseFloat(e.target.value) } : p
                                );
                                setAiProviders(updated);
                              }}
                              style={{ width: '100%' }}
                            />
                            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>Value: {provider.temperature.toFixed(1)}</span>
                          </div>

                          <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                              Max Tokens
                            </label>
                            <input
                              type="number"
                              value={provider.max_tokens}
                              onChange={(e) => {
                                const updated = aiProviders.map(p =>
                                  p.provider === provider.provider ? { ...p, max_tokens: parseInt(e.target.value) } : p
                                );
                                setAiProviders(updated);
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '0.95rem',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                              Timeout (ms)
                            </label>
                            <input
                              type="number"
                              value={provider.timeout_ms}
                              onChange={(e) => {
                                const updated = aiProviders.map(p =>
                                  p.provider === provider.provider ? { ...p, timeout_ms: parseInt(e.target.value) } : p
                                );
                                setAiProviders(updated);
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '0.95rem',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', color: '#374151' }}>
                              Max Retries
                            </label>
                            <input
                              type="number"
                              value={provider.max_retries}
                              min="1"
                              max="10"
                              onChange={(e) => {
                                const updated = aiProviders.map(p =>
                                  p.provider === provider.provider ? { ...p, max_retries: parseInt(e.target.value) } : p
                                );
                                setAiProviders(updated);
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '0.95rem',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        </div>

                        <button
                          style={{
                            padding: '10px 20px',
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '0.95rem'
                          }}
                        >
                          ✅ Save Configuration
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px', background: '#f3f4f6', borderRadius: '8px', color: '#4b5563', textAlign: 'center' }}>
                  <p style={{ margin: '0', fontSize: '0.95rem' }}>
                    No BYOK providers enabled. Enable a BYOK provider above to configure advanced settings.
                  </p>
                </div>
              )}
            </div>

            {/* System Providers Info */}
            {aiProviders.filter(p => !p.is_byok && p.enabled).length > 0 && (
              <div style={{ marginTop: '32px', padding: '16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>✓ Using Included AI Providers</p>
                <p style={{ margin: '0', fontSize: '0.9rem' }}>
                  The following providers are included in your plan at no additional cost:
                </p>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {aiProviders.filter(p => !p.is_byok && p.enabled).map(p => (
                    <span key={p.provider} style={{ fontSize: '0.9rem', background: '#d1fae5', padding: '4px 12px', borderRadius: '6px', fontWeight: '500', textTransform: 'uppercase' }}>
                      {p.provider}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </PolicySection>
        )}
      </MainContent>
    </Container>
  );
};

export default PolicyEngine;