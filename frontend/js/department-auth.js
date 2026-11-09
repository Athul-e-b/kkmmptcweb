/**
 * Department login session. Separate from the administrator token.
 * The department name always comes from GET /api/department-auth/me.
 */
const DEPT_TOKEN_KEY = 'kkm_department_token';

function getDepartmentToken() {
    return sessionStorage.getItem(DEPT_TOKEN_KEY);
}

function clearDepartmentToken() {
    sessionStorage.removeItem(DEPT_TOKEN_KEY);
}

async function departmentApi(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    const token = getDepartmentToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(path, Object.assign({}, options, { headers }));
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    return { res, data };
}

function departmentErrorText(data, fallback) {
    const detail = data && data.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail)) {
        return detail.map(departmentValidationItem).filter(Boolean).join('; ') || fallback;
    }
    return fallback;
}

function departmentValidationItem(item) {
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
