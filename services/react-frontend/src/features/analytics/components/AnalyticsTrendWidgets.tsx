import React, { useState, useEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';
import { useTheme } from '../../../contexts/ThemeContext';
import { config } from '../../../app/config';
import SimpleLineChart from '../../../components/charts/SimpleLineChart';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  BarChart3, 
  LineChart, 
  PieChart,
  RefreshCw,
  Filter,
  Calendar,
  Download,
  Maximize2
} from 'lucide-react';

// ================================
// Types
// ================================
interface TrendDataPoint {
  timestamp: string;
  value: number;
  label?: string;
  category?: string;
}

interface TrendAnalysis {
  trend: 'up' | 'down' | 'stable';
  percentage_change: number;
  significance: 'high' | 'medium' | 'low';
  insights: string[];
}

interface PerformanceTrend {
  metric_name: string;
  data_points: TrendDataPoint[];
  analysis: TrendAnalysis;
  threshold_breaches: number;
  recommendations: string[];
}

interface FailurePattern {
  pattern_id: string;
  error_type: string;
  frequency: number;
  trend: TrendDataPoint[];
  affected_components: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}

// ================================
// Styled Components
// ================================
const Container = styled.div<{ theme: any }>`
  padding: 32px;
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
  
  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const Header = styled.div<{ theme: any }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 20px;
    align-items: flex-start;
    margin-bottom: 32px;
  }
`;

const Title = styled.h1<{ theme: any }>`
  color: ${props => props.theme.colors.text};
  font-size: 2.2rem;
  font-weight: 700;
  margin: 0;
  background: #185FA5;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const ControlPanel = styled.div<{ theme: any }>`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const ControlButton = styled.button<{ theme: any; $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid ${props => props.$active ? '#185FA5' : props.theme.colors.border};
  border-radius: 8px;
  background: ${props => props.$active ? 'rgba(102, 126, 234, 0.1)' : props.theme.colors.surface};
  color: ${props => props.$active ? '#185FA5' : props.theme.colors.text};
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  font-weight: 500;
  
  &:hover {
    border-color: #185FA5;
    background: rgba(102, 126, 234, 0.05);
  }
`;

const WidgetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: 32px;
  margin-bottom: 40px;
  
  @media (max-width: 1400px) {
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 28px;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 24px;
  }
`;

const Widget = styled.div<{ theme: any; size?: 'small' | 'medium' | 'large' }>`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: ${props => props.theme.shadows.medium};
  overflow: hidden;
  transition: all 0.3s ease;
  
  ${props => props.size === 'large' && `
    grid-column: span 2;
  `}
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.large};
  }
`;

const WidgetHeader = styled.div<{ theme: any }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
`;

const WidgetTitle = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const WidgetTitleText = styled.h3<{ theme: any }>`
  margin: 0;
  color: ${props => props.theme.colors.text};
  font-size: 1.1rem;
  font-weight: 600;
`;

const WidgetActions = styled.div`
  display: flex;
  gap: 8px;
`;

const WidgetActionButton = styled.button<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${props => props.theme.colors.textSecondary};
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: ${props => props.theme.colors.border};
    color: ${props => props.theme.colors.text};
  }
`;

const WidgetContent = styled.div`
  padding: 28px;
  
  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const TrendIndicator = styled.div<{ $trend: string; theme: any }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  
  background: ${props => {
    switch (props.$trend) {
      case 'up': return 'rgba(72, 187, 120, 0.1)';
      case 'down': return 'rgba(245, 101, 101, 0.1)';
      default: return 'rgba(102, 126, 234, 0.1)';
    }
  }};
  
  color: ${props => {
    switch (props.$trend) {
      case 'up': return '#2f855a';
      case 'down': return '#c53030';
      default: return '#185FA5';
    }
  }};
`;

const MetricGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
`;

const MetricCard = styled.div<{ theme: any }>`
  padding: 18px;
  background: ${props => props.theme.colors.background};
  border-radius: 10px;
  border: 1px solid ${props => props.theme.colors.border};
  text-align: center;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: rgba(102, 126, 234, 0.3);
    background: ${props => props.theme.colors.surface};
  }
`;

const MetricValue = styled.div<{ theme: any }>`
  font-size: 1.8rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 4px;
`;

const MetricLabel = styled.div<{ theme: any }>`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
`;

const ChartContainer = styled.div<{ height?: string }>`
  height: ${props => props.height || '320px'};
  width: 100%;
  position: relative;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.02) 0%, rgba(118, 75, 162, 0.02) 100%);
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
  border: 1px solid rgba(102, 126, 234, 0.08);
`;

const SimpleChart = styled.div<{ theme: any }>`
  width: 100%;
  height: 200px;
  position: relative;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
  border: 1px solid ${props => props.theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme.colors.textSecondary};
  font-style: italic;
`;

const InsightsList = styled.div`
  margin-top: 24px;
`;

const InsightItem = styled.div<{ theme: any; $severity?: string }>`
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  margin-bottom: 12px;
  background: ${props => {
    switch (props.$severity) {
      case 'critical': return 'rgba(245, 101, 101, 0.05)';
      case 'high': return 'rgba(237, 137, 54, 0.05)';
      case 'medium': return 'rgba(102, 126, 234, 0.05)';
      default: return props.theme.colors.background;
    }
  }};
  border-radius: 10px;
  border: 1px solid ${props => props.theme.colors.border};
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const InsightIcon = styled.div<{ $severity?: string }>`
  color: ${props => {
    switch (props.$severity) {
      case 'critical': return '#c53030';
      case 'high': return '#dd6b20';
      case 'medium': return '#185FA5';
      default: return '#68d391';
    }
  }};
  margin-top: 2px;
`;

const InsightText = styled.div<{ theme: any }>`
  flex: 1;
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  line-height: 1.5;
`;

const RecommendationCard = styled.div<{ theme: any }>`
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  padding: 20px;
  margin-top: 20px;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: rgba(102, 126, 234, 0.2);
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  }
`;

const RecommendationTitle = styled.h4<{ theme: any }>`
  margin: 0 0 12px 0;
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RecommendationList = styled.ul<{ theme: any }>`
  margin: 0;
  padding-left: 20px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 13px;
  line-height: 1.6;
`;

const LoadingState = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: ${props => props.theme.colors.textSecondary};
  gap: 12px;
`;

const ErrorState = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #c53030;
  background: rgba(245, 101, 101, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(245, 101, 101, 0.2);
  margin: 16px 0;
`;

const EmptyState = styled.div<{ theme: any }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
`;

const EmptyIcon = styled.div<{ theme: any }>`
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

const EmptyTitle = styled.h3<{ theme: any }>`
  margin: 0 0 12px 0;
  color: ${props => props.theme.colors.text};
  font-size: 18px;
  font-weight: 600;
`;

const EmptyDescription = styled.p<{ theme: any }>`
  margin: 0;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
  line-height: 1.6;
  max-width: 400px;
`;

// ================================
// Component
// ================================
const AnalyticsTrendWidgets: React.FC = () => {
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Real data state
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);

  const [failurePatterns, setFailurePatterns] = useState<FailurePattern[]>([]);

  const refreshData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem(config.authTokenKey);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(
        `${config.apiBaseUrl}/api/analytics/trends?timeRange=${encodeURIComponent(timeRange)}`,
        { headers }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();

      // Normalize REST response to PerformanceTrend interface
      const rawTrends: any[] = Array.isArray(data.performance_trends) ? data.performance_trends : [];
      const temporalData: any[] = Array.isArray(data.temporal_data) ? data.temporal_data : [];

      const normalized: PerformanceTrend[] = rawTrends.map((t: any) => ({
        metric_name: t.metric_name ?? t.metric ?? 'Metric',
        data_points: temporalData.map((pt: any) => ({
          timestamp: pt.timestamp,
          value: t.metric_name === 'Success Rate' || t.metric === 'Success Rate'
            ? (pt.success_rate ?? 0)
            : t.metric_name === 'Avg Execution Time' || t.metric === 'Avg Execution Time'
              ? (pt.avg_duration ?? 0)
              : (pt.total_runs ?? 0),
        })),
        analysis: {
          trend: (t.trend === 'up' ? 'up' : t.trend === 'down' ? 'down' : 'stable') as 'up' | 'down' | 'stable',
          percentage_change: t.change ?? 0,
          significance: 'medium' as const,
          insights: [],
        },
        threshold_breaches: 0,
        recommendations: [],
      }));

      setPerformanceTrends(normalized);
      setFailurePatterns([]);

    } catch (err) {
      setError('Failed to load analytics data');
      setPerformanceTrends([]);
      setFailurePatterns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load initial data
    refreshData();
  }, [timeRange]);

  useEffect(() => {
    if (autoRefresh) {
      refreshInterval.current = setInterval(() => {
        refreshData();
      }, 30000); // Refresh every 30 seconds
    } else {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [autoRefresh]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp size={16} />;
      case 'down': return <TrendingDown size={16} />;
      default: return <Activity size={16} />;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle size={16} />;
      case 'high': return <AlertTriangle size={16} />;
      case 'medium': return <AlertTriangle size={16} />;
      default: return <CheckCircle size={16} />;
    }
  };

  const formatTrendValue = (value: number, metricName: string | undefined) => {
    const name = metricName ?? '';
    if (name.includes('Rate') || name.includes('Percentage')) {
      return `${value.toFixed(1)}%`;
    }
    if (name.includes('Time')) {
      return `${value.toFixed(0)}ms`;
    }
    return value.toFixed(1);
  };

  return (
    <Container theme={theme}>
      <Header theme={theme}>
        <Title theme={theme}>Analytics Trend Detection</Title>
        <ControlPanel theme={theme}>
          <ControlButton
            theme={theme}
            $active={timeRange === '1h'}
            onClick={() => setTimeRange('1h')}
          >
            <Calendar size={14} />
            1 Hour
          </ControlButton>
          <ControlButton
            theme={theme}
            $active={timeRange === '24h'}
            onClick={() => setTimeRange('24h')}
          >
            <Calendar size={14} />
            24 Hours
          </ControlButton>
          <ControlButton
            theme={theme}
            $active={timeRange === '7d'}
            onClick={() => setTimeRange('7d')}
          >
            <Calendar size={14} />
            7 Days
          </ControlButton>
          <ControlButton
            theme={theme}
            $active={autoRefresh}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Auto Refresh
          </ControlButton>
          <ControlButton theme={theme} onClick={refreshData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </ControlButton>
        </ControlPanel>
      </Header>

      {error && (
        <ErrorState theme={theme}>
          <AlertTriangle size={20} style={{ marginRight: '8px' }} />
          {error}
        </ErrorState>
      )}

      <WidgetGrid>
        {/* Performance Trends Widget */}
        {performanceTrends.length === 0 && !loading ? (
          <Widget theme={theme} size="large">
            <WidgetHeader theme={theme}>
              <WidgetTitle theme={theme}>
                <LineChart size={20} />
                <WidgetTitleText theme={theme}>Performance Trends</WidgetTitleText>
              </WidgetTitle>
              <WidgetActions>
                <WidgetActionButton onClick={refreshData} theme={theme}>
                  <RefreshCw size={16} />
                </WidgetActionButton>
              </WidgetActions>
            </WidgetHeader>
            <WidgetContent>
              <EmptyState theme={theme}>
                <EmptyIcon theme={theme}>
                  <LineChart size={48} />
                </EmptyIcon>
                <EmptyTitle theme={theme}>No Performance Data Available</EmptyTitle>
                <EmptyDescription theme={theme}>
                  Performance trend analysis will appear here once test execution data is collected. 
                  Run some tests to start generating performance metrics and trend insights.
                </EmptyDescription>
              </EmptyState>
            </WidgetContent>
          </Widget>
        ) : (
          performanceTrends.map((trend, index) => (
            <Widget key={index} theme={theme} size="medium">
              <WidgetHeader theme={theme}>
                <WidgetTitle theme={theme}>
                  <LineChart size={20} />
                  <WidgetTitleText theme={theme}>{trend.metric_name} Trend</WidgetTitleText>
                </WidgetTitle>
                <WidgetActions>
                  <WidgetActionButton theme={theme}>
                    <Filter size={16} />
                  </WidgetActionButton>
                  <WidgetActionButton theme={theme}>
                    <Download size={16} />
                  </WidgetActionButton>
                  <WidgetActionButton theme={theme}>
                    <Maximize2 size={16} />
                  </WidgetActionButton>
                </WidgetActions>
              </WidgetHeader>
              <WidgetContent>
                <MetricGrid>
                  <MetricCard theme={theme}>
                    <MetricValue theme={theme}>
                      {formatTrendValue(
                        trend.data_points && trend.data_points.length > 0 
                          ? trend.data_points[trend.data_points.length - 1]?.value || 0 
                          : 0, 
                        trend.metric_name
                      )}
                    </MetricValue>
                    <MetricLabel theme={theme}>Current</MetricLabel>
                  </MetricCard>
                  <MetricCard theme={theme}>
                    <MetricValue theme={theme}>
                      {trend.analysis.percentage_change != null ? (
                        `${trend.analysis.percentage_change > 0 ? '+' : ''}${trend.analysis.percentage_change.toFixed(1)}%`
                      ) : '0.0%'}
                    </MetricValue>
                    <MetricLabel theme={theme}>Change</MetricLabel>
                  </MetricCard>
                  <MetricCard theme={theme}>
                    <MetricValue theme={theme}>{trend.threshold_breaches ?? 0}</MetricValue>
                    <MetricLabel theme={theme}>Breaches</MetricLabel>
                  </MetricCard>
                </MetricGrid>

                <TrendIndicator $trend={trend.analysis?.trend || 'stable'} theme={theme}>
                  {getTrendIcon(trend.analysis?.trend || 'stable')}
                  {(trend.analysis?.trend || 'stable').charAt(0).toUpperCase() + (trend.analysis?.trend || 'stable').slice(1)} Trend
                  ({trend.analysis?.significance || 'low'} significance)
                </TrendIndicator>

                {loading ? (
                  <LoadingState theme={theme}>
                    <RefreshCw size={20} className="animate-spin" />
                    Loading trend data...
                  </LoadingState>
                ) : (
                  <SimpleLineChart
                    data={trend.data_points || []}
                    height={200}
                    color="#185FA5"
                    title={`${trend.metric_name} Trend`}
                  />
                )}

                <InsightsList>
                  {(trend.analysis?.insights || []).map((insight, i) => (
                    <InsightItem key={i} theme={theme} $severity={trend.analysis?.significance || 'low'}>
                      <InsightIcon $severity={trend.analysis?.significance || 'low'}>
                        {getSeverityIcon(trend.analysis?.significance || 'low')}
                      </InsightIcon>
                      <InsightText theme={theme}>{insight}</InsightText>
                    </InsightItem>
                  ))}
                </InsightsList>

                <RecommendationCard theme={theme}>
                  <RecommendationTitle theme={theme}>
                    <CheckCircle size={16} />
                    Recommended Actions
                  </RecommendationTitle>
                  <RecommendationList theme={theme}>
                    {(trend.recommendations || []).map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </RecommendationList>
                </RecommendationCard>
              </WidgetContent>
            </Widget>
          ))
        )}

        {/* Failure Pattern Analysis Widget */}
        <Widget theme={theme} size="large">
          <WidgetHeader theme={theme}>
            <WidgetTitle theme={theme}>
              <BarChart3 size={20} />
              <WidgetTitleText theme={theme}>Failure Pattern Detection</WidgetTitleText>
            </WidgetTitle>
            <WidgetActions>
              <WidgetActionButton theme={theme}>
                <Filter size={16} />
              </WidgetActionButton>
              <WidgetActionButton theme={theme}>
                <Download size={16} />
              </WidgetActionButton>
              <WidgetActionButton onClick={refreshData} theme={theme}>
                <RefreshCw size={16} />
              </WidgetActionButton>
            </WidgetActions>
          </WidgetHeader>
          <WidgetContent>
            {failurePatterns.length === 0 && !loading ? (
              <EmptyState theme={theme}>
                <EmptyIcon theme={theme}>
                  <BarChart3 size={48} />
                </EmptyIcon>
                <EmptyTitle theme={theme}>No Failure Patterns Detected</EmptyTitle>
                <EmptyDescription theme={theme}>
                  Failure pattern analysis will appear here once test failures are collected and analyzed. 
                  This is a good sign - it means your tests are running successfully!
                </EmptyDescription>
              </EmptyState>
            ) : (
              failurePatterns.map((pattern, index) => (
                <div key={pattern.pattern_id} style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, color: theme.colors.text }}>{pattern.error_type}</h4>
                    <TrendIndicator $trend="up" theme={theme}>
                      <TrendingUp size={14} />
                      {pattern.frequency} occurrences
                    </TrendIndicator>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', alignItems: 'center' }}>
                    <div>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Affected Components:</strong>
                      </div>
                      <div style={{ fontSize: '13px', color: theme.colors.textSecondary }}>
                        {pattern.affected_components.join(', ')}
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          fontSize: '12px', 
                          fontWeight: '600',
                          background: pattern.severity === 'high' ? 'rgba(237, 137, 54, 0.1)' : 'rgba(102, 126, 234, 0.1)',
                          color: pattern.severity === 'high' ? '#dd6b20' : '#185FA5'
                        }}>
                          {pattern.severity.toUpperCase()} SEVERITY
                        </span>
                      </div>
                    </div>
                    
                    <SimpleLineChart
                      data={pattern.trend || []}
                      height={120}
                      color={pattern.severity === 'high' ? '#dd6b20' : '#185FA5'}
                      title={`${pattern.error_type} Trend`}
                    />
                  </div>
                </div>
              ))
            )}
          </WidgetContent>
        </Widget>

        {/* Health Score Trending Widget */}
        <Widget theme={theme} size="medium">
          <WidgetHeader theme={theme}>
            <WidgetTitle theme={theme}>
              <PieChart size={20} />
              <WidgetTitleText theme={theme}>System Health Score</WidgetTitleText>
            </WidgetTitle>
            <WidgetActions>
              <WidgetActionButton theme={theme}>
                <Maximize2 size={16} />
              </WidgetActionButton>
            </WidgetActions>
          </WidgetHeader>
          <WidgetContent>
            <MetricGrid>
              <MetricCard theme={theme}>
                <MetricValue theme={theme} style={{ color: '#1D9E75' }}>92.5</MetricValue>
                <MetricLabel theme={theme}>Health Score</MetricLabel>
              </MetricCard>
              <MetricCard theme={theme}>
                <MetricValue theme={theme} style={{ color: '#185FA5' }}>+2.3</MetricValue>
                <MetricLabel theme={theme}>Improvement</MetricLabel>
              </MetricCard>
            </MetricGrid>

            <TrendIndicator $trend="up" theme={theme}>
              <TrendingUp size={16} />
              Improving (High Confidence)
            </TrendIndicator>

            <div style={{ margin: '16px 0' }}>
              <SimpleLineChart
                data={[
                  { timestamp: '2025-11-03T08:00:00Z', value: 90.2, label: 'T-6h' },
                  { timestamp: '2025-11-03T10:00:00Z', value: 91.1, label: 'T-4h' },
                  { timestamp: '2025-11-03T12:00:00Z', value: 91.8, label: 'T-2h' },
                  { timestamp: '2025-11-03T14:00:00Z', value: 92.5, label: 'Current' }
                ]}
                height={150}
                color="#1D9E75"
                title="Health Score Trend"
              />
            </div>

            <InsightsList>
              <InsightItem theme={theme} $severity="low">
                <InsightIcon $severity="low">
                  <CheckCircle size={16} />
                </InsightIcon>
                <InsightText theme={theme}>
                  System health improved by 2.3% over the last 24 hours
                </InsightText>
              </InsightItem>
              <InsightItem theme={theme} $severity="medium">
                <InsightIcon $severity="medium">
                  <AlertTriangle size={16} />
                </InsightIcon>
                <InsightText theme={theme}>
                  Monitor database connection pooling for continued improvement
                </InsightText>
              </InsightItem>
            </InsightsList>
          </WidgetContent>
        </Widget>
      </WidgetGrid>
    </Container>
  );
};

export default AnalyticsTrendWidgets;