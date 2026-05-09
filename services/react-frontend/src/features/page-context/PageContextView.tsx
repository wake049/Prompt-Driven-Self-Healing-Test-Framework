import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Edit, X, Calendar, Globe, Target, FileText, Image as ImageIcon, Smartphone, Search, Loader2 } from 'lucide-react';

// ================================
// Styled Components (matching existing app patterns)
// ================================

const Container = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  overflow: hidden;
`;

const Header = styled.div`
  background: #f8f9fa;
  padding: 24px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const HeaderContent = styled.div`
  flex: 1;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const Title = styled.h1`
  margin: 0;
  color: #2c3e50;
  font-size: 1.75rem;
  font-weight: 600;
`;

const TypeBadge = styled.span<{ pageType: string }>`
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 0.8rem;
  font-weight: 600;
  background: ${props => {
    const colors: Record<string, string> = {
      ecommerce: '#d4edda',
      airline: '#d1ecf1',
      banking: '#fff3cd',
      form: '#e2e3ff',
      news: '#f8d7da',
      social: '#fce4ec',
      search: '#f8f9fa',
      streaming: '#e1f5fe',
      'mobile-android': '#e8f5e9',
      'mobile-ios': '#f3e5f5',
      'mobile-web': '#e0f2f1',
      other: '#f8f9fa'
    };
    return colors[props.pageType] || colors.other;
  }};
  color: ${props => {
    const colors: Record<string, string> = {
      ecommerce: '#155724',
      airline: '#0c5460',
      banking: '#856404',
      form: '#3e4094',
      news: '#721c24',
      social: '#880e4f',
      search: '#6c757d',
      streaming: '#01579b',
      'mobile-android': '#2e7d32',
      'mobile-ios': '#6a1b9a',
      'mobile-web': '#00695c',
      other: '#6c757d'
    };
    return colors[props.pageType] || colors.other;
  }};
`;

const MetadataRow = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 0.9rem;
  color: #6c757d;
`;

const MetadataItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MetadataLink = styled.a`
  color: #007bff;
  text-decoration: none;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  &:hover {
    color: #0056b3;
    text-decoration: underline;
  }
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  ${props => {
    if (props.variant === 'primary') {
      return `
        background: #007bff;
        color: white;
        &:hover { background: #0056b3; }
      `;
    }
    return `
      background: white;
      color: #6c757d;
      border: 1px solid #dee2e6;
      &:hover {
        background: #f8f9fa;
        color: #495057;
      }
    `;
  }}
`;

const CloseButton = styled.button`
  padding: 8px;
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  border-radius: 4px;
  
  &:hover {
    background: #f8f9fa;
    color: #495057;
  }
`;

const Content = styled.div`
  padding: 24px;
`;

const Section = styled.div`
  margin-bottom: 32px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 1.2rem;
  font-weight: 600;
`;

const SectionDescription = styled.p`
  color: #495057;
  line-height: 1.6;
  margin: 0;
`;

const ScreenshotContainer = styled.div`
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  background: #f8f9fa;
`;

const ScreenshotImage = styled.img`
  width: 100%;
  max-height: 400px;
  object-fit: contain;
  background: #f8f9fa;
`;

const ActionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
`;

const ActionItem = styled.div`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
`;

const ActionDot = styled.div`
  width: 8px;
  height: 8px;
  background: #007bff;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
`;

const ActionText = styled.span`
  color: #495057;
  font-weight: 500;
`;

const FocusBox = styled.div`
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  border-radius: 8px;
  padding: 16px;
`;

const FocusText = styled.p`
  color: #1565c0;
  margin: 0;
  line-height: 1.5;
`;

const NotesBox = styled.div`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
`;

const NotesText = styled.p`
  color: #495057;
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.5;
`;

const MetadataSection = styled.div`
  border-top: 1px solid #e9ecef;
  padding-top: 24px;
`;

const MetadataGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  font-size: 0.9rem;
`;

const MetadataField = styled.div``;

const MetadataLabel = styled.span`
  font-weight: 600;
  color: #495057;
  display: block;
  margin-bottom: 4px;
`;

const MetadataValue = styled.p`
  color: #6c757d;
  margin: 0;
`;

// --- Mobile Elements Section ---

const MobileSection = styled.div`
  margin-bottom: 32px;
  border: 1px solid #e9ecef;
  border-radius: 10px;
  overflow: hidden;
`;

const MobileSectionHeader = styled.div`
  background: #f0f7ff;
  padding: 16px 20px;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const MobileSectionTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e40af;
`;

const MobileSectionBody = styled.div`
  padding: 16px 20px;
`;

const GatherRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
`;

const ConfigSelect = styled.select`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
`;

const GatherButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  background: #059669;
  color: #fff;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  &:hover { background: #047857; }
  &:disabled { background: #9ca3af; cursor: not-allowed; }
`;

const ElementsList = styled.div`
  max-height: 400px;
  overflow-y: auto;
`;

const ElementRow = styled.div<{ interactive?: boolean }>`
  padding: 8px 12px;
  border: 1px solid ${p => p.interactive ? '#bbf7d0' : '#e5e7eb'};
  border-radius: 6px;
  margin-bottom: 6px;
  background: ${p => p.interactive ? '#f0fdf4' : '#fafafa'};
  font-size: 13px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ElementTag = styled.span`
  font-family: monospace;
  font-size: 12px;
  padding: 2px 6px;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 4px;
`;

const ElementSelector = styled.span`
  font-family: monospace;
  font-size: 11px;
  color: #6b7280;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StatBadge = styled.span`
  font-size: 12px;
  padding: 2px 8px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 10px;
  font-weight: 500;
`;

const GatherError = styled.div`
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #991b1b;
  font-size: 13px;
  margin-bottom: 12px;
`;

const EmptyState = styled.p`
  color: #6c757d;
  text-align: center;
  margin: 20px 0;
  font-size: 14px;
`;

// ================================
// Types
// ================================

interface PageContextItem {
  id: string;
  pageUrl: string;
  pageTitle: string;
  pageType: string;
  pageDescription: string;
  screenshotUrl?: string;
  primaryActions: string[];
  testingFocus?: string;
  userNotes?: string;
  createdAt: string;
  createdBy?: string;
  usageCount: number;
}

interface AppiumConfigOption {
  id: string;
  name: string;
  config_type: string;
}

interface GatheredElement {
  tag: string;
  text: string | null;
  interactive: boolean;
  selectors: Record<string, string>;
}

interface PageContextViewProps {
  context: PageContextItem;
  onEdit: () => void;
  onClose: () => void;
}

// ================================
// Component
// ================================

export const PageContextView: React.FC<PageContextViewProps> = ({
  context,
  onEdit,
  onClose
}) => {
  // --- Mobile element gathering state ---
  const [appiumConfigs, setAppiumConfigs] = useState<AppiumConfigOption[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [gathering, setGathering] = useState(false);
  const [gatherError, setGatherError] = useState<string | null>(null);
  const [gatheredElements, setGatheredElements] = useState<GatheredElement[]>([]);
  const [gatherStats, setGatherStats] = useState<Record<string, number> | null>(null);
  const [storedElements, setStoredElements] = useState<any[]>([]);

  // Fetch Appium configs on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch('/api/v1/appium-configs', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setAppiumConfigs(data);
        if (data.length > 0) setSelectedConfigId(data[0].id);
      })
      .catch(() => {});
  }, []);

  // Fetch stored elements for this page context
  useEffect(() => {
    if (!context.id) return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch(`/api/v1/page-context/${context.id}/elements`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.elements) setStoredElements(data.elements);
      })
      .catch(() => {});
  }, [context.id]);

  const handleGather = async () => {
    if (!selectedConfigId || !context.id) return;
    setGathering(true);
    setGatherError(null);
    setGatheredElements([]);
    setGatherStats(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/v1/page-context/${context.id}/gather-elements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ appium_config_id: selectedConfigId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGatherError(data.detail || 'Failed to gather elements');
      } else {
        setGatheredElements(data.elements || []);
        setGatherStats(data.stats || null);
        // Refresh stored elements
        const elemRes = await fetch(`/api/v1/page-context/${context.id}/elements`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (elemRes.ok) {
          const elemData = await elemRes.json();
          if (elemData?.elements) setStoredElements(elemData.elements);
        }
      }
    } catch (e: any) {
      setGatherError(e.message || 'Network error');
    } finally {
      setGathering(false);
    }
  };
  const pageTypeLabels: Record<string, string> = {
    ecommerce: 'E-commerce',
    airline: 'Airlines',
    banking: 'Banking',
    form: 'Forms',
    news: 'News',
    social: 'Social Media',
    search: 'Search',
    streaming: 'Streaming',
    'mobile-android': 'Android App',
    'mobile-ios': 'iOS App',
    'mobile-web': 'Mobile Web',
    other: 'Other',
  };

  return (
    <Container>
      {/* Header */}
      <Header>
        <HeaderContent>
          <TitleRow>
            <Title>{context.pageTitle}</Title>
            <TypeBadge pageType={context.pageType}>
              {pageTypeLabels[context.pageType] || 'Other'}
            </TypeBadge>
          </TitleRow>
          
          <MetadataRow>
            <MetadataItem>
              <Globe size={16} />
              <MetadataLink
                href={context.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {context.pageUrl}
              </MetadataLink>
            </MetadataItem>
            
            <MetadataItem>
              <Calendar size={16} />
              {new Date(context.createdAt).toLocaleDateString()}
            </MetadataItem>
            
            <MetadataItem>
              Used {context.usageCount} times
            </MetadataItem>
          </MetadataRow>
        </HeaderContent>

        <HeaderActions>
          <ActionButton variant="primary" onClick={onEdit}>
            <Edit size={16} />
            Edit
          </ActionButton>
          
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </HeaderActions>
      </Header>

      {/* Content */}
      <Content>
        {/* Screenshot */}
        {context.screenshotUrl && (
          <Section>
            <SectionTitle>
              <ImageIcon size={20} />
              Screenshot
            </SectionTitle>
            <ScreenshotContainer>
              <ScreenshotImage
                src={context.screenshotUrl}
                alt={context.pageTitle}
              />
            </ScreenshotContainer>
          </Section>
        )}

        {/* Description */}
        <Section>
          <SectionTitle>
            <FileText size={20} />
            Description
          </SectionTitle>
          <SectionDescription>
            {context.pageDescription}
          </SectionDescription>
        </Section>

        {/* Primary Actions */}
        {context.primaryActions.length > 0 && (
          <Section>
            <SectionTitle>
              <Target size={20} />
              Primary Actions
            </SectionTitle>
            <ActionsGrid>
              {context.primaryActions.map((action, index) => (
                <ActionItem key={index}>
                  <ActionDot />
                  <ActionText>{action}</ActionText>
                </ActionItem>
              ))}
            </ActionsGrid>
          </Section>
        )}

        {/* Testing Focus */}
        {context.testingFocus && (
          <Section>
            <SectionTitle>
              Testing Focus
            </SectionTitle>
            <FocusBox>
              <FocusText>{context.testingFocus}</FocusText>
            </FocusBox>
          </Section>
        )}

        {/* User Notes */}
        {context.userNotes && (
          <Section>
            <SectionTitle>
              Additional Notes
            </SectionTitle>
            <NotesBox>
              <NotesText>{context.userNotes}</NotesText>
            </NotesBox>
          </Section>
        )}

        {/* Mobile Element Gathering */}
        <MobileSection>
          <MobileSectionHeader>
            <Smartphone size={18} />
            <MobileSectionTitle>Mobile Elements</MobileSectionTitle>
            {storedElements.length > 0 && (
              <StatBadge>{storedElements.length} stored</StatBadge>
            )}
          </MobileSectionHeader>
          <MobileSectionBody>
            {appiumConfigs.length > 0 ? (
              <>
                <GatherRow>
                  <ConfigSelect
                    value={selectedConfigId}
                    onChange={e => setSelectedConfigId(e.target.value)}
                    disabled={gathering}
                  >
                    {appiumConfigs.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.config_type})
                      </option>
                    ))}
                  </ConfigSelect>
                  <GatherButton onClick={handleGather} disabled={gathering || !selectedConfigId}>
                    {gathering ? (
                      <><Loader2 size={14} className="spin" /> Scanning…</>
                    ) : (
                      <><Search size={14} /> Gather Elements</>
                    )}
                  </GatherButton>
                </GatherRow>

                {gatherError && <GatherError>{gatherError}</GatherError>}

                {gatherStats && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <StatBadge>{gatherStats.total_elements || 0} found</StatBadge>
                    <StatBadge style={{ background: '#dcfce7', color: '#166534' }}>
                      {gatherStats.interactive_elements || 0} interactive
                    </StatBadge>
                    <StatBadge style={{ background: '#fef3c7', color: '#92400e' }}>
                      {gatherStats.stored_count || 0} stored
                    </StatBadge>
                  </div>
                )}

                {gatheredElements.length > 0 && (
                  <ElementsList>
                    {gatheredElements.map((el, i) => (
                      <ElementRow key={i} interactive={el.interactive}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          <ElementTag>{el.tag}</ElementTag>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {el.text || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>no text</span>}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {el.interactive && <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>interactive</span>}
                          <ElementSelector title={Object.values(el.selectors || {})[0] as string}>
                            {(Object.values(el.selectors || {})[0] as string) || '—'}
                          </ElementSelector>
                        </div>
                      </ElementRow>
                    ))}
                  </ElementsList>
                )}

                {gatheredElements.length === 0 && storedElements.length > 0 && (
                  <ElementsList>
                    {storedElements.map((el) => (
                      <ElementRow key={el.id} interactive={el.attributes?.interactive === 'True'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          <ElementTag>{el.attributes?.tag || '?'}</ElementTag>
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {el.attributes?.text || el.name}
                          </span>
                        </div>
                        <ElementSelector title={JSON.stringify(el.primary_selector)}>
                          {Object.values(el.primary_selector || {})[0] as string || '—'}
                        </ElementSelector>
                      </ElementRow>
                    ))}
                  </ElementsList>
                )}

                {gatheredElements.length === 0 && storedElements.length === 0 && !gathering && (
                  <EmptyState>
                    No elements gathered yet. Select an Appium config and click "Gather Elements" to scan the current mobile screen.
                  </EmptyState>
                )}
              </>
            ) : (
              <EmptyState>
                No Appium configurations found. Create one in the Appium Testing page first.
              </EmptyState>
            )}
          </MobileSectionBody>
        </MobileSection>

        {/* Metadata */}
        <MetadataSection>
          <SectionTitle>
            Context Information
          </SectionTitle>
          <MetadataGrid>
            <MetadataField>
              <MetadataLabel>Created:</MetadataLabel>
              <MetadataValue>
                {new Date(context.createdAt).toLocaleString()}
              </MetadataValue>
            </MetadataField>
            
            {context.createdBy && (
              <MetadataField>
                <MetadataLabel>Created by:</MetadataLabel>
                <MetadataValue>{context.createdBy}</MetadataValue>
              </MetadataField>
            )}
            
            <MetadataField>
              <MetadataLabel>Usage:</MetadataLabel>
              <MetadataValue>
                Used {context.usageCount} time{context.usageCount !== 1 ? 's' : ''}
              </MetadataValue>
            </MetadataField>
          </MetadataGrid>
        </MetadataSection>
      </Content>
    </Container>
  );
};