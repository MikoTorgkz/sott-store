(function () {
  const content = document.querySelector('#admin-content');
  const title = document.querySelector('#admin-page-title');
  const notice = document.querySelector('#admin-notice');
  const logoutButton = document.querySelector('#admin-logout');
  const menuButton = document.querySelector('#admin-mobile-toggle');
  const sidebar = document.querySelector('#admin-sidebar');
  const backdrop = document.querySelector('#admin-sidebar-backdrop');
  let csrfToken = '';

  if (!content || !title) return;

  const statuses = {
    new: { label: 'Новый', className: 'admin-status-new' },
    confirmed: { label: 'Подтверждён', className: 'admin-status-confirmed' },
    completed: { label: 'Завершён', className: 'admin-status-completed' },
    cancelled: { label: 'Отменён', className: 'admin-status-cancelled' },
  };

  initialize().catch(() => showFatal('Не удалось загрузить админ-панель'));

  async function initialize() {
    const session = await api('/api/admin/session');
    csrfToken = session.csrfToken;
    setupNavigation();
    const orderMatch = window.location.pathname.match(/^\/admin\/orders\/(\d+)$/);
    if (orderMatch) return renderOrder(Number(orderMatch[1]));
    if (window.location.pathname === '/admin/orders') return renderOrders();
    return renderDashboard();
  }

  function setupNavigation() {
    const isOrders = window.location.pathname.startsWith('/admin/orders');
    document.querySelector(`[data-nav="${isOrders ? 'orders' : 'overview'}"]`)?.classList.add('active');

    logoutButton?.addEventListener('click', async () => {
      logoutButton.disabled = true;
      try {
        await api('/api/admin/logout', { method: 'POST', csrf: true });
      } finally {
        window.location.assign('/admin/login');
      }
    });

    menuButton?.addEventListener('click', () => setMenuOpen(!sidebar.classList.contains('is-open')));
    backdrop?.addEventListener('click', () => setMenuOpen(false));
  }

  function setMenuOpen(open) {
    sidebar?.classList.toggle('is-open', open);
    if (backdrop) backdrop.hidden = !open;
    menuButton?.setAttribute('aria-expanded', String(open));
  }

  async function renderDashboard() {
    title.textContent = 'Обзор';
    setLoading();
    try {
      const data = await api('/api/admin/dashboard');
      const fragment = document.createDocumentFragment();
      const stats = el('section', 'admin-stats');
      stats.setAttribute('aria-label', 'Статистика заказов');
      stats.append(
        statCard('Новые заказы', data.stats.newOrders, true),
        statCard('Всего заказов', data.stats.totalOrders),
        statCard('Заказов сегодня', data.stats.todayOrders),
        statCard('Сумма оформленных заказов', price(data.stats.ordersAmount)),
      );
      fragment.append(stats);

      const section = el('section', 'admin-section');
      const heading = el('div', 'admin-section-heading');
      heading.append(el('h2', '', 'Последние заказы'));
      const allLink = el('a', 'admin-text-link', 'Смотреть все →');
      allLink.href = '/admin/orders';
      heading.append(allLink);
      section.append(heading);
      section.append(data.recentOrders.length ? buildOrdersTable(data.recentOrders, false) : emptyState('Заказов пока нет'));
      fragment.append(section);
      content.replaceChildren(fragment);
    } catch (error) {
      showFatal(error.message || 'Не удалось загрузить заказы');
    }
  }

  async function renderOrders() {
    title.textContent = 'Заказы';
    setLoading();
    const params = new URLSearchParams(window.location.search);
    const status = statuses[params.get('status')] ? params.get('status') : '';
    const search = (params.get('q') || '').slice(0, 100);
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
    const sort = params.get('sort') === 'oldest' ? 'oldest' : 'newest';

    try {
      const query = new URLSearchParams({ page: String(page), sort });
      if (status) query.set('status', status);
      if (search) query.set('q', search);
      const data = await api(`/api/admin/orders?${query}`);
      const fragment = document.createDocumentFragment();
      fragment.append(buildOrdersToolbar({ status, search, sort }));
      fragment.append(buildFilterTabs({ status, search, sort }));
      fragment.append(data.orders.length ? buildOrdersTable(data.orders, true) : emptyState('Заказы не найдены'));
      fragment.append(buildPagination(data.pagination, { status, search, sort }));
      content.replaceChildren(fragment);
    } catch (error) {
      showFatal(error.message || 'Не удалось загрузить заказы');
    }
  }

  async function renderOrder(id) {
    title.textContent = 'Детали заказа';
    setLoading();
    try {
      const order = await api(`/api/admin/orders/${id}`);
      title.textContent = `Заказ #${order.code}`;
      const fragment = document.createDocumentFragment();
      const back = el('a', 'admin-back-link', '← Все заказы');
      back.href = '/admin/orders';
      fragment.append(back);

      const grid = el('div', 'admin-detail-grid');
      const left = el('div');
      const clientPanel = panel('Клиент');
      clientPanel.append(detailMeta([
        ['Имя', order.customerName],
        ['Город', order.city],
        ['WhatsApp', order.whatsapp],
        ['Дата', dateTime(order.createdAt)],
      ]));
      left.append(clientPanel);

      const productsPanel = panel('Товары');
      const products = el('div', 'admin-detail-products');
      order.items.forEach((item) => products.append(productRow(item)));
      productsPanel.append(products);
      const total = el('div', 'admin-order-total');
      total.append(el('span', '', 'Итого'), el('strong', '', price(order.total)));
      productsPanel.append(total);
      productsPanel.style.marginTop = '16px';
      left.append(productsPanel);
      grid.append(left);

      const side = panel('Обработка заказа');
      const statusBox = el('div', 'admin-status-control');
      const statusLabel = el('label', '', 'Статус');
      statusLabel.htmlFor = 'admin-order-status';
      const select = el('select');
      select.id = 'admin-order-status';
      Object.entries(statuses).forEach(([value, info]) => {
        const option = el('option', '', info.label);
        option.value = value;
        option.selected = order.status === value;
        select.append(option);
      });
      const save = el('button', '', 'Сохранить статус');
      save.type = 'button';
      save.addEventListener('click', () => saveStatus(order.id, select, save));
      statusBox.append(statusLabel, select, save, statusBadge(order.status));
      side.append(statusBox);

      const actions = el('div', 'admin-actions');
      const wa = el('a', 'admin-whatsapp', 'Написать клиенту в WhatsApp');
      wa.href = whatsappUrl(order.whatsapp);
      wa.target = '_blank';
      wa.rel = 'noopener';
      const publicLink = el('a', '', 'Открыть страницу заказа');
      publicLink.href = `/order/${encodeURIComponent(order.token)}`;
      publicLink.target = '_blank';
      publicLink.rel = 'noopener';
      const copy = el('button', '', 'Скопировать ссылку');
      copy.type = 'button';
      copy.addEventListener('click', () => copyOrderLink(order.token, copy));
      actions.append(wa, publicLink, copy);
      side.append(actions);
      grid.append(side);
      fragment.append(grid);
      content.replaceChildren(fragment);
    } catch (error) {
      showFatal(error.message || 'Не удалось загрузить заказ');
    }
  }

  function buildOrdersToolbar(state) {
    const form = el('form', 'admin-toolbar');
    const input = el('input');
    input.type = 'search';
    input.name = 'q';
    input.value = state.search;
    input.maxLength = 100;
    input.placeholder = 'Имя, WhatsApp, город или код';
    input.setAttribute('aria-label', 'Поиск заказов');
    const status = el('select');
    status.name = 'status';
    status.setAttribute('aria-label', 'Фильтр по статусу');
    status.append(option('', 'Все статусы', !state.status));
    Object.entries(statuses).forEach(([value, info]) => status.append(option(value, info.label, state.status === value)));
    const sort = el('select');
    sort.name = 'sort';
    sort.setAttribute('aria-label', 'Сортировка');
    sort.append(option('newest', 'Сначала новые', state.sort === 'newest'), option('oldest', 'Сначала старые', state.sort === 'oldest'));
    const submit = el('button', '', 'Найти');
    submit.type = 'submit';
    form.append(input, status, sort, submit);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = new URLSearchParams();
      const q = input.value.trim();
      if (q) query.set('q', q);
      if (status.value) query.set('status', status.value);
      if (sort.value === 'oldest') query.set('sort', 'oldest');
      window.location.assign(`/admin/orders${query.size ? `?${query}` : ''}`);
    });
    return form;
  }

  function buildFilterTabs(state) {
    const nav = el('nav', 'admin-filter-tabs');
    nav.setAttribute('aria-label', 'Статусы заказов');
    [['', 'Все'], ...Object.entries(statuses).map(([value, info]) => [value, info.label])].forEach(([value, label]) => {
      const link = el('a', value === state.status ? 'active' : '', label);
      const query = new URLSearchParams();
      if (value) query.set('status', value);
      if (state.search) query.set('q', state.search);
      if (state.sort === 'oldest') query.set('sort', 'oldest');
      link.href = `/admin/orders${query.size ? `?${query}` : ''}`;
      if (value === state.status) link.setAttribute('aria-current', 'page');
      nav.append(link);
    });
    return nav;
  }

  function buildOrdersTable(orders, showItems) {
    const wrap = el('div', 'admin-table-wrap');
    const table = el('table', 'admin-table');
    const thead = el('thead');
    const head = el('tr');
    ['Код', 'Дата', 'Клиент', 'Город', 'WhatsApp', ...(showItems ? ['Позиций'] : []), 'Итого', 'Статус', ''].forEach((label) => head.append(el('th', '', label)));
    thead.append(head);
    const tbody = el('tbody');
    orders.forEach((order) => {
      const row = el('tr');
      row.append(tableCell('Код', `#${order.code}`, 'admin-order-code'));
      row.append(tableCell('Дата', dateTime(order.createdAt)));
      row.append(tableCell('Клиент', order.customerName, 'admin-client-cell'));
      row.append(tableCell('Город', order.city));
      row.append(tableCell('WhatsApp', order.whatsapp));
      if (showItems) row.append(tableCell('Позиций', String(order.itemCount || 0)));
      row.append(tableCell('Итого', price(order.total), 'admin-money'));
      const statusCell = tableCell('Статус');
      statusCell.append(statusBadge(order.status));
      row.append(statusCell);
      const actionCell = tableCell('Действие');
      const link = el('a', 'admin-open-link', 'Открыть');
      link.href = `/admin/orders/${order.id}`;
      actionCell.append(link);
      row.append(actionCell);
      tbody.append(row);
    });
    table.append(thead, tbody);
    wrap.append(table);
    return wrap;
  }

  function buildPagination(pagination, state) {
    const nav = el('nav', 'admin-pagination');
    nav.setAttribute('aria-label', 'Пагинация заказов');
    nav.append(pageLink('Назад', pagination.page - 1, pagination.page <= 1, state));
    nav.append(el('span', '', `Страница ${pagination.page} из ${pagination.totalPages}`));
    nav.append(pageLink('Вперёд', pagination.page + 1, pagination.page >= pagination.totalPages, state));
    return nav;
  }

  function pageLink(label, page, disabled, state) {
    const link = el('a', '', label);
    const query = new URLSearchParams({ page: String(Math.max(1, page)) });
    if (state.status) query.set('status', state.status);
    if (state.search) query.set('q', state.search);
    if (state.sort === 'oldest') query.set('sort', 'oldest');
    link.href = `/admin/orders?${query}`;
    if (disabled) link.setAttribute('aria-disabled', 'true');
    return link;
  }

  async function saveStatus(id, select, button) {
    button.disabled = true;
    button.textContent = 'Сохраняем…';
    try {
      const result = await api(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        csrf: true,
        body: { status: select.value },
      });
      const current = button.parentElement.querySelector('.admin-status');
      current?.replaceWith(statusBadge(result.status));
      showNotice('Статус заказа обновлён');
    } catch (error) {
      showNotice(error.message || 'Не удалось изменить статус');
    } finally {
      button.disabled = false;
      button.textContent = 'Сохранить статус';
    }
  }

  async function copyOrderLink(token, button) {
    const url = `${window.location.origin}/order/${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      button.textContent = 'Ссылка скопирована';
      window.setTimeout(() => { button.textContent = 'Скопировать ссылку'; }, 1800);
    } catch (_error) {
      showNotice('Не удалось скопировать ссылку');
    }
  }

  async function api(url, options = {}) {
    const headers = { Accept: 'application/json' };
    if (options.body) headers['Content-Type'] = 'application/json';
    if (options.csrf) headers['X-CSRF-Token'] = csrfToken;
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
    });
    if (response.status === 401) {
      window.location.assign('/admin/login');
      throw new Error('Требуется вход');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Ошибка сервера');
    return result;
  }

  function panel(titleText) {
    const section = el('section', 'admin-panel');
    section.append(el('h2', '', titleText));
    return section;
  }

  function detailMeta(entries) {
    const grid = el('div', 'admin-detail-meta');
    entries.forEach(([label, value]) => {
      const item = el('div');
      item.append(el('span', '', label), el('strong', '', String(value || '—')));
      grid.append(item);
    });
    return grid;
  }

  function productRow(item) {
    const row = el('article', 'admin-detail-product');
    const image = document.createElement('img');
    image.src = item.image;
    image.alt = item.name;
    const info = el('div');
    info.append(el('h3', '', item.name));
    info.append(el('p', '', `Размер: ${item.size}`));
    info.append(el('p', '', `${item.quantity} × ${price(item.unitPrice)}`));
    row.append(image, info, el('strong', 'admin-money', price(item.lineTotal)));
    return row;
  }

  function statCard(label, value, accent) {
    const card = el('article', `admin-stat-card${accent ? ' accent' : ''}`);
    card.append(el('span', '', label), el('strong', '', String(value)));
    return card;
  }

  function tableCell(label, value, className) {
    const cell = el('td', className || '', value === undefined ? '' : value);
    cell.dataset.label = label;
    return cell;
  }

  function statusBadge(status) {
    const info = statuses[status] || { label: 'Неизвестен', className: '' };
    return el('span', `admin-status ${info.className}`, info.label);
  }

  function option(value, label, selected) {
    const element = el('option', '', label);
    element.value = value;
    element.selected = selected;
    return element;
  }

  function emptyState(message) {
    return el('div', 'admin-empty', message);
  }

  function setLoading() {
    content.replaceChildren(el('div', 'admin-loading', 'Загружаем данные…'));
  }

  function showFatal(message) {
    content.replaceChildren(el('div', 'admin-error', message));
  }

  function showNotice(message) {
    if (!notice) return;
    notice.textContent = message;
    notice.hidden = false;
    window.setTimeout(() => { notice.hidden = true; }, 2600);
  }

  function whatsappUrl(value) {
    const digits = String(value || '').replace(/\D/g, '');
    const text = encodeURIComponent('Здравствуйте! Это магазин SOTT по вашему заказу.');
    return `https://wa.me/${digits}?text=${text}`;
  }

  function price(value) {
    if (window.SottCatalog && typeof window.SottCatalog.formatPrice === 'function') return window.SottCatalog.formatPrice(Number(value) || 0);
    return `${new Intl.NumberFormat('ru-RU').format(Number(value) || 0)} ₸`;
  }

  function dateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Almaty' }).format(date);
  }

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = String(text);
    return element;
  }
}());
