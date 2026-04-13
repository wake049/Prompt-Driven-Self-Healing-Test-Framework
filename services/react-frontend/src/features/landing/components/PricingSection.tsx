import React from 'react';
import styled from 'styled-components';
import { Check } from 'lucide-react';

const SectionContainer = styled.section`
  padding: 120px 64px;
  background: ${props => props.theme.colors.surface};

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
  font-size: 20px;
  color: ${props => props.theme.colors.textSecondary};
  text-align: center;
  margin: 0 0 80px 0;

  @media (max-width: 768px) {
    font-size: 16px;
    margin-bottom: 48px;
  }
`;

const OutcomeStatement = styled.p`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  text-align: center;
  margin: -48px auto 56px;
  max-width: 860px;
  line-height: 1.6;

  @media (max-width: 768px) {
    margin: -24px auto 40px;
    font-size: 16px;
  }
`;

const PricingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 32px;
  margin-bottom: 64px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const PricingCard = styled.div<{ $featured?: boolean }>`
  background: ${props => props.theme.colors.background};
  border-radius: 16px;
  padding: 48px;
  border: 2px solid ${props => props.$featured ? props.theme.colors.primary : props.theme.colors.border};
  position: relative;
  transition: all 0.3s ease;
  box-shadow: ${props => props.$featured ? props.theme.shadows.large : props.theme.shadows.small};

  ${props => props.$featured && `
    transform: scale(1.05);
    
    @media (max-width: 968px) {
      transform: scale(1);
    }
  `}

  &:hover {
    transform: translateY(-4px) ${props => props.$featured ? 'scale(1.05)' : ''};
    box-shadow: ${props => props.theme.shadows.large};
  }
`;

const FeaturedBadge = styled.div`
  position: absolute;
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  background: #185FA5;
  color: white;
  padding: 8px 24px;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const PlanName = styled.h3`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 12px 0;
`;

const PlanDescription = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0 0 32px 0;
  line-height: 1.5;
`;

const PriceContainer = styled.div`
  margin-bottom: 32px;
`;

const Price = styled.div`
  font-size: 48px;
  font-weight: 800;
  color: ${props => props.theme.colors.text};
  margin-bottom: 8px;
  
  span {
    font-size: 24px;
    font-weight: 400;
    color: ${props => props.theme.colors.textSecondary};
  }
`;

const PriceNote = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0;
`;

const TrialNote = styled.p`
  font-size: 13px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 8px 0 0 0;
`;

const CTAButton = styled.button<{ $primary?: boolean }>`
  width: 100%;
  padding: 18px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 700;
  font-family: Arial, Helvetica, sans-serif;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 32px;

  ${props => props.$primary ? `
    background: #185FA5;
    color: white;
    border: none;
    
    &:hover {
      background: #378ADD;
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(24, 95, 165, 0.3);
    }
  ` : `
    background: transparent;
    color: ${props.theme.colors.text};
    border: 2px solid ${props.theme.colors.border};
    
    &:hover {
      border-color: ${props.theme.colors.primary};
      background: #E6F1FB;
    }
  `}
`;

const FeaturesList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const FeatureItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 15px;
  color: ${props => props.theme.colors.text};

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${props => props.theme.colors.primary};
  }
`;

const Divider = styled.div`
  height: 1px;
  background: ${props => props.theme.colors.border};
  margin: 32px 0;
`;

const FAQSection = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const FAQTitle = styled.h3`
  font-size: 32px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  text-align: center;
  margin: 0 0 48px 0;
`;

const FAQItem = styled.div`
  margin-bottom: 32px;
`;

const Question = styled.h4`
  font-size: 18px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 12px 0;
`;

const Answer = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  margin: 0;
`;

interface PricingSectionProps {
  onStartTrial: () => void;
  onBookDemo: () => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({
  onStartTrial,
  onBookDemo,
}) => {
  return (
    <SectionContainer id="pricing">
      <ContentWrapper>
        <SectionTitle>Pricing</SectionTitle>
        <SectionSubtitle>Start free. Scale when you need to.</SectionSubtitle>
        <OutcomeStatement>
          AI-driven test generation and self-healing recovery. No per-seat pricing, no usage surprises.
        </OutcomeStatement>

        <PricingGrid>
          {/* Free Tier */}
          <PricingCard>
            <PlanName>Community</PlanName>
            <PlanDescription>Explore FluxTest at no cost</PlanDescription>
            <PriceContainer>
              <Price>$0<span>/month</span></Price>
              <PriceNote>Forever free</PriceNote>
            </PriceContainer>
            <CTAButton onClick={onStartTrial}>Start Free</CTAButton>
            <FeaturesList>
              <FeatureItem>
                <Check size={20} />
                <span>Hard cap usage tier</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>10 test generations/month</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Basic self-healing (manual approval)</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Chrome extension</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>No overages (upgrade to Professional to scale)</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Community support</span>
              </FeatureItem>
            </FeaturesList>
          </PricingCard>

          {/* Pro Tier */}
          <PricingCard $featured>
            <FeaturedBadge>Founding Member</FeaturedBadge>
            <PlanName>Professional</PlanName>
            <PlanDescription>Unlimited usage with founding-member pricing</PlanDescription>
            <PriceContainer>
              <Price>$99<span>/month</span></Price>
              <PriceNote>Founding price for first 50 customers, locked forever</PriceNote>
            </PriceContainer>
            <PriceNote style={{ marginBottom: 8 }}>Post-founding list price: $200/month</PriceNote>
            <TrialNote>Includes a 14-day free trial.</TrialNote>
            <CTAButton $primary onClick={onStartTrial}>Start 14-Day Trial</CTAButton>
            <FeaturesList>
              <FeatureItem>
                <Check size={20} />
                <span>Unlimited elements</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Unlimited test generations</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Founding member pricing lock-in</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>No overage concept (truly unlimited usage)</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Automatic self-healing with policies</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Multi-AI provider support</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Element health analytics</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Priority support</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>60-day audit retention</span>
              </FeatureItem>
            </FeaturesList>
          </PricingCard>

          {/* Custom Tier */}
          <PricingCard>
            <PlanName>Custom</PlanName>
            <PlanDescription>Scoped limits and flexible billing controls for your team</PlanDescription>
            <PriceContainer>
              <Price>$149<span>/month</span></Price>
              <PriceNote>Founding starting point (scoped on a call)</PriceNote>
            </PriceContainer>
            <PriceNote style={{ marginBottom: 8 }}>Post-founding starts at $400-$500/month (scoped on a call)</PriceNote>
            <CTAButton onClick={onStartTrial}>Configure Custom Plan</CTAButton>
            <PriceNote style={{ marginBottom: 24 }}>
              Need help scoping it? <a href="#" onClick={(e) => { e.preventDefault(); onBookDemo(); }}>Talk to our team</a>
            </PriceNote>
            <FeaturesList>
              <FeatureItem>
                <Check size={20} />
                <span>Set your own usage limits or go unlimited</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Custom team member caps (or unlimited)</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Custom monthly test run limits (or unlimited)</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Custom AI request limits (or unlimited)</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Custom project caps (or unlimited)</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Hard cap by default</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Optional flat-rate overage billing (opt-in)</span>
              </FeatureItem>
              <FeatureItem>
                <Check size={20} />
                <span>Self-hosted deployment option</span>
              </FeatureItem>
            </FeaturesList>
          </PricingCard>
        </PricingGrid>

        <Divider />

        <FAQSection>
          <FAQTitle>Frequently Asked Questions</FAQTitle>
          
          <FAQItem>
            <Question>What AI providers do you support?</Question>
            <Answer>
              OpenAI (GPT-4), Anthropic (Claude), Google AI (Gemini), and local inference via Ollama.
              Switch providers at any time — no code changes required.
            </Answer>
          </FAQItem>

          <FAQItem>
            <Question>Is my data safe?</Question>
            <Answer>
              FluxTest applies policy controls and context filtering to limit sensitive data exposure
              before AI requests are sent. Custom plans include self-hosted deployment for full data isolation.
            </Answer>
          </FAQItem>

          <FAQItem>
            <Question>Can I try before I buy?</Question>
            <Answer>
              Yes. The Community tier is free with no credit card required. Professional includes
              a 14-day free trial at founding-member pricing.
            </Answer>
          </FAQItem>

          <FAQItem>
            <Question>How are element limits handled?</Question>
            <Answer>
              Community is a hard-cap tier with no overages — you get guidance alerts past 50 elements.
              Professional is unlimited. Custom uses configurable limits with optional flat-rate overage billing.
            </Answer>
          </FAQItem>

          <FAQItem>
            <Question>Do you offer discounts for education or non-profits?</Question>
            <Answer>
              Yes. Contact our team for details on education and non-profit pricing.
            </Answer>
          </FAQItem>
        </FAQSection>
      </ContentWrapper>
    </SectionContainer>
  );
};
