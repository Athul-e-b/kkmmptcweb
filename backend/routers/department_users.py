"""Administrator management of department login accounts.

Each department may have at most three accounts, including inactive ones.
"""
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from database import get_db
import auth, models, schemas

router = APIRouter(prefix="/api/admin/department-users", tags=["department-users"])
MAX_DEPARTMENT_USERS = 3
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _checked_username(raw: str) -> str:
    username = auth.normalize_username(raw)
    if not auth.USERNAME_RE.match(username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3–32 characters and use only letters, numbers, dots, underscores, or hyphens.",
        )
    return username


def _checked_password(password: str, confirm: str) -> str:
    if password != confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    issues = auth.password_issues(password)
    if issues:
        raise HTTPException(status_code=400, detail="Password needs " + ", ".join(issues))
    return password


def _email(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    email = raw.strip().lower()
    if not email:
        return None
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    return email


def _username_from_email(db: Session, email: str) -> str:
    local = re.sub(r"[^a-z0-9._-]", "", email.split("@", 1)[0].lower()) or "user"
    local = local[:28]
    candidate = local
    number = 2
    while db.query(models.DepartmentUser).filter(models.DepartmentUser.username == candidate).first():
        candidate = f"{local[:28]}{number}"[:32]
        number += 1
    return _checked_username(candidate)


def _out(user: models.DepartmentUser) -> schemas.DepartmentUserOut:
    dept = user.department
    return schemas.DepartmentUserOut(
        id=user.id,
        username=user.username,
        name=user.name,
        designation=user.designation,
        email=user.email,
        department_id=user.department_id,
        department_name=dept.name if dept else "",
        department_code=dept.code if dept else "",
        is_active=int(user.is_active or 0),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _get_or_404(db: Session, user_id: int) -> models.DepartmentUser:
    user = (
        db.query(models.DepartmentUser)
        .options(joinedload(models.DepartmentUser.department))
        .filter(models.DepartmentUser.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="Department account not found")
    return user


def _save(db: Session):
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        detail = str(getattr(exc, "orig", exc)).lower()
        if "email" in detail:
            raise HTTPException(status_code=409, detail="That email address is already in use")
        raise HTTPException(status_code=409, detail="That username is already in use")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not save the department account")


@router.get("", response_model=List[schemas.DepartmentUserOut])
def list_users(_admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(models.DepartmentUser)
        .options(joinedload(models.DepartmentUser.department))
        .order_by(models.DepartmentUser.username.asc())
        .all()
    )
    return [_out(row) for row in rows]


@router.post("", response_model=schemas.DepartmentUserOut)
def create_user(
    payload: schemas.DepartmentUserCreate,
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    dept = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    assigned = db.query(models.DepartmentUser).filter(models.DepartmentUser.department_id == dept.id).count()
    if assigned >= MAX_DEPARTMENT_USERS:
        raise HTTPException(status_code=409, detail="This department already has the maximum of 3 login accounts")
    email = _email(payload.email)
    if db.query(models.DepartmentUser).filter(models.DepartmentUser.email == email).first():
        raise HTTPException(status_code=409, detail="That email address is already in use")
    username = _checked_username(payload.username) if payload.username else _username_from_email(db, email)
    if db.query(models.DepartmentUser).filter(models.DepartmentUser.username == username).first():
        raise HTTPException(status_code=409, detail="That username is already in use")
    password = _checked_password(payload.password, payload.confirm_password)
    user = models.DepartmentUser(
        department_id=dept.id,
        username=username,
        name=payload.name.strip(),
        designation=payload.designation.strip(),
        email=email,
        password_hash=auth.hash_password(password),
        is_active=1,
        token_version=1,
    )
    db.add(user)
    _save(db)
    db.refresh(user)
    user.department = dept
    return _out(user)


@router.patch("/{user_id}", response_model=schemas.DepartmentUserOut)
def update_username(
    user_id: int,
    payload: schemas.DepartmentUsernameUpdate,
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    user = _get_or_404(db, user_id)
    if payload.username:
        username = _checked_username(payload.username)
        taken = (
            db.query(models.DepartmentUser)
            .filter(models.DepartmentUser.username == username, models.DepartmentUser.id != user.id)
            .first()
        )
        if taken:
            raise HTTPException(status_code=409, detail="That username is already in use")
        user.username = username
    if payload.name is not None:
        if not payload.name.strip():
            raise HTTPException(status_code=400, detail="Name is required")
        user.name = payload.name.strip()
    if payload.designation is not None:
        if not payload.designation.strip():
            raise HTTPException(status_code=400, detail="Designation is required")
        user.designation = payload.designation.strip()
    if payload.email is not None:
        email = _email(payload.email)
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        taken = (
            db.query(models.DepartmentUser)
            .filter(models.DepartmentUser.email == email, models.DepartmentUser.id != user.id)
            .first()
        )
        if taken:
            raise HTTPException(status_code=409, detail="That email address is already in use")
        user.email = email
    _save(db)
    db.refresh(user)
    return _out(user)


@router.post("/{user_id}/reset-password", response_model=schemas.DepartmentUserOut)
def reset_password(
    user_id: int,
    payload: schemas.DepartmentPasswordReset,
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    user = _get_or_404(db, user_id)
    password = _checked_password(payload.password, payload.confirm_password)
    user.password_hash = auth.hash_password(password)
    user.token_version = int(user.token_version or 1) + 1
    _save(db)
    db.refresh(user)
    return _out(user)


@router.patch("/{user_id}/status", response_model=schemas.DepartmentUserOut)
def set_status(
    user_id: int,
    payload: schemas.DepartmentStatusUpdate,
    _admin: bool = Depends(auth.require_admin),
    db: Session = Depends(get_db),
):
    user = _get_or_404(db, user_id)
    user.is_active = 1 if payload.is_active else 0
    if user.is_active != 1:
        user.token_version = int(user.token_version or 1) + 1
    _save(db)
    db.refresh(user)
    return _out(user)


@router.delete("/{user_id}")
def delete_user(user_id: int, _admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    """Remove one department login. The department and its content stay in place."""
    user = _get_or_404(db, user_id)
    db.delete(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This login account could not be deleted. The department was not changed.")
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="This login account could not be deleted. The department was not changed.")
    return {"ok": True, "message": "Department login account deleted"}
