/**
 * Синхронно подставляет Open Graph и JSON-LD для карточек товара до загрузки React.
 * Нужно валидаторам (Яндекс.Вебмастер и др.), которые читают разметку до гидратации SPA.
 */
(function () {
  var SITE_ORIGIN = 'https://svoygarage.ru';
  var DEFAULT_OG_IMAGE = SITE_ORIGIN + '/favicons/apple-touch-icon.png';

  function escAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function appendMeta(property, content) {
    if (!content) return;
    var el = document.createElement('meta');
    el.setAttribute('property', property);
    el.setAttribute('content', String(content));
    document.head.appendChild(el);
  }

  function setDocumentTitle(title) {
    if (!title) return;
    document.title = String(title);
  }

  function setMetaDescription(content) {
    if (!content) return;
    var el = document.querySelector('meta[name="description"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'description');
      document.head.appendChild(el);
    }
    el.setAttribute('content', String(content));
  }

  function setCanonical(url) {
    if (!url) return;
    var el = document.querySelector('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      document.head.appendChild(el);
    }
    el.setAttribute('href', String(url));
  }
  function appendJsonLd(jsonLd) {
    if (!jsonLd) return;
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = String(jsonLd);
    document.head.appendChild(script);
  }

  function writeDefaultOg() {
    appendMeta('og:type', 'website');
    appendMeta('og:site_name', 'Свой Гараж');
    appendMeta('og:title', 'Свой Гараж — автозапчасти новые и б/у');
    appendMeta(
      'og:description',
      'Каталог запчастей, доставка по России, условия оплаты и общение с продавцами на одной платформе.'
    );
    appendMeta('og:url', SITE_ORIGIN + '/');
    appendMeta('og:locale', 'ru_RU');
    appendMeta('og:image', DEFAULT_OG_IMAGE);
  }

  function apiBase() {
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return '/api';
    }
    return '/server/api';
  }

  function fetchProductMeta(path) {
    var partMatch = path.match(/^\/part\/(\d+)/);
    var newPartMatch = path.match(/^\/autoparts\/new\/part\/(\d+)/);
    if (!partMatch && !newPartMatch) {
      return null;
    }
    var endpoint = partMatch
      ? apiBase() + '/public/part-meta'
      : apiBase() + '/public/new-part-meta';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', endpoint + '?path=' + encodeURIComponent(path), false);
    xhr.send(null);
    if (xhr.status !== 200) {
      return null;
    }
    try {
      return JSON.parse(xhr.responseText);
    } catch (e) {
      return null;
    }
  }

  var path = window.location.pathname;
  var meta = fetchProductMeta(path);

  if (meta) {
    setDocumentTitle(meta.title);
    setMetaDescription(meta.description);
    setCanonical(meta.canonical_url || SITE_ORIGIN + path);
    appendMeta('og:type', 'product');
    appendMeta('og:site_name', 'Свой Гараж');
    appendMeta('og:title', meta.title);
    appendMeta('og:description', meta.description);
    appendMeta('og:url', meta.canonical_url || SITE_ORIGIN + path);
    appendMeta('og:locale', 'ru_RU');
    appendMeta('og:image', meta.image_url || DEFAULT_OG_IMAGE);
    if (meta.price) {
      appendMeta('product:price:amount', meta.price);
      appendMeta('product:price:currency', 'RUB');
    }
    if (meta.json_ld) {
      appendJsonLd(meta.json_ld);
    }
    return;
  }

  writeDefaultOg();
})();
