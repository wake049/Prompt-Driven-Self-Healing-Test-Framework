import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowLeft, Clock, Calendar } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { executionApiService } from '../api';
import StepDetailsModal from '../../../shared/ui/StepDetailsModal';
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
const Container = styled.div`
  padding: 32px 64px;
  max-width: 1400px;
  margin: 0 auto;
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
`;
const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
`;
const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.text};
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  &:hover {
    background: ${props => props.theme.colors.surface};
    border-color: ${props => props.theme.colors.primary};
    transform: translateY(-1px);
  }
`;
const Title = styled.h1`
  font-size: 32px;
  font-weight: 800;
  color: ${props => props.theme.colors.text};
  margin: 0;
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
  cursor: pointer;
  &:hover {
    background: ${props => props.hasFailed ? 'rgba(229, 62, 62, 0.08)' : 'rgba(102, 126, 234, 0.05)'};
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
const RunDetails: React.FC = () => {
  const { executionId } = useParams<{ executionId: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [executionDetails, setExecutionDetails] = useState<ExecutionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<ExecutionStep | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  useEffect(() => {
    const fetchExecutionDetails = async () => {
      if (!executionId) {
        setError('No execution ID provided');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
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
  }, [executionId]);
  const handleBack = () => {
    // Go back to the previous page in history
    navigate(-1);
  };
  const handleStepClick = (step: ExecutionStep) => {
    setSelectedStep(step);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStep(null);
  };
  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          Loading execution details...
        </LoadingContainer>
      </Container>
    );
  }
  if (error || !executionDetails) {
    return (
      <Container>
        <Header>
          <BackButton onClick={handleBack}>
            <ArrowLeft size={20} />
            Back
          </BackButton>
        </Header>
        <ErrorContainer>
          {error || 'Execution details not found'}
        </ErrorContainer>
      </Container>
    );
  }
  return (
    <Container>
      <Header>
        <BackButton onClick={handleBack}>
          <ArrowLeft size={20} />
          Back
        </BackButton>
        <Title>Run Details</Title>
      </Header>
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
            onClick={() => handleStepClick(step)}
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
      {/* Step Details Modal */}
      {selectedStep && (
        <StepDetailsModal
          step={selectedStep}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </Container>
  );
};
export default RunDetails;