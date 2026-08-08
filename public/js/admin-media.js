(function () {
  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const MAX_BYTES = 8 * 1024 * 1024;
  let ctx;

  async function initialize(context) {
    ctx = context;
    ctx.title.textContent = 'Медиа сайта';
    await load();
  }

  async function load() {
    ctx.content.replaceChildren(el('div', 'admin-loading', 'Загружаем медиа…'));
    try {
      const response = await fetch('/api/admin/site-media', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      if (response.status === 401) return window.location.assign('/admin/login');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить медиа сайта');
      render(data.media || [], data.storage || {}, data.databaseAvailable !== false);
    } catch (error) {
      ctx.content.replaceChildren(el('div', 'admin-error', error.message || 'Не удалось загрузить медиа сайта'));
    }
  }

  function render(items, storage, databaseAvailable) {
    const fragment = document.createDocumentFragment();
    const intro = el('section', 'admin-panel');
    intro.append(el('h2', '', 'Изображения витрины'), el('p', 'admin-muted', 'Здесь можно менять логотип, главные баннеры и изображения категорий без изменения кода.'));
    const ready = Boolean(storage.configured && databaseAvailable);
    intro.append(el('p', ready ? 'admin-storage-ready' : 'admin-storage-warning', !databaseAvailable ? 'База данных временно недоступна — просмотр стандартных изображений доступен' : storage.configured ? 'Хранилище фотографий подключено' : 'Хранилище фотографий не настроено'));
    fragment.append(intro);
    const grid = el('section', 'admin-media-grid');
    items.forEach((item) => grid.append(mediaCard(item, ready)));
    fragment.append(grid);
    ctx.content.replaceChildren(fragment);
  }

  function mediaCard(item, storageReady) {
    const card = el('article', 'admin-media-card');
    const preview = el('div', 'admin-media-preview');
    const image = document.createElement('img'); image.src = item.imageUrl; image.alt = item.label; preview.append(image);
    const body = el('div', 'admin-media-body');
    body.append(el('h2', '', item.label), el('p', '', item.usage));
    const input = document.createElement('input'); input.className = 'admin-media-file'; input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.disabled = !storageReady;
    const selected = el('div', 'admin-media-selected', 'Файл не выбран');
    const actions = el('div', 'admin-media-actions');
    const upload = el('button', 'admin-primary-button', 'Заменить'); upload.type = 'button'; upload.disabled = true;
    const reset = el('button', 'admin-secondary-button', 'Вернуть стандартное изображение'); reset.type = 'button'; reset.disabled = !item.custom;
    actions.append(upload, reset); body.append(input, selected, actions); card.append(preview, body);

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      const error = validateFile(file);
      selected.textContent = error || (file ? file.name : 'Файл не выбран');
      upload.disabled = Boolean(error) || !file || !storageReady;
      if (file && !error) {
        const objectUrl = URL.createObjectURL(file); image.src = objectUrl;
        image.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
      } else image.src = item.imageUrl;
    });
    upload.addEventListener('click', () => uploadImage(item.key, input, upload));
    reset.addEventListener('click', () => resetImage(item.key, reset));
    return card;
  }

  function validateFile(file) {
    if (!file) return 'Выберите изображение';
    const extension = String(file.name || '').split('.').pop().toLowerCase();
    if (!ALLOWED_TYPES.has(file.type) || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) return 'Поддерживаются JPEG, PNG и WebP';
    if (file.size > MAX_BYTES) return 'Файл слишком большой';
    return '';
  }

  async function uploadImage(key, input, button) {
    const file = input.files && input.files[0]; const error = validateFile(file); if (error) return ctx.showNotice(error);
    button.disabled = true; button.textContent = 'Загружаем…';
    const body = new FormData(); body.append('image', file);
    try {
      const response = await fetch(`/api/admin/site-media/${encodeURIComponent(key)}/image`, { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'X-CSRF-Token': ctx.csrfToken }, body });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Не удалось загрузить фотографию');
      ctx.showNotice('Изображение обновлено'); await load();
    } catch (uploadError) { ctx.showNotice(uploadError.message || 'Не удалось загрузить фотографию'); button.disabled = false; button.textContent = 'Заменить'; }
  }

  async function resetImage(key, button) {
    button.disabled = true;
    try {
      const response = await fetch(`/api/admin/site-media/${encodeURIComponent(key)}/image`, { method: 'DELETE', credentials: 'same-origin', headers: { Accept: 'application/json', 'X-CSRF-Token': ctx.csrfToken } });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Не удалось вернуть стандартное изображение');
      ctx.showNotice('Стандартное изображение восстановлено'); await load();
    } catch (error) { ctx.showNotice(error.message || 'Не удалось изменить изображение'); button.disabled = false; }
  }

  function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; }

  window.SottAdminMedia = { initialize };
}());
