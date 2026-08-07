const categories = [
  { name: 'Рубашки', slug: 'shirts', sortOrder: 10 },
  { name: 'Поло и футболки', slug: 'polo-tshirts', sortOrder: 20 },
  { name: 'Брюки', slug: 'trousers', sortOrder: 30 },
  { name: 'Верхняя одежда', slug: 'outerwear', sortOrder: 40 },
  { name: 'Трикотаж', slug: 'knitwear', sortOrder: 50 },
  { name: 'Обувь', slug: 'shoes', sortOrder: 60 },
  { name: 'Аксессуары', slug: 'accessories', sortOrder: 70 },
];

const products = [
  {
    legacyId: 'polo-001', slug: 'polo-iz-hlopka', name: 'Поло из хлопка', category: 'polo-tshirts', price: 15900,
    shortDescription: 'Мягкое хлопковое поло для спокойных повседневных образов.',
    description: 'Базовое поло SOTT из мягкого хлопка с аккуратным воротником и лаконичной посадкой. Универсальная вещь для повседневного гардероба.',
    featured: true, isNew: false,
    images: ['/assets/products/polo.svg', '/assets/products/variants/polo-detail.svg', '/assets/categories/shirts.svg'],
    variants: sizes(['S', 'M', 'L', 'XL', 'XXL'], ['S']),
  },
  {
    legacyId: 'shirt-002', slug: 'rubashka-klassicheskaya', name: 'Рубашка классическая', category: 'shirts', price: 18900,
    shortDescription: 'Классическая рубашка в тёплом бежевом оттенке.',
    description: 'Сдержанная классическая рубашка SOTT для деловых и повседневных комплектов. Чистые линии и нейтральный оттенок легко сочетаются с брюками и верхней одеждой.',
    featured: true, isNew: false,
    images: ['/assets/products/shirt.svg', '/assets/products/variants/shirt-detail.svg', '/assets/categories/shirts.svg'],
    variants: sizes(['S', 'M', 'L', 'XL', 'XXL'], ['XXL']),
  },
  {
    legacyId: 'chinos-003', slug: 'bryuki-chinos', name: 'Брюки чинос', category: 'trousers', price: 19900,
    shortDescription: 'Универсальные чиносы в глубоком коричневом оттенке.',
    description: 'Брюки чинос SOTT с чистым силуэтом и универсальной посадкой. Подходят для повседневных комплектов с рубашками, поло и лёгкими куртками.',
    featured: true, isNew: false,
    images: ['/assets/products/chinos.svg', '/assets/products/variants/chinos-detail.svg', '/assets/categories/trousers.svg'],
    variants: sizes(['S', 'M', 'L', 'XL', 'XXL'], ['S', 'XXL']),
  },
  {
    legacyId: 'bomber-004', slug: 'kurtka-bomber', name: 'Куртка-бомбер', category: 'outerwear', price: 32900,
    shortDescription: 'Лаконичный бомбер в карамельно-коричневой палитре.',
    description: 'Минималистичный бомбер SOTT для многослойных городских образов. Выразительный цвет и спокойные детали делают его заметной основой сезона.',
    featured: true, isNew: true,
    images: ['/assets/products/bomber.svg', '/assets/products/variants/bomber-detail.svg', '/assets/categories/outerwear.svg'],
    variants: sizes(['S', 'M', 'L', 'XL', 'XXL'], ['M']),
  },
  {
    legacyId: 'loafers-005', slug: 'lofery-kozhanye', name: 'Лоферы кожаные', category: 'shoes', price: 27900,
    shortDescription: 'Классические лоферы в тёмно-коричневом цвете.',
    description: 'Лаконичные лоферы SOTT для собранных повседневных и деловых образов. Демонстрационная модель выполнена в фирменной тёмно-коричневой палитре.',
    featured: true, isNew: false,
    images: ['/assets/products/loafers.svg', '/assets/products/variants/loafers-detail.svg', '/assets/categories/shoes.svg'],
    variants: sizes(['40', '41', '42', '43', '44'], ['40', '44']),
  },
  {
    legacyId: 'jumper-006', slug: 'dzhemper-iz-shersti', name: 'Джемпер из шерсти', category: 'knitwear', price: 21900,
    shortDescription: 'Мягкий шерстяной джемпер в тёплом оттенке корицы.',
    description: 'Тёплый джемпер SOTT с минималистичным силуэтом. Подходит для самостоятельного образа или слоя под куртку и пальто.',
    featured: true, isNew: true,
    images: ['/assets/products/jumper.svg', '/assets/products/variants/jumper-detail.svg', '/assets/categories/outerwear.svg'],
    variants: sizes(['S', 'M', 'L', 'XL', 'XXL'], ['XL']),
  },
];

function sizes(labels, unavailable) {
  return labels.map((size, index) => ({ size, stockQuantity: unavailable.includes(size) ? 0 : 4 + (index % 3) }));
}

async function seedCatalog(database) {
  for (const category of categories) {
    await database.query(
      `INSERT INTO categories (name, slug, sort_order, is_active)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (slug) DO NOTHING`,
      [category.name, category.slug, category.sortOrder],
    );
  }

  for (const product of products) {
    const categoryResult = await database.query('SELECT id FROM categories WHERE slug = $1 LIMIT 1', [product.category]);
    if (!categoryResult.rows[0]) continue;
    const inserted = await database.query(
      `INSERT INTO products
         (legacy_id, slug, name, category_id, price, short_description, description, is_published, is_featured, is_new)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id`,
      [product.legacyId, product.slug, product.name, categoryResult.rows[0].id, product.price, product.shortDescription, product.description, product.featured, product.isNew],
    );
    if (!inserted.rows[0]) continue;
    const productId = inserted.rows[0].id;
    for (const variant of product.variants) {
      await database.query(
        `INSERT INTO product_variants (product_id, size, stock_quantity, is_active)
         VALUES ($1, $2, $3, TRUE) ON CONFLICT (product_id, size) DO NOTHING`,
        [productId, variant.size, variant.stockQuantity],
      );
    }
    for (let index = 0; index < product.images.length; index += 1) {
      await database.query(
        `INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
         VALUES ($1, $2, $3, $4) ON CONFLICT (product_id, image_url) DO NOTHING`,
        [productId, product.images[index], index, index === 0],
      );
    }
  }
}

module.exports = { categories, products, seedCatalog };
