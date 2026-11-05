/**
 * Department dashboard modules. Existing login, profile, faculty, and
 * account routes stay in place; this file adds the screen around them.
 */
function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

const DM_MODULES = {
    clubs: {
        title: 'Clubs and associations',
        fields: [
            ['name', 'Club name', 'text', true],
            ['description', 'Short description', 'textarea'],
            ['category', 'Category', 'text'],
            ['coordinator', 'Coordinator', 'text'],
            ['faculty_in_charge', 'Faculty in charge', 'text'],
            ['established_on', 'Established', 'text'],
            ['objectives', 'Objectives', 'textarea'],
            ['activities', 'Activities', 'textarea'],
            ['meeting_info', 'Meetings', 'textarea'],
            ['academic_year', 'Academic year', 'text'],
            ['is_active', 'Status', 'select', false, ['1', '0']],
            ['members', 'Members', 'members'],
            ['logo', 'Logo', 'file', false, 'image/jpeg,image/png,image/webp'],
            ['cover', 'Cover photo', 'file', false, 'image/jpeg,image/png,image/webp'],
        ],
    },
    events: {
        title: 'Activities and events',
        fields: [
            ['title', 'Title', 'text', true],
            ['event_type', 'Type', 'select', true, ['workshop', 'seminar', 'technical competition', 'industrial visit', 'college celebration', 'other']],
            ['event_date', 'Date', 'date'],
            ['start_time', 'Time', 'time'],
            ['venue', 'Venue', 'text'],
            ['club_id', 'Club', 'club'],
            ['description', 'Description', 'textarea'],
            ['academic_year', 'Academic year', 'text'],
            ['participant_count', 'Participant count', 'number'],
            ['participants_text', 'Participant list', 'textarea'],
            ['participants_file', 'Participant CSV', 'file', false, '.csv,text/csv'],
            ['poster', 'Poster', 'file', false, 'image/jpeg,image/png,image/webp'],
            ['photos', 'Photographs', 'file', false, 'image/jpeg,image/png,image/webp', true],
        ],
    },
    notices: {
        title: 'Notices',
        fields: [
            ['title', 'Title', 'text', true],
            ['category', 'Category', 'select', true, ['circular', 'announcement', 'deadline']],
            ['description', 'Description', 'textarea'],
            ['deadline', 'Deadline', 'date'],
            ['academic_year', 'Academic year', 'text'],
            ['document', 'Document', 'file', false, '.pdf,.doc,.docx,application/pdf'],
        ],
    },
    projects: {
        title: 'Projects and achievements',
        fields: [
            ['title', 'Title', 'text', true],
            ['category', 'Category', 'select', true, ['student project', 'competition result', 'award', 'certification', 'faculty achievement']],
            ['people', 'People involved', 'text'],
            ['event_date', 'Date', 'date'],
            ['description', 'Description', 'textarea'],
            ['academic_year', 'Academic year', 'text'],
            ['photo', 'Photo', 'file', false, 'image/jpeg,image/png,image/webp'],
            ['certificate', 'Certificate', 'file', false, '.pdf,.doc,.docx,application/pdf'],
        ],
    },
    reports: {
        title: 'Activity reports',
        fields: [
            ['title', 'Report title', 'text', true],
            ['academic_year', 'Academic year', 'text'],
            ['event_id', 'Linked event id', 'number'],
            ['summary', 'Summary', 'textarea'],
            ['photo', 'Photograph', 'file', false, 'image/jpeg,image/png,image/webp'],
            ['photos', 'More photographs', 'file', false, 'image/jpeg,image/png,image/webp', true],
            ['document', 'Supporting document', 'file', false, '.pdf,.doc,.docx,application/pdf'],
        ],
    },
    gallery: {
        title: 'Photo gallery',
        fields: [
            ['title', 'Title', 'text'],
            ['academic_year', 'Academic year', 'text'],
            ['image', 'Photo', 'file', false, 'image/jpeg,image/png,image/webp'],
        ],
    },
};

const dm = { role: 'department', code: '', name: '', panel: 'home', offset: 0, total: 0, items: [], departments: [] };

function dmIsAdmin() { return dm.role === 'admin'; }

function dmToken() {
    return dm.role === 'admin'
        ? sessionStorage.getItem('kkm_dept_admin_token')
        : getDepartmentToken();
}

async function dmFetch(path, options) {
    const opts = options || {};
    const headers = Object.assign({}, opts.headers || {});
    if (dmToken()) headers.Authorization = 'Bearer ' + dmToken();
    const res = await fetch(path, Object.assign({}, opts, { headers }));
    let data = null;
    try { data = await res.json(); } catch (err) { /* empty */ }
    if (res.status === 401) {
        if (dm.role === 'admin') window.location.replace('admin-login.html');
        else leaveDashboard();
        throw new Error('Please sign in again.');
    }
    if (!res.ok) throw new Error(departmentErrorText(data, 'Request failed'));
    return data;
}

function dmToast(message) {
    const toast = document.getElementById('dmToast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(dmToast.timer);
    dmToast.timer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function dmAsk(message, withReason) {
    const dialog = document.getElementById('dmAsk');
    dialog.innerHTML = `<p>${escapeHTML(message)}</p>${withReason ? '<label>Reason<textarea name="reason" required></textarea></label>' : ''}<div class="dm-actions"><button type="button" class="dm-soft" value="cancel">Cancel</button><button type="button" class="dm-danger" value="ok">Confirm</button></div>`;
    dialog.showModal();
    return new Promise((resolve) => {
        dialog.querySelector('[value="cancel"]').onclick = () => { dialog.close(); resolve(null); };
        dialog.querySelector('[value="ok"]').onclick = () => {
            const reason = dialog.querySelector('[name="reason"]');
            if (reason && !reason.value.trim()) { reason.focus(); return; }
            const value = reason ? reason.value.trim() : true;
            dialog.close();
            resolve(value);
        };
    });
}

function showPanel(panel) {
    dm.panel = panel;
    dm.offset = 0;
    dm.items = [];
    document.querySelectorAll('[data-dm-panel]').forEach((button) => {
        button.classList.toggle('is-active', button.getAttribute('data-dm-panel') === panel);
    });
    document.querySelector('.dm-shell').classList.remove('dm-open');
    renderPanel();
}

async function startDepartmentApp(payload) {
    dm.role = payload.role;
    if (payload.me) {
        dm.code = payload.me.department_code;
        dm.name = payload.me.department_name;
        document.getElementById('deptTitle').textContent = payload.me.department_name;
        document.getElementById('deptSignedInAs').textContent = payload.me.username;
    }
    document.getElementById('dmRole').textContent = dm.role === 'admin' ? 'Central admin' : 'Department user';
    document.querySelectorAll('.dm-admin-only').forEach((node) => { node.hidden = dm.role !== 'admin'; });
    if (dm.role === 'admin') {
        dm.departments = await dmFetch('/api/departments');
        const pick = document.getElementById('dmDeptPick');
        pick.hidden = false;
        pick.innerHTML = dm.departments.map((dept) => `<option value="${escapeHTML(dept.code)}">${escapeHTML(dept.code)} · ${escapeHTML(dept.name)}</option>`).join('');
        dm.code = pick.value;
        dm.name = (dm.departments.find((dept) => dept.code === dm.code) || {}).name || '';
        document.getElementById('deptTitle').textContent = dm.name;
        pick.onchange = () => {
            dm.code = pick.value;
            dm.name = (dm.departments.find((dept) => dept.code === dm.code) || {}).name || '';
            dm.clubId = null;
            dm.clubNew = false;
            document.getElementById('deptTitle').textContent = dm.name;
            showPanel(dm.panel);
        };
    }
    document.getElementById('dmMenu').onclick = () => document.querySelector('.dm-shell').classList.toggle('dm-open');
    document.querySelector('.dm-backdrop').onclick = () => document.querySelector('.dm-shell').classList.remove('dm-open');
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') document.querySelector('.dm-shell').classList.remove('dm-open');
    });
    document.getElementById('dmCollapse').onclick = (event) => {
        const shell = document.querySelector('.dm-shell');
        shell.classList.toggle('dm-collapsed');
        const collapsed = shell.classList.contains('dm-collapsed');
        event.currentTarget.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
        event.currentTarget.setAttribute('title', collapsed ? 'Expand' : 'Collapse');
    };
    document.querySelectorAll('[data-dm-panel]').forEach((button) => {
        button.onclick = () => showPanel(button.getAttribute('data-dm-panel'));
    });
    showPanel('home');
}

function renderPanel() {
    const main = document.getElementById('dmMain');
    if (dm.panel === 'home') return renderHome(main);
    if (dm.panel === 'details') return renderDetails(main);
    if (dm.panel === 'faculty') return renderFaculty(main);
    if (dm.panel === 'accounts') return renderAccounts(main);
    if (dm.panel === 'approvals') return renderApprovals(main);
    if (dm.panel === 'clubs') return renderOwnClubs(main);
    return renderModule(main, dm.panel);
}

async function renderHome(main) {
    main.innerHTML = `<div class="dm-stats">${'<div class="dm-skel"></div>'.repeat(4)}</div>`;
    try {
        const data = await dmFetch(`/api/department-content/${encodeURIComponent(dm.code)}/summary`);
        const cards = [
            ['Clubs', data.clubs, 'clubs'],
            ['Events', data.events, 'events'],
            ['Notices', data.notices, 'notices'],
            ['Projects', data.projects, 'projects'],
            ['Pending', data.pending, dm.role === 'admin' ? 'approvals' : 'events'],
        ];
        main.innerHTML = `
            <section class="dm-panel">
            <div class="dm-head"><h2>Dashboard</h2></div>
            <div class="dm-stats">${cards.map(([label, count, panel]) => `<button class="dm-card" data-go="${panel}"><span>${label}</span><h3>${count}</h3></button>`).join('')}</div>
            <div class="dm-actions">
                <button class="dm-primary" data-go="events" type="button">Add event</button>
                <button class="dm-soft" data-go="notices" type="button">Add notice</button>
                <a class="dm-soft dp-btn" href="departments.html?department=${encodeURIComponent(dm.code)}" target="_blank" rel="noopener">Preview</a>
            </div>
            <section class="dm-section"><h3>Recent activity</h3><div class="dm-list">${(data.recent || []).map(itemCard).join('') || '<p class="dm-empty">No department content yet.</p>'}</div></section>
            </section>`;
        main.querySelectorAll('[data-go]').forEach((button) => { button.onclick = () => showPanel(button.getAttribute('data-go')); });
    } catch (err) { main.innerHTML = `<p>${escapeHTML(err.message)}</p>`; }
}

function itemCard(item) {
    const title = item.name || item.title || 'Item';
    const status = item.review_status || 'approved';
    return `<article class="dm-card"><span class="dm-status dm-${escapeHTML(status)}">${escapeHTML(status)}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(item.academic_year || item.event_date || item.category || '')}</p></article>`;
}

async function renderDetails(main) {
    main.innerHTML = '<div class="dm-skel"></div>';
    const dept = await dmFetch(`/api/departments/${encodeURIComponent(dm.code)}`);
    const fields = [
        ['name', 'Department name'], ['description', 'Overview'], ['vision', 'Vision'], ['mission', 'Mission'],
        ['course_name', 'Course'], ['duration', 'Duration'], ['intake', 'Intake'], ['eligibility', 'Eligibility'],
        ['labs_text', 'Laboratories'], ['career_text', 'Career paths'], ['phone', 'Phone'], ['email', 'Email'],
        ['other_details', 'Other details'],
    ];
    main.innerHTML = `<form class="dm-card" id="dmProfile"><div class="dm-head"><h2>Department details</h2><a class="dm-soft" href="departments.html?department=${encodeURIComponent(dm.code)}" target="_blank" rel="noopener">Preview</a></div><p>These details publish as soon as you save.</p>${fields.map(([name, label]) => `<label>${label}${name === 'intake' ? `<input name="${name}" type="number" value="${dept[name] == null ? '' : escapeHTML(String(dept[name]))}">` : `<textarea name="${name}">${escapeHTML(dept[name] || '')}</textarea>`}</label>`).join('')}<label>Department photo<input type="file" name="image" accept="image/jpeg,image/png,image/webp"></label><button class="dm-primary" type="submit">Save</button></form>`;
    document.getElementById('dmProfile').onsubmit = async (event) => {
        event.preventDefault();
            const data = new FormData(event.target);
            if (!data.get('image') || !data.get('image').name) data.delete('image');
            if (!String(data.get('intake') || '').trim()) data.delete('intake');
        try {
            await dmFetch(`/api/department-content/${encodeURIComponent(dm.code)}/profile`, { method: 'PATCH', body: data });
            dmToast('Department details saved.');
        } catch (err) { dmToast(err.message); }
    };
}

async function renderFaculty(main) {
    main.innerHTML = '<div class="dm-skel"></div>';
    const people = await dmFetch(`/api/staff?department=${encodeURIComponent(dm.code)}`);
    const dept = dm.departments.find((item) => item.code === dm.code) || await dmFetch(`/api/departments/${encodeURIComponent(dm.code)}`);
    const cards = people.map((person) => {
        const photo = person.photo_url ? `<img src="${escapeHTML(person.photo_url)}" alt="" style="width:3rem;height:3rem;border-radius:50%;object-fit:cover">` : '';
        const actions = `<div class="dm-actions"><button class="dm-soft" data-edit="${person.id}" type="button">Edit</button><button class="dm-danger" data-del="${person.id}" type="button">Delete</button></div>`;
        const meta = [person.role, person.designation, person.email].filter(Boolean).join(' · ');
        return `<article class="dm-card">${photo}<h3>${escapeHTML(person.name)}</h3><p>${escapeHTML(meta)}</p>${actions}</article>`;
    }).join('') || '<p class="dm-empty">No faculty yet.</p>';
    main.innerHTML = `<section class="dm-panel"><div class="dm-head"><h2>HOD and faculty</h2><button class="dm-primary" id="dmAddFaculty" type="button">Add new</button></div><div class="dm-list">${cards}</div></section>`;
    const open = (person) => openFacultyForm(dept.id, person);
    document.getElementById('dmAddFaculty').onclick = () => open(null);
    main.querySelectorAll('[data-edit]').forEach((button) => { button.onclick = () => open(people.find((person) => String(person.id) === button.getAttribute('data-edit'))); });
    main.querySelectorAll('[data-del]').forEach((button) => {
        button.onclick = async () => {
            if (!await dmAsk('Delete this faculty member?')) return;
            try {
                await dmFetch(`/api/staff/${button.getAttribute('data-del')}`, { method: 'DELETE' });
                dmToast('Faculty member removed.');
                renderFaculty(main);
            } catch (err) { dmToast(err.message); }
        };
    });
}

function openFacultyForm(departmentId, person) {
    const dialog = document.getElementById('dmSheet');
    dialog.innerHTML = `<form><h2>${person ? 'Edit faculty' : 'Add faculty'}</h2>
        <label>Name<input name="name" required value="${escapeHTML(person && person.name || '')}"></label>
        <label>Role<select name="role"><option>Faculty</option><option ${person && person.role === 'HOD' ? 'selected' : ''}>HOD</option></select></label>
        <label>Designation<input name="designation" required value="${escapeHTML(person && person.designation || '')}"></label>
        <label>Qualification<input name="qualification" value="${escapeHTML(person && person.qualification || '')}"></label>
        <label>Email<input name="email" type="email" required value="${escapeHTML(person && person.email || '')}"></label>
        <label>Phone<input name="phone" value="${escapeHTML(person && person.phone || '')}"></label>
        <label>In charge<input name="is_in_charge" type="checkbox" ${person && person.is_in_charge ? 'checked' : ''}></label>
        <label>Photo<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <div class="dm-actions"><button class="dm-soft" type="button" id="dmClose">Cancel</button><button class="dm-primary" type="submit">Save</button></div></form>`;
    dialog.showModal();
    dialog.querySelector('#dmClose').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.target);
        data.set('department_id', departmentId);
        data.set('is_in_charge', event.target.is_in_charge.checked ? '1' : '0');
        data.set('is_active', '1');
        if (!data.get('photo') || !data.get('photo').name) data.delete('photo');
        try {
            await dmFetch(person ? `/api/staff/${person.id}` : '/api/staff', { method: person ? 'PATCH' : 'POST', body: data });
            dialog.close();
            dmToast('Faculty saved.');
            renderFaculty(document.getElementById('dmMain'));
        } catch (err) { dmToast(err.message); }
    };
}

function moduleQuery() {
    const params = new URLSearchParams();
    const search = document.getElementById('dmSearch');
    const status = document.getElementById('dmStatus');
    const year = document.getElementById('dmYear');
    const category = document.getElementById('dmCategory');
    const words = [search && search.value, category && category.value].filter(Boolean).join(' ');
    if (words) params.set('search', words);
    if (status && status.value) params.set('status', status.value);
    if (year && year.value) params.set('academic_year', year.value);
    params.set('limit', '8');
    params.set('offset', String(dm.offset));
    return params.toString();
}

async function renderOwnClubs(main) {
    main.innerHTML = '<div class="dm-skel"></div>';
    let clubs = [];
    try { clubs = await dmFetch(`/api/department-clubs?code=${encodeURIComponent(dm.code)}`); }
    catch (err) { main.innerHTML = `<p>${escapeHTML(err.message)}</p>`; return; }
    const selected = clubs.find((club) => club.id === dm.clubId);
    if (!selected && !dm.clubNew) {
        main.innerHTML = `<section class="dm-panel"><div class="dm-head"><h2>Student clubs</h2><button class="dm-primary" id="dmAddClub" type="button">Add club</button></div><p>These clubs belong to ${escapeHTML(dm.name || dm.code)} and also appear on the public clubs page when published.</p><div class="dm-list">${clubs.map((club) => `<article class="dm-card"><span class="dm-status dm-${club.status === 'published' ? 'approved' : 'pending'}">${escapeHTML(club.status || 'draft')}</span><h3>${escapeHTML(club.name)}</h3><p>${escapeHTML(club.category || '')}</p><div class="dm-actions"><button class="dm-soft" data-edit="${club.id}" type="button">Edit</button>${club.status === 'published' ? `<a class="dm-soft" href="clubs.html#${escapeHTML(club.slug)}" target="_blank" rel="noopener">Preview</a>` : ''}<button class="dm-danger" data-del="${club.id}" type="button">Delete</button></div></article>`).join('') || '<p class="dm-empty">No student clubs have been added to this department yet.</p>'}</div></section>`;
        document.getElementById('dmAddClub').onclick = () => { dm.clubNew = true; dm.clubId = null; renderOwnClubs(main); };
        main.querySelectorAll('[data-edit]').forEach((button) => { button.onclick = () => { dm.clubId = Number(button.getAttribute('data-edit')); dm.clubNew = false; renderOwnClubs(main); }; });
        main.querySelectorAll('[data-del]').forEach((button) => { button.onclick = () => deleteOwnClub(button.getAttribute('data-del'), main); });
        return;
    }
    const club = selected || {};
    const categories = ['Technical', 'Cultural', 'Sports', 'Arts', 'Music', 'Social', 'Other'];
    main.innerHTML = `<section class="dm-panel"><div class="dm-head"><h2>${selected ? 'Edit club' : 'Add club'}</h2><button class="dm-soft" id="dmClubBack" type="button">Back</button></div>
        <form id="dmClubForm" class="dm-form">
            <label>Club name<input name="name" required value="${escapeHTML(club.name || '')}"></label>
            <label>Category<select name="category">${categories.map((item) => `<option ${item === club.category ? 'selected' : ''}>${item}</option>`).join('')}</select></label>
            <label>Status<select name="status"><option value="published" ${club.status === 'published' ? 'selected' : ''}>Published</option><option value="draft" ${!club.status || club.status === 'draft' ? 'selected' : ''}>Draft</option><option value="inactive" ${club.status === 'inactive' ? 'selected' : ''}>Inactive</option></select></label>
            <label>Display order<input name="display_order" type="number" value="${club.display_order || 0}"></label>
            <label>Short introduction<textarea name="intro">${escapeHTML(club.intro || '')}</textarea></label>
            <label>Full description<textarea name="description">${escapeHTML(club.description || '')}</textarea></label>
            <label>Objectives<textarea name="objectives">${escapeHTML(club.objectives || '')}</textarea></label>
            <label>Activities and programs<textarea name="activities_text">${escapeHTML(club.activities_text || '')}</textarea></label>
            <label>Meeting schedule<textarea name="meeting_info">${escapeHTML(club.meeting_info || '')}</textarea></label>
            <label>Established<input name="established_on" value="${escapeHTML(club.established_on || '')}"></label>
            <label>Coordinator<input name="coordinator" value="${escapeHTML(club.coordinator || '')}"></label>
            <label>Faculty in charge<input name="faculty_in_charge" value="${escapeHTML(club.faculty_in_charge || '')}"></label>
            <label>Contact (private)<input name="contact_info" value="${escapeHTML(club.contact_info || '')}"></label>
            <label>Logo<input name="logo" type="file" accept="image/jpeg,image/png,image/webp"></label>
            <label>Cover photograph<input name="cover" type="file" accept="image/jpeg,image/png,image/webp"></label>
            <button class="dm-primary" type="submit">Save</button>
        </form>
        ${selected ? `<form id="dmMemberForm"><h3>Members</h3><label>Name<input name="name" required></label><label>Role<input name="role" value="Member"></label><label>Admission number (private)<input name="admission_number"></label><label>Photograph<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><button class="dm-primary" type="submit">Add member</button></form>
        <div class="dm-list">${(club.members || []).map((member) => `<article class="dm-card"><h3>${escapeHTML(member.name)}</h3><p>${escapeHTML(member.role || '')}</p><button class="dm-danger" data-member="${member.id}" type="button">Remove</button></article>`).join('') || '<p class="dm-empty">No members yet.</p>'}</div>
        <form id="dmActivityForm"><h3>Activities</h3><p>These are club activities, not official college events.</p><label>Title<input name="title" required></label><label>Date<input name="event_date" type="date"></label><label>Venue<input name="venue"></label><label>Description<textarea name="description"></textarea></label><label>Status<select name="is_published"><option value="0">Draft</option><option value="1">Published</option></select></label><button class="dm-primary" type="submit">Add activity</button></form>
        <div class="dm-list">${(club.activities || []).map((item) => `<article class="dm-card"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.status || '')}</p><button class="dm-danger" data-activity="${item.id}" type="button">Delete</button></article>`).join('') || '<p class="dm-empty">No activities yet.</p>'}</div>
        <form id="dmGalleryForm"><h3>Gallery</h3><label>Caption<input name="caption"></label><label>Alternative text<input name="alt_text"></label><label>Status<select name="is_published"><option value="0">Draft</option><option value="1">Published</option></select></label><label>Photograph<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="dm-primary" type="submit">Upload</button></form>
        <div class="dm-list">${(club.images || []).map((item) => `<article class="dm-card">${item.image_url ? `<img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.alt_text || '')}">` : ''}<p>${escapeHTML(item.caption || 'Photograph')}</p><button class="dm-danger" data-image="${item.id}" type="button">Delete</button></article>`).join('') || '<p class="dm-empty">No photographs yet.</p>'}</div>` : ''}</section>`;
    document.getElementById('dmClubBack').onclick = () => { dm.clubId = null; dm.clubNew = false; renderOwnClubs(main); };
    document.getElementById('dmClubForm').onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.target);
        data.set('code', dm.code);
        if (!data.get('logo') || !data.get('logo').name) data.delete('logo');
        if (!data.get('cover') || !data.get('cover').name) data.delete('cover');
        try {
            const saved = await dmFetch(selected ? `/api/department-clubs/${selected.id}` : '/api/department-clubs', { method: selected ? 'PATCH' : 'POST', body: data });
            dm.clubId = saved.id;
            dm.clubNew = false;
            dmToast('Club saved.');
            renderOwnClubs(main);
        } catch (err) { dmToast(err.message); }
    };
    const memberForm = document.getElementById('dmMemberForm');
    if (!memberForm) return;
    memberForm.onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.target);
        data.set('code', dm.code);
        if (!data.get('photo') || !data.get('photo').name) data.delete('photo');
        try { await dmFetch(`/api/department-clubs/${selected.id}/members`, { method: 'POST', body: data }); dmToast('Member added.'); renderOwnClubs(main); }
        catch (err) { dmToast(err.message); }
    };
    document.getElementById('dmActivityForm').onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.target);
        data.set('code', dm.code);
        try { await dmFetch(`/api/department-clubs/${selected.id}/activities`, { method: 'POST', body: data }); dmToast('Activity added.'); renderOwnClubs(main); }
        catch (err) { dmToast(err.message); }
    };
    document.getElementById('dmGalleryForm').onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.target);
        data.set('code', dm.code);
        try { await dmFetch(`/api/department-clubs/${selected.id}/gallery`, { method: 'POST', body: data }); dmToast('Photograph added.'); renderOwnClubs(main); }
        catch (err) { dmToast(err.message); }
    };
    main.querySelectorAll('[data-member]').forEach((button) => { button.onclick = () => removeOwnPiece(selected.id, 'members', button.getAttribute('data-member'), main); });
    main.querySelectorAll('[data-activity]').forEach((button) => { button.onclick = () => removeOwnPiece(selected.id, 'activities', button.getAttribute('data-activity'), main); });
    main.querySelectorAll('[data-image]').forEach((button) => { button.onclick = () => removeOwnPiece(selected.id, 'gallery', button.getAttribute('data-image'), main); });
}

async function deleteOwnClub(id, main) {
    if (!await dmAsk('Delete this club? Its activities, members, and photographs will be removed.')) return;
    try {
        await dmFetch(`/api/department-clubs/${id}?code=${encodeURIComponent(dm.code)}`, { method: 'DELETE' });
        dm.clubId = null;
        dmToast('Club deleted.');
        renderOwnClubs(main);
    } catch (err) { dmToast(err.message); }
}

async function removeOwnPiece(clubId, kind, id, main) {
    if (!await dmAsk('Remove this item?')) return;
    try {
        await dmFetch(`/api/department-clubs/${clubId}/${kind}/${id}?code=${encodeURIComponent(dm.code)}`, { method: 'DELETE' });
        dmToast('Removed.');
        renderOwnClubs(main);
    } catch (err) { dmToast(err.message); }
}

async function renderModule(main, kind) {
    const mod = DM_MODULES[kind];
    if (!dm.offset) {
        main.innerHTML = `<section class="dm-panel"><div class="dm-head"><h2>${escapeHTML(mod.title)}</h2><button class="dm-primary" id="dmAdd" type="button">Add new</button></div>
            <div class="dm-filters"><label>Search<input id="dmSearch" type="search"></label><label>Status<select id="dmStatus"><option value="">All</option><option>draft</option><option>pending</option><option>approved</option><option>rejected</option></select></label><label>Year<input id="dmYear" placeholder="2025-26"></label><label>Category<input id="dmCategory"></label></div>
            <div id="dmCards"><div class="dm-skel"></div></div><button class="dm-soft" id="dmMore" type="button" hidden>Load more</button></section>`;
        document.getElementById('dmAdd').onclick = () => openModuleForm(kind, null);
        ['dmSearch', 'dmStatus', 'dmYear', 'dmCategory'].forEach((id) => {
            document.getElementById(id).onchange = () => { dm.offset = 0; dm.items = []; loadModule(kind); };
        });
        document.getElementById('dmMore').onclick = () => { dm.offset += 8; loadModule(kind); };
    }
    loadModule(kind);
}

async function loadModule(kind) {
    const box = document.getElementById('dmCards');
    if (!box) return;
    try {
        const page = await dmFetch(`/api/department-content/${encodeURIComponent(dm.code)}/${kind}?${moduleQuery()}`);
        dm.total = page.total;
        dm.items = dm.offset ? dm.items.concat(page.items) : page.items;
        box.innerHTML = dm.items.map((item) => moduleCard(kind, item)).join('') || '<p class="dm-empty">Nothing here yet.</p>';
        const more = document.getElementById('dmMore');
        if (more) more.hidden = dm.items.length >= dm.total;
        box.querySelectorAll('[data-edit]').forEach((button) => { button.onclick = () => openModuleForm(kind, dm.items.find((item) => String(item.id) === button.getAttribute('data-edit'))); });
        box.querySelectorAll('[data-del]').forEach((button) => { button.onclick = () => removeModuleItem(kind, button.getAttribute('data-del')); });
        box.querySelectorAll('[data-submit]').forEach((button) => { button.onclick = () => submitModuleItem(kind, button.getAttribute('data-submit')); });
    } catch (err) { box.innerHTML = `<p>${escapeHTML(err.message)}</p>`; }
}

function moduleCard(kind, item) {
    const status = item.review_status || 'approved';
    return `<article class="dm-card"><span class="dm-status dm-${escapeHTML(status)}">${escapeHTML(status)}</span><h3>${escapeHTML(item.name || item.title || 'Photo')}</h3><p>${escapeHTML(item.rejection_reason || item.event_date || item.category || item.academic_year || '')}</p><div class="dm-actions"><button class="dm-soft" data-edit="${item.id}" type="button">Edit</button>${status === 'rejected' || status === 'draft' ? `<button class="dm-soft" data-submit="${item.id}" type="button">Submit</button>` : ''}<button class="dm-danger" data-del="${item.id}" type="button">Delete</button></div></article>`;
}

function fieldHTML(field, item) {
    const [name, label, type, required, extra, multiple] = field;
    const value = item && item[name] != null ? item[name] : '';
    if (type === 'textarea') return `<label>${label}<textarea name="${name}">${escapeHTML(String(value || ''))}</textarea></label>`;
    if (type === 'select') {
        const optionLabel = (option) => option === '1' ? 'Active' : option === '0' ? 'Inactive' : option;
        const current = value === '' || value == null ? '1' : String(value);
        return `<label>${label}<select name="${name}">${extra.map((option) => `<option value="${escapeHTML(option)}" ${option === current ? 'selected' : ''}>${escapeHTML(optionLabel(option))}</option>`).join('')}</select></label>`;
    }
    if (type === 'club') {
        const clubs = window.__dmClubs || [];
        return `<label>${label}<select name="${name}"><option value="">None</option>${clubs.map((club) => `<option value="${club.id}" ${String(club.id) === String(value) ? 'selected' : ''}>${escapeHTML(club.name)}</option>`).join('')}</select></label>`;
    }
    if (type === 'file') return `<label>${label}<input name="${name}" type="file" accept="${extra || ''}" ${multiple ? 'multiple' : ''}></label>`;
    if (type === 'members') {
        const members = item && item.members && item.members.length ? item.members : [{ name: '', role: '', year_label: '' }];
        return `<div id="dmMembers"><span>${label}</span>${members.map((member) => memberRow(member)).join('')}<button class="dm-soft" type="button" id="dmAddMember">Add member</button></div>`;
    }
    return `<label>${label}<input name="${name}" type="${type}" ${required ? 'required' : ''} value="${escapeHTML(String(value || ''))}"></label>`;
}

function memberRow(member) {
    return `<div class="dm-member"><input name="member_name" placeholder="Name" value="${escapeHTML(member.name || '')}"><input name="member_role" placeholder="Role" value="${escapeHTML(member.role || '')}"><input name="member_year" placeholder="Year" value="${escapeHTML(member.year_label || '')}"><input name="member_semester" placeholder="Semester" value="${escapeHTML(member.semester || '')}"><input name="member_admission" placeholder="Admission number (private)" value="${escapeHTML(member.admission_number || '')}"></div>`;
}

async function openModuleForm(kind, item) {
    if (kind === 'events') {
        try {
            const page = await dmFetch(`/api/department-content/${encodeURIComponent(dm.code)}/clubs?limit=100`);
            window.__dmClubs = page.items || [];
        } catch (err) {
            window.__dmClubs = [];
        }
    }
    const dialog = document.getElementById('dmSheet');
    const mod = DM_MODULES[kind];
    dialog.innerHTML = `<form><h2>${item ? 'Edit' : 'Add'} ${escapeHTML(mod.title)}</h2>${mod.fields.map((field) => fieldHTML(field, item)).join('')}<div class="dm-actions"><button class="dm-soft" type="button" id="dmClose">Cancel</button><button class="dm-primary" type="submit">Save</button></div></form>`;
    dialog.showModal();
    const addMember = dialog.querySelector('#dmAddMember');
    if (addMember) addMember.onclick = () => addMember.insertAdjacentHTML('beforebegin', memberRow({}));
    dialog.querySelector('#dmClose').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData();
        mod.fields.forEach((field) => {
            const [name, , type, , , multiple] = field;
            if (type === 'members') {
                const rows = [...dialog.querySelectorAll('.dm-member')].map((row) => ({
                    name: row.querySelector('[name="member_name"]').value.trim(),
                    role: row.querySelector('[name="member_role"]').value.trim(),
                    year_label: row.querySelector('[name="member_year"]').value.trim(),
                    semester: row.querySelector('[name="member_semester"]').value.trim(),
                    admission_number: row.querySelector('[name="member_admission"]').value.trim(),
                })).filter((member) => member.name);
                data.set('members', JSON.stringify(rows));
            } else if (type === 'file') {
                const input = dialog.querySelector(`[name="${name}"]`);
                [...input.files].forEach((file) => data.append(name, file));
            } else data.set(name, dialog.querySelector(`[name="${name}"]`).value);
        });
        try {
            await dmFetch(`/api/department-content/${encodeURIComponent(dm.code)}/${kind}${item ? '/' + item.id : ''}`, { method: item ? 'PATCH' : 'POST', body: data });
            dialog.close();
            dmToast(dm.role === 'admin' || kind === 'clubs' ? 'Saved and published.' : 'Saved and sent for approval.');
            dm.offset = 0;
            renderModule(document.getElementById('dmMain'), kind);
        } catch (err) { dmToast(err.message); }
    };
}

async function removeModuleItem(kind, id) {
    if (!await dmAsk('Delete this item?')) return;
    try {
        await dmFetch(`/api/department-content/${encodeURIComponent(dm.code)}/${kind}/${id}`, { method: 'DELETE' });
        dmToast('Deleted.');
        dm.offset = 0;
        renderModule(document.getElementById('dmMain'), kind);
    } catch (err) { dmToast(err.message); }
}

async function submitModuleItem(kind, id) {
    try {
        await dmFetch(`/api/department-content/${encodeURIComponent(dm.code)}/${kind}/${id}/submit`, { method: 'POST' });
        dmToast('Sent for approval.');
        dm.offset = 0;
        renderModule(document.getElementById('dmMain'), kind);
    } catch (err) { dmToast(err.message); }
}

async function renderAccounts(main) {
    if (dm.role !== 'admin') { main.innerHTML = '<p>Login accounts are for the central admin.</p>'; return; }
    main.innerHTML = '<div class="dm-skel"></div>';
    const [users, depts] = await Promise.all([
        dmFetch('/api/admin/department-users'),
        dmFetch('/api/departments'),
    ]);
    const counts = {};
    users.forEach((user) => { counts[user.department_id] = (counts[user.department_id] || 0) + 1; });
    const groups = depts.map((dept) => {
        const count = counts[dept.id] || 0;
        const people = users.filter((user) => user.department_id === dept.id);
        const cards = people.map((user) => `<article class="dm-card"><span class="dm-status ${user.is_active ? 'dm-approved' : 'dm-rejected'}">${user.is_active ? 'Active' : 'Inactive'}</span><h3>${escapeHTML(user.name || user.username)}</h3><p>${escapeHTML([user.designation, user.email, user.username].filter(Boolean).join(' · '))}</p><div class="dm-actions"><button class="dm-soft" data-user="${user.id}" type="button">Edit</button><button class="dm-soft" data-pass="${user.id}" type="button">Reset password</button><button class="dm-danger" data-state="${user.id}" data-active="${user.is_active ? 0 : 1}" type="button">${user.is_active ? 'Deactivate' : 'Activate'}</button><button class="dm-danger" data-remove="${user.id}" type="button">Remove</button></div></article>`).join('') || '<p class="dm-empty">No login yet.</p>';
        const add = count >= 3
            ? '<button class="dm-soft" type="button" disabled>Department users: 3 / 3</button>'
            : `<button class="dm-primary" type="button" data-add="${dept.id}">Add department user</button>`;
        return `<section class="dm-panel"><div class="dm-head"><h2>${escapeHTML(dept.name)}</h2>${add}</div><p>Department users: ${count} / 3. Inactive accounts still count toward the limit.</p><div class="dm-list">${cards}</div></section>`;
    }).join('');
    main.innerHTML = groups;
    main.querySelectorAll('[data-add]').forEach((button) => { button.onclick = () => accountForm(depts, Number(button.getAttribute('data-add'))); });
    main.querySelectorAll('[data-user]').forEach((button) => { button.onclick = () => editAccount(users.find((user) => String(user.id) === button.getAttribute('data-user'))); });
    main.querySelectorAll('[data-pass]').forEach((button) => { button.onclick = () => resetAccount(button.getAttribute('data-pass')); });
    main.querySelectorAll('[data-state]').forEach((button) => {
        button.onclick = async () => {
            const active = button.getAttribute('data-active') === '1';
            if (!active && !await dmAsk('Deactivate this login?')) return;
            try {
                await dmFetch(`/api/admin/department-users/${button.getAttribute('data-state')}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: active ? 1 : 0 }) });
                dmToast(active ? 'Account activated.' : 'Account deactivated.');
                renderAccounts(main);
            } catch (err) { dmToast(err.message); }
        };
    });
    main.querySelectorAll('[data-remove]').forEach((button) => {
        button.onclick = async () => {
            if (!await dmAsk('Remove this department login? The department itself stays.')) return;
            try {
                await dmFetch(`/api/admin/department-users/${button.getAttribute('data-remove')}`, { method: 'DELETE' });
                dmToast('Login removed.');
                renderAccounts(main);
            } catch (err) { dmToast(err.message); }
        };
    });
}

function accountForm(depts, departmentId) {
    const dialog = document.getElementById('dmSheet');
    dialog.innerHTML = `<form><h2>New department user</h2><label>Department<select name="department_id">${depts.map((dept) => `<option value="${dept.id}" ${dept.id === departmentId ? 'selected' : ''}>${escapeHTML(dept.code)} · ${escapeHTML(dept.name)}</option>`).join('')}</select></label><label>Name<input name="name" required></label><label>Designation<input name="designation" required placeholder="Head of Department, Lecturer, Faculty in-charge"></label><label>Email<input name="email" type="email" required></label><label>Username (optional)<input name="username" maxlength="32"></label><label>Password<input name="password" type="password" required></label><label>Confirm password<input name="confirm_password" type="password" required></label><p>Use 8 or more characters with upper and lower case, a number, and a symbol. The person can sign in with the username or the email.</p><div class="dm-actions"><button class="dm-soft" type="button" id="dmClose">Cancel</button><button class="dm-primary" type="submit">Create</button></div></form>`;
    dialog.showModal();
    dialog.querySelector('#dmClose').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = async (event) => {
        event.preventDefault();
        const body = Object.fromEntries(new FormData(event.target).entries());
        body.department_id = Number(body.department_id);
        if (!String(body.username || '').trim()) delete body.username;
        try {
            await dmFetch('/api/admin/department-users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            dialog.close();
            dmToast('Login created.');
            renderAccounts(document.getElementById('dmMain'));
        } catch (err) { dmToast(err.message); }
    };
}

function editAccount(user) {
    if (!user) return;
    const dialog = document.getElementById('dmSheet');
    dialog.innerHTML = `<form><h2>Edit department user</h2><label>Name<input name="name" required value="${escapeHTML(user.name || '')}"></label><label>Designation<input name="designation" required value="${escapeHTML(user.designation || '')}"></label><label>Email<input name="email" type="email" required value="${escapeHTML(user.email || '')}"></label><label>Username<input name="username" required maxlength="32" value="${escapeHTML(user.username || '')}"></label><div class="dm-actions"><button class="dm-soft" type="button" id="dmClose">Cancel</button><button class="dm-primary" type="submit">Save</button></div></form>`;
    dialog.showModal();
    dialog.querySelector('#dmClose').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = async (event) => {
        event.preventDefault();
        const body = Object.fromEntries(new FormData(event.target).entries());
        try {
            await dmFetch(`/api/admin/department-users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            dialog.close();
            dmToast('Account updated.');
            renderAccounts(document.getElementById('dmMain'));
        } catch (err) { dmToast(err.message); }
    };
}

async function resetAccount(id) {
    const dialog = document.getElementById('dmSheet');
    dialog.innerHTML = `<form><h2>Reset password</h2><label>New password<input name="password" type="password" required></label><label>Confirm password<input name="confirm_password" type="password" required></label><div class="dm-actions"><button class="dm-soft" type="button" id="dmClose">Cancel</button><button class="dm-primary" type="submit">Reset</button></div></form>`;
    dialog.showModal();
    dialog.querySelector('#dmClose').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = async (event) => {
        event.preventDefault();
        const body = Object.fromEntries(new FormData(event.target).entries());
        try {
            await dmFetch(`/api/admin/department-users/${id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            dialog.close();
            dmToast('Password reset.');
        } catch (err) { dmToast(err.message); }
    };
}

async function renderApprovals(main) {
    if (dm.role !== 'admin') { main.innerHTML = '<p>Approvals are for the central admin.</p>'; return; }
    main.innerHTML = '<div class="dm-skel"></div>';
    const page = await dmFetch('/api/department-content/approvals');
    main.innerHTML = `<section class="dm-panel"><div class="dm-head"><h2>Approvals</h2></div><div class="dm-list">${(page.items || []).map((item) => `<article class="dm-card"><span class="dm-status dm-pending">Pending</span><h3>${escapeHTML(item.name || item.title || 'Photo')}</h3><p>${escapeHTML(item.kind)} · ${escapeHTML(item.description || item.summary || item.objectives || '')}</p><div class="dm-actions"><button class="dm-primary" data-approve="${item.kind}:${item.id}" type="button">Approve</button><button class="dm-danger" data-reject="${item.kind}:${item.id}" type="button">Reject</button></div></article>`).join('') || '<p class="dm-empty">No items are waiting.</p>'}</div></section>`;
    main.querySelectorAll('[data-approve]').forEach((button) => { button.onclick = () => decide(button.getAttribute('data-approve'), true); });
    main.querySelectorAll('[data-reject]').forEach((button) => { button.onclick = () => decide(button.getAttribute('data-reject'), false); });
}

async function decide(key, approve) {
    const [kind, id] = key.split(':');
    try {
        if (approve) {
            await dmFetch(`/api/department-content/approvals/${kind}/${id}/approve`, { method: 'POST' });
            dmToast('Approved.');
        } else {
            const reason = await dmAsk('Reject this item?', true);
            if (!reason) return;
            await dmFetch(`/api/department-content/approvals/${kind}/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
            dmToast('Rejected.');
        }
        renderApprovals(document.getElementById('dmMain'));
    } catch (err) { dmToast(err.message); }
}

window.startDepartmentApp = startDepartmentApp;
window.dmIsAdmin = dmIsAdmin;
