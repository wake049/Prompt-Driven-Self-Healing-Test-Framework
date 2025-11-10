import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { executionApiService } from '../../../services/executionApiService';
import { MCPStatus } from '../../../components/MCPStatus';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { DashboardSkeleton, StatGridSkeleton, ExecutionListSkeleton } from '../../../shared/ui/SkeletonLoader';
import { ProgressRing, SimpleBarChart } from '../../../shared/ui/Charts';
import { RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, Activity, PieChart, MessageSquare, Sparkles, Link, Database } from 'lucide-react';

// Types
interface ExecutionSummaryResponse {
  execution_id: string;
  summary_text: string; // Changed from summary to match API
  generated_at: string;
  model_used: string;
  key_insights: Array<{
    type: string;
    message: string;
    severity: string;
  }>;
  recommendations: string[];
  performance_metrics: {
    avg_step_time: number;
    slowest_step: string;
    fastest_step: string;
  };
}
const DashboardContainer = styled.div`
  padding: 32px 64px;
  max-width: 1800px;
  margin: 0 auto;
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
  width: 100%;
  @media (max-width: 768px) {
    padding: 16px;
    max-width: 100%;
  }
`;
const DashboardHeader = styled.div`
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
const DashboardTitle = styled.h1`
  font-size: 32px;
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
const ChartSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 32px;
  margin-bottom: 48px;
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
  @media (max-width: 768px) {
    gap: 16px;
    margin-bottom: 24px;
  }
  @media (min-width: 1600px) {
    grid-template-columns: 1.2fr 2.8fr;
    gap: 40px;
  }
`;
const ChartCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 32px;
  box-shadow: ${props => props.theme.shadows.medium};
`;
const ChartTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 24px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;
const StatCard = styled.div<{ $variant?: 'success' | 'danger' | 'warning' | 'info' }>`
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
      switch (props.$variant) {
        case 'success': return `linear-gradient(90deg, ${props.theme.colors.success}, ${props.theme.colors.success}dd)`;
        case 'danger': return `linear-gradient(90deg, ${props.theme.colors.error}, ${props.theme.colors.error}dd)`;
        case 'warning': return `linear-gradient(90deg, ${props.theme.colors.warning}, ${props.theme.colors.warning}dd)`;
        case 'info': return `linear-gradient(90deg, ${props.theme.colors.primary}, ${props.theme.colors.primary}dd)`;
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
const StatChange = styled.div<{ $positive?: boolean }>`
  font-size: 14px;
  color: ${props => props.$positive ? props.theme.colors.success : props.theme.colors.error};
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
const ExecutionItem = styled.div<{ $clickable?: boolean }>`
  display: grid;
  grid-template-columns: 140px 3fr 140px 120px 100px 100px 100px 140px 140px;
  align-items: flex-start;
  padding: 20px 32px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  transition: all 0.2s ease;
  cursor: ${props => props.$clickable ? 'pointer' : 'default'};
  gap: 24px;
  position: relative;
  min-height: 60px;
  &:hover {
    background: ${props => props.$clickable ? 'rgba(99, 102, 241, 0.05)' : 'rgba(0, 0, 0, 0.02)'};
    transform: ${props => props.$clickable ? 'translateY(-1px)' : 'none'};
    box-shadow: ${props => props.$clickable ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none'};
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
const StatusBadge = styled.span<{ $status: string }>`
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
    switch (props.$status) {
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
const StatusColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  min-width: 140px;
`;
const FailureReason = styled.div`
  background: rgba(229, 62, 62, 0.1);
  border: 1px solid rgba(229, 62, 62, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  margin-top: 4px;
  font-size: 12px;
  color: ${props => props.theme.colors.error};
  max-width: 300px;
  line-height: 1.4;
  word-wrap: break-word;
  white-space: normal;
`;
const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px;
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
`;
const ErrorMessage = styled.div`
  background: ${props => props.theme.colors.error}20;
  color: ${props => props.theme.colors.error};
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid ${props => props.theme.colors.error}40;
`;
const SummaryButton = styled.button<{ $isGenerating?: boolean }>`
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  margin-left: 8px;
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  &:disabled {
    background: #a0aec0;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  ${props => props.$isGenerating && `
    background: linear-gradient(45deg, #667eea, #764ba2, #667eea);
    background-size: 200% 200%;
    animation: gradient 2s ease infinite;
  `}
  @keyframes gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;
const SummaryCard = styled.div<{ isExpanded?: boolean }>`
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05));
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
  transition: all 0.3s ease;
  ${props => props.isExpanded && `
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.15);
    border-color: rgba(102, 126, 234, 0.4);
  `}
`;
const SummaryText = styled.div`
  color: ${props => props.theme.colors.text};
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 8px;
`;
const InsightsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;
const InsightTag = styled.span`
  background: rgba(102, 126, 234, 0.1);
  color: ${props => props.theme.colors.primary};
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid rgba(102, 126, 234, 0.2);
`;
const BindingCard = styled.div<{ isExpanded?: boolean }>`
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.05), rgba(139, 195, 74, 0.05));
  border: 1px solid rgba(76, 175, 80, 0.2);
  border-radius: 8px;
  padding: 12px;
  margin-top: 8px;
  transition: all 0.3s ease;
  ${props => props.isExpanded && `
    box-shadow: 0 4px 16px rgba(76, 175, 80, 0.15);
    border-color: rgba(76, 175, 80, 0.4);
  `}
`;
const BindingHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;
const BindingTitle = styled.h4`
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
`;
const BindingCount = styled.span`
  background: rgba(76, 175, 80, 0.2);
  color: ${props => props.theme.colors.text};
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
`;
const BindingList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
const BindingItem = styled.div`
  background: rgba(255, 255, 255, 0.5);
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 3px solid rgba(76, 175, 80, 0.6);
`;
const BindingName = styled.div`
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  font-size: 13px;
`;
const BindingDetails = styled.div`
  font-size: 11px;
  color: ${props => props.theme.colors.textSecondary};
  margin-top: 2px;
`;
const BindingButton = styled.button<{ $isLoading?: boolean }>`
  background: linear-gradient(135deg, #4caf50, #8bc34a);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
  margin-left: 8px;
  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
  }
  &:disabled {
    background: #a0aec0;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  ${props => props.$isLoading && `
    background: linear-gradient(45deg, #4caf50, #8bc34a, #4caf50);
    background-size: 200% 200%;
    animation: gradient 2s ease infinite;
  `}
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
  prompt_id?: string;
  test_name: string;
  prompt_description?: string;
  status: string;
  success_rate: number;
  start_time: string;
  duration?: number;
  steps_completed?: number;
  total_steps?: number;
}
const ExecutionDashboard: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ExecutionStats | null>(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // M7: LLM Summary state
  const [summaries, setSummaries] = useState<Record<string, ExecutionSummaryResponse>>({});
  const [generatingSummaries, setGeneratingSummaries] = useState<Set<string>>(new Set());
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  
  // M7: Data Resolver Traceability state
  const [bindingUsages, setBindingUsages] = useState<Record<string, any>>({});
  const [loadingBindings, setLoadingBindings] = useState<Set<string>>(new Set());
  const [expandedBindings, setExpandedBindings] = useState<Set<string>>(new Set());
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch real execution statistics from authenticated API
      console.log('🐛 Starting getExecutionStats call...');
      try {
        const statsData = await executionApiService.getExecutionStats();
        console.log('🐛 Raw stats response:', statsData);
        
        // Extract the actual stats data from the MCP response
        const statsValues = statsData?.data || statsData || {}; // Handle both nested and direct response formats
        console.log('🐛 Stats values:', statsValues);
        
        const realStats: ExecutionStats = {
          total_executions: statsValues.total_executions || 0,
          successful_executions: statsValues.successful_executions || 0,
          failed_executions: statsValues.failed_executions || 0,
          success_rate: (statsValues.success_rate || 0) / 100, // API sends percentages, convert to decimal for internal use
          recent_executions_24h: statsValues.recent_executions_24h || 0,
          avg_execution_time: statsValues.avg_execution_time || 0
        };
        console.log('Mapped stats:', realStats);
        setStats(realStats);
      } catch (statsError) {
        console.error('Error in getExecutionStats:', statsError);
        console.error('Stats error details:', {
          message: statsError instanceof Error ? statsError.message : String(statsError),
          stack: statsError instanceof Error ? statsError.stack : undefined,
          name: statsError instanceof Error ? statsError.name : 'Unknown'
        });
      }
      // Fetch real execution logs from authenticated API
      const executionsResponse = await executionApiService.getRecentExecutions({ limit: 20 });
      console.log('Raw executions response:', executionsResponse);
      
      let executionsData: any[] = [];
      
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
            console.error('Failed to parse MCP content:', e);
            executionsData = [];
          }
        }
      } else if (executionsResponse?.result) {
        executionsData = Array.isArray(executionsResponse.result) ? executionsResponse.result : 
                        (executionsResponse.result?.data || []);
      }
      
      console.log('🐛 Raw executions response:', executionsResponse);
      console.log('🐛 Raw executionsData before mapping:', executionsData);
      
      const realExecutions: ExecutionRecord[] = executionsData.map((exec: any, index: number) => {
        console.log(`🐛 Processing execution ${index}:`, exec);
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
      console.log('🐛 Final mapped executions:', realExecutions);
      setExecutions(realExecutions);
    } catch (err) {
      console.error(err);
      setError('Failed to load execution data. Please check your connection and try again.');
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
    navigate(`/execution/${executionId}`);
  };
  // M7: LLM Summary Functions
  const generateSummary = async (executionId: string, style: "brief" | "detailed" = "brief") => {
    if (generatingSummaries.has(executionId)) return;
    setGeneratingSummaries(prev => new Set(prev).add(executionId));
    
    try {
      const summaryResponse = await executionApiService.generateExecutionSummary(executionId);
      const summary: ExecutionSummaryResponse = {
        execution_id: summaryResponse.execution_id || executionId,
        summary_text: summaryResponse.summary_text || "Summary generated successfully",
        generated_at: summaryResponse.generated_at || new Date().toISOString(),
        model_used: summaryResponse.model_used || "gpt-4",
        key_insights: (summaryResponse as any).key_insights || [], // Will be populated from API if available
        recommendations: (summaryResponse as any).recommendations || [], // Will be populated from API if available
        performance_metrics: (summaryResponse as any).performance_metrics || {
          avg_step_time: 0,
          slowest_step: '',
          fastest_step: ''
        }
      };
      
      setSummaries(prev => ({
        ...prev,
        [executionId]: summary
      }));
      // Auto-expand for detailed summaries
      if (style === "detailed") {
        setExpandedSummaries(prev => new Set(prev).add(executionId));
      }
    } catch (err) {
      console.error(err);
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
      console.error(err);
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
  };
  if (loading) {
    return (
      <DashboardContainer>
        <DashboardHeader>
          <DashboardTitle>
            <Activity size={32} />
            Execution Dashboard
          </DashboardTitle>
          <RefreshButton disabled>
            <RefreshCw size={16} />
            Loading...
          </RefreshButton>
        </DashboardHeader>
        <DashboardSkeleton />
      </DashboardContainer>
    );
  }
  return (
    <DashboardContainer theme={theme}>
      <DashboardHeader theme={theme}>
        <div>
          <DashboardTitle theme={theme}>
            <Activity size={32} />
            Execution Dashboard
          </DashboardTitle>
          <MCPStatus compact={true} />
        </div>
        <RefreshButton onClick={fetchDashboardData} disabled={loading}>
          <RefreshCw size={16} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </RefreshButton>
      </DashboardHeader>
      {error && <ErrorMessage theme={theme}>{error}</ErrorMessage>}
      {stats && (
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
                Success Rate
              </StatTitle>
              <StatValue>{(stats.success_rate * 100).toFixed(1)}%</StatValue>
              <StatChange $positive={stats.success_rate > 0.7}>
                <TrendingUp size={14} />
                {stats.successful_executions}/{stats.total_executions} successful
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
            <StatCard $variant="warning">
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
        </>
      )}
      <ExecutionList theme={theme}>
        <ExecutionListHeader theme={theme}>
          <Activity size={20} />
          Execution History
        </ExecutionListHeader>
        {executions.length === 0 ? (
          <LoadingSpinner>No execution records found</LoadingSpinner>
        ) : loading ? (
          <ExecutionListSkeleton count={5} />
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
                  <MetricValue type="error">
                    {((execution.total_steps || 0) - (execution.steps_completed || execution.total_steps || 0))}
                  </MetricValue>
                  <div>
                    <StatusBadge $status={execution.status}>
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
            ))}
          </>
        )}
      </ExecutionList>
    </DashboardContainer>
  );
};
export default ExecutionDashboard;