"""
KKMMPTC — FastAPI backend (staff/HOD/events/principal/grievances/notices/
applications + image uploads) + static frontend server.

Run with:  uvicorn main:app --reload
Then open: http://localhost:8000
"""
import os
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.orm import Session

from database import Base, engine, ensure_sqlite_columns, get_db
import models
from routers import admin_auth, departments, staff, events, principal, grievances, notices, applications, gallery, college_info

Base.metadata.create_all(bind=engine)
ensure_sqlite_columns()

app = FastAPI(title="KKMMPTC Admin API", version="1.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


@app.middleware("http")
async def no_cache_for_frontend(request: Request, call_next):
    """
    This project's HTML/CSS/JS files change frequently during development.
    Without this, browsers can cache them aggressively and keep showing an
    old version after a fix ships — the classic "I fixed it but it still
    looks broken" trap. /api/* and /uploads/* responses are left alone
    (uploaded images are immutable once created, so those are fine to cache).
    """
    response = await call_next(request)
    if not request.url.path.startswith("/api/") and not request.url.path.startswith("/uploads/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


app.include_router(admin_auth.router)
app.include_router(departments.router)
app.include_router(staff.router)
app.include_router(events.router)
app.include_router(principal.router)
app.include_router(grievances.router)
app.include_router(notices.router)
app.include_router(applications.router)
app.include_router(gallery.router)
app.include_router(college_info.router)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


def _admin_registered(db: Session) -> bool:
    return db.query(models.AdminUser).first() is not None


@app.get("/admin-register", include_in_schema=False)
@app.get("/admin-register.html", include_in_schema=False)
def admin_register_page(db: Session = Depends(get_db)):
    """Unlisted setup URL. Closed permanently after the first admin is created."""
    if _admin_registered(db):
        return HTMLResponse(
            "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Forbidden</title></head>"
            "<body style='font-family:sans-serif;padding:2rem'><h1>403 Forbidden</h1>"
            "<p>Admin registration is closed.</p></body></html>",
            status_code=403,
        )
    path = os.path.join(FRONTEND_DIR, "admin-register.html")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, headers={"X-Robots-Tag": "noindex, nofollow"})


@app.get("/admin-login", include_in_schema=False)
@app.get("/admin-login.html", include_in_schema=False)
def admin_login_page():
    path = os.path.join(FRONTEND_DIR, "admin-login.html")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path)


if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
