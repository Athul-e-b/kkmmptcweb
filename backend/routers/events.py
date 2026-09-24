"""Department (or college-wide) events. Read is public; write needs admin login."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from database import get_db
from dept_codes import canonical_dept_code
from file_storage import IMAGE_EXT, save_upload, delete_local_file
import models, schemas, auth

router = APIRouter(prefix="/api/events", tags=["events"])
MAX_IMAGE = 6 * 1024 * 1024


@router.get("", response_model=List[schemas.EventOut])
def list_events(
    department: Optional[str] = None,
    status: Optional[str] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.Event)
    if department:
        q = q.join(models.Department).filter(models.Department.code == canonical_dept_code(department))
    if status == "all":
        pass
    elif status:
        q = q.filter(models.Event.status == status)
    else:
        q = q.filter((models.Event.status == "published") | (models.Event.status.is_(None)))
    q = q.order_by(models.Event.event_date.desc(), models.Event.created_at.desc())
    if limit:
        q = q.limit(limit)
    return q.all()


@router.post("", response_model=schemas.EventOut)
async def create_event(
    title: str = Form(...),
    description: str = Form(""),
    event_date: str = Form(""),
    start_time: str = Form(""),
    end_time: str = Form(""),
    venue: str = Form(""),
    organizer: str = Form(""),
    category: str = Form(""),
    registration_link: str = Form(""),
    status: str = Form("published"),
    department_id: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    if status not in ("published", "draft"):
        raise HTTPException(status_code=400, detail="status must be published or draft")
    image_url = await save_upload(image, "events", IMAGE_EXT, MAX_IMAGE)
    event = models.Event(
        department_id=department_id or None,
        title=title.strip(),
        description=description or None,
        event_date=event_date or None,
        start_time=start_time or None,
        end_time=end_time or None,
        venue=venue or None,
        organizer=organizer or None,
        category=category or None,
        registration_link=registration_link or None,
        status=status,
        image_url=image_url,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.patch("/{event_id}", response_model=schemas.EventOut)
async def update_event(
    event_id: int,
    title: str = Form(None),
    description: str = Form(None),
    event_date: str = Form(None),
    start_time: str = Form(None),
    end_time: str = Form(None),
    venue: str = Form(None),
    organizer: str = Form(None),
    category: str = Form(None),
    registration_link: str = Form(None),
    status: str = Form(None),
    department_id: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    remove_image: str = Form(None),
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    for key in ("title", "description", "event_date", "start_time", "end_time", "venue", "organizer", "category", "registration_link", "status"):
        val = locals().get(key)
        if val is not None:
            setattr(event, key, val or None)
    if department_id is not None:
        event.department_id = department_id or None
    if remove_image in ("1", "true", "yes"):
        delete_local_file(event.image_url)
        event.image_url = None
    new_image = await save_upload(image, "events", IMAGE_EXT, MAX_IMAGE)
    if new_image:
        delete_local_file(event.image_url)
        event.image_url = new_image
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}")
def delete_event(event_id: int, _admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    delete_local_file(event.image_url)
    db.delete(event)
    db.commit()
    return {"ok": True}
