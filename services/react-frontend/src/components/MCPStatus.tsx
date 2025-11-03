/**
 * MCP Connection Status Component
 * 
 * Shows the current MCP connection status and provides reconnection functionality
 */

import React from 'react';
import { useMCPContext } from '../contexts/MCPContext';

interface MCPStatusProps {
  showDetails?: boolean;
  compact?: boolean;
}

export const MCPStatus: React.FC<MCPStatusProps> = ({ 
  showDetails = false, 
  compact = false 
}) => {
  const { isConnected, isConnecting, error, reconnect } = useMCPContext();

  const getStatusColor = () => {
    if (isConnected) return '#28a745';
    if (isConnecting) return '#ffc107';
    return '#dc3545';
  };

  const getStatusText = () => {
    if (isConnected) return 'MCP Connected';
    if (isConnecting) return 'Connecting...';
    return 'MCP Disconnected';
  };

  const getStatusIcon = () => {
    if (isConnected) return '✅';
    if (isConnecting) return '🔄';
    return '❌';
  };

  const statusStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: compact ? '4px 8px' : '8px 12px',
    borderRadius: '6px',
    backgroundColor: isConnected ? '#d4edda' : isConnecting ? '#fff3cd' : '#f8d7da',
    border: `1px solid ${isConnected ? '#c3e6cb' : isConnecting ? '#ffeaa7' : '#f5c6cb'}`,
    fontSize: compact ? '12px' : '14px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };

  const textStyle: React.CSSProperties = {
    color: getStatusColor(),
    fontWeight: 'bold',
    margin: 0
  };

  const detailStyle: React.CSSProperties = {
    color: '#6c757d',
    fontSize: '12px',
    margin: '4px 0 0 0'
  };

  const buttonStyle: React.CSSProperties = {
    background: '#007bff',
    color: 'white',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    marginLeft: '8px'
  };

  if (compact) {
    return (
      <div style={statusStyle}>
        <span>{getStatusIcon()}</span>
        <span style={textStyle}>{getStatusText()}</span>
        {!isConnected && !isConnecting && (
          <button onClick={reconnect} style={buttonStyle}>
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={statusStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{getStatusIcon()}</span>
          <span style={textStyle}>{getStatusText()}</span>
        </div>
        
        {showDetails && (
          <>
            {error && (
              <p style={{ ...detailStyle, color: '#dc3545' }}>
                Error: {error}
              </p>
            )}
            <p style={detailStyle}>
              Protocol: WebSocket JSON-RPC 2.0 | Server: ws://localhost:8765
            </p>
          </>
        )}
      </div>
      
      {!isConnected && !isConnecting && (
        <button onClick={reconnect} style={buttonStyle}>
          🔄 Reconnect
        </button>
      )}
    </div>
  );
};

/**
 * Minimal MCP status indicator for headers/toolbars
 */
export const MCPStatusBadge: React.FC = () => {
  const { isConnected, isConnecting } = useMCPContext();
  
  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 6px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: 'bold',
    backgroundColor: isConnected ? '#28a745' : isConnecting ? '#ffc107' : '#dc3545',
    color: 'white'
  };
  
  return (
    <span style={badgeStyle}>
      {isConnected ? '●' : isConnecting ? '○' : '×'} MCP
    </span>
  );
};

export default MCPStatus;