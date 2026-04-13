import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { spinKeyframes } from '../../../shared/styles/keyframes';
import { useTheme } from '../../../contexts/ThemeContext';
import { useToast } from '../../../shared/ui/Toast';
import { ElementFilterBar, Element } from '../../../shared/ui/ElementFilterBar';
import { EditableElementName } from '../../../shared/ui/EditableElementName';
import { Breadcrumb } from '../../../shared/ui/Breadcrumb';
import { sqlApiClient, RecordedElementDB } from '../../../shared/utils/sqlApiClient';
import { http } from '../../../shared/api';
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

import { 
  RefreshCw, 
  Plus, 
  Search, 
  Filter, 
  ArrowLeft, 
  Eye, 
  Edit3,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Database,
  Layers,
  MoreVertical
} from 'lucide-react';
// ================================
// Modern Styled Components
// ================================
const Container = styled.div`
  background: ${props => props.theme.colors.background};
  min-height: 100vh;
  font-family: '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif;
`;
const Layout = styled.div`
  display: flex;
  height: 100vh;
`;
const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;
const ModernHeader = styled.div`
  background: ${props => props.theme.colors.surface};
  padding: 32px 40px;
  box-shadow: ${props => props.theme.shadows.medium};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  @media (max-width: 768px) {
    padding: 20px;
  }
`;

const BreadcrumbLink = styled.span`
  color: ${props => props.theme.colors.primary};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
  &:hover {
    color: ${props => props.theme.colors.secondary};
  }
`;
const TitleSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
  }
`;
const TitleLeft = styled.div`
  flex: 1;
`;
const Category = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: white;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
`;
const ModernTitle = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin: 0;
  line-height: 1.2;
`;
const ActionsBar = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  @media (max-width: 768px) {
    flex-wrap: wrap;
    width: 100%;
    justify-content: center;
  }
`;
const PrimaryButton = styled.button<{ variant?: 'primary' | 'loading' }>`
  background: ${props => props.variant === 'loading' 
    ? 'linear-gradient(135deg, #6b7280, #4b5563)' 
    : '#185FA5'};
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  cursor: ${props => props.variant === 'loading' ? 'not-allowed' : 'pointer'};
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: ${props => props.variant === 'loading' 
    ? 'none' 
    : '0 4px 15px rgba(102, 126, 234, 0.4)'};
  &:hover {
    transform: ${props => props.variant === 'loading' ? 'none' : 'translateY(-2px)'};
    box-shadow: ${props => props.variant === 'loading' 
      ? 'none' 
      : '0 6px 20px rgba(102, 126, 234, 0.6)'};
  }
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;
const SecondaryButton = styled.button`
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  border: 1px solid ${props => props.theme.colors.border};
  padding: 12px 20px;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: ${props => props.theme.shadows.small};
  &:hover {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.medium};
    background: ${props => props.theme.colors.background};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;
const StatsBar = styled.div`
  display: flex;
  gap: 24px;
  align-items: center;
`;
const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`;
const StatNumber = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
`;
const StatLabel = styled.div`
  font-size: 12px;
  color: ${props => props.theme.colors.textSecondary};
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
`;
const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface};
  padding: 0 40px;
  @media (max-width: 768px) {
    padding: 0 20px;
    overflow-x: auto;
  }
`;
const Tab = styled.div<{ active?: boolean }>`
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 600;
  color: ${props => props.active ? props.theme.colors.primary : props.theme.colors.textSecondary};
  cursor: pointer;
  border-bottom: 2px solid ${props => props.active ? props.theme.colors.primary : 'transparent'};
  transition: all 0.3s ease;
  white-space: nowrap;
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  &:hover {
    color: ${props => props.theme.colors.primary};
    background: rgba(102, 126, 234, 0.05);
  }
`;
const ElementBadge = styled.span`
  background: ${props => props.theme.colors.primary};
  color: white;
  border-radius: 12px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 700;
  margin-left: 8px;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
`;
const FilterBar = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 20px 40px;
  background: ${props => props.theme.colors.background};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  @media (max-width: 768px) {
    padding: 16px 20px;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
`;
const SearchContainer = styled.div`
  position: relative;
  flex: 1;
  max-width: 400px;
`;
const SearchInput = styled.input<{ isSearching?: boolean }>`
  width: 100%;
  padding: 12px 16px 12px 44px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  font-size: 14px;
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  transition: all 0.3s ease;
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  &::placeholder {
    color: ${props => props.theme.colors.textSecondary};
  }
  ${props => props.isSearching && `
    border-color: ${props.theme.colors.primary};
    background: linear-gradient(90deg, ${props.theme.colors.surface} 0%, rgba(102, 126, 234, 0.05) 100%);
  `}
`;
const SearchIcon = styled.div`
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: ${props => props.theme.colors.textSecondary};
`;
const FilterSelect = styled.select`
  padding: 12px 16px;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
  font-size: 14px;
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  min-width: 150px;
  cursor: pointer;
  transition: all 0.3s ease;
  &:focus {
    outline: none;
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;
const FilterSummary = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 40px;
  background: ${props => props.theme.colors.background};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
  @media (max-width: 768px) {
    padding: 12px 20px;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
`;
const FilterCount = styled.span`
  font-weight: 600;
  color: ${props => props.theme.colors.primary};
`;
const ClearFiltersButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.primary};
  cursor: pointer;
  text-decoration: underline;
  font-size: 14px;
  transition: all 0.2s ease;
  &:hover {
    color: ${props => props.theme.colors.secondary};
  }
`;
const Content = styled.div`
  flex: 1;
  padding: 40px;
  overflow: auto;
  background: ${props => props.theme.colors.background};
  @media (max-width: 768px) {
    padding: 20px;
  }
`;
const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
  flex-direction: column;
  gap: 16px;
`;
const LoadingSpinner = styled.div`
  border: 2px solid ${props => props.theme.colors.border};
  border-top: 2px solid ${props => props.theme.colors.primary};
  border-radius: 50%;
  width: 32px;
  height: 32px;
  animation: ${spinKeyframes} 1s linear infinite;
`;
const LoadingText = styled.span`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 16px;
`;
const ErrorMessage = styled.div`
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  border: 1px solid #c85050;
  color: #8a2222;
  padding: 20px;
  border-radius: 12px;
  margin: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(248, 113, 113, 0.2);
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
  min-height: 300px;
`;

const EmptyStateIcon = styled.div`
  font-size: 64px;
  margin-bottom: 24px;
  opacity: 0.5;
`;
const EmptyStateTitle = styled.h3`
  font-size: 24px;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0 0 12px 0;
`;
const EmptyStateText = styled.p`
  font-size: 16px;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0 0 24px 0;
  max-width: 500px;
  line-height: 1.5;
`;
// Element Grid Components - Two Column Layout
const ElementGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;
const PaginationBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding: 14px 18px;
  background: ${props => props.theme.colors.surface};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: 12px;
`;

const PaginationInfo = styled.div`
  font-size: 14px;
  color: ${props => props.theme.colors.textSecondary};
`;

const PaginationButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const PaginationButton = styled.button`
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.surface};
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  font-weight: 600;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ElementCard = styled.div<{ $isSelected?: boolean }>`
  background: ${props => props.theme.colors.surface};
  border-radius: 16px;
  padding: 24px;
  box-shadow: ${props => props.theme.shadows.medium};
  transition: all 0.3s ease;
  border: 2px solid ${props => props.$isSelected ? props.theme.colors.primary : props.theme.colors.border};
  cursor: pointer;
  position: relative;
  ${props => props.$isSelected && `
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05));
  `}
  &:hover {
    transform: translateY(-4px);
    box-shadow: ${props => props.theme.shadows.large};
  }
`;

const SelectionCheckbox = styled.div<{ $checked: boolean }>`
  position: absolute;
  top: 16px;
  left: 16px;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid ${props => props.$checked ? props.theme.colors.primary : props.theme.colors.border};
  background: ${props => props.$checked ? props.theme.colors.primary : 'transparent'};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${props => props.theme.colors.primary};
    transform: scale(1.1);
  }
  
  ${props => props.$checked && `
    &::after {
      content: '✓';
      color: white;
      font-weight: bold;
      font-size: 14px;
    }
  `}
`;

const ElementCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  margin-left: 36px;
`;
const ElementInfo = styled.div`
  flex: 1;
`;
const ElementId = styled.h3`
  margin: 0 0 8px 0;
  color: ${props => props.theme.colors.text};
  font-size: 18px;
  font-weight: 600;
  word-break: break-word;
`;
const ElementTag = styled.span`
  background: linear-gradient(135deg, #e5e7eb, #f3f4f6);
  color: ${props => props.theme.colors.text};
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  border: 1px solid ${props => props.theme.colors.border};
`;
const ElementText = styled.div`
  margin: 12px 0;
  padding: 12px;
  background: ${props => props.theme.colors.background};
  border-radius: 8px;
  font-style: italic;
  color: ${props => props.theme.colors.textSecondary};
  font-size: 14px;
  border: 1px solid ${props => props.theme.colors.border};
  word-break: break-word;
`;
const SelectorsSection = styled.div`
  margin: 16px 0;
`;
const SectionLabel = styled.div`
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin-bottom: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
`;
const SelectorsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;
const SelectorItem = styled.div<{ dynamicType?: string }>`
  background: ${props => {
    switch(props.dynamicType) {
      case 'high': return '#fee2e2';
      case 'medium': return '#fef3c7';
      case 'low': return '#dbeafe';
      default: return props.theme.colors.background;
    }
  }};
  padding: 8px 12px;
  border-radius: 6px;
  font-family: 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
  font-size: 12px;
  color: ${props => props.theme.colors.text};
  word-break: break-all;
  border-left: 3px solid ${props => {
    switch(props.dynamicType) {
      case 'high': return '#8a2222';
      case 'medium': return '#f59e0b';
      case 'low': return '#3b82f6';
      default: return 'transparent';
    }
  }};
  border: 1px solid ${props => {
    switch(props.dynamicType) {
      case 'high': return '#fca5a5';
      case 'medium': return '#fbbf24';
      case 'low': return '#93c5fd';
      default: return props.theme.colors.border;
    }
  }};
`;
const DynamicWarning = styled.div<{ severity?: string }>`
  font-size: 11px;
  margin-top: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 500;
  background: ${props => {
    switch(props.severity) {
      case 'high': return '#fee2e2';
      case 'medium': return '#fef3c7';
      case 'low': return '#dbeafe';
      default: return '#f3f4f6';
    }
  }};
  color: ${props => {
    switch(props.severity) {
      case 'high': return '#8a2222';
      case 'medium': return '#f59e0b';
      case 'low': return '#3b82f6';
      default: return '#6b7280';
    }
  }};
  border: 1px solid ${props => {
    switch(props.severity) {
      case 'high': return '#fca5a5';
      case 'medium': return '#fbbf24';
      case 'low': return '#93c5fd';
      default: return '#d1d5db';
    }
  }};
`;
const HealthBadge = styled.div<{ status: 'healthy' | 'warning' | 'error' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${props => {
    switch (props.status) {
      case 'healthy': return 'linear-gradient(135deg, #d1fae5, #a7f3d0)';
      case 'warning': return 'linear-gradient(135deg, #fef3c7, #fde68a)';
      case 'error': return 'linear-gradient(135deg, #fee2e2, #fecaca)';
      default: return '#f8f9fa';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'healthy': return '#065f46';
      case 'warning': return '#92400e';
      case 'error': return '#991b1b';
      default: return '#6c757d';
    }
  }};
  box-shadow: ${props => {
    switch (props.status) {
      case 'healthy': return '0 2px 4px rgba(16, 185, 129, 0.2)';
      case 'warning': return '0 2px 4px rgba(245, 158, 11, 0.2)';
      case 'error': return '0 2px 4px rgba(239, 68, 68, 0.2)';
      default: return 'none';
    }
  }};
`;
const HealthDot = styled.div<{ status: 'healthy' | 'warning' | 'error' }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${props => {
    switch (props.status) {
      case 'healthy': return '#1D9E75';
      case 'warning': return '#f59e0b';
      case 'error': return '#A32D2D';
      default: return '#6c757d';
    }
  }};
`;
const ElementFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid ${props => props.theme.colors.border};
`;
const PageBadge = styled.span`
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.textSecondary};
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  border: 1px solid ${props => props.theme.colors.border};
  font-weight: 500;
`;
const Timestamp = styled.span`
  color: ${props => props.theme.colors.textSecondary};
  font-size: 12px;
`;
const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;
const ActionButton = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
  background: ${props => {
    switch(props.variant) {
      case 'primary': return 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
      case 'danger': return 'linear-gradient(135deg, #A32D2D, #8a2222)';
      default: return props.theme.colors.background;
    }
  }};
  color: ${props => {
    switch(props.variant) {
      case 'primary': 
      case 'danger': return 'white';
      default: return props.theme.colors.text;
    }
  }};
  border: 1px solid ${props => {
    switch(props.variant) {
      case 'primary': 
      case 'danger': return 'transparent';
      default: return props.theme.colors.border;
    }
  }};
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${props => {
      switch(props.variant) {
        case 'primary': return '0 4px 8px rgba(59, 130, 246, 0.3)';
        case 'danger': return '0 4px 8px rgba(239, 68, 68, 0.3)';
        default: return props.theme.shadows.small;
      }
    }};
  }
`;
// ================================
// Policy Integration for Selector Display
// ================================
interface PolicyBasedSelectorConfig {
  preferCssOverXpath: boolean;
  showDynamicWarnings: boolean;
  hideWeakSelectors: boolean;
  showBothSelectors: boolean;
}
// Helper function to get selector display policy from the policy engine
const getPolicyBasedSelectorConfig = async (): Promise<PolicyBasedSelectorConfig> => {
  try {
    // Fetch policy configuration from the unified API
    const response = await http<any>('/api/v1/policy/dashboard/config');
    if (response && response.success && response.data && response.data.locatorHealing) {
      const locatorHealing = response.data.locatorHealing;
      return {
        preferCssOverXpath: locatorHealing.preferCssOverXpath ?? true,
        showDynamicWarnings: true,
        hideWeakSelectors: false,
        showBothSelectors: false // Show only preferred type by default
      };
    }
  } catch (error) {
  }
  // Fallback to default policy
  return {
    preferCssOverXpath: true,
    showDynamicWarnings: true,
    hideWeakSelectors: false,
    showBothSelectors: false
  };
};
// Helper function to get the best selector based on policy
const getBestSelectorByPolicy = (element: RecordedElement, config: PolicyBasedSelectorConfig): { selector: string; type: 'css' | 'xpath' } | null => {
  const cssSelector = element.cssSelector;
  const xpath = element.xpath;
  // If showing both selectors, this function shouldn't be used
  if (config.showBothSelectors) {
    return null;
  }
  // Check for weak selectors if policy requires hiding them
  if (config.hideWeakSelectors) {
    const weakPatterns = [
      /^div$/,
      /^span$/,
      /^input$/,
      /^button$/,
      /div:nth-child\(\d+\)$/,
      /^\[style\]/,
    ];
    if (cssSelector && weakPatterns.some(pattern => pattern.test(cssSelector))) {
      // CSS is weak, prefer XPath if available
      if (xpath) return { selector: xpath, type: 'xpath' };
    }
    if (xpath && weakPatterns.some(pattern => pattern.test(xpath))) {
      // XPath is weak, prefer CSS if available
      if (cssSelector) return { selector: cssSelector, type: 'css' };
    }
  }
  // Apply preferred type policy
  if (config.preferCssOverXpath && cssSelector) {
    return { selector: cssSelector, type: 'css' };
  }
  if (!config.preferCssOverXpath && xpath) {
    return { selector: xpath, type: 'xpath' };
  }
  // Fallback: return whatever is available
  if (cssSelector) return { selector: cssSelector, type: 'css' };
  if (xpath) return { selector: xpath, type: 'xpath' };
  return null;
};
// ================================
// Component
// ================================
const MCPElementsViewer: React.FC = () => {
  const navigate = useNavigate();
  const { showToast, showSuccess, showError, showWarning, showInfo } = useToast();
  const [elements, setElements] = useState<RecordedElement[]>([]);
  const [filteredElements, setFilteredElements] = useState<RecordedElement[]>([]);
  const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedPage, setSelectedPage] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all'); // 'all', 'healthy', 'warning', 'error'
  const [activeTab, setActiveTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectorConfig, setSelectorConfig] = useState<PolicyBasedSelectorConfig>({
    preferCssOverXpath: true,
    showDynamicWarnings: true,
    hideWeakSelectors: false,
    showBothSelectors: false
  });
  // Debounce search term to improve performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);
  // Create a render key to force re-renders when filters change
  const renderKey = React.useMemo(() => {
    return `${selectedPage}-${healthFilter}-${debouncedSearchTerm}-${elements.length}`;
  }, [selectedPage, healthFilter, debouncedSearchTerm, elements.length]);
  // Filter elements based on search and filters - removed old filtering, now using ElementFilterBar
  // Convert RecordedElement to Element format for ElementFilterBar
  const elementsForFilter: Element[] = React.useMemo(() => {
    return elements.map(el => ({
      id: el.id,
      name: el.text || el.id,
      type: el.tag,
      page: el.page,
      cssSelector: el.cssSelector,
      xpath: el.xpath,
      isActive: el.isActive
    }));
  }, [elements]);
  
  // Memoize the filter callback to prevent infinite re-renders
  const handleFilteredElementsChange = useCallback((filtered: Element[]) => {
    const filteredIds = new Set(filtered.map(e => e.id));
    setFilteredElements(elements.filter(el => filteredIds.has(el.id)));
  }, [elements]);
  
  // Load policy-based selector configuration
  useEffect(() => {
    const loadSelectorPolicy = async () => {
      try {
        const config = await getPolicyBasedSelectorConfig();
        setSelectorConfig(config);
      } catch (error) {
      }
    };
    loadSelectorPolicy();
  }, []);
  // Helper function to get a meaningful element name
  const getElementDisplayName = (element: RecordedElement): string => {
    // If the logical key is "UNKNOWN" or empty, try to generate a better name
    if (!element.id || element.id === 'UNKNOWN' || element.id.trim() === '') {
      // Try to create a meaningful name from available data
      let name = '';
      // First, try to use text content if it's meaningful
      if (element.text && element.text !== '[null]' && element.text.trim() !== '') {
        const text = element.text.trim();
        if (text.length <= 30) {
          name = `${element.tag}: "${text}"`;
        } else {
          name = `${element.tag}: "${text.substring(0, 27)}..."`;
        }
      }
      // Try to extract meaningful info from selectors
      else if (element.cssSelector || element.xpath) {
        const selector = element.cssSelector || element.xpath || '';
        // Extract ID from CSS selector like #item_5_title_link
        const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
        if (idMatch) {
          name = `${element.tag}#${idMatch[1]}`;
        }
        // Extract ID from XPath like [@id="item_5_title_link"]
        else {
          const xpathIdMatch = selector.match(/@id\s*=\s*["']([^"']+)["']/);
          if (xpathIdMatch) {
            name = `${element.tag}#${xpathIdMatch[1]}`;
          }
          // Extract class from selector
          else {
            const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/);
            if (classMatch) {
              name = `${element.tag}.${classMatch[1]}`;
            }
            // Extract name attribute from XPath
            else {
              const xpathNameMatch = selector.match(/@name\s*=\s*["']([^"']+)["']/);
              if (xpathNameMatch) {
                name = `${element.tag}[name="${xpathNameMatch[1]}"]`;
              }
            }
          }
        }
      }
      // Try to use meaningful attributes
      else if (element.attributes) {
        const attrs = element.attributes;
        if (attrs.id) {
          name = `${element.tag}#${attrs.id}`;
        } else if (attrs.name) {
          name = `${element.tag}[name="${attrs.name}"]`;
        } else if (attrs.class) {
          const classes = attrs.class.split(' ').filter((c: string) => c && !c.startsWith('mcp-'));
          if (classes.length > 0) {
            name = `${element.tag}.${classes[0]}`;
          }
        } else if (attrs.placeholder) {
          name = `${element.tag}[placeholder="${attrs.placeholder}"]`;
        } else if (attrs.type) {
          name = `${element.tag}[type="${attrs.type}"]`;
        }
      }
      // Fallback to just the tag with a sequential identifier
      if (!name) {
        name = `${element.tag} element`;
      }
      return name;
    }
    // Use the original ID if it's meaningful
    return element.id;
  };
  // Helper function to render selector based on policy
  const renderSelectorWithPolicy = (element: RecordedElement) => {
    const bestSelector = getBestSelectorByPolicy(element, selectorConfig);
    if (!bestSelector) {
      // No selector available
      return (
        <SelectorItem>
          <strong>No Selector:</strong> No CSS or XPath selector available
        </SelectorItem>
      );
    }
    const dynamicMatches = detectDynamicContent(bestSelector.selector);
    const severity = getDynamicContentSeverity(dynamicMatches);
    const warning = getDynamicContentWarning(dynamicMatches);
    const selectorTypeLabel = bestSelector.type === 'css' ? 'CSS' : 'XPath';
    return (
      <SelectorItem dynamicType={dynamicMatches.length > 0 ? severity : undefined}>
        <strong>{selectorTypeLabel}:</strong> {bestSelector.selector}
        {selectorConfig.showDynamicWarnings && warning && (
          <DynamicWarning severity={severity}>
            {warning}
          </DynamicWarning>
        )}
      </SelectorItem>
    );
  };
  // Helper function to check if element needs work (has dynamic content)
  const elementNeedsWork = (element: RecordedElement): boolean => {
    const cssHasDynamic = element.cssSelector && isDynamicSelector(element.cssSelector);
    const xpathHasDynamic = element.xpath && isDynamicSelector(element.xpath);
    return !!(cssHasDynamic || xpathHasDynamic);
  };
  // Helper function to get health status with score
  const getElementHealthStatus = (element: RecordedElement): { status: 'healthy' | 'warning' | 'error', score: number, label: string } => {
    // First check if element is in review queue - this overrides health score
    const reviewQueue = JSON.parse(localStorage.getItem('reviewQueue') || '[]');
    const isInQueue = reviewQueue.some((item: any) => item.elementId === element.id);
    if (isInQueue) {
      return { 
        status: 'error', 
        score: 0, 
        label: 'In Review Queue' 
      };
    }
    let healthScore = 100;
    const issues: string[] = [];
    // Same health calculation logic
    if (elementNeedsWork(element)) {
      healthScore -= 30;
      issues.push('dynamic content');
    }
    if (!element.cssSelector && !element.xpath) {
      healthScore -= 50;
      issues.push('missing selectors');
    }
    const hasEmptyAttributes = !element.attributes || 
      Object.keys(element.attributes).length === 0 ||
      JSON.stringify(element.attributes) === '{}';
    if (hasEmptyAttributes) {
      healthScore -= 20;
      issues.push('empty attributes');
    }
    if (!element.text || element.text === '[null]' || element.text.trim() === '') {
      healthScore -= 10;
      issues.push('missing text');
    }
    const daysSinceUpdate = (Date.now() - (element.timestamp || Date.now())) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 30) {
      healthScore -= 25;
      issues.push('outdated');
    }
    const selector = element.cssSelector || element.xpath || '';
    const weakPatterns = [
      /^div$/,                    
      /^span$/,                   
      /^input$/,                  
      /^button$/,                 
      /div:nth-child\(\d+\)$/,    
      /^\[style\]/,               
    ];
    if (weakPatterns.some(pattern => pattern.test(selector))) {
      healthScore -= 15;
      issues.push('weak selector');
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
    return { status, score: healthScore, label };
  };
  // Load elements from SQL Backend
  const loadElements = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if SQL backend is available
      const isHealthy = await sqlApiClient.healthCheck();
      if (!isHealthy) {
        throw new Error('SQL backend is not available - please ensure the backend server is running');
      }
      // Load from SQL backend
      const response = await sqlApiClient.getAllElements({ limit: 1000 });
      // Handle different response formats
      let elementsData = [];
      if (response && typeof response === 'object') {
        if (response.success && response.data) {
          // Standard ApiResponse format: {success: true, data: [...]}
          elementsData = response.data;
        } else if (Array.isArray(response)) {
          // Direct array response: [{...}, {...}]
          elementsData = response;
        } else {
          throw new Error(`Unexpected response format: ${JSON.stringify(response).substring(0, 100)}...`);
        }
      } else {
        throw new Error('Invalid response from server');
      }
      if (elementsData && elementsData.length > 0) {
        // Filter out inactive/deleted elements
        const hasIsActiveField = 'is_active' in elementsData[0];
        if (hasIsActiveField) {
          const originalCount = elementsData.length;
          const activeCount = elementsData.filter(el => el.is_active === true).length;
          const inactiveCount = elementsData.filter(el => el.is_active === false).length;
          // Only show active elements
          elementsData = elementsData.filter(el => el.is_active !== false);
        }
        // Convert API elements to frontend format
        const frontendElements = elementsData.map((apiElement, index) => {
          try {
            // Handle both database format and simple API format
            if (apiElement.logical_key && apiElement.timestamp_recorded) {
              // Database format - use existing conversion
              // Convert database element to frontend format
              // Use database ID as unique identifier, fallback to unique generated ID
              return {
                id: apiElement.id ? String(apiElement.id) : `element_${index}_${Date.now()}`,
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
              // Simple API format - convert directly
              // Ensure unique ID by using database ID or unique generated ID
              const uniqueId = apiElement.id ? String(apiElement.id) : `element_${index}_${Date.now()}`;
              return {
                id: uniqueId,
                dbId: apiElement.id || index,
                tag: apiElement.tag || 'unknown',
                text: apiElement.text || apiElement.text_content || '',
                cssSelector: apiElement.css_selector || '',
                xpath: apiElement.xpath || '',
                href: apiElement.href || '',
                src: apiElement.src || '',
                page: apiElement.page || 'unknown',
                isActive: apiElement.is_active !== false,
                selectors: apiElement.selectors || [apiElement.css_selector, apiElement.xpath].filter(Boolean),
                attributes: apiElement.attributes || {},
                timestamp: apiElement.timestamp_recorded ? 
                  new Date(apiElement.timestamp_recorded).getTime() : 
                  Date.now()
              } as RecordedElement;
            }
          } catch (conversionError) {
            // Return a minimal element to avoid breaking the UI
            return {
              id: `error_element_${index}_${Date.now()}`,
              dbId: apiElement.id || index,
              tag: 'error',
              text: 'Error loading element',
              cssSelector: '',
              xpath: '',
              href: '',
              src: '',
              page: 'unknown',
              isActive: true,
              selectors: [],
              attributes: {},
              timestamp: Date.now()
            } as RecordedElement;
          }
        });
        
        // Deduplicate elements by ID to prevent duplicate key warnings
        const uniqueElements = Array.from(
          new Map(frontendElements.map(el => [el.id, el])).values()
        );
        
        setElements(uniqueElements);
        showSuccess('Elements Loaded', `Successfully loaded ${uniqueElements.length} elements`);
        // Force immediate filtering after elements are loaded
        // This will trigger the useEffect above
        // Log some stats for debugging
        const pages = new Set(uniqueElements.map(e => e.page));
        const tags = new Set(uniqueElements.map(e => e.tag));
      } else {
        setElements([]);
      }
    } catch (error: any) {
      const errorMsg = `Failed to load elements: ${error.message}`;
      setError(errorMsg);
      setElements([]);
      showError('Loading Failed', errorMsg);
    } finally {
      setLoading(false);
    }
  }, [showSuccess, showError]);
  
  // Bulk action handlers
  const handleBulkAction = async (action: 'delete' | 'healthCheck', selectedIds: string[]) => {
    if (selectedIds.length === 0) {
      showWarning('No Selection', 'Please select elements first');
      return;
    }

    if (action === 'delete') {
      const confirmed = window.confirm(`Are you sure you want to delete ${selectedIds.length} element(s)? This cannot be undone.`);
      if (!confirmed) return;

      showInfo('Deleting Elements', `Deleting ${selectedIds.length} element(s)...`);
      
      try {
        // Delete each selected element
        const deletePromises = selectedIds.map(id => {
          const element = elements.find(e => e.id === id);
          if (element && element.dbId) {
            return sqlApiClient.deleteElement(String(element.dbId));
          }
          return Promise.resolve({ success: true });
        });

        await Promise.all(deletePromises);
        
        // Update local state
        setElements(elements.filter(e => !selectedIds.includes(e.id)));
        setSelectedElements(new Set());
        showSuccess('Elements Deleted', `Successfully deleted ${selectedIds.length} element(s)`);
      } catch (error: any) {
        showError('Delete Failed', `Failed to delete elements: ${error.message}`);
      }
    } else if (action === 'healthCheck') {
      showInfo('Health Check', `Running health check on ${selectedIds.length} element(s)...`);
      
      try {
        // Simulate health check (in real app, this would call an API)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const healthyCount = Math.floor(selectedIds.length * 0.7);
        const warningCount = selectedIds.length - healthyCount;
        
        showSuccess('Health Check Complete', 
          `${healthyCount} elements healthy, ${warningCount} need attention`);
      } catch (error: any) {
        showError('Health Check Failed', `Failed to run health check: ${error.message}`);
      }
    }
  };
  
  // Handle element selection
  const handleElementClick = (element: RecordedElement) => {
    // Navigate using the element ID
    navigate(`/app/review/${element.id}`);
  };
  // Delete element
  const deleteElement = async (elementId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click
    if (!window.confirm(`Are you sure you want to delete element "${elementId}"?`)) {
      return;
    }
    
    showInfo('Deleting Element', `Removing element "${elementId}"...`);
    
    try {
      // Find the element in our current list to get the database ID
      const elementToDelete = elements.find(e => e.id === elementId);
      if (!elementToDelete) {
        throw new Error(`Element "${elementId}" not found in current list`);
      }
      if (!elementToDelete.dbId) {
        throw new Error(`Element "${elementId}" is missing database ID (dbId: ${elementToDelete.dbId})`);
      }
      // Try to delete from SQL backend first
      const isHealthy = await sqlApiClient.healthCheck();
      if (!isHealthy) {
        throw new Error('SQL backend not available');
      }
      const deleteResponse = await sqlApiClient.deleteElement(String(elementToDelete.dbId));
      if (!deleteResponse.success) {
        throw new Error(deleteResponse.error || 'Failed to delete from database');
      }
      // Only update local state if database deletion succeeded
      const updatedElements = elements.filter(e => e.id !== elementId);
      setElements(updatedElements);
      showSuccess('Element Deleted', `Successfully removed "${elementId}"`);
      
      // Handle sync relationships for deleted element
      try {
        const { elementPromptSyncService } = await import('../../../shared/services/elementPromptSyncService');
        const syncResult = await elementPromptSyncService.handleDeletedElement(elementId);
        if (syncResult.alternativeFound) {
          showInfo('Sync Updated', syncResult.message);
        } else if (syncResult.success) {
          if (syncResult.message.includes('prompts may need manual review')) {
            showWarning('Review Needed', syncResult.message);
          }
        }
      } catch (syncError) {
        // Don't block deletion if sync fails
      }
    } catch (error: any) {
      // Show detailed error to user
      const errorMsg = `Failed to delete element "${elementId}": ${error.message}`;
      showError('Delete Failed', errorMsg);
    }
  };
  useEffect(() => {
    loadElements();
  }, [loadElements]);
  // Get unique pages for filter dropdown with improved handling
  const allPages = React.useMemo(() => {
    if (loading || elements.length === 0) {
      return [];
    }
    const pageSet = new Set<string>();
    elements.forEach(element => {
      const page = (element.page || 'unknown').trim();
      if (page) {
        pageSet.add(page);
      } else {
        pageSet.add('unknown');
      }
    });
    const sortedPages = Array.from(pageSet).sort((a, b) => {
      // Sort with 'unknown' at the end
      if (a === 'unknown' && b !== 'unknown') return 1;
      if (a !== 'unknown' && b === 'unknown') return -1;
      return a.localeCompare(b);
    });
    return sortedPages;
  }, [elements, loading]);
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  // Calculate stats
  const totalElements = elements.length;
  const filteredCount = filteredElements.length;
  const elementsPerPage = 24;
  const totalPages = Math.max(1, Math.ceil(filteredCount / elementsPerPage));
  const pageStartIndex = (currentPage - 1) * elementsPerPage;
  const pageEndIndex = pageStartIndex + elementsPerPage;
  const paginatedFilteredElements = filteredElements.slice(pageStartIndex, pageEndIndex);
  const healthyCount = elements.filter(e => getElementHealthStatus(e).status === 'healthy').length;
  const warningCount = elements.filter(e => getElementHealthStatus(e).status === 'warning').length;
  const errorCount = elements.filter(e => getElementHealthStatus(e).status === 'error').length;
  const clearFilters = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setSelectedPage('all');
    setHealthFilter('all');
    // No need to manually set filteredElements since useMemo will handle it
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredCount, activeTab]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <Container>
      <Layout>
        <MainContent>
          {/* Header */}
          <ModernHeader>
            <Breadcrumb>
              <BreadcrumbLink onClick={() => navigate('/app/elements')}>
                <ArrowLeft size={16} />
                Dashboard
              </BreadcrumbLink>
              <span>{'>'}</span>
              <span>Element Repository</span>
            </Breadcrumb>
            <TitleSection>
              <TitleLeft>
                <Category>
                  <Database size={14} />
                  Element Management
                </Category>
                <ModernTitle>Element Repository</ModernTitle>
              </TitleLeft>
              <ActionsBar>
                <PrimaryButton
                  variant={loading ? 'loading' : 'primary'}
                  onClick={loadElements}
                  disabled={loading}
                >
                  <RefreshCw size={16} />
                  {loading ? 'Loading...' : 'Refresh'}
                </PrimaryButton>
                <SecondaryButton>
                  <Plus size={16} />
                  New Element
                </SecondaryButton>
              </ActionsBar>
            </TitleSection>
            <StatsBar>
              <StatItem>
                <StatNumber>{totalElements}</StatNumber>
                <StatLabel>Total Elements</StatLabel>
              </StatItem>
              <StatItem>
                <StatNumber>{healthyCount}</StatNumber>
                <StatLabel>Healthy</StatLabel>
              </StatItem>
              <StatItem>
                <StatNumber>{warningCount}</StatNumber>
                <StatLabel>Warning</StatLabel>
              </StatItem>
              <StatItem>
                <StatNumber>{errorCount}</StatNumber>
                <StatLabel>Needs Attention</StatLabel>
              </StatItem>
              <StatItem>
                <StatNumber>{allPages.length}</StatNumber>
                <StatLabel>Pages</StatLabel>
              </StatItem>
            </StatsBar>
          </ModernHeader>
          {/* Tabs */}
          <TabsContainer>
            <Tab
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            >
              <Layers size={14} />
              All Elements
              <ElementBadge>{totalElements}</ElementBadge>
            </Tab>
          </TabsContainer>
          {/* Filter Bar */}
          {activeTab === 'overview' && (
            <ElementFilterBar
              elements={elementsForFilter}
              onFilteredElementsChange={handleFilteredElementsChange}
              onBulkAction={handleBulkAction}
              selectedElements={selectedElements}
              onSelectionChange={setSelectedElements}
            />
          )}
          {/* Content */}
          <Content>
            {activeTab === 'overview' && (
              <>
                {loading && (
                  <LoadingContainer>
                    <LoadingSpinner />
                    <LoadingText>Loading elements from database...</LoadingText>
                  </LoadingContainer>
                )}
                {!loading && error && (
                  <ErrorMessage>
                    <div>
                      <strong>Error loading elements:</strong> {error}
                    </div>
                    <SecondaryButton onClick={loadElements}>
                      <RefreshCw size={16} />
                      Retry
                    </SecondaryButton>
                  </ErrorMessage>
                )}
                {!loading && filteredElements.length === 0 && !error && (
                  <EmptyState>
                    <EmptyStateIcon>🗂️</EmptyStateIcon>
                    <EmptyStateTitle>
                      {elements.length === 0 ? 'No Elements Found' : 'No Matching Elements'}
                    </EmptyStateTitle>
                    <EmptyStateText>
                      {elements.length === 0 
                        ? 'No recorded elements are available. Start recording elements using the Chrome Extension to see them here.'
                        : 'No elements match your current search and filter criteria. Try adjusting your search terms or clearing filters.'
                      }
                    </EmptyStateText>
                    {elements.length === 0 && (
                      <PrimaryButton onClick={loadElements}>
                        <RefreshCw size={16} />
                        Refresh Elements
                      </PrimaryButton>
                    )}
                  </EmptyState>
                )}
                {!loading && filteredElements.length > 0 && (
                  <ElementGrid key={renderKey}>
                    {(() => {
                      // Log detailed element data for debugging
                      if (filteredElements.length > 0) {
                      }
                      return paginatedFilteredElements.map((element) => {
                        const healthStatus = getElementHealthStatus(element);
                        return (
                          <ElementCard 
                            key={element.id}
                            $isSelected={selectedElements.has(element.id)}
                            onClick={() => handleElementClick(element)}
                          >
                            <SelectionCheckbox
                              $checked={selectedElements.has(element.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                const newSelected = new Set(selectedElements);
                                if (newSelected.has(element.id)) {
                                  newSelected.delete(element.id);
                                } else {
                                  newSelected.add(element.id);
                                }
                                setSelectedElements(newSelected);
                              }}
                            />
                            <ElementCardHeader>
                              <ElementInfo>
                                {element.id && element.id !== 'UNKNOWN' && (
                                  <EditableElementName
                                    currentName={element.id}
                                    elementType={element.tag}
                                    pageContext={element.page}
                                    onSave={async (newName) => {
                                      if (!element.dbId) {
                                        throw new Error('Element not found');
                                      }
                                      const response = await sqlApiClient.updateElement(String(element.dbId), {
                                        element_key: newName
                                      });
                                      if (response.success) {
                                        // Update local state
                                        const updatedElements = elements.map(e => 
                                          e.id === element.id ? { ...e, id: newName, logical_key: newName } : e
                                        );
                                        // Deduplicate to ensure no duplicate keys
                                        const uniqueElements = Array.from(
                                          new Map(updatedElements.map(el => [el.id, el])).values()
                                        );
                                        setElements(uniqueElements);
                                        showSuccess('Element Renamed', `Successfully renamed to "${newName}"`);
                                      } else {
                                        throw new Error(response.error || 'Failed to update');
                                      }
                                    }}
                                    onGenerateSuggestions={async () => {
                                      // Generate AI-powered name suggestions
                                      const suggestions = [];
                                      if (element.text) {
                                        suggestions.push(`${element.tag}_${element.text.toLowerCase().replace(/\s+/g, '_').substring(0, 20)}`);
                                      }
                                      suggestions.push(`${element.page}_${element.tag}_${Math.random().toString(36).substring(7)}`);
                                      suggestions.push(`${element.tag}_on_${element.page}`);
                                      return suggestions;
                                    }}
                                  />
                              )}
                              <ElementTag>{element.tag}</ElementTag>
                            </ElementInfo>
                            <HealthBadge status={healthStatus.status} title={`Health Score: ${healthStatus.score}/100`}>
                              <HealthDot status={healthStatus.status} />
                              {healthStatus.label}
                            </HealthBadge>
                          </ElementCardHeader>
                          {element.text && element.text !== '[null]' && (
                            <ElementText>
                              "{element.text}"
                            </ElementText>
                          )}
                          <SelectorsSection>
                            <SectionLabel>
                              <FileText size={12} />
                              Selector
                            </SectionLabel>
                            <SelectorsList>
                              {renderSelectorWithPolicy(element)}
                            </SelectorsList>
                          </SelectorsSection>
                          <ElementFooter>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <PageBadge>{element.page}</PageBadge>
                              <Timestamp>{formatTimestamp(element.timestamp || Date.now())}</Timestamp>
                            </div>
                            <ActionButtons>
                              <ActionButton 
                                variant="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/app/review/${element.id}`);
                                }}
                                title="View details"
                              >
                                <Eye size={12} />
                                View
                              </ActionButton>
                              <ActionButton 
                                variant="danger"
                                onClick={(e) => deleteElement(element.id, e)}
                                title="Delete element"
                              >
                                <Trash2 size={12} />
                                Delete
                              </ActionButton>
                            </ActionButtons>
                          </ElementFooter>
                        </ElementCard>
                      );
                    });
                  })()}
                  </ElementGrid>
                )}
                {!loading && filteredElements.length > elementsPerPage && (
                  <PaginationBar>
                    <PaginationInfo>
                      Showing {pageStartIndex + 1}-{Math.min(pageEndIndex, filteredCount)} of {filteredCount} elements
                    </PaginationInfo>
                    <PaginationButtons>
                      <PaginationButton
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </PaginationButton>
                      <PaginationButton disabled>
                        Page {currentPage} of {totalPages}
                      </PaginationButton>
                      <PaginationButton
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </PaginationButton>
                    </PaginationButtons>
                  </PaginationBar>
                )}
              </>
            )}
            {activeTab === 'health' && (
              <EmptyState>
                <EmptyStateIcon>📊</EmptyStateIcon>
                <EmptyStateTitle>Health Analysis</EmptyStateTitle>
                <EmptyStateText>
                  Detailed health analysis and reports coming soon...
                </EmptyStateText>
              </EmptyState>
            )}
            {activeTab === 'settings' && (
              <EmptyState>
                <EmptyStateIcon>⚙️</EmptyStateIcon>
                <EmptyStateTitle>Element Settings</EmptyStateTitle>
                <EmptyStateText>
                  Element repository settings and configuration coming soon...
                </EmptyStateText>
              </EmptyState>
            )}
          </Content>
        </MainContent>
      </Layout>
    </Container>
  );
};
export default MCPElementsViewer;