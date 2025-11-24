import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTheme } from '../../../contexts/ThemeContext';
import { 
  Chrome, 
  Download, 
  ArrowLeft, 
  CheckCircle, 
  Activity, 
  Zap, 
  Shield, 
  Database, 
  FileText, 
  Play, 
  Code, 
  ExternalLink, 
  Info,
  Settings,
  Globe,
  Eye,
  MousePointer,
  Layers
} from 'lucide-react';

const Container = styled.div`
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
  font-family: '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif;
`;

const Layout = styled.div`
  display: flex;
  height: 100vh;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  background: ${props => props.theme.colors.surface};
  padding: 32px 40px;
  box-shadow: ${props => props.theme.shadows.medium};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const Breadcrumb = styled.div`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BreadcrumbLink = styled.span`
  color: ${props => props.theme.colors.primary};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  &:hover {
    color: ${props => props.theme.colors.secondary};
  }
`;

const HeroSection = styled.div`
  text-align: center;
  margin-bottom: 24px;
`;

const HeroIcon = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  margin-bottom: 24px;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
`;

const Title = styled.h1`
  font-size: 36px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 16px 0;
  line-height: 1.2;
`;

const Subtitle = styled.p`
  font-size: 18px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0 0 32px 0;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
`;

const PrimaryButton = styled.button`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  }
`;

const SecondaryButton = styled.button`
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  border: 1px solid ${props => props.theme.colors.border};
  padding: 16px 32px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: ${props => props.theme.shadows.small};
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.medium};
    background: ${props => props.theme.colors.background};
  }
`;

const Content = styled.div`
  flex: 1;
  padding: 40px;
  overflow: auto;
  background: ${props => props.theme.colors.background};
  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const Section = styled.div`
  margin-bottom: 48px;
`;

const SectionTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0 0 24px 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
`;

const FeatureCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 24px;
  box-shadow: ${props => props.theme.shadows.medium};
  border: 1px solid ${props => props.theme.colors.border};
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: ${props => props.theme.shadows.large};
  }
`;

const FeatureIcon = styled.div<{ $color?: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: ${props => props.$color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  border-radius: 12px;
  margin-bottom: 16px;
  color: white;
`;

const FeatureTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 8px 0;
`;

const FeatureDescription = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0;
  line-height: 1.5;
`;

const StepsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
`;

const StepCard = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 20px;
  border: 1px solid ${props => props.theme.colors.border};
  position: relative;
`;

const StepNumber = styled.div`
  position: absolute;
  top: -12px;
  left: 20px;
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 12px;
`;

const StepTitle = styled.h4`
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 8px 0 8px 0;
`;

const StepDescription = styled.p`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0;
  line-height: 1.4;
`;

const StatusBadge = styled.div<{ $status: 'available' | 'installed' | 'connected' }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
  
  ${props => {
    switch(props.$status) {
      case 'installed':
        return `
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        `;
      case 'connected':
        return `
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        `;
      default:
        return `
          background: rgba(102, 126, 234, 0.1);
          color: #667eea;
          border: 1px solid rgba(102, 126, 234, 0.3);
        `;
    }
  }}
`;

const CodeBlock = styled.pre`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 16px;
  font-family: 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
  font-size: 13px;
  color: ${props => props.theme.colors.text};
  overflow-x: auto;
  margin: 16px 0;
`;

interface ChromeExtensionPageProps {
  className?: string;
}

const ChromeExtensionPage: React.FC<ChromeExtensionPageProps> = ({ className }) => {
  const navigate = useNavigate();

  const EXTENSION_STORE_URL =     'https://chromewebstore.google.com/detail/mjhcjndhkplegodllohpaiaojifnkagj?utm_source=item-share-cb';
  // Allow overriding the extension store URL via environment variable
  const [extensionStatus, setExtensionStatus] = useState<'available' | 'installed' | 'connected'>('available');

  // Check if Chrome extension is installed/connected
  useEffect(() => {
    const checkExtensionStatus = () => {
      if (window.navigator.userAgent.includes('Chrome')) {
        const extensionElements = document.querySelectorAll('[data-mcp-extension]');
        if (extensionElements.length > 0) {
          setExtensionStatus('connected');
        } else {
          try {
            if (typeof (window as any).chrome !== 'undefined' && (window as any).chrome.runtime) {
              setExtensionStatus('installed');
            }
          } catch (e) {
            setExtensionStatus('available');
          }
        }
      }
    };

    checkExtensionStatus();
    const interval = setInterval(checkExtensionStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleGetExtension = () => {
    // Open the configured Chrome Web Store URL (falls back to repository link)
    window.open(EXTENSION_STORE_URL, '_blank');
  };

  const handleViewDocs = () => {
    window.open('https://github.com/wake049/capstone-self-healing/blob/main/chrome-extension/README.md', '_blank');
  };

  const getStatusText = () => {
    switch(extensionStatus) {
      case 'installed':
        return 'Extension Detected';
      case 'connected':
        return 'Connected & Active';
      default:
        return 'Available for Install';
    }
  };

  return (
    <Container className={className}>
      <Layout>
        <MainContent>
          <Header>
            <Breadcrumb>
              <BreadcrumbLink onClick={() => navigate('/')}>
                <ArrowLeft size={16} />
                Dashboard
              </BreadcrumbLink>
              <span>{'>'}</span>
              <span>Chrome Extension</span>
            </Breadcrumb>
            
            <HeroSection>
              <HeroIcon>
                <Chrome size={40} />
              </HeroIcon>
              <Title>MCP Element Recorder Chrome Extension</Title>
              <Subtitle>
                Enhance your testing workflow with our Chrome extension for element recording. 
                Easily capture UI elements, generate intelligent selectors, and build your 
                test element repository directly from any webpage.
              </Subtitle>
              
              <StatusBadge $status={extensionStatus}>
                {extensionStatus === 'connected' ? <CheckCircle size={16} /> : 
                 extensionStatus === 'installed' ? <CheckCircle size={16} /> : 
                 <Info size={16} />}
                {getStatusText()}
              </StatusBadge>
              
              <ActionButtons>
                {extensionStatus === 'available' && (
                  <PrimaryButton onClick={handleGetExtension}>
                    <Download size={16} />
                    Install Extension
                  </PrimaryButton>
                )}
                
                <SecondaryButton onClick={handleViewDocs}>
                  <FileText size={16} />
                  View Documentation
                </SecondaryButton>
              </ActionButtons>
            </HeroSection>
          </Header>
          
          <Content>
            <Section>
              <SectionTitle>
                <Zap size={24} />
                Key Features
              </SectionTitle>
              
              <FeatureGrid>
                <FeatureCard>
                  <FeatureIcon $color="linear-gradient(135deg, #10b981, #059669)">
                    <MousePointer size={24} />
                  </FeatureIcon>
                  <FeatureTitle>One-Click Element Recording</FeatureTitle>
                  <FeatureDescription>
                    Click any element on a webpage to automatically capture its selectors, 
                    attributes, and properties. Generate smart, resilient selectors with AI assistance.
                  </FeatureDescription>
                </FeatureCard>
                
                <FeatureCard>
                  <FeatureIcon $color="linear-gradient(135deg, #3b82f6, #1d4ed8)">
                    <Database size={24} />
                  </FeatureIcon>
                  <FeatureTitle>Element Repository Building</FeatureTitle>
                  <FeatureDescription>
                    Build a comprehensive repository of UI elements that can be used by your 
                    test framework. All elements are automatically categorized and stored.
                  </FeatureDescription>
                </FeatureCard>
                
                <FeatureCard>
                  <FeatureIcon $color="linear-gradient(135deg, #8b5cf6, #7c3aed)">
                    <Shield size={24} />
                  </FeatureIcon>
                  <FeatureTitle>Smart Selector Generation</FeatureTitle>
                  <FeatureDescription>
                    Generate multiple selector strategies for each element including CSS selectors, 
                    XPath, and fallback methods for maximum reliability.
                  </FeatureDescription>
                </FeatureCard>
                
                <FeatureCard>
                  <FeatureIcon $color="linear-gradient(135deg, #ef4444, #dc2626)">
                    <Database size={24} />
                  </FeatureIcon>
                  <FeatureTitle>Automatic Sync</FeatureTitle>
                  <FeatureDescription>
                    Seamlessly sync recorded elements with your central repository. 
                    All changes are automatically reflected in the test framework.
                  </FeatureDescription>
                </FeatureCard>
                
                <FeatureCard>
                  <FeatureIcon $color="linear-gradient(135deg, #f59e0b, #d97706)">
                    <Code size={24} />
                  </FeatureIcon>
                  <FeatureTitle>Hosted Backend Integration</FeatureTitle>
                  <FeatureDescription>
                    Connects to our hosted backend service for reliable element storage 
                    and processing. No server setup required - just install and record.
                  </FeatureDescription>
                </FeatureCard>
                
                <FeatureCard>
                  <FeatureIcon $color="linear-gradient(135deg, #06b6d4, #0891b2)">
                    <Layers size={24} />
                  </FeatureIcon>
                  <FeatureTitle>Page Context Awareness</FeatureTitle>
                  <FeatureDescription>
                    Automatically organize elements by page and context, making it easy 
                    to manage large test suites across multiple pages.
                  </FeatureDescription>
                </FeatureCard>
              </FeatureGrid>
            </Section>
            
            <Section>
              <SectionTitle>
                <Settings size={24} />
                Getting Started
              </SectionTitle>
              
              <StepsGrid>
                <StepCard>
                  <StepNumber>1</StepNumber>
                  <StepTitle>Install Extension</StepTitle>
                  <StepDescription>
                    Download and install the Chrome extension from our repository. 
                    Enable developer mode if loading as an unpacked extension.
                  </StepDescription>
                </StepCard>
                
                <StepCard>
                  <StepNumber>2</StepNumber>
                  <StepTitle>Login to Framework</StepTitle>
                  <StepDescription>
                    Make sure you're logged into the test framework dashboard. 
                    The extension needs authentication to sync recorded elements.
                  </StepDescription>
                </StepCard>
                
                <StepCard>
                  <StepNumber>3</StepNumber>
                  <StepTitle>Record Elements</StepTitle>
                  <StepDescription>
                    Navigate to any webpage, click the extension icon, 
                    and start recording elements with intelligent selector generation.
                  </StepDescription>
                </StepCard>
                
                <StepCard>
                  <StepNumber>4</StepNumber>
                  <StepTitle>Build Repository</StepTitle>
                  <StepDescription>
                    Use recorded elements to build a comprehensive test element repository. 
                    Elements are automatically organized and made available to your test framework.
                  </StepDescription>
                </StepCard>
              </StepsGrid>
            </Section>
            
            <Section>
              <SectionTitle>
                <Code size={24} />
                Example Usage
              </SectionTitle>
              
              <FeatureTitle>Recording an Element</FeatureTitle>
              <FeatureDescription>
                Click the "📍 Record" button and then click any element on the page:
              </FeatureDescription>
              
              <CodeBlock>{`{
  "elementId": "login-button",
  "elementData": {
    "tag": "button",
    "text": "Sign In",
    "attributes": {
      "id": "login-btn",
      "class": "btn btn-primary",
      "type": "submit"
    },
    "selectors": [
      "#login-btn",
      ".btn.btn-primary",
      "button[type='submit']",
      "//button[@id='login-btn']"
    ]
  }
}`}</CodeBlock>
              
              <FeatureTitle>Generated Selectors</FeatureTitle>
              <FeatureDescription>
                The extension automatically generates multiple selector strategies:
              </FeatureDescription>
              
              <CodeBlock>{`// CSS Selectors (in priority order)
#login-btn                    // ID-based (highest priority)
.btn.btn-primary             // Class-based  
button[type="submit"]        // Attribute-based
button:nth-of-type(1)        // Position-based (fallback)

// XPath Selectors
//button[@id='login-btn']     // ID-based XPath
//button[contains(@class,'btn')] // Class-based XPath
//button[text()='Sign In']    // Text-based XPath`}</CodeBlock>
            </Section>
          </Content>
        </MainContent>
      </Layout>
    </Container>
  );
};

export default ChromeExtensionPage;