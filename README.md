# Prompt-Driven Self-Healing Test Framework

A modern test automation framework that converts natural language prompts into executable test plans using AI-powered planning and self-healing capabilities.

## 🎯 Overview

This capstone project demonstrates an innovative approach to test automation by combining:
- **Natural Language Processing** - Convert plain English prompts into structured test plans
- **AI-Powered Planning** - Intelligent mapping of user intent to test actions
- **Self-Healing Capabilities** - Automatic recovery from test failures
- **Microservices Architecture** - Scalable, containerized services

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   Python AI     │    │   Java Runner   │
│   (React/Vue)   │◄──►│   Planner       │◄──►│   (Selenium)    │
│                 │    │   (FastAPI)     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   Database      │
                       └─────────────────┘
```

## ✨ Features

- 🗣️ **Natural Language Input** - Write tests in plain English
- 🤖 **AI Planning Engine** - Converts prompts to executable actions
- 🔄 **Self-Healing** - Automatically recovers from element changes
- 🐳 **Containerized** - Easy deployment with Docker Compose
- 📊 **Test Reporting** - Comprehensive test execution reports
- 🎯 **Multiple Scenarios** - Supports login flows, navigation, verification

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Docker & Docker Compose
- Java 11+ (for test runner)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/wake049/Prompt-Driven-Self-Healing-Test-Framework.git
cd Prompt-Driven-Self-Healing-Test-Framework
```

### 2. Start with Docker (Recommended)
```bash
# Build and start all services
docker compose up -d --build

# Check service health
curl http://localhost:8000/health
```

### 3. Local Development Setup
```bash
# Set up Python environment
make setup

# Run tests
make test

# Start development server
make dev
```

## 📖 Usage Examples

### Basic API Usage

**Health Check:**
```bash
curl http://localhost:8000/health
```

**Generate Login Test Plan:**
```bash
curl -X POST http://localhost:8000/plan \
  -H "Content-Type: application/json" \
  -d '{"prompt": "login to the application"}'
```

**Response:**
```json
{
  "actions": [
    {"name": "open_url", "params": {"url": "https://the-internet.herokuapp.com/login"}},
    {"name": "type_css", "params": {"selector": "#username", "text": "tomsmith"}},
    {"name": "type_css", "params": {"selector": "#password", "text": "SuperSecretPassword!"}},
    {"name": "click_css", "params": {"selector": "button[type='submit']"}},
    {"name": "wait_for_css", "params": {"selector": "#content"}},
    {"name": "assert_title_contains", "params": {"text": "The Internet"}}
  ],
  "meta": {"prompt": "login to the application", "version": "0.1.0"}
}
```

### Supported Prompts

| Prompt | Generated Actions |
|--------|------------------|
| `"login"` | Complete login flow with credentials |
| `"open example"` | Navigate to example.com and verify |
| `"verify title"` | Assert page title contains expected text |

## 🛠️ Development

### Project Structure
```
├── contracts/           # API contracts and golden files
│   ├── golden/         # Expected API responses
│   └── schemas/        # JSON schemas
├── docker/             # Docker configurations
├── services/
│   ├── python-ai/      # AI Planning Service
│   │   ├── app.py      # FastAPI application
│   │   ├── planner.py  # Planning logic
│   │   ├── rules.py    # Business rules
│   │   └── tests/      # Unit tests
│   ├── java-runner/    # Test execution engine (TODO)
│   └── web-frontend/   # Web interface (TODO)
└── docker-compose.yml  # Service orchestration
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/plan` | POST | Generate test plan from prompt |

### Running Tests

```bash
# Unit tests
make test

# Contract tests (compare with golden files)
make plan-login

# All tests
python -m pytest services/python-ai/tests/ -v
```

## 🔧 Configuration

### Environment Variables
- `PLANNER_ENV` - Environment (dev/prod)
- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DB` - Database name

### Makefile Commands
```bash
make setup    # Set up development environment
make dev      # Start development server
make test     # Run unit tests
make up       # Start Docker services
make down     # Stop Docker services
```

## 🎓 Capstone Project Details

### Learning Objectives Demonstrated
- **Software Architecture** - Microservices design with clear separation of concerns
- **API Development** - RESTful API with FastAPI and proper error handling
- **Test Automation** - Modern testing practices with pytest and contract testing
- **DevOps** - Containerization, orchestration, and CI/CD readiness
- **AI Integration** - Natural language processing for test generation

### Technical Skills Showcased
- Python (FastAPI, Pydantic, Pytest)
- Docker & Docker Compose
- REST API design
- JSON Schema validation
- Git version control
- Software testing methodologies

## 🚧 Roadmap

### Current Status (v0.1.0) ✅
- [x] AI Planning Service
- [x] Natural language prompt processing
- [x] Contract testing with golden files
- [x] Docker containerization
- [x] Unit test coverage

### Next Phase (v0.2.0) 🔄
- [ ] Java-based test runner with Selenium
- [ ] Self-healing element detection
- [ ] Web frontend interface
- [ ] Extended test scenario support

### Future Enhancements (v1.0.0) 📋
- [ ] Machine learning for better prompt understanding
- [ ] Visual test reporting dashboard
- [ ] Integration with CI/CD pipelines
- [ ] Multi-browser support

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

*This project demonstrates modern software engineering practices including microservices architecture, API-first development, containerization, and AI-powered automation for educational purposes.*
