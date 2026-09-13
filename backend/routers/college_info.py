from fastapi import APIRouter, Depends, Form
from sqlalchemy.orm import Session

from database import get_db
import models, schemas, auth

router = APIRouter(prefix="/api/college-info", tags=["college-info"])

DEFAULTS = dict(
    name="K. Karunakaran Memorial Model Polytechnic College, Kallettumkara",
    short_name="KKMMPTC Kallettumkara",
    address="Kallettumkara P.O., Thrissur District, Kerala - 680 683, India.",
    phone="0480-2720746",
    mobile="8547005080",
    email="mptmala@ihrd.ac.in",
    website="http://mptmala.ihrd.ac.in",
    maps_url="",
    youtube_url="https://www.youtube.com/@kkmmptconline7935",
    facebook_url="",
    instagram_url="",
    office_hours="Monday–Saturday, 10:00 AM – 5:00 PM",
    established="1993",
    governing_body="Institute of Human Resources Development (IHRD), Govt. of Kerala",
    approval="AICTE New Delhi Approved & Affiliated to Board of Technical Education Kerala (SBTE)",
)


def _get_or_create(db: Session) -> models.CollegeInfo:
    row = db.query(models.CollegeInfo).first()
    if not row:
        row = models.CollegeInfo(**DEFAULTS)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("", response_model=schemas.CollegeInfoOut)
def get_college_info(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.patch("", response_model=schemas.CollegeInfoOut)
def update_college_info(
    name: str = Form(None),
    short_name: str = Form(None),
    address: str = Form(None),
    phone: str = Form(None),
    mobile: str = Form(None),
    email: str = Form(None),
    website: str = Form(None),
    maps_url: str = Form(None),
    youtube_url: str = Form(None),
    facebook_url: str = Form(None),
    instagram_url: str = Form(None),
    office_hours: str = Form(None),
    established: str = Form(None),
    governing_body: str = Form(None),
    approval: str = Form(None),
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    row = _get_or_create(db)
    for key in DEFAULTS:
        val = locals().get(key)
        if val is not None:
            setattr(row, key, val.strip() if isinstance(val, str) else val)
    db.commit()
    db.refresh(row)
    return row
