(function () {
  function formatPrice(value) {
    return `${new Intl.NumberFormat('ru-RU').format(Number(value) || 0)} ₸`;
  }
  const catalog = Object.freeze({ formatPrice });
  if (typeof window !== 'undefined') window.SottCatalog = catalog;
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
}());
