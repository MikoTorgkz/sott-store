const assert = require('assert');
const { products: catalogProducts, categories, seedCatalog } = require('../catalog-seed');
const { CatalogValidationError, slugify, validateProductInput, getPublicProductBySlug, listAdminProducts } = require('../catalog');
const { validateUploadedImage } = require('../product-upload');

assert.strictEqual(categories.length, 7, 'Stage 5 requires seven catalog categories');
assert.strictEqual(catalogProducts.length, 6, 'Seed must contain the original six products');
assert.strictEqual(new Set(catalogProducts.map((p) => p.slug)).size, 6, 'Seed slugs must be unique');
assert.strictEqual(slugify('Рубашка Новая'), 'rubashka-novaya');
const validated = validateProductInput({ name: 'Новый товар', categoryId: 1, price: 19900, variants: [{ size: 'M', stockQuantity: 0, isActive: true }], isPublished: true });
assert.strictEqual(validated.variants[0].stockQuantity, 0);
assert.throws(() => validateProductInput({ name: 'Bad', categoryId: 1, price: 100, variants: [{ size: 'M', stockQuantity: -1 }] }), CatalogValidationError);

function fakeFile(mimetype, bytes) { return { mimetype, buffer: Buffer.from(bytes) }; }
assert.strictEqual(validateUploadedImage(fakeFile('image/jpeg', [0xff, 0xd8, 0xff, 0x00])), 'jpg');
assert.strictEqual(validateUploadedImage(fakeFile('image/png', [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])), 'png');
assert.throws(() => validateUploadedImage({ mimetype: 'image/png', buffer: Buffer.from('<svg>bad</svg>') }), /не соответствует формату/);

(async () => {
  const seedCalls = [];
  const seedDb = { async query(sql, params) {
    seedCalls.push({ sql, params });
    if (sql.includes('SELECT id FROM categories')) return { rows: [{ id: 1 }] };
    if (sql.includes('INSERT INTO products')) return { rows: [] };
    return { rows: [] };
  } };
  await seedCatalog(seedDb);
  assert(!seedCalls.some((call) => call.sql.includes('INSERT INTO product_variants')), 'Existing seed products must not have admin-edited variants overwritten');

  const detailQueries = [];
  const detailDb = { async query(sql, params) {
    detailQueries.push({ sql, params });
    if (sql.includes('FROM products p JOIN categories')) return { rows: [{ id: 4, slug: 'test', name: 'Товар', price: 12000, short_description: '', description: '', is_featured: false, is_new: false, category_name: 'Рубашки', category_slug: 'shirts' }] };
    if (sql.includes('product_variants')) return { rows: [{ id: 1, size: 'M', stock_quantity: 0, is_active: true }, { id: 2, size: 'L', stock_quantity: 3, is_active: true }] };
    if (sql.includes('product_images')) return { rows: [] };
    return { rows: [] };
  } };
  const detail = await getPublicProductBySlug('test', detailDb);
  assert.strictEqual(detail.sizes[0].available, false, 'zero stock must disable public size');
  assert.strictEqual(detail.sizes[1].available, true);
  assert.deepStrictEqual(detailQueries[0].params, ['test']);

  const adminCalls = [];
  await listAdminProducts({ search: "%' OR 1=1 --", categoryId: 7, visibility: 'hidden' }, { async query(sql, params) { adminCalls.push({ sql, params }); return { rows: [] }; } });
  assert(adminCalls[0].sql.includes('ILIKE $1') && !adminCalls[0].sql.includes("OR 1=1 --"), 'admin search must be parameterized');
  assert.strictEqual(adminCalls[0].params[0], "%%' OR 1=1 --%");
  console.log('Catalog logic passed: 7 categories, idempotent seed, validation, public stock state, upload signatures and parameterized admin search verified.');
})().catch((error) => { console.error(error); process.exit(1); });
