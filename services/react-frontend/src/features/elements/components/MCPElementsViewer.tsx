import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import sqlApiClient, { RecordedElement } from '../../../shared/utils/sqlApiClient';
import { 
  detectDynamicContent, 
  isDynamicSelector, 
  getDynamicContentSeverity, 
  getDynamicContentWarning,
  DynamicContentMatch 
} from '../../../shared/utils/dynamicContentDetection';

// ================================
// Styled Components
// ================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #ffffff;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #ffffff;
`;

const MainHeader = styled.div`
  padding: 30px 40px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PageTitle = styled.h1`
  margin: 0;
  color: #2c3e50;
  font-size: 2rem;
  font-weight: 600;
`;

const NewButton = styled.button`
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background: #0056b3;
  }
`;

const FilterBar = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 20px 40px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
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
  padding: 12px 40px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  font-size: 14px;
  color: #6c757d;
`;

const FilterCount = styled.span`
  font-weight: 600;
  color: #007bff;
`;

const TableContainer = styled.div`
  flex: 1;
  overflow: auto;
  padding: 0 40px 40px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: white;
`;

const TableHeader = styled.thead`
  background: #f8f9fa;
`;

const TableHeaderCell = styled.th`
  padding: 16px 20px;
  text-align: left;
  font-weight: 600;
  color: #6c757d;
  font-size: 0.9rem;
  border-bottom: 1px solid #e9ecef;
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr`
  cursor: pointer;
  border-bottom: 1px solid #f8f9fa;
  transition: background-color 0.2s;
  
  &:hover {
    background: #f8f9fa;
  }
`;

const TableCell = styled.td`
  padding: 16px 20px;
  color: #2c3e50;
`;

const ElementName = styled.div`
  font-weight: 600;
  color: #2c3e50;
`;

const HealthBadge = styled.div<{ status: 'healthy' | 'warning' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'healthy': return '#d4edda';
      case 'warning': return '#fff3cd';
      case 'error': return '#f8d7da';
      default: return '#f8f9fa';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'healthy': return '#155724';
      case 'warning': return '#856404';
      case 'error': return '#721c24';
      default: return '#6c757d';
    }
  }};
`;

const HealthDot = styled.div<{ status: 'healthy' | 'warning' | 'error' }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${props => {
    switch (props.status) {
      case 'healthy': return '#28a745';
      case 'warning': return '#ffc107';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  }};
`;

// Detail View Components
const DetailContainer = styled.div`
  flex: 1;
  padding: 40px;
  background: #ffffff;
`;

const DetailHeader = styled.div`
  margin-bottom: 40px;
`;

const DetailTitle = styled.h1`
  margin: 0 0 20px 0;
  color: #2c3e50;
  font-size: 2.5rem;
  font-weight: 600;
`;

const DetailGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  max-width: 800px;
`;

const DetailItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DetailLabel = styled.div`
  color: #6c757d;
  font-weight: 500;
  font-size: 0.9rem;
`;

const DetailValue = styled.div`
  color: #2c3e50;
  font-weight: 500;
  font-size: 1.1rem;
  font-family: ${props => props.children?.toString().startsWith('//') || props.children?.toString().startsWith('#') ? "'Consolas', 'Monaco', monospace" : 'inherit'};
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  padding: 8px 0;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
`;

const PendingBadge = styled.span`
  color: #fd7e14;
  font-weight: 600;
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

const TabContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
`;

const Tab = styled.button<{ active: boolean }>`
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background-color: ${props => props.active ? '#007bff' : '#f8f9fa'};
  color: ${props => props.active ? 'white' : '#6c757d'};
  border: 1px solid ${props => props.active ? '#007bff' : '#dee2e6'};
  
  &:hover {
    background-color: ${props => props.active ? '#0056b3' : '#e9ecef'};
  }
`;

const ReviewCard = styled.div`
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-left: 4px solid #ffc107;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const ReviewHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const ReviewTitle = styled.h3`
  margin: 0;
  color: #856404;
  font-size: 1.1rem;
  font-weight: 600;
`;

const ReviewBadge = styled.span`
  background-color: #ffc107;
  color: #212529;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
`;

const SelectorComparison = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 16px 0;
`;

const SelectorColumn = styled.div`
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 12px;
`;

const SelectorLabel = styled.div`
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px;
  font-size: 0.9rem;
`;

const SelectorValue = styled.div`
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.85rem;
  color: #495057;
  word-break: break-all;
  background: #f8f9fa;
  padding: 8px;
  border-radius: 4px;
`;

const ReviewActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
`;

const ResolveButton = styled.button<{ variant: 'keep' | 'replace' }>`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background-color 0.2s;
  background-color: ${props => props.variant === 'keep' ? '#28a745' : '#007bff'};
  color: white;
  
  &:hover {
    background-color: ${props => props.variant === 'keep' ? '#218838' : '#0056b3'};
  }
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

const TestSelectorButton = styled.button`
  padding: 6px 12px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.2s;
  margin-right: 8px;
  
  &:hover {
    background-color: #1e7e34;
  }
  
  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
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
  const navigate = useNavigate();
  const [elements, setElements] = useState<RecordedElement[]>([]);
  const [filteredElements, setFilteredElements] = useState<RecordedElement[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPage, setSelectedPage] = useState('all');
  const [needsWorkFilter, setNeedsWorkFilter] = useState('all'); // 'all', 'needs-work', 'stable'
  const [healthFilter, setHealthFilter] = useState('all'); // 'all', 'healthy', 'warning', 'error'
  const [reviewQueueVersion, setReviewQueueVersion] = useState(0); // Force re-render when queue changes
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
      console.log('Raw API response:', response);
      
      // Handle different response formats
      let elementsData = [];
      
      if (response && typeof response === 'object') {
        if (response.success && response.data) {
          // Standard ApiResponse format: {success: true, data: [...]}
          elementsData = response.data;
          console.log('Using ApiResponse format, found elements:', elementsData.length);
        } else if (Array.isArray(response)) {
          // Direct array response: [{...}, {...}]
          elementsData = response;
          console.log('Using direct array format, found elements:', elementsData.length);
        } else {
          throw new Error(`Unexpected response format: ${JSON.stringify(response).substring(0, 100)}...`);
        }
      } else {
        throw new Error('Invalid response from server');
      }

      if (elementsData && elementsData.length > 0) {
        console.log('Sample element structure:', elementsData[0]);
        
        // Convert API elements to frontend format
        const frontendElements = elementsData.map((apiElement, index) => {
          // Handle both database format and simple API format
          if (apiElement.logical_key && apiElement.timestamp_recorded) {
            // Database format - use existing conversion
            return sqlApiClient.convertElementToFrontend(apiElement);
          } else {
            // Simple API format - convert directly
            return {
              id: apiElement.id || `element_${index}`,
              dbId: apiElement.id || `element_${index}`,
              tag: apiElement.tag || 'unknown',
              text: apiElement.text || apiElement.text_content || 'No text',
              attributes: apiElement.attributes || {},
              xpath: apiElement.xpath || '',
              cssSelector: apiElement.css_selector || '',
              position: { 
                x: apiElement.position_x || 0, 
                y: apiElement.position_y || 0 
              },
              selectors: apiElement.selectors || [apiElement.css_selector, apiElement.xpath].filter(Boolean),
              page: apiElement.page || 'Unknown page',
              timestamp: apiElement.timestamp_recorded ? 
                new Date(apiElement.timestamp_recorded).getTime() : 
                Date.now()
            };
          }
        });
        
        setElements(frontendElements);
        console.log(` Successfully loaded ${frontendElements.length} elements`);
      } else {
        console.log('No elements found in response');
        setElements([]);
      }
      
    } catch (error: any) {
      console.error('Error loading elements from SQL backend:', error);
      setError(`Failed to load elements: ${error.message}`);
      setElements([]);
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
      console.log('Element details:', {
        id: element.id,
        dbId: element.dbId,
        xpath: element.xpath,
        editForm: editForm
      });
      
      // Check if SQL backend is available
      const isHealthy = await sqlApiClient.healthCheck();
      if (!isHealthy) {
        throw new Error('SQL backend not available');
      }

      // Update in database if we have the dbId
      if (element.dbId) {
        console.log('Updating element with dbId:', element.dbId);
        console.log('Update payload:', { 
          logical_key: editForm.id,
          xpath: editForm.xpath 
        });
        
        const updateResponse = await sqlApiClient.updateElement(element.dbId, {
          logical_key: editForm.id,
          xpath: editForm.xpath
        });
        
        if (!updateResponse.success) {
          throw new Error(updateResponse.error || 'Failed to update in database');
        }
        
        console.log(' Element updated in database successfully');
      } else {
        console.warn('No dbId found for element, skipping database update');
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
      
      console.log(` Element "${element.id}" updated successfully`);
      
    } catch (error: any) {
      console.error(' Error saving element:', error);
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
      
      console.log(` Element "${elementId}" successfully deleted from database and UI`);
      
    } catch (error: any) {
      console.error(' Error deleting element:', error);
      
      // Show detailed error to user
      alert(`Failed to delete element "${elementId}": ${error.message}\n\nThe element was not removed to keep UI in sync with database.`);
    }
  };

  // Auto-select first element when elements load
  // Handle element selection
  const handleElementClick = (element: RecordedElement) => {
    // element.id now contains logical_key from the simplified schema conversion
    navigate(`/review/${element.id}`);
  };

  // Helper function to get health status with score
  const getElementHealthStatus = (element: RecordedElement): { status: 'healthy' | 'warning' | 'error', score: number, label: string } => {
    // First check if element is in review queue - this overrides health score
    const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
    const isInQueue = reviewQueue.some((item: any) => item.elementId === element.id);
    
    if (isInQueue) {
      return { 
        status: 'error', 
        score: 0, 
        label: 'In Review Queue' 
      };
    }

    let healthScore = 100;
    const issues: string[] = [];

    // Same health calculation logic
    if (elementNeedsWork(element)) {
      healthScore -= 30;
      issues.push('dynamic content');
    }
    
    if (!element.cssSelector && !element.xpath) {
      healthScore -= 50;
      issues.push('missing selectors');
    }
    
    const hasEmptyAttributes = !element.attributes || 
      Object.keys(element.attributes).length === 0 ||
      JSON.stringify(element.attributes) === '{}';
    if (hasEmptyAttributes) {
      healthScore -= 20;
      issues.push('empty attributes');
    }
    
    if (!element.text || element.text === '[null]' || element.text.trim() === '') {
      healthScore -= 10;
      issues.push('missing text');
    }
    
    const daysSinceUpdate = (Date.now() - element.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 30) {
      healthScore -= 25;
      issues.push('outdated');
    }
    
    const selector = element.cssSelector || element.xpath || '';
    const weakPatterns = [
      /^div$/,                    
      /^span$/,                   
      /^input$/,                  
      /^button$/,                 
      /div:nth-child\(\d+\)$/,    
      /^\[style\]/,               
    ];
    
    if (weakPatterns.some(pattern => pattern.test(selector))) {
      healthScore -= 15;
      issues.push('weak selector');
    }

    // Determine status based on score
    let status: 'healthy' | 'warning' | 'error';
    let label: string;
    
    if (healthScore >= 80) {
      status = 'healthy';
      label = 'Healthy';
    } else if (healthScore >= 60) {
      status = 'warning';
      label = 'Warning';
    } else {
      status = 'error';
      label = 'Needs Attention';
    }

    return { status, score: healthScore, label };
  };

  // Keep the original boolean function for filtering
  const isElementHealthy = (element: RecordedElement): boolean => {
    return getElementHealthStatus(element).score >= 70;
  };



  useEffect(() => {
    loadElements();
  }, [loadElements]);

  // Listen for review queue changes and force re-render
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'reviewQueue') {
        setReviewQueueVersion(prev => prev + 1);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Also include reviewQueueVersion in the filtering dependency
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

    // Filter by health status (including review queue status)
    if (healthFilter !== 'all') {
      filtered = filtered.filter(element => {
        const healthStatus = getElementHealthStatus(element);
        return healthStatus.status === healthFilter;
      });
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(element => {
        // Search in element name (text or tag)
        const elementName = (element.text || element.tag || '').toLowerCase();
        if (elementName.includes(term)) return true;
        
        // Search in element ID
        if (element.id.toLowerCase().includes(term)) return true;
        
        // Search in page name
        if ((element.page || '').toLowerCase().includes(term)) return true;
        
        // Search in selectors
        if ((element.cssSelector || '').toLowerCase().includes(term)) return true;
        if ((element.xpath || '').toLowerCase().includes(term)) return true;
        
        // Search in attributes
        return Object.entries(element.attributes).some(([key, value]) => 
          key.toLowerCase().includes(term) || 
          value.toString().toLowerCase().includes(term)
        );
      });
    }

    setFilteredElements(filtered);
  }, [elements, searchTerm, selectedPage, needsWorkFilter, healthFilter, reviewQueueVersion]);

  // Get unique pages for filter dropdown
  const allPages = Array.from(new Set(elements.map(e => e.page || 'unknown'))).sort();

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const totalElements = elements.length;
  const filteredCount = filteredElements.length;

  return (
    <Container>
      <MainContent>
        <MainHeader>
          <PageTitle>Elements</PageTitle>
          <NewButton>New Element</NewButton>
        </MainHeader>
        <FilterBar>
          <SearchInput
            type="text"
            placeholder="Search by name, tag, or text..."
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
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
          >
            <option value="all">All Health States</option>
            <option value="healthy">🟢 Healthy</option>
            <option value="warning">🟡 Warning</option>
            <option value="error">🔴 Needs Attention</option>
          </FilterSelect>
          <FilterSelect
            value={needsWorkFilter}
            onChange={(e) => setNeedsWorkFilter(e.target.value)}
          >
            <option value="all">All Elements</option>
            <option value="needs-work"> Needs Work</option>
            <option value="stable"> Stable</option>
          </FilterSelect>
        </FilterBar>
        <FilterSummary>
          <div>
            Showing <FilterCount>{filteredCount}</FilterCount> of <FilterCount>{totalElements}</FilterCount> elements
            {searchTerm && <span> • Filter: "{searchTerm}"</span>}
            {selectedPage !== 'all' && <span> • Page: {selectedPage}</span>}
            {healthFilter !== 'all' && <span> • Health: {healthFilter}</span>}
            {needsWorkFilter !== 'all' && <span> • Status: {needsWorkFilter}</span>}
          </div>
          <div>
            {filteredCount !== totalElements && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setSelectedPage('all');
                  setHealthFilter('all');
                  setNeedsWorkFilter('all');
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
        <TableContainer>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
              Loading elements from SQL backend...
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <ErrorMessage>
                <strong>Error loading elements:</strong> {error}
                <br />
                <button 
                  onClick={loadElements}
                  style={{
                    marginTop: '16px',
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
              </ErrorMessage>
            </div>
          )}

          {!loading && filteredElements.length === 0 && !error && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
              <h3>No elements found</h3>
              <p>
                {elements.length === 0 
                  ? 'No recorded elements available. Start recording elements in the Chrome Extension to see them here.'
                  : 'No elements match your current filters. Try adjusting your search or page filter.'
                }
              </p>
            </div>
          )}

          {!loading && filteredElements.length > 0 && (
            <Table>
              <TableHeader>
                <tr>
                  <TableHeaderCell>Name</TableHeaderCell>
                  <TableHeaderCell>Page</TableHeaderCell>
                  <TableHeaderCell>Primary Selector</TableHeaderCell>
                  <TableHeaderCell>Health</TableHeaderCell>
                  <TableHeaderCell>Last Seen</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </tr>
              </TableHeader>
              <TableBody>
                {filteredElements.map((element) => (
                  <TableRow key={element.id} onClick={() => handleElementClick(element)}>
                    <TableCell>
                      <ElementName>
                        {element.id || 'Unnamed Element'}
                      </ElementName>
                    </TableCell>
                    <TableCell>
                      {element.page || '/unknown'}
                    </TableCell>
                    <TableCell>
                      <code>{element.cssSelector || element.xpath || 'No selector'}</code>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const healthStatus = getElementHealthStatus(element);
                        return (
                          <HealthBadge status={healthStatus.status} title={`Health Score: ${healthStatus.score}/100`}>
                            <HealthDot status={healthStatus.status} />
                            {healthStatus.label}
                          </HealthBadge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {formatTimestamp(element.timestamp)}
                    </TableCell>
                    <TableCell>
                      <EditButton 
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row click navigation
                          startEditing(element);
                        }}
                        title="Edit element"
                      >
                        ✏️ Edit
                      </EditButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>

        {/* Edit Form Modal */}
        {editingElement && editForm && (
          <EditForm>
            <h3>Edit Element</h3>
            <EditFormRow>
              <EditLabel htmlFor="element-id">Element ID:</EditLabel>
              <EditInput
                id="element-id"
                type="text"
                value={editForm.id}
                onChange={(e) => setEditForm({...editForm, id: e.target.value})}
              />
            </EditFormRow>
            <EditFormRow>
              <EditLabel htmlFor="element-xpath">XPath:</EditLabel>
              <EditTextarea
                id="element-xpath"
                value={editForm.xpath}
                onChange={(e) => setEditForm({...editForm, xpath: e.target.value})}
                rows={3}
              />
            </EditFormRow>
            <EditActions>
              <button onClick={() => {
                const element = filteredElements.find(el => getEditingKey(el) === editingElement);
                if (element) saveElement(element);
              }}>
                Save Changes
              </button>
              <button onClick={cancelEditing}>Cancel</button>
            </EditActions>
          </EditForm>
        )}
      </MainContent>
    </Container>
  );
};

export default MCPElementsViewer;
