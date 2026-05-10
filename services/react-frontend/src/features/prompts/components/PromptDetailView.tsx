import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { pulseKeyframes, slideInKeyframes, spinKeyframes } from '../../../shared/styles/keyframes';
import { useTheme } from '../../../contexts/ThemeContext';
import { config } from '../../../app/config';
import unifiedApiClient from '../../../shared/utils/unifiedApiClient';
import { TestCaseExecutionHistory } from '../../execution';
import { promptsApiService } from '../api';
import { useAuth } from '../../../contexts/AuthContext';
import { usePolicyPermissions } from '../../../hooks/usePolicyPermissions';
import { BindingsManager } from '../../bindings';
import { usePromptSelectorSync, useSyncNotifications } from '../../../shared/hooks/useSyncHooks';
import { SyncIndicator, SyncNotification as SyncNotificationDisplay } from '../../../shared/components/SyncVisualIndicators';
import BrowserSelector from '../../../shared/ui/BrowserSelector';
import { PromptVersions } from './PromptVersions';
import { PromptActivitySidebar } from './PromptActivitySidebar';
import { 
  RefreshCw, 
  Play, 
  Edit3, 
  MoreVertical, 
  FileText, 
  ArrowLeft, 
  Settings, 
  Copy, 
  Archive, 
  History,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Link,
  ChevronRight,
  X
} from 'lucide-react';

// Modern Styled Components
const Container = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
  font-family: '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif;
  color: ${props => props.theme.colors.text};
`;

const Layout = styled.div`
  display: flex;
  height: 100vh;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const HistoryToggleButton = styled.button`
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  background: #185FA5;
  color: white;
  border: none;
  border-radius: 12px 0 0 12px;
  padding: 16px 12px;
  cursor: pointer;
  box-shadow: -4px 0 12px rgba(102, 126, 234, 0.3);
  z-index: 999;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  
  &:hover {
    padding-right: 16px;
    box-shadow: -6px 0 16px rgba(102, 126, 234, 0.4);
  }
`;

const HistorySidebarOverlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1000;
  opacity: ${props => props.$isOpen ? 1 : 0};
  pointer-events: ${props => props.$isOpen ? 'auto' : 'none'};
  transition: opacity 0.3s ease;
`;

const HistorySidebarPanel = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  right: ${props => props.$isOpen ? '0' : '-350px'};
  top: 0;
  bottom: 0;
  width: 350px;
  background: white;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  transition: right 0.3s ease;
  display: flex;
  flex-direction: column;
`;

const HistorySidebarHeader = styled.div`
  padding: 24px;
  background: #185FA5;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const HistorySidebarTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const HistorySidebarClose = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const HistorySidebarContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 24px;
`;

const HistoryItem = styled.div`
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f8fafc;
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const HistoryAction = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
`;

const HistoryDate = styled.div`
  font-size: 12px;
  color: #64748b;
`;

const Header = styled.div`
  background: #185FA5;
  padding: 32px 40px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }
  
  > * {
    position: relative;
    z-index: 1;
  }

  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const Breadcrumb = styled.div`
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BreadcrumbLink = styled.span`
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;

  &:hover {
    color: white;
  }
`;

const TitleSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
  }
`;

const TitleLeft = styled.div`
  flex: 1;
`;

const Category = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: white;
  margin: 0;
  line-height: 1.2;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const ActionsBar = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;

  @media (max-width: 768px) {
    flex-wrap: wrap;
    width: 100%;
    justify-content: center;
  }
`;

const PrimaryButton = styled.button<{ variant?: 'primary' | 'running' }>`
  background: ${props => props.variant === 'running' 
    ? 'linear-gradient(135deg, #6b7280, #4b5563)' 
    : '#185FA5'};
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  cursor: ${props => props.variant === 'running' ? 'not-allowed' : 'pointer'};
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: ${props => props.variant === 'running' 
    ? 'none' 
    : '0 4px 15px rgba(102, 126, 234, 0.4)'};

  &:hover {
    transform: ${props => props.variant === 'running' ? 'none' : 'translateY(-2px)'};
    box-shadow: ${props => props.variant === 'running' 
      ? 'none' 
      : '0 6px 20px rgba(102, 126, 234, 0.6)'};
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const SecondaryButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 12px 20px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  backdrop-filter: blur(10px);

  &:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.2);
    color: white;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const DropdownContainer = styled.div`
  position: relative;
`;

const DropdownButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);

  &:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.2);
    color: white;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }
`;

const Dropdown = styled.div<{ theme: any }>`
  position: absolute;
  top: 100%;
  right: 0;
  background: ${props => props.theme.colors.surface};
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 180px;
  margin-top: 8px;
  overflow: hidden;
  backdrop-filter: blur(10px);
`;

const DropdownItem = styled.div<{ theme: any }>`
  padding: 12px 16px;
  font-size: 14px;
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(102, 126, 234, 0.1);

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    color: #185FA5;
  }
`;

const EditingIndicator = styled.div`
  color: #f59e0b;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(245, 158, 11, 0.2);
`;

const TabsContainer = styled.div`
  display: flex;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  padding: 0 40px;
  border-bottom: 2px solid;
  border-image: linear-gradient(90deg, #185FA5 0%, #185FA5 100%) 1;

  @media (max-width: 768px) {
    padding: 0 20px;
    overflow-x: auto;
  }
`;

const Tab = styled.div<{ $active?: boolean }>`
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.$active ? '#185FA5' : '#6c757d'};
  cursor: pointer;
  border-bottom: 3px solid ${props => props.$active ? '#185FA5' : 'transparent'};
  transition: all 0.3s ease;
  white-space: nowrap;
  position: relative;
  border-radius: 8px 8px 0 0;
  
  ${props => props.$active && `
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    box-shadow: 0 -2px 8px rgba(102, 126, 234, 0.2);
  `}

  &:hover {
    color: #185FA5;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
  }
`;

const StepBadge = styled.span`
  background: #185FA5;
  color: white;
  border-radius: 16px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  margin-left: 8px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
`;

const Content = styled.div<{ theme: any }>`
  flex: 1;
  padding: 40px;
  overflow: auto;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};

  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const SectionTitle = styled.h3`
  font-size: 18px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SectionCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
  box-shadow: ${props => props.theme.shadows.medium};
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.large};
  }
`;

const Description = styled.div`
  font-size: 15px;
  color: ${props => props.theme.colors.text};
  line-height: 1.6;
  margin-bottom: 16px;
`;

const ContentBox = styled.div`
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  padding: 20px;
  font-size: 14px;
  color: ${props => props.theme.colors.text};
  line-height: 1.6;
  font-family: 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
  white-space: pre-wrap;
  overflow-x: auto;
`;

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Tag = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: ${props => props.theme.shadows.small};
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
  flex-direction: column;
  gap: 16px;
`;

const LoadingSpinner = styled.div`
  border: 2px solid ${props => props.theme.colors.border};
  border-top: 2px solid ${props => props.theme.colors.primary};
  border-radius: 50%;
  width: 32px;
  height: 32px;
  animation: ${spinKeyframes} 1s linear infinite;
`;

const LoadingText = styled.span`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 16px;
`;

const ErrorMessage = styled.div`
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  border: 1px solid #c85050;
  color: #8a2222;
  padding: 20px;
  border-radius: 12px;
  margin: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(248, 113, 113, 0.2);
`;

interface PromptData {
  id: string;  // Changed from number to string for UUID
  title: string;
  description: string;
  content: string;
  starting_url?: string;
  test_type?: 'web' | 'app';
  external_id?: string;  // Jira/Xray ID - editable by user
  category: string;
  tags: string[];  // Changed to match API response
  status?: string;
  priority?: string;
  version?: number;
  usage_count: number;
  estimated_duration?: string;
  dateModified: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

const extractSourceSectionFromTags = (tags: string[] = []): string | null => {
  const tag = tags.find((t) => t.startsWith('source_section:'));
  if (!tag) return null;
  const value = tag.replace('source_section:', '').trim();
  return value || null;
};

// Step editing components  
const StepEditForm: React.FC<{
  step: any;
  stepIndex: number;
  promptId: string;
  onSave: (updatedStep: any) => void;
  onCancel: () => void;
  onSyncUpdate?: (stepIndex: number, paramKey: string, newValue: string) => Promise<void>;
}> = ({ step, stepIndex, promptId, onSave, onCancel, onSyncUpdate }) => {
  const [editedStep, setEditedStep] = useState({ ...step });
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const updateParam = async (key: string, value: string) => {
    // Check if this is a selector parameter that might need syncing
    const selectorKeys = ['selector', 'elementId', 'target', 'locator'];
    const isSelector = selectorKeys.includes(key);
    const oldValue = editedStep.params?.[key];
    
    // Update local state
    setEditedStep({
      ...editedStep,
      params: { ...editedStep.params, [key]: value }
    });

    // If this is a selector change and we have sync functionality, trigger sync
    if (isSelector && value !== oldValue && onSyncUpdate && value.trim()) {
      try {
        setIsSyncing(true);
        await onSyncUpdate(stepIndex, key, value);
      } catch (error) {
        console.error('Failed to sync selector change:', error);
        // Optionally show a warning but don't revert the change
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const addParam = () => {
    if (newParamKey && newParamValue) {
      updateParam(newParamKey, newParamValue);
      setNewParamKey('');
      setNewParamValue('');
    }
  };

  const removeParam = (key: string) => {
    const { [key]: removed, ...rest } = editedStep.params;
    setEditedStep({ ...editedStep, params: rest });
  };

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#f9fafb',
      border: '2px solid #3b82f6',
      borderRadius: '8px'
    }}>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
          Action Name:
        </label>
        <input
          type="text"
          value={editedStep.name}
          onChange={(e) => setEditedStep({ ...editedStep, name: e.target.value })}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
          Parameters:
        </label>
        {Object.entries(editedStep.params || {}).map(([key, value]) => {
          const isSelector = ['selector', 'elementId', 'target', 'locator'].includes(key);
          return (
            <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const newKey = e.target.value;
                  const { [key]: oldValue, ...rest } = editedStep.params;
                  setEditedStep({
                    ...editedStep,
                    params: { ...rest, [newKey]: oldValue }
                  });
                }}
                style={{
                  flex: '0 0 120px',
                  padding: '6px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}
              />
              <input
                type="text"
                value={typeof value === 'string' ? value : JSON.stringify(value)}
                onChange={(e) => updateParam(key, e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px',
                  border: `1px solid ${isSelector ? '#1D9E75' : '#d1d5db'}`,
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: isSelector ? '#f0fdf4' : 'white'
                }}
                disabled={isSyncing}
              />
              {isSelector && (
                <SyncIndicator status="linked" size="small" />
              )}
              <button
                onClick={() => removeParam(key)}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#A32D2D',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
        
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            type="text"
            placeholder="Parameter name"
            value={newParamKey}
            onChange={(e) => setNewParamKey(e.target.value)}
            style={{
              flex: '0 0 120px',
              padding: '6px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <input
            type="text"
            placeholder="Parameter value"
            value={newParamValue}
            onChange={(e) => setNewParamValue(e.target.value)}
            style={{
              flex: 1,
              padding: '6px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <button
            onClick={addParam}
            style={{
              padding: '6px 10px',
              backgroundColor: '#1D9E75',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ➕
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={() => onSave(editedStep)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1D9E75',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
           Save
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6b7280',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
           Cancel
        </button>
      </div>
    </div>
  );
};

const AddStepForm: React.FC<{
  onAdd: (newStep: any) => void;
  onCancel: () => void;
}> = ({ onAdd, onCancel }) => {
  const [newStep, setNewStep] = useState({
    name: '',
    params: {} as any
  });
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');

  const addParam = () => {
    if (newParamKey && newParamValue) {
      setNewStep({
        ...newStep,
        params: { ...newStep.params, [newParamKey]: newParamValue }
      });
      setNewParamKey('');
      setNewParamValue('');
    }
  };

  const removeParam = (key: string) => {
    const { [key]: removed, ...rest } = newStep.params;
    setNewStep({ ...newStep, params: rest });
  };

  const handleSave = () => {
    if (newStep.name) {
      onAdd(newStep);
      setNewStep({ name: '', params: {} });
    }
  };

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#f0f9ff',
      border: '2px solid #1D9E75',
      borderRadius: '8px',
      marginTop: '16px'
    }}>
      <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
        ➕ Add New Step
      </h4>
      
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
          Action Name:
        </label>
        <select
          value={newStep.name}
          onChange={(e) => setNewStep({ ...newStep, name: e.target.value })}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          <option value="">Select action type...</option>
          <option value="open_url">open_url - Navigate to a URL</option>
          <option value="click_css">click_css - Click an element</option>
          <option value="type_css">type_css - Type text into an input</option>
          <option value="wait_for_css">wait_for_css - Wait for element to appear</option>
          <option value="assert_text_css">assert_text_css - Verify element text</option>
          <option value="assert_title_contains">assert_title_contains - Check page title</option>
          <option value="screenshot">screenshot - Take a screenshot</option>
        </select>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
          Parameters:
        </label>
        {Object.entries(newStep.params).map(([key, value]) => (
          <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              flex: '0 0 120px',
              padding: '6px',
              backgroundColor: '#e5e7eb',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              {key}
            </span>
            <span style={{
              flex: 1,
              padding: '6px',
              backgroundColor: '#e5e7eb',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              {typeof value === 'string' ? value : JSON.stringify(value)}
            </span>
            <button
              onClick={() => removeParam(key)}
              style={{
                padding: '6px 10px',
                backgroundColor: '#A32D2D',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        ))}
        
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            type="text"
            placeholder="Parameter name (e.g., css, text, url)"
            value={newParamKey}
            onChange={(e) => setNewParamKey(e.target.value)}
            style={{
              flex: '0 0 200px',
              padding: '6px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <input
            type="text"
            placeholder="Parameter value"
            value={newParamValue}
            onChange={(e) => setNewParamValue(e.target.value)}
            style={{
              flex: 1,
              padding: '6px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <button
            onClick={addParam}
            style={{
              padding: '6px 10px',
              backgroundColor: '#1D9E75',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ➕
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          disabled={!newStep.name}
          style={{
            padding: '8px 16px',
            backgroundColor: newStep.name ? '#1D9E75' : '#d1d5db',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: newStep.name ? 'pointer' : 'not-allowed'
          }}
        >
           Add Step
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6b7280',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
           Cancel
        </button>
      </div>
    </div>
  );
};

// Modern Steps Section Components
const StepsSection = styled.div`
  padding: 24px;
  background: ${props => props.theme.colors.background};
`;

const StepsSectionTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 24px 0;
  display: flex;
  align-items: center;
  gap: 12px;

  &::before {
    content: '';
    width: 4px;
    height: 24px;
    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
    border-radius: 2px;
  }
`;

const StepsErrorAlert = styled.div`
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border: 1px solid #fca5a5;
  border-left: 4px solid #8a2222;
  color: #8a2222;
  padding: 16px 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.1);

  &::before {
    content: '⚠️';
    font-size: 18px;
  }
`;

const StepsEmptyState = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 2px dashed #cbd5e1;
  border-radius: 16px;
  padding: 48px 32px;
  text-align: center;
  margin-bottom: 24px;
  transition: all 0.3s ease;

  &:hover {
    border-color: #3b82f6;
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  }
`;

const EmptyStateIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
`;

const EmptyStateText = styled.p`
  color: #64748b;
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 8px 0;
`;

const EmptyStateSubtext = styled.p`
  color: #94a3b8;
  font-size: 14px;
  margin: 0;
`;

const StepsMetadataCard = styled.div`
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border: 1px solid #0ea5e9;
  border-left: 4px solid #0ea5e9;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  font-size: 14px;
  color: #0c4a6e;
  line-height: 1.6;
  box-shadow: 0 4px 6px -1px rgba(14, 165, 233, 0.1);

  strong {
    font-weight: 600;
    color: #0369a1;
  }
`;

const StepsActionButtonsContainer = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const StepsSaveButton = styled.button<{ loading?: boolean }>`
  background: linear-gradient(135deg, #0F6E56 0%, #1D9E75 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: ${props => props.loading ? 'not-allowed' : 'pointer'};
  opacity: ${props => props.loading ? 0.6 : 1};
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 15px -3px rgba(16, 185, 129, 0.3);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }
`;

const StepsEditButton = styled.button`
  background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.2);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 15px -3px rgba(245, 158, 11, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

const StepsCancelButton = styled.button`
  background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 6px -1px rgba(107, 114, 128, 0.2);

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 15px -3px rgba(107, 114, 128, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

const StepsSuccessMessage = styled.span`
  color: #0F6E56;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  border-radius: 8px;
  border: 1px solid #34d399;
`;

const ModernStepsContainer = styled.div`
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
`;

const EditingModeAlert = styled.div`
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
  border: 1px solid #f59e0b;
  border-left: 4px solid #f59e0b;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.1);
`;

const EditingModeText = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #92400e;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AddStepButton = styled.button`
  background: linear-gradient(135deg, #0F6E56 0%, #1D9E75 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

// Modern Step Display Components
const StepCard = styled.div<{ isEditing?: boolean }>`
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #e2e8f0;
  border-left: 4px solid #3b82f6;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  ${props => props.isEditing ? 
    'border: 2px dashed #3b82f6; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);' : ''
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const StepHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
`;

const StepNumber = styled.div`
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
`;

const StepContent = styled.div`
  flex: 1;
`;

const StepTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
`;

const StepDescription = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
  line-height: 1.4;
  flex: 1;
`;

const ActionTypeBadge = styled.span<{ actionType?: string }>`
  background: ${props => {
    switch(props.actionType) {
      case 'open_url': return 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)';
      case 'click_css': 
      case 'click': return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      case 'type_css': 
      case 'type': return 'linear-gradient(135deg, #1D9E75 0%, #0F6E56 100%)';
      case 'wait_for_css': 
      case 'wait_for': return 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
      case 'assert_text_css': 
      case 'assert_text': 
      case 'assert_title_contains': return 'linear-gradient(135deg, #A32D2D 0%, #8a2222 100%)';
      case 'calculate': 
      case 'math': 
      case 'computation': return 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)';
      case 'scroll': return 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)';
      case 'hover': return 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)';
      case 'select': 
      case 'select_option': return 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)';
      case 'extract_data':
      case 'extract':
      case 'get_data': return 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)';
      case 'screenshot': return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
      default: return 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
    }
  }};
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
`;

const StepActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StepActionButton = styled.button<{ variant?: 'edit' | 'up' | 'down' | 'delete' }>`
  background: ${props => {
    switch(props.variant) {
      case 'edit': return 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
      case 'up': 
      case 'down': return 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
      case 'delete': return 'linear-gradient(135deg, #A32D2D 0%, #8a2222 100%)';
      default: return 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
    }
  }};
  color: white;
  border: none;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StepDetails = styled.div`
  margin-top: 12px;
`;

const StepDetailRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  font-size: 14px;
`;

const StepDetailLabel = styled.span`
  font-weight: 600;
  color: #4b5563;
  min-width: 80px;
  font-size: 13px;
`;

const StepDetailValue = styled.span`
  color: #1f2937;
  font-family: 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
  background: rgba(59, 130, 246, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
  flex: 1;
  word-break: break-all;
`;

const detailStyles = {
  container: {
    backgroundColor: '#ffffff',
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  layout: {
    display: 'flex',
    height: '100vh'
  },
  sidebar: {
    width: '240px',
    backgroundColor: '#f8fafc',
    borderRight: '1px solid #e2e8f0',
    padding: '24px 0'
  },
  sidebarItem: {
    padding: '12px 24px',
    fontSize: '14px',
    color: '#64748b',
    borderBottom: '1px solid #e2e8f0',
    cursor: 'pointer'
  },
  sidebarItemActive: {
    backgroundColor: '#0f766e',
    color: '#ffffff'
  },
  sidebarHeader: {
    padding: '0 24px 16px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase' as 'uppercase',
    letterSpacing: '0.05em'
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as 'column'
  },
  header: {
    borderBottom: '1px solid #e2e8f0',
    padding: '24px 32px',
    backgroundColor: '#ffffff'
  },
  breadcrumb: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '8px'
  },
  breadcrumbLink: {
    color: '#0f766e',
    textDecoration: 'none',
    cursor: 'pointer'
  },
  titleSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  titleLeft: {
    flex: 1
  },
  category: {
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: '#0f766e',
    color: '#ffffff',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    marginBottom: '8px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0 0 8px 0'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  primaryButton: {
    backgroundColor: '#0f766e',
    color: '#ffffff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '1px solid #d1d5db',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  dropdownButton: {
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '1px solid #d1d5db',
    padding: '10px 12px',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    position: 'relative' as 'relative'
  },
  dropdown: {
    position: 'absolute' as 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    minWidth: '160px',
    marginTop: '4px'
  },
  dropdownItem: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer',
    borderBottom: '1px solid #f3f4f6'
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 32px'
  },
  tab: {
    padding: '16px 24px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#64748b',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s'
  },
  tabActive: {
    color: '#0f766e',
    borderBottomColor: '#0f766e'
  },
  content: {
    flex: 1,
    padding: '32px',
    overflow: 'auto'
  },
  descriptionSection: {
    marginBottom: '32px'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '12px'
  },
  description: {
    fontSize: '14px',
    color: '#475569',
    lineHeight: '1.6'
  },
  contentSection: {
    marginBottom: '32px'
  },
  contentBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '14px',
    color: '#475569',
    lineHeight: '1.6',
    fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", monospace',
    whiteSpace: 'pre-wrap' as 'pre-wrap'
  },
  tagsSection: {
    marginBottom: '32px'
  },
  tag: {
    display: 'inline-block',
    padding: '6px 12px',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    marginRight: '8px',
    marginBottom: '8px'
  },
  historySidebar: {
    width: '280px',
    backgroundColor: '#ffffff',
    borderLeft: '1px solid #e2e8f0',
    padding: '24px'
  },
  historyItem: {
    padding: '12px 0',
    borderBottom: '1px solid #f1f5f9'
  },
  historyAction: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: '4px'
  },
  historyDate: {
    fontSize: '12px',
    color: '#64748b'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px'
  },
  error: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#8a2222',
    padding: '16px',
    borderRadius: '8px',
    margin: '32px'
  },
  stepsContainer: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '32px'
  },
  stepItem: {
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '12px',
    fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", monospace',
    fontSize: '14px'
  },
  stepItemWithRealElement: {
    backgroundColor: '#ffffff',
    border: '1px solid #1D9E75',
    borderRadius: '6px',
    padding: '16px',
    marginBottom: '12px',
    fontFamily: 'Monaco, "Cascadia Code", "Roboto Mono", monospace',
    fontSize: '14px',
    boxShadow: '0 1px 3px rgba(16, 185, 129, 0.1)'
  },
  stepHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  stepName: {
    fontWeight: '600',
    color: '#0f766e',
    backgroundColor: '#f0fdfa',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px'
  },
  stepIndex: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500'
  },
  stepParams: {
    backgroundColor: '#f8fafc',
    padding: '12px',
    borderRadius: '4px',
    marginTop: '8px',
    border: '1px solid #e2e8f0'
  },
  stepParamRow: {
    display: 'flex',
    marginBottom: '6px'
  },
  stepParamKey: {
    fontWeight: '600',
    color: '#374151',
    minWidth: '80px',
    marginRight: '12px'
  },
  stepParamValue: {
    color: '#0F6E56',
    flex: 1,
    wordBreak: 'break-all' as 'break-all'
  },
  realElementBadge: {
    backgroundColor: '#1D9E75',
    color: '#ffffff',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    marginLeft: '8px'
  },
  genericElementBadge: {
    backgroundColor: '#6b7280',
    color: '#ffffff',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    marginLeft: '8px'
  },
  stepsError: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#8a2222',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px'
  },
  stepsMetadata: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '12px',
    fontSize: '13px',
    color: '#475569',
    marginBottom: '16px'
  }
};

// Sync-related styled components
const SyncStatusIndicator = styled.div<{ hasRelated: boolean; isUpdating: boolean; theme: any }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.3s ease;
  
  ${props => props.hasRelated ? `
    background: linear-gradient(135deg, #1D9E75 0%, #38b2ac 100%);
    color: white;
    box-shadow: 0 1px 4px rgba(72, 187, 120, 0.3);
  ` : `
    background: ${props.theme.colors.surface === '#2d3748' ? 'rgba(74, 85, 104, 0.4)' : 'rgba(226, 232, 240, 0.6)'};
    color: ${props.theme.colors.textSecondary};
  `}
  
  ${props => props.isUpdating && `
    animation: ${pulseKeyframes} 2s infinite;
  `}
`;

const SyncNotificationComponent = styled.div<{ type: 'success' | 'error' | 'info' }>`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  padding: 12px 20px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: ${slideInKeyframes} 0.3s ease-out;
  max-width: 400px;
  
  background: ${props => {
    switch (props.type) {
      case 'success': return 'linear-gradient(135deg, #1D9E75 0%, #38b2ac 100%)';
      case 'error': return 'linear-gradient(135deg, #c85050 0%, #A32D2D 100%)';
      case 'info': return 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)';
      default: return 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)';
    }
  }};
`;

const ElementSyncIndicator = styled.span<{ hasSync: boolean; theme: any }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  
  ${props => props.hasSync ? `
    background: linear-gradient(135deg, #1D9E75 0%, #38b2ac 100%);
    color: white;
  ` : `
    background: ${props.theme.colors.surface === '#2d3748' ? 'rgba(74, 85, 104, 0.4)' : 'rgba(156, 163, 175, 0.3)'};
    color: ${props.theme.colors.textSecondary};
  `}
`;

const SyncCodeElement = styled.code<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? '#0d1117' : '#f3f4f6'};
  color: ${props => props.theme.colors.surface === '#2d3748' ? '#f0f6fc' : props.theme.colors.text};
  border: ${props => props.theme.colors.surface === '#2d3748' ? '1px solid #30363d' : 'none'};
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  margin-left: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-weight: 500;
`;

const SyncDescriptionText = styled.div<{ theme: any }>`
  margin-bottom: 12px;
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const SyncElementCode = styled.code<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? '#0d1117' : '#f8f9fa'};
  color: ${props => props.theme.colors.surface === '#2d3748' ? '#f0f6fc' : props.theme.colors.text};
  border: ${props => props.theme.colors.surface === '#2d3748' ? '1px solid #30363d' : 'none'};
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-weight: 500;
`;

const SyncEmptyStateText = styled.div<{ theme: any }>`
  text-align: center;
  color: ${props => props.theme.colors.textSecondary};
  padding: 20px;
  
  .icon {
    font-size: 24px;
    margin-bottom: 8px;
  }
  
  .description {
    font-size: 13px;
    margin-top: 6px;
  }
`;

// Failure Analysis Styled Components
const FailureAnalysisSection = styled.div<{ theme: any }>`
  padding: 20px;
`;

const FailureAnalysisHeader = styled.div<{ theme: any }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const FailureAnalysisTitle = styled.h3<{ theme: any }>`
  color: ${props => props.theme.colors.text};
  font-size: 18px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RefreshButton = styled.button<{ theme: any }>`
  background: ${props => props.theme.colors.primary};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 0.8;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FailureCard = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: ${props => props.theme.shadows.medium};
  }
`;

const FailureHeader = styled.div<{ theme: any }>`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
`;

const FailureInfo = styled.div<{ theme: any }>`
  flex: 1;
`;

const FailureTitle = styled.h4<{ theme: any }>`
  color: ${props => props.theme.colors.text};
  font-size: 16px;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FailureDate = styled.div<{ theme: any }>`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
`;

const GenerateButton = styled.button<{ theme: any }>`
  background: #185FA5;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${props => props.theme.shadows.medium};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const FailedStepsContainer = styled.div<{ theme: any }>`
  margin-top: 16px;
`;

const FailedStepsTitle = styled.div<{ theme: any }>`
  color: ${props => props.theme.colors.text};
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 14px;
`;

const FailureStepCard = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? '#1a202c' : '#f7fafc'};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
`;

const StepAction = styled.div<{ theme: any }>`
  color: ${props => props.theme.colors.text};
  font-weight: 500;
  margin-bottom: 4px;
`;

const StepError = styled.div<{ theme: any }>`
  color: #A32D2D;
  font-size: 13px;
  background: ${props => props.theme.colors.surface === '#2d3748' ? 'rgba(229, 62, 62, 0.1)' : 'rgba(229, 62, 62, 0.05)'};
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid #A32D2D;
`;

const MinimalReproSection = styled.div<{ theme: any }>`
  margin-top: 24px;
  padding: 20px;
  background: ${props => props.theme.colors.surface === '#2d3748' ? '#2d3748' : '#f8f9fa'};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
`;

const MinimalReproTitle = styled.h4<{ theme: any }>`
  color: ${props => props.theme.colors.text};
  font-size: 16px;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const MinimalStepsList = styled.div<{ theme: any }>`
  margin-top: 12px;
`;

const MinimalStep = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MinimalStepNumber = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.primary};
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
`;

const MinimalStepContent = styled.div<{ theme: any }>`
  flex: 1;
`;

const MinimalStepDescription = styled.div<{ theme: any }>`
  color: ${props => props.theme.colors.text};
  font-weight: 500;
  margin-bottom: 4px;
`;

const MinimalStepDetails = styled.div<{ theme: any }>`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 13px;
`;

const LoadingMessage = styled.div<{ theme: any }>`
  text-align: center;
  color: ${props => props.theme.colors.textSecondary};
  padding: 40px;
  font-size: 14px;
`;

const FailureErrorMessage = styled.div<{ theme: any }>`
  background: rgba(229, 62, 62, 0.1);
  color: #A32D2D;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  border-left: 4px solid #A32D2D;
`;

const EmptyState = styled.div<{ theme: any }>`
  text-align: center;
  color: ${props => props.theme.colors.textSecondary};
  padding: 40px;
  
  .icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  .title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 8px;
    color: ${props => props.theme.colors.text};
  }
  
  .description {
    font-size: 14px;
    max-width: 400px;
    margin: 0 auto;
    line-height: 1.5;
  }
`;

export const PromptDetailView: React.FC = () => {
  const { theme } = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canDelete, blockDestructiveActions } = usePolicyPermissions();
  const { tenant, token } = useAuth();
  const [prompt, setPrompt] = useState<PromptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showDropdown, setShowDropdown] = useState(false);
  const [generatingSteps, setGeneratingSteps] = useState(false);
  const [generatedSteps, setGeneratedSteps] = useState<any>(null);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [savingTestPlan, setSavingTestPlan] = useState(false);
  const [testPlanSaved, setTestPlanSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedStartingUrl, setEditedStartingUrl] = useState('');
  const [editedTestType, setEditedTestType] = useState<'web' | 'app'>('web');
  const [editedExternalId, setEditedExternalId] = useState('');
  
  // Failure analysis state
  const [failureAnalysisData, setFailureAnalysisData] = useState<any>(null);
  const [loadingFailures, setLoadingFailures] = useState(false);
  const [failuresError, setFailuresError] = useState<string | null>(null);
  const [minimalReproSteps, setMinimalReproSteps] = useState<any>(null);
  const [generatingMinimalSteps, setGeneratingMinimalSteps] = useState(false);
  const [minimalStepsError, setMinimalStepsError] = useState<string | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<any>(null);
  
  // AI Debug Steps execution state
  const [runningDebugSteps, setRunningDebugSteps] = useState(false);
  const [debugStepsResults, setDebugStepsResults] = useState<any>(null);
  const [debugStepsError, setDebugStepsError] = useState<string | null>(null);
  const debugPollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Test step editing state
  const [isEditingSteps, setIsEditingSteps] = useState(false);
  const [editedSteps, setEditedSteps] = useState<any[]>([]);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [showAddStepForm, setShowAddStepForm] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [syncElementsPage, setSyncElementsPage] = useState(1);
  const [syncStepsPage, setSyncStepsPage] = useState(1);
  const [activePlatformTab, setActivePlatformTab] = useState<'shared' | 'android' | 'ios'>('shared');
  const [platformVariants, setPlatformVariants] = useState<{ android?: any[]; ios?: any[] }>({});

  // Sync functionality
  const {
    updateStepSelector,
    isUpdating: isSyncUpdating,
    elementRelationships,
    relatedElements,
    relatedElementsCount,
    hasRelatedElements,
    getStepsWithElements
  } = usePromptSelectorSync(id || '');
  
  const { notification, clearNotification } = useSyncNotifications();
  const syncElementsPerPage = 10;
  const syncStepsPerPage = 8;
  const totalRelatedElements = relatedElements.length;
  const totalRelatedElementPages = Math.max(1, Math.ceil(totalRelatedElements / syncElementsPerPage));
  const relatedElementsStart = (syncElementsPage - 1) * syncElementsPerPage;
  const relatedElementsEnd = relatedElementsStart + syncElementsPerPage;
  const paginatedRelatedElements = relatedElements.slice(relatedElementsStart, relatedElementsEnd);

  const rawSyncSteps = getStepsWithElements();
  const stepSelectorGroups = new Map<string, { stepIndex: number; selector: string; parameterKeys: string[]; elementIds: Set<string> }>();
  rawSyncSteps.forEach(step => {
    const key = `${step.stepIndex}-${step.currentValue}`;
    if (!stepSelectorGroups.has(key)) {
      stepSelectorGroups.set(key, {
        stepIndex: step.stepIndex,
        selector: step.currentValue,
        parameterKeys: [],
        elementIds: new Set()
      });
    }
    const group = stepSelectorGroups.get(key)!;
    group.parameterKeys.push(step.parameterKey);
    group.elementIds.add(step.elementId);
  });
  const groupedSyncSteps = Array.from(stepSelectorGroups.values()).sort((a, b) => a.stepIndex - b.stepIndex);
  const totalSyncSteps = groupedSyncSteps.length;
  const totalSyncStepPages = Math.max(1, Math.ceil(totalSyncSteps / syncStepsPerPage));
  const syncStepsStart = (syncStepsPage - 1) * syncStepsPerPage;
  const syncStepsEnd = syncStepsStart + syncStepsPerPage;
  const paginatedSyncSteps = groupedSyncSteps.slice(syncStepsStart, syncStepsEnd);

  useEffect(() => {
    setSyncElementsPage(1);
  }, [totalRelatedElements]);

  useEffect(() => {
    if (syncElementsPage > totalRelatedElementPages) {
      setSyncElementsPage(totalRelatedElementPages);
    }
  }, [syncElementsPage, totalRelatedElementPages]);

  useEffect(() => {
    setSyncStepsPage(1);
  }, [totalSyncSteps]);

  useEffect(() => {
    if (syncStepsPage > totalSyncStepPages) {
      setSyncStepsPage(totalSyncStepPages);
    }
  }, [syncStepsPage, totalSyncStepPages]);

  useEffect(() => {
    if (id && isValidUuid(id)) {
      fetchPrompt(id);
      loadExistingTestPlan(id);
    } else if (id) {
      setError('Invalid prompt ID format');
      setLoading(false);
    }
  }, [id]);

  const isValidUuid = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  const fetchPrompt = async (promptId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const apiData = await promptsApiService.getPrompt(promptId);
      
      // Map API data to local PromptData interface
      const mappedPrompt: PromptData = {
        id: apiData.id,
        title: apiData.title,
        description: apiData.description || '',
        content: apiData.content || '',
        starting_url: apiData.starting_url,
        test_type: apiData.test_type || 'web',
        external_id: apiData.external_id || '',
        category: apiData.category || '',
        tags: apiData.tags || [],
        status: apiData.status,
        priority: apiData.priority?.toString(),
        version: apiData.version,
        usage_count: apiData.usage_count || 0,
        estimated_duration: apiData.estimated_duration?.toString(),
        dateModified: apiData.updated_at || apiData.created_at,
        created_by: apiData.author_id,
        created_at: apiData.created_at,
        updated_at: apiData.updated_at,
      };
      
      setPrompt(mappedPrompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prompt');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingTestPlan = async (promptId: string) => {
    try {
      if (!isValidUuid(promptId)) {
        return;
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiBaseUrl}/api/v1/generated-test-plans/by-prompt/${promptId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const testPlansData = await response.json();
        // Find the first plan with parseable, non-empty steps
        const plans = testPlansData.plans || testPlansData.test_plans || [];

        const parsePlanActions = (raw: any): any[] => {
          if (!raw) return [];
          let parsed = raw;
          // Some payloads are double-encoded JSON strings.
          for (let i = 0; i < 2; i++) {
            if (typeof parsed !== 'string') break;
            try {
              parsed = JSON.parse(parsed);
            } catch {
              return [];
            }
          }

          if (Array.isArray(parsed)) return parsed;
          if (parsed && Array.isArray(parsed.steps)) return parsed.steps;
          if (parsed && Array.isArray(parsed.actions)) return parsed.actions;
          return [];
        };

        let selectedPlan: any = null;
        let selectedActions: any[] = [];
        for (const plan of plans) {
          const actionsFromSteps = parsePlanActions(plan.steps);
          const actionsFromPlanJson = parsePlanActions(plan.plan_json);
          const actions = actionsFromSteps.length > 0 ? actionsFromSteps : actionsFromPlanJson;
          if (actions.length > 0) {
            selectedPlan = plan;
            selectedActions = actions;
            break;
          }
        }

        if (selectedPlan && selectedActions.length > 0) {
          const formattedPlan = {
            actions: selectedActions,
            meta: {
              prompt: selectedPlan.prompt_text,
              version: "1.0.0",
              generatedAt: selectedPlan.created_at,
              totalElements: selectedPlan.total_elements_count,
              enterpriseMode: selectedPlan.enterprise_mode,
              chunksProcessed: selectedPlan.chunks_processed,
              originalStepCount: selectedPlan.original_step_count
            }
          };

          // Set the generated steps to display the saved plan
          setGeneratedSteps({
            plan: formattedPlan,
            metadata: {
              processingTimeMs: selectedPlan.processing_time_ms,
              chunksProcessed: selectedPlan.chunks_processed,
              originalStepCount: selectedPlan.original_step_count
            }
          });
          setTestPlanSaved(true);

          // Load platform variants if present
          if (selectedPlan.platform_variants) {
            let variants = selectedPlan.platform_variants;
            if (typeof variants === 'string') {
              try { variants = JSON.parse(variants); } catch { variants = {}; }
            }
            if (variants && typeof variants === 'object') {
              setPlatformVariants(variants);
            }
          }
        }
      } else if (response.status === 404) {
        // This is normal - not all prompts have saved test plans
      } else {
        console.warn(' Failed to load test plan:', response.statusText);
      }
    } catch (error) {
      console.error(' Error loading existing test plan:', error);
      // Don't show error to user - it's not critical if loading fails
    }
  };

  const handleBackToPrompts = () => {
    navigate('/app/prompts');
  };

  const handleEdit = () => {setEditedDescription(prompt?.description || '');
    setEditedContent(prompt?.content || '');
    setEditedStartingUrl(prompt?.starting_url || '');
    setEditedTestType(prompt?.test_type || 'web');
    setEditedExternalId(prompt?.external_id || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!prompt) return;
    
    try {
      // Save to backend API using authenticated service
      const updateData = {
        title: prompt.title,
        content: editedContent,  // Changed from 'text' to 'content'
        description: editedDescription,  // Changed from 'intent' to 'description'
        starting_url: editedTestType === 'web' ? editedStartingUrl : '',
        test_type: editedTestType,
        external_id: editedExternalId || null,  // Jira/Xray ID
        category: prompt.category
      };
      
      const savedPrompt = await promptsApiService.updatePrompt(prompt.id, updateData);// Update the local state with the saved data from the backend response
      const updatedPrompt: PromptData = {
        ...prompt,
        description: savedPrompt.description || '',
        content: savedPrompt.content || '',
        starting_url: savedPrompt.starting_url || '',
        test_type: savedPrompt.test_type || 'web',
        external_id: savedPrompt.external_id || '',
        dateModified: savedPrompt.updated_at || new Date().toISOString()
      };
      setPrompt(updatedPrompt);
      setIsEditing(false);
      
      // Force a reload to ensure the UI shows the latest data
      if (prompt.id) {
        await fetchPrompt(prompt.id);
      }
      
    } catch (error) {
      console.error(' Failed to save prompt:', error);
      // You could add a toast notification here to show the error to the user
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to save changes: ${errorMessage}`);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedDescription('');
    setEditedContent('');
    setEditedStartingUrl('');
    setEditedTestType('web');
    setEditedExternalId('');
  };

  // Fetch available Appium configs when test_type is 'app'
  useEffect(() => {
    if (prompt?.test_type !== 'app') return;
    const fetchAppiumConfigs = async () => {
      try {
        const tok = localStorage.getItem('auth_token');
        const resp = await fetch(`${config.apiBaseUrl}/api/v1/appium-configs`, {
          headers: tok ? { Authorization: `Bearer ${tok}` } : {},
        });
        if (resp.ok) {
          const data = await resp.json();
          setAppiumConfigs(data || []);
          // Auto-select first config if none selected
          if (!selectedAppiumConfigId && data?.length > 0) {
            const defaultCfg = data.find((c: any) => c.is_default) || data[0];
            setSelectedAppiumConfigId(defaultCfg.id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch Appium configs:', err);
      }
    };
    fetchAppiumConfigs();
  }, [prompt?.test_type]);

  // Fetch available runner agents for the runner picker
  useEffect(() => {
    const fetchRunners = async () => {
      try {
        const apiBase = config.apiBaseUrl;
        const orgParam = tenant?.id ? `?organization_id=${tenant.id}` : '';
        const response = await fetch(`${apiBase}/api/v1/runners/list${orgParam}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setAvailableRunners(data.runners || []);
        }
      } catch {
        // Runners feature not available — that's fine, selector just stays hidden
      }
    };
    fetchRunners();
  }, [tenant?.id, token]);

  const handleRun = async () => {if (!id) {
      alert('No prompt selected');
      return;
    }

    try {
      setIsRunning(true);
      
      // Call the test execution API
      const execOptions: { browser?: string; runner_id?: string; appium_config_id?: string } = {};
      if (selectedRunnerId) execOptions.runner_id = selectedRunnerId;
      if (prompt?.test_type === 'app' && selectedAppiumConfigId) {
        execOptions.appium_config_id = selectedAppiumConfigId;
      }
      const result = await unifiedApiClient.executePrompt(id, Object.keys(execOptions).length ? execOptions : undefined);
      
      if (result.success && result.executions) {
        const successfulExecutions = result.executions.filter((e: any) => e.success);
        const failedExecutions = result.executions.filter((e: any) => !e.success);
        
        if (successfulExecutions.length > 0) {
          // Store all execution IDs for polling
          const executionIds = successfulExecutions.map((e: any) => e.execution_id);
          setRunningExecutionId(executionIds[0]); // Use first for primary polling
          
          const browserList = successfulExecutions.map((e: any) => e.browser).join(', ');
          alert(
            `Test execution started on ${successfulExecutions.length} browser(s)!\n` +
            `Browsers: ${browserList}\n` +
            `Execution IDs: ${executionIds.join(', ')}\n` +
            `Steps to execute: ${result.steps_count}`
          );
          
          // Start polling for all executions
          executionIds.forEach((execId: string) => pollExecutionStatus(execId));
        }
        
        if (failedExecutions.length > 0) {
          const failedBrowsers = failedExecutions.map((e: any) => `${e.browser}: ${e.error}`).join('\n');
          alert(`Some browsers failed to start:\n${failedBrowsers}`);
        }
        
        if (successfulExecutions.length === 0) {
          alert(`Failed to start test execution on any browser`);
        }
      } else {
        alert(`Failed to start test execution: ${result.message || 'Unknown error'}`);
      }
      
    } catch (error: any) {
      console.error('Error starting test execution:', error);
      alert(`Error starting test execution: ${error.message || 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  // State for test execution
  const [isRunning, setIsRunning] = useState(false);
  const [runningExecutionId, setRunningExecutionId] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<any>(null);
  const [selectedBrowser, setSelectedBrowser] = useState<string>('chrome'); // Multi-browser support
  const [selectedRunnerId, setSelectedRunnerId] = useState<string>(''); // Runner agent selection
  const [availableRunners, setAvailableRunners] = useState<Array<{ id: string; runner_name: string; status: string; capabilities: string[] | string }>>([]);
  const [appiumConfigs, setAppiumConfigs] = useState<Array<{ id: string; name: string; config_type: string; device_name?: string; app_package?: string }>>([]);
  const [selectedAppiumConfigId, setSelectedAppiumConfigId] = useState<string>('');

  // Poll execution status
  const pollExecutionStatus = async (executionId: string) => {
    const maxAttempts = 60; // Poll for up to 10 minutes (60 * 10 seconds)
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await unifiedApiClient.getExecutionStatus(executionId);
        setExecutionStatus(status);

        if (status.status === 'completed' || status.status === 'failed' || status.status === 'completed_with_failures') {
          // Execution finished
          setRunningExecutionId(null);
          
          if (status.status === 'completed') {
            alert(`Test execution completed successfully!\nExecution ID: ${executionId}`);
          } else if (status.status === 'completed_with_failures') {
            alert(`Test execution completed with some failures.\nExecution ID: ${executionId}\nCheck the results for details.`);
          } else {
            alert(`Test execution failed.\nExecution ID: ${executionId}\nError: ${status.error_message || 'Unknown error'}`);
          }
          return;
        }

        // Continue polling if still running
        if (status.status === 'running' || status.status === 'pending') {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 10000); // Poll every 10 seconds
          } else {
            alert(`Test execution timeout. Execution ID: ${executionId}\nCheck the execution status manually.`);
            setRunningExecutionId(null);
          }
        }

      } catch (error) {
        console.error('Error polling execution status:', error);
        setRunningExecutionId(null);
      }
    };

    // Start polling after 2 seconds
    setTimeout(poll, 2000);
  };

  // Helper functions for element analysis
  const determineElementCategory = (element: any, promptText: string): string => {
    const text = (element.text_content || '').toLowerCase();
    const attributes = element.attributes || {};
    const tag = element.tag?.toLowerCase();
    
    if (promptText.includes('login') || promptText.includes('sign in') || promptText.includes('authenticate')) {
      if (text.includes('username') || text.includes('email') || attributes.name?.includes('username') || attributes.id?.includes('username')) return 'authentication';
      if (text.includes('password') || attributes.type === 'password') return 'authentication';
      if (text.includes('login') || text.includes('sign in') || text.includes('submit')) return 'authentication';
    }
    
    if (tag === 'input' || tag === 'textarea') return 'form';
    if (tag === 'button' || attributes.role === 'button') return 'action';
    if (tag === 'a') return 'navigation';
    
    return 'general';
  };

  // Helper functions for action type display
  const getActionTypeColor = (actionName: string): string => {
    const action = actionName?.toLowerCase() || '';
    
    if (action.includes('open') || action.includes('navigate')) return '#3b82f6'; // Blue for navigation
    if (action.includes('click')) return '#1D9E75'; // Green for clicks
    if (action.includes('type')) return '#f59e0b'; // Orange for input
    if (action.includes('wait')) return '#6b7280'; // Gray for waits
    if (action.includes('assert') || action.includes('verify')) return '#8b5cf6'; // Purple for assertions
    if (action.includes('screenshot')) return '#06b6d4'; // Cyan for screenshots
    
    return '#6b7280'; // Default gray
  };

  const getActionTypeLabel = (actionName: string): string => {
    const action = actionName?.toLowerCase() || '';
    
    if (action.includes('open') || action.includes('navigate')) return 'Navigate';
    if (action.includes('click')) return 'Click';
    if (action.includes('type')) return 'Type';
    if (action.includes('wait')) return 'Wait';
    if (action.includes('assert') || action.includes('verify')) return 'Assert';
    if (action.includes('screenshot')) return 'Screenshot';
    
    return actionName || 'Action';
  };

  const determineElementPriority = (element: any, promptText: string): string => {
    const text = (element.text_content || '').toLowerCase();
    const attributes = element.attributes || {};
    
    // High priority for exact matches with prompt keywords
    const promptKeywords = promptText.toLowerCase().split(/\s+/);
    const hasKeywordMatch = promptKeywords.some(keyword => 
      text.includes(keyword) || 
      Object.values(attributes).some(attr => String(attr).toLowerCase().includes(keyword))
    );
    
    if (hasKeywordMatch) return 'high';
    if (attributes.id || attributes['data-testid']) return 'medium';
    return 'low';
  };

  const calculateElementConfidence = (element: any, promptText: string): number => {
    let confidence = 0.5;
    const text = (element.text_content || '').toLowerCase();
    const attributes = element.attributes || {};
    
    // Boost confidence for elements with stable identifiers
    if (attributes.id) confidence += 0.2;
    if (attributes['data-testid']) confidence += 0.2;
    if (attributes.name) confidence += 0.1;
    
    // Boost confidence for elements matching prompt context
    const promptKeywords = promptText.toLowerCase().split(/\s+/);
    const matchCount = promptKeywords.filter(keyword => 
      text.includes(keyword) || 
      Object.values(attributes).some(attr => String(attr).toLowerCase().includes(keyword))
    ).length;
    
    confidence += Math.min(matchCount * 0.1, 0.3);
    
    return Math.min(confidence, 1.0);
  };

  // Helper function to analyze page elements and determine page characteristics
  const analyzePageElements = (elements: any[], pageName: string, promptText: string) => {
    const elementTags = elements.map(el => el.tag?.toLowerCase()).filter(Boolean);
    const elementTexts = elements.map(el => el.text_content?.toLowerCase()).filter(Boolean);
    const elementSelectors = elements.map(el => el.css_selector?.toLowerCase()).filter(Boolean);
    
    // Combine all text for analysis
    const allText = [...elementTexts, pageName.toLowerCase(), promptText.toLowerCase()].join(' ');
    const allContent = [...elementTexts, ...elementSelectors].join(' ');
    
    // Detect page type based on elements and content
    let pageType = 'general';
    const primaryActions: string[] = [];
    const keyElements: string[] = [];
    const patterns: string[] = [];
    
    // E-commerce detection
    if (allText.includes('cart') || allText.includes('buy') || allText.includes('price') || 
        allText.includes('product') || allText.includes('checkout') || allText.includes('shop') ||
        allText.includes('inventory')) {
      pageType = 'ecommerce';
      if (elementTags.includes('button') && allText.includes('cart')) primaryActions.push('add-to-cart');
      if (allText.includes('search')) primaryActions.push('product-search');
      if (allText.includes('checkout')) primaryActions.push('checkout');
      
      // Check if this is a protected page that requires login
      if (allText.includes('inventory') || allText.includes('sauce') || allText.includes('demo')) {
        primaryActions.unshift('login-required'); // Add login as first action
        keyElements.unshift('authentication-required');
      }
    }
    
    // Form/Login detection
    if (elementTags.includes('input') && (allText.includes('login') || allText.includes('sign') || 
        allText.includes('email') || allText.includes('password'))) {
      pageType = 'authentication';
      primaryActions.push('login', 'form-submission');
    }
    
    // Search functionality
    if (elementTags.includes('input') && (allText.includes('search') || allContent.includes('search'))) {
      primaryActions.push('search');
      keyElements.push('search-form');
    }
    
    // Navigation detection
    if (elementTags.includes('a') || allContent.includes('nav') || allContent.includes('menu')) {
      primaryActions.push('navigation');
      keyElements.push('navigation-menu');
    }
    
    // Form detection
    if (elementTags.includes('input') || elementTags.includes('select') || elementTags.includes('textarea')) {
      keyElements.push('form-elements');
      if (elementTags.includes('button')) {
        primaryActions.push('form-submission');
      }
    }
    
    // Interactive patterns
    if (elementTags.includes('button')) {
      patterns.push('interactive-buttons');
    }
    if (allContent.includes('modal') || allContent.includes('popup')) {
      patterns.push('modal-dialogs');
    }
    if (allContent.includes('dropdown') || elementTags.includes('select')) {
      patterns.push('dropdown-menus');
    }
    
    // Generate description based on analysis
    let description = `${pageType.charAt(0).toUpperCase() + pageType.slice(1)} page`;
    if (primaryActions.length > 0) {
      description += ` with primary actions: ${primaryActions.join(', ')}`;
    }
    if (keyElements.length > 0) {
      description += `. Key elements: ${keyElements.join(', ')}`;
    }
    description += `. Contains ${elements.length} interactive elements.`;
    
    return {
      type: pageType,
      description,
      primaryActions,
      keyElements,
      patterns
    };
  };

  const handleGenerateSteps = async () => {
    if (!prompt) return;
    
    try {
      setGeneratingSteps(true);
      setStepsError(null);
      
      // Analyze prompt to determine what types of elements we need
      const promptText = `${prompt.title} ${prompt.description} ${prompt.content || ''}`.toLowerCase();
      const elementQueries: Array<{query: string, element_type: string, limit: number}> = [];
      
      // Smart element prioritization - balance relevance with diversity
      // This works for any application/company while respecting AI token limits
      
      // Extract key terms from prompt for relevance scoring
      const promptWords = promptText.toLowerCase().split(/\s+/)
        .filter(word => word.length > 2)
        .filter(word => !['the', 'and', 'but', 'for', 'are', 'with', 'this', 'that'].includes(word));

      const isAppTest = prompt.test_type === 'app';

      // Phase 1: Get available elements for step generation
      let availableElements: any[] = [];
      
      try {// First, get available elements using authenticated request
        const token = localStorage.getItem('auth_token');
        // For app tests, filter elements by platform
        let elementsUrl = `${config.apiBaseUrl}/api/v1/sql/elements?limit=1000`;
        if (isAppTest) {
          elementsUrl += '&platform=android'; // Default to android; can be made dynamic later
        }
        const elementsResponse = await fetch(elementsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (elementsResponse.ok) {
          const elementsData = await elementsResponse.json();
          if (elementsData.data && elementsData.data.length > 0) {
            // Two-phase AI system is now integrated into /v1/plan endpoint
            
            // Group elements by page to understand page context
            const elementsByPage = elementsData.data.reduce((acc: any, element: any) => {
              const pageName = element.page || 'Unknown Page';
              if (!acc[pageName]) {
                acc[pageName] = [];
              }
              acc[pageName].push(element);
              return acc;
            }, {});
            
            // Log available pages for debugging
            console.log('📚 Available pages:', Object.keys(elementsByPage).map(name => 
              `${name} (${elementsByPage[name].length} elements)`
            ).join(', '));// Determine target page based on prompt context
            let targetPageName = null;
            const startingUrl = prompt.starting_url;
            
            if (startingUrl) {
              // Try to find page by matching URL patterns
              for (const pageName of Object.keys(elementsByPage)) {
                const pageElements = elementsByPage[pageName];
                if (pageElements.length > 0) {
                  const pageUrl = pageElements[0].attributes?.url || pageElements[0].attributes?.full_url;
                  if (pageUrl && (pageUrl.includes(startingUrl) || startingUrl.includes(pageUrl))) {
                    targetPageName = pageName;break;
                  }
                }
              }
            }

            // If no URL match, try to find page by prompt content analysis
            if (!targetPageName) {
              const promptKeywords = promptText.split(/\s+/).filter(word => 
                word.length > 3 && !['the', 'and', 'but', 'for', 'are', 'with', 'this', 'that', 'will', 'then'].includes(word)
              );
              
              // Check if prompt explicitly mentions a specific page
              const pageNameMentions = [
                { pattern: /\b(on\s+the\s+)?homepage\b|\bhome\s+page\b|\bstart\s+page\b|\bmain\s+page\b/i, names: ['home', 'homepage', 'main', 'index'] },
                { pattern: /\bproduct\s+page\b|\bitem\s+page\b|\bdetail\s+page\b/i, names: ['product', 'item', 'detail'] },
                { pattern: /\bsearch\s+results?\b|\bresults?\s+page\b/i, names: ['results', 'search results', 'search'] },
                { pattern: /\blogin\s+page\b|\bsign\s+in\b/i, names: ['login', 'signin', 'sign in'] },
                { pattern: /\bcheckout\s+page\b|\bcart\s+page\b/i, names: ['checkout', 'cart', 'shopping cart'] }
              ];
              
              let explicitPageMatch: string | null = null;
              for (const mention of pageNameMentions) {
                if (mention.pattern.test(promptText)) {
                  // Try to find a matching page name
                  for (const expectedName of mention.names) {
                    for (const pageName of Object.keys(elementsByPage)) {
                      if (pageName.toLowerCase().includes(expectedName.toLowerCase())) {
                        explicitPageMatch = pageName;
                        console.log(`🎯 Explicit page match found: "${pageName}" based on prompt mention "${promptText.match(mention.pattern)?.[0]}"`);
                        break;
                      }
                    }
                    if (explicitPageMatch) break;
                  }
                  if (explicitPageMatch) break;
                }
              }
              
              if (explicitPageMatch) {
                targetPageName = explicitPageMatch;
              } else {
                // Fallback to keyword-based scoring
                let bestMatch: { page: string | null, score: number } = { page: null, score: 0 };
                
                for (const [pageName, pageElements] of Object.entries(elementsByPage)) {
                  let pageScore = 0;
                  const elements = pageElements as any[];
                  const pageNameLower = pageName.toLowerCase();
                  
                  // Strong boost for homepage when prompt mentions homepage-related terms
                  if (/homepage|home|main|index|start/i.test(promptText)) {
                    if (pageNameLower.includes('home') || pageNameLower.includes('main') || 
                        pageNameLower.includes('index') || pageNameLower === 'american airlines') {
                      pageScore += 100; // Very high priority for homepage
                      console.log(`🏠 Homepage boost applied to: ${pageName}`);
                    }
                  }
                  
                  // Score based on element text content matching prompt keywords
                  elements.forEach(element => {
                    const elementText = (element.text_content || '').toLowerCase();
                    promptKeywords.forEach(keyword => {
                      if (elementText.includes(keyword.toLowerCase())) {
                        pageScore += 10;
                      }
                    });
                  });
                  
                  // Reduce score boost from element count (was causing wrong pages to be selected)
                  // Only add a small bonus to avoid favoring pages just because they have more elements
                  pageScore += elements.length * 0.1; // Reduced from 0.5
                  
                  if (pageScore > bestMatch.score) {
                    bestMatch = { page: pageName, score: pageScore };
                  }
                }
                
                if (bestMatch.page) {
                  targetPageName = bestMatch.page;
                  console.log(`📄 Best page match: ${targetPageName} with score: ${bestMatch.score}`);
                }
              }
            }

            // Use the most relevant page, or intelligent fallback
            if (!targetPageName && Object.keys(elementsByPage).length > 0) {
              // Prioritize homepage/main page over just "most elements"
              const homepagePatterns = /^(home|homepage|main|index|start|american airlines)$/i;
              const homePage = Object.keys(elementsByPage).find(name => homepagePatterns.test(name.trim()));
              
              if (homePage) {
                targetPageName = homePage;
                console.log(`🏠 Defaulting to homepage: ${homePage}`);
              } else {
                // If no homepage found, use the page with most elements
                targetPageName = Object.keys(elementsByPage).reduce((a, b) => 
                  elementsByPage[a].length > elementsByPage[b].length ? a : b
                );
                console.log(`📊 Defaulting to page with most elements: ${targetPageName}`);
              }
            }

            // Filter elements to target page and transform for AI service
            let targetElements: any[];
            
            console.log(`🎯 Selected target page: ${targetPageName || 'ALL PAGES'}`);
            
            // If we have a clear page match, use those elements
            // But if it results in too few elements, expand to include related pages
            if (targetPageName && elementsByPage[targetPageName]) {
              targetElements = elementsByPage[targetPageName];
              console.log(`📄 Using ${targetElements.length} elements from page: ${targetPageName}`);
              
              // If the target page has too few elements (less than 5), include other pages too
              if (targetElements.length < 5 && Object.keys(elementsByPage).length > 1) {// Add elements from other pages, prioritizing pages with similar content
                for (const [pageName, pageElements] of Object.entries(elementsByPage)) {
                  if (pageName !== targetPageName) {
                    targetElements = [...targetElements, ...(pageElements as any[])];
                  }
                }}
            } else {
              // No clear target page, use all elements
              targetElements = elementsData.data;}
            
            availableElements = targetElements.map((element: any) => ({
              elementId: element.id,
              name: element.logical_key || element.tag || 'Element',
              description: `${element.tag} element${element.text_content ? ` with text: "${element.text_content}"` : ''}`,
              tag: element.tag,
              text: element.text_content,
              css_selector: element.css_selector,
              xpath: element.xpath,
              selector: element.css_selector,
              locator: {
                css: element.css_selector,
                xpath: element.xpath,
                id: element.attributes?.id
              },
              attributes: typeof element.attributes === 'string' ? JSON.parse(element.attributes) : element.attributes,
              selectors: typeof element.selectors === 'string' ? JSON.parse(element.selectors) : element.selectors,
              page: element.page,
              category: determineElementCategory(element, promptText),
              priority: determineElementPriority(element, promptText),
              confidence: calculateElementConfidence(element, promptText)
            }));
            
            // Create selector-to-name mapping for display
            const selectorToNameMap = new Map<string, string>();
            targetElements.forEach((element: any) => {
              if (element.css_selector && element.logical_key) {
                selectorToNameMap.set(element.css_selector.toLowerCase().trim(), element.logical_key);
              }
            });
            // Store in component state for use in step rendering
            (window as any).__elementNameMap = selectorToNameMap;

            // Page context analysis is now handled by the backend's two-phase AI system// Log sample elements for debugging
            if (availableElements.length > 0) {}
            
            // Intelligent element selection with relevance scoring
            // Score each element based on relevance to prompt while maintaining diversity
            const scoredElements = availableElements.map((element: any) => {
              let score = 0;
              const elementText = (element.name + ' ' + (element.text || '') + ' ' + Object.values(element.attributes || {}).join(' ')).toLowerCase();
              
              // Score based on prompt word matches
              promptWords.forEach(word => {
                if (elementText.includes(word)) {
                  score += 10; // High relevance score
                }
              });
              
              // Boost interactive elements (more likely to be useful)
              if (['input', 'button', 'a', 'select'].includes(element.tag)) {
                score += 5;
              }
              
              // Boost elements with meaningful IDs/classes
              if (element.css_selector && (element.css_selector.includes('#') || element.css_selector.includes('.'))) {
                score += 3;
              }
              
              // Boost elements with text content
              if (element.text && element.text.trim().length > 0) {
                score += 2;
              }
              
              return { ...element, relevanceScore: score };
            });
            
            // Sort by relevance score and take top elements
            // For verification tests, include more elements for comprehensive coverage
            const sortedElements = scoredElements.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
            
            // Increase element limit for verification/inventory tests
            const isVerificationTest = promptText.toLowerCase().includes('verify') || 
                                     promptText.toLowerCase().includes('inventory') ||
                                     promptText.toLowerCase().includes('default') ||
                                     promptText.toLowerCase().includes('page');
            
            const elementLimit = isVerificationTest ? 150 : 75;
            availableElements = sortedElements.slice(0, elementLimit);}
        }
        
      } catch (elementsError) {
        console.warn('Error fetching discovered elements:', elementsError);
        console.warn('Proceeding with generic selectors');
      }
      
      // Extract the actual page URL from recorded elements, or fallback to prompt starting_url
      const pageUrl = prompt.starting_url || 
                      (availableElements.length > 0 && availableElements[0].attributes?.url) ||
                      (availableElements.length > 0 && availableElements[0].attributes?.full_url) ||
                      'https://example.com';

      // Now generate steps using the AI service
      // Use content as primary prompt if it exists and is longer, otherwise use title + description
      const primaryPrompt = (prompt.content && prompt.content.length > 20) 
        ? prompt.content 
        : `${prompt.title}: ${prompt.description}`;
      
      // Transform to new enterprise PromptEnvelope format
      const promptEnvelope: Record<string, any> = {
        prompt: primaryPrompt,
        prompt_id: prompt.id,  // Include prompt ID so AI can load existing bindings
        tenant_id: tenant?.id || "frontend-user", // Use actual tenant's organization from auth context
        page_url: isAppTest ? undefined : pageUrl, // No URL for native app tests
        max_steps: 50,
        include_screenshots: false,
        include_assertions: true,
        test_type: prompt.test_type || 'web',
        ...(isAppTest && { platform: 'android' }), // Include platform for app tests
        // page_context is now handled automatically by the backend's two-phase AI system
        page_slice: availableElements.length > 0 ? {
          slice_strategy: "heuristicFilter",
          k: Math.min(availableElements.length, 100), // Limit to max 100 elements
          total_elements: availableElements.length,
          elements: availableElements.slice(0, 100).map((el: any) => ({
            element_id: el.elementId || `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tag: el.tag || 'div',
            selector_css: el.css_selector || '',
            selector_xpath: el.xpath || '',
            text: el.text || '',  // Use 'text' instead of 'text_content' to match schema
            is_visible: true,
            is_interactive: true,
            attributes: { 
              ...el.attributes || {},
              page: el.page  // Preserve page information in attributes
            },
            confidence_score: el.confidence || 0.8
          }))
        } : undefined
      };

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiBaseUrl}/api/v1/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(promptEnvelope),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate steps: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform enterprise PlanResponse back to legacy format
      const legacyResponse = {
        success: true,
        plan: {
          actions: data.steps?.map((step: any) => {
            if (isAppTest) {
              // Native app actions: preserve native selectors and action types
              return {
                name: step.action || step.name || 'unknown',
                params: {
                  selector: step.target || step.args?.selector || '',
                  text: step.args?.text || '',
                  timeout: step.args?.timeout || 5000,
                  description: step.description || '',
                  confidence: step.confidence || 0.8,
                  direction: step.args?.direction || '',
                  duration: step.args?.duration || '',
                  variable: step.args?.variable || '',
                  ...step.args
                }
              };
            }
            return {
              name: step.action || step.name || 'unknown',
              params: {
                // For open_url actions, put target in url field, not selector
                selector: step.action === 'open_url' ? '' : (step.target || step.args?.selector || ''),
                url: step.action === 'open_url' ? step.target : (step.args?.url || ''),
                text: step.args?.text || '',
                timeout: step.args?.timeout || 5000,
                description: step.description || '',
                confidence: step.confidence || 0.8,
              ...step.args
            }
          };
          }) || [],
          meta: {
            pageUrl: pageUrl,
            tenant: data.tenant_id,
            cost: data.cost_summary?.cost_usd || 0,
            model: data.cost_summary?.model || 'enterprise',
            processingTime: data.cost_summary?.processing_time_ms || 0
          }
        },
        metadata: {
          clarifications: data.clarifications || [],
          confidence: data.steps?.length > 0 ? 0.9 : 0.5,
          elementsUsed: data.steps?.reduce((acc: number, step: any) => 
            acc + (step.target_element ? 1 : 0), 0) || 0
        }
      };
      
      setGeneratedSteps(legacyResponse);
    } catch (err) {
      console.error('Error generating steps:', err);
      setStepsError(err instanceof Error ? err.message : 'Failed to generate steps');
    } finally {
      setGeneratingSteps(false);
    }
  };

  const handleSaveTestPlan = async () => {
    if (!prompt || !generatedSteps) return;
    
    try {
      setSavingTestPlan(true);
      setTestPlanSaved(false);
      
      // Extract the page URL that was used for generation
      const pageUrl = prompt.starting_url || 
                      (generatedSteps.plan?.meta?.pageUrl) ||
                      'https://example.com';
      
      const testPlanData = {
        prompt_id: prompt.id,
        prompt_text: `${prompt.title}: ${prompt.description}${prompt.content ? '\n\nDetails: ' + prompt.content : ''}`,
        starting_url: pageUrl,
        total_elements_count: generatedSteps.plan?.meta?.totalElements || 0,
        generated_steps: generatedSteps.plan?.actions || [],
        step_count: generatedSteps.plan?.actions?.length || 0,
        generation_method: generatedSteps.metadata?.method || 'ai-powered',
        ai_model: generatedSteps.metadata?.model,
        max_tokens_used: generatedSteps.metadata?.maxTokens,
        enterprise_mode: generatedSteps.plan?.meta?.enterpriseMode || false,
        chunks_processed: generatedSteps.plan?.meta?.chunksProcessed || 1,
        original_step_count: generatedSteps.plan?.meta?.originalStepCount,
        processing_time_ms: generatedSteps.metadata?.processingTimeMs,
        generation_success: true,
        created_by: 'user',
        // Include platform variants if any exist
        ...(Object.keys(platformVariants).length > 0 && {
          platform_variants: platformVariants,
        }),
      };const token = localStorage.getItem('auth_token');
  const response = await fetch(`${config.apiBaseUrl}/api/v1/generated-test-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(testPlanData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save test plan: ${response.statusText}`);
      }

      const result = await response.json();setTestPlanSaved(true);
      
      // Show success message for a few seconds
      setTimeout(() => setTestPlanSaved(false), 3000);
      
    } catch (error) {
      console.error(' Failed to save test plan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to save test plan: ${errorMessage}`);
    } finally {
      setSavingTestPlan(false);
    }
  };

  // Step editing functions
  const startEditingSteps = () => {
    setIsEditingSteps(true);
    setEditedSteps([...(generatedSteps?.plan?.actions || [])]);
  };

  const cancelEditingSteps = () => {
    setIsEditingSteps(false);
    setEditedSteps([]);
    setEditingStepIndex(null);
    setShowAddStepForm(false);
  };

  const saveEditedSteps = async () => {
    try {
      setSavingTestPlan(true);
      
      // Update the generatedSteps with edited steps
      const updatedGeneratedSteps = {
        ...generatedSteps,
        plan: {
          ...generatedSteps.plan,
          actions: editedSteps,
          meta: {
            ...generatedSteps.plan.meta,
            editedAt: new Date().toISOString()
          }
        }
      };
      
      // Save to database using the same saveTestPlan logic
      const testPlanData = {
        prompt_id: id!,
        prompt_text: prompt?.content || '',
        starting_url: prompt?.starting_url || 
                      (generatedSteps.plan?.meta?.pageUrl) ||
                      editedStartingUrl || 
                      '',
        total_elements_count: generatedSteps.plan?.meta?.totalElements || 0,
        generated_steps: editedSteps,
        step_count: editedSteps.length,
        generation_method: generatedSteps.plan?.meta?.method || 'manual-edit',
        ai_model: generatedSteps.metadata?.model,
        max_tokens_used: generatedSteps.metadata?.maxTokens,
        enterprise_mode: generatedSteps.plan?.meta?.enterpriseMode || false,
        chunks_processed: generatedSteps.plan?.meta?.chunksProcessed || 1,
        original_step_count: generatedSteps.plan?.meta?.originalStepCount,
        processing_time_ms: generatedSteps.metadata?.processingTimeMs,
        generation_success: true,
        created_by: 'user'
      };
      
      const token = localStorage.getItem('auth_token');
  const response = await fetch(`${config.apiBaseUrl}/api/v1/generated-test-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(testPlanData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save edited test plan: ${response.statusText}`);
      }

      // Update the displayed steps
      setGeneratedSteps(updatedGeneratedSteps);
      setIsEditingSteps(false);
      setEditedSteps([]);
      setTestPlanSaved(true);setTimeout(() => setTestPlanSaved(false), 3000);
      
    } catch (error) {
      console.error(' Failed to save edited test plan:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to save edited test plan: ${errorMessage}`);
    } finally {
      setSavingTestPlan(false);
    }
  };

  const addStep = (newStep: any) => {
    setEditedSteps([...editedSteps, newStep]);
    setShowAddStepForm(false);
  };

  const updateStep = (index: number, updatedStep: any) => {
    const newSteps = [...editedSteps];
    newSteps[index] = updatedStep;
    setEditedSteps(newSteps);
    setEditingStepIndex(null);
  };

  const deleteStep = (index: number) => {
    // Check policy permissions before allowing delete
    if (!canDelete) {
      alert(`Delete action is blocked by ${blockDestructiveActions ? 'security policy' : 'permissions'}. Only administrators can delete when safety restrictions are enabled.`);
      return;
    }
    
    if (confirm('Are you sure you want to delete this step?')) {
      const newSteps = editedSteps.filter((_, i) => i !== index);
      setEditedSteps(newSteps);
    }
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= editedSteps.length) return;
    
    const newSteps = [...editedSteps];
    const [movedStep] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, movedStep);
    setEditedSteps(newSteps);
  };

  const handleDuplicate = async () => {
    if (!prompt) return;
    try {
      const duplicated = await promptsApiService.createPrompt({
        title: `${prompt.title} (Copy)`,
        content: prompt.content || '',
        description: prompt.description,
        category: prompt.category,
        tags: prompt.tags,
        starting_url: prompt.starting_url,
      });
      navigate(`/app/prompts/${duplicated.id}`);
    } catch (err) {
      alert('Failed to duplicate prompt');
    }
  };

  const handleArchive = async () => {
    if (!prompt) return;
    if (!window.confirm('Archive this prompt? It will no longer appear in your active prompts list.')) return;
    try {
      await promptsApiService.updatePrompt(prompt.id, { status: 'archived' } as any);
      navigate('/app/prompts');
    } catch (err) {
      alert('Failed to archive prompt');
    }
  };

  // Failure analysis functions
  const loadFailureAnalysis = async () => {
    if (!id) return;
    
    try {
      setLoadingFailures(true);
      setFailuresError(null);
      setMinimalReproSteps(null);
      setMinimalStepsError(null);
      setSelectedExecution(null);

      const response = await unifiedApiClient.getRecentFailedExecutions(id, 10);
      const executions = Array.isArray(response) ? response : response?.executions || [];

      if (executions && executions.length > 0) {
        const normalizeExecution = (execution: any) => {
          const executionId = execution?.execution_id || execution?.id || '';

          const failedStepsFromList = Array.isArray(execution?.failed_steps)
            ? execution.failed_steps
            : [];

          const failedStepsFromSteps = Array.isArray(execution?.steps)
            ? execution.steps
                .filter((step: any) => step?.status === 'failed')
                .map((step: any) => ({
                  action: step?.action || 'unknown',
                  element_type: step?.element_type || undefined,
                  selector: step?.selector || step?.target || '',
                  error_message:
                    typeof step?.error_message === 'string'
                      ? step.error_message
                      : (step?.error_message?.message || step?.error_details?.message || 'Step failed'),
                  step_index: step?.step_index ?? step?.step_order ?? 0,
                }))
            : [];

          const failedSteps = (failedStepsFromList.length > 0 ? failedStepsFromList : failedStepsFromSteps).map((step: any) => ({
            ...step,
            error_message:
              typeof step?.error_message === 'string'
                ? step.error_message
                : (step?.error_message?.message || step?.error_details?.message || 'Step failed'),
          }));

          return {
            ...execution,
            execution_id: executionId,
            failed_steps: failedSteps,
            failed_steps_count:
              typeof execution?.failed_steps === 'number'
                ? execution.failed_steps
                : failedSteps.length,
          };
        };

        const normalizedExecutions = executions.map(normalizeExecution);

        // Prefer the most recent execution with concrete failed step details.
        const mostRecentExecution =
          normalizedExecutions.find((execution: any) => execution.failed_steps.length > 0) ||
          normalizedExecutions.find((execution: any) => execution.failed_steps_count > 0) ||
          normalizedExecutions[0];

        setFailureAnalysisData({ executions: [mostRecentExecution] });

        if (mostRecentExecution.failed_steps.length > 0) {
          // Small delay to let the UI update first
          setTimeout(() => {
            generateMinimalReproSteps(mostRecentExecution);
          }, 500);
        } else {
          setMinimalStepsError('No failed step details were returned for this run, so AI analysis could not be generated.');
        }
      } else {
        setFailureAnalysisData({ executions: [] });
      }
    } catch (error) {
      console.error('❌ Failed to load failure analysis:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setFailuresError(`Failed to load failure analysis data: ${errorMessage}`);
    } finally {
      setLoadingFailures(false);
    }
  };

  const generateMinimalReproSteps = async (execution: any) => {
    if (!execution || !Array.isArray(execution.failed_steps) || execution.failed_steps.length === 0) {
      return;
    }
    
    try {
      setGeneratingMinimalSteps(true);
      setMinimalStepsError(null);
      setSelectedExecution(execution);
      
      // Call the real API
      const response = await unifiedApiClient.generateMinimalReproSteps(
        execution.execution_id || execution.id,
        execution.failed_steps
      );
      
      setMinimalReproSteps(response);
    } catch (error) {
      console.error('❌ Failed to generate minimal reproduction steps:', error);
      setMinimalStepsError(`Failed to generate minimal reproduction steps: ${(error as Error)?.message || String(error)}`);
    } finally {
      setGeneratingMinimalSteps(false);
    }
  };

  const analyzeFailurePatterns = async () => {
    if (!id || !failureAnalysisData?.executions?.length) return;
    
    try {
      setLoadingFailures(true);
      
      const response = await unifiedApiClient.analyzeFailurePatterns(id, 30);
      
      setFailureAnalysisData((prev: any) => ({
        ...prev,
        patterns: response
      }));
    } catch (error) {
      console.error('Failed to analyze failure patterns:', error);
      setFailuresError('Failed to analyze failure patterns');
    } finally {
      setLoadingFailures(false);
    }
  };

  const runAIDebugSteps = async () => {
    if (!minimalReproSteps?.minimalSteps?.length) {
      return;
    }

    try {
      setRunningDebugSteps(true);
      setDebugStepsError(null);
      setDebugStepsResults(null);
      
      // Convert AI steps to the format expected by the execution API
      const steps = minimalReproSteps.minimalSteps.map((step: any, index: number) => ({
        action: step.action,
        target: step.target || step.selector,
        value: step.text_value || step.value || '', // Use text_value from AI service for typing actions
        text_value: step.text_value || '', // Also include text_value explicitly
        step_order: step.step_order,
        originalStepId: step.originalStepId,
        description: step.description || step.reasoning || `AI Debug Step ${index + 1}: ${step.action}`
      }));// Create the execution request
      const executionRequest = {
        prompt_id: id,
        test_name: `AI Debug Run - ${new Date().toISOString()}`,
        steps: steps
      };// Call the debug execution API (goes through Java runner)
      const response = await unifiedApiClient.executeDebugSteps(executionRequest);// Set initial results showing execution started
      setDebugStepsResults({
        execution_id: response.execution_id,
        status: 'running',
        steps_count: response.steps_count,
        message: response.message
      });

      // Poll for execution status until terminal
      if (debugPollRef.current) clearInterval(debugPollRef.current);
      const execId = response.execution_id;
      debugPollRef.current = setInterval(async () => {
        try {
          const statusRes = await unifiedApiClient.getExecutionStatus(execId);
          const terminalStatuses = ['completed', 'passed', 'failed', 'error', 'cancelled'];
          const currentStatus = (statusRes.status || '').toLowerCase();
          setDebugStepsResults((prev: any) => ({
            ...prev,
            ...statusRes,
            status: statusRes.status || prev?.status,
          }));
          if (terminalStatuses.includes(currentStatus)) {
            if (debugPollRef.current) clearInterval(debugPollRef.current);
            debugPollRef.current = null;
          }
        } catch {
          // Silently retry on transient errors
        }
      }, 3000);

    } catch (error: any) {
      console.error('❌ Failed to run AI debug steps:', error);
      setDebugStepsError(`Failed to run debug steps: ${(error as Error)?.message || String(error)}`);
    } finally {
      setRunningDebugSteps(false);
    }
  };

  // Load failure analysis when tab is activated
  React.useEffect(() => {
    if (activeTab === 'failure-analysis' && !failureAnalysisData && id) {
      loadFailureAnalysis();
    }
  }, [activeTab, id]);

  // Cleanup debug steps polling on unmount
  React.useEffect(() => {
    return () => {
      if (debugPollRef.current) clearInterval(debugPollRef.current);
    };
  }, []);

  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingSpinner />
          <LoadingText>Loading prompt...</LoadingText>
        </LoadingContainer>
      </Container>
    );
  }

  if (error || !prompt) {
    return (
      <Container>
        <ErrorMessage>
          {error || 'Prompt not found'}
          <SecondaryButton onClick={handleBackToPrompts}>
            <ArrowLeft size={16} />
            Back to Prompts
          </SecondaryButton>
        </ErrorMessage>
      </Container>
    );
  }

  return (
    <Container theme={theme}>
      <Layout>
        {/* Main Content */}
        <MainContent>
          {/* Header */}
          <Header>
            <Breadcrumb>
              <BreadcrumbLink onClick={handleBackToPrompts}>
                <ArrowLeft size={16} />
                Prompts
              </BreadcrumbLink>
              <span>{'>'}</span>
              <span>{prompt.title}</span>
            </Breadcrumb>

            <TitleSection>
              <TitleLeft>
                <Category>
                  <FileText size={14} />
                  {prompt.category || 'E-commerce'}
                </Category>
                <Title>{prompt.title}</Title>
              </TitleLeft>

              <ActionsBar>
                {prompt.test_type === 'app' ? (
                  <select
                    value={selectedAppiumConfigId}
                    onChange={e => setSelectedAppiumConfigId(e.target.value)}
                    disabled={isRunning}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #dee2e6',
                      background: '#f8f9fa',
                      color: '#495057',
                      fontSize: '13px',
                      cursor: 'pointer',
                      minWidth: '180px',
                    }}
                  >
                    <option value="">Select Appium Config...</option>
                    {appiumConfigs.map(c => (
                      <option key={c.id} value={c.id}>
                        📱 {c.name} ({c.config_type})
                      </option>
                    ))}
                  </select>
                ) : (
                  <BrowserSelector
                    value={selectedBrowser}
                    onChange={setSelectedBrowser}
                    disabled={isRunning}
                    showIcon={false}
                    variant="header"
                  />
                )}
                {availableRunners.length > 0 && (
                  <select
                    value={selectedRunnerId}
                    onChange={e => setSelectedRunnerId(e.target.value)}
                    disabled={isRunning}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #dee2e6',
                      background: '#f8f9fa',
                      color: '#495057',
                      fontSize: '13px',
                      cursor: 'pointer',
                      minWidth: '140px',
                    }}
                  >
                    <option value="">Auto (any runner)</option>
                    {availableRunners.map(r => (
                      <option key={r.id} value={r.id} disabled={r.status === 'offline'}>
                        {r.runner_name} {r.status === 'offline' ? '(offline)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                <PrimaryButton
                  variant={isRunning ? 'running' : 'primary'}
                  onClick={handleRun}
                  disabled={isRunning}
                >
                  <Play size={16} />
                  {isRunning ? 'Running...' : runningExecutionId ? 'Executing...' : 'Run'}
                </PrimaryButton>
                <SecondaryButton
                  onClick={handleGenerateSteps}
                  disabled={generatingSteps}
                >
                  <Zap size={16} />
                  {generatingSteps ? 'Generating...' : 'Generate Steps'}
                </SecondaryButton>
                {!isEditing ? (
                  <SecondaryButton onClick={handleEdit}>
                    <Edit3 size={16} />
                    Edit
                  </SecondaryButton>
                ) : (
                  <EditingIndicator>
                    <Edit3 size={14} />
                    Editing...
                  </EditingIndicator>
                )}
                <DropdownContainer>
                  <DropdownButton
                    onClick={() => setShowDropdown(!showDropdown)}
                  >
                    <MoreVertical size={16} />
                  </DropdownButton>
                  {showDropdown && (
                    <Dropdown theme={theme}>
                      <DropdownItem theme={theme} onClick={() => {
                        handleDuplicate();
                        setShowDropdown(false);
                      }}>
                        <Copy size={14} />
                        Duplicate
                      </DropdownItem>
                      <DropdownItem theme={theme} onClick={() => {
                        handleArchive();
                        setShowDropdown(false);
                      }}>
                        <Archive size={14} />
                        Archive
                      </DropdownItem>
                      <DropdownItem theme={theme}>
                        <History size={14} />
                        Versions
                      </DropdownItem>
                      <DropdownItem theme={theme}>
                        <Settings size={14} />
                        Bindings
                      </DropdownItem>
                      <DropdownItem theme={theme}>
                        <Settings size={14} />
                        Permissions
                      </DropdownItem>
                    </Dropdown>
                  )}
                </DropdownContainer>
              </ActionsBar>
            </TitleSection>
          </Header>

          {/* Tabs */}
          <TabsContainer>
            <Tab
              $active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </Tab>
            <Tab
              $active={activeTab === 'versions'}
              onClick={() => setActiveTab('versions')}
            >
              Versions
            </Tab>
            <Tab
              $active={activeTab === 'steps'}
              onClick={() => setActiveTab('steps')}
            >
              Generated Steps
              {generatedSteps && (
                <StepBadge>
                  {generatedSteps.plan?.actions?.length || 0}
                </StepBadge>
              )}
            </Tab>
            <Tab
              $active={activeTab === 'bindings'}
              onClick={() => setActiveTab('bindings')}
            >
              Variables
            </Tab>
            <Tab
              $active={activeTab === 'execution-history'}
              onClick={() => setActiveTab('execution-history')}
            >
              <Activity size={14} style={{ marginRight: '4px' }} />
              Execution History
            </Tab>
            <Tab
              $active={activeTab === 'failure-analysis'}
              onClick={() => setActiveTab('failure-analysis')}
            >
              🚨 Failure Analysis
            </Tab>
          </TabsContainer>

          {/* Content */}
          <Content theme={theme}>
            {activeTab === 'overview' && (
              <>
                <div style={detailStyles.descriptionSection}>
                  <h2 style={{...detailStyles.sectionTitle, color: theme.colors.text}}>Description</h2>
                  {isEditing ? (
                    <textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '100px',
                        padding: '12px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.text
                      }}
                      placeholder="Enter prompt description..."
                    />
                  ) : (
                    <p style={{...detailStyles.description, color: theme.colors.text}}>{prompt.description}</p>
                  )}
                </div>

                {(prompt.content || isEditing) && (
                  <div style={detailStyles.contentSection}>
                    <h2 style={{...detailStyles.sectionTitle, color: theme.colors.text}}>Content</h2>
                    {isEditing ? (
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '200px',
                          padding: '12px',
                          border: `1px solid ${theme.colors.border}`,
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          resize: 'vertical',
                          backgroundColor: theme.colors.surface,
                          color: theme.colors.text
                        }}
                        placeholder="Enter prompt content..."
                      />
                    ) : (
                      <div style={{
                        ...detailStyles.contentBox,
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.text,
                        borderColor: theme.colors.border
                      }}>
                        {prompt.content}
                      </div>
                    )}
                  </div>
                )}

                {/* Test Type Section */}
                <div style={detailStyles.descriptionSection}>
                  <h2 style={{...detailStyles.sectionTitle, color: theme.colors.text}}>Test Type</h2>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setEditedTestType('web')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: `2px solid ${editedTestType === 'web' ? '#3b82f6' : theme.colors.border}`,
                          borderRadius: '6px',
                          background: editedTestType === 'web' ? '#eff6ff' : 'transparent',
                          cursor: 'pointer',
                          fontWeight: editedTestType === 'web' ? 600 : 400,
                          fontSize: '14px',
                          color: theme.colors.text
                        }}
                      >
                        🌐 Web Testing
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditedTestType('app')}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: `2px solid ${editedTestType === 'app' ? '#3b82f6' : theme.colors.border}`,
                          borderRadius: '6px',
                          background: editedTestType === 'app' ? '#eff6ff' : 'transparent',
                          cursor: 'pointer',
                          fontWeight: editedTestType === 'app' ? 600 : 400,
                          fontSize: '14px',
                          color: theme.colors.text
                        }}
                      >
                        📱 App / Desktop
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      ...detailStyles.contentBox,
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text,
                      borderColor: theme.colors.border
                    }}>
                      {(prompt.test_type || 'web') === 'web' ? '🌐 Web Testing' : '📱 App / Desktop Testing'}
                    </div>
                  )}
                </div>

                {/* Starting URL Section - only for web test type */}
                {((isEditing ? editedTestType : (prompt.test_type || 'web')) === 'web') && (
                <div style={detailStyles.descriptionSection}>
                  <h2 style={{...detailStyles.sectionTitle, color: theme.colors.text}}>Starting URL</h2>
                  {isEditing ? (
                    <input
                      type="url"
                      value={editedStartingUrl}
                      onChange={(e) => setEditedStartingUrl(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.text
                      }}
                      placeholder="https://example.com - Enter the URL where the test should start"
                    />
                  ) : (
                    <div style={{
                      ...detailStyles.contentBox,
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text,
                      borderColor: theme.colors.border
                    }}>
                      {prompt.starting_url || 'No starting URL specified'}
                    </div>
                  )}
                </div>
                )}

                {/* External ID (Jira/Xray) Section */}
                <div style={detailStyles.descriptionSection}>
                  <h2 style={{...detailStyles.sectionTitle, color: theme.colors.text}}>External ID (Jira/Xray)</h2>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedExternalId}
                      onChange={(e) => setEditedExternalId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        backgroundColor: theme.colors.surface,
                        color: theme.colors.text
                      }}
                      placeholder="e.g., PROJ-1234, XRAY-TEST-001"
                    />
                  ) : (
                    <div style={{
                      ...detailStyles.contentBox,
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text,
                      borderColor: theme.colors.border
                    }}>
                      {prompt.external_id ? (
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{prompt.external_id}</span>
                      ) : (
                        <span style={{ color: theme.colors.textSecondary, fontStyle: 'italic' }}>No external ID - using internal ID: {prompt.id.substring(0, 8).toUpperCase()}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Element Synchronization Status */}
                {!isEditing && (
                  <div style={detailStyles.descriptionSection}>
                    <h2 style={{...detailStyles.sectionTitle, color: theme.colors.text}}>
                      Element Synchronization
                      <SyncIndicator 
                        status={hasRelatedElements ? 'linked' : 'unlinked'}
                        count={relatedElementsCount}
                        animated={isSyncUpdating}
                      />
                    </h2>
                    <div style={{
                      ...detailStyles.contentBox,
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text,
                      borderColor: theme.colors.border
                    }}>
                      {hasRelatedElements ? (
                        <div>
                          <SyncDescriptionText theme={theme}>
                            This prompt references {relatedElementsCount} element{relatedElementsCount !== 1 ? 's' : ''}. 
                            Changes to element selectors will automatically sync to this prompt.
                          </SyncDescriptionText>
                          <div>
                            <strong>Linked Elements:</strong>
                            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                              {paginatedRelatedElements.map(elementId => (
                                <li key={elementId} style={{ marginBottom: '4px' }}>
                                  <SyncElementCode theme={theme}>
                                    {elementId}
                                  </SyncElementCode>
                                </li>
                              ))}
                            </ul>
                            {totalRelatedElements > syncElementsPerPage && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                <span style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
                                  Showing {relatedElementsStart + 1}-{Math.min(relatedElementsEnd, totalRelatedElements)} of {totalRelatedElements} elements
                                </span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    onClick={() => setSyncElementsPage(prev => Math.max(1, prev - 1))}
                                    disabled={syncElementsPage === 1}
                                    style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${theme.colors.border}` }}
                                  >
                                    Previous
                                  </button>
                                  <button
                                    disabled
                                    style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${theme.colors.border}` }}
                                  >
                                    Page {syncElementsPage}/{totalRelatedElementPages}
                                  </button>
                                  <button
                                    onClick={() => setSyncElementsPage(prev => Math.min(totalRelatedElementPages, prev + 1))}
                                    disabled={syncElementsPage === totalRelatedElementPages}
                                    style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${theme.colors.border}` }}
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          {groupedSyncSteps.length > 0 && (
                            <div style={{ marginTop: '12px', fontSize: '13px' }}>
                              <strong>Steps with synchronized elements:</strong>
                              <div style={{ margin: '8px 0' }}>
                                {paginatedSyncSteps.map((group, index) => (
                                    <div key={`${group.stepIndex}-${group.selector}`} style={{ 
                                      marginBottom: '12px', 
                                      padding: '12px', 
                                      background: 'rgba(102, 126, 234, 0.05)', 
                                      borderRadius: '8px',
                                      border: '1px solid rgba(102, 126, 234, 0.1)' 
                                    }}>
                                      <div style={{ marginBottom: '6px' }}>
                                        <strong>Step {group.stepIndex + 1} - Selector:</strong>
                                        <SyncCodeElement theme={theme}>
                                          {group.selector}
                                        </SyncCodeElement>
                                      </div>
                                      <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
                                        Used in parameters: {group.parameterKeys.join(', ')} 
                                        {group.elementIds.size > 1 && ` (${group.elementIds.size} elements)`}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                              {totalSyncSteps > syncStepsPerPage && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                  <span style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
                                    Showing {syncStepsStart + 1}-{Math.min(syncStepsEnd, totalSyncSteps)} of {totalSyncSteps} synchronized steps
                                  </span>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      onClick={() => setSyncStepsPage(prev => Math.max(1, prev - 1))}
                                      disabled={syncStepsPage === 1}
                                      style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${theme.colors.border}` }}
                                    >
                                      Previous
                                    </button>
                                    <button
                                      disabled
                                      style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${theme.colors.border}` }}
                                    >
                                      Page {syncStepsPage}/{totalSyncStepPages}
                                    </button>
                                    <button
                                      onClick={() => setSyncStepsPage(prev => Math.min(totalSyncStepPages, prev + 1))}
                                      disabled={syncStepsPage === totalSyncStepPages}
                                      style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${theme.colors.border}` }}
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <SyncEmptyStateText theme={theme}>
                          <div className="icon">🔓</div>
                          <div>This prompt doesn't reference any tracked elements yet.</div>
                          <div className="description">
                            When you use element selectors in test steps, synchronization will be enabled automatically.
                          </div>
                        </SyncEmptyStateText>
                      )}
                    </div>
                  </div>
                )}

                {isEditing && (
                  <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
                    <button
                      onClick={handleSaveEdit}
                      style={{
                        ...detailStyles.primaryButton,
                        padding: '10px 20px',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      style={{
                        ...detailStyles.secondaryButton,
                        padding: '10px 20px',
                        fontSize: '14px'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div style={detailStyles.tagsSection}>
                  {extractSourceSectionFromTags(prompt.tags) && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.surface,
                        fontSize: 13,
                        color: theme.colors.text,
                      }}
                    >
                      <strong>Generated from:</strong> {extractSourceSectionFromTags(prompt.tags)}
                    </div>
                  )}
                  <h2 style={{...detailStyles.sectionTitle, color: theme.colors.text}}>Tags</h2>
                  <div>
                    {prompt.tags.map((tag, index) => (
                      <span 
                        key={index}
                        style={{
                          ...detailStyles.tag,
                          backgroundColor: theme.colors.surface,
                          color: theme.colors.text,
                          borderColor: theme.colors.border
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'versions' && (
              <PromptVersions 
                promptId={id || ''}
                currentPlan={generatedSteps?.plan}
                onVersionActivated={() => {
                  // Reload the prompt to get the updated plan
                  if (id) fetchPrompt(id);
                }}
              />
            )}

            {activeTab === 'steps' && (
              <StepsSection>
                <StepsSectionTitle>
                  <Zap size={20} />
                  Generated Test Steps
                </StepsSectionTitle>

                {/* Platform variant tabs — only shown for app tests */}
                {prompt.test_type === 'app' && generatedSteps && (
                  <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: `2px solid ${theme.colors.border}` }}>
                    {(['shared', 'android', 'ios'] as const).map((plat) => {
                      const label = plat === 'shared' ? '🔗 Shared Steps' : plat === 'android' ? '🤖 Android' : '🍎 iOS';
                      const count = plat === 'shared'
                        ? (generatedSteps.plan?.actions?.length || 0)
                        : (platformVariants[plat]?.length || 0);
                      const isActive = activePlatformTab === plat;
                      return (
                        <button
                          key={plat}
                          onClick={() => setActivePlatformTab(plat)}
                          style={{
                            padding: '10px 20px',
                            border: 'none',
                            borderBottom: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                            background: 'transparent',
                            color: isActive ? '#3b82f6' : theme.colors.textSecondary,
                            fontWeight: isActive ? 600 : 400,
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          {label} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {stepsError && (
                  <StepsErrorAlert>
                    Error: {stepsError}
                  </StepsErrorAlert>
                )}
                
                {!generatedSteps && !stepsError && (
                  <StepsEmptyState>
                    <EmptyStateIcon>🚀</EmptyStateIcon>
                    <EmptyStateText>Ready to Generate Test Steps</EmptyStateText>
                    <EmptyStateSubtext>
                      Click "Generate Steps" to create executable test steps from this prompt.
                    </EmptyStateSubtext>
                  </StepsEmptyState>
                )}
                
                {generatedSteps && (
                  <>
                    {generatedSteps.metadata && (
                      <StepsMetadataCard>
                        <strong>Generation Info:</strong> {generatedSteps.metadata.stepCount} steps generated 
                        using {generatedSteps.metadata.method} 
                        {generatedSteps.metadata.model && ` (${generatedSteps.metadata.model})`} 
                        in {generatedSteps.metadata.processingTimeMs}ms
                        {generatedSteps.plan?.meta?.elementsUsed && (
                          <>
                            <br/><strong>Elements:</strong> Used {generatedSteps.plan.meta.elementsUsed} available elements, 
                            {generatedSteps.plan.meta.realElementsFound} steps use real selectors
                          </>
                        )}
                      </StepsMetadataCard>
                    )}
                    
                    {/* Save Test Plan Button */}
                    <StepsActionButtonsContainer>
                      <StepsSaveButton
                        onClick={handleSaveTestPlan}
                        disabled={savingTestPlan}
                        loading={savingTestPlan}
                      >
                        <CheckCircle size={16} />
                        {savingTestPlan ? 'Saving...' : 'Save Test Plan'}
                      </StepsSaveButton>
                      
                      {!isEditingSteps ? (
                        <StepsEditButton onClick={startEditingSteps}>
                          <Edit3 size={16} />
                          Edit Steps
                        </StepsEditButton>
                      ) : (
                        <>
                          <StepsSaveButton
                            onClick={saveEditedSteps}
                            disabled={savingTestPlan}
                            loading={savingTestPlan}
                          >
                            <CheckCircle size={16} />
                            {savingTestPlan ? 'Saving...' : 'Save Changes'}
                          </StepsSaveButton>
                          <StepsCancelButton onClick={cancelEditingSteps}>
                            <XCircle size={16} />
                            Cancel
                          </StepsCancelButton>
                        </>
                      )}
                      
                      {testPlanSaved && (
                        <StepsSuccessMessage>
                          <CheckCircle size={16} />
                          Test plan saved successfully!
                        </StepsSuccessMessage>
                      )}
                    </StepsActionButtonsContainer>
                    
                    <ModernStepsContainer>
                      {/* Empty state for platform variants with no steps yet */}
                      {prompt.test_type === 'app' && activePlatformTab !== 'shared' && !(platformVariants[activePlatformTab]?.length) && (
                        <StepsEmptyState>
                          <EmptyStateIcon>{activePlatformTab === 'android' ? '🤖' : '🍎'}</EmptyStateIcon>
                          <EmptyStateText>No {activePlatformTab === 'android' ? 'Android' : 'iOS'}-specific steps yet</EmptyStateText>
                          <EmptyStateSubtext>
                            Steps that differ between platforms will appear here. Shared steps are on the "Shared Steps" tab.
                            <br /><br />
                            To add platform-specific steps, click "Edit Steps" and add steps that use {activePlatformTab === 'android' ? 'Android' : 'iOS'}-specific selectors.
                          </EmptyStateSubtext>
                        </StepsEmptyState>
                      )}
                      {isEditingSteps && (
                        <EditingModeAlert>
                          <EditingModeText>
                            🛠️ Editing Mode: Click any step to edit, or add a new step
                          </EditingModeText>
                          <AddStepButton onClick={() => setShowAddStepForm(true)}>
                            ➕ Add Step
                          </AddStepButton>
                        </EditingModeAlert>
                      )}
                      
                      {(() => {
                        // Resolve which steps to show based on platform tab
                        const sharedSteps = isEditingSteps ? editedSteps : generatedSteps.plan?.actions;
                        const displaySteps = (prompt.test_type === 'app' && activePlatformTab !== 'shared')
                          ? (platformVariants[activePlatformTab] || [])
                          : sharedSteps;
                        return displaySteps;
                      })()?.map((action: any, index: number) => {
                        const hasRealElement = action.params?.selector || action.params?.elementId || action.params?.elementName || action.target;
                        const isEditing = editingStepIndex === index;
                        
                        // Helper function to get meaningful description
                        const getStepDescription = () => {
                          // Use description if available and meaningful
                          if (action.description && action.description !== action.name && action.description !== action.action) {
                            return action.description;
                          }
                          
                          // Generate human-readable description based on action type
                          switch(action.action || action.name) {
                            case 'open_url':
                              const url = action.url || action.params?.url;
                              return url ? `Navigate to ${url}` : 'Navigate to URL';
                            case 'click_css':
                            case 'click':
                              const clickTarget = action.target || action.params?.selector || action.params?.elementId;
                              return clickTarget ? `Click on ${clickTarget}` : 'Click element';
                            case 'type_css':
                            case 'type':
                              const typeText = action.text || action.value || action.params?.text || action.params?.value;
                              const typeTarget = action.target || action.params?.selector || action.params?.elementId;
                              if (typeText && typeTarget) {
                                return `Type "${typeText}" into ${typeTarget}`;
                              } else if (typeText) {
                                return `Type "${typeText}"`;
                              } else if (typeTarget) {
                                return `Type text into ${typeTarget}`;
                              }
                              return 'Type text into element';
                            case 'wait_for_css':
                            case 'wait_for':
                              const waitTarget = action.target || action.params?.selector || action.params?.elementId;
                              return waitTarget ? `Wait for ${waitTarget} to appear` : 'Wait for element to appear';
                            case 'assert_text_css':
                            case 'assert_text':
                              const assertTarget = action.target || action.params?.selector || action.params?.elementId;
                              const expectedText = action.expected_result || action.params?.expected_text || action.params?.expected_result;
                              if (assertTarget && expectedText) {
                                return `Verify ${assertTarget} contains "${expectedText}"`;
                              } else if (assertTarget) {
                                return `Verify text in ${assertTarget}`;
                              }
                              return 'Verify element text';
                            case 'assert_title_contains':
                              const titleText = action.expected_result || action.params?.expected_text || action.params?.expected_result;
                              return titleText ? `Verify page title contains "${titleText}"` : 'Verify page title';
                            case 'screenshot':
                              return 'Take a screenshot';
                            case 'extract_data':
                            case 'extract':
                            case 'get_data':
                              const extractTarget = action.target || action.params?.selector || action.params?.element;
                              const variableName = action.variable || action.params?.variable || action.store_as || action.params?.store_as || action.save_to || action.params?.save_to;
                              const dataType = action.data_type || action.params?.data_type || action.type || action.params?.type;
                              
                              if (extractTarget && variableName) {
                                return `Extract data from ${extractTarget} into variable '${variableName}'`;
                              } else if (extractTarget && dataType) {
                                return `Extract ${dataType} data from ${extractTarget}`;
                              } else if (extractTarget) {
                                return `Extract data from ${extractTarget}`;
                              } else if (variableName) {
                                return `Extract data into variable '${variableName}'`;
                              }
                              return 'Extract data from element';
                            case 'calculate':
                            case 'math':
                            case 'computation':
                              // Try to find calculation details from various possible fields
                              const expression = action.expression || action.params?.expression || action.formula || action.params?.formula;
                              const calculation = action.calculation || action.params?.calculation;
                              const operation = action.operation || action.params?.operation;
                              const value = action.value || action.params?.value;
                              const text = action.text || action.params?.text;
                              
                              // Build description based on available data
                              if (expression) {
                                return `Calculate: ${expression}`;
                              } else if (calculation) {
                                return `Calculate: ${calculation}`;
                              } else if (operation && value) {
                                return `Calculate: ${operation} ${value}`;
                              } else if (operation) {
                                return `Perform ${operation} calculation`;
                              } else if (text && text.includes('=')) {
                                return `Calculate: ${text}`;
                              } else if (value) {
                                return `Calculate: ${value}`;
                              } else if (text) {
                                return `Calculate: ${text}`;
                              }
                              return 'Perform calculation';
                            case 'scroll':
                              const scrollTarget = action.target || action.params?.selector || action.params?.direction;
                              return scrollTarget ? `Scroll ${scrollTarget}` : 'Scroll page';
                            case 'hover':
                              const hoverTarget = action.target || action.params?.selector;
                              return hoverTarget ? `Hover over ${hoverTarget}` : 'Hover over element';
                            case 'select':
                            case 'select_option':
                              const selectTarget = action.target || action.params?.selector;
                              const selectValue = action.value || action.params?.value || action.params?.option;
                              if (selectTarget && selectValue) {
                                return `Select "${selectValue}" from ${selectTarget}`;
                              } else if (selectTarget) {
                                return `Select option from ${selectTarget}`;
                              }
                              return 'Select option';
                            default:
                              // Fallback: try to create meaningful description from available data
                              const fallbackTarget = action.target || action.params?.selector || action.params?.elementId;
                              const fallbackValue = action.value || action.text || action.params?.value || action.params?.text;
                              const actionName = action.action || action.name || 'Perform action';
                              
                              if (fallbackTarget && fallbackValue) {
                                return `${actionName} "${fallbackValue}" on ${fallbackTarget}`;
                              } else if (fallbackTarget) {
                                return `${actionName} on ${fallbackTarget}`;
                              } else if (fallbackValue) {
                                return `${actionName}: ${fallbackValue}`;
                              }
                              
                              // Last resort: use the action name or description if available
                              if (action.name && action.name !== action.action) {
                                return action.name;
                              }
                              return actionName;
                          }
                        };

                        // Helper function to get essential parameters only
                        const getEssentialParams = () => {
                          const essentials: {key: string, value: any}[] = [];
                          
                          // Add URL for navigation
                          if (action.url || action.params?.url) {
                            essentials.push({
                              key: 'URL',
                              value: action.url || action.params?.url
                            });
                          }
                          
                          // Add selector if it exists and is meaningful
                          const selector = action.selector || action.params?.selector || action.target;
                          if (selector && selector !== '' && selector !== 'undefined') {
                            essentials.push({
                              key: 'Element',
                              value: selector
                            });
                          }
                          
                          // Add text/value for input actions and calculations
                          const textValue = action.text || action.value || action.params?.text || action.params?.value;
                          const expression = action.expression || action.params?.expression || action.formula || action.params?.formula;
                          const calculation = action.calculation || action.params?.calculation;
                          const operation = action.operation || action.params?.operation;
                          
                          // For calculations, prioritize showing the mathematical expression
                          if ((action.action === 'calculate' || action.name === 'calculate') && expression) {
                            essentials.push({
                              key: 'Expression',
                              value: expression
                            });
                          } else if ((action.action === 'calculate' || action.name === 'calculate') && calculation) {
                            essentials.push({
                              key: 'Calculation',
                              value: calculation
                            });
                          } else if ((action.action === 'calculate' || action.name === 'calculate') && operation) {
                            essentials.push({
                              key: 'Operation',
                              value: operation
                            });
                          } else if (textValue && textValue !== '' && textValue !== 'undefined') {
                            const label = expression || action.params?.expression ? 'Expression' : 'Text';
                            essentials.push({
                              key: label,
                              value: textValue
                            });
                          }
                          
                          // For calculations, also show any variables or inputs
                          if (action.action === 'calculate' || action.name === 'calculate') {
                            const variables = action.variables || action.params?.variables;
                            const inputs = action.inputs || action.params?.inputs;
                            
                            if (variables && typeof variables === 'object') {
                              Object.entries(variables).forEach(([key, value]) => {
                                essentials.push({
                                  key: `Variable ${key}`,
                                  value: String(value)
                                });
                              });
                            }
                            
                            if (inputs && typeof inputs === 'object') {
                              Object.entries(inputs).forEach(([key, value]) => {
                                essentials.push({
                                  key: `Input ${key}`,
                                  value: String(value)
                                });
                              });
                            }
                          }
                          
                          // For extract_data actions, show variable and data type information
                          if (action.action === 'extract_data' || action.name === 'extract_data' || action.action === 'extract' || action.name === 'extract') {
                            const variableName = action.variable || action.params?.variable || action.store_as || action.params?.store_as || action.save_to || action.params?.save_to;
                            const dataType = action.data_type || action.params?.data_type || action.type || action.params?.type;
                            const attribute = action.attribute || action.params?.attribute;
                            const property = action.property || action.params?.property;
                            
                            if (variableName) {
                              essentials.push({
                                key: 'Variable',
                                value: variableName
                              });
                            }
                            
                            if (dataType) {
                              essentials.push({
                                key: 'Data Type',
                                value: dataType
                              });
                            }
                            
                            if (attribute) {
                              essentials.push({
                                key: 'Attribute',
                                value: attribute
                              });
                            }
                            
                            if (property) {
                              essentials.push({
                                key: 'Property',
                                value: property
                              });
                            }
                          }
                          
                          // Add expected result for assertions and calculations
                          const expectedResult = action.expected_result || action.params?.expected_text || action.params?.expected_result || action.result || action.params?.result;
                          const calculationResult = action.calculation_result || action.params?.calculation_result || action.computed_value || action.params?.computed_value;
                          
                          if (calculationResult && calculationResult !== '' && calculationResult !== 'undefined') {
                            essentials.push({
                              key: 'Result',
                              value: calculationResult
                            });
                          } else if (expectedResult && expectedResult !== '' && expectedResult !== 'undefined') {
                            const label = (action.action === 'calculate' || action.name === 'calculate') ? 'Expected Result' : 'Expected';
                            essentials.push({
                              key: label,
                              value: expectedResult
                            });
                          }
                          
                          // Add direction for scroll actions
                          const direction = action.direction || action.params?.direction;
                          if (direction && direction !== '' && direction !== 'undefined') {
                            essentials.push({
                              key: 'Direction',
                              value: direction
                            });
                          }
                          
                          // Add option/value for select actions
                          const option = action.option || action.params?.option;
                          if (option && option !== '' && option !== 'undefined' && option !== textValue) {
                            essentials.push({
                              key: 'Option',
                              value: option
                            });
                          }
                          
                          return essentials;
                        };
                        
                        return (
                          <StepCard key={index} isEditing={isEditing}>
                            {isEditing ? (
                              <StepEditForm
                                step={action}
                                stepIndex={index}
                                promptId={id || ''}
                                onSave={(updatedStep) => updateStep(index, updatedStep)}
                                onCancel={() => setEditingStepIndex(null)}
                                onSyncUpdate={async (stepIndex, paramKey, newValue) => {
                                  try {
                                    await updateStepSelector(stepIndex, paramKey, newValue);
                                  } catch (error) {
                                    console.error('Failed to sync step selector:', error);
                                    throw error;
                                  }
                                }}
                              />
                            ) : (
                              <>
                                <StepHeader>
                                  <StepNumber>{index + 1}</StepNumber>
                                  <StepContent>
                                    <StepTitle>
                                      <ActionTypeBadge actionType={action.action || action.name}>
                                        {action.action || action.name || 'action'}
                                      </ActionTypeBadge>
                                      <StepDescription>{getStepDescription()}</StepDescription>
                                    </StepTitle>
                                    
                                    {getEssentialParams().length > 0 && (
                                      <StepDetails>
                                        {getEssentialParams().map(({key, value}) => (
                                          <StepDetailRow key={key}>
                                            <StepDetailLabel>{key}:</StepDetailLabel>
                                            <StepDetailValue>{value}</StepDetailValue>
                                          </StepDetailRow>
                                        ))}
                                      </StepDetails>
                                    )}
                                  </StepContent>
                                  
                                  {isEditingSteps && (
                                    <StepActions>
                                      <StepActionButton
                                        variant="edit"
                                        onClick={() => setEditingStepIndex(index)}
                                        title="Edit step"
                                      >
                                        <Edit3 size={12} />
                                      </StepActionButton>
                                      <StepActionButton
                                        variant="up"
                                        onClick={() => moveStep(index, index - 1)}
                                        disabled={index === 0}
                                        title="Move up"
                                      >
                                        ⬆️
                                      </StepActionButton>
                                      <StepActionButton
                                        variant="down"
                                        onClick={() => moveStep(index, index + 1)}
                                        disabled={index === editedSteps.length - 1}
                                        title="Move down"
                                      >
                                        ⬇️
                                      </StepActionButton>
                                      <StepActionButton
                                        variant="delete"
                                        onClick={() => deleteStep(index)}
                                        disabled={!canDelete}
                                        title={canDelete ? "Delete step" : "Delete disabled by security policy (admin only)"}
                                        style={{ opacity: canDelete ? 1 : 0.4, cursor: canDelete ? 'pointer' : 'not-allowed' }}
                                      >
                                        🗑️
                                      </StepActionButton>
                                    </StepActions>
                                  )}
                                </StepHeader>
                              </>
                            )}
                          </StepCard>
                        );
                      })}
                      
                      {showAddStepForm && (
                        <AddStepForm
                          onAdd={addStep}
                          onCancel={() => setShowAddStepForm(false)}
                        />
                      )}
                    </ModernStepsContainer>
                    
                    {generatedSteps.plan?.meta && (
                      <StepsMetadataCard>
                        <strong>Plan Metadata:</strong><br/>
                        Prompt: {generatedSteps.plan.meta.prompt}<br/>
                        Version: {generatedSteps.plan.meta.version}<br/>
                        Generated: {new Date(generatedSteps.plan.meta.generatedAt).toLocaleString()}
                      </StepsMetadataCard>
                    )}
                  </>
                )}
              </StepsSection>
            )}

            {activeTab === 'bindings' && (
              <div>
                <h2 style={{...detailStyles.sectionTitle, color: theme.colors.text}}>Test Variables</h2>
                <p style={{...detailStyles.description, color: theme.colors.text}}>
                  Define variables with names and descriptions that can be used during step generation or test execution.
                </p>
                <BindingsManager promptId={prompt?.id} />
              </div>
            )}

            {activeTab === 'execution-history' && (
              <div>
                <TestCaseExecutionHistory 
                  promptId={prompt?.id}
                  title="Test Execution History"
                />
              </div>
            )}

            {activeTab === 'failure-analysis' && (
              <FailureAnalysisSection theme={theme}>
                <FailureAnalysisHeader theme={theme}>
                  <FailureAnalysisTitle theme={theme}>
                    🚨 Recent Failures Analysis
                  </FailureAnalysisTitle>
                  <RefreshButton 
                    theme={theme} 
                    onClick={loadFailureAnalysis}
                    disabled={loadingFailures}
                  >
                    {loadingFailures ? 'Loading...' : 'Refresh'}
                  </RefreshButton>
                </FailureAnalysisHeader>

                {failuresError && (
                  <FailureErrorMessage theme={theme}>
                    {failuresError}
                  </FailureErrorMessage>
                )}

                {loadingFailures && !failureAnalysisData && (
                  <LoadingMessage theme={theme}>
                    🔍 Analyzing recent test failures...
                  </LoadingMessage>
                )}

                {failureAnalysisData?.executions?.length === 0 && !loadingFailures && (
                  <EmptyState theme={theme}>
                    <div className="icon">🎉</div>
                    <div className="title">No Recent Failures</div>
                    <div className="description">
                      Great news! This prompt hasn't had any failed test executions recently.
                      Keep up the good work with stable test automation.
                    </div>
                  </EmptyState>
                )}

                {failureAnalysisData?.executions?.map((execution: any, index: number) => (
                  <FailureCard key={execution.execution_id || execution.id || index} theme={theme}>
                    <FailureHeader theme={theme}>
                      <FailureInfo theme={theme}>
                        <FailureTitle theme={theme}>
                          ❌ Execution #{(execution.execution_id || execution.id || 'unknown').slice(-8)}
                        </FailureTitle>
                        <FailureDate theme={theme}>
                          {new Date(execution.started_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </FailureDate>
                      </FailureInfo>
                    </FailureHeader>

                    {execution.failed_steps?.length > 0 && (
                      <FailedStepsContainer theme={theme}>
                        <FailedStepsTitle theme={theme}>
                          Failed Steps ({execution.failed_steps.length})
                        </FailedStepsTitle>
                        {execution.failed_steps.slice(0, 3).map((step: any, stepIndex: number) => (
                          <FailureStepCard key={stepIndex} theme={theme}>
                            <StepAction theme={theme}>
                              {step.action} {step.element_type && `(${step.element_type})`}
                            </StepAction>
                            {step.error_message && (
                              <StepError theme={theme}>
                                {step.error_message}
                              </StepError>
                            )}
                          </FailureStepCard>
                        ))}
                        {execution.failed_steps.length > 3 && (
                          <div style={{ 
                            textAlign: 'center', 
                            color: theme.colors.textSecondary,
                            fontSize: '13px',
                            marginTop: '8px'
                          }}>
                            +{execution.failed_steps.length - 3} more failed steps
                          </div>
                        )}
                      </FailedStepsContainer>
                    )}

                    {(selectedExecution?.execution_id || selectedExecution?.id) === (execution.execution_id || execution.id) && (
                      <MinimalReproSection theme={theme}>
                        {generatingMinimalSteps && !minimalReproSteps && (
                          <LoadingMessage theme={theme}>
                            🤖 Generating AI failure analysis...
                          </LoadingMessage>
                        )}

                        {minimalStepsError && (
                          <FailureErrorMessage theme={theme}>
                            {minimalStepsError}
                          </FailureErrorMessage>
                        )}

                        {minimalReproSteps && (
                          <>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '16px',
                          padding: '12px',
                          background: theme.colors.surface === '#2d3748' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.05)',
                          borderRadius: '8px',
                          border: `1px solid ${theme.colors.border}`
                        }}>
                          <div>
                             <h4 style={{ 
                              margin: 0,
                              color: theme.colors.text,
                              fontSize: '14px',
                              fontWeight: '600'
                            }}>
                               AI Failure Analysis
                            </h4>
                            <p style={{ 
                              margin: '4px 0 0 0',
                              fontSize: '12px',
                              color: theme.colors.textSecondary
                            }}>
                              AI confidence: {Math.round((minimalReproSteps.reproductionGuarantee || 0) * 100)}%
                            </p>
                          </div>
                        </div>

                        {/* Analysis Summary */}
                        {minimalReproSteps.analysisReport && (
                          <div style={{
                            marginBottom: '16px',
                            padding: '12px',
                            background: theme.colors.surface === '#2d3748' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}>
                            <div style={{ fontWeight: '600', marginBottom: '8px', color: theme.colors.text }}>
                              📊 Analysis Summary
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11px' }}>
                              {minimalReproSteps.analysisReport.criticalPath && (
                                <div>
                                  <strong style={{ color: theme.colors.text }}>Critical Path:</strong>
                                  <div style={{ color: theme.colors.textSecondary, marginTop: '2px' }}>
                                    {Array.isArray(minimalReproSteps.analysisReport.criticalPath) 
                                      ? minimalReproSteps.analysisReport.criticalPath.join(', ')
                                      : minimalReproSteps.analysisReport.criticalPath}
                                  </div>
                                </div>
                              )}
                              {minimalReproSteps.analysisReport.removedSteps && (
                                <div>
                                  <strong style={{ color: theme.colors.text }}>Removed Steps:</strong>
                                  <div style={{ color: theme.colors.textSecondary, marginTop: '2px' }}>
                                    {Array.isArray(minimalReproSteps.analysisReport.removedSteps) 
                                      ? minimalReproSteps.analysisReport.removedSteps.join(', ')
                                      : minimalReproSteps.analysisReport.removedSteps}
                                  </div>
                                </div>
                              )}
                            </div>
                            {minimalReproSteps.analysisReport.reasoning && (
                              <div style={{ marginTop: '8px', fontStyle: 'italic', color: theme.colors.textSecondary }}>
                                "{minimalReproSteps.analysisReport.reasoning}"
                              </div>
                            )}
                          </div>
                        )}
                        <MinimalReproTitle theme={theme}>
                          💡 AI Failure Insights
                        </MinimalReproTitle>
                        <div style={{ 
                          color: theme.colors.textSecondary,
                          fontSize: '14px',
                          marginBottom: '16px'
                        }}>
                          Read-only insights from recent failures. No steps are auto-generated or updated.
                        </div>
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          background: theme.colors.surface === '#2d3748' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)',
                          borderRadius: '8px'
                        }}>
                          <div style={{ fontWeight: 600, color: theme.colors.text, marginBottom: '8px' }}>
                            Primary Insight
                          </div>
                          <div style={{ color: theme.colors.textSecondary, fontSize: '13px' }}>
                            {(() => {
                              const rawError = execution?.failed_steps?.[0]?.error_message;
                              const message = typeof rawError === 'string'
                                ? rawError
                                : rawError
                                  ? JSON.stringify(rawError)
                                  : 'No detailed error message available.';

                              if (message.includes('Unsupported action: open_url')) {
                                return 'Runner does not support open_url directly. Map open_url to an allowed navigation action (for example open or navigate) before execution.';
                              }

                              return message;
                            })()}
                          </div>
                        </div>
                          </>
                        )}
                      </MinimalReproSection>
                    )}
                  </FailureCard>
                ))}
              </FailureAnalysisSection>
            )}
          </Content>
        </MainContent>
        
        {/* History Toggle Button */}
        {!isHistoryOpen && (
          <HistoryToggleButton onClick={() => setIsHistoryOpen(true)}>
            <History size={16} />
            <span>History</span>
          </HistoryToggleButton>
        )}
        
        {/* History Sidebar Overlay */}
        <HistorySidebarOverlay 
          $isOpen={isHistoryOpen} 
          onClick={() => setIsHistoryOpen(false)} 
        />
        
        {/* History Sidebar Panel */}
        <HistorySidebarPanel $isOpen={isHistoryOpen}>
          <HistorySidebarHeader>
            <HistorySidebarTitle>
              <History size={20} />
              History
            </HistorySidebarTitle>
            <HistorySidebarClose onClick={() => setIsHistoryOpen(false)}>
              <X size={18} />
            </HistorySidebarClose>
          </HistorySidebarHeader>
          
          <HistorySidebarContent>
            {prompt && id && (
              <PromptActivitySidebar promptId={id} />
            )}
          </HistorySidebarContent>
        </HistorySidebarPanel>
      </Layout>

      {/* Sync Notification */}
      {notification && (
        <SyncNotificationDisplay 
          type={notification.type}
          message={notification.message}
          onClose={clearNotification}
        />
      )}
    </Container>
  );
};