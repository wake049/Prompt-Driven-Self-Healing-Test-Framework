import React from 'react';
import styled from 'styled-components';
import { LucideIcon } from 'lucide-react';

const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
  min-height: 300px;
`;

const IconWrapper = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #185FA515 0%, #185FA515 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  
  svg {
    color: #185FA5;
    width: 40px;
    height: 40px;
  }
`;

const Title = styled.h3`
  font-size: 24px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 12px 0;
`;

const Description = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0 0 32px 0;
  max-width: 500px;
  line-height: 1.5;
`;

const ActionButton = styled.button`
  background: #185FA5;
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
  }
`;

const SecondaryActions = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
  justify-content: center;
`;

const SecondaryButton = styled.button`
  background: transparent;
  color: ${props => props.theme.colors.primary};
  border: 2px solid ${props => props.theme.colors.primary};
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.colors.primary}10;
  }
`;

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryActions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryActions,
}) => {
  return (
    <EmptyStateContainer>
      <IconWrapper>
        <Icon />
      </IconWrapper>
      <Title>{title}</Title>
      <Description>{description}</Description>
      {primaryAction && (
        <ActionButton onClick={primaryAction.onClick}>
          {primaryAction.label}
        </ActionButton>
      )}
      {secondaryActions && secondaryActions.length > 0 && (
        <SecondaryActions>
          {secondaryActions.map((action, index) => (
            <SecondaryButton key={index} onClick={action.onClick}>
              {action.label}
            </SecondaryButton>
          ))}
        </SecondaryActions>
      )}
    </EmptyStateContainer>
  );
};
