import React from 'react';
import styled from 'styled-components';
import { AlertCircle, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';

const ErrorContainer = styled.div<{ $severity: 'error' | 'warning' }>`
  background: ${props => props.$severity === 'error' ? '#fef2f2' : '#fffbeb'};
  border: 2px solid ${props => props.$severity === 'error' ? '#fecaca' : '#fef3c7'};
  border-radius: 12px;
  padding: 20px;
  margin: 16px 0;
`;

const ErrorHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
`;

const IconWrapper = styled.div<{ $severity: 'error' | 'warning' }>`
  flex-shrink: 0;
  color: ${props => props.$severity === 'error' ? '#A32D2D' : '#f59e0b'};
`;

const ErrorContent = styled.div`
  flex: 1;
`;

const ErrorTitle = styled.h4`
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
`;

const ErrorMessage = styled.p`
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #4b5563;
  line-height: 1.5;
`;

const SuggestionsTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
`;

const SuggestionsList = styled.ul`
  margin: 0;
  padding-left: 20px;
  
  li {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 4px;
    line-height: 1.4;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  background: ${props => props.$variant === 'primary' 
    ? '#185FA5' 
    : 'transparent'};
  color: ${props => props.$variant === 'primary' ? 'white' : '#185FA5'};
  border: ${props => props.$variant === 'primary' ? 'none' : '2px solid #185FA5'};
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
`;

const TechnicalDetails = styled.details`
  margin-top: 12px;
  
  summary {
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
    user-select: none;
    padding: 4px 0;
    
    &:hover {
      color: #374151;
    }
  }
`;

const CodeBlock = styled.pre`
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
  overflow-x: auto;
  font-size: 12px;
  font-family: 'Monaco', 'Courier New', monospace;
  color: #1f2937;
  position: relative;
`;

const CopyButton = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f9fafb;
  }
`;

export interface ErrorDetails {
  title: string;
  message: string;
  suggestions?: string[];
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
    icon?: React.ReactNode;
  }>;
  technicalDetails?: string;
  severity?: 'error' | 'warning';
}

export const ActionableError: React.FC<ErrorDetails> = ({
  title,
  message,
  suggestions,
  actions,
  technicalDetails,
  severity = 'error',
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (technicalDetails) {
      navigator.clipboard.writeText(technicalDetails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ErrorContainer $severity={severity}>
      <ErrorHeader>
        <IconWrapper $severity={severity}>
          <AlertCircle size={24} />
        </IconWrapper>
        <ErrorContent>
          <ErrorTitle>{title}</ErrorTitle>
          <ErrorMessage>{message}</ErrorMessage>
          
          {suggestions && suggestions.length > 0 && (
            <>
              <SuggestionsTitle>Try these solutions:</SuggestionsTitle>
              <SuggestionsList>
                {suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </SuggestionsList>
            </>
          )}
          
          {actions && actions.length > 0 && (
            <ActionButtons>
              {actions.map((action, index) => (
                <ActionButton
                  key={index}
                  onClick={action.onClick}
                  $variant={action.variant || 'secondary'}
                >
                  {action.icon}
                  {action.label}
                </ActionButton>
              ))}
            </ActionButtons>
          )}
          
          {technicalDetails && (
            <TechnicalDetails>
              <summary>Technical Details</summary>
              <CodeBlock>
                <CopyButton onClick={handleCopy}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy'}
                </CopyButton>
                {technicalDetails}
              </CodeBlock>
            </TechnicalDetails>
          )}
        </ErrorContent>
      </ErrorHeader>
    </ErrorContainer>
  );
};

// Helper function to create common error scenarios
export const createErrorDetails = {
  elementNotFound: (elementName: string, onRetry?: () => void, onUpdateSelector?: () => void): ErrorDetails => ({
    title: 'Element Not Found',
    message: `Unable to locate element "${elementName}". This usually happens when the page structure has changed or the selector is outdated.`,
    suggestions: [
      'Re-record the element using the Chrome extension',
      'Update the element selector manually',
      'Check if the element is inside an iframe or shadow DOM',
      'Verify the page has fully loaded before running the test',
    ],
    actions: [
      ...(onRetry ? [{
        label: 'Retry',
        onClick: onRetry,
        variant: 'primary' as const,
        icon: <RefreshCw size={14} />,
      }] : []),
      ...(onUpdateSelector ? [{
        label: 'Update Selector',
        onClick: onUpdateSelector,
        variant: 'secondary' as const,
      }] : []),
    ],
    severity: 'error',
  }),

  generationFailed: (reason: string, onRetry?: () => void): ErrorDetails => ({
    title: 'Test Generation Failed',
    message: `Could not generate test: ${reason}`,
    suggestions: [
      'Make your prompt more specific',
      'Ensure all required elements exist',
      'Check that the page context is properly defined',
      'Try breaking down complex flows into smaller steps',
    ],
    actions: onRetry ? [{
      label: 'Try Again',
      onClick: onRetry,
      variant: 'primary' as const,
      icon: <RefreshCw size={14} />,
    }] : undefined,
    severity: 'error',
  }),

  apiError: (statusCode: number, message: string, onContactSupport?: () => void): ErrorDetails => ({
    title: 'API Error',
    message: `Request failed with status ${statusCode}: ${message}`,
    suggestions: [
      'Check your internet connection',
      'Try refreshing the page',
      'Clear your browser cache',
      'Contact support if the issue persists',
    ],
    actions: onContactSupport ? [{
      label: 'Contact Support',
      onClick: onContactSupport,
      variant: 'secondary' as const,
      icon: <ExternalLink size={14} />,
    }] : undefined,
    technicalDetails: `HTTP ${statusCode}\n${message}`,
    severity: 'error',
  }),

  validationWarning: (issues: string[]): ErrorDetails => ({
    title: 'Validation Issues',
    message: 'The test has some potential issues that may affect reliability:',
    suggestions: issues,
    severity: 'warning',
  }),
};
