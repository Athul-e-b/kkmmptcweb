/**
 * Public departments page: dynamic cards + detail view (?department=CODE).
 */
function lines(text) {
    return (text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

function hodBlock(d) {
    const hod = d.hod;
    if (!hod) {
        return `<p class="text-xs text-slate-400 mt-3">HOD details will appear here once published.</p>`;
    }
    const photo = hod.photo_url
        ? `<img src="${escapeHTML(hod.photo_url)}" alt="${escapeHTML(hod.name)}" class="w-24 h-24 rounded-full object-cover mx-auto border-4 border-accent shadow-lg">`
        : `<div class="w-24 h-24 rounded-full bg-primary text-white flex items-center justify-center font-bold mx-auto text-2xl border-4 border-accent">${escapeHTML(hod.name.charAt(0))}</div>`;
    return `
        <div class="text-center mt-4 bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p class="text-[10px] font-bold uppercase tracking-wider text-primary">★ Head of Department</p>
            ${photo}
            <p class="font-bold text-sm text-slate-900 mt-2">${escapeHTML(hod.name)}</p>
            ${hodIsInCharge(hod) ? `<p class="text-[11px] font-semibold text-primary mt-0.5">In Charge</p>` : ''}
            <p class="text-[11px] text-slate-600">${escapeHTML(d.name)}</p>
        </div>`;
}

function deptCard(d) {
    const img = d.image_url || 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=80&w=800';
    const desc = d.description ? (d.description.length > 140 ? d.description.slice(0, 137) + '…' : d.description) : 'Diploma programme under IHRD.';
    return `
        <article class="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition border border-slate-200 flex flex-col group h-full card-hover-lift">
            <div class="relative h-44 overflow-hidden">
                <img src="${escapeHTML(img)}" alt="${escapeHTML(d.name)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                <div class="absolute top-3 right-3 bg-primary text-white text-[11px] font-bold px-2.5 py-1 rounded-md">${d.intake || 60} Seats</div>
            </div>
            <div class="p-5 flex-1 flex flex-col">
                <span class="text-[10px] font-bold text-primary uppercase tracking-wider">Code: ${escapeHTML(d.code)}</span>
                <h3 class="text-lg font-bold font-heading text-slate-900 mt-1">${escapeHTML(d.name)}</h3>
                <p class="text-slate-600 text-xs leading-relaxed mt-2 flex-1">${escapeHTML(desc)}</p>
                ${hodBlock(d)}
                <div class="text-[11px] text-slate-500 mt-3 space-y-1">
                    ${d.email ? `<div class="break-all"><i class="fa-solid fa-envelope text-primary mr-1"></i>${escapeHTML(d.email)}</div>` : ''}
                    ${d.phone ? `<div><i class="fa-solid fa-phone text-primary mr-1"></i>${escapeHTML(d.phone)}</div>` : ''}
                </div>
                <a href="departments.html?department=${encodeURIComponent(d.code)}" class="mt-4 inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white font-bold text-xs py-2.5 rounded-lg">
                    View Department <i class="fa-solid fa-arrow-right ml-2 text-[10px]"></i>
                </a>
            </div>
        </article>`;
}

function detailHTML(d, staff, events, gallery) {
    const hod = d.hod || (staff || []).find((s) => (s.role === 'HOD'));
    const faculty = (staff || []).filter((s) => s.role !== 'HOD' && s.is_active !== 0);
    const labs = lines(d.labs_text);
    const careers = lines(d.career_text);
    const img = d.image_url || '';
    return `
        <a href="departments.html" class="text-xs font-semibold text-primary hover:underline"><i class="fa-solid fa-arrow-left mr-1"></i> All departments</a>
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-4">
            ${img ? `<img src="${escapeHTML(img)}" alt="${escapeHTML(d.name)}" class="w-full h-56 object-cover">` : ''}
            <div class="p-6 sm:p-8">
                <div class="flex flex-wrap gap-2 mb-2">
                    <span class="bg-primary/10 text-primary text-xs font-bold px-2.5 py-0.5 rounded">Code: ${escapeHTML(d.code)}</span>
                    ${d.intake ? `<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded">${d.intake} intake</span>` : ''}
                    ${d.duration ? `<span class="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded">${escapeHTML(d.duration)}</span>` : ''}
                </div>
                <h2 class="text-2xl font-bold font-heading text-slate-900">${escapeHTML(d.course_name || ('Diploma in ' + d.name))}</h2>

                ${hod ? `
                <section class="mt-8 bg-gradient-to-r from-primary to-primary-dark text-white rounded-2xl p-5 sm:p-6 grid sm:grid-cols-[auto,1fr] gap-5 items-center shadow-lg">
                    ${hod.photo_url ? `<img src="${escapeHTML(hod.photo_url)}" alt="${escapeHTML(hod.name)}" class="w-36 h-36 rounded-full object-cover border-4 border-accent shadow-xl">` : `<div class="w-36 h-36 rounded-full bg-white/15 text-white flex items-center justify-center text-4xl font-bold border-4 border-accent">${escapeHTML(hod.name.charAt(0))}</div>`}
                    <div>
                        <p class="text-[11px] font-bold uppercase tracking-wider text-accent">★ Head of Department</p>
                        <h3 class="font-bold font-heading text-2xl mt-1">${escapeHTML(hod.name)}</h3>
                        ${hodIsInCharge(hod) ? `<p class="text-sm font-semibold text-accent mt-1">In Charge</p>` : ''}
                        <p class="text-sm text-white/85 mt-1">${escapeHTML(d.name)}</p>
                    </div>
                </section>` : ''}

                <section class="mt-8">
                    <h3 class="font-heading font-bold text-primary mb-2">About Department</h3>
                    <p class="text-sm text-slate-600 leading-relaxed">${escapeHTML(d.description || 'Description will appear once published from the admin panel.')}</p>
                </section>
                <div class="grid md:grid-cols-2 gap-6 mt-6">
                    <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <h3 class="font-heading font-bold text-sm text-slate-900 mb-2">Vision</h3>
                        <p class="text-xs text-slate-600 leading-relaxed">${escapeHTML(d.vision || 'Not provided')}</p>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <h3 class="font-heading font-bold text-sm text-slate-900 mb-2">Mission</h3>
                        <p class="text-xs text-slate-600 leading-relaxed">${escapeHTML(d.mission || 'Not provided')}</p>
                    </div>
                </div>
                <section class="mt-8">
                    <h3 class="font-heading font-bold text-primary mb-3">Course Details</h3>
                    <ul class="text-xs text-slate-600 space-y-1">
                        <li><strong>Course:</strong> ${escapeHTML(d.course_name || d.name)}</li>
                        <li><strong>Duration:</strong> ${escapeHTML(d.duration || 'Not provided')}</li>
                        <li><strong>Intake:</strong> ${d.intake != null ? d.intake : 'Not provided'}</li>
                        <li><strong>Eligibility:</strong> ${escapeHTML(d.eligibility || 'Not provided')}</li>
                    </ul>
                    ${d.other_details ? `<p class="text-xs text-slate-600 mt-3 whitespace-pre-wrap">${escapeHTML(d.other_details)}</p>` : ''}
                </section>
                ${labs.length ? `<section class="mt-8"><h3 class="font-heading font-bold text-sm mb-2">Laboratories</h3><ul class="text-xs text-slate-600 space-y-1">${labs.map((l) => `<li>• ${escapeHTML(l)}</li>`).join('')}</ul></section>` : ''}
                ${careers.length ? `<section class="mt-8"><h3 class="font-heading font-bold text-sm mb-2">Career Prospects</h3><ul class="text-xs text-slate-600 space-y-1">${careers.map((l) => `<li>• ${escapeHTML(l)}</li>`).join('')}</ul></section>` : ''}

                <section class="mt-10">
                    <h3 class="font-heading font-bold text-slate-900 mb-4">Faculty &amp; Staff</h3>
                    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${faculty.map((s) => `
                            <div class="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                ${s.photo_url ? `<img src="${escapeHTML(s.photo_url)}" class="w-12 h-12 rounded-full object-cover" alt="${escapeHTML(s.name)}">` : `<div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">${escapeHTML(s.name.charAt(0))}</div>`}
                                <div class="min-w-0">
                                    <div class="font-bold text-xs truncate">${escapeHTML(s.name)}</div>
                                </div>
                            </div>`).join('') || '<p class="text-xs text-slate-400">Faculty list coming soon.</p>'}
                    </div>
                </section>

                <section class="mt-10">
                    <h3 class="font-heading font-bold text-slate-900 mb-3">Contact</h3>
                    <p class="text-xs text-slate-600 break-words">${d.phone ? `☎ ${escapeHTML(d.phone)}` : ''} ${d.email ? ` · ✉ ${escapeHTML(d.email)}` : ''}</p>
                </section>

                <section class="mt-10">
                    <h3 class="font-heading font-bold text-slate-900 mb-4">Department Gallery</h3>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        ${(gallery || []).map((g) => `
                            <button type="button" class="rounded-xl overflow-hidden h-28"
                                data-type="${escapeHTML(g.media_type || 'image')}"
                                data-image="${escapeHTML(g.image_url || '')}"
                                data-video="${escapeHTML(g.video_url || '')}"
                                onclick="openDeptMedia(this)">
                                ${g.media_type === 'video'
                                    ? `<div class="w-full h-full bg-slate-800 text-white flex items-center justify-center"><i class="fa-solid fa-play"></i></div>`
                                    : `<img src="${escapeHTML(g.image_url)}" alt="${escapeHTML(g.title || g.caption || '')}" class="w-full h-full object-cover">`}
                            </button>`).join('') || '<p class="text-xs text-slate-400">No department media yet.</p>'}
                    </div>
                </section>

                <section class="mt-10">
                    <h3 class="font-heading font-bold text-slate-900 mb-4">Events</h3>
                    <div class="grid sm:grid-cols-2 gap-4">
                        ${(events || []).map((ev) => `
                            <div class="border border-slate-200 rounded-xl overflow-hidden">
                                ${ev.image_url ? `<img src="${escapeHTML(ev.image_url)}" class="w-full h-32 object-cover" alt="">` : ''}
                                <div class="p-3">
                                    <div class="font-bold text-xs">${escapeHTML(ev.title)}</div>
                                    <div class="text-[11px] text-slate-500">${escapeHTML(ev.event_date || '')}</div>
                                </div>
                            </div>`).join('') || '<p class="text-xs text-slate-400">No events published yet.</p>'}
                    </div>
                </section>
            </div>
        </div>`;
}

function openDeptMedia(btn) {
    const type = btn.getAttribute('data-type');
    const image = btn.getAttribute('data-image');
    const video = btn.getAttribute('data-video');
    if (type === 'video' && video) {
        if (video.includes('youtube') || video.includes('youtu.be')) window.open(video, '_blank');
        else window.open(video, '_blank');
    } else if (image && typeof openLightbox === 'function') openLightbox(image);
}

async function loadDepartmentsPage() {
    const container = document.getElementById('deptContainer');
    if (!container) return;
    const params = new URLSearchParams(window.location.search);
    let code = (params.get('department') || '').toUpperCase();
    if (!code && window.location.hash) {
        const hashMatch = window.location.hash.match(/^#dept-([a-z0-9]+)$/i);
        if (hashMatch) code = hashMatch[1].toUpperCase();
    }
    if (code === 'CM') code = 'CG';
    renderLoadingState(container, 'Loading departments…');
    try {
        if (code) {
            const d = await fetchJSON(`/api/departments/${encodeURIComponent(code)}`);
            const [staff, events, gallery] = await Promise.all([
                fetchJSON(`/api/staff?department=${encodeURIComponent(code)}`).catch(() => []),
                fetchJSON(`/api/events?department=${encodeURIComponent(code)}`).catch(() => []),
                fetchJSON(`/api/gallery?department=${d.id}`).catch(() => []),
            ]);
            container.className = 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16';
            container.innerHTML = detailHTML(d, staff, events, gallery);
            return;
        }
        const depts = await fetchJSON('/api/departments');
        container.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16';
        if (!depts.length) {
            container.innerHTML = '<p class="text-sm text-slate-500">No departments published yet.</p>';
            return;
        }
        container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">${depts.map(deptCard).join('')}</div>`;
    } catch (e) {
        renderErrorState(container, 'Unable to load department information.', loadDepartmentsPage);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDepartmentsPage);
} else {
    loadDepartmentsPage();
}
