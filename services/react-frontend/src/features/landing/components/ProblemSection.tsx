import React from 'react';
import styled from 'styled-components';
import { XCircle, CheckCircle } from 'lucide-react';

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
  margin: 0 0 16px 0;

  @media (max-width: 768px) {
    font-size: 32px;
  }
`;

const SectionSubtitle = styled.p`
  font-size: 24px;
  color: ${props => props.theme.colors.textSecondary};
  text-align: center;
  margin: 0 0 80px 0;
  font-weight: 600;

  @media (max-width: 768px) {
    font-size: 18px;
    margin-bottom: 48px;
  }
`;

const ComparisonGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;

  @media (max-width: 968px) {
    grid-template-columns: 1fr;
    gap: 32px;
  }
`;

const ComparisonColumn = styled.div<{ $type: 'problem' | 'solution' }>`
  background: ${props => props.$type === 'problem' 
    ? '#FCEBEB' 
    : '#E1F5EE'};
  border-radius: 16px;
  padding: 40px;
  border: 2px solid ${props => props.$type === 'problem' ? '#A32D2D' : '#1D9E75'};
`;

const ColumnTitle = styled.h3`
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 32px 0;
  display: flex;
  align-items: center;
  gap: 12px;
  color: ${props => props.theme.colors.text};
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const FeatureItem = styled.li<{ $type: 'problem' | 'solution' }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 20px;
  font-size: 16px;
  line-height: 1.6;
  color: ${props => props.theme.colors.text};

  &:last-child {
    margin-bottom: 0;
  }

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${props => props.$type === 'problem' ? '#A32D2D' : '#1D9E75'};
  }
`;

export const ProblemSection: React.FC = () => {
  return (
    <SectionContainer>
      <ContentWrapper>
        <SectionTitle>Other tools hide the AI. FluxTest exposes it.</SectionTitle>
        <SectionSubtitle>Full control. Full transparency.</SectionSubtitle>

        <ComparisonGrid>
          <ComparisonColumn $type="problem">
            <ColumnTitle>
              <XCircle size={32} color="#A32D2D" />
              Other Tools
            </ColumnTitle>
            <FeatureList>
              <FeatureItem $type="problem">
                <XCircle size={20} />
                <span>No control over what data reaches the AI</span>
              </FeatureItem>
              <FeatureItem $type="problem">
                <XCircle size={20} />
                <span>Self-healing decisions are invisible</span>
              </FeatureItem>
              <FeatureItem $type="problem">
                <XCircle size={20} />
                <span>Locked to a single AI provider</span>
              </FeatureItem>
              <FeatureItem $type="problem">
                <XCircle size={20} />
                <span>No governance or audit trail</span>
              </FeatureItem>
              <FeatureItem $type="problem">
                <XCircle size={20} />
                <span>Black-box automation you cannot inspect</span>
              </FeatureItem>
            </FeatureList>
          </ComparisonColumn>

          <ComparisonColumn $type="solution">
            <ColumnTitle>
              <CheckCircle size={32} color="#1D9E75" />
              FluxTest
            </ColumnTitle>
            <FeatureList>
              <FeatureItem $type="solution">
                <CheckCircle size={20} />
                <span>MCP architecture filters sensitive data before AI sees it</span>
              </FeatureItem>
              <FeatureItem $type="solution">
                <CheckCircle size={20} />
                <span>Every healing decision logged and auditable</span>
              </FeatureItem>
              <FeatureItem $type="solution">
                <CheckCircle size={20} />
                <span>Switch between OpenAI, Anthropic, Google, or Ollama</span>
              </FeatureItem>
              <FeatureItem $type="solution">
                <CheckCircle size={20} />
                <span>Policy-based governance with 60-day audit retention</span>
              </FeatureItem>
              <FeatureItem $type="solution">
                <CheckCircle size={20} />
                <span>Open inspection of every AI interaction</span>
              </FeatureItem>
            </FeatureList>
          </ComparisonColumn>
        </ComparisonGrid>
      </ContentWrapper>
    </SectionContainer>
  );
};
