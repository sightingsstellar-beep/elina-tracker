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
    '/': { route: 'chart', view: 'chart', title: 'Glide Bedside', mount: null },
    '/app': { route: 'chart', view: 'chart', title: 'Glide Bedside', mount: null },
    '/app/': { route: 'chart', view: 'chart', title: 'Glide Bedside', mount: null },
    '/app/chart': { route: 'chart', view: 'chart', title: 'Glide Bedside', mount: null },
    '/history': { route: 'trends', view: 'trends', title: 'Glide Bedside - Trends', mount: 'GlideHistoryView' },
    '/app/history': { route: 'trends', view: 'trends', title: 'Glide Bedside - Trends', mount: 'GlideHistoryView' },
    '/chat': { route: 'chat', view: 'chat', title: 'Glide Bedside - Chat', mount: null },
    '/app/chat': { route: 'chat', view: 'chat', title: 'Glide Bedside - Chat', mount: null },
    '/settings': { route: 'settings', view: 'settings', title: 'Glide Bedside - App Settings', mount: 'GlideSettingsView', viewKey: 'settings' },
    '/app/settings': { route: 'settings', view: 'settings', title: 'Glide Bedside - App Settings', mount: 'GlideSettingsView', viewKey: 'settings' },
    '/patient-profile': { route: 'patient-profile', view: 'settings', title: 'Glide Bedside - Patient Profile', mount: 'GlideSettingsView', viewKey: 'patient-profile' },
    '/app/patient-profile': { route: 'patient-profile', view: 'settings', title: 'Glide Bedside - Patient Profile', mount: 'GlideSettingsView', viewKey: 'patient-profile' },
    '/caregiver-profile': { route: 'caregiver-profile', view: 'settings', title: 'Glide Bedside - Profile', mount: 'GlideSettingsView', viewKey: 'caregiver-profile' },
    '/app/caregiver-profile': { route: 'caregiver-profile', view: 'settings', title: 'Glide Bedside - Profile', mount: 'GlideSettingsView', viewKey: 'caregiver-profile' },
    '/caregivers': { route: 'caregivers', view: 'settings', title: 'Glide Bedside - Caregivers', mount: 'GlideSettingsView', viewKey: 'caregivers' },
    '/app/caregivers': { route: 'caregivers', view: 'settings', title: 'Glide Bedside - Caregivers', mount: 'GlideSettingsView', viewKey: 'caregivers' },
  };

  let activeMountedView = null;
  let activeRouteName = null;

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
    document.querySelectorAll('[data-account-menu-button]').forEach((button) => {
      button.classList.toggle('active', routeName === 'caregiver-profile' || routeName === 'caregivers');
    });
  }

  function setActiveView(viewName, routeName) {
    document.querySelectorAll('[data-shell-view]').forEach((view) => {
      view.hidden = view.dataset.shellView !== viewName;
    });
    document.querySelectorAll('[data-chart-only]').forEach((element) => {
      element.hidden = routeName !== 'chart';
    });
    document.querySelectorAll('[data-chart-section]').forEach((element) => {
      element.hidden = !(routeName === 'chart' || routeName === 'trends' || routeName === 'chat');
    });
  }

  function mountRoute(route) {
    if (activeMountedView && activeMountedView !== route.mount) {
      window[activeMountedView]?.unmount?.();
      activeMountedView = null;
    }
    if (route.mount && window[route.mount]?.mount) {
      window[route.mount].mount(route.viewKey);
      activeMountedView = route.mount;
    }
  }

  function resetScrollForRouteChange() {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  function renderRoute(pathname, options = {}) {
    const route = routeForPath(pathname);
    const shouldResetScroll = options.resetScroll && route.route !== activeRouteName;
    document.title = route.title;
    setActiveRoute(route.route);
    setActiveView(route.view || route.route, route.route);
    mountRoute(route);
    activeRouteName = route.route;
    if (shouldResetScroll) requestAnimationFrame(resetScrollForRouteChange);
  }

  function navigate(url) {
    const next = new URL(url, window.location.href);
    const current = window.location.pathname + window.location.search;
    const target = next.pathname + next.search;
    if (target !== current) {
      window.history.pushState({ route: routeForPath(next.pathname).route }, '', target);
    }
    renderRoute(next.pathname, { resetScroll: true });
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
    renderRoute(window.location.pathname, { resetScroll: true });
  });

  window.addEventListener('glide:shell-navigate', (event) => {
    renderRoute(event.detail?.pathname || window.location.pathname, { resetScroll: true });
  });

  renderRoute(window.location.pathname);
})();
