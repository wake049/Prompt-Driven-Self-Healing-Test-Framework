import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { spinKeyframes } from '../../shared/styles/keyframes';
import { Search, Filter, Eye, Edit, Trash2, Plus, Image, Globe, Calendar } from 'lucide-react';
import { PageContextAPI } from './api';

// ================================
// Styled Components (matching existing app patterns)
// ================================

const FilterBar = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 20px 0;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  margin-bottom: 24px;
  border-radius: 8px;
  padding: 20px;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const FilterSelect = styled.select`
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  min-width: 150px;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const FilterSummary = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 20px;
`;

const FilterCount = styled.span`
  font-weight: 600;
  color: #007bff;
`;

const ContextGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
`;

const ContextCard = styled.div`
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid #e9ecef;
  overflow: hidden;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
`;

const ScreenshotContainer = styled.div`
  aspect-ratio: 16/9;
  background: #f8f9fa;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ScreenshotImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const ScreenshotPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6c757d;
`;

const TypeBadge = styled.span<{ pageType: string }>`
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => {
    const colors: Record<string, string> = {
      ecommerce: '#d4edda',
      airline: '#d1ecf1',
      banking: '#fff3cd',
      form: '#e2e3ff',
      news: '#f8d7da',
      social: '#fce4ec',
      search: '#f8f9fa',
      streaming: '#e1f5fe',
      other: '#f8f9fa'
    };
    return colors[props.pageType] || colors.other;
  }};
  color: ${props => {
    const colors: Record<string, string> = {
      ecommerce: '#155724',
      airline: '#0c5460',
      banking: '#856404',
      form: '#3e4094',
      news: '#721c24',
      social: '#880e4f',
      search: '#6c757d',
      streaming: '#01579b',
      other: '#6c757d'
    };
    return colors[props.pageType] || colors.other;
  }};
`;

const CardContent = styled.div`
  padding: 20px;
`;

const CardTitle = styled.h3`
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 1.1rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CardDescription = styled.p`
  color: #6c757d;
  font-size: 0.9rem;
  margin: 0 0 12px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardUrl = styled.p`
  color: #007bff;
  font-size: 0.8rem;
  margin: 0 0 12px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
`;

const ActionsSection = styled.div`
  margin-bottom: 12px;
`;

const ActionsSectionLabel = styled.p`
  font-size: 0.8rem;
  font-weight: 600;
  color: #495057;
  margin: 0 0 6px 0;
`;

const ActionsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const ActionTag = styled.span`
  padding: 2px 6px;
  background: #f8f9fa;
  color: #495057;
  border-radius: 3px;
  font-size: 0.75rem;
  border: 1px solid #e9ecef;
`;

const CardMetadata = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: #6c757d;
  margin-bottom: 16px;
  padding-top: 12px;
  border-top: 1px solid #f8f9fa;
`;

const MetadataItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const CardActions = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: #007bff;
          color: white;
          &:hover { background: #0056b3; }
        `;
      case 'danger':
        return `
          background: none;
          color: #dc3545;
          &:hover { 
            background: #f8d7da;
            color: #721c24;
          }
        `;
      case 'secondary':
      default:
        return `
          background: none;
          color: #6c757d;
          &:hover {
            background: #f8f9fa;
            color: #495057;
          }
        `;
    }
  }}
`;

const SecondaryActions = styled.div`
  display: flex;
  gap: 8px;
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px;
  color: #6c757d;
  
  &::before {
    content: '';
    width: 24px;
    height: 24px;
    border: 2px solid #e9ecef;
    border-top: 2px solid #007bff;
    border-radius: 50%;
    animation: ${spinKeyframes} 1s linear infinite;
    margin-right: 12px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 80px 20px;
  color: #6c757d;
`;

const EmptyStateIcon = styled.div`
  margin-bottom: 16px;
  color: #6c757d;
`;

const EmptyStateTitle = styled.h3`
  margin: 0 0 8px 0;
  color: #495057;
  font-size: 1.2rem;
  font-weight: 600;
`;

const EmptyStateDescription = styled.p`
  margin: 0 0 24px 0;
  color: #6c757d;
  line-height: 1.5;
`;

const EmptyStateButton = styled.button`
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 12px 24px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background: #0056b3;
  }
`;

// ================================
// Types
// ================================

interface PageContextItem {
  id: string;
  pageUrl: string;
  pageTitle: string;
  pageType: string;
  pageDescription: string;
  screenshotUrl?: string;
  primaryActions: string[];
  testingFocus?: string;
  userNotes?: string;
  createdAt: string;
  createdBy?: string;
  usageCount: number;
}

interface PageContextListProps {
  onEdit: (context: PageContextItem) => void;
  onView: (context: PageContextItem) => void;
  onDelete: (id: string) => void;
  onCreateNew: () => void;
}

// ================================
// Component
// ================================

export const PageContextList: React.FC<PageContextListProps> = ({
  onEdit,
  onView,
  onDelete,
  onCreateNew
}) => {
  const [contexts, setContexts] = useState<PageContextItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'alphabetical'>('recent');
  
  // Use useRef to prevent duplicate API calls in React.StrictMode
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate API calls in React.StrictMode (development)
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadPageContexts();
    }
  }, []);

  const loadPageContexts = async () => {
    try {
      setLoading(true);
      setError(null);
      // Load page contexts from API
      const data = await PageContextAPI.list({ limit: 100 });
      
      // Transform API data to PageContextItem format
      const transformedData: PageContextItem[] = data.map((context: any) => ({
        id: context.id,
        pageUrl: context.page_url || context.pageUrl || '',
        pageTitle: context.page_title || context.pageTitle || 'Untitled',
        pageType: context.page_type || context.pageType || 'other',
        pageDescription: context.page_description || context.pageDescription || '',
        primaryActions: Array.isArray(context.primary_actions) ? context.primary_actions : 
                        Array.isArray(context.primaryActions) ? context.primaryActions : [],
        testingFocus: context.testing_focus || context.testingFocus || '',
        screenshotUrl: context.screenshot_url || context.screenshotUrl,
        createdAt: context.created_at || context.createdAt || new Date().toISOString(),
        createdBy: context.created_by || context.createdBy || 'Unknown',
        usageCount: context.usage_count || context.usageCount || 0,
        userNotes: context.user_notes || context.userNotes || ''
      }));
      
      setContexts(transformedData);
    } catch (error) {
      setError('Failed to load page contexts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedContexts = React.useMemo(() => {
    let filtered = contexts;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(context =>
        context.pageTitle.toLowerCase().includes(query) ||
        context.pageDescription.toLowerCase().includes(query) ||
        context.pageUrl.toLowerCase().includes(query)
      );
    }

    // Filter by type
    if (filterType) {
      filtered = filtered.filter(context => context.pageType === filterType);
    }

    // Sort
    switch (sortBy) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'popular':
        filtered.sort((a, b) => b.usageCount - a.usageCount);
        break;
      case 'alphabetical':
        filtered.sort((a, b) => a.pageTitle.localeCompare(b.pageTitle));
        break;
    }

    return filtered;
  }, [contexts, searchQuery, filterType, sortBy]);

  const handleDeleteConfirm = (context: PageContextItem) => {
    if (window.confirm(`Are you sure you want to delete "${context.pageTitle}"?`)) {
      onDelete(context.id);
    }
  };

  const pageTypeLabels: Record<string, string> = {
    ecommerce: 'E-commerce',
    airline: 'Airlines',
    banking: 'Banking',
    form: 'Forms',
    news: 'News',
    social: 'Social Media',
    search: 'Search',
    streaming: 'Streaming',
    other: 'Other',
  };

  if (loading) {
    return <LoadingSpinner>Loading page contexts...</LoadingSpinner>;
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: '#A32D2D',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <p>{error}</p>
        <button 
          onClick={loadPageContexts}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Search and Filters */}
      <FilterBar>
        <SearchInput
          type="text"
          placeholder="Search by title, description, or URL..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        
        <FilterSelect
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          {Object.entries(pageTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </FilterSelect>

        <FilterSelect
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="recent">Most Recent</option>
          <option value="popular">Most Used</option>
          <option value="alphabetical">Alphabetical</option>
        </FilterSelect>
      </FilterBar>

      <FilterSummary>
        <div>
          Showing <FilterCount>{filteredAndSortedContexts.length}</FilterCount> of <FilterCount>{contexts.length}</FilterCount> page contexts
          {searchQuery && <span> • Filter: "{searchQuery}"</span>}
          {filterType && <span> • Type: {pageTypeLabels[filterType]}</span>}
        </div>
        <div>
          {(searchQuery || filterType) && (
            <button 
              onClick={() => {
                setSearchQuery('');
                setFilterType('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#007bff',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '14px'
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </FilterSummary>

      {/* Context List */}
      {filteredAndSortedContexts.length === 0 ? (
        <EmptyState>
          <EmptyStateIcon>
            <Globe size={48} style={{ margin: '0 auto' }} />
          </EmptyStateIcon>
          <EmptyStateTitle>No Page Contexts Found</EmptyStateTitle>
          <EmptyStateDescription>
            {searchQuery || filterType ? 'Try adjusting your search or filters' : 'Start by adding your first page context'}
          </EmptyStateDescription>
          <EmptyStateButton onClick={onCreateNew}>
            Add Page Context
          </EmptyStateButton>
        </EmptyState>
      ) : (
        <ContextGrid>
          {filteredAndSortedContexts.map((context) => (
            <ContextCard key={context.id}>
              {/* Screenshot or Placeholder */}
              <ScreenshotContainer>
                {context.screenshotUrl ? (
                  <ScreenshotImage
                    src={context.screenshotUrl}
                    alt={context.pageTitle}
                  />
                ) : (
                  <ScreenshotPlaceholder>
                    <Image size={32} />
                  </ScreenshotPlaceholder>
                )}
                
                {/* Page Type Badge */}
                <TypeBadge pageType={context.pageType}>
                  {pageTypeLabels[context.pageType] || 'Other'}
                </TypeBadge>
              </ScreenshotContainer>

              {/* Content */}
              <CardContent>
                <CardTitle title={context.pageTitle}>
                  {context.pageTitle}
                </CardTitle>
                
                <CardDescription>
                  {context.pageDescription}
                </CardDescription>

                <CardUrl title={context.pageUrl}>
                  {context.pageUrl}
                </CardUrl>

                {/* Primary Actions */}
                {context.primaryActions.length > 0 && (
                  <ActionsSection>
                    <ActionsSectionLabel>Primary Actions:</ActionsSectionLabel>
                    <ActionsList>
                      {context.primaryActions.slice(0, 2).map((action, index) => (
                        <ActionTag key={index}>
                          {action}
                        </ActionTag>
                      ))}
                      {context.primaryActions.length > 2 && (
                        <ActionTag>
                          +{context.primaryActions.length - 2} more
                        </ActionTag>
                      )}
                    </ActionsList>
                  </ActionsSection>
                )}

                {/* Metadata */}
                <CardMetadata>
                  <MetadataItem>
                    <Calendar size={12} />
                    {new Date(context.createdAt).toLocaleDateString()}
                  </MetadataItem>
                  <div>
                    Used {context.usageCount} times
                  </div>
                </CardMetadata>

                {/* Actions */}
                <CardActions>
                  <ActionButton variant="primary" onClick={() => onView(context)}>
                    <Eye size={14} />
                    View
                  </ActionButton>
                  
                  <SecondaryActions>
                    <ActionButton variant="secondary" onClick={() => onEdit(context)}>
                      <Edit size={14} />
                      Edit
                    </ActionButton>
                    
                    <ActionButton variant="danger" onClick={() => handleDeleteConfirm(context)}>
                      <Trash2 size={14} />
                      Delete
                    </ActionButton>
                  </SecondaryActions>
                </CardActions>
              </CardContent>
            </ContextCard>
          ))}
        </ContextGrid>
      )}
    </>
  );
};