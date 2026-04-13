import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { spinKeyframes } from '../../shared/styles/keyframes';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { config } from '../../app/config';

const RegisterContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #185FA5;
`;

const RegisterCard = styled.div`
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
`;

const Title = styled.h1`
  text-align: center;
  color: #333;
  margin-bottom: 30px;
  font-size: 28px;
  font-weight: 600;
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
  font-weight: 500;
  color: #555;
  font-size: 14px;
`;

const Input = styled.input`
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #185FA5;
  }

  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
`;

const SubmitButton = styled.button`
  background: #185FA5;
  color: white;
  border: none;
  padding: 14px 20px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  margin-top: 10px;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const ErrorMessage = styled.div`
  background: #fee;
  color: #c53030;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #fed7d7;
  font-size: 14px;
  margin-bottom: 16px;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  border-top-color: transparent;
  animation: ${spinKeyframes} 1s ease-in-out infinite;
  margin-right: 8px;
`;

const LoginLink = styled.div`
  text-align: center;
  margin-top: 20px;
  color: #666;
  font-size: 14px;

  a {
    color: #185FA5;
    text-decoration: none;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const InvitationBanner = styled.div`
  background: #185FA5;
  color: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  text-align: center;

  h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 600;
  }

  p {
    margin: 0;
    font-size: 14px;
    opacity: 0.95;
  }
`;

const RegistrationTypeSelector = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  padding: 4px;
  background: #f9fafb;
`;

const TypeButton = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${props => props.active ? 'white' : 'transparent'};
  color: ${props => props.active ? '#185FA5' : '#666'};
  box-shadow: ${props => props.active ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'};

  &:hover {
    color: #185FA5;
  }
`;

const Subtitle = styled.p`
  text-align: center;
  color: #666;
  margin: -15px 0 20px 0;
  font-size: 14px;
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

const TermsLinks = styled.span`
  a {
    color: #185FA5;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

interface InvitationDetails {
  organization_name: string;
  role: string;
  expires_at: string;
  email: string | null;
}

const Register: React.FC = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  
  const [registrationType, setRegistrationType] = useState<'individual' | 'organization'>('individual');
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null);
  const [loadingInvitation, setLoadingInvitation] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    organizationName: '',
    organizationSlug: '',
    termsAccepted: false,
  });
  const [validationError, setValidationError] = useState('');
  const { register, registerOrganization, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!inviteToken) {
      navigate('/onboarding', { replace: true });
    }
  }, [inviteToken, navigate]);

  // Fetch invitation details if token present
  useEffect(() => {
    const fetchInvitationDetails = async () => {
      if (!inviteToken) return;
      
      setLoadingInvitation(true);
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/api/v1/auth/invitation/${inviteToken}`
        );
        
        if (response.ok) {
          const details = await response.json();
          setInvitationDetails(details);
          // Pre-fill email if invitation is restricted
          if (details.email) {
            setFormData(prev => ({ ...prev, email: details.email }));
          }
        } else {
          setValidationError('Invalid or expired invitation link');
        }
      } catch (err) {
        setValidationError('Failed to load invitation details');
      } finally {
        setLoadingInvitation(false);
      }
    };

    fetchInvitationDetails();
  }, [inviteToken]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setValidationError('');
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.confirmPassword || !formData.fullName) {
      setValidationError('All fields are required');
      return false;
    }

    if (registrationType === 'organization' && !formData.organizationName) {
      setValidationError('Organization name is required');
      return false;
    }

    if (formData.password.length < 10) {
      setValidationError('Password must be at least 10 characters');
      return false;
    }

    if (/\s/.test(formData.password)) {
      setValidationError('Password cannot contain spaces');
      return false;
    }

    if (!/[A-Z]/.test(formData.password)) {
      setValidationError('Password must include at least one uppercase letter');
      return false;
    }

    if (!/[a-z]/.test(formData.password)) {
      setValidationError('Password must include at least one lowercase letter');
      return false;
    }

    if (!/\d/.test(formData.password)) {
      setValidationError('Password must include at least one number');
      return false;
    }

    if (!/[^A-Za-z0-9]/.test(formData.password)) {
      setValidationError('Password must include at least one special character');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }

    if (!formData.termsAccepted) {
      setValidationError('You must accept the Terms of Service, Privacy Policy, and Licensing Agreement');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    if (!inviteToken) {
      navigate('/onboarding', { replace: true });
      return;
    }

    if (!validateForm()) {
      return;
    }

    let success = false;
    
    if (registrationType === 'organization') {
      // Organization registration
      success = await registerOrganization(
        formData.email,
        formData.password,
        formData.fullName,
        formData.organizationName,
        formData.termsAccepted,
        formData.organizationSlug
      );
    } else {
      // Individual registration (with optional invitation)
      const result = await register(
        formData.email,
        formData.password,
        formData.fullName,
        formData.termsAccepted,
        inviteToken || undefined
      );
      success = result.success;
    }
    
    if (success) {
      navigate('/app');
    }
  };

  const displayError = validationError || error;

  return (
    <RegisterContainer>
      <RegisterCard>
        <Title>{invitationDetails ? 'Join Team' : 'Create Your Account'}</Title>
        
        {loadingInvitation && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            <LoadingSpinner /> Loading invitation details...
          </div>
        )}
        
        {invitationDetails && (
          <InvitationBanner>
            <h3>🎉 You're invited!</h3>
            <p>
              Join <strong>{invitationDetails.organization_name}</strong> as a{' '}
              <strong>{invitationDetails.role}</strong>
            </p>
          </InvitationBanner>
        )}
        
        {!invitationDetails && !loadingInvitation && (
          <>
            <Subtitle>Sign up as an individual or create an organization</Subtitle>
            <RegistrationTypeSelector>
              <TypeButton
                type="button"
                active={registrationType === 'individual'}
                onClick={() => setRegistrationType('individual')}
              >
                👤 Individual
              </TypeButton>
              <TypeButton
                type="button"
                active={registrationType === 'organization'}
                onClick={() => setRegistrationType('organization')}
              >
                🏢 Organization
              </TypeButton>
            </RegistrationTypeSelector>
          </>
        )}
        
        {displayError && <ErrorMessage>{displayError}</ErrorMessage>}
        
        <Form onSubmit={handleSubmit}>
          <FormGroup>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              disabled={isLoading}
              required
            />
          </FormGroup>

          {registrationType === 'organization' && (
            <>
              <FormGroup>
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  value={formData.organizationName}
                  onChange={handleChange}
                  placeholder="e.g., Acme Corp"
                  disabled={isLoading}
                  required
                />
              </FormGroup>

              <FormGroup>
                <Label htmlFor="organizationSlug">Organization Slug (Optional)</Label>
                <Input
                  id="organizationSlug"
                  name="organizationSlug"
                  type="text"
                  value={formData.organizationSlug}
                  onChange={handleChange}
                  placeholder="e.g., acme-corp (auto-generated if empty)"
                  disabled={isLoading}
                />
              </FormGroup>
            </>
          )}

          <FormGroup>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              disabled={isLoading || (!!invitationDetails?.email)}
              required
            />
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min 10 chars, upper/lower/number/special"
              disabled={isLoading}
              required
            />
          </FormGroup>

          <FormGroup>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              disabled={isLoading}
              required
            />
          </FormGroup>

          <FormGroup>
            <TermsRow htmlFor="termsAccepted">
              <TermsCheckbox
                id="termsAccepted"
                name="termsAccepted"
                type="checkbox"
                checked={formData.termsAccepted}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, termsAccepted: e.target.checked }));
                  setValidationError('');
                }}
                disabled={isLoading}
              />
              <TermsLinks>
                I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>, <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>, and <Link to="/licensing" target="_blank" rel="noopener noreferrer">Licensing Agreement</Link>.
              </TermsLinks>
            </TermsRow>
          </FormGroup>
          
          <SubmitButton type="submit" disabled={isLoading || loadingInvitation}>
            {isLoading && <LoadingSpinner />}
            {isLoading ? 'Creating Account...' : 
             invitationDetails ? 'Join Organization' :
             registrationType === 'organization' ? 'Create Organization' : 'Sign Up'}
          </SubmitButton>
        </Form>
        
        <LoginLink>
          Already have an account? <Link to="/login">Sign in</Link>
        </LoginLink>
      </RegisterCard>
    </RegisterContainer>
  );
};

export default Register;