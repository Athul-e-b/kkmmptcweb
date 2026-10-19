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


PLACEHOLDER = (
    "Placeholder — replace this in the admin panel. This is not an official college statement."
)

CLUB_SEEDS = (
    ("music", "Music Club", 1, "music, performance, and listening activities the college chooses to publish"),
    ("sports", "Sports Club", 2, "sporting activities, practice, and college sports days the office chooses to publish"),
    ("arts", "Arts Club", 3, "artistic and cultural activities the college chooses to publish"),
    ("coding", "Coding Club", 4, "coding, programming, and collaborative learning the college chooses to publish"),
)


def seed_campus_pages_if_missing():
    """Insert the IIC page and four clubs only when those rows are absent."""
    import models
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
        existing = {row.slug for row in db.query(models.Club.slug).all()}
        for slug, name, order, focus in CLUB_SEEDS:
            if slug in existing:
                continue
            db.add(models.Club(
                slug=slug,
                name=name,
                display_order=order,
                is_published=1,
                intro=PLACEHOLDER + f" Introduce the {name}.",
                description=PLACEHOLDER + f" Describe {focus}. Do not add results, awards, or participation that the college has not supplied.",
            ))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

