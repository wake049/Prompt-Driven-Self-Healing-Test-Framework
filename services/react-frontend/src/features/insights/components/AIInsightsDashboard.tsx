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
  ExternalLink
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

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const SummaryCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 24px;
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
`;

const MetricValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 8px;
`;

const MetricLabel = styled.div`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const InsightsContainer = styled.div`
  display: grid;
  gap: 20px;
`;

const InsightCard = styled.div<{ severity: string }>`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  border-left: 4px solid ${props => {
    switch (props.severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      default: return '#10b981';
    }
  }};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
`;

const CardHeader = styled.div`
  padding: 24px 24px 16px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const CardTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SeverityBadge = styled.span<{ severity: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  background: ${props => {
    switch (props.severity) {
      case 'critical': return '#ef444420';
      case 'high': return '#f59e0b20';
      case 'medium': return '#3b82f620';
      default: return '#10b98120';
    }
  }};
  color: ${props => {
    switch (props.severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      default: return '#10b981';
    }
  }};
`;

const ConfidenceBadge = styled.span`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: ${props => props.theme.colors.primary}20;
  color: ${props => props.theme.colors.primary};
`;

const CardContent = styled.div`
  padding: 20px 24px;
`;

const Description = styled.p`
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 20px;
`;

const Section = styled.div`
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h4`
  color: ${props => props.theme.colors.text};
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
`;

const EvidenceList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const EvidenceItem = styled.li`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 6px;
  position: relative;
  padding-left: 16px;
  
  &:before {
    content: '•';
    color: ${props => props.theme.colors.primary};
    position: absolute;
    left: 0;
  }
`;

const RecommendationsList = styled.ol`
  list-style: none;
  padding: 0;
  margin: 0;
  counter-reset: recommendation;
`;

const RecommendationItem = styled.li`
  color: ${props => props.theme.colors.text};
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 8px;
  position: relative;
  padding-left: 24px;
  counter-increment: recommendation;
  
  &:before {
    content: counter(recommendation);
    position: absolute;
    left: 0;
    top: 0;
    width: 16px;
    height: 16px;
    background: ${props => props.theme.colors.primary};
    color: white;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const ComponentTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const ComponentTag = styled.span`
  padding: 4px 8px;
  background: ${props => props.theme.colors.border};
  border-radius: 12px;
  font-size: 11px;
  color: ${props => props.theme.colors.textSecondary};
  font-weight: 500;
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 16px;
  gap: 16px;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: ${props => props.theme.colors.textSecondary};
  text-align: center;
`;

const EmptyStateIcon = styled.div`
  background: ${props => props.theme.colors.border};
  border-radius: 50%;
  padding: 20px;
  margin-bottom: 16px;
  color: ${props => props.theme.colors.textSecondary};
`;

const EmptyStateTitle = styled.h3`
  color: ${props => props.theme.colors.text};
  font-size: 18px;
  margin-bottom: 8px;
`;

const EmptyStateMessage = styled.p`
  font-size: 14px;
  max-width: 400px;
  line-height: 1.6;
`;

const ErrorState = styled.div`
  background: ${props => props.theme.colors.error}20;
  border: 1px solid ${props => props.theme.colors.error};
  color: ${props => props.theme.colors.error};
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
`;

const RefreshButton = styled.button`
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.colors.primary}dd;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

// ================================
// Component
// ================================
const AIInsightsDashboard: React.FC = () => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [summary, setSummary] = useState<InsightSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch real AI insights from MCP server
      const mcpClient = await MCPFrontendManager.getInstance();
      const data = await mcpClient.getAIInsights("24h");
      
      // Handle different response formats
      let insights: AIInsight[] = [];
      let summary: InsightSummary = {
        total_insights: 0,
        critical_insights: 0,
        high_priority_insights: 0,
        average_confidence: 0,
        analysis_timestamp: new Date().toISOString()
      };
      
      if (data.success && data.ai_insights) {
        // New format from updated MCP server
        insights = data.ai_insights.insights || [];
        summary = data.ai_insights.summary || summary;
      } else if (data.insights) {
        // Direct insights array (fallback format)
        insights = data.insights || [];
      } else if (Array.isArray(data)) {
        // Array of insights (another possible format)
        insights = data;
      }
      
      // Ensure all insights have required properties with defaults
      insights = insights.map(insight => ({
        ...insight,
        evidence: insight.evidence || [],
        recommendations: insight.recommendations || [],
        affected_components: insight.affected_components || []
      }));
      
      setInsights(insights);
      setSummary(summary);
      
    } catch (err) {
      setError('Failed to load AI insights. Please try again later.');
      setInsights([]);
      setSummary({
        total_insights: 0,
        critical_insights: 0,
        high_priority_insights: 0,
        average_confidence: 0,
        analysis_timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshInsights = async () => {
    setRefreshing(true);
    await loadInsights();
    setRefreshing(false);
  };

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'locator_drift': return <GitBranch size={16} />;
      case 'flaky_test': return <Activity size={16} />;
      case 'performance_degradation': return <TrendingUp size={16} />;
      case 'failure_prediction': return <Target size={16} />;
      default: return <Brain size={16} />;
    }
  };

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence)}%`;
  };

  if (loading && insights.length === 0) {
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
        <Title>
          <Brain size={28} />
          AI Insights Dashboard
          <RefreshButton onClick={refreshInsights} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </RefreshButton>
        </Title>
        <Subtitle>
          AI-powered analysis of test patterns, failure predictions, and optimization recommendations
        </Subtitle>
      </Header>

      {error && (
        <ErrorState>{error}</ErrorState>
      )}

      {summary && (
        <SummaryGrid>
          <SummaryCard>
            <MetricValue>{summary.total_insights}</MetricValue>
            <MetricLabel>Total Insights</MetricLabel>
          </SummaryCard>
          
          <SummaryCard>
            <MetricValue>{summary.critical_insights}</MetricValue>
            <MetricLabel>Critical Insights</MetricLabel>
          </SummaryCard>
          
          <SummaryCard>
            <MetricValue>{summary.high_priority_insights}</MetricValue>
            <MetricLabel>High Priority</MetricLabel>
          </SummaryCard>
          
          <SummaryCard>
            <MetricValue>{summary.average_confidence.toFixed(1)}%</MetricValue>
            <MetricLabel>Avg Confidence</MetricLabel>
          </SummaryCard>
        </SummaryGrid>
      )}

      {insights.length === 0 && !loading ? (
        <EmptyState>
          <EmptyStateIcon>
            <Brain size={24} />
          </EmptyStateIcon>
          <EmptyStateTitle>No AI Insights Available</EmptyStateTitle>
          <EmptyStateMessage>
            AI analysis requires sufficient historical data to generate insights. 
            Once you have more test execution data, insights will appear here automatically.
          </EmptyStateMessage>
        </EmptyState>
      ) : (
        <InsightsContainer>
          {insights.map((insight) => (
            <InsightCard key={insight.id} severity={insight.severity}>
              <CardHeader>
                <CardTitle>
                  {getCategoryIcon(insight.category)}
                  {insight.title}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    <SeverityBadge severity={insight.severity}>
                      {insight.severity}
                    </SeverityBadge>
                    <ConfidenceBadge>
                      {formatConfidence(insight.confidence)}
                    </ConfidenceBadge>
                  </div>
                </CardTitle>
                <Description>{insight.description}</Description>
              </CardHeader>

              <CardContent>
                {insight.evidence && insight.evidence.length > 0 && (
                  <Section>
                    <SectionTitle>Evidence</SectionTitle>
                    <EvidenceList>
                      {insight.evidence.map((evidence, index) => (
                        <EvidenceItem key={index}>{evidence}</EvidenceItem>
                      ))}
                    </EvidenceList>
                  </Section>
                )}

                {insight.recommendations && insight.recommendations.length > 0 && (
                  <Section>
                    <SectionTitle>Recommendations</SectionTitle>
                    <RecommendationsList>
                      {insight.recommendations.map((recommendation, index) => (
                        <RecommendationItem key={index}>{recommendation}</RecommendationItem>
                      ))}
                    </RecommendationsList>
                  </Section>
                )}

                {insight.affected_components.length > 0 && (
                  <Section>
                    <SectionTitle>Affected Components</SectionTitle>
                    <ComponentTags>
                      {insight.affected_components.map((component, index) => (
                        <ComponentTag key={index}>{component}</ComponentTag>
                      ))}
                    </ComponentTags>
                  </Section>
                )}

                {insight.predicted_impact && (
                  <Section>
                    <SectionTitle>Predicted Impact</SectionTitle>
                    <Description style={{ marginBottom: 0, fontSize: '13px' }}>
                      {insight.predicted_impact}
                    </Description>
                  </Section>
                )}
              </CardContent>
            </InsightCard>
          ))}
        </InsightsContainer>
      )}
    </Container>
  );
};

export default AIInsightsDashboard;