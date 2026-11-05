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

# Previous homepage ticker copy. Inserted once, only when the table is empty,
# so an existing install keeps the same announcements until an admin edits them.
DEFAULT_SCROLLING_NOTIFICATIONS = (
    "🎓 Diploma Admissions 2026-27 under IHRD: Apply Online via Single Window System at polyadmission.org",
    "⚡ Industry on Campus (IOC) Earn-As-You-Learn Scheme Active across all Engineering Departments",
    "🏆 KKMMPTC Students Win State Level Technical Paper Presentation Award 2026",
    "📅 Upcoming 3-Day National Workshop on Embedded Systems & Robotics starting next Monday",
)


def seed_scrolling_notifications_if_empty():
    import models
    db = SessionLocal()
    try:
        if db.query(models.ScrollingNotification).count():
            return
        for index, message in enumerate(DEFAULT_SCROLLING_NOTIFICATIONS, start=1):
            db.add(models.ScrollingNotification(
                message=message,
                is_active=1,
                display_order=index,
            ))
        db.commit()
    finally:
        db.close()


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
        "is_in_charge": "INTEGER DEFAULT 0",
    },
    "events": {
        "start_time": "VARCHAR(20)",
        "end_time": "VARCHAR(20)",
        "venue": "VARCHAR(160)",
        "organizer": "VARCHAR(160)",
        "category": "VARCHAR(60)",
        "registration_link": "VARCHAR(255)",
        "status": "VARCHAR(20) DEFAULT 'published'",
        "event_type": "VARCHAR(60)",
        "participants_text": "TEXT",
        "participant_count": "INTEGER",
        "photo_urls": "TEXT",
        "club_id": "INTEGER",
        "review_status": "VARCHAR(20)",
        "rejection_reason": "TEXT",
        "academic_year": "VARCHAR(20)",
        "created_by": "VARCHAR(80)",
        "approved_by": "VARCHAR(80)",
        "updated_at": "DATETIME",
    },
    "principal": {
        "qualification": "VARCHAR(200)",
    },
    "notices": {
        "link_url": "VARCHAR(400)",
        "document_url": "VARCHAR(255)",
        "is_published": "INTEGER DEFAULT 1",
        "is_important": "INTEGER DEFAULT 0",
        "department_id": "INTEGER",
        "deadline": "VARCHAR(20)",
        "review_status": "VARCHAR(20)",
        "rejection_reason": "TEXT",
        "academic_year": "VARCHAR(20)",
        "created_by": "VARCHAR(80)",
        "approved_by": "VARCHAR(80)",
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
        "review_status": "VARCHAR(20)",
        "rejection_reason": "TEXT",
        "academic_year": "VARCHAR(20)",
        "created_by": "VARCHAR(80)",
        "approved_by": "VARCHAR(80)",
    },
    "grievances": {
        "course": "VARCHAR(120)",
        "year_semester": "VARCHAR(80)",
        "created_at": "DATETIME",
        "updated_at": "DATETIME",
    },
    "department_users": {
        "name": "VARCHAR(120)",
        "designation": "VARCHAR(120)",
        "email": "VARCHAR(160)",
    },
    "department_clubs": {
        "description": "TEXT",
        "category": "VARCHAR(80)",
        "faculty_in_charge": "VARCHAR(120)",
        "established_on": "VARCHAR(40)",
        "meeting_info": "TEXT",
        "cover_url": "VARCHAR(255)",
        "is_active": "INTEGER DEFAULT 1",
    },
    "clubs": {
        "category": "VARCHAR(40)",
        "club_type": "VARCHAR(20) DEFAULT 'campus'",
        "department_id": "INTEGER",
        "status": "VARCHAR(20) DEFAULT 'draft'",
        "is_active": "INTEGER DEFAULT 1",
        "objectives": "TEXT",
        "activities_text": "TEXT",
        "meeting_info": "TEXT",
        "established_on": "VARCHAR(40)",
        "coordinator": "VARCHAR(120)",
        "faculty_in_charge": "VARCHAR(120)",
        "contact_info": "TEXT",
        "logo_url": "VARCHAR(255)",
        "cover_url": "VARCHAR(255)",
    },
    "department_club_members": {
        "admission_number": "VARCHAR(40)",
        "semester": "VARCHAR(40)",
        "photo_url": "VARCHAR(255)",
        "is_active": "INTEGER DEFAULT 1",
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

    if "department_clubs" in inspect(engine).get_table_names():
        with engine.begin() as conn:
            conn.execute(text(
                "UPDATE department_clubs SET review_status = 'approved' WHERE review_status = 'pending'"
            ))


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
                review_status VARCHAR(20),
                rejection_reason TEXT,
                academic_year VARCHAR(20),
                created_by VARCHAR(80),
                approved_by VARCHAR(80),
                FOREIGN KEY(department_id) REFERENCES departments (id)
            )
        """))
        kept = [
            "id", "category", "caption", "image_url", "created_at", "title", "description",
            "media_type", "video_url", "department_id", "featured", "display_order", "media_date",
            "review_status", "rejection_reason", "academic_year", "created_by", "approved_by",
        ]
        copy_cols = ", ".join(name for name in existing if name in kept)
        conn.execute(text(
            f"INSERT INTO gallery_photos_new ({copy_cols}) SELECT {copy_cols} FROM gallery_photos"
        ))
        conn.execute(text("DROP TABLE gallery_photos"))
        conn.execute(text("ALTER TABLE gallery_photos_new RENAME TO gallery_photos"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_gallery_photos_id ON gallery_photos (id)"))
        conn.execute(text("PRAGMA foreign_keys=ON"))


def _allow_three_department_users():
    """Drop the one-account-per-department unique rule and keep email unique."""
    if not SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        return
    inspector = inspect(engine)
    if "department_users" not in inspector.get_table_names():
        return
    table_sql = ""
    with engine.connect() as conn:
        table_sql = conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='department_users'"
        )).scalar() or ""
    unique_on_department = "department_id" in table_sql.lower() and "unique" in table_sql.lower()
    indexed = any(
        item.get("unique") and item.get("column_names") == ["department_id"]
        for item in inspector.get_indexes("department_users")
    )
    if not unique_on_department and not indexed:
        return
    existing = [c["name"] for c in inspector.get_columns("department_users")]
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=OFF"))
        conn.execute(text("""
            CREATE TABLE department_users_new (
                id INTEGER NOT NULL PRIMARY KEY,
                department_id INTEGER NOT NULL,
                username VARCHAR(32) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                token_version INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME,
                updated_at DATETIME,
                name VARCHAR(120),
                designation VARCHAR(120),
                email VARCHAR(160),
                FOREIGN KEY(department_id) REFERENCES departments (id)
            )
        """))
        kept = [
            "id", "department_id", "username", "password_hash", "is_active",
            "token_version", "created_at", "updated_at", "name", "designation", "email",
        ]
        copy_cols = ", ".join(name for name in existing if name in kept)
        conn.execute(text(
            f"INSERT INTO department_users_new ({copy_cols}) SELECT {copy_cols} FROM department_users"
        ))
        conn.execute(text("DROP TABLE department_users"))
        conn.execute(text("ALTER TABLE department_users_new RENAME TO department_users"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_department_users_username ON department_users (username)"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_department_users_email ON department_users (email)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_department_users_department_id ON department_users (department_id)"))
        conn.execute(text("PRAGMA foreign_keys=ON"))


PLACEHOLDER = (
    "Placeholder — replace this in the admin panel. This is not an official college statement."
)

RETIRED_CLUB_SLUGS = ("music", "sports", "arts", "coding")


def seed_campus_pages_if_missing():
    """Insert the IIC page when it is missing, and retire the old placeholder clubs."""
    import models
    from file_storage import delete_local_file
    db = SessionLocal()
    try:
        if db.query(models.IICPage).count() == 0:
            db.add(models.IICPage(
                hero_title="Institution's Innovation Council",
                hero_intro=(
                    PLACEHOLDER + " Describe how the Institution's Innovation Council supports "
                    "innovation, creativity, entrepreneurship, and practical problem-solving."
                ),
                about=PLACEHOLDER + " Add an introduction to the Institution's Innovation Council.",
                vision=PLACEHOLDER + " Add the council's vision.",
                mission=PLACEHOLDER + " Add the council's mission.",
                objectives=PLACEHOLDER + " Add one objective on each line.",
                participation=PLACEHOLDER + " Describe how students take part and develop ideas.",
                workshops_note=PLACEHOLDER + " Describe workshops, seminars, competitions, and related events.",
            ))
        old_clubs = db.query(models.Club).filter(models.Club.slug.in_(RETIRED_CLUB_SLUGS)).all()
        for club in old_clubs:
            for image in list(club.images):
                delete_local_file(image.image_url)
            delete_local_file(club.logo_url)
            delete_local_file(club.cover_url)
            for member in list(club.members):
                delete_local_file(member.photo_url)
            db.delete(club)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

