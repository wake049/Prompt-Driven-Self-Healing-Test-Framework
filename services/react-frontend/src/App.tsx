import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { apiService } from './services/api';
import { JsonViewer } from '@textea/json-viewer';
import { TestPlanResponse, SystemStats } from './types';
import './App.css';

const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin: 20px 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const Header = styled.h1`
  color: white;
  text-align: center;
  margin-bottom: 30px;
  font-size: 2.5rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
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
  prompt: string;
  testPlan: TestPlanResponse | null;
  systemStats: SystemStats | null;
  isLoading: boolean;
  error: string | null;
  serverStatus: 'online' | 'offline' | 'loading';
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    prompt: '',
    testPlan: null,
    systemStats: null,
    isLoading: false,
    error: null,
    serverStatus: 'loading'
  });

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        setState(prev => ({ ...prev, serverStatus: 'loading' }));
        await apiService.getHealth();
        setState(prev => ({ ...prev, serverStatus: 'online' }));
      } catch (error) {
        setState(prev => ({ ...prev, serverStatus: 'offline' }));
      }
    };

    const loadSystemStats = async () => {
      try {
        const stats = await apiService.getSystemStats();
        setState(prev => ({ ...prev, systemStats: stats }));
      } catch (error) {
        console.error('Failed to load system stats:', error);
      }
    };

    checkServerHealth();
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

  const refreshHealth = async () => {
    try {
      setState(prev => ({ ...prev, serverStatus: 'loading' }));
      await apiService.getHealth();
      setState(prev => ({ ...prev, serverStatus: 'online' }));
    } catch (error) {
      setState(prev => ({ ...prev, serverStatus: 'offline' }));
    }
  };

  return (
    <AppContainer>
      <Header>AI Test Automation Planner</Header>
      
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Server Status</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <StatusIndicator status={state.serverStatus}>
              <StatusDot status={state.serverStatus} />
              {state.serverStatus === 'online' && 'Connected'}
              {state.serverStatus === 'offline' && 'Disconnected'}
              {state.serverStatus === 'loading' && 'Checking...'}
            </StatusIndicator>
            <Button onClick={refreshHealth} style={{ margin: 0, padding: '6px 12px', fontSize: '14px' }}>
              Refresh
            </Button>
          </div>
        </div>
        
        {state.systemStats && (
          <div>
            <h3>System Statistics</h3>
            <JsonViewer value={state.systemStats} theme="light" />
          </div>
        )}
      </Card>

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
    </AppContainer>
  );
};

export default App;