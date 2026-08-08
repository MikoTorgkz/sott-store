const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { getPool, initializeDatabase } = require('./db');
const { createOrder, getOrderByToken, OrderValidationError } = require('./orders');
const { getDashboard, listOrders, getAdminOrderById, updateOrderStatus, InventoryError } = require('./admin-orders');
const {
  CatalogValidationError, searchPublicProducts, listPublicSizes, listPublicProductSlugs, getPublicProductBySlug, listCategories,
  listAdminProducts, getAdminProductById, createProduct, updateProduct, setProductPublished,
  addProductImages, setPrimaryImage, deleteProductImage,
} = require('./catalog');
const { uploadProductImages, uploadSiteMediaImage, validateUploadedImage } = require('./product-upload');
const { getStorageStatus, getUploadDirectory, getSiteMediaDirectory, saveImage, saveSiteMediaImage, removeImage, removeSiteMediaImage } = require('./product-storage');
const { isSiteMediaKey, listSiteMedia, defaultSiteMedia, setSiteMedia, resetSiteMedia, publicSiteMedia } = require('./site-media');
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
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'");
  next();
});
const persistentUploadDir = getUploadDirectory();
if (persistentUploadDir) {
  app.use('/uploads/products', express.static(persistentUploadDir, {
    fallthrough: false,
    dotfiles: 'deny',
    index: false,
    maxAge: '7d',
    setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); },
  }));
}
const persistentSiteMediaDir = getSiteMediaDirectory();
if (persistentSiteMediaDir) {
  app.use('/uploads/site-media', express.static(persistentSiteMediaDir, {
    fallthrough: false,
    dotfiles: 'deny',
    index: false,
    maxAge: '7d',
    setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); },
  }));
}
app.get('/', async (req, res, next) => {
  try {
    return res.send(await renderHtml('index.html', publicHeadMeta(req, {
      title: 'SOTT — мужская одежда',
      description: 'Мужская одежда SOTT: рубашки, брюки, верхняя одежда, обувь и аксессуары.',
      canonicalPath: '/',
      image: '/assets/sott-logo.jpg',
    })));
  } catch (error) { return next(error); }
});

app.get('/product/:slug', async (req, res, next) => {
  try {
    const product = await getPublicProductBySlug(req.params.slug);
    if (!product) return res.status(404).sendFile(path.join(publicDir, 'not-found.html'));
    const description = plainMetaText(product.shortDescription || product.description || product.name, 180);
    const image = product.images && product.images[0] ? product.images[0] : '/assets/product-placeholder.svg';
    const meta = publicHeadMeta(req, {
      title: `${plainMetaText(product.name, 90)} — SOTT`, description,
      canonicalPath: `/product/${encodeURIComponent(product.slug)}`, image,
    });
    const structured = `<script type="application/ld+json">${safeJsonLd({ '@context': 'https://schema.org', '@type': 'Product', name: product.name, image: [absoluteUrl(req, image)], description, offers: { '@type': 'Offer', priceCurrency: 'KZT', price: product.price, availability: product.sizes.some((size) => size.available) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: absoluteUrl(req, `/product/${encodeURIComponent(product.slug)}`) } })}</script>`;
    return res.send(await renderHtml('product.html', `${meta}\n${structured}`));
  } catch (error) {
    console.error('SOTT product page failed:', safeErrorMessage(error));
    if (error && error.code === 'DB_NOT_CONFIGURED') return res.status(503).sendFile(path.join(publicDir, 'error.html'));
    return next(error);
  }
});

app.get('/cart', (_req, res) => {
  res.sendFile(path.join(publicDir, 'cart.html'));
});

app.get('/catalog', async (req, res, next) => {
  try {
    return res.send(await renderHtml('catalog.html', publicHeadMeta(req, {
      title: 'Мужская одежда SOTT — каталог',
      description: 'Каталог мужской одежды SOTT: рубашки, брюки, верхняя одежда, обувь и аксессуары.',
      canonicalPath: '/catalog', image: '/assets/sott-logo.jpg',
    })));
  } catch (error) { return next(error); }
});
app.get('/favorites', (_req, res) => res.sendFile(path.join(publicDir, 'favorites.html')));

app.use(express.static(publicDir, {
  index: false,
  maxAge: 0,
  etag: true,
  setHeaders(res, filePath) {
    if (/\.(?:html|css|js)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  },
}));

app.get('/health', async (_req, res) => {
  try {
    await getPool().query('SELECT 1');
    return res.json({ status: 'ok', database: 'ok' });
  } catch (error) {
    console.error('SOTT health database check failed:', safeErrorMessage(error));
    return res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /order/\nDisallow: /order-success\nDisallow: /api/\nSitemap: ${absoluteUrl(req, '/sitemap.xml')}\n`);
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const products = await listPublicProductSlugs();
    const urls = [
      { path: '/', changed: null }, { path: '/catalog', changed: null },
      ...products.map((product) => ({ path: `/product/${encodeURIComponent(product.slug)}`, changed: product.updatedAt })),
    ];
    const body = urls.map((item) => `<url><loc>${escapeXml(absoluteUrl(req, item.path))}</loc>${item.changed ? `<lastmod>${new Date(item.changed).toISOString()}</lastmod>` : ''}</url>`).join('');
    return res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
  } catch (error) {
    console.error('SOTT sitemap failed:', safeErrorMessage(error));
    return res.status(503).type('text/plain').send('Sitemap temporarily unavailable');
  }
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

app.get('/api/site-media', async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache');
    return res.json({ media: publicSiteMedia(await listSiteMedia()) });
  } catch (error) {
    console.error('SOTT public site media fallback:', safeErrorMessage(error));
    return res.json({ media: publicSiteMedia(defaultSiteMedia()) });
  }
});

app.use(['/admin', '/admin/*splat'], (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
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

app.get('/api/admin/site-media', requireAdminApi, async (_req, res) => {
  try {
    return res.json({ media: await listSiteMedia(), storage: getStorageStatus(), databaseAvailable: true });
  } catch (error) {
    console.error('SOTT admin site media failed:', safeErrorMessage(error));
    return res.json({ media: defaultSiteMedia(), storage: getStorageStatus(), databaseAvailable: false });
  }
});

app.post('/api/admin/site-media/:key/image', requireAdminApi, requireCsrf, requireSiteMediaKey, requireProductStorage, uploadSiteMediaImage, async (req, res) => {
  const key = String(req.params.key || '');
  if (!req.file) return res.status(400).json({ error: 'Выберите изображение' });
  let format;
  try { format = validateUploadedImage(req.file); } catch (error) { return res.status(400).json({ error: error.message || 'Не удалось загрузить фотографию' }); }
  let previous = null;
  let uploadedUrl = null;
  let persisted = false;
  try {
    previous = (await listSiteMedia()).find((item) => item.key === key) || null;
    uploadedUrl = await saveSiteMediaImage(req.file.buffer, format);
    const saved = await setSiteMedia(key, uploadedUrl);
    if (!saved) throw new Error('invalid media key');
    persisted = true;
    if (previous && previous.custom) {
      await removeSiteMediaImage(previous.imageUrl).catch((error) => {
        console.error('SOTT old site media cleanup failed:', safeErrorMessage(error));
      });
    }
    return res.status(201).json({ ok: true });
  } catch (error) {
    if (uploadedUrl && !persisted) await removeSiteMediaImage(uploadedUrl).catch(() => {});
    return handleCatalogError(error, res, 'Не удалось загрузить фотографию');
  }
});

app.delete('/api/admin/site-media/:key/image', requireAdminApi, requireCsrf, requireSiteMediaKey, async (req, res) => {
  const key = String(req.params.key || '');
  try {
    const previous = (await listSiteMedia()).find((item) => item.key === key) || null;
    await resetSiteMedia(key);
    if (previous && previous.custom) {
      await removeSiteMediaImage(previous.imageUrl).catch((error) => {
        console.error('SOTT reset site media cleanup failed:', safeErrorMessage(error));
      });
    }
    return res.json({ ok: true });
  } catch (error) {
    return handleCatalogError(error, res, 'Не удалось вернуть стандартное изображение');
  }
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

app.post('/api/admin/products/:id/images', requireAdminApi, requireCsrf, requireProductStorage, uploadProductImages, async (req, res) => {
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
app.get('/admin/media', requireAdminPage, (_req, res) => res.sendFile(path.join(adminDir, 'index.html')));

app.post('/api/orders', async (req, res) => {
  if (!isValidAdminWhatsApp(process.env.ADMIN_WHATSAPP)) {
    console.error('SOTT checkout unavailable: admin WhatsApp configuration is missing or invalid');
    return res.status(503).json({ error: 'Оформление заказа временно недоступно' });
  }
  try {
    const order = await createOrder(req.body);
    const orderUrl = buildOrderUrl(req, order.public_token);
    return res.status(order.duplicate ? 200 : 201).json({
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
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
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
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
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
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Файл слишком большой' : 'Можно загрузить не более 8 фотографий' });
  }
  if (error && error.code === 'INVALID_IMAGE_UPLOAD') return res.status(400).json({ error: error.message });
  if (error && (error.type === 'entity.too.large' || error.status === 413)) {
    return res.status(413).json({ error: 'Запрос слишком большой' });
  }
  if (error instanceof SyntaxError && error.status === 400) {
    return res.status(400).json({ error: 'Некорректные данные запроса' });
  }
  console.error('SOTT request failed:', safeErrorMessage(error));
  if (_req.path.startsWith('/api/')) return res.status(500).json({ error: 'Ошибка сервера' });
  return res.status(500).sendFile(path.join(publicDir, 'error.html'));
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Ресурс не найден' });
  return res.status(404).sendFile(path.join(publicDir, 'not-found.html'));
});

async function renderHtml(fileName, headMarkup) {
  const template = await fs.readFile(path.join(publicDir, fileName), 'utf8');
  const cleaned = template.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<meta\s+name=["']description["'][^>]*>/i, '');
  return cleaned.replace('</head>', `${headMarkup}\n</head>`);
}

function publicHeadMeta(req, { title, description, canonicalPath, image }) {
  const canonical = absoluteUrl(req, canonicalPath);
  const imageUrl = absoluteUrl(req, image);
  const organization = safeJsonLd({ '@context': 'https://schema.org', '@type': 'Organization', name: 'SOTT', url: absoluteUrl(req, '/'), logo: absoluteUrl(req, '/assets/sott-logo.jpg') });
  return `<title>${escapeHtmlAttribute(title)}</title>\n<meta name="description" content="${escapeHtmlAttribute(description)}">\n<link rel="canonical" href="${escapeHtmlAttribute(canonical)}">\n<link rel="icon" type="image/jpeg" href="/assets/sott-logo.jpg">\n<meta property="og:type" content="website">\n<meta property="og:title" content="${escapeHtmlAttribute(title)}">\n<meta property="og:description" content="${escapeHtmlAttribute(description)}">\n<meta property="og:image" content="${escapeHtmlAttribute(imageUrl)}">\n<meta property="og:url" content="${escapeHtmlAttribute(canonical)}">\n<script type="application/ld+json">${organization}</script>`;
}

function plainMetaText(value, limit) {
  return String(value || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeHtmlAttribute(value) {
  return String(value).replace(/[&"<>]/g, (char) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[char]));
}

function escapeXml(value) {
  return String(value).replace(/[&'"<>]/g, (char) => ({ '&': '&amp;', "'": '&apos;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[char]));
}

function absoluteUrl(req, relativePath) {
  if (/^https?:\/\//i.test(String(relativePath))) return String(relativePath);
  return `${getBaseUrl(req)}${String(relativePath).startsWith('/') ? relativePath : `/${relativePath}`}`;
}

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
  if (error && error.code === 'STORAGE_NOT_CONFIGURED') return res.status(503).json({ error: 'Хранилище фотографий не настроено' });
  console.error('SOTT catalog mutation failed:', safeErrorMessage(error));
  return res.status(500).json({ error: fallback });
}

function requireProductStorage(_req, res, next) {
  const storage = getStorageStatus();
  if (!storage.configured) return res.status(503).json({ error: 'Хранилище фотографий не настроено' });
  return next();
}

function requireSiteMediaKey(req, res, next) {
  if (!isSiteMediaKey(String(req.params.key || ''))) return res.status(404).json({ error: 'Медиа-позиция не найдена' });
  return next();
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
