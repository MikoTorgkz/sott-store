const assert = require('assert');

const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
};
global.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
const listeners = new Map();
const badge = { textContent: '0', hidden: true };
const miniList = { innerHTML: '' };
const miniTotal = { textContent: '' };
let grid = null;
global.document = {
  querySelectorAll: (selector) => selector === '.cart-badge' ? [badge] : [],
  querySelector: (selector) => {
    if (selector === '[data-mini-cart-list]') return miniList;
    if (selector === '[data-mini-cart-total]') return miniTotal;
    if (selector === '[data-product-grid]') return grid;
    return null;
  },
};
global.window = {
  addEventListener: (type, handler) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(handler);
  },
  dispatchEvent: (event) => (listeners.get(event.type) || []).forEach((handler) => handler(event)),
};

require('../public/js/products.js');
require('../public/js/cart.js');

const polo = { id: '1', slug: 'polo-iz-hlopka', name: 'Поло из хлопка', price: 15900, images: ['/assets/products/polo.svg'] };
window.SottCart.addItem(polo, 'M', 2);
window.SottCart.addItem(polo, 'M', 1);
window.SottCart.addItem(polo, 'XL', 1);

let items = window.SottCart.readItems();
assert.strictEqual(items.length, 2, 'Same product with different sizes must be separate positions');
assert.strictEqual(items.find((item) => item.size === 'M').quantity, 3, 'Same product and size must merge quantities');
assert.strictEqual(window.SottCart.getCount(items), 4, 'Badge count must sum units');
assert.strictEqual(window.SottCart.getTotal(items), polo.price * 4, 'Cart total must be calculated from price and quantity');
assert.strictEqual(badge.textContent, '4', 'Badge must update immediately after cart changes');
assert.strictEqual(badge.hidden, false, 'Badge must be visible for a non-empty cart');
assert(miniList.innerHTML.includes('Размер: M'), 'Mini cart must render item size');
assert.strictEqual(miniTotal.textContent, window.SottCatalog.formatPrice(polo.price * 4), 'Mini cart total must update immediately');

window.SottCart.setQuantity(polo.id, 'M', 0);
assert.strictEqual(window.SottCart.readItems().find((item) => item.size === 'M').quantity, 1, 'Quantity cannot go below one');
window.SottCart.setQuantity(polo.id, 'M', 99);
assert.strictEqual(window.SottCart.readItems().find((item) => item.size === 'M').quantity, 10, 'Quantity cannot exceed ten');

const persisted = storage.get('sott_cart_v1');
assert(persisted && JSON.parse(persisted).length === 2, 'Cart must persist in localStorage');
window.SottCart.removeItem(polo.id, 'XL');
items = window.SottCart.readItems();
assert.strictEqual(items.length, 1, 'Removing a cart position must preserve the other size');

console.log('Cart logic passed: product IDs/slugs, size separation, merge, quantity limits, totals, badge, mini-cart and localStorage persistence verified.');
