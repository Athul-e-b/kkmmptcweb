"""
JWT admin sessions authenticated against the registered AdminUser password hash.
Passwords are never stored or compared in plaintext.

Set JWT_SECRET in production. Registration OTP 1234 is development-only
(KKM_ENV != production).
"""
import os
import re
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt

SECRET_KEY = os.environ.get("JWT_SECRET", "dev-secret-change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours
KKM_ENV = os.environ.get("KKM_ENV", "development").strip().lower()
IS_PRODUCTION = KKM_ENV in ("production", "prod")

# DEVELOPMENT ONLY — never used when KKM_ENV=production
DEV_OTP = "1234"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/admin/login", auto_error=False)

PASSWORD_SPECIAL = re.compile(r"[^A-Za-z0-9]")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[6-9]\d{9}$")


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    return digits


def password_issues(password: str) -> list:
    issues = []
    if not password or len(password) < 8:
        issues.append("at least 8 characters")
    if not re.search(r"[A-Z]", password or ""):
        issues.append("an uppercase letter")
    if not re.search(r"[a-z]", password or ""):
        issues.append("a lowercase letter")
    if not re.search(r"\d", password or ""):
        issues.append("a number")
    if not PASSWORD_SPECIAL.search(password or ""):
        issues.append("a special character")
    return issues


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("ascii"))
    except ValueError:
        return False


USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,31}$")


def normalize_username(raw: str) -> str:
    return (raw or "").strip().lower()


def create_access_token(phone: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": "admin", "phone": phone, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def create_department_token(user_id: int, token_version: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": "department", "uid": int(user_id), "tv": int(token_version), "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def _decode_token(token: str) -> dict:
    if token is None:
        raise HTTPException(status_code=401, detail="Login required")
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")


def require_admin(token: str = Depends(oauth2_scheme)):
    payload = _decode_token(token)
    if payload.get("sub") != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")
    return True


def require_department_user(token: str = Depends(oauth2_scheme)):
    """Department identity comes only from the signed token plus the live database row."""
    from database import SessionLocal
    import models

    payload = _decode_token(token)
    if payload.get("sub") != "department":
        raise HTTPException(status_code=401, detail="Department login required")
    try:
        user_id = int(payload.get("uid"))
        token_version = int(payload.get("tv"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Department login required")
    db = SessionLocal()
    try:
        user = db.query(models.DepartmentUser).filter(models.DepartmentUser.id == user_id).first()
        if not user or int(user.token_version or 0) != token_version:
            raise HTTPException(status_code=401, detail="Session expired, please log in again")
        if int(user.is_active or 0) != 1:
            raise HTTPException(status_code=403, detail="This account is deactivated.")
        db.expunge(user)
        return user
    finally:
        db.close()
