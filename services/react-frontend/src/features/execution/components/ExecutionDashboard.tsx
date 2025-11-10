import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import unifiedApiClient from '../../../shared/utils/unifiedApiClient';
import ExecutionStepsModal from './ExecutionStepsModal';
import { executionApiService } from '../api';
import { useAuth } from '../../../contexts/AuthContext';
<<<<<<< Updated upstream
=======
import { useTheme } from '../../../contexts/ThemeContext';
import { DashboardSkeleton, StatGridSkeleton, ExecutionListSkeleton } from '../../../shared/ui/SkeletonLoader';
import { ProgressRing, SimpleBarChart } from '../../../shared/ui/Charts';
import EnhancedStatusBadge from '../../../shared/ui/EnhancedStatusBadge';
import { RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, Activity, PieChart, MessageSquare, Sparkles, Link, Database, AlertTriangle, Wrench } from 'lucide-react';
>>>>>>> Stashed changes

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
  pending_review_executions: number; // NEW: Count of executions needing review
  success_rate: number;
  recent_executions_24h: number;
  avg_execution_time: number;
  healing_rate?: number; // NEW: Percentage of executions that required healing
}

interface ExecutionRecord {
  execution_id: string;
  test_name: string;
<<<<<<< Updated upstream
  status: string;
=======
  prompt_description?: string;
  status: 'pass' | 'pending_review' | 'failed' | 'completed' | 'running'; // UPDATED: New status types
>>>>>>> Stashed changes
  success_rate: number;
  start_time: string;
  duration?: number;
  steps_completed?: number;
  total_steps?: number;
  pending_review_steps?: number; // NEW: Steps that passed but required healing
  healed_steps?: number; // NEW: Total healed steps count
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
<<<<<<< Updated upstream

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
=======
      try {
        const statsData = await executionApiService.getExecutionStats();
        
        // Extract the actual stats data from the MCP response
        const statsValues = statsData.data || statsData;
        
        const realStats: ExecutionStats = {
          total_executions: statsValues.total_executions || 0,
          successful_executions: statsValues.successful_executions || 0,
          failed_executions: statsValues.failed_executions || 0,
          pending_review_executions: statsValues.pending_review_executions || 0, // NEW: Support new status
          success_rate: (statsValues.success_rate || 0) / 100, // API sends percentages, convert to decimal for internal use
          recent_executions_24h: statsValues.recent_executions_24h || 0,
          avg_execution_time: statsValues.avg_execution_time || 0,
          healing_rate: statsValues.healing_rate ? (statsValues.healing_rate / 100) : undefined // NEW: Healing rate
        };
        setStats(realStats);
      } catch (statsError) {
      }
      // Fetch real execution logs from authenticated API
      const executionsResponse = await executionApiService.getRecentExecutions({ limit: 20 });
      
      let executionsData = [];
      
      // Handle different MCP response formats
      if (Array.isArray(executionsResponse)) {
        executionsData = executionsResponse;
      } else if (executionsResponse?.data && Array.isArray(executionsResponse.data)) {
        executionsData = executionsResponse.data;
      } else if (executionsResponse?.content && Array.isArray(executionsResponse.content)) {
        // MCP format: { content: [{ type: "text", text: "..." }] }
        const content = executionsResponse.content[0];
        if (content?.text) {
          try {
            const parsed = JSON.parse(content.text);
            executionsData = Array.isArray(parsed) ? parsed : (parsed?.data || []);
          } catch (e) {
            executionsData = [];
          }
        }
      } else if (executionsResponse?.result) {
        executionsData = Array.isArray(executionsResponse.result) ? executionsResponse.result : 
                        (executionsResponse.result?.data || []);
      }
      
      const realExecutions: ExecutionRecord[] = executionsData.map((exec: any, index: number) => {
        return {
          execution_id: exec.id || exec.execution_id || 'unknown',
          prompt_id: exec.prompt_id || '',
          test_name: exec.test_name || 'Unknown Test',
          prompt_description: exec.prompt_description || 'No description available', 
          status: exec.status || 'unknown',
          success_rate: (exec.success_rate || 0) / 100, // API now sends percentages, convert to decimal for internal use
          start_time: exec.started_at || exec.start_time || new Date().toISOString(),
          duration: exec.duration_seconds || exec.duration || 0,
          steps_completed: exec.passed_steps || exec.steps_completed || 0,
          total_steps: exec.total_steps || 0
        };
      });
>>>>>>> Stashed changes
      setExecutions(realExecutions);

    } catch (err) {
<<<<<<< Updated upstream
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
=======
      setError('Failed to load execution data. Please check your connection and try again.');
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedExecutionId(null);
=======
  // M7: LLM Summary Functions
  const generateSummary = async (executionId: string, style: "brief" | "detailed" = "brief") => {
    if (generatingSummaries.has(executionId)) return;
    setGeneratingSummaries(prev => new Set(prev).add(executionId));
    try {
      const summaryResponse = await executionApiService.generateExecutionSummary(executionId);
      setSummaries(prev => ({
        ...prev,
        [executionId]: {
          execution_id: summaryResponse.execution_id,
          summary_text: summaryResponse.summary_text,
          generated_at: summaryResponse.generated_at,
          model_used: summaryResponse.model_used,
          key_insights: [], // Will be populated from API if available
          recommendations: [], // Will be populated from API if available
          performance_metrics: {
            avg_step_time: 0,
            slowest_step: '',
            fastest_step: ''
          }
        }
      }));
      // Auto-expand for detailed summaries
      if (style === "detailed") {
        setExpandedSummaries(prev => new Set(prev).add(executionId));
      }
    } catch (err) {
      setError('Failed to generate summary. Please try again.');
    } finally {
      setGeneratingSummaries(prev => {
        const newSet = new Set(prev);
        newSet.delete(executionId);
        return newSet;
      });
    }
  };
  const loadCachedSummary = async (executionId: string) => {
    try {
      const cachedSummary = await executionApiService.getCachedExecutionSummary(executionId);
      setSummaries(prev => ({
        ...prev,
        [executionId]: cachedSummary
      }));
    } catch (err) {
      // No cached summary available, that's okay
    }
  };
  const toggleSummaryExpansion = (executionId: string) => {
    setExpandedSummaries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(executionId)) {
        newSet.delete(executionId);
      } else {
        newSet.add(executionId);
      }
      return newSet;
    });
  };
  // M7: Data Resolver Traceability Functions (SCRUM-16)
  const loadBindingUsage = async (executionId: string) => {
    if (loadingBindings.has(executionId) || bindingUsages[executionId]) return;
    setLoadingBindings(prev => new Set(prev).add(executionId));
    try {
      const bindingData = await executionApiService.getExecutionBindingUsage(executionId);
      setBindingUsages(prev => ({
        ...prev,
        [executionId]: bindingData
      }));
    } catch (err) {
      // Set empty result to avoid repeated attempts
      setBindingUsages(prev => ({
        ...prev,
        [executionId]: { bindings_count: 0, bindings_used: [] }
      }));
    } finally {
      setLoadingBindings(prev => {
        const newSet = new Set(prev);
        newSet.delete(executionId);
        return newSet;
      });
    }
  };
  const toggleBindingExpansion = (executionId: string) => {
    setExpandedBindings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(executionId)) {
        newSet.delete(executionId);
      } else {
        newSet.add(executionId);
        // Auto-load binding data when expanding
        if (!bindingUsages[executionId]) {
          loadBindingUsage(executionId);
        }
      }
      return newSet;
    });
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
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
=======
        <>
          <StatsGrid theme={theme}>
            <StatCard $variant="info">
              <StatTitle>
                <Activity size={16} />
                Total Executions
              </StatTitle>
              <StatValue>{stats.total_executions}</StatValue>
              <StatChange $positive={stats.recent_executions_24h > 0}>
                <TrendingUp size={14} />
                {stats.recent_executions_24h} in last 24h
              </StatChange>
            </StatCard>
            <StatCard $variant="success">
              <StatTitle>
                <CheckCircle size={16} />
                Passed (No Healing)
              </StatTitle>
              <StatValue>{stats.successful_executions}</StatValue>
              <StatChange $positive={stats.success_rate > 0.7}>
                <TrendingUp size={14} />
                {((stats.successful_executions / stats.total_executions) * 100).toFixed(1)}% clean passes
              </StatChange>
            </StatCard>
            <StatCard $variant="warning">
              <StatTitle>
                <AlertTriangle size={16} />
                Needs Review
              </StatTitle>
              <StatValue>{stats.pending_review_executions || 0}</StatValue>
              <StatChange $positive={false}>
                <Wrench size={14} />
                {stats.pending_review_executions > 0 ? 
                  `${((stats.pending_review_executions / stats.total_executions) * 100).toFixed(1)}% required healing` :
                  'No healing needed'
                }
              </StatChange>
            </StatCard>
            <StatCard $variant="danger">
              <StatTitle>
                <XCircle size={16} />
                Failed Executions
              </StatTitle>
              <StatValue>{stats.failed_executions}</StatValue>
              <StatChange $positive={false}>
                <TrendingDown size={14} />
                {((stats.failed_executions / stats.total_executions) * 100).toFixed(1)}% failure rate
              </StatChange>
            </StatCard>
          </StatsGrid>
        </>
>>>>>>> Stashed changes
      )}

      <ExecutionList>
        <ExecutionListHeader>
          Recent Test Executions
        </ExecutionListHeader>
        
        {executions.length === 0 ? (
          <LoadingSpinner>No execution records found</LoadingSpinner>
        ) : (
          <>
<<<<<<< Updated upstream
            <ExecutionItem style={{ background: '#f8f9fa', fontWeight: 600 }}>
              <div>Test Name</div>
=======
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
>>>>>>> Stashed changes
              <div>Status</div>
              <div>Success Rate</div>
              <div>Duration</div>
              <div>Started</div>
            </ExecutionItem>
<<<<<<< Updated upstream
            
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
=======
            {executions.map((execution, index) => (
              <React.Fragment key={execution.execution_id}>
                <ExecutionItem 
                  $clickable={true}
                  onClick={() => handleExecutionClick(execution.execution_id)}
                >
                  <ExecutionId>
                    {execution.prompt_id ? execution.prompt_id.substring(0, 8).toUpperCase() : `RUN-${String(index + 121).padStart(5, '0')}`}
                  </ExecutionId>
                  <ExecutionDescription>
                    {execution.prompt_description || execution.test_name || 'Test Execution'}
                    <small>{execution.test_name}</small>
                  </ExecutionDescription>
                  <DateValue>
                    {new Date(execution.start_time).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    })}
                  </DateValue>
                  <DateValue>
                    {execution.duration ? 
                      new Date(execution.duration * 1000).toISOString().substr(11, 8) : 
                      '00:02:04'}
                  </DateValue>
                  <MetricValue>{execution.total_steps || 30}</MetricValue>
                  <MetricValue type="success">
                    {execution.steps_completed || execution.total_steps || 27}
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
                      handleExecutionClick(execution.execution_id);
                    }}>
                      View Details
                    </ActionButton>
                    <SummaryButton
                      $isGenerating={generatingSummaries.has(execution.execution_id)}
                      disabled={generatingSummaries.has(execution.execution_id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!summaries[execution.execution_id]) {
                          generateSummary(execution.execution_id, "brief");
                        } else {
                          toggleSummaryExpansion(execution.execution_id);
                        }
                      }}
                    >
                      {generatingSummaries.has(execution.execution_id) ? (
                        <>
                          <Sparkles size={12} />
                          Generating...
                        </>
                      ) : summaries[execution.execution_id] ? (
                        <>
                          <MessageSquare size={12} />
                          {expandedSummaries.has(execution.execution_id) ? 'Hide' : 'Show'} Summary
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} />
                          AI Summary
                        </>
                      )}
                    </SummaryButton>
                    <BindingButton
                      $isLoading={loadingBindings.has(execution.execution_id)}
                      disabled={loadingBindings.has(execution.execution_id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBindingExpansion(execution.execution_id);
                      }}
                    >
                      {loadingBindings.has(execution.execution_id) ? (
                        <>
                          <Database size={12} />
                          Loading...
                        </>
                      ) : bindingUsages[execution.execution_id] ? (
                        <>
                          <Link size={12} />
                          {expandedBindings.has(execution.execution_id) ? 'Hide' : 'Show'} Bindings ({bindingUsages[execution.execution_id].bindings_count})
                        </>
                      ) : (
                        <>
                          <Database size={12} />
                          Data Bindings
                        </>
                      )}
                    </BindingButton>
                  </div>
                </ExecutionItem>
                {/* M7: LLM Summary Display */}
                {summaries[execution.execution_id] && (
                  <ExecutionItem style={{ gridColumn: '1 / -1', background: 'transparent', padding: '0 32px 16px 32px' }}>
                    <SummaryCard isExpanded={expandedSummaries.has(execution.execution_id)}>
                      <SummaryText>
                        {summaries[execution.execution_id].summary_text}
                      </SummaryText>
                      {expandedSummaries.has(execution.execution_id) && summaries[execution.execution_id].key_insights && (
                        <InsightsList>
                          {summaries[execution.execution_id].key_insights.map((insight, idx) => (
                            <InsightTag key={idx}>{insight.message}</InsightTag>
                          ))}
                        </InsightsList>
                      )}
                    </SummaryCard>
                  </ExecutionItem>
                )}
                {/* M7: Data Resolver Traceability Display (SCRUM-16) */}
                {expandedBindings.has(execution.execution_id) && bindingUsages[execution.execution_id] && (
                  <ExecutionItem style={{ gridColumn: '1 / -1', background: 'transparent', padding: '0 32px 16px 32px' }}>
                    <BindingCard isExpanded={expandedBindings.has(execution.execution_id)}>
                      <BindingHeader>
                        <BindingTitle>
                          <Database size={16} />
                          Data Bindings Used
                        </BindingTitle>
                        <BindingCount>
                          {bindingUsages[execution.execution_id].bindings_count} bindings
                        </BindingCount>
                      </BindingHeader>
                      {bindingUsages[execution.execution_id].bindings_count > 0 ? (
                        <BindingList>
                          {bindingUsages[execution.execution_id].bindings_used.map((binding: any, idx: number) => (
                            <BindingItem key={idx}>
                              <BindingName>{binding.binding_name}</BindingName>
                              <BindingDetails>
                                Scope: {binding.binding_scope} | 
                                {binding.step_order && ` Step ${binding.step_order} |`}
                                {binding.action_type && ` Action: ${binding.action_type} |`}
                                Used at: {new Date(binding.recorded_at).toLocaleTimeString()}
                              </BindingDetails>
                            </BindingItem>
                          ))}
                        </BindingList>
                      ) : (
                        <div style={{ 
                          textAlign: 'center', 
                          color: '#666', 
                          fontStyle: 'italic',
                          padding: '16px'
                        }}>
                          No data bindings were used in this execution
                        </div>
                      )}
                    </BindingCard>
                  </ExecutionItem>
                )}
              </React.Fragment>
>>>>>>> Stashed changes
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