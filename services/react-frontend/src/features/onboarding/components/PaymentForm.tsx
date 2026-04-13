import React, { useState } from 'react';
import styled from 'styled-components';
import { Lock, AlertCircle } from 'lucide-react';
import { config } from '../../../app/config';

const Container = styled.div`
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 40px;
`;

const Title = styled.h2`
  font-size: 28px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 12px 0;
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: #666;
  margin: 0;
`;

const SecurityBadge = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 8px;
  font-size: 14px;
  color: #0F6E56;
  font-weight: 600;
  margin-bottom: 32px;

  svg {
    color: #1D9E75;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
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

const CheckoutButton = styled.button`
  width: 100%;
  padding: 14px 18px;
  border: none;
  border-radius: 10px;
  background: #185FA5;
  color: white;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const InfoBox = styled.div`
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #f8f9fa;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  color: #555;
  line-height: 1.6;
  margin-top: 24px;

  svg {
    flex-shrink: 0;
    color: #185FA5;
    margin-top: 2px;
  }
`;

const OrderSummary = styled.div`
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
`;

const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  font-size: 15px;
  color: #333;

  &:not(:last-child) {
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }

  &:last-child {
    font-size: 18px;
    font-weight: 700;
    color: #185FA5;
    padding-top: 16px;
    margin-top: 8px;
  }
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: #fee;
  color: #c53030;
  border: 1px solid #fed7d7;
  border-radius: 8px;
  font-size: 14px;
  margin-top: 16px;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const PoweredByStripe = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
  font-size: 13px;
  color: #aaa;
  
  img {
    height: 20px;
    opacity: 0.7;
  }
`;

interface PaymentFormProps {
  planId: string;
  planName: string;
  amount: number;
  billingPeriod: 'month' | 'year';
  customerEmail: string;
  onPaymentComplete: (paymentMethodId: string) => void;
  onError?: (error: string) => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  planId,
  planName,
  amount,
  billingPeriod,
  customerEmail,
  onPaymentComplete,
  onError
}) => {
  const [cardholderName, setCardholderName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProcessing(true);

    try {
      const apiBase = config.apiBaseUrl;
      const currentUrl = window.location.origin + window.location.pathname;

      const response = await fetch(`${apiBase}/api/v1/billing/checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: planId,
          billing_period: billingPeriod,
          customer_email: customerEmail,
          success_url: `${currentUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${currentUrl}?checkout=cancelled`,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || 'Unable to start secure checkout');
      }

      if (!data?.checkout_url || !data?.session_id) {
        throw new Error('Checkout session was created without redirect URL');
      }

      onPaymentComplete(data.session_id);
      window.location.href = data.checkout_url;
    } catch (err: any) {
      const errorMessage = err.message || 'Payment processing failed';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const totalAmount = billingPeriod === 'year' ? amount * 12 : amount;
  const savings = billingPeriod === 'year' ? amount * 12 * 0.2 : 0;

  return (
    <Container>
      <Header>
        <Title>Payment details</Title>
        <Subtitle>Continue to secure Stripe checkout</Subtitle>
      </Header>

      <SecurityBadge>
        <Lock size={16} />
        Your payment information is secure and encrypted
      </SecurityBadge>

      <OrderSummary>
        <SummaryRow>
          <span>{planName} Plan</span>
          <span>${amount}/{billingPeriod === 'month' ? 'mo' : 'yr'}</span>
        </SummaryRow>
        {billingPeriod === 'year' && (
          <>
            <SummaryRow>
              <span>Billing Period</span>
              <span>Annual (12 months)</span>
            </SummaryRow>
            <SummaryRow>
              <span style={{ color: '#1D9E75' }}>Annual Savings (20%)</span>
              <span style={{ color: '#1D9E75' }}>-${savings.toFixed(2)}</span>
            </SummaryRow>
          </>
        )}
        <SummaryRow>
          <span>Total {billingPeriod === 'year' ? 'today' : 'per month'}</span>
          <span>${totalAmount.toFixed(2)}</span>
        </SummaryRow>
      </OrderSummary>

      <Form onSubmit={handleSubmit}>
        <FormGroup>
          <Label htmlFor="cardholderName">
            Billing contact name
          </Label>
          <Input
            id="cardholderName"
            type="text"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            placeholder="John Doe"
            required
          />
        </FormGroup>

        <CheckoutButton type="submit" disabled={processing || !customerEmail || !cardholderName.trim()}>
          {processing ? 'Redirecting to Stripe...' : 'Continue to Secure Checkout'}
        </CheckoutButton>

        {error && (
          <ErrorMessage>
            <AlertCircle size={16} />
            <span>{error}</span>
          </ErrorMessage>
        )}

        <InfoBox>
          <AlertCircle size={16} />
          <div>
            <strong>Note:</strong> Card details are collected on Stripe's hosted page. You'll return here after payment.
          </div>
        </InfoBox>
      </Form>

      <PoweredByStripe>
        Powered by
        <strong>Stripe</strong>
      </PoweredByStripe>
    </Container>
  );
};
