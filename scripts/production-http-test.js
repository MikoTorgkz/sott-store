const assert = require('assert');

delete process.env.DATABASE_URL;
delete process.env.ADMIN_WHATSAPP;
process.env.PUBLIC_BASE_URL = 'https://shop.example';

const { app } = require('../server');

async function run() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let response = await fetch(`${base}/`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    const home = await response.text();
    assert.match(home, /<link rel="canonical" href="https:\/\/shop\.example\/">/);
    assert.match(home, /property="og:title"/);
    assert.match(home, /application\/ld\+json/);

    response = await fetch(`${base}/robots.txt`);
    assert.equal(response.status, 200);
    const robots = await response.text();
    assert.match(robots, /Disallow: \/admin/);
    assert.match(robots, /Disallow: \/order\//);
    assert.match(robots, /Sitemap: https:\/\/shop\.example\/sitemap\.xml/);

    response = await fetch(`${base}/health`);
    assert.equal(response.status, 503);
    assert.deepStrictEqual(await response.json(), { status: 'degraded', database: 'unavailable' });

    response = await fetch(`${base}/definitely-missing-page`);
    assert.equal(response.status, 404);
    assert.match(await response.text(), /Страница не найдена/);

    response = await fetch(`${base}/api/definitely-missing`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'Ресурс не найден');

    response = await fetch(`${base}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'Оформление заказа временно недоступно');

    console.log('Production HTTP passed: security headers, SEO shell, robots, degraded health, safe checkout unavailable and styled 404 verified.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => { console.error(error); process.exit(1); });
