import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { http } from '../../../shared/api';

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

// ================================
// Styled Components
// ================================

const Container = styled.div`
  min-height: 100vh;
  background: #f8f9fa;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
`;

const PolicyGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
`;

const PolicyCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
`;

const CardTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PolicySection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  margin: 0 0 1.5rem 0;
  color: #1f2937;
  font-size: 1.5rem;
  font-weight: 600;
  border-bottom: 2px solid #f3f4f6;
  padding-bottom: 0.5rem;
`;

const PolicyRule = styled.div<PolicyRuleProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  background: ${props => props.$isActive ? '#f0f9ff' : '#f9fafb'};
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
  color: #6b7280;
  font-size: 0.9rem;
`;

const RuleAction = styled.span`
  color: #059669;
  font-weight: 600;
  font-size: 0.9rem;
`;

const PolicyToggle = styled.div<{ $isActive: boolean }>`
  position: relative;
  width: 60px;
  height: 32px;
  background: ${props => props.$isActive ? '#10b981' : '#d1d5db'};
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
  color: #1f2937;
  min-width: 60px;
`;

const PolicyPackSelector = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
`;

const PolicyPackButton = styled.button<{ $isActive: boolean }>`
  padding: 0.75rem 1.5rem;
  border: 2px solid ${props => props.$isActive ? '#3b82f6' : '#e5e7eb'};
  background: ${props => props.$isActive ? '#3b82f6' : 'white'};
  color: ${props => props.$isActive ? 'white' : '#6b7280'};
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #3b82f6;
    background: ${props => props.$isActive ? '#2563eb' : '#f3f4f6'};
  }
`;

const AuditLog = styled.div`
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
`;

const LogEntry = styled.div`
  padding: 0.5rem;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.875rem;
  
  &:last-child {
    border-bottom: none;
  }
`;

const LogTimestamp = styled.span`
  color: #6b7280;
  font-weight: 600;
`;

const LogAction = styled.span`
  color: #059669;
  font-weight: 600;
  margin: 0 0.5rem;
`;

// ================================
// Policy Engine Component  
// ================================

const PolicyEngine: React.FC = () => {
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
      allowTestModeOverride: true,
      active: true
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
      active: true
    }
  });
  
  const [auditLogs, setAuditLogs] = useState<Array<{timestamp: string, action: string, decision: string, element: string}>>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
        auditReview: { retentionDays: 90 }
      },
      balanced: {
        locatorHealing: { confidenceThreshold: 0.85, maxRetries: 2 },
        executionSafety: { blockDestructiveActions: true },
        multiOutcomeHandling: { confidenceThreshold: 0.75, maxCandidates: 8 },
        auditReview: { retentionDays: 60 }
      },
      lenient: {
        locatorHealing: { confidenceThreshold: 0.70, maxRetries: 3 },
        executionSafety: { blockDestructiveActions: false },
        multiOutcomeHandling: { confidenceThreshold: 0.60, maxCandidates: 10 },
        auditReview: { retentionDays: 30 }
      },
      dev: {
        locatorHealing: { confidenceThreshold: 0.50, maxRetries: 5 },
        executionSafety: { blockDestructiveActions: false },
        multiOutcomeHandling: { confidenceThreshold: 0.40, maxCandidates: 15 },
        auditReview: { retentionDays: 7 }
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
          {error && <div style={{color: '#ef4444', marginTop: '8px', fontSize: '14px'}}> {error}</div>}
          {loading && <div style={{color: '#6b7280', marginTop: '8px', fontSize: '14px'}}>🔄 Loading policies from server...</div>}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {hasUnsavedChanges && (
            <span style={{ color: '#f59e0b', fontSize: '14px', fontWeight: 500 }}>
               Unsaved changes
            </span>
          )}
          <button
            onClick={() => savePolicyChanges()}
            disabled={!hasUnsavedChanges || isSaving}
            style={{
              backgroundColor: hasUnsavedChanges ? '#10b981' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isSaving ? ' Saving...' : ' Save Changes'}
          </button>
        </div>
      </Header>

      <MainContent>
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
                <RuleType $color="#10b981">PREFERENCE</RuleType>
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
                <RuleType $color="#ef4444">SECURITY</RuleType>
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
                    min="7"
                    max="365"
                    step="1"
                    value={policies.auditReview.retentionDays}
                    onChange={(e) => updateThreshold('auditReview', 'retentionDays', parseInt(e.target.value))}
                  />
                  <ThresholdValue>{policies.auditReview.retentionDays} days</ThresholdValue>
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
      </MainContent>
    </Container>
  );
};

export default PolicyEngine;