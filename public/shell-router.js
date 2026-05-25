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
    '/app': { route: 'chart', title: 'Glide Bedside', mount: null },
    '/app/': { route: 'chart', title: 'Glide Bedside', mount: null },
    '/app/chart': { route: 'chart', title: 'Glide Bedside', mount: null },
    '/app/history': { route: 'trends', title: 'Glide Bedside - Trends', mount: 'GlideHistoryView' },
    '/app/chat': { route: 'chat', title: 'Glide Bedside - Chat', mount: null },
  };

  let activeMountedView = null;

  function routeForPath(pathname) {
    return routes[pathname] || routes['/app'];
  }

  function setActiveRoute(routeName) {
    document.querySelectorAll('[data-route]').forEach((link) => {
      const isTopChartLink = link.classList.contains('top-nav-item') && link.dataset.route === 'chart';
      const isChartSubroute = routeName === 'chart' || routeName === 'trends' || routeName === 'chat';
      const isActive = link.dataset.route === routeName || (isTopChartLink && isChartSubroute);
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function setActiveView(routeName) {
    document.querySelectorAll('[data-shell-view]').forEach((view) => {
      view.hidden = view.dataset.shellView !== routeName;
    });
    document.querySelectorAll('[data-chart-only]').forEach((element) => {
      element.hidden = routeName !== 'chart';
    });
  }

  function mountRoute(route) {
    if (activeMountedView && activeMountedView !== route.mount) {
      window[activeMountedView]?.unmount?.();
      activeMountedView = null;
    }
    if (route.mount && window[route.mount]?.mount) {
      window[route.mount].mount();
      activeMountedView = route.mount;
    }
  }

  function renderRoute(pathname) {
    const route = routeForPath(pathname);
    document.title = route.title;
    setActiveRoute(route.route);
    setActiveView(route.route);
    mountRoute(route);
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

  window.addEventListener('glide:shell-navigate', (event) => {
    renderRoute(event.detail?.pathname || window.location.pathname);
  });

  renderRoute(window.location.pathname);
})();
