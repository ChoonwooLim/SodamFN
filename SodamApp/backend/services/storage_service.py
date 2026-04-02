"""
Unified File Storage Service
Priority: Cloudflare R2 > Media Server (Linux) > Local Disk
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
    """Unified file storage - R2 (cloud) > Media Server (network) > Local disk"""

    def __init__(self):
        # R2 설정
        self.account_id = os.getenv("R2_ACCOUNT_ID")
        self.access_key = os.getenv("R2_ACCESS_KEY_ID")
        self.secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = os.getenv("R2_BUCKET_NAME", "sodam-uploads")
        self.public_url = os.getenv("R2_PUBLIC_URL", "").rstrip("/")

        self.use_r2 = all([self.account_id, self.access_key, self.secret_key, self.public_url])

        # 미디어 서버 설정
        self.media_server_url = os.getenv("MEDIA_SERVER_URL", "").rstrip("/")
        self.media_api_key = os.getenv("MEDIA_API_KEY", "sodam-media-2026")
        self.use_media_server = bool(self.media_server_url)

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
            logger.info("R2 Storage initialized")
        elif self.use_media_server:
            self.s3_client = None
            logger.info(f"Media Server storage: {self.media_server_url}")
        else:
            self.s3_client = None
            logger.warning("No remote storage — using local disk")
    
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
        elif self.use_media_server:
            return self._upload_to_media_server(file_data, key, content_type)
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
        elif self.use_media_server:
            return self._delete_from_media_server(key)
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
        elif self.use_media_server:
            return f"{self.media_server_url}/files/uploads/{key}"
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
    
    def _upload_to_media_server(self, file_data: BinaryIO, key: str, content_type: str) -> str:
        """Upload to central media server (Linux)"""
        import httpx

        storage_path = f"uploads/{key}"
        data = file_data.read()

        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{self.media_server_url}/upload",
                files={"file": (key.split("/")[-1], data, content_type)},
                data={"path": storage_path},
                headers={"X-API-Key": self.media_api_key},
            )
            if response.status_code != 200:
                raise Exception(f"Media server upload failed: {response.text[:200]}")

        url = f"{self.media_server_url}/files/{storage_path}"
        logger.info(f"Media server upload: {key} -> {url}")
        return url

    def _delete_from_media_server(self, key: str) -> bool:
        """Delete from central media server"""
        import httpx

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.delete(
                    f"{self.media_server_url}/files/uploads/{key}",
                    headers={"X-API-Key": self.media_api_key},
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Media server delete error: {e}")
            return False

    def _upload_to_disk(self, file_data: BinaryIO, key: str) -> str:
        """Fallback: upload to local disk"""
        file_path = os.path.join("uploads", key)
        os.makedirs(os.path.dirname(file_path), exist_ok=True)

        with open(file_path, "wb") as f:
            import shutil
            shutil.copyfileobj(file_data, f)

        url = f"/uploads/{key}"
        logger.info(f"Local upload: {key} -> {url}")
        return url


# Singleton instance
_storage: Optional[StorageService] = None


def get_storage() -> StorageService:
    """Get the singleton StorageService instance."""
    global _storage
    if _storage is None:
        _storage = StorageService()
    return _storage
