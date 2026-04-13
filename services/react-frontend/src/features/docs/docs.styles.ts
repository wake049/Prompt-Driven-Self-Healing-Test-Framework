import styled from 'styled-components';

// ── Outer shell ──────────────────────────────────────────────────────────────

export const Layout = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: ${props => props.theme.colors.background};
`;

export const Sidebar = styled.aside`
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

export const SidebarTitle = styled.h2`
  font-size: 18px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 16px 0;
`;

export const NavList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

export const NavItem = styled.li`
  margin-bottom: 6px;
`;

export const NavIconWrapper = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const Main = styled.main`
  flex: 1;
  padding: 0 40px 64px;
  overflow-y: auto;
  height: 100%;

  @media (max-width: 960px) {
    padding: 0 16px 40px;
  }
`;

// ── Header ────────────────────────────────────────────────────────────────────

export const HeaderContainer = styled.div`
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

export const Breadcrumbs = styled.nav`
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

export const PageTitleRow = styled.div`
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

export const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0;
`;

export const SearchBar = styled.div`
  position: relative;
  max-width: 320px;
  width: 100%;
`;

export const SearchInput = styled.input`
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

export const SearchIconWrapper = styled.div`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: ${props => props.theme.colors.textSecondary};
`;

export const HeaderSubtitle = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0 0 24px 0;
  max-width: 720px;
`;

export const MobileSectionNav = styled.div`
  display: none;

  @media (max-width: 960px) {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }
`;

export const MobileSectionButton = styled.button<{ $active?: boolean }>`
  border: 1px solid ${props => (props.$active ? props.theme.colors.primary : props.theme.colors.border)};
  background: ${props => (props.$active ? props.theme.colors.primary + '11' : props.theme.colors.surface)};
  color: ${props => props.theme.colors.text};
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
`;

// ── Content layout ────────────────────────────────────────────────────────────

export const TwoColumnLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1.1fr);
  gap: 24px;
  margin-bottom: 32px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

export const Card = styled.section`
  border-radius: 16px;
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  padding: 20px 20px 16px;
  margin-bottom: 24px;
`;

export const CardHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
`;

export const CardTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

export const CardIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.theme.colors.primary}11;
  color: ${props => props.theme.colors.primary};
`;

export const CardTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0;
`;

export const CardMeta = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
`;

export const CardBody = styled.div`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
`;

// ── Content primitives ────────────────────────────────────────────────────────

export const NumberedList = styled.ol`
  padding-left: 20px;
  margin: 8px 0 12px;

  li {
    margin-bottom: 6px;
  }
`;

export const ScreenshotPlaceholder = styled.div`
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

export const FlowDiagram = styled.div`
  border-radius: 12px;
  padding: 12px 14px;
  background: linear-gradient(135deg, ${props => props.theme.colors.background} 0%, ${props => props.theme.colors.surface} 100%);
  border: 1px solid ${props => props.theme.colors.border};
  font-size: 12px;
`;

export const FlowRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;

  &:last-child {
    margin-bottom: 0;
  }
`;

export const Arrow = styled.span`
  color: ${props => props.theme.colors.textSecondary};
`;

export const MetricPillRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

export const MetricPill = styled.span<{ $tone?: 'success' | 'warning' | 'info' }>`
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

// ── Accordion ─────────────────────────────────────────────────────────────────

export const AccordionItem = styled.div`
  border-radius: 10px;
  border: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface};
  margin-bottom: 8px;
  overflow: hidden;
`;

export const AccordionHeader = styled.button<{ $open?: boolean }>`
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

export const AccordionContent = styled.div<{ $open?: boolean }>`
  max-height: ${props => (props.$open ? '400px' : '0')};
  overflow: hidden;
  transition: max-height 0.2s ease;
  padding: ${props => (props.$open ? '0 12px 10px' : '0 12px 0')};
  font-size: 13px;
  color: ${props => props.theme.colors.textSecondary};
`;

// ── Code ──────────────────────────────────────────────────────────────────────

export const TabsHeader = styled.div`
  display: inline-flex;
  padding: 3px;
  background: ${props => props.theme.colors.background};
  border-radius: 999px;
  border: 1px solid ${props => props.theme.colors.border};
  margin-bottom: 8px;
`;

export const TabButton = styled.button<{ $active?: boolean }>`
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

export const CodeContainer = styled.pre`
  position: relative;
  background: #020617;
  color: #e5e7eb;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 12px;
  overflow-x: auto;
  margin: 0;
`;

export const CodeBlockInner = styled.code`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
`;

export const CopyButton = styled.button`
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

// ── Prompt examples ───────────────────────────────────────────────────────────

export const PromptExampleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 12px;
`;

export const PromptExampleCard = styled.div`
  border-radius: 10px;
  border: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.background};
  padding: 8px 10px;
  font-size: 12px;
`;

export const PromptExampleLabel = styled.div<{ $tone?: 'good' | 'bad' | 'improved' }>`
  font-weight: 600;
  margin-bottom: 4px;
  color: ${props =>
    props.$tone === 'good'
      ? props.theme.colors.success
      : props.$tone === 'bad'
      ? props.theme.colors.warning || '#b91c1c'
      : props.theme.colors.primary};
`;

// ── Sub-sections ──────────────────────────────────────────────────────────────

export const SubSection = styled.div`
  margin-top: 16px;
  padding: 12px;
  border-left: 3px solid ${props => props.theme.colors.primary};
  background: ${props => props.theme.colors.surfaceLight || props.theme.colors.surface};
  border-radius: 8px;
`;

export const SubSectionTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 8px 0;
`;

export const InfoBox = styled.div<{ $variant?: 'info' | 'warning' | 'success' | 'tip' }>`
  padding: 10px 12px;
  border-radius: 8px;
  margin: 10px 0;
  border-left: 3px solid ${props => {
    switch (props.$variant) {
      case 'warning': return props.theme.colors.warning || '#f59e0b';
      case 'success': return props.theme.colors.success;
      case 'tip': return '#8b5cf6';
      default: return props.theme.colors.primary;
    }
  }};
  background: ${props => {
    switch (props.$variant) {
      case 'warning': return '#f59e0b11';
      case 'success': return props.theme.colors.success + '11';
      case 'tip': return '#8b5cf611';
      default: return props.theme.colors.primary + '11';
    }
  }};
  font-size: 13px;
  line-height: 1.5;
`;

export const TableWrapper = styled.div`
  overflow-x: auto;
  margin: 12px 0;
`;

export const DataTable = styled.table`
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

export const StepBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${props => props.theme.colors.primary};
  color: white;
  font-size: 11px;
  font-weight: 600;
  margin-right: 6px;
`;

// ── Feedback ──────────────────────────────────────────────────────────────────

export const FeedbackRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid ${props => props.theme.colors.border};
  font-size: 12px;
`;

export const FeedbackButtons = styled.div`
  display: flex;
  gap: 6px;
`;

export const FeedbackButton = styled.button<{ $active?: boolean }>`
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

// ── Related links ─────────────────────────────────────────────────────────────

export const RelatedRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
`;

export const RelatedLink = styled.button`
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

export const VideoPlaceholder = styled.div`
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

export const DownloadLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
`;

export const DownloadButton = styled.a`
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
