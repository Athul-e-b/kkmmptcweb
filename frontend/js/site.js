/**
 * Shared public-site helpers: college contact, loading/empty/error states.
 */
async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Request failed');
    return res.json();
}

function placeholderAvatar(name) {
    const ch = escapeHTML((name || '?').charAt(0).toUpperCase());
    return `<div class="w-full h-full bg-primary/10 text-primary flex items-center justify-center font-bold">${ch}</div>`;
}

function bindCollegeInfo(info) {
    if (!info) return;
    document.querySelectorAll('[data-college="name"]').forEach((el) => { el.textContent = info.name || el.textContent; });
    document.querySelectorAll('[data-college="short_name"]').forEach((el) => { el.textContent = info.short_name || el.textContent; });
    document.querySelectorAll('[data-college="address"]').forEach((el) => { el.textContent = info.address || el.textContent; });
    document.querySelectorAll('[data-college="phone"]').forEach((el) => { el.textContent = info.phone || el.textContent; });
    document.querySelectorAll('[data-college="mobile"]').forEach((el) => { el.textContent = info.mobile || el.textContent; });
    document.querySelectorAll('[data-college="email"]').forEach((el) => {
        el.textContent = info.email || el.textContent;
        if (el.tagName === 'A' && info.email) el.href = `mailto:${info.email}`;
    });
    document.querySelectorAll('[data-college="website"]').forEach((el) => {
        if (info.website) {
            el.textContent = info.website;
            if (el.tagName === 'A') el.href = info.website;
        }
    });
    document.querySelectorAll('[data-college="youtube"]').forEach((el) => {
        if (info.youtube_url && el.tagName === 'A') el.href = info.youtube_url;
    });
    document.querySelectorAll('[data-college="office_hours"]').forEach((el) => { el.textContent = info.office_hours || el.textContent; });
}

async function loadCollegeInfo() {
    try {
        const info = await fetchJSON('/api/college-info');
        bindCollegeInfo(info);
        window.KKM_COLLEGE = info;
        return info;
    } catch (e) {
        return null;
    }
}

function renderErrorState(container, message, retryFn) {
    if (!container) return;
    container.innerHTML = `
        <div class="col-span-full text-center py-10">
            <p class="text-sm text-slate-600 mb-3">${escapeHTML(message || 'Unable to load this content.')}</p>
            ${retryFn ? `<button type="button" class="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg" data-retry="1">Try Again</button>` : ''}
        </div>`;
    const btn = container.querySelector('[data-retry]');
    if (btn && retryFn) btn.addEventListener('click', retryFn);
}

function renderLoadingState(container, label) {
    if (!container) return;
    container.innerHTML = `<p class="col-span-full text-xs text-slate-400 py-8 text-center">${escapeHTML(label || 'Loading…')}</p>`;
}

document.addEventListener('DOMContentLoaded', loadCollegeInfo);
