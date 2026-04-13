/**
 * API Test Data Page
 * Main page for managing API-based test data creation.
 * Allows testers to:
 * - Configure API endpoints (authentication, headers, etc.)
 * - Create data templates (request blueprints with variable extraction)
 * - Create data sets (variable values for templates)
 * - Set up test data pipelines that run before UI tests
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { useTheme } from '../../contexts/ThemeContext';
import ApiEndpointManager from './components/ApiEndpointManager';
import DataTemplateEditor from './components/DataTemplateEditor';
import TestDataSetupPanel from './components/TestDataSetupPanel';
import { Database, FileCode, Settings, Play, Server, FileJson, Layers } from 'lucide-react';

type TabType = 'endpoints' | 'templates' | 'setups';

const Container = styled.div`
  padding: 32px 40px;
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
  width: 100%;
  font-family: '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif;
  
  @media (max-width: 768px) {
    padding: 16px;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  background: ${props => props.theme.colors.surface};
  padding: 32px 40px;
  border-radius: 16px;
  box-shadow: ${props => props.theme.shadows.medium};
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    margin-bottom: 24px;
  }
`;

const TitleSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const IconWrapper = styled.div`
  width: 56px;
  height: 56px;
  background: #185FA5;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
`;

const TitleText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0;
`;

const TabsContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: ${props => props.theme.colors.surface};
  padding: 8px;
  border-radius: 12px;
  box-shadow: ${props => props.theme.shadows.small};
`;

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  background: ${props => props.$active 
    ? '#185FA5' 
    : 'transparent'};
  color: ${props => props.$active 
    ? 'white' 
    : props.theme.colors.textSecondary};
  
  &:hover {
    background: ${props => props.$active 
      ? '#185FA5' 
      : props.theme.colors.hover};
  }
`;

const ContentArea = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 24px;
  box-shadow: ${props => props.theme.shadows.medium};
  min-height: 500px;
`;

const ApiTestDataPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('endpoints');
  const { theme } = useTheme();

  const tabs = [
    { id: 'endpoints' as TabType, label: 'API Endpoints', icon: Server, description: 'Configure API servers and authentication' },
    { id: 'templates' as TabType, label: 'Data Templates', icon: FileJson, description: 'Define request templates and extractors' },
    { id: 'setups' as TabType, label: 'Test Setups', icon: Layers, description: 'Create test data pipelines' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'endpoints':
        return <ApiEndpointManager />;
      case 'templates':
        return <DataTemplateEditor />;
      case 'setups':
        return <TestDataSetupPanel />;
      default:
        return null;
    }
  };

  return (
    <Container>
      <Header>
        <TitleSection>
          <IconWrapper>
            <Database size={28} color="white" />
          </IconWrapper>
          <TitleText>
            <Title>API Test Data</Title>
            <Subtitle>Configure APIs to create test data before UI tests run</Subtitle>
          </TitleText>
        </TitleSection>
      </Header>

      <TabsContainer>
        {tabs.map(tab => (
          <Tab
            key={tab.id}
            $active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.description}
          >
            <tab.icon size={18} />
            {tab.label}
          </Tab>
        ))}
      </TabsContainer>

      <ContentArea>
        {renderContent()}
      </ContentArea>
    </Container>
  );
};

export default ApiTestDataPage;
