# Self-Host Runbook

Operational guide for FluxTest self-hosted enterprise deployments.

---

## Prerequisites

| Requirement | Minimum |
|-------------|---------|
| Docker & Docker Compose | v20+ / v2+ |
| CPU | 4 cores |
| RAM | 8 GB (16 GB with Ollama) |
| Disk | 40 GB |
| Network | Outbound HTTPS to `app.fluxtest.io` (license validation) |
| DNS | Two A/CNAME records for your domain (app + api) |
| SSL/TLS | Wildcard or per-subdomain certificate |

---

## 1. Initial Deployment

### 1.1 Obtain a License Key

1. Sign in to [app.fluxtest.io](https://app.fluxtest.io) with an Enterprise or Custom plan.
2. Navigate to **Organization Settings > Self-Host License**.
3. Click **Issue License Key** and copy the key immediately.

### 1.2 Configure Environment

```bash
cp .env.selfhost.template .env.selfhost
```

Fill in required values:

| Variable | Description |
|----------|-------------|
| `DB_PASSWORD` | Strong database password |
| `JWT_SECRET_KEY` | Random 64+ character string (e.g. `openssl rand -hex 32`) |
| `MCP_API_KEY` | Random token for MCP auth |
| `SELF_HOST_LICENSE_KEY` | The key from step 1.1 |
| `SELF_HOST_TENANT_SLUG` | Your organization slug (visible in sidebar) |
| `SELF_HOST_VALIDATION_URL` | `https://app.fluxtest.io/api/v1/licensing/self-host/validate` |
| `FRONTEND_DOMAIN` | e.g. `app.yourcompany.com` |
| `VITE_UNIFIED_API_URL` | e.g. `https://api.yourcompany.com` |
| `VITE_MCP_SERVER_URL` | e.g. `wss://api.yourcompany.com/mcp/ws` |

Set at least one AI provider key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY`) or enable Ollama for local inference.

### 1.3 SSL/TLS Setup

Place your certificate and key on the host and update `nginx.conf`:

```nginx
server {
    listen 443 ssl;
    server_name app.yourcompany.com api.yourcompany.com;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # ... existing location blocks
}
```

Or terminate TLS at your load balancer / reverse proxy and route to ports 3000 (frontend), 8000 (API), 8001 (MCP), 8080 (runner).

### 1.4 Start Services

```bash
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml up -d --build
```

Verify:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/health/detailed
```

The `self_host_license` field in `/health/detailed` should show `"status": "valid"`.

---

## 2. Backup & Restore

### 2.1 Database Backup

```bash
# Full logical backup
docker exec postgres-selfhost pg_dump -U promptqa_user -d promptqa -Fc > backup_$(date +%Y%m%d_%H%M%S).dump

# Schema-only backup
docker exec postgres-selfhost pg_dump -U promptqa_user -d promptqa --schema-only > schema_backup.sql
```

Schedule daily backups via cron or Windows Task Scheduler.

### 2.2 Database Restore

```bash
# Stop API services first
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml stop unified-api mcp-server java-runner react-frontend

# Restore from dump
docker exec -i postgres-selfhost pg_restore -U promptqa_user -d promptqa --clean --if-exists < backup_20260412_120000.dump

# Restart services
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml start unified-api mcp-server java-runner react-frontend
```

### 2.3 Volume Backup

```bash
# Backup the entire PostgreSQL data volume
docker run --rm -v postgres_data_selfhost:/data -v $(pwd):/backup alpine \
  tar czf /backup/pg_volume_backup.tar.gz /data
```

---

## 3. Upgrade Path

### 3.1 Standard Upgrade

```bash
# Pull latest changes
git pull origin main

# Backup database first
docker exec postgres-selfhost pg_dump -U promptqa_user -d promptqa -Fc > pre_upgrade_backup.dump

# Rebuild and restart
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml up -d --build

# Run any new migrations (check database-migrations/ for files newer than your last applied migration)
docker exec -i postgres-selfhost psql -U promptqa_user -d promptqa < database-migrations/NEW_MIGRATION.sql

# Verify health
curl http://localhost:8000/health/detailed
```

### 3.2 Rollback

```bash
# Stop services
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml down

# Restore previous database
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml up -d postgres
docker exec -i postgres-selfhost pg_restore -U promptqa_user -d promptqa --clean --if-exists < pre_upgrade_backup.dump

# Checkout previous version
git checkout <previous-tag>

# Rebuild
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml up -d --build
```

---

## 4. License Management

### 4.1 Validation

Self-hosted instances call `SELF_HOST_VALIDATION_URL` every 5 minutes to confirm the license is active. Check the current state:

```bash
curl http://localhost:8000/health/detailed | jq .self_host_license
```

Expected output:
```json
{
  "status": "valid",
  "reason": "ok",
  "last_checked_at": 1744444800.123
}
```

### 4.2 License Rotation

1. Go to **Organization Settings > Self-Host License** in the FluxTest dashboard.
2. Revoke the current key (reason: "Security rotation").
3. Issue a new key.
4. Update `SELF_HOST_LICENSE_KEY` in `.env.selfhost`.
5. Restart the API: `docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml restart unified-api`

### 4.3 Expired / Revoked License

When validation fails:
- The `/health/detailed` endpoint will report `"status": "invalid"`.
- Services continue to run but validation will log warnings.
- Renew or re-issue the license in the FluxTest dashboard.

---

## 5. Monitoring & Logs

### 5.1 View Logs

```bash
# All services
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml logs -f

# Specific service
docker-compose --env-file .env.selfhost -f docker-compose.selfhost.yml logs -f unified-api
```

### 5.2 Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic alive check |
| `GET /health/detailed` | DB, memory, license status |
| `GET /health/ready` | Readiness probe |
| `GET /health/live` | Liveness probe |

### 5.3 Database Monitoring

```bash
# Active connections
docker exec postgres-selfhost psql -U promptqa_user -d promptqa -c "SELECT count(*) FROM pg_stat_activity;"

# Table sizes
docker exec postgres-selfhost psql -U promptqa_user -d promptqa -c \
  "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname IN ('core','exec','healing','policy') ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 20;"
```

---

## 6. Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| `health/detailed` returns `self_host_license: invalid` | License revoked, subscription downgraded, or key mismatch | Re-issue license in dashboard, verify `SELF_HOST_LICENSE_KEY` in env |
| `health/detailed` returns `self_host_license: not_configured` | Missing env vars | Set `SELF_HOST_LICENSE_KEY`, `SELF_HOST_TENANT_SLUG`, `SELF_HOST_VALIDATION_URL` |
| API returns 500 on startup | Database not ready | Wait for postgres healthcheck, check `DB_PASSWORD` |
| MCP WebSocket won't connect | Wrong URL or auth | Verify `VITE_MCP_SERVER_URL` uses `wss://` and `MCP_API_KEY` matches |
| Frontend shows blank page | Build-time env vars wrong | Rebuild frontend: env vars prefixed `VITE_` are baked at build time |
| Java runner times out | Browser drivers missing | Container includes Chrome, Firefox, Edge. Check `SELENIUM_HEADLESS=true` |
| Ollama model not found | Model not pulled | `docker exec ollama-selfhost ollama pull llama3.1:8b` |
| Container OOM killed | Resource limits too low | Increase `*_MEM_LIMIT` in `.env.selfhost` |

---

## 7. Security Checklist

- [ ] Database password is random and unique (not the template default)
- [ ] `JWT_SECRET_KEY` is at least 64 characters of random hex
- [ ] `MCP_API_KEY` is unique and not shared externally
- [ ] TLS is enabled on all external-facing endpoints
- [ ] Network access to port 5432 (PostgreSQL) is restricted to internal services only
- [ ] Outbound HTTPS to `app.fluxtest.io` is allowed for license validation
- [ ] Container images are rebuilt from trusted source (your own repo)
- [ ] `.env.selfhost` file permissions are restricted (`chmod 600`)
- [ ] Regular database backups are scheduled
- [ ] Log level is set to `INFO` (not `DEBUG`) in production

---

## Support

- Email: support@fluxtest.io
- Documentation: https://fluxtest.io/docs
- License issues: Organization Settings > Self-Host License tab
