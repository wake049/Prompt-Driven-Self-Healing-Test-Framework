/**
 * Policy Execution Metrics Component
 * Detailed view of policy execution performance and statistics
 */
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, BarChart, Bar
} from 'recharts';
import { Clock, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react';

interface ExecutionLog {
  id: string;
  run_id: string;
  step_index: number;
  policy_id: string;
  created_at: string;
  status: string;
  evaluation_result: {
    matched: boolean;
    confidence_score: number;
    evaluation_time_ms: number;
  };
}

interface PolicyExecutionMetricsProps {
  executionLogs: ExecutionLog[];
}

export const PolicyExecutionMetrics: React.FC<PolicyExecutionMetricsProps> = ({
  executionLogs
}) => {
  const metrics = useMemo(() => {
    if (!executionLogs.length) return null;

    const totalExecutions = executionLogs.length;
    const successfulMatches = executionLogs.filter(log => 
      log.evaluation_result?.matched
    ).length;
    
    const avgConfidence = executionLogs.reduce((sum, log) => 
      sum + (log.evaluation_result?.confidence_score || 0), 0
    ) / totalExecutions;

    const avgEvaluationTime = executionLogs.reduce((sum, log) => 
      sum + (log.evaluation_result?.evaluation_time_ms || 0), 0
    ) / totalExecutions;

    // Group by policy ID
    const policyPerformance = executionLogs.reduce((acc, log) => {
      if (!acc[log.policy_id]) {
        acc[log.policy_id] = {
          policy_id: log.policy_id,
          executions: 0,
          matches: 0,
          totalConfidence: 0,
          totalTime: 0
        };
      }
      
      acc[log.policy_id].executions++;
      if (log.evaluation_result?.matched) acc[log.policy_id].matches++;
      acc[log.policy_id].totalConfidence += log.evaluation_result?.confidence_score || 0;
      acc[log.policy_id].totalTime += log.evaluation_result?.evaluation_time_ms || 0;
      
      return acc;
    }, {} as Record<string, any>);

    const policyStats = Object.values(policyPerformance).map((policy: any) => ({
      policy_id: policy.policy_id.substring(0, 12) + '...',
      full_policy_id: policy.policy_id,
      executions: policy.executions,
      match_rate: (policy.matches / policy.executions) * 100,
      avg_confidence: policy.totalConfidence / policy.executions,
      avg_time: policy.totalTime / policy.executions
    }));

    // Time series data for last 50 executions
    const timeSeriesData = executionLogs.slice(-50).map((log, index) => ({
      execution: index + 1,
      confidence: log.evaluation_result?.confidence_score || 0,
      evaluation_time: log.evaluation_result?.evaluation_time_ms || 0,
      matched: log.evaluation_result?.matched ? 1 : 0,
      timestamp: new Date(log.created_at).getTime()
    }));

    return {
      totalExecutions,
      successfulMatches,
      successRate: (successfulMatches / totalExecutions) * 100,
      avgConfidence,
      avgEvaluationTime,
      policyStats,
      timeSeriesData
    };
  }, [executionLogs]);

  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500 text-center">No execution data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Executions</p>
                <p className="text-2xl font-bold">{metrics.totalExecutions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</p>
                <Progress value={metrics.successRate} className="mt-1 h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Avg Confidence</p>
                <p className="text-2xl font-bold">{(metrics.avgConfidence * 100).toFixed(1)}%</p>
                <Progress value={metrics.avgConfidence * 100} className="mt-1 h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Avg Eval Time</p>
                <p className="text-2xl font-bold">{metrics.avgEvaluationTime.toFixed(0)}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Execution Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Timeline (Last 50 Executions)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="execution" />
              <YAxis yAxisId="confidence" orientation="left" domain={[0, 1]} />
              <YAxis yAxisId="time" orientation="right" />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'confidence' ? `${(value * 100).toFixed(1)}%` : 
                  name === 'evaluation_time' ? `${value}ms` : value,
                  name === 'confidence' ? 'Confidence' : 
                  name === 'evaluation_time' ? 'Eval Time' : 'Matched'
                ]}
              />
              <Line 
                yAxisId="confidence"
                type="monotone" 
                dataKey="confidence" 
                stroke="#8884d8" 
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Confidence"
              />
              <Line 
                yAxisId="time"
                type="monotone" 
                dataKey="evaluation_time" 
                stroke="#82ca9d" 
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Eval Time"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Policy Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Policy Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.policyStats.map((policy, index) => (
              <div key={policy.full_policy_id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium">{policy.policy_id}</p>
                    <p className="text-sm text-gray-500">{policy.executions} executions</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={policy.match_rate > 80 ? "default" : "secondary"}>
                      {policy.match_rate.toFixed(1)}% match rate
                    </Badge>
                    <Badge variant="outline">
                      {policy.avg_time.toFixed(0)}ms avg
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Match Rate</p>
                    <Progress value={policy.match_rate} className="h-2" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Confidence</p>
                    <Progress value={policy.avg_confidence * 100} className="h-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Confidence vs Evaluation Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ScatterChart data={metrics.timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="confidence" />
                <YAxis dataKey="evaluation_time" />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'evaluation_time' ? `${value}ms` : `${(value * 100).toFixed(1)}%`,
                    name === 'evaluation_time' ? 'Evaluation Time' : 'Confidence'
                  ]}
                />
                <Scatter 
                  dataKey="evaluation_time" 
                  fill="#8884d8"
                  name="Execution Points"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policy Execution Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={metrics.policyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="policy_id" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="executions" fill="#8884d8" name="Executions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};