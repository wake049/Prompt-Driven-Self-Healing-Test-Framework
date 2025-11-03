import React from 'react';
import styled from 'styled-components';
import { Edit, X, Calendar, Globe, Target, FileText, Image as ImageIcon } from 'lucide-react';
// ================================
// Styled Components (matching existing app patterns)
// ================================
const Container = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  overflow: hidden;
  backdrop-filter: blur(10px);
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    background: #2a2a2a;
    border-color: #404040;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  }
`;
const Header = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
  }
  > * {
    position: relative;
    z-index: 1;
  }
`;
const HeaderContent = styled.div`
  flex: 1;
`;
const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;
const Title = styled.h1`
  margin: 0;
  color: white;
  font-size: 1.75rem;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;
const TypeBadge = styled.span<{ pageType: string }>`
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
`;
const MetadataRow = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.9);
`;
const MetadataItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;
const MetadataLink = styled.a`
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  &:hover {
    color: white;
    text-decoration: underline;
  }
`;
const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
`;
const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  ${props => {
    if (props.variant === 'primary') {
      return `
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        &:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }
      `;
    }
    return `
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.2);
      &:hover {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      }
    `;
  }}
`;
const CloseButton = styled.button`
  padding: 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }
`;
const Content = styled.div`
  padding: 24px;
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    background: #2a2a2a;
    color: #ffffff;
  }
`;
const Section = styled.div`
  margin-bottom: 32px;
  &:last-child {
    margin-bottom: 0;
  }
`;
const SectionTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 1.2rem;
  font-weight: 600;
  &::after {
    content: '';
    flex: 1;
    height: 2px;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
    margin-left: 16px;
    border-radius: 1px;
  }
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    color: #ffffff;
  }
`;
const SectionDescription = styled.p`
  color: #495057;
  line-height: 1.6;
  margin: 0;
  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    color: #aaa;
  }
`;
const ScreenshotContainer = styled.div`
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  overflow: hidden;
  background: #f8f9fa;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  &:hover {
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
`;
const ScreenshotImage = styled.img`
  width: 100%;
  max-height: 400px;
  object-fit: contain;
  background: #f8f9fa;
`;
const ActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
`;
const ActionItem = styled.div`
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-radius: 12px;
  border: 1px solid rgba(102, 126, 234, 0.2);
  transition: all 0.3s ease;
  &:hover {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
  }
`;
const ActionDot = styled.div`
  width: 10px;
  height: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
`;
const ActionText = styled.span`
  color: #495057;
  font-weight: 500;
`;
const FocusBox = styled.div`
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 12px;
  padding: 20px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
`;
const FocusText = styled.p`
  color: #4c63d2;
  margin: 0;
  line-height: 1.5;
  font-weight: 500;
`;
const NotesBox = styled.div`
  background: linear-gradient(135deg, rgba(248, 249, 250, 0.8) 0%, rgba(233, 236, 239, 0.8) 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  padding: 20px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
`;
const NotesText = styled.p`
  color: #495057;
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.5;
`;
const MetadataSection = styled.div`
  border-top: 2px solid;
  border-image: linear-gradient(90deg, #667eea 0%, #764ba2 100%) 1;
  padding-top: 24px;
  margin-top: 32px;
`;
const MetadataGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  font-size: 0.9rem;
`;
const MetadataField = styled.div``;
const MetadataLabel = styled.span`
  font-weight: 600;
  color: #495057;
  display: block;
  margin-bottom: 4px;
`;
const MetadataValue = styled.p`
  color: #6c757d;
  margin: 0;
`;
// ================================
// Types
// ================================
interface PageContextItem {
  id: string;
  pageUrl: string;
  pageTitle: string;
  pageType: string;
  pageDescription: string;
  screenshotUrl?: string;
  primaryActions: string[];
  testingFocus?: string;
  userNotes?: string;
  createdAt: string;
  createdBy?: string;
  usageCount: number;
}
interface PageContextViewProps {
  context: PageContextItem;
  onEdit: () => void;
  onClose: () => void;
}
// ================================
// Component
// ================================
export const PageContextView: React.FC<PageContextViewProps> = ({
  context,
  onEdit,
  onClose
}) => {
  const pageTypeLabels: Record<string, string> = {
    ecommerce: 'E-commerce',
    airline: 'Airlines',
    banking: 'Banking',
    form: 'Forms',
    news: 'News',
    social: 'Social Media',
    search: 'Search',
    streaming: 'Streaming',
    other: 'Other',
  };
  return (
    <Container>
      {/* Header */}
      <Header>
        <HeaderContent>
          <TitleRow>
            <Title>{context.pageTitle}</Title>
            <TypeBadge pageType={context.pageType}>
              {pageTypeLabels[context.pageType] || 'Other'}
            </TypeBadge>
          </TitleRow>
          <MetadataRow>
            <MetadataItem>
              <Globe size={16} />
              <MetadataLink
                href={context.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {context.pageUrl}
              </MetadataLink>
            </MetadataItem>
            <MetadataItem>
              <Calendar size={16} />
              {new Date(context.createdAt).toLocaleDateString()}
            </MetadataItem>
            <MetadataItem>
              Used {context.usageCount} times
            </MetadataItem>
          </MetadataRow>
        </HeaderContent>
        <HeaderActions>
          <ActionButton variant="primary" onClick={onEdit}>
            <Edit size={16} />
            Edit
          </ActionButton>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </HeaderActions>
      </Header>
      {/* Content */}
      <Content>
        {/* Screenshot */}
        {context.screenshotUrl && (
          <Section>
            <SectionTitle>
              <ImageIcon size={20} />
              Screenshot
            </SectionTitle>
            <ScreenshotContainer>
              <ScreenshotImage
                src={context.screenshotUrl}
                alt={context.pageTitle}
              />
            </ScreenshotContainer>
          </Section>
        )}
        {/* Description */}
        <Section>
          <SectionTitle>
            <FileText size={20} />
            Description
          </SectionTitle>
          <SectionDescription>
            {context.pageDescription}
          </SectionDescription>
        </Section>
        {/* Primary Actions */}
        {context.primaryActions.length > 0 && (
          <Section>
            <SectionTitle>
              <Target size={20} />
              Primary Actions
            </SectionTitle>
            <ActionsGrid>
              {context.primaryActions.map((action, index) => (
                <ActionItem key={index}>
                  <ActionDot />
                  <ActionText>{action}</ActionText>
                </ActionItem>
              ))}
            </ActionsGrid>
          </Section>
        )}
        {/* Testing Focus */}
        {context.testingFocus && (
          <Section>
            <SectionTitle>
              Testing Focus
            </SectionTitle>
            <FocusBox>
              <FocusText>{context.testingFocus}</FocusText>
            </FocusBox>
          </Section>
        )}
        {/* User Notes */}
        {context.userNotes && (
          <Section>
            <SectionTitle>
              Additional Notes
            </SectionTitle>
            <NotesBox>
              <NotesText>{context.userNotes}</NotesText>
            </NotesBox>
          </Section>
        )}
        {/* Metadata */}
        <MetadataSection>
          <SectionTitle>
            Context Information
          </SectionTitle>
          <MetadataGrid>
            <MetadataField>
              <MetadataLabel>Created:</MetadataLabel>
              <MetadataValue>
                {new Date(context.createdAt).toLocaleString()}
              </MetadataValue>
            </MetadataField>
            {context.createdBy && (
              <MetadataField>
                <MetadataLabel>Created by:</MetadataLabel>
                <MetadataValue>{context.createdBy}</MetadataValue>
              </MetadataField>
            )}
            <MetadataField>
              <MetadataLabel>Usage:</MetadataLabel>
              <MetadataValue>
                Used {context.usageCount} time{context.usageCount !== 1 ? 's' : ''}
              </MetadataValue>
            </MetadataField>
          </MetadataGrid>
        </MetadataSection>
      </Content>
    </Container>
  );
};