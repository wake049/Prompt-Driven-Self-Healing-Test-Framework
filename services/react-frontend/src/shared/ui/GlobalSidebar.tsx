import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { shimmerKeyframes } from '../styles/keyframes';
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
  X,
  Menu,
  ChevronLeft,
  Building2,
  Package,
  FileText,
  List,
  Play,
  Zap,
  Lock,
  CheckCircle,
  Database,
  Monitor,
  Key
} from 'lucide-react';
import { config } from '../../app/config';
const SidebarContainer = styled.div<{ $collapsed?: boolean }>`
  width: ${props => props.$collapsed ? '60px' : '250px'};
  height: 100vh;
  background: #f8f9fa;
  border-right: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  transition: width 0.3s ease;
`;

const SidebarHeader = styled.div<{ $collapsed?: boolean }>`
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: ${props => props.$collapsed ? 'center' : 'space-between'};
  gap: 12px;
  position: relative;
`;

const SidebarIcon = styled.div`
  font-size: 20px;
  color: #6c757d;
`;

const SidebarTitle = styled.h2<{ $collapsed?: boolean }>`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #212529;
  opacity: ${props => props.$collapsed ? 0 : 1};
  transition: opacity 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
`;

const CollapseButton = styled.button`
  background: transparent;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f8f9fa;
    color: #495057;
  }
`;

const NavigationList = styled.div`
  padding: 20px 0;
  flex: 1;
`;
const NavItem = styled.div<{ $active?: boolean; $isSubmenu?: boolean; $collapsed?: boolean; $themeColors?: any }>`
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
  justify-content: ${props => props.$collapsed ? 'center' : 'flex-start'};
  white-space: nowrap;
  overflow: hidden;

  &:hover {
    background: ${props => props.$active ? '#f0f8ff' : '#f8f9fa'};
    color: ${props => props.$active ? '#0066cc' : '#495057'};
  }
  
  span {
    opacity: ${props => props.$collapsed ? 0 : 1};
    transition: opacity 0.2s ease;
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
  background: #185FA5;
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

const OrgInfo = styled.div`
  padding: 8px 12px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 11px;
  color: #6c757d;
  
  strong {
    display: block;
    color: #495057;
    font-size: 12px;
    margin-bottom: 2px;
  }
  
  code {
    background: #e9ecef;
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 10px;
  }
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
  background: #185FA5;
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
    animation: ${shimmerKeyframes} 4s infinite;
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
  onCollapseChange?: (collapsed: boolean) => void;
}

const GlobalSidebar: React.FC<GlobalSidebarProps> = ({ className, onCollapseChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, tenant, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false);
  const [executionExpanded, setExecutionExpanded] = useState(false);
  const [promptsExpanded, setPromptsExpanded] = useState(false);
  const [testSuitesExpanded, setTestSuitesExpanded] = useState(false);
  const [policyExpanded, setPolicyExpanded] = useState(false);
  const [showChromeExtensionPromo, setShowChromeExtensionPromo] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [licenseActive, setLicenseActive] = useState<boolean | null>(null);

  // Fetch self-host license status for sidebar indicator
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch(`${config.apiBaseUrl}/api/v1/licensing/self-host/status`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data.license_active === 'boolean') {
          setLicenseActive(data.license_active);
        }
      })
      .catch(() => {});
  }, []);

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
    { path: '/app/page-context', label: 'Page Context', icon: <Globe size={16} />, key: 'page-context' },
    { path: '/app/elements', label: 'Elements', icon: <Box size={16} />, key: 'elements' },
    { 
      path: '/app/prompts', 
      label: 'Prompts & Tests', 
      icon: <MessageSquare size={16} />, 
      key: 'prompts',
      hasSubmenu: true,
      submenu: [
        { path: '/app/prompts', label: 'All Prompts', icon: <List size={14} /> },
        { path: '/app/test-suites', label: 'All Suites', icon: <Package size={14} /> },
        { path: '/app/document-to-tests', label: 'Document to Tests', icon: <FileText size={14} /> },
        { path: '/app/api-test-data', label: 'API Test Data', icon: <Database size={14} /> },
        { path: '/app/', label: 'Execution Dashboard', icon: <Activity size={14} /> },
      ]
    },
    { path: '/app/runners', label: 'Runners', icon: <Monitor size={16} />, key: 'runners' },
    { path: '/app/review', label: 'Review Queue', icon: <ClipboardList size={16} />, key: 'review' },
    { 
      path: '/app/analytics', 
      label: 'Analytics & Insights', 
      icon: <TrendingUp size={16} />, 
      key: 'analytics',
      hasSubmenu: true,
      submenu: [
        { path: '/app/analytics', label: 'Overview Dashboard', icon: <PieChart size={14} /> },
        { path: '/app/analytics/trends', label: 'Trend Analysis', icon: <BarChart3 size={14} /> },
        { path: '/app/analytics/ai-insights', label: 'AI Insights', icon: <Brain size={14} /> },
        { path: '/app/analytics/healing-success', label: 'Healing Success', icon: <AlertTriangle size={14} /> }
      ]
    },
    { 
      path: '/app/policy', 
      label: 'Policy & Rules', 
      icon: <Shield size={16} />, 
      key: 'policy',
      hasSubmenu: true,
      submenu: [
        { path: '/app/policy', label: 'Policy Dashboard', icon: <Shield size={14} /> },
        { path: '/app/policy-engine', label: 'Policy Engine', icon: <Settings size={14} /> },
        { path: '/app/organization', label: 'Organization', icon: <Building2 size={14} /> },
      ]
    },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleSubmenuToggle = (key: string) => {
    if (key === 'execution') {
      setExecutionExpanded(!executionExpanded);
    } else if (key === 'analytics') {
      setAnalyticsExpanded(!analyticsExpanded);
    } else if (key === 'prompts') {
      setPromptsExpanded(!promptsExpanded);
    } else if (key === 'test-suites') {
      setTestSuitesExpanded(!testSuitesExpanded);
    } else if (key === 'policy') {
      setPolicyExpanded(!policyExpanded);
    }
  };
  
  const handleToggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    if (newCollapsed) {
      setExecutionExpanded(false);
      setAnalyticsExpanded(false);
      setPromptsExpanded(false);
      setTestSuitesExpanded(false);
      setPolicyExpanded(false);
    }
    if (onCollapseChange) {
      onCollapseChange(newCollapsed);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleGetChromeExtension = () => {
    navigate('/app/chrome-extension');
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

  const isExecutionActive = () => {
    return location.pathname === '/app/' || location.pathname.startsWith('/app/execution');
  };

  const isAnalyticsActive = () => {
    return location.pathname.startsWith('/app/analytics');
  };

  const isPromptsActive = () => {
    return location.pathname.startsWith('/app/prompts');
  };

  const isTestSuitesActive = () => {
    return location.pathname.startsWith('/app/test-suites');
  };

  const isPolicyActive = () => {
    return location.pathname.startsWith('/app/policy') || location.pathname.startsWith('/app/organization');
  };

  // Auto-expand sections if on their pages
  React.useEffect(() => {
    if (isExecutionActive()) {
      setExecutionExpanded(true);
    }
    if (isAnalyticsActive()) {
      setAnalyticsExpanded(true);
    }
    if (isPromptsActive()) {
      setPromptsExpanded(true);
    }
    if (isTestSuitesActive()) {
      setTestSuitesExpanded(true);
    }
    if (isPolicyActive()) {
      setPolicyExpanded(true);
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
    <SidebarContainer className={className} $collapsed={isCollapsed}>
      <SidebarHeader $collapsed={isCollapsed}>
        {!isCollapsed && (
          <>
            <SidebarIcon></SidebarIcon>
            <SidebarTitle $collapsed={isCollapsed}>Test Helix</SidebarTitle>
          </>
        )}
        <CollapseButton onClick={handleToggleCollapse} title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </CollapseButton>
      </SidebarHeader>
      
      <NavigationList>
        {navigationItems.filter(item => {
          // Filter admin-only items based on user role
          if (item.adminOnly) {
            return user && (user.role === 'owner' || user.role === 'admin');
          }
          return true;
        }).map((item) => (
          <div key={item.key}>
            {item.hasSubmenu ? (
              <>
                <NavItemWithSubmenu
                  $active={(() => {
                    if (item.key === 'execution') return isExecutionActive();
                    if (item.key === 'analytics') return isAnalyticsActive();
                    if (item.key === 'prompts') return isPromptsActive();
                    if (item.key === 'test-suites') return isTestSuitesActive();
                    if (item.key === 'policy') return isPolicyActive();
                    return false;
                  })()}
                  $expanded={(() => {
                    if (item.key === 'execution') return executionExpanded;
                    if (item.key === 'analytics') return analyticsExpanded;
                    if (item.key === 'prompts') return promptsExpanded;
                    if (item.key === 'test-suites') return testSuitesExpanded;
                    if (item.key === 'policy') return policyExpanded;
                    return false;
                  })()}
                  $collapsed={isCollapsed}
                  onClick={() => !isCollapsed && handleSubmenuToggle(item.key)}
                >
                  <NavIcon>{item.icon}</NavIcon>
                  {!isCollapsed && <span>{item.label}</span>}
                  {!isCollapsed && (
                    <ChevronDown 
                      size={14} 
                      className="chevron"
                      style={{
                        transform: (() => {
                          if (item.key === 'execution') return executionExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
                          if (item.key === 'analytics') return analyticsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
                          if (item.key === 'prompts') return promptsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
                          if (item.key === 'test-suites') return testSuitesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
                          if (item.key === 'policy') return policyExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
                          return 'rotate(-90deg)';
                        })(),
                        transition: 'transform 0.2s ease'
                      }}
                    />
                  )}
                </NavItemWithSubmenu>
                {!isCollapsed && (
                  <SubmenuContainer $expanded={(() => {
                    if (item.key === 'execution') return executionExpanded;
                    if (item.key === 'analytics') return analyticsExpanded;
                    if (item.key === 'prompts') return promptsExpanded;
                    if (item.key === 'test-suites') return testSuitesExpanded;
                    if (item.key === 'policy') return policyExpanded;
                    return false;
                  })()}>
                    {item.submenu?.filter(subItem => {
                      // Filter admin-only submenu items based on user role
                      if (subItem.adminOnly) {
                        return user && (user.role === 'owner' || user.role === 'admin');
                      }
                      return true;
                    }).map((subItem) => (
                      <NavItem
                        key={subItem.path}
                        $active={isActive(subItem.path)}
                        $isSubmenu={true}
                        $collapsed={isCollapsed}
                        onClick={() => handleNavigation(subItem.path)}
                      >
                        <NavIcon>{subItem.icon}</NavIcon>
                        <span>{subItem.label}</span>
                      </NavItem>
                    ))}
                  </SubmenuContainer>
                )}
              </>
            ) : (
              <NavItem
                $active={isActive(item.path)}
                $collapsed={isCollapsed}
                onClick={() => handleNavigation(item.path)}
                title={isCollapsed ? item.label : undefined}
              >
                <NavIcon>{item.icon}</NavIcon>
                {!isCollapsed && <span>{item.label}</span>}
              </NavItem>
            )}
          </div>
        ))}
      </NavigationList>
      
      {showChromeExtensionPromo && !isCollapsed && (
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
      
      {user && !isCollapsed && (
        <UserSection>
          {tenant && (
            <OrgInfo>
              <strong>{tenant.name}</strong>
              <div>fluxtest.io/<code>{tenant.slug}</code></div>
            </OrgInfo>
          )}
          {licenseActive !== null && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 10px', margin: '0 0 8px 0',
                borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                background: licenseActive ? '#d4edda' : '#f8f9fa',
                color: licenseActive ? '#155724' : '#6c757d',
                cursor: 'pointer',
              }}
              onClick={() => navigate('/app/organization')}
              title="Manage self-host license"
            >
              <Key size={12} />
              {licenseActive ? 'Self-Host License Active' : 'No Active License'}
            </div>
          )}
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
      {user && isCollapsed && (
        <UserSection>
          <UserAvatar onClick={handleToggleCollapse} style={{ cursor: 'pointer', margin: '0 auto' }} title={user.full_name}>
            {getInitials(user.full_name)}
          </UserAvatar>
        </UserSection>
      )}
    </SidebarContainer>
  );
};

export default GlobalSidebar;