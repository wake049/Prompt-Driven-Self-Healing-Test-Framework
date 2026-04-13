/**
 * MCP Context Provider for React Frontend
 * 
 * Provides global MCP connection management and makes MCP client
 * available throughout the React application.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import styled, { keyframes } from 'styled-components';
import { MCPFrontendClient, MCPFrontendManager } from '../services/mcpFrontendClient';

const loadingAnimation = keyframes`
  0% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
  100% { transform: translateX(300%); }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
`;

const LoadingProgressBar = styled.div`
  width: 200px;
  height: 4px;
  background: #e9ecef;
  border-radius: 2px;
  margin-top: 20px;
  overflow: hidden;
`;

const LoadingProgressFill = styled.div`
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  animation: ${loadingAnimation} 1.5s ease-in-out infinite;
`;

interface MCPContextType {
  client: MCPFrontendClient | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnect: () => Promise<void>;
}

const MCPContext = createContext<MCPContextType | undefined>(undefined);

interface MCPProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
}

/**
 * MCP Provider Component
 * 
 * This provider ensures the entire application has access to MCP functionality.
 * The frontend cannot function without MCP connection.
 */
export function MCPProvider({ children, autoConnect = false }: MCPProviderProps) {
  const [client, setClient] = useState<MCPFrontendClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeMCP = async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setError(null);

    try {
      const mcpClient = await MCPFrontendManager.getInstance();
      
      // Set up connection listener
      const unsubscribe = mcpClient.onConnectionChange((connected) => {
        setIsConnected(connected);
        if (!connected) {
          setError("MCP connection lost - frontend functionality disabled");
        } else {
          setError(null);
        }
      });

      setClient(mcpClient);
      setIsConnected(true);

      // Store unsubscribe function for cleanup
      (mcpClient as any)._unsubscribe = unsubscribe;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to MCP server';
      setError(errorMessage);
      setIsConnected(false);
      setClient(null);
    } finally {
      setIsConnecting(false);
    }
  };

  const reconnect = async () => {
    await initializeMCP();
  };

  useEffect(() => {
    // Connect only when explicitly enabled.
    if (autoConnect) {
      initializeMCP();
    }

    // Cleanup on unmount
    return () => {
      if (client && (client as any)._unsubscribe) {
        (client as any)._unsubscribe();
      }
      MCPFrontendManager.disconnect();
    };
  }, [autoConnect]);

  // Show loading state while connecting
  if (isConnecting && !client) {
    return (
      <LoadingContainer>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔌</div>
        <h2 style={{ margin: '0 0 10px 0', color: '#007bff' }}>Connecting to MCP Server</h2>
        <p style={{ margin: '0', color: '#666', textAlign: 'center' }}>
          Establishing MCP protocol connection...<br/>
          This frontend requires an active MCP server to function.
        </p>
        <LoadingProgressBar>
          <LoadingProgressFill />
        </LoadingProgressBar>
      </LoadingContainer>
    );
  }

  // Show error state if connection failed — allow degraded mode
  if (error && !isConnected && !isConnecting) {
    return (
      <MCPContext.Provider value={{
        client: null,
        isConnected: false,
        isConnecting: false,
        error,
        reconnect
      }}>
        {children}
      </MCPContext.Provider>
    );
  }

  // Render children only when MCP is connected
  return (
    <MCPContext.Provider value={{
      client,
      isConnected,
      isConnecting,
      error,
      reconnect
    }}>
      {children}
    </MCPContext.Provider>
  );
}

/**
 * Hook to access MCP context
 */
export function useMCPContext(): MCPContextType {
  const context = useContext(MCPContext);
  if (context === undefined) {
    throw new Error('useMCPContext must be used within an MCPProvider');
  }
  return context;
}

/**
 * HOC for components that require MCP connection
 */
export function withMCP<P extends object>(Component: React.ComponentType<P>) {
  return function MCPWrappedComponent(props: P) {
    const { isConnected, error } = useMCPContext();

    if (!isConnected) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
          margin: '20px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>
            🔌 MCP Connection Required
          </h3>
          <p style={{ margin: '0', color: '#856404' }}>
            {error || 'This component requires an active MCP server connection.'}
          </p>
        </div>
      );
    }

    return <Component {...props} />;
  };
}