import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { apiService } from './services/api';
import { JsonViewer } from '@textea/json-viewer';
import { TestPlanResponse, SystemStats } from './types';
import MCPElementsViewer from './components/MCPElementsViewer';
import './App.css';

const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`;

const Navigation = styled.nav`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const NavBrand = styled.h1`
  color: white;
  margin: 0;
  font-size: 1.5rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
`;

const NavLinks = styled.div`
  display: flex;
  gap: 1rem;
`;

const NavLink = styled(Link)<{ $active?: boolean }>`
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
  background: ${props => props.$active ? 'rgba(255, 255, 255, 0.2)' : 'transparent'};
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
`;

const PageContainer = styled.div`
  padding: 20px;
`;

const Header = styled.h1`
  color: white;
  text-align: center;
  margin-bottom: 30px;
  font-size: 2.5rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin: 20px 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const InputContainer = styled.div`
  margin-bottom: 20px;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const Button = styled.button`
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 12px;
  
  &:hover {
    background: #5a6fd8;
  }
  
  &:disabled {
    background: #a0a0a0;
    cursor: not-allowed;
  }
`;

const StatusIndicator = styled.div<{ status: 'online' | 'offline' | 'loading' }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 500;
  
  ${props => {
    switch (props.status) {
      case 'online':
        return 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;';
      case 'offline':
        return 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;';
      case 'loading':
        return 'background: #fff3cd; color: #856404; border: 1px solid #ffeaa7;';
      default:
        return '';
    }
  }}
`;

const StatusDot = styled.div<{ status: 'online' | 'offline' | 'loading' }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  
  ${props => {
    switch (props.status) {
      case 'online':
        return 'background: #28a745;';
      case 'offline':
        return 'background: #dc3545;';
      case 'loading':
        return 'background: #ffc107;';
      default:
        return '';
    }
  }}
`;

interface AppState {
  serverStatus: 'online' | 'offline' | 'loading';
}

// Navigation Component
const NavBar: React.FC<{ serverStatus: 'online' | 'offline' | 'loading' }> = ({ serverStatus }) => {
  const location = useLocation();
  
  return (
    <Navigation>
      <NavBrand>AI Test Automation Platform</NavBrand>
      <NavLinks>
        <NavLink to="/" $active={location.pathname === '/'}>
          Test Planner
        </NavLink>
        <NavLink to="/view-elements" $active={location.pathname === '/view-elements'}>
          📍 View Elements
        </NavLink>
        <StatusIndicator status={serverStatus}>
          <StatusDot status={serverStatus} />
          {serverStatus === 'online' && 'Connected'}
          {serverStatus === 'offline' && 'Disconnected'}
          {serverStatus === 'loading' && 'Checking...'}
        </StatusIndicator>
      </NavLinks>
    </Navigation>
  );
};

// Test Planner Page Component
const TestPlannerPage: React.FC = () => {
  const [state, setState] = useState<{
    prompt: string;
    testPlan: TestPlanResponse | null;
    systemStats: SystemStats | null;
    isLoading: boolean;
    error: string | null;
  }>({
    prompt: '',
    testPlan: null,
    systemStats: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    const loadSystemStats = async () => {
      try {
        const stats = await apiService.getSystemStats();
        setState(prev => ({ ...prev, systemStats: stats }));
      } catch (error) {
        console.error('Failed to load system stats:', error);
      }
    };

    loadSystemStats();
  }, []);

  const generateTestPlan = async () => {
    if (!state.prompt.trim()) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const plan = await apiService.generateTestPlan(state.prompt);
      setState(prev => ({ ...prev, testPlan: plan }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to generate test plan'
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <PageContainer>
      <Header>AI Test Automation Planner</Header>
      
      {state.systemStats && (
        <Card>
          <h2>System Statistics</h2>
          <JsonViewer value={state.systemStats} theme="light" />
        </Card>
      )}

      <Card>
        <h2>Generate Test Plan</h2>
        <InputContainer>
          <label htmlFor="prompt" style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Describe what you want to test:
          </label>
          <TextArea
            id="prompt"
            value={state.prompt}
            onChange={(e) => setState(prev => ({ ...prev, prompt: e.target.value }))}
            placeholder="Example: Login to the application with valid credentials and navigate to the dashboard"
            disabled={state.isLoading}
          />
          <Button 
            onClick={generateTestPlan}
            disabled={state.isLoading || !state.prompt.trim()}
          >
            {state.isLoading ? 'Generating...' : 'Generate Test Plan'}
          </Button>
        </InputContainer>

        {state.error && (
          <div style={{ 
            background: '#f8d7da', 
            color: '#721c24', 
            padding: '12px', 
            borderRadius: '8px',
            border: '1px solid #f5c6cb',
            marginTop: '16px'
          }}>
            Error: {state.error}
          </div>
        )}
      </Card>

      {state.testPlan && (
        <Card>
          <h2>Generated Test Plan</h2>
          <div style={{ marginTop: '16px' }}>
            <JsonViewer value={state.testPlan} theme="light" />
          </div>
        </Card>
      )}
    </PageContainer>
  );
};

// Main App Component
const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    serverStatus: 'loading'
  });

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setAppState(prev => ({ ...prev, serverStatus: 'loading' }));
        await apiService.getHealth();
        setAppState(prev => ({ ...prev, serverStatus: 'online' }));
      } catch (error) {
        setAppState(prev => ({ ...prev, serverStatus: 'offline' }));
      }
    };

    checkServerHealth();
    
    // Check health every 30 seconds
    const interval = setInterval(checkServerHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <AppContainer>
        <NavBar serverStatus={appState.serverStatus} />
        <Routes>
          <Route path="/" element={<TestPlannerPage />} />
          <Route path="/view-elements" element={<MCPElementsViewer />} />
        </Routes>
      </AppContainer>
    </Router>
  );
};

export default App;