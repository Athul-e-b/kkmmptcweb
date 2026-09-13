from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload

from database import get_db
from file_storage import IMAGE_EXT, save_upload, delete_local_file
import models, schemas, auth

router = APIRouter(prefix="/api/departments", tags=["departments"])


def _attach_hod(dept: models.Department) -> models.Department:
    hod = None
    for s in dept.staff or []:
        role = s.role.value if hasattr(s.role, "value") else str(s.role)
        if role == "HOD":
            hod = s
            break
    dept.hod = hod
    return dept


@router.get("", response_model=List[schemas.DepartmentOut])
def list_departments(include_inactive: bool = False, db: Session = Depends(get_db)):
    q = db.query(models.Department).options(joinedload(models.Department.staff))
    if not include_inactive:
        q = q.filter((models.Department.is_active == 1) | (models.Department.is_active.is_(None)))
    rows = q.order_by(models.Department.sort_order, models.Department.code).all()
    return [_attach_hod(d) for d in rows]


@router.get("/{code}", response_model=schemas.DepartmentOut)
def get_department(code: str, db: Session = Depends(get_db)):
    dept = (
        db.query(models.Department)
        .options(joinedload(models.Department.staff))
        .filter(models.Department.code == code.upper())
        .first()
    )
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return _attach_hod(dept)


@router.post("", response_model=schemas.DepartmentOut)
async def create_department(
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    raise HTTPException(
        status_code=400,
        detail="The six existing departments cannot be added to. Edit an existing branch instead.",
    )


@router.patch("/{dept_id}", response_model=schemas.DepartmentOut)
async def update_department(
    dept_id: int,
    name: Optional[str] = Form(None),
    code: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    vision: Optional[str] = Form(None),
    mission: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    course_name: Optional[str] = Form(None),
    duration: Optional[str] = Form(None),
    intake: Optional[int] = Form(None),
    eligibility: Optional[str] = Form(None),
    other_details: Optional[str] = Form(None),
    labs_text: Optional[str] = Form(None),
    career_text: Optional[str] = Form(None),
    is_active: Optional[int] = Form(None),
    sort_order: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
    remove_image: Optional[str] = Form(None),
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    dept = db.query(models.Department).options(joinedload(models.Department.staff)).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    fields = {
        "name": name, "description": description, "vision": vision, "mission": mission,
        "phone": phone, "email": email, "course_name": course_name, "duration": duration,
        "eligibility": eligibility, "other_details": other_details, "labs_text": labs_text,
        "career_text": career_text,
    }
    for key, val in fields.items():
        if val is not None:
            setattr(dept, key, val.strip() if isinstance(val, str) else val)
    if code is not None:
        dept.code = code.strip().upper()
    if intake is not None:
        dept.intake = intake
    if is_active is not None:
        dept.is_active = is_active
    if sort_order is not None:
        dept.sort_order = sort_order
    if remove_image in ("1", "true", "yes"):
        delete_local_file(dept.image_url)
        dept.image_url = None
    new_image = await save_upload(image, "departments", IMAGE_EXT, 6 * 1024 * 1024)
    if new_image:
        delete_local_file(dept.image_url)
        dept.image_url = new_image
    db.commit()
    db.refresh(dept)
    return _attach_hod(dept)


@router.delete("/{dept_id}")
def delete_department(dept_id: int, _admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(dept)
    db.commit()
    return {"ok": True}
