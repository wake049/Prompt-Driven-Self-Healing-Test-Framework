"""
Phase 4: GA Launch Checklist
=============================
Comprehensive pre-launch verification that must pass before cutting a GA release.
Checks span all deployment variants, documentation completeness, security posture,
operational readiness, and service health.

Categories:
  1. Documentation completeness
  2. Security posture (headers, config files, secrets NOT committed)
  3. Docker Compose variant parity
  4. Database migration consistency
  5. Service health (all endpoints)
  6. Operational readiness (runbooks, playbooks, drills documented)
  7. CI/CD pipeline completeness
  8. Release artifact integrity

Environment variables:
  API_BASE_URL, MCP_BASE_URL, RUNNER_BASE_URL, FRONTEND_BASE_URL
  DB_HOST, DB_PORT
"""

import glob
import json
import os
import re
import time
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")
MCP_BASE = os.getenv("MCP_BASE_URL", "http://localhost:8001")
RUNNER_BASE = os.getenv("RUNNER_BASE_URL", "http://localhost:8080")
FRONTEND_BASE = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
REPORT_PATH = os.getenv("REPORT_PATH", "phase4_launch_checklist_report.json")

REPO_ROOT = os.path.join(os.path.dirname(__file__), "..")

results: list[dict] = []


def _record(category: str, item: str, passed: bool, detail: str = ""):
    results.append({"category": category, "item": item, "passed": passed, "detail": detail})
    icon = "PASS" if passed else "FAIL"
    print(f"  [{icon}] [{category}] {item}")
    if detail:
        print(f"         {detail}")


def _exists(rel_path: str) -> bool:
    return os.path.exists(os.path.join(REPO_ROOT, rel_path))


def _file_contains(rel_path: str, keyword: str) -> bool:
    path = os.path.join(REPO_ROOT, rel_path)
    if not os.path.exists(path):
        return False
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return keyword.lower() in f.read().lower()


def _get(url: str, timeout: int = 10) -> int:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except Exception:
        return 0


# ---------------------------------------------------------------------------
# Category 1: Documentation Completeness
# ---------------------------------------------------------------------------
def check_documentation():
    cat = "documentation"
    required_docs = [
        ("README.md", "Project README"),
        ("docs/runbook.md", "Operations runbook"),
        ("docs/SELF_HOST_RUNBOOK.md", "Self-host runbook"),
        ("docs/SECURITY_ROTATION_CHECKLIST.md", "Security rotation checklist"),
        ("docs/nfrs-slas.md", "NFRs and SLAs"),
        ("docs/architecture.md", "Architecture document"),
        ("docs/data-models.md", "Data models"),
        ("docs/WEBSITE_RELEASE_ROADMAP.md", "Release roadmap"),
        ("docs/MULTI_BROWSER_SUPPORT.md", "Multi-browser support"),
        ("docs/REGISTRATION_FLOW.md", "Registration flow"),
    ]
    for path, label in required_docs:
        _record(cat, f"{label} exists", _exists(path), path)

    # Verify roadmap is updated for Phase 4
    if _exists("docs/WEBSITE_RELEASE_ROADMAP.md"):
        _record(cat, "Roadmap references Phase 4",
                _file_contains("docs/WEBSITE_RELEASE_ROADMAP.md", "phase 4"), "")


# ---------------------------------------------------------------------------
# Category 2: Security Posture
# ---------------------------------------------------------------------------
def check_security():
    cat = "security"

    # No secrets committed
    secret_patterns = [
        "*.env",
        "*.pem",
        "*.key",
        "**/.env.local",
    ]
    for pattern in secret_patterns:
        matches = glob.glob(os.path.join(REPO_ROOT, pattern), recursive=True)
        # Filter out templates
        real_secrets = [m for m in matches if "template" not in m.lower() and "example" not in m.lower()]
        _record(cat, f"No committed secrets ({pattern})",
                len(real_secrets) == 0,
                f"found: {real_secrets}" if real_secrets else "clean")

    # .gitignore exists and covers common patterns
    gitignore_path = os.path.join(REPO_ROOT, ".gitignore")
    if os.path.exists(gitignore_path):
        with open(gitignore_path, "r") as f:
            content = f.read()
        _record(cat, ".gitignore covers .env", ".env" in content, "")
        _record(cat, ".gitignore covers node_modules", "node_modules" in content, "")
    else:
        _record(cat, ".gitignore exists", False, "missing!")

    # Security rotation checklist exists and is complete
    _record(cat, "Security rotation documented",
            _file_contains("docs/SECURITY_ROTATION_CHECKLIST.md", "rotation"), "")

    # Nginx security headers configured
    _record(cat, "Nginx X-Frame-Options configured",
            _file_contains("nginx.conf", "X-Frame-Options"), "")
    _record(cat, "Nginx X-Content-Type-Options configured",
            _file_contains("nginx.conf", "X-Content-Type-Options"), "")
    _record(cat, "Nginx blocks hidden files",
            _file_contains("nginx.conf", "deny all"), "")

    # Dockerfile runs as non-root
    dockerfile_path = os.path.join(REPO_ROOT, "docker", "python-ai", "Dockerfile")
    if os.path.exists(dockerfile_path):
        with open(dockerfile_path, "r") as f:
            content = f.read()
        _record(cat, "Dockerfile uses non-root user", "USER appuser" in content, "")
        _record(cat, "Dockerfile has HEALTHCHECK", "HEALTHCHECK" in content, "")
    else:
        _record(cat, "Dockerfile exists", False, "docker/python-ai/Dockerfile not found")


# ---------------------------------------------------------------------------
# Category 3: Docker Compose Variant Parity
# ---------------------------------------------------------------------------
def check_compose_variants():
    cat = "compose-parity"
    variants = {
        "docker-compose.yml": "Production",
        "docker-compose.local.yml": "Local dev",
        "docker-compose.selfhost.yml": "Self-host",
        "docker-compose.aws.yml": "AWS",
    }
    required_services = ["unified-api", "mcp-server", "java-runner", "react-frontend"]

    for filename, label in variants.items():
        path = os.path.join(REPO_ROOT, filename)
        if not os.path.exists(path):
            _record(cat, f"{label} compose exists", False, filename)
            continue
        _record(cat, f"{label} compose exists", True, filename)

        with open(path, "r") as f:
            content = f.read()
        for svc in required_services:
            _record(cat, f"{label} defines {svc}",
                    f"  {svc}:" in content or f"  {svc} :" in content, "")

    # Selfhost has resource limits
    if _exists("docker-compose.selfhost.yml"):
        _record(cat, "Selfhost defines resource limits",
                _file_contains("docker-compose.selfhost.yml", "deploy"), "")

    # Production has restart policy
    if _exists("docker-compose.yml"):
        _record(cat, "Production has restart policy",
                _file_contains("docker-compose.yml", "restart"), "")

    # AWS has CloudWatch logging
    if _exists("docker-compose.aws.yml"):
        _record(cat, "AWS has CloudWatch logging",
                _file_contains("docker-compose.aws.yml", "awslogs"), "")


# ---------------------------------------------------------------------------
# Category 4: Database Migration Consistency
# ---------------------------------------------------------------------------
def check_migrations():
    cat = "migrations"
    migration_dir = os.path.join(REPO_ROOT, "database-migrations")
    if not os.path.isdir(migration_dir):
        _record(cat, "Migration directory exists", False, "database-migrations/ not found")
        return

    sql_files = sorted(
        f for f in os.listdir(migration_dir) if f.endswith(".sql")
    )
    _record(cat, "Migration files present", len(sql_files) > 0, f"count={len(sql_files)}")

    # Check numbered migrations are sequential
    numbered = [f for f in sql_files if re.match(r"^\d{3}_", f)]
    numbers = [int(f[:3]) for f in numbered]
    if numbers:
        gaps = []
        for i in range(1, max(numbers) + 1):
            if i not in numbers:
                gaps.append(i)
        _record(cat, "No gaps in numbered migrations",
                len(gaps) == 0, f"gaps={gaps}" if gaps else f"1-{max(numbers)} complete")

    # Each migration is valid SQL (basic check: not empty)
    for f in sql_files:
        path = os.path.join(migration_dir, f)
        size = os.path.getsize(path)
        _record(cat, f"{f} is non-empty", size > 0, f"size={size}B")


# ---------------------------------------------------------------------------
# Category 5: Service Health (live checks)
# ---------------------------------------------------------------------------
def check_service_health():
    cat = "service-health"
    endpoints = [
        ("unified-api /health", f"{API_BASE}/health"),
        ("mcp-server /mcp/health", f"{MCP_BASE}/mcp/health"),
        ("java-runner /health", f"{RUNNER_BASE}/health"),
        ("react-frontend /", f"{FRONTEND_BASE}/"),
    ]
    for label, url in endpoints:
        status = _get(url)
        _record(cat, f"{label} returns 200", status == 200,
                f"status={status}" + (" (service may not be running)" if status == 0 else ""))


# ---------------------------------------------------------------------------
# Category 6: Operational Readiness
# ---------------------------------------------------------------------------
def check_operational_readiness():
    cat = "ops-readiness"

    # Runbook covers key topics
    topics = [
        ("runbook.md", "circuit breaker", "Circuit breaker documented"),
        ("runbook.md", "retry", "Retry strategy documented"),
        ("runbook.md", "alerting", "Alerting matrix documented"),
        ("runbook.md", "playbook", "Failure playbooks documented"),
        ("SELF_HOST_RUNBOOK.md", "backup", "Backup procedure documented"),
        ("SELF_HOST_RUNBOOK.md", "restore", "Restore procedure documented"),
        ("SELF_HOST_RUNBOOK.md", "rollback", "Rollback procedure documented"),
        ("SELF_HOST_RUNBOOK.md", "upgrade", "Upgrade procedure documented"),
        ("SELF_HOST_RUNBOOK.md", "license", "Licensing documented"),
    ]
    for filename, keyword, label in topics:
        _record(cat, label,
                _file_contains(f"docs/{filename}", keyword),
                f"docs/{filename}")

    # Phase implementation docs exist
    for phase in range(1, 5):
        _record(cat, f"Phase {phase} implementation doc exists",
                _exists(f"release/PHASE{phase}_IMPLEMENTATION.md"), "")

    # Test suites present
    test_files = [
        ("tests/smoke_release_phase1.py", "Phase 1 smoke tests"),
        ("tests/test_migrations.py", "Phase 2 migration tests"),
        ("tests/test_contracts.py", "Phase 2 contract tests"),
        ("tests/test_phase2_integration.py", "Phase 2 integration tests"),
        ("tests/test_e2e_user_journey.py", "Phase 3 E2E tests"),
        ("tests/test_mcp_stress.py", "Phase 3 MCP stress tests"),
        ("tests/test_performance_baseline.py", "Phase 3 performance tests"),
        ("tests/test_operational_monitoring.py", "Phase 4 monitoring tests"),
        ("tests/test_backup_restore_drill.py", "Phase 4 backup drill"),
        ("tests/test_rollback_drill.py", "Phase 4 rollback drill"),
        ("tests/test_incident_playbooks.py", "Phase 4 incident playbooks"),
    ]
    for path, label in test_files:
        _record(cat, f"{label} exist", _exists(path), path)


# ---------------------------------------------------------------------------
# Category 7: CI/CD Pipeline
# ---------------------------------------------------------------------------
def check_cicd():
    cat = "cicd"
    workflows = [
        (".github/workflows/phase1-smoke.yml", "Phase 1 CI workflow"),
        (".github/workflows/phase2-quality-gates.yml", "Phase 2 CI workflow"),
        (".github/workflows/phase3-beta-gate.yml", "Phase 3 CI workflow"),
        (".github/workflows/phase4-pre-ga.yml", "Phase 4 CI workflow"),
    ]
    for path, label in workflows:
        _record(cat, f"{label} exists", _exists(path), path)


# ---------------------------------------------------------------------------
# Category 8: Release Artifacts
# ---------------------------------------------------------------------------
def check_release_artifacts():
    cat = "release-artifacts"

    _record(cat, "release/ directory exists", _exists("release/"), "")
    _record(cat, "Selfhost handoff package exists",
            _exists("release/selfhost-handoff/"), "")

    # Selfhost package has required files
    selfhost_files = [
        "docker-compose.selfhost.yml",
        "SELF_HOST_RUNBOOK.md",
    ]
    for f in selfhost_files:
        path = f"release/selfhost-handoff/{f}"
        _record(cat, f"Selfhost package includes {f}", _exists(path), "")

    # Contracts exist
    _record(cat, "Contract schemas present",
            _exists("contracts/schemas/"), "")
    _record(cat, "Golden contract examples present",
            _exists("contracts/golden/") or _exists("contracts/examples/"), "")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("Phase 4  GA Launch Checklist")
    print("=" * 60)

    sections = [
        ("1. Documentation", check_documentation),
        ("2. Security", check_security),
        ("3. Docker Compose Variants", check_compose_variants),
        ("4. Database Migrations", check_migrations),
        ("5. Service Health", check_service_health),
        ("6. Operational Readiness", check_operational_readiness),
        ("7. CI/CD Pipeline", check_cicd),
        ("8. Release Artifacts", check_release_artifacts),
    ]

    for title, fn in sections:
        print(f"\n--- {title} ---")
        fn()

    # Summary
    passed = sum(1 for r in results if r["passed"])
    failed = sum(1 for r in results if not r["passed"])
    total = len(results)

    print(f"\n{'=' * 60}")
    print(f"Launch Checklist: {passed}/{total} passed, {failed} failed")
    if failed > 0:
        print(f"\nBLOCKERS ({failed} items must be resolved before GA):")
        for r in results:
            if not r["passed"]:
                print(f"  - [{r['category']}] {r['item']}")
                if r["detail"]:
                    print(f"    {r['detail']}")

    report = {
        "phase": "phase4-launch-checklist",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "summary": {"total": total, "passed": passed, "failed": failed},
        "results": results,
    }
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport written to {REPORT_PATH}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
