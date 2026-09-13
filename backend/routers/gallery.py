"""Campus gallery — images and videos. Public read, admin write."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from file_storage import IMAGE_EXT, VIDEO_EXT, save_upload, delete_local_file
import models, schemas, auth

router = APIRouter(prefix="/api/gallery", tags=["gallery"])
MAX_IMAGE = 6 * 1024 * 1024
MAX_VIDEO = 40 * 1024 * 1024
VALID_CATEGORIES = {
    "campus", "labs", "events", "achievements", "students", "activities",
    "workshops", "industrial-visits", "sports", "nss", "clubs", "other",
}


def _parse_dept_id(raw) -> Optional[int]:
    if raw is None or raw == "":
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid department")


def _has_file(upload: Optional[UploadFile]) -> bool:
    return bool(upload is not None and (upload.filename or "").strip())


@router.get("", response_model=List[schemas.GalleryPhotoOut])
def list_photos(
    category: Optional[str] = None,
    department: Optional[int] = None,
    media_type: Optional[str] = None,
    featured: Optional[int] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(models.GalleryPhoto)
    if category:
        q = q.filter(models.GalleryPhoto.category == category)
    if department is not None:
        q = q.filter(models.GalleryPhoto.department_id == department)
    if media_type:
        q = q.filter(models.GalleryPhoto.media_type == media_type)
    if featured is not None:
        q = q.filter(models.GalleryPhoto.featured == featured)
    q = q.order_by(models.GalleryPhoto.display_order, models.GalleryPhoto.created_at.desc())
    if offset:
        q = q.offset(offset)
    if limit:
        q = q.limit(limit)
    return q.all()


@router.post("", response_model=schemas.GalleryPhotoOut)
async def upload_media(
    category: str = Form(...),
    caption: str = Form(""),
    title: str = Form(""),
    description: str = Form(""),
    media_type: str = Form("image"),
    video_url: str = Form(""),
    department_id: Optional[str] = Form(None),
    featured: int = Form(0),
    display_order: int = Form(0),
    media_date: str = Form(""),
    image: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    category = category.lower().strip()
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Category must be one of: {', '.join(sorted(VALID_CATEGORIES))}")
    media_type = (media_type or "image").lower().strip()
    if _has_file(video) or (media_type == "video"):
        media_type = "video"
    elif _has_file(image) or media_type == "image":
        media_type = "image"
    if media_type not in ("image", "video"):
        raise HTTPException(status_code=400, detail="media_type must be image or video")

    image_url = None
    stored_video = None
    try:
        if media_type == "image":
            image_url = await save_upload(image, "gallery", IMAGE_EXT, MAX_IMAGE)
            if not image_url:
                raise HTTPException(status_code=400, detail="Please upload a JPG, JPEG, PNG or WebP image")
        else:
            stored_video = await save_upload(video, "gallery", VIDEO_EXT, MAX_VIDEO)
            stored_video = stored_video or (video_url.strip() or None)
            if not stored_video:
                raise HTTPException(status_code=400, detail="Please upload an MP4 or WebM video")

        photo = models.GalleryPhoto(
            category=category,
            caption=caption or None,
            title=title or None,
            description=description or None,
            media_type=media_type,
            image_url=image_url,
            video_url=stored_video,
            department_id=_parse_dept_id(department_id),
            featured=featured,
            display_order=display_order,
            media_date=media_date or None,
        )
        db.add(photo)
        db.commit()
        db.refresh(photo)
        return photo
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Could not save gallery item. Videos use video_url; images use image_url.",
        )
    except SQLAlchemyError:
        db.rollback()
        kind = "Video" if media_type == "video" else "Image"
        raise HTTPException(status_code=500, detail=f"{kind} upload failed. Please try again.")


@router.patch("/{photo_id}", response_model=schemas.GalleryPhotoOut)
async def update_media(
    photo_id: int,
    category: str = Form(None),
    caption: str = Form(None),
    title: str = Form(None),
    description: str = Form(None),
    media_type: str = Form(None),
    video_url: str = Form(None),
    department_id: Optional[str] = Form(None),
    featured: Optional[int] = Form(None),
    display_order: Optional[int] = Form(None),
    media_date: str = Form(None),
    image: Optional[UploadFile] = File(None),
    video: Optional[UploadFile] = File(None),
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    photo = db.query(models.GalleryPhoto).filter(models.GalleryPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    try:
        if category is not None:
            category = category.lower().strip()
            if category not in VALID_CATEGORIES:
                raise HTTPException(status_code=400, detail="Invalid category")
            photo.category = category
        if caption is not None:
            photo.caption = caption or None
        if title is not None:
            photo.title = title or None
        if description is not None:
            photo.description = description or None
        if media_type is not None and media_type.strip():
            if media_type not in ("image", "video"):
                raise HTTPException(status_code=400, detail="media_type must be image or video")
            photo.media_type = media_type
        if video_url is not None:
            photo.video_url = video_url or None
        if department_id is not None:
            photo.department_id = _parse_dept_id(department_id)
        if featured is not None:
            photo.featured = featured
        if display_order is not None:
            photo.display_order = display_order
        if media_date is not None:
            photo.media_date = media_date or None

        if _has_file(image):
            new_image = await save_upload(image, "gallery", IMAGE_EXT, MAX_IMAGE)
            if new_image:
                delete_local_file(photo.image_url)
                photo.image_url = new_image
                photo.media_type = "image"
                if photo.video_url and photo.video_url.startswith("/uploads/"):
                    delete_local_file(photo.video_url)
                photo.video_url = None
        if _has_file(video):
            new_video = await save_upload(video, "gallery", VIDEO_EXT, MAX_VIDEO)
            if new_video:
                if photo.video_url and photo.video_url.startswith("/uploads/"):
                    delete_local_file(photo.video_url)
                photo.video_url = new_video
                photo.media_type = "video"
                delete_local_file(photo.image_url)
                photo.image_url = None

        db.commit()
        db.refresh(photo)
        return photo
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update gallery item.")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Gallery update failed. Please try again.")


@router.delete("/{photo_id}")
def delete_photo(photo_id: int, _admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    photo = db.query(models.GalleryPhoto).filter(models.GalleryPhoto.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    try:
        delete_local_file(photo.image_url)
        if photo.video_url and photo.video_url.startswith("/uploads/"):
            delete_local_file(photo.video_url)
        db.delete(photo)
        db.commit()
        return {"ok": True}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not delete gallery item. Please try again.")
