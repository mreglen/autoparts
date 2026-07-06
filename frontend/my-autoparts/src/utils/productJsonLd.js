import { stripHtmlTags } from './text';
import { buildPartDetailPath, buildNewPartDetailPath } from './partRoutes';
import { formatProductDisplayTitle, extractProductDescription } from './productDisplayName';
import { normalizeImageUrl } from './apiClient';
import { resolveOgImageUrl, PRODUCT_PLACEHOLDER_IMAGE_URL } from './seoConstants';
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
  partTypeName,
  city,
  fitmentText,
  sellerName,
  isNew = false,
  maxLen = 500,
}) {
  const unique = stripHtmlTags(uniqueDescription || '').replace(/\s+/g, ' ').trim();
  const short = String(shortName || '').trim();
  const display = String(name || '').trim();
  const brandText = String(brand || '').trim();
  const articleText = String(article || '').trim();
  const partType = String(partTypeName || '').trim();
  const cityText = String(city || DEFAULT_CITY).trim() || DEFAULT_CITY;
  const seller = String(sellerName || '').trim();
  const condition = isNew ? 'Новая' : 'Б/у';
  const label = [brandText, articleText].filter(Boolean).join(' ') || display || 'автозапчасть';
  const fitment = String(fitmentText || '').replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  const fitmentShort = fitment.length > 80 ? `${fitment.slice(0, 79).trim()}…` : fitment;

  const sentences = [];

  if (unique && unique.length >= 20) {
    sentences.push(unique.endsWith('.') ? unique : `${unique}.`);
  }

  if (partType) {
    sentences.push(
      `${condition} ${partType.toLowerCase()} ${label} — предложение на маркетплейсе «Свой Гараж».`,
    );
  } else {
    sentences.push(
      `${condition} автозапчасть ${label} — предложение на маркетплейсе «Свой Гараж».`,
    );
  }

  if (short && !sentences.join(' ').toLowerCase().includes(short.toLowerCase())) {
    sentences.push(`Назначение: ${short}.`);
  }

  if (fitmentShort) {
    sentences.push(`По справочнику подходит для: ${fitmentShort}.`);
  }

  if (seller) {
    sentences.push(`Продавец: ${seller}, город ${cityText}.`);
  } else {
    sentences.push(`Товар находится в ${cityText}.`);
  }

  if (isNew) {
    sentences.push(
      'Новая деталь в упаковке или на складе. Доставка по России, самовывоз — у продавца.',
    );
  } else {
    sentences.push(
      'Перед покупкой можно осмотреть деталь и уточнить совместимость у продавца. Доставка по России, самовывоз — у продавца.',
    );
  }

  const combined = sentences.filter(Boolean).join(' ');
  if (combined.length <= maxLen) return combined;
  return `${combined.slice(0, maxLen - 1).trim()}…`;
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

function catalogProductImageUrls(product, siteOrigin = SITE_ORIGIN, maxCount = 5) {
  const urls = [];
  const seen = new Set();
  for (const photo of product?.photos || []) {
    const firstPhoto = photo?.photo_url;
    if (!firstPhoto) continue;
    const normalized = normalizeImageUrl(firstPhoto);
    if (!normalized) continue;
    const absolute = normalized.startsWith('http://') || normalized.startsWith('https://')
      ? normalized
      : resolveOgImageUrl(normalized.startsWith('/') ? normalized : `/${normalized}`);
    if (!absolute || seen.has(absolute)) continue;
    seen.add(absolute);
    urls.push(absolute);
    if (urls.length >= maxCount) break;
  }
  if (!urls.length) {
    urls.push(PRODUCT_PLACEHOLDER_IMAGE_URL);
  }
  return urls;
}

export function isCatalogProductJsonLdEligible(product) {
  if ((product?.quantity || 0) <= 0) return false;
  const brand = String(product?.brand || '').trim();
  const article = String(product?.article || '').trim();
  if (!brand || !article) return false;
  if (!String(product?.name || '').trim()) return false;
  if (!formatPriceLd(product?.price)) return false;
  return true;
}

export function buildCatalogProductJsonLd(product, { siteOrigin = SITE_ORIGIN, canonicalUrl, schemaName } = {}) {
  if (!isCatalogProductJsonLdEligible(product)) return null;

  const brand = String(product.brand || '').trim();
  const article = String(product.article || '').trim();
  const displayName = formatProductDisplayTitle(brand, article, product.name);
  const name = String(schemaName || '').trim() || displayName;
  const shortName = extractProductDescription(product.name, brand, article);
  const path = buildPartDetailPath(product);
  const url = canonicalUrl || `${siteOrigin}${path}`;
  const imageUrls = catalogProductImageUrls(product, siteOrigin);
  if (!imageUrls.length) return null;

  const price = formatPriceLd(product.price);
  if (!price) return null;

  const inStock = (product.quantity || 0) > 0;
  const organization = product.organization || null;
  const uniqueDesc = stripHtmlTags(product.description || '').replace(/\s+/g, ' ').trim();
  const description = productBodyDescription({
    brand,
    article,
    name: displayName,
    uniqueDescription: uniqueDesc,
    shortName,
    isNew: Boolean(product.is_new),
  });
  const alternateName = buildProductAlternateNames({ brand, article });
  const categoryRaw = product?.part_type?.name ?? product?.part_type_name;
  const categoryName = typeof categoryRaw === 'string' ? categoryRaw.trim() : '';
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
    '@id': `${url}#product`,
    url,
    name,
    description,
    sku: article,
    mpn: article,
    alternateName: alternateName.length > 0 ? alternateName : undefined,
    brand: { '@type': 'Brand', name: brand },
    manufacturer: { '@type': 'Organization', name: brand },
    category: categoryName || undefined,
    image: imageUrls,
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
  return true;
}

export function buildNewPartCardJsonLd(
  card,
  { siteOrigin = SITE_ORIGIN, canonicalUrl, displayPrice, schemaName } = {},
) {
  if (!isNewPartJsonLdEligible(card)) return null;

  const brand = String(card.brand || '').trim();
  const article = String(card.article || '').trim();
  const displayName = String(card.name || '').trim() || `${brand} ${article}`.trim();
  const productName = (schemaName || '').trim() || displayName;
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
    imageUrl = PRODUCT_PLACEHOLDER_IMAGE_URL;
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
    '@id': `${url}#product`,
    url,
    name: productName,
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
