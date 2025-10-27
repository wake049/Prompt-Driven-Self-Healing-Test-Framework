"""
📁 File Upload Service for Page Context Screenshots
Handles upload, storage, and management of page screenshots and related files.
"""

import os
import uuid
import shutil
from pathlib import Path
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException
import logging

logger = logging.getLogger(__name__)


class FileUploadService:
    """Service for managing uploaded screenshots and files"""
    
    def __init__(self, upload_dir: str = "uploads/screenshots"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Allowed file types
        self.allowed_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}
        self.max_file_size = 10 * 1024 * 1024  # 10MB
    
    async def upload_screenshot(self, file: UploadFile, user_id: Optional[str] = None) -> Tuple[str, str]:
        """
        Upload a screenshot file and return the file path and URL
        
        Args:
            file: The uploaded file
            user_id: Optional user ID for organization
            
        Returns:
            Tuple of (file_path, access_url)
        """
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        # Check file extension
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in self.allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File type {file_ext} not allowed. Allowed types: {', '.join(self.allowed_extensions)}"
            )
        
        # Check file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to beginning
        
        if file_size > self.max_file_size:
            raise HTTPException(
                status_code=400, 
                detail=f"File too large. Maximum size: {self.max_file_size // (1024*1024)}MB"
            )
        
        try:
            # Generate unique filename
            file_id = str(uuid.uuid4())
            safe_filename = f"{file_id}{file_ext}"
            
            # Create user directory if specified
            if user_id:
                user_dir = self.upload_dir / user_id
                user_dir.mkdir(exist_ok=True)
                file_path = user_dir / safe_filename
            else:
                file_path = self.upload_dir / safe_filename
            
            # Save file
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Generate access URL with proper forward slashes for web URLs
            relative_path = file_path.relative_to(self.upload_dir.parent)
            # Convert Windows backslashes to forward slashes for URL compatibility
            access_url = f"/uploads/{str(relative_path).replace(chr(92), '/')}"
            
            logger.info(f"📁 Screenshot uploaded: {file.filename} -> {safe_filename}")
            
            return str(file_path), access_url
            
        except Exception as e:
            logger.error(f" Failed to upload screenshot: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")
    
    def delete_screenshot(self, file_path: str) -> bool:
        """
        Delete a screenshot file
        
        Args:
            file_path: Path to the file to delete
            
        Returns:
            True if deleted successfully, False otherwise
        """
        try:
            path = Path(file_path)
            if path.exists() and path.is_file():
                path.unlink()
                logger.info(f"🗑️ Screenshot deleted: {file_path}")
                return True
            return False
        except Exception as e:
            logger.error(f" Failed to delete screenshot: {str(e)}")
            return False
    
    def get_file_info(self, file_path: str) -> Optional[dict]:
        """
        Get information about an uploaded file
        
        Args:
            file_path: Path to the file
            
        Returns:
            File information dict or None if not found
        """
        try:
            path = Path(file_path)
            if path.exists() and path.is_file():
                stat = path.stat()
                return {
                    "filename": path.name,
                    "size": stat.st_size,
                    "created": stat.st_ctime,
                    "modified": stat.st_mtime,
                    "extension": path.suffix.lower()
                }
            return None
        except Exception as e:
            logger.error(f" Failed to get file info: {str(e)}")
            return None
    
    def list_user_screenshots(self, user_id: str) -> list:
        """
        List all screenshots uploaded by a user
        
        Args:
            user_id: User ID
            
        Returns:
            List of file information dicts
        """
        try:
            user_dir = self.upload_dir / user_id
            if not user_dir.exists():
                return []
            
            screenshots = []
            for file_path in user_dir.iterdir():
                if file_path.is_file() and file_path.suffix.lower() in self.allowed_extensions:
                    file_info = self.get_file_info(str(file_path))
                    if file_info:
                        file_info['path'] = str(file_path)
                        file_info['url'] = f"/uploads/{file_path.relative_to(self.upload_dir.parent)}"
                        screenshots.append(file_info)
            
            return screenshots
        except Exception as e:
            logger.error(f" Failed to list user screenshots: {str(e)}")
            return []


# Global instance
file_upload_service = FileUploadService()