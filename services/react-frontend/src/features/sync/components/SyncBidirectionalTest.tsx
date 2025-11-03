/**
 * Bidirectional Synchronization Test Component
 * 
 * This component demonstrates and tests the bidirectional synchronization
 * between element selectors and prompt steps.
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { 
  useElementSelectorSync, 
  usePromptSelectorSync, 
  useSyncEventMonitor,
  useSyncServiceStatus
} from '../../../shared/hooks/useSyncHooks';
import { 
  SyncIndicator, 
  SyncNotification, 
  SyncStatusDisplay 
} from '../../../shared/components/SyncVisualIndicators';
import { RefreshCw, TestTube, CheckCircle, XCircle } from 'lucide-react';
const TestContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
`;
const TestSection = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
`;
const TestGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
`;
const TestInput = styled.input`
  width: 100%;
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-family: 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
  &.synced {
    border-color: #48bb78;
    background-color: #f0fff4;
  }
  &.syncing {
    border-color: #4299e1;
    background-color: #f0f9ff;
  }
`;
const TestButton = styled.button`
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;
const TestResult = styled.div<{ success?: boolean; error?: boolean }>`
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 12px;
  font-size: 14px;
  ${props => props.success && `
    background: #f0fdf4;
    border: 1px solid #16a34a;
    color: #166534;
  `}
  ${props => props.error && `
    background: #fef2f2;
    border: 1px solid #dc2626;
    color: #991b1b;
  `}
  ${props => !props.success && !props.error && `
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    color: #475569;
  `}
`;
const SyncBidirectionalTest: React.FC = () => {
  // Test data
  const [testElementId] = useState('test-element-123');
  const [testPromptId] = useState('test-prompt-456');
  const [testStepIndex] = useState(0);
  // Element sync test
  const {
    updateSelector: updateElementSelector,
    isUpdating: isElementUpdating,
    hasRelatedPrompts,
    relatedPromptsCount
  } = useElementSelectorSync(testElementId);
  // Prompt sync test
  const {
    updateStepSelector: updatePromptStepSelector,
    isUpdating: isPromptUpdating,
    hasRelatedElements,
    relatedElementsCount
  } = usePromptSelectorSync(testPromptId);
  // Event monitoring
  const {
    events,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearEvents,
    getRecentEvents
  } = useSyncEventMonitor();
  // Service status
  const {
    isInitialized,
    isRefreshing,
    relationshipCount,
    error: serviceError,
    refreshRelationships
  } = useSyncServiceStatus();
  // Test state
  const [elementSelector, setElementSelector] = useState('#test-element');
  const [promptSelector, setPromptSelector] = useState('#test-element');
  const [testResults, setTestResults] = useState<Array<{
    test: string;
    success: boolean;
    message: string;
    timestamp: Date;
  }>>([]);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, [startMonitoring, stopMonitoring]);
  const addTestResult = (test: string, success: boolean, message: string) => {
    setTestResults(prev => [
      { test, success, message, timestamp: new Date() },
      ...prev.slice(0, 9) // Keep last 10 results
    ]);
  };
  const testElementToPromptSync = async () => {
    try {
      const newSelector = `#element-${Date.now()}`;
      setElementSelector(newSelector);
      await updateElementSelector(newSelector, 'css');
      addTestResult(
        'Element → Prompt Sync',
        true,
        `Successfully updated element selector to "${newSelector}" and synced to ${relatedPromptsCount} prompts`
      );
      setNotification({
        type: 'success',
        message: `Element selector synced to ${relatedPromptsCount} prompts!`
      });
    } catch (error) {
      addTestResult(
        'Element → Prompt Sync',
        false,
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setNotification({
        type: 'error',
        message: 'Failed to sync element selector to prompts'
      });
    }
  };
  const testPromptToElementSync = async () => {
    try {
      const newSelector = `#prompt-${Date.now()}`;
      setPromptSelector(newSelector);
      await updatePromptStepSelector(testStepIndex, 'selector', newSelector);
      addTestResult(
        'Prompt → Element Sync',
        true,
        `Successfully updated prompt step selector to "${newSelector}" and synced to related elements`
      );
      setNotification({
        type: 'success',
        message: 'Prompt step selector synced to related elements!'
      });
    } catch (error) {
      addTestResult(
        'Prompt → Element Sync',
        false,
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setNotification({
        type: 'error',
        message: 'Failed to sync prompt step selector to elements'
      });
    }
  };
  const testBulkSync = async () => {
    try {
      const timestamp = Date.now();
      const promises = [
        updateElementSelector(`#bulk-element-${timestamp}`, 'css'),
        updatePromptStepSelector(testStepIndex, 'selector', `#bulk-prompt-${timestamp}`)
      ];
      await Promise.all(promises);
      addTestResult(
        'Bulk Sync Test',
        true,
        'Successfully performed bulk synchronization operations'
      );
      setNotification({
        type: 'success',
        message: 'Bulk synchronization completed successfully!'
      });
    } catch (error) {
      addTestResult(
        'Bulk Sync Test',
        false,
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setNotification({
        type: 'error',
        message: 'Bulk synchronization failed'
      });
    }
  };
  const clearTestResults = () => {
    setTestResults([]);
    clearEvents();
    setNotification(null);
  };
  return (
    <TestContainer>
      <h1 style={{ textAlign: 'center', marginBottom: '32px', color: '#1e293b' }}>
        🔄 Bidirectional Synchronization Test
      </h1>
      {/* Service Status */}
      <TestSection>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <TestTube size={20} />
          Service Status
        </h2>
        <SyncStatusDisplay
          elementCount={hasRelatedPrompts ? 1 : 0}
          promptCount={hasRelatedElements ? 1 : 0}
          isUpdating={isElementUpdating || isPromptUpdating || isRefreshing}
          lastSyncTime={events.length > 0 ? events[0].timestamp : undefined}
          recentActivity={events.slice(0, 5).map(event => ({
            type: event.type,
            message: `${event.type === 'element-updated' ? 'Element' : 'Prompt'} updated: ${event.newValue}`,
            timestamp: event.timestamp
          }))}
        />
        {serviceError && (
          <TestResult error>
            Service Error: {serviceError}
          </TestResult>
        )}
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
          <TestButton onClick={refreshRelationships} disabled={isRefreshing}>
            <RefreshCw size={16} style={{ marginRight: '8px' }} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Service'}
          </TestButton>
          <TestButton onClick={clearTestResults}>
            Clear Results
          </TestButton>
        </div>
      </TestSection>
      {/* Sync Tests */}
      <TestGrid>
        {/* Element to Prompt Sync */}
        <TestSection>
          <h3 style={{ marginBottom: '16px', color: '#059669' }}>
            🔧 Element → Prompt Sync
          </h3>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Element Selector:
            </label>
            <TestInput
              value={elementSelector}
              onChange={(e) => setElementSelector(e.target.value)}
              className={isElementUpdating ? 'syncing' : hasRelatedPrompts ? 'synced' : ''}
              placeholder="Enter CSS selector..."
            />
            <SyncIndicator 
              status={isElementUpdating ? 'syncing' : hasRelatedPrompts ? 'linked' : 'unlinked'}
              count={relatedPromptsCount}
              animated={isElementUpdating}
            />
          </div>
          <TestButton 
            onClick={testElementToPromptSync}
            disabled={isElementUpdating}
          >
            {isElementUpdating ? 'Syncing...' : 'Test Element → Prompt Sync'}
          </TestButton>
        </TestSection>
        {/* Prompt to Element Sync */}
        <TestSection>
          <h3 style={{ marginBottom: '16px', color: '#7c3aed' }}>
            📝 Prompt → Element Sync
          </h3>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
              Prompt Step Selector:
            </label>
            <TestInput
              value={promptSelector}
              onChange={(e) => setPromptSelector(e.target.value)}
              className={isPromptUpdating ? 'syncing' : hasRelatedElements ? 'synced' : ''}
              placeholder="Enter CSS selector..."
            />
            <SyncIndicator 
              status={isPromptUpdating ? 'syncing' : hasRelatedElements ? 'linked' : 'unlinked'}
              count={relatedElementsCount}
              animated={isPromptUpdating}
            />
          </div>
          <TestButton 
            onClick={testPromptToElementSync}
            disabled={isPromptUpdating}
          >
            {isPromptUpdating ? 'Syncing...' : 'Test Prompt → Element Sync'}
          </TestButton>
        </TestSection>
      </TestGrid>
      {/* Bulk Operations */}
      <TestSection>
        <h3 style={{ marginBottom: '16px', color: '#dc2626' }}>
          ⚡ Bulk Synchronization Test
        </h3>
        <p style={{ marginBottom: '16px', color: '#64748b' }}>
          Tests simultaneous synchronization operations to ensure the system handles concurrent updates properly.
        </p>
        <TestButton 
          onClick={testBulkSync}
          disabled={isElementUpdating || isPromptUpdating}
        >
          Run Bulk Sync Test
        </TestButton>
      </TestSection>
      {/* Test Results */}
      <TestSection>
        <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>
          📊 Test Results
        </h3>
        {testResults.length === 0 ? (
          <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>
            No test results yet. Run some tests above to see results here.
          </p>
        ) : (
          <div>
            {testResults.map((result, index) => (
              <TestResult key={index} success={result.success} error={!result.success}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {result.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                  <strong>{result.test}</strong>
                  <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.7 }}>
                    {result.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ marginTop: '4px', fontSize: '13px' }}>
                  {result.message}
                </div>
              </TestResult>
            ))}
          </div>
        )}
      </TestSection>
      {/* Event Monitor */}
      <TestSection>
        <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>
          📡 Sync Events Monitor
        </h3>
        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <SyncIndicator 
            status={isMonitoring ? 'linked' : 'unlinked'}
            size="small"
          />
          <span>
            {isMonitoring ? 'Monitoring active' : 'Monitoring inactive'} • 
            {events.length} events captured
          </span>
        </div>
        {events.length > 0 && (
          <div style={{ maxHeight: '200px', overflow: 'auto', background: '#f8fafc', borderRadius: '8px', padding: '12px' }}>
            {getRecentEvents(10).map((event, index) => (
              <div key={index} style={{ 
                padding: '8px 0', 
                borderBottom: index < events.length - 1 ? '1px solid #e2e8f0' : 'none',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>
                    {event.type === 'element-updated' ? '🔧' : '📝'}
                  </span>
                  <span>
                    {event.type === 'element-updated' ? 'Element' : 'Prompt'} updated
                  </span>
                  <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
                    {event.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ marginLeft: '24px', color: '#64748b' }}>
                  {event.oldValue} → {event.newValue}
                </div>
              </div>
            ))}
          </div>
        )}
      </TestSection>
      {/* Notification */}
      {notification && (
        <SyncNotification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </TestContainer>
  );
};
export default SyncBidirectionalTest;