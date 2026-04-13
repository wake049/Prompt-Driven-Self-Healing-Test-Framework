/**
 * SyncIndicator Component
 * Visual indicators for synchronization status
 */
import React from 'react';
import styled from 'styled-components';
import { pulseKeyframes } from '../styles/keyframes';

interface SyncIndicatorProps {
  status: 'idle' | 'syncing' | 'success' | 'error';
  message?: string;
  className?: string;
}

interface SyncNotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
  autoHide?: boolean;
  duration?: number;
}

const IndicatorContainer = styled.div<{ status: string }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  
  ${props => {
    switch (props.status) {
      case 'syncing':
        return `
          background: #fff3cd;
          color: #856404;
          border: 1px solid #ffeaa7;
        `;
      case 'success':
        return `
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        `;
      case 'error':
        return `
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        `;
      default:
        return `
          background: #f8f9fa;
          color: #6c757d;
          border: 1px solid #dee2e6;
        `;
    }
  }}
`;

const SyncDot = styled.div<{ status: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  
  ${props => {
    switch (props.status) {
      case 'syncing':
        return `
          background: #ffc107;
          animation: ${pulseKeyframes} 1.5s infinite;
        `;
      case 'success':
        return `background: #28a745;`;
      case 'error':
        return `background: #dc3545;`;
      default:
        return `background: #6c757d;`;
    }
  }}
`;

const NotificationContainer = styled.div<{ type: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 6px;
  margin: 8px 0;
  font-size: 14px;
  
  ${props => {
    switch (props.type) {
      case 'success':
        return `
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        `;
      case 'error':
        return `
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        `;
      case 'warning':
        return `
          background: #fff3cd;
          color: #856404;
          border: 1px solid #ffeaa7;
        `;
      default:
        return `
          background: #d1ecf1;
          color: #0c5460;
          border: 1px solid #bee5eb;
        `;
    }
  }}
`;

const NotificationMessage = styled.div`
  flex: 1;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 0;
  margin-left: 12px;
  opacity: 0.6;
  
  &:hover {
    opacity: 1;
  }
`;

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({ 
  status, 
  message, 
  className 
}) => {
  const getStatusText = () => {
    switch (status) {
      case 'syncing':
        return 'Syncing...';
      case 'success':
        return 'Synced';
      case 'error':
        return 'Sync Error';
      default:
        return 'Ready';
    }
  };

  return (
    <IndicatorContainer status={status} className={className}>
      <SyncDot status={status} />
      {message || getStatusText()}
    </IndicatorContainer>
  );
};

export const SyncNotification: React.FC<SyncNotificationProps> = ({ 
  type, 
  message, 
  onClose,
  autoHide = false,
  duration = 5000
}) => {
  React.useEffect(() => {
    if (autoHide && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, onClose, duration]);

  return (
    <NotificationContainer type={type}>
      <NotificationMessage>{message}</NotificationMessage>
      {onClose && (
        <CloseButton onClick={onClose} aria-label="Close notification">
          ×
        </CloseButton>
      )}
    </NotificationContainer>
  );
};

export default SyncIndicator;