let fyPack = null;
let fySemester = 1;
let fyProgramme = "all";
let fyCategory = "all";
let fyFacultySemester = "all";
let fyFacultyProgramme = "all";
let fyFacultySubject = "all";

function fyText(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function fySrc(url) {
    const value = String(url || "").trim();
    if (!value) return "";
    if (value.charAt(0) === "/" && value.charAt(1) !== "/") return value;
    try {
        const parsed = new URL(value, window.location.origin);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch (err) {
        return "";
    }
    return "";
}

function fyCategoryLabel(category) {
    if (category === "common") return "Common";
    if (category === "shared") return "Partially shared";
    if (category === "branch") return "Branch-specific";
    return "";
}

function fyResourceLabel(kind) {
    return {
        syllabus: "Syllabus",
        notes: "Notes",
        study: "Study material",
        timetable: "Timetable",
        practical: "Practical record",
        other: "Document",
    }[kind] || "Document";
}

async function loadFirstYear() {
    const root = document.getElementById("fyMain");
    if (!root) return;
    root.innerHTML = `<div class="fy-stats" aria-hidden="true"><div class="fy-skel"></div><div class="fy-skel"></div><div class="fy-skel"></div><div class="fy-skel"></div></div>`;
    try {
        const response = await fetch("/api/first-year");
        if (!response.ok) throw new Error("Request failed");
        fyPack = await response.json();
        if (fyPack.semesters && fyPack.semesters.length) fySemester = fyPack.semesters[0].number;
        applyFirstYearHero();
        paintFirstYear();
    } catch (err) {
        root.innerHTML = `<p class="fy-error">The first-year page could not be loaded. <button class="fy-btn fy-btn-primary" type="button" id="fyRetry">Retry</button></p>`;
        const retry = document.getElementById("fyRetry");
        if (retry) retry.addEventListener("click", loadFirstYear);
    }
}

function applyFirstYearHero() {
    const page = fyPack.revision || {};
    const kicker = document.getElementById("fyRevision");
    if (kicker) kicker.textContent = page.intro_title || page.name || "";
    const heading = document.getElementById("fyHeading");
    if (heading) {
        const accent = page.heading_accent ? `<span>${fyText(page.heading_accent)}</span>` : "";
        heading.innerHTML = `${fyText(page.heading || "")}${accent ? " " + accent : ""}`;
    }
    const lead = document.getElementById("fyLead");
    if (lead) lead.textContent = page.hero_subtitle || "";
    const description = document.getElementById("fyDescription");
    if (description) {
        description.textContent = page.description || "";
        description.hidden = !page.description;
    }
    const hero = document.querySelector(".fy-hero");
    const image = fySrc(page.hero_image_url);
    if (hero && image) {
        hero.style.backgroundImage = `linear-gradient(145deg, rgba(38,21,92,0.84), rgba(86,35,220,0.72)), url("${image}")`;
        hero.style.backgroundSize = "cover";
        hero.style.backgroundPosition = "center";
    }
    const notes = document.getElementById("fyAnnouncements");
    const lines = String(page.announcements || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (notes) notes.innerHTML = lines.length ? `<ul class="fy-highlights">${lines.map((line) => `<li>${fyText(line)}</li>`).join("")}</ul>` : "";
}

function paintFirstYear() {
    const root = document.getElementById("fyMain");
    const overview = fyPack.overview || {};
    const revision = fyPack.revision || {};
    const selectedSemester = (fyPack.semesters || []).find((item) => Number(item.number) === Number(fySemester));
    const subjects = filteredSubjects();
    const faculty = filteredFaculty();
    root.innerHTML = `
        <section class="fy-section" id="fy-overview" style="margin-top:0">
            <h2>Academic overview</h2>
            ${revision.overview_text ? `<p class="fy-intro">${fyText(revision.overview_text)}</p>` : ""}
            <div class="fy-stats">
                ${stat(overview.programmes, "Diploma programmes")}
                ${stat(overview.semesters, "Semesters")}
                ${stat(overview.common_subjects, "Common subjects")}
                ${stat(overview.branch_subjects, "Branch-specific subjects")}
                ${stat(overview.shared_subjects, "Partially shared subjects")}
            </div>
        </section>
        <section class="fy-section" id="fy-subjects">
            <h2>Subjects</h2>
            ${selectedSemester && selectedSemester.description ? `<p class="fy-intro">${fyText(selectedSemester.description)}</p>` : ""}
            <div class="fy-tabs" role="tablist" aria-label="Semester">${(fyPack.semesters || []).map((item) => `<button class="fy-tab" type="button" role="tab" aria-selected="${item.number === fySemester ? "true" : "false"}" data-fy-semester="${item.number}">${fyText(item.title || ("Semester " + item.number))}</button>`).join("")}</div>
            <div class="fy-tools">
                <div class="fy-filters" role="group" aria-label="Programme">${chip("all", "All programmes", fyProgramme, "data-fy-programme")}${(fyPack.programmes || []).map((item) => chip(item.label, item.label, fyProgramme, "data-fy-programme")).join("")}</div>
                <div class="fy-filters" role="group" aria-label="Subject group">
                    ${chip("all", "All subjects", fyCategory, "data-fy-category")}
                    ${chip("common", "Common subjects", fyCategory, "data-fy-category")}
                    ${chip("shared", "Partially shared", fyCategory, "data-fy-category")}
                    ${chip("branch", "Branch-specific subjects", fyCategory, "data-fy-category")}
                </div>
            </div>
            ${subjects.length ? `<div class="fy-grid">${subjects.map(subjectCard).join("")}</div>` : `<p class="fy-empty">No subjects match this selection.</p>`}
        </section>
        <section class="fy-section" id="fy-faculty">
            <h2>Meet Your First Year Faculty</h2>
            <p class="fy-intro">Only faculty with a published subject assignment are shown.</p>
            <div class="fy-tools">
                <div class="fy-filters" role="group" aria-label="Faculty semester">
                    ${chip("all", "All Faculty", fyFacultySemester, "data-fy-faculty-semester")}
                    ${(fyPack.semesters || []).map((item) => chip(String(item.number), item.title || ("Semester " + item.number), fyFacultySemester, "data-fy-faculty-semester")).join("")}
                </div>
                <div class="fy-filters" role="group" aria-label="Faculty programme">${chip("all", "All programmes", fyFacultyProgramme, "data-fy-faculty-programme")}${(fyPack.programmes || []).map((item) => chip(item.label, item.label, fyFacultyProgramme, "data-fy-faculty-programme")).join("")}</div>
                <label class="fy-intro">Subject
                    <select id="fySubjectFilter" class="fy-tab">${subjectOptions()}</select>
                </label>
            </div>
            ${faculty.length ? `<div class="fy-people">${faculty.map(facultyCard).join("")}</div>` : `<p class="fy-empty">${(fyPack.faculty || []).length ? "No faculty match this selection." : "Faculty subject assignments have not been published yet."}</p>`}
        </section>
        <section class="fy-section" id="fy-labs">
            <h2>Laboratories</h2>
            ${(fyPack.laboratories || []).length ? `<div class="fy-labs">${fyPack.laboratories.map(labCard).join("")}</div>` : `<p class="fy-empty">Laboratory details have not been added yet.</p>`}
        </section>
        <section class="fy-section" id="fy-resources">
            <h2>Learning resources</h2>
            ${(fyPack.resources || []).length ? `<div class="fy-resources">${fyPack.resources.map(resourceCard).join("")}</div>` : `<p class="fy-empty">Learning resources have not been added yet.</p>`}
        </section>`;
    bindFirstYear(root);
}

function stat(value, label) {
    return `<article class="fy-stat fy-reveal"><strong>${fyText(value == null ? 0 : value)}</strong><span>${fyText(label)}</span></article>`;
}

function chip(value, label, current, attr) {
    return `<button class="fy-chip" type="button" ${attr}="${fyText(value)}" aria-pressed="${String(value) === String(current) ? "true" : "false"}">${fyText(label)}</button>`;
}

function filteredSubjects() {
    return (fyPack.subjects || []).filter((subject) => {
        if (Number(subject.semester) !== Number(fySemester)) return false;
        if (fyCategory !== "all" && subject.category !== fyCategory) return false;
        if (fyProgramme !== "all" && !(subject.programmes || []).some((item) => item.label === fyProgramme || item.code === fyProgramme)) return false;
        return true;
    });
}

function filteredFaculty() {
    return (fyPack.faculty || []).map((person) => {
        const subjects = (person.subjects || []).filter((subject) => {
            if (fyFacultySemester !== "all" && String(subject.semester) !== String(fyFacultySemester)) return false;
            if (fyFacultySubject !== "all" && String(subject.subject_id) !== String(fyFacultySubject)) return false;
            if (fyFacultyProgramme !== "all" && !(subject.programmes || []).some((item) => item.label === fyFacultyProgramme || item.code === fyFacultyProgramme)) return false;
            return true;
        }).map((subject) => {
            if (fyFacultyProgramme === "all") return subject;
            return Object.assign({}, subject, {
                programmes: (subject.programmes || []).filter((item) => item.label === fyFacultyProgramme || item.code === fyFacultyProgramme),
            });
        });
        return Object.assign({}, person, { subjects });
    }).filter((person) => person.subjects.length);
}

function subjectOptions() {
    const options = [{ id: "all", name: "All subjects" }].concat(
        (fyPack.subjects || []).map((subject) => ({ id: subject.id, name: subject.course_code + " " + subject.name }))
    );
    const seen = new Set();
    return options.filter((item) => {
        if (seen.has(String(item.id))) return false;
        seen.add(String(item.id));
        return true;
    }).map((item) => `<option value="${fyText(item.id)}"${String(item.id) === String(fyFacultySubject) ? " selected" : ""}>${fyText(item.name)}</option>`).join("");
}

function subjectCard(subject) {
    const syllabus = fySrc(subject.syllabus_url);
    const programmes = (subject.programmes || []).map((item) => item.label).filter(Boolean);
    const badge = fyCategoryLabel(subject.category);
    return `<article class="fy-card fy-reveal">
        <span class="fy-code">${fyText(subject.course_code)}</span>
        <h3>${fyText(subject.name)}</h3>
        ${badge ? `<span class="fy-badge">${fyText(badge)}</span>` : ""}
        ${programmes.length ? `<ul class="fy-meta">${programmes.map((code) => `<li>${fyText(code)}</li>`).join("")}</ul>` : ""}
        ${subject.description ? `<p>${fyText(subject.description)}</p>` : ""}
        ${syllabus ? `<a class="fy-link" href="${fyText(syllabus)}">Syllabus</a>` : ""}
    </article>`;
}

function facultyCard(person) {
    const photo = fySrc(person.photo_url);
    const initial = fyText((person.name || "F").trim().charAt(0).toUpperCase() || "F");
    const dept = person.department && person.department.name ? person.department.name : "";
    return `<article class="fy-person fy-reveal">
        ${photo ? `<img class="fy-photo" src="${fyText(photo)}" alt="${fyText(person.name)}" loading="lazy" data-kkm-fill="cover">` : `<div class="fy-fallback" aria-hidden="true">${initial}</div>`}
        <div class="fy-person-body">
            ${person.designation ? `<small>${fyText(person.designation)}</small>` : ""}
            <h3>${fyText(person.name)}</h3>
            ${dept ? `<p>${fyText(dept)}</p>` : ""}
            ${person.profile ? `<p>${fyText(person.profile)}</p>` : ""}
            <ul>${person.subjects.map((subject) => `<li>${fyText(subject.name)} · Semester ${fyText(subject.semester)}${(subject.programmes || []).length ? ` · ${(subject.programmes || []).map((item) => item.label).join(", ")}` : ""}</li>`).join("")}</ul>
        </div>
    </article>`;
}

function labCard(lab) {
    const photo = fySrc((lab.photos || [])[0] && lab.photos[0].image_url);
    const programmes = (lab.programmes || []).map((item) => item.label).filter(Boolean);
    const subjects = (lab.subjects || []).map((item) => item.name).filter(Boolean);
    return `<article class="fy-lab fy-reveal">
        ${photo ? `<img class="fy-photo" src="${fyText(photo)}" alt="${fyText(lab.name)}" loading="lazy" data-kkm-fill="cover">` : ""}
        <div class="fy-lab-body">
            <h3>${fyText(lab.name)}</h3>
            ${lab.description ? `<p>${fyText(lab.description)}</p>` : ""}
            ${lab.facilities ? `<p>${fyText(lab.facilities)}</p>` : ""}
            ${programmes.length ? `<ul class="fy-meta">${programmes.map((code) => `<li>${fyText(code)}</li>`).join("")}</ul>` : ""}
            ${subjects.length ? `<ul>${subjects.map((name) => `<li>${fyText(name)}</li>`).join("")}</ul>` : ""}
        </div>
    </article>`;
}

function resourceCard(item) {
    const file = fySrc(item.file_url);
    const bits = [fyResourceLabel(item.kind), item.semester ? "Semester " + item.semester : "", item.programme && item.programme.label, item.subject && item.subject.course_code].filter(Boolean);
    return `<article class="fy-resource fy-reveal">
        <h3>${fyText(item.title)}</h3>
        ${bits.length ? `<ul class="fy-meta">${bits.map((bit) => `<li>${fyText(bit)}</li>`).join("")}</ul>` : ""}
        ${item.description ? `<p>${fyText(item.description)}</p>` : ""}
        ${file ? `<a class="fy-link" href="${fyText(file)}">Open file</a>` : ""}
    </article>`;
}

function bindFirstYear(root) {
    root.querySelectorAll("[data-fy-semester]").forEach((button) => {
        button.addEventListener("click", () => {
            fySemester = Number(button.getAttribute("data-fy-semester"));
            paintFirstYear();
        });
    });
    root.querySelectorAll("[data-fy-programme]").forEach((button) => {
        button.addEventListener("click", () => {
            fyProgramme = button.getAttribute("data-fy-programme");
            paintFirstYear();
        });
    });
    root.querySelectorAll("[data-fy-category]").forEach((button) => {
        button.addEventListener("click", () => {
            fyCategory = button.getAttribute("data-fy-category");
            paintFirstYear();
        });
    });
    root.querySelectorAll("[data-fy-faculty-semester]").forEach((button) => {
        button.addEventListener("click", () => {
            fyFacultySemester = button.getAttribute("data-fy-faculty-semester");
            paintFirstYear();
        });
    });
    root.querySelectorAll("[data-fy-faculty-programme]").forEach((button) => {
        button.addEventListener("click", () => {
            fyFacultyProgramme = button.getAttribute("data-fy-faculty-programme");
            paintFirstYear();
        });
    });
    const select = document.getElementById("fySubjectFilter");
    if (select) {
        select.addEventListener("change", () => {
            fyFacultySubject = select.value;
            paintFirstYear();
        });
    }
    root.querySelectorAll(".fy-photo").forEach((img) => {
        img.addEventListener("error", () => {
            const mark = document.createElement("div");
            mark.className = "fy-fallback";
            mark.setAttribute("aria-hidden", "true");
            mark.textContent = "F";
            img.replaceWith(mark);
        });
    });
}

document.addEventListener("DOMContentLoaded", loadFirstYear);
