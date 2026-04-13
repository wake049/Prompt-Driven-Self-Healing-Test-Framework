import React from 'react';
import styled from 'styled-components';
import { Shield, Lock, Zap, Activity, Heart, Users } from 'lucide-react';

const SectionContainer = styled.section`
  padding: 120px 64px;
  background: ${props => props.theme.colors.surface};

  @media (max-width: 768px) {
    padding: 80px 24px;
  }
`;

const ContentWrapper = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const SectionTitle = styled.h2`
  font-size: 48px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  text-align: center;
  margin: 0 0 80px 0;

  @media (max-width: 768px) {
    font-size: 32px;
    margin-bottom: 48px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 48px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 32px;
  }
`;

const FeatureCard = styled.div`
  background: ${props => props.theme.colors.background};
  border-radius: 16px;
  padding: 40px;
  border: 2px solid ${props => props.theme.colors.border};
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${props => props.theme.shadows.large};
    border-color: ${props => props.theme.colors.primary};
  }
`;

const IconWrapper = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #185FA5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;

  svg {
    color: white;
  }
`;

const FeatureTitle = styled.h3`
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 12px 0;
`;

const FeatureDescription = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  margin: 0 0 24px 0;
`;

const CapabilityList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const CapabilityItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};

  &::before {
    content: '✓';
    color: ${props => props.theme.colors.primary};
    font-weight: bold;
    flex-shrink: 0;
  }
`;

export const FeaturesGrid: React.FC = () => {
  const features = [
    {
      icon: Shield,
      title: 'Policy-Based Governance',
      description: 'Define exactly how aggressive or conservative self-healing behaves. Set confidence thresholds, block risky changes, and retain full audit history.',
      capabilities: [
        'Confidence-based auto-healing',
        'Multi-outcome ranking',
        'Safety blocks for critical actions',
        '60-day audit retention',
        'Governance scoring per element'
      ]
    },
    {
      icon: Lock,
      title: 'Privacy-Preserving Architecture',
      description: 'MCP policy controls filter sensitive data before it reaches any AI provider. Self-host for full data isolation.',
      capabilities: [
        'Policy-driven data filtering',
        'Audit-ready request logging',
        'Self-hosted deployment option',
        'Per-field data classification',
        'Zero data retention by AI providers'
      ]
    },
    {
      icon: Zap,
      title: 'Multi-AI Provider Support',
      description: 'Switch between OpenAI, Anthropic, Google AI, or run locally with Ollama. No vendor lock-in, no mandatory API costs.',
      capabilities: [
        'Optimize cost per model',
        'Run locally with Ollama',
        'Meet internal governance requirements',
        'Compare provider performance',
        'Swap providers without code changes'
      ]
    },
    {
      icon: Activity,
      title: 'Self-Healing Analytics',
      description: 'See exactly when tests break, why they broke, and how they were healed. Every attempt is logged with confidence scores.',
      capabilities: [
        'Healing success rates by element',
        'Locator drift severity scoring',
        'Flaky test detection',
        'System health scoring',
        'Trend analysis over time'
      ]
    },
    {
      icon: Heart,
      title: 'Element Health Tracking',
      description: 'Track every element in your repository. Get drift warnings before tests break, not after.',
      capabilities: [
        '200+ elements monitored',
        'Health scoring per element',
        'Naming consistency checks',
        'Early drift detection',
        'Actionable maintenance alerts'
      ]
    },
    {
      icon: Users,
      title: 'Human-in-the-Loop Review',
      description: 'Route high-risk changes and unknown elements to a review queue. Approve or reject before they reach production.',
      capabilities: [
        'Review queue for critical changes',
        'Approval workflows',
        'Built for regulated industries',
        'Audit trail for every decision',
        'Team-based review assignments'
      ]
    }
  ];

  return (
    <SectionContainer id="features">
      <ContentWrapper>
        <SectionTitle>Self-healing test automation capabilities</SectionTitle>
        <Grid>
          {features.map((feature, index) => (
            <FeatureCard key={index}>
              <IconWrapper>
                <feature.icon size={32} />
              </IconWrapper>
              <FeatureTitle>{feature.title}</FeatureTitle>
              <FeatureDescription>{feature.description}</FeatureDescription>
              <CapabilityList>
                {feature.capabilities.map((capability, idx) => (
                  <CapabilityItem key={idx}>{capability}</CapabilityItem>
                ))}
              </CapabilityList>
            </FeatureCard>
          ))}
        </Grid>
      </ContentWrapper>
    </SectionContainer>
  );
};
