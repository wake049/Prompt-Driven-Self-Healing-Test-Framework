import React from 'react';
import styled from 'styled-components';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import { CheckCircle, Clock, Target } from 'lucide-react';
import SeoMetadata from '../../../shared/ui/SeoMetadata';

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.colors.background};
`;

const Content = styled.div`
  flex: 1;
  max-width: 1600px;
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

const PhaseContainer = styled.div`
  margin-bottom: 64px;
`;

const PhaseHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
`;

const PhaseIcon = styled.div<{ $variant: 'done' | 'progress' | 'future' }>`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => {
    switch(props.$variant) {
      case 'done': return props.theme.colors.success + '11';
      case 'progress': return props.theme.colors.primary + '11';
      case 'future': return props.theme.colors.border;
    }
  }};
  color: ${props => {
    switch(props.$variant) {
      case 'done': return props.theme.colors.success;
      case 'progress': return props.theme.colors.primary;
      case 'future': return props.theme.colors.textSecondary;
    }
  }};
`;

const PhaseTitle = styled.h2`
  font-size: 32px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
`;

const PhaseDescription = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.8;
  margin-bottom: 24px;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  
  @media (min-width: 1400px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const FeatureCard = styled.div<{ $status: 'done' | 'progress' | 'planned' }>`
  padding: 20px;
  border-radius: 12px;
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-left: 3px solid ${props => {
    switch(props.$status) {
      case 'done': return props.theme.colors.success;
      case 'progress': return props.theme.colors.primary;
      case 'planned': return props.theme.colors.textSecondary;
    }
  }};
`;

const FeatureTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin-bottom: 8px;
`;

const FeatureDescription = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
`;

const StatusBadge = styled.span<{ $status: 'done' | 'progress' | 'planned' }>`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  margin-top: 8px;
  background: ${props => {
    switch(props.$status) {
      case 'done': return props.theme.colors.success + '22';
      case 'progress': return props.theme.colors.primary + '22';
      case 'planned': return props.theme.colors.border;
    }
  }};
  color: ${props => {
    switch(props.$status) {
      case 'done': return props.theme.colors.success;
      case 'progress': return props.theme.colors.primary;
      case 'planned': return props.theme.colors.textSecondary;
    }
  }};
`;

export const RoadmapPage: React.FC = () => {
  return (
    <PageContainer>
      <SeoMetadata
        title="Product Roadmap"
        description="See the FluxTest product roadmap across test generation, self-healing reliability, analytics, governance, and platform operations."
        path="/roadmap"
      />
      <LandingHeader />
      <Content>
        <Title>Product Roadmap</Title>
        <Subtitle>
          Our vision for the future of AI-assisted test automation
        </Subtitle>

        <PhaseContainer>
          <PhaseHeader>
            <PhaseIcon $variant="done">
              <CheckCircle size={24} />
            </PhaseIcon>
            <PhaseTitle>Phase 1: Foundation (Complete)</PhaseTitle>
          </PhaseHeader>
          <PhaseDescription>
            Core infrastructure and basic self-healing capabilities established
          </PhaseDescription>
          <FeatureGrid>
            <FeatureCard $status="done">
              <FeatureTitle>AI Test Plan Generation</FeatureTitle>
              <FeatureDescription>
                Natural language to executable test flow generation
              </FeatureDescription>
              <StatusBadge $status="done">Completed</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="done">
              <FeatureTitle>Element Healing Engine</FeatureTitle>
              <FeatureDescription>
                Automatic selector proposals when elements drift or change
              </FeatureDescription>
              <StatusBadge $status="done">Completed</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="done">
              <FeatureTitle>Review Queue System</FeatureTitle>
              <FeatureDescription>
                Human approval workflow for proposed selector changes
              </FeatureDescription>
              <StatusBadge $status="done">Completed</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="done">
              <FeatureTitle>Policy Engine</FeatureTitle>
              <FeatureDescription>
                Configurable safety controls for auto-healing behavior
              </FeatureDescription>
              <StatusBadge $status="done">Completed</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="done">
              <FeatureTitle>Execution Dashboard</FeatureTitle>
              <FeatureDescription>
                Visualization of test runs and healing metrics
              </FeatureDescription>
              <StatusBadge $status="done">Completed</StatusBadge>
            </FeatureCard>
          </FeatureGrid>
        </PhaseContainer>

        <PhaseContainer>
          <PhaseHeader>
            <PhaseIcon $variant="progress">
              <Clock size={24} />
            </PhaseIcon>
            <PhaseTitle>Phase 2: Enhancement (In Progress)</PhaseTitle>
          </PhaseHeader>
          <PhaseDescription>
            Improving reliability, AI-assisted troubleshooting, and execution quality
          </PhaseDescription>
          <FeatureGrid>
            <FeatureCard $status="done">
              <FeatureTitle>Advanced Analytics</FeatureTitle>
              <FeatureDescription>
                Deeper insights into failure patterns and healing effectiveness
              </FeatureDescription>
              <StatusBadge $status="done">Completed</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="done">
              <FeatureTitle>Failure Analysis Insights Panel</FeatureTitle>
              <FeatureDescription>
                Read-only AI failure insights with root-cause messaging and actionable recommendations
              </FeatureDescription>
              <StatusBadge $status="done">Completed</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="done">
              <FeatureTitle>Analytics & Dashboard Reliability</FeatureTitle>
              <FeatureDescription>
                Stabilized dashboard loading, fixed schema mismatches, and hardened trend/insight rendering
              </FeatureDescription>
              <StatusBadge $status="done">Completed</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="done">
              <FeatureTitle>Multi-Browser Support</FeatureTitle>
              <FeatureDescription>
                Expand beyond Chrome to Firefox, Safari, and Edge
              </FeatureDescription>
              <StatusBadge $status="done">Completed</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="done">
              <FeatureTitle>Collaborative Review</FeatureTitle>
              <FeatureDescription>
                Team-based approval workflows and commenting system
              </FeatureDescription>
              <StatusBadge $status="done">Completed</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="planned">
              <FeatureTitle>Test Flakiness Detection</FeatureTitle>
              <FeatureDescription>
                AI-powered identification of intermittent test failures
              </FeatureDescription>
              <StatusBadge $status="planned">Planned</StatusBadge>
            </FeatureCard>
          </FeatureGrid>
        </PhaseContainer>

        <PhaseContainer>
          <PhaseHeader>
            <PhaseIcon $variant="future">
              <Target size={24} />
            </PhaseIcon>
            <PhaseTitle>Phase 3: Scale & Integration (Future)</PhaseTitle>
          </PhaseHeader>
          <PhaseDescription>
            Enterprise features and ecosystem integration
          </PhaseDescription>
          <FeatureGrid>
            <FeatureCard $status="planned">
              <FeatureTitle>CI/CD Integrations</FeatureTitle>
              <FeatureDescription>
                Native plugins for Jenkins, GitHub Actions, GitLab CI
              </FeatureDescription>
              <StatusBadge $status="planned">Future</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="planned">
              <FeatureTitle>Visual Regression Testing</FeatureTitle>
              <FeatureDescription>
                Automated screenshot comparison and diff analysis
              </FeatureDescription>
              <StatusBadge $status="planned">Future</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="planned">
              <FeatureTitle>Custom Model Training</FeatureTitle>
              <FeatureDescription>
                Fine-tune healing models on your specific application
              </FeatureDescription>
              <StatusBadge $status="planned">Future</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="planned">
              <FeatureTitle>Performance Monitoring</FeatureTitle>
              <FeatureDescription>
                Track page load times, API latency, and resource usage
              </FeatureDescription>
              <StatusBadge $status="planned">Future</StatusBadge>
            </FeatureCard>
            <FeatureCard $status="planned">
              <FeatureTitle>Mobile Testing</FeatureTitle>
              <FeatureDescription>
                Support for iOS and Android native apps via Appium
              </FeatureDescription>
              <StatusBadge $status="planned">Future</StatusBadge>
            </FeatureCard>
          </FeatureGrid>
        </PhaseContainer>
      </Content>
      <LandingFooter />
    </PageContainer>
  );
};
