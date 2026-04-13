/**
 * API Endpoint Manager Component
 * Allows testers to create and manage API endpoint configurations.
 * Each endpoint defines:
 * - Base URL for API server
 * - Authentication type and credentials
 * - Default headers
 * - Timeout and retry settings
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Plus, Edit2, Trash2, Server, Key, Clock, RefreshCw, Check, X, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import apiTestDataService, { ApiEndpoint, ApiEndpointCreate, AuthType } from '../../../services/apiTestDataService';
import { useAuth } from '../../../contexts/AuthContext';

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

const EndpointList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const EndpointCard = styled.div<{ $isEditing?: boolean }>`
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.$isEditing ? '#185FA5' : props.theme.colors.border};
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
  
  ${props => props.$isEditing && `
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  `}
`;

const EndpointHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  cursor: pointer;
  
  &:hover {
    background: ${props => props.theme.colors.hover};
  }
`;

const EndpointInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const EndpointIcon = styled.div<{ $active: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$active 
    ? 'linear-gradient(135deg, #1D9E75 0%, #1D9E75 100%)' 
    : props.theme.colors.border};
`;

const EndpointDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const EndpointName = styled.span`
  font-weight: 600;
  font-size: 16px;
  color: ${props => props.theme.colors.text};
`;

const EndpointUrl = styled.span`
  font-size: 13px;
  color: ${props => props.theme.colors.textSecondary};
  font-family: 'Monaco', 'Menlo', monospace;
`;

const EndpointActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ActionButton = styled.button<{ $variant?: 'danger' | 'primary' }>`
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
    return props.theme.colors.hover;
  }};
  
  color: ${props => {
    if (props.$variant === 'danger') return '#A32D2D';
    if (props.$variant === 'primary') return '#185FA5';
    return props.theme.colors.textSecondary;
  }};
  
  &:hover {
    transform: scale(1.05);
    background: ${props => {
      if (props.$variant === 'danger') return 'rgba(229, 62, 62, 0.2)';
      if (props.$variant === 'primary') return 'rgba(102, 126, 234, 0.2)';
      return props.theme.colors.border;
    }};
  }
`;

const Badge = styled.span<{ $type: AuthType }>`
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  
  background: ${props => {
    switch (props.$type) {
      case 'bearer': return 'rgba(102, 126, 234, 0.15)';
      case 'api_key': return 'rgba(237, 137, 54, 0.15)';
      case 'basic': return 'rgba(72, 187, 120, 0.15)';
      case 'oauth2': return 'rgba(159, 122, 234, 0.15)';
      default: return 'rgba(160, 174, 192, 0.15)';
    }
  }};
  
  color: ${props => {
    switch (props.$type) {
      case 'bearer': return '#185FA5';
      case 'api_key': return '#ed8936';
      case 'basic': return '#1D9E75';
      case 'oauth2': return '#9f7aea';
      default: return '#a0aec0';
    }
  }};
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
  
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
    opacity: 0.6;
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
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
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
  min-height: 80px;
  
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

const PasswordInput = styled.div`
  position: relative;
  display: flex;
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: ${props => props.theme.colors.textSecondary};
  padding: 4px;
  
  &:hover {
    color: ${props => props.theme.colors.text};
  }
`;

const NumberInput = styled(Input)`
  width: 100px;
`;

// Types
interface EndpointFormData {
  name: string;
  description: string;
  base_url: string;
  auth_type: AuthType;
  auth_config: Record<string, any>;
  default_headers: Record<string, string>;
  timeout_seconds: number;
  retry_count: number;
  is_active: boolean;
}

const defaultFormData: EndpointFormData = {
  name: '',
  description: '',
  base_url: '',
  auth_type: 'none',
  auth_config: {},
  default_headers: {},
  timeout_seconds: 30,
  retry_count: 3,
  is_active: true,
};

const ApiEndpointManager: React.FC = () => {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<EndpointFormData>(defaultFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [headersJson, setHeadersJson] = useState('{}');
  const { user } = useAuth();

  const fetchEndpoints = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiTestDataService.endpoints.list();
      setEndpoints(data);
    } catch (error) {
      console.error('Failed to fetch endpoints:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  const handleCreate = () => {
    setFormData(defaultFormData);
    setHeadersJson('{}');
    setIsCreating(true);
    setEditingId(null);
    setExpandedId('new');
  };

  const handleEdit = (endpoint: ApiEndpoint) => {
    setFormData({
      name: endpoint.name,
      description: endpoint.description || '',
      base_url: endpoint.base_url,
      auth_type: endpoint.auth_type,
      auth_config: endpoint.auth_config || {},
      default_headers: endpoint.default_headers || {},
      timeout_seconds: endpoint.timeout_seconds,
      retry_count: endpoint.retry_count,
      is_active: endpoint.is_active,
    });
    setHeadersJson(JSON.stringify(endpoint.default_headers || {}, null, 2));
    setEditingId(endpoint.id);
    setIsCreating(false);
    setExpandedId(endpoint.id);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setExpandedId(null);
    setFormData(defaultFormData);
    setHeadersJson('{}');
  };

  const handleSave = async () => {
    try {
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(headersJson);
      } catch {
        parsedHeaders = {};
      }

      const payload: ApiEndpointCreate = {
        name: formData.name,
        description: formData.description || undefined,
        base_url: formData.base_url,
        auth_type: formData.auth_type,
        auth_config: formData.auth_config,
        default_headers: parsedHeaders,
        timeout_seconds: formData.timeout_seconds,
        retry_count: formData.retry_count,
        is_active: formData.is_active,
      };

      if (isCreating) {
        await apiTestDataService.endpoints.create(payload);
      } else if (editingId) {
        await apiTestDataService.endpoints.update(editingId, payload);
      }

      await fetchEndpoints();
      handleCancel();
    } catch (error) {
      console.error('Failed to save endpoint:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this endpoint?')) return;
    
    try {
      await apiTestDataService.endpoints.delete(id);
      await fetchEndpoints();
    } catch (error) {
      console.error('Failed to delete endpoint:', error);
    }
  };

  const toggleExpand = (id: string) => {
    if (editingId || isCreating) return;
    setExpandedId(expandedId === id ? null : id);
  };

  const renderAuthFields = () => {
    switch (formData.auth_type) {
      case 'bearer':
        return (
          <FormGroup>
            <Label>Bearer Token</Label>
            <PasswordInput>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={formData.auth_config.token || ''}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  auth_config: { ...prev.auth_config, token: e.target.value }
                }))}
                placeholder="Enter bearer token"
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <PasswordToggle type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </PasswordToggle>
            </PasswordInput>
          </FormGroup>
        );
      
      case 'api_key':
        return (
          <>
            <FormGroup>
              <Label>Header Name</Label>
              <Input
                value={formData.auth_config.header_name || 'X-API-Key'}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  auth_config: { ...prev.auth_config, header_name: e.target.value }
                }))}
                placeholder="X-API-Key"
              />
            </FormGroup>
            <FormGroup>
              <Label>API Key</Label>
              <PasswordInput>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.auth_config.api_key || ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    auth_config: { ...prev.auth_config, api_key: e.target.value }
                  }))}
                  placeholder="Enter API key"
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <PasswordToggle type="button" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </PasswordToggle>
              </PasswordInput>
            </FormGroup>
          </>
        );
      
      case 'basic':
        return (
          <>
            <FormGroup>
              <Label>Username</Label>
              <Input
                value={formData.auth_config.username || ''}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  auth_config: { ...prev.auth_config, username: e.target.value }
                }))}
                placeholder="Username"
              />
            </FormGroup>
            <FormGroup>
              <Label>Password</Label>
              <PasswordInput>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.auth_config.password || ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    auth_config: { ...prev.auth_config, password: e.target.value }
                  }))}
                  placeholder="Password"
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <PasswordToggle type="button" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </PasswordToggle>
              </PasswordInput>
            </FormGroup>
          </>
        );
      
      case 'oauth2':
        return (
          <>
            <FormGroup>
              <Label>Token URL</Label>
              <Input
                value={formData.auth_config.token_url || ''}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  auth_config: { ...prev.auth_config, token_url: e.target.value }
                }))}
                placeholder="https://auth.example.com/oauth/token"
              />
            </FormGroup>
            <FormGroup>
              <Label>Client ID</Label>
              <Input
                value={formData.auth_config.client_id || ''}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  auth_config: { ...prev.auth_config, client_id: e.target.value }
                }))}
                placeholder="Client ID"
              />
            </FormGroup>
            <FormGroup>
              <Label>Client Secret</Label>
              <PasswordInput>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.auth_config.client_secret || ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    auth_config: { ...prev.auth_config, client_secret: e.target.value }
                  }))}
                  placeholder="Client Secret"
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <PasswordToggle type="button" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </PasswordToggle>
              </PasswordInput>
            </FormGroup>
            <FormGroup>
              <Label>Scope (optional)</Label>
              <Input
                value={formData.auth_config.scope || ''}
                onChange={e => setFormData(prev => ({
                  ...prev,
                  auth_config: { ...prev.auth_config, scope: e.target.value }
                }))}
                placeholder="read write"
              />
            </FormGroup>
          </>
        );
      
      default:
        return null;
    }
  };

  const renderEndpointForm = (isNew: boolean = false) => (
    <ExpandedContent>
      <FormGrid>
        <FormGroup>
          <Label>Endpoint Name *</Label>
          <Input
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Booking API"
          />
        </FormGroup>

        <FormGroup>
          <Label>Base URL *</Label>
          <Input
            value={formData.base_url}
            onChange={e => setFormData(prev => ({ ...prev, base_url: e.target.value }))}
            placeholder="https://api.example.com/v1"
          />
        </FormGroup>

        <FormGroupFull>
          <Label>Description</Label>
          <Input
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of this API endpoint"
          />
        </FormGroupFull>

        <FormGroup>
          <Label>Authentication Type</Label>
          <Select
            value={formData.auth_type}
            onChange={e => setFormData(prev => ({ 
              ...prev, 
              auth_type: e.target.value as AuthType,
              auth_config: {} 
            }))}
          >
            <option value="none">No Authentication</option>
            <option value="bearer">Bearer Token</option>
            <option value="api_key">API Key</option>
            <option value="basic">Basic Auth</option>
            <option value="oauth2">OAuth 2.0</option>
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>Active</Label>
          <Select
            value={formData.is_active ? 'true' : 'false'}
            onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </FormGroup>

        {renderAuthFields()}

        <FormGroup>
          <Label>Timeout (seconds)</Label>
          <NumberInput
            type="number"
            min={1}
            max={300}
            value={formData.timeout_seconds}
            onChange={e => setFormData(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value) || 30 }))}
          />
        </FormGroup>

        <FormGroup>
          <Label>Retry Count</Label>
          <NumberInput
            type="number"
            min={0}
            max={10}
            value={formData.retry_count}
            onChange={e => setFormData(prev => ({ ...prev, retry_count: parseInt(e.target.value) || 0 }))}
          />
        </FormGroup>

        <FormGroupFull>
          <Label>Default Headers (JSON)</Label>
          <TextArea
            value={headersJson}
            onChange={e => setHeadersJson(e.target.value)}
            placeholder='{"Content-Type": "application/json"}'
          />
          <HelperText>Headers that will be included in all requests to this endpoint</HelperText>
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
          disabled={!formData.name || !formData.base_url}
        >
          <Check size={16} />
          {isNew ? 'Create Endpoint' : 'Save Changes'}
        </Button>
      </ButtonRow>
    </ExpandedContent>
  );

  if (loading) {
    return (
      <Container>
        <HeaderRow>
          <SectionTitle>
            <Server size={20} />
            API Endpoints
          </SectionTitle>
        </HeaderRow>
        <EmptyState>
          <EmptyIcon>
            <RefreshCw size={28} className="animate-spin" />
          </EmptyIcon>
          <EmptyTitle>Loading endpoints...</EmptyTitle>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <HeaderRow>
        <SectionTitle>
          <Server size={20} />
          API Endpoints
        </SectionTitle>
        <AddButton onClick={handleCreate}>
          <Plus size={18} />
          Add Endpoint
        </AddButton>
      </HeaderRow>

      <EndpointList>
        {/* New Endpoint Form */}
        {isCreating && (
          <EndpointCard $isEditing>
            <EndpointHeader>
              <EndpointInfo>
                <EndpointIcon $active={formData.is_active}>
                  <Server size={20} color="white" />
                </EndpointIcon>
                <EndpointDetails>
                  <EndpointName>{formData.name || 'New Endpoint'}</EndpointName>
                  <EndpointUrl>{formData.base_url || 'https://...'}</EndpointUrl>
                </EndpointDetails>
              </EndpointInfo>
              <Badge $type={formData.auth_type}>{formData.auth_type}</Badge>
            </EndpointHeader>
            {renderEndpointForm(true)}
          </EndpointCard>
        )}

        {/* Existing Endpoints */}
        {endpoints.map(endpoint => (
          <EndpointCard 
            key={endpoint.id} 
            $isEditing={editingId === endpoint.id}
          >
            <EndpointHeader onClick={() => toggleExpand(endpoint.id)}>
              <EndpointInfo>
                <EndpointIcon $active={endpoint.is_active}>
                  <Server size={20} color="white" />
                </EndpointIcon>
                <EndpointDetails>
                  <EndpointName>{endpoint.name}</EndpointName>
                  <EndpointUrl>{endpoint.base_url}</EndpointUrl>
                </EndpointDetails>
              </EndpointInfo>
              <EndpointActions>
                <Badge $type={endpoint.auth_type}>{endpoint.auth_type}</Badge>
                {editingId !== endpoint.id && (
                  <>
                    <ActionButton 
                      $variant="primary"
                      onClick={(e) => { e.stopPropagation(); handleEdit(endpoint); }}
                      title="Edit endpoint"
                    >
                      <Edit2 size={16} />
                    </ActionButton>
                    <ActionButton 
                      $variant="danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(endpoint.id); }}
                      title="Delete endpoint"
                    >
                      <Trash2 size={16} />
                    </ActionButton>
                  </>
                )}
                {expandedId === endpoint.id ? (
                  <ChevronUp size={18} color="#a0aec0" />
                ) : (
                  <ChevronDown size={18} color="#a0aec0" />
                )}
              </EndpointActions>
            </EndpointHeader>
            
            {expandedId === endpoint.id && (
              editingId === endpoint.id ? (
                renderEndpointForm(false)
              ) : (
                <ExpandedContent>
                  <FormGrid>
                    <FormGroup>
                      <Label>Description</Label>
                      <div style={{ color: '#718096', fontSize: '14px' }}>
                        {endpoint.description || 'No description'}
                      </div>
                    </FormGroup>
                    <FormGroup>
                      <Label>Timeout / Retries</Label>
                      <div style={{ color: '#718096', fontSize: '14px' }}>
                        {endpoint.timeout_seconds}s timeout, {endpoint.retry_count} retries
                      </div>
                    </FormGroup>
                    {endpoint.default_headers && Object.keys(endpoint.default_headers).length > 0 && (
                      <FormGroupFull>
                        <Label>Default Headers</Label>
                        <pre style={{ 
                          background: '#f7fafc', 
                          padding: '12px', 
                          borderRadius: '8px',
                          fontSize: '13px',
                          margin: 0,
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(endpoint.default_headers, null, 2)}
                        </pre>
                      </FormGroupFull>
                    )}
                  </FormGrid>
                </ExpandedContent>
              )
            )}
          </EndpointCard>
        ))}

        {/* Empty State */}
        {endpoints.length === 0 && !isCreating && (
          <EmptyState>
            <EmptyIcon>
              <Server size={28} />
            </EmptyIcon>
            <EmptyTitle>No API Endpoints Configured</EmptyTitle>
            <EmptyText>
              Add your first API endpoint to start creating test data setups.
            </EmptyText>
            <AddButton onClick={handleCreate}>
              <Plus size={18} />
              Add Your First Endpoint
            </AddButton>
          </EmptyState>
        )}
      </EndpointList>
    </Container>
  );
};

export default ApiEndpointManager;
