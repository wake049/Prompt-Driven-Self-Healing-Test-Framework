# FluxTest

**AI-Powered Test Automation — Self-Healing, Policy-Governed, Enterprise-Ready**

FluxTest converts natural language prompts into executable test plans, runs them via Selenium, and automatically heals broken selectors when your UI changes — all governed by configurable policies with full audit trails.

Website: [fluxtest.io](https://fluxtest.io) | Support: support@fluxtest.io

---

## Features

- **Natural Language Test Generation** — Describe tests in plain English, get production-ready Selenium scripts
- **Self-Healing Tests** — Broken selectors are automatically detected and repaired using AI
- **Policy-Based Governance** — Confidence thresholds, safety blocks for critical actions, human-in-the-loop review queues
- **Multi-AI Provider Support** — OpenAI, Anthropic, Google, or local Ollama (no vendor lock-in)
- **Element Health Tracking** — Proactive drift detection, flaky test identification, 200+ elements monitored
- **Multi-Browser Execution** — Chrome, Firefox, Edge
- **Privacy-First Architecture** — MCP policy controls limit what data reaches AI providers
- **Chrome Extension** — Capture page interactions and element selectors from any website
- **Organization & Team Management** — Multi-tenant workspaces with role-based access, Stripe billing integration
- **API Test Data Preconditions** — Configure API-based test data setup before UI execution begins

---

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   React UI   │────▶│  Unified API │────▶│  Java Runner  │
│  (Vite/TS)   │     │  (FastAPI)   │     │  (Selenium)   │
└──────┬───────┘     └──────┬───────┘     └───────────────┘
       │                    │
       │              ┌─────┴──────┐
       └─────────────▶│ MCP Server │
                      │ (WebSocket)│
                      └────────────┘
┌──────────────┐     ┌──────────────┐
│   Chrome     │     │  PostgreSQL  │
│  Extension   │     │  Database    │
└──────────────┘     └──────────────┘
```

| Service | Stack | Port | Purpose |
|---------|-------|------|---------|
| Unified API | Python / FastAPI | 8000 | Auth, prompts, execution, policy, analytics, billing |
| MCP Server | Python / WebSocket | 8001 | Real-time tool/resource bridge between frontend and API |
| Java Runner | Java / Spring / Selenium | 8080 | Browser test execution and self-healing |
| React Frontend | React 18 / TypeScript / Vite | 3000 | Dashboard, test management, analytics |
| Chrome Extension | TypeScript | — | Page interaction capture and selector recording |
| PostgreSQL | PostgreSQL 15 | 5432 | Persistent storage |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Java 11+ (for test runner)
- Node.js 18+ (for frontend development)

### Local Development

```bash
# Start all services with local PostgreSQL
docker-compose -f docker-compose.local.yml up -d --build

# Or use the one-command script (Windows)
start-local.bat
```

Services will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- MCP: ws://localhost:8001
- Java Runner: http://localhost:8080

### Verify

```bash
curl http://localhost:8000/health
```

### Stop

```bash
docker-compose -f docker-compose.local.yml down
# Or: stop-local.bat
```

---

## Deployment Modes

| Mode | Compose File | Use Case |
|------|-------------|----------|
| Local Dev | `docker-compose.local.yml` | Development with local PostgreSQL |
| Production | `docker-compose.yml` | Production with external DB and secrets |
| Self-Hosted | `docker-compose.selfhost.yml` | Enterprise on-prem deployment with licensing |
| AWS | `docker-compose.aws.yml` | AWS with CloudWatch integration |

### Self-Hosted Enterprise

```bash
cp .env.selfhost.template .env.selfhost
# Edit .env.selfhost with your database and license details
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml up -d --build
```

---

## AI Providers

| Provider | API Key | Cost | Best For |
|----------|---------|------|----------|
| OpenAI (GPT-4) | Required | Pay-per-use | Production quality |
| Anthropic (Claude) | Required | Pay-per-use | Complex reasoning |
| Google (Gemini) | Required | Pay-per-use | Speed, cost-effective |
| Ollama (local) | None | Free | Development, privacy, offline |

### Using Ollama (Free, Local)

```bash
# Docker (recommended)
docker-compose -f docker-compose.local.yml --profile ollama up -d
docker exec ollama-local ollama pull llama3.1:8b

# Or native install from https://ollama.com/download
ollama pull llama3.1:8b
set OLLAMA_ENABLED=true
set OLLAMA_MODEL=llama3.1:8b
```

---

## Project Structure

```
├── services/
│   ├── unified-api/        # FastAPI backend (auth, prompts, execution, policy, billing)
│   ├── mcp-server/         # MCP WebSocket server (tool/resource bridge)
│   ├── java-runner/        # Spring + Selenium test execution engine
│   └── react-frontend/     # React 18 + TypeScript + Vite dashboard
├── chrome-extension/       # Browser extension for test capture
├── contracts/              # API schemas and golden files
├── database-migrations/    # PostgreSQL migration scripts (001-019)
├── tests/                  # Integration, E2E, performance, and release tests
├── release/                # Release phase implementation docs and scripts
├── docker-compose*.yml     # Service orchestration (local, prod, selfhost, aws)
└── docs/                   # Brand style guide
```

---

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/plan` | POST | Generate test plan from prompt |
| `/api/v1/prompts` | CRUD | Manage test prompts |
| `/api/v1/test-execution` | POST | Execute test plans |
| `/api/v1/healing` | GET/POST | Self-healing analytics and submissions |
| `/api/v1/policy` | CRUD | Policy configuration and decisions |
| `/api/v1/analytics` | GET | Execution and healing analytics |
| `/api/v1/auth` | POST | Authentication and registration |
| `/api/v1/billing` | CRUD | Subscription and payment management |

---

## Development

### Running Tests

```bash
# All tests
python -m pytest tests/ -v

# Smoke tests
python tests/smoke_release_phase1.py

# Contract tests
python -m pytest tests/test_contracts.py -v
```

### Makefile Commands

```bash
make setup        # Set up development environment
make dev-api      # Start Unified API server
make dev-mcp      # Start MCP server
make test         # Run unit tests
make lint         # Lint with ruff
make up-local     # Start local Docker services
make down-local   # Stop local Docker services
make health       # Check service health
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | AI provider (openai, anthropic, google, ollama) | openai |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `GOOGLE_API_KEY` | Google API key | — |
| `OLLAMA_ENABLED` | Enable local Ollama | false |
| `OLLAMA_MODEL` | Ollama model name | llama3.1:8b |
| `DB_HOST` | PostgreSQL host | postgres |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | promptqa_local |
| `DB_USER` | Database user | local_user |
| `DB_PASSWORD` | Database password | local_pass |
| `JWT_SECRET_KEY` | JWT signing secret | — |

---

## Database

19 migration scripts in `database-migrations/` covering:
- Core schema (prompts, test plans, executions, elements)
- Self-healing and policy engine tables
- Organization, team, and billing infrastructure
- API test data preconditions
- Runner management and logging
- Activity retention policies

Migrations run automatically on container startup via the PostgreSQL init directory.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Built by **Wake049** | [GitHub](https://github.com/wake049) | hello@fluxtest.io
