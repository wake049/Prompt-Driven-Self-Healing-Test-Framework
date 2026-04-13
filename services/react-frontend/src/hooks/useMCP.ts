/**
 * React hooks for MCP client integration
 * 
 * Provides React hooks for managing MCP connection state and making MCP calls
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MCPFrontendManager, MCPFrontendClient } from '../services/mcpFrontendClient';

/**
 * Hook for managing MCP connection state
 */
export function useMCPConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<MCPFrontendClient | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setError(null);

    try {
      const mcpClient = await MCPFrontendManager.getInstance();
      setClient(mcpClient);
      setIsConnected(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to MCP server';
      setError(errorMessage);
      setIsConnected(false);
      setClient(null);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting]);

  const disconnect = useCallback(() => {
    MCPFrontendManager.disconnect();
    setIsConnected(false);
    setClient(null);
    setError(null);
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isConnected && !isConnecting) {
        connect();
      }
    }, 5000);
  }, [isConnected, isConnecting, connect]);

  useEffect(() => {
    // Lazy by default: no automatic MCP connection attempts.
    const autoConnect = false;
    if (autoConnect) {
      connect();
    }

    // Set up connection listener if client exists
    const currentClient = MCPFrontendManager.getCurrentInstance();
    if (currentClient) {
      const unsubscribe = currentClient.onConnectionChange((connected) => {
        setIsConnected(connected);
        if (!connected) {
          setClient(null);
          setError("MCP connection lost");
          scheduleReconnect();
        }
      });

      return () => {
        unsubscribe();
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, scheduleReconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    client,
    connect,
    disconnect,
    retry: connect
  };
}

/**
 * Hook for making MCP API calls with loading and error states
 */
export function useMCPQuery<T = any>(
  queryFn: (client: MCPFrontendClient) => Promise<T>,
  dependencies: any[] = [],
  options: {
    enabled?: boolean;
    refetchOnReconnect?: boolean;
  } = {}
) {
  const { client, isConnected } = useMCPConnection();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousIsConnected = useRef(isConnected);

  const { enabled = true, refetchOnReconnect = true } = options;

  const execute = useCallback(async () => {
    if (!client || !isConnected || !enabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await queryFn(client);
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'MCP query failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [client, isConnected, enabled, queryFn]);

  // Execute on dependency changes
  useEffect(() => {
    execute();
  }, [execute, ...dependencies]);

  // Refetch on reconnect if enabled
  useEffect(() => {
    if (refetchOnReconnect && isConnected && !previousIsConnected.current && data === null) {
      execute();
    }
    previousIsConnected.current = isConnected;
  }, [isConnected, refetchOnReconnect, execute, data]);

  return {
    data,
    loading,
    error,
    refetch: execute,
    isConnected
  };
}

/**
 * Hook for MCP mutations (create, update, delete operations)
 */
export function useMCPMutation<TArgs = any, TResult = any>(
  mutationFn: (client: MCPFrontendClient, args: TArgs) => Promise<TResult>,
  options: {
    onSuccess?: (result: TResult) => void;
    onError?: (error: string) => void;
  } = {}
) {
  const { client, isConnected } = useMCPConnection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { onSuccess, onError } = options;

  const mutate = useCallback(async (args: TArgs): Promise<TResult | null> => {
    if (!client || !isConnected) {
      const errorMessage = "MCP server connection required";
      setError(errorMessage);
      onError?.(errorMessage);
      throw new Error(errorMessage);
    }

    setLoading(true);
    setError(null);

    try {
      const result = await mutationFn(client, args);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'MCP mutation failed';
      setError(errorMessage);
      onError?.(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, isConnected, mutationFn, onSuccess, onError]);

  return {
    mutate,
    loading,
    error,
    isConnected
  };
}

/**
 * Hook for MCP tool calls
 */
export function useMCPTool<TArgs = any, TResult = any>(
  toolName: string,
  options: {
    onSuccess?: (result: TResult) => void;
    onError?: (error: string) => void;
  } = {}
) {
  return useMCPMutation<TArgs, TResult>(
    async (client, args) => {
      const result = await client.callTool(toolName, args as Record<string, any>);
      return result;
    },
    options
  );
}

/**
 * Hook for MCP resource access
 */
export function useMCPResource<T = any>(
  uri: string,
  dependencies: any[] = [],
  options: {
    enabled?: boolean;
    refetchOnReconnect?: boolean;
  } = {}
) {
  return useMCPQuery<T>(
    async (client) => {
      return await client.readResource(uri);
    },
    [uri, ...dependencies],
    options
  );
}

/**
 * Hook for checking MCP connection status
 */
export function useMCPStatus() {
  const { isConnected, isConnecting, error, connect, disconnect } = useMCPConnection();
  
  return {
    status: isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected',
    isConnected,
    isConnecting,
    isDisconnected: !isConnected && !isConnecting,
    error,
    connect,
    disconnect,
    canFunction: isConnected // Frontend cannot function without MCP
  };
}