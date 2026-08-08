const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
const navLinks = document.querySelectorAll('.main-nav a');
const t = (key, params) => window.SottI18n ? window.SottI18n.t(key, params) : key;

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
  const label = document.createElement('label'); label.textContent = t('search'); label.setAttribute('for', 'header-search-input');
  const input = document.createElement('input'); input.id = 'header-search-input'; input.name = 'q'; input.type = 'search'; input.maxLength = 100; input.placeholder = t('search.placeholder');
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = t('search.submit');
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
  const swipe = window.SottHeroSwipe;
  let currentSlide = 0;
  let gesture = null;
  let suppressClickUntil = 0;

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

  function resetDrag() {
    track.style.transition = '';
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
  }

  function cancelGesture() {
    gesture = null;
    resetDrag();
  }

  heroCarousel.addEventListener('touchstart', (event) => {
    if (!swipe || event.touches.length !== 1) return cancelGesture();
    const touch = event.touches[0];
    gesture = { startX: touch.clientX, startY: touch.clientY, currentX: touch.clientX, currentY: touch.clientY, axis: null };
  }, { passive: true });

  heroCarousel.addEventListener('touchmove', (event) => {
    if (!gesture || event.touches.length !== 1) return;
    const touch = event.touches[0];
    gesture.currentX = touch.clientX;
    gesture.currentY = touch.clientY;
    const deltaX = gesture.currentX - gesture.startX;
    const deltaY = gesture.currentY - gesture.startY;
    if (!gesture.axis) gesture.axis = swipe.getGestureAxis(deltaX, deltaY);
    if (gesture.axis !== 'horizontal') return;

    event.preventDefault();
    let visualDelta = deltaX;
    const atFirst = currentSlide === 0 && deltaX > 0;
    const atLast = currentSlide === slides.length - 1 && deltaX < 0;
    if (atFirst || atLast) visualDelta *= 0.25;
    track.style.transition = 'none';
    track.style.transform = `translateX(calc(-${currentSlide * 100}% + ${visualDelta}px))`;
  }, { passive: false });

  heroCarousel.addEventListener('touchend', (event) => {
    if (!gesture || !swipe) return cancelGesture();
    const touch = event.changedTouches[0];
    if (touch) {
      gesture.currentX = touch.clientX;
      gesture.currentY = touch.clientY;
    }
    const deltaX = gesture.currentX - gesture.startX;
    const deltaY = gesture.currentY - gesture.startY;
    const wasHorizontal = gesture.axis === 'horizontal';
    const direction = swipe.getSwipeDirection(deltaX, deltaY);
    gesture = null;
    track.style.transition = '';

    if (wasHorizontal && direction !== 0) {
      suppressClickUntil = Date.now() + 450;
      const nextSlide = Math.max(0, Math.min(slides.length - 1, currentSlide + direction));
      showHeroSlide(nextSlide);
    } else {
      resetDrag();
    }
  }, { passive: true });

  heroCarousel.addEventListener('touchcancel', cancelGesture, { passive: true });
  heroCarousel.addEventListener('dragstart', (event) => {
    if (event.target.closest('img')) event.preventDefault();
  });
  heroCarousel.addEventListener('click', (event) => {
    if (Date.now() >= suppressClickUntil) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  heroCarousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') showHeroSlide(currentSlide - 1);
    if (event.key === 'ArrowRight') showHeroSlide(currentSlide + 1);
  });
}
