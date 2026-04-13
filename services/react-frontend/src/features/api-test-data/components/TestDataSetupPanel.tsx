/**
 * Test Data Setup Panel Component
 * Allows testers to:
 * - Create test data setups combining templates with variable values
 * - Link setups to prompts (tests)
 * - Execute setups to preview extracted variables
 * - View execution history
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { 
  Plus, Edit2, Trash2, Layers, ChevronDown, ChevronUp, Check, X, 
  Play, Link2, Unlink, Clock, CheckCircle, XCircle, ArrowRight,
  RefreshCw, Copy
} from 'lucide-react';
import apiTestDataService, { 
  TestDataSetup,
  TestDataSetupCreate,
  DataTemplate,
  DataSet,
  ExecuteSetupsResponse,
  ExecutionHistoryItem,
  OutputVariable
} from '../../../services/apiTestDataService';

// Styled Components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #185FA5;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const TabRow = styled.div`
  display: flex;
  gap: 4px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const Tab = styled.button<{ $active: boolean }>`
  padding: 12px 20px;
  background: transparent;
  border: none;
  border-bottom: 2px solid ${props => props.$active ? '#185FA5' : 'transparent'};
  color: ${props => props.$active ? '#185FA5' : props.theme.colors.textSecondary};
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    color: #185FA5;
  }
`;

const SetupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const SetupCard = styled.div<{ $isEditing?: boolean }>`
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.$isEditing ? '#185FA5' : props.theme.colors.border};
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
  
  ${props => props.$isEditing && `
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  `}
`;

const SetupHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  
  &:hover {
    background: ${props => props.theme.colors.hover};
  }
`;

const SetupInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const OrderBadge = styled.span`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #185FA5;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
`;

const SetupDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SetupName = styled.span`
  font-weight: 600;
  font-size: 16px;
  color: ${props => props.theme.colors.text};
`;

const SetupMeta = styled.span`
  font-size: 13px;
  color: ${props => props.theme.colors.textSecondary};
`;

const SetupActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ActionButton = styled.button<{ $variant?: 'danger' | 'primary' | 'success' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  background: ${props => {
    if (props.$variant === 'danger') return 'rgba(229, 62, 62, 0.1)';
    if (props.$variant === 'primary') return 'rgba(102, 126, 234, 0.1)';
    if (props.$variant === 'success') return 'rgba(72, 187, 120, 0.1)';
    return props.theme.colors.hover;
  }};
  
  color: ${props => {
    if (props.$variant === 'danger') return '#A32D2D';
    if (props.$variant === 'primary') return '#185FA5';
    if (props.$variant === 'success') return '#1D9E75';
    return props.theme.colors.textSecondary;
  }};
  
  &:hover {
    transform: scale(1.05);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const ExpandedContent = styled.div`
  padding: 0 20px 20px 20px;
  border-top: 1px solid ${props => props.theme.colors.border};
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FormGroupFull = styled(FormGroup)`
  grid-column: 1 / -1;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: ${props => props.theme.colors.textSecondary};
`;

const Input = styled.input`
  padding: 10px 14px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 14px;
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #185FA5;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  }
`;

const Select = styled.select`
  padding: 10px 14px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 14px;
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: #185FA5;
  }
`;

const TextArea = styled.textarea`
  padding: 10px 14px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 14px;
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  font-family: 'Monaco', 'Menlo', monospace;
  resize: vertical;
  min-height: 100px;
  
  &:focus {
    outline: none;
    border-color: #185FA5;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  }
`;

const HelperText = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid ${props => props.theme.colors.border};
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'success' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  ${props => props.$variant === 'primary' ? `
    background: #185FA5;
    color: white;
    border: none;
  ` : props.$variant === 'success' ? `
    background: linear-gradient(135deg, #1D9E75 0%, #1D9E75 100%);
    color: white;
    border: none;
  ` : `
    background: transparent;
    color: ${props.theme.colors.textSecondary};
    border: 1px solid ${props.theme.colors.border};
  `}
  
  &:hover {
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  background: ${props => props.theme.colors.background};
  border-radius: 12px;
  border: 2px dashed ${props => props.theme.colors.border};
`;

const EmptyIcon = styled.div`
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  background: ${props => props.theme.colors.hover};
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme.colors.textSecondary};
`;

const EmptyTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 8px 0;
`;

const EmptyText = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0 0 20px 0;
`;

const ExecutionResult = styled.div<{ $success: boolean }>`
  padding: 16px;
  background: ${props => props.$success ? 'rgba(72, 187, 120, 0.1)' : 'rgba(229, 62, 62, 0.1)'};
  border: 1px solid ${props => props.$success ? '#1D9E75' : '#A32D2D'};
  border-radius: 10px;
  margin-top: 16px;
`;

const ResultHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
`;

const ResultTitle = styled.span<{ $success: boolean }>`
  font-weight: 600;
  color: ${props => props.$success ? '#1D9E75' : '#c53030'};
`;

const VariablesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const VariableItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: ${props => props.theme.colors.surface};
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
`;

const VariableName = styled.span`
  color: #185FA5;
  font-weight: 600;
`;

const VariableValue = styled.span`
  color: ${props => props.theme.colors.text};
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const HistoryItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
`;

const HistoryIcon = styled.div<{ $success: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$success ? 'rgba(72, 187, 120, 0.15)' : 'rgba(229, 62, 62, 0.15)'};
  color: ${props => props.$success ? '#1D9E75' : '#A32D2D'};
`;

const HistoryDetails = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const HistoryName = styled.span`
  font-weight: 600;
  font-size: 14px;
  color: ${props => props.theme.colors.text};
`;

const HistoryMeta = styled.span`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
`;

const NumberInput = styled(Input)`
  width: 80px;
`;

// Types
interface SetupFormData {
  name: string;
  description: string;
  execution_order: number;
  template_id: string;
  data_set_id: string;
  custom_variables: Record<string, any>;
  output_variables: OutputVariable[];
  is_active: boolean;
}

const defaultFormData: SetupFormData = {
  name: '',
  description: '',
  execution_order: 1,
  template_id: '',
  data_set_id: '',
  custom_variables: {},
  output_variables: [],
  is_active: true,
};

type ViewTab = 'setups' | 'history';

const TestDataSetupPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ViewTab>('setups');
  const [setups, setSetups] = useState<TestDataSetup[]>([]);
  const [templates, setTemplates] = useState<DataTemplate[]>([]);
  const [dataSets, setDataSets] = useState<DataSet[]>([]);
  const [history, setHistory] = useState<ExecutionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<SetupFormData>(defaultFormData);
  const [variablesJson, setVariablesJson] = useState('{}');
  const [executing, setExecuting] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecuteSetupsResponse | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [setupData, templateData] = await Promise.all([
        apiTestDataService.setups.list(),
        apiTestDataService.templates.list({ is_active: true }),
      ]);
      setSetups(setupData);
      setTemplates(templateData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const historyData = await apiTestDataService.execution.getHistory({ limit: 50 });
      setHistory(historyData);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  }, []);

  const fetchDataSetsForTemplate = useCallback(async (templateId: string) => {
    if (!templateId) {
      setDataSets([]);
      return;
    }
    try {
      const data = await apiTestDataService.dataSets.list(templateId);
      setDataSets(data);
    } catch (error) {
      console.error('Failed to fetch data sets:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  useEffect(() => {
    if (formData.template_id) {
      fetchDataSetsForTemplate(formData.template_id);
    }
  }, [formData.template_id, fetchDataSetsForTemplate]);

  const handleCreate = () => {
    const nextOrder = setups.length > 0 
      ? Math.max(...setups.map(s => s.execution_order)) + 1 
      : 1;
    
    setFormData({
      ...defaultFormData,
      execution_order: nextOrder,
      template_id: templates[0]?.id || '',
    });
    setVariablesJson('{}');
    setIsCreating(true);
    setEditingId(null);
    setExpandedId('new');
    setExecutionResult(null);
  };

  const handleEdit = (setup: TestDataSetup) => {
    setFormData({
      name: setup.name,
      description: setup.description || '',
      execution_order: setup.execution_order,
      template_id: setup.template_id,
      data_set_id: setup.data_set_id || '',
      custom_variables: setup.custom_variables || {},
      output_variables: setup.output_variables || [],
      is_active: setup.is_active,
    });
    setVariablesJson(JSON.stringify(setup.custom_variables || {}, null, 2));
    setEditingId(setup.id);
    setIsCreating(false);
    setExpandedId(setup.id);
    setExecutionResult(null);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setExpandedId(null);
    setFormData(defaultFormData);
    setExecutionResult(null);
  };

  const handleSave = async () => {
    try {
      let parsedVariables = {};
      try {
        parsedVariables = JSON.parse(variablesJson);
      } catch {
        parsedVariables = {};
      }

      const payload: TestDataSetupCreate = {
        name: formData.name,
        description: formData.description || undefined,
        execution_order: formData.execution_order,
        template_id: formData.template_id,
        data_set_id: formData.data_set_id || undefined,
        custom_variables: parsedVariables,
        output_variables: formData.output_variables,
        is_active: formData.is_active,
      };

      if (isCreating) {
        await apiTestDataService.setups.create(payload);
      } else if (editingId) {
        await apiTestDataService.setups.update(editingId, payload);
      }

      await fetchData();
      handleCancel();
    } catch (error) {
      console.error('Failed to save setup:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this setup?')) return;
    
    try {
      await apiTestDataService.setups.delete(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete setup:', error);
    }
  };

  const handleExecute = async (setupId: string) => {
    try {
      setExecuting(setupId);
      setExecutionResult(null);
      
      const result = await apiTestDataService.execution.execute({
        setup_id: setupId
      });
      
      setExecutionResult(result);
      setExpandedId(setupId);
      
      // Refresh history
      if (activeTab === 'history') {
        await fetchHistory();
      }
    } catch (error) {
      console.error('Failed to execute setup:', error);
      setExecutionResult({
        success: false,
        total_setups: 1,
        successful_setups: 0,
        failed_setups: 1,
        results: [{
          setup_id: setupId,
          setup_name: '',
          success: false,
          request_url: '',
          request_method: '',
          duration_ms: 0,
          extracted_variables: {},
          error_message: String(error)
        }],
        combined_variables: {},
        execution_time_ms: 0
      });
    } finally {
      setExecuting(null);
    }
  };

  const toggleExpand = (id: string) => {
    if (editingId || isCreating) return;
    setExpandedId(expandedId === id ? null : id);
    if (expandedId !== id) {
      setExecutionResult(null);
    }
  };

  const copyVariables = (variables: Record<string, string>) => {
    const text = Object.entries(variables)
      .map(([k, v]) => `\${${k}} = ${v}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  const renderSetupForm = (isNew: boolean = false) => {
    const selectedTemplate = templates.find(t => t.id === formData.template_id);
    
    return (
      <ExpandedContent>
        <FormGrid>
          <FormGroup>
            <Label>Setup Name *</Label>
            <Input
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Create Test Booking"
            />
          </FormGroup>

          <FormGroup>
            <Label>Execution Order</Label>
            <NumberInput
              type="number"
              min={1}
              value={formData.execution_order}
              onChange={e => setFormData(prev => ({ ...prev, execution_order: parseInt(e.target.value) || 1 }))}
            />
            <HelperText>Lower numbers run first</HelperText>
          </FormGroup>

          <FormGroup>
            <Label>Data Template *</Label>
            <Select
              value={formData.template_id}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                template_id: e.target.value,
                data_set_id: '' 
              }))}
            >
              <option value="">Select a template...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.http_method} {t.path})
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup>
            <Label>Data Set (Optional)</Label>
            <Select
              value={formData.data_set_id}
              onChange={e => setFormData(prev => ({ ...prev, data_set_id: e.target.value }))}
              disabled={!formData.template_id}
            >
              <option value="">No data set (use custom variables)</option>
              {dataSets.map(ds => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} {ds.is_default ? '(Default)' : ''}
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroupFull>
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What data does this setup create?"
            />
          </FormGroupFull>

          <FormGroupFull>
            <Label>Custom Variables (JSON)</Label>
            <TextArea
              value={variablesJson}
              onChange={e => setVariablesJson(e.target.value)}
              placeholder={`{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@test.com"
}`}
            />
            <HelperText>
              Variables to substitute in the request template. These override data set values.
            </HelperText>
          </FormGroupFull>

          {selectedTemplate?.response_extractors && selectedTemplate.response_extractors.length > 0 && (
            <FormGroupFull>
              <Label>Variables Extracted by Template</Label>
              <VariablesList>
                {selectedTemplate.response_extractors.map((ext, i) => (
                  <VariableItem key={i}>
                    <VariableName>${'{' + ext.name + '}'}</VariableName>
                    <ArrowRight size={14} style={{ color: '#a0aec0' }} />
                    <VariableValue style={{ fontStyle: 'italic', color: '#718096' }}>
                      {ext.json_path}
                    </VariableValue>
                  </VariableItem>
                ))}
              </VariablesList>
              <HelperText style={{ marginTop: '8px' }}>
                These variables will be available in your UI test steps after execution
              </HelperText>
            </FormGroupFull>
          )}
        </FormGrid>

        <ButtonRow>
          <Button $variant="secondary" onClick={handleCancel}>
            <X size={16} />
            Cancel
          </Button>
          <Button 
            $variant="primary" 
            onClick={handleSave}
            disabled={!formData.name || !formData.template_id}
          >
            <Check size={16} />
            {isNew ? 'Create Setup' : 'Save Changes'}
          </Button>
        </ButtonRow>
      </ExpandedContent>
    );
  };

  const renderExecutionResult = () => {
    if (!executionResult) return null;
    
    return (
      <ExecutionResult $success={executionResult.success}>
        <ResultHeader>
          {executionResult.success ? (
            <CheckCircle size={20} color="#1D9E75" />
          ) : (
            <XCircle size={20} color="#c53030" />
          )}
          <ResultTitle $success={executionResult.success}>
            {executionResult.success ? 'Execution Successful' : 'Execution Failed'}
          </ResultTitle>
          <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#718096' }}>
            {executionResult.execution_time_ms}ms
          </span>
        </ResultHeader>
        
        {executionResult.results[0]?.error_message && (
          <div style={{ 
            padding: '12px', 
            background: 'rgba(229, 62, 62, 0.1)', 
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#c53030'
          }}>
            {executionResult.results[0].error_message}
          </div>
        )}
        
        {Object.keys(executionResult.combined_variables).length > 0 && (
          <>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '8px' 
            }}>
              <Label style={{ margin: 0 }}>Extracted Variables</Label>
              <Button 
                $variant="secondary" 
                onClick={() => copyVariables(executionResult.combined_variables)}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <Copy size={14} />
                Copy
              </Button>
            </div>
            <VariablesList>
              {Object.entries(executionResult.combined_variables).map(([name, value]) => (
                <VariableItem key={name}>
                  <VariableName>${'{' + name + '}'}</VariableName>
                  <ArrowRight size={14} style={{ color: '#a0aec0' }} />
                  <VariableValue>{String(value)}</VariableValue>
                </VariableItem>
              ))}
            </VariablesList>
          </>
        )}
      </ExecutionResult>
    );
  };

  if (loading) {
    return (
      <Container>
        <HeaderRow>
          <SectionTitle>
            <Layers size={20} />
            Test Data Setups
          </SectionTitle>
        </HeaderRow>
        <EmptyState>
          <EmptyTitle>Loading setups...</EmptyTitle>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <HeaderRow>
        <SectionTitle>
          <Layers size={20} />
          Test Data Setups
        </SectionTitle>
        <AddButton onClick={handleCreate} disabled={templates.length === 0}>
          <Plus size={18} />
          Add Setup
        </AddButton>
      </HeaderRow>

      <TabRow>
        <Tab $active={activeTab === 'setups'} onClick={() => setActiveTab('setups')}>
          <Layers size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Setups ({setups.length})
        </Tab>
        <Tab $active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
          <Clock size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Execution History
        </Tab>
      </TabRow>

      {activeTab === 'setups' && (
        <SetupList>
          {isCreating && (
            <SetupCard $isEditing>
              <SetupHeader>
                <SetupInfo>
                  <OrderBadge>{formData.execution_order}</OrderBadge>
                  <SetupDetails>
                    <SetupName>{formData.name || 'New Setup'}</SetupName>
                    <SetupMeta>
                      {templates.find(t => t.id === formData.template_id)?.name || 'Select a template'}
                    </SetupMeta>
                  </SetupDetails>
                </SetupInfo>
              </SetupHeader>
              {renderSetupForm(true)}
            </SetupCard>
          )}

          {setups
            .sort((a, b) => a.execution_order - b.execution_order)
            .map(setup => (
              <SetupCard key={setup.id} $isEditing={editingId === setup.id}>
                <SetupHeader onClick={() => toggleExpand(setup.id)}>
                  <SetupInfo>
                    <OrderBadge>{setup.execution_order}</OrderBadge>
                    <SetupDetails>
                      <SetupName>{setup.name}</SetupName>
                      <SetupMeta>
                        {setup.template_name || 'Unknown template'}
                        {setup.template_category && ` • ${setup.template_category}`}
                      </SetupMeta>
                    </SetupDetails>
                  </SetupInfo>
                  <SetupActions>
                    {editingId !== setup.id && (
                      <>
                        <ActionButton 
                          $variant="success"
                          onClick={(e) => { e.stopPropagation(); handleExecute(setup.id); }}
                          title="Execute setup"
                          disabled={executing === setup.id}
                        >
                          {executing === setup.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Play size={16} />
                          )}
                        </ActionButton>
                        <ActionButton 
                          $variant="primary"
                          onClick={(e) => { e.stopPropagation(); handleEdit(setup); }}
                          title="Edit setup"
                        >
                          <Edit2 size={16} />
                        </ActionButton>
                        <ActionButton 
                          $variant="danger"
                          onClick={(e) => { e.stopPropagation(); handleDelete(setup.id); }}
                          title="Delete setup"
                        >
                          <Trash2 size={16} />
                        </ActionButton>
                      </>
                    )}
                    {expandedId === setup.id ? (
                      <ChevronUp size={18} color="#a0aec0" />
                    ) : (
                      <ChevronDown size={18} color="#a0aec0" />
                    )}
                  </SetupActions>
                </SetupHeader>
                
                {expandedId === setup.id && (
                  editingId === setup.id ? (
                    renderSetupForm(false)
                  ) : (
                    <ExpandedContent>
                      <FormGrid>
                        <FormGroup>
                          <Label>Description</Label>
                          <div style={{ color: '#718096', fontSize: '14px' }}>
                            {setup.description || 'No description'}
                          </div>
                        </FormGroup>
                        <FormGroup>
                          <Label>Data Set</Label>
                          <div style={{ color: '#718096', fontSize: '14px' }}>
                            {setup.data_set_name || 'Custom variables only'}
                          </div>
                        </FormGroup>
                        {setup.custom_variables && Object.keys(setup.custom_variables).length > 0 && (
                          <FormGroupFull>
                            <Label>Custom Variables</Label>
                            <pre style={{ 
                              background: '#f7fafc', 
                              padding: '12px', 
                              borderRadius: '8px',
                              fontSize: '13px',
                              margin: 0,
                              overflow: 'auto'
                            }}>
                              {JSON.stringify(setup.custom_variables, null, 2)}
                            </pre>
                          </FormGroupFull>
                        )}
                      </FormGrid>
                      {executionResult && expandedId === setup.id && renderExecutionResult()}
                    </ExpandedContent>
                  )
                )}
              </SetupCard>
            ))}

          {setups.length === 0 && !isCreating && (
            <EmptyState>
              <EmptyIcon>
                <Layers size={28} />
              </EmptyIcon>
              <EmptyTitle>No Test Data Setups</EmptyTitle>
              <EmptyText>
                {templates.length === 0 
                  ? 'Create data templates first, then create setups.'
                  : 'Create setups to combine templates with variable values.'}
              </EmptyText>
              {templates.length > 0 && (
                <AddButton onClick={handleCreate}>
                  <Plus size={18} />
                  Create Your First Setup
                </AddButton>
              )}
            </EmptyState>
          )}
        </SetupList>
      )}

      {activeTab === 'history' && (
        <HistoryList>
          {history.length === 0 ? (
            <EmptyState>
              <EmptyIcon>
                <Clock size={28} />
              </EmptyIcon>
              <EmptyTitle>No Execution History</EmptyTitle>
              <EmptyText>Execute a setup to see history here.</EmptyText>
            </EmptyState>
          ) : (
            history.map(item => (
              <HistoryItem key={item.id}>
                <HistoryIcon $success={item.success}>
                  {item.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
                </HistoryIcon>
                <HistoryDetails>
                  <HistoryName>{item.setup_name || item.template_name || 'Unknown'}</HistoryName>
                  <HistoryMeta>
                    {item.request_method} {item.request_url} • {item.duration_ms}ms • 
                    {new Date(item.executed_at).toLocaleString()}
                  </HistoryMeta>
                </HistoryDetails>
                {item.response_status && (
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    background: item.success ? 'rgba(72, 187, 120, 0.15)' : 'rgba(229, 62, 62, 0.15)',
                    color: item.success ? '#1D9E75' : '#c53030',
                    fontWeight: 600,
                    fontSize: '13px'
                  }}>
                    {item.response_status}
                  </span>
                )}
              </HistoryItem>
            ))
          )}
        </HistoryList>
      )}
    </Container>
  );
};

export default TestDataSetupPanel;
