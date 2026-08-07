(function () {
  function init() {
    render();
    window.addEventListener('sott:cart-changed', render);
    document.querySelector('[data-cart-items]').addEventListener('click', handleCartClick);
    document.querySelector('[data-checkout]').addEventListener('click', openCheckout);
    document.querySelector('[data-checkout-form]').addEventListener('submit', submitOrder);
  }

  function openCheckout() {
    const form = document.querySelector('[data-checkout-form]');
    const button = document.querySelector('[data-checkout]');
    form.hidden = false;
    button.hidden = true;
    button.setAttribute('aria-expanded', 'true');
    form.querySelector('input')?.focus();
  }

  async function submitOrder(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[data-checkout-submit]');
    const message = form.querySelector('[data-checkout-message]');
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const city = String(data.get('city') || '').trim();
    const whatsapp = String(data.get('whatsapp') || '').trim();
    if (!name) return showCheckoutError(message, 'Введите имя');
    if (!city) return showCheckoutError(message, 'Введите город');
    if (!whatsapp) return showCheckoutError(message, 'Укажите корректный WhatsApp');

    const items = window.SottCart.readItems().map((item) => ({ productId: item.productId, size: item.size, quantity: item.quantity }));
    if (!items.length) return showCheckoutError(message, 'Корзина пуста');
    if (!form.dataset.requestId) form.dataset.requestId = createRequestId();

    button.disabled = true;
    button.textContent = 'Создаём заказ...';
    message.textContent = '';
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name, city, whatsapp, items, requestId: form.dataset.requestId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Не удалось создать заказ. Попробуйте ещё раз');
      window.SottCart.clear();
      if (result.whatsappUrl) window.open(result.whatsappUrl, '_blank', 'noopener');
      window.location.assign(`/order-success?token=${encodeURIComponent(result.token)}`);
    } catch (error) {
      showCheckoutError(message, error.message || 'Не удалось создать заказ. Попробуйте ещё раз');
      button.disabled = false;
      button.textContent = 'Создать заказ';
    }
  }

  function createRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    }
    return `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  }

  function showCheckoutError(element, text) {
    element.textContent = text;
    return false;
  }

  function render() {
    const items = window.SottCart.readItems();
    const content = document.querySelector('[data-cart-content]');
    const empty = document.querySelector('[data-empty-cart]');
    content.hidden = items.length === 0;
    empty.hidden = items.length > 0;
    if (!items.length) return;

    document.querySelector('[data-cart-items]').innerHTML = items.map((item) => `
      <article class="cart-line" data-cart-line>
        <a class="cart-line-image" href="${productUrl(item)}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy"></a>
        <div class="cart-line-info"><h2><a href="${productUrl(item)}">${escapeHtml(item.name)}</a></h2><p>Размер: <strong>${escapeHtml(item.size)}</strong></p><span>${window.SottCatalog.formatPrice(item.price)} / шт.</span></div>
        <div class="cart-line-quantity"><button type="button" data-line-minus data-product-id="${escapeHtml(item.productId)}" data-size="${escapeHtml(item.size)}" aria-label="Уменьшить количество">−</button><span>${item.quantity}</span><button type="button" data-line-plus data-product-id="${escapeHtml(item.productId)}" data-size="${escapeHtml(item.size)}" aria-label="Увеличить количество">+</button></div>
        <strong class="cart-line-total">${window.SottCatalog.formatPrice(item.price * item.quantity)}</strong>
        <button class="cart-line-remove" type="button" data-line-remove data-product-id="${escapeHtml(item.productId)}" data-size="${escapeHtml(item.size)}" aria-label="Удалить ${escapeHtml(item.name)}">Удалить</button>
      </article>`).join('');

    const total = window.SottCart.getTotal(items);
    document.querySelector('[data-cart-subtotal]').textContent = window.SottCatalog.formatPrice(total);
    document.querySelector('[data-cart-total]').textContent = window.SottCatalog.formatPrice(total);
    document.querySelectorAll('[data-cart-items] img').forEach((image) => image.addEventListener('error', () => { image.src = '/assets/product-placeholder.svg'; }, { once: true }));
  }

  function handleCartClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const { productId, size } = button.dataset;
    if (!productId || !size) return;
    const item = window.SottCart.readItems().find((entry) => entry.productId === productId && entry.size === size);
    if (!item) return;
    if (button.hasAttribute('data-line-remove')) window.SottCart.removeItem(productId, size);
    if (button.hasAttribute('data-line-minus')) window.SottCart.setQuantity(productId, size, item.quantity - 1);
    if (button.hasAttribute('data-line-plus')) window.SottCart.setQuantity(productId, size, item.quantity + 1);
  }

  function productUrl(item) {
    return item && typeof item.slug === 'string' && item.slug ? `/product/${encodeURIComponent(item.slug)}` : '/#catalog';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  window.addEventListener('DOMContentLoaded', init);
}());
