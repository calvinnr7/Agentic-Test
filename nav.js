// ── Mode Switcher (Noel Leeming / TWG / TWS) ──
// Single-page app: only 'noel-leeming' is wired to a real Agentforce
// deployment (see agent-configs.js). TWG and TWS are intentionally inert
// placeholders — their buttons render (so the switcher shows all three) but
// clicking them does nothing. There's only one page now, so there's no
// navigation involved at all; the switcher is purely visual/informational.
(function initModeSwitcher() {
    const mode = 'noel-leeming';

    // Expose for other scripts (e.g. agent-configs.js's active())
    window.__navMode = mode;
    document.body.classList.add(`nav-mode-${mode}`);

    document.querySelectorAll('.nav-mode-btn').forEach(btn => {
        if (btn.dataset.mode === mode) btn.classList.add('active');
        // TWG / TWS buttons intentionally get no click handler — clicking
        // them does nothing, per spec.
    });
})();

// Mobile menu toggle functionality (kept for small-viewport nav collapse,
// even though the nav no longer has a link list — the mode-switcher pill
// itself can still wrap on narrow screens).
const mobileMenuToggle = document.getElementById('mobileMenuToggle');

function openMobileMenu() {
    if (mobileMenuToggle) mobileMenuToggle.classList.add('active');
    document.body.classList.add('nav-open');
}

function closeMobileMenu() {
    if (mobileMenuToggle) mobileMenuToggle.classList.remove('active');
    document.body.classList.remove('nav-open');
}

if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
        if (document.body.classList.contains('nav-open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });
}
