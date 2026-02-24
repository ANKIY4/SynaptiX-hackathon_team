document.addEventListener('DOMContentLoaded', function () {
    const navbar = document.getElementById('siteNavbar');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function () {
            const isOpen = navLinks.classList.toggle('open');
            navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            navToggle.textContent = isOpen ? 'Close' : 'Menu';
        });

        navLinks.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', function () {
                navLinks.classList.remove('open');
                navToggle.setAttribute('aria-expanded', 'false');
                navToggle.textContent = 'Menu';
            });
        });

        document.addEventListener('click', function (event) {
            if (!navLinks.classList.contains('open')) return;
            if (navLinks.contains(event.target) || navToggle.contains(event.target)) return;
            navLinks.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.textContent = 'Menu';
        });
    }

    if (navbar) {
        const updateNavbar = function () {
            navbar.classList.toggle('scrolled', window.scrollY > 6);
        };
        updateNavbar();
        window.addEventListener('scroll', updateNavbar, { passive: true });
    }

    document.querySelectorAll('.flash').forEach(function (flash) {
        window.setTimeout(function () {
            flash.classList.add('is-hiding');
            window.setTimeout(function () {
                if (flash.parentNode) flash.remove();
            }, 180);
        }, 4000);
    });

    const pressableItems = document.querySelectorAll('.btn, .grade-card, .subject-card, .history-item, .lb-row');
    pressableItems.forEach(function (item) {
        item.addEventListener('pointerdown', function () {
            item.classList.add('is-pressed');
        });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (eventName) {
            item.addEventListener(eventName, function () {
                item.classList.remove('is-pressed');
            });
        });
    });

    // count-up animation for stat values on dashboard and results
    document.querySelectorAll('.stat-value, .result-stat-value').forEach(function (el) {
        var text = el.textContent.trim();
        var match = text.match(/^([+]?)(\d+)(.*)/);
        if (!match) return;
        var prefix = match[1];
        var target = parseInt(match[2], 10);
        var suffix = match[3];
        if (target === 0) return;
        var duration = 600;
        var start = performance.now();
        el.textContent = prefix + '0' + suffix;
        function tick(now) {
            var progress = Math.min((now - start) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = prefix + Math.round(target * eased) + suffix;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    });
});
