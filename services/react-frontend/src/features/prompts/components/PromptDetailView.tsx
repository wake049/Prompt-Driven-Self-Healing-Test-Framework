/**
 * Prompt Detail View Component
 * Shows detailed view of a specific prompt with actions and tabs
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { config } from '../../../app/config';
import unifiedApiClient from '../../../shared/utils/unifiedApiClient';
import { TestCaseExecutionHistory } from '../../execution';
import { promptsApiService } from '../api';
import { useAuth } from '../../../contexts/AuthContext';
import { BindingsManager } from '../../bindings';
<<<<<<< Updated upstream
=======
import { usePromptSelectorSync, useSyncNotifications } from '../../../shared/hooks/useSyncHooks';
import { stepElementRelationshipService } from '../../../shared/services/stepElementRelationshipService';
import { SyncIndicator, SyncNotification as SyncNotificationDisplay } from '../../../shared/components/SyncVisualIndicators';
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
  Link
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

const Header = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
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
    color: #667eea;
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
  border-image: linear-gradient(90deg, #667eea 0%, #764ba2 100%) 1;

  @media (max-width: 768px) {
    padding: 0 20px;
    overflow-x: auto;
  }
`;

const Tab = styled.div<{ active?: boolean }>`
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.active ? '#667eea' : '#6c757d'};
  cursor: pointer;
  border-bottom: 3px solid ${props => props.active ? '#667eea' : 'transparent'};
  transition: all 0.3s ease;
  white-space: nowrap;
  position: relative;
  border-radius: 8px 8px 0 0;
  
  ${props => props.active && `
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    box-shadow: 0 -2px 8px rgba(102, 126, 234, 0.2);
  `}

  &:hover {
    color: #667eea;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
  }
`;

const StepBadge = styled.span`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.span`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 16px;
`;

const ErrorMessage = styled.div`
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  border: 1px solid #f87171;
  color: #dc2626;
  padding: 20px;
  border-radius: 12px;
  margin: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(248, 113, 113, 0.2);
`;
>>>>>>> Stashed changes

interface PromptData {
  id: string;  // Changed from number to string for UUID
  title: string;
  description: string;
  content: string;
  starting_url?: string;
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

// Step editing components
const StepEditForm: React.FC<{
  step: any;
<<<<<<< Updated upstream
  onSave: (updatedStep: any) => void;
=======
  stepIndex: number;
  promptId: string;
  onSave: (updatedStep: any) => Promise<void>;
>>>>>>> Stashed changes
  onCancel: () => void;
}> = ({ step, onSave, onCancel }) => {
  const [editedStep, setEditedStep] = useState({ ...step });
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamValue, setNewParamValue] = useState('');
<<<<<<< Updated upstream
=======
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
>>>>>>> Stashed changes

  const updateParam = (key: string, value: string) => {
    setEditedStep({
      ...editedStep,
      params: { ...editedStep.params, [key]: value }
    });
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

  const handleSave = async () => {
    if (isSaving) return;
    
    try {
      setIsSaving(true);
      await onSave(editedStep);
    } catch (error) {
      alert(`Failed to save step: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
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
        {Object.entries(editedStep.params || {}).map(([key, value]) => (
          <div key={key} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
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
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            />
            <button
              onClick={() => removeParam(key)}
              style={{
                padding: '6px 10px',
                backgroundColor: '#ef4444',
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
              backgroundColor: '#10b981',
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
          disabled={isSaving}
          style={{
            padding: '8px 16px',
            backgroundColor: isSaving ? '#9ca3af' : '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.7 : 1
          }}
        >
           {isSaving ? 'Saving...' : 'Save'}
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
      border: '2px solid #10b981',
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
                backgroundColor: '#ef4444',
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
              backgroundColor: '#10b981',
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
            backgroundColor: newStep.name ? '#10b981' : '#d1d5db',
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
    color: '#dc2626',
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
    border: '1px solid #10b981',
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
    color: '#059669',
    flex: 1,
    wordBreak: 'break-all' as 'break-all'
  },
  realElementBadge: {
    backgroundColor: '#10b981',
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
    color: '#dc2626',
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

export const PromptDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  
  // Test step editing state
  const [isEditingSteps, setIsEditingSteps] = useState(false);
  const [editedSteps, setEditedSteps] = useState<any[]>([]);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [showAddStepForm, setShowAddStepForm] = useState(false);

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
      console.error('Error fetching prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to load prompt');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingTestPlan = async (promptId: string) => {
    try {
      if (!isValidUuid(promptId)) {
        console.warn('Invalid UUID format for prompt ID:', promptId);
        return;
      }
      
      console.log(' Loading existing test plan for prompt:', promptId);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiBaseUrl}/generated-test-plans/by-prompt/${promptId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const testPlansData = await response.json();
        console.log(' Found test plans data:', testPlansData);
        
        // Get the first test plan if any exist
        const existingPlan = testPlansData.test_plans && testPlansData.test_plans.length > 0 
          ? testPlansData.test_plans[0] 
          : null;
          
        if (existingPlan) {
          console.log(' Test plan data structure:', existingPlan.steps);
          console.log(' Test plan data type:', typeof existingPlan.steps);
          
          // Use the steps from the test plan
          let planData = existingPlan.steps;
          if (typeof planData === 'string') {
            try {
<<<<<<< Updated upstream
              planData = JSON.parse(planData);
            console.log('📝 Parsed test plan data:', planData);
          } catch (e) {
            console.error(' Failed to parse test plan data:', e);
=======
              planData = JSON.parse(planData);} catch (e) {
>>>>>>> Stashed changes
            return;
          }
        }
        
        // Handle different data structures - if it's an array, wrap it in the expected structure
        let formattedPlan;
        if (Array.isArray(planData)) {
          // Data is just an array of actions, need to wrap it
          formattedPlan = {
            actions: planData,
            meta: {
              prompt: existingPlan.prompt_text,
              version: "1.0.0",
              generatedAt: existingPlan.created_at,
              totalElements: existingPlan.total_elements_count,
              enterpriseMode: existingPlan.enterprise_mode,
              chunksProcessed: existingPlan.chunks_processed,
              originalStepCount: existingPlan.original_step_count
            }
          };
        } else if (planData && planData.actions) {
          // Data is already in the correct structure
          formattedPlan = planData;
        } else {
          console.error(' Unexpected data structure:', planData);
          return;
        }
        
        // Set the generated steps to display the saved plan
        setGeneratedSteps({
          plan: formattedPlan,
          metadata: {
            processingTimeMs: existingPlan.processing_time_ms,
            chunksProcessed: existingPlan.chunks_processed,
            originalStepCount: existingPlan.original_step_count
          }
        });
<<<<<<< Updated upstream
        setTestPlanSaved(true);
        console.log(' Loaded test plan with', formattedPlan?.actions?.length || 0, 'steps');
        } else {
          console.log('ℹ️ No existing test plan found for this prompt');
        }
      } else if (response.status === 404) {
        console.log('ℹ️ No existing test plan found for this prompt');
        // This is normal - not all prompts have saved test plans
      } else {
        console.warn(' Failed to load test plan:', response.statusText);
=======
        setTestPlanSaved(true);} else {}
      } else if (response.status === 404) {// This is normal - not all prompts have saved test plans
>>>>>>> Stashed changes
      }
    } catch (error) {
      console.error(' Error loading existing test plan:', error);
      // Don't show error to user - it's not critical if loading fails
    }
  };

  const handleBackToPrompts = () => {
    navigate('/prompts');
  };

  const handleEdit = () => {
    console.log('Edit prompt:', id);
    setEditedDescription(prompt?.description || '');
    setEditedContent(prompt?.content || '');
    setEditedStartingUrl(prompt?.starting_url || '');
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
        starting_url: editedStartingUrl,
        category: prompt.category
      };
      
      const savedPrompt = await promptsApiService.updatePrompt(prompt.id, updateData);
      console.log(' Prompt saved successfully:', savedPrompt);

      // Update the local state with the saved data from the backend response
      const updatedPrompt: PromptData = {
        ...prompt,
        description: savedPrompt.description || '',
        content: savedPrompt.content || '',
        starting_url: savedPrompt.starting_url || '',
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
  };

  const handleRun = async () => {
    console.log('Run prompt:', id);
    
    if (!id) {
      alert('No prompt selected');
      return;
    }

    try {
      setIsRunning(true);
      
      // Call the test execution API
      const result = await unifiedApiClient.executePrompt(id);
      
      if (result.success) {
        setRunningExecutionId(result.execution_id);
        alert(`Test execution started successfully!\nExecution ID: ${result.execution_id}\nSteps to execute: ${result.steps_count}`);
        
        // TODO: Fix polling when execution tracking is implemented
        // pollExecutionStatus(result.execution_id);
      } else {
        alert(`Failed to start test execution: ${result.message || 'Unknown error'}`);
      }
      
    } catch (error: any) {
      alert(`Error starting test execution: ${error.message || 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  // State for test execution
  const [isRunning, setIsRunning] = useState(false);
  const [runningExecutionId, setRunningExecutionId] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<any>(null);

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
    if (action.includes('click')) return '#10b981'; // Green for clicks
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
      console.log('Generating steps for prompt:', prompt.title);
      
      // Analyze prompt to determine what types of elements we need
      const promptText = `${prompt.title} ${prompt.description} ${prompt.content || ''}`.toLowerCase();
      const elementQueries: Array<{query: string, element_type: string, limit: number}> = [];
      
      // Smart element prioritization - balance relevance with diversity
      // This works for any application/company while respecting AI token limits
      console.log('Using intelligent element selection for optimal AI performance');
      
      // Extract key terms from prompt for relevance scoring
      const promptWords = promptText.toLowerCase().split(/\s+/)
        .filter(word => word.length > 2)
        .filter(word => !['the', 'and', 'but', 'for', 'are', 'with', 'this', 'that'].includes(word));
      
      console.log('Key prompt terms for relevance scoring:', promptWords);
      
      // Phase 1: Get available elements for step generation
      let availableElements: any[] = [];
<<<<<<< Updated upstream
      
      try {
        console.log('Getting available elements...');
        
        // First, get available elements using authenticated request
=======
>>>>>>> Stashed changes
        const token = localStorage.getItem('auth_token');
        const elementsResponse = await fetch(`${config.apiBaseUrl}/api/v1/sql/elements?limit=1000`, {
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

            console.log('Elements grouped by page:', Object.keys(elementsByPage).map(page => `${page} (${elementsByPage[page].length} elements)`));

            // Determine target page based on prompt context
            let targetPageName = null;
            const startingUrl = prompt.starting_url;
            
            if (startingUrl) {
              // Try to find page by matching URL patterns
              for (const pageName of Object.keys(elementsByPage)) {
                const pageElements = elementsByPage[pageName];
                if (pageElements.length > 0) {
                  const pageUrl = pageElements[0].attributes?.url || pageElements[0].attributes?.full_url;
                  if (pageUrl && (pageUrl.includes(startingUrl) || startingUrl.includes(pageUrl))) {
                    targetPageName = pageName;
                    console.log(`Found target page by URL match: ${targetPageName}`);
                    break;
                  }
                }
              }
            }

            // If no URL match, try to find page by prompt content analysis
            if (!targetPageName) {
              const promptKeywords = promptText.split(/\s+/).filter(word => 
                word.length > 3 && !['the', 'and', 'but', 'for', 'are', 'with', 'this', 'that', 'will', 'then'].includes(word)
              );
              
              let bestMatch: { page: string | null, score: number } = { page: null, score: 0 };
              
              for (const [pageName, pageElements] of Object.entries(elementsByPage)) {
                let pageScore = 0;
                const elements = pageElements as any[];
                
                // Score based on element text content matching prompt keywords
                elements.forEach(element => {
                  const elementText = (element.text_content || '').toLowerCase();
                  promptKeywords.forEach(keyword => {
                    if (elementText.includes(keyword.toLowerCase())) {
                      pageScore += 10;
                    }
                  });
                });
                
                // Boost score for pages with more relevant elements
                pageScore += elements.length * 0.5;
                
                if (pageScore > bestMatch.score) {
                  bestMatch = { page: pageName, score: pageScore };
                }
              }
              
              if (bestMatch.page) {
                targetPageName = bestMatch.page;
                console.log(`Found target page by content analysis: ${targetPageName} (score: ${bestMatch.score})`);
              }
            }

            // Use the most relevant page, or fallback to the page with most elements
            if (!targetPageName && Object.keys(elementsByPage).length > 0) {
              targetPageName = Object.keys(elementsByPage).reduce((a, b) => 
                elementsByPage[a].length > elementsByPage[b].length ? a : b
              );
              console.log(`Using fallback page with most elements: ${targetPageName}`);
            }

            // Filter elements to target page and transform for AI service
            let targetElements: any[];
            
            // If we have a clear page match, use those elements
            // But if it results in too few elements, expand to include related pages
            if (targetPageName && elementsByPage[targetPageName]) {
              targetElements = elementsByPage[targetPageName];
              
              // If the target page has too few elements (less than 5), include other pages too
              if (targetElements.length < 5 && Object.keys(elementsByPage).length > 1) {
                console.log(`Target page ${targetPageName} has only ${targetElements.length} elements, including other pages...`);
                
                // Add elements from other pages, prioritizing pages with similar content
                for (const [pageName, pageElements] of Object.entries(elementsByPage)) {
                  if (pageName !== targetPageName) {
                    targetElements = [...targetElements, ...(pageElements as any[])];
                  }
                }
                console.log(`Expanded to ${targetElements.length} total elements from ${Object.keys(elementsByPage).length} pages`);
              }
            } else {
              // No clear target page, use all elements
              targetElements = elementsData.data;
              console.log(`No clear target page found, using all ${targetElements.length} elements`);
            }
            
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

            // Page context analysis is now handled by the backend's two-phase AI system
            
            console.log(`Using ${availableElements.length} elements from page: ${targetPageName}`);
            
            // Log sample elements for debugging
            if (availableElements.length > 0) {
              console.log('Sample elements from target page:', availableElements.slice(0, 3).map((el: any) => ({
                elementId: el.elementId,
                name: el.name,
                css_selector: el.css_selector,
                tag: el.tag,
                text: el.text
              })));
            }
            
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
            availableElements = sortedElements.slice(0, elementLimit);
            
            console.log(`Selected ${availableElements.length} elements for AI processing (verification test: ${isVerificationTest})`);
            console.log('Top scored elements:', availableElements.slice(0, 5).map((el: any) => ({
              name: el.name,
              css_selector: el.css_selector,
              score: el.relevanceScore
            })));
          }
        }
      
      // Extract the actual page URL from recorded elements, or fallback to prompt starting_url
      const pageUrl = prompt.starting_url || 
                      (availableElements.length > 0 && availableElements[0].attributes?.url) ||
                      (availableElements.length > 0 && availableElements[0].attributes?.full_url) ||
                      'https://example.com';

      // Now generate steps using the AI service
      // Use content as primary prompt if it exists and is longer, otherwise use title + description
      console.log(' Prompt object debug:', {
        title: prompt.title,
        description: prompt.description,
        content: prompt.content,
        contentLength: prompt.content?.length || 0
      });
      
      const primaryPrompt = (prompt.content && prompt.content.length > 20) 
        ? prompt.content 
        : `${prompt.title}: ${prompt.description}`;
        
      console.log(' Primary prompt selected:', primaryPrompt);
        
      console.log('Sending to AI service:', {
        prompt: primaryPrompt,
        baseUrl: pageUrl,
        availableElementsCount: availableElements.length,
        sampleElements: availableElements.slice(0, 2)
      });
      
      // Transform to new enterprise PromptEnvelope format
      const promptEnvelope = {
        prompt: primaryPrompt,
        prompt_id: prompt.id,  // Include prompt ID so AI can load existing bindings
        tenant_id: "frontend-user", // Default tenant for frontend usage
        page_url: pageUrl,
        max_steps: 50,
        include_screenshots: false,
        include_assertions: true,
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
          actions: data.steps?.map((step: any) => ({
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
          })) || [],
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
      console.log('Generated steps:', data);
      
    } catch (err) {
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
        created_by: 'user'
      };
      
      console.log('Saving test plan:', testPlanData);
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.apiBaseUrl}/generated-test-plans`, {
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

      const result = await response.json();
      console.log(' Test plan saved successfully:', result);
      
      setTestPlanSaved(true);
      
      // Show success message for a few seconds
      setTimeout(() => setTestPlanSaved(false), 3000);
      
    } catch (error) {
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
      const response = await fetch(`${config.apiBaseUrl}/generated-test-plans`, {
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

      const savedPlan = await response.json();
      const planId = savedPlan.id;

      // 🆕 Extract and save element relationships
      try {
        const elementReferences = stepElementRelationshipService.extractElementReferences(editedSteps);
        
        if (elementReferences.length > 0) {
          // Clean up existing relationships first
          await stepElementRelationshipService.deleteStepElementRelationships(id!);
          
          // Save new relationships
          await stepElementRelationshipService.saveStepElementRelationships(
            id!, // promptId
            planId, // planId
            elementReferences
          );
          
        } else {
          // No element references found
        }
      } catch (relationshipError) {
        // Don't fail the entire save operation, just log the error
        setTimeout(() => {
          alert(`Test plan saved successfully, but failed to save element relationships: ${relationshipError instanceof Error ? relationshipError.message : 'Unknown error'}`);
        }, 100);
      }

      // Update the displayed steps
      setGeneratedSteps(updatedGeneratedSteps);
      setIsEditingSteps(false);
      setEditedSteps([]);
      setTestPlanSaved(true);
<<<<<<< Updated upstream
      
      console.log(' Edited test plan saved successfully');
=======
>>>>>>> Stashed changes
      setTimeout(() => setTestPlanSaved(false), 3000);
      
    } catch (error) {
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

  const updateStep = async (index: number, updatedStep: any) => {
    const oldStep = editedSteps[index];
    const newSteps = [...editedSteps];
    newSteps[index] = updatedStep;
    setEditedSteps(newSteps);
    setEditingStepIndex(null);

    // Check for selector changes that need to be synced
    const selectorKeys = ['selector', 'elementId', 'target', 'locator'];
    
    if (oldStep && updatedStep.params) {
      for (const [key, newValue] of Object.entries(updatedStep.params)) {
        if (selectorKeys.includes(key)) {
          const oldValue = oldStep.params?.[key];
          const newVal = String(newValue || '').trim();
          const oldVal = String(oldValue || '').trim();
          
          // If selector value changed, trigger sync
          if (newVal !== oldVal && newVal) {
            try {
              await updateStepSelector(index, key, newVal);
            } catch (error) {
              // Don't fail the entire update, but notify user
              setTimeout(() => {
                alert(`Step saved, but failed to sync selector '${key}' with related elements: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }, 100);
            }
          }
        }
      }
    }
  };

  const deleteStep = (index: number) => {
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

  const handleDuplicate = () => {
    console.log('Duplicate prompt:', id);
    // TODO: Implement duplicate functionality
  };

  const handleArchive = () => {
    console.log('Archive prompt:', id);
    // TODO: Implement archive functionality
  };

<<<<<<< Updated upstream
=======
  // Failure analysis functions
  const loadFailureAnalysis = async () => {
    if (!id) return;
    
    try {
      setLoadingFailures(true);
      setFailuresError(null);const response = await unifiedApiClient.getRecentFailedExecutions(id, 10);// Handle both array response and object response
        const executions = Array.isArray(response) ? response : response?.executions || [];if (executions && executions.length > 0) {// Log details of each execution to debug
          executions.forEach((exec: any, index: number) => {});
          
          // Only show the most recent execution
          const mostRecentExecution = executions[0];// Set the data with only the most recent execution
          const failureData = { executions: [mostRecentExecution] };
          setFailureAnalysisData(failureData);// Try both 'failed_steps' and 'steps' fields to be resilient
          const failedSteps = mostRecentExecution?.failed_steps || 
                             (mostRecentExecution?.steps || []).filter((step: any) => step.status === 'failed');
          
          if (mostRecentExecution && failedSteps && failedSteps.length > 0) {// Ensure the execution object has the right structure for the AI call
            const executionForAI = {
              ...mostRecentExecution,
              failed_steps: failedSteps
            };
            
            // Small delay to let the UI update first
            setTimeout(() => {
              generateMinimalReproSteps(executionForAI);
            }, 500);
          } else {}
        } else {setFailureAnalysisData({ executions: [] });
        }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
        setFailuresError(`Failed to load failure analysis data: ${errorMessage}`);
    } finally {
      setLoadingFailures(false);
    }
  };

  const generateMinimalReproSteps = async (execution: any) => {if (!execution || !execution.failed_steps) {return;
    }
    
    try {
      setGeneratingMinimalSteps(true);
      setMinimalStepsError(null);
      setSelectedExecution(execution);
      
      // Call the real API
      const response = await unifiedApiClient.generateMinimalReproSteps(
        execution.execution_id,
        execution.failed_steps
      );
      
      setMinimalReproSteps(response);
    } catch (error) {
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

      // TODO: You can add polling here to check execution status
      // For now, we'll just show that execution started

    } catch (error: any) {
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

>>>>>>> Stashed changes
  if (loading) {
    return (
      <div style={detailStyles.container}>
        <div style={detailStyles.loading}>
          <div style={{
            border: '2px solid #f3f4f6',
            borderTop: '2px solid #0f766e',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ marginLeft: '12px', color: '#64748b' }}>Loading prompt...</span>
        </div>
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div style={detailStyles.container}>
        <div style={detailStyles.error}>
          {error || 'Prompt not found'}
          <button
            onClick={handleBackToPrompts}
            style={{
              marginLeft: '12px',
              padding: '4px 8px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Back to Prompts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={detailStyles.container}>
      <div style={detailStyles.layout}>
        {/* Main Content */}
        <div style={detailStyles.mainContent}>
          {/* Header */}
          <div style={detailStyles.header}>
            <div style={detailStyles.breadcrumb}>
              <span 
                style={detailStyles.breadcrumbLink}
                onClick={handleBackToPrompts}
              >
                Prompts
              </span>
              {' > '}
              <span>{prompt.title}</span>
            </div>

            <div style={detailStyles.titleSection}>
              <div style={detailStyles.titleLeft}>
                <div style={detailStyles.category}>
                  {prompt.category || 'E-commerce'}
                </div>
                <h1 style={detailStyles.title}>{prompt.title}</h1>
              </div>

              <div style={detailStyles.actions}>
                <button
                  style={{
                    ...detailStyles.primaryButton,
                    backgroundColor: isRunning ? '#6b7280' : '#0f766e'
                  }}
                  onClick={handleRun}
                  disabled={isRunning}
                  onMouseEnter={(e) => {
                    if (!isRunning) {
                      e.currentTarget.style.backgroundColor = '#0d9488';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRunning) {
                      e.currentTarget.style.backgroundColor = '#0f766e';
                    }
                  }}
                >
                  {isRunning ? 'Running...' : runningExecutionId ? 'Executing...' : 'Run'}
                </button>
                <button
                  style={detailStyles.secondaryButton}
                  onClick={handleGenerateSteps}
                  disabled={generatingSteps}
                  onMouseEnter={(e) => {
                    if (!generatingSteps) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!generatingSteps) {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }
                  }}
                >
                  {generatingSteps ? 'Generating...' : 'Generate Steps'}
                </button>
                {!isEditing && (
                  <button
                    style={detailStyles.secondaryButton}
                    onClick={handleEdit}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    Edit
                  </button>
                )}
                {isEditing && (
                  <span style={{ 
                    color: '#f59e0b', 
                    fontWeight: '500',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    ✏️ Editing...
                  </span>
                )}
                <div style={{ position: 'relative' }}>
                  <button
                    style={detailStyles.dropdownButton}
                    onClick={() => setShowDropdown(!showDropdown)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    ⋯
                  </button>
                  {showDropdown && (
                    <div style={detailStyles.dropdown}>
                      <div 
                        style={detailStyles.dropdownItem}
                        onClick={() => {
                          handleDuplicate();
                          setShowDropdown(false);
                        }}
                      >
                        Duplicate
                      </div>
                      <div 
                        style={detailStyles.dropdownItem}
                        onClick={() => {
                          handleArchive();
                          setShowDropdown(false);
                        }}
                      >
                        Archive
                      </div>
                      <div style={detailStyles.dropdownItem}>Versions</div>
                      <div style={detailStyles.dropdownItem}>Bindings</div>
                      <div style={detailStyles.dropdownItem}>Permissions</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={detailStyles.tabs}>
            <div
              style={{
                ...detailStyles.tab,
                ...(activeTab === 'overview' ? detailStyles.tabActive : {})
              }}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </div>
            <div
              style={{
                ...detailStyles.tab,
                ...(activeTab === 'versions' ? detailStyles.tabActive : {})
              }}
              onClick={() => setActiveTab('versions')}
            >
              Versions
            </div>
            <div
              style={{
                ...detailStyles.tab,
                ...(activeTab === 'steps' ? detailStyles.tabActive : {})
              }}
              onClick={() => setActiveTab('steps')}
            >
              Generated Steps {generatedSteps && <span style={{ 
                backgroundColor: '#0f766e', 
                color: 'white', 
                borderRadius: '10px', 
                padding: '2px 6px', 
                fontSize: '12px', 
                marginLeft: '6px' 
              }}>
                {generatedSteps.plan?.actions?.length || 0}
              </span>}
            </div>
            <div
              style={{
                ...detailStyles.tab,
                ...(activeTab === 'bindings' ? detailStyles.tabActive : {})
              }}
              onClick={() => setActiveTab('bindings')}
            >
              Variables
            </div>
            <div
              style={{
                ...detailStyles.tab,
                ...(activeTab === 'execution-history' ? detailStyles.tabActive : {})
              }}
              onClick={() => setActiveTab('execution-history')}
            >
              Execution History
            </div>
          </div>

          {/* Content */}
          <div style={detailStyles.content}>
            {activeTab === 'overview' && (
              <>
                <div style={detailStyles.descriptionSection}>
                  <h2 style={detailStyles.sectionTitle}>Description</h2>
                  {isEditing ? (
                    <textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '100px',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        resize: 'vertical'
                      }}
                      placeholder="Enter prompt description..."
                    />
                  ) : (
                    <p style={detailStyles.description}>{prompt.description}</p>
                  )}
                </div>

                {(prompt.content || isEditing) && (
                  <div style={detailStyles.contentSection}>
                    <h2 style={detailStyles.sectionTitle}>Content</h2>
                    {isEditing ? (
                      <textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        style={{
                          width: '100%',
                          minHeight: '200px',
                          padding: '12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          resize: 'vertical'
                        }}
                        placeholder="Enter prompt content..."
                      />
                    ) : (
                      <div style={detailStyles.contentBox}>
                        {prompt.content}
                      </div>
                    )}
                  </div>
                )}

                {/* Starting URL Section */}
                <div style={detailStyles.descriptionSection}>
                  <h2 style={detailStyles.sectionTitle}>Starting URL</h2>
                  {isEditing ? (
                    <input
                      type="url"
                      value={editedStartingUrl}
                      onChange={(e) => setEditedStartingUrl(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'inherit'
                      }}
                      placeholder="https://example.com - Enter the URL where the test should start"
                    />
                  ) : (
                    <div style={detailStyles.contentBox}>
                      {prompt.starting_url || 'No starting URL specified'}
                    </div>
                  )}
                </div>

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
                  <h2 style={detailStyles.sectionTitle}>Tags</h2>
                  <div>
                    {prompt.tags.map((tag, index) => (
                      <span 
                        key={index}
                        style={{
                          ...detailStyles.tag,
                          backgroundColor: '#f1f5f9',
                          color: '#475569'
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
              <div>
                <h2 style={detailStyles.sectionTitle}>Versions</h2>
                <p style={detailStyles.description}>Version management coming soon...</p>
              </div>
            )}

            {activeTab === 'steps' && (
              <div>
                <h2 style={detailStyles.sectionTitle}>Generated Test Steps</h2>
                
                {stepsError && (
                  <div style={detailStyles.stepsError}>
                    Error: {stepsError}
                  </div>
                )}
                
                {!generatedSteps && !stepsError && (
                  <div style={detailStyles.description}>
                    Click "Generate Steps" to create executable test steps from this prompt.
                  </div>
                )}
                
                {generatedSteps && (
                  <>
                    {generatedSteps.metadata && (
                      <div style={detailStyles.stepsMetadata}>
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
                      </div>
                    )}
                    
                    {/* Save Test Plan Button */}
                    <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <button
                        onClick={handleSaveTestPlan}
                        disabled={savingTestPlan}
                        style={{
                          ...detailStyles.primaryButton,
                          padding: '10px 20px',
                          fontSize: '14px',
                          fontWeight: '600',
                          opacity: savingTestPlan ? 0.6 : 1,
                          cursor: savingTestPlan ? 'not-allowed' : 'pointer',
                          marginRight: '12px'
                        }}
                      >
                        {savingTestPlan ? ' Saving...' : ' Save Test Plan'}
                      </button>
                      
                      {!isEditingSteps ? (
                        <button
                          onClick={startEditingSteps}
                          style={{
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: '600',
                            backgroundColor: '#f59e0b',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                          }}
                        >
                          ✏️ Edit Steps
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={saveEditedSteps}
                            disabled={savingTestPlan}
                            style={{
                              padding: '10px 20px',
                              fontSize: '14px',
                              fontWeight: '600',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: savingTestPlan ? 'not-allowed' : 'pointer',
                              opacity: savingTestPlan ? 0.6 : 1
                            }}
                          >
                            {savingTestPlan ? 'Saving...' : ' Save Changes'}
                          </button>
                          <button
                            onClick={cancelEditingSteps}
                            style={{
                              padding: '10px 20px',
                              fontSize: '14px',
                              fontWeight: '600',
                              backgroundColor: '#6b7280',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer'
                            }}
                          >
                             Cancel
                          </button>
                        </div>
                      )}
                      
                      {testPlanSaved && (
                        <span style={{
                          color: '#10b981',
                          fontSize: '14px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                           Test plan saved successfully!
                        </span>
                      )}
                    </div>
                    
                    <div style={detailStyles.stepsContainer}>
                      {isEditingSteps && (
                        <div style={{
                          marginBottom: '16px',
                          padding: '12px',
                          backgroundColor: '#fef3c7',
                          border: '1px solid #f59e0b',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>
                            🛠️ Editing Mode: Click any step to edit, or add a new step
                          </span>
                          <button
                            onClick={() => setShowAddStepForm(true)}
                            style={{
                              padding: '8px 16px',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                          >
                            ➕ Add Step
                          </button>
                        </div>
                      )}
                      
                      {(isEditingSteps ? editedSteps : generatedSteps.plan?.actions)?.map((action: any, index: number) => {
                        const hasRealElement = action.params?.selector || action.params?.elementId || action.params?.elementName || action.target;
                        const isEditing = editingStepIndex === index;
                        
                        return (
                          <div key={index} style={{
                            ...hasRealElement ? detailStyles.stepItemWithRealElement : detailStyles.stepItem,
                            border: isEditingSteps ? '2px dashed #d1d5db' : undefined
                          }}>
                            {isEditing ? (
                              <StepEditForm
                                step={action}
<<<<<<< Updated upstream
                                onSave={(updatedStep) => updateStep(index, updatedStep)}
                                onCancel={() => setEditingStepIndex(null)}
=======
                                stepIndex={index}
                                promptId={id || ''}
                                onSave={async (updatedStep) => await updateStep(index, updatedStep)}
                                onCancel={() => setEditingStepIndex(null)}
                                onSyncUpdate={async (stepIndex, paramKey, newValue) => {
                                  try {
                                    await updateStepSelector(stepIndex, paramKey, newValue);
                                  } catch (error) {
                                    throw error;
                                  }
                                }}
>>>>>>> Stashed changes
                              />
                            ) : (
                              <>
                                <div style={detailStyles.stepHeader}>
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span style={detailStyles.stepName}>
                                      {action.name || action.description || `${action.action || 'Action'} on ${action.target || 'element'}`}
                                    </span>
                                    {/* Show action type badge based on action name */}
                                    <span style={{
                                      ...detailStyles.genericElementBadge,
                                      backgroundColor: getActionTypeColor(action.name)
                                    }}>
                                      {getActionTypeLabel(action.name)}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={detailStyles.stepIndex}>Step {action.step || index + 1}</span>
                                    {isEditingSteps && (
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                          onClick={() => setEditingStepIndex(index)}
                                          style={{
                                            padding: '4px 8px',
                                            fontSize: '12px',
                                            backgroundColor: '#3b82f6',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          onClick={() => moveStep(index, index - 1)}
                                          disabled={index === 0}
                                          style={{
                                            padding: '4px 8px',
                                            fontSize: '12px',
                                            backgroundColor: index === 0 ? '#d1d5db' : '#6b7280',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: index === 0 ? 'not-allowed' : 'pointer'
                                          }}
                                        >
                                          ⬆️
                                        </button>
                                        <button
                                          onClick={() => moveStep(index, index + 1)}
                                          disabled={index === editedSteps.length - 1}
                                          style={{
                                            padding: '4px 8px',
                                            fontSize: '12px',
                                            backgroundColor: index === editedSteps.length - 1 ? '#d1d5db' : '#6b7280',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: index === editedSteps.length - 1 ? 'not-allowed' : 'pointer'
                                          }}
                                        >
                                          ⬇️
                                        </button>
                                        <button
                                          onClick={() => deleteStep(index)}
                                          style={{
                                            padding: '4px 8px',
                                            fontSize: '12px',
                                            backgroundColor: '#ef4444',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Display step parameters */}
                                <div style={detailStyles.stepParams}>
                                  {/* Show action type */}
                                  {action.action && (
                                    <div style={detailStyles.stepParamRow}>
                                      <span style={detailStyles.stepParamKey}>action:</span>
                                      <span style={detailStyles.stepParamValue}>{action.action}</span>
                                    </div>
                                  )}
                                  
                                  {/* Show target/selector */}
                                  {action.target && (
                                    <div style={detailStyles.stepParamRow}>
                                      <span style={detailStyles.stepParamKey}>target:</span>
                                      <span style={detailStyles.stepParamValue}>{action.target}</span>
                                    </div>
                                  )}
                                  
                                  {action.selector && (
                                    <div style={detailStyles.stepParamRow}>
                                      <span style={detailStyles.stepParamKey}>selector:</span>
                                      <span style={detailStyles.stepParamValue}>{action.selector}</span>
                                    </div>
                                  )}
                                  
                                  {/* Show value/text */}
                                  {action.value && (
                                    <div style={detailStyles.stepParamRow}>
                                      <span style={detailStyles.stepParamKey}>value:</span>
                                      <span style={detailStyles.stepParamValue}>{action.value}</span>
                                    </div>
                                  )}
                                  
                                  {action.text && (
                                    <div style={detailStyles.stepParamRow}>
                                      <span style={detailStyles.stepParamKey}>text:</span>
                                      <span style={detailStyles.stepParamValue}>{action.text}</span>
                                    </div>
                                  )}
                                  
                                  {/* Show URL for navigation steps */}
                                  {action.url && (
                                    <div style={detailStyles.stepParamRow}>
                                      <span style={detailStyles.stepParamKey}>url:</span>
                                      <span style={detailStyles.stepParamValue}>{action.url}</span>
                                    </div>
                                  )}
                                  
                                  {/* Show expected result */}
                                  {action.expected_result && (
                                    <div style={detailStyles.stepParamRow}>
                                      <span style={detailStyles.stepParamKey}>expected_result:</span>
                                      <span style={detailStyles.stepParamValue}>{action.expected_result}</span>
                                    </div>
                                  )}
                                  
                                  {/* Show any other parameters from the params object */}
                                  {action.params && Object.keys(action.params).length > 0 && (
                                    <>
                                      {Object.entries(action.params).map(([key, value]) => (
                                        <div key={key} style={detailStyles.stepParamRow}>
                                          <span style={detailStyles.stepParamKey}>{key}:</span>
                                          <span style={detailStyles.stepParamValue}>
                                            {typeof value === 'string' ? value : JSON.stringify(value)}
                                          </span>
                                        </div>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                      
                      {showAddStepForm && (
                        <AddStepForm
                          onAdd={addStep}
                          onCancel={() => setShowAddStepForm(false)}
                        />
                      )}
                    </div>
                    
                    {generatedSteps.plan?.meta && (
                      <div style={detailStyles.stepsMetadata}>
                        <strong>Plan Metadata:</strong><br/>
                        Prompt: {generatedSteps.plan.meta.prompt}<br/>
                        Version: {generatedSteps.plan.meta.version}<br/>
                        Generated: {new Date(generatedSteps.plan.meta.generatedAt).toLocaleString()}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'bindings' && (
              <div>
                <h2 style={detailStyles.sectionTitle}>Test Variables</h2>
                <p style={detailStyles.description}>
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
          </div>
        </div>

        {/* History Sidebar */}
        <div style={detailStyles.historySidebar}>
          <div style={detailStyles.sidebarHeader}>History</div>
          
          <div style={detailStyles.historyItem}>
            <div style={detailStyles.historyAction}>Generated steps</div>
            <div style={detailStyles.historyDate}>
              {prompt.created_at ? new Date(prompt.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              }) : 'Invalid Date'}
            </div>
          </div>

          <div style={detailStyles.historyItem}>
            <div style={detailStyles.historyAction}>Prompt created</div>
            <div style={detailStyles.historyDate}>
              {prompt.created_at ? new Date(prompt.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              }) : 'Invalid Date'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};