# KKMMPTC Website + Department Admin Console

This adds a real backend (Python/FastAPI + SQLite) on top of your existing
static site. It now covers **the entire admin side of the site**: the
original `admin.html` (notices + admission applications) is password
protected and database-backed, alongside `department-admin.html` (staff,
HOD, events, Principal's Message, and grievances). Both pages share the
same login — signing into either one signs you into both.

## Bugs found and fixed in this pass

A full audit of the Notice Board, Events Board, and event image uploads
turned up three real problems, now fixed:

1. **Notice Board silently never rendered.** The display function existed
   in `js/main.js` but nothing on the page ever called it — a mistake
   introduced when the Principal's Message feature was added earlier,
   which replaced that call instead of adding alongside it. The Notice
   Board on the home page now populates correctly again.
2. **There was no Events Board on the home page at all.** Events only ever
   showed up buried inside each department's page on `departments.html`.
   Added a new Events Board section to `index.html` (right next to the
   Notice Board), showing every event across the whole college.
3. **College-wide events (not tied to a department) were invisible
   everywhere, and couldn't even be created.** The database always
   supported them — the seeded "Onam Celebrations" event is one — but no
   page fetched them, and the admin console's event form silently forced
   whatever department you had selected onto every event, with no way to
   opt out. Added a "Make this a college-wide event" checkbox to the admin
   form, and the new Events Board shows both college-wide and
   department-specific events together.
4. **Browser caching could hide every fix above.** The server sent no
   cache-control headers on any frontend file, so a browser could keep
   serving a stale, pre-fix copy of `main.js` or `departments.html`
   indefinitely. Added middleware that forces `no-cache` on every
   HTML/CSS/JS response (API and uploaded-image responses are left
   cacheable, since those don't have this problem). If you ever see an old
   version of a page after a fix ships, a normal refresh will now be
   enough — no more hard-refresh guessing.
5. **The Campus Photo Gallery (the "All / Labs / Events / Campus" grid on
   the home page) was 4 images hardcoded directly into `index.html`, with
   no admin control of any kind** — left over from the original static
   site. Built it out properly: a new database table, upload/delete API,
   an upload section in the Department Admin console (college-wide, next
   to Principal's Message), and `index.html` now renders the gallery live
   — the existing filter buttons keep working unchanged.

Event image uploads themselves were verified working correctly throughout
this investigation (tested directly against the API with and without
optional fields, department-scoped and college-wide) — the actual gap was
that created events had nowhere to display, not that uploads were failing.

## What's new

- `backend/` — a FastAPI server with a SQLite database, image upload
  handling, and a single-password admin login used across the WHOLE admin
  side of the site
- `frontend/js/admin-auth.js` — shared login/session logic used by both
  `admin.html` and `department-admin.html` (one password, one session)
- `frontend/admin.html` — **now requires the admin password to access at
  all** (previously wide open to anyone who knew the URL). Notices and
  admission applications are now stored in the real database instead of
  `localStorage`, so every visitor sees the same notices, and applications
  submitted by anyone show up for admins immediately
- `frontend/department-admin.html` + `frontend/js/dept-admin.js` — the
  console where a department admin manages the college-wide
  **Principal's Message**, **Grievances**, and per-department HOD details,
  faculty/staff, and events (each with a photo/image)
- `frontend/grievance.html` + `frontend/js/grievance.js` — **public**
  grievance submission form (no login needed to submit — only to view/manage)
- `frontend/departments.html` — pulls live HOD/staff/event data from the
  backend, shown alongside the existing static curriculum info
- `frontend/index.html` — Principal's Message and Notice Board both load
  live from the backend instead of static/localStorage content

## Step-by-step: running it locally

**1. Install Python dependencies** (one-time):
```bash
cd backend
pip install -r requirements.txt
```

**2. Seed the database** (one-time — creates the 6 departments and a sample
HOD for each, so the site isn't empty on first run):
```bash
python seed.py
```
This prints the admin password to use in step 4.

**3. Start the server:**
```bash
uvicorn main:app --reload
```
Leave this running. It serves both the API and the whole website.

**4. Open the site:**
- Public site: **http://localhost:8000**
- Department Admin console: **http://localhost:8000/department-admin.html**
  - Password: `kkmmptc-admin-2026` (or whatever you set via the
    `ADMIN_PASSWORD` environment variable — see below)
- Notices &amp; Admissions admin: **http://localhost:8000/admin.html**
  (same password as above — see note below)
- Public grievance form: **http://localhost:8000/grievance.html**

## Step-by-step: using Notices &amp; Admissions (admin.html)

This page now requires login — same password as `department-admin.html`,
and the two share a session (log into one, you're logged into both, no
need to re-enter the password on the other).

1. Go to `/admin.html` and sign in.
2. **Publish New Notice** — fill in title, category, and details, then
   "Broadcast Live Notice". It's immediately visible to every visitor on
   the home page's Notice Board — no longer limited to your own browser.
3. **Live Pre-Admission Applicant Queue** — every submission from the
   public pre-registration form on `admissions.html` appears here in real
   time for any admin, not just the browser that received it. Verify or
   delete records as needed.

## Step-by-step: using the Department Admin console

1. Go to `/department-admin.html` and enter the admin password.
2. **Principal's Message** (top of the page, always visible after login —
   this is college-wide, not tied to any department): fill in name,
   designation, quote, full message (separate paragraphs with a blank
   line), contact details, and optionally a photo, then save. It's live on
   the public home page immediately.
3. Pick a department from the dropdown — this decides which department
   you're editing (per your earlier instruction: one shared password, but
   you must select a department before you can edit anything).
4. **HOD Details** — expand "Set / replace HOD", fill in name, qualification,
   email, and optionally a photo, then save. If a department already has an
   HOD, the previous person is automatically moved into the Faculty list
   below (a department only ever shows one HOD at a time).
5. **Faculty & Staff** — expand "+ Add faculty / staff member" to add
   someone, or click the trash icon on any existing card to remove them.
6. **Department Events** — expand "+ Add event" to publish an event with a
   title, date, description, and image; trash icon to remove. Check "Make
   this a college-wide event" if it's not specific to the department
   you're currently managing (e.g. Onam celebrations, a hackathon open to
   everyone) — it'll still show up here in the department form but won't
   appear in the department-filtered list below, since it isn't tied to
   one; it shows on the home page's Events Board instead.
7. Everything you save here appears immediately on the public site: the
   Principal's Message and Events Board on the home page, and
   HOD/Staff/Events under each department's section on `departments.html`.

## Step-by-step: Campus Photo Gallery

1. In `/department-admin.html`, the "Campus Photo Gallery" section (below
   Principal's Message, college-wide — same as that) shows every photo
   currently on the public gallery grid, with a trash icon on hover to
   remove one.
2. Expand "+ Add photo", pick a category (Campus / Labs / Events — matches
   the filter buttons on the public gallery), optionally add a caption,
   choose an image file, and upload.
3. It appears immediately in the admin grid and on the public home page's
   Campus Photo Gallery, filterable by the existing All/Labs/Events/Campus
   buttons.

## Step-by-step: Grievance Redressal

This works differently from the other features — **submission is public**
(anyone can file one, no login), but **viewing and managing submissions is
admin-only**, since grievances can involve sensitive matters.

- **Public**: anyone visits `/grievance.html`, fills in a category, subject,
  and description (name/contact optional if they check "submit
  anonymously"), and gets a reference ID (e.g. `GRV-00007`) back.
- **Admin**: in the Department Admin console (`/department-admin.html`),
  the "Grievances" section (college-wide, right below Principal's Message)
  lists every submission. Click one to expand it, see the full details,
  change its status (Open / In Progress / Resolved / Closed), and add an
  internal response note, then Save. A trash icon deletes a record.
- Ragging/harassment complaints show a note pointing to India's National
  Anti-Ragging Helpline (1800-180-5522, 24×7) on the public form, since
  that channel is independent of the college and shouldn't be the only
  place a serious complaint is filed.

## Changing the admin password

Don't ship the default password. Set your own before deploying:
```bash
export ADMIN_PASSWORD="your-real-password-here"
uvicorn main:app --reload
```
(On Windows: `set ADMIN_PASSWORD=your-real-password-here` before running
`uvicorn`.)

## Project structure

```
backend/
  main.py            FastAPI app — serves the API and the frontend folder
  database.py         SQLite connection setup
  models.py            Department / Staff / Event / Principal / Grievance /
                        Notice / Application tables
  schemas.py            Request/response shapes
  auth.py                Single-password login + JWT check
  seed.py                 One-time setup script (6 departments + sample data)
  requirements.txt
  routers/
    admin_auth.py      POST /api/admin/login
    departments.py      GET /api/departments
    staff.py              GET/POST/PATCH/DELETE /api/staff (photo upload)
    events.py              GET/POST/DELETE /api/events (image upload)
    principal.py            GET/POST /api/principal (college-wide, photo upload)
    grievances.py            POST public; GET/PATCH/DELETE admin-only
    notices.py                 GET public; POST/DELETE admin-only
    applications.py              POST public; GET/PATCH/DELETE admin-only
  uploads/               Staff/principal photos & event images land here
  kkmmptc.db             SQLite database file (created on first run/seed)

frontend/                Your original static site, plus:
  department-admin.html  Console for Principal/Grievances/Staff/HOD/Events
  admin.html              Console for Notices/Applications — now login-gated
  grievance.html           Public grievance submission form
  js/admin-auth.js          Shared login/session logic (both admin pages)
  js/dept-admin.js          Logic for department-admin.html
  js/admin.js                Logic for admin.html
  js/grievance.js             Logic for grievance.html
  js/main.js                   Notice Board, Events Board, Principal's
                                Message, and the department-info popup —
                                all pull live data from the backend
  departments.html              Shows live staff/HOD/events per department
  index.html                     Notice Board + Events Board + Principal's
                                  Message all load live on page load
```

## Important notes

- **Every admin surface is now server-side, shared, and password-protected**
  — Principal's Message, staff/HOD, events, grievances, notices, and
  admission applications are all in the real database behind the same
  login. Nothing admin-related is stored in `localStorage` anymore.
- **One shared password protects everything admin-related** — there's no
  separation between, say, someone who should only publish notices and
  someone who should see grievance details. If this college needs stricter
  role separation (e.g. only the Grievance Cell chair sees complaint
  details, not every admin), that needs proper per-user accounts with
  roles — happy to build that if it becomes a real requirement.
- **The admin login isn't scoped by department on the server** — it's one
  shared password by design (per your instruction). The department picker
  is a UI workflow gate, not a security boundary: anyone who knows the
  password can edit any department. If you later want each department to
  only be editable by its own staff, that needs per-department accounts —
  happy to add that if it becomes a real requirement.
- **Photo/image uploads** are capped at 4MB (staff photos) and 6MB (event
  images), and only accept JPG/PNG/WEBP.
- **Deploying somewhere other than your own machine** (a real server) needs
  a bit more than `uvicorn --reload` (a process manager, HTTPS, etc.) — let
  me know if/when you're ready for that and I'll walk through it.
