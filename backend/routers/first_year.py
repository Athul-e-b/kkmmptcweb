"""First-year curriculum, faculty assignments, resources, and laboratories.

Public responses omit staff email, phone, and other private fields.
Programme aliases follow the existing department codes: EE is EEE, RP is RPA.
"""
import os
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

import auth
import models
from database import get_db
from file_storage import DOC_OFFICE_EXT, IMAGE_EXT, delete_local_file, save_upload

router = APIRouter(prefix="/api", tags=["first-year"])

PROGRAMME_ORDER = ("BM", "EEE", "EL", "CG", "CT", "RPA")
ALIASES = {"EE": "EEE", "RP": "RPA", "CM": "CG"}
SHORT = {"EEE": "EE", "RPA": "RP"}
CATEGORIES = {"common", "shared", "branch"}
RESOURCE_KINDS = {"syllabus", "notes", "study", "timetable", "practical", "other"}
IMAGE_LIMIT = 6 * 1024 * 1024
DOC_LIMIT = 12 * 1024 * 1024


class SubjectIn(BaseModel):
    course_code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    semester_id: int
    department_ids: list[int] = Field(default_factory=list)
    category: Optional[str] = None
    description: Optional[str] = None
    is_active: int = 1
    revision_id: Optional[int] = None
    display_order: Optional[int] = None


class FacultyIn(BaseModel):
    staff_id: Optional[int] = None
    name: Optional[str] = None
    designation: Optional[str] = None
    department_id: Optional[int] = None
    profile: Optional[str] = None
    is_active: int = 1


class AssignmentIn(BaseModel):
    staff_id: int
    semester_id: int
    subject_ids: list[int] = Field(default_factory=list)
    department_ids: list[int] = Field(default_factory=list)
    academic_year: Optional[str] = ""
    replace_id: Optional[int] = None


class SemesterIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    academic_year: Optional[str] = None
    notes: Optional[str] = None
    revision_status: Optional[str] = None
    name: Optional[str] = None


class PageIn(BaseModel):
    heading: Optional[str] = None
    heading_accent: Optional[str] = None
    intro_title: Optional[str] = None
    description: Optional[str] = None
    hero_subtitle: Optional[str] = None
    announcements: Optional[str] = None
    overview_text: Optional[str] = None
    academic_year: Optional[str] = None
    name: Optional[str] = None


class ResourceIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    kind: str = "other"
    description: Optional[str] = ""
    semester_id: Optional[int] = None
    department_id: Optional[int] = None
    subject_id: Optional[int] = None
    is_published: int = 1


class FacultyActiveIn(BaseModel):
    is_active: int = 1


class LabIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    description: Optional[str] = None
    facilities_text: Optional[str] = None
    department_ids: list[int] = Field(default_factory=list)
    subject_ids: list[int] = Field(default_factory=list)
    is_active: int = 1


def _page_fields(revision) -> dict:
    return {
        "code": revision.code,
        "name": revision.name,
        "academic_year": revision.academic_year or "",
        "status": revision.status,
        "heading": revision.heading or "",
        "heading_accent": revision.heading_accent or "",
        "intro_title": revision.intro_title or "",
        "description": revision.description or "",
        "hero_subtitle": revision.hero_subtitle or "",
        "hero_image_url": revision.hero_image_url or "",
        "announcements": revision.announcements or "",
        "overview_text": revision.overview_text or "",
    }


def _file_label(upload: Optional[UploadFile]) -> Optional[str]:
    if not upload or not (upload.filename or "").strip():
        return None
    return os.path.basename(upload.filename.replace("\\", "/"))[:255]


def canonical_code(code: str) -> str:
    value = (code or "").strip().upper()
    return ALIASES.get(value, value)


def short_code(code: str) -> str:
    return SHORT.get(code, code)


def _category(count: int, total: int) -> str:
    if total and count >= total:
        return "common"
    if count <= 1:
        return "branch"
    return "shared"


def _programmes(db: Session) -> list:
    rows = db.query(models.Department).filter(models.Department.code.in_(PROGRAMME_ORDER)).all()
    order = {code: index for index, code in enumerate(PROGRAMME_ORDER)}
    return sorted(rows, key=lambda row: order.get(row.code, 99))


def _programme_out(dept: models.Department) -> dict:
    return {"id": dept.id, "code": dept.code, "label": short_code(dept.code), "name": dept.name}


def _active_revision(db: Session):
    return (
        db.query(models.FirstYearRevision)
        .filter(models.FirstYearRevision.status == "active")
        .order_by(models.FirstYearRevision.id.desc())
        .first()
    )


def _revision_or_404(db: Session, revision_id: Optional[int] = None):
    if revision_id:
        row = db.query(models.FirstYearRevision).filter(models.FirstYearRevision.id == revision_id).first()
    else:
        row = _active_revision(db)
    if not row:
        raise HTTPException(status_code=404, detail="No first-year syllabus revision is available.")
    return row


def _dept_map(db: Session) -> dict:
    return {row.id: row for row in db.query(models.Department).all()}


def _subject_programmes(subject: models.FirstYearSubject, departments: dict) -> list:
    found = []
    for link in subject.programmes or []:
        dept = departments.get(link.department_id)
        if dept:
            found.append(_programme_out(dept))
    order = {code: index for index, code in enumerate(PROGRAMME_ORDER)}
    return sorted(found, key=lambda item: order.get(item["code"], 99))


def _subject_out(subject: models.FirstYearSubject, departments: dict, private: bool = False) -> dict:
    semester = subject.semester
    data = {
        "id": subject.id,
        "course_code": subject.course_code,
        "name": subject.name,
        "category": subject.category,
        "description": subject.description or "",
        "syllabus_url": subject.syllabus_url or "",
        "semester_id": subject.semester_id,
        "semester": semester.number if semester else None,
        "semester_title": semester.title if semester else "",
        "programmes": _subject_programmes(subject, departments),
        "is_active": int(subject.is_active or 0),
        "display_order": subject.display_order or 0,
        "revision_id": subject.revision_id,
    }
    if not private:
        data.pop("revision_id", None)
        if not data["description"]:
            data["description"] = ""
        if not data["syllabus_url"]:
            data["syllabus_url"] = ""
    return data


def _load_subjects(db: Session, revision_id: int):
    rows = (
        db.query(models.FirstYearSubject)
        .options(
            joinedload(models.FirstYearSubject.semester),
            joinedload(models.FirstYearSubject.programmes),
        )
        .filter(models.FirstYearSubject.revision_id == revision_id)
        .order_by(models.FirstYearSubject.display_order, models.FirstYearSubject.course_code)
        .all()
    )
    seen = []
    ids = set()
    for row in rows:
        if row.id in ids:
            continue
        ids.add(row.id)
        seen.append(row)
    return seen


def _public_subjects(subjects, departments, semester: Optional[int], programme: Optional[str], category: Optional[str]):
    wanted = canonical_code(programme) if programme else ""
    chosen = (category or "").strip().lower()
    visible = []
    for subject in subjects:
        if int(subject.is_active or 0) != 1:
            continue
        if not subject.semester or subject.semester.status != "active":
            continue
        if semester and subject.semester.number != semester:
            continue
        if chosen and subject.category != chosen:
            continue
        programmes = _subject_programmes(subject, departments)
        if wanted and wanted not in {item["code"] for item in programmes}:
            continue
        row = _subject_out(subject, departments)
        visible.append(row)
    return visible


def _faculty_public(db: Session, departments: dict) -> list:
    profiles = (
        db.query(models.FirstYearFaculty)
        .options(joinedload(models.FirstYearFaculty.staff).joinedload(models.Staff.department))
        .filter(models.FirstYearFaculty.is_active == 1)
        .all()
    )
    assignments = (
        db.query(models.FirstYearAssignment)
        .options(
            joinedload(models.FirstYearAssignment.subject).joinedload(models.FirstYearSubject.semester),
            joinedload(models.FirstYearAssignment.department),
        )
        .filter(models.FirstYearAssignment.is_active == 1)
        .all()
    )
    by_staff = {}
    for row in assignments:
        subject = row.subject
        if not subject or int(subject.is_active or 0) != 1:
            continue
        if not subject.semester or subject.semester.status != "active":
            continue
        dept = row.department
        if not dept:
            continue
        bucket = by_staff.setdefault(row.staff_id, {})
        key = subject.id
        item = bucket.setdefault(key, {
            "subject_id": subject.id,
            "course_code": subject.course_code,
            "name": subject.name,
            "semester": subject.semester.number,
            "programmes": [],
        })
        programme = _programme_out(dept)
        if programme["code"] not in {entry["code"] for entry in item["programmes"]}:
            item["programmes"].append(programme)
    people = []
    for profile in profiles:
        staff = profile.staff
        if not staff or int(staff.is_active or 0) != 1:
            continue
        taught = list(by_staff.get(staff.id, {}).values())
        if not taught:
            continue
        dept = staff.department
        people.append({
            "id": profile.id,
            "name": staff.name,
            "designation": staff.designation or "",
            "department": _programme_out(dept) if dept else None,
            "photo_url": staff.photo_url or "",
            "profile": profile.profile or "",
            "subjects": sorted(taught, key=lambda item: (item["semester"] or 0, item["course_code"])),
        })
    return sorted(people, key=lambda item: item["name"].lower())


def _labs_public(db: Session, departments: dict) -> list:
    rows = (
        db.query(models.FirstYearLaboratory)
        .options(
            joinedload(models.FirstYearLaboratory.programmes),
            joinedload(models.FirstYearLaboratory.subjects).joinedload(models.FirstYearLabSubject.subject),
            joinedload(models.FirstYearLaboratory.photos),
        )
        .filter(models.FirstYearLaboratory.is_active == 1)
        .order_by(models.FirstYearLaboratory.name)
        .all()
    )
    seen = []
    ids = set()
    for lab in rows:
        if lab.id in ids:
            continue
        ids.add(lab.id)
        programmes = []
        for link in lab.programmes or []:
            dept = departments.get(link.department_id)
            if dept:
                programmes.append(_programme_out(dept))
        subjects = []
        for link in lab.subjects or []:
            subject = link.subject
            if subject and int(subject.is_active or 0) == 1:
                subjects.append({
                    "course_code": subject.course_code,
                    "name": subject.name,
                    "semester": subject.semester.number if subject.semester else None,
                })
        photos = [
            {"image_url": photo.image_url, "caption": photo.caption or ""}
            for photo in sorted(lab.photos or [], key=lambda item: item.display_order or 0)
            if photo.image_url
        ]
        seen.append({
            "id": lab.id,
            "name": lab.name,
            "description": lab.description or "",
            "facilities": lab.facilities_text or "",
            "programmes": programmes,
            "subjects": subjects,
            "photos": photos,
        })
    return seen


def _resources_public(db: Session, revision_id: int, departments: dict) -> list:
    rows = (
        db.query(models.FirstYearResource)
        .options(joinedload(models.FirstYearResource.semester), joinedload(models.FirstYearResource.subject))
        .filter(
            models.FirstYearResource.revision_id == revision_id,
            models.FirstYearResource.is_published == 1,
        )
        .order_by(models.FirstYearResource.id.desc())
        .all()
    )
    found = []
    for row in rows:
        if not (row.file_url or "").strip() and not (row.description or "").strip():
            continue
        dept = departments.get(row.department_id) if row.department_id else None
        subject = row.subject
        found.append({
            "id": row.id,
            "title": row.title,
            "kind": row.kind,
            "description": row.description or "",
            "file_url": row.file_url or "",
            "semester": row.semester.number if row.semester else None,
            "programme": _programme_out(dept) if dept else None,
            "subject": {"course_code": subject.course_code, "name": subject.name} if subject else None,
        })
    return found


def _bundle(db: Session, semester: Optional[int] = None, programme: Optional[str] = None, category: Optional[str] = None) -> dict:
    revision = _active_revision(db)
    departments = _dept_map(db)
    programmes = [_programme_out(row) for row in _programmes(db) if int(row.is_active or 0) == 1]
    if not revision:
        return {
            "revision": None,
            "semesters": [],
            "programmes": programmes,
            "overview": {"programmes": len(programmes), "semesters": 0, "common_subjects": 0, "shared_subjects": 0, "branch_subjects": 0},
            "subjects": [],
            "faculty": [],
            "laboratories": _labs_public(db, departments),
            "resources": [],
        }
    semesters = (
        db.query(models.FirstYearSemester)
        .filter(models.FirstYearSemester.revision_id == revision.id)
        .order_by(models.FirstYearSemester.number)
        .all()
    )
    subjects = _load_subjects(db, revision.id)
    public_subjects = _public_subjects(subjects, departments, None, None, None)
    active_semesters = [row for row in semesters if row.status == "active"]
    return {
        "revision": _page_fields(revision),
        "semesters": [{"id": row.id, "number": row.number, "title": row.title, "description": row.description or "", "status": row.status} for row in semesters if row.status == "active"],
        "programmes": programmes,
        "overview": {
            "programmes": len(programmes),
            "semesters": len(active_semesters),
            "common_subjects": sum(1 for item in public_subjects if item["category"] == "common"),
            "shared_subjects": sum(1 for item in public_subjects if item["category"] == "shared"),
            "branch_subjects": sum(1 for item in public_subjects if item["category"] == "branch"),
        },
        "subjects": _public_subjects(subjects, departments, semester, programme, category),
        "faculty": _faculty_public(db, departments),
        "laboratories": _labs_public(db, departments),
        "resources": _resources_public(db, revision.id, departments),
    }


def _set_subject_programmes(db: Session, subject: models.FirstYearSubject, department_ids: list, total: int, category: Optional[str]):
    ids = []
    for raw in department_ids:
        if int(raw) not in ids:
            ids.append(int(raw))
    if not ids:
        raise HTTPException(status_code=400, detail="Select at least one programme.")
    known = {row.id for row in _programmes(db)}
    missing = [item for item in ids if item not in known]
    if missing:
        raise HTTPException(status_code=400, detail="Select a first-year programme that already exists.")
    removed = {link.department_id for link in subject.programmes or []} - set(ids)
    if subject.id and removed:
        blocked = (
            db.query(models.FirstYearAssignment)
            .filter(
                models.FirstYearAssignment.subject_id == subject.id,
                models.FirstYearAssignment.department_id.in_(removed),
            )
            .count()
        )
        if blocked:
            raise HTTPException(status_code=409, detail="Remove faculty assignments for a programme before taking that programme off the subject.")
    subject.programmes.clear()
    db.flush()
    for department_id in ids:
        subject.programmes.append(models.FirstYearSubjectProgramme(department_id=department_id))
    chosen = (category or "").strip().lower()
    if chosen and chosen not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Category must be common, shared, or branch.")
    subject.category = chosen or _category(len(ids), total)


def _sync_assignment_semester(db: Session, subject: models.FirstYearSubject):
    number = subject.semester.number if subject.semester else None
    if not number:
        return
    db.query(models.FirstYearAssignment).filter(models.FirstYearAssignment.subject_id == subject.id).update(
        {models.FirstYearAssignment.semester_number: number},
        synchronize_session=False,
    )


@router.get("/first-year")
def public_first_year(
    semester: Optional[int] = None,
    programme: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return _bundle(db, semester, programme, category)


@router.get("/first-year/subjects")
def public_subjects(
    semester: Optional[int] = None,
    programme: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    payload = _bundle(db, semester, programme, category)
    return {"subjects": payload["subjects"], "overview": payload["overview"]}


@router.get("/first-year/faculty")
def public_faculty(db: Session = Depends(get_db)):
    return {"faculty": _faculty_public(db, _dept_map(db))}


@router.get("/first-year/laboratories")
def public_labs(db: Session = Depends(get_db)):
    return {"laboratories": _labs_public(db, _dept_map(db))}


@router.get("/first-year/resources")
def public_resources(db: Session = Depends(get_db)):
    revision = _active_revision(db)
    if not revision:
        return {"resources": []}
    return {"resources": _resources_public(db, revision.id, _dept_map(db))}


@router.get("/admin/first-year")
def admin_bundle(db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    revision = _active_revision(db)
    departments = _dept_map(db)
    programmes = [_programme_out(row) for row in _programmes(db)]
    subjects = _load_subjects(db, revision.id) if revision else []
    semesters = []
    if revision:
        semesters = (
            db.query(models.FirstYearSemester)
            .filter(models.FirstYearSemester.revision_id == revision.id)
            .order_by(models.FirstYearSemester.number)
            .all()
        )
    staff_rows = (
        db.query(models.Staff)
        .options(joinedload(models.Staff.department))
        .filter(models.Staff.is_active == 1)
        .order_by(models.Staff.name)
        .all()
    )
    linked = {row.staff_id: row for row in db.query(models.FirstYearFaculty).all()}
    faculty = []
    for row in linked.values():
        staff = row.staff
        if not staff:
            continue
        dept = staff.department
        faculty.append({
            "id": row.id,
            "staff_id": staff.id,
            "name": staff.name,
            "designation": staff.designation or "",
            "department_id": staff.department_id,
            "department": dept.name if dept else "",
            "department_code": dept.code if dept else "",
            "photo_url": staff.photo_url or "",
            "profile": row.profile or "",
            "is_active": int(row.is_active or 0),
        })
    assignments = (
        db.query(models.FirstYearAssignment)
        .options(
            joinedload(models.FirstYearAssignment.subject),
            joinedload(models.FirstYearAssignment.staff),
            joinedload(models.FirstYearAssignment.department),
        )
        .order_by(models.FirstYearAssignment.id.desc())
        .all()
    )
    resources = (
        db.query(models.FirstYearResource)
        .options(joinedload(models.FirstYearResource.semester), joinedload(models.FirstYearResource.subject))
        .order_by(models.FirstYearResource.id.desc())
        .all()
    )
    labs = (
        db.query(models.FirstYearLaboratory)
        .options(
            joinedload(models.FirstYearLaboratory.programmes),
            joinedload(models.FirstYearLaboratory.subjects),
            joinedload(models.FirstYearLaboratory.photos),
        )
        .order_by(models.FirstYearLaboratory.name)
        .all()
    )
    lab_ids = set()
    lab_rows = []
    for lab in labs:
        if lab.id in lab_ids:
            continue
        lab_ids.add(lab.id)
        lab_rows.append({
            "id": lab.id,
            "name": lab.name,
            "description": lab.description or "",
            "facilities_text": lab.facilities_text or "",
            "is_active": int(lab.is_active or 0),
            "department_ids": [link.department_id for link in lab.programmes or []],
            "subject_ids": [link.subject_id for link in lab.subjects or []],
            "photos": [{"id": photo.id, "image_url": photo.image_url, "caption": photo.caption or ""} for photo in lab.photos or []],
        })
    return {
        "revision": None if not revision else dict(_page_fields(revision), id=revision.id, notes=revision.notes or ""),
        "semesters": [{"id": row.id, "number": row.number, "title": row.title, "description": row.description or "", "status": row.status} for row in semesters],
        "programmes": programmes,
        "subjects": [_subject_out(row, departments, True) for row in subjects],
        "staff": [{
            "id": row.id,
            "name": row.name,
            "designation": row.designation or "",
            "department_id": row.department_id,
            "department": row.department.name if row.department else "",
            "linked": row.id in linked,
        } for row in staff_rows],
        "faculty": sorted(faculty, key=lambda item: item["name"].lower()),
        "assignments": [{
            "id": row.id,
            "staff_id": row.staff_id,
            "faculty": row.staff.name if row.staff else "",
            "subject_id": row.subject_id,
            "subject": row.subject.name if row.subject else "",
            "course_code": row.subject.course_code if row.subject else "",
            "semester": row.semester_number,
            "department_id": row.department_id,
            "programme": short_code(row.department.code) if row.department else "",
            "academic_year": row.academic_year or "",
            "is_active": int(row.is_active or 0),
        } for row in assignments],
        "resources": [{
            "id": row.id,
            "title": row.title,
            "kind": row.kind,
            "description": row.description or "",
            "file_url": row.file_url or "",
            "original_name": row.original_name or "",
            "created_at": row.created_at.isoformat() if row.created_at else "",
            "semester_id": row.semester_id,
            "semester": row.semester.number if row.semester else None,
            "department_id": row.department_id,
            "subject_id": row.subject_id,
            "subject": row.subject.course_code if row.subject else "",
            "is_published": int(row.is_published or 0),
        } for row in resources],
        "laboratories": lab_rows,
    }


@router.patch("/admin/first-year/page")
def update_page(payload: PageIn, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    revision = _revision_or_404(db)
    if payload.name is not None:
        label = payload.name.strip()
        if not label:
            raise HTTPException(status_code=400, detail="Revision name is required.")
        revision.name = label
    for field in ("heading", "heading_accent", "intro_title", "description", "hero_subtitle", "announcements", "overview_text", "academic_year"):
        if getattr(payload, field) is not None:
            setattr(revision, field, getattr(payload, field).strip() or None)
    db.commit()
    db.refresh(revision)
    return _page_fields(revision)


@router.post("/admin/first-year/hero")
async def upload_hero(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    revision = _revision_or_404(db)
    url = await save_upload(file, "first-year", IMAGE_EXT, IMAGE_LIMIT)
    delete_local_file(revision.hero_image_url)
    revision.hero_image_url = url
    db.commit()
    return {"hero_image_url": url}


@router.post("/admin/first-year/faculty/{profile_id}/active")
def set_faculty_active(profile_id: int, payload: FacultyActiveIn, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    profile = db.query(models.FirstYearFaculty).filter(models.FirstYearFaculty.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Faculty profile not found.")
    profile.is_active = 1 if int(payload.is_active) else 0
    db.commit()
    return {"id": profile.id, "is_active": profile.is_active}


@router.patch("/admin/first-year/resources/{resource_id}")
def update_resource(resource_id: int, payload: ResourceIn, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    row = db.query(models.FirstYearResource).filter(models.FirstYearResource.id == resource_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resource not found.")
    kind = (payload.kind or "other").strip().lower()
    if kind not in RESOURCE_KINDS:
        raise HTTPException(status_code=400, detail="Choose a resource type.")
    row.title = payload.title.strip()
    row.kind = kind
    row.description = (payload.description or "").strip() or None
    row.semester_id = payload.semester_id or None
    row.department_id = payload.department_id or None
    row.subject_id = payload.subject_id or None
    row.is_published = 1 if int(payload.is_published) else 0
    db.commit()
    return {"ok": True}


@router.post("/admin/first-year/resources/{resource_id}/file")
async def replace_resource_file(
    resource_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    row = db.query(models.FirstYearResource).filter(models.FirstYearResource.id == resource_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resource not found.")
    url = await save_upload(file, "first-year-docs", DOC_OFFICE_EXT, DOC_LIMIT)
    delete_local_file(row.file_url)
    row.file_url = url
    row.original_name = _file_label(file)
    db.commit()
    return {"file_url": url, "original_name": row.original_name or ""}


@router.post("/admin/first-year/subjects")
def create_subject(payload: SubjectIn, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    revision = _revision_or_404(db, payload.revision_id)
    semester = db.query(models.FirstYearSemester).filter(models.FirstYearSemester.id == payload.semester_id, models.FirstYearSemester.revision_id == revision.id).first()
    if not semester:
        raise HTTPException(status_code=400, detail="Select a semester from this syllabus revision.")
    code = payload.course_code.strip()
    if db.query(models.FirstYearSubject).filter(models.FirstYearSubject.revision_id == revision.id, models.FirstYearSubject.course_code == code).first():
        raise HTTPException(status_code=409, detail="That course code already exists in this syllabus revision.")
    subject = models.FirstYearSubject(
        revision_id=revision.id,
        semester_id=semester.id,
        course_code=code,
        name=payload.name.strip(),
        description=(payload.description or "").strip() or None,
        is_active=1 if int(payload.is_active) else 0,
        display_order=payload.display_order if payload.display_order is not None else 0,
    )
    db.add(subject)
    db.flush()
    _set_subject_programmes(db, subject, payload.department_ids, len(_programmes(db)), payload.category)
    db.commit()
    db.refresh(subject)
    return _subject_out(subject, _dept_map(db), True)


@router.patch("/admin/first-year/subjects/{subject_id}")
def update_subject(subject_id: int, payload: SubjectIn, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    subject = db.query(models.FirstYearSubject).filter(models.FirstYearSubject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    semester = db.query(models.FirstYearSemester).filter(models.FirstYearSemester.id == payload.semester_id, models.FirstYearSemester.revision_id == subject.revision_id).first()
    if not semester:
        raise HTTPException(status_code=400, detail="Select a semester from this syllabus revision.")
    code = payload.course_code.strip()
    clash = db.query(models.FirstYearSubject).filter(
        models.FirstYearSubject.revision_id == subject.revision_id,
        models.FirstYearSubject.course_code == code,
        models.FirstYearSubject.id != subject.id,
    ).first()
    if clash:
        raise HTTPException(status_code=409, detail="That course code already exists in this syllabus revision.")
    subject.course_code = code
    subject.name = payload.name.strip()
    subject.semester_id = semester.id
    subject.description = (payload.description or "").strip() or None
    subject.is_active = 1 if int(payload.is_active) else 0
    if payload.display_order is not None:
        subject.display_order = payload.display_order
    _set_subject_programmes(db, subject, payload.department_ids, len(_programmes(db)), payload.category)
    db.flush()
    db.refresh(subject)
    _sync_assignment_semester(db, subject)
    db.commit()
    db.refresh(subject)
    return _subject_out(subject, _dept_map(db), True)


@router.delete("/admin/first-year/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    subject = db.query(models.FirstYearSubject).filter(models.FirstYearSubject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    if db.query(models.FirstYearAssignment).filter(models.FirstYearAssignment.subject_id == subject.id).count():
        raise HTTPException(status_code=409, detail="Remove faculty assignments for this subject before deleting it.")
    if db.query(models.FirstYearResource).filter(models.FirstYearResource.subject_id == subject.id).count():
        raise HTTPException(status_code=409, detail="Remove learning resources linked to this subject before deleting it.")
    if db.query(models.FirstYearLabSubject).filter(models.FirstYearLabSubject.subject_id == subject.id).count():
        raise HTTPException(status_code=409, detail="Remove this subject from its laboratories before deleting it.")
    delete_local_file(subject.syllabus_url)
    db.delete(subject)
    db.commit()
    return {"ok": True}


@router.post("/admin/first-year/subjects/{subject_id}/syllabus")
async def upload_syllabus(
    subject_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    subject = db.query(models.FirstYearSubject).filter(models.FirstYearSubject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")
    url = await save_upload(file, "first-year-docs", DOC_OFFICE_EXT, DOC_LIMIT)
    delete_local_file(subject.syllabus_url)
    subject.syllabus_url = url
    db.commit()
    return {"syllabus_url": url}


@router.post("/admin/first-year/faculty")
def save_faculty(payload: FacultyIn, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    staff = None
    if payload.staff_id:
        staff = db.query(models.Staff).filter(models.Staff.id == payload.staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found.")
    else:
        name = (payload.name or "").strip()
        if not name or not payload.department_id:
            raise HTTPException(status_code=400, detail="Choose an existing staff member, or enter a name and department.")
        dept = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail="Select a department.")
        staff = models.Staff(department_id=dept.id, name=name, role=models.RoleEnum.Faculty, is_active=1)
        db.add(staff)
        db.flush()
    if payload.designation is not None:
        staff.designation = payload.designation.strip() or None
    if payload.name and payload.staff_id:
        staff.name = payload.name.strip() or staff.name
    if payload.department_id and payload.staff_id:
        dept = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail="Select a department.")
        staff.department_id = dept.id
    profile = db.query(models.FirstYearFaculty).filter(models.FirstYearFaculty.staff_id == staff.id).first()
    if not profile:
        profile = models.FirstYearFaculty(staff_id=staff.id)
        db.add(profile)
    profile.profile = (payload.profile or "").strip() or None
    profile.is_active = 1 if int(payload.is_active) else 0
    db.commit()
    db.refresh(profile)
    return {"id": profile.id, "staff_id": staff.id, "is_active": profile.is_active}


@router.post("/admin/first-year/faculty/{profile_id}/photo")
async def upload_faculty_photo(
    profile_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    profile = db.query(models.FirstYearFaculty).filter(models.FirstYearFaculty.id == profile_id).first()
    if not profile or not profile.staff:
        raise HTTPException(status_code=404, detail="Faculty profile not found.")
    url = await save_upload(file, "first-year", IMAGE_EXT, IMAGE_LIMIT)
    delete_local_file(profile.staff.photo_url)
    profile.staff.photo_url = url
    db.commit()
    return {"photo_url": url}


@router.post("/admin/first-year/assignments")
def create_assignments(payload: AssignmentIn, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    staff = db.query(models.Staff).filter(models.Staff.id == payload.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found.")
    semester = db.query(models.FirstYearSemester).filter(models.FirstYearSemester.id == payload.semester_id).first()
    if not semester:
        raise HTTPException(status_code=400, detail="Select a semester.")
    if not payload.subject_ids or not payload.department_ids:
        raise HTTPException(status_code=400, detail="Select at least one subject and one programme.")
    year = (payload.academic_year or "").strip()[:20]
    if payload.replace_id:
        previous = db.query(models.FirstYearAssignment).filter(
            models.FirstYearAssignment.id == payload.replace_id,
            models.FirstYearAssignment.staff_id == staff.id,
        ).first()
        if previous:
            db.delete(previous)
            db.flush()
    created = []
    skipped = []
    for subject_id in dict.fromkeys(payload.subject_ids):
        subject = (
            db.query(models.FirstYearSubject)
            .options(joinedload(models.FirstYearSubject.programmes), joinedload(models.FirstYearSubject.semester))
            .filter(models.FirstYearSubject.id == subject_id)
            .first()
        )
        if not subject or subject.semester_id != semester.id:
            skipped.append({"subject_id": subject_id, "reason": "Subject is not in the selected semester."})
            continue
        offered = {link.department_id for link in subject.programmes or []}
        for department_id in dict.fromkeys(payload.department_ids):
            if int(department_id) not in offered:
                skipped.append({"subject_id": subject.id, "department_id": department_id, "reason": "This subject is not offered to that programme."})
                continue
            exists = db.query(models.FirstYearAssignment).filter_by(
                staff_id=staff.id,
                subject_id=subject.id,
                department_id=int(department_id),
                academic_year=year,
            ).first()
            if exists:
                skipped.append({"subject_id": subject.id, "department_id": department_id, "reason": "This assignment already exists."})
                continue
            row = models.FirstYearAssignment(
                staff_id=staff.id,
                subject_id=subject.id,
                department_id=int(department_id),
                semester_number=semester.number,
                academic_year=year,
                is_active=1,
            )
            db.add(row)
            created.append(row)
    if not created and skipped:
        raise HTTPException(status_code=409, detail=skipped[0]["reason"])
    profile = db.query(models.FirstYearFaculty).filter(models.FirstYearFaculty.staff_id == staff.id).first()
    if created and not profile:
        db.add(models.FirstYearFaculty(staff_id=staff.id, is_active=1))
    db.commit()
    return {"created": len(created), "skipped": skipped}


@router.delete("/admin/first-year/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    row = db.query(models.FirstYearAssignment).filter(models.FirstYearAssignment.id == assignment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found.")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.patch("/admin/first-year/semesters/{semester_id}")
def update_semester(semester_id: int, payload: SemesterIn, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    row = db.query(models.FirstYearSemester).filter(models.FirstYearSemester.id == semester_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Semester not found.")
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="Semester title is required.")
        row.title = title
    if payload.status is not None:
        if payload.status not in {"active", "inactive"}:
            raise HTTPException(status_code=400, detail="Status must be active or inactive.")
        row.status = payload.status
    if payload.description is not None:
        row.description = payload.description.strip() or None
    revision = row.revision
    if payload.name is not None and revision:
        label = payload.name.strip()
        if not label:
            raise HTTPException(status_code=400, detail="Revision name is required.")
        revision.name = label
    if payload.academic_year is not None and revision:
        revision.academic_year = payload.academic_year.strip() or None
    if payload.notes is not None and revision:
        revision.notes = payload.notes.strip() or None
    if payload.revision_status is not None and revision:
        if payload.revision_status not in {"active", "archived"}:
            raise HTTPException(status_code=400, detail="Revision status must be active or archived.")
        revision.status = payload.revision_status
    db.commit()
    return {"ok": True}


@router.post("/admin/first-year/resources")
async def create_resource(
    title: str = Form(...),
    kind: str = Form("other"),
    description: str = Form(""),
    semester_id: Optional[int] = Form(None),
    department_id: Optional[int] = Form(None),
    subject_id: Optional[int] = Form(None),
    is_published: int = Form(1),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    revision = _revision_or_404(db)
    label = (title or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Resource title is required.")
    resource_kind = (kind or "other").strip().lower()
    if resource_kind not in RESOURCE_KINDS:
        raise HTTPException(status_code=400, detail="Choose a resource type.")
    if semester_id:
        semester = db.query(models.FirstYearSemester).filter(models.FirstYearSemester.id == semester_id, models.FirstYearSemester.revision_id == revision.id).first()
        if not semester:
            raise HTTPException(status_code=400, detail="Select a semester from the active revision.")
    url = await save_upload(file, "first-year-docs", DOC_OFFICE_EXT, DOC_LIMIT)
    row = models.FirstYearResource(
        revision_id=revision.id,
        semester_id=semester_id or None,
        department_id=department_id or None,
        subject_id=subject_id or None,
        title=label,
        kind=resource_kind,
        description=description.strip() or None,
        file_url=url,
        original_name=_file_label(file),
        is_published=1 if int(is_published) else 0,
    )
    db.add(row)
    db.commit()
    return {"id": row.id, "file_url": url or ""}


@router.delete("/admin/first-year/resources/{resource_id}")
def delete_resource(resource_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    row = db.query(models.FirstYearResource).filter(models.FirstYearResource.id == resource_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Resource not found.")
    delete_local_file(row.file_url)
    db.delete(row)
    db.commit()
    return {"ok": True}


def _save_lab(db: Session, lab: models.FirstYearLaboratory, payload: LabIn):
    known = {row.id for row in _programmes(db)}
    subject_ids = list(dict.fromkeys(int(item) for item in payload.subject_ids))
    department_ids = list(dict.fromkeys(int(item) for item in payload.department_ids))
    if any(item not in known for item in department_ids):
        raise HTTPException(status_code=400, detail="Select a first-year programme that already exists.")
    if subject_ids:
        found = db.query(models.FirstYearSubject).filter(models.FirstYearSubject.id.in_(subject_ids)).count()
        if found != len(subject_ids):
            raise HTTPException(status_code=400, detail="One of the selected subjects no longer exists.")
    lab.name = payload.name.strip()
    lab.description = (payload.description or "").strip() or None
    lab.facilities_text = (payload.facilities_text or "").strip() or None
    lab.is_active = 1 if int(payload.is_active) else 0
    lab.programmes.clear()
    lab.subjects.clear()
    db.flush()
    for department_id in department_ids:
        lab.programmes.append(models.FirstYearLabProgramme(department_id=department_id))
    for subject_id in subject_ids:
        lab.subjects.append(models.FirstYearLabSubject(subject_id=subject_id))


@router.post("/admin/first-year/laboratories")
def create_lab(payload: LabIn, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    lab = models.FirstYearLaboratory(name=payload.name.strip(), is_active=1 if int(payload.is_active) else 0)
    db.add(lab)
    db.flush()
    _save_lab(db, lab, payload)
    db.commit()
    return {"id": lab.id}


@router.patch("/admin/first-year/laboratories/{lab_id}")
def update_lab(lab_id: int, payload: LabIn, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    lab = db.query(models.FirstYearLaboratory).filter(models.FirstYearLaboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratory not found.")
    _save_lab(db, lab, payload)
    db.commit()
    return {"ok": True}


@router.delete("/admin/first-year/laboratories/{lab_id}")
def delete_lab(lab_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    lab = db.query(models.FirstYearLaboratory).options(joinedload(models.FirstYearLaboratory.photos)).filter(models.FirstYearLaboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratory not found.")
    for photo in list(lab.photos or []):
        delete_local_file(photo.image_url)
    db.delete(lab)
    db.commit()
    return {"ok": True}


@router.post("/admin/first-year/laboratories/{lab_id}/photos")
async def upload_lab_photo(
    lab_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(auth.require_admin),
):
    lab = db.query(models.FirstYearLaboratory).filter(models.FirstYearLaboratory.id == lab_id).first()
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratory not found.")
    url = await save_upload(file, "first-year", IMAGE_EXT, IMAGE_LIMIT)
    photo = models.FirstYearLabPhoto(laboratory_id=lab.id, image_url=url, display_order=len(lab.photos or []))
    db.add(photo)
    db.commit()
    return {"id": photo.id, "image_url": url}


@router.delete("/admin/first-year/laboratories/{lab_id}/photos/{photo_id}")
def delete_lab_photo(lab_id: int, photo_id: int, db: Session = Depends(get_db), _=Depends(auth.require_admin)):
    photo = db.query(models.FirstYearLabPhoto).filter(models.FirstYearLabPhoto.id == photo_id, models.FirstYearLabPhoto.laboratory_id == lab_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photograph not found.")
    delete_local_file(photo.image_url)
    db.delete(photo)
    db.commit()
    return {"ok": True}
