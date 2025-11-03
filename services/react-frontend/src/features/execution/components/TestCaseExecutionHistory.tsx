import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import unifiedApiClient from '../../../shared/utils/unifiedApiClient';
import { executionApiService } from '../api';
import { useTheme } from '../../../contexts/ThemeContext';
import { RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, Activity } from 'lucide-react';
const HistoryContainer = styled.div`
  padding: 32px 0;
  background: ${props => props.theme.colors.background};
`;
const HistoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 48px;
  background: ${props => props.theme.colors.surface};
  padding: 32px 40px;
  border-radius: 16px;
  box-shadow: ${props => props.theme.shadows.medium};
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    margin-bottom: 24px;
  }
`;
const HistoryTitle = styled.h3`
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;
const RefreshButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  }
  &:disabled {
    background: #a0aec0;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;
const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 32px;
  margin-bottom: 48px;
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 16px;
    margin-bottom: 24px;
  }
  @media (min-width: 1600px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;
const StatCard = styled.div<{ variant?: 'success' | 'danger' | 'warning' | 'info' }>`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 32px;
  box-shadow: ${props => props.theme.shadows.medium};
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${props => {
      switch (props.variant) {
        case 'success': return `linear-gradient(90deg, ${props.theme.colors.success}, ${props.theme.colors.success}dd)`;
        case 'danger': return `linear-gradient(90deg, ${props.theme.colors.error}, ${props.theme.colors.error}dd)`;
        case 'warning': return `linear-gradient(90deg, ${props.theme.colors.warning}, ${props.theme.colors.warning}dd)`;
        case 'info': return `linear-gradient(90deg, ${props.theme.colors.info}, ${props.theme.colors.info}dd)`;
        default: return `linear-gradient(90deg, ${props.theme.colors.primary}, ${props.theme.colors.secondary})`;
      }
    }};
  }
  &:hover {
    transform: translateY(-4px);
    box-shadow: ${props => props.theme.shadows.large};
  }
`;
const StatTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 8px;
`;
const StatValue = styled.div`
  font-size: 36px;
  font-weight: 800;
  color: ${props => props.theme.colors.text};
  margin-bottom: 8px;
  line-height: 1;
`;
const StatChange = styled.div<{ positive?: boolean }>`
  font-size: 14px;
  color: ${props => props.positive ? props.theme.colors.success : props.theme.colors.error};
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
`;
const ExecutionList = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  overflow: hidden;
  box-shadow: ${props => props.theme.shadows.medium};
`;
const ExecutionListHeader = styled.div`
  background: linear-gradient(135deg, ${props => props.theme.colors.primary} 0%, ${props => props.theme.colors.secondary} 100%);
  padding: 24px 32px;
  color: white;
  font-weight: 700;
  font-size: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
`;
const ExecutionItem = styled.div<{ clickable?: boolean }>`
  display: grid;
  grid-template-columns: 140px 3fr 140px 120px 100px 100px 100px 140px 140px;
  align-items: flex-start;
  padding: 20px 32px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  transition: all 0.2s ease;
  cursor: ${props => props.clickable ? 'pointer' : 'default'};
  gap: 24px;
  position: relative;
  min-height: 60px;
  &:hover {
    background: ${props => props.clickable ? 'rgba(99, 102, 241, 0.05)' : 'rgba(0, 0, 0, 0.02)'};
    transform: ${props => props.clickable ? 'translateY(-1px)' : 'none'};
    box-shadow: ${props => props.clickable ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none'};
  }
  &:last-child {
    border-bottom: none;
  }
  @media (max-width: 1200px) {
    grid-template-columns: 1fr 2fr 100px 80px 100px;
    gap: 16px;
    /* Hide some columns on smaller screens */
    > div:nth-child(4), /* Steps */
    > div:nth-child(5), /* Passed */
    > div:nth-child(6), /* Failed */
    > div:nth-child(9)  /* Actions */ {
      display: none;
    }
  }
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 16px;
    text-align: left;
  }
`;
const StatusBadge = styled.span<{ status: string }>`
  padding: 8px 16px;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: ${props => {
    switch (props.status) {
      case 'success': return 'linear-gradient(135deg, #68d391, #38a169)';
      case 'completed': return 'linear-gradient(135deg, #68d391, #38a169)';
      case 'running': return 'linear-gradient(135deg, #fbd38d, #ed8936)';
      case 'failed': return 'linear-gradient(135deg, #fc8181, #e53e3e)';
      case 'error': return 'linear-gradient(135deg, #fc8181, #e53e3e)';
      default: return 'linear-gradient(135deg, #cbd5e0, #a0aec0)';
    }
  }};
  color: white;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.2);
  min-width: 80px;
  justify-content: center;
`;
const ActionButton = styled.button`
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
`;
const ExecutionId = styled.div`
  font-family: 'Monaco', 'Consolas', monospace;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
  font-size: 14px;
  background: rgba(102, 126, 234, 0.1);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(102, 126, 234, 0.2);
`;
const ExecutionDescription = styled.div`
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  font-size: 15px;
  line-height: 1.4;
  small {
    color: ${props => props.theme.colors.textSecondary};
    font-weight: 400;
    font-size: 13px;
    display: block;
    margin-top: 4px;
  }
`;
const MetricValue = styled.div<{ type?: 'success' | 'error' | 'neutral' }>`
  font-weight: 700;
  font-size: 16px;
  color: ${props => {
    switch (props.type) {
      case 'success': return props.theme.colors.success;
      case 'error': return props.theme.colors.error;
      default: return props.theme.colors.text;
    }
  }};
`;
const DateValue = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-weight: 500;
  font-size: 14px;
`;
const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
`;
const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: ${props => props.theme.colors.textSecondary};
  h4 {
    margin: 0 0 8px 0;
    color: ${props => props.theme.colors.text};
    font-size: 18px;
    font-weight: 600;
  }
  p {
    margin: 0;
    font-size: 14px;
  }
`;
const ErrorMessage = styled.div`
  background: ${props => props.theme.colors.error}20;
  color: ${props => props.theme.colors.error};
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid ${props => props.theme.colors.error}40;
`;
interface ExecutionStats {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  recent_executions_24h: number;
  avg_execution_time: number;
}
interface ExecutionRecord {
  id: string;
  test_name: string;
  status: string;
  success_rate: number;
  started_at: string;
  duration_seconds: number;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
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
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleExecutionClick = (executionId: string) => {
    navigate(`/execution/${executionId}`);
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
      console.error(err);
      setError('Failed to load execution history');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, [testCaseId, promptId]);
  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };
  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };
  if (loading) {
    return (
      <HistoryContainer>
        <HistoryHeader>
          <HistoryTitle>
            <Activity size={24} />
            {title}
          </HistoryTitle>
          <RefreshButton disabled>
            <RefreshCw size={16} />
            Loading...
          </RefreshButton>
        </HistoryHeader>
        <LoadingSpinner>Loading execution history...</LoadingSpinner>
      </HistoryContainer>
    );
  }
  if (error) {
    return (
      <HistoryContainer>
        <HistoryHeader>
          <HistoryTitle>
            <Activity size={24} />
            {title}
          </HistoryTitle>
          <RefreshButton onClick={fetchData}>
            <RefreshCw size={16} />
            Retry
          </RefreshButton>
        </HistoryHeader>
        <ErrorMessage theme={theme}>{error}</ErrorMessage>
      </HistoryContainer>
    );
  }
  return (
    <HistoryContainer theme={theme}>
      <HistoryHeader theme={theme}>
        <HistoryTitle theme={theme}>
          <Activity size={24} />
          {title}
        </HistoryTitle>
        <RefreshButton onClick={fetchData} disabled={loading}>
          <RefreshCw size={16} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </RefreshButton>
      </HistoryHeader>
      {stats && (
        <StatsGrid theme={theme}>
          <StatCard variant="info">
            <StatTitle>
              <Activity size={16} />
              Total Executions
            </StatTitle>
            <StatValue>{stats.total_executions}</StatValue>
            <StatChange positive={stats.recent_executions_24h > 0}>
              <TrendingUp size={14} />
              {stats.recent_executions_24h} in last 24h
            </StatChange>
          </StatCard>
          <StatCard variant="success">
            <StatTitle>
              <CheckCircle size={16} />
              Success Rate
            </StatTitle>
            <StatValue>
              {stats.success_rate > 1 
                ? `${stats.success_rate.toFixed(1)}%` 
                : `${(stats.success_rate * 100).toFixed(1)}%`}
            </StatValue>
            <StatChange positive={stats.success_rate > 0.7}>
              <TrendingUp size={14} />
              {stats.successful_executions}/{stats.total_executions} successful
            </StatChange>
          </StatCard>
          <StatCard variant="danger">
            <StatTitle>
              <XCircle size={16} />
              Failed Executions
            </StatTitle>
            <StatValue>{stats.failed_executions}</StatValue>
            <StatChange positive={false}>
              <TrendingDown size={14} />
              {stats.total_executions > 0 
                ? ((stats.failed_executions / stats.total_executions) * 100).toFixed(1)
                : '0.0'}% failure rate
            </StatChange>
          </StatCard>
          <StatCard variant="warning">
            <StatTitle>
              <Clock size={16} />
              Avg Duration
            </StatTitle>
            <StatValue>{formatDuration(stats.avg_execution_time)}</StatValue>
            <StatChange>
              Average execution time
            </StatChange>
          </StatCard>
        </StatsGrid>
      )}
      <ExecutionList theme={theme}>
        <ExecutionListHeader theme={theme}>
          <Activity size={20} />
          Execution History
        </ExecutionListHeader>
        {executions.length === 0 ? (
          <LoadingSpinner>No execution records found</LoadingSpinner>
        ) : (
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
              <div>Failed</div>
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
                <MetricValue type="error">
                  {execution.failed_steps || Math.max(0, (execution.total_steps || 0) - (execution.passed_steps || 0))}
                </MetricValue>
                <div>
                  <StatusBadge status={execution.status}>
                    {execution.status === 'completed' && <CheckCircle size={12} />}
                    {execution.status === 'failed' && <XCircle size={12} />}
                    {execution.status === 'running' && <Clock size={12} />}
                    {execution.status === 'completed' ? 'Passed' : 
                     execution.status === 'failed' ? 'Failed' : 
                     execution.status}
                  </StatusBadge>
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
        )}
      </ExecutionList>
    </HistoryContainer>
  );
};
export default TestCaseExecutionHistory;