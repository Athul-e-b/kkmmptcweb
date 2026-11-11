"""Public search metadata. Canonical URLs always use the primary domain."""
import os
from datetime import datetime, timezone
from xml.sax.saxutils import escape

PRIMARY_ORIGIN = "https://kkmmptc.com"
REDIRECT_HOSTS = {
    "www.kkmmptc.com",
    "kkmmptconline.dpdns.org",
    "www.kkmmptconline.dpdns.org",
}

# Static public pages. /index.html is the same document as / and is not listed again.
PUBLIC_PAGES = (
    ("/", "index.html"),
    ("/departments.html", "departments.html"),
    ("/admissions.html", "admissions.html"),
    ("/first-year.html", "first-year.html"),
    ("/clubs.html", "clubs.html"),
    ("/iic.html", "iic.html"),
    ("/grievance.html", "grievance.html"),
)

PRIVATE_PREFIXES = (
    "/admin.html",
    "/admin-login",
    "/admin-register",
    "/department-admin.html",
    "/department-dashboard.html",
    "/department-login.html",
    "/api/",
    "/docs",
    "/redoc",
    "/openapi.json",
)

ROBOTS_TXT = """User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /admin-login
Disallow: /admin-login.html
Disallow: /admin-register
Disallow: /admin-register.html
Disallow: /department-admin.html
Disallow: /department-dashboard.html
Disallow: /department-login.html
Disallow: /api/
Disallow: /docs
Disallow: /redoc
Disallow: /openapi.json

Sitemap: https://kkmmptc.com/sitemap.xml
"""


def request_host(headers) -> str:
    raw = headers.get("x-forwarded-host") or headers.get("host") or ""
    return raw.split(",")[0].strip().split(":")[0].lower()


def forwarded_proto(headers) -> str:
    return (headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()


def canonical_redirect(host: str, proto: str, path: str, query: str) -> str:
    """Return a primary-domain URL when the request uses a known duplicate host or plain HTTP."""
    if path.startswith("/api/") or path.startswith("/uploads/"):
        return ""
    duplicate_host = host in REDIRECT_HOSTS
    insecure = proto == "http" and (duplicate_host or host == "kkmmptc.com")
    if not duplicate_host and not insecure:
        return ""
    target = PRIMARY_ORIGIN + (path or "/")
    if query:
        target += "?" + query
    return target


def is_private_path(path: str) -> bool:
    return any(path == prefix or path.startswith(prefix) for prefix in PRIVATE_PREFIXES)


def _lastmod(frontend_dir: str, filename: str) -> str:
    path = os.path.join(frontend_dir, filename)
    try:
        stamp = os.path.getmtime(path)
    except OSError:
        return ""
    return datetime.fromtimestamp(stamp, timezone.utc).date().isoformat()


def _department_paths():
    try:
        from database import SessionLocal
        import models
    except Exception:
        return []
    db = SessionLocal()
    try:
        rows = db.query(models.Department.code, models.Department.is_active).all()
    except Exception:
        return []
    finally:
        db.close()
    paths = []
    seen = set()
    for code, active in rows:
        if active not in (None, 1):
            continue
        label = (code or "").strip().upper()
        if not label or label in seen:
            continue
        seen.add(label)
        paths.append("/departments.html?department=" + label)
    return paths


def build_sitemap(frontend_dir: str) -> str:
    entries = []
    seen = set()

    def add(path: str, filename: str):
        loc = PRIMARY_ORIGIN + path
        if loc in seen:
            return
        seen.add(loc)
        modified = _lastmod(frontend_dir, filename)
        lastmod = f"<lastmod>{modified}</lastmod>" if modified else ""
        entries.append(f"<url><loc>{escape(loc)}</loc>{lastmod}</url>")

    for path, filename in PUBLIC_PAGES:
        if os.path.isfile(os.path.join(frontend_dir, filename)):
            add(path, filename)
    for path in _department_paths():
        add(path, "departments.html")
    body = "".join(entries)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{body}</urlset>"
    )
