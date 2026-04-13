import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { spinKeyframes, scaleInKeyframes } from '../../../shared/styles/keyframes';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, User, Building2, CreditCard, Sparkles } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { config } from '../../../app/config';
import { SubscriptionSelection } from './SubscriptionSelection';
import { OrganizationSetup } from './OrganizationSetup';
import { PaymentForm } from './PaymentForm';
import { OnboardingFormData, OnboardingStep, SubscriptionPlan } from '../types';
import { SUBSCRIPTION_PLANS } from '../config';

const PageContainer = styled.div`
  min-height: 100vh;
  background: #185FA5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
`;

const OnboardingCard = styled.div`
  background: white;
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 1000px;
  overflow: hidden;
`;

const ProgressBar = styled.div`
  display: flex;
  background: #f8f9fa;
  padding: 24px 40px;
  border-bottom: 2px solid #e9ecef;

  @media (max-width: 768px) {
    padding: 20px 24px;
  }
`;

const StepItem = styled.div<{ $active: boolean; $completed: boolean }>`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;

  &:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 20px;
    left: calc(100% + 8px);
    width: calc(100% - 60px);
    height: 2px;
    background: ${props => props.$completed ? '#185FA5' : '#e1e5e9'};
    z-index: 0;
  }

  @media (max-width: 768px) {
    &:not(:last-child)::after {
      display: none;
    }
  }
`;

const StepIcon = styled.div<{ $active: boolean; $completed: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.$completed ? '#185FA5' : props.$active ? '#185FA5' : '#e1e5e9'};
  color: ${props => props.$completed || props.$active ? 'white' : '#aaa'};
  font-weight: 700;
  font-size: 16px;
  z-index: 1;
  transition: all 0.3s ease;
  flex-shrink: 0;
`;

const StepInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const StepTitle = styled.div<{ $active: boolean }>`
  font-size: 14px;
  font-weight: ${props => props.$active ? 700 : 600};
  color: ${props => props.$active ? '#333' : '#666'};
`;

const StepDescription = styled.div`
  font-size: 12px;
  color: #999;
`;

const ContentArea = styled.div`
  padding: 48px 40px;
  min-height: 600px;
  display: flex;
  flex-direction: column;

  @media (max-width: 768px) {
    padding: 32px 24px;
  }
`;

const AccountSetupForm = styled.form`
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const FormHeader = styled.div`
  text-align: center;
  margin-bottom: 32px;
`;

const FormTitle = styled.h2`
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 12px 0;
`;

const FormSubtitle = styled.p`
  font-size: 16px;
  color: #666;
  margin: 0;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-weight: 600;
  color: #333;
  font-size: 14px;
`;

const Input = styled.input`
  padding: 14px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #185FA5;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  }

  &::placeholder {
    color: #aaa;
  }
`;

const ErrorMessage = styled.div`
  color: #c53030;
  font-size: 13px;
  margin-top: 4px;
`;

const TermsRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  color: #555;
  line-height: 1.4;
`;

const TermsCheckbox = styled.input`
  margin-top: 2px;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: auto;
  padding-top: 32px;
  border-top: 2px solid #f1f3f5;
`;

const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;

  ${props => props.$variant === 'primary' ? `
    background: #185FA5;
    color: white;
    
    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
  ` : `
    background: transparent;
    color: #185FA5;
    border-color: #e1e5e9;
    
    &:hover:not(:disabled) {
      background: #f8f9fa;
      border-color: #185FA5;
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const LoadingSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid white;
  border-top-color: transparent;
  border-radius: 50%;
  animation: ${spinKeyframes} 1s linear infinite;
`;

const SuccessScreen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 40px;
  gap: 24px;
`;

const SuccessIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1D9E75 0%, #0F6E56 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  animation: ${scaleInKeyframes} 0.5s ease;
`;

const SuccessTitle = styled.h2`
  font-size: 32px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
`;

const SuccessMessage = styled.p`
  font-size: 16px;
  color: #666;
  margin: 0;
  max-width: 500px;
`;

const ONBOARDING_DRAFT_KEY = 'FluxTest_onboarding_draft_v1';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, login, isLoading, token } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<OnboardingFormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    organization: {
      name: '',
      slug: '',
      industry: '',
      size: '',
      website: ''
    },
    selectedPlan: 'professional',
    billingPeriod: 'month',
    customLimits: {},
    paymentMethodId: undefined
  });

  useEffect(() => {
    const persistedDraft = sessionStorage.getItem(ONBOARDING_DRAFT_KEY);
    if (!persistedDraft) {
      return;
    }

    try {
      const parsed = JSON.parse(persistedDraft) as { formData?: OnboardingFormData; currentStep?: number };
      if (parsed.formData) {
        setFormData(parsed.formData);
      }
      if (typeof parsed.currentStep === 'number' && parsed.currentStep >= 1 && parsed.currentStep <= 4) {
        setCurrentStep(parsed.currentStep);
      }
    } catch {
      sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    if (currentStep === 5) {
      return;
    }

    const draftPayload = JSON.stringify({
      formData,
      currentStep,
      updatedAt: Date.now(),
    });
    sessionStorage.setItem(ONBOARDING_DRAFT_KEY, draftPayload);
  }, [formData, currentStep]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const sessionId = params.get('session_id');

    if (checkoutStatus === 'cancelled') {
      setErrors({ payment: 'Checkout was cancelled. Please try again to continue.' });
      setCurrentStep(4);
      return;
    }

    if (checkoutStatus === 'success' && sessionId) {
      setFormData((prev) => ({
        ...prev,
        paymentMethodId: sessionId,
      }));
      setCurrentStep(4);
    }
  }, []);

  const steps: OnboardingStep[] = [
    { id: 1, title: 'Account', description: 'Create your account', completed: currentStep > 1 },
    { id: 2, title: 'Organization', description: 'Optional business info', completed: currentStep > 2 },
    { id: 3, title: 'Plan', description: 'Choose subscription', completed: currentStep > 3 },
    { id: 4, title: 'Payment', description: 'Payment details', completed: currentStep > 4 }
  ];

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.fullName) newErrors.fullName = 'Full name is required';
      if (!formData.email) newErrors.email = 'Email is required';
      if (!formData.password) newErrors.password = 'Password is required';
      if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
      if (!formData.termsAccepted) newErrors.termsAccepted = 'You must accept the Terms of Service, Privacy Policy, and Licensing Agreement';
    }

    if (step === 2) {
      const hasOrgName = !!formData.organization.name?.trim();
      const hasOrgSlug = !!formData.organization.slug?.trim();

      if ((hasOrgName || hasOrgSlug) && !hasOrgName) {
        newErrors.orgName = 'Organization name is required when providing business details';
      }

      if ((hasOrgName || hasOrgSlug) && !hasOrgSlug) {
        newErrors.orgSlug = 'Organization slug is required when providing business details';
      }

      if (hasOrgSlug && formData.organization.slug.length < 3) {
        newErrors.orgSlug = 'Slug must be at least 3 characters';
      }
    }

    if (step === 3 && formData.selectedPlan === 'custom') {
      const hasAtLeastOneLimit = Object.values(formData.customLimits).some(
        (value) => typeof value === 'number' && value > 0
      );

      if (!hasAtLeastOneLimit) {
        newErrors.customLimits = 'Set at least one custom limit for the custom plan (hard cap by default)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;

    // If on plan selection and community plan selected, skip payment
    if (currentStep === 3 && (formData.selectedPlan === 'community' || formData.selectedPlan === 'custom')) {
      await handleSubmit();
      return;
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    const apiBase = config.apiBaseUrl;

    const getErrorMessage = async (response: Response, fallback: string): Promise<string> => {
      try {
        const data = await response.json();
        if (typeof data?.detail === 'string') {
          return data.detail;
        }
      } catch {
        // Fall back to default message
      }
      return fallback;
    };
    
    try {
      // 1. Register user
      const result = await register(formData.email, formData.password, formData.fullName, formData.termsAccepted);
      
      if (!result.success) {
        throw new Error('Registration failed');
      }

      // Use the token from the registration result to avoid timing issues with state updates
      const authToken = result.token;

      const requiresPaidCheckout =
        formData.selectedPlan !== 'community' &&
        formData.selectedPlan !== 'custom';

      if (requiresPaidCheckout && !formData.paymentMethodId) {
        throw new Error('Complete payment checkout before finishing setup.');
      }

      // 2. Create organization only when business details are provided
      const shouldCreateOrganization =
        !!formData.organization.name?.trim() || !!formData.organization.slug?.trim();

      if (shouldCreateOrganization) {
        const orgResponse = await fetch(`${apiBase}/api/v1/organizations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            name: formData.organization.name,
            slug: formData.organization.slug,
            industry: formData.organization.industry,
            size: formData.organization.size,
            website: formData.organization.website,
          }),
        });

        if (!orgResponse.ok) {
          const orgError = await getErrorMessage(orgResponse, 'Organization creation failed');
          throw new Error(orgError);
        }
      }

      // 3. Set up subscription if not community plan
      if (formData.selectedPlan !== 'community') {
        const subscriptionPayload: Record<string, unknown> = {
          plan_id: formData.selectedPlan,
          billing_period: formData.billingPeriod,
          payment_method_id: formData.paymentMethodId,
        };

        if (formData.selectedPlan === 'custom') {
          subscriptionPayload.custom_limits = {
            max_team_members: formData.customLimits.teamMembers,
            max_projects: formData.customLimits.projects,
            monthly_test_runs_limit: formData.customLimits.monthlyTestRuns,
            monthly_ai_requests_limit: formData.customLimits.aiRequestsPerMonth,
          };
        }

        const subscriptionResponse = await fetch(`${apiBase}/api/v1/subscriptions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify(subscriptionPayload),
        });

        if (!subscriptionResponse.ok) {
          const subscriptionError = await getErrorMessage(subscriptionResponse, 'Subscription setup failed');
          throw new Error(subscriptionError);
        }
      }

      // Re-login to refresh the token with the new tenant/project information
      // This ensures the user's session has the correct organization context
      try {
        const loginSuccess = await login(formData.email, formData.password);
        if (!loginSuccess) {
          console.warn('Failed to refresh token after organization creation');
        }
      } catch (err) {
        console.warn('Token refresh failed after onboarding', err);
      }

      // Show success screen
      setCurrentStep(5);
      sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error: any) {
      setErrors({ submit: error.message || 'Something went wrong' });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <AccountSetupForm onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
            <FormHeader>
              <FormTitle>Create your account</FormTitle>
              <FormSubtitle>Start your journey with FluxTest</FormSubtitle>
            </FormHeader>

            <FormGroup>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Doe"
              />
              {errors.fullName && <ErrorMessage>{errors.fullName}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@company.com"
              />
              {errors.email && <ErrorMessage>{errors.email}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 6 characters"
              />
              {errors.password && <ErrorMessage>{errors.password}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Re-enter your password"
              />
              {errors.confirmPassword && <ErrorMessage>{errors.confirmPassword}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <TermsRow htmlFor="termsAccepted">
                <TermsCheckbox
                  id="termsAccepted"
                  type="checkbox"
                  checked={formData.termsAccepted}
                  onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>
                  {', '}
                  <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>
                  {' '}and{' '}
                  <Link to="/licensing" target="_blank" rel="noopener noreferrer">Licensing Agreement</Link>.
                </span>
              </TermsRow>
              {errors.termsAccepted && <ErrorMessage>{errors.termsAccepted}</ErrorMessage>}
            </FormGroup>
          </AccountSetupForm>
        );

      case 2:
        return (
          <OrganizationSetup
            data={formData.organization}
            onChange={(org) => setFormData({ ...formData, organization: org })}
            errors={errors}
          />
        );

      case 3:
        return (
          <SubscriptionSelection
            selectedPlan={formData.selectedPlan}
            billingPeriod={formData.billingPeriod}
            customLimits={formData.customLimits}
            customLimitsError={errors.customLimits}
            onPlanSelect={(plan: SubscriptionPlan) => setFormData({ ...formData, selectedPlan: plan })}
            onBillingPeriodChange={(period) => setFormData({ ...formData, billingPeriod: period })}
            onCustomLimitsChange={(customLimits) => setFormData({ ...formData, customLimits })}
          />
        );

      case 4:
        const plan = SUBSCRIPTION_PLANS[formData.selectedPlan];
        return (
          <PaymentForm
            planId={formData.selectedPlan}
            planName={plan.name}
            amount={plan.price}
            billingPeriod={formData.billingPeriod}
            customerEmail={formData.email}
            onPaymentComplete={(paymentMethodId) => {
              setFormData({ ...formData, paymentMethodId });
            }}
            onError={(error) => setErrors({ payment: error })}
          />
        );

      case 5:
        return (
          <SuccessScreen>
            <SuccessIcon>
              <Check size={48} />
            </SuccessIcon>
            <SuccessTitle>Welcome to FluxTest!</SuccessTitle>
            <SuccessMessage>
              Your account has been created successfully. You're being redirected to your dashboard...
            </SuccessMessage>
            <LoadingSpinner style={{ borderColor: '#185FA5', borderTopColor: 'transparent' }} />
          </SuccessScreen>
        );

      default:
        return null;
    }
  };

  if (currentStep === 5) {
    return (
      <PageContainer>
        <OnboardingCard>
          {renderStepContent()}
        </OnboardingCard>
      </PageContainer>
    );
  }

  const shouldShowPaymentStep =
    formData.selectedPlan !== 'community' &&
    formData.selectedPlan !== 'custom';

  return (
    <PageContainer>
      <OnboardingCard>
        <ProgressBar>
          {steps.filter(step => shouldShowPaymentStep || step.id !== 4).map((step, index) => {
            const Icon = [User, Building2, Sparkles, CreditCard][step.id - 1];
            return (
              <StepItem key={step.id} $active={currentStep === step.id} $completed={step.completed}>
                <StepIcon $active={currentStep === step.id} $completed={step.completed}>
                  {step.completed ? <Check size={20} /> : <Icon size={20} />}
                </StepIcon>
                <StepInfo>
                  <StepTitle $active={currentStep === step.id}>{step.title}</StepTitle>
                  <StepDescription>{step.description}</StepDescription>
                </StepInfo>
              </StepItem>
            );
          })}
        </ProgressBar>

        <ContentArea>
          {renderStepContent()}

          {currentStep !== 5 && (
            <ButtonGroup>
              <Button
                type="button"
                $variant="secondary"
                onClick={currentStep === 1 ? () => navigate('/login') : handleBack}
              >
                <ArrowLeft size={18} />
                {currentStep === 1 ? 'Back to Login' : 'Back'}
              </Button>

              <Button
                type="button"
                $variant="primary"
                onClick={handleNext}
                disabled={isLoading || isProcessing}
              >
                {isLoading || isProcessing ? (
                  <>
                    <LoadingSpinner />
                    Processing...
                  </>
                ) : currentStep === 3 && formData.selectedPlan === 'community' ? (
                  <>
                    Complete Setup
                    <Check size={18} />
                  </>
                ) : currentStep === 3 && formData.selectedPlan === 'custom' ? (
                  <>
                    Complete Setup
                    <Check size={18} />
                  </>
                ) : currentStep === 4 ? (
                  <>
                    Complete Setup
                    <Check size={18} />
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight size={18} />
                  </>
                )}
              </Button>
            </ButtonGroup>
          )}

          {errors.submit && (
            <ErrorMessage style={{ textAlign: 'center', marginTop: '16px' }}>
              {errors.submit}
            </ErrorMessage>
          )}
          {errors.payment && currentStep === 4 && (
            <ErrorMessage style={{ textAlign: 'center', marginTop: '16px' }}>
              {errors.payment}
            </ErrorMessage>
          )}
        </ContentArea>
      </OnboardingCard>
    </PageContainer>
  );
};

export default OnboardingPage;
