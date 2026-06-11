import { stripHtmlTags } from './text';
import { buildPartDetailPath, buildNewPartDetailPath } from './partRoutes';
import { formatProductDisplayTitle, extractProductDescription } from './productDisplayName';
import { normalizeImageUrl } from './apiClient';
import { resolveOgImageUrl } from './seoConstants';
import { DEFAULT_CITY } from './organizationCity';
import { buildProductAlternateNames, buildProductOfferJsonLd, resolveProductCity } from './productSearchSeo';

const SCHEMA_ORG = 'https://schema.org';
const SITE_ORIGIN = 'https://svoygarage.ru';

export function formatPriceLd(price) {
  if (price == null || price === '') return null;
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount.toFixed(2);
}

export function productBodyDescription({
  brand,
  article,
  name,
  uniqueDescription,
  shortName,
  isNew = false,
  maxLen = 500,
}) {
  const unique = stripHtmlTags(uniqueDescription || '').replace(/\s+/g, ' ').trim();
  const short = String(shortName || '').trim();
  const display = String(name || '').trim();

  for (const candidate of [unique, short, display]) {
    if (candidate && candidate.length >= 20) {
      if (candidate.length <= maxLen) return candidate;
      return `${candidate.slice(0, maxLen - 1).trim()}…`;
    }
  }

  const brandText = String(brand || '').trim();
  const articleText = String(article || '').trim();
  const condition = isNew ? 'Новая' : 'Б/у';
  if (brandText && articleText) {
    return `${condition} автозапчасть ${brandText} ${articleText}.`;
  }
  if (articleText) {
    return `${condition} автозапчасть ${articleText}.`;
  }
  return `${condition} автозапчасть.`;
}

export function sanitizeJsonLd(value) {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const items = value.map((item) => sanitizeJsonLd(item)).filter((item) => item != null && item !== '' && item !== {} && !(Array.isArray(item) && item.length === 0));
    return items.length > 0 ? items : undefined;
  }
  if (typeof value === 'object') {
    const cleaned = {};
    Object.entries(value).forEach(([key, item]) => {
      const sanitized = sanitizeJsonLd(item);
      if (sanitized == null || sanitized === '' || sanitized === {} || (Array.isArray(sanitized) && sanitized.length === 0)) {
        return;
      }
      cleaned[key] = sanitized;
    });
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }
  return value;
}

function catalogProductImageUrl(product, siteOrigin = SITE_ORIGIN) {
  const firstPhoto = product?.photos?.[0]?.photo_url;
  if (!firstPhoto) return null;
  const normalized = normalizeImageUrl(firstPhoto);
  if (!normalized) return null;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }
  return resolveOgImageUrl(normalized.startsWith('/') ? normalized : `/${normalized}`);
}

export function isCatalogProductJsonLdEligible(product) {
  if ((product?.quantity || 0) <= 0) return false;
  const brand = String(product?.brand || '').trim();
  const article = String(product?.article || '').trim();
  if (!brand || !article) return false;
  if (!String(product?.name || '').trim()) return false;
  if (!formatPriceLd(product?.price)) return false;
  return Boolean(catalogProductImageUrl(product));
}

export function buildCatalogProductJsonLd(product, { siteOrigin = SITE_ORIGIN, canonicalUrl } = {}) {
  if (!isCatalogProductJsonLdEligible(product)) return null;

  const brand = String(product.brand || '').trim();
  const article = String(product.article || '').trim();
  const name = formatProductDisplayTitle(brand, article, product.name);
  const shortName = extractProductDescription(product.name, brand, article);
  const path = buildPartDetailPath(product);
  const url = canonicalUrl || `${siteOrigin}${path}`;
  const imageUrl = catalogProductImageUrl(product, siteOrigin);
  if (!imageUrl) return null;

  const price = formatPriceLd(product.price);
  if (!price) return null;

  const inStock = (product.quantity || 0) > 0;
  const organization = product.organization || null;
  const uniqueDesc = stripHtmlTags(product.description || '').replace(/\s+/g, ' ').trim();
  const description = productBodyDescription({
    brand,
    article,
    name,
    uniqueDescription: uniqueDesc,
    shortName,
    isNew: Boolean(product.is_new),
  });
  const alternateName = buildProductAlternateNames({ brand, article });
  const offers = buildProductOfferJsonLd({
    canonicalUrl: url,
    price,
    inStock,
    isNew: Boolean(product.is_new),
    sellerName: organization?.name,
    sellerPhone: organization?.phone,
    sellerAddress: organization?.address,
    city: resolveProductCity(organization),
  });

  return sanitizeJsonLd({
    '@context': SCHEMA_ORG,
    '@type': 'Product',
    name,
    description,
    sku: article,
    mpn: article,
    alternateName: alternateName.length > 0 ? alternateName : undefined,
    brand: { '@type': 'Brand', name: brand },
    manufacturer: { '@type': 'Organization', name: brand },
    image: [imageUrl],
    offers,
  });
}

export function isNewPartJsonLdEligible(card) {
  const brand = String(card?.brand || '').trim();
  const article = String(card?.article || '').trim();
  if (!brand || !article) return false;
  if (!formatPriceLd(card?.price)) return false;
  const name = String(card?.name || '').trim();
  if (!name && !`${brand} ${article}`.trim()) return false;
  const stockCount = Number(card?.stock_count || 0);
  const imageUrl = String(card?.image_url || '').trim();
  return Boolean(imageUrl || stockCount > 0);
}

export function buildNewPartCardJsonLd(card, { siteOrigin = SITE_ORIGIN, canonicalUrl, displayPrice } = {}) {
  if (!isNewPartJsonLdEligible(card)) return null;

  const brand = String(card.brand || '').trim();
  const article = String(card.article || '').trim();
  const displayName = String(card.name || '').trim() || `${brand} ${article}`.trim();
  const path = buildNewPartDetailPath(card);
  const url = canonicalUrl || `${siteOrigin}${path}`;
  const uniqueDesc = String(card.description || '').trim();
  const description = productBodyDescription({
    brand,
    article,
    name: displayName,
    uniqueDescription: uniqueDesc,
    isNew: true,
  });

  let imageUrl = String(card.image_url || '').trim();
  if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    imageUrl = resolveOgImageUrl(imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`);
  } else if (!imageUrl) {
    imageUrl = resolveOgImageUrl(null);
  }

  const priceSource = displayPrice != null ? displayPrice : card.price;
  const price = formatPriceLd(priceSource);
  if (!price) return null;

  const inStock = Number(card.stock_count || 0) > 0;
  const alternateName = buildProductAlternateNames({ brand, article });
  const offers = buildProductOfferJsonLd({
    canonicalUrl: url,
    price,
    inStock,
    isNew: true,
    city: DEFAULT_CITY,
  });
  return sanitizeJsonLd({
    '@context': SCHEMA_ORG,
    '@type': 'Product',
    name: displayName,
    description,
    sku: article,
    mpn: article,
    alternateName: alternateName.length > 0 ? alternateName : undefined,
    brand: { '@type': 'Brand', name: brand },
    manufacturer: { '@type': 'Organization', name: brand },
    image: [imageUrl],
    offers,
  });
}

export function parseJsonLdString(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (_e) {
    return null;
  }
}
