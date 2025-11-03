/**
 * Visual Indicators for Element-Prompt Synchronization
 * 
 * This component provides rich visual feedback for synchronization status,
 * helping users understand when elements and prompts are linked and when
 * synchronization operations occur.
 */
import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Link, RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
// Animation keyframes
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;
const bounce = keyframes`
  0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
  40%, 43% { transform: translate3d(0, -30px, 0); }
  70% { transform: translate3d(0, -15px, 0); }
  90% { transform: translate3d(0, -4px, 0); }
`;
const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;
// Styled Components
const SyncIndicatorBadge = styled.div<{ 
  status: 'linked' | 'unlinked' | 'syncing' | 'error'; 
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
}>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: ${props => {
    switch (props.size) {
      case 'small': return '2px 6px';
      case 'large': return '8px 12px';
      default: return '4px 8px';
    }
  }};
  border-radius: 12px;
  font-size: ${props => {
    switch (props.size) {
      case 'small': return '10px';
      case 'large': return '14px';
      default: return '12px';
    }
  }};
  font-weight: 600;
  transition: all 0.3s ease;
  ${props => {
    switch (props.status) {
      case 'linked':
        return `
          background: linear-gradient(135deg, #48bb78 0%, #38b2ac 100%);
          color: white;
          box-shadow: 0 2px 8px rgba(72, 187, 120, 0.3);
        `;
      case 'syncing':
        return `
          background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
          color: white;
          box-shadow: 0 2px 8px rgba(66, 153, 225, 0.3);
          animation: ${pulse} 2s infinite;
        `;
      case 'error':
        return `
          background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
          color: white;
          box-shadow: 0 2px 8px rgba(245, 101, 101, 0.3);
        `;
      default:
        return `
          background: rgba(156, 163, 175, 0.3);
          color: #6b7280;
          border: 1px solid #d1d5db;
        `;
    }
  }}
  ${props => props.animated && `
    animation: ${bounce} 2s ease-in-out;
  `}
`;
const SyncStatusPanel = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: ${fadeIn} 0.3s ease-out;
`;
const SyncRelationshipItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin: 4px 0;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 8px;
  transition: all 0.3s ease;
  &:hover {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    transform: translateX(4px);
  }
`;
const SyncNotificationOverlay = styled.div<{ type: 'success' | 'error' | 'info' }>`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  max-width: 400px;
  padding: 16px 20px;
  border-radius: 12px;
  color: white;
  font-weight: 500;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: ${slideIn} 0.3s ease-out;
  background: ${props => {
    switch (props.type) {
      case 'success': return 'linear-gradient(135deg, #48bb78 0%, #38b2ac 100%)';
      case 'error': return 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)';
      case 'info': return 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)';
      default: return 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)';
    }
  }};
`;
const SyncProgressIndicator = styled.div<{ progress: number }>`
  width: 100%;
  height: 4px;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 8px;
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.progress}%;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 1) 100%);
    border-radius: 2px;
    transition: width 0.3s ease;
  }
`;
const SyncActivityFeed = styled.div`
  max-height: 200px;
  overflow-y: auto;
  border-radius: 8px;
  background: rgba(248, 250, 252, 0.5);
`;
const SyncActivityItem = styled.div<{ type: 'element-updated' | 'prompt-updated' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.5);
  font-size: 13px;
  &:last-child {
    border-bottom: none;
  }
  &::before {
    content: '${props => props.type === 'element-updated' ? '🔧' : '📝'}';
    font-size: 14px;
  }
`;
// Component Props
interface SyncIndicatorProps {
  status: 'linked' | 'unlinked' | 'syncing' | 'error';
  count?: number;
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
  onClick?: () => void;
}
interface SyncNotificationProps {
  type: 'success' | 'error' | 'info';
  message: string;
  progress?: number;
  autoHide?: boolean;
  duration?: number;
  onClose?: () => void;
}
interface SyncStatusProps {
  elementCount: number;
  promptCount: number;
  isUpdating: boolean;
  lastSyncTime?: Date;
  recentActivity?: Array<{
    type: 'element-updated' | 'prompt-updated';
    message: string;
    timestamp: Date;
  }>;
}
// Main Components
export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  status,
  count,
  size = 'medium',
  animated = false,
  onClick
}) => {
  const getIcon = () => {
    switch (status) {
      case 'linked': return <Link size={size === 'small' ? 12 : size === 'large' ? 16 : 14} />;
      case 'syncing': return <RefreshCw size={size === 'small' ? 12 : size === 'large' ? 16 : 14} />;
      case 'error': return <XCircle size={size === 'small' ? 12 : size === 'large' ? 16 : 14} />;
      default: return null;
    }
  };
  const getText = () => {
    switch (status) {
      case 'linked': return count ? `${count} linked` : 'Linked';
      case 'syncing': return 'Syncing...';
      case 'error': return 'Sync Error';
      default: return 'No Links';
    }
  };
  return (
    <SyncIndicatorBadge 
      status={status} 
      size={size} 
      animated={animated}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {getIcon()}
      {getText()}
    </SyncIndicatorBadge>
  );
};
export const SyncNotification: React.FC<SyncNotificationProps> = ({
  type,
  message,
  progress,
  autoHide = true,
  duration = 5000,
  onClose
}) => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, duration, onClose]);
  if (!visible) return null;
  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle size={20} />;
      case 'error': return <XCircle size={20} />;
      case 'info': return <RefreshCw size={20} />;
      default: return <RefreshCw size={20} />;
    }
  };
  return (
    <SyncNotificationOverlay type={type}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {getIcon()}
        <div style={{ flex: 1 }}>
          <div>{message}</div>
          {typeof progress === 'number' && (
            <SyncProgressIndicator progress={progress} />
          )}
        </div>
        {!autoHide && (
          <button
            onClick={() => {
              setVisible(false);
              onClose?.();
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        )}
      </div>
    </SyncNotificationOverlay>
  );
};
export const SyncStatusDisplay: React.FC<SyncStatusProps> = ({
  elementCount,
  promptCount,
  isUpdating,
  lastSyncTime,
  recentActivity = []
}) => {
  return (
    <SyncStatusPanel>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Synchronization Status
        </h3>
        <SyncIndicator 
          status={isUpdating ? 'syncing' : elementCount > 0 || promptCount > 0 ? 'linked' : 'unlinked'}
          count={elementCount + promptCount}
          animated={isUpdating}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(72, 187, 120, 0.1)', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#48bb78' }}>{elementCount}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Linked Elements</div>
        </div>
        <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '8px' }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#667eea' }}>{promptCount}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Linked Prompts</div>
        </div>
      </div>
      {lastSyncTime && (
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px', textAlign: 'center' }}>
          Last synchronized: {lastSyncTime.toLocaleTimeString()}
        </div>
      )}
      {recentActivity.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>Recent Activity</h4>
          <SyncActivityFeed>
            {recentActivity.slice(0, 5).map((activity, index) => (
              <SyncActivityItem key={index} type={activity.type}>
                <div style={{ flex: 1 }}>
                  <div>{activity.message}</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                    {activity.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </SyncActivityItem>
            ))}
          </SyncActivityFeed>
        </div>
      )}
    </SyncStatusPanel>
  );
};
export const SyncRelationshipList: React.FC<{
  relationships: Array<{
    id: string;
    name: string;
    type: 'element' | 'prompt';
    status: 'active' | 'inactive' | 'error';
    lastUpdate?: Date;
  }>;
  onItemClick?: (id: string, type: 'element' | 'prompt') => void;
}> = ({ relationships, onItemClick }) => {
  return (
    <div>
      {relationships.map((relationship) => (
        <SyncRelationshipItem 
          key={relationship.id}
          onClick={() => onItemClick?.(relationship.id, relationship.type)}
          style={{ cursor: onItemClick ? 'pointer' : 'default' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>
              {relationship.type === 'element' ? '🔧' : '📝'}
            </span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>
                {relationship.name}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                {relationship.type} • {relationship.status}
              </div>
            </div>
          </div>
          <SyncIndicator 
            status={relationship.status === 'active' ? 'linked' : relationship.status === 'error' ? 'error' : 'unlinked'}
            size="small"
          />
        </SyncRelationshipItem>
      ))}
    </div>
  );
};