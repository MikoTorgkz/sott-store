const express = require('express');
const path = require('path');
const { initializeDatabase } = require('./db');
const { createOrder, getOrderByToken, OrderValidationError } = require('./orders');
const { getDashboard, listOrders, getAdminOrderById, updateOrderStatus } = require('./admin-orders');
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

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
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
