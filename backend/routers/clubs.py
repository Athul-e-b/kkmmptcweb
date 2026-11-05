"""Campus and department student clubs, members, activities, and galleries."""
import re
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

import auth
import models
from database import get_db
from dept_codes import canonical_dept_code
from file_storage import IMAGE_EXT, delete_local_file, save_upload

router = APIRouter(tags=["clubs"])
MAX_IMAGE = 6 * 1024 * 1024
CATEGORIES = ("Technical", "Cultural", "Sports", "Arts", "Music", "Social", "Other")
STATUSES = ("published", "draft", "inactive")


def _clean(value: Optional[str], limit: int) -> Optional[str]:
    text = (value or "").strip()
    return text[:limit] if text else None


def _order(value: Optional[str], default: int = 0) -> int:
    if value is None or str(value).strip() == "":
        return default
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Display order must be a number")
    return max(0, min(number, 9999))


def _flag(value: Optional[str], default: int = 0) -> int:
    if value is None or str(value).strip() == "":
        return default
    return 1 if str(value).strip().lower() in ("1", "true", "on", "yes", "published") else 0


def _slug(db: Session, name: str, keep_id: Optional[int] = None) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")[:32] or "club"
    candidate = base
    number = 2
    while True:
        taken = db.query(models.Club).filter(models.Club.slug == candidate)
        if keep_id:
            taken = taken.filter(models.Club.id != keep_id)
        if not taken.first():
            return candidate
        candidate = f"{base[:28]}-{number}"[:40]
        number += 1


def _apply_status(row: models.Club, status: Optional[str]) -> None:
    value = (status or row.status or "draft").strip().lower()
    if value not in STATUSES:
        raise HTTPException(status_code=400, detail="Status must be Published, Draft, or Inactive")
    row.status = value
    row.is_published = 1 if value == "published" else 0
    row.is_active = 0 if value == "inactive" else 1


def _category(value: Optional[str]) -> Optional[str]:
    text = (value or "").strip()
    if not text:
        return None
    match = next((item for item in CATEGORIES if item.lower() == text.lower()), None)
    if not match:
        raise HTTPException(status_code=400, detail="Choose a club category")
    return match


def _load(db: Session, club_id: int) -> models.Club:
    row = (
        db.query(models.Club)
        .options(
            joinedload(models.Club.activities),
            joinedload(models.Club.images),
            joinedload(models.Club.members),
            joinedload(models.Club.department),
        )
        .filter(models.Club.id == club_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Club not found")
    return row


def _activity(row: models.ClubActivity) -> dict:
    return {
        "id": row.id,
        "club_id": row.club_id,
        "title": row.title,
        "description": row.description,
        "event_date": row.event_date,
        "venue": row.venue,
        "display_order": row.display_order or 0,
        "is_published": row.is_published or 0,
        "status": "published" if row.is_published else "draft",
    }


def _image(row: models.ClubImage) -> dict:
    return {
        "id": row.id,
        "club_id": row.club_id,
        "image_url": row.image_url,
        "caption": row.caption,
        "alt_text": row.alt_text,
        "display_order": row.display_order or 0,
        "is_published": row.is_published or 0,
    }


def _member(row: models.ClubMember, private: bool) -> dict:
    data = {
        "id": row.id,
        "name": row.name,
        "role": row.role,
        "photo_url": row.photo_url,
        "display_order": row.display_order or 0,
        "is_active": int(row.is_active if row.is_active is not None else 1),
    }
    if private:
        data["admission_number"] = row.admission_number
    return data


def _club(row: models.Club, private: bool) -> dict:
    activities = list(row.activities or [])
    images = list(row.images or [])
    members = list(row.members or [])
    if not private:
        activities = [item for item in activities if item.is_published]
        images = [item for item in images if item.is_published]
        members = [item for item in members if int(item.is_active if item.is_active is not None else 1) == 1]
    dept = row.department
    data = {
        "id": row.id,
        "slug": row.slug,
        "name": row.name,
        "intro": row.intro,
        "description": row.description,
        "category": row.category,
        "club_type": row.club_type or "campus",
        "department_id": row.department_id,
        "department_code": dept.code if dept else None,
        "department_name": dept.name if dept else None,
        "status": row.status or ("published" if row.is_published else "draft"),
        "display_order": row.display_order or 0,
        "is_published": row.is_published or 0,
        "is_active": int(row.is_active if row.is_active is not None else 1),
        "objectives": row.objectives,
        "activities_text": row.activities_text,
        "meeting_info": row.meeting_info,
        "established_on": row.established_on,
        "coordinator": row.coordinator,
        "faculty_in_charge": row.faculty_in_charge,
        "logo_url": row.logo_url,
        "cover_url": row.cover_url,
        "activities": [_activity(item) for item in activities],
        "images": [_image(item) for item in images],
        "members": [_member(item, private) for item in members],
    }
    if private:
        data["contact_info"] = row.contact_info
    return data


def _visible(query):
    return query.filter(
        models.Club.status == "published",
        models.Club.is_published == 1,
        models.Club.is_active == 1,
    )


def _require_manage(actor: dict, club: models.Club) -> None:
    if not actor:
        raise HTTPException(status_code=401, detail="Login required")
    if actor.get("role") == "admin":
        return
    user = actor.get("user")
    if (
        actor.get("role") != "department"
        or not user
        or (club.club_type or "") != "department"
        or int(club.department_id or 0) != int(user.department_id)
    ):
        raise HTTPException(status_code=403, detail="You can only manage clubs from your own department.")


def _department(actor: dict, db: Session, code: Optional[str]) -> models.Department:
    if actor.get("role") == "department":
        user = actor.get("user")
        dept = db.query(models.Department).filter(models.Department.id == user.department_id).first()
        if not dept:
            raise HTTPException(status_code=404, detail="Department not found")
        if code and canonical_dept_code(code) != dept.code:
            raise HTTPException(status_code=403, detail="You can only manage clubs from your own department.")
        return dept
    if actor.get("role") != "admin":
        raise HTTPException(status_code=401, detail="Login required")
    if not code:
        raise HTTPException(status_code=400, detail="Choose a department")
    dept = db.query(models.Department).filter(models.Department.code == canonical_dept_code(code)).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept


def _apply_fields(row: models.Club, **fields) -> None:
    mapping = {
        "intro": 2000,
        "description": 4000,
        "objectives": 4000,
        "activities_text": 4000,
        "meeting_info": 1000,
        "established_on": 40,
        "coordinator": 120,
        "faculty_in_charge": 120,
        "contact_info": 400,
    }
    for key, limit in mapping.items():
        if fields.get(key) is not None:
            setattr(row, key, _clean(fields[key], limit))
    if fields.get("name") is not None:
        name = _clean(fields["name"], 120)
        if not name:
            raise HTTPException(status_code=400, detail="Club name is required")
        row.name = name
    if fields.get("category") is not None:
        row.category = _category(fields["category"])
    if fields.get("display_order") is not None:
        row.display_order = _order(fields["display_order"])
    if fields.get("status") is not None:
        _apply_status(row, fields["status"])


def _assign_owner(row: models.Club, db: Session, club_type: str, department_id: Optional[str]) -> None:
    kind = (club_type or "campus").strip().lower()
    if kind not in ("campus", "department"):
        raise HTTPException(status_code=400, detail="Club type must be Campus Club or Department Club")
    if kind == "campus":
        row.club_type = "campus"
        row.department_id = None
        return
    try:
        dept_id = int(department_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Choose a department for a department club")
    dept = db.query(models.Department).filter(models.Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail="Choose a department for a department club")
    row.club_type = "department"
    row.department_id = dept.id


async def _photo(upload: Optional[UploadFile], folder: str) -> Optional[str]:
    return await save_upload(upload, folder, IMAGE_EXT, MAX_IMAGE, strict=True)


def _drop_file(url: Optional[str], db: Session) -> None:
    if not url:
        return
    used = (
        db.query(models.ClubImage).filter(models.ClubImage.image_url == url).count()
        + db.query(models.Club).filter((models.Club.logo_url == url) | (models.Club.cover_url == url)).count()
        + db.query(models.ClubMember).filter(models.ClubMember.photo_url == url).count()
    )
    if used == 0:
        delete_local_file(url)


@router.get("/api/clubs")
def public_clubs(department: Optional[str] = None, db: Session = Depends(get_db)):
    query = _visible(
        db.query(models.Club).options(
            joinedload(models.Club.activities),
            joinedload(models.Club.images),
            joinedload(models.Club.members),
            joinedload(models.Club.department),
        )
    )
    if department:
        dept = db.query(models.Department).filter(models.Department.code == canonical_dept_code(department)).first()
        if not dept:
            return []
        query = query.filter(models.Club.department_id == dept.id, models.Club.club_type == "department")
    rows = query.order_by(models.Club.display_order, models.Club.name).all()
    seen = []
    ids = set()
    for row in rows:
        if row.id in ids:
            continue
        ids.add(row.id)
        seen.append(_club(row, False))
    return seen


@router.get("/api/clubs/{slug}")
def public_club(slug: str, db: Session = Depends(get_db)):
    row = (
        _visible(db.query(models.Club))
        .options(
            joinedload(models.Club.activities),
            joinedload(models.Club.images),
            joinedload(models.Club.members),
            joinedload(models.Club.department),
        )
        .filter(models.Club.slug == slug)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Club not found")
    return _club(row, False)


@router.get("/api/admin/clubs")
def admin_clubs(db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    rows = (
        db.query(models.Club)
        .options(
            joinedload(models.Club.activities),
            joinedload(models.Club.images),
            joinedload(models.Club.members),
            joinedload(models.Club.department),
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
        seen.append(_club(row, True))
    return seen


@router.post("/api/admin/clubs")
async def create_admin_club(
    name: str = Form(...),
    category: str = Form(""),
    club_type: str = Form("campus"),
    department_id: str = Form(""),
    status: str = Form("draft"),
    display_order: str = Form("0"),
    intro: str = Form(""),
    description: str = Form(""),
    objectives: str = Form(""),
    activities_text: str = Form(""),
    meeting_info: str = Form(""),
    established_on: str = Form(""),
    coordinator: str = Form(""),
    faculty_in_charge: str = Form(""),
    contact_info: str = Form(""),
    logo: Optional[UploadFile] = File(None),
    cover: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    row = models.Club(slug=_slug(db, name), name="Club")
    _apply_fields(
        row, name=name, category=category, status=status, display_order=display_order,
        intro=intro, description=description, objectives=objectives, activities_text=activities_text,
        meeting_info=meeting_info, established_on=established_on, coordinator=coordinator,
        faculty_in_charge=faculty_in_charge, contact_info=contact_info,
    )
    _assign_owner(row, db, club_type, department_id)
    row.slug = _slug(db, row.name)
    row.logo_url = await _photo(logo, "clubs")
    row.cover_url = await _photo(cover, "clubs")
    db.add(row)
    db.commit()
    return _club(_load(db, row.id), True)


@router.patch("/api/admin/clubs/{club_id}")
async def update_admin_club(
    club_id: int,
    name: str = Form(None),
    category: str = Form(None),
    club_type: str = Form(None),
    department_id: str = Form(None),
    status: str = Form(None),
    display_order: str = Form(None),
    intro: str = Form(None),
    description: str = Form(None),
    objectives: str = Form(None),
    activities_text: str = Form(None),
    meeting_info: str = Form(None),
    established_on: str = Form(None),
    coordinator: str = Form(None),
    faculty_in_charge: str = Form(None),
    contact_info: str = Form(None),
    remove_logo: str = Form(None),
    remove_cover: str = Form(None),
    logo: Optional[UploadFile] = File(None),
    cover: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    row = _load(db, club_id)
    _apply_fields(
        row, name=name, category=category, status=status, display_order=display_order,
        intro=intro, description=description, objectives=objectives, activities_text=activities_text,
        meeting_info=meeting_info, established_on=established_on, coordinator=coordinator,
        faculty_in_charge=faculty_in_charge, contact_info=contact_info,
    )
    if name is not None:
        row.slug = _slug(db, row.name, row.id)
    if club_type is not None or department_id is not None:
        _assign_owner(row, db, club_type or row.club_type, department_id if department_id is not None else row.department_id)
    if remove_logo in ("1", "true", "yes"):
        old = row.logo_url
        row.logo_url = None
        db.flush()
        _drop_file(old, db)
    if remove_cover in ("1", "true", "yes"):
        old = row.cover_url
        row.cover_url = None
        db.flush()
        _drop_file(old, db)
    logo_url = await _photo(logo, "clubs")
    if logo_url:
        old = row.logo_url
        row.logo_url = logo_url
        db.flush()
        _drop_file(old, db)
    cover_url = await _photo(cover, "clubs")
    if cover_url:
        old = row.cover_url
        row.cover_url = cover_url
        db.flush()
        _drop_file(old, db)
    db.commit()
    return _club(_load(db, row.id), True)


def _publication_state(row: models.Club) -> str:
    if (row.status or "") == "inactive" or int(row.is_active if row.is_active is not None else 1) == 0:
        return "inactive"
    if (row.status or "") == "published" and int(row.is_published or 0) == 1:
        return "published"
    return "draft"


@router.post("/api/admin/clubs/{club_id}/publish")
def publish_admin_club(club_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    """Publish one existing club. Content, owner, and photographs stay as they are."""
    row = _load(db, club_id)
    state = _publication_state(row)
    if state == "inactive":
        raise HTTPException(status_code=400, detail="Activate this club before publishing. Set its status to Draft, then use Post.")
    if state != "published":
        _apply_status(row, "published")
        db.commit()
        row = _load(db, club_id)
    return _club(row, True)


@router.post("/api/admin/clubs/{club_id}/unpublish")
def unpublish_admin_club(club_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    """Hide one club from public pages without deleting it."""
    row = _load(db, club_id)
    state = _publication_state(row)
    if state == "inactive":
        raise HTTPException(status_code=400, detail="This club is inactive and already hidden from public pages.")
    if state == "published":
        _apply_status(row, "draft")
        db.commit()
        row = _load(db, club_id)
    return _club(row, True)


@router.delete("/api/admin/clubs/{club_id}")
def delete_admin_club(club_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    row = _load(db, club_id)
    urls = [row.logo_url, row.cover_url]
    urls += [image.image_url for image in row.images]
    urls += [member.photo_url for member in row.members]
    db.delete(row)
    db.commit()
    for url in urls:
        _drop_file(url, db)
    return {"ok": True}


def _activity_row(db: Session, club_id: int, activity_id: int) -> models.ClubActivity:
    row = db.query(models.ClubActivity).filter(
        models.ClubActivity.id == activity_id, models.ClubActivity.club_id == club_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")
    return row


def _image_row(db: Session, club_id: int, image_id: int) -> models.ClubImage:
    row = db.query(models.ClubImage).filter(
        models.ClubImage.id == image_id, models.ClubImage.club_id == club_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Photograph not found")
    return row


def _member_row(db: Session, club_id: int, member_id: int) -> models.ClubMember:
    row = db.query(models.ClubMember).filter(
        models.ClubMember.id == member_id, models.ClubMember.club_id == club_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Member not found")
    return row


@router.post("/api/admin/clubs/{club_id}/activities")
def create_admin_activity(
    club_id: int,
    title: str = Form(...),
    description: str = Form(""),
    event_date: str = Form(""),
    venue: str = Form(""),
    display_order: str = Form("0"),
    is_published: str = Form("0"),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    club = _load(db, club_id)
    name = _clean(title, 200)
    if not name:
        raise HTTPException(status_code=400, detail="Activity title is required")
    row = models.ClubActivity(
        club_id=club.id, title=name, description=_clean(description, 4000),
        event_date=_clean(event_date, 40), venue=_clean(venue, 160),
        display_order=_order(display_order), is_published=_flag(is_published),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _activity(row)


@router.patch("/api/admin/clubs/{club_id}/activities/{activity_id}")
def update_admin_activity(
    club_id: int, activity_id: int,
    title: str = Form(...), description: str = Form(""), event_date: str = Form(""),
    venue: str = Form(""), display_order: str = Form("0"), is_published: str = Form("0"),
    db: Session = Depends(get_db), _=Depends(auth.require_admin),
):
    _load(db, club_id)
    row = _activity_row(db, club_id, activity_id)
    name = _clean(title, 200)
    if not name:
        raise HTTPException(status_code=400, detail="Activity title is required")
    row.title = name
    row.description = _clean(description, 4000)
    row.event_date = _clean(event_date, 40)
    row.venue = _clean(venue, 160)
    row.display_order = _order(display_order)
    row.is_published = _flag(is_published)
    db.commit()
    return _activity(row)


@router.delete("/api/admin/clubs/{club_id}/activities/{activity_id}")
def delete_admin_activity(club_id: int, activity_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    row = _activity_row(db, club_id, activity_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/api/admin/clubs/{club_id}/gallery")
async def create_admin_gallery(
    club_id: int,
    caption: str = Form(""), alt_text: str = Form(""), display_order: str = Form("0"),
    is_published: str = Form("0"), image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db), _=Depends(auth.require_admin),
):
    club = _load(db, club_id)
    url = await _photo(image, "club-gallery")
    if not url:
        raise HTTPException(status_code=400, detail="Choose a photograph")
    row = models.ClubImage(
        club_id=club.id, image_url=url, caption=_clean(caption, 200), alt_text=_clean(alt_text, 200),
        display_order=_order(display_order), is_published=_flag(is_published),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _image(row)


@router.patch("/api/admin/clubs/{club_id}/gallery/{image_id}")
def update_admin_gallery(
    club_id: int, image_id: int,
    caption: str = Form(""), alt_text: str = Form(""), display_order: str = Form("0"),
    is_published: str = Form("1"),
    db: Session = Depends(get_db), _=Depends(auth.require_admin),
):
    row = _image_row(db, club_id, image_id)
    row.caption = _clean(caption, 200)
    row.alt_text = _clean(alt_text, 200)
    row.display_order = _order(display_order)
    row.is_published = _flag(is_published, 1)
    db.commit()
    return _image(row)


@router.delete("/api/admin/clubs/{club_id}/gallery/{image_id}")
def delete_admin_gallery(club_id: int, image_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    row = _image_row(db, club_id, image_id)
    url = row.image_url
    db.delete(row)
    db.commit()
    _drop_file(url, db)
    return {"ok": True}


@router.post("/api/admin/clubs/{club_id}/members")
async def create_admin_member(
    club_id: int,
    name: str = Form(...), role: str = Form(""), admission_number: str = Form(""),
    display_order: str = Form(""), photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db), _=Depends(auth.require_admin),
):
    club = _load(db, club_id)
    member_name = _clean(name, 120)
    if not member_name:
        raise HTTPException(status_code=400, detail="Student name is required")
    order = _order(display_order, max((item.display_order or 0) for item in club.members) + 1 if club.members else 0)
    row = models.ClubMember(
        club_id=club.id, name=member_name, role=_clean(role, 80),
        admission_number=_clean(admission_number, 40), display_order=order, is_active=1,
        photo_url=await _photo(photo, "club-members"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _member(row, True)


@router.patch("/api/admin/clubs/{club_id}/members/{member_id}")
async def update_admin_member(
    club_id: int, member_id: int,
    name: str = Form(None), role: str = Form(None), admission_number: str = Form(None),
    display_order: str = Form(None), is_active: str = Form(None),
    photo: Optional[UploadFile] = File(None), remove_photo: str = Form(None),
    db: Session = Depends(get_db), _=Depends(auth.require_admin),
):
    row = _member_row(db, club_id, member_id)
    if name is not None:
        member_name = _clean(name, 120)
        if not member_name:
            raise HTTPException(status_code=400, detail="Student name is required")
        row.name = member_name
    if role is not None:
        row.role = _clean(role, 80)
    if admission_number is not None:
        row.admission_number = _clean(admission_number, 40)
    if display_order is not None:
        row.display_order = _order(display_order)
    if is_active is not None:
        row.is_active = _flag(is_active, 1)
    if remove_photo in ("1", "true", "yes"):
        old = row.photo_url
        row.photo_url = None
        db.flush()
        _drop_file(old, db)
    photo_url = await _photo(photo, "club-members")
    if photo_url:
        old = row.photo_url
        row.photo_url = photo_url
        db.flush()
        _drop_file(old, db)
    db.commit()
    return _member(row, True)


@router.delete("/api/admin/clubs/{club_id}/members/{member_id}")
def delete_admin_member(club_id: int, member_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    row = _member_row(db, club_id, member_id)
    url = row.photo_url
    db.delete(row)
    db.commit()
    _drop_file(url, db)
    return {"ok": True}


def _dept_routes():
    """Department-scoped copies. Ownership is checked on every write."""

    @router.get("/api/department-clubs")
    def list_department_clubs(
        code: Optional[str] = None,
        actor: dict = Depends(auth.require_actor),
        db: Session = Depends(get_db),
    ):
        dept = _department(actor, db, code)
        rows = (
            db.query(models.Club)
            .options(
                joinedload(models.Club.activities),
                joinedload(models.Club.images),
                joinedload(models.Club.members),
                joinedload(models.Club.department),
            )
            .filter(models.Club.department_id == dept.id, models.Club.club_type == "department")
            .order_by(models.Club.display_order, models.Club.name)
            .all()
        )
        seen = []
        ids = set()
        for row in rows:
            if row.id in ids:
                continue
            ids.add(row.id)
            seen.append(_club(row, True))
        return seen

    @router.post("/api/department-clubs")
    async def create_department_club(
        code: str = Form(""),
        name: str = Form(...),
        category: str = Form(""),
        status: str = Form("draft"),
        display_order: str = Form("0"),
        intro: str = Form(""),
        description: str = Form(""),
        objectives: str = Form(""),
        activities_text: str = Form(""),
        meeting_info: str = Form(""),
        established_on: str = Form(""),
        coordinator: str = Form(""),
        faculty_in_charge: str = Form(""),
        contact_info: str = Form(""),
        logo: Optional[UploadFile] = File(None),
        cover: Optional[UploadFile] = File(None),
        actor: dict = Depends(auth.require_actor),
        db: Session = Depends(get_db),
    ):
        dept = _department(actor, db, code or None)
        row = models.Club(slug=_slug(db, name), name="Club", club_type="department", department_id=dept.id)
        _apply_fields(
            row, name=name, category=category, status=status, display_order=display_order,
            intro=intro, description=description, objectives=objectives, activities_text=activities_text,
            meeting_info=meeting_info, established_on=established_on, coordinator=coordinator,
            faculty_in_charge=faculty_in_charge, contact_info=contact_info,
        )
        row.club_type = "department"
        row.department_id = dept.id
        row.slug = _slug(db, row.name)
        row.logo_url = await _photo(logo, "clubs")
        row.cover_url = await _photo(cover, "clubs")
        db.add(row)
        db.commit()
        return _club(_load(db, row.id), True)

    @router.patch("/api/department-clubs/{club_id}")
    async def update_department_club(
        club_id: int,
        code: str = Form(""),
        name: str = Form(None),
        category: str = Form(None),
        status: str = Form(None),
        display_order: str = Form(None),
        intro: str = Form(None),
        description: str = Form(None),
        objectives: str = Form(None),
        activities_text: str = Form(None),
        meeting_info: str = Form(None),
        established_on: str = Form(None),
        coordinator: str = Form(None),
        faculty_in_charge: str = Form(None),
        contact_info: str = Form(None),
        club_type: str = Form(None),
        department_id: str = Form(None),
        remove_logo: str = Form(None),
        remove_cover: str = Form(None),
        logo: Optional[UploadFile] = File(None),
        cover: Optional[UploadFile] = File(None),
        actor: dict = Depends(auth.require_actor),
        db: Session = Depends(get_db),
    ):
        dept = _department(actor, db, code or None)
        row = _load(db, club_id)
        _require_manage(actor, row)
        if int(row.department_id or 0) != int(dept.id):
            raise HTTPException(status_code=403, detail="You can only manage clubs from your own department.")
        if actor.get("role") != "admin" and (club_type or department_id):
            raise HTTPException(status_code=403, detail="You cannot change which department owns this club.")
        _apply_fields(
            row, name=name, category=category, status=status, display_order=display_order,
            intro=intro, description=description, objectives=objectives, activities_text=activities_text,
            meeting_info=meeting_info, established_on=established_on, coordinator=coordinator,
            faculty_in_charge=faculty_in_charge, contact_info=contact_info,
        )
        row.club_type = "department"
        row.department_id = dept.id
        if name is not None:
            row.slug = _slug(db, row.name, row.id)
        if remove_logo in ("1", "true", "yes"):
            old = row.logo_url
            row.logo_url = None
            db.flush()
            _drop_file(old, db)
        if remove_cover in ("1", "true", "yes"):
            old = row.cover_url
            row.cover_url = None
            db.flush()
            _drop_file(old, db)
        logo_url = await _photo(logo, "clubs")
        if logo_url:
            old = row.logo_url
            row.logo_url = logo_url
            db.flush()
            _drop_file(old, db)
        cover_url = await _photo(cover, "clubs")
        if cover_url:
            old = row.cover_url
            row.cover_url = cover_url
            db.flush()
            _drop_file(old, db)
        db.commit()
        return _club(_load(db, row.id), True)

    @router.delete("/api/department-clubs/{club_id}")
    def delete_department_club(
        club_id: int, code: Optional[str] = None,
        actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
    ):
        dept = _department(actor, db, code)
        row = _load(db, club_id)
        _require_manage(actor, row)
        if int(row.department_id or 0) != int(dept.id):
            raise HTTPException(status_code=403, detail="You can only manage clubs from your own department.")
        urls = [row.logo_url, row.cover_url]
        urls += [image.image_url for image in row.images]
        urls += [member.photo_url for member in row.members]
        db.delete(row)
        db.commit()
        for url in urls:
            _drop_file(url, db)
        return {"ok": True}

    def _owned(club_id: int, actor: dict, db: Session, code: Optional[str]) -> models.Club:
        dept = _department(actor, db, code)
        row = _load(db, club_id)
        _require_manage(actor, row)
        if int(row.department_id or 0) != int(dept.id):
            raise HTTPException(status_code=403, detail="You can only manage clubs from your own department.")
        return row

    @router.post("/api/department-clubs/{club_id}/activities")
    def create_department_activity(
        club_id: int, title: str = Form(...), description: str = Form(""), event_date: str = Form(""),
        venue: str = Form(""), display_order: str = Form("0"), is_published: str = Form("0"),
        code: str = Form(""),
        actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
    ):
        club = _owned(club_id, actor, db, code or None)
        name = _clean(title, 200)
        if not name:
            raise HTTPException(status_code=400, detail="Activity title is required")
        row = models.ClubActivity(
            club_id=club.id, title=name, description=_clean(description, 4000),
            event_date=_clean(event_date, 40), venue=_clean(venue, 160),
            display_order=_order(display_order), is_published=_flag(is_published),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _activity(row)

    @router.patch("/api/department-clubs/{club_id}/activities/{activity_id}")
    def update_department_activity(
        club_id: int, activity_id: int, title: str = Form(...), description: str = Form(""),
        event_date: str = Form(""), venue: str = Form(""), display_order: str = Form("0"),
        is_published: str = Form("0"), code: str = Form(""),
        actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
    ):
        _owned(club_id, actor, db, code or None)
        row = _activity_row(db, club_id, activity_id)
        name = _clean(title, 200)
        if not name:
            raise HTTPException(status_code=400, detail="Activity title is required")
        row.title = name
        row.description = _clean(description, 4000)
        row.event_date = _clean(event_date, 40)
        row.venue = _clean(venue, 160)
        row.display_order = _order(display_order)
        row.is_published = _flag(is_published)
        db.commit()
        return _activity(row)

    @router.delete("/api/department-clubs/{club_id}/activities/{activity_id}")
    def delete_department_activity(
        club_id: int, activity_id: int, code: Optional[str] = None,
        actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
    ):
        _owned(club_id, actor, db, code)
        row = _activity_row(db, club_id, activity_id)
        db.delete(row)
        db.commit()
        return {"ok": True}

    @router.post("/api/department-clubs/{club_id}/gallery")
    async def create_department_gallery(
        club_id: int, caption: str = Form(""), alt_text: str = Form(""), display_order: str = Form("0"),
        is_published: str = Form("0"), code: str = Form(""), image: Optional[UploadFile] = File(None),
        actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
    ):
        club = _owned(club_id, actor, db, code or None)
        url = await _photo(image, "club-gallery")
        if not url:
            raise HTTPException(status_code=400, detail="Choose a photograph")
        row = models.ClubImage(
            club_id=club.id, image_url=url, caption=_clean(caption, 200), alt_text=_clean(alt_text, 200),
            display_order=_order(display_order), is_published=_flag(is_published),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _image(row)

    @router.patch("/api/department-clubs/{club_id}/gallery/{image_id}")
    def update_department_gallery(
        club_id: int, image_id: int, caption: str = Form(""), alt_text: str = Form(""),
        display_order: str = Form("0"), is_published: str = Form("1"), code: str = Form(""),
        actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
    ):
        _owned(club_id, actor, db, code or None)
        row = _image_row(db, club_id, image_id)
        row.caption = _clean(caption, 200)
        row.alt_text = _clean(alt_text, 200)
        row.display_order = _order(display_order)
        row.is_published = _flag(is_published, 1)
        db.commit()
        return _image(row)

    @router.delete("/api/department-clubs/{club_id}/gallery/{image_id}")
    def delete_department_gallery(
        club_id: int, image_id: int, code: Optional[str] = None,
        actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
    ):
        _owned(club_id, actor, db, code)
        row = _image_row(db, club_id, image_id)
        url = row.image_url
        db.delete(row)
        db.commit()
        _drop_file(url, db)
        return {"ok": True}

    @router.post("/api/department-clubs/{club_id}/members")
    async def create_department_member(
        club_id: int, name: str = Form(...), role: str = Form(""), admission_number: str = Form(""),
        display_order: str = Form(""), code: str = Form(""), photo: Optional[UploadFile] = File(None),
        actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
    ):
        club = _owned(club_id, actor, db, code or None)
        member_name = _clean(name, 120)
        if not member_name:
            raise HTTPException(status_code=400, detail="Student name is required")
        order = _order(display_order, max((item.display_order or 0) for item in club.members) + 1 if club.members else 0)
        row = models.ClubMember(
            club_id=club.id, name=member_name, role=_clean(role, 80),
            admission_number=_clean(admission_number, 40), display_order=order, is_active=1,
            photo_url=await _photo(photo, "club-members"),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _member(row, True)

    @router.patch("/api/department-clubs/{club_id}/members/{member_id}")
    async def update_department_member(
        club_id: int, member_id: int, name: str = Form(None), role: str = Form(None),
        admission_number: str = Form(None), display_order: str = Form(None), is_active: str = Form(None),
        code: str = Form(""), photo: Optional[UploadFile] = File(None), remove_photo: str = Form(None),
        actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
    ):
        _owned(club_id, actor, db, code or None)
        row = _member_row(db, club_id, member_id)
        if name is not None:
            member_name = _clean(name, 120)
            if not member_name:
                raise HTTPException(status_code=400, detail="Student name is required")
            row.name = member_name
        if role is not None:
            row.role = _clean(role, 80)
        if admission_number is not None:
            row.admission_number = _clean(admission_number, 40)
        if display_order is not None:
            row.display_order = _order(display_order)
        if is_active is not None:
            row.is_active = _flag(is_active, 1)
        if remove_photo in ("1", "true", "yes"):
            old = row.photo_url
            row.photo_url = None
            db.flush()
            _drop_file(old, db)
        photo_url = await _photo(photo, "club-members")
        if photo_url:
            old = row.photo_url
            row.photo_url = photo_url
            db.flush()
            _drop_file(old, db)
        db.commit()
        return _member(row, True)

    @router.delete("/api/department-clubs/{club_id}/members/{member_id}")
    def delete_department_member(
        club_id: int, member_id: int, code: Optional[str] = None,
        actor: dict = Depends(auth.require_actor), db: Session = Depends(get_db),
    ):
        _owned(club_id, actor, db, code)
        row = _member_row(db, club_id, member_id)
        url = row.photo_url
        db.delete(row)
        db.commit()
        _drop_file(url, db)
        return {"ok": True}


_dept_routes()
