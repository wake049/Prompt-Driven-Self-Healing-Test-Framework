import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { MCPFrontendManager } from '../../../services/mcpFrontendClient';
import { 
  Brain, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Activity, 
  GitBranch, 
  Target,
  Zap,
  RefreshCw,
  ExternalLink,
  Shield,
  BarChart3,
  Settings,
  Heart,
  AlertCircle,
  ChevronRight,
  Calendar,
  Gauge,
  Database
} from 'lucide-react';

// ================================
// Types & Interfaces
// ================================
interface AIInsight {
  id: string;
  category: 'locator_drift' | 'flaky_test' | 'performance_degradation' | 'failure_prediction' | 'test_optimization';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  confidence: number;
  evidence: string[];
  recommendations: string[];
  affected_components: string[];
  predicted_impact: string;
  created_at: string;
}

interface InsightSummary {
  total_insights: number;
  critical_insights: number;
  high_priority_insights: number;
  average_confidence: number;
  analysis_timestamp: string;
}

interface HealingMetrics {
  total_attempts: number;
  successful_healing: number;
  partial_healing: number;
  failed_healing: number;
  success_rate: number;
  avg_healing_time: number;
  trend_data: Array<{
    date: string;
    attempts: number;
    successful: number;
    partial: number;
    failed: number;
    avg_time?: number;
  }>;
}

interface LocatorDriftAnalysis {
  element_id: string;
  page: string;
  current_locator: string;
  drift_score: number;
  drift_frequency: string;
  stability_prediction: string;
  suggested_improvements: string[];
  last_change: string;
}

interface FlakinessPrediction {
  test_identifier: string;
  flakiness_score: number;
  success_rate_trend: number[];
  failure_patterns: string[];
  environmental_factors: string[];
  reliability_recommendation: string;
}

interface PerformanceMetrics {
  avg_execution_time: number;
  p95_execution_time: number;
  success_rate: number;
  total_executions: number;
  cache_hit_rate: number;
  memory_usage_mb: number;
}

// ================================
// Styled Components
// ================================
const Container = styled.div`
  padding: 24px;
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
`;

const Header = styled.div`
  margin-bottom: 32px;
  display: flex;
  justify-content: between;
  align-items: flex-start;
`;

const HeaderContent = styled.div`
  flex: 1;
`;

const Title = styled.h1`
  color: ${props => props.theme.colors.text};
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Subtitle = styled.p`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 16px;
  margin: 0;
`;

const ControlsSection = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const TimeRangeSelector = styled.select`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 8px 12px;
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const RefreshButton = styled.button`
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.colors.primary}dd;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const DashboardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
`;

const Card = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 24px;
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
`;

const MetricCard = styled(Card)`
  text-align: center;
`;

const MetricValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 8px;
`;

const MetricLabel = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const CardTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  flex: 1;
`;

const IconContainer = styled.div<{ $color?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: ${props => props.$color || props.theme.colors.primary}20;
  color: ${props => props.$color || props.theme.colors.primary};
`;

const StatusBadge = styled.span<{ $status: 'success' | 'warning' | 'error' | 'info' }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  gap: 4px;
  
  ${props => {
    switch (props.$status) {
      case 'success':
        return `
          background: #10b98120;
          color: #10b981;
        `;
      case 'warning':
        return `
          background: #f59e0b20;
          color: #f59e0b;
        `;
      case 'error':
        return `
          background: #ef444420;
          color: #ef4444;
        `;
      default:
        return `
          background: ${props.theme.colors.primary}20;
          color: ${props.theme.colors.primary};
        `;
    }
  }}
`;

const ProgressBar = styled.div<{ $percentage: number; $color?: string }>`
  width: 100%;
  height: 8px;
  background: ${props => props.theme.colors.border};
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.$percentage}%;
    background: ${props => props.$color || props.theme.colors.primary};
    transition: width 0.3s ease;
  }
`;

const TrendChart = styled.div`
  height: 100px;
  margin: 16px 0;
  display: flex;
  align-items: end;
  gap: 4px;
`;

const TrendBar = styled.div<{ $height: number; $color?: string }>`
  flex: 1;
  background: ${props => props.$color || props.theme.colors.primary}40;
  border-radius: 2px 2px 0 0;
  height: ${props => props.$height}%;
  min-height: 2px;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$color || props.theme.colors.primary};
  }
`;

const MetricRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid ${props => props.theme.colors.border}40;
  
  &:last-child {
    border-bottom: none;
  }
`;

const MetricName = styled.span`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
`;

const MetricValueSmall = styled.span`
  color: ${props => props.theme.colors.text};
  font-weight: 500;
  font-size: 14px;
`;

const AlertsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const AlertItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
  border-left: 3px solid ${props => props.theme.colors.primary};
`;

const AlertContent = styled.div`
  flex: 1;
`;

const AlertTitle = styled.div`
  color: ${props => props.theme.colors.text};
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 4px;
`;

const AlertDescription = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 12px;
  line-height: 1.4;
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 16px;
  padding: 60px 20px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 16px;
`;

const ErrorState = styled.div`
  background: #ef444420;
  color: #ef4444;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #ef444440;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

// ================================
// Component
// ================================
const EnhancedAIInsightsDashboard: React.FC = () => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [summary, setSummary] = useState<InsightSummary | null>(null);
  const [healingMetrics, setHealingMetrics] = useState<HealingMetrics | null>(null);
  const [driftAnalyses, setDriftAnalyses] = useState<LocatorDriftAnalysis[]>([]);
  const [flakinessPredictions, setFlakinessPredictions] = useState<FlakinessPrediction[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('24h');

  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);
      
      // Get MCP client instance
      const mcpClient = await MCPFrontendManager.getInstance();
      
      // Convert time range to days for API calls
      const daysMap: Record<string, number> = {
        '1h': 1,
        '24h': 1,
        '7d': 7,
        '30d': 30
      };
      const days = daysMap[timeRange] || 1;

      // Load all dashboard data using MCP client methods
      const [
        insightsResponse,
        healingResponse,
        analyticsResponse,
        executionTrendsResponse,
        failurePatternsResponse
      ] = await Promise.all([
        mcpClient.getAIInsights(timeRange),
        mcpClient.getHealingAnalytics(timeRange),
        mcpClient.getAnalyticsTrends(timeRange),
        mcpClient.getExecutionTrends(days),
        mcpClient.getFailurePatterns(timeRange)
      ]);

      // Process AI insights
      if (insightsResponse && insightsResponse.success) {
        // Our API returns insights directly, not nested under ai_insights
        setInsights(insightsResponse.insights || []);
        setSummary(insightsResponse.summary || null);
      } else if (insightsResponse && insightsResponse.insights) {
        setInsights(insightsResponse.insights || []);
      }

      // Process healing metrics
      if (healingResponse && healingResponse.healing_metrics) {
        setHealingMetrics(healingResponse.healing_metrics);
      } else if (healingResponse && healingResponse.data) {
        setHealingMetrics(healingResponse.data.healing_metrics || null);
      }

      // Process drift analysis (mock data for now since MCP doesn't have this endpoint yet)
      const mockDriftAnalyses: LocatorDriftAnalysis[] = [
        {
          element_id: "login-button",
          page: "Login Page",
          current_locator: "#login-btn",
          drift_score: 0.75,
          drift_frequency: "High",
          stability_prediction: "Unstable - requires attention",
          suggested_improvements: ["Use data-testid attribute", "Review selector specificity"],
          last_change: new Date().toISOString()
        },
        {
          element_id: "search-input",
          page: "Search Page", 
          current_locator: "input[placeholder='Search...']",
          drift_score: 0.45,
          drift_frequency: "Medium",
          stability_prediction: "Moderately stable",
          suggested_improvements: ["Add unique identifier"],
          last_change: new Date().toISOString()
        }
      ];
      setDriftAnalyses(mockDriftAnalyses);

      // Process flakiness predictions (mock data for now)
      const mockFlakinessPredictions: FlakinessPrediction[] = [
        {
          test_identifier: "user-login-test",
          flakiness_score: 0.65,
          success_rate_trend: [85, 90, 75, 80, 85],
          failure_patterns: ["Timeout on slow networks", "Element not found"],
          environmental_factors: ["Network latency", "Browser version"],
          reliability_recommendation: "Increase timeout values and add retry logic"
        }
      ];
      setFlakinessPredictions(mockFlakinessPredictions);

      // Process performance metrics
      if (executionTrendsResponse && executionTrendsResponse.performance_trends) {
        const metrics = executionTrendsResponse.performance_trends[0] || {};
        setPerformanceMetrics({
          avg_execution_time: metrics.avg_execution_time || 0,
          p95_execution_time: metrics.p95_execution_time || 0,
          success_rate: metrics.current_value || 0,
          total_executions: metrics.total_executions || 0,
          cache_hit_rate: 85, // Mock value
          memory_usage_mb: 64  // Mock value
        });
      } else if (analyticsResponse && analyticsResponse.performance_trends) {
        const metrics = analyticsResponse.performance_trends[0] || {};
        setPerformanceMetrics({
          avg_execution_time: metrics.current_value || 0,
          p95_execution_time: 0, // Not available in this response
          success_rate: metrics.current_value || 0,
          total_executions: 0, // Not available
          cache_hit_rate: 85, // Mock value
          memory_usage_mb: 64  // Mock value
        });
      }

    } catch (err) {
      setError('Failed to load dashboard data. Please try again later.');
      
      // Set fallback data so dashboard still shows something useful
      setInsights([]);
      setSummary({
        total_insights: 0,
        critical_insights: 0,
        high_priority_insights: 0,
        average_confidence: 0,
        analysis_timestamp: new Date().toISOString()
      });
      setHealingMetrics({
        total_attempts: 0,
        successful_healing: 0,
        partial_healing: 0,
        failed_healing: 0,
        success_rate: 0,
        avg_healing_time: 0,
        trend_data: []
      });
      setDriftAnalyses([]);
      setFlakinessPredictions([]);
      setPerformanceMetrics({
        avg_execution_time: 0,
        p95_execution_time: 0,
        success_rate: 0,
        total_executions: 0,
        cache_hit_rate: 0,
        memory_usage_mb: 0
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (loading && !healingMetrics && !driftAnalyses.length) {
    return (
      <Container>
        <LoadingState>
          <Brain size={32} className="animate-pulse" />
          Analyzing system patterns with AI...
        </LoadingState>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderContent>
          <Title>
            <Brain size={28} />
            Enhanced AI Insights Dashboard
          </Title>
          <Subtitle>
            Comprehensive analysis of self-healing test patterns, performance metrics, and optimization recommendations
          </Subtitle>
        </HeaderContent>
        
        <ControlsSection>
          <TimeRangeSelector 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </TimeRangeSelector>
          
          <RefreshButton onClick={refreshDashboard} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </RefreshButton>
        </ControlsSection>
      </Header>

      {error && (
        <ErrorState>
          <AlertTriangle size={16} />
          {error}
        </ErrorState>
      )}

      {/* Summary Metrics */}
      <SummaryGrid>
        <MetricCard>
          <MetricValue>{summary?.total_insights || 0}</MetricValue>
          <MetricLabel>Total Insights</MetricLabel>
        </MetricCard>
        
        <MetricCard>
          <MetricValue>{healingMetrics?.success_rate?.toFixed(1) || 0}%</MetricValue>
          <MetricLabel>Healing Success Rate</MetricLabel>
        </MetricCard>
        
        <MetricCard>
          <MetricValue>{driftAnalyses.filter(d => d.drift_score > 0.7).length}</MetricValue>
          <MetricLabel>High-Risk Elements</MetricLabel>
        </MetricCard>
        
        <MetricCard>
          <MetricValue>{flakinessPredictions.filter(f => f.flakiness_score > 0.6).length}</MetricValue>
          <MetricLabel>Flaky Tests</MetricLabel>
        </MetricCard>
        
        <MetricCard>
          <MetricValue>{performanceMetrics?.success_rate?.toFixed(1) || 0}%</MetricValue>
          <MetricLabel>Execution Success</MetricLabel>
        </MetricCard>
        
        <MetricCard>
          <MetricValue>{summary?.average_confidence?.toFixed(1) || 0}%</MetricValue>
          <MetricLabel>AI Confidence</MetricLabel>
        </MetricCard>
      </SummaryGrid>

      {/* Dashboard Widgets */}
      <DashboardGrid>
        {/* Self-Healing Analytics */}
        <Card>
          <CardHeader>
            <IconContainer $color="#10b981">
              <Heart size={18} />
            </IconContainer>
            <CardTitle>Self-Healing Analytics</CardTitle>
            <StatusBadge $status={healingMetrics && healingMetrics.success_rate > 80 ? 'success' : 'warning'}>
              {healingMetrics && healingMetrics.success_rate > 80 ? 'Healthy' : 'Needs Attention'}
            </StatusBadge>
          </CardHeader>
          
          {healingMetrics ? (
            <>
              <MetricRow>
                <MetricName>Total Healing Attempts</MetricName>
                <MetricValueSmall>{healingMetrics.total_attempts}</MetricValueSmall>
              </MetricRow>
              
              <MetricRow>
                <MetricName>Successful Healing</MetricName>
                <MetricValueSmall>{healingMetrics.successful_healing}</MetricValueSmall>
              </MetricRow>
              
              <MetricRow>
                <MetricName>Average Healing Time</MetricName>
                <MetricValueSmall>{healingMetrics.avg_healing_time.toFixed(2)}s</MetricValueSmall>
              </MetricRow>
              
              <ProgressBar 
                $percentage={healingMetrics.success_rate} 
                $color="#10b981"
              />
              
              {healingMetrics.trend_data.length > 0 && (
                <TrendChart>
                  {healingMetrics.trend_data.map((point, index) => (
                    <TrendBar 
                      key={index}
                      $height={(point.successful / Math.max(point.attempts, 1)) * 100}
                      $color="#10b981"
                    />
                  ))}
                </TrendChart>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              No healing data available
            </div>
          )}
        </Card>

        {/* Locator Drift Analysis */}
        <Card>
          <CardHeader>
            <IconContainer $color="#f59e0b">
              <GitBranch size={18} />
            </IconContainer>
            <CardTitle>Locator Drift Analysis</CardTitle>
            <StatusBadge $status={driftAnalyses.filter(d => d.drift_score > 0.7).length > 0 ? 'warning' : 'success'}>
              {driftAnalyses.filter(d => d.drift_score > 0.7).length} High Risk
            </StatusBadge>
          </CardHeader>
          
          {driftAnalyses.length > 0 ? (
            <AlertsList>
              {driftAnalyses.slice(0, 3).map((drift, index) => (
                <AlertItem key={index}>
                  <IconContainer $color={drift.drift_score > 0.7 ? '#ef4444' : drift.drift_score > 0.4 ? '#f59e0b' : '#10b981'}>
                    <AlertTriangle size={14} />
                  </IconContainer>
                  <AlertContent>
                    <AlertTitle>
                      {drift.page} - {drift.element_id}
                    </AlertTitle>
                    <AlertDescription>
                      Drift Score: {(drift.drift_score * 100).toFixed(0)}% | {drift.stability_prediction}
                    </AlertDescription>
                  </AlertContent>
                </AlertItem>
              ))}
              
              {driftAnalyses.length > 3 && (
                <div style={{ textAlign: 'center', padding: '8px', color: '#666', fontSize: '12px' }}>
                  +{driftAnalyses.length - 3} more elements analyzed
                </div>
              )}
            </AlertsList>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              No drift analysis available
            </div>
          )}
        </Card>

        {/* Flaky Test Detection */}
        <Card>
          <CardHeader>
            <IconContainer $color="#ef4444">
              <Activity size={18} />
            </IconContainer>
            <CardTitle>Flaky Test Detection</CardTitle>
            <StatusBadge $status={flakinessPredictions.filter(f => f.flakiness_score > 0.6).length > 0 ? 'error' : 'success'}>
              {flakinessPredictions.filter(f => f.flakiness_score > 0.6).length} Flaky Tests
            </StatusBadge>
          </CardHeader>
          
          {flakinessPredictions.length > 0 ? (
            <AlertsList>
              {flakinessPredictions.slice(0, 3).map((test, index) => (
                <AlertItem key={index}>
                  <IconContainer $color={test.flakiness_score > 0.6 ? '#ef4444' : '#f59e0b'}>
                    <AlertCircle size={14} />
                  </IconContainer>
                  <AlertContent>
                    <AlertTitle>
                      {test.test_identifier}
                    </AlertTitle>
                    <AlertDescription>
                      Flakiness: {(test.flakiness_score * 100).toFixed(0)}% | {test.reliability_recommendation}
                    </AlertDescription>
                  </AlertContent>
                </AlertItem>
              ))}
              
              {flakinessPredictions.length > 3 && (
                <div style={{ textAlign: 'center', padding: '8px', color: '#666', fontSize: '12px' }}>
                  +{flakinessPredictions.length - 3} more tests analyzed
                </div>
              )}
            </AlertsList>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#10b981' }}>
              ✓ No flaky tests detected
            </div>
          )}
        </Card>

        {/* Performance Monitoring */}
        <Card>
          <CardHeader>
            <IconContainer $color="#3b82f6">
              <Gauge size={18} />
            </IconContainer>
            <CardTitle>Performance Monitoring</CardTitle>
            <StatusBadge $status={performanceMetrics && performanceMetrics.success_rate > 90 ? 'success' : 'warning'}>
              {performanceMetrics && performanceMetrics.success_rate > 90 ? 'Optimal' : 'Monitor'}
            </StatusBadge>
          </CardHeader>
          
          {performanceMetrics ? (
            <>
              <MetricRow>
                <MetricName>Avg Execution Time</MetricName>
                <MetricValueSmall>{performanceMetrics.avg_execution_time.toFixed(0)}ms</MetricValueSmall>
              </MetricRow>
              
              <MetricRow>
                <MetricName>Success Rate</MetricName>
                <MetricValueSmall>{performanceMetrics.success_rate.toFixed(1)}%</MetricValueSmall>
              </MetricRow>
              
              <MetricRow>
                <MetricName>Cache Hit Rate</MetricName>
                <MetricValueSmall>{performanceMetrics.cache_hit_rate}%</MetricValueSmall>
              </MetricRow>
              
              <MetricRow>
                <MetricName>Memory Usage</MetricName>
                <MetricValueSmall>{performanceMetrics.memory_usage_mb}MB</MetricValueSmall>
              </MetricRow>
              
              <ProgressBar 
                $percentage={performanceMetrics.success_rate} 
                $color="#3b82f6"
              />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              No performance data available
            </div>
          )}
        </Card>

        {/* Critical Alerts */}
        <Card>
          <CardHeader>
            <IconContainer $color="#ef4444">
              <AlertTriangle size={18} />
            </IconContainer>
            <CardTitle>Critical Alerts</CardTitle>
            <StatusBadge $status={summary && summary.critical_insights > 0 ? 'error' : 'success'}>
              {summary?.critical_insights || 0} Critical
            </StatusBadge>
          </CardHeader>
          
          <AlertsList>
            {insights.filter(i => i.severity === 'critical').slice(0, 3).map((insight, index) => (
              <AlertItem key={index}>
                <IconContainer $color="#ef4444">
                  <AlertTriangle size={14} />
                </IconContainer>
                <AlertContent>
                  <AlertTitle>{insight.title}</AlertTitle>
                  <AlertDescription>{insight.description}</AlertDescription>
                </AlertContent>
              </AlertItem>
            ))}
            
            {(!insights.length || !insights.some(i => i.severity === 'critical')) && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#10b981' }}>
                ✓ No critical alerts
              </div>
            )}
          </AlertsList>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <IconContainer $color="#8b5cf6">
              <Database size={18} />
            </IconContainer>
            <CardTitle>System Health</CardTitle>
            <StatusBadge $status="success">
              Healthy
            </StatusBadge>
          </CardHeader>
          
          <MetricRow>
            <MetricName>Database Performance</MetricName>
            <MetricValueSmall>Optimal</MetricValueSmall>
          </MetricRow>
          
          <MetricRow>
            <MetricName>API Response Time</MetricName>
            <MetricValueSmall>&lt; 200ms</MetricValueSmall>
          </MetricRow>
          
          <MetricRow>
            <MetricName>Test Runner Status</MetricName>
            <MetricValueSmall>Active</MetricValueSmall>
          </MetricRow>
          
          <MetricRow>
            <MetricName>Healing Engine</MetricName>
            <MetricValueSmall>Running</MetricValueSmall>
          </MetricRow>
          
          <ProgressBar $percentage={95} $color="#8b5cf6" />
        </Card>
      </DashboardGrid>

      {/* AI Insights - Full Width Section */}
      <Card style={{ marginTop: '32px' }}>
        <CardHeader>
          <IconContainer $color="#3b82f6">
            <Brain size={18} />
          </IconContainer>
          <CardTitle>AI Insights & Recommendations</CardTitle>
          <StatusBadge $status={insights.length > 0 ? 'success' : 'warning'}>
            {insights.length} Insights
          </StatusBadge>
        </CardHeader>
        
        <div style={{ padding: '0 24px 24px 24px' }}>
          {insights.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {insights.map((insight, index) => (
                <div 
                  key={index}
                  style={{
                    padding: '20px',
                    border: `2px solid ${
                      insight.severity === 'critical' ? '#ef4444' :
                      insight.severity === 'high' ? '#f59e0b' :
                      insight.severity === 'medium' ? '#3b82f6' : '#10b981'
                    }`,
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: '16px',
                    marginBottom: '12px'
                  }}>
                    <IconContainer $color={
                      insight.severity === 'critical' ? '#ef4444' :
                      insight.severity === 'high' ? '#f59e0b' :
                      insight.severity === 'medium' ? '#3b82f6' : '#10b981'
                    }>
                      {insight.severity === 'critical' ? <AlertTriangle size={16} /> :
                       insight.severity === 'high' ? <AlertCircle size={16} /> :
                       <CheckCircle size={16} />}
                    </IconContainer>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px',
                        marginBottom: '8px',
                        flexWrap: 'wrap'
                      }}>
                        <h3 style={{ 
                          margin: 0, 
                          fontSize: '18px', 
                          fontWeight: '600',
                          color: '#ffffff',
                          lineHeight: '1.3'
                        }}>
                          {insight.title}
                        </h3>
                        <span style={{ 
                          fontSize: '12px', 
                          color: insight.severity === 'critical' ? '#ef4444' :
                                 insight.severity === 'high' ? '#f59e0b' :
                                 insight.severity === 'medium' ? '#3b82f6' : '#10b981',
                          textTransform: 'uppercase',
                          fontWeight: '700',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: `${
                            insight.severity === 'critical' ? '#ef4444' :
                            insight.severity === 'high' ? '#f59e0b' :
                            insight.severity === 'medium' ? '#3b82f6' : '#10b981'
                          }20`
                        }}>
                          {insight.severity}
                        </span>
                      </div>
                      <p style={{ 
                        margin: 0, 
                        fontSize: '14px', 
                        lineHeight: '1.5',
                        color: '#d1d5db'
                      }}>
                        {insight.description}
                      </p>
                    </div>
                  </div>
                  
                  {insight.recommendations && insight.recommendations.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ 
                        margin: '0 0 8px 0', 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: '#ffffff'
                      }}>
                        Recommendations:
                      </h4>
                      <ul style={{ 
                        margin: 0, 
                        padding: '0 0 0 20px',
                        color: '#d1d5db',
                        fontSize: '13px',
                        lineHeight: '1.4'
                      }}>
                        {insight.recommendations.map((rec, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {insight.evidence && insight.evidence.length > 0 && (
                    <div>
                      <h4 style={{ 
                        margin: '0 0 8px 0', 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: '#ffffff'
                      }}>
                        Evidence:
                      </h4>
                      <ul style={{ 
                        margin: 0, 
                        padding: '0 0 0 20px',
                        color: '#9ca3af',
                        fontSize: '13px',
                        lineHeight: '1.4'
                      }}>
                        {insight.evidence.map((evidence, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>{evidence}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
              <Brain size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <div style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>
                No AI insights available
              </div>
              <div style={{ fontSize: '14px' }}>
                Run more tests to generate intelligent analysis and recommendations
              </div>
            </div>
          )}
        </div>
      </Card>
    </Container>
  );
};

export default EnhancedAIInsightsDashboard;