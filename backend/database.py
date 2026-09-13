import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLALCHEMY_DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'kkmmptc.db')}"
)
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# create_all() never ALTERs existing SQLite tables. Add missing columns only.
EXTRA_COLUMNS = {
    "departments": {
        "description": "TEXT",
        "vision": "TEXT",
        "mission": "TEXT",
        "phone": "VARCHAR(40)",
        "email": "VARCHAR(160)",
        "image_url": "VARCHAR(255)",
        "course_name": "VARCHAR(160)",
        "duration": "VARCHAR(80)",
        "intake": "INTEGER",
        "eligibility": "TEXT",
        "other_details": "TEXT",
        "labs_text": "TEXT",
        "career_text": "TEXT",
        "is_active": "INTEGER DEFAULT 1",
        "sort_order": "INTEGER DEFAULT 0",
    },
    "staff": {
        "phone": "VARCHAR(40)",
        "is_active": "INTEGER DEFAULT 1",
    },
    "events": {
        "start_time": "VARCHAR(20)",
        "end_time": "VARCHAR(20)",
        "venue": "VARCHAR(160)",
        "organizer": "VARCHAR(160)",
        "category": "VARCHAR(60)",
        "registration_link": "VARCHAR(255)",
        "status": "VARCHAR(20) DEFAULT 'published'",
    },
    "principal": {
        "qualification": "VARCHAR(200)",
    },
    "notices": {
        "link_url": "VARCHAR(400)",
        "document_url": "VARCHAR(255)",
        "is_published": "INTEGER DEFAULT 1",
        "is_important": "INTEGER DEFAULT 0",
    },
    "gallery_photos": {
        "title": "VARCHAR(200)",
        "description": "TEXT",
        "media_type": "VARCHAR(20) DEFAULT 'image'",
        "video_url": "VARCHAR(400)",
        "department_id": "INTEGER",
        "featured": "INTEGER DEFAULT 0",
        "display_order": "INTEGER DEFAULT 0",
        "media_date": "VARCHAR(20)",
    },
    "grievances": {
        "course": "VARCHAR(120)",
        "year_semester": "VARCHAR(80)",
        "created_at": "DATETIME",
        "updated_at": "DATETIME",
    },
}


def ensure_sqlite_columns():
    if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        return
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, cols in EXTRA_COLUMNS.items():
            if table not in tables:
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in cols.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
    _relax_gallery_image_url_null()


def _relax_gallery_image_url_null():
    """Videos store video_url only; image_url must be allowed to be NULL."""
    if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        return
    inspector = inspect(engine)
    if "gallery_photos" not in inspector.get_table_names():
        return
    cols = inspector.get_columns("gallery_photos")
    image_col = next((c for c in cols if c["name"] == "image_url"), None)
    if not image_col or image_col.get("nullable", True):
        return
    existing = [c["name"] for c in cols]
    copy_cols = ", ".join(existing)
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=OFF"))
        conn.execute(text("""
            CREATE TABLE gallery_photos_new (
                id INTEGER NOT NULL PRIMARY KEY,
                category VARCHAR(60) NOT NULL,
                caption VARCHAR(200),
                image_url VARCHAR(255),
                created_at DATETIME,
                title VARCHAR(200),
                description TEXT,
                media_type VARCHAR(20) DEFAULT 'image',
                video_url VARCHAR(400),
                department_id INTEGER,
                featured INTEGER DEFAULT 0,
                display_order INTEGER DEFAULT 0,
                media_date VARCHAR(20),
                FOREIGN KEY(department_id) REFERENCES departments (id)
            )
        """))
        conn.execute(text(
            f"INSERT INTO gallery_photos_new ({copy_cols}) SELECT {copy_cols} FROM gallery_photos"
        ))
        conn.execute(text("DROP TABLE gallery_photos"))
        conn.execute(text("ALTER TABLE gallery_photos_new RENAME TO gallery_photos"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_gallery_photos_id ON gallery_photos (id)"))
        conn.execute(text("PRAGMA foreign_keys=ON"))
