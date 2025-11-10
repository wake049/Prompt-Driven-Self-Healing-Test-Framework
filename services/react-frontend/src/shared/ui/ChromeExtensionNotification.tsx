import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  Chrome, 
  Download, 
  X, 
  Info, 
  CheckCircle, 
  ExternalLink,
  Zap,
  Activity,
  Shield
} from 'lucide-react';

const NotificationBanner = styled.div<{ $dismissed?: boolean }>`
  display: ${props => props.$dismissed ? 'none' : 'block'};
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    animation: shimmer 3s infinite;
  }
  
  @keyframes shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }
`;

const NotificationContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const IconContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  flex-shrink: 0;
`;

const TextContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.h3`
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 700;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Description = styled.p`
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
`;

const Features = styled.div`
  display: flex;
  gap: 24px;
  margin-top: 8px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 8px;
  }
`;

const Feature = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
  }
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  
  ${props => props.$variant === 'primary' ? `
    background: white;
    color: #667eea;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      background: #f8f9ff;
    }
  ` : `
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    
    &:hover {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.5);
    }
  `}
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }
`;

const StatusIndicator = styled.div<{ $status: 'available' | 'installed' | 'connected' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  
  ${props => {
    switch(props.$status) {
      case 'installed':
        return `
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        `;
      case 'connected':
        return `
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        `;
      default:
        return `
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
        `;
    }
  }}
`;

interface ChromeExtensionNotificationProps {
  className?: string;
  onNavigate?: (path: string) => void;
}

const ChromeExtensionNotification: React.FC<ChromeExtensionNotificationProps> = ({ 
  className, 
  onNavigate 
}) => {
  const [dismissed, setDismissed] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<'available' | 'installed' | 'connected'>('available');
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Check if notification was previously dismissed
  useEffect(() => {
    const isDismissed = localStorage.getItem('chromeExtensionNotificationDismissed') === 'true';
    setDismissed(isDismissed);
  }, []);

  // Auto-hide banner when extension is detected as connected
  useEffect(() => {
    if (extensionStatus === 'connected') {
      // Show a brief "connected" status, then auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setDismissed(true);
        localStorage.setItem('chromeExtensionNotificationDismissed', 'true');
      }, 3000);
      
      setAutoHideTimer(timer);
      
      return () => {
        if (timer) clearTimeout(timer);
      };
    } else if (extensionStatus === 'installed') {
      // If extension is installed but not connected, auto-hide after 10 seconds
      const timer = setTimeout(() => {
        setDismissed(true);
        localStorage.setItem('chromeExtensionNotificationDismissed', 'true');
      }, 10000);
      
      setAutoHideTimer(timer);
      
      return () => {
        if (timer) clearTimeout(timer);
      };
    } else if (autoHideTimer) {
      // Clear auto-hide timer if extension is no longer connected
      clearTimeout(autoHideTimer);
      setAutoHideTimer(null);
    }
  }, [extensionStatus, autoHideTimer]);

  // Check if Chrome extension is installed/connected
  useEffect(() => {
    const checkExtensionStatus = () => {
      // Only check if user is on Chrome
      if (!window.navigator.userAgent.includes('Chrome')) {
        setExtensionStatus('available');
        return;
      }

      // Method 1: Check for extension data attribute on document
      const extensionAttribute = document.documentElement.getAttribute('data-mcp-extension');
      if (extensionAttribute === 'installed') {
        setExtensionStatus('connected');
        return;
      }

      // Method 2: Check for extension global variable
      if ((window as any).mcpExtensionInstalled === true) {
        setExtensionStatus('connected');
        return;
      }

      // Method 3: Check localStorage for extension status
      try {
        const extensionStatus = localStorage.getItem('mcp-extension-status');
        if (extensionStatus) {
          const status = JSON.parse(extensionStatus);
          if (status.installed && status.timestamp > Date.now() - 300000) { // 5 minutes
            setExtensionStatus('connected');
            return;
          }
        }
      } catch (e) {
        // localStorage not accessible or invalid JSON
      }

      // Method 4: Check for extension-specific DOM elements that the content script creates
      const recordingIndicator = document.getElementById('mcp-recording-indicator');
      const highlightStyles = document.getElementById('mcp-highlight-styles');
      const notificationStyles = document.getElementById('mcp-notification-styles');
      
      if (recordingIndicator || highlightStyles || notificationStyles) {
        setExtensionStatus('connected');
        return;
      }

      // Method 5: Check for extension-specific localStorage data
      try {
        const mcpElements = localStorage.getItem('mcp-recorded-elements');
        const mcpMessages = localStorage.getItem('mcp-pending-messages');
        
        if (mcpElements || mcpMessages) {
          setExtensionStatus('installed');
          return;
        }
      } catch (e) {
        // localStorage not accessible
      }

      // Method 6: Check for extension-specific CSS classes or attributes
      const extensionClasses = document.querySelectorAll('.mcp-recorded-highlight, .mcp-hover-highlight');
      if (extensionClasses.length > 0) {
        setExtensionStatus('connected');
        return;
      }

      // Method 7: Dispatch a custom event to test if extension responds
      let extensionResponded = false;
      
      const responseHandler = (event: Event) => {
        extensionResponded = true;
        setExtensionStatus('connected');
      };
      
      try {
        window.addEventListener('mcp-extension-response', responseHandler, { once: true });
        
        const testEvent = new CustomEvent('mcp-extension-check', { 
          detail: { timestamp: Date.now() } 
        });
        window.dispatchEvent(testEvent);
        
        // Give extension 500ms to respond
        setTimeout(() => {
          window.removeEventListener('mcp-extension-response', responseHandler);
          if (!extensionResponded) {
            setExtensionStatus('available');
          }
        }, 500);
        
      } catch (e) {
        setExtensionStatus('available');
      }
    };

    // Listen for extension loaded event
    const extensionLoadedHandler = () => {
      setExtensionStatus('connected');
    };
    
    window.addEventListener('mcp-extension-loaded', extensionLoadedHandler);

    // Initial check
    checkExtensionStatus();
    
    // Check more frequently initially, then less frequently
    const immediateInterval = setInterval(checkExtensionStatus, 2000); // Check every 2 seconds
    
    // After 10 seconds, switch to less frequent checking
    const switchToSlowInterval = setTimeout(() => {
      clearInterval(immediateInterval);
      const slowInterval = setInterval(checkExtensionStatus, 10000); // Check every 10 seconds
      
      // Clean up slow interval after 5 minutes
      setTimeout(() => {
        clearInterval(slowInterval);
      }, 300000);
    }, 10000);
    
    return () => {
      clearInterval(immediateInterval);
      clearTimeout(switchToSlowInterval);
      window.removeEventListener('mcp-extension-loaded', extensionLoadedHandler);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('chromeExtensionNotificationDismissed', 'true');
  };

  const handleGetExtension = () => {
    if (onNavigate) {
      onNavigate('/chrome-extension');
    } else {
      // Fallback to external link if navigate function not provided
      window.open('https://github.com/wake049/capstone-self-healing/tree/main/chrome-extension', '_blank');
    }
  };

  const handleViewDocs = () => {
    if (onNavigate) {
      onNavigate('/chrome-extension');
    } else {
      // Fallback to external link if navigate function not provided
      window.open('https://github.com/wake049/capstone-self-healing/blob/main/chrome-extension/README.md', '_blank');
    }
  };

  const getStatusText = () => {
    switch(extensionStatus) {
      case 'installed':
        return 'Extension Detected';
      case 'connected':
        return 'Connected & Active';
      default:
        return 'Available for Install';
    }
  };

  const getTitle = () => {
    switch(extensionStatus) {
      case 'installed':
        return 'Chrome Extension Detected!';
      case 'connected':
        return 'Chrome Extension Active!';
      default:
        return 'Enhance Your Testing with Our Chrome Extension';
    }
  };

  const getDescription = () => {
    switch(extensionStatus) {
      case 'installed':
        return 'Great! The MCP extension is installed. Use it to record UI elements directly from any webpage.';
      case 'connected':
        return 'The MCP extension is connected and ready. Record elements and build your test repository seamlessly.';
      default:
        return 'Install our Chrome extension to record UI elements, capture selectors, and build your test element repository.';
    }
  };

  if (dismissed) {
    return null;
  }

  // Auto-hide if extension is connected or installed (users don't need to see this anymore)
  if (extensionStatus === 'connected' || extensionStatus === 'installed') {
    return null;
  }

  // Only show for Chrome users when extension is not installed
  if (!window.navigator.userAgent.includes('Chrome')) {
    return null;
  }

  return (
    <NotificationBanner className={className} $dismissed={dismissed}>
      <NotificationContent>
        <LeftSection>
          <IconContainer>
            <Chrome size={24} />
          </IconContainer>
          <TextContent>
            <Title>
              {getTitle()}
              <StatusIndicator $status={extensionStatus}>
                {extensionStatus === 'connected' ? <CheckCircle size={12} /> : 
                 extensionStatus === 'installed' ? <CheckCircle size={12} /> : 
                 <Info size={12} />}
                {getStatusText()}
              </StatusIndicator>
            </Title>
            <Description>
              {getDescription()}
            </Description>
            <Features>
              <Feature>
                <Activity size={12} />
                One-click element recording
              </Feature>
              <Feature>
                <Zap size={12} />
                Smart selector generation
              </Feature>
              <Feature>
                <Shield size={12} />
                Repository integration
              </Feature>
            </Features>
          </TextContent>
        </LeftSection>
        
        <RightSection>
          {extensionStatus === 'available' && (
            <ActionButton $variant="primary" onClick={handleGetExtension}>
              <Download size={16} />
              Get Extension
            </ActionButton>
          )}
          
          <ActionButton $variant="secondary" onClick={handleViewDocs}>
            <ExternalLink size={16} />
            Learn More
          </ActionButton>
          
          <CloseButton onClick={handleDismiss} title="Dismiss notification">
            <X size={16} />
          </CloseButton>
        </RightSection>
      </NotificationContent>
    </NotificationBanner>
  );
};

export default ChromeExtensionNotification;