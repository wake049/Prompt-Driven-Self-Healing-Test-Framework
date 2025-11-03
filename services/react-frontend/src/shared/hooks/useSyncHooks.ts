/**
 * React hooks for Element-Prompt Synchronization
 * 
 * These hooks provide easy-to-use interfaces for components to handle
 * bidirectional synchronization between elements and prompts.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import elementPromptSyncService, { 
  SyncEvent, 
  SyncRelationship, 
  ElementReference, 
  PromptStepReference 
} from '../services/elementPromptSyncService';
/**
 * Hook for handling element selector updates with automatic prompt synchronization
 */
export function useElementSelectorSync(elementId: string) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [relationships, setRelationships] = useState<SyncRelationship | null>(null);
  const [lastSyncEvent, setLastSyncEvent] = useState<SyncEvent | null>(null);
  // Load relationships on mount and when elementId changes
  useEffect(() => {
    const loadRelationships = async () => {
      try {
        const rel = await elementPromptSyncService.getElementRelationships(elementId);
        setRelationships(rel);
      } catch (error) {
        console.error($1);
      }
    };
    loadRelationships();
    // Subscribe to sync events for this element
    const unsubscribe = elementPromptSyncService.subscribe((event) => {
      if (event.type === 'element-updated' && 
          (event.source as ElementReference).elementId === elementId) {
        setLastSyncEvent(event);
        loadRelationships(); // Reload relationships after sync
      }
    });
    return unsubscribe;
  }, [elementId]);
  /**
   * Update element selector and sync to related prompts
   */
  const updateSelector = useCallback(async (
    newSelector: string, 
    selectorType: 'css' | 'xpath'
  ) => {
    if (!newSelector.trim()) {
      throw new Error('Selector cannot be empty');
    }
    setIsUpdating(true);
    try {
      await elementPromptSyncService.updateElementSelector(
        elementId, 
        newSelector, 
        selectorType
      );
      // Reload relationships to reflect changes
      const updatedRel = await elementPromptSyncService.getElementRelationships(elementId);
      setRelationships(updatedRel);
      return true;
    } catch (error) {
      console.error($1);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [elementId]);
  /**
   * Get count of related prompts
   */
  const relatedPromptsCount = relationships ? relationships.promptRefs.length : 0;
  /**
   * Check if element has related prompts
   */
  const hasRelatedPrompts = relatedPromptsCount > 0;
  /**
   * Get list of related prompt IDs
   */
  const relatedPromptIds = relationships 
    ? [...new Set(relationships.promptRefs.map(ref => ref.promptId))]
    : [];
  return {
    updateSelector,
    isUpdating,
    relationships,
    relatedPromptsCount,
    hasRelatedPrompts,
    relatedPromptIds,
    lastSyncEvent
  };
}
/**
 * Hook for handling prompt step selector updates with automatic element synchronization
 */
export function usePromptSelectorSync(promptId: string) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastSyncEvent, setLastSyncEvent] = useState<SyncEvent | null>(null);
  const [elementRelationships, setElementRelationships] = useState<Map<string, SyncRelationship>>(new Map());
  // Load all relationships on mount
  useEffect(() => {
    const loadRelationships = async () => {
      try {
        const allRels = await elementPromptSyncService.getRelationships();
        const filteredRels = new Map();
        for (const [elementId, relationship] of allRels) {
          const hasThisPrompt = relationship.promptRefs.some((ref: PromptStepReference) => ref.promptId === promptId);
          if (hasThisPrompt) {
            filteredRels.set(elementId, relationship);
          }
        }
        setElementRelationships(filteredRels);
      } catch (error) {
        console.error($1);
      }
    };
    loadRelationships();
    // Subscribe to sync events for this prompt
    const unsubscribe = elementPromptSyncService.subscribe((event) => {
      if (event.type === 'prompt-updated' && 
          (event.source as PromptStepReference).promptId === promptId) {
        setLastSyncEvent(event);
        loadRelationships(); // Reload relationships after sync
      }
    });
    return unsubscribe;
  }, [promptId]);
  /**
   * Update a prompt step selector and sync to related element
   */
  const updateStepSelector = useCallback(async (
    stepIndex: number,
    parameterKey: string,
    newSelector: string
  ) => {
    if (!newSelector.trim()) {
      throw new Error('Selector cannot be empty');
    }
    setIsUpdating(true);
    try {
      await elementPromptSyncService.updatePromptStepSelector(
        promptId,
        stepIndex,
        parameterKey,
        newSelector
      );
      // Reload relationships to reflect changes
      const allRels = await elementPromptSyncService.getRelationships();
      const filteredRels = new Map();
      for (const [elementId, relationship] of allRels) {
        const hasThisPrompt = relationship.promptRefs.some((ref: PromptStepReference) => ref.promptId === promptId);
        if (hasThisPrompt) {
          filteredRels.set(elementId, relationship);
        }
      }
      setElementRelationships(filteredRels);
      return true;
    } catch (error) {
      console.error($1);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [promptId]);
  /**
   * Get elements related to this prompt
   */
  const relatedElements = Array.from(elementRelationships.keys());
  /**
   * Get count of related elements
   */
  const relatedElementsCount = relatedElements.length;
  /**
   * Check if prompt has related elements
   */
  const hasRelatedElements = relatedElementsCount > 0;
  /**
   * Get relationship for a specific element
   */
  const getElementRelationship = useCallback((elementId: string) => {
    return elementRelationships.get(elementId) || null;
  }, [elementRelationships]);
  /**
   * Get all steps in this prompt that reference elements
   */
  const getStepsWithElements = useCallback(() => {
    const stepsWithElements: Array<{
      stepIndex: number;
      parameterKey: string;
      elementId: string;
      currentValue: string;
    }> = [];
    for (const [elementId, relationship] of elementRelationships) {
      const promptRefs = relationship.promptRefs.filter(ref => ref.promptId === promptId);
      for (const ref of promptRefs) {
        stepsWithElements.push({
          stepIndex: ref.stepIndex,
          parameterKey: ref.parameterKey,
          elementId,
          currentValue: ref.currentValue
        });
      }
    }
    return stepsWithElements.sort((a, b) => a.stepIndex - b.stepIndex);
  }, [elementRelationships, promptId]);
  return {
    updateStepSelector,
    isUpdating,
    elementRelationships,
    relatedElements,
    relatedElementsCount,
    hasRelatedElements,
    getElementRelationship,
    getStepsWithElements,
    lastSyncEvent
  };
}
/**
 * Hook for monitoring sync events globally
 */
export function useSyncEventMonitor() {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const maxEvents = useRef(50); // Keep last 50 events
  useEffect(() => {
    if (!isMonitoring) return;
    const unsubscribe = elementPromptSyncService.subscribe((event) => {
      setEvents(prev => {
        const newEvents = [event, ...prev];
        return newEvents.slice(0, maxEvents.current);
      });
    });
    return unsubscribe;
  }, [isMonitoring]);
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);
  const getEventsByType = useCallback((type: 'element-updated' | 'prompt-updated') => {
    return events.filter(event => event.type === type);
  }, [events]);
  const getRecentEvents = useCallback((minutes: number = 5) => {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return events.filter(event => event.timestamp >= cutoff);
  }, [events]);
  return {
    events,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearEvents,
    getEventsByType,
    getRecentEvents
  };
}
/**
 * Hook for managing sync service status
 */
export function useSyncServiceStatus() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [relationshipCount, setRelationshipCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Check if service is initialized
    const checkStatus = async () => {
      try {
        const relationships = await elementPromptSyncService.getRelationships();
        setRelationshipCount(relationships.size);
        setIsInitialized(true);
      } catch (error) {
        console.error($1);
        setError('Failed to check service status');
      }
    };
    // Initial check
    checkStatus();
    // Set up periodic status checks
    const interval = setInterval(checkStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);
  const refreshRelationships = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await elementPromptSyncService.refresh();
      const relationships = await elementPromptSyncService.getRelationships();
      setRelationshipCount(relationships.size);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      console.error($1);
    } finally {
      setIsRefreshing(false);
    }
  }, []);
  const reinitializeService = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await elementPromptSyncService.reinitialize();
      const relationships = await elementPromptSyncService.getRelationships();
      setRelationshipCount(relationships.size);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      console.error($1);
    } finally {
      setIsRefreshing(false);
    }
  }, []);
  return {
    isInitialized,
    isRefreshing,
    relationshipCount,
    error,
    refreshRelationships,
    reinitializeService
  };
}
/**
 * Hook for showing sync notifications
 */
export function useSyncNotifications() {
  const [notification, setNotification] = useState<{
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
    timestamp: Date;
  } | null>(null);
  useEffect(() => {
    const unsubscribe = elementPromptSyncService.subscribe((event) => {
      let message = '';
      if (event.type === 'element-updated') {
        const elementRef = event.source as ElementReference;
        message = `Element "${elementRef.elementId}" updated and synced to related prompts`;
      } else if (event.type === 'prompt-updated') {
        const promptRef = event.source as PromptStepReference;
        message = `Prompt step updated and synced to related elements`;
      }
      setNotification({
        id: `sync-${Date.now()}`,
        type: 'success',
        message,
        timestamp: event.timestamp
      });
      // Auto-clear notification after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    });
    return unsubscribe;
  }, []);
  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);
  return {
    notification,
    clearNotification
  };
}