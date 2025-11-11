"""
 Page Context API Router
Provides endpoints for managing page context and helping AI understand website types.
Connected to repo.page_contexts table in database.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import json

from core.auth import get_current_active_user
from models.auth_models import CurrentUser

from schemas.enterprise import PageContext
from services.page_context_service import page_context_service
from services.file_upload_service import file_upload_service
from repositories.page_context_repository import PageContextRepository
from core.database import get_database

router = APIRouter()

class PageContextRequest(BaseModel):
    """Request to create page context"""
    page_url: Optional[str] = None
    page_title: Optional[str] = None
    element_selectors: Optional[List[str]] = None
    user_context: Optional[Dict[str, Any]] = None

class ManualPageContextRequest(BaseModel):
    """Request to create manual page context"""
    page_type: str
    description: str
    primary_actions: List[str]
    testing_focus: Optional[str] = None
    page_title: Optional[str] = None
    domain_name: Optional[str] = None
    user_notes: Optional[str] = None

async def get_page_context_repository():
    """Dependency to get page context repository"""
    db = await get_database()
    return PageContextRepository(db)

@router.post("/upload", response_model=Dict[str, Any])
async def upload_page_context(
    page_url: str = Form(...),
    page_title: str = Form(...),
    page_type: str = Form(...),
    page_description: str = Form(...),
    primary_actions: str = Form(...),  # JSON string
    testing_focus: Optional[str] = Form(None),
    user_notes: Optional[str] = Form(None),
    created_by: Optional[str] = Form(None),
    screenshot: Optional[UploadFile] = File(None),
    repository: PageContextRepository = Depends(get_page_context_repository)
):
    """
    Upload a new page context with optional screenshot
    """
    try:
        # Parse primary actions JSON
        primary_actions_list = json.loads(primary_actions)
        
        # Handle screenshot upload
        screenshot_url = None
        screenshot_filename = None
        if screenshot:
            file_path, access_url = await file_upload_service.upload_screenshot(
                screenshot, 
                user_id=created_by
            )
            screenshot_url = access_url
            screenshot_filename = screenshot.filename
        
        # Create page context data
        context_data = {
            'page_url': page_url,
            'page_title': page_title,
            'page_type': page_type,
            'page_description': page_description,
            'primary_actions': primary_actions_list,
            'testing_focus': testing_focus,
            'user_notes': user_notes,
            'screenshot_url': screenshot_url,
            'screenshot_filename': screenshot_filename,
            'user_uploaded': True,
            'created_by': created_by
        }
        
        # Save to database
        db_result = await repository.create_context(context_data)
        
        if db_result:
            return {
                "success": True,
                "data": {
                    "id": db_result["id"],
                    "page_url": page_url,
                    "page_title": page_title,
                    "page_type": page_type,
                    "page_description": page_description,
                    "primary_actions": primary_actions_list,
                    "screenshot_url": screenshot_url,
                    "created_at": db_result["created_at"].isoformat() if db_result["created_at"] else None
                },
                "message": "Page context uploaded successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to save page context to database")
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in primary_actions field")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload page context: {str(e)}")

@router.post("/detect", response_model=PageContext)
async def detect_page_context(request: PageContextRequest):
    """
    Automatically detect page context from provided information
    """
    try:
        context = page_context_service.detect_page_context(
            page_url=request.page_url,
            page_title=request.page_title,
            element_selectors=request.element_selectors or [],
            user_context=request.user_context
        )
        return context
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to detect page context: {str(e)}")

@router.post("/manual", response_model=PageContext)
async def create_manual_context(request: ManualPageContextRequest):
    """
    Create manually specified page context
    """
    try:
        context = page_context_service.create_manual_context(
            page_type=request.page_type,
            description=request.description,
            primary_actions=request.primary_actions,
            testing_focus=request.testing_focus,
            page_title=request.page_title,
            domain_name=request.domain_name,
            user_notes=request.user_notes
        )
        return context
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create page context: {str(e)}")

@router.get("/from-url", response_model=PageContext)
async def context_from_url(url: str):
    """
    Create page context from just a URL (convenience endpoint)
    """
    try:
        context = page_context_service.create_context_from_url(url)
        return context
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create context from URL: {str(e)}")

@router.get("/list")
async def get_page_contexts(
    limit: int = 100,
    category: Optional[str] = None,
    search: Optional[str] = None,
    repository: PageContextRepository = Depends(get_page_context_repository)
):
    """
    Get page contexts from database
    """
    try:
        if search:
            contexts = await repository.search_contexts(search, category)
        elif category:
            contexts = await repository.get_contexts_by_category(category)
        else:
            contexts = await repository.get_all_contexts(limit)
        
        # Convert to frontend format
        result = []
        for ctx in contexts:
            # Use page_name from joined pages table, fallback to description or URL
            page_title = ctx.get("page_name")
            if not page_title:
                # If no page name, try to use description or extract from URL
                page_title = ctx.get("description", "").split(" ")[0:3]  # First few words of description
                page_title = " ".join(page_title) if page_title else None
                
            if not page_title:
                page_title = ctx.get("website_url", "").split("/")[-1] if ctx.get("website_url") else "Unknown"
            
            # Convert relative screenshot URL to full URL
            screenshot_url = ctx.get("screenshot_url")
            if screenshot_url and screenshot_url.startswith("/uploads"):
                # Convert relative URL to full URL
                from fastapi import Request
                # For now, use a simple approach - we'll enhance this if needed
                screenshot_url = f"https://testhelix.com{screenshot_url}"
            
            result.append({
                "id": str(ctx["id"]),
                "pageUrl": ctx.get("website_url"),
                "pageTitle": page_title,
                "pageType": ctx.get("category"),
                "pageDescription": ctx.get("description"),
                "primaryActions": ctx.get("primary_actions", []),
                "screenshotUrl": screenshot_url,
                "usageCount": ctx.get("usage_count", 0),
                "lastUsedAt": ctx.get("last_used_at").isoformat() if ctx.get("last_used_at") else None,
                "createdAt": ctx.get("created_at").isoformat() if ctx.get("created_at") else None,
                "updatedAt": ctx.get("updated_at").isoformat() if ctx.get("updated_at") else None
            })
        
        return {
            "success": True,
            "data": result,
            "count": len(result)
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to get page contexts: {str(e)}")

@router.get("/{context_id}")
async def get_page_context(
    context_id: str,
    repository: PageContextRepository = Depends(get_page_context_repository)
):
    """
    Get a specific page context by ID
    """
    try:
        # For now, we'll search by ID (could implement get_by_id method)
        contexts = await repository.get_all_contexts(1000)
        context = next((c for c in contexts if str(c["id"]) == context_id), None)
        
        if not context:
            raise HTTPException(status_code=404, detail="Page context not found")
        
        # Use page_name from joined pages table, fallback to description or URL
        page_title = context.get("page_name")
        if not page_title:
            page_title = context.get("description", "").split(" ")[0:3]
            page_title = " ".join(page_title) if page_title else None
            
        if not page_title:
            page_title = context.get("website_url", "").split("/")[-1] if context.get("website_url") else "Unknown"
        
        # Convert relative screenshot URL to full URL
        screenshot_url = context.get("screenshot_url")
        if screenshot_url and screenshot_url.startswith("/uploads"):
            screenshot_url = f"https://testhelix.com{screenshot_url}"
        
        return {
            "success": True,
            "data": {
                "id": str(context["id"]),
                "pageUrl": context.get("website_url"),
                "pageTitle": page_title,
                "pageType": context.get("category"),
                "pageDescription": context.get("description"),
                "primaryActions": context.get("primary_actions", []),
                "screenshotUrl": screenshot_url,
                "usageCount": context.get("usage_count", 0),
                "lastUsedAt": context.get("last_used_at").isoformat() if context.get("last_used_at") else None,
                "createdAt": context.get("created_at").isoformat() if context.get("created_at") else None,
                "updatedAt": context.get("updated_at").isoformat() if context.get("updated_at") else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to get page context: {str(e)}")

@router.put("/{context_id}")
async def update_page_context(
    context_id: str,
    updates: Dict[str, Any],
    repository: PageContextRepository = Depends(get_page_context_repository)
):
    """
    Update a page context
    """
    try:
        # Map frontend fields to database fields
        db_updates = {}
        if "pageDescription" in updates:
            db_updates["description"] = updates["pageDescription"]
        if "pageType" in updates:
            db_updates["category"] = updates["pageType"]
        if "pageUrl" in updates:
            db_updates["website_url"] = updates["pageUrl"]
        if "primaryActions" in updates:
            db_updates["primary_actions"] = updates["primaryActions"]
        
        result = await repository.update_context(context_id, db_updates)
        
        if not result:
            raise HTTPException(status_code=404, detail="Page context not found")
        
        return {
            "success": True,
            "data": {
                "id": str(result["id"]),
                "pageUrl": result.get("website_url"),
                "pageType": result.get("category"),
                "pageDescription": result.get("description"),
                "primaryActions": result.get("primary_actions", []),
                "updatedAt": result.get("updated_at").isoformat() if result.get("updated_at") else None
            },
            "message": "Page context updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to update page context: {str(e)}")

@router.put("/{context_id}/upload")
async def update_page_context_with_files(
    context_id: str,
    page_url: str = Form(...),
    page_title: str = Form(...),
    page_type: str = Form(...),
    page_description: str = Form(...),
    testing_focus: Optional[str] = Form(None),
    user_notes: Optional[str] = Form(None),
    primary_actions: str = Form(...),  # JSON string
    screenshot: Optional[UploadFile] = File(None),
    repository: PageContextRepository = Depends(get_page_context_repository)
):
    """
    Update a page context with optional file uploads (like screenshots)
    """
    try:
        # Parse primary_actions from JSON string
        try:
            primary_actions_list = json.loads(primary_actions)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid primary_actions format")
        
        # Handle screenshot upload if provided
        screenshot_url = None
        if screenshot and screenshot.filename:
            # Validate file type and size
            if not screenshot.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail="Screenshot must be an image file")
            
            # Upload file and get URL
            file_path, screenshot_url = await file_upload_service.upload_screenshot(screenshot)
        
        # Prepare update data
        db_updates = {
            "website_url": page_url,
            "category": page_type,
            "description": page_description,
            "primary_actions": primary_actions_list,
        }
        
        # Only update screenshot if a new one was provided
        if screenshot_url:
            db_updates["screenshot_url"] = screenshot_url
        
        result = await repository.update_context(context_id, db_updates)
        
        if not result:
            raise HTTPException(status_code=404, detail="Page context not found")
        
        # Convert relative screenshot URL to full URL
        result_screenshot_url = result.get("screenshot_url")
        if result_screenshot_url and result_screenshot_url.startswith("/uploads"):
            result_screenshot_url = f"https://testhelix.com{result_screenshot_url}"
        
        return {
            "success": True,
            "data": {
                "id": str(result["id"]),
                "pageUrl": result.get("website_url"),
                "pageType": result.get("category"), 
                "pageDescription": result.get("description"),
                "primaryActions": result.get("primary_actions", []),
                "screenshotUrl": result_screenshot_url,
                "updatedAt": result.get("updated_at").isoformat() if result.get("updated_at") else None
            },
            "message": "Page context updated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to update page context: {str(e)}")

@router.delete("/{context_id}")
async def delete_page_context(
    context_id: str,
    repository: PageContextRepository = Depends(get_page_context_repository)
):
    """
    Delete a page context
    """
    try:
        success = await repository.delete_context(context_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Page context not found")
        
        return {
            "success": True,
            "message": "Page context deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to delete page context: {str(e)}")

@router.post("/{context_id}/use")
async def use_page_context(
    context_id: str,
    repository: PageContextRepository = Depends(get_page_context_repository)
):
    """
    Mark a page context as used (increment usage count)
    """
    try:
        await repository.increment_usage(context_id)
        
        return {
            "success": True,
            "message": "Page context usage recorded"
        }
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to record usage: {str(e)}")

@router.get("/user-contexts")
async def get_user_contexts(
    user_id: Optional[str] = None,
    repository: PageContextRepository = Depends(get_page_context_repository)
):
    """
    Get all contexts created by a user
    """
    try:
        contexts = await repository.get_user_contexts(user_id or "anonymous")
        
        result = []
        for ctx in contexts:
            # Use page_name from joined pages table, fallback to description or URL
            page_title = ctx.get("page_name")
            if not page_title:
                page_title = ctx.get("description", "").split(" ")[0:3]
                page_title = " ".join(page_title) if page_title else None
                
            if not page_title:
                page_title = ctx.get("website_url", "").split("/")[-1] if ctx.get("website_url") else "Unknown"
            
            result.append({
                "id": str(ctx["id"]),
                "pageUrl": ctx.get("website_url"),
                "pageTitle": page_title,
                "pageType": ctx.get("category"),
                "pageDescription": ctx.get("description"),
                "primaryActions": ctx.get("primary_actions", []),
                "usageCount": ctx.get("usage_count", 0),
                "createdAt": ctx.get("created_at").isoformat() if ctx.get("created_at") else None
            })
        
        return result
        
    except Exception as e:raise HTTPException(status_code=500, detail=f"Failed to get user contexts: {str(e)}")

@router.get("/supported-types")
async def get_supported_page_types():
    """
    Get list of supported page types and their primary actions
    """
    return {
        "page_types": {
            "ecommerce": {
                "description": "E-commerce websites for online shopping",
                "primary_actions": ["browse products", "add to cart", "checkout", "search products", "view details"],
                "example_domains": ["amazon.com", "ebay.com", "shopify.com"]
            },
            "airline": {
                "description": "Airline websites for booking flights and travel management",
                "primary_actions": ["search flights", "book flights", "check-in", "manage booking", "select seats"],
                "example_domains": ["southwest.com", "united.com", "delta.com"]
            },
            "banking": {
                "description": "Banking websites for financial services",
                "primary_actions": ["check balance", "transfer funds", "pay bills", "view statements", "secure login"],
                "example_domains": ["chase.com", "bankofamerica.com", "paypal.com"]
            },
            "form": {
                "description": "Form-based pages for data collection",
                "primary_actions": ["fill fields", "validate input", "submit form", "reset form", "upload files"],
                "example_domains": ["Any website with forms"]
            },
            "news": {
                "description": "News and content websites",
                "primary_actions": ["read articles", "browse categories", "search news", "comment", "share"],
                "example_domains": ["cnn.com", "bbc.com", "techcrunch.com"]
            },
            "social": {
                "description": "Social media platforms",
                "primary_actions": ["post content", "view feed", "connect with users", "message", "like/react"],
                "example_domains": ["facebook.com", "twitter.com", "linkedin.com"]
            },
            "search": {
                "description": "Search engines",
                "primary_actions": ["enter query", "view results", "refine search", "navigate results"],
                "example_domains": ["google.com", "bing.com", "duckduckgo.com"]
            },
            "streaming": {
                "description": "Video and media streaming platforms",
                "primary_actions": ["search content", "play video", "manage playlist", "browse catalog"],
                "example_domains": ["netflix.com", "youtube.com", "hulu.com"]
            }
        }
    }

@router.get("/examples")
async def get_context_examples():
    """
    Get example page contexts for different website types
    """
    return {
        "examples": [
            {
                "name": "Southwest Airlines",
                "context": page_context_service.create_manual_context(
                    page_type="airline",
                    description="Southwest Airlines booking page for searching and booking flights",
                    primary_actions=["search flights", "select dates", "choose flights", "enter passenger info"],
                    testing_focus="flight booking workflow",
                    domain_name="southwest.com"
                ).dict()
            },
            {
                "name": "Amazon Product Page",
                "context": page_context_service.create_manual_context(
                    page_type="ecommerce",
                    description="Amazon product listing page for browsing and purchasing items",
                    primary_actions=["view products", "add to cart", "read reviews", "select options"],
                    testing_focus="product interaction and cart functionality",
                    domain_name="amazon.com"
                ).dict()
            },
            {
                "name": "Generic Contact Form",
                "context": page_context_service.create_manual_context(
                    page_type="form",
                    description="Contact form for customer inquiries and support requests",
                    primary_actions=["fill contact info", "enter message", "submit form", "validate fields"],
                    testing_focus="form validation and submission",
                    domain_name="example.com"
                ).dict()
            }
        ]
    }