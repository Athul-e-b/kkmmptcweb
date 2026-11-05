"""
Scope of this database: department Staff/HOD, Events, the college-wide
Principal's Message, Grievances, and — as of this change — Notices and
Admission pre-registration Applications too, so every admin surface on the
site (department-admin.html AND admin.html) is backed by the same real
database with the same admin-password check, instead of admin.html's
original localStorage-only, no-login version.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum, UniqueConstraint
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
    login_accounts = relationship("DepartmentUser", back_populates="department")


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
    event_type = Column(String(60), nullable=True)
    participants_text = Column(Text, nullable=True)
    participant_count = Column(Integer, nullable=True)
    photo_urls = Column(Text, nullable=True)
    club_id = Column(Integer, ForeignKey("department_clubs.id"), nullable=True, index=True)
    review_status = Column(String(20), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    academic_year = Column(String(20), nullable=True)
    created_by = Column(String(80), nullable=True)
    approved_by = Column(String(80), nullable=True)
    updated_at = Column(DateTime, nullable=True)

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
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True, index=True)
    deadline = Column(String(20), nullable=True)
    review_status = Column(String(20), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    academic_year = Column(String(20), nullable=True)
    created_by = Column(String(80), nullable=True)
    approved_by = Column(String(80), nullable=True)

    department = relationship("Department")


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
    review_status = Column(String(20), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    academic_year = Column(String(20), nullable=True)
    created_by = Column(String(80), nullable=True)
    approved_by = Column(String(80), nullable=True)

    department = relationship("Department", back_populates="gallery")


class ScrollingNotification(Base):
    """Messages shown in the public homepage notification bar."""
    __tablename__ = "scrolling_notifications"
    id = Column(Integer, primary_key=True, index=True)
    message = Column(String(400), nullable=False)
    link_url = Column(String(400), nullable=True)
    link_label = Column(String(80), nullable=True)
    is_active = Column(Integer, nullable=False, default=1)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DepartmentUser(Base):
    """One login account for an existing department. The department row stays authoritative."""
    """Up to three login accounts for an existing department."""
    __tablename__ = "department_users"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    username = Column(String(32), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(120), nullable=True)
    designation = Column(String(120), nullable=True)
    email = Column(String(160), nullable=True, unique=True, index=True)
    is_active = Column(Integer, nullable=False, default=1)
    token_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    department = relationship("Department", back_populates="login_accounts")

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


class IICPage(Base):
    """Singleton copy for the public Institution's Innovation Council page."""
    __tablename__ = "iic_pages"
    id = Column(Integer, primary_key=True, index=True)
    hero_title = Column(String(200), nullable=False, default="Institution's Innovation Council")
    hero_intro = Column(Text, nullable=True)
    hero_image_url = Column(String(255), nullable=True)
    about = Column(Text, nullable=True)
    vision = Column(Text, nullable=True)
    mission = Column(Text, nullable=True)
    objectives = Column(Text, nullable=True)
    participation = Column(Text, nullable=True)
    workshops_note = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IICActivity(Base):
    __tablename__ = "iic_activities"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    event_date = Column(String(40), nullable=True)
    venue = Column(String(160), nullable=True)
    category = Column(String(80), nullable=True)
    external_url = Column(String(400), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_published = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    photos = relationship(
        "IICActivityPhoto",
        back_populates="activity",
        cascade="all, delete-orphan",
        order_by="IICActivityPhoto.display_order",
    )


class IICActivityPhoto(Base):
    __tablename__ = "iic_activity_photos"
    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey("iic_activities.id"), nullable=False, index=True)
    image_url = Column(String(255), nullable=False)
    caption = Column(String(200), nullable=True)
    alt_text = Column(String(200), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    activity = relationship("IICActivity", back_populates="photos")


class IICGalleryImage(Base):
    __tablename__ = "iic_gallery_images"
    id = Column(Integer, primary_key=True, index=True)
    image_url = Column(String(255), nullable=False)
    caption = Column(String(200), nullable=True)
    alt_text = Column(String(200), nullable=True)
    event_title = Column(String(200), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_published = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Club(Base):
    __tablename__ = "clubs"
    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(40), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    intro = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    category = Column(String(40), nullable=True)
    club_type = Column(String(20), nullable=False, default="campus")
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True, index=True)
    status = Column(String(20), nullable=False, default="draft")
    is_active = Column(Integer, nullable=False, default=1)
    objectives = Column(Text, nullable=True)
    activities_text = Column(Text, nullable=True)
    meeting_info = Column(Text, nullable=True)
    established_on = Column(String(40), nullable=True)
    coordinator = Column(String(120), nullable=True)
    faculty_in_charge = Column(String(120), nullable=True)
    contact_info = Column(Text, nullable=True)
    logo_url = Column(String(255), nullable=True)
    cover_url = Column(String(255), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_published = Column(Integer, nullable=False, default=1)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    department = relationship("Department")
    members = relationship(
        "ClubMember",
        back_populates="club",
        cascade="all, delete-orphan",
        order_by="ClubMember.display_order",
    )
    activities = relationship(
        "ClubActivity",
        back_populates="club",
        cascade="all, delete-orphan",
        order_by="ClubActivity.display_order",
    )
    images = relationship(
        "ClubImage",
        back_populates="club",
        cascade="all, delete-orphan",
        order_by="ClubImage.display_order",
    )


class ClubMember(Base):
    __tablename__ = "club_members"
    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    admission_number = Column(String(40), nullable=True)
    role = Column(String(80), nullable=True)
    photo_url = Column(String(255), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Integer, nullable=False, default=1)
    club = relationship("Club", back_populates="members")

class ClubActivity(Base):
    __tablename__ = "club_activities"
    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    event_date = Column(String(40), nullable=True)
    venue = Column(String(160), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_published = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    club = relationship("Club", back_populates="activities")


class ClubImage(Base):
    __tablename__ = "club_images"
    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("clubs.id"), nullable=False, index=True)
    image_url = Column(String(255), nullable=False)
    caption = Column(String(200), nullable=True)
    alt_text = Column(String(200), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_published = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    club = relationship("Club", back_populates="images")


class DepartmentClub(Base):
    """A club or association that belongs to one diploma department."""
    __tablename__ = "department_clubs"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    name = Column(String(160), nullable=False)
    coordinator = Column(String(120), nullable=True)
    description = Column(Text, nullable=True)
    category = Column(String(80), nullable=True)
    coordinator = Column(String(120), nullable=True)
    faculty_in_charge = Column(String(120), nullable=True)
    established_on = Column(String(40), nullable=True)
    objectives = Column(Text, nullable=True)
    activities = Column(Text, nullable=True)
    meeting_info = Column(Text, nullable=True)
    logo_url = Column(String(255), nullable=True)
    cover_url = Column(String(255), nullable=True)
    is_active = Column(Integer, nullable=False, default=1)
    rejection_reason = Column(Text, nullable=True)
    academic_year = Column(String(20), nullable=True)
    created_by = Column(String(80), nullable=True)
    approved_by = Column(String(80), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    members = relationship("DepartmentClubMember", back_populates="club", cascade="all, delete-orphan")
    department = relationship("Department")


class DepartmentClubMember(Base):
    __tablename__ = "department_club_members"
    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("department_clubs.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    role = Column(String(80), nullable=True)
    year_label = Column(String(40), nullable=True)
    club = relationship("DepartmentClub", back_populates="members")
    admission_number = Column(String(40), nullable=True)
    semester = Column(String(40), nullable=True)
    photo_url = Column(String(255), nullable=True)
    is_active = Column(Integer, nullable=False, default=1)


class DepartmentProject(Base):
    __tablename__ = "department_projects"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    category = Column(String(80), nullable=True)
    people = Column(Text, nullable=True)
    event_date = Column(String(20), nullable=True)
    description = Column(Text, nullable=True)
    photo_url = Column(String(255), nullable=True)
    certificate_url = Column(String(255), nullable=True)
    review_status = Column(String(20), nullable=False, default="pending")
    rejection_reason = Column(Text, nullable=True)
    academic_year = Column(String(20), nullable=True)
    created_by = Column(String(80), nullable=True)
    approved_by = Column(String(80), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    department = relationship("Department")


class ActivityReport(Base):
    __tablename__ = "activity_reports"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=True)
    title = Column(String(200), nullable=False)
    summary = Column(Text, nullable=True)
    academic_year = Column(String(20), nullable=True)
    photo_url = Column(String(255), nullable=True)
    photo_urls = Column(Text, nullable=True)
    document_url = Column(String(255), nullable=True)
    review_status = Column(String(20), nullable=False, default="pending")
    rejection_reason = Column(Text, nullable=True)
    created_by = Column(String(80), nullable=True)
    approved_by = Column(String(80), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    department = relationship("Department")


class FirstYearRevision(Base):
    """A syllabus revision for the common first-year curriculum. Older rows stay in place."""
    __tablename__ = "first_year_revisions"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    academic_year = Column(String(20), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    notes = Column(Text, nullable=True)
    heading = Column(String(200), nullable=True)
    heading_accent = Column(String(120), nullable=True)
    intro_title = Column(String(160), nullable=True)
    description = Column(Text, nullable=True)
    hero_subtitle = Column(Text, nullable=True)
    hero_image_url = Column(String(255), nullable=True)
    announcements = Column(Text, nullable=True)
    overview_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    semesters = relationship("FirstYearSemester", back_populates="revision", cascade="all, delete-orphan")
    subjects = relationship("FirstYearSubject", back_populates="revision")


class FirstYearSemester(Base):
    __tablename__ = "first_year_semesters"
    __table_args__ = (UniqueConstraint("revision_id", "number", name="uq_fy_semester"),)
    id = Column(Integer, primary_key=True, index=True)
    revision_id = Column(Integer, ForeignKey("first_year_revisions.id"), nullable=False, index=True)
    number = Column(Integer, nullable=False)
    title = Column(String(80), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active")
    revision = relationship("FirstYearRevision", back_populates="semesters")
    subjects = relationship("FirstYearSubject", back_populates="semester")


class FirstYearSubject(Base):
    __tablename__ = "first_year_subjects"
    __table_args__ = (UniqueConstraint("revision_id", "course_code", name="uq_fy_course_code"),)
    id = Column(Integer, primary_key=True, index=True)
    revision_id = Column(Integer, ForeignKey("first_year_revisions.id"), nullable=False, index=True)
    semester_id = Column(Integer, ForeignKey("first_year_semesters.id"), nullable=False, index=True)
    course_code = Column(String(20), nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(20), nullable=False, default="shared")
    description = Column(Text, nullable=True)
    syllabus_url = Column(String(255), nullable=True)
    is_active = Column(Integer, nullable=False, default=1)
    display_order = Column(Integer, nullable=False, default=0)
    revision = relationship("FirstYearRevision", back_populates="subjects")
    semester = relationship("FirstYearSemester", back_populates="subjects")
    programmes = relationship("FirstYearSubjectProgramme", back_populates="subject", cascade="all, delete-orphan")
    assignments = relationship("FirstYearAssignment", back_populates="subject")


class FirstYearSubjectProgramme(Base):
    __tablename__ = "first_year_subject_programmes"
    __table_args__ = (UniqueConstraint("subject_id", "department_id", name="uq_fy_subject_programme"),)
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("first_year_subjects.id"), nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    subject = relationship("FirstYearSubject", back_populates="programmes")
    department = relationship("Department")


class FirstYearFaculty(Base):
    """Public first-year profile for an existing staff member. Does not replace the staff row."""
    __tablename__ = "first_year_faculty"
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), unique=True, nullable=False, index=True)
    profile = Column(Text, nullable=True)
    is_active = Column(Integer, nullable=False, default=1)
    staff = relationship("Staff")


class FirstYearAssignment(Base):
    __tablename__ = "first_year_assignments"
    __table_args__ = (
        UniqueConstraint("staff_id", "subject_id", "department_id", "academic_year", name="uq_fy_assignment"),
    )
    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("first_year_subjects.id"), nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    semester_number = Column(Integer, nullable=False)
    academic_year = Column(String(20), nullable=False, default="")
    is_active = Column(Integer, nullable=False, default=1)
    subject = relationship("FirstYearSubject", back_populates="assignments")
    staff = relationship("Staff")
    department = relationship("Department")


class FirstYearResource(Base):
    __tablename__ = "first_year_resources"
    id = Column(Integer, primary_key=True, index=True)
    revision_id = Column(Integer, ForeignKey("first_year_revisions.id"), nullable=True, index=True)
    semester_id = Column(Integer, ForeignKey("first_year_semesters.id"), nullable=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True, index=True)
    subject_id = Column(Integer, ForeignKey("first_year_subjects.id"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    kind = Column(String(30), nullable=False, default="other")
    description = Column(Text, nullable=True)
    file_url = Column(String(255), nullable=True)
    original_name = Column(String(255), nullable=True)
    is_published = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    semester = relationship("FirstYearSemester")
    department = relationship("Department")
    subject = relationship("FirstYearSubject")


class FirstYearLaboratory(Base):
    __tablename__ = "first_year_laboratories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    facilities_text = Column(Text, nullable=True)
    is_active = Column(Integer, nullable=False, default=1)
    programmes = relationship("FirstYearLabProgramme", back_populates="laboratory", cascade="all, delete-orphan")
    subjects = relationship("FirstYearLabSubject", back_populates="laboratory", cascade="all, delete-orphan")
    photos = relationship("FirstYearLabPhoto", back_populates="laboratory", cascade="all, delete-orphan")


class FirstYearLabProgramme(Base):
    __tablename__ = "first_year_lab_programmes"
    __table_args__ = (UniqueConstraint("laboratory_id", "department_id", name="uq_fy_lab_programme"),)
    id = Column(Integer, primary_key=True, index=True)
    laboratory_id = Column(Integer, ForeignKey("first_year_laboratories.id"), nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    laboratory = relationship("FirstYearLaboratory", back_populates="programmes")
    department = relationship("Department")


class FirstYearLabSubject(Base):
    __tablename__ = "first_year_lab_subjects"
    __table_args__ = (UniqueConstraint("laboratory_id", "subject_id", name="uq_fy_lab_subject"),)
    id = Column(Integer, primary_key=True, index=True)
    laboratory_id = Column(Integer, ForeignKey("first_year_laboratories.id"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("first_year_subjects.id"), nullable=False, index=True)
    laboratory = relationship("FirstYearLaboratory", back_populates="subjects")
    subject = relationship("FirstYearSubject")


class FirstYearLabPhoto(Base):
    __tablename__ = "first_year_lab_photos"
    id = Column(Integer, primary_key=True, index=True)
    laboratory_id = Column(Integer, ForeignKey("first_year_laboratories.id"), nullable=False, index=True)
    image_url = Column(String(255), nullable=False)
    caption = Column(String(200), nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    laboratory = relationship("FirstYearLaboratory", back_populates="photos")


