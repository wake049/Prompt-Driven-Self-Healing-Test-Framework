# Sequence Diagrams

## A) "Run AI" Locator Generation

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant MCP as MCP Server  
    participant LW as Locator Worker
    participant ER as Element Repository
    participant RQ as Review Queue
    
    U->>FE: Upload element names list
    FE->>MCP: bulk_generate_locators(names, page_context)
    MCP->>LW: Queue locator generation job
    
    loop For each element name
        LW->>LW: Analyze page context & name
        LW->>LW: Generate selector candidates
        LW->>LW: Score confidence & priority
    end
    
    LW->>ER: Save proposals as pending
    
    alt High confidence batch (>0.9)
        LW->>ER: Auto-approve low-risk proposals  
        LW->>MCP: Return approved locators
    else Requires review
        LW->>RQ: Create review items
        LW->>MCP: Return pending status
        MCP->>FE: Show review required
        
        U->>RQ: Review proposals
        U->>RQ: Approve/Reject/Modify
        RQ->>ER: Save approved elements
        RQ->>FE: Notify completion
    end
    
    MCP->>FE: Return generation results
    FE->>U: Display approved elements
```

## B) Prompt → Plan → Execute

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant MCP as MCP Server
    participant LP as LLM Planner
    participant PW as Plan Worker
    participant EW as Exec Worker
    participant ES as Execution Service
    participant ER as Element Repository
    participant PE as Policy Engine
    
    U->>FE: Enter test prompt
    FE->>MCP: generate_test_plan(prompt)
    MCP->>LP: Parse natural language
    
    LP->>LP: Extract actions & parameters
    LP->>ER: Validate element references
    LP->>PE: Check policy constraints
    LP->>MCP: Return test plan structure
    
    MCP->>PW: Queue plan optimization
    PW->>PW: Optimize step dependencies
    PW->>ER: Pre-fetch element locators  
    PW->>MCP: Return optimized plan
    
    U->>FE: Confirm & execute plan
    FE->>MCP: execute_test_plan(plan_id)
    MCP->>EW: Queue execution job
    
    loop For each test step
        EW->>ER: get_element(element_name)
        EW->>PE: evaluate_branch_conditions()
        
        alt Branch condition met
            EW->>EW: Follow branch path
        else Continue main flow
            EW->>ES: run_action(action_details)
            ES->>ES: Execute Selenium action
            
            alt Action succeeds
                ES->>EW: Return success result
            else Action fails
                ES->>EW: Return failure + healing trigger
                Note over EW: Trigger healing workflow (see diagram C)
            end
        end
    end
    
    EW->>MCP: Return execution results
    MCP->>FE: Display test run summary
```

## C) Self-Healing on Failure

```mermaid
sequenceDiagram
    participant ES as Execution Service
    participant HW as Heal Worker
    participant ER as Element Repository
    participant MCP as MCP Server
    participant RQ as Review Queue
    participant U as User
    
    ES->>ES: Action fails (element not found)
    ES->>HW: Trigger healing (element_name, context)
    
    HW->>ER: get_element_history(element_name)
    HW->>HW: Analyze page DOM changes
    HW->>HW: Generate healing candidates
    
    alt High confidence healing (>0.9)
        HW->>ER: Apply healing automatically
        HW->>ES: Retry with healed locator
        ES->>ES: Execute action successfully
        ES->>HW: Record healing success
        HW->>ER: Update element success rate
        
    else Medium confidence (0.7-0.9)
        HW->>ER: Save healing proposal
        HW->>ES: Try fallback selectors
        
        alt Fallback succeeds  
            ES->>HW: Continue execution
            HW->>RQ: Queue healing review (low priority)
        else All fallbacks fail
            HW->>RQ: Queue urgent healing review
            HW->>ES: Mark step as failed
        end
        
    else Low confidence (<0.7)
        HW->>RQ: Create manual review item
        HW->>ES: Halt execution, await review
        
        U->>RQ: Review healing proposal
        U->>RQ: Approve new locator
        RQ->>ER: Save approved healing
        RQ->>ES: Resume execution
    end
    
    Note over HW,ER: Scoped lookup: try page-specific<br/>then section-specific then global fallbacks
    Note over HW,RQ: Promotion: successful healings<br/>become primary locators after validation
```

## D) Test Evolution - New Action Insertion

```mermaid
sequenceDiagram
    participant PE as Policy Engine
    participant MCP as MCP Server
    participant LP as LLM Planner
    participant ER as Element Repository
    participant RQ as Review Queue
    participant U as User
    participant ES as Execution Service
    
    PE->>PE: Runtime signal detected<br/>(seating_mode = "assigned")
    PE->>MCP: request_plan_modification(context)
    MCP->>LP: Generate new action sequence
    
    LP->>LP: Analyze: "select_seat" action needed
    LP->>ER: Check if "seat_selector" element exists
    
    alt Element exists
        LP->>MCP: Insert action with existing element
        MCP->>PE: Update execution plan
        PE->>ES: Execute new action sequence
        
    else New element needed
        LP->>LP: Generate element requirements
        LP->>RQ: Queue element creation review
        LP->>MCP: Plan modification pending review
        
        U->>RQ: Review new element proposal
        U->>ER: Create "seat_selector" element
        RQ->>MCP: Approve plan modification
        
        MCP->>PE: Update plan with new action
        PE->>ES: Execute modified sequence
    end
    
    ES->>ES: Execute: select_seat(assigned_seat_number)
    
    alt Seat selection succeeds
        ES->>PE: Continue with checkout flow
        PE->>MCP: Log successful evolution
        
    else Seat selection fails
        ES->>PE: Fall back to original flow
        PE->>RQ: Queue evolution failure review
        Note over RQ: Review why seat selection<br/>failed for future improvements
    end
    
    Note over PE,LP: Dynamic insertion preserves<br/>test flow integrity and rollback capability
    Note over RQ,U: Human oversight ensures<br/>evolution quality and prevents drift
```

## Key Sequence Patterns

### Confidence-Based Automation
- **High confidence (>0.9)**: Auto-approve/apply with audit logging
- **Medium confidence (0.7-0.9)**: Apply with deferred review queue
- **Low confidence (<0.7)**: Block for immediate human review

### Scoped Fallback Strategy
1. **Primary locator**: Current approved element locator
2. **Page-scoped**: Alternative selectors for same page context  
3. **Section-scoped**: Selectors that work across similar page sections
4. **Global fallback**: Generic selectors as last resort
5. **Manual escalation**: Human review when all automated options exhausted

### Review Queue Prioritization
- **Urgent**: Blocking execution failures, security violations
- **High**: New element approvals, healing validations  
- **Medium**: Plan optimizations, performance improvements
- **Low**: Deferred healings, analytics reviews

### Idempotency & State Management
- All MCP tool calls include correlation IDs for duplicate detection
- Execution state checkpointed at each step for resume capability
- Review items track approval state to prevent double-processing
- Healing events record application status to avoid re-healing