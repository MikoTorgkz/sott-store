(function () {
  const grid = document.querySelector('[data-product-grid]');
  if (!grid || !window.SottCatalog) return;

  grid.innerHTML = window.SottCatalog.products.map((product) => {
    const url = `/product/${product.slug}`;
    return `
      <article class="product-card">
        <div class="product-image">
          <a class="product-image-link" href="${url}" aria-label="Открыть ${product.name}"><img src="${product.images[0]}" alt="${product.name}"></a>
          <button class="heart-button" type="button" aria-label="${product.name} — избранное будет добавлено позже"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 5.7c-1.9-2-5-1.8-6.8.1L12 7.6l-1.7-1.8c-1.8-1.9-4.9-2.1-6.8-.1-1.7 1.9-1.5 4.8.3 6.6L12 20.5l8.2-8.2c1.8-1.8 2-4.7.3-6.6Z"/></svg></button>
        </div>
        <div class="product-details">
          <h3><a href="${url}">${product.name}</a></h3>
          <strong>${window.SottCatalog.formatPrice(product.price)}</strong>
          <a class="add-button choose-size-button" href="${url}">Выбрать размер</a>
        </div>
      </article>`;
  }).join('');
}());
