import React from 'react';
import styled from 'styled-components';

const BrowserMultiSelectContainer = styled.div`
  margin: 16px 0;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px;
`;

const BrowserGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`;

const BrowserOption = styled.label<{ checked: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border: 2px solid ${props => props.checked ? '#185FA5' : '#dee2e6'};
  border-radius: 8px;
  background: ${props => props.checked ? 'rgba(102, 126, 234, 0.1)' : '#ffffff'};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #185FA5;
    background: rgba(102, 126, 234, 0.05);
  }

  input {
    margin-right: 10px;
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  span {
    font-size: 14px;
    font-weight: 500;
    color: #495057;
  }

  .browser-emoji {
    font-size: 20px;
    margin-right: 8px;
  }
`;

const Description = styled.p`
  font-size: 12px;
  color: #6c757d;
  margin-top: 8px;
  margin-bottom: 0;
`;

interface BrowserMultiSelectProps {
  value: string[];
  onChange: (browsers: string[]) => void;
  disabled?: boolean;
}

const browsers = [
  { value: 'chrome', label: 'Chrome', emoji: '🌐' },
  { value: 'firefox', label: 'Firefox', emoji: '🦊' },
  { value: 'edge', label: 'Microsoft Edge', emoji: '🌊' },
  { value: 'safari', label: 'Safari', emoji: '🧭' }
];

export const BrowserMultiSelect: React.FC<BrowserMultiSelectProps> = ({
  value = ['chrome'],
  onChange,
  disabled = false
}) => {
  const handleToggle = (browserValue: string) => {
    if (disabled) return;

    const newValue = value.includes(browserValue)
      ? value.filter(b => b !== browserValue)
      : [...value, browserValue];

    // Ensure at least one browser is selected
    if (newValue.length > 0) {
      onChange(newValue);
    }
  };

  return (
    <BrowserMultiSelectContainer>
      <Label>Preferred Browsers</Label>
      <BrowserGrid>
        {browsers.map(browser => (
          <BrowserOption
            key={browser.value}
            checked={value.includes(browser.value)}
          >
            <input
              type="checkbox"
              checked={value.includes(browser.value)}
              onChange={() => handleToggle(browser.value)}
              disabled={disabled}
            />
            <span className="browser-emoji">{browser.emoji}</span>
            <span>{browser.label}</span>
          </BrowserOption>
        ))}
      </BrowserGrid>
      <Description>
        Select browsers for test execution. Tests will run on the first available browser from this list.
      </Description>
    </BrowserMultiSelectContainer>
  );
};

export default BrowserMultiSelect;
