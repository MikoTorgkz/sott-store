(function () {
  let product = null;
  let selectedSize = '';
  let quantity = 1;

  function getSlug() {
    const match = window.location.pathname.match(/^\/product\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function init() {
    product = window.SottCatalog.getProductBySlug(getSlug());
    if (!product) {
      document.querySelector('[data-product-view]').hidden = true;
      document.querySelector('[data-product-not-found]').hidden = false;
      document.title = 'Товар не найден — SOTT';
      return;
    }

    document.title = `${product.name} — SOTT`;
    setText('[data-breadcrumb-product]', product.name);
    setText('[data-product-category]', product.category);
    setText('[data-product-name]', product.name);
    setText('[data-product-price]', window.SottCatalog.formatPrice(product.price));
    setText('[data-product-short]', product.shortDescription);
    setText('[data-product-description]', product.description);
    renderGallery();
    renderSizes();
    renderSizeTable();
    bindControls();
    setQuantity(1);
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function renderGallery() {
    const main = document.querySelector('[data-main-product-image]');
    const thumbnails = document.querySelector('[data-product-thumbnails]');
    main.src = product.images[0];
    main.alt = product.name;
    thumbnails.innerHTML = product.images.map((image, index) => `<button type="button" class="thumbnail-button${index === 0 ? ' is-active' : ''}" data-thumb-index="${index}" aria-label="Показать изображение ${index + 1}"><img src="${image}" alt="${product.name}, вид ${index + 1}"></button>`).join('');
    thumbnails.addEventListener('click', (event) => {
      const button = event.target.closest('[data-thumb-index]');
      if (!button) return;
      const index = Number(button.dataset.thumbIndex);
      main.src = product.images[index];
      main.alt = `${product.name}, вид ${index + 1}`;
      thumbnails.querySelectorAll('.thumbnail-button').forEach((item) => item.classList.toggle('is-active', item === button));
    });
  }

  function renderSizes() {
    const container = document.querySelector('[data-size-options]');
    container.innerHTML = product.sizes.map((size) => `<button type="button" class="size-button" data-size="${size.label}" ${size.available ? '' : 'disabled'} aria-pressed="false">${size.label}</button>`).join('');
    container.addEventListener('click', (event) => {
      const button = event.target.closest('[data-size]');
      if (!button || button.disabled) return;
      selectedSize = button.dataset.size;
      container.querySelectorAll('.size-button').forEach((item) => {
        const selected = item === button;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      setText('[data-size-message]', '');
    });
  }

  function bindControls() {
    document.querySelector('[data-qty-minus]').addEventListener('click', () => setQuantity(quantity - 1));
    document.querySelector('[data-qty-plus]').addEventListener('click', () => setQuantity(quantity + 1));
    document.querySelector('[data-add-to-cart]').addEventListener('click', () => {
      if (!selectedSize) {
        setText('[data-size-message]', 'Выберите размер');
        document.querySelector('[data-size-options]').querySelector('button:not(:disabled)')?.focus();
        return;
      }
      window.SottCart.addItem(product, selectedSize, quantity);
      setText('[data-add-success]', 'Товар добавлен в корзину');
      window.setTimeout(() => setText('[data-add-success]', ''), 2600);
    });
    document.querySelector('[data-size-guide-open]').addEventListener('click', openSizeModal);
    document.querySelector('[data-size-guide-close]').addEventListener('click', closeSizeModal);
    document.querySelector('[data-size-modal-backdrop]').addEventListener('click', closeSizeModal);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSizeModal(); });
  }

  function setQuantity(next) {
    quantity = Math.min(window.SottCart.MAX_QUANTITY, Math.max(1, next));
    setText('[data-qty-value]', String(quantity));
    document.querySelector('[data-qty-minus]').disabled = quantity === 1;
    document.querySelector('[data-qty-plus]').disabled = quantity === window.SottCart.MAX_QUANTITY;
  }

  function renderSizeTable() {
    const target = document.querySelector('[data-size-table]');
    const isShoes = product.category === 'Обувь';
    if (isShoes) {
      target.innerHTML = '<table class="size-table"><thead><tr><th>Размер</th><th>Длина стопы, см</th></tr></thead><tbody><tr><td>40</td><td>25,5</td></tr><tr><td>41</td><td>26</td></tr><tr><td>42</td><td>26,5</td></tr><tr><td>43</td><td>27,5</td></tr><tr><td>44</td><td>28</td></tr></tbody></table>';
    } else {
      target.innerHTML = '<table class="size-table"><thead><tr><th>Размер</th><th>Грудь, см</th><th>Талия, см</th></tr></thead><tbody><tr><td>S</td><td>88–92</td><td>76–80</td></tr><tr><td>M</td><td>96–100</td><td>84–88</td></tr><tr><td>L</td><td>104–108</td><td>92–96</td></tr><tr><td>XL</td><td>112–116</td><td>100–104</td></tr><tr><td>XXL</td><td>120–124</td><td>108–112</td></tr></tbody></table>';
    }
  }

  function openSizeModal() {
    document.querySelector('[data-size-modal]').hidden = false;
    document.querySelector('[data-size-modal-backdrop]').hidden = false;
    document.body.classList.add('modal-open');
    document.querySelector('[data-size-guide-close]').focus();
  }

  function closeSizeModal() {
    const modal = document.querySelector('[data-size-modal]');
    if (modal.hidden) return;
    modal.hidden = true;
    document.querySelector('[data-size-modal-backdrop]').hidden = true;
    document.body.classList.remove('modal-open');
    document.querySelector('[data-size-guide-open]').focus();
  }

  window.addEventListener('DOMContentLoaded', init);
}());
