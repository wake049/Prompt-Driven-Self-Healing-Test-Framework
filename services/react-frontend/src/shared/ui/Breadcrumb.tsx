import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ChevronRight, Home } from 'lucide-react';

const BreadcrumbContainer = styled.nav`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  margin-bottom: 16px;
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  flex-wrap: wrap;
`;

const BreadcrumbItem = styled.button<{ $isActive?: boolean }>`
  background: none;
  border: none;
  color: ${props => props.$isActive ? props.theme.colors.text : props.theme.colors.textSecondary};
  cursor: ${props => props.$isActive ? 'default' : 'pointer'};
  font-weight: ${props => props.$isActive ? '600' : '500'};
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
  
  &:hover:not(:disabled) {
    background: ${props => props.theme.colors.hover};
    color: ${props => props.theme.colors.primary};
  }

  &:disabled {
    cursor: default;
  }
`;

const Separator = styled(ChevronRight)`
  color: ${props => props.theme.colors.textSecondary};
  opacity: 0.5;
  flex-shrink: 0;
`;

interface BreadcrumbProps {
  customPaths?: { label: string; path: string }[];
}

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/execution': 'Execution',
  '/analytics': 'Analytics',
  '/analytics/trends': 'Trend Analysis',
  '/analytics/ai-insights': 'AI Insights',
  '/analytics/healing-success': 'Healing Success',
  '/elements': 'Elements',
  '/review': 'Review Queue',
  '/prompts': 'Prompts',
  '/policy': 'Policy Dashboard',
  '/policy-engine': 'Policy Engine',
  '/page-context': 'Page Context',
  '/chrome-extension': 'Chrome Extension',
};

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ customPaths }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const generateBreadcrumbs = () => {
    if (customPaths) {
      return [{ label: 'Home', path: '/' }, ...customPaths];
    }

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Home', path: '/' }];

    let currentPath = '';
    pathSegments.forEach((segment) => {
      currentPath += `/${segment}`;
      const label = routeLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1);
      breadcrumbs.push({ label, path: currentPath });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <BreadcrumbContainer aria-label="Breadcrumb navigation">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          <BreadcrumbItem
            $isActive={index === breadcrumbs.length - 1}
            onClick={() => index !== breadcrumbs.length - 1 && navigate(crumb.path)}
            disabled={index === breadcrumbs.length - 1}
            aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
          >
            {index === 0 && <Home size={14} />}
            {crumb.label}
          </BreadcrumbItem>
          {index < breadcrumbs.length - 1 && <Separator size={14} />}
        </React.Fragment>
      ))}
    </BreadcrumbContainer>
  );
};
