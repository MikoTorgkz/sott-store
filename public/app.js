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
  if (!isOpen) window.dispatchEvent(new CustomEvent('sott:overlay-open', { detail: { type: 'menu' } }));
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  nav.classList.toggle('is-open', !isOpen);
  document.body.classList.toggle('menu-open', !isOpen);
});

window.addEventListener('sott:overlay-open', (event) => { if (event.detail?.type !== 'menu') closeMenu(); });

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
  const panel = ensureSearchPanel(); const open = !panel.classList.contains('is-open'); if (open) window.dispatchEvent(new CustomEvent('sott:overlay-open', { detail: { type: 'search' } })); panel.classList.toggle('is-open', open); button.setAttribute('aria-expanded', String(open)); if (open) panel.querySelector('input').focus();
}));

window.addEventListener('sott:overlay-open', (event) => {
  if (event.detail?.type === 'search') return;
  const panel = document.querySelector('[data-header-search]');
  panel?.classList.remove('is-open');
  document.querySelectorAll('[data-search-toggle]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
});

const heroCarousel = document.querySelector('[data-hero-carousel]');
if (heroCarousel) {
  const track = heroCarousel.querySelector('[data-hero-track]');
  const slides = [...track.children];
  const dots = [...heroCarousel.querySelectorAll('[data-hero-dot]')];
  let currentSlide = 0;
  let touchStartX = null;

  function showHeroSlide(index) {
    currentSlide = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    dots.forEach((dot, dotIndex) => {
      const active = dotIndex === currentSlide;
      dot.classList.toggle('active', active);
      if (active) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current');
    });
  }

  heroCarousel.querySelector('[data-hero-prev]').addEventListener('click', () => showHeroSlide(currentSlide - 1));
  heroCarousel.querySelector('[data-hero-next]').addEventListener('click', () => showHeroSlide(currentSlide + 1));
  dots.forEach((dot) => dot.addEventListener('click', () => showHeroSlide(Number(dot.dataset.heroDot))));
  heroCarousel.addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
  heroCarousel.addEventListener('touchend', (event) => {
    if (touchStartX === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    if (Math.abs(distance) > 45) showHeroSlide(currentSlide + (distance < 0 ? 1 : -1));
    touchStartX = null;
  }, { passive: true });
  heroCarousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') showHeroSlide(currentSlide - 1);
    if (event.key === 'ArrowRight') showHeroSlide(currentSlide + 1);
  });
}
