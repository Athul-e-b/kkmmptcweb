function clubStatusLabel(club) {
    const status = club.status || (club.is_published ? 'published' : 'draft');
    const tone = status === 'published' ? 'bg-emerald-100 text-emerald-800' : status === 'inactive' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800';
    return `<span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${tone}">${escapeHTML(status)}</span>`;
}

function clubSelect(name, label, value, options) {
    return `<label class="block text-xs font-semibold text-slate-700">${label}<select name="${name}" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white">${options.map((option) => `<option value="${escapeHTML(option.value)}" ${String(option.value) === String(value || '') ? 'selected' : ''}>${escapeHTML(option.label)}</option>`).join('')}</select></label>`;
}

function renderClubsAdmin() {
    const box = document.getElementById('clubsAdmin');
    const selected = cmsClubId ? cmsClubsData.find((club) => club.id === cmsClubId) : null;
    if (!cmsClubEditing) {
        const search = (document.getElementById('clubSearch') || {}).value || '';
        const category = (document.getElementById('clubCategoryFilter') || {}).value || '';
        const rows = cmsClubsData.filter((club) => {
            const words = `${club.name} ${club.category || ''} ${club.club_type || ''} ${club.department_name || ''}`.toLowerCase();
            return (!search || words.includes(search.toLowerCase())) && (!category || club.category === category);
        });
        box.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="font-heading font-bold text-lg">Clubs Management</h2>
                    <p class="text-xs text-slate-500">${cmsClubsData.length} club${cmsClubsData.length === 1 ? '' : 's'}. Campus clubs and department clubs are managed here.</p>
                </div>
                <button type="button" id="clubAdd" class="bg-primary text-white font-bold px-4 py-2 rounded-lg text-sm">Add New Club</button>
            </div>
            <div class="grid sm:grid-cols-2 gap-3">
                <label class="text-xs font-semibold">Search<input id="clubSearch" value="${escapeHTML(search)}" class="mt-1 w-full px-3 py-2 rounded-lg border text-sm" placeholder="Name, category, department"></label>
                ${clubSelect('categoryFilter', 'Category', category, [{ value: '', label: 'All categories' }].concat(CMS_CLUB_CATEGORIES.map((item) => ({ value: item, label: item }))))}
            </div>
            <div class="grid gap-3">${rows.map((club) => `
                <article class="bg-white rounded-2xl border p-4 flex flex-wrap items-center gap-4">
                    ${club.logo_url || club.cover_url ? `<img src="${escapeHTML(club.logo_url || club.cover_url)}" alt="" class="w-16 h-16 rounded-xl object-cover">` : '<div class="w-16 h-16 rounded-xl bg-slate-100"></div>'}
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2"><h3 class="font-bold">${escapeHTML(club.name)}</h3>${clubStatusLabel(club)}</div>
                        <p class="text-xs text-slate-500 mt-1">${escapeHTML(club.category || 'Uncategorised')} · ${club.club_type === 'department' ? escapeHTML(club.department_name || 'Department') : 'Campus club'}</p>
                        <p class="text-sm text-slate-600 mt-1 line-clamp-2">${escapeHTML(club.intro || '')}</p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" class="text-xs font-bold px-3 py-2 rounded-lg border" data-edit="${club.id}">Edit</button>
                        ${club.status === 'published' ? `<a class="text-xs font-bold px-3 py-2 rounded-lg border" href="clubs.html#${escapeHTML(club.slug)}" target="_blank" rel="noopener">Preview</a>` : `<button type="button" class="text-xs font-bold px-3 py-2 rounded-lg border" data-preview="${club.id}">Preview</button>`}
                        ${clubPublishAction(club)}
                        <button type="button" class="text-xs font-bold px-3 py-2 rounded-lg text-red-700" data-delete="${club.id}">Delete</button>
                    </div>
                </article>`).join('') || '<p class="text-sm text-slate-500">No clubs yet. Add the first club when the college is ready to publish one.</p>'}</div>`;
        const categoryFilter = box.querySelector('[name="categoryFilter"]');
        categoryFilter.id = 'clubCategoryFilter';
        document.getElementById('clubAdd').onclick = () => { cmsClubId = null; cmsClubEditing = true; renderClubsAdmin(); };
        document.getElementById('clubSearch').oninput = () => renderClubsAdmin();
        categoryFilter.onchange = () => renderClubsAdmin();
        box.querySelectorAll('[data-edit]').forEach((button) => { button.onclick = () => { cmsClubId = Number(button.getAttribute('data-edit')); cmsClubEditing = true; renderClubsAdmin(); }; });
        box.querySelectorAll('[data-preview]').forEach((button) => { button.onclick = () => previewClub(cmsClubsData.find((club) => club.id === Number(button.getAttribute('data-preview')))); });
        box.querySelectorAll('[data-post]').forEach((button) => { button.onclick = () => postClub(Number(button.getAttribute('data-post'))); });
        box.querySelectorAll('[data-unpublish]').forEach((button) => { button.onclick = () => unpublishClub(Number(button.getAttribute('data-unpublish'))); });
        box.querySelectorAll('[data-delete]').forEach((button) => { button.onclick = () => deleteClub(Number(button.getAttribute('data-delete'))); });
        return;
    }
    box.innerHTML = clubEditor(selected);
    bindClubEditor(selected);
}

function clubEditor(club) {
    const departments = window.cmsDepartments || [];
    const status = club ? (club.status || 'draft') : 'draft';
    const activities = ((club && club.activities) || []).map((item) => `
        <form data-activity="${item.id}" class="border rounded-xl p-4 grid sm:grid-cols-2 gap-3">
            ${campusInput('title', 'Activity title', item.title)}
            ${campusInput('event_date', 'Date', item.event_date)}
            ${campusInput('venue', 'Venue', item.venue)}
            ${campusInput('display_order', 'Display order', item.display_order)}
            ${clubSelect('is_published', 'Status', item.is_published ? '1' : '0', [{ value: '1', label: 'Published' }, { value: '0', label: 'Draft' }])}
            ${campusArea('description', 'Description', item.description)}
            <div class="flex gap-2"><button class="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-white">Save activity</button><button type="button" class="text-xs font-bold px-3 py-2 rounded-lg" data-delete-activity="${item.id}">Delete</button></div>
        </form>`).join('');
    const images = ((club && club.images) || []).map((item) => `
        <form data-image="${item.id}" class="border rounded-xl p-3 grid gap-2">
            <img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.alt_text || '')}" class="w-full aspect-video object-cover rounded-lg">
            ${campusInput('caption', 'Caption', item.caption)}
            ${campusInput('alt_text', 'Alternative text', item.alt_text)}
            ${campusInput('display_order', 'Display order', item.display_order)}
            ${clubSelect('is_published', 'Status', item.is_published ? '1' : '0', [{ value: '1', label: 'Published' }, { value: '0', label: 'Draft' }])}
            <div class="flex gap-2"><button class="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-white">Save photograph</button><button type="button" class="text-xs font-bold px-3 py-2 rounded-lg" data-delete-image="${item.id}">Delete</button></div>
        </form>`).join('');
    const members = ((club && club.members) || []).map((item) => `
        <form data-member="${item.id}" class="border rounded-xl p-3 grid sm:grid-cols-2 gap-3">
            ${item.photo_url ? `<img src="${escapeHTML(item.photo_url)}" alt="" class="w-14 h-14 rounded-full object-cover">` : ''}
            ${campusInput('name', 'Student name', item.name)}
            ${campusInput('role', 'Student role', item.role)}
            ${campusInput('admission_number', 'Admission number (private)', item.admission_number)}
            ${campusInput('display_order', 'Order', item.display_order)}
            <label class="text-xs font-semibold">Photograph<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" class="mt-1 block w-full text-xs"></label>
            <div class="flex gap-2 sm:col-span-2"><button class="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-white">Save member</button><button type="button" class="text-xs font-bold px-3 py-2 rounded-lg" data-delete-member="${item.id}">Remove</button></div>
        </form>`).join('');
    return `
        <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-heading font-bold text-lg">${club ? 'Edit club' : 'Add New Club'}</h2>
            <button type="button" id="clubBack" class="text-xs font-bold px-3 py-2 rounded-lg border">Back to clubs</button>
        </div>
        <form id="clubPageForm" class="bg-white rounded-2xl border p-5 grid sm:grid-cols-2 gap-3">
            ${campusInput('name', 'Club name', club && club.name)}
            ${clubSelect('category', 'Club category', club && club.category, CMS_CLUB_CATEGORIES.map((item) => ({ value: item, label: item })))}
            ${clubSelect('club_type', 'Club type', club ? club.club_type : 'campus', [{ value: 'campus', label: 'Campus Club' }, { value: 'department', label: 'Department Club' }])}
            ${clubSelect('department_id', 'Department', club && club.department_id, [{ value: '', label: 'Not a department club' }].concat(departments.map((dept) => ({ value: String(dept.id), label: dept.code + ' · ' + dept.name }))))}
            ${campusInput('display_order', 'Display order', club ? club.display_order : 0)}
            ${clubSelect('status', 'Status', status, [{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }, { value: 'inactive', label: 'Inactive' }])}
            ${campusArea('intro', 'Short introduction', club && club.intro)}
            ${campusArea('description', 'Full description', club && club.description)}
            ${campusArea('objectives', 'Objectives', club && club.objectives)}
            ${campusArea('activities_text', 'Activities and programs', club && club.activities_text)}
            ${campusArea('meeting_info', 'Meeting schedule', club && club.meeting_info)}
            ${campusInput('established_on', 'Established date', club && club.established_on)}
            ${campusInput('coordinator', 'Club coordinator', club && club.coordinator)}
            ${campusInput('faculty_in_charge', 'Faculty in charge', club && club.faculty_in_charge)}
            ${campusInput('contact_info', 'Contact information (private)', club && club.contact_info)}
            <label class="text-xs font-semibold">Club logo<input type="file" name="logo" accept="image/jpeg,image/png,image/webp" class="mt-1 block w-full text-xs"></label>
            <label class="text-xs font-semibold">Cover photograph<input type="file" name="cover" accept="image/jpeg,image/png,image/webp" class="mt-1 block w-full text-xs"></label>
            ${club && club.logo_url ? `<img src="${escapeHTML(club.logo_url)}" alt="Current logo" class="h-16 w-16 rounded-xl object-cover">` : ''}
            ${club && club.cover_url ? `<img src="${escapeHTML(club.cover_url)}" alt="Current cover" class="h-24 w-full max-w-xs rounded-xl object-cover">` : ''}
            <div class="flex flex-wrap gap-2 sm:col-span-2">
                <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg text-sm">${club ? 'Save club' : 'Create club'}</button>
                <button type="button" id="clubLocalPreview" class="px-4 py-2 rounded-lg border text-sm font-bold">Preview</button>
            </div>
        </form>
        ${club ? `
        <form id="clubMemberForm" class="bg-white rounded-2xl border p-5 grid sm:grid-cols-2 gap-3">
            <h3 class="sm:col-span-2 font-bold">Add member</h3>
            ${campusInput('name', 'Student name', '')}
            ${campusInput('role', 'Student role', 'Member')}
            ${campusInput('admission_number', 'Admission number (private)', '')}
            <label class="text-xs font-semibold">Photograph<input type="file" name="photo" accept="image/jpeg,image/png,image/webp" class="mt-1 block w-full text-xs"></label>
            <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg text-sm">Add member</button>
        </form>
        <div class="space-y-3">${members || '<p class="text-sm text-slate-500">No members yet.</p>'}</div>
        <form id="clubActivityForm" class="bg-white rounded-2xl border p-5 grid sm:grid-cols-2 gap-3">
            <h3 class="sm:col-span-2 font-bold">Add activity</h3>
            <p class="sm:col-span-2 text-xs text-slate-500">A club activity is not an official college event. College events still follow the events approval process.</p>
            ${campusInput('title', 'Activity title', '')}
            ${campusInput('event_date', 'Date', '')}
            ${campusInput('venue', 'Venue', '')}
            ${campusInput('display_order', 'Display order', '0')}
            ${clubSelect('is_published', 'Status', '0', [{ value: '1', label: 'Published' }, { value: '0', label: 'Draft' }])}
            ${campusArea('description', 'Description', '')}
            <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg text-sm">Add activity</button>
        </form>
        <div class="space-y-3">${activities || '<p class="text-sm text-slate-500">No activities yet.</p>'}</div>
        <form id="clubGalleryForm" class="bg-white rounded-2xl border p-5 grid sm:grid-cols-2 gap-3">
            <h3 class="sm:col-span-2 font-bold">Club gallery</h3>
            <p class="sm:col-span-2 text-xs text-slate-500">Photographs uploaded here stay with this club only.</p>
            ${campusInput('caption', 'Caption', '')}
            ${campusInput('alt_text', 'Alternative text', '')}
            ${campusInput('display_order', 'Display order', '0')}
            ${clubSelect('is_published', 'Status', '0', [{ value: '1', label: 'Published' }, { value: '0', label: 'Draft' }])}
            <label class="text-xs font-semibold sm:col-span-2">Photograph<input type="file" name="image" accept="image/jpeg,image/png,image/webp" required class="mt-1 block w-full text-xs"></label>
            <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg text-sm">Upload photograph</button>
        </form>
        <div class="grid sm:grid-cols-2 gap-3">${images || '<p class="text-sm text-slate-500">This gallery is empty.</p>'}</div>` : ''}`;
}

function bindClubEditor(club) {
    document.getElementById('clubBack').onclick = () => { cmsClubEditing = false; renderClubsAdmin(); };
    document.getElementById('clubPageForm').onsubmit = saveClubPage;
    document.getElementById('clubLocalPreview').onclick = () => previewClub(club || formClub(document.getElementById('clubPageForm')));
    const type = document.querySelector('#clubPageForm [name="club_type"]');
    const dept = document.querySelector('#clubPageForm [name="department_id"]');
    const syncDept = () => { dept.disabled = type.value !== 'department'; if (type.value !== 'department') dept.value = ''; };
    type.onchange = syncDept;
    syncDept();
    const memberForm = document.getElementById('clubMemberForm');
    if (memberForm) memberForm.onsubmit = createClubMember;
    const activityForm = document.getElementById('clubActivityForm');
    if (activityForm) activityForm.onsubmit = createClubActivity;
    const galleryForm = document.getElementById('clubGalleryForm');
    if (galleryForm) galleryForm.onsubmit = uploadClubGallery;
    document.querySelectorAll('[data-activity]').forEach((form) => { form.onsubmit = saveClubActivity; });
    document.querySelectorAll('[data-image]').forEach((form) => { form.onsubmit = saveClubImage; });
    document.querySelectorAll('[data-member]').forEach((form) => { form.onsubmit = saveClubMember; });
    document.querySelectorAll('[data-delete-activity]').forEach((button) => { button.onclick = () => deleteClubActivity(button.getAttribute('data-delete-activity')); });
    document.querySelectorAll('[data-delete-image]').forEach((button) => { button.onclick = () => deleteClubImage(button.getAttribute('data-delete-image')); });
    document.querySelectorAll('[data-delete-member]').forEach((button) => { button.onclick = () => deleteClubMember(button.getAttribute('data-delete-member')); });
}

function formClub(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    return data;
}

function previewClub(club) {
    if (!club) return;
    const dialog = document.getElementById('cmsPreview') || document.createElement('dialog');
    dialog.id = 'cmsPreview';
    dialog.className = 'rounded-2xl p-0 max-w-xl w-[92vw]';
    dialog.innerHTML = `<article class="p-5"><p class="text-xs font-bold text-primary">${escapeHTML(club.category || 'Club')} · ${club.club_type === 'department' ? 'Department' : 'Campus'}</p><h2 class="font-heading font-bold text-2xl mt-1">${escapeHTML(club.name || 'Untitled club')}</h2><p class="mt-3 text-sm text-slate-600">${escapeHTML(club.intro || '')}</p><p class="mt-3 text-sm">${escapeHTML(club.description || '')}</p><div class="mt-4"><button type="button" id="cmsPreviewClose" class="px-3 py-2 rounded-lg border text-sm font-bold">Close</button></div></article>`;
    if (!dialog.parentNode) document.body.appendChild(dialog);
    dialog.showModal();
    dialog.querySelector('#cmsPreviewClose').onclick = () => dialog.close();
}

async function saveClubPage(event) {
    event.preventDefault();
    const data = new FormData(event.target);
    if (!data.get('logo') || !data.get('logo').name) data.delete('logo');
    if (!data.get('cover') || !data.get('cover').name) data.delete('cover');
    if (data.get('club_type') !== 'department') data.set('department_id', '');
    try {
        const saved = await apiCall(cmsClubId ? '/api/admin/clubs/' + cmsClubId : '/api/admin/clubs', { method: cmsClubId ? 'PATCH' : 'POST', body: data });
        cmsClubId = saved.id;
        cmsClubEditing = true;
        toast(cmsClubId ? '✓ Club saved' : '✓ Club created');
        await cmsLoadClubs();
    } catch (err) { toast('✕ ' + err.message, false); }
}

async function createClubActivity(event) {
    event.preventDefault();
    try { await apiCall('/api/admin/clubs/' + cmsClubId + '/activities', { method: 'POST', body: new FormData(event.target) }); toast('✓ Activity added'); await cmsLoadClubs(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function saveClubActivity(event) {
    event.preventDefault();
    try { await apiCall('/api/admin/clubs/' + cmsClubId + '/activities/' + event.target.dataset.activity, { method: 'PATCH', body: new FormData(event.target) }); toast('✓ Activity saved'); await cmsLoadClubs(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function deleteClubActivity(id) {
    if (!confirm('Delete this club activity?')) return;
    try { await apiCall('/api/admin/clubs/' + cmsClubId + '/activities/' + id, { method: 'DELETE' }); toast('✓ Activity deleted'); await cmsLoadClubs(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function uploadClubGallery(event) {
    event.preventDefault();
    try { await apiCall('/api/admin/clubs/' + cmsClubId + '/gallery', { method: 'POST', body: new FormData(event.target) }); toast('✓ Photograph added'); await cmsLoadClubs(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function saveClubImage(event) {
    event.preventDefault();
    try { await apiCall('/api/admin/clubs/' + cmsClubId + '/gallery/' + event.target.dataset.image, { method: 'PATCH', body: new FormData(event.target) }); toast('✓ Photograph saved'); await cmsLoadClubs(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function deleteClubImage(id) {
    if (!confirm('Delete this photograph from this club only?')) return;
    try { await apiCall('/api/admin/clubs/' + cmsClubId + '/gallery/' + id, { method: 'DELETE' }); toast('✓ Photograph deleted'); await cmsLoadClubs(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function createClubMember(event) {
    event.preventDefault();
    const data = new FormData(event.target);
    if (!data.get('photo') || !data.get('photo').name) data.delete('photo');
    try { await apiCall('/api/admin/clubs/' + cmsClubId + '/members', { method: 'POST', body: data }); toast('✓ Member added'); await cmsLoadClubs(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function saveClubMember(event) {
    event.preventDefault();
    const data = new FormData(event.target);
    if (!data.get('photo') || !data.get('photo').name) data.delete('photo');
    try { await apiCall('/api/admin/clubs/' + cmsClubId + '/members/' + event.target.dataset.member, { method: 'PATCH', body: data }); toast('✓ Member saved'); await cmsLoadClubs(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function deleteClubMember(id) {
    if (!confirm('Remove this club member?')) return;
    try { await apiCall('/api/admin/clubs/' + cmsClubId + '/members/' + id, { method: 'DELETE' }); toast('✓ Member removed'); await cmsLoadClubs(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
function clubPublishAction(club) {
    const status = club.status || (club.is_published ? 'published' : 'draft');
    if (status === 'published') {
        return `<button type="button" class="text-xs font-bold px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900" data-unpublish="${club.id}">Unpublish</button>`;
    }
    return `<button type="button" class="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-white" data-post="${club.id}">Post</button>`;
}

async function postClub(id) {
    const club = cmsClubsData.find((item) => item.id === id);
    if (!club) return;
    const status = club.status || (club.is_published ? 'published' : 'draft');
    if (status === 'inactive' || Number(club.is_active) === 0) {
        toast('Activate this club before publishing. Open Edit and set the status to Draft, then use Post.', false);
        return;
    }
    if (!confirm('Are you sure you want to publish this club? It will become visible on the public Student Clubs page and its department page.')) return;
    try {
        await apiCall('/api/admin/clubs/' + id + '/publish', { method: 'POST' });
        toast('✓ Club posted');
        await cmsLoadClubs();
    } catch (err) { toast('✕ ' + err.message, false); }
}

async function unpublishClub(id) {
    const club = cmsClubsData.find((item) => item.id === id);
    if (!club || !confirm('Unpublish ' + club.name + '? It will be hidden from the public Student Clubs page and its department page. The club is not deleted.')) return;
    try {
        await apiCall('/api/admin/clubs/' + id + '/unpublish', { method: 'POST' });
        toast('✓ Club unpublished');
        await cmsLoadClubs();
    } catch (err) { toast('✕ ' + err.message, false); }
}

async function deleteClub(id) {
    const club = cmsClubsData.find((item) => item.id === id);
    if (!club || !confirm('Delete ' + club.name + '? Its activities, members, and photographs will be removed. Other website records stay.')) return;
    try { await apiCall('/api/admin/clubs/' + id, { method: 'DELETE' }); cmsClubId = null; cmsClubEditing = false; toast('✓ Club deleted'); await cmsLoadClubs(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
