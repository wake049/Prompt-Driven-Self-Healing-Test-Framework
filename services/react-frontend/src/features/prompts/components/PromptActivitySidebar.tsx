/**
 * PromptActivitySidebar Component
 * 
 * Displays a real-time activity feed for a prompt.
 * Shows all collaboration activities: edits, comments, reviews, approvals, etc.
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { 
  Edit3, MessageCircle, Check, X, GitBranch, Play, 
  User, Clock, AlertCircle, Send, FileText, RefreshCw
} from 'lucide-react';
import { collaborativeReviewApi, PromptActivity } from '../collaborativeReviewApi';

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
`;

const ActivityItem = styled.div`
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid ${props => props.theme.colors.border};

  &:last-child {
    border-bottom: none;
  }
`;

const ActivityIcon = styled.div<{ $type: string }>`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  ${props => {
    switch (props.$type) {
      case 'approved':
        return `
          background: ${props.theme.colors.success}15;
          color: ${props.theme.colors.success};
        `;
      case 'rejected':
      case 'changes_requested':
        return `
          background: ${props.theme.colors.error}15;
          color: ${props.theme.colors.error};
        `;
      case 'commented':
        return `
          background: ${props.theme.colors.primary}15;
          color: ${props.theme.colors.primary};
        `;
      case 'review_requested':
        return `
          background: ${props.theme.colors.warning}15;
          color: ${props.theme.colors.warning};
        `;
      case 'version_created':
        return `
          background: ${props.theme.colors.info || props.theme.colors.primary}15;
          color: ${props.theme.colors.info || props.theme.colors.primary};
        `;
      case 'activated':
        return `
          background: ${props.theme.colors.success}15;
          color: ${props.theme.colors.success};
        `;
      case 'test_plan_saved':
        return `
          background: ${props.theme.colors.info || props.theme.colors.primary}15;
          color: ${props.theme.colors.info || props.theme.colors.primary};
        `;
      default:
        return `
          background: ${props.theme.colors.textSecondary}15;
          color: ${props.theme.colors.textSecondary};
        `;
    }
  }}
`;

const ActivityContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActivitySummary = styled.div`
  font-size: 13px;
  color: ${props => props.theme.colors.text};
  line-height: 1.4;

  strong {
    font-weight: 600;
  }
`;

const ActivityTime = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  margin-top: 4px;
`;

const ActivityDetails = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  background: ${props => props.theme.colors.background};
  padding: 8px;
  border-radius: 6px;
  margin-top: 8px;
`;

const LoadingState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 24px;
  color: ${props => props.theme.colors.textSecondary};
`;

const EmptyIcon = styled.div`
  font-size: 32px;
  margin-bottom: 8px;
`;

const EmptyText = styled.div`
  font-size: 13px;
`;

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  margin-top: 12px;
  background: transparent;
  border: 1px dashed ${props => props.theme.colors.border};
  border-radius: 8px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.theme.colors.background};
    color: ${props => props.theme.colors.text};
  }
`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'created':
    case 'edited':
      return <Edit3 size={14} />;
    case 'test_plan_saved':
      return <FileText size={14} />;
    case 'commented':
      return <MessageCircle size={14} />;
    case 'approved':
      return <Check size={14} />;
    case 'rejected':
    case 'changes_requested':
      return <X size={14} />;
    case 'version_created':
      return <GitBranch size={14} />;
    case 'review_requested':
      return <Send size={14} />;
    case 'activated':
      return <Play size={14} />;
    case 'archived':
      return <FileText size={14} />;
    default:
      return <Clock size={14} />;
  }
};

const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

const formatActivitySummary = (activity: PromptActivity): React.ReactNode => {
  const actor = activity.actor_name || 'Someone';
  const details = activity.details as Record<string, any> | undefined;
  
  switch (activity.activity_type) {
    case 'created':
      return <><strong>{actor}</strong> created this prompt</>;
    case 'edited': {
      const changedFields = details?.changed_fields as string[] | undefined;
      if (changedFields && changedFields.length > 0) {
        const fieldLabels: Record<string, string> = {
          'content': 'content',
          'title': 'title', 
          'external_id': 'external ID',
          'description': 'description',
          'page_url': 'page URL',
          'expected_result': 'expected result'
        };
        const formattedFields = changedFields
          .map(f => fieldLabels[f] || f)
          .join(', ');
        return <><strong>{actor}</strong> edited {formattedFields}</>;
      }
      return <><strong>{actor}</strong> edited the prompt</>;
    }
    case 'test_plan_saved': {
      const stepCount = details?.step_count;
      if (stepCount !== undefined) {
        return <><strong>{actor}</strong> saved test plan ({stepCount} steps)</>;
      }
      return <><strong>{actor}</strong> saved the test plan</>;
    }
    case 'version_created':
      return <><strong>{actor}</strong> created a new version</>;
    case 'review_requested':
      return <><strong>{actor}</strong> requested a review</>;
    case 'approved':
      return <><strong>{actor}</strong> approved this version ✓</>;
    case 'rejected':
    case 'changes_requested':
      return <><strong>{actor}</strong> requested changes</>;
    case 'commented':
      return <><strong>{actor}</strong> added a comment</>;
    case 'activated':
      return <><strong>{actor}</strong> activated this version for testing</>;
    case 'archived':
      return <><strong>{actor}</strong> archived this version</>;
    default:
      return activity.summary || <><strong>{actor}</strong> made changes</>;
  }
};

// =============================================================================
// COMPONENT
// =============================================================================

interface PromptActivitySidebarProps {
  promptId: string;
  onClose?: () => void;
}

export const PromptActivitySidebar: React.FC<PromptActivitySidebarProps> = ({
  promptId
}) => {
  const [activities, setActivities] = useState<PromptActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await collaborativeReviewApi.getActivity(promptId);
      setActivities(data);
    } catch (err: any) {
      console.error('Failed to fetch activities:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [promptId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  if (loading) {
    return <LoadingState>Loading activity...</LoadingState>;
  }

  if (error) {
    return (
      <EmptyState>
        <EmptyIcon>⚠️</EmptyIcon>
        <EmptyText>Failed to load activity</EmptyText>
        <RefreshButton onClick={fetchActivities}>
          <RefreshCw size={14} />
          Retry
        </RefreshButton>
      </EmptyState>
    );
  }

  if (activities.length === 0) {
    return (
      <EmptyState>
        <EmptyIcon>📋</EmptyIcon>
        <EmptyText>No activity yet</EmptyText>
      </EmptyState>
    );
  }

  return (
    <ActivityList>
      {activities.map(activity => (
        <ActivityItem key={activity.id}>
          <ActivityIcon $type={activity.activity_type}>
            {getActivityIcon(activity.activity_type)}
          </ActivityIcon>
          <ActivityContent>
            <ActivitySummary>
              {formatActivitySummary(activity)}
            </ActivitySummary>
            <ActivityTime>{formatRelativeTime(activity.created_at)}</ActivityTime>
            {activity.details && activity.details.comment && (
              <ActivityDetails>
                "{activity.details.comment}"
              </ActivityDetails>
            )}
          </ActivityContent>
        </ActivityItem>
      ))}
      
      <RefreshButton onClick={fetchActivities}>
        <RefreshCw size={14} />
        Refresh
      </RefreshButton>
    </ActivityList>
  );
};

export default PromptActivitySidebar;
