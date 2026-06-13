import { DEFAULT_CITY } from './productSearchSeo';
import { buildProductAlternateNames } from './productSearchSeo';

const MAX_KEYWORDS = 12;
const MAX_PHRASE_LEN = 40;

function normalizePhrase(phrase) {
  return String(phrase || '').replace(/\s+/g, ' ').trim();
}

function truncatePhrase(phrase, maxLen = MAX_PHRASE_LEN) {
  const value = normalizePhrase(phrase);
  if (!value) return '';
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen - 1).trim();
}

function joinKeywords(phrases) {
  const seen = new Set();
  const unique = [];
  for (const phrase of phrases) {
    const normalized = truncatePhrase(phrase);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
    if (unique.length >= MAX_KEYWORDS) break;
  }
  return unique.join(', ');
}

function productPartKeywords({ brand, article, city, used }) {
  const brandText = normalizePhrase(brand);
  const articleText = normalizePhrase(article);
  const cityText = normalizePhrase(city || DEFAULT_CITY).toLowerCase();
  const phrases = [];

  for (const name of buildProductAlternateNames({ brand: brandText, article: articleText })) {
    phrases.push(name);
    phrases.push(`${name} купить`);
    phrases.push(`${name} цена`);
  }

  if (brandText && articleText) {
    phrases.push(`${used ? 'б/у' : 'новая'} ${brandText} ${articleText}`);
    phrases.push(`автозапчасть ${brandText}`);
  } else if (articleText) {
    phrases.push(`автозапчасть ${articleText}`);
  }

  if (used) {
    phrases.push(`купить б/у ${cityText}`);
  } else {
    phrases.push('купить с доставкой');
    if (brandText) {
      phrases.push(`новая запчасть ${brandText}`);
      phrases.push(`${brandText} автозапчасти`);
    }
  }

  return joinKeywords(phrases);
}

export function buildProductUsedKeywords({ brand, article, city } = {}) {
  return productPartKeywords({ brand, article, city, used: true });
}

export function buildUsedCatalogQKeywords({ brand, article } = {}) {
  return buildProductUsedKeywords({ brand, article, city: null });
}

export function buildNewPartCardKeywords({ brand, article } = {}) {
  return productPartKeywords({ brand, article, city: null, used: false });
}

export function buildBrandUsedKeywords(brandName) {
  const brand = normalizePhrase(brandName);
  if (!brand) return '';
  const city = DEFAULT_CITY.toLowerCase();
  return joinKeywords([
    `б/у запчасти ${brand}`,
    `${brand} автозапчасти`,
    `запчасти ${brand} б/у`,
    `купить ${brand} б/у`,
    `${brand} ${city}`,
    `автозапчасти ${brand}`,
  ]);
}

export function buildBrandNewKeywords(brandName) {
  const brand = normalizePhrase(brandName);
  if (!brand) return '';
  return joinKeywords([
    `новые запчасти ${brand}`,
    `${brand} автозапчасти`,
    `купить ${brand}`,
    `${brand} оригинал`,
    `${brand} с доставкой`,
    `запчасти ${brand} новые`,
  ]);
}

export function buildCategoryUsedKeywords({ titleRu, searchQuery } = {}) {
  const title = normalizePhrase(titleRu);
  const query = normalizePhrase(searchQuery) || title;
  if (!query && !title) return '';
  const label = title || query;
  return joinKeywords([
    `б/у ${label}`,
    `${query} купить`,
    `купить б/у ${label}`,
    `автозапчасти ${label}`,
    `${label} б/у екатеринбург`,
  ]);
}

export function buildCategoryNewKeywords({ titleRu, searchQuery } = {}) {
  const title = normalizePhrase(titleRu);
  const query = normalizePhrase(searchQuery) || title;
  if (!query && !title) return '';
  const label = title || query;
  return joinKeywords([
    `новые ${label}`,
    `${query} купить`,
    `купить ${label} с доставкой`,
    `автозапчасти ${label}`,
    `${label} новые запчасти`,
  ]);
}

export function buildGeoUsedKeywords(city) {
  const cityText = normalizePhrase(city || DEFAULT_CITY);
  const cityLower = cityText.toLowerCase();
  return joinKeywords([
    `б/у запчасти ${cityLower}`,
    `автозапчасти ${cityLower}`,
    `разборка ${cityLower}`,
    `купить б/у ${cityLower}`,
    `запчасти ${cityLower}`,
  ]);
}

const KEYWORD_BUILDERS = {
  product_used: (ctx) => buildProductUsedKeywords(ctx),
  used_catalog_q: (ctx) => buildUsedCatalogQKeywords(ctx),
  new_part_card: (ctx) => buildNewPartCardKeywords(ctx),
  brand_used: (ctx) => buildBrandUsedKeywords(ctx.brandName),
  brand_new: (ctx) => buildBrandNewKeywords(ctx.brandName),
  category_used: (ctx) => buildCategoryUsedKeywords(ctx),
  category_new: (ctx) => buildCategoryNewKeywords(ctx),
  geo_used: (ctx) => buildGeoUsedKeywords(ctx.city),
};

export function buildPageKeywords(pageType, context = {}) {
  const builder = KEYWORD_BUILDERS[pageType];
  return builder ? builder(context) : '';
}
