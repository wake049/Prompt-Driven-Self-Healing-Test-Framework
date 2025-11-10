import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { selectorPolicyService } from '../../../shared/services/selectorPolicyService';
import type { DualSelector, PolicyBasedSelection } from '../../../shared/services/selectorPolicyService';
const PolicyDemoContainer = styled.div`
  background: ${props => props.theme.colors.surface};
  border-radius: 12px;
  padding: 24px;
  margin: 16px 0;
  border: 1px solid ${props => props.theme.colors.border};
`;
const DemoTitle = styled.h3`
  margin: 0 0 16px 0;
  color: ${props => props.theme.colors.text};
  font-size: 18px;
  font-weight: 600;
`;
const SelectorInput = styled.div`
  margin: 12px 0;
`;
const SelectorLabel = styled.label`
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  color: ${props => props.theme.colors.text};
  font-size: 14px;
`;
const SelectorField = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 6px;
  font-family: 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
  font-size: 12px;
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }
`;
const TestButton = styled.button`
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;
const ResultContainer = styled.div`
  background: ${props => props.theme.colors.background};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
`;
const ResultLabel = styled.div`
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin-bottom: 8px;
  font-size: 14px;
`;
const SelectedSelector = styled.div<{ type: 'css' | 'xpath' }>`
  background: ${props => {
    const isDark = props.theme.colors.surface === '#2d3748';
    if (props.type === 'css') {
      return isDark ? '#2a4365' : '#dbeafe';
    } else {
      return isDark ? '#744210' : '#fef3c7';
    }
  }};
  color: ${props => {
    const isDark = props.theme.colors.surface === '#2d3748';
    if (props.type === 'css') {
      return isDark ? '#63b3ed' : '#1e40af';
    } else {
      return isDark ? '#fbbf24' : '#92400e';
    }
  }};
  padding: 8px 12px;
  border-radius: 6px;
  font-family: 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
  font-size: 12px;
  border-left: 3px solid ${props => {
    const isDark = props.theme.colors.surface === '#2d3748';
    if (props.type === 'css') {
      return isDark ? '#63b3ed' : '#3b82f6';
    } else {
      return isDark ? '#fbbf24' : '#f59e0b';
    }
  }};
  margin-bottom: 8px;
`;
const ReasoningText = styled.div`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 12px;
  font-style: italic;
`;
const FallbackIndicator = styled.div<{ available: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: ${props => {
    const isDark = props.theme.colors.surface === '#2d3748';
    if (props.available) {
      return isDark ? '#22543d' : '#d1fae5';
    } else {
      return isDark ? '#742a2a' : '#fee2e2';
    }
  }};
  color: ${props => {
    const isDark = props.theme.colors.surface === '#2d3748';
    if (props.available) {
      return isDark ? '#68d391' : '#065f46';
    } else {
      return isDark ? '#fc8181' : '#991b1b';
    }
  }};
  margin-top: 8px;
`;
const PolicyStatus = styled.div<{ preference: string }>`
  background: ${props => {
    const isDark = props.theme.colors.surface === '#2d3748';
    if (props.preference === 'css') {
      return isDark ? 'linear-gradient(135deg, #2a4365, #2c5282)' : 'linear-gradient(135deg, #dbeafe, #bfdbfe)';
    } else {
      return isDark ? 'linear-gradient(135deg, #744210, #975a16)' : 'linear-gradient(135deg, #fef3c7, #fde68a)';
    }
  }};
  color: ${props => {
    const isDark = props.theme.colors.surface === '#2d3748';
    if (props.preference === 'css') {
      return isDark ? '#63b3ed' : '#1e40af';
    } else {
      return isDark ? '#fbbf24' : '#92400e';
    }
  }};
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 16px;
  border: 1px solid ${props => {
    const isDark = props.theme.colors.surface === '#2d3748';
    if (props.preference === 'css') {
      return isDark ? '#4299e1' : '#93c5fd';
    } else {
      return isDark ? '#f6ad55' : '#fbbf24';
    }
  }};
`;
const SelectorPolicyDemo: React.FC = () => {
  const [cssSelector, setCssSelector] = useState('#login-button');
  const [xpathSelector, setXpathSelector] = useState('//button[@id="login-button"]');
  const [policyResult, setPolicyResult] = useState<PolicyBasedSelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState<string>('css');
  // Load current policy on mount
  useEffect(() => {
    const loadPolicy = async () => {
        const policy = await selectorPolicyService.loadPolicy();
        setCurrentPolicy(policy.preferCssOverXpath ? 'css' : 'xpath');
    };
    loadPolicy();
  }, []);
  const testPolicyApplication = async () => {
    if (!cssSelector && !xpathSelector) {
      alert('Please provide at least one selector');
      return;
    }
    setLoading(true);
    try {
      const dualSelector: DualSelector = {
        css_selector: cssSelector || undefined,
        xpath_selector: xpathSelector || undefined
      };
      const result = await selectorPolicyService.selectSelector(
        dualSelector,
        {
          promptId: 'demo-prompt',
          stepIndex: 0,
          action: 'click'
        }
      );
      setPolicyResult(result);
    } catch (error) {
      alert('Failed to apply policy. Check console for details.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <PolicyDemoContainer>
      <DemoTitle>🎯 Selector Policy Demo</DemoTitle>
      <PolicyStatus preference={currentPolicy}>
        Current Policy: Prefer {currentPolicy.toUpperCase()} selectors over {currentPolicy === 'css' ? 'XPath' : 'CSS'}
      </PolicyStatus>
      <SelectorInput>
        <SelectorLabel>CSS Selector:</SelectorLabel>
        <SelectorField
          type="text"
          value={cssSelector}
          onChange={(e) => setCssSelector(e.target.value)}
          placeholder="#element-id, .class-name, [attribute=value]"
        />
      </SelectorInput>
      <SelectorInput>
        <SelectorLabel>XPath Selector:</SelectorLabel>
        <SelectorField
          type="text"
          value={xpathSelector}
          onChange={(e) => setXpathSelector(e.target.value)}
          placeholder="//tag[@attribute='value']"
        />
      </SelectorInput>
      <TestButton 
        onClick={testPolicyApplication}
        disabled={loading || (!cssSelector && !xpathSelector)}
      >
        {loading ? '🔄 Applying Policy...' : '🎯 Apply Selector Policy'}
      </TestButton>
      {policyResult && (
        <ResultContainer>
          <ResultLabel>Policy Decision Result:</ResultLabel>
          <SelectedSelector type={policyResult.selectorType}>
            Selected: {policyResult.selectedSelector}
          </SelectedSelector>
          <ReasoningText>
            {policyResult.reasoning}
          </ReasoningText>
          <FallbackIndicator available={policyResult.fallbackAvailable}>
            {policyResult.fallbackAvailable ? '✅ Fallback Available' : '❌ No Fallback'}
          </FallbackIndicator>
        </ResultContainer>
      )}
    </PolicyDemoContainer>
  );
};
export default SelectorPolicyDemo;