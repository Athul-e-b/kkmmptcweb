"""
Scope of this database: department Staff/HOD, Events, the college-wide
Principal's Message, Grievances, and — as of this change — Notices and
Admission pre-registration Applications too, so every admin surface on the
site (department-admin.html AND admin.html) is backed by the same real
database with the same admin-password check, instead of admin.html's
original localStorage-only, no-login version.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
import enum
from database import Base


class RoleEnum(str, enum.Enum):
    HOD = "HOD"
    Faculty = "Faculty"


class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    vision = Column(Text, nullable=True)
    mission = Column(Text, nullable=True)
    phone = Column(String(40), nullable=True)
    email = Column(String(160), nullable=True)
    image_url = Column(String(255), nullable=True)
    course_name = Column(String(160), nullable=True)
    duration = Column(String(80), nullable=True)
    intake = Column(Integer, nullable=True)
    eligibility = Column(Text, nullable=True)
    other_details = Column(Text, nullable=True)
    labs_text = Column(Text, nullable=True)
    career_text = Column(Text, nullable=True)
    is_active = Column(Integer, default=1)
    sort_order = Column(Integer, default=0)

    staff = relationship("Staff", back_populates="department", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="department")
    gallery = relationship("GalleryPhoto", back_populates="department")


class Staff(Base):
    __tablename__ = "staff"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    name = Column(String(120), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False, default=RoleEnum.Faculty)
    designation = Column(String(150), nullable=True)   # e.g. "Assistant Professor"
    qualification = Column(String(200), nullable=True)
    email = Column(String(160), nullable=True)
    phone = Column(String(40), nullable=True)
    photo_url = Column(String(255), nullable=True)
    is_active = Column(Integer, default=1)
    is_in_charge = Column(Integer, default=0)  # 1 = HOD serving In Charge; missing/0 = regular HOD
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", back_populates="staff")


class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)  # null = college-wide
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    event_date = Column(String(20), nullable=True)  # free-text date, e.g. "2026-08-15"
    start_time = Column(String(20), nullable=True)
    end_time = Column(String(20), nullable=True)
    venue = Column(String(160), nullable=True)
    organizer = Column(String(160), nullable=True)
    category = Column(String(60), nullable=True)
    registration_link = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="published")  # published | draft
    image_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", back_populates="events")


class CollegeInfo(Base):
    """Singleton college contact / identity record (row id=1)."""
    __tablename__ = "college_info"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=True)
    short_name = Column(String(80), nullable=True)
    address = Column(Text, nullable=True)
    phone = Column(String(40), nullable=True)
    mobile = Column(String(40), nullable=True)
    email = Column(String(160), nullable=True)
    website = Column(String(200), nullable=True)
    maps_url = Column(String(400), nullable=True)
    youtube_url = Column(String(200), nullable=True)
    facebook_url = Column(String(200), nullable=True)
    instagram_url = Column(String(200), nullable=True)
    office_hours = Column(String(160), nullable=True)
    established = Column(String(20), nullable=True)
    governing_body = Column(String(200), nullable=True)
    approval = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Principal(Base):
    """
    College-wide, not department-scoped — deliberately a singleton (always
    row id=1, get-or-created on first read/write) since there's only ever
    one Principal, unlike Staff which is per-department.
    """
    __tablename__ = "principal"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=True)
    designation = Column(String(120), nullable=True, default="Principal")
    qualification = Column(String(200), nullable=True)
    quote = Column(Text, nullable=True)
    message = Column(Text, nullable=True)  # paragraphs separated by a blank line
    email = Column(String(160), nullable=True)
    phone = Column(String(40), nullable=True)
    photo_url = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GrievanceStatusEnum(str, enum.Enum):
    Open = "Open"
    InProgress = "In Progress"
    Resolved = "Resolved"
    Closed = "Closed"


class Grievance(Base):
    """
    Public write (anyone can submit, no login), admin-only read — the
    inverse of Staff/Events/Principal. Submission is intentionally not
    tied to a user account, so a complainant can also mark it anonymous.
    """
    __tablename__ = "grievances"
    id = Column(Integer, primary_key=True, index=True)
    is_anonymous = Column(Integer, default=0)  # 1 = hide name/contact from display
    name = Column(String(120), nullable=True)
    email = Column(String(160), nullable=True)
    phone = Column(String(40), nullable=True)
    category = Column(String(60), nullable=False)  # Academic, Administrative, Infrastructure, Ragging/Harassment, Other
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    course = Column(String(120), nullable=True)
    year_semester = Column(String(80), nullable=True)
    subject = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(Enum(GrievanceStatusEnum), nullable=False, default=GrievanceStatusEnum.Open)
    admin_response = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    department = relationship("Department")


class Notice(Base):
    """
    Powers both the public Notice Board (index.html) and admin.html's
    "Publish New Notice" form. category matches admin.html's dropdown
    exactly (Admissions / Examinations / Tender / Placement) so no
    frontend changes are needed beyond swapping localStorage for API calls.
    """
    __tablename__ = "notices"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(60), nullable=False, default="Admissions")
    description = Column(Text, nullable=True)
    link_url = Column(String(400), nullable=True)
    document_url = Column(String(255), nullable=True)
    is_published = Column(Integer, default=1)
    is_important = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class ApplicationStatusEnum(str, enum.Enum):
    NewSubmission = "New Submission"
    PendingReview = "Pending Review"
    Verified = "Verified"
    Approved = "Approved"


class Application(Base):
    """Admission pre-registration submitted publicly from admissions.html; reviewed from admin.html."""
    __tablename__ = "applications"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    phone = Column(String(40), nullable=True)
    email = Column(String(160), nullable=True)
    dept = Column(String(120), nullable=False)   # department NAME (string), matching admissions.js's regDept value
    qual = Column(String(60), nullable=True)
    marks = Column(String(20), nullable=True)
    status = Column(Enum(ApplicationStatusEnum), nullable=False, default=ApplicationStatusEnum.NewSubmission)
    created_at = Column(DateTime, default=datetime.utcnow)


class GalleryCategoryEnum(str, enum.Enum):
    Campus = "campus"
    Labs = "labs"
    Events = "events"


class GalleryPhoto(Base):
    """
    Campus Photo Gallery on the home page and department pages.
    media_type: image | video. video_url holds YouTube/external URLs.
    """
    __tablename__ = "gallery_photos"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(60), nullable=False, default="campus")
    title = Column(String(200), nullable=True)
    caption = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    media_type = Column(String(20), nullable=False, default="image")  # image | video
    image_url = Column(String(255), nullable=True)
    video_url = Column(String(400), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    featured = Column(Integer, default=0)
    display_order = Column(Integer, default=0)
    media_date = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", back_populates="gallery")


class AdminUser(Base):
    """
    Singleton administrator. `slot` is always 1 and unique so SQLite/SQLAlchemy
    refuse a second row. Phone number is the login user id.
    """
    __tablename__ = "admin_users"
    id = Column(Integer, primary_key=True, index=True)
    slot = Column(Integer, unique=True, nullable=False, default=1)
    name = Column(String(120), nullable=False)
    email = Column(String(160), unique=True, nullable=False)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    setup_completed = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

