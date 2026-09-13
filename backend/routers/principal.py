"""Principal's Message — college-wide singleton. Public read; admin write."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from database import get_db
from file_storage import IMAGE_EXT, save_upload, delete_local_file
import models, schemas, auth

router = APIRouter(prefix="/api/principal", tags=["principal"])


def _get_or_create(db: Session) -> models.Principal:
    row = db.query(models.Principal).first()
    if not row:
        row = models.Principal(
            name="Principal Name Not Set", designation="Principal",
            quote="Empowering young minds with hands-on technical skills, industry exposure, and ethical values.",
            message="Welcome to our institution. This message has not been updated yet — edit it from the Admin CMS.",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("", response_model=schemas.PrincipalOut)
def get_principal(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.api_route("", methods=["POST", "PATCH"], response_model=schemas.PrincipalOut)
async def update_principal(
    name: Optional[str] = Form(None),
    designation: Optional[str] = Form(None),
    qualification: Optional[str] = Form(None),
    quote: Optional[str] = Form(None),
    message: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    remove_photo: str = Form(None),
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    row = _get_or_create(db)
    if name is not None:
        name = name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Principal name is required")
        row.name = name
    if designation is not None:
        row.designation = designation or "Principal"
    if qualification is not None:
        row.qualification = qualification or None
    if quote is not None:
        row.quote = quote or None
    if message is not None:
        row.message = message or None
    if email is not None:
        row.email = email or None
    if phone is not None:
        row.phone = phone or None
    if remove_photo in ("1", "true", "yes"):
        delete_local_file(row.photo_url)
        row.photo_url = None
    new_photo = await save_upload(photo, "principal", IMAGE_EXT, 4 * 1024 * 1024)
    if new_photo:
        delete_local_file(row.photo_url)
        row.photo_url = new_photo
    db.commit()
    db.refresh(row)
    return row
