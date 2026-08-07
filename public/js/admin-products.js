(function () {
  let ctx;
  let categories = [];
  let storage = { configured: false, message: 'Хранилище изображений ещё не настроено' };

  async function initialize(context) {
    ctx = context;
    try {
      const [categoryData, storageData] = await Promise.all([
        ctx.api('/api/admin/categories'),
        ctx.api('/api/admin/product-storage'),
      ]);
      categories = categoryData.categories || [];
      storage = storageData;
      const editMatch = window.location.pathname.match(/^\/admin\/products\/(\d+)$/);
      if (window.location.pathname === '/admin/products/new') return renderForm(null);
      if (editMatch) return loadEdit(Number(editMatch[1]));
      return renderList();
    } catch (error) {
      showError(error.message || 'Не удалось загрузить товары');
    }
  }

  async function renderList() {
    ctx.title.textContent = 'Товары';
    setLoading();
    const url = new URL(window.location.href);
    const state = {
      q: (url.searchParams.get('q') || '').slice(0, 100),
      category: url.searchParams.get('category') || '',
      visibility: ['published', 'hidden'].includes(url.searchParams.get('visibility')) ? url.searchParams.get('visibility') : '',
      featured: url.searchParams.get('featured') === '1',
      isNew: url.searchParams.get('new') === '1',
      page: Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1),
    };
    try {
      const query = new URLSearchParams({ page: String(state.page) });
      if (state.q) query.set('q', state.q);
      if (state.category) query.set('category', state.category);
      if (state.visibility) query.set('visibility', state.visibility);
      if (state.featured) query.set('featured', '1');
      if (state.isNew) query.set('new', '1');
      const data = await ctx.api(`/api/admin/products?${query}`);
      const fragment = document.createDocumentFragment();
      const heading = el('div', 'admin-product-heading');
      heading.append(el('p', 'admin-muted admin-product-intro', 'Каталог, цены, публикация и остатки по размерам.'));
      const create = el('a', 'admin-primary-button admin-button-link', 'Добавить товар');
      create.href = '/admin/products/new';
      heading.append(create);
      fragment.append(heading, buildToolbar(state));
      if (data.products.length) fragment.append(buildProductTable(data.products));
      else fragment.append(emptyState());
      fragment.append(buildPagination(data.pagination, state));
      ctx.content.replaceChildren(fragment);
    } catch (error) {
      showError(error.message || 'Не удалось загрузить товары');
    }
  }

  function buildToolbar(state) {
    const form = el('form', 'admin-product-toolbar');
    const search = fieldInput('search', 'q', 'Название или slug', state.q);
    const category = el('select');
    category.name = 'category';
    category.setAttribute('aria-label', 'Категория');
    category.append(option('', 'Все категории', !state.category));
    categories.forEach((item) => category.append(option(String(item.id), item.name, String(item.id) === state.category)));
    const visibility = el('select');
    visibility.name = 'visibility';
    visibility.setAttribute('aria-label', 'Публикация');
    visibility.append(option('', 'Все товары', !state.visibility), option('published', 'Опубликованные', state.visibility === 'published'), option('hidden', 'Скрытые', state.visibility === 'hidden'));
    const flags = el('div', 'admin-inline-checks');
    flags.append(checkField('featured', 'Хиты', state.featured), checkField('new', 'Новинки', state.isNew));
    const submit = el('button', '', 'Применить');
    submit.type = 'submit';
    form.append(search, category, visibility, flags, submit);
    return form;
  }

  function buildProductTable(products) {
    const wrap = el('div', 'admin-table-wrap admin-products-table-wrap');
    const table = el('table', 'admin-table admin-products-table');
    const head = el('thead');
    const row = el('tr');
    ['Товар', 'Категория', 'Цена', 'Остаток', 'Публикация', 'Обновлён', ''].forEach((text) => row.append(el('th', '', text)));
    head.append(row);
    const body = el('tbody');
    products.forEach((product) => {
      const tr = el('tr');
      const productCell = tableCell('Товар');
      const summary = el('div', 'admin-product-summary');
      const image = document.createElement('img');
      image.src = product.mainImage;
      image.alt = product.name;
      const copy = el('div');
      copy.append(el('strong', '', product.name), el('small', '', product.slug));
      const flags = el('span', 'admin-product-flags');
      if (product.isNew) flags.append(el('b', '', 'Новинка'));
      if (product.isFeatured) flags.append(el('b', '', 'Популярный'));
      if (flags.childNodes.length) copy.append(flags);
      summary.append(image, copy);
      productCell.append(summary);
      tr.append(productCell, tableCell('Категория', product.category), tableCell('Цена', ctx.price(product.price), 'admin-money'));
      const stock = tableCell('Остаток', String(product.totalStock));
      if (product.totalStock === 0) stock.classList.add('admin-stock-empty');
      tr.append(stock);
      const published = tableCell('Публикация');
      published.append(el('span', `admin-product-visibility ${product.isPublished ? 'is-published' : ''}`, product.isPublished ? 'На сайте' : 'Скрыт'));
      tr.append(published, tableCell('Обновлён', ctx.dateTime(product.updatedAt)));
      const actions = tableCell('Действие');
      const edit = el('a', 'admin-open-link', 'Изменить');
      edit.href = `/admin/products/${product.id}`;
      const toggle = el('button', 'admin-link-button', product.isPublished ? 'Скрыть' : 'Опубликовать');
      toggle.type = 'button';
      toggle.addEventListener('click', () => togglePublished(product, toggle));
      actions.append(edit, toggle);
      tr.append(actions);
      body.append(tr);
    });
    table.append(head, body);
    wrap.append(table);
    return wrap;
  }

  async function togglePublished(product, button) {
    button.disabled = true;
    try {
      await ctx.api(`/api/admin/products/${product.id}/published`, { method: 'PATCH', csrf: true, body: { isPublished: !product.isPublished } });
      ctx.showNotice(product.isPublished ? 'Товар скрыт с витрины' : 'Товар опубликован');
      await renderList();
    } catch (error) {
      ctx.showNotice(error.message || 'Не удалось изменить публикацию');
      button.disabled = false;
    }
  }

  async function loadEdit(id) {
    ctx.title.textContent = 'Редактирование товара';
    setLoading();
    try {
      const data = await ctx.api(`/api/admin/products/${id}`);
      storage = data.storage || storage;
      renderForm(data.product);
    } catch (error) {
      showError(error.message || 'Не удалось загрузить товар');
    }
  }

  function renderForm(product) {
    ctx.title.textContent = product ? 'Редактирование товара' : 'Новый товар';
    const form = el('form', 'admin-product-form');
    form.noValidate = true;
    const back = el('a', 'admin-back-link', '← Все товары');
    back.href = '/admin/products';
    const grid = el('div', 'admin-product-edit-grid');
    const main = el('div');
    const info = panel('Основная информация');
    const name = textField('Название', 'name', product?.name || '', 200, true);
    const category = selectField('Категория', 'categoryId', categories, product?.categoryId);
    const price = numberField('Цена, ₸', 'price', product?.price || '', 1, 100000000);
    const shortDescription = textareaField('Короткое описание', 'shortDescription', product?.shortDescription || '', 500, 3);
    const description = textareaField('Полное описание', 'description', product?.description || '', 10000, 6);
    info.append(name, category, price, shortDescription, description);
    main.append(info, buildVariants(product?.variants || [{ size: 'M', stockQuantity: 0, isActive: true }]), buildImages(product));

    const side = panel('Публикация');
    side.append(checkField('isPublished', 'Показывать на сайте', product?.isPublished || false), checkField('isFeatured', 'Популярный товар', product?.isFeatured || false), checkField('isNew', 'Новинка', product?.isNew || false));
    if (product) {
      const slug = el('p', 'admin-product-slug');
      slug.append(el('span', '', 'URL'), el('code', '', `/product/${product.slug}`));
      side.append(slug);
    }
    const submit = el('button', 'admin-primary-button', product ? 'Сохранить изменения' : 'Создать товар');
    submit.type = 'submit';
    side.append(submit);
    const message = el('p', 'admin-form-message');
    message.dataset.productFormMessage = '';
    side.append(message);
    grid.append(main, side);
    form.append(back, grid);
    form.addEventListener('submit', (event) => saveProduct(event, product, submit, message));
    ctx.content.replaceChildren(form);
    bindVariantButtons();
    bindImageControls(product);
  }

  function buildVariants(variants) {
    const section = panel('Размеры и остатки');
    const note = el('p', 'admin-muted admin-small-note', 'Остаток 0 автоматически делает размер недоступным покупателю.');
    const list = el('div', 'admin-variants');
    list.dataset.variantList = '';
    variants.forEach((variant) => list.append(variantRow(variant)));
    const add = el('button', 'admin-secondary-button', '+ Добавить размер');
    add.type = 'button';
    add.dataset.addVariant = '';
    section.append(note, list, add);
    return section;
  }

  function variantRow(variant = {}) {
    const row = el('div', 'admin-variant-row');
    const size = fieldInput('text', 'variantSize', 'Размер', variant.size || '');
    size.maxLength = 40;
    size.setAttribute('aria-label', 'Размер');
    const stock = fieldInput('number', 'variantStock', 'Остаток', variant.stockQuantity ?? 0);
    stock.min = '0'; stock.max = '100000'; stock.step = '1'; stock.setAttribute('aria-label', 'Остаток');
    const active = checkField('variantActive', 'Активен', variant.isActive !== false);
    const remove = el('button', 'admin-icon-remove', 'Удалить');
    remove.type = 'button'; remove.dataset.removeVariant = '';
    row.append(size, stock, active, remove);
    return row;
  }

  function bindVariantButtons() {
    ctx.content.querySelector('[data-add-variant]')?.addEventListener('click', () => ctx.content.querySelector('[data-variant-list]').append(variantRow({ isActive: true })));
    ctx.content.querySelector('[data-variant-list]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-variant]');
      if (!button) return;
      const list = button.closest('[data-variant-list]');
      if (list.children.length <= 1) return ctx.showNotice('Нужен хотя бы один размер');
      button.closest('.admin-variant-row').remove();
    });
  }

  async function saveProduct(event, product, button, message) {
    event.preventDefault();
    message.textContent = '';
    const form = event.currentTarget;
    const variants = [...form.querySelectorAll('.admin-variant-row')].map((row) => ({
      size: row.querySelector('[name="variantSize"]').value.trim(),
      stockQuantity: Number(row.querySelector('[name="variantStock"]').value),
      isActive: row.querySelector('[name="variantActive"]').checked,
    }));
    const data = {
      name: form.elements.name.value.trim(), categoryId: Number(form.elements.categoryId.value), price: Number(form.elements.price.value),
      shortDescription: form.elements.shortDescription.value.trim(), description: form.elements.description.value.trim(), variants,
      isPublished: form.elements.isPublished.checked, isFeatured: form.elements.isFeatured.checked, isNew: form.elements.isNew.checked,
    };
    button.disabled = true;
    button.textContent = 'Сохраняем…';
    try {
      const result = await ctx.api(product ? `/api/admin/products/${product.id}` : '/api/admin/products', { method: product ? 'PATCH' : 'POST', csrf: true, body: data });
      ctx.showNotice(product ? 'Товар сохранён' : 'Товар создан');
      if (!product) {
        const selectedFiles = form.querySelector('input[name="images"]')?.files;
        if (selectedFiles && selectedFiles.length && storage.configured) {
          try { await uploadFiles(result.product.id, selectedFiles); }
          catch (uploadError) { ctx.showNotice(uploadError.message || 'Товар создан, но фотографии не загрузились'); }
        }
        return window.location.assign(`/admin/products/${result.product.id}`);
      }
      await loadEdit(product.id);
    } catch (error) {
      message.textContent = error.message || 'Не удалось сохранить товар';
      button.disabled = false;
      button.textContent = product ? 'Сохранить изменения' : 'Создать товар';
    }
  }

  function buildImages(product) {
    const section = panel('Фотографии');
    const storageInfo = el('p', storage.configured ? 'admin-storage-ready' : 'admin-storage-warning', storage.configured ? 'Хранилище изображений готово.' : (storage.message || 'Хранилище изображений ещё не настроено'));
    const images = el('div', 'admin-product-images');
    images.dataset.existingImages = '';
    (product?.images || []).forEach((item) => images.append(imageCard(product, item)));
    const uploadLabel = el('label', 'admin-upload-field');
    uploadLabel.append(el('span', '', 'Добавить JPEG, PNG или WebP — до 8 МБ, максимум 8 фото'));
    const input = document.createElement('input');
    input.type = 'file'; input.name = 'images'; input.multiple = true; input.accept = 'image/jpeg,image/png,image/webp'; input.disabled = !storage.configured;
    uploadLabel.append(input);
    const preview = el('div', 'admin-upload-preview');
    preview.dataset.uploadPreview = '';
    section.append(storageInfo, images, uploadLabel, preview);
    if (product) {
      const upload = el('button', 'admin-secondary-button', 'Загрузить фотографии');
      upload.type = 'button'; upload.dataset.uploadImages = ''; upload.disabled = !storage.configured;
      section.append(upload);
    } else {
      section.append(el('p', 'admin-muted admin-small-note', storage.configured ? 'Фотографии загрузятся сразу после создания товара.' : 'Товар можно создать без фото; загрузка станет доступна после настройки постоянного хранилища.'));
    }
    return section;
  }

  function imageCard(product, item) {
    const card = el('article', 'admin-image-card');
    const image = document.createElement('img'); image.src = item.url; image.alt = product.name;
    const actions = el('div');
    const primary = el('button', 'admin-link-button', item.isPrimary ? 'Главное фото' : 'Сделать главным');
    primary.type = 'button'; primary.disabled = item.isPrimary; primary.dataset.makePrimary = String(item.id);
    const remove = el('button', 'admin-link-button danger', 'Удалить');
    remove.type = 'button'; remove.dataset.deleteImage = String(item.id);
    actions.append(primary, remove); card.append(image, actions); return card;
  }

  function bindImageControls(product) {
    const input = ctx.content.querySelector('input[name="images"]');
    input?.addEventListener('change', () => previewFiles(input.files));
    if (!product) return;
    ctx.content.querySelector('[data-upload-images]')?.addEventListener('click', (event) => uploadImages(product.id, input, event.currentTarget));
    ctx.content.querySelector('[data-existing-images]')?.addEventListener('click', async (event) => {
      const primary = event.target.closest('[data-make-primary]');
      const remove = event.target.closest('[data-delete-image]');
      if (!primary && !remove) return;
      const button = primary || remove; button.disabled = true;
      try {
        const imageId = primary ? primary.dataset.makePrimary : remove.dataset.deleteImage;
        await ctx.api(`/api/admin/products/${product.id}/images/${imageId}${primary ? '/primary' : ''}`, { method: primary ? 'PATCH' : 'DELETE', csrf: true });
        ctx.showNotice(primary ? 'Главная фотография обновлена' : 'Фотография удалена');
        await loadEdit(product.id);
      } catch (error) { ctx.showNotice(error.message || 'Не удалось изменить фотографию'); button.disabled = false; }
    });
  }

  function previewFiles(fileList) {
    const target = ctx.content.querySelector('[data-upload-preview]');
    target.replaceChildren();
    [...fileList].slice(0, 8).forEach((file) => {
      const image = document.createElement('img');
      image.src = URL.createObjectURL(file); image.alt = `Предпросмотр ${file.name}`;
      image.addEventListener('load', () => URL.revokeObjectURL(image.src), { once: true });
      target.append(image);
    });
  }

  async function uploadImages(productId, input, button) {
    if (!input.files.length) return ctx.showNotice('Выберите фотографии');
    if (input.files.length > 8) return ctx.showNotice('Можно выбрать максимум 8 фотографий');
    button.disabled = true; button.textContent = 'Загружаем…';
    try {
      await uploadFiles(productId, input.files);
      ctx.showNotice('Фотографии загружены');
      await loadEdit(productId);
    } catch (error) { ctx.showNotice(error.message); button.disabled = false; button.textContent = 'Загрузить фотографии'; }
  }

  async function uploadFiles(productId, files) {
    const body = new FormData(); [...files].forEach((file) => body.append('images', file));
    const response = await fetch(`/api/admin/products/${productId}/images`, { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': ctx.csrfToken, Accept: 'application/json' }, body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Не удалось загрузить фотографии');
    return result;
  }

  function buildPagination(pagination, state) {
    const nav = el('nav', 'admin-pagination');
    nav.setAttribute('aria-label', 'Пагинация товаров');
    nav.append(productPageLink('Назад', pagination.page - 1, pagination.page <= 1, state));
    nav.append(el('span', '', `Страница ${pagination.page} из ${pagination.totalPages}`));
    nav.append(productPageLink('Вперёд', pagination.page + 1, pagination.page >= pagination.totalPages, state));
    return nav;
  }

  function productPageLink(label, page, disabled, state) {
    const link = el('a', '', label); const query = new URLSearchParams({ page: String(page) });
    if (state.q) query.set('q', state.q); if (state.category) query.set('category', state.category); if (state.visibility) query.set('visibility', state.visibility);
    if (state.featured) query.set('featured', '1'); if (state.isNew) query.set('new', '1');
    link.href = `/admin/products?${query}`; if (disabled) link.setAttribute('aria-disabled', 'true'); return link;
  }

  function emptyState() {
    const box = el('div', 'admin-empty'); box.append(el('p', '', 'В каталоге пока нет товаров'));
    const link = el('a', 'admin-primary-button admin-button-link', 'Добавить первый товар'); link.href = '/admin/products/new'; box.append(link); return box;
  }
  function panel(text) { const node = el('section', 'admin-panel'); node.append(el('h2', '', text)); return node; }
  function textField(label, name, value, max, required) { const wrap = field(label); const input = fieldInput('text', name, '', value); input.maxLength = max; input.required = required; wrap.append(input); return wrap; }
  function numberField(label, name, value, min, max) { const wrap = field(label); const input = fieldInput('number', name, '', value); input.min = min; input.max = max; input.step = '1'; input.required = true; wrap.append(input); return wrap; }
  function textareaField(label, name, value, max, rows) { const wrap = field(label); const input = document.createElement('textarea'); input.name = name; input.value = value; input.maxLength = max; input.rows = rows; wrap.append(input); return wrap; }
  function selectField(label, name, items, selected) { const wrap = field(label); const input = el('select'); input.name = name; input.required = true; input.append(option('', 'Выберите категорию', !selected)); items.forEach((item) => input.append(option(String(item.id), item.name, Number(selected) === item.id))); wrap.append(input); return wrap; }
  function field(label) { const wrap = el('label', 'admin-field'); wrap.append(el('span', '', label)); return wrap; }
  function fieldInput(type, name, placeholder, value) { const input = document.createElement('input'); input.type = type; input.name = name; input.placeholder = placeholder; input.value = value ?? ''; return input; }
  function checkField(name, label, checked) { const wrap = el('label', 'admin-check'); const input = document.createElement('input'); input.type = 'checkbox'; input.name = name; input.checked = Boolean(checked); wrap.append(input, el('span', '', label)); return wrap; }
  function option(value, label, selected) { const node = el('option', '', label); node.value = value; node.selected = Boolean(selected); return node; }
  function tableCell(label, text, className = '') { const cell = el('td', className, text); cell.dataset.label = label; return cell; }
  function setLoading() { ctx.content.replaceChildren(el('div', 'admin-loading', 'Загружаем товары…')); }
  function showError(message) { ctx.content.replaceChildren(el('div', 'admin-error', message)); }
  function el(tag, className = '', text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }

  window.SottAdminProducts = { initialize };
}());
