import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../contexts/AuthContext';
import unifiedApiClient from '../../shared/utils/unifiedApiClient';

// ================================
// Styled Components
// ================================

const Container = styled.div`
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  margin-top: 16px;
`;

const Header = styled.div`
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #e9ecef;
  padding-bottom: 16px;
`;

const Title = styled.h3`
  margin: 0;
  color: #333;
  font-size: 18px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'success' }>`
  padding: 8px 16px;
  border: 1px solid;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  
  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: #007bff;
          border-color: #007bff;
          color: white;
          &:hover { background: #0056b3; }
        `;
      case 'success':
        return `
          background: #28a745;
          border-color: #28a745;
          color: white;
          &:hover { background: #1e7e34; }
        `;
      default:
        return `
          background: white;
          border-color: #dee2e6;
          color: #495057;
          &:hover { background: #f8f9fa; }
        `;
    }
  }}
`;

const BindingsList = styled.div`
  margin-bottom: 20px;
`;

const BindingItem = styled.div`
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 12px;
  background: #f8f9fa;
`;

const BindingHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const BindingName = styled.span`
  font-weight: 600;
  color: #333;
  font-size: 16px;
`;

const BindingType = styled.span<{ type: string }>`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  
  ${props => {
    switch (props.type) {
      case 'extract':
        return `background: #e3f2fd; color: #1565c0;`;
      case 'formula':
        return `background: #f3e5f5; color: #7b1fa2;`;
      case 'constant':
        return `background: #e8f5e8; color: #2e7d32;`;
      default:
        return `background: #f5f5f5; color: #616161;`;
    }
  }}
`;

const BindingDetails = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  font-size: 14px;
`;

const DetailItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const DetailLabel = styled.span`
  font-weight: 500;
  color: #666;
`;

const DetailValue = styled.span`
  color: #333;
  font-family: monospace;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px dashed #dee2e6;
`;

const TemplateSelector = styled.div`
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
`;

const TemplateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
  margin-top: 12px;
`;

const TemplateCard = styled.div`
  padding: 12px;
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #007bff;
    box-shadow: 0 2px 4px rgba(0,123,255,0.1);
  }
`;

const TemplateTitle = styled.div`
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
`;

const TemplateDescription = styled.div`
  font-size: 12px;
  color: #666;
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 20px;
  color: #666;
`;

const ErrorState = styled.div`
  padding: 16px;
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  margin-bottom: 16px;
`;

// ================================
// Types
// ================================

interface DataBinding {
  name: string;
  description?: string;
  type: 'extract' | 'formula' | 'constant';
  selector?: string;
  extract_type?: string;
  attribute?: string;
  formula?: string;
  value?: any;
  regex_pattern?: string;
  fallback_value?: any;
}

interface TestBindings {
  bindings: DataBinding[];
}

interface BindingTemplate {
  name: string;
  description: string;
  bindings: TestBindings;
}

interface BindingsManagerProps {
  promptId?: string;
}

// ================================
// Component
// ================================

const BindingsManager: React.FC<BindingsManagerProps> = ({ promptId }) => {
  const { user } = useAuth();
  const [bindings, setBindings] = useState<TestBindings>({ bindings: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load bindings on mount
  useEffect(() => {
    if (promptId && user) {
      loadBindings();
    }
  }, [promptId, user]);

  const loadBindings = async () => {
    if (!promptId || !user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await unifiedApiClient.getPromptBindings(promptId);
      if (response.bindings) {
        setBindings({ bindings: response.bindings });
      }
    } catch (error: any) {
      console.error('Failed to load bindings:', error);
      setError(`Failed to load bindings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveBindings = async () => {
    if (!promptId || !user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Debug: Check if auth token exists
      const token = localStorage.getItem('auth_token');
      console.log('🔐 Auth token exists:', !!token);
      console.log('🔐 Token preview:', token ? `${token.substring(0, 20)}...` : 'No token');
      console.log('👤 User context:', user);
      console.log('📝 Saving bindings for prompt:', promptId);
      console.log(' Bindings data to save:', bindings);
      
      const response = await unifiedApiClient.updatePromptBindings(promptId, bindings);
      console.log(' Save response:', response);
      
      if (response.success) {
        console.log(' Bindings saved successfully');
        // Immediately reload to verify save
        await loadBindings();
      }
    } catch (error: any) {
      console.error('Failed to save bindings:', error);
      setError(`Failed to save bindings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addNewBinding = () => {
    const newBinding = {
      name: `variable_${bindings.bindings.length + 1}`,
      description: '',
      type: 'extract' as const,
      selector: '',
      extract_type: 'text',
      fallback_value: ''
    };
    
    setBindings({
      ...bindings,
      bindings: [...bindings.bindings, newBinding]
    });
  };

  const removeBinding = (index: number) => {
    const updatedBindings = bindings.bindings.filter((_, i) => i !== index);
    setBindings({
      ...bindings,
      bindings: updatedBindings
    });
  };

  const updateBinding = (index: number, updatedBinding: any) => {
    const updatedBindings = bindings.bindings.map((binding, i) => 
      i === index ? updatedBinding : binding
    );
    setBindings({
      ...bindings,
      bindings: updatedBindings
    });
  };

  if (!user) {
    return (
      <Container>
        <ErrorState>Please log in to manage bindings.</ErrorState>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container>
        <LoadingState>Loading bindings...</LoadingState>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>Test Variables ({bindings.bindings.length})</Title>
        <ButtonGroup>
          <Button onClick={addNewBinding}>
            Add Variable
          </Button>
          <Button variant="primary" onClick={saveBindings} disabled={bindings.bindings.length === 0}>
            Save Variables
          </Button>
        </ButtonGroup>
      </Header>

      {error && (
        <ErrorState>{error}</ErrorState>
      )}

      <BindingsList>
        {bindings.bindings.length === 0 ? (
          <EmptyState>
            <div>No variables configured</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>
              Click "Add Variable" to define variables for your test steps
            </div>
          </EmptyState>
        ) : (
          bindings.bindings.map((binding, index) => (
            <BindingItem key={index}>
              <BindingHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BindingName>{binding.name}</BindingName>
                  <BindingType type={binding.type}>{binding.type}</BindingType>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => removeBinding(index)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
              </BindingHeader>
              
              <BindingDetails>
                <DetailItem>
                  <DetailLabel>Variable Name:</DetailLabel>
                  <input
                    type="text"
                    value={binding.name}
                    onChange={(e) => updateBinding(index, { ...binding, name: e.target.value })}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                    placeholder="Enter variable name"
                  />
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Description:</DetailLabel>
                  <input
                    type="text"
                    value={binding.description || ''}
                    onChange={(e) => updateBinding(index, { ...binding, description: e.target.value })}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                    placeholder="Describe what this variable represents"
                  />
                </DetailItem>
                
                <DetailItem>
                  <DetailLabel>Type:</DetailLabel>
                  <select
                    value={binding.type}
                    onChange={(e) => updateBinding(index, { ...binding, type: e.target.value as 'extract' | 'formula' | 'constant' })}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  >
                    <option value="extract">Extract from Page</option>
                    <option value="formula">Calculate using Formula</option>
                    <option value="constant">Fixed Value</option>
                  </select>
                </DetailItem>

                {binding.type === 'extract' && (
                  <>
                    <DetailItem>
                      <DetailLabel>CSS Selector:</DetailLabel>
                      <input
                        type="text"
                        value={binding.selector || ''}
                        onChange={(e) => updateBinding(index, { ...binding, selector: e.target.value })}
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                        placeholder="e.g., .price, #total, [data-testid='amount']"
                      />
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>Extract Type:</DetailLabel>
                      <select
                        value={binding.extract_type || 'text'}
                        onChange={(e) => updateBinding(index, { ...binding, extract_type: e.target.value })}
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      >
                        <option value="text">Text Content</option>
                        <option value="attribute">Attribute Value</option>
                        <option value="value">Input Value</option>
                      </select>
                    </DetailItem>
                    {binding.extract_type === 'attribute' && (
                      <DetailItem>
                        <DetailLabel>Attribute Name:</DetailLabel>
                        <input
                          type="text"
                          value={binding.attribute || ''}
                          onChange={(e) => updateBinding(index, { ...binding, attribute: e.target.value })}
                          style={{
                            flex: 1,
                            padding: '8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            fontSize: '14px'
                          }}
                          placeholder="e.g., href, src, data-value"
                        />
                      </DetailItem>
                    )}
                    <DetailItem>
                      <DetailLabel>Fallback Value:</DetailLabel>
                      <input
                        type="text"
                        value={binding.fallback_value || ''}
                        onChange={(e) => updateBinding(index, { ...binding, fallback_value: e.target.value })}
                        style={{
                          flex: 1,
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                        placeholder="Default value if extraction fails"
                      />
                    </DetailItem>
                  </>
                )}
                
                {binding.type === 'formula' && (
                  <DetailItem style={{ gridColumn: '1 / -1' }}>
                    <DetailLabel>Formula:</DetailLabel>
                    <input
                      type="text"
                      value={binding.formula || ''}
                      onChange={(e) => updateBinding(index, { ...binding, formula: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                      placeholder="e.g., ${var1} + ${var2}, ${price} * 1.1"
                    />
                  </DetailItem>
                )}
                
                {binding.type === 'constant' && (
                  <DetailItem>
                    <DetailLabel>Value:</DetailLabel>
                    <input
                      type="text"
                      value={binding.value || ''}
                      onChange={(e) => updateBinding(index, { ...binding, value: e.target.value })}
                      style={{
                        flex: 1,
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                      placeholder="Enter constant value"
                    />
                  </DetailItem>
                )}
              </BindingDetails>
            </BindingItem>
          ))
        )}
      </BindingsList>
    </Container>
  );
};

export default BindingsManager;