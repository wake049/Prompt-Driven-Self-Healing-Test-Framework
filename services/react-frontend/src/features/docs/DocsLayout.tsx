import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { Search } from 'lucide-react';
import {
  Layout,
  Sidebar,
  SidebarTitle,
  NavList,
  NavItem,
  NavIconWrapper,
  Main,
  HeaderContainer,
  Breadcrumbs,
  PageTitleRow,
  Title,
  SearchBar,
  SearchInput,
  SearchIconWrapper,
  HeaderSubtitle,
  MobileSectionNav,
  MobileSectionButton,
} from './docs.styles';
import { SECTION_CONFIG } from './docs.config';
import SeoMetadata from '../../shared/ui/SeoMetadata';

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://fluxtest.io').replace(/\/$/, '');

const SidebarLink = styled(NavLink)`
  width: 100%;
  border: none;
  background: transparent;
  color: ${props => props.theme.colors.text};
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  text-decoration: none;
  transition: background 0.2s ease, transform 0.1s ease;

  &:hover {
    background: ${props => props.theme.colors.surfaceLight || props.theme.colors.background};
    transform: translateX(2px);
  }

  &.active {
    background: ${props => props.theme.colors.surfaceLight || props.theme.colors.surface};
    font-weight: 600;
  }
`;

const DocsLayout: React.FC = () => {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const activeSection = SECTION_CONFIG.find(s => pathname.endsWith(s.id));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = search.trim().toLowerCase();
    if (!term) return;
    const match = SECTION_CONFIG.find(
      section =>
        section.title.toLowerCase().includes(term) ||
        section.keywords.some(keyword => keyword.includes(term))
    );
    if (match) {
      navigate(`/docs/${match.id}`);
    }
  };

  return (
    <Layout>
      <SeoMetadata
        title={activeSection ? `${activeSection.title} Documentation` : 'Documentation'}
        description={activeSection
          ? `FluxTest documentation for ${activeSection.title.toLowerCase()}, with production setup guidance, workflows, and operational references.`
          : 'FluxTest documentation covering setup, execution workflows, self-healing review, analytics, policies, and platform operations.'}
        path={activeSection ? `/docs/${activeSection.id}` : '/docs/quick-start'}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: activeSection ? `${activeSection.title} Documentation` : 'FluxTest Documentation',
          description: activeSection
            ? `Production documentation for ${activeSection.title.toLowerCase()} in FluxTest.`
            : 'FluxTest documentation for setup, self-healing workflows, analytics, and governance.',
          url: `${SITE_URL}${activeSection ? `/docs/${activeSection.id}` : '/docs/quick-start'}`,
        }}
      />
      <Sidebar>
        <SidebarTitle>Documentation</SidebarTitle>
        <NavList>
          {SECTION_CONFIG.map(section => (
            <NavItem key={section.id}>
              <SidebarLink to={`/docs/${section.id}`}>
                <NavIconWrapper>{section.icon}</NavIconWrapper>
                <span>{section.title}</span>
              </SidebarLink>
            </NavItem>
          ))}
        </NavList>
      </Sidebar>

      <Main>
        <HeaderContainer>
          <Breadcrumbs>
            <span>Home</span> {'/'} <span>Docs</span>{' '}
            {activeSection && (
              <>{'/'} <span>{activeSection.title}</span></>
            )}
          </Breadcrumbs>

          <PageTitleRow>
            <Title>Help & Documentation</Title>
            <form onSubmit={handleSearchSubmit} style={{ width: '100%', maxWidth: 320 }}>
              <SearchBar>
                <SearchIconWrapper>
                  <Search size={14} />
                </SearchIconWrapper>
                <SearchInput
                  placeholder="Search sections..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </SearchBar>
            </form>
          </PageTitleRow>

          <HeaderSubtitle>
            Learn how to use FluxTest in production workflows: onboard users,
            monitor executions, review AI-assisted healing decisions, and tune
            policy behavior.
          </HeaderSubtitle>

          <MobileSectionNav>
            {SECTION_CONFIG.map(section => (
              <MobileSectionButton
                key={section.id}
                type="button"
                $active={pathname.endsWith(section.id)}
                onClick={() => navigate(`/docs/${section.id}`)}
              >
                {section.title}
              </MobileSectionButton>
            ))}
          </MobileSectionNav>
        </HeaderContainer>

        <Outlet />
      </Main>
    </Layout>
  );
};

export default DocsLayout;
