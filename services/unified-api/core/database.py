"""
Unified Database Manager
Consolidates database connections for all services
"""

import asyncio
import asyncpg
import logging
import os
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Unified database connection manager"""
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self._connection_config = {
            "host": os.getenv("DB_HOST", "localhost"),
            "port": int(os.getenv("DB_PORT", "5432")),
            "database": os.getenv("DB_NAME", "testframework_db"),
            "user": os.getenv("DB_USER", "testframework"),
            "password": os.getenv("DB_PASSWORD", "securepassword"),
            "min_size": int(os.getenv("DB_POOL_MIN", "5")),
            "max_size": int(os.getenv("DB_POOL_MAX", "20")),
            "command_timeout": int(os.getenv("DB_TIMEOUT", "60"))
        }
        
        # Debug logging to see what values are being used
        logger.info(f" Database config: host={self._connection_config['host']}, "
                   f"port={self._connection_config['port']}, "
                   f"database={self._connection_config['database']}, "
                   f"user={self._connection_config['user']}")
    
    async def initialize(self) -> None:
        """Initialize database connection pool"""
        try:
            logger.info("🔌 Initializing database connection pool...")
            
            self.pool = await asyncpg.create_pool(
                host=self._connection_config["host"],
                port=self._connection_config["port"],
                database=self._connection_config["database"],
                user=self._connection_config["user"],
                password=self._connection_config["password"],
                min_size=self._connection_config["min_size"],
                max_size=self._connection_config["max_size"],
                command_timeout=self._connection_config["command_timeout"]
            )
            
            # Test connection
            async with self.pool.acquire() as conn:
                await conn.execute("SELECT 1")
            
            logger.info(" Database connection pool initialized successfully")
            
        except Exception as e:
            logger.error(f" Failed to initialize database pool: {e}")
            raise
    
    async def close(self) -> None:
        """Close database connection pool"""
        if self.pool:
            logger.info("🔌 Closing database connection pool...")
            await self.pool.close()
            self.pool = None
            logger.info(" Database connection pool closed")
    
    @asynccontextmanager
    async def get_connection(self):
        """Get a database connection from the pool"""
        if not self.pool:
            raise RuntimeError("Database pool not initialized")
        
        async with self.pool.acquire() as conn:
            yield conn
    
    async def execute(self, query: str, *args) -> List[Dict[str, Any]]:
        """Execute a query and return results"""
        async with self.get_connection() as conn:
            result = await conn.fetch(query, *args)
            return [dict(row) for row in result]
    
    async def execute_one(self, query: str, *args) -> Optional[Dict[str, Any]]:
        """Execute a query and return one result"""
        async with self.get_connection() as conn:
            result = await conn.fetchrow(query, *args)
            return dict(result) if result else None
    
    async def execute_scalar(self, query: str, *args) -> Any:
        """Execute a query and return a scalar value"""
        async with self.get_connection() as conn:
            return await conn.fetchval(query, *args)
    
    async def execute_command(self, query: str, *args) -> str:
        """Execute a command (INSERT, UPDATE, DELETE)"""
        async with self.get_connection() as conn:
            return await conn.execute(query, *args)
    
    async def health_check(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            if not self.pool:
                return {"status": "unhealthy", "error": "Pool not initialized"}
            
            async with self.get_connection() as conn:
                result = await conn.fetchval("SELECT 1")
                
                # Get basic pool info without unsupported methods
                pool_info = {
                    "min_size": self._connection_config["min_size"],
                    "max_size": self._connection_config["max_size"],
                    "initialized": True
                }
                
                return {
                    "status": "healthy",
                    "connection_test": result == 1,
                    "pool_info": pool_info,
                    "config": {
                        "host": self._connection_config["host"],
                        "port": self._connection_config["port"],
                        "database": self._connection_config["database"],
                        "user": self._connection_config["user"]
                    }
                }
        
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }

# Global database manager instance
_db_manager: Optional[DatabaseManager] = None

async def get_database_manager() -> DatabaseManager:
    """Get the global database manager instance"""
    global _db_manager
    
    if _db_manager is None or _db_manager.pool is None:
        logger.info("🔌 Database manager not initialized, creating new instance...")
        _db_manager = DatabaseManager()
        await _db_manager.initialize()
        logger.info(" Database manager initialized")
    else:
        # Test if the pool is still working
        try:
            async with _db_manager.pool.acquire() as conn:
                await conn.execute("SELECT 1")
        except Exception as e:
            logger.info(f"🔌 Database pool test failed ({e}), reinitializing...")
            _db_manager = DatabaseManager()
            await _db_manager.initialize()
            logger.info(" Database manager reinitialized")
    
    return _db_manager

async def get_database():
    """Dependency function to get database manager"""
    return await get_database_manager()

async def close_database():
    """Close the global database manager"""
    global _db_manager
    
    if _db_manager:
        await _db_manager.close()
        _db_manager = None