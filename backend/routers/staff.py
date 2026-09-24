"""
Staff & HOD management, scoped per department.

Read (GET) is public — departments.html displays staff/HOD without login.
Write (POST/PATCH/DELETE) requires the shared admin password (see auth.py).
Photo upload accepts jpg/png/webp, max 4MB. Exactly one HOD per department.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from database import get_db
from dept_codes import canonical_dept_code
from file_storage import IMAGE_EXT, save_upload, delete_local_file
import models, schemas, auth

router = APIRouter(prefix="/api/staff", tags=["staff"])
MAX_PHOTO = 4 * 1024 * 1024


def _ensure_single_hod(db: Session, department_id: int, keep_id: Optional[int] = None):
    q = db.query(models.Staff).filter(
        models.Staff.department_id == department_id,
        models.Staff.role == models.RoleEnum.HOD,
    )
    if keep_id:
        q = q.filter(models.Staff.id != keep_id)
    for row in q.all():
        row.role = models.RoleEnum.Faculty


@router.get("", response_model=List[schemas.StaffOut])
def list_staff(department: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(models.Staff)
    if department:
        q = q.join(models.Department).filter(models.Department.code == canonical_dept_code(department))
    return q.order_by(models.Staff.role.desc(), models.Staff.name).all()


@router.post("", response_model=schemas.StaffOut)
async def create_staff(
    department_id: int = Form(...),
    name: str = Form(...),
    role: str = Form("Faculty"),
    designation: str = Form(""),
    qualification: str = Form(""),
    email: str = Form(""),
    phone: str = Form(""),
    is_active: int = Form(1),
    photo: Optional[UploadFile] = File(None),
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    if role not in ("HOD", "Faculty"):
        raise HTTPException(status_code=400, detail="role must be HOD or Faculty")
    dept = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail="Invalid department")
    name = (name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    photo_url = await save_upload(photo, "staff", IMAGE_EXT, MAX_PHOTO)
    if role == "HOD":
        existing = db.query(models.Staff).filter(
            models.Staff.department_id == department_id,
            models.Staff.role == models.RoleEnum.HOD,
        ).first()
        if existing:
            existing.name = name
            if photo_url:
                delete_local_file(existing.photo_url)
                existing.photo_url = photo_url
            db.commit()
            db.refresh(existing)
            return existing
    staff = models.Staff(
        department_id=department_id, name=name, role=role,
        designation=designation or None, qualification=qualification or None,
        email=email or None, phone=phone or None, photo_url=photo_url,
        is_active=is_active,
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.patch("/{staff_id}", response_model=schemas.StaffOut)
async def update_staff(
    staff_id: int,
    name: str = Form(None),
    role: str = Form(None),
    designation: str = Form(None),
    qualification: str = Form(None),
    email: str = Form(None),
    phone: str = Form(None),
    department_id: Optional[int] = Form(None),
    is_active: Optional[int] = Form(None),
    photo: Optional[UploadFile] = File(None),
    remove_photo: str = Form(None),
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    if name is not None:
        staff.name = name.strip()
    if designation is not None:
        staff.designation = designation or None
    if qualification is not None:
        staff.qualification = qualification or None
    if email is not None:
        staff.email = email or None
    if phone is not None:
        staff.phone = phone or None
    if department_id is not None:
        staff.department_id = department_id
    if is_active is not None:
        staff.is_active = is_active
    if role is not None:
        if role not in ("HOD", "Faculty"):
            raise HTTPException(status_code=400, detail="role must be HOD or Faculty")
        staff.role = role
    if role == "HOD" or staff.role == models.RoleEnum.HOD:
        _ensure_single_hod(db, staff.department_id, keep_id=staff.id)
    if remove_photo in ("1", "true", "yes"):
        delete_local_file(staff.photo_url)
        staff.photo_url = None
    new_photo = await save_upload(photo, "staff", IMAGE_EXT, MAX_PHOTO)
    if new_photo:
        delete_local_file(staff.photo_url)
        staff.photo_url = new_photo
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}")
def delete_staff(staff_id: int, _admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    delete_local_file(staff.photo_url)
    db.delete(staff)
    db.commit()
    return {"ok": True}
