#!/usr/bin/env python3
"""Create missing policy-related tables"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

async def create_tables():
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST'),
        port=int(os.getenv('DB_PORT', 5432)),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD')
    )
    
    try:
        # Create policy schema if it doesn't exist
        await conn.execute("CREATE SCHEMA IF NOT EXISTS policy")
        logger.info("✓ Policy schema ready")
        
        # Create core.environments table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS core.environments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                config JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        logger.info("✓ Environments table created")
        
        # Create policy.policy_packs table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS policy.policy_packs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                pack_type VARCHAR(100),
                configurations JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        logger.info("✓ Policy Packs table created")
        
        # Create policy.policy_decisions table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS policy.policy_decisions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                pack_id UUID REFERENCES policy.policy_packs(id) ON DELETE CASCADE,
                project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
                environment_id UUID REFERENCES core.environments(id) ON DELETE SET NULL,
                decision_type VARCHAR(100),
                context JSONB DEFAULT '{}',
                outcome VARCHAR(100),
                decided_at TIMESTAMP,
                decided_by UUID,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """)
        logger.info("✓ Policy Decisions table created")
        
        logger.info("\n✅ All policy-related tables are ready!")
        
    except Exception as e:
        logger.error(f"✗ Error: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(create_tables())
