#!/usr/bin/env python3
"""Create the AI Provider Configs table"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

async def create_table():
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST'),
        port=int(os.getenv('DB_PORT', 5432)),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD')
    )
    
    try:
        # Create core schema if it doesn't exist
        await conn.execute("CREATE SCHEMA IF NOT EXISTS core")
        logger.info("✓ Core schema ready")
        
        # Create tenants table if it doesn't exist (ai_provider_configs depends on it)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS core.tenants (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                industry VARCHAR(100),
                company_size VARCHAR(50),
                website VARCHAR(255),
                logo_url VARCHAR(500),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """)
        logger.info("✓ Tenants table ready")
        
        # Create users table if it doesn't exist (ai_provider_configs depends on created_by)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS core.users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                is_admin BOOLEAN DEFAULT false,
                last_login_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """)
        logger.info("✓ Users table ready")
        
        # Now create the ai_provider_configs table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS core.ai_provider_configs (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                tenant_id UUID NOT NULL REFERENCES core.tenants(id) ON DELETE CASCADE,
                provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'ollama', 'custom')),
                provider_name VARCHAR(100),
                
                -- Encrypted credentials
                api_key_encrypted TEXT,
                api_key_last_4 VARCHAR(4),
                
                -- Configuration
                endpoint_url TEXT,
                model VARCHAR(100),
                model_version VARCHAR(50),
                temperature DECIMAL(3,2) DEFAULT 0.7,
                max_tokens INTEGER,
                
                -- Status
                is_active BOOLEAN DEFAULT true,
                is_default BOOLEAN DEFAULT false,
                is_verified BOOLEAN DEFAULT false,
                last_verified_at TIMESTAMP,
                
                -- Usage tracking
                total_requests INTEGER DEFAULT 0,
                total_tokens_used BIGINT DEFAULT 0,
                last_used_at TIMESTAMP,
                
                config_options JSONB DEFAULT '{}',
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                created_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
                
                UNIQUE(tenant_id, provider, provider_name)
            )
        """)
        logger.info("✓ AI Provider Configs table created")
        
        # Create indexes
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_ai_configs_tenant ON core.ai_provider_configs(tenant_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_ai_configs_provider ON core.ai_provider_configs(provider)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_ai_configs_active ON core.ai_provider_configs(is_active)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_ai_configs_default ON core.ai_provider_configs(tenant_id, is_default) WHERE is_default = true")
        logger.info("✓ Indexes created")
        
        # Create trigger for updated_at
        await conn.execute("""
            CREATE OR REPLACE FUNCTION update_ai_provider_configs_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """)
        
        await conn.execute("""
            DROP TRIGGER IF EXISTS update_ai_provider_configs_updated_at ON core.ai_provider_configs;
            CREATE TRIGGER update_ai_provider_configs_updated_at 
            BEFORE UPDATE ON core.ai_provider_configs
            FOR EACH ROW 
            EXECUTE FUNCTION update_ai_provider_configs_updated_at();
        """)
        logger.info("✓ Trigger created")
        
        logger.info("\n✅ AI Provider Configs table is ready!")
        
    except Exception as e:
        logger.error(f"✗ Error: {e}")
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(create_table())
