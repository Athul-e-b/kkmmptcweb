/* Visual behavior layered on top of the existing scripts.
   Scroll, Hover, 3D, Popup, and Mobile. No content is rewritten. */
(function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var admin = document.body.classList.contains('cms-app')
        || document.body.classList.contains('dept-admin-app')
        || document.body.classList.contains('auth-page');

    if (admin) return;
    document.body.classList.add('fx-public');

    /* ------------------------------------------------------------------ */
    /* Scroll                                                              */
    /* ------------------------------------------------------------------ */

    var progress = document.createElement('div');
    progress.className = 'fx-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);

    var topBtn = document.createElement('button');
    topBtn.type = 'button';
    topBtn.className = 'fx-top';
    topBtn.setAttribute('aria-label', 'Back to top');
    topBtn.innerHTML = '<i class="fa-solid fa-chevron-up" aria-hidden="true"></i>';
    topBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
    document.body.appendChild(topBtn);

    var header = document.querySelector('header.sticky');
    var slides = document.querySelectorAll('#home .hero-slide');

    function paintScroll() {
        var doc = document.documentElement;
        var max = doc.scrollHeight - window.innerHeight;
        var ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        progress.style.transform = 'scaleX(' + ratio + ')';
        if (header) header.classList.toggle('fx-scrolled', window.scrollY > 12);
        topBtn.classList.toggle('is-on', window.scrollY > 420);
        if (typeof updateNavbarOffset === 'function' && document.body.classList.contains('nav-open')) {
            updateNavbarOffset();
        }
        if (!reduce && fine && window.innerWidth >= 768 && slides.length) {
            var shift = Math.min(window.scrollY * 0.08, 36);
            slides.forEach(function (slide) {
                slide.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
            });
        } else {
            slides.forEach(function (slide) { slide.style.transform = ''; });
        }
    }

    var scrollQueued = false;
    window.addEventListener('scroll', function () {
        if (scrollQueued) return;
        scrollQueued = true;
        requestAnimationFrame(function () {
            scrollQueued = false;
            paintScroll();
        });
    }, { passive: true });
    paintScroll();

    var sectionLinks = Array.prototype.slice.call(document.querySelectorAll('header a[href^="#"]'));
    function spySections() {
        if (!sectionLinks.length) return;
        var mark = null;
        sectionLinks.forEach(function (link) {
            var id = link.getAttribute('href').slice(1);
            var section = document.getElementById(id);
            if (!section) return;
            if (section.getBoundingClientRect().top < 120) mark = id;
        });
        sectionLinks.forEach(function (link) {
            link.classList.toggle('fx-current', link.getAttribute('href') === '#' + mark);
        });
    }
    window.addEventListener('scroll', spySections, { passive: true });
    spySections();

    var counters = [];
    function rememberCounter(el) {
        if (!el || el.dataset.fxCounted || el.closest('.stat-counter, header, footer, nav, a, button, #tickerBar, #chatbotWindow')) return;
        if (el.childElementCount) return;
        var text = el.textContent;
        var match = text.match(/^(\d{1,4})(\s+Seats|\s+intake|\s+Years)?$/i);
        if (!match) return;
        el.dataset.fxCounted = '1';
        counters.push(el);
        if (!counterObserver) return;
        counterObserver.observe(el);
    }

    function playCounter(el) {
        var original = el.getAttribute('data-fx-original') || el.textContent;
        el.setAttribute('data-fx-original', original);
        var amount = parseInt(original, 10);
        if (reduce || !amount) {
            el.textContent = original;
            return;
        }
        var started = performance.now();
        function frame(now) {
            var t = Math.min(1, (now - started) / 700);
            var shown = Math.round(amount * (1 - Math.pow(1 - t, 3)));
            el.textContent = original.replace(/^\d+/, String(shown));
            if (t < 1) requestAnimationFrame(frame);
            else el.textContent = original;
        }
        requestAnimationFrame(frame);
    }

    var counterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            playCounter(entry.target);
            counterObserver.unobserve(entry.target);
        });
    }, { threshold: 0.6 });

    function scanCounters(root) {
        if (admin) return;
        var scope = root && root.querySelectorAll ? root : document;
        var nodes = scope.querySelectorAll ? scope.querySelectorAll('main span, main strong, main div, #deptContainer span, #deptContainer div, #homeDeptGrid div') : [];
        Array.prototype.forEach.call(nodes, rememberCounter);
    }

    /* ------------------------------------------------------------------ */
    /* 3D                                                                  */
    /* ------------------------------------------------------------------ */

    if (!admin && fine && !reduce) {
        document.addEventListener('pointermove', function (event) {
            if (event.pointerType && event.pointerType !== 'mouse') return;
            var card = event.target.closest('#homeDeptGrid > div, #deptContainer > div, #deptContainer > article, #eventsBoardGrid > div, .gallery-item, .card-hover-lift');
            if (!card) return;
            var rect = card.getBoundingClientRect();
            card.style.setProperty('--fx-x', ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
            card.style.setProperty('--fx-y', ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
        }, { passive: true });
    }

    /* ------------------------------------------------------------------ */
    /* Popup                                                               */
    /* ------------------------------------------------------------------ */

    var nativeAlert = window.alert;
    if (!admin) {
        window.alert = function (message) {
            try {
                showToast(String(message));
            } catch (err) {
                nativeAlert.call(window, message);
            }
        };
    }

    var toastTimer = 0;
    function showToast(message) {
        var toast = document.getElementById('fxToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'fxToast';
            toast.className = 'fx-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('is-on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 7000);
    }

    function hook(name, after) {
        var original = window[name];
        if (typeof original !== 'function' || original.__fx) return;
        var wrapped = function () {
            var result = original.apply(this, arguments);
            after.apply(this, arguments);
            return result;
        };
        wrapped.__fx = true;
        window[name] = wrapped;
    }

    function syncLightbox() {
        var items = window._galleryItems || [];
        var many = window.__fxGalleryIndex != null && items.length > 1;
        document.querySelectorAll('.fx-lb-nav').forEach(function (button) {
            button.hidden = !many;
        });
    }

    hook('openGalleryItem', function (index) {
        window.__fxGalleryIndex = index;
        syncLightbox();
    });
    hook('openLightbox', function () {
        window.__fxGalleryIndex = null;
        syncLightbox();
    });

    var lightbox = document.getElementById('lightboxModal');
    if (lightbox) {
        if (!lightbox.getAttribute('role')) lightbox.setAttribute('role', 'dialog');
        var closeBtn = lightbox.querySelector('button');
        if (closeBtn && !closeBtn.getAttribute('aria-label')) closeBtn.setAttribute('aria-label', 'Close');
        ['prev', 'next'].forEach(function (dir, i) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'fx-lb-nav fx-lb-' + dir;
            button.setAttribute('aria-label', dir === 'prev' ? 'Previous' : 'Next');
            button.innerHTML = '<i class="fa-solid fa-chevron-' + (dir === 'prev' ? 'left' : 'right') + '" aria-hidden="true"></i>';
            button.hidden = true;
            button.addEventListener('click', function (event) {
                event.stopPropagation();
                stepGallery(i === 0 ? -1 : 1);
            });
            lightbox.appendChild(button);
        });
        bindSwipe(lightbox, 'lightboxModal');
    }

    function stepGallery(delta) {
        var items = window._galleryItems || [];
        if (window.__fxGalleryIndex == null || !items.length || typeof window.openGalleryItem !== 'function') return;
        var next = (window.__fxGalleryIndex + delta + items.length) % items.length;
        window.openGalleryItem(next);
    }

    ['deptModal', 'searchModal', 'videoModal'].forEach(function (id) {
        var modal = document.getElementById(id);
        if (!modal) return;
        if (!modal.getAttribute('role')) modal.setAttribute('role', 'dialog');
        bindSwipe(modal, id);
    });

    function bindSwipe(modal, id) {
        var startX = 0;
        var startY = 0;
        modal.addEventListener('touchstart', function (event) {
            if (!event.changedTouches) return;
            startX = event.changedTouches[0].clientX;
            startY = event.changedTouches[0].clientY;
        }, { passive: true });
        modal.addEventListener('touchend', function (event) {
            if (!event.changedTouches || modal.classList.contains('hidden')) return;
            if (event.target.closest('video, iframe, input, textarea')) return;
            var dx = event.changedTouches[0].clientX - startX;
            var dy = event.changedTouches[0].clientY - startY;
            if (id === 'lightboxModal' && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
                event.stopPropagation();
                stepGallery(dx < 0 ? 1 : -1);
                return;
            }
            if (dy > 72 && Math.abs(dy) > Math.abs(dx) && window.innerWidth < 768 && typeof toggleModal === 'function') {
                var panel = modal.querySelector(':scope > div') || modal;
                var top = panel.getBoundingClientRect().top;
                if (startY < top + 72) {
                    event.stopPropagation();
                    toggleModal(id);
                }
            }
        });
    }

    document.addEventListener('keydown', function (event) {
        var open = document.querySelector('#lightboxModal:not(.hidden), #deptModal:not(.hidden), #searchModal:not(.hidden), #videoModal:not(.hidden)');
        if (!open) return;
        if (event.key === 'ArrowRight' && open.id === 'lightboxModal') stepGallery(1);
        if (event.key === 'ArrowLeft' && open.id === 'lightboxModal') stepGallery(-1);
        if (event.key !== 'Tab') return;
        var nodes = Array.prototype.filter.call(
            open.querySelectorAll('button, [href], input, select, textarea, video'),
            function (node) { return !node.disabled && !node.hidden; }
        );
        if (!nodes.length) return;
        var first = nodes[0];
        var last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    function syncModalLock() {
        var open = document.querySelector('#lightboxModal:not(.hidden), #deptModal:not(.hidden), #searchModal:not(.hidden), #videoModal:not(.hidden), dialog[open]');
        document.body.classList.toggle('fx-modal-open', !!open);
    }

    /* ------------------------------------------------------------------ */
    /* Mobile                                                              */
    /* ------------------------------------------------------------------ */

    function labelOf(link) {
        return (link.getAttribute('aria-label') || link.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function buildDock() {
        if (admin || document.querySelector('.fx-dock')) return;
        var here = window.location.pathname.split('/').pop() || 'index.html';
        var items = [];
        var phone = document.querySelector('a[href^="tel:0480"], a[href^="tel:"]');
        var admissions = document.querySelector('a[href="admissions.html"]');
        var contact = document.querySelector('a[href="#contact"], a[href="index.html#contact"]');
        if (phone) items.push({ href: phone.getAttribute('href'), label: labelOf(phone), icon: 'fa-phone' });
        if (admissions && here !== 'admissions.html') items.push({ href: 'admissions.html', label: labelOf(admissions), icon: 'fa-file-pen' });
        if (contact && window.location.hash !== '#contact') items.push({ href: contact.getAttribute('href'), label: labelOf(contact), icon: 'fa-location-dot' });
        if (!items.length) return;
        var dock = document.createElement('nav');
        dock.className = 'fx-dock';
        dock.setAttribute('aria-label', items.map(function (item) { return item.label; }).filter(Boolean).join(', '));
        items.forEach(function (item) {
            var link = document.createElement('a');
            link.href = item.href;
            link.setAttribute('aria-label', item.label);
            link.innerHTML = '<i class="fa-solid ' + item.icon + '" aria-hidden="true"></i>';
            dock.appendChild(link);
        });
        document.body.appendChild(dock);
        document.body.classList.add('fx-has-dock');
    }

    function markLoading(root) {
        var holders = (root || document).querySelectorAll('#noticeBoardGrid, #eventsBoardGrid, #pastEventsGrid, #galleryGrid, #homeDeptGrid, #deptContainer, #clubsStatus, #iicStatus');
        Array.prototype.forEach.call(holders, function (el) {
            var text = el.textContent.trim();
            var loading = /^Loading\b/.test(text) && text.length < 80;
            el.classList.toggle('fx-shimmer', loading);
            if (!loading && el.dataset.fxWasLoading === '1') {
                el.classList.add('fx-arrive');
                el.dataset.fxWasLoading = '0';
            }
            if (loading) el.dataset.fxWasLoading = '1';
        });
    }

    function lazyImages(root) {
        var scope = root.querySelectorAll ? root : document;
        Array.prototype.forEach.call(scope.querySelectorAll('img'), function (img) {
            if (img.closest('header, #home, .site-brand')) return;
            if (!img.getAttribute('loading')) img.loading = 'lazy';
        });
    }

    function markPills(root) {
        var scope = root.querySelectorAll ? root : document;
        Array.prototype.forEach.call(scope.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]'), function (link) {
            if (!link.closest('#tickerBar, #chatbotWindow')) link.classList.add('fx-pill');
        });
    }

    function scan(root) {
        if (admin) return;
        scanCounters(root || document);
        markLoading(document);
        lazyImages(root || document);
        markPills(root || document);
        syncModalLock();
    }

    if (!admin) {
        buildDock();
        scan(document);
        var queued = false;
        var observer = new MutationObserver(function () {
            if (queued) return;
            queued = true;
            requestAnimationFrame(function () {
                queued = false;
                scan(document);
            });
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open'] });
    }
})();
