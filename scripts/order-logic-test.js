const assert = require('assert');
const { normalizeWhatsApp, validateOrderInput, createOrder, getOrderByToken, OrderValidationError } = require('../orders');
const catalog = require('../public/js/products.js');

function expectValidation(body, message) {
  assert.throws(() => validateOrderInput(body), (error) => error instanceof OrderValidationError && error.message === message);
}

const validBody = {
  name: 'Меирбек',
  city: 'Шымкент',
  whatsapp: '8 (700) 123-45-67',
  items: [{ productId: 'polo-001', size: 'M', quantity: 2, price: 1, total: 1 }],
};

assert.strictEqual(normalizeWhatsApp('87001234567'), '+77001234567');
assert.strictEqual(normalizeWhatsApp('+7 700 123-45-67'), '+77001234567');
const validated = validateOrderInput(validBody);
assert.strictEqual(validated.items[0].unitPrice, catalog.getProductById('polo-001').price, 'Server must ignore browser price');
assert.strictEqual(validated.total, 31800, 'Server must calculate the real total');

expectValidation({ ...validBody, name: '' }, 'Введите имя');
expectValidation({ ...validBody, city: '' }, 'Введите город');
expectValidation({ ...validBody, whatsapp: '123' }, 'Укажите корректный WhatsApp');
expectValidation({ ...validBody, items: [] }, 'Корзина пуста');
expectValidation({ ...validBody, items: [{ productId: 'missing', size: 'M', quantity: 1 }] }, 'Один из товаров не найден');
expectValidation({ ...validBody, items: [{ productId: 'polo-001', size: 'S', quantity: 1 }] }, 'Выбранный размер недоступен');
for (const quantity of [0, -1, 1.5, 100000, '2']) {
  expectValidation({ ...validBody, items: [{ productId: 'polo-001', size: 'M', quantity }] }, 'Некорректное количество товара');
}

function createMockPool({ failItem = false } = {}) {
  const queries = [];
  const client = {
    async query(text, params) {
      queries.push({ text, params });
      if (failItem && text.includes('INSERT INTO order_items')) throw Object.assign(new Error('mock failure'), { code: 'MOCK' });
      if (text.includes('INSERT INTO orders')) return { rows: [{ id: '7', public_token: 'mock-token', customer_name: 'Меирбек', city: 'Шымкент', customer_whatsapp: '+77001234567', total_amount: 31800, status: 'new', created_at: new Date() }] };
      return { rows: [] };
    },
    release() { queries.push({ text: 'RELEASE' }); },
  };
  return { pool: { connect: async () => client }, queries };
}

(async () => {
  const success = createMockPool();
  const created = await createOrder(validBody, success.pool);
  assert.strictEqual(created.status, 'new');
  assert(success.queries.some((query) => query.text === 'BEGIN'));
  assert(success.queries.some((query) => query.text === 'COMMIT'));
  const itemInsert = success.queries.find((query) => query.text.includes('INSERT INTO order_items'));
  assert.strictEqual(itemInsert.params[5], 15900, 'SQL snapshot must use catalog price');
  assert.strictEqual(itemInsert.params[6], 31800, 'SQL line total must be server-calculated');

  const failure = createMockPool({ failItem: true });
  await assert.rejects(createOrder(validBody, failure.pool));
  assert(failure.queries.some((query) => query.text === 'ROLLBACK'), 'Failed item insert must roll back the transaction');
  assert(!failure.queries.some((query) => query.text === 'COMMIT'), 'Failed transaction must not commit');

  const token = 'A'.repeat(32);
  let lookupParams;
  const lookupPool = { query: async (sql, params) => {
    lookupParams = params;
    assert(sql.includes('WHERE o.public_token = $1'), 'Order lookup must be parameterized');
    return { rows: [] };
  } };
  assert.strictEqual(await getOrderByToken(token, lookupPool), null);
  assert.deepStrictEqual(lookupParams, [token]);
  assert.strictEqual(await getOrderByToken('invalid-token', lookupPool), null);

  console.log('Order logic passed: server price/total, contact validation, size/quantity safety, parameterized lookup and transaction rollback verified.');
})().catch((error) => { console.error(error); process.exit(1); });
