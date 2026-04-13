# Self-Host Onboarding Guide

Step-by-step guide to get FluxTest running on your own infrastructure.

---

## Step 1: Confirm Your Plan

Self-hosted deployment requires an **Enterprise** or **Custom** plan. If you're on Community, Starter, or Professional, upgrade first at [app.fluxtest.io](https://app.fluxtest.io) under Organization Settings > Subscription.

---

## Step 2: Issue a License Key

1. Sign in to [app.fluxtest.io](https://app.fluxtest.io).
2. Go to **Organization Settings** (sidebar: Policy & Rules > Organization).
3. Click the **Self-Host License** tab.
4. Click **Issue License Key**.
5. **Copy the key immediately** — it is shown only once.

> If you lose the key, revoke the old one and issue a new one from the same page.

---

## Step 3: Prepare Your Host

You need a Linux or Windows server (or VM) with:

- Docker 20+ and Docker Compose v2+
- 4+ CPU cores, 8+ GB RAM (16 GB if using Ollama)
- 40+ GB disk
- Outbound HTTPS access to `app.fluxtest.io`
- A domain name with DNS configured (e.g. `app.yourcompany.com`)

---

## Step 4: Configure Environment

```bash
# Clone or download the FluxTest release package
git clone <your-repo-url>
cd capstone-self-healing

# Copy the environment template
cp .env.selfhost.template .env.selfhost
```

Open `.env.selfhost` and fill in:

```env
# Database (pick a strong password)
DB_PASSWORD=your-strong-db-password

# Security (generate random values)
JWT_SECRET_KEY=<run: openssl rand -hex 32>
MCP_API_KEY=<run: openssl rand -hex 16>

# License (from Step 2)
SELF_HOST_LICENSE_KEY=shl_your-license-key-here
SELF_HOST_TENANT_SLUG=your-org-slug
SELF_HOST_VALIDATION_URL=https://app.fluxtest.io/api/v1/licensing/self-host/validate

# Your domain
FRONTEND_DOMAIN=app.yourcompany.com
VITE_UNIFIED_API_URL=https://api.yourcompany.com
VITE_API_BASE_URL=https://api.yourcompany.com
VITE_MCP_SERVER_URL=wss://api.yourcompany.com/mcp/ws

# AI Provider (at least one)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key
```

---

## Step 5: Set Up SSL/TLS

**Option A: Load balancer termination** (recommended for cloud VMs)

Point your load balancer at the container ports (3000, 8000, 8001, 8080) and terminate TLS there.

**Option B: nginx with certificates**

Edit `nginx.conf` to add your SSL cert paths, then place `nginx.conf` in front of the containers.

---

## Step 6: Start Services

```bash
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml up -d --build
```

This starts:
- **PostgreSQL** on port 5432 (internal)
- **Unified API** on port 8000
- **MCP Server** on port 8001
- **Java Runner** on port 8080
- **React Frontend** on port 3000

---

## Step 7: Verify

```bash
# Basic health
curl http://localhost:8000/health

# Detailed health (check license status)
curl http://localhost:8000/health/detailed
```

The `self_host_license` field should show:
```json
{ "status": "valid", "reason": "ok" }
```

Open your frontend URL in a browser and sign in.

---

## Step 8: (Optional) Enable Local AI with Ollama

If you want to run AI inference locally without sending data to cloud providers:

```bash
# Start with the Ollama profile
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml --profile ollama up -d --build

# Pull a model
docker exec ollama-selfhost ollama pull llama3.1:8b
```

Update `.env.selfhost`:
```env
AI_PROVIDER=ollama
OLLAMA_ENABLED=true
```

---

## Step 9: Create Your First User

1. Open `https://app.yourcompany.com` in a browser.
2. Click **Get Started** or go to `/onboarding`.
3. Register with your email and password.
4. The first user in a self-hosted instance gets the **owner** role.

---

## What's Next

- Read the [Self-Host Runbook](SELF_HOST_RUNBOOK.md) for backup, restore, upgrade, and troubleshooting procedures.
- Set up scheduled database backups (see Runbook section 2).
- Configure your team's AI provider preferences in Organization Settings.
- Invite team members via Organization Settings > Members tab.

---

## Support

Questions? Email support@fluxtest.io or check the license status in Organization Settings > Self-Host License.
