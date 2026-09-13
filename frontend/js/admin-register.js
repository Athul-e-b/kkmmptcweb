/**
 * One-time admin registration. Password is POSTed once over HTTPS and never
 * saved in localStorage. OTP is verified on the server.
 */
(function () {
    const form = document.getElementById('regForm');
    const pw = document.getElementById('regPassword');
    const confirm = document.getElementById('regConfirm');
    const submit = document.getElementById('regSubmit');
    const err = document.getElementById('regError');
    const summary = document.getElementById('pwSummary');

    function checks(value) {
        return {
            len: value.length >= 8,
            upper: /[A-Z]/.test(value),
            lower: /[a-z]/.test(value),
            num: /\d/.test(value),
            spec: /[^A-Za-z0-9]/.test(value),
        };
    }

    function paintRules() {
        const c = checks(pw.value);
        document.querySelectorAll('#pwRules [data-rule]').forEach((el) => {
            const ok = c[el.getAttribute('data-rule')];
            el.textContent = (ok ? '✓ ' : '✗ ') + el.textContent.replace(/^[✓✗]\s*/, '');
            el.className = ok ? 'text-emerald-700' : 'text-secondary';
        });
        const strong = Object.values(c).every(Boolean);
        const match = pw.value && pw.value === confirm.value;
        summary.textContent = strong ? (match ? 'Password is strong enough' : 'Passwords do not match') : 'Password is not strong enough';
        summary.className = 'font-semibold pt-1 ' + (strong && match ? 'text-emerald-700' : 'text-secondary');
        submit.disabled = !(strong && match && form.name.value.trim().length >= 2 && form.email.value && form.phone.value);
    }

    pw.addEventListener('input', paintRules);
    confirm.addEventListener('input', paintRules);
    form.addEventListener('input', paintRules);

    function apiError(data, status) {
        const d = data && data.detail;
        if (typeof d === 'string') return d;
        if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join('; ');
        return 'Request failed (' + status + ')';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.classList.add('hidden');
        paintRules();
        if (submit.disabled) return;
        const body = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            phone: form.phone.value.trim(),
            password: pw.value,
            confirm_password: confirm.value,
        };
        try {
            const res = await fetch('/api/admin/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            let data = null;
            try { data = await res.json(); } catch (x) { /* ignore */ }
            pw.value = '';
            confirm.value = '';
            paintRules();
            if (!res.ok) {
                err.textContent = apiError(data, res.status);
                err.classList.remove('hidden');
                return;
            }
            document.getElementById('otpModal').classList.remove('hidden');
            document.getElementById('devOtpHint').classList.toggle('hidden', !data.show_dev_otp);
            document.getElementById('otpInput').focus();
        } catch (ex) {
            err.textContent = 'Could not reach the server.';
            err.classList.remove('hidden');
        }
    });

    document.getElementById('otpVerify').addEventListener('click', async () => {
        const otpErr = document.getElementById('otpError');
        otpErr.classList.add('hidden');
        const otp = document.getElementById('otpInput').value.trim();
        try {
            const res = await fetch('/api/admin/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otp }),
            });
            let data = null;
            try { data = await res.json(); } catch (x) { /* ignore */ }
            if (!res.ok) {
                otpErr.textContent = apiError(data, res.status);
                otpErr.classList.remove('hidden');
                return;
            }
            window.location.replace('/admin-login');
        } catch (ex) {
            otpErr.textContent = 'Could not reach the server.';
            otpErr.classList.remove('hidden');
        }
    });
})();
