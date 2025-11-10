import React, { useState, useEffect, useMemo } from 'react';
import { MCPFrontendManager } from '../../../services/mcpFrontendClient';
import styled from 'styled-components';
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  AlertTriangle,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  Activity,
  Zap
} from 'lucide-react';

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
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
`;

const MetricCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 24px;
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: relative;
`;

const MetricHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const MetricTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MetricIcon = styled.div<{ $type: 'success' | 'warning' | 'error' | 'info' }>`
  padding: 8px;
  border-radius: 8px;
  background: ${props => {
    switch (props.$type) {
      case 'success': return props.theme.colors.success + '20';
      case 'warning': return '#f59e0b20';
      case 'error': return props.theme.colors.error + '20';
      default: return props.theme.colors.primary + '20';
    }
  }};
  color: ${props => {
    switch (props.$type) {
      case 'success': return props.theme.colors.success;
      case 'warning': return '#f59e0b';
      case 'error': return props.theme.colors.error;
      default: return props.theme.colors.primary;
    }
  }};
`;

const MetricValue = styled.div`
  color: ${props => props.theme.colors.text};
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 12px;
`;

const MetricTrend = styled.div<{ $positive: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.$positive ? props.theme.colors.success : props.theme.colors.error};
`;

const MetricSubtext = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 12px;
  margin-top: 4px;
`;

const FilterContainer = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  align-items: center;
  flex-wrap: wrap;
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
  min-width: 120px;
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
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
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TrendChart = styled.div`
  height: 300px;
  display: flex;
  align-items: end;
  gap: 3px;
  padding: 20px 0;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  position: relative;
  overflow-x: auto;
`;

const TrendBar = styled.div<{ height: number; success: boolean; healing: boolean }>`
  min-width: 12px;
  height: ${props => Math.max(props.height, 2)}%;
  background: ${props => {
    if (props.healing) return '#3b82f6'; // Blue for healing attempts
    return props.success ? props.theme.colors.success : props.theme.colors.error;
  }};
  border-radius: 2px 2px 0 0;
  transition: all 0.3s ease;
  position: relative;
  cursor: pointer;
  
  &:hover {
    opacity: 0.8;
    transform: translateY(-2px);
  }
`;

const DonutChart = styled.div`
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: conic-gradient(
    ${props => props.theme.colors.success} 0deg,
    ${props => props.theme.colors.success} var(--success-deg, 180deg),
    #f59e0b var(--success-deg, 180deg),
    #f59e0b var(--partial-deg, 270deg),
    ${props => props.theme.colors.error} var(--partial-deg, 270deg),
    ${props => props.theme.colors.error} 360deg
  );
  margin: 0 auto 20px;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 120px;
    height: 120px;
    background: ${props => props.theme.colors.surface};
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }
`;

const DonutCenter = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 1;
`;

const DonutValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
`;

const DonutLabel = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  text-transform: uppercase;
`;

const Legend = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
`;

const LegendColor = styled.div<{ color: string }>`
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: ${props => props.color};
`;

const DetailTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
`;

const TableHeader = styled.th`
  text-align: left;
  padding: 12px 8px;
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
  
  &:hover {
    background: ${props => props.theme.colors.border}30;
  }
`;

const TableCell = styled.td`
  padding: 12px 8px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.text};
  font-size: 14px;
`;

const StatusBadge = styled.span<{ $status: 'success' | 'partial' | 'failed' | 'healing' }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: ${props => {
    switch (props.$status) {
      case 'success': return props.theme.colors.success + '20';
      case 'partial': return '#f59e0b20';
      case 'failed': return props.theme.colors.error + '20';
      case 'healing': return '#3b82f620';
      default: return props.theme.colors.border;
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'success': return props.theme.colors.success;
      case 'partial': return '#f59e0b';
      case 'failed': return props.theme.colors.error;
      case 'healing': return '#3b82f6';
      default: return props.theme.colors.textSecondary;
    }
  }};
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

const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  min-height: 400px;
`;

const EmptyStateIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 24px;
`;

const EmptyStateTitle = styled.h3`
  margin: 0 0 12px 0;
  color: ${props => props.theme.colors.text};
  font-size: 20px;
  font-weight: 600;
`;

const EmptyStateDescription = styled.p`
  margin: 0;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
  line-height: 1.6;
  max-width: 500px;
`;

// Mock data interfaces
interface HealingMetrics {
  totalAttempts: number;
  successfulHealing: number;
  partialHealing: number;
  failedHealing: number;
  successRate: number;
  avgHealingTime: number;
  trendData: DailyHealingData[];
}

interface DailyHealingData {
  date: string;
  attempts: number;
  successful: number;
  partial: number;
  failed: number;
  avgTime: number;
}

interface HealingDetail {
  id: string;
  timestamp: string;
  element: string;
  issue: string;
  action: string;
  status: 'success' | 'partial' | 'failed' | 'healing';
  timeToHeal: number;
  page: string;
}

const HealingSuccessVisualization: React.FC = () => {
  const [metrics, setMetrics] = useState<HealingMetrics | null>(null);
  const [healingDetails, setHealingDetails] = useState<HealingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(30);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pageFilter, setPageFilter] = useState('all');

  useEffect(() => {
    loadHealingData();
  }, [timeRange, statusFilter, pageFilter]);

  const loadHealingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Convert days to timeRange format for MCP
      const timeRangeMap: { [key: number]: string } = {
        1: "24h",
        7: "7d", 
        30: "30d"
      };
      const timeRangeStr = timeRangeMap[timeRange] || "24h";
      
      // Fetch healing analytics from MCP server
      const mcpClient = await MCPFrontendManager.getInstance();
      const healingData = await mcpClient.getHealingAnalytics(timeRangeStr);
      
      if (healingData.success && healingData.healing_metrics) {
        const metrics: HealingMetrics = {
          totalAttempts: healingData.healing_metrics.total_attempts,
          successfulHealing: healingData.healing_metrics.successful_healing,
          partialHealing: healingData.healing_metrics.partial_healing,
          failedHealing: healingData.healing_metrics.failed_healing,
          successRate: healingData.healing_metrics.success_rate,
          avgHealingTime: healingData.healing_metrics.avg_healing_time,
          trendData: healingData.healing_metrics.trend_data || []
        };
        
        setMetrics(metrics);
        
        // Map healing details from API response
        const details: HealingDetail[] = healingData.healing_details?.map((detail: any) => ({
          id: detail.id,
          timestamp: detail.timestamp,
          element: detail.element,
          issue: detail.issue,
          action: detail.action,
          status: detail.status === 'completed' ? 'success' : 
                 detail.status === 'partial' ? 'partial' : 
                 detail.status === 'failed' ? 'failed' : 'healing',
          timeToHeal: detail.time_to_heal,
          page: detail.page
        })) || [];
        
        setHealingDetails(details);
      } else {
        // No data available - show empty state
        setMetrics({
          totalAttempts: 0,
          successfulHealing: 0,
          partialHealing: 0,
          failedHealing: 0,
          successRate: 0,
          avgHealingTime: 0,
          trendData: []
        });
        setHealingDetails([]);
      }
      
    } catch (err: any) {
      setError('Failed to load healing data. Please check your connection and try again.');
      
      // Set empty state on error
      setMetrics({
        totalAttempts: 0,
        successfulHealing: 0,
        partialHealing: 0,
        failedHealing: 0,
        successRate: 0,
        avgHealingTime: 0,
        trendData: []
      });
      setHealingDetails([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredDetails = healingDetails.filter(detail => {
    const statusMatch = statusFilter === 'all' || detail.status === statusFilter;
    const pageMatch = pageFilter === 'all' || detail.page === pageFilter;
    return statusMatch && pageMatch;
  });

  const pages = Array.from(new Set(healingDetails.map(d => d.page)));

  if (loading) {
    return (
      <DashboardContainer>
        <LoadingSpinner>Loading healing analytics...</LoadingSpinner>
      </DashboardContainer>
    );
  }

  if (error) {
    return (
      <DashboardContainer>
        <ErrorMessage>{error}</ErrorMessage>
      </DashboardContainer>
    );
  }

  if (!metrics || metrics.totalAttempts === 0) {
    return (
      <DashboardContainer>
        <DashboardHeader>
          <Title>Healing Success Analytics</Title>
          <Subtitle>Comprehensive visualization of self-healing capabilities and success rates</Subtitle>
        </DashboardHeader>
        <EmptyStateContainer>
          <EmptyStateIcon>
            <Activity size={48} />
          </EmptyStateIcon>
          <EmptyStateTitle>No Healing Data Available</EmptyStateTitle>
          <EmptyStateDescription>
            Self-healing analytics will appear here once your tests start running and the system begins attempting to heal failures. 
            This dashboard will show success rates, healing patterns, and trends over time.
          </EmptyStateDescription>
        </EmptyStateContainer>
      </DashboardContainer>
    );
  }

  const successDegrees = (metrics.successfulHealing / metrics.totalAttempts) * 360;
  const partialDegrees = ((metrics.successfulHealing + metrics.partialHealing) / metrics.totalAttempts) * 360;

  return (
    <DashboardContainer>
      <DashboardHeader>
        <Title>Healing Success Analytics</Title>
        <Subtitle>Comprehensive visualization of self-healing capabilities and success rates</Subtitle>
      </DashboardHeader>

      <FilterContainer>
        <FilterLabel>Time Range:</FilterLabel>
        <FilterSelect value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </FilterSelect>

        <FilterLabel>Status:</FilterLabel>
        <FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="success">Successful</option>
          <option value="partial">Partial</option>
          <option value="failed">Failed</option>
          <option value="healing">In Progress</option>
        </FilterSelect>

        <FilterLabel>Page:</FilterLabel>
        <FilterSelect value={pageFilter} onChange={(e) => setPageFilter(e.target.value)}>
          <option value="all">All Pages</option>
          {pages.map(page => (
            <option key={page} value={page}>{page}</option>
          ))}
        </FilterSelect>
      </FilterContainer>

      <MetricsGrid>
        <MetricCard>
          <MetricHeader>
            <MetricTitle>Total Healing Attempts</MetricTitle>
            <MetricIcon $type="info">
              <Activity size={16} />
            </MetricIcon>
          </MetricHeader>
          <MetricValue>{metrics.totalAttempts.toLocaleString()}</MetricValue>
          <MetricTrend $positive={true}>
            <TrendingUp size={14} />
            +12.5%
          </MetricTrend>
          <MetricSubtext>vs last period</MetricSubtext>
        </MetricCard>

        <MetricCard>
          <MetricHeader>
            <MetricTitle>Success Rate</MetricTitle>
            <MetricIcon $type="success">
              <CheckCircle size={16} />
            </MetricIcon>
          </MetricHeader>
          <MetricValue>{metrics.successRate.toFixed(1)}%</MetricValue>
          <MetricTrend $positive={true}>
            <TrendingUp size={14} />
            +3.2%
          </MetricTrend>
          <MetricSubtext>vs last period</MetricSubtext>
        </MetricCard>

        <MetricCard>
          <MetricHeader>
            <MetricTitle>Avg Healing Time</MetricTitle>
            <MetricIcon $type="warning">
              <RotateCcw size={16} />
            </MetricIcon>
          </MetricHeader>
          <MetricValue>{metrics.avgHealingTime.toFixed(1)}s</MetricValue>
          <MetricTrend $positive={false}>
            <TrendingDown size={14} />
            +0.3s
          </MetricTrend>
          <MetricSubtext>vs last period</MetricSubtext>
        </MetricCard>

        <MetricCard>
          <MetricHeader>
            <MetricTitle>Failed Healing</MetricTitle>
            <MetricIcon $type="error">
              <XCircle size={16} />
            </MetricIcon>
          </MetricHeader>
          <MetricValue>{metrics.failedHealing}</MetricValue>
          <MetricTrend $positive={true}>
            <TrendingDown size={14} />
            -8.4%
          </MetricTrend>
          <MetricSubtext>vs last period</MetricSubtext>
        </MetricCard>
      </MetricsGrid>

      <ChartsGrid>
        <ChartCard>
          <ChartTitle>
            <BarChart3 size={18} />
            Healing Success Trends
          </ChartTitle>
          <TrendChart>
            {metrics.trendData.map((day, index) => {
              const maxAttempts = Math.max(...metrics.trendData.map(d => d.attempts));
              const height = (day.attempts / maxAttempts) * 100;
              const successRate = (day.successful / day.attempts) * 100;
              
              return (
                <TrendBar
                  key={index}
                  height={height}
                  success={successRate >= 75}
                  healing={false}
                  title={`${day.date}: ${day.attempts} attempts, ${successRate.toFixed(1)}% success`}
                />
              );
            })}
          </TrendChart>
        </ChartCard>

        <ChartCard>
          <ChartTitle>
            <PieChart size={18} />
            Healing Outcomes
          </ChartTitle>
          <DonutChart
            style={{
              '--success-deg': `${successDegrees}deg`,
              '--partial-deg': `${partialDegrees}deg`
            } as React.CSSProperties}
          >
            <DonutCenter>
              <DonutValue>{metrics.successRate.toFixed(1)}%</DonutValue>
              <DonutLabel>Success Rate</DonutLabel>
            </DonutCenter>
          </DonutChart>
          
          <Legend>
            <LegendItem>
              <LegendColor color="#10b981" />
              <span>Successful ({metrics.successfulHealing})</span>
            </LegendItem>
            <LegendItem>
              <LegendColor color="#f59e0b" />
              <span>Partial ({metrics.partialHealing})</span>
            </LegendItem>
            <LegendItem>
              <LegendColor color="#ef4444" />
              <span>Failed ({metrics.failedHealing})</span>
            </LegendItem>
          </Legend>
        </ChartCard>
      </ChartsGrid>

      <ChartCard>
        <ChartTitle>
          <AlertTriangle size={18} />
          Recent Healing Activities
        </ChartTitle>
        
        <DetailTable>
          <thead>
            <tr>
              <TableHeader>Timestamp</TableHeader>
              <TableHeader>Element</TableHeader>
              <TableHeader>Issue</TableHeader>
              <TableHeader>Page</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Time to Heal</TableHeader>
            </tr>
          </thead>
          <tbody>
            {filteredDetails.slice(0, 15).map((detail) => (
              <TableRow key={detail.id}>
                <TableCell>
                  {new Date(detail.timestamp).toLocaleString()}
                </TableCell>
                <TableCell>{detail.element}</TableCell>
                <TableCell>{detail.issue}</TableCell>
                <TableCell>{detail.page}</TableCell>
                <TableCell>
                  <StatusBadge $status={detail.status}>
                    {detail.status}
                  </StatusBadge>
                </TableCell>
                <TableCell>{detail.timeToHeal.toFixed(1)}s</TableCell>
              </TableRow>
            ))}
          </tbody>
        </DetailTable>
      </ChartCard>
    </DashboardContainer>
  );
};

export default HealingSuccessVisualization;