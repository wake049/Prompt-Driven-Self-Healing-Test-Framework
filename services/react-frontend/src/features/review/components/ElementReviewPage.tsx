import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTheme } from '../../../contexts/ThemeContext';
import { sqlApiClient, RecordedElementDB } from '../../../shared/utils/sqlApiClient';
import { useElementSelectorSync, useSyncNotifications } from '../../../shared/hooks/useSyncHooks';
import { SyncIndicator, SyncNotification as SyncNotificationComponent } from '../../../shared/components/SyncVisualIndicators';
import { 
  detectDynamicContent, 
  isDynamicSelector, 
  getDynamicContentSeverity, 
  getDynamicContentWarning,
  DynamicContentMatch 
} from '../../../shared/utils/dynamicContentDetection';

// RecordedElement interface for frontend use
export interface RecordedElement {
  id: string;
  dbId?: number;
  tag: string;
  text: string;
  cssSelector: string;
  xpath: string;
  href?: string;
  src?: string;
  page: string;
  isActive: boolean;
  dynamicContent?: DynamicContentMatch[];
  lastUpdated?: string;
  selectors?: string[];
  attributes?: Record<string, any>;
  timestamp?: number;
}

// ================================
// Styled Components
// ================================
const Container = styled.div<{ theme: any }>`
  min-height: 100vh;
  background: ${props => props.theme.colors.background};
  position: relative;
  overflow-x: hidden;
  transition: background 0.3s ease;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: ${props => props.theme.colors.surface === '#2d3748' ? `
      radial-gradient(circle at 20% 80%, rgba(102, 126, 234, 0.15) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 40%, rgba(102, 126, 234, 0.1) 0%, transparent 50%)
    ` : `
      radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 40%, rgba(120, 119, 198, 0.2) 0%, transparent 50%)
    `};
    pointer-events: none;
  }
`;
const BackButton = styled.button<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(45, 55, 72, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
  backdrop-filter: blur(10px);
  border: 1px solid ${props => props.theme.colors.border};
  color: ${props => props.theme.colors.text};
  padding: 12px 20px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  margin: 20px 40px;
  transition: all 0.3s ease;
  font-weight: 500;
  box-shadow: ${props => props.theme.shadows.small};
  position: relative;
  z-index: 10;
  &:hover {
    background: ${props => props.theme.colors.surface === '#2d3748' ? 
      'rgba(45, 55, 72, 1)' : 'rgba(255, 255, 255, 1)'};
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.medium};
  }
`;
const ContentWrapper = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 40px 40px;
  position: relative;
  z-index: 10;
`;
const Header = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(45, 55, 72, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 40px;
  margin-bottom: 24px;
  box-shadow: ${props => props.theme.shadows.large};
  border: 1px solid ${props => props.theme.colors.border};
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  }
`;
const Title = styled.h1<{ theme: any }>`
  margin: 0 0 12px 0;
  color: ${props => props.theme.colors.text};
  font-size: 2.5rem;
  font-weight: 700;
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'linear-gradient(135deg, #f7fafc 0%, #e2e8f0 100%)' :
    'linear-gradient(135deg, #2d3748 0%, #4a5568 100%)'};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  transition: all 0.3s ease;
`;
const Subtitle = styled.div<{ theme: any }>`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
  flex-wrap: wrap;
  transition: color 0.3s ease;
`;
const HealthBadge = styled.div<{ status: 'healthy' | 'warning' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 25px;
  font-size: 0.9rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  background: ${props => {
    switch (props.status) {
      case 'healthy': return 'linear-gradient(135deg, rgba(72, 187, 120, 0.9) 0%, rgba(56, 178, 172, 0.9) 100%)';
      case 'warning': return 'linear-gradient(135deg, rgba(237, 137, 54, 0.9) 0%, rgba(247, 202, 24, 0.9) 100%)';
      case 'error': return 'linear-gradient(135deg, rgba(245, 101, 101, 0.9) 0%, rgba(229, 62, 62, 0.9) 100%)';
      default: return 'rgba(255, 255, 255, 0.9)';
    }
  }};
  color: white;
`;
const HealthDot = styled.div<{ status: 'healthy' | 'warning' | 'error' }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
`;
const SectionsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  @media (min-width: 1600px) {
    grid-template-columns: 1fr 1fr 1fr;
    gap: 24px;
  }
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    gap: 24px;
  }
`;
const Section = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(45, 55, 72, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
  backdrop-filter: blur(10px);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: ${props => props.theme.shadows.large};
  border: 1px solid ${props => props.theme.colors.border};
  transition: all 0.3s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.large};
  }
`;
const SectionHeader = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)' :
    'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)'};
  padding: 20px 24px;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
  transition: all 0.3s ease;
`;
const SectionContent = styled.div`
  padding: 24px;
`;
const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
`;
const InfoItem = styled.div<{ theme: any }>`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'linear-gradient(135deg, rgba(74, 85, 104, 0.8) 0%, rgba(45, 55, 72, 0.8) 100%)' :
    'linear-gradient(135deg, rgba(247, 250, 252, 0.8) 0%, rgba(237, 242, 247, 0.8) 100%)'};
  border-radius: 12px;
  border: 1px solid ${props => props.theme.colors.border};
  transition: all 0.3s ease;
  &:hover {
    background: ${props => props.theme.colors.surface === '#2d3748' ? 
      'linear-gradient(135deg, rgba(74, 85, 104, 1) 0%, rgba(45, 55, 72, 1) 100%)' :
      'linear-gradient(135deg, rgba(247, 250, 252, 1) 0%, rgba(237, 242, 247, 1) 100%)'};
    transform: translateY(-1px);
    box-shadow: ${props => props.theme.shadows.small};
  }
`;
const InfoLabel = styled.div<{ theme: any }>`
  font-size: 0.85rem;
  color: ${props => props.theme.colors.textSecondary};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;
const InfoValue = styled.div<{ theme: any }>`
  font-weight: 500;
  color: ${props => props.theme.colors.text};
  word-break: break-word;
  font-size: 1rem;
`;
const SelectorList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;
const SelectorItem = styled.div<{ theme: any }>`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)' :
    'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)'};
  border-radius: 12px;
  border: 1px solid ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.2)'};
  transition: all 0.3s ease;
  &:hover {
    background: ${props => props.theme.colors.surface === '#2d3748' ? 
      'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)' :
      'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'};
    transform: translateY(-1px);
    box-shadow: ${props => props.theme.colors.surface === '#2d3748' ? 
      '0 4px 12px rgba(102, 126, 234, 0.25)' :
      '0 4px 12px rgba(102, 126, 234, 0.15)'};
  }
`;
const SelectorCode = styled.code<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? '#0d1117' : 'rgba(45, 55, 72, 0.05)'};
  padding: 12px 16px;
  border-radius: 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  display: block;
  margin-top: 8px;
  word-break: break-all;
  border: 1px solid ${props => props.theme.colors.surface === '#2d3748' ? '#30363d' : 'rgba(226, 232, 240, 0.5)'};
  color: ${props => props.theme.colors.surface === '#2d3748' ? '#f0f6fc' : '#2d3748'};
  font-weight: 500;
  line-height: 1.5;
`;
const ActionButtons = styled.div<{ theme: any }>`
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  padding: 24px;
  border-top: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)' :
    'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)'};
  transition: all 0.3s ease;
`;
const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger'; theme?: any }>`
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  font-size: 0.95rem;
  box-shadow: ${props => props.theme?.shadows?.small || '0 4px 6px rgba(0, 0, 0, 0.1)'};
  ${props => {
    switch (props.variant) {
      case 'primary':
        return `
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          &:hover { 
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
          }
        `;
      case 'danger':
        return `
          background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
          color: white;
          &:hover { 
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(245, 101, 101, 0.4);
          }
        `;
      default:
        return `
          background: ${props.theme?.colors?.surface === '#2d3748' ? 
            'rgba(45, 55, 72, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
          backdrop-filter: blur(10px);
          color: ${props.theme?.colors?.textSecondary || '#718096'};
          border: 1px solid ${props.theme?.colors?.border || 'rgba(226, 232, 240, 0.5)'};
          &:hover { 
            background: ${props.theme?.colors?.surface === '#2d3748' ? 
              'rgba(45, 55, 72, 1)' : 'rgba(255, 255, 255, 1)'};
            color: ${props.theme?.colors?.text || '#4a5568'};
            transform: translateY(-2px);
            box-shadow: ${props.theme?.shadows?.medium || '0 6px 12px rgba(0, 0, 0, 0.15)'};
          }
        `;
    }
  }}
`;
const AttributesList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;
const AttributeTag = styled.span<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)' :
    'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
  };
  color: ${props => props.theme.colors.surface === '#2d3748' ? '#e2e8f0' : '#4a5568'};
  padding: 8px 14px;
  border-radius: 12px;
  font-size: 0.9rem;
  font-family: monospace;
  border: 1px solid ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(102, 126, 234, 0.3)' : 'rgba(102, 126, 234, 0.2)'
  };
  transition: all 0.3s ease;
  font-weight: 500;
  &:hover {
    background: ${props => props.theme.colors.surface === '#2d3748' ? 
      'linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%)' :
      'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)'
    };
    color: ${props => props.theme.colors.surface === '#2d3748' ? '#f7fafc' : props.theme.colors.text};
    transform: translateY(-1px);
  }
`;
const EditForm = styled.div<{ theme: any }>`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)' :
    'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)'};
  border-radius: 12px;
  border: 2px solid ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(102, 126, 234, 0.4)' : 'rgba(102, 126, 234, 0.3)'};
  transition: all 0.3s ease;
`;
const EditFormRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
const EditLabel = styled.label<{ theme: any }>`
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  font-size: 0.9rem;
  transition: color 0.3s ease;
`;
const EditInput = styled.input<{ theme: any }>`
  padding: 12px 16px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 0.9rem;
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(45, 55, 72, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
  backdrop-filter: blur(5px);
  transition: all 0.3s ease;
  color: ${props => props.theme.colors.text};
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    background: ${props => props.theme.colors.surface === '#2d3748' ? 
      'rgba(45, 55, 72, 1)' : 'rgba(255, 255, 255, 1)'};
  }
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
`;
const EditTextarea = styled.textarea<{ theme: any }>`
  padding: 12px 16px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  min-height: 80px;
  resize: vertical;
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(45, 55, 72, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
  backdrop-filter: blur(5px);
  transition: all 0.3s ease;
  color: ${props => props.theme.colors.text};
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    background: ${props => props.theme.colors.surface === '#2d3748' ? 
      'rgba(45, 55, 72, 1)' : 'rgba(255, 255, 255, 1)'};
  }
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
`;
const EditActions = styled.div<{ theme: any }>`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid ${props => props.theme.colors.border};
  transition: border-color 0.3s ease;
`;
const RecommendationItem = styled.div<{ theme: any }>`
  padding: 16px;
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'linear-gradient(135deg, rgba(72, 187, 120, 0.15) 0%, rgba(56, 178, 172, 0.15) 100%)' :
    'linear-gradient(135deg, rgba(72, 187, 120, 0.05) 0%, rgba(56, 178, 172, 0.05) 100%)'};
  border-radius: 12px;
  border-left: 4px solid #48bb78;
  margin-bottom: 12px;
  font-size: 0.95rem;
  color: ${props => props.theme.colors.text};
  transition: all 0.3s ease;
  &:hover {
    background: ${props => props.theme.colors.surface === '#2d3748' ? 
      'linear-gradient(135deg, rgba(72, 187, 120, 0.2) 0%, rgba(56, 178, 172, 0.2) 100%)' :
      'linear-gradient(135deg, rgba(72, 187, 120, 0.1) 0%, rgba(56, 178, 172, 0.1) 100%)'};
    transform: translateX(4px);
  }
`;
const LoadingState = styled.div<{ theme: any }>`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
  color: ${props => props.theme.colors.text};
  font-size: 1.2rem;
  text-shadow: ${props => props.theme.colors.surface === '#2d3748' ? 
    '0 2px 4px rgba(0, 0, 0, 0.6)' : '0 2px 4px rgba(0, 0, 0, 0.3)'};
  transition: all 0.3s ease;
`;
const ErrorState = styled.div`
  background: rgba(245, 101, 101, 0.9);
  backdrop-filter: blur(10px);
  color: white;
  padding: 20px;
  border-radius: 12px;
  margin: 40px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(245, 101, 101, 0.3);
`;
const ReviewQueueBadge = styled.div<{ isInQueue: boolean; theme: any }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 25px;
  font-size: 0.9rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
  border: 1px solid ${props => props.theme?.colors?.border || 'rgba(255, 255, 255, 0.2)'};
  box-shadow: ${props => props.theme?.shadows?.small || '0 4px 6px rgba(0, 0, 0, 0.1)'};
  background: ${props => props.isInQueue 
    ? 'linear-gradient(135deg, rgba(237, 137, 54, 0.9) 0%, rgba(247, 202, 24, 0.9) 100%)' 
    : (props.theme?.colors?.surface === '#2d3748' ? 
        'rgba(45, 55, 72, 0.9)' : 'rgba(255, 255, 255, 0.9)')};
  color: ${props => props.isInQueue ? 'white' : props.theme?.colors?.textSecondary || '#718096'};
  transition: all 0.3s ease;
`;
const ReviewQueueButton = styled.button<{ isInQueue: boolean }>`
  background: ${props => props.isInQueue 
    ? 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)' 
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
  color: white;
  border: none;
  border-radius: 12px;
  padding: 10px 16px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }
`;
const ReviewQueueDialog = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;
const ReviewQueueDialogContent = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(45, 55, 72, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 30px;
  max-width: 500px;
  width: 90%;
  box-shadow: ${props => props.theme.shadows.large};
  border: 1px solid ${props => props.theme.colors.border};
  transition: all 0.3s ease;
`;
const ReviewQueueDialogTitle = styled.h3<{ theme: any }>`
  margin: 0 0 16px 0;
  color: ${props => props.theme.colors.text};
  font-size: 1.4rem;
  font-weight: 700;
  transition: color 0.3s ease;
`;
const ReviewQueueTextarea = styled.textarea<{ theme: any }>`
  width: 100%;
  min-height: 100px;
  padding: 12px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
  margin-bottom: 20px;
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(45, 55, 72, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
  backdrop-filter: blur(5px);
  color: ${props => props.theme.colors.text};
  transition: all 0.3s ease;
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
`;
const ReviewQueueActions = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
`;
const DialogButton = styled.button<{ variant?: 'primary' | 'secondary'; theme?: any }>`
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  box-shadow: ${props => props.theme?.shadows?.small || '0 4px 6px rgba(0, 0, 0, 0.1)'};
  background: ${props => props.variant === 'primary' 
    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
    : (props.theme?.colors?.surface === '#2d3748' ? 
        'rgba(45, 55, 72, 0.9)' : 'rgba(255, 255, 255, 0.9)')};
  color: ${props => props.variant === 'primary' ? 'white' : props.theme?.colors?.textSecondary || '#718096'};
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme?.shadows?.medium || '0 6px 12px rgba(0, 0, 0, 0.15)'};
  }
`;
// Sync-related styled components
const SyncStatusBadge = styled.div<{ hasRelated: boolean; isUpdating: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
  ${props => props.hasRelated ? `
    background: linear-gradient(135deg, #48bb78 0%, #38b2ac 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(72, 187, 120, 0.3);
  ` : `
    background: rgba(226, 232, 240, 0.8);
    color: #718096;
  `}
  ${props => props.isUpdating && `
    animation: pulse 2s infinite;
  `}
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
`;
const SyncNotification = styled.div<{ type: 'success' | 'error' | 'info' }>`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  padding: 12px 20px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease-out;
  background: ${props => {
    switch (props.type) {
      case 'success': return 'linear-gradient(135deg, #48bb78 0%, #38b2ac 100%)';
      case 'error': return 'linear-gradient(135deg, #f56565 0%, #e53e3e 100%)';
      case 'info': return 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)';
      default: return 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)';
    }
  }};
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
const RelatedPromptsSection = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(45, 55, 72, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 24px;
  box-shadow: ${props => props.theme.shadows.large};
  margin-bottom: 24px;
  border: 1px solid ${props => props.theme.colors.border};
  transition: all 0.3s ease;
`;
const PromptReference = styled.div`
  background: ${props => props.theme?.colors?.background || 'rgba(102, 126, 234, 0.08)'};
  border: 1px solid ${props => props.theme?.colors?.border || 'rgba(102, 126, 234, 0.15)'};
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    opacity: 0.6;
  }
  &:hover {
    background: ${props => props.theme?.colors?.surface || 'rgba(102, 126, 234, 0.12)'};
    transform: translateX(4px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
    &::before {
      opacity: 1;
    }
  }
`;
const PromptCard = styled.div<{ theme: any }>`
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: ${props => props.theme.shadows.small};
  transition: all 0.3s ease;
  color: ${props => props.theme.colors.text};
  &:hover {
    box-shadow: ${props => props.theme.shadows.medium};
    transform: translateY(-2px);
  }
`;
const PromptHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;
const PromptTitle = styled.h4<{ theme: any }>`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.3s ease;
`;
const PromptMeta = styled.div<{ theme: any }>`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  transition: color 0.3s ease;
`;
const StepBadge = styled.span`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
`;
const ParameterTag = styled.span<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    'rgba(72, 187, 120, 0.2)' : 'rgba(72, 187, 120, 0.1)'};
  color: ${props => props.theme.colors.surface === '#2d3748' ? 
    '#68d391' : '#38a169'};
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.3s ease;
`;
const SelectorValue = styled.code<{ theme: any }>`
  background: ${props => props.theme.colors.surface === '#2d3748' ? '#0d1117' : '#f7fafc'};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 6px;
  padding: 8px 12px;
  font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: ${props => props.theme.colors.surface === '#2d3748' ? '#f0f6fc' : '#4a5568'};
  display: block;
  margin-top: 12px;
  overflow: auto;
  font-weight: 500;
  line-height: 1.5;
`;
const SyncHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
  }
`;
const SyncStats = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 14px;
  .count {
    background: rgba(255, 255, 255, 0.2);
    padding: 4px 12px;
    border-radius: 20px;
    font-weight: 600;
    color: white;
  }
`;
const EmptyState = styled.div<{ theme: any }>`
  text-align: center;
  padding: 40px 20px;
  background: ${props => props.theme.colors.surface === '#2d3748' ? 
    '#2d3748' : '#f8fafc'};
  border-radius: 12px;
  border: 2px dashed ${props => props.theme.colors.surface === '#2d3748' ? 
    '#4a5568' : '#cbd5e0'};
  transition: all 0.3s ease;
  .icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.6;
  }
  .title {
    font-size: 16px;
    font-weight: 600;
    color: ${props => props.theme.colors.text};
    margin-bottom: 8px;
  }
  .description {
    font-size: 14px;
    color: ${props => props.theme.colors.textSecondary};
    line-height: 1.5;
  }
`;
// ================================
// Component
// ================================
interface ElementReviewPageProps {
  elementId?: string;
  onBack?: () => void;
}
const ElementReviewPage: React.FC<ElementReviewPageProps> = ({ elementId, onBack }) => {
  const { theme } = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [element, setElement] = useState<RecordedElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    id: string;
    cssSelector: string;
    xpath: string;
    text: string;
  } | null>(null);
  // Review Queue functionality
  const [isInReviewQueue, setIsInReviewQueue] = useState(false);
  const [reviewQueueNote, setReviewQueueNote] = useState('');
  const [showReviewQueueDialog, setShowReviewQueueDialog] = useState(false);
  const targetElementId = elementId || id;
  // Sync functionality
  const {
    updateSelector,
    isUpdating: isSyncUpdating,
    relationships,
    relatedPromptsCount,
    hasRelatedPrompts,
    relatedPromptIds
  } = useElementSelectorSync(targetElementId || '');
  const { notification, clearNotification } = useSyncNotifications();
  useEffect(() => {
    if (targetElementId) {
      loadElement(targetElementId);
    }
  }, [targetElementId]);
  useEffect(() => {
    if (element) {
      loadReviewQueueStatus();
    }
  }, [element]);
  // Listen for storage changes to update review queue status
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'reviewQueue' && element) {
        loadReviewQueueStatus();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [element]);
  const loadElement = async (elemId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await sqlApiClient.getAllElements({ limit: 1000 });
      // Handle different response formats
      let elementsData = [];
      if (response && typeof response === 'object') {
        if (response.success && response.data) {
          elementsData = response.data;
        } else if (Array.isArray(response)) {
          elementsData = response;
        } else {
          throw new Error('Unexpected response format');
        }
      } else {
        throw new Error('Invalid response from server');
      }
      // Check for deleted/inactive elements
      const hasIsActiveField = elementsData.length > 0 && 'is_active' in elementsData[0];
      if (hasIsActiveField) {
        const activeCount = elementsData.filter(el => el.is_active === true).length;
        const inactiveCount = elementsData.filter(el => el.is_active === false).length;
        // Filter to only active elements
        elementsData = elementsData.filter(el => el.is_active !== false);
      }
      // Check if username exists in the data
      const usernameInRaw = elementsData.find(el => el.logical_key === 'username' || el.id === 'username');
      // Helper method to filter out recording-related attributes
      const filterRecordingAttributes = (attributes: Record<string, any>): Record<string, any> => {
        const filtered = { ...attributes };
        // Remove MCP recording-related attributes
        delete filtered['mcp-hover-highlight'];
        delete filtered['mcp-recorded-highlight'];
        delete filtered['mcp-element-id'];
        delete filtered['mcp-recorded'];
        // Clean up class attribute to remove MCP-related classes
        if (filtered.class && typeof filtered.class === 'string') {
          const classes = filtered.class.split(' ').filter(cls => 
            !cls.startsWith('mcp-') && 
            cls !== 'mcp-hover-highlight' && 
            cls !== 'mcp-recorded-highlight'
          );
          if (classes.length > 0) {
            filtered.class = classes.join(' ');
          } else {
            delete filtered.class;
          }
        }
        return filtered;
      };
      // Helper method to extract tag from element data
      const getElementTag = (apiElement: any): string => {
        // First try the direct tag field (skip if it's "unknown")
        if (apiElement.tag && apiElement.tag !== 'unknown') {
          return apiElement.tag;
        }
        // Try to parse the primary_selector JSON to get tag info
        if (apiElement.primary_selector) {
          try {
            const selectorData = typeof apiElement.primary_selector === 'string' 
              ? JSON.parse(apiElement.primary_selector) 
              : apiElement.primary_selector;
            if (selectorData.tag && selectorData.tag !== 'unknown') {
              return selectorData.tag;
            }
          } catch (e) {
          }
        }
        // Extract from XPath - look for the LAST tag in the path since that's the actual element
        if (apiElement.xpath) {
          // Pattern like: //a[@id="item_5_title_link"]//div
          // We want the "div" part (the actual target element)
          const xpathTagMatches = apiElement.xpath.match(/\/\/(\w+)/g);
          if (xpathTagMatches && xpathTagMatches.length > 0) {
            // Get the last tag in the XPath (the actual target element)
            const lastMatch = xpathTagMatches[xpathTagMatches.length - 1];
            const tagMatch = lastMatch.match(/\/\/(\w+)/);
            if (tagMatch && tagMatch[1]) {
              return tagMatch[1];
            }
          }
          // Also try single tag patterns like //div, //button, etc.
          const singleTagMatch = apiElement.xpath.match(/^\/\/(\w+)(\[|$)/);
          if (singleTagMatch && singleTagMatch[1]) {
            return singleTagMatch[1];
          }
        }
        // Try to extract from CSS selector
        if (apiElement.css_selector) {
          const cssTagMatch = apiElement.css_selector.match(/^(\w+)/);
          if (cssTagMatch && cssTagMatch[1]) {
            return cssTagMatch[1];
          }
        }
        // Try to extract from any selector patterns
        const xpath = apiElement.xpath || '';
        const cssSelector = apiElement.css_selector || '';
        // Look for specific tag patterns in selectors
        if (xpath.includes('//button') || cssSelector.includes('button')) return 'button';
        if (xpath.includes('//input') || cssSelector.includes('input')) return 'input';
        if (xpath.includes('//span') || cssSelector.includes('span')) return 'span';
        if (xpath.includes('//div') || cssSelector.includes('div')) return 'div';
        if (xpath.includes('//a') || cssSelector.includes('a.') || cssSelector.includes('a#')) return 'a';
        if (xpath.includes('//form') || cssSelector.includes('form')) return 'form';
        if (xpath.includes('//table') || cssSelector.includes('table')) return 'table';
        if (xpath.includes('//tr') || cssSelector.includes('tr')) return 'tr';
        if (xpath.includes('//td') || cssSelector.includes('td')) return 'td';
        if (xpath.includes('//li') || cssSelector.includes('li')) return 'li';
        if (xpath.includes('//ul') || cssSelector.includes('ul')) return 'ul';
        if (xpath.includes('//p') || cssSelector.includes('p')) return 'p';
        if (xpath.includes('//h1') || cssSelector.includes('h1')) return 'h1';
        if (xpath.includes('//h2') || cssSelector.includes('h2')) return 'h2';
        if (xpath.includes('//h3') || cssSelector.includes('h3')) return 'h3';
        // Debug log to see what we're working with
        // Fallback to 'div' as it's the most common
        return 'div';
      };
      // Convert database elements to frontend format
      const frontendElements = elementsData.map((apiElement) => {
        if (apiElement.logical_key && apiElement.timestamp_recorded) {
          // Database format - use existing conversion
          // Convert database element to frontend format
          return {
            id: apiElement.element_key || apiElement.id,
            dbId: apiElement.id,
            tag: apiElement.tag || 'unknown',
            text: apiElement.text_content || apiElement.text || '',
            cssSelector: apiElement.css_selector || '',
            xpath: apiElement.xpath || '',
            href: apiElement.href || '',
            src: apiElement.src || '',
            page: apiElement.page || 'unknown',
            isActive: apiElement.is_active !== false,
            selectors: apiElement.selectors || [],
            attributes: apiElement.attributes || {},
            timestamp: apiElement.timestamp || Date.now()
          } as RecordedElement;
        } else {
          // Parse attributes if it's a string
          let parsedAttributes = {};
          try {
            if (typeof apiElement.attributes === 'string') {
              parsedAttributes = JSON.parse(apiElement.attributes);
            } else if (typeof apiElement.attributes === 'object' && apiElement.attributes !== null) {
              parsedAttributes = apiElement.attributes;
            }
          } catch (e) {
            parsedAttributes = {};
          }
          // Filter out recording-related attributes
          const cleanAttributes = filterRecordingAttributes(parsedAttributes);
          // Simple API format - convert directly
          return {
            id: apiElement.id || apiElement.logical_key,
            dbId: apiElement.id,
            tag: getElementTag(apiElement),
            text: apiElement.text || apiElement.text_content || 'No text',
            cssSelector: apiElement.css_selector || '',
            xpath: apiElement.xpath || '',
            href: apiElement.href || '',
            src: apiElement.src || '',
            page: apiElement.page || '',
            isActive: apiElement.is_active !== false,
            selectors: Array.isArray(apiElement.selectors) ? apiElement.selectors : [],
            attributes: cleanAttributes,
            timestamp: apiElement.timestamp_recorded ? new Date(apiElement.timestamp_recorded).getTime() : Date.now(),
          };
        }
      });
      // Find element by frontend ID (which is the logical_key from database)
      const foundElement = frontendElements.find((el) => el.id === elemId);
      if (!foundElement) {

        // Check if there's a similar ID (case-insensitive or partial match)
        const similarIds = frontendElements.filter(el => 
          el.id?.toLowerCase().includes(elemId.toLowerCase()) ||
          elemId.toLowerCase().includes(el.id?.toLowerCase() || '')
        );
        
        // Try to find by other ID fields
        const byDbId = frontendElements.find((el) => el.dbId === elemId);
        const byLogicalKey = frontendElements.find((el) => (el as any).logicalKey === elemId);
        
        setError(`Element not found: ${elemId}`);
        return;
      }
      setElement(foundElement);
    } catch (err) {setError('Failed to load element details');
    } finally {
      setLoading(false);
    }
  };
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/elements');
    }
  };
  const handleDelete = async () => {
    if (!element) return;
    if (confirm('Are you sure you want to delete this element? This action cannot be undone.')) {
      try {
        // Use dbId if available, fallback to id
        const deleteId = element.dbId || element.id;
        await sqlApiClient.deleteElement(String(deleteId));
        // Handle sync relationships for deleted element
        try {
          const { elementPromptSyncService } = await import('../../../shared/services/elementPromptSyncService');
          const syncResult = await elementPromptSyncService.handleDeletedElement(element.id);
          if (syncResult.alternativeFound) {
            alert(`Element deleted successfully!\n\n${syncResult.message}`);
          } else if (syncResult.success) {
            if (syncResult.message.includes('prompts may need manual review')) {
              alert(`Element deleted.\n\n${syncResult.message}`);
            }
          }
        } catch (syncError) {// Don't block deletion if sync fails
        }
        handleBack();
      } catch (err) {alert('Failed to delete element');
      }
    }
  };
  const handleEdit = () => {
    if (!element) return;
    setEditForm({
      id: element.id,
      cssSelector: element.cssSelector || '',
      xpath: element.xpath || '',
      text: element.text || ''
    });
    setIsEditing(true);
  };
  const handleSaveEdit = async () => {
    if (!element || !editForm) return;
    try {
      // Check if selectors changed
      const selectorChanged = 
        editForm.cssSelector !== element.cssSelector || 
        editForm.xpath !== element.xpath;
      // Update the element with new values
      const updatedElement = {
        ...element,
        id: editForm.id,
        cssSelector: editForm.cssSelector,
        xpath: editForm.xpath,
        text: editForm.text,
        timestamp: Date.now() // Update timestamp
      };
      // Call API to update element  
      await sqlApiClient.updateElement(String(element.dbId || element.id), {
        logical_key: editForm.id,
        css_selector: editForm.cssSelector,
        xpath: editForm.xpath,
        text_content: editForm.text
      });
      // If selectors changed and element has related prompts, sync them
      if (selectorChanged && hasRelatedPrompts) {
        try {
          // Use CSS selector if available, otherwise XPath
          const newSelector = editForm.cssSelector || editForm.xpath;
          const selectorType: 'css' | 'xpath' = editForm.cssSelector ? 'css' : 'xpath';
          if (newSelector) {
            await updateSelector(newSelector, selectorType);
          }
        } catch (syncError) {// Don't fail the entire update if sync fails
          alert(`Element updated successfully, but failed to sync with related prompts: ${syncError}`);
        }
      }
      setElement(updatedElement);
      setIsEditing(false);
      setEditForm(null);
      if (selectorChanged && hasRelatedPrompts) {
        alert(`Element updated successfully and synced to ${relatedPromptsCount} related prompts!`);
      } else {
        alert('Element updated successfully!');
      }
    } catch (err) {alert('Failed to update element');
    }
  };
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm(null);
  };
  // Review Queue Management Functions
  const loadReviewQueueStatus = () => {
    // Check if element is in review queue (stored in localStorage for now)
    const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
    const isInQueue = reviewQueue.some((item: any) => item.elementId === targetElementId);
    setIsInReviewQueue(isInQueue);
    if (isInQueue) {
      const queueItem = reviewQueue.find((item: any) => item.elementId === targetElementId);
      setReviewQueueNote(queueItem?.note || '');
    }
  };
  const addToReviewQueue = async (note: string = '') => {
    if (!element) return;
    try {
      const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
      const newQueueItem = {
        elementId: element.id,
        elementName: element.text || element.tag || 'Unnamed Element',
        addedAt: new Date().toISOString(),
        note: note,
        healthStatus: getElementHealthStatus(element),
        page: element.page || 'Unknown'
      };
      // Add to queue if not already present
      if (!reviewQueue.some((item: any) => item.elementId === element.id)) {
        reviewQueue.push(newQueueItem);
        localStorage.setItem('reviewQueue', JSON.stringify(reviewQueue));
        setIsInReviewQueue(true);
        setReviewQueueNote(note);
        alert('Element added to review queue!');
      }
    } catch (err) {alert('Failed to add element to review queue');
    }
  };
  const removeFromReviewQueue = async () => {
    if (!element) return;
    try {
      const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
      const updatedQueue = reviewQueue.filter((item: any) => item.elementId !== element.id);
      localStorage.setItem('reviewQueue', JSON.stringify(updatedQueue));
      setIsInReviewQueue(false);
      setReviewQueueNote('');
      alert('Element removed from review queue!');
    } catch (err) {alert('Failed to remove element from review queue');
    }
  };
  const handleReviewQueueAction = () => {
    if (isInReviewQueue) {
      removeFromReviewQueue();
    } else {
      setShowReviewQueueDialog(true);
    }
  };
  const getReviewQueueCount = () => {
    const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
    return reviewQueue.length;
  };
  // Helper function to get detailed health status with specific issues
  const getElementHealthStatus = (elem: RecordedElement): { 
    status: 'healthy' | 'warning' | 'error', 
    score: number, 
    label: string,
    issues: string[]
  } => {
    // First check if element is in review queue - this overrides health score
    const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
    const isInQueue = reviewQueue.some((item: any) => item.elementId === elem.id);
    if (isInQueue) {
      const queueItem = reviewQueue.find((item: any) => item.elementId === elem.id);
      return { 
        status: 'error', 
        score: 0, 
        label: 'In Review Queue',
        issues: queueItem?.note ? [`Queued for review: ${queueItem.note}`] : ['Element is in review queue']
      };
    }
    let healthScore = 100;
    const issues: string[] = [];
    // 1. Check for dynamic content issues (major issue -30 points)
    const dynamicMatches = detectDynamicContent(elem.cssSelector || '');
    if (dynamicMatches.length > 0) {
      healthScore -= 30;
      issues.push(`Dynamic content detected in selector`);
    }
    // 2. Check if element has selectors (-50 points if missing both)
    if (!elem.cssSelector && !elem.xpath) {
      healthScore -= 50;
      issues.push('Missing both CSS selector and XPath');
    }
    // 3. Check for empty or minimal attributes (-20 points)
    const hasEmptyAttributes = !elem.attributes || 
      Object.keys(elem.attributes).length === 0 ||
      JSON.stringify(elem.attributes) === '{}';
    if (hasEmptyAttributes) {
      healthScore -= 20;
      issues.push('Empty or missing element attributes');
    }
    // 4. Check for null or empty text content (-10 points)
    if (!elem.text || elem.text === '[null]' || elem.text.trim() === '') {
      healthScore -= 10;
      issues.push('Missing or empty text content');
    }
    // 5. Check age - very lenient (only flag if > 30 days old)
    const daysSinceUpdate = (Date.now() - (elem.timestamp || Date.now())) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 30) {
      healthScore -= 25;
      issues.push(`Element is outdated (${Math.round(daysSinceUpdate)} days old)`);
    }
    // 6. Check for very weak selectors only (-15 points)
    const selector = elem.cssSelector || elem.xpath || '';
    const weakPatterns = [
      { pattern: /^div$/, name: 'Generic div selector' },
      { pattern: /^span$/, name: 'Generic span selector' },
      { pattern: /^input$/, name: 'Generic input selector' },
      { pattern: /^button$/, name: 'Generic button selector' },
      { pattern: /div:nth-child\(\d+\)$/, name: 'Position-based selector' },
      { pattern: /^\[style\]/, name: 'Style-based selector' },
    ];
    const weakPattern = weakPatterns.find(wp => wp.pattern.test(selector));
    if (weakPattern) {
      healthScore -= 15;
      issues.push(`Weak selector: ${weakPattern.name}`);
    }
    // Determine status based on score
    let status: 'healthy' | 'warning' | 'error';
    let label: string;
    if (healthScore >= 80) {
      status = 'healthy';
      label = 'Healthy';
    } else if (healthScore >= 60) {
      status = 'warning';
      label = 'Warning';
    } else {
      status = 'error';
      label = 'Needs Attention';
    }
    return { status, score: healthScore, label, issues };
  };
  // Keep the original boolean function for compatibility
  const isElementHealthy = (elem: RecordedElement): boolean => {
    return getElementHealthStatus(elem).score >= 70;
  };
  const elementNeedsWork = (elem: RecordedElement): boolean => {
    const dynamicMatches = detectDynamicContent(elem.cssSelector || '');
    return dynamicMatches.length > 0;
  };
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  if (loading) {
    return (
      <Container theme={theme}>
        <LoadingState theme={theme}>Loading element details...</LoadingState>
      </Container>
    );
  }
  if (error) {
    return (
      <Container theme={theme}>
        <ErrorState>
          <h3>Error</h3>
          <p>{error}</p>
          <ActionButton theme={theme} onClick={handleBack}>← Back to Elements</ActionButton>
        </ErrorState>
      </Container>
    );
  }
  if (!element) {
    return (
      <Container theme={theme}>
        <ErrorState>
          <h3>Element Not Found</h3>
          <p>The requested element could not be found.</p>
          <ActionButton theme={theme} onClick={handleBack}>← Back to Elements</ActionButton>
        </ErrorState>
      </Container>
    );
  }
  const healthStatus = getElementHealthStatus(element);
  const needsWork = elementNeedsWork(element);
  return (
    <Container theme={theme}>
      <BackButton theme={theme} onClick={handleBack}>
        ← Back to Elements
      </BackButton>
      <ContentWrapper>
        <Header theme={theme}>
          <Title theme={theme}>
            {(element.id && typeof element.id === 'string' ? element.id : '') || 
             (element.text && typeof element.text === 'string' ? element.text : '') || 
             (element.tag && typeof element.tag === 'string' ? element.tag : '') || 
             'Unnamed Element'}
          </Title>
          <Subtitle theme={theme}>
            <span>Element Review & Management</span>
            <HealthBadge status={healthStatus.status} title={`Health Score: ${healthStatus.score}/100`}>
              <HealthDot status={healthStatus.status} />
              {healthStatus.label}
            </HealthBadge>
            <ReviewQueueBadge theme={theme} isInQueue={isInReviewQueue}>
              {isInReviewQueue ? ' In Review Queue' : ' Not in Queue'} 
              {getReviewQueueCount() > 0 && ` (${getReviewQueueCount()} total)`}
            </ReviewQueueBadge>
            <ReviewQueueButton isInQueue={isInReviewQueue} onClick={handleReviewQueueAction}>
              {isInReviewQueue ? ' Remove from Queue' : '➕ Add to Queue'}
            </ReviewQueueButton>
          </Subtitle>
        </Header>
        <SectionsGrid>
          {/* COLUMN 1 - Core Information */}
          {/* Basic Information Section */}
          <Section theme={theme}>
            <SectionHeader theme={theme}>
               Basic Information
            </SectionHeader>
            <SectionContent>
              <InfoGrid>
                <InfoItem theme={theme}>
                  <InfoLabel theme={theme}>Element ID</InfoLabel>
                  <InfoValue theme={theme}>{String(element.id || '')}</InfoValue>
                </InfoItem>
                <InfoItem theme={theme}>
                  <InfoLabel theme={theme}>Tag Type</InfoLabel>
                  <InfoValue theme={theme}>{String(element.tag || '')}</InfoValue>
                </InfoItem>
                <InfoItem theme={theme}>
                  <InfoLabel theme={theme}>Page</InfoLabel>
                  <InfoValue theme={theme}>{String(element.page || '/unknown')}</InfoValue>
                </InfoItem>
                <InfoItem theme={theme}>
                  <InfoLabel theme={theme}>Last Seen</InfoLabel>
                  <InfoValue theme={theme}>{formatTimestamp(element.timestamp || Date.now())}</InfoValue>
                </InfoItem>
                <InfoItem theme={theme}>
                  <InfoLabel theme={theme}>Text Content</InfoLabel>
                  <InfoValue theme={theme}>{String(element.text || 'No text content')}</InfoValue>
                </InfoItem>
                <InfoItem theme={theme}>
                  <InfoLabel theme={theme}>Discovery Method</InfoLabel>
                  <InfoValue theme={theme}>Chrome Extension Recording</InfoValue>
                </InfoItem>
              </InfoGrid>
            </SectionContent>
          </Section>
          {/* Selectors Section */}
          <Section theme={theme}>
            <SectionHeader theme={theme}>
               Selectors & Targeting
              {!isEditing && (
                <ActionButton theme={theme} onClick={handleEdit}>
                  ✏️ Edit Selectors
                </ActionButton>
              )}
            </SectionHeader>
            <SectionContent>
              {isEditing ? (
                <EditForm theme={theme}>
                  <EditFormRow>
                    <EditLabel theme={theme}>Element ID</EditLabel>
                    <EditInput
                      theme={theme}
                      type="text"
                      value={editForm?.id || ''}
                      onChange={(e) => setEditForm(prev => prev ? {...prev, id: e.target.value} : null)}
                      placeholder="Enter unique element ID"
                    />
                  </EditFormRow>
                  <EditFormRow>
                    <EditLabel theme={theme}>Text Content</EditLabel>
                    <EditInput
                      theme={theme}
                      type="text"
                      value={editForm?.text || ''}
                      onChange={(e) => setEditForm(prev => prev ? {...prev, text: e.target.value} : null)}
                      placeholder="Enter element text content"
                    />
                  </EditFormRow>
                  <EditFormRow>
                    <EditLabel theme={theme}>CSS Selector</EditLabel>
                    <EditTextarea
                      theme={theme}
                      value={editForm?.cssSelector || ''}
                      onChange={(e) => setEditForm(prev => prev ? {...prev, cssSelector: e.target.value} : null)}
                      placeholder="Enter CSS selector"
                    />
                  </EditFormRow>
                  <EditFormRow>
                    <EditLabel theme={theme}>XPath Expression</EditLabel>
                    <EditTextarea
                      theme={theme}
                      value={editForm?.xpath || ''}
                      onChange={(e) => setEditForm(prev => prev ? {...prev, xpath: e.target.value} : null)}
                      placeholder="Enter XPath expression"
                    />
                  </EditFormRow>
                  <EditActions theme={theme}>
                    <ActionButton theme={theme} onClick={handleCancelEdit}>
                      Cancel
                    </ActionButton>
                    <ActionButton theme={theme} variant="primary" onClick={handleSaveEdit}>
                      Save Changes
                    </ActionButton>
                  </EditActions>
                </EditForm>
              ) : (
                <SelectorList>
                  {element.cssSelector && (
                    <SelectorItem theme={theme}>
                      <div style={{ flex: 1 }}>
                        <InfoLabel theme={theme}>CSS Selector</InfoLabel>
                        <SelectorCode theme={theme}>{String(element.cssSelector)}</SelectorCode>
                      </div>
                    </SelectorItem>
                  )}
                  {element.xpath && (
                    <SelectorItem theme={theme}>
                      <div style={{ flex: 1 }}>
                        <InfoLabel theme={theme}>XPath</InfoLabel>
                        <SelectorCode theme={theme}>{String(element.xpath)}</SelectorCode>
                      </div>
                    </SelectorItem>
                  )}
                  {element.selectors && Array.isArray(element.selectors) && element.selectors.length > 0 && (
                    element.selectors.map((selector, index) => (
                      <SelectorItem theme={theme} key={index}>
                        <div style={{ flex: 1 }}>
                          <InfoLabel theme={theme}>Alternative Selector {index + 1}</InfoLabel>
                          <SelectorCode theme={theme}>{String(selector)}</SelectorCode>
                        </div>
                      </SelectorItem>
                    ))
                  )}
                </SelectorList>
              )}
            </SectionContent>
          </Section>
          {/* Prompt Synchronization Section */}
          <Section theme={theme}>
            <SectionHeader theme={theme}>
              <SyncHeader>
                <h3>
                  🔗 Prompt Synchronization
                </h3>
                <SyncStats>
                  <div className="count">
                    {relatedPromptsCount} {relatedPromptsCount === 1 ? 'prompt' : 'prompts'}
                  </div>
                  <SyncIndicator 
                    status={hasRelatedPrompts ? 'linked' : 'unlinked'}
                    count={relatedPromptsCount}
                    animated={isSyncUpdating}
                    size="small"
                  />
                </SyncStats>
              </SyncHeader>
            </SectionHeader>
            <SectionContent>
              {hasRelatedPrompts ? (
                <div>
                  <InfoLabel style={{ 
                    marginBottom: '20px', 
                    display: 'block',
                    padding: '12px 16px',
                    background: 'rgba(72, 187, 120, 0.05)',
                    border: '1px solid rgba(72, 187, 120, 0.2)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    color: 'inherit'
                  }}>
                    ✨ <strong>Smart Sync Enabled:</strong> This element is referenced in {relatedPromptsCount} prompt{relatedPromptsCount !== 1 ? 's' : ''}. 
                    Any changes to selectors will automatically sync to all related prompts.
                  </InfoLabel>
                  {relationships && relationships.promptRefs.map((promptRef, index) => (
                    <PromptCard theme={theme} key={index}>
                      <PromptHeader>
                        <PromptTitle theme={theme}>
                          📝 Prompt Reference
                        </PromptTitle>
                        <PromptMeta theme={theme}>
                          <StepBadge>Step {promptRef.stepIndex + 1}</StepBadge>
                          <ParameterTag theme={theme}>{promptRef.parameterKey}</ParameterTag>
                        </PromptMeta>
                      </PromptHeader>
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ 
                          fontSize: '13px', 
                          color: 'var(--text-secondary, #718096)', 
                          marginBottom: '4px' 
                        }}>
                          Prompt ID: <code style={{ 
                            fontSize: '12px',
                            background: 'var(--code-bg, rgba(0,0,0,0.05))',
                            padding: '2px 4px',
                            borderRadius: '3px'
                          }}>{promptRef.promptId}</code>
                        </div>
                      </div>
                      <div>
                        <div style={{ 
                          fontSize: '13px', 
                          fontWeight: '600', 
                          color: 'var(--text-primary, #4a5568)', 
                          marginBottom: '6px' 
                        }}>
                          Current Selector Value:
                        </div>
                        <SelectorValue theme={theme}>{promptRef.currentValue}</SelectorValue>
                      </div>
                    </PromptCard>
                  ))}
                </div>
              ) : (
                <EmptyState theme={theme}>
                  <div className="icon">🔓</div>
                  <div className="title">No Prompt Synchronization</div>
                  <div className="description">
                    This element is not currently referenced in any prompts.<br/>
                    When you add this element to a prompt, synchronization will be enabled automatically.
                  </div>
                </EmptyState>
              )}
            </SectionContent>
          </Section>
          {/* COLUMN 2 - Analysis & Status */}
          {/* Health & Stability Analysis */}
          <Section theme={theme}>
            <SectionHeader theme={theme}>
               Health & Stability Analysis
            </SectionHeader>
            <SectionContent>
              <InfoGrid>
                <InfoItem theme={theme}>
                  <InfoLabel theme={theme}>Overall Health</InfoLabel>
                  <InfoValue theme={theme}>
                    {healthStatus.status === 'healthy' ? '🟢 Healthy' : 
                     healthStatus.status === 'warning' ? '🟡 Warning' : 
                     '🔴 Needs Attention'} ({healthStatus.score}/100)
                  </InfoValue>
                </InfoItem>
                <InfoItem theme={theme}>
                  <InfoLabel theme={theme}>Dynamic Content Risk</InfoLabel>
                  <InfoValue theme={theme}>
                    {needsWork ? ' High Risk' : ' Low Risk'}
                  </InfoValue>
                </InfoItem>
                <InfoItem theme={theme}>
                  <InfoLabel theme={theme}>Selector Strength</InfoLabel>
                  <InfoValue theme={theme}>
                    {element.cssSelector?.includes('#') ? '💪 Strong (ID-based)' :
                     element.cssSelector?.includes('[data-') ? '👍 Good (Data attributes)' :
                     ' Weak (Generic classes)'}
                  </InfoValue>
                </InfoItem>
                <InfoItem theme={theme}>
                  <InfoLabel theme={theme}>Last Update</InfoLabel>
                  <InfoValue theme={theme}>
                    {(() => {
                      const days = Math.floor((Date.now() - (element.timestamp || Date.now())) / (1000 * 60 * 60 * 24));
                      return days === 0 ? 'Today' : 
                             days === 1 ? '1 day ago' : 
                             days < 7 ? `${days} days ago` : 
                             ' Over a week ago';
                    })()}
                  </InfoValue>
                </InfoItem>
              </InfoGrid>
              {/* Show specific health issues if any */}
              {healthStatus.issues.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <InfoLabel theme={theme} style={{ marginBottom: '10px', display: 'block', fontWeight: 600 }}>
                     Health Issues Detected:
                  </InfoLabel>
                  <ul style={{ 
                    margin: 0, 
                    paddingLeft: '20px',
                    color: theme.colors.surface === '#2d3748' ? '#fc8181' : '#721c24',
                    backgroundColor: theme.colors.surface === '#2d3748' ? 'rgba(245, 101, 101, 0.1)' : '#f8d7da',
                    padding: '12px 20px',
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.surface === '#2d3748' ? 'rgba(245, 101, 101, 0.3)' : '#f5c6cb'}`
                  }}>
                    {healthStatus.issues.map((issue, index) => (
                      <li key={index} style={{ marginBottom: '4px' }}>{String(issue)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionContent>
          </Section>
          {/* Recommendations Section */}
          <Section theme={theme}>
            <SectionHeader theme={theme}>
               Recommendations
            </SectionHeader>
            <SectionContent>
              {(() => {
                const recommendations = [];
                if (healthStatus.status !== 'healthy') {
                  // Generate specific recommendations based on detected issues
                  healthStatus.issues.forEach(issue => {
                    if (issue.includes('Missing both CSS selector and XPath')) {
                      recommendations.push(" Add reliable CSS selector or XPath for this element");
                    } else if (issue.includes('Dynamic content detected')) {
                      recommendations.push(" Review and stabilize dynamic content patterns");
                    } else if (issue.includes('Empty or missing element attributes')) {
                      recommendations.push(" Add meaningful attributes to improve element identification");
                    } else if (issue.includes('Missing or empty text content')) {
                      recommendations.push("📝 Add descriptive text content if applicable");
                    } else if (issue.includes('outdated')) {
                      recommendations.push("🔄 Update element information - it's been outdated");
                    } else if (issue.includes('Weak selector')) {
                      recommendations.push("💪 Improve selector specificity with IDs or data attributes");
                    }
                  });
                  // General recommendations based on status
                  if (healthStatus.status === 'warning') {
                    recommendations.push(" Monitor this element for stability issues");
                  } else if (healthStatus.status === 'error') {
                    recommendations.push("🚨 Prioritize fixing this element to prevent test failures");
                  }
                } else {
                  recommendations.push(" Element is healthy and properly configured");
                  recommendations.push("👍 Continue monitoring for any changes");
                }
                return (
                  <div>
                    {recommendations.map((rec, index) => (
                      <RecommendationItem theme={theme} key={index}>
                        {String(rec)}
                      </RecommendationItem>
                    ))}
                  </div>
                );
              })()}
            </SectionContent>
          </Section>
          {/* COLUMN 3 - Additional Information */}
          {/* Element Attributes Section */}
          {element.attributes && Object.keys(element.attributes).length > 0 && (
            <Section theme={theme}>
              <SectionHeader theme={theme}>
                🏷️ Element Attributes
              </SectionHeader>
              <SectionContent>
                <AttributesList>
                  {Object.entries(element.attributes).map(([key, value]) => (
                    <AttributeTag theme={theme} key={key}>
                      {key}="{typeof value === 'object' ? JSON.stringify(value) : String(value)}"
                    </AttributeTag>
                  ))}
                </AttributesList>
              </SectionContent>
            </Section>
          )}
          {/* Review Queue Management */}
          <Section theme={theme}>
            <SectionHeader theme={theme}>
               Review Queue Status
            </SectionHeader>
            <SectionContent>
              <InfoGrid>
                <InfoItem theme={theme}>
                  <InfoLabel theme={theme}>Queue Status</InfoLabel>
                  <InfoValue theme={theme}>
                    {isInReviewQueue ? (
                      <span style={{ color: '#856404' }}>
                         In Review Queue
                      </span>
                    ) : (
                      <span style={{ color: '#6c757d' }}>
                         Not in Queue
                      </span>
                    )}
                  </InfoValue>
                </InfoItem>
                {isInReviewQueue && (
                  <>
                    <InfoItem theme={theme}>
                      <InfoLabel theme={theme}>Added to Queue</InfoLabel>
                      <InfoValue theme={theme}>
                        {(() => {
                          const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
                          const queueItem = reviewQueue.find((item: any) => item.elementId === element.id);
                          return queueItem ? new Date(queueItem.addedAt).toLocaleString() : 'Unknown';
                        })()}
                      </InfoValue>
                    </InfoItem>
                    {reviewQueueNote && (
                      <InfoItem theme={theme}>
                        <InfoLabel theme={theme}>Review Notes</InfoLabel>
                        <InfoValue theme={theme} style={{ fontStyle: 'italic' }}>
                          "{reviewQueueNote}"
                        </InfoValue>
                      </InfoItem>
                    )}
                  </>
                )}
              </InfoGrid>
              <div style={{ marginTop: '20px' }}>
                <ReviewQueueButton isInQueue={isInReviewQueue} onClick={handleReviewQueueAction}>
                  {isInReviewQueue ? ' Remove from Review Queue' : '➕ Add to Review Queue'}
                </ReviewQueueButton>
              </div>
            </SectionContent>
          </Section>
        </SectionsGrid>
        {/* Action Buttons */}
        <ActionButtons theme={theme}>
          <ActionButton theme={theme} onClick={() => alert('Clone functionality coming soon!')}>
             Clone Element
          </ActionButton>
          <ActionButton theme={theme} variant="danger" onClick={handleDelete}>
            🗑️ Delete Element
          </ActionButton>
        </ActionButtons>
      </ContentWrapper>
      {/* Review Queue Dialog */}
      {showReviewQueueDialog && (
        <ReviewQueueDialog>
          <ReviewQueueDialogContent theme={theme}>
            <ReviewQueueDialogTitle theme={theme}>Add to Review Queue</ReviewQueueDialogTitle>
            <p>Add a note about why this element needs review:</p>
            <ReviewQueueTextarea
              theme={theme}
              value={reviewQueueNote}
              onChange={(e) => setReviewQueueNote(e.target.value)}
              placeholder="Enter review notes (optional)..."
            />
            <ReviewQueueActions>
              <DialogButton 
                theme={theme}
                variant="secondary" 
                onClick={() => {
                  setShowReviewQueueDialog(false);
                  setReviewQueueNote('');
                }}
              >
                Cancel
              </DialogButton>
              <DialogButton 
                theme={theme}
                variant="primary" 
                onClick={() => {
                  addToReviewQueue(reviewQueueNote);
                  setShowReviewQueueDialog(false);
                  setReviewQueueNote('');
                }}
              >
                Add to Queue
              </DialogButton>
            </ReviewQueueActions>
          </ReviewQueueDialogContent>
        </ReviewQueueDialog>
      )}
      {/* Sync Notification */}
      {notification && (
        <SyncNotificationComponent 
          type={notification.type}
          message={notification.message}
          onClose={clearNotification}
        />
      )}
    </Container>
  );
};
export default ElementReviewPage;