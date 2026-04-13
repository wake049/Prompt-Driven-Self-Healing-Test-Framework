import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useTheme } from '../../../contexts/ThemeContext';
import { useMCPContext } from '../../../contexts/MCPContext';
import { 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc, 
  RefreshCw, 
  Eye, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2
} from 'lucide-react';

// ================================
// Types
// ================================
interface ReviewQueueItem {
  id: string;
  element_key: string;
  page_name: string;
  status: string;
  suggestion: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  created_at: string;
  updated_at: string;
  current_primary_selector: string;
  current_alt_selectors: any;
  current_attributes: any;
  tag?: string;
}

interface FilterState {
  status: string;
  page: string;
  priority: string;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ================================
// Styled Components
// ================================
const Container = styled.div<{ theme: any }>`
  padding: 30px 40px;
  min-height: 100vh;
  background: ${props => props.theme.colors.background};
`;

const Header = styled.div<{ theme: any }>`
  margin-bottom: 30px;
`;

const Title = styled.h1<{ theme: any }>`
  color: ${props => props.theme.colors.text};
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0 0 10px 0;
  background: #185FA5;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Subtitle = styled.p<{ theme: any }>`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 1.1rem;
  margin: 0;
`;

const FilterBar = styled.div<{ theme: any }>`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr auto auto;
  gap: 16px;
  align-items: center;
  padding: 24px;
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  box-shadow: ${props => props.theme.shadows.medium};
  border: 1px solid ${props => props.theme.colors.border};
  margin-bottom: 24px;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
`;

const SearchContainer = styled.div`
  position: relative;
`;

const SearchInput = styled.input<{ theme: any }>`
  width: 100%;
  padding: 12px 16px 12px 44px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #185FA5;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
`;

const SearchIcon = styled(Search)<{ theme: any }>`
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: ${props => props.theme.colors.textSecondary};
`;

const FilterSelect = styled.select<{ theme: any }>`
  padding: 12px 16px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #185FA5;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const SortButton = styled.button<{ theme: any; active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid ${props => props.active ? '#185FA5' : props.theme.colors.border};
  border-radius: 8px;
  background: ${props => props.active ? 'rgba(102, 126, 234, 0.1)' : props.theme.colors.background};
  color: ${props => props.active ? '#185FA5' : props.theme.colors.text};
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #185FA5;
    background: rgba(102, 126, 234, 0.05);
  }
`;

const RefreshButton = styled.button<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #185FA5;
    background: rgba(102, 126, 234, 0.05);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FilterSummary = styled.div<{ theme: any }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  box-shadow: ${props => props.theme.shadows.small};
  border: 1px solid ${props => props.theme.colors.border};
  margin-bottom: 24px;
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const FilterCount = styled.span`
  font-weight: 700;
  color: #185FA5;
  font-size: 16px;
`;

const ClearFiltersButton = styled.button<{ theme: any }>`
  background: none;
  border: none;
  color: #185FA5;
  cursor: pointer;
  font-size: 14px;
  text-decoration: underline;
  
  &:hover {
    color: #5a67d8;
  }
`;

const QueueGrid = styled.div`
  display: grid;
  gap: 16px;
`;

const QueueItem = styled.div<{ theme: any; priority: string }>`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  border: 2px solid ${props => {
    switch (props.priority) {
      case 'high': return '#c85050';
      case 'low': return '#1D9E75';
      default: return props.theme.colors.border;
    }
  }};
  box-shadow: ${props => props.theme.shadows.medium};
  transition: all 0.3s ease;
  overflow: hidden;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.large};
  }
`;

const QueueItemHeader = styled.div<{ theme: any; priority: string }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: ${props => {
    switch (props.priority) {
      case 'high': return 'rgba(245, 101, 101, 0.1)';
      case 'low': return 'rgba(72, 187, 120, 0.1)';
      default: return 'rgba(102, 126, 234, 0.1)';
    }
  }};
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const QueueItemTitle = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ElementKey = styled.h3<{ theme: any }>`
  margin: 0;
  color: ${props => props.theme.colors.text};
  font-size: 1.1rem;
  font-weight: 600;
`;

const PageBadge = styled.span<{ theme: any }>`
  padding: 4px 8px;
  background: rgba(102, 126, 234, 0.2);
  color: #185FA5;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
`;

const PriorityBadge = styled.span<{ priority: string }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  background: ${props => {
    switch (props.priority) {
      case 'high': return '#fed7d7';
      case 'low': return '#c6f6d5';
      default: return '#e2e8f0';
    }
  }};
  color: ${props => {
    switch (props.priority) {
      case 'high': return '#c53030';
      case 'low': return '#2f855a';
      default: return '#4a5568';
    }
  }};
`;

const QueueItemContent = styled.div`
  padding: 20px;
`;

const QueueItemGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const InfoSection = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.background};
  padding: 12px;
  border-radius: 8px;
  border: 1px solid ${props => props.theme.colors.border};
`;

const InfoLabel = styled.div<{ theme: any }>`
  font-size: 12px;
  font-weight: 600;
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const InfoValue = styled.div<{ theme: any }>`
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
`;

const ActionButton = styled.button<{ theme: any; variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  
  background: ${props => {
    switch (props.variant) {
      case 'primary': return '#185FA5';
      case 'danger': return 'linear-gradient(135deg, #c85050 0%, #A32D2D 100%)';
      default: return props.theme.colors.background;
    }
  }};
  
  color: ${props => {
    switch (props.variant) {
      case 'primary':
      case 'danger': return 'white';
      default: return props.theme.colors.text;
    }
  }};
  
  border: ${props => props.variant === 'secondary' ? `1px solid ${props.theme.colors.border}` : 'none'};
  
  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const StatusIcon = styled.div<{ status: string }>`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: ${props => {
    switch (props.status) {
      case 'completed': return '#2f855a';
      case 'in_progress': return '#d69e2e';
      case 'rejected': return '#c53030';
      default: return '#185FA5';
    }
  }};
`;

const Pagination = styled.div<{ theme: any }>`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  padding: 20px;
`;

const PaginationButton = styled.button<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #185FA5;
    background: rgba(102, 126, 234, 0.05);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const PaginationInfo = styled.span<{ theme: any }>`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
`;

const LoadingState = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 16px;
`;

const EmptyState = styled.div<{ theme: any }>`
  text-align: center;
  padding: 60px 20px;
  color: ${props => props.theme.colors.textSecondary};
`;

const ErrorState = styled.div<{ theme: any }>`
  background: rgba(245, 101, 101, 0.1);
  border: 1px solid rgba(245, 101, 101, 0.3);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  color: #c53030;
`;

// ================================
import { config } from '../../../app/config';

// Component
// ================================
const ReviewQueue: React.FC = () => {
  const { theme } = useTheme();
  const { client } = useMCPContext();

  const getApiBaseUrl = () => config.apiBaseUrl;
  const getAuthToken = () => localStorage.getItem('auth_token') || localStorage.getItem('authToken') || '';

  const fetchReviewQueueHttp = async (params: Record<string, any>) => {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: String(value) }), {})
    ).toString();

    const response = await fetch(`${getApiBaseUrl()}/api/v1/healing/review-queue${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {})
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };

  const updateReviewStatusHttp = async (reviewId: string, status: 'approved' | 'rejected') => {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/healing/review/${reviewId}/status?status=${status}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {})
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  };
  
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [filters, setFilters] = useState<FilterState>({
    status: 'open',
    page: '',
    priority: '',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  const [availablePages, setAvailablePages] = useState<string[]>([]);

  // Simple in-file modal components (Confirm / Prompt / Notification)
  const ModalOverlay = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1200;
    padding: 20px;
  `;

  const ModalBox = styled.div`
    background: ${props => props.theme.colors.surface};
    color: ${props => props.theme.colors.text};
    border-radius: 12px;
    width: 100%;
    max-width: 560px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.3);
    overflow: hidden;
  `;

  const ModalHeader = styled.div`
    padding: 16px 20px;
    border-bottom: 1px solid ${props => props.theme.colors.border};
    font-weight: 700;
  `;

  const ModalBody = styled.div`
    padding: 16px 20px;
  `;

  const ModalActions = styled.div`
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 12px 20px 20px 20px;
  `;

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    onConfirm?: () => void;
  }>({ open: false });

  const [promptState, setPromptState] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    placeholder?: string;
    defaultValue?: string;
    onSubmit?: (value: string) => void;
  }>({ open: false });
  const [promptInput, setPromptInput] = useState<string>('');

  const [notificationState, setNotificationState] = useState<{
    open: boolean;
    message?: string;
    type?: 'success' | 'error' | 'info';
  }>({ open: false });

  const openConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({ open: true, title, message, onConfirm });
  };
  const closeConfirm = () => setConfirmState({ open: false });

  const openPrompt = (title: string, message: string, placeholder: string, defaultValue: string, onSubmit: (value: string) => void) => {
    setPromptState({ open: true, title, message, placeholder, defaultValue, onSubmit });
    setPromptInput(defaultValue || '');
  };
  const closePrompt = () => setPromptState({ open: false });

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotificationState({ open: true, message, type });
    // auto-dismiss after 3s
    setTimeout(() => setNotificationState({ open: false }), 3000);
  };

  // Action handlers for review items
  const handleViewDetails = (item: ReviewQueueItem) => {
    const elementId = item.id;
    const url = `/review/element/${elementId}`;
    window.open(url, '_blank');
  };

  const handleEdit = (item: ReviewQueueItem) => {
    const elementId = item.id;
    const url = `/review/element/${elementId}?mode=edit`;
    window.open(url, '_blank');
  };

  const performApprove = async (item: ReviewQueueItem) => {
    try {
      setLoading(true);
      if (client) {
        await client.approveReview(item.id);
      } else {
        await updateReviewStatusHttp(item.id, 'approved');
      }
      await loadReviewQueue();
      notify(`Review item \"${item.element_key}\" approved`, 'success');
    } catch (err) {
      try {
        await updateReviewStatusHttp(item.id, 'approved');
        await loadReviewQueue();
        notify(`Review item \"${item.element_key}\" approved`, 'success');
      } catch {
        notify('Failed to approve review item', 'error');
      }
    } finally {
      setLoading(false);
      closeConfirm();
    }
  };

  const performReject = async (item: ReviewQueueItem, reason?: string) => {
    try {
      setLoading(true);
      if (client) {
        await client.rejectReview(item.id);
      } else {
        await updateReviewStatusHttp(item.id, 'rejected');
      }
      await loadReviewQueue();
      notify(`Review item \"${item.element_key}\" rejected`, 'info');
    } catch (err) {
      try {
        await updateReviewStatusHttp(item.id, 'rejected');
        await loadReviewQueue();
        notify(`Review item \"${item.element_key}\" rejected`, 'info');
      } catch {
        notify('Failed to reject review item', 'error');
      }
    } finally {
      setLoading(false);
      closePrompt();
      closeConfirm();
    }
  };

  const handleApprove = async (item: ReviewQueueItem) => {
    openConfirm('Approve Review', `Are you sure you want to approve \"${item.element_key}\"?`, () => performApprove(item));
  };

  const handleReject = async (item: ReviewQueueItem) => {
    // open prompt first to capture optional reason, then confirm
    openPrompt('Reject Review', 'Please provide a reason for rejection (optional):', 'Reason (optional)', '', (value) => {
      // after user submits reason, show final confirmation
      openConfirm('Confirm Reject', `Are you sure you want to reject \"${item.element_key}\"?`, () => performReject(item, value));
    });
  };

  // Load review queue items using MCP client
  const loadReviewQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      
      const requestParams = {
        status: filters.status,
        page: filters.page || undefined,
        search: filters.search || undefined,
        sort_by: filters.sortBy,
        sort_order: filters.sortOrder,
        priority: filters.priority || undefined,
        limit: itemsPerPage,
        offset: offset
      };

      let result: any;
      if (client) {
        try {
          result = await client.getReviewQueue(requestParams);
        } catch {
          result = await fetchReviewQueueHttp(requestParams);
        }
      } else {
        result = await fetchReviewQueueHttp(requestParams);
      }
      if (result.success !== false) { // Handle both success=true and undefined (for direct data)
        const data = result.data || result;
        const rawItems = Array.isArray(data) ? data : (data.items || data.data || []);
        const total = result.total || data.total || rawItems.length;
        
        // Transform API data to match component expectations
        const transformedItems = rawItems.map((rawItem: any) => {
          // Parse suggestion if it's a string
          let suggestion = rawItem.suggestion;
          if (typeof suggestion === 'string') {
            try {
              suggestion = JSON.parse(suggestion);
            } catch (e) {
              suggestion = {};
            }
          }
          
          // Use element_key from suggestion if available, otherwise extract from selector
          let elementDisplayName = suggestion?.elementName || suggestion?.elementId || 'Unknown Element';
          
          // If we have a meaningful element key from the database/suggestion, use that
          if (suggestion?.elementKey && suggestion.elementKey !== 'unknown') {
            elementDisplayName = suggestion.elementKey;
          } else if (elementDisplayName === 'unknown' || elementDisplayName === 'Unknown Element') {
            // Try to extract a meaningful name from XPath or CSS selector
            const selector = suggestion?.originalSelector || suggestion?.suggestedSelector || '';
            if (selector.includes('title_link')) {
              elementDisplayName = 'Title Link';
            } else if (selector.includes('checkout')) {
              elementDisplayName = 'Checkout Button';
            } else if (selector.includes('summary_container')) {
              elementDisplayName = 'Summary Container';
            } else if (selector.includes('@id=')) {
              // Extract ID from XPath like //*[@id="item_2_title_link"]
              const idMatch = selector.match(/@id="([^"]+)"/);
              if (idMatch) {
                elementDisplayName = idMatch[1].replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
              }
            } else if (selector.includes('#')) {
              // Extract from CSS selector like #elementId
              const cssIdMatch = selector.match(/#([^.\s\[]+)/);
              if (cssIdMatch) {
                elementDisplayName = cssIdMatch[1].replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
              }
            }
          }
          
          // Extract tag name from selector
          let tagName = 'Selector';
          const selector = suggestion?.originalSelector || suggestion?.suggestedSelector || '';
          if (selector.startsWith('//')) {
            // XPath selector
            tagName = 'XPath';
          } else if (selector.startsWith('#') || selector.startsWith('.') || selector.includes('[')) {
            // CSS selector
            tagName = 'CSS';
          } else if (selector.includes('div') || selector.includes('button') || selector.includes('input')) {
            // HTML tag
            const tagMatch = selector.match(/(\w+)/);
            if (tagMatch) {
              tagName = tagMatch[1].toUpperCase();
            }
          }
          
          return {
            id: rawItem.id,
            element_key: elementDisplayName,
            page_name: suggestion?.page || 'Unknown Page',
            status: rawItem.status || 'open',
            suggestion: typeof rawItem.suggestion === 'string' ? rawItem.suggestion : JSON.stringify(suggestion || {}),
            rationale: rawItem.rationale || 'No rationale provided',
            priority: rawItem.priority || 'medium',
            created_at: rawItem.created_at,
            updated_at: rawItem.updated_at || rawItem.created_at,
            current_primary_selector: selector || 'Not available',
            current_alt_selectors: {},
            current_attributes: {},
            tag: tagName
          };
        });
        
        setItems(transformedItems);
        setTotalItems(total);
        
        // Extract unique pages for filter dropdown
        const pages = Array.from(new Set(transformedItems.map((item: ReviewQueueItem) => item.page_name).filter(Boolean))) as string[];
        setAvailablePages(pages);
      } else {
        setError('Failed to load review queue items');
      }
    } catch (err) {
      setError('Failed to load review queue items');
    } finally {
      setLoading(false);
    }
  }, [client, filters, currentPage, itemsPerPage]);

  useEffect(() => {
    loadReviewQueue();
  }, [loadReviewQueue]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      status: 'open',
      page: '',
      priority: '',
      search: '',
      sortBy: 'created_at',
      sortOrder: 'desc'
    });
    setCurrentPage(1);
  };

  const toggleSort = () => {
    setFilters(prev => ({
      ...prev,
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={14} />;
      case 'in_progress':
        return <Clock size={14} />;
      case 'rejected':
        return <XCircle size={14} />;
      default:
        return <AlertTriangle size={14} />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const hasActiveFilters = filters.page || filters.priority || filters.search || filters.status !== 'open';
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <Container theme={theme}>
      <Header theme={theme}>
        <Title theme={theme}>Review Queue</Title>
        <Subtitle theme={theme}>
          Manage elements requiring human review and approval
        </Subtitle>
      </Header>

      {/* Confirm Modal */}
      {confirmState.open && (
        <ModalOverlay>
          <ModalBox>
            <ModalHeader>{confirmState.title}</ModalHeader>
            <ModalBody>{confirmState.message}</ModalBody>
            <ModalActions>
              <ActionButton theme={theme} variant="secondary" onClick={() => closeConfirm()}>
                Cancel
              </ActionButton>
              <ActionButton theme={theme} variant="primary" onClick={() => { confirmState.onConfirm && confirmState.onConfirm(); }}>
                Confirm
              </ActionButton>
            </ModalActions>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Prompt Modal */}
      {promptState.open && (
        <ModalOverlay>
          <ModalBox>
            <ModalHeader>{promptState.title}</ModalHeader>
            <ModalBody>
              <div style={{ marginBottom: 12 }}>{promptState.message}</div>
              <input
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${theme.colors.border}` }}
                placeholder={promptState.placeholder}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
              />
            </ModalBody>
            <ModalActions>
              <ActionButton theme={theme} variant="secondary" onClick={() => closePrompt()}>
                Cancel
              </ActionButton>
              <ActionButton theme={theme} variant="danger" onClick={() => { promptState.onSubmit && promptState.onSubmit(promptInput || ''); closePrompt(); }}>
                Submit
              </ActionButton>
            </ModalActions>
          </ModalBox>
        </ModalOverlay>
      )}

      {/* Notification Modal (toast-like) */}
      {notificationState.open && (
        <ModalOverlay style={{ background: 'transparent', alignItems: 'flex-start', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto', marginTop: 20 }}>
            <ModalBox style={{ maxWidth: 420, padding: 12 }}>
              <ModalBody>
                <strong>{notificationState.type === 'success' ? 'Success' : notificationState.type === 'error' ? 'Error' : 'Info'}</strong>
                <div style={{ marginTop: 6 }}>{notificationState.message}</div>
              </ModalBody>
            </ModalBox>
          </div>
        </ModalOverlay>
      )}

      {error && (
        <ErrorState theme={theme}>
          <AlertTriangle size={20} style={{ marginRight: '8px' }} />
          {error}
        </ErrorState>
      )}

      <FilterBar theme={theme}>
        <SearchContainer>
          <SearchIcon theme={theme} />
          <SearchInput
            theme={theme}
            type="text"
            placeholder="Search elements, pages, or rationale..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </SearchContainer>

        <FilterSelect
          theme={theme}
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
        >
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </FilterSelect>

        <FilterSelect
          theme={theme}
          value={filters.priority}
          onChange={(e) => handleFilterChange('priority', e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </FilterSelect>

        <FilterSelect
          theme={theme}
          value={filters.page}
          onChange={(e) => handleFilterChange('page', e.target.value)}
        >
          <option value="">All Pages</option>
          {availablePages.map(page => (
            <option key={page} value={page}>{page}</option>
          ))}
        </FilterSelect>

        <SortButton
          theme={theme}
          active={true}
          onClick={toggleSort}
        >
          {filters.sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
          Sort
        </SortButton>

        <RefreshButton
          theme={theme}
          onClick={() => loadReviewQueue()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </RefreshButton>
      </FilterBar>

      <FilterSummary theme={theme}>
        <div>
          Showing <FilterCount>{items.length}</FilterCount> of <FilterCount>{totalItems}</FilterCount> items
          {hasActiveFilters && (
            <span>
              {filters.search && ` • Search: "${filters.search}"`}
              {filters.page && ` • Page: ${filters.page}`}
              {filters.priority && ` • Priority: ${filters.priority}`}
              {filters.status !== 'open' && ` • Status: ${filters.status}`}
            </span>
          )}
        </div>
        <div>
          {hasActiveFilters && (
            <ClearFiltersButton theme={theme} onClick={clearFilters}>
              Clear all filters
            </ClearFiltersButton>
          )}
        </div>
      </FilterSummary>

      {loading && (
        <LoadingState theme={theme}>
          <RefreshCw size={20} className="animate-spin" style={{ marginRight: '8px' }} />
          Loading review queue...
        </LoadingState>
      )}

      {!loading && items.length === 0 && (
        <EmptyState theme={theme}>
          <AlertTriangle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3>No items in review queue</h3>
          <p>No items match your current filters or the queue is empty.</p>
        </EmptyState>
      )}

      {!loading && items.length > 0 && (
        <QueueGrid>
          {items.map((item) => (
            <QueueItem key={item.id} theme={theme} priority={item.priority}>
              <QueueItemHeader theme={theme} priority={item.priority}>
                <QueueItemTitle theme={theme}>
                  <ElementKey theme={theme}>{item.element_key || 'Unnamed Element'}</ElementKey>
                  <PageBadge theme={theme}>{item.page_name}</PageBadge>
                  <PriorityBadge priority={item.priority}>{item.priority}</PriorityBadge>
                </QueueItemTitle>
                <StatusIcon status={item.status}>
                  {getStatusIcon(item.status)}
                  {item.status.replace('_', ' ')}
                </StatusIcon>
              </QueueItemHeader>

              <QueueItemContent>
                <QueueItemGrid>
                  <InfoSection theme={theme}>
                    <InfoLabel theme={theme}>Suggestion</InfoLabel>
                    <InfoValue theme={theme}>{item.suggestion}</InfoValue>
                  </InfoSection>

                  <InfoSection theme={theme}>
                    <InfoLabel theme={theme}>Rationale</InfoLabel>
                    <InfoValue theme={theme}>{item.rationale}</InfoValue>
                  </InfoSection>

                  <InfoSection theme={theme}>
                    <InfoLabel theme={theme}>Current Selector</InfoLabel>
                    <InfoValue theme={theme}>{item.current_primary_selector || 'Not available'}</InfoValue>
                  </InfoSection>

                  <InfoSection theme={theme}>
                    <InfoLabel theme={theme}>Created</InfoLabel>
                    <InfoValue theme={theme}>{formatDate(item.created_at)}</InfoValue>
                  </InfoSection>
                </QueueItemGrid>

                <ActionButtons>
                  <ActionButton 
                    theme={theme} 
                    variant="secondary"
                    onClick={() => handleViewDetails(item)}
                  >
                    <Eye size={14} />
                    View Details
                  </ActionButton>
                  <ActionButton 
                    theme={theme} 
                    variant="secondary"
                    onClick={() => handleEdit(item)}
                  >
                    <Edit size={14} />
                    Edit
                  </ActionButton>
                  <ActionButton 
                    theme={theme} 
                    variant="primary"
                    onClick={() => handleApprove(item)}
                    disabled={loading || item.status === 'completed' || item.status === 'approved'}
                    title={item.status === 'approved' ? 'Already approved' : 'Approve this review'}
                  >
                    <CheckCircle size={14} />
                    Approve
                  </ActionButton>
                  <ActionButton 
                    theme={theme} 
                    variant="danger"
                    onClick={() => handleReject(item)}
                    disabled={loading || item.status === 'rejected'}
                    title={item.status === 'rejected' ? 'Already rejected' : 'Reject this review'}
                  >
                    <XCircle size={14} />
                    Reject
                  </ActionButton>
                </ActionButtons>
              </QueueItemContent>
            </QueueItem>
          ))}
        </QueueGrid>
      )}

      {totalPages > 1 && (
        <Pagination theme={theme}>
          <PaginationButton
            theme={theme}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={16} />
            Previous
          </PaginationButton>

          <PaginationInfo theme={theme}>
            Page {currentPage} of {totalPages}
          </PaginationInfo>

          <PaginationButton
            theme={theme}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight size={16} />
          </PaginationButton>
        </Pagination>
      )}
    </Container>
  );
};

export default ReviewQueue;