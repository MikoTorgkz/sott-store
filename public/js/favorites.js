(function (root) {
  const KEY = 'sott_favorites_v1';
  function read() {
    try { const value = JSON.parse(root.localStorage.getItem(KEY) || '[]'); return [...new Set(Array.isArray(value) ? value.map(String).filter((id) => /^\d+$/.test(id)).slice(0, 100) : [])]; } catch (_error) { return []; }
  }
  function write(ids) { root.localStorage.setItem(KEY, JSON.stringify(ids)); updateBadges(ids); root.dispatchEvent(new CustomEvent('sott:favorites-change', { detail: { ids } })); return ids; }
  function updateBadges(ids = read()) { if (typeof document === 'undefined') return; document.querySelectorAll('[data-favorites-badge]').forEach((badge) => { badge.textContent = String(ids.length); badge.hidden = ids.length === 0; }); }
  function toggle(id) { const key = String(id); const ids = read(); const next = ids.includes(key) ? ids.filter((item) => item !== key) : [...ids, key].slice(-100); write(next); return next.includes(key); }
  function replace(ids) { return write([...new Set(ids.map(String).filter((id) => /^\d+$/.test(id)))].slice(0, 100)); }
  const api = { read, toggle, replace, has: (id) => read().includes(String(id)), count: () => read().length, updateBadges };
  root.SottFavorites = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => updateBadges());
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
