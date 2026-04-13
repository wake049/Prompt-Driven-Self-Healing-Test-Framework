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

export const TermsPage: React.FC = () => {
  return (
    <PageContainer>
      <SeoMetadata
        title="Terms of Service"
        description="Review the FluxTest terms of service, platform usage conditions, restrictions, and service obligations."
        path="/terms"
      />
      <LandingHeader />
      <Content>
        <Title>Terms of Service</Title>
        <LastUpdated>Last updated: February 9, 2026</LastUpdated>

        <Section>
          <SectionTitle>Acceptance of Terms</SectionTitle>
          <SectionText>
            By accessing and using FluxTest, you agree to be bound by these Terms of Service.
            These terms govern your use of the FluxTest production platform and services.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Use Restrictions</SectionTitle>
          <SectionText>
            You agree not to:
          </SectionText>
          <List>
            <li>Enter real credentials, passwords, or sensitive data</li>
            <li>Attempt to exploit, disrupt, or damage the service</li>
            <li>Use the service for any unlawful purpose</li>
            <li>Distribute or share access credentials</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>No Warranties</SectionTitle>
          <SectionText>
            FluxTest is provided without any warranties of any kind, either express or implied.
            We do not guarantee:
          </SectionText>
          <List>
            <li>Availability or uptime</li>
            <li>Data persistence or backups</li>
            <li>Accuracy of AI-generated test plans or healing suggestions</li>
            <li>Security of data stored in the system</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>Limitation of Liability</SectionTitle>
          <SectionText>
            In no event shall FluxTest or its creators be liable for any damages arising from
            use or inability to use the service, including but not limited to direct, indirect,
            incidental, or consequential damages.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Modifications</SectionTitle>
          <SectionText>
            We reserve the right to modify or discontinue the service at any time without notice.
            We may also update these terms at our discretion.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Termination</SectionTitle>
          <SectionText>
            We reserve the right to terminate or suspend access to the service at any time,
            for any reason, without notice.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Contact</SectionTitle>
          <SectionText>
            Questions about these terms? Contact support@fluxtest.io
          </SectionText>
        </Section>
      </Content>
      <LandingFooter />
    </PageContainer>
  );
};
