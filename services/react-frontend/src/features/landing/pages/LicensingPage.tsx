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

export const LicensingPage: React.FC = () => {
  return (
    <PageContainer>
      <SeoMetadata
        title="Licensing Agreement"
        description="Review FluxTest licensing terms, subscription scope, deployment rights, and usage boundaries."
        path="/licensing"
      />
      <LandingHeader />
      <Content>
        <Title>Licensing Agreement</Title>
        <LastUpdated>Last updated: March 4, 2026</LastUpdated>

        <Section>
          <SectionTitle>License Grant</SectionTitle>
          <SectionText>
            Subject to your active subscription and compliance with this agreement, FluxTest grants
            you a limited, non-exclusive, non-transferable, revocable license to use the software
            and related documentation for internal business testing operations.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Deployment Scope</SectionTitle>
          <SectionText>
            Your license scope depends on your subscription plan.
          </SectionText>
          <List>
            <li>Hosted plans are licensed for use in the managed FluxTest environment.</li>
            <li>Self-hosted deployment options are available only under plans that explicitly include them.</li>
            <li>Self-hosted customers are responsible for infrastructure, backups, patching, and access controls.</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>Restrictions</SectionTitle>
          <SectionText>
            You may not resell, sublicense, distribute, or make FluxTest available as a standalone service
            to third parties without a separate written commercial agreement.
          </SectionText>
          <List>
            <li>No reverse engineering except where required by applicable law.</li>
            <li>No removal of proprietary notices.</li>
            <li>No use beyond purchased limits or contracted scope.</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>Usage Limits and Compliance</SectionTitle>
          <SectionText>
            Usage limits, feature entitlements, and support levels are controlled by your subscription plan
            and any written order form. You are responsible for ensuring your usage complies with contractual terms.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Termination</SectionTitle>
          <SectionText>
            This license remains in effect while your subscription is active unless terminated earlier for breach.
            On termination, you must stop using the software and remove active deployments unless otherwise agreed in writing.
          </SectionText>
        </Section>

        <Section>
          <SectionTitle>Contact</SectionTitle>
          <SectionText>
            For licensing questions or custom enterprise terms, contact support@fluxtest.io.
          </SectionText>
        </Section>
      </Content>
      <LandingFooter />
    </PageContainer>
  );
};
