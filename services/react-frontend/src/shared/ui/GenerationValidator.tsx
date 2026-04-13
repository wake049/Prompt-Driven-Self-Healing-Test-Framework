import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { AlertCircle, CheckCircle, XCircle, Loader, Lightbulb, FileText } from 'lucide-react';

const Container = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
`;

const Title = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ValidationItem = styled.div<{ $status: 'success' | 'warning' | 'error' | 'pending' }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: ${props => {
    switch (props.$status) {
      case 'success': return '#f0fdf4';
      case 'warning': return '#fffbeb';
      case 'error': return '#fef2f2';
      default: return '#f9fafb';
    }
  }};
  border-left: 4px solid ${props => {
    switch (props.$status) {
      case 'success': return '#1D9E75';
      case 'warning': return '#f59e0b';
      case 'error': return '#A32D2D';
      default: return '#6b7280';
    }
  }};
  border-radius: 8px;
  margin-bottom: 12px;
`;

const IconWrapper = styled.div<{ $status: 'success' | 'warning' | 'error' | 'pending' }>`
  flex-shrink: 0;
  color: ${props => {
    switch (props.$status) {
      case 'success': return '#1D9E75';
      case 'warning': return '#f59e0b';
      case 'error': return '#A32D2D';
      default: return '#6b7280';
    }
  }};
`;

const ItemContent = styled.div`
  flex: 1;
`;

const ItemTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: ${props => props.theme.colors.text};
  margin-bottom: 4px;
`;

const ItemMessage = styled.div`
  font-size: 13px;
  color: ${props => props.theme.colors.textSecondary};
  line-height: 1.4;
`;

const SuggestionBox = styled.div`
  background: #eff6ff;
  border: 2px solid #bfdbfe;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
`;

const SuggestionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: #1e40af;
  margin-bottom: 8px;
`;

const SuggestionList = styled.ul`
  margin: 0;
  padding-left: 20px;
  
  li {
    font-size: 13px;
    color: #1e3a8a;
    margin-bottom: 6px;
    line-height: 1.4;
  }
`;

const PreviewBox = styled.div`
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-top: 16px;
`;

const PreviewTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: ${props => props.theme.colors.text};
  margin-bottom: 12px;
`;

const PreviewContent = styled.pre`
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: ${props => props.theme.colors.text};
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 300px;
  overflow-y: auto;
`;

export interface ValidationCheck {
  id: string;
  title: string;
  message: string;
  status: 'success' | 'warning' | 'error' | 'pending';
}

interface GenerationValidatorProps {
  prompt: string;
  availableElements: string[];
  pageContext?: string;
  onValidationComplete: (isValid: boolean, checks: ValidationCheck[]) => void;
  showPreview?: boolean;
}

export const GenerationValidator: React.FC<GenerationValidatorProps> = ({
  prompt,
  availableElements,
  pageContext,
  onValidationComplete,
  showPreview = true,
}) => {
  const [checks, setChecks] = useState<ValidationCheck[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [preview, setPreview] = useState<string>('');

  useEffect(() => {
    performValidation();
  }, [prompt, availableElements, pageContext]);

  const performValidation = () => {
    const newChecks: ValidationCheck[] = [];

    // Check 1: Prompt clarity
    if (prompt.length < 10) {
      newChecks.push({
        id: 'prompt-length',
        title: 'Prompt Too Short',
        message: 'Your prompt is very brief. Add more details for better results.',
        status: 'warning',
      });
    } else if (prompt.length < 30) {
      newChecks.push({
        id: 'prompt-length',
        title: 'Prompt Could Be More Detailed',
        message: 'Consider adding more context about what you want to test.',
        status: 'warning',
      });
    } else {
      newChecks.push({
        id: 'prompt-length',
        title: 'Prompt Length Good',
        message: 'Your prompt has sufficient detail.',
        status: 'success',
      });
    }

    // Check 2: Element availability
    const mentionedElements = extractMentionedElements(prompt);
    const missingElements = mentionedElements.filter(
      elem => !availableElements.some(available => 
        available.toLowerCase().includes(elem.toLowerCase())
      )
    );

    if (missingElements.length > 0) {
      newChecks.push({
        id: 'elements',
        title: 'Missing Elements',
        message: `These elements might not exist: ${missingElements.join(', ')}`,
        status: 'error',
      });
    } else if (mentionedElements.length === 0) {
      newChecks.push({
        id: 'elements',
        title: 'No Specific Elements Mentioned',
        message: 'Consider referencing specific elements from your page.',
        status: 'warning',
      });
    } else {
      newChecks.push({
        id: 'elements',
        title: 'All Elements Available',
        message: `Found ${mentionedElements.length} element(s) in your library.`,
        status: 'success',
      });
    }

    // Check 3: Action verbs present
    const actionVerbs = ['click', 'type', 'fill', 'select', 'submit', 'verify', 'check', 'navigate', 'wait'];
    const hasActions = actionVerbs.some(verb => 
      prompt.toLowerCase().includes(verb)
    );

    if (!hasActions) {
      newChecks.push({
        id: 'actions',
        title: 'No Clear Actions',
        message: 'Include action verbs like "click", "type", "verify" for clearer instructions.',
        status: 'warning',
      });
    } else {
      newChecks.push({
        id: 'actions',
        title: 'Clear Actions Detected',
        message: 'Your prompt includes testable actions.',
        status: 'success',
      });
    }

    // Check 4: Complexity assessment
    const steps = prompt.split(/and then|then|next|after that/i).length;
    if (steps > 5) {
      newChecks.push({
        id: 'complexity',
        title: 'Complex Flow Detected',
        message: 'Consider breaking this into multiple smaller tests for better reliability.',
        status: 'warning',
      });
    } else {
      newChecks.push({
        id: 'complexity',
        title: 'Reasonable Complexity',
        message: `Test appears to have ${steps} step(s).`,
        status: 'success',
      });
    }

    setChecks(newChecks);

    // Generate suggestions
    const newSuggestions: string[] = [];
    if (mentionedElements.length === 0) {
      newSuggestions.push(`Try: "${prompt} using the ${availableElements[0] || 'login-button'}"`);
    }
    if (!hasActions) {
      newSuggestions.push('Add specific actions: "Click the button, then fill the form"');
    }
    if (steps > 5) {
      newSuggestions.push('Break into parts: "Test 1: Login" and "Test 2: Navigate to dashboard"');
    }
    setSuggestions(newSuggestions);

    // Generate preview
    if (showPreview) {
      setPreview(generatePreview(prompt, mentionedElements));
    }

    // Notify parent
    const hasErrors = newChecks.some(check => check.status === 'error');
    onValidationComplete(!hasErrors, newChecks);
  };

  const extractMentionedElements = (text: string): string[] => {
    // Simple extraction - look for quoted words or common element patterns
    const quoted = text.match(/"([^"]+)"|'([^']+)'/g) || [];
    return quoted.map(q => q.replace(/['"]/g, ''));
  };

  const generatePreview = (prompt: string, elements: string[]): string => {
    return `// Generated test preview (simplified)
describe('User Test', () => {
  it('should ${prompt.substring(0, 50)}...', async () => {
    // Step 1: Navigate to page
    await page.goto('${pageContext || 'https://example.com'}');
    
${elements.map((elem, i) => `    // Step ${i + 2}: Interact with ${elem}
    await page.click('[data-testid="${elem}"]');`).join('\n')}
    
    // Add verification steps
    // ...
  });
});`;
  };

  const getStatusIcon = (status: ValidationCheck['status']) => {
    switch (status) {
      case 'success': return <CheckCircle size={18} />;
      case 'warning': return <AlertCircle size={18} />;
      case 'error': return <XCircle size={18} />;
      case 'pending': return <Loader size={18} className="animate-spin" />;
    }
  };

  const isValid = !checks.some(check => check.status === 'error');

  return (
    <Container>
      <Title>
        {isValid ? <CheckCircle size={20} color="#1D9E75" /> : <AlertCircle size={20} color="#f59e0b" />}
        Validation Results
      </Title>

      {checks.map(check => (
        <ValidationItem key={check.id} $status={check.status}>
          <IconWrapper $status={check.status}>
            {getStatusIcon(check.status)}
          </IconWrapper>
          <ItemContent>
            <ItemTitle>{check.title}</ItemTitle>
            <ItemMessage>{check.message}</ItemMessage>
          </ItemContent>
        </ValidationItem>
      ))}

      {suggestions.length > 0 && (
        <SuggestionBox>
          <SuggestionTitle>
            <Lightbulb size={16} />
            Suggestions to Improve
          </SuggestionTitle>
          <SuggestionList>
            {suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </SuggestionList>
        </SuggestionBox>
      )}

      {showPreview && preview && (
        <PreviewBox>
          <PreviewTitle>
            <FileText size={16} />
            Test Preview
          </PreviewTitle>
          <PreviewContent>{preview}</PreviewContent>
        </PreviewBox>
      )}
    </Container>
  );
};
