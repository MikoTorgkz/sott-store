const assert = require('assert');

const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
};
global.CustomEvent = class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };
global.window = {
  addEventListener: () => {},
  dispatchEvent: () => {},
};

require('../public/js/products.js');
require('../public/js/cart.js');

const { products } = window.SottCatalog;
assert.strictEqual(products.length, 6, 'Catalog must contain six demo products');
assert.strictEqual(new Set(products.map((product) => product.slug)).size, 6, 'Product slugs must be unique');
assert(products.every((product) => product.sizes.some((size) => size.available)), 'Each product needs an available size');
assert(products.some((product) => product.sizes.some((size) => !size.available)), 'Demo catalog must include unavailable sizes');

const polo = products[0];
window.SottCart.addItem(polo, 'M', 2);
window.SottCart.addItem(polo, 'M', 1);
window.SottCart.addItem(polo, 'XL', 1);

let items = window.SottCart.readItems();
assert.strictEqual(items.length, 2, 'Same product with different sizes must be separate positions');
assert.strictEqual(items.find((item) => item.size === 'M').quantity, 3, 'Same product and size must merge quantities');
assert.strictEqual(window.SottCart.getCount(items), 4, 'Badge count must sum units');
assert.strictEqual(window.SottCart.getTotal(items), polo.price * 4, 'Cart total must be calculated from price and quantity');

window.SottCart.setQuantity(polo.id, 'M', 0);
assert.strictEqual(window.SottCart.readItems().find((item) => item.size === 'M').quantity, 1, 'Quantity cannot go below one');
window.SottCart.setQuantity(polo.id, 'M', 99);
assert.strictEqual(window.SottCart.readItems().find((item) => item.size === 'M').quantity, 10, 'Quantity cannot exceed ten');

const persisted = storage.get('sott_cart_v1');
assert(persisted && JSON.parse(persisted).length === 2, 'Cart must persist in localStorage');
window.SottCart.removeItem(polo.id, 'XL');
items = window.SottCart.readItems();
assert.strictEqual(items.length, 1, 'Removing a cart position must preserve the other size');

const grid = { innerHTML: '' };
global.document = { querySelector: (selector) => selector === '[data-product-grid]' ? grid : null };
require('../public/js/home.js');
assert.strictEqual((grid.innerHTML.match(/class="product-card"/g) || []).length, 6, 'Home catalog must render six cards from product data');
assert(grid.innerHTML.includes('/product/polo-iz-hlopka'), 'Home card must link to the product route');
assert(grid.innerHTML.includes('Выбрать размер'), 'Home card must require size selection before cart');

console.log('Store logic passed: 6 data-driven cards, product links, size-first CTA, cart merge/separation, limits, totals and localStorage persistence verified.');
