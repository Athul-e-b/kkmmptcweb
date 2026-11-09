/**
 * KKMMPTC Kallettumkara - Shared Admin Authentication
 * Used by BOTH admin.html (notices/applications) and department-admin.html
 * Both pages must use the same element IDs for this to work:
 *   #loginPanel, #adminWorkspace, #logoutBtn, #adminPasswordInput, #loginError
 *
 * Each page defines its own `onAdminWorkspaceReady()` async function
 * (loaded AFTER this script) with whatever data-loading it needs once
 * logged in — this file calls it automatically after login/on page load.
 */

const ADMIN_TOKEN_KEY = 'kkm_dept_admin_token';

function getAdminToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

async function apiCall(path, options = {}) {
    const headers = options.headers || {};
    const token = getAdminToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        showLoginPanel();
        throw new Error('Session expired — please sign in again.');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
        throw new Error(formatApiError(data, res.status));
    }
    return data;
}

function formatApiError(data, status) {
    const d = data && data.detail;
    if (typeof d === 'string' && d.trim()) return d;
    if (Array.isArray(d)) {
        return d.map(formatValidationItem).filter(Boolean).join('; ') || `Request failed (${status})`;
    }
    if (d && typeof d === 'object') return formatValidationItem(d);
    return `Request failed (${status})`;
}

function formatValidationItem(item) {
    const loc = Array.isArray(item.loc) ? item.loc.filter((part) => part !== 'body' && typeof part !== 'number') : [];
    const key = loc.length ? String(loc[loc.length - 1]) : '';
    const labels = {
        name: 'Name',
        designation: 'Designation',
        email: 'Email',
        username: 'Username',
        password: 'Password',
        confirm_password: 'Confirm password',
        department_id: 'Department',
    };
    const label = labels[key] || key.replaceAll('_', ' ');
    const msg = item.msg || item.message || 'Invalid value';
    if (!label) return msg;
    if (msg === 'Field required') return `${label} is required`;
    return `${label}: ${msg}`;
}

async function adminLogin(e) {
    e.preventDefault();
    const password = document.getElementById('adminPasswordInput').value;
    const errorBox = document.getElementById('loginError');
    const button = e.target && e.target.querySelector ? e.target.querySelector('button[type="submit"]') : null;
    const previousLabel = button ? button.textContent : '';
    errorBox.classList.add('hidden');
    if (button) {
        button.disabled = true;
        button.textContent = 'Signing in…';
    }
    try {
        const result = await apiCall('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        sessionStorage.setItem(ADMIN_TOKEN_KEY, result.access_token);
        await showAdminWorkspace();
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
        if (button) {
            button.disabled = false;
            button.textContent = previousLabel || 'Sign In';
        }
    }
}

function adminLogout() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    showLoginPanel();
}

// Kept as an alias since department-admin.html's inline HTML calls
// deptLogin/deptLogout by name — both point at the same shared logic.
function deptLogin(e) { return adminLogin(e); }
function deptLogout() { return adminLogout(); }

function showLoginPanel() {
    document.getElementById('loginPanel').classList.remove('hidden');
    document.getElementById('adminWorkspace').classList.add('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');
}

async function showAdminWorkspace() {
    document.getElementById('loginPanel').classList.add('hidden');
    document.getElementById('adminWorkspace').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    if (typeof onAdminWorkspaceReady === 'function') {
        await onAdminWorkspaceReady();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (getAdminToken()) {
        showAdminWorkspace();
    } else {
        showLoginPanel();
    }
});
