"""
Safety Policy Service
Implements security policies that block destructive actions for non-admin users.
This policy is independent of AI services and applies to all delete/remove operations.
"""

from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from models.auth_models import CurrentUser

class SafetyPolicyService:
    """
    Service that enforces safety policies for destructive operations.
    
    Policy: Block delete, remove, and other destructive commands unless user is admin.
    """
    
    def __init__(self):
        # Define destructive actions that require admin privileges
        self.destructive_actions = {
            'delete', 'remove', 'drop', 'truncate', 'destroy', 
            'purge', 'clean', 'wipe', 'clear', 'reset', 'cleanup'
        }
        
        # Define destructive HTTP methods
        self.destructive_methods = {'DELETE'}
        
        # Define destructive URL patterns
        self.destructive_url_patterns = [
            '/delete', '/remove', '/cleanup', '/purge', '/reset', '/clear'
        ]
    
    async def check_user_admin_status(self, current_user: CurrentUser) -> bool:
        """
        Check if user has admin privileges based on their roles.
        Returns True if user is admin, False otherwise.
        """
        try:
            from core.database import get_database_manager
            db = await get_database_manager()
            
            # Check if user has admin role in any tenant
            admin_check = await db.execute_one(
                """
                SELECT COUNT(*) as admin_count
                FROM core.user_tenant_roles utr
                JOIN core.roles r ON utr.role_id = r.id
                WHERE utr.user_id = $1 
                AND r.name = 'Admin'
                """,
                str(current_user.user.id)
            )
            
            is_admin = admin_check and admin_check.get('admin_count', 0) > 0
            return is_admin
            
        except Exception as e:# Fail closed - if we can't verify admin status, deny access
            return False
    
    async def validate_destructive_action(
        self, 
        current_user: CurrentUser, 
        action_type: str, 
        context: Optional[str] = None
    ) -> None:
        """
        Validate that user can perform destructive actions.
        Raises HTTPException if user is not authorized.
        
        Args:
            current_user: The authenticated user
            action_type: Type of action being performed (e.g., 'delete', 'remove')
            context: Additional context about the action
        """
        action_lower = action_type.lower()
        
        # Check if this is a destructive action
        if action_lower in self.destructive_actions:
            is_admin = await self.check_user_admin_status(current_user)
            
            if not is_admin:raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Admin privileges required for {action_type} operations. "
                           f"Contact your administrator for access."
                )
    async def validate_http_request(
        self, 
        current_user: CurrentUser, 
        method: str, 
        url_path: str
    ) -> None:
        """
        Validate HTTP request for destructive operations.
        
        Args:
            current_user: The authenticated user
            method: HTTP method (GET, POST, DELETE, etc.)
            url_path: The URL path being accessed
        """
        # Check destructive HTTP methods
        if method.upper() in self.destructive_methods:
            await self.validate_destructive_action(
                current_user, 
                method.lower(), 
                f"HTTP {method} to {url_path}"
            )
        
        # Check destructive URL patterns
        url_lower = url_path.lower()
        for pattern in self.destructive_url_patterns:
            if pattern in url_lower:
                await self.validate_destructive_action(
                    current_user, 
                    f"url_access", 
                    f"Access to {url_path}"
                )
                break
    
    async def validate_step_action(
        self, 
        current_user: CurrentUser, 
        step_action: str, 
        step_args: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Validate test step actions for destructive operations.
        
        Args:
            current_user: The authenticated user
            step_action: The test step action (click, type, delete, etc.)
            step_args: Arguments for the step
        """
        await self.validate_destructive_action(
            current_user, 
            step_action, 
            f"Test step with args: {step_args}"
        )
    
    async def validate_prompt_content(
        self, 
        current_user: CurrentUser, 
        prompt_text: str
    ) -> None:
        """
        Validate prompt content for destructive operations.
        
        Args:
            current_user: The authenticated user
            prompt_text: The prompt text to validate
        """
        prompt_lower = prompt_text.lower()
        
        # Check for destructive keywords in prompt
        found_destructive = []
        for action in self.destructive_actions:
            if action in prompt_lower:
                found_destructive.append(action)
        
        if found_destructive:
            await self.validate_destructive_action(
                current_user, 
                f"prompt_with_{', '.join(found_destructive)}", 
                f"Prompt containing: {', '.join(found_destructive)}"
            )
    
    def get_policy_summary(self) -> Dict[str, Any]:
        """Get a summary of the current safety policy configuration"""
        return {
            "policy_name": "Execution Safety & Validation",
            "description": "Block destructive actions unless explicitly allowed",
            "destructive_actions": sorted(list(self.destructive_actions)),
            "destructive_methods": sorted(list(self.destructive_methods)),
            "destructive_url_patterns": self.destructive_url_patterns,
            "admin_required": True,
            "enforcement": "Active"
        }

# Global safety policy service instance
safety_policy = SafetyPolicyService()

# FastAPI Dependencies
async def validate_destructive_operation(
    current_user: CurrentUser,
    action_type: str = "generic_destructive",
    context: Optional[str] = None
):
    """FastAPI dependency for validating destructive operations"""
    await safety_policy.validate_destructive_action(current_user, action_type, context)

async def validate_http_safety(
    current_user: CurrentUser,
    method: str,
    url_path: str
):
    """FastAPI dependency for HTTP request validation"""
    await safety_policy.validate_http_request(current_user, method, url_path)