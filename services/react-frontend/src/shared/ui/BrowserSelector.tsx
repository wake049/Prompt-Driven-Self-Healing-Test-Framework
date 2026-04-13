import React from 'react';
import styled, { css } from 'styled-components';
import { Monitor, Chrome as ChromeIcon } from 'lucide-react';

const BrowserContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const BrowserLabel = styled.label<{ $variant?: 'default' | 'header' }>`
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.$variant === 'header' ? 'rgba(255, 255, 255, 0.9)' : props.theme.colors.textSecondary};
  display: flex;
  align-items: center;
  gap: 6px;
`;

const headerStyles = css`
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  
  &:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  &:focus {
    border-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
  }
  
  option {
    background: #1a1a2e;
    color: white;
  }
`;

const defaultStyles = css`
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  border: 1px solid ${props => props.theme.colors.border};
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
  }
  
  &:focus {
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const BrowserSelect = styled.select<{ $variant?: 'default' | 'header' }>`
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 140px;
  outline: none;
  
  ${props => props.$variant === 'header' ? headerStyles : defaultStyles}

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

export interface BrowserSelectorProps {
  value: string;
  onChange: (browser: string) => void;
  disabled?: boolean;
  label?: string;
  showIcon?: boolean;
  variant?: 'default' | 'header';
}

const browsers = [
  { value: 'chrome', label: 'Chrome' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'edge', label: 'Microsoft Edge' },
  { value: 'safari', label: 'Safari' }
];

export const BrowserSelector: React.FC<BrowserSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  label = 'Browser',
  showIcon = true,
  variant = 'default'
}) => {
  return (
    <BrowserContainer>
      {showIcon && (
        <BrowserLabel $variant={variant}>
          <Monitor size={16} />
          {label}:
        </BrowserLabel>
      )}
      <BrowserSelect
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        $variant={variant}
      >
        {browsers.map(browser => (
          <option key={browser.value} value={browser.value}>
            {browser.label}
          </option>
        ))}
      </BrowserSelect>
    </BrowserContainer>
  );
};

export default BrowserSelector;
