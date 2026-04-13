import React from 'react';
import styled from 'styled-components';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import { Mail, MessageSquare, BookOpen } from 'lucide-react';
import SeoMetadata from '../../../shared/ui/SeoMetadata';

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
  margin-bottom: 24px;
  
  @media (max-width: 768px) {
    font-size: 36px;
  }
`;

const Subtitle = styled.p`
  font-size: 20px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  margin-bottom: 48px;
`;

const ContactGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 32px;
  margin-top: 48px;
`;

const ContactCard = styled.div`
  padding: 32px;
  border-radius: 16px;
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
`;

const IconWrapper = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: ${props => props.theme.colors.primary}11;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: ${props => props.theme.colors.primary};
`;

const ContactTitle = styled.h3`
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 12px;
`;

const ContactText = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  margin-bottom: 16px;
`;

const ContactLink = styled.a`
  display: inline-block;
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.primary};
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

export const ContactPage: React.FC = () => {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@fluxtest.io';

  return (
    <PageContainer>
      <SeoMetadata
        title="Contact FluxTest"
        description="Contact the FluxTest team for product questions, support coordination, documentation help, and production rollout planning."
        path="/contact"
      />
      <LandingHeader />
      <Content>
        <Title>Get in Touch</Title>
        <Subtitle>
          Have questions about FluxTest? We’re here to help.
        </Subtitle>

        <ContactGrid>
          <ContactCard>
            <IconWrapper>
              <Mail size={28} />
            </IconWrapper>
            <ContactTitle>Email</ContactTitle>
            <ContactText>
              For general inquiries, feedback, or questions about the project.
            </ContactText>
            <ContactLink href={`mailto:${supportEmail}`}>
              {supportEmail}
            </ContactLink>
          </ContactCard>

          <ContactCard>
            <IconWrapper>
              <BookOpen size={28} />
            </IconWrapper>
            <ContactTitle>Product Updates</ContactTitle>
            <ContactText>
              Follow product updates, release notes, and platform roadmap changes.
            </ContactText>
            <ContactLink href="/changelog">
              View Changelog
            </ContactLink>
          </ContactCard>

          <ContactCard>
            <IconWrapper>
              <MessageSquare size={28} />
            </IconWrapper>
            <ContactTitle>Documentation</ContactTitle>
            <ContactText>
              Check out our comprehensive documentation for setup and usage guides.
            </ContactText>
            <ContactLink href="/docs">
              View Documentation
            </ContactLink>
          </ContactCard>
        </ContactGrid>
      </Content>
      <LandingFooter />
    </PageContainer>
  );
};
