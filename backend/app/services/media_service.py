import os
import uuid
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.media import Media

# Allowed MIME types
ALLOWED_MIME_TYPES = {
    "image/jpeg": "IMAGE",
    "image/png": "IMAGE",
    "image/webp": "IMAGE",
    "image/gif": "IMAGE",
    "audio/webm": "AUDIO",
    "audio/ogg": "AUDIO",
    "audio/mpeg": "AUDIO",
    "audio/mp3": "AUDIO",
    "audio/wav": "AUDIO",
    "audio/mp4": "AUDIO",
    "video/mp4": "VIDEO",
    "video/webm": "VIDEO",
    "application/pdf": "DOCUMENT",
}

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

class MediaService:
    @staticmethod
    def get_upload_dir() -> Path:
        upload_dir = settings.MEDIA_DIR / "uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)
        return upload_dir

    @staticmethod
    async def save_upload_file(
        db: Session,
        upload_file: UploadFile,
        owner_id: Optional[str] = None,
        is_secure_access: bool = False,
        duration_seconds: Optional[float] = None
    ) -> Dict[str, Any]:
        content_type = upload_file.content_type or "application/octet-stream"
        if content_type not in ALLOWED_MIME_TYPES:
            # Fallback check based on extension
            ext = Path(upload_file.filename).suffix.lower()
            if ext in [".jpg", ".jpeg"]:
                content_type = "image/jpeg"
            elif ext == ".png":
                content_type = "image/png"
            elif ext == ".webp":
                content_type = "image/webp"
            elif ext in [".webm", ".ogg", ".mp3", ".wav"]:
                content_type = "audio/webm"
            elif ext == ".pdf":
                content_type = "application/pdf"
            else:
                raise HTTPException(status_code=400, detail=f"Type de fichier non supporté: {content_type}")

        media_type = ALLOWED_MIME_TYPES.get(content_type, "DOCUMENT")

        file_bytes = await upload_file.read()
        file_size = len(file_bytes)
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"Fichier trop lourd ({file_size / (1024*1024):.1f}MB). Maximum autorisé : 25MB.")

        # Compute checksum
        checksum = hashlib.sha256(file_bytes).hexdigest()

        # Generate unique storage filename
        file_ext = Path(upload_file.filename).suffix.lower() or ".bin"
        unique_name = f"{uuid.uuid4()}{file_ext}"
        upload_dir = MediaService.get_upload_dir()
        dest_path = upload_dir / unique_name

        with open(dest_path, "wb") as f:
            f.write(file_bytes)

        file_url = f"/media/uploads/{unique_name}"

        media = Media(
            id=str(uuid.uuid4()),
            owner_id=owner_id,
            storage_key=str(dest_path),
            file_url=file_url,
            file_name=upload_file.filename or unique_name,
            mime_type=content_type,
            file_size=file_size,
            duration_seconds=duration_seconds,
            media_type=media_type,
            checksum=checksum,
            is_secure_access=is_secure_access,
            created_at=datetime.utcnow()
        )
        db.add(media)
        db.commit()
        db.refresh(media)

        return {
            "id": media.id,
            "file_url": media.file_url,
            "file_name": media.file_name,
            "mime_type": media.mime_type,
            "file_size": media.file_size,
            "media_type": media.media_type,
            "duration_seconds": media.duration_seconds
        }
