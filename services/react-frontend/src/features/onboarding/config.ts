import { PlanDetails, SubscriptionPlan } from './types';

// Define your subscription plans
export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, PlanDetails> = {
  community: {
    id: 'community',
    name: 'Community',
    price: 0,
    billingPeriod: 'month',
    trialDays: 0,
    features: [
      'Hard cap usage tier',
      '10 test generations/month',
      'Basic self-healing (manual approval)',
      'Chrome extension',
      'No overages (upgrade to Professional to scale)',
      'Community support'
    ],
    limits: {
      elements: 50,
      testGenerations: 10,
      teamMembers: 1,
      aiRequests: 100
    }
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 99,
    billingPeriod: 'month',
    trialDays: 14,
    priceId: 'price_professional_monthly', // Replace with actual Stripe Price ID
    features: [
      'Unlimited elements',
      'Unlimited test generations',
      'Founding member pricing: $99/mo (first 50 customers, locked forever)',
      'Post-founding list price: $200/mo',
      'No overage concept (truly unlimited usage)',
      'Automatic self-healing with policies',
      'Multi-AI provider support',
      'Element health analytics',
      'Priority support',
      '60-day audit retention'
    ],
    limits: {
      elements: 'unlimited',
      testGenerations: 'unlimited',
      teamMembers: 10,
      aiRequests: 'unlimited'
    }
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    price: 149,
    billingPeriod: 'month',
    trialDays: 0,
    features: [
      'Set your own usage limits at signup',
      'Starts at $149/month during founding period (scoped on a call)',
      'Post-founding starts at $400-$500/month (scoped on a call)',
      'Hard cap by default',
      'Optional flat-rate overage billing (opt-in)',
      'Custom team member caps',
      'Custom monthly test run limits',
      'Custom AI request limits',
      'Adjustable as your needs change'
    ],
    limits: {
      elements: 'unlimited',
      testGenerations: 'unlimited',
      teamMembers: 'unlimited',
      aiRequests: 'unlimited'
    }
  }
};

// Stripe configuration (these would typically come from environment variables)
export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_YOUR_KEY',
  apiVersion: '2023-10-16' as const,
};

// Organization size options
export const ORGANIZATION_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '501-1000', label: '501-1000 employees' },
  { value: '1000+', label: '1000+ employees' }
];

// Industry options
export const INDUSTRIES = [
  { value: 'technology', label: 'Technology' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'education', label: 'Education' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'other', label: 'Other' }
];
