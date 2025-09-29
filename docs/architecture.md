# Platform Architecture

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend Layer"
        FE[Frontend Dashboard]
        RQ[Review Queue UI]
    end
    
    subgraph "MCP Protocol Layer"
        MCP[MCP Server<br/>Tools & Resources]
    end
    
    subgraph "Core Services"
        LP[LLM Planner]
        ER[Element Repository<br/>DB + Versioning]
        PE[Policy Engine<br/>Decision Tables]
        ES[Execution Service<br/>Java/Selenium]
    end
    
    subgraph "Job Queue System"
        JQ[Job Queue]
        PW[Plan Worker]
        EW[Exec Worker] 
        LW[Locator Worker]
        HW[Heal Worker]
    end
    
    subgraph "Analytics & Monitoring"
        RB[Runs Backend]
        AB[Analytics Backend]
        ML[Metrics & Logs]
    end
    
    %% Frontend Connections
    FE --> MCP
    RQ --> MCP
    
    %% MCP Tool Connections
    MCP --> LP
    MCP --> ER
    MCP --> PE
    MCP --> ES
    MCP --> JQ
    MCP --> RB
    MCP --> AB
    
    %% Worker Connections
    JQ --> PW
    JQ --> EW
    JQ --> LW
    JQ --> HW
    
    PW --> LP
    PW --> ER
    EW --> ES
    EW --> PE
    LW --> ER
    HW --> ER
    HW --> ES
    
    %% Analytics Flow
    ES --> RB
    RB --> AB
    AB --> ML
    
    %% Element Repository Flow
    ER --> PE
    PE --> ES
    
    %% Self-Healing Flow
    ES -.-> HW
    HW -.-> ER
```

## Component Responsibilities

### MCP Server
- **Tool Interface**: Standardized contracts for all platform operations
- **Resource Management**: Element repository, test data, analytics access
- **Protocol Compliance**: Full MCP specification implementation
- **Authentication**: RBAC integration and audit logging

### Element Repository
- **Versioned Storage**: Git-like versioning for locator changes
- **Human Approval**: Review workflow for AI-generated locators
- **Conflict Resolution**: Merge strategies for concurrent updates
- **Performance**: Sub-100ms lookup for execution-critical paths

### Policy Engine
- **Runtime Branching**: Dynamic test path selection based on page conditions
- **Decision Tables**: Configurable business rules (seating_mode, user_type, etc.)
- **Context Evaluation**: Real-time page state assessment
- **Fallback Logic**: Graceful degradation strategies

### Execution Service
- **Browser Orchestration**: Multi-browser Selenium grid management  
- **Action Execution**: Atomic test step execution with retry logic
- **State Management**: Session persistence and cleanup
- **Failure Detection**: Smart outcome classification and healing triggers

### Job Queue System
- **Task Orchestration**: Async processing for plan/exec/heal operations
- **Priority Management**: SLA-based queue prioritization
- **Backpressure**: Load shedding and circuit breaker patterns
- **Idempotency**: Safe retry mechanisms for all operations