const assert = require('assert');
const bcrypt = require('bcryptjs');

process.env.ADMIN_USERNAME = 'http-test-owner';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('http-test-password', 4);
process.env.SESSION_SECRET = 'http-test-session-secret-that-is-longer-than-thirty-two-characters';
delete process.env.NODE_ENV;
delete process.env.UPLOADS_DIR;
delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
delete process.env.PRODUCT_STORAGE;

const { app } = require('../server');

async function run() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    let response = await fetch(`${base}/admin`, { redirect: 'manual' });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/admin/login');

    response = await fetch(`${base}/api/admin/orders`);
    assert.equal(response.status, 401);
    response = await fetch(`${base}/admin/products`, { redirect: 'manual' });
    assert.equal(response.status, 302, 'product admin page must require a session');
    response = await fetch(`${base}/api/admin/products`);
    assert.equal(response.status, 401, 'product admin API must require a session');
    response = await fetch(`${base}/api/admin/products/1/images`, { method: 'POST' });
    assert.equal(response.status, 401, 'product image upload must require a session before multipart parsing');
    response = await fetch(`${base}/api/admin/site-media/hero_main/image`, { method: 'POST' });
    assert.equal(response.status, 401, 'site media upload must require admin session');
    response = await fetch(`${base}/api/admin/site-media/hero_main/image`, { method: 'DELETE' });
    assert.equal(response.status, 401, 'site media reset must require admin session');

    response = await fetch(`${base}/api/site-media`);
    assert.equal(response.status, 200, 'public site media must keep default assets available without database');
    const publicMedia = (await response.json()).media;
    assert.equal(publicMedia.hero_main, '/assets/hero-fashion.svg');
    assert.equal(JSON.stringify(publicMedia).includes('UPLOADS_DIR'), false);
    assert.equal(JSON.stringify(publicMedia).includes('/mnt/'), false);

    response = await fetch(`${base}/admin/login`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /type="password"/);

    response = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ username: 'http-test-owner', password: 'wrong' }),
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'Неверный логин или пароль');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      response = await fetch(`${base}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base, 'X-Forwarded-For': '198.51.100.25' },
        body: JSON.stringify({ username: 'http-test-owner', password: 'wrong' }),
      });
      assert.equal(response.status, 401);
    }
    response = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, 'X-Forwarded-For': '198.51.100.25' },
      body: JSON.stringify({ username: 'http-test-owner', password: 'wrong' }),
    });
    assert.equal(response.status, 429);
    assert.ok(response.headers.get('retry-after'));

    response = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base },
      body: JSON.stringify({ username: 'http-test-owner', password: 'http-test-password' }),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(response.headers.get('set-cookie'), /SameSite=Strict/);
    const login = await response.json();
    assert.ok(login.csrfToken);

    response = await fetch(`${base}/admin`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Управление магазином/);

    response = await fetch(`${base}/api/admin/session`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).authenticated, true);

    response = await fetch(`${base}/admin/products`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /data-nav="products"/);
    response = await fetch(`${base}/admin/products/new`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200, 'new product page must open for an authenticated admin');
    assert.match(response.headers.get('content-security-policy') || '', /img-src 'self' blob:/, 'admin CSP must allow blob previews for selected local images');

    response = await fetch(`${base}/admin/media`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200, 'site media page must open for authenticated admin');
    assert.match(await response.text(), /data-nav="media"/);

    response = await fetch(`${base}/api/admin/site-media`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200, 'site media admin view must retain defaults if database is unavailable');
    assert.equal((await response.json()).media.length, 8);

    response = await fetch(`${base}/api/admin/site-media/hero_main/image`, {
      method: 'POST', headers: { Cookie: cookie, Origin: base, 'X-CSRF-Token': login.csrfToken },
    });
    assert.equal(response.status, 503, 'site media upload must clearly report missing persistent storage');
    assert.equal((await response.json()).error, 'Хранилище фотографий не настроено');

    response = await fetch(`${base}/api/admin/site-media/hero_main/image`, { method: 'DELETE', headers: { Cookie: cookie, Origin: base } });
    assert.equal(response.status, 403, 'site media reset must require CSRF token');

    response = await fetch(`${base}/api/admin/site-media/not-allowed/image`, { method: 'DELETE', headers: { Cookie: cookie, Origin: base, 'X-CSRF-Token': login.csrfToken } });
    assert.equal(response.status, 404, 'arbitrary site media keys must be rejected');

    response = await fetch(`${base}/api/admin/products/1/images`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: base, 'X-CSRF-Token': login.csrfToken },
    });
    assert.equal(response.status, 503, 'configured admin without persistent storage must get a clear upload error');
    assert.equal((await response.json()).error, 'Хранилище фотографий не настроено');

    response = await fetch(`${base}/api/admin/products`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken }, body: '{}',
    });
    assert.equal(response.status, 403, 'product mutations without Origin must fail CSRF protection');

    response = await fetch(`${base}/api/admin/orders/1/status`, {
      method: 'PATCH',
      headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken },
      body: JSON.stringify({ status: 'hacked' }),
    });
    assert.equal(response.status, 403, 'state change without Origin must fail CSRF protection');

    response = await fetch(`${base}/api/admin/orders/1/status`, {
      method: 'PATCH',
      headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json', 'X-CSRF-Token': login.csrfToken },
      body: JSON.stringify({ status: 'hacked' }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Недопустимый статус заказа');

    response = await fetch(`${base}/api/admin/logout`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: base, 'X-CSRF-Token': login.csrfToken },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /Max-Age=0/);

    response = await fetch(`${base}/admin`, { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(response.status, 302, 'destroyed session cookie must not authorize after logout');

    console.log('Admin HTTP passed: protected routes, generic bad-login error, HTTP rate limit, cookie session persistence, CSRF/origin, status rejection and logout verified.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
