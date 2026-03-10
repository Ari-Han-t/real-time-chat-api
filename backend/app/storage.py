from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from .config import (
    ALLOWED_MESSAGE_EXTENSIONS,
    ALLOWED_PROFILE_EXTENSIONS,
    MAX_UPLOAD_BYTES,
    MESSAGE_FILE_DIR,
    PROFILE_PIC_DIR,
)


def _save_upload(file: UploadFile, destination_dir: Path, allowed_exts: set[str]) -> tuple[str, int]:
    filename = file.filename or "file"
    extension = Path(filename).suffix.lower()
    if extension not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension: {extension}",
        )

    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    file.file.close()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file upload.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File exceeds 2 MB limit.")

    saved_name = f"{uuid4().hex}{extension}"
    path = destination_dir / saved_name
    path.write_bytes(content)
    return saved_name, len(content)


def save_profile_picture(file: UploadFile) -> tuple[str, int]:
    return _save_upload(file=file, destination_dir=PROFILE_PIC_DIR, allowed_exts=ALLOWED_PROFILE_EXTENSIONS)


def save_message_attachment(file: UploadFile) -> tuple[str, int]:
    return _save_upload(file=file, destination_dir=MESSAGE_FILE_DIR, allowed_exts=ALLOWED_MESSAGE_EXTENSIONS)

