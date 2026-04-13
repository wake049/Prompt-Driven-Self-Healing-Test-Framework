import React from 'react';
import styled from 'styled-components';
import { spinKeyframes, shimmerKeyframes } from '../styles/keyframes';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  text-align: center;
`;

const IconWrapper = styled.div<{ $status: 'loading' | 'success' | 'error' }>`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  
  ${props => {
    switch (props.$status) {
      case 'loading':
        return `
          background: linear-gradient(135deg, #185FA515 0%, #185FA515 100%);
          animation: ${pulse} 2s ease-in-out infinite;
        `;
      case 'success':
        return `background: #1D9E7520;`;
      case 'error':
        return `background: #A32D2D20;`;
    }
  }}
  
  svg {
    ${props => {
      switch (props.$status) {
        case 'loading':
          return `
            color: #185FA5;
            animation: spin 1s linear infinite;
          `;
        case 'success':
          return `color: #1D9E75;`;
        case 'error':
          return `color: #A32D2D;`;
      }
    }}
  }
`;

const Title = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 8px 0;
`;

const Description = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0 0 24px 0;
  max-width: 400px;
`;

const ProgressBarContainer = styled.div`
  width: 100%;
  max-width: 400px;
  height: 8px;
  background: ${props => props.theme.colors.surface};
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
`;

const ProgressBarFill = styled.div<{ $progress: number; $animated?: boolean }>`
  height: 100%;
  background: #185FA5;
  border-radius: 4px;
  transition: width 0.3s ease;
  width: ${props => props.$progress}%;
  
  ${props => props.$animated && `
    animation: ${shimmerKeyframes} 1.5s infinite;
    background-size: 200% 100%;
  `}
`;

const ProgressText = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin-bottom: 16px;
`;

const Steps = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 400px;
  margin-top: 24px;
`;

const Step = styled.div<{ $status: 'pending' | 'active' | 'completed' | 'error' }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: ${props => {
    switch (props.$status) {
      case 'active': return `${props.theme.colors.primary}10`;
      case 'completed': return '#1D9E7510';
      case 'error': return '#A32D2D10';
      default: return props.theme.colors.surface;
    }
  }};
  border-radius: 8px;
  border-left: 3px solid ${props => {
    switch (props.$status) {
      case 'active': return props.theme.colors.primary;
      case 'completed': return '#1D9E75';
      case 'error': return '#A32D2D';
      default: return 'transparent';
    }
  }};
`;

const StepIcon = styled.div<{ $status: 'pending' | 'active' | 'completed' | 'error' }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  ${props => {
    switch (props.$status) {
      case 'active':
        return `
          background: ${props.theme.colors.primary};
          color: white;
          font-weight: 600;
          font-size: 12px;
        `;
      case 'completed':
        return `background: #1D9E75; color: white;`;
      case 'error':
        return `background: #A32D2D; color: white;`;
      default:
        return `
          background: ${props.theme.colors.border};
          color: ${props.theme.colors.textSecondary};
          font-size: 12px;
          font-weight: 600;
        `;
    }
  }}
`;

const StepText = styled.div<{ $status: string }>`
  flex: 1;
  font-size: 14px;
  color: ${props => props.$status === 'pending' 
    ? props.theme.colors.textSecondary 
    : props.theme.colors.text};
  font-weight: ${props => props.$status === 'active' ? '600' : '500'};
`;

interface ProgressStep {
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

interface ProgressIndicatorProps {
  status: 'loading' | 'success' | 'error';
  title: string;
  description?: string;
  progress?: number; // 0-100
  showProgressBar?: boolean;
  steps?: ProgressStep[];
  estimatedTime?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  status,
  title,
  description,
  progress = 0,
  showProgressBar = false,
  steps,
  estimatedTime,
}) => {
  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 size={32} />;
      case 'success':
        return <CheckCircle size={32} />;
      case 'error':
        return <XCircle size={32} />;
    }
  };

  const getStepIcon = (step: ProgressStep, index: number) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle size={14} />;
      case 'error':
        return <XCircle size={14} />;
      case 'active':
        return <Loader2 size={14} className="animate-spin" />;
      default:
        return String(index + 1);
    }
  };

  return (
    <Container>
      <IconWrapper $status={status}>
        {getIcon()}
      </IconWrapper>
      
      <Title>{title}</Title>
      {description && <Description>{description}</Description>}

      {showProgressBar && (
        <>
          <ProgressBarContainer>
            <ProgressBarFill 
              $progress={progress} 
              $animated={status === 'loading' && progress === 0}
            />
          </ProgressBarContainer>
          {progress > 0 && (
            <ProgressText>{progress}% Complete</ProgressText>
          )}
          {estimatedTime && status === 'loading' && (
            <Description style={{ marginTop: 0 }}>
              Estimated time: {estimatedTime}
            </Description>
          )}
        </>
      )}

      {steps && steps.length > 0 && (
        <Steps>
          {steps.map((step, index) => (
            <Step key={index} $status={step.status}>
              <StepIcon $status={step.status}>
                {getStepIcon(step, index)}
              </StepIcon>
              <StepText $status={step.status}>
                {step.label}
              </StepText>
            </Step>
          ))}
        </Steps>
      )}
    </Container>
  );
};

// Helper hook for managing progress state
export const useProgressSteps = (initialSteps: string[]) => {
  const [steps, setSteps] = React.useState<ProgressStep[]>(
    initialSteps.map(label => ({ label, status: 'pending' as const }))
  );

  const startStep = (index: number) => {
    setSteps(prev => prev.map((step, i) => ({
      ...step,
      status: i === index ? 'active' : step.status
    })));
  };

  const completeStep = (index: number) => {
    setSteps(prev => prev.map((step, i) => ({
      ...step,
      status: i === index ? 'completed' : step.status
    })));
  };

  const errorStep = (index: number) => {
    setSteps(prev => prev.map((step, i) => ({
      ...step,
      status: i === index ? 'error' : step.status
    })));
  };

  const reset = () => {
    setSteps(initialSteps.map(label => ({ label, status: 'pending' })));
  };

  return { steps, startStep, completeStep, errorStep, reset };
};
