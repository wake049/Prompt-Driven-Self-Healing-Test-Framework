import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { spinKeyframes } from '../../../shared/styles/keyframes';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Save,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Shield,
  ChevronDown,
  ChevronUp,
  X,
  Monitor,
  Code
} from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import { anonymizeDocument, previewSensitiveData, AnonymizationResult } from '../../../shared/utils/documentAnonymizer';
import { config } from '../../../app/config';

// Test type configuration
interface TestTypeOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  default: boolean;
}

const TEST_TYPE_OPTIONS: TestTypeOption[] = [
  {
    id: 'ui',
    name: 'UI Testing',
    description: 'Browser-based testing with Selenium/Playwright',
    icon: <Monitor size={16} />,
    default: true
  },
  {
    id: 'api',
    name: 'API Testing',
    description: 'REST API endpoint testing (marked with [API] prefix)',
    icon: <Code size={16} />,
    default: false
  }
];

// Helper to convert mappings dict to API list format
const convertMappingsToList = (mappings: Record<string, string>): { placeholder: string; original: string; type: string }[] => {
  return Object.entries(mappings).map(([placeholder, original]) => {
    // Extract type from placeholder like [COMPANY_A] -> COMPANY
    const match = placeholder.match(/\[([A-Z]+)_/);
    const type = match ? match[1] : 'UNKNOWN';
    return { placeholder, original, type };
  });
};

// Helper to normalize happy paths data to array format
// Handles both old format (string) and new format (array)
const normalizeHappyPaths = (data: Record<string, string | string[]> | undefined): Record<string, string[]> => {
  if (!data) return {};
  const result: Record<string, string[]> = {};
  for (const [acId, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      result[acId] = value;
    } else if (typeof value === 'string') {
      result[acId] = [value];
    }
  }
  return result;
};

// Styled Components
const PageContainer = styled.div<{ $isDark: boolean }>`
  padding: 24px;
  min-height: 100vh;
  background: ${props => props.$isDark
    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
    : 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%)'};
`;

const Header = styled.div`
  margin-bottom: 24px;
`;

const Title = styled.h1<{ $isDark: boolean }>`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.$isDark ? '#fff' : '#1a202c'};
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Subtitle = styled.p<{ $isDark: boolean }>`
  color: ${props => props.$isDark ? '#a0aec0' : '#718096'};
  margin: 0;
  font-size: 14px;
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div<{ $isDark: boolean }>`
  background: ${props => props.$isDark ? '#2d3748' : '#fff'};
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const CardTitle = styled.h2<{ $isDark: boolean }>`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.$isDark ? '#fff' : '#1a202c'};
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const UploadZone = styled.div<{ $isDark: boolean; $isDragging: boolean }>`
  border: 2px dashed ${props => props.$isDragging
    ? '#185FA5'
    : props.$isDark ? '#4a5568' : '#e2e8f0'};
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.$isDragging
    ? (props.$isDark ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.05)')
    : 'transparent'};

  &:hover {
    border-color: #185FA5;
    background: ${props => props.$isDark ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.05)'};
  }
`;

const UploadIcon = styled.div<{ $isDark: boolean }>`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: ${props => props.$isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)'};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  color: #185FA5;
`;

const UploadText = styled.p<{ $isDark: boolean }>`
  color: ${props => props.$isDark ? '#e2e8f0' : '#4a5568'};
  margin: 0 0 8px 0;
  font-size: 16px;
`;

const UploadSubtext = styled.p<{ $isDark: boolean }>`
  color: ${props => props.$isDark ? '#a0aec0' : '#718096'};
  margin: 0;
  font-size: 13px;
`;

const HiddenInput = styled.input`
  display: none;
`;

const FileInfo = styled.div<{ $isDark: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: ${props => props.$isDark ? '#1a202c' : '#f7fafc'};
  border-radius: 8px;
  margin-top: 16px;
`;

const FileName = styled.span<{ $isDark: boolean }>`
  flex: 1;
  color: ${props => props.$isDark ? '#e2e8f0' : '#2d3748'};
  font-weight: 500;
`;

const FileSize = styled.span<{ $isDark: boolean }>`
  color: ${props => props.$isDark ? '#a0aec0' : '#718096'};
  font-size: 13px;
`;

const RemoveButton = styled.button<{ $isDark: boolean }>`
  background: transparent;
  border: none;
  color: ${props => props.$isDark ? '#d47070' : '#A32D2D'};
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;

  &:hover {
    opacity: 0.8;
  }
`;

const TextArea = styled.textarea<{ $isDark: boolean }>`
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 1px solid ${props => props.$isDark ? '#4a5568' : '#e2e8f0'};
  border-radius: 8px;
  background: ${props => props.$isDark ? '#1a202c' : '#fff'};
  color: ${props => props.$isDark ? '#e2e8f0' : '#2d3748'};
  font-family: inherit;
  font-size: 14px;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: #185FA5;
  }

  &::placeholder {
    color: ${props => props.$isDark ? '#718096' : '#a0aec0'};
  }
`;

const AnonymizationPanel = styled.div<{ $isDark: boolean }>`
  margin-top: 16px;
  padding: 16px;
  background: ${props => props.$isDark ? '#1a202c' : '#f7fafc'};
  border-radius: 8px;
  border: 1px solid ${props => props.$isDark ? '#4a5568' : '#e2e8f0'};
`;

const AnonymizationHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
`;

const AnonymizationTitle = styled.span<{ $isDark: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${props => props.$isDark ? '#e2e8f0' : '#2d3748'};
  font-weight: 500;
`;

const AnonymizationStats = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
`;

const StatBadge = styled.span<{ $isDark: boolean }>`
  padding: 4px 8px;
  background: ${props => props.$isDark ? '#2d3748' : '#edf2f7'};
  border-radius: 4px;
  font-size: 12px;
  color: ${props => props.$isDark ? '#a0aec0' : '#4a5568'};
`;

const ToggleButton = styled.button<{ $isDark: boolean; $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid ${props => props.$active ? '#185FA5' : (props.$isDark ? '#4a5568' : '#e2e8f0')};
  border-radius: 8px;
  background: ${props => props.$active
    ? 'rgba(102, 126, 234, 0.1)'
    : 'transparent'};
  color: ${props => props.$active ? '#185FA5' : (props.$isDark ? '#e2e8f0' : '#4a5568')};
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;

  &:hover {
    border-color: #185FA5;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
`;

const PrimaryButton = styled.button<{ $isDark: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #185FA5;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const SecondaryButton = styled.button<{ $isDark: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: transparent;
  color: ${props => props.$isDark ? '#e2e8f0' : '#4a5568'};
  border: 1px solid ${props => props.$isDark ? '#4a5568' : '#e2e8f0'};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #185FA5;
    color: #185FA5;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ScenariosList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
`;

const ScenarioCard = styled.div<{ $isDark: boolean }>`
  padding: 16px;
  background: ${props => props.$isDark ? '#1a202c' : '#f7fafc'};
  border-radius: 8px;
  border: 1px solid ${props => props.$isDark ? '#4a5568' : '#e2e8f0'};
`;

const ScenarioTitle = styled.h3<{ $isDark: boolean }>`
  font-size: 15px;
  font-weight: 600;
  color: ${props => props.$isDark ? '#e2e8f0' : '#2d3748'};
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ScenarioDescription = styled.p<{ $isDark: boolean }>`
  color: ${props => props.$isDark ? '#a0aec0' : '#718096'};
  font-size: 13px;
  margin: 0 0 12px 0;
  line-height: 1.5;
`;

const ScenarioTypeBadge = styled.span<{ $type: string }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  margin-right: 8px;

  ${props => {
    switch (props.$type) {
      case 'happy_path':
        return `
          background: rgba(72, 187, 120, 0.15);
          color: #1D9E75;
        `;
      case 'edge_case':
        return `
          background: rgba(237, 137, 54, 0.15);
          color: #ed8936;
        `;
      case 'negative':
        return `
          background: rgba(245, 101, 101, 0.15);
          color: #c85050;
        `;
      default:
        return `
          background: rgba(160, 174, 192, 0.15);
          color: #a0aec0;
        `;
    }
  }}
`;

const ScenarioSteps = styled.ul<{ $isDark: boolean }>`
  margin: 0;
  padding-left: 20px;
  color: ${props => props.$isDark ? '#cbd5e0' : '#4a5568'};
  font-size: 13px;

  li {
    margin-bottom: 4px;
  }
`;

const ScenarioActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const IconButton = styled.button<{ $isDark: boolean; $variant?: 'danger' | 'default' }>`
  padding: 6px;
  background: transparent;
  border: 1px solid ${props => props.$variant === 'danger'
    ? (props.$isDark ? '#d47070' : '#A32D2D')
    : (props.$isDark ? '#4a5568' : '#e2e8f0')};
  border-radius: 6px;
  color: ${props => props.$variant === 'danger'
    ? (props.$isDark ? '#d47070' : '#A32D2D')
    : (props.$isDark ? '#a0aec0' : '#718096')};
  cursor: pointer;
  display: flex;
  align-items: center;

  &:hover {
    background: ${props => props.$variant === 'danger'
      ? 'rgba(229, 62, 62, 0.1)'
      : (props.$isDark ? '#2d3748' : '#edf2f7')};
  }
`;

const StatusMessage = styled.div<{ $isDark: boolean; $type: 'success' | 'error' | 'info' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  background: ${props => {
    if (props.$type === 'success') return props.$isDark ? 'rgba(72, 187, 120, 0.1)' : 'rgba(72, 187, 120, 0.1)';
    if (props.$type === 'error') return props.$isDark ? 'rgba(245, 101, 101, 0.1)' : 'rgba(245, 101, 101, 0.1)';
    return props.$isDark ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.1)';
  }};
  color: ${props => {
    if (props.$type === 'success') return '#1D9E75';
    if (props.$type === 'error') return '#c85050';
    return '#185FA5';
  }};
  font-size: 14px;
`;

const EmptyState = styled.div<{ $isDark: boolean }>`
  text-align: center;
  padding: 48px 24px;
  color: ${props => props.$isDark ? '#a0aec0' : '#718096'};
`;

const LoadingOverlay = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  gap: 16px;
`;

const LoadingText = styled.p<{ $isDark: boolean }>`
  color: ${props => props.$isDark ? '#a0aec0' : '#718096'};
  font-size: 14px;
`;

const FeedbackTextArea = styled.textarea<{ $isDark: boolean }>`
  width: 100%;
  min-height: 100px;
  padding: 12px;
  border: 1px solid ${props => props.$isDark ? '#4a5568' : '#e2e8f0'};
  border-radius: 8px;
  background: ${props => props.$isDark ? '#1a202c' : '#fff'};
  color: ${props => props.$isDark ? '#e2e8f0' : '#2d3748'};
  font-family: inherit;
  font-size: 14px;
  resize: vertical;
  margin-top: 12px;

  &:focus {
    outline: none;
    border-color: #185FA5;
  }
`;

// Test Type Selection Components
const TestTypePanel = styled.div<{ $isDark: boolean }>`
  margin-top: 16px;
  padding: 16px;
  background: ${props => props.$isDark ? '#1a202c' : '#f7fafc'};
  border-radius: 8px;
  border: 1px solid ${props => props.$isDark ? '#4a5568' : '#e2e8f0'};
`;

const TestTypePanelTitle = styled.div<{ $isDark: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${props => props.$isDark ? '#e2e8f0' : '#2d3748'};
  font-weight: 500;
  margin-bottom: 12px;
`;

const TestTypeOptions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const TestTypeCheckbox = styled.label<{ $isDark: boolean; $selected: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  border: 2px solid ${props => props.$selected
    ? '#185FA5'
    : (props.$isDark ? '#4a5568' : '#e2e8f0')};
  background: ${props => props.$selected
    ? (props.$isDark ? 'rgba(102, 126, 234, 0.15)' : 'rgba(102, 126, 234, 0.08)')
    : 'transparent'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #185FA5;
    background: ${props => props.$isDark ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.05)'};
  }
`;

const TestTypeCheckboxInput = styled.input`
  width: 18px;
  height: 18px;
  margin-top: 2px;
  accent-color: #185FA5;
`;

const TestTypeInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
`;

const TestTypeName = styled.span<{ $isDark: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: ${props => props.$isDark ? '#e2e8f0' : '#2d3748'};
  font-size: 14px;
`;

const TestTypeDescription = styled.span<{ $isDark: boolean }>`
  color: ${props => props.$isDark ? '#a0aec0' : '#718096'};
  font-size: 12px;
  line-height: 1.4;
`;

const TestTypeNote = styled.p<{ $isDark: boolean }>`
  margin: 12px 0 0 0;
  padding: 8px 12px;
  background: ${props => props.$isDark ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.05)'};
  border-radius: 6px;
  font-size: 12px;
  color: ${props => props.$isDark ? '#a0aec0' : '#718096'};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TestTypeBadge = styled.span<{ $type: 'ui' | 'api' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;

  ${props => props.$type === 'api' ? `
    background: rgba(102, 126, 234, 0.15);
    color: #185FA5;
  ` : `
    background: rgba(72, 187, 120, 0.15);
    color: #1D9E75;
  `}
`;

// Types
interface AcceptanceCriterion {
  id: string;
  description: string;
}

interface TestScenario {
  id: string;
  title: string;
  description: string;
  steps: string[];
  preconditions?: string[];
  expected_result?: string;
  type?: 'happy_path' | 'edge_case' | 'negative';
  category?: string;
  priority?: string;
  tags?: string[];
  covers_ac?: string[];  // Which ACs this scenario covers
  derived_from?: string | null;  // Base scenario ID for parameterized variants
  data_variant?: string | null;  // What specific value this variant tests
}

interface GenerationState {
  status: 'idle' | 'uploading' | 'processing' | 'refining' | 'saving';
  scenarios: TestScenario[];
  acceptanceCriteria: AcceptanceCriterion[];
  acCoverageMatrix: Record<string, string[]>;  // AC ID -> scenario IDs
  happyPathsPerAc: Record<string, string[]>;  // AC ID -> happy path scenario IDs (array for multi-value ACs)
  error: string | null;
  success: string | null;
}

// Main Component
export function DocumentToTestsPage() {
  const { isDark } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [file, setFile] = useState<File | null>(null);
  const [documentText, setDocumentText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [useAnonymization, setUseAnonymization] = useState(true);
  const [showAnonymizationDetails, setShowAnonymizationDetails] = useState(false);
  const [anonymizationResult, setAnonymizationResult] = useState<AnonymizationResult | null>(null);
  const [sensitiveDataPreview, setSensitiveDataPreview] = useState<{ type: string; count: number; samples: string[] }[]>([]);
  const [feedback, setFeedback] = useState('');
  const [selectedTestTypes, setSelectedTestTypes] = useState<string[]>(['ui']); // Default to UI testing
  const [state, setState] = useState<GenerationState>({
    status: 'idle',
    scenarios: [],
    acceptanceCriteria: [],
    acCoverageMatrix: {},
    happyPathsPerAc: {},
    error: null,
    success: null
  });

  // File handling
  const handleFileSelect = useCallback((selectedFile: File) => {
    const allowedTypes = ['.txt', '.md', '.pdf', '.docx', '.pptx', '.ppt'];
    const extension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();

    if (!allowedTypes.includes(extension)) {
      setState(prev => ({ ...prev, error: 'Unsupported file type. Please upload .txt, .md, .pdf, .docx, or .pptx files.' }));
      return;
    }

    setFile(selectedFile);
    setState(prev => ({ ...prev, error: null }));

    // Read text files directly
    if (extension === '.txt' || extension === '.md') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setDocumentText(text);

        // Preview sensitive data
        const preview = previewSensitiveData(text);
        setSensitiveDataPreview(preview);
      };
      reader.readAsText(selectedFile);
    } else {
      // For PDF/DOCX, we'll send to server for extraction
      setDocumentText('');
      setSensitiveDataPreview([]);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  }, [handleFileSelect]);

  const removeFile = useCallback(() => {
    setFile(null);
    setDocumentText('');
    setAnonymizationResult(null);
    setSensitiveDataPreview([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Text change handling
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setDocumentText(text);

    // Update sensitive data preview
    if (text.length > 50) {
      const preview = previewSensitiveData(text);
      setSensitiveDataPreview(preview);
    } else {
      setSensitiveDataPreview([]);
    }
  }, []);

  // Test type toggle handler
  const handleTestTypeToggle = useCallback((typeId: string) => {
    setSelectedTestTypes(prev => {
      if (prev.includes(typeId)) {
        // Don't allow deselecting all - must have at least one
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== typeId);
      } else {
        return [...prev, typeId];
      }
    });
  }, []);

  // Generate scenarios
  const handleGenerate = useCallback(async () => {
    if (!documentText && !file) {
      setState(prev => ({ ...prev, error: 'Please upload a document or enter text.' }));
      return;
    }

    setState(prev => ({ ...prev, status: 'processing', error: null, success: null }));

    try {
      const token = localStorage.getItem('auth_token');
      let data;

      // If we have a file but no extracted text (e.g., .docx, .pdf), use upload endpoint
      if (file && !documentText) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('save_as_prompts', 'false');
        formData.append('starting_url', '');
        formData.append('test_types', selectedTestTypes.join(','));

        const response = await fetch(`${config.apiBaseUrl}/api/v1/document-to-tests/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Failed to upload document: ${response.statusText}`);
        }
        data = await response.json();
      } else {
        // Use text content (from paste or .txt/.md file)
        let textToProcess = documentText;
        let mappings: Record<string, string> = {};

        // Anonymize if enabled
        if (useAnonymization && textToProcess) {
          const result = anonymizeDocument(textToProcess);
          textToProcess = result.anonymizedText;
          mappings = result.mappings;
          setAnonymizationResult(result);
        }

        const mappingsList = convertMappingsToList(mappings);

        const response = await fetch(`${config.apiBaseUrl}/api/v1/document-to-tests/generate-from-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            content: textToProcess,
            document_name: file?.name || 'pasted-text',
            test_types: selectedTestTypes,
            anonymization_mappings: mappingsList.length > 0 ? mappingsList : undefined,
            deanonymize_response: true
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Failed to generate scenarios: ${response.statusText}`);
        }
        data = await response.json();
      }

      setState(prev => ({
        ...prev,
        status: 'idle',
        scenarios: data.scenarios || [],
        acceptanceCriteria: data.acceptance_criteria || [],
        acCoverageMatrix: data.ac_coverage_matrix || {},
        happyPathsPerAc: normalizeHappyPaths(data.happy_paths_per_ac || data.happy_path_per_ac),
        success: `Generated ${data.scenarios?.length || 0} test scenarios covering ${data.acceptance_criteria?.length || 0} acceptance criteria`
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'idle',
        error: error instanceof Error ? error.message : 'Failed to generate scenarios'
      }));
    }
  }, [documentText, file, useAnonymization]);

  // Refine scenarios
  const handleRefine = useCallback(async () => {
    if (!feedback.trim()) {
      setState(prev => ({ ...prev, error: 'Please enter feedback for refinement.' }));
      return;
    }

    setState(prev => ({ ...prev, status: 'refining', error: null, success: null }));

    try {
      const token = localStorage.getItem('auth_token');
      const mappingsList = anonymizationResult?.mappings
        ? convertMappingsToList(anonymizationResult.mappings)
        : [];

      const response = await fetch(`${config.apiBaseUrl}/api/v1/document-to-tests/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scenarios: state.scenarios,
          feedback: feedback,
          document_summary: documentText.slice(0, 500),
          anonymization_mappings: mappingsList.length > 0 ? mappingsList : undefined,
          deanonymize_response: true
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to refine scenarios: ${response.statusText}`);
      }
      const data = await response.json();

      setState(prev => ({
        ...prev,
        status: 'idle',
        scenarios: data.scenarios || prev.scenarios,
        acceptanceCriteria: data.acceptance_criteria || prev.acceptanceCriteria,
        acCoverageMatrix: data.ac_coverage_matrix || prev.acCoverageMatrix,
        happyPathsPerAc: normalizeHappyPaths(data.happy_paths_per_ac || data.happy_path_per_ac) || prev.happyPathsPerAc,
        success: data.message || 'Scenarios refined successfully'
      }));
      setFeedback('');
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'idle',
        error: error instanceof Error ? error.message : 'Failed to refine scenarios'
      }));
    }
  }, [feedback, state.scenarios, documentText, anonymizationResult]);

  // Save scenarios
  const handleSave = useCallback(async () => {
    if (state.scenarios.length === 0) {
      setState(prev => ({ ...prev, error: 'No scenarios to save.' }));
      return;
    }

    setState(prev => ({ ...prev, status: 'saving', error: null, success: null }));

    try {
      const token = localStorage.getItem('auth_token');
      const mappingsList = anonymizationResult?.mappings
        ? convertMappingsToList(anonymizationResult.mappings)
        : [];

      const response = await fetch(`${config.apiBaseUrl}/api/v1/document-to-tests/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scenarios: state.scenarios,
          document_name: file?.name || 'document',
          starting_url: '',
          anonymization_mappings: mappingsList.length > 0 ? mappingsList : undefined,
          deanonymize_before_save: true
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save scenarios: ${response.statusText}`);
      }
      const data = await response.json();

      setState(prev => ({
        ...prev,
        status: 'idle',
        success: `Saved ${data.saved_count || state.scenarios.length} scenarios as prompts`
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'idle',
        error: error instanceof Error ? error.message : 'Failed to save scenarios'
      }));
    }
  }, [state.scenarios, file, anonymizationResult]);

  // Remove scenario
  const removeScenario = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      scenarios: prev.scenarios.filter(s => s.id !== id)
    }));
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isProcessing = state.status !== 'idle';

  return (
    <PageContainer $isDark={isDark}>
      <Header>
        <Title $isDark={isDark}>
          <FileText size={28} />
          Document to Test Scenarios
        </Title>
        <Subtitle $isDark={isDark}>
          Upload business documents and let AI generate comprehensive test scenarios automatically
        </Subtitle>
      </Header>

      {state.error && (
        <StatusMessage $isDark={isDark} $type="error">
          <AlertCircle size={16} />
          {state.error}
          <X
            size={14}
            style={{ marginLeft: 'auto', cursor: 'pointer' }}
            onClick={() => setState(prev => ({ ...prev, error: null }))}
          />
        </StatusMessage>
      )}

      {state.success && (
        <StatusMessage $isDark={isDark} $type="success">
          <CheckCircle size={16} />
          {state.success}
          <X
            size={14}
            style={{ marginLeft: 'auto', cursor: 'pointer' }}
            onClick={() => setState(prev => ({ ...prev, success: null }))}
          />
        </StatusMessage>
      )}

      <ContentGrid>
        {/* Left Column - Upload */}
        <Card $isDark={isDark}>
          <CardTitle $isDark={isDark}>
            <Upload size={18} />
            Upload Document
          </CardTitle>

          <UploadZone
            $isDark={isDark}
            $isDragging={isDragging}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon $isDark={isDark}>
              <Upload size={28} />
            </UploadIcon>
            <UploadText $isDark={isDark}>
              Drop your document here or click to browse
            </UploadText>
            <UploadSubtext $isDark={isDark}>
              Supports .txt, .md, .pdf, .docx, .pptx (max 10MB)
            </UploadSubtext>
          </UploadZone>

          <HiddenInput
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,.docx,.pptx,.ppt"
            onChange={handleFileInputChange}
          />

          {file && (
            <FileInfo $isDark={isDark}>
              <FileText size={20} color="#185FA5" />
              <FileName $isDark={isDark}>{file.name}</FileName>
              <FileSize $isDark={isDark}>{formatFileSize(file.size)}</FileSize>
              <RemoveButton $isDark={isDark} onClick={removeFile}>
                <X size={16} />
              </RemoveButton>
            </FileInfo>
          )}

          <CardTitle $isDark={isDark} style={{ marginTop: 24 }}>
            Or paste text directly
          </CardTitle>

          <TextArea
            $isDark={isDark}
            value={documentText}
            onChange={handleTextChange}
            placeholder="Paste your requirements document, user story, or business specification here..."
          />

          {/* Anonymization Panel */}
          <AnonymizationPanel $isDark={isDark}>
            <AnonymizationHeader onClick={() => setShowAnonymizationDetails(!showAnonymizationDetails)}>
              <AnonymizationTitle $isDark={isDark}>
                <Shield size={16} color="#185FA5" />
                Data Protection
                {showAnonymizationDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </AnonymizationTitle>
              <ToggleButton
                $isDark={isDark}
                $active={useAnonymization}
                onClick={(e) => {
                  e.stopPropagation();
                  setUseAnonymization(!useAnonymization);
                }}
              >
                {useAnonymization ? <Eye size={14} /> : <EyeOff size={14} />}
                {useAnonymization ? 'Anonymization ON' : 'Anonymization OFF'}
              </ToggleButton>
            </AnonymizationHeader>

            {showAnonymizationDetails && sensitiveDataPreview.length > 0 && (
              <AnonymizationStats>
                {sensitiveDataPreview.map((item, idx) => (
                  <StatBadge key={idx} $isDark={isDark}>
                    {item.type}: {item.count} found
                  </StatBadge>
                ))}
              </AnonymizationStats>
            )}

            {showAnonymizationDetails && (
              <p style={{
                fontSize: 12,
                color: isDark ? '#a0aec0' : '#718096',
                marginTop: 8,
                marginBottom: 0
              }}>
                {useAnonymization
                  ? 'Sensitive data (company names, amounts, emails, etc.) will be replaced with placeholders before sending to AI.'
                  : 'Document will be sent to AI as-is. Enable anonymization to protect sensitive information.'}
              </p>
            )}
          </AnonymizationPanel>

          {/* Test Type Selection Panel */}
          <TestTypePanel $isDark={isDark}>
            <TestTypePanelTitle $isDark={isDark}>
              <Monitor size={16} color="#185FA5" />
              Test Type Selection
            </TestTypePanelTitle>
            <TestTypeOptions>
              {TEST_TYPE_OPTIONS.map(option => (
                <TestTypeCheckbox
                  key={option.id}
                  $isDark={isDark}
                  $selected={selectedTestTypes.includes(option.id)}
                >
                  <TestTypeCheckboxInput
                    type="checkbox"
                    checked={selectedTestTypes.includes(option.id)}
                    onChange={() => handleTestTypeToggle(option.id)}
                  />
                  <TestTypeInfo>
                    <TestTypeName $isDark={isDark}>
                      {option.icon}
                      {option.name}
                      {option.default && (
                        <StatBadge $isDark={isDark} style={{ marginLeft: 8, fontSize: 10 }}>
                          Default
                        </StatBadge>
                      )}
                    </TestTypeName>
                    <TestTypeDescription $isDark={isDark}>
                      {option.description}
                    </TestTypeDescription>
                  </TestTypeInfo>
                </TestTypeCheckbox>
              ))}
            </TestTypeOptions>
            {selectedTestTypes.includes('api') && (
              <TestTypeNote $isDark={isDark}>
                <Code size={14} />
                API test scenarios will be prefixed with [API] in the title for easy identification
              </TestTypeNote>
            )}
          </TestTypePanel>

          <ButtonGroup>
            <PrimaryButton
              $isDark={isDark}
              onClick={handleGenerate}
              disabled={isProcessing || (!documentText && !file)}
            >
              {state.status === 'processing' ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Generate Scenarios
                </>
              )}
            </PrimaryButton>
          </ButtonGroup>
        </Card>

        {/* Right Column - Results */}
        <Card $isDark={isDark}>
          <CardTitle $isDark={isDark}>
            <CheckCircle size={18} />
            Generated Test Scenarios
            {state.scenarios.length > 0 && (
              <span style={{
                marginLeft: 'auto',
                fontSize: 13,
                fontWeight: 400,
                color: isDark ? '#a0aec0' : '#718096'
              }}>
                {state.scenarios.length} scenarios
              </span>
            )}
          </CardTitle>

          {state.status === 'processing' && (
            <LoadingOverlay>
              <Loader2 size={32} color="#185FA5" className="spin" />
              <LoadingText $isDark={isDark}>
                Analyzing document and generating test scenarios...
              </LoadingText>
            </LoadingOverlay>
          )}

          {state.status === 'idle' && state.scenarios.length === 0 && (
            <EmptyState $isDark={isDark}>
              <FileText size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
              <p style={{ margin: 0 }}>
                No scenarios generated yet. Upload a document or paste text to get started.
              </p>
            </EmptyState>
          )}

          {state.scenarios.length > 0 && (
            <>
              {/* Acceptance Criteria Coverage Summary */}
              {state.acceptanceCriteria.length > 0 && (
                <div style={{
                  marginBottom: 20,
                  padding: 16,
                  background: isDark ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.05)',
                  borderRadius: 8,
                  border: `1px solid ${isDark ? 'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.2)'}`
                }}>
                  <h4 style={{
                    margin: '0 0 12px 0',
                    color: isDark ? '#e2e8f0' : '#2d3748',
                    fontSize: 14,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <CheckCircle size={16} color="#1D9E75" />
                    Acceptance Criteria Coverage ({state.acceptanceCriteria.length} found)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {state.acceptanceCriteria.map(ac => {
                      const coveringScenarios = state.acCoverageMatrix[ac.id] || [];
                      const happyPaths = state.happyPathsPerAc[ac.id] || [];
                      const hasHappyPath = happyPaths.length > 0;
                      const isCovered = coveringScenarios.length > 0;
                      return (
                        <div
                          key={ac.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: 8,
                            background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.8)',
                            borderRadius: 6,
                            border: !hasHappyPath ? '1px solid rgba(245, 101, 101, 0.5)' : 'none'
                          }}
                        >
                          {hasHappyPath ? (
                            <CheckCircle size={14} color="#1D9E75" style={{ flexShrink: 0, marginTop: 2 }} />
                          ) : isCovered ? (
                            <AlertCircle size={14} color="#ed8936" style={{ flexShrink: 0, marginTop: 2 }} />
                          ) : (
                            <AlertCircle size={14} color="#c85050" style={{ flexShrink: 0, marginTop: 2 }} />
                          )}
                          <div style={{ flex: 1 }}>
                            <span style={{
                              fontWeight: 600,
                              color: '#185FA5',
                              fontSize: 12
                            }}>{ac.id}:</span>
                            <span style={{
                              marginLeft: 6,
                              color: isDark ? '#cbd5e0' : '#4a5568',
                              fontSize: 12
                            }}>{ac.description}</span>
                            <div style={{
                              marginTop: 4,
                              fontSize: 11,
                              color: isDark ? '#a0aec0' : '#718096'
                            }}>
                              {hasHappyPath
                                ? `✓ ${happyPaths.length} Happy Path${happyPaths.length > 1 ? 's' : ''}: ${happyPaths.join(', ')}${coveringScenarios.length > happyPaths.length ? ` + ${coveringScenarios.length - happyPaths.length} other${coveringScenarios.length - happyPaths.length > 1 ? 's' : ''}` : ''}`
                                : isCovered
                                  ? `⚠ Has ${coveringScenarios.length} scenario${coveringScenarios.length > 1 ? 's' : ''} but NO HAPPY PATH`
                                  : '✗ Not covered - add scenarios'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <ScenariosList>
                {state.scenarios.map((scenario, index) => {
                  const isApiTest = scenario.title?.startsWith('[API]') || scenario.tags?.includes('api');
                  return (
                  <ScenarioCard key={scenario.id} $isDark={isDark}>
                    <ScenarioTitle $isDark={isDark}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                        {isApiTest && (
                          <TestTypeBadge $type="api">
                            <Code size={10} /> API
                          </TestTypeBadge>
                        )}
                        {!isApiTest && (
                          <TestTypeBadge $type="ui">
                            <Monitor size={10} /> UI
                          </TestTypeBadge>
                        )}
                        <ScenarioTypeBadge $type={scenario.type || 'happy_path'}>
                          {(scenario.type || 'happy_path').replace('_', ' ')}
                        </ScenarioTypeBadge>
                        <span>{index + 1}. {scenario.title}</span>
                      </div>
                      <IconButton
                        $isDark={isDark}
                        $variant="danger"
                        onClick={() => removeScenario(scenario.id)}
                        title="Remove scenario"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </ScenarioTitle>
                    <ScenarioDescription $isDark={isDark}>
                      {scenario.description}
                    </ScenarioDescription>
                    {scenario.expected_result && (
                      <ScenarioDescription $isDark={isDark} style={{ fontStyle: 'italic' }}>
                        <strong>Expected:</strong> {scenario.expected_result}
                      </ScenarioDescription>
                    )}
                    {scenario.steps && scenario.steps.length > 0 && (
                      <ScenarioSteps $isDark={isDark}>
                        {(Array.isArray(scenario.steps) ? scenario.steps : [scenario.steps]).map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ScenarioSteps>
                    )}
                    {scenario.covers_ac && scenario.covers_ac.length > 0 && (
                      <div style={{
                        marginTop: 8,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 4
                      }}>
                        <span style={{
                          fontSize: 11,
                          color: isDark ? '#a0aec0' : '#718096',
                          marginRight: 4
                        }}>Covers:</span>
                        {scenario.covers_ac.map(ac => (
                          <span
                            key={ac}
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: isDark ? 'rgba(102, 126, 234, 0.2)' : 'rgba(102, 126, 234, 0.1)',
                              color: '#185FA5',
                              fontWeight: 500
                            }}
                          >
                            {ac}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Traceability info for parameterized scenarios */}
                    {(scenario.data_variant || scenario.derived_from) && (
                      <div style={{
                        marginTop: 8,
                        padding: '6px 10px',
                        background: isDark ? 'rgba(237, 137, 54, 0.1)' : 'rgba(237, 137, 54, 0.05)',
                        borderRadius: 4,
                        borderLeft: '3px solid #ed8936',
                        fontSize: 11,
                        color: isDark ? '#cbd5e0' : '#4a5568'
                      }}>
                        {scenario.data_variant && (
                          <div><strong>Variant:</strong> {scenario.data_variant}</div>
                        )}
                        {scenario.derived_from && (
                          <div style={{ marginTop: 2 }}><strong>Derived from:</strong> {scenario.derived_from}</div>
                        )}
                      </div>
                    )}
                  </ScenarioCard>
                  );
                })}
              </ScenariosList>

              {/* Refinement Section */}
              <div style={{ marginTop: 24 }}>
                <CardTitle $isDark={isDark} style={{ fontSize: 15 }}>
                  <RefreshCw size={16} />
                  Refine Scenarios
                </CardTitle>
                <FeedbackTextArea
                  $isDark={isDark}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Enter feedback to refine scenarios. E.g., 'Add more edge cases', 'Focus on error handling', 'Remove scenario 3'..."
                />
                <ButtonGroup>
                  <SecondaryButton
                    $isDark={isDark}
                    onClick={handleRefine}
                    disabled={isProcessing || !feedback.trim()}
                  >
                    {state.status === 'refining' ? (
                      <>
                        <Loader2 size={14} className="spin" />
                        Refining...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        Refine with Feedback
                      </>
                    )}
                  </SecondaryButton>
                  <PrimaryButton
                    $isDark={isDark}
                    onClick={handleSave}
                    disabled={isProcessing}
                  >
                    {state.status === 'saving' ? (
                      <>
                        <Loader2 size={14} className="spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        Save as Prompts
                      </>
                    )}
                  </PrimaryButton>
                </ButtonGroup>
              </div>
            </>
          )}
        </Card>
      </ContentGrid>
    </PageContainer>
  );
}
