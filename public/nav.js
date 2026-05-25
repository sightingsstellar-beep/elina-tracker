/**
 * nav.js — shared responsive navigation for Glide Bedside
 */

'use strict';

(function initTopMenu() {
  const menu = document.querySelector('[data-top-menu]');
  if (!menu) return;

  const toggle = menu.querySelector('[data-top-menu-toggle]');
  const panel = menu.querySelector('[data-top-menu-panel]');
  const closeButton = menu.querySelector('[data-top-menu-close]');
  const accountButton = menu.querySelector('[data-account-menu-button]');
  const accountPanel = menu.querySelector('[data-account-menu-panel]');
  const caregiverNameEls = menu.querySelectorAll('[data-caregiver-name]');
  const path = window.location.pathname === '/index.html' ? '/' : window.location.pathname;
  const caregiverNameStorageKey = 'glide.caregiverDisplayName';

  function setCaregiverName(name) {
    const displayName = name || 'Caregiver';
    caregiverNameEls.forEach((el) => {
      if (el.textContent !== displayName) el.textContent = displayName;
    });
  }

  try {
    const cachedName = window.sessionStorage?.getItem(caregiverNameStorageKey);
    if (cachedName) setCaregiverName(cachedName);
  } catch (_) {}

  menu.querySelectorAll('a[href]').forEach((link) => {
    if (link.getAttribute('href') === path) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
      const chartGroup = link.closest('.top-nav-group');
      const chartTrigger = chartGroup?.querySelector('.top-nav-trigger');
      if (chartTrigger) chartTrigger.classList.add('active');
    }
    link.addEventListener('click', () => {
      window.setTimeout(closeMenu, 0);
    });
  });

  function setExpanded(button, expanded) {
    if (!button) return;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function closeAccount() {
    if (!accountPanel || !accountButton) return;
    accountPanel.hidden = true;
    setExpanded(accountButton, false);
  }

  function closeMenu() {
    if (!panel || !toggle) return;
    menu.classList.remove('top-menu--open');
    document.body.classList.remove('top-menu-open');
    setExpanded(toggle, false);
    closeAccount();
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('top-menu--open');
      document.body.classList.toggle('top-menu-open', isOpen);
      setExpanded(toggle, isOpen);
      if (!isOpen) closeAccount();
    });
  }

  closeButton?.addEventListener('click', closeMenu);

  if (accountButton && accountPanel) {
    accountButton.addEventListener('click', (event) => {
      event.preventDefault();
      const shouldOpen = accountPanel.hidden;
      accountPanel.hidden = !shouldOpen;
      setExpanded(accountButton, shouldOpen);
    });
  }

  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  fetch('/api/me', { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const name = data?.scope?.displayName || data?.scope?.email || 'Caregiver';
      setCaregiverName(name);
      try {
        if (name && name !== 'Caregiver') window.sessionStorage?.setItem(caregiverNameStorageKey, name);
      } catch (_) {}
    })
    .catch(() => {});
})();
