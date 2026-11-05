(function () {
    function lines(value) {
        return String(value || '').split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
    }

    function safeLink(url) {
        if (!url) return '';
        try {
            const parsed = new URL(url, window.location.origin);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
            return parsed.href;
        } catch (err) {
            return '';
        }
    }

    function prose(value) {
        const text = String(value || '').trim();
        if (!text) return '<p class="text-sm text-slate-500">Nothing has been published for this section yet.</p>';
        return lines(text).map(function (line) {
            return '<p class="text-sm leading-relaxed text-slate-700">' + escapeHTML(line) + '</p>';
        }).join('');
    }

    function objectiveList(value) {
        const items = lines(value);
        if (!items.length) return '<p class="text-sm text-slate-500">Objectives have not been published yet.</p>';
        if (items.length === 1) return prose(items[0]);
        return '<ul class="space-y-2">' + items.map(function (item) {
            return '<li class="flex gap-2 text-sm text-slate-700"><i class="fa-solid fa-check mt-1 text-xs text-primary" aria-hidden="true"></i><span>' + escapeHTML(item) + '</span></li>';
        }).join('') + '</ul>';
    }

    window.openCampusPhoto = function (src, alt, caption) {
        const dialog = document.getElementById('campusLightbox');
        if (!dialog) return;
        dialog.querySelector('img').src = src;
        dialog.querySelector('img').alt = alt || '';
        dialog.querySelector('p').textContent = caption || '';
        if (typeof dialog.showModal === 'function') dialog.showModal();
    };

    window.renderCampusGallery = function (images, emptyText) {
        if (!images || !images.length) {
            return '<p class="text-sm text-slate-500">' + escapeHTML(emptyText) + '</p>';
        }
        return '<div class="campus-grid">' + images.map(function (image) {
            const alt = image.alt_text || image.caption || image.event_title || 'Photograph';
            const caption = [image.event_title, image.caption].filter(Boolean).join(' — ');
            return '<figure class="campus-panel overflow-hidden">' +
                '<button type="button" onclick="openCampusPhoto(this.dataset.src, this.dataset.alt, this.dataset.caption)" data-src="' + escapeHTML(image.image_url) + '" data-alt="' + escapeHTML(alt) + '" data-caption="' + escapeHTML(caption) + '">' +
                '<img class="campus-photo" src="' + escapeHTML(image.image_url) + '" alt="' + escapeHTML(alt) + '" loading="lazy">' +
                '</button>' +
                (caption ? '<figcaption class="px-3 py-2 text-xs text-slate-600">' + escapeHTML(caption) + '</figcaption>' : '') +
                '</figure>';
        }).join('') + '</div>';
    };

    window.renderIICPage = function (data) {
        const page = data.page || {};
        document.getElementById('iicTitle').textContent = page.hero_title || "Institution's Innovation Council";
        document.getElementById('iicIntro').textContent = page.hero_intro || '';
        const figure = document.getElementById('iicHeroFigure');
        if (page.hero_image_url) {
            figure.innerHTML = '<img class="w-full h-full object-cover" data-kkm-fill="cover" src="' + escapeHTML(page.hero_image_url) + '" alt="' + escapeHTML(page.hero_title || 'IIC') + '">';
        } else {
            figure.innerHTML = '<div class="h-full min-h-48 flex flex-col items-center justify-center text-center p-6 text-slate-500"><i class="fa-solid fa-image text-3xl text-primary mb-3" aria-hidden="true"></i><p class="text-sm">No hero photograph has been added yet.</p></div>';
        }
        document.getElementById('iicAbout').innerHTML = prose(page.about);
        document.getElementById('iicVision').innerHTML = prose(page.vision);
        document.getElementById('iicMission').innerHTML = prose(page.mission);
        document.getElementById('iicObjectives').innerHTML = objectiveList(page.objectives);
        document.getElementById('iicParticipation').innerHTML = prose(page.participation);
        document.getElementById('iicWorkshops').innerHTML = prose(page.workshops_note);
        const activities = document.getElementById('iicActivities');
        if (!data.activities || !data.activities.length) {
            activities.innerHTML = '<p class="text-sm text-slate-500">No activities have been published yet.</p>';
        } else {
            activities.innerHTML = data.activities.map(function (item) {
                const link = safeLink(item.external_url);
                const meta = [item.event_date, item.venue, item.category].filter(Boolean).map(escapeHTML).join(' · ');
                return '<article class="campus-panel p-5">' +
                    '<h3 class="font-heading font-bold text-lg text-slate-900">' + escapeHTML(item.title) + '</h3>' +
                    (meta ? '<p class="text-xs font-semibold text-primary mt-1">' + meta + '</p>' : '') +
                    '<div class="mt-3 space-y-2">' + prose(item.description) + '</div>' +
                    (item.photos && item.photos.length ? '<div class="mt-4">' + window.renderCampusGallery(item.photos, '') + '</div>' : '') +
                    (link ? '<a class="inline-block mt-3 text-sm font-semibold text-primary" href="' + escapeHTML(link) + '" target="_blank" rel="noopener noreferrer">Open related link</a>' : '') +
                    '</article>';
            }).join('');
        }
        document.getElementById('iicGallery').innerHTML = window.renderCampusGallery(data.gallery, 'No photographs have been published in the IIC gallery yet.');
    };

    document.addEventListener('click', function (event) {
        if (event.target && event.target.id === 'campusLightboxClose') {
            document.getElementById('campusLightbox').close();
        }
    });
})();
