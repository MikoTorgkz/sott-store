const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'server.js',
  'db.js',
  'orders.js',
  'admin-auth.js',
  'admin-orders.js',
  'catalog-seed.js',
  'catalog.js',
  'product-storage.js',
  'product-upload.js',
  'site-media.js',
  'scripts/product-upload-http-test.js',
  'scripts/site-media-logic-test.js',
  'scripts/i18n-logic-test.js',
  'scripts/hero-swipe-logic-test.js',
  'scripts/production-http-test.js',
  '.env.example',
  'admin/login.html',
  'admin/index.html',
  'admin/not-found.html',
  'public/index.html',
  'public/product.html',
  'public/cart.html',
  'public/catalog.html',
  'public/favorites.html',
  'public/order.html',
  'public/order-success.html',
  'public/order-not-found.html',
  'public/order-unavailable.html',
  'public/not-found.html',
  'public/error.html',
  'public/styles.css',
  'public/admin.css',
  'public/app.js',
  'public/js/products.js',
  'public/js/cart.js',
  'public/js/home.js',
  'public/js/catalog-page.js',
  'public/js/favorites.js',
  'public/js/favorites-page.js',
  'public/js/storefront-card.js',
  'public/js/product-page.js',
  'public/js/cart-page.js',
  'public/js/order-page.js',
  'public/js/order-success.js',
  'public/js/admin-login.js',
  'public/js/admin.js',
  'public/js/admin-products.js',
  'public/js/admin-media.js',
  'public/js/i18n.js',
  'public/js/site-media.js',
  'public/js/hero-swipe.js',
  'public/assets/product-placeholder.svg',
  'public/assets/sott-logo.jpg',
  'public/assets/hero-fashion.svg',
  'public/assets/season-fashion.svg',
  'public/assets/categories/shirts.svg',
  'public/assets/categories/trousers.svg',
  'public/assets/categories/outerwear.svg',
  'public/assets/categories/shoes.svg',
  'public/assets/categories/accessories.svg',
  'public/assets/products/polo.svg',
  'public/assets/products/shirt.svg',
  'public/assets/products/chinos.svg',
  'public/assets/products/bomber.svg',
  'public/assets/products/loafers.svg',
  'public/assets/products/jumper.svg',
  'public/assets/products/variants/polo-detail.svg',
  'public/assets/products/variants/shirt-detail.svg',
  'public/assets/products/variants/chinos-detail.svg',
  'public/assets/products/variants/bomber-detail.svg',
  'public/assets/products/variants/loafers-detail.svg',
  'public/assets/products/variants/jumper-detail.svg',
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing required files:\n${missing.join('\n')}`);
  process.exit(1);
}

for (const file of ['server.js', 'db.js', 'orders.js', 'admin-auth.js', 'admin-orders.js', 'catalog-seed.js', 'catalog.js', 'product-storage.js', 'product-upload.js', 'site-media.js', 'public/app.js', 'public/js/products.js', 'public/js/cart.js', 'public/js/home.js', 'public/js/catalog-page.js', 'public/js/favorites.js', 'public/js/favorites-page.js', 'public/js/storefront-card.js', 'public/js/product-page.js', 'public/js/cart-page.js', 'public/js/order-page.js', 'public/js/order-success.js', 'public/js/admin-login.js', 'public/js/admin.js', 'public/js/admin-products.js', 'public/js/admin-media.js', 'public/js/i18n.js', 'public/js/site-media.js', 'public/js/hero-swipe.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || `Syntax check failed: ${file}`);
    process.exit(result.status || 1);
  }
}

const cartLogic = spawnSync(process.execPath, [path.join(root, 'scripts/cart-logic-test.js')], { encoding: 'utf8' });
if (cartLogic.status !== 0) {
  console.error(cartLogic.stderr || cartLogic.stdout || 'Cart logic check failed');
  process.exit(cartLogic.status || 1);
}
process.stdout.write(cartLogic.stdout);

const orderLogic = spawnSync(process.execPath, [path.join(root, 'scripts/order-logic-test.js')], { encoding: 'utf8' });
if (orderLogic.status !== 0) {
  console.error(orderLogic.stderr || orderLogic.stdout || 'Order logic check failed');
  process.exit(orderLogic.status || 1);
}
process.stdout.write(orderLogic.stdout);

for (const testFile of ['scripts/catalog-logic-test.js', 'scripts/admin-logic-test.js', 'scripts/site-media-logic-test.js', 'scripts/i18n-logic-test.js', 'scripts/hero-swipe-logic-test.js', 'scripts/admin-http-test.js', 'scripts/product-upload-http-test.js', 'scripts/production-http-test.js']) {
  const adminCheck = spawnSync(process.execPath, [path.join(root, testFile)], { encoding: 'utf8' });
  if (adminCheck.status !== 0) {
    console.error(adminCheck.stderr || adminCheck.stdout || `Admin check failed: ${testFile}`);
    process.exit(adminCheck.status || 1);
  }
  process.stdout.write(adminCheck.stdout);
}

const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
if (!html.includes('styles.css') || !html.includes('app.js')) {
  console.error('index.html must reference styles.css and app.js');
  process.exit(1);
}
if (!html.includes('class="menu-toggle"') || !html.includes('id="main-nav"')) {
  console.error('Mobile menu controls are missing from index.html');
  process.exit(1);
}
if (html.includes('↗') || (html.match(/class="round-arrow" aria-hidden="true"><\/span>/g) || []).length !== 5) {
  console.error('Category cards must use five CSS arrows without Unicode emoji');
  process.exit(1);
}
if (!css.includes('.round-arrow::before') || !css.includes('.round-arrow::after')) {
  console.error('Category card CSS arrow is missing');
  process.exit(1);
}
if (!css.includes('.header-actions [data-search-toggle] { display: none; }') || !css.includes('.header-actions .favorite-header, .header-actions .cart-icon')) {
  console.error('Mobile header must hide search explicitly while keeping favorite and cart controls');
  process.exit(1);
}
if (!css.includes('pointer-events: none') || !css.includes('pointer-events: auto')) {
  console.error('Closed and open mobile navigation pointer-event states are missing');
  process.exit(1);
}
const localAssets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"#?]+)"/g)].map((match) => match[1]);
const missingAssets = localAssets.filter((asset) => !fs.existsSync(path.join(root, 'public', asset)));
if (missingAssets.length) {
  console.error(`Missing referenced assets:\n${missingAssets.join('\n')}`);
  process.exit(1);
}
const seedData = fs.readFileSync(path.join(root, 'catalog-seed.js'), 'utf8');
if ((seedData.match(/legacyId:/g) || []).length !== 6) {
  console.error('Expected exactly 6 bootstrap products in the catalog seed');
  process.exit(1);
}
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
if (!serverSource.includes("app.get('/product/:slug'") || !serverSource.includes("app.get('/cart'") || !serverSource.includes("app.get('/catalog'") || !serverSource.includes("app.get('/favorites'") || !serverSource.includes("app.post('/api/orders'") || !serverSource.includes("app.get('/order/:token'") || !serverSource.includes("app.get('/api/products'")) {
  console.error('Product, cart or order routes are missing');
  process.exit(1);
}
if (!serverSource.includes("express.json({ limit: '20kb' })")) {
  console.error('Order API JSON body limit is missing');
  process.exit(1);
}
if (!serverSource.includes("app.get('/admin'") || !serverSource.includes("app.patch('/api/admin/orders/:id/status'")) {
  console.error('Protected admin routes are missing');
  process.exit(1);
}
if (!serverSource.includes("app.get('/api/admin/products'") || !serverSource.includes("app.post('/api/admin/products'") || !serverSource.includes("uploadProductImages")) {
  console.error('Admin product CRUD/upload routes are missing');
  process.exit(1);
}
const dbSource = fs.readFileSync(path.join(root, 'db.js'), 'utf8');
if (!['categories', 'products', 'product_variants', 'product_images', 'site_media'].every((table) => dbSource.includes(`CREATE TABLE IF NOT EXISTS ${table}`))) {
  console.error('Catalog database tables are incomplete');
  process.exit(1);
}
if (/DROP\s+TABLE/i.test(dbSource)) {
  console.error('Database initialization must not drop tables');
  process.exit(1);
}
const adminCss = fs.readFileSync(path.join(root, 'public/admin.css'), 'utf8');
if (!adminCss.includes('@media (max-width: 760px)') || !adminCss.includes('overflow-x: hidden')) {
  console.error('Admin responsive safeguards are missing');
  process.exit(1);
}
if (!adminCss.includes('.admin-sidebar-backdrop[hidden]') || !adminCss.includes('display: none !important')) {
  console.error('Closed mobile admin backdrop must never intercept the page');
  process.exit(1);
}
const appSource = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
if (!css.includes('touch-action: pan-y') || !css.includes('-webkit-user-drag: none') || !appSource.includes("'touchmove'") || !appSource.includes('passive: false')) {
  console.error('Mobile hero swipe safeguards are missing');
  process.exit(1);
}
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
if (!/^\.env$/m.test(gitignore)) {
  console.error('.env must stay ignored');
  process.exit(1);
}
if (!css.includes('@media') || !css.includes('overflow-x: hidden')) {
  console.error('Responsive CSS safeguards are missing');
  process.exit(1);
}

console.log(`Check passed: ${requiredFiles.length} files present, ${localAssets.length} page assets resolved, JavaScript syntax, menu markup and responsive CSS basics verified.`);
