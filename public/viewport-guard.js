/**
 * viewport-guard.js — keep the mobile app viewport from drifting after pinch gestures.
 */

'use strict';

(function initViewportGuard() {
  const viewport = document.querySelector('meta[name="viewport"]');
  const lockedViewport = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover';

  if (viewport) {
    viewport.setAttribute('content', lockedViewport);
  }

  function preventGesture(event) {
    event.preventDefault();
  }

  function resetViewportPosition() {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    if (visualViewport.offsetLeft || visualViewport.offsetTop) {
      window.scrollTo(
        Math.max(0, window.scrollX + visualViewport.offsetLeft),
        Math.max(0, window.scrollY + visualViewport.offsetTop),
      );
    }
  }

  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
      resetViewportPosition();
    }
  }, { passive: false });

  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd < 350) {
      event.preventDefault();
    }
    lastTouchEnd = now;
    window.setTimeout(resetViewportPosition, 0);
  }, { passive: false });

  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', (event) => {
    preventGesture(event);
    resetViewportPosition();
  }, { passive: false });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resetViewportPosition);
    window.visualViewport.addEventListener('scroll', resetViewportPosition);
  }
})();
