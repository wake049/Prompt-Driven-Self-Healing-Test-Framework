import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { Users, UserPlus, Shield, CreditCard, Crown, Mail, Trash2, CheckCircle, XCircle, AlertCircle, PauseCircle, PlayCircle, Key, Server, Copy, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { calculateCustomEstimateByPeriod } from '../subscription/customPricing';
import { config } from '../../app/config';

const Container = styled.div`
  padding: 32px 40px;
`;

const Header = styled.div`
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
`;

const Subtitle = styled.p`
  font-size: 14px;
  color: #666;
  margin: 0;
`;

const TabContainer = styled.div`
  display: flex;
  gap: 8px;
  border-bottom: 2px solid #e9ecef;
  margin-bottom: 32px;
`;

const Tab = styled.button<{ $active?: boolean }>`
  padding: 12px 24px;
  background: ${props => props.$active ? '#0066cc' : 'transparent'};
  color: ${props => props.$active ? 'white' : '#666'};
  border: none;
  border-radius: 8px 8px 0 0;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$active ? '#0066cc' : '#f8f9fa'};
    color: ${props => props.$active ? 'white' : '#333'};
  }
`;

const Card = styled.div`
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const CardTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 10px 20px;
  background: ${props => 
    props.$variant === 'danger' ? '#dc3545' :
    props.$variant === 'secondary' ? '#6c757d' : '#0066cc'};
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  text-align: left;
  padding: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  border-bottom: 2px solid #e9ecef;
`;

const Td = styled.td`
  padding: 16px 12px;
  font-size: 14px;
  color: #333;
  border-bottom: 1px solid #f8f9fa;
`;

const Badge = styled.span<{ $status?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => {
    switch(props.$status) {
      case 'active': return '#d4edda';
      case 'invited': return '#fff3cd';
      case 'suspended': return '#f8d7da';
      default: return '#e9ecef';
    }
  }};
  color: ${props => {
    switch(props.$status) {
      case 'active': return '#155724';
      case 'invited': return '#856404';
      case 'suspended': return '#721c24';
      default: return '#495057';
    }
  }};
`;

const RoleBadge = styled.span<{ $role?: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => {
    switch(props.$role) {
      case 'owner': return '#6f42c1';
      case 'admin': return '#0066cc';
      case 'member': return '#28a745';
      case 'viewer': return '#6c757d';
      default: return '#e9ecef';
    }
  }};
  color: white;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const IconButton = styled.button`
  padding: 6px;
  background: transparent;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  color: #6c757d;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f8f9fa;
    border-color: #adb5bd;
    color: #495057;
  }
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 12px;
  padding: 32px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  margin-bottom: 24px;
`;

const ModalTitle = styled.h3`
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 8px 0;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-size: 14px;
  font-weight: 600;
  color: #333;
`;

const Input = styled.input`
  padding: 10px 16px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 14px;
  color: #333;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }
`;

const Select = styled.select`
  padding: 10px 16px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font-size: 14px;
  color: #333;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 8px;
`;

const SubscriptionCard = styled.div`
  background: #185FA5;
  color: white;
  border-radius: 12px;
  padding: 32px;
  margin-bottom: 24px;
`;

const PlanTitle = styled.h3`
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px 0;
`;

const PlanPrice = styled.div`
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 24px;
`;

const FeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 24px 0;
`;

const Feature = styled.li`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: 14px;
`;

const SectionTitle = styled.h3`
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
`;

const SectionHint = styled.p`
  margin: 0 0 16px 0;
  font-size: 13px;
  color: #666;
`;

const InlineActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

interface Member {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  joined_at: string;
}

interface AiProviderConfig {
  id: string;
  provider: string;
  provider_name: string;
  model: string;
  api_key_last_4: string;
  is_active: boolean;
  is_default: boolean;
  is_verified: boolean;
  total_requests: number;
  last_used_at: string | null;
  created_at: string;
}

interface AiProviderForm {
  provider: string;
  provider_name: string;
  api_key: string;
  model: string;
  endpoint_url: string;
  temperature: string;
  max_tokens: string;
  is_default: boolean;
}

const OrganizationSettings: React.FC = () => {
  const { user, tenant, project, token, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'roles' | 'subscription' | 'ai' | 'license'>('members');
  const [members, setMembers] = useState<Member[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInviteLinkModal, setShowInviteLinkModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editRole, setEditRole] = useState<'owner' | 'admin' | 'member' | 'viewer'>('member');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [invitationLink, setInvitationLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [subscriptionActionLoading, setSubscriptionActionLoading] = useState<string | null>(null);
  const [organizationActionLoading, setOrganizationActionLoading] = useState<string | null>(null);
  const [orgConfirmSlug, setOrgConfirmSlug] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Subscription and usage data
  const [subscription, setSubscription] = useState<any>(null);
  const [usageStats, setUsageStats] = useState<any>(null);

  // License state
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);
  const [issuedLicenseKey, setIssuedLicenseKey] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('manual_revoke');
  const [licenseNotes, setLicenseNotes] = useState('');

  const [aiProviders, setAiProviders] = useState<AiProviderConfig[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const [aiSelectedProviderId, setAiSelectedProviderId] = useState<string | null>(null);
  const [aiForm, setAiForm] = useState<AiProviderForm>({
    provider: 'openai',
    provider_name: 'OpenAI Configuration',
    api_key: '',
    model: 'gpt-4o',
    endpoint_url: '',
    temperature: '0.1',
    max_tokens: '4000',
    is_default: true,
  });

  const planTier = useMemo(() => {
    if (!subscription?.plan_tier) return undefined;
    return subscription.plan_tier === 'free' ? 'community' : subscription.plan_tier;
  }, [subscription?.plan_tier]);

  const hasUnlimitedTeamMembers = (usageStats?.team_member_limit ?? 0) >= 9999;
  const availableSeats = hasUnlimitedTeamMembers
    ? 'Unlimited seats'
    : `${Math.max((usageStats?.team_member_limit ?? 1) - (usageStats?.team_members ?? 0), 0)} seats available`;

  const customPriceEstimate = useMemo(() => {
    if (planTier !== 'custom') {
      return null;
    }

    const billingPeriod = subscription?.billing_interval === 'yearly' ? 'year' : 'month';
    return calculateCustomEstimateByPeriod(
      {
        maxTeamMembers: subscription?.max_team_members,
        maxProjects: subscription?.max_projects,
        monthlyTestRunsLimit: subscription?.monthly_test_runs_limit,
        monthlyAiRequestsLimit: subscription?.monthly_ai_requests_limit,
      },
      billingPeriod
    );
  }, [
    planTier,
    subscription?.billing_interval,
    subscription?.max_team_members,
    subscription?.max_projects,
    subscription?.monthly_test_runs_limit,
    subscription?.monthly_ai_requests_limit,
  ]);

  const trialMessage = useMemo(() => {
    if (!subscription || subscription.status !== 'trial') {
      return null;
    }

    if (subscription.trial_expired) {
      return 'Trial ended. Your organization is currently on community limits until upgraded.';
    }

    if (typeof subscription.trial_days_remaining === 'number') {
      return `${subscription.trial_days_remaining} trial day${subscription.trial_days_remaining === 1 ? '' : 's'} remaining.`;
    }

    return 'Trial is active.';
  }, [subscription]);

  const defaultModelForProvider = (provider: string) => {
    switch (provider) {
      case 'anthropic':
        return 'claude-3-5-sonnet-20241022';
      case 'google':
        return 'gemini-2.0-flash-exp';
      case 'azure':
        return 'gpt-4o';
      case 'ollama':
        return 'llama3.1:8b';
      default:
        return 'gpt-4o';
    }
  };

  const loadAiProviders = async () => {
    if (!tenant?.id || !token) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/ai-providers/list?tenant_id=${tenant.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to load AI providers.'));
      }

      const data = await response.json();
      setAiProviders(data);

      const activeProvider = data.find((provider: AiProviderConfig) => provider.is_default);
      if (activeProvider) {
        setAiSelectedProviderId(activeProvider.id);
      }
    } catch (err: any) {
      setAiError(err?.message || 'Unable to load AI providers right now.');
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai') {
      loadAiProviders();
    }
  }, [activeTab, tenant?.id, token]);

  const handleAiProviderChange = (provider: string) => {
    setAiForm(prev => ({
      ...prev,
      provider,
      provider_name: prev.provider_name || `${provider.charAt(0).toUpperCase()}${provider.slice(1)} Configuration`,
      model: defaultModelForProvider(provider),
      endpoint_url: provider === 'ollama' ? prev.endpoint_url || 'http://localhost:11434' : prev.endpoint_url,
    }));
  };

  const handleCreateAiProvider = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!tenant?.id || !token) {
      setAiError('Organization context is missing.');
      return;
    }

    if (!aiForm.api_key.trim() && aiForm.provider !== 'ollama') {
      setAiError('API key is required for this provider.');
      return;
    }

    setAiSaving(true);
    setAiError(null);
    setAiSuccess(null);

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/ai-providers/create?tenant_id=${tenant.id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: aiForm.provider,
            provider_name: aiForm.provider_name.trim() || `${aiForm.provider.charAt(0).toUpperCase()}${aiForm.provider.slice(1)} Configuration`,
            api_key: aiForm.provider === 'ollama' ? aiForm.api_key || 'ollama' : aiForm.api_key,
            model: aiForm.model.trim() || defaultModelForProvider(aiForm.provider),
            endpoint_url: aiForm.endpoint_url.trim() || undefined,
            temperature: Number(aiForm.temperature) || 0.1,
            max_tokens: Number(aiForm.max_tokens) || 4000,
            is_default: aiForm.is_default,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to create provider configuration.'));
      }

      const data = await response.json();
      setAiSuccess(data?.message || 'Provider configuration created successfully.');
      setAiForm({
        provider: 'openai',
        provider_name: 'OpenAI Configuration',
        api_key: '',
        model: 'gpt-4o',
        endpoint_url: '',
        temperature: '0.1',
        max_tokens: '4000',
        is_default: true,
      });
      await loadAiProviders();
    } catch (err: any) {
      setAiError(err?.message || 'Unable to create provider configuration.');
    } finally {
      setAiSaving(false);
    }
  };

  const handleSetDefaultAiProvider = async (providerId: string) => {
    if (!tenant?.id || !token) {
      setAiError('Organization context is missing.');
      return;
    }

    setAiSaving(true);
    setAiError(null);
    setAiSuccess(null);

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/ai-providers/set-default?tenant_id=${tenant.id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ provider_id: providerId }),
        }
      );

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Failed to update default provider.'));
      }

      const data = await response.json();
      setAiSuccess(data?.message || 'Default provider updated successfully.');
      await loadAiProviders();
    } catch (err: any) {
      setAiError(err?.message || 'Unable to update the default provider.');
    } finally {
      setAiSaving(false);
    }
  };

  // Fetch real members from API
  useEffect(() => {
    const fetchMembers = async () => {
      if (!tenant?.id || !token) return;
      
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/api/v1/team/organizations/${tenant.id}/members`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setMembers(data.map((member: any) => ({
            id: member.id || member.user_id,
            user_id: member.user_id,
            email: member.email,
            full_name: member.full_name,
            role: member.role,
            status: member.status,
            joined_at: member.joined_at || member.invited_at
          })));
        } else {
          console.error('Failed to fetch members');
        }
      } catch (error) {
        console.error('Error fetching members:', error);
      }
    };

    fetchMembers();
  }, [tenant?.id, token]);

  // Fetch subscription and usage data
  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!token) return;
      
      try {
        // Fetch current subscription
        const subResponse = await fetch(
          `${config.apiBaseUrl}/api/v1/subscriptions/current`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (subResponse.ok) {
          const subData = await subResponse.json();
          setSubscription(subData);
        }

        // Fetch usage stats
        const usageResponse = await fetch(
          `${config.apiBaseUrl}/api/v1/usage/stats`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          setUsageStats(usageData);
        }
      } catch (error) {
        console.error('Error fetching subscription data:', error);
      }
    };

    fetchSubscriptionData();
  }, [token]);

  // Fetch self-host license status
  const fetchLicenseStatus = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/v1/licensing/self-host/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setLicenseStatus(data);
      } else if (response.status === 403) {
        setLicenseStatus({ entitlement_active: false, entitlement_reason: 'not_authorized', license_present: false });
      }
    } catch (err) {
      console.error('Error fetching license status:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'license') {
      fetchLicenseStatus();
    }
  }, [activeTab, token]);

  const handleIssueLicense = async () => {
    if (!token) return;
    setLicenseLoading(true);
    setLicenseError(null);
    setLicenseSuccess(null);
    setIssuedLicenseKey(null);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/v1/licensing/self-host/issue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes: licenseNotes || null }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.detail || 'Failed to issue license');
      }
      const data = await response.json();
      setIssuedLicenseKey(data.license_key);
      setLicenseSuccess('License issued successfully. Copy the key now — it will not be shown again.');
      setLicenseNotes('');
      await fetchLicenseStatus();
    } catch (err: any) {
      setLicenseError(err?.message || 'Unable to issue license.');
    } finally {
      setLicenseLoading(false);
    }
  };

  const handleRevokeLicense = async () => {
    if (!token) return;
    if (!window.confirm('Revoke the active self-host license? Deployed instances will stop passing validation.')) return;
    setLicenseLoading(true);
    setLicenseError(null);
    setLicenseSuccess(null);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/v1/licensing/self-host/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: revokeReason }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.detail || 'Failed to revoke license');
      }
      const data = await response.json();
      setLicenseSuccess(data.revoked ? 'License revoked.' : 'No active license to revoke.');
      setRevokeReason('manual_revoke');
      await fetchLicenseStatus();
    } catch (err: any) {
      setLicenseError(err?.message || 'Unable to revoke license.');
    } finally {
      setLicenseLoading(false);
    }
  };

  const handleCopyLicenseKey = () => {
    if (issuedLicenseKey) {
      navigator.clipboard.writeText(issuedLicenseKey);
      setLicenseSuccess('License key copied to clipboard.');
    }
  };

  const handleManageSubscription = async () => {
    if (!token) {
      setError('You must be signed in to manage billing.');
      return;
    }

    setBillingLoading(true);
    setError(null);

    try {
      const apiBase = config.apiBaseUrl;
      const response = await fetch(`${apiBase}/api/v1/billing/portal-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          return_url: window.location.href,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to open billing portal');
      }

      if (!data?.url) {
        throw new Error('Billing portal URL is missing');
      }

      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || 'Unable to open billing portal right now.');
    } finally {
      setBillingLoading(false);
    }
  };

  const refreshSubscriptionData = async () => {
    if (!token) return;

    const apiBase = config.apiBaseUrl;

    const [subResponse, usageResponse] = await Promise.all([
      fetch(`${apiBase}/api/v1/subscriptions/current`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }),
      fetch(`${apiBase}/api/v1/usage/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }),
    ]);

    if (subResponse.ok) {
      const subData = await subResponse.json();
      setSubscription(subData);
    }

    if (usageResponse.ok) {
      const usageData = await usageResponse.json();
      setUsageStats(usageData);
    }
  };

  const parseApiError = async (response: Response, fallback: string) => {
    try {
      const data = await response.json();
      return data?.detail || fallback;
    } catch {
      return fallback;
    }
  };

  const handleSubscriptionAction = async (
    action: 'pause' | 'resume' | 'cancel',
    options?: { cancel_at_period_end?: boolean }
  ) => {
    if (!token) {
      setError('You must be signed in to manage billing.');
      return;
    }

    const actionLabel = action === 'cancel'
      ? (options?.cancel_at_period_end === false ? 'cancel-now' : 'cancel-end')
      : action;

    setSubscriptionActionLoading(actionLabel);
    setActionSuccess(null);
    setError(null);

    try {
      const apiBase = config.apiBaseUrl;
      const response = await fetch(`${apiBase}/api/v1/billing/subscription/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: action === 'cancel' ? JSON.stringify({ cancel_at_period_end: options?.cancel_at_period_end !== false }) : undefined,
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Unable to update subscription status.'));
      }

      const data = await response.json();
      setActionSuccess(data?.message || 'Subscription updated successfully.');
      await refreshSubscriptionData();
    } catch (err: any) {
      setError(err?.message || 'Unable to update subscription status right now.');
    } finally {
      setSubscriptionActionLoading(null);
    }
  };

  const handleOrganizationDelete = async (hardDelete: boolean) => {
    if (!token || !tenant?.slug) {
      setError('Organization context is missing. Refresh and try again.');
      return;
    }

    const normalizedInput = orgConfirmSlug.trim().toLowerCase();
    const expectedSlug = tenant.slug.trim().toLowerCase();
    if (normalizedInput !== expectedSlug) {
      setError('Type your organization slug exactly to continue.');
      return;
    }

    const firstConfirm = hardDelete
      ? `This permanently deletes core organization records for ${tenant.slug}. Continue?`
      : `This deactivates ${tenant.slug}, cancels billing, and disables access. Continue?`;

    if (!window.confirm(firstConfirm)) {
      return;
    }

    if (hardDelete && !window.confirm('Final confirmation: hard delete is irreversible. Proceed?')) {
      return;
    }

    setOrganizationActionLoading(hardDelete ? 'hard-delete' : 'deactivate');
    setActionSuccess(null);
    setError(null);

    try {
      const apiBase = config.apiBaseUrl;
      const response = await fetch(`${apiBase}/api/v1/organizations/current`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          confirm_slug: tenant.slug,
          hard_delete: hardDelete,
        }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Unable to process organization deletion request.'));
      }

      const data = await response.json();
      setActionSuccess(data?.message || 'Organization action completed.');

      window.setTimeout(() => {
        logout();
        window.location.href = '/';
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Unable to process organization action right now.');
    } finally {
      setOrganizationActionLoading(null);
    }
  };


  const handleGenerateInviteLink = async () => {
    if (!tenant?.id || !token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/v1/team/organizations/${tenant.id}/invitation-tokens`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: inviteRole,
            expires_in_days: 7,
            max_uses: 0  // Unlimited uses
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setInvitationLink(data.invitation_link);
        setShowInviteModal(false);
        setShowInviteLinkModal(true);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to generate invitation link');
      }
    } catch (error) {
      console.error('Failed to generate invitation:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleGenerateInviteLink();
  };

  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(invitationLink);
    alert('Invitation link copied to clipboard!');
  };

  const handleRemoveMember = (memberId: string) => {
    if (confirm('Are you sure you want to remove this member?')) {
      setMembers(members.filter(m => m.id !== memberId));
    }
  };

  const handleChangeRole = (memberId: string, newRole: string) => {
    setMembers(members.map(m => 
      m.id === memberId ? { ...m, role: newRole as Member['role'] } : m
    ));
  };

  const handleUpdateRole = async () => {
    if (!editingMember || !tenant?.id || !token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/v1/team/organizations/${tenant.id}/members/${editingMember.id}/role`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ role: editRole }),
        }
      );

      if (response.ok) {
        // Update local state
        setMembers(members.map(m => 
          m.id === editingMember.id ? { ...m, role: editRole } : m
        ));
        
        // If transferring ownership, update current user role
        if (editRole === 'owner') {
          // Refresh the page to update auth context with new role
          window.location.reload();
        }
        
        setShowEditRoleModal(false);
        setEditingMember(null);
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to update role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      setError('An error occurred while updating the role');
    } finally {
      setLoading(false);
    }
  };

  const isOwnerOrAdmin = user && ['owner', 'admin'].includes(user.role || '');
  const currentUserRole = user?.role;
  const isOwner = currentUserRole === 'owner';

  return (
    <Container>
      <Header>
        <Title>{tenant?.name || 'Organization'} Settings</Title>
        <Subtitle>
          {tenant ? (
            <>
              Workspace: <code style={{ 
                background: '#f0f0f0', 
                padding: '2px 8px', 
                borderRadius: '4px',
                fontSize: '13px'
              }}>
                fluxtest.io/{tenant.slug}
              </code>
              {' • '}Manage your team, roles, and subscription
            </>
          ) : (
            'Manage your team, roles, and subscription'
          )}
        </Subtitle>
      </Header>

      <TabContainer>
        <Tab $active={activeTab === 'members'} onClick={() => setActiveTab('members')}>
          <Users size={16} />
          Members
        </Tab>
        <Tab $active={activeTab === 'roles'} onClick={() => setActiveTab('roles')}>
          <Shield size={16} />
          Roles & Permissions
        </Tab>
        <Tab $active={activeTab === 'subscription'} onClick={() => setActiveTab('subscription')}>
          <CreditCard size={16} />
          Subscription
        </Tab>
        <Tab $active={activeTab === 'ai'} onClick={() => setActiveTab('ai')}>
          <Server size={16} />
          AI Providers / BYOK
        </Tab>
        <Tab $active={activeTab === 'license'} onClick={() => setActiveTab('license')}>
          <Key size={16} />
          Self-Host License
        </Tab>
      </TabContainer>

      {activeTab === 'members' && (
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            {isOwnerOrAdmin && (
              <Button onClick={() => setShowInviteModal(true)}>
                <UserPlus size={16} />
                Invite Member
              </Button>
            )}
          </CardHeader>

          <Table>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                {isOwnerOrAdmin && <Th>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id}>
                  <Td>
                    <div>
                      <div style={{ fontWeight: 600 }}>{member.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{member.email}</div>
                    </div>
                  </Td>
                  <Td>
                    <RoleBadge $role={member.role}>
                      {member.role === 'owner' && <Crown size={12} />}
                      {member.role === 'admin' && <Shield size={12} />}
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </RoleBadge>
                  </Td>
                  <Td>
                    <Badge $status={member.status}>
                      {member.status === 'active' && <CheckCircle size={12} />}
                      {member.status === 'invited' && <Mail size={12} />}
                      {member.status === 'suspended' && <XCircle size={12} />}
                      {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                    </Badge>
                  </Td>
                  <Td>{new Date(member.joined_at).toLocaleDateString()}</Td>
                  {isOwnerOrAdmin && (
                    <Td>
                      <ActionButtons>
                        {(() => {
                          // Don't show edit for yourself unless you're the owner
                          if (member.user_id === user?.id && currentUserRole !== 'owner') {
                            return null;
                          }
                          // Don't show edit for owner unless you're the owner
                          if (member.role === 'owner' && currentUserRole !== 'owner') {
                            return null;
                          }
                          return (
                            <IconButton onClick={() => {
                              setEditingMember(member);
                              setEditRole(member.role);
                              setShowEditRoleModal(true);
                            }} title="Edit role">
                              <Shield size={14} />
                            </IconButton>
                          );
                        })()}
                        {member.role !== 'owner' && member.user_id !== user?.id && (
                          <IconButton onClick={() => handleRemoveMember(member.id)} title="Remove member">
                            <Trash2 size={14} />
                          </IconButton>
                        )}
                      </ActionButtons>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {activeTab === 'roles' && (
        <Card>
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
          </CardHeader>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <RoleBadge $role="owner" style={{ marginBottom: '8px' }}>
                <Crown size={12} />
                Owner
              </RoleBadge>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                Full access to all features, can manage organization settings, billing, and remove members
              </p>
            </div>
            
            <div>
              <RoleBadge $role="admin" style={{ marginBottom: '8px' }}>
                <Shield size={12} />
                Admin
              </RoleBadge>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                Can manage team members, configure policies, and access all testing features
              </p>
            </div>
            
            <div>
              <RoleBadge $role="member" style={{ marginBottom: '8px' }}>
                Member
              </RoleBadge>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                Can create and run tests, view analytics, and manage test elements
              </p>
            </div>
            
            <div>
              <RoleBadge $role="viewer" style={{ marginBottom: '8px' }}>
                Viewer
              </RoleBadge>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                Read-only access to tests, analytics, and reports
              </p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'subscription' && (
        <>
          <SubscriptionCard>
            <PlanTitle>
              {planTier === 'community' && 'Community Plan'}
              {planTier === 'starter' && 'Starter Plan'}
              {planTier === 'professional' && 'Professional Plan'}
              {planTier === 'enterprise' && 'Enterprise Plan'}
              {planTier === 'custom' && 'Custom Plan'}
              {!subscription && 'Loading...'}
            </PlanTitle>
            <PlanPrice>
              {planTier === 'community' && 'Free'}
              {planTier === 'starter' && '$29'}
              {planTier === 'professional' && '$99'}
              {planTier === 'enterprise' && 'Custom'}
              {planTier === 'custom' && customPriceEstimate && `$${customPriceEstimate.monthlyEstimate} Est.`}
              {planTier === 'custom' && !customPriceEstimate && 'Custom'}
              {planTier !== 'community' && subscription?.billing_interval && (
                <span style={{ fontSize: '18px', fontWeight: 400 }}>
                  /{subscription.billing_interval === 'monthly' ? 'month' : 'year'}
                </span>
              )}
            </PlanPrice>
            {trialMessage && (
              <div
                style={{
                  marginBottom: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: subscription?.trial_expired ? '#ffe4b5' : '#e8f8ff',
                }}
              >
                {trialMessage}
              </div>
            )}
            
            <FeatureList>
              {planTier === 'community' && (
                <>
                  <Feature><CheckCircle size={16} />Up to 10 test executions/month</Feature>
                  <Feature><CheckCircle size={16} />1 team member</Feature>
                  <Feature><CheckCircle size={16} />Basic analytics</Feature>
                  <Feature><CheckCircle size={16} />Community support</Feature>
                </>
              )}
              {planTier === 'starter' && (
                <>
                  <Feature><CheckCircle size={16} />Up to 1,000 test executions/month</Feature>
                  <Feature><CheckCircle size={16} />Up to 5 team members</Feature>
                  <Feature><CheckCircle size={16} />Standard analytics</Feature>
                  <Feature><CheckCircle size={16} />Email support</Feature>
                </>
              )}
              {planTier === 'professional' && (
                <>
                  <Feature><CheckCircle size={16} />Unlimited test executions</Feature>
                  <Feature><CheckCircle size={16} />Up to 10 team members</Feature>
                  <Feature><CheckCircle size={16} />Advanced analytics & insights</Feature>
                  <Feature><CheckCircle size={16} />Priority support</Feature>
                  <Feature><CheckCircle size={16} />Custom AI provider integration</Feature>
                </>
              )}
              {planTier === 'enterprise' && (
                <>
                  <Feature><CheckCircle size={16} />Unlimited everything</Feature>
                  <Feature><CheckCircle size={16} />Unlimited team members</Feature>
                  <Feature><CheckCircle size={16} />Enterprise analytics</Feature>
                  <Feature><CheckCircle size={16} />Dedicated support</Feature>
                  <Feature><CheckCircle size={16} />Custom integrations</Feature>
                  <Feature><CheckCircle size={16} />SLA guarantees</Feature>
                </>
              )}
              {planTier === 'custom' && (
                <>
                  <Feature><CheckCircle size={16} />Configured limits for your organization</Feature>
                  <Feature><CheckCircle size={16} />Self-hosted deployment option</Feature>
                  <Feature><CheckCircle size={16} />Team members cap: {subscription?.max_team_members ?? 'Unlimited'}</Feature>
                  <Feature><CheckCircle size={16} />Project cap: {subscription?.max_projects ?? 'Unlimited'}</Feature>
                  <Feature><CheckCircle size={16} />Monthly test runs: {subscription?.monthly_test_runs_limit ?? 'Unlimited'}</Feature>
                  <Feature><CheckCircle size={16} />Monthly AI requests: {subscription?.monthly_ai_requests_limit ?? 'Unlimited'}</Feature>
                </>
              )}
            </FeatureList>
            
            <Button
              style={{ background: 'white', color: '#185FA5' }}
              onClick={handleManageSubscription}
              disabled={billingLoading}
            >
              {billingLoading ? 'Opening Billing...' : 'Manage Subscription'}
            </Button>
          </SubscriptionCard>
          
          <Card>
            <CardHeader>
              <CardTitle>Usage This Month</CardTitle>
            </CardHeader>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Test Executions</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0066cc' }}>
                  {usageStats?.test_executions ?? 0}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {planTier === 'community' ? 'Up to 10/month' : 
                   planTier === 'starter' ? 'Up to 1,000/month' : 'Unlimited'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Team Members</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0066cc' }}>
                  {usageStats?.team_members ?? 0} / {hasUnlimitedTeamMembers ? 'Unlimited' : (usageStats?.team_member_limit ?? 1)}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {availableSeats}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>AI Requests</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#0066cc' }}>
                  {usageStats?.ai_requests ?? 0}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {planTier === 'community' ? 'Limited' : 'Unlimited'}
                </div>
              </div>
            </div>
          </Card>

          {(error || actionSuccess) && (
            <Card>
              {error && (
                <div style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '8px', color: '#c00', fontSize: '14px' }}>
                  {error}
                </div>
              )}
              {actionSuccess && (
                <div style={{ padding: '12px', background: '#eaf7ee', border: '1px solid #b9e3c5', borderRadius: '8px', color: '#1f6b3f', fontSize: '14px' }}>
                  {actionSuccess}
                </div>
              )}
            </Card>
          )}

          {isOwnerOrAdmin && (
            <Card>
              <SectionTitle>Compliance & Billing Actions</SectionTitle>
              <SectionHint>
                Use these actions for legal/compliance workflows and subscription lifecycle control.
              </SectionHint>

              <InlineActions>
                <Button
                  $variant="secondary"
                  onClick={() => handleSubscriptionAction('pause')}
                  disabled={!!subscriptionActionLoading || !!organizationActionLoading}
                >
                  <PauseCircle size={16} />
                  {subscriptionActionLoading === 'pause' ? 'Pausing...' : 'Pause Subscription'}
                </Button>

                <Button
                  onClick={() => handleSubscriptionAction('resume')}
                  disabled={!!subscriptionActionLoading || !!organizationActionLoading}
                >
                  <PlayCircle size={16} />
                  {subscriptionActionLoading === 'resume' ? 'Resuming...' : 'Resume Subscription'}
                </Button>

                <Button
                  $variant="secondary"
                  onClick={() => handleSubscriptionAction('cancel', { cancel_at_period_end: true })}
                  disabled={!!subscriptionActionLoading || !!organizationActionLoading}
                >
                  {subscriptionActionLoading === 'cancel-end' ? 'Scheduling Cancel...' : 'Cancel at Period End'}
                </Button>

                <Button
                  $variant="danger"
                  onClick={() => {
                    if (window.confirm('Cancel subscription immediately? This may remove paid access right away.')) {
                      handleSubscriptionAction('cancel', { cancel_at_period_end: false });
                    }
                  }}
                  disabled={!!subscriptionActionLoading || !!organizationActionLoading}
                >
                  {subscriptionActionLoading === 'cancel-now' ? 'Canceling...' : 'Cancel Immediately'}
                </Button>
              </InlineActions>
            </Card>
          )}

          {isOwner && (
            <Card>
              <SectionTitle>Organization Deletion</SectionTitle>
              <SectionHint>
                Type the organization slug to enable deactivation or permanent deletion.
              </SectionHint>

              <FormGroup style={{ maxWidth: '420px' }}>
                <Label>Confirm slug: {tenant?.slug}</Label>
                <Input
                  type="text"
                  value={orgConfirmSlug}
                  onChange={(e) => setOrgConfirmSlug(e.target.value)}
                  placeholder="Type organization slug"
                />
              </FormGroup>

              <InlineActions style={{ marginTop: '16px' }}>
                <Button
                  $variant="secondary"
                  onClick={() => handleOrganizationDelete(false)}
                  disabled={!!subscriptionActionLoading || !!organizationActionLoading}
                >
                  {organizationActionLoading === 'deactivate' ? 'Deactivating...' : 'Deactivate Organization'}
                </Button>

                <Button
                  $variant="danger"
                  onClick={() => handleOrganizationDelete(true)}
                  disabled={!!subscriptionActionLoading || !!organizationActionLoading}
                >
                  {organizationActionLoading === 'hard-delete' ? 'Deleting...' : 'Hard Delete Organization'}
                </Button>
              </InlineActions>
            </Card>
          )}
        </>
      )}

      {activeTab === 'ai' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Management</CardTitle>
              <Button $variant="secondary" onClick={loadAiProviders} disabled={aiLoading || aiSaving}>
                <RefreshCw size={16} />
                {aiLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </CardHeader>

            <div style={{ padding: '16px', background: '#f8fbff', border: '1px solid #dbeafe', borderRadius: '10px', color: '#1e3a8a', fontSize: '14px', marginBottom: '20px' }}>
              <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
              BYOK providers are stored in <code>core.ai_provider_configs</code>. API keys are encrypted server-side and only the last four characters are shown here.
            </div>

            {aiError && (
              <div style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '8px', color: '#c00', fontSize: '14px', marginBottom: '16px' }}>
                {aiError}
              </div>
            )}

            {aiSuccess && (
              <div style={{ padding: '12px', background: '#eaf7ee', border: '1px solid #b9e3c5', borderRadius: '8px', color: '#1f6b3f', fontSize: '14px', marginBottom: '16px' }}>
                {aiSuccess}
              </div>
            )}

            {aiLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading AI provider configurations...</div>
            ) : aiProviders.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>No provider configurations saved yet.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {aiProviders.map(provider => (
                  <div key={provider.id} style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '18px', background: provider.is_default ? '#f8fbff' : 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{provider.provider_name}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{provider.provider} • {provider.model}</div>
                      </div>
                      {provider.is_default && (
                        <span style={{ padding: '4px 10px', borderRadius: '999px', background: '#dbeafe', color: '#1d4ed8', fontSize: '12px', fontWeight: 600 }}>
                          Default
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>
                      API key: <strong>{provider.api_key_last_4 ? `••••${provider.api_key_last_4}` : 'Not shown'}</strong>
                    </div>
                    <div style={{ fontSize: '13px', color: '#374151', marginBottom: '8px' }}>
                      Status: <strong>{provider.is_active ? 'Active' : 'Disabled'}</strong> {provider.is_verified ? '• Verified' : '• Not verified'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#374151', marginBottom: '16px' }}>
                      Requests: <strong>{provider.total_requests ?? 0}</strong>
                    </div>

                    <Button
                      $variant={provider.is_default ? 'secondary' : 'primary'}
                      onClick={() => handleSetDefaultAiProvider(provider.id)}
                      disabled={aiSaving || provider.is_default}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      {provider.is_default ? 'Current Default' : 'Set as Default'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add BYOK Provider</CardTitle>
            </CardHeader>

            <form onSubmit={handleCreateAiProvider}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <FormGroup>
                  <Label>Provider</Label>
                  <Select value={aiForm.provider} onChange={(e) => handleAiProviderChange(e.target.value)}>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="azure">Azure OpenAI</option>
                    <option value="ollama">Ollama</option>
                  </Select>
                </FormGroup>

                <FormGroup>
                  <Label>Provider Name</Label>
                  <Input
                    type="text"
                    value={aiForm.provider_name}
                    onChange={(e) => setAiForm(prev => ({ ...prev, provider_name: e.target.value }))}
                    placeholder="Friendly name for this key"
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Model</Label>
                  <Input
                    type="text"
                    value={aiForm.model}
                    onChange={(e) => setAiForm(prev => ({ ...prev, model: e.target.value }))}
                    placeholder={defaultModelForProvider(aiForm.provider)}
                  />
                </FormGroup>

                <FormGroup>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={aiForm.api_key}
                    onChange={(e) => setAiForm(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder={aiForm.provider === 'ollama' ? 'Optional for Ollama' : 'Paste API key here'}
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Endpoint URL</Label>
                  <Input
                    type="text"
                    value={aiForm.endpoint_url}
                    onChange={(e) => setAiForm(prev => ({ ...prev, endpoint_url: e.target.value }))}
                    placeholder={aiForm.provider === 'ollama' ? 'http://localhost:11434' : 'Optional custom endpoint'}
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Temperature</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={aiForm.temperature}
                    onChange={(e) => setAiForm(prev => ({ ...prev, temperature: e.target.value }))}
                  />
                </FormGroup>

                <FormGroup>
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    min="1"
                    value={aiForm.max_tokens}
                    onChange={(e) => setAiForm(prev => ({ ...prev, max_tokens: e.target.value }))}
                  />
                </FormGroup>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  id="default-provider"
                  type="checkbox"
                  checked={aiForm.is_default}
                  onChange={(e) => setAiForm(prev => ({ ...prev, is_default: e.target.checked }))}
                />
                <Label htmlFor="default-provider" style={{ margin: 0 }}>Set as default provider for this tenant</Label>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="submit" disabled={aiSaving}>
                  {aiSaving ? 'Saving...' : 'Save Provider'}
                </Button>
              </div>
            </form>
          </Card>
        </>
      )}

      {activeTab === 'license' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Self-Host License</CardTitle>
              <Button onClick={fetchLicenseStatus} $variant="secondary" disabled={licenseLoading}>
                <RefreshCw size={16} />
                Refresh
              </Button>
            </CardHeader>

            {!licenseStatus ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>Loading license status...</div>
            ) : licenseStatus.entitlement_reason === 'not_authorized' ? (
              <div style={{ padding: '16px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', color: '#856404', fontSize: '14px' }}>
                <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                Only organization owners or admins can manage self-host licenses.
              </div>
            ) : (
              <>
                {/* Entitlement Status */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Entitlement</div>
                    <Badge $status={licenseStatus.entitlement_active ? 'active' : 'suspended'}>
                      {licenseStatus.entitlement_active ? 'Eligible' : 'Not Eligible'}
                    </Badge>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      Plan: {licenseStatus.plan_tier} · Status: {licenseStatus.subscription_status}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>License</div>
                    <Badge $status={licenseStatus.license_active ? 'active' : licenseStatus.license_present ? 'suspended' : undefined}>
                      {licenseStatus.license_active ? 'Active' : licenseStatus.license_present ? 'Revoked' : 'Not Issued'}
                    </Badge>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Issued</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>
                      {licenseStatus.issued_at ? new Date(licenseStatus.issued_at).toLocaleDateString() : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Last Validated</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#333' }}>
                      {licenseStatus.last_validated_at ? new Date(licenseStatus.last_validated_at).toLocaleString() : '—'}
                    </div>
                    {licenseStatus.last_validation_node_id && (
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                        Node: {licenseStatus.last_validation_node_id}
                      </div>
                    )}
                  </div>
                </div>

                {licenseStatus.revoked_at && (
                  <div style={{ padding: '12px', background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '8px', color: '#721c24', fontSize: '13px', marginBottom: '16px' }}>
                    Revoked on {new Date(licenseStatus.revoked_at).toLocaleDateString()}
                    {licenseStatus.revoked_reason && ` — Reason: ${licenseStatus.revoked_reason}`}
                  </div>
                )}

                {/* Newly issued key display */}
                {issuedLicenseKey && (
                  <div style={{ padding: '16px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#155724', marginBottom: '8px' }}>
                      <Key size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                      License Key Generated
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Input
                        type="text"
                        value={issuedLicenseKey}
                        readOnly
                        style={{ flex: 1, fontFamily: 'monospace', fontSize: '12px' }}
                      />
                      <Button onClick={handleCopyLicenseKey} style={{ whiteSpace: 'nowrap' }}>
                        <Copy size={14} />
                        Copy
                      </Button>
                    </div>
                    <div style={{ fontSize: '12px', color: '#155724', marginTop: '8px' }}>
                      Copy this key now. It will not be displayed again. Add it to your <code>.env.selfhost</code> file as <code>SELF_HOST_LICENSE_KEY</code>.
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Issue / Revoke Actions */}
          {licenseStatus && licenseStatus.entitlement_reason !== 'not_authorized' && isOwnerOrAdmin && (
            <Card>
              <SectionTitle>License Actions</SectionTitle>

              {licenseStatus.entitlement_active && !licenseStatus.license_active && (
                <>
                  <SectionHint>
                    Issue a self-host license key for your organization. Enterprise or Custom plan required.
                  </SectionHint>
                  <FormGroup style={{ maxWidth: '420px', marginBottom: '16px' }}>
                    <Label>Notes (optional)</Label>
                    <Input
                      type="text"
                      value={licenseNotes}
                      onChange={(e) => setLicenseNotes(e.target.value)}
                      placeholder="e.g. Production cluster"
                      maxLength={1000}
                    />
                  </FormGroup>
                  <Button onClick={handleIssueLicense} disabled={licenseLoading}>
                    <Key size={16} />
                    {licenseLoading ? 'Issuing...' : 'Issue License Key'}
                  </Button>
                </>
              )}

              {licenseStatus.license_active && (
                <>
                  <SectionHint>
                    Revoke the active license. All deployed instances will fail validation on their next check.
                  </SectionHint>
                  <FormGroup style={{ maxWidth: '420px', marginBottom: '16px' }}>
                    <Label>Revoke Reason</Label>
                    <Select value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)}>
                      <option value="manual_revoke">Manual revoke</option>
                      <option value="security_rotation">Security rotation</option>
                      <option value="decommission">Decommission</option>
                      <option value="reissue">Re-issue new key</option>
                    </Select>
                  </FormGroup>
                  <Button $variant="danger" onClick={handleRevokeLicense} disabled={licenseLoading}>
                    <XCircle size={16} />
                    {licenseLoading ? 'Revoking...' : 'Revoke License'}
                  </Button>
                </>
              )}

              {!licenseStatus.entitlement_active && (
                <div style={{ padding: '16px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', color: '#856404', fontSize: '14px' }}>
                  <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                  Self-host licensing requires an Enterprise or Custom plan.
                  {licenseStatus.entitlement_reason === 'plan_not_eligible' && ' Upgrade your plan to enable self-hosting.'}
                  {licenseStatus.entitlement_reason === 'subscription_inactive' && ' Your subscription is inactive.'}
                  {licenseStatus.entitlement_reason === 'no_subscription' && ' No subscription found for this organization.'}
                </div>
              )}
            </Card>
          )}

          {/* Deployment Quick Reference */}
          {licenseStatus?.license_active && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <Server size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                  Deployment Quick Reference
                </CardTitle>
              </CardHeader>
              <div style={{ fontSize: '14px', color: '#333', lineHeight: '1.8' }}>
                <ol style={{ paddingLeft: '20px', margin: 0 }}>
                  <li>Copy <code>.env.selfhost.template</code> to <code>.env.selfhost</code></li>
                  <li>Set <code>SELF_HOST_LICENSE_KEY</code> to the license key issued above</li>
                  <li>Set <code>SELF_HOST_TENANT_SLUG</code> to <strong>{tenant?.slug || 'your-org-slug'}</strong></li>
                  <li>Set <code>SELF_HOST_VALIDATION_URL</code> to <code>{config.apiBaseUrl}/api/v1/licensing/self-host/validate</code></li>
                  <li>Configure database, domain URLs, and AI provider keys</li>
                  <li>
                    Run: <code>docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml up -d --build</code>
                  </li>
                </ol>
              </div>
            </Card>
          )}

          {(licenseError || licenseSuccess) && (
            <Card>
              {licenseError && (
                <div style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '8px', color: '#c00', fontSize: '14px' }}>
                  {licenseError}
                </div>
              )}
              {licenseSuccess && !issuedLicenseKey && (
                <div style={{ padding: '12px', background: '#eaf7ee', border: '1px solid #b9e3c5', borderRadius: '8px', color: '#1f6b3f', fontSize: '14px' }}>
                  {licenseSuccess}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {showInviteModal && (
        <Modal onClick={() => setShowInviteModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>Invite Team Member</ModalTitle>
              <Subtitle>Send an invitation to join your organization</Subtitle>
            </ModalHeader>

            <Form onSubmit={handleInviteMember}>
              <FormGroup>
                <Label>Role</Label>
                <Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                >
                  <option value="admin">Admin - Full team management</option>
                  <option value="member">Member - Create and run tests</option>
                  <option value="viewer">Viewer - Read-only access</option>
                </Select>
                <p style={{ fontSize: '12px', color: '#666', margin: '8px 0 0 0' }}>
                  This will generate a shareable invitation link that anyone can use to join your organization.
                </p>
              </FormGroup>

              {error && (
                <div style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '8px', color: '#c00', fontSize: '14px' }}>
                  {error}
                </div>
              )}

              <ButtonGroup>
                <Button type="button" $variant="secondary" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  <UserPlus size={16} />
                  {loading ? 'Generating...' : 'Generate Invite Link'}
                </Button>
              </ButtonGroup>
            </Form>
          </ModalContent>
        </Modal>
      )}

      {showInviteLinkModal && (
        <Modal onClick={() => setShowInviteLinkModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>✨ Invitation Link Generated</ModalTitle>
              <Subtitle>Share this link with people you want to invite</Subtitle>
            </ModalHeader>

            <div style={{ marginBottom: '24px' }}>
              <Label>Invitation Link</Label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <Input
                  type="text"
                  value={invitationLink}
                  readOnly
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '12px' }}
                />
                <Button onClick={handleCopyInviteLink} style={{ whiteSpace: 'nowrap' }}>
                  Copy Link
                </Button>
              </div>
              <p style={{ fontSize: '12px', color: '#666', margin: '8px 0 0 0' }}>
                This link expires in 7 days and can be used unlimited times.
              </p>
            </div>

            <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>How to use:</div>
              <ol style={{ fontSize: '13px', color: '#666', margin: 0, paddingLeft: '20px' }}>
                <li>Copy the link above</li>
                <li>Share it via email, Slack, or any messaging platform</li>
                <li>Recipients will be prompted to create an account and join your organization</li>
              </ol>
            </div>

            <ButtonGroup>
              <Button onClick={() => {
                setShowInviteLinkModal(false);
                setInvitationLink('');
              }}>
                Done
              </Button>
            </ButtonGroup>
          </ModalContent>
        </Modal>
      )}

      {showEditRoleModal && editingMember && (
        <Modal onClick={() => setShowEditRoleModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>Edit Member Role</ModalTitle>
              <Subtitle>Change role for {editingMember.full_name || editingMember.email}</Subtitle>
            </ModalHeader>

            <Form onSubmit={(e) => { e.preventDefault(); handleUpdateRole(); }}>
              <FormGroup>
                <Label>Role</Label>
                <Select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as typeof editRole)}
                >
                  <option value="owner" disabled={currentUserRole !== 'owner'}>
                    Owner - Full control {currentUserRole === 'owner' ? '(you will become Admin)' : '(owner only)'}
                  </option>
                  <option value="admin">Admin - Full team management</option>
                  <option value="member">Member - Create and run tests</option>
                  <option value="viewer">Viewer - Read-only access</option>
                </Select>
                {editRole === 'owner' && (
                  <div style={{ 
                    padding: '12px', 
                    background: '#fff3cd', 
                    border: '1px solid #ffc107', 
                    borderRadius: '8px', 
                    fontSize: '13px',
                    marginTop: '12px',
                    display: 'flex',
                    alignItems: 'start',
                    gap: '8px'
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Ownership Transfer:</strong> You are about to transfer ownership to {editingMember.full_name || editingMember.email}. 
                      Your role will be changed to Admin. Only one person can be the owner at a time.
                    </div>
                  </div>
                )}
              </FormGroup>

              {error && (
                <div style={{ padding: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '8px', color: '#c00', fontSize: '14px' }}>
                  {error}
                </div>
              )}

              <ButtonGroup>
                <Button type="button" $variant="secondary" onClick={() => {
                  setShowEditRoleModal(false);
                  setEditingMember(null);
                  setError(null);
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  <Shield size={16} />
                  {loading ? 'Updating...' : 'Update Role'}
                </Button>
              </ButtonGroup>
            </Form>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
};

export default OrganizationSettings;
