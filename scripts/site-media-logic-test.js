const assert = require('assert');
const { SITE_MEDIA, isSiteMediaKey, listSiteMedia, defaultSiteMedia, setSiteMedia, resetSiteMedia, publicSiteMedia } = require('../site-media');

(async () => {
  assert.deepStrictEqual(Object.keys(SITE_MEDIA), ['brand_logo','hero_main','hero_season','category_shirts','category_trousers','category_outerwear','category_shoes','category_accessories']);
  assert.equal(isSiteMediaKey('hero_main'), true);
  assert.equal(isSiteMediaKey('../../server.js'), false);
  assert.equal(defaultSiteMedia().find((item) => item.key === 'hero_main').imageUrl, '/assets/hero-fashion.svg');

  const calls = [];
  const pool = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT key')) return { rows: [{ key: 'hero_main', image_url: '/uploads/site-media/a.jpg', updated_at: new Date('2026-08-08T00:00:00Z') }] };
    if (sql.startsWith('INSERT INTO')) return { rows: [{ key: params[0], image_url: params[1], updated_at: new Date() }] };
    if (sql.startsWith('DELETE FROM')) return { rows: [{ image_url: '/uploads/site-media/a.jpg' }] };
    return { rows: [] };
  } };
  const items = await listSiteMedia(pool);
  assert.equal(items.length, 8);
  assert.equal(items.find((item) => item.key === 'hero_main').custom, true);
  assert.equal(items.find((item) => item.key === 'brand_logo').custom, false);
  const publicMedia = publicSiteMedia(items);
  assert.match(publicMedia.hero_main, /^\/uploads\/site-media\/a\.jpg\?v=\d+$/);
  assert.equal(publicMedia.brand_logo, '/assets/sott-logo.jpg');
  await setSiteMedia('brand_logo', '/uploads/site-media/b.webp', pool);
  await resetSiteMedia('brand_logo', pool);
  assert.deepStrictEqual(calls.find((call) => call.sql.startsWith('INSERT INTO')).params, ['brand_logo', '/uploads/site-media/b.webp']);
  assert.deepStrictEqual(calls.find((call) => call.sql.startsWith('DELETE FROM')).params, ['brand_logo']);
  assert.equal(await setSiteMedia('not_allowed', '/tmp/secret', pool), null);
  console.log('Site media logic passed: allowlist, defaults, parameterized persistence and cache-busted public URLs verified.');
})().catch((error) => { console.error(error); process.exit(1); });
