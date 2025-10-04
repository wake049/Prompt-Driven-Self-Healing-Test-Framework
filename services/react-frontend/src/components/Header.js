import React from 'react';
import styled from 'styled-components';
import { RefreshCw, Bot, Zap } from 'lucide-react';

const HeaderContainer = styled.header`
  text-align: center;
  color: white;
  margin-bottom: 40px;
  padding: 20px;
`;

const Title = styled.h1`
  font-size: 3rem;
  margin-bottom: 10px;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  
  @media (max-width: 768px) {
    font-size: 2rem;
    flex-direction: column;
    gap: 10px;
  }
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  opacity: 0.9;
  margin-bottom: 20px;
`;

const StatusBar = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 20px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 10px;
  }
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }
`;

const StatusDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => 
    props.status === 'online' ? '#28a745' : 
    props.status === 'offline' ? '#dc3545' : '#ffc107'
  };
  animation: ${props => props.status === 'online' ? 'pulse 2s infinite' : 'none'};
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
`;

const RefreshButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const FeatureHighlight = styled.div`
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-top: 20px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 15px;
  }
`;

const Feature = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  opacity: 0.8;
`;

const Header = ({ serverHealth, onRefreshHealth }) => {
  const getStatusText = (health) => {
    switch (health) {
      case 'online': return '🟢 Online';
      case 'offline': return '🔴 Offline';
      default: return '🟡 Checking...';
    }
  };

  const handleRefresh = () => {
    onRefreshHealth();
  };

  return (
    <HeaderContainer>
      <Title>
        <Bot size={48} />
        AI Test Planner
        <Zap size={32} />
      </Title>
      
      <Subtitle>
        Convert natural language into executable test automation plans
      </Subtitle>
      
      <StatusBar>
        <StatusIndicator>
          <StatusDot status={serverHealth} />
          Service Status: {getStatusText(serverHealth)}
        </StatusIndicator>
        
        <RefreshButton onClick={handleRefresh}>
          <RefreshCw size={14} />
          Refresh
        </RefreshButton>
      </StatusBar>
      
      <FeatureHighlight>
        <Feature>
          <Bot size={16} />
          ML-Powered Intent Classification
        </Feature>
        <Feature>
          <Zap size={16} />
          Real-time Test Generation
        </Feature>
        <Feature>
          <RefreshCw size={16} />
          REST API Integration
        </Feature>
      </FeatureHighlight>
    </HeaderContainer>
  );
};

export default Header;