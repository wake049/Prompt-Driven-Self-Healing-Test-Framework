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

export const PrivacyPage: React.FC = () => {
  return (
    <PageContainer>
      <SeoMetadata
        title="Privacy Policy"
        description="Read the FluxTest privacy policy covering data collection, usage, storage, and platform privacy practices."
        path="/privacy"
      />
      <LandingHeader />
      <Content>
        <Title>Privacy Policy</Title>
        <LastUpdated>Last updated: February 9, 2026</LastUpdated>

        <Section>
          <SectionTitle>Overview</SectionTitle>
          <SectionText>
            This privacy policy describes how FluxTest collects, uses, and protects data
            across our production platform and related services.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Information We Collect</SectionTitle>
          <SectionText>
            When you create an account or use FluxTest, we may collect:
          </SectionText>
          <List>
            <li>Email address and name (for account creation)</li>
            <li>Test execution data and results</li>
            <li>Element healing proposals and review decisions</li>
            <li>Usage logs and system interactions</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>How We Use Your Information</SectionTitle>
          <SectionText>
            Data collected is used solely for:
          </SectionText>
          <List>
            <li>Operating and improving self-healing test automation workflows</li>
            <li>Displaying execution history and healing decisions</li>
            <li>Authenticating users and securing account access</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>Data Security</SectionTitle>
          <SectionText>
            We implement layered security controls including authentication, role-based access,
            transport security, and operational monitoring to protect customer data.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Data Retention</SectionTitle>
          <SectionText>
            Data is retained according to operational, legal, and account lifecycle requirements.
            Retention windows may vary by data type and subscription plan.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Contact</SectionTitle>
          <SectionText>
            For questions about this privacy policy, contact support@fluxtest.io
          </SectionText>
        </Section>
      </Content>
      <LandingFooter />
    </PageContainer>
  );
};
