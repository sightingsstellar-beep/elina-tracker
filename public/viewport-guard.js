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

  document.documentElement.style.overscrollBehaviorX = 'none';
  document.body.style.overscrollBehaviorX = 'none';

  function preventGesture(event) {
    event.preventDefault();
  }

  function resetViewportPosition() {
    const visualViewport = window.visualViewport;
    if (window.scrollX) {
      window.scrollTo(0, window.scrollY);
    }

    if (!visualViewport) return;

    if (visualViewport.offsetLeft) {
      window.scrollTo(0, window.scrollY);
    }
  }

  let touchStart = null;

  document.addEventListener('touchstart', (event) => {
    if (!event.touches || event.touches.length !== 1) {
      touchStart = null;
      return;
    }

    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
      resetViewportPosition();
      return;
    }

    if (!touchStart || !event.touches || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) {
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
    touchStart = null;
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
