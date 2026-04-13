import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import unifiedApiClient from '../../../shared/utils/unifiedApiClient';

const Container = styled.div`
  padding: 24px;
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0;
`;

const CreateButton = styled.button`
  background: #185FA5;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-2px);
  }
`;

const SuitesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
`;

const SuiteCard = styled.div<{ $isActive?: boolean }>`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid ${props => props.$isActive ? '#185FA5' : '#e0e0e0'};
  transition: all 0.2s;
  cursor: pointer;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
`;

const SuiteName = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 8px 0;
`;

const SuiteDescription = styled.p`
  font-size: 14px;
  color: #718096;
  margin: 0 0 16px 0;
  line-height: 1.5;
`;

const SuiteInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const TestCount = styled.span`
  font-size: 14px;
  color: #4a5568;
  font-weight: 500;
`;

const BrowserTags = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
`;

const BrowserTag = styled.span`
  background: #185FA520;
  color: #185FA5;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  flex: 1;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  
  ${props => props.variant === 'primary' ? `
    background: #185FA5;
    color: white;
    
    &:hover {
      opacity: 0.9;
    }
  ` : `
    background: white;
    color: #185FA5;
    border: 2px solid #185FA5;
    
    &:hover {
      background: #185FA510;
    }
  `}
`;

const Modal = styled.div<{ $isOpen: boolean }>`
  display: ${props => props.$isOpen ? 'flex' : 'none'};
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 32px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #2d3748;
  margin: 0 0 24px 0;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #185FA5;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  min-height: 80px;
  resize: vertical;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: #185FA5;
  }
`;

const CheckboxGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`;

const CheckboxLabel = styled.label<{ $checked?: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px;
  border: 2px solid ${props => props.$checked ? '#185FA5' : '#e2e8f0'};
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #185FA5;
  }

  input {
    margin-right: 8px;
  }

  span {
    font-size: 14px;
    font-weight: 500;
  }
`;

const ModalActions = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 24px;
`;

interface TestSuite {
  id: string;
  name: string;
  description: string;
  browser_config: { browsers: string[] };
  is_active: boolean;
  test_count: number;
}

export const TestSuitesView: React.FC = () => {
  const navigate = useNavigate();
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    loadSuites();
  }, []);

  const loadSuites = async () => {
    try {
      setLoading(true);
      const response = await unifiedApiClient.request('/api/v1/test-suites/suites', { method: 'GET' });
      if (response.success) {
        setSuites(response.data);
      }
    } catch (error) {
      console.error('Error loading test suites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuite = async () => {
    try {
      const response = await unifiedApiClient.request('/api/v1/test-suites/suites', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description
          // Browser config will come from policy engine defaults
        })
      });

      if (response.success) {
        setShowCreateModal(false);
        setFormData({ name: '', description: '' });
        loadSuites();
      }
    } catch (error) {
      console.error('Error creating suite:', error);
      alert('Failed to create test suite');
    }
  };

  const handleBrowserToggle = (browser: string) => {
    // Removed - browsers are now configured in Policy Engine
  };

  const handleExecuteSuite = async (suiteId: string) => {
    try {
      const response = await unifiedApiClient.request(`/api/v1/test-suites/suites/${suiteId}/execute`, {
        method: 'POST'
      });
      alert(response.message);
    } catch (error) {
      console.error('Error executing suite:', error);
      alert('Failed to execute test suite');
    }
  };

  if (loading) {
    return <Container>Loading test suites...</Container>;
  }

  return (
    <Container>
      <Header>
        <Title>Test Suites</Title>
        <CreateButton onClick={() => setShowCreateModal(true)}>
          + Create Suite
        </CreateButton>
      </Header>

      {suites.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#718096' }}>
          <p>No test suites yet. Create one to organize your tests!</p>
        </div>
      ) : (
        <SuitesGrid>
          {suites.map(suite => (
            <SuiteCard 
              key={suite.id} 
              $isActive={suite.is_active}
              onClick={() => navigate(`/app/test-suites/${suite.id}`)}
            >
              <SuiteName>{suite.name}</SuiteName>
              <SuiteDescription>{suite.description || 'No description'}</SuiteDescription>
              
              <SuiteInfo>
                <TestCount>{suite.test_count} tests</TestCount>
              </SuiteInfo>

              <BrowserTags>
                {suite.browser_config?.browsers?.map(browser => (
                  <BrowserTag key={browser}>{browser}</BrowserTag>
                )) || <BrowserTag>chrome</BrowserTag>}
              </BrowserTags>

              <ActionButtons>
                <ActionButton 
                  variant="primary" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExecuteSuite(suite.id);
                  }}
                >
                  Run Suite
                </ActionButton>
                <ActionButton 
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/app/test-suites/${suite.id}`);
                  }}
                >
                  Manage
                </ActionButton>
              </ActionButtons>
            </SuiteCard>
          ))}
        </SuitesGrid>
      )}

      <Modal $isOpen={showCreateModal}>
        <ModalContent>
          <ModalTitle>Create Test Suite</ModalTitle>
          
          <FormGroup>
            <Label>Suite Name</Label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Smoke Tests"
            />
          </FormGroup>

          <FormGroup>
            <Label>Description</Label>
            <TextArea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the purpose of this test suite..."
            />
          </FormGroup>

          <FormGroup>
            <Label>Browser Configuration</Label>
            <div style={{ 
              padding: '12px', 
              background: '#f8f9fa', 
              borderRadius: '8px',
              border: '2px solid #e2e8f0'
            }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#4a5568', lineHeight: '1.5' }}>
                🌐 Browsers are configured in the <strong>Policy Engine</strong>. 
                This suite will automatically use the browsers selected in your policy settings.
              </p>
              <a 
                href="/app/policy-engine" 
                style={{ 
                  display: 'inline-block',
                  marginTop: '8px',
                  color: '#185FA5', 
                  fontSize: '13px',
                  fontWeight: '600',
                  textDecoration: 'none'
                }}
              >
                → Configure browsers in Policy Engine
              </a>
            </div>
          </FormGroup>

          <ModalActions>
            <ActionButton variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </ActionButton>
            <ActionButton variant="primary" onClick={handleCreateSuite}>
              Create Suite
            </ActionButton>
          </ModalActions>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default TestSuitesView;
