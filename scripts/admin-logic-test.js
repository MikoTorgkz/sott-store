const assert = require('assert');
const bcrypt = require('bcryptjs');

process.env.ADMIN_USERNAME = 'stage4-owner';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('stage4-test-password', 4);
process.env.SESSION_SECRET = 'stage4-test-session-secret-that-is-longer-than-thirty-two-characters';

const auth = require('../admin-auth');
const { listOrders, getAdminOrderById, updateOrderStatus } = require('../admin-orders');

async function run() {
  assert.equal(auth.isAdminConfigured(), true);
  assert.equal(await auth.verifyCredentials('stage4-owner', 'stage4-test-password'), true);
  assert.equal(await auth.verifyCredentials('stage4-owner', 'wrong-password'), false);
  assert.equal(await auth.verifyCredentials('wrong-user', 'stage4-test-password'), false);

  const session = auth.createSession();
  const request = { headers: { cookie: `sott_admin_session=${session.value}` } };
  assert.equal(auth.readSession(request).csrf, session.payload.csrf);
  auth.destroySession(request);
  assert.equal(auth.readSession(request), null, 'logout must invalidate the server-side session');

  const ip = `test-${Date.now()}`;
  for (let attempt = 0; attempt < auth.LOGIN_MAX_ATTEMPTS; attempt += 1) {
    assert.equal(auth.checkLoginRateLimit(ip).allowed, true);
    auth.recordLoginFailure(ip);
  }
  assert.equal(auth.checkLoginRateLimit(ip).allowed, false, 'login rate limit must stop brute force attempts');
  auth.clearLoginFailures(ip);

  const listCalls = [];
  const listPool = {
    async query(text, values) {
      listCalls.push({ text, values });
      return { rows: [{
        id: 7,
        public_token: 'ABCDEFGHijklmnopqrstuvwx12345678',
        customer_name: 'Клиент',
        city: 'Шымкент',
        customer_whatsapp: '+77001234567',
        total_amount: 15900,
        status: 'confirmed',
        created_at: new Date().toISOString(),
        item_count: 1,
        total_count: 1,
      }] };
    },
  };
  const listed = await listOrders({ status: 'confirmed', search: 'Клиент', page: 2 }, listPool);
  assert.equal(listed.pagination.pageSize, 20);
  assert.match(listCalls[0].text, /o\.status = \$1/);
  assert.match(listCalls[0].text, /ILIKE \$2/);
  assert.match(listCalls[0].text, /ORDER BY o\.created_at DESC/);
  assert.deepEqual(listCalls[0].values, ['confirmed', '%Клиент%', 20, 20]);

  const invalidFilterCalls = [];
  await listOrders({ status: 'hacked', page: -5 }, {
    async query(text, values) {
      invalidFilterCalls.push({ text, values });
      return { rows: [] };
    },
  });
  assert.equal(invalidFilterCalls[0].values.includes('hacked'), false, 'unknown filter status must not enter SQL');
  assert.deepEqual(invalidFilterCalls[0].values, [20, 0]);

  const detailCalls = [];
  const detail = await getAdminOrderById(9, {
    async query(text, values) {
      detailCalls.push({ text, values });
      return { rows: [] };
    },
  });
  assert.equal(detail, null);
  assert.deepEqual(detailCalls[0].values, [9]);
  assert.match(detailCalls[0].text, /WHERE o\.id = \$1/);

  let updateQueries = 0;
  const updatePool = {
    async query(text, values) {
      updateQueries += 1;
      assert.match(text, /SET status = \$1 WHERE id = \$2/);
      assert.deepEqual(values, ['confirmed', 12]);
      return { rows: [{ id: 12, status: 'confirmed' }] };
    },
  };
  assert.deepEqual(await updateOrderStatus(12, 'hacked', updatePool), { invalidStatus: true });
  assert.equal(updateQueries, 0, 'invalid status must not execute SQL');
  const updated = await updateOrderStatus(12, 'confirmed', updatePool);
  assert.equal(updated.status, 'confirmed');
  assert.equal(updateQueries, 1);

  console.log('Admin logic passed: bcrypt credentials, server-side session invalidation, login rate limit, pagination, status whitelist and parameterized SQL verified.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
