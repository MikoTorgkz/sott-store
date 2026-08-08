(function () {
  const grid = document.querySelector('[data-product-grid]');
  if (!grid || !window.SottCatalog) return;
  const t = (key) => window.SottI18n ? window.SottI18n.t(key) : key;

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category') || '';
    const onlyNew = params.get('new') === '1';
    const showAll = params.get('all') === '1';
    const query = new URLSearchParams();
    if (category) query.set('category', category);
    else if (onlyNew) query.set('new', '1');
    else if (!showAll) query.set('featured', '1');
    query.set('limit', category || onlyNew || showAll ? '24' : '6');
    try {
      const response = await fetch(`/api/products?${query}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('catalog unavailable');
      let data = await response.json();
      let products = Array.isArray(data.items) ? data.items : Array.isArray(data.products) ? data.products : [];
      if (!category && !onlyNew && !showAll && products.length === 0) {
        const fallback = await fetch('/api/products?limit=6', { headers: { Accept: 'application/json' } });
        if (fallback.ok) { data = await fallback.json(); products = Array.isArray(data.items) ? data.items : data.products || []; }
      }
      renderProducts(products);
      updateHeading(category, onlyNew, showAll);
    } catch (_error) {
      grid.replaceChildren(emptyMessage(t('catalog.loadError')));
    }
  }

  function renderProducts(products) {
    if (!products.length) return grid.replaceChildren(emptyMessage(t('catalog.none')));
    grid.replaceChildren(...products.map(createCard));
  }

  function createCard(product) {
    if (window.SottStorefrontCard) return window.SottStorefrontCard.create(product);
    const article = document.createElement('article'); article.className = 'product-card';
    const media = document.createElement('div'); media.className = 'product-image';
    const imageLink = document.createElement('a'); imageLink.className = 'product-image-link'; imageLink.href = `/product/${encodeURIComponent(product.slug)}`; imageLink.setAttribute('aria-label', `Открыть ${product.name}`);
    const image = document.createElement('img'); image.src = product.mainImage; image.alt = product.name; imageLink.append(image);
    const heart = document.createElement('button'); heart.className = 'heart-button'; heart.type = 'button'; heart.setAttribute('aria-label', `${product.name} — избранное будет добавлено позже`);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M20.5 5.7c-1.9-2-5-1.8-6.8.1L12 7.6l-1.7-1.8c-1.8-1.9-4.9-2.1-6.8-.1-1.7 1.9-1.5 4.8.3 6.6L12 20.5l8.2-8.2c1.8-1.8 2-4.7.3-6.6Z'); svg.append(path); heart.append(svg);
    media.append(imageLink, heart);
    const details = document.createElement('div'); details.className = 'product-details';
    const title = document.createElement('h3'); const titleLink = document.createElement('a'); titleLink.href = imageLink.href; titleLink.textContent = product.name; title.append(titleLink);
    const price = document.createElement('strong'); price.textContent = window.SottCatalog.formatPrice(product.price);
    const choose = document.createElement('a'); choose.className = 'add-button choose-size-button'; choose.href = imageLink.href; choose.textContent = t('chooseSize');
    details.append(title, price, choose); article.append(media, details); return article;
  }

  function updateHeading(category, onlyNew, showAll) {
    const heading = document.querySelector('#catalog-title');
    if (heading) heading.textContent = onlyNew ? t('nav.new') : category || showAll ? t('nav.catalog') : t('products.popular');
  }

  function emptyMessage(text) {
    const message = document.createElement('p'); message.className = 'catalog-empty-message'; message.textContent = text; return message;
  }

  window.addEventListener('DOMContentLoaded', init);
}());
