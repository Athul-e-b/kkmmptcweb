"""Validated file uploads into backend/uploads/{subdir}/ with unique names."""
import os
import uuid
from typing import Optional, Set
from fastapi import HTTPException, UploadFile

BASE_UPLOADS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
VIDEO_EXT = {".mp4", ".webm"}
DOC_EXT = {".pdf"}
DOC_OFFICE_EXT = {".pdf", ".doc", ".docx"}

IMAGE_MAGIC = (
    b"\xff\xd8\xff",  # jpeg
    b"\x89PNG",
    b"RIFF",  # webp (RIFF....WEBP)
)
VIDEO_MAGIC = (
    b"\x00\x00\x00",  # mp4 ftyp often after size
    b"ftyp",
    b"\x1aE\xdf\xa3",  # webm
)


def _safe_ext(filename: str, allowed: Set[str]) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {', '.join(sorted(allowed))}")
    return ext


def _fail(status: int, detail: str, strict: bool) -> HTTPException:
    return HTTPException(status_code=status if strict else 400, detail=detail)


async def save_upload(
    file: Optional[UploadFile],
    subdir: str,
    allowed: Set[str],
    max_bytes: int,
    url_prefix: Optional[str] = None,
    strict: bool = False,
) -> Optional[str]:
    if file is None or not (file.filename or "").strip():
        return None
    if "/" in subdir or "\\" in subdir or ".." in subdir:
        raise HTTPException(status_code=400, detail="Invalid upload folder")
    try:
        ext = _safe_ext(file.filename, allowed)
    except HTTPException as exc:
        raise _fail(415, exc.detail, strict)
    contents = await file.read()
    if len(contents) > max_bytes:
        raise _fail(413, f"File too large (max {max_bytes // (1024 * 1024)}MB)", strict)
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")
    if ext in IMAGE_EXT and not (
        contents.startswith(IMAGE_MAGIC[0])
        or contents.startswith(IMAGE_MAGIC[1])
        or (contents.startswith(b"RIFF") and b"WEBP" in contents[:16])
    ):
        raise _fail(415, "File content is not a valid image", strict)
    if ext == ".pdf" and not contents.startswith(b"%PDF"):
        raise _fail(415, "File content is not a valid PDF", strict)
    if ext == ".docx" and not contents.startswith(b"PK"):
        raise _fail(415, "File content is not a valid document", strict)
    if ext == ".doc" and not contents.startswith(b"\xd0\xcf\x11\xe0"):
        raise _fail(415, "File content is not a valid document", strict)
    folder = os.path.join(BASE_UPLOADS, subdir)
    os.makedirs(folder, exist_ok=True)
    fname = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(folder, fname)
    with open(path, "wb") as fh:
        fh.write(contents)
    prefix = url_prefix or f"/uploads/{subdir}"
    return f"{prefix}/{fname}"


def delete_local_file(url: Optional[str]) -> None:
    if not url or not url.startswith("/uploads/"):
        return
    rel = url.lstrip("/")
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), rel)
    uploads_root = os.path.realpath(BASE_UPLOADS)
    real = os.path.realpath(path)
    if not real.startswith(uploads_root + os.sep):
        return
    if os.path.isfile(real):
        try:
            os.remove(real)
        except OSError:
            pass
