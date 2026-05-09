import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import styled, { keyframes } from 'styled-components';
import { config } from '../app/config';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UpgradeInfo {
  /** Human-readable message from the backend, e.g. "Monthly test run limit reached …" */
  message: string;
  /** Which limit was hit (derived from message keywords) */
  limitType: 'test_runs' | 'team_members' | 'projects' | 'ai_requests' | 'generic';
}

interface UpgradeModalContextValue {
  /** Call this from any API error handler with the backend detail string */
  showUpgradeModal: (message: string) => void;
}

const UpgradeModalContext = createContext<UpgradeModalContextValue>({
  showUpgradeModal: () => {},
});

export const useUpgradeModal = () => useContext(UpgradeModalContext);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Returns true when the error string looks like a subscription-limit error */
export function isSubscriptionLimitError(message: string): boolean {
  const lower = (message || '').toLowerCase();
  return (
    lower.includes('limit reached') ||
    lower.includes('upgrade your subscription') ||
    lower.includes('upgrade your plan') ||
    lower.includes('plan limit') ||
    lower.includes('subscription inactive') ||
    lower.includes('monthly test run limit') ||
    lower.includes('team member limit') ||
    lower.includes('project limit')
  );
}

function deriveLimitType(msg: string): UpgradeInfo['limitType'] {
  const l = msg.toLowerCase();
  if (l.includes('test run')) return 'test_runs';
  if (l.includes('team member')) return 'team_members';
  if (l.includes('project')) return 'projects';
  if (l.includes('ai request') || l.includes('ai_request')) return 'ai_requests';
  return 'generic';
}

const LIMIT_ICONS: Record<UpgradeInfo['limitType'], string> = {
  test_runs: '🚀',
  team_members: '👥',
  projects: '📁',
  ai_requests: '🤖',
  generic: '⚡',
};

const LIMIT_TITLES: Record<UpgradeInfo['limitType'], string> = {
  test_runs: 'Test Run Limit Reached',
  team_members: 'Team Member Limit Reached',
  projects: 'Project Limit Reached',
  ai_requests: 'AI Request Limit Reached',
  generic: 'Plan Limit Reached',
};

const PLAN_FEATURES = [
  { plan: 'Starter', price: '$29/mo', runs: '1,000 runs', members: '5 members', projects: '5 projects' },
  { plan: 'Professional', price: '$99/mo', runs: 'Unlimited', members: '10 members', projects: '20 projects' },
  { plan: 'Enterprise', price: 'Custom', runs: 'Unlimited', members: 'Unlimited', projects: 'Unlimited' },
];

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export const UpgradeModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [info, setInfo] = useState<UpgradeInfo | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const showUpgradeModal = useCallback((message: string) => {
    setInfo({ message, limitType: deriveLimitType(message) });
  }, []);

  // Listen for subscription-limit-error events dispatched by API clients
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail && isSubscriptionLimitError(detail)) {
        showUpgradeModal(detail);
      }
    };
    window.addEventListener('subscription-limit-error', handler);
    return () => window.removeEventListener('subscription-limit-error', handler);
  }, [showUpgradeModal]);

  const handleClose = () => setInfo(null);

  const handleUpgrade = async () => {
    setPortalLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${config.apiBaseUrl}/api/v1/billing/portal-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ return_url: window.location.href }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
        return;
      }
    } catch {
      // Portal not available
    } finally {
      setPortalLoading(false);
    }
    // Fallback: navigate to org settings (billing tab)
    window.location.href = '/app/organization';
  };

  return (
    <UpgradeModalContext.Provider value={{ showUpgradeModal }}>
      {children}
      {info && (
        <Overlay onClick={handleClose}>
          <Modal onClick={(e) => e.stopPropagation()}>
            <CloseBtn onClick={handleClose}>&times;</CloseBtn>

            <IconCircle>{LIMIT_ICONS[info.limitType]}</IconCircle>
            <Title>{LIMIT_TITLES[info.limitType]}</Title>
            <Detail>{info.message}</Detail>

            <Divider />

            <SectionTitle>Upgrade Your Plan</SectionTitle>
            <PlansGrid>
              {PLAN_FEATURES.map((p) => (
                <PlanCard key={p.plan}>
                  <PlanName>{p.plan}</PlanName>
                  <PlanPrice>{p.price}</PlanPrice>
                  <PlanFeature>{p.runs}</PlanFeature>
                  <PlanFeature>{p.members}</PlanFeature>
                  <PlanFeature>{p.projects}</PlanFeature>
                </PlanCard>
              ))}
            </PlansGrid>

            <ButtonRow>
              <UpgradeButton onClick={handleUpgrade} disabled={portalLoading}>
                {portalLoading ? 'Redirecting…' : 'Upgrade Now'}
              </UpgradeButton>
              <DismissButton onClick={handleClose}>Maybe Later</DismissButton>
            </ButtonRow>
          </Modal>
        </Overlay>
      )}
    </UpgradeModalContext.Provider>
  );
};

/* ------------------------------------------------------------------ */
/*  Styled components                                                  */
/* ------------------------------------------------------------------ */

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`;
const slideUp = keyframes`from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  animation: ${fadeIn} 0.2s ease;
`;

const Modal = styled.div`
  position: relative;
  background: #1e1e2e;
  border: 1px solid #333;
  border-radius: 16px;
  padding: 40px 36px 32px;
  max-width: 560px;
  width: 90%;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  animation: ${slideUp} 0.25s ease;
`;

const CloseBtn = styled.button`
  position: absolute;
  top: 14px;
  right: 18px;
  background: none;
  border: none;
  color: #666;
  font-size: 24px;
  cursor: pointer;
  &:hover { color: #aaa; }
`;

const IconCircle = styled.div`
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
`;

const Title = styled.h2`
  color: #fff;
  text-align: center;
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
`;

const Detail = styled.p`
  color: #f87171;
  text-align: center;
  margin: 0 0 20px;
  font-size: 13px;
  line-height: 1.5;
  background: rgba(248, 113, 113, 0.08);
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: 8px;
  padding: 10px 16px;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid #333;
  margin: 0 0 20px;
`;

const SectionTitle = styled.h3`
  color: #ccc;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PlansGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
`;

const PlanCard = styled.div`
  background: #262636;
  border: 1px solid #3a3a4a;
  border-radius: 10px;
  padding: 16px 12px;
  text-align: center;
  transition: border-color 0.2s;
  &:hover {
    border-color: #6366f1;
  }
`;

const PlanName = styled.div`
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 4px;
`;

const PlanPrice = styled.div`
  color: #6366f1;
  font-weight: 700;
  font-size: 18px;
  margin-bottom: 10px;
`;

const PlanFeature = styled.div`
  color: #999;
  font-size: 12px;
  line-height: 1.8;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
`;

const UpgradeButton = styled.button`
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 36px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  &:hover:not(:disabled) { opacity: 0.9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const DismissButton = styled.button`
  background: transparent;
  color: #888;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;
  &:hover { border-color: #666; color: #bbb; }
`;
