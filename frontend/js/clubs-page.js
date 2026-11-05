(function () {
    const board = document.getElementById('clubsBoard');
    const tools = document.getElementById('clubsTools');
    const filters = document.getElementById('clubsFilters');
    const search = document.getElementById('clubsSearch');
    const count = document.getElementById('clubsCount');
    const dialog = document.getElementById('clubDialog');
    const photoDialog = document.getElementById('clubPhotoDialog');
    if (!board || !dialog) return;

    const preferred = ['Technical', 'Cultural', 'Sports', 'Arts', 'Music', 'Social', 'Other'];
    const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let clubs = [];
    let category = '';
    let pushed = false;

    function esc(value) {
        return typeof escapeHTML === 'function'
            ? escapeHTML(value == null ? '' : String(value))
            : String(value == null ? '' : value);
    }

    function text(value) {
        return String(value || '').trim();
    }

    function safeSrc(url) {
        const value = text(url);
        if (!value) return '';
        if (value.charAt(0) === '/' && value.charAt(1) !== '/') return value;
        try {
            const parsed = new URL(value, window.location.origin);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
        } catch (err) {
            return '';
        }
        return '';
    }

    function paragraphs(value) {
        return text(value).split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
    }

    function initial(name) {
        const letter = text(name).charAt(0).toUpperCase();
        return letter || 'C';
    }

    function picture(src, alt, className) {
        const safe = safeSrc(src);
        if (!safe) return '<div class="clubs-fallback ' + className + '" aria-hidden="true">' + esc(initial(alt)) + '</div>';
        return '<img class="' + className + '" src="' + esc(safe) + '" alt="' + esc(alt) + '" loading="lazy" data-kkm-fill="cover">';
    }

    function categories() {
        const present = {};
        clubs.forEach(function (club) {
            if (text(club.category)) present[club.category] = true;
        });
        return preferred.filter(function (name) { return present[name]; }).concat(
            Object.keys(present).filter(function (name) { return preferred.indexOf(name) === -1; }).sort()
        );
    }

    function matches(club) {
        if (category && club.category !== category) return false;
        const query = text(search && search.value).toLowerCase();
        if (!query) return true;
        const blob = [club.name, club.intro, club.description].map(text).join(' ').toLowerCase();
        return blob.indexOf(query) !== -1;
    }

    function emptyState(searching) {
        if (searching) {
            return '<div class="clubs-empty"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><h2>No clubs match your search.</h2><p>Try another name or description.</p><button type="button" id="clubsClear">Clear search</button></div>';
        }
        return '<div class="clubs-empty"><i class="fa-solid fa-people-group" aria-hidden="true"></i><h2>No clubs have been published yet.</h2><p>Published campus and department clubs will appear here.</p></div>';
    }

    function card(club) {
        const cover = safeSrc(club.cover_url);
        const logo = safeSrc(club.logo_url);
        const place = club.club_type === 'department' && text(club.department_name)
            ? '<span class="clubs-place">' + esc(club.department_name) + '</span>'
            : (club.club_type === 'campus' ? '<span class="clubs-place">Campus club</span>' : '');
        return '<article class="clubs-card">' +
            '<div class="clubs-media">' +
            (cover ? picture(cover, text(club.name) + ' cover', '') : '<div class="clubs-fallback" aria-hidden="true">' + esc(initial(club.name)) + '</div>') +
            (logo ? picture(logo, text(club.name) + ' logo', 'clubs-logo') : '') +
            '</div><div class="clubs-card-body"><div class="clubs-meta">' +
            (text(club.category) ? '<span class="clubs-badge">' + esc(club.category) + '</span>' : '') +
            place + '</div><h2>' + esc(club.name) + '</h2><p class="clubs-intro">' + esc(club.intro || '') + '</p>' +
            '<button type="button" class="clubs-card-btn" data-club="' + esc(club.slug) + '">View Details</button></div></article>';
    }

    function paint() {
        const shown = clubs.filter(matches);
        const searching = text(search && search.value) !== '';
        filters.innerHTML = ['All Clubs'].concat(categories()).map(function (name) {
            const value = name === 'All Clubs' ? '' : name;
            const on = value === category;
            return '<button type="button" data-cat="' + esc(value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(name) + '</button>';
        }).join('');
        if (!shown.length) {
            board.innerHTML = emptyState(searching);
            count.textContent = '';
        } else {
            board.innerHTML = '<div class="clubs-grid">' + shown.map(card).join('') + '</div>';
            count.textContent = shown.length === clubs.length
                ? shown.length + (shown.length === 1 ? ' club' : ' clubs')
                : 'Showing ' + shown.length + ' of ' + clubs.length;
        }
        board.querySelectorAll('[data-club]').forEach(function (button) {
            button.addEventListener('click', function () { openClub(button.getAttribute('data-club'), true); });
        });
        const clear = document.getElementById('clubsClear');
        if (clear) clear.addEventListener('click', function () {
            if (search) search.value = '';
            category = '';
            paint();
            if (search) search.focus();
        });
        filters.querySelectorAll('[data-cat]').forEach(function (button) {
            button.addEventListener('click', function () {
                category = button.getAttribute('data-cat') || '';
                paint();
            });
        });
        board.querySelectorAll('img').forEach(function (img) {
            img.addEventListener('error', function () {
                const fallback = document.createElement('div');
                fallback.className = 'clubs-fallback' + (img.classList.contains('clubs-logo') ? ' clubs-logo' : '');
                fallback.setAttribute('aria-hidden', 'true');
                fallback.textContent = initial(img.alt);
                img.replaceWith(fallback);
            });
        });
    }

    function section(title, html) {
        if (!html) return '';
        return '<section><h3>' + esc(title) + '</h3>' + html + '</section>';
    }

    function prose(value) {
        const lines = paragraphs(value);
        if (!lines.length) return '';
        return '<div class="clubs-prose">' + lines.map(function (line) {
            return '<p>' + esc(line) + '</p>';
        }).join('') + '</div>';
    }

    function fact(label, value) {
        const body = text(value);
        if (!body) return '';
        return '<div><dt>' + esc(label) + '</dt><dd>' + esc(body) + '</dd></div>';
    }

    function openClub(slug, updateHistory) {
        const club = clubs.find(function (item) { return item.slug === slug; });
        if (!club) return;
        const facts = [
            fact('Department', club.club_type === 'department' ? club.department_name : ''),
            fact('Coordinator', club.coordinator),
            fact('Faculty in charge', club.faculty_in_charge),
            fact('Established', club.established_on)
        ].join('');
        const objectives = paragraphs(club.objectives);
        const objectiveHtml = objectives.length > 1
            ? '<ul class="clubs-list">' + objectives.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ul>'
            : prose(club.objectives);
        const activities = (club.activities || []).map(function (item) {
            const meta = [item.event_date, item.venue].filter(text).join(' · ');
            return '<article class="clubs-activity"><h4>' + esc(item.title) + '</h4>' +
                (meta ? '<span>' + esc(meta) + '</span>' : '') + prose(item.description) + '</article>';
        }).join('');
        const members = (club.members || []).map(function (item) {
            const photo = safeSrc(item.photo_url);
            return '<article class="clubs-member">' +
                (photo ? picture(photo, text(item.name), '') : '') +
                '<div><h4>' + esc(item.name) + '</h4>' +
                (text(item.role) ? '<span>' + esc(item.role) + '</span>' : '') + '</div></article>';
        }).join('');
        const images = (club.images || []).filter(function (item) { return safeSrc(item.image_url); });
        const gallery = images.map(function (item) {
            const alt = text(item.alt_text) || text(item.caption) || text(club.name) + ' photograph';
            const caption = text(item.caption);
            return '<figure><button type="button" data-photo="' + esc(safeSrc(item.image_url)) + '" data-alt="' + esc(alt) + '" data-caption="' + esc(caption) + '" aria-label="View photograph: ' + esc(alt) + '">' +
                picture(item.image_url, alt, '') + '</button>' +
                (caption ? '<figcaption>' + esc(caption) + '</figcaption>' : '') + '</figure>';
        }).join('');
        const place = club.club_type === 'department' && text(club.department_name)
            ? club.department_name
            : (club.club_type === 'campus' ? 'Campus club' : '');
        dialog.innerHTML = '<div class="clubs-dialog-bar"><button type="button" class="clubs-dialog-close" id="clubDialogClose">Close</button></div>' +
            '<div class="clubs-cover">' + (safeSrc(club.cover_url) ? picture(club.cover_url, text(club.name) + ' cover', '') : '<div class="clubs-fallback" aria-hidden="true">' + esc(initial(club.name)) + '</div>') + '</div>' +
            '<div class="clubs-dialog-head">' +
            (safeSrc(club.logo_url) ? picture(club.logo_url, text(club.name) + ' logo', 'clubs-dialog-logo') : '') +
            '<div><div class="clubs-meta">' +
            (text(club.category) ? '<span class="clubs-badge">' + esc(club.category) + '</span>' : '') +
            (place ? '<span class="clubs-place">' + esc(place) + '</span>' : '') +
            '</div><h2 id="clubDialogTitle">' + esc(club.name) + '</h2></div></div>' +
            '<div class="clubs-dialog-body">' +
            (facts ? '<dl class="clubs-facts">' + facts + '</dl>' : '') +
            section('Introduction', prose(club.intro)) +
            section('Description', prose(club.description)) +
            section('Objectives', objectiveHtml) +
            section('Activities and programs', prose(club.activities_text)) +
            section('Meeting schedule', prose(club.meeting_info)) +
            section('Activities', activities ? '<div class="clubs-list">' + activities + '</div>' : '') +
            section('Members', members ? '<div class="clubs-list">' + members + '</div>' : '') +
            section('Gallery', gallery ? '<div class="clubs-gallery">' + gallery + '</div>' : '') +
            '</div>';
        dialog.querySelector('#clubDialogClose').addEventListener('click', closeClub);
        dialog.querySelectorAll('[data-photo]').forEach(function (button) {
            button.addEventListener('click', function () { openPhoto(button); });
        });
        if (updateHistory) {
            history.pushState({ club: slug }, '', 'clubs.html#' + encodeURIComponent(slug));
            pushed = true;
        }
        if (!dialog.open) dialog.showModal();
        dialog.querySelector('#clubDialogClose').focus();
    }

    function closeClub() {
        if (photoDialog && photoDialog.open) photoDialog.close();
        if (dialog.open) dialog.close();
        dialog.innerHTML = '';
        if (pushed) {
            pushed = false;
            history.back();
            return;
        }
        if (location.hash) history.replaceState(null, '', 'clubs.html');
    }

    function openPhoto(button) {
        const img = document.getElementById('clubPhotoImg');
        const caption = document.getElementById('clubPhotoCaption');
        img.src = button.getAttribute('data-photo') || '';
        img.alt = button.getAttribute('data-alt') || '';
        caption.textContent = button.getAttribute('data-caption') || '';
        if (!photoDialog.open) photoDialog.showModal();
        document.getElementById('clubPhotoClose').focus();
    }

    function hashSlug() {
        const raw = (location.hash || '').replace(/^#/, '');
        if (!raw) return '';
        try { return decodeURIComponent(raw); } catch (err) { return raw; }
    }

    function showLoaded(data) {
        clubs = Array.isArray(data) ? data : [];
        board.removeAttribute('aria-busy');
        if (!clubs.length) {
            tools.hidden = true;
            filters.innerHTML = '';
            count.textContent = '';
            board.innerHTML = emptyState(false);
            return;
        }
        tools.hidden = false;
        paint();
        const slug = hashSlug();
        if (slug) openClub(slug, false);
    }

    function showError() {
        board.removeAttribute('aria-busy');
        tools.hidden = true;
        count.textContent = '';
        board.innerHTML = '<div class="clubs-empty"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><h2>The clubs page could not be loaded.</h2><p>Check the connection and try again.</p><button type="button" id="clubsRetry">Retry</button></div>';
        document.getElementById('clubsRetry').addEventListener('click', loadClubs);
    }

    function loadClubs() {
        board.setAttribute('aria-busy', 'true');
        board.innerHTML = '<div class="clubs-grid" aria-hidden="true">' + '<div class="clubs-skel"></div>'.repeat(6) + '</div>';
        fetch('/api/clubs', { headers: { 'Accept': 'application/json' } }).then(function (res) {
            if (!res.ok) throw new Error('load failed');
            return res.json();
        }).then(showLoaded).catch(showError);
    }

    if (search) search.addEventListener('input', function () { if (clubs.length) paint(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) closeClub(); });
    dialog.addEventListener('cancel', function (event) {
        event.preventDefault();
        closeClub();
    });
    document.getElementById('clubPhotoClose').addEventListener('click', function () { photoDialog.close(); });
    photoDialog.addEventListener('click', function (event) { if (event.target === photoDialog) photoDialog.close(); });
    window.addEventListener('popstate', function () {
        const slug = hashSlug();
        if (slug && clubs.some(function (club) { return club.slug === slug; })) openClub(slug, false);
        else if (dialog.open) dialog.close();
    });
    if (motion) document.documentElement.classList.add('clubs-motion');
    loadClubs();
})();
