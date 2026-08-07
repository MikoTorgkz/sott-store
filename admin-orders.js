const { getPool } = require('./db');
const { ORDER_STATUSES } = require('./orders');

const PAGE_SIZE = 20;

class InventoryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InventoryError';
    this.status = 409;
  }
}

async function getDashboard(pool) {
  const database = pool || getPool();
  const [statsResult, recentResult] = await Promise.all([
    database.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'new')::int AS new_orders,
        COUNT(*)::int AS total_orders,
        COUNT(*) FILTER (
          WHERE (created_at AT TIME ZONE 'Asia/Almaty')::date = (NOW() AT TIME ZONE 'Asia/Almaty')::date
        )::int AS today_orders,
        COALESCE(SUM(total_amount), 0)::bigint AS orders_amount
      FROM orders
    `),
    database.query(`
      SELECT id, public_token, customer_name, city, customer_whatsapp, total_amount, status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 8
    `),
  ]);
  const stats = statsResult.rows[0];
  return {
    stats: {
      newOrders: Number(stats.new_orders || 0),
      totalOrders: Number(stats.total_orders || 0),
      todayOrders: Number(stats.today_orders || 0),
      ordersAmount: Number(stats.orders_amount || 0),
    },
    recentOrders: recentResult.rows.map(mapOrderSummary),
  };
}

async function listOrders(options = {}, pool) {
  const database = pool || getPool();
  const status = ORDER_STATUSES.includes(options.status) ? options.status : null;
  const search = typeof options.search === 'string' ? options.search.trim().slice(0, 100) : '';
  const page = clampPage(options.page);
  const sort = options.sort === 'oldest' ? 'ASC' : 'DESC';
  const conditions = [];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`o.status = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    const index = values.length;
    conditions.push(`(o.customer_name ILIKE $${index} OR o.city ILIKE $${index} OR o.customer_whatsapp ILIKE $${index} OR LEFT(o.public_token, 8) ILIKE $${index})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const result = await database.query(
    `SELECT o.id, o.public_token, o.customer_name, o.city, o.customer_whatsapp,
            o.total_amount, o.status, o.created_at,
            (SELECT COUNT(*)::int FROM order_items i WHERE i.order_id = o.id) AS item_count,
            COUNT(*) OVER()::int AS total_count
       FROM orders o
       ${where}
       ORDER BY o.created_at ${sort}
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
  return {
    orders: result.rows.map(mapOrderSummary),
    pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
  };
}

async function getAdminOrderById(id, pool) {
  const database = pool || getPool();
  const result = await database.query(
    `SELECT o.id, o.public_token, o.customer_name, o.city, o.customer_whatsapp, o.total_amount, o.status, o.created_at,
            i.product_id, i.product_name, i.size, i.quantity, i.unit_price, i.line_total, i.image_path
       FROM orders o
       LEFT JOIN order_items i ON i.order_id = o.id
      WHERE o.id = $1
      ORDER BY i.id ASC`,
    [id],
  );
  if (!result.rows.length) return null;
  const first = result.rows[0];
  return {
    ...mapOrderSummary(first),
    items: result.rows.filter((row) => row.product_id).map((row) => ({
      productId: row.product_id,
      name: row.product_name,
      size: row.size,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      lineTotal: Number(row.line_total),
      image: row.image_path,
    })),
  };
}

async function updateOrderStatus(id, status, pool) {
  if (!ORDER_STATUSES.includes(status)) return { invalidStatus: true };
  const database = pool || getPool();
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query('SELECT id, status, stock_committed FROM orders WHERE id=$1 FOR UPDATE', [id]);
    if (!orderResult.rows[0]) { await client.query('ROLLBACK'); return null; }
    let stockCommitted = orderResult.rows[0].stock_committed === true;
    if ((status === 'confirmed' || status === 'completed') && !stockCommitted) {
      await changeOrderStock(client, id, 'commit');
      stockCommitted = true;
    } else if (status === 'cancelled' && stockCommitted) {
      await changeOrderStock(client, id, 'release');
      stockCommitted = false;
    }
    const updated = await client.query(
      'UPDATE orders SET status=$1, stock_committed=$2 WHERE id=$3 RETURNING id,status,stock_committed',
      [status, stockCommitted, id],
    );
    await client.query('COMMIT');
    return updated.rows[0] || null;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* release below */ }
    throw error;
  } finally {
    client.release();
  }
}

async function changeOrderStock(client, orderId, mode) {
  const itemsResult = await client.query(
    'SELECT product_id, product_name, size, quantity FROM order_items WHERE order_id=$1 ORDER BY product_id ASC, size ASC, id ASC',
    [orderId],
  );
  for (const item of itemsResult.rows) {
    const variantResult = await client.query(
      `SELECT pv.id, pv.stock_quantity, pv.is_active
         FROM product_variants pv JOIN products p ON p.id=pv.product_id
        WHERE (p.id::text=$1 OR p.legacy_id=$1) AND pv.size=$2
        FOR UPDATE OF pv`,
      [item.product_id, item.size],
    );
    const variant = variantResult.rows[0];
    if (!variant) throw new InventoryError(`Размер ${item.size} для «${item.product_name}» больше недоступен`);
    const quantity = Number(item.quantity);
    const stock = Number(variant.stock_quantity);
    if (mode === 'commit') {
      if (!variant.is_active || stock < quantity) throw new InventoryError(`В размере ${item.size} осталось только ${Math.max(0, stock)} шт.`);
      await client.query('UPDATE product_variants SET stock_quantity=stock_quantity-$1 WHERE id=$2', [quantity, variant.id]);
    } else {
      await client.query('UPDATE product_variants SET stock_quantity=stock_quantity+$1 WHERE id=$2', [quantity, variant.id]);
    }
  }
}

function mapOrderSummary(row) {
  return {
    id: Number(row.id),
    code: String(row.public_token || '').slice(0, 8).toUpperCase(),
    token: row.public_token,
    customerName: row.customer_name,
    city: row.city,
    whatsapp: row.customer_whatsapp,
    total: Number(row.total_amount),
    status: row.status,
    createdAt: row.created_at,
    itemCount: row.item_count === undefined ? undefined : Number(row.item_count),
  };
}

function clampPage(value) {
  const page = Number.parseInt(value, 10);
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, 100000);
}

module.exports = { PAGE_SIZE, InventoryError, getDashboard, listOrders, getAdminOrderById, updateOrderStatus, changeOrderStock };
