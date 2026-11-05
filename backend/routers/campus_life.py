"""Public and admin APIs for the IIC page. Student clubs live in routers/clubs.py."""
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload

from database import get_db
from file_storage import IMAGE_EXT, save_upload, delete_local_file
import models
import auth

router = APIRouter(tags=["campus-life"])
MAX_IMAGE = 6 * 1024 * 1024


def _clean(value: Optional[str], limit: int) -> Optional[str]:
    text = (value or "").strip()
    return text[:limit] if text else None


def _flag(value: Optional[str], default: int = 0) -> int:
    if value is None or str(value).strip() == "":
        return default
    return 1 if str(value).strip().lower() in ("1", "true", "on", "yes") else 0


def _order(value: Optional[str], default: int = 0) -> int:
    if value is None or str(value).strip() == "":
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Display order must be a number")
    return max(0, min(number, 9999))


def _http_url(value: Optional[str]) -> Optional[str]:
    text = (value or "").strip()
    if not text:
        return None
    if not (text.startswith("http://") or text.startswith("https://")):
        raise HTTPException(status_code=400, detail="Link must start with http:// or https://")
    return text[:400]


def _image(row, published: int = 1) -> dict:
    return {
        "id": row.id,
        "image_url": row.image_url,
        "caption": row.caption,
        "alt_text": row.alt_text,
        "display_order": row.display_order or 0,
        "is_published": getattr(row, "is_published", published) if hasattr(row, "is_published") else published,
        "event_title": getattr(row, "event_title", None),
    }


def _activity(row) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "description": row.description,
        "event_date": row.event_date,
        "venue": row.venue,
        "category": row.category,
        "external_url": row.external_url,
        "display_order": row.display_order or 0,
        "is_published": row.is_published or 0,
        "photos": [_image(photo) for photo in row.photos],
    }


def _page(row) -> dict:
    return {
        "id": row.id,
        "hero_title": row.hero_title,
        "hero_intro": row.hero_intro,
        "hero_image_url": row.hero_image_url,
        "about": row.about,
        "vision": row.vision,
        "mission": row.mission,
        "objectives": row.objectives,
        "participation": row.participation,
        "workshops_note": row.workshops_note,
    }


def _unique_rows(rows):
    unique = []
    seen = set()
    for row in rows:
        if row.id in seen:
            continue
        seen.add(row.id)
        unique.append(row)
    return unique


def _iic_row(db: Session) -> models.IICPage:
    row = db.query(models.IICPage).order_by(models.IICPage.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="IIC page has not been set up")
    return row


async def _store_images(files: Union[UploadFile, List[UploadFile], None], subdir: str) -> List[str]:
    if files is None:
        uploads = []
    elif isinstance(files, list):
        uploads = files
    else:
        uploads = [files]
    saved = []
    try:
        for upload in uploads:
            if upload is None or not (upload.filename or "").strip():
                continue
            url = await save_upload(upload, subdir, IMAGE_EXT, MAX_IMAGE)
            if url:
                saved.append(url)
    except Exception:
        for url in saved:
            delete_local_file(url)
        raise
    return saved


@router.get("/api/iic")
def public_iic(db: Session = Depends(get_db)):
    page = _iic_row(db)
    activities = _unique_rows(
        db.query(models.IICActivity)
        .options(joinedload(models.IICActivity.photos))
        .filter(models.IICActivity.is_published == 1)
        .order_by(models.IICActivity.display_order, models.IICActivity.id)
        .all()
    )
    gallery = (
        db.query(models.IICGalleryImage)
        .filter(models.IICGalleryImage.is_published == 1)
        .order_by(models.IICGalleryImage.display_order, models.IICGalleryImage.id)
        .all()
    )
    return {"page": _page(page), "activities": [_activity(row) for row in activities], "gallery": [_image(row) for row in gallery]}


@router.get("/api/admin/iic")
def admin_iic(db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    page = _iic_row(db)
    activities = _unique_rows(
        db.query(models.IICActivity)
        .options(joinedload(models.IICActivity.photos))
        .order_by(models.IICActivity.display_order, models.IICActivity.id)
        .all()
    )
    gallery = db.query(models.IICGalleryImage).order_by(models.IICGalleryImage.display_order, models.IICGalleryImage.id).all()
    return {"page": _page(page), "activities": [_activity(row) for row in activities], "gallery": [_image(row) for row in gallery]}


@router.patch("/api/admin/iic")
async def update_iic(
    hero_title: str = Form(...),
    hero_intro: str = Form(""),
    about: str = Form(""),
    vision: str = Form(""),
    mission: str = Form(""),
    objectives: str = Form(""),
    participation: str = Form(""),
    workshops_note: str = Form(""),
    remove_hero: str = Form("0"),
    hero_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    row = _iic_row(db)
    title = _clean(hero_title, 200)
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    row.hero_title = title
    row.hero_intro = _clean(hero_intro, 2000)
    row.about = _clean(about, 4000)
    row.vision = _clean(vision, 2000)
    row.mission = _clean(mission, 2000)
    row.objectives = _clean(objectives, 4000)
    row.participation = _clean(participation, 2000)
    row.workshops_note = _clean(workshops_note, 2000)
    if _flag(remove_hero) and row.hero_image_url:
        delete_local_file(row.hero_image_url)
        row.hero_image_url = None
    if hero_image and (hero_image.filename or "").strip():
        url = await save_upload(hero_image, "iic", IMAGE_EXT, MAX_IMAGE)
        if row.hero_image_url:
            delete_local_file(row.hero_image_url)
        row.hero_image_url = url
    db.commit()
    db.refresh(row)
    return _page(row)


@router.post("/api/admin/iic/activities")
async def create_iic_activity(
    title: str = Form(...),
    description: str = Form(""),
    event_date: str = Form(""),
    venue: str = Form(""),
    category: str = Form(""),
    external_url: str = Form(""),
    display_order: str = Form("0"),
    is_published: str = Form("0"),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    name = _clean(title, 200)
    if not name:
        raise HTTPException(status_code=400, detail="Activity title is required")
    row = models.IICActivity(
        title=name,
        description=_clean(description, 4000),
        event_date=_clean(event_date, 40),
        venue=_clean(venue, 160),
        category=_clean(category, 80),
        external_url=_http_url(external_url),
        display_order=_order(display_order),
        is_published=_flag(is_published),
    )
    db.add(row)
    db.flush()
    for index, url in enumerate(await _store_images(image, "iic")):
        db.add(models.IICActivityPhoto(activity_id=row.id, image_url=url, display_order=index))
    db.commit()
    db.refresh(row)
    return _activity(row)


@router.patch("/api/admin/iic/activities/{activity_id}")
async def update_iic_activity(
    activity_id: int,
    title: str = Form(...),
    description: str = Form(""),
    event_date: str = Form(""),
    venue: str = Form(""),
    category: str = Form(""),
    external_url: str = Form(""),
    display_order: str = Form("0"),
    is_published: str = Form("0"),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    row = db.query(models.IICActivity).options(joinedload(models.IICActivity.photos)).filter(models.IICActivity.id == activity_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")
    name = _clean(title, 200)
    if not name:
        raise HTTPException(status_code=400, detail="Activity title is required")
    row.title = name
    row.description = _clean(description, 4000)
    row.event_date = _clean(event_date, 40)
    row.venue = _clean(venue, 160)
    row.category = _clean(category, 80)
    row.external_url = _http_url(external_url)
    row.display_order = _order(display_order)
    row.is_published = _flag(is_published)
    start = max([photo.display_order for photo in row.photos], default=-1) + 1
    for offset, url in enumerate(await _store_images(image, "iic")):
        db.add(models.IICActivityPhoto(activity_id=row.id, image_url=url, display_order=start + offset))
    db.commit()
    db.refresh(row)
    return _activity(row)


@router.delete("/api/admin/iic/activities/{activity_id}")
def delete_iic_activity(activity_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    row = db.query(models.IICActivity).options(joinedload(models.IICActivity.photos)).filter(models.IICActivity.id == activity_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")
    urls = [photo.image_url for photo in row.photos]
    db.delete(row)
    db.commit()
    for url in urls:
        delete_local_file(url)
    return {"ok": True}


@router.delete("/api/admin/iic/activity-photos/{photo_id}")
def delete_iic_activity_photo(photo_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    row = db.query(models.IICActivityPhoto).filter(models.IICActivityPhoto.id == photo_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Photograph not found")
    url = row.image_url
    db.delete(row)
    db.commit()
    delete_local_file(url)
    return {"ok": True}


@router.patch("/api/admin/iic/activity-photos/{photo_id}")
def update_iic_activity_photo(
    photo_id: int,
    caption: str = Form(""),
    alt_text: str = Form(""),
    display_order: str = Form("0"),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    row = db.query(models.IICActivityPhoto).filter(models.IICActivityPhoto.id == photo_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Photograph not found")
    row.caption = _clean(caption, 200)
    row.alt_text = _clean(alt_text, 200)
    row.display_order = _order(display_order)
    db.commit()
    return _image(row)


@router.post("/api/admin/iic/gallery")
async def create_iic_gallery(
    caption: str = Form(""),
    alt_text: str = Form(""),
    event_title: str = Form(""),
    display_order: str = Form("0"),
    is_published: str = Form("1"),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    urls = await _store_images(image, "iic")
    if not urls:
        raise HTTPException(status_code=400, detail="Choose at least one photograph")
    start = _order(display_order)
    created = []
    for offset, url in enumerate(urls):
        row = models.IICGalleryImage(
            image_url=url,
            caption=_clean(caption, 200),
            alt_text=_clean(alt_text, 200),
            event_title=_clean(event_title, 200),
            display_order=start + offset,
            is_published=_flag(is_published, 1),
        )
        db.add(row)
        created.append(row)
    db.commit()
    for row in created:
        db.refresh(row)
    return [_image(row) for row in created]


@router.patch("/api/admin/iic/gallery/{image_id}")
def update_iic_gallery(
    image_id: int,
    caption: str = Form(""),
    alt_text: str = Form(""),
    event_title: str = Form(""),
    display_order: str = Form("0"),
    is_published: str = Form("1"),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    row = db.query(models.IICGalleryImage).filter(models.IICGalleryImage.id == image_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Photograph not found")
    row.caption = _clean(caption, 200)
    row.alt_text = _clean(alt_text, 200)
    row.event_title = _clean(event_title, 200)
    row.display_order = _order(display_order)
    row.is_published = _flag(is_published, 1)
    db.commit()
    return _image(row)


@router.delete("/api/admin/iic/gallery/{image_id}")
def delete_iic_gallery(image_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    row = db.query(models.IICGalleryImage).filter(models.IICGalleryImage.id == image_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Photograph not found")
    url = row.image_url
    db.delete(row)
    db.commit()
    delete_local_file(url)
    return {"ok": True}
