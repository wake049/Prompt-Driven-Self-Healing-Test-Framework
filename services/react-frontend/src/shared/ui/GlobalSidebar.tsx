import React from 'react';
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
  PieChart
} from 'lucide-react';
const SidebarContainer = styled.div`
  width: 250px;
  height: 100vh;
  background: ${props => props.theme.colors?.surface || '#f8f9fa'};
  border-right: 1px solid ${props => props.theme.colors?.border || '#e9ecef'};
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  transition: all 0.3s ease;
`;
const SidebarHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid ${props => props.theme.colors?.border || '#e9ecef'};
  background: ${props => props.theme.colors?.surface || '#fff'};
  display: flex;
  align-items: center;
  gap: 12px;
`;
const SidebarIcon = styled.div`
  font-size: 20px;
  color: ${props => props.theme.colors?.primary || '#6c757d'};
`;
const SidebarTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors?.text || '#212529'};
`;
const NavigationList = styled.div`
  padding: 20px 0;
  flex: 1;
`;
const NavItem = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.textSecondary};
  background: ${props => props.$active ? `${props.theme.colors.primary}15` : 'transparent'};
  border-right: ${props => props.$active ? `3px solid ${props.theme.colors.primary}` : '3px solid transparent'};
  font-weight: ${props => props.$active ? '600' : '500'};
  transition: all 0.2s ease;
  &:hover {
    background: ${props => props.$active ? `${props.theme.colors.primary}15` : `${props.theme.colors.border}50`};
    color: ${props => props.$active ? props.theme.colors.primary : props.theme.colors.text};
  }
`;
const NavIcon = styled.div`
  font-size: 16px;
  width: 20px;
  text-align: center;
`;
const UserSection = styled.div`
  padding: 16px 20px;
  border-top: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface};
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
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const UserEmail = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const ThemeToggle = styled.button`
  width: 100%;
  padding: 8px 12px;
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  &:hover {
    background: ${props => props.theme.colors.border};
    color: ${props => props.theme.colors.text};
  }
`;
const LogoutButton = styled.button`
  width: 100%;
  padding: 8px 12px;
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 4px;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover {
    background: ${props => props.theme.colors.border};
    color: ${props => props.theme.colors.text};
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
  const navigationItems = [
    { path: '/', label: 'Execution Dashboard', icon: <Activity size={16} />, key: 'execution' },
    { path: '/analytics', label: 'Analytics & Insights', icon: <TrendingUp size={16} />, key: 'analytics' },
    { path: '/elements', label: 'Elements', icon: <Box size={16} />, key: 'elements' },
    { path: '/prompts', label: 'Prompts', icon: <MessageSquare size={16} />, key: 'prompts' },
    { path: '/policy', label: 'Policy Dashboard', icon: <Shield size={16} />, key: 'dashboard' },
    { path: '/policy-engine', label: 'Policy Engine', icon: <Settings size={16} />, key: 'policy-engine' },
    { path: '/page-context', label: 'Page Context', icon: <Globe size={16} />, key: 'page-context' },
  ];
  const handleNavigation = (path: string) => {
    navigate(path);
  };
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/execution';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };
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
        <SidebarIcon><Activity size={20} /></SidebarIcon>
        <SidebarTitle>Test Framework</SidebarTitle>
      </SidebarHeader>
      <NavigationList>
        {navigationItems.map((item) => (
          <NavItem
            key={item.key}
            $active={isActive(item.path)}
            onClick={() => handleNavigation(item.path)}
          >
            <NavIcon>{item.icon}</NavIcon>
            {item.label}
          </NavItem>
        ))}
      </NavigationList>
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
          <ThemeToggle onClick={toggleTheme}>
            {isDark ? <Sun size={14} style={{ marginRight: '6px' }} /> : <Moon size={14} style={{ marginRight: '6px' }} />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </ThemeToggle>
          <LogoutButton onClick={handleLogout}>
            <LogOut size={14} style={{ marginRight: '6px' }} />
            Sign Out
          </LogoutButton>
        </UserSection>
      )}
    </SidebarContainer>
  );
};
export default GlobalSidebar;