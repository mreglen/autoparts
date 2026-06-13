import { stripHtmlTags } from './text';
import { buildPartDetailPath } from './partRoutes';
import { formatProductDisplayTitle, extractProductDescription } from './productDisplayName';
import { normalizeImageUrl } from './apiClient';
import { resolveOgImageUrl } from './seoConstants';
import { SITE_ORIGIN } from './breadcrumbs';
import {
  buildProductSearchDescription,
  buildProductSearchTitle,
  formatCityInPrepositional,
  resolveProductCity,
} from './productSearchSeo';
import { buildCatalogProductJsonLd, productBodyDescription } from './productJsonLd';
import { buildProductUsedKeywords } from './pageKeywords';
import { DEFAULT_CITY } from './organizationCity';

function formatPriceRub(price) {
  if (price == null || price === '') return null;
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount.toLocaleString('ru-RU');
}

export function buildProductUsedCatalogPath({ brand, article } = {}) {
  const brandText = String(brand || '').trim();
  const articleText = String(article || '').trim();
  const query = brandText && articleText ? `${brandText} ${articleText}` : articleText || brandText;
  if (!query) return '/autoparts/used';
  return `/autoparts/used?q=${encodeURIComponent(query)}`;
}

export function buildProductPhotoAlt({ brand, article, name, index = 0, isMain = false } = {}) {
  const brandText = String(brand || '').trim();
  const articleText = String(article || '').trim();
  const label = [brandText, articleText].filter(Boolean).join(' ')
    || String(name || '').trim()
    || 'автозапчасть';
  if (isMain) return `Б/у ${label} — основное фото`;
  return `Б/у ${label} — фото ${index + 1}`;
}

export function buildProductSeoSummary({
  brand,
  article,
  name,
  isNew = false,
  city,
  price,
  inStock = true,
  shortName,
  uniqueDescription,
} = {}) {
  const brandText = String(brand || '').trim();
  const articleText = String(article || '').trim();
  const condition = isNew ? 'Новая' : 'Б/у';
  const cityPrep = formatCityInPrepositional(city || DEFAULT_CITY);
  const label = [brandText, articleText].filter(Boolean).join(' ')
    || String(name || '').trim()
    || 'автозапчасть';
  const stock = inStock ? 'в наличии' : 'доступна';
  const priceText = formatPriceRub(price);
  const pricePart = priceText ? ` Цена ${priceText} ₽.` : '';
  const snippet = String(shortName || uniqueDescription || '').replace(/\s+/g, ' ').trim();
  const detail = snippet.length >= 12 ? ` ${snippet.endsWith('.') ? snippet : `${snippet}.`}` : '';
  return `${condition} автозапчасть ${label} ${stock} в ${cityPrep}.${pricePart}${detail}`.replace(/\s+/g, ' ').trim();
}

export function buildProductStructuredDataGraph({
  productJsonLd,
  breadcrumbJsonLd,
  canonicalUrl,
  title,
  description,
} = {}) {
  const graph = [];
  if (productJsonLd) {
    const productNode = { ...productJsonLd };
    delete productNode['@context'];
    if (canonicalUrl) productNode['@id'] = `${canonicalUrl}#product`;
    graph.push(productNode);
  }
  if (breadcrumbJsonLd) {
    const breadcrumbNode = { ...breadcrumbJsonLd };
    delete breadcrumbNode['@context'];
    if (canonicalUrl) breadcrumbNode['@id'] = `${canonicalUrl}#breadcrumb`;
    graph.push(breadcrumbNode);
  }
  if (productJsonLd && canonicalUrl) {
    graph.push({
      '@type': 'WebPage',
      '@id': `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: title,
      description,
      isPartOf: { '@type': 'WebSite', name: 'Свой Гараж', url: SITE_ORIGIN },
      breadcrumb: { '@id': `${canonicalUrl}#breadcrumb` },
      mainEntity: { '@id': `${canonicalUrl}#product` },
    });
  }
  if (!graph.length) return null;
  return { '@context': 'https://schema.org', '@graph': graph };
}

export function buildProductSeo(product) {
  const brand = (product?.brand || '').trim();
  const article = (product?.article || '').trim();
  const name = formatProductDisplayTitle(brand, article, product?.name) || 'Автозапчасть';
  const shortName = extractProductDescription(product?.name, brand, article);
  const path = buildPartDetailPath(product);
  const canonicalUrl = `${SITE_ORIGIN}${path}`;
  const organization = product?.organization || null;
  const sellerName = organization?.name || null;
  const listingId = product?.id != null ? Number(product.id) : null;
  const title = buildProductSearchTitle({
    brand,
    article,
    productName: product?.name,
    sellerName,
    listingId,
  });
  const city = resolveProductCity(organization);
  const inStock = (product?.quantity || 0) > 0;

  const uniqueDesc = stripHtmlTags(product?.description || '').replace(/\s+/g, ' ').trim();
  const description = buildProductSearchDescription({
    brand,
    article,
    isNew: Boolean(product?.is_new),
    city,
    price: product?.price,
    inStock,
    shortName,
    uniqueDescription: uniqueDesc,
    sellerName,
    listingId,
  });

  const firstPhoto = product?.photos?.[0]?.photo_url;
  const imageUrl = resolveOgImageUrl(firstPhoto ? normalizeImageUrl(firstPhoto) : null);
  const jsonLd = buildCatalogProductJsonLd(product, { canonicalUrl });
  const ogImageAlt = buildProductPhotoAlt({ brand, article, name, isMain: true });
  const seoSummary = buildProductSeoSummary({
    brand,
    article,
    name,
    isNew: Boolean(product?.is_new),
    city,
    price: product?.price,
    inStock,
    shortName,
    uniqueDescription: uniqueDesc,
  });
  const bodyDescription = productBodyDescription({
    brand,
    article,
    name,
    uniqueDescription: uniqueDesc,
    shortName,
    isNew: Boolean(product?.is_new),
  });

  return {
    title,
    description,
    canonicalUrl,
    imageUrl,
    ogImageAlt,
    jsonLd,
    robots: 'index, follow',
    keywords: buildProductUsedKeywords({ brand, article, city }),
    seoSummary,
    bodyDescription,
    usedCatalogPath: buildProductUsedCatalogPath({ brand, article }),
  };
}

export function seoFromPartMetaResponse(meta) {
  if (!meta?.title || !meta?.description || !meta?.canonical_url) return null;
  return {
    title: meta.title,
    description: meta.description,
    canonicalUrl: meta.canonical_url,
    imageUrl: meta.image_url || resolveOgImageUrl(null),
    robots: 'index, follow',
    keywords: meta.keywords || '',
    seoSummary: meta.seo_summary || '',
    bodyDescription: meta.body_description || '',
    usedCatalogPath: meta.used_catalog_path || '',
  };
}
