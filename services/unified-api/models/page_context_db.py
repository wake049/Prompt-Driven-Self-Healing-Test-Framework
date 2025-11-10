"""
🗄️ Page Context Database Models
Database models for storing user-uploaded page contexts with screenshots and descriptions.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, String, Text, DateTime, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID
import uuid

Base = declarative_base()

class PageContextDB(Base):
    """Database model for page contexts"""
    __tablename__ = "page_contexts"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Page identification
    page_url = Column(String(500), nullable=True, index=True)
    domain_name = Column(String(100), nullable=True, index=True)
    page_title = Column(String(200), nullable=True)
    
    # Page classification
    page_type = Column(String(50), nullable=True, index=True)
    page_description = Column(Text, nullable=True)
    
    # Screenshot and visual context
    screenshot_url = Column(String(500), nullable=True)
    screenshot_filename = Column(String(200), nullable=True)
    screenshot_path = Column(String(500), nullable=True)
    screenshot_analysis = Column(Text, nullable=True)
    
    # User guidance
    primary_actions = Column(JSON, nullable=True)  # List of strings
    key_elements = Column(JSON, nullable=True)    # List of strings
    user_notes = Column(Text, nullable=True)
    testing_focus = Column(String(500), nullable=True)
    
    # Auto-detection results
    detected_frameworks = Column(JSON, nullable=True)  # List of strings
    detected_patterns = Column(JSON, nullable=True)    # List of strings
    
    # Metadata
    user_uploaded = Column(Boolean, default=False)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Usage tracking
    usage_count = Column(String(20), default="0")  # How many times this context was used
    last_used = Column(DateTime, nullable=True)
    
    def to_page_context(self):
        """Convert to PageContext model"""
        from schemas.enterprise import PageContext
        
        return PageContext(
            page_type=self.page_type,
            page_title=self.page_title,
            page_description=self.page_description,
            screenshot_url=self.screenshot_url,
            screenshot_filename=self.screenshot_filename,
            screenshot_analysis=self.screenshot_analysis,
            domain_name=self.domain_name,
            primary_actions=self.primary_actions or [],
            key_elements=self.key_elements or [],
            detected_frameworks=self.detected_frameworks or [],
            detected_patterns=self.detected_patterns or [],
            user_notes=self.user_notes,
            testing_focus=self.testing_focus,
            user_uploaded=self.user_uploaded,
            created_at=self.created_at.isoformat() if self.created_at else None,
            updated_at=self.updated_at.isoformat() if self.updated_at else None,
            created_by=self.created_by
        )

class PageContextRepository:
    """Repository for page context database operations"""
    
    def __init__(self, db_session):
        self.db = db_session
    
    async def create_context(self, page_context_data: dict) -> PageContextDB:
        """Create a new page context"""
        context = PageContextDB(**page_context_data)
        self.db.add(context)
        await self.db.commit()
        await self.db.refresh(context)
        return context
    
    async def get_context_by_url(self, page_url: str) -> Optional[PageContextDB]:
        """Get page context by URL"""
        return await self.db.query(PageContextDB).filter(
            PageContextDB.page_url == page_url
        ).first()
    
    async def get_context_by_domain(self, domain: str) -> List[PageContextDB]:
        """Get all contexts for a domain"""
        return await self.db.query(PageContextDB).filter(
            PageContextDB.domain_name == domain
        ).all()
    
    async def get_user_contexts(self, user_id: str) -> List[PageContextDB]:
        """Get all contexts created by a user"""
        return await self.db.query(PageContextDB).filter(
            PageContextDB.created_by == user_id
        ).order_by(PageContextDB.created_at.desc()).all()
    
    async def update_context(self, context_id: str, updates: dict) -> Optional[PageContextDB]:
        """Update an existing context"""
        context = await self.db.query(PageContextDB).filter(
            PageContextDB.id == context_id
        ).first()
        
        if context:
            for key, value in updates.items():
                setattr(context, key, value)
            context.updated_at = datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(context)
        
        return context
    
    async def delete_context(self, context_id: str) -> bool:
        """Delete a context"""
        context = await self.db.query(PageContextDB).filter(
            PageContextDB.id == context_id
        ).first()
        
        if context:
            await self.db.delete(context)
            await self.db.commit()
            return True
        return False
    
    async def increment_usage(self, context_id: str):
        """Increment usage count for a context"""
        context = await self.db.query(PageContextDB).filter(
            PageContextDB.id == context_id
        ).first()
        
        if context:
            context.usage_count = str(int(context.usage_count or "0") + 1)
            context.last_used = datetime.utcnow()
            await self.db.commit()
    
    async def search_contexts(self, query: str, page_type: Optional[str] = None) -> List[PageContextDB]:
        """Search contexts by description or notes"""
        filters = []
        
        # Text search
        if query:
            filters.append(
                PageContextDB.page_description.ilike(f"%{query}%") |
                PageContextDB.user_notes.ilike(f"%{query}%") |
                PageContextDB.page_title.ilike(f"%{query}%")
            )
        
        # Page type filter
        if page_type:
            filters.append(PageContextDB.page_type == page_type)
        
        query_obj = self.db.query(PageContextDB)
        if filters:
            query_obj = query_obj.filter(*filters)
        
        return await query_obj.order_by(PageContextDB.created_at.desc()).limit(50).all()