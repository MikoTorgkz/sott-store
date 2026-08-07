const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'server.js',
  'public/index.html',
  'public/product.html',
  'public/cart.html',
  'public/styles.css',
  'public/app.js',
  'public/js/products.js',
  'public/js/cart.js',
  'public/js/home.js',
  'public/js/product-page.js',
  'public/js/cart-page.js',
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

for (const file of ['server.js', 'public/app.js', 'public/js/products.js', 'public/js/cart.js', 'public/js/home.js', 'public/js/product-page.js', 'public/js/cart-page.js']) {
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
const localAssets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"#?]+)"/g)].map((match) => match[1]);
const missingAssets = localAssets.filter((asset) => !fs.existsSync(path.join(root, 'public', asset)));
if (missingAssets.length) {
  console.error(`Missing referenced assets:\n${missingAssets.join('\n')}`);
  process.exit(1);
}
const productData = fs.readFileSync(path.join(root, 'public/js/products.js'), 'utf8');
if ((productData.match(/slug:/g) || []).length !== 6) {
  console.error('Expected exactly 6 products in the single product data source');
  process.exit(1);
}
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
if (!serverSource.includes("app.get('/product/:slug'") || !serverSource.includes("app.get('/cart'")) {
  console.error('Product and cart routes are missing');
  process.exit(1);
}
if (!css.includes('@media') || !css.includes('overflow-x: hidden')) {
  console.error('Responsive CSS safeguards are missing');
  process.exit(1);
}

console.log(`Check passed: ${requiredFiles.length} files present, ${localAssets.length} page assets resolved, JavaScript syntax, menu markup and responsive CSS basics verified.`);
