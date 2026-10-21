/**
 * Visual motion and the public scrolling notification bar.
 * Content stays visible if this file fails to run.
 */
(function () {
    if (window.__kkmEnhance) return;
    window.__kkmEnhance = true;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function esc(value) {
        if (typeof escapeHTML === 'function') return escapeHTML(value);
        return String(value == null ? '' : value).replace(/[&<>'"]/g, function (ch) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch];
        });
    }

    function safeHttpUrl(url) {
        if (!url) return '';
        try {
            const parsed = new URL(String(url), window.location.origin);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
            if (parsed.origin === 'null') return '';
            return parsed.href;
        } catch (err) {
            return '';
        }
    }

    function tickerMarkup(items) {
        const html = items.map(function (item) {
            const href = safeHttpUrl(item.link_url);
            const label = item.link_label ? esc(item.link_label) : '';
            const link = href
                ? ' <a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + (label || 'Open') + '</a>'
                : '';
            return '<span class="ticker-item">' + esc(item.message) + link + '</span>';
        }).join('');
        return '<div class="ticker-seq">' + html + '</div><div class="ticker-seq" aria-hidden="true">' + html + '</div>';
    }

    function applyTicker(track, items) {
        if (!track) return;
        const active = (items || []).filter(function (item) { return item && item.message; });
        if (!active.length) {
            track.innerHTML = '';
            return;
        }
        const duration = Math.max(22, Math.min(70, active.map(function (item) {
            return String(item.message).length;
        }).reduce(function (sum, n) { return sum + n; }, 0) / 7));
        track.style.setProperty('--ticker-duration', duration + 's');
        track.innerHTML = tickerMarkup(active);
        const viewport = track.parentElement;
        const minWidth = viewport ? viewport.clientWidth : 0;
        if (minWidth) {
            track.querySelectorAll('.ticker-seq').forEach(function (seq) {
                if (seq.scrollWidth < minWidth) seq.style.minWidth = minWidth + 'px';
            });
        }
    }

    async function loadPublicTicker() {
        const track = document.getElementById('tickerTrack');
        const lead = document.getElementById('tickerLead');
        const viewport = document.getElementById('tickerViewport');
        if (!track) return;
        try {
            const res = await fetch('/api/scrolling-notifications');
            if (!res.ok) throw new Error('Request failed');
            const items = await res.json();
            if (!Array.isArray(items) || !items.length) {
                track.innerHTML = '';
                if (lead) lead.classList.add('ticker-empty');
                if (viewport) viewport.classList.add('ticker-empty');
                return;
            }
            if (lead) lead.classList.remove('ticker-empty');
            if (viewport) viewport.classList.remove('ticker-empty');
            applyTicker(track, items);
        } catch (err) {
            track.innerHTML = '';
            if (lead) lead.classList.add('ticker-empty');
            if (viewport) viewport.classList.add('ticker-empty');
        }
    }

    const REVEAL_SELECTOR = [
        'body > section[id]',
        'main > section',
        '.card-hover-lift',
        '.gallery-item',
        '#homeDeptGrid > div',
        '#eventsBoardGrid > a',
        '#eventsBoardGrid > div',
        '#deptContainer > section',
        '#deptContainer > article',
        '#deptContainer > div'
    ].join(',');

    const revealed = new WeakSet();
    let observer = null;

    function armReveal(el, index) {
        if (revealed.has(el) || el.closest('header, #tickerViewport, #chatbotWindow, #mobileMenu')) return;
        if (el.id === 'home') return;
        revealed.add(el);
        if (reduceMotion || !observer) return;
        const rect = el.getBoundingClientRect();
        const inView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
        if (inView) return;
        el.classList.add('reveal-item');
        if (el.classList.contains('gallery-item') || el.querySelector('img')) el.classList.add('reveal-media');
        el.style.setProperty('--reveal-delay', (Math.min(index % 5, 4) * 50) + 'ms');
        observer.observe(el);
    }

    function scanReveals() {
        if (reduceMotion || !('IntersectionObserver' in window)) return;
        document.querySelectorAll(REVEAL_SELECTOR).forEach(armReveal);
    }

    function initReveal() {
        if (reduceMotion || !('IntersectionObserver' in window)) return;
        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-revealed');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
        scanReveals();
        const mo = new MutationObserver(function () { scanReveals(); });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    const TILT_SELECTOR = [
        '#homeDeptGrid > div',
        '#eventsBoardGrid > a',
        '#eventsBoardGrid > div',
        '.gallery-item',
        '.card-hover-lift',
        '.cms-stat-card',
        '#deptContainer > div',
        '#deptContainer > section',
        '#deptContainer > article'
    ].join(',');

    let tiltCard = null;

    function tiltAllowed() {
        if (reduceMotion) return false;
        if (window.innerWidth < 1024) return false;
        return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    }

    function clearTilt(el) {
        if (el) el.style.transform = '';
    }

    function initTilt() {
        document.addEventListener('pointermove', function (event) {
            if (!tiltAllowed() || event.pointerType !== 'mouse') {
                clearTilt(tiltCard);
                tiltCard = null;
                return;
            }
            const card = event.target.closest(TILT_SELECTOR);
            if (tiltCard && tiltCard !== card) clearTilt(tiltCard);
            if (!card || card.closest('form, header, #mobileMenu, .fixed') || card.querySelector('form')) {
                tiltCard = null;
                return;
            }
            if (event.target.closest('input, textarea, select, button')) {
                clearTilt(card);
                tiltCard = card;
                return;
            }
            const rect = card.getBoundingClientRect();
            const px = (event.clientX - rect.left) / rect.width - 0.5;
            const py = (event.clientY - rect.top) / rect.height - 0.5;
            card.style.transform = 'perspective(900px) rotateX(' + (-py * 4).toFixed(2) + 'deg) rotateY(' + (px * 5).toFixed(2) + 'deg) translateY(-4px)';
            tiltCard = card;
        });
        document.addEventListener('pointerleave', function () {
            clearTilt(tiltCard);
            tiltCard = null;
        });
    }

    let scrollQueued = false;

    function initScrollDepth() {
        function paint() {
            scrollQueued = false;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
            document.documentElement.style.setProperty('--kkm-progress', progress.toFixed(4));
            if (!reduceMotion && window.innerWidth >= 1024) {
                document.body.style.setProperty('--kkm-shift', (window.scrollY * 0.05).toFixed(1) + 'px');
            }
        }
        window.addEventListener('scroll', function () {
            if (scrollQueued) return;
            scrollQueued = true;
            window.requestAnimationFrame(paint);
        }, { passive: true });
        paint();
    }

    function safeImageUrl(src) {
        if (!src) return '';
        const value = String(src).trim();
        if (!value || value === 'about:blank') return '';
        if (value.indexOf('blob:') === 0 || value.indexOf('data:image/') === 0) return value;
        try {
            const parsed = new URL(value, window.location.href);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
            return parsed.href;
        } catch (err) {
            return '';
        }
    }

    function hasToken(img, prefix) {
        return Array.prototype.some.call(img.classList, function (cls) {
            return cls === prefix || cls.indexOf(prefix) === 0;
        });
    }

    function isPhotoFrame(img) {
        if (img.dataset.kkmFill === 'cover') return false;
        if (img.closest('.site-brand, #lightboxModal, dialog.campus-lightbox')) return false;
        if (img.id === 'lightboxImg' || img.id === 'lightboxVideo') return false;
        if (img.classList.contains('campus-photo')) return true;
        if (img.id === 'principalPhoto') return true;
        const round = img.classList.contains('rounded-full');
        const cover = img.classList.contains('object-cover');
        const boxed = (hasToken(img, 'w-') && hasToken(img, 'h-')) || (hasToken(img, 'w-') && hasToken(img, 'aspect-'));
        if (round && (hasToken(img, 'w-') || hasToken(img, 'h-'))) return true;
        return cover && boxed;
    }

    function paintFrame(frame, img) {
        const bg = frame.querySelector('.image-frame__background');
        if (!bg) return;
        const safe = safeImageUrl(img.currentSrc || img.getAttribute('src'));
        bg.style.backgroundImage = safe ? 'url(' + JSON.stringify(safe) + ')' : 'none';
    }

    function watchFrame(frame, img) {
        function onLoad() {
            frame.classList.remove('is-failed');
            paintFrame(frame, img);
        }
        function onError() {
            frame.classList.add('is-failed');
            const bg = frame.querySelector('.image-frame__background');
            if (bg) bg.style.backgroundImage = 'none';
        }
        img.addEventListener('load', onLoad);
        img.addEventListener('error', onError);
        if (img.complete) {
            if (img.naturalWidth > 0) onLoad();
            else if (img.getAttribute('src')) onError();
        }
    }

    function frameImage(img) {
        if (!img || img.dataset.kkmFramed === '1' || !img.parentNode) return;
        if (!img.getAttribute('src')) return;
        if (!isPhotoFrame(img)) return;
        const frame = document.createElement('div');
        frame.className = 'image-frame';
        const move = [];
        img.classList.forEach(function (cls) {
            if (/^(w-|h-|max-w-|max-h-|min-w-|min-h-|aspect-|rounded-|mx-|my-|mt-|mb-|shrink-0$)/.test(cls)) move.push(cls);
            if (/^(border|shadow|ring-)/.test(cls)) move.push(cls);
            if (cls === 'campus-photo' || cls === 'mx-auto') move.push(cls);
        });
        move.forEach(function (cls) {
            frame.classList.add(cls);
            img.classList.remove(cls);
        });
        if (frame.classList.contains('rounded-full') || img.id === 'principalPhoto') frame.classList.add('is-round');
        img.classList.remove('object-cover');
        img.classList.add('image-frame__foreground', 'object-contain');
        img.dataset.kkmFramed = '1';
        const bg = document.createElement('div');
        bg.className = 'image-frame__background';
        bg.setAttribute('aria-hidden', 'true');
        img.parentNode.insertBefore(frame, img);
        frame.appendChild(bg);
        frame.appendChild(img);
        watchFrame(frame, img);
    }

    function scanFrames(root) {
        const scope = root && root.querySelectorAll ? root : document;
        if (scope instanceof HTMLImageElement) {
            frameImage(scope);
            return;
        }
        scope.querySelectorAll('img').forEach(frameImage);
    }

    function initImageFrames() {
        scanFrames(document);
        const mo = new MutationObserver(function (records) {
            records.forEach(function (record) {
                if (record.type === 'attributes' && record.target instanceof HTMLImageElement) {
                    const img = record.target;
                    const frame = img.closest('.image-frame');
                    if (frame && img.dataset.kkmFramed === '1') {
                        frame.classList.remove('is-failed');
                        if (img.complete && img.naturalWidth > 0) paintFrame(frame, img);
                        else {
                            const bg = frame.querySelector('.image-frame__background');
                            if (bg) bg.style.backgroundImage = 'none';
                        }
                        return;
                    }
                    frameImage(img);
                    return;
                }
                record.addedNodes.forEach(function (node) {
                    if (node instanceof HTMLImageElement) frameImage(node);
                    else if (node instanceof Element) scanFrames(node);
                });
            });
        });
        mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    }

    document.addEventListener('DOMContentLoaded', function () {
        initReveal();
        initTilt();
        initScrollDepth();
        loadPublicTicker();
        initImageFrames();
    });

    window.kkmRenderTicker = applyTicker;
})();
