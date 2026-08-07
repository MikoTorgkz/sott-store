const express = require('express');
const path = require('path');
const { initializeDatabase } = require('./db');
const { createOrder, getOrderByToken, OrderValidationError } = require('./orders');

const app = express();
const port = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

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
