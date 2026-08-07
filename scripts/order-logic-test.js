const assert = require('assert');
const { normalizeWhatsApp, validateOrderInput, createOrder, getOrderByToken, OrderValidationError } = require('../orders');

function expectValidation(body, message) {
  assert.throws(() => validateOrderInput(body), (error) => error instanceof OrderValidationError && error.message === message);
}

const validBody = {
  name: 'Меирбек', city: 'Шымкент', whatsapp: '8 (700) 123-45-67',
  items: [{ productId: '1', size: 'M', quantity: 2, price: 1, total: 1 }],
};
const requestId = 'stage7-request-key-1234567890';

assert.strictEqual(normalizeWhatsApp('87001234567'), '+77001234567');
assert.strictEqual(normalizeWhatsApp('+7 700 123-45-67'), '+77001234567');
assert.deepStrictEqual(validateOrderInput(validBody).items, [{ productId: '1', size: 'M', quantity: 2 }], 'Browser price/total must be discarded before persistence');
expectValidation({ ...validBody, name: '' }, 'Введите имя');
expectValidation({ ...validBody, city: '' }, 'Введите город');
expectValidation({ ...validBody, whatsapp: '123' }, 'Укажите корректный WhatsApp');
expectValidation({ ...validBody, items: [] }, 'Корзина пуста');
expectValidation({ ...validBody, requestId: '../bad' }, 'Некорректный идентификатор запроса');
for (const quantity of [0, -1, 1.5, 11, '2']) expectValidation({ ...validBody, items: [{ productId: '1', size: 'M', quantity }] }, 'Некорректное количество товара');

function createMockPool(options = {}) {
  const queries = [];
  const client = {
    async query(text, params) {
      queries.push({ text, params });
      if (text.includes('FROM products p') && text.includes('product_variants')) {
        if (options.missing) return { rows: [] };
        if (options.badSize) return { rows: [{ id: 1, name: 'Поло из хлопка', price: 15900, is_published: true, size: null, stock_quantity: null, is_active: null }] };
        return { rows: [{ id: 1, name: 'Поло из хлопка', price: 15900, is_published: true, size: 'M', stock_quantity: options.stock ?? 5, is_active: true, image_url: '/assets/products/polo.svg' }] };
      }
      if (options.failItem && text.includes('INSERT INTO order_items')) throw new Error('mock failure');
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
  const productLookup = success.queries.find((q) => q.text.includes('FROM products p'));
  assert.deepStrictEqual(productLookup.params, ['1', 'M']);
  const itemInsert = success.queries.find((q) => q.text.includes('INSERT INTO order_items'));
  assert.strictEqual(itemInsert.params[5], 15900, 'Snapshot price must come from database');
  assert.strictEqual(itemInsert.params[6], 31800, 'Line total must be server-calculated');
  assert(success.queries.some((q) => q.text === 'COMMIT'));
  const keyed = createMockPool();
  await createOrder({ ...validBody, requestId }, keyed.pool);
  const keyedInsert = keyed.queries.find((q) => q.text.includes('INSERT INTO orders'));
  assert.strictEqual(keyedInsert.params[6], requestId, 'Idempotency key must be persisted server-side');

  await assert.rejects(createOrder(validBody, createMockPool({ missing: true }).pool), /Один из товаров не найден/);
  await assert.rejects(createOrder(validBody, createMockPool({ badSize: true }).pool), /Выбранный размер недоступен/);
  await assert.rejects(createOrder(validBody, createMockPool({ stock: 1 }).pool), /осталось только 1 шт/);
  const failure = createMockPool({ failItem: true });
  await assert.rejects(createOrder(validBody, failure.pool));
  assert(failure.queries.some((q) => q.text === 'ROLLBACK'));
  assert(!failure.queries.some((q) => q.text === 'COMMIT'));

  const token = 'A'.repeat(32);
  let lookupParams;
  const lookupPool = { query: async (sql, params) => { lookupParams = params; assert(sql.includes('WHERE o.public_token = $1')); return { rows: [] }; } };
  assert.strictEqual(await getOrderByToken(token, lookupPool), null);
  assert.deepStrictEqual(lookupParams, [token]);
  assert.strictEqual(await getOrderByToken('invalid-token', lookupPool), null);
  console.log('Order logic passed: DB price/stock/size validation, browser-price rejection, snapshots, idempotency key persistence, parameterized lookup and rollback verified.');
})().catch((error) => { console.error(error); process.exit(1); });
