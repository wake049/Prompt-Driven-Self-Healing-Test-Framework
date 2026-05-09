"""
 Page Context API Router
Provides endpoints for managing page context and helping AI understand website types.
Connected to repo.page_contexts table in database.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import json
import os
import logging

from core.auth import get_current_active_user
from models.auth_models import CurrentUser

from schemas.enterprise import PageContext
from services.page_context_service import page_context_service
from services.file_upload_service import file_upload_service
from repositories.page_context_repository import PageContextRepository
from core.database import get_database

logger = logging.getLogger(__name__)

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
    page_url: Optional[str] = Form(None),
    page_title: str = Form(...),
    page_type: str = Form(...),
    page_description: str = Form(...),
    primary_actions: str = Form(...),  # JSON string
    testing_focus: Optional[str] = Form(None),
    user_notes: Optional[str] = Form(None),
    created_by: Optional[str] = Form(None),
    screenshot: Optional[UploadFile] = File(None),
    repository: PageContextRepository = Depends(get_page_context_repository),
    current_user: CurrentUser = Depends(get_current_active_user),
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
            'created_by': created_by,
            'project_id': str(current_user.project.id) if current_user.project else None,
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
        # Use direct database query to avoid repository issues
        db = await get_database()
        
        if category:
            contexts = await db.fetch(
                """
                SELECT id, page_id, screenshot_url, description, category, 
                       website_url, primary_actions, usage_count, last_used_at,
                       created_at, updated_at
                FROM repo.page_contexts 
                WHERE category = $1 
                ORDER BY created_at DESC 
                LIMIT $2
                """,
                category, limit
            )
        else:
            contexts = await db.fetch(
                """
                SELECT id, page_id, screenshot_url, description, category,
                       website_url, primary_actions, usage_count, last_used_at,
                       created_at, updated_at
                FROM repo.page_contexts 
                ORDER BY created_at DESC 
                LIMIT $1
                """,
                limit
            )
        
        # Convert to frontend format
        result = []
        for ctx in contexts:
            try:
                # Parse primary_actions JSON string
                primary_actions = ctx.get("primary_actions", "[]")
                if isinstance(primary_actions, str):
                    try:
                        import json
                        primary_actions = json.loads(primary_actions)
                    except Exception:
                        primary_actions = []
                elif not isinstance(primary_actions, list):
                    primary_actions = []
                
                # Convert relative screenshot URL to full URL
                screenshot_url = ctx.get("screenshot_url")
                if screenshot_url and screenshot_url.startswith("/uploads"):
                    screenshot_url = f"https://fluxtest.io{screenshot_url}"
                
                result.append({
                    "id": str(ctx["id"]),
                    "pageUrl": ctx.get("website_url", ""),
                    "pageTitle": ctx.get("description", "Untitled"),
                    "pageType": ctx.get("category", "unknown"),
                    "pageDescription": ctx.get("description", ""),
                    "primaryActions": primary_actions,
                    "screenshotUrl": screenshot_url,
                    "usageCount": ctx.get("usage_count", 0),
                    "lastUsedAt": ctx.get("last_used_at").isoformat() if ctx.get("last_used_at") else None,
                    "createdAt": ctx.get("created_at").isoformat() if ctx.get("created_at") else None,
                    "updatedAt": ctx.get("updated_at").isoformat() if ctx.get("updated_at") else None
                })
            except Exception as e:
                logger.warning("Error processing context: %s", e)
                continue
        
        return {
            "success": True,
            "data": result,
            "count": len(result)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get page contexts: {str(e)}")

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
            screenshot_url = f"https://fluxtest.io{screenshot_url}"
        
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
            result_screenshot_url = f"https://fluxtest.io{result_screenshot_url}"
        
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


# ---------------------------------------------------------------------------
# Internal helper: call the AI enrichment endpoint logic directly
# ---------------------------------------------------------------------------
async def _enrich_elements_internal(elements: list, page_id: str, config_type: str, context_id: str) -> dict:
    """Call AI enrichment logic directly (no HTTP round-trip)."""
    from api.ai_service import enrich_elements_core

    page_info = {
        "page_id": page_id,
        "config_type": config_type,
        "context_id": context_id,
    }
    data = await enrich_elements_core(elements, page_info)
    return {
        "enriched_elements": data.get("elements", []),
        "ai_processed": data.get("ai_processed", False),
    }


def _score_weighted_selector_choice(selectors: dict, selector_scores: dict, config_type: str) -> tuple[dict, list]:
    """Return (primary_selector, fallback_selectors) using score-driven ranking."""
    selector_candidates = []

    if not selectors:
        return {}, []

    for key in ("accessibility_id", "id", "name", "improved_xpath", "xpath", "class_name"):
        value = selectors.get(key)
        if value is None:
            continue
        value_str = str(value).strip()
        if not value_str or value_str.lower() == "null":
            continue

        score_key = "xpath" if key == "improved_xpath" else key
        base_score = float((selector_scores or {}).get(score_key, 0.45))

        # Mild policy weighting by platform/type, but confidence remains primary driver.
        if config_type and "android" in config_type:
            if key == "accessibility_id":
                base_score += 0.05
            elif key == "id":
                base_score += 0.03
        elif config_type and "ios" in config_type:
            if key == "accessibility_id":
                base_score += 0.06
            elif key == "id":
                base_score += 0.01
        elif config_type and "web" in config_type:
            if key == "id":
                base_score += 0.03
            elif key in ("xpath", "improved_xpath"):
                base_score -= 0.02

        selector_candidates.append((round(base_score, 4), key, value_str))

    if not selector_candidates:
        return {}, []

    selector_candidates.sort(key=lambda x: x[0], reverse=True)
    _, best_key, best_value = selector_candidates[0]

    primary = {best_key: best_value}
    fallbacks = [{k: v} for _, k, v in selector_candidates[1:]]
    return primary, fallbacks


# ---------------------------------------------------------------------------
# Gather Mobile Elements — scan the current screen via Appium and store
# elements against this page context's page_id.
# ---------------------------------------------------------------------------

class GatherElementsRequest(BaseModel):
    appium_config_id: str

@router.post("/{context_id}/gather-elements")
async def gather_mobile_elements(
    context_id: str,
    body: GatherElementsRequest,
    current_user: CurrentUser = Depends(get_current_active_user),
):
    """
    Gather mobile elements via Appium for a specific page context.
    The elements are stored in repo.elements linked to the page context's page_id.
    """
    import httpx

    db = await get_database()

    # 1. Look up the page context to get its page_id
    ctx_row = await db.fetchrow(
        "SELECT id, page_id FROM repo.page_contexts WHERE id = $1::uuid",
        context_id,
    )
    if not ctx_row:
        raise HTTPException(404, "Page context not found")
    page_id = ctx_row["page_id"]

    # 2. Resolve the Appium config
    config_row = await db.fetchrow(
        "SELECT * FROM exec.appium_configs WHERE id = $1::uuid",
        body.appium_config_id,
    )
    if not config_row:
        raise HTTPException(404, "Appium config not found")
    config = dict(config_row)

    BUILTIN_ORG_ID = "00000000-0000-0000-0000-000000000000"
    org = str(config["organization_id"])
    user_org = str(current_user.tenant.id) if current_user.tenant else None
    if org != BUILTIN_ORG_ID and org != user_org:
        raise HTTPException(403, "Access denied to Appium config")

    CONFIG_TO_BROWSER = {
        "android-web": "appium-android-web",
        "ios-web": "appium-ios-web",
        "android-native": "appium-android-native",
        "ios-native": "appium-ios-native",
        "flutter": "appium-flutter",
        "windows": "appium-windows",
        "mac": "appium-mac",
    }
    config_type = config["config_type"]
    browser_type = CONFIG_TO_BROWSER.get(config_type)
    if not browser_type:
        raise HTTPException(400, f"Unsupported config_type: {config_type}")

    appium_config: Dict[str, Any] = {
        "appium_server_url": config.get("appium_server_url") or "http://localhost:4723",
        "platform_name": config.get("platform_name") or "",
        "platform_version": config.get("platform_version") or "",
        "device_name": config.get("device_name") or "",
        "automation_name": config.get("automation_name") or "",
        "app_path": config.get("app_path") or "",
        "app_package": config.get("app_package") or "",
        "app_activity": config.get("app_activity") or "",
        "bundle_id": config.get("bundle_id") or "",
        "browser_name": config.get("browser_name") or "",
        "no_reset": True,
    }
    extras = config.get("extra_capabilities")
    if extras:
        if isinstance(extras, str):
            extras = json.loads(extras)
        if isinstance(extras, dict):
            appium_config["extra_capabilities"] = extras
    if config.get("cloud_provider"):
        appium_config["cloud_provider"] = config["cloud_provider"]
        appium_config["cloud_username"] = config.get("cloud_username") or ""
        appium_config["cloud_access_key"] = config.get("cloud_access_key") or ""

    # 3. Call the Java runner — prefer WebSocket, fallback to HTTP
    from api.runner_ws import runner_registry

    runner_timeout = float(os.getenv("RUNNER_TIMEOUT", "600"))
    payload = {"browserType": browser_type, "appiumConfig": appium_config}

    # Try WebSocket-connected runner first
    ws_runner = runner_registry.find_by_org(
        str(current_user.tenant.id) if current_user.tenant else "",
        capability=browser_type,
    )

    if ws_runner:
        logger.info("Gather-elements (WebSocket) → runner=%s  context=%s config=%s",
                     ws_runner.runner_id, context_id, body.appium_config_id)
        try:
            runner_result = await ws_runner.send_command(
                "gather-elements", payload, timeout=runner_timeout,
            )
        except TimeoutError:
            raise HTTPException(504, f"Runner timed out via WebSocket ({runner_timeout}s limit)")
        except RuntimeError as e:
            raise HTTPException(502, f"Runner error: {e}")
        except Exception as e:
            raise HTTPException(502, f"Runner WebSocket error: {e}")
    else:
        # Fallback to HTTP (runner not connected via WS)
        java_runner_url = os.getenv("JAVA_RUNNER_URL", "http://localhost:8080")
        target = f"{java_runner_url}/api/v1/gather-elements"
        logger.info("Gather-elements (HTTP fallback) → %s  context=%s config=%s  timeout=%ss",
                     target, context_id, body.appium_config_id, runner_timeout)
        try:
            async with httpx.AsyncClient(timeout=runner_timeout) as client:
                resp = await client.post(target, json=payload)
                runner_result = resp.json()
        except httpx.ConnectError:
            raise HTTPException(502, "Cannot reach the Java runner. Is it running? (No WebSocket or HTTP connection)")
        except httpx.ReadTimeout:
            raise HTTPException(504, f"Runner timed out via HTTP ({runner_timeout}s limit)")
        except Exception as e:
            raise HTTPException(502, f"Runner communication error: {e}")

    if not runner_result.get("success"):
        raise HTTPException(502, runner_result.get("error", "Unknown runner error"))

    # 4. Send elements through AI enrichment pipeline (enrich → format → store)
    elements = runner_result.get("elements", [])
    stored_count = 0
    ai_processed = False

    try:
        # Step A: AI enrichment
        enrich_result = await _enrich_elements_internal(elements, str(page_id), config_type, context_id)
        enriched = enrich_result.get("enriched_elements", [])
        ai_processed = enrich_result.get("ai_processed", False)

        # Step B: Format enriched elements and store
        store_elements = []
        for elem in enriched:
            selectors = elem.get("selectors", {})
            attrs = elem.get("attributes", {})
            attrs["tag"] = elem.get("tag", "")
            if elem.get("text"):
                attrs["text"] = elem["text"]
            attrs["interactive"] = str(elem.get("interactive", False))
            attrs["selector_confidence_scores"] = elem.get("selector_confidence_scores", {})

            is_dynamic = elem.get("is_dynamic", False)
            if elem.get("skip", False) or is_dynamic:
                continue

            # Build primary selector using confidence-driven ranking.
            selector_scores = elem.get("selector_confidence_scores", {})
            primary, fallbacks = _score_weighted_selector_choice(selectors, selector_scores, config_type)

            # Keep xpath fallback if available and not already present.
            if "xpath" in selectors and "xpath" not in primary:
                xpath_fallback = {"xpath": selectors.get("xpath")}
                if xpath_fallback not in fallbacks and selectors.get("xpath"):
                    fallbacks.append(xpath_fallback)

            # Use AI logical_name if available, else fallback (never use long/dynamic content-desc)
            _logical = elem.get("logical_name") or ""
            _acc_short = acc_id if (acc_id and len(acc_id) <= 60 and not is_dynamic) else ""
            _res = res_id if res_id else ""
            element_key = (
                _logical
                or _acc_short
                or _res
                or f"element_{elem.get('index', stored_count)}"
            )

            store_elements.append({
                "name": element_key,
                "primary_selector": primary,
                "fallback_selectors": fallbacks,
                "attributes": attrs,
            })

        # Derive platform from config_type
        if config_type and "android" in config_type:
            element_platform = "android"
        elif config_type and "ios" in config_type:
            element_platform = "ios"
        elif config_type and config_type in ("flutter", "windows", "mac"):
            element_platform = "universal"
        else:
            element_platform = "web"

        # Step C: Bulk store
        for se in store_elements:
            await db.execute(
                """
                INSERT INTO repo.elements (page_id, name, platform, primary_selector,
                                           fallback_selectors, attributes, is_active)
                VALUES ($1::uuid, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, true)
                ON CONFLICT (page_id, name, platform) DO UPDATE
                    SET primary_selector = EXCLUDED.primary_selector,
                        fallback_selectors = EXCLUDED.fallback_selectors,
                        attributes = EXCLUDED.attributes,
                        updated_at = NOW()
                """,
                str(page_id),
                se["name"],
                element_platform,
                json.dumps(se["primary_selector"]),
                json.dumps(se["fallback_selectors"]),
                json.dumps(se["attributes"]),
            )
            stored_count += 1
    except Exception as e:
        logger.error("AI enrichment pipeline failed: %s", e)
        raise HTTPException(502, f"AI enrichment pipeline failed: {e}. Ensure an AI provider (OPENAI_API_KEY, ANTHROPIC_API_KEY, or Ollama) is configured.")

    stats = runner_result.get("stats", {})
    return {
        "success": True,
        "context_id": context_id,
        "page_id": str(page_id),
        "config_type": config_type,
        "ai_processed": ai_processed,
        "stats": {**stats, "stored_count": stored_count},
        "elements": elements,
    }


# ---------------------------------------------------------------------------
# Get Elements — return stored elements for a page context
# ---------------------------------------------------------------------------
@router.get("/{context_id}/elements")
async def get_page_context_elements(
    context_id: str,
    current_user: CurrentUser = Depends(get_current_active_user),
):
    """Return all elements stored for this page context's page."""
    db = await get_database()

    ctx_row = await db.fetchrow(
        "SELECT page_id FROM repo.page_contexts WHERE id = $1::uuid",
        context_id,
    )
    if not ctx_row:
        raise HTTPException(404, "Page context not found")

    rows = await db.fetch(
        """
        SELECT id, name, primary_selector, fallback_selectors, attributes,
               is_active, created_at, updated_at
        FROM repo.elements
        WHERE page_id = $1::uuid
        ORDER BY name
        """,
        str(ctx_row["page_id"]),
    )

    elements = []
    for r in rows:
        d = dict(r)
        d["id"] = str(d["id"])
        for k in ("created_at", "updated_at"):
            if d.get(k):
                d[k] = d[k].isoformat()
        elements.append(d)

    return {"success": True, "context_id": context_id, "elements": elements, "count": len(elements)}