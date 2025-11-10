import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import unifiedApiClient from '../../../shared/utils/unifiedApiClient';
import ExecutionStepsModal from './ExecutionStepsModal';
import { executionApiService } from '../api';
<<<<<<< Updated upstream

=======
import { useTheme } from '../../../contexts/ThemeContext';
import EnhancedStatusBadge from '../../../shared/ui/EnhancedStatusBadge';
import { RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, Activity, AlertTriangle, Wrench } from 'lucide-react';
>>>>>>> Stashed changes
const HistoryContainer = styled.div`
  padding: 16px 0;
`;

const HistoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const HistoryTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #212529;
  margin: 0;
`;

const RefreshButton = styled.button`
  background: #0066cc;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: #0052a3;
  }
`;

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const StatCard = styled.div`
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: #212529;
  margin-bottom: 4px;
`;

const StatLabel = styled.div`
  font-size: 12px;
  color: #6c757d;
  font-weight: 500;
  text-transform: uppercase;
`;

const StatSubtext = styled.div`
  font-size: 11px;
  color: #dc3545;
  margin-top: 2px;
`;

const ExecutionsTable = styled.div`
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
`;

const TableHeader = styled.div`
  background: #f8f9fa;
  padding: 16px;
  font-weight: 600;
  color: #495057;
  border-bottom: 1px solid #e9ecef;
  font-size: 14px;
`;

const TableRow = styled.div<{ clickable?: boolean }>`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr;
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
  align-items: center;
  font-size: 13px;
  cursor: ${props => props.clickable ? 'pointer' : 'default'};

  &:hover {
    background: ${props => props.clickable ? '#e3f2fd' : '#f8f9fa'};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const TestName = styled.div`
  color: #212529;
  font-weight: 500;
`;

const TestId = styled.div`
  color: #6c757d;
  font-size: 11px;
  margin-top: 2px;
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  background: ${props => {
    switch (props.status) {
      case 'completed': return '#d4edda';
      case 'failed': return '#f8d7da';
      case 'running': return '#fff3cd';
      default: return '#e2e3e5';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'completed': return '#155724';
      case 'failed': return '#721c24';
      case 'running': return '#856404';
      default: return '#383d41';
    }
  }};
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  color: #6c757d;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: #6c757d;
  
  h4 {
    margin: 0 0 8px 0;
    color: #495057;
  }
  
  p {
    margin: 0;
    font-size: 14px;
  }
`;

interface ExecutionStats {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  pending_review_executions: number; // NEW: Count of executions needing review
  success_rate: number;
  recent_executions_24h: number;
  avg_execution_time: number;
  healing_rate?: number; // NEW: Percentage of executions that required healing
}

interface ExecutionRecord {
  id: string;
  test_name: string;
  status: 'pass' | 'pending_review' | 'failed' | 'completed' | 'running'; // UPDATED: New status types
  success_rate: number;
  started_at: string;
  duration_seconds: number;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  pending_review_steps?: number; // NEW: Steps that passed but required healing
  healed_steps?: number; // NEW: Total healed steps count
}

interface TestCaseExecutionHistoryProps {
  testCaseId?: string;
  promptId?: string;
  title?: string;
}

const TestCaseExecutionHistory: React.FC<TestCaseExecutionHistoryProps> = ({ 
  testCaseId, 
  promptId, 
  title = "Execution History" 
}) => {
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleExecutionClick = (executionId: string) => {
    setSelectedExecutionId(executionId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedExecutionId(null);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build filter parameters
      const filters: any = {};
      if (testCaseId) {
        filters.test_case_id = testCaseId;
      } else if (promptId) {
        filters.prompt_id = promptId;
      }

      // Use authenticated API service
      const [statsResponse, executionsResponse] = await Promise.all([
        executionApiService.getExecutionStats(filters),
        executionApiService.getRecentExecutions({ ...filters, limit: 10 })
      ]);

      setStats(statsResponse);
      setExecutions(executionsResponse);
    } catch (err: any) {
<<<<<<< Updated upstream
      console.error('Error fetching execution data:', err);
=======
>>>>>>> Stashed changes
      setError('Failed to load execution history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [testCaseId, promptId]);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <HistoryContainer>
        <HistoryTitle>{title}</HistoryTitle>
        <LoadingSpinner>Loading execution history...</LoadingSpinner>
      </HistoryContainer>
    );
  }

  if (error) {
    return (
      <HistoryContainer>
        <HistoryTitle>{title}</HistoryTitle>
        <EmptyState>
          <h4>Error Loading Data</h4>
          <p>{error}</p>
          <RefreshButton onClick={fetchData} style={{ marginTop: '12px' }}>
            Retry
          </RefreshButton>
        </EmptyState>
      </HistoryContainer>
    );
  }

  return (
    <HistoryContainer>
      <HistoryHeader>
        <HistoryTitle>{title}</HistoryTitle>
        <RefreshButton onClick={fetchData}>
          Refresh
        </RefreshButton>
      </HistoryHeader>

      {stats && (
        <StatsRow>
          <StatCard>
            <StatValue>{stats.total_executions}</StatValue>
            <StatLabel>Total Runs</StatLabel>
            <StatSubtext>{stats.recent_executions_24h} in last 24h</StatSubtext>
          </StatCard>
<<<<<<< Updated upstream
          
          <StatCard>
            <StatValue>{stats.success_rate}%</StatValue>
            <StatLabel>Success Rate</StatLabel>
            <StatSubtext>{stats.successful_executions}/{stats.total_executions} successful</StatSubtext>
=======
          <StatCard variant="success">
            <StatTitle>
              <CheckCircle size={16} />
              Passed (No Healing)
            </StatTitle>
            <StatValue>{stats.successful_executions}</StatValue>
            <StatChange positive={stats.success_rate > 0.7}>
              <TrendingUp size={14} />
              {((stats.successful_executions / stats.total_executions) * 100).toFixed(1)}% clean passes
            </StatChange>
          </StatCard>
          <StatCard variant="warning">
            <StatTitle>
              <AlertTriangle size={16} />
              Needs Review
            </StatTitle>
            <StatValue>{stats.pending_review_executions || 0}</StatValue>
            <StatChange positive={false}>
              <Wrench size={14} />
              {stats.pending_review_executions > 0 ? 
                `${((stats.pending_review_executions / stats.total_executions) * 100).toFixed(1)}% required healing` :
                'No healing needed'
              }
            </StatChange>
>>>>>>> Stashed changes
          </StatCard>
          
          <StatCard>
            <StatValue>{stats.failed_executions}</StatValue>
            <StatLabel>Failed Runs</StatLabel>
            <StatSubtext>{stats.failed_executions > 0 ? ((stats.failed_executions / stats.total_executions) * 100).toFixed(1) : '0.0'}% failure rate</StatSubtext>
          </StatCard>
<<<<<<< Updated upstream
          
          <StatCard>
            <StatValue>{formatDuration(stats.avg_execution_time)}</StatValue>
            <StatLabel>Avg Duration</StatLabel>
            <StatSubtext>Average execution time</StatSubtext>
          </StatCard>
        </StatsRow>
=======
        </StatsGrid>
>>>>>>> Stashed changes
      )}

      <ExecutionsTable>
        <TableHeader>
          <TableRow style={{ fontWeight: 600 }}>
            <div>Test Run</div>
            <div>Status</div>
            <div>Success Rate</div>
            <div>Duration</div>
            <div>Started</div>
          </TableRow>
        </TableHeader>
        
        {executions.length === 0 ? (
          <EmptyState>
            <h4>No Executions Found</h4>
            <p>No test executions have been run for this test case yet.</p>
          </EmptyState>
        ) : (
<<<<<<< Updated upstream
          executions.map((execution) => (
            <TableRow 
              key={execution.id} 
              clickable={true}
              onClick={() => handleExecutionClick(execution.id)}
            >
              <div>
                <TestName>{execution.test_name}</TestName>
                <TestId>ID: {execution.id.substring(0, 8)}...</TestId>
              </div>
              <div>
                <StatusBadge status={execution.status}>
                  {execution.status}
                </StatusBadge>
              </div>
              <div>
                {execution.success_rate > 0 ? `${execution.success_rate}%` : 'N/A'}
              </div>
              <div>{formatDuration(execution.duration_seconds)}</div>
              <div>{formatDateTime(execution.started_at)}</div>
            </TableRow>
          ))
=======
          <>
            <ExecutionItem style={{ 
              background: theme.colors.surface, 
              fontWeight: 600,
              color: theme.colors.text,
              borderBottom: `2px solid ${theme.colors.border}`
            }}>
              <div>Run ID</div>
              <div>Prompt Description</div>
              <div>Date</div>
              <div>Duration</div>
              <div>Steps</div>
              <div>Passed</div>
              <div>Healed</div>
              <div>Status</div>
              <div>Actions</div>
            </ExecutionItem>
            {executions.map((execution, index) => (
              <ExecutionItem 
                key={execution.id}
                clickable={true}
                onClick={() => handleExecutionClick(execution.id)}
              >
                <ExecutionId>
                  {execution.id ? execution.id.substring(0, 8).toUpperCase() : `RUN-${String(index + 121).padStart(5, '0')}`}
                </ExecutionId>
                <ExecutionDescription>
                  {execution.test_name || 'Test Execution'}
                  <small>ID: {execution.id}</small>
                </ExecutionDescription>
                <DateValue>
                  {new Date(execution.started_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  })}
                </DateValue>
                <DateValue>
                  {execution.duration_seconds ? 
                    new Date(execution.duration_seconds * 1000).toISOString().substr(11, 8) : 
                    'N/A'}
                </DateValue>
                <MetricValue>{execution.total_steps || 0}</MetricValue>
                <MetricValue type="success">
                  {execution.passed_steps || 0}
                </MetricValue>
                <MetricValue type="neutral">
                  {execution.healed_steps || execution.pending_review_steps || 0}
                  {(execution.healed_steps || execution.pending_review_steps) ? (
                    <small style={{ display: 'block', fontSize: '11px', opacity: 0.7, color: '#ff8c00' }}>
                      {execution.status === 'pending_review' ? 'Needs Review' : 'Healed'}
                    </small>
                  ) : null}
                </MetricValue>
                <div>
                  <EnhancedStatusBadge 
                    status={execution.status === 'completed' ? 'pass' : execution.status}
                    healedSteps={execution.healed_steps || execution.pending_review_steps || 0}
                    size="medium"
                  />
                </div>
                <div>
                  <ActionButton onClick={(e) => {
                    e.stopPropagation();
                    handleExecutionClick(execution.id);
                  }}>
                    View Details
                  </ActionButton>
                </div>
              </ExecutionItem>
            ))}
          </>
>>>>>>> Stashed changes
        )}
      </ExecutionsTable>

      {/* Modal for execution step details */}
      {selectedExecutionId && (
        <ExecutionStepsModal
          executionId={selectedExecutionId}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </HistoryContainer>
  );
};

export default TestCaseExecutionHistory;