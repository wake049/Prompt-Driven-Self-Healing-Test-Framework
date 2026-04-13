import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import SeoMetadata from '../../../shared/ui/SeoMetadata';

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://fluxtest.io').replace(/\/$/, '');

const PLAYLIST_URL = import.meta.env.VITE_DEMO_PLAYLIST_URL || 'https://www.youtube.com/playlist?list=PL_DEMO_PLACEHOLDER';

type VideoCategory = 'Core Flows' | 'Generation' | 'Execution & Quality' | 'Governance & Org' | 'Platform';

interface DemoVideoItem {
  key: string;
  category: VideoCategory;
  title: string;
  description: string;
  route?: string;
  videoId?: string;
}

const DEMO_VIDEOS: DemoVideoItem[] = [
  {
    key: 'platform-overview',
    category: 'Core Flows',
    title: 'Platform Overview',
    description: 'End-to-end walkthrough of onboarding to execution with the main app pages.',
    route: '/app/',
    videoId: 'dQw4w9WgXcQ'
  },
  {
    key: 'onboarding-setup',
    category: 'Core Flows',
    title: 'Onboarding & Workspace Setup',
    description: 'Organization setup, plan selection, and first-run configuration flow.',
    route: '/onboarding',
    videoId: 'M7lc1UVf-VE'
  },
  {
    key: 'test-generation',
    category: 'Generation',
    title: 'Test Generation Deep Dive',
    description: 'How prompts, element context, and policies produce executable test steps.',
    route: '/app/prompts',
    videoId: 'M7lc1UVf-VE'
  },
  {
    key: 'test-scenario-generation',
    category: 'Generation',
    title: 'Test Scenario Generation',
    description: 'Turn business requirements into scenario sets with reusable prompt templates.',
    route: '/app/prompts/:id',
    videoId: 'aqz-KE-bpKQ'
  },
  {
    key: 'api-workflows',
    category: 'Generation',
    title: 'API Workflows End-to-End',
    description: 'Building, validating, and running API test data and endpoint scenarios.',
    route: '/app/api-test-data',
    videoId: 'ysz5S6PUM-U'
  },
  {
    key: 'document-to-tests',
    category: 'Generation',
    title: 'Document to Tests',
    description: 'Convert product docs into draft test plans and actionable scenarios.',
    route: '/app/document-to-tests'
  },
  {
    key: 'page-context-management',
    category: 'Generation',
    title: 'Page Context Management',
    description: 'Capture and maintain page context data that improves test generation quality.',
    route: '/app/page-context'
  },
  {
    key: 'test-suites-overview',
    category: 'Generation',
    title: 'Test Suites Overview',
    description: 'Organize prompts and cases into reusable suites for regression execution.',
    route: '/app/test-suites'
  },
  {
    key: 'test-suite-details',
    category: 'Generation',
    title: 'Test Suite Detail View',
    description: 'Inspect suite-level runs, case composition, and workflow-level test coverage.',
    route: '/app/test-suites/:suiteId'
  },
  {
    key: 'elements-capture',
    category: 'Execution & Quality',
    title: 'Recording & Element Capture',
    description: 'Capture elements, selectors, and page metadata from the extension workflow.',
    route: '/app/elements',
    videoId: '9bZkp7q19f0'
  },
  {
    key: 'execution-dashboard',
    category: 'Execution & Quality',
    title: 'Execution Dashboard',
    description: 'Track run status, success trends, and active execution health in one view.',
    route: '/app/execution'
  },
  {
    key: 'run-details-debugging',
    category: 'Execution & Quality',
    title: 'Run Details & Debugging',
    description: 'Inspect step logs, failure evidence, and screenshots to accelerate triage.',
    route: '/app/execution/:executionId',
    videoId: 'kXYiU_JCYtU'
  },
  {
    key: 'healing-review-queue',
    category: 'Execution & Quality',
    title: 'Self-Healing & Review Queue',
    description: 'How healing decisions flow through policy and human review.',
    route: '/app/review',
    videoId: '3JZ_D3ELwOQ'
  },
  {
    key: 'review-decision-detail',
    category: 'Execution & Quality',
    title: 'Review Decision Detail',
    description: 'Walk through evidence-level review for a specific healing decision.',
    route: '/app/review/:id'
  },
  {
    key: 'policy-dashboard',
    category: 'Governance & Org',
    title: 'Policy Dashboard & Engine',
    description: 'Set safety policies, confidence thresholds, and review routing.',
    route: '/app/policy'
  },
  {
    key: 'policy-engine-advanced',
    category: 'Governance & Org',
    title: 'Policy Engine Advanced Controls',
    description: 'Configure policy rules and thresholds in the advanced engine view.',
    route: '/app/policy-engine'
  },
  {
    key: 'organization-settings',
    category: 'Governance & Org',
    title: 'Organization & Billing Settings',
    description: 'Manage members, limits, and subscription controls for each tenant.',
    route: '/app/organization'
  },
  {
    key: 'analytics-overview',
    category: 'Governance & Org',
    title: 'Analytics Overview & Trends',
    description: 'Understand execution quality trends and AI-assisted healing performance.',
    route: '/app/analytics'
  },
  {
    key: 'analytics-trends',
    category: 'Governance & Org',
    title: 'Analytics Trend Analysis',
    description: 'Analyze trends and regressions across runs over configurable time windows.',
    route: '/app/analytics/trends'
  },
  {
    key: 'ai-insights',
    category: 'Governance & Org',
    title: 'AI Insights & Healing Success',
    description: 'Review AI-generated insights and healing effectiveness over time.',
    route: '/app/analytics/ai-insights'
  },
  {
    key: 'healing-success-dashboard',
    category: 'Governance & Org',
    title: 'Healing Success Dashboard',
    description: 'Track healing conversion outcomes and confidence over time.',
    route: '/app/analytics/healing-success'
  },
  {
    key: 'docs-reference',
    category: 'Platform',
    title: 'Documentation & API Reference',
    description: 'Navigate setup docs, architecture guides, and API references quickly.',
    route: '/docs'
  },
  {
    key: 'chrome-extension-setup',
    category: 'Platform',
    title: 'Chrome Extension Setup',
    description: 'Install and connect the extension used for element recording.',
    route: '/app/chrome-extension'
  },
  {
    key: 'runners-operations',
    category: 'Platform',
    title: 'Runners Operations',
    description: 'Manage runner health, capacity, and execution distribution across workloads.',
    route: '/app/runners'
  }
];

const CATEGORY_ORDER: VideoCategory[] = [
  'Core Flows',
  'Generation',
  'Execution & Quality',
  'Governance & Org',
  'Platform'
];

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.colors.background};
`;

const Content = styled.div`
  flex: 1;
  max-width: 1400px;
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

  @media (max-width: 768px) {
    font-size: 36px;
  }
`;

const Subtitle = styled.p`
  font-size: 20px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  margin-bottom: 40px;
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 24px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const PlayerCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 16px;
  padding: 16px;
`;

const VideoFrame = styled.iframe`
  width: 100%;
  aspect-ratio: 16 / 9;
  border: none;
  border-radius: 12px;
  margin-bottom: 16px;
`;

const VideoTitle = styled.h2`
  font-size: 26px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 8px 0;
`;

const VideoDescription = styled.p`
  font-size: 15px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  margin: 0;
`;

const PlaylistButton = styled.a`
  display: inline-block;
  margin-top: 16px;
  font-size: 14px;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const NavCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 16px;
  padding: 16px;
`;

const NavTitle = styled.h3`
  margin: 0 0 12px 0;
  font-size: 18px;
  color: ${props => props.theme.colors.text};
`;

const CategoryTitle = styled.h4`
  margin: 16px 0 8px 0;
  font-size: 13px;
  font-weight: 700;
  color: ${props => props.theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const VideoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const VideoItemButton = styled.button<{ $active: boolean }>`
  text-align: left;
  width: 100%;
  border-radius: 10px;
  border: 1px solid ${props => props.$active ? props.theme.colors.primary : props.theme.colors.border};
  background: ${props => props.$active ? `${props.theme.colors.primary}11` : props.theme.colors.background};
  padding: 12px;
  cursor: pointer;

  &:hover {
    border-color: ${props => props.theme.colors.primary};
  }
`;

const VideoItemTitle = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 4px;
`;

const VideoItemDescription = styled.div`
  font-size: 13px;
  color: ${props => props.theme.colors.textSecondary};
`;

const RouteHint = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
`;

const PlaceholderPlayer = styled.div`
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 1px dashed ${props => props.theme.colors.border};
  border-radius: 12px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme.colors.textSecondary};
  background: ${props => props.theme.colors.background};
  text-align: center;
  padding: 24px;
`;

export const DemoVideosPage: React.FC = () => {
  const [activeVideoKey, setActiveVideoKey] = useState(DEMO_VIDEOS[0].key);

  const activeVideo = useMemo(
    () => DEMO_VIDEOS.find(video => video.key === activeVideoKey) || DEMO_VIDEOS[0],
    [activeVideoKey]
  );

  const videosByCategory = useMemo(() => {
    return CATEGORY_ORDER.map(category => ({
      category,
      videos: DEMO_VIDEOS.filter(video => video.category === category)
    })).filter(section => section.videos.length > 0);
  }, []);

  return (
    <PageContainer>
      <SeoMetadata
        title="Video Tutorials"
        description="Browse FluxTest video tutorials covering onboarding, prompts, test suites, executions, analytics, governance, runners, and platform setup."
        path="/demo-videos"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'FluxTest Video Tutorials',
          itemListElement: DEMO_VIDEOS.map((video, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: video.title,
            url: `${SITE_URL}/demo-videos`,
            description: video.description,
          })),
        }}
      />
      <LandingHeader />
      <Content>
        <Title>FluxTest Video Tutorials</Title>
        <Subtitle>
          Search-friendly walkthroughs for test generation, self-healing workflows, execution analytics,
          governance controls, platform setup, and operational reliability.
        </Subtitle>

        <Layout>
          <PlayerCard>
            {activeVideo.videoId ? (
              <VideoFrame
                src={`https://www.youtube.com/embed/${activeVideo.videoId}`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <PlaceholderPlayer>
                Video planned for this page walkthrough. Use the playlist link to publish and map this entry.
              </PlaceholderPlayer>
            )}
            <VideoTitle>{activeVideo.title}</VideoTitle>
            <VideoDescription>{activeVideo.description}</VideoDescription>
            {activeVideo.route && <RouteHint>Covers page: {activeVideo.route}</RouteHint>}
            <PlaylistButton href={PLAYLIST_URL} target="_blank" rel="noopener noreferrer">
              Open full YouTube playlist
            </PlaylistButton>
          </PlayerCard>

          <NavCard>
            <NavTitle>Video Navigation</NavTitle>
            {videosByCategory.map(section => (
              <React.Fragment key={section.category}>
                <CategoryTitle>{section.category}</CategoryTitle>
                <VideoList>
                  {section.videos.map(video => (
                    <VideoItemButton
                      key={video.key}
                      $active={video.key === activeVideo.key}
                      onClick={() => setActiveVideoKey(video.key)}
                    >
                      <VideoItemTitle>{video.title}</VideoItemTitle>
                      <VideoItemDescription>{video.description}</VideoItemDescription>
                      {video.route && <RouteHint>{video.route}</RouteHint>}
                    </VideoItemButton>
                  ))}
                </VideoList>
              </React.Fragment>
            ))}
          </NavCard>
        </Layout>
      </Content>
      <LandingFooter />
    </PageContainer>
  );
};
