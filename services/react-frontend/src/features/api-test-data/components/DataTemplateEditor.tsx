/**
 * Data Template Editor Component
 * Allows testers to create request templates with:
 * - HTTP method and path
 * - Request body templates with variables
 * - Response extractors (JSONPath expressions to capture response values)
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Plus, Edit2, Trash2, FileJson, ChevronDown, ChevronUp, Check, X, Copy, Play, Variable } from 'lucide-react';
import apiTestDataService, { 
  DataTemplate, 
  DataTemplateCreate, 
  ApiEndpoint, 
  ResponseExtractor,
  HttpMethod 
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
`;

const FilterRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const FilterSelect = styled.select`
  padding: 8px 14px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 14px;
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  min-width: 150px;
  
  &:focus {
    outline: none;
    border-color: #185FA5;
  }
`;

const TemplateList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const TemplateCard = styled.div<{ $isEditing?: boolean }>`
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.$isEditing ? '#185FA5' : props.theme.colors.border};
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
  
  ${props => props.$isEditing && `
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  `}
`;

const TemplateHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  
  &:hover {
    background: ${props => props.theme.colors.hover};
  }
`;

const TemplateInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MethodBadge = styled.span<{ $method: HttpMethod }>`
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  font-family: 'Monaco', 'Menlo', monospace;
  
  background: ${props => {
    switch (props.$method) {
      case 'GET': return 'rgba(72, 187, 120, 0.15)';
      case 'POST': return 'rgba(102, 126, 234, 0.15)';
      case 'PUT': return 'rgba(237, 137, 54, 0.15)';
      case 'PATCH': return 'rgba(159, 122, 234, 0.15)';
      case 'DELETE': return 'rgba(229, 62, 62, 0.15)';
    }
  }};
  
  color: ${props => {
    switch (props.$method) {
      case 'GET': return '#1D9E75';
      case 'POST': return '#185FA5';
      case 'PUT': return '#dd6b20';
      case 'PATCH': return '#805ad5';
      case 'DELETE': return '#c53030';
    }
  }};
`;

const TemplateDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TemplateName = styled.span`
  font-weight: 600;
  font-size: 16px;
  color: ${props => props.theme.colors.text};
`;

const TemplatePath = styled.span`
  font-size: 13px;
  color: ${props => props.theme.colors.textSecondary};
  font-family: 'Monaco', 'Menlo', monospace;
`;

const CategoryBadge = styled.span`
  padding: 4px 10px;
  background: rgba(160, 174, 192, 0.15);
  color: #718096;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
`;

const TemplateActions = styled.div`
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
  display: flex;
  align-items: center;
  gap: 6px;
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
  min-height: 120px;
  
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

const ExtractorList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ExtractorItem = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr auto auto;
  gap: 12px;
  align-items: start;
  padding: 12px;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
  border: 1px solid ${props => props.theme.colors.border};
`;

const SmallInput = styled(Input)`
  padding: 8px 12px;
  font-size: 13px;
`;

const SmallButton = styled.button<{ $variant?: 'danger' | 'primary' }>`
  padding: 8px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  
  background: ${props => props.$variant === 'danger' 
    ? 'rgba(229, 62, 62, 0.1)' 
    : 'rgba(102, 126, 234, 0.1)'};
  color: ${props => props.$variant === 'danger' ? '#A32D2D' : '#185FA5'};
  
  &:hover {
    background: ${props => props.$variant === 'danger' 
      ? 'rgba(229, 62, 62, 0.2)' 
      : 'rgba(102, 126, 234, 0.2)'};
  }
`;

const AddExtractorButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: 1px dashed ${props => props.theme.colors.border};
  border-radius: 8px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #185FA5;
    color: #185FA5;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid ${props => props.theme.colors.border};
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
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
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
  ` : `
    background: transparent;
    color: ${props.theme.colors.textSecondary};
    border: 1px solid ${props.theme.colors.border};
    
    &:hover {
      background: ${props.theme.colors.hover};
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

// Types
interface TemplateFormData {
  endpoint_id: string;
  name: string;
  description: string;
  category: string;
  http_method: HttpMethod;
  path: string;
  request_headers: Record<string, string>;
  request_body_template: Record<string, any>;
  expected_status_codes: number[];
  response_extractors: ResponseExtractor[];
  is_active: boolean;
}

const defaultFormData: TemplateFormData = {
  endpoint_id: '',
  name: '',
  description: '',
  category: '',
  http_method: 'POST',
  path: '',
  request_headers: {},
  request_body_template: {},
  expected_status_codes: [200, 201],
  response_extractors: [],
  is_active: true,
};

const DataTemplateEditor: React.FC = () => {
  const [templates, setTemplates] = useState<DataTemplate[]>([]);
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData);
  const [bodyJson, setBodyJson] = useState('{}');
  const [headersJson, setHeadersJson] = useState('{}');
  const [filterEndpoint, setFilterEndpoint] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [templateData, endpointData] = await Promise.all([
        apiTestDataService.templates.list({ 
          endpoint_id: filterEndpoint || undefined,
          category: filterCategory || undefined 
        }),
        apiTestDataService.endpoints.list(undefined, true),
      ]);
      setTemplates(templateData);
      setEndpoints(endpointData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [filterEndpoint, filterCategory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = () => {
    setFormData({
      ...defaultFormData,
      endpoint_id: endpoints[0]?.id || '',
    });
    setBodyJson('{\n  \n}');
    setHeadersJson('{}');
    setIsCreating(true);
    setEditingId(null);
    setExpandedId('new');
  };

  const handleEdit = (template: DataTemplate) => {
    setFormData({
      endpoint_id: template.endpoint_id,
      name: template.name,
      description: template.description || '',
      category: template.category || '',
      http_method: template.http_method,
      path: template.path,
      request_headers: template.request_headers || {},
      request_body_template: template.request_body_template || {},
      expected_status_codes: template.expected_status_codes,
      response_extractors: template.response_extractors || [],
      is_active: template.is_active,
    });
    setBodyJson(JSON.stringify(template.request_body_template || {}, null, 2));
    setHeadersJson(JSON.stringify(template.request_headers || {}, null, 2));
    setEditingId(template.id);
    setIsCreating(false);
    setExpandedId(template.id);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setExpandedId(null);
    setFormData(defaultFormData);
  };

  const handleSave = async () => {
    try {
      let parsedBody = {};
      let parsedHeaders = {};
      
      try {
        parsedBody = JSON.parse(bodyJson);
      } catch {
        parsedBody = {};
      }
      
      try {
        parsedHeaders = JSON.parse(headersJson);
      } catch {
        parsedHeaders = {};
      }

      const payload: DataTemplateCreate = {
        endpoint_id: formData.endpoint_id,
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category || undefined,
        http_method: formData.http_method,
        path: formData.path,
        request_headers: parsedHeaders,
        request_body_template: parsedBody,
        expected_status_codes: formData.expected_status_codes,
        response_extractors: formData.response_extractors,
        is_active: formData.is_active,
      };

      if (isCreating) {
        await apiTestDataService.templates.create(payload);
      } else if (editingId) {
        await apiTestDataService.templates.update(editingId, payload);
      }

      await fetchData();
      handleCancel();
    } catch (error) {
      console.error('Failed to save template:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await apiTestDataService.templates.delete(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const toggleExpand = (id: string) => {
    if (editingId || isCreating) return;
    setExpandedId(expandedId === id ? null : id);
  };

  const addExtractor = () => {
    setFormData(prev => ({
      ...prev,
      response_extractors: [
        ...prev.response_extractors,
        { name: '', json_path: '$.', default_value: '', required: true }
      ]
    }));
  };

  const updateExtractor = (index: number, field: keyof ResponseExtractor, value: any) => {
    setFormData(prev => ({
      ...prev,
      response_extractors: prev.response_extractors.map((ext, i) =>
        i === index ? { ...ext, [field]: value } : ext
      )
    }));
  };

  const removeExtractor = (index: number) => {
    setFormData(prev => ({
      ...prev,
      response_extractors: prev.response_extractors.filter((_, i) => i !== index)
    }));
  };

  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];

  const renderTemplateForm = (isNew: boolean = false) => (
    <ExpandedContent>
      <FormGrid>
        <FormGroup>
          <Label>Template Name *</Label>
          <Input
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Create Booking"
          />
        </FormGroup>

        <FormGroup>
          <Label>API Endpoint *</Label>
          <Select
            value={formData.endpoint_id}
            onChange={e => setFormData(prev => ({ ...prev, endpoint_id: e.target.value }))}
          >
            <option value="">Select an endpoint...</option>
            {endpoints.map(ep => (
              <option key={ep.id} value={ep.id}>{ep.name}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>HTTP Method</Label>
          <Select
            value={formData.http_method}
            onChange={e => setFormData(prev => ({ ...prev, http_method: e.target.value as HttpMethod }))}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>Path *</Label>
          <Input
            value={formData.path}
            onChange={e => setFormData(prev => ({ ...prev, path: e.target.value }))}
            placeholder="/bookings"
          />
          <HelperText>Path relative to endpoint base URL</HelperText>
        </FormGroup>

        <FormGroup>
          <Label>Category</Label>
          <Input
            value={formData.category}
            onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
            placeholder="e.g., Booking, User, Payment"
            list="categories"
          />
          <datalist id="categories">
            {categories.map(cat => <option key={cat} value={cat} />)}
          </datalist>
        </FormGroup>

        <FormGroup>
          <Label>Expected Status Codes</Label>
          <Input
            value={formData.expected_status_codes.join(', ')}
            onChange={e => setFormData(prev => ({
              ...prev,
              expected_status_codes: e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
            }))}
            placeholder="200, 201"
          />
        </FormGroup>

        <FormGroupFull>
          <Label>Description</Label>
          <Input
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="What does this template do?"
          />
        </FormGroupFull>

        <FormGroupFull>
          <Label>Request Headers (JSON)</Label>
          <TextArea
            value={headersJson}
            onChange={e => setHeadersJson(e.target.value)}
            placeholder='{"Content-Type": "application/json"}'
            style={{ minHeight: '80px' }}
          />
        </FormGroupFull>

        <FormGroupFull>
          <Label>
            Request Body Template (JSON)
            <HelperText style={{ marginLeft: '8px' }}>Use {'${variable}'} for dynamic values</HelperText>
          </Label>
          <TextArea
            value={bodyJson}
            onChange={e => setBodyJson(e.target.value)}
            placeholder={`{
  "firstName": "\${first_name}",
  "lastName": "\${last_name}",
  "flight": "\${flight_id}"
}`}
          />
        </FormGroupFull>

        <FormGroupFull>
          <Label>
            <Variable size={14} />
            Response Extractors
            <HelperText style={{ marginLeft: '8px' }}>Extract values from API response to use in UI tests</HelperText>
          </Label>
          <ExtractorList>
            {formData.response_extractors.map((ext, index) => (
              <ExtractorItem key={index}>
                <SmallInput
                  value={ext.name}
                  onChange={e => updateExtractor(index, 'name', e.target.value)}
                  placeholder="Variable name"
                />
                <SmallInput
                  value={ext.json_path}
                  onChange={e => updateExtractor(index, 'json_path', e.target.value)}
                  placeholder="$.data.id or $.booking.confirmation_code"
                />
                <SmallInput
                  value={ext.default_value || ''}
                  onChange={e => updateExtractor(index, 'default_value', e.target.value)}
                  placeholder="Default"
                  style={{ width: '100px' }}
                />
                <SmallButton $variant="danger" onClick={() => removeExtractor(index)}>
                  <Trash2 size={14} />
                </SmallButton>
              </ExtractorItem>
            ))}
            <AddExtractorButton onClick={addExtractor}>
              <Plus size={14} />
              Add Response Extractor
            </AddExtractorButton>
          </ExtractorList>
        </FormGroupFull>
      </FormGrid>

      <ButtonRow>
        <Button $variant="secondary" onClick={handleCancel}>
          <X size={16} />
          Cancel
        </Button>
        <Button 
          $variant="primary" 
          onClick={handleSave}
          disabled={!formData.name || !formData.endpoint_id || !formData.path}
        >
          <Check size={16} />
          {isNew ? 'Create Template' : 'Save Changes'}
        </Button>
      </ButtonRow>
    </ExpandedContent>
  );

  if (loading) {
    return (
      <Container>
        <HeaderRow>
          <SectionTitle>
            <FileJson size={20} />
            Data Templates
          </SectionTitle>
        </HeaderRow>
        <EmptyState>
          <EmptyTitle>Loading templates...</EmptyTitle>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <HeaderRow>
        <SectionTitle>
          <FileJson size={20} />
          Data Templates
        </SectionTitle>
        <AddButton onClick={handleCreate} disabled={endpoints.length === 0}>
          <Plus size={18} />
          Add Template
        </AddButton>
      </HeaderRow>

      <FilterRow>
        <FilterSelect
          value={filterEndpoint}
          onChange={e => setFilterEndpoint(e.target.value)}
        >
          <option value="">All Endpoints</option>
          {endpoints.map(ep => (
            <option key={ep.id} value={ep.id}>{ep.name}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </FilterSelect>
      </FilterRow>

      <TemplateList>
        {isCreating && (
          <TemplateCard $isEditing>
            <TemplateHeader>
              <TemplateInfo>
                <MethodBadge $method={formData.http_method}>{formData.http_method}</MethodBadge>
                <TemplateDetails>
                  <TemplateName>{formData.name || 'New Template'}</TemplateName>
                  <TemplatePath>{formData.path || '/...'}</TemplatePath>
                </TemplateDetails>
              </TemplateInfo>
            </TemplateHeader>
            {renderTemplateForm(true)}
          </TemplateCard>
        )}

        {templates.map(template => (
          <TemplateCard key={template.id} $isEditing={editingId === template.id}>
            <TemplateHeader onClick={() => toggleExpand(template.id)}>
              <TemplateInfo>
                <MethodBadge $method={template.http_method}>{template.http_method}</MethodBadge>
                <TemplateDetails>
                  <TemplateName>{template.name}</TemplateName>
                  <TemplatePath>{template.path}</TemplatePath>
                </TemplateDetails>
              </TemplateInfo>
              <TemplateActions>
                {template.category && <CategoryBadge>{template.category}</CategoryBadge>}
                {template.response_extractors?.length > 0 && (
                  <CategoryBadge title="Has extractors">
                    <Variable size={12} style={{ marginRight: 4 }} />
                    {template.response_extractors.length}
                  </CategoryBadge>
                )}
                {editingId !== template.id && (
                  <>
                    <ActionButton 
                      $variant="primary"
                      onClick={(e) => { e.stopPropagation(); handleEdit(template); }}
                      title="Edit template"
                    >
                      <Edit2 size={16} />
                    </ActionButton>
                    <ActionButton 
                      $variant="danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                      title="Delete template"
                    >
                      <Trash2 size={16} />
                    </ActionButton>
                  </>
                )}
                {expandedId === template.id ? (
                  <ChevronUp size={18} color="#a0aec0" />
                ) : (
                  <ChevronDown size={18} color="#a0aec0" />
                )}
              </TemplateActions>
            </TemplateHeader>
            
            {expandedId === template.id && (
              editingId === template.id ? (
                renderTemplateForm(false)
              ) : (
                <ExpandedContent>
                  <FormGrid>
                    <FormGroup>
                      <Label>Endpoint</Label>
                      <div style={{ color: '#718096', fontSize: '14px' }}>
                        {template.endpoint_name || 'Unknown'}
                      </div>
                    </FormGroup>
                    <FormGroup>
                      <Label>Expected Status</Label>
                      <div style={{ color: '#718096', fontSize: '14px' }}>
                        {template.expected_status_codes.join(', ')}
                      </div>
                    </FormGroup>
                    {template.request_body_template && Object.keys(template.request_body_template).length > 0 && (
                      <FormGroupFull>
                        <Label>Request Body</Label>
                        <pre style={{ 
                          background: '#f7fafc', 
                          padding: '12px', 
                          borderRadius: '8px',
                          fontSize: '13px',
                          margin: 0,
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(template.request_body_template, null, 2)}
                        </pre>
                      </FormGroupFull>
                    )}
                    {template.response_extractors?.length > 0 && (
                      <FormGroupFull>
                        <Label>Response Extractors</Label>
                        <ExtractorList>
                          {template.response_extractors.map((ext, i) => (
                            <ExtractorItem key={i} style={{ gridTemplateColumns: '1fr 2fr' }}>
                              <div><strong>{ext.name}</strong></div>
                              <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>{ext.json_path}</div>
                            </ExtractorItem>
                          ))}
                        </ExtractorList>
                      </FormGroupFull>
                    )}
                  </FormGrid>
                </ExpandedContent>
              )
            )}
          </TemplateCard>
        ))}

        {templates.length === 0 && !isCreating && (
          <EmptyState>
            <EmptyIcon>
              <FileJson size={28} />
            </EmptyIcon>
            <EmptyTitle>No Data Templates</EmptyTitle>
            <EmptyText>
              {endpoints.length === 0 
                ? 'Configure an API endpoint first, then create templates.'
                : 'Create templates to define API requests for test data creation.'}
            </EmptyText>
            {endpoints.length > 0 && (
              <AddButton onClick={handleCreate}>
                <Plus size={18} />
                Create Your First Template
              </AddButton>
            )}
          </EmptyState>
        )}
      </TemplateList>
    </Container>
  );
};

export default DataTemplateEditor;
