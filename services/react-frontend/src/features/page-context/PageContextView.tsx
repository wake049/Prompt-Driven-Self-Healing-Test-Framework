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
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  overflow: hidden;
`;

const Header = styled.div`
  background: #f8f9fa;
  padding: 24px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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
  color: #2c3e50;
  font-size: 1.75rem;
  font-weight: 600;
`;

const TypeBadge = styled.span<{ pageType: string }>`
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 600;
  background: ${props => {
    const colors: Record<string, string> = {
      ecommerce: '#d4edda',
      airline: '#d1ecf1',
      banking: '#fff3cd',
      form: '#e2e3ff',
      news: '#f8d7da',
      social: '#fce4ec',
      search: '#f8f9fa',
      streaming: '#e1f5fe',
      other: '#f8f9fa'
    };
    return colors[props.pageType] || colors.other;
  }};
  color: ${props => {
    const colors: Record<string, string> = {
      ecommerce: '#155724',
      airline: '#0c5460',
      banking: '#856404',
      form: '#3e4094',
      news: '#721c24',
      social: '#880e4f',
      search: '#6c757d',
      streaming: '#01579b',
      other: '#6c757d'
    };
    return colors[props.pageType] || colors.other;
  }};
`;

const MetadataRow = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 0.9rem;
  color: #6c757d;
`;

const MetadataItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MetadataLink = styled.a`
  color: #007bff;
  text-decoration: none;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  &:hover {
    color: #0056b3;
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
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => {
    if (props.variant === 'primary') {
      return `
        background: #007bff;
        color: white;
        &:hover { background: #0056b3; }
      `;
    }
    return `
      background: white;
      color: #6c757d;
      border: 1px solid #dee2e6;
      &:hover {
        background: #f8f9fa;
        color: #495057;
      }
    `;
  }}
`;

const CloseButton = styled.button`
  padding: 8px;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  border-radius: 4px;
  
  &:hover {
    background: #f8f9fa;
    color: #495057;
  }
`;

const Content = styled.div`
  padding: 24px;
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
`;

const SectionDescription = styled.p`
  color: #495057;
  line-height: 1.6;
  margin: 0;
`;

const ScreenshotContainer = styled.div`
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
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
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
`;

const ActionDot = styled.div`
  width: 8px;
  height: 8px;
  background: #007bff;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
`;

const ActionText = styled.span`
  color: #495057;
  font-weight: 500;
`;

const FocusBox = styled.div`
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 8px;
  padding: 16px;
`;

const FocusText = styled.p`
  color: #1565c0;
  margin: 0;
  line-height: 1.5;
`;

const NotesBox = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
`;

const NotesText = styled.p`
  color: #495057;
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.5;
`;

const MetadataSection = styled.div`
  border-top: 1px solid #e9ecef;
  padding-top: 24px;
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