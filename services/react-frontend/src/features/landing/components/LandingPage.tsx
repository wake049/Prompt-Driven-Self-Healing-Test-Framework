import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../contexts/ThemeContext';
import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { FeaturesGrid } from './FeaturesGrid';
import { HowItWorksSection } from './HowItWorksSection';
import { PricingSection } from './PricingSection';
import { LandingFooter } from './LandingFooter';
import SeoMetadata from '../../../shared/ui/SeoMetadata';

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://fluxtest.io').replace(/\/$/, '');

const PageContainer = styled.div`
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
  width: 100%;
`;

const LandingPage: React.FC = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleStartTrial = () => {
    navigate('/onboarding');
  };

  const handleOpenDemoVideos = () => {
    navigate('/demo-videos');
  };

  const handleBookDemo = () => {
    // Navigate to contact page or external booking link
    window.open('mailto:hello@fluxtest.io?subject=Book a Demo', '_blank');
  };

  const handleViewDocs = () => {
    // Navigate to documentation
    navigate('/app');
  };

  return (
    <PageContainer theme={theme}>
      <SeoMetadata
        title="Self-Healing Test Automation Platform"
        description="FluxTest helps teams generate tests from natural language, monitor executions, review self-healing decisions, and govern automation with policy controls."
        path="/"
        structuredData={[
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'FluxTest',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            url: SITE_URL,
            description: 'Self-healing test automation platform with AI-assisted test generation, review workflows, policy governance, and execution analytics.',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'FluxTest',
            url: SITE_URL,
            contactPoint: {
              '@type': 'ContactPoint',
              contactType: 'sales',
              email: 'hello@fluxtest.io',
            },
          },
        ]}
      />
      <LandingHeader />
      <HeroSection 
        onOpenDemo={handleOpenDemoVideos}
        onBookDemo={handleBookDemo}
        onViewDocs={handleViewDocs}
      />
      <FeaturesGrid />
      <HowItWorksSection />
      <PricingSection 
        onStartTrial={handleStartTrial}
        onBookDemo={handleBookDemo}
      />
      <LandingFooter />
    </PageContainer>
  );
};

export default LandingPage;
