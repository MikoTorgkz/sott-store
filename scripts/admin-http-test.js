const assert = require('assert');
const bcrypt = require('bcryptjs');

process.env.ADMIN_USERNAME = 'http-test-owner';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('http-test-password', 4);
process.env.SESSION_SECRET = 'http-test-session-secret-that-is-longer-than-thirty-two-characters';
delete process.env.NODE_ENV;

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
