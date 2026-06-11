import { DEFAULT_CITY, extractCityFromAddress, formatCityInPrepositional } from './organizationCity';
import { extractProductDescription, formatProductDisplayTitle } from './productDisplayName';

const SITE_BRAND = 'Свой Гараж';
const TITLE_SUFFIX = ` | ${SITE_BRAND}`;

function truncate(text, maxLen) {
  const value = (text || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1).trim()}…`;
}

function formatPriceRub(price) {
  if (price == null || price === '') return null;
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (Number.isInteger(amount)) {
    return amount.toLocaleString('ru-RU');
  }
  return amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildListingContextSuffix({ sellerName, listingId }) {
  const seller = String(sellerName || '').trim();
  const parts = [];
  if (seller) parts.push(seller);
  if (listingId != null && listingId !== '') parts.push(`№${listingId}`);
  if (!parts.length) return '';
  return ` — ${parts.join(' ')}`;
}

function appendListingUniqueness(base, { sellerName, listingId, maxLen = 160 }) {
  const seller = String(sellerName || '').trim();
  const tailParts = [];
  if (seller) tailParts.push(`Продавец: ${seller}.`);
  if (listingId != null && listingId !== '') tailParts.push(`Объявление №${listingId}.`);
  if (!tailParts.length) return truncate(base, maxLen);

  const tail = tailParts.join(' ');
  const combined = `${base} ${tail}`;
  if (combined.length <= maxLen) return combined;

  const remaining = maxLen - tail.length - 1;
  if (remaining > 40) {
    return `${truncate(base, remaining)} ${tail}`;
  }
  return truncate(combined, maxLen);
}

function mergeContentSnippet({ shortName, uniqueDescription, maxLen = 120 }) {
  const short = String(shortName || '').replace(/\s+/g, ' ').trim();
  const unique = String(uniqueDescription || '').replace(/\s+/g, ' ').trim();
  const parts = [];
  if (short) parts.push(short);
  if (unique && !short.toLowerCase().includes(unique.toLowerCase())) {
    parts.push(unique);
  }
  if (!parts.length) return '';
  const merged = parts.join('. ');
  if (merged.length <= maxLen) return merged;
  return truncate(merged, maxLen);
}

function buildTitleCore({ brand, article, productName, fallbackDisplayName }) {
  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();
  if (brandStr || articleStr) {
    const raw = String(productName || '').trim() || null;
    return formatProductDisplayTitle(brandStr, articleStr, raw);
  }

  const fallback = String(fallbackDisplayName || '').trim();
  if (fallback) return fallback;
  const raw = String(productName || '').trim();
  return raw || 'Автозапчасть';
}

function fitCoreWithSuffix(core, suffix, maxLen) {
  const normalizedCore = String(core || '').replace(/\s+/g, ' ').trim();
  const normalizedSuffix = suffix || '';
  if (!normalizedSuffix) return truncate(normalizedCore, maxLen);

  const combined = `${normalizedCore}${normalizedSuffix}`;
  if (combined.length <= maxLen) return combined;

  const allowedCore = maxLen - normalizedSuffix.length;
  if (allowedCore < 1) return truncate(combined, maxLen);
  return `${truncate(normalizedCore, allowedCore)}${normalizedSuffix}`;
}

export function buildProductSearchTitle({
  brand,
  article,
  productName,
  fallbackDisplayName,
  sellerName,
  listingId,
}) {
  const core = buildTitleCore({ brand, article, productName, fallbackDisplayName });
  const suffix = buildListingContextSuffix({ sellerName, listingId });
  const maxCoreLen = Math.max(20, 70 - TITLE_SUFFIX.length);
  const coreWithSuffix = fitCoreWithSuffix(core, suffix, maxCoreLen);
  return `${coreWithSuffix}${TITLE_SUFFIX}`.replace(/\s+/g, ' ').trim();
}

export function buildNewPartH1({ brand, article, rawName }) {
  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();
  const raw = String(rawName || '').trim();
  if (brandStr && articleStr) {
    const prefix = `${brandStr} ${articleStr}`;
    if (raw) {
      const rawLower = raw.toLowerCase();
      const prefixLower = prefix.toLowerCase();
      if (rawLower.startsWith(prefixLower)) {
        const tail = raw.slice(prefix.length).trim().replace(/^[-—]\s*/, '');
        if (tail) return `${prefix} — ${tail}`;
      }
      if (rawLower.includes(prefixLower) && raw !== prefix) return raw;
      return `${prefix} — ${raw}`;
    }
    return prefix;
  }
  if (raw) return raw;
  return 'Автозапчасть';
}

export function buildNewPartSearchTitle({ brand, article, rawName, cardId, price }) {
  const core = buildTitleCore({ brand, article, productName: rawName });
  const priceText = formatPriceRub(price);
  const pricePart = priceText ? ` от ${priceText} ₽` : '';
  const suffix = `${pricePart} — новая №${cardId}`;
  const maxCoreLen = Math.max(20, 70 - TITLE_SUFFIX.length);
  const coreWithSuffix = fitCoreWithSuffix(core, suffix, maxCoreLen);
  return `${coreWithSuffix}${TITLE_SUFFIX}`.replace(/\s+/g, ' ').trim();
}

export function buildNewPartSearchDescription({
  brand,
  article,
  rawName,
  cardId,
  price,
  inStock = true,
  city,
  uniqueDescription,
}) {
  const shortName = extractProductDescription(rawName, brand, article);
  return buildProductSearchDescription({
    brand,
    article,
    isNew: true,
    city,
    price,
    inStock,
    shortName,
    uniqueDescription,
    listingId: cardId,
  });
}

export function buildProductSearchDescription({
  brand,
  article,
  isNew,
  city,
  price,
  inStock = true,
  shortName,
  uniqueDescription,
  sellerName,
  listingId,
}) {
  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();
  const condition = isNew ? 'Новая' : 'Б/у';
  const cityPrep = formatCityInPrepositional(city || DEFAULT_CITY);
  const snippetSource = mergeContentSnippet({ shortName, uniqueDescription });

  let buyLine;
  if (brandStr && articleStr) {
    buyLine = `Купить ${brandStr} ${articleStr}.`;
  } else if (articleStr) {
    buyLine = `Купить запчасть ${articleStr}.`;
  } else {
    buyLine = 'Купить автозапчасть.';
  }

  const stockPhrase = inStock ? 'в наличии' : 'доступна';
  let core = `${buyLine} ${condition} запчасть ${stockPhrase} в ${cityPrep}.`;
  const priceText = formatPriceRub(price);
  if (priceText) {
    core = `${core} ${priceText} ₽.`;
  }
  const delivery = 'Доставка по России.';
  const base = `${core} ${delivery}`;

  if (snippetSource) {
    const combined = `${base} ${snippetSource}`;
    if (combined.length <= 160) {
      return appendListingUniqueness(combined, { sellerName, listingId });
    }
    const remaining = 160 - `${base} `.length - 1;
    if (remaining > 20) {
      return appendListingUniqueness(`${base} ${truncate(snippetSource, remaining)}`, {
        sellerName,
        listingId,
      });
    }
  }
  return appendListingUniqueness(truncate(base, 160), { sellerName, listingId });
}

export function buildProductAlternateNames({ brand, article }) {
  const brandStr = String(brand || '').trim();
  const articleStr = String(article || '').trim();
  if (!articleStr) return [];

  const names = [articleStr];
  if (brandStr) {
    names.push(`${brandStr} ${articleStr}`, `${articleStr} ${brandStr}`);
  }

  const seen = new Set();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveProductCity(organization) {
  return extractCityFromAddress(organization?.address);
}

export function buildProductOfferJsonLd({
  canonicalUrl,
  price,
  inStock,
  isNew,
  sellerName,
  sellerPhone,
  sellerAddress,
  city,
}) {
  if (!price) return undefined;

  const cityName = city || DEFAULT_CITY;
  const offer = {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'RUB',
    price: String(price),
    availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: isNew ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
    areaServed: { '@type': 'Country', name: 'RU' },
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: 'RU',
      },
    },
    availableAtOrFrom: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: cityName,
        addressCountry: 'RU',
      },
    },
  };

  if (sellerName || sellerPhone || sellerAddress) {
    const seller = {
      '@type': 'Organization',
      name: (sellerName || SITE_BRAND).trim(),
    };
    if (sellerPhone) seller.telephone = String(sellerPhone).trim();
    if (sellerAddress || cityName) {
      seller.address = {
        '@type': 'PostalAddress',
        addressLocality: cityName,
        addressCountry: 'RU',
      };
      const street = String(sellerAddress || '').trim();
      if (street) seller.address.streetAddress = street;
    }
    offer.seller = seller;
  }

  return offer;
}

export { DEFAULT_CITY, extractCityFromAddress, formatCityInPrepositional };
