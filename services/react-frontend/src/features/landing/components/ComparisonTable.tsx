import React from 'react';
import styled from 'styled-components';
import { Check, X } from 'lucide-react';

const SectionContainer = styled.section`
  padding: 120px 64px;
  background: ${props => props.theme.colors.surface};

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

const TableWrapper = styled.div`
  background: ${props => props.theme.colors.background};
  border-radius: 16px;
  overflow: hidden;
  border: 2px solid ${props => props.theme.colors.border};
  box-shadow: ${props => props.theme.shadows.medium};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Thead = styled.thead`
  background: #042C53;
`;

const Th = styled.th`
  padding: 24px;
  text-align: left;
  font-size: 18px;
  font-weight: 700;
  color: white;
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);

  &:first-child {
    width: 35%;
  }

  @media (max-width: 968px) {
    font-size: 14px;
    padding: 16px 12px;
  }
`;

const Tbody = styled.tbody``;

const Tr = styled.tr`
  border-bottom: 1px solid ${props => props.theme.colors.border};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${props => props.theme.colors.surface};
  }
`;

const Td = styled.td`
  padding: 20px 24px;
  font-size: 15px;
  color: ${props => props.theme.colors.text};
  vertical-align: middle;

  @media (max-width: 968px) {
    font-size: 13px;
    padding: 16px 12px;
  }
`;

const FeatureCell = styled(Td)`
  font-weight: 600;
`;

const IconCell = styled(Td)`
  text-align: center;
`;

const CheckIcon = styled(Check)`
  color: #1D9E75;
`;

const XIcon = styled(X)`
  color: #A32D2D;
`;

const PartialText = styled.span`
  color: ${props => props.theme.colors.textSecondary};
  font-style: italic;
`;

const HighlightedRow = styled(Tr)`
  background: rgba(24, 95, 165, 0.05);
  
  ${FeatureCell} {
    font-weight: 700;
    color: ${props => props.theme.colors.primary};
  }
`;

export const ComparisonTable: React.FC = () => {
  return (
    <SectionContainer>
      <ContentWrapper>
        <SectionTitle>How FluxTest compares</SectionTitle>
        <SectionSubtitle>
          Feature-by-feature against popular AI test tools
        </SectionSubtitle>

        <TableWrapper>
          <Table>
            <Thead>
              <Tr>
                <Th>Feature</Th>
                <Th>FluxTest</Th>
                <Th>Reflect.run</Th>
                <Th>TestIM</Th>
                <Th>Selenium IDE</Th>
              </Tr>
            </Thead>
            <Tbody>
              <HighlightedRow>
                <FeatureCell>Privacy-Preserving MCP</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
              </HighlightedRow>
              
              <HighlightedRow>
                <FeatureCell>Multi-AI Provider Support</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
              </HighlightedRow>

              <Tr>
                <FeatureCell>Self-Healing Locators</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
              </Tr>

              <HighlightedRow>
                <FeatureCell>Policy-Based Governance</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
              </HighlightedRow>

              <HighlightedRow>
                <FeatureCell>Full Healing Transparency</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><PartialText>Partial</PartialText></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
              </HighlightedRow>

              <Tr>
                <FeatureCell>AI Test Generation</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
              </Tr>

              <HighlightedRow>
                <FeatureCell>Element Health Analytics</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><PartialText>Partial</PartialText></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
              </HighlightedRow>

              <Tr>
                <FeatureCell>Selenium Integration</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><PartialText>Export</PartialText></IconCell>
              </Tr>

              <HighlightedRow>
                <FeatureCell>Self-Hosted Deployment</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><CheckIcon size={24} /></IconCell>
              </HighlightedRow>

              <HighlightedRow>
                <FeatureCell>Governance & Audit Support</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
              </HighlightedRow>

              <Tr>
                <FeatureCell>No-Code Recording</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><CheckIcon size={24} /></IconCell>
              </Tr>

              <HighlightedRow>
                <FeatureCell>Human-in-the-Loop Reviews</FeatureCell>
                <IconCell><CheckIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
                <IconCell><XIcon size={24} /></IconCell>
              </HighlightedRow>
            </Tbody>
          </Table>
        </TableWrapper>
      </ContentWrapper>
    </SectionContainer>
  );
};
