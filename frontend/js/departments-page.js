/**
 * Public departments page: dynamic cards + detail view (?department=CODE).
 */
function lines(text) {
    return (text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

function dpIcon(path) {
    return `<svg class="dp-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"></path></svg>`;
}

const DP_ICONS = {
    clock: 'M12 8v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    users: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 20v-2a3.5 3.5 0 0 0-2.5-3.3M16.5 5.2a3 3 0 0 1 0 5.6',
    flask: 'M9 3h6M10 3v6L5.5 19a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9V3',
    mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
    phone: 'M7 3h3l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 5 5a2 2 0 0 1 2-2z',
    pin: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3zM5 4v16',
    cap: 'M3 10l9-5 9 5-9 5-9-5zM7 12v4c2 2 8 2 10 0v-4',
};

function dpText(value) {
    return value == null || value === '' ? '' : escapeHTML(String(value));
}

function accentName(name) {
    const parts = String(name || '').trim().split(/\s+/);
    if (parts.length < 2) return dpText(name);
    const last = parts.pop();
    return `${dpText(parts.join(' '))} <span class="dp-accent">${dpText(last)}</span>`;
}

function avatar(person, className) {
    if (!person || !person.name) return '';
    if (person.photo_url) {
        return `<img src="${dpText(person.photo_url)}" alt="" class="${className || ''}" loading="lazy">`;
    }
    return `<span class="dp-avatar ${className || ''}">${dpText(person.name.charAt(0))}</span>`;
}

function hodBlock(d) {
    const hod = d.hod;
    if (!hod || !hod.name) return '';
    return `
        <div class="text-center mt-4 bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p class="text-[10px] font-bold uppercase tracking-wider text-primary">Head of Department</p>
            ${avatar(hod, 'w-48 h-48 rounded-full object-cover mx-auto')}
            <p class="font-bold text-sm text-slate-900 mt-2">${dpText(hod.name)}</p>
            ${hodIsInCharge(hod) ? `<p class="text-[11px] font-semibold text-primary mt-0.5">In Charge</p>` : ''}
        </div>`;
}

function deptCard(d) {
    const hodName = d.hod && d.hod.name ? d.hod.name : '';
    const seats = d.intake != null ? `${d.intake} seats` : '';
    return `
        <a class="dp-card dp-reveal" href="departments.html?department=${encodeURIComponent(d.code)}">
            <div class="dp-media">
                ${d.image_url ? `<img src="${dpText(d.image_url)}" alt="" loading="lazy">` : ''}
                <span class="dp-code">${dpText(d.code)}</span>
            </div>
            <div class="dp-body">
                <h3>${dpText(d.name)}</h3>
                <div class="dp-meta">
                    ${d.duration ? `<span>${dpIcon(DP_ICONS.clock)}${dpText(d.duration)}</span>` : ''}
                    ${seats ? `<span>${dpIcon(DP_ICONS.users)}${dpText(seats)}</span>` : ''}
                    ${hodName ? `<span>${dpIcon(DP_ICONS.cap)}${dpText(hodName)}</span>` : ''}
                </div>
                <div class="dp-rule"></div>
                <div class="dp-foot">
                    <strong>${dpText(seats || d.code)}</strong>
                    <span class="dp-go">View department ${dpIcon('M5 12h14M13 6l6 6-6 6')}</span>
                </div>
            </div>
        </a>`;
}

function fact(label, value, icon) {
    if (!value) return '';
    return `<article class="dp-fact"><small>${dpIcon(icon)} ${label}</small><strong>${dpText(value)}</strong></article>`;
}

function dpSrc(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    if (value.charAt(0) === '/' && value.charAt(1) !== '/') return value;
    try {
        const parsed = new URL(value, window.location.origin);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
    } catch (err) {
        return '';
    }
    return '';
}

function departmentClubCard(club) {
    const name = String(club.name || '').trim();
    const intro = String(club.intro || club.description || '').trim();
    const cover = dpSrc(club.cover_url);
    const logo = dpSrc(club.logo_url);
    const faculty = String(club.faculty_in_charge || '').trim();
    const highlight = String(club.activities_text || '').trim().split(/\n+/).map((line) => line.trim()).filter(Boolean)[0] || '';
    const activities = (club.activities || []).map((item) => String(item.title || '').trim()).filter(Boolean).slice(0, 2);
    const initial = dpText((name || 'C').charAt(0).toUpperCase());
    return `
        <article class="dp-club-card dp-reveal">
            <div class="dp-club-cover">
                ${cover ? `<img src="${dpText(cover)}" alt="${dpText(name)} cover" loading="lazy" data-kkm-fill="cover">` : `<span class="dp-club-fallback" aria-hidden="true">${initial}</span>`}
                ${logo ? `<img class="dp-club-logo" src="${dpText(logo)}" alt="${dpText(name)} logo" loading="lazy" data-kkm-fill="cover">` : ''}
            </div>
            <div class="dp-club-body">
                ${club.category ? `<span class="dp-club-badge">${dpText(club.category)}</span>` : ''}
                <h3>${dpText(name)}</h3>
                ${intro ? `<p class="dp-club-intro">${dpText(intro)}</p>` : ''}
                ${faculty ? `<p class="dp-club-faculty"><span>Faculty coordinator</span>${dpText(faculty)}</p>` : ''}
                ${!faculty && String(club.coordinator || '').trim() ? `<p class="dp-club-faculty"><span>Coordinator</span>${dpText(club.coordinator)}</p>` : ''}
                ${highlight ? `<p class="dp-club-highlight">${dpText(highlight)}</p>` : ''}
                ${activities.length ? `<ul>${activities.map((title) => `<li>${dpText(title)}</li>`).join('')}</ul>` : ''}
                ${club.slug ? `<a class="dp-club-link" href="clubs.html#${encodeURIComponent(club.slug)}">View Club Details</a>` : ''}
            </div>
        </article>`;
}

function contentCard(item) {
    const title = item.name || item.title || '';
    const image = item.logo_url || item.image_url || item.photo_url || '';
    const meta = [item.event_date, item.venue, item.category, item.coordinator, item.academic_year].filter(Boolean);
    const href = item.document_url || item.certificate_url || '';
    return `
        <article class="dp-card dp-reveal">
            ${image ? `<div class="dp-media"><img src="${dpText(image)}" alt="" loading="lazy">${item.event_type ? `<span class="dp-code">${dpText(item.event_type)}</span>` : ''}</div>` : ''}
            <div class="dp-body">
                ${item.category && !image ? `<span class="dp-code" style="position:static;align-self:flex-start">${dpText(item.category)}</span>` : ''}
                <h3>${dpText(title)}</h3>
                ${item.description || item.summary || item.objectives ? `<p class="dp-lead">${dpText(item.description || item.summary || item.objectives)}</p>` : ''}
                ${meta.length ? `<div class="dp-meta">${meta.slice(0, 3).map((bit) => `<span>${dpText(bit)}</span>`).join('')}</div>` : ''}
                ${href ? `<div class="dp-rule"></div><div class="dp-foot"><a class="dp-go" href="${dpText(href)}">Download</a></div>` : ''}
            </div>
        </article>`;
}

function departmentLabs(d, pack) {
    if (pack && Array.isArray(pack.laboratories)) {
        return pack.laboratories.filter((lab) => lab && String(lab.name || '').trim());
    }
    return lines(d && d.labs_text).map((name) => ({ name: name }));
}

function laboratoryCard(lab) {
    const name = typeof lab === 'string' ? lab : lab.name;
    const description = typeof lab === 'string' ? '' : String(lab.description || '').trim();
    const image = typeof lab === 'string' ? '' : dpSrc(lab.image_url);
    return `<article class="dp-card dp-reveal">${image ? `<div class="dp-media"><img src="${dpText(image)}" alt="" loading="lazy" data-kkm-fill="cover"></div>` : ''}<div class="dp-body"><span class="dp-code" style="position:static;align-self:flex-start">${dpIcon(DP_ICONS.flask)}</span><h3>${dpText(name)}</h3>${description ? `<p class="dp-lead">${dpText(description)}</p>` : ''}</div></article>`;
}

function detailHTML(d, staff, events, gallery, bundle, others) {
    const hod = (d.hod && d.hod.name && d.hod) || (staff || []).find((s) => s.role === 'HOD' && s.name);
    const faculty = (staff || []).filter((s) => s && s.name && s.role !== 'HOD' && s.is_active !== 0);
    const labs = departmentLabs(d, bundle);
    const careers = lines(d.career_text);
    const pack = bundle || {};
    const activity = pack.events && pack.events.length ? pack.events : (events || []);
    const photos = (pack.gallery && pack.gallery.length ? pack.gallery : (gallery || [])).filter((g) => g.image_url || g.video_url);
    const contact = d.email ? `mailto:${d.email}` : (d.phone ? `tel:${d.phone}` : '');
    const contactLabel = d.email ? 'Email department' : (d.phone ? 'Call department' : '');
    const sections = [];
    const facts = [
        fact('Course', d.course_name || d.name, DP_ICONS.book),
        fact('Duration', d.duration, DP_ICONS.clock),
        fact('Intake', d.intake != null ? String(d.intake) : '', DP_ICONS.users),
        fact('Eligibility', d.eligibility, DP_ICONS.cap),
        fact('Email', d.email, DP_ICONS.mail),
        fact('Phone', d.phone, DP_ICONS.phone),
    ].join('');
    if (facts) sections.push(['facts', 'Quick facts']);
    if (d.vision || d.mission) sections.push(['vision', 'Vision and mission']);
    if (hod || faculty.length) sections.push(['people', 'Faculty']);
    sections.push(['labs', 'Laboratories']);
    if (careers.length) sections.push(['careers', 'Career paths']);
    sections.push(['clubs', 'Student Clubs']);
    if (activity.length) sections.push(['events', 'Activities']);
    if ((pack.notices || []).length) sections.push(['notices', 'Notices']);
    if ((pack.projects || []).length) sections.push(['projects', 'Projects']);
    if (photos.length) sections.push(['gallery', 'Gallery']);
    if ((pack.reports || []).length) sections.push(['reports', 'Reports']);

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = activity.filter((ev) => ev.event_date && ev.event_date >= today);
    const past = activity.filter((ev) => !ev.event_date || ev.event_date < today);
    const years = {};
    (pack.reports || []).forEach((report) => {
        const year = report.academic_year || 'Reports';
        years[year] = years[year] || [];
        years[year].push(report);
    });

    return `
        <a class="dp-go" href="departments.html">All departments</a>
        <section class="dp-hero dp-reveal">
            <div>
                <span class="dp-kicker"><i></i>${dpText(d.code)}</span>
                <h2>${accentName(d.name)}</h2>
                ${d.description ? `<p class="dp-lead">${dpText(d.description)}</p>` : ''}
                <div class="dp-actions">
                    <a class="dp-btn dp-btn-primary" href="admissions.html">Admissions</a>
                    ${contact ? `<a class="dp-btn dp-btn-soft" href="${dpText(contact)}">${contactLabel}</a>` : ''}
                </div>
                <div class="dp-stats">
                    ${d.duration ? `<div class="dp-stat">${dpIcon(DP_ICONS.clock)}<span><small>Duration</small><strong>${dpText(d.duration)}</strong></span></div>` : ''}
                    ${d.intake != null ? `<div class="dp-stat">${dpIcon(DP_ICONS.users)}<span><small>Intake</small><strong>${dpText(d.intake)}</strong></span></div>` : ''}
                    ${labs.length ? `<div class="dp-stat">${dpIcon(DP_ICONS.flask)}<span><small>Laboratories</small><strong>${labs.length}</strong></span></div>` : ''}
                </div>
            </div>
            <div class="dp-frame">
                <div class="dp-media">${d.image_url ? `<img src="${dpText(d.image_url)}" alt="" loading="lazy">` : ''}</div>
                ${hod ? `<aside class="dp-chip dp-chip-hod">${avatar(hod)}<span><strong>${dpText(hod.name)}</strong><span>${hodIsInCharge(hod) ? 'HOD, in charge' : 'Head of Department'}</span></span></aside>` : ''}
                ${d.intake != null ? `<aside class="dp-chip dp-chip-intake"><span><strong>Intake ${dpText(d.intake)}</strong><span>seats</span></span></aside>` : ''}
            </div>
        </section>
        ${sections.length ? `<nav class="dp-jump" aria-label="On this page">${sections.map(([id, label], index) => `<a href="#dp-${id}" class="${index ? '' : 'is-active'}">${label}</a>`).join('')}</nav>` : ''}
        ${facts ? `<section class="dp-section" id="dp-facts"><h3>Quick facts</h3><div class="dp-facts">${facts}</div></section>` : ''}
        ${(d.vision || d.mission) ? `<section class="dp-section" id="dp-vision"><h3>Vision and mission</h3><div class="dp-pair">
            ${d.vision ? `<article class="dp-note dp-reveal"><h3>Vision</h3><p>${dpText(d.vision)}</p></article>` : ''}
            ${d.mission ? `<article class="dp-note dp-reveal"><h3>Mission</h3><p>${dpText(d.mission)}</p></article>` : ''}
        </div></section>` : ''}
        ${(hod || faculty.length) ? `<section class="dp-section" id="dp-people"><h3>Head of department and faculty</h3><div class="dp-grid">${[hod, ...faculty].filter(Boolean).map((person) => `
            <article class="dp-person${person.role === 'HOD' ? ' dp-hod' : ''} dp-reveal">${avatar(person)}<div><strong>${dpText(person.name)}</strong>${person.role || person.designation ? `<div>${dpText(person.role === 'HOD' ? 'Head of Department' : (person.designation || person.role))}</div>` : ''}</div></article>`).join('')}</div></section>` : ''}
        <section class="dp-section" id="dp-labs"><h3>Laboratories and facilities</h3>${labs.length ? `<div class="dp-grid">${labs.map(laboratoryCard).join('')}</div>` : '<p class="dp-club-empty">No laboratories have been added to this department yet.</p>'}</section>
        ${careers.length ? `<section class="dp-section" id="dp-careers"><h3>Career paths</h3><div class="dp-pills">${careers.map((item) => `<span>${dpText(item)}</span>`).join('')}</div></section>` : ''}
        <section class="dp-section dp-clubs" id="dp-clubs">
            <h3>Student Clubs</h3>
            ${(pack.clubs || []).length ? `<div class="dp-club-grid">${pack.clubs.map(departmentClubCard).join('')}</div>` : '<p class="dp-club-empty">No student clubs have been added to this department yet.</p>'}
        </section>
        ${activity.length ? `<section class="dp-section" id="dp-events"><h3>Activities and events</h3>
            <div class="dp-tabs" role="tablist"><button class="dp-tab" type="button" role="tab" aria-selected="true" data-dp-tab="upcoming">Upcoming</button><button class="dp-tab" type="button" role="tab" aria-selected="false" data-dp-tab="past">Past</button></div>
            <div class="dp-grid" data-dp-panel="upcoming">${upcoming.map(contentCard).join('') || '<p>No upcoming activities.</p>'}</div>
            <div class="dp-grid" data-dp-panel="past" hidden>${past.map(contentCard).join('') || '<p>No past activities.</p>'}</div>
        </section>` : ''}
        ${(pack.notices || []).length ? `<section class="dp-section" id="dp-notices"><h3>Notices and downloads</h3><div class="dp-grid">${pack.notices.map(contentCard).join('')}</div></section>` : ''}
        ${(pack.projects || []).length ? `<section class="dp-section" id="dp-projects"><h3>Projects and achievements</h3><div class="dp-grid">${pack.projects.map(contentCard).join('')}</div></section>` : ''}
        ${photos.length ? `<section class="dp-section" id="dp-gallery"><h3>Photo gallery</h3><div class="dp-grid">${photos.map((photo, index) => `
            <button class="dp-card" type="button" data-dp-photo="${index}">
                <div class="dp-media">${photo.media_type === 'video' ? `<span class="dp-code">Video</span>` : `<img src="${dpText(photo.image_url)}" alt="" loading="lazy">`}</div>
                ${photo.title || photo.caption ? `<div class="dp-body"><h3>${dpText(photo.title || photo.caption)}</h3></div>` : ''}
            </button>`).join('')}</div></section>` : ''}
        ${Object.keys(years).length ? `<section class="dp-section" id="dp-reports"><h3>Activity reports</h3>${Object.keys(years).map((year) => `<h4>${dpText(year)}</h4><div class="dp-grid">${years[year].map(contentCard).join('')}</div>`).join('')}</section>` : ''}
        ${(others || []).length ? `<section class="dp-section"><h3>Other departments</h3><div class="dp-grid dp-thirds">${others.map(deptCard).join('')}</div></section>` : ''}`;
}

let dpPhotos = [];
let dpPhotoIndex = 0;

function ensureDpLightbox() {
    let box = document.getElementById('dpLightbox');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'dpLightbox';
    box.className = 'dp-light';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `<button class="dp-x" type="button" aria-label="Close">Close</button><button class="dp-prev" type="button" aria-label="Previous">Prev</button><figure><img alt=""><figcaption></figcaption></figure><button class="dp-next" type="button" aria-label="Next">Next</button>`;
    document.body.appendChild(box);
    box.querySelector('.dp-x').addEventListener('click', closeDpLightbox);
    box.querySelector('.dp-prev').addEventListener('click', () => stepDpPhoto(-1));
    box.querySelector('.dp-next').addEventListener('click', () => stepDpPhoto(1));
    box.addEventListener('click', (event) => { if (event.target === box) closeDpLightbox(); });
    let startX = 0;
    box.addEventListener('touchstart', (event) => { startX = event.changedTouches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (event) => {
        const delta = event.changedTouches[0].clientX - startX;
        if (Math.abs(delta) > 40) stepDpPhoto(delta < 0 ? 1 : -1);
    });
    return box;
}

function showDpPhoto() {
    const box = ensureDpLightbox();
    const photo = dpPhotos[dpPhotoIndex];
    if (!photo) return;
    const img = box.querySelector('img');
    img.src = photo.image_url || '';
    img.alt = photo.title || photo.caption || 'Department photo';
    box.querySelector('figcaption').textContent = photo.title || photo.caption || '';
    box.hidden = false;
    box.querySelector('.dp-x').focus();
}

function openDpLightbox(photos, index) {
    dpPhotos = photos || [];
    dpPhotoIndex = index || 0;
    showDpPhoto();
}

function stepDpPhoto(step) {
    if (!dpPhotos.length) return;
    dpPhotoIndex = (dpPhotoIndex + step + dpPhotos.length) % dpPhotos.length;
    showDpPhoto();
}

function closeDpLightbox() {
    const box = document.getElementById('dpLightbox');
    if (box) box.hidden = true;
}

document.addEventListener('keydown', (event) => {
    const box = document.getElementById('dpLightbox');
    if (!box || box.hidden) return;
    if (event.key === 'Escape') closeDpLightbox();
    if (event.key === 'ArrowRight') stepDpPhoto(1);
    if (event.key === 'ArrowLeft') stepDpPhoto(-1);
});

function openDeptMedia(btn) {
    const type = btn.getAttribute('data-type');
    const image = btn.getAttribute('data-image');
    const video = btn.getAttribute('data-video');
    if (type === 'video' && video) window.open(video, '_blank', 'noopener');
    else if (image) openDpLightbox([{ image_url: image }], 0);
}

function bindDepartmentPage(root, photos) {
    root.querySelectorAll('.dp-club-cover img').forEach((img) => {
        img.addEventListener('error', () => {
            if (img.classList.contains('dp-club-logo')) {
                img.remove();
                return;
            }
            const mark = document.createElement('span');
            mark.className = 'dp-club-fallback';
            mark.setAttribute('aria-hidden', 'true');
            mark.textContent = (img.getAttribute('alt') || 'C').trim().charAt(0).toUpperCase() || 'C';
            img.replaceWith(mark);
        });
    });
    root.querySelectorAll('[data-dp-tab]').forEach((tab) => {
        tab.addEventListener('click', () => {
            root.querySelectorAll('[data-dp-tab]').forEach((item) => item.setAttribute('aria-selected', item === tab ? 'true' : 'false'));
            root.querySelectorAll('[data-dp-panel]').forEach((panel) => { panel.hidden = panel.getAttribute('data-dp-panel') !== tab.getAttribute('data-dp-tab'); });
        });
    });
    root.querySelectorAll('[data-dp-photo]').forEach((button) => {
        button.addEventListener('click', () => openDpLightbox(photos, Number(button.getAttribute('data-dp-photo'))));
    });
    const links = [...root.querySelectorAll('.dp-jump a')];
    if (links.length && 'IntersectionObserver' in window) {
        const spy = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                links.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id));
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        root.querySelectorAll('.dp-section[id]').forEach((section) => spy.observe(section));
    }
    revealDepartmentNodes(root);
}

function revealDepartmentNodes(root) {
    if (!window.dpRevealObserver && 'IntersectionObserver' in window) {
        window.dpRevealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) entry.target.classList.add('is-in');
            });
        }, { threshold: 0.12 });
    }
    (root || document).querySelectorAll('.dp-reveal').forEach((node) => {
        if (window.dpRevealObserver) window.dpRevealObserver.observe(node);
        else node.classList.add('is-in');
    });
}

function departmentSkeleton() {
    return `<div class="dp-grid dp-thirds">${'<div class="dp-skel"></div>'.repeat(6)}</div>`;
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
    if (code === 'RP') code = 'RPA';
    if (code === 'EE') code = 'EEE';
    if (code === 'BME') code = 'BM';
    container.innerHTML = departmentSkeleton();
    try {
        if (code) {
            const response = await fetch(`/api/departments/${encodeURIComponent(code)}`, { cache: 'no-store' });
            if (response.status === 404) code = '';
            else if (!response.ok) throw new Error('Request failed');
            else {
                const d = await response.json();
                const [staff, events, gallery, bundle, all] = await Promise.all([
                    fetchJSON(`/api/staff?department=${encodeURIComponent(d.code)}`).catch(() => []),
                    fetchJSON(`/api/events?department=${encodeURIComponent(d.code)}`).catch(() => []),
                    fetchJSON(`/api/gallery?department=${d.id}`).catch(() => []),
                    fetchJSON(`/api/department-content/public/${encodeURIComponent(d.code)}`).catch(() => null),
                    fetchJSON('/api/departments').catch(() => []),
                ]);
                const photos = ((bundle && bundle.gallery) || gallery || []).filter((item) => item.image_url || item.video_url);
                document.body.classList.add('dp-detail');
                container.innerHTML = detailHTML(d, staff, events, gallery, bundle, (all || []).filter((item) => item.code !== d.code));
                bindDepartmentPage(container, photos);
                return;
            }
        }
        document.body.classList.remove('dp-detail');
        const depts = await fetchJSON('/api/departments');
        if (!depts.length) {
            container.innerHTML = '<p class="text-sm text-slate-500">No departments published yet.</p>';
            return;
        }
        container.innerHTML = `<div class="dp-grid dp-thirds">${depts.map(deptCard).join('')}</div>`;
        revealDepartmentNodes(container);
    } catch (e) {
        renderErrorState(container, 'Unable to load department information.', loadDepartmentsPage);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDepartmentsPage);
} else {
    loadDepartmentsPage();
}

if ('MutationObserver' in window) {
    const root = document.getElementById('deptContainer');
    if (root) {
        new MutationObserver(() => revealDepartmentNodes(root)).observe(root, { childList: true, subtree: true });
    }
}
