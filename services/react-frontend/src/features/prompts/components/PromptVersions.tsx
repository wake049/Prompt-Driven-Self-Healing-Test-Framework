/**
 * PromptVersions Component
 * 
 * Displays version history with review workflow for prompts.
 * Features:
 * - Version list with status badges
 * - Diff view between versions
 * - Request review functionality
 * - Approve/reject actions
 * - Comments per version
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled, { useTheme } from 'styled-components';
import { 
  GitBranch, Check, X, Clock, Send, MessageCircle, 
  ChevronDown, ChevronRight, User, AlertCircle, CheckCircle,
  Play, Eye, Edit3, Users
} from 'lucide-react';
import { 
  collaborativeReviewApi, 
  PromptVersion, 
  ReviewRequest, 
  PromptComment,
  TeamMember 
} from '../collaborativeReviewApi';

// =============================================================================
// STYLED COMPONENTS
// =============================================================================

const Container = styled.div`
  padding: 0;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
`;

const CreateButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const VersionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const VersionCard = styled.div<{ $isActive?: boolean; $isExpanded?: boolean }>`
  background: ${props => props.theme.colors.surface};
  border: 2px solid ${props => props.$isActive ? props.theme.colors.success : props.theme.colors.border};
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;

  ${props => props.$isActive && `
    box-shadow: 0 0 0 3px ${props.theme.colors.success}20;
  `}
`;

const VersionHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 16px;
  cursor: pointer;
  gap: 12px;

  &:hover {
    background: ${props => props.theme.colors.background};
  }
`;

const VersionInfo = styled.div`
  flex: 1;
`;

const VersionTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const VersionMeta = styled.div`
  font-size: 13px;
  color: ${props => props.theme.colors.textSecondary};
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  
  ${props => {
    switch (props.$status) {
      case 'approved':
        return `
          background: ${props.theme.colors.success}15;
          color: ${props.theme.colors.success};
        `;
      case 'rejected':
        return `
          background: ${props.theme.colors.error}15;
          color: ${props.theme.colors.error};
        `;
      case 'pending_review':
        return `
          background: ${props.theme.colors.warning}15;
          color: ${props.theme.colors.warning};
        `;
      default:
        return `
          background: ${props.theme.colors.textSecondary}15;
          color: ${props.theme.colors.textSecondary};
        `;
    }
  }}
`;

const ActiveBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => props.theme.colors.success};
  color: white;
`;

const VersionBody = styled.div`
  padding: 0 16px 16px;
  border-top: 1px solid ${props => props.theme.colors.border};
`;

const Section = styled.div`
  margin-top: 16px;
`;

const SectionTitle = styled.h4`
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 12px 0;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'success' | 'danger' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;

  ${props => {
    switch (props.$variant) {
      case 'success':
        return `
          background: ${props.theme.colors.success};
          color: white;
          &:hover { filter: brightness(1.1); }
        `;
      case 'danger':
        return `
          background: ${props.theme.colors.error};
          color: white;
          &:hover { filter: brightness(1.1); }
        `;
      case 'primary':
        return `
          background: ${props.theme.colors.primary};
          color: white;
          &:hover { filter: brightness(1.1); }
        `;
      default:
        return `
          background: ${props.theme.colors.background};
          color: ${props.theme.colors.text};
          border: 1px solid ${props.theme.colors.border};
          &:hover { background: ${props.theme.colors.border}; }
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ReviewersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ReviewerItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
`;

const ReviewerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ReviewerAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${props => props.theme.colors.primary}20;
  color: ${props => props.theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ReviewerName = styled.span`
  font-size: 14px;
  color: ${props => props.theme.colors.text};
`;

const ReviewStatus = styled.span<{ $status: string }>`
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  
  ${props => {
    switch (props.$status) {
      case 'approved':
        return `color: ${props.theme.colors.success};`;
      case 'changes_requested':
        return `color: ${props.theme.colors.error};`;
      default:
        return `color: ${props.theme.colors.textSecondary};`;
    }
  }}
`;

const CommentsSection = styled.div`
  margin-top: 16px;
`;

const CommentCard = styled.div`
  padding: 12px;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
  margin-bottom: 8px;
`;

const CommentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const CommentAuthor = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: ${props => props.theme.colors.text};
`;

const CommentDate = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
`;

const CommentContent = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.text};
  margin: 0;
  line-height: 1.5;
`;

const CommentInput = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const TextArea = styled.textarea`
  flex: 1;
  padding: 10px 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  resize: none;
  min-height: 60px;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: ${props => props.theme.colors.textSecondary};
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
`;

const EmptyTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
  color: ${props => props.theme.colors.text};
`;

const EmptyText = styled.div`
  font-size: 14px;
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 16px 0;
`;

const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
`;

const ReviewerCheckbox = styled.label`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.theme.colors.border};
  }

  input {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  padding: 48px;
  color: ${props => props.theme.colors.textSecondary};
`;

// =============================================================================
// COMPONENT
// =============================================================================

interface PromptVersionsProps {
  promptId: string;
  currentPlan?: any;
  onVersionActivated?: () => void;
}

export const PromptVersions: React.FC<PromptVersionsProps> = ({
  promptId,
  currentPlan,
  onVersionActivated
}) => {
  const theme = useTheme();
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Record<string, ReviewRequest[]>>({});
  const [comments, setComments] = useState<Record<string, PromptComment[]>>({});
  const [newComment, setNewComment] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedVersionForReview, setSelectedVersionForReview] = useState<PromptVersion | null>(null);
  const [availableReviewers, setAvailableReviewers] = useState<TeamMember[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Fetch versions
  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await collaborativeReviewApi.getVersions(promptId);
      setVersions(data);
      
      // Auto-expand the active version or first version
      if (data.length > 0) {
        const activeVersion = data.find(v => v.is_active) || data[0];
        setExpandedVersionId(activeVersion.id);
      }
    } catch (err: any) {
      console.error('Failed to fetch versions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [promptId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  // Fetch reviews and comments when version is expanded
  const fetchVersionDetails = async (versionId: string) => {
    try {
      const [reviewsData, commentsData] = await Promise.all([
        collaborativeReviewApi.getVersionReviews(promptId, versionId),
        collaborativeReviewApi.getComments(promptId, versionId)
      ]);
      
      setReviews(prev => ({ ...prev, [versionId]: reviewsData }));
      setComments(prev => ({ ...prev, [versionId]: commentsData }));
    } catch (err) {
      console.error('Failed to fetch version details:', err);
    }
  };

  const handleToggleVersion = (versionId: string) => {
    if (expandedVersionId === versionId) {
      setExpandedVersionId(null);
    } else {
      setExpandedVersionId(versionId);
      if (!reviews[versionId]) {
        fetchVersionDetails(versionId);
      }
    }
  };

  const handleCreateVersion = async () => {
    if (!currentPlan) {
      alert('No test plan available to create a version from');
      return;
    }

    try {
      setSubmitting(true);
      await collaborativeReviewApi.createVersion(promptId, {
        title: `Version ${versions.length + 1}`,
        change_summary: 'Created from current test plan',
        plan_snapshot: currentPlan
      });
      await fetchVersions();
    } catch (err: any) {
      console.error('Failed to create version:', err);
      alert('Failed to create version: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateVersion = async (version: PromptVersion) => {
    if (!confirm(`Activate version ${version.version_number}? This will update the test plan used for execution.`)) {
      return;
    }

    try {
      setSubmitting(true);
      await collaborativeReviewApi.activateVersion(promptId, version.id);
      await fetchVersions();
      onVersionActivated?.();
    } catch (err: any) {
      console.error('Failed to activate version:', err);
      alert('Failed to activate version: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReview = async (version: PromptVersion) => {
    setSelectedVersionForReview(version);
    setSelectedReviewers([]);
    
    try {
      const reviewers = await collaborativeReviewApi.getAvailableReviewers(promptId);
      setAvailableReviewers(reviewers);
      setShowReviewModal(true);
    } catch (err: any) {
      console.error('Failed to fetch reviewers:', err);
      alert('Failed to load team members: ' + err.message);
    }
  };

  const handleSubmitReviewRequest = async () => {
    if (!selectedVersionForReview || selectedReviewers.length === 0) return;

    try {
      setSubmitting(true);
      await collaborativeReviewApi.requestReview(promptId, selectedVersionForReview.id, {
        reviewer_ids: selectedReviewers
      });
      setShowReviewModal(false);
      await fetchVersions();
      if (expandedVersionId) {
        await fetchVersionDetails(expandedVersionId);
      }
    } catch (err: any) {
      console.error('Failed to request review:', err);
      alert('Failed to request review: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitComment = async (versionId: string) => {
    if (!newComment.trim()) return;

    try {
      await collaborativeReviewApi.createComment(promptId, {
        content: newComment,
        version_id: versionId
      });
      setNewComment('');
      await fetchVersionDetails(versionId);
    } catch (err: any) {
      console.error('Failed to add comment:', err);
      alert('Failed to add comment: ' + err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={14} />;
      case 'rejected':
        return <X size={14} />;
      case 'pending_review':
        return <Clock size={14} />;
      default:
        return <Edit3 size={14} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Changes Requested';
      case 'pending_review': return 'Pending Review';
      case 'draft': return 'Draft';
      case 'archived': return 'Archived';
      default: return status;
    }
  };

  if (loading) {
    return <LoadingSpinner>Loading versions...</LoadingSpinner>;
  }

  if (error) {
    return (
      <EmptyState>
        <EmptyIcon>⚠️</EmptyIcon>
        <EmptyTitle>Error Loading Versions</EmptyTitle>
        <EmptyText>{error}</EmptyText>
      </EmptyState>
    );
  }

  return (
    <Container>
      <Header>
        <Title>
          <GitBranch size={20} />
          Version History
        </Title>
        <CreateButton onClick={handleCreateVersion} disabled={submitting || !currentPlan}>
          + Create New Version
        </CreateButton>
      </Header>

      {versions.length === 0 ? (
        <EmptyState>
          <EmptyIcon>📋</EmptyIcon>
          <EmptyTitle>No Versions Yet</EmptyTitle>
          <EmptyText>
            Create your first version to start tracking changes and enable team reviews.
          </EmptyText>
          <ActionButton 
            $variant="primary" 
            onClick={handleCreateVersion}
            disabled={!currentPlan}
            style={{ marginTop: '16px' }}
          >
            Create First Version
          </ActionButton>
        </EmptyState>
      ) : (
        <VersionsList>
          {versions.map(version => (
            <VersionCard 
              key={version.id} 
              $isActive={version.is_active}
              $isExpanded={expandedVersionId === version.id}
            >
              <VersionHeader onClick={() => handleToggleVersion(version.id)}>
                {expandedVersionId === version.id ? (
                  <ChevronDown size={18} color={theme.colors.textSecondary} />
                ) : (
                  <ChevronRight size={18} color={theme.colors.textSecondary} />
                )}
                
                <VersionInfo>
                  <VersionTitle>
                    v{version.version_number}
                    {version.title && ` - ${version.title}`}
                    {version.is_active && (
                      <ActiveBadge>
                        <Play size={12} />
                        Active
                      </ActiveBadge>
                    )}
                  </VersionTitle>
                  <VersionMeta>
                    <span>
                      {version.created_by_name || 'Unknown'} • {formatDate(version.created_at)}
                    </span>
                    {version.step_count !== undefined && (
                      <span>{version.step_count} steps</span>
                    )}
                  </VersionMeta>
                </VersionInfo>

                <StatusBadge $status={version.status}>
                  {getStatusIcon(version.status)}
                  {getStatusLabel(version.status)}
                </StatusBadge>

                {version.pending_reviews !== undefined && version.pending_reviews > 0 && (
                  <StatusBadge $status="pending_review">
                    <Users size={12} />
                    {version.pending_reviews} pending
                  </StatusBadge>
                )}
              </VersionHeader>

              {expandedVersionId === version.id && (
                <VersionBody>
                  {version.change_summary && (
                    <Section>
                      <SectionTitle>Change Summary</SectionTitle>
                      <p style={{ color: theme.colors.text, margin: 0, fontSize: '14px' }}>
                        {version.change_summary}
                      </p>
                    </Section>
                  )}

                  {/* Reviews Section */}
                  {reviews[version.id] && reviews[version.id].length > 0 && (
                    <Section>
                      <SectionTitle>
                        <MessageCircle size={14} style={{ marginRight: '6px' }} />
                        Reviews
                      </SectionTitle>
                      <ReviewersList>
                        {reviews[version.id].map(review => (
                          <ReviewerItem key={review.id}>
                            <ReviewerInfo>
                              <ReviewerAvatar>
                                <User size={16} />
                              </ReviewerAvatar>
                              <div>
                                <ReviewerName>{review.reviewer_name || review.reviewer_email}</ReviewerName>
                                {review.review_comment && (
                                  <p style={{ 
                                    fontSize: '13px', 
                                    color: theme.colors.textSecondary,
                                    margin: '4px 0 0 0'
                                  }}>
                                    "{review.review_comment}"
                                  </p>
                                )}
                              </div>
                            </ReviewerInfo>
                            <ReviewStatus $status={review.status}>
                              {review.status === 'approved' && <><Check size={14} /> Approved</>}
                              {review.status === 'changes_requested' && <><AlertCircle size={14} /> Changes Requested</>}
                              {review.status === 'pending' && <><Clock size={14} /> Pending</>}
                            </ReviewStatus>
                          </ReviewerItem>
                        ))}
                      </ReviewersList>
                    </Section>
                  )}

                  {/* Comments Section */}
                  <CommentsSection>
                    <SectionTitle>
                      <MessageCircle size={14} style={{ marginRight: '6px' }} />
                      Comments
                    </SectionTitle>
                    
                    {comments[version.id] && comments[version.id].length > 0 ? (
                      comments[version.id].map(comment => (
                        <CommentCard key={comment.id}>
                          <CommentHeader>
                            <CommentAuthor>{comment.author_name || 'Unknown'}</CommentAuthor>
                            <CommentDate>{formatDate(comment.created_at)}</CommentDate>
                          </CommentHeader>
                          <CommentContent>{comment.content}</CommentContent>
                        </CommentCard>
                      ))
                    ) : (
                      <p style={{ color: theme.colors.textSecondary, fontSize: '14px' }}>
                        No comments yet
                      </p>
                    )}

                    <CommentInput>
                      <TextArea
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            handleSubmitComment(version.id);
                          }
                        }}
                      />
                      <ActionButton 
                        $variant="primary"
                        onClick={() => handleSubmitComment(version.id)}
                        disabled={!newComment.trim()}
                      >
                        <Send size={14} />
                      </ActionButton>
                    </CommentInput>
                  </CommentsSection>

                  {/* Action Buttons */}
                  <ActionButtons>
                    {!version.is_active && (version.status === 'approved' || version.status === 'draft') && (
                      <ActionButton 
                        $variant="success" 
                        onClick={() => handleActivateVersion(version)}
                        disabled={submitting}
                      >
                        <Play size={14} />
                        Make Active
                      </ActionButton>
                    )}
                    
                    {version.status === 'draft' && (
                      <ActionButton 
                        $variant="primary"
                        onClick={() => handleRequestReview(version)}
                        disabled={submitting}
                      >
                        <Users size={14} />
                        Request Review
                      </ActionButton>
                    )}

                    <ActionButton $variant="secondary">
                      <Eye size={14} />
                      View Details
                    </ActionButton>
                  </ActionButtons>
                </VersionBody>
              )}
            </VersionCard>
          ))}
        </VersionsList>
      )}

      {/* Request Review Modal */}
      {showReviewModal && (
        <Modal onClick={() => setShowReviewModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalTitle>Request Review</ModalTitle>
            <p style={{ color: theme.colors.textSecondary, marginBottom: '16px' }}>
              Select team members to review version {selectedVersionForReview?.version_number}
            </p>

            {availableReviewers.length === 0 ? (
              <p style={{ color: theme.colors.textSecondary }}>
                No other team members available to review.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableReviewers.map(reviewer => (
                  <ReviewerCheckbox key={reviewer.id}>
                    <input
                      type="checkbox"
                      checked={selectedReviewers.includes(reviewer.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedReviewers(prev => [...prev, reviewer.id]);
                        } else {
                          setSelectedReviewers(prev => prev.filter(id => id !== reviewer.id));
                        }
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, color: theme.colors.text }}>
                        {reviewer.full_name}
                      </div>
                      <div style={{ fontSize: '13px', color: theme.colors.textSecondary }}>
                        {reviewer.email}
                      </div>
                    </div>
                  </ReviewerCheckbox>
                ))}
              </div>
            )}

            <ModalActions>
              <ActionButton onClick={() => setShowReviewModal(false)}>
                Cancel
              </ActionButton>
              <ActionButton 
                $variant="primary"
                onClick={handleSubmitReviewRequest}
                disabled={selectedReviewers.length === 0 || submitting}
              >
                <Send size={14} />
                Send Review Request
              </ActionButton>
            </ModalActions>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
};

export default PromptVersions;
