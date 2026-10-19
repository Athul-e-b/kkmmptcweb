from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_validator, field_serializer


class LoginRequest(BaseModel):
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DepartmentOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    vision: Optional[str] = None
    mission: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    image_url: Optional[str] = None
    course_name: Optional[str] = None
    duration: Optional[str] = None
    intake: Optional[int] = None
    eligibility: Optional[str] = None
    other_details: Optional[str] = None
    labs_text: Optional[str] = None
    career_text: Optional[str] = None
    is_active: Optional[int] = 1
    sort_order: Optional[int] = 0
    hod: Optional["StaffOut"] = None

    class Config:
        from_attributes = True


class DepartmentCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    vision: Optional[str] = None
    mission: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    course_name: Optional[str] = None
    duration: Optional[str] = None
    intake: Optional[int] = None
    eligibility: Optional[str] = None
    other_details: Optional[str] = None
    labs_text: Optional[str] = None
    career_text: Optional[str] = None
    is_active: int = 1
    sort_order: int = 0


class StaffOut(BaseModel):
    id: int
    department_id: int
    name: str
    role: str
    designation: Optional[str] = None
    qualification: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: Optional[int] = 1
    is_in_charge: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

    @field_validator("is_in_charge", mode="before")
    @classmethod
    def coerce_is_in_charge(cls, v):
        if v in (None, ""):
            return False
        if isinstance(v, str):
            return v.strip().lower() in ("1", "true", "yes", "on")
        return bool(v)


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    designation: Optional[str] = None
    qualification: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
    is_active: Optional[int] = None
    is_in_charge: Optional[bool] = None


class EventOut(BaseModel):
    id: int
    department_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    event_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    venue: Optional[str] = None
    organizer: Optional[str] = None
    category: Optional[str] = None
    registration_link: Optional[str] = None
    status: Optional[str] = "published"
    image_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PrincipalOut(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    qualification: Optional[str] = None
    quote: Optional[str] = None
    message: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    photo_url: Optional[str] = None

    class Config:
        from_attributes = True


class CollegeInfoOut(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    maps_url: Optional[str] = None
    youtube_url: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    office_hours: Optional[str] = None
    established: Optional[str] = None
    governing_body: Optional[str] = None
    approval: Optional[str] = None

    class Config:
        from_attributes = True


class CollegeInfoUpdate(BaseModel):
    name: Optional[str] = None
    short_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    maps_url: Optional[str] = None
    youtube_url: Optional[str] = None
    facebook_url: Optional[str] = None
    instagram_url: Optional[str] = None
    office_hours: Optional[str] = None
    established: Optional[str] = None
    governing_body: Optional[str] = None
    approval: Optional[str] = None


class DashboardStats(BaseModel):
    departments: int
    faculty: int
    events: int
    gallery: int
    notices: int
    grievances: int
    applications: int


class GrievanceCreate(BaseModel):
    is_anonymous: bool = False
    name: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = None
    phone: Optional[str] = None
    category: Optional[str] = None
    department_id: int
    course: str = Field(..., min_length=1, max_length=120)
    year_semester: str = Field(..., min_length=1, max_length=80)
    subject: Optional[str] = Field(default=None, max_length=200)
    description: str = Field(..., min_length=1, max_length=3000)

    @field_validator("name", "subject", "email", "phone", mode="before")
    @classmethod
    def strip_optional(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator("course", "year_semester", "description", mode="before")
    @classmethod
    def strip_required(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v


class GrievanceOut(BaseModel):
    id: int
    is_anonymous: int
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    category: str
    department_id: Optional[int] = None
    course: Optional[str] = None
    year_semester: Optional[str] = None
    subject: str
    description: str
    status: str
    admin_response: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    department: Optional[DepartmentOut] = None

    class Config:
        from_attributes = True

    @field_serializer("created_at", "updated_at")
    def serialize_grievance_datetimes(self, value: datetime):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()


class GrievanceUpdate(BaseModel):
    status: Optional[str] = None
    admin_response: Optional[str] = None


class GrievanceSubmitted(BaseModel):
    """Returned to the public submitter — deliberately excludes admin_response and other internal fields."""
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

    @field_serializer("created_at")
    def serialize_submitted_at(self, value: datetime):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()


class GrievanceStats(BaseModel):
    model_config = {"populate_by_name": True, "ser_json_by_alias": True}
    all: int = 0
    Open: int = 0
    Resolved: int = 0
    Closed: int = 0
    in_progress: int = Field(0, alias="In Progress")


class NoticeCreate(BaseModel):
    title: str
    category: str = "Admissions"
    description: Optional[str] = None
    link_url: Optional[str] = None
    is_published: int = 1
    is_important: int = 0


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    link_url: Optional[str] = None
    is_published: Optional[int] = None
    is_important: Optional[int] = None


class NoticeOut(BaseModel):
    id: int
    title: str
    category: str
    description: Optional[str] = None
    link_url: Optional[str] = None
    document_url: Optional[str] = None
    is_published: Optional[int] = 1
    is_important: Optional[int] = 0
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    dept: str
    qual: Optional[str] = None
    marks: Optional[str] = None


class ApplicationOut(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    dept: str
    qual: Optional[str] = None
    marks: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationStatusUpdate(BaseModel):
    status: str


class GalleryPhotoOut(BaseModel):
    id: int
    category: str
    title: Optional[str] = None
    caption: Optional[str] = None
    description: Optional[str] = None
    media_type: Optional[str] = "image"
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    department_id: Optional[int] = None
    featured: Optional[int] = 0
    display_order: Optional[int] = 0
    media_date: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminRegisterStart(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., max_length=160)
    phone: str = Field(..., max_length=20)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("name", "email", "phone", "password", "confirm_password", mode="before")
    @classmethod
    def strip_reg(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v


class AdminOtpVerify(BaseModel):
    otp: str = Field(..., min_length=4, max_length=8)

    @field_validator("otp", mode="before")
    @classmethod
    def strip_otp(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v


def _clean_optional_text(value):
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    text = value.strip()
    return text or None


def _reject_markup(value: str, label: str) -> str:
    if "<" in value or ">" in value:
        raise ValueError(f"{label} cannot contain HTML")
    return value


def _clean_http_url(value):
    text = _clean_optional_text(value)
    if text is None:
        return None
    from urllib.parse import urlparse
    parsed = urlparse(text)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Link must be an http or https URL")
    if any(ch in text for ch in ("<", ">", '"', "'", " ")):
        raise ValueError("Link must be an http or https URL")
    return text


class ScrollingNotificationCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=400)
    is_active: int = 1
    display_order: Optional[int] = Field(default=None, ge=0, le=9999)
    link_url: Optional[str] = Field(default=None, max_length=400)
    link_label: Optional[str] = Field(default=None, max_length=80)

    @field_validator("message", mode="before")
    @classmethod
    def clean_message(cls, v):
        text = _clean_optional_text(v) if isinstance(v, str) else v
        if not text:
            raise ValueError("Message is required")
        return _reject_markup(str(text), "Message")

    @field_validator("link_label", mode="before")
    @classmethod
    def clean_label(cls, v):
        text = _clean_optional_text(v)
        if text is None:
            return None
        return _reject_markup(text, "Link label")

    @field_validator("link_url", mode="before")
    @classmethod
    def clean_url(cls, v):
        return _clean_http_url(v)

    @field_validator("is_active", mode="before")
    @classmethod
    def clean_active(cls, v):
        if isinstance(v, bool):
            return 1 if v else 0
        if v in (None, ""):
            return 1
        return 1 if int(v) else 0


class ScrollingNotificationUpdate(BaseModel):
    message: Optional[str] = Field(default=None, min_length=1, max_length=400)
    is_active: Optional[int] = None
    display_order: Optional[int] = Field(default=None, ge=0, le=9999)
    link_url: Optional[str] = Field(default=None, max_length=400)
    link_label: Optional[str] = Field(default=None, max_length=80)

    @field_validator("message", mode="before")
    @classmethod
    def clean_message(cls, v):
        if v is None:
            return None
        text = _clean_optional_text(v) if isinstance(v, str) else v
        if not text:
            raise ValueError("Message is required")
        return _reject_markup(str(text), "Message")

    @field_validator("link_label", mode="before")
    @classmethod
    def clean_label(cls, v):
        if v is None:
            return None
        text = _clean_optional_text(v)
        if text is None:
            return None
        return _reject_markup(text, "Link label")

    @field_validator("link_url", mode="before")
    @classmethod
    def clean_url(cls, v):
        if v is None:
            return None
        return _clean_http_url(v)

    @field_validator("is_active", mode="before")
    @classmethod
    def clean_active(cls, v):
        if v is None:
            return None
        if isinstance(v, bool):
            return 1 if v else 0
        return 1 if int(v) else 0


class ScrollingNotificationPublic(BaseModel):
    id: int
    message: str
    link_url: Optional[str] = None
    link_label: Optional[str] = None
    display_order: int = 0

    class Config:
        from_attributes = True


class ScrollingNotificationOut(ScrollingNotificationPublic):
    is_active: int = 1
    created_at: datetime
    updated_at: Optional[datetime] = None


class DepartmentLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=32)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def clean_login_username(cls, v):
        return (v or "").strip() if isinstance(v, str) else v


class DepartmentMe(BaseModel):
    id: int
    username: str
    department_id: int
    department_name: str
    department_code: str


class DepartmentUserOut(BaseModel):
    id: int
    username: str
    department_id: int
    department_name: str
    department_code: str
    is_active: int
    created_at: datetime
    updated_at: Optional[datetime] = None


class DepartmentUserCreate(BaseModel):
    department_id: int
    username: str = Field(..., min_length=1, max_length=32)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("username", "password", "confirm_password", mode="before")
    @classmethod
    def strip_create(cls, v):
        return v.strip() if isinstance(v, str) else v


class DepartmentUsernameUpdate(BaseModel):
    username: str = Field(..., min_length=1, max_length=32)

    @field_validator("username", mode="before")
    @classmethod
    def strip_username(cls, v):
        return v.strip() if isinstance(v, str) else v


class DepartmentPasswordReset(BaseModel):
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password", "confirm_password", mode="before")
    @classmethod
    def strip_reset(cls, v):
        return v.strip() if isinstance(v, str) else v


class DepartmentStatusUpdate(BaseModel):
    is_active: int

    @field_validator("is_active", mode="before")
    @classmethod
    def clean_status(cls, v):
        if isinstance(v, bool):
            return 1 if v else 0
        return 1 if int(v) else 0


DepartmentOut.model_rebuild()


class CampusImageOut(BaseModel):
    id: int
    image_url: str
    caption: Optional[str] = None
    alt_text: Optional[str] = None
    display_order: int = 0
    is_published: int = 1
    event_title: Optional[str] = None

    class Config:
        from_attributes = True


class IICPageOut(BaseModel):
    id: int
    hero_title: str
    hero_intro: Optional[str] = None
    hero_image_url: Optional[str] = None
    about: Optional[str] = None
    vision: Optional[str] = None
    mission: Optional[str] = None
    objectives: Optional[str] = None
    participation: Optional[str] = None
    workshops_note: Optional[str] = None

    class Config:
        from_attributes = True


class IICActivityOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    event_date: Optional[str] = None
    venue: Optional[str] = None
    category: Optional[str] = None
    external_url: Optional[str] = None
    display_order: int = 0
    is_published: int = 0
    photos: list[CampusImageOut] = []

    class Config:
        from_attributes = True


class ClubActivityOut(BaseModel):
    id: int
    club_id: int
    title: str
    description: Optional[str] = None
    event_date: Optional[str] = None
    venue: Optional[str] = None
    display_order: int = 0
    is_published: int = 0

    class Config:
        from_attributes = True


class ClubOut(BaseModel):
    id: int
    slug: str
    name: str
    intro: Optional[str] = None
    description: Optional[str] = None
    display_order: int = 0
    is_published: int = 1
    activities: list[ClubActivityOut] = []
    images: list[CampusImageOut] = []

    class Config:
        from_attributes = True
