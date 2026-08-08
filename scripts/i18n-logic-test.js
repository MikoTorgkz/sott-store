const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const values = new Map();
const localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
const window = { addEventListener() {}, location: { reload() {} } };
const context = { window, localStorage, document: {}, NodeFilter: { SHOW_TEXT: 4 }, console };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public/js/i18n.js'), 'utf8'), context);

assert.equal(window.SottI18n.getLanguage(), 'ru');
assert.equal(window.SottI18n.t('nav.home'), 'Главная');
window.SottI18n.setLanguage('kk');
assert.equal(window.SottI18n.getLanguage(), 'kk');
assert.equal(window.SottI18n.t('nav.home'), 'Басты бет');
assert.equal(window.SottI18n.category('shirts', 'Рубашки'), 'Жейделер');
assert.equal(window.SottI18n.category('unknown', 'Тест'), 'Тест');
assert.equal(values.get('sott_language'), 'kk');
console.log('I18n logic passed: RU default, KK persistence and slug-based category translation verified.');
