"""
Cloudflare R2 Storage Service
S3-compatible file storage using boto3.
Falls back to local disk if R2 credentials are not configured.
"""
import os
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional, BinaryIO
import mimetypes
import logging

logger = logging.getLogger(__name__)


class StorageService:
    """Unified file storage - Cloudflare R2 (primary) or local disk (fallback)"""
    
    def __init__(self):
        self.account_id = os.getenv("R2_ACCOUNT_ID")
        self.access_key = os.getenv("R2_ACCESS_KEY_ID")
        self.secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = os.getenv("R2_BUCKET_NAME", "sodam-uploads")
        self.public_url = os.getenv("R2_PUBLIC_URL", "").rstrip("/")
        
        self.use_r2 = all([self.account_id, self.access_key, self.secret_key, self.public_url])
        
        if self.use_r2:
            self.s3_client = boto3.client(
                "s3",
                endpoint_url=f"https://{self.account_id}.r2.cloudflarestorage.com",
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=Config(
                    region_name="auto",
                    s3={"addressing_style": "path"},
                ),
            )
            logger.info("✅ R2 Storage initialized")
        else:
            self.s3_client = None
            logger.warning("⚠️ R2 credentials not set — using local disk storage")
    
    def upload_file(
        self,
        file_data: BinaryIO,
        key: str,
        content_type: Optional[str] = None,
    ) -> str:
        """
        Upload a file and return its public URL.
        
        Args:
            file_data: File-like object with read()
            key: Storage key (e.g., 'staff_docs/15/health_cert_123.png')
            content_type: MIME type (auto-detected if not provided)
            
        Returns:
            Public URL string for accessing the file
        """
        if not content_type:
            content_type, _ = mimetypes.guess_type(key)
            if not content_type:
                content_type = "application/octet-stream"
        
        if self.use_r2:
            return self._upload_to_r2(file_data, key, content_type)
        else:
            return self._upload_to_disk(file_data, key)
    
    def delete_file(self, key: str) -> bool:
        """Delete a file by key. Returns True if successful."""
        if self.use_r2:
            try:
                self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
                return True
            except ClientError as e:
                logger.error(f"R2 delete error: {e}")
                return False
        else:
            file_path = os.path.join("uploads", key)
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False
    
    def get_public_url(self, key: str) -> str:
        """Get the public URL for a stored file."""
        if self.use_r2:
            return f"{self.public_url}/{key}"
        else:
            return f"/uploads/{key}"
    
    def _upload_to_r2(self, file_data: BinaryIO, key: str, content_type: str) -> str:
        """Upload to Cloudflare R2"""
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file_data.read(),
                ContentType=content_type,
            )
            url = f"{self.public_url}/{key}"
            logger.info(f"📤 R2 upload: {key} → {url}")
            return url
        except ClientError as e:
            logger.error(f"R2 upload error: {e}")
            raise Exception(f"Failed to upload to R2: {e}")
    
    def _upload_to_disk(self, file_data: BinaryIO, key: str) -> str:
        """Fallback: upload to local disk"""
        file_path = os.path.join("uploads", key)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, "wb") as f:
            import shutil
            shutil.copyfileobj(file_data, f)
        
        url = f"/uploads/{key}"
        logger.info(f"💾 Local upload: {key} → {url}")
        return url


# Singleton instance
_storage: Optional[StorageService] = None


def get_storage() -> StorageService:
    """Get the singleton StorageService instance."""
    global _storage
    if _storage is None:
        _storage = StorageService()
    return _storage
