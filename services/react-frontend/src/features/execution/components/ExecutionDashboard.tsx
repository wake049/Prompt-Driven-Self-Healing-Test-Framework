import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import unifiedApiClient from '../../../shared/utils/unifiedApiClient';
import ExecutionStepsModal from './ExecutionStepsModal';
import { executionApiService } from '../api';
import { useAuth } from '../../../contexts/AuthContext';

const DashboardContainer = styled.div`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
`;

const DashboardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
`;

const DashboardTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #212529;
  margin: 0;
`;

const RefreshButton = styled.button`
  background: #0066cc;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;

  &:hover {
    background: #0052a3;
  }

  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const StatTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: #6c757d;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: #212529;
  margin-bottom: 4px;
`;

const StatChange = styled.div<{ positive?: boolean }>`
  font-size: 14px;
  color: ${props => props.positive ? '#28a745' : '#dc3545'};
  font-weight: 500;
`;

const ExecutionList = styled.div`
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
`;

const ExecutionListHeader = styled.div`
  background: #f8f9fa;
  padding: 16px 24px;
  border-bottom: 1px solid #e9ecef;
  font-weight: 600;
  color: #495057;
`;

const ExecutionItem = styled.div<{ clickable?: boolean }>`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 120px;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #f8f9fa;
  transition: background 0.2s ease;
  cursor: ${props => props.clickable ? 'pointer' : 'default'};

  &:hover {
    background: ${props => props.clickable ? '#e3f2fd' : '#f8f9fa'};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const StatusBadge = styled.span<{ status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  background: ${props => {
    switch (props.status) {
      case 'success': return '#d4edda';
      case 'completed': return '#d4edda';
      case 'running': return '#fff3cd';
      case 'failed': return '#f8d7da';
      case 'error': return '#f8d7da';
      default: return '#e2e3e5';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'success': return '#155724';
      case 'completed': return '#155724';
      case 'running': return '#856404';
      case 'failed': return '#721c24';
      case 'error': return '#721c24';
      default: return '#383d41';
    }
  }};
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  font-size: 16px;
  color: #6c757d;
`;

const ErrorMessage = styled.div`
  background: #f8d7da;
  color: #721c24;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 20px;
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
  execution_id: string;
  test_name: string;
  status: string;
  success_rate: number;
  start_time: string;
  duration?: number;
  steps_completed?: number;
  total_steps?: number;
}

const ExecutionDashboard: React.FC = () => {
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch real execution statistics from authenticated API
      const statsData = await executionApiService.getExecutionStats();
      const realStats: ExecutionStats = {
        total_executions: statsData.total_executions || 0,
        successful_executions: statsData.successful_executions || 0,
        failed_executions: statsData.failed_executions || 0,
        success_rate: (statsData.success_rate || 0) / 100, // API sends percentages, convert to decimal for internal use
        recent_executions_24h: statsData.recent_executions_24h || 0,
        avg_execution_time: statsData.avg_execution_time || 0
      };
      setStats(realStats);

      // Fetch real execution logs from authenticated API
      const executionsData = await executionApiService.getRecentExecutions({ limit: 20 });
      const realExecutions: ExecutionRecord[] = executionsData.map((exec: any) => ({
        execution_id: exec.id || 'unknown',
        test_name: exec.test_name || 'Unknown Test',
        status: exec.status || 'unknown',
        success_rate: (exec.success_rate || 0) / 100, // API now sends percentages, convert to decimal for internal use
        start_time: exec.started_at || new Date().toISOString(),
        duration: exec.duration_seconds || 0,
        steps_completed: exec.passed_steps || 0,
        total_steps: exec.total_steps || 0
      }));
      setExecutions(realExecutions);

    } catch (err) {
      console.error('Error fetching real dashboard data:', err);
      
      // Fallback to mock data if API fails
      console.log('Falling back to mock data...');
      const mockStats: ExecutionStats = {
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        success_rate: 0,
        recent_executions_24h: 0,
        avg_execution_time: 0
      };
      setStats(mockStats);
      setExecutions([]);
      
      setError('Could not connect to execution database. Showing empty dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

  const handleExecutionClick = (executionId: string) => {
    setSelectedExecutionId(executionId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedExecutionId(null);
  };

  if (loading) {
    return (
      <DashboardContainer>
        <LoadingSpinner>Loading execution dashboard...</LoadingSpinner>
      </DashboardContainer>
    );
  }

  return (
    <DashboardContainer>
      <DashboardHeader>
        <DashboardTitle> Execution Dashboard</DashboardTitle>
        <RefreshButton onClick={fetchDashboardData} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </RefreshButton>
      </DashboardHeader>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      {stats && (
        <StatsGrid>
          <StatCard>
            <StatTitle>Total Executions</StatTitle>
            <StatValue>{stats.total_executions}</StatValue>
            <StatChange positive={stats.recent_executions_24h > 0}>
              {stats.recent_executions_24h} in last 24h
            </StatChange>
          </StatCard>

          <StatCard>
            <StatTitle>Success Rate</StatTitle>
            <StatValue>{(stats.success_rate * 100).toFixed(1)}%</StatValue>
            <StatChange positive={stats.success_rate > 0.7}>
              {stats.successful_executions}/{stats.total_executions} successful
            </StatChange>
          </StatCard>

          <StatCard>
            <StatTitle>Failed Executions</StatTitle>
            <StatValue>{stats.failed_executions}</StatValue>
            <StatChange positive={false}>
              {((stats.failed_executions / stats.total_executions) * 100).toFixed(1)}% failure rate
            </StatChange>
          </StatCard>

          <StatCard>
            <StatTitle>Avg Duration</StatTitle>
            <StatValue>{formatDuration(stats.avg_execution_time)}</StatValue>
            <StatChange>
              Average execution time
            </StatChange>
          </StatCard>
        </StatsGrid>
      )}

      <ExecutionList>
        <ExecutionListHeader>
          Recent Test Executions
        </ExecutionListHeader>
        
        {executions.length === 0 ? (
          <LoadingSpinner>No execution records found</LoadingSpinner>
        ) : (
          <>
            <ExecutionItem style={{ background: '#f8f9fa', fontWeight: 600 }}>
              <div>Test Name</div>
              <div>Status</div>
              <div>Success Rate</div>
              <div>Duration</div>
              <div>Started</div>
            </ExecutionItem>
            
            {executions.map((execution) => (
              <ExecutionItem 
                key={execution.execution_id}
                clickable={true}
                onClick={() => handleExecutionClick(execution.execution_id)}
              >
                <div>
                  <strong>{execution.test_name || 'Test Execution'}</strong>
                  <br />
                  <small style={{ color: '#6c757d' }}>
                    ID: {execution.execution_id ? execution.execution_id.substring(0, 8) + '...' : 'N/A'}
                  </small>
                </div>
                <div>
                  <StatusBadge status={execution.status}>
                    {execution.status}
                  </StatusBadge>
                </div>
                <div>
                  {execution.success_rate ? `${(execution.success_rate * 100).toFixed(1)}%` : 'N/A'}
                  {execution.steps_completed && execution.total_steps && (
                    <div>
                      <small style={{ color: '#6c757d' }}>
                        {execution.steps_completed}/{execution.total_steps} steps
                      </small>
                    </div>
                  )}
                </div>
                <div>{formatDuration(execution.duration)}</div>
                <div>{formatDateTime(execution.start_time)}</div>
              </ExecutionItem>
            ))}
          </>
        )}
      </ExecutionList>

      {/* Modal for execution step details */}
      {selectedExecutionId && (
        <ExecutionStepsModal
          executionId={selectedExecutionId}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </DashboardContainer>
  );
};

export default ExecutionDashboard;