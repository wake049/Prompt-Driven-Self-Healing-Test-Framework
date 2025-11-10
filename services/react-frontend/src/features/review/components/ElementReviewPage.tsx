import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
<<<<<<< Updated upstream
import sqlApiClient, { RecordedElement } from '../../../shared/utils/sqlApiClient';
=======
import { useTheme } from '../../../contexts/ThemeContext';
import { useMCPContext } from '../../../contexts/MCPContext';
import { sqlApiClient, RecordedElementDB } from '../../../shared/utils/sqlApiClient';
import { useElementSelectorSync, useSyncNotifications } from '../../../shared/hooks/useSyncHooks';
import { SyncIndicator, SyncNotification as SyncNotificationComponent } from '../../../shared/components/SyncVisualIndicators';
>>>>>>> Stashed changes
import { 
  detectDynamicContent, 
  isDynamicSelector, 
  getDynamicContentSeverity, 
  getDynamicContentWarning,
  DynamicContentMatch 
} from '../../../shared/utils/dynamicContentDetection';

<<<<<<< Updated upstream
=======
// RecordedElement interface for frontend use
export interface RecordedElement {
  id: string;
  dbId?: number;
  tag: string;
  text: string;
  cssSelector: string;
  xpath: string;
  href?: string;
  src?: string;
  page: string;
  isActive: boolean;
  dynamicContent?: DynamicContentMatch[];
  lastUpdated?: string;
  selectors?: string[];
  attributes?: Record<string, any>;
  timestamp?: number;
  element_key?: string;
  primary_selector?: string;
}

>>>>>>> Stashed changes
// ================================
// Styled Components
// ================================

const Container = styled.div`
  min-height: 100vh;
  background: #f8f9fa;
`;

const BackButton = styled.button`
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  color: #6c757d;
  padding: 12px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  margin: 20px 40px;
  transition: all 0.2s;
  
  &:hover {
    background: #e9ecef;
    color: #495057;
  }
`;

const ContentWrapper = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 40px 40px;
`;

const Header = styled.div`
  background: white;
  border-radius: 12px;
  padding: 40px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 2.2rem;
  font-weight: 600;
`;

const Subtitle = styled.div`
  color: #6c757d;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
`;

const HealthBadge = styled.div<{ status: 'healthy' | 'warning' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
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
  width: 8px;
  height: 8px;
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

const SectionsGrid = styled.div`
  display: grid;
  gap: 24px;
`;

const Section = styled.div`
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const SectionHeader = styled.div`
  background: #f8f9fa;
  padding: 20px 24px;
  border-bottom: 1px solid #e9ecef;
  font-weight: 600;
  color: #495057;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
`;

const SectionContent = styled.div`
  padding: 24px;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const InfoLabel = styled.div`
  font-size: 0.85rem;
  color: #6c757d;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const InfoValue = styled.div`
  font-weight: 500;
  color: #2c3e50;
  word-break: break-word;
  font-size: 1rem;
`;

const SelectorList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SelectorItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #007bff;
`;

const SelectorCode = styled.code`
  background: #e9ecef;
  padding: 8px 12px;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  display: block;
  margin-top: 8px;
  word-break: break-all;
  border: 1px solid #dee2e6;
`;

const TestButton = styled.button`
  background: #28a745;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background: #218838;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  padding: 24px;
  border-top: 1px solid #e9ecef;
  background: #f8f9fa;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid;
  font-size: 0.95rem;
  
  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: #007bff;
          color: white;
          border-color: #007bff;
          &:hover { background: #0056b3; border-color: #0056b3; }
        `;
      case 'danger':
        return `
          background: #dc3545;
          color: white;
          border-color: #dc3545;
          &:hover { background: #c82333; border-color: #c82333; }
        `;
      default:
        return `
          background: white;
          color: #6c757d;
          border-color: #dee2e6;
          &:hover { background: #f8f9fa; color: #495057; }
        `;
    }
  }}
`;

const AttributesList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

const AttributeTag = styled.span`
  background: #e9ecef;
  color: #495057;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: monospace;
  border: 1px solid #dee2e6;
`;

const EditForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px solid #007bff;
`;

const EditFormRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const EditLabel = styled.label`
  font-weight: 600;
  color: #495057;
  font-size: 0.9rem;
`;

const EditInput = styled.input`
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const EditTextarea = styled.textarea`
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const EditActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid #dee2e6;
`;

const RecommendationItem = styled.div`
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #17a2b8;
  margin-bottom: 12px;
  font-size: 0.95rem;
`;

const LoadingState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
  color: #6c757d;
  font-size: 1.2rem;
`;

const ErrorState = styled.div`
  background: #f8d7da;
  color: #721c24;
  padding: 20px;
  border-radius: 8px;
  margin: 40px;
  text-align: center;
`;

const ReviewQueueBadge = styled.div<{ isInQueue: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
  background: ${props => props.isInQueue ? '#fff3cd' : '#f8f9fa'};
  color: ${props => props.isInQueue ? '#856404' : '#6c757d'};
  border: 1px solid ${props => props.isInQueue ? '#ffeaa7' : '#dee2e6'};
`;

const ReviewQueueButton = styled.button<{ isInQueue: boolean }>`
  background: ${props => props.isInQueue ? '#dc3545' : '#007bff'};
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 16px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &:hover {
    background: ${props => props.isInQueue ? '#c82333' : '#0056b3'};
  }
`;

const ReviewQueueDialog = styled.div`
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

const ReviewQueueDialogContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
`;

const ReviewQueueDialogTitle = styled.h3`
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 1.4rem;
`;

const ReviewQueueTextarea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 20px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  }
`;

const ReviewQueueActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;

const DialogButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.variant === 'primary' ? '#007bff' : '#f8f9fa'};
  color: ${props => props.variant === 'primary' ? 'white' : '#6c757d'};
  border: 1px solid ${props => props.variant === 'primary' ? '#007bff' : '#dee2e6'};
  
  &:hover {
    background: ${props => props.variant === 'primary' ? '#0056b3' : '#e9ecef'};
  }
`;

// ================================
// Component
// ================================

interface ElementReviewPageProps {
  elementId?: string;
  onBack?: () => void;
}

const ElementReviewPage: React.FC<ElementReviewPageProps> = ({ elementId, onBack }) => {
<<<<<<< Updated upstream
=======
  const { theme } = useTheme();
  const { client } = useMCPContext();
>>>>>>> Stashed changes
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [element, setElement] = useState<RecordedElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    id: string;
    cssSelector: string;
    xpath: string;
    text: string;
  } | null>(null);
  
  // Review Queue functionality
  const [isInReviewQueue, setIsInReviewQueue] = useState(false);
  const [reviewQueueNote, setReviewQueueNote] = useState('');
  const [showReviewQueueDialog, setShowReviewQueueDialog] = useState(false);
<<<<<<< Updated upstream

=======
  const [isAddingToQueue, setIsAddingToQueue] = useState(false);
>>>>>>> Stashed changes
  const targetElementId = elementId || id;

  useEffect(() => {
    if (targetElementId) {
      loadElement(targetElementId);
    }
  }, [targetElementId]);

  useEffect(() => {
    if (element) {
      loadReviewQueueStatus();
    }
  }, [element]);

  // Listen for storage changes to update review queue status
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'reviewQueue' && element) {
        loadReviewQueueStatus();
      }
    };
<<<<<<< Updated upstream

=======
    // Also listen for in-window updates triggered by this app
    const handleCustomUpdate = () => {
      if (element) loadReviewQueueStatus();
    };
>>>>>>> Stashed changes
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('reviewQueueUpdated', handleCustomUpdate as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('reviewQueueUpdated', handleCustomUpdate as EventListener);
    };
  }, [element]);

  const loadElement = async (elemId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await sqlApiClient.getAllElements();
      
      // Handle different response formats
      let elementsData = [];
      if (response && typeof response === 'object') {
        if (response.success && response.data) {
          elementsData = response.data;
        } else if (Array.isArray(response)) {
          elementsData = response;
        } else {
          throw new Error('Unexpected response format');
        }
      } else {
        throw new Error('Invalid response from server');
      }

      // Helper method to filter out recording-related attributes
      const filterRecordingAttributes = (attributes: Record<string, any>): Record<string, any> => {
        const filtered = { ...attributes };
        
        // Remove MCP recording-related attributes
        delete filtered['mcp-hover-highlight'];
        delete filtered['mcp-recorded-highlight'];
        delete filtered['mcp-element-id'];
        delete filtered['mcp-recorded'];
        
        // Clean up class attribute to remove MCP-related classes
        if (filtered.class && typeof filtered.class === 'string') {
          const classes = filtered.class.split(' ').filter(cls => 
            !cls.startsWith('mcp-') && 
            cls !== 'mcp-hover-highlight' && 
            cls !== 'mcp-recorded-highlight'
          );
          
          if (classes.length > 0) {
            filtered.class = classes.join(' ');
          } else {
            delete filtered.class;
          }
        }
        
        return filtered;
      };

      // Convert database elements to frontend format
      const frontendElements = elementsData.map((apiElement) => {
        if (apiElement.logical_key && apiElement.timestamp_recorded) {
          // Database format - use existing conversion
<<<<<<< Updated upstream
          return sqlApiClient.convertElementToFrontend(apiElement);
=======
          // Convert database element to frontend format
          return {
            id: apiElement.logical_key || apiElement.element_key || apiElement.id,
            dbId: apiElement.id,
            tag: apiElement.tag || 'unknown',
            text: apiElement.text_content || apiElement.text || '',
            cssSelector: apiElement.css_selector || '',
            xpath: apiElement.xpath || '',
            href: apiElement.href || '',
            src: apiElement.src || '',
            page: apiElement.page || 'unknown',
            isActive: apiElement.is_active !== false,
            selectors: apiElement.selectors || [],
            attributes: apiElement.attributes || {},
            timestamp: apiElement.timestamp || Date.now()
          } as RecordedElement;
>>>>>>> Stashed changes
        } else {
          // Parse attributes if it's a string
          let parsedAttributes = {};
          try {
            if (typeof apiElement.attributes === 'string') {
              parsedAttributes = JSON.parse(apiElement.attributes);
            } else if (typeof apiElement.attributes === 'object' && apiElement.attributes !== null) {
              parsedAttributes = apiElement.attributes;
            }
          } catch (e) {
            console.warn('Failed to parse attributes:', apiElement.attributes);
            parsedAttributes = {};
          }

          // Filter out recording-related attributes
          const cleanAttributes = filterRecordingAttributes(parsedAttributes);

          // Simple API format - convert directly
          return {
            id: apiElement.logical_key || apiElement.element_key || apiElement.id,
            dbId: apiElement.id,
            tag: apiElement.tag || 'unknown',
            text: apiElement.text || apiElement.text_content || 'No text',
            attributes: cleanAttributes,
            xpath: apiElement.xpath || '',
            cssSelector: apiElement.css_selector || '',
            position: { x: apiElement.position_x || 0, y: apiElement.position_y || 0 },
            selectors: Array.isArray(apiElement.selectors) ? apiElement.selectors : [],
            page: apiElement.page || '',
            timestamp: apiElement.timestamp_recorded ? new Date(apiElement.timestamp_recorded).getTime() : Date.now(),
          };
        }
      });
<<<<<<< Updated upstream

      // Find element by frontend ID (which is the logical_key from database)
      const foundElement = frontendElements.find((el) => el.id === elemId);
      
      if (!foundElement) {
        console.error('Element not found. Search ID:', elemId, 'Available IDs:', frontendElements.map(el => el.id));
        setError('Element not found');
=======
      // Find element by frontend ID, dbId (UUID), or logical key
      let foundElement = frontendElements.find((el) => el.id === elemId);
      
      if (!foundElement) {
        // Try to find by database UUID (dbId)
        foundElement = frontendElements.find((el) => el.dbId === elemId);
      }
      
      if (!foundElement) {
        // Try to find by logical key 
        foundElement = frontendElements.find((el) => (el as any).logicalKey === elemId);
      }
      
      if (!foundElement) {
        // Check if there's a similar ID (case-insensitive or partial match)
        const similarIds = frontendElements.filter(el => 
          el.id?.toLowerCase().includes(elemId.toLowerCase()) ||
          elemId.toLowerCase().includes(el.id?.toLowerCase() || '')
        );
        
        setError(`Element not found: ${elemId}`);
>>>>>>> Stashed changes
        return;
      }
      
      setElement(foundElement);
    } catch (err) {
      console.error('Error loading element:', err);
      setError('Failed to load element details');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/');
    }
  };

  const handleDelete = async () => {
    if (!element) return;
    
    if (confirm('Are you sure you want to delete this element? This action cannot be undone.')) {
      try {
        await sqlApiClient.deleteElement(element.id);
        handleBack();
      } catch (err) {
        console.error('Error deleting element:', err);
        alert('Failed to delete element');
      }
    }
  };

  const handleEdit = () => {
    if (!element) return;
    
    setEditForm({
      id: element.id,
      cssSelector: element.cssSelector || '',
      xpath: element.xpath || '',
      text: element.text || ''
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!element || !editForm) return;
    
    try {
      // Update the element with new values
      const updatedElement = {
        ...element,
        id: editForm.id,
        cssSelector: editForm.cssSelector,
        xpath: editForm.xpath,
        text: editForm.text,
        timestamp: Date.now() // Update timestamp
      };
      
      // Call API to update element  
      await sqlApiClient.updateElement(element.dbId || element.id, {
        logical_key: editForm.id,
        css_selector: editForm.cssSelector,
        xpath: editForm.xpath,
        text_content: editForm.text
      });
      
      setElement(updatedElement);
      setIsEditing(false);
      setEditForm(null);
      alert('Element updated successfully!');
    } catch (err) {
      console.error('Error updating element:', err);
      alert('Failed to update element');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(null);
  };
<<<<<<< Updated upstream

  // Review Queue Management Functions
  const loadReviewQueueStatus = () => {
    // Check if element is in review queue (stored in localStorage for now)
    const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
    const isInQueue = reviewQueue.some((item: any) => item.elementId === targetElementId);
    setIsInReviewQueue(isInQueue);
    
    if (isInQueue) {
      const queueItem = reviewQueue.find((item: any) => item.elementId === targetElementId);
      setReviewQueueNote(queueItem?.note || '');
=======
  // Helper function to get a meaningful element name for display
  const getElementDisplayName = (element: RecordedElement): string => {
    // If we have a meaningful logical key (not a UUID), use it
    if (element.id && element.id !== 'UNKNOWN' && element.id.trim() !== '') {
      // Check if it's a UUID pattern (8-4-4-4-12 hex characters with dashes)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      // If it's not a UUID, it's likely a meaningful element_key from the database
      if (!uuidPattern.test(element.id)) {
        return element.id;
      }
>>>>>>> Stashed changes
    }
    
    // If element.id is a UUID, try to use text content or fallback to tag
    if (element.text && element.text !== '[null]' && element.text.trim() !== '') {
      const text = element.text.trim();
      if (text.length <= 30) {
        return `${element.tag}: "${text}"`;
      } else {
        return `${element.tag}: "${text.substring(0, 27)}..."`;
      }
    }
    
    // Try to extract meaningful info from selectors
    if (element.cssSelector || element.xpath) {
      const selector = element.cssSelector || element.xpath || '';
      // Extract ID from CSS selector like #item_5_title_link
      const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        return `${element.tag}#${idMatch[1]}`;
      }
    }
    
    // Fallback to tag with identifier
    return `${element.tag} element`;
  };

<<<<<<< Updated upstream
  const addToReviewQueue = async (note: string = '') => {
    if (!element) return;
    
    try {
      const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
      const newQueueItem = {
        elementId: element.id,
        elementName: element.text || element.tag || 'Unnamed Element',
        addedAt: new Date().toISOString(),
        note: note,
        healthStatus: getElementHealthStatus(element),
        page: element.page || 'Unknown'
      };
      
      // Add to queue if not already present
      if (!reviewQueue.some((item: any) => item.elementId === element.id)) {
        reviewQueue.push(newQueueItem);
        localStorage.setItem('reviewQueue', JSON.stringify(reviewQueue));
        setIsInReviewQueue(true);
        setReviewQueueNote(note);
        alert('Element added to review queue!');
      }
    } catch (err) {
      console.error('Error adding to review queue:', err);
      alert('Failed to add element to review queue');
    }
  };

=======
  // Review Queue Management Functions
  const loadReviewQueueStatus = async () => {
    // Skip loading if we're currently adding to queue to prevent race conditions
    if (isAddingToQueue) {
      return;
    }
      if (client) {
        const reviewQueue = await client.getPendingReviews();
        const queueArray = Array.isArray(reviewQueue) ? reviewQueue : (reviewQueue?.data || []);        
        const isInQueue = queueArray.some((item: any) => {
          const matches = (
            item.element_id === targetElementId || 
            item.elementId === targetElementId ||
            item.id === targetElementId ||
            item.element_name === targetElementId ||
            item.elementName === targetElementId
          );
          return matches;
        });        
        setIsInReviewQueue(Boolean(isInQueue));
        
        if (isInQueue) {
          const queueItem = queueArray.find((item: any) => 
            item.element_id === targetElementId || 
            item.elementId === targetElementId ||
            item.id === targetElementId ||
            item.element_name === targetElementId ||
            item.elementName === targetElementId
          );
          setReviewQueueNote(queueItem?.note || queueItem?.suggestion?.note || '');
        } else {
          setReviewQueueNote('');
        }
        return; // MCP check succeeded, no need to check localStorage
      }
    
    // Fallback to localStorage check
    try {
      const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
      const isInQueue = Array.isArray(reviewQueue) && reviewQueue.some((item: any) => item.elementId === targetElementId);
      setIsInReviewQueue(Boolean(isInQueue));
      if (isInQueue) {
        const queueItem = reviewQueue.find((item: any) => item.elementId === targetElementId);
        setReviewQueueNote(queueItem?.note || '');
      } else {
        setReviewQueueNote('');
      }
    } catch (err) {
      setIsInReviewQueue(false);
      setReviewQueueNote('');
    }
  };

  const addToReviewQueue = async (note: string = '') => {
    if (!element || !client) return;
    
    // Prevent duplicate additions
    if (isAddingToQueue) {
      return;
    }
    
    setIsAddingToQueue(true);
    
    try {
      
      const healthStatus = getElementHealthStatus(element);
      
      // Use element_key from database if available, otherwise create a display name
      let elementDisplayName = element.element_key || element.text || 'Unnamed Element';
      
      // If element_key is not available, create a better display name
      if (!element.element_key || element.element_key === 'unknown') {
        if (element.text && element.text.trim() && element.text !== 'unknown') {
          elementDisplayName = element.text.trim();
        } else if (element.primary_selector) {
          // Extract meaningful name from selector
          const selector = element.primary_selector;
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
          } else if (element.tag && element.tag !== 'unknown') {
            elementDisplayName = `${element.tag} Element`;
          }
        } else if (element.tag && element.tag !== 'unknown') {
          elementDisplayName = `${element.tag} Element`;
        }
      }
      
      const result = await client.addToReviewQueue(
        element.id,
        elementDisplayName,
        note,
        element.page || 'Unknown',
        healthStatus.label
      );
      
      // Update current UI immediately
      setIsInReviewQueue(true);
      setReviewQueueNote(note);
      window.dispatchEvent(new Event('reviewQueueUpdated'));

      // Reload the status after a short delay to ensure the backend is updated
      setTimeout(() => {
        setIsAddingToQueue(false);
        loadReviewQueueStatus();
      }, 1500); // 1.5 second delay to allow backend to process
      
      try { alert('Element added to review queue!'); } catch (e) { /* ignore */ }
    } catch (err) {
      setIsAddingToQueue(false);
      try { alert('Failed to add element to review queue'); } catch (e) { /* ignore */ }
    }
  };

>>>>>>> Stashed changes
  const removeFromReviewQueue = async () => {
    if (!element) return;
    
    try {
      const existing = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
      const reviewQueue = Array.isArray(existing) ? existing : [];
      const updatedQueue = reviewQueue.filter((item: any) => item.elementId !== element.id);
      localStorage.setItem('reviewQueue', JSON.stringify(updatedQueue));
      setIsInReviewQueue(false);
      setReviewQueueNote('');
<<<<<<< Updated upstream
      alert('Element removed from review queue!');
    } catch (err) {
      console.error('Error removing from review queue:', err);
      alert('Failed to remove element from review queue');
=======
      try { window.dispatchEvent(new Event('reviewQueueUpdated')); } catch (e) { /* ignore */ }
      try { alert('Element removed from review queue!'); } catch (e) { /* ignore */ }
    } catch (err) {
      try { alert('Failed to remove element from review queue'); } catch (e) { /* ignore */ }
>>>>>>> Stashed changes
    }
  };

  const handleReviewQueueAction = () => {
    if (isInReviewQueue) {
      removeFromReviewQueue();
    } else {
      setShowReviewQueueDialog(true);
    }
  };

  const getReviewQueueCount = () => {
    const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
    return reviewQueue.length;
  };

  // Helper function to get detailed health status with specific issues
  const getElementHealthStatus = (elem: RecordedElement): { 
    status: 'healthy' | 'warning' | 'error', 
    score: number, 
    label: string,
    issues: string[]
  } => {
    // First check if element is in review queue - this overrides health score
    const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
    const isInQueue = reviewQueue.some((item: any) => item.elementId === elem.id);
    
    if (isInQueue) {
      const queueItem = reviewQueue.find((item: any) => item.elementId === elem.id);
      return { 
        status: 'error', 
        score: 0, 
        label: 'In Review Queue',
        issues: queueItem?.note ? [`Queued for review: ${queueItem.note}`] : ['Element is in review queue']
      };
    }

    let healthScore = 100;
    const issues: string[] = [];

    // 1. Check for dynamic content issues (major issue -30 points)
    const dynamicMatches = detectDynamicContent(elem.cssSelector || '');
    if (dynamicMatches.length > 0) {
      healthScore -= 30;
      issues.push(`Dynamic content detected in selector`);
    }
    
    // 2. Check if element has selectors (-50 points if missing both)
    if (!elem.cssSelector && !elem.xpath) {
      healthScore -= 50;
      issues.push('Missing both CSS selector and XPath');
    }
    
    // 3. Check for empty or minimal attributes (-20 points)
    const hasEmptyAttributes = !elem.attributes || 
      Object.keys(elem.attributes).length === 0 ||
      JSON.stringify(elem.attributes) === '{}';
    if (hasEmptyAttributes) {
      healthScore -= 20;
      issues.push('Empty or missing element attributes');
    }
    
    // 4. Check for null or empty text content (-10 points)
    if (!elem.text || elem.text === '[null]' || elem.text.trim() === '') {
      healthScore -= 10;
      issues.push('Missing or empty text content');
    }
    
    // 5. Check age - very lenient (only flag if > 30 days old)
    const daysSinceUpdate = (Date.now() - elem.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 30) {
      healthScore -= 25;
      issues.push(`Element is outdated (${Math.round(daysSinceUpdate)} days old)`);
    }
    
    // 6. Check for very weak selectors only (-15 points)
    const selector = elem.cssSelector || elem.xpath || '';
    const weakPatterns = [
      { pattern: /^div$/, name: 'Generic div selector' },
      { pattern: /^span$/, name: 'Generic span selector' },
      { pattern: /^input$/, name: 'Generic input selector' },
      { pattern: /^button$/, name: 'Generic button selector' },
      { pattern: /div:nth-child\(\d+\)$/, name: 'Position-based selector' },
      { pattern: /^\[style\]/, name: 'Style-based selector' },
    ];
    
    const weakPattern = weakPatterns.find(wp => wp.pattern.test(selector));
    if (weakPattern) {
      healthScore -= 15;
      issues.push(`Weak selector: ${weakPattern.name}`);
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

    return { status, score: healthScore, label, issues };
  };

  // Keep the original boolean function for compatibility
  const isElementHealthy = (elem: RecordedElement): boolean => {
    return getElementHealthStatus(elem).score >= 70;
  };

  const elementNeedsWork = (elem: RecordedElement): boolean => {
    const dynamicMatches = detectDynamicContent(elem.cssSelector || '');
    return dynamicMatches.length > 0;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <Container>
        <LoadingState>Loading element details...</LoadingState>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <ErrorState>
          <h3>Error</h3>
          <p>{error}</p>
          <ActionButton onClick={handleBack}>← Back to Elements</ActionButton>
        </ErrorState>
      </Container>
    );
  }

  if (!element) {
    return (
      <Container>
        <ErrorState>
          <h3>Element Not Found</h3>
          <p>The requested element could not be found.</p>
          <ActionButton onClick={handleBack}>← Back to Elements</ActionButton>
        </ErrorState>
      </Container>
    );
  }

  const healthStatus = getElementHealthStatus(element);
  const needsWork = elementNeedsWork(element);

  return (
    <Container>
      <BackButton onClick={handleBack}>
        ← Back to Elements
      </BackButton>
      
      <ContentWrapper>
<<<<<<< Updated upstream
        <Header>
          <Title>
            {(element.id && typeof element.id === 'string' ? element.id : '') || 
             (element.text && typeof element.text === 'string' ? element.text : '') || 
             (element.tag && typeof element.tag === 'string' ? element.tag : '') || 
             'Unnamed Element'}
=======
        <Header theme={theme}>
          <Title theme={theme}>
            {getElementDisplayName(element)}
>>>>>>> Stashed changes
          </Title>
          <Subtitle>
            <span>Element Review & Management</span>
            <HealthBadge status={healthStatus.status} title={`Health Score: ${healthStatus.score}/100`}>
              <HealthDot status={healthStatus.status} />
              {healthStatus.label}
            </HealthBadge>
            <ReviewQueueBadge isInQueue={isInReviewQueue}>
              {isInReviewQueue ? ' In Review Queue' : ' Not in Queue'} 
              {getReviewQueueCount() > 0 && ` (${getReviewQueueCount()} total)`}
            </ReviewQueueBadge>
            <ReviewQueueButton isInQueue={isInReviewQueue} onClick={handleReviewQueueAction}>
              {isInReviewQueue ? ' Remove from Queue' : '➕ Add to Queue'}
            </ReviewQueueButton>
          </Subtitle>
        </Header>

        <SectionsGrid>
          {/* Basic Information Section */}
          <Section>
            <SectionHeader>
               Basic Information
              {!isEditing && (
                <ActionButton onClick={handleEdit}>
                  ✏️ Edit
                </ActionButton>
              )}
            </SectionHeader>
            <SectionContent>
              {isEditing ? (
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
                    <EditLabel>Text Content</EditLabel>
                    <EditInput
                      type="text"
                      value={editForm?.text || ''}
                      onChange={(e) => setEditForm(prev => prev ? {...prev, text: e.target.value} : null)}
                      placeholder="Enter element text content"
                    />
                  </EditFormRow>
                  
                  <EditFormRow>
                    <EditLabel>CSS Selector</EditLabel>
                    <EditTextarea
                      value={editForm?.cssSelector || ''}
                      onChange={(e) => setEditForm(prev => prev ? {...prev, cssSelector: e.target.value} : null)}
                      placeholder="Enter CSS selector"
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
                    <ActionButton onClick={handleCancelEdit}>
                      Cancel
                    </ActionButton>
                    <ActionButton variant="primary" onClick={handleSaveEdit}>
                      Save Changes
                    </ActionButton>
                  </EditActions>
                </EditForm>
              ) : (
                <InfoGrid>
                  <InfoItem>
                    <InfoLabel>Element ID</InfoLabel>
                    <InfoValue>{String(element.id || '')}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Tag Type</InfoLabel>
                    <InfoValue>{String(element.tag || '')}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Page</InfoLabel>
                    <InfoValue>{String(element.page || '/unknown')}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Last Seen</InfoLabel>
                    <InfoValue>{formatTimestamp(element.timestamp)}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Text Content</InfoLabel>
                    <InfoValue>{String(element.text || 'No text content')}</InfoValue>
                  </InfoItem>
                  <InfoItem>
                    <InfoLabel>Discovery Method</InfoLabel>
                    <InfoValue>Chrome Extension Recording</InfoValue>
                  </InfoItem>
                </InfoGrid>
              )}
            </SectionContent>
          </Section>

          {/* Selectors Section */}
          <Section>
            <SectionHeader>
               Selectors & Targeting
              <TestButton onClick={() => alert('Test functionality coming soon!')}>
                Test All Selectors
              </TestButton>
            </SectionHeader>
            <SectionContent>
              <SelectorList>
                {element.cssSelector && (
                  <SelectorItem>
                    <div style={{ flex: 1 }}>
                      <InfoLabel>CSS Selector</InfoLabel>
                      <SelectorCode>{String(element.cssSelector)}</SelectorCode>
                    </div>
                    <TestButton onClick={() => alert('Testing CSS selector...')}>
                      Test
                    </TestButton>
                  </SelectorItem>
                )}
                {element.xpath && (
                  <SelectorItem>
                    <div style={{ flex: 1 }}>
                      <InfoLabel>XPath</InfoLabel>
                      <SelectorCode>{String(element.xpath)}</SelectorCode>
                    </div>
                    <TestButton onClick={() => alert('Testing XPath...')}>
                      Test
                    </TestButton>
                  </SelectorItem>
                )}
                {element.selectors && Array.isArray(element.selectors) && element.selectors.length > 0 && (
                  element.selectors.map((selector, index) => (
                    <SelectorItem key={index}>
                      <div style={{ flex: 1 }}>
                        <InfoLabel>Alternative Selector {index + 1}</InfoLabel>
                        <SelectorCode>{String(selector)}</SelectorCode>
                      </div>
                      <TestButton onClick={() => alert(`Testing selector ${index + 1}...`)}>
                        Test
                      </TestButton>
                    </SelectorItem>
                  ))
                )}
              </SelectorList>
            </SectionContent>
          </Section>

          {/* Element Attributes Section */}
          {element.attributes && Object.keys(element.attributes).length > 0 && (
            <Section>
              <SectionHeader>
                🏷️ Element Attributes
              </SectionHeader>
              <SectionContent>
                <AttributesList>
                  {Object.entries(element.attributes).map(([key, value]) => (
                    <AttributeTag key={key}>
                      {key}="{typeof value === 'object' ? JSON.stringify(value) : String(value)}"
                    </AttributeTag>
                  ))}
                </AttributesList>
              </SectionContent>
            </Section>
          )}

          {/* Health & Stability Analysis */}
          <Section>
            <SectionHeader>
               Health & Stability Analysis
            </SectionHeader>
            <SectionContent>
              <InfoGrid>
                <InfoItem>
                  <InfoLabel>Overall Health</InfoLabel>
                  <InfoValue>
                    {healthStatus.status === 'healthy' ? '🟢 Healthy' : 
                     healthStatus.status === 'warning' ? '🟡 Warning' : 
                     '🔴 Needs Attention'} ({healthStatus.score}/100)
                  </InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Dynamic Content Risk</InfoLabel>
                  <InfoValue>
                    {needsWork ? ' High Risk' : ' Low Risk'}
                  </InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Selector Strength</InfoLabel>
                  <InfoValue>
                    {element.cssSelector?.includes('#') ? '💪 Strong (ID-based)' :
                     element.cssSelector?.includes('[data-') ? '👍 Good (Data attributes)' :
                     ' Weak (Generic classes)'}
                  </InfoValue>
                </InfoItem>
                <InfoItem>
                  <InfoLabel>Last Update</InfoLabel>
                  <InfoValue>
                    {(() => {
                      const days = Math.floor((Date.now() - element.timestamp) / (1000 * 60 * 60 * 24));
                      return days === 0 ? 'Today' : 
                             days === 1 ? '1 day ago' : 
                             days < 7 ? `${days} days ago` : 
                             ' Over a week ago';
                    })()}
                  </InfoValue>
                </InfoItem>
              </InfoGrid>
              
              {/* Show specific health issues if any */}
              {healthStatus.issues.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <InfoLabel style={{ marginBottom: '10px', display: 'block', fontWeight: 600 }}>
                     Health Issues Detected:
                  </InfoLabel>
                  <ul style={{ 
                    margin: 0, 
                    paddingLeft: '20px',
                    color: '#721c24',
                    backgroundColor: '#f8d7da',
                    padding: '12px 20px',
                    borderRadius: '6px',
                    border: '1px solid #f5c6cb'
                  }}>
                    {healthStatus.issues.map((issue, index) => (
                      <li key={index} style={{ marginBottom: '4px' }}>{String(issue)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionContent>
          </Section>

          {/* Recommendations Section */}
          <Section>
            <SectionHeader>
               Recommendations
            </SectionHeader>
            <SectionContent>
              {(() => {
                const recommendations = [];
                
                if (healthStatus.status !== 'healthy') {
                  // Generate specific recommendations based on detected issues
                  healthStatus.issues.forEach(issue => {
                    if (issue.includes('Missing both CSS selector and XPath')) {
                      recommendations.push(" Add reliable CSS selector or XPath for this element");
                    } else if (issue.includes('Dynamic content detected')) {
                      recommendations.push(" Review and stabilize dynamic content patterns");
                    } else if (issue.includes('Empty or missing element attributes')) {
                      recommendations.push(" Add meaningful attributes to improve element identification");
                    } else if (issue.includes('Missing or empty text content')) {
                      recommendations.push("📝 Add descriptive text content if applicable");
                    } else if (issue.includes('outdated')) {
                      recommendations.push("🔄 Update element information - it's been outdated");
                    } else if (issue.includes('Weak selector')) {
                      recommendations.push("💪 Improve selector specificity with IDs or data attributes");
                    }
                  });
                  
                  // General recommendations based on status
                  if (healthStatus.status === 'warning') {
                    recommendations.push(" Monitor this element for stability issues");
                  } else if (healthStatus.status === 'error') {
                    recommendations.push("🚨 Prioritize fixing this element to prevent test failures");
                  }
                } else {
                  recommendations.push(" Element is healthy and properly configured");
                  recommendations.push("👍 Continue monitoring for any changes");
                }
                
                return (
                  <div>
                    {recommendations.map((rec, index) => (
                      <RecommendationItem key={index}>
                        {String(rec)}
                      </RecommendationItem>
                    ))}
                  </div>
                );
              })()}
            </SectionContent>
          </Section>
        </SectionsGrid>

        {/* Review Queue Management */}
        <Section>
          <SectionHeader>
             Review Queue Status
          </SectionHeader>
          <SectionContent>
            <InfoGrid>
              <InfoItem>
                <InfoLabel>Queue Status</InfoLabel>
                <InfoValue>
                  {isInReviewQueue ? (
                    <span style={{ color: '#856404' }}>
                       In Review Queue
                    </span>
                  ) : (
                    <span style={{ color: '#6c757d' }}>
                       Not in Queue
                    </span>
                  )}
                </InfoValue>
              </InfoItem>
              {isInReviewQueue && (
                <>
                  <InfoItem>
                    <InfoLabel>Added to Queue</InfoLabel>
                    <InfoValue>
                      {(() => {
                        const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
                        const queueItem = reviewQueue.find((item: any) => item.elementId === element.id);
                        return queueItem ? new Date(queueItem.addedAt).toLocaleString() : 'Unknown';
                      })()}
                    </InfoValue>
                  </InfoItem>
                  {reviewQueueNote && (
                    <InfoItem>
                      <InfoLabel>Review Notes</InfoLabel>
                      <InfoValue style={{ fontStyle: 'italic' }}>
                        "{reviewQueueNote}"
                      </InfoValue>
                    </InfoItem>
                  )}
                </>
              )}
            </InfoGrid>
            <div style={{ marginTop: '20px' }}>
              <ReviewQueueButton isInQueue={isInReviewQueue} onClick={handleReviewQueueAction}>
                {isInReviewQueue ? ' Remove from Review Queue' : '➕ Add to Review Queue'}
              </ReviewQueueButton>
            </div>
          </SectionContent>
        </Section>

        {/* Action Buttons */}
        <Section>
          <ActionButtons>
            <ActionButton onClick={() => alert('Clone functionality coming soon!')}>
               Clone Element
            </ActionButton>
            <ActionButton variant="danger" onClick={handleDelete}>
              🗑️ Delete Element
            </ActionButton>
          </ActionButtons>
        </Section>
      </ContentWrapper>
      
      {/* Review Queue Dialog */}
      {showReviewQueueDialog && (
        <ReviewQueueDialog>
          <ReviewQueueDialogContent>
            <ReviewQueueDialogTitle>Add to Review Queue</ReviewQueueDialogTitle>
            <p>Add a note about why this element needs review:</p>
            <ReviewQueueTextarea
              value={reviewQueueNote}
              onChange={(e) => setReviewQueueNote(e.target.value)}
              placeholder="Enter review notes (optional)..."
            />
            <ReviewQueueActions>
              <DialogButton 
                variant="secondary" 
                onClick={() => {
                  setShowReviewQueueDialog(false);
                  setReviewQueueNote('');
                }}
              >
                Cancel
              </DialogButton>
              <DialogButton 
                variant="primary" 
                onClick={() => {
                  addToReviewQueue(reviewQueueNote);
                  setShowReviewQueueDialog(false);
                  setReviewQueueNote('');
                }}
              >
                Add to Queue
              </DialogButton>
            </ReviewQueueActions>
          </ReviewQueueDialogContent>
        </ReviewQueueDialog>
      )}
    </Container>
  );
};

export default ElementReviewPage;