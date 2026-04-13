import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { BookOpen, PlayCircle, Settings, Activity, Shield, HelpCircle, Code2, AlertTriangle, Search, ThumbsUp, ThumbsDown, ArrowRight } from 'lucide-react';

const Layout = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: ${props => props.theme.colors.background};
`;

const Sidebar = styled.aside`
  width: 260px;
  padding: 32px 24px;
  border-right: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface};
  flex-shrink: 0;
  overflow-y: auto;
  height: 100%;

  @media (max-width: 960px) {
    display: none;
  }
`;

const SidebarTitle = styled.h2`
  font-size: 18px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 16px 0;
`;

const NavList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const NavItem = styled.li<{ $active?: boolean }>`
  margin-bottom: 6px;
  button {
    width: 100%;
    border: none;
    background: ${props => props.$active ? props.theme.colors.surfaceLight || props.theme.colors.surface : 'transparent'};
    color: ${props => props.theme.colors.text};
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s ease, transform 0.1s ease;

    &:hover {
      background: ${props => props.theme.colors.surfaceLight || props.theme.colors.background};
      transform: translateX(2px);
    }
  }
`;

const NavIconWrapper = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Main = styled.main`
  flex: 1;
  padding: 0 40px 64px;
  overflow-y: auto;
  height: 100%;

  @media (max-width: 960px) {
    padding: 0 16px 40px;
  }
`;

const HeaderContainer = styled.div`
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 24px 0 16px 0;
  margin: 0 -40px 16px -40px;
  padding-left: 40px;
  padding-right: 40px;
  background: ${props => props.theme.colors.background};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  
  @media (max-width: 960px) {
    margin: 0 -16px 16px -16px;
    padding-left: 16px;
    padding-right: 16px;
  }
`;

const Breadcrumbs = styled.nav`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 12px;

  span {
    cursor: default;
  }

  button {
    border: none;
    background: none;
    padding: 0;
    margin: 0;
    color: inherit;
    cursor: pointer;
  }
`;

const PageTitleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0;
`;

const SearchBar = styled.div`
  position: relative;
  max-width: 320px;
  width: 100%;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 8px 32px 8px 32px;
  border-radius: 999px;
  border: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 2px ${props => props.theme.colors.primary}22;
  }
`;

const SearchIconWrapper = styled.div`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: ${props => props.theme.colors.textSecondary};
`;

const HeaderSubtitle = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0 0 24px 0;
  max-width: 720px;
`;

const MobileSectionNav = styled.div`
  display: none;

  @media (max-width: 960px) {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
`;

const MobileSectionButton = styled.button<{ $active?: boolean }>`
  border: 1px solid ${props => (props.$active ? props.theme.colors.primary : props.theme.colors.border)};
  background: ${props => (props.$active ? props.theme.colors.primary + '11' : props.theme.colors.surface)};
  color: ${props => props.theme.colors.text};
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
`;

const TwoColumnLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1.1fr);
  gap: 24px;
  margin-bottom: 32px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.section`
  border-radius: 16px;
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  padding: 20px 20px 16px;
  margin-bottom: 24px;
`;

const CardHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

const CardTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CardIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.theme.colors.primary}11;
  color: ${props => props.theme.colors.primary};
`;

const CardTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0;
`;

const CardMeta = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
`;

const CardBody = styled.div`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
`;

const NumberedList = styled.ol`
  padding-left: 20px;
  margin: 8px 0 12px;

  li {
    margin-bottom: 6px;
  }
`;

const ScreenshotPlaceholder = styled.div`
  border-radius: 12px;
  border: 1px dashed ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.background};
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
`;

const FlowDiagram = styled.div`
  border-radius: 12px;
  padding: 12px 14px;
  background: linear-gradient(135deg, ${props => props.theme.colors.background} 0%, ${props => props.theme.colors.surface} 100%);
  border: 1px solid ${props => props.theme.colors.border};
  font-size: 12px;
`;

const FlowRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Arrow = styled.span`
  color: ${props => props.theme.colors.textSecondary};
`;

const MetricPillRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

const MetricPill = styled.span<{ $tone?: 'success' | 'warning' | 'info' }>`
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid
    ${props =>
      props.$tone === 'success'
        ? props.theme.colors.success
        : props.$tone === 'warning'
        ? props.theme.colors.warning || '#f59e0b'
        : props.theme.colors.border};
  background:
    ${props =>
      props.$tone === 'success'
        ? props.theme.colors.success + '11'
        : props.$tone === 'warning'
        ? '#f59e0b11'
        : props.theme.colors.surface};
`;

const AccordionItem = styled.div`
  border-radius: 10px;
  border: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface};
  margin-bottom: 8px;
  overflow: hidden;
`;

const AccordionHeader = styled.button<{ $open?: boolean }>`
  width: 100%;
  border: none;
  background: transparent;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 14px;
  color: ${props => props.theme.colors.text};

  &:hover {
    background: ${props => props.theme.colors.surfaceLight || props.theme.colors.background};
  }
`;

const AccordionContent = styled.div<{ $open?: boolean }>`
  max-height: ${props => (props.$open ? '400px' : '0')};
  overflow: hidden;
  transition: max-height 0.2s ease;
  padding: ${props => (props.$open ? '0 12px 10px' : '0 12px 0')};
  font-size: 13px;
  color: ${props => props.theme.colors.textSecondary};
`;

const TabsHeader = styled.div`
  display: inline-flex;
  padding: 3px;
  background: ${props => props.theme.colors.background};
  border-radius: 999px;
  border: 1px solid ${props => props.theme.colors.border};
  margin-bottom: 8px;
`;

const TabButton = styled.button<{ $active?: boolean }>`
  border: none;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  background: ${props => (props.$active ? props.theme.colors.primary : 'transparent')};
  color: ${props => (props.$active ? 'white' : props.theme.colors.textSecondary)};

  &:hover {
    opacity: 0.9;
  }
`;

const CodeContainer = styled.pre`
  position: relative;
  background: #020617;
  color: #e5e7eb;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 12px;
  overflow-x: auto;
  margin: 0;
`;

const CodeBlockInner = styled.code`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
`;

const PromptExampleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 12px;
`;

const PromptExampleCard = styled.div`
  border-radius: 10px;
  border: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.background};
  padding: 8px 10px;
  font-size: 12px;
`;

const PromptExampleLabel = styled.div<{ $tone?: 'good' | 'bad' | 'improved' }>`
  font-weight: 600;
  margin-bottom: 4px;
  color: ${props =>
    props.$tone === 'good'
      ? props.theme.colors.success
      : props.$tone === 'bad'
      ? props.theme.colors.warning || '#b91c1c'
      : props.theme.colors.primary};
`;

const SubSection = styled.div`
  margin-top: 16px;
  padding: 12px;
  border-left: 3px solid ${props => props.theme.colors.primary};
  background: ${props => props.theme.colors.surfaceLight || props.theme.colors.surface};
  border-radius: 8px;
`;

const SubSectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 8px 0;
`;

const InfoBox = styled.div<{ $variant?: 'info' | 'warning' | 'success' | 'tip' }>`
  padding: 10px 12px;
  border-radius: 8px;
  margin: 10px 0;
  border-left: 3px solid ${props => {
    switch(props.$variant) {
      case 'warning': return props.theme.colors.warning || '#f59e0b';
      case 'success': return props.theme.colors.success;
      case 'tip': return '#8b5cf6';
      default: return props.theme.colors.primary;
    }
  }};
  background: ${props => {
    switch(props.$variant) {
      case 'warning': return '#f59e0b11';
      case 'success': return props.theme.colors.success + '11';
      case 'tip': return '#8b5cf611';
      default: return props.theme.colors.primary + '11';
    }
  }};
  font-size: 13px;
  line-height: 1.5;
`;

const TableWrapper = styled.div`
  overflow-x: auto;
  margin: 12px 0;
`;

const DataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  
  th {
    text-align: left;
    padding: 8px 10px;
    background: ${props => props.theme.colors.background};
    border-bottom: 2px solid ${props => props.theme.colors.border};
    font-weight: 600;
    color: ${props => props.theme.colors.text};
  }
  
  td {
    padding: 8px 10px;
    border-bottom: 1px solid ${props => props.theme.colors.border};
    color: ${props => props.theme.colors.textSecondary};
  }
  
  tr:last-child td {
    border-bottom: none;
  }
`;

const StepBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${props => props.theme.colors.primary};
  color: white;
  font-size: 11px;
  font-weight: 600;
  margin-right: 6px;
`;

const CopyButton = styled.button`
  position: absolute;
  top: 6px;
  right: 6px;
  border-radius: 999px;
  border: none;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  background: #0f172a;
  color: #e5e7eb;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &:hover {
    background: #020617;
  }
`;

const FeedbackRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid ${props => props.theme.colors.border};
  font-size: 12px;
`;

const FeedbackButtons = styled.div`
  display: flex;
  gap: 6px;
`;

const FeedbackButton = styled.button<{ $active?: boolean }>`
  border-radius: 999px;
  border: 1px solid ${props => (props.$active ? props.theme.colors.primary : props.theme.colors.border)};
  padding: 4px 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  background: ${props => (props.$active ? props.theme.colors.primary + '11' : props.theme.colors.surface)};
  cursor: pointer;

  svg {
    width: 14px;
    height: 14px;
  }
`;

const RelatedRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
`;

const RelatedLink = styled.button`
  border-radius: 999px;
  border: none;
  padding: 4px 10px;
  font-size: 11px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.textSecondary};
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
`;

const VideoPlaceholder = styled.div`
  border-radius: 12px;
  border: 1px solid ${props => props.theme.colors.border};
  background: radial-gradient(circle at 20% 20%, #1d4ed8 0, #020617 50%);
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e5e7eb;
  font-size: 13px;
  gap: 8px;
`;

const DownloadLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
`;

const DownloadButton = styled.a`
  border-radius: 999px;
  border: 1px solid ${props => props.theme.colors.border};
  padding: 6px 10px;
  font-size: 11px;
  text-decoration: none;
  color: ${props => props.theme.colors.text};
  background: ${props => props.theme.colors.surface};
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

type SectionId =
  | 'quick-start'
  | 'access'
  | 'executions'
  | 'runner'
  | 'self-healing'
  | 'policies'
  | 'prompts'
  | 'api'
  | 'faqs'
  | 'troubleshooting';

interface SectionConfigItem {
  id: SectionId;
  title: string;
  icon: React.ReactNode;
  keywords: string[];
}

const SECTION_CONFIG: SectionConfigItem[] = [
  { id: 'quick-start', title: 'Quick Start', icon: <BookOpen size={16} />, keywords: ['start', 'onboarding', 'setup'] },
  { id: 'access', title: 'Getting Access', icon: <Activity size={16} />, keywords: ['login', 'auth', 'account', 'access'] },
  { id: 'executions', title: 'Executions & Dashboards', icon: <Activity size={16} />, keywords: ['dashboard', 'runs', 'metrics', 'execution'] },
  { id: 'runner', title: 'Runner Setup & Usage', icon: <PlayCircle size={16} />, keywords: ['runner', 'browser', 'capacity', 'queue'] },
  { id: 'self-healing', title: 'Element Review & Self-Healing', icon: <Settings size={16} />, keywords: ['healing', 'review', 'selectors', 'elements'] },
  { id: 'policies', title: 'Policies & Safety Controls', icon: <Shield size={16} />, keywords: ['policy', 'safety', 'approval', 'thresholds'] },
  { id: 'prompts', title: 'Prompt Generation', icon: <BookOpen size={16} />, keywords: ['prompt', 'generation', 'nl', 'plan'] },
  { id: 'api', title: 'API Reference', icon: <Code2 size={16} />, keywords: ['api', 'endpoint', 'request', 'response'] },
  { id: 'faqs', title: 'FAQs', icon: <HelpCircle size={16} />, keywords: ['faq', 'questions', 'answers'] },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: <AlertTriangle size={16} />, keywords: ['errors', 'issues', 'debug', 'troubleshoot'] },
];

const scrollToSection = (id: SectionId) => {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

interface CodeSampleTabsProps {
  samples: { id: string; label: string; code: string }[];
}

const CodeSampleTabs: React.FC<CodeSampleTabsProps> = ({ samples }) => {
  const [activeId, setActiveId] = useState(samples[0]?.id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeSample = useMemo(
    () => samples.find(s => s.id === activeId) ?? samples[0],
    [samples, activeId]
  );

  const handleCopy = async () => {
    try {
      if (!activeSample) return;
      await navigator.clipboard?.writeText(activeSample.code);
      setCopiedId(activeSample.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard errors in restricted browser contexts.
    }
  };

  if (!activeSample) return null;

  return (
    <div>
      <TabsHeader>
        {samples.map(sample => (
          <TabButton
            key={sample.id}
            $active={sample.id === activeSample.id}
            type="button"
            onClick={() => setActiveId(sample.id)}
          >
            {sample.label}
          </TabButton>
        ))}
      </TabsHeader>
      <CodeContainer>
        <CopyButton type="button" onClick={handleCopy}>
          {copiedId === activeSample.id ? 'Copied' : 'Copy'}
        </CopyButton>
        <CodeBlockInner>{activeSample.code}</CodeBlockInner>
      </CodeContainer>
    </div>
  );
};

const DocumentationPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<SectionId>('quick-start');
  const [feedback, setFeedback] = useState<Record<SectionId, 'yes' | 'no' | undefined>>({});
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [openTrouble, setOpenTrouble] = useState<number | null>(0);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = search.trim().toLowerCase();
    if (!term) return;
    const match = SECTION_CONFIG.find(section =>
      section.title.toLowerCase().includes(term) ||
      section.keywords.some(keyword => keyword.includes(term))
    );
    if (match) {
      setActiveSection(match.id);
      scrollToSection(match.id);
    }
  };

  const handleNavClick = (id: SectionId) => {
    setActiveSection(id);
    scrollToSection(id);
  };

  const handleFeedback = (sectionId: SectionId, value: 'yes' | 'no') => {
    setFeedback(prev => ({ ...prev, [sectionId]: value }));
  };

  const renderFeedback = (sectionId: SectionId) => (
    <FeedbackRow>
      <span>Was this helpful?</span>
      <FeedbackButtons>
        <FeedbackButton
          type="button"
          $active={feedback[sectionId] === 'yes'}
          onClick={() => handleFeedback(sectionId, 'yes')}
        >
          <ThumbsUp size={14} /> Yes
        </FeedbackButton>
        <FeedbackButton
          type="button"
          $active={feedback[sectionId] === 'no'}
          onClick={() => handleFeedback(sectionId, 'no')}
        >
          <ThumbsDown size={14} /> No
        </FeedbackButton>
      </FeedbackButtons>
    </FeedbackRow>
  );

  return (
    <Layout>
      <Sidebar>
        <SidebarTitle>Documentation</SidebarTitle>
        <NavList>
          {SECTION_CONFIG.map(section => (
            <NavItem key={section.id} $active={section.id === activeSection}>
              <button type="button" onClick={() => handleNavClick(section.id)}>
                <NavIconWrapper>{section.icon}</NavIconWrapper>
                <span>{section.title}</span>
              </button>
            </NavItem>
          ))}
        </NavList>
      </Sidebar>

      <Main>
        <HeaderContainer>
          <Breadcrumbs>
            <span>Home</span> {'/'} <span>Docs</span> {'/'} <span>Self-Healing UI</span>
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
                $active={section.id === activeSection}
                onClick={() => handleNavClick(section.id)}
              >
                {section.title}
              </MobileSectionButton>
            ))}
          </MobileSectionNav>
        </HeaderContainer>

        {/* Quick Start + Video */}
        <TwoColumnLayout id="quick-start">
          <Card>
            <CardHeader>
              <CardTitleRow>
                <CardIcon>
                  <BookOpen size={18} />
                </CardIcon>
                <CardTitle>Quick Start Guide</CardTitle>
              </CardTitleRow>
              <CardMeta>Approx. 5 minutes</CardMeta>
            </CardHeader>
            <CardBody>
              <p>
                Use this flow when you want to go from a fresh browser window
                to inspecting real healing decisions as quickly as possible.
                It assumes you are running the full docker stack locally.
              </p>
              <InfoBox $variant="info">
                <strong>Prerequisites:</strong> Docker Desktop running, ports 3000/8000/5432 available,
                and the full stack started via <code>docker-compose up</code> or the local start script.
              </InfoBox>
              
              <SubSection>
                <SubSectionTitle><StepBadge>1</StepBadge>Launch Onboarding</SubSectionTitle>
                <p>Navigate to <code>https://your-domain.com</code> and click "Get Started".
                This begins the multi-step registration wizard that handles account creation,
                organization setup, and plan selection in one flow.</p>
              </SubSection>
              
              <SubSection>
                <SubSectionTitle><StepBadge>2</StepBadge>Create Account & Organization</SubSectionTitle>
                <p>Fill in your name, email, and password. Choose the plan that fits your team.
                The system will create:</p>
                <ul>
                  <li>A new user account</li>
                  <li>An organization record with your user as owner</li>
                  <li>A subscription entry for entitlement and usage tracking</li>
                </ul>
              </SubSection>
              
              <SubSection>
                <SubSectionTitle><StepBadge>3</StepBadge>Explore Execution Dashboard</SubSectionTitle>
                <p>After onboarding completes (~30 seconds), you'll land on the execution dashboard.
                Recent test runs appear in the dashboard, including examples of passed,
                failed, and pending review scenarios for healing workflows.</p>
              </SubSection>
              
              <SubSection>
                <SubSectionTitle><StepBadge>4</StepBadge>Inspect Healing Decisions</SubSectionTitle>
                <p>Click any run with "pending_review" status. You'll see:</p>
                <ul>
                  <li>Step-by-step execution timeline with screenshots</li>
                  <li>Element context snapshots (attributes, text, position)</li>
                  <li>AI-proposed selector changes with confidence scores</li>
                  <li>Request/response payloads for API-driven steps</li>
                </ul>
              </SubSection>
              
              <SubSection>
                <SubSectionTitle><StepBadge>5</StepBadge>Review & Approve Changes</SubSectionTitle>
                <p>Navigate to the Review Queue from the sidebar. Each pending item shows
                before/after selector comparisons. Approve to update the test plan, or reject
                to keep the original selector and flag the element for manual investigation.</p>
              </SubSection>
              
              <InfoBox $variant="tip">
                <strong>Pro tip:</strong> Try the "Prompts" page to generate new test plans via
                natural language. The AI will create executable Selenium steps that automatically
                feed into this same healing workflow.
              </InfoBox>
              <ScreenshotPlaceholder>
                Onboarding wizard overview illustration
              </ScreenshotPlaceholder>
              {renderFeedback('quick-start')}
              <RelatedRow>
                <RelatedLink type="button">
                  <ArrowRight size={12} /> View onboarding visuals
                </RelatedLink>
              </RelatedRow>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitleRow>
                <CardIcon>
                  <PlayCircle size={18} />
                </CardIcon>
                <CardTitle>Video Tutorial</CardTitle>
              </CardTitleRow>
              <CardMeta>Video library</CardMeta>
            </CardHeader>
            <CardBody>
              <VideoPlaceholder>
                <PlayCircle size={24} />
                <span>Walkthrough video library</span>
              </VideoPlaceholder>
              <DownloadLinks>
                <DownloadButton href="/docs#quick-start">
                  <ArrowRight size={12} /> Jump to Quick Start section
                </DownloadButton>
              </DownloadLinks>
            </CardBody>
          </Card>
        </TwoColumnLayout>

        {/* Getting Access */}
        <Card id="access">
          <CardHeader>
            <CardTitleRow>
              <CardIcon>
                <Activity size={18} />
              </CardIcon>
              <CardTitle>Getting Access</CardTitle>
            </CardTitleRow>
          </CardHeader>
          <CardBody>
            <p>
              Access is managed through onboarding and standard sign-in flows. Users can
              create a new account or sign in with an existing workspace account.
            </p>
            
            <InfoBox $variant="warning">
              <strong>Security Notice:</strong> Use strong credentials, enforce role-based access,
              and follow your organization's identity and data governance policies.
            </InfoBox>
            
            <SubSection>
              <SubSectionTitle>Authentication Flow</SubSectionTitle>
              <TableWrapper>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>Action</th>
                      <th>Backend</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1. Registration</td>
                      <td>POST user credentials</td>
                      <td>/api/v1/auth/register</td>
                    </tr>
                    <tr>
                      <td>2. Token Generation</td>
                      <td>Server issues JWT</td>
                      <td>Returns token in response</td>
                    </tr>
                    <tr>
                      <td>3. Session Storage</td>
                      <td>Token saved to localStorage</td>
                      <td>Included in all subsequent requests</td>
                    </tr>
                    <tr>
                      <td>4. Dashboard Redirect</td>
                      <td>Navigate to /app</td>
                      <td>Protected route validates token</td>
                    </tr>
                  </tbody>
                </DataTable>
              </TableWrapper>
            </SubSection>
            
            <TwoColumnLayout>
              <div>
                <SubSectionTitle>Step-by-Step Guide</SubSectionTitle>
                <NumberedList>
                  <li>Open the landing page and click "Get Started".</li>
                  <li>Provide your name, email, and password.</li>
                  <li>
                    Complete organization and plan details to align workspace access,
                    limits, and governance behavior.
                  </li>
                  <li>
                    Finish setup to be redirected into the app. Your browser session will
                    remain active until sign-out or token expiration.
                  </li>
                </NumberedList>
              </div>
              <FlowDiagram>
                <FlowRow>
                  <span>Landing Page</span>
                  <Arrow>→</Arrow>
                  <span>Onboarding Wizard</span>
                </FlowRow>
                <FlowRow>
                  <span>Account Step</span>
                  <Arrow>→</Arrow>
                  <span>Org & Plan</span>
                  <Arrow>→</Arrow>
                  <span>Dashboard</span>
                </FlowRow>
              </FlowDiagram>
            </TwoColumnLayout>
            {renderFeedback('access')}
          </CardBody>
        </Card>

        {/* Executions & Dashboards */}
        <Card id="executions">
          <CardHeader>
            <CardTitleRow>
              <CardIcon>
                <Activity size={18} />
              </CardIcon>
              <CardTitle>Executions & Dashboards</CardTitle>
            </CardTitleRow>
          </CardHeader>
          <CardBody>
            <p>
              The execution dashboard shows recent runs and high-level health. Use it to
              navigate into specific runs and to understand overall flakiness across your
              test suite.
            </p>
            
            <SubSection>
              <SubSectionTitle>Execution Status Reference</SubSectionTitle>
              <TableWrapper>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Meaning</th>
                      <th>Next Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><MetricPill $tone="success">passed</MetricPill></td>
                      <td>All steps executed successfully with no element drift</td>
                      <td>No action needed; monitor for patterns</td>
                    </tr>
                    <tr>
                      <td><MetricPill $tone="warning">failed</MetricPill></td>
                      <td>One or more steps failed; no healing possible</td>
                      <td>Review logs, update test or app code</td>
                    </tr>
                    <tr>
                      <td><MetricPill $tone="info">pending_review</MetricPill></td>
                      <td>Steps failed but AI proposed selector fixes</td>
                      <td>Open Review Queue to approve/reject changes</td>
                    </tr>
                    <tr>
                      <td><MetricPill>healed</MetricPill></td>
                      <td>Previously failed, now passing with new selectors</td>
                      <td>Verify functionality, monitor stability</td>
                    </tr>
                  </tbody>
                </DataTable>
              </TableWrapper>
            </SubSection>
            
            <TwoColumnLayout>
              <div>
                <ScreenshotPlaceholder>
                  Execution dashboard with filters and metrics illustration
                </ScreenshotPlaceholder>
                <MetricPillRow>
                  <MetricPill $tone="success">Healing success %</MetricPill>
                  <MetricPill $tone="warning">Failed steps</MetricPill>
                  <MetricPill $tone="info">Pending review items</MetricPill>
                </MetricPillRow>
              </div>
              <div>
                <SubSectionTitle>Key Metrics Explained</SubSectionTitle>
                <ul>
                  <li><strong>30-day healing success rate:</strong> Percentage of failed steps
                  where AI-proposed selectors were approved and subsequently passed</li>
                  <li><strong>Top failure patterns:</strong> Most common locator types or actions
                  causing test breaks, grouped by CSS selector, XPath, or interaction type</li>
                  <li><strong>Average execution duration:</strong> Mean runtime across all test
                  cases, useful for detecting performance regressions</li>
                  <li><strong>Element drift frequency:</strong> How often selectors need updating,
                  indicating UI volatility</li>
                </ul>
                <InfoBox $variant="tip">
                  Use filters at the top of the dashboard to slice by project, tag, or
                  timeframe. Selecting a run opens a detailed view with step-by-step
                  screenshots and any healing proposals raised for that execution.
                </InfoBox>
                <ScreenshotPlaceholder>
                  Sample data visualization
                </ScreenshotPlaceholder>
              </div>
            </TwoColumnLayout>
            {renderFeedback('executions')}
          </CardBody>
        </Card>

        {/* Runner Setup & Usage */}
        <Card id="runner">
          <CardHeader>
            <CardTitleRow>
              <CardIcon>
                <PlayCircle size={18} />
              </CardIcon>
              <CardTitle>Runner Setup & Usage</CardTitle>
            </CardTitleRow>
          </CardHeader>
          <CardBody>
            <p>
              Runners execute generated test steps in a controlled browser environment.
              Use this section to connect, validate, and operate runners safely.
            </p>

            <SubSection>
              <SubSectionTitle>What a Runner Does</SubSectionTitle>
              <ul>
                <li>Receives execution jobs from the platform</li>
                <li>Launches browser sessions and runs each step in order</li>
                <li>Streams step status, failures, and timing data back to dashboards</li>
                <li>Returns evidence used by failure analysis and review workflows</li>
              </ul>
            </SubSection>

            <TwoColumnLayout>
              <div>
                <SubSectionTitle>Runner Bring-Up Checklist</SubSectionTitle>
                <NumberedList>
                  <li>Open the Runners page from the app navigation.</li>
                  <li>Confirm the runner is online and marked healthy.</li>
                  <li>Verify the target browser profile is available.</li>
                  <li>Run a small smoke execution before full suite runs.</li>
                  <li>Review run logs for startup or environment warnings.</li>
                </NumberedList>
              </div>
              <div>
                <InfoBox $variant="tip">
                  <strong>Operational tip:</strong> keep at least one dedicated runner for
                  quick validation jobs and separate runners for heavier suites to reduce queue delays.
                </InfoBox>
                <ScreenshotPlaceholder>
                  Runners status and health overview illustration
                </ScreenshotPlaceholder>
              </div>
            </TwoColumnLayout>

            <SubSection>
              <SubSectionTitle>Common Runner Issues</SubSectionTitle>
              <TableWrapper>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Likely Cause</th>
                      <th>Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Runner offline</td>
                      <td>Service not started or connectivity interruption</td>
                      <td>Restart runner process and verify network reachability</td>
                    </tr>
                    <tr>
                      <td>Browser launch fails</td>
                      <td>Browser dependency or profile mismatch</td>
                      <td>Validate runner browser configuration and retry</td>
                    </tr>
                    <tr>
                      <td>Queue backlog</td>
                      <td>Insufficient runner capacity for active workload</td>
                      <td>Add runner capacity or stagger high-volume jobs</td>
                    </tr>
                    <tr>
                      <td>Intermittent step timeouts</td>
                      <td>Environment latency or unstable app state</td>
                      <td>Increase step timeout policy and check app-side performance</td>
                    </tr>
                  </tbody>
                </DataTable>
              </TableWrapper>
            </SubSection>

            {renderFeedback('runner')}
          </CardBody>
        </Card>

        {/* Element Review & Self-Healing */}
        <Card id="self-healing">
          <CardHeader>
            <CardTitleRow>
              <CardIcon>
                <Settings size={18} />
              </CardIcon>
              <CardTitle>Element Review & Self-Healing</CardTitle>
            </CardTitleRow>
          </CardHeader>
          <CardBody>
            <TwoColumnLayout>
              <div>
                <p>
                  When locators drift, the system can propose new selectors using collected
                  element context. You review those proposals before they become the new
                  source of truth.
                </p>
                <p>
                  Each proposal bundles together the failing selector, the candidate
                  replacement, and evidence like text content, attributes, and DOM position
                  so you can decide whether the suggestion is safe.
                </p>
                
                <SubSection>
                  <SubSectionTitle>How Self-Healing Works</SubSectionTitle>
                  <NumberedList>
                    <li><strong>Detection:</strong> Selenium fails to find element with original selector</li>
                    <li><strong>Analysis:</strong> MCP server inspects page context, extracts element attributes,
                    text, position, and adjacent elements</li>
                    <li><strong>Generation:</strong> AI proposes alternative selectors (CSS, XPath, text-based)
                    ranked by stability and specificity</li>
                    <li><strong>Validation:</strong> System tests candidate selectors against current page state</li>
                    <li><strong>Review:</strong> Human approves or rejects via Review Queue UI</li>
                    <li><strong>Application:</strong> Approved selector updates test plan for future runs</li>
                  </NumberedList>
                </SubSection>
                
                <SubSection>
                  <SubSectionTitle>Selector Strategy Comparison</SubSectionTitle>
                  <TableWrapper>
                    <DataTable>
                      <thead>
                        <tr>
                          <th>Strategy</th>
                          <th>Pros</th>
                          <th>Cons</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>ID</td>
                          <td>Fast, unique</td>
                          <td>Fragile if IDs change</td>
                        </tr>
                        <tr>
                          <td>CSS Class</td>
                          <td>Readable, reusable</td>
                          <td>May match multiple elements</td>
                        </tr>
                        <tr>
                          <td>XPath</td>
                          <td>Powerful traversal</td>
                          <td>Verbose, breaks with structure changes</td>
                        </tr>
                        <tr>
                          <td>Text Content</td>
                          <td>User-centric, robust</td>
                          <td>Fails with i18n or dynamic text</td>
                        </tr>
                        <tr>
                          <td>data-testid</td>
                          <td>Explicit, stable</td>
                          <td>Requires developer cooperation</td>
                        </tr>
                      </tbody>
                    </DataTable>
                  </TableWrapper>
                </SubSection>
                
                <FlowDiagram>
                  <FlowRow>
                    <span>Test run fails</span>
                    <Arrow>→</Arrow>
                    <span>Element analysis</span>
                    <Arrow>→</Arrow>
                    <span>Healing proposal</span>
                    <Arrow>→</Arrow>
                    <span>Human review</span>
                    <Arrow>→</Arrow>
                    <span>Approved selector</span>
                  </FlowRow>
                </FlowDiagram>
              </div>
              <div>
                <ScreenshotPlaceholder>
                  Before/after selector example
                </ScreenshotPlaceholder>
              </div>
            </TwoColumnLayout>
            {renderFeedback('self-healing')}
          </CardBody>
        </Card>

        {/* Policies & Safety Controls */}
        <Card id="policies">
          <CardHeader>
            <CardTitleRow>
              <CardIcon>
                <Shield size={18} />
              </CardIcon>
              <CardTitle>Policies & Safety Controls</CardTitle>
            </CardTitleRow>
          </CardHeader>
          <CardBody>
            <TwoColumnLayout>
              <div>
                <p>
                  Policies decide how much autonomy self-healing is allowed. You can
                  configure thresholds, allowed actions, and review requirements.
                </p>
                
                <SubSection>
                  <SubSectionTitle>Policy Decision Matrix</SubSectionTitle>
                  <TableWrapper>
                    <DataTable>
                      <thead>
                        <tr>
                          <th>Flow Type</th>
                          <th>Risk Level</th>
                          <th>Recommended Policy</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Public landing pages</td>
                          <td><MetricPill>Low</MetricPill></td>
                          <td>Auto-heal with logging</td>
                        </tr>
                        <tr>
                          <td>User profile, settings</td>
                          <td><MetricPill $tone="info">Medium</MetricPill></td>
                          <td>Require approval for data fields</td>
                        </tr>
                        <tr>
                          <td>Checkout, payments</td>
                          <td><MetricPill $tone="warning">High</MetricPill></td>
                          <td>Always require human review</td>
                        </tr>
                        <tr>
                          <td>Admin destructive actions</td>
                          <td><MetricPill $tone="warning">Critical</MetricPill></td>
                          <td>Disable auto-healing entirely</td>
                        </tr>
                      </tbody>
                    </DataTable>
                  </TableWrapper>
                </SubSection>
                
                <FlowDiagram>
                  <p style={{ marginBottom: 4 }}><strong>Configuration Best Practices:</strong></p>
                  <ul>
                    <li>
                      Start conservative: require review on high-risk flows such as
                      checkout, billing, or destructive actions.
                    </li>
                    <li>
                      Relax policies only for low-risk UI changes like labels or layout
                      shifts on non-critical pages.
                    </li>
                    <li>
                      Keep an audit trail: always prefer policies that log why a selector
                      changed and who approved it.
                    </li>
                    <li>
                      Set confidence thresholds: only auto-heal if AI confidence score exceeds
                      85% and element uniqueness is verified.
                    </li>
                  </ul>
                </FlowDiagram>
                
                <InfoBox $variant="warning">
                  <strong>Important:</strong> Policies are evaluated at runtime. If you change
                  a policy, it affects all new healing proposals immediately but does not
                  retroactively modify already-approved decisions.
                </InfoBox>
              </div>
              <div>
                <ScreenshotPlaceholder>
                  Policy configuration overview
                </ScreenshotPlaceholder>
              </div>
            </TwoColumnLayout>
            {renderFeedback('policies')}
          </CardBody>
        </Card>

        {/* Prompt Generation */}
        <Card id="prompts">
          <CardHeader>
            <CardTitleRow>
              <CardIcon>
                <BookOpen size={18} />
              </CardIcon>
              <CardTitle>Prompt Generation</CardTitle>
            </CardTitleRow>
          </CardHeader>
          <CardBody>
            <TwoColumnLayout>
              <div>
                <p>
                  This UI talks to a planning API that turns natural language
                  into executable test plans. The quality of those plans depends
                  heavily on how you phrase your prompt.
                </p>
                <FlowDiagram>
                  <p style={{ marginBottom: 4, fontWeight: 600 }}>Structure of a strong prompt</p>
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    <li><strong>Context</strong>: which app area, environment, and user role.</li>
                    <li><strong>Goal</strong>: what behavior or path you want validated.</li>
                    <li><strong>Constraints</strong>: data, safety, or policy limits.</li>
                    <li><strong>Output</strong>: level of detail (short plan vs. full steps).</li>
                  </ul>
                </FlowDiagram>
                <p style={{ marginTop: 10 }}>Aim for one focused task per prompt. If you need
                  onboarding, dashboards, and policies tested, send separate prompts so
                  each plan stays readable and safe to review.</p>
              </div>
              <div>
                <p style={{ fontWeight: 600, marginBottom: 6 }}>Good vs. bad prompts</p>
                <PromptExampleGrid>
                  <PromptExampleCard>
                    <PromptExampleLabel $tone="bad">Weak prompt</PromptExampleLabel>
                    <CodeContainer>
                      <CodeBlockInner>
{`Test everything in the app
and fix whatever is broken.`}
                      </CodeBlockInner>
                    </CodeContainer>
                    <p style={{ marginTop: 6 }}>
                      No page, role, or safety limits. The system cannot tell what is in
                      scope or how risky changes might be.
                    </p>
                  </PromptExampleCard>
                  <PromptExampleCard>
                    <PromptExampleLabel $tone="improved">Improved but incomplete</PromptExampleLabel>
                    <CodeContainer>
                      <CodeBlockInner>
{`Run regression tests for login
and basic navigation.`}
                      </CodeBlockInner>
                    </CodeContainer>
                    <p style={{ marginTop: 6 }}>
                      Better goal, but still missing environment, concrete checks, and what
                      must not change.
                    </p>
                  </PromptExampleCard>
                  <PromptExampleCard>
                    <PromptExampleLabel $tone="good">High-quality prompt</PromptExampleLabel>
                    <CodeContainer>
                      <CodeBlockInner>
{`Plan a test for the primary workspace environment.
- Start on /login as a standard user.
- Use an approved non-admin test account.
- Verify we land on the execution dashboard with at least one recent run.
- Do not edit policies or billing settings.
- Return 5–8 clear steps with assertions.`}
                      </CodeBlockInner>
                    </CodeContainer>
                    <p style={{ marginTop: 6 }}>
                      Explicit context, goal, constraints, and output instructions produce a
                      reviewable plan aligned with production workflows.
                    </p>
                  </PromptExampleCard>
                </PromptExampleGrid>
              </div>
            </TwoColumnLayout>
            {renderFeedback('prompts')}
          </CardBody>
        </Card>

        {/* API Reference */}
        <Card id="api">
          <CardHeader>
            <CardTitleRow>
              <CardIcon>
                <Code2 size={18} />
              </CardIcon>
              <CardTitle>API Reference</CardTitle>
            </CardTitleRow>
          </CardHeader>
          <CardBody>
            <p>
              Core endpoints for driving the self-healing workflow programmatically. These
              examples assume you are talking to a local unified API at
              <code> https://your-domain.com</code>.
            </p>
            
            <SubSection>
              <SubSectionTitle>Endpoint Reference</SubSectionTitle>
              <TableWrapper>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Endpoint</th>
                      <th>Method</th>
                      <th>Purpose</th>
                      <th>Auth Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>/api/v1/plan</td>
                      <td>POST</td>
                      <td>Generate test plan from NL prompt</td>
                      <td>Yes (Bearer token)</td>
                    </tr>
                    <tr>
                      <td>/api/v1/dashboard/executions</td>
                      <td>GET</td>
                      <td>List all executions for org</td>
                      <td>Yes</td>
                    </tr>
                    <tr>
                      <td>/api/v1/dashboard/execution/:id</td>
                      <td>GET</td>
                      <td>Fetch single execution with steps</td>
                      <td>Yes</td>
                    </tr>
                    <tr>
                      <td>/api/v1/review/queue</td>
                      <td>GET</td>
                      <td>Get pending healing decisions</td>
                      <td>Yes</td>
                    </tr>
                    <tr>
                      <td>/api/v1/review/decision/:id</td>
                      <td>POST</td>
                      <td>Approve or reject a healing proposal</td>
                      <td>Yes</td>
                    </tr>
                    <tr>
                      <td>/api/v1/policy/dashboard/config</td>
                      <td>GET</td>
                      <td>View current policy settings</td>
                      <td>Yes</td>
                    </tr>
                    <tr>
                      <td>/api/v1/policy/update</td>
                      <td>PUT</td>
                      <td>Modify healing policy thresholds</td>
                      <td>Yes (admin only)</td>
                    </tr>
                  </tbody>
                </DataTable>
              </TableWrapper>
            </SubSection>
            
            <SubSection>
              <SubSectionTitle>Example Request & Response</SubSectionTitle>
              <p>The <code>/api/v1/plan</code> endpoint expects a JSON body with a prompt field
              and returns a structured test plan with steps, assertions, and metadata:</p>
            </SubSection>
            <CodeSampleTabs
              samples={[
                {
                  id: 'curl',
                  label: 'curl',
                  code:
                    'curl -X POST https://your-domain.com/api/v1/plan \\\n+  -H "Content-Type: application/json" \\\n+  -d "{\\"prompt\\": \\\"login to the app\\\"}"',
                },
                {
                  id: 'python',
                  label: 'Python',
                  code:
                    'import requests\n\nresp = requests.post(\n    "https://your-domain.com/api/v1/plan",\n    json={"prompt": "login to the app"},\n)\nprint(resp.json())',
                },
                {
                  id: 'js',
                  label: 'JavaScript',
                  code:
                    'const resp = await fetch("https://your-domain.com/api/v1/plan", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ prompt: "login to the app" }),\n});\nconst data = await resp.json();\nconsole.log(data);',
                },
              ]}
            />
            {renderFeedback('api')}
          </CardBody>
        </Card>

        {/* FAQs */}
        <Card id="faqs">
          <CardHeader>
            <CardTitleRow>
              <CardIcon>
                <HelpCircle size={18} />
              </CardIcon>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardTitleRow>
          </CardHeader>
          <CardBody>
            {[
              'Is this a production service?',
              'Do I need real credentials or data?',
              'Can I reset environment data?',
              'How should I report issues or bugs?',
            ].map((q, idx) => (
              <AccordionItem key={q}>
                <AccordionHeader
                  type="button"
                  $open={openFaq === idx}
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                >
                  <span>{q}</span>
                  <span>{openFaq === idx ? '−' : '+'}</span>
                </AccordionHeader>
                <AccordionContent $open={openFaq === idx}>
                  {idx === 0 && (
                    <div>
                      <p>Yes. FluxTest is intended for production test operations and governed automation workflows.</p>
                      <InfoBox $variant="info">
                        <strong>Recommended practice:</strong>
                        <ul style={{ paddingLeft: 16, marginBottom: 0 }}>
                          <li>Use role-based access controls for operational safety</li>
                          <li>Apply policy thresholds before enabling broad auto-healing</li>
                          <li>Keep environment and data segmentation aligned to your governance model</li>
                          <li>Establish backup and incident response processes</li>
                        </ul>
                      </InfoBox>
                    </div>
                  )}
                  {idx === 1 && (
                    <div>
                      <p>Use controlled test accounts and least-privilege credentials for automation runs.</p>
                      <InfoBox $variant="warning">
                        <strong>Data Safety:</strong> Avoid production secrets in test steps,
                        rotate credentials regularly, and align retention policies with your
                        security and compliance requirements.
                      </InfoBox>
                    </div>
                  )}
                  {idx === 2 && (
                    <div>
                      <p>
                        If your deployment supports resets, use your approved operational
                        runbook to restore known-good state and reapply required migrations.
                      </p>
                      <CodeContainer>
                        <CodeBlockInner>
{`# Example reset flow (environment-specific)
docker-compose down -v
docker-compose up -d postgres
# Reapply baseline migrations according to your runbook`}
                        </CodeBlockInner>
                      </CodeContainer>
                    </div>
                  )}
                  {idx === 3 && (
                    <p>
                      Report issues through your standard support channel with reproduction
                      steps, timestamps, and affected run IDs so engineering can triage quickly.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
            {renderFeedback('faqs')}
          </CardBody>
        </Card>

        {/* Troubleshooting */}
        <Card id="troubleshooting">
          <CardHeader>
            <CardTitleRow>
              <CardIcon>
                <AlertTriangle size={18} />
              </CardIcon>
              <CardTitle>Troubleshooting</CardTitle>
            </CardTitleRow>
          </CardHeader>
          <CardBody>
            {[
              'I cannot reach the API',
              'Executions are empty',
              'Healing decisions never appear',
              'The UI looks different from the screenshots',
            ].map((q, idx) => (
              <AccordionItem key={q}>
                <AccordionHeader
                  type="button"
                  $open={openTrouble === idx}
                  onClick={() => setOpenTrouble(openTrouble === idx ? null : idx)}
                >
                  <span>{q}</span>
                  <span>{openTrouble === idx ? '−' : '+'}</span>
                </AccordionHeader>
                <AccordionContent $open={openTrouble === idx}>
                  {idx === 0 && (
                    <div>
                      <ul>
                        <li>Confirm Docker services are running.</li>
                        <li>Check that port 8000 is not blocked or in use.</li>
                      </ul>
                      <SubSection>
                        <SubSectionTitle>Diagnostic Commands</SubSectionTitle>
                        <CodeContainer>
                          <CodeBlockInner>
{`# Check if API container is running
docker ps | grep unified-api

# View API logs
docker logs <unified-api-container-name>

# Test API health endpoint
curl https://your-domain.com/health`}
                          </CodeBlockInner>
                        </CodeContainer>
                      </SubSection>
                    </div>
                  )}
                  {idx === 1 && (
                    <div>
                      <ul>
                        <li>Verify that sample runs have been created or triggered.</li>
                        <li>Inspect backend logs for any execution errors.</li>
                      </ul>
                      <InfoBox $variant="tip">
                        <strong>Quick fix:</strong> Run the sample data script to populate test executions:
                        <CodeContainer>
                          <CodeBlockInner>
{`psql -h localhost -U testuser -d testdb -f database-migrations/002_sample_data_functions.sql`}
                          </CodeBlockInner>
                        </CodeContainer>
                      </InfoBox>
                    </div>
                  )}
                  {idx === 2 && (
                    <div>
                      <ul>
                        <li>Ensure policies allow automatic healing in some scenarios.</li>
                        <li>Confirm that the Java runner and MCP server are communicating.</li>
                      </ul>
                      <SubSection>
                        <SubSectionTitle>Check MCP Server Connection</SubSectionTitle>
                        <CodeContainer>
                          <CodeBlockInner>
{`# Verify MCP server is running
curl https://your-domain.com:8001/health

# Check Java runner logs
tail -f services/java-runner/healing_log.json

# Test policy endpoint
curl https://your-domain.com/api/v1/policy/dashboard/config`}
                          </CodeBlockInner>
                        </CodeContainer>
                      </SubSection>
                    </div>
                  )}
                  {idx === 3 && (
                    <div>
                      <ul>
                        <li>
                          Check that you have pulled the latest frontend changes; older builds
                          may not include new documentation or layouts.
                        </li>
                        <li>
                          Clear your browser cache and hard-reload if components appear
                          misaligned or stale.
                        </li>
                      </ul>
                      <InfoBox $variant="info">
                        <strong>Frontend rebuild:</strong> If you've updated code, rebuild the React app:
                        <CodeContainer>
                          <CodeBlockInner>
{`cd services/react-frontend
npm install
npm run build
# Or use the provided script
./start-react-frontend.bat`}
                          </CodeBlockInner>
                        </CodeContainer>
                      </InfoBox>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
            {renderFeedback('troubleshooting')}
          </CardBody>
        </Card>
      </Main>
    </Layout>
  );
};

export default DocumentationPage;
