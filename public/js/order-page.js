(function () {
  async function init() {
    const token = window.location.pathname.split('/').filter(Boolean).pop();
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Order unavailable');
      const order = await response.json();
      render(order);
    } catch (_error) {
      document.querySelector('[data-order-loading]').hidden = true;
      document.querySelector('[data-order-error]').hidden = false;
    }
  }

  function render(order) {
    setText('[data-order-short]', `#${String(order.token).slice(0, 8).toUpperCase()}`);
    setText('[data-order-name]', order.customerName);
    setText('[data-order-city]', order.city);
    setText('[data-order-whatsapp]', order.whatsapp);
    setText('[data-order-date]', new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(order.createdAt)));
    setText('[data-order-total]', window.SottCatalog.formatPrice(order.total));
    const list = document.querySelector('[data-order-items]');
    list.replaceChildren(...order.items.map(createOrderItem));
    document.querySelector('[data-order-loading]').hidden = true;
    document.querySelector('[data-order-content]').hidden = false;
  }

  function createOrderItem(item) {
    const article = document.createElement('article');
    article.className = 'public-order-item';
    const image = document.createElement('img'); image.src = item.image; image.alt = item.name;
    const copy = document.createElement('div'); copy.className = 'public-order-item-copy';
    const title = document.createElement('h3'); title.textContent = item.name;
    const meta = document.createElement('p'); meta.textContent = `Размер: ${item.size} · ${item.quantity} шт. · ${window.SottCatalog.formatPrice(item.unitPrice)} / шт.`;
    const total = document.createElement('strong'); total.textContent = window.SottCatalog.formatPrice(item.lineTotal);
    copy.append(title, meta, total); article.append(image, copy); return article;
  }

  function setText(selector, value) { document.querySelector(selector).textContent = String(value ?? ''); }
  window.addEventListener('DOMContentLoaded', init);
}());
