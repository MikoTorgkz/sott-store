(function () {
  const STORAGE_KEY = 'sott_cart_v1';
  const MAX_QUANTITY = 10;
  const tr = (key, fallback, params) => window.SottI18n ? window.SottI18n.t(key, params) : fallback;

  function readItems() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(isValidItem).map((item) => ({
        ...item,
        price: Number(item.price),
        quantity: Math.min(MAX_QUANTITY, Math.max(1, Number(item.quantity))),
      })) : [];
    } catch (_error) {
      return [];
    }
  }

  function isValidItem(item) {
    return item && typeof item.productId === 'string' && typeof item.name === 'string'
      && typeof item.size === 'string' && typeof item.image === 'string' && Number.isFinite(Number(item.price))
      && Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0;
  }

  function saveItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('sott:cart-changed', { detail: { items } }));
    return items;
  }

  function keyFor(productId, size) {
    return `${productId}::${size}`;
  }

  function addItem(product, size, quantity) {
    const safeQuantity = Math.min(MAX_QUANTITY, Math.max(1, Number(quantity) || 1));
    const items = readItems();
    const key = keyFor(product.id, size);
    const existing = items.find((item) => keyFor(item.productId, item.size) === key);

    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + safeQuantity);
    } else {
      items.push({
        productId: String(product.id),
        slug: product.slug,
        name: product.name,
        price: product.price,
        size,
        quantity: safeQuantity,
        image: product.images[0],
      });
    }
    return saveItems(items);
  }

  function removeItem(productId, size) {
    return saveItems(readItems().filter((item) => keyFor(item.productId, item.size) !== keyFor(productId, size)));
  }

  function setQuantity(productId, size, quantity) {
    const items = readItems();
    const item = items.find((entry) => keyFor(entry.productId, entry.size) === keyFor(productId, size));
    if (!item) return items;
    item.quantity = Math.min(MAX_QUANTITY, Math.max(1, Number(quantity) || 1));
    return saveItems(items);
  }

  function clear() {
    return saveItems([]);
  }

  function getCount(items = readItems()) {
    return items.reduce((total, item) => total + item.quantity, 0);
  }

  function getTotal(items = readItems()) {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  function updateBadges(items = readItems()) {
    const count = getCount(items);
    document.querySelectorAll('.cart-badge').forEach((badge) => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
    });
  }

  function renderDrawer(items = readItems()) {
    const list = document.querySelector('[data-mini-cart-list]');
    const total = document.querySelector('[data-mini-cart-total]');
    if (!list || !total) return;

    if (!items.length) {
      list.innerHTML = `<div class="mini-cart-empty"><p>${tr('cart.empty', 'Ваша корзина пуста')}</p><a href="/catalog">${tr('catalog.go', 'Перейти в каталог')}</a></div>`;
    } else {
      list.innerHTML = items.map((item) => `
        <article class="mini-cart-item">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy">
          <div class="mini-cart-item-copy">
            <h3>${escapeHtml(item.name)}</h3>
            <p>${tr('size', 'Размер')}: ${escapeHtml(item.size)} · ${item.quantity} ${tr('unit.pcs', 'шт.')}</p>
            <strong>${window.SottCatalog.formatPrice(item.price * item.quantity)}</strong>
          </div>
          <button class="mini-cart-remove" type="button" data-cart-remove="${escapeHtml(item.productId)}" data-cart-size="${escapeHtml(item.size)}" aria-label="Удалить ${escapeHtml(item.name)}">×</button>
        </article>`).join('');
    }
    total.textContent = window.SottCatalog.formatPrice(getTotal(items));
    if (typeof list.querySelectorAll === 'function') list.querySelectorAll('img').forEach((image) => image.addEventListener('error', () => { image.src = '/assets/product-placeholder.svg'; }, { once: true }));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function setDrawer(open) {
    const drawer = document.querySelector('[data-cart-drawer]');
    const overlay = document.querySelector('[data-cart-overlay]');
    if (!drawer || !overlay) return;
    drawer.classList.toggle('is-open', open);
    overlay.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('drawer-open', open);
    if (open) {
      window.dispatchEvent(new CustomEvent('sott:overlay-open', { detail: { type: 'cart' } }));
      renderDrawer();
      drawer.querySelector('[data-cart-close]')?.focus();
    }
  }

  function ensureDrawerMarkup() {
    if (document.querySelector('[data-cart-drawer]')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="cart-overlay" data-cart-overlay></div>
      <aside class="cart-drawer" data-cart-drawer aria-hidden="true" aria-label="Мини-корзина">
        <div class="cart-drawer-head"><div><span>${tr('cart', 'Корзина')}</span><strong data-drawer-count></strong></div><button type="button" data-cart-close aria-label="${tr('cart', 'Корзина')}">×</button></div>
        <div class="mini-cart-list" data-mini-cart-list></div>
        <div class="cart-drawer-footer"><div><span>${tr('total', 'Итого')}</span><strong data-mini-cart-total>0 ₸</strong></div><a class="primary-button drawer-cart-link" href="/cart">${tr('cart', 'Корзина')} <span>→</span></a></div>
      </aside>`);
  }

  function initDrawer() {
    ensureDrawerMarkup();
    document.querySelectorAll('[data-cart-toggle]').forEach((button) => button.addEventListener('click', () => setDrawer(true)));
    document.querySelector('[data-cart-close]')?.addEventListener('click', () => setDrawer(false));
    document.querySelector('[data-cart-overlay]')?.addEventListener('click', () => setDrawer(false));
    document.querySelector('[data-mini-cart-list]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cart-remove]');
      if (!button) return;
      removeItem(button.dataset.cartRemove, button.dataset.cartSize);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setDrawer(false);
    });
    window.addEventListener('sott:overlay-open', (event) => { if (event.detail?.type !== 'cart') setDrawer(false); });
    updateBadges();
    renderDrawer();
  }

  window.addEventListener('sott:cart-changed', (event) => {
    updateBadges(event.detail.items);
    renderDrawer(event.detail.items);
    const drawerCount = document.querySelector('[data-drawer-count]');
    if (drawerCount) drawerCount.textContent = `${getCount(event.detail.items)} ${tr('unit.pcs', 'шт.')}`;
  });

  window.SottCart = Object.freeze({ readItems, addItem, removeItem, setQuantity, clear, getCount, getTotal, updateBadges, renderDrawer, setDrawer, MAX_QUANTITY });
  window.addEventListener('DOMContentLoaded', () => {
    initDrawer();
    const drawerCount = document.querySelector('[data-drawer-count]');
    if (drawerCount) drawerCount.textContent = `${getCount()} ${tr('unit.pcs', 'шт.')}`;
  });
}());
