import { buildCategoryNewKeywords } from '../../../utils/pageKeywords';
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

export function buildNewPartsCategorySeo({ landing, total = 0, items = [] }) {
  const category = landing?.title_ru || 'категория';
  const slug = landing?.slug || '';
  const canonicalPath = landing?.canonical_path || `/autoparts/new/category/${slug}`;
  const canonicalUrl = absoluteUrl(canonicalPath);

  const title =
    landing?.meta_title || `Новые ${category} — купить с доставкой | Свой Гараж`;
  const description =
    landing?.meta_description ||
    (total > 0
      ? `Каталог новых ${category.toLowerCase()}: ${total} позиций, цены, артикулы, аналоги. Доставка по России.`
      : `Каталог новых ${category.toLowerCase()}: цены, артикулы, аналоги. Доставка по России.`);

  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Новые ${category}`,
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
            name: `Каталог ${category}`,
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
    h1: `Новые ${category} — каталог с доставкой`,
    keywords: buildCategoryNewKeywords({
      titleRu: category,
      searchQuery: landing?.search_query,
    }),
    jsonLd,
  };
}
