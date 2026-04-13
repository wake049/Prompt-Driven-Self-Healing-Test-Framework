import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Search, Filter, Tag, Globe, Trash2, RefreshCw, CheckSquare, Square } from 'lucide-react';
import { Tooltip } from './Tooltip';

const Container = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: ${props => props.theme.shadows.medium};
`;

const TopRow = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const SearchBox = styled.div`
  position: relative;
  flex: 1;
  min-width: 250px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px 12px 10px 40px;
  border: 2px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primary}20;
  }
`;

const SearchIcon = styled(Search)`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: ${props => props.theme.colors.textSecondary};
  pointer-events: none;
`;

const FilterButton = styled.button<{ $active: boolean }>`
  padding: 10px 16px;
  background: ${props => props.$active ? props.theme.colors.primary : 'transparent'};
  color: ${props => props.$active ? 'white' : props.theme.colors.text};
  border: 2px solid ${props => props.$active ? props.theme.colors.primary : props.theme.colors.border};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.hover};
    transform: translateY(-1px);
  }
`;

const FiltersRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const TagFilter = styled.button<{ $active: boolean }>`
  padding: 6px 12px;
  background: ${props => props.$active ? '#185FA5' : '#f3f4f6'};
  color: ${props => props.$active ? 'white' : '#4b5563'};
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &:hover {
    background: ${props => props.$active ? '#5568d3' : '#e5e7eb'};
  }
`;

const PageFilter = styled(TagFilter)``;

const BulkActionsBar = styled.div<{ $visible: boolean }>`
  display: ${props => props.$visible ? 'flex' : 'none'};
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f0f8ff;
  border: 2px solid #bae6fd;
  border-radius: 8px;
  margin-top: 16px;
`;

const SelectedCount = styled.span`
  font-weight: 600;
  color: #0369a1;
`;

const BulkActionButton = styled.button<{ $variant?: 'danger' }>`
  padding: 8px 12px;
  background: ${props => props.$variant === 'danger' ? '#A32D2D' : '#0369a1'};
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
`;

export interface Element {
  id: string;
  name: string;
  type: string;
  page: string;
  [key: string]: any;
}

interface ElementFilterBarProps {
  elements: Element[];
  onFilteredElementsChange: (filtered: Element[]) => void;
  onBulkAction?: (action: 'delete' | 'healthCheck', selectedIds: string[]) => void;
  selectedElements?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
}

export const ElementFilterBar: React.FC<ElementFilterBarProps> = ({
  elements,
  onFilteredElementsChange,
  onBulkAction,
  selectedElements = new Set(),
  onSelectionChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Extract unique types and pages
  const { types, pages } = useMemo(() => {
    const typeSet = new Set<string>();
    const pageSet = new Set<string>();
    
    elements.forEach(element => {
      if (element.type) typeSet.add(element.type);
      if (element.page) pageSet.add(element.page);
    });
    
    return {
      types: Array.from(typeSet).sort(),
      pages: Array.from(pageSet).sort(),
    };
  }, [elements]);

  // Filter elements
  const filteredElements = useMemo(() => {
    let filtered = elements;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(element =>
        element.name.toLowerCase().includes(term) ||
        element.type?.toLowerCase().includes(term) ||
        element.page?.toLowerCase().includes(term)
      );
    }

    // Type filter
    if (selectedTypes.size > 0) {
      filtered = filtered.filter(element => 
        selectedTypes.has(element.type)
      );
    }

    // Page filter
    if (selectedPages.size > 0) {
      filtered = filtered.filter(element =>
        selectedPages.has(element.page)
      );
    }

    return filtered;
  }, [elements, searchTerm, selectedTypes, selectedPages]);

  // Notify parent of filtered elements
  React.useEffect(() => {
    onFilteredElementsChange(filteredElements);
  }, [filteredElements, onFilteredElementsChange]);

  const toggleType = (type: string) => {
    const newSet = new Set(selectedTypes);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setSelectedTypes(newSet);
  };

  const togglePage = (page: string) => {
    const newSet = new Set(selectedPages);
    if (newSet.has(page)) {
      newSet.delete(page);
    } else {
      newSet.add(page);
    }
    setSelectedPages(newSet);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedTypes(new Set());
    setSelectedPages(new Set());
  };

  const hasActiveFilters = searchTerm || selectedTypes.size > 0 || selectedPages.size > 0;

  return (
    <Container>
      <TopRow>
        <SearchBox>
          <SearchIcon size={18} />
          <SearchInput
            type="text"
            placeholder="Search elements by name, type, or page..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </SearchBox>
        
        <Tooltip content="Toggle filters">
          <FilterButton
            $active={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
            {hasActiveFilters && ` (${selectedTypes.size + selectedPages.size})`}
          </FilterButton>
        </Tooltip>

        {hasActiveFilters && (
          <FilterButton $active={false} onClick={clearAllFilters}>
            Clear All
          </FilterButton>
        )}
      </TopRow>

      {showFilters && (
        <>
          {types.length > 0 && (
            <FiltersRow style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                <Tag size={14} style={{ marginRight: '4px' }} />
                Type:
              </div>
              {types.map(type => (
                <TagFilter
                  key={type}
                  $active={selectedTypes.has(type)}
                  onClick={() => toggleType(type)}
                >
                  {type}
                </TagFilter>
              ))}
            </FiltersRow>
          )}

          {pages.length > 0 && (
            <FiltersRow>
              <div style={{ fontSize: '13px', fontWeight: '600', marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                <Globe size={14} style={{ marginRight: '4px' }} />
                Page:
              </div>
              {pages.map(page => (
                <PageFilter
                  key={page}
                  $active={selectedPages.has(page)}
                  onClick={() => togglePage(page)}
                >
                  {page}
                </PageFilter>
              ))}
            </FiltersRow>
          )}
        </>
      )}

      {onBulkAction && selectedElements.size > 0 && (
        <BulkActionsBar $visible={true}>
          <SelectedCount>{selectedElements.size} selected</SelectedCount>
          
          <BulkActionButton onClick={() => onBulkAction('healthCheck', Array.from(selectedElements))}>
            <RefreshCw size={14} />
            Health Check
          </BulkActionButton>
          
          <BulkActionButton
            $variant="danger"
            onClick={() => onBulkAction('delete', Array.from(selectedElements))}
          >
            <Trash2 size={14} />
            Delete
          </BulkActionButton>
          
          <div style={{ marginLeft: 'auto' }}>
            <FilterButton
              $active={false}
              onClick={() => onSelectionChange?.(new Set())}
            >
              Clear Selection
            </FilterButton>
          </div>
        </BulkActionsBar>
      )}
    </Container>
  );
};
