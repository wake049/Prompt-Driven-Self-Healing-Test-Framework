import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, CheckCircle, XCircle, ArrowLeft, Clock, Calendar, Activity } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { executionApiService } from '../api';
const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
`;
const ModalContent = styled.div`
  background: ${props => props.theme.colors.background};
  border-radius: 16px;
  width: 95%;
  height: 90vh;
  max-width: 1400px;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  box-shadow: ${props => props.theme.shadows.large};
`;
const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface};
`;
const ModalTitle = styled.h2`
  margin: 0;
  color: ${props => props.theme.colors.text};
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;
`;
const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: ${props => props.theme.colors.textSecondary};
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background: ${props => props.theme.colors.border};
    color: ${props => props.theme.colors.text};
  }
`;
const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 32px;
  background: ${props => props.theme.colors.background};
`;
const DetailsCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 32px;
  margin-bottom: 32px;
  box-shadow: ${props => props.theme.shadows.medium};
`;
const DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
`;
const DetailItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
const DetailLabel = styled.span`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;
const DetailValue = styled.span`
  font-size: 18px;
  color: ${props => props.theme.colors.text};
  font-weight: 600;
`;
const PromptDescription = styled.div`
  margin-top: 16px;
  padding-top: 24px;
  border-top: 1px solid ${props => props.theme.colors.border};
`;
const StepsContainer = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  overflow: hidden;
  box-shadow: ${props => props.theme.shadows.medium};
`;
const StepsHeader = styled.div`
  background: linear-gradient(135deg, ${props => props.theme.colors.primary} 0%, ${props => props.theme.colors.secondary} 100%);
  padding: 24px 32px;
  color: white;
  font-weight: 700;
  font-size: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
const StepItem = styled.div<{ isLast?: boolean; hasFailed?: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 24px 32px;
  border-bottom: ${props => props.isLast ? 'none' : `1px solid ${props.theme.colors.border}`};
  transition: all 0.2s ease;
  background: ${props => props.hasFailed ? 'rgba(229, 62, 62, 0.03)' : 'transparent'};
  &:hover {
    background: ${props => props.hasFailed ? 'rgba(229, 62, 62, 0.08)' : 'rgba(102, 126, 234, 0.05)'};
  }
`;
const StepHeader = styled.div`
  display: grid;
  grid-template-columns: 80px 120px 1fr 120px;
  gap: 24px;
  align-items: center;
`;
const StepFailureDetails = styled.div`
  margin-top: 16px;
  padding: 16px;
  background: rgba(229, 62, 62, 0.08);
  border-left: 4px solid ${props => props.theme.colors.error};
  border-radius: 8px;
  h4 {
    margin: 0 0 8px 0;
    color: ${props => props.theme.colors.error};
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  p {
    margin: 0;
    color: ${props => props.theme.colors.text};
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.6;
    word-break: break-word;
    white-space: pre-wrap;
  }
`;
const StepNumber = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
`;
const StepResult = styled.div<{ status: 'PASS' | 'FAIL' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${props => props.status === 'PASS' ? props.theme.colors.success : props.theme.colors.error};
  font-weight: 600;
`;
const StepDescription = styled.div`
  color: ${props => props.theme.colors.text};
  font-weight: 500;
  line-height: 1.4;
`;
const StepDetails = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  .duration {
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
    font-family: monospace;
  }
`;
const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
  font-size: 18px;
  color: ${props => props.theme.colors.textSecondary};
`;
const ErrorContainer = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  color: ${props => props.theme.colors.error};
  font-size: 18px;
`;
interface ExecutionStep {
  step_number: number;
  step_description: string;
  result: 'PASS' | 'FAIL';
  details?: string;
  duration_ms?: number;
  screenshot?: string;
  console_logs?: string[];
  network_requests?: any[];
  healing_attempts?: any[];
}
interface ExecutionDetails {
  execution_id: string;
  prompt_id: string;
  prompt_description: string;
  execution_date: string;
  duration_ms: number;
  status: 'PASS' | 'FAIL';
  steps: ExecutionStep[];
}
interface ExecutionDetailsModalProps {
  executionId: string;
  isOpen: boolean;
  onClose: () => void;
}
const ExecutionDetailsModal: React.FC<ExecutionDetailsModalProps> = ({
  executionId,
  isOpen,
  onClose
}) => {
  const { theme } = useTheme();
  const [executionDetails, setExecutionDetails] = useState<ExecutionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  useEffect(() => {
    const fetchExecutionDetails = async () => {
      if (!isOpen || !executionId) return;
      try {
        setLoading(true);
        setError(null);
        const response = await executionApiService.getExecutionDetails(executionId);
        setExecutionDetails(response);
      } catch (err) {
        console.error($1);
        setError('Failed to load execution details');
      } finally {
        setLoading(false);
      }
    };
    fetchExecutionDetails();
  }, [isOpen, executionId]);
  if (!isOpen) return null;
  return (
    <Modal onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            <Activity size={24} />
            Execution Details
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={24} />
          </CloseButton>
        </ModalHeader>
        <ModalBody>
          {loading && (
            <LoadingContainer>
              Loading execution details...
            </LoadingContainer>
          )}
          {error && (
            <ErrorContainer>
              {error}
            </ErrorContainer>
          )}
          {executionDetails && (
            <>
              <DetailsCard>
                <DetailsGrid>
                  <DetailItem>
                    <DetailLabel>Run ID</DetailLabel>
                    <DetailValue>{executionDetails.execution_id}</DetailValue>
                  </DetailItem>
                  <DetailItem>
                    <DetailLabel>Date</DetailLabel>
                    <DetailValue>{formatDate(executionDetails.execution_date)}</DetailValue>
                  </DetailItem>
                  <DetailItem>
                    <DetailLabel>Duration</DetailLabel>
                    <DetailValue>{formatDuration(executionDetails.duration_ms)}</DetailValue>
                  </DetailItem>
                  <DetailItem>
                    <DetailLabel>Status</DetailLabel>
                    <DetailValue style={{ 
                      color: executionDetails.status === 'PASS' ? theme.colors.success : theme.colors.error 
                    }}>
                      {executionDetails.status}
                    </DetailValue>
                  </DetailItem>
                </DetailsGrid>
                <PromptDescription>
                  <DetailLabel style={{ marginBottom: '8px', display: 'block' }}>
                    Test Description
                  </DetailLabel>
                  <DetailValue style={{ fontSize: '16px', lineHeight: '1.5' }}>
                    {executionDetails.prompt_description}
                  </DetailValue>
                </PromptDescription>
              </DetailsCard>
              <StepsContainer>
                <StepsHeader>
                  <span>Execution Steps</span>
                  <span>{executionDetails.steps.length} steps</span>
                </StepsHeader>
                {executionDetails.steps.map((step, index) => (
                  <StepItem 
                    key={step.step_number} 
                    isLast={index === executionDetails.steps.length - 1}
                    hasFailed={step.result === 'FAIL'}
                  >
                    <StepHeader>
                      <StepNumber>{step.step_number}</StepNumber>
                      <StepResult status={step.result}>
                        {step.result === 'PASS' ? (
                          <CheckCircle size={20} />
                        ) : (
                          <XCircle size={20} />
                        )}
                        {step.result === 'PASS' ? 'Passed' : 'Failed'}
                      </StepResult>
                      <StepDescription>{step.step_description}</StepDescription>
                      <StepDetails>
                        {step.duration_ms && (
                          <span className="duration">{formatDuration(step.duration_ms)}</span>
                        )}
                      </StepDetails>
                    </StepHeader>
                    {step.result === 'FAIL' && step.details && (
                      <StepFailureDetails>
                        <h4>Failure Reason</h4>
                        <p>{step.details}</p>
                      </StepFailureDetails>
                    )}
                  </StepItem>
                ))}
              </StepsContainer>
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
export default ExecutionDetailsModal;