import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { config } from '../app/config';

interface PolicyPermissions {
  canDelete: boolean;
  canEdit: boolean;
  canView: boolean;
  blockDestructiveActions: boolean;
  allowTestModeOverride: boolean;
  isLoading: boolean;
}

interface ExecutionSafetyPolicy {
  blockDestructiveActions: boolean;
  requireConfirmationKeywords: string[];
  allowTestModeOverride: boolean;
  active: boolean;
}

interface PolicyConfig {
  executionSafety: ExecutionSafetyPolicy;
}

/**
 * Hook to check user permissions based on:
 * 1. User role (admin, owner vs regular user)
 * 2. Policy Engine execution safety settings
 * 3. Test mode override flag
 */
export const usePolicyPermissions = (testMode: boolean = false): PolicyPermissions => {
  const { user } = useAuth();
  const [policyConfig, setPolicyConfig] = useState<PolicyConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPolicyConfig = async () => {
      try {
        const response = await fetch(
          `${config.apiBaseUrl}/api/v1/policy/dashboard/config`
        );
        
        if (response.ok) {
          const data = await response.json();
          setPolicyConfig(data.data || data);
        }
      } catch (error) {
        console.error('Failed to load policy configuration:', error);
        // Default to safe settings if policy fetch fails
        setPolicyConfig({
          executionSafety: {
            blockDestructiveActions: true,
            requireConfirmationKeywords: [],
            allowTestModeOverride: false,
            active: true
          }
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicyConfig();
  }, []);

  // Determine if user is admin/owner
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  
  // Get execution safety settings
  const executionSafety = policyConfig?.executionSafety;
  const blockDestructive = executionSafety?.blockDestructiveActions ?? true;
  const allowTestOverride = executionSafety?.allowTestModeOverride ?? false;

  // Permission logic:
  // - Admins/owners always have full permissions
  // - If blockDestructiveActions is OFF, everyone can delete
  // - If blockDestructiveActions is ON, only admins can delete
  // - Test mode can bypass restrictions if allowTestModeOverride is ON
  const canDelete = 
    isAdmin || 
    !blockDestructive || 
    (testMode && allowTestOverride);

  return {
    canDelete,
    canEdit: true, // Everyone can edit
    canView: true, // Everyone can view
    blockDestructiveActions: blockDestructive,
    allowTestModeOverride: allowTestOverride,
    isLoading
  };
};

/**
 * Hook specifically for checking if delete actions are allowed
 */
export const useCanDelete = (testMode: boolean = false): boolean => {
  const { canDelete } = usePolicyPermissions(testMode);
  return canDelete;
};

/**
 * Hook to get user role information
 */
export const useUserRole = () => {
  const { user } = useAuth();
  return {
    isAdmin: user?.role === 'admin' || user?.role === 'owner',
    isOwner: user?.role === 'owner',
    isMember: user?.role === 'member',
    isViewer: user?.role === 'viewer',
    role: user?.role
  };
};
