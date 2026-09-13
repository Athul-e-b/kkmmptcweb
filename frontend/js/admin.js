/**
 * KKMMPTC Kallettumkara - Admin Panel (Notices + Applications)
 * Talks to the FastAPI backend (main.py) — real shared database, gated by
 * the shared admin password (see js/admin-auth.js for login/session).
 * Replaces the earlier localStorage-only version: notices published here
 * are now visible to every visitor, not just the browser that published
 * them, and this page can no longer be used without signing in.
 */

// Called by admin-auth.js once login succeeds (or a valid session is already stored).
async function onAdminWorkspaceReady() {
    await Promise.all([renderAdminAppQueue(), loadNoticesAdmin()]);
}

// ---------- Applications ----------
async function renderAdminAppQueue() {
    const tableBody = document.getElementById('adminAppTableBody');
    if (!tableBody) return;

    let apps = [];
    try {
        apps = await apiCall('/api/applications');
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" class="p-3 text-secondary">${escapeHTML(err.message)}</td></tr>`;
        return;
    }

    const pendingCounter = document.getElementById('adminPendingCount');
    if (pendingCounter) {
        pendingCounter.innerText = apps.filter(a => a.status === 'New Submission' || a.status === 'Pending Review').length;
    }

    tableBody.innerHTML = apps.map((app) => {
        let badgeClass = "bg-blue-100 text-blue-800";
        if (app.status === "Verified" || app.status === "Approved") badgeClass = "bg-emerald-100 text-emerald-800";
        if (app.status === "Pending Review") badgeClass = "bg-amber-100 text-amber-800";

        return `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-3 font-mono font-bold text-slate-700">APP-${String(app.id).padStart(4, '0')}</td>
                <td class="p-3 font-semibold text-slate-900">${escapeHTML(app.name)}</td>
                <td class="p-3 text-slate-600">${escapeHTML(app.dept)}</td>
                <td class="p-3 text-slate-600">${escapeHTML(app.phone || '—')}</td>
                <td class="p-3 text-slate-500">${new Date(app.created_at).toLocaleDateString()}</td>
                <td class="p-3"><span class="${badgeClass} px-2 py-0.5 rounded text-[11px] font-bold">${escapeHTML(app.status)}</span></td>
                <td class="p-3 text-right">
                    <button type="button" onclick="updateAppStatus(${app.id}, 'Verified')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[10px] font-bold mr-1">Verify</button>
                    <button type="button" onclick="deleteApp(${app.id})" class="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-[10px] font-bold">Delete</button>
                </td>
            </tr>
        `;
    }).join('') || `<tr><td colspan="7" class="p-3 text-slate-400">No applications submitted yet.</td></tr>`;
}

async function updateAppStatus(id, newStatus) {
    try {
        await apiCall(`/api/applications/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        await renderAdminAppQueue();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteApp(id) {
    if (!confirm("Are you sure you want to remove this pre-registration record?")) return;
    try {
        await apiCall(`/api/applications/${id}`, { method: 'DELETE' });
        await renderAdminAppQueue();
    } catch (err) {
        alert(err.message);
    }
}

// ---------- Notices ----------
async function loadNoticesAdmin() {
    const circularCount = document.getElementById('adminCircularsCount');
    try {
        const notices = await apiCall('/api/notices');
        if (circularCount) circularCount.innerText = notices.length;
    } catch (err) {
        console.error('Could not load notices', err);
    }
}

async function adminPublishNotice() {
    const titleInput = document.getElementById('adminNoticeTitle');
    const catInput = document.getElementById('adminNoticeCat');
    const descInput = document.getElementById('adminNoticeDesc');

    if (!titleInput || !titleInput.value.trim()) {
        alert("Please enter a notice title.");
        return;
    }

    const title = titleInput.value.trim();
    const category = catInput ? catInput.value : 'Admissions';
    const description = descInput ? descInput.value.trim() : '';

    try {
        await apiCall('/api/notices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, description }),
        });
        await loadNoticesAdmin();
        alert(`Notice Published Successfully!\nTitle: ${title}\nCategory: ${category}\n\nThis is now live on the public Notice Board for every visitor.`);
        titleInput.value = '';
        if (descInput) descInput.value = '';
    } catch (err) {
        alert(err.message);
    }
}
