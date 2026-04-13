import React from 'react';
import styled from 'styled-components';
import { Sparkles, Shield, Zap } from 'lucide-react';

const HeroContainer = styled.section`
  background: #042C53;
  padding: 200px 64px 80px;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 30% 50%, rgba(55, 138, 221, 0.12) 0%, transparent 50%);
    pointer-events: none;
  }

  @media (max-width: 768px) {
    padding: 140px 24px 60px;
  }
`;

const ContentWrapper = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
`;

const Headline = styled.h1`
  font-size: 48px;
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  color: white;
  text-align: center;
  margin: 0 0 24px 0;
  line-height: 1.1;
  letter-spacing: -0.01em;

  @media (max-width: 768px) {
    font-size: 36px;
  }
`;

const Subheadline = styled.p`
  font-size: 22px;
  font-weight: 400;
  font-family: Arial, Helvetica, sans-serif;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  margin: 0 auto 48px;
  max-width: 800px;
  line-height: 1.5;

  @media (max-width: 768px) {
    font-size: 18px;
    margin-bottom: 32px;
  }
`;

const CTAButtonGroup = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 64px;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const PrimaryButton = styled.button`
  background: #185FA5;
  color: white;
  border: none;
  padding: 18px 40px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(24, 95, 165, 0.3);

  &:hover {
    background: #378ADD;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(24, 95, 165, 0.4);
  }
`;

const SecondaryButton = styled.button`
  background: #E6F1FB;
  color: #185FA5;
  border: none;
  padding: 18px 40px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #d0e6f8;
    transform: translateY(-2px);
  }
`;

const TertiaryButton = styled.button`
  background: transparent;
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.4);
  padding: 18px 40px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: white;
    background: rgba(255, 255, 255, 0.08);
  }
`;

const TrustBar = styled.div`
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 32px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.12);
`;

const TrustText = styled.p`
  color: white;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
`;

const IndustryTags = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
`;

const IndustryTag = styled.span`
  background: rgba(29, 158, 117, 0.2);
  color: #5DCAA5;
  padding: 8px 20px;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  font-family: Arial, Helvetica, sans-serif;
  border: 1px solid rgba(29, 158, 117, 0.3);
`;

interface HeroSectionProps {
  onOpenDemo: () => void;
  onBookDemo: () => void;
  onViewDocs: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenDemo,
  onBookDemo,
  onViewDocs,
}) => {
  return (
    <HeroContainer>
      <ContentWrapper>
        <Headline>AI test automation that self-heals in production.</Headline>
        <Subheadline>
          Generate tests from natural language, recover from selector drift, and govern
          automation with policy controls, execution analytics, and human review workflows.
        </Subheadline>

        <CTAButtonGroup>
          <PrimaryButton onClick={onOpenDemo}>
            Start Free
          </PrimaryButton>
          <SecondaryButton onClick={onBookDemo}>
            Book a Demo
          </SecondaryButton>
          <TertiaryButton onClick={onViewDocs}>
            Documentation
          </TertiaryButton>
        </CTAButtonGroup>

        <TrustBar>
          <TrustText>Trusted by engineering teams in regulated industries.</TrustText>
          <IndustryTags>
            <IndustryTag>Self-Hosted Option</IndustryTag>
            <IndustryTag>Multi-AI Provider</IndustryTag>
            <IndustryTag>Policy Governance</IndustryTag>
          </IndustryTags>
        </TrustBar>
      </ContentWrapper>
    </HeroContainer>
  );
};
