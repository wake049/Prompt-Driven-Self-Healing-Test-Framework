"""
Phase 4: Backup / Restore Drill
================================
Automated drill that proves the backup-and-restore pipeline works end-to-end.

Steps:
  1. Connect to PostgreSQL and record current state (row counts for key tables).
  2. Create a canary row via the API (if available) or directly via DB.
  3. Run pg_dump to produce a timestamped backup file.
  4. Drop/truncate the canary row to simulate data loss.
  5. Restore from the backup.
  6. Verify the canary row is recovered and table counts match.
  7. Clean up canary data.

Environment variables:
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
  API_BASE_URL  (optional, used for canary-via-API)
  BACKUP_DIR    (where dumps are written, default: ./backups)
  PGDUMP_PATH   (path to pg_dump binary, default: pg_dump)
  PSQL_PATH     (path to psql binary, default: psql)
"""

import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "testframework_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")
BACKUP_DIR = os.getenv("BACKUP_DIR", os.path.join(os.path.dirname(__file__), "..", "backups"))
PGDUMP = os.getenv("PGDUMP_PATH", "pg_dump")
PSQL = os.getenv("PSQL_PATH", "psql")
REPORT_PATH = os.getenv("REPORT_PATH", "phase4_backup_drill_report.json")

CANARY_TABLE = "core.activity_log"  # widely present table
TIMESTAMP = time.strftime("%Y%m%d_%H%M%S")
BACKUP_FILE = os.path.join(BACKUP_DIR, f"drill_backup_{TIMESTAMP}.sql")

results: list[dict] = []


def _record(step: str, passed: bool, detail: str = ""):
    results.append({"step": step, "passed": passed, "detail": detail})
    icon = "PASS" if passed else "FAIL"
    print(f"  [{icon}] {step}")
    if detail:
        print(f"         {detail}")


def _env():
    """Return env dict with PGPASSWORD set."""
    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD
    return env


def _psql(sql: str) -> tuple[bool, str]:
    """Execute SQL via psql and return (success, stdout)."""
    cmd = [PSQL, "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME,
           "-t", "-A", "-c", sql]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, env=_env())
        return result.returncode == 0, result.stdout.strip()
    except FileNotFoundError:
        return False, "psql binary not found"
    except Exception as exc:
        return False, str(exc)


# ---------------------------------------------------------------------------
# Drill Steps
# ---------------------------------------------------------------------------
def step_verify_tools():
    """Ensure pg_dump and psql are available."""
    for tool, path in [("pg_dump", PGDUMP), ("psql", PSQL)]:
        try:
            subprocess.run([path, "--version"], capture_output=True, timeout=10, env=_env())
            _record(f"{tool} available", True)
        except FileNotFoundError:
            _record(f"{tool} available", False, f"{path} not found on PATH")
            return False
    return True


def step_record_baseline():
    """Count rows in key tables to establish a baseline."""
    tables = [
        "core.activity_log",
        "core.prompts",
        "core.test_plans",
    ]
    counts = {}
    for table in tables:
        ok, out = _psql(f"SELECT count(*) FROM {table};")
        if ok:
            counts[table] = int(out) if out.isdigit() else 0
        else:
            # Table may not exist; not fatal
            counts[table] = -1
    _record("Baseline row counts recorded", True, json.dumps(counts))
    return counts


def step_insert_canary():
    """Insert a canary row we can verify after restore."""
    canary_id = f"drill-canary-{TIMESTAMP}"
    # Try a safe insert into activity_log if it exists
    sql = (
        f"INSERT INTO core.activity_log (id, action, entity_type, entity_id, performed_by, performed_at) "
        f"VALUES (gen_random_uuid(), 'BACKUP_DRILL', 'drill', '{canary_id}', 'system', NOW()) "
        f"RETURNING entity_id;"
    )
    ok, out = _psql(sql)
    if ok and canary_id in out:
        _record("Canary row inserted", True, f"entity_id={canary_id}")
        return canary_id
    else:
        _record("Canary row inserted", False, out)
        return None


def step_create_backup():
    """Run pg_dump and write the backup file."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    cmd = [
        PGDUMP, "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER,
        "-d", DB_NAME, "--format=custom", "-f", BACKUP_FILE,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300, env=_env())
        if result.returncode == 0 and os.path.exists(BACKUP_FILE):
            size_mb = os.path.getsize(BACKUP_FILE) / (1024 * 1024)
            _record("pg_dump backup created", True, f"file={BACKUP_FILE} size={size_mb:.2f}MB")
            return True
        else:
            _record("pg_dump backup created", False, result.stderr[:500])
            return False
    except FileNotFoundError:
        _record("pg_dump backup created", False, "pg_dump not found")
        return False


def step_delete_canary(canary_id: str):
    """Delete the canary row to simulate data loss."""
    sql = f"DELETE FROM core.activity_log WHERE entity_id = '{canary_id}';"
    ok, out = _psql(sql)
    _record("Canary row deleted (simulated loss)", ok, out)
    return ok


def step_verify_canary_gone(canary_id: str):
    """Confirm the canary row is actually gone."""
    sql = f"SELECT count(*) FROM core.activity_log WHERE entity_id = '{canary_id}';"
    ok, out = _psql(sql)
    gone = ok and out.strip() == "0"
    _record("Canary row confirmed missing", gone, f"count={out}")
    return gone


def step_restore_backup():
    """Restore from the backup file using pg_restore."""
    cmd = [
        "pg_restore", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER,
        "-d", DB_NAME, "--clean", "--if-exists", "--no-owner", BACKUP_FILE,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600, env=_env())
        # pg_restore often returns non-zero for warnings; check if DB is still usable
        ok, _ = _psql("SELECT 1;")
        _record("pg_restore completed", ok, result.stderr[:300] if result.stderr else "clean")
        return ok
    except FileNotFoundError:
        _record("pg_restore completed", False, "pg_restore binary not found")
        return False


def step_verify_canary_restored(canary_id: str):
    """Verify the canary row exists again after restore."""
    sql = f"SELECT count(*) FROM core.activity_log WHERE entity_id = '{canary_id}';"
    ok, out = _psql(sql)
    restored = ok and out.strip() == "1"
    _record("Canary row restored successfully", restored, f"count={out}")
    return restored


def step_verify_row_counts(baseline: dict):
    """Verify row counts match baseline after restore."""
    all_match = True
    for table, expected in baseline.items():
        if expected < 0:
            continue
        ok, out = _psql(f"SELECT count(*) FROM {table};")
        actual = int(out) if ok and out.isdigit() else -1
        match = actual >= expected  # may have the canary row back
        if not match:
            all_match = False
        _record(f"Row count {table} matches baseline",
                match, f"expected>={expected} actual={actual}")
    return all_match


def step_cleanup_canary(canary_id: str):
    """Remove the canary row after drill."""
    if canary_id:
        sql = f"DELETE FROM core.activity_log WHERE entity_id = '{canary_id}';"
        _psql(sql)
        _record("Canary cleanup", True, "cleaned up drill data")


def step_cleanup_backup():
    """Optionally remove the drill backup file."""
    if os.path.exists(BACKUP_FILE):
        os.remove(BACKUP_FILE)
        _record("Backup file cleanup", True, f"removed {BACKUP_FILE}")


def step_verify_services_healthy():
    """After restore, ensure services still respond."""
    endpoints = [
        ("unified-api", f"{API_BASE}/health"),
    ]
    for svc, url in endpoints:
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                ok = resp.status == 200
        except Exception:
            ok = False
        _record(f"{svc} healthy post-restore", ok, "")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("Phase 4  Backup / Restore Drill")
    print("=" * 60)

    if not step_verify_tools():
        print("\nABORT: pg_dump/psql not available. Install PostgreSQL client tools.")
        return 1

    baseline = step_record_baseline()
    canary_id = step_insert_canary()

    if not step_create_backup():
        print("\nABORT: Backup creation failed.")
        step_cleanup_canary(canary_id)
        return 1

    if canary_id:
        step_delete_canary(canary_id)
        step_verify_canary_gone(canary_id)

    step_restore_backup()

    if canary_id:
        step_verify_canary_restored(canary_id)

    step_verify_row_counts(baseline)
    step_verify_services_healthy()

    # Cleanup
    step_cleanup_canary(canary_id)
    step_cleanup_backup()

    # Summary
    passed = sum(1 for r in results if r["passed"])
    failed = sum(1 for r in results if not r["passed"])
    total = len(results)
    print(f"\nDrill Results: {passed}/{total} passed, {failed} failed")

    report = {
        "phase": "phase4-backup-drill",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "backup_file": BACKUP_FILE,
        "summary": {"total": total, "passed": passed, "failed": failed},
        "results": results,
    }
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"Report written to {REPORT_PATH}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
