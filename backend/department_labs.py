"""Department laboratories.

The laboratory table is the source of truth. departments.labs_text is kept as
a mirror of the active names so older clients that still read that field show
the same list.
"""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

import models

# Names supplied for Computer Engineering. Used once, only while that
# department still has the original placeholder list and no laboratory rows.
CT_LABORATORIES = (
    "Engineering Drawing with CAD",
    "Foundational IT Skills",
    "Engineering Workshop Practice",
    "Health and Physical Education",
    "Fundamentals of Electrical and Electronics Engineering Lab",
    "Programming in C Lab",
    "Database Management Systems Lab",
    "Object Oriented Programming Lab",
    "Computer Hardware and System Administration Lab",
    "Career Readiness and Communication",
    "Data Structures Lab",
    "Web Programming Lab",
    "UI/UX Design Lab",
    "Minor Project",
    "Cyber Security Lab",
    "Artificial Intelligence and Machine Learning Lab",
    "Mobile Application Development Lab (Elective)",
    "Network Infrastructure Management Lab (Elective)",
    "Digital Marketing Lab (Elective)",
    "Data Science and Analytics Lab (Elective)",
    "Internet of Things Lab",
    "Virtualization Technology and Cloud Computing Lab (Elective)",
    "Prompt Engineering and Generative AI Lab (Elective)",
    "Full Stack Web Development Lab (Elective)",
    "Ethical Hacking Lab (Elective)",
    "Major Project – Phase II",
)

CT_PLACEHOLDERS = {
    "software development lab",
    "web design & full stack lab",
    "database systems lab",
}


def lab_key(name: str) -> str:
    return " ".join((name or "").casefold().split())


def clean_name(value: Optional[str]) -> str:
    name = " ".join((value or "").split())
    if not name:
        raise HTTPException(status_code=422, detail="Laboratory name is required")
    if len(name) > 200:
        raise HTTPException(status_code=422, detail="Laboratory name must be 200 characters or fewer")
    return name


def clean_order(value, fallback: int) -> int:
    if value is None or str(value).strip() == "":
        return fallback
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="Display order must be a whole number")
    if number < 0 or number > 9999:
        raise HTTPException(status_code=422, detail="Display order must be between 0 and 9999")
    return number


def _rows(db: Session, department_id: int):
    return (
        db.query(models.DepartmentLaboratory)
        .filter(models.DepartmentLaboratory.department_id == department_id)
        .order_by(models.DepartmentLaboratory.display_order, models.DepartmentLaboratory.id)
        .all()
    )


def ensure_unique(db: Session, department_id: int, name: str, ignore_id: Optional[int] = None) -> None:
    key = lab_key(name)
    for row in _rows(db, department_id):
        if ignore_id is not None and row.id == ignore_id:
            continue
        if lab_key(row.name) == key:
            raise HTTPException(status_code=409, detail="This laboratory is already listed for this department.")


def refresh_labs_text(db: Session, dept: models.Department) -> None:
    names = [
        row.name
        for row in _rows(db, dept.id)
        if int(row.is_active or 0) == 1
    ]
    dept.labs_text = "\n".join(names) or None


def next_order(db: Session, department_id: int) -> int:
    current = [int(row.display_order or 0) for row in _rows(db, department_id)]
    return (max(current) + 1) if current else 1


def replace_labs_from_text(db: Session, dept: models.Department, text: Optional[str]) -> None:
    """Apply a line list without dropping descriptions or photographs."""
    lines = []
    seen = set()
    for line in (text or "").splitlines():
        name = " ".join(line.split())
        key = lab_key(name)
        if not key or key in seen or len(name) > 200:
            continue
        seen.add(key)
        lines.append(name)
    existing = {lab_key(row.name): row for row in _rows(db, dept.id)}
    for index, name in enumerate(lines, start=1):
        row = existing.get(lab_key(name))
        if row:
            row.name = name
            row.display_order = index
            row.is_active = 1
        else:
            db.add(models.DepartmentLaboratory(
                department_id=dept.id,
                name=name,
                display_order=index,
                is_active=1,
            ))
    for row in existing.values():
        if lab_key(row.name) not in seen:
            row.is_active = 0
    db.flush()
    refresh_labs_text(db, dept)


def seed_department_laboratories(db: Session) -> None:
    """Copy each department's existing line list into laboratory rows once.

    Computer Engineering's original three placeholder names are replaced by
    the supplied practical list. A department that already has rows is left
    alone, so later edits and deletions are not put back on the next startup.
    """
    changed = False
    for dept in db.query(models.Department).all():
        if _rows(db, dept.id):
            continue
        lines = [" ".join(line.split()) for line in (dept.labs_text or "").splitlines()]
        lines = [line for line in lines if line]
        keys = {lab_key(line) for line in lines}
        if dept.code == "CT" and (not keys or keys <= CT_PLACEHOLDERS):
            lines = list(CT_LABORATORIES)
        seen = set()
        order = 1
        for name in lines:
            key = lab_key(name)
            if not key or key in seen:
                continue
            seen.add(key)
            db.add(models.DepartmentLaboratory(
                department_id=dept.id,
                name=name,
                display_order=order,
                is_active=1,
            ))
            order += 1
        db.flush()
        refresh_labs_text(db, dept)
        changed = True
    if changed:
        db.commit()
