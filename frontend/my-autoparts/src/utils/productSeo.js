import { stripHtmlTags } from './text';
import { buildPartDetailPath } from './partRoutes';
import { formatProductDisplayTitle, extractProductDescription } from './productDisplayName';
import { normalizeImageUrl } from './apiClient';
import { resolveOgImageUrl } from './seoConstants';
import { SITE_ORIGIN, buildBreadcrumbJsonLd, buildBreadcrumbsForPath } from './breadcrumbs';
import {
  buildProductSearchDescription,
  buildProductSearchTitle,
  buildProductPageH1,
  productSchemaNameFromTitle,
  formatCityInPrepositional,
  resolveProductCity,
} from './productSearchSeo';
import { buildCatalogProductJsonLd, productBodyDescription } from './productJsonLd';
import { buildProductUsedKeywords } from './pageKeywords';
import { DEFAULT_CITY } from './organizationCity';
import { buildProductFaqJsonLd } from './partDetailFaq';

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
  fitmentText,
  quantity,
  sellerName,
  stockSummary,
} = {}) {
  const brandText = String(brand || '').trim();
  const articleText = String(article || '').trim();
  const condition = isNew ? 'Новая' : 'Б/у';
  const cityPrep = formatCityInPrepositional(city || DEFAULT_CITY);
  const label = [brandText, articleText].filter(Boolean).join(' ')
    || String(name || '').trim()
    || 'автозапчасть';
  let qty = null;
  if (quantity != null && quantity !== '') {
    const parsed = Number(quantity);
    if (Number.isFinite(parsed)) qty = Math.max(0, Math.trunc(parsed));
  }
  let stock = 'сейчас недоступна';
  if (inStock && qty && qty > 1) stock = `в наличии (${qty} шт.)`;
  else if (inStock) stock = 'в наличии';
  const priceText = formatPriceRub(price);
  const pricePart = priceText ? ` Цена ${priceText} ₽.` : '';
  const seller = String(sellerName || '').trim();
  const sellerPart = seller ? ` Продавец: ${seller}.` : '';
  const stockExtra = String(stockSummary || '').replace(/\s+/g, ' ').trim();
  const stockPart = stockExtra && !stock.toLowerCase().includes(stockExtra.toLowerCase().slice(0, 20))
    ? ` ${stockExtra.endsWith('.') ? stockExtra : `${stockExtra}.`}`
    : '';
  const fitment = String(fitmentText || '').replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  const fitmentPart = fitment
    ? ` Подходит для: ${fitment.length > 70 ? `${fitment.slice(0, 69).trim()}…` : fitment}.`
    : '';
  const snippet = String(shortName || uniqueDescription || '').replace(/\s+/g, ' ').trim();
  const detail = snippet.length >= 12 ? ` ${snippet.endsWith('.') ? snippet : `${snippet}.`}` : '';
  return `${condition} автозапчасть ${label} ${stock} в ${cityPrep}.${pricePart}${sellerPart}${stockPart}${fitmentPart}${detail}`
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildProductStructuredDataGraph({
  productJsonLd,
  breadcrumbJsonLd,
  canonicalUrl,
  title,
  description,
  faqJsonLd,
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
    if (faqJsonLd) {
      graph.push(faqJsonLd);
    }
  }
  if (!graph.length) return null;
  return { '@context': 'https://schema.org', '@graph': graph };
}

const SCHEMA_ORG_CONTEXT = 'https://schema.org';

function withSchemaContext(node) {
  if (!node) return null;
  if (node['@context']) return node;
  return { '@context': SCHEMA_ORG_CONTEXT, ...node };
}

/** Отдельные JSON-LD блоки (Яндекс «Товары» не разбирает @graph). */
export function buildProductStructuredDataBlocks({
  productJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
} = {}) {
  const blocks = [];
  if (productJsonLd) {
    blocks.push(withSchemaContext(productJsonLd));
  }
  if (breadcrumbJsonLd) {
    blocks.push(withSchemaContext(breadcrumbJsonLd));
  }
  if (faqJsonLd) {
    const faqNode = typeof faqJsonLd === 'string' ? JSON.parse(faqJsonLd) : faqJsonLd;
    blocks.push(withSchemaContext(faqNode));
  }
  return blocks.filter(Boolean);
}

export function buildNewPartStructuredDataGraph({
  productJsonLd,
  canonicalUrl,
  title,
  description,
  brand,
  article,
  cardName,
} = {}) {
  const path = canonicalUrl ? canonicalUrl.replace(SITE_ORIGIN, '') : '';
  const breadcrumbItems = buildBreadcrumbsForPath(path, { brand, article, cardName });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems);
  return buildProductStructuredDataGraph({
    productJsonLd,
    breadcrumbJsonLd,
    canonicalUrl,
    title,
    description,
  });
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
  const partTypeName = (product?.part_type?.name || '').trim();
  const title = buildProductSearchTitle({
    brand,
    article,
    productName: product?.name,
    partTypeName,
    shortName,
    city: resolveProductCity(organization),
    isNew: Boolean(product?.is_new),
  });
  const pageH1 = buildProductPageH1({
    brand,
    article,
    fallbackDisplayName: name,
  });
  const schemaName = productSchemaNameFromTitle(title);
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
    partTypeName,
  });

  const firstPhoto = product?.photos?.[0]?.photo_url;
  const imageUrl = resolveOgImageUrl(firstPhoto ? normalizeImageUrl(firstPhoto) : null);
  const jsonLd = buildCatalogProductJsonLd(product, { canonicalUrl, schemaName });
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
    quantity: product?.quantity,
    sellerName,
  });
  const bodyDescription = productBodyDescription({
    brand,
    article,
    name,
    uniqueDescription: uniqueDesc,
    shortName,
    partTypeName,
    city,
    sellerName,
    isNew: Boolean(product?.is_new),
    price: product?.price,
    quantity: product?.quantity,
    inStock,
    listingId,
  });

  return {
    title,
    description,
    canonicalUrl,
    h1: pageH1,
    schemaName,
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
  let jsonLd = null;
  if (meta.json_ld) {
    try {
      jsonLd = typeof meta.json_ld === 'string' ? JSON.parse(meta.json_ld) : meta.json_ld;
    } catch {
      jsonLd = null;
    }
  }
  let faqJsonLd = null;
  if (meta.faq_json_ld) {
    try {
      faqJsonLd = typeof meta.faq_json_ld === 'string' ? JSON.parse(meta.faq_json_ld) : meta.faq_json_ld;
    } catch {
      faqJsonLd = null;
    }
  }
  return {
    title: meta.title,
    description: meta.description,
    canonicalUrl: meta.canonical_url,
    h1: meta.h1 || '',
    schemaName: meta.schema_name || productSchemaNameFromTitle(meta.title),
    imageUrl: meta.image_url || resolveOgImageUrl(null),
    robots: 'index, follow',
    keywords: meta.keywords || '',
    seoSummary: meta.seo_summary || '',
    bodyDescription: meta.body_description || '',
    usedCatalogPath: meta.used_catalog_path || '',
    jsonLd,
    faqJsonLd,
    faqItems: Array.isArray(meta.faq_items) ? meta.faq_items : null,
    isNew: Boolean(meta.is_new),
    inStock: meta.in_stock !== false,
    price: meta.price,
    partTypeName: meta.part_type_name || '',
    fitmentText: meta.fitment_text || '',
  };
}

export function seoFromNewPartMetaResponse(meta) {
  if (!meta?.title || !meta?.description || !meta?.canonical_url) return null;
  let jsonLd = null;
  if (meta.json_ld) {
    try {
      jsonLd = typeof meta.json_ld === 'string' ? JSON.parse(meta.json_ld) : meta.json_ld;
    } catch {
      jsonLd = null;
    }
  }
  let faqJsonLd = null;
  if (meta.faq_json_ld) {
    try {
      faqJsonLd = typeof meta.faq_json_ld === 'string' ? JSON.parse(meta.faq_json_ld) : meta.faq_json_ld;
    } catch {
      faqJsonLd = null;
    }
  }
  const inStock = meta.in_stock !== false;
  return {
    title: meta.title,
    description: meta.description,
    canonicalUrl: meta.canonical_url,
    h1: meta.h1 || '',
    schemaName: meta.schema_name || productSchemaNameFromTitle(meta.title),
    imageUrl: meta.image_url || resolveOgImageUrl(null),
    robots: meta.robots || (inStock ? 'index, follow' : 'noindex, follow'),
    keywords: meta.keywords || '',
    seoSummary: meta.seo_summary || '',
    bodyDescription: meta.body_description || '',
    fitmentText: meta.fitment_text || '',
    stockSummary: meta.stock_summary || '',
    partTypeName: meta.part_type_name || '',
    city: meta.city || '',
    usedCatalogPath: meta.used_catalog_path || '',
    warehouseCount: Number(meta.warehouse_count) || 0,
    quantity: Number(meta.quantity) || 0,
    jsonLd,
    faqJsonLd,
    faqItems: Array.isArray(meta.faq_items) ? meta.faq_items : null,
    inStock,
    price: meta.price,
    ogType: 'product',
    ogImage: meta.image_url || resolveOgImageUrl(null),
  };
}
