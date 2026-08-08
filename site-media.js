const { getPool } = require('./db');

const SITE_MEDIA = Object.freeze({
  brand_logo: { label: 'Логотип SOTT', usage: 'Header, footer и клиентские страницы', defaultUrl: '/assets/sott-logo.jpg' },
  hero_main: { label: 'Баннер №1 — Стиль для современных мужчин', usage: 'Главный экран', defaultUrl: '/assets/hero-fashion.svg' },
  hero_season: { label: 'Баннер №2 — Новинки сезона', usage: 'Главный экран', defaultUrl: '/assets/season-fashion.svg' },
  category_shirts: { label: 'Рубашки', usage: 'Категории на главной', defaultUrl: '/assets/categories/shirts.svg' },
  category_trousers: { label: 'Брюки', usage: 'Категории на главной', defaultUrl: '/assets/categories/trousers.svg' },
  category_outerwear: { label: 'Верхняя одежда', usage: 'Категории на главной', defaultUrl: '/assets/categories/outerwear.svg' },
  category_shoes: { label: 'Обувь', usage: 'Категории на главной', defaultUrl: '/assets/categories/shoes.svg' },
  category_accessories: { label: 'Аксессуары', usage: 'Категории на главной', defaultUrl: '/assets/categories/accessories.svg' },
});

function isSiteMediaKey(key) { return Object.prototype.hasOwnProperty.call(SITE_MEDIA, key); }

async function listSiteMedia(pool) {
  const database = pool || getPool();
  const result = await database.query('SELECT key, image_url, updated_at FROM site_media WHERE key = ANY($1::text[])', [Object.keys(SITE_MEDIA)]);
  const saved = new Map(result.rows.map((row) => [row.key, row]));
  return Object.entries(SITE_MEDIA).map(([key, config]) => {
    const row = saved.get(key);
    return {
      key,
      label: config.label,
      usage: config.usage,
      defaultUrl: config.defaultUrl,
      imageUrl: row ? row.image_url : config.defaultUrl,
      custom: Boolean(row),
      updatedAt: row ? row.updated_at : null,
    };
  });
}

function defaultSiteMedia() {
  return Object.entries(SITE_MEDIA).map(([key, config]) => ({ key, ...config, imageUrl: config.defaultUrl, custom: false, updatedAt: null }));
}

async function setSiteMedia(key, imageUrl, pool) {
  if (!isSiteMediaKey(key)) return null;
  const database = pool || getPool();
  const result = await database.query(
    `INSERT INTO site_media (key, image_url, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET image_url = EXCLUDED.image_url, updated_at = NOW()
     RETURNING key, image_url, updated_at`,
    [key, imageUrl],
  );
  return result.rows[0] || null;
}

async function resetSiteMedia(key, pool) {
  if (!isSiteMediaKey(key)) return null;
  const database = pool || getPool();
  const result = await database.query('DELETE FROM site_media WHERE key = $1 RETURNING image_url', [key]);
  return result.rows[0] || { image_url: null };
}

function publicSiteMedia(items) {
  return Object.fromEntries(items.map((item) => {
    const version = item.custom && item.updatedAt ? new Date(item.updatedAt).getTime() : null;
    return [item.key, version ? `${item.imageUrl}?v=${version}` : item.imageUrl];
  }));
}

module.exports = { SITE_MEDIA, isSiteMediaKey, listSiteMedia, defaultSiteMedia, setSiteMedia, resetSiteMedia, publicSiteMedia };
