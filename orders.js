const crypto = require('crypto');
const catalog = require('./public/js/products.js');
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
    if (!item || typeof item.productId !== 'string') throw new OrderValidationError('Один из товаров не найден');
    const product = catalog.getProductById(item.productId);
    if (!product) throw new OrderValidationError('Один из товаров не найден');
    if (typeof item.size !== 'string') throw new OrderValidationError('Выбранный размер недоступен');
    const size = product.sizes.find((entry) => entry.label === item.size);
    if (!size || !size.available) throw new OrderValidationError('Выбранный размер недоступен');
    if (typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      throw new OrderValidationError('Некорректное количество товара');
    }
    return {
      productId: product.id,
      name: product.name,
      size: size.label,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal: product.price * item.quantity,
      image: product.images[0],
    };
  });
}

function validateOrderInput(body = {}) {
  const customerName = cleanText(body.name, 'Введите имя');
  const city = cleanText(body.city, 'Введите город');
  const whatsapp = normalizeWhatsApp(body.whatsapp);
  const items = validateItems(body.items);
  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return { customerName, city, whatsapp, items, total };
}

async function createOrder(body, pool) {
  const order = validateOrderInput(body);
  const token = crypto.randomBytes(24).toString('base64url');
  const database = pool || getPool();
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO orders (public_token, customer_name, city, customer_whatsapp, total_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, public_token, customer_name, city, customer_whatsapp, total_amount, status, created_at`,
      [token, order.customerName, order.city, order.whatsapp, order.total, 'new'],
    );
    const savedOrder = inserted.rows[0];
    for (const item of order.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, size, quantity, unit_price, line_total, image_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [savedOrder.id, item.productId, item.name, item.size, item.quantity, item.unitPrice, item.lineTotal, item.image],
      );
    }
    await client.query('COMMIT');
    return { ...savedOrder, items: order.items };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* connection will be released */ }
    throw error;
  } finally {
    client.release();
  }
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

module.exports = { ORDER_STATUSES, OrderValidationError, normalizeWhatsApp, validateOrderInput, createOrder, getOrderByToken };
