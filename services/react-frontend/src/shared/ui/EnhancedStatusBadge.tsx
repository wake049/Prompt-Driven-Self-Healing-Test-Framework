import React from 'react';
import styled from 'styled-components';
import { pulseOrangeKeyframes, attentionKeyframes } from '../styles/keyframes';
import { CheckCircle, XCircle, Clock, AlertTriangle, Wrench } from 'lucide-react';

interface StatusBadgeProps {
  status: 'pass' | 'pending_review' | 'failed' | 'completed' | 'running' | 'error';
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  healedSteps?: number;
}

const StatusBadgeContainer = styled.span<{ 
  $status: string; 
  $size: 'small' | 'medium' | 'large';
  $needsAttention: boolean;
}>`
  padding: ${props => {
    switch (props.$size) {
      case 'small': return '4px 8px';
      case 'large': return '12px 20px';
      default: return '8px 16px';
    }
  }};
  border-radius: 24px;
  font-size: ${props => {
    switch (props.$size) {
      case 'small': return '11px';
      case 'large': return '15px';
      default: return '13px';
    }
  }};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: ${props => {
    switch (props.$size) {
      case 'small': return '60px';
      case 'large': return '120px';
      default: return '80px';
    }
  }};
  justify-content: center;
  position: relative;
  
  background: ${props => {
    switch (props.$status) {
      case 'pass': return 'linear-gradient(135deg, #68d391, #1D9E75)';
      case 'completed': return 'linear-gradient(135deg, #68d391, #1D9E75)';
      case 'pending_review': return 'linear-gradient(135deg, #ffd93d, #ff8c00)';
      case 'running': return 'linear-gradient(135deg, #63b3ed, #3182ce)';
      case 'failed': return 'linear-gradient(135deg, #d47070, #A32D2D)';
      case 'error': return 'linear-gradient(135deg, #d47070, #A32D2D)';
      default: return 'linear-gradient(135deg, #cbd5e0, #a0aec0)';
    }
  }};
  
  color: white;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  
  /* Special animation for pending_review status */
  ${props => props.$status === 'pending_review' && `
    animation: ${pulseOrangeKeyframes} 2s ease-in-out infinite;
    border-color: rgba(255, 255, 255, 0.4);
  `}
  
  /* Attention-grabbing effect for needs review */
  ${props => props.$needsAttention && `
    &::after {
      content: '!';
      position: absolute;
      top: -4px;
      right: -4px;
      background: #A32D2D;
      color: white;
      font-size: 10px;
      font-weight: 900;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: ${attentionKeyframes} 1.5s ease-in-out infinite;
    }
  `}
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  }
`;

const StatusText = styled.span`
  font-weight: inherit;
`;

const HealingIndicator = styled.span`
  background: rgba(255, 255, 255, 0.3);
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  margin-left: 4px;
  display: flex;
  align-items: center;
  gap: 2px;
`;

const EnhancedStatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = 'medium', 
  showIcon = true,
  healedSteps = 0
}) => {
  const getStatusIcon = () => {
    if (!showIcon) return null;
    
    const iconSize = size === 'small' ? 10 : size === 'large' ? 16 : 12;
    
    switch (status) {
      case 'pass':
      case 'completed':
        return <CheckCircle size={iconSize} />;
      case 'pending_review':
        return <AlertTriangle size={iconSize} />;
      case 'running':
        return <Clock size={iconSize} />;
      case 'failed':
      case 'error':
        return <XCircle size={iconSize} />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pass':
        return 'Pass';
      case 'completed':
        return 'Passed';
      case 'pending_review':
        return 'Needs Review';
      case 'running':
        return 'Running';
      case 'failed':
      case 'error':
        return 'Failed';
      default:
        return status;
    }
  };

  const needsAttention = status === 'pending_review' && healedSteps > 0;

  return (
    <StatusBadgeContainer 
      $status={status} 
      $size={size}
      $needsAttention={needsAttention}
    >
      {getStatusIcon()}
      <StatusText>{getStatusText()}</StatusText>
      {status === 'pending_review' && healedSteps > 0 && (
        <HealingIndicator>
          <Wrench size={8} />
          {healedSteps}
        </HealingIndicator>
      )}
    </StatusBadgeContainer>
  );
};

export default EnhancedStatusBadge;