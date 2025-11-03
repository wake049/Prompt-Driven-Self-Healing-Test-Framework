# Prompt-Driven Self-Healing Test Framework

A modern, full-stack test automation framework that converts natural language prompts into executable test plans using AI-powered planning, self-healing capabilities, and Model Context Protocol (MCP) architecture.

## 🏗️ Architecture Overview

This capstone project demonstrates an innovative **MCP-based microservices architecture** that seamlessly integrates AI-powered test planning with real-time execution and analytics.

### **Core Technologies:**
- **Model Context Protocol (MCP)**: Unified communication layer between all services
- **React Frontend**: Modern web interface with real-time MCP integration
- **Chrome Extension**: Browser automation with MCP connectivity
- **FastAPI Backend**: High-performance Python API with PostgreSQL
- **Java Test Runner**: Selenium-based execution engine with self-healing
- **AI Planning Engine**: Natural language to test plan conversion

### **MCP Architecture Benefits:**
- **Protocol Standardization**: JSON-RPC 2.0 over WebSocket for all service communication
- **Real-time Data Flow**: Live updates across frontend, extension, and backend services
- **Type Safety**: Comprehensive schema validation and tool contracts
- **Scalability**: Microservices architecture with independent scaling
- **Developer Experience**: Unified debugging and monitoring across all components
- **Enterprise Security Gateway**: MCP server acts as data controller and security enforcement point
- **Data Sovereignty**: MCP server regulates what data flows to AI providers and what stays local
- **Policy Enforcement**: Centralized governance of AI interactions through MCP protocol

## 🎯 Key Features

- 🗣️ **Natural Language Input** - Write tests in plain English
- 🤖 **AI Planning Engine** - Converts prompts to executable test plans  
- 🔄 **Self-Healing Elements** - Automatically recovers from UI changes
- 🌐 **Chrome Extension** - Browser integration with MCP protocol
- 📊 **Real-time Analytics** - Live execution dashboards and failure analysis
- 🐳 **Containerized Deployment** - Docker Compose orchestration
- 🔌 **MCP Integration** - Universal protocol for service communication

## 🏗️ System Architecture

```
┌─────────────────┐    MCP/WebSocket    ┌─────────────────┐
│  React Frontend │◄──────────────────►│   MCP Server    │
│   (Port 3000)   │                    │   (Port 8765)   │
└─────────────────┘                    └─────────────────┘
                                               │
┌─────────────────┐    MCP/WebSocket           │ HTTP/REST
│Chrome Extension │◄───────────────────────────┤
│  (Browser)      │                            │
└─────────────────┘                            ▼
                                       ┌─────────────────┐
┌─────────────────┐    HTTP/REST       │  Unified API    │
│  Java Runner    │◄──────────────────►│   (Port 8000)   │
│   (Selenium)    │                    │                 │
└─────────────────┘                    └─────────────────┘
                                               │
                                               ▼
                                       ┌─────────────────┐
                                       │   PostgreSQL    │
                                       │   Database      │
                                       └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- **Docker & Docker Compose** (Required)
- **Node.js 18+** (for frontend development)
- **Python 3.11+** (for backend development)
- **Java 11+** (for test execution)
- **Chrome Browser** (for extension)

### 1. Clone the Repository
```bash
git clone https://github.com/wake049/Prompt-Driven-Self-Healing-Test-Framework.git
cd Prompt-Driven-Self-Healing-Test-Framework
```

### 2. Start All Services
```bash
# Build and start complete stack
docker compose up -d --build

# Verify services are running
docker compose ps
```

### 3. Access the Application
- **React Frontend**: http://localhost:3000
- **Unified API**: http://localhost:8000
- **MCP Server**: ws://localhost:8765 (WebSocket)
- **Database**: localhost:5432

### 4. Install Chrome Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select `./chrome-extension` folder
4. Pin the extension to your toolbar

## 📊 Frontend Features

### 🎛️ Main Dashboard
- **Execution Statistics**: Real-time test execution metrics
- **Success Rates**: Live success/failure tracking
- **Performance Analytics**: Execution time and step analysis

### 📝 Prompt Management
- **Natural Language Input**: Convert plain English to test plans
- **AI-Generated Steps**: Automatic test case creation
- **Execution History**: Track all test runs with detailed results

### 🔧 Element Management  
- **Dual Selector System**: CSS + XPath for robust element targeting
- **Self-Healing Rules**: Automatic element recovery strategies
- **Real-time Preview**: Live element highlighting in browser

### 📈 Analytics Dashboard
- **Failure Analysis**: Step-level failure pattern detection  
- **Action Performance**: Performance metrics by action type
- **Execution Trends**: Historical analysis and reporting

## 🛠️ Development Guide

### Project Structure
```
├── services/
│   ├── react-frontend/          # React web application
│   │   ├── src/components/      # Reusable UI components
│   │   ├── src/features/        # Feature-specific modules
│   │   └── src/services/        # MCP client integration
│   ├── mcp-server/              # Model Context Protocol server
│   │   ├── mcp_server/          # Core MCP implementation
│   │   └── schemas/             # Tool and resource schemas
│   ├── unified-api/             # FastAPI backend service
│   │   ├── api/                 # REST API endpoints
│   │   ├── core/                # Database models and utilities
│   │   └── services/            # Business logic services
│   └── java-runner/             # Selenium test execution
│       ├── src/main/java/       # Java source code
│       └── screenshots/         # Test execution artifacts
├── chrome-extension/            # Browser extension
│   ├── src/                     # TypeScript source code
│   └── public/                  # Extension manifest and assets
├── database-migrations/         # SQL migration scripts
└── docker-compose.yml          # Service orchestration
```

### Development Commands

**Frontend Development:**
```bash
cd services/react-frontend
npm install
npm run dev                    # Start development server
```

**Backend Development:**
```bash
cd services/unified-api
python -m venv venv
source venv/bin/activate       # Linux/Mac
# or venv\Scripts\activate     # Windows
pip install -r requirements.txt
python main.py                 # Start FastAPI server
```

**MCP Server Development:**
```bash
cd services/mcp-server
pip install -e .
python -m mcp_server.server    # Start MCP server
```

## 🔒 Enterprise Security & Data Privacy

### **🏢 Enterprise AI Integration Strategy**

This framework is designed for organizations already using enterprise AI tools like **GitHub Copilot**, **Amazon Q (CodeWhisperer)**, or **GitLab Copilot** - companies that embrace AI but require **proper data governance** and **security controls**.

#### **🎯 Enterprise AI Deployment Options**

**Option 1: Azure OpenAI Enterprise (Recommended)**
```bash
# Enterprise-grade AI with data processing guarantees
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-enterprise-key
AZURE_OPENAI_DEPLOYMENT=your-gpt-deployment

# Data stays within your Azure tenant
# Full compliance with corporate data policies
# Same security as GitHub Copilot for Business
```

**Option 2: AWS Bedrock Enterprise**
```bash
# Amazon's enterprise AI service with data isolation
AWS_BEDROCK_ENDPOINT=https://bedrock.us-east-1.amazonaws.com
AWS_BEDROCK_MODEL=claude-3-sonnet
AWS_BEDROCK_REGION=us-east-1

# Integrated with existing AWS infrastructure
# Data processed within your AWS account boundary
# Compatible with Amazon Q enterprise policies
```

**Option 3: GitLab Duo Enterprise**
```bash
# GitLab's enterprise AI with data processing guarantees
GITLAB_AI_ENDPOINT=https://gitlab.com/api/v4/ai
GITLAB_TOKEN=your-enterprise-token
GITLAB_AI_MODEL=claude-3-sonnet

# Integrated with existing GitLab infrastructure
# Data processed within GitLab's enterprise boundaries
# Compatible with GitLab Duo enterprise policies
```

**Option 4: OpenAI Enterprise (With Proper Configuration)**
```bash
# OpenAI with enterprise data processing agreements
OPENAI_API_KEY=your-enterprise-key
OPENAI_ORGANIZATION=your-org-id
OPENAI_API_BASE=https://api.openai.com/v1

# Requires OpenAI Business/Enterprise plan
# Data processing agreements in place
# Similar to existing Copilot arrangements
```

### **🔐 Enterprise Data Governance**

**Following Proven AI Adoption Patterns:**
- **Similar to GitHub Copilot**: Uses same enterprise AI principles your developers already follow
- **Azure Integration**: Leverage existing Azure/Microsoft enterprise agreements
- **AWS Compatibility**: Works with current Amazon Q/CodeWhisperer infrastructure
- **GitLab Integration**: Compatible with GitLab's enterprise AI governance model

### **🛡️ MCP Server as Security Gateway**

The **Model Context Protocol (MCP) server** serves as the **central security enforcement point** for all AI interactions:

#### **🔐 Data Flow Control**
```
Frontend Request → MCP Server → Security Policy Check → AI Provider
     ↑                 ↑                    ↑               ↑
User Prompt    Data Sanitization    Policy Engine    Filtered Request
```

**MCP Server Security Functions:**
- **Data Sanitization**: Strips sensitive information before AI calls
- **Policy Enforcement**: Applies enterprise governance rules
- **Request Filtering**: Blocks unauthorized or risky AI requests  
- **Response Validation**: Ensures AI responses meet security standards
- **Audit Logging**: Complete trail of all AI interactions
- **Rate Limiting**: Prevents excessive AI usage and costs

#### **🎛️ Enterprise Policy Configuration**

**Data Classification Controls:**
```json
{
  "mcp_security_policies": {
    "sensitive_data_patterns": [
      "password", "token", "api_key", "credential",
      "ssn", "credit_card", "personal_id"
    ],
    "allowed_domains": ["test.company.com", "staging.company.com"],
    "blocked_patterns": ["production", "prod", "live"],
    "ai_providers": {
      "azure_openai": {
        "enabled": true,
        "data_processing_region": "us-east-1",
        "max_tokens": 4000
      },
      "local_llm": {
        "enabled": true,
        "fallback_for_sensitive": true
      }
    }
  }
}
```

**MCP Server Policy Engine:**
```python
# Example: MCP server automatically sanitizes and routes to enterprise AI
def route_ai_request(prompt: str, context: dict) -> str:
    # Sanitize sensitive data before AI processing
    sanitized_prompt = sanitize_sensitive_data(prompt, context)
    sanitized_context = remove_credentials_and_pii(context)
    
    # Always use enterprise AI - just with proper data protection
    if is_azure_deployment():
        return route_to_azure_openai(sanitized_prompt, sanitized_context)
    elif is_aws_deployment():
        return route_to_aws_bedrock(sanitized_prompt, sanitized_context)
    else:
        return route_to_openai_enterprise(sanitized_prompt, sanitized_context)
```

#### **🏭 Enterprise Deployment Patterns**

**Pattern 1: Azure-First (Microsoft Enterprise)**
```bash
# Leverages existing Microsoft enterprise relationship
# Same data processing as GitHub Copilot for Business
# Integrated with Azure AD/Entra ID
ENTERPRISE_AI_PROVIDER=azure
AZURE_TENANT_ID=your-tenant-id
```

**Pattern 2: AWS-First (Amazon Enterprise)**
```bash
# Uses AWS Bedrock within existing AWS infrastructure  
# Same security model as Amazon Q Developer
# VPC endpoints for private connectivity
ENTERPRISE_AI_PROVIDER=aws
AWS_BEDROCK_VPC_ENDPOINT=your-vpc-endpoint
```

**Pattern 3: Multi-Cloud (Hybrid Enterprise)**
```bash
# Different AI providers for different environments
# Dev/test uses one provider, production uses another
DEV_AI_PROVIDER=azure_openai
STAGING_AI_PROVIDER=aws_bedrock  
PROD_AI_PROVIDER=azure_openai
```

### **🔧 Enterprise Configuration Examples**

**GitHub Copilot-Style Deployment:**
```bash
# Similar data processing model to existing Copilot usage
AI_PROVIDER=azure_openai
AZURE_OPENAI_ENDPOINT=https://your-copilot-tenant.openai.azure.com
DATA_PROCESSING_REGION=us-east-1
ENTERPRISE_TIER=business

# Uses existing GitHub Copilot Business/Enterprise subscription
COPILOT_COMPATIBLE_MODE=true
RESPECT_COPILOT_POLICIES=true
```

**Amazon Q Developer Integration:**
```bash
# Leverages existing Amazon Q infrastructure and policies
AI_PROVIDER=aws_bedrock
AWS_BEDROCK_ROLE=arn:aws:iam::account:role/CodeWhispererRole
AWS_BEDROCK_MODEL=anthropic.claude-3-sonnet-20240229-v1:0

# Uses same IAM policies as existing Amazon Q setup
AMAZON_Q_COMPATIBLE=true
USE_EXISTING_Q_POLICIES=true
```

**GitLab Copilot Enterprise:**
```bash
# Integrates with GitLab's AI governance framework
AI_PROVIDER=gitlab_ai
GITLAB_AI_ENDPOINT=https://gitlab.com/api/v4/ai
GITLAB_TOKEN=your-enterprise-token

# Follows GitLab enterprise AI policies
GITLAB_AI_GOVERNANCE=enabled
RESPECT_GITLAB_AI_POLICIES=true
```

**Enterprise AI Configuration (No Local Fallbacks):**
```bash
# For organizations requiring AI-powered test generation
AI_PROVIDER=azure_openai  # or aws_bedrock, openai_enterprise
AI_REQUIRED=true          # Framework requires AI - no fallbacks
MCP_AI_GATEWAY=enabled    # MCP server sanitizes but always uses AI

# Data protection through sanitization, not avoidance
SANITIZE_CREDENTIALS=true
REMOVE_PII_PATTERNS=true
ANONYMIZE_URLS=true

# Enterprise AI endpoints with proper agreements
AZURE_OPENAI_ENDPOINT=https://your-tenant.openai.azure.com
AWS_BEDROCK_ENDPOINT=https://bedrock.us-east-1.amazonaws.com
```

### **📋 Implementation Checklist**

**For Organizations Using GitHub Copilot:**
- [ ] Verify Azure OpenAI deployment matches Copilot region
- [ ] Confirm data processing agreements cover test automation
- [ ] Update security policies to include test plan generation
- [ ] Train team on prompt engineering best practices

**For Organizations Using Amazon Q:**
- [ ] Configure AWS Bedrock in same region as CodeWhisperer
- [ ] Extend existing IAM policies to include test framework
- [ ] Set up VPC endpoints for private connectivity
- [ ] Validate compliance with existing AWS governance

**For Organizations Using GitLab Copilot:**
- [ ] Integrate with existing GitLab AI governance framework
- [ ] Configure GitLab AI endpoints and authentication
- [ ] Align with GitLab's responsible AI usage policies
- [ ] Set up project-level AI controls and monitoring

**For High-Security Organizations:**
- [ ] Configure enterprise AI with maximum data protection
- [ ] Implement comprehensive data sanitization policies
- [ ] Set up audit logging for all AI interactions
- [ ] Validate enterprise AI compliance certifications

#### **🔐 Multi-Layer Security Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    Corporate Firewall                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    Encrypted     ┌─────────────────┐  │
│  │  React Frontend │◄──── MCP ──────►│   MCP Server    │  │
│  │   (HTTPS/TLS)   │    WebSocket     │  (Local Only)   │  │
│  └─────────────────┘                  └─────────────────┘  │
│            │                                   │            │
│            │                                   │            │
│  ┌─────────────────┐                  ┌─────────────────┐  │
│  │Chrome Extension │                  │  Unified API    │  │
│  │ (Content Script)│                  │ (Internal Auth) │  │
│  └─────────────────┘                  └─────────────────┘  │
│                                               │            │
│                                               ▼            │
│                                      ┌─────────────────┐  │
│                                      │   PostgreSQL    │  │
│                                      │ (Encrypted DB)  │  │
│                                      └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### **🛡️ Security Features**

**Authentication & Authorization:**
- Multi-tenant user authentication
- Role-based access control (RBAC)
- API key management for service-to-service auth
- Session management with secure tokens

**Data Encryption:**
- TLS/HTTPS for all web communications
- WebSocket Secure (WSS) for MCP connections
- Database encryption at rest
- Encrypted credentials storage

**Network Security:**
- Internal-only MCP server (no external exposure)
- Configurable firewall rules
- VPN-compatible deployment
- Network isolation between services

**Audit & Compliance:**
- Complete audit trail of all test executions
- User action logging
- Data access monitoring
- Compliance reporting (SOX, HIPAA, PCI-DSS ready)

#### **🏭 Enterprise Deployment Options**

**Option 1: Fully Air-Gapped**
```bash
# Deploy entirely within corporate network
docker compose -f docker-compose.enterprise.yml up -d
# No internet access required after initial setup
```

**Option 2: Hybrid Cloud (Secure)**
```bash
# Frontend in cloud, data processing on-premises
# MCP server and database remain internal
# Only UI layer exposed externally
```

**Option 3: Multi-Tenant SaaS (Isolated)**
```bash
# Each tenant gets isolated infrastructure
# Dedicated databases and MCP servers per client
# Zero data sharing between organizations
```

### **🔍 Security Validation**

**Data Flow Analysis:**
```
User Input → React Frontend → MCP Server → Unified API → PostgreSQL
     ↑              ↑              ↑              ↑              ↑
  HTTPS/TLS    WSS Encrypted   Local Only    Internal Auth   Encrypted
```

**What Never Leaves Your Network:**
- ✅ Test plans and prompts
- ✅ Application URLs and credentials  
- ✅ Element selectors and page structure
- ✅ Execution results and failure data
- ✅ Performance metrics and analytics
- ✅ User data and business logic

**External Dependencies (Enterprise AI Required):**
- ✅ Enterprise AI API calls (Azure OpenAI/AWS Bedrock) - core functionality
- ✅ Secure enterprise AI endpoints with data processing agreements
- ✅ MCP server handles data sanitization and enterprise compliance
- ❌ No external analytics or tracking beyond enterprise AI
- ❌ No cloud storage requirements beyond AI provider agreements

### **📋 Security Compliance Checklist**

For enterprise adoption, this framework supports:

- **[ ] GDPR Compliance**: No personal data leaves EU infrastructure
- **[ ] SOX Compliance**: Complete audit trails and data integrity
- **[ ] HIPAA Compliance**: Healthcare data remains on-premises
- **[ ] PCI-DSS**: Payment data never transmitted externally
- **[ ] SOC 2**: Security controls and monitoring
- **[ ] ISO 27001**: Information security management

### **🔧 Security Configuration**

**Environment Variables for Security:**
```bash
# Authentication
MCP_SERVER_AUTH_ENABLED=true
MCP_SERVER_API_KEY=your-secure-api-key
JWT_SECRET_KEY=your-jwt-secret

# Encryption
DB_ENCRYPTION_ENABLED=true
TLS_CERT_PATH=/path/to/cert.pem
TLS_KEY_PATH=/path/to/key.pem

# Network Security
MCP_SERVER_BIND_IP=127.0.0.1  # Internal only
CORS_ALLOWED_ORIGINS=https://your-domain.com
ENABLE_RATE_LIMITING=true

# Audit Logging
AUDIT_LOG_ENABLED=true
AUDIT_LOG_LEVEL=INFO
SECURITY_EVENTS_WEBHOOK=https://your-siem.com/webhook
```

##  MCP Integration & Security Governance

### **MCP Server as Enterprise Control Plane**

The MCP server acts as the **intelligent security gateway** that regulates all AI interactions while maintaining the benefits of enterprise AI adoption:

### **🛡️ Security Tool Functions**
The MCP server provides standardized, security-aware tools:

**Data Management Tools:**
- `sql_get_all_elements` - Returns sanitized element data (no credentials)
- `sql_update_element` - Validates updates against security policies
- `fetch_test_data` - Applies data classification before AI processing

**AI-Aware Execution Tools:**  
- `run_action` - Uses AI for intelligent action execution strategies
- `verify_section` - AI-powered verification and validation logic
- `generate_test_plan` - Core AI-driven test plan generation from prompts

**Context Management Tools:**
- `context_put` - Encrypts and classifies context data
- `context_get` - Applies access controls and data masking

### **🎯 Intelligent AI Routing**

**MCP Server Decision Engine:**
```
User Request → MCP Server Analysis → Data Sanitization → Enterprise AI
     ↓                ↓                    ↓                 ↓
"Login test"    [Remove PII/URLs]    "Generic login test"  → Azure OpenAI
"Test with     [Strip credentials]   "Test with user form" → AWS Bedrock
 user@company"
"Verify prod   [Anonymize domain]    "Verify application"  → OpenAI Enterprise
 system"
```

**AI-First Approach:**
- **Always Use AI**: Framework designed around AI test generation
- **Data Protection**: MCP server sanitizes data before AI calls
- **Enterprise Compliance**: Leverages existing enterprise AI relationships
- **No Fallbacks**: AI is core functionality - must be properly configured

### Data Types with Security Classification
- `sessions` - User session data (**Sanitized** before AI processing)
- `elements` - UI element definitions (**AI Safe** after anonymization)
- `executions` - Test execution records (**AI Enhanced** - results analyzed by AI)
- `execution_stats` - Aggregated statistics (**AI Safe**)
- `execution_trends` - Historical analysis (**AI Safe**)
- `failure_analysis` - AI-powered failure pattern detection (**AI Enhanced**)
- `performance_metrics` - AI-driven performance analytics (**AI Enhanced**)

## 🎓 Capstone Project Highlights

### **Modern Architecture Patterns**
- **Microservices**: Independent, scalable service components
- **Event-Driven**: Real-time updates via WebSocket communication
- **API-First**: RESTful APIs with OpenAPI documentation
- **Protocol Standardization**: MCP for unified service communication

### **Full-Stack Technologies**
- **Frontend**: React 18, TypeScript, Styled Components
- **Backend**: FastAPI, PostgreSQL, asyncio/await patterns  
- **Browser Integration**: Chrome Extension API, Content Scripts
- **DevOps**: Docker Compose, multi-stage builds
- **Database**: PostgreSQL with multi-schema design

### **AI & Automation**
- **Natural Language Processing**: Prompt-to-test-plan conversion
- **Self-Healing**: Intelligent element recovery strategies
- **Analytics**: Machine learning insights from execution data
- **Real-time Intelligence**: Live failure pattern detection

## 🚧 Current Status

### ✅ Completed Features
- [x] Complete MCP-based architecture implementation
- [x] React frontend with real-time MCP integration
- [x] Chrome extension with MCP connectivity  
- [x] Unified API with comprehensive analytics
- [x] PostgreSQL database with multi-schema design
- [x] Java-based Selenium test execution
- [x] Self-healing element detection system
- [x] Real-time execution dashboards
- [x] Failure analysis and performance metrics

### 🔄 Active Development
- [ ] Enhanced AI prompt understanding
- [ ] Advanced self-healing algorithms
- [ ] Performance optimization
- [ ] Extended browser support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Wake049** - Capstone Project 2025

- GitHub: [@wake049](https://github.com/wake049)
- Repository: [Prompt-Driven-Self-Healing-Test-Framework](https://github.com/wake049/Prompt-Driven-Self-Healing-Test-Framework)

---

*This project demonstrates cutting-edge software engineering practices including Model Context Protocol integration, microservices architecture, real-time communication, and AI-powered automation for educational and professional development purposes.*
