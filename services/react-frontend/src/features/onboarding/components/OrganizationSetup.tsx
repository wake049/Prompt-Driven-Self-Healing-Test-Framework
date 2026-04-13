import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Building2, Users, Globe, Briefcase, AlertCircle, CheckCircle } from 'lucide-react';
import { OrganizationData } from '../types';
import { ORGANIZATION_SIZES, INDUSTRIES } from '../config';

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

  svg {
    color: #185FA5;
  }
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

const Select = styled.select`
  padding: 14px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #185FA5;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  }
`;

const HelperText = styled.div`
  font-size: 13px;
  color: #666;
  margin-top: 4px;
  display: flex;
  align-items: flex-start;
  gap: 6px;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const SlugPreview = styled.div<{ $available?: boolean; $error?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: ${props => props.$error ? '#fee' : props.$available ? '#f0fdf4' : '#f8f9fa'};
  border: 1px solid ${props => props.$error ? '#fed7d7' : props.$available ? '#86efac' : '#e1e5e9'};
  border-radius: 8px;
  font-size: 14px;
  margin-top: 8px;

  svg {
    color: ${props => props.$error ? '#c53030' : props.$available ? '#1D9E75' : '#666'};
  }

  code {
    font-family: 'Monaco', 'Menlo', monospace;
    color: ${props => props.$error ? '#c53030' : '#185FA5'};
    font-weight: 600;
  }
`;

const OptionalBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  background: #f1f3f5;
  color: #868e96;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: 8px;
`;

const InfoBox = styled.div`
  padding: 16px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 8px;
  font-size: 14px;
  color: #555;
  line-height: 1.6;
  
  strong {
    color: #185FA5;
  }
`;

interface OrganizationSetupProps {
  data: OrganizationData;
  onChange: (data: OrganizationData) => void;
  errors?: Partial<Record<keyof OrganizationData, string>>;
}

export const OrganizationSetup: React.FC<OrganizationSetupProps> = ({
  data,
  onChange,
  errors = {}
}) => {
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Auto-generate slug from organization name
  useEffect(() => {
    if (data.name && !data.slug) {
      const generatedSlug = data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      onChange({ ...data, slug: generatedSlug });
    }
  }, [data.name]);

  // Check slug availability (simulated - replace with actual API call)
  useEffect(() => {
    if (data.slug && data.slug.length >= 3) {
      setCheckingSlug(true);
      const timer = setTimeout(() => {
        // Simulate API call
        // In production: call your API to check if slug is available
        const isAvailable = !['test', 'admin', 'api', 'www'].includes(data.slug.toLowerCase());
        setSlugAvailable(isAvailable);
        setCheckingSlug(false);
      }, 500);

      return () => clearTimeout(timer);
    } else {
      setSlugAvailable(null);
    }
  }, [data.slug]);

  const handleChange = (field: keyof OrganizationData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleSlugChange = (value: string) => {
    // Sanitize slug input
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-')
      .substring(0, 50);
    
    onChange({ ...data, slug: sanitized });
  };

  return (
    <Container>
      <Header>
        <Title>Set up your organization</Title>
        <Subtitle>Optional business details for your workspace</Subtitle>
      </Header>

      <Form>
        <FormGroup>
          <Label htmlFor="orgName">
            <Building2 size={16} />
            Organization Name
            <OptionalBadge>Optional</OptionalBadge>
          </Label>
          <Input
            id="orgName"
            type="text"
            value={data.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Acme Inc."
            required
          />
          {errors.name && (
            <HelperText style={{ color: '#c53030' }}>
              <AlertCircle size={14} />
              {errors.name}
            </HelperText>
          )}
        </FormGroup>

        <FormGroup>
          <Label htmlFor="orgSlug">
            <Globe size={16} />
              Organization Slug
              <OptionalBadge>Optional</OptionalBadge>
          </Label>
          <Input
            id="orgSlug"
            type="text"
            value={data.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="acme-inc"
            required
            pattern="[a-z0-9\-]+"
          />
          <HelperText>
            This will be your unique workspace identifier. Only lowercase letters, numbers, and hyphens.
          </HelperText>
          
          {data.slug && (
            <SlugPreview 
              $available={slugAvailable === true} 
              $error={slugAvailable === false || !!errors.slug}
            >
              {checkingSlug ? (
                <>Checking availability...</>
              ) : slugAvailable === true ? (
                <>
                  <CheckCircle size={16} />
                  <span>fluxtest.io/<code>{data.slug}</code> is available</span>
                </>
              ) : slugAvailable === false ? (
                <>
                  <AlertCircle size={16} />
                  <span>This slug is already taken</span>
                </>
              ) : errors.slug ? (
                <>
                  <AlertCircle size={16} />
                  <span>{errors.slug}</span>
                </>
              ) : null}
            </SlugPreview>
          )}
        </FormGroup>

        <FormGroup>
          <Label htmlFor="industry">
            <Briefcase size={16} />
            Industry
            <OptionalBadge>Optional</OptionalBadge>
          </Label>
          <Select
            id="industry"
            value={data.industry || ''}
            onChange={(e) => handleChange('industry', e.target.value)}
          >
            <option value="">Select industry...</option>
            {INDUSTRIES.map(industry => (
              <option key={industry.value} value={industry.value}>
                {industry.label}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="size">
            <Users size={16} />
            Company Size
            <OptionalBadge>Optional</OptionalBadge>
          </Label>
          <Select
            id="size"
            value={data.size || ''}
            onChange={(e) => handleChange('size', e.target.value)}
          >
            <option value="">Select size...</option>
            {ORGANIZATION_SIZES.map(size => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup>
          <Label htmlFor="website">
            <Globe size={16} />
            Website
            <OptionalBadge>Optional</OptionalBadge>
          </Label>
          <Input
            id="website"
            type="url"
            value={data.website || ''}
            onChange={(e) => handleChange('website', e.target.value)}
            placeholder="https://www.example.com"
          />
        </FormGroup>

        <InfoBox>
          <strong>Why organization details?</strong> This helps us personalize your experience 
          and provide relevant features. You can always update this later in settings.
        </InfoBox>
      </Form>
    </Container>
  );
};
