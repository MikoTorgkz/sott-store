(function () {
  async function init() {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) return showError();
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Order unavailable');
      const order = await response.json();
      const whatsapp = document.querySelector('[data-success-whatsapp]');
      if (order.whatsappUrl) whatsapp.href = order.whatsappUrl;
      else whatsapp.hidden = true;
      document.querySelector('[data-success-order]').href = order.orderUrl;
      document.querySelector('[data-success-content]').hidden = false;
    } catch (_error) { showError(); }
  }
  function showError() { document.querySelector('[data-success-error]').hidden = false; }
  window.addEventListener('DOMContentLoaded', init);
}());
