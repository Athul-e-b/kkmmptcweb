let cmsIICData = null;
let cmsClubsData = [];
let cmsClubId = null;
let cmsClubEditing = false;
const CMS_CLUB_CATEGORIES = ['Technical', 'Cultural', 'Sports', 'Arts', 'Music', 'Social', 'Other'];

function campusInput(name, label, value) {
    return `<label class="block text-xs font-semibold text-slate-700">${label}<input name="${name}" value="${escapeHTML(value || '')}" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"></label>`;
}

function campusArea(name, label, value) {
    return `<label class="block text-xs font-semibold text-slate-700 sm:col-span-2">${label}<textarea name="${name}" rows="4" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm">${escapeHTML(value || '')}</textarea></label>`;
}

function campusStatus(value) {
    const published = Number(value) === 1;
    return `<label class="block text-xs font-semibold text-slate-700">Status<select name="is_published" class="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"><option value="1"${published ? ' selected' : ''}>Published</option><option value="0"${published ? '' : ' selected'}>Draft</option></select></label>`;
}

async function campusSubmit(path, method, form) {
    const source = new FormData(form);
    const files = source.getAll('images').filter((file) => file && file.name);
    source.delete('images');
    if (!files.length) return apiCall(path, { method, body: source });
    let response = null;
    let nextPath = path;
    let nextMethod = method;
    for (const file of files) {
        const body = new FormData();
        for (const [key, value] of source.entries()) body.append(key, value);
        body.append('image', file);
        response = await apiCall(nextPath, { method: nextMethod, body });
        if (method === 'POST' && /\/activities$/.test(path) && response && response.id) {
            nextPath = path + '/' + response.id;
            nextMethod = 'PATCH';
        }
    }
    return response;
}

async function cmsLoadIIC() {
    const box = document.getElementById('iicAdmin');
    if (!box) return;
    try {
        cmsIICData = await apiCall('/api/admin/iic');
        renderIICAdmin();
    } catch (err) {
        box.innerHTML = `<p class="text-sm text-secondary">${escapeHTML(err.message)}</p>`;
    }
}

function renderIICAdmin() {
    const box = document.getElementById('iicAdmin');
    const page = cmsIICData.page;
    const hero = page.hero_image_url
        ? `<img src="${escapeHTML(page.hero_image_url)}" alt="" class="w-full max-w-xs rounded-xl object-cover aspect-video">`
        : '<p class="text-xs text-slate-500">No hero photograph yet.</p>';
    box.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-heading font-bold text-lg">IIC Management</h2>
            <a href="iic.html" target="_blank" rel="noopener" class="text-xs font-semibold text-primary">Preview public page</a>
        </div>
        <form id="iicPageForm" class="bg-white rounded-2xl border p-5 grid sm:grid-cols-2 gap-3">
            <p class="sm:col-span-2 text-xs text-slate-500">Sentences that begin with “Placeholder” are drafts for the administrator. They are not official college statements.</p>
            ${campusInput('hero_title', 'Title', page.hero_title)}
            <div>${hero}<label class="block text-xs font-semibold mt-3">Replace hero photograph<input type="file" name="hero_image" accept="image/jpeg,image/png,image/webp" class="mt-1 block w-full text-xs"></label><label class="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" name="remove_hero" value="1"> Remove current hero photograph</label></div>
            ${campusArea('hero_intro', 'Introduction', page.hero_intro)}
            ${campusArea('about', 'About', page.about)}
            ${campusArea('vision', 'Vision', page.vision)}
            ${campusArea('mission', 'Mission', page.mission)}
            ${campusArea('objectives', 'Objectives, one per line', page.objectives)}
            ${campusArea('participation', 'Student participation', page.participation)}
            ${campusArea('workshops_note', 'Workshops, seminars, and competitions', page.workshops_note)}
            <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg text-sm">Save page</button>
        </form>
        <form id="iicActivityForm" class="bg-white rounded-2xl border p-5 grid sm:grid-cols-2 gap-3">
            <h3 class="sm:col-span-2 font-bold">Add activity</h3>
            ${campusInput('title', 'Title', '')}
            ${campusInput('category', 'Category', '')}
            ${campusInput('event_date', 'Date', '')}
            ${campusInput('venue', 'Venue', '')}
            ${campusInput('external_url', 'External link', '')}
            ${campusInput('display_order', 'Display order', '0')}
            ${campusStatus(0)}
            ${campusArea('description', 'Description', '')}
            <label class="text-xs font-semibold sm:col-span-2">Photographs<input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple class="mt-1 block w-full text-xs"></label>
            <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg text-sm">Add activity</button>
        </form>
        <div id="iicActivityList" class="space-y-3"></div>
        <form id="iicGalleryForm" class="bg-white rounded-2xl border p-5 grid sm:grid-cols-2 gap-3">
            <h3 class="sm:col-span-2 font-bold">Add gallery photographs</h3>
            ${campusInput('event_title', 'Event title', '')}
            ${campusInput('caption', 'Caption', '')}
            ${campusInput('alt_text', 'Alternative text', '')}
            ${campusInput('display_order', 'Display order', '0')}
            ${campusStatus(1)}
            <label class="text-xs font-semibold sm:col-span-2">Photographs<input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple required class="mt-1 block w-full text-xs"></label>
            <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg text-sm">Upload</button>
        </form>
        <div id="iicGalleryList" class="grid sm:grid-cols-2 gap-3"></div>`;
    document.getElementById('iicPageForm').onsubmit = saveIICPage;
    document.getElementById('iicActivityForm').onsubmit = createIICActivity;
    document.getElementById('iicGalleryForm').onsubmit = uploadIICGallery;
    document.getElementById('iicActivityList').innerHTML = (cmsIICData.activities || []).map(iicActivityCard).join('') || '<p class="text-sm text-slate-500">No activities yet.</p>';
    document.getElementById('iicGalleryList').innerHTML = (cmsIICData.gallery || []).map(iicGalleryCard).join('') || '<p class="text-sm text-slate-500">The gallery is empty.</p>';
    document.querySelectorAll('[data-iic-activity]').forEach((form) => { form.onsubmit = saveIICActivity; });
    document.querySelectorAll('[data-iic-photo]').forEach((form) => { form.onsubmit = saveIICPhoto; });
    document.querySelectorAll('[data-iic-gallery]').forEach((form) => { form.onsubmit = saveIICGalleryItem; });
}

function iicActivityCard(item) {
    const photos = (item.photos || []).map((photo) => `
        <form data-iic-photo="${photo.id}" class="border rounded-xl p-3 grid gap-2">
            <img src="${escapeHTML(photo.image_url)}" alt="" class="w-full aspect-video object-cover rounded-lg">
            ${campusInput('caption', 'Caption', photo.caption)}
            ${campusInput('alt_text', 'Alternative text', photo.alt_text)}
            ${campusInput('display_order', 'Order', photo.display_order)}
            <div class="flex gap-2"><button class="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-white">Save photo</button><button type="button" class="text-xs font-bold px-3 py-2 rounded-lg" onclick="deleteIICPhoto(${photo.id})">Delete photo</button></div>
        </form>`).join('');
    return `<div class="space-y-3">
        <form data-iic-activity="${item.id}" class="bg-white rounded-2xl border p-5 grid sm:grid-cols-2 gap-3">
        <h3 class="sm:col-span-2 font-bold">${escapeHTML(item.title)}</h3>
        ${campusInput('title', 'Title', item.title)}
        ${campusInput('category', 'Category', item.category)}
        ${campusInput('event_date', 'Date', item.event_date)}
        ${campusInput('venue', 'Venue', item.venue)}
        ${campusInput('external_url', 'External link', item.external_url)}
        ${campusInput('display_order', 'Display order', item.display_order)}
        ${campusStatus(item.is_published)}
        ${campusArea('description', 'Description', item.description)}
        <label class="text-xs font-semibold sm:col-span-2">Add photographs<input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple class="mt-1 block w-full text-xs"></label>
        <div class="flex gap-2"><button class="bg-primary text-white font-bold px-4 py-2 rounded-lg text-sm">Save activity</button><button type="button" class="text-sm font-bold px-4 py-2 rounded-lg" onclick="deleteIICActivity(${item.id})">Delete activity</button></div>
        </form>
        <div class="grid sm:grid-cols-2 gap-3">${photos}</div>
    </div>`;
}

function iicGalleryCard(item) {
    return `<form data-iic-gallery="${item.id}" class="bg-white rounded-2xl border p-4 grid gap-2">
        <img src="${escapeHTML(item.image_url)}" alt="" class="w-full aspect-video object-cover rounded-lg">
        ${campusInput('event_title', 'Event title', item.event_title)}
        ${campusInput('caption', 'Caption', item.caption)}
        ${campusInput('alt_text', 'Alternative text', item.alt_text)}
        ${campusInput('display_order', 'Order', item.display_order)}
        ${campusStatus(item.is_published)}
        <div class="flex gap-2"><button class="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-white">Save</button><button type="button" class="text-xs font-bold px-3 py-2 rounded-lg" onclick="deleteIICGallery(${item.id})">Delete</button></div>
    </form>`;
}

async function saveIICPage(event) {
    event.preventDefault();
    try { await campusSubmit('/api/admin/iic', 'PATCH', event.target); toast('✓ IIC page saved'); await cmsLoadIIC(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function createIICActivity(event) {
    event.preventDefault();
    try { await campusSubmit('/api/admin/iic/activities', 'POST', event.target); toast('✓ Activity added'); await cmsLoadIIC(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function saveIICActivity(event) {
    event.preventDefault();
    try { await campusSubmit('/api/admin/iic/activities/' + event.target.dataset.iicActivity, 'PATCH', event.target); toast('✓ Activity saved'); await cmsLoadIIC(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function deleteIICActivity(id) {
    if (!confirm('Delete this activity and its photographs?')) return;
    try { await apiCall('/api/admin/iic/activities/' + id, { method: 'DELETE' }); toast('✓ Activity deleted'); await cmsLoadIIC(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function saveIICPhoto(event) {
    event.preventDefault();
    try { await campusSubmit('/api/admin/iic/activity-photos/' + event.target.dataset.iicPhoto, 'PATCH', event.target); toast('✓ Photograph saved'); await cmsLoadIIC(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function deleteIICPhoto(id) {
    if (!confirm('Delete this photograph?')) return;
    try { await apiCall('/api/admin/iic/activity-photos/' + id, { method: 'DELETE' }); toast('✓ Photograph deleted'); await cmsLoadIIC(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function uploadIICGallery(event) {
    event.preventDefault();
    try { await campusSubmit('/api/admin/iic/gallery', 'POST', event.target); toast('✓ Gallery updated'); await cmsLoadIIC(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function saveIICGalleryItem(event) {
    event.preventDefault();
    try { await campusSubmit('/api/admin/iic/gallery/' + event.target.dataset.iicGallery, 'PATCH', event.target); toast('✓ Photograph saved'); await cmsLoadIIC(); }
    catch (err) { toast('✕ ' + err.message, false); }
}
async function deleteIICGallery(id) {
    if (!confirm('Delete this gallery photograph?')) return;
    try { await apiCall('/api/admin/iic/gallery/' + id, { method: 'DELETE' }); toast('✓ Photograph deleted'); await cmsLoadIIC(); }
    catch (err) { toast('✕ ' + err.message, false); }
}

async function cmsLoadClubs() {
    const box = document.getElementById('clubsAdmin');
    if (!box) return;
    try {
        if (!window.cmsDepartments) window.cmsDepartments = await apiCall('/api/departments?include_inactive=true');
        cmsClubsData = await apiCall('/api/admin/clubs');
        if (cmsClubId && !cmsClubsData.some((club) => club.id === cmsClubId)) cmsClubId = null;
        renderClubsAdmin();
    } catch (err) {
        box.innerHTML = `<p class="text-sm text-secondary">${escapeHTML(err.message)}</p>`;
    }
}
