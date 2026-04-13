import React from 'react';
import styled from 'styled-components';
import { ArrowRight } from 'lucide-react';

const SectionContainer = styled.section`
  padding: 120px 64px;
  background: #042C53;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at 70% 50%, rgba(55, 138, 221, 0.12) 0%, transparent 50%);
    pointer-events: none;
  }

  @media (max-width: 768px) {
    padding: 80px 24px;
  }
`;

const ContentWrapper = styled.div`
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
  position: relative;
  z-index: 1;
`;

const Title = styled.h2`
  font-size: 56px;
  font-weight: 800;
  color: white;
  margin: 0 0 24px 0;
  line-height: 1.2;

  @media (max-width: 768px) {
    font-size: 36px;
  }
`;

const Subtitle = styled.p`
  font-size: 24px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 48px 0;
  line-height: 1.5;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const CTAButtonGroup = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const PrimaryButton = styled.button`
  background: #185FA5;
  color: white;
  border: none;
  padding: 20px 48px;
  border-radius: 8px;
  font-size: 20px;
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(24, 95, 165, 0.3);
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;

  &:hover {
    background: #378ADD;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(24, 95, 165, 0.4);
  }
`;

const SecondaryButton = styled.button`
  background: transparent;
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.4);
  padding: 20px 48px;
  border-radius: 8px;
  font-size: 20px;
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: white;
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }
`;

const TrustNote = styled.p`
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
  margin: 32px 0 0 0;
`;

interface FinalCTAProps {
  onStartTrial: () => void;
  onBookDemo: () => void;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({
  onStartTrial,
  onBookDemo,
}) => {
  return (
    <SectionContainer>
      <ContentWrapper>
        <Title>Start shipping with confidence.</Title>
        <Subtitle>
          Free tier available. No credit card required. 14-day trial on Professional.
        </Subtitle>

        <CTAButtonGroup>
          <PrimaryButton onClick={onStartTrial}>
            Start Free
            <ArrowRight size={24} />
          </PrimaryButton>
          <SecondaryButton onClick={onBookDemo}>
            Book a Demo
          </SecondaryButton>
        </CTAButtonGroup>

        <TrustNote>
          No credit card required · 14-day Professional trial · Cancel anytime
        </TrustNote>
      </ContentWrapper>
    </SectionContainer>
  );
};
