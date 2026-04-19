"""
Unified File Storage Service
Priority: Cloudflare R2 > Media Server (Linux)
로컬 디스크 저장 금지 — 반드시 원격 스토리지에 저장해야 함
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
    """Unified file storage - R2 (cloud) or Media Server (network). No local fallback."""

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
            logger.error("STORAGE NOT CONFIGURED — set R2 or MEDIA_SERVER_URL env vars")

    def upload_file(
        self,
        file_data: BinaryIO,
        key: str,
        content_type: Optional[str] = None,
    ) -> str:
        """
        Upload a file to remote storage (R2 or Media Server).
        Raises an error if no remote storage is configured or upload fails.
        """
        if not content_type:
            content_type, _ = mimetypes.guess_type(key)
            if not content_type:
                content_type = "application/octet-stream"

        raw_data = file_data.read()

        if self.use_r2:
            return self._upload_to_r2(raw_data, key, content_type)

        if self.use_media_server:
            return self._upload_to_media_server(raw_data, key, content_type)

        raise Exception("파일 스토리지가 설정되지 않았습니다. 관리자에게 문의하세요.")

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
        return False

    def get_public_url(self, key: str) -> str:
        """Get the public URL for a stored file."""
        if self.use_r2:
            return f"{self.public_url}/{key}"
        elif self.use_media_server:
            return f"/api/media/uploads/{key}"
        return f"/uploads/{key}"

    # ── R2 ──────────────────────────────────────────

    def _upload_to_r2(self, data: bytes, key: str, content_type: str) -> str:
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
            url = f"{self.public_url}/{key}"
            logger.info(f"R2 upload: {key} -> {url}")
            return url
        except ClientError as e:
            logger.error(f"R2 upload error: {e}")
            raise Exception(f"R2 업로드 실패: {e}")

    # ── Media Server ────────────────────────────────

    def _upload_to_media_server(self, data: bytes, key: str, content_type: str) -> str:
        import httpx

        storage_path = f"uploads/{key}"

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{self.media_server_url}/upload",
                    files={"file": (key.split("/")[-1], data, content_type)},
                    data={"path": storage_path},
                    headers={"X-API-Key": self.media_api_key},
                )
                if response.status_code != 200:
                    raise Exception(f"미디어 서버 응답 오류 ({response.status_code})")
        except httpx.ConnectError:
            raise Exception("미디어 서버에 연결할 수 없습니다. 서버 상태를 확인해주세요.")
        except httpx.TimeoutException:
            raise Exception("미디어 서버 응답 시간 초과. 파일이 너무 크거나 서버가 느립니다.")

        url = f"/api/media/{storage_path}"
        logger.info(f"Media server upload: {key} -> {url}")
        return url

    def _delete_from_media_server(self, key: str) -> bool:
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


# Singleton instance
_storage: Optional[StorageService] = None


def get_storage() -> StorageService:
    """Get the singleton StorageService instance."""
    global _storage
    if _storage is None:
        _storage = StorageService()
    return _storage
