(function initHeroSwipe(root) {
  'use strict';

  const DEFAULT_THRESHOLD = 48;
  const AXIS_LOCK_DISTANCE = 6;

  function getGestureAxis(deltaX, deltaY, lockDistance = AXIS_LOCK_DISTANCE) {
    const x = Math.abs(Number(deltaX) || 0);
    const y = Math.abs(Number(deltaY) || 0);
    if (Math.max(x, y) < lockDistance) return null;
    return x > y ? 'horizontal' : 'vertical';
  }

  function getSwipeDirection(deltaX, deltaY, threshold = DEFAULT_THRESHOLD) {
    const x = Number(deltaX) || 0;
    const y = Number(deltaY) || 0;
    if (Math.abs(x) <= Math.abs(y) || Math.abs(x) < threshold) return 0;
    return x < 0 ? 1 : -1;
  }

  const api = Object.freeze({ DEFAULT_THRESHOLD, AXIS_LOCK_DISTANCE, getGestureAxis, getSwipeDirection });
  if (root) root.SottHeroSwipe = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
