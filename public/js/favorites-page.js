(function () {
  const grid = document.querySelector('[data-favorites-grid]');
  if (!grid) return;
  const state = document.querySelector('[data-favorites-state]');
  const tr = (key, fallback) => window.SottI18n ? window.SottI18n.t(key) : fallback;

  function empty() {
    grid.replaceChildren(); state.hidden = false; state.replaceChildren();
    const h = document.createElement('h2'); h.textContent = tr('favorites.empty', 'В избранном пока ничего нет');
    const p = document.createElement('p'); p.textContent = tr('favorites.help', 'Сохраняйте понравившиеся товары, чтобы быстро вернуться к ним позже.');
    const a = document.createElement('a'); a.href = '/catalog'; a.className = 'primary-button'; a.textContent = tr('catalog.go', 'Перейти в каталог');
    state.append(h, p, a);
  }

  async function load() {
    const ids = window.SottFavorites.read(); if (!ids.length) return empty();
    state.hidden = false; state.textContent = tr('favorites.loading', 'Загружаем избранное…');
    try {
      const response = await fetch(`/api/products?ids=${encodeURIComponent(ids.join(','))}&limit=100`); if (!response.ok) throw new Error();
      const data = await response.json(); const items = Array.isArray(data.items) ? data.items : []; const visibleIds = items.map((product) => product.id);
      if (visibleIds.length !== ids.length || visibleIds.some((id) => !ids.includes(id))) window.SottFavorites.replace(visibleIds);
      if (!items.length) return empty(); state.hidden = true; grid.replaceChildren(...items.map(window.SottStorefrontCard.create));
    } catch (_error) {
      state.hidden = false; state.replaceChildren(); const p = document.createElement('p'); p.textContent = tr('favorites.error', 'Не удалось загрузить избранное');
      const button = document.createElement('button'); button.type = 'button'; button.className = 'primary-button'; button.textContent = tr('retry', 'Попробовать снова'); button.addEventListener('click', load); state.append(p, button);
    }
  }

  window.addEventListener('sott:favorites-change', (event) => {
    const ids = event.detail.ids; grid.querySelectorAll('[data-product-id]').forEach((card) => { if (!ids.includes(card.dataset.productId)) card.remove(); });
    if (!ids.length || !grid.children.length) empty();
  });
  load();
}());
