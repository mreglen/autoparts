/**
 * Синхронно подставляет Open Graph для карточек товара до загрузки React.
 * Нужно валидаторам (Яндекс и др.), которые читают index.html без выполнения SPA.
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

  function writeMeta(property, content) {
    if (!content) return;
    document.write(
      '<meta property="' + property + '" content="' + escAttr(content) + '" />\n'
    );
  }

  function writeDefaultOg() {
    writeMeta('og:type', 'website');
    writeMeta('og:site_name', 'Свой Гараж');
    writeMeta('og:title', 'Свой Гараж — автозапчасти новые и б/у');
    writeMeta(
      'og:description',
      'Каталог запчастей, доставка по России, условия оплаты и общение с продавцами на одной платформе.'
    );
    writeMeta('og:url', SITE_ORIGIN + '/');
    writeMeta('og:locale', 'ru_RU');
    writeMeta('og:image', DEFAULT_OG_IMAGE);
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
    writeMeta('og:type', 'product');
    writeMeta('og:site_name', 'Свой Гараж');
    writeMeta('og:title', meta.title);
    writeMeta('og:description', meta.description);
    writeMeta('og:url', meta.canonical_url || SITE_ORIGIN + path);
    writeMeta('og:locale', 'ru_RU');
    writeMeta('og:image', meta.image_url || DEFAULT_OG_IMAGE);
    return;
  }

  writeDefaultOg();
})();
