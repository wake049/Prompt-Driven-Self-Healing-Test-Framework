import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../contexts/AuthContext';

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

const NavItem = styled.div<{ active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  cursor: pointer;
  color: ${props => props.active ? '#0066cc' : '#6c757d'};
  background: ${props => props.active ? '#f0f8ff' : 'transparent'};
  border-right: ${props => props.active ? '3px solid #0066cc' : '3px solid transparent'};
  font-weight: ${props => props.active ? '600' : '500'};
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.active ? '#f0f8ff' : '#f8f9fa'};
    color: ${props => props.active ? '#0066cc' : '#495057'};
  }
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

interface GlobalSidebarProps {
  className?: string;
}

const GlobalSidebar: React.FC<GlobalSidebarProps> = ({ className }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navigationItems = [
    { path: '/', label: 'Execution Dashboard', icon: '', key: 'execution' },
    { path: '/elements', label: 'Elements', icon: '', key: 'elements' },
    { path: '/prompts', label: 'Prompts', icon: '', key: 'prompts' },
    { path: '/policy', label: 'Policy Dashboard', icon: '', key: 'dashboard' },
    { path: '/policy-engine', label: 'Policy Engine', icon: '', key: 'policy-engine' },
    { path: '/page-context', label: 'Page Context', icon: '', key: 'page-context' },
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
        <SidebarIcon></SidebarIcon>
        <SidebarTitle>Test Framework</SidebarTitle>
      </SidebarHeader>
      
      <NavigationList>
        {navigationItems.map((item) => (
          <NavItem
            key={item.key}
            active={isActive(item.path)}
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
          <LogoutButton onClick={handleLogout}>
            🚪 Sign Out
          </LogoutButton>
        </UserSection>
      )}
    </SidebarContainer>
  );
};

export default GlobalSidebar;