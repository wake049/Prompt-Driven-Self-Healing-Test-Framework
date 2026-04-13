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

const Section = styled.section`
  margin-bottom: 48px;
`;

const SectionCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  padding: 24px;
`;

const SectionTitle = styled.h2`
  font-size: 32px;
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

const FeatureList = styled.ul`
  margin: 12px 0 0;
  padding-left: 20px;

  li {
    font-size: 15px;
    color: ${props => props.theme.colors.textSecondary};
    line-height: 1.7;
    margin-bottom: 8px;
  }
`;

const PillGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.textSecondary};
  font-size: 13px;
  font-weight: 500;
`;

export const AboutPage: React.FC = () => {
  return (
    <PageContainer>
      <SeoMetadata
        title="About FluxTest"
        description="Learn how FluxTest approaches AI-assisted test generation, self-healing automation, and governance-focused reliability workflows."
        path="/about"
      />
      <LandingHeader />
      <Content>
        <Title>About FluxTest</Title>
        <Subtitle>
          AI-powered test automation built for reliability, governance, and enterprise scale.
        </Subtitle>

        <Section>
          <SectionCard>
            <SectionTitle>Our Mission</SectionTitle>
            <SectionText>
              FluxTest helps teams ship faster with confidence by reducing flaky tests,
              minimizing selector maintenance, and making test failures easier to understand.
            </SectionText>
            <SectionText>
              We combine AI planning, policy controls, and self-healing execution so test
              automation can scale without becoming a reliability bottleneck.
            </SectionText>
          </SectionCard>
        </Section>

        <Section>
          <SectionCard>
            <SectionTitle>What The Platform Provides</SectionTitle>
            <SectionText>
              FluxTest combines AI-assisted planning with resilient test execution
              workflows designed for production teams.
            </SectionText>
            <FeatureList>
              <li>Natural language prompt-to-test generation</li>
              <li>Self-healing selector proposals with review controls</li>
              <li>Policy-governed execution safety and approvals</li>
              <li>Failure analysis with AI-driven root-cause insights</li>
              <li>Execution analytics across runs, trends, and outcomes</li>
            </FeatureList>
          </SectionCard>
        </Section>

        <Section>
          <SectionCard>
            <SectionTitle>Platform Architecture</SectionTitle>
            <SectionText>
              FluxTest is built as a modular platform with isolated services for user-facing
              experiences, secure execution, data operations, and AI-assisted analysis.
              This architecture supports reliability, tenant separation, and controlled scaling.
            </SectionText>
            <PillGrid>
              <Pill>Modular Service Design</Pill>
              <Pill>Secure API Layer</Pill>
              <Pill>Isolated Execution Runtime</Pill>
              <Pill>Controlled Data Access</Pill>
              <Pill>Policy-Governed AI Assistance</Pill>
            </PillGrid>
          </SectionCard>
        </Section>

        <Section>
          <SectionCard>
            <SectionTitle>Platform Commitment</SectionTitle>
            <SectionText>
              We continuously invest in security, observability, and operational resilience
              to support production-grade test operations across teams and environments.
            </SectionText>
          </SectionCard>
        </Section>
      </Content>
      <LandingFooter />
    </PageContainer>
  );
};
