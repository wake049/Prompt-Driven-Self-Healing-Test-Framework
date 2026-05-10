#!/usr/bin/env python3
"""
Database Migration Runner
Executes SQL migration files in order against the PostgreSQL database.
"""

import asyncio
import asyncpg
import os
from pathlib import Path
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
REPO_ROOT = Path(__file__).resolve().parent
load_dotenv(REPO_ROOT / ".env", override=True)

# Database configuration from environment
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "testframework_db")
DB_USER = os.getenv("DB_USER", "testframework")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not DB_PASSWORD:
    raise RuntimeError("DB_PASSWORD environment variable must be set")

MIGRATIONS_DIR = REPO_ROOT / "database-migrations"


async def run_migrations():
    """Run all SQL migrations in order"""
    
    # Connect to database
    try:
        conn = await asyncpg.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        logger.info(f"✓ Connected to database: {DB_HOST}:{DB_PORT}/{DB_NAME}")
    except Exception as e:
        logger.error(f"✗ Failed to connect to database: {e}")
        raise
    
    try:
        # Get all migration files sorted by name
        migration_files = sorted([
            f for f in MIGRATIONS_DIR.glob("*.sql") 
            if f.is_file()
        ])
        
        if not migration_files:
            logger.warning("No migration files found")
            return
        
        logger.info(f"Found {len(migration_files)} migration files")
        
        # Execute each migration
        for migration_file in migration_files:
            try:
                logger.info(f"\n{'='*60}")
                logger.info(f"Running: {migration_file.name}")
                logger.info(f"{'='*60}")
                
                # Read migration SQL
                with open(migration_file, 'r') as f:
                    sql_content = f.read()
                
                # Execute migration
                await conn.execute(sql_content)
                logger.info(f"✓ Completed: {migration_file.name}")
                
            except Exception as e:
                logger.error(f"✗ Failed to execute {migration_file.name}: {e}")
                raise
        
        logger.info(f"\n{'='*60}")
        logger.info("✓ All migrations completed successfully!")
        logger.info(f"{'='*60}\n")
        
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run_migrations())
