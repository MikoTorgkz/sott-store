(function () {
  const STORAGE_KEY = 'sott_language';
  const dictionaries = {
    ru: {
      'nav.home': 'Главная', 'nav.catalog': 'Каталог', 'nav.new': 'Новинки', 'nav.about': 'О нас', 'nav.contacts': 'Контакты',
      search: 'Поиск', 'search.placeholder': 'Найти товар', 'search.submit': 'Найти', favorites: 'Избранное', cart: 'Корзина',
      announcement: 'Новая коллекция · SOTT · Шымкент', 'menu.open': 'Открыть меню',
      'hero.title': 'Стиль для современных мужчин', 'hero.subtitle': 'Премиальное качество. Безупречный крой. Уверенность в каждой детали.', 'hero.quality': 'Премиальное качество. Безупречный крой.', 'hero.confidence': 'Уверенность в каждой детали.',
      'hero.catalog': 'Смотреть каталог', 'hero.season': 'Новинки сезона', 'hero.seasonText': 'Откройте для себя свежие образы SOTT.', 'hero.new': 'Смотреть новинки',
      categories: 'Категории', 'view.all': 'Смотреть все', view: 'Смотреть', 'category.all': 'Все категории',
      'category.shirts': 'Рубашки', 'category.trousers': 'Брюки', 'category.outerwear': 'Верхняя одежда', 'category.shoes': 'Обувь', 'category.accessories': 'Аксессуары',
      'products.popular': 'Популярные товары', 'about.sott': 'О SOTT', 'about.title': 'Стиль в каждой детали',
      'about.text': 'SOTT — магазин мужской одежды в Шымкенте. Современные силуэты, спокойная палитра и вещи, которые легко собирать в цельный гардероб.',
      delivery: 'Доставка', 'delivery.kz': 'По Казахстану', 'delivery.line': 'Доставка · по Казахстану', daily: 'Каждый день', 'daily.hours': 'Ежедневно 10:00–24:00', address: 'Адрес',
      'footer.style': 'Современная мужская одежда в фирменном стиле SOTT.', 'footer.info': 'Информация', 'footer.store': 'О магазине', 'footer.allCategories': 'Все категории', 'footer.kz': 'Шымкент · Казахстан', 'footer.hours': 'Шымкент · Ежедневно 10:00–24:00',
      'catalog.title': 'Мужская одежда SOTT', 'catalog.mens': 'Мужская одежда', 'catalog.kicker': 'SOTT · Каталог', 'catalog.choose': 'Выберите одежду, обувь и аксессуары SOTT.', 'catalog.popular': 'Популярные', filters: 'Фильтры', 'filters.close': 'Закрыть фильтры',
      category: 'Категория', size: 'Размер', 'size.all': 'Все размеры', price: 'Цена, ₸', from: 'От', to: 'До', 'stock.only': 'Только в наличии',
      'sort.label': 'Сортировать', 'sort.default': 'По умолчанию', 'sort.new': 'Сначала новинки', 'sort.priceAsc': 'Цена: по возрастанию', 'sort.priceDesc': 'Цена: по убыванию', 'sort.name': 'По названию',
      'filters.show': 'Показать товары', 'filters.resetAll': 'Сбросить всё', 'filters.reset': 'Сбросить фильтры', 'catalog.collection': 'Коллекция SOTT',
      'catalog.count': 'Товаров: {count}', 'catalog.none': 'По выбранным параметрам товаров не найдено', 'catalog.loadError': 'Не удалось загрузить товары', retry: 'Попробовать снова', previous: 'Назад', next: 'Вперёд', all: 'Все',
      new: 'Новинка', 'outOfStock': 'Нет в наличии', 'chooseSize': 'Выбрать размер', details: 'Подробнее',
      'product.favorite': 'В избранное', 'product.favorited': 'В избранном', 'product.sizeGuide': 'Таблица размеров', quantity: 'Количество', 'product.add': 'Добавить в корзину', 'product.about': 'О товаре',
      'product.notFound': 'Товар не найден', 'product.notFoundText': 'Возможно, ссылка устарела или товар был перемещён.', 'product.backCatalog': 'Вернуться в каталог', 'product.selectSize': 'Выберите размер', 'product.added': 'Товар добавлен в корзину', 'size.foot': 'Длина стопы, см', 'size.chest': 'Грудь, см', 'size.waist': 'Талия, см', 'size.note': 'Учебная таблица. Финальные замеры будут добавлены после уточнения ассортимента.',
      'cart.yourChoice': 'Ваш выбор', 'cart.order': 'Ваш заказ', goods: 'Товары', total: 'Итого', 'checkout.open': 'Оформить заказ', checkout: 'Оформление', 'checkout.contacts': 'Контактные данные',
      'checkout.whatsapp': 'Магазин свяжется с вами в WhatsApp для подтверждения заказа.', name: 'Имя', city: 'Город', 'name.placeholder': 'Ваше имя', 'city.placeholder': 'Ваш город', 'checkout.create': 'Создать заказ',
      'cart.empty': 'Ваша корзина пуста', 'cart.addCatalog': 'Добавьте товары из каталога', 'catalog.go': 'Перейти в каталог', remove: 'Удалить',
      'favorites.empty': 'В избранном пока ничего нет', 'favorites.help': 'Сохраняйте понравившиеся товары, чтобы быстро вернуться к ним позже.', 'favorites.loading': 'Загружаем избранное…', 'favorites.error': 'Не удалось загрузить избранное',
      'order.back': 'Вернуться в магазин', 'order.loading': 'Загружаем заказ…', 'order.title': 'Заказ SOTT', 'order.save': 'Сохраните эту страницу — по ней магазин сможет быстро проверить состав заказа.', 'order.client': 'Данные клиента', 'order.date': 'Дата заказа', 'order.items': 'Состав заказа',
      'order.loadError': 'Не удалось загрузить заказ', 'order.retryLater': 'Попробуйте обновить страницу чуть позже.', 'order.created': 'SOTT · заказ создан', 'order.thanks': 'Спасибо! Заказ создан',
      'order.confirm': 'Для подтверждения отправьте сообщение магазину в WhatsApp. Оплату и доставку магазин согласует с вами напрямую.', 'order.whatsapp': 'Написать в WhatsApp', 'order.view': 'Посмотреть заказ',
      'order.linkUnavailable': 'Ссылка заказа недоступна. Вернитесь в магазин и попробуйте снова.', 'order.notFound': 'Заказ не найден', 'order.checkLink': 'Проверьте ссылку заказа или вернитесь в магазин.',
      'order.unavailable': 'Заказ временно недоступен', 'order.openLater': 'Попробуйте открыть эту страницу немного позже.',
      'page.notFound': 'Страница не найдена', 'page.notFoundText': 'Возможно, ссылка устарела. Вернитесь на главную или откройте каталог.', 'page.home': 'На главную', 'page.catalog': 'В каталог', 'page.error': 'Что-то пошло не так',
      'form.nameRequired': 'Введите имя', 'form.cityRequired': 'Введите город', 'form.whatsappInvalid': 'Укажите корректный WhatsApp', 'cart.emptyShort': 'Корзина пуста', 'checkout.creating': 'Создаём заказ...', 'checkout.error': 'Не удалось создать заказ. Попробуйте ещё раз',
      'unit.pcs': 'шт.', 'image.show': 'Показать изображение {count}', 'stock.left': 'В этом размере осталось {count} шт.',
    },
    kk: {
      'nav.home': 'Басты бет', 'nav.catalog': 'Каталог', 'nav.new': 'Жаңалықтар', 'nav.about': 'Біз туралы', 'nav.contacts': 'Байланыс',
      search: 'Іздеу', 'search.placeholder': 'Тауарды табу', 'search.submit': 'Табу', favorites: 'Таңдаулылар', cart: 'Себет',
      announcement: 'Жаңа топтама · SOTT · Шымкент', 'menu.open': 'Мәзірді ашу',
      'hero.title': 'Заманауи ерлерге арналған стиль', 'hero.subtitle': 'Премиум сапа. Мінсіз пішім. Әр бөлшектегі сенімділік.', 'hero.quality': 'Премиум сапа. Мінсіз пішім.', 'hero.confidence': 'Әр бөлшектегі сенімділік.',
      'hero.catalog': 'Каталогты көру', 'hero.season': 'Маусым жаңалықтары', 'hero.seasonText': 'SOTT жаңа образдарын ашыңыз.', 'hero.new': 'Жаңалықтарды көру',
      categories: 'Санаттар', 'view.all': 'Барлығын көру', view: 'Көру', 'category.all': 'Барлық санаттар',
      'category.shirts': 'Жейделер', 'category.trousers': 'Шалбарлар', 'category.outerwear': 'Сырт киім', 'category.shoes': 'Аяқ киім', 'category.accessories': 'Аксессуарлар',
      'products.popular': 'Танымал тауарлар', 'about.sott': 'SOTT туралы', 'about.title': 'Әр бөлшектегі стиль',
      'about.text': 'SOTT — Шымкенттегі ерлер киімі дүкені. Заманауи пішімдер, сабырлы түстер және біртұтас гардероб құруға ыңғайлы киімдер.',
      delivery: 'Жеткізу', 'delivery.kz': 'Қазақстан бойынша', 'delivery.line': 'Жеткізу · Қазақстан бойынша', daily: 'Күн сайын', 'daily.hours': 'Күн сайын 10:00–24:00', address: 'Мекенжай',
      'footer.style': 'SOTT фирмалық стиліндегі заманауи ерлер киімі.', 'footer.info': 'Ақпарат', 'footer.store': 'Дүкен туралы', 'footer.allCategories': 'Барлық санаттар', 'footer.kz': 'Шымкент · Қазақстан', 'footer.hours': 'Шымкент · Күн сайын 10:00–24:00',
      'catalog.title': 'SOTT ерлер киімі', 'catalog.mens': 'Ерлер киімі', 'catalog.kicker': 'SOTT · Каталог', 'catalog.choose': 'SOTT киімін, аяқ киімін және аксессуарларын таңдаңыз.', 'catalog.popular': 'Танымал', filters: 'Сүзгілер', 'filters.close': 'Сүзгілерді жабу',
      category: 'Санат', size: 'Өлшем', 'size.all': 'Барлық өлшемдер', price: 'Бағасы, ₸', from: 'Бастап', to: 'Дейін', 'stock.only': 'Тек бар тауарлар',
      'sort.label': 'Сұрыптау', 'sort.default': 'Әдепкі бойынша', 'sort.new': 'Алдымен жаңалары', 'sort.priceAsc': 'Бағасы: өсу ретімен', 'sort.priceDesc': 'Бағасы: кему ретімен', 'sort.name': 'Атауы бойынша',
      'filters.show': 'Тауарларды көрсету', 'filters.resetAll': 'Барлығын тазалау', 'filters.reset': 'Сүзгілерді тазалау', 'catalog.collection': 'SOTT топтамасы',
      'catalog.count': 'Тауарлар: {count}', 'catalog.none': 'Таңдалған параметрлер бойынша тауар табылмады', 'catalog.loadError': 'Тауарларды жүктеу мүмкін болмады', retry: 'Қайта көру', previous: 'Артқа', next: 'Алға', all: 'Барлығы',
      new: 'Жаңа', 'outOfStock': 'Қоймада жоқ', 'chooseSize': 'Өлшемді таңдау', details: 'Толығырақ',
      'product.favorite': 'Таңдаулыларға', 'product.favorited': 'Таңдаулыда', 'product.sizeGuide': 'Өлшем кестесі', quantity: 'Саны', 'product.add': 'Себетке қосу', 'product.about': 'Тауар туралы',
      'product.notFound': 'Тауар табылмады', 'product.notFoundText': 'Сілтеме ескірген немесе тауар ауыстырылған болуы мүмкін.', 'product.backCatalog': 'Каталогқа оралу', 'product.selectSize': 'Өлшемді таңдаңыз', 'product.added': 'Тауар себетке қосылды', 'size.foot': 'Табан ұзындығы, см', 'size.chest': 'Кеуде, см', 'size.waist': 'Бел, см', 'size.note': 'Уақытша өлшем кестесі. Нақты өлшемдер ассортимент нақтыланғаннан кейін қосылады.',
      'cart.yourChoice': 'Сіздің таңдауыңыз', 'cart.order': 'Сіздің тапсырысыңыз', goods: 'Тауарлар', total: 'Барлығы', 'checkout.open': 'Тапсырыс беру', checkout: 'Рәсімдеу', 'checkout.contacts': 'Байланыс деректері',
      'checkout.whatsapp': 'Тапсырысты растау үшін дүкен сізбен WhatsApp арқылы байланысады.', name: 'Аты', city: 'Қала', 'name.placeholder': 'Атыңыз', 'city.placeholder': 'Қалаңыз', 'checkout.create': 'Тапсырыс жасау',
      'cart.empty': 'Себетіңіз бос', 'cart.addCatalog': 'Каталогтан тауар қосыңыз', 'catalog.go': 'Каталогқа өту', remove: 'Жою',
      'favorites.empty': 'Таңдаулылар әзірге бос', 'favorites.help': 'Ұнаған тауарларды сақтап, оларға кейін тез оралыңыз.', 'favorites.loading': 'Таңдаулылар жүктелуде…', 'favorites.error': 'Таңдаулыларды жүктеу мүмкін болмады',
      'order.back': 'Дүкенге оралу', 'order.loading': 'Тапсырыс жүктелуде…', 'order.title': 'SOTT тапсырысы', 'order.save': 'Бұл бетті сақтаңыз — дүкен тапсырыс құрамын осы сілтеме арқылы тез тексере алады.', 'order.client': 'Клиент деректері', 'order.date': 'Тапсырыс күні', 'order.items': 'Тапсырыс құрамы',
      'order.loadError': 'Тапсырысты жүктеу мүмкін болмады', 'order.retryLater': 'Бетті сәл кейінірек жаңартып көріңіз.', 'order.created': 'SOTT · тапсырыс жасалды', 'order.thanks': 'Рақмет! Тапсырыс жасалды',
      'order.confirm': 'Растау үшін дүкенге WhatsApp арқылы хабарлама жіберіңіз. Төлем мен жеткізуді дүкен сізбен тікелей келіседі.', 'order.whatsapp': 'WhatsApp-қа жазу', 'order.view': 'Тапсырысты көру',
      'order.linkUnavailable': 'Тапсырыс сілтемесі қолжетімсіз. Дүкенге оралып, қайта көріңіз.', 'order.notFound': 'Тапсырыс табылмады', 'order.checkLink': 'Тапсырыс сілтемесін тексеріңіз немесе дүкенге оралыңыз.',
      'order.unavailable': 'Тапсырыс уақытша қолжетімсіз', 'order.openLater': 'Бұл бетті сәл кейінірек ашып көріңіз.',
      'page.notFound': 'Бет табылмады', 'page.notFoundText': 'Сілтеме ескірген болуы мүмкін. Басты бетке оралыңыз немесе каталогты ашыңыз.', 'page.home': 'Басты бетке', 'page.catalog': 'Каталогқа', 'page.error': 'Бірдеңе дұрыс болмады',
      'form.nameRequired': 'Атыңызды енгізіңіз', 'form.cityRequired': 'Қаланы енгізіңіз', 'form.whatsappInvalid': 'Дұрыс WhatsApp нөмірін көрсетіңіз', 'cart.emptyShort': 'Себет бос', 'checkout.creating': 'Тапсырыс жасалуда...', 'checkout.error': 'Тапсырыс жасау мүмкін болмады. Қайта көріңіз',
      'unit.pcs': 'дана', 'image.show': '{count}-суретті көрсету', 'stock.left': 'Бұл өлшемде {count} дана қалды',
    },
  };

  const phraseKeys = {
    'Главная':'nav.home','Каталог':'nav.catalog','Новинки':'nav.new','О нас':'nav.about','Контакты':'nav.contacts','Поиск':'search','Найти товар':'search.placeholder','Найти':'search.submit','Избранное':'favorites','Корзина':'cart',
    'Новая коллекция · SOTT · Шымкент':'announcement','Открыть меню':'menu.open','Стиль для современных мужчин':'hero.title','Премиальное качество. Безупречный крой.':'hero.quality','Уверенность в каждой детали.':'hero.confidence','Смотреть каталог':'hero.catalog','Новинки сезона':'hero.season','Откройте для себя свежие образы SOTT.':'hero.seasonText','Смотреть новинки':'hero.new',
    'Категории':'categories','Смотреть все':'view.all','Смотреть':'view','Рубашки':'category.shirts','Брюки':'category.trousers','Верхняя одежда':'category.outerwear','Обувь':'category.shoes','Аксессуары':'category.accessories','Популярные товары':'products.popular','О SOTT':'about.sott','Стиль в каждой детали':'about.title',
    'Доставка':'delivery','По Казахстану':'delivery.kz','Доставка · по Казахстану':'delivery.line','Каждый день':'daily','Ежедневно 10:00–24:00':'daily.hours','Адрес':'address','Информация':'footer.info','О магазине':'footer.store','Все категории':'footer.allCategories','Шымкент · Казахстан':'footer.kz','Шымкент · Ежедневно 10:00–24:00':'footer.hours','SOTT — магазин мужской одежды в Шымкенте. Современные силуэты, спокойная палитра и вещи, которые легко собирать в цельный гардероб.':'about.text',
    'Мужская одежда SOTT':'catalog.title','Мужская одежда':'catalog.mens','SOTT · Каталог':'catalog.kicker','Выберите одежду, обувь и аксессуары SOTT.':'catalog.choose','Популярные':'catalog.popular','Фильтры':'filters','Закрыть фильтры':'filters.close','Категория':'category','Все категории':'category.all','Размер':'size','Все размеры':'size.all','Цена, ₸':'price','От':'from','До':'to','Только в наличии':'stock.only','Сортировать':'sort.label','По умолчанию':'sort.default','Сначала новинки':'sort.new','Цена: по возрастанию':'sort.priceAsc','Цена: по убыванию':'sort.priceDesc','По названию':'sort.name','Показать товары':'filters.show','Сбросить всё':'filters.resetAll','Сбросить фильтры':'filters.reset','Коллекция SOTT':'catalog.collection','Назад':'previous','Вперёд':'next','Все':'all',
    'В избранное':'product.favorite','В избранном':'product.favorited','Таблица размеров':'product.sizeGuide','Количество':'quantity','Добавить в корзину':'product.add','О товаре':'product.about','Товар не найден':'product.notFound','Возможно, ссылка устарела или товар был перемещён.':'product.notFoundText','Вернуться в каталог →':'product.backCatalog','Учебная таблица. Финальные замеры будут добавлены после уточнения ассортимента.':'size.note',
    'Ваш выбор':'cart.yourChoice','Ваш заказ':'cart.order','Товары':'goods','Итого':'total','Оформить заказ':'checkout.open','Оформление':'checkout','Контактные данные':'checkout.contacts','Магазин свяжется с вами в WhatsApp для подтверждения заказа.':'checkout.whatsapp','Имя':'name','Город':'city','Ваше имя':'name.placeholder','Ваш город':'city.placeholder','Создать заказ':'checkout.create','Ваша корзина пуста':'cart.empty','Добавьте товары из каталога':'cart.addCatalog','Перейти в каталог →':'catalog.go','Удалить':'remove',
    'Вернуться в магазин →':'order.back','Загружаем заказ…':'order.loading','Заказ SOTT':'order.title','Сохраните эту страницу — по ней магазин сможет быстро проверить состав заказа.':'order.save','Данные клиента':'order.client','Дата заказа':'order.date','Состав заказа':'order.items','Не удалось загрузить заказ':'order.loadError','Попробуйте обновить страницу чуть позже.':'order.retryLater','SOTT · заказ создан':'order.created','Спасибо! Заказ создан':'order.thanks','Для подтверждения отправьте сообщение магазину в WhatsApp. Оплату и доставку магазин согласует с вами напрямую.':'order.confirm','Написать в WhatsApp →':'order.whatsapp','Посмотреть заказ':'order.view','Ссылка заказа недоступна. Вернитесь в магазин и попробуйте снова.':'order.linkUnavailable','Заказ не найден':'order.notFound','Проверьте ссылку заказа или вернитесь в магазин.':'order.checkLink','Заказ временно недоступен':'order.unavailable','Попробуйте открыть эту страницу немного позже.':'order.openLater',
    'Страница не найдена':'page.notFound','Возможно, ссылка устарела. Вернитесь на главную или откройте каталог.':'page.notFoundText','На главную →':'page.home','В каталог':'page.catalog','Что-то пошло не так':'page.error',
  };

  function getLanguage() { try { return localStorage.getItem(STORAGE_KEY) === 'kk' ? 'kk' : 'ru'; } catch (_error) { return 'ru'; } }
  function t(key, params = {}) { let value = (dictionaries[getLanguage()] && dictionaries[getLanguage()][key]) || dictionaries.ru[key] || key; Object.entries(params).forEach(([name, replacement]) => { value = value.replaceAll(`{${name}}`, String(replacement)); }); return value; }
  function category(slug, fallback = '') { const key = `category.${String(slug || '').replace('outerwear', 'outerwear')}`; return dictionaries.ru[key] ? t(key) : fallback; }
  function translateText(value) { const clean = String(value || '').trim(); const key = phraseKeys[clean]; return key ? t(key) : null; }
  function translateDocument(root = document) {
    document.documentElement.lang = getLanguage() === 'kk' ? 'kk' : 'ru';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => { if (node.parentElement?.closest('script,style')) return; const translated = translateText(node.nodeValue); if (translated) node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), translated); });
    root.querySelectorAll?.('[placeholder],[aria-label],[title]').forEach((element) => ['placeholder','aria-label','title'].forEach((attribute) => { if (!element.hasAttribute(attribute)) return; const translated = translateText(element.getAttribute(attribute)); if (translated) element.setAttribute(attribute, translated); }));
    root.querySelectorAll?.('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
    root.querySelectorAll?.('[data-language]').forEach((button) => { const active = button.dataset.language === getLanguage(); button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
  }
  function setLanguage(language) { const safe = language === 'kk' ? 'kk' : 'ru'; try { localStorage.setItem(STORAGE_KEY, safe); } catch (_error) { /* language stays for this page only */ } window.location.reload(); }
  function installSwitcher() {
    const host = document.querySelector('.header-actions') || document.querySelector('.success-page');
    if (!host || host.querySelector('[data-language-switcher]')) return;
    const switcher = document.createElement('div'); switcher.className = 'language-switcher'; switcher.dataset.languageSwitcher = ''; switcher.setAttribute('aria-label', 'RU / KZ');
    ['ru','kk'].forEach((language) => { const button = document.createElement('button'); button.type = 'button'; button.dataset.language = language; button.textContent = language === 'ru' ? 'RU' : 'KZ'; button.addEventListener('click', () => setLanguage(language)); switcher.append(button); });
    if (host.classList.contains('header-actions')) host.prepend(switcher); else host.append(switcher);
  }
  window.SottI18n = Object.freeze({ t, category, getLanguage, translateDocument, setLanguage });
  window.addEventListener('DOMContentLoaded', () => { installSwitcher(); translateDocument(); });
}());
