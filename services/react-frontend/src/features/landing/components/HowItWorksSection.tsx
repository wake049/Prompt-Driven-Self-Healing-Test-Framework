import React from 'react';
import styled from 'styled-components';
import { Play, CheckCircle, Sparkles } from 'lucide-react';

const SectionContainer = styled.section`
  padding: 120px 64px;
  background: ${props => props.theme.colors.background};

  @media (max-width: 768px) {
    padding: 80px 24px;
  }
`;

const ContentWrapper = styled.div`
  max-width: 1200px;
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

const StepsContainer = styled.div`
  display: flex;
  align-items: stretch;
  gap: 32px;

  @media (max-width: 968px) {
    flex-direction: column;
  }
`;

const Step = styled.div`
  flex: 1;
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 40px;
  border: 2px solid ${props => props.theme.colors.border};
  position: relative;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${props => props.theme.shadows.large};
    border-color: ${props => props.theme.colors.primary};
  }

  &::after {
    content: '→';
    position: absolute;
    right: -48px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 32px;
    color: ${props => props.theme.colors.primary};
    font-weight: bold;

    @media (max-width: 968px) {
      content: '↓';
      right: auto;
      top: auto;
      bottom: -48px;
      left: 50%;
      transform: translateX(-50%);
    }
  }

  &:last-child::after {
    display: none;
  }
`;

const StepNumber = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #185FA5;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
`;

const StepIconWrapper = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: #185FA5;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;

  svg {
    color: white;
  }
`;

const StepTitle = styled.h3`
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 16px 0;
`;

const StepDescription = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  margin: 0;
`;

export const HowItWorksSection: React.FC = () => {
  return (
    <SectionContainer id="how-it-works">
      <ContentWrapper>
        <SectionTitle>How FluxTest test automation works</SectionTitle>
        
        <StepsContainer>
          <Step>
            <StepNumber>1</StepNumber>
            <StepTitle>Record or write</StepTitle>
            <StepDescription>
              Use the Chrome extension to capture elements from your app, or define test scenarios manually.
              FluxTest builds a semantic element repository with smart locators automatically.
            </StepDescription>
          </Step>

          <Step>
            <StepNumber>2</StepNumber>
            <StepTitle>Generate tests</StepTitle>
            <StepDescription>
              Describe what you want to test in plain English. The multi-AI pipeline generates
              production-ready browser automation steps that reference your element library.
            </StepDescription>
          </Step>

          <Step>
            <StepNumber>3</StepNumber>
            <StepTitle>Self-heal automatically</StepTitle>
            <StepDescription>
              When UI changes break a test, FluxTest analyzes the failure, proposes a fix,
              and heals the selector — all governed by your policies, all logged for audit.
            </StepDescription>
          </Step>
        </StepsContainer>
      </ContentWrapper>
    </SectionContainer>
  );
};
