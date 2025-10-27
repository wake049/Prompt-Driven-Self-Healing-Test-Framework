"""
Repository for Page Context Database Operations
Handles all database interactions for page contexts using the new schema
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

from core.database import DatabaseManager
from schemas.enterprise import PageContext

logger = logging.getLogger(__name__)


class PageContextRepository:
    """Repository for page context database operations using the correct schema"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db = db_manager
    
    async def create_context(self, page_context_data: dict) -> dict:
        """Create a new page context in repo.page_contexts table"""
        try:
            # Generate UUID for the context
            context_id = str(uuid.uuid4())
            
            # First, ensure the page exists in repo.pages
            page_url = page_context_data.get('page_url', '')
            page_title = page_context_data.get('page_title', '')
            
            # Extract domain/page name from URL for the page name
            page_name = page_title or page_url.split('/')[-1] or 'unknown'
            
            page_result = await self.db.execute_one(
                """
                INSERT INTO repo.pages (project_id, name, route_hint, tags)
                VALUES (
                    (SELECT id FROM core.projects LIMIT 1),  -- Use first project for now
                    $1, $2, $3
                )
                ON CONFLICT (project_id, name) DO UPDATE SET updated_at = NOW()
                RETURNING id
                """,
                page_name,
                page_url,  # Use full URL as route hint
                [page_context_data.get('page_type', 'web')]  # Use page type as tag
            )
            
            page_id = page_result['id'] if page_result else None
            
            if not page_id:
                raise Exception("Failed to create or find page record")
            
            query = """
                INSERT INTO repo.page_contexts (
                    id, page_id, screenshot_url, description, category, 
                    website_url, primary_actions, usage_count, 
                    last_used_at, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            """
            
            result = await self.db.execute_one(
                query,
                context_id,
                page_id,
                page_context_data.get('screenshot_url'),
                page_context_data.get('page_description', ''),
                page_context_data.get('page_type'),
                page_context_data.get('page_url'),
                page_context_data.get('primary_actions', []),
                0,  # initial usage_count
                None,  # last_used_at
                datetime.utcnow(),
                datetime.utcnow()
            )
            
            return dict(result) if result else None
            
        except Exception as e:
            logger.error(f"Error creating page context: {e}")
            raise
    
    async def get_context_by_url(self, page_url: str) -> Optional[dict]:
        """Get page context by URL"""
        try:
            query = """
                SELECT 
                    pc.*,
                    p.name as page_name
                FROM repo.page_contexts pc
                LEFT JOIN repo.pages p ON pc.page_id = p.id
                WHERE pc.website_url = $1
                ORDER BY pc.created_at DESC
                LIMIT 1
            """
            
            result = await self.db.execute_one(query, page_url)
            return dict(result) if result else None
            
        except Exception as e:
            logger.error(f"Error getting page context by URL: {e}")
            raise
    
    async def get_contexts_by_category(self, category: str) -> List[dict]:
        """Get all contexts for a specific category/page type"""
        try:
            query = """
                SELECT * FROM repo.page_contexts 
                WHERE category = $1
                ORDER BY created_at DESC
            """
            
            results = await self.db.execute(query, category)
            return [dict(row) for row in results]
            
        except Exception as e:
            logger.error(f"Error getting contexts by category: {e}")
            raise
    
    async def get_user_contexts(self, user_id: str) -> List[dict]:
        """Get all contexts (mock implementation - no user tracking in current schema)"""
        try:
            # Since current schema doesn't have user tracking, return all recent contexts
            query = """
                SELECT * FROM repo.page_contexts 
                ORDER BY created_at DESC
                LIMIT 50
            """
            
            results = await self.db.execute(query)
            return [dict(row) for row in results]
            
        except Exception as e:
            logger.error(f"Error getting user contexts: {e}")
            raise
    
    async def update_context(self, context_id: str, updates: dict) -> Optional[dict]:
        """Update an existing context"""
        try:
            # Build dynamic update query based on provided fields
            update_fields = []
            values = []
            param_count = 1
            
            for field, value in updates.items():
                if field in ['description', 'category', 'website_url', 'primary_actions', 'screenshot_url']:
                    update_fields.append(f"{field} = ${param_count}")
                    values.append(value)
                    param_count += 1
            
            if not update_fields:
                return None
            
            # Add updated_at
            update_fields.append(f"updated_at = ${param_count}")
            values.append(datetime.utcnow())
            param_count += 1
            
            # Add context_id for WHERE clause
            values.append(context_id)
            
            query = f"""
                UPDATE repo.page_contexts 
                SET {', '.join(update_fields)}
                WHERE id = ${param_count}
                RETURNING *
            """
            
            result = await self.db.execute_one(query, *values)
            return dict(result) if result else None
            
        except Exception as e:
            logger.error(f"Error updating context: {e}")
            raise
    
    async def delete_context(self, context_id: str) -> bool:
        """Delete a context"""
        try:
            query = "DELETE FROM repo.page_contexts WHERE id = $1"
            result = await self.db.execute_command(query, context_id)
            return "DELETE 1" in result
            
        except Exception as e:
            logger.error(f"Error deleting context: {e}")
            raise
    
    async def increment_usage(self, context_id: str):
        """Increment usage count for a context"""
        try:
            query = """
                UPDATE repo.page_contexts 
                SET usage_count = usage_count + 1, 
                    last_used_at = $1,
                    updated_at = $1
                WHERE id = $2
            """
            
            await self.db.execute_command(query, datetime.utcnow(), context_id)
            
        except Exception as e:
            logger.error(f"Error incrementing usage: {e}")
            raise
    
    async def search_contexts(self, query_text: str, page_type: Optional[str] = None) -> List[dict]:
        """Search contexts by description or website URL"""
        try:
            filters = ["description ILIKE $1 OR website_url ILIKE $1"]
            params = [f"%{query_text}%"]
            
            if page_type:
                filters.append("category = $2")
                params.append(page_type)
            
            query = f"""
                SELECT * FROM repo.page_contexts 
                WHERE {' AND '.join(filters)}
                ORDER BY usage_count DESC, created_at DESC
                LIMIT 50
            """
            
            results = await self.db.execute(query, *params)
            return [dict(row) for row in results]
            
        except Exception as e:
            logger.error(f"Error searching contexts: {e}")
            raise
    
    async def get_all_contexts(self, limit: int = 100) -> List[dict]:
        """Get all page contexts with optional limit"""
        try:
            # Join with pages table to get the page name
            query = """
                SELECT 
                    pc.*,
                    p.name as page_name
                FROM repo.page_contexts pc
                LEFT JOIN repo.pages p ON pc.page_id = p.id
                ORDER BY pc.created_at DESC 
                LIMIT $1
            """
            
            results = await self.db.execute(query, limit)
            return [dict(row) for row in results]
            
        except Exception as e:
            logger.error(f"Error getting all contexts: {e}")
            raise
    
    def _convert_db_row_to_page_context(self, row: dict) -> PageContext:
        """Convert database row to PageContext object"""
        return PageContext(
            page_type=row.get('category'),
            page_title=row.get('website_url', '').split('/')[-1] if row.get('website_url') else None,
            page_description=row.get('description', ''),
            screenshot_url=row.get('screenshot_url'),
            primary_actions=row.get('primary_actions', []),
            user_uploaded=True,
            created_at=row.get('created_at').isoformat() if row.get('created_at') else None,
            updated_at=row.get('updated_at').isoformat() if row.get('updated_at') else None
        )