import { Helmet } from 'react-helmet-async';
import { SITE_ORIGIN } from './breadcrumbs';
import { DEFAULT_OG_IMAGE_URL } from './seoConstants';
import { formatProductDisplayTitle } from './productDisplayName';
import { buildPartDetailPath } from './partRoutes';

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

function hasListingSearchFilters(searchParams) {
  if (!searchParams) return false;
  if ((searchParams.get('q') || '').trim()) return true;
  if ((searchParams.getAll('brand') || []).length > 0) return true;
  if (searchParams.get('in_stock') === '1') return true;
  if ((searchParams.get('sort') || '').trim()) return true;
  return false;
}

export function buildHomeSeo() {
  return {
    title: 'Свой Гараж — автозапчасти новые и б/у',
    description:
      'Маркетплейс автозапчастей «Свой Гараж»: поиск по артикулу и бренду, новые и б/у детали, доставка по России.',
    canonicalUrl: absoluteUrl('/'),
    robots: 'index, follow',
  };
}

export function buildCatalogSeo() {
  return {
    title: 'Каталог автозапчастей — новые и б/у | Свой Гараж',
    description:
      'Каталог «Свой Гараж»: новые запчасти от поставщиков и б/у от продавцов. Поиск по артикулу, бренду и названию.',
    canonicalUrl: absoluteUrl('/catalog'),
    robots: 'index, follow',
  };
}

export function buildNewPartsSeo(searchParams) {
  const q = (searchParams?.get('q') || '').trim();
  const brands = searchParams?.getAll('brand') || [];
  const inStock = searchParams?.get('in_stock') === '1';
  const hasFilters = hasListingSearchFilters(searchParams);

  if (hasFilters) {
    const titleSuffixParts = [];
    if (brands.length > 0) {
      titleSuffixParts.push(`бренд: ${brands.slice(0, 2).join(', ')}`);
    }
    if (inStock) {
      titleSuffixParts.push('в наличии');
    }
    const titleSuffix = titleSuffixParts.length ? ` (${titleSuffixParts.join('; ')})` : '';
    const queryLabel = q || 'фильтр';
    return {
      title: `${queryLabel}${titleSuffix} — новые запчасти | Свой Гараж`,
      description: truncate(
        `Результаты поиска новых автозапчастей по запросу «${queryLabel}»: оригиналы и аналоги с доставкой по России.`,
        160
      ),
      canonicalUrl: absoluteUrl('/autoparts/new'),
      robots: 'noindex, follow',
    };
  }

  return {
    title: 'Новые автозапчасти с доставкой | Свой Гараж',
    description:
      'Новые автозапчасти от поставщиков: поиск по артикулу и бренду, аналоги, сроки поставки и наличие на складах.',
    canonicalUrl: absoluteUrl('/autoparts/new'),
    robots: 'index, follow',
  };
}

export function buildUsedPartsSeo(searchParams) {
  const q = (searchParams?.get('q') || '').trim();
  const brands = searchParams?.getAll('brand') || [];
  const hasFilters = hasListingSearchFilters(searchParams);

  if (hasFilters) {
    const titleSuffix = brands.length ? ` (бренд: ${brands.slice(0, 2).join(', ')})` : '';
    const queryLabel = q || 'фильтр';
    return {
      title: `${queryLabel}${titleSuffix} — б/у запчасти | Свой Гараж`,
      description: truncate(
        `Результаты поиска б/у автозапчастей по запросу «${queryLabel}»: фото, описание и чат с продавцом.`,
        160
      ),
      canonicalUrl: absoluteUrl('/autoparts/used'),
      robots: 'noindex, follow',
    };
  }

  return {
    title: 'Б/у автозапчасти — каталог продавцов | Свой Гараж',
    description:
      'Каталог б/у автозапчастей от продавцов на «Свой Гараж»: разборки и магазины, фото, описание и общение с продавцом.',
    canonicalUrl: absoluteUrl('/autoparts/used'),
    robots: 'index, follow',
  };
}

export function buildAutoPartsSeo(pathname, searchParams) {
  if (pathname.includes('/autoparts/used')) {
    return buildUsedPartsSeo(searchParams);
  }
  return buildNewPartsSeo(searchParams);
}

export function buildAboutSeo() {
  return {
    title: 'О компании — Свой Гараж',
    description:
      'ООО «Кроан» — оператор маркетплейса «Свой Гараж» в Екатеринбурге. Автозапчасти новые и б/у, доставка по России.',
    canonicalUrl: absoluteUrl('/about'),
    robots: 'index, follow',
  };
}

export function buildDeliverySeo() {
  return {
    title: 'Доставка автозапчастей — условия и регионы | Свой Гараж',
    description:
      'Условия доставки «Свой Гараж»: самовывоз и ПВЗ, регионы доставки, минимальная сумма и службы доставки.',
    canonicalUrl: absoluteUrl('/delivery'),
    robots: 'index, follow',
  };
}

export function buildSellerPartCardSeo(part) {
  const name = formatProductDisplayTitle(part?.brand, part?.article, part?.name);
  const path = buildPartDetailPath(part);
  const canonical = path.startsWith('http') ? path : absoluteUrl(path);
  const listingId = part?.id != null ? Number(part.id) : null;
  return {
    title: `${name} — карточка | Свой Гараж`,
    description: truncate(
      `${part?.is_new ? 'Новая' : 'Б/у'} автозапчасть ${name}. Карточка товара на «Свой Гараж».${listingId ? ` Объявление №${listingId}.` : ''}`,
      160
    ),
    canonicalUrl: canonical,
    robots: 'noindex, follow',
  };
}

export function PageSeoHelmet({ seo }) {
  if (!seo) return null;
  return (
    <Helmet>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <meta name="robots" content={seo.robots || 'index, follow'} />
      <link rel="canonical" href={seo.canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Свой Гараж" />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:url" content={seo.canonicalUrl} />
      <meta property="og:locale" content="ru_RU" />
      <meta property="og:image" content={DEFAULT_OG_IMAGE_URL} />
    </Helmet>
  );
}
