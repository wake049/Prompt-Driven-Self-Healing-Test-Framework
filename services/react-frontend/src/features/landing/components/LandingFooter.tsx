import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { Twitter, Linkedin, Mail } from 'lucide-react';

const FooterContainer = styled.footer`
  background: ${props => props.theme.colors.surface};
  border-top: 2px solid ${props => props.theme.colors.border};
  padding: 64px 64px 32px;

  @media (max-width: 768px) {
    padding: 48px 24px 24px;
  }
`;

const ContentWrapper = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const FooterGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 64px;
  margin-bottom: 48px;

  @media (max-width: 968px) {
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    gap: 32px;
  }
`;

const FooterColumn = styled.div``;

const Logo = styled.div`
  font-size: 28px;
  font-weight: 500;
  font-family: Arial, Helvetica, sans-serif;
  color: #1A1A1A;
  margin-bottom: 16px;

  span {
    color: #185FA5;
    font-weight: 400;
  }
`;

const Description = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  margin: 0 0 24px 0;
`;

const SocialLinks = styled.div`
  display: flex;
  gap: 16px;
`;

const SocialLink = styled.a`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  color: ${props => props.theme.colors.text};
  text-decoration: none;

  &:hover {
    background: ${props => props.theme.colors.primary};
    border-color: ${props => props.theme.colors.primary};
    color: white;
    transform: translateY(-2px);
  }
`;

const ColumnTitle = styled.h4`
  font-size: 16px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 20px 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const LinkList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const LinkItem = styled.li`
  margin-bottom: 12px;
`;

const FooterLink = styled.a`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  text-decoration: none;
  transition: color 0.3s ease;
  cursor: pointer;

  &:hover {
    color: ${props => props.theme.colors.primary};
  }
`;

const Divider = styled.div`
  height: 1px;
  background: ${props => props.theme.colors.border};
  margin-bottom: 32px;
`;

const BottomSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }
`;

const Copyright = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0;
`;

const LegalLinks = styled.div`
  display: flex;
  gap: 24px;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 12px;
  }
`;

export const LandingFooter: React.FC = () => {
  const navigate = useNavigate();
  const twitterUrl = import.meta.env.VITE_SOCIAL_TWITTER_URL || 'https://x.com';
  const linkedinUrl = import.meta.env.VITE_SOCIAL_LINKEDIN_URL || 'https://linkedin.com';
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@fluxtest.io';
  
  return (
    <FooterContainer>
      <ContentWrapper>
        <FooterGrid>
          <FooterColumn>
            <Logo>Flux<span>Test</span></Logo>
            <Description>
              AI-powered test generation, self-healing selectors, and policy-based
              governance for engineering teams.
            </Description>
            <SocialLinks>
              <SocialLink href={twitterUrl} target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <Twitter size={20} />
              </SocialLink>
              <SocialLink href={linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <Linkedin size={20} />
              </SocialLink>
              <SocialLink href={`mailto:${supportEmail}`} aria-label="Email">
                <Mail size={20} />
              </SocialLink>
            </SocialLinks>
          </FooterColumn>

          <FooterColumn>
            <ColumnTitle>Product</ColumnTitle>
            <LinkList>
              <LinkItem><FooterLink href="/#features">Features</FooterLink></LinkItem>
              <LinkItem><FooterLink href="/#pricing">Pricing</FooterLink></LinkItem>
              <LinkItem><FooterLink onClick={() => navigate('/docs')}>Documentation</FooterLink></LinkItem>
              <LinkItem><FooterLink onClick={() => navigate('/changelog')}>Changelog</FooterLink></LinkItem>
              <LinkItem><FooterLink onClick={() => navigate('/roadmap')}>Roadmap</FooterLink></LinkItem>
            </LinkList>
          </FooterColumn>

          <FooterColumn>
            <ColumnTitle>Company</ColumnTitle>
            <LinkList>
              <LinkItem><FooterLink onClick={() => navigate('/about')}>About Us</FooterLink></LinkItem>
              <LinkItem><FooterLink onClick={() => navigate('/contact')}>Contact</FooterLink></LinkItem>
              <LinkItem><FooterLink onClick={() => navigate('/security')}>Security</FooterLink></LinkItem>
            </LinkList>
          </FooterColumn>

          <FooterColumn>
            <ColumnTitle>Resources</ColumnTitle>
            <LinkList>
              <LinkItem><FooterLink onClick={() => navigate('/docs/quick-start')}>Getting Started</FooterLink></LinkItem>
              <LinkItem><FooterLink onClick={() => navigate('/demo-videos')}>Video Tutorials</FooterLink></LinkItem>
              <LinkItem><FooterLink onClick={() => navigate('/docs/api')}>API Reference</FooterLink></LinkItem>
              <LinkItem><FooterLink onClick={() => navigate('/changelog')}>Product Updates</FooterLink></LinkItem>
              <LinkItem><FooterLink onClick={() => navigate('/contact')}>Support</FooterLink></LinkItem>
            </LinkList>
          </FooterColumn>
        </FooterGrid>

        <Divider />

        <BottomSection>
          <Copyright>
            © {new Date().getFullYear()} FluxTest. All rights reserved.
          </Copyright>
          <LegalLinks>
            <FooterLink onClick={() => navigate('/privacy')}>Privacy Policy</FooterLink>
            <FooterLink onClick={() => navigate('/terms')}>Terms of Service</FooterLink>
            <FooterLink onClick={() => navigate('/licensing')}>Licensing Agreement</FooterLink>
            <FooterLink onClick={() => navigate('/cookies')}>Cookie Policy</FooterLink>
          </LegalLinks>
        </BottomSection>
      </ContentWrapper>
    </FooterContainer>
  );
};
