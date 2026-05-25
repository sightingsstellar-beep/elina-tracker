/**
 * shell-router.js — first persistent-shell routing layer for Glide Bedside.
 *
 * This starts with the Chart route so the shell can be verified without
 * destabilizing the existing standalone pages. Additional views can mount into
 * the same shell once their page scripts are split into view modules.
 */

'use strict';

(function initShellRouter() {
  if (!document.body?.matches('[data-app-shell]')) return;

  const routes = {
    '/app': { route: 'chart', title: 'Glide Bedside' },
    '/app/': { route: 'chart', title: 'Glide Bedside' },
    '/app/chart': { route: 'chart', title: 'Glide Bedside' },
  };

  function routeForPath(pathname) {
    return routes[pathname] || routes['/app'];
  }

  function setActiveRoute(routeName) {
    document.querySelectorAll('[data-route]').forEach((link) => {
      const isActive = link.dataset.route === routeName;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function renderRoute(pathname) {
    const route = routeForPath(pathname);
    document.title = route.title;
    setActiveRoute(route.route);
  }

  function navigate(url) {
    const next = new URL(url, window.location.href);
    const current = window.location.pathname + window.location.search;
    const target = next.pathname + next.search;
    if (target !== current) {
      window.history.pushState({ route: routeForPath(next.pathname).route }, '', target);
    }
    renderRoute(next.pathname);
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-shell-link]');
    if (!link || link.target || link.hasAttribute('download')) return;
    const next = new URL(link.href, window.location.href);
    if (next.origin !== window.location.origin) return;
    event.preventDefault();
    navigate(next.href);
  });

  window.addEventListener('popstate', () => {
    renderRoute(window.location.pathname);
  });

  renderRoute(window.location.pathname);
})();
