(function () {
  function init() {
    render();
    window.addEventListener('sott:cart-changed', render);
    document.querySelector('[data-cart-items]').addEventListener('click', handleCartClick);
    document.querySelector('[data-checkout]').addEventListener('click', () => {
      document.querySelector('[data-checkout-message]').textContent = 'Оформление заказа будет подключено на следующем этапе';
    });
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
        <a class="cart-line-image" href="${productUrl(item.productId)}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"></a>
        <div class="cart-line-info"><h2><a href="${productUrl(item.productId)}">${escapeHtml(item.name)}</a></h2><p>Размер: <strong>${escapeHtml(item.size)}</strong></p><span>${window.SottCatalog.formatPrice(item.price)} / шт.</span></div>
        <div class="cart-line-quantity"><button type="button" data-line-minus data-product-id="${escapeHtml(item.productId)}" data-size="${escapeHtml(item.size)}" aria-label="Уменьшить количество">−</button><span>${item.quantity}</span><button type="button" data-line-plus data-product-id="${escapeHtml(item.productId)}" data-size="${escapeHtml(item.size)}" aria-label="Увеличить количество">+</button></div>
        <strong class="cart-line-total">${window.SottCatalog.formatPrice(item.price * item.quantity)}</strong>
        <button class="cart-line-remove" type="button" data-line-remove data-product-id="${escapeHtml(item.productId)}" data-size="${escapeHtml(item.size)}" aria-label="Удалить ${escapeHtml(item.name)}">Удалить</button>
      </article>`).join('');

    const total = window.SottCart.getTotal(items);
    document.querySelector('[data-cart-subtotal]').textContent = window.SottCatalog.formatPrice(total);
    document.querySelector('[data-cart-total]').textContent = window.SottCatalog.formatPrice(total);
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

  function productUrl(productId) {
    const product = window.SottCatalog.getProductById(productId);
    return product ? `/product/${product.slug}` : '/#catalog';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  window.addEventListener('DOMContentLoaded', init);
}());
