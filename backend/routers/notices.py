from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from database import get_db
from file_storage import DOC_EXT, save_upload, delete_local_file
import models, schemas, auth

router = APIRouter(prefix="/api/notices", tags=["notices"])


@router.get("", response_model=List[schemas.NoticeOut])
def list_notices(published_only: bool = True, db: Session = Depends(get_db)):
    q = db.query(models.Notice)
    if published_only:
        q = q.filter((models.Notice.is_published == 1) | (models.Notice.is_published.is_(None)))
    return q.order_by(models.Notice.created_at.desc()).all()


@router.post("", response_model=schemas.NoticeOut)
def create_notice(payload: schemas.NoticeCreate, _admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    notice = models.Notice(
        title=payload.title.strip(),
        category=payload.category,
        description=payload.description,
        link_url=payload.link_url,
        is_published=payload.is_published,
        is_important=payload.is_important,
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


@router.patch("/{notice_id}", response_model=schemas.NoticeOut)
async def update_notice(
    notice_id: int,
    title: str = Form(None),
    category: str = Form(None),
    description: str = Form(None),
    link_url: str = Form(None),
    is_published: Optional[int] = Form(None),
    is_important: Optional[int] = Form(None),
    document: Optional[UploadFile] = File(None),
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    notice = db.query(models.Notice).filter(models.Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    if title is not None:
        notice.title = title.strip()
    if category is not None:
        notice.category = category
    if description is not None:
        notice.description = description or None
    if link_url is not None:
        notice.link_url = link_url or None
    if is_published is not None:
        notice.is_published = is_published
    if is_important is not None:
        notice.is_important = is_important
    doc = await save_upload(document, "college", DOC_EXT | {".pdf"}, 8 * 1024 * 1024)
    if doc:
        delete_local_file(notice.document_url)
        notice.document_url = doc
    db.commit()
    db.refresh(notice)
    return notice


@router.delete("/{notice_id}")
def delete_notice(notice_id: int, _admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    notice = db.query(models.Notice).filter(models.Notice.id == notice_id).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    delete_local_file(notice.document_url)
    db.delete(notice)
    db.commit()
    return {"ok": True}
