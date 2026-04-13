"""
Enhanced Policy Engine Service - Database-Backed Implementation
Connects to the policy schema tables for real policy enforcement
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from uuid import UUID
import logging
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class PolicyEngine:
    """
    Database-backed policy engine for governance and decision making.
    Uses the policy schema tables: policy_packs, policy_groups, policy_rules, pack_assignments
    """
    
    def __init__(self, db_session: AsyncSession, project_id: UUID, environment_id: UUID):
        """
        Initialize policy engine for a specific project and environment.
        
        Args:
            db_session: Database session for queries
            project_id: UUID of the project
            environment_id: UUID of the environment
        """
        self.db = db_session
        self.project_id = project_id
        self.environment_id = environment_id
        self.active_pack = None
        self.rules_cache = {}
        self.initialized = False
    
    async def initialize(self):
        """Load the active policy pack for this environment"""
        try:
            self.active_pack = await self._load_active_pack()
            if self.active_pack:
                await self._load_active_rules()
            self.initialized = True
            logger.info(f"Policy engine initialized for environment {self.environment_id}")
        except Exception as e:
            logger.error(f"Failed to initialize policy engine: {e}")
            raise
    
    async def _load_active_pack(self) -> Optional[Dict[str, Any]]:
        """Load the active policy pack for this environment"""
        query = """
            SELECT 
                pp.id, pp.name, pp.description, pp.project_id, 
                pp.is_system, pp.is_active, pp.version,
                pa.assigned_at, pa.assigned_by
            FROM policy.policy_packs pp
            JOIN policy.pack_assignments pa ON pp.id = pa.pack_id
            WHERE pa.environment_id = :env_id 
            AND pa.is_active = true
            AND pp.is_active = true
            ORDER BY pa.assigned_at DESC
            LIMIT 1
        """
        
        result = await self.db.execute(query, {"env_id": str(self.environment_id)})
        row = result.first()
        
        if row:
            return {
                "id": row.id,
                "name": row.name,
                "description": row.description,
                "project_id": row.project_id,
                "is_system": row.is_system,
                "is_active": row.is_active,
                "version": row.version,
                "assigned_at": row.assigned_at,
                "assigned_by": row.assigned_by
            }
        return None
    
    async def _load_active_rules(self):
        """Load all active rules from the policy pack using the v_active_pack_rules view"""
        if not self.active_pack:
            return
        
        query = """
            SELECT 
                rule_id, rule_name, rule_key, rule_type, 
                rule_value, is_enabled, priority_order,
                group_id, group_name, group_key
            FROM policy.v_active_pack_rules
            WHERE environment_id = :env_id
            ORDER BY priority_order
        """
        
        result = await self.db.execute(query, {"env_id": str(self.environment_id)})
        
        self.rules_cache = {}
        for row in result:
            self.rules_cache[row.rule_key] = {
                "id": row.rule_id,
                "name": row.rule_name,
                "key": row.rule_key,
                "type": row.rule_type,
                "value": row.rule_value,
                "is_enabled": row.is_enabled,
                "priority_order": row.priority_order,
                "group": {
                    "id": row.group_id,
                    "name": row.group_name,
                    "key": row.group_key
                }
            }
        
        logger.info(f"Loaded {len(self.rules_cache)} policy rules for environment {self.environment_id}")
    
    def get_rule_value(self, rule_key: str, default: Any = None) -> Any:
        """
        Get the value of a policy rule by key.
        
        Args:
            rule_key: Dot-notation key like 'healing.confidence_threshold'
            default: Default value if rule not found
            
        Returns:
            Rule value or default
        """
        rule = self.rules_cache.get(rule_key)
        if rule and rule.get("is_enabled"):
            return rule.get("value", default)
        return default
    
    def can_auto_heal(self, confidence: int) -> bool:
        """
        Check if a healing suggestion can be auto-applied based on confidence threshold.
        
        Args:
            confidence: Confidence score (0-100)
            
        Returns:
            True if confidence meets or exceeds threshold
        """
        threshold = self.get_rule_value("healing.confidence_threshold", default=85)
        return confidence >= threshold
    
    def requires_review(self, element_confidence: int) -> bool:
        """
        Check if an element detection requires human review.
        
        Args:
            element_confidence: Element detection confidence (0-100)
            
        Returns:
            True if confidence is below review threshold
        """
        threshold = self.get_rule_value("healing.review_threshold", default=75)
        return element_confidence < threshold
    
    def is_action_blocked(self, action_type: str, step_text: str = "", is_test_mode: bool = False) -> tuple[bool, str]:
        """
        Check if a specific action type is blocked by safety policies.
        
        Args:
            action_type: Type of action (e.g., 'click', 'fill', 'navigate')
            step_text: The full step text/description to check for destructive keywords
            is_test_mode: Whether test mode is enabled
            
        Returns:
            Tuple of (is_blocked, reason)
        """
        # Get safety settings from policy
        block_destructive = self.get_rule_value("safety.block_destructive_actions", default=True)
        allow_test_override = self.get_rule_value("safety.allow_test_mode_override", default=True)
        destructive_keywords = self.get_rule_value("safety.destructive_keywords", 
                                                   default=["delete", "remove", "submit payment", "purge", "clear", "reset"])
        
        if not block_destructive:
            return (False, "")
        
        # Check if test mode override is allowed and enabled
        if is_test_mode and allow_test_override:
            return (False, "")
        
        # Check action type
        if action_type.lower() in ['delete', 'remove', 'clear', 'reset']:
            return (True, f"Destructive action '{action_type}' blocked by safety policy")
        
        # Check step text for destructive keywords
        step_lower = step_text.lower()
        for keyword in destructive_keywords:
            if keyword.lower() in step_lower:
                return (True, f"Step contains destructive keyword '{keyword}' blocked by safety policy")
        
        return (False, "")
    
    def get_execution_safety_config(self) -> Dict[str, Any]:
        """
        Get execution safety configuration.
        
        Returns:
            Dict with blockDestructiveActions, allowTestModeOverride, destructiveKeywords
        """
        return {
            "blockDestructiveActions": self.get_rule_value("safety.block_destructive_actions", default=True),
            "allowTestModeOverride": self.get_rule_value("safety.allow_test_mode_override", default=True),
            "destructiveKeywords": self.get_rule_value("safety.destructive_keywords", 
                                                       default=["delete", "remove", "submit payment"])
        }
    
    def get_retry_config(self) -> Dict[str, Any]:
        """
        Get retry policy configuration.
        
        Returns:
            Dict with max_retries, delay_ms, exponential_backoff
        """
        return {
            "max_retries": self.get_rule_value("execution.max_retries", default=3),
            "delay_ms": self.get_rule_value("execution.retry_delay_ms", default=1000),
            "exponential_backoff": self.get_rule_value("execution.exponential_backoff", default=True)
        }
    
    def get_timeout_config(self) -> Dict[str, Any]:
        """
        Get timeout configuration.
        
        Returns:
            Dict with action_timeout_ms, page_load_timeout_ms, element_wait_timeout_ms
        """
        return {
            "action_timeout_ms": self.get_rule_value("execution.action_timeout_ms", default=30000),
            "page_load_timeout_ms": self.get_rule_value("execution.page_load_timeout_ms", default=60000),
            "element_wait_timeout_ms": self.get_rule_value("execution.element_wait_timeout_ms", default=10000)
        }
    
    def should_capture_screenshot(self, on_event: str) -> bool:
        """
        Check if screenshots should be captured for a specific event.
        
        Args:
            on_event: Event type ('error', 'success', 'always', 'never')
            
        Returns:
            True if screenshots should be captured
        """
        screenshot_policy = self.get_rule_value("execution.screenshot_on", default="error")
        
        if screenshot_policy == "always":
            return True
        elif screenshot_policy == "never":
            return False
        elif screenshot_policy == "error":
            return on_event == "error"
        elif screenshot_policy == "success":
            return on_event in ["error", "success"]
        
        return False
    
    def get_ai_provider_config(self) -> Dict[str, Any]:
        """
        Get AI provider configuration from policy rules.
        
        Returns:
            Dict with provider, model, temperature, max_tokens
        """
        return {
            "provider": self.get_rule_value("ai.default_provider", default="openai"),
            "model": self.get_rule_value("ai.default_model", default="gpt-4"),
            "temperature": self.get_rule_value("ai.temperature", default=0.7),
            "max_tokens": self.get_rule_value("ai.max_tokens", default=2000)
        }
    
    async def log_decision(self, decision_type: str, context: Dict[str, Any], 
                          outcome: str = "success", metadata: Dict[str, Any] = None):
        """
        Log a policy decision for audit trail.
        
        Args:
            decision_type: Type of decision (e.g., 'auto_heal', 'review_required', 'blocked')
            context: Context information about the decision
            outcome: Outcome of the decision
            metadata: Additional metadata
        """
        if not self.active_pack:
            return
        
        try:
            query = """
                INSERT INTO policy.policy_decisions (
                    pack_id, project_id, environment_id, decision, context, confidence
                ) VALUES (
                    :pack_id, :project_id, :env_id, :decision, :context, :confidence
                )
            """
            
            await self.db.execute(query, {
                "pack_id": str(self.active_pack["id"]),
                "project_id": str(self.project_id),
                "env_id": str(self.environment_id),
                "decision": decision_type,
                "context": context,
                "confidence": metadata.get("confidence", 1.0) if metadata else 1.0
            })
            await self.db.commit()
            
        except Exception as e:
            logger.error(f"Failed to log policy decision: {e}")
            await self.db.rollback()
    
    async def evaluate_test_plan(self, test_plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate a test plan against active policies.
        
        Args:
            test_plan: Test plan to evaluate with steps
            
        Returns:
            Evaluation result with blocked/flagged steps
        """
        if not self.initialized:
            await self.initialize()
        
        blocked_steps = []
        flagged_steps = []
        
        for step in test_plan.get("steps", []):
            action_type = step.get("action")
            
            # Check if action is blocked
            if self.is_action_blocked(action_type):
                blocked_steps.append({
                    "step_index": step.get("step_index"),
                    "action": action_type,
                    "reason": "Action blocked by safety policy"
                })
                await self.log_decision("blocked", {
                    "step": step,
                    "reason": "safety_policy"
                })
                continue
            
            # Check if element needs review
            element = step.get("element", {})
            element_confidence = element.get("confidence", 100)
            
            if self.requires_review(element_confidence):
                flagged_steps.append({
                    "step_index": step.get("step_index"),
                    "action": action_type,
                    "confidence": element_confidence,
                    "reason": "Low confidence element detection"
                })
                await self.log_decision("review_required", {
                    "step": step,
                    "confidence": element_confidence,
                    "threshold": self.get_rule_value("healing.review_threshold", 75)
                })
        
        return {
            "approved": len(blocked_steps) == 0,
            "blocked_steps": blocked_steps,
            "flagged_steps": flagged_steps,
            "policy_pack": self.active_pack.get("name") if self.active_pack else None,
            "total_steps": len(test_plan.get("steps", [])),
            "evaluated_at": datetime.utcnow().isoformat()
        }
    
    async def get_policy_stats(self) -> Dict[str, Any]:
        """Get policy engine statistics"""
        query = """
            SELECT 
                COUNT(DISTINCT pd.id) as total_decisions,
                COUNT(DISTINCT CASE WHEN pd.decided_at >= NOW() - INTERVAL '24 hours' 
                    THEN pd.id END) as decisions_24h,
                COUNT(DISTINCT CASE WHEN pd.outcome = 'success' 
                    THEN pd.id END) as successful_decisions,
                COUNT(DISTINCT pr.id) as total_rules,
                COUNT(DISTINCT CASE WHEN pr.is_enabled = true 
                    THEN pr.id END) as active_rules
            FROM policy.policy_decisions pd
            CROSS JOIN policy.policy_rules pr
            WHERE pd.environment_id = :env_id
        """
        
        result = await self.db.execute(query, {"env_id": str(self.environment_id)})
        row = result.first()
        
        if row:
            return {
                "total_decisions": row.total_decisions,
                "decisions_24h": row.decisions_24h,
                "success_rate": (row.successful_decisions / max(row.total_decisions, 1)) * 100,
                "total_rules": row.total_rules,
                "active_rules": row.active_rules,
                "active_pack": self.active_pack.get("name") if self.active_pack else None,
                "initialized": self.initialized
            }
        
        return {
            "total_decisions": 0,
            "decisions_24h": 0,
            "success_rate": 0,
            "total_rules": len(self.rules_cache),
            "active_rules": len([r for r in self.rules_cache.values() if r.get("is_enabled")]),
            "active_pack": self.active_pack.get("name") if self.active_pack else None,
            "initialized": self.initialized
        }


# Factory function to create policy engine instances
async def create_policy_engine(
    db_session: AsyncSession, 
    project_id: UUID, 
    environment_id: UUID
) -> PolicyEngine:
    """
    Create and initialize a policy engine instance.
    
    Args:
        db_session: Database session
        project_id: Project UUID
        environment_id: Environment UUID
        
    Returns:
        Initialized PolicyEngine instance
    """
    engine = PolicyEngine(db_session, project_id, environment_id)
    await engine.initialize()
    return engine
