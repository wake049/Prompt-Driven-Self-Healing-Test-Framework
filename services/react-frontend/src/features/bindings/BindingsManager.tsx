import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import unifiedApiClient from '../../shared/utils/unifiedApiClient';
// ================================
// Styled Components
// ================================
const Container = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 16px;
  padding: 32px;
  margin-top: 24px;
  box-shadow: ${props => props.theme.shadows.medium};
  position: relative;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px 16px 0 0;
  }
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    background: #2a2a2a;
    border-color: #404040;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
`;
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e9ecef;
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    border-bottom-color: #404040;
  }
`;
const Title = styled.h3<{ theme: any }>`
  margin: 0;
  color: ${props => props.theme.colors.text};
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;
const ButtonGroup = styled.div`
  display: flex;
  gap: 16px;
`;
const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'success' }>`
  padding: 12px 24px;
  border: 2px solid;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-color: transparent;
          color: white;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          &:hover { 
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
          }
        `;
      case 'success':
        return `
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          border-color: transparent;
          color: white;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          &:hover { 
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
          }
        `;
      default:
        return `
          background: white;
          border-color: #e9ecef;
          color: #495057;
          &:hover { 
            background: #f8f9fa;
            border-color: #667eea;
            transform: translateY(-1px);
          }
        `;
    }
  }}
`;
const BindingsList = styled.div`
  margin-bottom: 24px;
`;
const BindingItem = styled.div`
  border: 1px solid #e9ecef;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    border-color: #667eea;
  }
`;
const BindingHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
`;
const BindingName = styled.span`
  font-weight: 700;
  color: #2c3e50;
  font-size: 18px;
`;
const BindingType = styled.span<{ type: string }>`
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  ${props => {
    switch (props.type) {
      case 'extract':
        return `background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white;`;
      case 'formula':
        return `background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white;`;
      case 'constant':
        return `background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;`;
      default:
        return `background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: white;`;
    }
  }}
`;
const BindingDetails = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  font-size: 14px;
`;
const DetailItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
const DetailLabel = styled.span`
  font-weight: 600;
  color: #4b5563;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;
const DetailValue = styled.span`
  color: #333;
  font-family: monospace;
  background: white;
  padding: 8px 12px;
  border-radius: 8px;
  border: 2px solid #e9ecef;
  transition: all 0.3s ease;
  &:focus-within {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;
const EmptyState = styled.div`
  text-align: center;
  padding: 60px 40px;
  color: #6b7280;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 16px;
  border: 2px dashed #cbd5e1;
  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.6;
  }
  .empty-title {
    font-size: 18px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
  }
  .empty-description {
    font-size: 14px;
    color: #6b7280;
  }
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
  padding: 20px;
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  color: #dc2626;
  border: 2px solid #f87171;
  border-radius: 12px;
  margin-bottom: 20px;
  font-weight: 500;
`;
const StyledInput = styled.input`
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: white;
  color: #2c3e50;
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    transform: translateY(-1px);
  }
  &::placeholder {
    color: #9ca3af;
  }
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    background: #404040;
    border-color: #555;
    color: #ffffff;
    &:focus {
      border-color: #667eea;
    }
    &::placeholder {
      color: #aaa;
    }
  }
`;
const StyledSelect = styled.select`
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: white;
  color: #2c3e50;
  cursor: pointer;
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    transform: translateY(-1px);
  }
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    background: #404040;
    border-color: #555;
    color: #ffffff;
    &:focus {
      border-color: #667eea;
    }
  }
`;
const RemoveButton = styled.button`
  padding: 8px 16px;
  font-size: 12px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }
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
  const { theme } = useTheme();
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
      const response = await unifiedApiClient.updatePromptBindings(promptId, bindings);
      if (response.success) {
        // Immediately reload to verify save
        await loadBindings();
      }
    } catch (error: any) {
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
    <Container theme={theme}>
      <Header>
        <Title theme={theme}>Test Variables ({bindings.bindings.length})</Title>
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
            <div className="empty-icon">📊</div>
            <div className="empty-title">No variables configured</div>
            <div className="empty-description">
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
                  <RemoveButton
                    onClick={() => removeBinding(index)}
                  >
                    Remove
                  </RemoveButton>
                </div>
              </BindingHeader>
              <BindingDetails>
                <DetailItem>
                  <DetailLabel>Variable Name:</DetailLabel>
                  <StyledInput
                    type="text"
                    value={binding.name}
                    onChange={(e) => updateBinding(index, { ...binding, name: e.target.value })}
                    placeholder="Enter variable name"
                  />
                </DetailItem>
                <DetailItem>
                  <DetailLabel>Description:</DetailLabel>
                  <StyledInput
                    type="text"
                    value={binding.description || ''}
                    onChange={(e) => updateBinding(index, { ...binding, description: e.target.value })}
                    placeholder="Describe what this variable represents"
                  />
                </DetailItem>
                <DetailItem>
                  <DetailLabel>Type:</DetailLabel>
                  <StyledSelect
                    value={binding.type}
                    onChange={(e) => updateBinding(index, { ...binding, type: e.target.value as 'extract' | 'formula' | 'constant' })}
                  >
                    <option value="extract">Extract from Page</option>
                    <option value="formula">Calculate using Formula</option>
                    <option value="constant">Fixed Value</option>
                  </StyledSelect>
                </DetailItem>
                {binding.type === 'extract' && (
                  <>
                    <DetailItem>
                      <DetailLabel>CSS Selector:</DetailLabel>
                      <StyledInput
                        type="text"
                        value={binding.selector || ''}
                        onChange={(e) => updateBinding(index, { ...binding, selector: e.target.value })}
                        placeholder="e.g., .price, #total, [data-testid='amount']"
                      />
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>Extract Type:</DetailLabel>
                      <StyledSelect
                        value={binding.extract_type || 'text'}
                        onChange={(e) => updateBinding(index, { ...binding, extract_type: e.target.value })}
                      >
                        <option value="text">Text Content</option>
                        <option value="attribute">Attribute Value</option>
                        <option value="value">Input Value</option>
                      </StyledSelect>
                    </DetailItem>
                    {binding.extract_type === 'attribute' && (
                      <DetailItem>
                        <DetailLabel>Attribute Name:</DetailLabel>
                        <StyledInput
                          type="text"
                          value={binding.attribute || ''}
                          onChange={(e) => updateBinding(index, { ...binding, attribute: e.target.value })}
                          placeholder="e.g., href, src, data-value"
                        />
                      </DetailItem>
                    )}
                    <DetailItem>
                      <DetailLabel>Fallback Value:</DetailLabel>
                      <StyledInput
                        type="text"
                        value={binding.fallback_value || ''}
                        onChange={(e) => updateBinding(index, { ...binding, fallback_value: e.target.value })}
                        placeholder="Default value if extraction fails"
                      />
                    </DetailItem>
                  </>
                )}
                {binding.type === 'formula' && (
                  <DetailItem style={{ gridColumn: '1 / -1' }}>
                    <DetailLabel>Formula:</DetailLabel>
                    <StyledInput
                      type="text"
                      value={binding.formula || ''}
                      onChange={(e) => updateBinding(index, { ...binding, formula: e.target.value })}
                      placeholder="e.g., ${var1} + ${var2}, ${price} * 1.1"
                      style={{ width: '100%' }}
                    />
                  </DetailItem>
                )}
                {binding.type === 'constant' && (
                  <DetailItem>
                    <DetailLabel>Value:</DetailLabel>
                    <StyledInput
                      type="text"
                      value={binding.value || ''}
                      onChange={(e) => updateBinding(index, { ...binding, value: e.target.value })}
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