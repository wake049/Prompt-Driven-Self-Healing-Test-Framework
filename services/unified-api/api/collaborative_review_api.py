"""
Collaborative Review API Endpoints
Handles prompt versioning, reviews, comments, and activity tracking
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
import logging
import json

from core.database import get_database, DatabaseManager
from core.auth import get_current_user
from models.auth_models import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reviews", tags=["collaborative-review"])

async def get_db() -> DatabaseManager:
    """Get database dependency"""
    return await get_database()

# =============================================================================
# MODELS
# =============================================================================

class VersionResponse(BaseModel):
    id: UUID
    prompt_id: UUID
    version_number: int
    title: Optional[str]
    description: Optional[str]
    change_summary: Optional[str]
    status: str
    is_active: bool
    created_by: UUID
    created_by_name: Optional[str]
    created_at: datetime
    approved_by: Optional[UUID]
    approved_by_name: Optional[str]
    approved_at: Optional[datetime]
    rejected_by: Optional[UUID]
    rejected_at: Optional[datetime]
    rejection_reason: Optional[str]
    step_count: Optional[int]
    pending_reviews: Optional[int]

class CreateVersionRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    change_summary: Optional[str] = None
    plan_snapshot: Dict[str, Any]

class UpdateVersionRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    change_summary: Optional[str] = None

class ReviewRequestResponse(BaseModel):
    id: UUID
    version_id: UUID
    requested_by: UUID
    requested_by_name: Optional[str]
    reviewer_id: UUID
    reviewer_name: Optional[str]
    reviewer_email: Optional[str]
    status: str
    review_comment: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime

class CreateReviewRequest(BaseModel):
    reviewer_ids: List[UUID]
    message: Optional[str] = None

class SubmitReviewRequest(BaseModel):
    status: str  # approved, changes_requested
    comment: Optional[str] = None

class CommentResponse(BaseModel):
    id: UUID
    prompt_id: UUID
    version_id: Optional[UUID]
    parent_comment_id: Optional[UUID]
    content: str
    step_index: Optional[int]
    author_id: UUID
    author_name: Optional[str]
    author_email: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    edited_at: Optional[datetime]
    replies: Optional[List['CommentResponse']] = None

class CreateCommentRequest(BaseModel):
    content: str
    version_id: Optional[UUID] = None
    parent_comment_id: Optional[UUID] = None
    step_index: Optional[int] = None

class UpdateCommentRequest(BaseModel):
    content: str

class ActivityResponse(BaseModel):
    id: UUID
    prompt_id: UUID
    version_id: Optional[UUID]
    activity_type: str
    actor_id: UUID
    actor_name: Optional[str]
    actor_email: Optional[str]
    details: Optional[Dict[str, Any]]
    summary: Optional[str]
    created_at: datetime

# =============================================================================
# VERSION ENDPOINTS
# =============================================================================

@router.get("/prompts/{prompt_id}/versions", response_model=List[VersionResponse])
async def list_versions(
    prompt_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """List all versions of a prompt"""
    query = """
        SELECT 
            v.id, v.prompt_id, v.version_number, v.title, v.description,
            v.change_summary, v.status, v.is_active,
            v.created_by, u_created.full_name as created_by_name,
            v.created_at,
            v.approved_by, u_approved.full_name as approved_by_name, v.approved_at,
            v.rejected_by, v.rejected_at, v.rejection_reason,
            COALESCE(jsonb_array_length(v.plan_snapshot->'steps'), 0) as step_count,
            (SELECT COUNT(*) FROM planner.review_requests rr 
             WHERE rr.version_id = v.id AND rr.status = 'pending') as pending_reviews
        FROM planner.prompt_versions v
        LEFT JOIN core.users u_created ON v.created_by = u_created.id
        LEFT JOIN core.users u_approved ON v.approved_by = u_approved.id
        WHERE v.prompt_id = $1
        ORDER BY v.version_number DESC
    """
    
    try:
        rows = await db.execute_query(query, str(prompt_id))
        return [VersionResponse(**dict(row)) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching versions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/prompts/{prompt_id}/versions/{version_id}")
async def get_version(
    prompt_id: UUID,
    version_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Get a specific version with full plan details"""
    query = """
        SELECT 
            v.id, v.prompt_id, v.version_number, v.title, v.description,
            v.change_summary, v.status, v.is_active, v.plan_snapshot,
            v.created_by, u_created.full_name as created_by_name, u_created.email as created_by_email,
            v.created_at,
            v.approved_by, u_approved.full_name as approved_by_name, v.approved_at,
            v.rejected_by, v.rejected_at, v.rejection_reason
        FROM planner.prompt_versions v
        LEFT JOIN core.users u_created ON v.created_by = u_created.id
        LEFT JOIN core.users u_approved ON v.approved_by = u_approved.id
        WHERE v.id = $1 AND v.prompt_id = $2
    """
    
    try:
        row = await db.execute_one(query, str(version_id), str(prompt_id))
        if not row:
            raise HTTPException(status_code=404, detail="Version not found")
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching version: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/prompts/{prompt_id}/versions", response_model=VersionResponse, status_code=status.HTTP_201_CREATED)
async def create_version(
    prompt_id: UUID,
    request: CreateVersionRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Create a new version of a prompt"""
    # Get next version number
    version_query = """
        SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
        FROM planner.prompt_versions
        WHERE prompt_id = $1
    """
    
    try:
        version_row = await db.execute_one(version_query, str(prompt_id))
        next_version = version_row['next_version'] if version_row else 1
        
        # Create the new version
        insert_query = """
            INSERT INTO planner.prompt_versions (
                prompt_id, version_number, plan_snapshot, title, description,
                change_summary, status, is_active, created_by
            ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, 'draft', false, $7)
            RETURNING id, prompt_id, version_number, title, description, change_summary,
                      status, is_active, created_by, created_at,
                      approved_by, approved_at, rejected_by, rejected_at, rejection_reason
        """
        
        row = await db.execute_one(
            insert_query,
            str(prompt_id),
            next_version,
            json.dumps(request.plan_snapshot),
            request.title or f"Version {next_version}",
            request.description,
            request.change_summary,
            str(current_user.user.id)
        )
        
        # Log activity
        await _log_activity(
            db, prompt_id, row['id'], 'version_created',
            current_user.user.id,
            f"Created version {next_version}",
            {'version_number': next_version}
        )
        
        result = dict(row)
        result['created_by_name'] = current_user.user.full_name
        result['step_count'] = len(request.plan_snapshot.get('steps', []))
        result['pending_reviews'] = 0
        
        return VersionResponse(**result)
        
    except Exception as e:
        logger.error(f"Error creating version: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/prompts/{prompt_id}/versions/{version_id}/activate")
async def activate_version(
    prompt_id: UUID,
    version_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Activate a version (make it the current version for execution)"""
    # Verify version exists and is approved
    check_query = """
        SELECT v.id, v.version_number, v.status
        FROM planner.prompt_versions v
        WHERE v.id = $1 AND v.prompt_id = $2
    """
    
    try:
        version = await db.execute_one(check_query, str(version_id), str(prompt_id))
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")
        
        if version['status'] not in ('approved', 'draft'):
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot activate version with status '{version['status']}'. Must be 'approved' or 'draft'."
            )
        
        # Activate this version (trigger will deactivate others)
        activate_query = """
            UPDATE planner.prompt_versions
            SET is_active = true
            WHERE id = $1
            RETURNING id
        """
        await db.execute_one(activate_query, str(version_id))
        
        # Also update the prompt's parsed_plan with this version's plan
        update_prompt_query = """
            UPDATE planner.prompts
            SET parsed_plan = (
                SELECT plan_snapshot FROM planner.prompt_versions WHERE id = $1
            ), updated_at = NOW()
            WHERE id = $2
        """
        await db.execute_command(update_prompt_query, str(version_id), str(prompt_id))
        
        # Log activity
        await _log_activity(
            db, prompt_id, version_id, 'activated',
            current_user.user.id,
            f"Activated version {version['version_number']}",
            {'version_number': version['version_number']}
        )
        
        return {"message": f"Version {version['version_number']} activated", "version_id": str(version_id)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating version: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# REVIEW REQUEST ENDPOINTS
# =============================================================================

@router.post("/prompts/{prompt_id}/versions/{version_id}/request-review")
async def request_review(
    prompt_id: UUID,
    version_id: UUID,
    request: CreateReviewRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Request review from team members"""
    # Verify version exists
    check_query = "SELECT id, version_number FROM planner.prompt_versions WHERE id = $1 AND prompt_id = $2"
    version = await db.execute_one(check_query, str(version_id), str(prompt_id))
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    try:
        created_reviews = []
        
        for reviewer_id in request.reviewer_ids:
            # Check if review request already exists
            existing = await db.execute_one(
                "SELECT id FROM planner.review_requests WHERE version_id = $1 AND reviewer_id = $2",
                str(version_id), str(reviewer_id)
            )
            
            if existing:
                continue  # Skip existing review requests
            
            # Create review request
            insert_query = """
                INSERT INTO planner.review_requests (version_id, requested_by, reviewer_id, status)
                VALUES ($1, $2, $3, 'pending')
                RETURNING id
            """
            row = await db.execute_one(
                insert_query,
                str(version_id),
                str(current_user.user.id),
                str(reviewer_id)
            )
            created_reviews.append(str(row['id']))
        
        # Update version status to pending_review
        await db.execute_command(
            "UPDATE planner.prompt_versions SET status = 'pending_review' WHERE id = $1",
            str(version_id)
        )
        
        # Log activity
        await _log_activity(
            db, prompt_id, version_id, 'review_requested',
            current_user.user.id,
            f"Requested review for version {version['version_number']} from {len(request.reviewer_ids)} reviewer(s)",
            {'reviewer_count': len(request.reviewer_ids)}
        )
        
        return {
            "message": f"Review requested from {len(created_reviews)} reviewer(s)",
            "review_request_ids": created_reviews
        }
        
    except Exception as e:
        logger.error(f"Error requesting review: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/prompts/{prompt_id}/versions/{version_id}/reviews", response_model=List[ReviewRequestResponse])
async def list_reviews(
    prompt_id: UUID,
    version_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """List all review requests for a version"""
    query = """
        SELECT 
            rr.id, rr.version_id,
            rr.requested_by, u_req.full_name as requested_by_name,
            rr.reviewer_id, u_rev.full_name as reviewer_name, u_rev.email as reviewer_email,
            rr.status, rr.review_comment, rr.reviewed_at, rr.created_at
        FROM planner.review_requests rr
        LEFT JOIN core.users u_req ON rr.requested_by = u_req.id
        LEFT JOIN core.users u_rev ON rr.reviewer_id = u_rev.id
        WHERE rr.version_id = $1
        ORDER BY rr.created_at DESC
    """
    
    try:
        rows = await db.execute_query(query, str(version_id))
        return [ReviewRequestResponse(**dict(row)) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching reviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reviews/{review_id}/submit")
async def submit_review(
    review_id: UUID,
    request: SubmitReviewRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Submit a review (approve or request changes)"""
    # Verify the current user is the assigned reviewer
    check_query = """
        SELECT rr.id, rr.version_id, rr.reviewer_id, v.prompt_id, v.version_number
        FROM planner.review_requests rr
        JOIN planner.prompt_versions v ON rr.version_id = v.id
        WHERE rr.id = $1
    """
    
    review = await db.execute_one(check_query, str(review_id))
    if not review:
        raise HTTPException(status_code=404, detail="Review request not found")
    
    if str(review['reviewer_id']) != str(current_user.user.id):
        raise HTTPException(status_code=403, detail="You are not assigned to this review")
    
    if request.status not in ('approved', 'changes_requested'):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'changes_requested'")
    
    try:
        # Update the review request
        update_query = """
            UPDATE planner.review_requests
            SET status = $1, review_comment = $2, reviewed_at = NOW(), updated_at = NOW()
            WHERE id = $3
        """
        await db.execute_command(update_query, request.status, request.comment, str(review_id))
        
        # Check if all reviews are complete
        pending_query = """
            SELECT COUNT(*) as pending_count
            FROM planner.review_requests
            WHERE version_id = $1 AND status = 'pending'
        """
        pending = await db.execute_one(pending_query, str(review['version_id']))
        
        # Check if there are any rejections
        rejected_query = """
            SELECT COUNT(*) as rejected_count
            FROM planner.review_requests
            WHERE version_id = $1 AND status = 'changes_requested'
        """
        rejected = await db.execute_one(rejected_query, str(review['version_id']))
        
        # Update version status based on review results
        if pending['pending_count'] == 0:
            if rejected['rejected_count'] > 0:
                # At least one reviewer requested changes
                await db.execute_command(
                    """UPDATE planner.prompt_versions 
                       SET status = 'rejected', rejected_by = $1, rejected_at = NOW()
                       WHERE id = $2""",
                    str(current_user.user.id),
                    str(review['version_id'])
                )
                version_status = 'rejected'
            else:
                # All reviewers approved
                await db.execute_command(
                    """UPDATE planner.prompt_versions 
                       SET status = 'approved', approved_by = $1, approved_at = NOW()
                       WHERE id = $2""",
                    str(current_user.user.id),
                    str(review['version_id'])
                )
                version_status = 'approved'
        else:
            version_status = 'pending_review'
        
        # Log activity
        activity_type = 'approved' if request.status == 'approved' else 'changes_requested'
        await _log_activity(
            db, review['prompt_id'], review['version_id'], activity_type,
            current_user.user.id,
            f"{'Approved' if request.status == 'approved' else 'Requested changes on'} version {review['version_number']}",
            {'comment': request.comment} if request.comment else {}
        )
        
        return {
            "message": f"Review submitted: {request.status}",
            "version_status": version_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting review: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pending-reviews", response_model=List[Dict[str, Any]])
async def get_my_pending_reviews(
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Get all pending reviews assigned to the current user"""
    query = """
        SELECT 
            rr.id as review_id, rr.created_at as requested_at,
            v.id as version_id, v.version_number, v.title as version_title,
            p.id as prompt_id, p.text as prompt_text,
            u_req.full_name as requested_by_name
        FROM planner.review_requests rr
        JOIN planner.prompt_versions v ON rr.version_id = v.id
        JOIN planner.prompts p ON v.prompt_id = p.id
        LEFT JOIN core.users u_req ON rr.requested_by = u_req.id
        WHERE rr.reviewer_id = $1 AND rr.status = 'pending'
        ORDER BY rr.created_at DESC
    """
    
    try:
        rows = await db.execute_query(query, str(current_user.user.id))
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error fetching pending reviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# COMMENT ENDPOINTS
# =============================================================================

@router.get("/prompts/{prompt_id}/comments", response_model=List[CommentResponse])
async def list_comments(
    prompt_id: UUID,
    version_id: Optional[UUID] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """List all comments for a prompt (optionally filtered by version)"""
    query = """
        SELECT 
            c.id, c.prompt_id, c.version_id, c.parent_comment_id,
            c.content, c.step_index, c.author_id,
            u.full_name as author_name, u.email as author_email,
            c.status, c.created_at, c.updated_at, c.edited_at
        FROM planner.prompt_comments c
        LEFT JOIN core.users u ON c.author_id = u.id
        WHERE c.prompt_id = $1 AND c.status = 'active' AND c.parent_comment_id IS NULL
    """
    params = [str(prompt_id)]
    
    if version_id:
        query += " AND c.version_id = $2"
        params.append(str(version_id))
    
    query += " ORDER BY c.created_at DESC"
    
    try:
        rows = await db.execute_query(query, *params)
        comments = []
        
        for row in rows:
            comment = dict(row)
            # Fetch replies
            replies_query = """
                SELECT 
                    c.id, c.prompt_id, c.version_id, c.parent_comment_id,
                    c.content, c.step_index, c.author_id,
                    u.full_name as author_name, u.email as author_email,
                    c.status, c.created_at, c.updated_at, c.edited_at
                FROM planner.prompt_comments c
                LEFT JOIN core.users u ON c.author_id = u.id
                WHERE c.parent_comment_id = $1 AND c.status = 'active'
                ORDER BY c.created_at ASC
            """
            replies = await db.execute_query(replies_query, str(comment['id']))
            comment['replies'] = [CommentResponse(**dict(r)) for r in replies]
            comments.append(CommentResponse(**comment))
        
        return comments
    except Exception as e:
        logger.error(f"Error fetching comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/prompts/{prompt_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    prompt_id: UUID,
    request: CreateCommentRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Create a new comment on a prompt"""
    try:
        insert_query = """
            INSERT INTO planner.prompt_comments (
                prompt_id, version_id, parent_comment_id, content, step_index, author_id
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, prompt_id, version_id, parent_comment_id, content, step_index,
                      author_id, status, created_at, updated_at, edited_at
        """
        
        row = await db.execute_one(
            insert_query,
            str(prompt_id),
            str(request.version_id) if request.version_id else None,
            str(request.parent_comment_id) if request.parent_comment_id else None,
            request.content,
            request.step_index,
            str(current_user.user.id)
        )
        
        # Log activity
        await _log_activity(
            db, prompt_id, request.version_id, 'commented',
            current_user.user.id,
            f"Added a comment" + (f" on step {request.step_index + 1}" if request.step_index is not None else ""),
            {'comment_id': str(row['id']), 'is_reply': request.parent_comment_id is not None}
        )
        
        result = dict(row)
        result['author_name'] = current_user.user.full_name
        result['author_email'] = current_user.user.email
        result['replies'] = []
        
        return CommentResponse(**result)
        
    except Exception as e:
        logger.error(f"Error creating comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/comments/{comment_id}")
async def update_comment(
    comment_id: UUID,
    request: UpdateCommentRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Update a comment (only the author can update)"""
    # Verify ownership
    check_query = "SELECT author_id, prompt_id FROM planner.prompt_comments WHERE id = $1"
    comment = await db.execute_one(check_query, str(comment_id))
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if str(comment['author_id']) != str(current_user.user.id):
        raise HTTPException(status_code=403, detail="You can only edit your own comments")
    
    try:
        update_query = """
            UPDATE planner.prompt_comments
            SET content = $1, edited_at = NOW(), updated_at = NOW()
            WHERE id = $2
            RETURNING id, content, edited_at
        """
        row = await db.execute_one(update_query, request.content, str(comment_id))
        return dict(row)
    except Exception as e:
        logger.error(f"Error updating comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Delete a comment (soft delete - only the author can delete)"""
    check_query = "SELECT author_id FROM planner.prompt_comments WHERE id = $1"
    comment = await db.execute_one(check_query, str(comment_id))
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if str(comment['author_id']) != str(current_user.user.id):
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    
    try:
        await db.execute_command(
            "UPDATE planner.prompt_comments SET status = 'deleted', updated_at = NOW() WHERE id = $1",
            str(comment_id)
        )
        return {"message": "Comment deleted"}
    except Exception as e:
        logger.error(f"Error deleting comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# ACTIVITY ENDPOINTS
# =============================================================================

@router.get("/prompts/{prompt_id}/activity", response_model=List[ActivityResponse])
async def list_activity(
    prompt_id: UUID,
    limit: int = Query(default=50, le=200),
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Get activity feed for a prompt (for History sidebar)"""
    query = """
        SELECT 
            a.id, a.prompt_id, a.version_id, a.activity_type,
            a.actor_id, u.full_name as actor_name, u.email as actor_email,
            a.details, a.summary, a.created_at
        FROM planner.prompt_activity a
        LEFT JOIN core.users u ON a.actor_id = u.id
        WHERE a.prompt_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2
    """
    
    try:
        rows = await db.execute_query(query, str(prompt_id), limit)
        activities = []
        for row in rows:
            row_dict = dict(row)
            # Parse details if it's a JSON string
            if row_dict.get('details') and isinstance(row_dict['details'], str):
                row_dict['details'] = json.loads(row_dict['details'])
            activities.append(ActivityResponse(**row_dict))
        return activities
    except Exception as e:
        logger.error(f"Error fetching activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# TEAM MEMBERS FOR REVIEW ASSIGNMENT
# =============================================================================

@router.get("/prompts/{prompt_id}/available-reviewers")
async def get_available_reviewers(
    prompt_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Get list of team members available to assign as reviewers"""
    # Get the tenant/project from the prompt
    prompt_query = """
        SELECT p.project_id, proj.tenant_id
        FROM planner.prompts p
        JOIN core.projects proj ON p.project_id = proj.id
        WHERE p.id = $1
    """
    
    prompt = await db.execute_one(prompt_query, str(prompt_id))
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    # Get all team members (excluding current user)
    members_query = """
        SELECT DISTINCT u.id, u.full_name, u.email
        FROM core.users u
        LEFT JOIN core.organization_members om ON u.id = om.user_id AND om.tenant_id = $1
        LEFT JOIN core.user_tenant_roles utr ON u.id = utr.user_id AND utr.tenant_id = $1
        WHERE (om.id IS NOT NULL OR utr.id IS NOT NULL)
          AND u.id != $2
          AND u.is_active = true
        ORDER BY u.full_name
    """
    
    try:
        rows = await db.execute_query(members_query, str(prompt['tenant_id']), str(current_user.user.id))
        return [{"id": row['id'], "full_name": row['full_name'], "email": row['email']} for row in rows]
    except Exception as e:
        logger.error(f"Error fetching reviewers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def _log_activity(
    db: DatabaseManager,
    prompt_id: UUID,
    version_id: Optional[UUID],
    activity_type: str,
    actor_id: UUID,
    summary: str,
    details: Optional[Dict[str, Any]] = None
):
    """Helper to log activity"""
    try:
        await db.execute_command(
            """INSERT INTO planner.prompt_activity 
               (prompt_id, version_id, activity_type, actor_id, summary, details)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb)""",
            str(prompt_id),
            str(version_id) if version_id else None,
            activity_type,
            str(actor_id),
            summary,
            json.dumps(details or {})
        )
    except Exception as e:
        logger.warning(f"Failed to log activity: {e}")
