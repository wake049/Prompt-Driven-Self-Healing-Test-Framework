import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Image, Terminal, Network, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
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
const Tab = styled.button<{ active: boolean }>`
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
  color: ${props => props.active ? props.theme.colors.primary : props.theme.colors.textSecondary};
  border-bottom: 3px solid ${props => props.active ? props.theme.colors.primary : 'transparent'};
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
    if (props.status >= 200 && props.status < 300) return '#38a169';
    if (props.status >= 300 && props.status < 400) return '#ed8936';
    return '#e53e3e';
  }};
`;
const HealingAttemptCard = styled.div<{ success: boolean }>`
  background: ${props => props.success ? 'rgba(56, 161, 105, 0.1)' : 'rgba(229, 62, 62, 0.1)'};
  border-left: 4px solid ${props => props.success ? '#38a169' : '#e53e3e'};
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
    background: ${props => props.success ? '#38a169' : '#e53e3e'};
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
  const [activeTab, setActiveTab] = useState('failure');
  const { theme } = useTheme();
  if (!isOpen) return null;
  const tabs = [
    { id: 'failure', label: 'Failure Details', icon: X },
    { id: 'screenshot', label: 'Screenshot', icon: Image },
    { id: 'console', label: 'Console Logs', icon: Terminal },
    { id: 'network', label: 'Network', icon: Network },
    { id: 'healing', label: 'AI Healing', icon: Zap }
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
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={16} />
              {tab.label}
            </Tab>
          ))}
        </TabContainer>
        <ModalBody>
          <TabContent>
            {activeTab === 'failure' && (
              <div>
                <h4 style={{ color: theme.colors.error, marginTop: 0 }}>Failure Information</h4>
                {step.details ? (
                  <LogContainer>
                    <div className="log-entry error">{step.details}</div>
                  </LogContainer>
                ) : (
                  <EmptyState>
                    <X size={48} />
                    <h4>No failure details available</h4>
                    <p>This step completed successfully</p>
                  </EmptyState>
                )}
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
            {activeTab === 'console' && (
              <div>
                <h4 style={{ marginTop: 0 }}>Console Output</h4>
                <LogContainer>
                  {step.console_logs && step.console_logs.length > 0 ? (
                    step.console_logs.map((log: string, index: number) => (
                      <div 
                        key={index} 
                        className={`log-entry ${
                          log.includes('ERROR') ? 'error' : 
                          log.includes('WARN') ? 'warn' : 
                          log.includes('INFO') ? 'info' : 'debug'
                        }`}
                      >
                        {log}
                      </div>
                    ))
                  ) : (
                    <div className="no-logs">No console logs captured</div>
                  )}
                </LogContainer>
              </div>
            )}
            {activeTab === 'network' && (
              <div>
                <h4 style={{ marginTop: 0 }}>Network Requests</h4>
                {step.network_requests && step.network_requests.length > 0 ? (
                  <NetworkTable>
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th>URL</th>
                        <th>Status</th>
                        <th>Duration</th>
                        <th>Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {step.network_requests.map((req: any, index: number) => (
                        <tr key={index}>
                          <td className="method">{req.method}</td>
                          <td className="url" title={req.url}>{req.url}</td>
                          <td><StatusCode status={req.status}>{req.status}</StatusCode></td>
                          <td className="duration">{formatDuration(req.duration_ms)}</td>
                          <td className="size">{req.size_bytes ? formatBytes(req.size_bytes) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </NetworkTable>
                ) : (
                  <EmptyState>
                    <Network size={48} />
                    <h4>No network requests captured</h4>
                    <p>No HTTP requests were made during this step</p>
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
                      <div className="success-badge">{attempt.success ? 'Success' : 'Failed'}</div>
                      <div className="strategy">{attempt.strategy}</div>
                      <div className="description">{attempt.description}</div>
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