import React from 'react';
import styled from 'styled-components';
import { Building2, Heart, ShoppingCart, DollarSign } from 'lucide-react';

const SectionContainer = styled.section`
  padding: 120px 64px;
  background: ${props => props.theme.colors.background};

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

const UseCasesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 48px;

  @media (max-width: 968px) {
    grid-template-columns: 1fr;
    gap: 32px;
  }
`;

const UseCaseCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 48px;
  border: 2px solid ${props => props.theme.colors.border};
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${props => props.theme.shadows.large};
    border-color: ${props => props.theme.colors.primary};
  }
`;

const IconWrapper = styled.div`
  width: 72px;
  height: 72px;
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

const UseCaseTitle = styled.h3`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 16px 0;
`;

const UseCaseDescription = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  margin: 0 0 24px 0;
`;

const ChallengeSection = styled.div`
  margin-bottom: 24px;
`;

const ChallengeTitle = styled.h4`
  font-size: 16px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #A32D2D;
`;

const SolutionTitle = styled.h4`
  font-size: 16px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #1D9E75;
`;

const TextContent = styled.p`
  font-size: 15px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  margin: 0;
`;

const ResultBox = styled.div`
  background: rgba(24, 95, 165, 0.08);
  border-radius: 12px;
  padding: 20px;
  margin-top: 24px;
  border-left: 4px solid ${props => props.theme.colors.primary};
`;

const ResultText = styled.p`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0;
  line-height: 1.5;
`;

export const UseCasesSection: React.FC = () => {
  const useCases = [
    {
      icon: Building2,
      title: 'Enterprise SaaS',
      description: 'Complex applications with frequent releases and multiple environments.',
      challenge: 'Test suites break every sprint. QA spends 40% of their time fixing locators instead of writing new tests.',
      solution: 'FluxTest self-heals selectors automatically. Policy governance routes critical flows to human review.',
      result: 'Cut test maintenance time. Tests run reliably across environments without manual intervention.'
    },
    {
      icon: Heart,
      title: 'Healthcare',
      description: 'Testing workflows for systems that handle protected health information.',
      challenge: 'Cannot send PHI to third-party AI providers. Need full audit trails for compliance.',
      solution: 'MCP layer filters sensitive data before AI processing. Every healing attempt logged with policy compliance.',
      result: 'AI-powered self-healing with data controls that satisfy internal audit requirements.'
    },
    {
      icon: ShoppingCart,
      title: 'E-Commerce',
      description: 'High-velocity testing for checkout flows and product catalogs.',
      challenge: 'Product catalog changes daily. Checkout flows run 50+ times per week. Locators break constantly.',
      solution: 'Element health tracking detects drift before tests break. Auto-healing keeps checkout flows stable.',
      result: 'Stable checkout tests and faster regression cycles without locator maintenance.'
    },
    {
      icon: DollarSign,
      title: 'Financial Services',
      description: 'Regulated testing for banking and investment platforms.',
      challenge: 'Strict compliance requirements. Every test change must be provable. Zero tolerance for flakiness.',
      solution: 'Policy-based governance with approval workflows. Human-in-the-loop for high-risk changes. Full audit trail.',
      result: 'Auditable testing workflows with significantly fewer false positives.'
    }
  ];

  return (
    <SectionContainer>
      <ContentWrapper>
        <SectionTitle>Built for real-world testing</SectionTitle>
        
        <UseCasesGrid>
          {useCases.map((useCase, index) => (
            <UseCaseCard key={index}>
              <IconWrapper>
                <useCase.icon size={36} />
              </IconWrapper>
              <UseCaseTitle>{useCase.title}</UseCaseTitle>
              <UseCaseDescription>{useCase.description}</UseCaseDescription>
              
              <ChallengeSection>
                <ChallengeTitle>Challenge</ChallengeTitle>
                <TextContent>{useCase.challenge}</TextContent>
              </ChallengeSection>

              <ChallengeSection>
                <SolutionTitle>Solution</SolutionTitle>
                <TextContent>{useCase.solution}</TextContent>
              </ChallengeSection>

              <ResultBox>
                <ResultText>💡 {useCase.result}</ResultText>
              </ResultBox>
            </UseCaseCard>
          ))}
        </UseCasesGrid>
      </ContentWrapper>
    </SectionContainer>
  );
};
