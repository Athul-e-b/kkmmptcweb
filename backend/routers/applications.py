"""
Admission pre-registration applications — public submit (admissions.html's
pre-registration form, no login), admin-only list/update/delete
(admin.html's applicant queue). Same inverse pattern as Grievances.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/api/applications", tags=["applications"])

VALID_STATUSES = {"New Submission", "Pending Review", "Verified", "Approved"}


@router.post("", response_model=schemas.ApplicationOut)
def submit_application(payload: schemas.ApplicationCreate, db: Session = Depends(get_db)):
    app_row = models.Application(
        name=payload.name, phone=payload.phone, email=payload.email,
        dept=payload.dept, qual=payload.qual, marks=payload.marks,
    )
    db.add(app_row)
    db.commit()
    db.refresh(app_row)
    return app_row


@router.get("", response_model=List[schemas.ApplicationOut])
def list_applications(_admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    return db.query(models.Application).order_by(models.Application.created_at.desc()).all()


@router.patch("/{application_id}", response_model=schemas.ApplicationOut)
def update_application_status(
    application_id: int,
    payload: schemas.ApplicationStatusUpdate,
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    app_row = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}")
    app_row.status = payload.status
    db.commit()
    db.refresh(app_row)
    return app_row


@router.delete("/{application_id}")
def delete_application(application_id: int, _admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    app_row = db.query(models.Application).filter(models.Application.id == application_id).first()
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    db.delete(app_row)
    db.commit()
    return {"ok": True}
