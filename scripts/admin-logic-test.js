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

  const updateCalls = [];
  let stockCommitted = false;
  let stock = 5;
  const client = {
    async query(text, values) {
      updateCalls.push({ text, values });
      if (text.includes('SELECT id, status, stock_committed FROM orders')) return { rows: [{ id: 12, status: stockCommitted ? 'confirmed' : 'new', stock_committed: stockCommitted }] };
      if (text.includes('FROM order_items WHERE order_id')) return { rows: [{ product_id: '1', product_name: 'Поло', size: 'M', quantity: 2 }] };
      if (text.includes('FROM product_variants pv')) return { rows: [{ id: 91, stock_quantity: stock, is_active: true }] };
      if (text.includes('stock_quantity=stock_quantity-$1')) { stock -= values[0]; return { rows: [] }; }
      if (text.includes('stock_quantity=stock_quantity+$1')) { stock += values[0]; return { rows: [] }; }
      if (text.includes('UPDATE orders SET status=')) { stockCommitted = values[1]; return { rows: [{ id: 12, status: values[0], stock_committed: values[1] }] }; }
      return { rows: [] };
    },
    release() {},
  };
  const updatePool = { connect: async () => client };
  assert.deepEqual(await updateOrderStatus(12, 'hacked', updatePool), { invalidStatus: true });
  assert.equal(updateCalls.length, 0, 'invalid status must not execute SQL');
  const updated = await updateOrderStatus(12, 'confirmed', updatePool);
  assert.equal(updated.status, 'confirmed');
  assert.equal(stock, 3, 'confirm must decrement stock once');
  await updateOrderStatus(12, 'confirmed', updatePool);
  assert.equal(stock, 3, 'repeated confirm must not decrement stock twice');
  await updateOrderStatus(12, 'cancelled', updatePool);
  assert.equal(stock, 5, 'cancelling a committed order must release stock exactly once');
  await updateOrderStatus(12, 'cancelled', updatePool);
  assert.equal(stock, 5, 'repeated cancellation must not release stock twice');
  assert(updateCalls.some((call) => call.text.includes('FOR UPDATE')), 'order and variant rows must be locked during stock transition');

  console.log('Admin logic passed: auth, pagination, status whitelist, row locks and exactly-once stock commit/release verified.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
