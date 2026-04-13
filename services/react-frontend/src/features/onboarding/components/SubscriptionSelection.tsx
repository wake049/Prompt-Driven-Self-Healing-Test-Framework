import React from 'react';
import styled from 'styled-components';
import { Check, Sparkles } from 'lucide-react';
import { SubscriptionPlan, PlanDetails, CustomSubscriptionLimits } from '../types';
import { SUBSCRIPTION_PLANS } from '../config';
import { calculateCustomEstimateByPeriod } from '../../subscription/customPricing';

const Container = styled.div`
  width: 100%;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 48px;
`;

const Title = styled.h2`
  font-size: 32px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 12px 0;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: #666;
  margin: 0;
`;

const TrialNote = styled.div`
  font-size: 13px;
  color: #4b5563;
  margin-top: 8px;
`;

const BillingToggle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 32px 0;
`;

const ToggleLabel = styled.span<{ $active: boolean }>`
  font-size: 14px;
  font-weight: ${props => props.$active ? 600 : 400};
  color: ${props => props.$active ? '#185FA5' : '#666'};
  transition: all 0.2s ease;
`;

const ToggleSwitch = styled.button<{ $isYearly: boolean }>`
  position: relative;
  width: 56px;
  height: 28px;
  background: ${props => props.$isYearly ? '#185FA5' : '#ccc'};
  border: none;
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.3s ease;

  &:after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${props => props.$isYearly ? '31px' : '3px'};
    width: 22px;
    height: 22px;
    background: white;
    border-radius: 50%;
    transition: left 0.3s ease;
  }

  &:hover {
    opacity: 0.9;
  }
`;

const SaveBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: linear-gradient(135deg, #1D9E75 0%, #0F6E56 100%);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
`;

const PlansGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  max-width: 1200px;
  margin: 0 auto;

  @media (max-width: 968px) {
    grid-template-columns: 1fr;
    max-width: 500px;
  }
`;

const PlanCard = styled.div<{ $selected: boolean; $featured?: boolean }>`
  position: relative;
  background: white;
  border: 2px solid ${props => props.$selected ? '#185FA5' : props.$featured ? '#185FA5' : '#e1e5e9'};
  border-radius: 16px;
  padding: 32px 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: ${props => props.$selected ? '0 12px 24px rgba(102, 126, 234, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.08)'};
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
    border-color: #185FA5;
  }

  ${props => props.$featured && `
    border-color: #185FA5;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%);
  `}
`;

const FeaturedBadge = styled.div`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 16px;
  background: #185FA5;
  color: white;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PlanHeader = styled.div`
  text-align: center;
  margin-bottom: 24px;
`;

const PlanName = styled.h3`
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px 0;
`;

const PlanPrice = styled.div`
  font-size: 48px;
  font-weight: 800;
  color: #185FA5;
  margin: 16px 0 8px 0;
  
  span {
    font-size: 18px;
    font-weight: 400;
    color: #666;
  }
`;

const PlanPeriod = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
`;

const PlanDescription = styled.p`
  font-size: 14px;
  color: #666;
  margin: 0;
  min-height: 40px;
`;

const FeaturesList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 24px 0 0 0;
`;

const FeatureItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  font-size: 14px;
  color: #333;
  
  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: #1D9E75;
  }
`;

const SelectButton = styled.button<{ $selected: boolean }>`
  width: 100%;
  padding: 14px 24px;
  background: ${props => props.$selected 
    ? '#185FA5' 
    : 'transparent'};
  color: ${props => props.$selected ? 'white' : '#185FA5'};
  border: 2px solid ${props => props.$selected ? 'transparent' : '#185FA5'};
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 24px;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.3);
    ${props => !props.$selected && `
      background: #185FA5;
      color: white;
    `}
  }
`;

const CustomPriceNote = styled.div`
  font-size: 16px;
  color: #185FA5;
  font-weight: 600;
  margin: 16px 0;
`;

const ContactNote = styled.div`
  text-align: center;
  margin-top: 32px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 14px;
  color: #666;
  
  a {
    color: #185FA5;
    text-decoration: none;
    font-weight: 600;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

const CustomLimitsContainer = styled.div`
  margin-top: 24px;
  padding: 20px;
  border: 2px solid #e1e5e9;
  border-radius: 12px;
  background: #fafbfc;
`;

const CustomLimitsTitle = styled.h4`
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #1a1a1a;
`;

const CustomLimitsSubtitle = styled.p`
  margin: 0 0 16px 0;
  font-size: 14px;
  color: #666;
`;

const CustomLimitsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const LimitInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const LimitLabel = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: #333;
`;

const LimitInput = styled.input`
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #185FA5;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const InlineErrorMessage = styled.div`
  margin-top: 12px;
  color: #c53030;
  font-size: 13px;
`;

const EstimateBox = styled.div`
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 10px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
`;

const EstimateLabel = styled.div`
  font-size: 13px;
  color: #4c1d95;
`;

const EstimateValue = styled.div`
  margin-top: 4px;
  font-size: 22px;
  font-weight: 700;
  color: #4338ca;
`;

const EstimateSubtext = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: #6b7280;
`;

const CheckboxRow = styled.label`
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #333;
`;

const CheckboxInput = styled.input`
  width: 16px;
  height: 16px;
`;

interface SubscriptionSelectionProps {
  selectedPlan: SubscriptionPlan;
  billingPeriod: 'month' | 'year';
  customLimits: CustomSubscriptionLimits;
  customLimitsError?: string;
  onPlanSelect: (plan: SubscriptionPlan) => void;
  onBillingPeriodChange: (period: 'month' | 'year') => void;
  onCustomLimitsChange: (limits: CustomSubscriptionLimits) => void;
}

export const SubscriptionSelection: React.FC<SubscriptionSelectionProps> = ({
  selectedPlan,
  billingPeriod,
  customLimits,
  customLimitsError,
  onPlanSelect,
  onBillingPeriodChange,
  onCustomLimitsChange
}) => {
  const customEstimate = calculateCustomEstimateByPeriod(
    {
      maxTeamMembers: customLimits.teamMembers,
      maxProjects: customLimits.projects,
      monthlyTestRunsLimit: customLimits.monthlyTestRuns,
      monthlyAiRequestsLimit: customLimits.aiRequestsPerMonth,
      overageBilling: customLimits.overageBilling,
    },
    billingPeriod
  );

  const parseCustomLimitValue = (value: string): number | undefined => {
    if (value === '') {
      return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }

    return parsed;
  };

  const handleCustomLimitChange = (key: keyof CustomSubscriptionLimits, value: string) => {
    onCustomLimitsChange({
      ...customLimits,
      [key]: parseCustomLimitValue(value)
    });
  };

  const renderPlanCard = (plan: PlanDetails, isFeatured: boolean = false) => {
    const isSelected = selectedPlan === plan.id;
    const displayPrice = billingPeriod === 'year' && plan.price > 0 
      ? Math.round(plan.price * 0.8) // 20% discount for annual
      : plan.price;
    
    const yearlyTotal = plan.price > 0 ? displayPrice * 12 : 0;

    return (
      <PlanCard
        key={plan.id}
        $selected={isSelected}
        $featured={isFeatured}
        onClick={() => onPlanSelect(plan.id)}
      >
        {isFeatured && <FeaturedBadge>{plan.id === 'professional' ? 'Founding Member' : 'Most Popular'}</FeaturedBadge>}
        
        <PlanHeader>
          <PlanName>{plan.name}</PlanName>
          
          {plan.price === 0 && plan.id === 'community' ? (
            <>
              <PlanPrice>$0<span>/month</span></PlanPrice>
              <PlanPeriod>Forever free</PlanPeriod>
            </>
          ) : plan.id === 'custom' ? (
            <CustomPriceNote>Starts at $149/mo (founding), then $400-$500/mo post-founding</CustomPriceNote>
          ) : (
            <>
              <PlanPrice>
                ${displayPrice}<span>/{billingPeriod === 'year' ? 'mo' : 'month'}</span>
              </PlanPrice>
              {billingPeriod === 'year' && (
                <PlanPeriod>
                  ${yearlyTotal} billed annually
                </PlanPeriod>
              )}
            </>
          )}
        </PlanHeader>

        <PlanDescription>
          {plan.id === 'community' && 'Great for validating value with meaningful monthly usage'}
          {plan.id === 'professional' && 'Founding members lock in $99/mo forever (post-founding list: $200/mo)'}
          {plan.id === 'custom' && 'Scoped on a call with limits set at signup'}
        </PlanDescription>

        {typeof plan.trialDays === 'number' && plan.trialDays > 0 && (
          <TrialNote>
            Includes a {plan.trialDays}-day free trial.
          </TrialNote>
        )}

        <FeaturesList>
          {plan.features.map((feature, index) => (
            <FeatureItem key={index}>
              <Check size={18} />
              <span>{feature}</span>
            </FeatureItem>
          ))}
        </FeaturesList>

        <SelectButton $selected={isSelected}>
          {isSelected ? 'Selected' : 'Select Plan'}
        </SelectButton>
      </PlanCard>
    );
  };

  return (
    <Container>
      <Header>
        <Title>Choose your plan</Title>
        <Subtitle>Start free, upgrade as you grow</Subtitle>
      </Header>

      {/* Billing Toggle */}
      <BillingToggle>
        <ToggleLabel $active={billingPeriod === 'month'}>
          Monthly
        </ToggleLabel>
        <ToggleSwitch
          $isYearly={billingPeriod === 'year'}
          onClick={() => onBillingPeriodChange(billingPeriod === 'month' ? 'year' : 'month')}
          type="button"
        />
        <ToggleLabel $active={billingPeriod === 'year'}>
          Yearly
        </ToggleLabel>
        {billingPeriod === 'year' && (
          <SaveBadge>
            <Sparkles size={12} />
            Save 20%
          </SaveBadge>
        )}
      </BillingToggle>

      <PlansGrid>
        {renderPlanCard(SUBSCRIPTION_PLANS.community, false)}
        {renderPlanCard(SUBSCRIPTION_PLANS.professional, true)}
        {renderPlanCard(SUBSCRIPTION_PLANS.custom, false)}
      </PlansGrid>

      {selectedPlan === 'custom' && (
        <CustomLimitsContainer>
          <CustomLimitsTitle>Set Custom Subscription Limits</CustomLimitsTitle>
          <CustomLimitsSubtitle>
            Set your hard-cap limits for custom. You can optionally enable flat-rate overage billing.
          </CustomLimitsSubtitle>
          <CustomLimitsGrid>
            <LimitInputGroup>
              <LimitLabel htmlFor="custom-team-members">Team Members</LimitLabel>
              <LimitInput
                id="custom-team-members"
                type="number"
                min={1}
                placeholder="e.g. 5"
                value={customLimits.teamMembers ?? ''}
                onChange={(e) => handleCustomLimitChange('teamMembers', e.target.value)}
              />
            </LimitInputGroup>
            <LimitInputGroup>
              <LimitLabel htmlFor="custom-projects">Projects</LimitLabel>
              <LimitInput
                id="custom-projects"
                type="number"
                min={1}
                placeholder="e.g. 3"
                value={customLimits.projects ?? ''}
                onChange={(e) => handleCustomLimitChange('projects', e.target.value)}
              />
            </LimitInputGroup>
            <LimitInputGroup>
              <LimitLabel htmlFor="custom-monthly-runs">Monthly Test Runs</LimitLabel>
              <LimitInput
                id="custom-monthly-runs"
                type="number"
                min={1}
                placeholder="e.g. 200"
                value={customLimits.monthlyTestRuns ?? ''}
                onChange={(e) => handleCustomLimitChange('monthlyTestRuns', e.target.value)}
              />
            </LimitInputGroup>
            <LimitInputGroup>
              <LimitLabel htmlFor="custom-ai-requests">AI Requests / Month</LimitLabel>
              <LimitInput
                id="custom-ai-requests"
                type="number"
                min={1}
                placeholder="e.g. 5000"
                value={customLimits.aiRequestsPerMonth ?? ''}
                onChange={(e) => handleCustomLimitChange('aiRequestsPerMonth', e.target.value)}
              />
            </LimitInputGroup>
          </CustomLimitsGrid>
          <CheckboxRow htmlFor="custom-overage-billing">
            <CheckboxInput
              id="custom-overage-billing"
              type="checkbox"
              checked={customLimits.overageBilling ?? false}
              onChange={(e) =>
                onCustomLimitsChange({
                  ...customLimits,
                  overageBilling: e.target.checked,
                })
              }
            />
            <span>Enable flat-rate overage billing (+$100/mo)</span>
          </CheckboxRow>
          <EstimateBox>
            <EstimateLabel>Estimated custom pricing</EstimateLabel>
            <EstimateValue>
              ${customEstimate.monthlyEstimate}/mo
            </EstimateValue>
            <EstimateSubtext>
              {billingPeriod === 'year'
                ? `Billed annually at $${customEstimate.billedAmount}/year (20% annual discount applied).`
                : `Billed monthly at approximately $${customEstimate.billedAmount}/month.`}
            </EstimateSubtext>
            <EstimateSubtext>
              Hard-cap enforcement is default when overage billing is not enabled.
            </EstimateSubtext>
          </EstimateBox>
          {customLimitsError && <InlineErrorMessage>{customLimitsError}</InlineErrorMessage>}
        </CustomLimitsContainer>
      )}
    </Container>
  );
};
