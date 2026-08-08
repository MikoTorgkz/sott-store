(function () {
  const fallback = '/assets/product-placeholder.svg';
  const t = (key) => window.SottI18n ? window.SottI18n.t(key) : key;
  function heartIcon() { const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true'); const path=document.createElementNS(svg.namespaceURI,'path'); path.setAttribute('d','M20.5 5.7c-1.9-2-5-1.8-6.8.1L12 7.6l-1.7-1.8c-1.8-1.9-4.9-2.1-6.8-.1-1.7 1.9-1.5 4.8.3 6.6L12 20.5l8.2-8.2c1.8-1.8 2-4.7.3-6.6Z'); svg.append(path); return svg; }
  function syncHeart(button, product) { const active=window.SottFavorites?.has(product.id); button.classList.toggle('is-active', Boolean(active)); button.setAttribute('aria-pressed', String(Boolean(active))); button.setAttribute('aria-label', `${active ? 'Удалить' : 'Добавить'} ${product.name} ${active ? 'из' : 'в'} избранного`); }
  function create(product) {
    const article=document.createElement('article'); article.className='product-card catalog-product-card'; article.dataset.productId=product.id;
    const media=document.createElement('div'); media.className='product-image';
    const link=document.createElement('a'); link.className='product-image-link'; link.href=`/product/${encodeURIComponent(product.slug)}`; link.setAttribute('aria-label',`Открыть ${product.name}`);
    const image=document.createElement('img'); image.src=product.mainImage||fallback; image.alt=product.name; image.loading='lazy'; image.width=480; image.height=600; image.addEventListener('error',()=>{ if(image.src.endsWith(fallback)) return; image.src=fallback; }); link.append(image);
    const heart=document.createElement('button'); heart.type='button'; heart.className='heart-button favorite-button'; heart.append(heartIcon()); syncHeart(heart,product); heart.addEventListener('click',()=>{ window.SottFavorites.toggle(product.id); syncHeart(heart,product); });
    const badges=document.createElement('div'); badges.className='product-badges'; if(product.isNew){const b=document.createElement('span'); b.textContent=t('new'); badges.append(b);} if(product.inStock===false){const b=document.createElement('span'); b.className='sold-out'; b.textContent=t('outOfStock'); badges.append(b);} media.append(link,badges,heart);
    const details=document.createElement('div'); details.className='product-details'; const category=document.createElement('small'); category.className='catalog-card-category'; category.textContent=window.SottI18n?.category(product.categorySlug,product.category)||product.category||'';
    const title=document.createElement('h3'); const titleLink=document.createElement('a'); titleLink.href=link.href; titleLink.textContent=product.name; title.append(titleLink); const price=document.createElement('strong'); price.textContent=window.SottCatalog.formatPrice(product.price);
    const more=document.createElement('a'); more.className='add-button choose-size-button'; more.href=link.href; more.textContent=product.inStock===false?t('details'):t('chooseSize'); details.append(category,title,price,more); article.append(media,details); return article;
  }
  window.SottStorefrontCard={create};
}());
