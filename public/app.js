const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
const navLinks = document.querySelectorAll('.main-nav a');

function closeMenu() {
  if (!menuButton || !nav) return;
  menuButton.setAttribute('aria-expanded', 'false');
  nav.classList.remove('is-open');
  document.body.classList.remove('menu-open');
}

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  nav.classList.toggle('is-open', !isOpen);
  document.body.classList.toggle('menu-open', !isOpen);
});

navLinks.forEach((link) => link.addEventListener('click', closeMenu));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 860) closeMenu();
});

function ensureSearchPanel() {
  let panel = document.querySelector('[data-header-search]');
  if (panel) return panel;
  panel = document.createElement('div'); panel.className = 'header-search-panel'; panel.dataset.headerSearch = '';
  const form = document.createElement('form'); form.action = '/catalog'; form.method = 'get'; form.className = 'header-search-form';
  const label = document.createElement('label'); label.textContent = 'Поиск'; label.setAttribute('for', 'header-search-input');
  const input = document.createElement('input'); input.id = 'header-search-input'; input.name = 'q'; input.type = 'search'; input.maxLength = 100; input.placeholder = 'Найти товар';
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'Найти';
  form.append(label, input, submit); panel.append(form); document.body.append(panel); return panel;
}

document.querySelectorAll('[data-search-toggle]').forEach((button) => button.addEventListener('click', () => {
  const panel = ensureSearchPanel(); const open = !panel.classList.contains('is-open'); panel.classList.toggle('is-open', open); button.setAttribute('aria-expanded', String(open)); if (open) panel.querySelector('input').focus();
}));
