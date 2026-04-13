import React from 'react';
import styled from 'styled-components';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import { Plus, Bug, Zap, Shield, Wrench } from 'lucide-react';
import SeoMetadata from '../../../shared/ui/SeoMetadata';

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.colors.background};
`;

const Content = styled.div`
  flex: 1;
  max-width: 1200px;
  margin: 120px auto 80px;
  padding: 0 64px;

  @media (max-width: 768px) {
    padding: 0 24px;
    margin: 100px auto 60px;
  }
`;

const Title = styled.h1`
  font-size: 48px;
  font-weight: 800;
  color: ${props => props.theme.colors.text};
  margin-bottom: 16px;
`;

const Subtitle = styled.p`
  font-size: 18px;
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 48px;
`;

const VersionSection = styled.div`
  margin-bottom: 48px;
  padding-bottom: 48px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  
  &:last-child {
    border-bottom: none;
  }
`;

const VersionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const VersionTitle = styled.h2`
  font-size: 32px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
`;

const VersionDate = styled.span`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const ChangeCategory = styled.div`
  margin-bottom: 24px;
`;

const CategoryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const CategoryIcon = styled.div<{ $type: 'feature' | 'fix' | 'improvement' | 'security' | 'internal' }>`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => {
    switch(props.$type) {
      case 'feature': return props.theme.colors.primary + '11';
      case 'fix': return '#A32D2D11';
      case 'improvement': return props.theme.colors.success + '11';
      case 'security': return '#8b5cf611';
      case 'internal': return props.theme.colors.border;
    }
  }};
  color: ${props => {
    switch(props.$type) {
      case 'feature': return props.theme.colors.primary;
      case 'fix': return '#A32D2D';
      case 'improvement': return props.theme.colors.success;
      case 'security': return '#8b5cf6';
      case 'internal': return props.theme.colors.textSecondary;
    }
  }};
`;

const CategoryTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
`;

const ChangeList = styled.ul`
  margin-left: 44px;
  
  li {
    font-size: 15px;
    color: ${props => props.theme.colors.textSecondary};
    line-height: 1.7;
    margin-bottom: 8px;
  }
`;

export const ChangelogPage: React.FC = () => {
  return (
    <PageContainer>
      <SeoMetadata
        title="Product Changelog"
        description="Track FluxTest releases, improvements, fixes, documentation changes, and product updates across the platform."
        path="/changelog"
      />
      <LandingHeader />
      <Content>
        <Title>Changelog</Title>
        <Subtitle>
          Track updates, improvements, and fixes to FluxTest
        </Subtitle>

        <VersionSection>
          <VersionHeader>
            <VersionTitle>v0.3.1</VersionTitle>
            <VersionDate>April 13, 2026</VersionDate>
          </VersionHeader>

          <ChangeCategory>
            <CategoryHeader>
              <CategoryIcon $type="improvement">
                <Zap size={18} />
              </CategoryIcon>
              <CategoryTitle>Improvements</CategoryTitle>
            </CategoryHeader>
            <ChangeList>
              <li>Failure Analysis now presents read-only AI insights instead of auto-running debug step workflows</li>
              <li>Roadmap page updated to reflect recent reliability and AI troubleshooting milestones</li>
              <li>Bulk Elements page now hides unfinished tabs to avoid dead-end navigation</li>
            </ChangeList>
          </ChangeCategory>

          <ChangeCategory>
            <CategoryHeader>
              <CategoryIcon $type="fix">
                <Bug size={18} />
              </CategoryIcon>
              <CategoryTitle>Bug Fixes</CategoryTitle>
            </CategoryHeader>
            <ChangeList>
              <li>Fixed dashboard data loading issues caused by API client base URL and auth token mismatches</li>
              <li>Resolved analytics and failure-analysis backend query errors by aligning with current JSONB step result schema</li>
              <li>Fixed minimal reproduction generation failures in AI service (schema joins, row fetching, and mixed data-shape handling)</li>
              <li>Stabilized failure analysis rendering to support both id formats and show actionable errors when analysis cannot run</li>
            </ChangeList>
          </ChangeCategory>
        </VersionSection>

        <VersionSection>
          <VersionHeader>
            <VersionTitle>v0.3.0</VersionTitle>
            <VersionDate>February 9, 2026</VersionDate>
          </VersionHeader>

          <ChangeCategory>
            <CategoryHeader>
              <CategoryIcon $type="feature">
                <Plus size={18} />
              </CategoryIcon>
              <CategoryTitle>New Features</CategoryTitle>
            </CategoryHeader>
            <ChangeList>
              <li>Comprehensive documentation page with sticky navigation and interactive sections</li>
              <li>Prompt generation guidance with good vs bad examples</li>
              <li>Added About, Contact, Security, Privacy, Terms, Roadmap, and Changelog pages</li>
              <li>Enhanced landing page with functional footer links</li>
            </ChangeList>
          </ChangeCategory>

          <ChangeCategory>
            <CategoryHeader>
              <CategoryIcon $type="improvement">
                <Zap size={18} />
              </CategoryIcon>
              <CategoryTitle>Improvements</CategoryTitle>
            </CategoryHeader>
            <ChangeList>
              <li>Expanded all documentation sections with detailed explanations and tables</li>
              <li>Added subsections, info boxes, warnings, and tips throughout docs</li>
              <li>Improved visual hierarchy with step badges and styled components</li>
              <li>Enhanced execution status reference with detailed metrics</li>
            </ChangeList>
          </ChangeCategory>

          <ChangeCategory>
            <CategoryHeader>
              <CategoryIcon $type="fix">
                <Bug size={18} />
              </CategoryIcon>
              <CategoryTitle>Bug Fixes</CategoryTitle>
            </CategoryHeader>
            <ChangeList>
              <li>Fixed sticky header overlay issues in documentation page</li>
              <li>Resolved sidebar scrolling behavior on long content</li>
              <li>Corrected navigation link routing throughout the app</li>
            </ChangeList>
          </ChangeCategory>
        </VersionSection>

        <VersionSection>
          <VersionHeader>
            <VersionTitle>v0.2.0</VersionTitle>
            <VersionDate>January 2026</VersionDate>
          </VersionHeader>

          <ChangeCategory>
            <CategoryHeader>
              <CategoryIcon $type="feature">
                <Plus size={18} />
              </CategoryIcon>
              <CategoryTitle>New Features</CategoryTitle>
            </CategoryHeader>
            <ChangeList>
              <li>Onboarding wizard with subscription plan selection</li>
              <li>Free trial periods differentiated by subscription tier</li>
              <li>Organization and subscription management in onboarding flow</li>
              <li>Landing page with hero section, features, pricing, and footer</li>
            </ChangeList>
          </ChangeCategory>

          <ChangeCategory>
            <CategoryHeader>
              <CategoryIcon $type="improvement">
                <Zap size={18} />
              </CategoryIcon>
              <CategoryTitle>Improvements</CategoryTitle>
            </CategoryHeader>
            <ChangeList>
              <li>Simplified landing page messaging to clarify core platform value</li>
              <li>Updated CTAs to better align with product onboarding</li>
              <li>Enhanced pricing section with clear trial duration indicators</li>
            </ChangeList>
          </ChangeCategory>
        </VersionSection>

        <VersionSection>
          <VersionHeader>
            <VersionTitle>v0.1.0</VersionTitle>
            <VersionDate>December 2025</VersionDate>
          </VersionHeader>

          <ChangeCategory>
            <CategoryHeader>
              <CategoryIcon $type="feature">
                <Plus size={18} />
              </CategoryIcon>
              <CategoryTitle>Initial Release</CategoryTitle>
            </CategoryHeader>
            <ChangeList>
              <li>Core self-healing test execution engine</li>
              <li>AI-powered test plan generation from natural language</li>
              <li>Element healing proposal system with review queue</li>
              <li>Policy engine for configuring safety controls</li>
              <li>Execution dashboard with run history and metrics</li>
              <li>Chrome extension for capturing authentication flows</li>
              <li>Secure authentication and session management</li>
              <li>Persistent data layer with migration support</li>
              <li>Dedicated browser execution runtime with real-time orchestration</li>
            </ChangeList>
          </ChangeCategory>
        </VersionSection>
      </Content>
      <LandingFooter />
    </PageContainer>
  );
};
