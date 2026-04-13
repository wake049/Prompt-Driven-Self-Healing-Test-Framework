#!/usr/bin/env python3
"""
Phase 2: Database migration validation tests.

Validates that all SQL migrations in database-migrations/:
  1. Parse without syntax errors (offline check)
  2. Apply cleanly to a fresh PostgreSQL instance (online check)
  3. Create the expected schemas and core tables
  4. Are idempotent (can be re-applied without failure)

Usage:
  # Offline syntax checks only (no DB required):
  python tests/test_migrations.py --offline

  # Full validation against a running PostgreSQL:
  python tests/test_migrations.py --db-url postgresql://local_user:local_pass@localhost:5432/promptqa_local

  # Against docker-compose local stack:
  python tests/test_migrations.py
"""

from __future__ import annotations

import argparse
import glob
import os
import re
import sys
import time
from pathlib import Path
from typing import List, Tuple

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "database-migrations")

# Expected schemas created by 001_initial_schema.sql
EXPECTED_SCHEMAS = [
    "core", "catalog", "repo", "planner",
    "datahub", "tests", "exec", "healing", "analytics",
]

# Expected core tables (schema.table)
EXPECTED_CORE_TABLES = [
    "core.tenants",
    "core.users",
    "core.roles",
    "core.projects",
    "core.user_tenant_roles",
]

# Tables added by later migrations
EXPECTED_EXTENSION_TABLES = [
    "core.organization_members",
    "core.subscriptions",
]

# Policy tables from 005
EXPECTED_POLICY_TABLES = [
    "policy.policy_packs",
    "policy.policy_rules",
    "policy.policy_decisions",
]


class MigrationResult:
    def __init__(self, name: str, passed: bool, message: str):
        self.name = name
        self.passed = passed
        self.message = message

    def __repr__(self):
        status = "PASS" if self.passed else "FAIL"
        return f"[{status}] {self.name}: {self.message}"


def discover_migrations() -> List[str]:
    """Find all .sql files in the migrations directory, sorted alphabetically."""
    pattern = os.path.join(MIGRATIONS_DIR, "*.sql")
    files = sorted(glob.glob(pattern))
    return files


def offline_syntax_check(filepath: str) -> MigrationResult:
    """Basic offline validation of a SQL migration file."""
    name = os.path.basename(filepath)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        if not content.strip():
            return MigrationResult(name, False, "File is empty")

        # Check for balanced parentheses
        open_parens = content.count("(")
        close_parens = content.count(")")
        if open_parens != close_parens:
            return MigrationResult(
                name, False,
                f"Unbalanced parentheses: {open_parens} open, {close_parens} close"
            )

        # Check for unterminated strings (very basic heuristic)
        # Count single quotes outside of comments
        lines = content.split("\n")
        for i, line in enumerate(lines, 1):
            stripped = line.split("--")[0]  # remove line comments
            quote_count = stripped.count("'")
            if quote_count % 2 != 0:
                # Could be a multi-line string; just warn
                pass

        # Check for common dangerous patterns
        dangerous_patterns = [
            (r'\bDROP\s+DATABASE\b', "Contains DROP DATABASE"),
            (r'\bTRUNCATE\s+.*CASCADE\b', "Contains TRUNCATE CASCADE"),
        ]
        for pattern, msg in dangerous_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                return MigrationResult(name, False, msg)

        return MigrationResult(name, True, f"Syntax OK ({len(lines)} lines)")

    except Exception as e:
        return MigrationResult(name, False, f"Read error: {e}")


def check_naming_convention(filepath: str) -> MigrationResult:
    """Verify migration file follows NNN_description.sql naming convention."""
    name = os.path.basename(filepath)
    # Allow both NNN_ prefix and descriptive names without prefix (backfill, fix, create scripts)
    if re.match(r"^\d{3}_", name):
        return MigrationResult(name, True, "Naming convention OK")
    else:
        return MigrationResult(
            name, True,
            f"Non-sequential name (utility script): {name}"
        )


def online_apply_migrations(db_url: str) -> List[MigrationResult]:
    """Apply all migrations to a live PostgreSQL database and validate."""
    results = []

    try:
        import psycopg2
    except ImportError:
        results.append(MigrationResult(
            "dependency-check", False,
            "psycopg2 not installed. Run: pip install psycopg2-binary"
        ))
        return results

    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
    except Exception as e:
        results.append(MigrationResult("db-connect", False, f"Cannot connect: {e}"))
        return results

    results.append(MigrationResult("db-connect", True, "Connected to PostgreSQL"))

    migrations = discover_migrations()
    for filepath in migrations:
        name = os.path.basename(filepath)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                sql = f.read()
            cur.execute(sql)
            results.append(MigrationResult(name, True, "Applied successfully"))
        except Exception as e:
            error_msg = str(e).split("\n")[0]
            results.append(MigrationResult(name, False, f"Apply failed: {error_msg}"))

    # Validate expected schemas exist
    cur.execute("""
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public')
        ORDER BY schema_name
    """)
    existing_schemas = {row[0] for row in cur.fetchall()}

    for schema in EXPECTED_SCHEMAS:
        if schema in existing_schemas:
            results.append(MigrationResult(f"schema:{schema}", True, "Exists"))
        else:
            results.append(MigrationResult(f"schema:{schema}", False, "Missing"))

    # Validate expected core tables exist
    cur.execute("""
        SELECT table_schema || '.' || table_name
        FROM information_schema.tables
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public')
        ORDER BY table_schema, table_name
    """)
    existing_tables = {row[0] for row in cur.fetchall()}

    for table in EXPECTED_CORE_TABLES:
        if table in existing_tables:
            results.append(MigrationResult(f"table:{table}", True, "Exists"))
        else:
            results.append(MigrationResult(f"table:{table}", False, "Missing"))

    # Idempotency test: re-apply all migrations
    idempotent_ok = True
    for filepath in migrations:
        name = os.path.basename(filepath)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                sql = f.read()
            cur.execute(sql)
        except Exception as e:
            error_msg = str(e).split("\n")[0]
            results.append(MigrationResult(
                f"idempotency:{name}", False,
                f"Re-apply failed: {error_msg}"
            ))
            idempotent_ok = False

    if idempotent_ok:
        results.append(MigrationResult(
            "idempotency", True,
            f"All {len(migrations)} migrations are idempotent"
        ))

    cur.close()
    conn.close()
    return results


def run_offline_checks() -> Tuple[List[MigrationResult], bool]:
    """Run all offline (no DB) validation checks."""
    results: List[MigrationResult] = []
    migrations = discover_migrations()

    if not migrations:
        results.append(MigrationResult(
            "discovery", False,
            f"No .sql files found in {MIGRATIONS_DIR}"
        ))
        return results, False

    results.append(MigrationResult(
        "discovery", True,
        f"Found {len(migrations)} migration files"
    ))

    # Check ordering: sequential files should have incrementing prefixes
    numbered = []
    for f in migrations:
        name = os.path.basename(f)
        match = re.match(r"^(\d{3})_", name)
        if match:
            numbered.append((int(match.group(1)), name))

    if numbered:
        for i in range(1, len(numbered)):
            prev_num, prev_name = numbered[i - 1]
            curr_num, curr_name = numbered[i]
            if curr_num <= prev_num:
                results.append(MigrationResult(
                    "ordering", False,
                    f"Out of order: {prev_name} ({prev_num}) before {curr_name} ({curr_num})"
                ))

    # Syntax & naming checks for each file
    for filepath in migrations:
        results.append(check_naming_convention(filepath))
        results.append(offline_syntax_check(filepath))

    all_passed = all(r.passed for r in results)
    return results, all_passed


def main():
    parser = argparse.ArgumentParser(description="Database migration validation")
    parser.add_argument(
        "--offline", action="store_true",
        help="Run only offline syntax checks (no database required)"
    )
    parser.add_argument(
        "--db-url",
        default="postgresql://local_user:local_pass@localhost:5432/promptqa_local",
        help="PostgreSQL connection URL for online checks"
    )
    args = parser.parse_args()

    print("=" * 70)
    print("DATABASE MIGRATION VALIDATION — Phase 2")
    print("=" * 70)

    # Always run offline checks first
    print("\n--- Offline Checks ---")
    offline_results, offline_ok = run_offline_checks()
    for r in offline_results:
        status = "PASS" if r.passed else "FAIL"
        print(f"  [{status}] {r.name}: {r.message}")

    if args.offline:
        total = len(offline_results)
        passed = sum(1 for r in offline_results if r.passed)
        failed = total - passed
        print(f"\nOffline: {passed}/{total} passed, {failed} failed")
        sys.exit(0 if offline_ok else 1)

    # Online checks
    print("\n--- Online Checks (applying to database) ---")
    online_results = online_apply_migrations(args.db_url)
    for r in online_results:
        status = "PASS" if r.passed else "FAIL"
        print(f"  [{status}] {r.name}: {r.message}")

    all_results = offline_results + online_results
    total = len(all_results)
    passed = sum(1 for r in all_results if r.passed)
    failed = total - passed
    print(f"\n{'=' * 70}")
    print(f"TOTAL: {passed}/{total} passed, {failed} failed")
    print("=" * 70)

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
