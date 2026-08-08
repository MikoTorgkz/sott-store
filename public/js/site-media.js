(function () {
  async function apply() {
    try {
      const response = await fetch('/api/site-media', { headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const data = await response.json(); const media = data && data.media ? data.media : {};
      document.querySelectorAll('img[src="/assets/sott-logo.jpg"], img[data-site-media]').forEach((image) => {
        const key = image.dataset.siteMedia || 'brand_logo'; const url = media[key]; if (typeof url === 'string' && url.startsWith('/')) image.src = url;
      });
    } catch (_error) { /* Built-in assets remain visible as a safe fallback. */ }
  }
  window.SottSiteMedia = { apply };
  window.addEventListener('DOMContentLoaded', apply);
}());
