"""
Grievance Redressal — the inverse access pattern from staff/events/principal:
- POST (submit) is PUBLIC — no login, so any student/parent/visitor can file one.
- GET (list) and PATCH (update status/response) require the admin password —
  grievances can include sensitive matters, so they're not publicly listable.

Categories are the standard set used by AICTE/UGC grievance redressal cells.
Ragging/harassment complaints get a note pointing to the national helpline
(1800-180-5522) both in the submission confirmation and the category list,
since that channel operates independently of any single institution and
should not be the only place a serious complaint is filed.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/api/grievances", tags=["grievances"])

VALID_CATEGORIES = {
    "Academic", "Administrative", "Examination", "Infrastructure & Facilities",
    "Ragging / Harassment", "Hostel", "Other",
}
VALID_STATUSES = {"Open", "In Progress", "Resolved", "Closed"}
VALID_YEAR_SEMESTERS = {
    "1st Year - S1",
    "1st Year - S2",
    "2nd Year - S3",
    "2nd Year - S3 (Lateral Entry)",
    "2nd Year - S4",
    "3rd Year - S5",
    "3rd Year - S6",
}
DESCRIPTION_MAX_LENGTH = 3000
STATUS_ORDER = ("Open", "In Progress", "Resolved", "Closed")


def _parse_status(status: Optional[str]) -> Optional[models.GrievanceStatusEnum]:
    if status is None or status == "":
        return None
    if status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Status must be one of: {', '.join(STATUS_ORDER)}",
        )
    return models.GrievanceStatusEnum(status)


def _subject_from_description(description: str) -> str:
    compact = " ".join(description.split())
    if len(compact) <= 200:
        return compact
    return compact[:197] + "..."


@router.post("", response_model=schemas.GrievanceSubmitted)
def submit_grievance(payload: schemas.GrievanceCreate, db: Session = Depends(get_db)):
    name = payload.name
    is_anonymous = not bool(name)

    if payload.year_semester not in VALID_YEAR_SEMESTERS:
        raise HTTPException(status_code=400, detail="Please select a valid year / semester.")

    if len(payload.description) > DESCRIPTION_MAX_LENGTH:
        raise HTTPException(status_code=400, detail="Description is too long.")

    dept = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail="Please select a valid department.")

    allowed_courses = {d.name for d in db.query(models.Department).all()}
    if payload.course not in allowed_courses:
        raise HTTPException(status_code=400, detail="Please select a valid course / programme.")

    category = payload.category if payload.category in VALID_CATEGORIES else "Other"
    subject = payload.subject or _subject_from_description(payload.description)

    row = models.Grievance(
        is_anonymous=1 if is_anonymous else 0,
        name=None if is_anonymous else name,
        email=None if is_anonymous else payload.email,
        phone=None if is_anonymous else payload.phone,
        category=category,
        department_id=payload.department_id,
        course=payload.course,
        year_semester=payload.year_semester,
        subject=subject,
        description=payload.description,
        status=models.GrievanceStatusEnum.Open,
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("", response_model=List[schemas.GrievanceOut])
def list_grievances(
    status: Optional[str] = None,
    category: Optional[str] = None,
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(models.Grievance).options(joinedload(models.Grievance.department))
    parsed = _parse_status(status)
    if parsed is not None:
        q = q.filter(models.Grievance.status == parsed)
    if category:
        q = q.filter(models.Grievance.category == category)
    return q.order_by(models.Grievance.created_at.desc()).all()


@router.get("/stats", response_model=schemas.GrievanceStats)
def grievance_stats(
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(models.Grievance.status, func.count(models.Grievance.id))
        .group_by(models.Grievance.status)
        .all()
    )
    counts = {key: 0 for key in STATUS_ORDER}
    total = 0
    for raw, n in rows:
        key = raw.value if hasattr(raw, "value") else str(raw)
        total += n
        if key in counts:
            counts[key] = n
    return {
        "all": total,
        "Open": counts["Open"],
        "In Progress": counts["In Progress"],
        "Resolved": counts["Resolved"],
        "Closed": counts["Closed"],
    }


@router.patch("/{grievance_id}", response_model=schemas.GrievanceOut)
def update_grievance(
    grievance_id: int,
    payload: schemas.GrievanceUpdate,
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    row = db.query(models.Grievance).filter(models.Grievance.id == grievance_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Grievance not found")
    if payload.status is not None:
        row.status = _parse_status(payload.status)
    if payload.admin_response is not None:
        row.admin_response = payload.admin_response
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{grievance_id}")
def delete_grievance(grievance_id: int, _admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    row = db.query(models.Grievance).filter(models.Grievance.id == grievance_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Grievance not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
