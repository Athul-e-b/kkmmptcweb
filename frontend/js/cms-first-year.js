let fyAdmin = null;
let fyTab = "general";
let fyEditingSubject = null;
let fyEditingFaculty = null;
let fyEditingAssignment = null;
let fyEditingResource = null;
let fyEditingLab = null;
let fySubjectQuery = "";
let fySubjectSemester = "all";
let fySubjectCategory = "all";
const FY_CATEGORY = { common: "Common", shared: "Partially shared", branch: "Branch-specific" };

function fyEsc(value) {
    return typeof escapeHTML === "function" ? escapeHTML(value || "") : String(value || "");
}

async function cmsLoadFirstYear() {
    const panel = document.getElementById("fyAdmin");
    if (!panel) return;
    panel.innerHTML = `<p class="fy-loading">Loading first-year records…</p>`;
    try {
        fyAdmin = await apiCall("/api/admin/first-year");
        paintFyAdmin();
    } catch (err) {
        panel.innerHTML = `<p class="fy-error">${fyEsc(err.message)}</p>`;
    }
}

function paintFyAdmin() {
    const panel = document.getElementById("fyAdmin");
    if (!panel || !fyAdmin) return;
    const tabs = [
        ["general", "General Information"],
        ["subjects", "Subjects"],
        ["faculty", "Faculty"],
        ["assignments", "Faculty–Subject Assignments"],
        ["laboratories", "Laboratories"],
        ["resources", "Study Materials"],
        ["semesters", "Semester Information"],
    ];
    const revision = fyAdmin.revision;
    panel.innerHTML = `
        <div class="fy-shell">
            <div class="fy-head">
                <div>
                    <p class="fy-kicker">Academic management</p>
                    <h2>First Year Management</h2>
                    <p>${revision ? fyEsc(revision.name) + (revision.academic_year ? " · " + fyEsc(revision.academic_year) : "") : "No active revision"}</p>
                </div>
                <a class="fy-preview" href="first-year.html" target="_blank" rel="noopener">Preview public page</a>
            </div>
            <div class="fy-tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" aria-selected="${fyTab === id ? "true" : "false"}" data-fy-tab="${id}">${label}</button>`).join("")}</div>
            <div id="fyPane"></div>
        </div>`;
    panel.querySelectorAll("[data-fy-tab]").forEach((button) => {
        button.addEventListener("click", () => {
            fyTab = button.getAttribute("data-fy-tab");
            paintFyAdmin();
        });
    });
    const pane = document.getElementById("fyPane");
    if (fyTab === "general") pane.innerHTML = generalPane();
    if (fyTab === "subjects") pane.innerHTML = subjectPane();
    if (fyTab === "faculty") pane.innerHTML = facultyPane();
    if (fyTab === "assignments") pane.innerHTML = assignmentPane();
    if (fyTab === "semesters") pane.innerHTML = semesterPane();
    if (fyTab === "resources") pane.innerHTML = resourcePane();
    if (fyTab === "laboratories") pane.innerHTML = labPane();
    bindFyPane(pane);
}

function generalPane() {
    const page = fyAdmin.revision || {};
    return `<form id="fyPageForm" class="fy-card grid sm:grid-cols-2 gap-3">
        <label>Page heading<input name="heading" value="${fyEsc(page.heading)}" class="fy-input"></label>
        <label>Heading accent<input name="heading_accent" value="${fyEsc(page.heading_accent)}" class="fy-input"></label>
        <label>Introduction title<input name="intro_title" value="${fyEsc(page.intro_title)}" class="fy-input"></label>
        <label>Revision name<input name="name" value="${fyEsc(page.name)}" class="fy-input"></label>
        <label class="sm:col-span-2">Hero subtitle<textarea name="hero_subtitle" rows="2" class="fy-input">${fyEsc(page.hero_subtitle)}</textarea></label>
        <label class="sm:col-span-2">Description<textarea name="description" rows="3" class="fy-input">${fyEsc(page.description)}</textarea></label>
        <label class="sm:col-span-2">Academic overview<textarea name="overview_text" rows="2" class="fy-input">${fyEsc(page.overview_text)}</textarea></label>
        <label class="sm:col-span-2">Announcements, one on each line<textarea name="announcements" rows="3" class="fy-input">${fyEsc(page.announcements)}</textarea></label>
        <label>Academic year<input name="academic_year" value="${fyEsc(page.academic_year)}" class="fy-input"></label>
        <label>Hero background<input id="fyHeroFile" type="file" accept=".jpg,.jpeg,.png,.webp" class="fy-input">${page.hero_image_url ? `<a href="${fyEsc(page.hero_image_url)}" target="_blank" rel="noopener">Current image</a>` : ""}</label>
        <div class="sm:col-span-2 flex flex-wrap gap-2">
            <button class="fy-save" type="submit">Save</button>
            <a class="fy-preview" href="first-year.html" target="_blank" rel="noopener">Preview</a>
        </div>
    </form>`;
}

function programmeChecks(selected) {
    const chosen = new Set((selected || []).map(String));
    return (fyAdmin.programmes || []).map((item) => `<label class="inline-flex items-center gap-1 mr-3 text-xs"><input type="checkbox" name="department_ids" value="${item.id}" ${chosen.has(String(item.id)) ? "checked" : ""}> ${fyEsc(item.label)}</label>`).join("");
}

function semesterOptions(selected) {
    return (fyAdmin.semesters || []).map((item) => `<option value="${item.id}" ${String(item.id) === String(selected) ? "selected" : ""}>${fyEsc(item.title)}</option>`).join("");
}

function subjectChecks(selected) {
    const chosen = new Set((selected || []).map(String));
    return (fyAdmin.subjects || []).map((item) => `<label class="flex items-center gap-2 text-xs"><input type="checkbox" name="subject_ids" value="${item.id}" ${chosen.has(String(item.id)) ? "checked" : ""}> ${fyEsc(item.course_code)} ${fyEsc(item.name)}</label>`).join("");
}

function visibleSubjects() {
    const query = fySubjectQuery.trim().toLowerCase();
    return (fyAdmin.subjects || []).filter((item) => {
        if (fySubjectSemester !== "all" && String(item.semester) !== fySubjectSemester) return false;
        if (fySubjectCategory !== "all" && item.category !== fySubjectCategory) return false;
        if (!query) return true;
        return `${item.course_code} ${item.name} ${(item.programmes || []).map((row) => row.label).join(" ")}`.toLowerCase().includes(query);
    });
}

function subjectRows() {
    return visibleSubjects().map((item) => `<tr>
        <td>${fyEsc(item.course_code)}</td>
        <td>${fyEsc(item.name)}</td>
        <td>${fyEsc(item.semester_title || item.semester)}</td>
        <td>${fyEsc((item.programmes || []).map((row) => row.label).join(", "))}</td>
        <td>${fyEsc(FY_CATEGORY[item.category] || item.category)}</td>
        <td>${item.is_active ? "Active" : "Inactive"}</td>
        <td class="fy-actions">
            <button type="button" data-fy-edit-subject="${item.id}">Edit</button>
            <button type="button" data-fy-delete-subject="${item.id}">Delete</button>
            <label>Syllabus<input type="file" accept=".pdf,.doc,.docx" data-fy-syllabus="${item.id}"></label>
            ${item.syllabus_url ? `<a href="${fyEsc(item.syllabus_url)}" target="_blank" rel="noopener">Download</a>` : ""}
        </td>
    </tr>`).join("") || `<tr><td colspan="7">No subjects match this search.</td></tr>`;
}

function subjectPane() {
    const editing = fyEditingSubject;
    return `
        <form id="fySubjectForm" class="fy-card grid sm:grid-cols-2 gap-3">
            <label>Course code<input name="course_code" required maxlength="20" value="${fyEsc(editing && editing.course_code)}" class="fy-input"></label>
            <label>Subject name<input name="name" required maxlength="200" value="${fyEsc(editing && editing.name)}" class="fy-input"></label>
            <label>Semester<select name="semester_id" class="fy-input">${semesterOptions(editing && editing.semester_id)}</select></label>
            <label>Category<select name="category" class="fy-input">
                <option value="">Set from programmes</option>
                ${Object.entries(FY_CATEGORY).map(([value, label]) => `<option value="${value}" ${editing && editing.category === value ? "selected" : ""}>${label}</option>`).join("")}
            </select></label>
            <label class="sm:col-span-2">Description<textarea name="description" rows="2" class="fy-input">${fyEsc(editing && editing.description)}</textarea></label>
            <div class="sm:col-span-2"><p class="fy-label">Applicable programmes</p>${programmeChecks(editing && (editing.programmes || []).map((item) => item.id))}</div>
            <label class="fy-check"><input type="checkbox" name="is_active" ${!editing || editing.is_active ? "checked" : ""}> Active</label>
            <div class="sm:col-span-2 flex flex-wrap gap-2">
                <button class="fy-save" type="submit">${editing ? "Save subject" : "Add subject"}</button>
                ${editing ? `<button class="fy-quiet" type="button" id="fySubjectCancel">Cancel</button>` : ""}
            </div>
        </form>
        <div class="fy-filters">
            <input id="fySubjectSearch" type="search" value="${fyEsc(fySubjectQuery)}" placeholder="Search code or subject" class="fy-input">
            <select id="fySubjectSemester" class="fy-input"><option value="all">All semesters</option>${(fyAdmin.semesters || []).map((item) => `<option value="${item.number}" ${String(fySubjectSemester) === String(item.number) ? "selected" : ""}>${fyEsc(item.title)}</option>`).join("")}</select>
            <select id="fySubjectCategory" class="fy-input"><option value="all">All categories</option>${Object.entries(FY_CATEGORY).map(([value, label]) => `<option value="${value}" ${fySubjectCategory === value ? "selected" : ""}>${label}</option>`).join("")}</select>
        </div>
        <div class="fy-table-wrap"><table class="fy-table"><thead><tr><th>Code</th><th>Subject</th><th>Semester</th><th>Programmes</th><th>Category</th><th>Status</th><th></th></tr></thead><tbody id="fySubjectRows">${subjectRows()}</tbody></table></div>`;
}

function facultyPane() {
    const editing = fyEditingFaculty;
    const staffOptions = (fyAdmin.staff || []).map((item) => `<option value="${item.id}" ${editing && String(editing.staff_id) === String(item.id) ? "selected" : ""}>${fyEsc(item.name)}${item.department ? " · " + fyEsc(item.department) : ""}</option>`).join("");
    const deptOptions = (fyAdmin.programmes || []).map((item) => `<option value="${item.id}" ${editing && String(editing.department_id) === String(item.id) ? "selected" : ""}>${fyEsc(item.name)}</option>`).join("");
    return `
        <form id="fyFacultyForm" class="fy-card grid sm:grid-cols-2 gap-3">
            <label class="sm:col-span-2">Existing staff member<select name="staff_id" class="fy-input"><option value="">Create a new staff record</option>${staffOptions}</select></label>
            <label>Name<input name="name" value="${fyEsc(editing && editing.name)}" class="fy-input"></label>
            <label>Designation<input name="designation" value="${fyEsc(editing && editing.designation)}" class="fy-input"></label>
            <label>Department<select name="department_id" class="fy-input"><option value="">Select</option>${deptOptions}</select></label>
            <label class="fy-check"><input type="checkbox" name="is_active" ${!editing || editing.is_active ? "checked" : ""}> Active on the public page</label>
            <label class="sm:col-span-2">Profile<textarea name="profile" rows="3" class="fy-input">${fyEsc(editing && editing.profile)}</textarea></label>
            <div class="sm:col-span-2 flex gap-2"><button class="fy-save" type="submit">${editing ? "Save faculty" : "Add faculty"}</button>${editing ? `<button class="fy-quiet" type="button" id="fyFacultyCancel">Cancel</button>` : ""}</div>
        </form>
        <div class="fy-table-wrap"><table class="fy-table"><thead><tr><th>Name</th><th>Designation</th><th>Department</th><th>Status</th><th></th></tr></thead><tbody>
            ${(fyAdmin.faculty || []).map((item) => `<tr>
                <td>${fyEsc(item.name)}</td><td>${fyEsc(item.designation)}</td><td>${fyEsc(item.department)}</td><td>${item.is_active ? "Active" : "Inactive"}</td>
                <td class="fy-actions"><button type="button" data-fy-edit-faculty="${item.id}">Edit</button><button type="button" data-fy-faculty-active="${item.id}" data-active="${item.is_active ? 0 : 1}">${item.is_active ? "Deactivate" : "Activate"}</button><label>Photo<input type="file" accept=".jpg,.jpeg,.png,.webp" data-fy-photo="${item.id}"></label></td>
            </tr>`).join("") || `<tr><td colspan="5">No first-year faculty profiles yet.</td></tr>`}
        </tbody></table></div>`;
}

function assignmentPane() {
    const editing = fyEditingAssignment;
    const staffOptions = (fyAdmin.staff || []).map((item) => `<option value="${item.id}" ${editing && String(editing.staff_id) === String(item.id) ? "selected" : ""}>${fyEsc(item.name)}</option>`).join("");
    return `
        <form id="fyAssignForm" class="grid gap-3 text-xs">
            <label>Faculty<select name="staff_id" required class="mt-1 w-full px-3 py-2 rounded-lg border">${staffOptions}</select></label>
            <label>Semester<select name="semester_id" class="mt-1 w-full px-3 py-2 rounded-lg border">${semesterOptions(editing && editing.semester_id)}</select></label>
            <label>Academic year<input name="academic_year" value="${fyEsc(editing && editing.academic_year)}" class="mt-1 w-full px-3 py-2 rounded-lg border"></label>
            <div><p class="font-semibold mb-1">Subjects</p><div class="max-h-40 overflow-auto border rounded-lg p-2">${subjectChecks(editing ? [editing.subject_id] : [])}</div></div>
            <div><p class="font-semibold mb-1">Programmes</p>${programmeChecks(editing ? [editing.department_id] : [])}</div>
            <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg w-max" type="submit">${editing ? "Update assignment" : "Save assignment"}</button>
        </form>
        <div class="overflow-x-auto mt-4">
            <table class="w-full text-left text-xs">
                <thead class="bg-slate-50"><tr><th class="p-2">Faculty</th><th class="p-2">Subject</th><th class="p-2">Course code</th><th class="p-2">Semester</th><th class="p-2">Programme</th><th class="p-2"></th></tr></thead>
                <tbody>${(fyAdmin.assignments || []).map((item) => `<tr class="border-t">
                    <td class="p-2">${fyEsc(item.faculty)}</td>
                    <td class="p-2">${fyEsc(item.subject)}</td>
                    <td class="p-2">${fyEsc(item.course_code)}</td>
                    <td class="p-2">${fyEsc(item.semester)}</td>
                    <td class="p-2">${fyEsc(item.programme)}</td>
                    <td class="p-2 whitespace-nowrap">
                        <button type="button" class="text-primary font-bold" data-fy-edit-assignment="${item.id}">Edit</button>
                        <button type="button" class="text-red-600 font-bold ml-2" data-fy-delete-assignment="${item.id}">Remove</button>
                    </td>
                </tr>`).join("")}</tbody>
            </table>
        </div>`;
}

function semesterPane() {
    const revision = fyAdmin.revision || {};
    return `<form id="fySemesterForm" class="grid gap-3 text-xs">
        ${(fyAdmin.semesters || []).map((item) => `<fieldset class="border rounded-xl p-3"><legend class="px-1 font-bold">${fyEsc(item.title)}</legend>
            <input type="hidden" name="semester_id" value="${item.id}">
            <label class="block">Title<input name="title_${item.id}" value="${fyEsc(item.title)}" class="mt-1 w-full px-3 py-2 rounded-lg border"></label>
            <label class="block mt-2">Description<textarea name="description_${item.id}" rows="2" class="fy-input">${fyEsc(item.description)}</textarea></label>
            <label class="block mt-2">Status<select name="status_${item.id}" class="fy-input"><option value="active" ${item.status === "active" ? "selected" : ""}>Active</option><option value="inactive" ${item.status === "inactive" ? "selected" : ""}>Inactive</option></select></label>
        </fieldset>`).join("")}
        <label>Academic year<input name="academic_year" value="${fyEsc(revision.academic_year)}" class="mt-1 w-full px-3 py-2 rounded-lg border"></label>
        <label>Syllabus revision<input name="name" value="${fyEsc(revision.name)}" class="fy-input"></label>
        <label>Revision status<select name="revision_status" class="mt-1 w-full px-3 py-2 rounded-lg border"><option value="active" ${revision.status === "active" ? "selected" : ""}>Active</option><option value="archived" ${revision.status === "archived" ? "selected" : ""}>Archived</option></select></label>
        <button class="bg-primary text-white font-bold px-4 py-2 rounded-lg w-max" type="submit">Save semester settings</button>
    </form>`;
}

function resourcePane() {
    const editing = fyEditingResource;
    const kinds = ["syllabus", "notes", "study", "timetable", "practical", "other"];
    const labels = { syllabus: "Syllabus", notes: "Lecture notes", study: "Study material", timetable: "Timetable", practical: "Practical record", other: "Other" };
    return `<form id="fyResourceForm" class="fy-card grid sm:grid-cols-2 gap-3">
        <label>Title<input name="title" required value="${fyEsc(editing && editing.title)}" class="fy-input"></label>
        <label>Type<select name="kind" class="fy-input">${kinds.map((item) => `<option value="${item}" ${editing && editing.kind === item ? "selected" : ""}>${labels[item]}</option>`).join("")}</select></label>
        <label>Semester<select name="semester_id" class="fy-input"><option value="">Any</option>${semesterOptions(editing && editing.semester_id)}</select></label>
        <label>Programme<select name="department_id" class="fy-input"><option value="">All</option>${(fyAdmin.programmes || []).map((item) => `<option value="${item.id}" ${editing && String(editing.department_id) === String(item.id) ? "selected" : ""}>${fyEsc(item.label)}</option>`).join("")}</select></label>
        <label class="sm:col-span-2">Subject<select name="subject_id" class="fy-input"><option value="">None</option>${(fyAdmin.subjects || []).map((item) => `<option value="${item.id}" ${editing && String(editing.subject_id) === String(item.id) ? "selected" : ""}>${fyEsc(item.course_code)} ${fyEsc(item.name)}</option>`).join("")}</select></label>
        <label class="fy-check"><input type="checkbox" name="is_published" ${!editing || editing.is_published ? "checked" : ""}> Published</label>
        <label>File<input name="file" type="file" accept=".pdf,.doc,.docx" class="fy-input"></label>
        <div class="sm:col-span-2 flex gap-2"><button class="fy-save" type="submit">${editing ? "Save material" : "Add material"}</button>${editing ? `<button class="fy-quiet" type="button" id="fyResourceCancel">Cancel</button>` : ""}</div>
    </form>
    <div class="fy-table-wrap"><table class="fy-table"><thead><tr><th>Title</th><th>Type</th><th>Semester</th><th>File</th><th>Uploaded</th><th>Download</th><th></th></tr></thead><tbody>
        ${(fyAdmin.resources || []).map((item) => `<tr>
            <td>${fyEsc(item.title)}</td>
            <td>${fyEsc(labels[item.kind] || item.kind)}</td>
            <td>${item.semester ? fyEsc(item.semester) : "Any"}</td>
            <td>${fyEsc(item.original_name || "—")}</td>
            <td>${fyEsc((item.created_at || "").slice(0, 10))}</td>
            <td>${item.file_url ? `<a href="${fyEsc(item.file_url)}" target="_blank" rel="noopener">Download</a>` : "No file"}</td>
            <td class="fy-actions"><button type="button" data-fy-edit-resource="${item.id}">Edit</button><button type="button" data-fy-delete-resource="${item.id}">Delete</button></td>
        </tr>`).join("") || `<tr><td colspan="7">No study materials yet.</td></tr>`}
    </tbody></table></div>`;
}

function labPane() {
    const editing = fyEditingLab;
    return `<form id="fyLabForm" class="grid gap-3 text-xs">
        <label>Laboratory name<input name="name" required value="${fyEsc(editing && editing.name)}" class="mt-1 w-full px-3 py-2 rounded-lg border"></label>
        <label>Description<textarea name="description" rows="2" class="mt-1 w-full px-3 py-2 rounded-lg border">${fyEsc(editing && editing.description)}</textarea></label>
        <label>Facilities and equipment<textarea name="facilities_text" rows="2" class="mt-1 w-full px-3 py-2 rounded-lg border">${fyEsc(editing && editing.facilities_text)}</textarea></label>
        <div><p class="font-semibold mb-1">Programmes</p>${programmeChecks(editing && editing.department_ids)}</div>
        <div><p class="font-semibold mb-1">Subjects</p><div class="max-h-40 overflow-auto border rounded-lg p-2">${subjectChecks(editing && editing.subject_ids)}</div></div>
        <label class="inline-flex items-center gap-2"><input type="checkbox" name="is_active" ${!editing || editing.is_active ? "checked" : ""}> Active</label>
        <div class="flex gap-2"><button class="bg-primary text-white font-bold px-4 py-2 rounded-lg" type="submit">${editing ? "Save laboratory" : "Add laboratory"}</button>${editing ? `<button type="button" id="fyLabCancel" class="border px-4 py-2 rounded-lg">Cancel</button>` : ""}</div>
    </form>
    <div class="space-y-2 mt-4">${(fyAdmin.laboratories || []).map((item) => `<article class="border rounded-xl p-3 text-xs"><div class="flex justify-between gap-2"><strong>${fyEsc(item.name)}</strong><span><button type="button" class="text-primary font-bold" data-fy-edit-lab="${item.id}">Edit</button> <button type="button" class="text-red-600 font-bold" data-fy-delete-lab="${item.id}">Delete</button></span></div><label class="mt-2 block">Photograph<input type="file" accept=".jpg,.jpeg,.png,.webp" data-fy-lab-photo="${item.id}"></label></article>`).join("") || `<p class="text-xs text-slate-500">No laboratories yet.</p>`}</div>`;
}

function checkedValues(form, name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => Number(input.value));
}

function bindFyPane(pane) {
    const pageForm = pane.querySelector("#fyPageForm");
    if (pageForm) pageForm.addEventListener("submit", savePage);
    const hero = pane.querySelector("#fyHeroFile");
    if (hero) hero.addEventListener("change", uploadHero);
    const search = pane.querySelector("#fySubjectSearch");
    if (search) search.addEventListener("input", () => { fySubjectQuery = search.value; const body = document.getElementById("fySubjectRows"); if (body) body.innerHTML = subjectRows(); bindSubjectRows(pane); });
    const semesterFilter = pane.querySelector("#fySubjectSemester");
    if (semesterFilter) semesterFilter.addEventListener("change", () => { fySubjectSemester = semesterFilter.value; paintFyAdmin(); });
    const categoryFilter = pane.querySelector("#fySubjectCategory");
    if (categoryFilter) categoryFilter.addEventListener("change", () => { fySubjectCategory = categoryFilter.value; paintFyAdmin(); });
    const subjectForm = pane.querySelector("#fySubjectForm");
    if (subjectForm) subjectForm.addEventListener("submit", saveSubject);
    const cancel = pane.querySelector("#fySubjectCancel");
    if (cancel) cancel.addEventListener("click", () => { fyEditingSubject = null; paintFyAdmin(); });
    pane.querySelectorAll("[data-fy-edit-subject]").forEach((button) => button.addEventListener("click", () => {
        fyEditingSubject = (fyAdmin.subjects || []).find((item) => String(item.id) === button.getAttribute("data-fy-edit-subject"));
        paintFyAdmin();
    }));
    pane.querySelectorAll("[data-fy-delete-subject]").forEach((button) => button.addEventListener("click", () => deleteSubject(button.getAttribute("data-fy-delete-subject"))));
    pane.querySelectorAll("[data-fy-syllabus]").forEach((input) => input.addEventListener("change", () => uploadSyllabus(input)));
    const facultyForm = pane.querySelector("#fyFacultyForm");
    if (facultyForm) facultyForm.addEventListener("submit", saveFaculty);
    pane.querySelectorAll("[data-fy-photo]").forEach((input) => input.addEventListener("change", () => uploadFacultyPhoto(input)));
    const facultyCancel = pane.querySelector("#fyFacultyCancel");
    if (facultyCancel) facultyCancel.addEventListener("click", () => { fyEditingFaculty = null; paintFyAdmin(); });
    pane.querySelectorAll("[data-fy-edit-faculty]").forEach((button) => button.addEventListener("click", () => {
        fyEditingFaculty = (fyAdmin.faculty || []).find((item) => String(item.id) === button.getAttribute("data-fy-edit-faculty"));
        paintFyAdmin();
    }));
    pane.querySelectorAll("[data-fy-faculty-active]").forEach((button) => button.addEventListener("click", () => setFacultyActive(button.getAttribute("data-fy-faculty-active"), button.getAttribute("data-active"))));
    const assignForm = pane.querySelector("#fyAssignForm");
    if (assignForm) assignForm.addEventListener("submit", saveAssignment);
    pane.querySelectorAll("[data-fy-edit-assignment]").forEach((button) => button.addEventListener("click", () => {
        const row = (fyAdmin.assignments || []).find((item) => String(item.id) === button.getAttribute("data-fy-edit-assignment"));
        const semester = (fyAdmin.semesters || []).find((item) => item.number === row.semester);
        fyEditingAssignment = Object.assign({}, row, { semester_id: semester && semester.id });
        paintFyAdmin();
    }));
    pane.querySelectorAll("[data-fy-delete-assignment]").forEach((button) => button.addEventListener("click", () => removeAssignment(button.getAttribute("data-fy-delete-assignment"))));
    const semesterForm = pane.querySelector("#fySemesterForm");
    if (semesterForm) semesterForm.addEventListener("submit", saveSemesters);
    const resourceForm = pane.querySelector("#fyResourceForm");
    if (resourceForm) resourceForm.addEventListener("submit", saveResource);
    pane.querySelectorAll("[data-fy-delete-resource]").forEach((button) => button.addEventListener("click", () => deleteResource(button.getAttribute("data-fy-delete-resource"))));
    const resourceCancel = pane.querySelector("#fyResourceCancel");
    if (resourceCancel) resourceCancel.addEventListener("click", () => { fyEditingResource = null; paintFyAdmin(); });
    pane.querySelectorAll("[data-fy-edit-resource]").forEach((button) => button.addEventListener("click", () => {
        fyEditingResource = (fyAdmin.resources || []).find((item) => String(item.id) === button.getAttribute("data-fy-edit-resource"));
        paintFyAdmin();
    }));
    const labForm = pane.querySelector("#fyLabForm");
    if (labForm) labForm.addEventListener("submit", saveLab);
    const labCancel = pane.querySelector("#fyLabCancel");
    if (labCancel) labCancel.addEventListener("click", () => { fyEditingLab = null; paintFyAdmin(); });
    pane.querySelectorAll("[data-fy-edit-lab]").forEach((button) => button.addEventListener("click", () => {
        fyEditingLab = (fyAdmin.laboratories || []).find((item) => String(item.id) === button.getAttribute("data-fy-edit-lab"));
        paintFyAdmin();
    }));
    pane.querySelectorAll("[data-fy-delete-lab]").forEach((button) => button.addEventListener("click", () => deleteLab(button.getAttribute("data-fy-delete-lab"))));
    pane.querySelectorAll("[data-fy-lab-photo]").forEach((input) => input.addEventListener("change", () => uploadLabPhoto(input)));
}

async function saveSubject(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
        course_code: data.get("course_code"),
        name: data.get("name"),
        semester_id: Number(data.get("semester_id")),
        category: data.get("category") || null,
        description: data.get("description") || "",
        department_ids: checkedValues(form, "department_ids"),
        is_active: form.querySelector('[name="is_active"]').checked ? 1 : 0,
    };
    try {
        if (fyEditingSubject) await apiCall(`/api/admin/first-year/subjects/${fyEditingSubject.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        else await apiCall("/api/admin/first-year/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        fyEditingSubject = null;
        toast("Subject saved");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function deleteSubject(id) {
    const subject = (fyAdmin.subjects || []).find((item) => String(item.id) === String(id));
    if (!confirm(`Delete ${subject ? subject.course_code + " " + subject.name : "this subject"}? Assignments, resources and laboratory links must be removed first.`)) return;
    try {
        await apiCall(`/api/admin/first-year/subjects/${id}`, { method: "DELETE" });
        toast("Subject deleted");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function uploadSyllabus(input) {
    if (!input.files || !input.files[0]) return;
    const body = new FormData();
    body.append("file", input.files[0]);
    try {
        await apiCall(`/api/admin/first-year/subjects/${input.getAttribute("data-fy-syllabus")}/syllabus`, { method: "POST", body });
        toast("Syllabus uploaded");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function saveFaculty(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
        staff_id: data.get("staff_id") ? Number(data.get("staff_id")) : null,
        name: data.get("name") || "",
        designation: data.get("designation") || "",
        department_id: data.get("department_id") ? Number(data.get("department_id")) : null,
        profile: data.get("profile") || "",
        is_active: event.currentTarget.querySelector('[name="is_active"]').checked ? 1 : 0,
    };
    try {
        await apiCall("/api/admin/first-year/faculty", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast("Faculty saved");
        fyEditingFaculty = null;
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function uploadFacultyPhoto(input) {
    if (!input.files || !input.files[0]) return;
    const body = new FormData();
    body.append("file", input.files[0]);
    try {
        await apiCall(`/api/admin/first-year/faculty/${input.getAttribute("data-fy-photo")}/photo`, { method: "POST", body });
        toast("Photograph saved");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function saveAssignment(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
        staff_id: Number(data.get("staff_id")),
        semester_id: Number(data.get("semester_id")),
        subject_ids: checkedValues(form, "subject_ids"),
        department_ids: checkedValues(form, "department_ids"),
        academic_year: data.get("academic_year") || "",
        replace_id: fyEditingAssignment ? fyEditingAssignment.id : null,
    };
    try {
        await apiCall("/api/admin/first-year/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast("Assignment saved");
        fyEditingAssignment = null;
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function removeAssignment(id) {
    if (!confirm("Remove this faculty assignment?")) return;
    try {
        await apiCall(`/api/admin/first-year/assignments/${id}`, { method: "DELETE" });
        toast("Assignment removed");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function saveSemesters(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ids = data.getAll("semester_id");
    try {
        for (const id of ids) {
            await apiCall(`/api/admin/first-year/semesters/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: data.get(`title_${id}`),
                    status: data.get(`status_${id}`),
                    description: data.get(`description_${id}`) || "",
                    academic_year: data.get("academic_year") || "",
                    name: data.get("name") || "",
                    revision_status: data.get("revision_status"),
                }),
            });
        }
        toast("Semester settings saved");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function savePage(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {};
    ["heading", "heading_accent", "intro_title", "name", "hero_subtitle", "description", "overview_text", "announcements", "academic_year"].forEach((key) => { payload[key] = data.get(key) || ""; });
    try {
        await apiCall("/api/admin/first-year/page", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast("Page details saved");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function uploadHero(event) {
    const input = event.currentTarget;
    if (!input.files || !input.files[0]) return;
    const body = new FormData();
    body.append("file", input.files[0]);
    try {
        await apiCall("/api/admin/first-year/hero", { method: "POST", body });
        toast("Hero image saved");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function setFacultyActive(id, active) {
    try {
        await apiCall(`/api/admin/first-year/faculty/${id}/active`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: Number(active) }) });
        toast(Number(active) ? "Faculty activated" : "Faculty deactivated");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

function bindSubjectRows(pane) {
    pane.querySelectorAll("[data-fy-edit-subject]").forEach((button) => button.addEventListener("click", () => {
        fyEditingSubject = (fyAdmin.subjects || []).find((item) => String(item.id) === button.getAttribute("data-fy-edit-subject"));
        paintFyAdmin();
    }));
    pane.querySelectorAll("[data-fy-delete-subject]").forEach((button) => button.addEventListener("click", () => deleteSubject(button.getAttribute("data-fy-delete-subject"))));
    pane.querySelectorAll("[data-fy-syllabus]").forEach((input) => input.addEventListener("change", () => uploadSyllabus(input)));
}

async function saveResource(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    const payload = {
        title: data.get("title"),
        kind: data.get("kind"),
        semester_id: data.get("semester_id") ? Number(data.get("semester_id")) : null,
        department_id: data.get("department_id") ? Number(data.get("department_id")) : null,
        subject_id: data.get("subject_id") ? Number(data.get("subject_id")) : null,
        is_published: event.currentTarget.querySelector('[name="is_published"]').checked ? 1 : 0,
    };
    try {
        if (fyEditingResource) {
            await apiCall(`/api/admin/first-year/resources/${fyEditingResource.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (file && file.name) {
                const body = new FormData();
                body.append("file", file);
                await apiCall(`/api/admin/first-year/resources/${fyEditingResource.id}/file`, { method: "POST", body });
            }
            fyEditingResource = null;
            toast("Study material saved");
        } else {
            const body = new FormData();
            body.append("title", payload.title);
            body.append("kind", payload.kind);
            body.append("is_published", String(payload.is_published));
            if (payload.semester_id) body.append("semester_id", String(payload.semester_id));
            if (payload.department_id) body.append("department_id", String(payload.department_id));
            if (payload.subject_id) body.append("subject_id", String(payload.subject_id));
            if (file && file.name) body.append("file", file);
            await apiCall("/api/admin/first-year/resources", { method: "POST", body });
            toast("Study material added");
        }
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function deleteResource(id) {
    if (!confirm("Delete this learning resource?")) return;
    try {
        await apiCall(`/api/admin/first-year/resources/${id}`, { method: "DELETE" });
        toast("Resource deleted");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function saveLab(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
        name: data.get("name"),
        description: data.get("description") || "",
        facilities_text: data.get("facilities_text") || "",
        department_ids: checkedValues(form, "department_ids"),
        subject_ids: checkedValues(form, "subject_ids"),
        is_active: form.querySelector('[name="is_active"]').checked ? 1 : 0,
    };
    try {
        if (fyEditingLab) await apiCall(`/api/admin/first-year/laboratories/${fyEditingLab.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        else await apiCall("/api/admin/first-year/laboratories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        fyEditingLab = null;
        toast("Laboratory saved");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function deleteLab(id) {
    if (!confirm("Delete this laboratory and its photographs?")) return;
    try {
        await apiCall(`/api/admin/first-year/laboratories/${id}`, { method: "DELETE" });
        toast("Laboratory deleted");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}

async function uploadLabPhoto(input) {
    if (!input.files || !input.files[0]) return;
    const body = new FormData();
    body.append("file", input.files[0]);
    try {
        await apiCall(`/api/admin/first-year/laboratories/${input.getAttribute("data-fy-lab-photo")}/photos`, { method: "POST", body });
        toast("Photograph added");
        cmsLoadFirstYear();
    } catch (err) {
        toast(err.message, false);
    }
}
