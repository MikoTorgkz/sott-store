(function () {
  const clothingSizes = (unavailable = []) => ['S', 'M', 'L', 'XL', 'XXL'].map((label) => ({
    label,
    available: !unavailable.includes(label),
  }));

  const shoeSizes = (unavailable = []) => ['40', '41', '42', '43', '44'].map((label) => ({
    label,
    available: !unavailable.includes(label),
  }));

  const products = [
    {
      id: 'polo-001',
      slug: 'polo-iz-hlopka',
      name: 'Поло из хлопка',
      price: 15900,
      category: 'Поло и футболки',
      shortDescription: 'Мягкое хлопковое поло для спокойных повседневных образов.',
      description: 'Базовое поло SOTT из мягкого хлопка с аккуратным воротником и лаконичной посадкой. Универсальная вещь для повседневного гардероба.',
      images: ['/assets/products/polo.svg', '/assets/products/variants/polo-detail.svg', '/assets/categories/shirts.svg'],
      sizes: clothingSizes(['S']),
    },
    {
      id: 'shirt-002',
      slug: 'rubashka-klassicheskaya',
      name: 'Рубашка классическая',
      price: 18900,
      category: 'Рубашки',
      shortDescription: 'Классическая рубашка в тёплом бежевом оттенке.',
      description: 'Сдержанная классическая рубашка SOTT для деловых и повседневных комплектов. Чистые линии и нейтральный оттенок легко сочетаются с брюками и верхней одеждой.',
      images: ['/assets/products/shirt.svg', '/assets/products/variants/shirt-detail.svg', '/assets/categories/shirts.svg'],
      sizes: clothingSizes(['XXL']),
    },
    {
      id: 'chinos-003',
      slug: 'bryuki-chinos',
      name: 'Брюки чинос',
      price: 19900,
      category: 'Брюки',
      shortDescription: 'Универсальные чиносы в глубоком коричневом оттенке.',
      description: 'Брюки чинос SOTT с чистым силуэтом и универсальной посадкой. Подходят для повседневных комплектов с рубашками, поло и лёгкими куртками.',
      images: ['/assets/products/chinos.svg', '/assets/products/variants/chinos-detail.svg', '/assets/categories/trousers.svg'],
      sizes: clothingSizes(['S', 'XXL']),
    },
    {
      id: 'bomber-004',
      slug: 'kurtka-bomber',
      name: 'Куртка-бомбер',
      price: 32900,
      category: 'Верхняя одежда',
      shortDescription: 'Лаконичный бомбер в карамельно-коричневой палитре.',
      description: 'Минималистичный бомбер SOTT для многослойных городских образов. Выразительный цвет и спокойные детали делают его заметной основой сезона.',
      images: ['/assets/products/bomber.svg', '/assets/products/variants/bomber-detail.svg', '/assets/categories/outerwear.svg'],
      sizes: clothingSizes(['M']),
    },
    {
      id: 'loafers-005',
      slug: 'lofery-kozhanye',
      name: 'Лоферы кожаные',
      price: 27900,
      category: 'Обувь',
      shortDescription: 'Классические лоферы в тёмно-коричневом цвете.',
      description: 'Лаконичные лоферы SOTT для собранных повседневных и деловых образов. Демонстрационная модель выполнена в фирменной тёмно-коричневой палитре.',
      images: ['/assets/products/loafers.svg', '/assets/products/variants/loafers-detail.svg', '/assets/categories/shoes.svg'],
      sizes: shoeSizes(['40', '44']),
    },
    {
      id: 'jumper-006',
      slug: 'dzhemper-iz-shersti',
      name: 'Джемпер из шерсти',
      price: 21900,
      category: 'Трикотаж',
      shortDescription: 'Мягкий шерстяной джемпер в тёплом оттенке корицы.',
      description: 'Тёплый джемпер SOTT с минималистичным силуэтом. Подходит для самостоятельного образа или слоя под куртку и пальто.',
      images: ['/assets/products/jumper.svg', '/assets/products/variants/jumper-detail.svg', '/assets/categories/outerwear.svg'],
      sizes: clothingSizes(['XL']),
    },
  ];

  function formatPrice(value) {
    return `${new Intl.NumberFormat('ru-RU').format(Number(value) || 0)} ₸`;
  }

  function getProductBySlug(slug) {
    return products.find((product) => product.slug === slug) || null;
  }

  function getProductById(id) {
    return products.find((product) => product.id === id) || null;
  }

  window.SottCatalog = Object.freeze({ products, formatPrice, getProductBySlug, getProductById });
}());
