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
        return detail.map((item) => item.msg || item.message || '').filter(Boolean).join('; ') || fallback;
    }
    return fallback;
}
