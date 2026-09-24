"""Seeds the 6 departments (matching js/data.js codes) and a few sample staff/events. Run: python seed.py"""
from database import SessionLocal, engine, Base, ensure_sqlite_columns
import models

Base.metadata.create_all(bind=engine)
ensure_sqlite_columns()
db = SessionLocal()

DEPARTMENTS = [
    ("EL", "Electronics Engineering"),
    ("CG", "Computer Science and Technology"),
    ("BM", "Bio-Medical Engineering"),
    ("CT", "Computer Engineering"),
    ("RPA", "Robotic Process Automation"),
    ("EEE", "Electrical & Electronics Engineering"),
]

if db.query(models.Department).count() == 0:
    print("Seeding departments...")
    for code, name in DEPARTMENTS:
        db.add(models.Department(code=code, name=name))
    db.commit()

# Keep the original Computer Hardware Engineering row (id, staff, images)
# and only change its code/name — never insert a second department.
legacy_cm = db.query(models.Department).filter(models.Department.code == "CM").first()
existing_cg = db.query(models.Department).filter(models.Department.code == "CG").first()
if legacy_cm and not existing_cg:
    print("Renaming department CM → CG (Computer Science and Technology) in place...")
    legacy_cm.code = "CG"
    legacy_cm.name = "Computer Science and Technology"
    db.commit()

depts = {d.code: d for d in db.query(models.Department).all()}

if db.query(models.Staff).count() == 0:
    print("Seeding sample staff/HOD...")
    db.add_all([
        models.Staff(department_id=depts["EL"].id, name="Er. Saji Varghese", role="HOD",
                     designation="HOD & Vice Principal", qualification="M.Tech Microelectronics (NIT Calicut)",
                     email="saji.v@ihrd.ac.in"),
        models.Staff(department_id=depts["CG"].id, name="Er. Anita Kumari", role="HOD",
                     designation="HOD & Associate Professor", qualification="M.Tech Computer Science (CUSAT)",
                     email="anita.k@ihrd.ac.in"),
        models.Staff(department_id=depts["BM"].id, name="Er. Ramesh K.", role="HOD",
                     designation="HOD & Senior Lecturer", qualification="M.Tech Biomedical Instrumentation (IIT Madras)",
                     email="ramesh.k@ihrd.ac.in"),
        models.Staff(department_id=depts["CT"].id, name="Er. Deepa Nair", role="HOD",
                     designation="HOD & Senior Lecturer", qualification="M.Tech Software Engineering (VTU)",
                     email="deepa.nair@ihrd.ac.in"),
        models.Staff(department_id=depts["RPA"].id, name="Er. Vinod Kumar", role="HOD",
                     designation="HOD & Assistant Professor", qualification="M.Tech Robotics (Amrita)",
                     email="vinod.kumar@ihrd.ac.in"),
        models.Staff(department_id=depts["EEE"].id, name="Er. Sunitha P.", role="HOD",
                     designation="HOD & Senior Lecturer", qualification="M.Tech Power Systems (GEC Thrissur)",
                     email="sunitha.p@ihrd.ac.in"),
    ])
    db.commit()

if db.query(models.Event).count() == 0:
    print("Seeding sample events...")
    db.add_all([
        models.Event(department_id=None, title="Onam Celebrations 2026",
                     description="College-wide Onam festivities with Pookalam competition and Sadya.",
                     event_date="2026-09-05"),
        models.Event(department_id=depts["RPA"].id, title="Robotics & Tech Fest",
                     description="Inter-department robotics showcase and hackathon.",
                     event_date="2026-03-12"),
    ])
    db.commit()

if db.query(models.GalleryPhoto).count() == 0:
    print("Seeding gallery photos...")
    # Same photos already verified working in the original static gallery —
    # carried over as starting content so the gallery isn't empty on first run.
    db.add_all([
        models.GalleryPhoto(category="campus", caption="College Main Block",
                             image_url="https://images.unsplash.com/photo-1752780433823-6b21209f46ec?auto=format&fit=crop&q=80&w=1600"),
        models.GalleryPhoto(category="events", caption="Robotics & Tech Fest Showcase",
                             image_url="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1600"),
        models.GalleryPhoto(category="campus", caption="College Entrance & Courtyard",
                             image_url="https://images.unsplash.com/photo-1752780433823-6b21209f46ec?auto=format&fit=crop&q=80&w=1600&flip=h"),
        models.GalleryPhoto(category="labs", caption="Engineering Laboratories Block",
                             image_url="https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1600"),
    ])
    db.commit()

DEPT_DETAILS = {
    "EL": {
        "description": "The Electronics Engineering program provides deep expertise in analog & digital circuits, microcontrollers (ARM, AVR, 8051), embedded C programming, VLSI design, PCB fabrication, and high-frequency communication systems.",
        "course_name": "Diploma in Electronics Engineering",
        "duration": "3 Years (6 Semesters)",
        "intake": 60,
        "email": "el.mptmala@ihrd.ac.in",
        "image_url": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800",
        "labs_text": "Analog & Digital Circuits Laboratory\nEmbedded Systems & Microcontroller Lab\nCommunication Systems & Microwave Engineering Lab\nIndustrial PCB Design & Hardware Fabrication Unit",
        "career_text": "Embedded Systems Developer\nPCB Design Engineer\nTelecom Technical Officer\nAutomation Technician",
        "eligibility": "SSLC / THSLC with Mathematics, Science and English. Lateral entry to S3 for Plus Two Science / VHSE / ITI.",
        "vision": "To be a centre of excellence in electronics education producing industry-ready diploma engineers.",
        "mission": "Provide hands-on training in embedded systems, communication and PCB fabrication with strong ethical values.",
    },
    "CG": {
        "description": "Computer Science and Technology focuses on programming, software development, computer systems, databases, networking, web technologies, and modern computing technologies.",
        "course_name": "Diploma in Computer Science and Technology",
        "duration": "3 Years (6 Semesters)", "intake": 60, "email": "cm.mptmala@ihrd.ac.in",
        "image_url": "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&q=80&w=800",
        "labs_text": "Programming & Software Development Lab\nDatabase Systems Lab\nComputer Networking Lab\nWeb Technologies Lab",
        "career_text": "Junior Software Developer\nWeb Application Developer\nDatabase Support Engineer\nNetwork Support Technician",
        "eligibility": "SSLC / THSLC with Mathematics, Science and English. Lateral entry available.",
        "vision": "Produce diploma graduates skilled in programming, software systems and modern computing technologies.",
        "mission": "Deliver practical training in programming, databases, networking and web technologies through labs and projects.",
    },
    "BM": {
        "description": "Unique program focusing on medical electronic equipment, hospital diagnostic devices, ECG/EEG systems, ICU ventilators, dialysis units, medical imaging, and clinical safety standards.",
        "course_name": "Diploma in Bio-Medical Engineering",
        "duration": "3 Years (6 Semesters)", "intake": 60, "email": "bm.mptmala@ihrd.ac.in",
        "image_url": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800",
        "labs_text": "Biomedical Instrumentation Lab\nClinical Equipment Calibration Unit\nMedical Signal Processing Lab",
        "career_text": "Biomedical Service Engineer\nMedical Device Testing Specialist\nClinical Application Specialist",
        "eligibility": "SSLC / THSLC with Mathematics, Science and English. Lateral entry available.",
        "vision": "Support Kerala’s healthcare sector with competent biomedical diploma engineers.",
        "mission": "Deliver practical training on hospital equipment, safety standards and diagnostic systems.",
    },
    "CT": {
        "description": "Focuses on computer programming, software development, web development, mobile apps, Python/Java, database administration, and AI basics.",
        "course_name": "Diploma in Computer Engineering",
        "duration": "3 Years (6 Semesters)", "intake": 60, "email": "ct.mptmala@ihrd.ac.in",
        "image_url": "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&q=80&w=800",
        "labs_text": "Software Development Lab\nWeb Design & Full Stack Lab\nDatabase Systems Lab",
        "career_text": "Junior Software Developer\nWeb Application Developer\nQA Software Tester",
        "eligibility": "SSLC / THSLC with Mathematics, Science and English. Lateral entry available.",
        "vision": "Produce job-ready software diploma graduates with strong programming fundamentals.",
        "mission": "Teach modern software stacks through projects, internships and Industry on Campus work.",
    },
    "RPA": {
        "description": "Combines industrial robotics, sensor integration, PLC, mechatronics, SCADA systems, and UiPath RPA workflow creation.",
        "course_name": "Diploma in Robotic Process Automation",
        "duration": "3 Years (6 Semesters)", "intake": 60, "email": "rpa.mptmala@ihrd.ac.in",
        "image_url": "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800",
        "labs_text": "Industrial Robotics Lab\nPLC & SCADA Workstation\nSensor & Pneumatics Lab\nUiPath RPA Lab",
        "career_text": "Robotics Maintenance Technician\nPLC Programmer\nUiPath RPA Developer",
        "eligibility": "SSLC / THSLC with Mathematics, Science and English. Lateral entry available.",
        "vision": "Lead diploma-level robotics and automation education in the region.",
        "mission": "Give students live industrial automation experience through labs and internships.",
    },
    "EEE": {
        "description": "Study of electrical power, machines, power electronics, solar PV installations, and industrial motor drives.",
        "course_name": "Diploma in Electrical & Electronics Engineering",
        "duration": "3 Years (6 Semesters)", "intake": 60, "email": "eee.mptmala@ihrd.ac.in",
        "image_url": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800",
        "labs_text": "Electrical Machines Laboratory\nPower Electronics & Drives Lab\nElectrical Wiring Workshop\nSolar Testing Bench",
        "career_text": "Electrical Supervisor\nPower Plant Technical Assistant\nSolar System Installer",
        "eligibility": "SSLC / THSLC with Mathematics, Science and English. Lateral entry available.",
        "vision": "Train electrical diploma engineers for power utilities, industry and renewable energy.",
        "mission": "Blend theory with workshop practice in machines, wiring, drives and solar systems.",
    },
}

print("Updating department CMS fields (only filling empty values)...")
for code, details in DEPT_DETAILS.items():
    d = depts.get(code)
    if not d:
        continue
    for key, val in details.items():
        if getattr(d, key, None) in (None, ""):
            setattr(d, key, val)
    if not d.phone:
        d.phone = "0480-2720746"
    d.is_active = 1 if d.is_active is None else d.is_active
db.commit()

def _legacy_hardware_content(dept):
    blob = " ".join(
        filter(
            None,
            [
                dept.name,
                dept.description,
                dept.course_name,
                dept.labs_text,
                dept.career_text,
                dept.vision,
                dept.mission,
            ],
        )
    ).lower()
    return any(
        marker in blob
        for marker in (
            "computer hardware",
            "chip-level",
            "motherboard",
            "pc hardware architecture",
            "hardware assembling",
        )
    )

cg = depts.get("CG")
if cg:
    details = DEPT_DETAILS["CG"]
    cg.name = "Computer Science and Technology"
    cg.code = "CG"
    if cg.intake in (None, 0):
        cg.intake = 60
    if _legacy_hardware_content(cg):
        print("Updating Computer Science and Technology syllabus text…")
        for key in (
            "description",
            "course_name",
            "labs_text",
            "career_text",
            "vision",
            "mission",
            "duration",
            "eligibility",
        ):
            setattr(cg, key, details[key])
        cg.intake = 60
    db.commit()

for app in db.query(models.Application).all():
    dept_name = (app.dept or "").strip()
    if dept_name in ("Computer Hardware Engineering", "CM") or "hardware engineering" in dept_name.lower():
        app.dept = "Computer Science and Technology"
db.commit()

if db.query(models.CollegeInfo).count() == 0:
    print("Seeding college information...")
    db.add(models.CollegeInfo(
        name="K. Karunakaran Memorial Model Polytechnic College, Kallettumkara",
        short_name="KKMMPTC Kallettumkara",
        address="Kallettumkara P.O., Thrissur District, Kerala - 680 683, India.",
        phone="0480-2720746",
        mobile="8547005080",
        email="mptmala@ihrd.ac.in",
        website="http://mptmala.ihrd.ac.in",
        youtube_url="https://www.youtube.com/@kkmmptconline7935",
        office_hours="Monday–Saturday, 10:00 AM – 5:00 PM",
        established="1993",
        governing_body="Institute of Human Resources Development (IHRD), Govt. of Kerala",
        approval="AICTE New Delhi Approved & Affiliated to Board of Technical Education Kerala (SBTE)",
    ))
    db.commit()

print("\nSeed complete. Register the first admin at /admin-register (one-time). Then sign in at /admin-login with the administrator password.")
db.close()
