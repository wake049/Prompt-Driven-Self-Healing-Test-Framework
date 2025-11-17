import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  BarChart3, 
  Box, 
  MessageSquare, 
  Shield, 
  Settings, 
  Globe, 
  LogOut,
  Activity,
  Moon,
  Sun,
  TrendingUp,
  PieChart,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Brain,
  AlertTriangle,
  Chrome,
  Download,
  ExternalLink,
  Eye,
  X
} from 'lucide-react';
const SidebarContainer = styled.div`
  width: 250px;
  height: 100vh;
  background: #f8f9fa;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
`;

const SidebarHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const SidebarIcon = styled.div`
  font-size: 20px;
  color: #6c757d;
`;

const SidebarTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #212529;
`;

const NavigationList = styled.div`
  padding: 20px 0;
  flex: 1;
`;
const NavItem = styled.div<{ $active?: boolean; $isSubmenu?: boolean; $themeColors?: any }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  padding-left: ${props => props.$isSubmenu ? '52px' : '20px'};
  cursor: pointer;
  color: ${props => props.$active ? '#0066cc' : '#6c757d'};
  background: ${props => props.$active ? '#f0f8ff' : 'transparent'};
  border-right: ${props => props.$active ? '3px solid #0066cc' : '3px solid transparent'};
  font-weight: ${props => props.$active ? '600' : '500'};
  font-size: ${props => props.$isSubmenu ? '13px' : '14px'};
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$active ? '#f0f8ff' : '#f8f9fa'};
    color: ${props => props.$active ? '#0066cc' : '#495057'};
  }
`;

const NavItemWithSubmenu = styled(NavItem)<{ $expanded?: boolean }>`
  &:hover .chevron {
    color: ${props => props.theme.colors.text};
  }
  .chevron {
    margin-left: auto;
    transition: transform 0.2s ease;
    transform: ${props => props.$expanded ? 'rotate(0deg)' : 'rotate(0deg)'};
  }
`;

const SubmenuContainer = styled.div<{ $expanded?: boolean }>`
  max-height: ${props => props.$expanded ? '200px' : '0'};
  overflow: hidden;
  transition: max-height 0.3s ease;
`;
const NavIcon = styled.div`
  font-size: 16px;
  width: 20px;
  text-align: center;
`;

const UserSection = styled.div`
  padding: 16px 20px;
  border-top: 1px solid #e9ecef;
  background: #fff;
  margin-top: auto;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const UserAvatar = styled.div`
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
`;

const UserDetails = styled.div`
  flex: 1;
  min-width: 0;
`;

const UserName = styled.div`
  font-weight: 600;
  color: #212529;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const UserEmail = styled.div`
  color: #6c757d;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LogoutButton = styled.button`
  width: 100%;
  padding: 8px 12px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  color: #6c757d;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e9ecef;
    color: #495057;
  }
`;

const ChromeExtensionPromo = styled.div`
  margin: 16px 20px;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  text-align: center;
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
    animation: shimmer 4s infinite;
  }
  
  @keyframes shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }
`;

const PromoHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const PromoTitle = styled.h4`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: white;
`;

const PromoText = styled.p`
  margin: 0 0 12px 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.3;
`;

const PromoButton = styled.button`
  width: 100%;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: white;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  backdrop-filter: blur(10px);
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
  }
`;

const PromoCloseButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    color: white;
  }
`;
interface GlobalSidebarProps {
  className?: string;
}

const GlobalSidebar: React.FC<GlobalSidebarProps> = ({ className }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  const [showChromeExtensionPromo, setShowChromeExtensionPromo] = useState(true);

  // Check if Chrome extension is installed/connected
  useEffect(() => {
    const checkExtensionStatus = () => {
      // Only show promo for Chrome users
      if (!window.navigator.userAgent.includes('Chrome')) {
        setShowChromeExtensionPromo(false);
        return;
      }

      // Hide promo if extension is detected
      const extensionElements = document.querySelectorAll('[data-mcp-extension]');
      const hasExtensionGlobal = typeof (window as any).mcpExtension !== 'undefined';
      
      if (extensionElements.length > 0 || hasExtensionGlobal) {
        setShowChromeExtensionPromo(false);
      } else {
        // Check if user previously dismissed the sidebar promo
        const isDismissed = localStorage.getItem('sidebarChromeExtensionPromoDismissed') === 'true';
        setShowChromeExtensionPromo(!isDismissed);
      }
    };

    checkExtensionStatus();
    
    // Check periodically
    const interval = setInterval(checkExtensionStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const navigationItems = [
    { path: '/', label: 'Execution Dashboard', icon: <Activity size={16} />, key: 'execution' },
    { 
      path: '/analytics', 
      label: 'Analytics & Insights', 
      icon: <TrendingUp size={16} />, 
      key: 'analytics',
      hasSubmenu: true,
      submenu: [
        { path: '/analytics', label: 'Overview Dashboard', icon: <PieChart size={14} /> },
        { path: '/analytics/trends', label: 'Trend Analysis', icon: <BarChart3 size={14} /> },
        { path: '/analytics/ai-insights', label: 'AI Insights', icon: <Brain size={14} /> },
        { path: '/analytics/healing-success', label: 'Healing Success', icon: <AlertTriangle size={14} /> }
      ]
    },
    { path: '/elements', label: 'Elements', icon: <Box size={16} />, key: 'elements' },
    { path: '/review', label: 'Review Queue', icon: <ClipboardList size={16} />, key: 'review' },
    { path: '/prompts', label: 'Prompts', icon: <MessageSquare size={16} />, key: 'prompts' },
    { path: '/policy', label: 'Policy Dashboard', icon: <Shield size={16} />, key: 'dashboard' },
    { path: '/policy-engine', label: 'Policy Engine', icon: <Settings size={16} />, key: 'policy-engine' },
    { path: '/page-context', label: 'Page Context', icon: <Globe size={16} />, key: 'page-context' },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleSubmenuToggle = (key: string) => {
    if (key === 'analytics') {
      setAnalyticsExpanded(!analyticsExpanded);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGetChromeExtension = () => {
    navigate('/chrome-extension');
  };

  const handleDismissSidebarPromo = () => {
    setShowChromeExtensionPromo(false);
    localStorage.setItem('sidebarChromeExtensionPromoDismissed', 'true');
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/execution';
    }
    return location.pathname === path;
  };

  const isAnalyticsActive = () => {
    return location.pathname.startsWith('/analytics');
  };

  // Auto-expand analytics if on analytics page
  React.useEffect(() => {
    if (isAnalyticsActive()) {
      setAnalyticsExpanded(true);
    }
  }, [location.pathname]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <SidebarContainer className={className}>
      <SidebarHeader>
        <SidebarIcon></SidebarIcon>
        <SidebarTitle>Test Helix</SidebarTitle>
      </SidebarHeader>
      
      <NavigationList>
        {navigationItems.map((item) => (
          <div key={item.key}>
            {item.hasSubmenu ? (
              <>
                <NavItemWithSubmenu
                  $active={isAnalyticsActive()}
                  $expanded={analyticsExpanded}
                  onClick={() => handleSubmenuToggle(item.key)}
                >
                  <NavIcon>{item.icon}</NavIcon>
                  {item.label}
                  <ChevronDown 
                    size={14} 
                    className="chevron"
                    style={{
                      transform: analyticsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.2s ease'
                    }}
                  />
                </NavItemWithSubmenu>
                <SubmenuContainer $expanded={analyticsExpanded}>
                  {item.submenu?.map((subItem) => (
                    <NavItem
                      key={subItem.path}
                      $active={isActive(subItem.path)}
                      $isSubmenu={true}
                      onClick={() => handleNavigation(subItem.path)}
                    >
                      <NavIcon>{subItem.icon}</NavIcon>
                      {subItem.label}
                    </NavItem>
                  ))}
                </SubmenuContainer>
              </>
            ) : (
              <NavItem
                $active={isActive(item.path)}
                onClick={() => handleNavigation(item.path)}
              >
                <NavIcon>{item.icon}</NavIcon>
                {item.label}
              </NavItem>
            )}
          </div>
        ))}
      </NavigationList>
      
      {showChromeExtensionPromo && (
        <ChromeExtensionPromo>
          <PromoCloseButton onClick={handleDismissSidebarPromo} title="Dismiss">
            <X size={10} />
          </PromoCloseButton>
          <PromoHeader>
            <Chrome size={16} />
            <PromoTitle>Chrome Extension</PromoTitle>
          </PromoHeader>
          <PromoText>
            Record elements and run tests directly from any webpage
          </PromoText>
          <PromoButton onClick={handleGetChromeExtension}>
            <Eye size={12} />
            Learn More
          </PromoButton>
        </ChromeExtensionPromo>
      )}
      
      {user && (
        <UserSection>
          <UserInfo>
            <UserAvatar>
              {getInitials(user.full_name)}
            </UserAvatar>
            <UserDetails>
              <UserName>{user.full_name}</UserName>
              <UserEmail>{user.email}</UserEmail>
            </UserDetails>
          </UserInfo>
          <LogoutButton onClick={handleLogout}>
            🚪 Sign Out
          </LogoutButton>
        </UserSection>
      )}
    </SidebarContainer>
  );
};

export default GlobalSidebar;