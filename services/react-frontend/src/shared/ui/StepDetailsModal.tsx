import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { X, Image, Terminal, Zap, Loader } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { config } from '../../app/config';

const spin = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

const LoadingSpinner = styled(Loader)`
  animation: ${spin} 1s linear infinite;
`;
interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  duration_ms: number;
  size_bytes?: number;
}
interface HealingAttempt {
  timestamp: string;
  strategy: string;
  description: string;
  success: boolean;
}

interface AIRecommendation {
  icon: string;
  title: string;
  description: string;
  confidence: number;
}

interface ExecutionStep {
  step_number: number;
  step_description: string;
  result: 'PASS' | 'FAIL';
  details?: string;
  duration_ms?: number;
  screenshot?: string;
  console_logs?: string[];
  network_requests?: NetworkRequest[];
  healing_attempts?: HealingAttempt[];
  action?: string;
  locator?: string;
  error?: string;
  step_id?: string;
}
interface StepDetailsModalProps {
  step: ExecutionStep;
  isOpen: boolean;
  onClose: () => void;
}
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;
const ModalContent = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;
const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  background: linear-gradient(135deg, ${props => props.theme.colors.primary} 0%, ${props => props.theme.colors.secondary} 100%);
  color: white;
  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
  }
`;
const CloseButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background 0.2s ease;
  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;
const ModalBody = styled.div`
  padding: 0;
  max-height: calc(90vh - 80px);
  overflow-y: auto;
`;
const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface};
  overflow-x: auto;
`;
const Tab = styled.button<{ $active: boolean }>`
  background: none;
  border: none;
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.textSecondary};
  border-bottom: 3px solid ${props => props.$active ? props.theme.colors.primary : 'transparent'};
  white-space: nowrap;
  &:hover {
    background: rgba(102, 126, 234, 0.1);
    color: ${props => props.theme.colors.primary};
  }
`;
const TabContent = styled.div`
  padding: 32px;
  min-height: 400px;
`;
const ScreenshotContainer = styled.div`
  text-align: center;
  img {
    max-width: 100%;
    max-height: 600px;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    border: 1px solid ${props => props.theme.colors.border};
  }
  .screenshot-placeholder {
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    border: 2px dashed ${props => props.theme.colors.border};
    border-radius: 8px;
    padding: 60px;
    color: ${props => props.theme.colors.textSecondary};
    font-size: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    svg {
      opacity: 0.5;
    }
  }
`;
const LogContainer = styled.div`
  background: #1a1a1a;
  color: #ffffff;
  padding: 20px;
  border-radius: 8px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.4;
  max-height: 500px;
  overflow-y: auto;
  .log-entry {
    margin-bottom: 8px;
    padding: 4px 0;
    &.error {
      color: #ff6b6b;
    }
    &.warn {
      color: #ffd93d;
    }
    &.info {
      color: #74c0fc;
    }
    &.debug {
      color: #9c88ff;
    }
  }
  .no-logs {
    color: #888;
    font-style: italic;
    text-align: center;
    padding: 40px;
  }
`;
const NetworkTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
  th, td {
    text-align: left;
    padding: 12px 16px;
    border-bottom: 1px solid ${props => props.theme.colors.border};
  }
  th {
    background: ${props => props.theme.colors.surface};
    font-weight: 700;
    color: ${props => props.theme.colors.text};
    position: sticky;
    top: 0;
    font-size: 14px;
  }
  tr:hover {
    background: rgba(102, 126, 234, 0.05);
  }
  .method {
    font-family: monospace;
    font-weight: 700;
    font-size: 12px;
  }
  .url {
    font-family: monospace;
    font-size: 13px;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .duration {
    font-family: monospace;
    color: ${props => props.theme.colors.textSecondary};
  }
  .size {
    font-family: monospace;
    color: ${props => props.theme.colors.textSecondary};
  }
`;
const StatusCode = styled.span<{ status: number }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  color: white;
  background: ${props => {
    if (props.status >= 200 && props.status < 300) return '#1D9E75';
    if (props.status >= 300 && props.status < 400) return '#ed8936';
    return '#A32D2D';
  }};
`;
const HealingAttemptCard = styled.div<{ success: boolean }>`
  background: ${props => props.success ? 'rgba(56, 161, 105, 0.1)' : 'rgba(229, 62, 62, 0.1)'};
  border-left: 4px solid ${props => props.success ? '#1D9E75' : '#A32D2D'};
  padding: 20px;
  margin-bottom: 16px;
  border-radius: 8px;
  .strategy {
    font-weight: 700;
    color: ${props => props.theme.colors.text};
    margin-bottom: 8px;
    font-size: 16px;
  }
  .description {
    color: ${props => props.theme.colors.textSecondary};
    margin-bottom: 12px;
    line-height: 1.5;
  }
  .timestamp {
    font-size: 12px;
    color: ${props => props.theme.colors.textSecondary};
    font-family: monospace;
  }
  .success-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: ${props => props.success ? '#1D9E75' : '#A32D2D'};
    color: white;
    margin-bottom: 8px;
  }
`;
const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: ${props => props.theme.colors.textSecondary};
  svg {
    opacity: 0.3;
    margin-bottom: 16px;
  }
  h4 {
    margin: 0 0 8px 0;
    color: ${props => props.theme.colors.text};
  }
  p {
    margin: 0;
    font-size: 14px;
  }
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const InfoLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${props => props.theme.colors.textSecondary};
`;

const InfoValue = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  word-break: break-word;
`;

const RecommendationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
`;

const RecommendationCard = styled.div`
  display: flex;
  gap: 16px;
  padding: 20px;
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
  
  .recommendation-icon {
    font-size: 32px;
    line-height: 1;
  }
  
  .recommendation-content {
    flex: 1;
  }
  
  .recommendation-title {
    font-weight: 700;
    font-size: 16px;
    color: ${props => props.theme.colors.text};
    margin-bottom: 8px;
  }
  
  .recommendation-text {
    font-size: 14px;
    color: ${props => props.theme.colors.textSecondary};
    line-height: 1.6;
  }
`;

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};
const StepDetailsModal: React.FC<StepDetailsModalProps> = ({ step, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('details');
  const { theme } = useTheme();
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [recommendationsFetched, setRecommendationsFetched] = useState(false);

  // Fetch AI recommendations when recommendations tab is viewed for failed steps
  useEffect(() => {
    if (isOpen && activeTab === 'recommendations' && step.result === 'FAIL' && !recommendationsFetched) {
      console.log('Fetching AI recommendations for step:', step.step_id);
      fetchAIRecommendations();
    }
  }, [isOpen, activeTab, step.step_id, step.result, recommendationsFetched]);

  const fetchAIRecommendations = async () => {
    try {
      setRecommendationsLoading(true);
      setRecommendationsFetched(true);
      
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };

      console.log('Calling recommendations API with:', {
        step_id: step.step_id,
        action: step.action || step.step_description,
        locator: step.locator,
        has_screenshot: !!step.screenshot
      });

      const response = await fetch(
        `${config.apiBaseUrl}/api/v1/recommendations`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            step_id: step.step_id,
            action: step.action || step.step_description,
            locator: step.locator,
            error_message: step.error || step.details,
            screenshot_path: step.screenshot,
            healing_attempts: step.healing_attempts?.map(ha => ({
              originalLocator: step.locator,
              attemptedAlternatives: [ha.description],
              result: ha.success ? 'success' : 'failed'
            }))
          })
        }
      );

      console.log('Recommendations API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Recommendations API error:', errorText);
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Recommendations received:', data);
      setRecommendations(data.recommendations || []);
      setAnalysisText(data.analysis || '');
    } catch (error) {
      console.error('Error fetching AI recommendations:', error);
      // Set fallback recommendations
      setRecommendations([
        {
          icon: '💡',
          title: 'Verify Element Selector',
          description: 'The selector may have changed. Try using a more stable selector like data-testid or aria-label.',
          confidence: 0.7
        },
        {
          icon: '⏱️',
          title: 'Add Wait Condition',
          description: 'Element might not be ready. Consider adding an explicit wait for the element to be visible or clickable.',
          confidence: 0.65
        },
        {
          icon: '🔄',
          title: 'Check Page State',
          description: 'Ensure the page is fully loaded and any animations or transitions have completed before interacting.',
          confidence: 0.6
        }
      ]);
      setAnalysisText('Unable to perform AI analysis. Showing generic recommendations.');
    } finally {
      setRecommendationsLoading(false);
    }
  };
  if (!isOpen) return null;
  const tabs = [
    { id: 'details', label: 'Step Details', icon: X },
    { id: 'screenshot', label: 'Screenshot', icon: Image },
    { id: 'healing', label: 'AI Healing', icon: Zap },
    { id: 'recommendations', label: 'AI Recommendations', icon: Terminal }
  ];
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  return (
    <ModalOverlay onClick={handleOverlayClick}>
      <ModalContent>
        <ModalHeader>
          <h3>Step {step.step_number}: {step.step_description}</h3>
          <CloseButton onClick={onClose}>
            <X size={24} />
          </CloseButton>
        </ModalHeader>
        <TabContainer>
          {tabs.map(tab => (
            <Tab
              key={tab.id}
              $active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} />
              {tab.label}
            </Tab>
          ))}
        </TabContainer>
        <ModalBody>
          <TabContent>
            {activeTab === 'details' && (
              <div>
                <h4 style={{ color: step.result === 'FAIL' ? theme.colors.error : theme.colors.success, marginTop: 0 }}>
                  {step.result === 'FAIL' ? 'Failure Information' : 'Step Details'}
                </h4>
                <InfoGrid>
                  <InfoItem>
                    <InfoLabel>Step Number</InfoLabel>
                    <InfoValue>#{step.step_number}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Action</InfoLabel>
                    <InfoValue>{step.step_description}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Status</InfoLabel>
                    <InfoValue style={{ color: step.result === 'PASS' ? theme.colors.success : theme.colors.error }}>
                      {step.result}
                    </InfoValue>
                  </InfoItem>
                  {step.duration_ms && (
                    <InfoItem>
                      <InfoLabel>Duration</InfoLabel>
                      <InfoValue>{formatDuration(step.duration_ms)}</InfoValue>
                    </InfoItem>
                  )}
                </InfoGrid>
                {step.details ? (
                  <div style={{ marginTop: '24px' }}>
                    <InfoLabel style={{ marginBottom: '8px', display: 'block' }}>Error Details</InfoLabel>
                    <LogContainer>
                      <div className="log-entry error">{step.details}</div>
                    </LogContainer>
                  </div>
                ) : step.result === 'FAIL' ? (
                  <EmptyState>
                    <X size={48} />
                    <h4>No error details captured</h4>
                    <p>The step failed but no error message was recorded</p>
                  </EmptyState>
                ) : null}
              </div>
            )}
            {activeTab === 'screenshot' && (
              <ScreenshotContainer>
                {step.screenshot ? (
                  <img 
                    src={step.screenshot} 
                    alt={`Screenshot for step ${step.step_number}`}
                  />
                ) : (
                  <div className="screenshot-placeholder">
                    <Image size={48} />
                    <div>No screenshot available for this step</div>
                  </div>
                )}
              </ScreenshotContainer>
            )}
            {activeTab === 'recommendations' && (
              <div>
                <h4 style={{ marginTop: 0 }}>AI Recommendations</h4>
                {step.result === 'FAIL' ? (
                  <>
                    {analysisText && (
                      <div style={{ 
                        background: 'rgba(102, 126, 234, 0.1)',
                        padding: '16px',
                        borderRadius: '8px',
                        marginBottom: '24px',
                        borderLeft: '4px solid #185FA5'
                      }}>
                        <strong style={{ display: 'block', marginBottom: '8px' }}>AI Analysis:</strong>
                        <p style={{ margin: 0, lineHeight: '1.6' }}>{analysisText}</p>
                      </div>
                    )}
                    {recommendationsLoading ? (
                      <div style={{ textAlign: 'center', padding: '60px' }}>
                        <LoadingSpinner size={48} />
                        <p style={{ marginTop: '16px', color: theme.colors.textSecondary }}>
                          Analyzing failure with AI...
                        </p>
                      </div>
                    ) : (
                      <RecommendationsList>
                        {recommendations.map((rec, idx) => (
                          <RecommendationCard key={idx}>
                            <div className="recommendation-icon">{rec.icon}</div>
                            <div className="recommendation-content">
                              <div className="recommendation-title">
                                {rec.title}
                                {rec.confidence && (
                                  <span style={{
                                    marginLeft: '12px',
                                    fontSize: '12px',
                                    color: theme.colors.textSecondary,
                                    fontWeight: 'normal'
                                  }}>
                                    {Math.round(rec.confidence * 100)}% confidence
                                  </span>
                                )}
                              </div>
                              <div className="recommendation-text">
                                {rec.description}
                              </div>
                            </div>
                          </RecommendationCard>
                        ))}
                      </RecommendationsList>
                    )}
                  </>
                ) : (
                  <EmptyState>
                    <Terminal size={48} />
                    <h4>No recommendations needed</h4>
                    <p>This step executed successfully</p>
                  </EmptyState>
                )}
              </div>
            )}
            {activeTab === 'healing' && (
              <div>
                <h4 style={{ marginTop: 0 }}>AI Healing Attempts</h4>
                {step.healing_attempts && step.healing_attempts.length > 0 ? (
                  step.healing_attempts.map((attempt: any, index: number) => (
                    <HealingAttemptCard key={index} success={attempt.success}>
                      <div className="success-badge">
                        {attempt.success ? '✓ Success' : '✗ Failed'}
                      </div>
                      <div className="strategy">
                        {attempt.strategy}
                        {attempt.candidate_score && (
                          <span style={{ marginLeft: '12px', fontSize: '14px', opacity: 0.8 }}>
                            (Score: {(attempt.candidate_score * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                      <div className="description">{attempt.description}</div>
                      {attempt.decision_type && (
                        <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.8 }}>
                          Decision Type: {attempt.decision_type}
                        </div>
                      )}
                      {attempt.original_selector && (
                        <div style={{ marginTop: '12px' }}>
                          <InfoLabel>Original Selector</InfoLabel>
                          <LogContainer style={{ marginTop: '8px', padding: '12px', fontSize: '12px' }}>
                            <code>{JSON.stringify(attempt.original_selector, null, 2)}</code>
                          </LogContainer>
                        </div>
                      )}
                      {attempt.healed_selector ? (
                        <div style={{ marginTop: '12px' }}>
                          <InfoLabel style={{ color: attempt.success ? '#1D9E75' : '#A32D2D' }}>
                            {attempt.success ? 'Healed Selector' : 'Attempted Selector (Failed)'}
                          </InfoLabel>
                          <LogContainer style={{ marginTop: '8px', padding: '12px', fontSize: '12px' }}>
                            <code>{JSON.stringify(attempt.healed_selector, null, 2)}</code>
                          </LogContainer>
                        </div>
                      ) : (
                        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(229, 62, 62, 0.1)', borderRadius: '8px' }}>
                          <InfoLabel style={{ color: '#A32D2D', marginBottom: '4px' }}>No Candidate Found</InfoLabel>
                          <div style={{ fontSize: '13px', color: '#666' }}>
                            The healing system could not find a suitable replacement selector
                          </div>
                        </div>
                      )}
                      <div className="timestamp">{new Date(attempt.timestamp).toLocaleString()}</div>
                    </HealingAttemptCard>
                  ))
                ) : (
                  <EmptyState>
                    <Zap size={48} />
                    <h4>No healing attempts</h4>
                    <p>This step did not require any AI healing interventions</p>
                  </EmptyState>
                )}
              </div>
            )}
          </TabContent>
        </ModalBody>
      </ModalContent>
    </ModalOverlay>
  );
};
export default StepDetailsModal;