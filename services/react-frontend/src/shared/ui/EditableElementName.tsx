import React, { useState } from 'react';
import styled from 'styled-components';
import { Edit2, Check, X, Sparkles } from 'lucide-react';
import { Tooltip } from './Tooltip';

const Container = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

const NameDisplay = styled.div<{ $isEditing: boolean }>`
  display: ${props => props.$isEditing ? 'none' : 'flex'};
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: ${props => props.theme.colors.surface};
  border: 2px solid transparent;
  border-radius: 8px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.colors.hover};
    border-color: ${props => props.theme.colors.primary}30;
  }
`;

const EditIcon = styled(Edit2)`
  opacity: 0.6;
  transition: opacity 0.2s ease;
  
  ${NameDisplay}:hover & {
    opacity: 1;
  }
`;

const EditContainer = styled.div<{ $isEditing: boolean }>`
  display: ${props => props.$isEditing ? 'flex' : 'none'};
  align-items: center;
  gap: 8px;
`;

const Input = styled.input`
  padding: 6px 12px;
  border: 2px solid ${props => props.theme.colors.primary};
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  background: ${props => props.theme.colors.surface};
  min-width: 200px;
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primary}20;
  }
`;

const IconButton = styled.button<{ $variant?: 'success' | 'cancel' }>`
  background: ${props => props.$variant === 'success' 
    ? '#1D9E75' 
    : props.$variant === 'cancel' 
    ? '#A32D2D' 
    : 'transparent'};
  color: white;
  border: none;
  padding: 6px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  
  &:hover {
    transform: scale(1.1);
  }
`;

const SuggestionsContainer = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: ${props => props.theme.colors.surface};
  border: 2px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
`;

const SuggestionItem = styled.button`
  width: 100%;
  padding: 10px 12px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  color: ${props => props.theme.colors.text};
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s ease;
  
  &:hover {
    background: ${props => props.theme.colors.hover};
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid ${props => props.theme.colors.border};
  }
`;

const AIIcon = styled(Sparkles)`
  color: #185FA5;
  flex-shrink: 0;
`;

interface EditableElementNameProps {
  currentName: string;
  elementType?: string;
  pageContext?: string;
  onSave: (newName: string) => Promise<void>;
  onGenerateSuggestions?: () => Promise<string[]>;
}

export const EditableElementName: React.FC<EditableElementNameProps> = ({
  currentName,
  elementType,
  pageContext,
  onSave,
  onGenerateSuggestions,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(currentName);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = async () => {
    setIsEditing(true);
    setValue(currentName);
    
    if (onGenerateSuggestions) {
      setIsLoading(true);
      try {
        const aiSuggestions = await onGenerateSuggestions();
        setSuggestions(aiSuggestions);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Failed to generate suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSave = async () => {
    if (value.trim() && value !== currentName) {
      await onSave(value.trim());
    }
    setIsEditing(false);
    setShowSuggestions(false);
  };

  const handleCancel = () => {
    setValue(currentName);
    setIsEditing(false);
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Container style={{ position: 'relative' }}>
      <NameDisplay $isEditing={isEditing} onClick={handleEdit}>
        {currentName}
        <Tooltip content="Click to rename">
          <EditIcon size={14} />
        </Tooltip>
      </NameDisplay>
      
      <EditContainer $isEditing={isEditing}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter element name"
            autoFocus
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <SuggestionsContainer>
              {suggestions.map((suggestion) => (
                <SuggestionItem
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <AIIcon size={14} />
                  {suggestion}
                </SuggestionItem>
              ))}
            </SuggestionsContainer>
          )}
        </div>
        
        <Tooltip content="Save (Enter)">
          <IconButton $variant="success" onClick={handleSave}>
            <Check size={16} />
          </IconButton>
        </Tooltip>
        
        <Tooltip content="Cancel (Esc)">
          <IconButton $variant="cancel" onClick={handleCancel}>
            <X size={16} />
          </IconButton>
        </Tooltip>
      </EditContainer>
    </Container>
  );
};
