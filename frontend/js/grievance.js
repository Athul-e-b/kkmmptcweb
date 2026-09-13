/**
 * KKMMPTC Kallettumkara - Public Grievance Submission
 * Submits to the backend (POST /api/grievances, no login required).
 * Viewing/managing submitted grievances is admin-only — see dept-admin.js.
 */

const MAX_DESCRIPTION_LENGTH = 3000;
const FIELD_IDS = ['gName', 'gCourse', 'gDepartment', 'gYearSemester', 'gDescription'];

let isSubmittingGrievance = false;

function setFieldInvalid(id, invalid) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('border-secondary', invalid);
    el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
}

function clearFieldErrors() {
    FIELD_IDS.forEach((id) => setFieldInvalid(id, false));
}

function showGrievanceError(message) {
    const errorBox = document.getElementById('gError');
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
}

function hideGrievanceError() {
    const errorBox = document.getElementById('gError');
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
}

function setSubmitLoading(loading) {
    const btn = document.getElementById('gSubmitBtn');
    btn.disabled = loading;
    btn.textContent = loading ? 'Submitting...' : 'Submit Grievance';
}

document.addEventListener('DOMContentLoaded', async () => {
    const courseSelect = document.getElementById('gCourse');
    const deptSelect = document.getElementById('gDepartment');
    try {
        const apiDepts = await fetch('/api/departments').then((r) => r.ok ? r.json() : []);
        if (courseSelect) {
            apiDepts.forEach((d) => {
                const opt = document.createElement('option');
                opt.value = d.name;
                opt.textContent = d.name;
                courseSelect.appendChild(opt);
            });
        }
        if (deptSelect) {
            apiDepts.forEach((d) => {
                const opt = document.createElement('option');
                opt.value = String(d.id);
                opt.textContent = `${d.name} (${d.code})`;
                deptSelect.appendChild(opt);
            });
        }
        if (deptSelect && deptSelect.options.length <= 1) {
            showGrievanceError('Unable to load departments. Please refresh the page and try again.');
        }
    } catch (e) {
        showGrievanceError('Unable to load departments. Please refresh the page and try again.');
    }
    document.getElementById('grievanceForm').addEventListener('submit', handleGrievanceSubmit);
});

function validateGrievanceForm() {
    clearFieldErrors();
    hideGrievanceError();

    const name = document.getElementById('gName').value.trim();
    const course = document.getElementById('gCourse').value.trim();
    const departmentId = document.getElementById('gDepartment').value.trim();
    const yearSemester = document.getElementById('gYearSemester').value.trim();
    const description = document.getElementById('gDescription').value.trim();

    if (!course) {
        setFieldInvalid('gCourse', true);
        showGrievanceError('Please select your course / programme.');
        document.getElementById('gCourse').focus();
        return null;
    }
    if (!departmentId) {
        setFieldInvalid('gDepartment', true);
        showGrievanceError('Please select your department.');
        document.getElementById('gDepartment').focus();
        return null;
    }
    if (!yearSemester) {
        setFieldInvalid('gYearSemester', true);
        showGrievanceError('Please select your year / semester.');
        document.getElementById('gYearSemester').focus();
        return null;
    }
    if (!description) {
        setFieldInvalid('gDescription', true);
        showGrievanceError('Please describe your grievance or suggestion.');
        document.getElementById('gDescription').focus();
        return null;
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
        setFieldInvalid('gDescription', true);
        showGrievanceError(`Please keep your description within ${MAX_DESCRIPTION_LENGTH} characters.`);
        document.getElementById('gDescription').focus();
        return null;
    }

    return {
        name: name || null,
        is_anonymous: !name,
        course,
        department_id: Number(departmentId),
        year_semester: yearSemester,
        description,
    };
}

async function handleGrievanceSubmit(e) {
    e.preventDefault();
    if (isSubmittingGrievance) return;

    const payload = validateGrievanceForm();
    if (!payload) return;

    isSubmittingGrievance = true;
    setSubmitLoading(true);

    try {
        const res = await fetch('/api/grievances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        let data = null;
        try {
            data = await res.json();
        } catch (parseErr) {
            data = null;
        }

        if (!res.ok) {
            showGrievanceError('Unable to submit your grievance. Please try again.');
            return;
        }

        document.getElementById('grievanceForm').classList.add('hidden');
        document.getElementById('gSuccess').classList.remove('hidden');
        document.getElementById('gRefId').textContent = `GRV-${String(data.id).padStart(5, '0')}`;
        const submittedEl = document.getElementById('gSubmittedAt');
        if (submittedEl) submittedEl.textContent = formatGrievanceSubmittedAt(data.created_at);
        hideGrievanceError();
    } catch (err) {
        showGrievanceError('Unable to connect to the grievance service. Please try again later.');
    } finally {
        isSubmittingGrievance = false;
        setSubmitLoading(false);
    }
}

function resetGrievanceForm() {
    const form = document.getElementById('grievanceForm');
    form.reset();
    clearFieldErrors();
    hideGrievanceError();
    form.classList.remove('hidden');
    document.getElementById('gSuccess').classList.add('hidden');
    const submittedEl = document.getElementById('gSubmittedAt');
    if (submittedEl) submittedEl.textContent = '';
    setSubmitLoading(false);
    isSubmittingGrievance = false;
}

function formatGrievanceSubmittedAt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const date = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
    }).format(d);
    const time = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
    }).format(d);
    return `${date}, ${time}`;
}
