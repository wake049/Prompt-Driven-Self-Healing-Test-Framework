/**
 * MCP Context Provider for React Frontend
 * 
 * Provides global MCP connection management and makes MCP client
 * available throughout the React application.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { MCPFrontendClient, MCPFrontendManager } from '../services/mcpFrontendClient';

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
}

/**
 * MCP Provider Component
 * 
 * This provider ensures the entire application has access to MCP functionality.
 * The frontend cannot function without MCP connection.
 */
export function MCPProvider({ children }: MCPProviderProps) {
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
    // Initialize MCP on mount
    initializeMCP();

    // Cleanup on unmount
    return () => {
      if (client && (client as any)._unsubscribe) {
        (client as any)._unsubscribe();
      }
      MCPFrontendManager.disconnect();
    };
  }, []);

  // Show loading state while connecting
  if (isConnecting && !client) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔌</div>
        <h2 style={{ margin: '0 0 10px 0', color: '#007bff' }}>Connecting to MCP Server</h2>
        <p style={{ margin: '0', color: '#666', textAlign: 'center' }}>
          Establishing MCP protocol connection...<br/>
          This frontend requires an active MCP server to function.
        </p>
        <div style={{
          width: '200px',
          height: '4px',
          background: '#e9ecef',
          borderRadius: '2px',
          marginTop: '20px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: '50%',
            height: '100%',
            background: 'linear-gradient(90deg, #007bff, #0056b3)',
            animation: 'loading 1.5s ease-in-out infinite'
          }} />
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(100%); }
            100% { transform: translateX(300%); }
          }
        `}</style>
      </div>
    );
  }

  // Show error state if connection failed
  if (error && !isConnected && !isConnecting) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>⚠️</div>
        <h2 style={{ margin: '0 0 15px 0', color: '#dc3545' }}>
          MCP Server Connection Required
        </h2>
        <div style={{
          background: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          maxWidth: '500px'
        }}>
          <p style={{ margin: '0 0 10px 0', color: '#721c24', fontWeight: 'bold' }}>
            Frontend Disabled
          </p>
          <p style={{ margin: '0 0 10px 0', color: '#721c24' }}>
            This React frontend requires an active MCP server connection to function.
            No fallback modes are available.
          </p>
          <p style={{ margin: '0', color: '#721c24', fontSize: '14px' }}>
            Error: {error}
          </p>
        </div>
        <div style={{
          background: '#d1ecf1',
          border: '1px solid #bee5eb',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px',
          maxWidth: '500px'
        }}>
          <p style={{ margin: '0 0 10px 0', color: '#0c5460', fontWeight: 'bold' }}>
            To start the MCP server:
          </p>
          <code style={{
            display: 'block',
            background: '#495057',
            color: '#fff',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '14px',
            margin: '0'
          }}>
            cd services/mcp-server<br/>
            python main.py --ws
          </code>
        </div>
        <button
          onClick={reconnect}
          disabled={isConnecting}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            opacity: isConnecting ? 0.6 : 1
          }}
        >
          {isConnecting ? '🔄 Connecting...' : '🔄 Retry Connection'}
        </button>
      </div>
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