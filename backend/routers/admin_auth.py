"""Admin login + one-time registration. Register endpoints refuse once an admin exists."""
import hmac
import os
import time
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
import auth, schemas, models

router = APIRouter(prefix="/api/admin", tags=["admin-auth"])

# In-memory pending signup. Password is stored hashed only. Never logged.
_pending: Optional[dict] = None
_login_hits: dict = {}  # key -> [timestamps]


def _admin_exists(db: Session) -> bool:
    return db.query(models.AdminUser).first() is not None


def _require_open_registration(db: Session):
    if _admin_exists(db):
        raise HTTPException(status_code=403, detail="Admin registration is closed.")


def _expected_otp() -> Optional[str]:
    if auth.IS_PRODUCTION:
        return os_env_otp()
    return auth.DEV_OTP


def os_env_otp() -> Optional[str]:
    val = (os.environ.get("ADMIN_SETUP_OTP") or "").strip()
    return val or None


def _rate_limited(key: str, limit: int = 8, window: int = 900) -> bool:
    now = time.time()
    hits = [t for t in _login_hits.get(key, []) if now - t < window]
    _login_hits[key] = hits
    return len(hits) >= limit


def _note_failure(key: str):
    _login_hits.setdefault(key, []).append(time.time())


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    admin = db.query(models.AdminUser).first()
    if not admin:
        raise HTTPException(status_code=401, detail="No admin account is registered yet.")
    ip = request.client.host if request.client else "unknown"
    bucket = f"login:{ip}"
    if _rate_limited(bucket):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")
    if not auth.verify_password(payload.password, admin.password_hash):
        _note_failure(bucket)
        raise HTTPException(status_code=401, detail="Incorrect password")
    return schemas.TokenResponse(access_token=auth.create_access_token(admin.phone))


@router.post("/register")
def register_start(payload: schemas.AdminRegisterStart, request: Request, db: Session = Depends(get_db)):
    """Validate details and hold a pending signup until OTP is verified. Does not create the account."""
    _require_open_registration(db)
    ip = request.client.host if request.client else "unknown"
    bucket = f"reg:{ip}"
    if _rate_limited(bucket, limit=12, window=3600):
        raise HTTPException(status_code=429, detail="Too many registration attempts. Try again later.")

    name = payload.name.strip()
    email = payload.email.lower().strip()
    phone = auth.normalize_phone(payload.phone)
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Full name is required")
    if not auth.EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if not auth.PHONE_RE.match(phone):
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit Indian mobile number")
    issues = auth.password_issues(payload.password)
    if issues:
        _note_failure(bucket)
        raise HTTPException(status_code=400, detail="Password is not strong enough. It needs " + ", ".join(issues) + ".")
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Password and confirm password do not match")

    global _pending
    _pending = {
        "name": name,
        "email": email,
        "phone": phone,
        "password_hash": auth.hash_password(payload.password),
        "expires": time.time() + 15 * 60,
        "otp_attempts": 0,
    }
    body = {"ok": True, "otp_required": True, "show_dev_otp": not auth.IS_PRODUCTION}
    return body


@router.post("/register/verify")
def register_verify(payload: schemas.AdminOtpVerify, db: Session = Depends(get_db)):
    """Create the single admin account after a correct OTP. DEVELOPMENT OTP is 1234 when KKM_ENV is not production."""
    _require_open_registration(db)
    global _pending
    pending = _pending
    if not pending or time.time() > pending.get("expires", 0):
        _pending = None
        raise HTTPException(status_code=400, detail="Registration session expired. Submit the form again.")
    pending["otp_attempts"] = int(pending.get("otp_attempts") or 0) + 1
    if pending["otp_attempts"] > 5:
        _pending = None
        raise HTTPException(status_code=429, detail="Too many incorrect OTP attempts. Start again.")

    expected = _expected_otp()
    if not expected:
        raise HTTPException(status_code=503, detail="OTP verification is not configured for production.")
    submitted = (payload.otp or "").strip()
    if not hmac.compare_digest(submitted, expected):
        raise HTTPException(status_code=400, detail="Incorrect OTP")

    if _admin_exists(db):
        _pending = None
        raise HTTPException(status_code=403, detail="Admin registration is closed.")

    row = models.AdminUser(
        slot=1,
        name=pending["name"],
        email=pending["email"],
        phone=pending["phone"],
        password_hash=pending["password_hash"],
        setup_completed=1,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        _pending = None
        raise HTTPException(status_code=403, detail="Admin registration is closed.")
    _pending = None
    return {"ok": True, "redirect": "/admin-login"}


@router.get("/stats", response_model=schemas.DashboardStats)
def dashboard_stats(_admin: bool = Depends(auth.require_admin), db: Session = Depends(get_db)):
    return schemas.DashboardStats(
        departments=db.query(models.Department).count(),
        faculty=db.query(models.Staff).count(),
        events=db.query(models.Event).count(),
        gallery=db.query(models.GalleryPhoto).count(),
        notices=db.query(models.Notice).count(),
        grievances=db.query(models.Grievance).count(),
        applications=db.query(models.Application).count(),
    )
