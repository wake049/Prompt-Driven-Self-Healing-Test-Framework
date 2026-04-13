import React from 'react';
import styled from 'styled-components';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import SeoMetadata from '../../../shared/ui/SeoMetadata';

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.colors.background};
`;

const Content = styled.div`
  flex: 1;
  max-width: 900px;
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

const LastUpdated = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 48px;
`;

const Section = styled.section`
  margin-bottom: 40px;
`;

const SectionTitle = styled.h2`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 16px;
`;

const SectionText = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.8;
  margin-bottom: 16px;
`;

const List = styled.ul`
  margin-left: 24px;
  margin-bottom: 16px;

  li {
    font-size: 16px;
    color: ${props => props.theme.colors.textSecondary};
    line-height: 1.8;
    margin-bottom: 8px;
  }
`;

export const CookiePolicyPage: React.FC = () => {
  return (
    <PageContainer>
      <SeoMetadata
        title="Cookie Policy"
        description="Understand how FluxTest uses cookies and browser storage for sessions, preferences, and platform functionality."
        path="/cookies"
      />
      <LandingHeader />
      <Content>
        <Title>Cookie Policy</Title>
        <LastUpdated>Last updated: February 9, 2026</LastUpdated>

        <Section>
          <SectionTitle>How We Use Cookies</SectionTitle>
          <SectionText>
            FluxTest uses limited browser storage and cookie-like mechanisms to keep the app working,
            such as maintaining your authentication session and saving temporary onboarding state.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Types of Data Stored</SectionTitle>
          <List>
            <li>Authentication token/session data</li>
            <li>Basic UI preferences</li>
            <li>Temporary onboarding progress</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>Third-Party Cookies</SectionTitle>
          <SectionText>
            FluxTest does not intentionally use ad-tracking cookies. Some third-party services
            used by your browser or infrastructure may still set their own cookies independently.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Managing Cookies</SectionTitle>
          <SectionText>
            You can clear cookies and site data from your browser at any time. Doing so may sign you
            out and reset saved app preferences.
          </SectionText>
        </Section>
      </Content>
      <LandingFooter />
    </PageContainer>
  );
};
