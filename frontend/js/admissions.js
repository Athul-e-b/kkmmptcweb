/**
 * KKMMPTC Kallettumkara - Admissions & Fee Calculator Module
 */

const FEE_PROGRAMMES = {
    diploma: {
        tuition: 12705,
        tuitionPerSemester: true,
        admission: 600,
        caution: 2000,
        cautionLabel: 'Caution Deposit',
        additional: 0,
        exam: 0,
        examPerSemester: false,
        semesters: 6
    },
    let: {
        tuition: 12705,
        tuitionPerSemester: true,
        admission: 600,
        caution: 2000,
        cautionLabel: 'Caution Deposit',
        additional: 10500,
        exam: 0,
        examPerSemester: false,
        semesters: 4
    },
    pgdca: {
        tuition: 10000,
        tuitionPerSemester: true,
        admission: 300,
        caution: 600,
        cautionLabel: 'Caution Deposit',
        additional: 0,
        exam: 1000,
        examPerSemester: true,
        semesters: 2
    },
    dca: {
        tuition: 7500,
        tuitionPerSemester: false,
        admission: 300,
        caution: 600,
        cautionLabel: 'Caution Deposit (CD)',
        additional: 0,
        exam: 1000,
        examPerSemester: false,
        semesters: 1
    }
};

function formatINR(amount) {
    return `₹${Number(amount).toLocaleString('en-IN')}`;
}

function calculateFees() {
    const programmeKey = document.getElementById('calcProgramme')
        ? document.getElementById('calcProgramme').value
        : 'diploma';
    const category = document.getElementById('calcCategory')
        ? document.getElementById('calcCategory').value
        : 'gen';
    const plan = FEE_PROGRAMMES[programmeKey] || FEE_PROGRAMMES.diploma;
    const egrantz = category === 'egrantz' || category === 'sc_st';

    const tuition = egrantz ? 0 : plan.tuition;
    const additional = egrantz ? 0 : plan.additional;
    const exam = plan.exam;
    const admission = plan.admission;
    const caution = plan.caution;

    const firstSemester = tuition + admission + caution + additional + exam;
    const subsequent = plan.semesters > 1
        ? (tuition + (plan.examPerSemester ? exam : 0))
        : null;

    const rows = [
        {
            label: plan.tuitionPerSemester ? 'Tuition Fee (per semester)' : 'Tuition Fee',
            value: formatINR(tuition)
        },
        { label: 'Admission Fee (one-time)', value: formatINR(admission) },
        { label: `${plan.cautionLabel} (one-time)`, value: formatINR(caution) }
    ];
    if (plan.additional) {
        rows.push({ label: 'Additional Tuition Fee (one-time)', value: formatINR(additional) });
    }
    if (plan.exam) {
        rows.push({
            label: plan.examPerSemester ? 'Examination Fee (per semester)' : 'Examination Fee',
            value: formatINR(exam)
        });
    }

    const grid = document.getElementById('feeBreakupGrid');
    if (grid) {
        grid.innerHTML = rows.map((row) => `
            <div>
                <span class="text-slate-400">${row.label}:</span>
                <div class="font-bold text-sm text-white">${row.value}</div>
            </div>
        `).join('');
    }

    const firstEl = document.getElementById('resFirstTotal');
    const nextEl = document.getElementById('resNextTotal');
    const nextRow = document.getElementById('resNextRow');
    if (firstEl) firstEl.textContent = formatINR(firstSemester);
    if (nextRow) {
        if (subsequent === null) {
            nextRow.classList.add('hidden');
        } else {
            nextRow.classList.remove('hidden');
            if (nextEl) nextEl.textContent = formatINR(subsequent);
        }
    }
}

function checkEligibility() {
    const qual = document.getElementById('eligQual') ? document.getElementById('eligQual').value : 'sslc';
    const math = document.getElementById('eligMath') ? document.getElementById('eligMath').checked : true;
    const resultArea = document.getElementById('eligResult');

    if (!resultArea) return;

    if (qual === 'sslc') {
        if (math) {
            resultArea.className = 'mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs';
            resultArea.innerHTML = `
                <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-circle-check text-emerald-600 text-base"></i> Eligible for 3-Year Diploma (1st Year Entry)</div>
                <p class="mt-1">You satisfy SSLC/THSLC requirements for all 6 Engineering branches under Centralized Single Window Allotment.</p>
            `;
        } else {
            resultArea.className = 'mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs';
            resultArea.innerHTML = `
                <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-triangle-exclamation text-amber-600 text-base"></i> Conditional Eligibility</div>
                <p class="mt-1">Passing in Mathematics & Science is required for engineering stream rank generation.</p>
            `;
        }
    } else if (qual === 'plustwo' || qual === 'iti') {
        resultArea.className = 'mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs';
        resultArea.innerHTML = `
            <div class="font-bold flex items-center gap-2"><i class="fa-solid fa-graduation-cap text-primary text-base"></i> Eligible for Direct 2nd Year Lateral Entry (S3)</div>
            <p class="mt-1">Plus Two Science / VHSE / 2-Year ITI holders can directly enter 3rd semester, completing the diploma in 2 years.</p>
        `;
    }
}

// Pre-registration submit handler — posts to the backend database
async function handlePreRegisterSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const phone = document.getElementById('regPhone').value;
    const email = document.getElementById('regEmail').value;
    const dept = document.getElementById('regDept').value;
    const qual = document.getElementById('regQual').value;
    const marks = document.getElementById('regMarks').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

    try {
        const res = await fetch('/api/applications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, email, dept, qual, marks }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Submission failed');

        const appId = `APP-${String(data.id).padStart(4, '0')}`;
        alert(`Pre-Registration Successful!\n\nApplication ID: ${appId}\nApplicant Name: ${name}\nChosen Branch: ${dept}\n\nOur admission counseling team will contact you at ${phone}.`);
        e.target.reset();
    } catch (err) {
        alert(`Submission failed: ${err.message}\n\nPlease try again or contact the office directly.`);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Pre-Registration Inquiry'; }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    calculateFees();
});
