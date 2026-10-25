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
            ['coordinator', 'Coordinator', 'text'],
            ['objectives', 'Objectives', 'textarea'],
            ['activities', 'Activities', 'textarea'],
            ['academic_year', 'Academic year', 'text'],
            ['members', 'Student members', 'members'],
            ['logo', 'Logo or photo', 'file', false, 'image/jpeg,image/png,image/webp'],
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
    const canEdit = dm.role === 'admin';
    const cards = people.map((person) => {
        const photo = person.photo_url ? `<img src="${escapeHTML(person.photo_url)}" alt="" style="width:3rem;height:3rem;border-radius:50%;object-fit:cover">` : '';
        const actions = canEdit ? `<div class="dm-actions"><button class="dm-soft" data-edit="${person.id}" type="button">Edit</button><button class="dm-danger" data-del="${person.id}" type="button">Delete</button></div>` : '';
        return `<article class="dm-card">${photo}<h3>${escapeHTML(person.name)}</h3><p>${escapeHTML(person.role || '')}</p>${actions}</article>`;
    }).join('') || '<p class="dm-empty">No faculty yet.</p>';
    const add = canEdit ? '<button class="dm-primary" id="dmAddFaculty" type="button">Add new</button>' : '';
    const note = canEdit ? '' : '<p>HOD and faculty details are managed by the administrator.</p>';
    main.innerHTML = `<section class="dm-panel"><div class="dm-head"><h2>HOD and faculty</h2>${add}</div>${note}<div class="dm-list">${cards}</div></section>`;
    if (!canEdit) return;
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
    if (dm.role !== 'admin') return;
    const dialog = document.getElementById('dmSheet');
    dialog.innerHTML = `<form><h2>${person ? 'Edit faculty' : 'Add faculty'}</h2>
        <label>Name<input name="name" required value="${escapeHTML(person && person.name || '')}"></label>
        <label>Role<select name="role"><option>Faculty</option><option ${person && person.role === 'HOD' ? 'selected' : ''}>HOD</option></select></label>
        <label>Designation<input name="designation" value="${escapeHTML(person && person.designation || '')}"></label>
        <label>Qualification<input name="qualification" value="${escapeHTML(person && person.qualification || '')}"></label>
        <label>Email<input name="email" type="email" value="${escapeHTML(person && person.email || '')}"></label>
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
    if (type === 'select') return `<label>${label}<select name="${name}">${extra.map((option) => `<option ${option === value ? 'selected' : ''}>${escapeHTML(option)}</option>`).join('')}</select></label>`;
    if (type === 'file') return `<label>${label}<input name="${name}" type="file" accept="${extra || ''}" ${multiple ? 'multiple' : ''}></label>`;
    if (type === 'members') {
        const members = item && item.members && item.members.length ? item.members : [{ name: '', role: '', year_label: '' }];
        return `<div id="dmMembers"><span>${label}</span>${members.map((member) => memberRow(member)).join('')}<button class="dm-soft" type="button" id="dmAddMember">Add member</button></div>`;
    }
    return `<label>${label}<input name="${name}" type="${type}" ${required ? 'required' : ''} value="${escapeHTML(String(value || ''))}"></label>`;
}

function memberRow(member) {
    return `<div class="dm-member"><input name="member_name" placeholder="Name" value="${escapeHTML(member.name || '')}"><input name="member_role" placeholder="Role" value="${escapeHTML(member.role || '')}"><input name="member_year" placeholder="Year" value="${escapeHTML(member.year_label || '')}"></div>`;
}

function openModuleForm(kind, item) {
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
            dmToast(dm.role === 'admin' ? 'Saved and published.' : 'Saved and sent for approval.');
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
    main.innerHTML = `<section class="dm-panel"><div class="dm-head"><h2>Login accounts</h2><button class="dm-primary" id="dmAddUser" type="button">Add new</button></div><div class="dm-list">${users.map((user) => `<article class="dm-card"><span class="dm-status ${user.is_active ? 'dm-approved' : 'dm-rejected'}">${user.is_active ? 'Active' : 'Inactive'}</span><h3>${escapeHTML(user.username)}</h3><p>${escapeHTML(user.department_code)} · ${escapeHTML(user.department_name)}</p><div class="dm-actions"><button class="dm-soft" data-user="${user.id}" type="button">Username</button><button class="dm-soft" data-pass="${user.id}" type="button">Reset password</button><button class="dm-danger" data-state="${user.id}" data-active="${user.is_active ? 0 : 1}" type="button">${user.is_active ? 'Deactivate' : 'Activate'}</button></div></article>`).join('') || '<p class="dm-empty">No department logins yet.</p>'}</div></section>`;
    document.getElementById('dmAddUser').onclick = () => accountForm(depts);
    main.querySelectorAll('[data-user]').forEach((button) => { button.onclick = () => renameAccount(button.getAttribute('data-user')); });
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
}

function accountForm(depts) {
    const dialog = document.getElementById('dmSheet');
    dialog.innerHTML = `<form><h2>New login</h2><label>Department<select name="department_id">${depts.map((dept) => `<option value="${dept.id}">${escapeHTML(dept.code)} · ${escapeHTML(dept.name)}</option>`).join('')}</select></label><label>Username<input name="username" required></label><label>Password<input name="password" type="password" required></label><label>Confirm password<input name="confirm_password" type="password" required></label><p>Use 8 or more characters with upper and lower case, a number, and a symbol.</p><div class="dm-actions"><button class="dm-soft" type="button" id="dmClose">Cancel</button><button class="dm-primary" type="submit">Create</button></div></form>`;
    dialog.showModal();
    dialog.querySelector('#dmClose').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = async (event) => {
        event.preventDefault();
        const body = Object.fromEntries(new FormData(event.target).entries());
        body.department_id = Number(body.department_id);
        try {
            await dmFetch('/api/admin/department-users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            dialog.close();
            dmToast('Login created.');
            renderAccounts(document.getElementById('dmMain'));
        } catch (err) { dmToast(err.message); }
    };
}

async function renameAccount(id) {
    const dialog = document.getElementById('dmSheet');
    dialog.innerHTML = `<form><h2>Change username</h2><label>Username<input name="username" required></label><div class="dm-actions"><button class="dm-soft" type="button" id="dmClose">Cancel</button><button class="dm-primary" type="submit">Save</button></div></form>`;
    dialog.showModal();
    dialog.querySelector('#dmClose').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = async (event) => {
        event.preventDefault();
        try {
            await dmFetch(`/api/admin/department-users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: new FormData(event.target).get('username') }) });
            dialog.close();
            dmToast('Username updated.');
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
