import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
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
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
`;

const ModalTitle = styled.h2`
  margin: 0;
  color: #212529;
  font-size: 20px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: #212529;
  }
`;

const ModalBody = styled.div`
  padding: 20px;
`;

const SummaryStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const StatCard = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: #212529;
  margin-bottom: 4px;
`;

const StatLabel = styled.div`
  font-size: 11px;
  color: #6c757d;
  font-weight: 500;
  text-transform: uppercase;
`;

const StepsTable = styled.div`
  border: 1px solid #e9ecef;
  border-radius: 6px;
  overflow: hidden;
`;

const TableHeader = styled.div`
  background: #f8f9fa;
  padding: 12px 16px;
  font-weight: 600;
  color: #495057;
  border-bottom: 1px solid #e9ecef;
  display: grid;
  grid-template-columns: 60px 120px 2fr 100px 1fr;
  gap: 16px;
  font-size: 13px;
`;

const StepRow = styled.div`
  display: grid;
  grid-template-columns: 60px 120px 2fr 100px 1fr;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
  align-items: center;
  font-size: 13px;

  &:hover {
    background: #f8f9fa;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const StepNumber = styled.div`
  font-weight: 600;
  color: #495057;
`;

const ActionName = styled.div`
  font-family: 'Courier New', monospace;
  background: #f1f3f4;
  padding: 4px 6px;
  border-radius: 3px;
  font-size: 12px;
  color: #495057;
`;

const Target = styled.div`
  font-family: 'Courier New', monospace;
  color: #495057;
  word-break: break-all;
  font-size: 12px;
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  background: ${props => {
    switch (props.status) {
      case 'passed': return '#d4edda';
      case 'failed': return '#f8d7da';
      case 'pending': return '#fff3cd';
      default: return '#e2e3e5';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'passed': return '#155724';
      case 'failed': return '#721c24';
      case 'pending': return '#856404';
      default: return '#383d41';
    }
  }};
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  font-size: 12px;
  font-style: italic;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  color: #6c757d;
`;

const ErrorState = styled.div`
  text-align: center;
  padding: 40px;
  color: #dc3545;
`;

interface StepDetail {
  step_order: number;
  action: string;
  target: string;
  status: string;
  error_message?: string;
  created_at?: string;
}

interface ExecutionDetail {
  id: string;
  test_case_id: string;
  status: string;
  started_at?: string;
  finished_at?: string;
  duration_seconds: number;
}

interface StepSummary {
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  pending_steps: number;
  success_rate: number;
}

interface ExecutionStepsData {
  execution: ExecutionDetail;
  steps: StepDetail[];
  summary: StepSummary;
}

interface ExecutionStepsModalProps {
  executionId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ExecutionStepsModal: React.FC<ExecutionStepsModalProps> = ({
  executionId,
  isOpen,
  onClose
}) => {
  const [data, setData] = useState<ExecutionStepsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStepDetails = async () => {
    if (!executionId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const stepData = await executionApiService.getExecutionSteps(executionId);
      setData(stepData);
    } catch (err: any) {
<<<<<<< Updated upstream
      console.error('Error fetching step details:', err);
=======
>>>>>>> Stashed changes
      setError('Failed to load step details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && executionId) {
      fetchStepDetails();
    }
  }, [isOpen, executionId]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  if (!isOpen) return null;

  return (
    <Modal onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            Test Execution Steps
            {data && (
              <span style={{ color: '#6c757d', fontSize: '14px', fontWeight: 'normal', marginLeft: '8px' }}>
                {data.execution.id.substring(0, 8)}...
              </span>
            )}
          </ModalTitle>
          <CloseButton onClick={onClose}>×</CloseButton>
        </ModalHeader>
        
        <ModalBody>
          {loading && <LoadingSpinner>Loading step details...</LoadingSpinner>}
          
          {error && <ErrorState>{error}</ErrorState>}
          
          {data && (
            <>
              <SummaryStats>
                <StatCard>
                  <StatValue>{data.summary.total_steps}</StatValue>
                  <StatLabel>Total Steps</StatLabel>
                </StatCard>
                
                <StatCard>
                  <StatValue>{data.summary.passed_steps}</StatValue>
                  <StatLabel>Passed</StatLabel>
                </StatCard>
                
                <StatCard>
                  <StatValue>{data.summary.failed_steps}</StatValue>
                  <StatLabel>Failed</StatLabel>
                </StatCard>
                
                <StatCard>
                  <StatValue>{data.summary.pending_steps}</StatValue>
                  <StatLabel>Pending</StatLabel>
                </StatCard>
                
                <StatCard>
                  <StatValue>{data.summary.success_rate}%</StatValue>
                  <StatLabel>Success Rate</StatLabel>
                </StatCard>
                
                <StatCard>
                  <StatValue>{formatDuration(data.execution.duration_seconds)}</StatValue>
                  <StatLabel>Duration</StatLabel>
                </StatCard>
              </SummaryStats>

              <StepsTable>
                <TableHeader>
                  <div>Step</div>
                  <div>Action</div>
                  <div>Target</div>
                  <div>Status</div>
                  <div>Error</div>
                </TableHeader>
                
                {data.steps.map((step) => (
                  <StepRow key={step.step_order}>
                    <StepNumber>#{step.step_order}</StepNumber>
                    <ActionName>{step.action}</ActionName>
                    <Target>{step.target || '-'}</Target>
                    <StatusBadge status={step.status}>{step.status}</StatusBadge>
                    <ErrorMessage>
                      {step.error_message || '-'}
                    </ErrorMessage>
                  </StepRow>
                ))}
              </StepsTable>
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default ExecutionStepsModal;