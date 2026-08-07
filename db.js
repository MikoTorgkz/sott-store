const { Pool } = require('pg');

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
