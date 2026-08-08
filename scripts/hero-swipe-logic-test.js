const assert = require('assert');
const { getGestureAxis, getSwipeDirection, DEFAULT_THRESHOLD } = require('../public/js/hero-swipe');

assert.strictEqual(DEFAULT_THRESHOLD, 48);
assert.strictEqual(getGestureAxis(3, 2), null, 'Tiny movement must not lock the gesture');
assert.strictEqual(getGestureAxis(30, 8), 'horizontal');
assert.strictEqual(getGestureAxis(8, 30), 'vertical');
assert.strictEqual(getGestureAxis(20, 20), 'vertical', 'Equal movement must prefer page scrolling');

assert.strictEqual(getSwipeDirection(-60, 10), 1, 'Left swipe must advance');
assert.strictEqual(getSwipeDirection(60, 10), -1, 'Right swipe must go back');
assert.strictEqual(getSwipeDirection(40, 5), 0, 'Movement below threshold must not change slide');
assert.strictEqual(getSwipeDirection(70, 75), 0, 'Mostly vertical gesture must not change slide');
assert.strictEqual(getSwipeDirection(-48, 5), 1, 'Threshold distance must count as a swipe');

console.log('Hero swipe logic passed: axis lock, vertical scroll protection, threshold and directions verified.');
