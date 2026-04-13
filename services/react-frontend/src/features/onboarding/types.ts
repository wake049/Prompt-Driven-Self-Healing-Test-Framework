// Subscription plans matching your pricing tiers
export type SubscriptionPlan = 'community' | 'professional' | 'custom';

export interface CustomSubscriptionLimits {
  teamMembers?: number;
  projects?: number;
  monthlyTestRuns?: number;
  aiRequestsPerMonth?: number;
  overageBilling?: boolean;
}

export interface PlanDetails {
  id: SubscriptionPlan;
  name: string;
  price: number;
  billingPeriod: 'month' | 'year';
  // Length of free trial in days for this plan
  trialDays?: number;
  priceId?: string; // Stripe Price ID
  features: string[];
  limits: {
    elements: number | 'unlimited';
    testGenerations: number | 'unlimited';
    teamMembers: number | 'unlimited';
    aiRequests: number | 'unlimited';
  };
}

export interface OrganizationData {
  name: string;
  slug: string;
  industry?: string;
  size?: string;
  website?: string;
}

export interface OnboardingFormData {
  // Step 1: User Info
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
  
  // Step 2: Organization
  organization: OrganizationData;
  
  // Step 3: Subscription
  selectedPlan: SubscriptionPlan;
  billingPeriod: 'month' | 'year';
  customLimits: CustomSubscriptionLimits;
  
  // Step 4: Payment (if not community plan)
  paymentMethodId?: string;
}

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

export interface StripePaymentIntent {
  id: string;
  client_secret: string;
  status: string;
}
