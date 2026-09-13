/**
 * KKMMPTC Kallettumkara - Admissions & Fee Calculator Module
 */

function calculateFees() {
    const quota = document.getElementById('calcQuota') ? document.getElementById('calcQuota').value : 'regular';
    const category = document.getElementById('calcCategory') ? document.getElementById('calcCategory').value : 'gen';

    let tuition = 15000;
    let special = 2500;
    let caution = 1000;
    let pta = 1500;

    if (quota === 'ihrd') {
        tuition = 25000;
        special = 3000;
    }

    // Reservation Fee Concessions
    if (category === 'sc_st' && quota === 'regular') {
        tuition = 0;
        special = 0;
    } else if (category === 'obc' && quota === 'regular') {
        tuition = 5000; // Partial E-grantz concession
    }

    const total = tuition + special + caution + pta;

    const resTuition = document.getElementById('resTuition');
    const resSpecial = document.getElementById('resSpecial');
    const resCaution = document.getElementById('resCaution');
    const resPTA = document.getElementById('resPTA');
    const resTotal = document.getElementById('resTotal');

    if (resTuition) resTuition.innerText = `₹ ${tuition.toLocaleString('en-IN')}`;
    if (resSpecial) resSpecial.innerText = `₹ ${special.toLocaleString('en-IN')}`;
    if (resCaution) resCaution.innerText = `₹ ${caution.toLocaleString('en-IN')}`;
    if (resPTA) resPTA.innerText = `₹ ${pta.toLocaleString('en-IN')}`;
    if (resTotal) resTotal.innerText = `₹ ${total.toLocaleString('en-IN')} / Sem`;
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
