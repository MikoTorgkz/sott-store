const { getPool } = require('./db');

const PRODUCT_PAGE_SIZE = 20;
const PUBLIC_PAGE_SIZE = 12;
const MAX_PRICE = 100000000;
const MAX_STOCK = 100000;
const PLACEHOLDER_IMAGE = '/assets/product-placeholder.svg';

class CatalogValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CatalogValidationError';
    this.status = status;
  }
}

async function listPublicProducts(filters = {}, pool) {
  const result = await searchPublicProducts(filters, pool);
  return result.items;
}

async function searchPublicProducts(filters = {}, pool) {
  const database = pool || getPool();
  const page = clampPage(filters.page);
  const requestedLimit = Number(filters.limit);
  const pageSize = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(100, requestedLimit) : PUBLIC_PAGE_SIZE;
  const values = [];
  const conditions = ['p.is_published = TRUE', 'c.is_active = TRUE'];
  const category = typeof filters.category === 'string' ? filters.category.trim() : '';
  if (category && !/^[a-z0-9-]{1,100}$/.test(category)) throw new CatalogValidationError('Некорректная категория');
  if (category) {
    values.push(category);
    conditions.push(`c.slug = $${values.length}`);
  }
  const q = typeof filters.q === 'string' ? filters.q.trim().replace(/\s+/g, ' ') : '';
  if (q.length > 100) throw new CatalogValidationError('Слишком длинный поисковый запрос');
  if (q) { values.push(`%${q}%`); conditions.push(`(p.name ILIKE $${values.length} OR p.short_description ILIKE $${values.length} OR c.name ILIKE $${values.length})`); }
  const size = typeof filters.size === 'string' ? filters.size.trim() : '';
  if (size.length > 40) throw new CatalogValidationError('Некорректный размер');
  if (size) { values.push(size); conditions.push(`EXISTS (SELECT 1 FROM product_variants sv WHERE sv.product_id=p.id AND sv.size=$${values.length} AND sv.is_active=TRUE AND sv.stock_quantity>0)`); }
  const minPrice = parsePublicPrice(filters.minPrice, 'минимальную цену');
  const maxPrice = parsePublicPrice(filters.maxPrice, 'максимальную цену');
  if (minPrice !== null) { values.push(minPrice); conditions.push(`p.price >= $${values.length}`); }
  if (maxPrice !== null) { values.push(maxPrice); conditions.push(`p.price <= $${values.length}`); }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) throw new CatalogValidationError('Минимальная цена не может быть больше максимальной');
  if (filters.inStock) conditions.push('EXISTS (SELECT 1 FROM product_variants av WHERE av.product_id=p.id AND av.is_active=TRUE AND av.stock_quantity>0)');
  if (filters.featured) conditions.push('p.is_featured = TRUE');
  if (filters.isNew) conditions.push('p.is_new = TRUE');
  const ids = parsePublicIds(filters.ids);
  if (ids) { values.push(ids); conditions.push(`p.id = ANY($${values.length}::bigint[])`); }
  const sort = normalizePublicSort(filters.sort);
  const where = conditions.join(' AND ');
  const countResult = await database.query(`SELECT COUNT(*)::int AS total FROM products p JOIN categories c ON c.id=p.category_id WHERE ${where}`, values);
  const totalItems = Number(countResult.rows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const listValues = [...values, pageSize, (safePage - 1) * pageSize];
  const result = await database.query(publicListSql(where, sort, listValues.length - 1, listValues.length), listValues);
  return { items: result.rows.map(mapPublicCard), pagination: { page: safePage, pageSize, totalItems, totalPages }, filters: { q, category, size, minPrice, maxPrice, inStock: Boolean(filters.inStock), isNew: Boolean(filters.isNew), featured: Boolean(filters.featured), sort } };
}

async function listPublicSizes(pool) {
  const database = pool || getPool();
  const result = await database.query('SELECT DISTINCT pv.size FROM product_variants pv JOIN products p ON p.id=pv.product_id JOIN categories c ON c.id=p.category_id WHERE p.is_published=TRUE AND c.is_active=TRUE AND pv.is_active=TRUE AND pv.stock_quantity>0 ORDER BY pv.size ASC');
  return result.rows.map((row) => row.size);
}

function parsePublicPrice(value, label) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > MAX_PRICE) throw new CatalogValidationError(`Проверьте ${label}`);
  return number;
}

function parsePublicIds(value) {
  if (!value) return null;
  const source = Array.isArray(value) ? value : String(value).split(',');
  if (source.length > 100) throw new CatalogValidationError('Слишком много товаров');
  const ids = [...new Set(source.map((id) => parseId(id)).filter(Boolean))];
  if (!ids.length) throw new CatalogValidationError('Некорректные идентификаторы товаров');
  return ids;
}

function normalizePublicSort(value) {
  return ['default', 'newest', 'price_asc', 'price_desc', 'name'].includes(value) ? value : 'default';
}

function publicSortSql(sort) {
  if (sort === 'newest') return 'p.is_new DESC, p.created_at DESC, p.id DESC';
  if (sort === 'price_asc') return 'p.price ASC, p.id DESC';
  if (sort === 'price_desc') return 'p.price DESC, p.id DESC';
  if (sort === 'name') return 'p.name ASC, p.id DESC';
  return 'p.updated_at DESC, p.id DESC';
}

function publicListSql(where, sort, limitIndex, offsetIndex) {
  return `SELECT p.id, p.slug, p.name, p.price, p.is_featured, p.is_new,
                 c.name AS category_name, c.slug AS category_slug,
                 EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id=p.id AND pv.is_active=TRUE AND pv.stock_quantity>0) AS in_stock,
                 COALESCE((SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC LIMIT 1), '${PLACEHOLDER_IMAGE}') AS main_image
            FROM products p
            JOIN categories c ON c.id = p.category_id
           WHERE ${where}
           ORDER BY ${publicSortSql(sort)}
           LIMIT $${limitIndex} OFFSET $${offsetIndex}`;
}

async function getPublicProductBySlug(slug, pool) {
  const database = pool || getPool();
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,160}$/.test(slug)) return null;
  const productResult = await database.query(
    `SELECT p.id, p.slug, p.name, p.price, p.short_description, p.description, p.is_featured, p.is_new,
            c.name AS category_name, c.slug AS category_slug
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.slug = $1 AND p.is_published = TRUE AND c.is_active = TRUE LIMIT 1`,
    [slug],
  );
  if (!productResult.rows[0]) return null;
  const product = productResult.rows[0];
  const [variants, images] = await Promise.all([
    database.query('SELECT id, size, stock_quantity, is_active FROM product_variants WHERE product_id = $1 ORDER BY id ASC', [product.id]),
    database.query('SELECT id, image_url, sort_order, is_primary FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order ASC, id ASC', [product.id]),
  ]);
  return mapPublicDetail(product, variants.rows, images.rows);
}

async function listCategories(options = {}, pool) {
  const database = pool || getPool();
  const result = await database.query(
    `SELECT id, name, slug, sort_order, is_active FROM categories ${options.activeOnly ? 'WHERE is_active = TRUE' : ''} ORDER BY sort_order ASC, name ASC`,
  );
  return result.rows.map((row) => ({ id: Number(row.id), name: row.name, slug: row.slug, sortOrder: Number(row.sort_order), isActive: row.is_active }));
}

async function listAdminProducts(filters = {}, pool) {
  const database = pool || getPool();
  const page = clampPage(filters.page);
  const values = [];
  const conditions = [];
  const search = typeof filters.search === 'string' ? filters.search.trim().slice(0, 100) : '';
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(p.name ILIKE $${values.length} OR p.slug ILIKE $${values.length})`);
  }
  const categoryId = parseId(filters.categoryId);
  if (categoryId) {
    values.push(categoryId);
    conditions.push(`p.category_id = $${values.length}`);
  }
  if (filters.visibility === 'published') conditions.push('p.is_published = TRUE');
  if (filters.visibility === 'hidden') conditions.push('p.is_published = FALSE');
  if (filters.featured === true) conditions.push('p.is_featured = TRUE');
  if (filters.isNew === true) conditions.push('p.is_new = TRUE');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(PRODUCT_PAGE_SIZE, (page - 1) * PRODUCT_PAGE_SIZE);
  const result = await database.query(
    `SELECT p.id, p.slug, p.name, p.price, p.is_published, p.is_featured, p.is_new, p.updated_at,
            c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
            COALESCE((SELECT SUM(pv.stock_quantity)::int FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = TRUE), 0) AS total_stock,
            COALESCE((SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC LIMIT 1), '${PLACEHOLDER_IMAGE}') AS main_image,
            COUNT(*) OVER()::int AS total_count
       FROM products p JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.updated_at DESC, p.id DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  const total = result.rows.length ? Number(result.rows[0].total_count) : 0;
  return {
    products: result.rows.map(mapAdminCard),
    pagination: { page, pageSize: PRODUCT_PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PRODUCT_PAGE_SIZE)) },
  };
}

async function getAdminProductById(id, pool) {
  const database = pool || getPool();
  const productId = parseId(id);
  if (!productId) return null;
  const result = await database.query(
    `SELECT p.id, p.slug, p.name, p.price, p.short_description, p.description, p.is_published, p.is_featured, p.is_new, p.created_at, p.updated_at,
            c.id AS category_id, c.name AS category_name, c.slug AS category_slug
       FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = $1 LIMIT 1`,
    [productId],
  );
  if (!result.rows[0]) return null;
  const [variants, images] = await Promise.all([
    database.query('SELECT id, size, stock_quantity, is_active FROM product_variants WHERE product_id = $1 ORDER BY id ASC', [productId]),
    database.query('SELECT id, image_url, sort_order, is_primary, created_at FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order ASC, id ASC', [productId]),
  ]);
  return mapAdminDetail(result.rows[0], variants.rows, images.rows);
}

async function createProduct(input, pool) {
  const database = pool || getPool();
  const product = validateProductInput(input);
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await assertCategory(client, product.categoryId);
    const slug = await createUniqueSlug(client, product.name);
    const result = await client.query(
      `INSERT INTO products (slug, name, category_id, price, short_description, description, is_published, is_featured, is_new)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [slug, product.name, product.categoryId, product.price, product.shortDescription, product.description, product.isPublished, product.isFeatured, product.isNew],
    );
    await replaceVariants(client, result.rows[0].id, product.variants);
    await client.query('COMMIT');
    return getAdminProductById(result.rows[0].id, database);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_error) { /* release below */ }
    if (error && error.code === '23505') throw new CatalogValidationError('Такой slug уже используется', 409);
    throw error;
  } finally {
    client.release();
  }
}

async function updateProduct(id, input, pool) {
  const database = pool || getPool();
  const productId = parseId(id);
  if (!productId) return null;
  const product = validateProductInput(input);
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await assertCategory(client, product.categoryId);
    const result = await client.query(
      `UPDATE products SET name=$1, category_id=$2, price=$3, short_description=$4, description=$5,
              is_published=$6, is_featured=$7, is_new=$8, updated_at=NOW()
        WHERE id=$9 RETURNING id`,
      [product.name, product.categoryId, product.price, product.shortDescription, product.description, product.isPublished, product.isFeatured, product.isNew, productId],
    );
    if (!result.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    await replaceVariants(client, productId, product.variants);
    await client.query('COMMIT');
    return getAdminProductById(productId, database);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_error) { /* release below */ }
    throw error;
  } finally {
    client.release();
  }
}

async function setProductPublished(id, isPublished, pool) {
  const productId = parseId(id);
  if (!productId || typeof isPublished !== 'boolean') throw new CatalogValidationError('Некорректный статус публикации');
  const database = pool || getPool();
  const result = await database.query('UPDATE products SET is_published=$1, updated_at=NOW() WHERE id=$2 RETURNING id, is_published', [isPublished, productId]);
  return result.rows[0] || null;
}

async function addProductImages(productId, urls, pool) {
  const id = parseId(productId);
  if (!id) return null;
  const database = pool || getPool();
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query('SELECT id FROM products WHERE id=$1 FOR UPDATE', [id]);
    if (!exists.rows[0]) { await client.query('ROLLBACK'); return null; }
    const current = await client.query('SELECT COUNT(*)::int AS count FROM product_images WHERE product_id=$1', [id]);
    const start = Number(current.rows[0].count || 0);
    if (start + urls.length > 8) throw new CatalogValidationError('Можно загрузить не более 8 фотографий');
    for (let index = 0; index < urls.length; index += 1) {
      await client.query(
        `INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
         VALUES ($1,$2,$3,$4)`,
        [id, urls[index], start + index, start === 0 && index === 0],
      );
    }
    await client.query('UPDATE products SET updated_at=NOW() WHERE id=$1', [id]);
    await client.query('COMMIT');
    return getAdminProductById(id, database);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_error) { /* release below */ }
    throw error;
  } finally {
    client.release();
  }
}

async function setPrimaryImage(productId, imageId, pool) {
  const id = parseId(productId);
  const targetId = parseId(imageId);
  if (!id || !targetId) return null;
  const database = pool || getPool();
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query('SELECT id FROM product_images WHERE id=$1 AND product_id=$2', [targetId, id]);
    if (!exists.rows[0]) { await client.query('ROLLBACK'); return null; }
    await client.query('UPDATE product_images SET is_primary=FALSE WHERE product_id=$1', [id]);
    await client.query('UPDATE product_images SET is_primary=TRUE WHERE id=$1 AND product_id=$2', [targetId, id]);
    await client.query('UPDATE products SET updated_at=NOW() WHERE id=$1', [id]);
    await client.query('COMMIT');
    return true;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_error) { /* release below */ }
    throw error;
  } finally { client.release(); }
}

async function deleteProductImage(productId, imageId, pool) {
  const id = parseId(productId);
  const targetId = parseId(imageId);
  if (!id || !targetId) return null;
  const database = pool || getPool();
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const deleted = await client.query('DELETE FROM product_images WHERE id=$1 AND product_id=$2 RETURNING image_url, is_primary', [targetId, id]);
    if (!deleted.rows[0]) { await client.query('ROLLBACK'); return null; }
    if (deleted.rows[0].is_primary) {
      const next = await client.query('SELECT id FROM product_images WHERE product_id=$1 ORDER BY sort_order ASC, id ASC LIMIT 1', [id]);
      if (next.rows[0]) await client.query('UPDATE product_images SET is_primary=TRUE WHERE id=$1', [next.rows[0].id]);
    }
    await client.query('UPDATE products SET updated_at=NOW() WHERE id=$1', [id]);
    await client.query('COMMIT');
    return deleted.rows[0];
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_error) { /* release below */ }
    throw error;
  } finally { client.release(); }
}

function validateProductInput(input = {}) {
  const name = cleanText(input.name, 200, 'Введите название товара');
  const categoryId = parseId(input.categoryId);
  if (!categoryId) throw new CatalogValidationError('Выберите категорию');
  if (!Number.isInteger(input.price) || input.price <= 0 || input.price > MAX_PRICE) throw new CatalogValidationError('Проверьте цену');
  const shortDescription = cleanOptionalText(input.shortDescription, 500);
  const description = cleanOptionalText(input.description, 10000);
  if (!Array.isArray(input.variants) || !input.variants.length) throw new CatalogValidationError('Добавьте хотя бы один размер');
  const seen = new Set();
  const variants = input.variants.map((variant) => {
    const size = cleanText(variant && variant.size, 40, 'Укажите размер');
    if (seen.has(size.toLowerCase())) throw new CatalogValidationError(`Размер ${size} указан дважды`);
    seen.add(size.toLowerCase());
    if (!Number.isInteger(variant.stockQuantity) || variant.stockQuantity < 0 || variant.stockQuantity > MAX_STOCK) throw new CatalogValidationError('Некорректный остаток');
    return { size, stockQuantity: variant.stockQuantity, isActive: variant.isActive !== false };
  });
  return {
    name, categoryId, price: input.price, shortDescription, description, variants,
    isPublished: input.isPublished === true,
    isFeatured: input.isFeatured === true,
    isNew: input.isNew === true,
  };
}

async function replaceVariants(client, productId, variants) {
  const sizes = variants.map((variant) => variant.size);
  await client.query('DELETE FROM product_variants WHERE product_id=$1 AND NOT (size = ANY($2::text[]))', [productId, sizes]);
  for (const variant of variants) {
    await client.query(
      `INSERT INTO product_variants (product_id,size,stock_quantity,is_active) VALUES ($1,$2,$3,$4)
       ON CONFLICT (product_id,size) DO UPDATE SET stock_quantity=EXCLUDED.stock_quantity, is_active=EXCLUDED.is_active`,
      [productId, variant.size, variant.stockQuantity, variant.isActive],
    );
  }
}

async function assertCategory(client, categoryId) {
  const result = await client.query('SELECT id FROM categories WHERE id=$1 AND is_active=TRUE', [categoryId]);
  if (!result.rows[0]) throw new CatalogValidationError('Выберите категорию');
}

async function createUniqueSlug(client, name) {
  const base = slugify(name) || 'product';
  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const exists = await client.query('SELECT 1 FROM products WHERE slug=$1', [candidate]);
    if (!exists.rows[0]) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function slugify(value) {
  const map = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  return String(value || '').toLowerCase().split('').map((char) => map[char] === undefined ? char : map[char]).join('')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140);
}

function mapPublicCard(row) {
  return { id: String(row.id), slug: row.slug, name: row.name, price: Number(row.price), category: row.category_name, categorySlug: row.category_slug, mainImage: row.main_image, isFeatured: row.is_featured, isNew: row.is_new, inStock: row.in_stock !== false };
}

function mapPublicDetail(row, variants, images) {
  return {
    id: String(row.id), slug: row.slug, name: row.name, price: Number(row.price), category: row.category_name, categorySlug: row.category_slug,
    shortDescription: row.short_description, description: row.description, isFeatured: row.is_featured, isNew: row.is_new,
    images: images.length ? images.map((image) => image.image_url) : [PLACEHOLDER_IMAGE],
    sizes: variants.map((variant) => ({ label: variant.size, stockQuantity: Number(variant.stock_quantity), available: variant.is_active && Number(variant.stock_quantity) > 0 })),
  };
}

function mapAdminCard(row) {
  return { ...mapPublicCard(row), categoryId: Number(row.category_id), totalStock: Number(row.total_stock), isPublished: row.is_published, updatedAt: row.updated_at };
}

function mapAdminDetail(row, variants, images) {
  return {
    id: Number(row.id), slug: row.slug, name: row.name, categoryId: Number(row.category_id), category: row.category_name, categorySlug: row.category_slug,
    price: Number(row.price), shortDescription: row.short_description, description: row.description,
    isPublished: row.is_published, isFeatured: row.is_featured, isNew: row.is_new, createdAt: row.created_at, updatedAt: row.updated_at,
    variants: variants.map((variant) => ({ id: Number(variant.id), size: variant.size, stockQuantity: Number(variant.stock_quantity), isActive: variant.is_active })),
    images: images.map((image) => ({ id: Number(image.id), url: image.image_url, sortOrder: Number(image.sort_order), isPrimary: image.is_primary, createdAt: image.created_at })),
  };
}

function cleanText(value, maxLength, message) {
  if (typeof value !== 'string' || !value.trim()) throw new CatalogValidationError(message);
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length > maxLength) throw new CatalogValidationError(message);
  return text;
}

function cleanOptionalText(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > maxLength) throw new CatalogValidationError('Слишком длинное описание');
  return text;
}

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function clampPage(value) {
  const page = Number.parseInt(value, 10);
  return Number.isInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
}

module.exports = {
  PRODUCT_PAGE_SIZE, MAX_PRICE, MAX_STOCK, PLACEHOLDER_IMAGE, CatalogValidationError,
  listPublicProducts, searchPublicProducts, listPublicSizes, getPublicProductBySlug, listCategories, listAdminProducts, getAdminProductById,
  createProduct, updateProduct, setProductPublished, addProductImages, setPrimaryImage, deleteProductImage,
  validateProductInput, slugify,
};
