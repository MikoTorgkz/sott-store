const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'server.js',
  'public/index.html',
  'public/styles.css',
  'public/app.js',
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
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing required files:\n${missing.join('\n')}`);
  process.exit(1);
}

for (const file of ['server.js', 'public/app.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stderr || `Syntax check failed: ${file}`);
    process.exit(result.status || 1);
  }
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
const localAssets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"#?]+)"/g)].map((match) => match[1]);
const missingAssets = localAssets.filter((asset) => !fs.existsSync(path.join(root, 'public', asset)));
if (missingAssets.length) {
  console.error(`Missing referenced assets:\n${missingAssets.join('\n')}`);
  process.exit(1);
}
if (!css.includes('@media') || !css.includes('overflow-x: hidden')) {
  console.error('Responsive CSS safeguards are missing');
  process.exit(1);
}

console.log(`Check passed: ${requiredFiles.length} files present, ${localAssets.length} page assets resolved, JavaScript syntax, menu markup and responsive CSS basics verified.`);
