import React, { useEffect, useState, ReactNode } from 'react';
import styled from 'styled-components';

interface SubscriptionStatus {
  is_active: boolean;
  plan_tier: string;
  subscription_status: string;
  billing_inactive: boolean;
  trial_expired: boolean;
  payment_issue: boolean;
}

interface SubscriptionGateProps {
  children: ReactNode;
}

import { config } from '../../app/config';

const API_BASE = config.apiBaseUrl;

/**
 * Wraps protected content and blocks the UI when the user's subscription
 * is canceled, expired, or unpaid.  Shows a full-screen overlay directing
 * them to renew via the Stripe customer portal.
 */
const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      // Not authenticated — let PrivateRoute handle redirect
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/api/v1/billing/subscription-status`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch subscription status');
        return res.json();
      })
      .then((data: SubscriptionStatus) => setStatus(data))
      .catch(() => {
        // If the endpoint is unreachable (e.g. no billing configured), allow access
        setStatus({ is_active: true, plan_tier: 'community', subscription_status: 'active', billing_inactive: false, trial_expired: false, payment_issue: false });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE}/api/v1/billing/portal-session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_url: window.location.origin }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      }
    } catch {
      // Portal not available — show fallback message
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) return null;

  if (status && !status.is_active) {
    return (
      <Overlay>
        <Card>
          <Icon>⚠️</Icon>
          <Title>Subscription Inactive</Title>
          <Message>
            {status.trial_expired
              ? 'Your free trial has expired.'
              : status.billing_inactive
              ? 'Your subscription has been canceled or is unpaid.'
              : 'There is a payment issue with your subscription.'}
          </Message>
          <Message>Please renew or upgrade your plan to continue using FluxTest.</Message>
          <ActionButton onClick={handleManageBilling} disabled={portalLoading}>
            {portalLoading ? 'Redirecting…' : 'Manage Subscription'}
          </ActionButton>
          <LogoutLink
            onClick={() => {
              localStorage.removeItem('auth_token');
              window.location.href = '/onboarding';
            }}
          >
            Log out
          </LogoutLink>
        </Card>
      </Overlay>
    );
  }

  return <>{children}</>;
};

export default SubscriptionGate;

/* ---------- styled-components ---------- */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
`;

const Card = styled.div`
  background: #1e1e2e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 48px 40px;
  max-width: 440px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
`;

const Icon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
`;

const Title = styled.h2`
  color: #fff;
  margin: 0 0 12px;
  font-size: 22px;
`;

const Message = styled.p`
  color: #aaa;
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.5;
`;

const ActionButton = styled.button`
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 32px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
  &:hover:not(:disabled) {
    background: #4f46e5;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const LogoutLink = styled.button`
  display: block;
  margin: 16px auto 0;
  background: none;
  border: none;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  &:hover {
    color: #bbb;
  }
`;
