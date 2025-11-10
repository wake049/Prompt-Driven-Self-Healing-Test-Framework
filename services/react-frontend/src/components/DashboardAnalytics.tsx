import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  executionApiService,
  ExecutionTrend,
  FailurePattern,
  ActionFailureRate,
  PerformanceMetrics
} from '../services/executionApiService';
const DashboardContainer = styled.div`
  padding: 24px;
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
`;
const DashboardHeader = styled.div`
  margin-bottom: 32px;
`;
const Title = styled.h1`
  color: ${props => props.theme.colors.text};
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
`;
const Subtitle = styled.p`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 16px;
  margin: 0;
`;
const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
`;
const MetricCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 24px;
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
`;
const MetricTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;
const MetricValue = styled.div`
  color: ${props => props.theme.colors.text};
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
`;
const MetricSubtext = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
`;
const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 32px;
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;
const ChartCard = styled(MetricCard)`
  padding: 24px;
`;
const ChartTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
`;
const TrendChart = styled.div`
  height: 300px;
  display: flex;
  align-items: end;
  gap: 4px;
  padding: 20px 0;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  position: relative;
`;
const TrendBar = styled.div<{ height: number; success: boolean }>`
  flex: 1;
  height: ${props => props.height}%;
  background: ${props => props.success 
    ? props.theme.colors.success 
    : props.theme.colors.error};
  border-radius: 2px 2px 0 0;
  transition: all 0.3s ease;
  position: relative;
  &:hover {
    opacity: 0.8;
  }
`;
const FailuresList = styled.div`
  max-height: 300px;
  overflow-y: auto;
`;
const FailureItem = styled.div`
  padding: 12px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  &:last-child {
    border-bottom: none;
  }
`;
const FailureError = styled.div`
  color: ${props => props.theme.colors.text};
  font-weight: 500;
  margin-bottom: 4px;
  font-size: 14px;
`;
const FailureDetails = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
const FailureBadge = styled.span`
  background: ${props => props.theme.colors.error};
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
`;
const PerformanceTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;
const TableHeader = styled.th`
  text-align: left;
  padding: 12px;
  border-bottom: 2px solid ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.textSecondary};
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
`;
const TableRow = styled.tr`
  &:nth-child(even) {
    background: ${props => props.theme.colors.background};
  }
`;
const TableCell = styled.td`
  padding: 12px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.text};
  font-size: 14px;
`;
const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: ${props => props.theme.colors.textSecondary};
`;
const ErrorMessage = styled.div`
  background: ${props => props.theme.colors.error}20;
  border: 1px solid ${props => props.theme.colors.error};
  color: ${props => props.theme.colors.error};
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
`;
const FilterContainer = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  align-items: center;
`;
const FilterLabel = styled.label`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
  font-weight: 500;
`;
const FilterSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 6px;
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  font-size: 14px;
`;
interface DashboardAnalyticsProps {
  className?: string;
}
export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({ className }) => {
  const [trends, setTrends] = useState<ExecutionTrend[]>([]);
  const [failurePatterns, setFailurePatterns] = useState<FailurePattern[]>([]);
  const [actionFailureRates, setActionFailureRates] = useState<ActionFailureRate[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendDays, setTrendDays] = useState(30);
  const [performanceDays, setPerformanceDays] = useState(7);
  useEffect(() => {
    loadDashboardData();
  }, [trendDays, performanceDays]);
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [trendsData, failureData, performanceData] = await Promise.all([
        executionApiService.getExecutionTrends(trendDays),
        executionApiService.getFailureAnalysis(trendDays, 10),
        executionApiService.getPerformanceMetrics(performanceDays)
      ]);
      
      setTrends(trendsData?.trends || []);
      setFailurePatterns(failureData?.failure_patterns || []);
      setActionFailureRates(failureData?.action_failure_rates || []);
      setPerformanceMetrics(performanceData || null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  const calculateMetrics = () => {
    if (!trends || !trends.length) return { totalExecutions: 0, avgSuccessRate: 0, avgDuration: 0 };
    const totalExecutions = trends.reduce((sum, trend) => sum + trend.total_executions, 0);
    const avgSuccessRate = trends.reduce((sum, trend) => sum + trend.success_rate, 0) / trends.length;
    const avgDuration = trends.reduce((sum, trend) => sum + trend.avg_duration_seconds, 0) / trends.length;
    return { totalExecutions, avgSuccessRate, avgDuration };
  };
  const { totalExecutions, avgSuccessRate, avgDuration } = calculateMetrics();
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };
  if (loading) {
    return (
      <DashboardContainer className={className}>
        <LoadingSpinner>Loading dashboard analytics...</LoadingSpinner>
      </DashboardContainer>
    );
  }
  if (error) {
    return (
      <DashboardContainer className={className}>
        <ErrorMessage>{error}</ErrorMessage>
      </DashboardContainer>
    );
  }
  return (
    <DashboardContainer className={className}>
      <DashboardHeader>
        <Title>Execution Analytics Dashboard</Title>
        <Subtitle>Comprehensive test execution insights and performance metrics</Subtitle>
      </DashboardHeader>
      <FilterContainer>
        <FilterLabel>Trend Period:</FilterLabel>
        <FilterSelect 
          value={trendDays} 
          onChange={(e) => setTrendDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </FilterSelect>
        <FilterLabel>Performance Period:</FilterLabel>
        <FilterSelect 
          value={performanceDays} 
          onChange={(e) => setPerformanceDays(Number(e.target.value))}
        >
          <option value={1}>Last 24 hours</option>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </FilterSelect>
      </FilterContainer>
      <MetricsGrid>
        <MetricCard>
          <MetricTitle>Total Executions</MetricTitle>
          <MetricValue>{totalExecutions.toLocaleString()}</MetricValue>
          <MetricSubtext>Last {trendDays} days</MetricSubtext>
        </MetricCard>
        <MetricCard>
          <MetricTitle>Success Rate</MetricTitle>
          <MetricValue>{avgSuccessRate.toFixed(1)}%</MetricValue>
          <MetricSubtext>Average across period</MetricSubtext>
        </MetricCard>
        <MetricCard>
          <MetricTitle>Avg Duration</MetricTitle>
          <MetricValue>{formatDuration(avgDuration)}</MetricValue>
          <MetricSubtext>Per execution</MetricSubtext>
        </MetricCard>
        {performanceMetrics && performanceMetrics.execution_performance?.p95_duration !== undefined && (
          <MetricCard>
            <MetricTitle>P95 Duration</MetricTitle>
            <MetricValue>{formatDuration(performanceMetrics.execution_performance.p95_duration)}</MetricValue>
            <MetricSubtext>95th percentile</MetricSubtext>
          </MetricCard>
        )}
      </MetricsGrid>
      <ChartsGrid>
        <ChartCard>
          <ChartTitle>Execution Trends</ChartTitle>
          <TrendChart>
            {trends && trends.length > 0 ? trends.slice(0, 20).reverse().map((trend, index) => {
              const maxExecutions = Math.max(...trends.map(t => t.total_executions));
              const height = maxExecutions > 0 ? (trend.total_executions / maxExecutions) * 100 : 0;
              return (
                <TrendBar
                  key={index}
                  height={height}
                  success={trend.success_rate >= 80}
                  title={`${trend.date}: ${trend.total_executions} executions (${trend.success_rate}% success)`}
                />
              );
            }) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                No trend data available
              </div>
            )}
          </TrendChart>
        </ChartCard>
        <ChartCard>
          <ChartTitle>Top Failure Patterns</ChartTitle>
          <FailuresList>
            {failurePatterns && failurePatterns.length > 0 ? failurePatterns.slice(0, 10).map((pattern, index) => (
              <FailureItem key={index}>
                <FailureError>
                  {pattern.action}: {pattern.error_message?.substring(0, 60) || 'Step execution failed'}
                  {pattern.error_message && pattern.error_message.length > 60 && '...'}
                </FailureError>
                <FailureDetails>
                  <span>{pattern.affected_executions} executions affected</span>
                  <FailureBadge>{pattern.failure_count} failures</FailureBadge>
                </FailureDetails>
              </FailureItem>
            )) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                No failure patterns available
              </div>
            )}
          </FailuresList>
        </ChartCard>
      </ChartsGrid>
      {performanceMetrics && performanceMetrics.action_performance && performanceMetrics.action_performance.length > 0 && (
        <ChartCard>
          <ChartTitle>Action Performance Analysis</ChartTitle>
          <PerformanceTable>
            <thead>
              <tr>
                <TableHeader>Action</TableHeader>
                <TableHeader>Total Actions</TableHeader>
                <TableHeader>Avg Duration</TableHeader>
                <TableHeader>Min Duration</TableHeader>
                <TableHeader>Max Duration</TableHeader>
                <TableHeader>P95 Duration</TableHeader>
              </tr>
            </thead>
            <tbody>
              {performanceMetrics.action_performance.map((action: any, index: number) => (
                <TableRow key={index}>
                  <TableCell>{action.action_type}</TableCell>
                  <TableCell>{action.total_actions.toLocaleString()}</TableCell>
                  <TableCell>{formatDuration(action.avg_duration / 1000)}</TableCell>
                  <TableCell>{formatDuration(action.min_duration / 1000)}</TableCell>
                  <TableCell>{formatDuration(action.max_duration / 1000)}</TableCell>
                  <TableCell>{formatDuration(action.p95_duration / 1000)}</TableCell>
                </TableRow>
              ))}
            </tbody>
          </PerformanceTable>
        </ChartCard>
      )}
      {actionFailureRates.length > 0 && (
        <ChartCard>
          <ChartTitle>Action Failure Rates</ChartTitle>
          <PerformanceTable>
            <thead>
              <tr>
                <TableHeader>Action</TableHeader>
                <TableHeader>Total Attempts</TableHeader>
                <TableHeader>Failures</TableHeader>
                <TableHeader>Failure Rate</TableHeader>
              </tr>
            </thead>
            <tbody>
              {actionFailureRates.map((action, index) => (
                <TableRow key={index}>
                  <TableCell>{action.action}</TableCell>
                  <TableCell>{action.total_attempts.toLocaleString()}</TableCell>
                  <TableCell>{action.failures.toLocaleString()}</TableCell>
                  <TableCell>
                    <FailureBadge>{action.failure_rate.toFixed(1)}%</FailureBadge>
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </PerformanceTable>
        </ChartCard>
      )}
    </DashboardContainer>
  );
};