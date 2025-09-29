# Operations Runbook

## Queue Management & Monitoring

### Job Queue Architecture
```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Plan Queue    │    │  Exec Queue  │    │ Locator Queue   │
│   Priority: 1-5 │    │  Priority: 1-5│    │ Priority: 1-3   │
│   SLA: 12s max  │    │  SLA: varies  │    │ SLA: 4s batch   │
└─────────────────┘    └──────────────┘    └─────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Plan Workers   │    │ Exec Workers │    │ Locator Workers │
│  Pool: 2-10     │    │ Pool: 5-20   │    │ Pool: 1-5       │
│  Scale: CPU     │    │ Scale: Mixed │    │ Scale: Memory   │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

### Queue Health Monitoring Commands
```bash
# Check queue depths and worker status
kubectl exec -n platform deploy/queue-monitor -- redis-cli INFO keyspace
kubectl get pods -l component=worker -o wide

# Monitor queue processing rates
kubectl logs -f -l component=metrics-collector | grep "queue_processing_rate"

# Check for stuck jobs (older than SLA threshold)  
kubectl exec -n platform deploy/queue-monitor -- python /scripts/check_stuck_jobs.py

# Force queue drain for maintenance
kubectl scale deployment plan-workers --replicas=0
kubectl wait --for=condition=unavailable deployment/plan-workers --timeout=300s
```

## Worker Pool Management

### Auto-Scaling Policies
```yaml
# Plan Workers - CPU-based scaling
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: plan-workers-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: plan-workers
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: queue_depth
      target:
        type: AverageValue
        averageValue: "5"
```

### Worker Health Checks
```python
# Worker health check script (/scripts/worker_health.py)
def check_worker_health():
    checks = {
        "memory_usage": check_memory_under_threshold(0.85),
        "queue_connectivity": check_redis_connection(),  
        "mcp_server_connectivity": check_mcp_health(),
        "database_connectivity": check_db_pool_health(),
        "execution_success_rate": check_recent_success_rate(0.90)
    }
    
    if all(checks.values()):
        return {"status": "healthy", "checks": checks}
    else:
        return {"status": "unhealthy", "checks": checks}
```

### Worker Replacement Procedures
```bash
# Graceful worker replacement
kubectl annotate pod worker-abc123 platform.io/drain="true"
kubectl wait --for=condition=ContainersReady pod/worker-abc123-replacement
kubectl delete pod worker-abc123

# Emergency worker restart (for hung processes)
kubectl delete pod worker-abc123 --grace-period=0 --force

# Scale worker pool for load
kubectl scale deployment exec-workers --replicas=15
kubectl rollout status deployment/exec-workers --timeout=300s
```

## Idempotency & Retry Logic

### Job Idempotency Implementation
```python
def execute_job_idempotent(job_id: str, job_data: dict):
    """
    Ensure job execution is idempotent using Redis-based locking
    """
    lock_key = f"job_lock:{job_id}"
    result_key = f"job_result:{job_id}"
    
    # Check if job already completed
    cached_result = redis.get(result_key)
    if cached_result:
        return json.loads(cached_result)
    
    # Acquire distributed lock
    with redis.lock(lock_key, timeout=300, blocking_timeout=10):
        # Double-check result after acquiring lock
        cached_result = redis.get(result_key)
        if cached_result:
            return json.loads(cached_result)
            
        # Execute job and cache result
        result = execute_job_logic(job_data)
        redis.setex(result_key, ttl=3600, value=json.dumps(result))
        return result
```

### Retry Strategies by Job Type
```yaml
job_retry_policies:
  plan_generation:
    max_retries: 3
    backoff_strategy: "exponential"  
    base_delay_ms: 1000
    max_delay_ms: 10000
    retry_on_errors: ["timeout", "rate_limit", "temporary_failure"]
    
  test_execution:
    max_retries: 2
    backoff_strategy: "linear"
    base_delay_ms: 5000
    retry_on_errors: ["browser_crash", "network_timeout"]
    no_retry_errors: ["element_not_found", "assertion_failure"]
    
  element_healing:
    max_retries: 1  
    backoff_strategy: "immediate"
    retry_on_errors: ["dom_analysis_timeout"]
    escalate_on_failure: "manual_review_queue"
```

## Backpressure & Load Shedding

### Circuit Breaker Implementation
```python
class ComponentCircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout  
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        
    def call(self, func, *args, **kwargs):
        if self.state == "OPEN":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "HALF_OPEN"
            else:
                raise CircuitBreakerOpenError()
                
        try:
            result = func(*args, **kwargs)
            if self.state == "HALF_OPEN":
                self.reset()
            return result
        except Exception as e:
            self.record_failure()
            raise
            
    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
```

### Load Shedding Rules
```python
def should_shed_load(current_metrics: dict) -> bool:
    """
    Determine if new requests should be rejected to protect system stability
    """
    shedding_rules = [
        current_metrics["cpu_usage"] > 0.95,
        current_metrics["memory_usage"] > 0.90, 
        current_metrics["queue_depth"] > 1000,
        current_metrics["error_rate_5m"] > 0.20,
        current_metrics["response_time_p95"] > 30000  # 30s
    ]
    
    return any(shedding_rules)

def get_shed_priority() -> str:
    """Return which request types to shed first"""
    return ["batch_locator_generation", "analytics_queries", "report_generation"]
```

## Metrics & Observability

### Key Performance Metrics
```prometheus
# Queue processing rates
queue_processing_rate{queue="plan",worker_pool="plan-workers"} 
queue_depth{queue="exec",priority="high"}
worker_utilization{worker_type="execution",instance="exec-worker-3"}

# Business metrics  
test_execution_success_rate{environment="production"}
element_healing_success_rate{strategy="semantic_match"}
user_satisfaction_score{feature="plan_generation"}

# Infrastructure metrics
mcp_tool_call_duration_seconds{tool="run_action",outcome="success"}
element_repository_hit_rate{cache_level="l1"}
policy_evaluation_duration_ms{policy="seating_selection"}
```

### Performance Dashboards
```yaml
# Grafana dashboard configuration
dashboard_panels:
  - title: "Queue Health"
    metrics: ["queue_depth", "processing_rate", "wait_time_p95"]
    alerts: ["queue_depth > 500", "wait_time_p95 > 60s"]
    
  - title: "Worker Pool Utilization"  
    metrics: ["cpu_usage", "memory_usage", "active_jobs"]
    alerts: ["cpu_usage > 80%", "memory_usage > 85%"]
    
  - title: "Healing Effectiveness"
    metrics: ["heal_success_rate", "heal_confidence", "manual_review_rate"] 
    alerts: ["heal_success_rate < 85%", "manual_review_rate > 20%"]
```

## Failure Playbooks

### Scenario 1: High Queue Depth (>500 jobs)
**Detection:** `queue_depth{queue="exec"} > 500`
**Impact:** Increased test execution latency, potential SLA violations

**Response Steps:**
1. **Immediate:** Scale up worker pools
   ```bash
   kubectl scale deployment exec-workers --replicas=20
   ```
2. **Investigate:** Check for stuck jobs or worker failures
   ```bash
   kubectl logs -l component=exec-worker --since=10m | grep ERROR
   ```  
3. **Mitigate:** Enable load shedding for non-critical requests
4. **Resolve:** Address root cause (failed workers, infrastructure issues)
5. **Follow-up:** Review auto-scaling policies and queue capacity

### Scenario 2: Element Repository High Miss Rate (>30%)
**Detection:** `element_repository_hit_rate < 0.70`  
**Impact:** Increased healing events, slower test execution

**Response Steps:**
1. **Investigate:** Check for element repository connectivity issues
2. **Cache Warming:** Trigger cache refresh for frequently accessed elements
   ```bash
   kubectl exec deploy/element-service -- python /scripts/warm_cache.py --priority=high
   ```
3. **Review:** Analyze recent element changes and approval patterns
4. **Optimize:** Update cache TTL and eviction policies if needed

### Scenario 3: MCP Server Unresponsive
**Detection:** `mcp_server_health_check == 0`
**Impact:** Complete platform unavailability

**Response Steps:**
1. **Immediate:** Restart MCP server pods
   ```bash  
   kubectl rollout restart deployment/mcp-server
   kubectl rollout status deployment/mcp-server --timeout=300s
   ```
2. **Verify:** Check server logs for startup errors
3. **Escalate:** If restart fails, engage platform engineering team
4. **Communicate:** Update status page and notify users of incident

### Scenario 4: Healing Success Rate Below 85%
**Detection:** `healing_success_rate_24h < 0.85`
**Impact:** Increased manual intervention, reduced automation effectiveness  

**Response Steps:**
1. **Analysis:** Review healing failure patterns by strategy and element type
2. **Model Refresh:** Trigger ML model retraining with recent feedback data
3. **Threshold Tuning:** Temporarily lower auto-healing confidence threshold
4. **Expert Review:** Flag complex healing cases for domain expert analysis
5. **Improvement:** Update healing algorithms based on failure analysis

## Incident Management Integration

### Alerting Escalation Matrix
```yaml
alert_routing:
  critical_alerts:
    - condition: "platform_down OR data_corruption"
    - notify: ["oncall_engineer", "platform_lead"]  
    - escalation_time: "5m"
    - escalation_notify: ["engineering_director", "product_owner"]
    
  warning_alerts:
    - condition: "sla_violation OR high_error_rate"
    - notify: ["platform_team_slack"]
    - escalation_time: "30m"
    - escalation_notify: ["oncall_engineer"]
```

### Runbook Automation
```bash
#!/bin/bash
# /scripts/auto_remediation.sh

case "$ALERT_NAME" in
  "HighQueueDepth")
    kubectl scale deployment exec-workers --replicas=$(($(kubectl get deployment exec-workers -o jsonpath='{.spec.replicas}') + 5))
    ;;
  "WorkerUnhealthy")  
    kubectl delete pod -l component=worker,status=unhealthy
    ;;
  "DatabaseConnectionExhausted")
    kubectl rollout restart deployment/database-proxy
    ;;
esac
```

### Post-Incident Review Process
1. **Incident Timeline:** Document detection, response, and resolution times
2. **Root Cause Analysis:** Identify contributing factors and systemic issues  
3. **Action Items:** Define specific improvements to prevent recurrence
4. **Runbook Updates:** Enhance automation and response procedures
5. **Metrics Review:** Adjust alerting thresholds based on incident learnings