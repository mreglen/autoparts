import { SITE_ORIGIN } from '../../../utils/breadcrumbs';
import { formatProductDisplayTitle } from '../../../utils/productDisplayName';

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

export function buildNewPartsBrandSeo({ landing, total = 0, items = [] }) {
  const brand = landing?.brand_name || landing?.title_ru || 'бренд';
  const slug = landing?.slug || '';
  const canonicalPath = landing?.canonical_path || `/autoparts/new/brand/${slug}`;
  const canonicalUrl = absoluteUrl(canonicalPath);

  const title =
    landing?.meta_title || `Новые запчасти ${brand} — каталог с доставкой | Свой Гараж`;
  const description =
    landing?.meta_description ||
    (total > 0
      ? `Купить новые автозапчасти ${brand}: ${total} позиций в каталоге, артикулы, цены, доставка по России.`
      : `Купить новые автозапчасти ${brand}: каталог артикулов, цены, доставка по России.`);

  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Новые автозапчасти ${brand}`,
    description: truncate(description, 300),
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Свой Гараж',
      url: SITE_ORIGIN,
    },
  };

  const itemListElement = (items || []).slice(0, 48).map((card, index) => {
    const name = formatProductDisplayTitle(card.brand, card.article, card.name);
    const itemUrl = card.canonical_url?.startsWith('http')
      ? card.canonical_url
      : absoluteUrl(card.canonical_url || `/autoparts/new/part/${card.id}`);
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
            name: `Каталог ${brand}`,
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
    h1: `Новые автозапчасти ${brand}`,
    jsonLd,
  };
}
