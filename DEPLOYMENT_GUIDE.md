# Self-Healing Test Framework - AWS Deployment Guide

## 🎯 Deployment Summary

Your Self-Healing Test Framework is now **ready for AWS deployment** with the following configuration:

### 🌐 Domain Configuration
- **Primary Domain**: testhelix.com (registration in progress)
- **API Endpoint**: api.testhelix.com
- **WWW Redirect**: www.testhelix.com
- **SSL Certificates**: AWS Certificate Manager with Let's Encrypt
- **DNS Management**: AWS Route 53

### ✅ Completed Deployment Preparation

1. **Infrastructure Configuration**
   - ✅ Docker Compose files updated for AWS deployment
   - ✅ All Dockerfiles security-hardened with non-root users
   - ✅ Port configurations standardized (MCP Server: 8001)
   - ✅ Health checks implemented for all services
   - ✅ Domain and SSL configuration scripts created

2. **Database Integration**
   - ✅ AWS RDS PostgreSQL configured
   - **Database:** `prompt_qa_db`
   - **Endpoint:** `prompt-qa.choawqiq4n3x.us-east-2.rds.amazonaws.com`
   - **User:** `prompt_qa`
   - ✅ Complete database schema with all tables and indexes
   - ✅ Multi-schema design (core, repo, exec, healing, analytics, etc.)
   - ✅ Sample data functions for new user registration

3. **Environment Configuration**
   - ✅ Production environment variables configured
   - ✅ AWS-specific docker-compose.aws.yml created
   - ✅ Security best practices implemented
   - ✅ Domain-specific environment variables added

4. **Deployment Scripts**
   - ✅ AWS infrastructure setup script
   - ✅ ECS deployment script  
   - ✅ Database connection test scripts (Bash + Python)
   - ✅ Deployment readiness checker
   - ✅ Domain and SSL setup scripts (PowerShell + Bash)

5. **Enhanced User Registration**
   - ✅ Modified auth.py to create sample projects automatically
   - ✅ New users get sample test cases and healing rules
   - ✅ Demo login and search test scenarios included

## 🚀 Quick Deployment Steps

### Prerequisites: Domain Setup for testhelix.com

Before deploying to production, you need to configure your domain and SSL certificates:

#### Step 1: Complete Domain Registration
1. Wait for testhelix.com registration to complete
2. You'll receive confirmation email with domain management details

#### Step 2: Configure AWS Route 53 and SSL
Run the domain setup script to configure AWS infrastructure:

**Windows PowerShell:**
```powershell
cd "c:\Users\Wakeb\capstone-self-healing"
.\scripts\setup-domain-ssl.ps1 -DomainName "testhelix.com"
```

**Linux/macOS Bash:**
```bash
cd /path/to/capstone-self-healing
chmod +x scripts/setup-domain-ssl.sh
./scripts/setup-domain-ssl.sh
```

This script will:
- Create Route 53 hosted zone for testhelix.com
- Request SSL certificates for testhelix.com, www.testhelix.com, api.testhelix.com
- Set up Application Load Balancer
- Configure DNS A records

#### Step 3: Update Domain Name Servers
1. Copy the Route 53 name servers from the script output
2. Log into your domain registrar
3. Update name servers to point to AWS Route 53
4. Wait for DNS propagation (up to 48 hours)

#### Step 4: Validate SSL Certificates
1. Check AWS Certificate Manager console
2. Add DNS validation records (if not automated)
3. Wait for certificate validation (5-30 minutes)

### Option 1: Local Testing with AWS Database
```bash
# 1. Test database connection
python scripts/test-database-connection.py

# 2. Start services locally with AWS database
docker-compose up --build

# 3. Access at http://localhost:3000
```

### Option 2: Full AWS ECS Deployment
```bash
# 1. Set up AWS infrastructure
chmod +x scripts/setup-aws-infrastructure.sh
./scripts/setup-aws-infrastructure.sh

# 2. Deploy to ECS
chmod +x scripts/deploy-to-ecs.sh
export AWS_ACCOUNT_ID=your-account-id
./scripts/deploy-to-ecs.sh

# 3. Access via ALB DNS name
```

## 📋 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  React Frontend │    │   MCP Server    │    │   Unified API   │
│   (Port 3000)   │◄──►│   (Port 8001)   │◄──►│   (Port 8000)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│Chrome Extension │    │  Java Runner    │    │  AWS RDS        │
│   (Browser)     │    │   (Port 8080)   │    │  PostgreSQL     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Service Configuration

### Container Resource Allocation
- **React Frontend:** 256 CPU, 512 MB RAM
- **Unified API:** 512 CPU, 1024 MB RAM  
- **MCP Server:** 256 CPU, 512 MB RAM
- **Java Runner:** 512 CPU, 1024 MB RAM

### Security Features
- ✅ Non-root users in all containers
- ✅ Minimal base images (slim/alpine)
- ✅ Security headers in nginx configuration
- ✅ Database SSL connections required
- ✅ JWT authentication with secure tokens

## 🎯 Key Features Ready for Demo

### 1. New User Experience
When users register, they automatically get:
- Sample project with demo elements
- Pre-configured login test scenario
- Search functionality test case
- Self-healing rules for common elements

### 2. AI-Powered Test Generation
- Natural language prompt to test plan conversion
- Intelligent step generation with metadata
- Confidence scoring and complexity assessment

### 3. Self-Healing Capabilities
- Cascading fallback selectors
- Element recovery strategies
- Success/failure tracking

### 4. Real-Time Analytics
- Live execution dashboards
- Performance metrics collection
- Failure pattern analysis

## 🔍 Database Schema

The framework uses a comprehensive multi-tenant schema:
- **Tenants:** Organization-level isolation
- **Users:** Individual user accounts
- **Projects:** Test project containers
- **Elements:** Page element definitions
- **Test Sessions:** Execution tracking
- **Healing Rules:** Self-healing strategies

## 🌐 Environment Variables

### Required for Deployment
```bash
# Database (Already configured)
DB_HOST=prompt-qa.choawqiq4n3x.us-east-2.rds.amazonaws.com
DB_NAME=prompt_qa_db
DB_USER=prompt_qa
DB_PASSWORD=St70698!2#4

# AI Configuration (Add your API key)
OPENAI_API_KEY=your_openai_api_key_here

# AWS Resources (From infrastructure setup)
AWS_ACCOUNT_ID=your-account-id
ALB_DNS_NAME=your-alb-dns-name
```

## 📈 Monitoring & Observability

### Health Checks
- **API:** `GET /health`
- **Frontend:** `GET /`
- **MCP Server:** WebSocket connection test
- **Java Runner:** `GET /health`

### Logging
- Structured JSON logging
- CloudWatch integration ready
- Request/response tracking
- Error aggregation

## 🔧 Troubleshooting

### Common Issues
1. **Database Connection:** Run `python scripts/test-database-connection.py`
2. **Port Conflicts:** Check with `netstat -tuln | grep :PORT`
3. **Container Health:** `docker-compose ps` shows service status
4. **Environment Variables:** Verify `.env` file exists and is complete

### Debug Commands
```bash
# Check container logs
docker-compose logs -f service-name

# Test database connectivity
python scripts/test-database-connection.py

# Validate deployment readiness
chmod +x scripts/deployment-readiness-check.sh
./scripts/deployment-readiness-check.sh
```

## 🎓 Capstone Demo Points

### Technical Excellence
- **Modern Architecture:** Microservices with MCP protocol
- **Full-Stack Implementation:** React + FastAPI + Java + PostgreSQL
- **Cloud-Native:** AWS ECS, RDS, ECR integration
- **Security-First:** Container hardening, JWT auth, SSL/TLS

### Innovation Features
- **AI Integration:** OpenAI/Azure/AWS Bedrock support
- **Self-Healing:** Intelligent element recovery
- **Real-Time:** WebSocket communication throughout
- **Enterprise-Ready:** Multi-tenant, role-based access

### Business Value
- **Productivity:** Natural language test creation
- **Reliability:** Self-healing reduces maintenance
- **Scalability:** Cloud-native architecture
- **Cost-Effective:** Automated test generation and execution

---

## 🏁 Next Steps

1. **Test locally:** `docker-compose up --build`
2. **Add your OpenAI API key** to environment variables
3. **Deploy to AWS** using the provided scripts
4. **Configure DNS/SSL** for production access
5. **Set up monitoring** and alerting

Your framework is production-ready! 🚀