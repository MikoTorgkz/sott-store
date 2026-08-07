const { Pool } = require('pg');
const { seedCatalog } = require('./catalog-seed');

const databaseUrl = process.env.DATABASE_URL;
const sslRequired = databaseUrl && /(?:[?&]sslmode=require(?:&|$))/i.test(databaseUrl);

const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: sslRequired ? { rejectUnauthorized: false } : false,
  max: 5,
}) : null;

async function initializeDatabase() {
  if (!pool) {
    console.warn('SOTT database is not configured: DATABASE_URL is missing');
    return false;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      public_token VARCHAR(128) UNIQUE NOT NULL,
      customer_name VARCHAR(100) NOT NULL,
      city VARCHAR(100) NOT NULL,
      customer_whatsapp VARCHAR(20) NOT NULL,
      total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
      status VARCHAR(20) NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id VARCHAR(64) NOT NULL,
      product_name VARCHAR(200) NOT NULL,
      size VARCHAR(20) NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      line_total INTEGER NOT NULL CHECK (line_total >= 0),
      image_path TEXT NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      legacy_id VARCHAR(64) UNIQUE,
      slug VARCHAR(160) UNIQUE NOT NULL,
      name VARCHAR(200) NOT NULL,
      category_id BIGINT NOT NULL REFERENCES categories(id),
      price INTEGER NOT NULL CHECK (price > 0),
      short_description VARCHAR(500) NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      is_published BOOLEAN NOT NULL DEFAULT FALSE,
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      is_new BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size VARCHAR(40) NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (product_id, size)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_images (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (product_id, image_url)
    )
  `);
  await pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_committed BOOLEAN NOT NULL DEFAULT FALSE');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_products_published_updated ON products (is_published, updated_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_products_price ON products (price)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_product_variants_available_size ON product_variants (size, product_id) WHERE is_active = TRUE AND stock_quantity > 0');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants (product_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images (product_id, sort_order)');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_one_primary ON product_images (product_id) WHERE is_primary');
  await seedCatalog(pool);
  return true;
}

function getPool() {
  if (!pool) {
    const error = new Error('Database is not configured');
    error.code = 'DB_NOT_CONFIGURED';
    throw error;
  }
  return pool;
}

module.exports = { getPool, initializeDatabase };
