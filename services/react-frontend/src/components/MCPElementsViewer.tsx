/**
 * MCP Elements Viewer Component
 * Displays and manages recorded UI elements from the SQL Backend
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import sqlApiClient, { RecordedElement } from '../utils/sqlApiClient';
import { 
  detectDynamicContent, 
  isDynamicSelector, 
  getDynamicContentSeverity, 
  getDynamicContentWarning,
  DynamicContentMatch 
} from '../utils/dynamicContentDetection';

// ================================
// Styled Components
// ================================

const Container = styled.div`
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  background-color: #f8f9fa;
  min-height: 100vh;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  margin: 0;
  color: #2c3e50;
  font-size: 2rem;
  font-weight: 600;
`;

const Stats = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
`;

const StatBadge = styled.div`
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 8px 16px;
  text-align: center;
`;

const StatNumber = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  color: #007bff;
`;

const StatLabel = styled.div`
  font-size: 0.8rem;
  color: #6c757d;
  text-transform: uppercase;
  font-weight: 600;
`;

const Controls = styled.div`
  margin-bottom: 24px;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
`;

const SearchInput = styled.input`
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
  flex: 1;
  min-width: 200px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
  }
`;

const FilterSelect = styled.select`
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
  background-color: white;
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
  }
`;

const RefreshButton = styled.button`
  padding: 8px 16px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #218838;
  }
  
  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
  font-size: 1.1rem;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
  
  h3 {
    margin: 0 0 16px 0;
    color: #495057;
  }
  
  p {
    margin: 0 0 24px 0;
    line-height: 1.5;
  }
`;

const ElementGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
`;

const ElementCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
`;

const ElementHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const ElementId = styled.h3`
  margin: 0;
  color: #2c3e50;
  font-size: 1.1rem;
  font-weight: 600;
  word-break: break-word;
`;

const ElementTag = styled.span`
  background-color: #e9ecef;
  color: #495057;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
`;

const ElementText = styled.div`
  margin: 8px 0;
  padding: 8px;
  background-color: #f8f9fa;
  border-radius: 6px;
  font-style: italic;
  color: #6c757d;
  font-size: 0.9rem;
`;

const SelectorsSection = styled.div`
  margin: 12px 0;
`;

const SectionLabel = styled.div`
  font-weight: 600;
  color: #495057;
  margin-bottom: 6px;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const SelectorsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SelectorItem = styled.div`
  background-color: #f1f3f4;
  padding: 6px 8px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.8rem;
  color: #495057;
  word-break: break-all;
  position: relative;
  border-left: 3px solid transparent;
  
  &.dynamic-high {
    border-left-color: #dc3545;
    background-color: #f8d7da;
    color: #721c24;
  }
  
  &.dynamic-medium {
    border-left-color: #ffc107;
    background-color: #fff3cd;
    color: #856404;
  }
  
  &.dynamic-low {
    border-left-color: #17a2b8;
    background-color: #d1ecf1;
    color: #0c5460;
  }
`;

const DynamicWarning = styled.div`
  font-size: 11px;
  margin-top: 4px;
  padding: 4px 8px;
  border-radius: 3px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 500;
  
  &.high {
    background: #f5c6cb;
    color: #721c24;
    border: 1px solid #f1b6bb;
  }
  
  &.medium {
    background: #ffeaa7;
    color: #856404;
    border: 1px solid #ffeaa7;
  }
  
  &.low {
    background: #b8daff;
    color: #004085;
    border: 1px solid #b8daff;
  }
`;

const AttributesSection = styled.div`
  margin: 12px 0;
`;

const AttributesList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const AttributeItem = styled.span`
  background-color: #e3f2fd;
  color: #1976d2;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.75rem;
  font-family: 'Consolas', 'Monaco', monospace;
`;

const ElementFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e9ecef;
`;

const PageBadge = styled.span`
  background-color: #f8f9fa;
  color: #6c757d;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  border: 1px solid #dee2e6;
`;

const Timestamp = styled.span`
  color: #6c757d;
  font-size: 0.75rem;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const DeleteButton = styled.button`
  padding: 6px 12px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #c82333;
  }
`;

const EditButton = styled.button`
  padding: 6px 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.2s;
  margin-right: 8px;
  
  &:hover {
    background-color: #0056b3;
  }
`;

const EditForm = styled.div`
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 16px;
  margin: 12px 0;
`;

const EditFormRow = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
`;

const EditLabel = styled.label`
  font-weight: 600;
  color: #495057;
  margin-bottom: 4px;
  font-size: 0.9rem;
`;

const EditInput = styled.input`
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  font-family: 'Consolas', 'Monaco', monospace;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
  }
`;

const EditTextarea = styled.textarea`
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  font-family: 'Consolas', 'Monaco', monospace;
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
  }
`;

const EditActions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
`;

const SaveButton = styled.button`
  padding: 8px 16px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  
  &:hover {
    background-color: #218838;
  }
`;

const CancelButton = styled.button`
  padding: 8px 16px;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  
  &:hover {
    background-color: #545b62;
  }
`;

const ErrorMessage = styled.div`
  background-color: #f8d7da;
  color: #721c24;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  border: 1px solid #f5c6cb;
`;

// ================================
// Component
// ================================

const MCPElementsViewer: React.FC = () => {
  const [elements, setElements] = useState<RecordedElement[]>([]);
  const [filteredElements, setFilteredElements] = useState<RecordedElement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPage, setSelectedPage] = useState('all');
  const [needsWorkFilter, setNeedsWorkFilter] = useState('all'); // 'all', 'needs-work', 'stable'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingElement, setEditingElement] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{id: string; xpath: string} | null>(null);

  // Create unique editing key to handle elements with same ID
  const getEditingKey = (element: RecordedElement): string => {
    return `${element.dbId || 'no-db-id'}_${element.id}`;
  };

  // Helper function to render selector with dynamic content detection
  const renderSelectorWithWarning = (selector: string, label: string) => {
    const dynamicMatches = detectDynamicContent(selector);
    const severity = getDynamicContentSeverity(dynamicMatches);
    const warning = getDynamicContentWarning(dynamicMatches);
    const className = dynamicMatches.length > 0 ? `dynamic-${severity}` : '';

    return (
      <SelectorItem key={`${label}-${selector}`} className={className} title={`${label}: ${selector}`}>
        {label}: {selector}
        {warning && (
          <DynamicWarning className={severity}>
            {warning}
          </DynamicWarning>
        )}
      </SelectorItem>
    );
  };

  // Helper function to check if element needs work (has dynamic content)
  const elementNeedsWork = (element: RecordedElement): boolean => {
    const cssHasDynamic = element.cssSelector && isDynamicSelector(element.cssSelector);
    const xpathHasDynamic = element.xpath && isDynamicSelector(element.xpath);
    return !!(cssHasDynamic || xpathHasDynamic);
  };

  // Load elements from SQL Backend
  const loadElements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Loading elements from SQL backend...');
      
      // Check if SQL backend is available
      const isHealthy = await sqlApiClient.healthCheck();
      if (!isHealthy) {
        throw new Error('SQL backend is not available');
      }

      // Load from SQL backend
      const response = await sqlApiClient.getAllElements({ limit: 1000 });
      if (response.success && response.data) {
        console.log('Loaded elements from SQL backend:', response.data);
        
        // Convert database elements to frontend format
        const frontendElements = response.data.map(dbElement => 
          sqlApiClient.convertElementToFrontend(dbElement)
        );
        
        setElements(frontendElements);
      } else {
        throw new Error(response.error || 'Failed to load elements from SQL backend');
      }
      
    } catch (error: any) {
      console.error('Error loading elements from SQL backend:', error);
      setError(error.message);
      
      // Fallback to sample data for demo
      const sampleElements: RecordedElement[] = [
        {
          id: 'sample-login-button',
          tag: 'button',
          text: 'Login',
          attributes: { id: 'login-btn', class: 'btn btn-primary' },
          xpath: '//button[@id="login-btn"]',
          cssSelector: '#login-btn',
          position: { x: 100, y: 200 },
          selectors: ['#login-btn', '.btn.btn-primary'],
          page: 'https://example.com/login',
          timestamp: Date.now()
        },
        {
          id: 'sample-username-input',
          tag: 'input',
          text: '',
          attributes: { id: 'username', name: 'username', type: 'text' },
          xpath: '//input[@id="username"]',
          cssSelector: '#username',
          position: { x: 150, y: 150 },
          selectors: ['#username', 'input[name="username"]'],
          page: 'https://example.com/login',
          timestamp: Date.now() - 60000
        }
      ];
      setElements(sampleElements);
    } finally {
      setLoading(false);
    }
  }, []);

  // Start editing an element
  const startEditing = (element: RecordedElement) => {
    const editingKey = getEditingKey(element);
    setEditingElement(editingKey);
    setEditForm({
      id: element.id,
      xpath: element.xpath
    });
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingElement(null);
    setEditForm(null);
  };

  // Save edited element
  const saveElement = async (element: RecordedElement) => {
    if (!editForm) return;
    
    const editingKey = getEditingKey(element);

    try {
      console.log(`Saving changes for element: ${element.id} (key: ${editingKey})`);
      
      // Check if SQL backend is available
      const isHealthy = await sqlApiClient.healthCheck();
      if (!isHealthy) {
        throw new Error('SQL backend not available');
      }

      // Update in database if we have the dbId
      if (element.dbId) {
        const updateResponse = await sqlApiClient.updateElement(element.dbId, {
          element_id: editForm.id,
          xpath: editForm.xpath
        });
        
        if (!updateResponse.success) {
          throw new Error(updateResponse.error || 'Failed to update in database');
        }
        
        console.log('✅ Element updated in database successfully');
      }

      // Update local state for this specific element
      const updatedElements = elements.map(el => {
        if (getEditingKey(el) === editingKey) {
          return {
            ...el,
            id: editForm.id,
            xpath: editForm.xpath
          };
        }
        return el;
      });
      
      setElements(updatedElements);
      
      // Clear editing state
      setEditingElement(null);
      setEditForm(null);
      
      console.log(`✅ Element "${element.id}" updated successfully`);
      
    } catch (error: any) {
      console.error('❌ Error saving element:', error);
      alert(`Failed to save changes: ${error.message}`);
    }
  };

  // Delete element
  const deleteElement = async (elementId: string) => {
    if (!window.confirm(`Are you sure you want to delete element "${elementId}"?`)) {
      return;
    }

    try {
      console.log(`Attempting to delete element: ${elementId}`);
      
      // Find the element in our current list to get the database ID
      const elementToDelete = elements.find(e => e.id === elementId);
      if (!elementToDelete) {
        throw new Error(`Element "${elementId}" not found in current list`);
      }

      if (!elementToDelete.dbId) {
        throw new Error(`Element "${elementId}" is missing database ID`);
      }

      console.log(`Found element with database ID: ${elementToDelete.dbId}`);
      
      // Try to delete from SQL backend first
      const isHealthy = await sqlApiClient.healthCheck();
      if (!isHealthy) {
        throw new Error('SQL backend not available');
      }

      console.log(`Calling delete API with database ID: ${elementToDelete.dbId}`);
      const deleteResponse = await sqlApiClient.deleteElement(elementToDelete.dbId);
      console.log('Delete response:', deleteResponse);
      
      if (!deleteResponse.success) {
        throw new Error(deleteResponse.error || 'Failed to delete from database');
      }

      // Only update local state if database deletion succeeded
      const updatedElements = elements.filter(e => e.id !== elementId);
      setElements(updatedElements);
      
      console.log(`✅ Element "${elementId}" successfully deleted from database and UI`);
      
    } catch (error: any) {
      console.error('❌ Error deleting element:', error);
      
      // Show detailed error to user
      alert(`Failed to delete element "${elementId}": ${error.message}\n\nThe element was not removed to keep UI in sync with database.`);
    }
  };

  // Filter elements based on search and page selection
  useEffect(() => {
    let filtered = elements;

    // Filter by page
    if (selectedPage !== 'all') {
      filtered = filtered.filter(element => element.page === selectedPage);
    }

    // Filter by dynamic content (needs work)
    if (needsWorkFilter === 'needs-work') {
      filtered = filtered.filter(elementNeedsWork);
    } else if (needsWorkFilter === 'stable') {
      filtered = filtered.filter(element => !elementNeedsWork(element));
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(element =>
        element.id.toLowerCase().includes(term) ||
        element.tag.toLowerCase().includes(term) ||
        (element.text && element.text.toLowerCase().includes(term)) ||
        Object.values(element.attributes).some(value => 
          value.toString().toLowerCase().includes(term)
        )
      );
    }

    setFilteredElements(filtered);
  }, [elements, searchTerm, selectedPage, needsWorkFilter]);

  useEffect(() => {
    loadElements();
  }, [loadElements]);

  // Get unique pages for filter dropdown
  const allPages = Array.from(new Set(elements.map(e => e.page || 'unknown'))).sort();

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const totalElements = elements.length;
  const filteredCount = filteredElements.length;

  return (
    <Container>
      <Header>
        <div>
          <Title>Recorded Elements</Title>
          <Stats>
            <StatBadge>
              <StatNumber>{totalElements}</StatNumber>
              <StatLabel>Total Elements</StatLabel>
            </StatBadge>
            <StatBadge>
              <StatNumber>{allPages.length}</StatNumber>
              <StatLabel>Pages</StatLabel>
            </StatBadge>
            <StatBadge>
              <StatNumber>{filteredCount}</StatNumber>
              <StatLabel>Filtered</StatLabel>
            </StatBadge>
          </Stats>
        </div>
        <RefreshButton onClick={loadElements} disabled={loading}>
          🔄 {loading ? 'Loading...' : 'Refresh'}
        </RefreshButton>
      </Header>

      {error && (
        <ErrorMessage>
          <strong>Error:</strong> {error}
          <br />
          <small>Showing sample data for demonstration purposes.</small>
        </ErrorMessage>
      )}

      <Controls>
        <SearchInput
          type="text"
          placeholder="Search elements by ID, tag, text, or attributes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <FilterSelect
          value={selectedPage}
          onChange={(e) => setSelectedPage(e.target.value)}
        >
          <option value="all">All Pages</option>
          {allPages.map(page => (
            <option key={page} value={page}>{page}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          value={needsWorkFilter}
          onChange={(e) => setNeedsWorkFilter(e.target.value)}
          title="Filter by dynamic content status"
        >
          <option value="all">All Elements</option>
          <option value="needs-work">⚠️ Needs Work (Dynamic Content)</option>
          <option value="stable">✅ Stable (No Dynamic Content)</option>
        </FilterSelect>
      </Controls>

      {loading && (
        <LoadingMessage>Loading elements from SQL backend...</LoadingMessage>
      )}

      {!loading && filteredElements.length === 0 && !error && (
        <EmptyMessage>
          <h3>No elements found</h3>
          <p>
            {elements.length === 0 
              ? 'No recorded elements available. Start recording elements in the Chrome Extension to see them here.'
              : 'No elements match your current filters. Try adjusting your search or page filter.'
            }
          </p>
        </EmptyMessage>
      )}

      {!loading && filteredElements.length > 0 && (
        <ElementGrid>
          {filteredElements.map((element) => {
            const editingKey = getEditingKey(element);
            const isEditing = editingElement === editingKey;
            
            return (
              <ElementCard key={editingKey}>
                <ElementHeader>
                  <ElementId>{element.id}</ElementId>
                  <ElementTag>{element.tag}</ElementTag>
                </ElementHeader>

                {element.text && (
                  <ElementText>"{element.text}"</ElementText>
                )}

                {isEditing && (
                  <EditForm>
                    <EditFormRow>
                      <EditLabel>Element ID</EditLabel>
                      <EditInput
                        type="text"
                        value={editForm?.id || ''}
                        onChange={(e) => setEditForm(prev => prev ? {...prev, id: e.target.value} : null)}
                        placeholder="Enter unique element ID"
                      />
                    </EditFormRow>
                    
                    <EditFormRow>
                      <EditLabel>XPath Expression</EditLabel>
                      <EditTextarea
                        value={editForm?.xpath || ''}
                        onChange={(e) => setEditForm(prev => prev ? {...prev, xpath: e.target.value} : null)}
                        placeholder="Enter XPath expression"
                      />
                    </EditFormRow>
                    
                    <EditActions>
                      <CancelButton onClick={cancelEditing}>Cancel</CancelButton>
                      <SaveButton onClick={() => saveElement(element)}>Save Changes</SaveButton>
                    </EditActions>
                  </EditForm>
                )}

                <SelectorsSection>
                  <SectionLabel>Selectors</SectionLabel>
                  <SelectorsList>
                    {element.cssSelector && renderSelectorWithWarning(element.cssSelector, 'CSS')}
                    {element.xpath && renderSelectorWithWarning(element.xpath, 'XPath')}
                    {element.selectors && element.selectors
                      .filter(sel => sel !== element.cssSelector && sel !== element.xpath)
                      .map((selector, index) => (
                        <SelectorItem key={index} title="Alternative Selector">
                          Alt: {selector}
                        </SelectorItem>
                      ))
                    }
                  </SelectorsList>
                </SelectorsSection>

                {Object.keys(element.attributes).length > 0 && (
                  <AttributesSection>
                    <SectionLabel>Attributes</SectionLabel>
                    <AttributesList>
                      {Object.entries(element.attributes).map(([key, value]) => (
                        <AttributeItem key={key} title={`${key}="${value}"`}>
                          {key}="{value}"
                        </AttributeItem>
                      ))}
                    </AttributesList>
                  </AttributesSection>
                )}

                <ElementFooter>
                  <div>
                    <PageBadge>{element.page || 'unknown'}</PageBadge>
                    <Timestamp>{formatTimestamp(element.timestamp)}</Timestamp>
                  </div>
                  <ActionButtons>
                    {!isEditing && (
                      <EditButton onClick={() => startEditing(element)}>
                        ✏️ Edit
                      </EditButton>
                    )}
                    <DeleteButton onClick={() => deleteElement(element.id)}>
                      🗑️ Delete
                    </DeleteButton>
                  </ActionButtons>
                </ElementFooter>
              </ElementCard>
            );
          })}
        </ElementGrid>
      )}
    </Container>
  );
};

export default MCPElementsViewer;
