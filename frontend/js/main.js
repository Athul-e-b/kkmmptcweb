/**
 * KKMMPTC Kallettumkara - Main Portal JavaScript
 */

// Shared escaping helper — used anywhere user-submitted or dynamic text is
// inserted via innerHTML, to avoid a trivial self-XSS via form fields
// (e.g. a name typed into the pre-registration or notice forms).
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// NOTICE BOARD — pulled live from the backend (published via admin.html's
// "Publish New Notice" form). Real database now, so every visitor sees the
// same notices — no longer per-browser localStorage. Falls back to the
// static curated list in data.js only if the API is unreachable.
async function renderNoticeBoard() {
    const grid = document.getElementById('noticeBoardGrid');
    if (!grid) return;

    let notices = [];
    try {
        const res = await fetch('/api/notices');
        if (res.ok) notices = await res.json();
    } catch (e) {
        console.error('Could not load notices', e);
    }
    // Fall back to the static curated list only if the API is unreachable
    // (e.g. viewing the frontend files without the backend running).
    if (notices.length === 0 && typeof KKM_DATA !== 'undefined' && KKM_DATA.notices) {
        notices = KKM_DATA.notices.map(n => ({ title: n.title, category: n.cat, created_at: n.date }));
    }
    const combined = notices.slice(0, 8);

    const catColors = {
        Admissions: 'bg-blue-100 text-blue-800',
        Examinations: 'bg-purple-100 text-purple-800',
        Exams: 'bg-purple-100 text-purple-800',
        Tender: 'bg-amber-100 text-amber-800',
        Placement: 'bg-emerald-100 text-emerald-800',
        General: 'bg-slate-100 text-slate-700'
    };

    grid.innerHTML = combined.map(n => `
        <button type="button" onclick="viewNotice('${escapeHTML(n.title).replace(/'/g, "\\'")}')" class="text-left bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-primary/40 transition card-hover-lift">
            <span class="${catColors[n.category] || catColors.General} text-[10px] font-bold px-2 py-0.5 rounded uppercase">${escapeHTML(n.category || 'General')}</span>
            <div class="text-slate-400 text-[10px] font-semibold mt-2">${escapeHTML(n.created_at ? new Date(n.created_at).toLocaleDateString() : '')}</div>
            <h3 class="font-bold text-slate-900 text-xs mt-1 leading-snug">${escapeHTML(n.title)}</h3>
        </button>
    `).join('') || `<p class="text-slate-400 text-xs col-span-4">No notices published yet.</p>`;
}

// HERO SLIDER LOGIC
let currentSlide = 0;
const slides = ['slide1', 'slide2', 'slide3'];
const heroTexts = [
    `
    <h1 class="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-heading leading-tight mb-4">
        Building Future Technocrats & Engineers
    </h1>
    <p class="text-slate-200 text-base sm:text-lg mb-8 leading-relaxed font-normal">
        K. Karunakaran Memorial Model Polytechnic College, Kallettumkara delivers premier 3-year diploma courses with industry-integrated learning, modern laboratories, and outstanding placement records.
    </p>
    `,
    `
    <h1 class="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-heading leading-tight mb-4">
        Industry on Campus (IOC) Program
    </h1>
    <p class="text-slate-200 text-base sm:text-lg mb-8 leading-relaxed font-normal">
        Earn while you learn! Real commercial production and technology servicing exposure embedded directly within institution workshops.
    </p>
    `,
    `
    <h1 class="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-heading leading-tight mb-4">
        State-of-the-Art Technical Labs
    </h1>
    <p class="text-slate-200 text-base sm:text-lg mb-8 leading-relaxed font-normal">
        Specialized training in Bio-Medical Instrumentation, Robotic Process Automation, Hardware Troubleshooting, and Smart Electronics.
    </p>
    `
];

function setSlide(index) {
    currentSlide = index;
    slides.forEach((id, i) => {
        const el = document.getElementById(id);
        const dot = document.getElementById('dot' + i);
        if (!el) return;
        if (i === index) {
            el.classList.remove('opacity-0');
            el.classList.add('opacity-100');
            if (dot) dot.className = 'w-10 h-2 rounded-full bg-accent transition-all duration-300';
        } else {
            el.classList.remove('opacity-100');
            el.classList.add('opacity-0');
            if (dot) dot.className = 'w-3 h-2 rounded-full bg-white/40 hover:bg-white transition-all duration-300';
        }
    });
    const textContainer = document.getElementById('heroTextContainer');
    if (textContainer) {
        textContainer.innerHTML = heroTexts[index];
    }
}

// Auto slider interval
setInterval(() => {
    if (document.getElementById('slide1')) {
        setSlide((currentSlide + 1) % slides.length);
    }
}, 6000);

// MOBILE MENU TOGGLE
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const icon = document.getElementById('menuIcon');
    if (!menu) return;

    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
        menu.classList.remove('hidden');
        if (icon) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-xmark');
        }
    } else {
        menu.classList.add('hidden');
        if (icon) {
            icon.classList.remove('fa-xmark');
            icon.classList.add('fa-bars');
        }
    }
}

// GENERIC MODAL TOGGLE
function toggleModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    
    modal.classList.toggle('hidden');

    if (id === 'videoModal') {
        const iframe = document.getElementById('tourIframe');
        if (iframe) {
            if (modal.classList.contains('hidden')) {
                iframe.src = '';
            } else {
                iframe.src = 'https://www.youtube-nocookie.com/embed/uA9Sv8OMAmo?autoplay=1';
            }
        }
    }

    if (id === 'searchModal' && !modal.classList.contains('hidden')) {
        setTimeout(() => {
            const input = document.getElementById('globalSearchInput');
            if (input) input.focus();
        }, 100);
    }
}

// ABOUT TABS SWITCHER
function switchAboutTab(tab) {
    const v = document.getElementById('tabContentVision');
    const m = document.getElementById('tabContentMission');
    const h = document.getElementById('tabContentHistory');

    if (v) v.classList.add('hidden');
    if (m) m.classList.add('hidden');
    if (h) h.classList.add('hidden');

    const bv = document.getElementById('tabBtnVision');
    const bm = document.getElementById('tabBtnMission');
    const bh = document.getElementById('tabBtnHistory');

    const inactiveClass = 'px-4 py-2 font-bold text-xs uppercase tracking-wider text-slate-500 hover:text-primary';
    const activeClass = 'px-4 py-2 font-bold text-xs uppercase tracking-wider text-primary border-b-2 border-primary';

    if (bv) bv.className = inactiveClass;
    if (bm) bm.className = inactiveClass;
    if (bh) bh.className = inactiveClass;

    if (tab === 'vision') {
        if (v) v.classList.remove('hidden');
        if (bv) bv.className = activeClass;
    } else if (tab === 'mission') {
        if (m) m.classList.remove('hidden');
        if (bm) bm.className = activeClass;
    } else if (tab === 'history') {
        if (h) h.classList.remove('hidden');
        if (bh) bh.className = activeClass;
    }
}

// DEPARTMENT DETAIL MODAL
function openDeptModal(code) {
    const container = document.getElementById('deptModalContent');
    if (!container) return;
    container.innerHTML = `<p class="text-xs text-slate-400">Loading…</p>`;
    toggleModal('deptModal');
    fetch(`/api/departments/${encodeURIComponent(String(code).toUpperCase())}`)
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((d) => {
            const hod = d.hod;
            const html = `
                <span class="bg-primary text-white text-[10px] font-bold px-2.5 py-0.5 rounded uppercase">${d.intake || ''} Seats ${d.duration ? '(' + escapeHTML(d.duration) + ')' : ''}</span>
                <h3 class="text-2xl font-bold font-heading text-slate-900 mt-2 mb-1">${escapeHTML(d.course_name || d.name)}</h3>
                <div class="flex items-center gap-2 text-xs text-primary font-semibold mb-3">
                    ${hod && hod.photo_url ? `<img src="${escapeHTML(hod.photo_url)}" class="w-8 h-8 rounded-full object-cover" alt="">` : ''}
                    <span>Head of Department: ${escapeHTML(hod ? hod.name : 'Not provided')}</span>
                </div>
                <p class="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4">${escapeHTML(d.description || '')}</p>
                <div class="flex gap-3 pt-4 border-t border-slate-100">
                    <a href="departments.html?department=${encodeURIComponent(d.code)}" class="bg-primary text-white font-bold px-5 py-2.5 rounded-lg text-xs shadow hover:bg-primary-dark transition inline-block">View Department</a>
                    <button type="button" onclick="toggleModal('deptModal')" class="bg-slate-100 text-slate-700 font-bold px-5 py-2.5 rounded-lg text-xs">Close</button>
                </div>`;
            container.innerHTML = html;
        })
        .catch(() => {
            container.innerHTML = `<p class="text-xs text-secondary">Unable to load department information.</p>`;
        });
}

async function loadModalHod(deptCode) {
    const hodLine = document.getElementById('modalHodLine');
    if (!hodLine) return;
    try {
        const res = await fetch(`/api/staff?department=${deptCode}`);
        if (!res.ok) return;
        const staff = await res.json();
        const hod = staff.find(s => s.role === 'HOD');
        if (!hod) return;
        const photo = hod.photo_url
            ? `<img src="${hod.photo_url}" alt="${escapeHTML(hod.name)}" class="w-8 h-8 rounded-full object-cover">`
            : `<span class="w-8 h-8 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center font-bold text-xs">${escapeHTML(hod.name.charAt(0))}</span>`;
        hodLine.innerHTML = `
            ${photo}
            <span>Head of Department: ${escapeHTML(hod.name)}${hod.email ? ` <span class="text-slate-400 font-normal">· ${escapeHTML(hod.email)}</span>` : ''}</span>
        `;
    } catch (e) {
        console.error('Could not load live HOD data', e);
    }
}

// GALLERY FILTER
// CAMPUS PHOTO GALLERY — pulled live from the backend (managed via
// admin.html). Each rendered item keeps the .gallery-item + category class
// convention that filterGallery() (below) already relies on, so the
// existing All/Labs/Events/Campus filter buttons keep working unchanged.
async function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;
    try {
        const res = await fetch('/api/gallery');
        const photos = res.ok ? await res.json() : [];
        window._galleryItems = photos;
        grid.innerHTML = photos.map((p, i) => {
            const isVideo = (p.media_type === 'video') || p.video_url;
            const thumb = p.image_url || '';
            return `
            <div class="gallery-item ${escapeHTML(p.category || '')} relative rounded-xl overflow-hidden shadow-sm group cursor-pointer h-52" onclick="openGalleryItem(${i})">
                ${isVideo
                    ? `<video src="${escapeHTML(p.video_url || '')}" class="w-full h-full object-cover bg-slate-900" muted></video>`
                    : `<img src="${escapeHTML(thumb)}" alt="${escapeHTML(p.title || p.caption || 'Campus photo')}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">`}
                ${isVideo ? `<span class="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded"><i class="fa-solid fa-play mr-1"></i>Video</span>` : ''}
                ${(p.title || p.caption) ? `<div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition flex items-end p-3 text-white text-xs font-bold">${escapeHTML(p.title || p.caption)}</div>` : ''}
            </div>`;
        }).join('') || `<p class="text-slate-400 text-xs col-span-4">No photos published yet.</p>`;
    } catch (e) {
        grid.innerHTML = `<p class="text-slate-400 text-xs col-span-4">Unable to load gallery. <button type="button" class="text-primary font-bold" onclick="renderGallery()">Try Again</button></p>`;
    }
}

function youtubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : null;
}

function openGalleryItem(index) {
    const items = window._galleryItems || [];
    const p = items[index];
    if (!p) return;
    const img = document.getElementById('lightboxImg');
    const vid = document.getElementById('lightboxVideo');
    const frame = document.getElementById('lightboxFrame');
    if (img) { img.classList.add('hidden'); img.src = ''; }
    if (vid) { vid.classList.add('hidden'); vid.removeAttribute('src'); vid.pause && vid.pause(); }
    if (frame) { frame.classList.add('hidden'); frame.src = ''; }
    const isVideo = p.media_type === 'video' || p.video_url;
    if (isVideo && p.video_url) {
        const yt = youtubeId(p.video_url);
        if (yt && frame) {
            frame.src = `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`;
            frame.classList.remove('hidden');
        } else if (vid) {
            vid.src = p.video_url;
            vid.classList.remove('hidden');
        }
    } else if (img && p.image_url) {
        img.src = p.image_url;
        img.classList.remove('hidden');
    }
    const modal = document.getElementById('lightboxModal');
    if (modal && modal.classList.contains('hidden')) toggleModal('lightboxModal');
}

function filterGallery(category) {
    const items = document.querySelectorAll('.gallery-item');
    const btns = document.querySelectorAll('.gallery-filter-btn');

    btns.forEach(btn => {
        if (btn.getAttribute('data-filter') === category) {
            btn.className = 'gallery-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white';
        } else {
            btn.className = 'gallery-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 hover:bg-slate-200';
        }
    });

    items.forEach(item => {
        if (category === 'all' || item.classList.contains(category)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// LIGHTBOX
function openLightbox(src) {
    const img = document.getElementById('lightboxImg');
    const vid = document.getElementById('lightboxVideo');
    const frame = document.getElementById('lightboxFrame');
    if (vid) { vid.classList.add('hidden'); vid.removeAttribute('src'); }
    if (frame) { frame.classList.add('hidden'); frame.src = ''; }
    if (img) {
        img.src = src;
        img.classList.remove('hidden');
    }
    toggleModal('lightboxModal');
}

// DOWNLOADS CENTER UNIFIED FILTER
let currentDocCategory = 'all';

function setDocCategory(cat) {
    currentDocCategory = cat;
    const btns = document.querySelectorAll('.doc-cat-btn');
    btns.forEach(btn => {
        if (btn.getAttribute('data-doc-cat') === cat) {
            btn.className = 'doc-cat-btn px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-white';
        } else {
            btn.className = 'doc-cat-btn px-3 py-1.5 rounded-md text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100';
        }
    });
    updateDocTable();
}

function updateDocTable() {
    const input = document.getElementById('docSearchInput');
    const query = (input ? input.value : '').toLowerCase();
    const rows = document.querySelectorAll('.doc-row');

    rows.forEach(row => {
        const rowCat = row.getAttribute('data-cat');
        const text = row.innerText.toLowerCase();
        const matchesCategory = (currentDocCategory === 'all' || rowCat === currentDocCategory);
        const matchesSearch = text.includes(query);

        if (matchesCategory && matchesSearch) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// GLOBAL SEARCH ENGINE
function executeGlobalSearch() {
    const input = document.getElementById('globalSearchInput');
    const query = (input ? input.value : '').toLowerCase().trim();
    const area = document.getElementById('searchResultsArea');
    if (!area) return;

    if (!query) {
        area.innerHTML = '<p class="text-slate-400 py-2">Please enter a search query.</p>';
        return;
    }

    const database = [
        { text: 'Bio-Medical Engineering Diploma Course Details & Syllabus', link: 'departments.html#dept-bm' },
        { text: 'Electronics Engineering 3-Year Regular Program', link: 'departments.html#dept-el' },
        { text: 'Computer Hardware Engineering Diploma', link: 'departments.html#dept-cm' },
        { text: 'Computer Engineering Diploma Program', link: 'departments.html#dept-ct' },
        { text: 'Robotic Process Automation (RPA) Diploma', link: 'departments.html#dept-rpa' },
        { text: 'Electrical & Electronics Engineering (EEE) Program', link: 'departments.html#dept-eee' },
        { text: 'Diploma Admissions 2026 Single Window Portal & Eligibility', link: 'admissions.html' },
        { text: 'Fee Calculator & Tuition Concessions (E-Grantz)', link: 'admissions.html#calculator' },
        { text: 'Principal Desk & IHRD Administration Contact', link: 'index.html#principal-message' },
        { text: 'Industry on Campus (IOC) Earn as You Learn Scheme', link: 'index.html#placements' },
        { text: 'Campus Facilities: Library, Specialized Labs, NSS, Women Cell', link: 'index.html#facilities' },
        { text: 'Downloads: Syllabus, Prospectus, AICTE EOA Documents', link: 'index.html#downloads' },
        { text: 'Grievance Redressal: File academic, administrative, or ragging complaints', link: 'grievance.html' },
        { text: 'Admin Content Management System', link: 'admin.html' }
    ];

    const results = database.filter(r => r.text.toLowerCase().includes(query));

    if (results.length === 0) {
        area.innerHTML = `<p class="text-slate-500 py-2">No exact matches found for "${query}". Try searching "Biomedical", "Fees", "Syllabus", or "Admissions".</p>`;
    } else {
        area.innerHTML = results.map(r => `
            <div class="py-2.5">
                <a href="${r.link}" onclick="toggleModal('searchModal')" class="font-bold text-primary hover:underline block">${r.text}</a>
            </div>
        `).join('');
    }
}

// FORM HANDLERS
function handleContactSubmit(e) {
    e.preventDefault();
    const nameEl = document.getElementById('contactName');
    const name = nameEl ? nameEl.value : 'Visitor';
    alert(`Thank you ${name}! Your inquiry has been logged for KKMMPTC Kallettumkara administrative office. We will get back to you shortly.`);
    e.target.reset();
}

function viewNotice(title) {
    const phone = (window.KKM_COLLEGE && window.KKM_COLLEGE.phone) || '0480-2720746';
    alert(`Notice Details: ${title}\n\nPlease contact the college office at ${phone}.`);
}

async function renderHomeDepartments() {
    const grid = document.getElementById('homeDeptGrid');
    if (!grid) return;
    try {
        const depts = await fetch('/api/departments').then((r) => r.ok ? r.json() : []);
        grid.innerHTML = depts.map((d) => {
            const desc = d.description ? (d.description.length > 120 ? d.description.slice(0, 117) + '…' : d.description) : '';
            const img = d.image_url || 'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=80&w=800';
            return `
            <div class="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition border border-slate-200 flex flex-col group">
                <div class="relative h-48 overflow-hidden">
                    <img src="${escapeHTML(img)}" alt="${escapeHTML(d.name)}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                    <div class="absolute top-3 right-3 bg-primary text-white text-[11px] font-bold px-2.5 py-1 rounded-md">${d.intake || 60} Seats</div>
                </div>
                <div class="p-6 flex-1 flex flex-col justify-between">
                    <div>
                        <span class="text-[10px] font-bold text-primary uppercase tracking-wider">Code: ${escapeHTML(d.code)}</span>
                        <h3 class="text-lg font-bold font-heading text-slate-900 mb-2">${escapeHTML(d.name)}</h3>
                        <p class="text-slate-600 text-xs leading-relaxed mb-4">${escapeHTML(desc)}</p>
                    </div>
                    <button type="button" onclick="openDeptModal('${escapeHTML(d.code)}')" class="text-xs font-bold text-primary hover:text-primary-dark inline-flex items-center gap-1">
                        Learn More & Quick Info <i class="fa-solid fa-chevron-right text-[10px]"></i>
                    </button>
                </div>
            </div>`;
        }).join('') || `<p class="text-slate-400 text-xs col-span-3">No departments published yet.</p>`;
    } catch (e) {
        grid.innerHTML = `<p class="text-slate-400 text-xs col-span-3">Unable to load departments. <button type="button" class="text-primary font-bold" onclick="renderHomeDepartments()">Try Again</button></p>`;
    }
}

// PRINCIPAL'S MESSAGE — pulled live from the backend (editable via
// department-admin.html). Falls back silently to the static placeholder
// markup already in index.html if the API is unreachable.
async function loadPrincipalMessage() {
    const nameEl = document.getElementById('principalName');
    if (!nameEl) return; // not on this page
    try {
        const res = await fetch('/api/principal');
        if (!res.ok) return;
        const p = await res.json();

        if (p.name) nameEl.textContent = p.name;
        const photoEl = document.getElementById('principalPhoto');
        if (photoEl && p.photo_url) photoEl.src = p.photo_url;
        const quoteEl = document.getElementById('principalQuote');
        if (quoteEl && p.quote) quoteEl.textContent = `"${p.quote}"`;
        const emailEl = document.getElementById('principalEmail');
        if (emailEl && p.email) emailEl.textContent = p.email;
        const phoneEl = document.getElementById('principalPhone');
        if (phoneEl && p.phone) phoneEl.textContent = p.phone;
        const msgEl = document.getElementById('principalMessage');
        if (msgEl && p.message) {
            msgEl.innerHTML = p.message.split(/\n\s*\n/)
                .map(para => `<p>${escapeHTML(para.trim())}</p>`).join('');
        }
    } catch (e) {
        console.error('Could not load principal message', e);
    }
}
// EVENTS BOARD — shows ALL events (college-wide ones with no department,
// plus every department's events) on the home page. Without this, events
// only appeared buried inside each department's page on departments.html,
// and college-wide events (department_id = null) had nowhere to display
// at all.
async function renderEventsBoard() {
    const grid = document.getElementById('eventsBoardGrid');
    if (!grid) return;

    let events = [];
    try {
        const res = await fetch('/api/events');
        if (res.ok) events = await res.json();
    } catch (e) {
        console.error('Could not load events', e);
    }

    let deptMap = {};
    try {
        const res = await fetch('/api/departments');
        if (res.ok) {
            const depts = await res.json();
            deptMap = Object.fromEntries(depts.map(d => [d.id, d.code]));
        }
    } catch (e) { /* department badge is a nice-to-have, not critical */ }

    const combined = events.slice(0, 8);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = combined.filter((ev) => !ev.event_date || ev.event_date >= today);
    const past = combined.filter((ev) => ev.event_date && ev.event_date < today);
    const card = (ev) => `
        <div class="bg-white border border-slate-200 rounded-xl overflow-hidden card-hover-lift">
            ${ev.image_url ? `<img src="${ev.image_url}" alt="${escapeHTML(ev.title)}" class="w-full h-32 object-cover" loading="lazy">` : `<div class="w-full h-32 bg-primary/5 flex items-center justify-center text-primary"><i class="fa-solid fa-calendar-star text-2xl"></i></div>`}
            <div class="p-3">
                <div class="flex items-center gap-2 mb-1">
                    <span class="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase">${ev.department_id ? escapeHTML(deptMap[ev.department_id] || 'Dept') : 'College-wide'}</span>
                    ${ev.event_date ? `<span class="text-[10px] text-slate-400 font-semibold">${escapeHTML(ev.event_date)}</span>` : ''}
                </div>
                <h3 class="font-bold text-slate-900 text-xs leading-snug">${escapeHTML(ev.title)}</h3>
                ${ev.description ? `<p class="text-[11px] text-slate-500 mt-1 line-clamp-2">${escapeHTML(ev.description)}</p>` : ''}
            </div>
        </div>`;
    grid.innerHTML = upcoming.map(card).join('') || `<p class="text-slate-400 text-xs col-span-4">No upcoming events.</p>`;
    const pastGrid = document.getElementById('pastEventsGrid');
    if (pastGrid) pastGrid.innerHTML = past.map(card).join('') || `<p class="text-slate-400 text-xs">No past events listed.</p>`;
}

document.addEventListener('DOMContentLoaded', loadPrincipalMessage);
document.addEventListener('DOMContentLoaded', renderNoticeBoard);
document.addEventListener('DOMContentLoaded', renderEventsBoard);
document.addEventListener('DOMContentLoaded', renderGallery);
document.addEventListener('DOMContentLoaded', renderHomeDepartments);

// ANIMATED STATS COUNTER ON SCROLL
document.addEventListener('DOMContentLoaded', () => {
    const counters = document.querySelectorAll('.stat-counter');
    if (!counters.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = +counter.getAttribute('data-target');
                let count = 0;
                const speed = Math.ceil(target / 40);
                const updateCount = () => {
                    count += speed;
                    if (count < target) {
                        counter.innerText = count;
                        setTimeout(updateCount, 30);
                    } else {
                        counter.innerText = target;
                    }
                };
                updateCount();
                observer.unobserve(counter);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => observer.observe(counter));
});
