import React from 'react';
import styled from 'styled-components';
import { LandingHeader } from '../components/LandingHeader';
import { LandingFooter } from '../components/LandingFooter';
import { Shield, Lock, AlertTriangle, Database, Eye, Key } from 'lucide-react';
import SeoMetadata from '../../../shared/ui/SeoMetadata';

const PageContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${props => props.theme.colors.background};
`;

const Content = styled.div`
  flex: 1;
  max-width: 1600px;
  margin: 120px auto 80px;
  padding: 0 64px;

  @media (max-width: 768px) {
    padding: 0 24px;
    margin: 100px auto 60px;
  }
`;

const Title = styled.h1`
  font-size: 48px;
  font-weight: 800;
  color: ${props => props.theme.colors.text};
  margin-bottom: 24px;
  
  @media (max-width: 768px) {
    font-size: 36px;
  }
`;

const Subtitle = styled.p`
  font-size: 20px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.6;
  margin-bottom: 48px;
`;

const WarningBanner = styled.div`
  padding: 24px;
  border-radius: 12px;
  background: #f59e0b11;
  border-left: 4px solid #f59e0b;
  margin-bottom: 48px;
  display: flex;
  gap: 16px;
  align-items: start;
`;

const WarningIcon = styled.div`
  color: #f59e0b;
  flex-shrink: 0;
  margin-top: 2px;
`;

const WarningText = styled.div`
  font-size: 16px;
  color: ${props => props.theme.colors.text};
  line-height: 1.6;
  
  strong {
    display: block;
    margin-bottom: 8px;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 32px;
  margin-bottom: 48px;
  
  @media (min-width: 1400px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const Card = styled.div`
  padding: 32px;
  border-radius: 16px;
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
`;

const IconWrapper = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: ${props => props.theme.colors.primary}11;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: ${props => props.theme.colors.primary};
`;

const CardTitle = styled.h3`
  font-size: 20px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 12px;
`;

const CardText = styled.p`
  font-size: 15px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.7;
`;

const List = styled.ul`
  margin-top: 12px;
  margin-left: 20px;
  
  li {
    font-size: 15px;
    color: ${props => props.theme.colors.textSecondary};
    line-height: 1.7;
    margin-bottom: 8px;
  }
`;

const Section = styled.section`
  margin-bottom: 48px;
`;

const SectionTitle = styled.h2`
  font-size: 32px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: 16px;
`;

const SectionText = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.8;
  margin-bottom: 16px;
`;

export const SecurityPage: React.FC = () => {
  return (
    <PageContainer>
      <SeoMetadata
        title="Security Overview"
        description="Review the FluxTest security posture, governance controls, access boundaries, and operational safeguards for production deployments."
        path="/security"
      />
      <LandingHeader />
      <Content>
        <Title>Security Overview</Title>
        <Subtitle>
          Understanding security controls across the FluxTest platform
        </Subtitle>

        <WarningBanner>
          <WarningIcon>
            <AlertTriangle size={24} />
          </WarningIcon>
          <WarningText>
            <strong>Security is a core platform priority.</strong>
            Use strong credentials, enforce least-privilege access, and follow your
            organization's data governance requirements.
          </WarningText>
        </WarningBanner>

        <Grid>
          <Card>
            <IconWrapper>
              <Lock size={28} />
            </IconWrapper>
            <CardTitle>Authentication</CardTitle>
            <CardText>
              User access is protected with modern authentication controls and secure
              credential handling practices.
            </CardText>
            <List>
              <li>Session-based access protection</li>
              <li>Strong credential protection controls</li>
              <li>Automatic session lifecycle controls</li>
            </List>
          </Card>

          <Card>
            <IconWrapper>
              <Database size={28} />
            </IconWrapper>
            <CardTitle>Data Storage</CardTitle>
            <CardText>
              Data is managed with operational controls for availability, integrity,
              and lifecycle governance.
            </CardText>
            <List>
              <li>Tenant-aware data isolation</li>
              <li>Access controls for privileged operations</li>
              <li>Operational recovery planning</li>
            </List>
          </Card>

          <Card>
            <IconWrapper>
              <Shield size={28} />
            </IconWrapper>
            <CardTitle>API Security</CardTitle>
            <CardText>
              API access is restricted through authenticated access, input safeguards,
              and policy-governed controls.
            </CardText>
            <List>
              <li>Authenticated endpoint access</li>
              <li>Request validation and policy checks</li>
              <li>Traffic safeguards and abuse prevention</li>
            </List>
          </Card>

          <Card>
            <IconWrapper>
              <Eye size={28} />
            </IconWrapper>
            <CardTitle>Privacy & Monitoring</CardTitle>
            <CardText>
              System logs capture user actions and API requests for debugging purposes.
              No third-party analytics or tracking.
            </CardText>
            <List>
              <li>Server-side logging only</li>
              <li>No external tracking</li>
              <li>Logs retained temporarily</li>
            </List>
          </Card>

          <Card>
            <IconWrapper>
              <Key size={28} />
            </IconWrapper>
            <CardTitle>Access Control</CardTitle>
            <CardText>
              Role-based access control determines which users can approve healing decisions
              and modify policies.
            </CardText>
            <List>
              <li>Organization-level isolation</li>
              <li>User role permissions</li>
              <li>Policy-based restrictions</li>
            </List>
          </Card>
        </Grid>

        <Section>
          <SectionTitle>Security Best Practices</SectionTitle>
          <SectionText>
            To keep your workspace secure:
          </SectionText>
          <List>
            <li>Use strong unique passwords and MFA where available</li>
            <li>Apply least-privilege access by role</li>
            <li>Rotate credentials and API keys regularly</li>
            <li>Review audit activity for high-risk operations</li>
            <li>Follow your internal compliance and retention policies</li>
          </List>
        </Section>

        <Section>
          <SectionTitle>Reporting Security Issues</SectionTitle>
          <SectionText>
            If you discover a security vulnerability, please report it to support@fluxtest.io
            with details of the issue and steps to reproduce.
          </SectionText>
        </Section>
      </Content>
      <LandingFooter />
    </PageContainer>
  );
};
