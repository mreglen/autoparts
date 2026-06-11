import { SITE_ORIGIN } from '../../../utils/breadcrumbs';
import { formatProductDisplayTitle } from '../../../utils/productDisplayName';
import { buildPartDetailPath } from '../../../utils/partRoutes';

function absoluteUrl(path) {
  if (!path || path === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

function truncate(text, maxLen) {
  const value = (text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1).trim()}…`;
}

export function buildUsedPartsBrandSeo({ landing, total = 0, items = [] }) {
  const brand = landing?.brand_name || landing?.title_ru || 'бренд';
  const slug = landing?.slug || '';
  const canonicalPath = landing?.canonical_path || `/autoparts/used/brand/${slug}`;
  const canonicalUrl = absoluteUrl(canonicalPath);

  const title =
    landing?.meta_title || `Б/у запчасти ${brand} — каталог продавцов | Свой Гараж`;
  const description =
    landing?.meta_description ||
    (total > 0
      ? `${total} б/у автозапчастей ${brand} от продавцов на «Свой Гараж»: фото, цены, чат с продавцом. Екатеринбург и доставка по России.`
      : `Купить б/у автозапчасти ${brand}: объявления продавцов, цены, доставка.`);

  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Б/у автозапчасти ${brand}`,
    description: truncate(description, 300),
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Свой Гараж',
      url: SITE_ORIGIN,
    },
  };

  const itemListElement = (items || []).slice(0, 48).map((product, index) => {
    const name = formatProductDisplayTitle(product.brand, product.article, product.name);
    const path = buildPartDetailPath(product);
    const itemUrl = path.startsWith('http') ? path : absoluteUrl(path);
    return {
      '@type': 'ListItem',
      position: index + 1,
      url: itemUrl,
      name,
    };
  });

  const jsonLd =
    itemListElement.length > 0
      ? [
          collectionPage,
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `Каталог б/у ${brand}`,
            numberOfItems: total || itemListElement.length,
            itemListElement,
          },
        ]
      : [collectionPage];

  return {
    title,
    description: truncate(description, 160),
    canonicalUrl,
    robots: 'index, follow',
    h1: `Б/у автозапчасти ${brand}`,
    jsonLd,
  };
}
