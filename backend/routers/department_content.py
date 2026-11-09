"""Department clubs, events, notices, projects, reports, gallery, and approvals.

A department user may change only their own department. Submitting, or editing
an already approved item, sets review_status to pending and takes that item
off the public site until a central admin approves it again. Older events,
notices, and gallery rows with a blank review_status stay public.
"""
import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

import auth
import models
from database import get_db
from department_labs import clean_name, clean_order, ensure_unique, next_order, refresh_labs_text, replace_labs_from_text
from dept_codes import canonical_dept_code
from file_storage import DOC_OFFICE_EXT, IMAGE_EXT, delete_local_file, save_upload

router = APIRouter(prefix="/api/department-content", tags=["department-content"])

MAX_IMAGE = 5 * 1024 * 1024
MAX_DOC = 10 * 1024 * 1024
EVENT_TYPES = {
    "workshop", "seminar", "technical competition", "industrial visit",
    "college celebration", "other",
}
PROJECT_CATEGORIES = {
    "student project", "competition result", "award", "certification", "faculty achievement",
}
NOTICE_CATEGORIES = {"circular", "announcement", "deadline"}
REVIEW = {"draft", "pending", "approved", "rejected"}


class MemberIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    role: Optional[str] = None
    year_label: Optional[str] = None
    admission_number: Optional[str] = None
    semester: Optional[str] = None
    is_active: Optional[int] = 1


class RejectIn(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


def _dept(db: Session, code: str) -> models.Department:
    row = db.query(models.Department).filter(models.Department.code == canonical_dept_code(code)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Department not found")
    return row


def _guard(actor: dict, dept: models.Department) -> None:
    auth.assert_department_access(actor, dept.id)


def _admin_only(actor: dict) -> None:
    if actor.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only a central administrator can do this.")


def _need(value: Optional[str], label: str) -> str:
    text = (value or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail=f"{label} is required")
    return text


def _choice(value: Optional[str], allowed: set, label: str) -> str:
    text = _need(value, label).lower()
    if text not in allowed:
        raise HTTPException(status_code=422, detail=f"{label} must be one of: {', '.join(sorted(allowed))}")
    return text


def _loads(raw: Optional[str]) -> list:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return []
    return data if isinstance(data, list) else []


def _members(raw: Optional[str]) -> List[MemberIn]:
    if not (raw or "").strip():
        return []
    try:
        data = json.loads(raw)
    except ValueError:
        raise HTTPException(status_code=422, detail="Student members must be a JSON list")
    if not isinstance(data, list):
        raise HTTPException(status_code=422, detail="Student members must be a JSON list")
    return [MemberIn(**item) for item in data]


async def _image(upload: Optional[UploadFile], folder: str) -> Optional[str]:
    return await save_upload(upload, folder, IMAGE_EXT, MAX_IMAGE, strict=True)


async def _doc(upload: Optional[UploadFile], folder: str) -> Optional[str]:
    return await save_upload(upload, folder, DOC_OFFICE_EXT, MAX_DOC, strict=True)


async def _images(uploads: Optional[List[UploadFile]], folder: str) -> list:
    saved = []
    for upload in uploads or []:
        url = await _image(upload, folder)
        if url:
            saved.append(url)
    return saved


def _publishes_directly(row, actor: dict) -> bool:
    """Department clubs publish immediately for the department that owns them.

    Events, notices, projects, reports, and gallery photos still wait for the
    central administrator.
    """
    return actor.get("role") == "admin" or isinstance(row, models.DepartmentClub)


def _stamp_new(row, actor: dict) -> None:
    row.created_by = actor.get("name")
    row.created_at = datetime.utcnow()
    if _publishes_directly(row, actor):
        row.review_status = "approved"
        row.approved_by = actor.get("name")
    else:
        row.review_status = "pending"
        row.approved_by = None


def _stamp_edit(row, actor: dict) -> None:
    row.updated_at = datetime.utcnow()
    if _publishes_directly(row, actor):
        row.review_status = "approved"
        row.approved_by = actor.get("name")
        row.rejection_reason = None
        return
    row.review_status = "pending"
    row.approved_by = None
    row.rejection_reason = None


def _publish_flags(row, approved: bool) -> None:
    if isinstance(row, models.Event):
        row.status = "published" if approved else "draft"
    if isinstance(row, models.Notice):
        row.is_published = 1 if approved else 0


def _visible(row) -> bool:
    status = getattr(row, "review_status", None)
    return status in (None, "approved")


def _department_club_id(db: Session, dept: models.Department, raw: Optional[str]):
    text = (raw or "").strip()
    if not text:
        return None
    try:
        club_id = int(text)
    except ValueError:
        raise HTTPException(status_code=400, detail="Choose a club from this department")
    club = db.query(models.DepartmentClub).filter(
        models.DepartmentClub.id == club_id,
        models.DepartmentClub.department_id == dept.id,
    ).first()
    if not club:
        raise HTTPException(status_code=400, detail="Choose a club from this department")
    return club.id


def _public_club(row: models.DepartmentClub) -> dict:
    data = _club_out(row)
    for member in data.get("members") or []:
        member.pop("admission_number", None)
    return data


def _club_out(row: models.DepartmentClub) -> dict:
    return {
        "id": row.id,
        "kind": "clubs",
        "department_id": row.department_id,
        "name": row.name,
        "description": row.description,
        "category": row.category,
        "coordinator": row.coordinator,
        "faculty_in_charge": row.faculty_in_charge,
        "established_on": row.established_on,
        "objectives": row.objectives,
        "activities": row.activities,
        "meeting_info": row.meeting_info,
        "logo_url": row.logo_url,
        "cover_url": row.cover_url,
        "is_active": int(row.is_active if row.is_active is not None else 1),
        "members": [
            {
                "name": m.name,
                "role": m.role,
                "year_label": m.year_label,
                "semester": m.semester,
                "admission_number": m.admission_number,
                "is_active": int(m.is_active if m.is_active is not None else 1),
            }
            for m in row.members
        ],
        "review_status": getattr(row, "review_status", None),
        "rejection_reason": row.rejection_reason,
        "academic_year": row.academic_year,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _event_out(row: models.Event) -> dict:
    return {
        "id": row.id,
        "kind": "events",
        "department_id": row.department_id,
        "title": row.title,
        "description": row.description,
        "event_date": row.event_date,
        "start_time": row.start_time,
        "end_time": row.end_time,
        "venue": row.venue,
        "event_type": row.event_type,
        "image_url": row.image_url,
        "photo_urls": _loads(row.photo_urls),
        "participant_count": row.participant_count,
        "participants_text": row.participants_text,
        "status": row.status,
        "review_status": row.review_status,
        "rejection_reason": row.rejection_reason,
        "academic_year": row.academic_year,
        "club_id": row.club_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _notice_out(row: models.Notice) -> dict:
    return {
        "id": row.id,
        "kind": "notices",
        "department_id": row.department_id,
        "title": row.title,
        "category": row.category,
        "description": row.description,
        "document_url": row.document_url,
        "deadline": row.deadline,
        "publish_date": row.created_at.date().isoformat() if row.created_at else None,
        "review_status": row.review_status,
        "rejection_reason": row.rejection_reason,
        "academic_year": row.academic_year,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _project_out(row: models.DepartmentProject) -> dict:
    return {
        "id": row.id,
        "kind": "projects",
        "department_id": row.department_id,
        "title": row.title,
        "category": row.category,
        "people": row.people,
        "event_date": row.event_date,
        "description": row.description,
        "photo_url": row.photo_url,
        "certificate_url": row.certificate_url,
        "review_status": row.review_status,
        "rejection_reason": row.rejection_reason,
        "academic_year": row.academic_year,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _report_out(row: models.ActivityReport) -> dict:
    return {
        "id": row.id,
        "kind": "reports",
        "department_id": row.department_id,
        "event_id": row.event_id,
        "title": row.title,
        "summary": row.summary,
        "academic_year": row.academic_year,
        "photo_url": row.photo_url,
        "photo_urls": _loads(row.photo_urls),
        "document_url": row.document_url,
        "review_status": row.review_status,
        "rejection_reason": row.rejection_reason,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _gallery_out(row: models.GalleryPhoto) -> dict:
    return {
        "id": row.id,
        "kind": "gallery",
        "department_id": row.department_id,
        "title": row.title or row.caption,
        "caption": row.caption,
        "image_url": row.image_url,
        "category": row.category,
        "review_status": row.review_status,
        "rejection_reason": row.rejection_reason,
        "academic_year": row.academic_year,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _match(row, status: Optional[str], year: Optional[str], search: Optional[str]) -> bool:
    if status and (getattr(row, "review_status", None) or "approved") != status:
        return False
    if year and (getattr(row, "academic_year", None) or "") != year:
        return False
    if search:
        blob = " ".join(
            str(getattr(row, key, "") or "")
            for key in ("title", "name", "description", "summary", "caption", "category", "objectives", "activities", "people")
        ).lower()
        if search.lower() not in blob:
            return False
    return True


def _page(rows: list, limit: int, offset: int) -> dict:
    limit = max(1, min(limit or 8, 50))
    offset = max(0, offset or 0)
    return {"items": rows[offset:offset + limit], "total": len(rows)}


def _owned(db: Session, model, item_id: int, dept: models.Department):
    row = db.query(model).filter(model.id == item_id, model.department_id == dept.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Item not found in this department")
    return row


@router.get("/approvals")
def list_approvals(actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    _admin_only(actor)
    items = []
    for row in db.query(models.Event).filter(models.Event.review_status == "pending").all():
        items.append(_event_out(row))
    for row in db.query(models.Notice).filter(models.Notice.review_status == "pending").all():
        items.append(_notice_out(row))
    for row in db.query(models.DepartmentProject).filter(models.DepartmentProject.review_status == "pending").all():
        items.append(_project_out(row))
    for row in db.query(models.ActivityReport).filter(models.ActivityReport.review_status == "pending").all():
        items.append(_report_out(row))
    for row in db.query(models.GalleryPhoto).filter(models.GalleryPhoto.review_status == "pending").all():
        items.append(_gallery_out(row))
    items.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return {"items": items, "total": len(items)}


def _find_any(db: Session, kind: str, item_id: int):
    model = {
        "clubs": models.DepartmentClub,
        "events": models.Event,
        "notices": models.Notice,
        "projects": models.DepartmentProject,
        "reports": models.ActivityReport,
        "gallery": models.GalleryPhoto,
    }.get(kind)
    if not model:
        raise HTTPException(status_code=404, detail="Unknown content type")
    row = db.query(model).filter(model.id == item_id).first()
    if not row or row.department_id is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return row


@router.post("/approvals/{kind}/{item_id}/approve")
def approve_item(kind: str, item_id: int, actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    _admin_only(actor)
    row = _find_any(db, kind, item_id)
    row.review_status = "approved"
    row.approved_by = actor.get("name")
    row.rejection_reason = None
    row.updated_at = datetime.utcnow()
    _publish_flags(row, True)
    db.commit()
    return {"ok": True, "review_status": "approved"}


@router.post("/approvals/{kind}/{item_id}/reject")
def reject_item(
    kind: str,
    item_id: int,
    payload: RejectIn,
    actor: dict = Depends(auth.require_actor),
    db: Session = Depends(get_db),
):
    _admin_only(actor)
    row = _find_any(db, kind, item_id)
    row.review_status = "rejected"
    row.rejection_reason = payload.reason.strip()
    row.approved_by = actor.get("name")
    row.updated_at = datetime.utcnow()
    _publish_flags(row, False)
    db.commit()
    return {"ok": True, "review_status": "rejected"}


def _public_department_clubs(db: Session, dept: models.Department) -> list:
    """Published, active clubs owned by this department. Campus clubs stay out."""
    rows = (
        db.query(models.Club)
        .options(joinedload(models.Club.activities))
        .filter(
            models.Club.department_id == dept.id,
            models.Club.club_type == "department",
            models.Club.status == "published",
            models.Club.is_published == 1,
            models.Club.is_active == 1,
        )
        .order_by(models.Club.display_order, models.Club.name)
        .all()
    )
    seen = []
    ids = set()
    for row in rows:
        if row.id in ids:
            continue
        ids.add(row.id)
        activities = [
            {"title": item.title, "event_date": item.event_date, "venue": item.venue}
            for item in (row.activities or [])
            if item.is_published and (item.title or "").strip()
        ]
        seen.append({
            "slug": row.slug,
            "name": row.name,
            "description": row.intro or row.description,
            "intro": row.intro,
            "category": row.category,
            "logo_url": row.logo_url,
            "cover_url": row.cover_url,
            "coordinator": row.coordinator,
            "faculty_in_charge": row.faculty_in_charge,
            "activities_text": row.activities_text,
            "objectives": row.objectives,
            "activities": activities,
        })
    return seen


def _active_labs(db: Session, department_id: int):
    return (
        db.query(models.DepartmentLaboratory)
        .filter(
            models.DepartmentLaboratory.department_id == department_id,
            models.DepartmentLaboratory.is_active == 1,
        )
        .order_by(models.DepartmentLaboratory.display_order, models.DepartmentLaboratory.id)
        .all()
    )


def _lab_public(row: models.DepartmentLaboratory) -> dict:
    return {
        "name": row.name,
        "description": row.description or "",
        "image_url": row.image_url or "",
        "display_order": int(row.display_order or 0),
    }


def _lab_out(row: models.DepartmentLaboratory) -> dict:
    data = _lab_public(row)
    data.update({
        "id": row.id,
        "is_active": int(row.is_active or 0),
    })
    return data


def _owned_lab(db: Session, dept: models.Department, lab_id: int) -> models.DepartmentLaboratory:
    row = (
        db.query(models.DepartmentLaboratory)
        .filter(
            models.DepartmentLaboratory.id == lab_id,
            models.DepartmentLaboratory.department_id == dept.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Laboratory not found")
    return row


@router.get("/public/{code}")
def public_bundle(code: str, db: Session = Depends(get_db)):
    dept = _dept(db, code)
    events = [
        _event_out(row)
        for row in db.query(models.Event).filter(models.Event.department_id == dept.id).all()
        if _visible(row) and row.status in (None, "published")
    ]
    notices = [
        _notice_out(row)
        for row in db.query(models.Notice).filter(models.Notice.department_id == dept.id).all()
        if _visible(row) and int(row.is_published or 0) == 1
    ]
    gallery = [
        _gallery_out(row)
        for row in db.query(models.GalleryPhoto).filter(models.GalleryPhoto.department_id == dept.id).all()
        if _visible(row) and (row.image_url or row.video_url)
    ]
    return {
        "clubs": _public_department_clubs(db, dept),
        "events": events,
        "notices": notices,
        "projects": [_project_out(row) for row in db.query(models.DepartmentProject).filter_by(department_id=dept.id, review_status="approved").all()],
        "reports": [_report_out(row) for row in db.query(models.ActivityReport).filter_by(department_id=dept.id, review_status="approved").all()],
        "gallery": gallery,
        "laboratories": [_lab_public(row) for row in _active_labs(db, dept.id)],
    }


@router.get("/{code}/summary")
def summary(code: str, actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    dept = _dept(db, code)
    _guard(actor, dept)
    def count(model, pending=False):
        q = db.query(model).filter(model.department_id == dept.id)
        if pending:
            if not hasattr(model, "review_status"):
                return 0
            q = q.filter(model.review_status == "pending")
        return q.count()
    recent = []
    for builder, model in (
        (_club_out, models.DepartmentClub),
        (_event_out, models.Event),
        (_notice_out, models.Notice),
        (_project_out, models.DepartmentProject),
        (_report_out, models.ActivityReport),
    ):
        rows = db.query(model).filter(model.department_id == dept.id).all()
        recent.extend(builder(row) for row in rows)
    recent.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return {
        "clubs": db.query(models.Club).filter(models.Club.department_id == dept.id, models.Club.club_type == "department").count(),
        "events": count(models.Event),
        "notices": count(models.Notice),
        "projects": count(models.DepartmentProject),
        "laboratories": db.query(models.DepartmentLaboratory).filter(models.DepartmentLaboratory.department_id == dept.id).count(),
        "pending": (
            count(models.Event, True) + count(models.Notice, True)
            + count(models.DepartmentProject, True) + count(models.ActivityReport, True)
            + count(models.GalleryPhoto, True)
        ),
        "recent": recent[:8],
    }


@router.patch("/{code}/profile")
async def update_profile(
    code: str,
    name: str = Form(None),
    description: str = Form(None),
    vision: str = Form(None),
    mission: str = Form(None),
    phone: str = Form(None),
    email: str = Form(None),
    course_name: str = Form(None),
    duration: str = Form(None),
    intake: Optional[int] = Form(None),
    eligibility: str = Form(None),
    other_details: str = Form(None),
    labs_text: str = Form(None),
    career_text: str = Form(None),
    image: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor),
    db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    fields = {
        "name": name, "description": description, "vision": vision, "mission": mission,
        "phone": phone, "email": email, "course_name": course_name, "duration": duration,
        "eligibility": eligibility, "other_details": other_details,
        "career_text": career_text,
    }
    for key, value in fields.items():
        if value is not None:
            setattr(dept, key, value.strip() or None)
    if labs_text is not None:
        replace_labs_from_text(db, dept, labs_text)
    if intake is not None:
        if intake < 0 or intake > 500:
            raise HTTPException(status_code=422, detail="Intake must be between 0 and 500")
        dept.intake = intake
    image_url = await _image(image, "departments")
    if image_url:
        delete_local_file(dept.image_url)
        dept.image_url = image_url
    db.commit()
    db.refresh(dept)
    return {"ok": True, "code": dept.code}


def _apply_lab(row: models.DepartmentLaboratory, name: str, description: Optional[str], display_order: int, is_active: int) -> None:
    row.name = name
    row.description = (description or "").strip() or None
    row.display_order = display_order
    row.is_active = 1 if int(is_active) else 0
    row.updated_at = datetime.utcnow()


@router.get("/{code}/laboratories")
def list_laboratories(code: str, actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    dept = _dept(db, code)
    _guard(actor, dept)
    rows = (
        db.query(models.DepartmentLaboratory)
        .filter(models.DepartmentLaboratory.department_id == dept.id)
        .order_by(models.DepartmentLaboratory.display_order, models.DepartmentLaboratory.id)
        .all()
    )
    return {"laboratories": [_lab_out(row) for row in rows]}


@router.post("/{code}/laboratories")
async def create_laboratory(
    code: str,
    name: str = Form(...),
    description: str = Form(""),
    display_order: Optional[str] = Form(None),
    is_active: int = Form(1),
    image: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor),
    db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    label = clean_name(name)
    ensure_unique(db, dept.id, label)
    row = models.DepartmentLaboratory(
        department_id=dept.id,
        name=label,
        is_active=1 if int(is_active) else 0,
        display_order=clean_order(display_order, next_order(db, dept.id)),
    )
    db.add(row)
    db.flush()
    _apply_lab(row, label, description, row.display_order, is_active)
    image_url = await _image(image, "department-labs")
    if image_url:
        row.image_url = image_url
    refresh_labs_text(db, dept)
    db.commit()
    db.refresh(row)
    return _lab_out(row)


@router.patch("/{code}/laboratories/{lab_id}")
async def update_laboratory(
    code: str,
    lab_id: int,
    name: str = Form(...),
    description: str = Form(""),
    display_order: Optional[str] = Form(None),
    is_active: int = Form(1),
    remove_image: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor),
    db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    row = _owned_lab(db, dept, lab_id)
    label = clean_name(name)
    ensure_unique(db, dept.id, label, ignore_id=row.id)
    _apply_lab(row, label, description, clean_order(display_order, int(row.display_order or 0)), is_active)
    if remove_image in ("1", "true", "yes"):
        delete_local_file(row.image_url)
        row.image_url = None
    image_url = await _image(image, "department-labs")
    if image_url:
        delete_local_file(row.image_url)
        row.image_url = image_url
    refresh_labs_text(db, dept)
    db.commit()
    db.refresh(row)
    return _lab_out(row)


@router.delete("/{code}/laboratories/{lab_id}")
def delete_laboratory(code: str, lab_id: int, actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    dept = _dept(db, code)
    _guard(actor, dept)
    row = _owned_lab(db, dept, lab_id)
    delete_local_file(row.image_url)
    db.delete(row)
    db.flush()
    refresh_labs_text(db, dept)
    db.commit()
    return {"ok": True}


def _save_members(db: Session, club: models.DepartmentClub, raw: Optional[str]) -> None:
    if raw is None:
        return
    club.members.clear()
    for member in _members(raw):
        club.members.append(models.DepartmentClubMember(
            name=member.name.strip(),
            role=(member.role or "").strip() or None,
            year_label=(member.year_label or "").strip() or None,
            admission_number=(member.admission_number or "").strip() or None,
            semester=(member.semester or "").strip() or None,
            is_active=0 if member.is_active == 0 else 1,
        ))


@router.get("/{code}/clubs")
def list_clubs(
    code: str, status: Optional[str] = None, academic_year: Optional[str] = None,
    search: Optional[str] = None, limit: int = 8, offset: int = 0,
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    rows = [row for row in db.query(models.DepartmentClub).filter_by(department_id=dept.id).all() if _match(row, status, academic_year, search)]
    page = _page(rows, limit, offset)
    page["items"] = [_club_out(row) for row in page["items"]]
    return page


@router.post("/{code}/clubs")
async def create_club(
    code: str,
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form(""),
    coordinator: str = Form(""),
    faculty_in_charge: str = Form(""),
    established_on: str = Form(""),
    objectives: str = Form(""),
    activities: str = Form(""),
    meeting_info: str = Form(""),
    academic_year: str = Form(""),
    is_active: int = Form(1),
    members: str = Form(""),
    logo: Optional[UploadFile] = File(None),
    cover: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor),
    db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    club = models.DepartmentClub(
        department_id=dept.id,
        name=_need(name, "Club name"),
        description=description.strip() or None,
        category=category.strip() or None,
        coordinator=coordinator.strip() or None,
        faculty_in_charge=faculty_in_charge.strip() or None,
        established_on=established_on.strip() or None,
        objectives=objectives.strip() or None,
        activities=activities.strip() or None,
        meeting_info=meeting_info.strip() or None,
        academic_year=academic_year.strip() or None,
        is_active=1 if int(is_active or 1) else 0,
        logo_url=await _image(logo, "clubs"),
        cover_url=await _image(cover, "clubs"),
    )
    _stamp_new(club, actor)
    _save_members(db, club, members or "[]")
    db.add(club)
    db.commit()
    db.refresh(club)
    return _club_out(club)


@router.patch("/{code}/clubs/{item_id}")
async def update_club(
    code: str, item_id: int,
    name: str = Form(None), description: str = Form(None), category: str = Form(None),
    coordinator: str = Form(None), faculty_in_charge: str = Form(None),
    established_on: str = Form(None), objectives: str = Form(None),
    activities: str = Form(None), meeting_info: str = Form(None),
    academic_year: str = Form(None), is_active: Optional[int] = Form(None),
    members: str = Form(None),
    logo: Optional[UploadFile] = File(None),
    cover: Optional[UploadFile] = File(None),
    remove_logo: str = Form(None),
    remove_cover: str = Form(None),
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    club = _owned(db, models.DepartmentClub, item_id, dept)
    if name is not None:
        club.name = _need(name, "Club name")
    for key, value in (
        ("description", description), ("category", category), ("coordinator", coordinator),
        ("faculty_in_charge", faculty_in_charge), ("established_on", established_on),
        ("objectives", objectives), ("activities", activities), ("meeting_info", meeting_info),
        ("academic_year", academic_year),
    ):
        if value is not None:
            setattr(club, key, value.strip() or None)
    if is_active is not None:
        club.is_active = 1 if int(is_active) else 0
    _save_members(db, club, members)
    if remove_logo in ("1", "true", "yes"):
        delete_local_file(club.logo_url)
        club.logo_url = None
    if remove_cover in ("1", "true", "yes"):
        delete_local_file(club.cover_url)
        club.cover_url = None
    logo_url = await _image(logo, "clubs")
    if logo_url:
        delete_local_file(club.logo_url)
        club.logo_url = logo_url
    cover_url = await _image(cover, "clubs")
    if cover_url:
        delete_local_file(club.cover_url)
        club.cover_url = cover_url
    _stamp_edit(club, actor)
    db.commit()
    db.refresh(club)
    return _club_out(club)


@router.delete("/{code}/clubs/{item_id}")
def delete_club(code: str, item_id: int, actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    dept = _dept(db, code)
    _guard(actor, dept)
    club = _owned(db, models.DepartmentClub, item_id, dept)
    delete_local_file(club.logo_url)
    delete_local_file(club.cover_url)
    db.query(models.Event).filter(models.Event.club_id == club.id).update({models.Event.club_id: None})
    db.delete(club)
    db.commit()
    return {"ok": True}


@router.get("/{code}/events")
def list_managed_events(
    code: str, status: Optional[str] = None, academic_year: Optional[str] = None,
    search: Optional[str] = None, limit: int = 8, offset: int = 0,
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    rows = [
        row for row in db.query(models.Event).filter(models.Event.department_id == dept.id).all()
        if _match(row, status, academic_year, search)
    ]
    page = _page(rows, limit, offset)
    page["items"] = [_event_out(row) for row in page["items"]]
    return page


@router.post("/{code}/events")
async def create_managed_event(
    code: str,
    title: str = Form(...),
    event_type: str = Form("other"),
    description: str = Form(""),
    event_date: str = Form(""),
    start_time: str = Form(""),
    venue: str = Form(""),
    academic_year: str = Form(""),
    participant_count: Optional[int] = Form(None),
    participants_text: str = Form(""),
    report_id: Optional[int] = Form(None),
    club_id: str = Form(""),
    poster: Optional[UploadFile] = File(None),
    photos: Optional[List[UploadFile]] = File(None),
    participants_file: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor),
    db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    extra = ""
    if participants_file and (participants_file.filename or "").strip():
        if not participants_file.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=415, detail="Participant list must be a CSV file")
        raw = (await participants_file.read()).decode("utf-8", errors="replace")
        if len(raw) > 200_000:
            raise HTTPException(status_code=413, detail="Participant file is too large")
        extra = raw.strip()
    event = models.Event(
        department_id=dept.id,
        title=_need(title, "Title"),
        event_type=_choice(event_type, EVENT_TYPES, "Event type"),
        description=description.strip() or None,
        event_date=event_date.strip() or None,
        start_time=start_time.strip() or None,
        venue=venue.strip() or None,
        academic_year=academic_year.strip() or None,
        participant_count=participant_count,
        participants_text="\n".join(part for part in (participants_text.strip(), extra) if part) or None,
        image_url=await _image(poster, "events"),
        photo_urls=json.dumps(await _images(photos, "events")) or None,
        category=event_type,
        club_id=_department_club_id(db, dept, club_id),
    )
    _stamp_new(event, actor)
    _publish_flags(event, actor.get("role") == "admin")
    db.add(event)
    db.commit()
    db.refresh(event)
    if report_id:
        report = _owned(db, models.ActivityReport, report_id, dept)
        report.event_id = event.id
        db.commit()
    return _event_out(event)


@router.patch("/{code}/events/{item_id}")
async def update_managed_event(
    code: str, item_id: int,
    title: str = Form(None), event_type: str = Form(None), description: str = Form(None),
    event_date: str = Form(None), start_time: str = Form(None), venue: str = Form(None),
    academic_year: str = Form(None), participant_count: Optional[int] = Form(None),
    participants_text: str = Form(None), club_id: str = Form(None),
    poster: Optional[UploadFile] = File(None),
    photos: Optional[List[UploadFile]] = File(None),
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    event = _owned(db, models.Event, item_id, dept)
    if title is not None:
        event.title = _need(title, "Title")
    if event_type is not None:
        event.event_type = _choice(event_type, EVENT_TYPES, "Event type")
        event.category = event.event_type
    for key, value in (
        ("description", description), ("event_date", event_date), ("start_time", start_time),
        ("venue", venue), ("academic_year", academic_year), ("participants_text", participants_text),
    ):
        if value is not None:
            setattr(event, key, value.strip() or None)
    if participant_count is not None:
        event.participant_count = participant_count
    if club_id is not None:
        event.club_id = _department_club_id(db, dept, club_id)
    poster_url = await _image(poster, "events")
    if poster_url:
        delete_local_file(event.image_url)
        event.image_url = poster_url
    added = await _images(photos, "events")
    if added:
        event.photo_urls = json.dumps(_loads(event.photo_urls) + added)
    _stamp_edit(event, actor)
    _publish_flags(event, actor.get("role") == "admin")
    db.commit()
    db.refresh(event)
    return _event_out(event)


@router.delete("/{code}/events/{item_id}")
def delete_managed_event(code: str, item_id: int, actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    dept = _dept(db, code)
    _guard(actor, dept)
    event = _owned(db, models.Event, item_id, dept)
    delete_local_file(event.image_url)
    for url in _loads(event.photo_urls):
        delete_local_file(url)
    db.delete(event)
    db.commit()
    return {"ok": True}


@router.post("/{code}/{kind}/{item_id}/submit")
def submit_item(code: str, kind: str, item_id: int, actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    dept = _dept(db, code)
    _guard(actor, dept)
    model = {
        "clubs": models.DepartmentClub, "events": models.Event, "notices": models.Notice,
        "projects": models.DepartmentProject, "reports": models.ActivityReport, "gallery": models.GalleryPhoto,
    }.get(kind)
    if not model:
        raise HTTPException(status_code=404, detail="Unknown content type")
    row = _owned(db, model, item_id, dept)
    row.review_status = "pending"
    row.rejection_reason = None
    _publish_flags(row, False)
    db.commit()
    return {"ok": True, "review_status": "pending"}


@router.get("/{code}/notices")
def list_managed_notices(
    code: str, status: Optional[str] = None, academic_year: Optional[str] = None,
    search: Optional[str] = None, limit: int = 8, offset: int = 0,
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    rows = [row for row in db.query(models.Notice).filter(models.Notice.department_id == dept.id).all() if _match(row, status, academic_year, search)]
    page = _page(rows, limit, offset)
    page["items"] = [_notice_out(row) for row in page["items"]]
    return page


@router.post("/{code}/notices")
async def create_managed_notice(
    code: str, title: str = Form(...), category: str = Form("announcement"),
    description: str = Form(""), deadline: str = Form(""), academic_year: str = Form(""),
    document: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    notice = models.Notice(
        department_id=dept.id,
        title=_need(title, "Title"),
        category=_choice(category, NOTICE_CATEGORIES, "Category"),
        description=description.strip() or None,
        deadline=deadline.strip() or None,
        academic_year=academic_year.strip() or None,
        document_url=await _doc(document, "notices"),
        is_published=1 if actor.get("role") == "admin" else 0,
    )
    _stamp_new(notice, actor)
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return _notice_out(notice)


@router.patch("/{code}/notices/{item_id}")
async def update_managed_notice(
    code: str, item_id: int, title: str = Form(None), category: str = Form(None),
    description: str = Form(None), deadline: str = Form(None), academic_year: str = Form(None),
    document: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    notice = _owned(db, models.Notice, item_id, dept)
    if title is not None:
        notice.title = _need(title, "Title")
    if category is not None:
        notice.category = _choice(category, NOTICE_CATEGORIES, "Category")
    for key, value in (("description", description), ("deadline", deadline), ("academic_year", academic_year)):
        if value is not None:
            setattr(notice, key, value.strip() or None)
    document_url = await _doc(document, "notices")
    if document_url:
        delete_local_file(notice.document_url)
        notice.document_url = document_url
    _stamp_edit(notice, actor)
    _publish_flags(notice, actor.get("role") == "admin")
    db.commit()
    db.refresh(notice)
    return _notice_out(notice)


@router.delete("/{code}/notices/{item_id}")
def delete_managed_notice(code: str, item_id: int, actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    dept = _dept(db, code)
    _guard(actor, dept)
    notice = _owned(db, models.Notice, item_id, dept)
    delete_local_file(notice.document_url)
    db.delete(notice)
    db.commit()
    return {"ok": True}


@router.get("/{code}/projects")
def list_projects(
    code: str, status: Optional[str] = None, academic_year: Optional[str] = None,
    search: Optional[str] = None, limit: int = 8, offset: int = 0,
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    rows = [row for row in db.query(models.DepartmentProject).filter_by(department_id=dept.id).all() if _match(row, status, academic_year, search)]
    page = _page(rows, limit, offset)
    page["items"] = [_project_out(row) for row in page["items"]]
    return page


@router.post("/{code}/projects")
async def create_project(
    code: str, title: str = Form(...), category: str = Form("student project"),
    people: str = Form(""), event_date: str = Form(""), description: str = Form(""),
    academic_year: str = Form(""),
    photo: Optional[UploadFile] = File(None), certificate: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    row = models.DepartmentProject(
        department_id=dept.id,
        title=_need(title, "Title"),
        category=_choice(category, PROJECT_CATEGORIES, "Category"),
        people=people.strip() or None,
        event_date=event_date.strip() or None,
        description=description.strip() or None,
        academic_year=academic_year.strip() or None,
        photo_url=await _image(photo, "projects"),
        certificate_url=await _doc(certificate, "projects"),
    )
    _stamp_new(row, actor)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _project_out(row)


@router.patch("/{code}/projects/{item_id}")
async def update_project(
    code: str, item_id: int, title: str = Form(None), category: str = Form(None),
    people: str = Form(None), event_date: str = Form(None), description: str = Form(None),
    academic_year: str = Form(None),
    photo: Optional[UploadFile] = File(None), certificate: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    row = _owned(db, models.DepartmentProject, item_id, dept)
    if title is not None:
        row.title = _need(title, "Title")
    if category is not None:
        row.category = _choice(category, PROJECT_CATEGORIES, "Category")
    for key, value in (("people", people), ("event_date", event_date), ("description", description), ("academic_year", academic_year)):
        if value is not None:
            setattr(row, key, value.strip() or None)
    photo_url = await _image(photo, "projects")
    if photo_url:
        delete_local_file(row.photo_url)
        row.photo_url = photo_url
    certificate_url = await _doc(certificate, "projects")
    if certificate_url:
        delete_local_file(row.certificate_url)
        row.certificate_url = certificate_url
    _stamp_edit(row, actor)
    db.commit()
    db.refresh(row)
    return _project_out(row)


@router.delete("/{code}/projects/{item_id}")
def delete_project(code: str, item_id: int, actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    dept = _dept(db, code)
    _guard(actor, dept)
    row = _owned(db, models.DepartmentProject, item_id, dept)
    delete_local_file(row.photo_url)
    delete_local_file(row.certificate_url)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/{code}/reports")
def list_reports(
    code: str, status: Optional[str] = None, academic_year: Optional[str] = None,
    search: Optional[str] = None, limit: int = 8, offset: int = 0,
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    rows = [row for row in db.query(models.ActivityReport).filter_by(department_id=dept.id).all() if _match(row, status, academic_year, search)]
    page = _page(rows, limit, offset)
    page["items"] = [_report_out(row) for row in page["items"]]
    return page


@router.post("/{code}/reports")
async def create_report(
    code: str, title: str = Form(...), summary: str = Form(""), academic_year: str = Form(""),
    event_id: Optional[int] = Form(None),
    photo: Optional[UploadFile] = File(None), photos: Optional[List[UploadFile]] = File(None),
    document: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    if event_id:
        _owned(db, models.Event, event_id, dept)
    row = models.ActivityReport(
        department_id=dept.id,
        event_id=event_id or None,
        title=_need(title, "Report title"),
        summary=summary.strip() or None,
        academic_year=academic_year.strip() or None,
        photo_url=await _image(photo, "reports"),
        photo_urls=json.dumps(await _images(photos, "reports")) or None,
        document_url=await _doc(document, "reports"),
    )
    _stamp_new(row, actor)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _report_out(row)


@router.patch("/{code}/reports/{item_id}")
async def update_report(
    code: str, item_id: int, title: str = Form(None), summary: str = Form(None),
    academic_year: str = Form(None), event_id: Optional[int] = Form(None),
    photo: Optional[UploadFile] = File(None), photos: Optional[List[UploadFile]] = File(None),
    document: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    row = _owned(db, models.ActivityReport, item_id, dept)
    if title is not None:
        row.title = _need(title, "Report title")
    if summary is not None:
        row.summary = summary.strip() or None
    if academic_year is not None:
        row.academic_year = academic_year.strip() or None
    if event_id:
        _owned(db, models.Event, event_id, dept)
        row.event_id = event_id
    photo_url = await _image(photo, "reports")
    if photo_url:
        delete_local_file(row.photo_url)
        row.photo_url = photo_url
    added = await _images(photos, "reports")
    if added:
        row.photo_urls = json.dumps(_loads(row.photo_urls) + added)
    document_url = await _doc(document, "reports")
    if document_url:
        delete_local_file(row.document_url)
        row.document_url = document_url
    _stamp_edit(row, actor)
    db.commit()
    db.refresh(row)
    return _report_out(row)


@router.delete("/{code}/reports/{item_id}")
def delete_report(code: str, item_id: int, actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    dept = _dept(db, code)
    _guard(actor, dept)
    row = _owned(db, models.ActivityReport, item_id, dept)
    delete_local_file(row.photo_url)
    delete_local_file(row.document_url)
    for url in _loads(row.photo_urls):
        delete_local_file(url)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/{code}/gallery")
def list_managed_gallery(
    code: str, status: Optional[str] = None, academic_year: Optional[str] = None,
    search: Optional[str] = None, limit: int = 8, offset: int = 0,
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    rows = [row for row in db.query(models.GalleryPhoto).filter(models.GalleryPhoto.department_id == dept.id).all() if _match(row, status, academic_year, search)]
    page = _page(rows, limit, offset)
    page["items"] = [_gallery_out(row) for row in page["items"]]
    return page


@router.post("/{code}/gallery")
async def create_gallery_photo(
    code: str, title: str = Form(""), academic_year: str = Form(""),
    image: UploadFile = File(...),
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    url = await _image(image, "gallery")
    if not url:
        raise HTTPException(status_code=422, detail="A photo is required")
    row = models.GalleryPhoto(
        department_id=dept.id,
        category="activities",
        title=title.strip() or None,
        caption=title.strip() or None,
        image_url=url,
        media_type="image",
        academic_year=academic_year.strip() or None,
    )
    _stamp_new(row, actor)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _gallery_out(row)


@router.patch("/{code}/gallery/{item_id}")
async def update_gallery_photo(
    code: str, item_id: int, title: str = Form(None), academic_year: str = Form(None),
    image: Optional[UploadFile] = File(None),
    actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
):
    dept = _dept(db, code)
    _guard(actor, dept)
    row = _owned(db, models.GalleryPhoto, item_id, dept)
    if title is not None:
        row.title = title.strip() or None
        row.caption = row.title
    if academic_year is not None:
        row.academic_year = academic_year.strip() or None
    image_url = await _image(image, "gallery")
    if image_url:
        delete_local_file(row.image_url)
        row.image_url = image_url
    _stamp_edit(row, actor)
    db.commit()
    db.refresh(row)
    return _gallery_out(row)


@router.delete("/{code}/gallery/{item_id}")
def delete_gallery_photo(code: str, item_id: int, actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db)):
    dept = _dept(db, code)
    _guard(actor, dept)
    row = _owned(db, models.GalleryPhoto, item_id, dept)
    delete_local_file(row.image_url)
    db.delete(row)
    db.commit()
    return {"ok": True}
