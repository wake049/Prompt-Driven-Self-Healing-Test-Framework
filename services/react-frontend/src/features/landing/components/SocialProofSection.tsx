import React from 'react';
import styled from 'styled-components';
import { Star, Quote } from 'lucide-react';

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

const TestimonialsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 32px;
  margin-bottom: 80px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const TestimonialCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 40px;
  border: 2px solid ${props => props.theme.colors.border};
  position: relative;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${props => props.theme.shadows.large};
  }
`;

const QuoteIcon = styled(Quote)`
  position: absolute;
  top: 24px;
  right: 24px;
  color: ${props => props.theme.colors.primary};
  opacity: 0.2;
`;

const Stars = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: 16px;

  svg {
    color: #fbbf24;
    fill: #fbbf24;
  }
`;

const TestimonialText = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.text};
  line-height: 1.7;
  margin: 0 0 24px 0;
  font-style: italic;
`;

const AuthorInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const AuthorAvatar = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #185FA5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  font-weight: 700;
`;

const AuthorDetails = styled.div``;

const AuthorName = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 4px;
`;

const AuthorRole = styled.div`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 48px;
`;

const StatCard = styled.div`
  text-align: center;
`;

const StatNumber = styled.div`
  font-size: 56px;
  font-weight: 800;
  color: #185FA5;
  margin-bottom: 12px;

  @media (max-width: 768px) {
    font-size: 40px;
  }
`;

const StatLabel = styled.div`
  font-size: 18px;
  color: ${props => props.theme.colors.textSecondary};
  font-weight: 600;
`;

export const SocialProofSection: React.FC = () => {
  const testimonials = [
    {
      text: "We went from 15 hours a week fixing broken locators to under 2 hours. The healing decision logs give our compliance team exactly what they need for audits.",
      author: "Sarah Chen",
      role: "Director of QA, FinTech Startup",
      initial: "S"
    },
    {
      text: "The MCP architecture gave us the data controls we needed. We run AI-powered self-healing without sensitive data leaving our environment.",
      author: "Dr. Michael Torres",
      role: "CTO, Healthcare Platform",
      initial: "M"
    },
    {
      text: "Policy controls and multi-AI support are what sold us. FluxTest is the first tool in this space that feels built for production, not just demos.",
      author: "James Park",
      role: "VP Engineering, E-Commerce",
      initial: "J"
    }
  ];

  const stats = [
    { number: "60%", label: "Less time on test maintenance" },
    { number: "90%", label: "Test generation success rate" },
    { number: "200+", label: "Elements tracked per workspace" },
    { number: "4", label: "AI providers supported" }
  ];

  return (
    <SectionContainer>
      <ContentWrapper>
        <SectionTitle>Teams that rely on FluxTest</SectionTitle>

        <TestimonialsGrid>
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={index}>
              <QuoteIcon size={64} />
              <Stars>
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={20} />
                ))}
              </Stars>
              <TestimonialText>"{testimonial.text}"</TestimonialText>
              <AuthorInfo>
                <AuthorAvatar>{testimonial.initial}</AuthorAvatar>
                <AuthorDetails>
                  <AuthorName>{testimonial.author}</AuthorName>
                  <AuthorRole>{testimonial.role}</AuthorRole>
                </AuthorDetails>
              </AuthorInfo>
            </TestimonialCard>
          ))}
        </TestimonialsGrid>

        <StatsGrid>
          {stats.map((stat, index) => (
            <StatCard key={index}>
              <StatNumber>{stat.number}</StatNumber>
              <StatLabel>{stat.label}</StatLabel>
            </StatCard>
          ))}
        </StatsGrid>
      </ContentWrapper>
    </SectionContainer>
  );
};
