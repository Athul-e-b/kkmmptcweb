/**
 * Unified CMS dashboard for admin.html
 */
const CMS_CATS = ['campus','labs','events','achievements','students','activities','workshops','industrial-visits','sports','nss','clubs','other'];
let cmsDepts = [];
let cmsEditingDept = null;
let cmsEditingStaff = null;
let cmsEditingEvent = null;
let cmsStaffCache = [];

function toast(msg, ok = true) {
    const el = document.getElementById('cmsToast');
    if (!el) return;
    el.textContent = msg;
    el.className = `fixed top-20 right-4 z-50 text-xs font-semibold px-4 py-2 rounded-lg shadow ${ok ? 'bg-emerald-600 text-white' : 'bg-secondary text-white'}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 2800);
}

function toggleCmsSidebar() {
    const side = document.getElementById('cmsSidebar');
    const back = document.getElementById('cmsBackdrop');
    if (!side) return;
    const open = side.classList.contains('-translate-x-full');
    side.classList.toggle('-translate-x-full', !open);
    if (back) back.classList.toggle('hidden', !open);
}

function showCmsSection(name) {
    document.querySelectorAll('.cms-section').forEach((s) => s.classList.toggle('hidden', s.getAttribute('data-cms') !== name));
    document.querySelectorAll('.cms-nav').forEach((b) => {
        const on = b.getAttribute('data-section') === name;
        b.className = `cms-nav w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${on ? 'bg-primary text-white' : 'hover:bg-slate-800'}`;
    });
    if (window.innerWidth < 1024) {
        const side = document.getElementById('cmsSidebar');
        if (side) side.classList.add('-translate-x-full');
        const back = document.getElementById('cmsBackdrop');
        if (back) back.classList.add('hidden');
    }
}

function inp(name, label, value = '', extra = '') {
    return `<label class="block">${label}<input name="${name}" value="${escapeHTML(value || '')}" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300" ${extra}></label>`;
}
function area(name, label, value = '') {
    return `<label class="sm:col-span-2 block">${label}<textarea name="${name}" rows="3" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300">${escapeHTML(value || '')}</textarea></label>`;
}

async function cmsBoot() {
    document.querySelectorAll('.cms-nav').forEach((b) => b.addEventListener('click', () => showCmsSection(b.getAttribute('data-section'))));
    try { cmsDepts = await apiCall('/api/departments?include_inactive=true'); } catch (e) { cmsDepts = await apiCall('/api/departments'); }
    await Promise.all([cmsLoadStats(), cmsCollegeForm(), cmsPrincipalForm(), cmsDeptList(), cmsStaffUI(), cmsEventUI(), cmsGalleryUI(), cmsNotices(), cmsGrievances()]);
    const q = new URLSearchParams(location.search).get('section');
    showCmsSection(q || 'dashboard');
}

async function cmsLoadStats() {
    const box = document.getElementById('cmsStats');
    if (!box) return;
    try {
        const s = await apiCall('/api/admin/stats');
        const items = [
            ['Departments', s.departments], ['Faculty', s.faculty], ['Events', s.events],
            ['Gallery', s.gallery], ['Notices', s.notices], ['Grievances', s.grievances],
        ];
        box.innerHTML = items.map(([k, v]) => `<div class="bg-white border rounded-2xl p-4"><div class="text-[10px] uppercase text-slate-500 font-bold">${k}</div><div class="text-2xl font-extrabold font-heading text-primary">${v}</div></div>`).join('');
    } catch (e) {
        box.innerHTML = `<p class="text-xs text-secondary">${escapeHTML(e.message)}</p>`;
    }
}

async function cmsCollegeForm() {
    const form = document.getElementById('collegeForm');
    if (!form) return;
    const info = await apiCall('/api/college-info');
    form.innerHTML = [
        inp('name', 'College Name', info.name, 'required'),
        inp('short_name', 'Short Name', info.short_name),
        area('address', 'Address', info.address),
        inp('phone', 'Phone', info.phone),
        inp('mobile', 'Mobile', info.mobile),
        inp('email', 'Email', info.email, 'type="email"'),
        inp('website', 'Website', info.website),
        inp('maps_url', 'Google Maps URL', info.maps_url),
        inp('youtube_url', 'YouTube', info.youtube_url),
        inp('facebook_url', 'Facebook', info.facebook_url),
        inp('instagram_url', 'Instagram', info.instagram_url),
        inp('office_hours', 'Office Hours', info.office_hours),
        inp('established', 'Established', info.established),
        inp('governing_body', 'Governing Body', info.governing_body),
        area('approval', 'Approval / Affiliation', info.approval),
        `<div class="sm:col-span-2"><button class="bg-primary text-white font-bold px-4 py-2 rounded-lg">Save Changes</button></div>`
    ].join('');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        try {
            await apiCall('/api/college-info', { method: 'PATCH', body: fd });
            toast('✓ College information updated');
        } catch (err) { toast('✕ ' + err.message, false); }
    };
}

async function cmsPrincipalForm() {
    const form = document.getElementById('cmsPrincipalForm');
    if (!form) return;
    const p = await fetch('/api/principal').then((r) => r.json());
    const photo = p.photo_url
        ? `<img src="${escapeHTML(p.photo_url)}" alt="${escapeHTML(p.name || 'Principal')}" class="w-28 h-28 rounded-full object-cover border-4 border-accent shadow">`
        : `<div class="w-28 h-28 rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold">P</div>`;
    form.innerHTML = `
        <div class="sm:col-span-2 bg-primary text-white rounded-2xl p-5 flex flex-wrap items-center gap-5">
            ${photo}
            <div>
                <p class="text-[10px] font-bold uppercase tracking-wider text-accent">★ Principal</p>
                <p class="text-xl font-heading font-extrabold">${escapeHTML(p.name || 'Not set')}</p>
                <p class="text-xs text-white/80">KKM Model Polytechnic College, Kallettumkara</p>
            </div>
        </div>
        ${inp('name', 'Principal Name *', p.name, 'required')}
        <label class="block">Principal Photo
            <input type="file" name="photo" id="cmsPrincipalPhoto" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" class="mt-1 w-full text-xs">
            <div id="cmsPrincipalPreview" class="mt-2"></div>
        </label>
        ${p.photo_url ? `<label class="flex items-center gap-2 sm:col-span-2"><input type="checkbox" name="remove_photo" value="1"> Remove photo</label>` : ''}
        <div class="sm:col-span-2"><button class="bg-primary text-white font-bold px-4 py-2 rounded-lg">Save Principal</button></div>`;
    const photoInput = form.querySelector('#cmsPrincipalPhoto');
    if (photoInput) photoInput.onchange = () => cmsFilePreview(photoInput, document.getElementById('cmsPrincipalPreview'), 'image');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        try {
            await apiCall('/api/principal', { method: 'POST', body: fd });
            toast('✓ Principal updated');
            await cmsPrincipalForm();
        } catch (err) { toast('✕ ' + err.message, false); }
    };
}

function cmsFilePreview(input, box, kind) {
    if (!box) return;
    const file = input.files && input.files[0];
    if (!file) { box.innerHTML = ''; return; }
    const url = URL.createObjectURL(file);
    box.innerHTML = kind === 'video'
        ? `<video src="${url}" class="max-h-40 rounded-lg border" controls muted></video>`
        : `<img src="${url}" class="max-h-40 rounded-lg border object-cover" alt="Preview">`;
}

async function cmsDeptList() {
    const box = document.getElementById('cmsDeptList');
    if (!box) return;
    cmsDepts = await apiCall('/api/departments?include_inactive=true').catch(() => apiCall('/api/departments'));
    box.innerHTML = cmsDepts.map((d) => `
        <div class="bg-white border rounded-xl p-4 flex justify-between gap-3">
            <div>
                <div class="font-bold text-sm">${escapeHTML(d.name)} <span class="text-primary text-xs">${escapeHTML(d.code)}</span></div>
                <div class="text-[11px] text-slate-500">${escapeHTML((d.hod && d.hod.name) || 'No HOD')} · ${escapeHTML(d.email || '')}</div>
            </div>
            <div class="flex gap-2 text-xs">
                <a class="text-primary font-bold" href="departments.html?department=${encodeURIComponent(d.code)}" target="_blank">Preview</a>
                <button type="button" class="font-bold" onclick="cmsEditDepartment(${d.id})">Edit</button>
            </div>
        </div>`).join('');
}

function cmsDeptFields(d = {}) {
    return [
        `<input type="hidden" name="id" value="${d.id || ''}">`,
        inp('code', 'Code *', d.code, d.id ? 'readonly' : 'required'),
        inp('name', 'Name *', d.name, 'required'),
        area('description', 'Description', d.description),
        area('vision', 'Vision', d.vision),
        area('mission', 'Mission', d.mission),
        inp('phone', 'Phone', d.phone),
        inp('email', 'Email', d.email),
        inp('course_name', 'Course name', d.course_name),
        inp('duration', 'Duration', d.duration),
        inp('intake', 'Intake', d.intake, 'type="number"'),
        area('eligibility', 'Eligibility', d.eligibility),
        area('labs_text', 'Labs (one per line)', d.labs_text),
        area('career_text', 'Career prospects (one per line)', d.career_text),
        area('other_details', 'Other details', d.other_details),
        `<label class="block">Department image<input type="file" name="image" accept="image/*" class="mt-1 w-full text-xs"></label>
         <div class="sm:col-span-2 flex gap-2">
            <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg">Save Changes</button>
            <button type="button" class="px-4 py-2 rounded-lg border" onclick="document.getElementById('cmsDeptForm').classList.add('hidden')">Cancel</button>
            ${d.code ? `<a class="px-4 py-2 rounded-lg border text-primary font-bold" target="_blank" href="departments.html?department=${encodeURIComponent(d.code)}">Preview</a>` : ''}
         </div>`
    ].join('');
}

function cmsNewDepartment() {
    toast('New departments cannot be added. Edit one of the six existing branches.', false);
}

async function cmsEditDepartment(id) {
    const d = cmsDepts.find((x) => x.id === id);
    cmsEditingDept = d;
    const form = document.getElementById('cmsDeptForm');
    form.classList.remove('hidden');
    form.innerHTML = cmsDeptFields(d || {});
    bindDeptForm(form, d);
}

function bindDeptForm(form, d) {
    form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const id = fd.get('id');
        fd.delete('id');
        try {
            if (id) await apiCall(`/api/departments/${id}`, { method: 'PATCH', body: fd });
            else {
                toast('✕ New departments cannot be added', false);
                return;
            }
            toast('✓ Department saved');
            form.classList.add('hidden');
            await cmsDeptList();
            await cmsStaffUI();
        } catch (err) { toast('✕ ' + err.message, false); }
    };
}

function deptOptions(selected) {
    return cmsDepts.map((d) => `<option value="${d.id}" ${String(d.id) === String(selected) ? 'selected' : ''}>${escapeHTML(d.name)} (${escapeHTML(d.code)})</option>`).join('');
}

async function cmsStaffUI() {
    await cmsStaffRender();
}

async function cmsStaffRender() {
    const hodPanel = document.getElementById('cmsHodPanel');
    const facPanel = document.getElementById('cmsFacultyPanel');
    if (!hodPanel || !facPanel) return;
    const staff = await apiCall('/api/staff');
    cmsStaffCache = staff;
    const byDept = cmsDepts.map((d) => {
        const members = staff.filter((s) => s.department_id === d.id);
        const hod = members.find((s) => s.role === 'HOD');
        const faculty = members.filter((s) => s.role !== 'HOD');
        return { d, hod, faculty };
    });

    hodPanel.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h3 class="font-heading font-bold text-sm text-slate-900">★ Head of Department</h3>
        </div>
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
            ${byDept.map(({ d, hod }) => `
                <div class="bg-gradient-to-br from-primary to-primary-dark text-white rounded-2xl p-4 shadow border border-primary/20">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-accent">★ Head of Department</p>
                    ${hod && hod.photo_url
                        ? `<img src="${escapeHTML(hod.photo_url)}" alt="${escapeHTML(hod.name)}" class="w-20 h-20 rounded-full object-cover border-4 border-white/40 mt-3">`
                        : `<div class="w-20 h-20 rounded-full bg-white/15 flex items-center justify-center text-2xl font-bold mt-3">${hod ? escapeHTML(hod.name.charAt(0)) : '—'}</div>`}
                    <p class="font-heading font-extrabold text-lg mt-3">${hod ? escapeHTML(hod.name) : 'No HOD yet'}</p>
                    <p class="text-xs text-white/80">${escapeHTML(d.name)}</p>
                    <button type="button" class="mt-3 bg-white text-primary text-xs font-bold px-3 py-1.5 rounded-lg" onclick="cmsHodForm(${d.id}, ${hod ? hod.id : 'null'})">${hod ? 'Edit HOD' : 'Add HOD'}</button>
                </div>`).join('')}
        </div>
        <form id="cmsHodForm" class="hidden bg-white p-4 rounded-2xl border grid sm:grid-cols-2 gap-3 text-xs" enctype="multipart/form-data"></form>`;

    facPanel.innerHTML = `
        <h3 class="font-heading font-bold text-sm text-slate-900 mb-3">Faculty</h3>
        <div class="space-y-3">
            ${byDept.map(({ d, faculty }) => `
                <div class="bg-white border rounded-2xl p-4">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <div class="font-bold text-sm uppercase tracking-wide">${escapeHTML(d.name)}</div>
                            <div class="text-xs text-slate-500">Faculty: ${faculty.length}</div>
                        </div>
                        <div class="flex gap-2 text-xs">
                            <button type="button" class="font-bold text-primary" onclick="cmsToggleFacultyList(${d.id})">View Faculty</button>
                            <button type="button" class="bg-primary text-white font-bold px-3 py-1.5 rounded-lg" onclick="cmsFacultyForm(${d.id})">Add Faculty</button>
                        </div>
                    </div>
                    <div id="cmsFacList-${d.id}" class="hidden mt-3 space-y-2">
                        ${faculty.map((s) => `
                            <div class="flex items-center justify-between border border-slate-100 rounded-xl px-3 py-2 text-xs">
                                <span class="font-semibold">${escapeHTML(s.name)}</span>
                                <div class="flex gap-2">
                                    <button type="button" class="font-bold text-primary" onclick="cmsFacultyForm(${d.id}, ${s.id})">Edit</button>
                                    <button type="button" class="font-bold text-secondary" onclick="cmsDeleteStaff(${s.id})">Delete</button>
                                </div>
                            </div>`).join('') || '<p class="text-xs text-slate-400">No faculty yet.</p>'}
                    </div>
                </div>`).join('')}
        </div>
        <form id="cmsFacultyForm" class="hidden bg-white p-4 rounded-2xl border grid sm:grid-cols-2 gap-3 text-xs mt-4"></form>`;
}

function cmsToggleFacultyList(deptId) {
    const el = document.getElementById(`cmsFacList-${deptId}`);
    if (el) el.classList.toggle('hidden');
}

function cmsHodForm(deptId, staffId) {
    const hod = staffId ? cmsStaffCache.find((s) => s.id === staffId) : null;
    const form = document.getElementById('cmsHodForm');
    form.classList.remove('hidden');
    form.innerHTML = `
        <input type="hidden" name="staff_id" value="${hod ? hod.id : ''}">
        <label>Branch / Department *
            <select name="department_id" required class="mt-1 w-full px-3 py-2 rounded-lg border">${deptOptions(deptId)}</select>
        </label>
        ${inp('name', 'HOD Name *', hod ? hod.name : '', 'required')}
        <label class="block sm:col-span-2">HOD Photo
            <input type="file" name="photo" id="cmsHodPhoto" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" class="mt-1 w-full text-xs">
            <div id="cmsHodPreview" class="mt-2">${hod && hod.photo_url ? `<img src="${escapeHTML(hod.photo_url)}" class="w-20 h-20 rounded-full object-cover">` : ''}</div>
        </label>
        <div class="sm:col-span-2 flex gap-2">
            <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg">${hod ? 'Save HOD' : 'Add HOD'}</button>
            <button type="button" class="px-4 py-2 rounded-lg border" onclick="document.getElementById('cmsHodForm').classList.add('hidden')">Cancel</button>
        </div>`;
    const photoInput = form.querySelector('#cmsHodPhoto');
    if (photoInput) photoInput.onchange = () => cmsFilePreview(photoInput, document.getElementById('cmsHodPreview'), 'image');
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const id = fd.get('staff_id');
        fd.delete('staff_id');
        fd.set('role', 'HOD');
        try {
            if (id) await apiCall(`/api/staff/${id}`, { method: 'PATCH', body: fd });
            else await apiCall('/api/staff', { method: 'POST', body: fd });
            toast('✓ HOD saved');
            form.classList.add('hidden');
            await cmsStaffRender();
        } catch (err) { toast('✕ ' + err.message, false); }
    };
}

function cmsFacultyForm(deptId, staffId) {
    const row = staffId ? cmsStaffCache.find((s) => s.id === staffId) : null;
    const form = document.getElementById('cmsFacultyForm');
    form.classList.remove('hidden');
    form.innerHTML = `
        <input type="hidden" name="staff_id" value="${row ? row.id : ''}">
        <label>Department / Branch *
            <select name="department_id" required class="mt-1 w-full px-3 py-2 rounded-lg border">${deptOptions(deptId)}</select>
        </label>
        ${inp('name', 'Faculty Name *', row ? row.name : '', 'required')}
        <div class="sm:col-span-2 flex gap-2">
            <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg">${row ? 'Save Faculty' : 'Add Faculty'}</button>
            <button type="button" class="px-4 py-2 rounded-lg border" onclick="document.getElementById('cmsFacultyForm').classList.add('hidden')">Cancel</button>
        </div>`;
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const id = fd.get('staff_id');
        fd.delete('staff_id');
        fd.set('role', 'Faculty');
        try {
            if (id) await apiCall(`/api/staff/${id}`, { method: 'PATCH', body: fd });
            else await apiCall('/api/staff', { method: 'POST', body: fd });
            toast('✓ Faculty saved');
            form.classList.add('hidden');
            await cmsStaffRender();
        } catch (err) { toast('✕ ' + err.message, false); }
    };
}

async function cmsDeleteStaff(id) {
    if (!confirm('Are you sure you want to delete this staff member?\n\nThis action cannot be undone.')) return;
    try {
        await apiCall(`/api/staff/${id}`, { method: 'DELETE' });
        toast('✓ Deleted');
        await cmsStaffRender();
    } catch (err) { toast('✕ ' + err.message, false); }
}

async function cmsEventUI() {
    const form = document.getElementById('cmsEventForm');
    if (!form) return;
    form.innerHTML = `
        <input type="hidden" name="event_id">
        ${inp('title', 'Title *', '', 'required')}
        <label>Date *<input type="date" name="event_date" required class="mt-1 w-full px-3 py-2 rounded-lg border"></label>
        ${inp('start_time', 'Start time')}
        ${inp('end_time', 'End time')}
        ${inp('venue', 'Venue')}
        ${inp('organizer', 'Organizer')}
        ${inp('category', 'Category')}
        ${inp('registration_link', 'Registration link')}
        <label>Department<select name="department_id" class="mt-1 w-full px-3 py-2 rounded-lg border"><option value="">College-wide</option>${deptOptions()}</select></label>
        <label>Status<select name="status" class="mt-1 w-full px-3 py-2 rounded-lg border"><option value="published">Publish</option><option value="draft">Draft</option></select></label>
        ${area('description', 'Description')}
        <label>Image<input type="file" name="image" accept="image/*" class="mt-1 w-full text-xs"></label>
        <div class="sm:col-span-2"><button class="bg-primary text-white font-bold px-4 py-2 rounded-lg">Save Event</button></div>`;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const id = fd.get('event_id');
        fd.delete('event_id');
        if (!fd.get('department_id')) fd.delete('department_id');
        try {
            if (id) await apiCall(`/api/events/${id}`, { method: 'PATCH', body: fd });
            else await apiCall('/api/events', { method: 'POST', body: fd });
            toast('✓ Event saved');
            form.reset();
            await cmsEventList();
        } catch (err) { toast('✕ ' + err.message, false); }
    };
    await cmsEventList();
}

async function cmsEventList() {
    const box = document.getElementById('cmsEventList');
    const rows = await apiCall('/api/events?status=all');
    box.innerHTML = rows.map((ev) => `
        <div class="bg-white border rounded-xl p-3 flex justify-between text-xs">
            <div><div class="font-bold">${escapeHTML(ev.title)}</div><div class="text-slate-500">${escapeHTML(ev.event_date || '')} · ${escapeHTML(ev.status || 'published')}</div></div>
            <button type="button" class="text-secondary font-bold" onclick="cmsDeleteEvent(${ev.id})">Delete</button>
        </div>`).join('') || '<p class="text-xs text-slate-400">No events.</p>';
}

async function cmsDeleteEvent(id) {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    try {
        await apiCall(`/api/events/${id}`, { method: 'DELETE' });
        toast('✓ Event deleted');
        await cmsEventList();
    } catch (err) { toast('✕ ' + err.message, false); }
}

async function cmsGalleryUI() {
    const form = document.getElementById('cmsGalleryForm');
    if (!form) return;
    cmsBindGalleryForm(form, null);
    await cmsGalleryTable();
}

let cmsEditingGallery = null;

function cmsBindGalleryForm(form, item) {
    cmsEditingGallery = item;
    const isVideo = item ? item.media_type === 'video' : false;
    form.innerHTML = `
        <input type="hidden" name="gallery_id" value="${item ? item.id : ''}">
        ${inp('title', 'Title', item ? item.title : '')}
        <label>Category
            <select name="category" required class="mt-1 w-full px-3 py-2 rounded-lg border">${CMS_CATS.map((c) => `<option value="${c}" ${item && item.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </label>
        <label>Media Type
            <select name="media_type" id="cmsGalleryType" class="mt-1 w-full px-3 py-2 rounded-lg border">
                <option value="image" ${!isVideo ? 'selected' : ''}>Image</option>
                <option value="video" ${isVideo ? 'selected' : ''}>Video</option>
            </select>
        </label>
        <label>Department
            <select name="department_id" class="mt-1 w-full px-3 py-2 rounded-lg border">
                <option value="">College-wide</option>${deptOptions(item && item.department_id)}
            </select>
        </label>
        <div id="cmsGalleryImageField" class="sm:col-span-2 ${isVideo ? 'hidden' : ''}">
            <label class="block border-2 border-dashed rounded-xl p-4 text-center">Image (JPG, JPEG, PNG, WebP)
                <input type="file" name="image" id="cmsGalleryImage" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" class="mt-2 w-full text-xs">
            </label>
            <div id="cmsGalleryImagePreview" class="mt-2"></div>
        </div>
        <div id="cmsGalleryVideoField" class="sm:col-span-2 ${isVideo ? '' : 'hidden'}">
            <label class="block border-2 border-dashed rounded-xl p-4 text-center">Video (MP4, WebM)
                <input type="file" name="video" id="cmsGalleryVideo" accept=".mp4,.webm,video/mp4,video/webm" class="mt-2 w-full text-xs">
            </label>
            <div id="cmsGalleryVideoPreview" class="mt-2"></div>
        </div>
        <div class="sm:col-span-2 flex gap-2">
            <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg">${item ? 'Save Changes' : '+ Add Media'}</button>
            ${item ? `<button type="button" class="px-4 py-2 rounded-lg border" onclick="cmsBindGalleryForm(document.getElementById('cmsGalleryForm'), null)">Cancel edit</button>` : ''}
        </div>`;
    const typeSel = form.querySelector('#cmsGalleryType');
    const imgField = form.querySelector('#cmsGalleryImageField');
    const vidField = form.querySelector('#cmsGalleryVideoField');
    const imgInput = form.querySelector('#cmsGalleryImage');
    const vidInput = form.querySelector('#cmsGalleryVideo');
    typeSel.onchange = () => {
        const video = typeSel.value === 'video';
        imgField.classList.toggle('hidden', video);
        vidField.classList.toggle('hidden', !video);
        if (video) imgInput.value = '';
        else vidInput.value = '';
    };
    if (imgInput) imgInput.onchange = () => cmsFilePreview(imgInput, document.getElementById('cmsGalleryImagePreview'), 'image');
    if (vidInput) vidInput.onchange = () => cmsFilePreview(vidInput, document.getElementById('cmsGalleryVideoPreview'), 'video');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const id = fd.get('gallery_id');
        const kind = fd.get('media_type');
        fd.delete('gallery_id');
        if (!fd.get('department_id')) fd.delete('department_id');
        if (kind === 'image') fd.delete('video');
        if (kind === 'video') fd.delete('image');
        try {
            if (id) await apiCall(`/api/gallery/${id}`, { method: 'PATCH', body: fd });
            else await apiCall('/api/gallery', { method: 'POST', body: fd });
            toast(kind === 'video' ? '✓ Gallery item uploaded successfully' : '✓ Gallery item uploaded successfully');
            cmsBindGalleryForm(form, null);
            await cmsGalleryTable();
        } catch (err) {
            toast(`✕ ${kind === 'video' ? 'Video' : 'Image'} upload failed. ${err.message}`, false);
        }
    };
}

function cmsGalleryThumb(g) {
    if (g.media_type === 'video' && g.video_url) {
        return `<video src="${escapeHTML(g.video_url)}" class="w-14 h-10 object-cover rounded bg-slate-800" muted></video>`;
    }
    if (g.image_url) return `<img src="${escapeHTML(g.image_url)}" class="w-14 h-10 object-cover rounded" alt="">`;
    return '—';
}

async function cmsGalleryTable() {
    const body = document.getElementById('cmsGalleryTable');
    const rows = await apiCall('/api/gallery');
    body.innerHTML = rows.map((g) => `
        <tr class="border-t">
            <td class="p-2">${cmsGalleryThumb(g)}</td>
            <td class="p-2">${escapeHTML(g.title || g.caption || 'Untitled')}</td>
            <td class="p-2 text-center">${escapeHTML(g.media_type || 'image')}</td>
            <td class="p-2 text-center">${escapeHTML(g.category)}</td>
            <td class="p-2 text-right whitespace-nowrap">
                <button type="button" class="font-bold text-primary mr-2" onclick="cmsEditGallery(${g.id})">Edit</button>
                <button type="button" class="text-secondary font-bold" onclick="cmsDeleteGallery(${g.id})">Delete</button>
            </td>
        </tr>`).join('') || `<tr><td class="p-3 text-slate-400" colspan="5">No media yet.</td></tr>`;
    window._cmsGalleryRows = rows;
}

async function cmsEditGallery(id) {
    const rows = window._cmsGalleryRows || await apiCall('/api/gallery');
    const item = rows.find((g) => g.id === id);
    if (!item) return;
    cmsBindGalleryForm(document.getElementById('cmsGalleryForm'), item);
    document.getElementById('cmsGalleryForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function cmsDeleteGallery(id) {
    if (!confirm('Delete this gallery item? This cannot be undone.')) return;
    try {
        await apiCall(`/api/gallery/${id}`, { method: 'DELETE' });
        toast('✓ Deleted');
        await cmsGalleryTable();
    } catch (err) { toast('✕ ' + err.message, false); }
}

async function cmsNotices() {
    const box = document.getElementById('cmsNoticeList');
    if (!box) return;
    const rows = await apiCall('/api/notices?published_only=false');
    box.innerHTML = rows.map((n) => `
        <div class="bg-white border rounded-xl p-3 flex justify-between text-xs">
            <div><span class="font-bold">${escapeHTML(n.title)}</span> · ${escapeHTML(n.category)}</div>
            <button type="button" class="text-secondary font-bold" onclick="cmsDeleteNotice(${n.id})">Delete</button>
        </div>`).join('');
}

async function cmsDeleteNotice(id) {
    if (!confirm('Delete this notice?')) return;
    await apiCall(`/api/notices/${id}`, { method: 'DELETE' });
    toast('✓ Notice deleted');
    await cmsNotices();
}

async function cmsGrievances() {
    const box = document.getElementById('grievancesList');
    if (!box) return;
    const statusFilter = (document.getElementById('grievanceStatusFilter') || {}).value || '';
    await renderGrievanceStatusSummary();
    try {
        const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
        const rows = await apiCall(`/api/grievances${qs}`);
        box.innerHTML = rows.map((g) => cmsGrievanceCard(g)).join('')
            || `<p class="text-xs text-slate-400">No grievances${statusFilter ? ' with this status' : ''}.</p>`;
    } catch (err) {
        box.innerHTML = `<p class="text-xs text-secondary">${escapeHTML(err.message)}</p>`;
    }
}

const GRIEVANCE_STATUS_BADGE = {
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

function grievanceStatusLabel(status) {
    return String(status || '').toUpperCase();
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

function filterGrievancesByStatus(value) {
    const sel = document.getElementById('grievanceStatusFilter');
    if (sel) sel.value = value;
    return loadGrievances();
}

function cmsGrievanceCard(g) {
    const deptName = (g.department && g.department.name) || g.course || 'Not provided';
    const badge = GRIEVANCE_STATUS_BADGE[g.status] || 'bg-slate-100 text-slate-600';
    return `
        <details class="bg-white border border-slate-200 rounded-xl p-3 text-xs">
            <summary class="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2">
                <span class="font-bold text-slate-900">Grievance #${g.id}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide ${badge}">${escapeHTML(grievanceStatusLabel(g.status))}</span>
            </summary>
            <div class="mt-3 space-y-2 text-slate-600 border-t border-slate-100 pt-3">
                <p><span class="font-semibold text-slate-700">Category:</span> ${escapeHTML(g.category || 'Not provided')}</p>
                <p><span class="font-semibold text-slate-700">Department:</span> ${escapeHTML(deptName)}</p>
                <p class="flex flex-wrap items-center gap-2">
                    <span class="font-semibold text-slate-700">Status:</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide ${badge}">${escapeHTML(grievanceStatusLabel(g.status))}</span>
                </p>
                <p><span class="font-semibold text-slate-700">Submitted:</span> ${escapeHTML(formatGrievanceSubmittedAt(g.created_at))}</p>
                <p class="pt-1"><span class="font-semibold text-slate-700">Subject:</span><br>${escapeHTML(g.subject || '')}</p>
                <p><span class="font-semibold text-slate-700">Description:</span><br><span class="whitespace-pre-wrap">${escapeHTML(g.description || '')}</span></p>
                <p class="text-slate-500">${g.is_anonymous || !g.name ? 'Anonymous' : escapeHTML(g.name)}${g.email ? ' · ' + escapeHTML(g.email) : ''}</p>
                <div class="grid sm:grid-cols-2 gap-3 pt-2">
                    <label class="block">Update status
                        <select id="gstatus-${g.id}" class="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white">
                            ${['Open','In Progress','Resolved','Closed'].map((s) => `<option value="${s}" ${s === g.status ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </label>
                    <div class="flex items-end">
                        <button type="button" onclick="deleteGrievance(${g.id})" class="text-secondary hover:text-secondary-dark text-[11px] font-semibold">Delete</button>
                    </div>
                </div>
                <label class="block">Admin response
                    <textarea id="gresponse-${g.id}" rows="2" class="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs">${escapeHTML(g.admin_response || '')}</textarea>
                </label>
                <button type="button" onclick="saveGrievance(${g.id})" class="bg-primary hover:bg-primary-dark text-white font-bold px-4 py-1.5 rounded-lg text-xs">Save</button>
                <span id="gsaved-${g.id}" class="text-[11px] text-emerald-600 font-semibold hidden ml-2">Saved</span>
            </div>
        </details>`;
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
        if (saved) {
            saved.classList.remove('hidden');
            setTimeout(() => saved.classList.add('hidden'), 2000);
        }
        toast('✓ Grievance updated');
        await loadGrievances();
    } catch (err) {
        toast('✕ ' + err.message, false);
    }
}

async function deleteGrievance(id) {
    if (!confirm('Delete this grievance record?')) return;
    try {
        await apiCall(`/api/grievances/${id}`, { method: 'DELETE' });
        toast('✓ Deleted');
        await loadGrievances();
    } catch (err) { toast('✕ ' + err.message, false); }
}

async function loadGrievances() { return cmsGrievances(); }

const _prevAdminReady = window.onAdminWorkspaceReady;
window.onAdminWorkspaceReady = async function () {
    if (typeof _prevAdminReady === 'function') {
        try { await _prevAdminReady(); } catch (e) { /* notices/apps optional */ }
    }
    await cmsBoot();
};
