const crypto = require('crypto');
const { getPool } = require('./db');

const MAX_ITEMS = 50;
const ORDER_STATUSES = Object.freeze(['new', 'confirmed', 'completed', 'cancelled']);

class OrderValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'OrderValidationError';
    this.status = status;
  }
}

function cleanText(value, emptyMessage) {
  if (typeof value !== 'string' || !value.trim()) throw new OrderValidationError(emptyMessage);
  const result = value.trim().replace(/\s+/g, ' ');
  if (result.length > 100) throw new OrderValidationError(`${emptyMessage.replace(/^Введите /, '')}: слишком длинное значение`);
  return result;
}

function normalizeWhatsApp(value) {
  if (typeof value !== 'string') throw new OrderValidationError('Укажите корректный WhatsApp');
  const digits = value.replace(/\D/g, '');
  let normalized = digits;
  if (digits.length === 11 && digits.startsWith('8')) normalized = `7${digits.slice(1)}`;
  if (normalized.length !== 11 || !normalized.startsWith('7')) {
    throw new OrderValidationError('Укажите корректный WhatsApp');
  }
  return `+${normalized}`;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new OrderValidationError('Корзина пуста');
  if (items.length > MAX_ITEMS) throw new OrderValidationError('Слишком много позиций в корзине');

  return items.map((item) => {
    if (!item || (typeof item.productId !== 'string' && typeof item.productId !== 'number')) throw new OrderValidationError('Один из товаров не найден');
    const productId = String(item.productId).trim();
    if (!productId || productId.length > 64) throw new OrderValidationError('Один из товаров не найден');
    if (typeof item.size !== 'string') throw new OrderValidationError('Выбранный размер недоступен');
    const size = item.size.trim();
    if (!size || size.length > 40) throw new OrderValidationError('Выбранный размер недоступен');
    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      throw new OrderValidationError('Некорректное количество товара');
    }
    return { productId, size, quantity: item.quantity };
  });
}

function validateOrderInput(body = {}) {
  const customerName = cleanText(body.name, 'Введите имя');
  const city = cleanText(body.city, 'Введите город');
  const whatsapp = normalizeWhatsApp(body.whatsapp);
  const items = validateItems(body.items);
  const requestId = validateRequestId(body.requestId);
  return { customerName, city, whatsapp, items, requestId };
}

function validateRequestId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(value)) throw new OrderValidationError('Некорректный идентификатор запроса');
  return value;
}

async function createOrder(body, pool) {
  const request = validateOrderInput(body);
  const token = crypto.randomBytes(24).toString('base64url');
  const database = pool || getPool();
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const items = await hydrateOrderItems(client, request.items);
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const inserted = await client.query(
      `INSERT INTO orders (public_token, customer_name, city, customer_whatsapp, total_amount, status, client_request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, public_token, customer_name, city, customer_whatsapp, total_amount, status, created_at`,
      [token, request.customerName, request.city, request.whatsapp, total, 'new', request.requestId],
    );
    const savedOrder = inserted.rows[0];
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, size, quantity, unit_price, line_total, image_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [savedOrder.id, item.productId, item.name, item.size, item.quantity, item.unitPrice, item.lineTotal, item.image],
      );
    }
    await client.query('COMMIT');
    return { ...savedOrder, items };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* connection will be released */ }
    if (request.requestId && error && error.code === '23505' && error.constraint === 'idx_orders_client_request_id') {
      const existing = await getOrderByRequestId(request.requestId, database);
      if (existing) return { ...existing, public_token: existing.token, duplicate: true };
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getOrderByRequestId(requestId, pool) {
  const database = pool || getPool();
  const result = await database.query('SELECT public_token FROM orders WHERE client_request_id = $1 LIMIT 1', [requestId]);
  return result.rows[0] ? getOrderByToken(result.rows[0].public_token, database) : null;
}

async function hydrateOrderItems(client, requestedItems) {
  const items = [];
  for (const requested of requestedItems) {
    const result = await client.query(
      `SELECT p.id, p.name, p.price, p.is_published,
              pv.size, pv.stock_quantity, pv.is_active,
              COALESCE((SELECT pi.image_url FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC LIMIT 1), '/assets/product-placeholder.svg') AS image_url
         FROM products p
         LEFT JOIN product_variants pv ON pv.product_id=p.id AND pv.size=$2
        WHERE (p.id::text=$1 OR p.legacy_id=$1)
        LIMIT 1`,
      [requested.productId, requested.size],
    );
    const product = result.rows[0];
    if (!product || !product.is_published) throw new OrderValidationError('Один из товаров не найден');
    if (!product.size || !product.is_active) throw new OrderValidationError('Выбранный размер недоступен');
    const stock = Number(product.stock_quantity);
    if (stock <= 0) throw new OrderValidationError(`Размер ${requested.size} закончился`);
    if (requested.quantity > stock) throw new OrderValidationError(`В размере ${requested.size} осталось только ${stock} шт.`);
    items.push({
      productId: String(product.id),
      name: product.name,
      size: product.size,
      quantity: requested.quantity,
      unitPrice: Number(product.price),
      lineTotal: Number(product.price) * requested.quantity,
      image: product.image_url,
    });
  }
  return items;
}

async function getOrderByToken(token, pool) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const database = pool || getPool();
  const result = await database.query(
    `SELECT o.id, o.public_token, o.customer_name, o.city, o.customer_whatsapp, o.total_amount, o.status, o.created_at,
            i.product_id, i.product_name, i.size, i.quantity, i.unit_price, i.line_total, i.image_path
       FROM orders o
       LEFT JOIN order_items i ON i.order_id = o.id
      WHERE o.public_token = $1
      ORDER BY i.id ASC`,
    [token],
  );
  if (!result.rows.length) return null;
  const first = result.rows[0];
  return {
    token: first.public_token,
    customerName: first.customer_name,
    city: first.city,
    whatsapp: first.customer_whatsapp,
    total: first.total_amount,
    status: first.status,
    createdAt: first.created_at,
    items: result.rows.filter((row) => row.product_id).map((row) => ({
      productId: row.product_id,
      name: row.product_name,
      size: row.size,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      lineTotal: row.line_total,
      image: row.image_path,
    })),
  };
}

module.exports = { ORDER_STATUSES, OrderValidationError, normalizeWhatsApp, validateOrderInput, hydrateOrderItems, createOrder, getOrderByToken };
