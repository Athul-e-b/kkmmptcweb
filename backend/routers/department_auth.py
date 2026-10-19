"""Department-user login. The department is read from the account, never from the client."""
import time
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from database import get_db
import auth, models, schemas

router = APIRouter(prefix="/api/department-auth", tags=["department-auth"])

_login_hits: dict = {}


def _rate_limited(key: str, limit: int = 8, window: int = 900) -> bool:
    now = time.time()
    hits = [t for t in _login_hits.get(key, []) if now - t < window]
    _login_hits[key] = hits
    return len(hits) >= limit


def _note_failure(key: str):
    _login_hits.setdefault(key, []).append(time.time())


def _me(user: models.DepartmentUser, db: Session) -> schemas.DepartmentMe:
    dept = user.department or db.query(models.Department).filter(models.Department.id == user.department_id).first()
    if not dept:
        raise HTTPException(status_code=403, detail="This account is not linked to a department.")
    return schemas.DepartmentMe(
        id=user.id,
        username=user.username,
        department_id=dept.id,
        department_name=dept.name,
        department_code=dept.code,
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.DepartmentLoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    bucket = f"dept-login:{ip}"
    if _rate_limited(bucket):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")
    username = auth.normalize_username(payload.username)
    user = db.query(models.DepartmentUser).filter(models.DepartmentUser.username == username).first()
    if not user or not auth.verify_password(payload.password, user.password_hash):
        _note_failure(bucket)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if int(user.is_active or 0) != 1:
        raise HTTPException(status_code=403, detail="This account is deactivated.")
    return schemas.TokenResponse(access_token=auth.create_department_token(user.id, user.token_version or 1))


@router.get("/me", response_model=schemas.DepartmentMe)
def me(user: models.DepartmentUser = Depends(auth.require_department_user), db: Session = Depends(get_db)):
    fresh = (
        db.query(models.DepartmentUser)
        .options(joinedload(models.DepartmentUser.department))
        .filter(models.DepartmentUser.id == user.id)
        .first()
    )
    if not fresh:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    return _me(fresh, db)


@router.post("/logout")
def logout(user: models.DepartmentUser = Depends(auth.require_department_user), db: Session = Depends(get_db)):
    row = db.query(models.DepartmentUser).filter(models.DepartmentUser.id == user.id).first()
    if not row:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    row.token_version = int(row.token_version or 1) + 1
    db.commit()
    return {"ok": True}
