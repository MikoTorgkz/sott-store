const express = require('express');
const path = require('path');
const { initializeDatabase } = require('./db');
const { createOrder, getOrderByToken, OrderValidationError } = require('./orders');
const { getDashboard, listOrders, getAdminOrderById, updateOrderStatus, InventoryError } = require('./admin-orders');
const {
  CatalogValidationError, searchPublicProducts, listPublicSizes, getPublicProductBySlug, listCategories,
  listAdminProducts, getAdminProductById, createProduct, updateProduct, setProductPublished,
  addProductImages, setPrimaryImage, deleteProductImage,
} = require('./catalog');
const { uploadProductImages, validateUploadedImage } = require('./product-upload');
const { getStorageStatus, getUploadDirectory, saveImage, removeImage } = require('./product-storage');
const {
  checkLoginRateLimit,
  clearLoginFailures,
  clearSessionCookie,
  createSession,
  destroySession,
  isAdminConfigured,
  isSameOrigin,
  readSession,
  recordLoginFailure,
  requireAdminApi,
  requireAdminPage,
  requireCsrf,
  setSessionCookie,
  verifyCredentials,
} = require('./admin-auth');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const adminDir = path.join(__dirname, 'admin');

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
const persistentUploadDir = getUploadDirectory();
if (persistentUploadDir && getStorageStatus().mode === 'railway-volume') {
  app.use('/uploads/products', express.static(persistentUploadDir, {
    fallthrough: false,
    maxAge: '7d',
    setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); },
  }));
}
app.use(express.static(publicDir, {
  extensions: ['html'],
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
}));

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/product/:slug', (_req, res) => {
  res.sendFile(path.join(publicDir, 'product.html'));
});

app.get('/cart', (_req, res) => {
  res.sendFile(path.join(publicDir, 'cart.html'));
});

app.get('/catalog', (_req, res) => res.sendFile(path.join(publicDir, 'catalog.html')));
app.get('/favorites', (_req, res) => res.sendFile(path.join(publicDir, 'favorites.html')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await searchPublicProducts({
      q: String(req.query.q || ''),
      category: String(req.query.category || ''),
      size: String(req.query.size || ''), minPrice: req.query.minPrice, maxPrice: req.query.maxPrice,
      inStock: req.query.inStock === '1',
      featured: req.query.featured === '1',
      isNew: req.query.new === '1',
      sort: String(req.query.sort || ''), page: req.query.page, limit: req.query.limit, ids: req.query.ids,
    });
    return res.json({ ...result, products: result.items });
  } catch (error) {
    if (error instanceof CatalogValidationError) return res.status(error.status).json({ error: error.message });
    console.error('SOTT public catalog failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось загрузить каталог' });
  }
});

app.get('/api/catalog/filters', async (_req, res) => {
  try {
    const [categories, sizes] = await Promise.all([listCategories({ activeOnly: true }), listPublicSizes()]);
    return res.json({ categories, sizes });
  } catch (error) {
    console.error('SOTT catalog filters failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось загрузить фильтры' });
  }
});

app.get('/api/products/:slug', async (req, res) => {
  try {
    const product = await getPublicProductBySlug(req.params.slug);
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    return res.json(product);
  } catch (error) {
    console.error('SOTT public product failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось загрузить товар' });
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    return res.json({ categories: await listCategories({ activeOnly: true }) });
  } catch (error) {
    console.error('SOTT public categories failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось загрузить категории' });
  }
});

app.use(['/admin', '/admin/*splat'], (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  next();
});

app.get('/admin/login', (req, res) => {
  if (readSession(req)) return res.redirect(302, '/admin');
  return res.sendFile(path.join(adminDir, 'login.html'));
});

app.post('/api/admin/login', async (req, res) => {
  if (!isAdminConfigured()) return res.status(503).json({ error: 'Админ-панель временно недоступна' });
  if (!isSameOrigin(req)) return res.status(403).json({ error: 'Запрос отклонён' });
  const limit = checkLoginRateLimit(req.ip);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))));
    return res.status(429).json({ error: 'Слишком много попыток. Попробуйте позже' });
  }
  const username = req.body && req.body.username;
  const password = req.body && req.body.password;
  if (!(await verifyCredentials(username, password))) {
    recordLoginFailure(req.ip);
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  clearLoginFailures(req.ip);
  const session = createSession();
  setSessionCookie(res, session.value);
  return res.json({ ok: true, csrfToken: session.payload.csrf });
});

app.get('/api/admin/session', requireAdminApi, (req, res) => {
  res.json({ authenticated: true, csrfToken: req.adminSession.csrf });
});

app.post('/api/admin/logout', requireAdminApi, requireCsrf, (req, res) => {
  destroySession(req);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/admin/dashboard', requireAdminApi, async (_req, res) => {
  try {
    return res.json(await getDashboard());
  } catch (error) {
    console.error('SOTT admin dashboard failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось загрузить заказы' });
  }
});

app.get('/api/admin/orders', requireAdminApi, async (req, res) => {
  try {
    return res.json(await listOrders({
      status: String(req.query.status || ''),
      search: String(req.query.q || ''),
      page: req.query.page,
      sort: String(req.query.sort || ''),
    }));
  } catch (error) {
    console.error('SOTT admin orders failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось загрузить заказы' });
  }
});

app.get('/api/admin/orders/:id', requireAdminApi, async (req, res) => {
  const id = parseAdminOrderId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Заказ не найден' });
  try {
    const order = await getAdminOrderById(id);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    return res.json(order);
  } catch (error) {
    console.error('SOTT admin order failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось загрузить заказ' });
  }
});

app.get('/api/admin/categories', requireAdminApi, async (_req, res) => {
  try {
    return res.json({ categories: await listCategories() });
  } catch (error) {
    console.error('SOTT admin categories failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось загрузить категории' });
  }
});

app.get('/api/admin/product-storage', requireAdminApi, (_req, res) => {
  res.json(getStorageStatus());
});

app.get('/api/admin/products', requireAdminApi, async (req, res) => {
  try {
    return res.json(await listAdminProducts({
      search: String(req.query.q || ''), categoryId: req.query.category,
      visibility: String(req.query.visibility || ''), featured: req.query.featured === '1', isNew: req.query.new === '1', page: req.query.page,
    }));
  } catch (error) {
    console.error('SOTT admin products failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось загрузить товары' });
  }
});

app.get('/api/admin/products/:id', requireAdminApi, async (req, res) => {
  const id = parseAdminOrderId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Товар не найден' });
  try {
    const product = await getAdminProductById(id);
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    return res.json({ product, storage: getStorageStatus() });
  } catch (error) {
    console.error('SOTT admin product failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось загрузить товар' });
  }
});

app.post('/api/admin/products', requireAdminApi, requireCsrf, async (req, res) => {
  try {
    return res.status(201).json({ product: await createProduct(req.body) });
  } catch (error) {
    return handleCatalogError(error, res, 'Не удалось сохранить товар');
  }
});

app.patch('/api/admin/products/:id', requireAdminApi, requireCsrf, async (req, res) => {
  const id = parseAdminOrderId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Товар не найден' });
  try {
    const product = await updateProduct(id, req.body);
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    return res.json({ product });
  } catch (error) {
    return handleCatalogError(error, res, 'Не удалось сохранить товар');
  }
});

app.patch('/api/admin/products/:id/published', requireAdminApi, requireCsrf, async (req, res) => {
  try {
    const product = await setProductPublished(req.params.id, req.body && req.body.isPublished);
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    return res.json({ id: Number(product.id), isPublished: product.is_published });
  } catch (error) {
    return handleCatalogError(error, res, 'Не удалось изменить публикацию');
  }
});

app.post('/api/admin/products/:id/images', requireAdminApi, requireCsrf, uploadProductImages, async (req, res) => {
  const id = parseAdminOrderId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Товар не найден' });
  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) return res.status(400).json({ error: 'Выберите фотографии' });
  let formats;
  try {
    formats = files.map(validateUploadedImage);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Не удалось загрузить фотографию' });
  }
  const storage = getStorageStatus();
  if (!storage.configured) return res.status(503).json({ error: storage.message });
  const urls = [];
  try {
    for (let index = 0; index < files.length; index += 1) urls.push(await saveImage(files[index].buffer, formats[index]));
    const product = await addProductImages(id, urls);
    if (!product) throw new CatalogValidationError('Товар не найден', 404);
    return res.status(201).json({ product });
  } catch (error) {
    await Promise.allSettled(urls.map(removeImage));
    return handleCatalogError(error, res, 'Не удалось загрузить фотографию');
  }
});

app.patch('/api/admin/products/:id/images/:imageId/primary', requireAdminApi, requireCsrf, async (req, res) => {
  try {
    const updated = await setPrimaryImage(req.params.id, req.params.imageId);
    if (!updated) return res.status(404).json({ error: 'Фотография не найдена' });
    return res.json({ ok: true });
  } catch (error) {
    return handleCatalogError(error, res, 'Не удалось изменить фотографию');
  }
});

app.delete('/api/admin/products/:id/images/:imageId', requireAdminApi, requireCsrf, async (req, res) => {
  try {
    const deleted = await deleteProductImage(req.params.id, req.params.imageId);
    if (!deleted) return res.status(404).json({ error: 'Фотография не найдена' });
    await removeImage(deleted.image_url);
    return res.json({ ok: true });
  } catch (error) {
    return handleCatalogError(error, res, 'Не удалось удалить фотографию');
  }
});

app.patch('/api/admin/orders/:id/status', requireAdminApi, requireCsrf, async (req, res) => {
  const id = parseAdminOrderId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Заказ не найден' });
  const status = req.body && req.body.status;
  try {
    const updated = await updateOrderStatus(id, status);
    if (updated && updated.invalidStatus) return res.status(400).json({ error: 'Недопустимый статус заказа' });
    if (!updated) return res.status(404).json({ error: 'Заказ не найден' });
    return res.json({ id: Number(updated.id), status: updated.status });
  } catch (error) {
    if (error instanceof InventoryError) return res.status(error.status).json({ error: error.message });
    console.error('SOTT admin status update failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось изменить статус' });
  }
});

app.get('/admin', requireAdminPage, (_req, res) => {
  res.sendFile(path.join(adminDir, 'index.html'));
});

app.get('/admin/orders', requireAdminPage, (_req, res) => {
  res.sendFile(path.join(adminDir, 'index.html'));
});

app.get('/admin/orders/:id', requireAdminPage, (req, res) => {
  if (!parseAdminOrderId(req.params.id)) return res.status(404).sendFile(path.join(adminDir, 'not-found.html'));
  return res.sendFile(path.join(adminDir, 'index.html'));
});

app.get('/admin/products', requireAdminPage, (_req, res) => res.sendFile(path.join(adminDir, 'index.html')));
app.get('/admin/products/new', requireAdminPage, (_req, res) => res.sendFile(path.join(adminDir, 'index.html')));
app.get('/admin/products/:id', requireAdminPage, (req, res) => {
  if (!parseAdminOrderId(req.params.id)) return res.status(404).sendFile(path.join(adminDir, 'not-found.html'));
  return res.sendFile(path.join(adminDir, 'index.html'));
});

app.post('/api/orders', async (req, res) => {
  if (!isValidAdminWhatsApp(process.env.ADMIN_WHATSAPP)) {
    return res.status(503).json({ error: 'Оформление заказа временно недоступно' });
  }
  try {
    const order = await createOrder(req.body);
    const orderUrl = buildOrderUrl(req, order.public_token);
    return res.status(201).json({
      token: order.public_token,
      orderUrl,
      whatsappUrl: buildWhatsAppUrl(process.env.ADMIN_WHATSAPP, order.customer_name, orderUrl),
    });
  } catch (error) {
    if (error instanceof OrderValidationError) return res.status(error.status).json({ error: error.message });
    if (error.code === 'DB_NOT_CONFIGURED') return res.status(503).json({ error: 'Оформление заказа временно недоступно' });
    console.error('SOTT order creation failed:', safeErrorMessage(error));
    return res.status(500).json({ error: 'Не удалось создать заказ. Попробуйте ещё раз' });
  }
});

app.get('/api/orders/:token', async (req, res) => {
  try {
    const order = await getOrderByToken(req.params.token);
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });
    const orderUrl = buildOrderUrl(req, order.token);
    return res.json({
      ...order,
      orderUrl,
      whatsappUrl: process.env.ADMIN_WHATSAPP ? buildWhatsAppUrl(process.env.ADMIN_WHATSAPP, order.customerName, orderUrl) : null,
    });
  } catch (error) {
    console.error('SOTT order lookup failed:', safeErrorMessage(error));
    return res.status(503).json({ error: 'Не удалось загрузить заказ' });
  }
});

app.get('/order/:token', async (req, res) => {
  try {
    const order = await getOrderByToken(req.params.token);
    if (!order) return res.status(404).sendFile(path.join(publicDir, 'order-not-found.html'));
    return res.sendFile(path.join(publicDir, 'order.html'));
  } catch (error) {
    console.error('SOTT order page lookup failed:', safeErrorMessage(error));
    return res.status(503).sendFile(path.join(publicDir, 'order-unavailable.html'));
  }
});

app.get('/order-success', async (req, res) => {
  try {
    const order = await getOrderByToken(String(req.query.token || ''));
    if (!order) return res.status(404).sendFile(path.join(publicDir, 'order-not-found.html'));
    return res.sendFile(path.join(publicDir, 'order-success.html'));
  } catch (error) {
    console.error('SOTT success page lookup failed:', safeErrorMessage(error));
    return res.status(503).sendFile(path.join(publicDir, 'order-unavailable.html'));
  }
});

app.use((error, _req, res, _next) => {
  if (error && (error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE')) {
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Фотография слишком большая' : 'Можно загрузить максимум 8 фотографий' });
  }
  if (error && error.code === 'INVALID_IMAGE_UPLOAD') return res.status(400).json({ error: error.message });
  if (error && (error.type === 'entity.too.large' || error.status === 413)) {
    return res.status(413).json({ error: 'Запрос слишком большой' });
  }
  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({ error: 'Некорректные данные запроса' });
  }
  console.error('SOTT request failed:', safeErrorMessage(error));
  return res.status(500).json({ error: 'Ошибка сервера' });
});

app.use((_req, res) => {
  res.status(404).send('Страница не найдена');
});

function getBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  return configured || `${req.protocol}://${req.get('host')}`;
}

function buildOrderUrl(req, token) {
  return `${getBaseUrl(req)}/order/${encodeURIComponent(token)}`;
}

function buildWhatsAppUrl(adminWhatsApp, customerName, orderUrl) {
  const digits = String(adminWhatsApp || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) throw new Error('ADMIN_WHATSAPP is invalid');
  const message = `Здравствуйте! Я ${customerName}. Оформил заказ в SOTT:\n${orderUrl}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function isValidAdminWhatsApp(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function safeErrorMessage(error) {
  return error && error.code ? `code=${error.code}` : 'unexpected server error';
}

function handleCatalogError(error, res, fallback) {
  if (error instanceof CatalogValidationError) return res.status(error.status).json({ error: error.message });
  if (error && error.code === 'STORAGE_NOT_CONFIGURED') return res.status(503).json({ error: 'Хранилище изображений ещё не настроено' });
  console.error('SOTT catalog mutation failed:', safeErrorMessage(error));
  return res.status(500).json({ error: fallback });
}

function parseAdminOrderId(value) {
  if (typeof value !== 'string' || !/^\d{1,18}$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function startServer() {
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('SOTT database initialization failed:', safeErrorMessage(error));
  }
  return app.listen(port, () => {
    console.log(`SOTT store is running on port ${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, buildOrderUrl, buildWhatsAppUrl };
