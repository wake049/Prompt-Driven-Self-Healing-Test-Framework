export interface CustomPricingLimits {
  maxTeamMembers?: number | null;
  maxProjects?: number | null;
  monthlyTestRunsLimit?: number | null;
  monthlyAiRequestsLimit?: number | null;
  overageBilling?: boolean;
  selfHosted?: boolean;
}

export const CUSTOM_PRICING = {
  baseMonthly: 149,
  overageFlatRateAddon: 100,
  selfHostedAddon: 250,
  perTeamMember: 12,
  perProject: 8,
  per100TestRuns: 5,
  per1000AiRequests: 4,
  annualDiscount: 0.2,
};

const sanitize = (value?: number | null): number => {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return 0;
  }
  return value;
};

export const calculateCustomMonthlyEstimate = (limits: CustomPricingLimits): number => {
  const selfHostedAddon = limits.selfHosted ? CUSTOM_PRICING.selfHostedAddon : 0;
  const overageAddon = limits.overageBilling ? CUSTOM_PRICING.overageFlatRateAddon : 0;

  // null means unlimited — no per-unit charge for that dimension
  const teamMembers = limits.maxTeamMembers === null ? 0 : sanitize(limits.maxTeamMembers);
  const projects = limits.maxProjects === null ? 0 : sanitize(limits.maxProjects);
  const monthlyTestRuns = limits.monthlyTestRunsLimit === null ? 0 : sanitize(limits.monthlyTestRunsLimit);
  const monthlyAiRequests = limits.monthlyAiRequestsLimit === null ? 0 : sanitize(limits.monthlyAiRequestsLimit);

  const teamComponent = teamMembers * CUSTOM_PRICING.perTeamMember;
  const projectComponent = projects * CUSTOM_PRICING.perProject;
  const testRunsComponent = Math.ceil(monthlyTestRuns / 100) * CUSTOM_PRICING.per100TestRuns;
  const aiRequestsComponent = Math.ceil(monthlyAiRequests / 1000) * CUSTOM_PRICING.per1000AiRequests;

  return CUSTOM_PRICING.baseMonthly + overageAddon + selfHostedAddon + teamComponent + projectComponent + testRunsComponent + aiRequestsComponent;
};

export const calculateCustomEstimateByPeriod = (
  limits: CustomPricingLimits,
  billingPeriod: 'month' | 'year'
): { monthlyEstimate: number; billedAmount: number } => {
  const monthlyEstimate = calculateCustomMonthlyEstimate(limits);

  if (billingPeriod === 'year') {
    const annual = Math.round(monthlyEstimate * 12 * (1 - CUSTOM_PRICING.annualDiscount));
    return { monthlyEstimate, billedAmount: annual };
  }

  return { monthlyEstimate, billedAmount: monthlyEstimate };
};
