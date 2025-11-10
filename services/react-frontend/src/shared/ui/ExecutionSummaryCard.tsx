import React from 'react';
import styled from 'styled-components';
import { AlertTriangle, Wrench, CheckCircle, XCircle } from 'lucide-react';
import EnhancedStatusBadge from './EnhancedStatusBadge';

interface ExecutionSummaryCardProps {
  execution: {
    execution_id: string;
    test_name: string;
    status: 'pass' | 'pending_review' | 'failed' | 'completed' | 'running';
    healed_steps?: number;
    total_steps?: number;
    start_time: string;
  };
  onClick?: () => void;
}

const SummaryCard = styled.div<{ $needsReview: boolean }>`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: ${props => props.theme.shadows.medium};
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  
  ${props => props.$needsReview && `
    border-left: 4px solid #ff8c00;
    background: linear-gradient(90deg, rgba(255, 140, 0, 0.05), ${props.theme.colors.surface});
    
    &::before {
      content: '';
      position: absolute;
      top: 12px;
      right: 12px;
      width: 12px;
      height: 12px;
      background: #ff8c00;
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.1); }
    }
  `}
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.large};
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const ExecutionTitle = styled.h4`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  flex: 1;
`;

const ExecutionId = styled.div`
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  background: rgba(102, 126, 234, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  margin-left: 12px;
`;

const CardContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const StepInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const StepCount = styled.span`
  font-weight: 600;
  color: ${props => props.theme.colors.text};
`;

const HealingAlert = styled.div`
  background: rgba(255, 140, 0, 0.1);
  border: 1px solid rgba(255, 140, 0, 0.3);
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #cc7000;
`;

const ActionButton = styled.button`
  background: linear-gradient(135deg, #ff8c00, #ff7300);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 140, 0, 0.4);
  }
`;

const ExecutionSummaryCard: React.FC<ExecutionSummaryCardProps> = ({ execution, onClick }) => {
  const needsReview = execution.status === 'pending_review' || Boolean(execution.healed_steps && execution.healed_steps > 0);
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <SummaryCard $needsReview={needsReview} onClick={onClick}>
      <CardHeader>
        <ExecutionTitle>{execution.test_name}</ExecutionTitle>
        <ExecutionId>{execution.execution_id.substring(0, 8).toUpperCase()}</ExecutionId>
      </CardHeader>
      
      <CardContent>
        <StepInfo>
          <span>
            <StepCount>{execution.total_steps || 0}</StepCount> steps
          </span>
          <span>{formatDate(execution.start_time)}</span>
        </StepInfo>
        
        <EnhancedStatusBadge 
          status={execution.status === 'completed' ? 'pass' : execution.status}
          healedSteps={execution.healed_steps || 0}
          size="small"
        />
      </CardContent>
      
      {needsReview && (
        <HealingAlert>
          <AlertTriangle size={16} />
          <span>
            {execution.healed_steps} step{execution.healed_steps !== 1 ? 's' : ''} required healing. 
            Review recommended to update selectors.
          </span>
          <ActionButton onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
            Review Now
          </ActionButton>
        </HealingAlert>
      )}
    </SummaryCard>
  );
};

export default ExecutionSummaryCard;