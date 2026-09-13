/**
 * KKMMPTC Kallettumkara - Department Admin Console
 * Talks to the FastAPI backend (main.py) for staff/HOD/events + image
 * uploads, plus the college-wide Principal's Message and Grievances.
 * Login/session handling (getAdminToken, apiCall, adminLogin/Logout) lives
 * in js/admin-auth.js, shared with admin.html.
 */

let currentDepartments = [];
let currentDeptId = null;
let currentDeptCode = null;

document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'deptGalleryType') {
        const video = e.target.value === 'video';
        const imgWrap = document.getElementById('deptGalleryImageWrap');
        const vidWrap = document.getElementById('deptGalleryVideoWrap');
        if (imgWrap) imgWrap.classList.toggle('hidden', video);
        if (vidWrap) vidWrap.classList.toggle('hidden', !video);
    }
});

async function onAdminWorkspaceReady() {
    await loadDepartmentOptions();
    await loadPrincipalIntoForm();
    await loadGallery();
    await loadGrievances();
}

// ---------- Principal's Message (college-wide) ----------
async function loadPrincipalIntoForm() {
    try {
        const res = await fetch('/api/principal');
        if (!res.ok) return;
        const p = await res.json();
        document.getElementById('principalNameInput').value = p.name || '';
        document.getElementById('principalDesignationInput').value = p.designation || '';
        document.getElementById('principalEmailInput').value = p.email || '';
        document.getElementById('principalPhoneInput').value = p.phone || '';
        document.getElementById('principalQuoteInput').value = p.quote || '';
        document.getElementById('principalMessageInput').value = p.message || '';
    } catch (err) {
        console.error('Could not load principal data', err);
    }
}

document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'principalForm') {
        e.preventDefault();
        const fd = new FormData(e.target);
        const msgBox = document.getElementById('principalSaveMsg');
        msgBox.classList.remove('hidden');
        msgBox.textContent = 'Saving…';
        msgBox.className = 'sm:col-span-2 text-xs text-slate-500';
        try {
            await apiCall('/api/principal', { method: 'POST', body: fd });
            msgBox.textContent = 'Saved — now live on the public home page.';
            msgBox.className = 'sm:col-span-2 text-xs text-emerald-600 font-semibold';
        } catch (err) {
            msgBox.textContent = err.message;
            msgBox.className = 'sm:col-span-2 text-xs text-secondary font-semibold';
        }
    }
    if (e.target && e.target.id === 'galleryForm') {
        e.preventDefault();
        const fd = new FormData(e.target);
        const kind = fd.get('media_type') || 'image';
        if (kind === 'image') fd.delete('video');
        if (kind === 'video') fd.delete('image');
        try {
            await apiCall('/api/gallery', { method: 'POST', body: fd });
            e.target.reset();
            await loadGallery();
            alert('✓ Gallery item uploaded successfully');
        } catch (err) {
            alert(`✕ ${kind === 'video' ? 'Video' : 'Image'} upload failed. ${err.message}`);
        }
    }
});

// ---------- Campus Photo Gallery (college-wide) ----------
async function loadGallery() {
    const grid = document.getElementById('galleryAdminGrid');
    if (!grid) return;
    try {
        const photos = await apiCall('/api/gallery');
        grid.innerHTML = photos.map(p => `
            <div class="relative rounded-lg overflow-hidden border border-slate-200 group">
                ${p.media_type === 'video' && p.video_url
                    ? `<video src="${escapeHTML(p.video_url)}" class="w-full h-24 object-cover bg-slate-900" muted></video>`
                    : `<img src="${escapeHTML(p.image_url || '')}" alt="${escapeHTML(p.caption || '')}" class="w-full h-24 object-cover">`}
                <span class="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900/70 text-white uppercase">${escapeHTML(p.category)} ${p.media_type === 'video' ? '· video' : ''}</span>
                <button type="button" onclick="deleteGalleryPhoto(${p.id})" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-secondary/90 hover:bg-secondary text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><i class="fa-solid fa-trash"></i></button>
                ${p.caption || p.title ? `<div class="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[9px] px-1.5 py-1 truncate">${escapeHTML(p.title || p.caption || '')}</div>` : ''}
            </div>
        `).join('') || `<p class="text-xs text-slate-400 col-span-4">No photos uploaded yet.</p>`;
    } catch (err) {
        grid.innerHTML = `<p class="text-xs text-secondary col-span-4">${escapeHTML(err.message)}</p>`;
    }
}

async function deleteGalleryPhoto(id) {
    if (!confirm('Remove this photo?')) return;
    try {
        await apiCall(`/api/gallery/${id}`, { method: 'DELETE' });
        await loadGallery();
    } catch (err) {
        alert(err.message);
    }
}

// ---------- Department selection ----------
async function loadDepartmentOptions() {
    const select = document.getElementById('deptSelect');
    try {
        currentDepartments = await apiCall('/api/departments');
        select.innerHTML = '<option value="">Select a department…</option>' +
            currentDepartments.map(d => `<option value="${d.id}" data-code="${d.code}">${escapeHTML(d.code)} — ${escapeHTML(d.name)}</option>`).join('');
    } catch (err) {
        alert(err.message);
    }
}

function onDeptChange() {
    const select = document.getElementById('deptSelect');
    const opt = select.options[select.selectedIndex];
    const panels = document.getElementById('deptPanels');
    if (!select.value) {
        panels.classList.add('hidden');
        return;
    }
    currentDeptId = Number(select.value);
    currentDeptCode = opt.dataset.code;
    panels.classList.remove('hidden');
    loadStaff();
    loadEvents();
}

// ---------- Staff / HOD ----------
async function loadStaff() {
    try {
        const staff = await apiCall(`/api/staff?department=${currentDeptCode}`);
        const hod = staff.find(s => s.role === 'HOD');
        const faculty = staff.filter(s => s.role !== 'HOD');

        const hodBox = document.getElementById('hodCurrent');
        hodBox.innerHTML = hod ? staffCardHtml(hod, true) : `<p class="text-xs text-slate-400">No HOD set for this department yet.</p>`;

        const facultyBox = document.getElementById('staffList');
        facultyBox.innerHTML = faculty.map(s => staffCardHtml(s, false)).join('') ||
            `<p class="text-xs text-slate-400 sm:col-span-2">No faculty added yet.</p>`;
    } catch (err) {
        alert(err.message);
    }
}

function staffCardHtml(s, isHod) {
    const photo = s.photo_url
        ? `<img src="${s.photo_url}" alt="${escapeHTML(s.name)}" class="w-12 h-12 rounded-full object-cover">`
        : `<div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">${escapeHTML((s.name || '?').charAt(0))}</div>`;
    return `
        <div class="flex items-start gap-3 border ${isHod ? 'border-primary bg-primary/5' : 'border-slate-200'} rounded-xl p-3">
            ${photo}
            <div class="flex-1 min-w-0">
                ${isHod ? `<div class="text-[10px] font-bold uppercase tracking-wider text-primary">★ Head of Department</div>` : ''}
                <div class="font-bold text-slate-900 text-xs">${escapeHTML(s.name)}</div>
            </div>
            <button type="button" onclick="deleteStaff(${s.id})" class="text-secondary hover:text-secondary-dark text-xs" title="Remove"><i class="fa-solid fa-trash"></i></button>
        </div>`;
}

document.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'hodForm') {
        e.preventDefault();
        if (!currentDeptId) return;
        const fd = new FormData(e.target);
        fd.set('department_id', currentDeptId);
        fd.set('role', 'HOD');
        try {
            await apiCall('/api/staff', { method: 'POST', body: fd });
            e.target.reset();
            await loadStaff();
        } catch (err) { alert(err.message); }
    }
    if (e.target && e.target.id === 'staffForm') {
        e.preventDefault();
        if (!currentDeptId) return;
        const fd = new FormData(e.target);
        fd.set('department_id', currentDeptId);
        fd.set('role', 'Faculty');
        try {
            await apiCall('/api/staff', { method: 'POST', body: fd });
            e.target.reset();
            await loadStaff();
        } catch (err) { alert(err.message); }
    }
    if (e.target && e.target.id === 'eventForm') {
        e.preventDefault();
        if (!currentDeptId) return;
        const fd = new FormData(e.target);
        const isCollegeWide = document.getElementById('eventCollegeWide').checked;
        if (isCollegeWide) {
            fd.delete('department_id');
        } else {
            fd.set('department_id', currentDeptId);
        }
        try {
            await apiCall('/api/events', { method: 'POST', body: fd });
            e.target.reset();
            if (isCollegeWide) {
                alert('College-wide event published — it will show on the home page Events Board, not in this department-filtered list below.');
            }
            await loadEvents();
        } catch (err) { alert(err.message); }
    }
});

async function deleteStaff(id) {
    if (!confirm('Remove this staff member?')) return;
    try {
        await apiCall(`/api/staff/${id}`, { method: 'DELETE' });
        await loadStaff();
    } catch (err) { alert(err.message); }
}

// ---------- Events ----------
async function loadEvents() {
    try {
        const events = await apiCall(`/api/events?department=${currentDeptCode}`);
        const box = document.getElementById('eventsList');
        box.innerHTML = events.map(ev => `
            <div class="border border-slate-200 rounded-xl overflow-hidden">
                ${ev.image_url ? `<img src="${ev.image_url}" alt="${escapeHTML(ev.title)}" class="w-full h-28 object-cover">` : ''}
                <div class="p-3">
                    <div class="font-bold text-slate-900 text-xs">${escapeHTML(ev.title)}</div>
                    <div class="text-[11px] text-slate-500 mb-1">${escapeHTML(ev.event_date || '')}</div>
                    <p class="text-[11px] text-slate-600">${escapeHTML(ev.description || '')}</p>
                    <button type="button" onclick="deleteEvent(${ev.id})" class="text-secondary hover:text-secondary-dark text-[11px] mt-2"><i class="fa-solid fa-trash mr-1"></i>Remove</button>
                </div>
            </div>`).join('') || `<p class="text-xs text-slate-400 sm:col-span-2">No events yet for this department.</p>`;
    } catch (err) {
        alert(err.message);
    }
}

async function deleteEvent(id) {
    if (!confirm('Remove this event?')) return;
    try {
        await apiCall(`/api/events/${id}`, { method: 'DELETE' });
        await loadEvents();
    } catch (err) { alert(err.message); }
}

// ---------- Grievances (college-wide) ----------
const STATUS_BADGE = {
    'Open': 'bg-sky-100 text-sky-800',
    'In Progress': 'bg-amber-100 text-amber-800',
    'Resolved': 'bg-emerald-100 text-emerald-800',
    'Closed': 'bg-slate-200 text-slate-700',
};

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

function filterGrievancesByStatus(value) {
    const sel = document.getElementById('grievanceStatusFilter');
    if (sel) sel.value = value;
    return loadGrievances();
}

async function renderGrievanceStatusSummary() {
    const box = document.getElementById('grievanceStatusSummary');
    if (!box) return;
    try {
        const stats = await apiCall('/api/grievances/stats');
        const current = (document.getElementById('grievanceStatusFilter') || {}).value || '';
        const items = [
            ['', 'All', stats.all],
            ['Open', 'Open', stats.Open],
            ['In Progress', 'In Progress', stats['In Progress']],
            ['Resolved', 'Resolved', stats.Resolved],
            ['Closed', 'Closed', stats.Closed],
        ];
        box.innerHTML = items.map(([value, label, count]) => {
            const on = current === value;
            return `<button type="button" onclick="filterGrievancesByStatus('${value.replace(/'/g, "\\'")}')" class="rounded-xl border px-3 py-2 text-left ${on ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'}">
                <div class="text-[10px] uppercase tracking-wide font-bold text-slate-500">${escapeHTML(label)}</div>
                <div class="text-lg font-extrabold font-heading text-slate-900">${Number(count || 0)}</div>
            </button>`;
        }).join('');
    } catch (err) {
        box.innerHTML = `<p class="text-xs text-secondary col-span-full">${escapeHTML(err.message)}</p>`;
    }
}

async function loadGrievances() {
    const box = document.getElementById('grievancesList');
    const statusFilter = document.getElementById('grievanceStatusFilter').value;
    await renderGrievanceStatusSummary();
    try {
        const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
        const rows = await apiCall(`/api/grievances${qs}`);
        box.innerHTML = rows.map(g => `
            <details class="border border-slate-200 rounded-xl">
                <summary class="cursor-pointer list-none p-3 flex flex-wrap items-center gap-2 justify-between">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="font-bold text-xs text-slate-900">Grievance #${g.id}</span>
                        <span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">${escapeHTML(g.category || 'Not provided')}</span>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide ${STATUS_BADGE[g.status] || 'bg-slate-100 text-slate-600'}">${escapeHTML(String(g.status || '').toUpperCase())}</span>
                </summary>
                <div class="p-3 pt-0 text-xs space-y-3 border-t border-slate-100 mt-1">
                    <p><span class="font-semibold text-slate-700">Category:</span> ${escapeHTML(g.category || 'Not provided')}</p>
                    <p><span class="font-semibold text-slate-700">Department:</span> ${escapeHTML((g.department && g.department.name) || g.course || 'Not provided')}</p>
                    <p class="flex flex-wrap items-center gap-2">
                        <span class="font-semibold text-slate-700">Status:</span>
                        <span class="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide ${STATUS_BADGE[g.status] || 'bg-slate-100 text-slate-600'}">${escapeHTML(String(g.status || '').toUpperCase())}</span>
                    </p>
                    <p><span class="font-semibold text-slate-700">Submitted:</span> ${escapeHTML(formatGrievanceSubmittedAt(g.created_at))}</p>
                    <div class="text-slate-500">
                        ${g.is_anonymous || !g.name ? '<span class="italic">Anonymous</span>' : `Submitted by <strong>${escapeHTML(g.name)}</strong>`}${g.email ? ' · ' + escapeHTML(g.email) : ''}${g.phone ? ' · ' + escapeHTML(g.phone) : ''}
                    </div>
                    <p><span class="font-semibold text-slate-700">Subject:</span><br>${escapeHTML(g.subject || '')}</p>
                    <p class="text-slate-700 whitespace-pre-wrap"><span class="font-semibold text-slate-700">Description:</span><br>${escapeHTML(g.description)}</p>
                    <div class="grid sm:grid-cols-2 gap-3 pt-2">
                        <div>
                            <label class="block text-[11px] font-semibold text-slate-700 mb-1">Status</label>
                            <select id="gstatus-${g.id}" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs">
                                ${['Open','In Progress','Resolved','Closed'].map(s => `<option value="${s}" ${s===g.status?'selected':''}>${s}</option>`).join('')}
                            </select>
                        </div>
                        <div class="flex items-end">
                            <button type="button" onclick="deleteGrievance(${g.id})" class="text-secondary hover:text-secondary-dark text-[11px] font-semibold"><i class="fa-solid fa-trash mr-1"></i>Delete</button>
                        </div>
                    </div>
                    <div>
                        <label class="block text-[11px] font-semibold text-slate-700 mb-1">Admin response (internal notes / reply)</label>
                        <textarea id="gresponse-${g.id}" rows="2" class="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs">${escapeHTML(g.admin_response || '')}</textarea>
                    </div>
                    <button type="button" onclick="saveGrievance(${g.id})" class="bg-primary hover:bg-primary-dark text-white font-bold px-4 py-1.5 rounded-lg text-xs">Save</button>
                    <span id="gsaved-${g.id}" class="text-[11px] text-emerald-600 font-semibold hidden ml-2">Saved</span>
                </div>
            </details>
        `).join('') || `<p class="text-xs text-slate-400">No grievances${statusFilter ? ' with this status' : ''} yet.</p>`;
    } catch (err) {
        box.innerHTML = `<p class="text-xs text-secondary">${escapeHTML(err.message)}</p>`;
    }
}

async function saveGrievance(id) {
    const status = document.getElementById(`gstatus-${id}`).value;
    const admin_response = document.getElementById(`gresponse-${id}`).value;
    try {
        await apiCall(`/api/grievances/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, admin_response }),
        });
        const saved = document.getElementById(`gsaved-${id}`);
        saved.classList.remove('hidden');
        setTimeout(() => saved.classList.add('hidden'), 2000);
        await loadGrievances();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteGrievance(id) {
    if (!confirm('Delete this grievance record?')) return;
    try {
        await apiCall(`/api/grievances/${id}`, { method: 'DELETE' });
        await loadGrievances();
    } catch (err) {
        alert(err.message);
    }
}
